// Map Explorer pin model — the single source of truth for sighting-circle
// sizing/opacity and the hotspot teardrop sprites, shared between the GL
// layers (paint expressions / map.addImage sprites) and any JS/legend code.
//
// The sighting pins render as a MapLibre `circle` layer, so the count→radius
// and count→opacity curves exist twice: as plain functions (used by tests and
// any JS callers) and as `step` paint expressions (used by the layer). Both
// derive from the same stop tables below so they cannot drift — mapPins.test.ts
// locks the parity, mirroring lib/heat.ts heatWeightDivisor.
//
// The hotspot teardrops are baked into raster sprites (canvas → ImageData →
// map.addImage) because GL symbol layers can't reference CSS or SVG. Colors are
// read from the --sr-map-* tokens at call time, so the caller regenerates +
// re-adds the sprites on a light/dark theme change (same contract as
// lib/atlasTextures.ts hatchImageData).

import type { ExpressionSpecification, PointLike } from 'maplibre-gl'

// ── Sighting circle model ──────────────────────────────────────────────────────

/** Base radius (px) below the first stop. */
export const PIN_RADIUS_BASE = 12
/** [count threshold, radius px] — ascending. */
export const PIN_RADIUS_STOPS: ReadonlyArray<readonly [number, number]> = [
  [50, 15],
  [100, 18],
  [200, 22],
]

/** Base opacity below the first stop. */
export const PIN_OPACITY_BASE = 0.78
/** [count threshold, opacity] — ascending. */
export const PIN_OPACITY_STOPS: ReadonlyArray<readonly [number, number]> = [
  [50, 0.82],
  [100, 0.88],
  [200, 0.95],
]

/** Opacity multiplier applied to sighting pins while atlas breeding shading is
 *  on, so the tier colors stay legible on top (matches the pre-GL DOM value). */
export const ATLAS_DIM_FACTOR = 0.25

function stepValue(stops: ReadonlyArray<readonly [number, number]>, base: number, count: number): number {
  let v = base
  for (const [threshold, value] of stops) {
    if (count >= threshold) v = value
  }
  return v
}

/** Circle radius (px) for a location's observation count. */
export function pinRadius(count: number): number {
  return stepValue(PIN_RADIUS_STOPS, PIN_RADIUS_BASE, count)
}

/** Circle opacity for a location's observation count. */
export function pinOpacity(count: number): number {
  return stepValue(PIN_OPACITY_STOPS, PIN_OPACITY_BASE, count)
}

/** White outline width (px) around each sighting circle. */
export const PIN_STROKE_WIDTH = 2

/** The radius curve as a MapLibre step expression over the `count` property. */
export function pinRadiusExpr(): ExpressionSpecification {
  return ['step', ['get', 'count'], PIN_RADIUS_BASE, ...PIN_RADIUS_STOPS.flat()] as ExpressionSpecification
}

/**
 * The `circle-radius` expression for the sighting layer. pinRadius() is the
 * OUTER radius (the DOM pins were border-box divs, border included), but a GL
 * circle-stroke draws OUTSIDE circle-radius — so the fill radius is the outer
 * radius minus the stroke width, keeping the rendered footprint identical.
 */
export function pinFillRadiusExpr(): ExpressionSpecification {
  return [
    'step', ['get', 'count'], PIN_RADIUS_BASE - PIN_STROKE_WIDTH,
    ...PIN_RADIUS_STOPS.flatMap(([threshold, value]) => [threshold, value - PIN_STROKE_WIDTH]),
  ] as ExpressionSpecification
}

/**
 * The opacity curve as a MapLibre step expression over the `count` property,
 * scaled by `factor` (pass ATLAS_DIM_FACTOR while atlas shading is on, else 1).
 */
export function pinOpacityExpr(factor = 1): ExpressionSpecification {
  const scaled = (v: number) => Number((v * factor).toFixed(4))
  return [
    'step', ['get', 'count'], scaled(PIN_OPACITY_BASE),
    ...PIN_OPACITY_STOPS.flatMap(([threshold, value]) => [threshold, scaled(value)]),
  ] as ExpressionSpecification
}

// ── Hotspot teardrop sprites ───────────────────────────────────────────────────

export type HotspotKind = 'visited' | 'unvisited' | 'personal'
export const HOTSPOT_KINDS: HotspotKind[] = ['visited', 'unvisited', 'personal']

/** Sprite id per kind (referenced by the symbol layer's icon-image match). */
export const HOTSPOT_IMAGE_ID: Record<HotspotKind, string> = {
  visited: 'sr-pin-visited',
  unvisited: 'sr-pin-unvisited',
  personal: 'sr-pin-personal',
}

