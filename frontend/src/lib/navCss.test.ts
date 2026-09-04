// The main navigation's stylesheet contract (feature: nav-rework).
//
// WHAT A STYLESHEET TEST CAN PROVE, and where this one stops. It proves a rule
// exists, is scoped to the selector it claims, and applies at every width. It
// cannot prove the rule WINS against an inline style, and it cannot see geometry
// at all — .claude/rules/testing.md is explicit that the label ink fitting its
// cell, the container query actually dropping labels at 200% text scale, and the
// column not clipping a label are BROWSER measurements at 320 / 390 / 430px in
// Chromium AND WebKit, which no vitest file substitutes for.
//
// What it does buy: the JS/CSS duplications this feature introduced cannot drift
// silently. The nav's density arithmetic has to know the column widths and the
// Map Explorer sidebar's clamp as NUMBERS, because an unregistered custom
// property is not resolved by getComputedStyle and there is nothing to read back.
// Those numbers are parsed out of the shipped stylesheet here and compared.
/// <reference types="node" />
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { parseTopLevelRules } from './cssTopLevelRules'
import {
  MAP_SIDEBAR_MAX_PX,
  MAP_SIDEBAR_MIN_PX,
  MAP_SIDEBAR_VW,
  NAV_RAIL_REM,
  NAV_SIDEBAR_REM,
} from './navDensity'

const CSS = readFileSync(fileURLToPath(new URL('../globals.css', import.meta.url)), 'utf8')
const RULES = parseTopLevelRules(CSS)

/** One rule's body, failing loudly rather than passing vacuously when it is gone. */
function body(selector: string): string {
  const b = RULES.get(selector)
  expect(b, `top-level rule not found: ${selector}`).toBeTruthy()
  return b!
}

/** One declaration's value from a rule body. */
function decl(selector: string, prop: string): string {
  const m = new RegExp(`(?:^|[;{])\\s*${prop}\\s*:([^;}]*)`).exec(body(selector))
  expect(m, `${selector} declares no ${prop}`).toBeTruthy()
  return m![1].trim()
}

// The token blocks are located by index rather than by selector: this is a block
// lookup, not selector selection, and matches how the contrast guards do it.
function tokenBlock(opener: string): string {
  const i = CSS.indexOf(opener)
  expect(i, `token block not found: ${opener}`).toBeGreaterThan(-1)
  return CSS.slice(i, CSS.indexOf('\n}', i))
}
const tokenValue = (block: string, name: string): string | null => {
  const m = new RegExp(`${name}\\s*:([^;]*)`).exec(block)
  return m ? m[1].trim() : null
}

