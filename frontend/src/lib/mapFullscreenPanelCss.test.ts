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
import { FS_OPEN_ATTR, MAP_FS_PANEL_CLASS, MAP_STILL_CLASS, mapFullscreenClass } from './useMapFullscreen'
import { compoundsOf, specificity, splitList } from '../test/cssSpecificity'
import { LIST_FIT_VAR } from './useListFit'

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
    // The ONE exception, map-scroll-on-phones D-10: on the phone tier, inside an
    // EXPANDED embedded panel only, the exit becomes the "Exit" pill. It is not a
    // circle definition: it reshapes the disc .sr-map-fab already draws, and it
    // cannot reach the Map Explorer's toggle (`.sr-map-fullscreen-panel`).
    const phone = mediaTier(640)
    const hits = [...phone.matchAll(/([^{}]*\.sr-map-fullscreen-btn[^{}]*)\{([^}]*)\}/g)]
    expect(hits.map(m => m[1].trim())).toEqual(['.sr-map-fs-panel .sr-map-fullscreen-btn'])
    const props = hits[0][2].split(';').map(d => d.split(':')[0].trim()).filter(Boolean).sort()
    expect(props).toEqual(['gap', 'min-width', 'padding', 'width'])
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


// ── map-scroll-on-phones: the still, the exit, the bar and the lists ─────────
//
// A RESOLVED CASCADE, not a declaration's presence (testing.md v1.0.33): each
// row below asks "which value wins on this element", over every rule at top
// level and in the phone tier, scored by the shared specificity helper and broken
// by source order. What this resolver does NOT check, said so it is not
// over-read: it admits a selector when every class in each compound is on the
// element (rightmost compound) or somewhere on its ancestor chain (the others),
// so it does not distinguish a child from a descendant combinator, and it reads
// `:not(.x)` only as "the element does not carry .x". Whether the rules work in
// an engine is the Tester's real-browser reading.

interface FlatRule { selector: string; body: string; tier: 'top' | 'phone'; order: number }

function flatRules(): FlatRule[] {
  const src = CSS.replace(/\/\*[\s\S]*?\*\//g, m => ' '.repeat(m.length))
  const out: FlatRule[] = []
  let order = 0
  const walk = (text: string, tier: FlatRule['tier'] | null) => {
    let i = 0
    let start = 0
    while (i < text.length) {
      if (text[i] === ';' ) { i++; start = i; continue }
      if (text[i] !== '{') { i++; continue }
      let depth = 1
      let end = i + 1
      while (end < text.length && depth) { if (text[end] === '{') depth++; else if (text[end] === '}') depth--; end++ }
      const prelude = text.slice(start, i).trim().replace(/\s+/g, ' ')
      const body = text.slice(i + 1, end - 1)
      if (prelude.startsWith('@')) {
        if (tier === 'top' && /^@media \(max-width: ?640px\)$/.test(prelude)) walk(body, 'phone')
      } else if (tier) {
        for (const one of splitList(prelude)) out.push({ selector: one, body, tier, order: order++ })
      }
      i = end
      start = end
    }
  }
  walk(src, 'top')
  return out
}
const FLAT = flatRules()

const classesIn = (compound: string) => [...compound.matchAll(/(?<!:not\()\.([-\w]+)/g)].map(m => m[1])
const notClassesIn = (compound: string) => [...compound.matchAll(/:not\(\.([-\w]+)\)/g)].map(m => m[1])

/** Whether `selector` can match an element with `own` classes under `ancestors`. */
function admits(selector: string, own: string[], ancestors: string[]): boolean {
  const compounds = compoundsOf(selector)
  const last = compounds[compounds.length - 1]
  // A type selector in the subject compound (`... button`, `... svg`) names an
  // element these rows never model, and a state pseudo-class is not the resting
  // value being asked about.
  const typeLeft = last.replace(/:not\([^)]*\)|\.[-\w]+|\[[^\]]*\]|::?[-\w]+(\([^)]*\))?/g, '').trim()
  if (typeLeft !== '' && typeLeft !== '*') return false
  if (/:(hover|focus|focus-visible|focus-within|active|disabled|checked|empty)\b/.test(last)) return false
  if (!classesIn(last).every(c => own.includes(c))) return false
  if (notClassesIn(last).some(c => own.includes(c))) return false
  const up = compounds.slice(0, -1).flatMap(classesIn)
  return up.every(c => ancestors.includes(c))
}

