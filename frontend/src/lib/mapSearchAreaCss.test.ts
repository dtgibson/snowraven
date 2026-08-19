/// <reference types="node" />
//
// feature: search-this-area — the stylesheet invariants the control and its
// live region depend on.
//
// Reads the REAL globals.css off disk (vitest stubs CSS `?raw`), the same
// posture as mapFabClusterCss / milestoneContrast / countyContrast /
// filterControlSizeCss. The node types live only in tsconfig.node, so the
// reference above stays file-scoped.
//
// WHAT THIS PROVES: that the declarations exist, at top level (not stranded
// inside a media tier), on the right selectors, with the right values; that
// nothing anywhere in the file hides the live region; that neither new element
// carries a safe-area rule; and that every colour comes from a token.
//
// WHAT IT CANNOT PROVE, and is explicitly NOT evidence for (CLAUDE.md, v0.5.82):
// that any of it WORKS. A stylesheet test passes on an inert class — that is how
// an inert .sr-wrap-flex shipped. Whether the control fits 320px at 200% text
// scale, whether it overlaps the layers switcher, whether the cluster still fits
// with a location-failure row present, and whether a tap inside the outcome
// region reaches the switcher underneath are browser measurements; they are
// written up in pipeline/search-this-area/pr-description.md.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import {
  findSafeAreaRules, findUngatedSafeAreaRules, parseTopLevelRules,
} from './cssTopLevelRules'

const CSS = readFileSync(fileURLToPath(new URL('../globals.css', import.meta.url)), 'utf8')
const TOP = parseTopLevelRules(CSS)

/**
 * Every `@media (max-width: N px)` block in the file, concatenated. ALL of them,
 * not the first: globals.css carries two ≤640 blocks, and taking `indexOf` alone
 * finds the one-liner and reports every phone-tier rule missing.
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
  expect(parts.length).toBeGreaterThan(0)
  return parts.join('\n')
}

/**
 * A declaration's value, or undefined. `{` is in the leading boundary set
 * deliberately — without it this returns undefined for a whole rule passed in as
 * text (`.x:empty { display: none; }`, where `display` follows `{ `), which is
 * exactly the form the any-depth scan below feeds it. That omission left the
 * sibling guard in mapFabClusterCss.test.ts inert against single-line rules
 * until mutation testing found it.
 */
const decl = (body: string, prop: string) =>
  body.match(new RegExp(`(?:^|[;{]|\\n)\\s*${prop}\\s*:\\s*([^;}]+)`))?.[1].trim()

// ── The two new tokens ───────────────────────────────────────────────────────

describe('the searched-area tokens', () => {
  it('are declared in BOTH themes, with identical values', () => {
    // Map-anchored: only ever drawn on the always-light Positron basemap, so
    // theme-identical BY DESIGN (the --sr-share-pin / --sr-map-pin-* / county
    // ramp posture). Theme-flipping would wash the ring out over a light base,
    // and would turn the scrim into a LIGHTENING wash in dark mode, which is the
    // opposite of what it means.
    //
    // The word that would more naturally sit in that last sentence is spelled
    // out in globals.css and deliberately not here: Tailwind v4's auto source
    // detection scans THIS FILE too, extracts bare words as class candidates,
    // and emits a rule for any that happens to name a real utility — comments
    // included. Measured on this change: it added 219 bytes and a new content
    // hash to the shipped index-*.css. Describe such a word, never spell it.
    for (const token of ['--sr-search-area-rgb', '--sr-search-area-scrim-rgb']) {
      const light = decl(TOP.get(':root')!, token)
      const dark = decl(TOP.get('[data-theme="dark"]')!, token)
      expect(light, `${token} in :root`).toBeTruthy()
      expect(dark, `${token} in dark`).toBeTruthy()
      expect(dark).toBe(light)
    }
  })

  it('are -rgb triplets, because both are consumed at an alpha', () => {
    // The repo's rgba(var(--sr-*-rgb), a) pattern — the edge is drawn at 0.95
    // and 0.20, the scrim at 0.18, so a hex value could not be used.
    expect(decl(TOP.get(':root')!, '--sr-search-area-rgb')).toBe('180, 52, 31')
    expect(decl(TOP.get(':root')!, '--sr-search-area-scrim-rgb')).toBe('15, 17, 23')
  })

  it('reuses the already-measured share-pin red-orange rather than minting a neighbour', () => {
    // #B4341F is 5.38:1 on Positron land, past the 3:1 WCAG 1.4.11 bar for a
    // non-text graphic with the margin that keeps it legible over satellite. The
    // two never co-occur as a data class (a planted flag against a boundary
    // line), so one red-orange in the palette is one fewer to keep audited.
    expect(decl(TOP.get(':root')!, '--sr-share-pin')).toBe('#B4341F')
    expect(decl(TOP.get(':root')!, '--sr-search-area-rgb')).toBe('180, 52, 31')
  })

  it('mints no on-fill text pair, because no text is painted on either fill', () => {
    expect(decl(TOP.get(':root')!, '--sr-search-area-fg')).toBeUndefined()
    expect(decl(TOP.get(':root')!, '--sr-search-area-text')).toBeUndefined()
  })
})

