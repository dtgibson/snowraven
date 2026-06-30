// Canvas crosshatch generators for the county "Use Textures" mode — the
// colorblind-accessible analogue of the atlas hatches (lib/atlasTextures.ts),
// generalized from 4 breeding motifs to ONE crosshatch motif whose DENSITY rises
// monotonically across the 10 county quantile tiers: an open lattice at tier 1, a
// tight (but never solid) crosshatch at tier 10. Density — line spacing reinforced
// by line weight — is the single load-bearing, testable encoding, so county rank
// survives with hue and luminance removed (FR-05/06/07).
//
// MapLibre fills can't reference SVG <pattern> fragments, so each tier's hatch is
// baked into a raster sprite added via map.addImage and referenced by
// fill-pattern. Tint + stroke colors read from the --sr-county-N-rgb CSS tokens at
// call time, so the caller regenerates + re-adds these on a light/dark theme
// change (NFR-03) — though the county ramp is identical in both themes.

export type CountyTier = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10
export const COUNTY_TIERS: CountyTier[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

/** Sprite id per tier (referenced by the fill-pattern match expression). */
export const COUNTY_HATCH_IMAGE_ID: Record<CountyTier, string> = {
  1: 'sr-county-hatch-1',
  2: 'sr-county-hatch-2',
  3: 'sr-county-hatch-3',
  4: 'sr-county-hatch-4',
  5: 'sr-county-hatch-5',
  6: 'sr-county-hatch-6',
  7: 'sr-county-hatch-7',
  8: 'sr-county-hatch-8',
  9: 'sr-county-hatch-9',
  10: 'sr-county-hatch-10',
}

// One 45°/135° crosshatch motif. DENSITY is the encoding, not hue or weight alone.
// tile = gapPx (corner-to-corner diagonals tile seamlessly — the atlas TILE trick).
// gapPx decreases 20→5 (tighter); lineWidthPx rises 0.75→1.30 (heavier at the
// dense end, where the gap can no longer shrink without the holes closing). The
// Designer's final, verified curve (design-spec.md) — kept verbatim.
export interface HatchSpec {
  /** Tile side in CSS px; smaller = denser crosshatch. */
  gapPx: number
  /** Stroke width in CSS px; heavier reinforces density at the tight end. */
  lineWidthPx: number
}

export const HATCH: Record<CountyTier, HatchSpec> = {
  1: { gapPx: 20, lineWidthPx: 0.75 },
  2: { gapPx: 17, lineWidthPx: 0.8 },
  3: { gapPx: 14, lineWidthPx: 0.8 },
  4: { gapPx: 12, lineWidthPx: 0.85 },
  5: { gapPx: 10, lineWidthPx: 0.9 },
  6: { gapPx: 9, lineWidthPx: 1.0 },
  7: { gapPx: 8, lineWidthPx: 1.1 },
  8: { gapPx: 7, lineWidthPx: 1.15 },
  9: { gapPx: 6, lineWidthPx: 1.25 },
  10: { gapPx: 5, lineWidthPx: 1.3 },
}

/** The HATCH spec for a tier — the one source of truth the legend / in-view
 *  density swatch reads, so it can never drift from the on-map texture. */
export function countyHatchSpec(tier: CountyTier): HatchSpec {
  return HATCH[tier]
}

// Faint tier-color underlay + the load-bearing crosshatch strokes. Kept light so
// the basemap stays readable THROUGH the shading (the atlas FILL_ALPHA analogue).
// Density, not tint, carries the tier.
const TINT_ALPHA = 0.12
const STROKE_ALPHA = 0.8

function tierRgb(tier: CountyTier): string {
  if (typeof document === 'undefined') return '128,128,128'
  const v = getComputedStyle(document.documentElement).getPropertyValue(`--sr-county-${tier}-rgb`).trim()
  return v || '128,128,128'
}

// One crosshatch helper for every tier — never hand-rolled per tier. Two
// diagonals, corner to corner, so the gapPx×gapPx tile repeats seamlessly
// (lineCap 'butt' so the diagonals meet cleanly across tile boundaries).
function drawCrosshatch(ctx: CanvasRenderingContext2D, gapPx: number, lineWidthPx: number, rgb: string): void {
  const size = gapPx
  ctx.clearRect(0, 0, size, size)
  ctx.fillStyle = `rgba(${rgb}, ${TINT_ALPHA})`
  ctx.fillRect(0, 0, size, size)
  ctx.strokeStyle = `rgba(${rgb}, ${STROKE_ALPHA})`
  ctx.lineWidth = lineWidthPx
  ctx.lineCap = 'butt'
  ctx.beginPath()
  ctx.moveTo(0, size)
  ctx.lineTo(size, 0) // 45° (anti-diagonal)
  ctx.moveTo(0, 0)
  ctx.lineTo(size, size) // 135° (main diagonal)
  ctx.stroke()
}

/**
 * Build the crosshatch sprite for a tier as ImageData, ready for
 * map.addImage(id, img, { pixelRatio }). Rendered at `dpr` for crispness on
 * retina; pass the same dpr to addImage so MapLibre tiles it at the intended CSS
 * size.
 */
export function countyHatchImageData(tier: CountyTier, dpr: number): ImageData {
  const { gapPx, lineWidthPx } = HATCH[tier]
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(gapPx * dpr)
  canvas.height = Math.round(gapPx * dpr)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('2D canvas context unavailable')
  ctx.scale(dpr, dpr)
  drawCrosshatch(ctx, gapPx, lineWidthPx, tierRgb(tier))
  return ctx.getImageData(0, 0, canvas.width, canvas.height)
}

/** Sprite pixel-ratio to render at (retina-crisp, capped). */
export function countyHatchPixelRatio(): number {
  const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1
  return Math.min(3, Math.max(2, Math.ceil(dpr)))
}

/** Reverse sprite lookup: image id → county tier, null for ids that aren't ours
 *  (the styleimagemissing safety net must ignore foreign ids — other layers may
 *  legitimately miss images). */
export function countyHatchTierForImage(id: string): CountyTier | null {
  for (const tier of COUNTY_TIERS) {
    if (COUNTY_HATCH_IMAGE_ID[tier] === id) return tier
  }
  return null
}

/**
 * Pure ink-coverage proxy (lineWidth / gap) — the guard-test metric. Strictly
 * increasing across tiers, so "tier N is denser than tier N−1" holds whichever
 * knob the Designer later moves (the analogue of countyContrast.test.ts asserting
 * luminance monotonicity). Theme-independent — density, not color, carries tier.
 */
export function countyHatchDensity(tier: CountyTier): number {
  return HATCH[tier].lineWidthPx / HATCH[tier].gapPx
}
