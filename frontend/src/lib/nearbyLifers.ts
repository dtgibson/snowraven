// Pure (no React, no I/O) client logic for the Nearby Lifers Map section, so it's
// unit-testable in node-env — mirrors the pure-and-tested pattern of
// lib/sightingMarkers.ts.
//
// The user's life list lives only on the client (parsed from the eBird backup),
// so the server returns every recent species in the radius and the client
// subtracts the recorded species and groups by location. Input records are the
// recent-obs records (TargetPin shape — exactly what GET /map/recent-obs returns,
// one per (speciesCode, locId), already grouped to each species' most-recent spot
// over a 30-day window).

import type { TargetPin, NearbyLiferLocation } from './mapExplorerTypes'
import { normalizeSpeciesName } from './speciesUtils'
import { recencyTier, distanceMiles } from './mapExplorerFormat'

/**
 * Build one NearbyLiferLocation per distinct location from recent-obs records.
 *
 * - A record is a "nearby lifer" only if its normalized common name is NOT in
 *   `recordedNames` (the user's recorded-species set, normalized case-insensitive
 *   with the SAME normalizeSpeciesName the rest of the app uses) — recorded
 *   species are filtered out.
 * - Records with null/invalid coordinates are skipped (no pin, never plotted at
 *   0,0). A defensive guard; mapService/backend already drop these.
 * - Records group by `locId` into one location; each location's `lifers` are
 *   sorted most-recent first (OQ-02); `count` is the distinct lifer-species
 *   count (OQ-03); `mostRecentDate` + recency `tier` come from the newest report.
 * - Returned locations are sorted nearest-first by distance from
 *   (centerLat, centerLng) (FR-13 / QA-09).
 *
 * `nowMs` is accepted for signature parity with isWithinWindow / testability; the
 * recency-window filter is applied by the caller via isWithinWindow before/around
 * this. (The tier comes from recencyTier, which reads the current day itself.)
 */
export function buildNearbyLifers(
  records: TargetPin[],
  recordedNames: Set<string>,
  centerLat: number,
  centerLng: number,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  nowMs: number,
): NearbyLiferLocation[] {
  // Normalize the recorded set once, case-insensitive, with the shared normalizer.
  const recorded = new Set<string>()
  for (const n of recordedNames) recorded.add(normalizeSpeciesName(n).toLowerCase())

  const byLoc = new Map<string, NearbyLiferLocation>()
  const seenAtLoc = new Map<string, Set<string>>() // locId -> distinct speciesCodes (for count)

  for (const rec of records) {
    // Subtract recorded species (normalized, case-insensitive).
    if (recorded.has(normalizeSpeciesName(rec.comName).toLowerCase())) continue
    // Skip null/invalid coordinates.
    if (typeof rec.lat !== 'number' || typeof rec.lng !== 'number'
        || Number.isNaN(rec.lat) || Number.isNaN(rec.lng)) continue

    let loc = byLoc.get(rec.locId)
    if (!loc) {
      loc = {
        locId: rec.locId,
        locName: rec.locName,
        lat: rec.lat,
        lng: rec.lng,
        lifers: [],
        count: 0,
        mostRecentDate: rec.recentDate,
        tier: recencyTier(rec.recentDate),
      }
      byLoc.set(rec.locId, loc)
      seenAtLoc.set(rec.locId, new Set())
    }

    loc.lifers.push({
      comName: rec.comName,
      speciesCode: rec.speciesCode,
      recentDate: rec.recentDate,
      subId: rec.subId,
    })
    seenAtLoc.get(rec.locId)!.add(rec.speciesCode)

    if (rec.recentDate > loc.mostRecentDate) {
      loc.mostRecentDate = rec.recentDate
    }
  }

  const locations = [...byLoc.values()]
  for (const loc of locations) {
    // Species most-recent first (OQ-02).
    loc.lifers.sort((a, b) => b.recentDate.localeCompare(a.recentDate))
    // count = distinct lifer species at the location (OQ-03).
    loc.count = seenAtLoc.get(loc.locId)!.size
    // tier from the newest report (recomputed after mostRecentDate settled).
    loc.tier = recencyTier(loc.mostRecentDate)
  }

  // Nearest-first by distance from the center (FR-13).
  locations.sort((a, b) =>
    distanceMiles(centerLat, centerLng, a.lat, a.lng)
    - distanceMiles(centerLat, centerLng, b.lat, b.lng))

  return locations
}

const MS_PER_DAY = 86400000

/**
 * Shared Time-range predicate used by BOTH the Nearby Lifers section AND Media
 * Targets (FR-21 / FR-22). True when `recentDate` (a "YYYY-MM-DD" or
 * "YYYY-MM-DD HH:MM"-style string, the leading date is used) is within
 * `windowDays` of `nowMs`, inclusive on both edges.
 *
 * Windows used by the UI: 1 (last day), 7 (last week), 30 (last 30 days).
 *
 * Day-granular: both the report date and "now" are floored to local midnight so a
 * report from exactly `windowDays` ago counts (inclusive), and a same-day report
 * (0 days) always counts. A malformed/empty date is excluded.
 */
export function isWithinWindow(recentDate: string, windowDays: number, nowMs: number): boolean {
  const dateStr = (recentDate ?? '').split(' ')[0]
  const parts = dateStr.split('-').map(Number)
  if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) return false
  const [y, m, d] = parts
  const obs = new Date(y, m - 1, d)
  obs.setHours(0, 0, 0, 0)
  const now = new Date(nowMs)
  now.setHours(0, 0, 0, 0)
  const days = Math.floor((now.getTime() - obs.getTime()) / MS_PER_DAY)
  return days >= 0 && days <= windowDays
}
