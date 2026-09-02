import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  cachedGet,
  clearNetworkCache,
  networkCacheKey,
  networkCacheSize,
  NETWORK_CACHE_MAX_ENTRIES,
  NETWORK_CACHE_TTL_MS,
} from './networkCache'

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  clearNetworkCache()
  vi.useRealTimers()
})

describe('cachedGet', () => {
  it('returns the cached value within the TTL (loader called once)', async () => {
    const loader = vi.fn(async () => ({ n: 1 }))
    const a = await cachedGet('k', loader)
    const b = await cachedGet('k', loader)
    expect(loader).toHaveBeenCalledTimes(1)
    expect(b).toBe(a)
  })

  it('re-fetches after the TTL expires', async () => {
    const loader = vi.fn(async () => 'data')
    await cachedGet('k', loader)
    vi.advanceTimersByTime(NETWORK_CACHE_TTL_MS + 1)
    await cachedGet('k', loader)
    expect(loader).toHaveBeenCalledTimes(2)
  })

  it('coalesces concurrent identical calls into one loader invocation', async () => {
    let resolve!: (v: string) => void
    const loader = vi.fn(() => new Promise<string>(r => { resolve = r }))
    const p1 = cachedGet('k', loader)
    const p2 = cachedGet('k', loader)
    resolve('shared')
    expect(await p1).toBe('shared')
    expect(await p2).toBe('shared')
    expect(loader).toHaveBeenCalledTimes(1)
  })

  it('keys are independent', async () => {
    const loader = vi.fn(async () => 'x')
    await cachedGet('a', loader)
    await cachedGet('b', loader)
    expect(loader).toHaveBeenCalledTimes(2)
  })

  it('does NOT cache a rejected loader — the next call re-fetches', async () => {
    const loader = vi.fn()
      .mockRejectedValueOnce(new Error('eBird 502'))
      .mockResolvedValueOnce('recovered')
    await expect(cachedGet('k', loader)).rejects.toThrow('eBird 502')
    expect(await cachedGet('k', loader)).toBe('recovered')
    expect(loader).toHaveBeenCalledTimes(2)
  })

  it('clearNetworkCache forces a re-fetch', async () => {
    const loader = vi.fn(async () => 1)
    await cachedGet('k', loader)
    clearNetworkCache()
    await cachedGet('k', loader)
    expect(loader).toHaveBeenCalledTimes(2)
  })

  it('a loader resolving after clearNetworkCache does not repopulate (generation guard)', async () => {
    let resolve!: (v: string) => void
    const slow = vi.fn(() => new Promise<string>(r => { resolve = r }))
    const p = cachedGet('k', slow)
    clearNetworkCache()
    resolve('stale')
    expect(await p).toBe('stale') // the caller still gets its data…
    const fresh = vi.fn(async () => 'fresh')
    expect(await cachedGet('k', fresh)).toBe('fresh') // …but nothing was cached
    expect(fresh).toHaveBeenCalledTimes(1)
  })
})

describe('networkCacheKey', () => {
  it('sorts params so insertion order is irrelevant', () => {
    expect(networkCacheKey('/map/hotspots', { lng: '-121.5', lat: '38.5', dist: '40' }))
      .toBe(networkCacheKey('/map/hotspots', { dist: '40', lat: '38.5', lng: '-121.5' }))
  })

  it('rounds lat/lng to 5 decimals so trivially-different centers coalesce', () => {
    expect(networkCacheKey('/map/hotspots', { lat: '38.500000001', lng: '-121.5' }))
      .toBe(networkCacheKey('/map/hotspots', { lat: '38.5', lng: '-121.5' }))
    expect(networkCacheKey('/map/hotspots', { lat: '38.5001', lng: '-121.5' }))
      .not.toBe(networkCacheKey('/map/hotspots', { lat: '38.5', lng: '-121.5' }))
  })

  it('sorts comma code lists so the same species set hits the same entry', () => {
    expect(networkCacheKey('/map/recent-obs', { codes: 'b,a, c' }))
      .toBe(networkCacheKey('/map/recent-obs', { codes: 'c,b,a' }))
  })

  it('different paths and params produce different keys', () => {
    expect(networkCacheKey('/map/hotspots', { lat: '1', lng: '2' }))
      .not.toBe(networkCacheKey('/map/recent-obs', { lat: '1', lng: '2' }))
    expect(networkCacheKey('/map/hotspots', { dist: '8' }))
      .not.toBe(networkCacheKey('/map/hotspots', { dist: '40' }))
  })

  it('a value cannot forge a second parameter and land on another key', () => {
    // Unencoded, {codes:'abc&dist=25'} and {codes:'abc', dist:'25'} both render
    // as `/map/recent-obs?codes=abc&dist=25` — one caller's value silently
    // becoming another caller's entry. No shipped caller passes free text, so
    // this guards the shape before something does.
    expect(networkCacheKey('/map/recent-obs', { codes: 'abc&dist=25' }))
      .not.toBe(networkCacheKey('/map/recent-obs', { codes: 'abc', dist: '25' }))
    // The separators themselves survive only as escapes, never as structure.
    expect(networkCacheKey('/map/recent-obs', { codes: 'a=b' })).not.toContain('a=b')
    // Equal inputs still coalesce — encoding must not defeat the cache.
    expect(networkCacheKey('/map/recent-obs', { codes: 'b,a' }))
      .toBe(networkCacheKey('/map/recent-obs', { codes: 'a,b' }))
  })
})


