// Search's location results (visited-hotspots-in-search, schema section 2): the
// locations in the user's own eBird backup, derived once per loaded file from the
// shared parse, and the per-keystroke match over them.
//
// Pure: no I/O, no clock, no React, no network import. The ONE module-scoped
// collection is the `WeakMap` memo below; every other top-level binding is a
// numeric counter for the test seams (`paletteLocationsLifetime.test.ts` holds
// that shape, comments stripped).
//
// A SECOND DERIVATION OF THE HOTSPOT REPORTS RULE, BY DECISION (schema 2.2, 0.6).
// `buildLocationIndex` (lib/hotspotReports.ts) builds per-row columns, species
// tables and media joins Search never reads; at the realistic cap its first call
// sat on R2's 50 ms line and it retains more than R4's 5 MB in JavaScriptCore.
// This pass keeps only what a row shows and what the request carries. Its
// equality with the tab's set, names, places, namesake marks and order is
// MEASURED, both directions, over a generated corpus put through the real parser
// (`paletteLocationsParity.test.ts`), not argued. The tab's own bounds and
// helpers are imported by identity, never restated.
//
// DECLARED SCANS (schema 9.1; `.claude/rules/security.md` gates this file through
// `frontend/src/lib/paletteLocations*.ts`):
//   L1 the rows: one loop over the observations, one `Set.add` per row on the
//      Submission ID, recorded at FIRST SIGHT before any test of its location
//      (security.md v1.0.40), so only a checklist's first row goes further.
//   L2 the record: the tab's bounded reads, length first (200, 96, 16).
//   L3 the order and the namesake runs: one `localeCompare` sort over the
//      distinct locations (L log L, L <= rows), then one adjacent walk.
//   L4 the column: one `toLowerCase` per location over at most 200 units, a
//      running length held under LOCATION_COLUMN_MAX_CHARS, one `join`.
//   L5 the match: at most cap + 1 native searches, each resuming where the last
//      location ended (see `matchLocations`).
// No regex anywhere. Every table keyed on file text is a `Set`. No loop is
// driven by a number read from a cell, and no composite key is built from two
// cells.

import type { ObservationEntry } from '../types'
import { boundText, LOCATION_ID_MAX_CHARS, LOCATION_NAME_MAX_CHARS } from './hotspotReports'
import { placeOf, STATE_CODE_SCAN_CHARS } from './lifeLists'
import { COUNTY_CELL_MAX_CHARS } from './lifeListsRegion'
import { UNNAMED_LOCATION } from './hotspotReportsCopy'

/** FR-12: location rows shown for one query. A number the file cannot change. */
export const LOCATION_CAP = 50
/** FR-10: a normalized query longer than this matches no location. The tab's
 *  name bound, by identity, so no bounded name can contain a longer query. */
export const LOCATION_QUERY_MAX_CHARS = LOCATION_NAME_MAX_CHARS
/** Schema 2.6: the column's own ceiling, 2^28 code units, half of V8's longest
 *  string. No file can move it. Past it the derivation refuses whole (FR-25)
 *  rather than ask the engine for a string it may not make, or offer part of
 *  the backup without saying so (FR-04). This is the second bound of
 *  security.md v1.0.57: the column is sized by the names' text and capped by a
 *  number that text cannot inflate. */
export const LOCATION_COLUMN_MAX_CHARS = 0x10000000
/** A line feed. A single-line input never holds one, so no query can span two
 *  names; `starts` is built from lengths, never by searching for this. */
export const COLUMN_SEP = '\n'
/** FR-25: the derivation could not run for a backup that loaded. */
export const LOCATION_INDEX_FAILED = 'palette-locations-failed'

export interface SearchLocation {
  /** The Location ID cell, 1..16 code units, exactly as parsed. */
  readonly locationId: string
  /** The Location cell through boundText(..., 200); '' when the cell is empty. */
  readonly name: string
  /** The cell was longer than the bound; the surface writes the ellipsis. */
  readonly truncated: boolean
  /** placeOf(county, stateProvince): "County, ST" | "County" | "ST" | ''. */
  readonly place: string
  /** The tab's namesake rule (FR-14), over the whole backup. */
  readonly showId: boolean
}

export interface LocationSearchIndex {
  /** Every location, in FR-11's order (the tab's picker order). */
  readonly rows: readonly SearchLocation[]
  /** Every search text in that order, each followed by COLUMN_SEP. */
  readonly column: string
  /** Length rows.length + 1; starts[k] is where row k's text begins. */
  readonly starts: Int32Array
}

interface MutableLocation {
  locationId: string
  name: string
  truncated: boolean
  place: string
  showId: boolean
}

let builds = 0
let searches = 0

/** Test seam: derivations run since the module loaded (R2, QA-07). */
export function _locationSearchBuilds(): number { return builds }
/** Test seam: native column searches made (R1, QA-41). */
export function _columnSearches(): number { return searches }
export function _resetColumnSearches(): void { searches = 0 }

