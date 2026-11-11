// The Hotspot Reports index (hotspot-reports schema section 2): one pass over
// the parsed observations that every figure on the tab reads from.
//
// Pure: no I/O, no clock, no React, no network import, no module-scoped mutable
// binding and no memo. The tab's `ready` phase is the only holder of what
// `buildLocationIndex` returns, so a replace or a clear leaves the previous
// index unreachable (NFR-04, schema 7.1).
//
// A LOCATION IS ITS LOCATION ID (FR-10), and which location a row counts at is
// decided by its CHECKLIST's first row in file order (FR-11): a later row of a
// located checklist counts there whatever its own Location ID cell holds, and
// every row of a checklist whose first row carries no usable id counts nowhere.
//
// Every table keyed on file text is a `Map` (Location IDs, Submission IDs,
// species names), so `__proto__` and `constructor` are ordinary keys
// (security.md, the v1.0.22 family). No composite string key exists in this
// module, so there is no delimiter to argue about.
//
// DECLARED SCANS (schema 12.1, `.claude/rules/security.md`): H1 the index pass,
// H2 the record's bounded fields, H3 the picker order, H8 the ML join, H10 the
// totals and ranks, H11 the name bound. Every read is a hand loop, a `Map`
// operation or a typed-array index: this module holds no regex and none of the
// search primitives whose absence case scans to the end of a string, and
// `hotspotReports.test.ts` asserts that absence with comments stripped. The one
// sort is over the distinct locations (L log L, L <= rows) and no loop is driven
// by a number read from a cell.

import type { ObservationEntry } from '../types'
import type { MLExportRow } from './parseMLExport'
import { normalizeSpeciesName, isNonCountableForm } from './speciesUtils'
import { dayKey, placeOf, STATE_CODE_SCAN_CHARS } from './lifeLists'
import { COUNTY_CELL_MAX_CHARS } from './lifeListsRegion'
import { regionName } from './regionNames'

// ── Bounds (schema 2.2, 12.3) ────────────────────────────────────────────────

/** FR-10: a Location ID longer than this names no location. Declared here and
 *  never imported from `hotspotRegionCache.ts`, which reaches the storage seam;
 *  `hotspotReports.test.ts` compares the two numbers. */
export const LOCATION_ID_MAX_CHARS = 16
/** FR-13: a location name is read and shown through this bound. */
export const LOCATION_NAME_MAX_CHARS = 200
/** FR-28, FR-29: each ranked list holds at most this many rows. */
export const RANKED_LIST_SIZE = 10

// ── Shapes ───────────────────────────────────────────────────────────────────

/** One location. `locationId` and `stateProvince` carry the names
 *  `ShareChecklist` uses, so `computeHotspotShare(index.locations, resolution)`
 *  takes this array as it is (FR-15). */
export interface LocationRecord {
  /** Position in `locations`: the only thing an id or a React key is built from. */
  readonly ord: number
  /** The Location ID cell, 1..16 code units, exactly as parsed. */
  readonly locationId: string
  /** The Location cell cut to LOCATION_NAME_MAX_CHARS; '' when the cell is empty. */
  readonly name: string
  /** The cell was longer than the bound; the surface writes the ellipsis. */
  readonly truncated: boolean
  /** The County cell when a string of at most COUNTY_CELL_MAX_CHARS, else ''. */
  readonly county: string
  /** The State/Province cell when a non-empty string of at most
   *  STATE_CODE_SCAN_CHARS, else null (so the kind is never "personal"). */
  readonly stateProvince: string | null
  /** placeOf(county, stateProvince): "County, ST" | "County" | "ST" | ''. */
  readonly place: string
  /** The full state or province name where `regionName` knows one, else ''. */
  readonly stateName: string
  /** FR-12: both null, or both finite and in range. */
  readonly lat: number | null
  readonly lng: number | null
  /** Lowercased `name \n place \n stateName`, built once (FR-19, schema 3.1). */
  readonly haystack: string
}

