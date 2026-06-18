// Regression guard for the dark-mode milestone badges (fix: milestone-badge-dark-contrast).
// The [data-theme="dark"] --sr-milestone-* tokens must keep every badge element legible at
// WCAG 2.1 AA on the dark tile. This would have caught the original bug, where the dark block
// was a verbatim copy of the near-white :root tiles and the species name (which inherits
// --sr-text) rendered near-white-on-near-white (~1:1). We parse the REAL tokens out of
// globals.css, so any future edit that reintroduces light tiles or under-contrast text fails
// here, not in a dark-mode user's eyes. Both gradient stops are checked (worst case).
/// <reference types="node" />
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

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

const hexOf = (name: string): string => {
  // Trailing-colon anchor so --sr-text does not match --sr-text-muted, etc.
  const m = darkBlock.match(new RegExp(`--${name}:\\s*(#[0-9A-Fa-f]{6})`))
  if (!m) throw new Error(`token --${name} not found in [data-theme="dark"]`)
  return m[1]
}
const bgStops = (tier: number): string[] => {
  const m = darkBlock.match(new RegExp(`--sr-milestone-${tier}-bg:\\s*linear-gradient\\([^)]*\\)`))
  if (!m) throw new Error(`--sr-milestone-${tier}-bg not found`)
  const stops = m[0].match(/#[0-9A-Fa-f]{6}/g)
  if (!stops || stops.length === 0) throw new Error(`no gradient stops in --sr-milestone-${tier}-bg`)
  return stops
}

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
const ACCENT = hexOf('sr-accent')  // link hover/focus colour
const CARD = hexOf('sr-surface')   // the milestones section card surface
const WHITE = '#FFFFFF'            // the hardcoded check (✓) glyph

describe('dark-mode milestone badge contrast (WCAG 2.1 AA)', () => {
  for (const tier of [1, 2, 3, 4]) {
    describe(`tier ${tier}`, () => {
      it('species name is legible on the tile (>=4.5:1)', () => {
        expect(onTier(NAME, tier)).toBeGreaterThanOrEqual(4.5)
      })
      it('link hover/focus accent is legible on the tile (>=4.5:1)', () => {
        expect(onTier(ACCENT, tier)).toBeGreaterThanOrEqual(4.5)
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
