// LINEARITY of the Hotspot Reports passes (hotspot-reports NFR-02, QA-64,
// QA-65; schema 13.1).
//
// Every pass runs on the main thread (the index inside the tab's load effect,
// the facts per selection, the filter per keystroke), so a superlinear pass is a
// frozen window rather than a slow function. Each row times its pass at a small
// and a large leg through the shared CPU-time helper (src/test/cpuTiming.ts),
// interleaved with a rotating start, and the per-call quotient must stay at or
// under its limit: the flat 20 (linear is 10, the house 2x margin), or, where
// the pass SORTS a count that grows with the leg, a limit derived from n log n
// in the row as `2 x (rows ratio) x log2(large sorted) / log2(small sorted)`,
// computed from the counts each leg actually sorts (security.md v1.0.63).
//
// LEGS AT 500 / 5,000 (schema 13.1): CI's shared runners read about twice this
// Mac, and the large legs here stay cache-resident. Inputs are built flat
// (`[...].join('')`) and before any timing (testing.md v1.0.46); no pass of this
// feature memoizes, so a leg re-running one input measures work, not a hit. A
// small leg under the helper's 0.05 ms floor would under-report its quotient
// (testing.md v1.0.63), so such a row repeats its work a fixed number of times
// per call, which lifts the small leg without changing what is measured, and
// every row asserts its small leg sits above the floor. Each row prints its raw
// quotient in its failure message.
//
// THE THREE HOSTILE SHAPES NFR-02 names are the first, third and fifth rows:
// every row its own location; one location holding every row; every checklist
// of one location carrying a weather block.
//
// NON-VACUITY: three mutants live in THIS file, never in the modules (schema
// 13.1): pass I with its Location ID lookup as a linear search over the
// records, the facts with their (species, checklist) dedupe as an array search,
// and the ML join with its checklist lookup as an array search. Each must
// exceed its row's limit at the same legs. A capped replica over 1,000 rows
// runs first, so a hang cannot sit behind the timeout (testing.md v1.0.33).

import { describe, it, expect } from 'vitest'
import type { ObservationEntry } from '../types'
import type { MLExportRow } from './parseMLExport'
import { bestPerCallCpuMs } from '../test/cpuTiming'
import { row, mlRow } from '../test/hotspotReportsRows'
import { formatWeather, type HourlyResponse } from './weatherFormatter'
import { buildLocationIndex, deriveMediaCounts, rankLocations, speciesTotals, type LocationIndex } from './hotspotReports'
import { applySpeciesRule, deriveLocationFacts } from './hotspotReportsLocation'
import { filterLocations } from './hotspotReportsPicker'
import { confirmEscapeesIndexed } from './hotspotReportsProvenance'
import { normalizeSpeciesName, isNonCountableForm } from './speciesUtils'

const SMALL = 500
const LARGE = 5_000
const LIMIT = 20
const ROUNDS = 7
const FLOOR_MS = 0.05
/** The escapee row's own legs (decisions.md D-06): at 500 / 5,000 it read 0.64
 *  and 0.65 of the limit under a 1MB young generation, at the schema's 0.65
 *  acceptance, so its legs shrink and the limit does not move. */
const LOOKUP_SMALL = 300
const LOOKUP_LARGE = 3_000
const TIMEOUT_MS = 120_000

const sortLimit = (s: number, l: number) => 2 * (l / s) * (Math.log2(l) / Math.log2(s))

/** One definition of the quotient procedure for the shipped passes and the mutants. */
function measure(small: () => unknown, large: () => unknown): { quotient: number; raw: number; smallMs: number } {
  const { perCall } = bestPerCallCpuMs([small, large], { rounds: ROUNDS })
  return { quotient: perCall[1] / Math.max(perCall[0], FLOOR_MS), raw: perCall[1] / perCall[0], smallMs: perCall[0] }
}

function check(label: string, m: { quotient: number; raw: number; smallMs: number }, limit: number) {
  // The readings recorded in decisions.md (D-06) come from this line.
  if (process.env.SR_LINEARITY_REPORT === '1') console.log(`LINEARITY ${label}: ${m.quotient.toFixed(2)} raw ${m.raw.toFixed(2)} limit ${limit.toFixed(1)} ratio ${(m.quotient / limit).toFixed(2)} small ${m.smallMs.toFixed(3)}ms`)
  expect(m.smallMs, `${label}: the small leg (${m.smallMs.toFixed(4)} ms) is under the quotient floor`).toBeGreaterThan(FLOOR_MS)
  expect(m.quotient, `${label}: ${m.quotient.toFixed(2)} (raw ${m.raw.toFixed(2)}) against ${limit.toFixed(1)}`).toBeLessThanOrEqual(limit)
}

