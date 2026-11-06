import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { ObservationEntry } from '../types'

// Mock the seams hotspotSet depends on. The transport mock lets us assert the
// per-region fetch + union; the observationsCache mock drives loadHotspotSet; the
// storage mock is an in-memory settings document, so the persisted per-region store
// (hotspot-share-stat) can be read back and seeded, and no row reaches a real seam.
const getMock = vi.fn()
vi.mock('./transport', () => ({ transport: { get: (...a: unknown[]) => getMock(...a) } }))
const loadObsMock = vi.fn()
vi.mock('./observationsCache', () => ({ loadEbirdObservations: () => loadObsMock() }))
const disk = vi.hoisted(() => ({ settings: new Map<string, unknown>() }))
vi.mock('./storage', () => ({
  storage: {
    getSetting: async (k: string) => (disk.settings.has(k) ? JSON.parse(JSON.stringify(disk.settings.get(k))) as unknown : null),
    setSetting: async (k: string, v: unknown) => { disk.settings.set(k, JSON.parse(JSON.stringify(v)) as unknown) },
    deleteSetting: async (k: string) => { disk.settings.delete(k) },
  },
}))

// Import AFTER the mocks are registered. Re-imported fresh per test (resetModules)
// so the module-level getHotspotSet cache, and the store's mirror, don't leak across
// cases.
async function fresh() {
  // Cancel the outgoing instance's debounced write first: its 250 ms timer would
  // otherwise fire into the NEXT row's document (the disk Map outlives the module).
  ;(await import('./hotspotRegionCache'))._resetHotspotRegionCacheForTests()
  vi.resetModules()
  return import('./hotspotSet')
}
/** A fresh hotspotSet and the SAME fresh store instance it imports. */
async function freshPair() {
  const hs = await fresh()
  const store = await import('./hotspotRegionCache')
  return { hs, store }
}

const STORE_KEY = 'hotspot-regions-v1'
type Doc = { version: 1; entries: Record<string, { ids: string[]; fetchedAt: number }>; order: string[] }
const doc = (): Doc | undefined => disk.settings.get(STORE_KEY) as Doc | undefined
/** Seed the persisted document (oldest first, in the order given). */
function seed(entries: Record<string, { ids: string[]; fetchedAt: number }>): void {
  disk.settings.set(STORE_KEY, { version: 1, entries, order: Object.keys(entries) })
}
const httpErr = (status: number) => Object.assign(new Error(`Transport error: ${status}`), { status })

function obs(stateProvince: string): ObservationEntry {
  return { stateProvince } as ObservationEntry
}

