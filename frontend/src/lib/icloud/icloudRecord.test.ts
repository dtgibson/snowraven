// icloud-sync FR-37/FR-38 (QA-34, QA-35): the shared-record validator treats
// every malformed, oversized, out-of-range, path-bearing, control-character
// and future-dated record as ABSENT (null), never throws, and a valid record
// round-trips through serializeRecord. The reconcile table has no row that
// deletes a local copy for a null record (icloudReconcile.test.ts asserts
// that side), so "absent" is the safe verdict by construction.

import { describe, it, expect } from 'vitest'
import {
  parseSharedRecord,
  validateSharedRecord,
  serializeRecord,
  recordTimeMs,
  sanitizeLabel,
  sanitizeFilename,
  truncateUnits,
  MAX_BYTES,
  MAX_FILENAME,
  MAX_LABEL,
  MAX_RECORD_TEXT,
  MAX_FUTURE_MS,
  type SharedRecord,
} from './icloudRecord'

const NOW = Date.parse('2026-09-01T16:00:00.000Z')
const DEVICE = 'a'.repeat(32)
const SHA = 'b'.repeat(64)

function fileRecord(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    version: 1,
    slot: 'ebird',
    state: 'file',
    filename: 'MyEBirdData.csv',
    uploadedAt: '2026-08-24T22:12:00.000Z',
    origin: { deviceId: DEVICE, label: "Dave's Mac", platform: 'mac' },
    byteLength: 6_000_000,
    sha256: SHA,
    ...overrides,
  }
}

function clearedRecord(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    version: 1,
    slot: 'ml',
    state: 'cleared',
    clearedAt: '2026-08-30T10:00:00.000Z',
    origin: { deviceId: DEVICE, label: 'iPhone', platform: 'iphone' },
    ...overrides,
  }
}

const j = (v: unknown) => JSON.stringify(v)

describe('parseSharedRecord: valid records', () => {
  it('accepts a file record and round-trips it through serializeRecord', () => {
    const rec = parseSharedRecord(j(fileRecord()), 'ebird', NOW)
    expect(rec).not.toBeNull()
    expect(rec?.state).toBe('file')
    const again = parseSharedRecord(serializeRecord(rec as SharedRecord), 'ebird', NOW)
    expect(again).toEqual(rec)
    expect(recordTimeMs(rec as SharedRecord)).toBe(Date.parse('2026-08-24T22:12:00.000Z'))
  })

  it('accepts a cleared record and round-trips it', () => {
    const rec = parseSharedRecord(j(clearedRecord()), 'ml', NOW)
    expect(rec?.state).toBe('cleared')
    expect(parseSharedRecord(serializeRecord(rec as SharedRecord), 'ml', NOW)).toEqual(rec)
  })

  it('ignores unknown keys (the native writer may only grow)', () => {
    const rec = parseSharedRecord(j(fileRecord({ future: 'field', nested: { x: 1 } })), 'ebird', NOW)
    expect(rec?.state).toBe('file')
    expect(rec).not.toHaveProperty('future')
  })

  it('accepts the bounds exactly: 255-code-unit filename, 64-code-unit label, 200 MB', () => {
    const rec = parseSharedRecord(
      j(fileRecord({
        filename: 'x'.repeat(MAX_FILENAME - 4) + '.csv',
        origin: { deviceId: DEVICE, label: 'y'.repeat(MAX_LABEL), platform: 'ipad' },
        byteLength: MAX_BYTES,
      })),
      'ebird',
      NOW,
    )
    expect(rec?.state).toBe('file')
  })

  it('a plain long filename displays verbatim (QA-35: display only, never a path)', () => {
    const name = 'A very long export name with spaces and (parens) and unicode: ptarmigan.csv'
    const rec = parseSharedRecord(j(fileRecord({ filename: name })), 'ebird', NOW)
    expect(rec?.state === 'file' && rec.filename).toBe(name)
  })

  it('accepts a time up to a day in the future (clock skew, OQ-4)', () => {
    const t = new Date(NOW + MAX_FUTURE_MS - 1000).toISOString()
    expect(parseSharedRecord(j(fileRecord({ uploadedAt: t })), 'ebird', NOW)?.state).toBe('file')
  })
})