// ── The control's row (QA-36) ────────────────────────────────────────────────

describe('.sr-map-search-area-row', () => {
  const row = TOP.get('.sr-map-search-area-row')

  it('is a top-level rule, so it holds at every viewport width', () => {
    expect(row).toBeTruthy()
  })

  it('claims its own full-width row in the cluster and stays click-through', () => {
    // Same mechanism as .sr-map-geo-error's: a full-width row in a
    // bottom-anchored cluster grows the cluster UPWARD, so it consumes none of
    // the FAB row's measured 4.00px of horizontal slack and no shipped button
    // moves.
    expect(decl(row!, 'flex')).toBe('0 0 100%')
    expect(decl(row!, 'display')).toBe('flex')
    expect(decl(row!, 'justify-content')).toBe('flex-end')
    expect(decl(row!, 'pointer-events')).toBe('none')
  })

  it('adds no pointer-events: auto of its own, because the shipped rule covers it', () => {
    // `.sr-map-fab-cluster button` is a descendant selector and already
    // re-enables a <button> nested one level deeper. A `> *` here would also
    // make the row itself swallow gestures.
    expect(TOP.get('.sr-map-search-area-row > *')).toBeUndefined()
    expect(decl(TOP.get('.sr-map-fab-cluster button')!, 'pointer-events')).toBe('auto')
  })

  it('declares no `order`, so DOM order stays tab order (WCAG 2.4.3)', () => {
    for (const [selector, body] of TOP) {
      if (!/sr-map-search-area|sr-map-search-status/.test(selector)) continue
      expect(decl(body, 'order'), `${selector} must not set \`order\``).toBeUndefined()
    }
  })
})


// ── Why the row cannot move a shipped control ────────────────────────────────