beforeEach(() => {
  getMock.mockReset()
  loadObsMock.mockReset()
  disk.settings.clear()
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

  // hotspot-share-stat replaced one row here (schema.md 11.1). It modelled "no key
  // yet" as a first build RESOLVING [], which is now an answer and is persisted, so
  // the rebuild would read it from the store with no request. Its claims are kept by
  // the two rows below: a real no-key failure (a 401, which writes nothing) still
  // forces the refetch, and a genuine empty answer is read back without one.
  it('forces a refetch for the SAME regions after invalidation when the first build FAILED (the key-added / outage-recovery case)', async () => {
    const { hs, store } = await freshPair()
    // First build fails for lack of a key: a 401 is an error, so nothing is stored.
    getMock.mockRejectedValueOnce(httpErr(401)).mockResolvedValueOnce(['L1', 'L2'])
    const first = await hs.getHotspotSet([obs('US-CA')])
    expect(first.size).toBe(0)
    store._flushHotspotRegionWriteForTests()
    expect(doc()).toBeUndefined() // QA-47: an error is never persisted
    // User adds their key -> Settings calls invalidateHotspotSet -> same regions rebuild.
    hs.invalidateHotspotSet()
    const second = await hs.getHotspotSet([obs('US-CA')])
    expect([...second].sort()).toEqual(['L1', 'L2'])
    expect(getMock).toHaveBeenCalledTimes(2)
  })

  it('a genuine empty answer is persisted, so after invalidation the rebuild reads it with no request (QA-08, QA-53)', async () => {
    const { hs, store } = await freshPair()
    getMock.mockResolvedValueOnce([])
    expect((await hs.getHotspotSet([obs('US-CA')])).size).toBe(0)
    store._flushHotspotRegionWriteForTests()
    expect(doc()?.entries['US-CA']?.ids).toEqual([])
    hs.invalidateHotspotSet()
    const second = await hs.getHotspotSet([obs('US-CA')])
    expect(second.size).toBe(0)
    expect(getMock).toHaveBeenCalledTimes(1)
    expect(hs.getHotspotResolution().byRegion.get('US-CA')).toBe('answered')
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

// hotspot-share-stat (schema.md sections 4, 9 and 10): the resolution snapshot beside
// the Set, and the persisted per-region answer behind it. Every row reads the store
// back through the mocked storage seam, so "persisted" means "in the document".
describe('the resolution snapshot and the persisted per-region answer', () => {
  const DAY = 24 * 60 * 60 * 1000
  /** A promise a test settles by hand. */
  function deferred<T>() {
    let resolve!: (v: T) => void
    const promise = new Promise<T>((res) => { resolve = res })
    return { promise, resolve }
  }
  const callsFor = (region: string) =>
    getMock.mock.calls.filter(c => (c[1] as { regionCode: string }).regionCode === region).length

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('QA-09: pending before any settle, then answered / unanswered / pending by outcome, then unanswered after the last round', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] })
    const { hs } = await freshPair()
    const ca = deferred<string[]>()
    getMock.mockImplementation((_p: string, params: { regionCode: string }) => {
      if (params.regionCode === 'US-CA') return ca.promise
      if (params.regionCode === 'US-MN') return Promise.reject(httpErr(502))
      return Promise.reject(httpErr(429)) // US-WI, every attempt
    })
    const p = hs.getHotspotSet([obs('US-CA'), obs('US-MN'), obs('US-WI')])
    const states = () => Object.fromEntries(hs.getHotspotResolution().byRegion)
    expect(states()).toEqual({ 'US-CA': 'pending', 'US-MN': 'pending', 'US-WI': 'pending' })
    ca.resolve(['L1'])
    const set = await p
    expect(states()).toEqual({ 'US-CA': 'answered', 'US-MN': 'unanswered', 'US-WI': 'pending' })
    const res = hs.getHotspotResolution()
    expect(res.set).toBe(set) // the snapshot's Set IS the one the promise resolved with
    expect([res.pending, res.answered, res.unanswered]).toEqual([1, 1, 1])
    for (let round = 1; round <= hs.HOTSPOT_RETRY_ROUNDS; round++) {
      await vi.advanceTimersByTimeAsync(hs.hotspotRetryDelayMs(round))
      expect(states()['US-WI'], `after round ${round}`).toBe(round < hs.HOTSPOT_RETRY_ROUNDS ? 'pending' : 'unanswered')
    }
  })

  it('QA-10 / QA-53: an invalidation resets only the regions with no stored entry; the rebuild reads the stored ones with no request', async () => {
    seed({ 'US-MN': { ids: ['L1', 'L2'], fetchedAt: Date.now() } })
    const { hs } = await freshPair()
    const wi = deferred<string[]>()
    getMock.mockImplementation(() => wi.promise)
    const notified = vi.fn()
    hs.subscribeHotspotSet(notified)
    const before = hs.getHotspotSetEpoch()
    void hs.getHotspotSet([obs('US-MN'), obs('US-WI')])
    await vi.waitFor(() => expect(getMock).toHaveBeenCalledTimes(1))
    // Phase 1 has run: the stored region is answered before any request settles.
    expect(hs.getHotspotResolution().byRegion.get('US-MN')).toBe('answered')
    expect(hs.getHotspotResolution().byRegion.get('US-WI')).toBe('pending')
    expect([...hs.getHotspotResolution().set].sort()).toEqual(['L1', 'L2'])

    hs.invalidateHotspotSet() // a key save
    expect(hs.getHotspotSetEpoch()).toBe(before + 1)
    expect(notified).toHaveBeenCalledTimes(1)
    expect(Object.fromEntries(hs.getHotspotResolution().byRegion)).toEqual({ 'US-MN': 'pending', 'US-WI': 'pending' })
    expect(hs.getHotspotResolution().set.size).toBe(0)

    const wi2 = deferred<string[]>()
    getMock.mockImplementation(() => wi2.promise)
    const rebuild = hs.getHotspotSet([obs('US-MN'), obs('US-WI')])
    await vi.waitFor(() => expect(getMock).toHaveBeenCalledTimes(2))
    expect(callsFor('US-MN')).toBe(0) // never asked: read from the document
    expect(hs.getHotspotResolution().byRegion.get('US-MN')).toBe('answered')
    wi2.resolve(['L9'])
    expect([...await rebuild].sort()).toEqual(['L1', 'L2', 'L9'])

    // A new backup with a different region list: the summary covers only it.
    getMock.mockResolvedValue(['L5'])
    await hs.getHotspotSet([obs('US-ND')])
    expect(hs.getHotspotResolution().regions).toEqual(['US-ND'])
  })

  it('QA-35: a first lookup is persisted with exactly its ids and a finite fetch time, an empty answer included', async () => {
    const { hs, store } = await freshPair()
    getMock.mockImplementation((_p: string, params: { regionCode: string }) =>
      Promise.resolve(params.regionCode === 'US-MN' ? ['L1', 'L2'] : []))
    await hs.getHotspotSet([obs('US-MN'), obs('US-ND')])
    store._flushHotspotRegionWriteForTests()
    const d = doc()!
    expect(d.entries['US-MN'].ids).toEqual(['L1', 'L2'])
    expect(Number.isFinite(d.entries['US-MN'].fetchedAt)).toBe(true)
    expect(d.entries['US-ND'].ids).toEqual([])
    expect([...d.order].sort()).toEqual(['US-MN', 'US-ND'])
  })

  it.each([
    ['online', true],
    ['offline', false],
  ])('QA-36: a warm launch (%s) issues zero requests and every region reads answered', async (_label, onLine) => {
    vi.stubGlobal('navigator', { onLine })
    seed({
      'US-MN': { ids: ['L1', 'L2'], fetchedAt: Date.now() - DAY },
      'US-WI': { ids: ['L7'], fetchedAt: Date.now() - DAY },
    })
    const { hs } = await freshPair()
    const set = await hs.getHotspotSet([obs('US-MN'), obs('US-WI')])
    expect(getMock).not.toHaveBeenCalled()
    expect([...set].sort()).toEqual(['L1', 'L2', 'L7'])
    expect(hs.getHotspotResolution().answered).toBe(2)
    expect(hs.getHotspotResolution().set).toBe(set)
  })

  it('QA-38: a replaced backup that adds a region asks for that region and no other', async () => {
    seed({ 'US-MN': { ids: ['L1'], fetchedAt: Date.now() } })
    const { hs } = await freshPair()
    getMock.mockResolvedValue(['L9'])
    expect([...await hs.getHotspotSet([obs('US-MN'), obs('US-WI')])].sort()).toEqual(['L1', 'L9'])
    expect(getMock).toHaveBeenCalledTimes(1)
    expect(getMock).toHaveBeenCalledWith('/map/hotspot-region', { regionCode: 'US-WI' })
  })

  it('QA-39: a replaced backup, a key save and an iCloud arrival leave the stored entries untouched', async () => {
    const t = Date.now()
    seed({ 'US-MN': { ids: ['L1'], fetchedAt: t }, 'US-WI': { ids: ['L7'], fetchedAt: t } })
    const before = JSON.stringify(doc())
    const { hs, store } = await freshPair()
    await hs.getHotspotSet([obs('US-MN')]) // the new backup names only US-MN
    hs.invalidateHotspotSet() // a key save
    await hs.getHotspotSet([obs('US-MN')])
    hs.invalidateHotspotSet() // an iCloud arrival runs the same invalidation
    await hs.getHotspotSet([obs('US-MN')])
    store._flushHotspotRegionWriteForTests()
    expect(JSON.stringify(doc())).toBe(before)
    expect(getMock).not.toHaveBeenCalled()
  })

  describe('a stored entry past its TTL (QA-40 to QA-44)', () => {
    const STALE = () => ({ 'US-MN': { ids: ['L1', 'L2'], fetchedAt: Date.now() - 31 * DAY } })

    it('QA-40: one request, and the stored ids are served (answered) before it settles', async () => {
      seed(STALE())
      const { hs } = await freshPair()
      const refresh = deferred<string[]>()
      getMock.mockImplementation(() => refresh.promise)
      const set = await hs.getHotspotSet([obs('US-MN')]) // resolves before the refresh lands
      expect([...set].sort()).toEqual(['L1', 'L2'])
      await vi.waitFor(() => expect(getMock).toHaveBeenCalledTimes(1))
      expect(hs.getHotspotResolution().byRegion.get('US-MN')).toBe('answered')
      refresh.resolve(['L1', 'L2'])
    })

    it('QA-41: a failed refresh leaves the entry byte-identical, the region answered, and asks nothing more in that build', async () => {
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] })
      seed(STALE())
      const before = JSON.stringify(doc())
      const { hs } = await freshPair()
      getMock.mockImplementation(() => Promise.reject(httpErr(502)))
      await hs.getHotspotSet([obs('US-MN')])
      for (let round = 1; round <= hs.HOTSPOT_RETRY_ROUNDS + 1; round++) {
        await vi.advanceTimersByTimeAsync(hs.hotspotRetryDelayMs(round))
      }
      expect(getMock).toHaveBeenCalledTimes(1)
      expect(JSON.stringify(doc())).toBe(before)
      expect(hs.getHotspotResolution().byRegion.get('US-MN')).toBe('answered')
      expect([...hs.getHotspotResolution().set].sort()).toEqual(['L1', 'L2'])
    })

    it('QA-42: a rate-limited refresh writes nothing, stays answered through the rounds, and a round that answers replaces the entry', async () => {
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] })
      seed(STALE())
      const before = JSON.stringify(doc())
      const { hs, store } = await freshPair()
      let n = 0
      getMock.mockImplementation(() => (++n <= 2 ? Promise.reject(httpErr(429)) : Promise.resolve(['L1', 'L9'])))
      const notified = vi.fn()
      hs.subscribeHotspotSet(notified)
      await hs.getHotspotSet([obs('US-MN')])
      await vi.advanceTimersByTimeAsync(0)
      expect(JSON.stringify(doc())).toBe(before) // no 429 body or marker anywhere
      expect(hs.getHotspotResolution().byRegion.get('US-MN')).toBe('answered')
      await vi.advanceTimersByTimeAsync(hs.hotspotRetryDelayMs(1)) // round 1: still 429
      expect(JSON.stringify(doc())).toBe(before)
      expect(hs.getHotspotResolution().byRegion.get('US-MN')).toBe('answered')
      expect(notified).not.toHaveBeenCalled()
      await vi.advanceTimersByTimeAsync(hs.hotspotRetryDelayMs(2)) // round 2: answers
      store._flushHotspotRegionWriteForTests()
      expect(doc()!.entries['US-MN'].ids).toEqual(['L1', 'L9'])
      expect(notified).toHaveBeenCalledTimes(1)
      expect(getMock).toHaveBeenCalledTimes(3)
    })

    it('QA-43: a refresh that changes the list replaces the entry with a newer fetch time and advances the epoch once', async () => {
      seed(STALE())
      const oldAt = doc()!.entries['US-MN'].fetchedAt
      const { hs, store } = await freshPair()
      getMock.mockResolvedValue(['L1', 'L9'])
      const notified = vi.fn()
      hs.subscribeHotspotSet(notified)
      await hs.getHotspotSet([obs('US-MN')])
      await vi.waitFor(() => expect(notified).toHaveBeenCalledTimes(1))
      store._flushHotspotRegionWriteForTests()
      expect(doc()!.entries['US-MN'].ids).toEqual(['L1', 'L9'])
      expect(doc()!.entries['US-MN'].fetchedAt).toBeGreaterThan(oldAt)
      expect([...hs.getHotspotResolution().set].sort()).toEqual(['L1', 'L9'])
      expect([...await hs.getHotspotSet([obs('US-MN')])].sort()).toEqual(['L1', 'L9'])
    })

    it('an identical refresh writes its new fetch time and announces nothing (schema.md 9.7)', async () => {
      seed(STALE())
      const oldAt = doc()!.entries['US-MN'].fetchedAt
      const { hs, store } = await freshPair()
      getMock.mockResolvedValue(['L2', 'L1']) // same members, in another order
      const notified = vi.fn()
      hs.subscribeHotspotSet(notified)
      await hs.getHotspotSet([obs('US-MN')])
      await vi.waitFor(() => expect(store._getHotspotRegionCacheWorkStatsForTests().puts).toBe(1))
      store._flushHotspotRegionWriteForTests()
      expect(doc()!.entries['US-MN'].fetchedAt).toBeGreaterThan(oldAt)
      expect(notified).not.toHaveBeenCalled()
    })

    it('QA-44: offline (navigator.onLine false), a stale entry is served with no request', async () => {
      vi.stubGlobal('navigator', { onLine: false })
      seed(STALE())
      const { hs } = await freshPair()
      expect([...await hs.getHotspotSet([obs('US-MN')])].sort()).toEqual(['L1', 'L2'])
      await new Promise(r => setTimeout(r, 0))
      expect(getMock).not.toHaveBeenCalled()
      expect(hs.getHotspotResolution().byRegion.get('US-MN')).toBe('answered')
    })
  })

  it('QA-45: a Clear purges the document and the mirror, and the next build asks every region again', async () => {
    seed({ 'US-MN': { ids: ['L1'], fetchedAt: Date.now() }, 'US-WI': { ids: ['L7'], fetchedAt: Date.now() } })
    const { hs, store } = await freshPair()
    await hs.getHotspotSet([obs('US-MN'), obs('US-WI')])
    expect(getMock).not.toHaveBeenCalled()
    // The clear paths' order: invalidate, then the shared teardown (schema.md 4.6).
    hs.invalidateHotspotSet()
    const { purgeDerivedOnClear } = await import('./clearDerived')
    await purgeDerivedOnClear('ebird')
    expect(doc()).toBeUndefined()
    expect(store.peekRegion('US-MN')).toBeNull()
    getMock.mockResolvedValue(['L3'])
    const pending = hs.getHotspotSet([obs('US-MN'), obs('US-WI')])
    expect(Object.fromEntries(hs.getHotspotResolution().byRegion)).toEqual({ 'US-MN': 'pending', 'US-WI': 'pending' })
    await pending
    expect(callsFor('US-MN')).toBe(1)
    expect(callsFor('US-WI')).toBe(1)
  })

  it('schema.md 7.3: an answer over the per-region bound is served for the session and not persisted; an over-long id is dropped from both', async () => {
    const { hs, store } = await freshPair()
    const big = Array.from({ length: store.HOTSPOT_IDS_PER_REGION_MAX + 1 }, (_, i) => `L${i + 1}`)
    const longId = `L${'9'.repeat(16)}`
    getMock.mockImplementation((_p: string, params: { regionCode: string }) =>
      Promise.resolve(params.regionCode === 'US' ? big : ['L1', longId]))
    const set = await hs.getHotspotSet([obs('US'), obs('US-MN')])
    expect(set.size).toBe(store.HOTSPOT_IDS_PER_REGION_MAX + 1)
    expect(set.has(longId)).toBe(false)
    store._flushHotspotRegionWriteForTests()
    expect(Object.keys(doc()!.entries)).toEqual(['US-MN'])
    expect(doc()!.entries['US-MN'].ids).toEqual(['L1'])
    // The unpersisted region is asked again on the next build; the stored one is not.
    hs.invalidateHotspotSet()
    await hs.getHotspotSet([obs('US'), obs('US-MN')])
    expect(callsFor('US')).toBe(2)
    expect(callsFor('US-MN')).toBe(1)
  })
})
