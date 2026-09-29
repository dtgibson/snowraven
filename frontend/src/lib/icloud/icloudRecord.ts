// Shared record format and validator (icloud-sync FR-37/FR-38; schema.md
// "Shared record format and validator"). Pure, exhaustive, never throws.
//
// A shared record is what iCloud holds for one slot beside the csv:
// `Documents/<slot>.record.json`, UTF-8 JSON written whole by
// src-tauri/src/icloud.rs. The frontend reads it as raw text and validates it
// HERE, so a malformed, oversized, out-of-range, path-bearing or future-dated
// record is treated as absent for that slot: it can never crash launch, never
// throws, and (because the reconcile table has no row that deletes a local
// file for a null record) can never delete a local copy. Display strings from
// a record (label, filename) render only as React children and never form
// part of a path or href.
//
// icloud-bar-chart-sync: two more record kinds share this envelope. A COUNTY
// record (`barcharts/<code>.record.json`) binds itself to its name by
// `slot: 'barchart'` plus `county`, and a DAY-OBS record
// (`day-obs/<deviceId>.record.json`) by `slot: 'day-obs'` plus its origin's
// device id. `Slot` stays exactly the two data files: the new kinds are
// `RecordKind` members, never slots, so every `SLOTS` loop is unchanged.

import { isRegionCode } from '../regionCode'

export type Slot = 'ebird' | 'ml'
/** Every kind of record the container holds beside the key record. */
export type RecordKind = Slot | 'barchart' | 'day-obs'
export type OriginPlatform = 'mac' | 'iphone' | 'ipad'

export interface RecordOrigin {
  deviceId: string
  label: string
  platform: OriginPlatform
}

export interface SharedFileRecord {
  version: 1
  slot: RecordKind
  /** Present on a county record only, and equal to the county its name carries. */
  county?: string
  state: 'file'
  filename: string
  uploadedAt: string
  origin: RecordOrigin
  byteLength: number
  sha256: string
}

export interface SharedClearedRecord {
  version: 1
  slot: RecordKind
  county?: string
  state: 'cleared'
  clearedAt: string
  origin: RecordOrigin
}

export type SharedRecord = SharedFileRecord | SharedClearedRecord

export const SLOTS: readonly Slot[] = ['ebird', 'ml']
export const PLATFORMS: readonly OriginPlatform[] = ['mac', 'iphone', 'ipad']

/** Bounds, as named constants (schema.md). */
export const MAX_LABEL = 64 // UTF-16 code units
export const MAX_FILENAME = 255 // UTF-16 code units
export const MAX_BYTES = 200_000_000 // the csv size bound (PRD OQ-5), also a county file's
/**
 * The day-obs snapshot's per-file bound, in bytes (decimal), DERIVED rather
 * than borrowed: a producer inside the local budget writes at most about 13.8 M
 * UTF-16 code units of JSON, at most about 41.5 MB of UTF-8; 64 MB sits above
 * that and below MAX_BYTES, and it bounds the text before `JSON.parse` (a UTF-8
 * byte count is never smaller than the UTF-16 length). Parity-pinned to
 * `DAY_OBS_SHARED_MAX_BYTES` in icloud.rs; each side has its own enforcement
 * test (schema.md section 10.1).
 */
export const DAY_OBS_SHARED_MAX_BYTES = 64_000_000
export const MAX_RECORD_TEXT = 4096 // a record is a few hundred bytes; 4 KB is generous
export const MIN_TIME = Date.parse('2000-01-01T00:00:00.000Z')
export const MAX_FUTURE_MS = 24 * 60 * 60 * 1000
export const MAX_TIME_TEXT = 64
export const DEVICE_ID_RE = /^[0-9a-f]{32}$/
export const SHA256_RE = /^[0-9a-f]{64}$/

// C0 controls, DEL, and the C1 range: none of them belongs in a label or a
// filename that will be displayed. A code-unit scan rather than a regex so
// the intent is explicit (and eslint's no-control-regex has nothing to say).
function hasControlChars(s: string): boolean {
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i)
    if (c < 0x20 || (c >= 0x7f && c <= 0x9f)) return true
  }
  return false
}

export type RecordVerdict = { ok: true; record: SharedRecord } | { ok: false; reason: string }

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

export function isValidLabel(v: unknown): v is string {
  return typeof v === 'string' && v.length >= 1 && v.length <= MAX_LABEL && !hasControlChars(v)
}

export function isValidFilename(v: unknown): v is string {
  return (
    typeof v === 'string' &&
    v.length >= 1 &&
    v.length <= MAX_FILENAME &&
    !v.includes('/') &&
    !v.includes('\\') &&
    !hasControlChars(v)
  )
}

