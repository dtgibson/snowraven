// icloud-api-key-sync FR-18 to FR-22 (QA-15, QA-41): the shared key record
// validator treats every malformed, oversized, out-of-range, whitespace,
// control-character, non-ASCII, future-dated or wrong-kind record as ABSENT
// (per slot or whole), never throws, names only the failing RULE (never a
// value), and a sanitized entry round-trips through serializeKeyRecord and
// validateKeyRecord idempotently. keyReconcile.test.ts asserts the other
// half: no table row deletes a local key for a null shared slot.

import { describe, it, expect } from 'vitest'
import {
  KEYS_RECORD_NAME, KEY_CHAR_MAX, KEY_CHAR_MIN, KEY_RECORD_GOLDEN, KEY_SLOTS, MAX_KEY_VALUE,
  isValidKeyValue, keyEntryTimeMs, sanitizeKeyEntryForWrite, serializeKeyRecord, validateKeyRecord,
  type SharedKeyEntry,
} from './keyRecord'
import { MAX_LABEL, MAX_RECORD_TEXT, MAX_FUTURE_MS, isWritableTime } from './icloudRecord'

const NOW = Date.parse('2026-09-01T16:00:00.000Z')
const ME = 'a'.repeat(32)
const PEER = 'f'.repeat(32)
// A sentinel that stands in for a real key in every test here; it must never
// appear in a reason string (FR-21).
const SENTINEL = 'SENTINELkey0xA1B2C3'

function keyEntry(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    state: 'key',
    value: SENTINEL,
    changedAt: '2026-08-31T01:48:00.000Z',
    origin: { deviceId: ME, label: "Dave's MacBook Pro", platform: 'mac' },
    ...overrides,
  }
}
function clearedEntry(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    state: 'cleared',
    clearedAt: '2026-09-01T15:40:00.000Z',
    origin: { deviceId: PEER, label: 'iPhone', platform: 'iphone' },
    ...overrides,
  }
}
function record(slots: Record<string, unknown>, envelope: Record<string, unknown> = {}): string {
  return JSON.stringify({ version: 1, kind: 'keys', slots, ...envelope })
}

describe('constants (parity-pinned to icloud.rs)', () => {
  it('the record name is a constant, the bounds are the schema values', () => {
    expect(KEYS_RECORD_NAME).toBe('keys.record.json')
    expect(KEY_SLOTS).toEqual(['ebird', 'openweather'])
    expect(MAX_KEY_VALUE).toBe(128)
    expect(KEY_CHAR_MIN).toBe(0x21)
    expect(KEY_CHAR_MAX).toBe(0x7e)
  })
})

describe('isValidKeyValue (FR-19, OQ-9)', () => {
  it('accepts real-shaped keys: a 12-character alphanumeric eBird key and a 32-hex OpenWeather key', () => {
    expect(isValidKeyValue('q7v3kd9m2pah')).toBe(true)
    expect(isValidKeyValue('3f8c1a2e9b7d4c6f0a1b2c3d4e5f6a7b')).toBe(true)
  })
  it('accepts every printable ASCII code unit and the 1 and 128 edges', () => {
    let all = ''
    for (let c = KEY_CHAR_MIN; c <= KEY_CHAR_MAX; c++) all += String.fromCharCode(c)
    expect(isValidKeyValue(all)).toBe(true)
    expect(isValidKeyValue('x')).toBe(true)
    expect(isValidKeyValue('x'.repeat(128))).toBe(true)
  })
  it('rejects the empty string, 129 units, whitespace, controls, DEL and non-ASCII', () => {
    expect(isValidKeyValue('')).toBe(false)
    expect(isValidKeyValue('x'.repeat(129))).toBe(false)
    expect(isValidKeyValue('has space')).toBe(false)
    expect(isValidKeyValue('tab\there')).toBe(false)
    expect(isValidKeyValue('nl\n')).toBe(false)
    expect(isValidKeyValue('ctrl')).toBe(false)
    expect(isValidKeyValue('del')).toBe(false)
    expect(isValidKeyValue('café')).toBe(false)
    expect(isValidKeyValue('☃')).toBe(false)
    expect(isValidKeyValue(42)).toBe(false)
    expect(isValidKeyValue(null)).toBe(false)
  })
})

