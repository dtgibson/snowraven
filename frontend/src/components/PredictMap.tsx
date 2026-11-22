// The Predict location picker map — a draggable pin on the shared SnowMap. Split
// into its own module so it (and maplibre-gl) load only when the user opens
// Predict, keeping the always-mounted Weather tab's first paint light.

import { useEffect, type RefObject } from 'react'
import { Marker, useMap } from 'react-map-gl/maplibre'
import type { MapMouseEvent } from 'maplibre-gl'
import { SnowMap } from './SnowMap'
import { MapCornerControls } from './map/MapCornerControls'
import { useMapFullscreenContext } from '../lib/useMapFullscreen'
import { PICKER_NOTE_NO_PIN, PICKER_NOTE_PIN } from '../lib/mapStillCopy'
import { continuesOpeningPress, type OpeningPress } from '../lib/mapOpeningTap'

export interface LatLng { lat: number; lng: number }

// The map's box is its host's `.sr-wx-pick-map` container (WeatherForecastPanel):
// 180px on phones (the audited-fine floor), growing to ~280px on wide screens.
// It moved off this file's inline style so the fullscreen panel class can size
// it (map-scroll-on-phones D-12; maps.md trap c). The map fills it.
const MAP_STYLE = { height: '100%', width: '100%' } as const

/** The top-centre statement while the picker is expanded (D-12): plain text,
 *  not a live region, taking no pointer. Drawn only inside `.sr-map-fs-panel`. */
function PickerNote({ hasPin }: { hasPin: boolean }) {
  const fs = useMapFullscreenContext()
  if (!fs?.expanded) return null
  return (
    <div className="sr-map-note">
      <span>{hasPin ? PICKER_NOTE_PIN : PICKER_NOTE_NO_PIN}</span>
    </div>
  )
}

interface Props {
  coord: LatLng | null
  onPick: (c: LatLng) => void
  /** The press that opened the picker in fullscreen, recorded by its host
   *  (WeatherForecastPanel). A tap that continues it is the second tap of the
   *  opening double tap and drops no pin (QA round 1). */
  openPress?: RefObject<OpeningPress | null>
}

// Binds map click → pin placement, recenters when the coord changes from search
// or current-location, and renders the draggable marker.
function Pin({ coord, onPick, openPress }: Props) {
  const map = useMap().current

  useEffect(() => {
    if (!map) return
    const handler = (e: MapMouseEvent) => {
      // The second tap of the double tap that opened the map lands on the map
      // it just opened: it is the rest of that gesture, not a pick (QA round 1:
      // 16 of 16 runs dropped a pin there). A deliberate tap drops one.
      if (continuesOpeningPress(openPress?.current, e.originalEvent)) return
      onPick({ lat: e.lngLat.lat, lng: e.lngLat.lng })
    }
    map.on('click', handler)
    return () => { map.off('click', handler) }
  }, [map, onPick, openPress])

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

export function PredictMap({ coord, onPick, openPress }: Props) {
  return (
    <SnowMap
      initialViewState={{ longitude: coord?.lng ?? -98, latitude: coord?.lat ?? 39, zoom: coord ? 11 : 3 }}
      style={MAP_STYLE}
      scrollZoom={false}
    >
      <Pin coord={coord} onPick={onPick} openPress={openPress} />
      <PickerNote hasPin={coord !== null} />
      {/* Exit alone, and only while expanded: a location input has no row in
          the page and no share pin (D-12, D-13's sibling). The row also owns
          the resize on the class swap and the gesture posture release. */}
      <MapCornerControls compact={false} share={false} fsOnly />
    </SnowMap>
  )
}
