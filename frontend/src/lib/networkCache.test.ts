import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { cachedGet, clearNetworkCache, networkCacheKey, NETWORK_CACHE_TTL_MS } from './networkCache'

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
      .not.toBe(networkCacheKey('/stats/nemesis', { lat: '1', lng: '2' }))
    expect(networkCacheKey('/map/hotspots', { dist: '8' }))
      .not.toBe(networkCacheKey('/map/hotspots', { dist: '40' }))
  })
})
