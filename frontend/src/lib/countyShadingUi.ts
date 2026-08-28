// Shared presentation constants for the two NEW county-shading mount sites
// (county-shading-and-project-stats, FR-05, FR-12).
//
// A `lib/` home rather than a constant beside a component, for the
// `react-refresh/only-export-components` reason `lib/exoticCopy.ts` cites: a
// non-component export from a `.tsx` trips that rule. Dependency-free, so it
// costs nothing wherever it is pulled in.

/**
 * Pin / heat opacity beneath an active county fill, on the two new maps.
 *
 * Deliberately NOT `ATLAS_DIM_FACTOR` (0.25) or the Map Explorer's 0.45
 * heatmap-opacity. Those govern a GL `circle` layer of small dots and a
 * whole-map heat wash; Species Detail's pins are 24x34 DOM teardrops, which are
 * far more visually dominant, and the design was measured against them. One
 * constant so the two branches of that map cannot drift.
 */
export const SHADED_PIN_OPACITY = 0.4

/** The one-line explanation under the metric control on Statistics (FR-13). */
export const STATS_SHADING_HINT =
  'Tints each county by your own count there, drawn only from your loaded backup. The numbers match the county tables below and the Map Explorer.'

/** The Species Detail equivalent: one species, one metric, no network. */
export const SPECIES_SHADING_HINT =
  'Tints each county by how many of your checklists there reported this bird, drawn only from your loaded backup.'

/** Legend title for the per-species surface. The shipped
 *  `COUNTY_METRIC_META.records.title` reads "Total checklists per county",
 *  which is wrong here: these are the checklists that reported ONE bird. */
export function speciesLegendTitle(commonName: string): string {
  return `Your ${commonName} checklists per county`
}

/** The second sentence of the empty-legend note, per surface. The shipped Map
 *  Explorer wording ("Add records or load a backup with county data") is wrong
 *  advice when a backup IS loaded and the species is simply narrow. */
export function speciesEmptyNote(commonName: string): string {
  return `You have no US county records for ${commonName} in the loaded backup.`
}

export const STATS_EMPTY_NOTE =
  'The loaded backup has no US county records to shade.'
