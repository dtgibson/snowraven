// @vitest-environment jsdom
//
// Eager-fetch GATING lock for useCountyCompleteness (mobile-prep-sweep tidy #1,
// closing a v0.5.54 County-Completeness QA coverage gap). The controller's
// bounded eager fetch has five load-bearing rules (FR-13/FR-17, NFR-01, OQ-07);
// this file pins each one directly with renderHook, driving the returned
// `onViewportCounties` and observing the mocked fetch chokepoint:
//
//   1. birded-only     — un-birded (countableCount < 1) in-view counties never fetch
//   2. TTL skip        — a cache-fresh county (fetchedAt within the TTL) never re-fetches
//   3. pool-of-4 cap   — at most EAGER_FETCH_CONCURRENCY in flight at once
//   4. dedupe          — the same region queued/in-flight across pans fetches once
//   5. no-key gate     — hasEbirdKey !== true fetches nothing
//
// transport + countyCompletenessCache are mocked; dedupedFetch hands back
// controllable deferred promises so we can inspect concurrency before resolving.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, cleanup } from '@testing-library/react'

// ── Mocks ───────────────────────────────────────────────────────────────────
// The pool's one network call is completenessCache.dedupedFetch(rc, loader); we
// intercept it so the real transport.get is never reached from launch(). loadAll
// (the one-time seed) resolves empty so nothing pre-populates the map. Keep the
// real COMPLETENESS_TTL_MS so the TTL-skip test uses the shipped bound.
//
// vi.mock is hoisted above module-scope consts, so the shared fetch-observation
// state the factory needs is declared through vi.hoisted (also hoisted, and
// available to the factory).
interface Deferred { resolve: (v: unknown) => void; reject: (e: unknown) => void; promise: Promise<unknown> }

const TTL_MS = 30 * 24 * 60 * 60 * 1000

const H = vi.hoisted(() => {
  const ttl = 30 * 24 * 60 * 60 * 1000
  const state: { dedupedCalls: string[]; deferreds: Map<string, Deferred> } = {
    dedupedCalls: [],
    deferreds: new Map<string, Deferred>(),
  }
  return { ttl, state }
})

function newDeferred(): Deferred {
  let resolve!: (v: unknown) => void
  let reject!: (e: unknown) => void
  const promise = new Promise<unknown>((res, rej) => { resolve = res; reject = rej })
  return { resolve, reject, promise }
}

vi.mock('./countyCompletenessCache', () => ({
  COMPLETENESS_TTL_MS: H.ttl,
  loadAll: () => Promise.resolve(new Map()),
  dedupedFetch: (rc: string) => {
    H.state.dedupedCalls.push(rc)
    const d = newDeferred()
    H.state.deferreds.set(rc, d)
    // Shape matches CompletenessFetchResult { data, fetchedAt, fromNetwork }.
    return d.promise
  },
}))

// Aliases so the test bodies read naturally.
const dedupedCalls = H.state.dedupedCalls
const deferreds = H.state.deferreds

vi.mock('./transport', async (importActual) => {
  const actual = await importActual<typeof import('./transport')>()
  return {
    ...actual,
    transport: {
      get: vi.fn(() => Promise.resolve({ regionCode: '', speciesCount: 0, species: [] })),
      post: vi.fn(() => Promise.resolve({ codes: {} })),
      getReplayable: vi.fn(),
    },
  }
})

import { useCountyCompleteness, EAGER_FETCH_CONCURRENCY, type UseCountyCompletenessArgs } from './useCountyCompleteness'
import { countyKey, deriveCountyRegionCode } from './countyBoundaries'
import type { CountyLocalCompleteness } from './countyCompleteness'

// ── Fixtures ──────────────────────────────────────────────────────────────────
// Valid US geoids so deriveCountyRegionCode resolves (needs /^\d{5}$/); the
// region code is US-<STUSPS>-<last 3 of geoid>.
function localEntry(stateProvince: string, county: string, countableCount: number): CountyLocalCompleteness {
  return {
    stateProvince,
    county,
    countableCount,
    countableNames: countableCount > 0 ? ['American Robin'] : [],
    sciByName: countableCount > 0 ? { 'American Robin': 'Turdus migratorius' } : {},
    recentNew: [],
  }
}

