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

// Vitest stubs `.css` imports (`?raw` included), so read the file directly. Node
// types are pulled in for this one file by the reference above, matching how
// tsconfig.node scopes them to tooling.
const css = readFileSync(new URL('../globals.css', import.meta.url), 'utf8')

// Comments stripped, for assertions about what the stylesheet DECLARES. The raw
// text is the wrong thing to search for an absence: this file's comments discuss
// the properties it deliberately does not use, and a prose mention would otherwise
// read as a declaration.
const declarations = css.replace(/\/\*[\s\S]*?\*\//g, '')

/** Body of the first rule whose selector list matches `selector` exactly. */
function ruleBody(selector: string): string {
  const at = css.indexOf(selector + ' {')
  if (at < 0) throw new Error(`rule not found: ${selector}`)
  const open = css.indexOf('{', at)
  const close = css.indexOf('}', open)
  return css.slice(open + 1, close)
}

/** Source offset of a rule's selector, for source-order assertions. */
function ruleOffset(selector: string): number {
  const at = css.indexOf(selector + ' {')
  if (at < 0) throw new Error(`rule not found: ${selector}`)
  return at
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

  /** The selector list must reach the focusable DESCENDANTS, not just the cells. */
  const focusRule = '.sr-bc-matrix--pinned tbody th,\n.sr-bc-matrix--pinned tbody td,\n.sr-bc-matrix--pinned tbody th *,\n.sr-bc-matrix--pinned tbody td *'

  it('puts scroll-margin-top on the cells AND their focusable descendants', () => {
    // Rejects the exact mistake that was made. `scroll-margin` applies to the
    // element scrolled INTO VIEW and does not inherit, and focus lands on the
    // <button> BirdName renders inside the cell — so a cell-only rule computes 0px
    // on every focusable and never participates in the scroll. The `*` covers
    // present and future focusables without enumerating them.
    expect(ruleBody(focusRule)).toMatch(/scroll-margin-top:\s*3rem/)
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
    const iosRule = '.sr-ios-app .sr-bc-matrix--pinned tbody th,\n.sr-ios-app .sr-bc-matrix--pinned tbody td,\n.sr-ios-app .sr-bc-matrix--pinned tbody th *,\n.sr-ios-app .sr-bc-matrix--pinned tbody td *'
    expect(ruleBody(iosRule)).toMatch(/scroll-margin-top:\s*calc\(3rem \+ env\(safe-area-inset-top, 0px\)\)/)
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
