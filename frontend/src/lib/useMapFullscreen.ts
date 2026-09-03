// Fullscreen for the app's four EMBEDDED map mounts: Species Detail's Sighting
// Locations in both its Pins and Heatmap branches, the Named Birds per-individual
// card map, and the Statistics Geographic Stats map. The Map Explorer's own
// fullscreen is a separate, untouched mechanism that lives in App.tsx.
//
// The whole feature is a CLASS SWAP on the host's own container, never a portal
// and never a remount: the <SnowMap> keeps its position in the React tree, so the
// MapLibre instance, its WebGL context, the viewport, an open popup, a dropped
// share pin, the selected base map and the county overlay all survive a round
// trip because nothing ever asked them not to.
//
// THIS FILE IMPORTS `react` AND `./useFocusTrap` AND NOTHING ELSE, EVER.
// NamedBirdRow.tsx is on App.tsx's static import graph (App -> NamedBirds ->
// NamedBirdsTable -> NamedBirdRow) and imports this hook directly, which is why
// the row already reaches SightingsMap only through `lazy(() => import(...))`.
// One `react-map-gl` or `maplibre-gl` edge from here puts the ~1 MB maplibre
// vendor chunk on first paint. The map-side half of the feature lives in
// components/map/MapCornerControls.tsx, which uses useMap() and must therefore
// stay reachable only from the three lazy map hosts.
//
// Why a hook plus a context rather than a prop on <SnowMap>: SnowMap does not own
// the box that expands (it renders into a div each host owns), Species Detail's
// two branches are two different SnowMap mounts that must share one state, and
// SnowMap short-circuits to a placeholder before <MapGL> renders. The host calls
// the hook, puts `className` on its container and wraps the map subtree in the
// provider; the corner row reads the context. SightingsMap needs no new prop at
// all, so "added once, both callers receive it" holds by construction.

import {
  createContext, useCallback, useContext, useEffect, useMemo, useState,
  type RefObject,
} from 'react'
import { useFocusTrap } from './useFocusTrap'

/** The one expanded class, shared by all four mounts. Its geometry, its opaque
 *  ground, its dropped border/radius and its iOS inset are written once in
 *  globals.css, so "the surfaces are identical when expanded" is a property of
 *  the stylesheet rather than of anyone's discipline. */
export const MAP_FS_PANEL_CLASS = 'sr-map-fs-panel'

/** Container class list for a map host. Pure, and the same idiom as the shipped
 *  `mapContentClass()` next door: positioning lives in globals.css, NOT inline.
 *  An inline `inset: 0` is specificity 1,0,0 and would put the iOS safe-area
 *  inset permanently out of reach. */
export function mapFullscreenClass(baseClass: string, expanded: boolean): string {
  return expanded ? `${baseClass} ${MAP_FS_PANEL_CLASS}` : baseClass
}

export interface MapFullscreen {
  expanded: boolean
  toggle: () => void
  collapse: () => void
  /** `baseClass`, plus the expanded class while expanded. */
  className: string
  /** Ref callback for the toggle button currently rendering for this map. */
  registerToggle: (el: HTMLButtonElement | null) => void
}

const MapFullscreenContext = createContext<MapFullscreen | null>(null)

/** Wrap the map subtree in this; the corner row inside <SnowMap> reads it. */
export const MapFullscreenProvider = MapFullscreenContext.Provider

/** null when a map is mounted outside a provider, in which case the corner row
 *  renders the share button and no toggle, which is the correct degenerate
 *  behaviour and keeps SightingsMap's own test suite green with no provider. */
export function useMapFullscreenContext(): MapFullscreen | null {
  return useContext(MapFullscreenContext)
}

export interface UseMapFullscreenOptions {
  /** The element that expands. Also the focus-trap root, so every control the
   *  overlay contains (base switcher, zoom, attribution, marker buttons, popup
   *  links, the share pin and its popup, the corner row) is inside it. */
  containerRef: RefObject<HTMLElement | null>
  /** 'sr-map-container' | 'sr-named-map' | 'sr-geo-map' */
  baseClass: string
  /** False collapses AND releases. This is how "the Named Birds row collapsed"
   *  is handled structurally: the row itself stays mounted, only its `{open &&
   *  ...}` subtree unmounts, so a hook at the row's top level sees no unmount. */
  active?: boolean
  /** A change collapses AND releases. This is how "the user picked a different
   *  species" is handled structurally: Species Detail's map keeps its JSX
   *  position across a species change, so nothing unmounts there either.
   *  `null` is admitted because the host's own selection state is nullable and
   *  the value is compared, never rendered. */
  resetKey?: string | number | null
}

