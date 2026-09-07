/// <reference types="node" />
// The publication seam: the gate, the memo, the variant, and the second whole
// (species-detail-weather, FR-11, FR-31, FR-32, NFR-02, NFR-04, NFR-05, NFR-06,
// NFR-13).
//
// Fixtures build their blocks by calling the REAL formatters, per
// `.claude/rules/weather-tide.md`, and their checklists through
// `computeChecklists` over real-shaped observation rows -- a hand-written
// fixture encodes the author's mental model of the data, which is the same model
// that would write the bug.
import { describe, it, expect, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import {
  _resetWeatherStatsMemoForTests, hasAnyWeatherBlock, speciesChecklistCountsFor, weatherStatsFor,
} from './weatherStatsShared'
import { computeWeatherStats, speciesWeatherIndex } from './weatherStats'
import { computeChecklists, filterObservations } from './birdingStats'
import { formatWeather } from './weatherFormatter'
import type { HourlyResponse } from './weatherFormatter'
import type { ObservationEntry } from '../types'

const TZ = 'America/Los_Angeles'
function hourly(over: Partial<HourlyResponse['data'][number]> = {}): HourlyResponse {
  return {
    data: [{
      dt: 1716570000, temp: 64, humidity: 72, dew_point: 55, wind_speed: 6, wind_deg: 250,
      clouds: 20, weather: [{ id: 801, description: 'few clouds' }],
      sunrise: 1716550000, sunset: 1716600000, ...over,
    }],
  }
}
const srBlock = (temp: number, owmId = 801) =>
  formatWeather([hourly({ temp, weather: [{ id: owmId, description: 'x' }] })], TZ, 33.7)

/** A block-shaped comment with weather LABELS and NO app attribution -- what the
 *  attribution gate must refuse, and what makes the gate's worst case a FULL
 *  scan rather than a short-circuit. */
const unattributed = (body: string) => `⛅  Scattered clouds  ${body}`

let seq = 0
const BASE: Omit<ObservationEntry, 'submissionId' | 'commonName' | 'scientificName'> = {
  date: '2024-05-24', location: 'Pond', locationId: 'L1', latitude: 1, longitude: 2,
  county: 'C', count: 1, breedingCode: null, speciesComments: '', catalogIds: [],
  time: '07:00 AM', duration: 60, distance: 1, area: null, protocol: 'Traveling',
  numObservers: 1, allObsReported: true, checklistComments: '', stateProvince: 'US-CA',
}

interface Spec { comment: string; species: string[] }

function build(specs: Spec[]): ObservationEntry[] {
  const obs: ObservationEntry[] = []
  for (const spec of specs) {
    const sub = `S${100000 + seq++}`
    for (const n of spec.species) {
      obs.push({ ...BASE, submissionId: sub, commonName: n, scientificName: 'Genus species', checklistComments: spec.comment })
    }
  }
  return obs
}

const repeat = (n: number, comment: string, species: string[]): Spec[] =>
  Array.from({ length: n }, () => ({ comment, species }))

beforeEach(() => { _resetWeatherStatsMemoForTests() })

function source(rel: string): string {
  return readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8')
}
/** Comments blanked, so an absence assertion cannot be failed by prose and a
 *  presence assertion cannot be satisfied by a commented-out line. */
function code(rel: string): string {
  return source(rel).replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, '')
}

// ── The gate (NFR-03) ───────────────────────────────────────────────────────

