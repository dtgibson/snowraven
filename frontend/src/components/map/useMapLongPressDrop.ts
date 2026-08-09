// The shared "deliberate point gesture" on a MapLibre map: right-click (desktop)
// and long-press (touch), with every cancel case already proven in the field.
//
// This is a VERBATIM extraction of CenterPinDropper's effect body (v0.5.43).
// Nothing in it was ever center-specific — only the component's name was. Both
// CenterPinDropper (the Map Explorer search center) and SharePin (the Pin Share
// pin) call it, so the seven cancel cases exist once and cannot drift apart
// (NFR-09: "reused, not re-implemented in parallel"). components/map/
// CenterPinDropper.test.tsx passing byte-unchanged after the extraction IS the
// evidence that the center-view drop path did not move.
//
// It deliberately does NOT collide with left-click/tap pin selection, and it
// never calls preventDefault before the timer fires, so an ordinary pan is
// untouched (FR-05).
//
// Lives in components/map/ rather than lib/ even though it is a hook: lib/ is
// where map-free code lives, and a stray maplibre import from there is exactly
// how the vendor chunk leaks onto first paint.

import { useEffect, useRef } from 'react'
import { useMap } from 'react-map-gl/maplibre'
import type { MapMouseEvent, MapTouchEvent } from 'maplibre-gl'

/** Hold time before a stationary single-finger touch counts as a long-press. */
export const LONG_PRESS_HOLD_MS = 550
/** Movement tolerance (px) before a hold is re-read as a pan. Also the single
 *  source for any activation-vs-drag slop comparison — reuse it, don't retype 10. */
export const LONG_PRESS_SLOP = 10
/** Some touch platforms synthesize a `contextmenu` right after a long-press;
 *  ignore a right-click that lands within this window of the touch timer firing
 *  so one hold drops one pin, not two. */
export const CONTEXTMENU_DEDUP_MS = 800

/**
 * Binds the gesture to the enclosing <SnowMap>. `onDrop` is read through a ref
 * so the map listeners bind once and don't re-bind when the caller's handler
 * identity changes.
 */
export function useMapLongPressDrop(onDrop: (lat: number, lng: number) => void): void {
  const map = useMap().current
  const onDropRef = useRef(onDrop)
  useEffect(() => { onDropRef.current = onDrop }, [onDrop])

  useEffect(() => {
    if (!map) return

    const HOLD_MS = LONG_PRESS_HOLD_MS
    const SLOP = LONG_PRESS_SLOP
    // Desktop right-clicks are unaffected (lastTouchFire stays in the past).
    let lastTouchFire = 0

    // Desktop: right-click. MapLibre suppresses the browser context menu over the
    // canvas and re-fires this as a map event.
    const onContextMenu = (e: MapMouseEvent) => {
      if (Date.now() - lastTouchFire < CONTEXTMENU_DEDUP_MS) return
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
      // A second finger is a pinch — never a drop.
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
}
