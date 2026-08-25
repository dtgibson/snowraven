// The durable hotspot-activity cache (FR-15 / NFR-05): TTL fresh/stale, FIFO
// at the cap with capacity+1 measured as WORK DONE via the work-stats seam
// (the repo's cache-measurement rules — never elapsed time), per-entry load
// validation (each malformed shape dropped independently), errors never
// cached, offline stale-serve, in-flight dedupe, debounced write.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const disk = vi.hoisted(() => ({
  docs: new Map<string, unknown>(),
  setCalls: [] as [string, unknown][],
}))
vi.mock('./storage', () => ({
  storage: {
    getSetting: vi.fn(async (key: string) => disk.docs.get(key) ?? null),
    setSetting: vi.fn(async (key: string, value: unknown) => {
      disk.docs.set(key, value)
      disk.setCalls.push([key, value])
    }),
  },
}))

import * as cache from './hotspotActivityCache'
import type { HotspotActivityPayload } from './hotspotActivity'

const payload = (locId: string, n: number): HotspotActivityPayload => ({
  locId,
  // All obsDt today-ish so count7 === count30 === n under any recent clock.
  species: Array.from({ length: n }, (_, i) => ({ speciesCode: `sp${i}`, obsDt: dateStr(0) })),
})

function dateStr(daysAgo: number): string {
  const d = new Date(Date.now() - daysAgo * 86400000)
  const p = (x: number) => String(x).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} 08:00`
}

const offlineError = () => new TypeError('Failed to fetch') // no status → offline-shaped
const httpError = () => Object.assign(new Error('eBird API error: 500'), { status: 502 })

beforeEach(() => {
  disk.docs.clear()
  disk.setCalls.length = 0
  cache._resetHotspotActivityCacheForTests()
})
afterEach(() => {
  vi.useRealTimers()
  cache._resetHotspotActivityCacheForTests()
})

describe('TTL and dedupe', () => {
  it('a fresh entry short-circuits with no loader call', async () => {
    const loader = vi.fn(async () => payload('L1', 4))
    const first = await cache.dedupedFetch('L1', loader)
    expect(first.fromNetwork).toBe(true)
    expect(first.entry.count30).toBe(4)
    expect(first.entry.count7).toBe(4)

    const second = await cache.dedupedFetch('L1', loader)
    expect(second.fromNetwork).toBe(false)
    expect(second.entry).toEqual(first.entry)
    expect(loader).toHaveBeenCalledTimes(1)
  })

  it('a stale entry (past the 6h TTL) refetches', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-24T08:00:00'))
    const loader = vi.fn(async () => payload('L1', 2))
    await cache.dedupedFetch('L1', loader)
    vi.setSystemTime(new Date('2026-08-24T14:01:00')) // TTL + 1min later
    const res = await cache.dedupedFetch('L1', loader)
    expect(res.fromNetwork).toBe(true)
    expect(loader).toHaveBeenCalledTimes(2)
  })

  it('concurrent same-id requests share ONE loader call', async () => {
    let resolve!: (p: HotspotActivityPayload) => void
    const loader = vi.fn(() => new Promise<HotspotActivityPayload>(r => { resolve = r }))
    const a = cache.dedupedFetch('L1', loader)
    const b = cache.dedupedFetch('L1', loader)
    // dedupedFetch awaits the disk mirror before running the loader — flush
    // microtasks so the (single) loader is in flight before resolving it.
    await Promise.resolve().then(() => Promise.resolve())
    resolve(payload('L1', 1))
    const [ra, rb] = await Promise.all([a, b])
    expect(loader).toHaveBeenCalledTimes(1)
    expect(ra.entry).toEqual(rb.entry)
  })
})

describe('errors are never cached (FR-15c / QA-14)', () => {
  it('a failed loader leaves no entry, so a retry re-asks', async () => {
    const failing = vi.fn(async () => { throw httpError() })
    await expect(cache.dedupedFetch('L1', failing)).rejects.toMatchObject({ status: 502 })
    const ok = vi.fn(async () => payload('L1', 3))
    const res = await cache.dedupedFetch('L1', ok)
    expect(res.fromNetwork).toBe(true)
    expect(ok).toHaveBeenCalledTimes(1)
    const all = await cache.loadAll()
    expect(all.get('L1')?.count30).toBe(3)
  })

  it('an offline failure with NO stale entry rethrows (never a fabricated answer)', async () => {
    const failing = vi.fn(async () => { throw offlineError() })
    await expect(cache.dedupedFetch('L1', failing)).rejects.toBeInstanceOf(TypeError)
    expect((await cache.loadAll()).size).toBe(0)
  })

  it('an offline failure WITH a stale entry serves it stale (fromNetwork false)', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-24T08:00:00'))
    await cache.dedupedFetch('L1', async () => payload('L1', 5))
    vi.setSystemTime(new Date('2026-08-24T15:00:00')) // stale
    const res = await cache.dedupedFetch('L1', async () => { throw offlineError() })
    expect(res.fromNetwork).toBe(false)
    expect(res.entry.count30).toBe(5)
  })
})

describe('load-path validation (per-entry, dropped never thrown)', () => {
  it('drops malformed entries independently and keeps the valid ones', async () => {
    disk.docs.set(cache.HOTSPOT_ACTIVITY_STORE_KEY, {
      version: 1,
      entries: {
        L1: { count30: 4, count7: 2, fetchedAt: 1000 },              // valid
        L2: { count30: 4, count7: 5, fetchedAt: 1000 },              // count7 > count30
        L3: { count30: '4', count7: 2, fetchedAt: 1000 },            // non-number
        L4: { count30: 4, count7: 2 },                               // missing fetchedAt
        L5: { count30: Infinity, count7: 0, fetchedAt: 1000 },       // non-finite
        L6: { count30: -1, count7: 0, fetchedAt: 1000 },             // negative
        L7: null,                                                    // not an object
        'not-a-locid': { count30: 1, count7: 1, fetchedAt: 1000 },   // bad key shape
        L8: { count30: 2, count7: 1, fetchedAt: 2000 },              // valid
      },
      order: ['L1', 'L2', 'L3', 'L4', 'L5', 'L6', 'L7', 'not-a-locid', 'L8', 'L1'],
    })
    const all = await cache.loadAll()
    expect([...all.keys()]).toEqual(['L1', 'L8'])
    expect(all.get('L1')).toEqual({ count30: 4, count7: 2, fetchedAt: 1000 })
  })

  it('a corrupt document degrades to an empty store', async () => {
    disk.docs.set(cache.HOTSPOT_ACTIVITY_STORE_KEY, 'not-an-object')
    expect((await cache.loadAll()).size).toBe(0)
  })

  it('prototype-chain keys in a hostile document cannot enter the store', async () => {
    // JSON.parse (never an object literal) so __proto__ is a real own key.
    disk.docs.set(cache.HOTSPOT_ACTIVITY_STORE_KEY, JSON.parse(
      '{"version":1,"entries":{"__proto__":{"count30":1,"count7":1,"fetchedAt":1},"constructor":{"count30":1,"count7":1,"fetchedAt":1}},"order":["__proto__","constructor"]}',
    ))
    const all = await cache.loadAll()
    expect(all.size).toBe(0)
  })
})

describe('write-side prototype hygiene (v0.5.90 — the guard pinned AT the store)', () => {
  it('a prototype-chain locId reaching dedupedFetch directly lands as an own key, never the setter', async () => {
    // Defense in depth: every shipped caller regex-gates the locId upstream
    // (controller enumeration, both transports), so this key can only arrive
    // via a future caller that skips the controller — which is exactly who
    // must inherit the protection. The hostile key is a plain STRING here (no
    // object literal is involved, so the JSON.parse rule lives in the
    // load-path probe above).
    vi.useFakeTimers()
    const res = await cache.dedupedFetch('__proto__', async () => payload('__proto__', 2))
    expect(res.fromNetwork).toBe(true)

    // The DISCRIMINATING assertion: on a plain-{} store the inherited
    // Object.prototype setter swallows the write (the record's prototype is
    // silently swapped to the entry; no own key exists anywhere), so the
    // flushed snapshot would not carry the key and Object.hasOwn goes red.
    // The in-memory reads alone cannot discriminate — a prototype-swapped
    // record answers store.entries['__proto__'] with the same values.
    await vi.advanceTimersByTimeAsync(260)
    const [, doc] = disk.setCalls.at(-1)!
    const entries = (doc as { entries: Record<string, unknown> }).entries
    expect(Object.hasOwn(entries, '__proto__')).toBe(true)
    expect((entries['__proto__'] as { count30: number }).count30).toBe(2)

    // No pollution beyond the store: fresh objects and Object.prototype
    // gained nothing.
    expect(({} as Record<string, unknown>).count30).toBeUndefined()
    expect(Object.hasOwn(Object.prototype, 'count30')).toBe(false)

    // An unrelated cold id still fetches normally afterward.
    const loader = vi.fn(async () => payload('L9', 1))
    const other = await cache.dedupedFetch('L9', loader)
    expect(other.fromNetwork).toBe(true)
    expect(loader).toHaveBeenCalledTimes(1)
  })
})

describe('FIFO at the cap, measured as WORK DONE at capacity+1', () => {
  it('evicts oldest-fetched past the cap; bookkeeping stays bounded per put', async () => {
    cache.setHotspotActivityMaxEntries(3)
    for (const id of ['L1', 'L2', 'L3']) {
      await cache.dedupedFetch(id, async () => payload(id, 1))
    }
    let stats = cache._getHotspotActivityCacheWorkStatsForTests()
    expect(stats.puts).toBe(3)
    expect(stats.evictions).toBe(0) // AT capacity: no eviction work at all

    // capacity+1: exactly ONE eviction per overflowing put, never a loop —
    // and the loader ran exactly once per distinct id (the cache is never
    // worse than no cache: misses === loader calls).
    await cache.dedupedFetch('L4', async () => payload('L4', 1))
    stats = cache._getHotspotActivityCacheWorkStatsForTests()
    expect(stats.evictions).toBe(1)
    expect(stats.shiftedSlots).toBe(3)
    expect(stats.loaderCalls).toBe(4)

    const all = await cache.loadAll()
    expect([...all.keys()]).toEqual(['L2', 'L3', 'L4']) // L1 (oldest) evicted

    // The evicted hotspot simply refetches — one cheap re-ask, the stated cost.
    const loader = vi.fn(async () => payload('L1', 1))
    const res = await cache.dedupedFetch('L1', loader)
    expect(res.fromNetwork).toBe(true)
    expect(loader).toHaveBeenCalledTimes(1)
  })

  it('a re-put of an existing id refreshes in place without eviction', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-24T08:00:00'))
    cache.setHotspotActivityMaxEntries(2)
    await cache.dedupedFetch('L1', async () => payload('L1', 1))
    await cache.dedupedFetch('L2', async () => payload('L2', 1))
    vi.setSystemTime(new Date('2026-08-24T15:00:00')) // both stale
    await cache.dedupedFetch('L1', async () => payload('L1', 9))
    const stats = cache._getHotspotActivityCacheWorkStatsForTests()
    expect(stats.evictions).toBe(0)
    const all = await cache.loadAll()
    expect([...all.keys()]).toEqual(['L2', 'L1']) // L1 moved to newest
    expect(all.get('L1')?.count30).toBe(9)
  })
})

describe('debounced write', () => {
  it('flushes one whole-document snapshot 250ms after the last put', async () => {
    vi.useFakeTimers()
    await cache.dedupedFetch('L1', async () => payload('L1', 1))
    await cache.dedupedFetch('L2', async () => payload('L2', 1))
    expect(disk.setCalls.length).toBe(0)
    await vi.advanceTimersByTimeAsync(260)
    expect(disk.setCalls.length).toBe(1)
    const [key, doc] = disk.setCalls[0]
    expect(key).toBe(cache.HOTSPOT_ACTIVITY_STORE_KEY)
    expect((doc as { order: string[] }).order).toEqual(['L1', 'L2'])
    const stats = cache._getHotspotActivityCacheWorkStatsForTests()
    expect(stats.writeSchedules).toBe(2)
    expect(stats.writeFlushes).toBe(1)
    expect(stats.lastSnapshotEntries).toBe(2)
  })
})
