// The "a county's eBird bar-chart file changed" signal (targets-tab, schema.md
// section 1.4), the fourth module of the `filesChanged.ts` shape after
// `keysChanged.ts` and `mapDefaultsChanged.ts`. Entry-safe and dependency-free:
// the Targets panel's epoch hook reads it, so `entryChunk.test.ts` asserts it
// is on App's static graph and that it drags nothing with it.
//
// WHY A DEDICATED MODULE RATHER THAN `notifyFilesChanged()`. The shared files
// epoch has three readers that have nothing to do with a bar-chart file: the
// iCloud controller runs a CloudKit check on every bump that is not
// self-notified, the iOS widget hand-over regenerates its App Group document,
// and every tab keyed on `useFilesEpoch()` re-runs its stored-file load. A
// bar-chart file is none of their business (it is never synced and no widget
// reads it), so bumping the shared epoch would spend a network check and a
// document rewrite on every add, replace or remove. CLAUDE.md's standing rule
// (v1.0.12) is that a stored document with a reader outside the handler that
// wrote it gets its OWN epoch module of this shape.
//
// Bumped exactly once per SUCCESSFUL add, replace or remove, by the import tail
// in `lib/barChart/barChartImport.ts`. A refused import bumps nothing (FR-27).

let _epoch = 0
const _subscribers = new Set<() => void>()

/** Current epoch, the useSyncExternalStore snapshot for useBarChartFilesEpoch. */
export function getBarChartFilesEpoch(): number {
  return _epoch
}

/** Subscribe to bar-chart file changes; returns an unsubscribe. */
export function subscribeBarChartFilesChanged(cb: () => void): () => void {
  _subscribers.add(cb)
  return () => { _subscribers.delete(cb) }
}

/** Announce that a county's bar-chart file was added, replaced or removed. */
export function notifyBarChartFilesChanged(): void {
  _epoch++
  for (const cb of _subscribers) cb()
}