describe('validateKeyRecord envelope (FR-20: an envelope failure reads as absent for BOTH slots)', () => {
  it.each([
    ['absent', null],
    ['absent', undefined],
    ['malformed-json', '{not json'],
    ['malformed-json', ''],
    ['not-an-object', '[]'],
    ['not-an-object', '"text"'],
    ['version', record({}, { version: 2 })],
    ['version', record({}, { version: '1' })],
    ['kind', record({}, { kind: 'ebird' })],
    ['slots', JSON.stringify({ version: 1, kind: 'keys' })],
    ['slots', JSON.stringify({ version: 1, kind: 'keys', slots: [] })],
  ])('%s', (reason, text) => {
    const v = validateKeyRecord(text as string | null | undefined, NOW)
    expect(v.ok).toBe(false)
    if (!v.ok) expect(v.reason).toBe(reason)
  })

  it('a FILE record planted at the key name is refused by kind', () => {
    const fileRecord = JSON.stringify({ version: 1, slot: 'ebird', state: 'file', filename: 'x.csv', uploadedAt: '2026-08-24T22:12:00.000Z', origin: { deviceId: ME, label: 'Mac', platform: 'mac' }, byteLength: 10, sha256: 'b'.repeat(64) })
    const v = validateKeyRecord(fileRecord, NOW)
    expect(v.ok).toBe(false)
    if (!v.ok) expect(v.reason).toBe('kind')
  })

  it('oversized text is refused before parsing', () => {
    const big = record({ ebird: keyEntry({ value: 'x'.repeat(100) }) }) + ' '.repeat(MAX_RECORD_TEXT)
    const v = validateKeyRecord(big, NOW)
    expect(v.ok).toBe(false)
    if (!v.ok) expect(v.reason).toBe('oversized')
  })

  it('an empty slots object is a valid record holding nothing', () => {
    const v = validateKeyRecord(record({}), NOW)
    expect(v).toEqual({ ok: true, slots: { ebird: null, openweather: null }, rejected: {} })
  })

  it('never throws on hostile input', () => {
    for (const text of [' ', '{"version":1,"kind":"keys","slots":{"ebird":null}}', '{"__proto__":{"x":1}}', 'null', '1e309']) {
      expect(() => validateKeyRecord(text, NOW)).not.toThrow()
    }
  })
})

