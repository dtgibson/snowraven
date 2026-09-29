// Calendar overlays (pipeline/calendar-overlays): the persisted preference, the
// one mark-spec table, and the pure derivations of what a day tile, a legend
// block and an accessible name say while an overlay is on.
//
// React-free, lucide-free, storage-free and network-free ON PURPOSE: it is the
// module the unit tests drive with no DOM, and it rides the Calendar's lazy
// chunk only. A glyph is NAMED here, never imported; Calendar.tsx owns the one
// lookup from a name to the Camera / Mic / Video components the Multimedia tab
// already ships (schema.md 6.3, the lazy-chart-geometry split in CLAUDE.md).
//
// Every string a user reads from these overlays is defined here, so the copy
// guards see all of it: American spelling, no em dashes, no count of one with a
// plural noun.

import {
  breedingCategoryForTier, BREEDING_CATEGORY_LABELS, BREEDING_CATEGORY_ORDER, BREEDING_CATEGORY_SHORT,
  type BreedingCodeDef, type BreedingCategory,
} from './breedingCodes'
import { mediaFormatCounts, type MediaFormatCounts } from './observationMedia'
import type { DayCell } from './calendar'

// ── The persisted preference ────────────────────────────────────────────────

/** The one settings key (device-local; never synced; not a derived store, so
 *  it has no row in clearDerived.ts). No literal of it anywhere else. */
export const CALENDAR_OVERLAYS_SETTING_KEY = 'calendarOverlays'

export type CodesMode = 'every' | 'category'

export interface CalendarOverlays {
  /** The Media overlay switch. */
  media: boolean
  /** The Breeding overlay switch. */
  breeding: boolean
  /** How breeding rows are drawn on the tile (D4-10). */
  codes: CodesMode
}

/** Frozen because it is also what every failed or invalid read resolves to: a
 *  shared default a caller could mutate is how one flip becomes every default.
 *  `codes` has been 'category' since calendar-breeding-category-default; it was
 *  'every' in 1.0.38 and 1.0.39 (PREVIOUS_DEFAULT_CODES_MODE below). */
export const DEFAULT_CALENDAR_OVERLAYS: Readonly<CalendarOverlays> = Object.freeze({
  media: false, breeding: false, codes: 'category',
})

/** The `codes` default that DEFAULT_CALENDAR_OVERLAYS replaced, kept by name so
 *  the read-time migration is one equality, never a heuristic (CLAUDE.md, the
 *  shipped-default migration rule). Exactly one generation migrates: no older
 *  default ever shipped, since `codes` arrived with the overlays themselves. */
export const PREVIOUS_DEFAULT_CODES_MODE: CodesMode = 'every'

/** The version marker every write from this build on carries, under the stored
 *  document's `v` field. Documents from 1.0.38 and 1.0.39 have no marker, and
 *  that absence is what lets a saved `codes: 'every'` read as the old default
 *  written through rather than a choice. With it, a deliberate Every code is
 *  told apart and survives relaunch. Its literal lives only here. */
export const CALENDAR_OVERLAYS_VERSION = 2

/** The document written under CALENDAR_OVERLAYS_SETTING_KEY: the three fields
 *  and the marker. In memory the preference is a CalendarOverlays without it. */
export interface StoredCalendarOverlays extends CalendarOverlays {
  v: typeof CALENDAR_OVERLAYS_VERSION
}

/** The one builder for the stored document: all three fields, copied field by
 *  field so nothing else rides along, plus the marker. */
export function storedCalendarOverlays(o: CalendarOverlays): StoredCalendarOverlays {
  return { media: o.media, breeding: o.breeding, codes: o.codes, v: CALENDAR_OVERLAYS_VERSION }
}

