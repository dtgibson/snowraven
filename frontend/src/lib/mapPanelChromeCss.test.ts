/// <reference types="node" />
//
// The Map Explorer panel's height rule, after the chrome budget stopped being a
// constant.
//
// Reads the REAL globals.css off disk (vitest stubs CSS `?raw`), the same posture
// as milestoneContrast / countyContrast / calendarContrast / mapFabClusterCss.
// The node types live only in tsconfig.node, so the reference above stays
// file-scoped.
//
// WHAT THIS PROVES: that all three height rules consume `--sr-map-chrome`, that
// each keeps its old constant as the fallback (so a pass before the measurement
// exists is byte-identical to the shipped behaviour), that the base rule is
// top-level and the phone rule is in the ≤640 tier, that the ungated rules carry
// no bare `env()`, that the min-height floor survives on both panel rules, and
// that the fullscreen panel does NOT consume the variable.
//
// WHAT IT CANNOT PROVE, and is explicitly NOT evidence for (CLAUDE.md, v0.5.82):
// that any of it works. A stylesheet test passes on an inert class — that is how
// an inert `.sr-wrap-flex` shipped, and it is doubly true here, because the
// declarations below are only half the mechanism: nothing in this file can tell
// whether `--sr-map-chrome` is ever WRITTEN, whether it is written with the right
// number, or whether the page then fits its viewport. The arithmetic half is
// mapPanelChrome.test.ts; the geometry is a browser A/B across three builds, two
// engines, five widths and four text scales, written up in the PR description.
//
// Selectors are compared EXACTLY through the shared parser, never with
// `String.includes`: `.sr-map-explorer-panel` is a substring of
// `.sr-map-explorer-panel.sr-map-panel-ios`, so a substring probe would resolve
// the "the ungated rule carries no env()" assertion to whichever came first in
// the file and could pass while testing the wrong rule.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { parseTopLevelRules } from './cssTopLevelRules'

const CSS = readFileSync(fileURLToPath(new URL('../globals.css', import.meta.url)), 'utf8')
const TOP = parseTopLevelRules(CSS)

/** A declaration's value, or undefined. `{` is in the leading boundary set so a
 *  whole single-line rule passed in as text is matched too (mapFabClusterCss). */
const decl = (body: string, prop: string) =>
  body.match(new RegExp(`(?:^|[;{]|\\n)\\s*${prop}\\s*:\\s*([^;}]+)`))?.[1].trim()

/**
 * Every `@media (max-width: N px)` block in the file, concatenated.
 *
 * A local walker, not the shared parser: `parseTopLevelRules` skips at-rule
 * blocks WHOLE by design, which is exactly what makes it the right tool for the
 * "applies at every width" question and structurally unable to answer the "is
 * this rule inside the phone tier" one (CLAUDE.md's per-QUESTION carve-out).
 *
 * ALL blocks, not the first: globals.css carries two ≤640 blocks — the one-line
 * `.sr-map-explorer-panel` rule here and the main phone tier ~1000 lines later.
 */
function mediaTier(maxWidth: number): string {
  const marker = `@media (max-width: ${maxWidth}px)`
  const parts: string[] = []
  let from = 0
  for (;;) {
    const start = CSS.indexOf(marker, from)
    if (start === -1) break
    const open = CSS.indexOf('{', start)
    let depth = 1
    let i = open + 1
    while (i < CSS.length && depth > 0) {
      if (CSS[i] === '{') depth++
      else if (CSS[i] === '}') depth--
      i++
    }
    parts.push(CSS.slice(open + 1, i - 1))
    from = i
  }
  expect(parts.length, `no ${marker} block in globals.css`).toBeGreaterThan(0)
  return parts.join('\n')
}

/** The body of one exactly-matched rule inside a concatenated tier. */
function tierRule(tier: string, selector: string): string | undefined {
  // Split on rule boundaries and compare the selector exactly, for the same
  // reason the shared parser does: `.sr-map-explorer-panel` is a prefix of the
  // iOS double-class selector.
  for (const m of tier.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const sels = m[1].split(',').map(x => x.trim().replace(/\s+/g, ' '))
    if (sels.includes(selector)) return m[2]
  }
  return undefined
}

const BASE = '.sr-map-explorer-panel'
const IOS = '.sr-map-explorer-panel.sr-map-panel-ios'
const FULLSCREEN = '.sr-map-fullscreen-panel'

