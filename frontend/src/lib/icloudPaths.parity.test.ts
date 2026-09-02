// icloud-sync parity (schema.md "Tests"): the two csv filenames, the data
// directory, the container id, the record field names and the error strings
// live in BOTH src-tauri/src/icloud.rs and the frontend. Source-grep both
// sides (the cacheInventory style) so a rename on one side fails here rather
// than as a silent "local-missing" on a device.
/// <reference types="node" />
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const rust = readFileSync(new URL('../../../src-tauri/src/icloud.rs', import.meta.url), 'utf8')
const storage = readFileSync(new URL('./storage.ts', import.meta.url), 'utf8')
const native = readFileSync(new URL('./icloud/icloudNative.ts', import.meta.url), 'utf8')
const record = readFileSync(new URL('./icloud/icloudRecord.ts', import.meta.url), 'utf8')
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
