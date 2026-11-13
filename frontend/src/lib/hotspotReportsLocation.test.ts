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
  applySpeciesRule, deriveLocationFacts, glanceView, mostRecordedView, weatherView,
  DISTANCE_MAX_KM, DURATION_MAX_MIN, PROTOCOL_NAME_MAX_CHARS, PROTOCOL_ROWS_MAX, REPORT_YEAR_ROWS_MAX, TOP_SPECIES_MAX,
  type LocationLifeRow,
} from './hotspotReportsLocation'
import { computeChecklists, computeDurationBins, computeEffort } from './birdingStats'
import { dayKey } from './lifeLists'
import { isNonCountableForm, normalizeSpeciesName } from './speciesUtils'
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

// ── The opening figures (hotspot-report-order-and-stats D-02 to D-06) ────────
//
// Every species figure here is held to what the LIFE LIST implies, computed in
// the test from the raw rows rather than from the module's own arrays: the
// per-checklist count is the life-list species carried on that checklist on a
// row with a countable form and a valid date (FR-36), never the roll-up's
// `speciesCount`, and a species' checklist figure is the distinct checklists
// carrying it on a countable-form row (FR-37). The date figures are held to an
// oracle outside the module too (Date.UTC day numbers, used only here).

function rng(seed: number): () => number {
  let s = seed
  return () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff }
}

const NAMES = ['Song Sparrow', 'Blue Jay', 'Mute Swan', 'gull sp.', "Red-tailed Hawk (Harlan's)", 'Red-tailed Hawk',
  'Mallard x American Black Duck (hybrid)', 'Wood Duck', 'American Robin', 'Northern Cardinal', 'Cedar Waxwing', 'Tree Swallow']
const DURATIONS = [null, -5, 0, 0, 1, 30, 60, 125, DURATION_MAX_MIN, DURATION_MAX_MIN + 1]
const DATES = ['2024-05-01', '2024-05-02', '', 'n/a', '2023-12-31', '2024-02-31', '2019-07-04', '2024-05-01']

/** A generated location L1 (and a decoy L2 that must never be counted). */
function generated(seed: number): ObservationEntry[] {
  const r = rng(seed)
  const out: ObservationEntry[] = []
  const C = 1 + Math.floor(r() * 30)
  for (let c = 0; c < C; c++) {
    const species = Array.from({ length: 1 + Math.floor(r() * 6) }, () => NAMES[Math.floor(r() * NAMES.length)])
    out.push(...checklist({
      submissionId: `S${seed}${String(c).padStart(3, '0')}`,
      date: DATES[Math.floor(r() * DATES.length)],
      duration: DURATIONS[Math.floor(r() * DURATIONS.length)],
      species,
    }))
  }
  out.push(...checklist({ submissionId: 'S9999', locationId: 'L2', duration: 30, species: ['Song Sparrow', 'Blue Jay'] }))
  return out
}

/** Per Submission ID at L1: the life-list species it carries under FR-36. */
function impliedCounts(rows: readonly ObservationEntry[], life: ReadonlySet<string>): Map<string, number> {
  const on = new Map<string, Set<string>>()
  for (const o of rows) {
    if (o.locationId !== 'L1' || o.submissionId === '') continue
    if (!on.has(o.submissionId)) on.set(o.submissionId, new Set())
    if (dayKey(o.date) === null || isNonCountableForm(o.commonName)) continue
    const n = normalizeSpeciesName(o.commonName)
    if (life.has(n)) on.get(o.submissionId)!.add(n)
  }
  return new Map([...on].map(([s, set]) => [s, set.size]))
}

/** Species per hour as the life list implies it: every checklist at L1 whose
 *  duration is above zero and at most the bound, zero-species ones included. */
function impliedPerHour(rows: readonly ObservationEntry[], life: ReadonlySet<string>): { mean: number; counted: number } | null {
  const counts = impliedCounts(rows, life)
  const duration = new Map<string, number | null>()
  for (const o of rows) if (o.locationId === 'L1' && !duration.has(o.submissionId)) duration.set(o.submissionId, o.duration ?? null)
  let sum = 0
  let n = 0
  for (const [sub, d] of duration) {
    if (typeof d !== 'number' || d <= 0 || d > 1440) continue
    sum += (counts.get(sub) ?? 0) / (d / 60)
    n += 1
  }
  return n === 0 ? null : { mean: sum / n, counted: n }
}

