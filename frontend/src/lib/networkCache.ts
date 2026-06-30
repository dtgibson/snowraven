// Short-TTL in-memory cache for live eBird network data (hotspots, recent
// observations, region info). Repeat requests with the same params —
// re-clicking Find, bouncing between view tabs, re-running the same address
// search — hit the cache instead of eBird for the TTL window.
//
// Shape mirrors the established cache idiom (observationsCache / mlExportCache /
// taxonomyService): module-level state, in-flight coalescing so concurrent
// first-callers share one request, and a generation counter so a clear() during
// an in-flight load can't repopulate stale data. Failures are NEVER cached — a
// rejected loader leaves no entry, so a transient eBird 401/502 (e.g. before
// the user fixes their API key) doesn't stick for the TTL.
//
// Deliberately NOT wired into clearEbirdObservationsCache/clearMLExportCache
// (Settings file save/delete): this is live eBird data, not derived from the
// uploaded CSVs, so a file re-upload must not clear it. The short TTL is the
// sole staleness control. clearNetworkCache() exists for tests.

export const NETWORK_CACHE_TTL_MS = 90_000

interface Entry {
  data: unknown
  expires: number
}

const cache = new Map<string, Entry>()
const inflight = new Map<string, Promise<unknown>>()
let generation = 0

/**
 * Return the cached value for `key` if fresh; otherwise run `loader` (sharing
 * one in-flight call per key) and cache its result for `ttlMs`.
 */
export function cachedGet<T>(key: string, loader: () => Promise<T>, ttlMs = NETWORK_CACHE_TTL_MS): Promise<T> {
  const hit = cache.get(key)
  if (hit && hit.expires > Date.now()) return Promise.resolve(hit.data as T)

  const pending = inflight.get(key)
  if (pending) return pending as Promise<T>

  const myGen = generation
  const p = loader()
    .then(data => {
      if (myGen === generation) cache.set(key, { data, expires: Date.now() + ttlMs })
      return data
    })
    .finally(() => {
      if (inflight.get(key) === p) inflight.delete(key)
    })
  inflight.set(key, p)
  return p
}

/** Drop everything; loads already in flight will not repopulate. */
export function clearNetworkCache(): void {
  cache.clear()
  inflight.clear()
  generation++
}

/**
 * Stable cache key for a transport GET: path + sorted params, with lat/lng
 * rounded to 5 decimals (≈1 m — coalesces trivially-different centers without
 * merging meaningfully different ones) and comma lists (species codes) sorted
 * so insertion order can't miss the cache.
 */
export function networkCacheKey(path: string, params?: Record<string, string>): string {
  const parts = Object.keys(params ?? {}).sort().map(k => {
    const v = (params as Record<string, string>)[k]
    if (k === 'lat' || k === 'lng') {
      const n = parseFloat(v)
      return `${k}=${Number.isFinite(n) ? n.toFixed(5) : v}`
    }
    if (k === 'codes') {
      return `${k}=${v.split(',').map(s => s.trim()).filter(Boolean).sort().join(',')}`
    }
    return `${k}=${v}`
  })
  return `${path}?${parts.join('&')}`
}
