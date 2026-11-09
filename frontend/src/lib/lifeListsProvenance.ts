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
// (`remainingSpecies`, the predicate its controller ends a pass on, with the
// same input: the store's held stamps, so a species the answers settled by
// their absence is finished on both tabs). It is
// built from the tab's own taxon codes with the shared model functions, so it
// cannot disagree with Statistics' rule, and it is computed against the CURRENT
// export, never a flag persisted from an older one. The codes feed this status
// and BirdName's marks only; never the classification above.
//
// The index takes the SAME taxonomy join Statistics' does
// (escapee-check-new-taxonomy), from the same loader, so a pre-split name, and a
// lumped-away name in particular (which resolves to no code without the join),
// sits in both tabs' open set or in neither. `loadEscapeeJoin` reaches the
// history asset only through its dynamic import, and no network module.

import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import type { ObservationEntry } from '../types'
import { buildCoverIndex, confirmPublishedNames, heldStamps, remainingSpecies, type CoverIndex, type EscapeeJoin, type ProvenanceSnapshot } from './exoticProvenance'
import { getSnapshot, loadSnapshot, subscribe } from './exoticProvenanceCache'
import { loadEscapeeJoin } from './exoticTaxonomyJoin'
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
 * The export's cover index under this roster's codes (schema S9): the one
 * per-ROW part of the completion check, so the hook memoizes it on the rows,
 * the codes and the join alone and a provenance merge never rebuilds it
 * (security L2). Null while the codes or the join are unknown. O(rows):
 * `buildCoverIndex`, the linear function Statistics itself runs, with the code
 * table read through `Object.hasOwn` and Statistics' taxonomy join.
 */
export function rosterCoverIndex(obs: readonly ObservationEntry[], codes: RosterCodes, join: EscapeeJoin | null): CoverIndex | null {
  if (codes === null || join === null) return null
  return buildCoverIndex(obs, norm => (Object.hasOwn(codes, norm) ? codes[norm] : undefined), join)
}

/**
 * Statistics' completion for this export: every species in its cover index has
 * an answer (counting, or escapee-only) or is settled by the answers' absence
 * (a held stamp with every carrier consulted; `isSettledAbsence`). False
 * without an index, when nothing has been consulted, or when no species
 * resolves to a code, so a vacuous index never reads as finished. "Nothing
 * consulted" is no record AND no stamp: a store holding only stamps has
 * answers, and reads as checked. One classification per SPECIES, no row scan:
 * this is the half that re-runs on every snapshot change.
 */
export function checkCompleteFor(snapshot: ProvenanceSnapshot, index: CoverIndex | null): boolean {
  if (index === null || index.bySpecies.size === 0) return false
  const held = heldStamps(snapshot)
  if (snapshot.species.size === 0 && held.size === 0) return false
  return remainingSpecies(snapshot, index, NO_PARKED, held).length === 0
}

/** The two halves composed, for a caller without a memo. */
export function statisticsCheckComplete(
  snapshot: ProvenanceSnapshot, obs: readonly ObservationEntry[], codes: RosterCodes, join: EscapeeJoin | null,
): boolean {
  return checkCompleteFor(snapshot, rosterCoverIndex(obs, codes, join))
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

  // Statistics' taxonomy join, from the one loader both tabs use. Null until it
  // lands, which reads as "not finished", the same as codes still pending.
  const [join, setJoin] = useState<EscapeeJoin | null>(null)
  useEffect(() => {
    let cancelled = false
    void loadEscapeeJoin().then(j => { if (!cancelled) setJoin(j) })
    return () => { cancelled = true }
  }, [])

  const classification = useMemo(() => lifeListsClassification(snapshot, observations), [snapshot, observations])
  // Split on purpose (security L2): the per-row index is keyed on its inputs,
  // never on the snapshot, which is replaced on every merged checklist while a
  // Statistics pass runs; only the per-species check re-runs then.
  const index = useMemo(() => rosterCoverIndex(observations, codes, join), [observations, codes, join])
  const checkComplete = useMemo(() => checkCompleteFor(snapshot, index), [snapshot, index])
  return useMemo(
    () => ({ ...classification, exoticsPublished: snapshot.exoticNames !== null, checkComplete }),
    [classification, snapshot, checkComplete],
  )
}
