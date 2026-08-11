// Guard for the in-app Help renderer's link gate (help-link-scheme-gate).
//
// The defect this locks: HelpDocs interpolated a parsed markdown link target
// straight into `href`, so the renderer would emit a live, styled `javascript:`
// or `data:` anchor if it were ever pointed at content other than the bundled
// docs/HELP.md. Informational rather than live — the ?raw import means the only
// input is a developer-controlled static file — but the renderer's safety
// should not DEPEND on that decision holding forever.
//
// This is a security guard, so it is asserted in BOTH directions. A
// negative-only suite passes just as happily on a seam that has silently
// stopped working (e.g. a parse that stopped extracting the target at all, so
// nothing reaches the predicate and every hostile case "passes").
/// <reference types="node" />
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { HELP_TOKEN_MAX, helpInlineTokenRe, isSafeHelpLinkTarget, parseHelpLinkToken } from './helpLinks'

const helpMd = readFileSync(new URL('../../../docs/HELP.md', import.meta.url), 'utf8')

/**
 * HELP.md with fenced code blocks removed, which is what the renderer actually
 * inline-scans: parseBlocks consumes a ``` fence whole and never hands its
 * contents to renderInline. Measuring the raw file instead reports a spurious
 * 22,179-character "code span" from backticks pairing across two fences, and
 * would make the bound below look far too tight.
 */
const helpScanned = helpMd.replace(/^```[\s\S]*?^```$/gm, '')

/** The pre-change scanner: identical but with UNBOUNDED quantifiers. */
const unboundedTokenRe = () =>
  /(\*\*(?:[^*]|\*(?!\*))+\*\*)|(`[^`]+`)|(\[[^\]]*\]\([^)]*\))/g

function tokenize(re: RegExp, s: string): string[] {
  const out: string[] = []
  let m: RegExpExecArray | null
  while ((m = re.exec(s)) !== null) out.push(`${m.index}:${m[0]}`)
  return out
}

/** Every `[text](target)` target in the real HELP.md, parsed rather than listed. */
function helpMdLinkTargets(): string[] {
  const out: string[] = []
  const re = helpInlineTokenRe()
  let m: RegExpExecArray | null
  while ((m = re.exec(helpMd)) !== null) {
    if (!m[3]) continue
    const link = parseHelpLinkToken(m[3])
    if (link) out.push(link.target)
  }
  return out
}

describe('isSafeHelpLinkTarget — rejects (the defect)', () => {
  // Each of these is a form the defect could actually return in, not a
  // grab-bag: the scheme families a markdown href can smuggle, the two
  // whitespace/control-character tricks the URL parser strips before reading a
  // scheme, and the two specific bypasses that the obvious weaker predicates
  // would admit.
  const hostile: [string, string][] = [
    ['javascript: scheme', 'javascript:alert(1)'],
    ['javascript: mixed case', 'JaVaScRiPt:alert(1)'],
    ['data: scheme', 'data:text/html,<script>alert(1)</script>'],
    ['vbscript: scheme', 'vbscript:msgbox(1)'],
    // The URL parser strips ASCII tab/newline ANYWHERE in the input before
    // reading a scheme, so both of these are live `javascript:` hrefs in a
    // browser despite not reading as one.
    ['embedded tab inside the scheme', 'java\tscript:alert(1)'],
    ['leading newline', '\njavascript:alert(1)'],
    ['leading space', ' javascript:alert(1)'],
    // Protocol-relative: inherits the page scheme and silently leaves the app.
    ['protocol-relative', '//evil.example'],
    // The exact form the looser `/^https?:/i` predicate would have admitted —
    // an opaque non-hierarchical URL that merely LOOKS like an https origin.
    ['scheme without //', 'https:evil'],
    ['http scheme without //', 'http:evil'],
    // Unanchored, `/https?:\/\//i` would match the substring here.
    ['http(s) substring in a javascript: payload', 'javascript:void("https://ok.example")'],
    ['relative path', '/settings'],
    ['bare fragment', '#getting-started'],
    ['mailto', 'mailto:someone@example.com'],
    ['file scheme', 'file:///etc/passwd'],
    ['empty target', ''],
  ]

  it.each(hostile)('rejects %s', (_label, target) => {
    expect(isSafeHelpLinkTarget(target)).toBe(false)
  })
})

