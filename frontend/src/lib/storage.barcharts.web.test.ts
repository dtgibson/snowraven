// @vitest-environment jsdom
// The eBird bar-chart file family on the WEB/Pi adapter (targets-tab, schema.md
// section 1.3): the four methods map onto backend/routers/barcharts.py with the
// same failure shapes as the data-file slots. A non-OK status read is UNKNOWN
// (it rejects), never EMPTY; a non-OK save or delete is a failure the caller
// reports; a region code that fails the shape never leaves the page.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { storage } from './storage'

afterEach(() => vi.unstubAllGlobals())

describe('WebStorage bar-chart files', () => {
  it('reads the manifest and normalizes it', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true, status: 200,
      json: async () => ({ version: 1, counties: { 'US-CA-001': { filename: 'a.txt', uploadedAt: '2026-09-26T20:00:00Z' }, bad: { filename: 'x', uploadedAt: 'y' } } }),
    })))
    await expect(storage.getBarChartFiles()).resolves.toEqual({
      version: 1, counties: { 'US-CA-001': { filename: 'a.txt', uploadedAt: '2026-09-26T20:00:00Z' } },
    })
  })

  it.each([404, 500, 503])('rejects a %i status read rather than reporting no files (UNKNOWN)', async status => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status })))
    await expect(storage.getBarChartFiles()).rejects.toThrow(String(status))
  })

  it('posts the file as multipart to the county route and rejects a non-OK answer', async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    await storage.writeBarChartFile('US-CA-001', 'content', 'ebird_US-CA-001__1900_2026_1_12_barchart.txt')
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, { method: string; body: FormData }]
    expect(url).toBe('/settings/barcharts/US-CA-001')
    expect(init.method).toBe('POST')
    expect((init.body.get('file') as File).name).toBe('ebird_US-CA-001__1900_2026_1_12_barchart.txt')

    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 413 })))
    await expect(storage.writeBarChartFile('US-CA-001', 'content', 'a.txt')).rejects.toThrow(/413/)
  })

  it('deletes through the county route and rejects a non-OK answer', async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    await storage.deleteBarChartFile('US-CA-013')
    expect(fetchMock).toHaveBeenCalledWith('/settings/barcharts/US-CA-013', { method: 'DELETE' })
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 500 })))
    await expect(storage.deleteBarChartFile('US-CA-013')).rejects.toThrow(/500/)
  })

  it('reads a file through the county route, null when it is absent', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 404 })))
    await expect(storage.readBarChartFile('US-CA-001')).resolves.toBeNull()
  })

  it('a malformed region code never leaves the page', async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    for (const bad of ['../x', 'US-CA-001/../../keys', 'US-CA-001?x=1', 'us-ca-001']) {
      await expect(storage.writeBarChartFile(bad, 'x', 'a.txt')).rejects.toThrow(/region code/)
      await expect(storage.deleteBarChartFile(bad)).rejects.toThrow(/region code/)
      await expect(storage.readBarChartFile(bad)).resolves.toBeNull()
    }
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

// ── icloud-bar-chart-sync: the bulk removal and the unreachable sync links ──
describe('WebStorage bulk removal (schema.md 6.4)', () => {
  it('maps onto DELETE /settings/barcharts and reads the answer through the region-code shape', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true, status: 200,
      json: async () => ({ removed: ['US-CA-001', '../x', 7], failed: ['US-CA-013', 'US-CA-013\n'] }),
    }))
    vi.stubGlobal('fetch', fetchMock)
    await expect(storage.deleteAllBarChartFiles()).resolves.toEqual({ removed: ['US-CA-001'], failed: ['US-CA-013'] })
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, { method: string }]
    expect(url).toBe('/settings/barcharts')
    expect(init.method).toBe('DELETE')
  })

  it('a non-OK answer is a real failure and is raised', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 500 })))
    await expect(storage.deleteAllBarChartFiles()).rejects.toThrow(/500/)
  })

  it('the sync links reject on web/Pi rather than silently no-op (unreachable behind the platform gate)', async () => {
    await expect(storage.applySyncedBarChartFile('US-CA-001', { filename: 'a', uploadedAt: 'b' }, null, async () => {})).rejects.toThrow(/not supported/)
    await expect(storage.applySyncedBarChartClear('US-CA-001', 'b')).rejects.toThrow(/not supported/)
    await expect(storage.stampBarChartOrigin('US-CA-001', { deviceId: 'a'.repeat(32), label: 'x', platform: 'mac' }, 'b', 'b')).rejects.toThrow(/not supported/)
  })
})
