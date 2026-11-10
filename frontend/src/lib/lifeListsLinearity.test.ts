// LINEARITY of the Life Lists derivation (life-lists-tab NFR-01, QA-44; schema 8).
//
// The derivation runs on the main thread inside the tab's load effect, so a
// superlinear pass is a frozen window rather than a slow function. Each pass is
// timed at N and 10N through the shared CPU-time helper (src/test/cpuTiming.ts),
// interleaved with a rotating start, and the per-call quotient t(10N) / t(N)
// must stay at or under 20: linear is 10, and the margin is the house 2x. Pass 3
// sorts SPECIES, so its distinct-species leg is S log S, and its limit is the
// same 2x over that expectation (about 29 at its legs), derived in the row
// rather than typed in (decisions.md D-19). Its legs are 500 / 5,000 species,
// where the margin comes from the legs, not the limit (decisions.md D-28). Both legs are measured in the same process, so
// the machine cancels; an absolute wall-clock budget is never asserted here.
//
// TWO SPECIES SHAPES per pass: every row its own species (the per-key path at
// volume, security.md v1.0.41) and 200 species repeated (the replace path).
// Inputs are built flat with `[...].join('')` (testing.md v1.0.46) and before
// any timing.
//
// THE RESIDUAL, named rather than raised (testing.md v1.0.40, rule 3). On the
// distinct-species leg every row adds a Map entry the call keeps alive, and the
// per-entry cost grows with the live set: measured in CPU time on this Mac,
// pass 2 (nothing but a Map insert per distinct key) read 13.1 from 2k to 20k
// rows and 18.7 from 20k to 200k, and even a DOUBLING from 100k to 200k read
// 2.98. That is the engine's memory hierarchy, not the algorithm, and at the
// schema's planned 20k / 200k legs it put the in-file reading at 21 to 23. So
// the legs are 5k / 50k, where the same leg reads about 12.5, and the limit
// stays 20 (life-lists-tab decisions.md D-19). The repeated-species leg, the
// realistic shape, is flat at either size.
//
// THE REGION PASSES (life-list-region-filter NFR-01, QA-31, schema 6). Pass 1R
// and pass 2R ride the same procedure, legs and limit in FOUR shapes: the two
// species shapes crossed with two region shapes, every row its own
// (state, county) pair (the per-key path and the per-region inner-Map creation
// at volume) and 20 counties in 4 states (the realistic shape). Pass 1R also
// builds and sorts the choices, so on the every-row-a-pair legs its limit is
// derived from C log C as pass 3's is; on the 20-county legs C does not grow and
// the flat 20 holds. The ML rows cite the backup's own submission ids one to
// one, so every asset joins and the join's per-key path runs at volume. The
// materializers plus pass 3 and the choice build have rows of their own.
// D-04 in `pipeline/life-list-region-filter/decisions.md` has the readings.
//
// NON-VACUITY: the same quotient procedure is pointed at a mutant of pass 1 in
// THIS file (never in the module) that replaces the Map lookup with a linear
// search over the output, the plausible wrong implementation, and must exceed
// the limit. It runs at 2k and 20k rows, because at 10N it would not finish.
// A capped replica over 1,000 rows runs first, so a hang cannot sit behind the
// timeout (testing.md v1.0.33).

import { describe, it, expect } from 'vitest'
import type { ObservationEntry } from '../types'
import type { MLExportRow } from './parseMLExport'
import { bestPerCallCpuMs } from '../test/cpuTiming'
import { normalizeSpeciesName, isNonCountableForm } from './speciesUtils'
import {
  deriveFirstAssets, deriveFirstSightings, selectRows, dayKey, minuteOf12h,
  type FirstSighting, type LifeListClassification, type MediaFormat,
} from './lifeLists'
import {
  buildRegionChoices, deriveRegionAssets, deriveRegionIndex, regionAssets, regionFirsts,
  type RegionRef, type RegionTiers, type SpeciesSlots,
} from './lifeListsRegion'

