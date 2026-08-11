/// <reference types="node" />
//
// feature: map-location-buttons — the stylesheet invariants the cluster's new
// fourth control and its message row depend on.
//
// Reads the REAL globals.css off disk (vitest stubs CSS `?raw`), the same
// posture as milestoneContrast / countyContrast / calendarContrast /
// filterControlSizeCss. The node types live only in tsconfig.node, so the
// reference above stays file-scoped.
//
// WHAT THIS PROVES: that the declarations exist, at top level (not stranded
// inside a media tier), on the right selectors, with the right values, and that
// no `order` declaration exists anywhere on the cluster or its children.
//
// WHAT IT CANNOT PROVE, and is explicitly NOT evidence for (CLAUDE.md, v0.5.82):
// that any of it WORKS. A stylesheet test passes on an inert class — that is how
// an inert .sr-wrap-flex shipped. Whether the cluster fits 320px at 200% text
// scale, whether the buttons hold position when a message appears, whether
// :empty actually collapses the row, and whether a pointer reaches the canvas
// are browser measurements; they were made against a real render and are written
// up in pipeline/map-location-buttons/pr-description.md.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { parseTopLevelRules } from './cssTopLevelRules'

const CSS = readFileSync(fileURLToPath(new URL('../globals.css', import.meta.url)), 'utf8')
const TOP = parseTopLevelRules(CSS)

/**
 * Every `@media (max-width: N px)` block in the file, concatenated.
 *
 * ALL of them, not the first: globals.css carries two ≤640 blocks (a one-line
 * `.sr-map-explorer-panel` rule near the map styles, and the main phone tier
 * ~1000 lines later). Taking `indexOf` alone finds the one-liner and reports
 * every phone-tier rule missing.
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
 * A declaration's value, or undefined.
 *
 * `{` is in the leading boundary set deliberately. Without it this matched only
 * declarations preceded by the start of a body string, a `;`, or a newline — so
 * it worked on the bodies `parseTopLevelRules` returns but silently returned
 * undefined for a whole rule passed in as text (`.x:empty { display: none; }`,
 * where `display` follows `{ `). The hidden-region scan below passes whole rules,
 * and was inert against a single-line rule until this was found by mutation.
 */
const decl = (body: string, prop: string) =>
  body.match(new RegExp(`(?:^|[;{]|\\n)\\s*${prop}\\s*:\\s*([^;}]+)`))?.[1].trim()