describe('the row grows the cluster UPWARD, which is a property of the CLUSTER', () => {
  const cluster = TOP.get('.sr-map-fab-cluster')
  const row = TOP.get('.sr-map-search-area-row')

  /**
   * WHY THIS EXISTS. At the deploy gate this feature was reported as having
   * pushed the three map discs and the Filters pill off the bottom of the
   * window, on desktop and on phone. A genuine build A/B against 3f4d5b3
   * measured the opposite, in Chromium and WebKit alike: the Map Explorer page
   * overflows its viewport by 74px at 1434x1236 and by 96px at 402x874 in BOTH
   * builds, and the disc line sits 15.5px / 37.5px BELOW the viewport bottom in
   * BOTH. Container-relative, the disc line and the Filters pill are identical
   * to HEAD to the hundredth of a pixel; only the cluster's TOP edge moves
   * (935.5 -> 893.25 desktop, 568 -> 514 phone) while its BOTTOM edge does not
   * move at all. The clipping is `.sr-map-explorer-panel`'s fixed chrome budget
   * under-counting the real chrome, it is independent of viewport HEIGHT (74px
   * at 900, 1236 and 1600px tall), and it predates this feature.
   *
   * So the row was innocent — but only because of the declarations below, and
   * none of them was pinned anywhere. They are the whole argument.
   *
   * WHAT THIS REJECTS. Each assertion was mutation-checked in the stylesheet AND
   * its consequence measured in a browser at 320x800, because a red test only
   * shows a string changed. Injecting each mutation over the shipped build:
   *
   *   position: absolute -> static   disc line moves 935.5px, from the bottom of
   *                                  the map area to the top of it
   *   bottom: 20px -> top: 20px      disc line moves 504 -> 84 (top of the map)
   *   flex: 0 0 100% -> 0 0 auto     the discs BREAK ACROSS TWO LINES and the
   *                                  disc line moves (top 504 -> 450, left
   *                                  50.44 -> 158.44) — the control has joined
   *                                  the disc row and eaten its slack
   *   flex-wrap: wrap -> nowrap      the control lands ON the disc line
   *                                  (row top 450 -> 504), the state the
   *                                  cluster's own note measured as putting a
   *                                  control 62.9px off the left edge
   *
   * WHAT IT CANNOT REJECT, and must not be read as covering. The page overflow
   * that the reviewer actually saw. That is worth stating precisely, because the
   * intuition is wrong and the measurement says so: putting the cluster back in
   * flow does NOT lengthen the page. Overflow read 74px at 1434x1236 and 135px
   * at 320x800 in the shipped build and in ALL FOUR mutations above, unchanged,
   * because `.sr-map-explorer-panel` pins its own height and the map area is
   * `flex: 1` inside it — so nothing the cluster does can reach the page box.
   * The clipping lives on that rule's budget and is not this feature's to hold.
   *
   * SINCE FIXED, in the same release and deliberately as a separate change: that
   * rule's budget is now measured rather than assumed (lib/mapPanelChrome.ts,
   * guarded by mapPanelChromeCss.test.ts). Re-measured against the fixed build,
   * page overflow is 0 at every width and text scale bar one, and the disc line
   * sits 58.5px ABOVE the viewport bottom on desktop and phone alike where it had
   * been 15.5px and 37.5px below it. Nothing in THIS file changed for that, which
   * is the point: the declarations below were always the reason the row could not
   * move a shipped control, and they still are.
   *
   * Nor can this file prove any geometry at all. A stylesheet test passes on an
   * inert class (CLAUDE.md, v0.5.82) — it proves these declarations are present,
   * exact and top-level, never that the layout they describe is the one that
   * renders. The geometry is the browser A/B, not this file.
   */
  it('anchors the cluster OUT OF FLOW and to the BOTTOM, so a full-width row grows it upward', () => {
    expect(cluster, '.sr-map-fab-cluster must be a top-level rule').toBeTruthy()
    // Out of flow and bottom-anchored: together these are what put the disc line
    // at the bottom of the map area at all. Either one alone does not.
    expect(decl(cluster!, 'position')).toBe('absolute')
    expect(decl(cluster!, 'bottom')).toBe('20px')
    expect(decl(cluster!, 'top')).toBeUndefined()
    // A 100% flex-basis item only takes a row of its OWN if the cluster wraps.
    expect(decl(cluster!, 'flex-wrap')).toBe('wrap')
  })

  it('keeps the row a plain flex item, so it cannot escape the cluster it is measured inside', () => {
    // The whole out-of-flow argument is inherited from the cluster. A `position`
    // here would take the row out of the cluster's flex flow, and out of the
    // reach of `.sr-ios-app .sr-map-fab-cluster`'s safe-area inset with it.
    expect(decl(row!, 'position')).toBeUndefined()
    // useSearchControlFit measures the row against the shipped disc line and the
    // cluster's OWN row-gap. That gap has to be a real length, or the fit
    // arithmetic silently reads 0 (`normal` parses to NaN, which the hook floors
    // to 0) and the control is offered where it does not fit.
    expect(decl(cluster!, 'row-gap')).toBe('10px')
  })
})

// ── The control (QA-33, QA-35, QA-36) ────────────────────────────────────────

