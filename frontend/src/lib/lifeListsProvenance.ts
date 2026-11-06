// The Life Lists tab's PASSIVE provenance reader (life-lists-tab schema 3.5).
//
// The persistent store and the pure model and NOTHING ELSE. No `transport`, no
// `lib/tauri/*Service`, never the Statistics controller. The tab never
// initiates, retries or extends a provenance pass (FR-14);
// `exoticProvenanceGraph.test.ts` walks this module's static closure and fails
// if a network module ever becomes reachable from it.
//
// The escapee list is confirmed against the loaded backup (a published name is
// honored only when every checklist carrying it has been consulted), the
// Species Detail mechanism. The exotic list is read AS PUBLISHED: its rule is
// about the observations the pass consulted, so an unconsulted checklist cannot
// change it (FR-16; decisions.md D-25). An unpublished list leaves its species
// listed (FR-19, the safe direction).
//
// The status sentence (FR-20) reads the SAME completion Statistics reports: no
// species in this export's cover index is still unknown or unresolved
// (`remainingSpecies`, the predicate its controller ends a pass on). It is
// built from the tab's own taxon codes with the shared model functions, so it
// cannot disagree with Statistics' rule, and it is computed against the CURRENT
// export, never a flag persisted from an older one. The codes feed this status
// and BirdName's marks only; never the classification above.

import { useEffect, useMemo, useSyncExternalStore } from 'react'
import type { ObservationEntry } from '../types'
import { buildCoverIndex, confirmPublishedNames, remainingSpecies, type ProvenanceSnapshot } from './exoticProvenance'
import { getSnapshot, loadSnapshot, subscribe } from './exoticProvenanceCache'
import type { LifeListClassification } from './lifeLists'

export interface LifeListsProvenance extends LifeListClassification {
  /** FR-17: false until a Statistics pass on this build has written the list. */
  readonly exoticsPublished: boolean
  /** FR-20: Statistics' exotic status check is complete for this export. */
  readonly checkComplete: boolean
}

/** The resolved taxon codes for the current roster, keyed by normalized name,
 *  or null while they are pending or after the batch failed. */
export type RosterCodes = Readonly<Record<string, string>> | null

const EMPTY_SET: ReadonlySet<string> = new Set<string>()
const NO_PARKED: ReadonlySet<string> = new Set<string>()

/** The two published classifications, from one snapshot and the loaded backup. */
export function lifeListsClassification(snapshot: ProvenanceSnapshot, obs: readonly ObservationEntry[]): LifeListClassification {
  return {
    escapees: confirmPublishedNames(snapshot.excludedNames, snapshot, obs),
    exotics: snapshot.exoticNames ? new Set(snapshot.exoticNames) : EMPTY_SET,
  }
}

/**
 * Statistics' completion for this export: every species in its cover index has
 * an answer (counting, or escapee-only). False while the codes are unknown, when
 * nothing has been consulted, or when no species resolves to a code, so a
 * vacuous index never reads as finished. O(rows) to build the index, then one
 * classification per species.
 */
export function statisticsCheckComplete(snapshot: ProvenanceSnapshot, obs: readonly ObservationEntry[], codes: RosterCodes): boolean {
  if (codes === null || snapshot.species.size === 0) return false
  const index = buildCoverIndex(obs, norm => (Object.hasOwn(codes, norm) ? codes[norm] : undefined))
  if (index.bySpecies.size === 0) return false
  return remainingSpecies(snapshot, index, NO_PARKED).length === 0
}

/**
 * `observations` should be the loaded backup's own stable array and `codes`
 * the tab's state object: both memos key on the references.
 */
export function useLifeListsProvenance(observations: readonly ObservationEntry[], codes: RosterCodes): LifeListsProvenance {
  // The module keeps one memoized snapshot object and only replaces it when the
  // mirror actually changes, so this is referentially stable between merges.
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)

  useEffect(() => { void loadSnapshot() }, [])

  const classification = useMemo(() => lifeListsClassification(snapshot, observations), [snapshot, observations])
  const checkComplete = useMemo(() => statisticsCheckComplete(snapshot, observations, codes), [snapshot, observations, codes])
  return useMemo(
    () => ({ ...classification, exoticsPublished: snapshot.exoticNames !== null, checkComplete }),
    [classification, snapshot, checkComplete],
  )
}
