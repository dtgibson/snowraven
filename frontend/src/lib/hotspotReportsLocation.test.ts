// One location's report (hotspot-reports schema section 4; QA-11, QA-33, QA-34,
// QA-37, QA-38, QA-41 to QA-53, QA-76).
//
// The roll-up and the weather figures are held to the SHIPPED functions over an
// independently filtered input (schema 13.3, obligation 4): `computeChecklists`
// over every row then filtered to the location's Submission IDs, and
// `computeWeatherStats` over those entries.

import { describe, it, expect } from 'vitest'
import type { ObservationEntry } from '../types'
import { row, checklist } from '../test/hotspotReportsRows'
import { buildLocationIndex } from './hotspotReports'
import {
  applySpeciesRule, deriveLocationFacts, weatherView,
  DURATION_MAX_MIN, PROTOCOL_NAME_MAX_CHARS, PROTOCOL_ROWS_MAX, REPORT_YEAR_ROWS_MAX,
} from './hotspotReportsLocation'
import { computeChecklists, computeDurationBins } from './birdingStats'
import { computeWeatherStats, WEATHER_SPECIES_MIN_CHECKLISTS } from './weatherStats'
import { CONDITION_DISPLAY_ORDER } from './weatherDisplay'
import { formatWeather, type HourlyResponse } from './weatherFormatter'

const NONE: ReadonlySet<string> = new Set()

function report(rows: ObservationEntry[], locationId = 'L1', escapees: ReadonlySet<string> = NONE) {
  const index = buildLocationIndex(rows)
  const ord = index.ordById.get(locationId)!
  const facts = deriveLocationFacts(index, rows, ord)
  return { index, ord, facts, species: applySpeciesRule(facts, escapees) }
}

describe('membership and dating (FR-33, FR-34, QA-33, QA-34)', () => {
  it('lists countable dated species, folds a form into its species, and leaves spuhs, slashes and hybrids out', () => {
    const { species } = report(checklist({
      submissionId: 'S1',
      species: ['Song Sparrow', "Red-tailed Hawk (Harlan's)", 'gull sp.', 'Snow Goose/Ross\'s Goose', 'Mallard x American Black Duck (hybrid)'],
    }))
    expect(species.rows.map(r => r.name).sort()).toEqual(['Red-tailed Hawk', 'Song Sparrow'])
  })

  it("QA-33's example form follows the shipped countability predicate, which reads its slash as non-countable", () => {
    // `Red-tailed Hawk (calurus/alascensis)` is not a name eBird publishes, so
    // `isNonCountableForm` judges it by the naming convention, where a slash on
    // the raw name is a non-countable shape. The tab follows the shipped
    // predicate (bird-names.md: the convention wins over an artifact), so the
    // name is not listed (decisions.md D-05).
    const { species } = report(checklist({ submissionId: 'S1', species: ['Red-tailed Hawk (calurus/alascensis)'] }))
    expect(species.rows).toEqual([])
  })

  it('a species seen only undated, or only with no Submission ID, is not listed', () => {
    const { species } = report([
      row({ submissionId: 'S1', commonName: 'Song Sparrow' }),
      row({ submissionId: 'S1', commonName: 'Blue Jay', date: '2024-13-01' }),
      row({ submissionId: '', locationId: 'L1', commonName: 'Mallard' }),
    ])
    expect(species.rows.map(r => r.name)).toEqual(['Song Sparrow'])
  })

  it('dates a species to its earliest record AT the location, never its global first', () => {
    const rows = [
      ...checklist({ submissionId: 'S1', locationId: 'L1', date: '2019-05-01', species: ['Wood Duck'] }),
      ...checklist({ submissionId: 'S2', locationId: 'L2', date: '2021-03-02', species: ['Wood Duck'] }),
      ...checklist({ submissionId: 'S3', locationId: 'L2', date: '2022-03-02', species: ['Wood Duck'] }),
    ]
    expect(report(rows, 'L2').species.rows[0]).toMatchObject({ day: 20210302, checklistId: 'S2' })
    expect(report(rows, 'L1').species.rows[0]).toMatchObject({ day: 20190501, checklistId: 'S1' })
    expect(report(rows, 'L1').species.rows.map(r => r.name)).toEqual(['Wood Duck'])
  })

  it('of two same-day records the timed one dates the row; equal instants go to the smaller id', () => {
    const rows = [
      ...checklist({ submissionId: 'S2', date: '2024-05-01', time: null, species: ['Wood Duck'] }),
      ...checklist({ submissionId: 'S3', date: '2024-05-01', time: '09:00 AM', species: ['Wood Duck', 'Mallard'] }),
      ...checklist({ submissionId: 'S1', date: '2024-05-01', time: '09:00 AM', species: ['Mallard'] }),
    ]
    const byName = new Map(report(rows).species.rows.map(r => [r.name, r.checklistId]))
    expect(byName.get('Wood Duck')).toBe('S3')
    expect(byName.get('Mallard')).toBe('S1')
  })
})

