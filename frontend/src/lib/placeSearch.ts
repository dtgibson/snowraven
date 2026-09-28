// The app's one place-name search (the Nominatim forward geocode), shared by
// Map Explorer's three sidebar searches and the Targets tab's "Measure distances
// from" chooser through `components/AddressSearch.tsx`, so the two cannot drift
// (targets-tab design-spec 2a; it was a private function in MapExplorer.tsx).
//
// ONE REQUEST PER PRESS, NEVER PER KEYSTROKE: the component calls this only on
// Enter or the Search button, and holds an in-flight flag so a second press
// while one is outstanding sends nothing. The request goes through the
// transport seam (`/nominatim/search`), so it rides the existing >= 1 s
// request-start queue on both transports and the host PRIVACY_POLICY.md already
// discloses ("to turn a place name you type into map coordinates").
//
// THE ANSWER IS VALIDATED, not trusted: a body that is not a list, an empty
// list, or a first result whose coordinates are not finite and in range is "no
// location found", never a NaN handed to a map or a distance. Before the
// extraction a non-list body threw a TypeError inside the search, which the
// offline classifier can read as "you're offline".

import { transport } from './transport'

/** The miss line, word for word the one Map Explorer has always shown. */
export const PLACE_NOT_FOUND = 'No location found. Try a different search term.'
/** Map Explorer's failure line (it offers coordinate entry beside the search). */
export const PLACE_SEARCH_FAILED = 'Location search failed. Try again or enter coordinates manually.'

export interface PlaceHit { lat: number; lng: number }

/**
 * Look `q` up. Resolves the first result's coordinates, or null when there is
 * no usable result; rejects when the request itself failed (the caller
 * classifies that, so offline reads as offline).
 */
export async function searchPlace(q: string): Promise<PlaceHit | null> {
  const data = await transport.get<unknown>('/nominatim/search', { q })
  if (!Array.isArray(data) || data.length === 0) return null
  const first = data[0] as { lat?: unknown; lon?: unknown } | null
  if (typeof first !== 'object' || first === null) return null
  const lat = typeof first.lat === 'string' || typeof first.lat === 'number' ? parseFloat(String(first.lat)) : NaN
  const lng = typeof first.lon === 'string' || typeof first.lon === 'number' ? parseFloat(String(first.lon)) : NaN
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) return null
  return { lat, lng }
}
