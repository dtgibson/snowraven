// The bottom-right corner row on the four embedded map mounts: the share-pin
// drop button, then the fullscreen toggle, in that order left to right, matching
// the Map Explorer's shipped cluster so a user learns the vocabulary once.
//
// MOUNTED AS A <SnowMap> CHILD, which is what gives it useMap() access to the
// live MaplibreMap for the resize and gesture effects. That co-location is the
// reason the row sits inside the map rather than beside it (the Map Explorer's
// cluster sits outside), and it means none of the three host containers needs a
// new `position: relative`: maplibre's own container already is one.
//
// THIS MODULE MUST STAY OFF App.tsx's STATIC IMPORT GRAPH. It is reachable only
// from SightingsMap.tsx, SpeciesDetail.tsx and BirdingStats.tsx, all of which are
// lazy. NamedBirdRow.tsx is on the static graph and must never import it —
// NamedBirdRow reaches this row the same way it already reaches the map, through
// `lazy(() => import('./SightingsMap'))`. entryChunk.test.ts is the live guard.

import { useEffect, useLayoutEffect, useState } from 'react'
import { Maximize2, Minimize2 } from 'lucide-react'
import { useMap } from 'react-map-gl/maplibre'
import { SharePin } from './SharePin'
import { useMapFullscreenContext } from '../../lib/useMapFullscreen'

export function MapCornerControls({ compact, sharePinResetKey }: {
  /** Density, forwarded to SharePin and to the toggle's size modifier. REQUIRED,
   *  never defaulted (the MediaFrame precedent the share pin already follows).
   *  The modifier does NOT change when the map expands: a control that grows
   *  under the finger that just pressed it is a second state change nobody
   *  asked for. */
  compact: boolean
  /** Remounts ONLY the share pin when the entity behind the map changes, exactly
   *  as the shipped call sites did. Species Detail's map keeps its JSX position
   *  across a species change, so nothing unmounts and a stale pin would survive. */
  sharePinResetKey?: string | number
}) {
  // Destructured up front, and NOT read as `fs.x` in the JSX below: passing a
  // member expression to `ref=` makes the React compiler treat the whole object
  // as a ref value, and every other read of it during render then trips
  // `react-hooks/refs`. The context carries plain state and callbacks, so the
  // rule is right to be strict and wrong about this object; destructuring is the
  // cheap way to keep both.
  const fs = useMapFullscreenContext()
  const expanded = fs?.expanded ?? false
  const registerToggle = fs?.registerToggle
  const onToggle = fs?.toggle
  const map = useMap().current

  // The share button portals in here. `display: contents` erases the slot's own
  // box, so the button becomes the row's FIRST flex item: DOM order equals
  // reading order equals visual order, and no `order` property exists anywhere.
  // Held as state, not a plain ref: a ref would not re-render SharePin once the
  // slot element mounts, so the portal would never get a host.
  const [slot, setSlot] = useState<HTMLDivElement | null>(null)

  // FR-13 — resize explicitly on every mode change. SnowMap's header comment used
  // to advertise "auto-resize" and nothing in the file implemented one; that was
  // documentation debt, not evidence, and the comment has been corrected. A
  // LAYOUT effect runs after React has committed the container's new class and
  // before paint, and map.resize() reads clientWidth/clientHeight, which forces
  // the new geometry to be computed. resize() preserves centre and zoom, so it
  // is not a re-frame. The second call on the next frame is for WKWebView, where
  // 100dvh can settle a frame late; a redundant resize() is free.
  useLayoutEffect(() => {
    if (!map || typeof map.resize !== 'function') return
    map.resize()
    const raf = requestAnimationFrame(() => map.resize())
    return () => cancelAnimationFrame(raf)
  }, [map, expanded])

  // FR-15 — release the page-embedded gesture posture while expanded and restore
  // it on collapse, driven on the LIVE INSTANCE. The JSX props stay constant:
  // react-map-gl only re-applies a handler prop when its value changes, so
  // constant props and imperative control do not fight, and nothing remounts.
  //
  // The in-flow values are CAPTURED rather than assumed, because they are not the
  // same on all four mounts: Species Detail (both branches) and the Named Birds
  // card pass `scrollZoom={false} cooperativeGestures`, while the Statistics map
  // passes neither. Do NOT read "passes neither" as "maplibre's defaults", which
  // is what this comment used to claim: SnowMap forwards both props
  // unconditionally, so that map is constructed with `scrollZoom: undefined`, an
  // own key that shadows maplibre's `true` default, and QA measured its live
  // posture in both engines as scroll zoom OFF and cooperative gestures OFF.
  // Capturing is what makes the restore right without anyone having to know that;
  // hardcoding it would silently change whichever mount the hardcoded pair is
  // wrong about.
  //
  // getMap() rather than the MapRef: createRef copies only the map's FUNCTIONS
  // onto the ref object, so `mapRef.scrollZoom` is undefined at runtime even
  // though MapRef's type says otherwise. Handlers are reachable only through the
  // real instance.
  useEffect(() => {
    if (!expanded || !map || typeof map.getMap !== 'function') return
    const m = map.getMap()
    if (!m?.scrollZoom) return
    const hadScrollZoom = m.scrollZoom.isEnabled()
    const hadCooperative = m.cooperativeGestures?.isEnabled() ?? false
    m.scrollZoom.enable()
    m.cooperativeGestures?.disable()
    return () => {
      if (hadScrollZoom) m.scrollZoom.enable()
      else m.scrollZoom.disable()
      if (hadCooperative) m.cooperativeGestures?.enable()
      else m.cooperativeGestures?.disable()
    }
  }, [expanded, map])

  const label = expanded ? 'Exit fullscreen' : 'Enter fullscreen'

  return (
    <>
      <div className={`sr-map-corner-row${compact ? ' sr-map-corner-row--compact' : ''}`}>
        <div className="sr-map-fab-slot" ref={setSlot} />
        {onToggle && (
          <button
            type="button"
            ref={registerToggle}
            // Vocabulary verbatim from the Map Explorer's shipped toggle. The
            // px `size=` below is the no-CSS fallback only: `.sr-map-fab svg`
            // sizes the glyph in rem through --sr-fab-glyph, which is what keeps
            // the glyph-to-disc ratio constant at 200% in-app text scale.
            className={`sr-map-fab sr-map-fab--${compact ? 'compact' : 'std'} sr-map-fullscreen-btn`}
            aria-label={label}
            aria-pressed={expanded}
            onClick={onToggle}
          >
            {expanded
              ? <Minimize2 size={17} strokeWidth={2.2} aria-hidden />
              : <Maximize2 size={17} strokeWidth={2.2} aria-hidden />}
          </button>
        )}
      </div>
      <SharePin key={sharePinResetKey} compact={compact} buttonHost={slot} />
    </>
  )
}