describe('isSafeHelpLinkTarget — accepts (the seam still works)', () => {
  it('accepts every markdown link target in the real docs/HELP.md', () => {
    const targets = helpMdLinkTargets()
    // Not a vacuous pass: HELP.md ships 7 links today and the parse must
    // actually be finding them. The floor is a floor, not an exact count, so
    // adding a link to HELP.md does not fail an unrelated test.
    expect(targets.length).toBeGreaterThanOrEqual(7)
    for (const target of targets) {
      expect(isSafeHelpLinkTarget(target), `HELP.md target should still link: ${target}`).toBe(true)
    }
  })

  it('accepts plain http as well as https', () => {
    expect(isSafeHelpLinkTarget('http://example.com')).toBe(true)
    expect(isSafeHelpLinkTarget('https://example.com')).toBe(true)
  })

  it('accepts an uppercased scheme (the `i` flag is load-bearing)', () => {
    // Without /i this is a false negative and a legitimate link silently
    // degrades to plain text — the failure mode a rejects-only suite misses.
    expect(isSafeHelpLinkTarget('HTTPS://EXAMPLE.COM')).toBe(true)
    expect(isSafeHelpLinkTarget('Http://Example.com')).toBe(true)
  })
})

describe('an ![alt](src) image reaches href by the SAME path', () => {
  // The brief flagged this as a trap to hit deliberately rather than assume:
  // if images took a different route, gating links would close only one door.
  // They do not — the scanner's link alternative starts at the `[`, so the
  // leading `!` falls through into the preceding plain-text slice and the rest
  // of the image is parsed as an ordinary link.
  it('tokenizes the [alt](src) inside an image, leaving the ! as text', () => {
    const re = helpInlineTokenRe()
    const m = re.exec('see ![a bird](javascript:alert(1)) here')
    expect(m).not.toBeNull()
    expect(m![3]).toBe('[a bird](javascript:alert(1)')
    // The `!` is NOT part of the token, so it stays in the plain-text slice
    // the renderer emits ahead of it.
    expect('see ![a bird](javascript:alert(1)) here'.slice(0, m!.index)).toBe('see !')
  })

  it('extracts an image src as a link target, which the gate then rejects', () => {
    const link = parseHelpLinkToken('[a bird](javascript:alert(1)')
    expect(link).not.toBeNull()
    expect(link!.text).toBe('a bird')
    expect(link!.target).toBe('javascript:alert(1')
    expect(isSafeHelpLinkTarget(link!.target)).toBe(false)
  })

  it('gates an image src pointing at a data: URL', () => {
    const link = parseHelpLinkToken('[logo](data:image/svg+xml,<svg onload=alert(1)>)')
    expect(link).not.toBeNull()
    expect(isSafeHelpLinkTarget(link!.target)).toBe(false)
  })
})

