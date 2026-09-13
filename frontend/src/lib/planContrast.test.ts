// Contrast guard for the Weather/tide Planner's six `--sr-plan-*` tokens
// (design-spec.md, Design Tokens Applied; NFR-02 / QA-53), in the
// calendarContrast / countyContrast shape: the REAL tokens are parsed out of
// globals.css (vitest stubs CSS ?raw imports), both theme blocks, and the
// WCAG ratios the design measured are asserted rather than remembered.
//
// What is asserted and why: the night band against the day ground (the two
// bands are always both drawn, so their boundary must read as a boundary: 3:1
// non-text); the tide line against BOTH bands (it crosses them); the sun mark
// against the day ground (over the night band it is separated by its halo,
// which is asserted against night instead); the chart label ink against the
// day ground at text level; and the halo against the night band, since the
// halo is what carries every mark and label over it. The four marker hues are
// deliberately NOT asserted against each other: shape and label distinguish
// the marks, so no marker hue is load-bearing for meaning.
//
// Dark is a genuine second palette, not a copied light tint (the ui rule's
// 0.5.44 post-mortem): there the DAY is the lit band and night is the deep
// ground, and the ratios are asserted in both directions of that inversion.
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
const rgbOf = (where: string, name: string): [number, number, number] => {
  const m = where.match(new RegExp(`--${name}:\\s*(\\d+),(\\d+),(\\d+)`))
  if (!m) throw new Error(`token --${name} not found`)
  return [Number(m[1]), Number(m[2]), Number(m[3])]
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

const THEMES: Array<[string, string]> = [['light', rootBlock], ['dark', darkBlock]]

describe('--sr-plan-* chart tokens (NFR-02)', () => {
  it('all six are declared in BOTH themes', () => {
    for (const [, b] of THEMES) {
      for (const name of ['sr-plan-day', 'sr-plan-night', 'sr-plan-tide', 'sr-plan-sun', 'sr-plan-halo']) hexOf(b, name)
      rgbOf(b, 'sr-plan-grid-rgb')
    }
  })

  it('dark is its own palette, with the day and night roles inverted (the lit day band on a deep ground)', () => {
    expect(hexOf(darkBlock, 'sr-plan-day')).not.toBe(hexOf(rootBlock, 'sr-plan-day'))
    expect(hexOf(darkBlock, 'sr-plan-night')).not.toBe(hexOf(rootBlock, 'sr-plan-night'))
    expect(lum(hexOf(rootBlock, 'sr-plan-day'))).toBeGreaterThan(lum(hexOf(rootBlock, 'sr-plan-night')))
    expect(lum(hexOf(darkBlock, 'sr-plan-day'))).toBeGreaterThan(lum(hexOf(darkBlock, 'sr-plan-night')))
  })

  it.each(THEMES)('%s: the night band clears 3:1 against the day ground', (_t, b) => {
    expect(contrast(hexOf(b, 'sr-plan-night'), hexOf(b, 'sr-plan-day'))).toBeGreaterThanOrEqual(3)
  })

  it.each(THEMES)('%s: the tide line clears 3:1 against BOTH bands', (_t, b) => {
    expect(contrast(hexOf(b, 'sr-plan-tide'), hexOf(b, 'sr-plan-day'))).toBeGreaterThanOrEqual(3)
    expect(contrast(hexOf(b, 'sr-plan-tide'), hexOf(b, 'sr-plan-night'))).toBeGreaterThanOrEqual(3)
  })

  it.each(THEMES)('%s: the sun mark clears 3:1 against the day ground', (_t, b) => {
    expect(contrast(hexOf(b, 'sr-plan-sun'), hexOf(b, 'sr-plan-day'))).toBeGreaterThanOrEqual(3)
  })

  it.each(THEMES)('%s: over EACH band, every haloed mark is separated by its fill or by its halo (3:1)', (_t, b) => {
    // The halo is the theme's own ground colour, so on the band it matches it
    // contributes nothing and the mark's own fill has to carry the boundary
    // (on dark the halo IS the night ground and the sun mark sits at ~15:1 on
    // it); on the other band the halo carries it. Either way the boundary
    // clears 3:1, which is the property the haloed design is for.
    for (const band of ['sr-plan-day', 'sr-plan-night']) {
      for (const mark of ['sr-plan-sun', 'sr-plan-tide']) {
        const byFill = contrast(hexOf(b, mark), hexOf(b, band))
        const byHalo = contrast(hexOf(b, 'sr-plan-halo'), hexOf(b, band))
        expect(Math.max(byFill, byHalo), `${mark} over ${band}`).toBeGreaterThanOrEqual(3)
      }
    }
  })

  it.each(THEMES)('%s: chart label ink (--sr-text) passes AA on the day ground and against its own halo stroke', (_t, b) => {
    expect(contrast(hexOf(b, 'sr-text'), hexOf(b, 'sr-plan-day'))).toBeGreaterThanOrEqual(4.5)
    expect(contrast(hexOf(b, 'sr-text'), hexOf(b, 'sr-plan-halo'))).toBeGreaterThanOrEqual(4.5)
    // And over the night band, the ink or its halo carries the letterform.
    const byInk = contrast(hexOf(b, 'sr-text'), hexOf(b, 'sr-plan-night'))
    const byHalo = contrast(hexOf(b, 'sr-plan-halo'), hexOf(b, 'sr-plan-night'))
    expect(Math.max(byInk, byHalo)).toBeGreaterThanOrEqual(4.5)
  })

  it.each(THEMES)('%s: the sun glyph on the event tile (--sr-surface-subtle) clears 3:1', (_t, b) => {
    expect(contrast(hexOf(b, 'sr-plan-sun'), hexOf(b, 'sr-surface-subtle'))).toBeGreaterThanOrEqual(3)
  })

  it.each(THEMES)('%s: the gridline triplet is the theme\'s own ink, so the 0.16-alpha line reads over both bands', (_t, b) => {
    const [r, g, bl] = rgbOf(b, 'sr-plan-grid-rgb')
    const hex = `#${[r, g, bl].map(n => n.toString(16).padStart(2, '0')).join('')}`
    expect(hex.toUpperCase()).toBe(hexOf(b, 'sr-text').toUpperCase())
  })
})
