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

import type { ExpressionSpecification, Marker as MaplibreMarker, PointLike } from 'maplibre-gl'

// ── DOM marker keyboard access ──────────────────────────────────────────────────
// react-map-gl/maplibre DOM <Marker>s are not keyboard-operable: maplibre stamps
// the wrapper with role='button' + a generic aria-label='Map marker' but no
// tabindex, and binds click on the wrapper (Enter/Space don't fire on a div).
// The fix is to render a real <button aria-label=…> child (Enter/Space → native
// click → bubbles to the wrapper's listener) and demote the wrapper so AT doesn't
// announce a button inside a button. Call this from the Marker `ref` callback.
// Idempotent and null-safe (the ref fires with null on unmount).
export function neutralizeMarkerWrapper(marker: MaplibreMarker | null): void {
  if (!marker) return
  const el = marker.getElement()
  if (!el) return
  el.setAttribute('role', 'presentation')
  el.removeAttribute('aria-label')
  el.removeAttribute('tabindex')
}

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

/** Radius scale per user-chosen Point Size (Pins mode). 'normal' is 1 so the
 *  default rendering is byte-identical to before the control existed; 'small'
 *  shrinks the circle so a shaded breeding/county choropleth reads through.
 *  ('off' hides the layer entirely — no radius, handled by the caller.) */
export const POINT_SIZE_RADIUS_FACTOR: Record<'normal' | 'small', number> = {
  normal: 1,
  small: 0.5,
}

// Round to 4 dp so an occasional float artifact (e.g. 13 * 0.5) can't drift the
// step-expression away from its function twin — the same tidy pinOpacityExpr uses.
function scaleRadius(value: number, factor: number): number {
  return factor === 1 ? value : Number((value * factor).toFixed(4))
}

/** The OUTER radius (px) for a location's observation count, scaled by `factor`
 *  (pass a POINT_SIZE_RADIUS_FACTOR value; default 1 = unchanged). */
export function pinRadiusScaled(count: number, factor = 1): number {
  return scaleRadius(pinRadius(count), factor)
}

/** The radius curve as a MapLibre step expression over the `count` property,
 *  scaled by `factor` (default 1 = the original curve). */
export function pinRadiusExpr(factor = 1): ExpressionSpecification {
  return [
    'step', ['get', 'count'], scaleRadius(PIN_RADIUS_BASE, factor),
    ...PIN_RADIUS_STOPS.flatMap(([threshold, value]) => [threshold, scaleRadius(value, factor)]),
  ] as ExpressionSpecification
}

/**
 * The `circle-radius` expression for the sighting layer, scaled by `factor`
 * (default 1 = unchanged). pinRadius() is the OUTER radius (the DOM pins were
 * border-box divs, border included), but a GL circle-stroke draws OUTSIDE
 * circle-radius — so the fill radius is the outer radius minus the stroke
 * width, keeping the rendered footprint identical. The size factor scales the
 * fill radius only; the stroke width is unchanged so a small point keeps a
 * legible outline against the basemap.
 */