export interface LocationIndex {
  /** obs.length the index was built from. */
  readonly rowCount: number
  /** By ordinal, in first-appearance order. */
  readonly locations: readonly LocationRecord[]
  /** Location ID -> ordinal. */
  readonly ordById: ReadonlyMap<string, number>
  /** Submission ID -> ordinal, or -1 for a checklist with no location. */
  readonly checklistLoc: ReadonlyMap<string, number>

  // per-row columns, length rowCount
  /** The ordinal of the row's CHECKLIST's location, or -1. */
  readonly rowLoc: Int32Array
  /** The ordinal of the row's normalized countable name, or -1 for a
   *  non-countable form. */
  readonly rowSpecies: Int32Array
  /** dayKey(o.date), or 0 for an invalid date (dayKey is never 0). */
  readonly rowDay: Int32Array

  // row lists (compressed: a group is `rows[start[k] .. start[k + 1]]`)
  /** Length L + 1. */
  readonly locStart: Int32Array
  /** Row indexes grouped by location, FILE ORDER kept inside each group. */
  readonly locRows: Int32Array
  /** Ordinal -> normalized name ('' is possible and never eligible). */
  readonly speciesNames: readonly string[]
  readonly speciesOrd: ReadonlyMap<string, number>
  /** Length S + 1. */
  readonly spStart: Int32Array
  /** Every countable-form row grouped by species, located or not: the escapee
   *  carriers (schema section 6). */
  readonly spRows: Int32Array

  // per-location figures, length L
  /** FR-11: distinct non-empty Submission IDs whose first row names this location. */
  readonly checklistCount: Int32Array
  /** Distinct ELIGIBLE species, escapees included (schema 2.5). */
  readonly speciesBase: Int32Array

  // picker order, length L
  /** Ordinals in FR-20's order. */
  readonly pickerOrder: Int32Array
  /** Ordinal -> position in pickerOrder. */
  readonly rankOf: Int32Array
  /** 1 where another location shares both name and place (FR-21). */
  readonly showId: Uint8Array
}

export interface RankedRow { readonly ord: number; readonly checklists: number; readonly species: number }

// ── Bounded field reads (H2, H11) ────────────────────────────────────────────

const CH_HYPHEN = 45

function isHighSurrogate(c: number): boolean {
  return c >= 0xd800 && c <= 0xdbff
}

/**
 * The first `max` code units of `raw`, one fewer when the last kept unit is a
 * high surrogate, so no lone surrogate is ever shown (FR-13, FR-43). A length
 * read first, then one slice of at most `max` units.
 */
export function boundText(raw: string, max: number): { readonly text: string; readonly truncated: boolean } {
  if (raw.length <= max) return { text: raw, truncated: false }
  let cut = max
  if (cut > 0 && isHighSurrogate(raw.charCodeAt(cut - 1))) cut -= 1
  return { text: raw.slice(0, cut), truncated: true }
}

/**
 * The askable shape, by hand over at most 16 code units: uppercase letters,
 * digits and hyphens, which no prototype member name satisfies. Not an import
 * of `isAskableRegionCode`, which would pull `hotspotSet.ts` and `transport.ts`
 * into this module's closure (schema 2.4, QA-10).
 */
function isCodeShape(code: string): boolean {
  if (code.length === 0 || code.length > STATE_CODE_SCAN_CHARS) return false
  for (let i = 0; i < code.length; i++) {
    const c = code.charCodeAt(i)
    const upper = c >= 65 && c <= 90
    const digit = c >= 48 && c <= 57
    if (!upper && !digit && c !== CH_HYPHEN) return false
  }
  return true
}

/** The full state or province name, gated and checked: `regionName` reads its
 *  tables by bare key, so only a shape-checked cell reaches it and only a string
 *  answer that differs from the code is kept (the `lifeListsRegion.ts` form). */
function stateNameOf(stateProvince: string | null): string {
  if (stateProvince === null || !isCodeShape(stateProvince)) return ''
  const n: unknown = regionName(stateProvince)
  return typeof n === 'string' && n !== '' && n !== stateProvince ? n : ''
}

interface MutableRecord {
  ord: number
  locationId: string
  name: string
  truncated: boolean
  county: string
  stateProvince: string | null
  place: string
  stateName: string
  lat: number | null
  lng: number | null
  haystack: string
}

