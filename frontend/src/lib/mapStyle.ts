// MapLibre style construction — single source of truth for the vector base map
// (OpenFreeMap, keyless) and the raster layers (satellite / topo / trails).
// Replaces the Leaflet-era lib/basemaps.ts.

import type { StyleSpecification } from 'maplibre-gl'

export type BaseKey = 'positron' | 'satellite' | 'topo'

/** The two keyless OpenFreeMap vector styles we're comparing for the base map. */
export type VectorVariant = 'positron' | 'liberty'
export const VECTOR_STYLE_URL: Record<VectorVariant, string> = {
  positron: 'https://tiles.openfreemap.org/styles/positron',
  liberty: 'https://tiles.openfreemap.org/styles/liberty',
}

/** Label text-size scale. 1.0 = native (Dave's current pick). Tuned live. */
export const LABEL_SCALE = 1.0

/** Persisted base/overlay choice (same keys as the v0.5.7 raster switcher). */
export const DEFAULT_BASE: BaseKey = 'positron'
export const BASE_SETTING = 'map-base-layer'
export const TRAILS_SETTING = 'map-trails-overlay'
export const BASE_LABEL: Record<BaseKey, string> = { positron: 'Map', satellite: 'Satellite', topo: 'Topo (US)' }

// Positron land-cover tints, toned to the SnowRaven brand green
// (#2D8653 ≈ hsl(147,49%,35%)) — clover-family greens, lighter/calmer, with
// three distinct values so vegetation reads apart: forest deepest → park mid →
// meadow palest. Developed = a quiet warm-neutral. Visibility via the ramps below.
export const TINT_PARK = 'hsl(142, 34%, 79%)'    // managed green, mid tone
export const TINT_WOOD = 'hsl(146, 30%, 68%)'    // forest, deepest (closest to brand)
export const TINT_GRASS = 'hsl(138, 38%, 89%)'   // meadow/grass, palest
export const TINT_DEVELOPED = 'hsl(40, 14%, 88%)'
// Fade land cover in from ~zoom 5 (was ~zoom 8) so terrain shows when more
// zoomed out. [zoom, opacity] stops.
const WOOD_OPACITY: unknown = ['interpolate', ['linear'], ['zoom'], 4, 0, 6, 0.55, 10, 0.8]
const GRASS_OPACITY: unknown = ['interpolate', ['linear'], ['zoom'], 4, 0, 6, 0.5, 10, 0.72]

// ── Basemap muting (Map Explorer county/atlas "shade" overlays) ────────────────
//
// When a shading ramp is active the Map Explorer greys the basemap's tinted LAND
// fills so the ramp pops (the green county ramp otherwise blends into the green
// Positron land). Water, roads, and labels keep their color, and the Trails
// overlay is left untouched. Raster bases (satellite/topo) get a saturation cut
// instead. Driven by components/map/BasemapDesaturation.tsx. The TINT_* greys are
// the documented hardcoded-HSL basemap exception (GL paint can't read --sr-*
// tokens; the base is always-light), NOT a token violation.

/** The Positron land-cover fill layers and the tint each carries (see
 *  fetchTunedBaseStyle). BasemapDesaturation greys these while shading is active. */
export const TINTED_LAND_LAYERS: ReadonlyArray<{ id: string; tint: string }> = [
  { id: 'park', tint: TINT_PARK },
  { id: 'landcover_wood', tint: TINT_WOOD },
  { id: 'landcover_grass', tint: TINT_GRASS },
  { id: 'landuse_residential', tint: TINT_DEVELOPED },
]

/** Raster base layers desaturated while shading is active (NOT 'sr-trails'). */
export const RASTER_BASE_LAYER_IDS = ['sr-satellite', 'sr-topo'] as const

/** MapLibre raster-saturation (-1..1) for raster bases while shading is active.
 *  A strong mute short of full grayscale, matching the "muted land" look. */
export const BASEMAP_MUTE_RASTER_SATURATION = -0.85

/** Desaturate an `hsl(H, S%, L%)` string to neutral grey (S=0), keeping lightness.
 *  Returns the input unchanged if it is not a parseable hsl() triple. */
export function desaturateHsl(hsl: string): string {
  const m = /^hsl\(\s*[\d.]+\s*,\s*[\d.]+%\s*,\s*([\d.]+)%\s*\)$/i.exec(hsl.trim())
  return m ? `hsl(0, 0%, ${m[1]}%)` : hsl
}

/** Backdrop tone (area beyond tiles) per active base — carried from the raster era. */
export const VOID_COLOR: Record<BaseKey, string> = {
  positron: '#e7eaec',
  satellite: '#0b1a2b',
  topo: '#e7eaec',
}

