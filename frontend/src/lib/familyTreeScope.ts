// The Family Tree scope passes (family-rollups-and-tree schema section 5).
//
// Pure: no I/O, no clock, no React, no network import of any kind. The roster
// is LIFE LISTS' OWN DERIVATION, called and never copied (FR-18, FR-19):
//
//   Everywhere, all years   the keys of deriveFirstSightings(obs)
//   Region R, all years     the keys of lookupTier(deriveRegionIndex(obs).firsts, R)
//   Everywhere, year Y      the keys of deriveFirstSightings(rowsOf(Y))
//   Region R, year Y        the keys of lookupTier(deriveRegionIndex(rowsOf(Y)).firsts, R)
//
// Handing a year's own rows to Life Lists' own passes applies every one of its
// gates (valid date, submission id, `isNonCountableForm` on the raw name, the
// fold, the State/Province and County bounds) with no second copy. FR-19's
// union property then holds by construction: each gate is per row, and each
// validly dated row lies in exactly one year.
//
// The two Life Lists passes over all rows (P1, P1R) run in the tab's load
// effect; this module adds:
//
//   Y1  deriveYearColumns(obs, mlRows)   O(rows + mlRows), once per files epoch
//   S1  deriveScope(base, region, year)  at most 3 visits per observation row
//                                        and 1 per ML row per Year change
//
// Every read over user-file text here is a hand loop, a length read or a Map
// operation (schema 16.1, T1 to T4). This module holds
// no regex and none of the search primitives whose absence case scans to the
// end of a string;
// `familyTreeScope.test.ts` asserts that absence with comments stripped. A
// `Map` keyed by a name out of the user's CSV has no prototype keys, so a
// `__proto__` name is an ordinary key (security.md, v1.0.22).

import type { ObservationEntry } from '../types'
import type { MLExportRow } from './parseMLExport'
import { normalizeSpeciesName, isNonCountableForm } from './speciesUtils'
import { dayKey, deriveFirstSightings, type FirstSighting } from './lifeLists'
import { deriveRegionIndex, lookupTier, type ChecklistCells, type RegionIndex, type RegionRef } from './lifeListsRegion'
import { PLACE_KEY_MAX } from './familyTreeAsset'

/** The year list offers at most this many years, newest first (schema 5.2):
 *  `dayKey` admits ten thousand distinct years, and All years still covers
 *  every one of them (the Hotspot Reports year-bound precedent). */
export const YEAR_OPTIONS_MAX = 150

/** The media kinds, in the one fixed order the tab uses (photo, audio, video). */
export const KIND_COUNT = 3

/** Work done by this module's passes, for the work-count guards (NFR-01,
 *  NFR-03): `obs` observation rows read by Y1, `col` year-column cells read to
 *  collect a year's rows, `lifeListsRows` rows handed to a Life Lists pass,
 *  `ml` ML rows read, `ns` not-single-species rows read. Never read by the app. */
export const scopeWork = { obs: 0, col: 0, ml: 0, ns: 0, lifeListsRows: 0 }

// -- Y1: the year columns (schema 5.2) -----------------------------------------

export interface YearColumns {
  /** Per observation row: its year, or 0 for no valid day (year 0000 reads as none). */
  readonly obsYear: Uint16Array
  /** Per ML row: the same over its date. */
  readonly mlYear: Uint16Array
  /** The years a Year control offers, newest first, at most YEAR_OPTIONS_MAX. */
  readonly years: readonly number[]
  /** Not-single-species rows (validly dated, with a submission id, that
   *  `isNonCountableForm` rejects): their row index and the ordinal of their
   *  distinct raw name, -1 for a name over PLACE_KEY_MAX (never counted). */
  readonly nsRow: Int32Array
  readonly nsName: Int32Array
  readonly nsNameCount: number
}

function yearOf(date: string | null | undefined): number {
  const day = dayKey(date)
  return day === null ? 0 : Math.floor(day / 10000)
}

export function deriveYearColumns(obs: readonly ObservationEntry[], mlRows: readonly MLExportRow[] | null): YearColumns {
  const obsYear = new Uint16Array(obs.length)
  const yearSet = new Set<number>()
  const nsRows: number[] = []
  const nsNames: number[] = []
  const ordinal = new Map<string, number>()
  for (let i = 0; i < obs.length; i++) {
    scopeWork.obs += 1
    const o = obs[i]
    const y = yearOf(o.date)
    obsYear[i] = y
    if (y === 0 || !o.submissionId) continue
    const raw = o.commonName
    if (isNonCountableForm(raw)) {
      nsRows.push(i)
      if (typeof raw !== 'string' || raw.length > PLACE_KEY_MAX) { nsNames.push(-1); continue }
      let n = ordinal.get(raw)
      if (n === undefined) { n = ordinal.size; ordinal.set(raw, n) }
      nsNames.push(n)
      continue
    }
    if (normalizeSpeciesName(raw) === '') continue
    yearSet.add(y)
  }
  const rows = mlRows ?? []
  const mlYear = new Uint16Array(rows.length)
  for (let i = 0; i < rows.length; i++) {
    scopeWork.ml += 1
    mlYear[i] = yearOf(rows[i].date)
  }
  const years = [...yearSet].sort((a, b) => b - a)
  if (years.length > YEAR_OPTIONS_MAX) years.length = YEAR_OPTIONS_MAX
  return { obsYear, mlYear, years, nsRow: Int32Array.from(nsRows), nsName: Int32Array.from(nsNames), nsNameCount: ordinal.size }
}

// -- Region membership of a checklist's cells (schema 5.3) ---------------------

