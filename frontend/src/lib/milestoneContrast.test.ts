// Regression guard for the dark-mode milestone badges (fix: milestone-badge-dark-contrast).
// The [data-theme="dark"] --sr-milestone-* tokens must keep every badge element legible at
// WCAG 2.1 AA on the dark tile. This would have caught the original bug, where the dark block
// was a verbatim copy of the near-white :root tiles and the species name (which inherits
// --sr-text) rendered near-white-on-near-white (~1:1). We parse the REAL tokens out of
// globals.css, so any future edit that reintroduces light tiles or under-contrast text fails
// here, not in a dark-mode user's eyes. Both gradient stops are checked (worst case).
//
// THE CHECK ROWS NO LONGER GUARD THE MILESTONE BADGES (stats-badges-uniform). The badges
// stopped drawing a check glyph: only reached milestones are ever shown, so it said
// nothing. The --sr-milestone-N-check tokens are still shipped, and tier 1's is still
// read by the Frivolous Lists badges, which paint a white check on it, so the two check
// rows stay: for tier 1 they guard that surface, and for tiers 2 to 4 they keep the
// unused tokens honest until someone retires them. Do not delete the rows to tidy up.
//
// LIGHT MODE HAS ITS OWN BLOCK (code-search-and-a11y-polish). Until then this file
// parsed the dark block only, and the light tier-3 tile's species-name hover and
// focus color sat at 4.14:1 with nothing red (DECISIONS.md, 1.0.50). The name's
// hover/focus color is no longer assumed to be the accent: it is RESOLVED from the
// stylesheet the way the cascade resolves it (the badge-scoped rule when it exists,
// else the shared `.sr-birdname-link` rule; a badge-local property read from the
// tier's own rule before the badge's), so the row reads whatever the badge really
// paints and goes red on the pre-fix stylesheet.
/// <reference types="node" />
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { parseRulesAtAnyDepth } from './cssTopLevelRules'

// Assert against the REAL shipped tokens by reading the stylesheet. (Vitest stubs `.css`
// imports — `?raw` included — so we read the file directly; Node types are pulled in for this
// one test file via the reference above, matching how tsconfig.node scopes them to tooling.)
const css = readFileSync(new URL('../globals.css', import.meta.url), 'utf8')

// Isolate the [data-theme="dark"] block. CSS custom-property values contain no braces, so the
// first line-leading "}" after the opening brace closes the block.
const darkBlock = (() => {
  const start = css.indexOf('[data-theme="dark"]')
  const open = css.indexOf('{', start)
  const close = css.indexOf('\n}', open)
  if (start < 0 || open < 0 || close < 0) throw new Error('[data-theme="dark"] block not found')
  return css.slice(open, close)
})()

// The light tokens: the top-level :root block, the same first-line-leading "}" rule.
const lightBlock = (() => {
  const start = css.indexOf('\n:root {')
  const open = css.indexOf('{', start)
  const close = css.indexOf('\n}', open)
  if (start < 0 || open < 0 || close < 0) throw new Error(':root block not found')
  return css.slice(open, close)
})()
type Theme = 'light' | 'dark'
const BLOCKS: Record<Theme, string> = { light: lightBlock, dark: darkBlock }

const hexIn = (block: string, label: string) => (name: string): string => {
  // Trailing-colon anchor so --sr-text does not match --sr-text-muted, etc.
  const m = block.match(new RegExp(`--${name}:\\s*(#[0-9A-Fa-f]{6})`))
  if (!m) throw new Error(`token --${name} not found in ${label}`)
  return m[1]
}
const hexOf = hexIn(darkBlock, '[data-theme="dark"]')
const themeHex = (theme: Theme, name: string): string => hexIn(BLOCKS[theme], theme === 'dark' ? '[data-theme="dark"]' : ':root')(name)
const stopsIn = (block: string, tier: number): string[] => {
  const m = block.match(new RegExp(`--sr-milestone-${tier}-bg:\\s*linear-gradient\\([^)]*\\)`))
  if (!m) throw new Error(`--sr-milestone-${tier}-bg not found`)
  const stops = m[0].match(/#[0-9A-Fa-f]{6}/g)
  if (!stops || stops.length === 0) throw new Error(`no gradient stops in --sr-milestone-${tier}-bg`)
  return stops
}
const bgStops = (tier: number): string[] => stopsIn(darkBlock, tier)

// ── The species name's hover/focus color, as the cascade resolves it ─────────
const TOP_RULES = parseRulesAtAnyDepth(css).filter(r => r.atRules.length === 0)
/** Every top-level value of `prop` in a rule whose selector list contains `selector`, in source order. */
const declsOf = (selector: string, prop: string): string[] => {
  const re = new RegExp(`(?:^|[;{])\\s*${prop.replace(/[-]/g, '\\-')}\\s*:\\s*([^;}]+)`)
  return TOP_RULES
    .filter(r => r.selector.split(',').map(x => x.trim().replace(/\s+/g, ' ')).includes(selector))
    .map(r => re.exec(r.body)?.[1].trim())
    .filter((v): v is string => v !== undefined)
}
const lastOf = (values: string[]): string | undefined => values[values.length - 1]
const varName = (value: string | undefined): string => {
  const m = /^var\((--[\w-]+)\)$/.exec((value ?? '').trim())
  if (!m) throw new Error(`expected a single var(), got ${value}`)
  return m[1]
}
/** The token a tier's species name paints on hover and focus, before theme lookup. */
function nameHoverToken(tier: number): string {
  const hover = lastOf(declsOf('.sr-ms-name .sr-birdname-link:hover', 'color'))
  const focus = lastOf(declsOf('.sr-ms-name .sr-birdname-link:focus-visible', 'color'))
  expect(focus, 'hover and focus paint the same color').toBe(hover)
  // No badge-scoped rule: the shared (0,2,0) rule is what the name paints.
  let token = varName(hover ?? lastOf(declsOf('.sr-birdname-link:hover', 'color')))
  if (token.startsWith('--sr-ms-')) {
    // A badge-local property: the tier's own rule (0,2,0) outranks the badge's (0,1,0).
    token = varName(lastOf(declsOf(`.sr-ms-badge[data-tier="${tier}"]`, token)) ?? lastOf(declsOf('.sr-ms-badge', token)))
  }
  return token.slice(2)
}
const onTierIn = (theme: Theme, fg: string, tier: number): number =>
  Math.min(...stopsIn(BLOCKS[theme], tier).map(s => contrast(fg, s)))

const srgb = (c: number): number => { const s = c / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4 }
const lum = (hex: string): number => {
  const h = hex.replace('#', '')
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16)
  return 0.2126 * srgb(r) + 0.7152 * srgb(g) + 0.0722 * srgb(b)
}
const contrast = (a: string, b: string): number => {
  const la = lum(a), lb = lum(b)
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
}
// Worst-case contrast of a foreground over the tile's gradient (both stops).
const onTier = (fg: string, tier: number): number => Math.min(...bgStops(tier).map(s => contrast(fg, s)))

