// The in-app Help renderer's inline-link machinery: how a `[text](target)` token
// is recognized, parsed, and gated before it may become an `<a href>`.
//
// Why this lives in lib/ rather than in HelpDocs.tsx: `renderInline` is
// module-private, and a non-component export from a `.tsx` file trips
// `react-refresh/only-export-components` (the same constraint that put
// MediaEmbed's constants in lib/mediaEmbed.ts and keeps the TOC array
// un-exported).

/**
 * Maximum length of any single inline token's inner run.
 *
 * Not a round number: it is 5.4x the longest token of ANY kind in the shipped
 * docs/HELP.md (a 93-character bold run), and 11.9x the longest link target
 * (42 chars, `https://github.com/dtgibson/snowraven-mini`). Measured across the
 * exact strings parseBlocks hands to renderInline, not across the raw file —
 * fenced code blocks never reach the scanner, and measuring the raw file
 * reports a spurious 22,179-character "code span" from backticks pairing
 * across two fences.
 *
 * It also sits well under the longest block the renderer ever scans (2,945
 * chars), so no ordinary paragraph can reach it. Content growth past the bound
 * is caught by the tokenization-parity test in helpLinks.test.ts rather than
 * silently degrading a link to literal text.
 */
export const HELP_TOKEN_MAX = 500

// Built once as a STRING (a string has no lastIndex, so this is not the /g
// hazard the factory below exists to avoid) and single-sourced off the bound,
// so the four quantifiers cannot drift apart or from the documented constant.
//
// Every quantifier here is length-bounded, which is what makes the scan linear
// by construction rather than merely fast on the bundled file. Unbounded, each
// alternative can scan to end-of-input from every start position: that is
// O(n^2), and it measured exactly 4.00x per doubling of input (50 KB 703 ms,
// 200 KB 11.2 s, 500 KB 70.3 s, on the main thread). Bounded, the work per
// start position is capped at HELP_TOKEN_MAX, so total cost is O(n).
//
// This matters because the scanner runs BEFORE the link gate, so under the
// threat model the gate exists for (Help content that is no longer
// developer-controlled) a hostile document would never reach the gate at all —
// it would hang the main thread first. CLAUDE.md records this exact defect
// class as already shipped once in this repo (commentBlocks.ts, 4.1 s on a
// 400 KB hostile comment) and requires regexes over untrusted text to be
// linear by construction and length-bounded; commentBlocks.ts is the precedent
// this follows.
const TOKEN_SOURCE = [
  `(\\*\\*(?:[^*]|\\*(?!\\*)){1,${HELP_TOKEN_MAX}}\\*\\*)`,
  `(\`[^\`]{1,${HELP_TOKEN_MAX}}\`)`,
  `(\\[[^\\]]{0,${HELP_TOKEN_MAX}}\\]\\([^)]{0,${HELP_TOKEN_MAX}}\\))`,
].join('|')

/**
 * A fresh `/g` scanner for the Help renderer's inline tokens: `**bold**`,
 * `` `code` ``, and `[text](target)`.
 *
 * Returned FRESH per call on purpose. A module-level `/g` regex carries shared
 * mutable `lastIndex`, and a stale offset silently skips matches (the 0.5.27
 * weather/tide-strip post-mortem). The renderer scans in an `exec` loop, so it
 * needs its own instance every time it runs.
 */
export function helpInlineTokenRe(): RegExp {
  return new RegExp(TOKEN_SOURCE, 'g')
}

/**
 * Non-global, so `String.prototype.match` cannot mutate any shared `lastIndex`.
 *
 * Bounded by the SAME HELP_TOKEN_MAX as the scanner, for two reasons. It is the
 * extraction the gate depends on, and it is reachable from an exported function,
 * so leaving it unbounded would put an O(n^2) regex one call away from any
 * future caller while the scanner beside it was linear. And because the bound
 * matches, every token the scanner can emit parses here identically — the
 * tighter behavior is unreachable through the renderer by construction.
 */
const LINK_TOKEN_RE = new RegExp(
  `\\[([^\\]]{0,${HELP_TOKEN_MAX}})\\]\\(([^)]{0,${HELP_TOKEN_MAX}})\\)`
)

export interface HelpLinkToken {
  /** The visible link text, i.e. what sits between the square brackets. */
  text: string
  /** The raw, UNVALIDATED link target. Gate it with isSafeHelpLinkTarget. */
  target: string
}

/**
 * Split a `[text](target)` token matched by `helpInlineTokenRe()`.
 *
 * This is also the parse an `![alt](src)` IMAGE takes. The scanner's link
 * alternative starts at the `[`, so the leading `!` falls through into the
 * preceding plain-text slice and the rest of the image is handled as an
 * ordinary link — meaning an image `src` reaches `href` by exactly this path.
 * That is why gating link targets closes every door in this renderer rather
 * than only the obvious one, and it is asserted in helpLinks.test.ts rather
 * than assumed.
 */
export function parseHelpLinkToken(token: string): HelpLinkToken | null {
  const m = token.match(LINK_TOKEN_RE)
  if (!m) return null
  return { text: m[1], target: m[2] }
}

/**
 * A parsed markdown link target may become an `<a href>` only if it is an
 * absolute http(s) URL. On a miss the caller renders the link TEXT as plain
 * escaped text and drops the anchor — the repo's established answer everywhere
 * a target cannot be vouched for (ChecklistLink, HotspotLink, CommentText's
 * non-link span): never ship a styled link you cannot stand behind.
 *
 * This is the formulation already shipped at CommentText.tsx, kept byte-
 * identical deliberately. Three details are load-bearing, each of them a real
 * bypass if dropped:
 *
 *  • `:\/\/` — the looser `/^https?:/i` admits `https:evil`, an opaque
 *    non-hierarchical URL that merely LOOKS like it names an https origin.
 *  • `^` — unanchored, `javascript:void("https://x")` passes.
 *  • `i` — the scheme may legitimately arrive uppercased.
 *
 * Deliberately conservative about whitespace and control characters: the URL
 * parser strips ASCII tab/newline anywhere in the input before reading a
 * scheme, so `java\tscript:…` and a leading-newline `javascript:…` are live in
 * a real href. Anchoring at `^` with no whitespace tolerance rejects both.
 *
 * Note this is a SEPARATE copy from CommentText's, not a shared import.
 * CommentText's is deliberately belt-and-suspenders over `linkify`, which
 * already guarantees the same thing; consolidating the two is a deliberate
 * step someone can take later, not something to do by accident.
 */
export function isSafeHelpLinkTarget(target: string): boolean {
  return /^https?:\/\//i.test(target)
}
