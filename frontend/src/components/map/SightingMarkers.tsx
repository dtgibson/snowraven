// Sighting markers (GL circle pins / heatmap) for the Map Explorer (extracted
// from MapExplorer.tsx in a behavior-preserving split). Rendered inside <SnowMap>
// (useMap context) — keep its call site unchanged.

import { useEffect, useMemo, useRef, useState } from 'react'
import { Source, Layer, Popup, useMap } from 'react-map-gl/maplibre'
import type { CircleLayerSpecification, HeatmapLayerSpecification, MapMouseEvent } from 'maplibre-gl'
import type { FeatureCollection, Point } from 'geojson'
import { heatWeightDivisor, heatRadiusPx, heatIntensityFactor } from '../../lib/heat'
import { pinFillRadiusExpr, pinOpacityExpr, ATLAS_DIM_FACTOR, PIN_STROKE_WIDTH, updateMapCursor } from '../../lib/mapPins'
import { formatDate } from '../../lib/formatDate'
import type { LocationGroup, DisplayMode } from '../../lib/mapExplorerTypes'

// Resolved value of a --sr-* token, refreshed on a light/dark theme change. GL
// paint properties can't reference CSS vars, so layers that need token colors
// read them here (same contract as the atlas hatch sprites in atlasTextures.ts).
function useCssToken(name: string, fallback: string): string {
  const [value, setValue] = useState(fallback)
  useEffect(() => {
    const update = () => {
      const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
      setValue(v || fallback)
    }
    update()
    const obs = new MutationObserver(update)
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => obs.disconnect()
  }, [name, fallback])
  return value
}