/** H2: one record per distinct location, built from its FIRST checklist's
 *  first row (FR-12). */
function newRecord(ord: number, id: string, o: ObservationEntry): MutableRecord {
  const raw = typeof o.location === 'string' ? o.location : ''
  const { text: name, truncated } = boundText(raw, LOCATION_NAME_MAX_CHARS)
  const county = typeof o.county === 'string' && o.county.length <= COUNTY_CELL_MAX_CHARS ? o.county : ''
  const sp = o.stateProvince
  const stateProvince = typeof sp === 'string' && sp.length > 0 && sp.length <= STATE_CODE_SCAN_CHARS ? sp : null
  const place = placeOf(county, stateProvince)
  const stateName = stateNameOf(stateProvince)
  return {
    ord, locationId: id, name, truncated, county, stateProvince, place, stateName,
    lat: null, lng: null,
    haystack: (name + '\n' + place + '\n' + stateName).toLowerCase(),
  }
}

function inRange(v: unknown, lo: number, hi: number): v is number {
  return typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi
}

// ── Eligibility, defined once (schema 2.5) ───────────────────────────────────

/**
 * A row that can establish a first sighting at its location (FR-33): it counts
 * at a location (so it carries a non-empty Submission ID), its name as exported
 * is a countable form, its normalized name is non-empty, and its own Date cell
 * is a valid `YYYY-MM-DD`. The index, the totals and the report all call this
 * one predicate, so the three cannot drift.
 */
export function isEligibleRow(index: LocationIndex, i: number): boolean {
  return eligibleAt(index, i)
}

/** The predicate's one spelling, over the four columns it reads, so the build
 *  can call it before the index object exists. */
function eligibleAt(
  cols: Pick<LocationIndex, 'rowLoc' | 'rowSpecies' | 'rowDay' | 'speciesNames'>, i: number,
): boolean {
  const s = cols.rowSpecies[i]
  return cols.rowLoc[i] >= 0 && s >= 0 && cols.speciesNames[s] !== '' && cols.rowDay[i] !== 0
}

// ── Pass I: the index (H1, H3) ───────────────────────────────────────────────

/** Stable counting sort of row indexes by a per-row key column (-1 skipped). */
function groupRows(keyOf: Int32Array, groups: number): { start: Int32Array; rows: Int32Array } {
  const start = new Int32Array(groups + 1)
  for (let i = 0; i < keyOf.length; i++) {
    const k = keyOf[i]
    if (k >= 0) start[k + 1] += 1
  }
  for (let k = 0; k < groups; k++) start[k + 1] += start[k]
  const cursor = start.slice(0, groups)
  const rows = new Int32Array(start[groups])
  for (let i = 0; i < keyOf.length; i++) {
    const k = keyOf[i]
    if (k >= 0) { rows[cursor[k]] = i; cursor[k] += 1 }
  }
  return { start, rows }
}

function compareId(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}