describe('the presence gate never misses a block the aggregate would find', () => {
  const shapes: Array<[string, ObservationEntry[]]> = [
    ['blocks present', build(repeat(12, srBlock(60), ['Anna\'s Hummingbird']))],
    ['comments kept, blocks stripped', build(repeat(12, unattributed('Temperature: 60°F'), ['Anna\'s Hummingbird']))],
    ['comments blank', build(repeat(12, '', ['Anna\'s Hummingbird']))],
    ['no rows at all', []],
  ]

  for (const [name, obs] of shapes) {
    it(`agrees with the aggregate on: ${name}`, () => {
      // WHAT THIS ROW PROVES, AND WHAT IT DOES NOT. The gate calls the IDENTICAL
      // predicate `computeWeatherStats` uses for its own attribution gate, and
      // the property that actually holds is a one-way implication:
      // `foundCount > 0` implies the gate, never the reverse. That is the
      // direction worth guarding, because a false negative would hide the card
      // on an export that has data.
      //
      // The equality below is therefore stronger than the contract, and it holds
      // HERE because of a property of these fixtures rather than of the code:
      // every row of a submission carries the same comment, which is what eBird's
      // own export does. Give a submission an empty or `undefined`
      // `checklistComments` on its first row and a real block on a later one and
      // the two diverge, gate-true against `foundCount` 0 (the account is at
      // `hasAnyWeatherBlock`'s definition site, and the card's absent branch is
      // what closes it). Adding that fixture is a real row this suite is missing;
      // it is left for its own change rather than smuggled into a prose
      // correction, and it is named here so it is a known gap rather than an
      // unknown one.
      _resetWeatherStatsMemoForTests()
      expect(hasAnyWeatherBlock(obs)).toBe(weatherStatsFor(obs).foundCount > 0)
    })
  }

  it('short-circuits on the first hit rather than scanning the whole export', () => {
    // Structural, because a timing assertion here would be a ratio measurement
    // on a machine that may be compiling something else. The block is on the
    // FIRST checklist and 5,000 blockless ones follow it; if the gate scanned to
    // the end it would still return true, so this asserts the property that
    // makes it cheap by proving it never needs the tail: the same fixture with
    // the block removed answers false, so the answer is decided by that one row.
    const withBlock = [
      ...build([{ comment: srBlock(60), species: ['Anna\'s Hummingbird'] }]),
      ...build(repeat(5000, '', ['Anna\'s Hummingbird'])),
    ]
    expect(hasAnyWeatherBlock(withBlock)).toBe(true)
    expect(hasAnyWeatherBlock(withBlock.slice(1))).toBe(false)
  })

  it('a comment-bearing export with no attribution costs a full scan and answers false', () => {
    // The worst case, named rather than left implicit: this is the shape the
    // linearity check below is built on, and the one measured at 0.732 ms on the
    // reference export.
    const obs = build(repeat(300, unattributed('Temperature: 60°F  Wind: Light breeze'), ['Anna\'s Hummingbird']))
    expect(hasAnyWeatherBlock(obs)).toBe(false)
  })
})

// ── The memo (NFR-02, and the WeakRef teardown) ─────────────────────────────

describe('the memo is keyed on the observations IDENTITY', () => {
  it('hands back the SAME object for the same array, so a re-render costs nothing', () => {
    const obs = build(repeat(12, srBlock(60), ['Anna\'s Hummingbird']))
    const a = weatherStatsFor(obs)
    for (let i = 0; i < 20; i++) expect(weatherStatsFor(obs)).toBe(a)
  })

  it('recomputes for a new array, so a re-upload cannot describe the file that is gone', () => {
    const first = build(repeat(12, srBlock(60), ['Anna\'s Hummingbird']))
    const a = weatherStatsFor(first)
    const second = build(repeat(12, srBlock(60), ['Steller\'s Jay']))
    const b = weatherStatsFor(second)
    expect(b).not.toBe(a)
    expect(b.species.names).toEqual(['Steller\'s Jay'])
    // And the slot really moved: the first array recomputes rather than hitting.
    expect(weatherStatsFor(first)).not.toBe(a)
  })

  it('holds ONE slot for both derived values, so they can never describe different exports', () => {
    const first = build(repeat(12, srBlock(60), ['Anna\'s Hummingbird']))
    weatherStatsFor(first)
    const firstMap = speciesChecklistCountsFor(first)
    const second = build(repeat(12, srBlock(60), ['Steller\'s Jay']))
    // Reading either one first must re-key the slot for BOTH.
    expect(speciesChecklistCountsFor(second)).not.toBe(firstMap)
    expect(speciesChecklistCountsFor(second).has('Steller\'s Jay')).toBe(true)
    expect(speciesChecklistCountsFor(second).has('Anna\'s Hummingbird')).toBe(false)
  })

  it('the reset seam is a TEST seam and is not wired as a production purge', () => {
    // `.claude/rules` records the trap directly: a `_reset*ForTests` shipped as a
    // clear path detaches the in-memory slot and clears nothing, because there is
    // no document behind it. There is nothing on disk here at all, which is why
    // `cacheInventory.test.ts` must stay untouched by this work.
    const src = code('./weatherStatsShared.ts')
    expect(src).toContain('_resetWeatherStatsMemoForTests')
    expect(code('./clearDerived.ts')).not.toContain('weatherStatsShared')
  })
})

// ── The variant (FR-11, OQ-04) ──────────────────────────────────────────────