export function SightingMarkers({ locations, displayMode, heatIntensity, shadingFillId, sel, onSelect }: {
  locations: LocationGroup[]
  displayMode: DisplayMode
  heatIntensity: number
  // Id of the active shading fill ('sr-atlas-fill' | 'sr-county-fill'), or undefined
  // when no ramp is shaded. When set, the heatmap sits UNDER that fill (beforeId) and
  // dims, and pins dim, so the tier colors read on top. Mutual exclusion guarantees
  // at most one ramp is active at a time.
  shadingFillId?: string
  // Selection is lifted to the parent so the keyboard-accessible sidebar list
  // and the pin click share ONE owner: clicking a pin OR a sidebar row opens
  // the same <Popup>. (closeOnClick stays off, so there's still a single owner.)
  sel: string | null
  onSelect: (locId: string | null) => void
}) {
  const map = useMap().current
  const hasFitted = useRef(false)

  useEffect(() => {
    if (hasFitted.current || !map || locations.length === 0) return
    hasFitted.current = true
    if (locations.length === 1) {
      map.flyTo({ center: [locations[0].lng, locations[0].lat], zoom: 12, duration: 0 })
    } else {
      let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity
      for (const l of locations) { minLng = Math.min(minLng, l.lng); maxLng = Math.max(maxLng, l.lng); minLat = Math.min(minLat, l.lat); maxLat = Math.max(maxLat, l.lat) }
      map.fitBounds([[minLng, minLat], [maxLng, maxLat]], { padding: 50, duration: 0 })
    }
  }, [locations, map])

  // Static GeoJSON (rebuilds only when locations change) carrying the raw count; the
  // intensity-dependent count→weight curve is applied as a paint expression below, so
  // dragging the slider only updates paint instead of rebuilding the whole source.
  const heatFc = useMemo<FeatureCollection<Point, { count: number }>>(() => ({
    type: 'FeatureCollection',
    features: locations.map(l => ({
      type: 'Feature', properties: { count: l.count },
      geometry: { type: 'Point', coordinates: [l.lng, l.lat] },
    })),
  }), [locations])

  // Pins source — the sightings render as ONE GL circle layer (paint expressions
  // over locId/count properties) instead of a DOM <Marker> per location, which
  // janked with hundreds-to-thousands of positioned divs updating every frame.
  const pinsFc = useMemo<FeatureCollection<Point, { locId: string; count: number }>>(() => ({
    type: 'FeatureCollection',
    features: locations.map(l => ({
      type: 'Feature', properties: { locId: l.locId, count: l.count },
      geometry: { type: 'Point', coordinates: [l.lng, l.lat] },
    })),
  }), [locations])

  // Basemap-anchored tokens (same value in both themes): the Positron basemap
  // stays light in dark mode, so theme-lightened --sr-map-* fills lost contrast
  // on the tiles (F066). --sr-map-pin-* are tuned against the land tint; the
  // dark stroke ring supplies the 3:1 boundary the old white stroke didn't.
  const pinColor = useCssToken('--sr-map-pin-visited', '#2D8653')
  const pinStroke = useCssToken('--sr-map-pin-stroke', '#3F3F46')

  // Click selects the top circle's location; a click on empty map closes the
  // popup. Selection has ONE owner (the Popup's own closeOnClick is off), so
  // there is no event-ordering race between closing and re-selecting.
  useEffect(() => {
    if (!map || displayMode !== 'pins') return
    const onClick = (e: MapMouseEvent) => {
      if (!map.getLayer('sr-sight-circle')) return
      const f = map.queryRenderedFeatures(e.point, { layers: ['sr-sight-circle'] })[0]
      const locId = (f?.properties as { locId?: unknown } | undefined)?.locId
      onSelect(typeof locId === 'string' && locId !== '' ? locId : null)
    }
    // Cursor goes through the shared arbiter: on leave the pointer may still be
    // over another interactive layer (e.g. a shaded atlas block under the pin).
    const hover = (e: MapMouseEvent) => updateMapCursor(map, e.point)
    map.on('click', onClick)
    map.on('mouseenter', 'sr-sight-circle', hover)
    map.on('mouseleave', 'sr-sight-circle', hover)
    return () => {
      map.off('click', onClick)
      map.off('mouseenter', 'sr-sight-circle', hover)
      map.off('mouseleave', 'sr-sight-circle', hover)
      map.getCanvas().style.cursor = ''
    }
  }, [map, displayMode, onSelect])

  // Selection + its popup are computed once and rendered in BOTH pins and heatmap
  // modes, so the keyboard "Sightings in view" list opens the details popup either way.
  const selLoc = sel ? locations.find(l => l.locId === sel) : null
  const sightPopup = selLoc && (
    <Popup longitude={selLoc.lng} latitude={selLoc.lat} anchor="bottom" offset={10} onClose={() => onSelect(null)} closeButton={false} closeOnClick={false} maxWidth="260px">
      <div style={{ minWidth: 190 }}>
        <div className="sr-wrap-anywhere" style={{ fontWeight: 700, fontSize: '0.8125rem', marginBottom: 6 }}>{selLoc.locName}</div>
        <div style={{ fontSize: '0.75rem', color: 'var(--sr-accent)', marginBottom: 3 }}>
          {selLoc.count.toLocaleString()} observation{selLoc.count !== 1 ? 's' : ''}
        </div>
        <div style={{ fontSize: '0.75rem', color: 'var(--sr-text-muted)', marginBottom: 10 }}>Last: {formatDate(selLoc.lastDate)}</div>
        <div style={{ fontSize: '0.625rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--sr-text-muted)', marginBottom: 5 }}>Species seen here</div>
        {[...selLoc.species].slice(0, 5).map(s => (
          <div key={s} className="sr-wrap-anywhere" style={{ fontSize: '0.75rem', color: 'var(--sr-text)', marginBottom: 2 }}>{s}</div>
        ))}
        {selLoc.species.size > 5 && (
          <div style={{ fontSize: '0.75rem', color: 'var(--sr-text-muted)', marginTop: 2 }}>+{selLoc.species.size - 5} more species</div>
        )}
      </div>
    </Popup>
  )

  if (displayMode === 'heatmap') {
    const divisor = heatWeightDivisor(heatIntensity)
    return (
      <>
        {/* key matches the id: the pins/heatmap branches put a <Source> at the same
            tree position with DIFFERENT ids, and an unkeyed swap makes React reuse
            the instance — react-map-gl asserts ("source id changed") and crashes the
            app. Distinct keys force unmount/remount on a mode toggle. */}
        <Source key="sr-heat" id="sr-heat" type="geojson" data={heatFc}>
          {/* When a shading ramp (atlas or county) is on, sit the heatmap UNDER
              that fill (beforeId) and dim it, so the tier colors read on top. */}
          <Layer id="sr-heat" type="heatmap"
            beforeId={shadingFillId}
            paint={{
            // min(count / divisor, 1) — matches lib/heat.ts heatWeight, as an expression.
            'heatmap-weight': ['min', ['/', ['get', 'count'], divisor], 1],
            'heatmap-intensity': heatIntensityFactor(heatIntensity),
            'heatmap-radius': heatRadiusPx(heatIntensity),
            'heatmap-opacity': shadingFillId ? 0.45 : 0.85,
          } as HeatmapLayerSpecification['paint']} />
        </Source>
        {sightPopup}
      </>
    )
  }

  const dim = shadingFillId ? ATLAS_DIM_FACTOR : 1
  const circlePaint: CircleLayerSpecification['paint'] = {
    'circle-radius': pinFillRadiusExpr(),
    'circle-color': pinColor,
    'circle-opacity': pinOpacityExpr(dim),
    'circle-stroke-color': pinStroke,
    'circle-stroke-width': PIN_STROKE_WIDTH,
    'circle-stroke-opacity': pinOpacityExpr(dim),
  }

  return (
    <>
      {/* key matches the id — see the heatmap branch's note. */}
      <Source key="sr-sight" id="sr-sight" type="geojson" data={pinsFc}>
        <Layer id="sr-sight-circle" type="circle" paint={circlePaint} />
      </Source>
      {sightPopup}
    </>
  )
}
