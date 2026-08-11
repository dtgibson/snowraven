// Guard for the Multimedia pinned-header stylesheet rules (feature:
// freezable-label-rows). Like the Breeding Codes band, the pin IS the CSS — the
// component only adds a class — so the rules are the feature, and every one of
// them is invisible to a jsdom component test (no layout engine, no media
// queries, no env()). This parses the REAL globals.css, the same posture as
// breedingCodePinnedCss / milestoneContrast / calendarContrast / helpToc.
//
// These rules must apply at ALL viewport widths, so they are read through the
// SHARED parser in ./cssTopLevelRules rather than a substring match: a rule
// DRY-consolidated into the ≤640 phone tier would vanish from the map and fail
// here, instead of passing while every width above 640 (iPad, desktop) is left
// uncovered. Exact selector keys are the other half — they are what lets the
// "the ungated rule reaches no env()" assertion below actually test the ungated
// rule rather than finding its own selector inside the .sr-ios-app one.
/// <reference types="node" />
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { parseTopLevelRules } from './cssTopLevelRules'

const css = readFileSync(fileURLToPath(new URL('../globals.css', import.meta.url)), 'utf8')
const tsx = readFileSync(
  fileURLToPath(new URL('../components/LifeListTable.tsx', import.meta.url)),
  'utf8',
)
const tabTsx = readFileSync(
  fileURLToPath(new URL('../components/LifeList.tsx', import.meta.url)),
  'utf8',
)

