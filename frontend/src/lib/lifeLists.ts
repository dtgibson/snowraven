// The Life Lists derivation (life-lists-tab schema section 2).
//
// Pure: no I/O, no clock, no React, no network import of any kind. Three passes,
// each linear in its input, and one comparator family:
//
//   pass 1  deriveFirstSightings(observations)   O(rows)        one record per species
//   pass 2  deriveFirstAssets(mlRows)             O(mlRows)      at most one record per species per format
//   pass 3  selectRows(firsts, assets, ...)       O(S log S)     S = species, never rows
//
// The region passes and their materializers live in lifeListsRegion.ts and
// build their records through the two constructors exported here.
//
// Every field read is an already-parsed field of `ObservationEntry` or
// `MLExportRow`. The bounded reads over those fields (schema section 7, S1, S2,
// S3, S5, S8) are hand loops with their own length gates, so this module holds
// no regex and none of the search primitives whose absence case scans to the end
// of a string; `lifeLists.test.ts` asserts that absence with comments stripped.
// A `Map` keyed by a name out of the user's CSV has no prototype keys, so a
// `__proto__` name is an ordinary key (security.md, the v1.0.22 family).

import type { ObservationEntry } from '../types'
import type { MLExportRow } from './parseMLExport'
import { normalizeSpeciesName, isNonCountableForm } from './speciesUtils'

// ── Shapes ────────────────────────────────────────────────────────────────────

export type MediaFormat = MLExportRow['format']
/** The one ordered manifest; copy generates from it (lifeListsCopy.ts). */
export const MEDIA_FORMATS: readonly MediaFormat[] = ['Photo', 'Audio', 'Video']

/** A comparable instant inside one day. `day` is YYYYMMDD as an integer
 *  (20190502), comparable with `<`; `minute` is 0..1439, or null when the time
 *  is blank or unparseable. */
export interface Instant { readonly day: number; readonly minute: number | null }

export interface FirstSighting extends Instant {
  /** Normalized common name (the Map key, repeated for the row). */
  readonly name: string
  /** The binomial from THIS observation's Scientific Name cell, '' when blank;
   *  never from the ML export (FR-43). */
  readonly scientificName: string
  readonly submissionId: string
  readonly location: string
  /** "County, ST" | "County" | "ST" | '' (placeOf). */
  readonly place: string
}

/** FR-44: which formats the species has a dated first asset in. */
export interface MediaPresence { readonly photo: boolean; readonly audio: boolean; readonly video: boolean }

export interface FirstAsset extends Instant {
  readonly catalogId: string
  /** '' when the ML row carries none. */
  readonly checklistId: string
  /** MLExportRow.location (Locality). */
  readonly location: string
  /** MLExportRow.county ?? '' (the ML export has no state column). */
  readonly place: string
}

/** At most one record per species per format (NFR-03). Absent key = no dated
 *  asset of that format. */
export type FirstAssets = Readonly<Partial<Record<MediaFormat, FirstAsset>>>

export interface LifeListRow extends Instant {
  readonly name: string
  /** From the first-sighting record, whatever the media selection (FR-43). */
  readonly scientificName: string
  /** FR-42: 1-based from the OLDEST row of the current selection; the newest
   *  row carries rows.length. */
  readonly position: number
  /** FR-44: identical whatever the selection; what the species HAS. */
  readonly media: MediaPresence
  /** Display form "7:05 AM", or null (the row renders a dash). */
  readonly time: string | null
  /** '' or an unvalidated id; ChecklistLink and isValidChecklistId gate it at render. */
  readonly checklistId: string
  readonly location: string
  readonly place: string
}

export interface LifeListControls {
  readonly includeEscapees: boolean
  readonly includeExotics: boolean
  readonly formats: ReadonlySet<MediaFormat>
}

export interface LifeListClassification {
  /** Confirmed escapee-only names (lifeListsProvenance.ts). */
  readonly escapees: ReadonlySet<string>
  /** Confirmed exotic-only names (lifeListsProvenance.ts). */
  readonly exotics: ReadonlySet<string>
}

