// The iOS widget hand-over document (ios-lifer-widgets, schema.md section 1).
//
// The home-screen widgets are a separate Swift process that cannot run this
// webview or read the app's `AppLocalData/data/` documents. So the app hands
// over, in one small document in the App Group container, the static inputs
// only it knows, and the widget does the live part (location, one eBird
// request, the subtraction, the sort). This module builds that document. The
// Rust command `widgets_write_handover` (src-tauri/src/widgets.rs) writes it,
// and the extension's `Handover.swift` reads it.
//
// ENTRY-SAFE. App.tsx imports `widgetsSupported` from here statically, so this
// file's imports are limited to `platform.ts` and `speciesUtils.ts`, and the
// latter is ALREADY on App.tsx's static graph (entryChunk.test.ts asserts both,
// so the claim is checked rather than remembered). The controller that reads
// the stored files and calls native is dynamic-imported only.
//
// THE DOCUMENT CARRIES ONLY WHAT FR-30 LISTS, BY CONSTRUCTION: the builder
// reads observation rows and Macaulay rows solely to compute four folded name
// sets, so no row, checklist id, ML asset id or OpenWeather key can reach it.
//
// THE SAME BOUNDS ARE ENFORCED ON ALL THREE SIDES (schema.md section 1.2),
// each with its own test that goes red when that side's enforcement is
// deleted: this builder SKIPS a name the per-name check refuses and REFUSES a
// document over a set, byte or key bound (returns null), the Rust command
// refuses the body, and the Swift reader treats an over-bound document as
// absent. `widgetPaths.parity.test.ts` pins the constants to one value across
// the three languages. A refused build never leaves a removed key behind: the
// controller then writes `buildRevocation`'s document instead
// (widgetHandoverController.ts).

import { isIOS, isTauri } from '../platform'
import { normalizeSpeciesName } from '../speciesUtils'

/** The App Group both targets are entitled to. */
export const APP_GROUP_ID = 'group.com.dtgibson.snowraven'
/** The container subdirectory this feature owns, and the file in it. */
export const WIDGETS_DIR = 'widgets'
export const HANDOVER_FILE = 'handover.json'
export const HANDOVER_VERSION = 1
/** The whole serialized document, in UTF-8 bytes. */
export const HANDOVER_MAX_BYTES = 4_000_000
/** Entries per name set. The world list is about 11,000 species; 20,000
 *  leaves room for forms and spuhs in a large backup. */
export const MAX_SET_ENTRIES = 20_000
/** Per name, in UTF-16 code units: well above the longest eBird common name. */
export const MAX_NAME_UNITS = 200
/** The eBird key: `^[A-Za-z0-9]{1,128}$`, a class that cannot express a
 *  header separator. 128 is the app's own key bound (keyRecord.ts). */
export const MAX_KEY_LEN = 128
export const EBIRD_KEY_RE = /^[A-Za-z0-9]{1,128}$/
/** `appVersion` is display-only in the extension. */
export const APP_VERSION_RE = /^[0-9A-Za-z.+-]{1,32}$/
/** ISO-8601 UTC to the second. */
export const WRITTEN_AT_RE = /^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}Z$/

export interface WidgetHandoverV1 {
  version: 1
  writtenAt: string
  appVersion: string
  /** The user's eBird key verbatim, or null (no key stored, or cleared: S2). */
  ebirdKey: string | null
  /** false = no eBird backup stored (S3); `recorded` is then []. */
  hasEbirdBackup: boolean
  /** Folded names of every observation row, distinct, sorted by code unit. */
  recorded: string[]
  /** false = no Macaulay export loaded (S4); the three target sets are then []. */
  hasMlExport: boolean
  targetsMissingPhoto: string[]
  targetsMissingAudio: string[]
  targetsMissingVideo: string[]
  /** The saved Default Location's coordinates, or null. */
  defaultLocation: { lat: number; lng: number } | null
}

