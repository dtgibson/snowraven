/**
 * The longest first line this module will read, in characters.
 *
 * MEASURED, not chosen for roundness. The widest header either service actually
 * emits is the Macaulay Library export's at **583 characters** (46 columns); the
 * eBird backup's is **309** (23 columns), both read off the tracked demo exports.
 * The bound below is 8,192, about **14x** the wider of the two, which is room for
 * roughly 650 columns at the ML export's ~12.7 characters per column. Neither
 * format is going to grow by an order of magnitude, and if one ever does, the
 * failure is loud rather than silent (see below) and the repair is this constant.
 *
 * WHY IT HAS TO EXIST AT ALL, which is the half a reviewer will not guess. The
 * character copy below is what makes the retention analysis work, and its cost is
 * `O(first line)`. That is free where this function was written — `observationsCache`
 * hands it a real export whose first line is a 309-character header — and it is not
 * free at all now that `detectExportType` hands it arbitrary user-supplied content,
 * where the first line can be the whole file. Measured on the shipped unbounded
 * version (Node 24.18 / V8, best of three after a warm-up), on a file that is one
 * enormous line followed by a newline:
 *
 *      1 MB first line       4.7 ms
 *      5 MB first line     128.8 ms
 *     20 MB first line     680.1 ms
 *     50 MB first line   2,006.6 ms      <- 1,000x the `split(/\r?\n/)[0]` it replaced
 *
 * Linear, not quadratic, and no regex is involved, so this is not ReDoS. It is
 * simply main-thread work in front of the parse that this build moved OFF the main
 * thread, which makes it worth removing on that ground alone. And it was reachable
 * through the guarded path: a 40 MB single line that BEGINS with a real ML header is
 * classified `ml`, accepted, stored, and then re-read on every Multimedia and
 * Statistics load. On the stored-file path it is not bounded by the 50 MB upload cap
 * at all, because an iCloud pull is not an upload (`src-tauri/src/icloud.rs` caps at
 * 200 MB), which measured 10.6 s.
 *
 * Cost at the bound, same conditions: **0.039 ms** at 8,192 characters (0.008 ms at
 * a real 340-character header, 0.078 ms at 16,384). The whole scan-and-copy is now
 * `O(MAX_HEADER_CHARS)` rather than `O(first line)`, and the suite asserts that as
 * WORK DONE — reads of the input — rather than as elapsed time.
 */
export const MAX_HEADER_CHARS = 8192

