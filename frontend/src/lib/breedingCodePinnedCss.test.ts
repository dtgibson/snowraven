// Guard for the Breeding Codes pinned-header stylesheet rules (feature:
// breeding-code-pinned-labels). The pin is entirely CSS — the component only adds
// a class — so the rules ARE the feature, and every one of them is invisible to a
// jsdom component test (no layout engine, no media queries, no env()). This parses
// the REAL globals.css, the same posture as milestoneContrast / calendarContrast /
// countyContrast / helpToc.
//
// Two of these would have caught a shipped defect on the map panel in the build
// immediately before this one: a safe-area rule that was never written, and an
// inline style that made a stylesheet rule unreachable.
/// <reference types="node" />
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { parseTopLevelRules } from './cssTopLevelRules'

// Vitest stubs `.css` imports (`?raw` included), so read the file directly. Node
// types are pulled in for this one file by the reference above, matching how
// tsconfig.node scopes them to tooling.
const css = readFileSync(new URL('../globals.css', import.meta.url), 'utf8')

// Comments stripped, for assertions about what the stylesheet DECLARES. The raw
// text is the wrong thing to search for an absence: this file's comments discuss
// the properties it deliberately does not use, and a prose mention would otherwise
// read as a declaration.
const declarations = css.replace(/\/\*[\s\S]*?\*\//g, '')

// Comments blanked to spaces of EQUAL LENGTH for the offset walk below, so every
// offset still points at the same character in the real file while no lookup can
// be satisfied by prose.
const masked = css.replace(/\/\*[\s\S]*?\*\//g, m => ' '.repeat(m.length))

const topLevel = parseTopLevelRules(css)

// ── Exact selector matching ──────────────────────────────────────────────────
//
// Both lookups below used to be `css.indexOf(selector + ' {')` over the RAW
// stylesheet, and both defects that form carries were live here, not theoretical:
//
//  1. PREFIX COLLISION, held off only by source order. `.sr-bc-matrix--pinned
//     thead th` occurs twice — as itself, and inside `.sr-ios-app
//     .sr-bc-matrix--pinned thead th` — as does `.sr-pinnote--enter` (top level,
//     and again inside @media (prefers-reduced-motion)). Each resolved to the
//     right rule only because the base one happens to come first; a pure reorder
//     would have made the base-rule assertions silently test the iOS rule. That is
//     property #1 in cssTopLevelRules.ts's own docblock, in a file that already
//     imported it.
//  2. COMMENTS INCLUDED, inconsistent with `declarations` two lines above. A
//     comment containing `selector + ' {'` hijacked the lookup outright.
//
// ruleBody now goes through the SHARED parser: every selector it looks up is
// top-level reachable, and exact keys plus at-rule blocks skipped whole close both
// holes at once. ruleOffset cannot — source ORDER is exactly the question a
// selector→body map throws away — so it keeps a local walker and gains the same
// exactness, which is the per-question form of the carve-out DECISIONS.md records
// per file.

/** Split a selector list on TOP-LEVEL commas. */
function splitList(list: string): string[] {
  const parts: string[] = []
  let depth = 0
  let cur = ''
  for (const ch of list) {
    if (ch === '(' || ch === '[') depth++
    else if (ch === ')' || ch === ']') depth--
    if (ch === ',' && depth === 0) { parts.push(cur); cur = '' } else cur += ch
  }
  parts.push(cur)
  return parts.map(p => p.trim().replace(/\s+/g, ' ')).filter(Boolean)
}

/** The compounds of ONE complex selector, in order — combinator-separated, paren-aware. */
function compounds(sel: string): string[] {
  const out: string[] = []
  let depth = 0
  let cur = ''
  for (const ch of sel) {
    if (ch === '(' || ch === '[') depth++
    else if (ch === ')' || ch === ']') depth--
    if (depth === 0 && (/\s/.test(ch) || ch === '>' || ch === '+' || ch === '~')) {
      if (cur) out.push(cur)
      cur = ''
      continue
    }
    cur += ch
  }
  if (cur) out.push(cur)
  return out
}

/** The SUBJECT of a complex selector — the element the rule actually styles. */
function rightmost(sel: string): string {
  const c = compounds(sel)
  return c[c.length - 1]
}

/**
 * Every style rule in the stylesheet at ANY nesting depth, with whether it sits
 * inside an at-rule. `selectors` holds one complex selector per entry (groups
 * split), so callers can ask about a rule's SUBJECT rather than about text.
 *
 * parseTopLevelRules deliberately throws the nested rules away, which is right for
 * "does this rule hold at every width" but useless for "may a tier redeclare it" —
 * that question needs both halves of the file, told apart.
 */
function collectRules(
  src: string,
  nested = false,
  out: { selectors: string[]; body: string; nested: boolean }[] = [],
): { selectors: string[]; body: string; nested: boolean }[] {
  let i = 0
  let selStart = 0
  while (i < src.length) {
    if (src[i] === ';') { i++; selStart = i; continue }
    if (src[i] !== '{') { i++; continue }
    let depth = 1
    let j = i + 1
    while (j < src.length && depth > 0) {
      if (src[j] === '{') depth++
      else if (src[j] === '}') depth--
      j++
    }
    const prelude = src.slice(selStart, i)
    const body = src.slice(i + 1, j - 1)
    if (prelude.trim().startsWith('@')) collectRules(body, true, out)
    else out.push({ selectors: splitList(prelude), body, nested })
    i = j
    selStart = j
  }
  return out
}

const allRules = collectRules(declarations)

/**
 * Does this selector's SUBJECT match the legend BOX itself — `.sr-bc-legend` or
 * its `--normal` view modifier — rather than something inside it?
 *
 * The `(?![-\w])` is the whole point. `.sr-bc-legend` is a PREFIX of
 * `.sr-bc-legend-chip`, `.sr-bc-legend-tier` and `.sr-bc-legend--normal`, so the
 * plain-substring form this replaces could not tell the legend from its
 * descendants: it went red the moment the phone-tier chip rules landed, reporting
 * them as "the legend declared inside an at-rule" when they declare nothing on the
 * legend at all. Exactly the `String.includes` trap CLAUDE.md records.
 */
function subjectIsLegendBox(sel: string): boolean {
  return /\.sr-bc-legend(--normal)?(?![-\w])/.test(rightmost(sel))
}

/**
 * Source offsets of every TOP-LEVEL rule, keyed by each EXACT selector in its
 * list. Values are arrays so an ambiguous lookup can be refused rather than
 * silently resolved by position — which is the defect this replaces.
 */
const topLevelOffsets = (() => {
  const out = new Map<string, number[]>()
  let i = 0
  let selStart = 0
  while (i < masked.length) {
    // A top-level `;` ends a prelude (globals.css opens with `@import
    // "tailwindcss";`) — the same property cssTopLevelRules.ts carries.
    if (masked[i] === ';') { i++; selStart = i; continue }
    if (masked[i] !== '{') { i++; continue }
    let depth = 1
    let j = i + 1
    while (j < masked.length && depth > 0) {
      if (masked[j] === '{') depth++
      else if (masked[j] === '}') depth--
      j++
    }
    const prelude = masked.slice(selStart, i)
    if (!prelude.trim().startsWith('@')) {
      const at = selStart + prelude.search(/\S/)
      for (const one of splitList(prelude)) out.set(one, [...(out.get(one) ?? []), at])
    }
    i = j
    selStart = j
  }
  return out
})()

/** Declaration body of a TOP-LEVEL rule, by exact selector. */
function ruleBody(selector: string): string {
  const body = topLevel.get(selector)
  if (body === undefined) {
    throw new Error(`top-level rule not found (exact selector, outside any @media): ${selector}`)
  }
  return body
}

/** Source offset of a top-level rule's selector list, for source-order assertions. */
function ruleOffset(selector: string): number {
  const hits = topLevelOffsets.get(selector) ?? []
  if (hits.length === 0) throw new Error(`top-level rule not found: ${selector}`)
  if (hits.length > 1) {
    // Two top-level rules keyed by the same exact selector make "which one comes
    // first" ambiguous, and picking either silently is how the substring form
    // failed. Surface it instead.
    throw new Error(`ambiguous source order: ${hits.length} top-level rules match ${selector}`)
  }
  return hits[0]
}

/** Custom-property value from the :root / [data-theme="dark"] token blocks. */
function token(block: '\n:root' | '[data-theme="dark"]', name: string): string {
  const start = css.indexOf(block)
  if (start < 0) throw new Error(`token block not found: ${block}`)
  const open = css.indexOf('{', start)
  const close = css.indexOf('\n}', open)
  const body = css.slice(open, close)
  const m = new RegExp(`${name}\\s*:\\s*([^;]+);`).exec(body)
  if (!m) throw new Error(`${name} not declared in ${block}`)
  return m[1].trim()
}

describe('--sr-sticky-shadow token', () => {
  it('is declared in BOTH :root and [data-theme="dark"] before use', () => {
    // The standing rule: a new token lands in both theme blocks, never one.
    expect(token('\n:root', '--sr-sticky-shadow')).toMatch(/^0 /)
    expect(token('[data-theme="dark"]', '--sr-sticky-shadow')).toMatch(/^0 /)
  })

  it('gives dark its OWN deeper value rather than copying :root', () => {
    // Rejects the "same values as :root by design" copy-paste that produced the
    // milestone-badge dark-mode defect. --sr-bg is #09090B in dark, so the light
    // 12% haze would be invisible there and the pinned band would lose its
    // boundary in exactly one theme.
    const light = token('\n:root', '--sr-sticky-shadow')
    const dark = token('[data-theme="dark"]', '--sr-sticky-shadow')
    expect(dark).not.toBe(light)
    const alpha = (v: string) => Number(/rgba\([^)]*,\s*([0-9.]+)\)/.exec(v)![1])
    expect(alpha(dark)).toBeGreaterThan(alpha(light))
  })

  it('is tinted with the app\'s own ink, not pure black', () => {
    for (const b of ['\n:root', '[data-theme="dark"]'] as const) {
      expect(token(b, '--sr-sticky-shadow')).not.toMatch(/rgba\(\s*0\s*,\s*0\s*,\s*0\s*,/)
    }
  })
})

describe('pinned header rules', () => {
  it('carries the header hairline as a CLASS rule, not an inline style', () => {
    // The counterpart of the component test: the value the pinned rule has to beat
    // must actually live in the stylesheet at equal specificity.
    expect(ruleBody('.sr-bc-matrix thead th')).toContain('box-shadow: inset 0 -1px 0 var(--sr-border);')
  })

  it('orders the pinned rule AFTER the base rule (equal specificity, source order decides)', () => {
    // Both selectors are (0,1,2). If the pinned block were written above the base
    // one, the base hairline would win and the band would ship with no boundary —
    // a failure no specificity reasoning catches, only source order.
    expect(ruleOffset('.sr-bc-matrix--pinned thead th')).toBeGreaterThan(ruleOffset('.sr-bc-matrix thead th'))
  })

  it('sticks the header with a page-anchored top and lifts it above the rows', () => {
    const body = ruleBody('.sr-bc-matrix--pinned thead th')
    expect(body).toMatch(/position:\s*sticky/)
    expect(body).toMatch(/top:\s*0/)
    expect(body).toMatch(/z-index:\s*3/)
  })

  it('steps the hairline up and adds the haze when pinned', () => {
    const body = ruleBody('.sr-bc-matrix--pinned thead th')
    expect(body).toContain('var(--sr-border-medium)')
    expect(body).toContain('var(--sr-sticky-shadow)')
  })

  it('never puts position:sticky on <thead> or <tr>', () => {
    // WKWebView and older Safari honor sticky on CELLS only, and this ships in
    // WKWebView on both macOS and iOS. A thead/tr rule looks right in Chrome and
    // does nothing in the app.
    expect(css).not.toMatch(/\.sr-bc-matrix--pinned\s+(thead|tr)\s*\{[^}]*position:\s*sticky/)
  })
})

describe('pinned header, iOS safe area', () => {
  it('re-points `top` to the safe-area inset under the .sr-ios-app gate', () => {
    // A sticky element resolves `top` against its SCROLLPORT (the viewport), which
    // sits ABOVE `.sr-ios-app body`'s padding-top — so without this rule the band
    // pins into the notch / Dynamic Island. This is also why the pin cannot be an
    // inline style: a stylesheet cannot override specificity 1,0,0.
    expect(ruleBody('.sr-ios-app .sr-bc-matrix--pinned thead th'))
      .toMatch(/top:\s*env\(safe-area-inset-top,\s*0px\)/)
  })

  it('gates EVERY safe-area rule on .sr-ios-app so web stays byte-identical', () => {
    // index.html ships viewport-fit=cover to browsers too, so env() is NOT zero in
    // iOS Safari; an ungated rule would change the shipped web rendering on notched
    // phones. Asserts no .sr-bc-matrix--pinned selector reaches env() at the start of
    // a line (i.e. without the .sr-ios-app prefix).
    expect(css).not.toMatch(/^\.sr-bc-matrix--pinned[^{]*\{[^}]*env\(safe-area/m)
  })
})

describe('keyboard focus under the pinned band (WCAG 2.2 SC 2.4.11)', () => {
  // HONEST LIMIT, stated so nobody reads more into these than they carry: the real
  // claim is geometric ("no focused control comes to rest under the band"), and
  // jsdom has no layout engine, so nothing in this suite can evaluate it. These
  // assert the MECHANISM is capable of working. The geometry is proved separately
  // by pipeline/breeding-code-pinned-labels/focus-obscured-probe.mjs, a
  // Playwright/Chromium reverse-tab probe: the first cut of this rule left 3 focus
  // stops obscured at 100% text scale and 9 at 200%, and the shipped form leaves
  // none. Playwright is not a frontend dev dependency here, and promoting it to one
  // (plus CI browser installs) was out of scope for this change.
  //
  // Two of the four assertions below FAIL on the version that shipped to review,
  // which had only the two cell selectors. The other two pass on it, because that
  // version also had no root scroll-padding and also kept scrollPaddingLeft on the
  // wrapper. They do a different job: they lock in the choice BETWEEN fixes, so a
  // later change cannot regress onto the root-scoped form that leaks across the
  // mounted-but-hidden tabs.

  /**
   * The four selectors the guard must cover: the cells AND their focusable
   * descendants. Asserted one at a time through the shared parser (which keys each
   * member of a comma group individually), so this states the INVARIANT rather than
   * one literal spelling of the list: dropping any of the four goes red, while
   * reordering or reflowing the group — which changes nothing — stays green. Same
   * shape as lifeListPinnedCss.test.ts, its twin on the Multimedia table.
   */
  const focusSelectors = (prefix: string) => [
    `${prefix} tbody th`,
    `${prefix} tbody td`,
    `${prefix} tbody th *`,
    `${prefix} tbody td *`,
  ]

  it('puts scroll-margin-top on the cells AND their focusable descendants', () => {
    // Rejects the exact mistake that was made. `scroll-margin` applies to the
    // element scrolled INTO VIEW and does not inherit, and focus lands on the
    // <button> BirdName renders inside the cell — so a cell-only rule computes 0px
    // on every focusable and never participates in the scroll. The `*` covers
    // present and future focusables without enumerating them.
    for (const sel of focusSelectors('.sr-bc-matrix--pinned')) {
      expect(ruleBody(sel), sel).toMatch(/scroll-margin-top:\s*3rem/)
    }
  })

  it('does not introduce a document-scoped scroll-padding-top', () => {
    // The other half of the pair fixes the geometry just as well (measured), but in
    // Unbounded the scrollport is the PAGE, so it would have to live on the root —
    // and deferred tabs stay MOUNTED when hidden, so pinning and navigating away
    // would leave a document-wide scroll-padding on every other tab. A
    // :root:has(.sr-bc-matrix--pinned) form leaks identically, since display:none
    // does not remove the table from the DOM. Keeping the rule in this table's own
    // subtree is what makes it unable to reach another tab.
    //
    // This asserts the LEAK SHAPE, not the vocabulary. A stylesheet-wide ban on
    // scroll-padding-top or on :has( would fail an unrelated future change with a
    // message pointing at the wrong thing — and this feature's own
    // --sr-sticky-shadow token is deliberately named for reuse by a future sticky
    // surface, which may well have a real scrollport of its own and legitimately
    // need scroll-padding-top. Only a root- or html-scoped declaration can reach
    // another tab, so only that is banned.
    for (const [, selector, body] of declarations.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      if (!/scroll-padding-top\s*:/.test(body)) continue
      expect(
        selector.trim(),
        'scroll-padding-top must not be document-scoped: it outlives the tab that set it',
      ).not.toMatch(/(^|,)\s*(:root|html)\b/)
    }
  })

  it('leaves the HORIZONTAL axis on the scrollport, where that property belongs', () => {
    // scroll-padding goes on a scrollport; scroll-margin goes on a focus target.
    // Normal view's overflow-x wrapper IS a real scrollport, so the horizontal
    // guard is correctly scrollPaddingLeft on that wrapper, set in the TSX. This
    // asserts the vertical fix did not "tidy" it into the stylesheet or convert it
    // to the wrong property.
    const tsx = readFileSync(new URL('../components/BreedingCodeTable.tsx', import.meta.url), 'utf8')
    expect(tsx).toMatch(/scrollPaddingLeft:\s*NAME_COL_WIDTH/)
    expect(declarations).not.toMatch(/scroll-margin-left/)
  })

  it('adds the safe-area inset on iOS across the SAME four selectors', () => {
    // The twin has to cover the descendants too, or iOS keeps the original defect
    // while the web build is fixed — the half-fix this repo has been bitten by
    // before (a caller reaching a component down two paths).
    for (const sel of focusSelectors('.sr-ios-app .sr-bc-matrix--pinned')) {
      expect(ruleBody(sel), sel).toMatch(/scroll-margin-top:\s*calc\(3rem \+ env\(safe-area-inset-top, 0px\)\)/)
    }
  })
})

describe('Unbounded card is sized by the table, not the legend (fix: pin-labels-column-width)', () => {
  // WHY THIS LIVES IN THE PIN'S GUARD FILE. The defect was reported as a pin
  // defect: pressing "Pin code labels" roughly doubled every column. The pin CSS
  // was never involved — pinned measures byte-identical to unpinned Unbounded,
  // before AND after this fix — but `pinned implies Unbounded` forces the view, so
  // the pin is how a user reaches it. Anyone who touches the pin needs to find this
  // beside it, or the same report comes back pointed at the wrong rules.
  //
  // WHAT THESE CAN CARRY. The claim is geometric: which child's intrinsic width the
  // card is sized from. jsdom has no layout engine and a parsed stylesheet cannot
  // evaluate a size, so these assert the MECHANISM. The geometry is measured by
  // pipeline/pin-labels-column-width/card-width-probe.mjs, a Playwright A/B against
  // the running app (built frontend + backend on the synthetic demo dataset) in
  // BOTH Chromium and WebKit, since the app ships in WKWebView on macOS and iOS.
  // On the 13-code demo data at 1440px the Unbounded card went 1751.2px -> 794px,
  // code columns 97.17px -> 44px, the species column 485.88px -> 220px, and the
  // card stopped overflowing its panel's content box by 519.2px; at 200% text scale
  // the card went 2953.42px -> 814px. Normal view and the entire ≤640 tier measured
  // IDENTICAL before and after, in both engines.

  /** Declarations of a rule body, keyed by property. */
  function decls(body: string): Map<string, string> {
    const out = new Map<string, string>()
    for (const d of body.split(';')) {
      const at = d.indexOf(':')
      if (at < 0) continue
      out.set(d.slice(0, at).trim(), d.slice(at + 1).trim())
    }
    return out
  }

  /** Offset ranges of every top-level at-rule block, by brace matching. */
  function atRuleRanges(): [number, number][] {
    const out: [number, number][] = []
    let i = 0
    let selStart = 0
    while (i < declarations.length) {
      const ch = declarations[i]
      if (ch === ';') { i++; selStart = i; continue }
      if (ch !== '{') { i++; continue }
      let depth = 1
      let j = i + 1
      while (j < declarations.length && depth > 0) {
        if (declarations[j] === '{') depth++
        else if (declarations[j] === '}') depth--
        j++
      }
      if (declarations.slice(selStart, i).trim().startsWith('@')) out.push([selStart, j])
      i = j
      selStart = j
    }
    return out
  }

  /** The legend constraint, found by what it TARGETS rather than by one literal
   *  selector string: `.sr-bc-card > .sr-bc-legend` and `.sr-bc-card .sr-bc-legend`
   *  are equally correct (the legend is a direct child either way), so a guard keyed
   *  on the shipped spelling would go red on a refactor that changed nothing. */
  function legendRuleBody(): string {
    const hits = [...topLevel].filter(([sel]) => /^\.sr-bc-card\s*>?\s*\.sr-bc-legend$/.test(sel))
    expect(hits.map(([s]) => s), 'exactly one top-level rule must constrain the legend inside the card').toHaveLength(1)
    return hits[0][1]
  }

  it('caps the legend\'s contribution at min-content while still spanning the card', () => {
    // The card is a COLUMN FLEX container, so an intrinsic width on it is the max
    // over its children's contributions — the table wrapper AND this legend. The
    // legend is a wrapping row of "CODE Full Label" chips, so its max-content is
    // every chip on one unwrapped line (measured 1749px against the table's 792px),
    // and it won. `width: min-content` drops its contribution to its widest single
    // chip; `min-width: 100%` stretches it back over the resolved card, and cannot
    // feed back into the sizing because a percentage is indefinite while the
    // container is being sized intrinsically.
    //
    // Rejects the pre-fix ABSENCE of the rule, and equally the zero-contribution
    // forms (`width: 0`, `contain: inline-size`) that would let the card fall below
    // the widest chip: each chip is white-space:nowrap, so it would then hang
    // outside the card's rounded border and leak horizontal scroll — reachable on a
    // phone at 200% text scale with few codes present. The legend must be able to
    // FLOOR the card, just never to dictate it.
    const d = decls(legendRuleBody())
    expect(d.get('width')).toBe('min-content')
    expect(d.get('min-width')).toBe('100%')
    expect(d.has('contain')).toBe(false)
  })

  it('holds at EVERY width: the constraint is top-level and no tier redeclares it', () => {
    // parseTopLevelRules skips at-rule blocks WHOLE, so finding the rule in that map
    // is itself the proof it is not tier-only — the DRY-consolidation shape that
    // stranded the iPad Help TOC. This adds the other half: no @media tier may
    // re-declare a width on the legend and quietly undo it, which matters most in
    // the ≤640 block, where the card's own width is re-declared two lines away.
    legendRuleBody()
    // Asks about each rule's SUBJECT, not about text. The substring scan this
    // replaces could not distinguish `.sr-bc-legend` from `.sr-bc-legend-chip`, so
    // it read a phone-tier rule on the CHIPS as a redeclaration of the LEGEND.
    // Descendant rules inside a tier are fine and expected; a width on the legend
    // box itself is what must never be tier-scoped.
    const legendBoxRules = allRules.filter(r => r.selectors.some(subjectIsLegendBox))
    expect(
      legendBoxRules.length,
      'never vacuous: at least one rule must have the legend box as its subject',
    ).toBeGreaterThan(0)
    for (const r of legendBoxRules) {
      expect(r.nested, `a tier redeclares the legend box: ${r.selectors.join(', ')}`).toBe(false)
    }
  })

  it('scopes the constraint under .sr-bc-card, so Normal view is untouched', () => {
    // Normal never carries .sr-bc-card (BreedingCodeTable adds it only in wideMode),
    // and there the card is a stretched flex item at the panel's width — nothing is
    // sized intrinsically, so the constraint has no work to do. Scoping is what
    // makes "Normal renders byte-identically" a property of the stylesheet instead
    // of a claim resting on a measurement. Rejects a bare `.sr-bc-legend` rule.
    //
    // Both halves exact. The subject is the legend itself, so the match is on the
    // RIGHTMOST compound — `.sr-bc-legend span` sizes a chip, not the legend, and
    // has no bearing on which child the card is sized from. And the scope is the
    // LEADING compound, not `/^\.sr-bc-card\b/`: `\b` sits happily between `card`
    // and the `-` of `.sr-bc-card-x`, so the old form admitted a scope class that
    // nothing in the app carries. Same `\b`-against-a-hyphen trap as the
    // `/\b100%\b/` one CLAUDE.md records.
    // (parseTopLevelRules keys each member of a comma group separately, so every
    // key here is already ONE complex selector.)
    const legendRules = [...topLevel].filter(([sel]) => rightmost(sel) === '.sr-bc-legend')
    expect(legendRules.length, 'never vacuous: at least one legend rule must exist').toBeGreaterThan(0)
    for (const [sel] of legendRules) {
      expect(compounds(sel)[0], `every .sr-bc-legend rule must be scoped under .sr-bc-card: ${sel}`)
        .toBe('.sr-bc-card')
    }
  })

  it('leaves the card sizing itself intrinsically in BOTH tiers (the fix constrains the legend, not the card)', () => {
    // The rejected alternative was to size the card `min-content` at every width.
    // It measures the same on today's table only because every column is
    // width-pinned, and it would still be the MAX over both children — leaving the
    // legend free to dictate the card whenever it is the larger. The card's own two
    // widths are therefore unchanged, and this says so: desktop max-content (hug the
    // table) and the v0.5.70 ≤640 min-content (flush with the fixed-layout table).
    expect(decls(topLevel.get('.sr-bc-card')!).get('width')).toBe('max-content')
    // The ≤640 tier that declares the card — matched on its CONTENT, not on being
    // the first 640px block in the file (globals.css opens with a one-line
    // `@media (max-width: 640px)` for an unrelated map rule).
    const phoneTier = atRuleRanges()
      .map(([a, b]) => declarations.slice(a, b))
      .filter(block => /^\s*@media\s*\(max-width:\s*640px\)/.test(block) && block.includes('.sr-bc-card'))
    expect(phoneTier, 'the ≤640 tier block declaring .sr-bc-card must be found').toHaveLength(1)
    expect(phoneTier[0]).toMatch(/\.sr-bc-card\s*\{\s*width:\s*min-content;?\s*\}/)
  })
})

describe('legend chips wrap on a phone in Normal view (fix: breeding-legend-overflow)', () => {
  // The converse of the block above, and a DISTINCT defect: v0.5.84 stopped the
  // legend DICTATING an intrinsic card width, which can only happen in Unbounded.
  // Here the card is fixed at the panel's width and an unbreakable chip is simply
  // wider than it — the exact failure v0.5.84's decision anticipated by name when
  // it rejected a zero contribution. At 320px/200% with 23 codes the widest label
  // hangs 81.08px past the legend's content box, out through the card's rounded
  // border and off the screen; nothing between the legend and <body> clips it.
  //
  // WHAT THESE CAN CARRY. The claim is geometric, and jsdom has no layout engine,
  // so these assert the MECHANISM — that the three declarations exist, that they
  // are bounded to the phone tier at BOTH edges, and that they cannot reach
  // Unbounded. The geometry is measured on a real render by
  // pipeline/breeding-legend-overflow/legend-ink-probe.mjs (Playwright/Chromium,
  // ink measured through Range client rects, not element boxes: two of the five
  // mutations leave the BOX reading a clean zero while text hangs 22px and 81px
  // outside it, so a box-measuring harness certifies a half-fixed build as clean).

  /** Declarations of a rule body, keyed by property. */
  function decls(body: string): Map<string, string> {
    const out = new Map<string, string>()
    for (const d of body.split(';')) {
      const at = d.indexOf(':')
      if (at < 0) continue
      out.set(d.slice(0, at).trim(), d.slice(at + 1).trim())
    }
    return out
  }

  /**
   * The ≤640 tier block that carries these rules, matched on its FULL prelude so
   * BOTH media bounds are pinned. A media-query fix has two edges and a guard that
   * checks one is half a guard:
   *  - UPPER: `max-width: 640px` is the established phone boundary. Raising it
   *    would start rewrapping the legend on tablets and desktops, where it works.
   *  - LOWER: there must be NO min-width, or the fix stops covering the narrow end
   *    it was written for. The defect is worst at 320px, so a tier consolidated
   *    into e.g. `(min-width: 361px) and (max-width: 640px)` would reopen the whole
   *    band with this suite green — the shape a v0.5.84 sibling shipped.
   */
  function phoneTierBlock(): string {
    const blocks: string[] = []
    let i = 0
    let selStart = 0
    while (i < declarations.length) {
      if (declarations[i] === ';') { i++; selStart = i; continue }
      if (declarations[i] !== '{') { i++; continue }
      let depth = 1
      let j = i + 1
      while (j < declarations.length && depth > 0) {
        if (declarations[j] === '{') depth++
        else if (declarations[j] === '}') depth--
        j++
      }
      const prelude = declarations.slice(selStart, i).trim().replace(/\s+/g, ' ')
      // EXACT prelude, not a prefix test: `@media (max-width: 640px) and (…)` and
      // `@media (min-width: 361px) and (max-width: 640px)` both start or contain
      // the same text while covering a different band.
      if (prelude === '@media (max-width: 640px)' && declarations.slice(i, j).includes('.sr-bc-legend--normal')) {
        blocks.push(declarations.slice(i + 1, j - 1))
      }
      i = j
      selStart = j
    }
    expect(blocks, 'exactly one unbounded-below @media (max-width: 640px) block must carry the legend rules').toHaveLength(1)
    return blocks[0]
  }

  /** A rule inside the phone tier, by exact selector. */
  function tierRule(selector: string): Map<string, string> {
    const hits = collectRules(phoneTierBlock(), true).filter(r => r.selectors.includes(selector))
    expect(hits.map(r => r.selectors), `exactly one phone-tier rule for ${selector}`).toHaveLength(1)
    return decls(hits[0].body)
  }

  it('reproduces the inline nowrap EXACTLY at the top level, so nothing above 640px moves', () => {
    // The chip's white-space moved from a React inline style (specificity 1,0,0,
    // unreachable from a media query) to a class. The base value must be
    // byte-identical or every desktop width silently rewraps — and the class must
    // be TOP-LEVEL, which finding it in parseTopLevelRules' map is itself the proof
    // of (that map skips at-rule blocks whole).
    const d = decls(ruleBody('.sr-bc-legend-chip'))
    expect(d.get('white-space')).toBe('nowrap')
    expect(d.size, 'the base rule carries the lifted value and nothing else').toBe(1)
  })

  it('releases BOTH flex-item min-content floors, not just one', () => {
    // The tier group <div> and the chip <span> are both flex items, so both are
    // floored at min-content by `min-width: auto`. `C Courtship/Display/Copul.`
    // holds a 24-char run with no break opportunity whose min-content is 236.19px
    // against a 214px line, so releasing either floor alone still leaves 22.19px
    // leaking — measured both ways round. Dropping either declaration must go red.
    expect(tierRule('.sr-bc-legend--normal .sr-bc-legend-tier').get('min-width')).toBe('0')
    expect(tierRule('.sr-bc-legend--normal .sr-bc-legend-chip').get('min-width')).toBe('0')
  })

  it('lets the chips wrap and breaks the one run wider than the line', () => {
    const d = tierRule('.sr-bc-legend--normal .sr-bc-legend-chip')
    expect(d.get('white-space')).toBe('normal')
    // overflow-wrap is the declaration a BOX-based test reports as unnecessary:
    // without it the box reads a clean 0 while ink hangs 22.20px outside it.
    expect(d.get('overflow-wrap')).toBe('break-word')
  })

  it('never collapses into `anywhere`, which would zero the legend\'s contribution', () => {
    // `overflow-wrap: anywhere` renders identically here (same breaks, same height,
    // same zero leak) and would let both min-width: 0 declarations go — but it
    // collapses min-content to a single character, which is the zero-contribution
    // shape v0.5.84 named and rejected, and min-content is exactly what
    // `.sr-bc-card > .sr-bc-legend` reads. `break-word` never affects intrinsic
    // sizing. `word-break: break-all` is rejected for the same reason plus its
    // reach (it breaks every label, not the one run that needs it).
    const d = tierRule('.sr-bc-legend--normal .sr-bc-legend-chip')
    expect(d.get('overflow-wrap')).not.toBe('anywhere')
    expect(d.has('word-break')).toBe(false)
    expect(d.has('line-break')).toBe(false)
  })

  it('adds no hanging indent and truncates nothing (v0.5.56 stays intact)', () => {
    // A hanging indent was designed and rejected: padding-left changes the chip's
    // box at every width in this tier, including configurations that measure clean.
    // Flex collects items onto a line only while they fit, so a chip wide enough to
    // wrap is always alone on its line and needs no cue. And the labels must stay
    // fully readable — the v0.5.56 touch-a11y decision — so no ellipsis or clip may
    // arrive here by the back door.
    const d = tierRule('.sr-bc-legend--normal .sr-bc-legend-chip')
    for (const p of ['padding-left', 'text-indent', 'text-overflow', 'overflow', 'max-width', 'width']) {
      expect(d.has(p), `the chip rule must not declare ${p}`).toBe(false)
    }
  })

  it('scopes EVERY phone-tier legend rule under --normal, so Unbounded cannot be reached', () => {
    // This is the load-bearing half, and it is a SELECTOR claim rather than a
    // declaration one: `min-width: 0` on the tier group lowers the legend's
    // min-content, which is precisely the value `.sr-bc-card > .sr-bc-legend`
    // reads. Unscoped, this change would reach into v0.5.84's input. The component
    // adds `--normal` exactly when it omits `.sr-bc-card`, so the two can never
    // co-occur — which is what makes "Unbounded cannot change" a property of the
    // stylesheet instead of a measurement. Rejects a bare `.sr-bc-legend-chip` or
    // `.sr-bc-legend-tier` rule in any tier.
    //
    // Compares compounds EXACTLY. `.sr-bc-legend` is a prefix of all three of these
    // class names, so a String.includes scope check would pass on `.sr-bc-legend`
    // alone — which reaches Unbounded — and this guard would be worthless.
    const inTier = collectRules(phoneTierBlock(), true)
      .flatMap(r => r.selectors)
      .filter(sel => compounds(sel).some(c => /^\.sr-bc-legend(-|$)/.test(c)))
    expect(inTier.length, 'never vacuous: the phone-tier legend rules must be found').toBe(2)
    for (const sel of inTier) {
      expect(compounds(sel)[0], `phone-tier legend rule is not scoped to Normal view: ${sel}`)
        .toBe('.sr-bc-legend--normal')
    }
  })

  it('leaves v0.5.84\'s Unbounded constraint exactly as it shipped', () => {
    // Stated separately from the block above so a change here fails with a message
    // naming the rule it broke: this fix adds a Normal-view constraint that rule
    // deliberately did not cover, and must change nothing about it — the two
    // declarations, and NOTHING else acquired alongside them.
    //
    // Matched by what the rule TARGETS, not by one literal spelling.
    // `.sr-bc-card > .sr-bc-legend` and `.sr-bc-card .sr-bc-legend` select the same
    // element (the legend is a direct child either way), so keying on the shipped
    // string would go red on a refactor that changed nothing — which is exactly
    // what it did when this was first written, caught by mutation testing.
    const hits = [...topLevel].filter(([sel]) => /^\.sr-bc-card\s*>?\s*\.sr-bc-legend$/.test(sel))
    expect(hits, 'exactly one top-level rule must constrain the legend inside the card').toHaveLength(1)
    const d = decls(hits[0][1])
    expect(d.get('width')).toBe('min-content')
    expect(d.get('min-width')).toBe('100%')
    expect(d.size, 'the rule must not acquire a third declaration').toBe(2)
  })
})

describe('pinned status note', () => {
  it('keeps the live-region wrapper chromeless so it collapses to nothing when empty', () => {
    // The region is always rendered. If it carried padding/margin/border it would
    // leave a visible gap above the table for every user who never pins.
    const body = ruleBody('.sr-pinstatus')
    expect(body).toMatch(/display:\s*block/)
    expect(body).not.toMatch(/padding|margin|border|background/)
  })

  it('enters with a short ease-out rise and honors prefers-reduced-motion', () => {
    expect(ruleBody('.sr-pinnote--enter')).toMatch(/animation:\s*sr-pin-note-in 160ms ease-out both/)
    const reduced = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce) {\n  .sr-pinnote--enter'))
    expect(reduced.slice(0, 120)).toMatch(/animation:\s*none/)
  })

  it('uses only --sr-* tokens for its colors', () => {
    const body = ruleBody('.sr-pinnote')
    expect(body).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
    expect(body).toContain('var(--sr-surface-faint)')
    expect(body).toContain('var(--sr-border-subtle)')
    expect(body).toContain('var(--sr-text-muted)')
  })
})
