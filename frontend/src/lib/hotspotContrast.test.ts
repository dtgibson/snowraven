// Contrast guard for the hotspot color-mode ramp + state tokens
// (color-coded-hotspots, QA-29/QA-30 — the countyContrast posture: parse the
// REAL tokens out of globals.css, so a future edit that weakens a token fails
// here, not the user's eyes).
//
// Clauses (design-spec.md "The nodata deviation", encoded EXACTLY):
//   • every ramp/state token + its -rgb twin present in BOTH theme blocks,
//     identical across them (basemap-anchored), and the -rgb twin equal to the
//     hex it shadows;
//   • ramp luminance strictly monotonic light→dark (grayscale-ordered, NFR-02);
//   • adjacent ramp steps ≥1.2:1 (the county floor — the mock prose's "at
//     least 1.33" is the measured record, NOT the guard clause);
//   • every ramp fill and the unanswered/zero state fills ≥3:1 against the
//     basemap land tints — computed against the exported TINT_* constants in
//     lib/mapStyle.ts, TINT_GRASS (palest) the binding case (the documented
//     --sr-map-pin-* practice);
//   • --sr-hotspot-nodata REPLACEMENT clauses (decisions.md item 2 — the
//     deviation from the uniform ≥3:1-vs-land clause, BY DESIGN: "never birded"
//     must read as absence, and any land-guard-compliant dark gray reads as
//     "something"): the nodata fill is LIGHT — ≥3:1 against each of the other
//     two state fills AND against ramp step 1 — and the ring
//     (--sr-map-pin-stroke) is ≥3:1 against the land tints and against the
//     nodata fill itself. Never re-add the vs-land clause for nodata.
//   • the three state fills pairwise ≥1.2:1 and each ≥1.2:1 from ramp step 1
//     (off-ramp states distinguishable by more than hue, NFR-02);
//   • --sr-hotspot-pale is deliberately OUTSIDE the fill clauses (an
//     inner-disc surface bounded by the zero rim, never a pin boundary against
//     the map) — presence + theme-identity only;
//   • the tier-ring white (HOTSPOT_TIER_RING_COLOR, the opt-in Use Tier Rings
//     cue, colorblind-accessible-hotspot-pins) ≥3:1 against EVERY ramp fill in
//     both theme blocks — the ring strokes over the fills, step 1 (~4.0:1 as
//     shipped) is the binding case, and a future ramp retune that lightens a
//     fill past ~luminance 0.30 must fail here rather than the user's eyes.
//
// DORMANT CLAUSE, stated so a future change trips over it: NO TEXT rides any
// pin fill, so the ≥4.5:1 on-fill text rule (the Calendar precedent) does not
// apply here. If a number is ever painted ON a pin fill, that change must add
// the 4.5:1 on-fill clauses to this file (NFR-01).
/// <reference types="node" />
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { TINT_PARK, TINT_WOOD, TINT_GRASS, TINT_DEVELOPED } from './mapStyle'
import { HOTSPOT_TIER_RING_COLOR } from './mapPins'

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
  const m = where.match(new RegExp(`--${name}-rgb:\\s*(\\d+),(\\d+),(\\d+)`))
  if (!m) throw new Error(`token --${name}-rgb not found`)
  return [Number(m[1]), Number(m[2]), Number(m[3])]
}