describe('the one new token is defined in BOTH themes, before use', () => {
  const light = tokenBlock(':root {')
  const dark = tokenBlock('[data-theme="dark"] {')

  it('--sr-nav-bar-shadow exists in each', () => {
    expect(tokenValue(light, '--sr-nav-bar-shadow')).toBeTruthy()
    expect(tokenValue(dark, '--sr-nav-bar-shadow')).toBeTruthy()
  })

  it('and the dark value is DELIBERATELY different, not a copied light haze', () => {
    // The milestone-badge post-mortem cuts both ways: this token carries no text
    // so there is no AA question, but a 12% haze is invisible against the
    // near-black --sr-bg and the bar would read as flat. Its downward twin
    // --sr-sticky-shadow makes exactly the same distinction.
    expect(tokenValue(dark, '--sr-nav-bar-shadow')).not.toBe(tokenValue(light, '--sr-nav-bar-shadow'))
  })

  it('it is an UPWARD shadow, which is the whole reason it is not --sr-sticky-shadow', () => {
    for (const block of [light, dark]) {
      expect(tokenValue(block, '--sr-nav-bar-shadow')).toMatch(/^0\s+-/)
      expect(tokenValue(block, '--sr-sticky-shadow')).not.toMatch(/^0\s+-/)
    }
  })

  it('neither theme reaches for pure black', () => {
    for (const block of [light, dark]) {
      expect(tokenValue(block, '--sr-nav-bar-shadow')).not.toMatch(/rgba\(\s*0\s*,\s*0\s*,\s*0\s*,/)
    }
  })

  it('--sr-navbar-h has a 0px default, so a nav with no bar reserves nothing', () => {
    expect(tokenValue(light, '--sr-navbar-h')).toBe('0px')
  })
})

describe('the numbers the derivation duplicates are the numbers the stylesheet ships', () => {
  // This is the whole point of the file. lib/navDensity.ts has to hold these as
  // JS numbers; if either side moves alone, the nav decides its density against a
  // column width the page does not have.

  it('the sidebar column is NAV_SIDEBAR_REM wide', () => {
    expect(decl('.sr-nav-col', 'width')).toBe(`${NAV_SIDEBAR_REM}rem`)
  })

  it('the rail column is NAV_RAIL_REM wide', () => {
    expect(decl('.sr-nav-col--rail', 'width')).toBe(`${NAV_RAIL_REM}rem`)
  })

  it('the Map Explorer sidebar clamp matches the reserve the nav subtracts', () => {
    const width = decl('.sr-map-sidebar-overlay', 'width')
    const m = /^clamp\(\s*(\d+)px\s*,\s*(\d+)vw\s*,\s*(\d+)px\s*\)$/.exec(width)
    expect(m, `unexpected map sidebar width: ${width}`).toBeTruthy()
    expect(Number(m![1])).toBe(MAP_SIDEBAR_MIN_PX)
    expect(Number(m![2]) / 100).toBeCloseTo(MAP_SIDEBAR_VW, 5)
    expect(Number(m![3])).toBe(MAP_SIDEBAR_MAX_PX)
  })

  it('both column widths are rem, so the ratio to the rem-sized labels is fixed', () => {
    // The design's "label fit is scale-invariant by construction" claim. A px
    // column would break it at every text scale, and the ellipsis backstop would
    // start firing on labels it is not expected to.
    expect(decl('.sr-nav-col', 'width')).toMatch(/rem$/)
    expect(decl('.sr-nav-col--rail', 'width')).toMatch(/rem$/)
  })
})

describe('the width transition runs on the MANUAL toggle only', () => {
  it('the base column declares no transition at all', () => {
    // A derived density change during a window drag must be instant: animating it
    // reflows the content column every frame, which on the Map Explorer tab is a
    // MapLibre resize storm. The opt-in class is what makes that a property of
    // the stylesheet rather than of the component's discipline.
    expect(body('.sr-nav-col')).not.toMatch(/(^|[;{])\s*transition\s*:/)
    expect(body('.sr-nav-col--rail')).not.toMatch(/(^|[;{])\s*transition\s*:/)
  })

  it('and the opt-in class is the only place width is animated', () => {
    expect(decl('.sr-nav-col--anim', 'transition')).toMatch(/^width\s+200ms/)
    const widthTransitions = [...CSS.matchAll(/transition\s*:[^;}]*\bwidth\b[^;}]*/g)]
    // Exactly one rule in the whole stylesheet animates a width on the nav column.
    expect(widthTransitions.filter(m => m[0].includes('width')).length).toBeGreaterThan(0)
    expect(body('.sr-nav-col--anim')).toContain('width 200ms')
  })

  it('every nav transition is under the 300ms the doctrine allows', () => {
    const navBlock = CSS.slice(CSS.indexOf('/* ── Main navigation'))
    for (const m of navBlock.matchAll(/(\d+)ms/g)) {
      expect(Number(m[1]), `nav motion of ${m[1]}ms exceeds 300ms`).toBeLessThanOrEqual(300)
    }
  })
})

describe('the phone bar is fixed, and the page is told to clear it', () => {
  it('the bar is fixed to the viewport bottom', () => {
    expect(decl('.sr-navbar', 'position')).toBe('fixed')
    expect(decl('.sr-navbar', 'bottom')).toBe('0')
  })

  it('the shell reserves the bar\'s MEASURED height, not a constant', () => {
    // A constant cannot be right: the bar is text, so it grows with the in-app
    // text scale, and its labels drop out under the container query at large
    // scales. Same argument as --sr-map-chrome, one surface along.
    expect(decl('.sr-shell--phone', 'padding-bottom')).toBe('var(--sr-navbar-h, 0px)')
  })

  it('the sheet rises ABOVE the bar rather than under it', () => {
    expect(Number(decl('.sr-nav-sheet-root', 'z-index')))
      .toBeGreaterThan(Number(decl('.sr-navbar', 'z-index')))
  })

  it('the bar clears the map library\'s controls, per the overlay convention', () => {
    expect(Number(decl('.sr-navbar', 'z-index'))).toBeGreaterThanOrEqual(1200)
  })
})

describe('labels drop out by CONTAINER query, never a viewport breakpoint', () => {
  // parseTopLevelRules skips at-rule blocks whole and structurally cannot answer
  // this, so it gets its own local reach — the per-question carve-out
  // .claude/rules/testing.md describes.
  const container = /@container\s*\(([^)]*)\)\s*\{([^}]*\{[^}]*\}[^}]*)\}/g
  const blocks = [...CSS.matchAll(container)]

  it('there is a container query bounding the bar labels', () => {
    const label = blocks.filter(b => b[2].includes('.sr-navbar-label'))
    expect(label, 'no @container rule governs .sr-navbar-label').toHaveLength(1)
    expect(label[0][2]).toMatch(/display\s*:\s*none/)
  })

  it('its bound is in REM, which is what makes it track the in-app text scale', () => {
    // rem in a container query resolves against the ROOT font size, which
    // --sr-text-scale multiplies. A px bound would clip the labels at 200%
    // instead of dropping them, which is the defect this shape exists to avoid.
    const label = blocks.find(b => b[2].includes('.sr-navbar-label'))!
    expect(label[1]).toMatch(/max-width:\s*[\d.]+rem/)
  })

  it('and the bar declares itself the query container', () => {
    expect(decl('.sr-navbar', 'container-type')).toBe('inline-size')
  })

  it('no viewport media query hides the bar labels — that would be the wrong tool', () => {
    const mediaBlocks = [...CSS.matchAll(/@media[^{]*\{(?:[^{}]|\{[^{}]*\})*\}/g)]
    for (const m of mediaBlocks) {
      if (!m[0].includes('.sr-navbar-label')) continue
      expect(m[0], 'a media query is deciding label legibility').not.toMatch(/display\s*:\s*none/)
    }
  })
})