const N = 5_000
/** Pass 3's own legs: 500 and 5,000 species (decisions.md D-28). It sorts its
 *  output, so its residual grows faster with size than the passes' do; at these
 *  legs it read 10.3 to 11.1 under heavy load on Node 24 and Node 20, about 2.6x
 *  under its derived limit, where 5k / 50k read up to 21 (1.2x). */
const PASS3_N = 500
/** The every-row-a-pair region legs: 2k and 20k. Each such row creates two
 *  inner Maps the call keeps alive, so the D-19 live-set residual arrives
 *  sooner: measured in CPU time on this Mac, 11.6 to 13.9 at 2k / 20k against
 *  the derived limit of 25.5, and 15.6 to 27.1 at 5k / 50k against 25.0. The
 *  legs move, never the limit (schema 6; decisions.md D-04). */
const PAIRS_N = 2_000
/** The mutant's own sizes: 2k and 20k, where it still finishes. */
const MUTANT_N = 2_000
const LIMIT = 20
const ROUNDS = 7
const NONE: LifeListClassification = { escapees: new Set(), exotics: new Set() }

function name(i: number, distinct: boolean): string {
  return ['Bird ', String(distinct ? i : i % 200)].join('')
}
function dateOf(i: number): string {
  return ['20', String(10 + (i % 15)).padStart(2, '0'), '-', String((i % 12) + 1).padStart(2, '0'), '-', String((i % 28) + 1).padStart(2, '0')].join('')
}

/** The region shapes (schema 6): one cell for the shipped rows, every row its
 *  own (state, county) pair, or 20 counties in 4 states. */
type RegionShape = 'one' | 'pairs' | 'counties20'
function stateOf(i: number, shape: RegionShape): string {
  return shape === 'pairs' ? ['US-', String(i)].join('') : shape === 'counties20' ? ['US-S', String(i % 4)].join('') : 'US-MN'
}
function countyOf(i: number, shape: RegionShape): string {
  return shape === 'pairs' ? 'Hennepin' : shape === 'counties20' ? ['County ', String(i % 20)].join('') : 'Hennepin'
}

function backup(n: number, distinct: boolean, shape: RegionShape = 'one'): ObservationEntry[] {
  return Array.from({ length: n }, (_, i) => ({
    submissionId: ['S', String(1_000_000 + i)].join(''), commonName: name(i, distinct),
    scientificName: ['Genus ', 'species', String(i % 50)].join(''), date: dateOf(i),
    location: ['Place ', String(i % 300)].join(''), locationId: 'L1', latitude: null, longitude: null,
    county: countyOf(i, shape), count: 1, breedingCode: null, speciesComments: '', catalogIds: [],
    time: i % 7 === 0 ? null : [String((i % 12) + 1), ':', String(i % 60).padStart(2, '0'), i % 2 ? ' AM' : ' PM'].join(''),
    stateProvince: stateOf(i, shape),
  }))
}

const FORMATS: MediaFormat[] = ['Photo', 'Audio', 'Video']
function mlExport(n: number, distinct: boolean): MLExportRow[] {
  return Array.from({ length: n }, (_, i) => ({
    catalogId: ['ML', String(i)].join(''), commonName: name(i, distinct), scientificName: '', format: FORMATS[i % 3],
    date: dateOf(i), location: 'River Trail', county: 'Dakota', latitude: null, longitude: null, caption: '',
    mediaNotes: '', observationDetails: '', ageSex: '', behaviors: '', time: String(600 + (i % 1200)).slice(0, 4),
    year: null, month: null, avgRating: null, numRatings: 0, checklistId: ['S', String(1_000_000 + i)].join(''),
  }))
}

