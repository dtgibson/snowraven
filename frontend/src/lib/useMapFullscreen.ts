// Fullscreen for the app's EMBEDDED map mounts: Species Detail's Sighting
// Locations in both its Pins and Heatmap branches, the Named Birds per-individual
// card map, the Statistics Geographic Stats map and, since map-scroll-on-phones,
// the Weather tab's Plan location picker and the Hotspot Reports map (those two
// expand on the phone tier only, where they are a still in the page). The Map
// Explorer's own fullscreen is a separate mechanism that lives in App.tsx.
//
// The whole feature is a CLASS SWAP on the host's own container, never a portal
// and never a remount: the <SnowMap> keeps its position in the React tree, so the
// MapLibre instance, its WebGL context, the viewport, an open popup, a dropped
// share pin, the selected base map and the county overlay all survive a round
// trip because nothing ever asked them not to.
//
// THIS FILE IMPORTS `react`, `./useFocusTrap` AND `./useIsPhone` AND NOTHING
// ELSE, EVER. NamedBirdRow.tsx is on App.tsx's static import graph (App ->
// NamedBirds -> NamedBirdsTable -> NamedBirdRow) and imports this hook directly,
// which is why the row already reaches SightingsMap only through
// `lazy(() => import(...))`. One `react-map-gl` or `maplibre-gl` edge from here
// puts the ~1 MB maplibre vendor chunk on first paint. `./useIsPhone` imports
// `react` only and is already on the entry chunk through App.tsx
// (map-scroll-on-phones D-11; mapFullscreenEntrySafe.test.ts pins the list). The
// map-side half of the feature lives in components/map/MapCornerControls.tsx,
// which uses useMap() and must therefore stay reachable only from the lazy map
// hosts.
//
// THE PHONE TIER (map-scroll-on-phones, design-refinement.md). On the
// `(max-width: 640px)` query that `useIsPhone` and the stylesheet's phone block
// both read, a map in a page is a STILL: the same live map, made inert by its
// host while `still`, with an opener button under it (components/ui/FsOpenRow).
// It is used in fullscreen by the same class swap as above the tier. The hook
// owns everything that has to be the same for every consumer, the Family Tree
// included: the bar signal on the root element, focus on open and on exit, and
// the page's scroll offset across a round trip. A consumer passes the container
// and its base class, registers its exit and its opener, and wraps its tab panel
// in MapTabShowingProvider; it needs no z-index, no bar handling and no width
// test of its own.
//
// Why a hook plus a context rather than a prop on <SnowMap>: SnowMap does not own
// the box that expands (it renders into a div each host owns), Species Detail's
// two branches are two different SnowMap mounts that must share one state, and
// SnowMap short-circuits to a placeholder before <MapGL> renders. The host calls
// the hook, puts `className` on its container and wraps the map subtree in the
// provider; the corner row reads the context. SightingsMap needs no new prop at
// all, so "added once, both callers receive it" holds by construction.

import {
  createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState,
  type RefObject,
} from 'react'
import { useFocusTrap } from './useFocusTrap'
import { useIsPhone } from './useIsPhone'

/** The one expanded class, shared by all four mounts. Its geometry, its opaque
 *  ground, its dropped border/radius and its iOS inset are written once in
 *  globals.css, so "the surfaces are identical when expanded" is a property of
 *  the stylesheet rather than of anyone's discipline. */
export const MAP_FS_PANEL_CLASS = 'sr-map-fs-panel'

/** The host container's class while it is a still on the phone tier
 *  (`hostClassName`). The stylesheet's phone block hangs the still's posture on
 *  it: no pointer on the inert body, the map's own controls not drawn. */
export const MAP_STILL_CLASS = 'sr-map-still'

/** The root-element attribute that says "a panel is expanded" (D-07). The hook
 *  only says it; `:root[data-sr-fs-open] .sr-navbar { visibility: hidden }` in
 *  globals.css decides whether there is a bar to hide, so nothing in script
 *  tests a width for it. */
export const FS_OPEN_ATTR = 'data-sr-fs-open'

