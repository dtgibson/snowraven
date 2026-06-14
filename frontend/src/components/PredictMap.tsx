// The Predict location picker map — a draggable pin on the shared SnowMap. Split
// into its own module so it (and maplibre-gl) load only when the user opens
// Predict, keeping the always-mounted Weather tab's first paint light.

import { useEffect } from 'react'
import { Marker, useMap } from 'react-map-gl/maplibre'
import type { MapMouseEvent } from 'maplibre-gl'
import { SnowMap } from './SnowMap'

export interface LatLng { lat: number; lng: number }

interface Props {
  coord: LatLng | null
  onPick: (c: LatLng) => void
}

// Binds map click → pin placement, recenters when the coord changes from search
// or current-location, and renders the draggable marker.
function Pin({ coord, onPick }: Props) {
  const map = useMap().current

  useEffect(() => {
    if (!map) return
    const handler = (e: MapMouseEvent) => onPick({ lat: e.lngLat.lat, lng: e.lngLat.lng })
    map.on('click', handler)
    return () => { map.off('click', handler) }
  }, [map, onPick])

  useEffect(() => {
    if (map && coord) map.flyTo({ center: [coord.lng, coord.lat], duration: 500 })
  }, [map, coord])

  if (!coord) return null
  return (
    <Marker
      longitude={coord.lng}
      latitude={coord.lat}
      draggable
      anchor="bottom"
      onDragEnd={e => onPick({ lat: e.lngLat.lat, lng: e.lngLat.lng })}
    >
      <svg width="30" height="30" viewBox="0 0 24 24" fill="var(--sr-accent)" stroke="var(--sr-on-accent)" strokeWidth="1.4" aria-hidden="true" style={{ filter: 'drop-shadow(0 3px 3px rgba(0,0,0,0.3))', cursor: 'grab' }}>
        <path d="M12 22s7-6.6 7-12A7 7 0 1 0 5 10c0 5.4 7 12 7 12z" />
        <circle cx="12" cy="10" r="2.6" fill="var(--sr-on-accent)" stroke="none" />
      </svg>
    </Marker>
  )
}

export function PredictMap({ coord, onPick }: Props) {
  return (
    <SnowMap
      initialViewState={{ longitude: coord?.lng ?? -98, latitude: coord?.lat ?? 39, zoom: coord ? 11 : 3 }}
      style={{ height: 180, width: '100%', borderRadius: 9, overflow: 'hidden', border: '1px solid var(--sr-border-input)' }}
      scrollZoom={false}
    >
      <Pin coord={coord} onPick={onPick} />
    </SnowMap>
  )
}
