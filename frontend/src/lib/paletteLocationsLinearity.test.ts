// LINEARITY of Search's location pass and match (visited-hotspots-in-search
// gate R3, NFR-03, NFR-09, QA-43; schema 10.3).
//
// The `hotspotReportsLinearity.test.ts` procedure: each row times its subject at
// a small and a large leg through the shared CPU-time helper (src/test/
// cpuTiming.ts), legs interleaved with a rotating start, inputs built before any
// timing and distinct per leg, and asserts the per-call quotient against its
// limit: the flat 20 (linear is 10, the house 2x margin), or for the pass, which
// SORTS the distinct locations, `2 x (rows ratio) x log2(L large) / log2(L
// small)` computed from the locations each leg sorts (security.md v1.0.63).
//
// LEGS AT 500 / 5,000, the house legs, where both stay cache-resident on CI's
// runners. The gate's own 2.2 per doubling is a READING, not this file's
// assertion (schema flag 8): asserted in CI at that number a correct build would
// flake, since sound readings sit between 1.96 and 2.37. So each row asserts the
// house limit over its tenfold span and, with SR_LINEARITY_REPORT=1, also prints
// every per-doubling quotient over 625, 1,250 and 2,500 between, which is what the
// Engineer and QA record against 2.2 (decisions.md).
//
// NON-VACUITY: two mutants live in THIS file, never in the module: the pass
// with its Location ID Set replaced by an array search, and the match with
// every search restarted at its own location and run to the column's end. Each
// must exceed its row's limit at the same legs, after a capped replica over
// 1,000 rows so a hang cannot sit behind the timeout (testing.md v1.0.33).
//
// THE COMPARISON OF NFR-03: at 5,000 distinct locations and 5,000 distinct
// species in the same run, the location half of a keystroke costs no more than
// the species half, for a one-character query, an ordinary one and a no-match.

import { describe, it, expect } from 'vitest'
import type { ObservationEntry } from '../types'
import { bestPerCallCpuMs } from '../test/cpuTiming'
import { row } from '../test/hotspotReportsRows'
import { buildLocationSearchIndex, matchLocations, LOCATION_CAP, type LocationSearchIndex } from './paletteLocations'
import { LOCATION_ID_MAX_CHARS } from './hotspotReports'
import { buildPaletteRows } from './paletteRows'
import type { SpeciesIndexEntry } from './speciesIndex'

const SMALL = 500
const LARGE = 5_000
const DOUBLINGS = [625, 1_250, 2_500, 5_000]
const LIMIT = 20
const ROUNDS = 7
const FLOOR_MS = 0.05
const TIMEOUT_MS = 180_000
const REPORT = process.env.SR_LINEARITY_REPORT === '1'

const sortLimit = (s: number, l: number) => 2 * (l / s) * (Math.log2(l) / Math.log2(s))

function measure(small: () => unknown, large: () => unknown) {
  const { perCall } = bestPerCallCpuMs([small, large], { rounds: ROUNDS })
  return { quotient: perCall[1] / Math.max(perCall[0], FLOOR_MS), raw: perCall[1] / perCall[0], smallMs: perCall[0], largeMs: perCall[1] }
}

function check(label: string, m: ReturnType<typeof measure>, limit: number) {
  if (REPORT) console.log(`LINEARITY ${label}: ${m.quotient.toFixed(2)} raw ${m.raw.toFixed(2)} limit ${limit.toFixed(1)} ratio ${(m.quotient / limit).toFixed(2)} small ${m.smallMs.toFixed(3)}ms large ${m.largeMs.toFixed(3)}ms`)
  expect(m.smallMs, `${label}: the small leg (${m.smallMs.toFixed(4)} ms) is under the quotient floor`).toBeGreaterThan(FLOOR_MS)
  expect(m.quotient, `${label}: ${m.quotient.toFixed(2)} (raw ${m.raw.toFixed(2)}) against ${limit.toFixed(1)}`).toBeLessThanOrEqual(limit)
}

/** Per-doubling readings, printed only (schema flag 8). */
function report(label: string, build: (n: number) => () => unknown, sortsDistinct: boolean) {
  if (!REPORT) return
  const legs = DOUBLINGS.map(n => build(n))
  const { perCall } = bestPerCallCpuMs(legs, { rounds: ROUNDS })
  const q = perCall.slice(1).map((t, i) => t / perCall[i])
  const lim = DOUBLINGS.slice(1).map((n, i) => (sortsDistinct ? 2.2 * Math.log2(n) / Math.log2(DOUBLINGS[i]) : 2.2))
  console.log(`DOUBLING ${label}: ${q.map((x, i) => `${x.toFixed(2)}/${lim[i].toFixed(2)}`).join('  ')}  (${perCall.map(t => t.toFixed(3)).join(', ')} ms)`)
}