describe('.sr-map-search-area-btn', () => {
  const btn = TOP.get('.sr-map-search-area-btn')
  const off = TOP.get('.sr-map-search-area-btn[aria-disabled="true"]')

  it('declares its layout in the stylesheet rather than inline (NFR-06)', () => {
    // Positioning, display, wrapping and gap must be reachable by a media query
    // and by the .sr-ios-app gate; an inline style is (1,0,0) and is not.
    expect(btn).toBeTruthy()
    expect(decl(btn!, 'display')).toBe('inline-flex')
    expect(decl(btn!, 'align-items')).toBe('center')
    expect(decl(btn!, 'justify-content')).toBe('center')
    expect(decl(btn!, 'gap')).toBe('7px')
    // Responsive by construction, no breakpoint math.
    expect(decl(btn!, 'max-width')).toBe('100%')
  })

  it('wears the app\'s shipped active treatment, not an accent-FILLED slab', () => {
    // A solid accent fill on this canvas means SIGHTING PIN, so a filled control
    // would read as data rather than chrome — and the accent-filled
    // .sr-map-filters-btn sits in this same cluster on a phone.
    const pressed = TOP.get('.sr-share-drop-btn[aria-pressed="true"]')!
    expect(decl(btn!, 'background')).toBe(decl(pressed, 'background'))
    expect(decl(btn!, 'color')).toBe(decl(pressed, 'color'))
    expect(decl(btn!, 'background')).toBe('var(--sr-accent-bg)')
    expect(decl(btn!, 'color')).toBe('var(--sr-accent)')
    expect(decl(btn!, 'border')).toBe('1px solid var(--sr-accent-border-strong)')
    // The filled pill's fill is what it must NOT be.
    expect(decl(btn!, 'background')).not.toBe(decl(TOP.get('.sr-map-filters-btn')!, 'background'))
  })

  it('paints only from tokens, with the map-chrome shadow as the one literal', () => {
    // The shadow is the loading chip's family value, the established convention
    // for map chrome; everything that carries meaning is a token.
    const literal = /#[0-9a-fA-F]{3,8}\b|\brgb\(/
    for (const prop of ['background', 'color', 'border', 'border-color']) {
      const v = decl(btn!, prop)
      if (v) expect(v, prop).not.toMatch(literal)
    }
    expect(decl(btn!, 'box-shadow')).toBe('0 2px 8px rgba(0, 0, 0, 0.18)')
  })

  it('sizes in rem so it holds at 200% in-app text scale', () => {
    expect(decl(btn!, 'font-size')).toBe('0.8125rem')
    expect(decl(btn!, 'font-family')).toBe('inherit')
    // No fixed height at all: .sr-touch-target's min-height then simply grows
    // the box on a phone rather than fighting a height in the used-value
    // computation.
    expect(decl(btn!, 'height')).toBeUndefined()
  })

  it('reaches the ~44px touch posture on phones and wraps rather than pushing its row (QA-33)', () => {
    // The class is on the element (asserted in the component test); this is the
    // rule that gives it teeth, and it is rem so it holds at 200% text scale.
    const phone = mediaTier(640)
    const touch = phone.match(/\.sr-touch-target\s*\{([^}]*)\}/)?.[1]
    expect(touch).toBeTruthy()
    expect(decl(touch!, 'min-height')).toBe('2.75rem')
    // ...and the label is allowed to wrap on a phone. The base rule is nowrap,
    // which is what keeps the desktop pill compact.
    expect(decl(btn!, 'white-space')).toBe('nowrap')
    const phoneBtn = phone.match(/\.sr-map-search-area-btn\s*\{([^}]*)\}/)?.[1]
    expect(phoneBtn).toBeTruthy()
    expect(decl(phoneBtn!, 'white-space')).toBe('normal')
    expect(decl(phoneBtn!, 'text-align')).toBe('center')
  })

  it('carries the retained state on aria-disabled, never :disabled', () => {
    // Disabling a FOCUSED button drops focus to <body>, which is the exact
    // failure the retained state exists to prevent.
    expect(off).toBeTruthy()
    expect(decl(off!, 'cursor')).toBe('default')
    expect(decl(off!, 'color')).toBe('var(--sr-text-muted)')
    expect(decl(off!, 'background')).toBe('var(--sr-surface)')
    // The arrive animation is suppressed: nothing arrived, this is the control
    // the user just pressed.
    expect(decl(off!, 'animation')).toBe('none')
    expect(TOP.get('.sr-map-search-area-btn:disabled')).toBeUndefined()
    for (const [selector] of TOP) {
      expect(selector, 'no :disabled on the search control')
        .not.toMatch(/^\.sr-map-search-area-btn[^ ]*:disabled/)
    }
  })

  /**
   * The retained surface and the hover surface are BOTH (0,2,0) and both set
   * `background`, so source order alone decides which a hovered retained button
   * wears — the same trap the FAB family records at length. The (0,3,0) pair is
   * the guarantee; this pins the order so the un-hovered case reads correctly
   * wherever the two rules sit.
   */
  it('orders base, hover, retained, retained-hover', () => {
    const order = [...TOP.keys()]
    const at = (selector: string) => {
      const i = order.indexOf(selector)
      expect(i, `${selector} must be a top-level rule`).toBeGreaterThanOrEqual(0)
      return i
    }
    expect(at('.sr-map-search-area-btn')).toBeLessThan(at('.sr-map-search-area-btn:hover'))
    expect(at('.sr-map-search-area-btn:hover'))
      .toBeLessThan(at('.sr-map-search-area-btn[aria-disabled="true"]'))
    expect(at('.sr-map-search-area-btn[aria-disabled="true"]'))
      .toBeLessThan(at('.sr-map-search-area-btn[aria-disabled="true"]:hover'))
    expect(decl(TOP.get('.sr-map-search-area-btn[aria-disabled="true"]:hover')!, 'background'))
      .toBe('var(--sr-surface)')
  })

  it('animates in with the house vocabulary and no per-component reduced-motion query', () => {
    expect(decl(btn!, 'animation')).toBe('sr-search-area-arrive 190ms cubic-bezier(0.16, 1, 0.3, 1)')
    // It grows UP out of a bottom-anchored cluster, so it scales from its bottom
    // edge; the top-anchored outcome line does the opposite.
    expect(decl(btn!, 'transform-origin')).toBe('bottom center')
    // The end state IS the resting state, so the app's global
    // prefers-reduced-motion block collapsing this to ~1us loses nothing.
    const frames = CSS.match(/@keyframes sr-search-area-arrive\s*\{([\s\S]*?)\n\}/)?.[1] ?? ''
    expect(frames).toContain('opacity: 1')
    expect(frames).toContain('scale(1)')
    expect(frames).toContain('translateY(0)')
    expect(/@media \(prefers-reduced-motion[^}]*sr-search-area/.test(CSS)).toBe(false)
  })
})