/**
 * Truncate to at most `max` UTF-16 code units without splitting a surrogate
 * pair (dropping a pair keeps the count exact; halving it would decode as
 * U+FFFD). Mirrors `truncate_units` in src-tauri/src/icloud.rs.
 */
export function truncateUnits(s: string, max: number): string {
  let out = ''
  let units = 0
  for (const ch of s) {
    const w = ch.length // 1 for BMP, 2 for an astral char (a surrogate pair)
    if (units + w > max) break
    units += w
    out += ch
  }
  return out
}

/**
 * A device label as the validator accepts it: no control characters, at most
 * 64 UTF-16 code units, never empty (the fallback stands in). Applied at the
 * TypeScript write chokepoint (the controller) and again natively in Rust
 * (`sanitize_label`), so a record this device writes always validates on every
 * reader, itself included (security round, Finding 3).
 */
export function sanitizeLabel(label: string, fallback: string): string {
  let cleaned = ''
  for (const ch of label) if (!hasControlChars(ch)) cleaned += ch
  const bounded = truncateUnits(cleaned.trim(), MAX_LABEL)
  return bounded.length > 0 ? bounded : fallback
}

/** A display filename as the validator accepts it: no controls, no separators, at most 255 units, never empty. */
export function sanitizeFilename(name: string): string {
  let cleaned = ''
  for (const ch of name) if (!hasControlChars(ch) && ch !== '/' && ch !== '\\') cleaned += ch
  const bounded = truncateUnits(cleaned.trim(), MAX_FILENAME)
  return bounded.length > 0 ? bounded : 'export.csv'
}

/** A parseable instant, not before 2000-01-01 and not more than a day past `nowMs`. */
export function isPlausibleTime(v: unknown, nowMs: number): v is string {
  if (typeof v !== 'string' || v.length === 0 || v.length > MAX_TIME_TEXT) return false
  const t = Date.parse(v)
  if (!Number.isFinite(t)) return false
  return t >= MIN_TIME && t <= nowMs + MAX_FUTURE_MS
}

/**
 * The WRITERS' time shape: exactly what `Date.prototype.toISOString` emits
 * for the years 0000 to 9999 (24 printable ASCII code units). Explicit ASCII
 * classes, per the twinned-guard rule; the Rust twin checks the same byte
 * layout (`parse_iso_time_ms` in src-tauri/src/icloud.rs).
 */
export const ISO_TIME_LEN = 24
export const ISO_TIME_RE = /^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{3}Z$/

/**
 * A time as the two write chokepoints accept it, and they accept exactly the
 * same set (icloudPaths.parity.test.ts pins both): the canonical ISO shape
 * above, a real calendar instant (the round trip through Date is byte-equal,
 * so a February 30th or a 24:00 is refused, as the Rust field check refuses
 * them), and inside the reader's plausibility window. Deliberately STRICTER
 * than isPlausibleTime: the reader stays lenient so a peer's odd but
 * parseable time can still be compared, while a writer never emits one and
 * never re-writes one it read (security fix round, Findings 1 and 2).
 */
export function isWritableTime(v: unknown, nowMs: number): v is string {
  if (typeof v !== 'string' || v.length !== ISO_TIME_LEN || !ISO_TIME_RE.test(v)) return false
  const t = Date.parse(v)
  if (!Number.isFinite(t) || new Date(t).toISOString() !== v) return false
  return t >= MIN_TIME && t <= nowMs + MAX_FUTURE_MS
}

function validOrigin(v: unknown): RecordOrigin | null {
  if (!isRecord(v)) return null
  const { deviceId, label, platform } = v
  if (typeof deviceId !== 'string' || !DEVICE_ID_RE.test(deviceId)) return null
  if (!isValidLabel(label)) return null
  if (typeof platform !== 'string' || !PLATFORMS.includes(platform as OriginPlatform)) return null
  return { deviceId, label, platform: platform as OriginPlatform }
}

/**
 * Validate the raw text of `<slot>.record.json`. Returns the failing rule's
 * name on rejection so the controller can log ONE warning naming it; the
 * record itself is then treated as absent.
 */