describe('.sr-map-fab-cluster gains exactly the five declarations, at top level', () => {
  const cluster = TOP.get('.sr-map-fab-cluster')

  it('is a top-level rule, so it holds at every viewport width', () => {
    expect(cluster).toBeTruthy()
  })

  it('keeps its four shipped declarations byte-identical', () => {
    expect(decl(cluster!, 'display')).toBe('flex')
    expect(decl(cluster!, 'position')).toBe('absolute')
    expect(decl(cluster!, 'bottom')).toBe('20px')
    expect(decl(cluster!, 'right')).toBe('16px')
    expect(decl(cluster!, 'z-index')).toBe('1050')
    expect(decl(cluster!, 'align-items')).toBe('center')
    expect(decl(cluster!, 'gap')).toBe('10px')
  })

  it('wraps, right-aligns, shares one gap rhythm, and caps its width', () => {
    expect(decl(cluster!, 'flex-wrap')).toBe('wrap')
    expect(decl(cluster!, 'justify-content')).toBe('flex-end')
    // The row gap must match the shipped column `gap` or the two rows read as
    // two clusters rather than one.
    expect(decl(cluster!, 'row-gap')).toBe(decl(cluster!, 'gap'))
    // Responsive by construction: a percentage of the map area, not breakpoint
    // math. The 32px is 2 x the cluster's own 16px right inset, so the wrapped
    // cluster keeps a matching left gutter.
    expect(decl(cluster!, 'max-width')).toBe('calc(100% - 32px)')
  })

  it('is click-through, with pointer events restored on the buttons', () => {
    // The cluster box grows to ~371px tall with a message in it; without this it
    // would swallow every gesture inside that box.
    expect(decl(cluster!, 'pointer-events')).toBe('none')
    const buttons = TOP.get('.sr-map-fab-cluster button')
    expect(buttons).toBeTruthy()
    expect(decl(buttons!, 'pointer-events')).toBe('auto')
    // Scoped to `button`, NOT `> *`: the message row must stay click-through.
    expect(TOP.get('.sr-map-fab-cluster > *')).toBeUndefined()
  })

  it('declares no `order` on the cluster or any of its children (QA-15, FR-10)', () => {
    // `order` moves a box visually while leaving DOM order unchanged, which
    // desynchronizes tab order from reading order (WCAG 2.4.3). The share slot
    // is `display: contents` for exactly this reason, and the location button is
    // a direct child for exactly this reason.
    for (const [selector, body] of TOP) {
      if (!/sr-map-fab|sr-map-locate-btn|sr-map-geo-error|sr-map-filters-btn|sr-map-fullscreen-btn|sr-share-drop-btn/.test(selector)) continue
      expect(decl(body, 'order'), `${selector} must not set \`order\``).toBeUndefined()
    }
    // Scoped to the cluster's own vocabulary rather than banning `order:`
    // stylesheet-wide, so unrelated future work does not fail under this name.
    expect(/\.sr-map-fab-cluster[^{]*\{[^}]*\border\s*:/.test(CSS)).toBe(false)
  })
})

describe('.sr-map-locate-btn matches the shipped share FAB', () => {
  const locate = TOP.get('.sr-map-locate-btn')
  const share = TOP.get('.sr-share-drop-btn')

  it('duplicates .sr-share-drop-btn\'s visual declarations', () => {
    expect(locate).toBeTruthy()
    expect(share).toBeTruthy()
    // Duplication is the house pattern here (FR-04 forbids altering either
    // shipped FAB rule), so the guard is that the duplicate stays a duplicate.
    // A FIFTH map FAB should force the extraction of a shared base class.
    for (const prop of [
      'display', 'align-items', 'justify-content', 'width', 'height', 'padding',
      'flex', 'background', 'color', 'border', 'border-radius', 'cursor',
      'box-shadow', 'transition',
    ]) {
      expect(decl(locate!, prop), prop).toBe(decl(share!, prop))
    }
  })

  it('reaches the ~44px touch posture on a phone, exactly as the share FAB does', () => {
    const phone = mediaTier(640)
    const locatePhone = phone.match(/\.sr-map-locate-btn\s*\{([^}]*)\}/)?.[1]
    const sharePhone = phone.match(/\.sr-share-drop-btn\s*\{([^}]*)\}/)?.[1]
    expect(locatePhone).toBeTruthy()
    // rem, not px, so it holds at 200% in-app text scale.
    expect(decl(locatePhone!, 'width')).toBe('2.75rem')
    expect(decl(locatePhone!, 'height')).toBe('2.75rem')
    expect(decl(locatePhone!, 'width')).toBe(decl(sharePhone!, 'width'))
    // ...and the base rule stays at the shipped 36px above that tier.
    expect(decl(locate!, 'width')).toBe('36px')
  })

  it('signals busy through aria-disabled, never :disabled', () => {
    // Disabling a focused button drops focus to <body> in most browsers, which
    // would break FR-06 for the button the user just pressed.
    expect(TOP.get('.sr-map-locate-btn[aria-disabled="true"]')).toBeTruthy()
    expect(decl(TOP.get('.sr-map-locate-btn[aria-disabled="true"]')!, 'cursor')).toBe('default')
    expect(TOP.get('.sr-map-locate-btn:disabled')).toBeUndefined()
    // The busy surface must NOT borrow the share button's "holding a pin" tint.
    expect(decl(TOP.get('.sr-map-locate-btn[aria-disabled="true"]')!, 'background')).toBeUndefined()
  })
})