/** A deterministic permutation, so names arrive in no sorted order. */
const scrambled = (i: number, n: number) => (i * 7919 + 13) % n
const pad = (n: number, w: number) => String(n).padStart(w, '0')

/** Every row its own checklist and location, short names. */
function shortNames(n: number): ObservationEntry[] {
  return Array.from({ length: n }, (_, i) => row({
    submissionId: ['S', String(1_000_000 + i)].join(''),
    locationId: ['L', String(1_000_000 + i)].join(''),
    location: ['Place ', pad(scrambled(i, n), 6)].join(''),
  }))
}

/** Every row its own location, names at the 200 bound sharing a 192-unit prefix. */
function boundNames(n: number): ObservationEntry[] {
  const prefix = 'x'.repeat(192)
  return Array.from({ length: n }, (_, i) => row({
    submissionId: ['S', String(1_000_000 + i)].join(''),
    locationId: ['L', String(1_000_000 + i)].join(''),
    location: [prefix, pad(scrambled(i, n), 8)].join(''),
  }))
}

/** The realistic shape: one location per 75 rows, checklists of seven rows. */
function realistic(n: number): ObservationEntry[] {
  const locations = Math.max(1, Math.round(n / 75))
  return Array.from({ length: n }, (_, i) => {
    const c = Math.floor(i / 7)
    return row({
      submissionId: ['S', String(1_000_000 + c)].join(''),
      locationId: ['L', String(c % locations)].join(''),
      location: ['Place ', pad(c % locations, 5)].join(''),
    })
  })
}

/** 32 queries per timed call: absent first unit, common first unit, a 100-unit
 *  near miss and a periodic near miss, eight of each. */
const QUERIES: string[] = [
  ...Array.from({ length: 8 }, (_, i) => ['q', String(i)].join('')),
  ...Array.from({ length: 8 }, (_, i) => ['x', String(i), 'z'].join('')),
  ...Array.from({ length: 8 }, (_, i) => ['x'.repeat(99), String(i)].join('')),
  ...Array.from({ length: 8 }, (_, i) => ['xx', 'x9'.repeat(10), String(i)].join('')),
]
function allQueries(ix: LocationSearchIndex, match = matchLocations, queries: readonly string[] = QUERIES): number {
  let n = 0
  for (const q of queries) n += match(ix, q).rows.length
  return n
}
/** The absence leg alone, where the restart mutant reads 4 per doubling (schema
 *  0.5). Its near-miss legs would take minutes per call at the large leg, which
 *  a mutant row has no need to spend. */
const ABSENT = QUERIES.slice(0, 8)

// ── Mutants (test-side only) ────────────────────────────────────────────────

/** The pass with its Location ID Set replaced by an array search. */
function mutantPass(obs: readonly ObservationEntry[]): number {
  const seenSubs = new Set<string>()
  const ids: string[] = []
  for (const o of obs) {
    const sub = o.submissionId
    if (typeof sub !== 'string' || sub === '' || seenSubs.has(sub)) continue
    seenSubs.add(sub)
    const id = o.locationId
    if (typeof id !== 'string' || id.length === 0 || id.length > LOCATION_ID_MAX_CHARS) continue
    let seen = false
    for (const x of ids) if (x === id) { seen = true; break }
    if (!seen) ids.push(id)
  }
  return ids.length
}

/** The match with every search restarted at its own location and left to run
 *  to the column's end. */
function mutantMatch(ix: LocationSearchIndex, q: string, cap = LOCATION_CAP) {
  const rows = []
  for (let k = 0; k < ix.rows.length; k++) {
    const hit = ix.column.indexOf(q, ix.starts[k])
    if (hit === -1 || hit >= ix.starts[k + 1]) continue
    if (rows.length === cap) break
    rows.push(ix.rows[k])
  }
  return { rows, truncated: false }
}

