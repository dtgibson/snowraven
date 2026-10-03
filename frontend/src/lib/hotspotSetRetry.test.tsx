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
  loadHotspotSet, invalidateHotspotSet, subscribeHotspotSet,
  HOTSPOT_RETRY_ROUNDS, hotspotRetryDelayMs,
} from './hotspotSet'
import { _resetEbirdGateForTests, ebirdGateState } from './ebirdGate'
import { clearNetworkCache } from './networkCache'
import { ACTIVITY_RATE_LIMIT_RETRIES } from './rateLimit'

const H = vi.hoisted(() => ({ regions: ['US-CA'] as string[] }))
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
    // No extra request for the region that answered. Which regions a round asks is
    // pinned in hotspotSet.test.ts: here its reply is still in the 90 s network cache.
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
