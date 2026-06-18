// Prop-driven map children for the Map Explorer (extracted from MapExplorer.tsx
// in a behavior-preserving split). These rely on being rendered inside <SnowMap>
// (useMap context) — keep their call sites unchanged.

import { useEffect, useRef } from 'react'
import { Marker, useMap } from 'react-map-gl/maplibre'
import type { MapMouseEvent, MapTouchEvent } from 'maplibre-gl'
import { padBounds } from '../../lib/atlasBlocks'
import { neutralizeMarkerWrapper } from '../../lib/mapPins'
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

// Sets the map center from a deliberate gesture that does NOT collide with the
// left-click/tap pin selection: right-click (desktop) and long-press (touch).
// MapLibre has no built-in long-press, so we time it and cancel the instant the
// gesture becomes a pan/zoom — and never preventDefault before it fires, so a
// normal pan is untouched. `onDrop` is read through a ref so the map listeners
// bind once and don't re-bind when the parent's handler identity changes.
export function CenterPinDropper({ onDrop }: { onDrop: (lat: number, lng: number) => void }) {
  const map = useMap().current
  const onDropRef = useRef(onDrop)
  useEffect(() => { onDropRef.current = onDrop }, [onDrop])

  useEffect(() => {
    if (!map) return

    const HOLD_MS = 550
    const SLOP = 10
    // Some touch platforms synthesize a `contextmenu` right after a long-press;
    // ignore a right-click that lands just after the touch timer fired, so a single
    // hold doesn't drop the center (and re-run the search) twice. Desktop right-
    // clicks are unaffected (lastTouchFire stays in the past).
    let lastTouchFire = 0

    // Desktop: right-click. MapLibre suppresses the browser context menu over the
    // canvas and re-fires this as a map event.
    const onContextMenu = (e: MapMouseEvent) => {
      if (Date.now() - lastTouchFire < 800) return
      onDropRef.current(e.lngLat.lat, e.lngLat.lng)
    }

    // Touch: a long-press (hold without moving) on a single finger.
    let timer: ReturnType<typeof setTimeout> | null = null
    let startPoint: { x: number; y: number } | null = null
    let startLngLat: { lat: number; lng: number } | null = null
    const cancel = () => {
      if (timer) { clearTimeout(timer); timer = null }
      startPoint = null
      startLngLat = null
    }
    const onTouchStart = (e: MapTouchEvent) => {
      // A second finger is a pinch — never a center drop.
      if (e.originalEvent.touches.length !== 1) { cancel(); return }
      startPoint = { x: e.point.x, y: e.point.y }
      startLngLat = { lat: e.lngLat.lat, lng: e.lngLat.lng }
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => {
        if (startLngLat) { lastTouchFire = Date.now(); onDropRef.current(startLngLat.lat, startLngLat.lng) }
        cancel()
      }, HOLD_MS)
    }
    const onTouchMove = (e: MapTouchEvent) => {
      if (!startPoint) return
      if (Math.hypot(e.point.x - startPoint.x, e.point.y - startPoint.y) > SLOP) cancel()
    }

    map.on('contextmenu', onContextMenu)
    map.on('touchstart', onTouchStart)
    map.on('touchmove', onTouchMove)
    map.on('touchend', cancel)
    map.on('touchcancel', cancel)
    map.on('movestart', cancel)
    map.on('zoomstart', cancel)
    map.on('dragstart', cancel)
    return () => {
      map.off('contextmenu', onContextMenu)
      map.off('touchstart', onTouchStart)
      map.off('touchmove', onTouchMove)
      map.off('touchend', cancel)
      map.off('touchcancel', cancel)
      map.off('movestart', cancel)
      map.off('zoomstart', cancel)
      map.off('dragstart', cancel)
      cancel()
    }
  }, [map])

  return null
}

// The draggable center pin shown on the search views. It marks the current search
// center (from any source) and can be dragged to fine-tune; `onMove` fires on drag
// end. Keyboard users set the center via the lat/lng inputs, so the marker wrapper
// is demoted to presentational (no stray "Map marker" tab stop).
export function CenterPin({ lat, lng, onMove }: { lat: number; lng: number; onMove: (lat: number, lng: number) => void }) {
  return (
    <Marker
      longitude={lng}
      latitude={lat}
      draggable
      anchor="bottom"
      ref={neutralizeMarkerWrapper}
      onDragEnd={e => onMove(e.lngLat.lat, e.lngLat.lng)}
    >
      <svg width="30" height="30" viewBox="0 0 24 24" fill="var(--sr-accent)" stroke="var(--sr-on-accent)" strokeWidth="1.4" aria-hidden="true" style={{ filter: 'drop-shadow(0 3px 3px rgba(0,0,0,0.3))', cursor: 'grab' }}>
        <path d="M12 22s7-6.6 7-12A7 7 0 1 0 5 10c0 5.4 7 12 7 12z" />
        <circle cx="12" cy="10" r="2.6" fill="var(--sr-on-accent)" stroke="none" />
      </svg>
    </Marker>
  )
}
