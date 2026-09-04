// The main navigation's density derivation — the arithmetic behind "sidebar,
// icon rail, or phone bottom bar", kept pure so it is testable without a layout
// engine (feature: nav-rework, design-refinement.md "The thresholds").
//
// THE RULE, and why the floor is not a number of taste. The sidebar may never
// squeeze the content column into the tier BELOW it, and the app's own phone
// boundary is 640px (`.claude/rules/ui.md`: "the established phone boundary --
// don't move it; lots hangs off it"). So the threshold is an expression of a
// rule the app already holds:
//
//     available = the app SHELL's own width
//     navW      = 13.5rem, resolved live from the root font size
//     reserve   = the width a tab's own in-flow sidebar will take (Map Explorer)
//     sidebar   when available - navW - reserve >= 640, and not manually collapsed
//     rail      otherwise
//     phone     when the (max-width: 640px) media query matches  [useIsPhone]
//
// FEEDBACK-FREE BY CONSTRUCTION. `available` is the SHELL's width, which is set
// by the app root and does not change when the nav changes density; `navW` is
// computed from the live root font size rather than from a hidden probe. That
// second half is what retires the off-screen measurement node the old TabNav
// carried -- the one that leaked page horizontal scroll on phones in v0.5.37 and
// is a standing hazard in `.claude/rules/ui.md`. Nothing this module reads can
// move because of what it returns.
//
// HYSTERESIS, and why a bare equality is not enough. A density change is a
// visible layout change: at exactly the threshold, one pixel of a window drag
// would flip the whole shell back and forth. Collapse to the rail the moment the
// content column would fall below the floor; restore the sidebar only once there
// are 48px to spare. The asymmetry is deliberate -- the app is never left with a
// content column under the floor, even for one frame.

/** The three densities. `phone` is decided by the media query, not by this arithmetic. */
export type NavDensity = 'sidebar' | 'rail' | 'phone'

/** The wide-window pair. `deriveWideDensity` never returns `phone`. */
export type WideDensity = 'sidebar' | 'rail'

/** Sidebar column width, in rem. Must equal `.sr-nav-col`'s width in globals.css. */
export const NAV_SIDEBAR_REM = 13.5

/** Icon-rail column width, in rem. Must equal `.sr-nav-col--rail`'s width. */
export const NAV_RAIL_REM = 3.75

/**
 * The content column's floor: the app's own phone boundary. The sidebar may never
 * push the content column below the tier under it.
 */
export const CONTENT_FLOOR_PX = 640

/** Extra headroom required to go BACK to the sidebar. See "HYSTERESIS" above. */
export const SIDEBAR_RESTORE_HYSTERESIS_PX = 48

// The Map Explorer's own in-flow sidebar, mirroring `.sr-map-sidebar-overlay`'s
// `width: clamp(240px, 28vw, 300px)` in globals.css. Duplicated here because an
// UNREGISTERED CSS custom property is not resolved by getComputedStyle -- reading
// `--sr-nav-reserve: clamp(240px, 28vw, 300px)` back would return the token
// stream as authored, not a length -- so a px number has to be computed. The
// duplication is the risk, and `navDensity.css.test.ts` closes it by parsing the
// three numbers back out of the shipped stylesheet.
export const MAP_SIDEBAR_MIN_PX = 240
export const MAP_SIDEBAR_VW = 0.28
export const MAP_SIDEBAR_MAX_PX = 300

/**
 * What the active tab will take out of the content column for its OWN in-flow
 * sidebar. Only the Map Explorer has one; every other tab reserves nothing.
 *
 * `map-sidebar` is passed by App when the Map Explorer is the active tab and the
 * map is not fullscreen (a fullscreen panel is `position: fixed`, so it is out of
 * flow and takes nothing from the content column).
 */
export type ContentReserve = 'none' | 'map-sidebar'

/**
 * The reserve in px for one shell width.
 *
 * `28vw` is resolved against the SHELL's width rather than the viewport's. The
 * two differ only by the iOS side safe-area insets on `.sr-ios-app body`, which
 * are zero in every orientation but landscape on a notched phone -- and a phone
 * is at phone density, where the reserve is not consulted at all. Using the shell
 * also keeps this module free of `window.innerWidth`, which CLAUDE.md forbids by
 * name.
 */