describe('.sr-map-geo-error', () => {
  const row = TOP.get('.sr-map-geo-error')
  const msg = TOP.get('.sr-map-geo-error-msg')

  it('claims its own full-width row and stays click-through', () => {
    expect(row).toBeTruthy()
    expect(decl(row!, 'flex')).toBe('0 0 100%')
    expect(decl(row!, 'justify-content')).toBe('flex-end')
    expect(decl(row!, 'pointer-events')).toBe('none')
  })

  /**
   * THE ONE THAT MATTERS. This region is a `role="status"` live region, and it
   * must be in the ACCESSIBILITY TREE while idle, before its content ever
   * changes — not merely present in the DOM.
   *
   * A `.sr-map-geo-error:empty { display: none }` rule shipped here in review
   * and was caught by an `ariaSnapshot` against a real render: the status node
   * was ABSENT from the tree while empty, so the region was being inserted at
   * the same instant its first content arrived. Because the handler's leading
   * `setGeoError('')` empties the region before every press, that was every
   * announcement, not just the first, and it defeated the sequence-keyed child
   * in geoErrorState.ts, whose premise is a stable region.
   *
   * This test is the guard against that rule coming back. It is written as a
   * scan over EVERY rule in the stylesheet whose subject is this region — not
   * an assertion about one selector — because the defect can be reintroduced
   * under `:empty`, `:not(:has(*))`, a media tier, or a plain class rule, and a
   * guard naming one of those would sit inert while another shipped.
   *
   * It is deliberately paired: the component test asserts the region is in the
   * DOM while idle (necessary, and passes on the broken build, since jsdom
   * loads no stylesheet), and this one asserts nothing hides it (which is what
   * the broken build actually did). Neither half is sufficient alone.
   */
  it('is never hidden while idle, so the live region stays in the accessibility tree', () => {
    const HIDING = ['display', 'visibility', 'content-visibility']
    const hidden = ['none', 'hidden', 'collapse']
    const offenders: string[] = []

    // Top-level rules... (`(?![-\w])` so this is the region, not the card —
    // `\b` would also match `.sr-map-geo-error-msg`, which the next test owns.)
    for (const [selector, body] of TOP) {
      if (!/^\.sr-map-geo-error(?![-\w])/.test(selector)) continue
      for (const prop of HIDING) {
        const v = decl(body, prop)
        if (v && hidden.includes(v)) offenders.push(`${selector} { ${prop}: ${v} }`)
      }
    }
    // ...and any rule at any nesting depth, so a media tier cannot smuggle one in.
    const anywhere = CSS.replace(/\/\*[\s\S]*?\*\//g, '')
      .match(/\.sr-map-geo-error(?![-\w])[^{}]*\{[^}]*\}/g) ?? []
    for (const rule of anywhere) {
      for (const prop of HIDING) {
        const v = decl(rule, prop)
        if (v && hidden.includes(v)) offenders.push(rule.trim())
      }
    }

    expect(offenders, 'nothing may hide the location-failure live region').toEqual([])
    // And the base rule must positively lay it out, so "not hidden" is not
    // satisfied vacuously by the rule having been deleted altogether.
    expect(decl(row!, 'display')).toBe('flex')
  })

  it('does not hide the visible CARD either, since the card is the region\'s only child', () => {
    // The message node and the announced text are the same node here (unlike
    // SharePopup, whose announcer is a separate .sr-only span). So hiding the
    // card would empty the region's textContent just as effectively.
    for (const prop of ['display', 'visibility', 'content-visibility']) {
      const v = decl(msg!, prop)
      expect(v === 'none' || v === 'hidden' || v === 'collapse').toBe(false)
    }
    expect(decl(msg!, 'display')).toBe('flex')
  })

  it('paints from the audited error token trio and nothing hardcoded', () => {
    expect(msg).toBeTruthy()
    expect(decl(msg!, 'background')).toBe('var(--sr-error-bg)')
    expect(decl(msg!, 'color')).toBe('var(--sr-error)')
    expect(decl(msg!, 'border')).toBe('1px solid var(--sr-error-border)')
    // --sr-error on --sr-error-bg is 4.82:1 light / 7.07:1 dark, already tuned
    // and already commented at the token, so no new contrast guard is owed.
    for (const theme of [':root', '[data-theme="dark"]']) {
      const block = TOP.get(theme)!
      expect(decl(block, '--sr-error')).toBeTruthy()
      expect(decl(block, '--sr-error-bg')).toBeTruthy()
      expect(decl(block, '--sr-error-border')).toBeTruthy()
    }
    // The only literal is the shadow, which is the loading chip's verbatim so the
    // two read as one family of map chrome (the established convention for it).
    expect(decl(msg!, 'box-shadow')).toBe(decl(TOP.get('.sr-map-loading-chip')!, 'box-shadow'))
  })

  it('sizes in rem so it holds at 200% text scale', () => {
    expect(decl(msg!, 'font-size')).toBe('0.75rem')
    expect(decl(msg!, 'max-width')).toBe('28rem')
  })

  it('animates in with the house vocabulary and no per-component reduced-motion query', () => {
    expect(decl(msg!, 'animation')).toBe('sr-map-geo-in 190ms cubic-bezier(0.16, 1, 0.3, 1)')
    // The end state IS the resting state, so the app's global
    // prefers-reduced-motion block collapsing this to ~1us loses nothing. Adding
    // a local query is explicitly forbidden by the note at the Pin Share block.
    const frames = CSS.match(/@keyframes sr-map-geo-in\s*\{([\s\S]*?)\n\}/)?.[1] ?? ''
    expect(frames).toContain('opacity: 1')
    expect(frames).toContain('translateY(0)')
    expect(/@media \(prefers-reduced-motion[^}]*sr-map-geo/.test(CSS)).toBe(false)
  })
})

describe('the shipped rules this feature may not alter (FR-04)', () => {
  it('leaves .sr-share-drop-btn, .sr-map-fullscreen-btn and .sr-map-loading-chip alone', () => {
    // Pinned to the values at the time of this change, so a future edit that
    // "tidies" one of them has to say so out loud.
    expect(decl(TOP.get('.sr-map-fullscreen-btn')!, 'width')).toBe('36px')
    expect(decl(TOP.get('.sr-share-drop-btn')!, 'width')).toBe('36px')
    expect(decl(TOP.get('.sr-map-loading-chip')!, 'top')).toBe('12px')
    expect(decl(TOP.get('.sr-map-loading-chip')!, 'pointer-events')).toBe('none')
    // The --below-chip modifier the schema sketched was deliberately NOT built:
    // the message lives at the bottom of the map now, the chip at the top, so
    // they cannot collide and there is no offset to fit to one viewport.
    expect(TOP.get('.sr-map-geo-error--below-chip')).toBeUndefined()
  })

  it('keeps the iOS safe-area inset covering the cluster, so the new row inherits it', () => {
    const ios = TOP.get('.sr-ios-app .sr-map-fab-cluster')
    expect(ios).toBeTruthy()
    expect(decl(ios!, 'bottom')).toBe('calc(20px + env(safe-area-inset-bottom, 0px))')
    // Gated on .sr-ios-app, never a bare env(): index.html ships viewport-fit=cover
    // to browsers too, so an ungated rule would change shipped web rendering.
    expect(decl(TOP.get('.sr-map-fab-cluster')!, 'bottom')).toBe('20px')
  })
})
