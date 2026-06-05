// Canvas hatch generators for the atlas "Use Textures" mode. One pattern per
// breeding tier, matching the retired AtlasTierPatterns SVG: a faint tier-color
// fill + a density-coded hatch (sparse dots -> single diagonal -> cross-hatch ->
// dense cross-hatch) so tiers read WITHOUT relying on color (colorblind-friendly).
//
// MapLibre fills can't reference SVG <pattern> fragments, so the hatch is baked
// into a raster sprite added via map.addImage and referenced by fill-pattern.
// Tier colors are read from the --sr-tier-N-rgb CSS tokens at call time, so the
// caller regenerates + re-adds these on a light/dark theme change.

export type Tier = 1 | 2 | 3 | 4
export const TIERS: Tier[] = [1, 2, 3, 4]

/** Sprite id per tier (referenced by the fill-pattern match expression). */
export const HATCH_IMAGE_ID: Record<Tier, string> = {
  1: 'sr-atlas-hatch-1',
  2: 'sr-atlas-hatch-2',
  3: 'sr-atlas-hatch-3',
  4: 'sr-atlas-hatch-4',
}

// Tile size (CSS px) per tier — same dimensions the SVG patterns used, so the
// diagonals meet corner-to-corner and tile seamlessly when repeated.
const TILE: Record<Tier, number> = { 1: 14, 2: 13, 3: 22, 4: 16 }

// Kept light so the base map stays readable THROUGH the shading.
const FILL_ALPHA = 0.12
const STROKE_ALPHA = 0.85 // single-mark tiers (dots, single diagonal)
const CROSS_ALPHA = 0.6 // cross-hatch tiers: lighter, since two directions overlap

function tierRgb(tier: Tier): string {
  if (typeof document === 'undefined') return '128,128,128'
  const v = getComputedStyle(document.documentElement).getPropertyValue(`--sr-tier-${tier}-rgb`).trim()
  return v || '128,128,128'
}

function drawHatch(ctx: CanvasRenderingContext2D, tier: Tier, rgb: string): void {
  const size = TILE[tier]
  ctx.clearRect(0, 0, size, size)
  ctx.fillStyle = `rgba(${rgb}, ${FILL_ALPHA})`
  ctx.fillRect(0, 0, size, size)
  if (tier === 1) {
    // Possible: sparse dot
    ctx.fillStyle = `rgba(${rgb}, ${STROKE_ALPHA})`
    ctx.beginPath()
    ctx.arc(7, 7, 1.1, 0, Math.PI * 2)
    ctx.fill()
  } else if (tier === 2) {
    // Probable: single diagonal
    ctx.strokeStyle = `rgba(${rgb}, ${STROKE_ALPHA})`
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(0, size)
    ctx.lineTo(size, 0)
    ctx.stroke()
  } else {
    // Confirmed (3 = nest building, 4 = nest/young): cross-hatch, denser at 4
    ctx.strokeStyle = `rgba(${rgb}, ${CROSS_ALPHA})`
    ctx.lineWidth = 0.75
    ctx.beginPath()
    ctx.moveTo(0, size)
    ctx.lineTo(size, 0)
    ctx.moveTo(0, 0)
    ctx.lineTo(size, size)
    ctx.stroke()
  }
}

/**
 * Build the hatch sprite for a tier as ImageData, ready for map.addImage(id, img,
 * { pixelRatio }). Rendered at `dpr` for crispness on retina; pass the same dpr
 * to addImage so MapLibre tiles it at the intended CSS size.
 */
export function hatchImageData(tier: Tier, dpr: number): ImageData {
  const size = TILE[tier]
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(size * dpr)
  canvas.height = Math.round(size * dpr)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('2D canvas context unavailable')
  ctx.scale(dpr, dpr)
  drawHatch(ctx, tier, tierRgb(tier))
  return ctx.getImageData(0, 0, canvas.width, canvas.height)
}

/** Sprite pixel-ratio to render at (retina-crisp, capped). */
export function hatchPixelRatio(): number {
  const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1
  return Math.min(3, Math.max(2, Math.ceil(dpr)))
}
