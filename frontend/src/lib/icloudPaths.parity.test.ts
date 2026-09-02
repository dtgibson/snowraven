// icloud-sync parity (schema.md "Tests"): the two csv filenames, the data
// directory, the container id, the record field names and the error strings
// live in BOTH src-tauri/src/icloud.rs and the frontend. Source-grep both
// sides (the cacheInventory style) so a rename on one side fails here rather
// than as a silent "local-missing" on a device.
/// <reference types="node" />
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { ISO_TIME_LEN, ISO_TIME_RE, MAX_FUTURE_MS, MIN_TIME, isWritableTime } from './icloud/icloudRecord'

const rust = readFileSync(new URL('../../../src-tauri/src/icloud.rs', import.meta.url), 'utf8')
const storage = readFileSync(new URL('./storage.ts', import.meta.url), 'utf8')
const native = readFileSync(new URL('./icloud/icloudNative.ts', import.meta.url), 'utf8')
const record = readFileSync(new URL('./icloud/icloudRecord.ts', import.meta.url), 'utf8')
const keyRecord = readFileSync(new URL('./icloud/keyRecord.ts', import.meta.url), 'utf8')
const types = readFileSync(new URL('./icloud/icloudNativeTypes.ts', import.meta.url), 'utf8')
const libRs = readFileSync(new URL('../../../src-tauri/src/lib.rs', import.meta.url), 'utf8')

function rustConst(name: string): string {
  const m = new RegExp(`const ${name}: &str = "([^"]+)";`).exec(rust)
  if (!m) throw new Error(`icloud.rs: const ${name} not found`)
  return m[1]
}