describe('the list rows (FR-37, QA-37, QA-38)', () => {
  it('counts the checklists a species is on, an undated one included, newest first by first date', () => {
    const rows = [
      ...checklist({ submissionId: 'S1', date: '2020-01-01', species: ['Wood Duck', 'Mallard'] }),
      ...checklist({ submissionId: 'S2', date: '2021-01-01', species: ['Wood Duck'] }),
      ...checklist({ submissionId: 'S3', date: 'n/a', species: ['Wood Duck'] }),
      ...checklist({ submissionId: 'S4', date: '2022-06-01', species: ['Blue Jay'] }),
      ...checklist({ submissionId: 'S5', date: '2022-07-01', species: ['gull sp.'] }),
    ]
    const { species, facts } = report(rows)
    expect(facts.checklists.length).toBe(5)
    expect(species.rows.map(r => [r.name, r.checklists, r.position])).toEqual([
      ['Blue Jay', 1, 3], ['Mallard', 1, 2], ['Wood Duck', 3, 1],
    ])
  })

  it('a location of spuhs only has an empty list and a total of 0, and keeps every other figure', () => {
    const { species, facts } = report(checklist({ submissionId: 'S1', protocol: 'P21', species: ['gull sp.', 'duck sp.'] }))
    expect(species.total).toBe(0)
    expect(species.rows).toEqual([])
    expect(species.biggest).toBeNull()
    expect(facts.checklists.length).toBe(1)
    expect(facts.protocols.map(p => p.name)).toEqual(['Stationary'])
  })

  it('an escapee is left out, leaves the total, and does not raise a checklist\'s species count (QA-35, QA-53)', () => {
    const rows = [
      ...checklist({ submissionId: 'S1', date: '2020-01-01', species: ['Mute Swan', 'Mallard', 'Wood Duck'] }),
      ...checklist({ submissionId: 'S2', date: '2021-01-01', species: ['Mallard', 'Wood Duck'] }),
    ]
    const plain = report(rows)
    expect(plain.species.biggest).toMatchObject({ species: 3 })
    expect(plain.species.biggest!.checklist.submissionId).toBe('S1')
    const ruled = report(rows, 'L1', new Set(['Mute Swan']))
    expect(ruled.species.total).toBe(2)
    expect(ruled.species.rows.map(r => r.name)).not.toContain('Mute Swan')
    // Now both checklists carry 2: the tie goes to the earlier one.
    expect(ruled.species.biggest).toMatchObject({ species: 2, day: 20200101 })
  })
})

