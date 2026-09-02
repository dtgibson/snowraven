// The "an API key changed" signal (icloud-api-key-sync FR-23/FR-24), the
// filesChanged.ts shape: entry-safe and dependency-free, riding the App.tsx
// entry chunk (entryChunk.test.ts asserts it is on the graph).
//
// Before this module the only signal was App.tsx's `keysVersion` state,
// bumped inside `fetchKeyStatus` after a Settings save and threaded as a prop
// to the Map Explorer. That prop still exists: App derives it from this epoch
// (useKeysEpoch), so the prop-threaded consumer keeps working unchanged, and
// the readers that loaded on mount only (App's missing-key notices, the
// Settings rows, the Statistics tab's hasEbirdKey) subscribe here. A synced
// key arrival or a synced clear calls notifyKeysChanged() from the iCloud
// controller after the same cache invalidations a manual save runs, so every
// networked feature sees the new key without a relaunch. A key epoch never
// triggers a file reload and a file epoch never triggers a key re-read.

let _epoch = 0
const _subscribers = new Set<() => void>()

/** Current epoch, the useSyncExternalStore snapshot for useKeysEpoch. */
export function getKeysEpoch(): number {
  return _epoch
}

/** Subscribe to key changes; returns an unsubscribe. */
export function subscribeKeysChanged(cb: () => void): () => void {
  _subscribers.add(cb)
  return () => { _subscribers.delete(cb) }
}

/** Announce that a stored API key was saved, replaced, or cleared. */
export function notifyKeysChanged(): void {
  _epoch++
  for (const cb of _subscribers) cb()
}
