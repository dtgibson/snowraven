// Hotspot markers (GL teardrop symbols) for the Map Explorer (extracted from
// MapExplorer.tsx in a behavior-preserving split). Rendered inside <SnowMap>
// (useMap context) — keep its call site (incl. key={hotspotPins.length}) unchanged.

import { useEffect, useMemo } from 'react'
import { Source, Layer, Popup, useMap } from 'react-map-gl/maplibre'
import type { FilterSpecification, MapMouseEvent, MapStyleImageMissingEvent, SymbolLayerSpecification } from 'maplibre-gl'
import type { FeatureCollection, Point } from 'geojson'
import { HOTSPOT_KINDS, HOTSPOT_IMAGE_ID, teardropImageData, updateMapCursor, type HotspotKind } from '../../lib/mapPins'
import { hatchPixelRatio } from '../../lib/atlasTextures'
import { formatDate } from '../../lib/formatDate'
import type { HotspotPin } from '../../lib/mapExplorerTypes'

/** Reverse sprite lookup: image id → hotspot kind, null for ids that aren't
 *  ours (the styleimagemissing safety net must ignore foreign ids — other
 *  layers may legitimately miss images). */
// eslint-disable-next-line react-refresh/only-export-components -- pure lookup tested directly; lives here beside the handler that wraps it
export function hotspotKindForImage(id: string): HotspotKind | null {
  for (const kind of HOTSPOT_KINDS) {
    if (HOTSPOT_IMAGE_ID[kind] === id) return kind
  }
  return null
}

