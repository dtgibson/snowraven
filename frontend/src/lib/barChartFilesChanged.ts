// The "a county's eBird bar-chart file changed" signal (targets-tab, schema.md
// section 1.4), the fourth module of the `filesChanged.ts` shape after
// `keysChanged.ts` and `mapDefaultsChanged.ts`. Entry-safe and dependency-free:
// the Targets panel's epoch hook reads it, so `entryChunk.test.ts` asserts it
// is on App's static graph and that it drags nothing with it.
//
// WHY A DEDICATED MODULE RATHER THAN `notifyFilesChanged()`. The shared files
// epoch has readers that have nothing to do with a bar-chart file: the iOS
// widget hand-over regenerates its App Group document and every tab keyed on
// `useFilesEpoch()` re-runs its stored-file load, and no widget or data-file
// tab reads a county file. So a county file gets its OWN epoch (CLAUDE.md's
// standing rule, v1.0.12: a stored document with a reader outside the handler
// that wrote it gets its own epoch module of this shape).
//
// icloud-bar-chart-sync: on macOS and iOS the file IS synced (as per-county
// items, lib/icloud/countySync.ts), so the iCloud controller is a reader of
// THIS epoch: a bump it did not make (a user add, replace or remove) runs a
// check, and its own bumps (a synced arrival, replacement or removal) are
// self-notified so they trigger none. It still never bumps `filesChanged`.
//
// Bumped exactly once per SUCCESSFUL add, replace, remove or clear-all, by the
// import tail in `lib/barChart/barChartImport.ts`, and once per synced change
// by the iCloud controller. A refused import bumps nothing (FR-27).

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
