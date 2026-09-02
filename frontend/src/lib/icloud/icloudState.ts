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
}

export function installICloudActions(actions: ICloudActions | null): void {
  installed = actions ?? NOOP_ACTIONS
}
