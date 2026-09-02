// The iCloud Sync state store (icloud-sync; schema.md "Frontend modules and
// seams"). Pure and ENTRY-SAFE: no Tauri import, no native import, nothing
// async. Settings.tsx reads it through useICloudState() and calls
// `icloudActions.*`; the controller (icloudSync.ts, dynamic-imported after
// first paint, and only on macOS/iOS) fills the state and installs the real
// actions. Before the controller loads, `availability` is 'unknown' and every
// action is a no-op, so the rows render today's copy. entryChunk.test.ts
// asserts this file IS on the entry graph and the controller is NOT.

import { useSyncExternalStore } from 'react'
import type { OriginPlatform, Slot } from './icloudRecord'
import { KEY_SLOTS, type KeySlot } from './keyRecord'

export type Availability =
  | 'unknown'
  | 'available'
  | 'not-signed-in'
  | 'drive-off-or-unauthorized'
  | 'build-cannot-use-icloud'

/** The eight FR-24 row states, plus nothing else. */
export type SlotState =
  | 'up-to-date'
  | 'uploading'
  | 'downloading'
  | 'in-icloud-not-downloaded'
  | 'waiting-to-upload'
  | 'unavailable'
  | 'off'
  | 'error'

export interface SlotView {
  state: SlotState
  fromThisDevice: boolean
  origin?: { label: string; platform: OriginPlatform }
  /** the SHARED file's upload time (downloading / not-downloaded states) */
  uploadedAt?: string
  /** FR-25: set while the row should say "Replaced by the file from ..." */
  replacedAt?: string
  /** one-sentence reason for the 'error' state */
  reason?: string
}

/** The five key-row states (icloud-api-key-sync FR-39) plus Sync off (FR-40); nothing else. */
export type KeySlotState = 'up-to-date' | 'syncing' | 'waiting-to-upload' | 'unavailable' | 'off' | 'error'

export interface KeySlotView {
  state: KeySlotState
  fromThisDevice: boolean
  origin?: { label: string; platform: OriginPlatform }
  /** FR-38 provenance time, from the local meta */
  changedAt?: string
  /** FR-41: "Replaced by the key from <origin>, changed <replacedAt>" while set */
  replacedAt?: string
  /** FR-42: the row holds no key; "Cleared from <origin>, <clearedAt>" while set */
  clearedAt?: string
  /** FR-30: "This clear has not reached iCloud yet." */
  clearPending?: boolean
  /** one sentence for 'error'; from the closed reason table, never a value */
  reason?: string
}

export interface ICloudState {
  availability: Availability
  syncEnabled: boolean
  deviceId: string | null
  deviceLabel: string
  platform: OriginPlatform | null
  lastCheckAt: string | null
  /** a check is in flight (any trigger) */
  checking: boolean
  /** the last check could not reach iCloud (FR-05: the visible suffix) */
  checkFailed: boolean
  slots: Record<Slot, SlotView | null>
  /** at least one shared FILE record exists in iCloud (FR-33) */
  sharedExists: boolean
  /** the filenames of the shared files present, for the Remove confirmation */
  sharedFilenames: string[]

  // ── icloud-api-key-sync ──
  /** the effective key switch (persisted keysEnabled && enabled) */
  keySyncEnabled: boolean
  /** the key switch has been on on this device at least once (FR-40) */
  keySyncEverOn: boolean
  /** iCloud is known to hold keys.record.json (FR-34: show "Remove synced keys from iCloud") */
  keyRecordExists: boolean
  /** a switch-off or Remove that could not reach iCloud; the retry is armed (FR-33) */
  keyRemovalPending: boolean
  /** per key row; null = no sync line on that row */
  keySlots: Record<KeySlot, KeySlotView | null>
}

export interface CheckOutcome {
  /** iCloud was reached and the check completed */
  ok: boolean
  /** something was pushed, pulled, or removed locally */
  transferred: boolean
  /** the lastCheckAt after the check (unchanged on failure) */
  at: string | null
}

export interface ICloudActions {
  enable(): Promise<void>
  disable(): Promise<void>
  checkNow(): Promise<CheckOutcome>
  downloadNow(slot: Slot): Promise<void>
  retry(slot: Slot): Promise<void>
  removeFromICloud(): Promise<void>
  clearWithSync(slot: Slot): Promise<void>
  /** Settings saved a file locally with sync on: show "Syncing, uploading" and check. */
  fileSaved(slot: Slot): void