describe('the roll-up is the shipped one (FR-11, schema 4.1)', () => {
  it('equals computeChecklists over every row, filtered to the location\'s Submission IDs', () => {
    let seed = 11
    const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff }
    const rows: ObservationEntry[] = []
    for (let c = 0; c < 300; c++) {
      const loc = `L${1 + Math.floor(rnd() * 5)}`
      for (let k = 0; k < 1 + Math.floor(rnd() * 5); k++) {
        rows.push(row({
          submissionId: `S${5000 + c}`, locationId: k === 0 ? loc : (rnd() < 0.3 ? '' : loc),
          commonName: ['A', 'B', 'C', 'gull sp.'][Math.floor(rnd() * 4)],
          protocol: k === 0 ? ['P21', 'P22', null, 'P60'][c % 4] : 'P99', duration: k === 0 ? Math.floor(rnd() * 200) : 999,
          date: `2023-0${1 + (c % 9)}-1${c % 10}`,
        }))
      }
    }
    // Interleave checklists so file order is not grouped by location.
    rows.sort((a, b) => (a.commonName < b.commonName ? -1 : 1))
    const all = computeChecklists(rows)
    const index = buildLocationIndex(rows)
    for (let ord = 0; ord < index.locations.length; ord++) {
      const facts = deriveLocationFacts(index, rows, ord)
      const subs = new Set(facts.checklists.map(c => c.submissionId))
      const oracle = all.filter(c => subs.has(c.submissionId) && index.checklistLoc.get(c.submissionId) === ord)
      expect(facts.checklists.map(c => [c.submissionId, c.date, c.protocol, c.duration, c.locationId]))
        .toEqual(oracle.map(c => [c.submissionId, c.date, c.protocol, c.duration, c.locationId]))
      expect(facts.checklists.length).toBe(index.checklistCount[ord])
    }
  })
})

describe('checklists by protocol (FR-42, FR-43, QA-41, QA-42)', () => {
  it('names protocols as the Checklists tab does, with a stated blank bucket, summing to the total', () => {
    const rows = [
      ...[1, 2, 3].flatMap(i => checklist({ submissionId: `T${i}`, protocol: 'P22', species: ['A'] })),
      ...[1, 2].flatMap(i => checklist({ submissionId: `S${i}`, protocol: 'P21', species: ['A'] })),
      ...checklist({ submissionId: 'B1', protocol: null, species: ['A'] }),
    ]
    const { facts } = report(rows)
    expect(facts.protocols.map(p => [p.kind, p.name, p.count])).toEqual([
      ['named', 'Traveling', 3], ['named', 'Stationary', 2], ['blank', '', 1],
    ])
  })

  it('merges cells that share a label after naming (P60 and P62 are both Pelagic)', () => {
    const rows = [
      ...checklist({ submissionId: 'A1', protocol: 'P60', species: ['A'] }),
      ...checklist({ submissionId: 'A2', protocol: 'P62', species: ['A'] }),
    ]
    expect(report(rows).facts.protocols.map(p => [p.name, p.count])).toEqual([['Pelagic', 2]])
  })

  it('shows ten named rows, sums the rest into one, keeps the blank bucket last, and bounds a long name', () => {
    const rows: ObservationEntry[] = []
    for (let i = 0; i < 40; i++) rows.push(...checklist({ submissionId: `S${i}`, protocol: i === 0 ? 'x'.repeat(500) : `Custom ${String(i).padStart(2, '0')}`, species: ['A'] }))
    rows.push(...checklist({ submissionId: 'B1', protocol: '', species: ['A'] }))
    const { facts } = report(rows)
    const named = facts.protocols.filter(p => p.kind === 'named')
    expect(named.length).toBe(PROTOCOL_ROWS_MAX)
    expect(facts.protocols[facts.protocols.length - 2]).toMatchObject({ kind: 'other', count: 30 })
    expect(facts.protocols[facts.protocols.length - 1]).toMatchObject({ kind: 'blank', count: 1 })
    expect(facts.protocols.reduce((n, p) => n + p.count, 0)).toBe(41)
    // Ties on count order by label, so the 500-character label sorts last among
    // the ties and falls into Other; its bound is checked directly.
    const long = report([...checklist({ submissionId: 'Z1', protocol: 'x'.repeat(500), species: ['A'] })]).facts.protocols[0]
    expect([long.name.length, long.truncated]).toEqual([PROTOCOL_NAME_MAX_CHARS, true])
  })

  it('the protocol-name bound is the schema\'s 64: a 64-character label is kept whole, a 65-character one is cut to 64', () => {
    // Pinned by BEHAVIOUR at the value FR-43 and schema 4.3 state, not by the
    // constant against itself, so moving the bound either way goes red here.
    const rows = [
      ...checklist({ submissionId: 'A1', protocol: 'p'.repeat(64), species: ['A'] }),
      ...checklist({ submissionId: 'A2', protocol: 'q'.repeat(65), species: ['A'] }),
      ...checklist({ submissionId: 'A3', protocol: 'q'.repeat(65), species: ['A'] }),
    ]
    const byCount = new Map(report(rows).facts.protocols.map(p => [p.count, [p.name.length, p.truncated]]))
    expect(byCount.get(1)).toEqual([64, false])
    expect(byCount.get(2)).toEqual([64, true])
  })

  it('the sum holds over a generated corpus', () => {
    for (let n = 0; n < 30; n++) {
      const rows: ObservationEntry[] = []
      for (let c = 0; c < n * 3 + 1; c++) rows.push(...checklist({ submissionId: `S${c}`, protocol: c % 5 === 0 ? null : `P${c % (n + 2)}`, species: ['A'] }))
      const { facts } = report(rows)
      expect(facts.protocols.reduce((s, p) => s + p.count, 0)).toBe(facts.checklists.length)
    }
  })
})