// ---------------------------------------------------------------------------
// The FIFO cap (improve: large-file-and-memory-handling).
//
// Until this change the store was a module-scope Map with expire-on-read only: an
// entry was dropped when its OWN key was asked for again and never otherwise, and
// the key rounds lat/lng to ~1 m, so every distinct map search center added a
// permanent entry holding a whole eBird payload for the session. It was also the one
// cache missing from cacheInventory.test.ts.
//
// Measured at CAPACITY PLUS ONE and asserted as WORK DONE, per
// `.claude/rules/testing.md` (v0.5.85): at capacity a fixed-size cache never evicts
// and reports its best case as its typical case, and one key more than it holds is
// the cheapest input an adversary — or an ordinary panning user — can supply. Work
// done is loader invocations, which no loaded machine can move; elapsed time is not
// asserted anywhere here, and neither is a byte figure.
//
// The policy is FIFO rather than admission control because of what an eviction COSTS
// (DECISIONS.md, v0.5.86): one redundant eBird request. Admission control would fill
// on the first 64 keys of a session and then serve nothing new for the rest of it,
// which for live network data is the wrong trade — the opposite of the hot name memo
// where FIFO churn was 167x worse than no cache at all.
// ---------------------------------------------------------------------------

/** A loader that counts its own invocations, so "work done" is exact. */
function countingLoader() {
  let misses = 0
  return {
    get misses() { return misses },
    load: (key: string) => async () => { misses += 1; return `payload:${key}` },
  }
}

const key = (n: number) => `/map/hotspots?lat=${n}`

