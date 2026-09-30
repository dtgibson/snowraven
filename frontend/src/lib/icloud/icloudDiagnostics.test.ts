// The "Copy iCloud details" report builder (icloud-bar-chart-sync
// decisions.md entry 20). Its main input is a payload the REAL native
// collector produced over a temporary directory (`icloudDiagnostics.fixture.json`,
// captured from `icloud.rs`'s scan test, whose JSON shape that test pins to
// this file), so the shape asserted here is the one the device will send.

import { describe, it, expect, beforeEach } from 'vitest'
import fixture from './icloudDiagnostics.fixture.json'
import { buildICloudReport, clean, MAX_REPORT_CHARS, TRUNCATED_NOTE, type DetailsInput } from './icloudDiagnostics'
import { getICloudState, resetICloudState, setBarChartView, setICloudState, setSlotView } from './icloudState'

const ME = 'a'.repeat(32)

function input(over: Partial<DetailsInput> = {}): DetailsInput {
  return {
    generatedAt: '2026-09-29T21:04:11.123Z',
    native: fixture,
    nativeError: null,
    state: getICloudState(),
    pref: {
      enabled: true,
      pendingCountyClears: { 'US-CA-002': '2026-09-29T20:00:00.000Z' },
      knownSharedCounties: { 'US-CA-001': { filename: 'known-secret.txt' } },
    },
    manifest: {
      version: 1,
      counties: {
        'US-CA-001': {
          filename: 'manifest-secret.txt',
          uploadedAt: '2026-09-29T12:00:00.000Z',
          origin: { deviceId: ME, label: "Dave's iPad", platform: 'ipad' },
        },
      },
    },
    controller: { checksRun: 12, uploadRechecks: 3, checkPending: true, checkInFlight: false, checkQueued: false, repairedCounties: ['US-CA-001'] },
    ...over,
  }
}

beforeEach(() => {
  resetICloudState()
  setICloudState({
    availability: 'available',
    syncEnabled: true,
    deviceId: ME,
    deviceLabel: "Dave's iPad",
    platform: 'ipad',
    lastCheckAt: '2026-09-29T21:00:00.000Z',
    sharedFilenames: ['MyEBirdData-secret.csv'],
  })
  setBarChartView('US-CA-001', { state: 'waiting-to-upload', fromThisDevice: true })
  setSlotView('ebird', { state: 'up-to-date', fromThisDevice: false, origin: { label: "Dave's iPhone", platform: 'iphone' } })
})