export function pinFillRadiusExpr(factor = 1): ExpressionSpecification {
  return [
    'step', ['get', 'count'], scaleRadius(PIN_RADIUS_BASE - PIN_STROKE_WIDTH, factor),
    ...PIN_RADIUS_STOPS.flatMap(([threshold, value]) => [threshold, scaleRadius(value - PIN_STROKE_WIDTH, factor)]),
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

// Basemap-anchored fallback values (same in both themes), used only when
// getComputedStyle is unavailable or the token is missing (tests, very early
// paint). The GL sprites read the --sr-map-pin-* tokens, not --sr-map-*: the
// Positron basemap stays light in dark mode, so the theme-lightened --sr-map-*
// fills lost contrast on the tiles (F066). --sr-map-pin-stroke is the dark ring.
const KIND_FALLBACK: Record<HotspotKind, string> = {
  visited: '#2D8653',
  unvisited: '#5B7FA6',
  personal: '#B0701B',
}

const PIN_STROKE_FALLBACK = '#3F3F46'

function kindColor(kind: HotspotKind): string {
  if (typeof document === 'undefined') return KIND_FALLBACK[kind]
  const v = getComputedStyle(document.documentElement).getPropertyValue(`--sr-map-pin-${kind}`).trim()
  return v || KIND_FALLBACK[kind]
}

function strokeColor(): string {
  if (typeof document === 'undefined') return PIN_STROKE_FALLBACK
  const v = getComputedStyle(document.documentElement).getPropertyValue('--sr-map-pin-stroke').trim()
  return v || PIN_STROKE_FALLBACK
}

// Glyph per kind, matching the legend SVGs in MapExplorer: a check for
// visited, two dots for unvisited, a star for personal. Default white; the
// mode sprites flip it to a dark slate on the two pale-centered states
// (design-spec, decisions.md item 6) — the default call sites are unchanged,
// so the shipped kind sprites stay byte-identical.
function drawGlyph(ctx: CanvasRenderingContext2D, kind: HotspotKind, color = '#fff'): void {
  ctx.fillStyle = color
  ctx.strokeStyle = color
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
  const teardrop = new Path2D(TEARDROP)
  ctx.fillStyle = kindColor(kind)
  ctx.fill(teardrop)
  // Dark outline ring supplies the 3:1 boundary against the always-light
  // basemap tiles (the fill alone could fall under 3:1 in dark mode). F066.
  ctx.strokeStyle = strokeColor()
  ctx.lineWidth = 1.5
  ctx.stroke(teardrop)
  drawGlyph(ctx, kind)
  return ctx.getImageData(0, 0, canvas.width, canvas.height)
}

// ── Hotspot color-mode sprites (color-coded-hotspots) ──────────────────────────
//
// The FIXED 16-sprite table for the Hotspots view's opt-in color modes
// (schema.md / design-spec.md): 5 ramp tiers × 2 kinds, quiet × 2 kinds,
// unanswered × 2 kinds, plus nodata (never-birded is unvisited by
// construction) and zero (visited-with-zero is visited by construction).
// Mode fills REPLACE the kind fill; the kind survives as the baked glyph
// (FR-22). Fills read the --sr-hotspot-* tokens at bake time (theme
// MutationObserver re-bake, same contract as the kind sprites); the glyph
// colors on the two pale-centered states are sprite-baked literals under the
// basemap-anchored GL exception (design-spec "Sprite-baked glyph literals").

export type HotspotModeSpriteKey =
  | 't1-visited' | 't2-visited' | 't3-visited' | 't4-visited' | 't5-visited'
  | 't1-unvisited' | 't2-unvisited' | 't3-unvisited' | 't4-unvisited' | 't5-unvisited'
  | 'quiet-visited' | 'quiet-unvisited'
  | 'unanswered-visited' | 'unanswered-unvisited'
  | 'nodata'
  | 'zero'

export const HOTSPOT_MODE_SPRITE_KEYS: HotspotModeSpriteKey[] = [
  't1-visited', 't2-visited', 't3-visited', 't4-visited', 't5-visited',
  't1-unvisited', 't2-unvisited', 't3-unvisited', 't4-unvisited', 't5-unvisited',
  'quiet-visited', 'quiet-unvisited',
  'unanswered-visited', 'unanswered-unvisited',
  'nodata',
  'zero',
]

/** Sprite id per mode key (referenced by the mode icon-image match). */
export const HOTSPOT_MODE_IMAGE_ID: Record<HotspotModeSpriteKey, string> =
  Object.fromEntries(HOTSPOT_MODE_SPRITE_KEYS.map(k => [k, `sr-pin-mode-${k}`])) as Record<HotspotModeSpriteKey, string>

/** The hollow "answered zero" inner disc (zero + quiet states) — exported so
 *  the sidebar legend minis derive from the SAME geometry the sprites bake
 *  (the CountyDensitySwatch same-source precedent, NFR-10). */
export const HOTSPOT_HOLLOW_DISC = { cx: 14, cy: 14, r: 8.5 } as const

/** The unanswered state's dashed ring pattern. */
export const HOTSPOT_DASH_PATTERN: readonly [number, number] = [3, 2.6]

/** Sprite-baked glyph literals (design-spec): dark slate on the hollow pale
 *  disc; dark gray on the nodata fill; white everywhere else. */
export const HOTSPOT_GLYPH_ON_PALE = '#43424A'
export const HOTSPOT_GLYPH_ON_NODATA = '#52525B'

// Basemap-anchored fallbacks (theme-identical by design), used only when
// getComputedStyle is unavailable or a token is missing (tests, very early
// paint). Values = the design-spec token values.
const HOTSPOT_TOKEN_FALLBACK: Record<string, string> = {
  'hotspot-1': '#2C89AA',
  'hotspot-2': '#24709A',
  'hotspot-3': '#1C5883',
  'hotspot-4': '#153F63',
  'hotspot-5': '#0E2A47',
  'hotspot-unanswered': '#6A6A72',
  'hotspot-zero': '#565661',
  'hotspot-nodata': '#EDE9E3',
  'hotspot-pale': '#F1EEE8',
}

function hotspotToken(name: string): string {
  const fallback = HOTSPOT_TOKEN_FALLBACK[name] ?? '#000000'
  if (typeof document === 'undefined') return fallback
  const v = getComputedStyle(document.documentElement).getPropertyValue(`--sr-${name}`).trim()
  return v || fallback
}

/** The teardrop FILL token name for a mode sprite key. zero and quiet share
 *  --sr-hotspot-zero deliberately (one semantic answer, distinct wording —
 *  decisions.md item 1). */
function modeFillTokenName(key: HotspotModeSpriteKey): string {
  if (key === 'nodata') return 'hotspot-nodata'
  if (key === 'zero' || key.startsWith('quiet')) return 'hotspot-zero'
  if (key.startsWith('unanswered')) return 'hotspot-unanswered'
  return `hotspot-${key.charAt(1)}` // t1..t5 → hotspot-1..hotspot-5
}

/** The KIND whose glyph a mode sprite bakes (FR-22's non-color channel):
 *  nodata is unvisited by construction, zero is visited by construction. */
export function modeSpriteKind(key: HotspotModeSpriteKey): Exclude<HotspotKind, 'personal'> {
  if (key === 'nodata') return 'unvisited'
  if (key === 'zero') return 'visited'
  return key.endsWith('-visited') ? 'visited' : 'unvisited'
}

/**
 * Build a mode teardrop sprite as ImageData: same 28×40 teardrop and dark
 * stroke ring as the kind sprites; the mode state supplies the fill (ramp
 * tier / zero / nodata / unanswered), the hollow inner disc on zero + quiet,
 * the dashed ring on unanswered, and the glyph color. Same regenerate-on-
 * theme-change contract as teardropImageData.
 */
export function modeTeardropImageData(key: HotspotModeSpriteKey, dpr: number): ImageData {
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(TEARDROP_W * dpr)
  canvas.height = Math.round(TEARDROP_H * dpr)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('2D canvas context unavailable')
  ctx.scale(dpr, dpr)
  const teardrop = new Path2D(TEARDROP)
  ctx.fillStyle = hotspotToken(modeFillTokenName(key))
  ctx.fill(teardrop)
  ctx.strokeStyle = strokeColor()
  ctx.lineWidth = 1.5
  const dashed = key.startsWith('unanswered')
  if (dashed) ctx.setLineDash([...HOTSPOT_DASH_PATTERN])
  ctx.stroke(teardrop)
  if (dashed) ctx.setLineDash([])

  const hollow = key === 'zero' || key.startsWith('quiet')
  if (hollow) {
    ctx.beginPath()
    ctx.arc(HOTSPOT_HOLLOW_DISC.cx, HOTSPOT_HOLLOW_DISC.cy, HOTSPOT_HOLLOW_DISC.r, 0, Math.PI * 2)
    ctx.fillStyle = hotspotToken('hotspot-pale')
    ctx.fill()
  }

  const glyphColor = hollow ? HOTSPOT_GLYPH_ON_PALE
    : key === 'nodata' ? HOTSPOT_GLYPH_ON_NODATA
    : '#fff'
  drawGlyph(ctx, modeSpriteKind(key), glyphColor)
  return ctx.getImageData(0, 0, canvas.width, canvas.height)
}
