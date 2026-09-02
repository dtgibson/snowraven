// The ONE clear-path teardown for everything durable that was derived from a
// stored data file (clear-means-clear).
//
// THE PROBLEM IT EXISTS TO SOLVE. Clearing the eBird backup deleted the CSV and
// dropped two in-memory caches, and left on disk: `exotic-provenance-v1` (the
// user's own checklist submission ids, species codes, and escapee common names
// carried verbatim from their export), `checklist-projects-v1` (submission ids
// as document keys), the `/weather/S…` and `/tide/S…` entries in `replay.json`,
// and `county-completeness-v1`, whose payloads are eBird's public data but
// whose KEY SET is the list of counties the user has birded. None of the four
// stores exported a purge, and there were THREE clear paths, each of which
// would have had to remember all four. Hence one function they cannot drift
// apart on.
//
// ── CLEAR ONLY. NEVER REPLACE. ───────────────────────────────────────────────
// This is the hard boundary of the whole change, and it is why this module is
// not simply folded into the iCloud controller's existing `deps.invalidate`:
// that callback is wired to the synced ARRIVAL as well, which is a replace.
//
//   REPLACE (an upload, or a newer file arriving from another device) must
//   purge NOTHING. `PRIVACY_POLICY.md` publishes that loading a newer export
//   "asks only about checklists that have not been answered yet", and the
//   projects store's 365-day incremental premise depends on it: purging there
//   would falsify a published statement and force a full re-sweep on every
//   upload.
//
//   CLEAR (the user pressing Clear, on any of the three paths) purges all four.
//
// The distinction is structural rather than remembered: `purgeDerivedOnClear`
// is the only exported entry point, its name says which side it belongs to, and
// the controller takes it as `deps.purgeDerived` — a dependency SEPARATE from
// `deps.invalidate`, so the replace path physically cannot reach it.
//
// ── ENTRY-CHUNK DISCIPLINE ───────────────────────────────────────────────────
// `Settings.tsx` is on App.tsx's static import graph, and
// `lib/countyCompletenessCache.ts` must stay OFF the entry chunk
// (`entryChunk.test.ts`). So this module reaches every store through `import()`
// and carries no static imports of its own: it is entry-safe, callers import it
// plainly, and no store rides first paint because of it.

/** The two stored data files a Clear can act on. */
export type FileSlot = 'ebird' | 'ml'

/**
 * THE REGISTRY. One row per durable store keyed on the content of a stored data
 * file, naming the slot whose Clear tears it down.
 *
 * This table IS the convention: a new durable store keyed on the user's own
 * uploaded data adds its row here in the same change that adds the store, so
 * the next such store is wired up by convention rather than by whoever
 * remembers three call sites. `cacheInventory.test.ts` holds the pairing —
 * a store that exports a purge no row calls, or a row naming a purge no store
 * exports, fails there.
 *
 * NOTHING IS REGISTERED FOR 'ml'. The Macaulay Library export has no durable
 * store keyed to it: nothing persisted is keyed by an ML asset id, and the ML
 * caches are session-scoped in memory. The slot stays in the type, and the
 * dispatch stays slot-driven, so the first ML-derived store is a one-line
 * addition rather than a rewrite.
 */
const TEARDOWNS: ReadonlyArray<{
  readonly slot: FileSlot
  readonly store: string
  readonly purge: () => Promise<void>
}> = [
  {
    slot: 'ebird',
    store: 'exotic-provenance-v1',
    purge: async () => (await import('./exoticProvenanceCache')).purgeProvenanceStore(),
  },
  {
    slot: 'ebird',
    store: 'checklist-projects-v1',
    purge: async () => (await import('./checklistProjectsCache')).purgeProjectsStore(),
  },
  {
    slot: 'ebird',
    store: 'county-completeness-v1',
    purge: async () => (await import('./countyCompletenessCache')).purgeCountyCompletenessStore(),
  },
  {
    slot: 'ebird',
    store: 'replay.json (checklist-keyed entries)',
    purge: async () => (await import('./replayStore')).purgeChecklistReplay(),
  },
]

/** The registered store names for a slot. Exported for the inventory guard. */
export function registeredTeardowns(slot: FileSlot): readonly string[] {
  return TEARDOWNS.filter(t => t.slot === slot).map(t => t.store)
}

/**
 * Purge everything derived from the file in `slot`, because the user CLEARED
 * it. Awaited by every clear path, so a caller that resolves has clean
 * documents on disk rather than scheduled intentions.
 *
 * RETURNS THE STORES THAT FAILED, and it is the caller's job to say so. It
 * still does not reject, and every store is still attempted: one store's failed
 * write must not abandon the other three, and the file itself is already gone
 * by the time this runs, so throwing would mislabel a mostly-successful clear
 * as a failed delete. But an empty resolve used to be indistinguishable from a
 * clean sweep, which made a half-failed Clear report itself as a completed one
 * — the exact class of thing this whole change exists to stop. The names are
 * the store ids from the registry above.
 *
 * Each store's mirror is emptied before its write is attempted, so a failed
 * write still leaves the session showing nothing stale, and the next Clear of
 * that slot re-attempts the document.
 */
export async function purgeDerivedOnClear(slot: FileSlot): Promise<readonly string[]> {
  const rows = TEARDOWNS.filter(t => t.slot === slot)
  const results = await Promise.allSettled(rows.map(t => t.purge()))
  return results.flatMap((r, i) => (r.status === 'rejected' ? [rows[i].store] : []))
}