// ── Bounded field reads (schema section 7) ────────────────────────────────────

const CH_0 = 48
const CH_HYPHEN = 45
const CH_COLON = 58
const CH_SPACE = 32

/** The digit at `i`, or -1. */
function digitAt(s: string, i: number): number {
  const d = s.charCodeAt(i) - CH_0
  return d >= 0 && d <= 9 ? d : -1
}

/**
 * S1: a `YYYY-MM-DD` day as the integer YYYYMMDD, or null. The length gate runs
 * before any character is read, so a cell of any length costs one length read;
 * then ten fixed-position checks and the range check (month 1 to 12, day 1 to
 * 31, the Statistics media card's `dayNumber` rule). No `Date` is constructed.
 */
export function dayKey(date: string | null | undefined): number | null {
  if (typeof date !== 'string' || date.length !== 10) return null
  if (date.charCodeAt(4) !== CH_HYPHEN || date.charCodeAt(7) !== CH_HYPHEN) return null
  const y0 = digitAt(date, 0), y1 = digitAt(date, 1), y2 = digitAt(date, 2), y3 = digitAt(date, 3)
  const m0 = digitAt(date, 5), m1 = digitAt(date, 6), d0 = digitAt(date, 8), d1 = digitAt(date, 9)
  if (y0 < 0 || y1 < 0 || y2 < 0 || y3 < 0 || m0 < 0 || m1 < 0 || d0 < 0 || d1 < 0) return null
  const month = m0 * 10 + m1
  const day = d0 * 10 + d1
  if (month < 1 || month > 12 || day < 1 || day > 31) return null
  return (y0 * 1000 + y1 * 100 + y2 * 10 + y3) * 10000 + month * 100 + day
}

/** `YYYY-MM-DD` written back from a day key, for `formatDate` (no `Date`). */
export function dayToIso(day: number): string {
  const y = Math.floor(day / 10000)
  const m = Math.floor(day / 100) % 100
  const d = day % 100
  return `${String(y).padStart(4, '0')}-${m < 10 ? '0' : ''}${m}-${d < 10 ? '0' : ''}${d}`
}

/**
 * S2: the backup's 12-hour clock ("7:05 AM", "07:05 PM") as minutes since
 * midnight, or null. `null`, `''` or a cell longer than 8 characters returns
 * null before any character is read; the rest is a hand loop over at most 8
 * characters. Hour 1 to 12, minute 0 to 59.
 */
export function minuteOf12h(time: string | null | undefined): number | null {
  if (typeof time !== 'string' || time.length === 0 || time.length > 8) return null
  let i = 0
  let hour = 0
  let hourDigits = 0
  while (i < time.length && hourDigits < 2) {
    const d = digitAt(time, i)
    if (d < 0) break
    hour = hour * 10 + d
    i += 1
    hourDigits += 1
  }
  if (hourDigits === 0 || time.charCodeAt(i) !== CH_COLON) return null
  const mm0 = digitAt(time, i + 1), mm1 = digitAt(time, i + 2)
  if (mm0 < 0 || mm1 < 0 || time.charCodeAt(i + 3) !== CH_SPACE) return null
  if (i + 6 !== time.length) return null
  const a = time.charCodeAt(i + 4), m = time.charCodeAt(i + 5)
  if (m !== 77 && m !== 109) return null                        // 'M' / 'm'
  const pm = a === 80 || a === 112                               // 'P' / 'p'
  if (!pm && a !== 65 && a !== 97) return null                   // 'A' / 'a'
  const minute = mm0 * 10 + mm1
  if (hour < 1 || hour > 12 || minute > 59) return null
  return ((hour % 12) + (pm ? 12 : 0)) * 60 + minute
}

/**
 * S3: the ML export's 24-hour "HMM" / "HHMM" clock ("643" is 06:43) as minutes
 * since midnight, or null. Empty or longer than 4 characters returns null first
 * (the ML parser already trims). Same contract as `mediaStats.parseMlHour`,
 * keeping the minute. Hour 0 to 23, minute 0 to 59.
 */