/**
 * Validate a stored value, field by field (FR-04). Not a plain object (null,
 * an array, a primitive): the default. Each boolean is honoured only when it is
 * strictly `true` or `false`; `codes` only when it is strictly `'every'` or
 * `'category'` (no case folding, no trimming), else the default; unknown fields
 * are ignored and never copied forward, so a two-field pre-amendment document
 * reads `codes` as the default. Returns the frozen default when all three
 * fields equal it, so a hydrate that changes nothing can be skipped by
 * reference.
 *
 * The read-time migration (calendar-breeding-category-default), per field and
 * AFTER the validation above: a valid `codes` equal to
 * PREVIOUS_DEFAULT_CODES_MODE with no marker (an own `v` strictly equal to
 * CALENDAR_OVERLAYS_VERSION; anything else, inherited included, is no marker)
 * came from 1.0.38 or 1.0.39, where it is almost always the old default
 * written through by a Media or Breeding flip, so it reads as carrying no
 * preference and becomes the new default. A marked `'every'` is a choice and
 * is kept, as is `'category'` with or without a marker. `media` and `breeding`
 * read exactly as before. This is a pure read: nothing is written back, and a
 * migrated value is saved, with the marker, only on the user's next change.
 */
export function normalizeCalendarOverlays(raw: unknown): CalendarOverlays {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return DEFAULT_CALENDAR_OVERLAYS
  // OWN properties only: an inherited field (a value built on a prototype, or
  // a polluted Object.prototype) is not something the user stored.
  const src = raw as Record<string, unknown>
  const own = (k: string): unknown => (Object.hasOwn(src, k) ? src[k] : undefined)
  const media = own('media') === true
  const breeding = own('breeding') === true
  const stored = own('codes')
  const valid: CodesMode | null = stored === 'every' || stored === 'category' ? stored : null
  const marked = own('v') === CALENDAR_OVERLAYS_VERSION
  const codes: CodesMode = valid === null || (valid === PREVIOUS_DEFAULT_CODES_MODE && !marked)
    ? DEFAULT_CALENDAR_OVERLAYS.codes
    : valid
  if (!media && !breeding && codes === DEFAULT_CALENDAR_OVERLAYS.codes) return DEFAULT_CALENDAR_OVERLAYS
  return { media, breeding, codes }
}

export function overlaysEqual(a: CalendarOverlays, b: CalendarOverlays): boolean {
  return a.media === b.media && a.breeding === b.breeding && a.codes === b.codes
}

// ── Copy ─────────────────────────────────────────────────────────────────────

export const OVERLAYS_GROUP_LABEL = 'Overlays'
export const MEDIA_SWITCH_LABEL = 'Media'
export const BREEDING_SWITCH_LABEL = 'Breeding'
export const CODES_GROUP_LABEL = 'Breeding rows'
export const CODES_OPTIONS: readonly { value: CodesMode; label: string }[] = [
  { value: 'every', label: 'Every code' },
  { value: 'category', label: 'By category' },
]
export const CODES_GATED_REASON = 'Turn on Breeding to choose how codes show.'

export const LEGEND_MEDIA_CAPTION_LOADED = 'count: Macaulay Library items that day · plain frame: format not in the ML export'
export const LEGEND_MEDIA_CAPTION_NO_EXPORT = 'count: Macaulay Library items that day · load the ML export for formats'
export const LEGEND_BREEDING_CAPTION: Readonly<Record<CodesMode, string>> = {
  every: 'every code recorded that day · count: species carrying it',
  category: 'one row per category that day · count: species with evidence at that category',
}

/** "media on 1 checklist:" / "media on 3 checklists:" (popup header, FR-24). */
export function mediaChecklistsLead(n: number): string {
  return `media on ${n} ${n === 1 ? 'checklist' : 'checklists'}:`
}

/** "breeding evidence: Confirmed" (popup header, FR-26). */
export function breedingEvidenceLead(def: BreedingCodeDef): string {
  return `breeding evidence: ${BREEDING_CATEGORY_LABELS[breedingCategoryForTier(def.tier)]}`
}

