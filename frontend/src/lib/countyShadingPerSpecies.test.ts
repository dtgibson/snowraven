// The per-species county aggregate, the cross-surface agreement, and the two
// performance contracts (county-shading-and-project-stats, FR-09, FR-10, FR-14,
// FR-15, NFR-01, NFR-02; QA-10, QA-16, QA-17, QA-66, QA-67).
//
// THE ONE PLACE THIS HALF CAN BE SILENTLY, PLAUSIBLY WRONG.
// `buildCountyAggregates(observations, checklists)` derives `records` from its
// SECOND argument. FR-09 names only `speciesObs`, so the obvious reading —
// passing the tab's or the backup's full checklist array — shades EVERY county
// the user has ever birded at its TOTAL checklist count, regardless of species.
// The map looks right and is wrong everywhere, and no test that only checks
// "some counties are shaded" would catch it. The first block below is written
// to catch exactly that substitution.

import { describe, it, expect } from 'vitest'
import {
  buildCountyAggregates, computeCountyTiers, nonZeroMetricValues,
  COUNTY_CLASS_COUNT, countyMetricValue,
} from './countyShading'
import { computeChecklists, filterObservations, computeGeo } from './birdingStats'
import type { ObservationEntry } from '../types'

let seq = 0
function obs(o: Partial<ObservationEntry> & { commonName: string; county: string; stateProvince: string }): ObservationEntry {
  seq += 1
  return {
    submissionId: o.submissionId ?? `S${1000 + seq}`,
    commonName: o.commonName,
    scientificName: o.scientificName ?? 'Genus species',
    date: o.date ?? '2026-04-01',
    location: o.location ?? 'Somewhere',
    locationId: o.locationId ?? 'L1',
    latitude: 38, longitude: -122,
    county: o.county,
    stateProvince: o.stateProvince,
    count: o.count ?? 1,
    breedingCode: null,
    speciesComments: '',
    catalogIds: [],
  }
}

// Alameda: 3 Common Raven checklists + 2 checklists with no raven at all.
// Sonoma: 1 Common Raven checklist. Marin: 4 checklists, NO raven.
const BACKUP: ObservationEntry[] = [
  obs({ submissionId: 'S1', commonName: 'Common Raven', county: 'Alameda', stateProvince: 'US-CA', locationId: 'LA1', location: 'Albany Hill' }),
  obs({ submissionId: 'S2', commonName: 'Common Raven', county: 'Alameda', stateProvince: 'US-CA', locationId: 'LA1', location: 'Albany Hill' }),
  obs({ submissionId: 'S3', commonName: 'Common Raven', county: 'Alameda', stateProvince: 'US-CA', locationId: 'LA2', location: 'Solano Hill' }),
  obs({ submissionId: 'S4', commonName: 'American Robin', county: 'Alameda', stateProvince: 'US-CA' }),
  obs({ submissionId: 'S5', commonName: 'American Robin', county: 'Alameda', stateProvince: 'US-CA' }),
  obs({ submissionId: 'S6', commonName: 'Common Raven', county: 'Sonoma', stateProvince: 'US-CA' }),
  obs({ submissionId: 'S7', commonName: 'American Robin', county: 'Marin', stateProvince: 'US-CA' }),
  obs({ submissionId: 'S8', commonName: 'American Robin', county: 'Marin', stateProvince: 'US-CA' }),
  obs({ submissionId: 'S9', commonName: 'Steller’s Jay', county: 'Marin', stateProvince: 'US-CA' }),
  obs({ submissionId: 'S10', commonName: 'Steller’s Jay', county: 'Marin', stateProvince: 'US-CA' }),
]

const ravenObs = BACKUP.filter(o => o.commonName === 'Common Raven')