// ── The live region (NFR-12 / QA-40) ─────────────────────────────────────────

describe('.sr-map-search-status', () => {
  const region = TOP.get('.sr-map-search-status')
  const msg = TOP.get('.sr-map-search-status-msg')

  it('is anchored left AND right, never centred by a 50% translate (E-05)', () => {
    // An absolutely positioned box with only `left` set shrink-to-fits against
    // the space from that edge, so the chip's `left: 50%; translateX(-50%)` form
    // would give this WRAPPING message half the map width — measured at 8 lines
    // where 4 were expected. The chip gets away with it because it is
    // effectively single-line; this region is not.
    expect(region).toBeTruthy()
    expect(decl(region!, 'position')).toBe('absolute')
    expect(decl(region!, 'top')).toBe('12px')
    expect(decl(region!, 'left')).toBe('12px')
    expect(decl(region!, 'right')).toBe('12px')
    expect(decl(region!, 'transform')).toBeUndefined()
    expect(decl(region!, 'justify-content')).toBe('center')
    // Peer map chrome, matching the cluster and the loading chip; the repo
    // reserves 1200 for true overlays.
    expect(decl(region!, 'z-index')).toBe('1050')
  })

  it('passes every tap through to the layers switcher underneath', () => {
    // This is the entire justification for taking the top-centre anchor: the
    // switcher sits under this box and must stay fully operable. Both the
    // container AND the message node must be click-through.
    expect(decl(region!, 'pointer-events')).toBe('none')
    expect(decl(msg!, 'pointer-events')).toBe('none')
  })

  /**
   * THE ONE THAT MATTERS. This is a `role="status"` live region and it must be
   * in the ACCESSIBILITY TREE while idle, before its content ever changes — not
   * merely present in the DOM. `display: none` removes an element from that tree
   * rather than merely from view, so a region hidden while idle is inserted at
   * the same instant its first content arrives, which is the documented way to
   * make a live region fail to announce. It would break EVERY announcement here,
   * not just the first, because each handler empties the region before its fetch.
   *
   * Written as a scan over every rule in the stylesheet whose subject is this
   * region — not an assertion about one selector — because the defect can be
   * reintroduced under `:empty`, `:not(:has(*))`, a media tier, or a plain class
   * rule, and a guard naming one of those would sit inert while another shipped.
   * The exact shape shipped once on .sr-map-geo-error and was caught only by an
   * ariaSnapshot against a real render.
   *
   * Deliberately paired with the component test, which asserts the region is in
   * the DOM while idle (necessary, and passes on the broken build, since jsdom
   * loads no stylesheet). Neither half is sufficient alone.
   */
  it('is never hidden while idle, so the live region stays in the accessibility tree', () => {
    const HIDING = ['display', 'visibility', 'content-visibility']
    const hidden = ['none', 'hidden', 'collapse']
    const offenders: string[] = []

    // Top-level rules. `(?![-\w])` so the container scan does not also swallow
    // `-msg`, which the next test owns — a `\b` there would.
    for (const [selector, body] of TOP) {
      if (!/^\.sr-map-search-status(?![-\w])/.test(selector)) continue
      for (const prop of HIDING) {
        const v = decl(body, prop)
        if (v && hidden.includes(v)) offenders.push(`${selector} { ${prop}: ${v} }`)
      }
    }
    // ...and any rule at any nesting depth, so a media tier cannot smuggle one in.
    const anywhere = CSS.replace(/\/\*[\s\S]*?\*\//g, '')
      .match(/\.sr-map-search-status(?![-\w])[^{}]*\{[^}]*\}/g) ?? []
    for (const rule of anywhere) {
      for (const prop of HIDING) {
        const v = decl(rule, prop)
        if (v && hidden.includes(v)) offenders.push(rule.trim())
      }
    }

    expect(offenders, 'nothing may hide the search-outcome live region').toEqual([])
    // And the base rule must POSITIVELY lay it out, so "not hidden" cannot be
    // satisfied vacuously by the rule having been deleted altogether.
    expect(decl(region!, 'display')).toBe('flex')
  })

  it('does not hide the visible CARD either, since the card is the region\'s only child', () => {
    // The message node and the announced text are the same node here, so hiding
    // the card would empty the region's textContent just as effectively.
    for (const prop of ['display', 'visibility', 'content-visibility']) {
      const v = decl(msg!, prop)
      expect(v === 'none' || v === 'hidden' || v === 'collapse').toBe(false)
    }
    expect(decl(msg!, 'display')).toBe('flex')
  })

  it('is one element in two variants, the failure using the audited error trio', () => {
    // Never a second card in a second place, and never a duplicate .sr-only
    // announcer, which would put the same sentence in the reading order twice.
    expect(decl(msg!, 'background')).toBe('var(--sr-surface)')
    expect(decl(msg!, 'border')).toBe('1px solid var(--sr-border)')
    expect(decl(msg!, 'color')).toBe('var(--sr-text-muted)')
    const err = TOP.get('.sr-map-search-status-msg--error')!
    expect(decl(err, 'background')).toBe('var(--sr-error-bg)')
    expect(decl(err, 'border-color')).toBe('var(--sr-error-border)')
    expect(decl(err, 'color')).toBe('var(--sr-error)')
    // --sr-error on --sr-error-bg is 4.82:1 light / 7.07:1 dark, already tuned
    // and already commented at the token, so no new contrast guard is owed.
    for (const theme of [':root', '[data-theme="dark"]']) {
      for (const t of ['--sr-error', '--sr-error-bg', '--sr-error-border']) {
        expect(decl(TOP.get(theme)!, t), `${t} in ${theme}`).toBeTruthy()
      }
    }
  })

  it('sizes in rem, and drops its desktop cap on a phone', () => {
    expect(decl(msg!, 'font-size')).toBe('0.75rem')
    expect(decl(msg!, 'max-width')).toBe('24rem')
    const phoneMsg = mediaTier(640).match(/\.sr-map-search-status-msg\s*\{([^}]*)\}/)?.[1]
    expect(phoneMsg).toBeTruthy()
    expect(decl(phoneMsg!, 'max-width')).toBe('100%')
  })

  it('reuses the shipped top-anchored arrival animation', () => {
    // The mirror of the control's: this one is top-anchored, so it drops in from
    // above. Reusing sr-map-geo-in rather than minting a second identical
    // keyframe keeps one vocabulary on this canvas.
    expect(decl(msg!, 'animation')).toBe('sr-map-geo-in 190ms cubic-bezier(0.16, 1, 0.3, 1)')
  })
})

