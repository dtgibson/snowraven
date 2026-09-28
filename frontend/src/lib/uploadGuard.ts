import { detectExportType } from './detectExportType'
import { REGION_CODE_RE } from './regionCode'
// TYPE ONLY, and that is load-bearing: this module is on App.tsx's static graph
// (Settings.tsx imports it), and the bar-chart parser must stay off the entry
// chunk (entryChunk.test.ts). `import type` is erased at build, so the parse
// arrives as a PARAMETER of refuseBarChartByContent instead of an import.
import type { BarChartParseOutcome } from './barChart/parseBarChart'

/**
 * The two refusals Settings applies to a file before it is stored, and the copy
 * they render.
 *
 * ONE MODULE, TWO FUNCTIONS, BECAUSE THE RULE IS A REGISTRY AND NOT A DISCIPLINE.
 * `Settings.importFileContent` is the single chokepoint every platform's import
 * reaches (`IOS_IMPORT_MECHANISM` is `'input'`, so the file input serves desktop,
 * web, Pi, iPhone and iPad alike; the native picker path shares the same tail).
 * A future third import path that calls the chokepoint gets both guards; one that
 * does not gets neither, visibly, rather than getting half of them.
 *
 * Both refusals render in the per-slot error line the row has always had, the same
 * line that shows `CSV_ONLY_MESSAGE`. No new state, control or screen.
 */

/**
 * The size cap, in UTF-8 bytes. This is the FRONT half of a cap the backend has
 * enforced all along: `MAX_BYTES` in `backend/routers/settings.py` is the same
 * literal and answers `413` above it. Keep the two in step — the parity is checked
 * by `uploadGuard.test.ts`, which reads the Python constant.
 *
 * Enforcing it here as well is not belt-and-braces. Web and Pi are the only
 * platforms that ever saw the backend's 413, and until this build `WebStorage`
 * discarded the response, so an over-cap upload reported success; desktop and iOS
 * write straight to `AppLocalData` and have never had a cap at all. The guard at
 * the chokepoint is what makes the refusal true on every platform, and the response
 * check in `storage.ts` is what makes the backend's own answer audible on the one
 * platform that gives it.
 */
const BYTES_PER_MEGABYTE = 1024 * 1024
export const MAX_UPLOAD_BYTES = 50 * BYTES_PER_MEGABYTE

/** Unchanged, and moved here so all three refusals for this row live together. */
export const CSV_ONLY_MESSAGE = 'Only .csv files are accepted.'

/** Refusal 1: over the cap. One sentence, because there is no repair to offer —
 *  an export is the size it is, and the user cannot shrink it. */
export const TOO_LARGE_MESSAGE =
  `That file is larger than ${MAX_UPLOAD_BYTES / BYTES_PER_MEGABYTE} MB, so it was not saved.`

/**
 * Refusal 2: the right kind of file, in the wrong slot (or a CSV that is neither).
 *
 * Says what THIS slot takes rather than what the offered file appeared to be, so
 * the sentence is true for an unrecognized CSV as well as for the swap the guard
 * was written for, and names the other slot so a swap is one action to undo. Slot
 * names are the labels the rows render, `eBird Backup` and `ML Export`.
 */
export function wrongExportMessage(slot: 'ebird' | 'ml'): string {
  return slot === 'ml'
    ? 'That does not look like a Macaulay Library export, so it was not saved. '
      + 'The ML Export slot takes the spreadsheet you save from My Media at macaulaylibrary.org; '
      + 'MyEBirdData.csv goes in the eBird Backup slot.'
    : 'That does not look like an eBird backup, so it was not saved. '
      + 'The eBird Backup slot takes MyEBirdData.csv from an eBird Download My Data request; '
      + 'the Macaulay Library spreadsheet goes in the ML Export slot.'
}

/**
 * True when `text` encodes to MORE than `limit` UTF-8 bytes.
 *
 * Counts the encoding rather than performing it, and stops as soon as the limit is
 * passed, so the check allocates nothing and reads at most `limit` bytes' worth of
 * input. The obvious spellings both build a second copy of a file that may be
 * 50 MB: `new TextEncoder().encode(text).byteLength` allocates the whole encoding,
 * and `new Blob([text]).size` allocates the whole blob. This is the same shape as
 * the backend's `upload.read(MAX_BYTES + 1)`, which reads one byte past the cap
 * rather than the whole body, for the same reason.
 *
 * UTF-8 byte length is the right unit because it is what reaches disk on every
 * platform and what the backend counts. `text.length` is not a substitute: it
 * counts UTF-16 code units, which is a LOWER bound on the byte length, so a file of
 * accented place names would slip past a check written that way.
 *
 * The suite proves this equals `new TextEncoder().encode(text).byteLength` over
 * probes including a lone surrogate at each end, which encodes as one replacement
 * character (three bytes) rather than being dropped.
 */