/** Teardrop SVG path (28×40 viewBox) — circle top, pointed bottom. Shared by the
 *  canvas sprites here and the sidebar-legend SVGs in MapExplorer. */
export const TEARDROP = 'M14 0C6.268 0 0 6.268 0 14c0 5.47 3.078 10.23 7.602 12.651L14 40l6.398-13.349A13.944 13.944 0 0028 14C28 6.268 21.732 0 14 0z'

/** Teardrop CSS-pixel dimensions (must stay constant — map.updateImage on a theme
 *  change requires identical sprite dimensions). */
export const TEARDROP_W = 28
export const TEARDROP_H = 40

// Light-theme token values, used only when getComputedStyle is unavailable or
// the token is missing (tests, very early paint).
const KIND_FALLBACK: Record<HotspotKind, string> = {
  visited: '#2D8653',
  unvisited: '#5B7FA6',
  personal: '#C9842A',
}

function kindColor(kind: HotspotKind): string {
  if (typeof document === 'undefined') return KIND_FALLBACK[kind]
  const v = getComputedStyle(document.documentElement).getPropertyValue(`--sr-map-${kind}`).trim()
  return v || KIND_FALLBACK[kind]
}

// White glyph per kind, matching the legend SVGs in MapExplorer: a check for
// visited, two dots for unvisited, a star for personal.
function drawGlyph(ctx: CanvasRenderingContext2D, kind: HotspotKind): void {
  ctx.fillStyle = '#fff'
  ctx.strokeStyle = '#fff'
  if (kind === 'visited') {
    ctx.lineWidth = 2.5
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.beginPath()
    ctx.moveTo(8, 15)
    ctx.lineTo(12, 19)
    ctx.lineTo(20, 11)
    ctx.stroke()
  } else if (kind === 'unvisited') {
    ctx.beginPath()
    ctx.arc(10, 13, 3.5, 0, Math.PI * 2)
    ctx.arc(18, 13, 3.5, 0, Math.PI * 2)
    ctx.fill()
  } else {
    ctx.fill(new Path2D('M14 6L15.5 11L20.5 11L16.5 14.2L18 19L14 16L10 19L11.5 14.2L7.5 11L12.5 11Z'))
  }
}

// ── Shared canvas-cursor arbiter ───────────────────────────────────────────────
// The sighting circles, hotspot teardrops, and atlas fill are OVERLAPPING
// interactive GL layers, each receiving its own delegated mouseenter/mouseleave.
// If every layer set the canvas cursor independently, the cursor would end up
// wrong when the pointer crosses from one interactive layer onto another
// beneath it — e.g. pin → shaded atlas block: the pin's mouseleave fires, but
// the block's mouseenter does NOT re-fire because the block was already under
// the pointer the whole time. Every enter/leave handler therefore routes
// through this arbiter, which re-queries ALL interactive layers present.

export const INTERACTIVE_MAP_LAYERS = ['sr-sight-circle', 'sr-hotspot', 'sr-atlas-fill']

/** The subset of the MapLibre Map (or react-map-gl MapRef) the arbiter needs. */
export interface CursorMap {
  getLayer(id: string): unknown
  queryRenderedFeatures(point: PointLike, options?: { layers?: string[] }): unknown[]
  getCanvas(): HTMLCanvasElement
}

/** Set the canvas cursor to 'pointer' iff any interactive layer is under `point`. */
export function updateMapCursor(map: CursorMap, point: PointLike): void {
  const layers = INTERACTIVE_MAP_LAYERS.filter(id => !!map.getLayer(id))
  const hit = layers.length > 0 && map.queryRenderedFeatures(point, { layers }).length > 0
  map.getCanvas().style.cursor = hit ? 'pointer' : ''
}

/**
 * Build the teardrop sprite for a hotspot kind as ImageData, ready for
 * map.addImage(id, img, { pixelRatio: dpr }). Colors come from the --sr-map-*
 * tokens at call time — regenerate + updateImage on a data-theme change.
 */
export function teardropImageData(kind: HotspotKind, dpr: number): ImageData {
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(TEARDROP_W * dpr)
  canvas.height = Math.round(TEARDROP_H * dpr)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('2D canvas context unavailable')
  ctx.scale(dpr, dpr)
  ctx.fillStyle = kindColor(kind)
  ctx.fill(new Path2D(TEARDROP))
  drawGlyph(ctx, kind)
  return ctx.getImageData(0, 0, canvas.width, canvas.height)
}
