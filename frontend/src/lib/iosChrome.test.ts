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
const helpDocs = readFileSync(
  fileURLToPath(new URL('../components/HelpDocs.tsx', import.meta.url)),
  'utf8',
)

function rule(selector: string): string {
  const re = new RegExp(selector.replace(/[.\\]/g, '\\$&') + String.raw`\s*\{([^}]*)\}`)
  const m = css.match(re)
  expect(m, `${selector} rule missing from globals.css`).toBeTruthy()
  return m![1]
}

// Every TOP-LEVEL rule in globals.css, keyed by its whitespace-normalized
// selector. Three things the loose `rule()` regex above cannot do, all of which
// the assertions below depend on:
//  1. EXACT selector keys, so `.sr-help-panel` and `.sr-ios-app .sr-help-panel`
//     are distinguishable. A substring regex matches the base selector inside
//     the gated one, which would make the "the base rule carries no env()"
//     assertion resolve to whichever happened to come first in the file.
//  2. At-rule blocks are skipped WHOLE, so a rule that gets DRY-consolidated
//     into the ≤640 phone tier disappears from this map and fails rather than
//     silently keeping the iPad (>640px) uncovered.
//  3. Comments are stripped first — globals.css has one comment containing a
//     brace, which would otherwise desynchronize the brace walk.
function parseTopLevelRules(src: string): Map<string, string> {
  const clean = src.replace(/\/\*[\s\S]*?\*\//g, '')
  const rules = new Map<string, string>()
  let i = 0
  let selStart = 0
  while (i < clean.length) {
    if (clean[i] !== '{') { i++; continue }
    let depth = 1
    let j = i + 1
    while (j < clean.length && depth > 0) {
      if (clean[j] === '{') depth++
      else if (clean[j] === '}') depth--
      j++
    }
    const selector = clean.slice(selStart, i).trim()
    if (!selector.startsWith('@')) {
      const body = clean.slice(i + 1, j - 1)
      for (const one of selector.split(',')) rules.set(one.trim().replace(/\s+/g, ' '), body)
    }
    i = j
    selStart = j
  }
  return rules
}

const topLevel = parseTopLevelRules(css)

function topLevelRule(selector: string): string {
  const body = topLevel.get(selector)
  expect(body, `${selector} rule missing from globals.css (top level, outside @media)`).toBeTruthy()
  return body!
}

// Drop whole-line `//` comments (never mid-line, so nothing containing `//` can
// be truncated). The negative assertions below search for the OLD inline
// declarations, and HelpDocs.tsx's own explanatory comment quotes `inset: 0`.
function stripCommentLines(src: string): string {
  return src.split('\n').filter(l => !l.trim().startsWith('//')).join('\n')
}

// The Help overlay's opening tag in HelpDocs.tsx (attributes + style), bounded by
// its own body so the assertions can't drift onto the header or the TOC below it.
function helpOverlayJsx(): string {
  const at = helpDocs.indexOf('id="sr-help-overlay"')
  expect(at, 'the Help overlay root was not found in HelpDocs.tsx').toBeGreaterThan(-1)
  const end = helpDocs.indexOf('{/* Header */}', at)
  expect(end, 'the Help overlay opening tag was not found in HelpDocs.tsx').toBeGreaterThan(at)
  return helpDocs.slice(at, end)
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

// ── The Help overlay's safe-area inset (helpdocs-safe-area) ─────────────────
// The bug: the Help overlay was position:fixed inset:0 INLINE, which is
// viewport-relative and so escapes `.sr-ios-app body`'s safe-area padding. Its
// first child is the 52px header row, whose book icon and "SnowRaven
// Documentation" title therefore rendered under the status bar and the Dynamic
// Island. Same mechanism as the map fullscreen panel, its own sibling rule.
describe('globals.css Help overlay panel positioning + iOS inset', () => {
  it('carries the positioning that used to be inline in HelpDocs.tsx', () => {
    const body = topLevelRule('.sr-help-panel')
    expect(body).toMatch(/position:\s*fixed/)
    expect(body).toMatch(/inset:\s*0/)
    expect(body).toMatch(/z-index:\s*1200/)
    // No height: unlike the map panel, the overlay has no inner column resolving
    // height:100% against it, so inset:0 alone sizes it. Asserted so a
    // copy-paste from the map rule doesn't quietly add one.
    expect(body).not.toMatch(/height:/)
  })

  it('never puts a safe-area inset on the UNGATED base rule', () => {
    // The teeth for the gating requirement. index.html ships viewport-fit=cover
    // to browsers too, so env() is non-zero in iOS Safari on the WEB build — a
    // bare env() here would fix the iOS app and silently change shipped web
    // rendering on every notched phone (the documented QA round-1 finding).
    expect(topLevelRule('.sr-help-panel')).not.toMatch(/env\(/)
  })

  it('pads the panel clear of the status bar and the sensor housing, .sr-ios-app-gated', () => {
    const body = topLevelRule('.sr-ios-app .sr-help-panel')
    expect(body).toMatch(/padding-top:\s*env\(safe-area-inset-top/)
    // Landscape, both rotations: the housing is on the left in one and the right
    // in the other, so a top-only inset would leave one of them exposed.
    expect(body).toMatch(/padding-left:\s*env\(safe-area-inset-left/)
    expect(body).toMatch(/padding-right:\s*env\(safe-area-inset-right/)
  })

  it('leaves the bottom edge alone (nothing is pinned there)', () => {
    // Mirrors `.sr-ios-app body` and the map panel, and checked against THIS
    // overlay's own chrome rather than assumed: there is no footer or
    // bottom-pinned control, the content column carries 80px of bottom padding
    // and the TOC nav 32px, both clearing the ~34px home indicator. A
    // padding-bottom would shrink the panel's content box, and since the body is
    // the flex:1 scrollport that means a dead band below the scrollbar.
    expect(topLevelRule('.sr-ios-app .sr-help-panel')).not.toMatch(/padding-bottom/)
  })
})

describe('globals.css Help TOC height cap', () => {
  it('caps the sticky TOC to the scrollport, with no env() on the base rule', () => {
    // Lifted from the inline style at the same value, so desktop and web are
    // unchanged; the env() belongs only on the gated rule, for the same
    // viewport-fit=cover reason as the panel above.
    const body = topLevelRule('.sr-help-toc')
    expect(body).toMatch(/max-height:\s*calc\(100vh\s*-\s*52px\)/)
    expect(body).not.toMatch(/env\(/)
  })

  it('subtracts the top safe-area inset from the cap on iOS', () => {
    // The secondary defect. On iOS the panel's content box is shorter by the top
    // inset, so the scrollport is too; a cap of only (100vh - 52px) over-extends
    // past it by exactly the inset and the nav's last entries become
    // unreachable above 640px (iPad, where the inset is typically 24px).
    expect(topLevelRule('.sr-ios-app .sr-help-toc')).toMatch(
      /max-height:\s*calc\(100vh\s*-\s*52px\s*-\s*env\(safe-area-inset-top/,
    )
  })

  it('still drops the cap entirely on the ≤640 phone tier', () => {
    // Where the nav stacks static above the content and scrolls with it. This
    // one lives INSIDE the media block, so it is read from the raw stylesheet.
    expect(css).toMatch(/\.sr-help-toc\s*\{[^}]*max-height:\s*none\s*!important/)
  })
})

describe('HelpDocs.tsx wiring', () => {
  it('applies the panel class on the overlay root', () => {
    expect(helpOverlayJsx()).toMatch(/className="sr-help-panel"/)
  })

  it('no longer positions the overlay with an inline style', () => {
    // The whole point of the lift: an inline `inset: 0` is specificity 1,0,0, so
    // the .sr-ios-app padding rule could never take effect while these stayed
    // inline — no stylesheet can reach `top` out of an inline `inset: 0`.
    const jsx = stripCommentLines(helpOverlayJsx())
    expect(jsx).not.toMatch(/position:\s*['"`]fixed['"`]/)
    expect(jsx).not.toMatch(/inset:\s*0/)
    expect(jsx).not.toMatch(/zIndex:\s*1200/)
  })

  it('no longer caps the TOC with an inline max-height', () => {
    // Same specificity trap one level down: an inline maxHeight would beat both
    // the base cap and the .sr-ios-app one, so the iPad over-extension would
    // survive the fix silently.
    expect(stripCommentLines(helpDocs)).not.toMatch(/maxHeight:\s*['"`]calc\(100vh/)
  })

  it('keeps the overlay background inline as a token', () => {
    // Colors stay inline per the lift-layout-only convention; dropping it would
    // leave the documentation floating over whatever is behind the overlay.
    expect(helpOverlayJsx()).toMatch(/background:\s*['"`]var\(--sr-surface\)['"`]/)
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
    // "Self-hosted birding…" must be adjacent, so this can't pass vacuously off
    // some OTHER element gaining the {!compactChrome() && ( pattern while the
    // tagline goes unconditional.
    // (bounded window, not [^)]*: the <p>'s inline style contains var(--…) parens)
    expect(app).toMatch(/\{!compactChrome\(\) && \([\s\S]{0,300}?Self-hosted birding tools and data explorer/)
    // And the tagline never renders outside that guard (exactly one occurrence
    // of the copy, the guarded one).
    expect(app.match(/Self-hosted birding tools and data explorer/g)).toHaveLength(1)
  })
})