/** "· 2 species" on a popup chip, only when more than one species (FR-26). */
export function chipSpeciesTail(n: number): string | null {
  return n > 1 ? `· ${n} species` : null
}

/** "5 media": the invariant plain-count form (tile fallback, popup, legend). */
export function plainMediaPhrase(n: number): string {
  return `${n} media`
}

// ── The mark spec table ──────────────────────────────────────────────────────

export type OverlayMarkKey = 'photo' | 'audio' | 'video' | 'media' | 'confirmed' | 'probable' | 'possible'
export type MediaMarkKey = 'photo' | 'audio' | 'video' | 'media'

/** How a mark is drawn. A lucide glyph is NAMED; Calendar.tsx resolves it. A
 *  path glyph is drawn inline: filled paths fill with currentColor, the rest
 *  stroke with currentColor at `strokeWidth`. */
export type OverlayGlyph =
  | { kind: 'lucide'; icon: 'camera' | 'mic' | 'video' }
  | { kind: 'path'; viewBox: string; strokeWidth: number; paths: readonly { d: string; filled: boolean }[] }

export interface OverlayMarkSpec {
  key: OverlayMarkKey
  /** The legend entry's visible text. */
  label: string
  glyph: OverlayGlyph
  /** The ink token as a var() reference. `var(--sr-cal-fg)` for every key
   *  (D4-02): the marks take the cell's own number colour, whose AA contrast
   *  on every tier in both themes calendarContrast.test.ts already guards and
   *  now also asserts for each token named here. */
  token: string
}

// The frame (a rounded square with a small solid square inside) for media
// whose format is unknown or not loaded, and the atlas fill ladder for the
// categories: solid Confirmed, half Probable, open Possible. Category is
// carried by the SHAPE, never by colour (FR-17, QA-20).
const FRAME_OUTER = 'M3 1h6a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V3a2 2 0 0 1 2-2z'
const FRAME_INNER = 'M4.8 4h2.4a.8.8 0 0 1 .8.8v2.4a.8.8 0 0 1-.8.8H4.8a.8.8 0 0 1-.8-.8V4.8a.8.8 0 0 1 .8-.8z'
const RING = 'M6 2a4 4 0 1 0 0 8a4 4 0 1 0 0-8z'
const DISC = 'M6 .8a5.2 5.2 0 1 0 0 10.4a5.2 5.2 0 1 0 0-10.4z'
const HALF = 'M6 .8a5.2 5.2 0 0 1 0 10.4z'

const INK = 'var(--sr-cal-fg)'

export const OVERLAY_MARK_SPECS: Readonly<Record<OverlayMarkKey, OverlayMarkSpec>> = Object.freeze({
  photo: { key: 'photo', label: 'photos', glyph: { kind: 'lucide', icon: 'camera' }, token: INK },
  audio: { key: 'audio', label: 'audio', glyph: { kind: 'lucide', icon: 'mic' }, token: INK },
  video: { key: 'video', label: 'videos', glyph: { kind: 'lucide', icon: 'video' }, token: INK },
  media: {
    key: 'media', label: 'media', token: INK,
    glyph: { kind: 'path', viewBox: '0 0 12 12', strokeWidth: 2, paths: [{ d: FRAME_OUTER, filled: false }, { d: FRAME_INNER, filled: true }] },
  },
  confirmed: {
    key: 'confirmed', label: BREEDING_CATEGORY_LABELS.confirmed, token: INK,
    glyph: { kind: 'path', viewBox: '0 0 12 12', strokeWidth: 2.4, paths: [{ d: DISC, filled: true }] },
  },
  probable: {
    key: 'probable', label: BREEDING_CATEGORY_LABELS.probable, token: INK,
    glyph: { kind: 'path', viewBox: '0 0 12 12', strokeWidth: 2.4, paths: [{ d: RING, filled: false }, { d: HALF, filled: true }] },
  },
  possible: {
    key: 'possible', label: BREEDING_CATEGORY_LABELS.possible, token: INK,
    glyph: { kind: 'path', viewBox: '0 0 12 12', strokeWidth: 2.4, paths: [{ d: RING, filled: false }] },
  },
})

