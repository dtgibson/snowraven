// The Hotspot Reports tab's PASSIVE escapee reader (hotspot-reports schema
// section 6, FR-35, NFR-05).
//
// The persistent store and types and NOTHING ELSE: no `transport`, no
// `lib/tauri/*Service`, never the Statistics controller. The tab never starts,
// retries or extends the exotic status check. `exoticProvenanceGraph.test.ts`
// walks this module's static closure and fails if a network module ever
// becomes reachable from it. It builds no cover index, so `loadEscapeeJoin()`
// and `buildCoverIndex` appear nowhere in this feature: the rule that every
// builder of an escapee cover index passes the one taxonomy join is honored by
// not building one (the tab shows no completion status).
//
// THE ESCAPEE SET IS CONFIRMED FROM THE INDEX, NOT BY THE SHIPPED ROW PASS. The
// requirement is the RESULT Life Lists and Species Detail get from
// `confirmPublishedNames` (a published name is honored only when every
// countable-form row carrying it sits on a consulted checklist); the shipped
// function walks every observation row, and the store replaces its snapshot on
// every merged checklist while a Statistics pass runs, which NFR-05 forbids on
// this tab. `confirmEscapeesIndexed` walks only the published names' own
// carrier rows through the index's species grouping, and
// `hotspotReportsProvenance.test.ts` proves it equal to the shipped function,
// restricted to names the backup holds, over a generated corpus whose first rows
// are the failure returns.
//
// DECLARED SCAN H9 (schema 12.1): per published name one `Map.get`, then one
// `Set.has` per carrier row with an early exit. At most the published names'
// rows; the published list is capped by its store (2,048 names).

import { useEffect, useMemo, useSyncExternalStore } from 'react'
import type { ObservationEntry } from '../types'
import { getSnapshot, loadSnapshot, subscribe } from './exoticProvenanceCache'
import type { LocationIndex } from './hotspotReports'

const EMPTY: ReadonlySet<string> = new Set<string>()

/**
 * The published escapee-only names this backup holds whose every carrier (every
 * countable-form row of the name, located or not, dated or not, with or
 * without a Submission ID) is on a consulted checklist. A published name the
 * backup does not hold is left out. `obs` is the array the index was built from.
 */
export function confirmEscapeesIndexed(
  published: readonly string[], consulted: ReadonlySet<string>,
  index: LocationIndex, obs: readonly ObservationEntry[],
): ReadonlySet<string> {
  if (published.length === 0) return EMPTY
  const out = new Set<string>()
  for (const name of published) {
    const s = index.speciesOrd.get(name)
    if (s === undefined) continue
    let open = false
    for (let k = index.spStart[s]; k < index.spStart[s + 1]; k++) {
      if (!consulted.has(obs[index.spRows[k]].submissionId)) { open = true; break }
    }
    if (!open) out.add(name)
  }
  return out
}

/**
 * The confirmed escapee set for the tab, read passively. The returned Set keeps
 * its IDENTITY across every snapshot that does not change the confirmed names
 * (a string key compares by value, with no ref), so every memo downstream stays
 * put while a Statistics pass merges checklist after checklist.
 */
export function useHotspotReportsEscapees(index: LocationIndex | null, obs: readonly ObservationEntry[]): ReadonlySet<string> {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
  useEffect(() => { void loadSnapshot() }, [])
  const confirmed = useMemo(
    () => (index === null ? EMPTY : confirmEscapeesIndexed(snapshot.excludedNames, snapshot.checklists, index, obs)),
    [snapshot, index, obs],
  )
  const key = useMemo(() => JSON.stringify([...confirmed].sort()), [confirmed])
  return useMemo(() => new Set<string>(JSON.parse(key) as string[]), [key])
}