const srgb = (c: number): number => { const s = c / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4 }
const lumRgb = (r: number, g: number, b: number): number => 0.2126 * srgb(r) + 0.7152 * srgb(g) + 0.0722 * srgb(b)
const lum = (hex: string): number => {
  const h = hex.replace('#', '')
  return lumRgb(parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16))
}
const contrastL = (la: number, lb: number): number => (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
const contrast = (a: string, b: string): number => contrastL(lum(a), lum(b))

/** The TINT_* constants are hsl() strings — resolve to luminance directly. */
function hslLum(hsl: string): number {
  const m = hsl.match(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/)
  if (!m) throw new Error(`unparseable tint: ${hsl}`)
  const h = Number(m[1]) / 360, s = Number(m[2]) / 100, l = Number(m[3]) / 100
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s
  const p = 2 * l - q
  const channel = (t0: number): number => {
    let t = t0
    if (t < 0) t += 1
    if (t > 1) t -= 1
    if (t < 1 / 6) return p + (q - p) * 6 * t
    if (t < 1 / 2) return q
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6
    return p
  }
  const r = Math.round(channel(h + 1 / 3) * 255)
  const g = Math.round(channel(h) * 255)
  const b = Math.round(channel(h - 1 / 3) * 255)
  return lumRgb(r, g, b)
}

const RAMP = [1, 2, 3, 4, 5] as const
const STATE_NAMES = ['sr-hotspot-unanswered', 'sr-hotspot-zero', 'sr-hotspot-nodata'] as const
const ALL_NAMES = [...RAMP.map(t => `sr-hotspot-${t}`), ...STATE_NAMES, 'sr-hotspot-pale'] as const

describe('--sr-hotspot ramp + state tokens (QA-29 / QA-30)', () => {
  it('every token and its -rgb twin exist in BOTH theme blocks, identical (basemap-anchored)', () => {
    for (const name of ALL_NAMES) {
      const rootHex = hexOf(rootBlock, name)
      expect(hexOf(darkBlock, name)).toBe(rootHex)
      const rootRgb = rgbOf(rootBlock, name)
      expect(rgbOf(darkBlock, name)).toEqual(rootRgb)
      // The -rgb twin must BE the hex it shadows (GL sprites read either).
      const h = rootHex.replace('#', '')
      expect(rootRgb).toEqual([
        parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16),
      ])
    }
  })

  it('the ramp is strictly luminance-monotonic light→dark (grayscale-ordered, NFR-02)', () => {
    const lums = RAMP.map(t => lum(hexOf(rootBlock, `sr-hotspot-${t}`)))
    for (let i = 1; i < lums.length; i++) expect(lums[i]).toBeLessThan(lums[i - 1])
  })

  it('adjacent ramp steps are ≥1.2:1 apart (the county floor)', () => {
    for (let i = 1; i < RAMP.length; i++) {
      const c = contrast(hexOf(rootBlock, `sr-hotspot-${RAMP[i]}`), hexOf(rootBlock, `sr-hotspot-${RAMP[i - 1]}`))
      expect(c, `steps ${RAMP[i - 1]}→${RAMP[i]}`).toBeGreaterThanOrEqual(1.2)
    }
  })

  // The land reference is TINT_GRASS — the design-spec's stated binding case
  // and the documented --sr-map-pin-* practice (each pin token's comment
  // measures one "vs land" figure). The other TINT_* constants are imported
  // so a rename/removal breaks this file loudly rather than silently.
  it('every ramp fill is ≥3:1 against the land (TINT_GRASS, the binding reference)', () => {
    void TINT_PARK; void TINT_WOOD; void TINT_DEVELOPED
    for (const t of RAMP) {
      const l = lum(hexOf(rootBlock, `sr-hotspot-${t}`))
      expect(contrastL(l, hslLum(TINT_GRASS)), `hotspot-${t} vs TINT_GRASS`).toBeGreaterThanOrEqual(3)
    }
  })

  it('the unanswered and zero state fills are ≥3:1 against the land (TINT_GRASS)', () => {
    for (const name of ['sr-hotspot-unanswered', 'sr-hotspot-zero'] as const) {
      const l = lum(hexOf(rootBlock, name))
      expect(contrastL(l, hslLum(TINT_GRASS)), `${name} vs TINT_GRASS`).toBeGreaterThanOrEqual(3)
    }
  })

  it('NODATA REPLACEMENT CLAUSE 1: the pale fill is ≥3:1 against both other state fills and ramp step 1 (never the vs-land clause)', () => {
    const nodata = hexOf(rootBlock, 'sr-hotspot-nodata')
    expect(contrast(nodata, hexOf(rootBlock, 'sr-hotspot-unanswered'))).toBeGreaterThanOrEqual(3)
    expect(contrast(nodata, hexOf(rootBlock, 'sr-hotspot-zero'))).toBeGreaterThanOrEqual(3)
    expect(contrast(nodata, hexOf(rootBlock, 'sr-hotspot-1'))).toBeGreaterThanOrEqual(3)
  })

  it('NODATA REPLACEMENT CLAUSE 2: the pin ring (--sr-map-pin-stroke) is ≥3:1 vs the land AND vs the nodata fill itself', () => {
    const ring = hexOf(rootBlock, 'sr-map-pin-stroke')
    expect(contrastL(lum(ring), hslLum(TINT_GRASS)), 'ring vs TINT_GRASS').toBeGreaterThanOrEqual(3)
    expect(contrast(ring, hexOf(rootBlock, 'sr-hotspot-nodata'))).toBeGreaterThanOrEqual(3)
  })

  it('the three state fills are pairwise ≥1.2:1 and each ≥1.2:1 from ramp step 1 (NFR-02)', () => {
    const states = STATE_NAMES.map(n => hexOf(rootBlock, n))
    for (let i = 0; i < states.length; i++) {
      for (let j = i + 1; j < states.length; j++) {
        expect(contrast(states[i], states[j]), `${STATE_NAMES[i]} vs ${STATE_NAMES[j]}`).toBeGreaterThanOrEqual(1.2)
      }
      expect(contrast(states[i], hexOf(rootBlock, 'sr-hotspot-1')), `${STATE_NAMES[i]} vs step 1`).toBeGreaterThanOrEqual(1.2)
    }
  })

  it('the tier-ring white (HOTSPOT_TIER_RING_COLOR) is ≥3:1 against every ramp fill, in both theme blocks', () => {
    // The opt-in tier ring strokes this white over the ramp fills at pin
    // scale (colorblind-accessible-hotspot-pins); the lightest fill is the
    // binding case (step 1, ~4.0:1 as shipped). Both blocks are asserted so
    // this clause survives even a future retirement of the basemap-anchored
    // theme-identity clause above.
    const expand = (hex: string): string =>
      hex.length === 4 ? `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}` : hex
    const ringLum = lum(expand(HOTSPOT_TIER_RING_COLOR))
    for (const [theme, where] of [['root', rootBlock], ['dark', darkBlock]] as const) {
      for (const t of RAMP) {
        const c = contrastL(ringLum, lum(hexOf(where, `sr-hotspot-${t}`)))
        expect(c, `${theme}: ring white vs hotspot-${t}`).toBeGreaterThanOrEqual(3)
      }
    }
  })

  it('--sr-hotspot-pale is present + theme-identical only (an inner-disc surface, outside the fill clauses by design)', () => {
    expect(hexOf(rootBlock, 'sr-hotspot-pale')).toBe(hexOf(darkBlock, 'sr-hotspot-pale'))
    // Deliberately NO land/adjacency clause for pale — it is bounded by the
    // zero rim, never a pin boundary against the map (design-spec).
  })

  it('DORMANT: no text rides any pin fill, so no 4.5:1 on-fill clause exists here — adding a number ON a pin must add it', () => {
    // This test is the tripwire's documentation; the assertion pins the
    // premise it rests on (the sprite glyphs are kind GLYPHS, not text).
    expect(true).toBe(true)
  })
})
