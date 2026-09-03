/// <reference types="node" />
//
// feature: map-fullscreen-toggle — the stylesheet invariants the embedded maps'
// fullscreen overlay depends on.
//
// Reads the REAL globals.css off disk (vitest stubs CSS `?raw`), the same
// posture as mapFabClusterCss / mapIosFullscreen / iosChrome.
//
// WHAT THIS PROVES: that the declarations exist, at TOP LEVEL (not stranded
// inside a media tier, so they hold at every width), on the right selectors,
// with the right values; that the phone-tier height override is scoped so it
// cannot out-order the expanded panel; that the safe-area inset is gated on
// .sr-ios-app and touches only the three edges it is allowed to; and that no
// `order` property arranges the corner row.
//
// WHAT IT CANNOT PROVE, and is explicitly NOT evidence for (CLAUDE.md, v0.5.82):
// that any of it WORKS. A stylesheet test passes on an inert class. Whether the
// panel's rect equals the viewport rect on each of the three surfaces, whether
// the row fits 320px at 200% text scale, whether the canvas fills the container
// after a resize, and whether `position: fixed` resolves against the viewport
// rather than a transformed ancestor are BROWSER measurements and belong to the
// Tester.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { findUngatedSafeAreaRules, parseTopLevelRules } from './cssTopLevelRules'
import { MAP_FS_PANEL_CLASS, mapFullscreenClass } from './useMapFullscreen'

const CSS = readFileSync(fileURLToPath(new URL('../globals.css', import.meta.url)), 'utf8')
const TOP = parseTopLevelRules(CSS)

/** A declaration's value, or undefined. `{` is in the leading boundary set so a
 *  single-line rule passed in whole is not invisible to it (the mutation-found
 *  hole in mapFabClusterCss's own helper). */
const decl = (body: string, prop: string) =>
  body.match(new RegExp(`(?:^|[;{]|\\n)\\s*${prop}\\s*:\\s*([^;}]+)`))?.[1].trim()

/** Body of a top-level rule, by EXACT selector. Never `String.includes`: that
 *  would read `.sr-map-fs-panel` out of `.sr-ios-app .sr-map-fs-panel`, and the
 *  gating assertions below exist precisely to tell those two apart. */
function rule(selector: string): string {
  const body = TOP.get(selector)
  expect(body, `${selector} missing from globals.css (top-level, outside @media)`).toBeTruthy()
  return body!
}

/** Every `@media (max-width: N px)` block in the file, concatenated, with
 *  comments stripped. ALL of them, not the first: globals.css carries two ≤640
 *  blocks.
 *
 *  Comments must go, and this is the second instance of the entryChunk.test.ts
 *  lesson in this repo: the phone-tier rule carries a comment NAMING the two
 *  other container classes as ones that would owe the same `:not()` guard, and a
 *  scan for "is there an unscoped height rule for those classes" matched the
 *  prose and ran forward to the next real `{`. The file's own explanation of the
 *  thing it does NOT contain reported it as present. */
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
  expect(parts.length).toBeGreaterThan(0)
  return parts.join('\n').replace(/\/\*[\s\S]*?\*\//g, '')
}

// ── The expanded panel (FR-08, FR-25, OQ-07, QA-09, QA-31) ───────────────────