/** Per life-list name at L1: distinct checklists carrying it on a countable-form row. */
function impliedFigures(rows: readonly ObservationEntry[], life: ReadonlySet<string>): Map<string, number> {
  const subs = new Map<string, Set<string>>()
  for (const o of rows) {
    if (o.locationId !== 'L1' || o.submissionId === '' || isNonCountableForm(o.commonName)) continue
    const n = normalizeSpeciesName(o.commonName)
    if (!life.has(n)) continue
    if (!subs.has(n)) subs.set(n, new Set())
    subs.get(n)!.add(o.submissionId)
  }
  return new Map([...subs].map(([n, s]) => [n, s.size]))
}

describe('species per hour follows the one species rule (D-03)', () => {
  it('equals what the life list implies over a generated corpus, escapees and all', () => {
    let drawn = 0
    for (let seed = 1; seed <= 120; seed++) {
      const rows = generated(seed)
      const esc: ReadonlySet<string> = seed % 3 === 0 ? new Set(['Mute Swan']) : NONE
      const { species } = report(rows, 'L1', esc)
      const life = new Set(species.rows.map(r => r.name))
      const oracle = impliedPerHour(rows, life)
      if (oracle === null) { expect(species.perHour).toBeNull(); continue }
      drawn += 1
      expect(species.perHour!.counted).toBe(oracle.counted)
      expect(species.perHour!.mean).toBeCloseTo(oracle.mean, 9)
    }
    // Non-vacuity: most seeds draw the figure.
    expect(drawn).toBeGreaterThan(60)
  })

  it('a timed checklist with no species under the rule is in the mean at zero; Statistics leaves it out', () => {
    // The decided case (D-03): S2 is a real hour that recorded only a spuh.
    const rows = [
      ...checklist({ submissionId: 'S1', duration: 60, species: ['Song Sparrow', 'Blue Jay'] }),
      ...checklist({ submissionId: 'S2', duration: 60, species: ['gull sp.'] }),
    ]
    const { species } = report(rows)
    expect(species.perHour).toEqual({ mean: 1, counted: 2 })
    // Statistics' Key metrics figure (Count all forms off) rests on S1 alone.
    const stats = computeEffort(computeChecklists(rows.filter(o => !isNonCountableForm(o.commonName))))
    expect(stats.sppPerHour).toBe(2)
  })

  it('an escapee lowers the rate; a duration of 0, blank, negative or over the bound rests nothing', () => {
    const rows = [
      ...checklist({ submissionId: 'S1', duration: 30, species: ['Mute Swan', 'Song Sparrow'] }),
      ...checklist({ submissionId: 'S2', duration: 0, species: ['Song Sparrow'] }),
      ...checklist({ submissionId: 'S3', duration: null, species: ['Song Sparrow'] }),
      ...checklist({ submissionId: 'S4', duration: -10, species: ['Song Sparrow'] }),
      ...checklist({ submissionId: 'S5', duration: DURATION_MAX_MIN + 1, species: ['Song Sparrow'] }),
      ...checklist({ submissionId: 'S6', duration: DURATION_MAX_MIN, species: ['Song Sparrow'] }),
    ]
    expect(report(rows).species.perHour).toEqual({ mean: (4 + 1 / 24) / 2, counted: 2 })
    expect(report(rows, 'L1', new Set(['Mute Swan'])).species.perHour).toEqual({ mean: (2 + 1 / 24) / 2, counted: 2 })
    // Time birded counts the 0 the rate leaves out, which is what the note's
    // "above zero" is for.
    expect(report(rows).facts.timeBirded.counted).toBe(3)
  })
})