describe('the report over a payload from the real collector', () => {
  it('names the app, the account, each county and every entry the scan found', () => {
    const r = buildICloudReport(input())
    const has = (line: string) => expect(r, line).toContain(line)
    has('SnowRaven iCloud details')
    has('SnowRaven 1.0.40 (bundle 1.0.40, build 1.0.40.5) on ipad')
    has("Device name: Dave's iPad")
    has(`Device id (random, this app's own): ${ME}`)
    has('Availability: available. Account token present: yes. Container resolves: yes. Build can use iCloud: yes.')
    has('Checks this session: 12. Follow-up re-reads in a row: 3. Last check left something on its way: yes.')
    has('Counties whose file was written again this session: US-CA-001.')
    // Per county: the union of this device's view, the manifest, the markers,
    // the container and the log.
    has('Bar-chart counties (3)')
    has("    This device's view: waiting-to-upload, from this device")
    has(`    Local manifest: uploaded 2026-09-29T12:00:00.000Z, from Dave's iPad (ipad) [${ME}]`)
    has('    Pending removal marker: 2026-09-29T20:00:00.000Z. Known as a shared file: no.')
    has('    In iCloud, file: placeholder, uploaded -, status -')
    has('    In iCloud, record: file, 349 bytes, uploaded -, status -; record: file from Dave\'s iPad (ipad) [' + 'b'.repeat(32) + '], uploaded 2026-09-29T12:00:00.000Z, 11 bytes')
    has('    Last push: 2026-09-29T12:00:02.000Z unavailable.')
    // The log, oldest first, with the step and the Apple codes a write met.
    has('2026-09-29T12:00:01.000Z write US-CA-001.txt: unavailable (coordinated rename (NSCocoaErrorDomain 512 / NSPOSIXErrorDomain 1))')
    // The container: control item, the folder, a twin, placeholders, a symlink,
    // unrecognized names, a duplicate folder, staging, day-obs.
    has('    ebird-backup.csv: file, 26 bytes, modified')
    has("    This device's view of it: up-to-date, from Dave's iPhone (iphone)")
    has('  barcharts folder: folder')
    has('    US-CA-001 2.txt (twin): file, 11 bytes')
    has('    US-CA-002.txt: placeholder, -, modified')
    has('    US-CA-003.txt: symlink, -, modified -')
    has('      resource values: not read')
    has('    Unrecognized entries: notes.txt (file, 1 byte')
    has('    barcharts 2 (duplicate-folder): folder')
    has('  Staging entries: 1 in all, 1 for bar charts: ' + 'a'.repeat(32) + '-barcharts-US-CA-001.txt (file, 6 bytes')
    has('  day-obs folder: folder')
    has('    US-CA-001.txt: file, 11 bytes, modified')
    has('    Other entries: 1')
    expect(r.length).toBeLessThan(MAX_REPORT_CHARS)
  })

  it('carries nothing outside the allowed fields: no filename the user chose, no digest, no key, no contents', () => {
    // Sentinels at every level of the payload the builder does not name, and
    // in the state, the preference and the manifest.
    const hostile = JSON.parse(JSON.stringify(fixture)) as Record<string, unknown>
    hostile.apiKey = 'SENTINEL-TOP'
    hostile.__proto__polluted = 'SENTINEL-PROTO'
    const scan = hostile.scan as Record<string, unknown>
    const container = scan.container as Record<string, unknown>
    const barcharts = container.barcharts as Record<string, unknown>
    const items = barcharts.items as Record<string, unknown>[]
    items[1].filename = 'SENTINEL-FILENAME'
    items[1].sha256 = 'SENTINEL-DIGEST'
    items[1].contents = 'SENTINEL-CONTENTS'
    ;(items[1].values as Record<string, unknown>).secret = 'SENTINEL-VALUES'
    ;(items[1].record as Record<string, unknown>).filename = 'SENTINEL-RECORD-FILENAME'
    ;(items[1].record as Record<string, unknown>).sha256 = 'SENTINEL-RECORD-DIGEST'
    ;(container.control as Record<string, unknown>[])[1].recordText = 'SENTINEL-RECORD-TEXT'
    const r = buildICloudReport(input({ native: hostile }))
    for (const s of [
      'SENTINEL', 'known-secret', 'manifest-secret', 'MyEBirdData-secret', 'MyEBirdData', 'secret-name',
      '3f79bb7b435b05321651daefd374cdc681dc06faa65e374e38337b88ca046dea',
    ]) {
      expect(r, s).not.toContain(s)
    }
    // A key-shaped value anywhere in the state never reaches it either.
    setICloudState({ keySyncEnabled: true })
    expect(buildICloudReport(input({ native: hostile }))).not.toContain('SENTINEL')
  })

  it('reads inherited names as absent, never as members', () => {
    const polluted = JSON.parse('{"__proto__":{"appVersion":"SENTINEL"},"constructor":"SENTINEL","ops":[{"op":"toString","target":"__proto__","result":"ok","atMs":0,"count":1}]}')
    const r = buildICloudReport(input({ native: polluted }))
    expect(r).not.toContain('SENTINEL')
    expect(r).toContain('SnowRaven - (bundle -, build -) on -')
    expect(r).not.toContain('[object Object]')
    expect(r).not.toContain('function')
  })
})

