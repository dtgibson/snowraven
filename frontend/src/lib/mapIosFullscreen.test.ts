/// <reference types="node" />
// The iOS map-fullscreen composition rule (mobile-app design review, user-
// approved): on iOS builds, fullscreen hides the sidebar at ANY width and the
// Filters FAB appears. Guarded at both halves:
//  1. mapContentClass — the seam-driven class decision (pure).
//  2. globals.css — the .sr-map-ios-fullscreen rules must mirror the ≤640
//     phone-tier block (parse-the-stylesheet pattern, like milestoneContrast).
//  3. MapExplorer.tsx — the class must be wired through isIOS(), so a
//     refactor can't silently turn it on for desktop fullscreen.
//  4. The fullscreen PANEL's safe-area inset (dynamic-island-map-tabs fix) —
//     App.tsx must apply .sr-map-fullscreen-panel instead of inline
//     position/inset/z-index (an inline inset:0 is specificity 1,0,0, so no
//     class rule could add the inset), the inset must be .sr-ios-app-gated, and
//     the sidebar overlay must NOT re-apply its own left inset on top of it.
// The stylesheet is read via fs because vitest stubs CSS ?raw imports.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { mapContentClass } from './mapFullscreen'

const css = readFileSync(fileURLToPath(new URL('../globals.css', import.meta.url)), 'utf8')
const mapExplorer = readFileSync(
  fileURLToPath(new URL('../components/MapExplorer.tsx', import.meta.url)),
  'utf8',
)
const app = readFileSync(fileURLToPath(new URL('../App.tsx', import.meta.url)), 'utf8')

// Remove every @media { … } block (brace-depth walk) so iosRule can only match
// TOP-LEVEL rules. This enforces the any-width guarantee for real: globals.css
// says the .sr-map-ios-fullscreen rules "mirror the ≤640 phone-tier block —
// keep the two in sync", which invites a DRY consolidation INTO that media
// block; doing so would silently kill iOS fullscreen at >640px (iPad — the
// primary device the scope class exists for) while a bare textual regex would
// keep matching. Stripping the media blocks makes that relocation fail here.
function stripMediaBlocks(src: string): string {
  let out = ''
  let i = 0
  for (;;) {
    const at = src.indexOf('@media', i)
    if (at === -1) {
      out += src.slice(i)
      return out
    }
    out += src.slice(i, at)
    const open = src.indexOf('{', at)
    if (open === -1) return out // malformed tail — nothing top-level left
    let depth = 1
    let j = open + 1
    while (j < src.length && depth > 0) {
      if (src[j] === '{') depth++
      else if (src[j] === '}') depth--
      j++
    }
    i = j
  }
}

const topLevelCss = stripMediaBlocks(css)

// The declaration block for `.sr-map-ios-fullscreen <child>` — matched against
// the media-stripped stylesheet, so only top-level rules count (the scope
// class must work at ANY width).
function iosRule(childSelector: string): string {
  const re = new RegExp(
    String.raw`\.sr-map-ios-fullscreen\s+${childSelector.replace(/\./g, '\\.')}\s*\{([^}]*)\}`,
  )
  const m = topLevelCss.match(re)
  expect(m, `.sr-map-ios-fullscreen ${childSelector} rule missing from globals.css (top-level)`).toBeTruthy()
  return m![1]
}

// A whole-selector rule matcher over the media-stripped stylesheet. Anchored to
// the start of a line so `.sr-map-fullscreen-panel` cannot accidentally match
// inside `.sr-ios-app .sr-map-fullscreen-panel` — the base rule and its gated
// companion have to be asserted separately for the gating test to mean anything.
function cssRule(selector: string): string {
  const re = new RegExp(
    String.raw`(?:^|\n)[ \t]*` +
      selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') +
      String.raw`\s*\{([^}]*)\}`,
  )
  const m = topLevelCss.match(re)
  expect(m, `${selector} rule missing from globals.css (top-level)`).toBeTruthy()
  return m![1]
}

// The Map Explorer tabpanel's opening tag in App.tsx (className + style),
// bounded by its own body so the assertions below can't drift onto another
// panel further down the file.
function mapPanelJsx(): string {
  const at = app.indexOf('id="panel-map-explorer"')
  expect(at, 'map-explorer tabpanel not found in App.tsx').toBeGreaterThan(-1)
  const end = app.indexOf("mountedTabs.has('map-explorer')", at)
  expect(end, 'map-explorer tabpanel body not found in App.tsx').toBeGreaterThan(at)
  return app.slice(at, end)
}

