import { firstLine } from './firstLine'

/** Which Default Files slot a CSV's header line says it belongs to. The two
 *  values match the slot names used by `storage` and by Settings' file rows, so
 *  a caller compares directly against its slot rather than through a mapping. */
export type ExportType = 'ml' | 'ebird' | 'unknown'

/**
 * Classify a stored or offered CSV from its HEADER LINE alone.
 *
 * Moved out of `LifeList.tsx` (where it was `detectFileType`) because it now has
 * two readers that must agree: Settings refuses an upload whose content does not
 * match the slot it was dropped into, and Multimedia refuses to parse a stored
 * file that is not a Macaulay Library export. Two header sniffers would drift, and
 * the drift shows up as a file the app refuses to accept and then reports as
 * missing — which is the pair of messages this build exists to make honest.
 *
 * The classification is BYTE-IDENTICAL to the shipped `detectFileType` for every
 * input whose first line is within `MAX_HEADER_CHARS`, which is every file either
 * service emits; only the returned words changed (`'ml-export'` became `'ml'`). The
 * suite asserts that against the old spelling as an oracle, over probes, over every
 * string on a six-character alphabet up to length 3, and over randomized headers.
 * The header is now read with `firstLine` instead of `text.split(/\r?\n/)[0]`,
 * which is not an interchangeable spelling at this call site: the old one splits
 * the WHOLE file into an array of every line to keep the first, and runs a regex
 * over it, which leaves the subject in the engine's last-match state. Either is
 * cheap on a header and neither is cheap on the 50 MB the upload guard has to
 * classify before it is written.
 *
 * The ONE deliberate divergence from that oracle is an input whose first line runs
 * past `MAX_HEADER_CHARS`: the old spelling read it all and could classify it, this
 * returns `'unknown'`. That is the bound doing its job rather than a behaviour
 * regression, it is asserted as its own case rather than left to be discovered, and
 * no file either service emits can reach it.
 *
 * DELIBERATELY LOOSER THAN EITHER PARSER, in the one direction that matters.
 * `parseMLExport` requires `Catalog Number` (or `ML Catalog Number`), `Common Name`
 * and `Format` by exact name; `parseEbirdObservations` requires `Submission ID`,
 * `Common Name` and `Date`. This asks for a case-insensitive SUBSTRING of a strict
 * subset of each, so any file either parser would accept is classified here as that
 * parser's export. A refusal in Settings therefore never turns away a file the app
 * could have used.
 *
 * Nor are the two confusable, which is worth stating because the eBird header
 * really does contain the substring tested first: a backup's `ML Catalog Numbers`
 * column matches `catalog number`, so the ML branch requires `format` as well,
 * which no eBird backup has. In the other direction an ML export carries `eBird
 * Checklist ID`, which is not `Submission ID`.
 */
export function detectExportType(text: string): ExportType {
  const line = firstLine(text)
  // No header line within `MAX_HEADER_CHARS`, so there is nothing to classify and
  // the honest answer is that this is neither export. A truncated prefix would let
  // this answer a question about a file it had only partly read, and a file whose
  // first line runs past the bound is not a usable export either way: both formats
  // put one record per line, so a single line of that size holds at most one row.
  // Refusing it is also what keeps the classification cheap on content nobody has
  // vouched for -- see the measurements at MAX_HEADER_CHARS.
  if (line === null) return 'unknown'
  const header = line.toLowerCase()
  const hasCatalogNumber = header.includes('catalog number')
  const hasFormat = header.includes('format')
  if (hasCatalogNumber && hasFormat) return 'ml'
  if (header.includes('submission id')) return 'ebird'
  return 'unknown'
}
