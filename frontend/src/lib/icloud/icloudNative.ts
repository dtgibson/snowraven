// Typed wrappers over the seven native commands and two events in
// src-tauri/src/icloud.rs (icloud-sync; schema.md "Native layer"). This file
// is NEVER on the entry graph: it imports @tauri-apps/api statically and is
// reached only through the dynamic-imported controller (entryChunk.test.ts).
// Every rejection is mapped onto the closed ICloudError union.

import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import type { Slot } from './icloudRecord'
import {
  toICloudError,
  type ICloudNativeLayer,
  type NativePushResult,
  type NativeRecordRead,
  type NativeStatus,
} from './icloudNativeTypes'

/** Pinned to `ICLOUD_CONTAINER_ID` in icloud.rs by icloudPaths.parity.test.ts. */
export const ICLOUD_CONTAINER_ID = 'iCloud.com.dtgibson.snowraven'

/** The csv names in the container (and the local data dir); pinned likewise. */
export const ICLOUD_CSV_FILES: Record<Slot, string> = {
  ebird: 'ebird-backup.csv',
  ml: 'ml-export.csv',
}

export const ICLOUD_CHANGED_EVENT = 'icloud-changed'
export const ICLOUD_IDENTITY_EVENT = 'icloud-identity-changed'

async function call<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  try {
    return await invoke<T>(cmd, args)
  } catch (raw) {
    throw toICloudError(raw)
  }
}

export const icloudNative: ICloudNativeLayer = {
  status: () => call<NativeStatus>('icloud_status'),
  readRecord: (slot) => call<NativeRecordRead>('icloud_read_record', { slot }),
  push: (slot, filename, uploadedAt, origin) =>
    call<NativePushResult>('icloud_push', { slot, filename, uploadedAt, origin }),
  pushCleared: (slot, clearedAt, origin) => call<void>('icloud_push_cleared', { slot, clearedAt, origin }),
  pull: (slot, expectedSha256, expectedByteLength) =>
    call<void>('icloud_pull', { slot, expectedSha256, expectedByteLength }),
  startDownload: (slot) => call<void>('icloud_start_download', { slot }),
  removeAll: () => call<{ removed: number }>('icloud_remove_all'),
  watch: (enabled) => call<void>('icloud_watch', { enabled }),
  onChanged: (cb) => listen(ICLOUD_CHANGED_EVENT, () => cb()),
  onIdentityChanged: (cb) => listen(ICLOUD_IDENTITY_EVENT, () => cb()),
}