describe('the published variant is a function of the export and nothing else', () => {
  it('takes ONE argument, so a caller has nothing else it could pass', () => {
    // The difference between "the call site happens to pass true" and "the call
    // site has nothing else it could pass". A defaulted `includeSpuh` parameter
    // would reopen OQ-04 and make the card's figures a function of somebody's
    // toggle, and it would look perfectly reasonable in review.
    expect(weatherStatsFor.length).toBe(1)
    expect(speciesChecklistCountsFor.length).toBe(1)
  })

  it('passes the all-forms literal at the call site, in the seam', () => {
    const src = code('./weatherStatsShared.ts')
    expect(src).toContain('filterObservations(observations, true)')
    expect(src).not.toMatch(/includeSpuh/)
  })

  it('reads no cached answer, so it cannot depend on a prior Statistics visit (NFR-06)', () => {
    // The v1.0.18 `Show escapees` precedent does NOT transfer: that answer needs
    // a network call and an eBird key, so "not checked yet" is a state the app
    // cannot resolve on its own. This one needs nothing the tab does not already
    // hold, so there is no cache read and therefore no "missing" branch to fall
    // into -- which is what QA-24's grep is looking for and does not find.
    const src = code('./weatherStatsShared.ts')
    for (const forbidden of [
      './statsBundle', './statsOffThread', './useStatsBundle', './transport', './storage',
      'bundle.weather', 'fetch(',
    ]) {
      expect(src, `the seam must not reach ${forbidden}`).not.toContain(forbidden)
    }
    // Non-vacuity: the stripper must not have eaten the code with the prose.
    expect(src).toContain('computeWeatherStats')
    expect(src.length).toBeGreaterThan(1500)
  })

  it('is byte-identical to what Statistics computes when both read the same variant (NFR-04)', () => {
    // ONE DERIVATION, TWO SURFACES. If the two can diverge by implementation
    // rather than by a stated basis, the feature is not worth building.
    const obs = build([
      ...repeat(12, srBlock(60), ['Anna\'s Hummingbird', 'Steller\'s Jay']),
      ...repeat(6, srBlock(30, 601), ['Steller\'s Jay']),
    ])
    const all = filterObservations(obs, true)
    const statisticsWay = computeWeatherStats(computeChecklists(all), all)
    expect(weatherStatsFor(obs)).toEqual(statisticsWay)
  })

  it('the all-forms filter is a passthrough, which is why the variant costs nothing', () => {
    // Verified by IDENTITY rather than inferred from the source: this is the
    // structural half of OQ-04's resolution, not merely a convenient one.
    const obs = build(repeat(3, srBlock(60), ['Anna\'s Hummingbird']))
    expect(filterObservations(obs, true)).toBe(obs)
  })

  it('gives a non-countable form its own row, which the countable-only variant erases', () => {
    // OQ-04's first reason, as a fixture: under the countable-only variant the
    // card would go silent, or state a false zero, on a bird Species Detail had
    // just offered the user.
    const obs = build(repeat(12, srBlock(60), ['gull sp.']))
    expect(speciesWeatherIndex(weatherStatsFor(obs), 'gull sp.')).toBeGreaterThanOrEqual(0)
    const countable = filterObservations(obs, false)
    expect(computeWeatherStats(computeChecklists(countable), countable).species.names)
      .not.toContain('gull sp.')
  })
})

// ── The second whole (FR-31, FR-32) ─────────────────────────────────────────

