// The "the Default Location changed" signal (ios-lifer-widgets, schema.md
// section 1.4), the keysChanged.ts shape: entry-safe and dependency-free,
// riding the App.tsx entry chunk (entryChunk.test.ts asserts it is on the
// graph).
//
// Why a third epoch module rather than a direct call from Settings into the
// widget code: the `map-defaults` document (data/settings.json) gained an
// off-tab reader with this feature -- the iOS widget hand-over, which carries
// the Default Location's coordinates to the home-screen widgets -- and
// CLAUDE.md's rule for a stored document with an off-tab reader is its own
// epoch module of this shape, bumped at every write site, so the writer never
// imports the reader. Settings bumps it after the save resolves and after the
// clear settles; Map Explorer keeps reading the setting on mount only, which
// this feature does not change.

let _epoch = 0
const _subscribers = new Set<() => void>()

/** Current epoch (a useSyncExternalStore snapshot, should a reader want one). */
export function getMapDefaultsEpoch(): number {
  return _epoch
}

/** Subscribe to Default Location changes; returns an unsubscribe. */
export function subscribeMapDefaultsChanged(cb: () => void): () => void {
  _subscribers.add(cb)
  return () => { _subscribers.delete(cb) }
}

/** Announce that the saved Default Location was saved or cleared. */
export function notifyMapDefaultsChanged(): void {
  _epoch++
  for (const cb of _subscribers) cb()
}