describe('parseSharedRecord: rejections (each returns null, names its rule, never throws)', () => {
  const rejected: Array<[string, unknown, string]> = [
    ['null text', null, 'absent'],
    ['undefined text', undefined, 'absent'],
    ['empty string', '', 'malformed-json'],
    ['not JSON', '{not json', 'malformed-json'],
    ['a JSON number', '42', 'not-an-object'],
    ['a JSON array', '[]', 'not-an-object'],
    ['a JSON null', 'null', 'not-an-object'],
    ['oversized text', ' '.repeat(MAX_RECORD_TEXT + 1) + '{}', 'oversized'],
    ['wrong version', j(fileRecord({ version: 2 })), 'version'],
    ['unknown slot', j(fileRecord({ slot: 'keys' })), 'slot'],
    ['the other slot', j(fileRecord({ slot: 'ml' })), 'wrong-slot'],
    ['unknown state', j(fileRecord({ state: 'merged' })), 'state'],
    ['origin missing', j(fileRecord({ origin: undefined })), 'origin'],
    ['origin device id not 32 hex', j(fileRecord({ origin: { deviceId: 'ABC', label: 'Mac', platform: 'mac' } })), 'origin'],
    ['origin device id uppercase hex', j(fileRecord({ origin: { deviceId: 'A'.repeat(32), label: 'Mac', platform: 'mac' } })), 'origin'],
    ['origin label empty', j(fileRecord({ origin: { deviceId: DEVICE, label: '', platform: 'mac' } })), 'origin'],
    ['origin label over 64', j(fileRecord({ origin: { deviceId: DEVICE, label: 'z'.repeat(MAX_LABEL + 1), platform: 'mac' } })), 'origin'],
    ['origin label with a control character', j(fileRecord({ origin: { deviceId: DEVICE, label: 'Dave\u0007s Mac', platform: 'mac' } })), 'origin'],
    ['origin label with a newline', j(fileRecord({ origin: { deviceId: DEVICE, label: 'Dave\nMac', platform: 'mac' } })), 'origin'],
    ['origin platform unknown', j(fileRecord({ origin: { deviceId: DEVICE, label: 'Mac', platform: 'windows' } })), 'origin'],
    ['filename with a forward slash (traversal)', j(fileRecord({ filename: '../x.csv' })), 'filename'],
    ['filename with a backslash', j(fileRecord({ filename: '..\\x.csv' })), 'filename'],
    ['filename with an absolute path', j(fileRecord({ filename: '/etc/passwd' })), 'filename'],
    ['filename with NUL', j(fileRecord({ filename: 'a\u0000.csv' })), 'filename'],
    ['filename with a C1 control', j(fileRecord({ filename: 'a\u0085.csv' })), 'filename'],
    ['filename empty', j(fileRecord({ filename: '' })), 'filename'],
    ['filename over 255', j(fileRecord({ filename: 'x'.repeat(MAX_FILENAME + 1) })), 'filename'],
    ['filename not a string', j(fileRecord({ filename: 7 })), 'filename'],
    ['uploadedAt unparseable', j(fileRecord({ uploadedAt: 'yesterday' })), 'uploadedAt'],
    ['uploadedAt before 2000', j(fileRecord({ uploadedAt: '1999-12-31T23:59:59.999Z' })), 'uploadedAt'],
    ['uploadedAt more than a day in the future', j(fileRecord({ uploadedAt: new Date(NOW + MAX_FUTURE_MS + 1000).toISOString() })), 'uploadedAt'],
    ['uploadedAt a number', j(fileRecord({ uploadedAt: NOW })), 'uploadedAt'],
    ['uploadedAt absurdly long', j(fileRecord({ uploadedAt: '2026-08-24T22:12:00.000Z' + ' '.repeat(100) })), 'uploadedAt'],
    ['byteLength zero', j(fileRecord({ byteLength: 0 })), 'byteLength'],
    ['byteLength negative', j(fileRecord({ byteLength: -1 })), 'byteLength'],
    ['byteLength over the bound', j(fileRecord({ byteLength: MAX_BYTES + 1 })), 'byteLength'],
    ['byteLength fractional', j(fileRecord({ byteLength: 12.5 })), 'byteLength'],
    ['byteLength a string', j(fileRecord({ byteLength: '100' })), 'byteLength'],
    ['sha256 wrong length', j(fileRecord({ sha256: 'abc' })), 'sha256'],
    ['sha256 uppercase', j(fileRecord({ sha256: 'B'.repeat(64) })), 'sha256'],
    ['cleared without clearedAt', j(clearedRecord({ clearedAt: undefined })), 'clearedAt'],
    ['cleared with a future clearedAt', j(clearedRecord({ clearedAt: new Date(NOW + MAX_FUTURE_MS + 1).toISOString() })), 'clearedAt'],
  ]

  it.each(rejected)('%s', (_label, text, reason) => {
    const slot = typeof text === 'string' && text.includes('"slot":"ml"') && !text.includes('"state":"file"') ? 'ml' : 'ebird'
    let verdict
    expect(() => { verdict = validateSharedRecord(text as string, slot, NOW) }).not.toThrow()
    expect(verdict).toEqual({ ok: false, reason })
    expect(parseSharedRecord(text as string, slot, NOW)).toBeNull()
  })

  it('a prototype-pollution probe (a real own __proto__ key from JSON) is just another invalid record', () => {
    // JSON.parse yields a genuine own property; an object literal would not.
    const text = '{"__proto__":{"polluted":true},"version":1,"slot":"ebird","state":"file"}'
    expect(() => parseSharedRecord(text, 'ebird', NOW)).not.toThrow()
    expect(parseSharedRecord(text, 'ebird', NOW)).toBeNull()
    expect(({} as { polluted?: boolean }).polluted).toBeUndefined()
  })

  it('a record whose fields are prototype-chain names is rejected, not resolved through the chain', () => {
    const text = j(fileRecord({ slot: 'constructor', state: 'toString' }))
    expect(parseSharedRecord(text, 'ebird', NOW)).toBeNull()
  })

  it('never throws on a wide hostile corpus', () => {
    const corpus: unknown[] = [
      '{}', '[]', '""', 'true', '{"version":1}', '{"version":"1"}', j({ version: 1, slot: 'ebird', state: 'file' }),
      j({ version: 1, slot: 'ebird', state: 'file', origin: null }),
      j({ version: 1, slot: 'ebird', state: 'file', origin: 'x' }),
      j({ version: 1, slot: 'ebird', state: 'file', origin: [] }),
      j(fileRecord({ origin: { deviceId: DEVICE, label: {}, platform: 'mac' } })),
      j(fileRecord({ filename: null })),
      j(fileRecord({ byteLength: Number.NaN })),
      j(fileRecord({ byteLength: Infinity })),
      '\u0000', '\uFEFF{}', 'undefined', 'NaN',
    ]
    for (const text of corpus) {
      expect(() => parseSharedRecord(text as string, 'ebird', NOW)).not.toThrow()
      expect(parseSharedRecord(text as string, 'ebird', NOW)).toBeNull()
    }
  })
})