export function buildLocationIndex(obs: readonly ObservationEntry[]): LocationIndex {
  const n = obs.length
  const rowLoc = new Int32Array(n)
  const rowSpecies = new Int32Array(n)
  const rowDay = new Int32Array(n)
  const records: MutableRecord[] = []
  const ordById = new Map<string, number>()
  const checklistLoc = new Map<string, number>()
  const speciesNames: string[] = []
  const speciesOrd = new Map<string, number>()
  const checklistCounts: number[] = []

  for (let i = 0; i < n; i++) {
    const o = obs[i]
    // 1. The species column runs for EVERY row before any location test: the
    //    escapee confirmation counts every carrier of a name (schema section 6).
    const cn = o.commonName
    if (typeof cn === 'string' && !isNonCountableForm(cn)) {
      const norm = normalizeSpeciesName(cn)
      let s = speciesOrd.get(norm)
      if (s === undefined) { s = speciesNames.length; speciesNames.push(norm); speciesOrd.set(norm, s) }
      rowSpecies[i] = s
    } else {
      rowSpecies[i] = -1
    }
    // 2. The row's own date (the Life Lists rule).
    rowDay[i] = dayKey(o.date) ?? 0
    // 3. The checklist: an empty Submission ID changes no figure (FR-11).
    const sub = o.submissionId
    if (typeof sub !== 'string' || sub === '') { rowLoc[i] = -1; continue }
    let loc = checklistLoc.get(sub)
    if (loc === undefined) {
      // This row is the checklist's first in file order and decides everything.
      const id = o.locationId
      if (typeof id !== 'string' || id.length === 0 || id.length > LOCATION_ID_MAX_CHARS) {
        loc = -1
      } else {
        loc = ordById.get(id)
        if (loc === undefined) {
          loc = records.length
          records.push(newRecord(loc, id, o))
          ordById.set(id, loc)
          checklistCounts.push(0)
        }
        checklistCounts[loc] += 1
        const rec = records[loc]
        // FR-12: the first checklist whose cells are in range supplies the
        // coordinates; a later one never replaces them.
        if (rec.lat === null && inRange(o.latitude, -90, 90) && inRange(o.longitude, -180, 180)) {
          rec.lat = o.latitude
          rec.lng = o.longitude
        }
      }
      // Recorded for the -1 case too, so a rejected key is decided at first
      // sight and never re-examined (security.md, v1.0.40).
      checklistLoc.set(sub, loc)
    }
    rowLoc[i] = loc
  }

  const L = records.length
  const S = speciesNames.length
  const byLoc = groupRows(rowLoc, L)
  const bySp = groupRows(rowSpecies, S)

  const cols = { rowLoc, rowSpecies, rowDay, speciesNames }

  // speciesBase: distinct eligible species per location with one reusable stamp,
  // so no per-location Set is allocated.
  const speciesBase = new Int32Array(L)
  const stamp = new Int32Array(S).fill(-1)
  for (let loc = 0; loc < L; loc++) {
    let count = 0
    for (let k = byLoc.start[loc]; k < byLoc.start[loc + 1]; k++) {
      const r = byLoc.rows[k]
      if (!eligibleAt(cols, r)) continue
      const s = rowSpecies[r]
      if (stamp[s] !== loc) { stamp[s] = loc; count += 1 }
    }
    speciesBase[loc] = count
  }

  // H3: the picker order (FR-20). `localeCompare` directly, as the Region picker
  // orders its labels (measured faster than one Intl.Collator in both shipped
  // engines, schema 2.3). It never reads the kind, so rows cannot move when the
  // classification arrives.
  const order: number[] = new Array(L)
  for (let k = 0; k < L; k++) order[k] = k
  order.sort((a, b) => {
    const ra = records[a]
    const rb = records[b]
    const aUnnamed = ra.name === ''
    if (aUnnamed !== (rb.name === '')) return aUnnamed ? 1 : -1
    const byName = ra.name.localeCompare(rb.name)
    if (byName !== 0) return byName
    const byPlace = ra.place.localeCompare(rb.place)
    if (byPlace !== 0) return byPlace
    return compareId(ra.locationId, rb.locationId)
  })
  const pickerOrder = Int32Array.from(order)
  const rankOf = new Int32Array(L)
  for (let k = 0; k < L; k++) rankOf[pickerOrder[k]] = k

  // showId (FR-21): each run of adjacent records whose name and place compare
  // equal. Equality is `localeCompare === 0`, a superset of code-unit equality
  // that also joins canonically equivalent spellings, which render identically
  // and so need the id just as much; every exactly-equal pair is in one run
  // because the sort above orders by the same comparison. On the BOUNDED name,
  // which is what the row shows.
  const showId = new Uint8Array(L)
  let runStart = 0
  for (let k = 1; k <= L; k++) {
    const same = k < L
      && records[pickerOrder[k]].name.localeCompare(records[pickerOrder[runStart]].name) === 0
      && records[pickerOrder[k]].place.localeCompare(records[pickerOrder[runStart]].place) === 0
    if (same) continue
    if (k - runStart >= 2) for (let j = runStart; j < k; j++) showId[pickerOrder[j]] = 1
    runStart = k
  }

  return {
    rowCount: n,
    locations: records,
    ordById, checklistLoc,
    rowLoc, rowSpecies, rowDay,
    locStart: byLoc.start, locRows: byLoc.rows,
    speciesNames, speciesOrd,
    spStart: bySp.start, spRows: bySp.rows,
    checklistCount: Int32Array.from(checklistCounts),
    speciesBase,
    pickerOrder, rankOf, showId,
  }
}

