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

// ── The shared circular-FAB base (feature: uniform-map-fabs) ─────────────────
//
// This block REPLACES the old "the duplicate stays a duplicate" guard, which
// existed because FR-04 forbade altering the two shipped FAB rules and which
// named its own successor: "a FIFTH map FAB should force the extraction of a
// shared base class, in a change whose scope permits touching the two shipped
// rules." This change's scope does, and this is that extraction.
//
// NOTE ON WHAT THE ORDER TEST BELOW ANSWERS. CLAUDE.md's cascade-competitor
// convention was written for an INLINE-to-class move, where specificity DROPS
// from (1,0,0) to (0,1,0) and every other rule in the stylesheet gains a chance
// to win. This is a CLASS-to-class move: specificity is unchanged at (0,1,0) on
// every declaration. So the risk here is not a specificity drop, it is the
// SOURCE ORDER of same-specificity rules — which the scan for outside
// competitors (lib/mapFabCascade.test.ts) cannot see and this test owns.
describe('the .sr-map-fab base class', () => {
  const base = TOP.get('.sr-map-fab')
  const glyph = TOP.get('.sr-map-fab svg')
  const std = TOP.get('.sr-map-fab--std')
  const compact = TOP.get('.sr-map-fab--compact')
  const order = [...TOP.keys()]
  const at = (selector: string) => {
    const i = order.indexOf(selector)
    expect(i, `${selector} must be a top-level rule`).toBeGreaterThanOrEqual(0)
    return i
  }

  it('carries every shared, size-independent declaration, at top level', () => {
    expect(base).toBeTruthy()
    expect(decl(base!, 'display')).toBe('inline-flex')
    expect(decl(base!, 'align-items')).toBe('center')
    expect(decl(base!, 'justify-content')).toBe('center')
    expect(decl(base!, 'padding')).toBe('0')
    expect(decl(base!, 'flex')).toBe('none')
    expect(decl(base!, 'background')).toBe('var(--sr-surface)')
    expect(decl(base!, 'color')).toBe('var(--sr-text)')
    expect(decl(base!, 'border')).toBe('1px solid var(--sr-border)')
    expect(decl(base!, 'border-radius')).toBe('50%')
    expect(decl(base!, 'cursor')).toBe('pointer')
    expect(decl(base!, 'box-shadow')).toBe('0 4px 12px rgba(0, 0, 0, 0.18)')
    expect(decl(base!, 'transition')).toContain('cubic-bezier(0.16, 1, 0.3, 1)')
    // Size lives on the modifiers, never here: an element carrying the base and
    // a modifier has two (0,1,0) rules, and a width in both would make the
    // diameter depend on which one happened to come last.
    expect(decl(base!, 'width')).toBeUndefined()
    expect(decl(base!, 'height')).toBeUndefined()
  })

  it('replaces the three hand-duplicated copies rather than adding a fourth', () => {
    // The whole point: these three rules must no longer exist as circle
    // definitions. .sr-share-drop-btn survives ONLY as [aria-pressed], and
    // .sr-map-locate-btn ONLY as [aria-disabled] — asserted below.
    expect(TOP.get('.sr-map-fullscreen-btn')).toBeUndefined()
    expect(TOP.get('.sr-share-drop-btn')).toBeUndefined()
    expect(TOP.get('.sr-map-locate-btn')).toBeUndefined()
    expect(TOP.get('.sr-share-drop-btn--compact')).toBeUndefined()
    // ...and the phone tier carries the two modifiers, not three per-control
    // entries, so a control cannot be left behind at 36px the way the fullscreen
    // button was.
    const phone = mediaTier(640)
    expect(/\.sr-map-locate-btn\s*\{/.test(phone)).toBe(false)
    expect(/\.sr-share-drop-btn\s*\{/.test(phone)).toBe(false)
    expect(/\.sr-map-fullscreen-btn\s*\{/.test(phone)).toBe(false)
  })

  it('sizes the glyph in the same unit as the box, so the ratio survives 200% text scale', () => {
    // THE UNIT RULE. lucide's size= prop renders a px width/height ATTRIBUTE, so
    // before this a phone FAB grew 44px -> 88px at 200% while its glyph stayed
    // 17px. Both are rem now and the ratio is scale-invariant by construction.
    expect(glyph).toBeTruthy()
    expect(decl(glyph!, 'width')).toBe('var(--sr-fab-glyph)')
    expect(decl(glyph!, 'height')).toBe('var(--sr-fab-glyph)')
    // No fallback value: a base with no size modifier is a mistake and should
    // look like one. (The component test asserts every disc carries exactly one.)
    expect(decl(glyph!, 'width')).not.toContain(',')
    for (const [sel, body] of [['--std', std], ['--compact', compact]] as const) {
      expect(decl(body!, '--sr-fab-glyph'), sel).toMatch(/rem$/)
    }
  })

  it('keeps every 1x value byte-identical to the rules it replaced', () => {
    // 2.25rem = 36px, 1.875rem = 30px, 1.0625rem = 17px, 0.9375rem = 15px — the
    // exact numbers the three duplicated rules and the two lucide size= props
    // carried. The extraction is therefore provable as a byte-identical render
    // on every surface except the one control this change intends to move.
    expect(decl(std!, 'width')).toBe('2.25rem')
    expect(decl(std!, 'height')).toBe('2.25rem')
    expect(decl(std!, '--sr-fab-glyph')).toBe('1.0625rem')
    expect(decl(compact!, 'width')).toBe('1.875rem')
    expect(decl(compact!, 'height')).toBe('1.875rem')
    expect(decl(compact!, '--sr-fab-glyph')).toBe('0.9375rem')
  })

  it('gives every disc the ~44px phone posture, including the fullscreen button', () => {
    const phone = mediaTier(640)
    const stdPhone = phone.match(/\.sr-map-fab--std\s*\{([^}]*)\}/)?.[1]
    const compactPhone = phone.match(/\.sr-map-fab--compact\s*\{([^}]*)\}/)?.[1]
    expect(stdPhone).toBeTruthy()
    // rem, not px, so it holds at 200% in-app text scale.
    expect(decl(stdPhone!, 'width')).toBe('2.75rem')
    expect(decl(stdPhone!, 'height')).toBe('2.75rem')
    expect(decl(compactPhone!, 'width')).toBe('2.5rem')
    expect(decl(compactPhone!, 'height')).toBe('2.5rem')
    // The glyph is NOT re-declared here: it tracks the box through the custom
    // property, which is what keeps the ratio identical at 1x and at 200%.
    expect(decl(stdPhone!, '--sr-fab-glyph')).toBeUndefined()
  })

  /**
   * THE ONE THAT MATTERS in this block. A shared base plus a modifier puts two
   * same-specificity rules on one element, so SOURCE ORDER decides, and one
   * ordering is a live defect rather than a style preference:
   *
   *   .sr-map-fab:hover                        (0,2,0), sets `background`
   *   .sr-share-drop-btn[aria-pressed="true"]  (0,2,0), sets `background`
   *
   * Both match a hovered, pinned share button. Today the pressed rule is later
   * and wins, which is what makes a pinned button stay green under the cursor.
   * Lift the per-control state rules above the base block — the natural thing to
   * do when "grouping the FAB rules together" — and the hover silently wins
   * instead, dropping the green tint. No value diff would catch it, so the guard
   * has to be about position.
   *
   * Written against parseTopLevelRules' insertion order (which is source order)
   * rather than a substring search, because `.sr-map-fab` is a prefix of
   * `.sr-map-fab-cluster` and `.sr-map-fab-slot` and an indexOf would find the
   * wrong rule.
   */
  it('is ordered base, glyph, hover, size, state, phone tier (and the order is load-bearing)', () => {
    expect(at('.sr-map-fab')).toBeLessThan(at('.sr-map-fab svg'))
    expect(at('.sr-map-fab svg')).toBeLessThan(at('.sr-map-fab:hover'))
    expect(at('.sr-map-fab:hover')).toBeLessThan(at('.sr-map-fab--std'))
    expect(at('.sr-map-fab--std')).toBeLessThan(at('.sr-map-fab--compact'))

    // Step 3 before step 5, per control. These are the rules that must beat the
    // base's hover, and the ONLY thing that makes them do so is coming later.
    for (const state of [
      '.sr-share-drop-btn[aria-pressed="true"]',
      '.sr-map-center-share-btn[aria-expanded="true"]',
      '.sr-map-center-share-btn[aria-disabled="true"]',
      '.sr-map-locate-btn[aria-disabled="true"]',
    ]) {
      expect(at('.sr-map-fab:hover'), `${state} must come after the base hover`)
        .toBeLessThan(at(state))
      expect(at('.sr-map-fab--compact'), `${state} must come after the size modifiers`)
        .toBeLessThan(at(state))
    }

    // ...and the phone tier last of all, or a base-tier width would re-beat it.
    const marker = '@media (max-width: 640px)'
    let tierStart = -1
    for (let i = CSS.indexOf(marker); i !== -1; i = CSS.indexOf(marker, i + 1)) {
      const open = CSS.indexOf('{', i)
      let depth = 1
      let j = open + 1
      while (j < CSS.length && depth > 0) {
        if (CSS[j] === '{') depth++
        else if (CSS[j] === '}') depth--
        j++
      }
      if (CSS.slice(open, j).includes('.sr-map-fab--std')) { tierStart = i; break }
    }
    expect(tierStart, 'the phone tier must carry the size modifiers').toBeGreaterThan(-1)
    expect(CSS.search(/(^|\n)\.sr-map-fab\s*\{/m)).toBeLessThan(tierStart)
  })
})

describe('.sr-map-locate-btn keeps only its own state', () => {
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

// ── The centre-share FAB (feature: uniform-map-fabs) ─────────────────────────
describe('.sr-map-center-share-btn', () => {
  const expanded = TOP.get('.sr-map-center-share-btn[aria-expanded="true"]')
  const off = TOP.get('.sr-map-center-share-btn[aria-disabled="true"]')

  it('wears the app\'s active tint on aria-EXPANDED, not aria-pressed', () => {
    // Same three values as the share button's pressed state — one app, one
    // active convention — on a different carrier with a different meaning. The
    // share button's aria-pressed means "this map is holding a pin", a property
    // of the map; this one holds nothing, it discloses a popup. The two can
    // never be on screen together, so one green disc never means two things.
    expect(expanded).toBeTruthy()
    const pressed = TOP.get('.sr-share-drop-btn[aria-pressed="true"]')!
    for (const prop of ['background', 'color', 'border-color']) {
      expect(decl(expanded!, prop), prop).toBe(decl(pressed, prop))
    }
    expect(decl(expanded!, 'background')).toBe('var(--sr-accent-bg)')
    // aria-pressed on this control would be the semantic collision the carrier
    // split exists to avoid.
    expect(TOP.get('.sr-map-center-share-btn[aria-pressed="true"]')).toBeUndefined()
  })

  it('carries the no-centre state as SHAPE first, with identical geometry', () => {
    expect(off).toBeTruthy()
    // Dashed, not merely greyed: shape first, colour second, motion third — the
    // same ordering the locate button's busy state uses.
    const shorthand = decl(off!, 'border')
    expect(`${shorthand ?? ''} ${decl(off!, 'border-style') ?? ''}`).toContain('dashed')
    // ...and the GEOMETRY stays byte-identical to the ready state, so the row
    // cannot shift when a centre is set. Written about the border WIDTH rather
    // than about which spelling was used: `border-style: dashed` and
    // `border: 1px dashed …` are equally correct here, and a guard that rejects
    // one of them is testing a preference, not the requirement.
    if (shorthand !== undefined) expect(shorthand).toMatch(/(^|\s)1px(\s|$)/)
    const borderWidth = decl(off!, 'border-width')
    if (borderWidth !== undefined) expect(borderWidth).toBe('1px')
    expect(decl(off!, 'width')).toBeUndefined()
    expect(decl(off!, 'height')).toBeUndefined()
    expect(decl(off!, 'padding')).toBeUndefined()
    expect(decl(off!, 'cursor')).toBe('default')
    expect(decl(TOP.get('.sr-map-center-share-btn[aria-disabled="true"] svg')!, 'color'))
      .toBe('var(--sr-text-disabled)')
  })

  it('suppresses hover feedback while disabled, on specificity rather than order', () => {
    // (0,3,0) against the base hover's (0,2,0), so this one rule holds wherever
    // the two sit relative to each other — deliberately the one member of this
    // family that does not depend on source order.
    const offHover = TOP.get('.sr-map-center-share-btn[aria-disabled="true"]:hover')
    expect(offHover).toBeTruthy()
    expect(decl(offHover!, 'background')).toBe('var(--sr-surface)')
    expect(decl(TOP.get('.sr-map-fab:hover')!, 'background')).toBe('var(--sr-surface-subtle)')
  })

  it('never uses :disabled, which would drop focus off the control', () => {
    expect(TOP.get('.sr-map-center-share-btn:disabled')).toBeUndefined()
    for (const [selector] of TOP) {
      expect(selector, 'no :disabled on any map FAB')
        .not.toMatch(/^\.sr-map-(fab|center-share-btn|locate-btn|fullscreen-btn)[^ ]*:disabled/)
    }
  })

  it('introduces no new token', () => {
    // Every value it paints with already existed, so no new parse-the-tokens
    // contrast guard is owed here.
    for (const token of ['--sr-accent-bg', '--sr-accent', '--sr-accent-border-strong', '--sr-text-disabled', '--sr-surface']) {
      for (const theme of [':root', '[data-theme="dark"]']) {
        expect(decl(TOP.get(theme)!, token), `${token} in ${theme}`).toBeTruthy()
      }
    }
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

describe('the rules around the cluster that stay put', () => {
  it('leaves .sr-map-loading-chip alone', () => {
    // map-location-buttons' FR-04 also pinned .sr-share-drop-btn and
    // .sr-map-fullscreen-btn to `width: 36px` HERE, because that feature was
    // forbidden from touching the two shipped FAB rules. uniform-map-fabs lifted
    // that constraint deliberately: both rules are gone, their 36px lives on as
    // .sr-map-fab--std's 2.25rem, and the base-class block above is where those
    // values are now pinned. The chip is unrelated and still pinned here.
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
