// The pending widget-link store (ios-lifer-widgets, schema.md section 4.4).
// Entry-safe and dependency-free: App.tsx subscribes to it statically and the
// dynamic-imported link controller writes to it. Only a PARSED link ever lands
// here (the controller runs every raw URL through `parseWidgetLink` first), so
// nothing in this store came from outside the fifteen-entry allowlist.
//
// Last one wins: a second link replaces the first, so several taps before the
// Map Explorer mounts apply only the latest (FR-37). Each link carries a
// monotone id, so a consumer can tell a new request from one it already
// applied, and a second tap with the same values is a NEW id that re-runs the
// search. The consumer clears by id, so a clear for an older id never removes
// a newer link that arrived in between.

import type { WidgetLink } from './deepLink'

export type PendingLink = WidgetLink & { id: number }

let _pending: PendingLink | null = null
let _nextId = 1
const _subscribers = new Set<() => void>()

function emit(): void {
  for (const cb of _subscribers) cb()
}

/** Replace any pending link with this one. */
export function setPendingLink(link: WidgetLink): void {
  _pending = { ...link, id: _nextId++ }
  emit()
}

/** The pending link, or null. Stable identity until the next set or clear
 *  (a useSyncExternalStore snapshot). */
export function getPendingLink(): PendingLink | null {
  return _pending
}

/** Subscribe to changes; returns an unsubscribe. */
export function subscribePendingLink(cb: () => void): () => void {
  _subscribers.add(cb)
  return () => { _subscribers.delete(cb) }
}

/** Clear the pending link, but only if it is still the one with this id. */
export function clearPendingLink(id: number): void {
  if (_pending === null || _pending.id !== id) return
  _pending = null
  emit()
}

/** Test seam: forget any pending link and restart the id counter. */
export function _resetPendingLinkForTests(): void {
  _pending = null
  _nextId = 1
  _subscribers.clear()
}
