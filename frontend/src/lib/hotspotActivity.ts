// Recent community activity for ONE public hotspot (color-coded-hotspots,
// mode 3): the payload shape, the locId guard, the eBird-response reduction,
// and the two window counts — all pure, no React, no I/O, no clock (every
// `nowMs` is a parameter, per the render-purity rules).
//
// One `data/obs/{locId}/recent?back=30` call serves BOTH windows: the response
// is one record per species (its most recent observation at that location
// within 30 days), so the 30-day count is the record count and the 7-day count
// is the subset whose most recent `obsDt` falls within the last 7 days — exact,
// not an approximation (most-recent dominates every other date; a species was
// reported within 7 days iff its most recent report was). The 7-day predicate
// is the shared `isWithinWindow`, so "Week" means the same thing here as on
// every other Map Explorer surface (FR-10/FR-16).

import { isWithinWindow } from './nearbyLifers'

/**
 * The locId guard for the activity route, single-sourced for BOTH transports
 * (the Tauri twin validates with this exact compiled regex; the FastAPI route
 * carries the same pattern as a pydantic `pattern=` constraint — the documented
 * Rust-regex carve-out, which rejects a trailing newline itself, while JS `$`
 * never matches before one, so anchor parity holds by construction).
 *
 * Length-bounded per the v0.5.90 precedent (ceiling 10 digits). The shipped
 * unbounded `LOCATION_ID_RE` (HotspotLink's link gate) is a different guard for
 * a different question and is deliberately untouched; a hypothetical 11+-digit
 * locId from ref/hotspot/geo fails THIS guard and renders permanently
 * unanswered — accepted, stated in schema.md rather than discovered.
 */
export const HOTSPOT_ACTIVITY_LOC_ID_RE = /^L[0-9]{1,10}$/

/** One species' most recent report at the hotspot within eBird's back=30 window. */
export interface HotspotActivitySpecies {
  speciesCode: string
  obsDt: string
}

/** The reduced dual-transport response shape for GET /map/hotspot-activity. */
export interface HotspotActivityPayload {
  locId: string
  species: HotspotActivitySpecies[]
}

/**
 * Reduce a raw eBird `data/obs/{locId}/recent` response to one
 * (speciesCode, obsDt) pair per species — the most recent report of each.
 *
 * Keep a record only when `speciesCode` and `obsDt` are both non-empty strings;
 * dedupe by speciesCode keeping the lexicographically greatest obsDt
 * (ISO-style dates compare correctly as strings — the documented
 * /map/recent-obs reasoning). First-seen order is preserved, matching the
 * backend twin's dict-insertion order (the parity fixture pins both).
 * Nothing else from the upstream body crosses the transport.
 */
export function reduceActivityRecords(raw: unknown): HotspotActivitySpecies[] {
  if (!Array.isArray(raw)) return []
  const best = new Map<string, string>()
  for (const rec of raw) {
    if (typeof rec !== 'object' || rec === null) continue
    const code = (rec as { speciesCode?: unknown }).speciesCode
    const obsDt = (rec as { obsDt?: unknown }).obsDt
    if (typeof code !== 'string' || code === '') continue
    if (typeof obsDt !== 'string' || obsDt === '') continue
    const prev = best.get(code)
    if (prev === undefined || obsDt > prev) best.set(code, obsDt)
  }
  return [...best.entries()].map(([speciesCode, obsDt]) => ({ speciesCode, obsDt }))
}

export interface ActivityCounts {
  /** Distinct species in eBird's back=30 window, as returned. */
  count30: number
  /** Subset whose most recent obsDt is within 7 days of `nowMs` (inclusive,
   *  day-granular — the shared isWithinWindow semantics). */
  count7: number
}

/**
 * Both window counts from one reduced species list. `nowMs` is the moment the
 * data was fetched (the cache's TTL anchor), threaded as an argument so this
 * stays clock-free; count7 ≤ count30 by construction.
 */
export function computeActivityCounts(species: HotspotActivitySpecies[], nowMs: number): ActivityCounts {
  let count7 = 0
  for (const s of species) {
    if (isWithinWindow(s.obsDt, 7, nowMs)) count7 += 1
  }
  return { count30: species.length, count7 }
}