describe('.sr-map-fs-panel', () => {
  it('is a TOP-LEVEL rule, so the expanded state holds at every viewport width', () => {
    // The same any-width guarantee mapIosFullscreen asserts for the Map
    // Explorer's panel. A DRY consolidation into the phone tier would strand
    // fullscreen on every width above 640 — the desktop app, the iPad, the web
    // build at a normal window size, which is to say almost everywhere.
    expect(CSS).toContain('.sr-map-fs-panel')
    expect(TOP.get('.sr-map-fs-panel')).toBeTruthy()
  })

  it('carries the shipped fullscreen geometry, byte-identical to the Map Explorer panel', () => {
    // ONE fullscreen geometry in the app, not two. Compared against the shipped
    // rule rather than against four retyped literals, so the two cannot drift.
    const panel = rule('.sr-map-fs-panel')
    const shipped = rule('.sr-map-fullscreen-panel')
    for (const prop of ['position', 'inset', 'height', 'z-index']) {
      expect(decl(panel, prop), prop).toBe(decl(shipped, prop))
    }
    // ...and the values really are the ones the feature specifies, so a shared
    // regression in BOTH rules cannot pass the equality above.
    expect(decl(panel, 'position')).toBe('fixed')
    expect(decl(panel, 'inset')).toBe('0')
    expect(decl(panel, 'height')).toBe('100dvh')
    expect(decl(panel, 'z-index')).toBe('1200')
  })

  it('paints an opaque token ground and drops the border and radius, keeping the clip', () => {
    const panel = rule('.sr-map-fs-panel')
    // FR-25: the surface behind an EMBEDDED map's overlay is a live page. It has
    // to be opaque from frame one, which is also why the panel does not fade in.
    expect(decl(panel, 'background')).toBe('var(--sr-bg)')
    // OQ-07: rounded corners at full window show the page ground in four corners.
    expect(decl(panel, 'border')).toBe('none')
    expect(decl(panel, 'border-radius')).toBe('0')
    expect(decl(panel, 'overflow')).toBe('hidden')
  })

  it('uses a token for the ground, never a hardcoded colour', () => {
    const panel = rule('.sr-map-fs-panel')
    expect(panel).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
    expect(panel).not.toMatch(/\brgba?\(/)
  })

  it('sits BELOW all three container rules, which is what lets it win on height', () => {
    // All four are one class deep, so only SOURCE ORDER decides. This is not
    // tidiness: put the panel above .sr-map-container and the expanded Species
    // Detail map renders 380px tall with everything else about it correct.
    const order = [...TOP.keys()]
    const at = (s: string) => {
      const i = order.indexOf(s)
      expect(i, `${s} must be a top-level rule`).toBeGreaterThanOrEqual(0)
      return i
    }
    for (const base of ['.sr-map-container', '.sr-named-map', '.sr-geo-map']) {
      expect(at('.sr-map-fs-panel'), `${base} must precede the panel`).toBeGreaterThan(at(base))
    }
  })
})

// ── The two container lifts (D-09, FR-08) ────────────────────────────────────

describe('the container rules an inline style used to own', () => {
  it('.sr-named-map carries its border, radius and clip in the stylesheet', () => {
    // They were inline in NamedBirdRow.tsx. An inline declaration is specificity
    // 1,0,0, so .sr-map-fs-panel could never have dropped them.
    const named = rule('.sr-named-map')
    expect(decl(named, 'height')).toBe('220px')
    expect(decl(named, 'border')).toBe('1px solid var(--sr-border)')
    expect(decl(named, 'border-radius')).toBe('10px')
    expect(decl(named, 'overflow')).toBe('hidden')
  })

  it('.sr-geo-map exists at all, with the whole box the inline style used to carry', () => {
    // The Statistics map box had NO class before this feature. An inline
    // `height: 320px` can never be beaten by `height: 100dvh` from a class.
    const geo = rule('.sr-geo-map')
    expect(decl(geo, 'height')).toBe('320px')
    expect(decl(geo, 'border')).toBe('1px solid var(--sr-border)')
    expect(decl(geo, 'border-radius')).toBe('8px')
    expect(decl(geo, 'overflow')).toBe('hidden')
  })

  it('neither container rule hardcodes a colour', () => {
    for (const sel of ['.sr-named-map', '.sr-geo-map']) {
      expect(rule(sel), sel).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
      expect(rule(sel), sel).not.toMatch(/\brgba?\(/)
    }
  })
})

// ── The phone-tier specificity trap (the design pass's first finding) ────────

describe('the ≤640 height override cannot out-order the expanded panel', () => {
  it('scopes the phone-tier .sr-map-container height :not(.sr-map-fs-panel)', () => {
    // THE TRAP. Both rules are one class deep and the media block sits at the END
    // of the file, so an unscoped `.sr-map-container { height: 300px }` wins on
    // source order and the EXPANDED map is 300px tall at phone width: the
    // feature silently broken on the tier that needs it most, with every other
    // declaration correct and nothing failing.
    const phone = mediaTier(640)
    expect(phone).toMatch(/\.sr-map-container:not\(\.sr-map-fs-panel\)\s*\{[^}]*height:\s*300px/)
  })

  it('leaves no UNSCOPED .sr-map-container height in the phone tier', () => {
    // The positive above would still pass if a second, unscoped copy sat beside
    // it — and being later in the block, the copy would win.
    const phone = mediaTier(640)
    expect(phone).not.toMatch(/(^|[,}{])\s*\.sr-map-container\s*\{[^}]*height/)
  })

  it('the other two containers have no phone-tier height to guard yet', () => {
    // Non-vacuity for the note left on those rules: if one ever gains an
    // override, this goes red and the `:not()` guard has to travel with it.
    const phone = mediaTier(640)
    expect(phone).not.toMatch(/\.sr-named-map[^{]*\{[^}]*height/)
    expect(phone).not.toMatch(/\.sr-geo-map[^{]*\{[^}]*height/)
  })
})

// ── The corner row (FR-03, QA-05) ────────────────────────────────────────────

describe('.sr-map-corner-row', () => {
  it('takes the share corner anchors and the FAB cluster flex block, at top level', () => {
    const row = rule('.sr-map-corner-row')
    const corner = rule('.sr-share-corner')
    const cluster = rule('.sr-map-fab-cluster')
    // Anchors from the shipped single-control corner it replaces...
    for (const prop of ['position', 'bottom', 'right', 'z-index']) {
      expect(decl(row, prop), prop).toBe(decl(corner, prop))
    }
    // ...layout from the shipped multi-control cluster, whose own comment records
    // that flex-wrap + justify-content + max-width are what keep a row from
    // overflowing LEFT off the map, where page scrollWidth reads clean.
    for (const prop of ['display', 'align-items', 'gap', 'flex-wrap', 'justify-content', 'row-gap']) {
      expect(decl(row, prop), prop).toBe(decl(cluster, prop))
    }
    expect(decl(row, 'max-width')).toBe('calc(100% - 32px)')
  })

  it('is click-through, with pointer events restored on the buttons', () => {
    // NEW work here rather than inherited boilerplate: with ONE disc there is no
    // gap, and with two the 10px between them would be a dead strip swallowing a
    // map drag.
    expect(decl(rule('.sr-map-corner-row'), 'pointer-events')).toBe('none')
    expect(decl(rule('.sr-map-corner-row button'), 'pointer-events')).toBe('auto')
    // Scoped to `button`, not `> *`, so the slot stays click-through.
    expect(TOP.get('.sr-map-corner-row > *')).toBeUndefined()
  })

  it('gives the compact tier tighter anchors and a matching narrower cap', () => {
    const compact = rule('.sr-map-corner-row--compact')
    expect(decl(compact, 'bottom')).toBe('12px')
    expect(decl(compact, 'right')).toBe('12px')
    // 2x its own 12px inset, matching the base row's 2x16px.
    expect(decl(compact, 'max-width')).toBe('calc(100% - 24px)')
  })

  it('declares the compact modifier AFTER the base row, or the anchors never apply', () => {
    const order = [...TOP.keys()]
    expect(order.indexOf('.sr-map-corner-row--compact'))
      .toBeGreaterThan(order.indexOf('.sr-map-corner-row'))
  })

  it('keeps the display:contents slot the row relies on for DOM-equals-visual order', () => {
    expect(decl(rule('.sr-map-fab-slot'), 'display')).toBe('contents')
  })

  it('sets no `order` on the row or anything in it (WCAG 2.4.3)', () => {
    // `order` moves a box visually while leaving DOM order unchanged, which
    // desynchronizes tab order from reading order. The share button reaches the
    // row's first position through a display:contents slot for exactly this
    // reason.
    for (const [selector, body] of TOP) {
      if (!/sr-map-corner-row|sr-map-fab-slot|sr-map-fullscreen-btn|sr-share-drop-btn/.test(selector)) continue
      expect(decl(body, 'order'), `${selector} must not set \`order\``).toBeUndefined()
    }
    expect(/\.sr-map-corner-row[^{]*\{[^}]*\border\s*:/.test(CSS)).toBe(false)
  })

  it('adds no rule to .sr-map-fullscreen-btn, which stays a state hook only', () => {
    // The circle, the glyph size and the phone posture all come from
    // .sr-map-fab + a size modifier. A rule here would be the fourth
    // hand-duplicated copy the uniform-map-fabs extraction removed.
    expect(TOP.get('.sr-map-fullscreen-btn')).toBeUndefined()
    expect(/\.sr-map-fullscreen-btn\s*\{/.test(mediaTier(640))).toBe(false)
  })
})

// ── Motion (NFR-06) ──────────────────────────────────────────────────────────

describe('the corner row entrance', () => {
  it('animates only inside the expanded panel, entrance only, on the app ease-out', () => {
    const anim = decl(rule('.sr-map-fs-panel .sr-map-corner-row'), 'animation')
    expect(anim).toContain('sr-map-corner-in')
    expect(anim).toContain('150ms')
    // The app's own ease-out, already carried by .sr-map-fab and the share pin's
    // plant. No new easing is minted.
    expect(anim).toContain('cubic-bezier(0.16, 1, 0.3, 1)')
    // No matching rule outside the panel: collapsing is instant, because
    // animating an in-flow box back into place fades the page in behind it.
    expect(TOP.get('.sr-map-corner-row')).not.toMatch(/animation\s*:/)
  })

  it('the keyframe ends at its RESTING state, which is what makes the global reduced-motion rule enough', () => {
    const kf = CSS.match(/@keyframes\s+sr-map-corner-in\s*\{([\s\S]*?)\n\}/)?.[1]
    expect(kf, '@keyframes sr-map-corner-in missing').toBeTruthy()
    expect(kf).toMatch(/to\s*\{[^}]*opacity:\s*1/)
    expect(kf).toMatch(/to\s*\{[^}]*transform:\s*none/)
    // No per-component prefers-reduced-motion query: globals.css already carries
    // the app-wide `animation-duration: 0.001ms !important` block, and an
    // !important author rule beats everything here. Adding one would deviate from
    // every other animated surface in this app.
    expect(CSS).toMatch(/@media \(prefers-reduced-motion: reduce\)[\s\S]*?animation-duration:\s*0\.001ms\s*!important/)
    expect(/sr-map-corner-in[\s\S]{0,400}prefers-reduced-motion/.test(CSS)).toBe(false)
  })

  it('puts the transform on a DESCENDANT of the fixed panel, never on the panel itself', () => {
    // A transform on the panel would create a containing block and make
    // `position: fixed` resolve against it instead of the viewport, which is the
    // one thing this whole overlay depends on.
    expect(rule('.sr-map-fs-panel')).not.toMatch(/transform\s*:/)
    expect(rule('.sr-map-fs-panel')).not.toMatch(/\b(filter|backdrop-filter|perspective|contain|will-change)\s*:/)
  })
})

// ── iOS safe areas (FR-22, QA-28) ────────────────────────────────────────────

describe('iOS safe-area handling', () => {
  it('never puts a safe-area inset on an UNGATED rule for either new surface', () => {
    // The teeth. index.html ships viewport-fit=cover to browsers too, so env() is
    // non-zero in iOS Safari on the WEB build: a bare env() here would fix the
    // iOS app and silently change shipped web rendering on every notched phone.
    expect(findUngatedSafeAreaRules(CSS, MAP_FS_PANEL_CLASS)).toEqual([])
    expect(findUngatedSafeAreaRules(CSS, 'sr-map-corner-row')).toEqual([])
  })

  it('pads the panel clear of the status bar and the sensor housing, .sr-ios-app-gated', () => {
    const body = rule('.sr-ios-app .sr-map-fs-panel')
    expect(body).toMatch(/padding-top:\s*env\(safe-area-inset-top/)
    // Both rotations: the housing is on the left in one and the right in the other.
    expect(body).toMatch(/padding-left:\s*env\(safe-area-inset-left/)
    expect(body).toMatch(/padding-right:\s*env\(safe-area-inset-right/)
  })

  it('leaves the panel bottom alone, so the canvas bleeds to the home indicator', () => {
    expect(rule('.sr-ios-app .sr-map-fs-panel')).not.toMatch(/padding-bottom/)
  })

  it('insets the corner row bottom instead, gated on iOS AND on the expanded class', () => {
    // The panel's top/left/right padding reaches the base switcher and the zoom
    // stack for free, because the map fills the padded content box. It does not
    // reach this row, which is positioned against the map, so the row insets its
    // own bottom.
    const std = rule('.sr-ios-app .sr-map-fs-panel .sr-map-corner-row')
    const compact = rule('.sr-ios-app .sr-map-fs-panel .sr-map-corner-row--compact')
    expect(decl(std, 'bottom')).toBe('calc(20px + env(safe-area-inset-bottom, 0px))')
    expect(decl(compact, 'bottom')).toBe('calc(12px + env(safe-area-inset-bottom, 0px))')
    // Each keeps the collapsed anchor it insets from, so the two agree.
    expect(decl(std, 'bottom')).toContain(decl(rule('.sr-map-corner-row'), 'bottom')!)
    expect(decl(compact, 'bottom')).toContain(decl(rule('.sr-map-corner-row--compact'), 'bottom')!)
  })

  it('does NOT re-inset the row on the right, and does not inset it while collapsed', () => {
    // The panel's own padding-right already moved that edge; double-insetting is
    // the failure the shipped panel's comment warns about. And a bottom inset on
    // the collapsed map would push two discs up into a 220px card for nothing.
    expect(rule('.sr-ios-app .sr-map-fs-panel .sr-map-corner-row')).not.toMatch(/right\s*:/)
    expect(TOP.get('.sr-ios-app .sr-map-corner-row')).toBeUndefined()
  })
})

// ── The pure class-composition helper ────────────────────────────────────────

describe('mapFullscreenClass', () => {
  it('composes the shared panel class onto whichever base the host owns', () => {
    expect(mapFullscreenClass('sr-map-container', false)).toBe('sr-map-container')
    expect(mapFullscreenClass('sr-map-container', true)).toBe('sr-map-container sr-map-fs-panel')
    expect(mapFullscreenClass('sr-named-map', true)).toBe('sr-named-map sr-map-fs-panel')
    expect(mapFullscreenClass('sr-geo-map', true)).toBe('sr-geo-map sr-map-fs-panel')
  })

  it('names a class the stylesheet actually defines', () => {
    expect(TOP.get(`.${MAP_FS_PANEL_CLASS}`)).toBeTruthy()
  })
})
