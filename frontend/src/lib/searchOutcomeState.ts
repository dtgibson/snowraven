// The Map Explorer's search-outcome state: the message a completed search
// announces, whether it is a result or a failure, and the sequence number the
// on-map live region uses to key the node carrying that text
// (feature: search-this-area).
//
// Modelled directly on lib/geoErrorState.ts, whose three documented properties
// transfer unchanged. The reasoning is reproduced here rather than referenced,
// because it is the reasoning that makes the keyed child work:
//
// WHY A SEQUENCE AT ALL. `aria-live` announces on DOM MUTATION, and React bails
// out when it reconciles a text node to an identical string. So a region whose
// text is set to the same message twice mutates nothing and announces once,
// while the visible message re-renders both times and every `textContent`
// assertion stays green. The repo's contract (SharePopup.tsx is the shipped
// reference) is to put the message in a child keyed by a value that advances per
// announcement, so each one is a real node replacement. Two searches of two
// different areas that both find 3 hotspots are exactly that case, and unlike
// the geo-error region this one is reachable from the UI in a few presses.
//
// WHY A REDUCER. A `useReducer` dispatch is stable AND is recognized as stable
// by `react-hooks/exhaustive-deps`, so adding an announcement to the three fetch
// handlers changes none of their dependency arrays. A `useCallback` wrapper
// would not have that property.
//
// WHY ITS OWN MODULE. The sequence semantics are then unit-testable; exporting
// them from MapExplorer.tsx would trip `react-refresh/only-export-components`.

import type { CenterViewMode } from './mapExplorerTypes'

/** A result reads as neutral map chrome; a failure re-tokenizes the SAME element
 *  to the audited error pair and adds an icon. One element, two variants — never
 *  a second card in a second place, and never a duplicate `.sr-only` announcer,
 *  which would put the same sentence in the reading order twice. */
export type SearchOutcomeKind = 'result' | 'error'

export interface SearchOutcomeState {
  /** The message, or `''` for none. */
  text: string
  /** Which variant the message node wears, and which dismissal policy applies. */
  kind: SearchOutcomeKind
  /** Advances on every message, including an identical repeat. Never on a clear. */
  seq: number
}

export const SEARCH_OUTCOME_NONE: SearchOutcomeState = { text: '', kind: 'result', seq: 0 }

/**
 * The action. A bare string is the ordinary case (`''` clears, anything else is
 * a result); the object form is how a failure carries its kind. Keeping the
 * common case a plain string is what lets every clear site read
 * `setSearchOutcome('')`, exactly as the geo-error region's does.
 */
export type SearchOutcomeAction = string | { text: string; kind: SearchOutcomeKind }

/**
 * Reducer whose action IS the message.
 *
 * Three properties, each load-bearing:
 *  1. A message ALWAYS advances the sequence, so two consecutive searches
 *     producing the identical sentence are two announcements rather than one.
 *  2. A clear NEVER advances it, so clearing cannot itself announce.
 *  3. Clearing when already clear returns the SAME object, so the leading
 *     `setSearchOutcome('')` of every search is a bail-out rather than a
 *     re-render.
 */
export function searchOutcomeReducer(
  prev: SearchOutcomeState,
  action: SearchOutcomeAction,
): SearchOutcomeState {
  const text = typeof action === 'string' ? action : action.text
  const kind: SearchOutcomeKind = typeof action === 'string' ? 'result' : action.kind
  if (text) return { text, kind, seq: prev.seq + 1 }
  return prev.text ? { text: '', kind: prev.kind, seq: prev.seq } : prev
}

/**
 * How long a RESULT stays on screen before it dismisses itself.
 *
 * The dimmed area is the durable answer; the count is a confirmation, and a
 * confirmation has no reason to become permanent furniture over the layers
 * switcher. A FAILURE is an unresolved state and is deliberately not on this
 * timer: it persists until the next search clears it.
 */
export const SEARCH_OUTCOME_DISMISS_MS = 6000

/**
 * FR-20 / FR-21. The sentence a completed search announces, per view and count.
 *
 * Generated rather than hand-listed per call site, so the three views cannot
 * drift and the singular/plural rule lives in one place. No em dashes (repo-wide
 * rule); none are needed.
 *
 * THE `targets` ZERO FORM IS DELIBERATELY NOT THE PLURAL FORM'S NOUN PHRASE.
 * "No recent sightings of your target species found in this area." is the
 * sentence that distinguishes an empty result from a broken search, which is the
 * whole point of FR-21. Do not regularize it to "No recent sightings found in
 * this area."
 */
export function searchOutcomeMessage(view: CenterViewMode, n: number): string {
  if (view === 'hotspots') {
    if (n === 0) return 'No hotspots found in this area.'
    if (n === 1) return '1 hotspot found in this area.'
    return `${n} hotspots found in this area.`
  }
  if (view === 'targets') {
    if (n === 0) return 'No recent sightings of your target species found in this area.'
    if (n === 1) return '1 recent sighting found in this area.'
    return `${n} recent sightings found in this area.`
  }
  if (n === 0) return 'No nearby lifers found in this area.'
  if (n === 1) return '1 location with nearby lifers found in this area.'
  return `${n} locations with nearby lifers found in this area.`
}

/**
 * FR-03. The control's accessible name per view — each containing the visible
 * text "Search this area" verbatim (WCAG 2.5.3), and all pairwise distinct from
 * every other map-control name in scope.
 */
export const SEARCH_AREA_LABEL: Record<CenterViewMode, string> = {
  hotspots: 'Search this area for hotspots',
  targets: 'Search this area for recent sightings',
  lifers: 'Search this area for nearby lifers',
}

/** FR-24. The name the control wears while it is retained in the
 *  already-searched state, so a keyboard user who kept focus on it is told why
 *  a second press does nothing. */
export function searchAreaSearchedLabel(view: CenterViewMode): string {
  return `${SEARCH_AREA_LABEL[view]}. This area has already been searched.`
}

/** The visible text, identical on all three views. */
export const SEARCH_AREA_TEXT = 'Search this area'