// Comments stripped, for assertions about what the stylesheet DECLARES. The raw
// text is the wrong thing to search for an absence: this file's comments discuss
// the mechanisms it deliberately does not use, and a prose mention would
// otherwise read as a declaration.
const declarations = css.replace(/\/\*[\s\S]*?\*\//g, '')

const topLevel = parseTopLevelRules(css)

function topLevelRule(selector: string): string {
  const body = topLevel.get(selector)
  expect(body, `${selector} missing from globals.css (top level, outside any @media)`).toBeTruthy()
  return body!
}

/** The four selectors the focus guard must cover: the cells AND their descendants. */
const focusSelectors = (prefix: string) => [
  `${prefix} tbody th`,
  `${prefix} tbody td`,
  `${prefix} tbody th *`,
  `${prefix} tbody td *`,
]

describe('Multimedia pinned header band', () => {
  it('sticks the HEADER CELLS with a page-anchored top, at every viewport width', () => {
    const body = topLevelRule('.sr-ll-table--pinned thead th')
    expect(body).toMatch(/position:\s*sticky/)
    expect(body).toMatch(/top:\s*0/)
    expect(body).toMatch(/z-index:\s*3/)
  })

  it('never puts position:sticky on <thead> or <tr> — the defect being repaired', () => {
    // This is the whole point of the change. WKWebView and older Safari honor
    // sticky on CELLS only, and SnowRaven ships in WKWebView on macOS and iOS, so
    // the <tr> form that shipped from v0.0.29 looked right in Chrome and did
    // nothing in the app. Asserted over the raw stylesheet AND the component, since
    // the old declaration was an inline style rather than a rule.
    expect(css).not.toMatch(/\.sr-ll-table[^{]*\s(thead|tr)\s*\{[^}]*position:\s*sticky/)
    expect(tsx).not.toMatch(/position:\s*['"]sticky['"]/)
  })

  it('carries the band fill on the CELLS, opaque, so body rows cannot read through', () => {
    // A sticky cell travels while its <tr> stays in flow, so the fill has to be on
    // what moves. --sr-bg is opaque in both themes.
    const body = topLevelRule('.sr-ll-table--pinned thead th')
    expect(body).toMatch(/background:\s*var\(--sr-bg\)/)
  })

  it('uses the same hairline + haze pair as the Breeding Codes band', () => {
    // The two surfaces are deliberately one pattern, not two independently invented
    // sticky headers. As recorded for the Breeding Codes band, this pair is visual
    // reinforcement and is NOT claimed as a WCAG 1.4.11 pass: the header is
    // identified by its text.
    const ll = topLevelRule('.sr-ll-table--pinned thead th')
    expect(ll).toContain('var(--sr-border-medium)')
    expect(ll).toContain('var(--sr-sticky-shadow)')
    const bc = topLevelRule('.sr-bc-matrix--pinned thead th')
    const shadow = (b: string) => /box-shadow:\s*([^;]+);/.exec(b)![1].trim()
    expect(shadow(ll)).toBe(shadow(bc))
  })

  it('uses only --sr-* tokens for its colors', () => {
    expect(topLevelRule('.sr-ll-table--pinned thead th')).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
  })
})

describe('keyboard focus under the Multimedia band (WCAG 2.2 SC 2.4.11)', () => {
  // HONEST LIMIT, stated so nobody reads more into these than they carry: the real
  // claim is geometric ("no focused control comes to rest under the band"), and
  // jsdom has no layout engine, so nothing here can evaluate it. These assert the
  // MECHANISM is capable of working, and lock the choice BETWEEN fixes.

  it('puts scroll-margin-top on the cells AND their focusable descendants', () => {
    // The descendant selectors are the operative half, not defensive noise.
    // `scroll-margin` applies to the element scrolled INTO VIEW and does not
    // inherit, and the focusables here are never the cells: BirdName renders a
    // <button class="sr-birdname-link"> inside each row-header cell, and every
    // media count is an <a>. A cell-only rule computes 0px on all of them — the
    // exact mistake the Breeding Codes band shipped and had to correct.
    for (const sel of focusSelectors('.sr-ll-table--pinned')) {
      expect(topLevelRule(sel)).toMatch(/scroll-margin-top:\s*3rem/)
    }
  })

  it('adds the safe-area inset on iOS across the SAME four selectors', () => {
    // Covering only the cells would leave iOS with the original defect while the
    // web build is fixed — the half-fix shape this repo has been bitten by before.
    for (const sel of focusSelectors('.sr-ios-app .sr-ll-table--pinned')) {
      expect(topLevelRule(sel)).toMatch(/scroll-margin-top:\s*calc\(3rem \+ env\(safe-area-inset-top, 0px\)\)/)
    }
  })

  it('does not introduce a document-scoped scroll-padding-top', () => {
    // scroll-padding goes on a scrollport, scroll-margin on a focus target. In
    // Unbounded the scrollport is the PAGE, so the padding form would have to live
    // on the root — and deferred tabs stay MOUNTED when hidden, so pinning and
    // navigating away would leave a document-wide scroll-padding on every other
    // tab. This asserts the LEAK SHAPE (a root/html-scoped declaration), not the
    // property vocabulary, so an unrelated future surface with a real scrollport
    // of its own can still use scroll-padding-top legitimately.
    for (const [, selector, body] of declarations.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      if (!/scroll-padding-top\s*:/.test(body)) continue
      expect(
        selector.trim(),
        'scroll-padding-top must not be document-scoped: it outlives the tab that set it',
      ).not.toMatch(/(^|,)\s*(:root|html)\b/)
    }
  })
})

describe('Multimedia pinned header, iOS safe area', () => {
  it('re-points `top` to the safe-area inset under the .sr-ios-app gate', () => {
    // A sticky element resolves `top` against its SCROLLPORT (the viewport), which
    // sits ABOVE `.sr-ios-app body`'s padding-top — so without this the band pins
    // into the notch / Dynamic Island. This is also precisely why the sticky could
    // not stay inline: a stylesheet cannot override specificity 1,0,0.
    expect(topLevelRule('.sr-ios-app .sr-ll-table--pinned thead th'))
      .toMatch(/top:\s*env\(safe-area-inset-top,\s*0px\)/)
  })

  it('gates EVERY safe-area rule on .sr-ios-app so web stays byte-identical', () => {
    // index.html ships viewport-fit=cover to browsers too, so env() is NOT zero in
    // iOS Safari; an ungated rule would change shipped web rendering on every
    // notched phone. Exact selector keys are what make this assertion land on the
    // UNGATED rule rather than finding itself inside the gated one.
    for (const sel of ['.sr-ll-table--pinned thead th', ...focusSelectors('.sr-ll-table--pinned')]) {
      expect(topLevelRule(sel), `${sel} must not reach env() without the .sr-ios-app gate`)
        .not.toContain('env(')
    }
  })
})

describe('Multimedia control row, touch-target parity', () => {
  // The parity gap: the Breeding Codes view toggle got .sr-touch-target in
  // v0.5.81 and this identical button did not, so it ships 15px tall against the
  // ~44px phone posture. Asserted at the source, because LifeList is a whole tab
  // that autoloads through three seams — a full component mount would test the
  // mocking, not the class, and the class itself is the entire claim (its ≤640
  // min-height is a media query, which jsdom cannot evaluate either way).
  it('puts .sr-touch-target on the Unbounded/Normal view toggle', () => {
    const at = tabTsx.indexOf("wideMode ? '↔ Normal' : '↔ Unbounded'")
    expect(at, 'the view toggle was not found in LifeList.tsx').toBeGreaterThan(-1)
    // Bounded to the button's own opening tag: search backwards to the <button
    // that owns this label, so a class on some other control cannot satisfy it.
    const open = tabTsx.lastIndexOf('<button', at)
    expect(open).toBeGreaterThan(-1)
    expect(tabTsx.slice(open, at)).toContain('className="sr-touch-target"')
  })
})