describe('Search\'s location pass and match are linear (R3, QA-43)', () => {
  it('the pass, every row its own location, short names (limit from L log L)', () => {
    const [s, l] = [shortNames(SMALL), shortNames(LARGE)]
    check('pass short', measure(() => buildLocationSearchIndex(s), () => buildLocationSearchIndex(l)), sortLimit(SMALL, LARGE))
    report('pass short', n => { const o = shortNames(n); return () => buildLocationSearchIndex(o) }, true)
  }, TIMEOUT_MS)

  it('the pass, every row its own location, names at the bound sharing a prefix (limit from L log L)', () => {
    const [s, l] = [boundNames(SMALL), boundNames(LARGE)]
    check('pass bound', measure(() => buildLocationSearchIndex(s), () => buildLocationSearchIndex(l)), sortLimit(SMALL, LARGE))
    report('pass bound', n => { const o = boundNames(n); return () => buildLocationSearchIndex(o) }, true)
  }, TIMEOUT_MS)

  it('the pass, the realistic shape: one location per 75 rows (flat limit)', () => {
    // At the house legs a call is under the quotient floor, so each timed call
    // repeats the pass a fixed number of times (the hotspotReportsLinearity
    // practice): the small leg clears the floor and what is measured is
    // unchanged, since the pass keeps no memo.
    const REPEAT = 20
    const many = (o: ObservationEntry[]) => () => { for (let r = 0; r < REPEAT; r++) buildLocationSearchIndex(o) }
    const [s, l] = [realistic(SMALL), realistic(LARGE)]
    check('pass realistic', measure(many(s), many(l)), LIMIT)
    report('pass realistic', n => many(realistic(n)), false)
  }, TIMEOUT_MS)

  it('the match, every row its own location, names at the bound, 32 queries a call (flat limit)', () => {
    const [s, l] = [buildLocationSearchIndex(boundNames(SMALL)), buildLocationSearchIndex(boundNames(LARGE))]
    check('match bound', measure(() => allQueries(s), () => allQueries(l)), LIMIT)
    report('match bound', n => { const ix = buildLocationSearchIndex(boundNames(n)); return () => allQueries(ix) }, false)
  }, TIMEOUT_MS)
})

describe('the linearity rows can reject a quadratic (non-vacuity)', () => {
  it('the pass with an array search over the Location IDs exceeds its limit', () => {
    mutantPass(shortNames(1_000))
    const [s, l] = [shortNames(SMALL), shortNames(LARGE)]
    expect(measure(() => mutantPass(s), () => mutantPass(l)).quotient).toBeGreaterThan(sortLimit(SMALL, LARGE))
  }, TIMEOUT_MS)

  it('the match restarted at every location exceeds its limit', () => {
    allQueries(buildLocationSearchIndex(boundNames(1_000)), mutantMatch, ABSENT)
    const [s, l] = [buildLocationSearchIndex(boundNames(SMALL)), buildLocationSearchIndex(boundNames(LARGE))]
    expect(measure(() => allQueries(s, mutantMatch, ABSENT), () => allQueries(l, mutantMatch, ABSENT)).quotient).toBeGreaterThan(LIMIT)
  }, TIMEOUT_MS)
})

describe('the location half costs no more than the species half at like scale (NFR-03)', () => {
  const N = 5_000
  // Distinct locations and distinct species, short ordinary names.
  const locations = buildLocationSearchIndex(shortNames(N))
  const species: SpeciesIndexEntry[] = Array.from({ length: N }, (_, i) => ({
    name: ['Bird ', pad(scrambled(i, N), 6)].join(''),
    sciName: ['Avis ', pad(i, 6)].join(''),
  }))
  const speciesHalf = (q: string) => () => buildPaletteRows({ items: [], index: species, query: q })
  const locationHalf = (q: string) => () => matchLocations(locations, q)

  it.each([
    ['a one-character query', 'e'],
    ['an ordinary query', 'ace 00'],
    ['a no-match', 'zzqxv'],
  ])('%s', (_label, q) => {
    const { perCall } = bestPerCallCpuMs([speciesHalf(q), locationHalf(q)], { rounds: ROUNDS })
    if (REPORT) console.log(`HALVES ${q}: species ${perCall[0].toFixed(4)} ms, location ${perCall[1].toFixed(4)} ms, ratio ${(perCall[1] / perCall[0]).toFixed(3)}`)
    expect(perCall[1] / perCall[0], `location ${perCall[1].toFixed(4)} ms against species ${perCall[0].toFixed(4)} ms`).toBeLessThanOrEqual(1)
  }, TIMEOUT_MS)
})