/** The winning value of `prop` on the element, at the phone tier or above it. */
function resolved(prop: string, own: string[], ancestors: string[], phone: boolean): string | undefined {
  const rank = ([a, b, c]: [number, number, number]) => a * 1e6 + b * 1e3 + c
  let win: { value: string; spec: number; order: number } | undefined
  for (const r of FLAT) {
    if (!phone && r.tier === 'phone') continue
    const value = decl(`;${r.body}`, prop)
    if (value === undefined || !admits(r.selector, own, ancestors)) continue
    const spec = rank(specificity(r.selector))
    if (!win || spec > win.spec || (spec === win.spec && r.order > win.order)) win = { value, spec, order: r.order }
  }
  return win?.value
}

describe('the bar while a panel is expanded (D-07)', () => {
  it('is one top-level rule keyed on the attribute the hook sets', () => {
    expect(FS_OPEN_ATTR).toBe('data-sr-fs-open')
    expect(decl(rule(`:root[${FS_OPEN_ATTR}] .sr-navbar`), 'visibility')).toBe('hidden')
  })

  it('and nothing under the bar can undo it with `visibility: visible`', () => {
    // `visibility: hidden` is inherited and a descendant may set it back, which
    // would paint and hit-test that one cell over the panel.
    const offenders = FLAT.filter(r => /\.sr-navbar|\.sr-nav-/.test(r.selector) && /visibility\s*:\s*visible/.test(r.body))
    expect(offenders.map(r => r.selector)).toEqual([])
  })

  it('does not hide the bar any other way, so it keeps its box and --sr-navbar-h stands', () => {
    expect(decl(rule(`:root[${FS_OPEN_ATTR}] .sr-navbar`), 'display')).toBeUndefined()
  })
})

describe('the still on the phone tier (D-08)', () => {
  const STILL = ['sr-map-container', MAP_STILL_CLASS]

  it('takes the page\'s swipe: the body takes no pointer and the host lets the page pan', () => {
    expect(resolved('pointer-events', ['sr-map-still-body'], STILL, true)).toBe('none')
    expect(resolved('touch-action', STILL, [], true)).toBe('manipulation')
    // Above the tier neither exists, so the live map is HEAD's.
    expect(resolved('pointer-events', ['sr-map-still-body'], STILL, false)).toBeUndefined()
    expect(resolved('touch-action', STILL, [], false)).toBeUndefined()
  })

  it.each([
    ['maplibregl-ctrl-top-left'], ['maplibregl-ctrl-top-right'], ['sr-map-layers'], ['sr-map-corner-row'],
    ['sr-map-note'], ['maplibregl-cooperative-gesture-screen'],
  ])('draws no %s on a still', control => {
    expect(resolved('display', [control], STILL, true)).toBe('none')
  })

  it('the wrapper is 100% high, at every width', () => {
    for (const phone of [false, true]) {
      expect(resolved('height', ['sr-map-still-body'], [], phone)).toBe('100%')
      expect(resolved('height', ['sr-mx-still-host'], [], phone)).toBe('100%')
    }
  })

  it('the Map Explorer still hides its round buttons but never the location-failure live region', () => {
    const AREA = ['sr-mx-area--still', 'sr-map-fab-cluster']
    for (const child of [['sr-map-fab'], ['sr-map-filters-btn'], ['sr-map-fab-slot'], ['sr-map-search-area-row']]) {
      expect(resolved('display', child, AREA, true), child[0]).toBe('none')
    }
    expect(resolved('display', ['sr-map-geo-error'], AREA, true)).toBe('flex')
  })

  it('the Map Explorer panel floor is 300px on the tier, every platform, and HEAD\'s 340px above it', () => {
    expect(resolved('min-height', ['sr-map-explorer-panel'], [], true)).toBe('300px')
    expect(resolved('min-height', ['sr-map-explorer-panel'], [], false)).toBe('340px')
    // The iPhone app's (0,2,0) panel rule says 300px as well, so the floor is
    // the same on every platform on the tier.
    expect(resolved('min-height', ['sr-map-explorer-panel', 'sr-map-panel-ios'], [], true)).toBe('300px')
  })

  it('while its map is a still, the floor makes room for the opener row (D-28), on the tier only', () => {
    // `:has()` is outside the resolver above, so this row reads the tier rule
    // itself: the floor plus the row's own 10px + 2.75rem + 12px.
    const phone = mediaTier(640)
    const hit = phone.match(/\.sr-map-explorer-panel:has\(\.sr-mx-still-host\.sr-map-still\)\s*\{([^}]*)\}/)
    expect(hit, 'the still-floor rule is in the phone tier').toBeTruthy()
    expect(decl(hit![1], 'min-height')).toBe('calc(322px + 2.75rem)')
    expect(FLAT.some(r => r.tier === 'top' && r.selector.includes(':has(.sr-mx-still-host'))).toBe(false)
  })
})

