// The Life Lists region filter (life-list-region-filter schema section 2).
//
// Pure: no I/O, no clock, no React, no network import of any kind. Two passes
// over the parsed files, run once per files epoch in the tab's load effect, and
// two materializers run per region press:
//
//   pass 1R  deriveRegionIndex(observations)        O(rows)      regional first-sighting slots, the checklist join, the choices
//   pass 2R  deriveRegionAssets(mlRows, join)        O(mlRows)    regional first-asset slots
//   press    regionFirsts(index, region, obs)        O(S_region)  the selected region's FirstSighting records
//   press    regionAssets(assets, region, mlRows)    O(S_region)  the selected region's FirstAssets records
//
// Measured per load and per press, with the hostile worst case, in
// `pipeline/life-list-region-filter/decisions.md` D-04: at the 150k-row cap
// pass 1R reads about 87 ms first call and a press a few milliseconds.
//
// A region is held as three Map TIERS keyed by the parsed cells themselves
// (country part, State/Province cell, State/Province cell then County cell), so
// there is no composite string key, no delimiter and no collision argument.
// Membership is realized by insertion: a row lands under every region it is
// inside, and exact Map-key equality on the parsed text is the comparison
// (FR-11). A `Map` keyed by a cell out of the user's CSV has no prototype keys,
// so a `__proto__` state or county is an ordinary key (security.md, v1.0.22).
//
// Every read over user-file text here is a hand loop with its own bound or a
// length read (schema 5.1, S10 to S16): no regex and none of the search
// primitives, which `lifeListsRegion.test.ts` asserts with comments stripped.
// The bounds are the stored bounds: a State/Province cell over
// `STATE_CODE_SCAN_CHARS` (16) belongs to no region, and a County cell over
// `COUNTY_CELL_MAX_CHARS` (96) is read as no county, so every offered region
// is a region `parseStoredRegion` accepts (schema 2.2; decisions.md D-01).

import type { ObservationEntry } from '../types'
import type { MLExportRow } from './parseMLExport'
import { normalizeSpeciesName, isNonCountableForm } from './speciesUtils'
import { regionName } from './regionNames'
import {
  STATE_CODE_SCAN_CHARS, compareInstant, dayKey, firstAssetRecord, firstSightingRecord, minuteOf12h,
  minuteOfMlClock, placeOf,
  type FirstAsset, type FirstAssets, type FirstSighting, type MediaFormat,
} from './lifeLists'

// ── Shapes ────────────────────────────────────────────────────────────────────

export type RegionLevel = 'country' | 'state' | 'county'

/** A region as the backup spells it. `code` is the country part for a country,
 *  the whole State/Province cell for a state or a county. Never rendered: the
 *  matched choice's label is what renders (FR-25). */
export type RegionRef =
  | { readonly level: 'country'; readonly code: string }
  | { readonly level: 'state'; readonly code: string }
  | { readonly level: 'county'; readonly code: string; readonly county: string }

export interface RegionChoice { readonly region: RegionRef; readonly label: string }

/** FR-04: three groups, each sorted by label, each de-duplicated by identity
 *  (the tiers' Map keys), never by label. */
export interface RegionChoices {
  readonly countries: readonly RegionChoice[]
  readonly states: readonly RegionChoice[]
  readonly counties: readonly RegionChoice[]
  readonly total: number
}

/** One slot per (region, species) or (region, species, format): the INDEX of
 *  the dating row in the parsed array it came from, with its instant cached so
 *  a comparison never re-reads the row. The record is built at press time for
 *  the selected region only (schema 2.5). */
export interface Slot { readonly day: number; readonly minute: number | null; readonly i: number }

export type SpeciesSlots = Map<string, Slot>
export type AssetSlots = Map<string, { Photo?: Slot; Audio?: Slot; Video?: Slot }>

export interface RegionTiers<T> {
  /** Country part -> T. */
  readonly countries: Map<string, T>
  /** Hyphenated State/Province cell -> T. */
  readonly states: Map<string, T>
  /** State/Province cell -> County cell -> T. */
  readonly counties: Map<string, Map<string, T>>
}

/** FR-13: a checklist's cells, from its first eligible observation in file order. */
export interface ChecklistCells {
  readonly country: string
  readonly state: string
  readonly county: string
  readonly hyphenated: boolean
}

export interface RegionIndex {
  readonly firsts: RegionTiers<SpeciesSlots>
  /** Submission id -> cells. At most one entry per distinct id, so at most rows. */
  readonly join: Map<string, ChecklistCells>
  readonly choices: RegionChoices
}
export type RegionAssetIndex = RegionTiers<AssetSlots>

/** The settings key (FR-22): a preference the user chose, never derived data,
 *  the `targetsCounty` precedent. Per device: no sync kind, no Clear row. */
