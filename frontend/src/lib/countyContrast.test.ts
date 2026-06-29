// AA-contrast guard for the County Lines & Shading green ramp (decisions.md D-01).
// The choropleth fills carry NO on-fill text (names live in the popup and the
// in-view panel, FR-07), so there is no on-fill text pair to check — but the new
// --sr-county-1..4 tokens still owe two things the design promised (NFR-07):
//   1. The ramp must be a genuine, monotonic light→dark sequence (so the
//      choropleth reads as a magnitude ramp and each tier is distinguishable).
//   2. Each fill must be distinct from its neighbour by a non-text margin (≥1.2:1
//      adjacent contrast — a sequential-ramp legibility floor) so adjacent tiers
//      don't blur into one on the light basemap.
//   3. The legend's range text (--sr-text on --sr-surface) stays AA in BOTH themes.
// We parse the REAL tokens out of globals.css (vitest stubs CSS imports), so a
// future edit that flattens the ramp or breaks the legend text fails here.
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

const TIERS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const

describe('--sr-county green ramp (D-01)', () => {
  it('is declared identically in both themes (basemap-anchored)', () => {
    for (const t of TIERS) {
      expect(hexOf(rootBlock, `sr-county-${t}`)).toBe(hexOf(darkBlock, `sr-county-${t}`))
    }
  })

  it('is a monotonic light→dark sequence', () => {
    const lums = TIERS.map(t => lum(hexOf(rootBlock, `sr-county-${t}`)))
    for (let i = 1; i < lums.length; i++) expect(lums[i]).toBeLessThan(lums[i - 1])
  })

  it('keeps adjacent tiers visually distinct (≥1.2:1)', () => {
    for (let i = 1; i < TIERS.length; i++) {
      const c = contrast(hexOf(rootBlock, `sr-county-${TIERS[i]}`), hexOf(rootBlock, `sr-county-${TIERS[i - 1]}`))
      expect(c).toBeGreaterThanOrEqual(1.2)
    }
  })

  it('the legend range text (--sr-text on --sr-surface) passes AA in both themes', () => {
    for (const b of [rootBlock, darkBlock]) {
      expect(contrast(hexOf(b, 'sr-text'), hexOf(b, 'sr-surface'))).toBeGreaterThanOrEqual(4.5)
    }
  })

  it('the -rgb triplets are present for GL paint use', () => {
    for (const t of TIERS) {
      expect(rootBlock).toMatch(new RegExp(`--sr-county-${t}-rgb:\\s*\\d+,\\d+,\\d+`))
      expect(darkBlock).toMatch(new RegExp(`--sr-county-${t}-rgb:\\s*\\d+,\\d+,\\d+`))
    }
  })
})