const NAME = hexOf('sr-text')      // the badge species name inherits --sr-text
const CARD = hexOf('sr-surface')   // the milestones section card surface
const WHITE = '#FFFFFF'            // the white check glyph Frivolous Lists paints on --sr-milestone-1-check (the milestone badges draw none)

describe('dark-mode milestone badge contrast (WCAG 2.1 AA)', () => {
  for (const tier of [1, 2, 3, 4]) {
    describe(`tier ${tier}`, () => {
      it('species name is legible on the tile (>=4.5:1)', () => {
        expect(onTier(NAME, tier)).toBeGreaterThanOrEqual(4.5)
      })
      it('species name hover/focus color is legible on the tile (>=4.5:1)', () => {
        expect(onTier(themeHex('dark', nameHoverToken(tier)), tier)).toBeGreaterThanOrEqual(4.5)
      })
      it('threshold number (large/bold) is legible on the tile (>=3:1)', () => {
        expect(onTier(hexOf(`sr-milestone-${tier}-num`), tier)).toBeGreaterThanOrEqual(3)
      })
      it('date link (small) is legible on the tile (>=4.5:1)', () => {
        expect(onTier(hexOf(`sr-milestone-${tier}-date`), tier)).toBeGreaterThanOrEqual(4.5)
      })
      it('white check glyph is legible on the check fill (>=3:1)', () => {
        expect(contrast(WHITE, hexOf(`sr-milestone-${tier}-check`))).toBeGreaterThanOrEqual(3)
      })
      it('check fill is distinct from the card surface (>=3:1)', () => {
        expect(contrast(hexOf(`sr-milestone-${tier}-check`), CARD)).toBeGreaterThanOrEqual(3)
      })
      it('tile is genuinely dark, not a near-white copy of light mode', () => {
        expect(Math.max(...bgStops(tier).map(lum))).toBeLessThan(0.18)
      })
    })
  }
})

describe('light-mode milestone badge contrast (WCAG 2.1 AA)', () => {
  for (const tier of [1, 2, 3, 4]) {
    describe(`tier ${tier}`, () => {
      it('species name is legible on the tile (>=4.5:1)', () => {
        expect(onTierIn('light', themeHex('light', 'sr-text'), tier)).toBeGreaterThanOrEqual(4.5)
      })
      it('species name hover/focus color is legible on the tile (>=4.5:1)', () => {
        // Light tier 3 painted --sr-accent here at 4.14:1 on its darker stop.
        expect(onTierIn('light', themeHex('light', nameHoverToken(tier)), tier)).toBeGreaterThanOrEqual(4.5)
      })
      it('threshold number (large/bold) is legible on the tile (>=3:1)', () => {
        expect(onTierIn('light', themeHex('light', `sr-milestone-${tier}-num`), tier)).toBeGreaterThanOrEqual(3)
      })
      it('date link (small) is legible on the tile (>=4.5:1)', () => {
        expect(onTierIn('light', themeHex('light', `sr-milestone-${tier}-date`), tier)).toBeGreaterThanOrEqual(4.5)
      })
    })
  }
})

describe('the hover/focus color change reaches light tier 3 alone', () => {
  it('every other tier, and dark tier 3, still paints exactly --sr-accent', () => {
    for (const theme of ['light', 'dark'] as const) {
      const accent = themeHex(theme, 'sr-accent')
      for (const tier of [1, 2, 3, 4]) {
        if (theme === 'light' && tier === 3) continue
        expect(themeHex(theme, nameHoverToken(tier)), `${theme} tier ${tier}`).toBe(accent)
      }
    }
    expect(themeHex('light', nameHoverToken(3))).not.toBe(themeHex('light', 'sr-accent'))
  })

  it('the resolver reads the stylesheet, not a constant (non-vacuity)', () => {
    // Without the badge-scoped rule the shared rule's --sr-accent is what paints,
    // which is the pre-fix value and the reason the light tier-3 row would go red.
    expect(declsOf('.sr-birdname-link:hover', 'color')).toContain('var(--sr-accent)')
    expect(nameHoverToken(3)).toBe('sr-milestone-3-link')
    expect(nameHoverToken(1)).toBe('sr-accent')
  })
})
