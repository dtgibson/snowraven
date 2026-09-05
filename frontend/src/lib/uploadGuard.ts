import { detectExportType } from './detectExportType'

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
export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024

/** Unchanged, and moved here so all three refusals for this row live together. */
export const CSV_ONLY_MESSAGE = 'Only .csv files are accepted.'

/** Refusal 1: over the cap. One sentence, because there is no repair to offer —
 *  an export is the size it is, and the user cannot shrink it. */
export const TOO_LARGE_MESSAGE = 'That file is larger than 50 MB, so it was not saved.'

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

/**
 * The filename guard, applied before the file is read. Returns the message to
 * show, or null to continue.
 *
 * Kept separate from the content guard because it is the one check that does not
 * need the bytes: refusing here means a 200 MB `.zip` is never read into memory to
 * be refused afterwards.
 */
export function refuseByFilename(filename: string): string | null {
  return filename.toLowerCase().endsWith('.csv') ? null : CSV_ONLY_MESSAGE
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