describe('the complete share (FR-44, QA-43)', () => {
  it('counts complete over the checklists that say, and states how many do not say', () => {
    const rows: ObservationEntry[] = []
    const vals = [true, true, true, true, false, null, null]
    vals.forEach((v, i) => rows.push(...checklist({ submissionId: `S${i}`, allObsReported: v, species: ['A'] })))
    expect(report(rows).facts.complete).toEqual({ complete: 4, known: 5, unknown: 2 })
  })
})

describe('first and latest visit (FR-51, QA-50)', () => {
  it('a blank time loses a same-day tie for first; a single dated checklist is the only visit', () => {
    const rows = [
      ...checklist({ submissionId: 'S2', date: '2020-01-01', time: null, species: ['A'] }),
      ...checklist({ submissionId: 'S3', date: '2020-01-01', time: '08:00 AM', species: ['A'] }),
      ...checklist({ submissionId: 'S4', date: '2023-01-01', time: '08:00 AM', species: ['A'] }),
      ...checklist({ submissionId: 'S5', date: 'bad', species: ['A'] }),
    ]
    const { facts } = report(rows)
    expect(facts.firstVisit!.submissionId).toBe('S3')
    expect(facts.latestVisit!.submissionId).toBe('S4')
    const only = report(checklist({ submissionId: 'S9', date: '2020-01-01', species: ['A'] })).facts
    expect(only.firstVisit).toEqual(only.latestVisit)
    const none = report(checklist({ submissionId: 'S8', date: '', species: ['A'] })).facts
    expect([none.firstVisit, none.latestVisit]).toEqual([null, null])
  })
})