/**
 * The CSV's first line, or `null` when the content has no line break within
 * `MAX_HEADER_CHARS` and is longer than that: this function did not find a header
 * line, and it says so rather than handing back a truncated one.
 *
 * NULL IS THE HONEST ANSWER, AND EACH CALLER DECIDES WHAT IT MEANS. A truncated
 * prefix would be worse than useless: `detectExportType` decides by substring, so a
 * silently cut header would answer a question about a file it had only partly read,
 * and `hasBreedingCodeColumn` would report "no Breeding Code column" about a header
 * nobody looked at. Both callers turn `null` into their own existing honest failure
 * — an upload refused with a reason, or a stored file reported as unusable — rather
 * than into a claim about the file's contents.
 *
 * Found within the bound, the result is EXACTLY what `content.slice(0,
 * content.search(/\r?\n/))` returns, which the suite asserts over hand-written
 * probes, over every string on the line-break alphabet up to length 4, and over
 * randomized headers. Two cases worth stating: a lone `\r` NOT followed by `\n` is
 * an ordinary character and does not end the line, and a leading BOM is kept,
 * because `hasBreedingCodeColumn` sees the raw text today.
 *
 * FOUND WITH `charCodeAt` AND COPIED CHARACTER BY CHARACTER, and both halves of that
 * are load-bearing and were MEASURED rather than reasoned about, because the obvious
 * spellings retain the entire export while looking exactly like this one. Holding the
 * "header line" of a 148 MB / 500k-row export, source dropped and GC forced (Node 24
 * / V8, one-byte strings):
 *
 *   the whole text                       152.2 MB   <- what this replaced
 *   content.search(/\r?\n/) then .slice   152.2 MB   <- the obvious rewrite
 *   content.indexOf then .slice          152.2 MB   <- still the whole file
 *   content.search(/\r?\n/) then a copy   152.2 MB   <- still the whole file
 *   content.indexOf then a copy            3.8 MB   <- this function (baseline heap)
 *
 * Two independent mechanisms, neither visible in review:
 *   - `.slice()` of a long parent is a SlicedString that REFERENCES the parent, so
 *     a 309-character header cut that way keeps every byte of the export alive.
 *   - a regex method leaves the SUBJECT in the engine's last-match state (what the
 *     legacy `RegExp.$_` / `RegExp.lastMatch` accessors read), so merely ASKING a
 *     regex where the line ends is enough to retain the file, however the answer is
 *     then used. `indexOf` has no such state, and neither does `charCodeAt`.
 *
 * Figures are one engine's accounting on ASCII input and are evidence, not a bound;
 * the structural claim is that neither the returned string nor any engine-side state
 * references `content`. The suite asserts the other half — the equivalence above —
 * plus a drift guard that neither banned spelling comes back.
 *
 * THE RETENTION CLAIM IS NOW TOTAL, which it was not before. The unbounded version
 * had one documented exception: a file with no line break at all was handed back as
 * its own first line, uncopied, on the reasoning that a copy would retain exactly as
 * much. That reasoning holds only while the string is unbounded — and it meant a
 * 200 MB single-line file became `LoadedEbird.headerLine` and sat at module scope in
 * `observationsCache` for the whole session, which is the very defect that cache was
 * rewritten to remove. Under the bound the file is either short enough to copy for
 * 0.039 ms or too long to have a header, so the exception is gone: this function
 * never returns a string that references `content`.
 *
 * `MAX_HEADER_CHARS` bounds the scan as well as the copy, so a 200 MB single line is
 * read for at most 8,194 characters and then answered, rather than scanned end to
 * end. That is why the search is a `charCodeAt` loop rather than `indexOf`, which
 * has no "search only the first N characters" form. The window is two past the
 * bound rather than one so that a line of exactly `MAX_HEADER_CHARS` characters is
 * found under BOTH line endings; the bound itself is enforced on the resulting
 * line's LENGTH, which is what makes the answer independent of the terminator.
 */
export function firstLine(content: string): string | null {
  // TWO past the bound, not one, and the difference is a real defect that shipped
  // in review: what the bound is about is the LINE's length, and the terminator it
  // carries must not change the answer. A line of exactly MAX_HEADER_CHARS
  // characters ends with its LF at index MAX_HEADER_CHARS under LF, and one
  // position further along under CRLF. A window of MAX_HEADER_CHARS + 1 sees the
  // first and not the second, so the same 8,192-character line returned its header
  // under LF and null under CRLF.
  //
  // The window is therefore deliberately WIDER than the bound it enforces, and the
  // length check below is what actually enforces it — the window's only job is to
  // make sure the terminator is in view.
  const scanTo = Math.min(content.length, MAX_HEADER_CHARS + 2)
  let nl = -1
  for (let i = 0; i < scanTo; i++) {
    if (content.charCodeAt(i) === 10 /* \n */) { nl = i; break }
  }

  let end: number
  if (nl === -1) {
    // No line break inside the window. Either the file is short enough to BE its
    // own first line, or its first line runs past the bound and there is no header
    // here to read.
    if (content.length > MAX_HEADER_CHARS) return null
    end = content.length
  } else {
    // /\r?\n/ matches at the CR when the break is CRLF, and at the LF otherwise; no
    // earlier position can match, because there is no earlier LF.
    end = nl > 0 && content.charCodeAt(nl - 1) === 13 /* \r */ ? nl - 1 : nl
    // The window reaches one character past the bound, so a line break found inside
    // it can still belong to an over-bound line (an LF at MAX_HEADER_CHARS + 1).
    // This is the bound, stated once, on the length rather than on an index.
    if (end > MAX_HEADER_CHARS) return null
  }

  let out = ''
  for (let i = 0; i < end; i++) out += content[i]
  return out
}
