// In-view marker filtering for the Map Explorer's keyboard-accessible sidebar
// lists. The on-map markers are GPU GL layers (canvas), so they can't be DOM
// focus targets; the keyboard path is a focusable sidebar list scoped to the
// CURRENT MAP VIEW. This module is the single source of truth for "which markers
// are in the viewport" — mirroring the viewport-cap pattern in lib/atlasBlocks.ts
// (blocksInBounds + padBounds), recomputed on `moveend`, capped, with an
// over-cap "zoom in" hint.

/** Map viewport as [minLng, minLat, maxLng, maxLat] — same shape as atlasBlocks' Bounds. */
export type MarkerBounds = [number, number, number, number]

/** Max markers listed before the list collapses to a "zoom in / N more" hint. */
export const MARKER_LIST_CAP = 200

/**
 * The fraction BoundsTracker grows the reported viewport by on every side, so a
 * list item near the edge doesn't pop out during a small pan before the next
 * `moveend` settles.
 *
 * Exported (and consumed by BoundsTracker rather than repeated as a literal)
 * because `unpadBounds` below has to remove EXACTLY this much. Two copies of
 * 0.15 in two files is a silent-drift hazard: nothing would fail if one moved.
 */
export const VIEWPORT_PAD_FRAC = 0.15

/**
 * Recover the map's VISIBLE viewport from the padded bounds BoundsTracker
 * reports. Exactly inverts `padBounds(b, frac)`: that grows a span S to
 * S(1 + 2f), so the padding is f/(1 + 2f) of the PADDED span on each side.
 */
export function unpadBounds(padded: MarkerBounds, frac: number = VIEWPORT_PAD_FRAC): MarkerBounds {
  const shrink = frac / (1 + 2 * frac)
  const dLng = (padded[2] - padded[0]) * shrink
  const dLat = (padded[3] - padded[1]) * shrink
  return [padded[0] + dLng, padded[1] + dLat, padded[2] - dLng, padded[3] - dLat]
}

/**
 * Is a point off screen, so that something anchored to it (a popup) needs a
 * camera move before the user can see it?
 *
 * Takes the PADDED bounds — what BoundsTracker reports — and removes the pad
 * first. Testing the padded box directly would answer the question wrong in the
 * worse direction: a point inside the pad ring is off screen, would be judged in
 * view, and the popup would open where the user cannot see it, which is the
 * exact failure the pan exists to prevent. Erring the other way costs at most
 * one unnecessary 600ms flight.
 *
 * `null` bounds (no map load yet, so nothing has moved from the centre the map
 * was opened at) means no pan: gratuitous motion on an unchanged view is what
 * the motion doctrine forbids.
 */
export function pointNeedsPan(lat: number, lng: number, padded: MarkerBounds | null): boolean {
  if (!padded) return false
  return !pointInBounds(lat, lng, unpadBounds(padded))
}

/** A point-bearing marker. Anything with lat/lng can be filtered to a view. */
export interface PlacedMarker {
  lat: number
  lng: number
}

export interface MarkersInViewResult<T> {
  /** Markers inside the bounds, ordered as the caller passed them (capped). */
  visible: T[]
  /** Total in-view count BEFORE the cap (so the caller can show "N total"). */
  total: number
  /** True when `total` exceeds `cap` — caller shows a "zoom in to narrow" hint
   *  and may still render the first `cap` rows. */
  overCap: boolean
}

/** Is a point inside [minLng, minLat, maxLng, maxLat]? */
export function pointInBounds(lat: number, lng: number, bounds: MarkerBounds): boolean {
  return lng >= bounds[0] && lng <= bounds[2] && lat >= bounds[1] && lat <= bounds[3]
}

/**
 * Filter `markers` to those whose point falls inside `bounds`. Returns the
 * in-view subset (capped at `cap`), the pre-cap total, and an over-cap flag.
 * When `bounds` is null (map not ready yet) every marker is treated as in view
 * so the list is never empty before the first `moveend`/`load` fires.
 */
export function markersInView<T extends PlacedMarker>(
  markers: readonly T[],
  bounds: MarkerBounds | null,
  cap: number = MARKER_LIST_CAP,
): MarkersInViewResult<T> {
  const inView = bounds === null
    ? [...markers]
    : markers.filter(m => pointInBounds(m.lat, m.lng, bounds))
  return {
    visible: inView.slice(0, cap),
    total: inView.length,
    overCap: inView.length > cap,
  }
}
