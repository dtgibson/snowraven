// Prop-driven map children for the Map Explorer (extracted from MapExplorer.tsx
// in a behavior-preserving split). These rely on being rendered inside <SnowMap>
// (useMap context) — keep their call sites unchanged.

import { useEffect } from 'react'
import { Marker, useMap } from 'react-map-gl/maplibre'
import { padBounds } from '../../lib/atlasBlocks'
import type { MarkerBounds } from '../../lib/markersInView'

// Imperative map effects (pan-to a target, jump to default center). react-map-gl
// auto-resizes the canvas, so no AutoSizeMap is needed. setState callbacks are
// deferred to a microtask so they don't run synchronously inside the effect.
export function MapEffects({ panTarget, onPanDone, defaultCenter, onDefaultDone }: {
  panTarget: { lat: number; lng: number } | null
  onPanDone: () => void
  defaultCenter: { lat: number; lng: number; zoom: number } | null
  onDefaultDone: () => void
}) {
  const map = useMap().current
  useEffect(() => {
    if (!panTarget || !map) return
    map.flyTo({ center: [panTarget.lng, panTarget.lat], duration: 600 })
    queueMicrotask(onPanDone)
  }, [panTarget, map, onPanDone])
  useEffect(() => {
    if (!defaultCenter || !map) return
    map.flyTo({ center: [defaultCenter.lng, defaultCenter.lat], zoom: defaultCenter.zoom, duration: 0 })
    queueMicrotask(onDefaultDone)
  }, [defaultCenter, map, onDefaultDone])
  return null
}

// Reports the current map viewport (padded) up to the parent on load + every
// `moveend`, so the parent can scope the keyboard-accessible in-view marker
// lists to what's on screen — the same viewport-cap idea AtlasLayer uses for
// blocks. The map instance is only reachable via useMap() inside <SnowMap>, so
// this lives as a child and pushes bounds out through a callback.
export function BoundsTracker({ onBounds }: { onBounds: (b: MarkerBounds) => void }) {
  const map = useMap().current
  useEffect(() => {
    if (!map) return
    const report = () => {
      const b = map.getBounds()
      // Pad 15% like the atlas overlay so a list item near the edge doesn't pop
      // out of the list during a small pan before the next moveend settles.
      onBounds(padBounds(
        [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()],
        0.15,
      ))
    }
    report()
    map.on('moveend', report)
    return () => { map.off('moveend', report) }
  }, [map, onBounds])
  return null
}

export function DetectedLocationPin({ position }: { position: { lat: number; lng: number } }) {
  return (
    <Marker longitude={position.lng} latitude={position.lat} anchor="center">
      <div style={{ width: 18, height: 18, borderRadius: '50%', background: '#1D6BCC', border: '2.5px solid #fff', boxShadow: '0 1px 4px rgba(0,0,0,0.4)' }} />
    </Marker>
  )
}
