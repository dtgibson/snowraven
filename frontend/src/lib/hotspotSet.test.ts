import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
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

// hotspot-links-retry-after-429. The transport is mocked here, so each region costs
// exactly one call per attempt (the gate's own retries sit below it); the composed twin,
// hotspotSetRetry.test.tsx, runs the real transport and gate for the arrival and the
// request-count bound. These rows pin what is this module's alone: which failures are
// re-asked, and that a superseded build's re-ask never asks or never lands.
describe('re-asking a rate-limited region', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] })
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  const err = (status: number) => Object.assign(new Error(`Transport error: ${status}`), { status })
  const callsFor = (region: string) =>
    getMock.mock.calls.filter(c => (c[1] as { regionCode: string }).regionCode === region).length
  async function pastEveryRound(hs: Awaited<ReturnType<typeof fresh>>) {
    for (let round = 1; round <= hs.HOTSPOT_RETRY_ROUNDS + 1; round++) {
      await vi.advanceTimersByTimeAsync(hs.hotspotRetryDelayMs(round))
    }
  }

  it.each([
    ['a 5xx', () => err(502)],
    ['a missing or bad key (401)', () => err(401)],
    ['an offline failure', () => new TypeError('Failed to fetch')],
  ])('%s is not re-asked: the region stays plain until a key or file save', async (_label, failure) => {
    const hs = await fresh()
    getMock.mockImplementation(() => Promise.reject(failure()))
    expect((await hs.getHotspotSet([obs('US-CA')])).size).toBe(0)
    await pastEveryRound(hs)
    expect(getMock).toHaveBeenCalledTimes(1)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('only the rate-limited region is asked again; one that answered keeps its ids and is not re-asked', async () => {
    // Pinned here rather than in the composed twin: there, the answered region's reply
    // sits in the 90 s network cache, so re-asking it inside round 1 costs no request
    // and a request count cannot see the choice. The mock sees the choice itself.
    const hs = await fresh()
    let caCalls = 0
    getMock.mockImplementation((_path: string, params: { regionCode: string }) => {
      if (params.regionCode === 'US-MN') return Promise.resolve(['L7'])
      caCalls += 1
      return caCalls === 1 ? Promise.reject(err(429)) : Promise.resolve(['L1'])
    })
    expect([...await hs.getHotspotSet([obs('US-CA'), obs('US-MN')])]).toEqual(['L7'])
    await pastEveryRound(hs)
    expect(callsFor('US-CA')).toBe(2)
    expect(callsFor('US-MN')).toBe(1)
    expect([...await hs.getHotspotSet([obs('US-CA'), obs('US-MN')])].sort()).toEqual(['L1', 'L7'])
  })

  it('a genuine empty answer (200 with no hotspots) is an answer, never re-asked', async () => {
    const hs = await fresh()
    getMock.mockImplementation(() => Promise.resolve([] as string[]))
    expect((await hs.getHotspotSet([obs('US-CA')])).size).toBe(0)
    await pastEveryRound(hs)
    expect(getMock).toHaveBeenCalledTimes(1)
    expect(vi.getTimerCount()).toBe(0)
  })

  /** Both regions rate limited at build; US-CA answers ['L1'] in round 1, US-MN stays
   *  limited in round 1 and answers ['L7'] in round 2. Runs past every round. */
  async function twoRegionsAnsweringInTurn() {
    const hs = await fresh()
    const notified = vi.fn()
    hs.subscribeHotspotSet(notified)
    let ca = 0
    let mn = 0
    getMock.mockImplementation((_path: string, params: { regionCode: string }) => {
      if (params.regionCode === 'US-CA') {
        ca += 1
        return ca === 1 ? Promise.reject(err(429)) : Promise.resolve(['L1'])
      }
      mn += 1
      return mn <= 2 ? Promise.reject(err(429)) : Promise.resolve(['L7'])
    })
    expect((await hs.getHotspotSet([obs('US-CA'), obs('US-MN')])).size).toBe(0)
    await pastEveryRound(hs)
    return { hs, notified }
  }

  it('a region that answers in a re-ask round is not asked again in a later round', async () => {
    await twoRegionsAnsweringInTurn()
    expect(callsFor('US-CA')).toBe(2) // the build and round 1, never round 2
    expect(callsFor('US-MN')).toBe(3) // the build and rounds 1 and 2
    expect(vi.getTimerCount()).toBe(0)
  })

  it('ids one re-ask round added are still there after a later round adds more', async () => {
    const { hs, notified } = await twoRegionsAnsweringInTurn()
    expect([...await hs.getHotspotSet([obs('US-CA'), obs('US-MN')])].sort()).toEqual(['L1', 'L7'])
    expect(notified).toHaveBeenCalledTimes(2) // one arrival per round that added ids
  })

  it.each([
    ['a key or file save during the wait', 'wait', 'invalidate'],
    ['a new region list during the wait', 'wait', 'regions'],
    ['a key or file save while the build is still asking', 'build', 'invalidate'],
  ] as const)('%s cancels the re-ask: it never asks and leaves no timer', async (_label, when, how) => {
    const hs = await fresh()
    let rejectBuild: (e: unknown) => void = () => {}
    getMock.mockImplementation((_path: string, params: { regionCode: string }) => {
      if (params.regionCode === 'US-MN') return Promise.resolve(['L7'])
      if (when === 'build') return new Promise((_resolve, reject) => { rejectBuild = reject })
      return Promise.reject(err(429))
    })
    const supersede = () => {
      if (how === 'invalidate') hs.invalidateHotspotSet()
      else void hs.getHotspotSet([obs('US-MN')])
    }
    const first = hs.getHotspotSet([obs('US-CA')])
    if (when === 'build') {
      await vi.advanceTimersByTimeAsync(0)
      supersede()
      rejectBuild(err(429)) // the superseded build's answer lands after the save
      await first
    } else {
      await first // CA ran out of retries; round 1 is pending
      supersede()
    }
    await pastEveryRound(hs)
    expect(callsFor('US-CA')).toBe(1)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('a re-ask answer that started under an older build never lands on the newer one', async () => {
    const hs = await fresh()
    const notified = vi.fn()
    hs.subscribeHotspotSet(notified)
    let call = 0
    let releaseStale: (ids: string[]) => void = () => {}
    getMock.mockImplementation(() => {
      call += 1
      if (call === 1) return Promise.reject(err(429)) // the build: CA rate limited
      if (call === 2) return new Promise<string[]>(resolve => { releaseStale = resolve }) // round 1, held open
      return Promise.resolve(['L9']) // the newer build, after the save
    })
    await hs.getHotspotSet([obs('US-CA')])
    await vi.advanceTimersByTimeAsync(hs.hotspotRetryDelayMs(1))
    expect(getMock).toHaveBeenCalledTimes(2) // round 1 is asking
    hs.invalidateHotspotSet() // a key save while it asks
    expect([...await hs.getHotspotSet([obs('US-CA')])]).toEqual(['L9'])
    releaseStale(['L1']) // the stale answer arrives late
    await vi.advanceTimersByTimeAsync(0)
    expect([...await hs.getHotspotSet([obs('US-CA')])]).toEqual(['L9'])
    expect(notified).toHaveBeenCalledTimes(1) // the save announced; the stale answer did not
  })
})
