// AA-contrast guard for the Calendar day-shade ramp (schema.md §1 / NFR-05). Unlike
// the county ramp (which carries NO on-fill text), the calendar cells carry a WHITE
// day NUMBER, so this guard adds the assertion countyContrast.test.ts deliberately
// omits: --sr-cal-fg must clear 4.5:1 against EVERY tier fill in BOTH themes. It
// also re-asserts the ramp is monotonic light→dark, adjacency ≥ 1.2:1, the
// present-but-zero pair (--sr-text-muted on --sr-surface-subtle) ≥ 4.5:1, and the
// legend text (--sr-text on --sr-surface) ≥ 4.5:1, both themes.
//
// We parse the REAL tokens out of globals.css (vitest stubs CSS ?raw imports), so a
// future edit that flattens the ramp or breaks AA fails here — the milestoneContrast
// guard pattern.
/// <reference types="node" />
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const css = readFileSync(new URL('../globals.css', import.meta.url), 'utf8')

function block(selector: string): string {
  const start = css.indexOf(selector)
  const open = css.indexOf('{', start)
  const close = css.indexOf('\n}', open)
  if (start < 0 || open < 0 || close < 0) throw new Error(`${selector} block not found`)
  return css.slice(open, close)
}
const rootBlock = block(':root')
const darkBlock = block('[data-theme="dark"]')

const hexOf = (where: string, name: string): string => {
  const m = where.match(new RegExp(`--${name}:\\s*(#[0-9A-Fa-f]{6})`))
  if (!m) throw new Error(`token --${name} not found`)
  return m[1]
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

const TIERS = [1, 2, 3, 4, 5] as const

describe('--sr-cal day-shade ramp (NFR-05)', () => {
  it('is declared identically in both themes (deep green, theme-identical)', () => {
    for (const t of TIERS) {
      expect(hexOf(rootBlock, `sr-cal-${t}`)).toBe(hexOf(darkBlock, `sr-cal-${t}`))
    }
    expect(hexOf(rootBlock, 'sr-cal-fg')).toBe(hexOf(darkBlock, 'sr-cal-fg'))
  })

  it('is a monotonic light→dark sequence', () => {
    const lums = TIERS.map(t => lum(hexOf(rootBlock, `sr-cal-${t}`)))
    for (let i = 1; i < lums.length; i++) expect(lums[i]).toBeLessThan(lums[i - 1])
  })

  it('keeps adjacent tiers visually distinct (≥1.2:1)', () => {
    for (let i = 1; i < TIERS.length; i++) {
      const c = contrast(hexOf(rootBlock, `sr-cal-${TIERS[i]}`), hexOf(rootBlock, `sr-cal-${TIERS[i - 1]}`))
      expect(c).toBeGreaterThanOrEqual(1.2)
    }
  })

  it('the white on-cell number (--sr-cal-fg) clears 4.5:1 on EVERY tier in BOTH themes', () => {
    for (const b of [rootBlock, darkBlock]) {
      const fg = hexOf(b, 'sr-cal-fg')
      for (const t of TIERS) {
        const c = contrast(fg, hexOf(b, `sr-cal-${t}`))
        expect(c).toBeGreaterThanOrEqual(4.5)
      }
    }
  })

  it('the present-but-zero pair (--sr-text-muted on --sr-surface-subtle) passes AA in both themes', () => {
    for (const b of [rootBlock, darkBlock]) {
      expect(contrast(hexOf(b, 'sr-text-muted'), hexOf(b, 'sr-surface-subtle'))).toBeGreaterThanOrEqual(4.5)
    }
  })

  it('the legend text (--sr-text on --sr-surface) passes AA in both themes', () => {
    for (const b of [rootBlock, darkBlock]) {
      expect(contrast(hexOf(b, 'sr-text'), hexOf(b, 'sr-surface'))).toBeGreaterThanOrEqual(4.5)
    }
  })

  it('the -rgb triplets are present (the DOM crosshatch reads these) in both themes', () => {
    for (const t of TIERS) {
      expect(rootBlock).toMatch(new RegExp(`--sr-cal-${t}-rgb:\\s*\\d+,\\d+,\\d+`))
      expect(darkBlock).toMatch(new RegExp(`--sr-cal-${t}-rgb:\\s*\\d+,\\d+,\\d+`))
    }
  })
})