describe('recorded once and the most-recorded species read the life list\'s own figure (D-05)', () => {
  const byTop = (a: LocationLifeRow, b: LocationLifeRow) => b.checklists - a.checklists || a.name.localeCompare(b.name)

  it('recorded once equals the life-list rows whose figure is 1, and the raw oracle, over a generated corpus', () => {
    for (let seed = 1; seed <= 120; seed++) {
      const rows = generated(seed)
      const { species } = report(rows, 'L1', seed % 2 ? new Set(['Song Sparrow']) : NONE)
      const figures = impliedFigures(rows, new Set(species.rows.map(r => r.name)))
      expect(species.rows.map(r => [r.name, r.checklists])).toEqual(species.rows.map(r => [r.name, figures.get(r.name)]))
      expect(species.recordedOnce).toBe([...figures.values()].filter(n => n === 1).length)
    }
  })

  it('the top ten equal a stable sort of the life list cut at ten, row for row, over a corpus full of ties', () => {
    let cut = 0
    for (let seed = 1; seed <= 80; seed++) {
      const r = rng(seed * 7)
      const rows: ObservationEntry[] = []
      const S = 1 + Math.floor(r() * 30)
      for (let c = 0; c < 6; c++) {
        const names = Array.from({ length: S }, (_, k) => `Species ${String.fromCharCode(65 + (k % 26))}${Math.floor(k / 26)}`).filter(() => r() < 0.5)
        if (names.length > 0) rows.push(...checklist({ submissionId: `S${c}`, date: `2024-0${1 + c}-01`, species: names }))
      }
      if (rows.length === 0) continue
      const { species } = report(rows)
      const oracle = [...species.rows].sort(byTop).slice(0, TOP_SPECIES_MAX)
      expect(species.top).toEqual(oracle)
      for (let i = 0; i < species.top.length; i++) expect(species.top[i]).toBe(oracle[i])
      if (species.rows.length > TOP_SPECIES_MAX) cut += 1
    }
    expect(cut).toBeGreaterThan(20)
    expect(TOP_SPECIES_MAX).toBe(10)
  })

  it('two names that compare equal keep the life list\'s own order, as a stable sort would', () => {
    // A composed and a decomposed spelling of one name are two life-list rows
    // that localeCompare calls equal: the only input on which "after an equal
    // row" and "before it" differ. Written as escapes (testing.md).
    const composed = 'Caf\u00e9 Warbler'
    const decomposed = 'Cafe\u0301 Warbler'
    expect(composed).not.toBe(decomposed)
    expect(composed.localeCompare(decomposed)).toBe(0)
    const rows = checklist({ submissionId: 'S1', date: '2024-01-01', species: [composed, decomposed, 'Wood Duck'] })
    const { species } = report(rows)
    expect(species.rows.map(r => r.name)).toContain(decomposed)
    expect(species.top).toEqual([...species.rows].sort(byTop))
    expect(species.top.map(r => r.name)).toEqual([...species.rows].sort(byTop).map(r => r.name))
  })

  it('a tie at the tenth place is cut by name, and an escapee never appears', () => {
    // Twelve species on one checklist each beside one on two: the tie among the
    // twelve is cut by name order after the leader.
    const twelve = Array.from({ length: 12 }, (_, k) => `Bird ${String.fromCharCode(76 - k)}`)
    const rows = [
      ...checklist({ submissionId: 'S1', date: '2024-01-01', species: [...twelve.slice(0, 6), 'Mute Swan', 'Wood Duck'] }),
      ...checklist({ submissionId: 'S2', date: '2024-01-02', species: [...twelve.slice(6), 'Mute Swan', 'Wood Duck'] }),
    ]
    const { species } = report(rows, 'L1', new Set(['Mute Swan']))
    expect(species.top.map(r => r.name)).toEqual(['Wood Duck', ...[...twelve].sort((a, b) => a.localeCompare(b)).slice(0, 9)])
    expect(species.top.map(r => r.checklists)).toEqual([2, 1, 1, 1, 1, 1, 1, 1, 1, 1])
  })
})

