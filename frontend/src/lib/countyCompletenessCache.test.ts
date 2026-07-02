// Persistent per-county completeness cache — TTL freshness (FR-15), in-flight
// dedup (FR-16), eviction caps, errors-never-cached (FR-25/FR-31), and the
// offline stale-but-shown read (FR-30). The storage seam is mocked to an
// in-memory document so persistence round-trips are observable.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import * as cache from './countyCompletenessCache'
import type { CountyEbirdData } from './countyCompleteness'

const seamDoc: { value: unknown } = { value: null }

vi.mock('./storage', () => ({
  storage: {
    getSetting: vi.fn(async (key: string) => (key === 'county-completeness-v1' ? seamDoc.value : null)),
    setSetting: vi.fn(async (_key: string, value: unknown) => { seamDoc.value = JSON.parse(JSON.stringify(value)) }),
  },
}))

function payload(regionCode: string, speciesCount = 3): CountyEbirdData {
  return {
    regionCode,
    speciesCount,
    species: Array.from({ length: speciesCount }, (_, i) => ({ speciesCode: `sp${i}`, commonName: `Species ${i}` })),
  }
}

const DAY = 86_400_000

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(1_750_000_000_000)
  seamDoc.value = null
  cache._resetCountyCompletenessCacheForTests()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('countyCompletenessCache — TTL (FR-15)', () => {
  it('a fresh entry short-circuits with NO loader call within the 30-day bound', async () => {
    const loader = vi.fn(async () => payload('US-CA-085'))
    const first = await cache.dedupedFetch('US-CA-085', loader)
    expect(first.fromNetwork).toBe(true)
    expect(loader).toHaveBeenCalledTimes(1)

    vi.advanceTimersByTime(29 * DAY)
    const second = await cache.dedupedFetch('US-CA-085', loader)
    expect(second.fromNetwork).toBe(false)
    expect(second.data.regionCode).toBe('US-CA-085')
    expect(second.fetchedAt).toBe(first.fetchedAt)
    expect(loader).toHaveBeenCalledTimes(1) // network-silent revisit (QA-13)
  })

  it('a stale entry (past 30 days) refetches', async () => {
    const loader = vi.fn(async () => payload('US-CA-085'))
    await cache.dedupedFetch('US-CA-085', loader)
    vi.advanceTimersByTime(31 * DAY)
    const res = await cache.dedupedFetch('US-CA-085', loader)
    expect(res.fromNetwork).toBe(true)
    expect(loader).toHaveBeenCalledTimes(2)
  })
})

describe('countyCompletenessCache — in-flight dedup (FR-16)', () => {
  it('two concurrent requests for the same county share ONE loader call', async () => {
    let resolveLoad!: (v: CountyEbirdData) => void
    const loader = vi.fn(() => new Promise<CountyEbirdData>(res => { resolveLoad = res }))
    const p1 = cache.dedupedFetch('US-CA-085', loader)
    const p2 = cache.dedupedFetch('US-CA-085', loader)
    // Let the seam load + miss checks settle so the (single) loader starts.
    for (let i = 0; i < 20 && loader.mock.calls.length === 0; i++) await Promise.resolve()
    expect(loader).toHaveBeenCalledTimes(1)
    resolveLoad(payload('US-CA-085'))
    const [r1, r2] = await Promise.all([p1, p2])
    expect(loader).toHaveBeenCalledTimes(1)
    expect(r1.data).toEqual(r2.data)
  })

  it('distinct counties do not share a call', async () => {
    const loader = vi.fn(async () => payload('X'))
    await Promise.all([
      cache.dedupedFetch('US-CA-085', loader),
      cache.dedupedFetch('US-CA-069', loader),
    ])
    expect(loader).toHaveBeenCalledTimes(2)
  })
})

describe('countyCompletenessCache — failures', () => {
  it('errors are never cached: a failed fetch leaves no entry and the next call retries', async () => {
    const failing = vi.fn(async () => { throw Object.assign(new Error('eBird API error: 502'), { status: 502 }) })
    await expect(cache.dedupedFetch('US-CA-085', failing)).rejects.toThrow('502')
    const ok = vi.fn(async () => payload('US-CA-085'))
    const res = await cache.dedupedFetch('US-CA-085', ok)
    expect(res.fromNetwork).toBe(true)
    expect(ok).toHaveBeenCalledTimes(1)
  })

  it('offline + a STALE prior entry returns the stale copy for shading (FR-30)', async () => {
    const loader = vi.fn(async () => payload('US-CA-085'))
    const first = await cache.dedupedFetch('US-CA-085', loader)
    vi.advanceTimersByTime(31 * DAY) // stale now
    const offline = vi.fn(async () => { throw new TypeError('Failed to fetch') }) // no status → offline
    const res = await cache.dedupedFetch('US-CA-085', offline)
    expect(res.fromNetwork).toBe(false)
    expect(res.fetchedAt).toBe(first.fetchedAt)
  })

  it('an HTTP error with a stale entry still rethrows (server errors are never masked)', async () => {
    await cache.dedupedFetch('US-CA-085', async () => payload('US-CA-085'))
    vi.advanceTimersByTime(31 * DAY)
    const failing = vi.fn(async () => { throw Object.assign(new Error('eBird API error: 500'), { status: 502 }) })
    await expect(cache.dedupedFetch('US-CA-085', failing)).rejects.toThrow('500')
  })
})