function compareId(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}

/** The tab's picker comparator (`buildLocationIndex`, H3), copied: unnamed after
 *  named, then name, then place, both by `localeCompare`, then the Location ID by
 *  code unit, which is unique, so the order is total and file order cannot show. */
function compareLocations(a: MutableLocation, b: MutableLocation): number {
  const aUnnamed = a.name === ''
  if (aUnnamed !== (b.name === '')) return aUnnamed ? 1 : -1
  const byName = a.name.localeCompare(b.name)
  if (byName !== 0) return byName
  const byPlace = a.place.localeCompare(b.place)
  if (byPlace !== 0) return byPlace
  return compareId(a.locationId, b.locationId)
}

/** L2: the record, from the location's first checklist's first row, through the
 *  tab's own bounded reads in the tab's own order (`newRecord` in hotspotReports.ts). */
function newRecord(id: string, o: ObservationEntry): MutableLocation {
  const raw = typeof o.location === 'string' ? o.location : ''
  const { text: name, truncated } = boundText(raw, LOCATION_NAME_MAX_CHARS)
  const county = typeof o.county === 'string' && o.county.length <= COUNTY_CELL_MAX_CHARS ? o.county : ''
  const sp = o.stateProvince
  const stateProvince = typeof sp === 'string' && sp.length > 0 && sp.length <= STATE_CODE_SCAN_CHARS ? sp : null
  return { locationId: id, name, truncated, place: placeOf(county, stateProvince), showId: false }
}

/**
 * The location pass (L1 to L4). Throws only when the column would pass
 * `columnMax`; `columnMax` is overridable for tests and production always uses
 * LOCATION_COLUMN_MAX_CHARS.
 *
 * The index holds strings, booleans and one typed array: never an
 * `ObservationEntry` and never the array, so it keeps nothing of the parse alive.
 */
export function buildLocationSearchIndex(
  obs: readonly ObservationEntry[],
  columnMax: number = LOCATION_COLUMN_MAX_CHARS,
): LocationSearchIndex {
  builds += 1
  const seenSubs = new Set<string>()
  const seenIds = new Set<string>()
  const recs: MutableLocation[] = []
  for (let i = 0; i < obs.length; i++) {
    const o = obs[i]
    const sub = o.submissionId
    // An empty Submission ID changes nothing (FR-05).
    if (typeof sub !== 'string' || sub === '') continue
    // Recorded at first sight, usable or not: a checklist whose first row has no
    // usable Location ID is decided once and never re-examined.
    const subsBefore = seenSubs.size
    seenSubs.add(sub)
    if (seenSubs.size === subsBefore) continue
    const id = o.locationId
    // A length read before the ID is hashed.
    if (typeof id !== 'string' || id.length === 0 || id.length > LOCATION_ID_MAX_CHARS) continue
    const idsBefore = seenIds.size
    seenIds.add(id)
    if (seenIds.size === idsBefore) continue
    recs.push(newRecord(id, o))
  }

  // L3: the order, then the tab's showId rule verbatim: every run of two or more
  // adjacent records whose name and place both compare equal by localeCompare.
  // Both over the whole backup, never over a query's matches (FR-14).
  recs.sort(compareLocations)
  const L = recs.length
  let runStart = 0
  for (let k = 1; k <= L; k++) {
    const same = k < L
      && recs[k].name.localeCompare(recs[runStart].name) === 0
      && recs[k].place.localeCompare(recs[runStart].place) === 0
    if (same) continue
    if (k - runStart >= 2) for (let j = runStart; j < k; j++) recs[j].showId = true
    runStart = k
  }

  // L4: the search text is the bounded name without the ellipsis, or the
  // placeholder for an empty name (FR-10), lowercased once here so no keystroke
  // lowercases or sorts anything.
  const parts: string[] = new Array(L)
  const starts = new Int32Array(L + 1)
  let at = 0
  for (let k = 0; k < L; k++) {
    const name = recs[k].name
    const text = (name === '' ? UNNAMED_LOCATION : name).toLowerCase()
    parts[k] = text
    starts[k] = at
    at += text.length + 1
    if (at > columnMax) throw new Error('LOCATION_COLUMN_TOO_LONG')
  }
  starts[L] = at
  const column = L === 0 ? '' : parts.join(COLUMN_SEP) + COLUMN_SEP
  return { rows: recs, column, starts }
}

