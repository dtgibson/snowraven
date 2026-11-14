// Search's locations are the Hotspot Reports tab's locations (visited-hotspots-
// in-search FR-05, FR-06, FR-14, FR-40 b; QA-05, QA-06, QA-14; schema 10.2).
//
// `buildLocationSearchIndex` is a SECOND derivation of the tab's rule, by
// decision (schema 0.6), so its equality with `buildLocationIndex` is measured
// here, in both directions, over a generated corpus. Every file is CSV text put
// through the REAL parser and materializer (the path `loadEbirdObservations`
// takes), so no file has a shape the parse cannot produce, and the corpus opens
// with the seam's failure returns: an empty file, a file with no usable Location
// ID, a file whose every Submission ID is empty (testing.md, v1.0.32). Cells are
// drawn from hostile pools: prototype member names, case variants, canonically
// equivalent spellings in both forms, names at and past the bound, a surrogate
// pair at the cut, County and State/Province cells at and past their bounds, IDs
// at and past 16 units, a quoted multi-line name.
//
// NON-VACUITY: the named wrong derivation (a location per ROW rather than per
// checklist) must differ from the tab on some files, and the corpus must hold
// namesakes with the ID shown, truncated names and unnamed locations.
//
// Every non-ASCII probe is written as an escape.

import { describe, it, expect } from 'vitest'
import type { ObservationEntry } from '../types'
import { packEbirdObservations } from './parseEbirdObservations'
import { materializeObservations } from './observationsPacked'
import { buildLocationIndex, LOCATION_ID_MAX_CHARS, type LocationIndex } from './hotspotReports'
import { displayName, UNNAMED_LOCATION } from './hotspotReportsCopy'
import { buildLocationSearchIndex, matchLocations, LOCATION_CAP, LOCATION_QUERY_MAX_CHARS, type LocationSearchIndex } from './paletteLocations'
import { normalizeSpeciesQuery } from './speciesMatch'

const HEADER = [
  'Submission ID', 'Common Name', 'Scientific Name', 'Taxonomic Order', 'Count', 'State/Province', 'County',
  'Location ID', 'Location', 'Latitude', 'Longitude', 'Date', 'Time', 'Protocol', 'Duration (Min)',
  'All Obs Reported', 'Distance Traveled (km)', 'Area Covered (ha)', 'Number of Observers', 'Breeding Code',
  'Observation Details', 'Checklist Comments', 'ML Catalog Numbers',
].join(',')