describe('visits by month and by year (FR-52, QA-51, QA-76)', () => {
  it('twelve months with zeros present, years ascending, only years present, undated stated', () => {
    const rows = [
      ...checklist({ submissionId: 'S1', date: '1900-03-04', species: ['A'] }),
      ...checklist({ submissionId: 'S2', date: '2025-03-04', species: ['A'] }),
      ...checklist({ submissionId: 'S3', date: '2025-12-31', species: ['A'] }),
      ...checklist({ submissionId: 'S4', date: 'x', species: ['A'] }),
    ]
    const { facts } = report(rows)
    expect(facts.months).toEqual([0, 0, 2, 0, 0, 0, 0, 0, 0, 0, 0, 1])
    expect(facts.years).toEqual([{ kind: 'year', year: 1900, count: 1 }, { kind: 'year', year: 2025, count: 2 }])
    expect([facts.datedChecklists, facts.checklists.length]).toEqual([3, 4])
  })

  it('150 distinct years render 101 rows: Before the first shown year, then the 100 most recent', () => {
    const rows: ObservationEntry[] = []
    for (let y = 0; y < 150; y++) rows.push(...checklist({ submissionId: `S${y}`, date: `${1800 + y}-01-01`, species: ['A'] }))
    const { facts } = report(rows)
    expect(facts.years.length).toBe(REPORT_YEAR_ROWS_MAX + 1)
    expect(facts.years[0]).toEqual({ kind: 'earlier', before: 1850, count: 50 })
    expect(facts.years[1]).toEqual({ kind: 'year', year: 1850, count: 1 })
    expect(facts.years.reduce((n, y) => n + y.count, 0)).toBe(facts.datedChecklists)
    const hundred: ObservationEntry[] = []
    for (let y = 0; y < 100; y++) hundred.push(...checklist({ submissionId: `S${y}`, date: `${1900 + y}-01-01`, species: ['A'] }))
    const f2 = report(hundred).facts
    expect([f2.years.length, f2.years.every(y => y.kind === 'year')]).toEqual([100, true])
  })
})

describe('time birded follows the Statistics duration rule (FR-53, QA-52, schema 4.6)', () => {
  it('60 + 30 with blank, negative and over-long durations gives 90 minutes over 2 of 5', () => {
    const rows = [60, 30, null, -5, 5000].flatMap((d, i) => checklist({ submissionId: `S${i}`, duration: d, species: ['A'] }))
    expect(report(rows).facts.timeBirded).toEqual({ minutes: 90, counted: 2 })
  })

  it('agrees with computeDurationBins over a generated corpus, by behavior and never by restating its constant', () => {
    const durations = [null, -1, 0, 1, 59, 60, 1439, DURATION_MAX_MIN, DURATION_MAX_MIN + 1, 99999]
    for (let n = 1; n < 40; n++) {
      const rows = Array.from({ length: n }, (_, i) => checklist({ submissionId: `S${i}`, duration: durations[(i * 7 + n) % durations.length], species: ['A'] })).flat()
      const { facts } = report(rows)
      const bins = computeDurationBins([...facts.checklists])
      expect(facts.timeBirded.counted).toBe(bins.durationCount)
      expect(facts.timeBirded.minutes).toBe(Math.round((bins.avgDurationMin ?? 0) * bins.durationCount))
    }
  })
})

// ── Weather (FR-45 to FR-49) ─────────────────────────────────────────────────

const TZ = 'America/New_York'
function hourly(temp: number, owmId: number, wind: number): HourlyResponse {
  return {
    data: [{
      dt: 1716570000, temp, humidity: 70, dew_point: 50, wind_speed: wind, wind_deg: 200,
      clouds: 20, weather: [{ id: owmId, description: 'x' }], sunrise: 1716550000, sunset: 1716600000,
    }],
  }
}
const block = (temp: number, owmId = 801, wind = 6) => formatWeather([hourly(temp, owmId, wind)], TZ, 40.6)