export function exceedsUtf8ByteLimit(text: string, limit: number): boolean {
  let bytes = 0
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i)
    if (c < 0x80) {
      bytes += 1
    } else if (c < 0x800) {
      bytes += 2
    } else if (
      c >= 0xd800 && c <= 0xdbff
      && i + 1 < text.length && (text.charCodeAt(i + 1) & 0xfc00) === 0xdc00
    ) {
      // A well-formed surrogate pair is one code point in four bytes. A lone
      // surrogate on either half falls through to the three-byte branch, which is
      // what TextEncoder does with it (U+FFFD).
      bytes += 4
      i += 1
    } else {
      bytes += 3
    }
    if (bytes > limit) return true
  }
  return false
}

/** The two stored-file families that go through this registry: the eBird backup
 *  and ML export CSVs (Settings), and a county's eBird bar-chart file (Targets,
 *  targets-tab schema.md section 2.3). */
export type UploadKind = 'csv' | 'barchart'

/**
 * The filename guard, applied before the file is read. Returns the message to
 * show, or null to continue.
 *
 * Kept separate from the content guard because it is the one check that does not
 * need the bytes: refusing here means a 200 MB `.zip` is never read into memory to
 * be refused afterwards.
 *
 * `kind` is DEFAULTED so the two Settings call sites are byte-identical in
 * behaviour: they pass nothing and get the csv rule they always had.
 */
export function refuseByFilename(filename: string, kind: UploadKind = 'csv'): string | null {
  if (kind === 'barchart') {
    const lower = filename.toLowerCase()
    if (!lower.endsWith('.txt') && !lower.endsWith('.tsv')) return BARCHART_EXTENSION_MESSAGE
    return filename.length > BARCHART_FILENAME_MAX ? BARCHART_NAME_TOO_LONG_MESSAGE : null
  }
  return filename.toLowerCase().endsWith('.csv') ? null : CSV_ONLY_MESSAGE
}

// ── eBird bar-chart files (targets-tab, schema.md section 2.3) ────────────────
// The same registry, so the Targets import gets every refusal the CSV imports
// get or visibly none: size (the same 50 MB cap), then the filename's region
// code, then the layout. A refusal stores nothing, clears nothing and bumps no
// epoch (FR-27); that half lives in lib/barChart/barChartImport.ts.

/** Refusal: a name eBird's download would never carry (FR-28). */
export const BARCHART_EXTENSION_MESSAGE = 'Only .txt or .tsv bar-chart files are accepted.'

/** Refusal: the bytes are not a bar chart's layout (FR-28's exact words). */
export const BARCHART_LAYOUT_MESSAGE =
  "This is not an eBird bar-chart file. Download it from the county's bar chart page on ebird.org (Download Histogram Data)."

/** Refusal: the name starts like eBird's but its region code is unreadable.
 *  Names only the selected county's context, never the filename (QA-70). */
export const BARCHART_UNREADABLE_CODE_MESSAGE =
  "This file's name carries a region code SnowRaven cannot read. Rename it, or download the county's file again from ebird.org."

/**
 * Refusal: the file is another county's (FR-29). `fileRegionCode` is the code
 * the filename parser VALIDATED against the region-code shape, so it is safe to
 * show; the raw filename never is.
 */
export function barChartRegionMismatchMessage(fileRegionCode: string, countyLabel: string): string {
  return `This file is for ${fileRegionCode}, not ${countyLabel}. Open ${countyLabel} and add it there, or download ${countyLabel}'s file.`
}

/** What eBird's bar-chart download name says about the file. */
export interface BarChartFilenameInfo {
  /** The validated county region code, uppercase, or null when absent. */
  regionCode: string | null
  /** The download's year range, [first, last]. */
  years: [number, number] | null
  /** The download's month range, [begin, end] in 1..12; begin > end wraps. */
  months: [number, number] | null
  /** True when the name begins like eBird's download (`ebird_` ... `__`) and
   *  does not match its shape: the import is then refused (QA-70). */
  malformedCode: boolean
}

/** eBird's download name, e.g. `ebird_US-CA-001__1900_2026_1_12_barchart.txt`,
 *  with the ` (1)` a browser appends to a repeated download. Anchored, fixed
 *  classes (explicit [0-9], never \d), bounded quantifiers, no alternation
 *  under a quantifier: linear, no backtracking blowup (schema.md section 10).
 *  Case-insensitive, so the captured code is uppercased and re-validated. */