describe('the date figures: days, years and the longest gap (D-04)', () => {
  const at = (dates: string[]) => report(dates.map((d, i) => row({ submissionId: `S${i}`, date: d })))

  it('days birded counts distinct dates of dated checklists; years state their count and span', () => {
    const { facts } = at(['2020-01-05', '2020-01-05', '2021-03-01', 'bad', '', '2019-12-31'])
    expect(facts.daysBirded).toBe(3)
    expect(facts.yearSpan).toEqual({ count: 3, first: 2019, last: 2021 })
    expect(at(['x']).facts.yearSpan).toBeNull()
    expect(at(['2024-05-01']).facts.yearSpan).toEqual({ count: 1, first: 2024, last: 2024 })
  })

  it('counts calendar days by integer arithmetic across leap days, century years and a DST change', () => {
    expect(at(['2024-02-28', '2024-03-01']).facts.longestGap).toEqual({ days: 2, from: 20240228, to: 20240301 })
    expect(at(['2023-02-28', '2023-03-01']).facts.longestGap!.days).toBe(1)
    expect(at(['1900-02-28', '1900-03-01']).facts.longestGap!.days).toBe(1)
    expect(at(['2000-02-28', '2000-03-01']).facts.longestGap!.days).toBe(2)
    // US daylight saving began 2024-03-10: two days, never 1.96 or 2.04.
    expect(at(['2024-03-09', '2024-03-11']).facts.longestGap!.days).toBe(2)
    expect(at(['2016-06-11', '2016-08-27']).facts.longestGap!.days).toBe(77)
    expect(at(['2019-12-20', '2020-02-03']).facts.longestGap!.days).toBe(45)
  })

  it('the earliest pair wins a tie; one date, or none, has no gap', () => {
    expect(at(['2024-01-21', '2024-01-01', '2024-01-11']).facts.longestGap).toEqual({ days: 10, from: 20240101, to: 20240111 })
    expect(at(['2024-01-01']).facts.longestGap).toBeNull()
    expect(at(['2024-01-01', '2024-01-01']).facts.longestGap).toBeNull()
    expect(at(['', 'bad']).facts.longestGap).toBeNull()
  })

  it('a day past its month never yields a negative gap, and a year 0000 date is left out of the gap only', () => {
    // 2024-02-31 is a key dayKey admits and civil arithmetic reads as Mar 2.
    const odd = at(['2024-02-25', '2024-02-31', '2024-03-02', '2024-03-10']).facts
    expect(odd.daysBirded).toBe(4)
    expect(odd.longestGap).toEqual({ days: 8, from: 20240302, to: 20240310 })
    const zero = at(['0000-06-01', '2020-01-01', '2020-01-05']).facts
    expect(zero.daysBirded).toBe(3)
    expect(zero.longestGap).toEqual({ days: 4, from: 20200101, to: 20200105 })
  })

  it('agrees with a Date.UTC oracle over generated real calendar dates from 1900 to 2100', () => {
    const r = rng(41)
    for (let t = 0; t < 200; t++) {
      const n = 2 + Math.floor(r() * 12)
      const dates = Array.from({ length: n }, () => {
        const ms = Date.UTC(1900, 0, 1) + Math.floor(r() * 73_000) * 86_400_000
        return new Date(ms).toISOString().slice(0, 10)
      })
      const days = [...new Set(dates)].map(d => Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10)) / 86_400_000).sort((a, b) => a - b)
      let best = 0
      for (let i = 1; i < days.length; i++) best = Math.max(best, days[i] - days[i - 1])
      const gap = at(dates).facts.longestGap
      expect(gap === null ? 0 : gap.days).toBe(best)
    }
  })
})

describe('distance traveled under its stated bound (D-02)', () => {
  const at = (distances: (number | null)[]) => report(distances.map((d, i) => row({ submissionId: `S${i}`, distance: d })))

  it('sums usable kilometers: 0 counts, the bound is inclusive, and blank, negative, non-finite and over-bound cells are left out', () => {
    const { facts } = at([1, 2.5, 0, -1, null, DISTANCE_MAX_KM, DISTANCE_MAX_KM + 0.001, Infinity, Number.NaN, -Infinity])
    expect(facts.distance).toEqual({ km: 2403.5, counted: 4 })
  })

  it('the bound is the decision\'s 2,400 kilometers, pinned by behaviour at the edge', () => {
    expect(at([2400]).facts.distance.counted).toBe(1)
    expect(at([2400.0001]).facts.distance.counted).toBe(0)
    // D-02 derives it from FR-53's bound: 24 hours at 100 km/h.
    expect(DISTANCE_MAX_KM).toBe((DURATION_MAX_MIN / 60) * 100)
  })
})

