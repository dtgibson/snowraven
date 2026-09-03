// Prop-driven map children for the Map Explorer (extracted from MapExplorer.tsx
// in a behavior-preserving split). These rely on being rendered inside <SnowMap>
// (useMap context) — keep their call sites unchanged.

import { useEffect, useRef } from 'react'
import { Marker, useMap } from 'react-map-gl/maplibre'
import { padBounds } from '../../lib/atlasBlocks'
import { neutralizeMarkerWrapper } from '../../lib/mapPins'
import { formatCoordinate } from '../../lib/shareLocation'
import { VIEWPORT_PAD_FRAC, type MarkerBounds } from '../../lib/markersInView'
import { useMapLongPressDrop } from './useMapLongPressDrop'

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
      // Pad like the atlas overlay so a list item near the edge doesn't pop out
      // of the list during a small pan before the next moveend settles. The
      // fraction is a shared constant, not a literal, because the centre-share
      // FAB's "is the centre off screen?" test has to remove exactly this much
      // again (lib/markersInView.ts unpadBounds) — two literals could drift with
      // nothing failing. Value unchanged at 0.15.
      onBounds(padBounds(
        [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()],
        VIEWPORT_PAD_FRAC,
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
// The gesture body now lives in useMapLongPressDrop (shared with Pin Share's
// SharePin) — this component is a thin wrapper so its props, render output and
// bound-handler set are IDENTICAL to before the extraction. CenterPinDropper.test.tsx
// is deliberately left byte-unchanged; its staying green is the QA-54 evidence.
export function CenterPinDropper({ onDrop }: { onDrop: (lat: number, lng: number) => void }) {
  useMapLongPressDrop(onDrop)
  return null
}

// The draggable center pin shown on the search views. It marks the current search
// center (from any source) and can be dragged to fine-tune; `onMove` fires on drag
// end. Keyboard users set the center via the lat/lng inputs, so the marker wrapper
// is demoted to presentational (no stray "Map marker" tab stop).
//
// Pin Share (FR-15/FR-16/FR-17) promoted the sprite to a real <button>: activating
// it opens the share popup, and the accessible name leads with the coordinates
// exactly as the latitude/longitude fields display them (both come from
// formatCoordinate, so they agree by construction) before naming the action
// (WCAG 2.5.3 Label in Name). Fill, stroke, size and the drag are untouched, and
// `applyCenter` — the drop-to-search path — is not involved here at all.
export function CenterPin({ lat, lng, onMove, onActivate, buttonRef }: {
  lat: number
  lng: number
  onMove: (lat: number, lng: number) => void
  /** Open the share popup. Never called for a drag (see suppressClickRef). */
  onActivate: () => void
  /** So the opener can be re-focused after the popup closes (FR-40). */
  buttonRef?: React.Ref<HTMLButtonElement>
}) {
  // OQ-05 — a maplibre marker drag can end with a synthesized `click` on the
  // marker element, which would open the copy popup and fail QA-22. A
  // suppression ref rather than a pointer-movement slop comparison because it is
  // deterministic and unit-testable (no wall clock, so NFR-11 is trivially
  // satisfied and it cannot flake under test load), and because keyboard Enter
  // and Space fire `click` with NO preceding pointerdown — a naive "did the
  // pointer move?" guard would swallow every keyboard activation. Clearing on
  // pointerdown/keydown closes the mirror-image hole: if maplibre does not
  // synthesize a click after some drag, a latched `true` would otherwise swallow
  // the user's next genuine click.
  const suppressClickRef = useRef(false)

  return (
    <Marker
      longitude={lng}
      latitude={lat}
      draggable
      anchor="bottom"
      ref={neutralizeMarkerWrapper}
      onDragEnd={e => { suppressClickRef.current = true; onMove(e.lngLat.lat, e.lngLat.lng) }}
    >
      <button
        tabIndex={0}
        type="button"
        ref={buttonRef}
        className="sr-center-pin-btn"
        aria-label={`${formatCoordinate(lat, lng)}. Copy this location`}
        onPointerDown={() => { suppressClickRef.current = false }}
        onKeyDown={() => { suppressClickRef.current = false }}
        // The drop gesture belongs to the canvas; over this marker a right-click
        // would otherwise summon the OS menu instead of doing nothing.
        onContextMenu={e => e.preventDefault()}
        onClick={() => {
          if (suppressClickRef.current) { suppressClickRef.current = false; return }
          onActivate()
        }}
      >
        <svg width="30" height="30" viewBox="0 0 24 24" fill="var(--sr-accent)" stroke="var(--sr-on-accent)" strokeWidth="1.4" aria-hidden="true" style={{ filter: 'drop-shadow(0 3px 3px rgba(0,0,0,0.3))' }}>
          <path d="M12 22s7-6.6 7-12A7 7 0 1 0 5 10c0 5.4 7 12 7 12z" />
          <circle cx="12" cy="10" r="2.6" fill="var(--sr-on-accent)" stroke="none" />
        </svg>
      </button>
    </Marker>
  )
}
