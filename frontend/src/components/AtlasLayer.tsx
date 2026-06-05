// MapLibre version of the California atlas-blocks overlay. The full block set is
// generated once into a GeoJSON source (MapLibre renders large vector data
// efficiently — no viewport cap needed; a minzoom keeps it from being noise when
// zoomed out). A line layer draws the grid; a fill layer shades recorded blocks
// by the user's highest breeding tier and is the click target for the per-block
// info popup (works on any block — the unshaded fill is transparent but still
// hit-tested). Hatch textures are added in the next sub-step (3b-2).

import { useEffect, useMemo, useState } from 'react'
import { Source, Layer, Popup, useMap } from 'react-map-gl/maplibre'
import type { FeatureCollection, Polygon } from 'geojson'
import type { FillLayerSpecification, LineLayerSpecification, MapGeoJSONFeature, MapLayerMouseEvent } from 'maplibre-gl'
import { generateBlocks, type AtlasData } from '../lib/atlasBlocks'
import type { BlockBreeding } from '../lib/atlasBreeding'
import { hatchImageData, hatchPixelRatio, HATCH_IMAGE_ID, TIERS } from '../lib/atlasTextures'

// Tier purples (index = tier 1..4); match --sr-tier-1..4.
const TIER_COLORS = ['#C084FC', '#A855F7', '#7E22CE', '#3B0764']

const ATLAS_BLOCK_URL = 'https://ebird.org/atlascalifornia/block/'

interface Props {
  data: AtlasData | null
  shade?: boolean
  breedingByBlock?: Map<string, BlockBreeding> | null
  /** When true (and shading is on), shaded blocks use hatch textures, not flat color. */
  useTextures?: boolean
}

type Selected = { lng: number; lat: number; code: string; name: string }

export function AtlasLayer({ data, shade = false, breedingByBlock = null, useTextures = false }: Props) {
  const map = useMap().current
  const [sel, setSel] = useState<Selected | null>(null)

  const fc = useMemo<FeatureCollection<Polygon, { code: string; name: string; tier: number }>>(() => {
    if (!data) return { type: 'FeatureCollection', features: [] }
    const shadeOn = shade && !!breedingByBlock
    const features = []
    for (const quad of data.quads) {
      for (const b of generateBlocks(quad, data.scheme)) {
        const tier = shadeOn ? (breedingByBlock!.get(b.code)?.tier ?? 0) : 0
        features.push({
          type: 'Feature' as const,
          properties: { code: b.code, name: b.name, tier },
          geometry: { type: 'Polygon' as const, coordinates: [b.ring] },
        })
      }
    }
    return { type: 'FeatureCollection', features }
  }, [data, shade, breedingByBlock])

  // Click a block → open its info popup. Hover → pointer cursor. Bound
  // imperatively to the fill layer so the atlas stays self-contained.
  useEffect(() => {
    if (!map) return
    const onClick = (e: MapLayerMouseEvent) => {
      const f = e.features?.[0] as MapGeoJSONFeature | undefined
      if (!f) return
      const p = f.properties as { code?: string; name?: string }
      if (!p.name) return
      setSel({ lng: e.lngLat.lng, lat: e.lngLat.lat, code: p.code ?? '', name: p.name })
    }
    const enter = () => { map.getCanvas().style.cursor = 'pointer' }
    const leave = () => { map.getCanvas().style.cursor = '' }
    map.on('click', 'sr-atlas-fill', onClick)
    map.on('mouseenter', 'sr-atlas-fill', enter)
    map.on('mouseleave', 'sr-atlas-fill', leave)
    return () => {
      map.off('click', 'sr-atlas-fill', onClick)
      map.off('mouseenter', 'sr-atlas-fill', enter)
      map.off('mouseleave', 'sr-atlas-fill', leave)
    }
  }, [map])

  // Register the hatch sprites (for "Use Textures" fill-pattern) once the style is
  // ready, and regenerate them on a light/dark theme change (tier colors differ).
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
    if (map.isStyleLoaded()) addAll()
    else map.once('load', addAll)
    const obs = new MutationObserver(addAll)
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => { cancelled = true; obs.disconnect(); map.off('load', addAll) }
  }, [map])

  if (!data) return null

  const shadeOn = shade && !!breedingByBlock
  const useHatch = useTextures && shadeOn

  const fillPaint: FillLayerSpecification['paint'] = useHatch
    ? {
        // Hatch sprites carry their own translucency; tier 0 maps to a valid image
        // but is hidden by fill-opacity 0.
        'fill-pattern': ['match', ['get', 'tier'], 1, HATCH_IMAGE_ID[1], 2, HATCH_IMAGE_ID[2], 3, HATCH_IMAGE_ID[3], 4, HATCH_IMAGE_ID[4], HATCH_IMAGE_ID[1]],
        'fill-opacity': ['case', ['>', ['get', 'tier'], 0], 1, 0],
      }
    : {
        'fill-color': ['match', ['get', 'tier'], 1, TIER_COLORS[0], 2, TIER_COLORS[1], 3, TIER_COLORS[2], 4, TIER_COLORS[3], '#000000'],
        'fill-opacity': ['case', ['>', ['get', 'tier'], 0], 0.45, 0],
      }
  const linePaint: LineLayerSpecification['paint'] = {
    'line-color': 'rgba(71,85,105,0.8)',
    'line-width': 1.3,
  }

  // Breeding detail for the open block (only meaningful when shading is on).
  const sb = sel && shadeOn && sel.code ? breedingByBlock!.get(sel.code) ?? null : null

  return (
    <Source id="sr-atlas" type="geojson" data={fc}>
      <Layer id="sr-atlas-fill" type="fill" minzoom={6} paint={fillPaint} />
      <Layer id="sr-atlas-line" type="line" minzoom={6} paint={linePaint} />
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
            <div style={{ fontSize: 11, color: 'var(--sr-text-muted)', marginTop: 2 }}>California Breeding Bird Atlas block</div>
            {sb && (
              <>
                <div style={{ fontSize: 12, marginTop: 4 }}><strong>Highest breeding code:</strong> {sb.label} ({sb.code})</div>
                <div style={{ fontSize: 11, color: 'var(--sr-text-muted)', marginTop: 2 }}>
                  {sb.count} of your breeding record{sb.count === 1 ? '' : 's'} (any level) in this block
                </div>
              </>
            )}
          </div>
        </Popup>
      )}
    </Source>
  )
}