export function minuteOfMlClock(time: string | null | undefined): number | null {
  if (typeof time !== 'string' || time.length === 0 || time.length > 4) return null
  let n = 0
  for (let i = 0; i < time.length; i++) {
    const d = digitAt(time, i)
    if (d < 0) return null
    n = n * 10 + d
  }
  const hour = Math.floor(n / 100)
  const minute = n % 100
  if (hour > 23 || minute > 59) return null
  return hour * 60 + minute
}

/** One 12-hour formatter for both sources ("7:05 AM"), or null for a blank. */
export function formatClock12h(minute: number | null): string | null {
  if (minute === null) return null
  const h24 = Math.floor(minute / 60)
  const mm = minute % 60
  const h12 = (h24 % 12) || 12
  return `${h12}:${mm < 10 ? '0' : ''}${mm} ${h24 < 12 ? 'AM' : 'PM'}`
}

/** S5's own bound: eBird codes are `US-MN`, `CA-ON`, `MX-ROO`; a longer cell
 *  yields no state. */
export const STATE_CODE_SCAN_CHARS = 16

/**
 * S5: "County, ST" from the backup's County and State/Province cells, in the
 * Checklists place-string form (`stateProvince.split('-')[1]`, which this equals
 * on every well-formed code). The state is the text after the first hyphen up to
 * the next one, found by a hand scan over at most `STATE_CODE_SCAN_CHARS`.
 */
export function placeOf(county: string | null | undefined, stateProvince: string | null | undefined): string {
  let state = ''
  if (typeof stateProvince === 'string' && stateProvince.length > 0 && stateProvince.length <= STATE_CODE_SCAN_CHARS) {
    let start = -1
    let end = stateProvince.length
    for (let i = 0; i < stateProvince.length; i++) {
      if (stateProvince.charCodeAt(i) !== CH_HYPHEN) continue
      if (start === -1) start = i + 1
      else { end = i; break }
    }
    if (start !== -1) state = stateProvince.slice(start, end)
  }
  const c = typeof county === 'string' ? county : ''
  if (c && state) return `${c}, ${state}`
  return c || state
}

/** S8's own bound: the longest binomial in eBird's 2026 taxonomy is well under
 *  50 characters; 96 leaves room and is enforced here, not by the producer. */
export const BINOMIAL_SCAN_CHARS = 96

function isSpaceChar(c: number): boolean {
  return c === CH_SPACE || c === 9 || c === 10 || c === 13 || c === 0xa0
}

/**
 * S8 (FR-43): the first two whitespace-separated tokens of a Scientific Name
 * cell, so a subspecies row (`Junco hyemalis oreganus`) shows its species. A
 * hand scan that COPIES characters (a fresh bounded string, never a slice of a
 * long parent) until the second token ends, capped at `BINOMIAL_SCAN_CHARS`
 * characters read. Fewer than two tokens returns what there is.
 */
export function binomialOf(scientificName: string | null | undefined): string {
  if (typeof scientificName !== 'string') return ''
  const n = scientificName.length < BINOMIAL_SCAN_CHARS ? scientificName.length : BINOMIAL_SCAN_CHARS
  let out = ''
  let tokens = 0
  let inToken = false
  for (let i = 0; i < n; i++) {
    const c = scientificName.charCodeAt(i)
    if (isSpaceChar(c)) {
      if (inToken) {
        inToken = false
        if (tokens === 2) break
      }
      continue
    }
    if (!inToken) {
      inToken = true
      tokens += 1
      if (tokens === 2) out += ' '
    }
    out += scientificName[i]
  }
  return out
}

// ── The comparator family (FR-11, FR-22, FR-25, FR-28) ───────────────────────

/**
 * Day ascending, then a timed instant before a blank one of the same day, then
 * minute ascending. "Blank ranks after timed" is this ONE rule: the first of a
 * set is its minimum (a timed sighting beats a blank one that day, FR-11) and
 * the latest of a set is its maximum (FR-25's "same blank-last rule").
 */
