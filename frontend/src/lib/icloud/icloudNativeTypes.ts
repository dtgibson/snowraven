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
  onChanged(cb: () => void): Promise<() => void>
  onIdentityChanged(cb: () => void): Promise<() => void>
}