export const LIFE_LISTS_REGION_SETTING = 'lifeListsRegion'

/** The County cell bound, the same kind as `BINOMIAL_SCAN_CHARS` (96): the
 *  longest county name in eBird's US and Canada sets is under 40 characters. */
export const COUNTY_CELL_MAX_CHARS = 96

// ── S10: the country part of a State/Province cell ────────────────────────────

const CH_HYPHEN = 45

interface CellParts { readonly country: string; readonly hyphenated: boolean }

/**
 * The text before the first hyphen, or the whole cell when it has none. The
 * caller has already gated the cell to 1 to `STATE_CODE_SCAN_CHARS` characters,
 * so this is a hand loop over at most 16 code units and one slice of a parent
 * at most 16 long. A cell whose country part is empty ("-CA") is no region at
 * all (null): nothing could be saved for it and it would label as blank.
 */
function cellParts(sp: string): CellParts | null {
  let hyphen = -1
  for (let i = 0; i < sp.length; i++) {
    if (sp.charCodeAt(i) === CH_HYPHEN) { hyphen = i; break }
  }
  if (hyphen === 0) return null
  return hyphen === -1 ? { country: sp, hyphenated: false } : { country: sp.slice(0, hyphen), hyphenated: true }
}

/** S11: the County cell as the region index reads it, '' when absent or over the bound. */
function countyCell(c: string | null | undefined): string {
  return typeof c === 'string' && c.length <= COUNTY_CELL_MAX_CHARS ? c : ''
}

function tierOf<T>(m: Map<string, Map<string, T>>, key: string): Map<string, T> {
  let t = m.get(key)
  if (t === undefined) { t = new Map(); m.set(key, t) }
  return t
}

/** Keep the earlier slot (tab FR-11's order): day, then time with blank last,
 *  then the smaller submission id by code units, read only on an exact tie. On
 *  an equal id the slot already held stays, as pass 1 keeps the first row. */
function putSighting(slots: SpeciesSlots, obs: readonly ObservationEntry[], name: string, slot: Slot): void {
  const cur = slots.get(name)
  if (cur !== undefined) {
    const c = compareInstant(slot.day, slot.minute, cur.day, cur.minute)
    if (c > 0) return
    if (c === 0 && !(obs[slot.i].submissionId < obs[cur.i].submissionId)) return
  }
  slots.set(name, slot)
}

/** The same rule per format, with the catalog id as the tiebreak (tab FR-22). */
function putAsset(slots: AssetSlots, rows: readonly MLExportRow[], name: string, fmt: MediaFormat, slot: Slot): void {
  let rec = slots.get(name)
  if (rec === undefined) { rec = {}; slots.set(name, rec) }
  const cur = rec[fmt]
  if (cur !== undefined) {
    const c = compareInstant(slot.day, slot.minute, cur.day, cur.minute)
    if (c > 0) return
    if (c === 0 && !(rows[slot.i].catalogId < rows[cur.i].catalogId)) return
  }
  rec[fmt] = slot
}

// ── Pass 1R (FR-01 to FR-03, FR-10, FR-11, FR-13) ─────────────────────────────

export function deriveRegionIndex(obs: readonly ObservationEntry[]): RegionIndex {
  const firsts: RegionTiers<SpeciesSlots> = { countries: new Map(), states: new Map(), counties: new Map() }
  const join = new Map<string, ChecklistCells>()
  // One entry per distinct State/Province cell, each key at most 16 code units.
  const parts = new Map<string, CellParts | null>()
  for (let i = 0; i < obs.length; i++) {
    const o = obs[i]
    const sp = o.stateProvince
    if (typeof sp !== 'string' || sp.length === 0 || sp.length > STATE_CODE_SCAN_CHARS) continue   // FR-03
    const sub = o.submissionId
    if (!sub) continue
    let cp = parts.get(sp)
    if (cp === undefined) { cp = cellParts(sp); parts.set(sp, cp) }
    if (cp === null) continue
    const c = countyCell(o.county)
    // FR-13: set BEFORE the date and countability gates, so a checklist holding
    // only a spuh still places its assets; the first row in file order governs.
    if (!join.has(sub)) join.set(sub, { country: cp.country, state: sp, county: c, hyphenated: cp.hyphenated })
    // Pass 1's gates, so the eligible set is pass 1's (FR-01).
    const day = dayKey(o.date)
    if (day === null) continue
    if (isNonCountableForm(o.commonName)) continue
    const name = normalizeSpeciesName(o.commonName)
    if (name === '') continue
    const slot: Slot = { day, minute: minuteOf12h(o.time), i }
    putSighting(tierOf(firsts.countries, cp.country), obs, name, slot)
    if (cp.hyphenated) {
      putSighting(tierOf(firsts.states, sp), obs, name, slot)
      if (c !== '') putSighting(tierOf(tierOf(firsts.counties, sp), c), obs, name, slot)
    }
  }
  return { firsts, join, choices: buildRegionChoices(firsts) }
}

