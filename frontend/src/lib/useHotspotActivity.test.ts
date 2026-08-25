// @vitest-environment jsdom
//
// The mode-3 activity controller (FR-11/FR-12/FR-14/FR-17/FR-19, NFR-05):
// pool bound ≤4, cap at 200 with in-view-first ordering (a fixture where
// proximity and in-view disagree), cache hits exempt from the cap,
// zero-request invariants (inactive / empty set / pan), the generation guard
// (a late stale response never mutates state), retry re-asking only the
// remainder, and the three-state classification.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'

const disk = vi.hoisted(() => ({ docs: new Map<string, unknown>() }))
vi.mock('./storage', () => ({
  storage: {
    getSetting: vi.fn(async (key: string) => disk.docs.get(key) ?? null),
    setSetting: vi.fn(async (key: string, value: unknown) => { disk.docs.set(key, value) }),
  },
}))

const net = vi.hoisted(() => ({
  impl: null as null | ((path: string, params?: Record<string, string>) => Promise<unknown>),
  calls: [] as { path: string; locId: string; at: number }[],
  inFlight: 0,
  maxInFlight: 0,
}))
vi.mock('./transport', () => ({
  transport: {
    get: vi.fn(async (path: string, params?: Record<string, string>) => {
      // `at` is the request-START time (fake-timer clock in the pacing suite)
      // so pacing asserts request-start timestamps, never wall clock.
      net.calls.push({ path, locId: params?.locId ?? '', at: Date.now() })
      net.inFlight += 1
      net.maxInFlight = Math.max(net.maxInFlight, net.inFlight)
      try {
        return await net.impl!(path, params)
      } finally {
        net.inFlight -= 1
      }
    }),
    post: vi.fn(),
  },
  TransportError: class TransportError extends Error {
    status: number
    detail?: string
    constructor(message: string, status: number, detail?: string) {
      super(message)
      this.status = status
      this.detail = detail
    }
  },
}))

import { useHotspotActivity, ACTIVITY_FETCH_CAP } from './useHotspotActivity'
import * as activityCache from './hotspotActivityCache'
import {
  ACTIVITY_START_SPACING_DEFAULT_MS, _setActivityStartSpacingMsForTests,
  EBIRD_RATE_LIMIT_DETAIL,
} from './rateLimit'
import type { HotspotPin } from './mapExplorerTypes'
import type { MarkerBounds } from './markersInView'

const pin = (locId: string, lat = 0, lng = 0): HotspotPin =>
  ({ kind: 'unvisited', locId, locName: locId, lat, lng })
const personal = (locId: string): HotspotPin =>
  ({ kind: 'personal', locId, locName: locId, lat: 0, lng: 0, obsCount: 1, lastVisit: '2026-01-01' })

const okPayload = (locId: string, n = 2) => ({
  locId,
  species: Array.from({ length: n }, (_, i) => ({ speciesCode: `sp${i}`, obsDt: '2026-08-24 08:00' })),
})

type HookArgs = Parameters<typeof useHotspotActivity>[0]

function renderController(initial: Partial<HookArgs> = {}) {
  const defaults: HookArgs = {
    active: true, pins: [], mapBounds: null, searchCenter: null, hasEbirdKey: true,
  }
  return renderHook((args: HookArgs) => useHotspotActivity(args), {
    initialProps: { ...defaults, ...initial },
  })
}

async function flush() {
  // The pass effect awaits the cache mirror, then pumps promise chains; a few
  // macrotask turns settle a full pass of immediate resolutions.
  await act(async () => { await new Promise(r => setTimeout(r, 0)) })
}

