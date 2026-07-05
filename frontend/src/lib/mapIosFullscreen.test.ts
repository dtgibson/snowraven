/// <reference types="node" />
// The iOS map-fullscreen composition rule (mobile-app design review, user-
// approved): on iOS builds, fullscreen hides the sidebar at ANY width and the
// Filters FAB appears. Guarded at both halves:
//  1. mapContentClass — the seam-driven class decision (pure).
//  2. globals.css — the .sr-map-ios-fullscreen rules must mirror the ≤640
//     phone-tier block (parse-the-stylesheet pattern, like milestoneContrast).
//  3. MapExplorer.tsx — the class must be wired through isIOS(), so a
//     refactor can't silently turn it on for desktop fullscreen.
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