describe('validateKeyRecord per slot (FR-20: one bad slot never costs the other)', () => {
  it('a valid key entry and a valid cleared marker both pass with their fields intact', () => {
    const v = validateKeyRecord(record({ ebird: keyEntry(), openweather: clearedEntry() }), NOW)
    expect(v.ok).toBe(true)
    if (!v.ok) return
    expect(v.rejected).toEqual({})
    expect(v.slots.ebird).toEqual({ state: 'key', value: SENTINEL, changedAt: '2026-08-31T01:48:00.000Z', origin: { deviceId: ME, label: "Dave's MacBook Pro", platform: 'mac' } })
    expect(v.slots.openweather).toEqual({ state: 'cleared', clearedAt: '2026-09-01T15:40:00.000Z', origin: { deviceId: PEER, label: 'iPhone', platform: 'iphone' } })
  })

  it('unknown slot names are ignored and a null slot is a valid nothing', () => {
    const v = validateKeyRecord(record({ ml: keyEntry(), ebird: null }), NOW)
    expect(v).toEqual({ ok: true, slots: { ebird: null, openweather: null }, rejected: {} })
  })

  const bad: Array<[string, string, Record<string, unknown>]> = [
    ['entry', 'a non-object slot', { ebird: 'string' }],
    ['entry', 'an array slot', { ebird: [] }],
    ['state', 'an unknown state', { ebird: keyEntry({ state: 'file' }) }],
    ['value', 'a 0-length value', { ebird: keyEntry({ value: '' }) }],
    ['value', 'a 129-character value', { ebird: keyEntry({ value: 'x'.repeat(129) }) }],
    ['value', 'whitespace in the value', { ebird: keyEntry({ value: 'a b' }) }],
    ['value', 'a control character in the value', { ebird: keyEntry({ value: 'ab' }) }],
    ['value', 'non-ASCII in the value', { ebird: keyEntry({ value: 'café' }) }],
    ['value', 'a non-string value', { ebird: keyEntry({ value: 12345 }) }],
    ['changedAt', 'an out-of-range (pre-2000) time', { ebird: keyEntry({ changedAt: '1999-12-31T23:59:59.000Z' }) }],
    ['changedAt', 'a future time past the one-day allowance', { ebird: keyEntry({ changedAt: new Date(NOW + MAX_FUTURE_MS + 1000).toISOString() }) }],
    ['changedAt', 'an unparseable time', { ebird: keyEntry({ changedAt: 'yesterday' }) }],
    ['changedAt', 'a 65-character time', { ebird: keyEntry({ changedAt: '2'.repeat(65) }) }],
    ['origin', 'a path-bearing device id', { ebird: keyEntry({ origin: { deviceId: '../../etc', label: 'x', platform: 'mac' } }) }],
    ['origin', 'an uppercase device id', { ebird: keyEntry({ origin: { deviceId: 'A'.repeat(32), label: 'x', platform: 'mac' } }) }],
    ['origin', 'a 65-unit label', { ebird: keyEntry({ origin: { deviceId: ME, label: 'x'.repeat(MAX_LABEL + 1), platform: 'mac' } }) }],
    ['origin', 'a control character in the label', { ebird: keyEntry({ origin: { deviceId: ME, label: 'ab', platform: 'mac' } }) }],
    ['origin', 'an empty label', { ebird: keyEntry({ origin: { deviceId: ME, label: '', platform: 'mac' } }) }],
    ['origin', 'an unknown platform', { ebird: keyEntry({ origin: { deviceId: ME, label: 'x', platform: 'windows' } }) }],
    ['origin', 'a missing origin', { ebird: keyEntry({ origin: undefined }) }],
    ['clearedAt', 'an unparseable clear time', { ebird: clearedEntry({ clearedAt: 'soon' }) }],
    ['clearedAt', 'a future clear time', { ebird: clearedEntry({ clearedAt: '2999-01-01T00:00:00.000Z' }) }],
    ['origin', 'a marker with a bad origin', { ebird: clearedEntry({ origin: { deviceId: 'zz', label: 'x', platform: 'mac' } }) }],
  ]
  it.each(bad)('%s: %s rejects that slot only, keeps the other, and names no value', (reason, _label, slots) => {
    const text = record({ ...slots, openweather: clearedEntry() })
    const v = validateKeyRecord(text, NOW)
    expect(v.ok).toBe(true)
    if (!v.ok) return
    expect(v.slots.ebird).toBeNull()
    expect(v.rejected.ebird).toBe(reason)
    expect(v.slots.openweather).not.toBeNull()
    expect(JSON.stringify(v.rejected)).not.toContain(SENTINEL)
  })

  it('a 65-unit label is the edge: 64 passes', () => {
    const ok = validateKeyRecord(record({ ebird: keyEntry({ origin: { deviceId: ME, label: 'x'.repeat(MAX_LABEL), platform: 'mac' } }) }), NOW)
    expect(ok.ok && ok.slots.ebird?.state).toBe('key')
  })

  it('a value of exactly 128 units and a time exactly one day ahead both pass', () => {
    const v = validateKeyRecord(record({ ebird: keyEntry({ value: 'x'.repeat(128), changedAt: new Date(NOW + MAX_FUTURE_MS).toISOString() }) }), NOW)
    expect(v.ok && v.slots.ebird?.state).toBe('key')
  })
})