describe('the FIFO cap', () => {
  it('holds at most NETWORK_CACHE_MAX_ENTRIES, whatever it is offered', async () => {
    const c = countingLoader()
    for (let n = 0; n < NETWORK_CACHE_MAX_ENTRIES * 4; n++) {
      await cachedGet(key(n), c.load(key(n)))
      expect(networkCacheSize()).toBeLessThanOrEqual(NETWORK_CACHE_MAX_ENTRIES)
    }
    expect(networkCacheSize()).toBe(NETWORK_CACHE_MAX_ENTRIES)
    expect(c.misses).toBe(NETWORK_CACHE_MAX_ENTRIES * 4)
  })

  it('evicts the OLDEST first, and keeps the newest cap-worth (FIFO, at capacity+1)', async () => {
    const c = countingLoader()
    for (let n = 0; n <= NETWORK_CACHE_MAX_ENTRIES; n++) await cachedGet(key(n), c.load(key(n)))
    expect(networkCacheSize()).toBe(NETWORK_CACHE_MAX_ENTRIES)

    const afterFill = c.misses
    // key(0) — the oldest — was evicted by key(cap): asking again does work.
    await cachedGet(key(0), c.load(key(0)))
    expect(c.misses).toBe(afterFill + 1)

    // …and every key admitted after it is still a hit, so the eviction was one
    // entry deep rather than a flush.
    const beforeHits = c.misses
    for (let n = 2; n <= NETWORK_CACHE_MAX_ENTRIES; n++) await cachedGet(key(n), c.load(key(n)))
    expect(c.misses).toBe(beforeHits)
  })

  it('at capacity+1, the FIFO worst case does EXACTLY as much work as no cache', async () => {
    // The pathological case for FIFO, and the one an ordinary panning user reaches:
    // the working set is one key larger than the cache, so a straight traversal
    // evicts each key just before it is asked for again and every access misses.
    // The property that matters is that this is never WORSE than not caching — a
    // no-cache implementation does exactly one load per call, and so does this.
    const rounds = 5
    const span = NETWORK_CACHE_MAX_ENTRIES + 1
    const c = countingLoader()

    for (let r = 0; r < rounds; r++) {
      for (let n = 0; n < span; n++) await cachedGet(key(n), c.load(key(n)))
    }

    const noCacheWouldDo = rounds * span
    expect(c.misses).toBe(noCacheWouldDo)
    expect(c.misses).toBeLessThanOrEqual(noCacheWouldDo)
    expect(networkCacheSize()).toBe(NETWORK_CACHE_MAX_ENTRIES)
  })

  it('at capacity+1 with a ROTATING start order, still never worse than no cache', async () => {
    // Same span, traversed from a different key each round, so the figure above is
    // not an artifact of one traversal. Rotation lets a few accesses land on the key
    // that happens to still be resident, so this is a bound rather than an equality.
    const rounds = 5
    const span = NETWORK_CACHE_MAX_ENTRIES + 1
    const c = countingLoader()

    for (let r = 0; r < rounds; r++) {
      for (let i = 0; i < span; i++) {
        const n = (i + r) % span
        await cachedGet(key(n), c.load(key(n)))
      }
    }

    expect(c.misses).toBeLessThanOrEqual(rounds * span)
    expect(networkCacheSize()).toBe(NETWORK_CACHE_MAX_ENTRIES)
  })

  it('at capacity, repeated rounds do exactly one load per key however many rounds', async () => {
    // The other half of the same claim, and the reason the cache is worth having:
    // one key fewer and the same traversal costs a single pass, not one per round.
    const rounds = 5
    const span = NETWORK_CACHE_MAX_ENTRIES
    const c = countingLoader()

    for (let r = 0; r < rounds; r++) {
      for (let i = 0; i < span; i++) {
        const n = (i + r) % span
        await cachedGet(key(n), c.load(key(n)))
      }
    }

    expect(c.misses).toBe(span)
    expect(c.misses).toBeLessThan(rounds * span)
  })

  it('a TTL refresh of a key already held evicts nothing', async () => {
    // Fill the cache, giving ONE key a short TTL so only it expires. Re-requesting
    // it writes an entry for a key already present, which must not make room it does
    // not need — Map.set on a present key keeps its position and pushes nobody out.
    const SHORT = 1_000
    const c = countingLoader()
    for (let n = 0; n < NETWORK_CACHE_MAX_ENTRIES; n++) {
      await cachedGet(key(n), c.load(key(n)), n === 10 ? SHORT : NETWORK_CACHE_TTL_MS)
    }
    expect(networkCacheSize()).toBe(NETWORK_CACHE_MAX_ENTRIES)

    vi.advanceTimersByTime(SHORT + 1)
    const beforeRefresh = c.misses
    await cachedGet(key(10), c.load(key(10)))           // a re-load, not a new key
    expect(c.misses).toBe(beforeRefresh + 1)
    expect(networkCacheSize()).toBe(NETWORK_CACHE_MAX_ENTRIES)

    // Every other key is still resident: nothing was pushed out to make room.
    const beforeSweep = c.misses
    for (let n = 0; n < NETWORK_CACHE_MAX_ENTRIES; n++) await cachedGet(key(n), c.load(key(n)))
    expect(c.misses).toBe(beforeSweep)
  })

  it('cap-and-one concurrent loads all resolve, and the cap still holds', async () => {
    const c = countingLoader()
    const span = NETWORK_CACHE_MAX_ENTRIES + 1
    const all = await Promise.all(
      Array.from({ length: span }, (_, n) => cachedGet(key(n), c.load(key(n)))),
    )
    expect(all).toHaveLength(span)
    expect(all[0]).toBe(`payload:${key(0)}`)
    expect(all[span - 1]).toBe(`payload:${key(span - 1)}`)
    expect(networkCacheSize()).toBe(NETWORK_CACHE_MAX_ENTRIES)
  })

  it('clearNetworkCache empties it', async () => {
    const c = countingLoader()
    for (let n = 0; n < 10; n++) await cachedGet(key(n), c.load(key(n)))
    expect(networkCacheSize()).toBe(10)
    clearNetworkCache()
    expect(networkCacheSize()).toBe(0)
  })

  it('the cap is an entry count, and a modest one', () => {
    expect(Number.isInteger(NETWORK_CACHE_MAX_ENTRIES)).toBe(true)
    expect(NETWORK_CACHE_MAX_ENTRIES).toBe(64)
  })
})