export function validateSharedRecord(text: string | null | undefined, slot: Slot, nowMs: number = Date.now()): RecordVerdict {
  if (text === null || text === undefined) return { ok: false, reason: 'absent' }
  if (typeof text !== 'string') return { ok: false, reason: 'not-text' }
  if (text.length > MAX_RECORD_TEXT) return { ok: false, reason: 'oversized' }
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    return { ok: false, reason: 'malformed-json' }
  }
  if (!isRecord(raw)) return { ok: false, reason: 'not-an-object' }
  if (raw.version !== 1) return { ok: false, reason: 'version' }
  if (typeof raw.slot !== 'string' || !SLOTS.includes(raw.slot as Slot)) return { ok: false, reason: 'slot' }
  if (raw.slot !== slot) return { ok: false, reason: 'wrong-slot' }
  const origin = validOrigin(raw.origin)
  if (!origin) return { ok: false, reason: 'origin' }
  if (raw.state === 'file') {
    if (!isValidFilename(raw.filename)) return { ok: false, reason: 'filename' }
    if (!isPlausibleTime(raw.uploadedAt, nowMs)) return { ok: false, reason: 'uploadedAt' }
    const n = raw.byteLength
    if (typeof n !== 'number' || !Number.isInteger(n) || n < 1 || n > MAX_BYTES) return { ok: false, reason: 'byteLength' }
    if (typeof raw.sha256 !== 'string' || !SHA256_RE.test(raw.sha256)) return { ok: false, reason: 'sha256' }
    return {
      ok: true,
      record: {
        version: 1,
        slot,
        state: 'file',
        filename: raw.filename,
        uploadedAt: raw.uploadedAt,
        origin,
        byteLength: n,
        sha256: raw.sha256,
      },
    }
  }
  if (raw.state === 'cleared') {
    if (!isPlausibleTime(raw.clearedAt, nowMs)) return { ok: false, reason: 'clearedAt' }
    return { ok: true, record: { version: 1, slot, state: 'cleared', clearedAt: raw.clearedAt, origin } }
  }
  return { ok: false, reason: 'state' }
}

// ── icloud-bar-chart-sync: county records and day-obs records ──────────────
//
// The same envelope and bounds as `validateSharedRecord`; the only differences
// are what binds a record to its name and, for a day-obs snapshot, its size
// bound and that it has no cleared arm (a device removes its snapshot by
// deleting it). A reason word never carries a value (the v1.0.12 rule).

type Envelope = { ok: true; raw: Record<string, unknown> } | { ok: false; reason: string }

function envelope(text: string | null | undefined): Envelope {
  if (text === null || text === undefined) return { ok: false, reason: 'absent' }
  if (typeof text !== 'string') return { ok: false, reason: 'not-text' }
  if (text.length > MAX_RECORD_TEXT) return { ok: false, reason: 'oversized' }
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    return { ok: false, reason: 'malformed-json' }
  }
  if (!isRecord(raw)) return { ok: false, reason: 'not-an-object' }
  if (raw.version !== 1) return { ok: false, reason: 'version' }
  return { ok: true, raw }
}

/** The file arm's four checks, shared by every file record. */
function fileFields(
  raw: Record<string, unknown>,
  nowMs: number,
  maxBytes: number,
): { ok: true; filename: string; uploadedAt: string; byteLength: number; sha256: string } | { ok: false; reason: string } {
  if (!isValidFilename(raw.filename)) return { ok: false, reason: 'filename' }
  if (!isPlausibleTime(raw.uploadedAt, nowMs)) return { ok: false, reason: 'uploadedAt' }
  const n = raw.byteLength
  if (typeof n !== 'number' || !Number.isInteger(n) || n < 1 || n > maxBytes) return { ok: false, reason: 'byteLength' }
  if (typeof raw.sha256 !== 'string' || !SHA256_RE.test(raw.sha256)) return { ok: false, reason: 'sha256' }
  return { ok: true, filename: raw.filename, uploadedAt: raw.uploadedAt, byteLength: n, sha256: raw.sha256 }
}

/**
 * Validate the raw text of `barcharts/<county>.record.json`. `county` is the
 * code the NAME carries (it passed `REGION_CODE_RE` before the name was
 * built); a record whose own `county` is anything else is `wrong-county` and
 * reads as absent, so a record copied to another county's name cannot act as
 * that county's record.
 */
export function validateCountyRecord(text: string | null | undefined, county: string, nowMs: number = Date.now()): RecordVerdict {
  const env = envelope(text)
  if (!env.ok) return env
  const raw = env.raw
  if (raw.slot !== 'barchart') return { ok: false, reason: 'slot' }
  if (!isRegionCode(raw.county) || raw.county !== county) return { ok: false, reason: 'wrong-county' }
  const origin = validOrigin(raw.origin)
  if (!origin) return { ok: false, reason: 'origin' }
  if (raw.state === 'file') {
    const f = fileFields(raw, nowMs, MAX_BYTES)
    if (!f.ok) return f
    return {
      ok: true,
      record: {
        version: 1, slot: 'barchart', county, state: 'file', filename: f.filename, uploadedAt: f.uploadedAt,
        origin, byteLength: f.byteLength, sha256: f.sha256,
      },
    }
  }
  if (raw.state === 'cleared') {
    if (!isPlausibleTime(raw.clearedAt, nowMs)) return { ok: false, reason: 'clearedAt' }
    return { ok: true, record: { version: 1, slot: 'barchart', county, state: 'cleared', clearedAt: raw.clearedAt, origin } }
  }
  return { ok: false, reason: 'state' }
}