/** The legend's Media entries: every format and the frame with the export
 *  loaded, the frame alone without it (FR-30). */
export function legendMediaKeys(exportLoaded: boolean): readonly MediaMarkKey[] {
  return exportLoaded ? ['photo', 'audio', 'video', 'media'] : ['media']
}

/** The legend's Breeding entries, strongest to weakest. */
export const LEGEND_BREEDING_KEYS: readonly BreedingCategory[] = BREEDING_CATEGORY_ORDER

export function breedingMarkKey(def: BreedingCodeDef): BreedingCategory {
  return breedingCategoryForTier(def.tier)
}

// ── Bounded code text ────────────────────────────────────────────────────────

/** Code points shown of an unknown code before the ellipsis. */
export const CODE_TEXT_MAX_CODE_POINTS = 8

/**
 * The code as printed on a tile, in an accessible name, and as a popup chip's
 * code. A known code is its own text (at most two characters). An unknown code
 * is the parser's raw first token, bounded only by the CSV cell, so it is cut
 * to its first 8 code points plus U+2026 when longer. Walks code points, never
 * UTF-16 units, so an astral character is never split; reads at most 16 units
 * whatever the token's length (O(1)).
 */
export function codeText(def: BreedingCodeDef): string {
  const s = def.code
  let i = 0
  for (let cp = 0; cp < CODE_TEXT_MAX_CODE_POINTS && i < s.length; cp++) {
    const hi = s.charCodeAt(i)
    const pair = hi >= 0xd800 && hi <= 0xdbff && i + 1 < s.length
      && s.charCodeAt(i + 1) >= 0xdc00 && s.charCodeAt(i + 1) <= 0xdfff
    i += pair ? 2 : 1
  }
  return i < s.length ? `${s.slice(0, i)}\u2026` : s
}

/** Code points of an unknown code shown WHOLE on a tile: every real eBird
 *  code is one or two characters, so a two-character unknown code (a future or
 *  legacy code) reads like a real one. */
export const TILE_CODE_MAX_CODE_POINTS = 2

/**
 * The code as printed on a TILE (rich and condensed rows). A known code is its
 * own text. An unknown code of more than TILE_CODE_MAX_CODE_POINTS code points
 * shows its first code point and U+2026: the tile is designed and measured AT
 * this bound (calendar-overlays QA F2), because codeText's 8 code points, the
 * bound chosen for SAFETY, cannot fit a tile at 0.5625rem. The popup and the
 * day's accessible name keep codeText, the whole bounded code (schema decision
 * 15), so nothing is lost. Walks code points, never splits an astral one, and
 * reads at most six UTF-16 units whatever the token's length (O(1)).
 */
export function tileCodeText(def: BreedingCodeDef): string {
  const s = def.code
  let i = 0
  let cps = 0
  let first = 0
  // At most MAX + 1 code points: enough to know the code is longer than MAX.
  while (i < s.length && cps <= TILE_CODE_MAX_CODE_POINTS) {
    const hi = s.charCodeAt(i)
    const pair = hi >= 0xd800 && hi <= 0xdbff && i + 1 < s.length
      && s.charCodeAt(i + 1) >= 0xdc00 && s.charCodeAt(i + 1) <= 0xdfff
    i += pair ? 2 : 1
    cps++
    if (cps === 1) first = i
  }
  return cps > TILE_CODE_MAX_CODE_POINTS ? `${s.slice(0, first)}\u2026` : s
}

/** The tile's inline padding, in rem, on each side. The fact blocks give it
 *  back (globals.css widens them by twice this and clips at the cell edge), so
 *  the two declarations are one number, compared by calendarOverlaysCss.test. */
