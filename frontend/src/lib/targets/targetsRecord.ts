// The user's record, folded to the species level the pool is expressed in
// (targets-tab, schema.md section 5.2; FR-16, FR-17).
//
// THE ROLL-UP RULE, stated because the three source rules are not all
// species-level. The county pool is species-level (`collapseToSpeciesList`),
// so every fact about the record is folded to `speciesKey`: a species is
// RECORDED if any form of it was observed; it HAS a media type if any Macaulay
// row of any form of it has that type; it HAS a breeding code if any
// observation of any form of it carries one. Map Explorer's Media Targets rule
// is per raw name, so "Dark-eyed Junco (Oregon)" and "Dark-eyed Junco" are two
// targets there and one here; a species-level list can have no other reading,
// and `docs/HELP.md` says so.
//
// THE CODE HALF OF THE LIFER SUBTRACTION. `/taxonomy/codes` (answered locally
// on both transports, so it works offline) maps each observed name, and its
// normalized parent, to its eBird species code. A pool species whose code the
// user has recorded under ANY name is not a lifer, which is what keeps a
// species eBird has renamed since the user's checklist from reappearing as a
// lifer (the `completenessTargets` subtraction, applied to the whole record).
// `keyByCode` then lets such a species find its media, codes and Species Detail
// name under the name the user recorded it by.
//
// Linear in both files (security.md's widened trigger): one pass over each
// file's rows into Map / Set accumulators keyed by `speciesKey`, no
// `includes` / `indexOf` / `find` inside a loop. The codes table is an external
// document keyed by species names out of the user's CSV, so every read goes
// through `Object.hasOwn` (security.md, the lookup-table rule).

import type { ObservationEntry } from '../../types'
import type { MLExportRow } from '../parseMLExport'
import { normalizeSpeciesName } from '../speciesUtils'
import { BREEDING_CODE_MAP } from '../breedingCodes'
import { SPECIES_CODE_RE } from '../speciesCode'

export type SpeciesKey = string
export type MediaType = 'Photo' | 'Audio' | 'Video'
export const MEDIA_TYPES: readonly MediaType[] = ['Photo', 'Audio', 'Video']

/** The one join key between the record, the pool and the bar-chart file. */
export function speciesKey(name: string): SpeciesKey {
  return normalizeSpeciesName(name).toLowerCase()
}

export interface TargetsRecord {
  /** Every observation row's key: the Nearby Lifers rule, no countability or escapee filter. */
  names: ReadonlySet<SpeciesKey>
  /** Species codes the user has recorded, from `/taxonomy/codes`; empty when that lookup failed. */
  codes: ReadonlySet<string>
  /** A recorded species code -> the key it was recorded under (renames resolve through this). */
  keyByCode: ReadonlyMap<string, SpeciesKey>
  /** Null when no ML export is usable. */
  mediaByKey: ReadonlyMap<SpeciesKey, ReadonlySet<MediaType>> | null
  /** Recognized breeding codes per species (BREEDING_CODE_MAP members only). */
  codesByKey: ReadonlyMap<SpeciesKey, ReadonlySet<string>>
  /** The raw backup name to hand to Species Detail, species-shaped preferred. */
  openNameByKey: ReadonlyMap<SpeciesKey, string>
  /** A scientific name per key, from the backup (display only). */
  sciByKey: ReadonlyMap<SpeciesKey, string>
}

/** The distinct (common, scientific) pairs to send to `/taxonomy/codes`. */
export function distinctNamePairs(observations: readonly ObservationEntry[]): Map<string, string> {
  const pairs = new Map<string, string>()
  for (const o of observations) {
    const name = o.commonName
    if (name && !pairs.has(name)) pairs.set(name, o.scientificName ?? '')
  }
  return pairs
}

export function buildTargetsRecord(
  observations: readonly ObservationEntry[],
  mlRows: readonly MLExportRow[] | null,
  codeByName: Readonly<Record<string, unknown>> | null,
): TargetsRecord {
  const names = new Set<SpeciesKey>()
  const codesByKey = new Map<SpeciesKey, Set<string>>()
  const openNameByKey = new Map<SpeciesKey, string>()
  const sciByKey = new Map<SpeciesKey, string>()
  // A memo per distinct raw name: the fold is the costly step and a backup
  // repeats a few thousand names across its rows.
  const keyOf = new Map<string, SpeciesKey>()
  const foldName = (raw: string): SpeciesKey => {
    let k = keyOf.get(raw)
    if (k === undefined) { k = speciesKey(raw); keyOf.set(raw, k) }
    return k
  }

  for (const o of observations) {
    const raw = o.commonName
    if (!raw) continue
    const key = foldName(raw)
    names.add(key)
    // Prefer a species-shaped raw name (one the fold leaves unchanged) over a
    // form name, so Species Detail opens on the species when both were seen.
    const prev = openNameByKey.get(key)
    if (prev === undefined || (normalizeSpeciesName(prev) !== prev && normalizeSpeciesName(raw) === raw)) {
      openNameByKey.set(key, raw)
    }
    if (!sciByKey.has(key) && o.scientificName) sciByKey.set(key, o.scientificName)
    const code = o.breedingCode
    if (code && BREEDING_CODE_MAP.has(code)) {
      let set = codesByKey.get(key)
      if (!set) { set = new Set(); codesByKey.set(key, set) }
      set.add(code)
    }
  }

  const codes = new Set<string>()
  const keyByCode = new Map<string, SpeciesKey>()
  if (codeByName) {
    for (const [raw] of keyOf) {
      // The request carried each observed name AND its normalized parent, so
      // either may be the one that resolved.
      for (const asked of [raw, normalizeSpeciesName(raw)]) {
        if (!Object.hasOwn(codeByName, asked)) continue
        const code = codeByName[asked]
        if (typeof code !== 'string' || !SPECIES_CODE_RE.test(code)) continue
        codes.add(code)
        if (!keyByCode.has(code)) keyByCode.set(code, foldName(raw))
      }
    }
  }

  let mediaByKey: Map<SpeciesKey, Set<MediaType>> | null = null
  if (mlRows) {
    mediaByKey = new Map()
    for (const row of mlRows) {
      if (!row.commonName) continue
      const key = foldName(row.commonName)
      let set = mediaByKey.get(key)
      if (!set) { set = new Set(); mediaByKey.set(key, set) }
      set.add(row.format)
    }
  }

  return { names, codes, keyByCode, mediaByKey, codesByKey, openNameByKey, sciByKey }
}
