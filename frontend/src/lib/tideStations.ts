// Nearest-NOAA-station resolution for the weather-tides feature. The station
// list is bundled (US-only, built by scripts/build-tide-stations.mjs), so this
// is all offline: haversine to the nearest station + a coarse US-region test
// that distinguishes "outside the US" (NOAA has no data there) from "in the US
// but far from any station". See pipeline/weather-tides/schema.md.

import stationData from '../assets/noaa-tide-stations.json'

export interface TideStation {
  id: string
  name: string
  lat: number
  lng: number
  state: string
  /** True when the station has a real water-level gauge (observed data possible). */
  obs: boolean
}

const STATIONS: TideStation[] = (stationData as { stations: TideStation[] }).stations

/** Default radius (miles): beyond this, the nearest station is "too far". */
export const TIDE_MAX_MILES = 25

// Coarse US bounding boxes [west, south, east, north] — mirror the build script.
// Used to tell "outside the US" from "far inland in the US". Coarse by design;
// the override covers border edge cases.
const US_BOXES: ReadonlyArray<readonly [number, number, number, number]> = [
  [-125.1, 24.2, -66.7, 49.5],   // CONUS
  [-179.5, 51.0, -129.0, 71.5],  // Alaska
  [172.0, 51.0, 180.0, 53.5],    // Aleutians across the antimeridian
  [-160.5, 18.5, -154.5, 22.6],  // Hawaii
  [-67.5, 17.6, -64.5, 18.6],    // PR + USVI
  [144.5, 13.0, 145.9, 15.3],    // Guam + CNMI
  [-171.2, -14.5, -169.3, -13.2],// American Samoa
]

export function isInUS(lat: number, lng: number): boolean {
  return US_BOXES.some(([w, s, e, n]) => lng >= w && lng <= e && lat >= s && lat <= n)
}

export function haversineMiles(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3958.8
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export interface NearestStation {
  station: TideStation
  distanceMi: number
}

/** Nearest bundled station to a point, with its distance. null only if the
 *  bundle is somehow empty. `preferObs` biases toward gauge stations when one is
 *  within `obsWithinMi` of the overall nearest (so observed data is more likely). */
export function nearestStation(
  lat: number,
  lng: number,
  opts: { preferObs?: boolean; obsWithinMi?: number } = {},
): NearestStation | null {
  if (STATIONS.length === 0) return null
  let best: TideStation | null = null
  let bestD = Infinity
  let bestObs: TideStation | null = null
  let bestObsD = Infinity
  for (const s of STATIONS) {
    const d = haversineMiles(lat, lng, s.lat, s.lng)
    if (d < bestD) { bestD = d; best = s }
    if (s.obs && d < bestObsD) { bestObsD = d; bestObs = s }
  }
  if (opts.preferObs && bestObs && bestObsD <= bestD + (opts.obsWithinMi ?? 10)) {
    return { station: bestObs, distanceMi: bestObsD }
  }
  return { station: best as TideStation, distanceMi: bestD }
}

export type TideLocationStatus = 'ok' | 'too-far' | 'outside-us'

/** Classify a checklist point: ok (station within range), too-far (in US but the
 *  nearest is > TIDE_MAX_MILES), or outside-us (no US coverage). */
export function classifyTideLocation(
  lat: number,
  lng: number,
  nearest: NearestStation | null,
  maxMiles = TIDE_MAX_MILES,
): TideLocationStatus {
  if (!isInUS(lat, lng)) return 'outside-us'
  if (!nearest || nearest.distanceMi > maxMiles) return 'too-far'
  return 'ok'
}