describe('the write-side sanitizers produce what the validator accepts (security round, Finding 3)', () => {
  it('a label with control characters, or over 64 units, sanitizes to a valid origin label', () => {
    expect(sanitizeLabel('Dave\u0007s Mac', 'Mac')).toBe('Daves Mac')
    expect(sanitizeLabel('Dave\nMac\u0085', 'Mac')).toBe('DaveMac')
    expect(sanitizeLabel('\u0001\u0002', 'iPhone')).toBe('iPhone')
    expect(sanitizeLabel('   ', 'iPad')).toBe('iPad')
    expect(sanitizeLabel('x'.repeat(100), 'Mac').length).toBe(MAX_LABEL)
    // A surrogate pair is dropped, never split.
    const edge = 'y'.repeat(63) + '\u{1F426}'
    const out = sanitizeLabel(edge, 'Mac')
    expect(out.length).toBe(63)
    expect(out).not.toContain('\uFFFD')
    for (const label of ['Dave\u0007s Mac', 'x'.repeat(100), edge, '\u007f']) {
      const rec = parseSharedRecord(j(fileRecord({ origin: { deviceId: DEVICE, label: sanitizeLabel(label, 'Mac'), platform: 'mac' } })), 'ebird', NOW)
      expect(rec).not.toBeNull()
    }
  })

  it('a filename with controls or separators, or over 255 units, sanitizes to a valid filename', () => {
    expect(sanitizeFilename('../x.csv')).toBe('..x.csv')
    expect(sanitizeFilename('..\\x.csv')).toBe('..x.csv')
    expect(sanitizeFilename('a\u0000.csv')).toBe('a.csv')
    expect(sanitizeFilename('\u007f')).toBe('export.csv')
    expect(sanitizeFilename('n'.repeat(300) + '.csv').length).toBe(MAX_FILENAME)
    for (const name of ['../x.csv', 'a\u0000.csv', 'n'.repeat(300), 'My\tData.csv']) {
      expect(parseSharedRecord(j(fileRecord({ filename: sanitizeFilename(name) })), 'ebird', NOW)).not.toBeNull()
    }
  })

  it('truncateUnits counts UTF-16 code units and never halves a pair', () => {
    expect(truncateUnits('abc', 2)).toBe('ab')
    expect(truncateUnits('a\u{1F426}b', 2)).toBe('a')
    expect(truncateUnits('a\u{1F426}b', 3)).toBe('a\u{1F426}')
  })
})