beforeEach(() => {
  disk.docs.clear()
  activityCache._resetHotspotActivityCacheForTests()
  net.calls.length = 0
  net.inFlight = 0
  net.maxInFlight = 0
  net.impl = async (_path, params) => okPayload(params?.locId ?? '')
  // The legacy suites exercise pool/cap/ordering/degradation contracts with
  // REAL timers and instant responses — zero the start spacing so they keep
  // doing that at full speed. The pacing suite below sets it explicitly and
  // runs on fake timers.
  _setActivityStartSpacingMsForTests(0)
})
afterEach(() => {
  activityCache._resetHotspotActivityCacheForTests()
  _setActivityStartSpacingMsForTests(ACTIVITY_START_SPACING_DEFAULT_MS)
  vi.clearAllMocks()
})

describe('zero-request invariants (FR-07 / FR-11, QA-06 / QA-10)', () => {
  it('inactive → no request in any form', async () => {
    renderController({ active: false, pins: [pin('L1'), pin('L2')] })
    await flush()
    expect(net.calls.length).toBe(0)
  })

  it('empty result set → zero requests, idle status', async () => {
    const { result } = renderController({ pins: [] })
    await flush()
    expect(net.calls.length).toBe(0)
    expect(result.current.status.phase).toBe('idle')
  })

  it('a mapBounds change alone (pan/zoom) triggers nothing — structurally', async () => {
    const { rerender } = renderController({ pins: [pin('L1')] })
    await flush()
    const before = net.calls.length
    const b1: MarkerBounds = [-1, -1, 1, 1]
    const b2: MarkerBounds = [10, 10, 20, 20]
    rerender({ active: true, pins: [pin('L1')], mapBounds: b1, searchCenter: null, hasEbirdKey: true })
    await flush()
    rerender({ active: true, pins: [pin('L1')], mapBounds: b2, searchCenter: null, hasEbirdKey: true })
    await flush()
    expect(net.calls.length).toBe(before)
  })

  it('personal pins and guard-failing locIds are never fetched (FR-21)', async () => {
    renderController({ pins: [pin('L1'), personal('L2'), pin('not-a-locid'), pin('L12345678901')] })
    await flush()
    expect(net.calls.map(c => c.locId)).toEqual(['L1'])
  })
})

describe('the pass: pool, ordering, cap (FR-19, NFR-05)', () => {
  it('answers arrive into countFor and the status reaches done', async () => {
    const { result } = renderController({ pins: [pin('L1'), pin('L2')] })
    await waitFor(() => expect(result.current.status.phase).toBe('done'))
    expect(result.current.countFor('L1')).toMatchObject({ count30: 2, fromCache: false })
    expect(result.current.status.answered).toBe(2)
    expect(result.current.status.target).toBe(2)
    expect(result.current.status.liveFetched).toBe(2)
  })

  it('concurrent fetches never exceed the pool of 4', async () => {
    const resolvers: (() => void)[] = []
    net.impl = (_path, params) => new Promise(resolve => {
      resolvers.push(() => resolve(okPayload(params?.locId ?? '')))
    })
    const pins = Array.from({ length: 9 }, (_, i) => pin(`L${i + 1}`))
    const { result } = renderController({ pins })
    await flush()
    expect(net.maxInFlight).toBeLessThanOrEqual(4)
    // Drain in waves; the bound holds throughout.
    while (resolvers.length > 0) {
      const wave = resolvers.splice(0)
      for (const r of wave) r()
      await flush()
      expect(net.maxInFlight).toBeLessThanOrEqual(4)
    }
    await waitFor(() => expect(result.current.status.phase).toBe('done'))
    expect(net.calls.length).toBe(9)
  })

  it('in-view pins fetch before nearer out-of-view pins (in-view first, then proximity)', async () => {
    // L200 is IN view but far from the centre; L100 is OUT of view but near
    // it — in-view must win the ordering (the fixture where the two disagree).
    const bounds: MarkerBounds = [-1, -1, 1, 1]
    const center = { lat: 50, lng: 50 }
    renderController({
      pins: [pin('L100', 49, 49), pin('L200', 0.5, 0.5), pin('L300', 30, 30)],
      mapBounds: bounds,
      searchCenter: center,
    })
    await flush()
    expect(net.calls.map(c => c.locId)).toEqual(['L200', 'L100', 'L300'])
  })

  it('caps at ACTIVITY_FETCH_CAP with the remainder counted, and cache hits are exempt from the cap', async () => {
    // Seed 3 FRESH cached ids; offer cap+1 uncached ones + the 3 cached.
    for (const id of ['L901', 'L902', 'L903']) {
      await activityCache.dedupedFetch(id, async () => okPayload(id, 1))
    }
    net.calls.length = 0
    const uncached = Array.from({ length: ACTIVITY_FETCH_CAP + 1 }, (_, i) => pin(`L${i + 1}`))
    const cachedPins = [pin('L901'), pin('L902'), pin('L903')]
    const { result } = renderController({ pins: [...cachedPins, ...uncached] })
    await waitFor(() => expect(result.current.status.phase).toBe('done'), { timeout: 15000 })
    // Exactly the cap of live calls; the cached 3 cost nothing and still count
    // toward target/answered; exactly 1 stays beyond the cap.
    expect(net.calls.length).toBe(ACTIVITY_FETCH_CAP)
    expect(result.current.status.cappedCount).toBe(1)
    expect(result.current.status.cacheServed).toBe(3)
    expect(result.current.status.target).toBe(3 + ACTIVITY_FETCH_CAP)
    expect(result.current.countFor('L901')).not.toBeNull()
  }, 20000)
})

