// Shared heatmap intensity model for leaflet.heat layers.
// Single source of truth used by both the Map Explorer (My Sightings)
// and Species Detail heatmaps, so the 1–10 intensity slider behaves
// identically in both places. See DECISIONS.md / CLAUDE.md for the
// artifact-avoidance tuning notes (radius bounded, max floored).

/** Default slider position (1–10). */
export const HEAT_INTENSITY_DEFAULT = 5

/** Smooth quadratic anchored at 1→18, 5→40, 10→80 px. */
export function heatRadius(intensity: number): number {
  return Math.round(13.9 + 3.83 * intensity + 0.278 * intensity * intensity)
}

/** Blur tracks radius at ~0.5× to avoid triangular far-spread artifacts. */
export function heatBlur(intensity: number): number {
  return Math.round(heatRadius(intensity) * 0.5)
}

/** Lower max = hotter. 1→1.0 (subtle) … 10→0.75 (warmer, without over-saturating). */
export function heatMax(intensity: number): number {
  return +(1.0 - (intensity - 1) * (0.25 / 9)).toFixed(2)
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