describe('the exit and the corner row while expanded on the phone tier (D-10)', () => {
  const PANEL = ['sr-map-container', MAP_FS_PANEL_CLASS]

  it.each([['std'], ['compact']])('the %s exit is a pill: width auto over its size modifier, 44px tall, carrying its word', size => {
    const own = ['sr-map-fab', `sr-map-fab--${size}`, 'sr-map-fullscreen-btn']
    expect(resolved('width', own, PANEL, true)).toBe('auto')
    expect(resolved('min-width', own, PANEL, true)).toBe('2.75rem')
    expect(resolved('height', own, PANEL, true)).toBe('2.75rem')
    expect(resolved('display', ['sr-map-exit-label'], PANEL, true)).toBe('inline')
  })

  it('above the tier the exit is HEAD\'s disc and carries no word', () => {
    const own = ['sr-map-fab', 'sr-map-fab--std', 'sr-map-fullscreen-btn']
    expect(resolved('width', own, PANEL, false)).toBe('2.25rem')
    expect(resolved('display', ['sr-map-exit-label'], PANEL, false)).toBe('none')
  })

  it('the Map Explorer\'s own exit keeps its disc on the tier (v0.5.84: 4px of slack)', () => {
    const own = ['sr-map-fab', 'sr-map-fab--std', 'sr-map-fullscreen-btn']
    expect(resolved('width', own, ['sr-map-fullscreen-panel', 'sr-map-fab-cluster'], true)).toBe('2.75rem')
  })

  it.each([
    [[], 'calc(20px + 3rem)'],
    [['sr-ios-app'], 'calc(20px + 3rem + env(safe-area-inset-bottom, 0px))'],
    [['sr-android-app'], 'calc(20px + 3rem + var(--sr-inset-bottom, 0px))'],
  ])('the row stands above the credits, its platform inset re-added (%j)', (app, bottom) => {
    for (const row of [['sr-map-corner-row'], ['sr-map-corner-row', 'sr-map-corner-row--compact']]) {
      expect(resolved('bottom', row, [...app, ...PANEL], true), row.join(' ')).toBe(bottom)
    }
  })

  it('above the tier the row keeps HEAD\'s offsets', () => {
    expect(resolved('bottom', ['sr-map-corner-row'], PANEL, false)).toBe('20px')
    expect(resolved('bottom', ['sr-map-corner-row', 'sr-map-corner-row--compact'], ['sr-ios-app', ...PANEL], false))
      .toBe('calc(12px + env(safe-area-inset-bottom, 0px))')
  })

  it('a row marked fs-only is drawn only inside the expanded panel', () => {
    const own = ['sr-map-corner-row', 'sr-map-corner-row--fs-only']
    expect(resolved('display', own, ['sr-wx-pick-map'], false)).toBe('none')
    expect(resolved('display', own, ['sr-wx-pick-map', MAP_FS_PANEL_CLASS], false)).toBe('flex')
  })
})

