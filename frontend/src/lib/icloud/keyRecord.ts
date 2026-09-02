// The shared KEY record (icloud-api-key-sync FR-17 to FR-22; schema.md
// "Container: the shared key record"). Pure, exhaustive, never throws, and
// ENTRY-SAFE: the state store names its types, so this file rides the entry
// chunk (entryChunk.test.ts asserts it) and must stay dependency-free beyond
// icloudRecord.ts, which it shares its bounds and helpers with.
//
// One record, `Documents/keys.record.json`, holds for each key slot a key
// entry, a cleared marker, or nothing. It is untrusted on read and on write:
// a slot that fails any bound reads as ABSENT (null), an envelope that fails
// reads as absent for BOTH slots, and the reconcile table has no row that
// deletes a local key for a null shared slot, so a malformed record can
// never empty a device (FR-20). A rejection names the RULE only: a reason
// string never carries a value (FR-21).

import {
  DEVICE_ID_RE, MAX_RECORD_TEXT, PLATFORMS, isPlausibleTime, isValidLabel, isWritableTime, sanitizeLabel,
  type OriginPlatform, type RecordOrigin,
} from './icloudRecord'

export type KeySlot = 'ebird' | 'openweather'
export const KEY_SLOTS: readonly KeySlot[] = ['ebird', 'openweather']

/** The record's fixed name: a constant on both sides, never derived from content (FR-17). */
export const KEYS_RECORD_NAME = 'keys.record.json'

/** Key value bounds (FR-19, OQ-9): 1 to 128 printable ASCII code units. */
export const MAX_KEY_VALUE = 128
export const KEY_CHAR_MIN = 0x21
export const KEY_CHAR_MAX = 0x7e

export interface SharedKeyValueEntry {
  state: 'key'
  value: string
  changedAt: string
  origin: RecordOrigin
}
export interface SharedKeyClearedEntry {
  state: 'cleared'
  clearedAt: string
  origin: RecordOrigin
}
export type SharedKeyEntry = SharedKeyValueEntry | SharedKeyClearedEntry
export type SharedKeySlots = Record<KeySlot, SharedKeyEntry | null>

export type KeyRecordVerdict =
  | { ok: true; slots: SharedKeySlots; rejected: Partial<Record<KeySlot, string>> }
  | { ok: false; reason: string }

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

/**
 * A key value as the record may carry it: printable ASCII only (no space, no
 * control, no non-ASCII), 1 to 128 code units. eBird keys are short
 * alphanumeric tokens and OpenWeather keys are 32 hex characters; the bound
 * is generous headroom, never to be narrowed (OQ-9).
 */
export function isValidKeyValue(v: unknown): v is string {
  if (typeof v !== 'string' || v.length < 1 || v.length > MAX_KEY_VALUE) return false
  for (let i = 0; i < v.length; i++) {
    const c = v.charCodeAt(i)
    if (c < KEY_CHAR_MIN || c > KEY_CHAR_MAX) return false
  }
  return true
}

function validOrigin(v: unknown): RecordOrigin | null {
  if (!isRecord(v)) return null
  const { deviceId, label, platform } = v
  if (typeof deviceId !== 'string' || !DEVICE_ID_RE.test(deviceId)) return null
  if (!isValidLabel(label)) return null
  if (typeof platform !== 'string' || !PLATFORMS.includes(platform as OriginPlatform)) return null
  return { deviceId, label, platform: platform as OriginPlatform }
}

/** One slot's entry: the entry, or the failing rule's name. */
function validateEntry(raw: unknown, nowMs: number): { entry: SharedKeyEntry } | { reason: string } {
  if (!isRecord(raw)) return { reason: 'entry' }
  if (raw.state === 'key') {
    if (!isValidKeyValue(raw.value)) return { reason: 'value' }
    if (!isPlausibleTime(raw.changedAt, nowMs)) return { reason: 'changedAt' }
    const origin = validOrigin(raw.origin)
    if (!origin) return { reason: 'origin' }
    return { entry: { state: 'key', value: raw.value, changedAt: raw.changedAt, origin } }
  }
  if (raw.state === 'cleared') {
    if (!isPlausibleTime(raw.clearedAt, nowMs)) return { reason: 'clearedAt' }
    const origin = validOrigin(raw.origin)
    if (!origin) return { reason: 'origin' }
    return { entry: { state: 'cleared', clearedAt: raw.clearedAt, origin } }
  }
  return { reason: 'state' }
}