// ── Pass M: the ML join (H8, FR-55) ──────────────────────────────────────────

/** Three counts per location (photo, audio, video), by the asset's linked
 *  checklist only: the ML row's locality, county and coordinates are never read. */
export function deriveMediaCounts(rows: readonly MLExportRow[], index: LocationIndex): Int32Array {
  const counts = new Int32Array(index.locations.length * 3)
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const cid = row.checklistId
    if (typeof cid !== 'string' || cid === '') continue
    const loc = index.checklistLoc.get(cid)
    if (loc === undefined || loc < 0) continue
    const f = row.format === 'Photo' ? 0 : row.format === 'Audio' ? 1 : row.format === 'Video' ? 2 : -1
    if (f < 0) continue
    counts[loc * 3 + f] += 1
  }
  return counts
}

// ── The overview (H10, FR-28, FR-29, FR-36) ──────────────────────────────────

/**
 * FR-36: each location's species total under the tab's one rule, which is the
 * length of its life list. `speciesBase` less each escapee species present
 * there, found by walking the escapee species' own rows (never a row pass).
 */
export function speciesTotals(index: LocationIndex, escapees: ReadonlySet<string>): Int32Array {
  const totals = index.speciesBase.slice()
  if (escapees.size === 0) return totals
  const stamp = new Int32Array(index.locations.length).fill(-1)
  for (const name of escapees) {
    const s = index.speciesOrd.get(name)
    if (s === undefined) continue
    for (let k = index.spStart[s]; k < index.spStart[s + 1]; k++) {
      const r = index.spRows[k]
      if (!isEligibleRow(index, r)) continue
      const loc = index.rowLoc[r]
      if (stamp[loc] !== s) { stamp[loc] = s; totals[loc] -= 1 }
    }
  }
  return totals
}

/** A bounded insertion into a list of at most RANKED_LIST_SIZE rows. */
function insertRanked(list: RankedRow[], row: RankedRow, better: (a: RankedRow, b: RankedRow) => number): void {
  if (list.length === RANKED_LIST_SIZE && better(row, list[list.length - 1]) >= 0) return
  let at = list.length
  while (at > 0 && better(row, list[at - 1]) < 0) at -= 1
  list.splice(at, 0, row)
  if (list.length > RANKED_LIST_SIZE) list.pop()
}

/** FR-28, FR-29: the two top-ten lists, by bounded insertion (no sort over all
 *  locations). Ties: the other figure, then name by locale compare, then the
 *  Location ID by code unit. A location whose species total is zero is never in
 *  the species list. */
export function rankLocations(index: LocationIndex, totals: Int32Array): { readonly byChecklists: readonly RankedRow[]; readonly bySpecies: readonly RankedRow[] } {
  const recs = index.locations
  const byName = (a: RankedRow, b: RankedRow) => {
    const c = recs[a.ord].name.localeCompare(recs[b.ord].name)
    return c !== 0 ? c : compareId(recs[a.ord].locationId, recs[b.ord].locationId)
  }
  const checklistsFirst = (a: RankedRow, b: RankedRow) =>
    a.checklists !== b.checklists ? b.checklists - a.checklists
      : a.species !== b.species ? b.species - a.species
        : byName(a, b)
  const speciesFirst = (a: RankedRow, b: RankedRow) =>
    a.species !== b.species ? b.species - a.species
      : a.checklists !== b.checklists ? b.checklists - a.checklists
        : byName(a, b)
  const byChecklists: RankedRow[] = []
  const bySpecies: RankedRow[] = []
  for (let ord = 0; ord < recs.length; ord++) {
    const row: RankedRow = { ord, checklists: index.checklistCount[ord], species: totals[ord] }
    insertRanked(byChecklists, row, checklistsFirst)
    if (row.species > 0) insertRanked(bySpecies, row, speciesFirst)
  }
  return { byChecklists, bySpecies }
}
