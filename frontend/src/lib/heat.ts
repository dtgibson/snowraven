// Shared heatmap intensity model for the MapLibre native heatmap layers.
// Single source of truth used by BOTH the Map Explorer (My Sightings) and the
// Species Detail map, so the 1–10 intensity slider behaves identically in both
// places. (Pre-vector-basemap this drove leaflet.heat; now it drives MapLibre's
// `heatmap` layer paint properties.)

/** Default slider position (1–10). */
export const HEAT_INTENSITY_DEFAULT = 5

/** Heatmap kernel radius in screen pixels. 1 → 18 px … 10 → 72 px. Bounded so
 *  far-spread tails don't band into artifacts; blur is handled natively. */
export function heatRadiusPx(intensity: number): number {
  return Math.round(12 + intensity * 6)
}

/** Global heatmap intensity (accumulation) multiplier. Cooler curve, tuned live:
 *  default (5) lands at 0.30; full range 0.06 (subtle) → 0.60 (hot). */
export function heatIntensityFactor(intensity: number): number {
  return +(intensity * 0.06).toFixed(2)
}

/**
 * Per-point heat weight. The divisor is the observation count that reaches
 * full heat: 20 at intensity 1 (count-proportional, the original behavior)
 * down to 2 at intensity 10 (almost any sighting saturates), so HIGH
 * intensity makes even sparse, low-count locations burn hot.
 */
export function heatWeight(count: number, intensity: number): number {
  const divisor = Math.max(2, 20 - (intensity - 1) * 2)
  return Math.min(count / divisor, 1)
}
