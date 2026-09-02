// The "a data file changed" signal (icloud-sync FR-35), mirroring the epoch +
// subscribers shape of hotspotSet.ts. Entry-safe and dependency-free: it rides
// the App.tsx entry chunk (entryChunk.test.ts asserts it is on the graph).
//
// Before this module the only signal was App.tsx's `filesVersion` state,
// bumped by `handleFilesSaved` after a Settings upload and threaded as a prop
// to the tabs that hold a parsed file. That prop still exists: App derives it
// from this epoch (useFilesEpoch), so every prop-threaded tab keeps working
// unchanged, and the three tabs that loaded on mount only (Statistics, Map
// Explorer, List Comparer) subscribe here directly. A synced arrival or a
// synced clear calls notifyFilesChanged() from the iCloud controller after
// the same cache invalidations a manual upload runs, so every tab re-enters
// its loading phase without a relaunch.

let _epoch = 0
const _subscribers = new Set<() => void>()

/** Current epoch, the useSyncExternalStore snapshot for useFilesEpoch. */
export function getFilesEpoch(): number {
  return _epoch
}

/** Subscribe to file changes; returns an unsubscribe. */
export function subscribeFilesChanged(cb: () => void): () => void {
  _subscribers.add(cb)
  return () => { _subscribers.delete(cb) }
}

/** Announce that a stored data file was saved, replaced, or cleared. */
export function notifyFilesChanged(): void {
  _epoch++
  for (const cb of _subscribers) cb()
}