describe('degradation and retry (FR-14, QA-13/QA-14)', () => {
  it('hasEbirdKey false → zero requests, no-key error, cached answers still color', async () => {
    for (const id of ['L901']) {
      await activityCache.dedupedFetch(id, async () => okPayload(id, 1))
    }
    net.calls.length = 0
    const { result } = renderController({ pins: [pin('L901'), pin('L2')], hasEbirdKey: false })
    await waitFor(() => expect(result.current.status.phase).toBe('done'))
    expect(net.calls.length).toBe(0)
    expect(result.current.status.error).toMatchObject({ kind: 'no-key' })
    expect(result.current.countFor('L901')).not.toBeNull()
    expect(result.current.countFor('L2')).toBeNull()
  })

  it('an offline failure classifies, drains the queue, and keeps arrived answers', async () => {
    let calls = 0
    net.impl = async (_path, params) => {
      calls += 1
      if (calls <= 2) return okPayload(params?.locId ?? '')
      throw new TypeError('Failed to fetch') // connection-level → offline
    }
    const pins = Array.from({ length: 8 }, (_, i) => pin(`L${i + 1}`))
    const { result } = renderController({ pins })
    await waitFor(() => expect(result.current.status.phase).toBe('done'))
    expect(result.current.status.error).toMatchObject({ kind: 'offline' })
    expect(result.current.status.answered).toBe(2)
    // The queue drained: nowhere near all 8 were attempted after the failure.
    expect(net.calls.length).toBeLessThan(8)
    expect(result.current.countFor('L1')).not.toBeNull()
  })

  it('an HTTP failure classifies as error; retry() re-asks ONLY the unanswered remainder', async () => {
    const failing = new Set(['L3', 'L4'])
    net.impl = async (_path, params) => {
      const locId = params?.locId ?? ''
      if (failing.has(locId)) {
        throw Object.assign(new Error('eBird API error: 500'), { status: 502, detail: 'eBird API error: 500' })
      }
      return okPayload(locId)
    }
    const pins = Array.from({ length: 5 }, (_, i) => pin(`L${i + 1}`))
    const { result } = renderController({ pins })
    await waitFor(() => expect(result.current.status.phase).toBe('done'))
    expect(result.current.status.error).toMatchObject({ kind: 'error' })
    expect(result.current.status.answered).toBe(3)
    expect(result.current.status.failedCount).toBe(2)

    // Clear the fault; retry re-asks exactly the two failed ids (the three
    // answered ones are FRESH cache hits — zero further network for them).
    failing.clear()
    net.calls.length = 0
    act(() => { result.current.retry() })
    // Wait on the RETRY's outcome (answered reaching 5), not on phase 'done' —
    // the pre-retry status already reads 'done' and would satisfy it instantly.
    await waitFor(() => expect(result.current.status.answered).toBe(5))
    expect(result.current.status.error).toBeNull()
    expect(net.calls.map(c => c.locId).sort()).toEqual(['L3', 'L4'])
    expect(result.current.status.answered).toBe(5)
    expect(result.current.countFor('L3')).not.toBeNull()
  })
})