/** The quotient procedure, one definition for the shipped passes and the mutant. */
function quotient(small: () => unknown, large: () => unknown): number {
  // Each sample batches calls to the helper's default 20 ms: the small legs are
  // under a millisecond per call, where a single-call sample is noise.
  const { perCall } = bestPerCallCpuMs([small, large], { rounds: ROUNDS })
  return perCall[1] / Math.max(perCall[0], 0.05)
}

/** The mutant: pass 1 with its Map lookup replaced by a search over the output. */
function mutantFirstSightings(obs: readonly ObservationEntry[]): FirstSighting[] {
  const out: FirstSighting[] = []
  for (const o of obs) {
    const day = dayKey(o.date)
    if (day === null || !o.submissionId || isNonCountableForm(o.commonName)) continue
    const n = normalizeSpeciesName(o.commonName)
    let found = -1
    for (let j = 0; j < out.length; j++) if (out[j].name === n) { found = j; break }
    const rec = { name: n, day, minute: minuteOf12h(o.time), scientificName: '', submissionId: o.submissionId, location: o.location, place: '' }
    if (found === -1) out.push(rec)
    else if (day < out[found].day) out[found] = rec
  }
  return out
}

/** The mutant: pass 1R with each region's species Map replaced by a linear
 *  search over an array of slots, the plausible wrong implementation. */
function mutantRegionIndex(obs: readonly ObservationEntry[]): Map<string, { name: string; day: number }[]> {
  const tiers = new Map<string, { name: string; day: number }[]>()
  for (const o of obs) {
    const sp = o.stateProvince
    const day = dayKey(o.date)
    if (typeof sp !== 'string' || day === null || !o.submissionId || isNonCountableForm(o.commonName)) continue
    const n = normalizeSpeciesName(o.commonName)
    for (const key of ['US', sp]) {
      let list = tiers.get(key)
      if (list === undefined) { list = []; tiers.set(key, list) }
      let found = -1
      for (let j = 0; j < list.length; j++) if (list[j].name === n) { found = j; break }
      if (found === -1) list.push({ name: n, day })
      else if (day < list[found].day) list[found] = { name: n, day }
    }
  }
  return tiers
}

/** The choices' own count, for the C log C limits. */
const choiceCount = (o: readonly ObservationEntry[]) => deriveRegionIndex(o).choices.total
/** The house 2x over C log C, from the counts each leg actually sorts. */
const sortLimit = (cs: number, cl: number) => 2 * (cl / cs) * (Math.log2(cl) / Math.log2(cs))