export interface HandoverInputs {
  /** The app's clock at build time, ms since the epoch. */
  nowMs: number
  appVersion: string
  ebirdKey: string | null
  /** Every parsed observation row, or null when no eBird backup is stored. */
  observations: ReadonlyArray<{ commonName: string }> | null
  /** Every parsed Macaulay row, or null when no export is loaded. An EMPTY
   *  export counts as none, exactly as the in-app `hasML` does. */
  mlRows: ReadonlyArray<{ commonName: string; format: string }> | null
  /** The raw `map-defaults` setting value, whatever the store returned. */
  mapDefaults: unknown
}

/**
 * The one name rule the widget compares with, on both sides of the process
 * boundary: the app's `normalizeSpeciesName` (trim, then strip one trailing
 * parenthetical group), then the Unicode default case mapping. The hand-over
 * is folded at WRITE time, so the extension folds only eBird's `comName`
 * (`SpeciesName.fold` in Swift; `foldName` in the TS twin is this function).
 */
export function foldSpeciesName(name: string): string {
  return normalizeSpeciesName(name).toLowerCase()
}

/**
 * A name the three validators accept: 1 to 200 UTF-16 code units, no C0
 * control character or DEL anywhere, and no JavaScript-trim whitespace at
 * either end (`s === s.trim()` IS that definition; the Rust and Swift sides
 * spell the same set out by hand).
 */
export function isValidHandoverName(s: string): boolean {
  if (s.length < 1 || s.length > MAX_NAME_UNITS || s !== s.trim()) return false
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i)
    if (c <= 0x1f || c === 0x7f) return false
  }
  return true
}

/** Code-unit order, no locale: a plain comparison of the strings. */
function byCodeUnit(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}

function sortedDistinct(names: Iterable<string>): string[] {
  return [...new Set(names)].sort(byCodeUnit)
}

function readDefaultLocation(raw: unknown): { lat: number; lng: number } | null {
  if (raw === null || typeof raw !== 'object') return null
  const { lat, lng } = raw as { lat?: unknown; lng?: unknown }
  if (typeof lat !== 'number' || typeof lng !== 'number') return null
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null
  return { lat, lng }
}

const MEDIA_TYPES = ['Photo', 'Audio', 'Video'] as const

/**
 * Build the whole document, or null when the key is outside its class or a
 * set or byte bound is exceeded (the document is refused, never truncated).
 *
 * The recorded set is every observation row's folded name, with NO
 * countability filter, no escapee exclusion and no subspecies distinction,
 * because the in-app Nearby Lifers view applies none (FR-14). The three
 * target sets are the in-app Media Targets definition split per type: for each
 * distinct RAW common name in the backup, the Macaulay rows under that raw
 * name are checked for Photo, Audio and Video, and the folded name joins the
 * set for each type it lacks (FR-15). Their union is `targetSpecies` in
 * MapExplorer.tsx, and a species holding all three types is in none.
 *
 * A name the per-name check refuses (it folds to the empty string, carries a
 * control character, or is over 200 UTF-16 units) is SKIPPED rather than
 * refusing the document (security review M1). It is not truncation: the
 * extension compares with the fold of eBird's `comName`, which never has that
 * shape, so dropping the name changes no row. Refusing instead let one odd
 * name in the user's own backup block every later rewrite, and with it the
 * removal of a cleared key.
 */