describe('the generation guard (FR-17, QA-18)', () => {
  it('a response landing after deactivation caches but never mutates the state', async () => {
    let release!: () => void
    net.impl = (_path, params) => new Promise(resolve => {
      release = () => resolve(okPayload(params?.locId ?? ''))
    })
    const { result, rerender } = renderController({ pins: [pin('L1')] })
    await flush()
    expect(net.calls.length).toBe(1)

    // Deactivate mid-flight (mode switch away), THEN let the response land.
    rerender({ active: false, pins: [pin('L1')], mapBounds: null, searchCenter: null, hasEbirdKey: true })
    await flush()
    act(() => { release() })
    await flush()

    // State untouched (unanswered under the new mode)…
    expect(result.current.countFor('L1')).toBeNull()
    // …but the response completed into the durable cache for later reuse.
    const cached = await activityCache.loadAll()
    expect(cached.get('L1')?.count30).toBe(2)

    // Reactivation reuses the cache: zero further network.
    net.calls.length = 0
    rerender({ active: true, pins: [pin('L1')], mapBounds: null, searchCenter: null, hasEbirdKey: true })
    await waitFor(() => expect(result.current.status.phase).toBe('done'))
    expect(net.calls.length).toBe(0)
    expect(result.current.countFor('L1')).toMatchObject({ count30: 2 })
  })

  it('a result-set replacement mid-flight supersedes the old pass', async () => {
    const releases = new Map<string, () => void>()
    net.impl = (_path, params) => new Promise(resolve => {
      releases.set(params?.locId ?? '', () => resolve(okPayload(params?.locId ?? '', 7)))
    })
    const { result, rerender } = renderController({ pins: [pin('L111')] })
    await flush()

    // New search lands while LOLD is in flight.
    rerender({ active: true, pins: [pin('L222')], mapBounds: null, searchCenter: null, hasEbirdKey: true })
    await flush()
    act(() => { releases.get('L111')!() })
    await flush()
    // The old pass's late answer never enters state (locId not in the new set
    // anyway — and the generation guard blocks the write regardless).
    expect(result.current.countFor('L111')).toBeNull()

    act(() => { releases.get('L222')!() })
    await waitFor(() => expect(result.current.status.phase).toBe('done'))
    expect(result.current.countFor('L222')).toMatchObject({ count30: 7 })
  })
})

