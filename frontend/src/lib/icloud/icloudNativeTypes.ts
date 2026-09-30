// Types and the error mapping for the native iCloud layer, kept apart from
// icloudNative.ts so that ENTRY-SAFE modules (icloudState.ts, icloudCopy.ts,
// Settings.tsx) can name the closed error union without pulling
// `@tauri-apps/api` onto the entry chunk. No runtime import of anything.

import type { OriginPlatform, RecordOrigin, Slot } from './icloudRecord'
import type { KeySlot, SharedKeyEntry } from './keyRecord'

/** The closed error union every native failure maps to (no Apple text). */
export type ICloudError =
  | 'timeout'
  | 'not-downloaded'
  | 'mismatch'
  | 'absent'
  | 'local-missing'
  | 'too-large'
  | 'unavailable'
  | 'unknown'

const CODES: readonly ICloudError[] = [
  'timeout',
  'not-downloaded',
  'mismatch',
  'absent',
  'local-missing',
  'too-large',
  'unavailable',
  'unknown',
]

export class ICloudNativeError extends Error {
  readonly code: ICloudError
  constructor(code: ICloudError) {
    super(code)
    this.name = 'ICloudNativeError'
    this.code = code
  }
}

/** Map whatever a rejected invoke carries onto the closed union. */
export function toICloudError(raw: unknown): ICloudNativeError {
  if (raw instanceof ICloudNativeError) return raw
  const text = typeof raw === 'string' ? raw : raw instanceof Error ? raw.message : String(raw)
  const code = CODES.find((c) => c === text)
  return new ICloudNativeError(code ?? 'unknown')
}

export type NativeAvailability = 'available' | 'not-signed-in' | 'drive-off-or-unauthorized' | 'build-cannot-use-icloud'

export interface NativeStatus {
  state: NativeAvailability
  deviceLabel: string
  platform: OriginPlatform
}

export interface NativeFileStatus {
  present: boolean
  downloaded: boolean
  downloading: boolean
  byteLength: number | null
  /** FR-05: both the csv and its record report iCloud holds them (a push
      writes into the local container first; the daemon uploads later). */
  uploaded: boolean
  uploading: boolean
}

export interface NativeRecordRead {
  record: string | null
  file: NativeFileStatus
}

export interface NativePushResult {
  sha256: string
  byteLength: number
  /** almost always false straight after a push; see NativeFileStatus.uploaded */
  uploaded: boolean
}

// ── The shared key record (icloud-api-key-sync; schema.md "Native layer additions") ──

/** The four ubiquity flags of the key record, the same shape a csv reports. */
export interface NativeKeyRecordStatus {
  present: boolean
  downloaded: boolean
  downloading: boolean
  uploaded: boolean
  uploading: boolean
}

/** 'status' = existence only (what FR-36 permits with the key switch off); 'record' = the raw text too. */
export type NativeKeysReadMode = 'status' | 'record'

export interface NativeKeysRead {
  /** the raw record text, only in 'record' mode; null when absent (or in 'status' mode) */
  record: string | null
  status: NativeKeyRecordStatus
}

/** What the controller hands the native writer per slot: an already-sanitized entry. */
export type KeyEntryInput = SharedKeyEntry
export type KeySlotsInput = Partial<Record<KeySlot, KeyEntryInput>>

export interface NativeKeysWriteResult {
  /** whether iCloud already holds the record just written (see NativeFileStatus.uploaded) */
  uploaded: boolean
}

// ── icloud-bar-chart-sync: the item commands (schema.md section 9.3) ──

/** The two synced kinds that are not slots. */
export type ItemKind = 'barchart' | 'day-obs'

/** One item, as the native commands take it; converted and validated natively
 *  (and checked by the wrapper in icloudNative.ts first). */
export type SyncItemRef = { kind: 'barchart'; county: string } | { kind: 'day-obs'; deviceId: string }

/** A hostile-container bound on one listing, never a user quota; pinned to
 *  `MAX_LISTED_ITEMS` in icloud.rs by the parity test. */
export const MAX_LISTED_ITEMS = 4096

export interface NativeListedFile {
  present: boolean
  downloaded: boolean
  downloading: boolean
  byteLength: number | null
  /** both the file and its record report iCloud holds them */
  uploaded: boolean
}