// ── Pass 2R (FR-13 to FR-16) ──────────────────────────────────────────────────

/** The ML row's own County, Locality, latitude and longitude are never read
 *  here (FR-16): membership comes only from the backup's cells for the asset's
 *  checklist, through `join`. */
export function deriveRegionAssets(rows: readonly MLExportRow[], join: ReadonlyMap<string, ChecklistCells>): RegionAssetIndex {
  const out: RegionAssetIndex = { countries: new Map(), states: new Map(), counties: new Map() }
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const day = dayKey(row.date)
    if (day === null) continue
    const fmt = row.format
    if (fmt !== 'Photo' && fmt !== 'Audio' && fmt !== 'Video') continue
    const name = row.commonName
    if (name === '') continue
    const cid = row.checklistId
    if (typeof cid !== 'string' || cid === '') continue      // FR-14: unlinked
    const cells = join.get(cid)
    if (cells === undefined) continue                          // FR-14: not in the backup
    const slot: Slot = { day, minute: minuteOfMlClock(row.time), i }
    putAsset(tierOf(out.countries, cells.country), rows, name, fmt, slot)
    if (cells.hyphenated) {
      putAsset(tierOf(out.states, cells.state), rows, name, fmt, slot)
      if (cells.county !== '') putAsset(tierOf(tierOf(out.counties, cells.state), cells.county), rows, name, fmt, slot)
    }
  }
  return out
}

// ── The choices (FR-04), from the tiers' KEY SETS ─────────────────────────────

const byLabel = (a: RegionChoice, b: RegionChoice): number => a.label.localeCompare(b.label)

/** Built from the tiers' keys, never a separate accumulator, so a region is
 *  offered exactly when it holds a first-sighting slot (FR-01). At most three
 *  choices per distinct (State/Province, County) pair, so at most 3 x rows. */
export function buildRegionChoices(firsts: RegionTiers<SpeciesSlots>): RegionChoices {
  const countries: RegionChoice[] = []
  const states: RegionChoice[] = []
  const counties: RegionChoice[] = []
  for (const code of firsts.countries.keys()) {
    const region: RegionRef = { level: 'country', code }
    countries.push({ region, label: regionLabel(region) })
  }
  for (const code of firsts.states.keys()) {
    const region: RegionRef = { level: 'state', code }
    states.push({ region, label: regionLabel(region) })
  }
  for (const [code, inner] of firsts.counties) {
    for (const county of inner.keys()) {
      const region: RegionRef = { level: 'county', code, county }
      counties.push({ region, label: regionLabel(region) })
    }
  }
  countries.sort(byLabel)
  states.sort(byLabel)
  counties.sort(byLabel)
  return { countries, states, counties, total: countries.length + states.length + counties.length }
}

// ── Labels (FR-04, schema 2.7) ────────────────────────────────────────────────

interface RegionNamer { of(code: string): string | undefined }

/** undefined: not yet built; null: the engine has no usable `Intl.DisplayNames`. */
let regionNamer: RegionNamer | null | undefined
/** Per distinct country code. Only a two-letter A to Z code is ever a key, so
 *  this holds at most 26 x 26 entries for the module's lifetime. */
const countryNames = new Map<string, string>()

function namer(): RegionNamer | null {
  if (regionNamer === undefined) {
    try {
      regionNamer = new Intl.DisplayNames('en', { type: 'region', fallback: 'code' })
    } catch {
      regionNamer = null
    }
  }
  return regionNamer
}

/** eBird's country codes are two capital letters; any other spelling labels as
 *  itself, so a lowercase "us" can never take "United States" from "US". */
function isCountryCodeShape(code: string): boolean {
  if (code.length !== 2) return false
  for (let i = 0; i < 2; i++) {
    const c = code.charCodeAt(i)
    if (c < 65 || c > 90) return false
  }
  return true
}

/**
 * S13a: a country's English name from the engine's own locale data (the
 * user's direction at the design review, D-03), offline, with no table shipped
 * and no request made. The code itself wherever the engine has no name for it:
 * a code of another shape, an engine without `Intl.DisplayNames`, a throwing
 * `.of`, or a return that is empty or equal to the input (`fallback: 'code'`).
 * Display only: identity, matching and the stored value stay the code.
 */
export function countryDisplayName(code: string): string {
  if (!isCountryCodeShape(code)) return code
  const hit = countryNames.get(code)
  if (hit !== undefined) return hit
  let label = code
  const dn = namer()
  if (dn !== null) {
    try {
      const n = dn.of(code)
      if (typeof n === 'string' && n !== '' && n !== code) label = n
    } catch {
      // A RangeError keeps the code.
    }
  }
  countryNames.set(code, label)
  return label
}