// Its own testTimeout: the legs are deliberately large (testing.md v1.0.40).
describe('the Life Lists derivation is linear in rows (NFR-01, QA-44)', { timeout: 60_000 }, () => {
  it('a capped replica completes promptly before any timed leg', () => {
    const start = performance.now()
    const f = deriveFirstSightings(backup(1_000, true))
    selectRows(f, deriveFirstAssets(mlExport(1_000, true)), NONE, { includeEscapees: false, includeExotics: false, formats: new Set() })
    const r = deriveRegionIndex(backup(1_000, true, 'pairs'))
    deriveRegionAssets(mlExport(1_000, true), r.join)
    expect(performance.now() - start).toBeLessThan(2_000)
    expect(f.size).toBe(1_000)
    expect(r.choices.total).toBe(2_001)
  })

  for (const distinct of [true, false]) {
    const leg = distinct ? 'every row its own species' : '200 species repeated'

    it(`pass 1 (first sightings), ${leg}`, () => {
      const small = backup(N, distinct), large = backup(10 * N, distinct)
      expect(quotient(() => deriveFirstSightings(small), () => deriveFirstSightings(large))).toBeLessThanOrEqual(LIMIT)
    })

    it(`pass 2 (first assets), ${leg}`, () => {
      const small = mlExport(N, distinct), large = mlExport(10 * N, distinct)
      expect(quotient(() => deriveFirstAssets(small), () => deriveFirstAssets(large))).toBeLessThanOrEqual(LIMIT)
    })

    it(`pass 3 (the shown list, a media selection), ${leg}`, () => {
      const fs = deriveFirstSightings(backup(PASS3_N, distinct)), fl = deriveFirstSightings(backup(10 * PASS3_N, distinct))
      const as = deriveFirstAssets(mlExport(PASS3_N, distinct)), al = deriveFirstAssets(mlExport(10 * PASS3_N, distinct))
      const c = { includeEscapees: false, includeExotics: false, formats: new Set<MediaFormat>(['Photo']) }
      // Pass 3 sorts its output, so its expectation is S log S, not linear: the
      // limit is the house 2x over THAT, derived from the rows each leg actually
      // sorts (about 29 on the distinct leg; the repeated leg, where S does not
      // grow, keeps the flat 20). A nested loop or a quadratic sort reads about
      // 100 and fails it.
      const ns = selectRows(fs, as, NONE, c).length, nl = selectRows(fl, al, NONE, c).length
      const limit = distinct ? 2 * (nl / ns) * (Math.log2(nl) / Math.log2(ns)) : LIMIT
      expect(limit).toBeLessThanOrEqual(30)
      expect(quotient(() => selectRows(fs, as, NONE, c), () => selectRows(fl, al, NONE, c))).toBeLessThanOrEqual(limit)
    })
  }

  for (const distinct of [true, false]) {
    for (const shape of ['pairs', 'counties20'] as const) {
      const leg = `${distinct ? 'every row its own species' : '200 species repeated'}, ${shape === 'pairs' ? 'every row its own (state, county)' : '20 counties in 4 states'}`

      const n = shape === 'pairs' ? PAIRS_N : N

      it(`pass 1R (the region index), ${leg}`, () => {
        const small = backup(n, distinct, shape), large = backup(10 * n, distinct, shape)
        // Pass 1 warms the species-name memos first, as the load effect does.
        deriveFirstSightings(small); deriveFirstSightings(large)
        const cs = choiceCount(small), cl = choiceCount(large)
        const limit = cl > cs ? sortLimit(cs, cl) : LIMIT
        expect(limit).toBeLessThanOrEqual(30)
        expect(quotient(() => deriveRegionIndex(small), () => deriveRegionIndex(large))).toBeLessThanOrEqual(limit)
      })

      it(`pass 2R (the region assets), ${leg}`, () => {
        const js = deriveRegionIndex(backup(n, distinct, shape)).join, jl = deriveRegionIndex(backup(10 * n, distinct, shape)).join
        const small = mlExport(n, distinct), large = mlExport(10 * n, distinct)
        // Non-vacuity: every asset joins, so the per-key path runs at volume.
        expect(js.size).toBe(n)
        expect(jl.has(large[10 * n - 1].checklistId)).toBe(true)
        expect(quotient(() => deriveRegionAssets(small, js), () => deriveRegionAssets(large, jl))).toBeLessThanOrEqual(LIMIT)
      })
    }
  }

  it('a region press (the materializers plus pass 3), 500 and 5,000 regional species', () => {
    const os = backup(PASS3_N, true, 'counties20'), ol = backup(10 * PASS3_N, true, 'counties20')
    const ms = mlExport(PASS3_N, true), mll = mlExport(10 * PASS3_N, true)
    const is = deriveRegionIndex(os), il = deriveRegionIndex(ol)
    const as = deriveRegionAssets(ms, is.join), al = deriveRegionAssets(mll, il.join)
    const ws = deriveFirstAssets(ms), wl = deriveFirstAssets(mll)
    const us: RegionRef = { level: 'country', code: 'US' }
    const c = { includeEscapees: false, includeExotics: false, formats: new Set<MediaFormat>(['Photo']) }
    const press = (idx: typeof is, a: typeof as, o: ObservationEntry[], m: MLExportRow[], w: typeof ws) =>
      selectRows(regionFirsts(idx, us, o)!, regionAssets(a, us, m), NONE, c, w)
    const ns = press(is, as, os, ms, ws).length, nl = press(il, al, ol, mll, wl).length
    expect(ns).toBeGreaterThan(100)
    const limit = sortLimit(ns, nl)
    expect(limit).toBeLessThanOrEqual(30)
    const { perCall } = bestPerCallCpuMs([() => press(is, as, os, ms, ws), () => press(il, al, ol, mll, wl)], { rounds: ROUNDS })
    // The small leg sits above the quotient's floor, so the asserted quotient
    // is the raw one (testing.md v1.0.63).
    expect(perCall[0]).toBeGreaterThan(0.05)
    expect(perCall[1] / perCall[0]).toBeLessThanOrEqual(limit)
  })

  it('the choice build sorts in C log C, 500 and 5,000 choices', () => {
    const tiers = (n: number): RegionTiers<SpeciesSlots> => {
      const states = new Map<string, SpeciesSlots>()
      for (let i = 0; i < n; i++) states.set(['US-', String((i * 7919) % (n * 3))].join(''), new Map())
      return { countries: new Map(), states, counties: new Map() }
    }
    const ts = tiers(500), tl = tiers(5_000)
    expect(buildRegionChoices(ts).total).toBe(500)
    const { perCall } = bestPerCallCpuMs([() => buildRegionChoices(ts), () => buildRegionChoices(tl)], { rounds: ROUNDS })
    expect(perCall[0]).toBeGreaterThan(0.05)
    expect(perCall[1] / perCall[0]).toBeLessThanOrEqual(sortLimit(500, 5_000))
  })

  it('the bound holds at the cap: 150,000 rows, each its own (state, county), derive at most 3 x 150,000 choices (NFR-02, QA-32)', () => {
    const rows = 150_000
    const o = Array.from({ length: rows }, (_, i) => ({
      ...backup(1, true)[0], submissionId: ['S', String(1_000_000 + i)].join(''), commonName: name(i, true),
      stateProvince: ['Q', String(i), '-S'].join(''), county: ['County ', String(i)].join(''),
    }))
    const index = deriveRegionIndex(o)
    expect(index.choices.total).toBeLessThanOrEqual(3 * rows)
    expect(index.choices.total).toBe(3 * rows)
    expect(index.join.size).toBeLessThanOrEqual(rows)
    let slots = 0
    for (const m of index.firsts.countries.values()) slots += m.size
    for (const m of index.firsts.states.values()) slots += m.size
    for (const c of index.firsts.counties.values()) for (const m of c.values()) slots += m.size
    expect(slots).toBeLessThanOrEqual(3 * rows)
  })

  it('the region guard can go red: the linear-search mutant of pass 1R exceeds the limit', () => {
    const small = backup(MUTANT_N, true, 'counties20'), large = backup(10 * MUTANT_N, true, 'counties20')
    expect(mutantRegionIndex(small).get('US')).toHaveLength(MUTANT_N)
    expect(quotient(() => mutantRegionIndex(small), () => mutantRegionIndex(large))).toBeGreaterThan(LIMIT)
    expect(quotient(() => deriveRegionIndex(small), () => deriveRegionIndex(large))).toBeLessThanOrEqual(LIMIT)
  })

  it('the guard can go red: the linear-search mutant exceeds the limit on the distinct leg', () => {
    const small = backup(MUTANT_N, true), large = backup(10 * MUTANT_N, true)
    expect(mutantFirstSightings(small)).toHaveLength(MUTANT_N)
    expect(quotient(() => mutantFirstSightings(small), () => mutantFirstSightings(large))).toBeGreaterThan(LIMIT)
    // And the shipped pass, through the same procedure at the same sizes, does not.
    expect(quotient(() => deriveFirstSightings(small), () => deriveFirstSightings(large))).toBeLessThanOrEqual(LIMIT)
  })
})