export function useMapFullscreen({
  containerRef, baseClass, active = true, resetKey,
}: UseMapFullscreenOptions): MapFullscreen {
  // ONE state object holding the boolean AND the resetKey it was set under, so
  // both teardown paths are DERIVED rather than driven by a setState inside an
  // effect. That matters twice: a setState in an effect is a cascading render
  // (and eslint's react-hooks rules reject it), and it would leave one painted
  // frame in which the map is still expanded over the wrong species. Derivation
  // has no such frame — the render that changes `resetKey` is already collapsed.
  const [raw, setRaw] = useState<{ on: boolean; key: string | number | null | undefined }>(
    () => ({ on: false, key: resetKey }),
  )
  const expanded = active && raw.on && raw.key === resetKey

  // The toggle now rendering for this map, as STATE rather than a ref. NOT the
  // element captured when fullscreen opened: a Pins-to-Heatmap switch replaces
  // the button element, and restoring focus to a detached node drops the
  // keyboard user on <body>. State (the same `ref={setFabSlot}` shape the Map
  // Explorer already uses for its share slot) rather than a ref because focus
  // restore has to see the CURRENT element, and because a ref read through the
  // hook's return value is a ref read during the consumer's render.
  const [toggleEl, setToggleEl] = useState<HTMLButtonElement | null>(null)
  const registerToggle = useCallback((el: HTMLButtonElement | null) => {
    setToggleEl(prev => {
      if (el) return el
      // A null call is a DETACH. React may run the outgoing element's detach
      // after the incoming element's attach on a branch swap, so a detach must
      // never clear a registration that now holds a different, live element.
      return prev && !prev.isConnected ? null : prev
    })
  }, [])

  // Focus lands on the toggle rendering NOW, and never on document.body. The
  // container query is the belt-and-braces arm for a toggle that never
  // registered, or whose replacement has not registered yet.
  const focusToggle = useCallback(() => {
    if (toggleEl?.isConnected) { toggleEl.focus(); return }
    containerRef.current
      ?.querySelector<HTMLButtonElement>('.sr-map-fullscreen-btn')
      ?.focus()
  }, [toggleEl, containerRef])

  // Every write stamps the CURRENT resetKey, so a toggle pressed after a species
  // change belongs to the new species rather than reviving the old state.
  const toggle = useCallback(
    () => setRaw(p => ({ on: !(p.on && p.key === resetKey), key: resetKey })),
    [resetKey],
  )
  const collapse = useCallback(() => setRaw({ on: false, key: resetKey }), [resetKey])

  // Escape exits and returns focus to the toggle. BUBBLE phase, armed only while
  // expanded: SharePopup owns Escape in the CAPTURE phase with stopPropagation,
  // so one Escape closes that popup and this listener never fires, and a second
  // exits fullscreen. The two work as layers only because the phases differ.
  useEffect(() => {
    if (!expanded) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      setRaw(p => ({ on: false, key: p.key }))
      focusToggle()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [expanded, focusToggle])

  // Body scroll lock. The PREVIOUS value is captured and restored rather than
  // assumed to be '' — same shape as the Map Explorer's shipped lock. The two
  // can never co-occur (different tabs), and capture-and-restore is what makes
  // that not need to be true. Because `expanded` is derived, this releases on an
  // `active` drop and a `resetKey` change as well as on a collapse and unmount.
  useEffect(() => {
    if (!expanded) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [expanded])

  // WHY THE TAB CANNOT BE LEFT WHILE A MAP IS EXPANDED, which is what makes the
  // three FR-24 exits the complete set. The panel is `position: fixed; inset: 0`
  // at z-index 1200 with an opaque ground, and neither `.sr-header` nor the tab
  // nav is positioned or z-indexed, so the chrome is painted under it and takes
  // no clicks; the trap below holds Tab inside the overlay, so the tab nav and
  // the z-index-1300 skip link are unreachable by keyboard too. Every remaining
  // way out is an in-map action, and each has its exit above. If that ever
  // stopped being true — a positioned header, a new always-on-top control — the
  // body scroll lock would outlive the tab it belongs to, so this is stated
  // rather than left to be re-derived. It is also the one assumption here that
  // only a browser can confirm.
  //
  // Unlike the Map Explorer, the surface behind this overlay is a live page in
  // the same panel rather than a `display: none` sibling, so the trap cannot
  // lean on the page behind being unfocusable and opts into containment.
  useFocusTrap(expanded, containerRef, { containOutsideFocus: true })

  const className = mapFullscreenClass(baseClass, expanded)

  return useMemo(
    () => ({ expanded, toggle, collapse, className, registerToggle }),
    [expanded, toggle, collapse, className, registerToggle],
  )
}