// Drop whole-line `//` comments (never mid-line, so no string containing `//`
// can be truncated). The negative assertions below search for the OLD inline
// declarations, and this file's own explanatory comments quote them.
function stripCommentLines(src: string): string {
  return src
    .split('\n')
    .filter((l) => !l.trim().startsWith('//'))
    .join('\n')
}

describe('mapContentClass', () => {
  it('adds sr-map-ios-fullscreen only for iOS fullscreen', () => {
    expect(mapContentClass(true)).toBe('sr-map-content sr-map-ios-fullscreen')
    expect(mapContentClass(false)).toBe('sr-map-content')
  })
})

describe('iosRule top-level enforcement (the any-width guarantee)', () => {
  it('stripMediaBlocks removes rules nested inside @media, keeps top-level ones', () => {
    const fixture = [
      '.sr-keep { color: red; }',
      '@media (max-width: 640px) { .sr-map-ios-fullscreen .sr-x { display: block; } }',
      '@media (min-width: 1024px) { @supports (gap: 1px) { .sr-nested { gap: 1px; } } }',
      '.sr-also-keep { color: blue; }',
    ].join('\n')
    const stripped = stripMediaBlocks(fixture)
    expect(stripped).toContain('.sr-keep')
    expect(stripped).toContain('.sr-also-keep')
    expect(stripped).not.toContain('sr-map-ios-fullscreen')
    expect(stripped).not.toContain('sr-nested')
  })

  it('globals.css keeps the .sr-map-ios-fullscreen rules OUT of media blocks', () => {
    // The raw stylesheet contains the selectors, and so does the stripped one —
    // i.e. every occurrence is top-level. If a consolidation moves them inside
    // the ≤640 tier, the stripped copy loses them and the iosRule tests fail.
    expect(css).toContain('.sr-map-ios-fullscreen')
    expect(topLevelCss).toContain('.sr-map-ios-fullscreen')
  })
})

describe('globals.css .sr-map-ios-fullscreen rules (mirror the ≤640 phone tier)', () => {
  it('turns the sidebar into the phone-tier overlay', () => {
    const body = iosRule('.sr-map-sidebar-overlay')
    expect(body).toMatch(/position:\s*absolute/)
    expect(body).toMatch(/width:\s*min\(282px,\s*90vw\)/)
    expect(body).toMatch(/z-index:\s*1200/)
  })

  it('hides the closed sidebar entirely (the map owns the whole canvas)', () => {
    expect(iosRule('.sr-map-sidebar-overlay.sr-map-sidebar-hidden')).toMatch(/display:\s*none/)
  })

  it('shows the backdrop, the Filters FAB, and the sidebar close header', () => {
    expect(iosRule('.sr-map-backdrop')).toMatch(/display:\s*block/)
    expect(iosRule('.sr-map-filters-btn')).toMatch(/display:\s*inline-flex/)
    expect(iosRule('.sr-map-sidebar-close')).toMatch(/display:\s*flex/)
  })
})