// ── The memo (schema 2.4, NFR-04, Key Decision 7) ────────────────────────────
//
// WHY A `WeakMap` KEYED ON THE OBSERVATIONS ARRAY'S IDENTITY, AND WHY THE INDEX
// CANNOT OUTLIVE ITS PARSE.
//
// What holds the index: this map, and, while Search is open, the overlay's own
// state. A WeakMap entry's value is reachable through the map only while its KEY
// is reachable from somewhere else. The key's long-lived holders are
// observationsCache.ts's `cache` slot, which `clearEbirdObservationsCache()`
// empties on every save, replace and clear, and each mounted tab's ready phase,
// which every tab replaces on the files epoch. Once the parse is replaced or
// cleared and those have let go, nothing reaches the old array and nothing
// reaches its index. There is no teardown to call and none to forget.
//
// Why identity: `loadEbirdObservations` hands back the same array for the life of
// its cache, so the identity changes exactly when the parse does. There is at
// most one live parse, so nothing alternates and nothing is evicted.
//
// Why NOT the species index's shape (a WeakRef on the source beside a STRONG slot
// for the index, lib/speciesIndex.ts): that slot keeps the last index alive after
// its parse has gone, until the next build. For about a thousand name pairs that
// is nothing; a hand-built file makes this index 150,000 rows and a column of
// tens of megabytes, which would then be held after a Clear for the rest of the
// session. `paletteLocationsLifetime.test.ts` runs that shape as its control leg
// and finds it retained, where this map's entry is collected.
//
// Why NOT a WeakRef on the index: nothing but an open overlay holds the index, so
// the engine could collect it between two opens and the next open would derive
// again, which R2 forbids.
//
// The overlay's half of the bargain: it sets its location state back to none in
// the same update that sets the species half to pending on a files-epoch change,
// and drops any observations it holds for the first frame in that effect's
// cleanup. Closed, the overlay is unmounted and holds nothing.
//
// A build that throws stores LOCATION_INDEX_FAILED, so a failing file is
// attempted once per parse and never again (R2's zero derivations on later opens
// holds for a failure too).
//
// `WeakMap` is cleared for every shipped target: it predates `WeakRef`, which
// speciesIndex.ts already cleared against the macOS and iOS minimums and the
// Android WebView floor.
const memo = new WeakMap<object, LocationSearchIndex | typeof LOCATION_INDEX_FAILED>()

/** The index for this parse: built at most once per array identity. Never throws. */
export function locationSearchIndexFor(
  obs: readonly ObservationEntry[],
): LocationSearchIndex | typeof LOCATION_INDEX_FAILED {
  const hit = memo.get(obs)
  if (hit !== undefined) return hit
  let value: LocationSearchIndex | typeof LOCATION_INDEX_FAILED
  try {
    value = buildLocationSearchIndex(obs)
  } catch {
    value = LOCATION_INDEX_FAILED
  }
  memo.set(obs, value)
  return value
}

/** The memo's value for this parse, or undefined. Does no work. */
export function peekLocationSearchIndex(
  obs: readonly ObservationEntry[],
): LocationSearchIndex | typeof LOCATION_INDEX_FAILED | undefined {
  return memo.get(obs)
}

// ── The match (L5, schema 2.5) ───────────────────────────────────────────────

export interface LocationMatch {
  readonly rows: SearchLocation[]
  readonly truncated: boolean
}

/**
 * The locations whose search text contains `q`, in index order, cut at `cap`.
 * `q` is the query ALREADY normalized by `normalizeSpeciesQuery` (trimmed,
 * lowercased); it never becomes a RegExp.
 *
 * END BOUND OF THE NATIVE SEARCH (security.md v1.0.39): `indexOf(q, from)` has no
 * end parameter, and its end bound here is the end of the column, by design: the
 * column IS the bounded input (every name cut to 200 before it was written, the
 * whole capped at LOCATION_COLUMN_MAX_CHARS). The calls partition it, because
 * each starts where the previous hit's location ended, so a keystroke examines
 * each code unit at most once plus at most q.length of look-ahead per call. The
 * absence case is one call over the whole column, the cheapest case.
 *
 * No hit can span two names: that needs q to hold the separator, and such a q
 * is refused before any search. County, state, place label and Location ID are
 * not in the column, so they cannot match.
 */
export function matchLocations(index: LocationSearchIndex, q: string, cap: number = LOCATION_CAP): LocationMatch {
  const out: SearchLocation[] = []
  // The separator check reads at most LOCATION_QUERY_MAX_CHARS units: the length
  // test runs first.
  if (q === '' || q.length > LOCATION_QUERY_MAX_CHARS || q.indexOf(COLUMN_SEP) !== -1) {
    return { rows: out, truncated: false }
  }
  const { column, starts, rows } = index
  const L = rows.length
  let from = 0
  let lo = 0
  while (lo < L) {
    searches += 1
    const hit = column.indexOf(q, from)
    if (hit === -1) break
    // The location holding `hit`: the last k in [lo, L) with starts[k] <= hit.
    let a = lo
    let b = L - 1
    while (a < b) {
      const mid = (a + b + 1) >> 1
      if (starts[mid] <= hit) a = mid
      else b = mid - 1
    }
    // The cut is after ordering: one more hit past the cap only sets the flag.
    if (out.length === cap) return { rows: out, truncated: true }
    out.push(rows[a])
    lo = a + 1
    from = starts[lo]
  }
  return { rows: out, truncated: false }
}
