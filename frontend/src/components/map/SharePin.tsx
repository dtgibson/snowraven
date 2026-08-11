// Pin Share — the transient share pin, its drop gesture, its keyboard route and
// its popup. Mounted as a one-line <SnowMap> child on every share-pin surface:
// Map Explorer's My Sightings (A), the shared SightingsMap (C and F), Species
// Detail's heatmap branch (D) and the Statistics geographic map (E).
//
// The pin's coordinate is component-local state, one instance per map, which
// gives four requirements structurally with no coordination code:
//   FR-06  one slot cannot hold two pins, so a second drop is a MOVE
//   FR-11  component state is unreachable from the storage seam by construction
//   FR-10  Map Explorer's fullscreen is a class swap on an ancestor, not a
//          remount, so the pin survives it for free
//   FR-09  unmount clears the pin (tab switch, Named Birds row collapse, Map
//          Explorer view-mode change). The one case unmount does NOT cover is a
//          Species Detail species change, where the map keeps its JSX position;
//          those two call sites pass a key so only this tiny component remounts
//          and the WebGL context is left alone.

import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Marker, useMap } from 'react-map-gl/maplibre'
// The button's job is to describe SharePinSprite below — a vertical staff with a
// right-pointing triangular pennant. FlagTriangleRight is the same construction
// (`M6 22V2.8 … l11.38 5.69 … L6 15.5`): same staff, same axis, same pennant.
// A straight swap rather than a prop: the sprite it must match lives in this
// file and is identical on all five surfaces, so the display decision is made
// HERE (the `compact` discipline applied, not reinvented). A prop would make
// five call sites answer a question they have no stake in, all identically, and
// would let the glyph drift from the sprite it is supposed to describe.
import { FlagTriangleRight } from 'lucide-react'
import { neutralizeMarkerWrapper } from '../../lib/mapPins'
import { formatCoordinate } from '../../lib/shareLocation'
import { useMapLongPressDrop } from './useMapLongPressDrop'
import { SharePopup } from './SharePopup'

/** Where the drop button lives.
 *  - `'corner'` — SharePin's own bottom-right wrapper inside the map container
 *    (Species Detail, Statistics, Named Birds).
 *  - an element — portal into it, so Map Explorer's button becomes the first
 *    item of the SHIPPED `.sr-map-fab-cluster` (order: Pin, Fullscreen, Filters)
 *    without claiming a new corner or moving the two existing controls.
 *  - `null` — render no button (Map Explorer while the mobile filters overlay
 *    has unmounted the cluster). The pin, the gesture and the popup are
 *    unaffected. */
export type SharePinButtonHost = 'corner' | HTMLElement | null

/** Sprite geometry. The staff foot is the coordinate, NOT the sprite centre, so
 *  the marker is shifted right by the distance from its horizontal centre to the
 *  staff. Getting this wrong puts the pin half a sprite-width from the pressed
 *  point, which is the whole promise of the feature. */
const SPRITE = {
  normal:  { w: 26, h: 33, offsetX: 7, popupOffset: 35, icon: 17 },
  compact: { w: 22, h: 28, offsetX: 6, popupOffset: 30, icon: 15 },
} as const

function SharePinSprite({ compact }: { compact: boolean }) {
  const s = compact ? SPRITE.compact : SPRITE.normal
  // A planted flag, not a teardrop: every hue in the app's map palette is already
  // spoken for on at least one in-scope surface, so SHAPE carries the distinction.
  return (
    <svg width={s.w} height={s.h} viewBox="0 0 26 33" aria-hidden="true">
      <path d="M6 32.4 V3.4" stroke="var(--sr-map-pin-stroke)" strokeWidth="3.1" strokeLinecap="round" fill="none" />
      <path d="M6.9 2.6 L22.4 7.1 L6.9 12.6 Z" fill="var(--sr-share-pin)" stroke="var(--sr-map-pin-stroke)" strokeWidth="1.5" strokeLinejoin="round" />
      <circle cx="14.2" cy="7.3" r="1.7" fill="var(--sr-share-pin-ink)" />
      <circle cx="6" cy="31.4" r="2.9" fill="var(--sr-share-pin)" stroke="var(--sr-map-pin-stroke)" strokeWidth="1.4" />
    </svg>
  )
}