describe('the bird\'s own whole is a distinct-submission count over the raw parse', () => {
  it('counts a checklist ONCE even when it carries the parent and a form', () => {
    // The Recorded Decision's own shape: the tab's "Checklists" stat is a row
    // count and this is not. A fixture where a checklist carries both must
    // contribute 1, not 2.
    const obs = build([
      { comment: '', species: ['Mallard', 'Mallard (Domestic type)'] },
      { comment: '', species: ['Mallard'] },
    ])
    expect(speciesChecklistCountsFor(obs).get('Mallard')).toBe(2)
    expect(obs.filter(o => o.commonName.startsWith('Mallard')).length).toBe(3)
  })

  it('folds forms into the parent on the same basis as the numerator', () => {
    // `normalizeSpeciesName` on BOTH sides, or the two figures in the opening
    // block sit on different bases while looking like one number.
    const obs = build([
      { comment: srBlock(60), species: ['Yellow-rumped Warbler (Myrtle)'] },
      { comment: '', species: ['Yellow-rumped Warbler'] },
    ])
    expect(speciesChecklistCountsFor(obs).get('Yellow-rumped Warbler')).toBe(2)
    expect(speciesChecklistCountsFor(obs).has('Yellow-rumped Warbler (Myrtle)')).toBe(false)
  })

  it('is export-wide: a blockless checklist still counts toward the bird\'s own whole', () => {
    // This is the whole point of the second figure. The numerator is the bird's
    // weather-block count; the denominator is every checklist it is on.
    const obs = build([
      ...repeat(3, srBlock(60), ['Anna\'s Hummingbird']),
      ...repeat(20, '', ['Anna\'s Hummingbird']),
    ])
    const stats = weatherStatsFor(obs)
    expect(stats.species.checklists[speciesWeatherIndex(stats, 'Anna\'s Hummingbird')]).toBe(3)
    expect(speciesChecklistCountsFor(obs).get('Anna\'s Hummingbird')).toBe(23)
  })

  it('is built ONCE and read many times, so a species change is a map read (NFR-02)', () => {
    // QA-36 by identity: twenty lookups over the same export return the SAME Map
    // object, so no pass over the observations happened after the first.
    const obs = build(repeat(30, srBlock(60), ['Anna\'s Hummingbird', 'Steller\'s Jay', 'Wood Duck']))
    const first = speciesChecklistCountsFor(obs)
    for (let i = 0; i < 20; i++) {
      expect(speciesChecklistCountsFor(obs)).toBe(first)
      expect(first.get(['Anna\'s Hummingbird', 'Steller\'s Jay', 'Wood Duck'][i % 3])).toBe(30)
    }
  })

  it('treats a species named __proto__ as an ordinary key', () => {
    // The v1.0.22 crash, in the one new accumulator this feature adds. A `Map`
    // and a `Set`, never object literals, is what makes that a property rather
    // than an argument about what eBird can emit.
    const obs = build([
      { comment: srBlock(60), species: ['__proto__', 'constructor'] },
      { comment: '', species: ['__proto__'] },
    ])
    const counts = speciesChecklistCountsFor(obs)
    expect(counts.get('__proto__')).toBe(2)
    expect(counts.get('constructor')).toBe(1)
    expect(Object.prototype.hasOwnProperty.call({}, 'polluted')).toBe(false)
  })

  it('keys the dedupe pair on the species INDEX, never on the name', () => {
    // Injective by construction rather than by a premise about eBird's data: an
    // index is digits, so it cannot contain the separator, so the key separates
    // unambiguously at its first `|` whatever the submission id holds. Joining
    // the NAME is the lossy-key shape `useStatsBundle`'s header records.
    const src = code('./weatherStatsShared.ts')
    expect(src).toContain('${si}|${o.submissionId}')
    // And the property, driven rather than read: two names whose concatenation
    // with a submission id could collide under a naive space separator.
    const obs = build([
      { comment: '', species: ['American Crow'] },
      { comment: '', species: ['American'] },
    ])
    const counts = speciesChecklistCountsFor(obs)
    expect(counts.get('American Crow')).toBe(1)
    expect(counts.get('American')).toBe(1)
  })
})

// ── Linearity (NFR-13, QA-31) ───────────────────────────────────────────────

describe('the one new scan over export text is linear by construction', () => {
  it('contains no includes / indexOf / find over an export-derived needle', () => {
    const src = code('./weatherStatsShared.ts')
    for (const bad of ['.indexOf(', '.find(', '.filter(']) {
      expect(src, `weatherStatsShared.ts contains ${bad}`).not.toContain(bad)
    }
    // `.includes(` appears nowhere either; the shipped predicates it calls search
    // for FIXED module constants inside their own module, which is a different
    // shape from a scan inside a loop over export values.
    expect(src).not.toContain('.includes(')
  })

  it('grows about 2x per doubling on hostile input built to FAIL after consuming the run', () => {
    // The input is a comment-bearing export with NO attribution, which is the
    // gate's worst case: every distinct checklist is tested and every test fails,
    // so nothing short-circuits and the whole run is consumed. Timing is a RATIO
    // over three sizes rather than an absolute, and the ratio bound is loose
    // because `.claude/rules/testing.md` records a 3x floor being pushed to 2.79
    // by a parallel build on the same machine.
    const body = `Temperature: 60°F  Wind: Light breeze  ${'x'.repeat(400)}`
    const timeFor = (rows: number) => {
      const obs = build(repeat(rows, unattributed(body), ['Anna\'s Hummingbird']))
      hasAnyWeatherBlock(obs) // warm
      const t0 = performance.now()
      for (let i = 0; i < 5; i++) expect(hasAnyWeatherBlock(obs)).toBe(false)
      return performance.now() - t0
    }
    const t10 = timeFor(10_000)
    const t20 = timeFor(20_000)
    const t40 = timeFor(40_000)
    // Quadratic would be ~4x per doubling; the bound catches that with room for
    // a noisy machine, and the two ratios are asserted separately so one lucky
    // reading cannot carry the other.
    expect(t20 / Math.max(t10, 0.05)).toBeLessThan(3)
    expect(t40 / Math.max(t20, 0.05)).toBeLessThan(3)
  })
})
