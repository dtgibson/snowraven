// Pin Share — the "what gets copied" preference (FR-31 to FR-37).
//
// A module-level store read through useSyncExternalStore, this repo's blessed
// external-store pattern (lib/useIsPhone.ts). The per-component
// `useState` + hydrate-effect shape used by DateFormatRow is the right HYDRATION
// model but cannot propagate a change sideways, and FR-36 requires a change in
// Settings to reach a share popup that is ALREADY OPEN on a map tab — a separate
// component subtree. One module value plus a listener set does both.
//
// Explicitly NOT the useEmbeddedMediaPreference hydration-gating pattern (FR-34).
// That hook holds `null` during hydration and derives `embedAllowed === false`
// from it because a pre-hydration flash there would fire a third-party iframe
// request the user opted out of. Pin Share has no unsafe pre-hydration state:
// the default mode is a strict superset of the other, builds locally, and issues
// no request. So the snapshot is the DEFAULT from the very first render, never
// null, never a spinner, and the feature is fully usable before (and even if)
// the stored read resolves.
//
// This module MUST stay map-free — Settings.tsx is on App.tsx's static import
// graph. See the header of lib/shareLocation.ts.

import { useSyncExternalStore } from 'react'
import { storage } from './storage'
import type { ShareCopyMode } from './shareLocation'

export type { ShareCopyMode } from './shareLocation'

/** Storage-seam key. camelCase, matching 'dateFormat' / 'disableEmbeddedMedia'. */
export const SHARE_COPY_SETTING_KEY = 'shareCopyMode'

/** FR-32. The richer mode is the default: it is a strict superset of the other,
 *  has no network or privacy cost, and matches the stated use (sharing by text). */
export const DEFAULT_SHARE_COPY_MODE: ShareCopyMode = 'coords-and-links'

/** FR-35 — absent, unrecognised, or malformed reads as the default with no error.
 *  Only the exact literal wins, the same shape as normalizeDisableEmbeddedMedia. */
export function normalizeShareCopyMode(raw: unknown): ShareCopyMode {
  return raw === 'coords-only' ? 'coords-only' : DEFAULT_SHARE_COPY_MODE
}

let current: ShareCopyMode = DEFAULT_SHARE_COPY_MODE
let hydrateStarted = false
// A user choice made while the stored read is still in flight must win over the
// value that read returns; otherwise a fast click is silently reverted.
let userChose = false
const listeners = new Set<() => void>()

function emit(): void {
  for (const fn of listeners) fn()
}

/** Once per session, not once per subscriber — five maps plus Settings can
 *  subscribe simultaneously. Runs inside `subscribe`, which React calls from a
 *  passive effect, so no impure work happens during render (NFR-11). */
function hydrateOnce(): void {
  if (hydrateStarted) return
  hydrateStarted = true
  void storage.getSetting<unknown>(SHARE_COPY_SETTING_KEY)
    .then(raw => {
      if (userChose) return
      const next = normalizeShareCopyMode(raw)
      if (next !== current) { current = next; emit() }
    })
    .catch(() => { /* FR-34: a failed read leaves the default in place */ })
}

function subscribe(onStoreChange: () => void): () => void {
  listeners.add(onStoreChange)
  hydrateOnce()
  return () => { listeners.delete(onStoreChange) }
}

/** Stable module value — required by useSyncExternalStore and render-pure. */
function getSnapshot(): ShareCopyMode {
  return current
}

function getServerSnapshot(): ShareCopyMode {
  return DEFAULT_SHARE_COPY_MODE
}

/** The mode in effect right now. Re-renders every subscriber on a change, so a
 *  popup that is already open relabels itself and its next press copies the new
 *  mode (FR-29 / FR-36). */
export function useShareCopyMode(): ShareCopyMode {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}

/** Apply immediately app-wide, then persist through the storage seam (FR-33).
 *  Never localStorage, never a component-local persistence path. A failed write
 *  leaves the in-session choice applied rather than surfacing an error. */
export function setShareCopyMode(next: ShareCopyMode): void {
  userChose = true
  if (next !== current) { current = next; emit() }
  void storage.setSetting(SHARE_COPY_SETTING_KEY, next).catch(() => {})
}
