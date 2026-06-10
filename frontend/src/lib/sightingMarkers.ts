// Per-coordinate aggregation for the shared sightings map. Pure (no React, no
// I/O) so it's unit-testable and shared by Species Detail's Sighting Locations
// map and the per-individual card map on the Named Birds tab — one implementation
// instead of two hand-synced aggregation memos.

export type SightingMarker = {
  lat: number
  lng: number
  sightings: { submissionId: string; date: string }[]   // newest first
}

/**
 * Group sightings by coordinate into one marker per unique lat/lng.
 *
 * - Sightings with a null latitude OR longitude are silently skipped (FR-22) —
 *   no pin, no error; the caller's report list still shows them.
 * - Sightings at the same coordinate aggregate into one marker (FR-24); each
 *   marker's dates are sorted newest-first for the popup.
 * - An empty result means the caller renders no map (FR-23) — the empty-array
 *   guard is the caller's, so the WebGL context never mounts for a
 *   no-coordinate individual.
 */
export function buildSightingMarkers(
  sightings: { latitude: number | null; longitude: number | null; submissionId: string; date: string }[],
): SightingMarker[] {
  const map = new Map<string, SightingMarker>()
  for (const s of sightings) {
    if (s.latitude === null || s.longitude === null) continue
    const key = `${s.latitude},${s.longitude}`
    const hit = map.get(key)
    if (hit) {
      hit.sightings.push({ submissionId: s.submissionId, date: s.date })
    } else {
      map.set(key, { lat: s.latitude, lng: s.longitude, sightings: [{ submissionId: s.submissionId, date: s.date }] })
    }
  }
  for (const m of map.values()) m.sightings.sort((a, b) => b.date.localeCompare(a.date))
  return [...map.values()]
}
