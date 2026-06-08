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