describe('sanitizeKeyEntryForWrite (the TypeScript chokepoint, NFR-01)', () => {
  it('cleans the label, falls back the platform, passes a writable time unchanged, and never rewrites a value', () => {
    const entry: SharedKeyEntry = { state: 'key', value: SENTINEL, changedAt: '2026-08-31T01:48:00.000Z', origin: { deviceId: ME, label: "  Dave's Mac  ", platform: 'windows' as 'mac' } }
    const clean = sanitizeKeyEntryForWrite(entry, 'Mac', NOW)
    expect(clean).toEqual({ state: 'key', value: SENTINEL, changedAt: '2026-08-31T01:48:00.000Z', origin: { deviceId: ME, label: "Dave's Mac", platform: 'mac' } })
  })

  it('REFUSES a value outside the bound (null), never a truncated or altered key', () => {
    for (const value of ['', 'x'.repeat(129), 'a b', 'café', 'a\nb']) {
      expect(sanitizeKeyEntryForWrite({ state: 'key', value, changedAt: '2026-08-31T01:48:00.000Z', origin: { deviceId: ME, label: 'Mac', platform: 'mac' } }, 'Mac', NOW)).toBeNull()
    }
  })

  // Security fix round, Finding 1: the writer applies the reader's own
  // plausibility window, so a device a day ahead (or a hand-edited time)
  // stops writing a record every peer rejects instead of ping-ponging.
  it('REFUSES a time past the one-day allowance or before 2000, on a key entry and on a marker; exactly one day ahead passes', () => {
    const key = (changedAt: string): SharedKeyEntry => ({ state: 'key', value: SENTINEL, changedAt, origin: { deviceId: ME, label: 'Mac', platform: 'mac' } })
    const marker = (clearedAt: string): SharedKeyEntry => ({ state: 'cleared', clearedAt, origin: { deviceId: PEER, label: 'iPhone', platform: 'iphone' } })
    const dayAhead = new Date(NOW + MAX_FUTURE_MS).toISOString()
    const pastIt = new Date(NOW + MAX_FUTURE_MS + 1).toISOString()
    const hoursAhead25 = new Date(NOW + 25 * 60 * 60 * 1000).toISOString()
    expect(sanitizeKeyEntryForWrite(key(dayAhead), 'Mac', NOW)).toMatchObject({ changedAt: dayAhead })
    expect(sanitizeKeyEntryForWrite(marker(dayAhead), 'iPhone', NOW)).toMatchObject({ clearedAt: dayAhead })
    for (const t of [pastIt, hoursAhead25, '1999-12-31T23:59:59.999Z']) {
      expect(sanitizeKeyEntryForWrite(key(t), 'Mac', NOW)).toBeNull()
      expect(sanitizeKeyEntryForWrite(marker(t), 'iPhone', NOW)).toBeNull()
    }
    // The window follows the clock handed in, never the wall clock.
    expect(sanitizeKeyEntryForWrite(key(hoursAhead25), 'Mac', NOW + MAX_FUTURE_MS)).not.toBeNull()
  })

  // Security fix round, Finding 2: the reader accepts any parseable time,
  // the Rust writer only the canonical shape, and both engines the app runs
  // on parse a parenthesised non-ASCII comment. The chokepoint refuses what
  // the writer would refuse, so a carried peer slot can never fail the write.
  it('REFUSES a parseable time that is not the canonical ISO shape, which the reader still accepts (the carried-slot case)', () => {
    for (const t of ['Sep 1, 2026 (\u00e9)', '2026-09-01T16:00:00Z', '2026-09-01T16:00:00.000+00:00', '2026-09-01T16:00:00.000z']) {
      expect(Number.isFinite(Date.parse(t))).toBe(true) // non-vacuity: the reader accepts it
      const read = validateKeyRecord(record({ ebird: keyEntry({ changedAt: t }) }), NOW)
      expect(read.ok && read.slots.ebird?.state).toBe('key')
      expect(sanitizeKeyEntryForWrite({ state: 'key', value: SENTINEL, changedAt: t, origin: { deviceId: PEER, label: 'iPhone', platform: 'iphone' } }, 'iPhone', NOW)).toBeNull()
      expect(sanitizeKeyEntryForWrite({ state: 'cleared', clearedAt: t, origin: { deviceId: PEER, label: 'iPhone', platform: 'iphone' } }, 'iPhone', NOW)).toBeNull()
    }
    expect(isWritableTime('Sep 1, 2026 (\u00e9)', NOW)).toBe(false)
    expect(isWritableTime('2026-08-31T01:48:00.000Z', NOW)).toBe(true)
  })

  it('a cleared marker keeps its time; an empty label takes the fallback', () => {
    const clean = sanitizeKeyEntryForWrite({ state: 'cleared', clearedAt: '2026-09-01T15:40:00.000Z', origin: { deviceId: PEER, label: '', platform: 'iphone' } }, 'iPhone', NOW)
    expect(clean).toEqual({ state: 'cleared', clearedAt: '2026-09-01T15:40:00.000Z', origin: { deviceId: PEER, label: 'iPhone', platform: 'iphone' } })
  })

  it('round-trips: sanitize -> serialize -> validate yields the same entries, and is idempotent', () => {
    const raw: SharedKeyEntry = { state: 'key', value: SENTINEL, changedAt: '2026-08-31T01:48:00.000Z', origin: { deviceId: ME, label: 'x'.repeat(100), platform: 'mac' } }
    const once = sanitizeKeyEntryForWrite(raw, 'Mac', NOW)!
    const twice = sanitizeKeyEntryForWrite(once, 'Mac', NOW)!
    expect(twice).toEqual(once)
    const text = serializeKeyRecord({ ebird: once, openweather: sanitizeKeyEntryForWrite({ state: 'cleared', clearedAt: '2026-09-01T15:40:00.000Z', origin: { deviceId: PEER, label: 'iPhone', platform: 'iphone' } }, 'iPhone', NOW) })
    expect(text.length).toBeLessThan(MAX_RECORD_TEXT)
    const v = validateKeyRecord(text, NOW)
    expect(v.ok).toBe(true)
    if (!v.ok) return
    expect(v.rejected).toEqual({})
    expect(v.slots.ebird).toEqual(once)
    expect(serializeKeyRecord(v.slots)).toBe(text)
  })
})