describe('MapExplorer wiring', () => {
  it('applies the class through the isIOS() seam only (desktop/web fullscreen untouched)', () => {
    expect(mapExplorer).toMatch(/mapContentClass\(\s*isIOS\(\)\s*&&/)
  })
})

// ── The fullscreen panel's safe-area inset (dynamic-island-map-tabs) ─────────
// The bug: the fullscreen panel was position:fixed inset:0 INLINE, which is
// viewport-relative and so escapes `.sr-ios-app body`'s safe-area padding. Its
// first child is the map view-mode pill row, which therefore rendered under the
// status bar and the Dynamic Island.
describe('globals.css fullscreen panel positioning + iOS inset', () => {
  it('keeps the fullscreen panel rules OUT of media blocks', () => {
    // Same any-width guarantee as the .sr-map-ios-fullscreen block: iPad
    // fullscreen is >640px, so a consolidation into the phone tier would strand
    // the inset on exactly the devices the scope class exists for.
    expect(css).toContain('.sr-map-fullscreen-panel')
    expect(topLevelCss).toContain('.sr-map-fullscreen-panel')
  })

  it('carries the positioning that used to be inline in App.tsx', () => {
    const body = cssRule('.sr-map-fullscreen-panel')
    expect(body).toMatch(/position:\s*fixed/)
    expect(body).toMatch(/inset:\s*0/)
    expect(body).toMatch(/height:\s*100dvh/)
    expect(body).toMatch(/z-index:\s*1200/)
  })

  it('never puts a safe-area inset on the UNGATED base rule', () => {
    // The teeth for the gating requirement. index.html ships viewport-fit=cover
    // to browsers too, so env() is non-zero in iOS Safari on the WEB build — a
    // bare env() here would fix the iOS app and silently change shipped web
    // rendering on every notched phone (the documented QA round-1 finding).
    expect(cssRule('.sr-map-fullscreen-panel')).not.toMatch(/env\(/)
  })

  it('pads the panel clear of the status bar and the sensor housing, .sr-ios-app-gated', () => {
    const body = cssRule('.sr-ios-app .sr-map-fullscreen-panel')
    expect(body).toMatch(/padding-top:\s*env\(safe-area-inset-top/)
    // Landscape, both rotations: the housing is on the left in one and the
    // right in the other, so a top-only inset would leave one of them exposed.
    expect(body).toMatch(/padding-left:\s*env\(safe-area-inset-left/)
    expect(body).toMatch(/padding-right:\s*env\(safe-area-inset-right/)
  })

  it('leaves the bottom edge alone (the FAB cluster owns it)', () => {
    // `.sr-ios-app .sr-map-fab-cluster` already adds env(safe-area-inset-bottom);
    // a padding-bottom here would double it and lift the controls off the
    // home indicator, and the map canvas is meant to bleed to the bottom edge.
    expect(cssRule('.sr-ios-app .sr-map-fullscreen-panel')).not.toMatch(/padding-bottom/)
  })

  it('does not double-inset the sidebar overlay in landscape', () => {
    // The overlay's left:0 already clears the housing once the panel is padded,
    // so its own padding-left (correct before the panel was padded) would now
    // double. See the .sr-map-content assertion below for why left:0 lands on
    // the padded edge rather than the physical viewport edge.
    expect(iosRule('.sr-map-sidebar-overlay')).not.toMatch(/padding-left:\s*env\(/)
  })

  it('keeps .sr-map-content positioned (it carries the inset down to the sidebar)', () => {
    // Load-bearing, and easy to mistake for dead CSS. An absolutely positioned
    // box resolves against its containing block's PADDING box, so the sidebar
    // overlay's left:0 would land back at the physical viewport edge if the
    // fixed panel were its containing block — and the padding-left removed
    // above would leave it UNDER-inset in landscape. It works only because
    // .sr-map-content is position:relative: an in-flow descendant the panel's
    // padding has already displaced inward, with no padding of its own. Drop
    // this declaration and the sidebar silently loses its landscape inset, so
    // it is asserted rather than left to a comment.
    expect(cssRule('.sr-map-content')).toMatch(/position:\s*relative/)
  })
})

describe('App.tsx fullscreen panel wiring', () => {
  it('applies the class on the mapFullscreen branch', () => {
    expect(mapPanelJsx()).toMatch(
      /mapFullscreen\s*(?:\/\/[^\n]*\s*)*\?[\s\S]{0,400}?['"`]sr-map-fullscreen-panel['"`]/,
    )
  })

  it('no longer positions the fullscreen panel with an inline style', () => {
    // The whole point of the lift: an inline `inset: 0` is specificity 1,0,0,
    // so the .sr-ios-app padding rule above could never take effect while any
    // of these stayed inline.
    const jsx = stripCommentLines(mapPanelJsx())
    expect(jsx).not.toMatch(/position:\s*['"`]fixed['"`]/)
    expect(jsx).not.toMatch(/inset:\s*0/)
    expect(jsx).not.toMatch(/zIndex:\s*1200/)
  })

  it('keeps the fullscreen backdrop color inline as a token', () => {
    // Colors stay inline per the lift-layout-only convention; dropping it would
    // leave the pill row's surface floating over whatever is behind the panel.
    expect(mapPanelJsx()).toMatch(/background:\s*['"`]var\(--sr-bg\)['"`]/)
  })
})
