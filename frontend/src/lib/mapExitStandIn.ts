// The signal between an expanded panel's STAND-IN exit and the map's own exit
// (map-scroll-on-phones D-38, the security review's M-1).
//
// On the phone tier a map opens from the opener under its still, which sits
// outside the map, so a map can be opened before it has drawn: its lazy chunk
// still loading, its style still loading, the style request failed, or
// maplibre not yet constructed (react-map-gl mounts a map's children only after
// a passive effect has built the instance, so even a map whose style is ready
// spends at least one commit with no children). The exit is drawn by
// components/map/MapCornerControls.tsx, a map child, so in every one of those
// states the panel had no Exit and the bar was hidden: a touch-only phone was
// held there. components/ui/MapExitStandIn.tsx draws the same Exit, in the same
// place, for exactly as long as the map's own is absent, and this context is
// how the map's own exit says it has arrived, and how SnowMap's Retry keeps the
// keyboard focus when it steps aside.
//
// ENTRY-SAFE: `react` only. MapExitStandIn renders inside NamedBirdRow.tsx and
// WeatherForecastPanel.tsx, which are on App.tsx's static graph, while
// MapCornerControls and SnowMap are lazy (mapFullscreenEntrySafe.test.ts).

import { createContext, useContext } from 'react'

/** The handle the stand-in's row carries beside the corner row's own classes,
 *  so a test or a probe can tell it from the map's row. Its one rule restates
 *  the type the map's row inherits from maplibre's container (globals.css);
 *  every box property is the corner row's own. */
export const STAND_IN_ROW_CLASS = 'sr-map-corner-row--stand-in'

/** The corner row that arrives in a panel that is ALREADY open, replacing the
 *  stand-in, takes this class so it does not replay its 150 ms entrance over
 *  the stand-in it replaces (globals.css). Cleared when the panel collapses, so
 *  the next open animates as at HEAD. */
export const IN_PLACE_ROW_CLASS = 'sr-map-corner-row--in-place'

export interface MapExitStandInState {
  /** The map's own exit reports its element while it is drawn, and `null` when
   *  it goes. A report that arrives while the stand-in holds the keyboard focus
   *  (or while focus has fallen to `<body>`) moves focus to the arriving exit
   *  BEFORE the stand-in leaves, so focus never passes through `<body>`. */
  reportExit: (el: HTMLButtonElement | null) => void
  /** True while the stand-in is drawn: the panel is expanded and the map's own
   *  exit is not. */
  standing: boolean
  /** Focus the stand-in if it is drawn, read back from `document.activeElement`.
   *  SnowMap calls it when its Retry, which is about to be replaced by the
   *  loading line, holds the focus. */
  focusStandIn: () => boolean
}

const MapExitStandInContext = createContext<MapExitStandInState | null>(null)

/** Provided by MapExitStandIn around a host's map subtree. */
export const MapExitStandInProvider = MapExitStandInContext.Provider

/** null outside a MapExitStandIn: the Map Explorer, and every suite that
 *  mounts a map without one, see exactly the behaviour they had before. */
export function useMapExitStandIn(): MapExitStandInState | null {
  return useContext(MapExitStandInContext)
}
