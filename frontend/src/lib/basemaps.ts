// Keyless map tile providers, defined in one place and shared by every map
// (Map Explorer, Species Detail, Statistics). No API keys, no accounts.
//
// Replaces the old default OpenStreetMap tiles (tile.openstreetmap.org), whose
// usage policy forbids app/self-hosted use and can be withdrawn. CARTO Positron
// is the on-brand default; Esri/USGS/Waymarked are opt-in via the layer switcher.

export type BaseLayerKey = 'positron' | 'satellite' | 'topo'

export interface BasemapDef {
  key: BaseLayerKey
  /** Short label shown in the switcher. */
  label: string
  url: string
  attribution: string
  subdomains?: string
  maxZoom: number
  /** Tile size in px (512 + zoomOffset -1 renders larger, less-cluttered labels). */
  tileSize?: number
  zoomOffset?: number
  /** Backdrop tone for the area beyond tiles, tuned so the void blends with this base. */
  voidColor: string
}

export const BASEMAPS: Record<BaseLayerKey, BasemapDef> = {
  positron: {
    key: 'positron',
    label: 'Map',
    // CARTO Positron: clean, minimal light basemap that sits quietly under data
    // pins. @2x source displayed at 256 px = native scale, crisp on high-DPI.
    url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}@2x.png',
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    subdomains: 'abcd',
    maxZoom: 20,
    tileSize: 256,
    voidColor: '#e7eaec', // light neutral matching Positron's near-white base
  },
  satellite: {
    key: 'satellite',
    label: 'Satellite',
    // Esri World Imagery uses {z}/{y}/{x} order and no subdomains.
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution:
      'Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community',
    maxZoom: 19,
    voidColor: '#0b1a2b', // dark, so the void reads with satellite imagery
  },
  topo: {
    key: 'topo',
    label: 'Topo (US)',
    // USGS National Map uses {z}/{y}/{x}. US coverage only (blank elsewhere).
    url: 'https://basemap.nationalmap.gov/arcgis/rest/services/USGSTopo/MapServer/tile/{z}/{y}/{x}',
    attribution: '&copy; <a href="https://www.usgs.gov/">USGS</a> The National Map',
    maxZoom: 16,
    voidColor: '#e7eaec',
  },
}

/** Transparent hiking-trail overlay (Waymarked Trails). Keyless. */
export const TRAILS = {
  url: 'https://tile.waymarkedtrails.org/hiking/{z}/{x}/{y}.png',
  attribution: 'Trails &copy; <a href="https://hiking.waymarkedtrails.org">Waymarked Trails</a> (CC-BY-SA)',
  maxZoom: 18,
}

export const DEFAULT_BASE: BaseLayerKey = 'positron'
export const BASE_SETTING = 'map-base-layer'
export const TRAILS_SETTING = 'map-trails-overlay'