describe('the per-species aggregate (FR-09, FR-10)', () => {
  it('shades ONLY the counties where the species was recorded', () => {
    const agg = buildCountyAggregates(ravenObs, computeChecklists(ravenObs))
    expect([...agg.keys()].sort()).toEqual(['CA|alameda', 'CA|sonoma'])
    // Marin has four of the user's checklists and no raven, so it must be
    // absent (unshaded, outline only) rather than shaded at 4.
    expect(agg.has('CA|marin')).toBe(false)
  })

  it('`records` is the checklists REPORTING THIS BIRD, not the county total', () => {
    const agg = buildCountyAggregates(ravenObs, computeChecklists(ravenObs))
    expect(agg.get('CA|alameda')!.records).toBe(3)
    expect(agg.get('CA|sonoma')!.records).toBe(1)
  })

  it('MUTATION GUARD: feeding the full backup checklists produces the wrong map', () => {
    // This is the defect FR-09's literal reading produces. It is asserted here,
    // as a fixed reference, so the correct call cannot be "simplified" back into
    // it without a red test — and so the difference is visible rather than
    // argued: every county the user has birded, at its TOTAL checklist count.
    const wrong = buildCountyAggregates(ravenObs, computeChecklists(BACKUP))
    expect(wrong.get('CA|alameda')!.records).toBe(5)   // 3 raven + 2 robin lists
    expect(wrong.has('CA|marin')).toBe(true)           // a county with NO ravens
    expect(wrong.get('CA|marin')!.records).toBe(4)
    const right = buildCountyAggregates(ravenObs, computeChecklists(ravenObs))
    expect(right.get('CA|alameda')!.records).toBe(3)
    expect(right.has('CA|marin')).toBe(false)
  })

  it('`topLocations` ranks by the checklists reporting this bird', () => {
    const agg = buildCountyAggregates(ravenObs, computeChecklists(ravenObs))
    const top = agg.get('CA|alameda')!.topLocations
    expect(top.map(l => [l.name, l.count])).toEqual([
      ['Albany Hill', 2], ['Solano Hill', 1],
    ])
  })

  it('`species` is 1 for every shaded county, which is why it is not rendered', () => {
    const agg = buildCountyAggregates(ravenObs, computeChecklists(ravenObs))
    for (const a of agg.values()) expect(a.species).toBe(1)
  })

  it('a species with no US county rows yields an empty ramp, not an empty map', () => {
    const nonUs = [obs({ commonName: 'Eurasian Jay', county: 'Surrey', stateProvince: 'GB-ENG' })]
    const agg = buildCountyAggregates(nonUs, computeChecklists(nonUs))
    expect(agg.size).toBe(0)
    const tiers = computeCountyTiers(nonZeroMetricValues(agg, 'records'), COUNTY_CLASS_COUNT)
    expect(tiers.legend).toEqual([])
    expect(tiers.tierFor(1)).toBe(0)
  })

  it('the filtered observation set is the ONLY input, so filters apply for free', () => {
    // The county filter, the date range, "Show subspecies" and "Show all forms"
    // all act on `speciesObs` upstream, so a narrowed slice narrows the shading
    // by construction — QA-10 without a second code path to keep in step.
    const dateFiltered = ravenObs.filter(o => o.submissionId !== 'S6')  // drop Sonoma
    const agg = buildCountyAggregates(dateFiltered, computeChecklists(dateFiltered))
    expect([...agg.keys()]).toEqual(['CA|alameda'])
  })
})