/** A deterministic permutation, so location names arrive in no sorted order. */
function scrambled(i: number, n: number): number {
  return (i * 7919 + 13) % n
}
const pad = (n: number, w: number) => String(n).padStart(w, '0')

/** Every row its own location, checklist and (optionally) species. */
function everyRowItsOwn(n: number, speciesMod: number | null): ObservationEntry[] {
  return Array.from({ length: n }, (_, i) => row({
    submissionId: ['S', String(1_000_000 + i)].join(''),
    locationId: ['L', String(1_000_000 + i)].join(''),
    location: ['Place ', pad(scrambled(i, n), 6)].join(''),
    commonName: ['Species ', String(speciesMod === null ? i : i % speciesMod)].join(''),
  }))
}

/** One location holds every row: checklists of seven rows, 200 species. */
function oneLocation(n: number): ObservationEntry[] {
  return Array.from({ length: n }, (_, i) => row({
    submissionId: ['S', String(1_000_000 + Math.floor(i / 7))].join(''),
    locationId: 'L1',
    commonName: ['Species ', String(i % 200)].join(''),
    date: `20${10 + (i % 10)}-0${1 + (i % 9)}-1${i % 10}`,
  }))
}

/** The realistic shape: 300 locations, checklists of seven rows. */
function realistic(n: number): ObservationEntry[] {
  return Array.from({ length: n }, (_, i) => {
    const c = Math.floor(i / 7)
    return row({
      submissionId: ['S', String(1_000_000 + c)].join(''),
      locationId: ['L', String(c % 300)].join(''),
      location: ['Place ', pad(c % 300, 3)].join(''),
      commonName: ['Species ', String(i % 400)].join(''),
    })
  })
}

const TZ = 'America/New_York'
function blockFor(i: number): string {
  const h: HourlyResponse = {
    data: [{
      dt: 1716570000 + i * 86_400, temp: 30 + (i % 60), humidity: 70, dew_point: 50, wind_speed: 2 + (i % 20), wind_deg: (i * 37) % 360,
      clouds: (i * 13) % 100, weather: [{ id: [800, 801, 802, 803, 804, 500, 600][i % 7], description: 'x' }], sunrise: 1716550000, sunset: 1716600000,
    }],
  }
  return formatWeather([h], TZ, 40.6)
}
/** One location, every checklist (three rows each) carrying a weather block. */
function blockHeavy(n: number): ObservationEntry[] {
  const out: ObservationEntry[] = []
  for (let i = 0; i < n; i++) {
    const c = Math.floor(i / 3)
    out.push(row({
      submissionId: ['S', String(1_000_000 + c)].join(''), locationId: 'L1',
      commonName: ['Species ', String(i % 150)].join(''), checklistComments: ['Morning walk. ', blockFor(c)].join(''),
      date: `20${10 + (c % 10)}-0${1 + (c % 9)}-1${c % 10}`,
    }))
  }
  return out
}

