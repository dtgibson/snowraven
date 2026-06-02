import { useEffect, useMemo, useState } from 'react'
import { GeoJSON, useMap, useMapEvents } from 'react-leaflet'
import type { FeatureCollection, Polygon } from 'geojson'
import { blocksInBounds, type AtlasData, type Bounds } from '../lib/atlasBlocks'
import type { BlockBreeding } from '../lib/atlasBreeding'

const ATLAS_BLOCK_URL = 'https://ebird.org/atlascalifornia/block/'

interface Props {
  /** Loaded gazetteer, or null while lazy-loading / before first enable. */
  data: AtlasData | null
  /** Max blocks to draw before showing the "zoom in" hint instead. */
  cap?: number
  /** Reports whether the current view has too many blocks to draw. */
  onTooManyChange?: (tooMany: boolean) => void
  /** When true, recorded blocks are shaded by the user's highest tier. */
  shade?: boolean
  /** block code → the user's highest breeding evidence there (null = no data). */
  breedingByBlock?: Map<string, BlockBreeding> | null
  /** When true, shaded blocks use the hatch textures; when false, flat color only. */
  useTextures?: boolean
}

/**
 * Renders California atlas block outlines for the current map viewport only.
 * Null-render child of <MapContainer> (same pattern as MapPanner): it reads the
 * map bounds, generates the in-view blocks on the fly, and draws them as a GeoJSON
 * outline layer with a name popup per block. When too many blocks would be in view
 * it draws nothing and reports tooMany=true so the caller can show a hint.
 */
export function AtlasBlockLayer({ data, cap = 5000, onTooManyChange, shade = false, breedingByBlock = null, useTextures = false }: Props) {
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

  const shadeOn = shade && !!breedingByBlock

  if (!data || inView.blocks.length === 0) return null

  // Key includes the shade/texture signature so the layer re-styles when a toggle
  // flips or the breeding data changes (Leaflet styles are applied at layer creation).
  const key = `${inView.blocks.length}:${bounds?.map(n => n.toFixed(3)).join(',')}:${shadeOn ? `s${breedingByBlock!.size}${useTextures ? 't' : 'c'}` : 'n'}`

  return (
    <GeoJSON
      key={key}
      data={fc}
      // Stroke comes from the `.sr-atlas-block` CSS class (Leaflet writes `color` to
      // the SVG stroke ATTRIBUTE, where var() doesn't resolve; a CSS class sets it as
      // a CSS property). Unshaded blocks use a transparent fill that is still a click
      // target. Shaded blocks add a per-tier class whose CSS fill is the tier pattern
      // (translucent color + hatch), so the interior is both informative and clickable.
      style={feature => {
        const code = (feature?.properties as { code?: string })?.code
        const b = shadeOn && code ? breedingByBlock!.get(code) : undefined
        if (b) {
          // textures on → hatch pattern fill; off → flat translucent color fill
          const fillClass = useTextures ? `sr-atlas-tier-${b.tier}` : `sr-atlas-fill-${b.tier}`
          return { className: `sr-atlas-block ${fillClass}`, fill: true, fillOpacity: 1 }
        }
        return { className: 'sr-atlas-block', fill: true, fillOpacity: 0 }
      }}
      onEachFeature={(feature, layer) => {
        const props = feature.properties as { name?: string; code?: string }
        const name = props?.name
        if (!name) return
        const label = props.code
          ? `<a href="${ATLAS_BLOCK_URL}${encodeURIComponent(props.code)}" target="_blank" rel="noreferrer" style="font-weight:600;color:var(--sr-accent);text-decoration:none">${name} ↗</a>`
          : `<div style="font-weight:600">${name}</div>`
        const b = shadeOn && props.code ? breedingByBlock!.get(props.code) : undefined
        const breedingLine = b
          ? `<div style="font-size:12px;margin-top:4px"><strong>Highest breeding code:</strong> ${b.label} (${b.code})</div>` +
            `<div style="font-size:11px;color:var(--sr-text-muted);margin-top:2px">${b.count} of your breeding record${b.count === 1 ? '' : 's'} (any level) in this block</div>`
          : ''
        layer.bindPopup(
          label +
          `<div style="font-size:11px;color:var(--sr-text-muted);margin-top:2px">California Breeding Bird Atlas block</div>` +
          breedingLine,
        )
      }}
    />
  )
}