describe('the Statistics aggregate and cross-surface agreement (FR-14, FR-15)', () => {
  const statsObs = filterObservations(BACKUP, false)
  const statsChecklists = computeChecklists(statsObs)

  it('is built from the same memos that feed computeGeo, so they cannot disagree', () => {
    const agg = buildCountyAggregates(statsObs, statsChecklists)
    const geo = computeGeo(statsChecklists, statsObs)
    // computeGeo's county rows key on (state, county) exactly as the aggregates
    // do, so every geo row has a matching aggregate with the same checklist
    // count. Perturbing the input moves BOTH.
    for (const c of geo.topCounties) {
      const key = `${(c.stateProvince ?? '').split('-')[1]}|${c.name.toLowerCase()}`
      const a = agg.get(key)
      expect(a, `no aggregate for ${key}`).toBeDefined()
      expect(a!.records).toBe(c.count)
    }
    expect(geo.topCounties.length).toBeGreaterThan(0)
  })

  it('perturbing the shared input moves the aggregates AND the tables together', () => {
    const fewer = statsObs.filter(o => o.county !== 'Marin')
    const fewerLists = computeChecklists(fewer)
    const agg = buildCountyAggregates(fewer, fewerLists)
    const geo = computeGeo(fewerLists, fewer)
    expect(agg.has('CA|marin')).toBe(false)
    expect(geo.topCounties.some(c => c.name === 'Marin')).toBe(false)
  })

  it('equals the Map Explorer for the same county and metric at the default setting', () => {
    // The Map Explorer computes filterObservations(allObs, false) and
    // computeChecklists over it; BirdingStats' includeSpuh defaults to false, so
    // both sides compute the identical pair. The escapee toggle does not enter
    // filteredObs at all, so it cannot make them disagree.
    const explorerObs = filterObservations(BACKUP, false)
    const explorer = buildCountyAggregates(explorerObs, computeChecklists(explorerObs))
    const stats = buildCountyAggregates(statsObs, statsChecklists)
    expect([...stats.keys()].sort()).toEqual([...explorer.keys()].sort())
    for (const [key, a] of stats) {
      expect(countyMetricValue(a, 'species')).toBe(countyMetricValue(explorer.get(key)!, 'species'))
      expect(countyMetricValue(a, 'records')).toBe(countyMetricValue(explorer.get(key)!, 'records'))
    }
  })

  it('with Count all forms ON the map follows the tab (QA-17)', () => {
    const spuh = obs({ commonName: 'Corvus sp.', county: 'Marin', stateProvince: 'US-CA', submissionId: 'S99' })
    const withSpuh = [...BACKUP, spuh]
    const off = buildCountyAggregates(filterObservations(withSpuh, false), computeChecklists(filterObservations(withSpuh, false)))
    const on = buildCountyAggregates(filterObservations(withSpuh, true), computeChecklists(filterObservations(withSpuh, true)))
    expect(on.get('CA|marin')!.records).toBe(off.get('CA|marin')!.records + 1)
    expect(on.get('CA|marin')!.species).toBe(off.get('CA|marin')!.species + 1)
  })
})

// ── Performance (NFR-01, NFR-02) ─────────────────────────────────────────────
// The house rule: sample COMPLETE executions and assert their minimum, never a
// partial or a loosened threshold. Each run uses a DISTINCT input so no memo on
// the path can turn a timed run into a cache hit — buildCountyAggregates itself
// holds none (it is pure and the caller memoizes), but the distinct inputs also
// defeat any engine caching of the argument shapes.
//
// EVERY MARGIN BELOW IS A SAME-RUN QUOTIENT, NEVER A MILLISECOND FIGURE, AND
// THAT IS THE WHOLE POINT OF THIS BLOCK. The first cut asserted the rule's 10x
// margin as `best * 10 < 200`, which arithmetic turns into `best < 20 ms` — a
// claim about how fast the build machine is, not about this code. It read
// 10.15 ms here and 45.7 ms on the GitHub ubuntu-latest runner the Pipeline
// workflow uses, so it failed CI on a build whose real 200 ms budget passed
// with 4x to spare. A margin has to be stated against something that moves WITH
// the host: another measurement taken in the same process, on the same engine,
// in the same run. Below, the budget is the only absolute number, and every
// margin is a quotient of two readings taken side by side.
//
// WHAT THE TWO NFR-02 QUOTIENTS ACTUALLY CATCH, mutation-measured on an M1 Pro
// under node 24, each figure the min-of-11 quotient the test itself computes:
//
//   rescan the checklists once per observation   shape 6.46  const 61.7   RED
//   a 4x per-row constant added to the obs loop  shape 0.98  const 11.3   RED
//   a 2x per-row constant added to the obs loop  shape 0.98  const  7.1   green
//   per-county species tally by scan, not Map    shape 1.19  const  3.6   green
//   per-county location tally by scan, not Map   shape 1.04  const  3.1   green
//   distinct-species membership by scan, not Set shape 1.11  const  3.3   green
//   (unmutated, for reference)                   shape 0.95  const  2.5   green
//
// So the pair fires on a growth change that makes the aggregate ~2.3x slower
// and on any change that makes it ~3.9x slower. Two things about that are worth
// saying plainly rather than leaving for the next reader to rediscover.
//
// The three green growth rows are REAL quadratic rewrites that no timing
// quotient can catch. They add 34%, 16% and 18% at the reference export size,
// which is inside the spread a healthy build shows on a contended runner
// (measured below), and none of them threatens the budget — the worst leaves
// 187 of the 200 ms. The absolute line they replace missed all three as well,
// at 13.3, 11.8 and 12.1 ms against its 20 ms. Do not chase them by tightening
// a bound; that trades a guard for a flake. Catching them would need work
// COUNTED rather than timed, which means instrumenting the aggregate itself.
//
// The 2x-constant row is the one place this pair is genuinely less sensitive
// than the absolute line it replaces: at 26.1 ms it would have tripped `< 20`
// on the build machine, and it does not trip a quotient. That is the price of
// not encoding a machine, and it is the right trade at a 200 ms budget — but it
// is a real loss, not a wash.
//
// AND WHAT THEY COST IN FALSE REDS, which is the failure this whole rewrite
// exists to prevent. The green envelope was measured on node 24 and node 20
// (the version CI runs), at the shipped fixture size and at 4x it, idle and
// under twelve-way CPU oversubscription on eight cores — a hostile condition
// well past a GitHub runner, where the absolute readings degrade 2x:
//
//   shape  0.64 - 1.41  (bound 2)     const  1.20 - 3.12  (bound 8)
//
// If one of these ever does go red, read the quotient in the failure message
// before touching the bound: 6.46 and 11.3 are what a real regression looks
// like, and 1.4 is what a bad afternoon on a shared runner looks like.

