import { tauriFetch } from './http';

const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org';
const HEADERS = { 'User-Agent': 'SnowRaven/1.0' };

// Shared request-start limiter: Nominatim ToS requires ≤1 req/sec across
// BOTH public paths. Keep the tail independent of each response promise so a
// slow response does not delay later starts beyond what the provider requires.
interface RequestStartLimiter {
  lastRequestAt: number
  tail: Promise<void>
}

function newRequestStartLimiter(): RequestStartLimiter {
  return { lastRequestAt: 0, tail: Promise.resolve() }
}

let _requestStartLimiter = newRequestStartLimiter()

async function rateLimitedFetch(url: string): Promise<Response> {
  // Capture the limiter instance so a test reset can replace it without an old
  // queued turn later changing the fresh test's clock.
  const limiter = _requestStartLimiter
  let request: Promise<Response>
  const start = limiter.tail.then(async () => {
    const elapsed = Date.now() - limiter.lastRequestAt
    if (elapsed < 1000) {
      await new Promise(resolve => setTimeout(resolve, 1000 - elapsed))
    }
    limiter.lastRequestAt = Date.now()
    // Invoke inside the serialized turn: the timestamp describes the actual
    // outbound start, while deliberately not awaiting the response here.
    request = tauriFetch(url, { headers: HEADERS })
  })

  // A failed start turn must not poison later queue turns.
  limiter.tail = start.catch(() => {})
  await start
  return request!
}

function roundCoord(v: number): number {
  return Math.round(v * 10000) / 10000;
}

export interface GeoSearchResult {
  lat: string;
  lon: string;
  display_name?: string;
}

export async function forwardGeocode(q: string): Promise<GeoSearchResult[]> {
  const url = `${NOMINATIM_BASE}/search?q=${encodeURIComponent(q)}&format=json&limit=5`;
  const res = await rateLimitedFetch(url);
  if (!res.ok) throw new Error('Location search unavailable.');
  return res.json() as Promise<GeoSearchResult[]>;
}

export interface LocationPoint { lat: number; lng: number }
export interface LocationResult { lat: number; lng: number; county: string | null }
export interface CountiesResponse { results: LocationResult[] }

// One ML export can carry tens of thousands of media rows, and the same process
// may load multiple disjoint exports. Retaining every rounded coordinate for
// the process lifetime is therefore unbounded. Admission control keeps the
// first useful working set and then stops growing; unlike FIFO it cannot turn a
// capacity+1 request/repeat sequence into one Nominatim call per item.
//
// 4,096 distinct sites is deliberately far above the 10 unique locations in
// the bundled 515-row demo export, while bounding the retained coordinate and
// county strings to a small, predictable process-lifetime set.
export const NOMINATIM_COUNTY_CACHE_MAX_ENTRIES = 4_096;

// In-process cache keyed by rounded coordinates. Nulls are intentional results
// (HTTP failure/no county/network failure) and remain repeatable cache hits.
let _countyCache = new Map<string, string | null>()
let _countyInflight = new Map<string, Promise<string | null>>()

function cacheCounty(
  cache: Map<string, string | null>,
  key: string,
  county: string | null,
): void {
  if (cache.size < NOMINATIM_COUNTY_CACHE_MAX_ENTRIES) {
    cache.set(key, county)
  }
}

async function reverseOne(lat: number, lng: number): Promise<string | null> {
  const key = `${roundCoord(lat)},${roundCoord(lng)}`;
  // Capture both maps so a test reset cannot let an old request populate or
  // delete an entry from the fresh test's process-lifetime state.
  const cache = _countyCache
  const inflight = _countyInflight
  if (cache.has(key)) return cache.get(key)!
  const pending = inflight.get(key)
  if (pending) return pending

  const url = `${NOMINATIM_BASE}/reverse?format=json&lat=${lat}&lon=${lng}`;
  const lookup = (async () => {
    try {
      const res = await rateLimitedFetch(url)
      if (!res.ok) { cacheCounty(cache, key, null); return null }
      const data = await res.json() as { address?: { county?: string } }
      const county = data.address?.county ?? null
      cacheCounty(cache, key, county)
      return county
    } catch {
      cacheCounty(cache, key, null)
      return null
    } finally {
      inflight.delete(key)
    }
  })()
  inflight.set(key, lookup)
  return lookup
}

export async function reverseGeocodeCounties(locations: LocationPoint[]): Promise<CountiesResponse> {
  // Deduplicate by rounded coord
  const seen = new Map<string, LocationPoint>();
  for (const loc of locations) {
    const key = `${roundCoord(loc.lat)},${roundCoord(loc.lng)}`;
    seen.set(key, loc);
  }

  const results: LocationResult[] = [];
  for (const loc of seen.values()) {
    const county = await reverseOne(loc.lat, loc.lng);
    results.push({ lat: loc.lat, lng: loc.lng, county });
  }

  return { results };
}

/** Test seam: replace all process-lifetime cache, in-flight and limiter state. */
export function __resetNominatimCountyCacheForTests(): void {
  _countyCache = new Map()
  _countyInflight = new Map()
  _requestStartLimiter = newRequestStartLimiter()
}

/** Test seam: retained entries only; callers still use the public APIs above. */
export function __nominatimCountyCacheSizeForTests(): number {
  return _countyCache.size;
}