// COUNTED AT MODULE SCOPE, so two consumers can never clear each other's: the
// attribute goes only when the last expanded panel lets go. One panel at a time
// is the shipped reality (they live on different tabs, and leaving a tab
// collapses its map), and the count is what makes that not need to be true.
// Module state on the entry chunk, the same shape as useFocusTrap's stack.
let expandedPanels = 0
function markPanelExpanded(): void {
  expandedPanels += 1
  document.documentElement.setAttribute(FS_OPEN_ATTR, '')
}
function unmarkPanelExpanded(): void {
  expandedPanels = Math.max(0, expandedPanels - 1)
  if (expandedPanels === 0) document.documentElement.removeAttribute(FS_OPEN_ATTR)
}

/** Focus the first candidate that actually TAKES focus, read back from
 *  `document.activeElement` rather than predicted (ui.md v1.0.20): a node that
 *  is detached, hidden, inert or disabled refuses silently, and `<body>` passes
 *  every predicate an enumeration reaches for. Returns whether one took it. */
function focusFirstThatTakes(
  candidates: ReadonlyArray<HTMLElement | null | undefined>,
  options?: FocusOptions,
): boolean {
  for (const el of candidates) {
    if (!el || !el.isConnected) continue
    el.focus(options)
    if (document.activeElement === el) return true
  }
  return false
}

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
  // ── Added by map-scroll-on-phones; nothing above was renamed (D-11). ──
  /** The phone-tier media query matches (`useIsPhone`). The opener row renders
   *  on this. A width test of the VIEWPORT, never of the container. */
  stillTier: boolean
  /** `stillTier && !expanded`: the page shows the still. A host sets `inert` on
   *  its map body and `role="img"` on its container while this is true. */
  still: boolean
  /** Expand. Idempotent, so a second press while opening never closes it, and
   *  stamped with the current `resetKey` exactly as `toggle` is. */
  open: () => void
  /** Ref callback for the opener button now rendering, held as STATE with the
   *  same detach rule as `registerToggle`. Focus returns to it after a user
   *  exit. */
  registerOpener: (el: HTMLButtonElement | null) => void
  /** `className`, plus `MAP_STILL_CLASS` while `still`. Map hosts put this on
   *  the container; a consumer that draws its own still can keep `className`. */
  hostClassName: string
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

/**
 * Whether the tab a map lives in is the one showing (visited-hotspots-in-search
 * FR-28, decisions.md E-09). App.tsx provides it around the panel of every tab
 * that hosts this hook (Species Detail, Statistics, Named Birds, Weather and
 * Hotspot Reports) as `activeTab === tab`.
 * Every tab stays MOUNTED once opened and is only hidden with `display: none`,
 * so leaving a tab by a route that changes nothing inside it (a Search result,
 * the species route out of Statistics' county popup or Named Birds) used to
 * leave an expanded map's body scroll lock on the page over the destination tab,
 * and the map still expanded on return. With this, leaving the tab by ANY route
 * collapses the map and releases the lock, the Escape listener and the trap.
 * Default `true`: a mount outside any provider (a suite, a future host not yet
 * wrapped) behaves exactly as before.
 */
const MapTabShowingContext = createContext(true)
export const MapTabShowingProvider = MapTabShowingContext.Provider

export interface UseMapFullscreenOptions {
  /** The element that expands. Also the focus-trap root, so every control the
   *  overlay contains (base switcher, zoom, attribution, marker buttons, popup
   *  links, the share pin and its popup, the corner row) is inside it. */
  containerRef: RefObject<HTMLElement | null>
  /** 'sr-map-container' | 'sr-named-map' | 'sr-geo-map' | 'sr-wx-pick-map' |
   *  'sr-hsr-map', or a non-map consumer's own box class. */
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
  // The host's tab showing (MapTabShowingProvider). When it turns false the
  // stored state is cleared DURING RENDER (React's documented alternative to an
  // effect that calls setState): React re-runs this render with the cleared state
  // before committing, so the commit that hides the tab is already collapsed and
  // its effects release the lock, the Escape listener and the trap, with no
  // frame in which they outlive the tab. And because the STATE is cleared rather
  // than masked, returning to the tab shows the map collapsed, as the species
  // route leaves Species Detail, rather than re-expanding it.
  const showing = useContext(MapTabShowingContext)
  const [shownBefore, setShownBefore] = useState(showing)
  if (shownBefore !== showing) {
    setShownBefore(showing)
    if (!showing) setRaw(p => (p.on ? { on: false, key: p.key } : p))
  }
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