describe('eBird 429 pacing (the pre-deploy revision: a 429 is a brief slowdown, never a lost hotspot)', () => {
  // All fake timers: every assertion is on request-START timestamps or work
  // done, never wall clock (the repo's timing-immunity rule). Written
  // red-first against the shipped defect: the pool-of-4 unpaced queue started
  // 4 requests in the same instant, and a 429 landed the hotspot in the
  // error state with no retry.

  const rateLimit429 = (retryAfterSec: number | null) =>
    Object.assign(new Error(EBIRD_RATE_LIMIT_DETAIL), {
      status: 429,
      detail: EBIRD_RATE_LIMIT_DETAIL,
      ...(retryAfterSec !== null ? { retryAfterSec } : {}),
    })

  async function tick(ms: number) {
    await act(async () => { await vi.advanceTimersByTimeAsync(ms) })
  }

  let randSpy: ReturnType<typeof vi.spyOn> | null = null
  beforeEach(() => {
    vi.useFakeTimers()
    randSpy = vi.spyOn(Math, 'random').mockReturnValue(0)
  })
  afterEach(() => {
    randSpy?.mockRestore()
    randSpy = null
    vi.useRealTimers()
  })

  it('request starts are paced, never a same-instant burst (start-timestamp assertion)', async () => {
    _setActivityStartSpacingMsForTests(ACTIVITY_START_SPACING_DEFAULT_MS)
    renderController({ pins: [pin('L1'), pin('L2'), pin('L3')] })
    await tick(0)
    // Only the FIRST request starts at pass start — the old 4-at-once burst
    // is gone structurally.
    expect(net.calls.length).toBe(1)
    await tick(ACTIVITY_START_SPACING_DEFAULT_MS * 2 + 10)
    expect(net.calls.length).toBe(3)
    const at = net.calls.map(c => c.at - net.calls[0].at)
    expect(at[1] - at[0]).toBeGreaterThanOrEqual(ACTIVITY_START_SPACING_DEFAULT_MS)
    expect(at[2] - at[1]).toBeGreaterThanOrEqual(ACTIVITY_START_SPACING_DEFAULT_MS)
  })

  it('a 429 honors Retry-After, pauses the WHOLE queue (one shared cooldown), then resumes and answers', async () => {
    let first = true
    net.impl = async (_path, params) => {
      if (params?.locId === 'L1' && first) {
        first = false
        throw rateLimit429(5)
      }
      return okPayload(params?.locId ?? '')
    }
    const pins = Array.from({ length: 6 }, (_, i) => pin(`L${i + 1}`))
    const { result } = renderController({ pins })
    await tick(0)
    // Pool of 4 started (spacing zeroed to isolate the cooldown axis); L1's
    // 429 landed and froze the queue — L5/L6 must NOT start.
    expect(net.calls.length).toBe(4)
    expect(result.current.status.rateLimited).toBe(true)

    await tick(4990)
    // Inside the server-named 5s window: zero new request starts, and the
    // three arrived answers were kept.
    expect(net.calls.length).toBe(4)
    expect(result.current.countFor('L2')).not.toBeNull()

    await tick(200)
    // Cooldown elapsed: the pass resumed where it left off — L5, L6, and the
    // L1 retry — and every hotspot ends ANSWERED (no shed answers).
    await tick(0)
    expect(net.calls.length).toBe(7)
    expect(result.current.status.phase).toBe('done')
    expect(result.current.status.answered).toBe(6)
    expect(result.current.status.failedCount).toBe(0)
    expect(result.current.status.error).toBeNull()
    expect(result.current.status.rateLimited).toBe(false)
    expect(result.current.countFor('L1')).toMatchObject({ count30: 2 })
    // The retry start waited for the full server-named window.
    const l1Starts = net.calls.filter(c => c.locId === 'L1').map(c => c.at)
    expect(l1Starts.length).toBe(2)
    expect(l1Starts[1] - l1Starts[0]).toBeGreaterThanOrEqual(5000)
  })

  it('persistent 429s: bounded exponential cooldowns (2s then 4s), bounded retries, then the honest unanswered state — and a 429 is never cached', async () => {
    net.impl = async () => { throw rateLimit429(null) }
    const { result } = renderController({ pins: [pin('L1')] })
    await tick(0)
    expect(net.calls.length).toBe(1)
    await tick(1990)
    expect(net.calls.length).toBe(1) // still cooling (2s wave 1)
    await tick(20)
    expect(net.calls.length).toBe(2) // retry 1 at ~2s → 429 again (4s wave 2)
    await tick(3980)
    expect(net.calls.length).toBe(2)
    await tick(30)
    expect(net.calls.length).toBe(3) // retry 2 at ~6s → exhausted
    await tick(0)

    // The exact ladder, pinned on request-start timestamps (random mocked 0).
    const at = net.calls.map(c => c.at - net.calls[0].at)
    expect(at).toEqual([0, 2000, 6000])

    // Exhausted → the existing unanswered/error state; the terminal summary
    // still reports the honest coverage, and the Retry control covers it.
    expect(result.current.status.phase).toBe('done')
    expect(result.current.status.answered).toBe(0)
    expect(result.current.status.target).toBe(1)
    expect(result.current.status.failedCount).toBe(1)
    expect(result.current.status.error).toMatchObject({ kind: 'error', message: EBIRD_RATE_LIMIT_DETAIL })
    expect(result.current.countFor('L1')).toBeNull()

    // A 429 is never cached (errors-never-cached extends to the new branch).
    const cached = await activityCache.loadAll()
    expect(cached.get('L1')).toBeUndefined()

    // The Retry control re-asks it: attempts reset per pass.
    net.impl = async (_path, params) => okPayload(params?.locId ?? '')
    net.calls.length = 0
    act(() => { result.current.retry() })
    await tick(0)
    // The key-global cooldown from the failed pass may still gate the start;
    // advance past the bounded maximum to prove the retry pass completes.
    await tick(30000)
    expect(net.calls.map(c => c.locId)).toEqual(['L1'])
    expect(result.current.countFor('L1')).not.toBeNull()
  })

  it('the cooldown emission is forced on the flip (visible within the 400ms throttle window)', async () => {
    net.impl = async () => { throw rateLimit429(30) }
    const { result } = renderController({ pins: [pin('L1'), pin('L2')] })
    await tick(0)
    // No 400ms has elapsed, yet the emitted (frozen) status already carries
    // the flag — the sentence shape changed, so the emission bypassed the
    // throttle (the v0.5.87 rule).
    const emitted = result.current.status
    expect(Object.isFrozen(emitted)).toBe(true)
    expect(emitted.rateLimited).toBe(true)
    expect(emitted.phase).toBe('running')
  })
})

