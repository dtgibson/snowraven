// Classify every pool species against the user's record (targets-tab,
// schema.md section 5.2; FR-16, FR-17).
//
//   Lifer    : neither the species' code nor its name key is in the record.
//   Media    : recorded, and the ML export lacks at least one of Photo, Audio,
//              Video for it (Map Explorer's Media Targets rule, species-level).
//   Breeding : recorded, and no observation carries a recognized breeding
//              code (F and H count, as the Breeding Codes tab counts them).
//
// DISJOINT BY CONSTRUCTION (FR-17): `missingMedia` and `codes` are computed
// only when the species is NOT a lifer, so a lifer can never carry a Media or
// Breeding badge, while a recorded species can carry both.

import type { EbirdSpecies } from '../countyCompleteness'
import { MEDIA_TYPES, speciesKey, type MediaType, type SpeciesKey, type TargetsRecord } from './targetsRecord'

export interface Classified {
  speciesCode: string
  commonName: string
  /** Position in the pool, which is eBird taxonomic order (the Taxonomic sort, every tiebreak). */
  poolIndex: number
  lifer: boolean
  /** Null for a lifer or with no usable ML export; [] means it has all three (not a Media target). */
  missingMedia: MediaType[] | null
  /** The recorded breeding codes; always empty for a lifer. */
  codes: ReadonlySet<string>
  /** The backup name Species Detail opens on; null for a lifer (FR-57). */
  openName: string | null
  /** A scientific name from the backup, when the user recorded it (display only). */
  sciName: string | null
}

const NO_CODES: ReadonlySet<string> = new Set()

export function classifyPool(pool: readonly EbirdSpecies[], record: TargetsRecord): Classified[] {
  const out: Classified[] = []
  for (let i = 0; i < pool.length; i++) {
    const s = pool[i]
    const poolKey = speciesKey(s.commonName)
    // The key the record knows this species by: its own name, or, for a
    // species recorded only under a name eBird has since changed, the key its
    // code resolves to.
    let recordKey: SpeciesKey | null = null
    if (record.names.has(poolKey)) recordKey = poolKey
    else if (record.codes.has(s.speciesCode)) recordKey = record.keyByCode.get(s.speciesCode) ?? null
    const lifer = recordKey === null && !record.codes.has(s.speciesCode)

    let missingMedia: MediaType[] | null = null
    let codes: ReadonlySet<string> = NO_CODES
    let openName: string | null = null
    let sciName: string | null = null
    if (!lifer) {
      if (record.mediaByKey !== null) {
        const have = recordKey !== null ? record.mediaByKey.get(recordKey) : undefined
        missingMedia = MEDIA_TYPES.filter(t => !have?.has(t))
      }
      if (recordKey !== null) {
        codes = record.codesByKey.get(recordKey) ?? NO_CODES
        openName = record.openNameByKey.get(recordKey) ?? null
        sciName = record.sciByKey.get(recordKey) ?? null
      }
    }
    out.push({
      speciesCode: s.speciesCode,
      commonName: s.commonName,
      poolIndex: i,
      lifer,
      missingMedia,
      codes,
      openName,
      sciName,
    })
  }
  return out
}