const BARCHART_FILENAME_RE =
  /^ebird_(US-[A-Z]{2}-[0-9]{3})__([0-9]{4})_([0-9]{4})_([0-9]{1,2})_([0-9]{1,2})_barchart(?: \([0-9]{1,3}\))?\.(?:txt|tsv)$/i

/**
 * The longest bar-chart filename, in UTF-16 code units (`.length`). ONE
 * declaration with three readers, so they cannot drift: the manifest reader
 * (`normalizeBarChartManifest` in `storage.ts`) drops an entry past it, so the
 * import refuses a name past it (`refuseByFilename`) and the desktop writer
 * refuses to record one (`TauriStorage.writeBarChartFile`); otherwise the file
 * would be stored under a manifest entry the reader then drops, invisible and
 * orphaned (security review L2). The web/Pi route's `_FILENAME_MAX` in
 * `backend/routers/barcharts.py` is compared to this one by
 * `uploadGuard.test.ts`. eBird's own names are about 45 characters.
 */
export const BARCHART_FILENAME_MAX = 255

/** Refusal: a name longer than the manifest can hold. A platform picker cannot
 *  produce one (APFS, NTFS and ext4 cap names at 255), so this is a plain
 *  reason with one repair rather than a number to count against. */
export const BARCHART_NAME_TOO_LONG_MESSAGE = "That file's name is too long, so it was not saved. Rename it and add it again."

/**
 * Parse a picked file's name. A name that matches yields its region code,
 * years and months; a name that begins `ebird_` and carries `__` but does not
 * match (a non-US code such as `ebird_CA-ON__...`, junk, an impossible month)
 * sets `malformedCode`; any other name (`barchart.txt`) yields all-null and is
 * attributed to the county whose view the import happened in (FR-29).
 */
export function parseBarChartFilename(filename: string): BarChartFilenameInfo {
  const none: BarChartFilenameInfo = { regionCode: null, years: null, months: null, malformedCode: false }
  const looksLikeEbird = filename.toLowerCase().startsWith('ebird_') && filename.indexOf('__') !== -1
  const malformed: BarChartFilenameInfo = { ...none, malformedCode: true }
  if (filename.length > BARCHART_FILENAME_MAX) return looksLikeEbird ? malformed : none
  const m = BARCHART_FILENAME_RE.exec(filename)
  if (!m) return looksLikeEbird ? malformed : none
  const regionCode = m[1].toUpperCase()
  const y1 = Number(m[2])
  const y2 = Number(m[3])
  const b = Number(m[4])
  const e = Number(m[5])
  if (!REGION_CODE_RE.test(regionCode)) return malformed
  if (y1 > y2 || b < 1 || b > 12 || e < 1 || e > 12) return malformed
  return { regionCode, years: [y1, y2], months: [b, e], malformedCode: false }
}

/**
 * The content guards for a bar-chart file, applied to the bytes once read and
 * before anything is written. Returns the message to show, or null to store.
 *
 * In order: the size cap (the answer does not depend on the content being
 * meaningful); the filename's region code, unreadable or another county's; then
 * the layout. The parse is a PARAMETER (the caller passes `parseBarChart`) so
 * this entry-graph module never statically imports the parser.
 */
export function refuseBarChartByContent(
  content: string,
  ctx: { filename: string; regionCode: string; countyLabel: string },
  parse: (text: string) => BarChartParseOutcome,
): string | null {
  if (exceedsUtf8ByteLimit(content, MAX_UPLOAD_BYTES)) return TOO_LARGE_MESSAGE
  const info = parseBarChartFilename(ctx.filename)
  if (info.malformedCode) return BARCHART_UNREADABLE_CODE_MESSAGE
  if (info.regionCode !== null && info.regionCode !== ctx.regionCode) {
    return barChartRegionMismatchMessage(info.regionCode, ctx.countyLabel)
  }
  if (!parse(content).ok) return BARCHART_LAYOUT_MESSAGE
  return null
}

/**
 * The content guards, applied to the bytes once read and before anything is
 * written. Returns the message to show, or null to store the file.
 *
 * Size is checked before type, because the type check reads the header of a file
 * that may be enormous and the size answer does not depend on the content being
 * meaningful.
 */
export function refuseByContent(slot: 'ebird' | 'ml', content: string): string | null {
  if (exceedsUtf8ByteLimit(content, MAX_UPLOAD_BYTES)) return TOO_LARGE_MESSAGE
  if (detectExportType(content) !== slot) return wrongExportMessage(slot)
  return null
}
