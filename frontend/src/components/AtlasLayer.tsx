// MapLibre version of the California atlas-blocks overlay. Blocks are generated
// for the CURRENT VIEWPORT only (blocksInBounds + a padded bbox, recomputed on
// `moveend`) instead of materializing all ~17k block polygons up front — the
// viewport cap keeps the GeoJSON source and its hit-testing small. When a view
// would exceed the cap (wide zooms), the layer draws nothing and shows a
// "zoom in" hint chip; a minzoom additionally keeps the grid from being noise
// when zoomed far out. A line layer draws the grid; a fill layer shades
// recorded blocks by the user's highest breeding tier and is the click target
// for the per-block info popup (works on any block — the unshaded fill is
// transparent but still hit-tested).

import { useEffect, useMemo, useState } from 'react'
import { Source, Layer, Popup, useMap } from 'react-map-gl/maplibre'
import type { FeatureCollection, Polygon } from 'geojson'
import type { FillLayerSpecification, LineLayerSpecification, MapGeoJSONFeature, MapLayerMouseEvent, MapStyleImageMissingEvent } from 'maplibre-gl'
import { blocksInBounds, padBounds, type AtlasData, type Bounds } from '../lib/atlasBlocks'
import type { BlockBreeding } from '../lib/atlasBreeding'
import { hatchImageData, hatchPixelRatio, HATCH_IMAGE_ID, TIERS, type Tier } from '../lib/atlasTextures'
import { updateMapCursor } from '../lib/mapPins'

// Fallback tier purples (index = tier 1..4) when the --sr-tier-N tokens can't be
// read; the live values come from the tokens so the fill tracks light/dark.
const TIER_FALLBACK: Record<Tier, string> = { 1: '#C084FC', 2: '#A855F7', 3: '#7E22CE', 4: '#3B0764' }

function tierColor(tier: Tier): string {
  if (typeof document === 'undefined') return TIER_FALLBACK[tier]
  const v = getComputedStyle(document.documentElement).getPropertyValue(`--sr-tier-${tier}`).trim()
  return v || TIER_FALLBACK[tier]
}

/** Reverse sprite lookup: image id → hatch tier, null for ids that aren't
 *  ours (the styleimagemissing safety net must ignore foreign ids — other
 *  layers may legitimately miss images). */
// eslint-disable-next-line react-refresh/only-export-components -- pure lookup tested directly; lives here beside the handler that wraps it
export function hatchTierForImage(id: string): Tier | null {
  for (const tier of TIERS) {
    if (HATCH_IMAGE_ID[tier] === id) return tier
  }
  return null
}

// Generous cap: zoom ~7 views over California (≈8–9k blocks) still render; the
// full-state zoom-6 view (≈17k blocks of unreadably dense grid) shows the
// zoom-in hint instead.
const ATLAS_BLOCK_CAP = 9000
// Bbox margin so blocks don't pop in at the edges between moveend updates.
const BOUNDS_PAD = 0.15

// Marker layers that paint above the atlas; a click on one of these must not
// also open the block popup (parity with the old DOM markers, whose clicks
// never reached the map).
const MARKER_LAYERS = ['sr-sight-circle', 'sr-hotspot']

const ATLAS_BLOCK_URL = 'https://ebird.org/atlascalifornia/block/'

interface Props {
  data: AtlasData | null
  shade?: boolean
  breedingByBlock?: Map<string, BlockBreeding> | null
  /** When true (and shading is on), shaded blocks use hatch textures, not flat color. */
  useTextures?: boolean
}

type Selected = { lng: number; lat: number; code: string; name: string }

const EMPTY_FC: FeatureCollection<Polygon, { code: string; name: string; tier: number }> =
  { type: 'FeatureCollection', features: [] }

