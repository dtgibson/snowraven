// @vitest-environment jsdom
// hotspot-links-retry-after-429: the COMPOSED twin of hotspotSet.test.ts. That suite
// mocks ./transport wholesale, so it structurally cannot see the gate, and it was green
// over this bug. Here the transport (WebTransport under CachedTransport), the shared
// eBird gate, the network cache, hotspotSet and useHotspotSet are all REAL; only fetch
// and the loaded backup are faked. Fake timers: every assertion is a request COUNT or
// a rendered state after advancing the clock, never elapsed wall time.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, act } from '@testing-library/react'
import { useHotspotSet } from './useHotspotSet'
import { HotspotLink, hotspotLinkAriaLabel } from '../components/HotspotLink'
import {
  loadHotspotSet, invalidateHotspotSet, subscribeHotspotSet, getHotspotResolution,
  HOTSPOT_RETRY_ROUNDS, hotspotRetryDelayMs,
} from './hotspotSet'
import { _resetHotspotRegionCacheForTests, _flushHotspotRegionWriteForTests, HOTSPOT_REGIONS_STORE_KEY } from './hotspotRegionCache'
import { _resetEbirdGateForTests, ebirdGateState } from './ebirdGate'
import { clearNetworkCache } from './networkCache'
import { ACTIVITY_RATE_LIMIT_RETRIES } from './rateLimit'

const H = vi.hoisted(() => ({ regions: ['US-CA'] as string[], settings: new Map<string, unknown>() }))
// The persisted per-region store (hotspot-share-stat) reads and writes a settings
// document. An in-memory seam, so persistence rows can read it back and no row
// depends on the fetch stub rejecting the settings route by accident.
vi.mock('./storage', () => ({
  storage: {
    getSetting: async (k: string) => (H.settings.has(k) ? JSON.parse(JSON.stringify(H.settings.get(k))) as unknown : null),
    setSetting: async (k: string, v: unknown) => { H.settings.set(k, JSON.parse(JSON.stringify(v)) as unknown) },
    deleteSetting: async (k: string) => { H.settings.delete(k) },
  },
}))
vi.mock('./observationsCache', () => ({
  loadEbirdObservations: async () => ({
    headerLine: '',
    observations: H.regions.map(stateProvince => ({ stateProvince })),
  }),
}))

/** Requests per attempt the gate allows one lookup: the first plus its 429 retries. */
const PER_ATTEMPT = 1 + ACTIVITY_RATE_LIMIT_RETRIES

let calls: Array<{ region: string; at: number }> = []
let answer: (region: string, nth: number) => 'limited' | string[] = () => []

function installFetch() {
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    const u = new URL(url, 'http://snowraven.test')
    if (u.pathname !== '/map/hotspot-region') throw new Error(`unexpected request ${url}`)
    const region = u.searchParams.get('regionCode') ?? ''
    const nth = calls.filter(c => c.region === region).length + 1
    calls.push({ region, at: Date.now() })
    const a = answer(region, nth)
    if (a === 'limited') {
      return {
        ok: false, status: 429,
        headers: { get: (n: string) => (n === 'Retry-After' ? '1' : null) },
        json: async () => ({ detail: 'eBird is limiting requests right now. Try again in a moment.' }),
      }
    }
    return { ok: true, status: 200, headers: { get: () => null }, json: async () => a }
  }))
}

const callsFor = (region: string) => calls.filter(c => c.region === region).length

/** Advance the clock inside act, then let the arrival's reload settle. */
async function advance(ms: number) {
  await act(async () => { await vi.advanceTimersByTimeAsync(ms) })
  for (let i = 0; i < 3; i++) await act(async () => { await vi.advanceTimersByTimeAsync(0) })
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] })
  _resetEbirdGateForTests()
  clearNetworkCache()
  invalidateHotspotSet() // drop any Set (and any pending re-ask) an earlier row left
  // ...and the persisted answers: without this a region one row stored would answer
  // the next row with no request.
  _resetHotspotRegionCacheForTests()
  H.settings.clear()
  calls = []
  installFetch()
})

