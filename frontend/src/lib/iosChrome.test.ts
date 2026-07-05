/// <reference types="node" />
// The iOS compact-chrome composition fixes (preview-driven, user-requested at
// the live simulator preview — pipeline/mobile-app/decisions.md):
//  1. `.sr-header.sr-header-compact` — the brand header collapses to a slim
//     bar; the padding must be !important (it has to beat BOTH the inline base
//     padding and the ≤640 tier's own !important padding-top).
//  2. `.sr-map-explorer-panel.sr-map-panel-ios` — the map panel sizes to the
//     visible viewport (dvh minus chrome minus the safe-area top inset) so the
//     map + FAB cluster are above the fold on tab open; keeps a min-height.
//  3. App.tsx wires BOTH classes through the compactChrome() seam only —
//     desktop/web never carry them.
// Stylesheet read via fs (vitest stubs CSS ?raw) — the milestoneContrast pattern.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const css = readFileSync(fileURLToPath(new URL('../globals.css', import.meta.url)), 'utf8')
const app = readFileSync(fileURLToPath(new URL('../App.tsx', import.meta.url)), 'utf8')

function rule(selector: string): string {
  const re = new RegExp(selector.replace(/[.\\]/g, '\\$&') + String.raw`\s*\{([^}]*)\}`)
  const m = css.match(re)
  expect(m, `${selector} rule missing from globals.css`).toBeTruthy()
  return m![1]
}

describe('globals.css iOS compact chrome', () => {
  it('compact header padding is slim and !important (beats inline + the ≤640 !important tier)', () => {
    const body = rule('.sr-header.sr-header-compact')
    expect(body).toMatch(/padding:[^;]*!important/)
    // Slim: the top padding must be single-digit px, not the 48/24px brand spacing.
    expect(body).toMatch(/padding:\s*[0-9]px/)
  })

  it('iOS map panel sizes to the visible viewport with the safe-area top inset', () => {
    const body = rule('.sr-map-explorer-panel.sr-map-panel-ios')
    expect(body).toMatch(/height:\s*calc\(100dvh/)
    expect(body).toMatch(/env\(safe-area-inset-top/)
    expect(body).toMatch(/min-height:/)
  })
})

describe('App.tsx wiring', () => {
  it('the compact header class rides the compactChrome() seam', () => {
    expect(app).toMatch(/compactChrome\(\)\s*\?\s*'sr-header sr-header-compact'\s*:\s*'sr-header'/)
  })

  it('the iOS map-panel class rides the compactChrome() seam', () => {
    // Positive structural teeth (like the header guard above): the class pair
    // must appear as the compactChrome() ternary's iOS arm (allowing // comment
    // lines between the ? and the string, as the source has today).
    expect(app).toMatch(
      /compactChrome\(\)\s*\?\s*(?:\/\/[^\n]*\s*)*['"`]sr-map-explorer-panel sr-map-panel-ios['"`]/,
    )
    // and never unconditionally — in ANY quote style (single, double, or a
    // template literal; App.tsx's own style is single quotes, so a
    // double-quote-only guard would let the named regression through).
    expect(app).not.toMatch(
      /className=\{?\s*['"`]sr-map-explorer-panel sr-map-panel-ios['"`]/,
    )
  })

  it('the tagline renders only outside compact chrome', () => {
    // Anchored to the tagline's own content: the guard and the <p> holding
    // "Birding tools…" must be adjacent, so this can't pass vacuously off some
    // OTHER element gaining the {!compactChrome() && ( pattern while the
    // tagline goes unconditional.
    // (bounded window, not [^)]*: the <p>'s inline style contains var(--…) parens)
    expect(app).toMatch(/\{!compactChrome\(\) && \([\s\S]{0,300}?Birding tools for your eBird workflow/)
    // And the tagline never renders outside that guard (exactly one occurrence
    // of the copy, the guarded one).
    expect(app.match(/Birding tools for your eBird workflow/g)).toHaveLength(1)
  })
})