export function compareInstant(aDay: number, aMinute: number | null, bDay: number, bMinute: number | null): number {
  if (aDay !== bDay) return aDay < bDay ? -1 : 1
  if (aMinute === bMinute) return 0
  if (aMinute === null) return 1
  if (bMinute === null) return -1
  return aMinute < bMinute ? -1 : 1
}

/** Plain code-unit comparison: a stable tiebreak, not a numeric one (eBird ids
 *  are `S` plus digits of varying length). */
function compareId(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}

/**
 * The display order (FR-28): day DESCENDING, then a timed row before a blank
 * one of that day (blank rows last, as FR-28 and QA-29 state), then minute
 * DESCENDING, then normalized name ascending. This is deliberately NOT the bare
 * reverse of `compareInstant`, which would put a blank row first.
 *
 * Its parameters are the three fields it reads, so the Hotspot Reports life
 * list (hotspot-reports schema 8) sorts its own rows with this one comparator
 * rather than a copy. A type-only widening: the emitted JavaScript is unchanged.
 */
export function compareDisplay(
  a: Pick<LifeListRow, 'day' | 'minute' | 'name'>,
  b: Pick<LifeListRow, 'day' | 'minute' | 'name'>,
): number {
  if (a.day !== b.day) return a.day > b.day ? -1 : 1
  if (a.minute !== b.minute) {
    if (a.minute === null) return 1
    if (b.minute === null) return -1
    return a.minute > b.minute ? -1 : 1
  }
  return a.name.localeCompare(b.name)
}

// ── Pass 1: first sightings (FR-10, FR-11, FR-12, FR-43) ─────────────────────

export function deriveFirstSightings(obs: readonly ObservationEntry[]): Map<string, FirstSighting> {
  const map = new Map<string, FirstSighting>()
  for (let i = 0; i < obs.length; i++) {
    const o = obs[i]
    const day = dayKey(o.date)
    if (day === null) continue                         // FR-12: an undated row establishes nothing
    const sub = o.submissionId
    if (!sub) continue                                 // no checklist to show
    if (isNonCountableForm(o.commonName)) continue     // FR-10, the RAW name
    const name = normalizeSpeciesName(o.commonName)
    if (name === '') continue
    const minute = minuteOf12h(o.time)
    const cur = map.get(name)
    if (cur !== undefined) {
      const c = compareInstant(day, minute, cur.day, cur.minute)
      if (c > 0 || (c === 0 && compareId(sub, cur.submissionId) >= 0)) continue
    }
    map.set(name, firstSightingRecord(o, name, day, minute))
  }
  return map
}

/**
 * The one first-sighting record constructor, shared by pass 1 and the region
 * materializer (lifeListsRegion.ts), so a regional record is built from its
 * dating observation exactly as the world record is (life-list-region-filter
 * schema 2.5). `o.submissionId` is the caller's already-gated, non-empty id.
 */
export function firstSightingRecord(o: ObservationEntry, name: string, day: number, minute: number | null): FirstSighting {
  return {
    name,
    day,
    minute,
    scientificName: binomialOf(o.scientificName),
    submissionId: o.submissionId,
    location: o.location,
    place: placeOf(o.county, o.stateProvince),
  }
}

// ── Pass 2: first assets per format (FR-22) ──────────────────────────────────

type MutableAssets = { -readonly [K in MediaFormat]?: FirstAsset }

