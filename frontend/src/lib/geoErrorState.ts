// The Map Explorer's location-failure state: the message text, plus a sequence
// number that the on-map live region uses to key the node carrying that text.
//
// WHY A SEQUENCE AT ALL. `aria-live` announces on DOM MUTATION, and React bails
// out when it reconciles a text node to an identical string. So a region whose
// text is set to the same message twice mutates nothing and announces once,
// while the visible message re-renders both times and every `textContent`
// assertion stays green. The repo's contract (SharePopup.tsx is the shipped
// reference) is to put the message in a child keyed by a value that advances per
// announcement, so each one is a real node replacement.
//
// WHY A REDUCER, AND WHY IT LIVES HERE RATHER THAN IN MapExplorer.
//   * `handleUseMyLocation` must not change (QA-03). It calls `setGeoError('')`
//     and `setGeoError(describeLocationError(...))` and nothing else, and its
//     dependency array omits the setter because a `useState` setter is stable.
//     A `useReducer` dispatch is stable in exactly the same way AND is
//     recognized as stable by `react-hooks/exhaustive-deps`, so the action being
//     the message string keeps both call sites and the dep array byte-identical.
//     (A `useCallback` wrapper would NOT: exhaustive-deps does not treat one as
//     stable, so it would have forced a change to that dependency array.)
//   * Its own module, so the sequence semantics are unit-testable. Exporting it
//     from MapExplorer.tsx would trip `react-refresh/only-export-components`,
//     and the semantics below are the whole reason the keyed child works — see
//     geoErrorState.test.ts for what that test rejects and why the component
//     test cannot reject it on its own.

export interface GeoErrorState {
  /** The message, or `''` for none. */
  text: string
  /** Advances on every message, including an identical repeat. Never on a clear. */
  seq: number
}

export const GEO_ERROR_NONE: GeoErrorState = { text: '', seq: 0 }

/**
 * Reducer whose action IS the message: a non-empty string sets it, `''` clears.
 *
 * Three properties, each load-bearing:
 *  1. A message ALWAYS advances the sequence, so two consecutive failures with
 *     the identical string are two announcements rather than one.
 *  2. A clear NEVER advances it, so clearing cannot itself announce.
 *  3. Clearing when already clear returns the SAME object, so the leading
 *     `setGeoError('')` of every press is a bail-out rather than a re-render.
 */
export function geoErrorReducer(prev: GeoErrorState, text: string): GeoErrorState {
  if (text) return { text, seq: prev.seq + 1 }
  return prev.text ? { text: '', seq: prev.seq } : prev
}
