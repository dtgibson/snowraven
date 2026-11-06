// The Life Lists tab's PASSIVE provenance reader (life-lists-tab schema 3.5).
//
// The shape of `useProvenanceLookup` exactly: the persistent store and the pure
// model and NOTHING ELSE. No `transport`, no `lib/tauri/*Service`, never the
// Statistics controller. The tab never initiates, retries or extends a
// provenance pass (FR-14); `exoticProvenanceGraph.test.ts` walks this module's
// static closure and fails if a network module ever becomes reachable from it.
//
// Both published lists are confirmed by the SAME mechanism, a published name
// honored only when every checklist in the loaded backup that carries it has
// been consulted, so the two switches cannot drift apart. An unpublished list or
// an unconfirmed name simply leaves its species listed (FR-19, the safe
// direction).

import { useEffect, useMemo, useSyncExternalStore } from 'react'
import type { ObservationEntry } from '../types'
import { confirmPublishedNames, type ProvenanceSnapshot } from './exoticProvenance'
import { getSnapshot, loadSnapshot, subscribe } from './exoticProvenanceCache'
import type { LifeListClassification } from './lifeLists'

export interface LifeListsProvenance extends LifeListClassification {
  /** FR-17: false until a Statistics pass on this build has written the list. */
  readonly exoticsPublished: boolean
  /** FR-20: true when every submission id in the observations is in the
   *  consulted ledger. */
  readonly ledgerCoversExport: boolean
}

const EMPTY_SET: ReadonlySet<string> = new Set<string>()

/**
 * "Is there any checklist in this backup the pass has not consulted?", the
 * PRD's wording. O(rows), one `Set.has` per distinct submission id.
 *
 * It deliberately ignores the TTL: a stale-but-present ledger entry counts as
 * consulted, matching `confirmExcludedNames`, which also ignores it. Do not
 * "fix" this toward the store's TTL-aware consulted set, which reads the clock
 * and is not render-safe.
 */
export function ledgerCoversExport(snapshot: ProvenanceSnapshot, obs: readonly ObservationEntry[]): boolean {
  const seen = new Set<string>()
  for (let i = 0; i < obs.length; i++) {
    const sub = obs[i].submissionId
    if (!sub || seen.has(sub)) continue
    if (!snapshot.checklists.has(sub)) return false
    seen.add(sub)
  }
  return true
}

/** The four facts the tab reads, from one snapshot and the loaded backup. */
export function lifeListsProvenance(snapshot: ProvenanceSnapshot, obs: readonly ObservationEntry[]): LifeListsProvenance {
  return {
    escapees: confirmPublishedNames(snapshot.excludedNames, snapshot, obs),
    exotics: snapshot.exoticNames ? confirmPublishedNames(snapshot.exoticNames, snapshot, obs) : EMPTY_SET,
    exoticsPublished: snapshot.exoticNames !== null,
    ledgerCoversExport: ledgerCoversExport(snapshot, obs),
  }
}

/**
 * `observations` should be the loaded backup's own stable array: the
 * confirmation is O(rows) and is memoized on the reference.
 */
export function useLifeListsProvenance(observations: readonly ObservationEntry[]): LifeListsProvenance {
  // The module keeps one memoized snapshot object and only replaces it when the
  // mirror actually changes, so this is referentially stable between merges.
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)

  useEffect(() => { void loadSnapshot() }, [])

  return useMemo(() => lifeListsProvenance(snapshot, observations), [snapshot, observations])
}
