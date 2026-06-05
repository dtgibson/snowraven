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
const TINT_PARK = 'hsl(142, 34%, 79%)'    // managed green, mid tone
const TINT_WOOD = 'hsl(146, 30%, 68%)'    // forest, deepest (closest to brand)
const TINT_GRASS = 'hsl(138, 38%, 89%)'   // meadow/grass, palest
const TINT_DEVELOPED = 'hsl(40, 14%, 88%)'
// Fade land cover in from ~zoom 5 (was ~zoom 8) so terrain shows when more
// zoomed out. [zoom, opacity] stops.
const WOOD_OPACITY: unknown = ['interpolate', ['linear'], ['zoom'], 4, 0, 6, 0.55, 10, 0.8]
const GRASS_OPACITY: unknown = ['interpolate', ['linear'], ['zoom'], 4, 0, 6, 0.5, 10, 0.72]

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
  return style as unknown as StyleSpecification
}