describe('weather from the location\'s own blocks (FR-45 to FR-49, QA-44 to QA-48)', () => {
  function withBlocks(n: number, extra: ObservationEntry[] = [], comment = (i: number) => block(40 + i * 3, 800 + (i % 3), 2 + (i % 6) * 3)) {
    const rows: ObservationEntry[] = []
    for (let i = 0; i < n; i++) rows.push(...checklist({ submissionId: `W${i}`, checklistComments: comment(i), species: ['A'] }))
    return [...rows, ...extra]
  }

  it('equals computeWeatherStats over that location\'s checklists, and reads only its own', () => {
    const rows = withBlocks(12, [
      ...checklist({ submissionId: 'X1', locationId: 'L2', checklistComments: block(90), species: ['A'] }),
      ...checklist({ submissionId: 'N1', checklistComments: 'No block here.', species: ['A'] }),
    ])
    const { facts } = report(rows)
    const oracle = computeWeatherStats(computeChecklists(rows).filter(c => c.locationId === 'L1'), [])
    expect(facts.weather.byCondition).toEqual(oracle.byCondition)
    expect(facts.weather.byTempBand).toEqual(oracle.byTempBand)
    expect(facts.weather.byWindBand).toEqual(oracle.byWindBand)
    expect([facts.weather.readableCount, facts.weather.totalChecklists]).toEqual([12, 13])
  })

  it('no found block is the none state; 9 readable is below the floor; 10 is full', () => {
    expect(weatherView(report(withBlocks(0, checklist({ submissionId: 'N1', species: ['A'] }))).facts.weather)).toEqual({ state: 'none' })
    const nine = weatherView(report(withBlocks(9)).facts.weather)
    expect(nine).toMatchObject({ state: 'below-floor', readable: 9, total: 9 })
    expect(weatherView(report(withBlocks(10)).facts.weather).state).toBe('full')
  })

  it('the floor is WEATHER_SPECIES_MIN_CHECKLISTS, and moving the parameter moves the boundary', () => {
    expect(WEATHER_SPECIES_MIN_CHECKLISTS).toBe(10)
    const nine = report(withBlocks(9)).facts.weather
    expect(weatherView(nine, 9).state).toBe('full')
    expect(weatherView(nine, 10).state).toBe('below-floor')
  })

  it('states unreadable blocks in the coverage (QA-45)', () => {
    const unreadable = `\u{1F985}  Nonsense  Temperature: nope  Wind: nope  ${block(50).slice(block(50).lastIndexOf('Weather'))}`
    const rows = withBlocks(12, checklist({ submissionId: 'U1', checklistComments: unreadable, species: ['A'] }))
    const w = report(rows).facts.weather
    const view = weatherView(w)
    if (w.unreadableCount === 0) {
      // The constructed block must be FOUND and unreadable for this row to mean
      // anything; fail loudly rather than pass on a block the gate never saw.
      expect.fail('the unreadable fixture was not found by the attribution gate')
    }
    expect(view).toMatchObject({ readable: 12, unreadable: 1, total: 13 })
  })

  it('each figure states its own denominator and names the most common band; a tie goes to the band shown first', () => {
    const rows = withBlocks(12, [], i => block(70, i < 6 ? 800 : 801, 6))
    const view = weatherView(report(rows).facts.weather)
    if (view.state !== 'full') throw new Error('expected the full state')
    // Clear (800) and Few clouds (801) tie at 6. CONDITION_DISPLAY_ORDER shows
    // Clear (index 5) before Few clouds (index 6).
    expect(view.sky.rows.map(r => r.index)).toEqual(CONDITION_DISPLAY_ORDER)
    expect(view.sky.rows[view.sky.typical!].index).toBe(5)
    expect(view.sky.denominator).toBe(12)
    expect(view.temperature.rows[view.temperature.typical!].checklists).toBe(12)
  })

  it('a figure whose own denominator is under the floor names no typical band', () => {
    const rows = withBlocks(12)
    const w = report(rows).facts.weather
    const thinWind = { ...w, byWindBand: w.byWindBand.map((r, i) => ({ ...r, checklists: i === 0 ? 4 : 0 })) }
    const view = weatherView(thinWind)
    if (view.state !== 'full') throw new Error('expected the full state')
    expect([view.wind.denominator, view.wind.typical]).toEqual([4, null])
  })
})