describe('emitted status is an immutable snapshot (QA-11 / FR-12 — the throttle holds at the render)', () => {
  it('later arrivals never mutate an already-emitted status object', async () => {
    // Written red-first against the shipped defect: flushEmit handed
    // progressRef.current ITSELF to setStatus, and the promise handlers then
    // mutated that same object in place — so the rendered sentence (derived
    // from the held status on every per-arrival setAnswers re-render) updated
    // at ARRIVAL rate while seq advanced at the 400ms throttle. Every
    // assertion below is on the CAPTURED emission, never on result.current,
    // so a slow runner letting the throttle timer fire between steps cannot
    // turn a correct build red (the timing-immunity rule for suite-load).
    const resolvers: (() => void)[] = []
    net.impl = (_path, params) => new Promise(resolve => {
      resolvers.push(() => resolve(okPayload(params?.locId ?? '')))
    })
    const pins = Array.from({ length: 6 }, (_, i) => pin(`L${i + 1}`))
    const { result } = renderController({ pins })
    await flush()

    // The pass-start emission (the first definite figure, forced — the part
    // of the contract the fix must NOT change).
    const emitted = result.current.status
    expect(emitted.phase).toBe('running')
    expect(emitted.answered).toBe(0)
    expect(emitted.target).toBe(6)
    expect(Object.isFrozen(emitted)).toBe(true)

    // Two answers arrive inside the throttle window: they may mutate only the
    // ACCUMULATOR. The emitted snapshot's fields never move.
    const firstWave = resolvers.splice(0, 2)
    act(() => { for (const r of firstWave) r() })
    await flush()
    expect(emitted.answered).toBe(0)
    expect(emitted.liveFetched).toBe(0)
    expect(emitted.phase).toBe('running')

    // Drain to done: the terminal emission carries the totals, and the old
    // snapshot STILL never moved — not even its phase.
    while (resolvers.length > 0) {
      const wave = resolvers.splice(0)
      act(() => { for (const r of wave) r() })
      await flush()
    }
    await waitFor(() => expect(result.current.status.phase).toBe('done'))
    expect(result.current.status.answered).toBe(6)
    expect(Object.isFrozen(result.current.status)).toBe(true)
    expect(emitted.answered).toBe(0)
    expect(emitted.phase).toBe('running')
  })
})