describe('the Hotspot Reports passes are linear in rows (NFR-02, QA-64)', () => {
  it('pass I, every row its own location, checklist and species (limit from L log L)', () => {
    const [s, l] = [everyRowItsOwn(SMALL, null), everyRowItsOwn(LARGE, null)]
    check('pass I distinct', measure(() => buildLocationIndex(s), () => buildLocationIndex(l)), sortLimit(SMALL, LARGE))
  }, TIMEOUT_MS)

  it('pass I, every row its own location, 200 species (limit from L log L)', () => {
    const [s, l] = [everyRowItsOwn(SMALL, 200), everyRowItsOwn(LARGE, 200)]
    check('pass I 200 species', measure(() => buildLocationIndex(s), () => buildLocationIndex(l)), sortLimit(SMALL, LARGE))
  }, TIMEOUT_MS)

  it('pass I, one location holds every row (flat limit)', () => {
    const [s, l] = [oneLocation(SMALL), oneLocation(LARGE)]
    check('pass I one location', measure(() => buildLocationIndex(s), () => buildLocationIndex(l)), LIMIT)
  }, TIMEOUT_MS)

  it('pass I, 300 locations, the realistic shape (flat limit)', () => {
    const [s, l] = [realistic(SMALL), realistic(LARGE)]
    check('pass I realistic', measure(() => buildLocationIndex(s), () => buildLocationIndex(l)), LIMIT)
  }, TIMEOUT_MS)

  it('the facts and weather, one location with every checklist carrying a block (limit from C log C)', () => {
    const [s, l] = [blockHeavy(SMALL), blockHeavy(LARGE)]
    const [is, il] = [buildLocationIndex(s), buildLocationIndex(l)]
    const [cs, cl] = [is.checklistCount[0], il.checklistCount[0]]
    expect(deriveLocationFacts(il, l, 0).weather.readableCount).toBe(cl)
    check('facts and weather', measure(() => deriveLocationFacts(is, s, 0), () => deriveLocationFacts(il, l, 0)), sortLimit(cs, cl))
  }, TIMEOUT_MS)

  it('the per-keystroke filter, every row its own location, names at the bound sharing a prefix (flat limit)', () => {
    const prefix = 'a'.repeat(192)
    const build = (n: number) => buildLocationIndex(Array.from({ length: n }, (_, i) => row({
      submissionId: ['S', String(i)].join(''), locationId: ['L', String(i)].join(''), location: [prefix, pad(scrambled(i, n), 8)].join(''),
    })))
    const [is, il] = [build(SMALL), build(LARGE)]
    const QUERIES = Array.from({ length: 32 }, (_, k) => ['', 'aaaa', 'zzz', ['a'.repeat(99), 'z'].join('')][k % 4])
    const run = (ix: LocationIndex) => { let m = 0; for (const q of QUERIES) m += filterLocations(ix, q, null).matches; return m }
    check('filter', measure(() => run(is), () => run(il)), LIMIT)
  }, TIMEOUT_MS)

  it('the species rule over 500 and 5,000 species at one location (limit from S log S)', () => {
    const build = (n: number) => {
      const rows = Array.from({ length: n }, (_, i) => row({
        submissionId: ['S', String(Math.floor(i / 4))].join(''), locationId: 'L1', commonName: ['Species ', String(i)].join(''),
        date: `20${10 + (i % 10)}-0${1 + (i % 9)}-1${i % 10}`,
      }))
      const index = buildLocationIndex(rows)
      return deriveLocationFacts(index, rows, 0)
    }
    const [fs, fl] = [build(SMALL), build(LARGE)]
    const escapees = new Set(Array.from({ length: 10 }, (_, k) => ['Species ', String(k * 7)].join('')))
    const REPEAT = 4
    const run = (f: ReturnType<typeof build>) => { let t = 0; for (let r = 0; r < REPEAT; r++) t += applySpeciesRule(f, escapees).total; return t }
    check('species rule', measure(() => run(fs), () => run(fl)), sortLimit(SMALL, LARGE))
  }, TIMEOUT_MS)

  it('the ML join, each asset citing its own checklist at one of 200 locations (flat limit)', () => {
    // Locations held at 200, so the per-location counts the call allocates do
    // not grow with the leg; what grows is the ML rows and the checklists they
    // cite, which is the per-row lookup this row exists for (decisions.md D-06).
    const build = (n: number) => {
      const rows = Array.from({ length: n }, (_, i) => row({
        submissionId: ['S', String(1_000_000 + i)].join(''), locationId: ['L', String(i % 200)].join(''),
        location: ['Place ', pad(i % 200, 3)].join(''), commonName: ['Species ', String(i % 300)].join(''),
      }))
      const ml: MLExportRow[] = rows.map((r, i) => mlRow({ catalogId: String(i), checklistId: r.submissionId, format: (['Photo', 'Audio', 'Video'] as const)[i % 3] }))
      return { index: buildLocationIndex(rows), ml }
    }
    const [bs, bl] = [build(SMALL), build(LARGE)]
    const REPEAT = 16
    const run = (b: ReturnType<typeof build>) => { let t = 0; for (let r = 0; r < REPEAT; r++) t += deriveMediaCounts(b.ml, b.index).length; return t }
    check('ML join', measure(() => run(bs), () => run(bl)), LIMIT)
  }, TIMEOUT_MS)

  it('the overview totals and ranks over 500 and 5,000 locations with 50 escapee species (flat limit)', () => {
    const build = (n: number) => buildLocationIndex(Array.from({ length: n * 2 }, (_, i) => row({
      submissionId: ['S', String(i)].join(''), locationId: ['L', String(Math.floor(i / 2))].join(''),
      location: ['Place ', pad(scrambled(Math.floor(i / 2), n), 6)].join(''), commonName: i % 2 === 0 ? ['Esc ', String(i % 50)].join('') : 'Song Sparrow',
    })))
    const [is, il] = [build(SMALL), build(LARGE)]
    const escapees = new Set(Array.from({ length: 50 }, (_, k) => ['Esc ', String(k)].join('')))
    const REPEAT = 8
    const run = (ix: LocationIndex) => { let t = 0; for (let r = 0; r < REPEAT; r++) t += rankLocations(ix, speciesTotals(ix, escapees)).byChecklists.length; return t }
    check('overview', measure(() => run(is), () => run(il)), LIMIT)
  }, TIMEOUT_MS)

  it('the escapee confirmation, 50 published names whose carriers grow (flat limit, 300 / 3,000)', () => {
    const build = (n: number) => {
      const rows = Array.from({ length: n }, (_, i) => row({ submissionId: ['S', String(i)].join(''), locationId: 'L1', commonName: ['Esc ', String(i % 50)].join('') }))
      return { rows, index: buildLocationIndex(rows), consulted: new Set(rows.map(r => r.submissionId)) }
    }
    const [bs, bl] = [build(LOOKUP_SMALL), build(LOOKUP_LARGE)]
    const published = Array.from({ length: 50 }, (_, k) => ['Esc ', String(k)].join(''))
    const REPEAT = 24
    const run = (b: ReturnType<typeof build>) => { let t = 0; for (let r = 0; r < REPEAT; r++) t += confirmEscapeesIndexed(published, b.consulted, b.index, b.rows).size; return t }
    check('escapee confirmation', measure(() => run(bs), () => run(bl)), LIMIT)
  }, TIMEOUT_MS)
})