afterEach(() => {
  cleanup()
  invalidateHotspotSet()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

function Probe() {
  const { isHotspot } = useHotspotSet()
  return <HotspotLink locId="L1" name="Arrowhead Marsh" isHotspot={isHotspot('L1')} />
}

describe('a region that ran out of 429 retries (hotspot-links-retry-after-429)', () => {
  it('is asked again after the cooldown, alone, and its link appears on a mounted tab with no key or file save', async () => {
    H.regions = ['US-CA', 'US-MN']
    answer = (region, nth) =>
      region === 'US-MN' ? ['L7'] : nth <= PER_ATTEMPT ? 'limited' : ['L1', 'L2']
    const notified = vi.fn()
    const unsubscribe = subscribeHotspotSet(notified)
    render(<Probe />)
    const link = () => screen.queryByRole('link', { name: hotspotLinkAriaLabel('Arrowhead Marsh') })

    await advance(5_000) // the build: the gate's retries all spent, far short of round 1
    expect(callsFor('US-CA')).toBe(PER_ATTEMPT)
    expect(callsFor('US-MN')).toBe(1)
    expect(link()).toBeNull()
    expect(screen.getByText('Arrowhead Marsh')).toBeTruthy()
    const cooldownEnd = ebirdGateState().cooldownUntil
    const buildEnd = Math.max(...calls.map(c => c.at))

    await advance(buildEnd + hotspotRetryDelayMs(1) - 1 - Date.now())
    expect(callsFor('US-CA')).toBe(PER_ATTEMPT) // round 1 has not asked yet
    await advance(1_000)
    expect(callsFor('US-CA')).toBe(PER_ATTEMPT + 1) // round 1: one request, answered
    expect(calls[calls.length - 1].at).toBeGreaterThanOrEqual(cooldownEnd)
    // No extra request for the region that answered: a round asks only the
    // still-limited regions (pinned in hotspotSet.test.ts), and US-MN's answer is
    // in the persisted store besides (the route left the 90 s network cache).
    expect(callsFor('US-MN')).toBe(1)
    expect(notified).toHaveBeenCalledTimes(1)
    expect(link()).not.toBeNull()

    await advance(hotspotRetryDelayMs(HOTSPOT_RETRY_ROUNDS + 1) * 2)
    expect(calls).toHaveLength(PER_ATTEMPT + 2) // nothing further once it answered
    unsubscribe()
  })

  it(`stops after ${HOTSPOT_RETRY_ROUNDS} rounds at the stated request count when eBird keeps refusing, with no timer left`, async () => {
    H.regions = ['US-CA']
    answer = () => 'limited'
    const first = loadHotspotSet()
    await vi.advanceTimersByTimeAsync(5_000)
    expect((await first).size).toBe(0)
    expect(callsFor('US-CA')).toBe(PER_ATTEMPT)
    for (let round = 1; round <= HOTSPOT_RETRY_ROUNDS; round++) {
      await vi.advanceTimersByTimeAsync(hotspotRetryDelayMs(round) + 5_000)
      expect(callsFor('US-CA'), `after round ${round}`).toBe(PER_ATTEMPT * (round + 1))
    }
    expect(vi.getTimerCount()).toBe(0)
    await vi.advanceTimersByTimeAsync(hotspotRetryDelayMs(HOTSPOT_RETRY_ROUNDS + 1) * 4)
    expect(callsFor('US-CA')).toBe(PER_ATTEMPT * (1 + HOTSPOT_RETRY_ROUNDS))
    expect((await loadHotspotSet()).size).toBe(0) // the bound spent, the region stays plain
  })
})

// hotspot-share-stat: the epoch events persistence adds, and the request counts it
// changes, through the same real transport, gate and hook. A round that settles a
// region WITHOUT adding ids is an event the rows above cannot see, and a stored
// answer is a request that never happens.
describe('the persisted per-region answer, through the real transport and gate', () => {
  const doc = () => H.settings.get(HOTSPOT_REGIONS_STORE_KEY) as
    { entries: Record<string, { ids: string[]; fetchedAt: number }>; order: string[] } | undefined
  const seed = (entries: Record<string, { ids: string[]; fetchedAt: number }>) =>
    H.settings.set(HOTSPOT_REGIONS_STORE_KEY, { version: 1, entries, order: Object.keys(entries) })

  it('a round that answers with an EMPTY list announces once and persists the empty entry', async () => {
    H.regions = ['US-CA']
    answer = (_region, nth) => (nth <= PER_ATTEMPT ? 'limited' : [])
    const notified = vi.fn()
    const unsubscribe = subscribeHotspotSet(notified)
    const first = loadHotspotSet()
    await vi.advanceTimersByTimeAsync(5_000)
    await first
    expect(getHotspotResolution().byRegion.get('US-CA')).toBe('pending')
    expect(notified).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(hotspotRetryDelayMs(1) + 5_000)
    expect(callsFor('US-CA')).toBe(PER_ATTEMPT + 1)
    expect(getHotspotResolution().byRegion.get('US-CA')).toBe('answered')
    expect(notified).toHaveBeenCalledTimes(1)
    _flushHotspotRegionWriteForTests()
    expect(doc()?.entries['US-CA'].ids).toEqual([])
    unsubscribe()
  })

  it('the final round still refused announces once (the region becomes unanswered) and persists nothing', async () => {
    H.regions = ['US-CA']
    answer = () => 'limited'
    const notified = vi.fn()
    const unsubscribe = subscribeHotspotSet(notified)
    const first = loadHotspotSet()
    await vi.advanceTimersByTimeAsync(5_000)
    await first
    for (let round = 1; round <= HOTSPOT_RETRY_ROUNDS; round++) {
      await vi.advanceTimersByTimeAsync(hotspotRetryDelayMs(round) + 5_000)
      expect(notified, `after round ${round}`).toHaveBeenCalledTimes(round < HOTSPOT_RETRY_ROUNDS ? 0 : 1)
    }
    expect(getHotspotResolution().byRegion.get('US-CA')).toBe('unanswered')
    _flushHotspotRegionWriteForTests()
    expect(doc()).toBeUndefined()
    unsubscribe()
  })

  it('a warm launch issues ZERO requests and the link renders from the stored answer (QA-36)', async () => {
    H.regions = ['US-CA', 'US-MN']
    seed({ 'US-CA': { ids: ['L1'], fetchedAt: Date.now() }, 'US-MN': { ids: ['L7'], fetchedAt: Date.now() } })
    render(<Probe />)
    await advance(5_000)
    expect(calls).toHaveLength(0)
    expect(screen.queryByRole('link', { name: hotspotLinkAriaLabel('Arrowhead Marsh') })).not.toBeNull()
  })

  it('a due region is refreshed with one attempt, its stored link shows before it lands, and a 429 on it joins the rounds while it reads answered (QA-40, QA-42)', async () => {
    H.regions = ['US-CA']
    seed({ 'US-CA': { ids: ['L1'], fetchedAt: Date.now() - 31 * 24 * 60 * 60 * 1000 } })
    answer = (_region, nth) => (nth <= PER_ATTEMPT ? 'limited' : ['L1', 'L2'])
    const link = () => screen.queryByRole('link', { name: hotspotLinkAriaLabel('Arrowhead Marsh') })
    render(<Probe />)
    await advance(0)
    expect(link()).not.toBeNull() // from the stored list, before the refresh answers
    await advance(5_000)
    expect(callsFor('US-CA')).toBe(PER_ATTEMPT) // the refresh: one attempt, its retries spent
    expect(getHotspotResolution().byRegion.get('US-CA')).toBe('answered')
    expect(link()).not.toBeNull()
    await advance(hotspotRetryDelayMs(1) + 5_000)
    expect(callsFor('US-CA')).toBe(PER_ATTEMPT + 1) // round 1 asked the refresh again
    _flushHotspotRegionWriteForTests()
    expect(doc()?.entries['US-CA'].ids).toEqual(['L1', 'L2'])
    await advance(hotspotRetryDelayMs(HOTSPOT_RETRY_ROUNDS + 1) * 2)
    expect(callsFor('US-CA')).toBe(PER_ATTEMPT + 1) // nothing further
  })
})
