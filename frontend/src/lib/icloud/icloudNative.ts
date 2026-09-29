// Typed wrappers over the native commands and two events in
// src-tauri/src/icloud.rs (icloud-sync; schema.md "Native layer"). This file
// is NEVER on the entry graph: it imports @tauri-apps/api statically and is
// reached only through the dynamic-imported controller (entryChunk.test.ts).
// Every rejection is mapped onto the closed ICloudError union.

import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { DEVICE_ID_RE, type Slot } from './icloudRecord'
import { isRegionCode } from '../regionCode'
import {
  ICloudNativeError,
  toICloudError,
  type ICloudNativeLayer,
  type ItemKind,
  type NativeItemPushResult,
  type NativeKeysRead,
  type NativeKeysWriteResult,
  type NativeListResult,
  type NativePushResult,
  type NativeRecordRead,
  type NativeStatus,
  type SyncItemRef,
} from './icloudNativeTypes'

/** The key record's fixed name; pinned to `KEYS_RECORD_NAME` in icloud.rs by the parity test. */
export { KEYS_RECORD_NAME } from './keyRecord'

/** Pinned to `ICLOUD_CONTAINER_ID` in icloud.rs by icloudPaths.parity.test.ts. */
export const ICLOUD_CONTAINER_ID = 'iCloud.com.dtgibson.snowraven'

/** The csv names in the container (and the local data dir); pinned likewise. */
export const ICLOUD_CSV_FILES: Record<Slot, string> = {
  ebird: 'ebird-backup.csv',
  ml: 'ml-export.csv',
}

/** icloud-bar-chart-sync: the container subdirectory of each item kind;
 *  pinned to `BARCHARTS_SUBDIR` and `DAY_OBS_SUBDIR` in icloud.rs. */
export const ITEM_SUBDIRS: Record<ItemKind, string> = {
  barchart: 'barcharts',
  'day-obs': 'day-obs',
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

/**
 * THE TYPESCRIPT HALF OF THE TWINNED ITEM PREDICATE (FR-29, NFR-01). An item
 * becomes a container path, so its county code (or device id) is refused HERE,
 * before any invoke, as well as by `County::parse` / `DeviceId::parse` in
 * icloud.rs; each side has a test that goes red when its own check is deleted
 * (`icloudNative.regionCode.test.ts` for this one).
 */
function assertItem(item: SyncItemRef): SyncItemRef {
  const ok = item.kind === 'barchart'
    ? isRegionCode(item.county)
    : item.kind === 'day-obs' && typeof item.deviceId === 'string' && DEVICE_ID_RE.test(item.deviceId)
  if (!ok) throw new ICloudNativeError('unknown')
  return item.kind === 'barchart' ? { kind: 'barchart', county: item.county } : { kind: 'day-obs', deviceId: item.deviceId }
}

async function callItem<T>(cmd: string, item: SyncItemRef, args: Record<string, unknown> = {}): Promise<T> {
  // Refused synchronously inside the async body, so the refusal is a
  // rejection of the closed union and the invoke is never reached.
  return call<T>(cmd, { item: assertItem(item), ...args })
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
  readKeys: (mode) => call<NativeKeysRead>('icloud_read_keys', { mode }),
  writeKeys: (deviceId, slots) => call<NativeKeysWriteResult>('icloud_write_keys', { deviceId, slots }),
  removeKeys: () => call<{ removed: number }>('icloud_remove_keys'),
  watch: (enabled) => call<void>('icloud_watch', { enabled }),
  listItems: (kind) => call<NativeListResult>('icloud_list_items', { kind }),
  pushItem: (item, filename, uploadedAt, origin, unlessSha256, repairSha256) =>
    callItem<NativeItemPushResult>('icloud_push_item', item, { filename, uploadedAt, origin, unlessSha256, repairSha256: repairSha256 ?? null }),
  pushItemsCleared: async (counties, clearedAt, origin) => {
    // Every code is checked here before the invoke; one that fails is reported
    // failed without ever being sent.
    const valid: string[] = []
    const refused: string[] = []
    for (const c of counties) (isRegionCode(c) ? valid : refused).push(c)
    if (valid.length === 0) return { failed: refused }
    const r = await call<{ failed: string[] }>('icloud_push_items_cleared', { counties: valid, clearedAt, origin })
    return { failed: [...refused, ...r.failed] }
  },
  pullItem: (item, expectedSha256, expectedByteLength, mode) =>
    callItem<{ text?: string }>('icloud_pull_item', item, { expectedSha256, expectedByteLength, mode }),
  startDownloadItem: (item) => callItem<void>('icloud_start_download_item', item),
  removeItem: (item) => callItem<{ removed: number }>('icloud_remove_item', item),
  removeItems: (kind) => call<{ removed: number }>('icloud_remove_items', { kind }),
  onChanged: (cb) => listen(ICLOUD_CHANGED_EVENT, () => cb()),
  onIdentityChanged: (cb) => listen(ICLOUD_IDENTITY_EVENT, () => cb()),
}