describe('bounds and hostile input', () => {
  it('is at most MAX_REPORT_CHARS, cut at a line boundary, whatever the payload holds', () => {
    const long = 'x'.repeat(100_000)
    const item = { name: long, role: 'file', onDisk: 'file', size: 1, modifiedMs: 0, values: { uploadError: { domain: long, code: 1, description: long, underlying: { domain: long, code: 2, description: long, underlying: { domain: 'deeper', code: 3, description: 'SENTINEL-DEPTH' } } } }, record: null }
    const huge = {
      appVersion: long,
      ops: Array.from({ length: 5000 }, (_, i) => ({ atMs: i, op: long, target: long, result: long, detail: long, count: 1 })),
      lastOps: Array.from({ length: 5000 }, (_, i) => ({ county: `US-CA-${String(i % 1000).padStart(3, '0')}`, push: { atMs: 0, result: long } })),
      scan: { container: { barcharts: { items: Array.from({ length: 5000 }, () => item), other: Array.from({ length: 5000 }, () => ({ name: long })) } } },
    }
    const counties = Object.fromEntries(Array.from({ length: 900 }, (_, i) => [`US-TX-${String(i).padStart(3, '0')}`, '2026-09-29T20:00:00.000Z']))
    const r = buildICloudReport(input({ native: huge, pref: { enabled: true, pendingCountyClears: counties } }))
    expect(r.length).toBeLessThanOrEqual(MAX_REPORT_CHARS)
    expect(r.endsWith(`\n${TRUNCATED_NOTE}`)).toBe(true)
    // Every string was bounded on its own, and the error chain stops at one
    // underlying level.
    for (const line of r.split('\n')) expect(line.length).toBeLessThan(1400)
    expect(r).not.toContain('SENTINEL-DEPTH')
    // A report that fits is never cut.
    expect(buildICloudReport(input())).not.toContain(TRUNCATED_NOTE)
  })

  it('strips control characters, separators and bidirectional overrides, and never splits a surrogate pair', () => {
    const nasty = {
      appVersion: '1.0\u0007.40\u202e',
      deviceLabel: 'Dave\u2028s\niPad\u200f',
      ops: [{ atMs: 0, op: 'write', target: 'US-CA-001.txt\r\nFAKE LINE', result: 'ok', detail: null, count: 1 }],
    }
    const r = buildICloudReport(input({ native: nasty }))
    expect(r).toContain('SnowRaven 1.0.40')
    expect(r).toContain('Device name: DavesiPad')
    expect(r).toContain('write US-CA-001.txtFAKE LINE: ok')
    for (const ch of ['\r', '\u0007', '\u2028', '\u200f', '\u202e']) expect(r.includes(ch), JSON.stringify(ch)).toBe(false)
    expect(clean('ab\u{1F426}cd', 3)).toBe('ab')
    expect(clean('\u{1F426}', 1)).toBe('')
    expect(clean('\u0000 x \u009f', 10)).toBe('x')
  })

  it('names a native layer that failed, and one this build does not have, and never throws on garbage', () => {
    expect(buildICloudReport(input({ native: null, nativeError: 'timeout' }))).toContain('Native details could not be read in full: timeout.')
    expect(buildICloudReport(input({ native: { scanError: 'timeout', ops: [] } }))).toContain('Native details could not be read in full: timeout.')
    const none = buildICloudReport(input({ native: null }))
    expect(none).toContain('Native details are not available on this build.')
    expect(none).toContain("Platform: ipad. Device name: Dave's iPad")
    for (const garbage of ['text', 42, [1, 2], { scan: 'x', ops: 'y', lastOps: [null, 3, 'z'] }, { scan: { container: { barcharts: { items: [null, 'a', { name: 5 }] } } } }]) {
      expect(() => buildICloudReport(input({ native: garbage }))).not.toThrow()
    }
    expect(buildICloudReport(input({ manifest: null }))).toContain('Local manifest: could not be read')
  })
})