export const TILE_PADDING_INLINE_REM = 0.125

// ── Media phrases ────────────────────────────────────────────────────────────

export interface MediaPart {
  key: MediaMarkKey
  count: number
  text: string
}

/** 1 photo / 2 photos, 1 audio / 2 audio, 1 video / 2 videos, N media: no count
 *  of one ever takes a plural noun (QA-29). */
function mediaPhrase(key: MediaMarkKey, n: number): string {
  if (key === 'photo') return `${n} ${n === 1 ? 'photo' : 'photos'}`
  if (key === 'video') return `${n} ${n === 1 ? 'video' : 'videos'}`
  if (key === 'audio') return `${n} audio`
  return plainMediaPhrase(n)
}

/** The per-format parts of a count, in the fixed order photo, audio, video,
 *  then (when `includeUnknown`) the unknown bucket as "N media"; zeros omitted.
 *  Empty when no format resolved and nothing is unknown (the null-map case). */
export function mediaFormatParts(counts: MediaFormatCounts, includeUnknown = true): MediaPart[] {
  const out: MediaPart[] = []
  if (counts.photo) out.push({ key: 'photo', count: counts.photo, text: mediaPhrase('photo', counts.photo) })
  if (counts.audio) out.push({ key: 'audio', count: counts.audio, text: mediaPhrase('audio', counts.audio) })
  if (counts.video) out.push({ key: 'video', count: counts.video, text: mediaPhrase('video', counts.video) })
  if (includeUnknown && counts.unknown) out.push({ key: 'media', count: counts.unknown, text: mediaPhrase('media', counts.unknown) })
  return out
}

/** ['2 photos', '1 audio', '3 media'] (schema.md 4.2). */
export function mediaFormatPhrases(counts: MediaFormatCounts): string[] {
  return mediaFormatParts(counts).map(p => p.text)
}

/** Whether any id resolved to a real format (photo, audio or video). */
function anyFormatResolved(c: MediaFormatCounts): boolean {
  return c.photo + c.audio + c.video > 0
}

// ── The accessible-name suffix ───────────────────────────────────────────────

/**
 * The overlay clauses of a day's accessible name, media then breeding, each
 * present only while its overlay is on and the day carries that fact, or ''
 * (FR-29). Media: ", media: 3 photos, 1 audio" when the export resolved at
 * least one format (an unknown bucket reads ", media: 3 photos, 2 media"), else
 * ", media: 5". Breeding: every distinct code in strongest-first order with its
 * species count and category, ", breeding: NY 1 (Confirmed), S 2 (Possible)";
 * the codes mode never shortens it.
 */
export function dayNameSuffix(
  cell: Pick<DayCell, 'mediaIds' | 'mediaIdCount' | 'codes'>,
  overlays: CalendarOverlays,
  mediaMap: Record<string, string> | null,
): string {
  let out = ''
  if (overlays.media && cell.mediaIdCount > 0) {
    const counts = mediaFormatCounts(cell.mediaIds, mediaMap)
    out += anyFormatResolved(counts)
      ? `, media: ${mediaFormatPhrases(counts).join(', ')}`
      : `, media: ${cell.mediaIdCount}`
  }
  if (overlays.breeding && cell.codes.length > 0) {
    const parts: string[] = []
    for (const f of cell.codes) {
      parts.push(`${codeText(f.def)} ${f.speciesCount} (${BREEDING_CATEGORY_LABELS[breedingMarkKey(f.def)]})`)
    }
    out += `, breeding: ${parts.join(', ')}`
  }
  return out
}

// ── The tile rows ────────────────────────────────────────────────────────────