/** Keyless raster layers (kept from the v0.5.7 basemap work). */
export const SATELLITE_TILES = ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}']
export const SATELLITE_ATTRIB = 'Tiles © Esri — Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community'
export const TOPO_TILES = ['https://basemap.nationalmap.gov/arcgis/rest/services/USGSTopo/MapServer/tile/{z}/{y}/{x}']
export const TOPO_ATTRIB = '© USGS The National Map'
export const TRAILS_TILES = ['https://tile.waymarkedtrails.org/hiking/{z}/{x}/{y}.png']
export const TRAILS_ATTRIB = 'Trails © Waymarked Trails (CC-BY-SA)'

/** Raster base tile configs (added as toggleable layers within the one style). */
export const RASTER_BASES: Record<'satellite' | 'topo', { tiles: string[]; attribution: string; maxzoom: number }> = {
  satellite: { tiles: SATELLITE_TILES, attribution: SATELLITE_ATTRIB, maxzoom: 19 },
  topo: { tiles: TOPO_TILES, attribution: TOPO_ATTRIB, maxzoom: 16 },
}

/** Id of the first label (symbol) layer — used as beforeId so raster bases sit
 *  under the vector labels (labels render over satellite/topo). */
export function firstSymbolLayerId(style: StyleSpecification): string | undefined {
  return style.layers.find(l => l.type === 'symbol')?.id
}

// ── Offline-support: bundled glyphs + sprite (FR-10, schema slice 2b) ──────────
//
// The bundled glyph/sprite assets ARE now captured into frontend/public/mapassets/
// (v0.5.45), so the rewrite is ON: online AND offline both serve labels/symbols
// from the same-origin bundle — glyph/sprite fetches to tiles.openfreemap.org drop
// to zero (QA-02). The bundled files:
//   - frontend/public/mapassets/glyphs/{fontstack}/{range}.pbf   (Noto Sans, 3 stacks)
//   - frontend/public/mapassets/sprite/ofm.{json,png,@2x.json,@2x.png}
//
// Coverage (schema 2b/2e capture-and-bundle): a real openmaptiles vector-tile
// capture over US/CA areas — major Chinatowns, LA Koreatown/Little Tokyo, Little
// Saigon, Brighton Beach, Nunavut/Nunavik — drove the exact {fontstack}/{range}
// set requested. We bundle the "Band 1" small-script subset (~3.5 MB: 3 Noto Sans
// stacks Regular/Bold/Italic × 17 BMP ranges): Latin + accents, Cyrillic, Inuktitut
// syllabics, Vietnamese, Japanese Kana, Khmer, punctuation/symbols. CJK + Hangul
// are deliberately NOT bundled (they ran ~30–40 MB and are dense-urban business
// names, not birding labels) — those codepoints degrade to `.notdef`, never a
// network fetch (by design). Re-verify this set on any Positron base-style /
// fontstack change (the data-dependent-coverage risk, schema open-risk #3).
export const BUNDLED_MAP_ASSETS = true

/**
 * Rewrite a style's `glyphs` and `sprite` to ABSOLUTE URLs pointing at the
 * bundled, same-origin local assets (FR-10). ABSOLUTE is mandatory: maplibre's
 * `normalizeSpriteURL` hard-throws (`Invalid sprite URL … must be absolute`) on
 * a relative sprite, before any fetch. The glyph template keeps the literal
 * `{fontstack}`/`{range}` tokens un-encoded (maplibre substitutes them per-tile).
 *
 * Mutates and returns `style`. Capture the document origin at call time (this
 * runs inside `fetchTunedBaseStyle` — an effect/handler path, never render).
 */
export function rewriteStyleAssetUrls(style: StyleSpecification): StyleSpecification {
  const base = import.meta.env.BASE_URL
  // Build from the document origin — an inline (URL-less) style has no style base
  // for maplibre to resolve against, so a relative sprite would throw.
  //
  // CRITICAL: resolve only the brace-FREE prefix through `new URL()`, then append
  // the literal `{fontstack}/{range}` template as a plain string. Passing the
  // braces through `new URL()` percent-encodes them to `%7Bfontstack%7D`, which
  // maplibre cannot substitute per-tile — the glyphs would 404 and labels would
  // vanish offline (the exact failure this function exists to prevent).
  const glyphPrefix = new URL(base + 'mapassets/glyphs/', document.baseURI).href
  style.glyphs = glyphPrefix + '{fontstack}/{range}.pbf'
  style.sprite = new URL(base + 'mapassets/sprite/ofm', document.baseURI).href
  return style
}