export function deriveFirstAssets(rows: readonly MLExportRow[]): Map<string, FirstAssets> {
  const map = new Map<string, MutableAssets>()
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const day = dayKey(row.date)
    if (day === null) continue                         // FR-22: an undated asset establishes nothing
    const fmt = row.format
    if (fmt !== 'Photo' && fmt !== 'Audio' && fmt !== 'Video') continue
    // Already normalized by the ML parser (classify, then truncateAtFirstParen);
    // the test pins that this equals normalizeSpeciesName of the raw name.
    const name = row.commonName
    if (name === '') continue
    const minute = minuteOfMlClock(row.time)
    let rec = map.get(name)
    if (rec === undefined) { rec = {}; map.set(name, rec) }
    const cur = rec[fmt]
    if (cur !== undefined) {
      const c = compareInstant(day, minute, cur.day, cur.minute)
      if (c > 0 || (c === 0 && compareId(row.catalogId, cur.catalogId) >= 0)) continue
    }
    rec[fmt] = firstAssetRecord(row, day, minute)
  }
  return map
}

/** The one first-asset record constructor, shared by pass 2 and the region
 *  materializer (life-list-region-filter schema 2.5). */
export function firstAssetRecord(row: MLExportRow, day: number, minute: number | null): FirstAsset {
  return {
    day,
    minute,
    catalogId: row.catalogId,
    checklistId: row.checklistId,
    location: row.location,
    place: row.county ?? '',
  }
}

// ── Pass 3: the shown list (FR-13, FR-18, FR-23 to FR-28, FR-42, FR-44) ──────

type MutableRow = { -readonly [K in keyof LifeListRow]: LifeListRow[K] }

const NO_MEDIA: MediaPresence = { photo: false, audio: false, video: false }

/**
 * `presence` is where the media presence cell (FR-44) is read; `assets` is what
 * the selection dates from. They are the same map unless a caller says
 * otherwise, so every call that omits it is today's call byte for byte. Under a
 * region (life-list-region-filter FR-12, schema 2.6) the tab passes the
 * regional firsts and regional assets with the WORLD asset map as `presence`,
 * so the cell stays what the species has anywhere.
 */
export function selectRows(
  firsts: ReadonlyMap<string, FirstSighting>,
  assets: ReadonlyMap<string, FirstAssets>,
  classification: LifeListClassification,
  controls: LifeListControls,
  presence: ReadonlyMap<string, FirstAssets> = assets,
): LifeListRow[] {
  const out: MutableRow[] = []
  for (const first of firsts.values()) {
    const name = first.name
    if (!controls.includeEscapees && classification.escapees.has(name)) continue
    if (!controls.includeExotics && classification.exotics.has(name)) continue
    const a = assets.get(name)
    const p = presence === assets ? a : presence.get(name)
    const media: MediaPresence = p === undefined
      ? NO_MEDIA
      : { photo: p.Photo !== undefined, audio: p.Audio !== undefined, video: p.Video !== undefined }

    if (controls.formats.size === 0) {
      out.push({
        name, scientificName: first.scientificName, position: 0, media,
        day: first.day, minute: first.minute, time: formatClock12h(first.minute),
        checklistId: first.submissionId, location: first.location, place: first.place,
      })
      continue
    }

    // FR-23 to FR-25: every selected format must have a first; the row is the
    // LATEST of them, the format order the final tiebreak (a later format in
    // MEDIA_FORMATS wins an exact tie).
    let chosen: FirstAsset | null = null
    let complete = true
    for (let f = 0; f < MEDIA_FORMATS.length; f++) {
      const fmt = MEDIA_FORMATS[f]
      if (!controls.formats.has(fmt)) continue
      const asset = a === undefined ? undefined : a[fmt]
      if (asset === undefined) { complete = false; break }
      if (chosen === null || compareInstant(asset.day, asset.minute, chosen.day, chosen.minute) >= 0) chosen = asset
    }
    if (!complete || chosen === null) continue
    out.push({
      name, scientificName: first.scientificName, position: 0, media,
      day: chosen.day, minute: chosen.minute, time: formatClock12h(chosen.minute),
      checklistId: chosen.checklistId, location: chosen.location, place: chosen.place,
    })
  }

  out.sort(compareDisplay)
  // FR-42: assigned after the sort, over the final roster for this selection,
  // so the newest row carries the count sentence's N and the oldest carries 1.
  for (let i = 0; i < out.length; i++) out[i].position = out.length - i
  return out
}