describe('countyCompletenessCache — eviction caps', () => {
  it('evicts oldest-fetched past the entry cap; the newest always survives', async () => {
    cache.setCompletenessMaxEntries(2)
    await cache.dedupedFetch('US-CA-001', async () => payload('US-CA-001'))
    vi.advanceTimersByTime(1000)
    await cache.dedupedFetch('US-CA-003', async () => payload('US-CA-003'))
    vi.advanceTimersByTime(1000)
    await cache.dedupedFetch('US-CA-005', async () => payload('US-CA-005'))
    const all = await cache.loadAll()
    expect([...all.keys()]).toEqual(['US-CA-003', 'US-CA-005'])
  })

  it('evicts on the byte cap too, whichever fills first', async () => {
    cache.setCompletenessMaxBytes(JSON.stringify(payload('US-CA-001', 50)).length + 10)
    await cache.dedupedFetch('US-CA-001', async () => payload('US-CA-001', 50))
    vi.advanceTimersByTime(1000)
    await cache.dedupedFetch('US-CA-003', async () => payload('US-CA-003', 50))
    const all = await cache.loadAll()
    expect([...all.keys()]).toEqual(['US-CA-003'])
  })
})

describe('countyCompletenessCache — storage-seam persistence (OQ-05)', () => {
  it('a put is debounce-written through the seam and survives a mirror reset', async () => {
    const first = await cache.dedupedFetch('US-CA-085', async () => payload('US-CA-085'))
    vi.advanceTimersByTime(300) // flush the 250 ms debounced write
    expect(seamDoc.value).not.toBeNull()

    // A fresh session: mirror reset, disk (the mocked seam doc) intact.
    cache._resetCountyCompletenessCacheForTests()
    const loader = vi.fn(async () => payload('US-CA-085'))
    const res = await cache.dedupedFetch('US-CA-085', loader)
    expect(loader).not.toHaveBeenCalled()       // shades from cache across relaunch
    expect(res.fetchedAt).toBe(first.fetchedAt)
  })

  it('a corrupt/absent document normalizes to an empty store', async () => {
    seamDoc.value = { bogus: true }
    const all = await cache.loadAll()
    expect(all.size).toBe(0)
  })

  it('per-entry validation: a malformed entry is dropped on load, the valid one kept, nothing throws', async () => {
    // A WELL-FORMED store document whose entries are individually corrupt in the
    // ways a partial write / hand edit produces: data null, data missing fields,
    // non-numeric fetchedAt, a junk (non-region) key. Only the valid entry may
    // surface — a corrupted entry degrades to "not cached", never a crash.
    const valid = { data: payload('US-CA-085'), fetchedAt: 1_749_000_000_000, bytes: 200 }
    seamDoc.value = {
      version: 1,
      entries: {
        'US-CA-085': valid,
        'US-CA-069': { data: null, fetchedAt: 1_749_000_000_000, bytes: 50 },              // the crash shape
        'US-MN-053': { data: { regionCode: 'US-MN-053' }, fetchedAt: 1_749_000_000_000, bytes: 50 }, // missing fields
        'US-OR-005': { data: payload('US-OR-005'), fetchedAt: 'yesterday', bytes: 50 },     // bad fetchedAt
        'not-a-region': { data: payload('X'), fetchedAt: 1, bytes: 50 },                    // junk key
      },
      order: ['US-CA-085', 'US-CA-069', 'US-MN-053', 'US-OR-005', 'not-a-region'],
    }
    const all = await cache.loadAll()
    expect([...all.keys()]).toEqual(['US-CA-085'])
    expect(all.get('US-CA-085')!.data.speciesCount).toBe(3)

    // The dropped county reads as a plain cache miss — the loader runs again.
    const loader = vi.fn(async () => payload('US-CA-069'))
    const res = await cache.dedupedFetch('US-CA-069', loader)
    expect(loader).toHaveBeenCalledTimes(1)
    expect(res.fromNetwork).toBe(true)
  })
})