type AnyLayer = {
  id: string
  type?: string
  source?: string
  'source-layer'?: string
  minzoom?: number
  filter?: unknown
  layout?: Record<string, unknown>
  paint?: Record<string, unknown>
}

/** Multiply a maplibre `text-size` (number or interpolate expression) by a scale. */
function scaleTextSize(size: unknown, scale: number): unknown {
  if (typeof size === 'number') return Math.round(size * scale * 10) / 10
  if (Array.isArray(size)) {
    // interpolate/step expressions: scale the numeric literals (the stop outputs).
    return size.map((v, i) =>
      typeof v === 'number' && i >= 3 ? Math.round(v * scale * 10) / 10 : v,
    )
  }
  return size
}

/**
 * Fetch the OpenFreeMap Positron style and bump every symbol layer's label
 * size by `scale`, so map labels land at the size we want. Returns a full
 * MapLibre StyleSpecification to hand to the Map component.
 */
export async function fetchTunedBaseStyle(
  variant: VectorVariant = 'positron',
  scale = LABEL_SCALE,
): Promise<StyleSpecification> {
  const res = await fetch(VECTOR_STYLE_URL[variant])
  if (!res.ok) throw new Error(`OpenFreeMap style fetch failed: ${res.status}`)
  const style = await res.json() as { layers: AnyLayer[] }
  for (const layer of style.layers) {
    // Bump label sizes toward the target (no-op at scale 1.0).
    if (scale !== 1 && layer.type === 'symbol' && layer.layout && 'text-size' in layer.layout) {
      layer.layout['text-size'] = scaleTextSize(layer.layout['text-size'], scale)
    }
    if (variant !== 'positron') continue
    // Country borders (boundary_2): darken + raise opacity so they read at the
    // zoomed-out world view (Positron ships them faint light-grey ~0.4).
    if (layer.id === 'boundary_2' && layer.paint) {
      layer.paint['line-color'] = 'hsl(0,0%,45%)'
      layer.paint['line-opacity'] = 0.8
    }
    // State/province borders (boundary_3): Positron hides them until zoom 8.
    // Show them thin + dashed from ~zoom 4 so states read when zoomed out.
    if (layer.id === 'boundary_3') {
      layer.minzoom = 4
      layer.paint = {
        ...(layer.paint ?? {}),
        'line-color': 'hsl(0,0%,60%)',
        'line-dasharray': [2, 2],
        'line-opacity': ['interpolate', ['linear'], ['zoom'], 4, 0.45, 7, 0.7],
        'line-width': ['interpolate', ['linear'], ['zoom'], 4, 0.5, 8, 1, 11, 1.6],
      }
    }
    // Tint land cover so natural vs. developed reads at a glance, while keeping
    // Positron's calm look: parks/woods → soft green, residential → warm tan.
    // (Positron ships these layers tinted near-white; we just recolor them.)
    if (layer.paint) {
      if (layer.id === 'park') {
        layer.paint['fill-color'] = TINT_PARK
      } else if (layer.id === 'landcover_wood') {
        layer.paint['fill-color'] = TINT_WOOD
        layer.paint['fill-opacity'] = WOOD_OPACITY   // show sooner than native ~z8
      } else if (layer.id === 'landuse_residential') {
        layer.paint['fill-color'] = TINT_DEVELOPED
      }
    }
  }
  // Positron lacks a grass layer — add one so meadows/fields read as natural too.
  if (variant === 'positron' && !style.layers.some(l => l.id === 'landcover_grass')) {
    const woodIdx = style.layers.findIndex(l => l.id === 'landcover_wood')
    const grass: AnyLayer = {
      id: 'landcover_grass', type: 'fill', source: 'openmaptiles', 'source-layer': 'landcover',
      filter: ['all', ['match', ['geometry-type'], ['MultiPolygon', 'Polygon'], true, false], ['==', ['get', 'class'], 'grass']],
      paint: { 'fill-color': TINT_GRASS, 'fill-opacity': GRASS_OPACITY },
    } as AnyLayer
    style.layers.splice(woodIdx >= 0 ? woodIdx + 1 : 1, 0, grass)
  }
  const tuned = style as unknown as StyleSpecification
  // Point glyphs/sprite at the bundled same-origin assets so the persisted blob
  // is already offline-correct — but ONLY once those assets are actually bundled
  // (BUNDLED_MAP_ASSETS). With the flag false the style keeps its OpenFreeMap
  // glyph/sprite URLs, so the online map's labels are unchanged.
  if (BUNDLED_MAP_ASSETS) rewriteStyleAssetUrls(tuned)
  return tuned
}
