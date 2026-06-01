import { useEffect, useMemo, useState } from 'react'
import { GeoJSON, useMap, useMapEvents } from 'react-leaflet'
import type { FeatureCollection, Polygon } from 'geojson'
import { blocksInBounds, type AtlasData, type Bounds } from '../lib/atlasBlocks'

const ATLAS_BLOCK_URL = 'https://ebird.org/atlascalifornia/block/'

interface Props {
  /** Loaded gazetteer, or null while lazy-loading / before first enable. */
  data: AtlasData | null
  /** Max blocks to draw before showing the "zoom in" hint instead. */
  cap?: number
  /** Reports whether the current view has too many blocks to draw. */
  onTooManyChange?: (tooMany: boolean) => void
}

/**
 * Renders California atlas block outlines for the current map viewport only.
 * Null-render child of <MapContainer> (same pattern as MapPanner): it reads the
 * map bounds, generates the in-view blocks on the fly, and draws them as a GeoJSON
 * outline layer with a name popup per block. When too many blocks would be in view
 * it draws nothing and reports tooMany=true so the caller can show a hint.
 */
export function AtlasBlockLayer({ data, cap = 400, onTooManyChange }: Props) {
  const map = useMap()
  // Initialize from the current viewport (lazy initializer — runs once), then
  // update on every pan/zoom. Leaflet fires `moveend` after zooms too.
  const [bounds, setBounds] = useState<Bounds | null>(() => {
    try {
      const b = map.getBounds()
      return [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()]
    } catch {
      return null
    }
  })

  useMapEvents({
    moveend() {
      const b = map.getBounds()
      setBounds([b.getWest(), b.getSouth(), b.getEast(), b.getNorth()])
    },
  })

  const inView = useMemo(() => {
    if (!data || !bounds) return { blocks: [], tooMany: false }
    return blocksInBounds(data, bounds, cap)
  }, [data, bounds, cap])

  useEffect(() => {
    onTooManyChange?.(inView.tooMany)
  }, [inView.tooMany, onTooManyChange])

  const fc = useMemo<FeatureCollection<Polygon, { name: string; code: string }>>(() => ({
    type: 'FeatureCollection',
    features: inView.blocks.map(b => ({
      type: 'Feature',
      properties: { name: b.name, code: b.code },
      geometry: { type: 'Polygon', coordinates: [b.ring] },
    })),
  }), [inView.blocks])

  if (!data || inView.blocks.length === 0) return null

  // Key changes only when the drawn set changes, forcing a clean re-render.
  const key = `${inView.blocks.length}:${bounds?.map(n => n.toFixed(3)).join(',')}`

  return (
    <GeoJSON
      key={key}
      data={fc}
      // Stroke color/width come from the `.sr-atlas-block` CSS class (globals.css):
      // Leaflet writes `color` to the SVG `stroke` ATTRIBUTE, where CSS custom
      // properties (var(--sr-map-atlas)) don't resolve; a CSS class sets stroke as a
      // CSS property, which resolves the token and stays light/dark reactive.
      // fill:true + fillOpacity:0 paints an invisible interior that is still a click
      // target (so clicking INSIDE a block selects it, not an ambiguous shared edge).
      style={{ className: 'sr-atlas-block', fill: true, fillOpacity: 0 }}
      onEachFeature={(feature, layer) => {
        const props = feature.properties as { name?: string; code?: string }
        const name = props?.name
        if (!name) return
        const label = props.code
          ? `<a href="${ATLAS_BLOCK_URL}${encodeURIComponent(props.code)}" target="_blank" rel="noreferrer" style="font-weight:600;color:var(--sr-accent);text-decoration:none">${name} ↗</a>`
          : `<div style="font-weight:600">${name}</div>`
        layer.bindPopup(
          label +
          `<div style="font-size:11px;color:var(--sr-text-muted);margin-top:2px">California Breeding Bird Atlas block</div>`,
        )
      }}
    />
  )
}