// ── Safe area (NFR-02 / QA-32, E-06) ─────────────────────────────────────────

describe('neither new element carries a safe-area rule, for two DIFFERENT reasons', () => {
  /**
   * Recorded per element, because a future reader will otherwise assume one
   * reason covers both:
   *
   *   THE CONTROL inherits `.sr-ios-app .sr-map-fab-cluster`'s BOTTOM inset by
   *   living inside that cluster. A bottom-anchored control needs one, because
   *   `.sr-ios-app .sr-map-fullscreen-panel` deliberately omits padding-bottom —
   *   and the cluster already has it.
   *
   *   THE STATUS REGION is TOP-anchored inside the map-area div, which is an
   *   in-flow descendant of the fullscreen panel and has therefore ALREADY been
   *   displaced inward by that panel's `.sr-ios-app` top padding. Adding an inset
   *   here would DOUBLE-inset.
   */
  it('the control has none, and inherits the cluster\'s bottom inset', () => {
    expect(findSafeAreaRules(CSS, 'sr-map-search-area-btn')).toEqual([])
    expect(findUngatedSafeAreaRules(CSS, 'sr-map-search-area-btn')).toEqual([])
    expect(findSafeAreaRules(CSS, 'sr-map-search-area-row')).toEqual([])
    // The inset it relies on, and that it is GATED on .sr-ios-app rather than a
    // bare env() (index.html ships viewport-fit=cover to browsers too, so an
    // ungated rule would change shipped web rendering).
    const ios = TOP.get('.sr-ios-app .sr-map-fab-cluster')
    expect(ios).toBeTruthy()
    expect(decl(ios!, 'bottom')).toBe('calc(20px + env(safe-area-inset-bottom, 0px))')
    expect(findUngatedSafeAreaRules(CSS, 'sr-map-fab-cluster')).toEqual([])
  })

  it('the status region has none, because the panel\'s top padding already reached it', () => {
    expect(findSafeAreaRules(CSS, 'sr-map-search-status')).toEqual([])
    expect(findUngatedSafeAreaRules(CSS, 'sr-map-search-status')).toEqual([])
    // The padding it relies on, and the containing-block chain that carries it:
    // .sr-ios-app .sr-map-fullscreen-panel pads top/left/right (never bottom),
    // and .sr-map-content is the positioned in-flow descendant that keeps the
    // landscape inset honest.
    const panel = TOP.get('.sr-ios-app .sr-map-fullscreen-panel')
    expect(panel).toBeTruthy()
    expect(decl(panel!, 'padding-top')).toContain('env(safe-area-inset-top')
    expect(decl(panel!, 'padding-bottom')).toBeUndefined()
    expect(decl(TOP.get('.sr-map-content')!, 'position')).toBe('relative')
  })
})
