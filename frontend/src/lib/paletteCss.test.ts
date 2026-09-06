/// <reference types="node" />
// The command palette's stylesheet contract (NFR-05, NFR-09, QA-36, QA-60).
//
// WHAT A STYLESHEET TEST CAN AND CANNOT SETTLE, stated up front because this
// repo has been burned by the difference. It proves a rule EXISTS, is scoped,
// and carries the declarations it must. It cannot prove the rule WINS against an
// inline style, and it cannot see geometry at all -- so the 320px / 200% layout
// (QA-59), the AA contrast measurements and the accessibility tree are browser
// work, in Chromium AND WebKit, on the production build.
//
// Selector questions go through the shared `parseTopLevelRules`; the two OFFSET
// questions at the end (is this declaration inside a 640px tier? does that tier
// come after the base rule it must beat?) keep a local walker, because a
// selector-to-body map that skips at-rule blocks whole structurally cannot
// answer them. That split is per QUESTION, not per file, exactly as
// `breedingCodePinnedCss.test.ts` does it.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { parseTopLevelRules } from './cssTopLevelRules'

const CSS = readFileSync(new URL('../globals.css', import.meta.url), 'utf8')
const RULES = parseTopLevelRules(CSS)

/**
 * One rule's declaration body, by EXACT selector.
 *
 * Throws rather than returning `undefined` on a miss: a guard that reads an
 * absent rule and compares it with `?? ''` passes vacuously on the very rename
 * or deletion it exists to catch (`.claude/rules/testing.md`, the exact-selector
 * rule and its `:root`-unreachable precedent).
 */
function rule(selector: string): string {
  const body = RULES.get(selector)
  if (body === undefined) throw new Error(`no top-level rule for ${selector}`)
  return body
}

/** Every top-level rule whose rightmost compound is one of the feature's classes. */
const PALETTE_SELECTORS = [...RULES.keys()].filter(sel =>
  sel.split(',').some(s => /(^|[\s>])\.sr-(palette|nav-search)[a-z-]*(:[a-z-]+)?$/.test(s.trim())),
)

