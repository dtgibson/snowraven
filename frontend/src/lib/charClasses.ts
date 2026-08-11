// Per-character tests for the three regex character classes that the linear
// scans in this sweep (improve: superlinear-regex-sweep) use in place of
// quantified patterns.
//
// Why these exist at all. Rewriting `\s+`, `\d+` or `.` as a hand-rolled scan is
// only output-identical if the scan's character set is EXACTLY the class it
// replaces, and a hand-written `ch === ' '` silently is not: `\s` is
// WhiteSpace + LineTerminator, sixteen code points wide. Delegating to a
// quantifier-free single-character regex means the set cannot drift from the
// pattern it replaces, and a quantifier-free class is not the defect the
// regex-hygiene rule is about (a lone `/\s/` has nothing to backtrack).
//
// Extracted rather than copied because three modules needed the whitespace test
// at once - commentBlocks, countyBoundaries and mediaStats - which is the
// threshold this repo uses for a shared helper. Each caller's parity test still
// proves its own site against its own original pattern, so a drift here fails
// several suites rather than none.
//
// All three are deliberately CODE-UNIT tests with no `u` flag, matching the
// patterns they replace (none of those carried `u` either). A lone surrogate is
// therefore not whitespace on either side of every rewrite.

const WS_RE = /\s/
const DIGIT_RE = /\d/

/** Exactly regex `\s` (and `\S` is its negation). */
export function isWsChar(ch: string): boolean {
  return WS_RE.test(ch)
}

/** Exactly regex `\d` - ASCII 0-9 only, in JS regardless of the `u` flag. */
export function isAsciiDigitChar(ch: string): boolean {
  return DIGIT_RE.test(ch)
}

/**
 * Exactly the four characters `.` excludes when the `s` (dotAll) flag is absent:
 * LF, CR, LINE SEPARATOR, PARAGRAPH SEPARATOR. Used to reproduce the reach of a
 * `(.*?)` group, which cannot cross any of them - an asymmetry that is
 * load-bearing rather than incidental (see `splitTrailingCount` in mediaStats).
 *
 * The last two are written as ESCAPES, never as literal characters: U+2028 and
 * U+2029 are invisible, and an editor or formatter can silently flatten them
 * into an ordinary space, which would quietly widen `(.*?)`'s reach with
 * nothing failing.
 */
export function isLineTerminatorChar(ch: string): boolean {
  return ch === '\n' || ch === '\r' || ch === '\u2028' || ch === '\u2029'
}