  // The opener under the still (map-scroll-on-phones), held exactly as the
  // toggle is and for the same reasons: the CURRENT element, as state, with a
  // detach that never clears a live replacement.
  const [openerEl, setOpenerEl] = useState<HTMLButtonElement | null>(null)
  const registerOpener = useCallback((el: HTMLButtonElement | null) => {
    setOpenerEl(prev => {
      if (el) return el
      return prev && !prev.isConnected ? null : prev
    })
  }, [])

  // The phone tier, read through the same render-safe media store the
  // stylesheet's phone block mirrors (D-11). A width test of the viewport and
  // nothing else: a desktop window zoomed to 640 CSS px is on the tier too.
  const stillTier = useIsPhone()
  const still = stillTier && !expanded

  // A USER exit (the toggle turning it off, Escape, `collapse()`) is the only
  // kind that moves focus or restores the page's place. A collapse caused by
  // leaving the tab, by `active` dropping or by `resetKey` changing is derived,
  // never written here, so it moves nothing, as at HEAD. Written in the event
  // paths, read by the effects below after the collapsed commit, and cleared on
  // the next open so a stale request cannot reach a later derived collapse.
  const userExit = useRef(false)

  // The fallback arm for a toggle that never registered, or whose replacement
  // has not registered yet. Optional, never required: a consumer with no
  // `.sr-map-fullscreen-btn` (the Family Tree) registers its controls instead.
  const fallbackToggle = useCallback(
    () => containerRef.current?.querySelector<HTMLButtonElement>('.sr-map-fullscreen-btn') ?? null,
    [containerRef],
  )

  // Every write stamps the CURRENT resetKey, so a toggle pressed after a species
  // change belongs to the new species rather than reviving the old state.
  const toggle = useCallback(() => {
    if (expanded) userExit.current = true
    setRaw(p => ({ on: !(p.on && p.key === resetKey), key: resetKey }))
  }, [resetKey, expanded])
  const collapse = useCallback(() => {
    userExit.current = true
    setRaw({ on: false, key: resetKey })
  }, [resetKey])
  // Idempotent: returning the same object when already open bails the update
  // out, so a quick second tap on the still or the opener changes nothing.
  const open = useCallback(
    () => setRaw(p => (p.on && p.key === resetKey ? p : { on: true, key: resetKey })),
    [resetKey],
  )

  // Escape exits. BUBBLE phase, armed only while expanded: SharePopup owns
  // Escape in the CAPTURE phase with stopPropagation, so one Escape closes that
  // popup and this listener never fires, and a second exits fullscreen. The two
  // work as layers only because the phases differ. Where focus goes is the exit
  // effect's job below, after the collapsed commit: at keydown time the trap is
  // still armed, and on the phone tier the toggle is about to stop being drawn.
  useEffect(() => {
    if (!expanded) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      userExit.current = true
      setRaw(p => ({ on: false, key: p.key }))
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [expanded])

  // THE BAR SIGNAL (D-07). A LAYOUT effect, so the commit that expands the panel
  // carries the attribute before the browser paints it: no frame shows the phone
  // bar over the panel (baseline-measurements.md, section 3, measured it covering
  // the exit and share buttons in 24 of 24 pairs). Counted at module scope.
  useLayoutEffect(() => {
    if (!expanded) return
    markPanelExpanded()
    return unmarkPanelExpanded
  }, [expanded])

  // Body scroll lock. The PREVIOUS value is captured and restored rather than
  // assumed to be '' — same shape as the Map Explorer's shipped lock. The two
  // can never co-occur (different tabs), and capture-and-restore is what makes
  // that not need to be true. Because `expanded` is derived, this releases on an
  // `active` drop, a `resetKey` change and the host's tab being hidden, as well
  // as on a collapse and unmount.
  //
  // THE PAGE'S PLACE (map-scroll-on-phones). The container leaves the flow while
  // expanded, so a page near its end gets shorter and the browser clamps its
  // offset; back in flow, the page would sit higher than the user left it. The
  // offset is recorded when the lock takes and, for a user exit only, put back
  // after the lock lets go (the container is already back in flow by then: this
  // cleanup runs after the collapsed commit).
  useEffect(() => {
    if (!expanded) return
    const prev = document.body.style.overflow
    const x = window.scrollX
    const y = window.scrollY
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
      if (userExit.current && (window.scrollY !== y || window.scrollX !== x)) window.scrollTo(x, y)
    }
  }, [expanded])