// The reference account's real size: 21,369 rows over 3,252 checklists, ~400
// species and ~900 locations. `bigExport(rows)` scales all four dimensions
// TOGETHER, so a fraction-size export is a faithful scale model of the SAME
// account rather than that account with rows torn out. That is what lets the
// shape quotient below speak about growth at all: a rewrite that went quadratic
// in any one of the four then MOVES the quotient, where a fixture that scaled
// only rows would leave three of them perfectly linear and invisible. Counties
// are the deliberate exception, held at ten: they key the aggregate's OUTPUT,
// and a birder's export grows in rows long after it stops adding counties. At
// FULL_ROWS the generator reproduces the original fixture exactly — verified by
// generating both forms and comparing, not by reading the arithmetic.
const FULL_ROWS = 21_369
const FULL_LISTS = 3_252
const FULL_NAMES = 400
const FULL_PLACES = 900
const FULL_COUNTIES = 10
/** The shape test's split: one full-size run against SPLIT runs at 1/SPLIT scale. */
const SPLIT = 8

function bigExport(rows: number): ObservationEntry[] {
  const scale = rows / FULL_ROWS
  const lists = Math.max(1, Math.round(FULL_LISTS * scale))
  const nNames = Math.max(1, Math.round(FULL_NAMES * scale))
  const nPlaces = Math.max(1, Math.round(FULL_PLACES * scale))
  const counties = ['Alameda', 'Contra Costa', 'Marin', 'Sonoma', 'Napa', 'Solano',
    'Santa Clara', 'San Mateo', 'Yolo', 'Placer']
  const names = Array.from({ length: nNames }, (_, i) => `Species ${i}`)
  const out: ObservationEntry[] = []
  for (let i = 0; i < rows; i += 1) {
    out.push(obs({
      submissionId: `S${100000 + (i % lists)}`,
      commonName: names[i % names.length],
      county: counties[i % counties.length],
      stateProvince: 'US-CA',
      locationId: `L${i % nPlaces}`,
      location: `Place ${i % nPlaces}`,
      date: `2026-0${1 + (i % 9)}-01`,
    }))
  }
  return out
}

function minOfSeven(run: (i: number) => void): number {
  const times: number[] = []
  for (let i = 0; i < 7; i += 1) {
    const t0 = performance.now()
    run(i)
    times.push(performance.now() - t0)
  }
  return Math.min(...times)
}

/**
 * Min-of-N of TWO workloads, measured alternately in one process with the order
 * swapped each round so neither wears the first-run penalty every time. The
 * pairing is what makes the quotient a property of the CODE: a slow, loaded or
 * thermally throttled host stretches both readings and cancels out of the
 * quotient, where an absolute figure would simply record which machine ran it.
 * Eleven rounds rather than the house seven, because a quotient needs a clean
 * sample on BOTH sides and a shared runner does not always supply one.
 */
