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
// the default selection is a strict superset of every other, builds locally, and
// issues no request. So the snapshot is the DEFAULT from the very first render,
// never null, never a spinner, and the feature is fully usable before (and even
// if) the stored read resolves.
//
// This module MUST stay map-free — Settings.tsx is on App.tsx's static import
// graph. See the header of lib/shareLocation.ts.

import { useSyncExternalStore } from 'react'
import { storage } from './storage'
import { SHARE_PARTS } from './shareLocation'
import type { ShareCopySelection, SharePartKey } from './shareLocation'

export type { ShareCopySelection, SharePartKey } from './shareLocation'

/** Storage-seam key. UNCHANGED across the v0.5.80 → three-switch widening: the
 *  value's shape changed, its name did not, so there is one key to migrate from
 *  rather than two keys to keep in sync. The web/Pi kv store persists any JSON
 *  value verbatim and TauriStorage writes JSON, so no transport change was
 *  needed for the object. */
export const SHARE_COPY_SETTING_KEY = 'shareCopyMode'

/** FR-32. Everything on is the default: it is a strict superset of every other
 *  combination, has no network or privacy cost, and matches the stated use
 *  (sharing by text). Frozen because it is also the identity a failed read falls
 *  back to, and useSyncExternalStore requires a STABLE snapshot reference. */
export const DEFAULT_SHARE_COPY_SELECTION: ShareCopySelection = Object.freeze({
  coords: true, google: true, apple: true,
})

/** The two v0.5.80 literals. Branching on BOTH explicitly is the whole migration:
 *  falling through 'coords-only' to the default would silently hand links back to
 *  someone who had deliberately turned them off, which is the one defect this
 *  change could plausibly ship. Each literal has its own unit test. */
const LEGACY: Readonly<Record<string, ShareCopySelection>> = Object.freeze({
  'coords-only': Object.freeze({ coords: true, google: false, apple: false }),
  'coords-and-links': DEFAULT_SHARE_COPY_SELECTION,
})

/** Value equality — the store holds an OBJECT now, so identity comparison would
 *  report every hydrate as a change and emit a pointless render. */
export function shareSelectionsEqual(a: ShareCopySelection, b: ShareCopySelection): boolean {
  return SHARE_PARTS.every(p => a[p.key] === b[p.key])
}

/**
 * FR-35 — absent, unrecognised, or malformed reads as the default with no error.
 *
 * Three branches, in order:
 *  - a v0.5.80 literal maps to the selection it meant (the migration);
 *  - an object is read PER KEY, a non-boolean field falling back to that key's
 *    default. Per key rather than all-or-nothing so a partially written object
 *    keeps the parts it did record, and so all-false round-trips: every switch
 *    off is a legitimate stored state, not a malformed one;
 *  - anything else is the default, which is today's superset, so a failed read
 *    never silently removes something the person was copying.
 */
export function normalizeShareCopySelection(raw: unknown): ShareCopySelection {
  if (typeof raw === 'string') {
    // Object.hasOwn, NOT a bare `LEGACY[raw]`. LEGACY is an ordinary object
    // literal, so a bare index inherits Object.prototype: the eight strings
    // 'constructor', '__proto__', 'toString', 'valueOf', 'hasOwnProperty',
    // 'isPrototypeOf', 'toLocaleString' and 'propertyIsEnumerable' all return a
    // TRUTHY inherited member, take the legacy arm, and spread to {} — every
    // switch off, rather than the default FR-35 promises. It failed closed
    // (all-off is the privacy-safe direction) and polluted nothing, but the
    // behaviour and the contract disagreed. This makes the lookup allowlist
    // driven, the same property that already makes the object branch below
    // inert. shareCopyPreference.test.ts carries those strings in its
    // malformed-input corpus.
    return Object.hasOwn(LEGACY, raw)
      ? { ...LEGACY[raw] }
      : { ...DEFAULT_SHARE_COPY_SELECTION }
  }
  if (raw !== null && typeof raw === 'object' && !Array.isArray(raw)) {
    const src = raw as Record<string, unknown>
    const out = {} as ShareCopySelection
    for (const p of SHARE_PARTS) {
      const v = src[p.key]
      out[p.key] = typeof v === 'boolean' ? v : DEFAULT_SHARE_COPY_SELECTION[p.key]
    }
    return out
  }
  return { ...DEFAULT_SHARE_COPY_SELECTION }
}

let current: ShareCopySelection = DEFAULT_SHARE_COPY_SELECTION
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
      const next = normalizeShareCopySelection(raw)
      if (!shareSelectionsEqual(next, current)) { current = next; emit() }
    })
    .catch(() => { /* FR-34: a failed read leaves the default in place */ })
}

function subscribe(onStoreChange: () => void): () => void {
  listeners.add(onStoreChange)
  hydrateOnce()
  return () => { listeners.delete(onStoreChange) }
}

/** Stable module value — required by useSyncExternalStore and render-pure. It
 *  MUST return the same object reference until the selection actually changes;
 *  building a fresh object per call would loop React forever. */
function getSnapshot(): ShareCopySelection {
  return current
}

function getServerSnapshot(): ShareCopySelection {
  return DEFAULT_SHARE_COPY_SELECTION
}

/** The selection in effect right now. Re-renders every subscriber on a change, so
 *  a popup that is already open relabels itself and its next press copies the new
 *  selection (FR-29 / FR-36). */
export function useShareCopySelection(): ShareCopySelection {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}

/** Apply immediately app-wide, then persist through the storage seam (FR-33).
 *  Never localStorage, never a component-local persistence path. A failed write
 *  leaves the in-session choice applied rather than surfacing an error. */
export function setShareCopySelection(next: ShareCopySelection): void {
  userChose = true
  if (!shareSelectionsEqual(next, current)) { current = { ...next }; emit() }
  void storage.setSetting(SHARE_COPY_SETTING_KEY, { ...next }).catch(() => {})
}

/** Flip one part, leaving the others alone. The Settings row's only mutation.
 *  Returns the resulting selection so the caller can describe what just happened
 *  without recomputing the flip against its own rendered copy — two expressions
 *  of one toggle is exactly how an announcement drifts from the thing announced. */
export function toggleShareCopyPart(key: SharePartKey): ShareCopySelection {
  const next: ShareCopySelection = { ...current, [key]: !current[key] }
  setShareCopySelection(next)
  return next
}