/**
 * Whether a checklist whose cells are `cells` lies inside `region`. It restates
 * the tier insertion of Life Lists' `deriveRegionAssets` (a country by its
 * country part; a state only for a hyphenated cell; a county only with a
 * County cell), so it owes both directions over a generated corpus:
 * `familyTreeScope.test.ts` holds has-a-kind from the tallies equal to the key
 * sets of `deriveFirstAssets` and `regionAssets`, by kind.
 */
export function cellsInRegion(cells: ChecklistCells, region: RegionRef): boolean {
  if (region.level === 'country') return cells.country === region.code
  if (!cells.hyphenated || cells.state !== region.code) return false
  if (region.level === 'state') return true
  return cells.county !== '' && cells.county === region.county
}

// -- S1: the per-scope pass (schema 5.3) ---------------------------------------

/** What the load derives once per files epoch, the scope pass's input. */
export interface ScopeBase {
  readonly observations: readonly ObservationEntry[]
  /** The cache's own ML rows, or null without a readable export. */
  readonly mlRows: readonly MLExportRow[] | null
  /** Pass 1: the world roster (Everywhere, all years). */
  readonly firsts: ReadonlyMap<string, FirstSighting>
  /** Pass 1R over all rows: the tiers, the ALL-YEARS checklist join, the choices. */
  readonly index: RegionIndex
  readonly columns: YearColumns
}

export interface Scope {
  /** Life Lists' keys (normalized names). */
  readonly names: ReadonlySet<string>
  /** ML name -> items by kind [photo, audio, video], in scope; null without a readable export. */
  readonly tallies: ReadonlyMap<string, Uint32Array> | null
  /** FR-26: distinct recorded names in scope that are not single species. */
  readonly notSingleSpecies: number
}

/** The selected year's own Life Lists passes, kept for that year only (schema
 *  5.3): a second region in the same year walks no observation row. */
export interface YearCache {
  readonly year: number
  world: ReadonlySet<string> | null
  regions: RegionIndex | null
}

export function newYearCache(year: number): YearCache {
  return { year, world: null, regions: null }
}

const EMPTY_NAMES: ReadonlySet<string> = new Set<string>()

/** The rows of one year, collected from the year column. Transient: dropped
 *  when the pass that reads it returns. */
function rowsOf(base: ScopeBase, year: number): ObservationEntry[] {
  const out: ObservationEntry[] = []
  const col = base.columns.obsYear
  for (let i = 0; i < col.length; i++) {
    scopeWork.col += 1
    if (col[i] === year) out.push(base.observations[i])
  }
  scopeWork.lifeListsRows += out.length
  return out
}

function keysOf<T>(m: ReadonlyMap<string, T> | undefined): ReadonlySet<string> {
  if (m === undefined) return EMPTY_NAMES
  return new Set(m.keys())
}

/** The roster before escapees and media, for one scope. */
export function scopeNames(base: ScopeBase, region: RegionRef | null, year: number | null, cache: YearCache | null): ReadonlySet<string> {
  if (year === null) {
    if (region === null) return keysOf(base.firsts)
    return keysOf(lookupTier(base.index.firsts, region))
  }
  const c = cache !== null && cache.year === year ? cache : newYearCache(year)
  if (region === null) {
    if (c.world === null) c.world = keysOf(deriveFirstSightings(rowsOf(base, year)))
    return c.world
  }
  if (c.regions === null) c.regions = deriveRegionIndex(rowsOf(base, year))
  return keysOf(lookupTier(c.regions.firsts, region))
}

/** FR-22's tallies: one loop over the ML rows, constant work per row. */
export function scopeTallies(base: ScopeBase, region: RegionRef | null, year: number | null): Map<string, Uint32Array> | null {
  const rows = base.mlRows
  if (rows === null) return null
  const out = new Map<string, Uint32Array>()
  const col = base.columns.mlYear
  const join = base.index.join
  for (let i = 0; i < rows.length; i++) {
    scopeWork.ml += 1
    const y = col[i]
    if (y === 0) continue
    if (year !== null && y !== year) continue
    const row = rows[i]
    const fmt = row.format
    const k = fmt === 'Photo' ? 0 : fmt === 'Audio' ? 1 : fmt === 'Video' ? 2 : -1
    if (k < 0) continue
    const name = row.commonName
    if (name === '') continue
    if (region !== null) {
      const cid = row.checklistId
      if (typeof cid !== 'string' || cid === '') continue
      const cells = join.get(cid)
      if (cells === undefined || !cellsInRegion(cells, region)) continue
    }
    let t = out.get(name)
    if (t === undefined) { t = new Uint32Array(KIND_COUNT); out.set(name, t) }
    t[k] += 1
  }
  return out
}

/** FR-26: one loop over the not-single-species rows only. */
export function scopeNotSingleSpecies(base: ScopeBase, region: RegionRef | null, year: number | null): number {
  const cols = base.columns
  if (cols.nsNameCount === 0) return 0
  const mark = new Uint8Array(cols.nsNameCount)
  let count = 0
  for (let j = 0; j < cols.nsRow.length; j++) {
    scopeWork.ns += 1
    const n = cols.nsName[j]
    if (n < 0) continue
    const i = cols.nsRow[j]
    if (year !== null && cols.obsYear[i] !== year) continue
    if (region !== null) {
      const cells = base.index.join.get(base.observations[i].submissionId)
      if (cells === undefined || !cellsInRegion(cells, region)) continue
    }
    if (mark[n] === 0) { mark[n] = 1; count += 1 }
  }
  return count
}

/** S1, the whole per-scope pass. */
export function deriveScope(base: ScopeBase, region: RegionRef | null, year: number | null, cache: YearCache | null): Scope {
  return {
    names: scopeNames(base, region, year, cache),
    tallies: scopeTallies(base, region, year),
    notSingleSpecies: scopeNotSingleSpecies(base, region, year),
  }
}
