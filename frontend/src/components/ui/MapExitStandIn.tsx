// The Exit an expanded map panel shows before its map has drawn
// (map-scroll-on-phones D-38, the security review's M-1).
//
// The map's own exit is the toggle in components/map/MapCornerControls.tsx, a
// <SnowMap> child, so it exists only once the map has: not while the lazy map
// chunk loads (the host's Suspense fallback), not while the style loads or
// after it failed (SnowMap's placeholder), and not in the commit or more
// between the style arriving and react-map-gl constructing maplibre, which is
// when a map's children mount. On the phone tier the opener sits outside the
// map and opens it at once, so each of those states was a window-filling panel
// with no Exit and the bar hidden. This component, wrapped by each host around
// its map subtree, draws the SAME exit (the corner row's classes, glyph, word,
// accessible name and pressed state, so the stylesheet puts it in the same
// place at every width and in both apps, their bottom insets included) for
// exactly as long as the panel is expanded and the map's own exit has not
// reported itself. One element from the press to the map's arrival, so nothing
// swaps between the fallback, the placeholder and the construction gap.
//
// Focus. It registers through `registerToggle`, so the hook's focus-on-open
// lands on it as on any exit. When the map's own exit arrives it reports
// itself (lib/mapExitStandIn.ts) in its layout effect, while this one is still
// drawn: if this one holds the focus, or focus has fallen to <body>, focus moves
// straight across before this one leaves, so it never passes through <body>
// and the trap, armed on `expanded` the whole time, never lets go.
//
// ENTRY-SAFE. NamedBirdRow.tsx and WeatherForecastPanel.tsx are on App.tsx's
// static graph and render this, so it imports `react`, the Button primitive,
// one lucide glyph, the hook's context, the copy and the signal module, and
// nothing map-side ever (mapFullscreenEntrySafe.test.ts).

import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react'
import { Minimize2 } from 'lucide-react'
import { Button } from './Button'
import { useMapFullscreenContext } from '../../lib/useMapFullscreen'
import { MapExitStandInProvider, STAND_IN_ROW_CLASS, type MapExitStandInState } from '../../lib/mapExitStandIn'
import { EXIT_FULLSCREEN_LABEL, EXIT_WORD } from '../../lib/mapStillCopy'

export function MapExitStandIn({ compact, children }: {
  /** The density the host's own corner row has (the Named Birds card's is
   *  compact), so the stand-in takes the same box above the tier too. REQUIRED,
   *  never defaulted, as MapCornerControls' own `compact` is. */
  compact: boolean
  children: ReactNode
}) {
  // Destructured up front: a member of the context object passed to `ref=`
  // makes the compiler treat the whole object as a ref (ui.md v1.0.15).
  const fs = useMapFullscreenContext()
  const expanded = fs?.expanded ?? false
  const collapse = fs?.collapse
  const registerToggle = fs?.registerToggle

  // The map's own exit, while it is drawn. State, so the stand-in leaves in the
  // render its report causes (a layout-phase update, so before any paint).
  const [mapExit, setMapExit] = useState<HTMLButtonElement | null>(null)
  const standInRef = useRef<HTMLButtonElement | null>(null)
  const standing = expanded && mapExit === null && collapse !== undefined

  const attachStandIn = useCallback((el: HTMLButtonElement | null) => {
    standInRef.current = el
    registerToggle?.(el)
  }, [registerToggle])

  const reportExit = useCallback((el: HTMLButtonElement | null) => {
    if (el) {
      const own = standInRef.current
      const active = document.activeElement
      if (own && own.isConnected && (active === own || active === null || active === document.body)) {
        el.focus({ preventScroll: true })
      }
    }
    setMapExit(el)
  }, [])

  const focusStandIn = useCallback(() => {
    const el = standInRef.current
    if (!el || !el.isConnected) return false
    el.focus({ preventScroll: true })
    return document.activeElement === el
  }, [])

  const signal = useMemo<MapExitStandInState>(
    () => ({ reportExit, standing, focusStandIn }),
    [reportExit, standing, focusStandIn],
  )

  return (
    <MapExitStandInProvider value={signal}>
      {children}
      {standing && (
        <div className={`sr-map-corner-row${compact ? ' sr-map-corner-row--compact' : ''} ${STAND_IN_ROW_CLASS}`}>
          <Button
            type="button"
            ref={attachStandIn}
            className={`sr-map-fab sr-map-fab--${compact ? 'compact' : 'std'} sr-map-fullscreen-btn`}
            aria-label={EXIT_FULLSCREEN_LABEL}
            aria-pressed
            onClick={collapse}
          >
            <Minimize2 size={17} strokeWidth={2.2} aria-hidden />
            <span className="sr-map-exit-label">{EXIT_WORD}</span>
          </Button>
        </div>
      )}
    </MapExitStandInProvider>
  )
}