export type TileRow =
  | { kind: 'media'; key: MediaMarkKey; count: number }
  | { kind: 'code'; key: BreedingCategory; code: string; count: number | null }
  /** A "By category" row (D4-11): the category itself, never a code. `label`
   *  is the short form on a rich row and null on a condensed one (circle and
   *  count only); `count` is the distinct species with evidence at it. */
  | { kind: 'category'; key: BreedingCategory; label: string | null; count: number }
  | { kind: 'more'; count: number }

export interface TileRows {
  rich: TileRow[]
  condensed: TileRow[]
}

/** Past this many code rows the rich tile shows a single "+N" row. */
export const TILE_CODE_ROW_CAP = 3

/**
 * The two fact blocks of one cell (FR-17, FR-37, FR-38), from the cell's facts
 * and the render-time inputs only. Pure: the cell renders BOTH lists and the
 * stylesheet shows one by the cell's own width, so a resize never re-renders.
 * Both lists are empty with both overlays off, which is what lets the cell
 * render no fact block at all in that state (FR-19).
 */
export function tileRows(
  cell: Pick<DayCell, 'mediaIds' | 'mediaIdCount' | 'codes' | 'codeCategoryCounts'>,
  overlays: CalendarOverlays,
  mediaMap: Record<string, string> | null,
): TileRows {
  const rich: TileRow[] = []
  const condensed: TileRow[] = []

  if (overlays.media && cell.mediaIdCount > 0) {
    if (mediaMap === null) {
      rich.push({ kind: 'media', key: 'media', count: cell.mediaIdCount })
    } else {
      for (const p of mediaFormatParts(mediaFormatCounts(cell.mediaIds, mediaMap))) {
        rich.push({ kind: 'media', key: p.key, count: p.count })
      }
    }
    condensed.push({ kind: 'media', key: 'media', count: cell.mediaIdCount })
  }

  const codes = cell.codes
  if (overlays.breeding && codes.length > 0) {
    if (overlays.codes === 'category') {
      // "By category" names the CATEGORIES, never a code (D4-11): one row per
      // category present, strongest category first, with the distinct species
      // with evidence at it. At most three rows, so never a "+N". Rich rows
      // carry the short form; condensed rows are the circle and the count.
      for (const cat of BREEDING_CATEGORY_ORDER) {
        const n = cell.codeCategoryCounts[cat]
        if (n <= 0) continue
        rich.push({ kind: 'category', key: cat, label: BREEDING_CATEGORY_SHORT[cat], count: n })
        condensed.push({ kind: 'category', key: cat, label: null, count: n })
      }
    } else {
      const shown = Math.min(codes.length, TILE_CODE_ROW_CAP)
      for (let i = 0; i < shown; i++) {
        const f = codes[i]
        rich.push({ kind: 'code', key: breedingMarkKey(f.def), code: tileCodeText(f.def), count: f.speciesCount })
      }
      if (codes.length > TILE_CODE_ROW_CAP) rich.push({ kind: 'more', count: codes.length - TILE_CODE_ROW_CAP })
      const top = codes[0].def
      condensed.push({ kind: 'code', key: breedingMarkKey(top), code: tileCodeText(top), count: null })
      if (codes.length > 1) condensed.push({ kind: 'more', count: codes.length - 1 })
    }
  }

  return { rich, condensed }
}

/**
 * The digits of the widest "By category" count on a rich tile (1, 2, or 3 for
 * anything larger), or 0 when the tile has no category row. A category row's
 * short label is wider than any code, so the width at which its tile turns
 * compact depends on its count's digits (D4-11, measured in both engines,
 * decisions.md E5-12): the cell carries the answer as a class and one container
 * query per digit length flips the tile, since a query can answer how wide the
 * box is but not how wide its content is.
 */
export function categoryCountDigits(rich: readonly TileRow[]): 0 | 1 | 2 | 3 {
  let widest = 0
  for (const r of rich) if (r.kind === 'category' && r.count > widest) widest = r.count
  return widest === 0 ? 0 : widest < 10 ? 1 : widest < 100 ? 2 : 3
}