/** The label a choice renders: a country's English name, a state's offline
 *  name or its code (`regionName`), a county in the Checklists place form
 *  "Marin, CA" (`placeOf`). Computed once per choice per epoch. */
export function regionLabel(region: RegionRef): string {
  if (region.level === 'country') return countryDisplayName(region.code)
  if (region.level === 'state') {
    // `regionName` reads its tables by bare key, so a hostile "US-constructor"
    // cell gets an inherited member back; anything but a non-empty string
    // labels as the code (security.md, the v0.5.81 lookup-table rule).
    const n: unknown = regionName(region.code)
    return typeof n === 'string' && n !== '' ? n : region.code
  }
  return placeOf(region.county, region.code)
}

// ── Lookup and materialization (schema 2.5) ───────────────────────────────────

/** One or two Map gets. */
export function lookupTier<T>(tiers: RegionTiers<T>, region: RegionRef): T | undefined {
  if (region.level === 'country') return tiers.countries.get(region.code)
  if (region.level === 'state') return tiers.states.get(region.code)
  const inner = tiers.counties.get(region.code)
  return inner === undefined ? undefined : inner.get(region.county)
}

/** The selected region's first sightings, one record per regional species,
 *  built by pass 1's own constructor from the dating observation (FR-10,
 *  FR-12). Null when the region holds no slot. */
export function regionFirsts(index: RegionIndex, region: RegionRef, obs: readonly ObservationEntry[]): Map<string, FirstSighting> | null {
  const slots = lookupTier(index.firsts, region)
  if (slots === undefined) return null
  const out = new Map<string, FirstSighting>()
  for (const [name, s] of slots) out.set(name, firstSightingRecord(obs[s.i], name, s.day, s.minute))
  return out
}

type MutableAssets = { -readonly [K in MediaFormat]?: FirstAsset }

/** The selected region's first assets, at most one record per species per
 *  format, built by pass 2's own constructor (FR-15). Empty when there is no
 *  readable ML export or the region holds no joined asset. */
export function regionAssets(assets: RegionAssetIndex | null, region: RegionRef, rows: readonly MLExportRow[]): Map<string, FirstAssets> {
  const out = new Map<string, FirstAssets>()
  if (assets === null) return out
  const slots = lookupTier(assets, region)
  if (slots === undefined) return out
  for (const [name, a] of slots) {
    const rec: MutableAssets = {}
    if (a.Photo !== undefined) rec.Photo = firstAssetRecord(rows[a.Photo.i], a.Photo.day, a.Photo.minute)
    if (a.Audio !== undefined) rec.Audio = firstAssetRecord(rows[a.Audio.i], a.Audio.day, a.Audio.minute)
    if (a.Video !== undefined) rec.Video = firstAssetRecord(rows[a.Video.i], a.Video.day, a.Video.minute)
    out.set(name, rec)
  }
  return out
}

// ── The stored value (FR-25, NFR-04, schema 2.8) ──────────────────────────────

/**
 * S15: accepts exactly the shape the app writes and nothing else, never
 * throwing. The reads are `Object.hasOwn` because the object came from
 * storage (security.md, v0.5.81). The parts are only ever compared by exact
 * equality against the derived choices, and never rendered.
 */
export function parseStoredRegion(v: unknown): RegionRef | null {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) return null
  if (!Object.hasOwn(v, 'level') || !Object.hasOwn(v, 'code')) return null
  const r = v as { level: unknown; code: unknown; county?: unknown }
  const level = r.level
  const code = r.code
  if (typeof code !== 'string' || code.length < 1 || code.length > STATE_CODE_SCAN_CHARS) return null
  if (level === 'country' || level === 'state') return { level, code }
  if (level !== 'county' || !Object.hasOwn(v, 'county')) return null
  const county = r.county
  if (typeof county !== 'string' || county.length < 1 || county.length > COUNTY_CELL_MAX_CHARS) return null
  return { level: 'county', code, county }
}

/** Two regions are the same region when their level and parts are equal. */
export function sameRegion(a: RegionRef | null, b: RegionRef | null): boolean {
  if (a === b) return true
  if (a === null || b === null || a.level !== b.level || a.code !== b.code) return false
  return a.level !== 'county' || (b.level === 'county' && a.county === b.county)
}

/** The derived choice a wanted region names, or null when it is not among the
 *  current choices (FR-24). One loop over that level's group; the matched
 *  choice, never the wanted value, supplies the label (FR-25). */
export function findChoice(choices: RegionChoices, want: RegionRef): RegionChoice | null {
  const group = want.level === 'country' ? choices.countries : want.level === 'state' ? choices.states : choices.counties
  for (let i = 0; i < group.length; i++) if (sameRegion(group[i].region, want)) return group[i]
  return null
}
