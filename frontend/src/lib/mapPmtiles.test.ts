import { describe, it, expect, vi, beforeEach } from 'vitest'

// mapPmtiles registers protocols at module-eval (calls maplibre addProtocol) and
// builds pmtiles archives, so mock all three external surfaces before import.
// vi.hoisted keeps the shared mock fns accessible from the hoisted vi.mock factories.
const { addProtocol, getZxy, readRegionBytes } = vi.hoisted(() => ({
  addProtocol: vi.fn(),
  getZxy: vi.fn(),
  readRegionBytes: vi.fn(),
}))
vi.mock('maplibre-gl', () => ({ addProtocol }))
vi.mock('pmtiles', () => ({
  PMTiles: class {
    source: unknown
    constructor(source: unknown) { this.source = source }
    getZxy = getZxy
  },
  Protocol: class { tile = vi.fn() },
}))
vi.mock('./storage', () => ({ storage: { readRegionBytes } }))

import { srpmTilesUrl, srpmTile, RegionSource, ensureMapProtocols } from './mapPmtiles'
import type { RequestParameters } from 'maplibre-gl'

beforeEach(() => {
  getZxy.mockReset()
  readRegionBytes.mockReset()
})

function req(url: string): RequestParameters {
  return { url } as RequestParameters
}

describe('srpmTilesUrl', () => {
  it('builds the local-region tiles URL with the regionId + tile tokens', () => {
    expect(srpmTilesUrl('us-ca-marin')).toBe('srpm://us-ca-marin/{z}/{x}/{y}')
  })
})

describe('protocol registration (NFR-08, module-eval singleton)', () => {
  it('registered both pmtiles + srpm once, and a further call is a no-op', () => {
    // The module-eval ensureMapProtocols() already ran on import.
    const schemes = addProtocol.mock.calls.map((c) => c[0])
    expect(schemes).toContain('pmtiles')
    expect(schemes).toContain('srpm')
    const before = addProtocol.mock.calls.length
    ensureMapProtocols()
    expect(addProtocol.mock.calls.length).toBe(before) // idempotent
  })
})

describe('srpmTile loader (OQ-09 local range-read handoff)', () => {
  it('parses srpm://<id>/<z>/<x>/<y> and returns the tile bytes', async () => {
    const tileBytes = new Uint8Array([1, 2, 3]).buffer
    getZxy.mockResolvedValue({ data: tileBytes, cacheControl: 'cc', expires: 'ex' })
    const res = await srpmTile(req('srpm://us-ca-marin/14/2620/6332'), new AbortController())
    expect(getZxy).toHaveBeenCalledWith(14, 2620, 6332, expect.anything())
    expect(Array.from(res.data)).toEqual([1, 2, 3])
    expect(res.cacheControl).toBe('cc')
    expect(res.expires).toBe('ex')
  })

  it('returns EMPTY bytes for a missing tile (overzoom / sparse — FR-17, not an error)', async () => {
    getZxy.mockResolvedValue(undefined)
    const res = await srpmTile(req('srpm://r/14/1/1'), new AbortController())
    expect(res.data.length).toBe(0)
  })

  it('throws on a non-srpm / malformed URL', async () => {
    await expect(srpmTile(req('pmtiles://x/1/1/1'), new AbortController())).rejects.toThrow(/Invalid srpm/)
  })

  it('decodes the regionId from the URL before looking up the archive', async () => {
    getZxy.mockResolvedValue({ data: new Uint8Array().buffer })
    await srpmTile(req(`${srpmTilesUrl('us-ca-marin').replace('{z}/{x}/{y}', '3/1/2')}`), new AbortController())
    expect(getZxy).toHaveBeenCalledWith(3, 1, 2, expect.anything())
  })
})

describe('RegionSource (pmtiles Source over the storage seam)', () => {
  it('getKey is the regionId', () => {
    expect(new RegionSource('us-ca-marin').getKey()).toBe('us-ca-marin')
  })

  it('getBytes does a TRUE range read (offset+length) through the seam', async () => {
    const buf = new Uint8Array([9, 9, 9]).buffer
    readRegionBytes.mockResolvedValue(buf)
    const res = await new RegionSource('us-ca-marin').getBytes(100, 50)
    expect(readRegionBytes).toHaveBeenCalledWith('us-ca-marin', 100, 50)
    expect(res.data).toBe(buf)
  })

  it('getBytes rejects an already-aborted read (FR-15 cancel)', async () => {
    const ctrl = new AbortController()
    ctrl.abort()
    await expect(new RegionSource('r').getBytes(0, 10, ctrl.signal)).rejects.toThrow()
    expect(readRegionBytes).not.toHaveBeenCalled()
  })
})