export function AtlasLayer({ data, shade = false, breedingByBlock = null, useTextures = false }: Props) {
  const map = useMap().current
  const [sel, setSel] = useState<Selected | null>(null)
  // Bumped on a data-theme change so the tier fill colors re-resolve.
  const [themeRev, setThemeRev] = useState(0)

  // If marker layers already exist when the atlas is toggled on, insert the
  // atlas layers UNDER them (computed once at mount — layers added later are
  // appended on top anyway, which is the right order in every other sequence).
  const [insertBelow] = useState(() => MARKER_LAYERS.find(id => !!map?.getLayer(id)))

  // Current viewport, updated when a pan/zoom gesture settles.
  const [bounds, setBounds] = useState<Bounds | null>(null)
  useEffect(() => {
    if (!map) return
    const update = () => {
      const b = map.getBounds()
      setBounds([b.getWest(), b.getSouth(), b.getEast(), b.getNorth()])
    }
    update()
    map.on('moveend', update)
    return () => { map.off('moveend', update) }
  }, [map])

  const { fc, tooMany } = useMemo(() => {
    if (!data || !bounds) return { fc: EMPTY_FC, tooMany: false }
    const res = blocksInBounds(data, padBounds(bounds, BOUNDS_PAD), ATLAS_BLOCK_CAP)
    if (res.tooMany) return { fc: EMPTY_FC, tooMany: true }
    const shadeOn = shade && !!breedingByBlock
    const features = res.blocks.map(b => ({
      type: 'Feature' as const,
      properties: { code: b.code, name: b.name, tier: shadeOn ? (breedingByBlock!.get(b.code)?.tier ?? 0) : 0 },
      geometry: { type: 'Polygon' as const, coordinates: [b.ring] },
    }))
    return { fc: { type: 'FeatureCollection' as const, features }, tooMany: false }
  }, [data, bounds, shade, breedingByBlock])

  // Click a block → open its info popup. Hover → pointer cursor. Bound
  // imperatively to the fill layer so the atlas stays self-contained. A click
  // that lands on a marker (circle/teardrop above the fill) is the marker's.
  useEffect(() => {
    if (!map) return
    const onClick = (e: MapLayerMouseEvent) => {
      const markerLayers = MARKER_LAYERS.filter(id => !!map.getLayer(id))
      if (markerLayers.length > 0 && map.queryRenderedFeatures(e.point, { layers: markerLayers }).length > 0) return
      const f = e.features?.[0] as MapGeoJSONFeature | undefined
      if (!f) return
      const p = f.properties as { code?: string; name?: string }
      if (!p.name) return
      setSel({ lng: e.lngLat.lng, lat: e.lngLat.lat, code: p.code ?? '', name: p.name })
    }
    // Cursor goes through the shared arbiter so overlapping interactive layers
    // (pins/teardrops above the fill) can't strand a stale cursor.
    const hover = (e: MapLayerMouseEvent) => updateMapCursor(map, e.point)
    map.on('click', 'sr-atlas-fill', onClick)
    map.on('mouseenter', 'sr-atlas-fill', hover)
    map.on('mouseleave', 'sr-atlas-fill', hover)
    return () => {
      map.off('click', 'sr-atlas-fill', onClick)
      map.off('mouseenter', 'sr-atlas-fill', hover)
      map.off('mouseleave', 'sr-atlas-fill', hover)
      map.getCanvas().style.cursor = ''
    }
  }, [map])

  // Register the hatch sprites (for "Use Textures" fill-pattern) at effect time,
  // and regenerate them on a light/dark theme change (tier colors differ).
  // addImage needs only a style object, not a "loaded" style — do NOT gate this
  // on isStyleLoaded() (false during ANY tile/source churn) with a once('load')
  // fallback: `load` fires once per map LIFETIME, so a listener armed later
  // never fires and the fill-pattern silently renders nothing.
  useEffect(() => {
    if (!map) return
    let cancelled = false
    const addAll = () => {
      if (cancelled) return
      const dpr = hatchPixelRatio()
      for (const tier of TIERS) {
        const id = HATCH_IMAGE_ID[tier]
        const img = hatchImageData(tier, dpr)
        if (map.hasImage(id)) map.updateImage(id, img)
        else map.addImage(id, img, { pixelRatio: dpr })
      }
    }
    addAll()
    // Safety net (MapLibre's canonical mechanism): if the style ever asks for
    // one of OUR sprites before addAll has run — a style swap, an ordering we
    // haven't met — bake and add that image on demand. Foreign ids are ignored.
    const onMissing = (e: MapStyleImageMissingEvent) => {
      if (cancelled) return
      const tier = hatchTierForImage(e.id)
      if (tier === null || map.hasImage(e.id)) return
      const dpr = hatchPixelRatio()
      map.addImage(e.id, hatchImageData(tier, dpr), { pixelRatio: dpr })
    }
    map.on('styleimagemissing', onMissing)
    const onTheme = () => { addAll(); setThemeRev(n => n + 1) }
    const obs = new MutationObserver(onTheme)
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => { cancelled = true; obs.disconnect(); map.off('styleimagemissing', onMissing) }
  }, [map])

  if (!data) return null

  const shadeOn = shade && !!breedingByBlock
  const useHatch = useTextures && shadeOn

  // themeRev re-renders this component on a theme change so the token reads
  // below pick up the new palette.
  void themeRev

  const fillPaint: FillLayerSpecification['paint'] = useHatch
    ? {
        // Hatch sprites carry their own translucency; tier 0 maps to a valid image
        // but is hidden by fill-opacity 0.
        'fill-pattern': ['match', ['get', 'tier'], 1, HATCH_IMAGE_ID[1], 2, HATCH_IMAGE_ID[2], 3, HATCH_IMAGE_ID[3], 4, HATCH_IMAGE_ID[4], HATCH_IMAGE_ID[1]],
        'fill-opacity': ['case', ['>', ['get', 'tier'], 0], 1, 0],
      }
    : {
        'fill-color': ['match', ['get', 'tier'], 1, tierColor(1), 2, tierColor(2), 3, tierColor(3), 4, tierColor(4), '#000000'],
        'fill-opacity': ['case', ['>', ['get', 'tier'], 0], 0.45, 0],
      }
  const linePaint: LineLayerSpecification['paint'] = {
    'line-color': 'rgba(71,85,105,0.8)',
    'line-width': 1.3,
  }

  // Breeding detail for the open block (only meaningful when shading is on).
  const sb = sel && shadeOn && sel.code ? breedingByBlock!.get(sel.code) ?? null : null

  return (
    <>
      <Source id="sr-atlas" type="geojson" data={fc}>
        <Layer id="sr-atlas-fill" type="fill" minzoom={6} paint={fillPaint} beforeId={insertBelow} />
        <Layer id="sr-atlas-line" type="line" minzoom={6} paint={linePaint} beforeId={insertBelow} />
        {sel && (
          <Popup longitude={sel.lng} latitude={sel.lat} anchor="bottom" offset={8} closeOnClick={false} onClose={() => setSel(null)} maxWidth="240px">
            <div style={{ minWidth: 160 }}>
              {sel.code ? (
                <a href={`${ATLAS_BLOCK_URL}${encodeURIComponent(sel.code)}`} target="_blank" rel="noreferrer"
                  style={{ fontWeight: 600, color: 'var(--sr-accent)', textDecoration: 'none' }}>
                  {sel.name} ↗
                </a>
              ) : (
                <div style={{ fontWeight: 600 }}>{sel.name}</div>
              )}
              <div style={{ fontSize: '0.6875rem', color: 'var(--sr-text-muted)', marginTop: 2 }}>California Breeding Bird Atlas block</div>
              {sb && (
                <>
                  <div style={{ fontSize: '0.75rem', marginTop: 4 }}><strong>Highest breeding code:</strong> {sb.label} ({sb.code})</div>
                  <div style={{ fontSize: '0.6875rem', color: 'var(--sr-text-muted)', marginTop: 2 }}>
                    {sb.count} of your breeding record{sb.count === 1 ? '' : 's'} (any level) in this block
                  </div>
                </>
              )}
            </div>
          </Popup>
        )}
      </Source>
      {tooMany && (
        <div
          role="status"
          style={{
            position: 'absolute', bottom: 12, left: 12, zIndex: 1, pointerEvents: 'none',
            padding: '4px 10px', background: 'var(--sr-surface)', color: 'var(--sr-text-muted)',
            border: '1px solid var(--sr-border)', borderRadius: 6,
            fontSize: '0.71875rem', boxShadow: '0 1px 4px rgba(0,0,0,0.15)',
          }}
        >
          Zoom in to see atlas blocks
        </div>
      )}
    </>
  )
}