// ── Non-vacuity: three plausible wrong implementations, which must go red ────

/** Pass I's location lookup as a linear search over the records. */
function mutantPassI(obs: readonly ObservationEntry[]): Int32Array {
  const ids: string[] = []
  const rowLoc = new Int32Array(obs.length)
  const seen = new Map<string, number>()
  for (let i = 0; i < obs.length; i++) {
    const o = obs[i]
    if (!isNonCountableForm(o.commonName)) normalizeSpeciesName(o.commonName)
    let loc = seen.get(o.submissionId)
    if (loc === undefined) {
      loc = -1
      for (let k = 0; k < ids.length; k++) if (ids[k] === o.locationId) { loc = k; break }
      if (loc === -1) { loc = ids.length; ids.push(o.locationId) }
      seen.set(o.submissionId, loc)
    }
    rowLoc[i] = loc
  }
  return rowLoc
}

/** The facts' (species, checklist) dedupe as an array search. */
function mutantFacts(obs: readonly ObservationEntry[]): number {
  const pairs: string[][] = []
  for (const o of obs) {
    const n = normalizeSpeciesName(o.commonName)
    let found = false
    for (const p of pairs) if (p[0] === n && p[1] === o.submissionId) { found = true; break }
    if (!found) pairs.push([n, o.submissionId])
  }
  return pairs.length
}

/** The ML join's checklist lookup as an array search. */
function mutantJoin(ml: readonly MLExportRow[], checklists: readonly [string, number][]): number {
  let hits = 0
  for (const r of ml) {
    for (const [sub, loc] of checklists) if (sub === r.checklistId && loc >= 0) { hits++; break }
  }
  return hits
}

describe('the linearity rows can reject a quadratic (non-vacuity)', () => {
  it('pass I with a linear search over the records exceeds its limit', () => {
    mutantPassI(everyRowItsOwn(1_000, null))
    const [s, l] = [everyRowItsOwn(SMALL, null), everyRowItsOwn(LARGE, null)]
    expect(measure(() => mutantPassI(s), () => mutantPassI(l)).quotient).toBeGreaterThan(sortLimit(SMALL, LARGE))
  }, TIMEOUT_MS)

  it('the facts with an array-search dedupe exceed their limit', () => {
    mutantFacts(everyRowItsOwn(1_000, null))
    const [s, l] = [everyRowItsOwn(SMALL, null), everyRowItsOwn(LARGE, null)]
    expect(measure(() => mutantFacts(s), () => mutantFacts(l)).quotient).toBeGreaterThan(LIMIT)
  }, TIMEOUT_MS)

  it('the ML join with an array-search lookup exceeds its limit', () => {
    const build = (n: number) => {
      const rows = everyRowItsOwn(n, 200)
      const index = buildLocationIndex(rows)
      return { ml: rows.map((r, i) => mlRow({ catalogId: String(i), checklistId: r.submissionId })), list: [...index.checklistLoc] }
    }
    const replica = build(1_000)
    mutantJoin(replica.ml, replica.list)
    const [bs, bl] = [build(LOOKUP_SMALL), build(LOOKUP_LARGE)]
    expect(measure(() => mutantJoin(bs.ml, bs.list), () => mutantJoin(bl.ml, bl.list)).quotient).toBeGreaterThan(LIMIT)
  }, TIMEOUT_MS)
})

describe('the overview at 150,000 distinct locations (QA-65)', () => {
  it('derives, ranks ten per list and windows at most 200 options', () => {
    const rows = everyRowItsOwn(150_000, null)
    const index = buildLocationIndex(rows)
    const ranks = rankLocations(index, speciesTotals(index, new Set()))
    expect(ranks.byChecklists.length).toBe(10)
    expect(ranks.bySpecies.length).toBe(10)
    expect(filterLocations(index, '', null).ords.length).toBe(200)
    expect(filterLocations(index, 'place 1', null).ords.length).toBe(200)
  }, TIMEOUT_MS)
})