describe('the panel height reads the MEASURED chrome, at every width', () => {
  it('the base rule is top-level, so it holds above the phone tier too', () => {
    expect(TOP.get(BASE), `${BASE} must be a top-level rule`).toBeTruthy()
  })

  it('subtracts the variable, not a number', () => {
    const h = decl(TOP.get(BASE)!, 'height')!
    expect(h).toContain('var(--sr-map-chrome')
    // The whole point: no bare constant may remain as the operand.
    expect(h).toBe('calc(100dvh - var(--sr-map-chrome, 178px))')
  })

  it('keeps the old constant as the FALLBACK, so first paint is unchanged', () => {
    // A `var()` with no fallback computes to an invalid `calc(100dvh - )` before
    // the measurement lands, which drops the height declaration entirely and
    // gives the panel an auto height — a visibly collapsed map on the first
    // frame. The fallback is what makes the pre-measurement pass identical to
    // the behaviour this replaced, rather than merely close to it.
    expect(decl(TOP.get(BASE)!, 'height')).toContain('178px')
    expect(tierRule(mediaTier(640), BASE)).toBeTruthy()
    expect(decl(tierRule(mediaTier(640), BASE)!, 'height')).toBe('calc(100dvh - var(--sr-map-chrome, 132px))')
  })

  it('keeps the min-height floor, which is where an over-large chrome is caught', () => {
    // The measurement deliberately has no upper clamp of its own: at 200% text
    // scale on a short landscape phone the chrome legitimately exceeds the
    // viewport, and the honest answer there is a floored panel with the page
    // scrolling. That floor is here, and only here.
    expect(decl(TOP.get(BASE)!, 'min-height')).toBe('340px')
    expect(decl(TOP.get(IOS)!, 'min-height')).toBe('300px')
  })
})

describe('the iOS safe-area gate is untouched by the measurement', () => {
  it('the iOS rule reads the variable and keeps env() only in its fallback', () => {
    const h = decl(TOP.get(IOS)!, 'height')!
    expect(h).toBe('calc(100dvh - var(--sr-map-chrome, calc(112px + env(safe-area-inset-top, 0px))))')
    // The measured value already contains the inset (it spans the document's top
    // to <main>, and `.sr-ios-app body`'s padding-top is inside that span), so
    // adding env() OUTSIDE the fallback would subtract it twice.
    expect(h.indexOf('env(')).toBeGreaterThan(h.indexOf('var(--sr-map-chrome'))
  })

  it('neither ungated rule carries a bare env()', () => {
    // index.html ships viewport-fit=cover to browsers too, so a bare env() in an
    // ungated rule changes shipped web rendering on every notched phone. The iOS
    // rule above is gated by `.sr-map-panel-ios`, which App applies only when
    // compactChrome() is true.
    expect(decl(TOP.get(BASE)!, 'height')).not.toContain('env(')
    expect(tierRule(mediaTier(640), BASE)).not.toContain('env(')
  })
})

describe('fullscreen is not on this mechanism at all', () => {
  it('the fullscreen panel keeps a plain 100dvh and never reads the variable', () => {
    const fs = TOP.get(FULLSCREEN)
    expect(fs, `${FULLSCREEN} must be a top-level rule`).toBeTruthy()
    expect(decl(fs!, 'height')).toBe('100dvh')
    expect(fs!).not.toContain('--sr-map-chrome')
    // Its positioning is what makes the chrome irrelevant to it; if any of these
    // moved, the panel would stop being viewport-filling and the variable's
    // absence would start to matter.
    expect(decl(fs!, 'position')).toBe('fixed')
    expect(decl(fs!, 'inset')).toBe('0')
  })

  it('no other rule in the stylesheet consumes the variable', () => {
    // One consumer, three rules, all of them the panel. A second consumer would
    // mean the value had quietly become a general layout token, measured for a
    // box it was never measured against.
    const consumers = [...TOP].filter(([, body]) => body.includes('--sr-map-chrome')).map(([sel]) => sel)
    expect(consumers.sort()).toEqual([BASE, IOS].sort())
    const tier = mediaTier(640)
    const tierConsumers = [...tier.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
      .filter(m => m[2].includes('--sr-map-chrome'))
      .flatMap(m => m[1].split(',').map(x => x.trim().replace(/\s+/g, ' ')))
    expect(tierConsumers).toEqual([BASE])
  })
})