/**
 * One listed item. The RECORD is tri-state, which the two slots never needed:
 * `present: false` = no record (a local file is pushed); `present: true,
 * record: null` = a record exists but has not downloaded (or could not be
 * read) and the item is SKIPPED this check, never treated as absent, so a
 * device never pushes over a peer's file it has not read; a string = the raw
 * text, validated by the caller.
 */
export interface NativeListedItem {
  /** the validated county code or device id */
  id: string
  present: boolean
  record: string | null
  file: NativeListedFile
}

export interface NativeListResult {
  items: NativeListedItem[]
  /** MAX_LISTED_ITEMS was reached; the rest were ignored this listing */
  truncated: boolean
  /**
   * The kind's directory is in iCloud but not on this device yet (its download
   * has been asked for): nothing was read, and nothing may be decided from
   * this listing, least of all a push, which would make a second directory of
   * the same name. Absent from an older native layer, read as false.
   */
  pending?: boolean
}

export interface NativeItemPushResult {
  sha256: string
  byteLength: number
  uploaded: boolean
  /** nothing was written: the digest equalled `unlessSha256`, or differed from `repairSha256` */
  skipped: boolean
  /**
   * Repair mode only: the county's record in iCloud no longer names this
   * device's current copy (another device's newer version is on its way), so
   * nothing was written or deleted. Absent from an older native layer.
   */
  superseded?: boolean
}

/**
 * The commands and two events, as the controller sees them. The real
 * implementation is icloudNative.ts; tests inject a fake.
 */
export interface ICloudNativeLayer {
  status(): Promise<NativeStatus>
  readRecord(slot: Slot): Promise<NativeRecordRead>
  push(slot: Slot, filename: string, uploadedAt: string, origin: RecordOrigin): Promise<NativePushResult>
  pushCleared(slot: Slot, clearedAt: string, origin: RecordOrigin): Promise<void>
  pull(slot: Slot, expectedSha256: string, expectedByteLength: number): Promise<void>
  startDownload(slot: Slot): Promise<void>
  removeAll(): Promise<{ removed: number }>
  /** icloud-api-key-sync: the key record's status (and text in 'record' mode). */
  readKeys(mode: NativeKeysReadMode): Promise<NativeKeysRead>
  /** Write the whole key record atomically; the value is used only to build it. */
  writeKeys(deviceId: string, slots: KeySlotsInput): Promise<NativeKeysWriteResult>
  /** Delete the key record (and any key staging entry), never a csv or a file record. */
  removeKeys(): Promise<{ removed: number }>
  watch(enabled: boolean): Promise<void>
  // ── icloud-bar-chart-sync ──
  /** Every item of a kind whose record name passes the kind's predicate, in one call. */
  listItems(kind: ItemKind): Promise<NativeListResult>
  /**
   * Push the item's local file then its record; nothing is written when the
   * digest equals `unlessSha256`. With `repairSha256` (a county only), the
   * FILE alone is written, and only when the local digest equals it: the
   * record in iCloud is this device's own and already names that digest.
   */
  pushItem(item: SyncItemRef, filename: string, uploadedAt: string, origin: RecordOrigin, unlessSha256: string | null, repairSha256?: string | null): Promise<NativeItemPushResult>
  /** A cleared marker per county (the county file goes); per-county failures come back in `failed`. */
  pushItemsCleared(counties: string[], clearedAt: string, origin: RecordOrigin): Promise<{ failed: string[] }>
  /** Verify and write the county file over the local one (`file`), or hand a snapshot back as text (`text`). */
  pullItem(item: SyncItemRef, expectedSha256: string, expectedByteLength: number, mode: 'file' | 'text'): Promise<{ text?: string }>
  startDownloadItem(item: SyncItemRef): Promise<void>
  /** Delete one item's file and record (this device's own snapshot, in practice). */
  removeItem(item: SyncItemRef): Promise<{ removed: number }>
  /** Delete every item of a kind (every county, or every device's snapshot). */
  removeItems(kind: ItemKind): Promise<{ removed: number }>
  /**
   * Diagnostics (icloud-bar-chart-sync decisions.md entry 20): the raw
   * `icloud_diagnostics` payload, a read-only scan of the container and the
   * native operation log. Handed to `buildICloudReport` as UNTRUSTED input,
   * which keeps only the fields it names. Optional so test fakes need not
   * carry it; the report says so when it is missing.
   */
  diagnostics?(): Promise<unknown>
  onChanged(cb: () => void): Promise<() => void>
  onIdentityChanged(cb: () => void): Promise<() => void>
}