function esc(v: string): string {
  return /[",\n\r]/.test(v) ? '"' + v.split('"').join('""') + '"' : v
}

function rng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const NAMES = [
  '', 'Pond', 'pond', 'POND', 'Prospect Park', 'Prospect Park',
  'Caf\u00E9 Marsh', 'Cafe\u0301 Marsh', '__proto__', 'constructor', 'toString',
  'Smith, John\'s "yard"', 'North Dike\nEast Pool',
  'a'.repeat(200), 'a'.repeat(230), 'b'.repeat(199) + '\uD83D\uDC26' + 'tail',
  'Backyard', 'Backyard', 'Jamaica Bay--West Pond', '\u0130stanbul Park',
]
const COUNTIES = ['', 'Kings', 'Kings', 'Queens', 'c'.repeat(96), 'c'.repeat(97), '__proto__']
const STATES = ['', 'US-NY', 'US-NY', 'US-CA', 'S'.repeat(16), 'S'.repeat(17), 'constructor']
const IDS = [
  'L1', 'L2', 'L3', 'l1', 'L4', 'L5', 'L6', 'L7', '', '__proto__', 'constructor',
  'L'.padEnd(LOCATION_ID_MAX_CHARS, '1'), 'L'.padEnd(LOCATION_ID_MAX_CHARS + 1, '1'),
]

function line(sub: string, id: string, name: string, county: string, state: string): string {
  return [esc(sub), 'Song Sparrow', 'Melospiza melodia', '100', '1', esc(state), esc(county), esc(id), esc(name),
    '40.5', '-73.5', '2024-05-01', '07:00 AM', 'Traveling', '60', '1', '1', '', '1', '', '', '', ''].join(',')
}

function parse(csv: string): ObservationEntry[] {
  return materializeObservations(packEbirdObservations(csv))
}

/** The corpus: the three failure returns first, then generated files. */
function corpus(files: number): string[] {
  const out: string[] = [
    HEADER,
    [HEADER, line('S1', '', 'Pond', 'Kings', 'US-NY'), line('S2', 'L'.padEnd(20, '9'), 'Lake', 'Kings', 'US-NY')].join('\n'),
    [HEADER, line('', 'L1', 'Pond', 'Kings', 'US-NY'), line('', 'L2', 'Lake', 'Kings', 'US-NY')].join('\n'),
  ]
  const r = rng(20261113)
  const pick = <T,>(xs: readonly T[]) => xs[Math.floor(r() * xs.length)]
  for (let f = 0; f < files; f++) {
    const lines = [HEADER]
    const checklists = Math.floor(r() * 24)
    for (let c = 0; c < checklists; c++) {
      const sub = r() < 0.05 ? '' : `S${Math.floor(r() * 30)}`
      const rows = 1 + Math.floor(r() * 3)
      for (let k = 0; k < rows; k++) {
        lines.push(line(sub, pick(IDS), pick(NAMES), pick(COUNTIES), pick(STATES)))
      }
    }
    out.push(lines.join('\n'))
  }
  return out
}

/** The tab's view of one location, by ID. */
function tabView(index: LocationIndex) {
  const byId = new Map<string, { name: string; truncated: boolean; place: string; showId: boolean }>()
  for (const rec of index.locations) {
    byId.set(rec.locationId, { name: rec.name, truncated: rec.truncated, place: rec.place, showId: index.showId[rec.ord] === 1 })
  }
  const order = Array.from(index.pickerOrder, ord => index.locations[ord].locationId)
  return { byId, order }
}

/** The named WRONG derivation: a location per row rather than per checklist. */
function perRowIds(obs: readonly ObservationEntry[]): Set<string> {
  const s = new Set<string>()
  for (const o of obs) {
    const id = o.locationId
    if (typeof o.submissionId === 'string' && o.submissionId !== '' && typeof id === 'string' && id.length > 0 && id.length <= LOCATION_ID_MAX_CHARS) s.add(id)
  }
  return s
}

/** FR-10 read literally, one location at a time. */
function literal(ix: LocationSearchIndex, q: string, cap: number): string[] {
  const out: string[] = []
  if (q === '' || q.length > LOCATION_QUERY_MAX_CHARS || q.includes('\n')) return out
  for (const r of ix.rows) {
    if (!(r.name === '' ? UNNAMED_LOCATION : r.name).toLowerCase().includes(q)) continue
    if (out.length === cap) { out.push('<truncated>'); return out }
    out.push(r.locationId)
  }
  return out
}

const QUERIES = ['p', 'pond', 'POND', 'park', 'caf', 'caf\u00E9', 'cafe\u0301', '__proto__', 'constructor',
  'unnamed', 'kings', 'us-ny', 'l1', 'a'.repeat(200), 'a'.repeat(201), 'tail', 'dike', 'east pool',
  'smith, john', '"yard"', 'i\u0307stanbul', 'backyard', 'zzz', ' ']

describe('Search\'s locations equal the tab\'s over a generated corpus (FR-05, FR-06, FR-14)', () => {
  const files = corpus(1_500)
  const tally = {
    files: files.length, locations: 0, showId: 0, truncated: 0, unnamed: 0,
    setDiff: 0, fieldDiff: 0, showIdDiff: 0, orderDiff: 0, matchDiff: 0, matchCalls: 0,
    wrongDerivationDiffers: 0,
  }
  for (const csv of files) {
    const obs = parse(csv)
    const tab = tabView(buildLocationIndex(obs))
    const search = buildLocationSearchIndex(obs)
    const searchIds = new Set(search.rows.map(r => r.locationId))
    // The set, both directions.
    for (const id of searchIds) if (!tab.byId.has(id)) tally.setDiff += 1
    for (const id of tab.byId.keys()) if (!searchIds.has(id)) tally.setDiff += 1
    // Name, truncation, place, the shown name, and the namesake mark, per ID.
    for (const r of search.rows) {
      const t = tab.byId.get(r.locationId)
      if (t === undefined) continue
      tally.locations += 1
      if (r.showId) tally.showId += 1
      if (r.truncated) tally.truncated += 1
      if (r.name === '') tally.unnamed += 1
      if (t.name !== r.name || t.truncated !== r.truncated || t.place !== r.place
        || displayName(t.name, t.truncated) !== displayName(r.name, r.truncated)) tally.fieldDiff += 1
      if (t.showId !== r.showId) tally.showIdDiff += 1
    }
    // The order against the tab's picker order.
    const order = search.rows.map(r => r.locationId)
    if (order.length !== tab.order.length || order.some((id, i) => id !== tab.order[i])) tally.orderDiff += 1
    // The match against the literal rule, at the real cap and at a cap of 2.
    for (const raw of QUERIES) {
      const q = normalizeSpeciesQuery(raw)
      for (const cap of [LOCATION_CAP, 2]) {
        tally.matchCalls += 1
        const m = matchLocations(search, q, cap)
        const got = m.rows.map(r => r.locationId)
        if (m.truncated) got.push('<truncated>')
        const want = literal(search, q, cap)
        if (got.length !== want.length || got.some((id, i) => id !== want[i])) tally.matchDiff += 1
      }
    }
    // The wrong derivation, for non-vacuity.
    const wrong = perRowIds(obs)
    if (wrong.size !== searchIds.size || [...wrong].some(id => !searchIds.has(id))) tally.wrongDerivationDiffers += 1
  }

  it('the corpus is not vacuous: namesakes, cut names and unnamed places all occur', () => {
    expect(tally.files).toBeGreaterThan(1_000)
    expect(tally.locations).toBeGreaterThan(5_000)
    expect(tally.showId).toBeGreaterThan(0)
    expect(tally.truncated).toBeGreaterThan(0)
    expect(tally.unnamed).toBeGreaterThan(0)
    expect(tally.matchCalls).toBeGreaterThan(50_000)
  })

  it('the named wrong derivation (a location per row) differs from the tab on some files', () => {
    expect(tally.wrongDerivationDiffers).toBeGreaterThan(0)
  })

  it('the set of Location IDs is equal in both directions', () => {
    expect(tally.setDiff).toBe(0)
  })

  it('name, truncation, place and the shown name are equal for every location', () => {
    expect(tally.fieldDiff).toBe(0)
  })

  it('the Location ID is shown exactly where the tab\'s picker shows it', () => {
    expect(tally.showIdDiff).toBe(0)
  })

  it('the order is the tab\'s picker order', () => {
    expect(tally.orderDiff).toBe(0)
  })

  it('the match equals the PRD\'s rule read literally, at the real cap and at a cap of 2', () => {
    expect(tally.matchDiff).toBe(0)
  })

  it('the failure returns lead the corpus and yield no location in either derivation', () => {
    for (const csv of files.slice(0, 3)) {
      const obs = parse(csv)
      expect(buildLocationSearchIndex(obs).rows).toEqual([])
      expect(buildLocationIndex(obs).locations).toEqual([])
    }
  })
})