/**
 * Validate the raw text of `keys.record.json`. The envelope decides both
 * slots; each slot is then judged on its own, so one malformed slot never
 * costs the other. Every reason is a rule word (FR-21).
 */
export function validateKeyRecord(text: string | null | undefined, nowMs: number = Date.now()): KeyRecordVerdict {
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
  if (raw.kind !== 'keys') return { ok: false, reason: 'kind' }
  if (!isRecord(raw.slots)) return { ok: false, reason: 'slots' }
  const slots: SharedKeySlots = { ebird: null, openweather: null }
  const rejected: Partial<Record<KeySlot, string>> = {}
  for (const slot of KEY_SLOTS) {
    const v = raw.slots[slot]
    if (v === undefined || v === null) continue // a valid nothing
    const r = validateEntry(v, nowMs)
    if ('entry' in r) slots[slot] = r.entry
    else rejected[slot] = r.reason
  }
  return { ok: true, slots, rejected }
}

/**
 * The TypeScript write chokepoint: every entry the controller hands to the
 * native layer goes through here, the ones this device authored AND the
 * ones it carries unchanged from a peer. The label is sanitized and an
 * unknown platform falls back to 'mac' (the shipped recordOrigin rule); a
 * value that fails the bound is REFUSED (null), never truncated: a key is a
 * secret and cannot be cleaned into a different key; and a time that fails
 * the writers' predicate (`isWritableTime` against `nowMs`: the canonical
 * ISO shape inside the reader's plausibility window) is likewise REFUSED,
 * never rewritten, so a record this device writes always validates on every
 * reader, itself included, and a skewed clock or a hand-edited time can
 * neither loop nor block a write (security fix round, Findings 1 and 2).
 * The Rust chokepoint (`sanitize_key_entry`) enforces the same bounds.
 */
export function sanitizeKeyEntryForWrite(entry: SharedKeyEntry, fallbackLabel: string, nowMs: number): SharedKeyEntry | null {
  const origin: RecordOrigin = {
    deviceId: entry.origin.deviceId,
    label: sanitizeLabel(entry.origin.label, fallbackLabel),
    platform: PLATFORMS.includes(entry.origin.platform) ? entry.origin.platform : 'mac',
  }
  if (entry.state === 'key') {
    if (!isValidKeyValue(entry.value)) return null
    if (!isWritableTime(entry.changedAt, nowMs)) return null
    return { state: 'key', value: entry.value, changedAt: entry.changedAt, origin }
  }
  if (!isWritableTime(entry.clearedAt, nowMs)) return null
  return { state: 'cleared', clearedAt: entry.clearedAt, origin }
}

/** The exact key order the native writer (icloud.rs `KeyRecordFile`) emits; an absent slot is omitted, never null. */
export function serializeKeyRecord(slots: Partial<Record<KeySlot, SharedKeyEntry | null>>): string {
  const out: Record<string, unknown> = {}
  for (const slot of KEY_SLOTS) {
    const e = slots[slot]
    if (!e) continue
    const origin = { deviceId: e.origin.deviceId, label: e.origin.label, platform: e.origin.platform }
    out[slot] = e.state === 'key'
      ? { state: 'key', value: e.value, changedAt: e.changedAt, origin }
      : { state: 'cleared', clearedAt: e.clearedAt, origin }
  }
  return JSON.stringify({ version: 1, kind: 'keys', slots: out })
}

/** The instant an entry describes, in ms (entries are validated, so this is finite). */
export function keyEntryTimeMs(entry: SharedKeyEntry): number {
  return Date.parse(entry.state === 'key' ? entry.changedAt : entry.clearedAt)
}

/**
 * The golden serialization, pinned byte-equal to the Rust writer's own golden
 * by icloudPaths.parity.test.ts. Fixture values only; not a real key.
 */
export const KEY_RECORD_GOLDEN =
  '{"version":1,"kind":"keys","slots":{'
  + '"ebird":{"state":"key","value":"FixtureKey0001abcd","changedAt":"2026-08-31T01:48:00.000Z",'
  + '"origin":{"deviceId":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","label":"Dave\'s MacBook Pro","platform":"mac"}},'
  + '"openweather":{"state":"cleared","clearedAt":"2026-09-01T15:40:00.000Z",'
  + '"origin":{"deviceId":"ffffffffffffffffffffffffffffffff","label":"iPhone","platform":"iphone"}}}}'