/** The feature's own DECLARATIONS, comments stripped, as one block of text. */
const PALETTE_CSS = (() => {
  // The whole section, from its first rule to the end of the file: the base
  // rules, the ≤640 tier and the local reduced-motion block. A slice rather than
  // a reassembly from the parser, because two of the three are at-rule blocks
  // the parser skips whole.
  //
  // COMMENTS ARE STRIPPED FIRST AND THE SLICE STARTS AT A RULE, not at the
  // section banner. Anchoring inside the banner comment leaves its unmatched
  // tail in the slice, and this file's own explanation of the colour forms it
  // forbids then matches the scan that forbids them -- the comment-hijack trap,
  // in the direction that fails a correct stylesheet.
  const clean = CSS.replace(/\/\*[\s\S]*?\*\//g, '')
  const start = clean.indexOf('\n.sr-nav-search {')
  if (start < 0) throw new Error('could not locate the command-palette CSS section')
  return clean.slice(start)
})()

describe('tokens only, in both themes (NFR-05, QA-60)', () => {
  it('the feature declares no hex, rgb() or rgba() colour anywhere', () => {
    expect(PALETTE_CSS).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
    expect(PALETTE_CSS).not.toMatch(/\brgba?\(/)
  })

  it('and every colour it does declare resolves from a token defined in BOTH themes', () => {
    // The two token blocks, read through the parser rather than by slicing the
    // file between two indexOf hits: `[data-theme="dark"]` appears in prose long
    // before the block it names, which would silently cut the light block short.
    const light = rule(':root')
    const dark = rule('[data-theme="dark"]')
    const used = new Set([...PALETTE_CSS.matchAll(/var\((--sr-[a-z0-9-]+)/g)].map(m => m[1]))
    // Non-vacuity: the scan found real tokens rather than an empty set.
    expect(used.size).toBeGreaterThan(8)
    for (const token of used) {
      expect(`${token} in :root`).toBe(light.includes(`${token}:`) ? `${token} in :root` : 'MISSING')
      expect(`${token} in dark`).toBe(dark.includes(`${token}:`) ? `${token} in dark` : 'MISSING')
    }
  })

  it('uses the shared scrim on the backdrop rather than re-inlining one', () => {
    expect(rule('.sr-palette-root')).toContain('background: var(--sr-scrim)')
  })

  it('overrides nothing about the shipped input focus ring', () => {
    // The field is bordered precisely so the global `input:focus-visible` ring
    // hugs a real border and NOTHING is overridden -- which is why there is no
    // `.sr-palette-input:focus-visible` rule at all. A rule here would be an
    // override of the app's one focus treatment, a real accessibility risk for a
    // cosmetic gain.
    expect(PALETTE_SELECTORS.filter(s => s.includes('.sr-palette-input:focus'))).toEqual([])
    expect(PALETTE_CSS).not.toContain('focus-visible')
  })
})

describe('the live region is never hidden (FR-37, QA-36)', () => {
  // `display: none` on a role="status" region removes it from the accessibility
  // tree entirely, so it is INSERTED ALONG WITH ITS FIRST MESSAGE -- the same
  // trap as creating it with its text, by another route. It is invisible to
  // every layout measurement, to a textContent assertion, and to jsdom (which
  // loads no stylesheet), so this scan is necessary and the browser leg is what
  // makes it sufficient.
  const ANCESTORS = ['.sr-palette-status', '.sr-palette-results', '.sr-palette-panel', '.sr-palette-root']

  it.each(ANCESTORS)('no rule sets a hiding value on %s or on it as an ancestor', selector => {
    const touching = PALETTE_SELECTORS.filter(sel =>
      sel.split(',').some(s => s.trim() === selector || s.trim().startsWith(`${selector} `) || s.trim().startsWith(`${selector}.`)),
    )
    // Non-vacuity: this selector really is in the stylesheet, so a scan that
    // matched nothing fails loudly rather than passing as clean.
    expect(touching.length).toBeGreaterThan(0)
    for (const sel of touching) {
      const body = (RULES.get(sel) ?? '')
      expect(`${sel}: ${/display\s*:\s*none/.test(body)}`).toBe(`${sel}: false`)
      expect(`${sel}: ${/visibility\s*:\s*hidden/.test(body)}`).toBe(`${sel}: false`)
      expect(`${sel}: ${/content-visibility\s*:\s*hidden/.test(body)}`).toBe(`${sel}: false`)
    }
  })

  it('and the region carries a POSITIVE display, so the scan cannot pass by the rule being deleted', () => {
    expect(rule('.sr-palette-status')).toContain('display: block')
  })

  it('the idle region computes to zero height WITHOUT being hidden: all of it lives on the child', () => {
    // The mechanism behind the rule above. Padding and typography sit on
    // `.sr-palette-status-line`, which only exists when there is a sentence.
    expect(rule('.sr-palette-status')).not.toMatch(/padding|font-size|min-height/)
    expect(rule('.sr-palette-status-line')).toMatch(/padding:/)
  })
})

describe('motion (NFR-09, QA-64)', () => {
  it('reuses the shipped listbox entrance rather than introducing a curve', () => {
    const panel = rule('.sr-palette-panel')
    expect(panel).toContain('cubic-bezier(0.2, 0, 0, 1)')
    expect(panel).toContain('140ms')
    expect(panel).toContain('transform-origin: top center')
    // Byte-identical timing to the shipped picker, so the two cannot drift.
    expect(rule('.sr-combobox-list')).toContain('140ms cubic-bezier(0.2, 0, 0, 1)')
  })

  it('the scrim uses the shipped sheet/dialog fade', () => {
    expect(rule('.sr-palette-root')).toContain('160ms ease-out')
  })

  it('the ACTIVE option carries no transition, so an arrow key moves it in the same frame', () => {
    expect(rule('.sr-palette-row--active')).toContain('transition: none')
    // ...and it follows the hover rule at equal specificity, which is what makes
    // it win rather than being a coincidence of source order nobody stated.
    expect(PALETTE_CSS.indexOf('.sr-palette-row--active'))
      .toBeGreaterThan(PALETTE_CSS.indexOf('.sr-palette-row:hover'))
  })

  it('states the reduced-motion guarantee locally as well as globally', () => {
    const local = PALETTE_CSS.slice(PALETTE_CSS.lastIndexOf('@media (prefers-reduced-motion: reduce)'))
    expect(local).toContain('.sr-palette-root, .sr-palette-panel { animation: none; }')
    expect(local).toMatch(/\.sr-palette-row,[^}]*transition: none/)
  })
})

describe('the shipped row proportions are carried, not re-derived (FR-27)', () => {
  it('primary flex 1, secondary flex 0 1 auto PLUS a percentage cap, truncation on both', () => {
    // The four load-bearing bits of the species picker's row. Without the cap,
    // flex serves the SECONDARY its full intrinsic width first (basis auto
    // against the primary's basis 0) and a long scientific name crushes the
    // common name toward a zero-width box -- measured at 0px at 200% text scale
    // on the first narrow consumer of the shipped picker.
    const name = rule('.sr-palette-row-name')
    const sci = rule('.sr-palette-row-sci')
    expect(name).toMatch(/flex:\s*1/)
    expect(sci).toMatch(/flex:\s*0 1 auto/)
    expect(sci).toContain('max-width: 40%')
    for (const body of [name, sci]) {
      expect(body).toContain('text-overflow: ellipsis')
      expect(body).toContain('white-space: nowrap')
      expect(body).toContain('min-width: 0')
    }
  })
})

describe('the iOS safe area is GATED, never a bare env() (the standing rule)', () => {
  it('the base overlay rule contains no env(), so web rendering is byte-identical', () => {
    // index.html ships viewport-fit=cover to browsers too, so an ungated env()
    // is non-zero in iOS Safari on the WEB build and would silently change
    // shipped rendering on every notched phone.
    expect(rule('.sr-palette-root')).not.toContain('env(')
    expect(rule('.sr-palette-panel')).not.toContain('env(')
  })

  it('and every env() the feature declares is behind .sr-ios-app', () => {
    for (const line of PALETTE_CSS.split('\n')) {
      if (!line.includes('env(safe-area-inset')) continue
      expect(`${line.trim()} :: gated`).toBe(
        line.includes('.sr-ios-app') || /^\s{2}\.sr-ios-app/.test(line) ? `${line.trim()} :: gated` : `${line.trim()} :: UNGATED`,
      )
    }
    // Non-vacuity: the feature really does declare some.
    expect(PALETTE_CSS).toContain('env(safe-area-inset-top, 0px)')
    expect(PALETTE_CSS).toContain('env(safe-area-inset-bottom, 0px)')
  })

  it('every env() keeps its 0px fallback, so the declaration stays valid where it is unsupported', () => {
    for (const m of PALETTE_CSS.matchAll(/env\(safe-area-inset-[a-z]+([^)]*)\)/g)) {
      expect(m[0]).toContain(', 0px')
    }
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// The two OFFSET questions, which a selector→body map cannot answer
// ─────────────────────────────────────────────────────────────────────────────

describe('the phone tier', () => {
  /** Index of the first multi-line 640px block: what the repo's tier guards resolve. */
  const firstTier = (() => {
    const re = /@media \(max-width: 640px\) \{\s*\n/g
    const m = re.exec(CSS)
    if (!m) throw new Error('could not locate the established phone tier')
    return m.index
  })()
  const paletteTier = CSS.lastIndexOf('@media (max-width: 640px)')

  it('the palette\'s own 640px block sits AFTER the established tier, not ahead of it', () => {
    // Ahead of it would silently re-target every offset-based tier assertion in
    // the repo at a block carrying none of the declarations they guard -- the
    // v1.0.10 defect. After it is what `.sr-ssx-toggle` already does.
    expect(paletteTier).toBeGreaterThan(firstTier)
  })

  it('and AFTER the base rules it has to beat, since both are equal specificity', () => {
    // This is why the phone rules are not in the established tier: the base
    // rules are the last in the file, so a phone rule placed earlier would lose
    // on source order and the full-height sheet would silently never apply.
    expect(paletteTier).toBeGreaterThan(CSS.indexOf('.sr-palette-panel {'))
    expect(paletteTier).toBeGreaterThan(CSS.indexOf('.sr-palette-row {'))
  })

  it('makes the panel a full-height sheet with the 44px touch posture in rem', () => {
    const tier = CSS.slice(paletteTier, CSS.indexOf('\n}', paletteTier))
    expect(tier).toMatch(/\.sr-palette-panel \{[^}]*height: 100%/)
    expect(tier).toMatch(/\.sr-palette-panel \{[^}]*border-radius: 0/)
    // rem, never px, so the touch target holds at 200% in-app text scale.
    expect(tier).toContain('.sr-palette-row { min-height: 2.75rem; }')
    expect(tier).toContain('.sr-palette-close { width: 2.75rem; height: 2.75rem; }')
  })
})

describe('z-index 1280 is reasoned rather than nominal', () => {
  it('rises over the More sheet and the rail tooltip, and sits under the skip link', () => {
    expect(rule('.sr-palette-root')).toContain('z-index: 1280')
    const z = (sel: string) => Number(/z-index:\s*(\d+)/.exec((RULES.get(sel) ?? ''))?.[1])
    expect(z('.sr-palette-root')).toBeGreaterThan(z('.sr-nav-sheet-root'))
    expect(z('.sr-palette-root')).toBeGreaterThan(z('.sr-nav-tip'))
    // Under the skip link (its z-index lives on the base rule; `:focus` only
    // moves its `top`), which is harmless: the link is parked off-screen until
    // focused and the focus trap makes it unreachable while the palette is open.
    expect(z('.sr-palette-root')).toBeLessThan(z('.sr-skip-link'))
  })
})