export function buildHandover(inputs: HandoverInputs): WidgetHandoverV1 | null {
  if (inputs.ebirdKey !== null && !EBIRD_KEY_RE.test(inputs.ebirdKey)) return null
  if (!APP_VERSION_RE.test(inputs.appVersion)) return null
  // A finite clock past the Date range makes `toISOString` THROW rather than
  // return a string the check below can refuse, so it is refused here first.
  if (!Number.isFinite(inputs.nowMs) || Number.isNaN(new Date(inputs.nowMs).getTime())) return null
  const writtenAt = new Date(inputs.nowMs).toISOString().slice(0, 19) + 'Z'
  if (!WRITTEN_AT_RE.test(writtenAt)) return null

  const hasEbirdBackup = inputs.observations !== null
  const hasMlExport = inputs.mlRows !== null && inputs.mlRows.length > 0

  const recordedSet = new Set<string>()
  const rawNames = new Set<string>()
  for (const o of inputs.observations ?? []) {
    rawNames.add(o.commonName)
    const f = foldSpeciesName(o.commonName)
    if (isValidHandoverName(f)) recordedSet.add(f)
  }

  const missing: Record<(typeof MEDIA_TYPES)[number], Set<string>> = {
    Photo: new Set(), Audio: new Set(), Video: new Set(),
  }
  if (hasEbirdBackup && hasMlExport) {
    // The in-app `mediaTypes` map: raw ML common name -> the formats it holds.
    const held = new Map<string, Set<string>>()
    for (const row of inputs.mlRows!) {
      let s = held.get(row.commonName)
      if (!s) { s = new Set(); held.set(row.commonName, s) }
      s.add(row.format)
    }
    for (const raw of rawNames) {
      const f = foldSpeciesName(raw)
      if (!isValidHandoverName(f)) continue
      const types = held.get(raw)
      for (const t of MEDIA_TYPES) if (!types?.has(t)) missing[t].add(f)
    }
  }

  const doc: WidgetHandoverV1 = {
    version: HANDOVER_VERSION,
    writtenAt,
    appVersion: inputs.appVersion,
    ebirdKey: inputs.ebirdKey,
    hasEbirdBackup,
    recorded: sortedDistinct(recordedSet),
    hasMlExport,
    targetsMissingPhoto: sortedDistinct(missing.Photo),
    targetsMissingAudio: sortedDistinct(missing.Audio),
    targetsMissingVideo: sortedDistinct(missing.Video),
    defaultLocation: readDefaultLocation(inputs.mapDefaults),
  }

  for (const set of [doc.recorded, doc.targetsMissingPhoto, doc.targetsMissingAudio, doc.targetsMissingVideo]) {
    if (set.length > MAX_SET_ENTRIES) return null
  }
  if (handoverByteLength(serializeHandover(doc)) > HANDOVER_MAX_BYTES) return null
  return doc
}

/**
 * The document that REVOKES (security review M1): no key, no backup, no
 * export, no Default Location. The widget reads it as S2 ("Add your eBird
 * API key"), which is checked before anything else it holds, and makes no
 * request. The controller writes it when a whole rewrite cannot finish but
 * the key or a file was removed or replaced, so nothing the user removed stays
 * in the App Group. An app version the class refuses is written as `unknown`,
 * the value the controller already falls back to. The one exception: a clock
 * outside the years 0000 to 9999 (including one past the Date range) cannot
 * be written as `writtenAt`, so this returns null, and the controller then
 * falls back to removing the document (`widgets_remove_handover`).
 */
export function buildRevocation(nowMs: number, appVersion: string): WidgetHandoverV1 | null {
  return buildHandover({
    nowMs,
    appVersion: APP_VERSION_RE.test(appVersion) ? appVersion : 'unknown',
    ebirdKey: null,
    observations: null,
    mlRows: null,
    mapDefaults: null,
  })
}

/** The document as written: one JSON object, keys in declaration order. */
export function serializeHandover(doc: WidgetHandoverV1): string {
  return JSON.stringify(doc)
}

/** UTF-8 byte length, the unit the Rust and Swift size bounds measure. */
export function handoverByteLength(text: string): number {
  return new TextEncoder().encode(text).length
}

/**
 * The platform gate: the iPhone and iPad apps only. On macOS, Windows, web and
 * Pi this is false, the controllers are never imported, and no hand-over is
 * written (FR-32).
 */
export function widgetsSupported(): boolean {
  return isTauri() && isIOS()
}
