// LINEARITY of the Life Lists derivation (life-lists-tab NFR-01, QA-44; schema 8).
//
// The derivation runs on the main thread inside the tab's load effect, so a
// superlinear pass is a frozen window rather than a slow function. Each pass is
// timed at N and 10N through the shared CPU-time helper (src/test/cpuTiming.ts),
// interleaved with a rotating start, and the per-call quotient t(10N) / t(N)
// must stay at or under 20: linear is 10, and the margin is the house 2x. Pass 3
// sorts SPECIES, so its distinct-species leg is S log S, about 13 at these sizes,
// and its limit is the same 2x over that expectation (about 26), derived in the
// row rather than typed in (decisions.md D-19). Both legs are measured in the same process, so
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

const N = 5_000
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

function backup(n: number, distinct: boolean): ObservationEntry[] {
  return Array.from({ length: n }, (_, i) => ({
    submissionId: ['S', String(1_000_000 + i)].join(''), commonName: name(i, distinct),
    scientificName: ['Genus ', 'species', String(i % 50)].join(''), date: dateOf(i),
    location: ['Place ', String(i % 300)].join(''), locationId: 'L1', latitude: null, longitude: null,
    county: 'Hennepin', count: 1, breedingCode: null, speciesComments: '', catalogIds: [],
    time: i % 7 === 0 ? null : [String((i % 12) + 1), ':', String(i % 60).padStart(2, '0'), i % 2 ? ' AM' : ' PM'].join(''),
    stateProvince: 'US-MN',
  }))
}

const FORMATS: MediaFormat[] = ['Photo', 'Audio', 'Video']
function mlExport(n: number, distinct: boolean): MLExportRow[] {
  return Array.from({ length: n }, (_, i) => ({
    catalogId: ['ML', String(i)].join(''), commonName: name(i, distinct), scientificName: '', format: FORMATS[i % 3],
    date: dateOf(i), location: 'River Trail', county: 'Dakota', latitude: null, longitude: null, caption: '',
    mediaNotes: '', observationDetails: '', ageSex: '', behaviors: '', time: String(600 + (i % 1200)).slice(0, 4),
    year: null, month: null, avgRating: null, numRatings: 0, checklistId: 'S1',
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

// Its own testTimeout: the legs are deliberately large (testing.md v1.0.40).
describe('the Life Lists derivation is linear in rows (NFR-01, QA-44)', { timeout: 60_000 }, () => {
  it('a capped replica completes promptly before any timed leg', () => {
    const start = performance.now()
    const f = deriveFirstSightings(backup(1_000, true))
    selectRows(f, deriveFirstAssets(mlExport(1_000, true)), NONE, { includeEscapees: false, includeExotics: false, formats: new Set() })
    expect(performance.now() - start).toBeLessThan(2_000)
    expect(f.size).toBe(1_000)
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
      const fs = deriveFirstSightings(backup(N, distinct)), fl = deriveFirstSightings(backup(10 * N, distinct))
      const as = deriveFirstAssets(mlExport(N, distinct)), al = deriveFirstAssets(mlExport(10 * N, distinct))
      const c = { includeEscapees: false, includeExotics: false, formats: new Set<MediaFormat>(['Photo']) }
      // Pass 3 sorts its output, so its expectation is S log S, not linear: the
      // limit is the house 2x over THAT, derived from the rows each leg actually
      // sorts (about 26 on the distinct leg, 2 on the repeated one, where S does
      // not grow). A nested loop or a quadratic sort reads about 100 and fails it.
      const ns = selectRows(fs, as, NONE, c).length, nl = selectRows(fl, al, NONE, c).length
      const limit = distinct ? 2 * (nl / ns) * (Math.log2(nl) / Math.log2(ns)) : LIMIT
      expect(limit).toBeLessThanOrEqual(30)
      expect(quotient(() => selectRows(fs, as, NONE, c), () => selectRows(fl, al, NONE, c))).toBeLessThanOrEqual(limit)
    })
  }

  it('the guard can go red: the linear-search mutant exceeds the limit on the distinct leg', () => {
    const small = backup(MUTANT_N, true), large = backup(10 * MUTANT_N, true)
    expect(mutantFirstSightings(small)).toHaveLength(MUTANT_N)
    expect(quotient(() => mutantFirstSightings(small), () => mutantFirstSightings(large))).toBeGreaterThan(LIMIT)
    // And the shipped pass, through the same procedure at the same sizes, does not.
    expect(quotient(() => deriveFirstSightings(small), () => deriveFirstSightings(large))).toBeLessThanOrEqual(LIMIT)
  })
})
