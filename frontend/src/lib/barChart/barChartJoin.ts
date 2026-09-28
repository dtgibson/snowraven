// Join a parsed bar-chart file's rows to a county's species pool (targets-tab,
// schema.md section 2.5), with the three-way accounting FR-35 requires: every
// file row is MATCHED, SKIPPED as a non-species form, or UNMATCHED, and the
// three sum to the file's species rows. Nothing is dropped silently.
//
// THE KEY on both sides is `normalizeSpeciesName(name).toLowerCase()`, the
// Nearby Lifers rule (`buildNearbyLifers`), so a subspecies row
// (`Dark-eyed Junco (Oregon)`) folds to its species. `isNonCountableForm` runs
// on the RAW name BEFORE the fold (the house order in subspeciesExplorer.ts):
// the form is what eBird is judging, and it exists only in the raw name.
//
// COLLISIONS: a species row and a subspecies row can fold to one key. The
// species-shaped row (its raw name equals its normalized name) wins; a folded
// row is taken only when no species-shaped row exists for the key. Both are
// counted `matched`, because both joined the pool.
//
// Linear: one Map over the pool, one Map.get per file row, O(rows + pool). The
// keys are strings out of a user file, so every lookup table is a real Map,
// never an object literal indexed by a name (security.md's prototype-chain
// rule: a row named `__proto__` is just an unmatched row).

import { isNonCountableForm, normalizeSpeciesName } from '../speciesUtils'
import type { EbirdSpecies } from '../countyCompleteness'
import type { BarChartFile, BarChartRow } from './parseBarChart'

export interface BarChartJoin {
  /** The joined rows, keyed by the POOL's species code. */
  bySpeciesCode: Map<string, BarChartRow>
  matched: number
  /** Rows whose raw name is a non-species form (spuh, slash, hybrid, domestic). */
  skippedForms: number
  /** Species-shaped names that joined nothing, usually a name eBird has since
   *  changed. `sciName` is for display in the unmatched list only. */
  unmatched: { name: string; sciName: string | null }[]
  /** Rows the parser skipped as malformed: reported beside the three, never in
   *  the FR-35 sum (they were never species rows the join could judge). */
  malformed: number
}

/** The join key: the Nearby Lifers fold, case-insensitive. */
export function barChartJoinKey(name: string): string {
  return normalizeSpeciesName(name).toLowerCase()
}

export function joinBarChartToPool(file: BarChartFile, pool: readonly EbirdSpecies[]): BarChartJoin {
  const poolIndex = new Map<string, string>()
  for (const s of pool) {
    const key = barChartJoinKey(s.commonName)
    if (!poolIndex.has(key)) poolIndex.set(key, s.speciesCode)
  }

  const bySpeciesCode = new Map<string, BarChartRow>()
  const takenBySpeciesShaped = new Set<string>()
  const unmatched: { name: string; sciName: string | null }[] = []
  let matched = 0
  let skippedForms = 0

  for (const row of file.rows) {
    if (isNonCountableForm(row.name)) { skippedForms++; continue }
    const norm = normalizeSpeciesName(row.name)
    const code = poolIndex.get(norm.toLowerCase())
    if (code === undefined) { unmatched.push({ name: row.name, sciName: row.sciName }); continue }
    matched++
    if (norm === row.name) {
      // Species-shaped: always wins its key.
      if (!takenBySpeciesShaped.has(code)) {
        bySpeciesCode.set(code, row)
        takenBySpeciesShaped.add(code)
      }
    } else if (!takenBySpeciesShaped.has(code) && !bySpeciesCode.has(code)) {
      // A folded form, taken only while nothing species-shaped holds the key.
      bySpeciesCode.set(code, row)
    }
  }

  return { bySpeciesCode, matched, skippedForms, unmatched, malformed: file.malformed }
}