function interleavedMins(
  a: (i: number) => void,
  b: (i: number) => void,
  rounds = 11,
): [number, number] {
  const time = (fn: (i: number) => void, i: number): number => {
    const t0 = performance.now()
    fn(i)
    return performance.now() - t0
  }
  let bestA = Infinity
  let bestB = Infinity
  for (let i = 0; i < rounds; i += 1) {
    if (i % 2 === 0) {
      bestA = Math.min(bestA, time(a, i))
      bestB = Math.min(bestB, time(b, i))
    } else {
      bestB = Math.min(bestB, time(b, i))
      bestA = Math.min(bestA, time(a, i))
    }
  }
  return [bestA, bestB]
}

describe('aggregate performance', () => {
  const FULL = bigExport(FULL_ROWS)
  // EIGHT DISTINCT eighth-scale exports, not one aggregated eight times. One
  // would be re-traversed from warm cache on seven of its eight runs while the
  // full-size run always starts cold, and that asymmetry is not a constant: it
  // grows with memory pressure, which is exactly the condition a shared runner
  // supplies. Separate fixtures make both timed regions touch the same
  // footprint of distinct memory. (Measured: with one shared fixture, a
  // twelve-way-oversubscribed run read 2.30 where every other run read ~1.0.)
  const SMALLS = Array.from({ length: SPLIT }, () => bigExport(Math.round(FULL_ROWS / SPLIT)))

  it('NFR-02: the full-export aggregate completes under 200 ms (min of 7)', () => {
    const lists = computeChecklists(FULL)
    const best = minOfSeven(i => {
      // A distinct input per run: drop one row, so nothing can be reused.
      buildCountyAggregates(FULL.slice(i), lists)
    })
    // The BUDGET, and only the budget — the margin is the two ratio tests
    // below. MEASURED with the machine named, because a bare figure reads as
    // universal and this one is not: 9.8 ms on an Apple M1 Pro under node 24
    // and 11.3 ms under node 20 (the version CI runs), against 45.7 ms on
    // GitHub's ubuntu-latest runner. Same conclusion, a 4x different number,
    // which is precisely why none of the margins below is written in ms.
    expect(best).toBeLessThan(200)
  })

  it('the NFR-02 margin is in the SHAPE: one big export ~= eight small ones', () => {
    // The same 21,369 rows and 3,252 checklists, aggregated ONCE at full size
    // and then as eight independent eighth-scale accounts — the same total
    // volume, eight times the concentration. Linear work gives a quotient of
    // ~1; work quadratic in rows, checklists, species or locations gives up to
    // ~8, because the fixture scales all four together and each small model is
    // a faithful eighth of every one of them. The bound is 2: measured, a
    // healthy build reads 0.64-1.41 across two node majors, two fixture sizes,
    // idle and twelve-way-oversubscribed, and the rescan regression reads 6.46.
    //
    // The two timed regions are deliberately the SAME DURATION, and that is
    // load-bearing rather than tidy. The first cut timed one full run against
    // one quarter run and allowed the quotient up to 8; idle it read 3.94-4.19,
    // but under contention it read 6.25 and 6.63, because a preempting
    // scheduler steals proportionally more wall time from the longer of two
    // unequal workloads and sampling the minimum cannot win it back. Equal
    // regions take that penalty together and it cancels out of the quotient —
    // the same reason the quotient cancels a slow host in the first place.
    const fullLists = computeChecklists(FULL)
    const smallLists = SMALLS.map(q => computeChecklists(q))
    const [full, allSmalls] = interleavedMins(
      i => { buildCountyAggregates(FULL.slice(i), fullLists) },
      i => { for (let k = 0; k < SPLIT; k += 1) buildCountyAggregates(SMALLS[k].slice(i), smallLists[k]) },
    )
    // Non-vacuity: the two timed regions really did run over the same volume,
    // on every dimension the fixture scales, and really did build aggregates.
    expect(SMALLS.reduce((n, q) => n + q.length, 0) / FULL.length).toBeCloseTo(1, 1)
    expect(smallLists.reduce((n, l) => n + l.length, 0) / fullLists.length).toBeCloseTo(1, 1)
    expect(buildCountyAggregates(SMALLS[0], smallLists[0]).size).toBe(FULL_COUNTIES)
    expect(buildCountyAggregates(FULL, fullLists).size).toBe(FULL_COUNTIES)
    // ...and the harness did not hand back a zero, which would make the
    // quotient meaningless rather than red.
    expect(allSmalls).toBeGreaterThan(0)
    expect(full, `shape quotient ${(full / allSmalls).toFixed(2)}, bound 2`)
      .toBeLessThan(allSmalls * 2)
  })

  it('the NFR-02 margin is also in the CONSTANT: within a few x of computeChecklists', () => {
    // The shape test above cannot see a per-row constant-factor regression — a
    // needless serialization of every observation scales linearly too, and the
    // quotient would not move. This one sees it, by timing the aggregate
    // against `computeChecklists` over the SAME rows: the work every caller
    // already does to produce the aggregate's second argument. Both are one
    // linear pass over the export with per-row species normalization and
    // Map/Set writes, so their quotient is a property of this code rather than
    // of the host. Three checklist passes per timed region, to hold the two
    // regions at the same duration for the reason the shape test spells out.
    //
    // A red here means one of two things, and it is worth knowing which before
    // touching the bound: the aggregate got materially more expensive per row,
    // or `computeChecklists` got materially cheaper.
    const lists = computeChecklists(FULL)
    const [aggregate, threeChecklistRuns] = interleavedMins(
      i => { buildCountyAggregates(FULL.slice(i), lists) },
      i => { for (let k = 0; k < 3; k += 1) computeChecklists(FULL.slice(i + k)) },
    )
    const checklists = threeChecklistRuns / 3
    expect(checklists).toBeGreaterThan(0)      // non-vacuity: it was measurable
    expect(lists.length).toBe(FULL_LISTS)      // ...over the whole export
    expect(aggregate, `constant quotient ${(aggregate / checklists).toFixed(2)}, bound 8`)
      .toBeLessThan(checklists * 8)
  })

  it('NFR-01: a per-species rebuild completes under 50 ms (min of 7)', () => {
    // The realistic shape: one species out of 400, so tens to hundreds of rows.
    const best = minOfSeven(i => {
      const slice = FULL.filter(o => o.commonName === `Species ${i}`)
      buildCountyAggregates(slice, computeChecklists(slice))
    })
    // The budget again, and again only the budget. That reading INCLUDES the
    // 21,369-row scan that produces the slice, which the component memoizes
    // separately — so it is conservative in the right direction.
    expect(best).toBeLessThan(50)
  })

  it('the NFR-01 margin: a per-species rebuild is 50x cheaper than a full one', () => {
    // The margin as a same-run quotient rather than a millisecond figure. The
    // property is that a per-species rebuild costs what THAT SPECIES' rows cost
    // (54 of 21,369 here), not what the whole export costs, so it must come in
    // far under a full-export rebuild measured beside it on the same machine.
    // An approach change that made it linear in the whole export drives the
    // quotient toward 1 and fails; a slow runner moves both readings together
    // and does not. MEASURED at 0.0034-0.0039 on both node majors, idle and
    // oversubscribed, so the 1/50 bound leaves better than 5x. The two forms
    // the regression actually takes were both mutation-measured against it:
    // handing this call the WHOLE export's checklists (the defect the top of
    // this file guards, in its performance aspect) reads 0.1375, and handing it
    // the unfiltered observations reads 0.7102 — 6.9x and 35x past the bound.
    const slice = FULL.filter(o => o.commonName === 'Species 0')
    const sliceLists = computeChecklists(slice)
    const fullLists = computeChecklists(FULL)
    const [perSpecies, fullExport] = interleavedMins(
      i => { buildCountyAggregates(slice.slice(i), sliceLists) },
      i => { buildCountyAggregates(FULL.slice(i), fullLists) },
    )
    expect(slice.length).toBeGreaterThan(10)   // non-vacuity: it really did work
    expect(fullExport).toBeGreaterThan(0)
    expect(perSpecies * 50, `per-species quotient ${(perSpecies / fullExport).toFixed(4)}, bound 0.02`)
      .toBeLessThan(fullExport)
  })
})