describe('icloud.rs <-> frontend constants', () => {
  it('the container id is one string on both sides', () => {
    const id = rustConst('ICLOUD_CONTAINER_ID')
    expect(id).toBe('iCloud.com.dtgibson.snowraven')
    expect(native).toContain(`export const ICLOUD_CONTAINER_ID = '${id}'`)
  })

  it('the csv filenames and data directory match storage.ts FILE_PATHS', () => {
    const ebird = rustConst('LOCAL_EBIRD_FILE')
    const ml = rustConst('LOCAL_ML_FILE')
    const dir = rustConst('LOCAL_DATA_DIR')
    expect(storage).toContain(`const DATA_DIR = '${dir}'`)
    expect(storage).toContain(`ebird: \`\${DATA_DIR}/${ebird}\``)
    expect(storage).toContain(`ml: \`\${DATA_DIR}/${ml}\``)
    expect(native).toContain(`ebird: '${ebird}'`)
    expect(native).toContain(`ml: '${ml}'`)
  })

  it('the shared record field names the native writer emits are the ones the validator reads', () => {
    // RecordFile is camelCase via serde; the validator reads these keys.
    for (const key of ['version', 'slot', 'state', 'filename', 'uploaded_at', 'cleared_at', 'origin', 'byte_length', 'sha256']) {
      expect(rust).toMatch(new RegExp(`\\b${key}\\b`))
    }
    expect(rust).toContain('#[serde(rename_all = "camelCase")]\nstruct RecordFile')
    for (const key of ['uploadedAt', 'clearedAt', 'byteLength', 'sha256', 'filename', 'origin', 'version', 'slot', 'state']) {
      expect(record).toContain(`raw.${key}`)
    }
    expect(rust).toContain('pub struct Origin')
    for (const key of ['device_id', 'label', 'platform']) expect(rust).toContain(`pub ${key}: String`)
  })

  it('every native error string is a member of the closed frontend union', () => {
    const errors = new Set([...rust.matchAll(/"(timeout|not-downloaded|mismatch|absent|local-missing|too-large|unavailable|unknown)"\.to_string\(\)/g)].map(m => m[1]))
    // Every `Err("...")` literal in the file, key commands included, is in that set.
    const every = new Set([...rust.matchAll(/Err\("([^"]+)"\.to_string\(\)\)/g)].map(m => m[1]))
    for (const e of every) expect(['timeout', 'not-downloaded', 'mismatch', 'absent', 'local-missing', 'too-large', 'unavailable', 'unknown']).toContain(e)
    expect(errors.size).toBeGreaterThan(4)
    for (const e of errors) expect(types).toContain(`'${e}'`)
    // And the states the status command reports are the ones the store knows.
    for (const s of ['available', 'not-signed-in', 'drive-off-or-unauthorized', 'build-cannot-use-icloud']) {
      expect(rust).toContain(`"${s}"`)
      expect(types).toContain(`'${s}'`)
    }
  })

  it('the seven commands and two events exist on both sides and are registered under the Apple cfg', () => {
    const commands = ['icloud_status', 'icloud_read_record', 'icloud_push', 'icloud_push_cleared', 'icloud_pull', 'icloud_start_download', 'icloud_remove_all', 'icloud_watch']
    for (const c of commands) {
      expect(rust).toContain(`pub async fn ${c}(`)
      expect(native).toContain(`'${c}'`)
      expect(libRs).toContain(`icloud::${c},`)
    }
    expect(libRs).toContain('#[cfg(any(target_os = "macos", target_os = "ios"))]\nmod icloud;')
    for (const ev of ['icloud-changed', 'icloud-identity-changed']) {
      expect(rust).toContain(`"${ev}"`)
      expect(native).toContain(`'${ev}'`)
    }
  })

  it('the size bound is the same number natively and in the validator', () => {
    expect(rust).toContain('const MAX_BYTES: u64 = 200_000_000;')
    expect(record).toContain('export const MAX_BYTES = 200_000_000')
  })

  it('the write-side string bounds and the device-id shape are the same on both sides (security round)', () => {
    expect(rust).toContain('const MAX_LABEL_UNITS: usize = 64;')
    expect(rust).toContain('const MAX_FILENAME_UNITS: usize = 255;')
    expect(record).toContain('export const MAX_LABEL = 64')
    expect(record).toContain('export const MAX_FILENAME = 255')
    expect(record).toContain('export const DEVICE_ID_RE = /^[0-9a-f]{32}$/')
    expect(rust).toContain('fn valid_device_id(id: &str) -> bool')
    expect(rust).toContain("id.len() == 32 && id.bytes().all(|b| b.is_ascii_digit() || (b'a'..=b'f').contains(&b))")
    // Both sanitizers exist, and both are applied at their write chokepoints.
    expect(rust).toContain('fn sanitize_label(')
    expect(rust).toContain('fn sanitize_filename(')
    expect(record).toContain('export function sanitizeLabel(')
    expect(record).toContain('export function sanitizeFilename(')
  })
})

// ── icloud-api-key-sync: the key record's name, bounds, commands and golden ──

describe('icloud.rs <-> keyRecord.ts (icloud-api-key-sync)', () => {
  it('the key record name is one constant on both sides, and is not a slot record name', () => {
    const name = rustConst('KEYS_RECORD_NAME')
    expect(name).toBe('keys.record.json')
    expect(keyRecord).toContain(`export const KEYS_RECORD_NAME = '${name}'`)
    expect(native).toContain("export { KEYS_RECORD_NAME } from './keyRecord'")
    // The Slot enum is untouched: no shipped command can be pointed at the key record.
    expect(rust).toContain('pub enum Slot {\n    Ebird,\n    Ml,\n}')
  })

  it('the key value bounds are equal on both sides: 1..128 units, 0x21..0x7E', () => {
    expect(rust).toContain('const MAX_KEY_VALUE_LEN: usize = 128;')
    expect(rust).toContain('const KEY_CHAR_MIN: u8 = 0x21;')
    expect(rust).toContain('const KEY_CHAR_MAX: u8 = 0x7E;')
    expect(keyRecord).toContain('export const MAX_KEY_VALUE = 128')
    expect(keyRecord).toContain('export const KEY_CHAR_MIN = 0x21')
    expect(keyRecord).toContain('export const KEY_CHAR_MAX = 0x7e')
    expect(record).toContain('export const MAX_TIME_TEXT = 64')
    // Both chokepoints exist: the TypeScript one refuses (null), the Rust one refuses (Err), and both take the clock.
    expect(keyRecord).toContain('export function sanitizeKeyEntryForWrite(entry: SharedKeyEntry, fallbackLabel: string, nowMs: number): SharedKeyEntry | null')
    expect(keyRecord).toContain('export function isValidKeyValue(')
    expect(rust).toContain('fn sanitize_key_entry(input: KeyEntryInput, now_ms: i64) -> Result<KeyEntryFile, String>')
    expect(rust).toContain('fn valid_key_value(v: &str) -> bool')
  })

  // Security fix round, Findings 1 and 2: the write-chokepoint rule covers
  // TIME. The reader's window is applied on write, the writer's shape is
  // applied on the TypeScript side too, and the two predicates accept
  // exactly the same set: the constants, the signatures, the call sites and
  // a shared fixture table (spelled in both test files) are all pinned here.
  describe('the writers\' time predicate is one predicate on both sides', () => {
    it('the shape and window constants are equal', () => {
      expect(ISO_TIME_LEN).toBe(24)
      expect(String(ISO_TIME_RE)).toBe('/^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\\.[0-9]{3}Z$/')
      expect(MIN_TIME).toBe(946_684_800_000)
      expect(MAX_FUTURE_MS).toBe(86_400_000)
      expect(rust).toContain('const ISO_TIME_LEN: usize = 24;')
      expect(rust).toContain('const MIN_TIME_MS: i64 = 946_684_800_000;')
      expect(rust).toContain('const MAX_FUTURE_MS: i64 = 86_400_000;')
      expect(rust).toContain('fn valid_time_text(t: &str, now_ms: i64) -> bool')
      expect(rust).toContain('fn parse_iso_time_ms(t: &str) -> Option<i64>')
      expect(rust).toContain('ms >= MIN_TIME_MS && ms <= now_ms + MAX_FUTURE_MS')
      expect(record).toContain('return t >= MIN_TIME && t <= nowMs + MAX_FUTURE_MS')
    })

    it('both chokepoints apply it to changedAt and clearedAt, and the Rust writer reads its clock once per write', () => {
      expect(keyRecord).toContain('if (!isWritableTime(entry.changedAt, nowMs)) return null')
      expect(keyRecord).toContain('if (!isWritableTime(entry.clearedAt, nowMs)) return null')
      expect(rust).toContain('if !valid_time_text(&changed_at, now_ms)')
      expect(rust).toContain('if !valid_time_text(&cleared_at, now_ms)')
      const write = rust.slice(rust.indexOf('pub async fn icloud_write_keys('), rust.indexOf('pub async fn icloud_remove_keys('))
      expect(write).toContain('let now_ms = unix_now_ms();')
      expect(write).toContain('sanitize_key_entry(e, now_ms)')
    })

    it('the fixture table gives the same verdict through isWritableTime as the Rust test spells for valid_time_text', () => {
      // NOW is 2026-09-01T16:00:00.000Z on both sides (NOW_MS in icloud.rs).
      const NOW = 1_788_278_400_000
      expect(Date.parse('2026-09-01T16:00:00.000Z')).toBe(NOW)
      const rows: Array<[string, boolean]> = [
        ['2026-09-01T16:00:00.000Z', true],
        ['2000-01-01T00:00:00.000Z', true],
        ['2024-02-29T12:34:56.789Z', true],
        ['2026-09-02T16:00:00.000Z', true],
        ['2026-09-02T16:00:00.001Z', false],
        ['1999-12-31T23:59:59.999Z', false],
        ['2026-09-01T16:00:00Z', false],
        ['2026-09-01T16:00:00.000+00:00', false],
        ['2026-09-01T16:00:00.000z', false],
        ['2026-09-01T16:00:00.0000Z', false],
        ['2026-09-01T16:00:00.000Z\n', false],
        [' 2026-09-01T16:00:00.000Z', false],
        ['2026-02-30T00:00:00.000Z', false],
        ['2100-02-29T00:00:00.000Z', false],
        ['2026-09-01T24:00:00.000Z', false],
        ['2026-13-01T00:00:00.000Z', false],
        ['2026-09-01T16:00:60.000Z', false],
        ['Sep 1, 2026 (\u00e9)', false],
        ['', false],
      ]
      const fixture = rust.slice(rust.indexOf('fn writable_times_agree_with_the_frontend_fixture()'), rust.indexOf('fn a_key_entry_with_an_implausible_time_is_refused'))
      expect(fixture.length).toBeGreaterThan(0)
      for (const [t, ok] of rows) {
        expect(isWritableTime(t, NOW), JSON.stringify(t)).toBe(ok)
        expect(fixture).toContain(`("${t.replace('\n', '\\n')}", ${ok})`)
      }
      // Every row the Rust table spells is in this table too (the same count, so neither side can grow alone).
      expect([...fixture.matchAll(/\("[^"]*", (?:true|false)\)/g)]).toHaveLength(rows.length)
      // Non-vacuity: a row the reader accepts and the writer refuses is in the table.
      expect(Number.isFinite(Date.parse('Sep 1, 2026 (\u00e9)'))).toBe(true)
    })
  })

  it('the three key commands exist on both sides and are registered under the Apple cfg', () => {
    for (const c of ['icloud_read_keys', 'icloud_write_keys', 'icloud_remove_keys']) {
      expect(rust).toContain(`pub async fn ${c}(`)
      expect(native).toContain(`'${c}'`)
      expect(libRs).toContain(`#[cfg(any(target_os = "macos", target_os = "ios"))]\n            icloud::${c},`)
    }
    for (const w of ['readKeys', 'writeKeys', 'removeKeys']) {
      expect(types).toContain(`${w}(`)
      expect(native).toContain(`${w}:`)
    }
    // Remove all never names the key record (FR-35), and remove keys never names a csv or slot record.
    const removeAll = rust.slice(rust.indexOf('pub async fn icloud_remove_all('), rust.indexOf('// ── icloud-api-key-sync: the key record commands'))
    expect(removeAll).not.toContain('KEYS_RECORD_NAME')
    const removeKeys = rust.slice(rust.indexOf('pub async fn icloud_remove_keys('), rust.indexOf('// ── Change detection'))
    expect(removeKeys).not.toContain('csv_name')
    expect(removeKeys).not.toContain('record_name()')
  })

  it('the key record field names the native writer emits are the ones validateKeyRecord reads', () => {
    expect(rust).toContain('#[serde(rename_all = "camelCase")]\nstruct KeyEntryFile')
    expect(rust).toContain('#[serde(rename_all = "camelCase")]\nstruct KeyRecordFile')
    for (const key of ['version', 'kind', 'slots', 'state', 'value', 'changed_at', 'cleared_at', 'origin']) {
      expect(rust).toMatch(new RegExp(`\\b${key}\\b`))
    }
    for (const key of ['version', 'kind', 'slots', 'state', 'value', 'changedAt', 'clearedAt', 'origin']) {
      expect(keyRecord).toContain(`raw.${key}`)
    }
    // The structs that carry the value derive no Debug (it must never be
    // formatted): the derive attribute directly above each is the evidence.
    const deriveAbove = (decl: string) => {
      const at = rust.indexOf(decl)
      expect(at).toBeGreaterThan(0)
      const before = rust.slice(0, at)
      const derives = [...before.matchAll(/#\[derive\(([^)]*)\)\]/g)]
      return derives[derives.length - 1][1]
    }
    expect(deriveAbove('pub struct KeyEntryInput')).not.toContain('Debug')
    expect(deriveAbove('struct KeyEntryFile')).not.toContain('Debug')
    // And a control: the file-record struct beside them does derive it.
    expect(deriveAbove('struct RecordFile')).toContain('Debug')
  })

  it('the Rust golden literal equals the TypeScript KEY_RECORD_GOLDEN byte for byte', () => {
    const m = /const KEY_RECORD_GOLDEN: &str = r#"(.*)"#;/.exec(rust)
    expect(m).not.toBeNull()
    const ts = /export const KEY_RECORD_GOLDEN =\n((?:\s*\+?\s*'[^\n]*'\n?)+)/.exec(keyRecord)
    expect(ts).not.toBeNull()
    // Evaluate the concatenation the TS source spells out.
    const parts = [...ts![1].matchAll(/'((?:[^'\\]|\\.)*)'/g)].map(x => x[1].replace(/\\'/g, "'"))
    expect(parts.join('')).toBe(m![1])
  })
})