describe('what a place shows at a glance: the many / one / none rule (design-refinement "Thin places")', () => {
  const view = (rows: ObservationEntry[], esc: ReadonlySet<string> = NONE) => {
    const { facts, species } = report(rows, 'L1', esc)
    return glanceView(facts, species)
  }

  it('a full place draws every tile and both species rows', () => {
    const v = view([
      ...checklist({ submissionId: 'S1', date: '2020-01-01', duration: 60, species: ['Song Sparrow', 'Blue Jay'] }),
      ...checklist({ submissionId: 'S2', date: '2021-06-01', duration: 30, species: ['Song Sparrow'] }),
      ...checklist({ submissionId: 'S3', date: '2022-06-01', duration: 90, species: ['Song Sparrow', 'Wood Duck'] }),
    ])
    expect(v.days).toEqual({ days: 3, dated: 3 })
    expect(v.years).toEqual({ count: 3, first: 2020, last: 2022 })
    expect(v.perHour).toMatchObject({ counted: 3, aboveZero: false })
    expect(v.recordedOnce).toEqual({ once: 2, species: 3 })
    expect(v.gap).toEqual({ days: 517, from: 20200101, to: 20210601 })
    expect(v.distance).toEqual({ km: 3, counted: 3 })
    // The oldest row is the list's position 1: of the two first seen on
    // 2020-01-01, the life list's own order puts Song Sparrow last.
    expect(v.species).toMatchObject({ kind: 'pair', first: { name: 'Song Sparrow', position: 1 }, newest: { name: 'Wood Duck', position: 3 } })
  })

  it('one dated checklist: no days, years or gap tile', () => {
    const v = view([
      ...checklist({ submissionId: 'S1', date: '2020-01-01', species: ['Song Sparrow', 'Blue Jay'] }),
      ...checklist({ submissionId: 'S2', date: 'bad', species: ['Song Sparrow'] }),
    ])
    expect([v.days, v.years, v.gap]).toEqual([null, null, null])
  })

  it('a duration of 0 beside a timed one says "above zero"; no duration above zero draws no rate', () => {
    expect(view([
      ...checklist({ submissionId: 'S1', duration: 0, species: ['Song Sparrow'] }),
      ...checklist({ submissionId: 'S2', duration: 60, species: ['Song Sparrow'] }),
    ]).perHour).toEqual({ mean: 1, counted: 1, aboveZero: true })
    expect(view([
      ...checklist({ submissionId: 'S1', duration: 0, species: ['Song Sparrow'] }),
      ...checklist({ submissionId: 'S2', duration: null, species: ['Song Sparrow'] }),
    ]).perHour).toBeNull()
  })

  it('one species: a single "only" row and no recorded-once tile; two species first seen together: neither row', () => {
    const one = view([
      ...checklist({ submissionId: 'S1', date: '2020-01-01', species: ['Song Sparrow'] }),
      ...checklist({ submissionId: 'S2', date: '2020-02-01', species: ['Song Sparrow'] }),
    ])
    expect(one.species).toMatchObject({ kind: 'only', row: { name: 'Song Sparrow' } })
    expect(one.recordedOnce).toBeNull()
    const together = view([
      ...checklist({ submissionId: 'S1', date: '2020-01-01', species: ['Song Sparrow', 'Blue Jay'] }),
      ...checklist({ submissionId: 'S2', date: '2020-02-01', species: ['Song Sparrow'] }),
    ])
    expect(together.species).toBeNull()
    expect(together.recordedOnce).toEqual({ once: 1, species: 2 })
  })

  it('no countable species: no rate, no recorded once, no species rows; fewer than three dates: no gap; no usable distance: no row', () => {
    const v = view([
      ...checklist({ submissionId: 'S1', date: '2020-01-01', duration: 60, distance: null, species: ['gull sp.'] }),
      ...checklist({ submissionId: 'S2', date: '2020-03-01', duration: 60, distance: -1, species: ['duck sp.'] }),
    ])
    expect([v.perHour, v.recordedOnce, v.species, v.gap, v.distance]).toEqual([null, null, null, null, null])
    expect(v.days).toEqual({ days: 2, dated: 2 })
  })

  it('a place where no tile applies draws none', () => {
    const v = view(checklist({ submissionId: 'S1', date: 'bad', duration: null, species: ['Song Sparrow'] }))
    expect([v.days, v.years, v.perHour, v.recordedOnce, v.gap]).toEqual([null, null, null, null, null])
  })
})

describe('the most-recorded section in all three shapes: many, one, none', () => {
  const view = (rows: ObservationEntry[]) => {
    const { facts, species } = report(rows)
    return mostRecordedView(facts, species)
  }

  it('many: the life list\'s top rows; one species: the one row; one checklist or no countable species: nothing', () => {
    const many = view([
      ...checklist({ submissionId: 'S1', species: ['Song Sparrow', 'Blue Jay'] }),
      ...checklist({ submissionId: 'S2', species: ['Song Sparrow'] }),
    ])
    expect(many).toMatchObject({ kind: 'list', rows: [{ name: 'Song Sparrow', checklists: 2 }, { name: 'Blue Jay', checklists: 1 }] })
    expect(view([
      ...checklist({ submissionId: 'S1', species: ['Song Sparrow'] }),
      ...checklist({ submissionId: 'S2', species: ['Song Sparrow', 'gull sp.'] }),
    ])).toMatchObject({ kind: 'one', row: { name: 'Song Sparrow', checklists: 2 } })
    expect(view(checklist({ submissionId: 'S1', species: ['Song Sparrow', 'Blue Jay'] }))).toBeNull()
    expect(view([
      ...checklist({ submissionId: 'S1', species: ['gull sp.'] }),
      ...checklist({ submissionId: 'S2', species: ['duck sp.'] }),
    ])).toBeNull()
  })
})
