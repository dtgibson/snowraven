import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { ObservationEntry } from '../types'

// Mock the two seams hotspotSet depends on. The transport mock lets us assert the
// per-region fetch + union; the observationsCache mock drives loadHotspotSet.
const getMock = vi.fn()
vi.mock('./transport', () => ({ transport: { get: (...a: unknown[]) => getMock(...a) } }))
const loadObsMock = vi.fn()
vi.mock('./observationsCache', () => ({ loadEbirdObservations: () => loadObsMock() }))

// Import AFTER the mocks are registered. Re-imported fresh per test (resetModules)
// so the module-level getHotspotSet cache doesn't leak across cases.
async function fresh() {
  vi.resetModules()
  return import('./hotspotSet')
}

function obs(stateProvince: string): ObservationEntry {
  return { stateProvince } as ObservationEntry
}

beforeEach(() => {
  getMock.mockReset()
  loadObsMock.mockReset()
})

describe('regionsFromObservations', () => {
  it('returns distinct valid region codes, sorted', async () => {
    const { regionsFromObservations } = await fresh()
    const regions = regionsFromObservations([obs('US-CA'), obs('US-MN'), obs('US-CA'), obs('US-AK')])
    expect(regions).toEqual(['US-AK', 'US-CA', 'US-MN'])
  })

  it('drops empty / malformed codes', async () => {
    const { regionsFromObservations } = await fresh()
    const regions = regionsFromObservations([
      obs(''), obs('lowercase'), obs('US-CA'), obs('Somewhere'), obs('US'),
    ])
    // 'US' (country) and 'US-CA' (subnational1) both match REGION_RE; junk is dropped.
    expect(regions).toEqual(['US', 'US-CA'])
  })
})

describe('isPublicHotspot', () => {
  it('is true only for a shape-valid id present in the set', async () => {
    const { isPublicHotspot } = await fresh()
    const set = new Set(['L123', 'L456'])
    expect(isPublicHotspot('L123', set)).toBe(true)
    expect(isPublicHotspot('L999', set)).toBe(false) // valid shape, not in set
    expect(isPublicHotspot('S123', set)).toBe(false) // wrong shape (checklist id)
    expect(isPublicHotspot('', set)).toBe(false)
    expect(isPublicHotspot(null, set)).toBe(false)
    expect(isPublicHotspot(undefined, set)).toBe(false)
  })
})

describe('buildHotspotSet', () => {
  it('fetches once per region and unions the results', async () => {
    const { buildHotspotSet } = await fresh()
    getMock.mockImplementation((_path: string, params: { regionCode: string }) =>
      Promise.resolve(params.regionCode === 'US-CA' ? ['L1', 'L2'] : ['L2', 'L3']))
    const set = await buildHotspotSet([obs('US-CA'), obs('US-MN')])
    expect(getMock).toHaveBeenCalledTimes(2)
    expect(getMock).toHaveBeenCalledWith('/map/hotspot-region', { regionCode: 'US-CA' })
    expect(getMock).toHaveBeenCalledWith('/map/hotspot-region', { regionCode: 'US-MN' })
    expect([...set].sort()).toEqual(['L1', 'L2', 'L3'])
  })

  it('degrades to an empty contribution when a region fetch fails', async () => {
    const { buildHotspotSet } = await fresh()
    getMock.mockImplementation((_path: string, params: { regionCode: string }) =>
      params.regionCode === 'US-CA' ? Promise.resolve(['L1']) : Promise.reject(new Error('502')))
    const set = await buildHotspotSet([obs('US-CA'), obs('US-MN')])
    expect([...set]).toEqual(['L1']) // the failing region simply contributes nothing
  })
})

describe('getHotspotSet caching', () => {
  it('builds once per region list and reuses the promise', async () => {
    const { getHotspotSet } = await fresh()
    getMock.mockResolvedValue(['L1'])
    const a = getHotspotSet([obs('US-CA')])
    const b = getHotspotSet([obs('US-CA')])
    expect(a).toBe(b) // same cached promise
    await a
    expect(getMock).toHaveBeenCalledTimes(1) // one region, one fetch
  })

  it('returns an empty set (no fetch) when there are no regions', async () => {
    const { getHotspotSet } = await fresh()
    const set = await getHotspotSet([obs('')])
    expect(set.size).toBe(0)
    expect(getMock).not.toHaveBeenCalled()
  })

  it('rebuilds (new promise, refetch) when the region list changes', async () => {
    const { getHotspotSet } = await fresh()
    getMock.mockResolvedValue(['L1'])
    const a = getHotspotSet([obs('US-CA')])
    const b = getHotspotSet([obs('US-MN')]) // different region → stale promise discarded
    expect(a).not.toBe(b)
    await Promise.all([a, b])
    expect(getMock).toHaveBeenCalledTimes(2)
    expect(getMock).toHaveBeenLastCalledWith('/map/hotspot-region', { regionCode: 'US-MN' })
  })
})

describe('invalidateHotspotSet', () => {
  it('bumps the epoch and notifies (only) current subscribers', async () => {
    const { invalidateHotspotSet, subscribeHotspotSet, getHotspotSetEpoch } = await fresh()
    const before = getHotspotSetEpoch()
    const cb = vi.fn()
    const unsub = subscribeHotspotSet(cb)
    invalidateHotspotSet()
    expect(getHotspotSetEpoch()).toBe(before + 1)
    expect(cb).toHaveBeenCalledTimes(1)
    unsub()
    invalidateHotspotSet()
    expect(getHotspotSetEpoch()).toBe(before + 2)
    expect(cb).toHaveBeenCalledTimes(1) // not notified after unsubscribe
  })

  it('forces a refetch for the SAME regions after invalidation (the key-added / outage-recovery case)', async () => {
    const { getHotspotSet, invalidateHotspotSet } = await fresh()
    // First build degrades to empty (e.g. no eBird key yet → region fetch fails).
    getMock.mockResolvedValueOnce([]).mockResolvedValueOnce(['L1', 'L2'])
    const first = await getHotspotSet([obs('US-CA')])
    expect(first.size).toBe(0)
    // User adds their key → Settings calls invalidateHotspotSet → same regions rebuild.
    invalidateHotspotSet()
    const second = await getHotspotSet([obs('US-CA')])
    expect([...second].sort()).toEqual(['L1', 'L2'])
    expect(getMock).toHaveBeenCalledTimes(2)
  })
})

describe('loadHotspotSet', () => {
  it('builds the set from the cached backup', async () => {
    const { loadHotspotSet } = await fresh()
    loadObsMock.mockResolvedValue({ headerLine: '', observations: [obs('US-CA')] })
    getMock.mockResolvedValue(['L1', 'L2'])
    const set = await loadHotspotSet()
    expect([...set].sort()).toEqual(['L1', 'L2'])
  })

  it('returns an empty set when no backup is stored', async () => {
    const { loadHotspotSet } = await fresh()
    loadObsMock.mockResolvedValue(null)
    const set = await loadHotspotSet()
    expect(set.size).toBe(0)
    expect(getMock).not.toHaveBeenCalled()
  })
})