/**
 * Validate the raw text of `day-obs/<deviceId>.record.json`. A snapshot
 * record binds itself to its name by its ORIGIN: a record at one device's name
 * that claims another device is `wrong-device`. File arm only, and its
 * `byteLength` is bounded by `DAY_OBS_SHARED_MAX_BYTES`, the TypeScript half of
 * the twinned bound (the native pull refuses an over-bound claim too).
 */
export function validateDayObsRecord(text: string | null | undefined, deviceId: string, nowMs: number = Date.now()): RecordVerdict {
  const env = envelope(text)
  if (!env.ok) return env
  const raw = env.raw
  if (raw.slot !== 'day-obs') return { ok: false, reason: 'slot' }
  const origin = validOrigin(raw.origin)
  if (!origin) return { ok: false, reason: 'origin' }
  if (origin.deviceId !== deviceId) return { ok: false, reason: 'wrong-device' }
  if (raw.state !== 'file') return { ok: false, reason: 'state' }
  const f = fileFields(raw, nowMs, DAY_OBS_SHARED_MAX_BYTES)
  if (!f.ok) return f
  return {
    ok: true,
    record: {
      version: 1, slot: 'day-obs', state: 'file', filename: f.filename, uploadedAt: f.uploadedAt,
      origin, byteLength: f.byteLength, sha256: f.sha256,
    },
  }
}

/** Pinned byte-equal to `COUNTY_RECORD_GOLDEN` in icloud.rs by the parity test. */
export const COUNTY_RECORD_GOLDEN =
  '{"version":1,"slot":"barchart","county":"US-CA-001","state":"file","filename":"ebird_US-CA-001__1900_2026_1_12_barchart.txt",'
  + '"uploadedAt":"2026-09-20T12:05:00.000Z","origin":{"deviceId":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","label":"Dave\'s MacBook Pro","platform":"mac"},'
  + '"byteLength":48213,"sha256":"3f79bb7b435b05321651daefd374cdc681dc06faa65e374e38337b88ca046dea"}'
/** Pinned byte-equal to `COUNTY_CLEARED_GOLDEN` in icloud.rs by the parity test. */
export const COUNTY_CLEARED_GOLDEN =
  '{"version":1,"slot":"barchart","county":"US-CA-001","state":"cleared","clearedAt":"2026-09-21T08:00:00.000Z",'
  + '"origin":{"deviceId":"ffffffffffffffffffffffffffffffff","label":"iPhone","platform":"iphone"}}'
/** Pinned byte-equal to `DAY_OBS_RECORD_GOLDEN` in icloud.rs by the parity test. */
export const DAY_OBS_RECORD_GOLDEN =
  '{"version":1,"slot":"day-obs","state":"file","filename":"county-day-obs.json","uploadedAt":"2026-09-21T08:00:00.000Z",'
  + '"origin":{"deviceId":"ffffffffffffffffffffffffffffffff","label":"iPhone","platform":"iphone"},'
  + '"byteLength":10485760,"sha256":"3f79bb7b435b05321651daefd374cdc681dc06faa65e374e38337b88ca046dea"}'

/** The schema's `parseSharedRecord`: the record, or null for anything else. */
export function parseSharedRecord(text: string | null | undefined, slot: Slot, nowMs: number = Date.now()): SharedRecord | null {
  const v = validateSharedRecord(text, slot, nowMs)
  return v.ok ? v.record : null
}

/** The exact key set the native writer emits, for round-trip tests and parity. */
export function serializeRecord(record: SharedRecord): string {
  // `county` rides directly after `slot` when present, the native writer's
  // field order (`RecordFile` in icloud.rs); a slot record has no such key.
  const county = record.county !== undefined ? { county: record.county } : {}
  if (record.state === 'file') {
    return JSON.stringify({
      version: 1,
      slot: record.slot,
      ...county,
      state: 'file',
      filename: record.filename,
      uploadedAt: record.uploadedAt,
      origin: record.origin,
      byteLength: record.byteLength,
      sha256: record.sha256,
    })
  }
  return JSON.stringify({
    version: 1,
    slot: record.slot,
    ...county,
    state: 'cleared',
    clearedAt: record.clearedAt,
    origin: record.origin,
  })
}

/** The instant a record describes, in ms (records are validated, so this is finite). */
export function recordTimeMs(record: SharedRecord): number {
  return Date.parse(record.state === 'file' ? record.uploadedAt : record.clearedAt)
}
