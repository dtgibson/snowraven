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
//
// RETENTION. The header above used to say this "mirrors the established cache
// idiom", and that idiom is SINGLE-SLOT — this is a growing Map, and it had
// expire-on-read only: no cap and no sweep. An expired entry is
// dropped when its own key is asked for again and never otherwise, and the key
// rounds lat/lng to 5 decimals (~1 m), so every distinct map search center added a
// permanent entry holding a full eBird payload for the life of the session. It was
// also the one cache missing from cacheInventory.test.ts, which is why it drifted.
//
// The bound is FIFO, per DECISIONS.md (v0.5.86): capacity+1 is a MEASUREMENT rule,
// not one eviction policy, and the policy follows what an eviction COSTS. Here it
// costs one redundant eBird request — the same trade the county-completeness and
// replay stores make — so FIFO is right and admission control (which would freeze
// the cache on the first 64 centers of a session and never serve a new one) is not.
//
// The cap is stated STRUCTURALLY as an entry count, never as a byte product: entries
// are whole eBird payloads whose size is not ours to predict. 64 entries is roughly
// 10 distinct search centers, since one center populates several keys (/map/hotspots,
// /map/recent-obs, /map/hotspot-region, /map/county-species, plus the desktop raw
// recent-obs key) — comfortably more than a 90 s TTL window can make useful. Region
// -info keys (below) share the same 64 slots, so heavy hotspot browsing trims that
// figure; it costs a redundant request inside one TTL window, never a wrong answer.
//
// ALL THREE entry points funnel through cachedGet — the transport's CachedTransport.get
// (transport.ts), the desktop raw path (tauri/mapService.ts) and desktop region-info
// lookups (tauri/regionInfo.ts) — so the cap holds on every one of them by
// construction rather than by each caller remembering it. A fourth caller inherits it
// the same way; that is the point of capping at the chokepoint.

export const NETWORK_CACHE_TTL_MS = 90_000
export const NETWORK_CACHE_MAX_ENTRIES = 64

interface Entry {
  data: unknown
  expires: number
}

const cache = new Map<string, Entry>()
const inflight = new Map<string, Promise<unknown>>()
let generation = 0

/** Insert under FIFO: a NEW key evicts the oldest-inserted entries until the cap
 *  holds. Re-setting an existing key (a TTL refresh) keeps its original position and
 *  evicts nothing — Map.set on a present key does not reorder it. */
function put(key: string, entry: Entry): void {
  if (!cache.has(key)) {
    while (cache.size >= NETWORK_CACHE_MAX_ENTRIES) {
      const oldest = cache.keys().next()
      if (oldest.done) break
      cache.delete(oldest.value)
    }
  }
  cache.set(key, entry)
}

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
      if (myGen === generation) put(key, { data, expires: Date.now() + ttlMs })
      return data
    })
    .finally(() => {
      if (inflight.get(key) === p) inflight.delete(key)
    })
  inflight.set(key, p)
  return p
}

/** Number of entries currently retained. Exists so the cap can be asserted
 *  structurally (an entry count, never a byte product); nothing in the app reads it. */
export function networkCacheSize(): number {
  return cache.size
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
  // Values are percent-encoded so a value containing '&' or '=' cannot forge a
  // second parameter and land on another request's key: without it,
  // {codes:'abc&dist=25'} and {codes:'abc', dist:'25'} produce the same string.
  // No shipped caller passes free text today, so this closes the shape rather
  // than a reachable path — the same encodeURIComponent discipline CLAUDE.md
  // already requires of any id put into a URL.
  const enc = encodeURIComponent
  const parts = Object.keys(params ?? {}).sort().map(k => {
    const v = (params as Record<string, string>)[k]
    if (k === 'lat' || k === 'lng') {
      const n = parseFloat(v)
      return `${enc(k)}=${Number.isFinite(n) ? n.toFixed(5) : enc(v)}`
    }
    if (k === 'codes') {
      return `${enc(k)}=${enc(v.split(',').map(s => s.trim()).filter(Boolean).sort().join(','))}`
    }
    return `${enc(k)}=${enc(v)}`
  })
  return `${path}?${parts.join('&')}`
}
