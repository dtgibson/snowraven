// THE TYPESCRIPT HALF OF THE TWINNED ITEM PREDICATE (icloud-bar-chart-sync
// FR-29, NFR-01, QA-25, QA-31). A county code becomes a container path, so the
// native wrapper refuses one that fails `REGION_CODE_RE` BEFORE any invoke, as
// `County::parse` refuses it in icloud.rs. Each side has its own test that
// goes red when its own check is deleted and nothing on the other side does:
// this file is the wrapper's, `county_parse_refuses_fixture_rows` is Rust's,
// and both read the one shared fixture (whose row count the parity test pins).
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'

const invoke = vi.hoisted(() => vi.fn<(cmd: string, args?: Record<string, unknown>) => Promise<unknown>>(async () => ({ sha256: 'x', byteLength: 1, uploaded: true, skipped: false })))
vi.mock('@tauri-apps/api/core', () => ({ invoke }))
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => {}) }))

import { icloudNative } from './icloud/icloudNative'
import { ICloudNativeError } from './icloud/icloudNativeTypes'

const rows = JSON.parse(readFileSync(new URL('./regionCode.fixture.json', import.meta.url), 'utf8')) as Array<{ input: string; ok: boolean }>
const ORIGIN = { deviceId: 'a'.repeat(32), label: 'Mac', platform: 'mac' as const }

beforeEach(() => invoke.mockClear())

describe('icloudNative refuses a county code that fails the shared predicate before any invoke', () => {
  it('reads the shared fixture (non-vacuity: both verdicts present)', () => {
    expect(rows.length).toBeGreaterThan(10)
    expect(rows.some(r => r.ok)).toBe(true)
    expect(rows.some(r => !r.ok)).toBe(true)
  })

  it.each(rows.map(r => [JSON.stringify(r.input), r] as const))('push, pull, download and remove: %s', async (_label, row) => {
    const item = { kind: 'barchart' as const, county: row.input }
    const calls = [
      () => icloudNative.pushItem(item, 'f.txt', '2026-09-20T12:05:00.000Z', ORIGIN, null),
      () => icloudNative.pullItem(item, '0'.repeat(64), 3, 'file'),
      () => icloudNative.startDownloadItem(item),
      () => icloudNative.removeItem(item),
    ]
    for (const call of calls) {
      invoke.mockClear()
      if (row.ok) {
        await call()
        expect(invoke).toHaveBeenCalledTimes(1)
        expect((invoke.mock.calls[0][1] as { item: unknown }).item).toEqual({ kind: 'barchart', county: row.input })
      } else {
        await expect(call()).rejects.toBeInstanceOf(ICloudNativeError)
        expect(invoke).not.toHaveBeenCalled()
      }
    }
  })

  it('a cleared-marker batch sends only the codes that pass, and reports the rest failed', async () => {
    invoke.mockImplementation(async () => ({ failed: [] }))
    const good = rows.filter(r => r.ok).map(r => r.input)
    const bad = rows.filter(r => !r.ok).map(r => r.input)
    const r = await icloudNative.pushItemsCleared([...good, ...bad], '2026-09-21T08:00:00.000Z', ORIGIN)
    expect(invoke).toHaveBeenCalledTimes(1)
    expect((invoke.mock.calls[0][1] as { counties: string[] }).counties).toEqual(good)
    expect(r.failed).toEqual(bad)
    // Every code refused: nothing is sent at all.
    invoke.mockClear()
    const none = await icloudNative.pushItemsCleared(bad, '2026-09-21T08:00:00.000Z', ORIGIN)
    expect(invoke).not.toHaveBeenCalled()
    expect(none.failed).toEqual(bad)
  })

  it('the repair digest reaches the push command by name (decisions.md entry 19), and a plain push sends it as null', async () => {
    invoke.mockImplementation(async () => ({ sha256: 'x', byteLength: 1, uploaded: true, skipped: false }))
    const item = { kind: 'barchart' as const, county: 'US-CA-001' }
    await icloudNative.pushItem(item, 'f.txt', '2026-09-20T12:05:00.000Z', ORIGIN, null, 'b'.repeat(64))
    await icloudNative.pushItem(item, 'f.txt', '2026-09-20T12:05:00.000Z', ORIGIN, null)
    expect(invoke.mock.calls.map(c => c[0])).toEqual(['icloud_push_item', 'icloud_push_item'])
    expect(invoke.mock.calls.map(c => (c[1] as { repairSha256: unknown }).repairSha256)).toEqual(['b'.repeat(64), null])
  })

  it('a day-obs item names a 32-hex device id or nothing reaches the native side', async () => {
    invoke.mockImplementation(async () => ({ removed: 0 }))
    await icloudNative.removeItem({ kind: 'day-obs', deviceId: 'f'.repeat(32) })
    expect(invoke).toHaveBeenCalledTimes(1)
    invoke.mockClear()
    for (const id of ['F'.repeat(32), 'f'.repeat(31), `${'f'.repeat(31)}/`, '../../x', `${'f'.repeat(32)}\n`]) {
      await expect(icloudNative.removeItem({ kind: 'day-obs', deviceId: id })).rejects.toBeInstanceOf(ICloudNativeError)
    }
    expect(invoke).not.toHaveBeenCalled()
  })
})