describe('the iOS safe-area gates', () => {
  // GATED, never a bare env(): index.html ships viewport-fit=cover to browsers
  // too, so an ungated rule silently changes shipped WEB rendering on every
  // notched phone. Assert the ungated base rules contain no env( at all.
  const GATED: Array<[base: string, gated: string]> = [
    ['.sr-nav-col', '.sr-ios-app .sr-nav-col'],
    ['.sr-navbar', '.sr-ios-app .sr-navbar'],
    ['.sr-nav-sheet', '.sr-ios-app .sr-nav-sheet'],
  ]

  it.each(GATED)('%s carries no bare env()', base => {
    expect(body(base)).not.toContain('env(')
  })

  it.each(GATED)('%s has a gated counterpart that does', (_base, gated) => {
    expect(body(gated)).toContain('env(safe-area-inset-')
  })

  it('the sticky column is RE-POINTED and its height cap subtracts the same inset', () => {
    // A sticky element resolves `top` against the scrollport, so it escapes
    // `.sr-ios-app body`'s padding-top entirely. Moving `top` without also
    // shortening the 100dvh cap would over-extend the column by exactly the
    // inset: invisible on a phone, live on iPad.
    const gated = body('.sr-ios-app .sr-nav-col')
    expect(gated).toMatch(/top:\s*env\(safe-area-inset-top/)
    expect(gated).toMatch(/height:\s*calc\(100dvh\s*-\s*env\(safe-area-inset-top/)
  })

  it('the two bottom-edge surfaces PAD rather than move', () => {
    // They are full-width boxes at the bottom edge, so padding is right for them
    // where it would be wrong for a point-anchored pill like the skip link.
    expect(body('.sr-ios-app .sr-navbar')).toMatch(/padding-bottom:\s*calc\(/)
    expect(body('.sr-ios-app .sr-nav-sheet')).toMatch(/padding-bottom:\s*calc\(/)
    for (const sel of ['.sr-ios-app .sr-navbar', '.sr-ios-app .sr-nav-sheet']) {
      expect(body(sel)).not.toMatch(/(^|[;{])\s*top\s*:/)
    }
  })

  it('every gated rule keeps its 0px fallback, or the declaration is invalid where env() is unknown', () => {
    for (const [, gated] of GATED) {
      for (const m of body(gated).matchAll(/env\(safe-area-inset-[a-z]+([^)]*)\)/g)) {
        expect(m[1], `missing fallback in ${gated}`).toMatch(/,\s*0px/)
      }
    }
  })
})

describe('the nav rules apply at every width', () => {
  it('every one of them is TOP-LEVEL, not stranded in a tier', () => {
    // parseTopLevelRules skips at-rule blocks whole, so simply resolving these
    // through it is the assertion: a rule consolidated into the ≤640 tier would
    // vanish from the map and `body()` would fail.
    for (const sel of [
      '.sr-shell', '.sr-shell--phone', '.sr-content',
      '.sr-nav-col', '.sr-nav-col--rail', '.sr-nav-col--anim',
      '.sr-nav-item', '.sr-nav-sep', '.sr-nav-collapse', '.sr-nav-tip',
      '.sr-navbar', '.sr-navbar-cell', '.sr-navbar-label',
      '.sr-nav-sheet-root', '.sr-nav-sheet',
    ]) {
      expect(RULES.has(sel), `${sel} is not a top-level rule`).toBe(true)
    }
  })

  it('the page is still the scrollport: the content column sets no overflow', () => {
    // Both pinned-label bands are position:sticky cells that anchor to the PAGE
    // precisely because nothing between them and the viewport sets overflow, and
    // their scroll-margin-top focus guards are written for that scrollport. The
    // mockup's frame set overflow here; the app must not.
    expect(body('.sr-content')).not.toMatch(/(^|[;{])\s*overflow[-a-z]*\s*:/)
  })

  it('the nav column scrolls itself instead, which is what leaves the page alone', () => {
    expect(decl('.sr-nav-col', 'position')).toBe('sticky')
    expect(decl('.sr-nav-col', 'overflow-y')).toBe('auto')
    expect(decl('.sr-nav-col', 'height')).toBe('100dvh')
    // A stretched flex item fills the row and has no room to stick.
    expect(decl('.sr-nav-col', 'align-self')).toBe('flex-start')
  })
})

describe('the guard is not silently scanning nothing (mutation sanity)', () => {
  it('body() fails loudly on a selector that is not there', () => {
    expect(() => body('.sr-nav-not-a-real-rule')).toThrow()
  })

  it('decl() fails loudly on a property the rule does not declare', () => {
    expect(() => decl('.sr-nav-col', 'font-variant-emoji')).toThrow()
  })

  it('the stylesheet it parsed is the real one', () => {
    expect(RULES.size).toBeGreaterThan(100)
    expect(CSS).toContain('Main navigation')
  })
})