export function HotspotMarkers({ pins, hiddenKinds, sel, onSelect }: {
  pins: HotspotPin[]
  hiddenKinds: Set<HotspotPin['kind']>
  // Lifted to the parent (locId) so the keyboard sidebar list and the teardrop
  // click open the same <Popup>. (locId, not array index — the index broke when
  // kinds were hidden.)
  sel: string | null
  onSelect: (locId: string | null) => void
}) {
  const map = useMap().current
  const fitKey = pins.length

  useEffect(() => {
    if (!map || pins.length === 0) return
    if (pins.length === 1) {
      map.flyTo({ center: [pins[0].lng, pins[0].lat], zoom: 12, duration: 0 })
    } else {
      let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity
      for (const p of pins) { minLng = Math.min(minLng, p.lng); maxLng = Math.max(maxLng, p.lng); minLat = Math.min(minLat, p.lat); maxLat = Math.max(maxLat, p.lat) }
      map.fitBounds([[minLng, minLat], [maxLng, maxLat]], { padding: 50, duration: 0 })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, fitKey])

  // One GL symbol layer over a GeoJSON source replaces the per-pin DOM teardrop
  // divs (hundreds of positioned nodes re-laid-out every frame during pan/zoom).
  const fc = useMemo<FeatureCollection<Point, { locId: string; kind: HotspotPin['kind'] }>>(() => ({
    type: 'FeatureCollection',
    features: pins.map(p => ({
      type: 'Feature', properties: { locId: p.locId, kind: p.kind },
      geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
    })),
  }), [pins])

  // Register the teardrop sprites at effect time; regenerate on a light/dark
  // theme change (colors read the --sr-map-* tokens at bake time — same
  // contract as the atlas hatch sprites). addImage needs only a style object,
  // not a "loaded" style — do NOT gate this on isStyleLoaded() (false during
  // ANY tile/source churn, e.g. right after a base-layer switch) with a
  // once('load') fallback: `load` fires once per map LIFETIME, so a listener
  // armed later never fires and the symbol layer silently renders nothing.
  useEffect(() => {
    if (!map) return
    let cancelled = false
    const addAll = () => {
      if (cancelled) return
      const dpr = hatchPixelRatio()
      for (const kind of HOTSPOT_KINDS) {
        const id = HOTSPOT_IMAGE_ID[kind]
        const img = teardropImageData(kind, dpr)
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
      const kind = hotspotKindForImage(e.id)
      if (!kind || map.hasImage(e.id)) return
      const dpr = hatchPixelRatio()
      map.addImage(e.id, teardropImageData(kind, dpr), { pixelRatio: dpr })
    }
    map.on('styleimagemissing', onMissing)
    const obs = new MutationObserver(addAll)
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => { cancelled = true; obs.disconnect(); map.off('styleimagemissing', onMissing) }
  }, [map])

  // Click selects the top teardrop's hotspot; empty-map click closes the popup.
  useEffect(() => {
    if (!map) return
    const onClick = (e: MapMouseEvent) => {
      if (!map.getLayer('sr-hotspot')) return
      const f = map.queryRenderedFeatures(e.point, { layers: ['sr-hotspot'] })[0]
      const locId = (f?.properties as { locId?: unknown } | undefined)?.locId
      onSelect(typeof locId === 'string' && locId !== '' ? locId : null)
    }
    // Cursor goes through the shared arbiter (see SightingMarkers).
    const hover = (e: MapMouseEvent) => updateMapCursor(map, e.point)
    map.on('click', onClick)
    map.on('mouseenter', 'sr-hotspot', hover)
    map.on('mouseleave', 'sr-hotspot', hover)
    return () => {
      map.off('click', onClick)
      map.off('mouseenter', 'sr-hotspot', hover)
      map.off('mouseleave', 'sr-hotspot', hover)
      map.getCanvas().style.cursor = ''
    }
  }, [map, onSelect])

  // Hidden legend kinds drop out via a layer filter (no source rebuild). With
  // nothing hidden this is !(kind in []) — always true.
  const hotspotFilter = useMemo(
    () => ['!', ['in', ['get', 'kind'], ['literal', [...hiddenKinds]]]] as unknown as FilterSpecification,
    [hiddenKinds],
  )

  const symbolLayout: SymbolLayerSpecification['layout'] = {
    'icon-image': ['match', ['get', 'kind'], 'visited', HOTSPOT_IMAGE_ID.visited, 'unvisited', HOTSPOT_IMAGE_ID.unvisited, HOTSPOT_IMAGE_ID.personal],
    'icon-anchor': 'bottom',
    // DOM markers always showed every pin regardless of overlap; keep that.
    'icon-allow-overlap': true,
    'icon-ignore-placement': true,
  }

  const selPin = sel !== null ? pins.find(p => p.locId === sel && !hiddenKinds.has(p.kind)) ?? null : null

  return (
    <>
      <Source id="sr-hotspot" type="geojson" data={fc}>
        <Layer id="sr-hotspot" type="symbol" layout={symbolLayout} filter={hotspotFilter} />
      </Source>
      {selPin && (
        <Popup longitude={selPin.lng} latitude={selPin.lat} anchor="bottom" offset={42} onClose={() => onSelect(null)} closeButton={false} closeOnClick={false} maxWidth="260px">
          <div style={{ minWidth: 190 }}>
            <div style={{ fontWeight: 700, fontSize: '0.8125rem', marginBottom: 8 }}>{selPin.locName}</div>
            {selPin.kind === 'visited' && (
              <>
                <div style={{ fontSize: '0.75rem', color: 'var(--sr-accent)', marginBottom: 3 }}>{selPin.speciesCount} species recorded</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--sr-text-muted)', marginBottom: 8 }}>Last visit: {formatDate(selPin.lastVisit)}</div>
                <a href={`https://ebird.org/hotspot/${selPin.locId}`} target="_blank" rel="noreferrer" style={{ fontSize: '0.75rem', color: 'var(--sr-accent)', textDecoration: 'none', fontWeight: 500 }}>View on eBird →</a>
              </>
            )}
            {selPin.kind === 'unvisited' && (
              <a href={`https://ebird.org/hotspot/${selPin.locId}`} target="_blank" rel="noreferrer" style={{ fontSize: '0.75rem', color: 'var(--sr-accent)', textDecoration: 'none', fontWeight: 500 }}>View on eBird →</a>
            )}
            {selPin.kind === 'personal' && (
              <>
                <div style={{ display: 'inline-block', background: 'var(--sr-is-target-bg)', border: '1px solid var(--sr-warning-subtle)', color: 'var(--sr-map-personal)', borderRadius: 4, padding: '2px 6px', fontSize: '0.6875rem', fontWeight: 600, marginBottom: 8 }}>Personal Location</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--sr-text-muted)', marginBottom: 3 }}>{selPin.obsCount} observation{selPin.obsCount !== 1 ? 's' : ''}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--sr-text-muted)' }}>Last visit: {formatDate(selPin.lastVisit)}</div>
              </>
            )}
          </div>
        </Popup>
      )}
    </>
  )
}