  // FOCUS ON OPEN AND ON EXIT, after the commit that changed `expanded`, and only
  // on a CHANGE (the toggle or opener re-registering, a Pins to Heatmap swap,
  // re-runs this and must move nothing).
  //
  // Open: if focus is outside the container (the opener, or <body> after a tap
  // on the still), it goes to the exit, read back. A consumer that wants another
  // landing focuses it in its own effect declared after the hook call; the last
  // focus wins. Above the tier the toggle that was pressed is already inside, so
  // nothing moves, as at HEAD.
  //
  // Exit, user exits only: the opener if it takes focus (it is not rendered above
  // the tier), else the toggle, else the fallback selector, each read back. Never
  // at close time: the trap is still armed then, and on the phone tier the
  // toggle is about to become inert. `preventScroll` on the way back so the
  // offset restored above stands. React runs every cleanup of a commit before any
  // of its effects, so the trap's listeners are already gone when this runs.
  const shownExpanded = useRef(expanded)
  useEffect(() => {
    if (shownExpanded.current === expanded) return
    shownExpanded.current = expanded
    if (expanded) {
      userExit.current = false
      const root = containerRef.current
      const active = document.activeElement
      if (root && !(active instanceof Node && root.contains(active))) {
        focusFirstThatTakes([toggleEl, fallbackToggle()])
      }
      return
    }
    if (!userExit.current) return
    userExit.current = false
    focusFirstThatTakes([openerEl, toggleEl, fallbackToggle()], { preventScroll: true })
  }, [expanded, toggleEl, openerEl, containerRef, fallbackToggle])

  // THE TAB CAN BE LEFT WHILE A MAP IS EXPANDED, and the tab-showing input above
  // is what makes that safe. The original argument here was that it could not:
  // the panel is `position: fixed; inset: 0` at z-index 1200 with an opaque
  // ground, the chrome is painted under it, and the trap below holds Tab inside
  // the overlay, so every way out was an in-map action with its own exit. Search
  // (Cmd-K) broke that premise without touching the chrome: it is a later modal
  // that opens above the map and can choose a destination on another tab, and a
  // destination that changes nothing in this tab (a location, from any of the
  // three hosts; a species, from Statistics or a Named Birds card) left the
  // scroll lock on the page over the destination tab and the map expanded on
  // return (visited-hotspots-in-search QA-28, measured in Chromium and WebKit).
  // Since E-09 the lock is tied to the tab showing, so no route out can leave it
  // behind, whatever the next new route is.
  //
  // Unlike the Map Explorer, the surface behind this overlay is a live page in
  // the same panel rather than a `display: none` sibling, so the trap cannot
  // lean on the page behind being unfocusable and opts into containment. A
  // later-activated modal such as CommandPalette owns focus while it is above
  // this one; the shared hook yields, then resumes here when that modal closes.
  //
  // The still and the opener arm NOTHING: `expanded` is the one condition that
  // makes this surface modal on every tier (a fixed, opaque, window-filling
  // panel), so it is the arming expression (v1.0.20), unchanged.
  useFocusTrap(expanded, containerRef, { containOutsideFocus: true })

  const className = mapFullscreenClass(baseClass, expanded)
  const hostClassName = still ? `${className} ${MAP_STILL_CLASS}` : className

  return useMemo(
    () => ({
      expanded, toggle, collapse, className, registerToggle,
      stillTier, still, open, registerOpener, hostClassName,
    }),
    [expanded, toggle, collapse, className, registerToggle, stillTier, still, open, registerOpener, hostClassName],
  )
}