describe('helpInlineTokenRe is linear by construction (length-bounded)', () => {
  // The scanner runs BEFORE the link gate, so under the threat model the gate
  // exists for (Help content that is no longer developer-controlled) an
  // unbounded scanner hangs the main thread before the gate is ever consulted.
  // Unbounded it is O(n^2): 4.00x per doubling, measured.

  it('has no unbounded quantifier left in the pattern', () => {
    // A `*` or `+` directly after a character class or group close is an
    // unbounded repetition. This is the structural, zero-flake statement of
    // "linear by construction"; the timing test below is the empirical one.
    const src = helpInlineTokenRe().source
    expect(src).not.toMatch(/[\])][*+]/)
    // All four quantifiers bounded, and single-sourced off the constant.
    const bounded = src.match(/\{[01],\d+\}/g) ?? []
    expect(bounded).toHaveLength(4)
    for (const q of bounded) expect(q).toContain(String(HELP_TOKEN_MAX))
    // Pin the bound's VALUE structurally, not via the timing ceiling. The
    // assertions above hold for any HELP_TOKEN_MAX (they interpolate it), and
    // the headroom test only gets easier as it grows, so an inflated bound
    // slips past every non-timing guard: 1000 -> 305ms, 2000 -> 606ms and
    // 5000 -> 1647ms all sit under the 3000ms ceiling. 1000 is 10.8x the
    // longest real token and 2x the shipped bound, so ordinary growth has room
    // while a bound that has quietly stopped bounding anything fails here.
    expect(HELP_TOKEN_MAX).toBeLessThanOrEqual(1000)
    // Guard the guard: the pre-change pattern must trip the check above, or it
    // is asserting nothing.
    expect(unboundedTokenRe().source).toMatch(/[\])][*+]/)
  })

  it('bounds the link-token extraction too, not just the scanner', () => {
    // parseHelpLinkToken is exported, so an unbounded regex here would sit one
    // call away from any future caller while the scanner beside it was linear.
    // Bounded at the SAME constant, so every token the scanner can emit parses
    // identically and this tighter behavior is unreachable via the renderer.
    const atBound = `[x](${'a'.repeat(HELP_TOKEN_MAX)})`
    expect(parseHelpLinkToken(atBound)?.target).toHaveLength(HELP_TOKEN_MAX)

    const overBound = `[x](${'a'.repeat(HELP_TOKEN_MAX + 1)})`
    expect(parseHelpLinkToken(overBound)).toBeNull()

    // And it stays fast on a hostile string, which the unbounded form does not.
    // Minimum of three complete executions, the QA-41 pattern, for the same
    // reason as the scanner's linear-time test below: a single measurement here
    // read 153ms against a 300ms ceiling, and 4 of 5 runs breached it under CPU
    // oversubscription. Bounded is ~150ms at this size and unbounded ~131x that
    // (~20s), so a 3000ms ceiling keeps ~20x margin over the bounded form while
    // still sitting ~6x BELOW the unbounded one. Do not tighten the ceiling to
    // close the gap: the discrimination lives in that gap, not in the number.
    const hostile = '['.repeat(120_000)
    const elapsed = [0, 1, 2].map(() => {
      const t0 = performance.now()
      expect(parseHelpLinkToken(hostile)).toBeNull()
      return performance.now() - t0
    })
    expect(Math.min(...elapsed)).toBeLessThan(3000)
  })

  it('tokenizes the real HELP.md identically to the unbounded pattern', () => {
    // The bound must not change behavior for any real content. This also fails
    // if HELP.md ever grows a token past the bound, so growth surfaces here
    // rather than silently degrading a link to literal text.
    const bounded = tokenize(helpInlineTokenRe(), helpScanned)
    const unbounded = tokenize(unboundedTokenRe(), helpScanned)
    expect(bounded.length).toBeGreaterThan(0)
    expect(bounded).toEqual(unbounded)
  })

  it('keeps at least 2x headroom over the longest real token of each kind', () => {
    // Measured maxima in the shipped file: bold 93, code 47, link text 34,
    // link target 42. The bound (500) is 5.4x the largest of those. Requiring
    // 2x headroom means ordinary content growth trips this long before it can
    // change what renders.
    const kinds: [string, RegExp, number][] = [
      ['bold', /\*\*((?:[^*]|\*(?!\*))+)\*\*/g, 1],
      ['code', /`([^`]+)`/g, 1],
      ['link text', /\[([^\]]*)\]\(([^)]*)\)/g, 1],
      ['link target', /\[([^\]]*)\]\(([^)]*)\)/g, 2],
    ]
    for (const [label, re, group] of kinds) {
      let longest = 0
      let m: RegExpExecArray | null
      while ((m = re.exec(helpScanned)) !== null) longest = Math.max(longest, (m[group] ?? '').length)
      expect(longest, `${label} should have 2x headroom under the bound`).toBeGreaterThan(0)
      expect(longest * 2, `${label} is ${longest} chars, bound is ${HELP_TOKEN_MAX}`)
        .toBeLessThanOrEqual(HELP_TOKEN_MAX)
    }
  })

  it('scans a large hostile document in linear time', () => {
    // Fails hard on the unbounded pattern. Bounded ~10ms at 200 KB here;
    // unbounded ~2000ms, so the ceiling has ~30x margin over the bounded form
    // and sits ~6x BELOW the unbounded one — a gap wide enough that a slow
    // shared runner cannot close it in either direction.
    //
    // Worst case for an unbounded scan: many unterminated openers, so every
    // alternative runs to end-of-input from every start position.
    const unit = '**a [b `c '
    const hostile = unit.repeat(Math.ceil((200 * 1024) / unit.length)).slice(0, 200 * 1024)
    // Minimum of three complete executions, the QA-41 pattern: resists
    // scheduling noise on a shared runner without weakening the threshold.
    const elapsed = [0, 1, 2].map(() => {
      const t0 = performance.now()
      tokenize(helpInlineTokenRe(), hostile)
      return performance.now() - t0
    })
    expect(Math.min(...elapsed)).toBeLessThan(300)
  })
})

describe('helpInlineTokenRe is fresh per call', () => {
  it('never shares lastIndex between callers', () => {
    // A module-level /g regex carries shared mutable lastIndex, and a stale
    // offset silently skips matches (the 0.5.27 post-mortem). The renderer
    // scans in an exec loop, so a shared instance would drop links depending
    // on what ran before it.
    const a = helpInlineTokenRe()
    a.exec('[one](https://one.example) and [two](https://two.example)')
    expect(a.lastIndex).toBeGreaterThan(0)

    const b = helpInlineTokenRe()
    expect(b).not.toBe(a)
    expect(b.lastIndex).toBe(0)
  })
})