describe('the two new hosts\' boxes can be sized by the panel (D-12, D-13)', () => {
  it('.sr-wx-pick-map carries the lifted inline size, and sits ABOVE the panel rule', () => {
    const pick = rule('.sr-wx-pick-map')
    expect(decl(pick, 'height')).toBe('clamp(180px, 28vw, 280px)')
    expect(decl(pick, 'border')).toBe('1px solid var(--sr-border-input)')
    expect(decl(pick, 'border-radius')).toBe('9px')
    const order = [...TOP.keys()]
    expect(order.indexOf('.sr-map-fs-panel')).toBeGreaterThan(order.indexOf('.sr-wx-pick-map'))
  })

  it.each([
    ['sr-wx-pick-map'], ['sr-hsr-map'],
  ])('expanded, %s takes the panel\'s geometry at both tiers', base => {
    for (const phone of [false, true]) {
      expect(resolved('height', [base, MAP_FS_PANEL_CLASS], [], phone)).toBe('100dvh')
      expect(resolved('position', [base, MAP_FS_PANEL_CLASS], [], phone)).toBe('fixed')
    }
  })

  it('the Hotspot Reports box keeps its shipped in-page heights', () => {
    expect(resolved('height', ['sr-hsr-map'], [], false)).toBe('232px')
    expect(resolved('height', ['sr-hsr-map'], [], true)).toBe('200px')
    expect(resolved('height', ['sr-wx-pick-map'], [], true)).toBe('clamp(180px, 28vw, 280px)')
  })
})

describe('the five dropdown lists on the phone tier (D-15)', () => {
  it.each([
    [['sr-hsr-list'], `min(20rem, var(${LIST_FIT_VAR}, 20rem))`, '24rem'],
    [['sr-lfl-region-list'], `min(18rem, var(${LIST_FIT_VAR}, 18rem))`, '21rem'],
    [['sr-tg-combo-list'], `min(17rem, var(${LIST_FIT_VAR}, 17rem))`, '17rem'],
    [['sr-combobox-list'], `min(260px, var(${LIST_FIT_VAR}, 260px))`, '260px'],
  ])('%j takes the smaller of its cap and the measured room, and its cap above the tier', (own, phone, desktop) => {
    expect(resolved('max-height', own, [], true)).toBe(phone)
    expect(resolved('max-height', own, [], false)).toBe(desktop)
    expect(resolved('overscroll-behavior', own, [], true)).toBe('contain')
  })

  it('the two lists that lacked it gain `contain` on the tier only', () => {
    for (const own of [['sr-tg-combo-list'], ['sr-combobox-list']]) {
      expect(resolved('overscroll-behavior', own, [], false)).toBeUndefined()
    }
  })

  it('the Targets chooser is ONE scroller on the tier, its inner list released', () => {
    expect(resolved('max-height', ['sr-tg-apop'], [], true)).toBe(`var(${LIST_FIT_VAR}, none)`)
    expect(resolved('overflow-y', ['sr-tg-apop'], [], true)).toBe('auto')
    expect(resolved('max-height', ['sr-tg-apop-list'], ['sr-tg-apop'], true)).toBe('none')
    expect(resolved('overflow', ['sr-tg-apop-list'], ['sr-tg-apop'], true)).toBe('visible')
    // Above the tier the inner list keeps its own cap and the chooser none.
    expect(resolved('max-height', ['sr-tg-apop-list'], ['sr-tg-apop'], false)).toBe('11.5rem')
    expect(resolved('max-height', ['sr-tg-apop'], [], false)).toBeUndefined()
  })
})