/** Build a localByCounty map keyed by countyKey for the given (stusps,name,count) rows. */
function buildLocal(rows: { stusps: string; name: string; count: number }[]): Map<string, CountyLocalCompleteness> {
  const m = new Map<string, CountyLocalCompleteness>()
  for (const r of rows) {
    m.set(countyKey(r.stusps, r.name), localEntry(`US-${r.stusps}`, r.name, r.count))
  }
  return m
}

/** A viewport row shape (stusps/name/geoid) as CountyLayer feeds onViewportCounties. */
function vpRow(stusps: string, name: string, geoid: string) { return { stusps, name, geoid } }

function baseArgs(local: Map<string, CountyLocalCompleteness> | null, hasKey: boolean | null): UseCountyCompletenessArgs {
  return { active: true, localByCounty: local, hasEbirdKey: hasKey }
}

beforeEach(() => {
  dedupedCalls.length = 0
  deferreds.clear()
})
afterEach(() => { cleanup() })

// Let the seed effect (loadAll) + code-resolve effect settle before asserting.
async function flush() {
  await act(async () => { await Promise.resolve(); await Promise.resolve() })
}

describe('useCountyCompleteness — eager-fetch gating', () => {
  it('birded-only: fetches birded in-view counties, never un-birded ones', async () => {
    const local = buildLocal([
      { stusps: 'CA', name: 'Alameda', count: 42 },   // birded
      { stusps: 'CA', name: 'Alpine', count: 0 },      // un-birded (FR-13)
    ])
    const { result } = renderHook(() => useCountyCompleteness(baseArgs(local, true)))
    await flush()
    act(() => {
      result.current!.onViewportCounties([
        vpRow('CA', 'Alameda', '06001'),
        vpRow('CA', 'Alpine', '06003'),
      ])
    })
    // Only the birded county's region code was fetched.
    expect(dedupedCalls).toEqual([deriveCountyRegionCode('06001', 'CA')])
    expect(dedupedCalls).not.toContain(deriveCountyRegionCode('06003', 'CA'))
  })

  it('no-key gate: no fetch when hasEbirdKey is not true', async () => {
    const local = buildLocal([{ stusps: 'CA', name: 'Alameda', count: 42 }])

    // hasEbirdKey === false
    const { result: rFalse } = renderHook(() => useCountyCompleteness(baseArgs(local, false)))
    await flush()
    act(() => { rFalse.current!.onViewportCounties([vpRow('CA', 'Alameda', '06001')]) })
    expect(dedupedCalls).toEqual([])

    // hasEbirdKey === null (unknown — still no fetch)
    cleanup()
    const { result: rNull } = renderHook(() => useCountyCompleteness(baseArgs(local, null)))
    await flush()
    act(() => { rNull.current!.onViewportCounties([vpRow('CA', 'Alameda', '06001')]) })
    expect(dedupedCalls).toEqual([])
  })

  it('pool-of-4: caps concurrent eager fetches at EAGER_FETCH_CONCURRENCY', async () => {
    expect(EAGER_FETCH_CONCURRENCY).toBe(4)
    // Six birded counties in view; the pool must launch only 4 until one settles.
    const rows = [
      { stusps: 'CA', name: 'A', count: 1 }, { stusps: 'CA', name: 'B', count: 1 },
      { stusps: 'CA', name: 'C', count: 1 }, { stusps: 'CA', name: 'D', count: 1 },
      { stusps: 'CA', name: 'E', count: 1 }, { stusps: 'CA', name: 'F', count: 1 },
    ]
    const geoids = ['06001', '06003', '06005', '06007', '06009', '06011']
    const local = buildLocal(rows)
    const { result } = renderHook(() => useCountyCompleteness(baseArgs(local, true)))
    await flush()

    act(() => {
      result.current!.onViewportCounties(rows.map((r, i) => vpRow(r.stusps, r.name, geoids[i])))
    })
    // Exactly 4 in flight; the remaining 2 wait in the queue.
    expect(dedupedCalls.length).toBe(EAGER_FETCH_CONCURRENCY)

    // Resolve one in-flight fetch → the pool pumps exactly one more (5 total).
    const firstRc = dedupedCalls[0]
    await act(async () => {
      deferreds.get(firstRc)!.resolve({
        data: { regionCode: firstRc, speciesCount: 10, species: [] },
        fetchedAt: Date.now(),
        fromNetwork: true,
      })
      await Promise.resolve(); await Promise.resolve()
    })
    expect(dedupedCalls.length).toBe(EAGER_FETCH_CONCURRENCY + 1)
  })

  it('dedupe: the same region in-flight across pans is fetched once', async () => {
    const local = buildLocal([{ stusps: 'CA', name: 'Alameda', count: 5 }])
    const { result } = renderHook(() => useCountyCompleteness(baseArgs(local, true)))
    await flush()

    // Pan 1 queues + launches Alameda.
    act(() => { result.current!.onViewportCounties([vpRow('CA', 'Alameda', '06001')]) })
    expect(dedupedCalls.length).toBe(1)

    // Pan 2 (same county still in view, fetch still in flight) must NOT re-fetch.
    act(() => { result.current!.onViewportCounties([vpRow('CA', 'Alameda', '06001')]) })
    expect(dedupedCalls.length).toBe(1)

    // Even a third pan while loading stays deduped.
    act(() => { result.current!.onViewportCounties([vpRow('CA', 'Alameda', '06001')]) })
    expect(dedupedCalls.length).toBe(1)
  })

  it('TTL skip: a cache-fresh county is not re-fetched on the next pan', async () => {
    const rc = deriveCountyRegionCode('06001', 'CA')!
    const local = buildLocal([{ stusps: 'CA', name: 'Alameda', count: 7 }])
    const { result } = renderHook(() => useCountyCompleteness(baseArgs(local, true)))
    await flush()

    // First pan fetches; resolve it FRESH (fetchedAt now).
    act(() => { result.current!.onViewportCounties([vpRow('CA', 'Alameda', '06001')]) })
    expect(dedupedCalls.length).toBe(1)
    await act(async () => {
      deferreds.get(rc)!.resolve({
        data: { regionCode: rc, speciesCount: 20, species: [] },
        fetchedAt: Date.now(),
        fromNetwork: true,
      })
      await Promise.resolve(); await Promise.resolve()
    })

    // A later pan over the same, now-fresh county must skip the fetch entirely
    // (now - fetchedAt < COMPLETENESS_TTL_MS).
    act(() => { result.current!.onViewportCounties([vpRow('CA', 'Alameda', '06001')]) })
    expect(dedupedCalls.length).toBe(1)
  })

  it('TTL skip is a WINDOW, not a blanket cache-present skip: a stale entry re-fetches', async () => {
    const rc = deriveCountyRegionCode('06001', 'CA')!
    const local = buildLocal([{ stusps: 'CA', name: 'Alameda', count: 9 }])
    const { result } = renderHook(() => useCountyCompleteness(baseArgs(local, true)))
    await flush()

    act(() => { result.current!.onViewportCounties([vpRow('CA', 'Alameda', '06001')]) })
    expect(dedupedCalls.length).toBe(1)
    // Resolve with a STALE fetchedAt (older than the TTL).
    await act(async () => {
      deferreds.get(rc)!.resolve({
        data: { regionCode: rc, speciesCount: 20, species: [] },
        fetchedAt: Date.now() - (TTL_MS + 60_000),
        fromNetwork: true,
      })
      await Promise.resolve(); await Promise.resolve()
    })

    // The next pan sees a stale entry → re-queues + re-fetches (the eager path
    // refreshes it; dedupedFetch itself would then short-circuit if still fresh).
    act(() => { result.current!.onViewportCounties([vpRow('CA', 'Alameda', '06001')]) })
    expect(dedupedCalls.length).toBe(2)
  })

  it('unresolvable geoid never fetches (FR-18)', async () => {
    const local = buildLocal([{ stusps: 'CA', name: 'Weird', count: 3 }])
    const { result } = renderHook(() => useCountyCompleteness(baseArgs(local, true)))
    await flush()
    act(() => { result.current!.onViewportCounties([vpRow('CA', 'Weird', 'ABCDE')]) }) // not /^\d{5}$/
    expect(dedupedCalls).toEqual([])
  })
})