  // ── icloud-api-key-sync ──
  /** after the note's Turn on (FR-04) */
  enableKeys(): Promise<void>
  /** FR-32: no confirmation; local keys stay; the copy in iCloud is removed */
  disableKeys(): Promise<void>
  /** FR-34 */
  removeKeysFromICloud(): Promise<void>
  /** FR-28, after the confirmation */
  clearKeyWithSync(slot: KeySlot): Promise<void>
  /** the key row's Retry */
  retryKey(slot: KeySlot): Promise<void>
  /** Settings saved a key locally with the key switch on: row "Syncing", check. */
  keySaved(slot: KeySlot): void
}

function emptyKeySlots(): Record<KeySlot, KeySlotView | null> {
  const out = {} as Record<KeySlot, KeySlotView | null>
  for (const slot of KEY_SLOTS) out[slot] = null
  return out
}

const INITIAL: ICloudState = {
  availability: 'unknown',
  syncEnabled: false,
  deviceId: null,
  deviceLabel: '',
  platform: null,
  lastCheckAt: null,
  checking: false,
  checkFailed: false,
  slots: { ebird: null, ml: null },
  sharedExists: false,
  sharedFilenames: [],
  keySyncEnabled: false,
  keySyncEverOn: false,
  keyRecordExists: false,
  keyRemovalPending: false,
  keySlots: emptyKeySlots(),
}

let state: ICloudState = INITIAL
const subscribers = new Set<() => void>()

export function getICloudState(): ICloudState {
  return state
}

export function subscribeICloudState(cb: () => void): () => void {
  subscribers.add(cb)
  return () => { subscribers.delete(cb) }
}

/** Replace part of the state; the object identity changes so subscribers re-render. */
export function setICloudState(patch: Partial<ICloudState>): void {
  state = { ...state, ...patch }
  for (const cb of subscribers) cb()
}

/** Replace one slot's view (null = no sync line on that row). */
export function setSlotView(slot: Slot, view: SlotView | null): void {
  setICloudState({ slots: { ...state.slots, [slot]: view } })
}

/** Replace one key row's view (null = no sync line on that row). */
export function setKeySlotView(slot: KeySlot, view: KeySlotView | null): void {
  setICloudState({ keySlots: { ...state.keySlots, [slot]: view } })
}

/** Test helper: back to the pre-controller state. */
export function resetICloudState(): void {
  state = INITIAL
  for (const cb of subscribers) cb()
}

export function useICloudState(): ICloudState {
  return useSyncExternalStore(subscribeICloudState, getICloudState, getICloudState)
}

const NOOP_ACTIONS: ICloudActions = {
  enable: async () => {},
  disable: async () => {},
  checkNow: async () => ({ ok: false, transferred: false, at: null }),
  downloadNow: async () => {},
  retry: async () => {},
  removeFromICloud: async () => {},
  clearWithSync: async () => {},
  fileSaved: () => {},
  enableKeys: async () => {},
  disableKeys: async () => {},
  removeKeysFromICloud: async () => {},
  clearKeyWithSync: async () => {},
  retryKey: async () => {},
  keySaved: () => {},
}

/**
 * The actions slot. A stable object whose methods delegate to whatever the
 * controller installed, so a component can hold a reference to it before the
 * controller has loaded.
 */
let installed: ICloudActions = NOOP_ACTIONS

export const icloudActions: ICloudActions = {
  enable: () => installed.enable(),
  disable: () => installed.disable(),
  checkNow: () => installed.checkNow(),
  downloadNow: (slot) => installed.downloadNow(slot),
  retry: (slot) => installed.retry(slot),
  removeFromICloud: () => installed.removeFromICloud(),
  clearWithSync: (slot) => installed.clearWithSync(slot),
  fileSaved: (slot) => installed.fileSaved(slot),
  enableKeys: () => installed.enableKeys(),
  disableKeys: () => installed.disableKeys(),
  removeKeysFromICloud: () => installed.removeKeysFromICloud(),
  clearKeyWithSync: (slot) => installed.clearKeyWithSync(slot),
  retryKey: (slot) => installed.retryKey(slot),
  keySaved: (slot) => installed.keySaved(slot),
}

export function installICloudActions(actions: ICloudActions | null): void {
  installed = actions ?? NOOP_ACTIONS
}
