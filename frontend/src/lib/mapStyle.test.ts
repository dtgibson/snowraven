// @vitest-environment jsdom
// With BUNDLED_MAP_ASSETS=true, fetchTunedBaseStyle now calls rewriteStyleAssetUrls,
// which resolves the bundled glyph/sprite URLs against document.baseURI — so this
// (otherwise node-env) file needs a DOM, like mapStyleRewrite.test.ts.
import { describe, it, expect, vi, afterEach } from 'vitest'
import type { StyleSpecification } from 'maplibre-gl'
import {
  fetchTunedBaseStyle,
  firstSymbolLayerId,
  DEFAULT_BASE,
  VECTOR_STYLE_URL,
  RASTER_BASES,
  BASE_LABEL,
} from './mapStyle'

// A loose layer view so tests can read paint/layout without the strict maplibre
// layer union. fetchTunedBaseStyle returns a StyleSpecification; we re-narrow.
type LooseLayer = {
  id: string
  type?: string
  minzoom?: number
  'source-layer'?: string
  layout?: Record<string, unknown>
  paint?: Record<string, unknown>
  filter?: unknown
}

function layersOf(style: StyleSpecification): LooseLayer[] {
  return style.layers as unknown as LooseLayer[]
}
function find(style: StyleSpecification, id: string): LooseLayer | undefined {
  return layersOf(style).find(l => l.id === id)
}

// Minimal OpenFreeMap-positron-shaped style with the layers the tuner touches.
function fixtureStyle() {
  return {
    version: 8,
    name: 'positron',
    sources: { openmaptiles: { type: 'vector', url: '' } },
    layers: [
      { id: 'background', type: 'background', paint: { 'background-color': '#fff' } },
      { id: 'park', type: 'fill', source: 'openmaptiles', 'source-layer': 'park', paint: { 'fill-color': '#eeeeee' } },
      { id: 'landcover_wood', type: 'fill', source: 'openmaptiles', 'source-layer': 'landcover', paint: { 'fill-color': '#eeeeee' } },
      { id: 'landuse_residential', type: 'fill', source: 'openmaptiles', 'source-layer': 'landuse', paint: { 'fill-color': '#eeeeee' } },
      { id: 'boundary_2', type: 'line', source: 'openmaptiles', 'source-layer': 'boundary', paint: { 'line-color': '#cccccc', 'line-opacity': 0.4 } },
      { id: 'boundary_3', type: 'line', source: 'openmaptiles', 'source-layer': 'boundary', minzoom: 8, paint: { 'line-color': '#dddddd' } },
      { id: 'place_label', type: 'symbol', source: 'openmaptiles', 'source-layer': 'place', layout: { 'text-size': 12 } },
    ],
  }
}

function stubFetch(ok: boolean, body?: unknown) {
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok, status: ok ? 200 : 500, json: async () => body })))
}

afterEach(() => vi.unstubAllGlobals())

describe('constants', () => {
  it('defaults to the positron vector base', () => {
    expect(DEFAULT_BASE).toBe('positron')
    expect(VECTOR_STYLE_URL.positron).toMatch(/openfreemap\.org/)
    expect(VECTOR_STYLE_URL.liberty).toMatch(/openfreemap\.org/)
  })

  it('labels every base key for the switcher', () => {
    expect(BASE_LABEL.positron).toBeTruthy()
    expect(BASE_LABEL.satellite).toBeTruthy()
    expect(BASE_LABEL.topo).toBeTruthy()
  })

  it('exposes keyless raster bases with sane maxzooms', () => {
    expect(RASTER_BASES.satellite.tiles[0]).toMatch(/^https:\/\//)
    expect(RASTER_BASES.topo.tiles[0]).toMatch(/^https:\/\//)
    expect(RASTER_BASES.satellite.maxzoom).toBeGreaterThan(0)
    expect(RASTER_BASES.topo.maxzoom).toBeGreaterThan(0)
  })
})

describe('firstSymbolLayerId', () => {
  it('returns the id of the first symbol layer', () => {
    const style = fixtureStyle() as unknown as StyleSpecification
    expect(firstSymbolLayerId(style)).toBe('place_label')
  })

  it('returns undefined when there is no symbol layer', () => {
    const style = { version: 8, name: 'x', sources: {}, layers: [{ id: 'bg', type: 'background' }] } as unknown as StyleSpecification
    expect(firstSymbolLayerId(style)).toBeUndefined()
  })
})

describe('fetchTunedBaseStyle (positron)', () => {
  it('darkens country borders (boundary_2)', async () => {
    stubFetch(true, fixtureStyle())
    const style = await fetchTunedBaseStyle('positron')
    const b2 = find(style, 'boundary_2')
    expect(b2?.paint?.['line-color']).toBe('hsl(0,0%,45%)')
    expect(b2?.paint?.['line-opacity']).toBe(0.8)
  })

  it('reveals state/province borders (boundary_3) from zoom 4, thin + dashed', async () => {
    stubFetch(true, fixtureStyle())
    const style = await fetchTunedBaseStyle('positron')
    const b3 = find(style, 'boundary_3')
    expect(b3?.minzoom).toBe(4)
    expect(b3?.paint?.['line-color']).toBe('hsl(0,0%,60%)')
    expect(b3?.paint?.['line-dasharray']).toEqual([2, 2])
  })

  it('tints park, wood, and residential land cover', async () => {
    stubFetch(true, fixtureStyle())
    const style = await fetchTunedBaseStyle('positron')
    expect(find(style, 'park')?.paint?.['fill-color']).toBe('hsl(142, 34%, 79%)')
    expect(find(style, 'landcover_wood')?.paint?.['fill-color']).toBe('hsl(146, 30%, 68%)')
    expect(find(style, 'landuse_residential')?.paint?.['fill-color']).toBe('hsl(40, 14%, 88%)')
  })

  it('inserts a grass land-cover layer directly after the wood layer', async () => {
    stubFetch(true, fixtureStyle())
    const style = await fetchTunedBaseStyle('positron')
    const ids = layersOf(style).map(l => l.id)
    const grass = find(style, 'landcover_grass')
    expect(grass).toBeDefined()
    expect(grass?.paint?.['fill-color']).toBe('hsl(138, 38%, 89%)')
    expect(ids.indexOf('landcover_grass')).toBe(ids.indexOf('landcover_wood') + 1)
  })

  it('leaves label text-size untouched at the native scale (1.0)', async () => {
    stubFetch(true, fixtureStyle())
    const style = await fetchTunedBaseStyle('positron')
    expect(find(style, 'place_label')?.layout?.['text-size']).toBe(12)
  })

  it('scales label text-size when a non-native scale is requested', async () => {
    stubFetch(true, fixtureStyle())
    const style = await fetchTunedBaseStyle('positron', 2)
    expect(find(style, 'place_label')?.layout?.['text-size']).toBe(24)
  })
})

describe('fetchTunedBaseStyle (liberty)', () => {
  it('does not apply the positron-only tuning', async () => {
    stubFetch(true, fixtureStyle())
    const style = await fetchTunedBaseStyle('liberty')
    // borders untouched, no grass layer inserted
    expect(find(style, 'boundary_2')?.paint?.['line-color']).toBe('#cccccc')
    expect(find(style, 'landcover_grass')).toBeUndefined()
  })
})

describe('fetchTunedBaseStyle (errors)', () => {
  it('throws when the style fetch fails', async () => {
    stubFetch(false)
    await expect(fetchTunedBaseStyle('positron')).rejects.toThrow(/style fetch failed/i)
  })
})