export function contentReservePx(kind: ContentReserve, availablePx: number): number {
  if (kind !== 'map-sidebar') return 0
  if (!Number.isFinite(availablePx) || availablePx <= 0) return 0
  return Math.min(MAP_SIDEBAR_MAX_PX, Math.max(MAP_SIDEBAR_MIN_PX, MAP_SIDEBAR_VW * availablePx))
}

export interface WideDensityInput {
  /** The app shell's own width in px. */
  availablePx: number
  /** The live root font size in px (`--sr-text-scale` is already inside it). */
  rootFontPx: number
  /** What the active tab's own in-flow sidebar will take. */
  reserve: ContentReserve
  /** The density currently showing. Hysteresis is relative to this. */
  previous: WideDensity
}

/**
 * The derived density for a wide window — a CEILING, never a floor. The manual
 * collapse toggle may step one below what this returns; it may never force a
 * sidebar the measurement says will not fit, which is what makes the toggle and
 * the derivation unable to contradict each other.
 *
 * An unusable reading (non-finite, or a width of zero, which is what an unlaid-out
 * box and jsdom both give) returns `previous` rather than guessing. Publishing a
 * guess would flip the shell on the first frame and then flip it back.
 */
export function deriveWideDensity(input: WideDensityInput): WideDensity {
  const { availablePx, rootFontPx, reserve, previous } = input
  if (!Number.isFinite(availablePx) || availablePx <= 0) return previous
  if (!Number.isFinite(rootFontPx) || rootFontPx <= 0) return previous

  const navW = NAV_SIDEBAR_REM * rootFontPx
  const content = availablePx - navW - contentReservePx(reserve, availablePx)

  // Asymmetric on purpose: leaving the sidebar needs only that the floor is
  // breached; coming back needs the floor plus headroom.
  const threshold =
    previous === 'sidebar' ? CONTENT_FLOOR_PX : CONTENT_FLOOR_PX + SIDEBAR_RESTORE_HYSTERESIS_PX
  return content >= threshold ? 'sidebar' : 'rail'
}

/**
 * The density actually rendered: the derived ceiling, one manual step below it
 * when the user has collapsed, and `phone` whenever the phone media query matches.
 *
 * The manual collapse is consulted ONLY at sidebar density. In a derived rail
 * there is no room for the control, so there is no control and no state to
 * explain — and a collapse the user set on a wide window silently does nothing
 * once the window is narrow enough to derive the rail anyway.
 */
export function resolveDensity(
  isPhone: boolean,
  derived: WideDensity,
  manuallyCollapsed: boolean,
): NavDensity {
  if (isPhone) return 'phone'
  if (derived === 'sidebar' && manuallyCollapsed) return 'rail'
  return derived
}

/**
 * The CSS initial value of `font-size`, which is the keyword `medium`, which
 * every engine resolves to 16px.
 */
export const MEDIUM_FONT_PX = 16

/**
 * The live root font size in px, or `null` where there is no layout to read.
 *
 * A real engine always returns a px length here, and `--sr-text-scale` is already
 * inside it (the root is `calc(100% * var(--sr-text-scale))`). An environment
 * with no cascade — jsdom, which every component test in this repo runs in —
 * returns the unresolved KEYWORD `medium` instead, and `parseFloat` of that is
 * NaN. Mapping exactly that keyword to 16px is the spec's own value rather than a
 * guess, and it is what keeps the derivation live in a test rather than silently
 * bailing on every measurement and reporting the initial density forever.
 *
 * Deliberately keyword-gated and nothing wider: any OTHER unreadable value still
 * returns `null`, so a genuinely broken reading holds the current answer instead
 * of inventing a plausible one.
 */
export function rootFontSizePx(doc: Document = document): number | null {
  const el = doc.documentElement
  if (!el || typeof getComputedStyle !== 'function') return null
  const raw = getComputedStyle(el).fontSize
  const px = parseFloat(raw)
  if (Number.isFinite(px) && px > 0) return px
  return typeof raw === 'string' && raw.trim() === 'medium' ? MEDIUM_FONT_PX : null
}