describe('serializeKeyRecord and the golden', () => {
  it("emits the native writer's exact key order and omits an absent slot", () => {
    const text = serializeKeyRecord({ openweather: { state: 'cleared', clearedAt: '2026-09-01T15:40:00.000Z', origin: { deviceId: PEER, label: 'iPhone', platform: 'iphone' } } })
    expect(text).toBe('{"version":1,"kind":"keys","slots":{"openweather":{"state":"cleared","clearedAt":"2026-09-01T15:40:00.000Z","origin":{"deviceId":"' + PEER + '","label":"iPhone","platform":"iphone"}}}}')
    expect(serializeKeyRecord({})).toBe('{"version":1,"kind":"keys","slots":{}}')
    expect(serializeKeyRecord({ ebird: null })).toBe('{"version":1,"kind":"keys","slots":{}}')
  })

  it('the golden string validates and re-serializes to itself', () => {
    const v = validateKeyRecord(KEY_RECORD_GOLDEN, NOW)
    expect(v.ok).toBe(true)
    if (!v.ok) return
    expect(v.slots.ebird?.state).toBe('key')
    expect(v.slots.openweather?.state).toBe('cleared')
    expect(serializeKeyRecord(v.slots)).toBe(KEY_RECORD_GOLDEN)
  })

  it("keyEntryTimeMs reads the entry's own instant", () => {
    expect(keyEntryTimeMs({ state: 'key', value: 'x', changedAt: '2026-08-31T01:48:00.000Z', origin: { deviceId: ME, label: 'Mac', platform: 'mac' } })).toBe(Date.parse('2026-08-31T01:48:00.000Z'))
    expect(keyEntryTimeMs({ state: 'cleared', clearedAt: '2026-09-01T15:40:00.000Z', origin: { deviceId: ME, label: 'Mac', platform: 'mac' } })).toBe(Date.parse('2026-09-01T15:40:00.000Z'))
  })
})
