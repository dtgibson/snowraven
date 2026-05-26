import { fetch as tauriFetch } from '@tauri-apps/plugin-http';

const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org';
const HEADERS = { 'User-Agent': 'SnowRaven/1.0' };

// Serial rate-limiter: Nominatim ToS requires ≤1 req/sec
let _lastRequestAt = 0;

async function rateLimitedFetch(url: string): Promise<Response> {
  const now = Date.now();
  const elapsed = now - _lastRequestAt;
  if (elapsed < 1000) {
    await new Promise(resolve => setTimeout(resolve, 1000 - elapsed));
  }
  _lastRequestAt = Date.now();
  return tauriFetch(url, { headers: HEADERS });
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

// In-process cache keyed by rounded coordinates
const _countyCache = new Map<string, string | null>();

async function reverseOne(lat: number, lng: number): Promise<string | null> {
  const key = `${roundCoord(lat)},${roundCoord(lng)}`;
  if (_countyCache.has(key)) return _countyCache.get(key)!;

  const url = `${NOMINATIM_BASE}/reverse?format=json&lat=${lat}&lon=${lng}`;
  try {
    const res = await rateLimitedFetch(url);
    if (!res.ok) { _countyCache.set(key, null); return null; }
    const data = await res.json() as { address?: { county?: string } };
    const county = data.address?.county ?? null;
    _countyCache.set(key, county);
    return county;
  } catch {
    _countyCache.set(key, null);
    return null;
  }
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