export function SharePin({ compact, buttonHost }: {
  /** Density. REQUIRED, never defaulted (MediaFrame precedent, D-07). */
  compact: boolean
  buttonHost: SharePinButtonHost
}) {
  const map = useMap().current
  const s = compact ? SPRITE.compact : SPRITE.normal

  const [pin, setPin] = useState<{ lat: number; lng: number } | null>(null)
  const [popupOpen, setPopupOpen] = useState(false)
  // Bumped on every DROP (never on a drag), and used as the pin button's key so
  // the plant animation replays on a drop and stays put while dragging —
  // otherwise the pin would re-animate on every pointermove.
  const [plantSeq, setPlantSeq] = useState(0)

  const dropButtonRef = useRef<HTMLButtonElement>(null)
  const openerRef = useRef<HTMLElement | null>(null)
  const restoreFocusRef = useRef(false)

  const openAt = useCallback((lat: number, lng: number, opener: HTMLElement | null) => {
    openerRef.current = opener
    setPin({ lat, lng })
    setPopupOpen(true)
    setPlantSeq(n => n + 1)
  }, [])

  // Right-click / long-press. A pointer drop has no meaningful opener element, so
  // focus returns to the map canvas (focusable, and it keeps the user on the map).
  const handleGestureDrop = useCallback((lat: number, lng: number) => {
    openAt(lat, lng, map ? map.getCanvas() : null)
  }, [openAt, map])

  useMapLongPressDrop(handleGestureDrop)

  // FR-09 — the pin and the popup go together.
  const close = useCallback(() => {
    setPopupOpen(false)
    setPin(null)
    restoreFocusRef.current = true
  }, [])

  // FR-40 — restore focus AFTER the close render commits. Restoring inside
  // close() would target an element that is about to unmount.
  //
  // Closing removes the pin AND the popup together, so when the opener WAS the
  // pin (a click on an existing pin) it is gone by now. Fall back to the map
  // canvas rather than dropping the keyboard user on <body>.
  useEffect(() => {
    if (popupOpen || !restoreFocusRef.current) return
    restoreFocusRef.current = false
    const el = openerRef.current
    openerRef.current = null
    if (el && el.isConnected) { el.focus(); return }
    map?.getCanvas()?.focus()
  }, [popupOpen, map])

  const hasPin = pin !== null
  // "Drop a pin" becomes a small lie once one exists. The label names the
  // mechanism on purpose: a keyboard user needs to learn that the map pans under
  // the pin, and this is where they learn it.
  const buttonLabel = hasPin ? 'Move the pin to the map center' : 'Drop a pin at the map center'

  const dropButton = (
    <button
      type="button"
      ref={dropButtonRef}
      // The circle comes from the shared FAB base + a size modifier
      // (uniform-map-fabs); .sr-share-drop-btn is now a state hook carrying the
      // [aria-pressed] tint, and --compact a density hook. Every 1x value is
      // unchanged: --std is 36px and --compact 30px, exactly as before.
      className={`sr-map-fab sr-map-fab--${compact ? 'compact' : 'std'} sr-share-drop-btn${compact ? ' sr-share-drop-btn--compact' : ''}`}
      aria-pressed={hasPin}
      aria-label={buttonLabel}
      title={buttonLabel}
      onClick={() => {
        if (!map) return
        const c = map.getCenter()
        openAt(c.lat, c.lng, dropButtonRef.current)
      }}
    >
      <FlagTriangleRight size={s.icon} strokeWidth={2.2} aria-hidden />
    </button>
  )

  return (
    <>
      {buttonHost === 'corner'
        ? <div className={`sr-share-corner${compact ? ' sr-share-corner--compact' : ''}`}>{dropButton}</div>
        : buttonHost
          ? createPortal(dropButton, buttonHost)
          : null}

      {pin && (
        <Marker
          longitude={pin.lng}
          latitude={pin.lat}
          anchor="bottom"
          offset={[s.offsetX, 0]}
          draggable
          ref={neutralizeMarkerWrapper}
          onDrag={e => setPin({ lat: e.lngLat.lat, lng: e.lngLat.lng })}
          onDragEnd={e => setPin({ lat: e.lngLat.lat, lng: e.lngLat.lng })}
        >
          {/* A real <button>, the app's DOM-marker convention, whose accessible
              name leads with the coordinates exactly as rendered (WCAG 2.5.3). */}
          <button
            key={plantSeq}
            type="button"
            // No compact variant: the sprite's own width/height carry the
            // density, and the 44px touch target is 44px at both.
            className="sr-share-pin"
            aria-label={`${formatCoordinate(pin.lat, pin.lng)}. Share this location`}
            onClick={e => { openerRef.current = e.currentTarget; setPopupOpen(true) }}
            // FR-13 accepts that a right-click landing on a DOM marker drops no
            // share pin (it never reaches maplibre's canvas contextmenu). Suppress
            // the OS menu so the gesture at least feels uniform over the map
            // rather than sometimes summoning a browser context menu.
            onContextMenu={e => e.preventDefault()}
          >
            <SharePinSprite compact={compact} />
          </button>
        </Marker>
      )}

      {pin && popupOpen && (
        <SharePopup
          lat={pin.lat}
          lng={pin.lng}
          compact={compact}
          offset={s.popupOffset}
          onClose={close}
        />
      )}
    </>
  )
}
