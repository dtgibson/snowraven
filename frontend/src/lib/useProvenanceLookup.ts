// The PASSIVE provenance reader (schema.md §2, FR-34, FR-35).
//
// Every surface other than Statistics reads the escapee rule through this hook.
// It touches the persistent store and the pure model and NOTHING ELSE: no
// `transport`, no `lib/tauri/*Service`, no key dependency, no fetch of any kind.
// That is what preserves the Calendar's zero-network guarantee (v0.5.63,
// FR-35/QA-40), and it is enforced by the import graph rather than by discipline
// — `exoticProvenanceGraph.test.ts` walks this module's static closure and fails
// if a network module ever becomes reachable from it.
//
// When the cache has never been populated the returned set is empty, so every
// in-scope surface produces exactly its pre-feature numbers (FR-26, QA-32).

import { useEffect, useMemo, useSyncExternalStore } from 'react'
import type { ObservationEntry } from '../types'
import { confirmExcludedNames } from './exoticProvenance'
import { getSnapshot, loadSnapshot, subscribe } from './exoticProvenanceCache'

/**
 * The normalized common names that are currently classified escapee-only AND
 * whose every carrying checklist in `observations` has already been consulted.
 *
 * Compose it with the surface's existing countable-form predicate; never replace
 * that predicate (FR-05). Note the two take DIFFERENT inputs, which is not a
 * slip: the form rule needs the RAW exported name (the form only exists there),
 * while this set is keyed by normalized name.
 *
 *     if (isNonCountableForm(o.commonName) || excludedNames.has(norm)) continue
 *
 * `observations` should be a stable array reference (the loaded backup), because
 * the confirmation pass is O(rows) and is memoized on it.
 */
export function useProvenanceLookup(observations: readonly ObservationEntry[]): ReadonlySet<string> {
  // The module keeps one memoized snapshot object and only replaces it when the
  // mirror actually changes, so this is referentially stable between merges.
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)

  useEffect(() => { void loadSnapshot() }, [])

  return useMemo(
    () => confirmExcludedNames(snapshot, observations),
    [snapshot, observations],
  )
}
