// The Hotspot Reports picker's per-keystroke filter and its window
// (hotspot-reports schema section 3, FR-19 to FR-23).
//
// DECLARED SCAN H4 (schema 12.1, `.claude/rules/security.md`): one walk over the
// picker order per keystroke, one `String.prototype.includes` per location over
// its haystack, which is bounded at build (about 360 code units: the bounded
// name, the place label and the state name), against a query cut to
// PICKER_QUERY_MAX_CHARS inside this function. The haystack IS the bounded
// string, so the native search cannot run past it. That call is this module's
// single use of a search primitive; `hotspotReportsPicker.test.ts` asserts
// exactly one with comments stripped. At most PICKER_OPTION_CAP ordinals out,
// whatever the file holds (FR-22, NFR-03).

import type { LocationIndex } from './hotspotReports'

/** FR-22: location options rendered, a number the file cannot change. */
export const PICKER_OPTION_CAP = 200
/** FR-19: the query input's bound, enforced here as well as on the input. */
export const PICKER_QUERY_MAX_CHARS = 100

export interface PickerWindow {
  /** At most PICKER_OPTION_CAP ordinals, in FR-20's order. */
  readonly ords: readonly number[]
  /** Every location that matches, for "Showing 200 of N". */
  readonly matches: number
  /** Rank of the first rendered match among the matches. */
  readonly start: number
}

/**
 * FR-19, FR-22. A non-empty query: the first PICKER_OPTION_CAP matches in
 * picker order, and the full match count. An empty query matches every
 * location and reads no haystack; its window is the first PICKER_OPTION_CAP
 * ranks, except that a selected location ranked beyond them slides the window
 * so its row is rendered and can be the active row on open (FR-23, the schema's
 * settlement of the FR-22 / FR-23 collision).
 */
export function filterLocations(index: LocationIndex, query: string, selectedOrd: number | null): PickerWindow {
  const L = index.locations.length
  const q = query.slice(0, PICKER_QUERY_MAX_CHARS).trim().toLowerCase()
  if (q === '') {
    let start = 0
    if (selectedOrd !== null && selectedOrd >= 0 && selectedOrd < L) {
      const rank = index.rankOf[selectedOrd]
      if (rank >= PICKER_OPTION_CAP) start = Math.min(rank, L - PICKER_OPTION_CAP)
    }
    const end = Math.min(L, start + PICKER_OPTION_CAP)
    const ords: number[] = []
    for (let k = start; k < end; k++) ords.push(index.pickerOrder[k])
    return { ords, matches: L, start }
  }
  const ords: number[] = []
  let matches = 0
  for (let k = 0; k < L; k++) {
    const ord = index.pickerOrder[k]
    if (!index.locations[ord].haystack.includes(q)) continue
    matches += 1
    if (ords.length < PICKER_OPTION_CAP) ords.push(ord)
  }
  return { ords, matches, start: 0 }
}
