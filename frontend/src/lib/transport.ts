import { isTauri } from './platform';
import { cachedGet, networkCacheKey } from './networkCache';
import { isOfflineError } from './offlineDetect';
import * as replayStore from './replayStore';

// A GET that may fall back to a last-loaded ("replayed") copy when the device is
// offline. `replayedAt` is null for a fresh/live result and the entry's loadedAt
// (ms epoch) when the value came from the replay store (FR-31/FR-37 staleness
// channel — Promise<T> alone carries no provenance).
export interface ReplayableResult<T> {
  data: T;
  replayedAt: number | null;
}

export interface TransportAdapter {
  get<T>(path: string, params?: Record<string, string>): Promise<T>;
  post<T>(path: string, body: unknown): Promise<T>;
  // Opt-in replay (FR-38: per call-site, never a transparent path-only gate).
  // Only consumers that want offline replay call this; plain get()/post() are
  // unchanged, so the Checklist Comparer and every other caller stay no-replay.
  getReplayable<T>(path: string, params?: Record<string, string>): Promise<ReplayableResult<T>>;
}

export class TransportError extends Error {
  readonly status: number;
  readonly detail?: string;

  constructor(message: string, status: number, detail?: string) {
    super(message);
    this.name = 'TransportError';
    this.status = status;
    this.detail = detail;
  }
}

class WebTransport implements TransportAdapter {
  async get<T>(path: string, params?: Record<string, string>): Promise<T> {
    const url = params && Object.keys(params).length > 0
      ? `${path}?${new URLSearchParams(params).toString()}`
      : path;
    const res = await fetch(url);
    if (!res.ok) {
      let detail: string | undefined;
      try { detail = (await res.json() as { detail?: string }).detail; } catch { /* ok */ }
      throw new TransportError(`Transport error: ${res.status}`, res.status, detail);
    }
    return res.json() as Promise<T>;
  }

  async post<T>(path: string, body: unknown): Promise<T> {
    const res = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      let detail: string | undefined;
      try { detail = (await res.json() as { detail?: string }).detail; } catch { /* ok */ }
      throw new TransportError(`Transport error: ${res.status}`, res.status, detail);
    }
    return res.json() as Promise<T>;
  }

  // The replay decoration lives in CachedTransport (the one chokepoint covering
  // BOTH runtimes). A bare WebTransport — only reachable when not wrapped — has
  // no store, so it returns the live result as always-fresh.
  async getReplayable<T>(path: string, params?: Record<string, string>): Promise<ReplayableResult<T>> {
    return { data: await this.get<T>(path, params), replayedAt: null };
  }
}

class TauriTransport implements TransportAdapter {
  private web = new WebTransport();

  async get<T>(path: string, params?: Record<string, string>): Promise<T> {
    // Route external API paths to direct Tauri service calls.
    // NOTE: the exact '/weather/at' and '/tide/at' matches MUST come before the
    // '/weather/' and '/tide/' prefix checks below, which would otherwise treat
    // "at" as a checklist id (mirrors the FastAPI route-order requirement).
    if (path === '/weather/at') {
      const { getWeatherAt } = await import('./tauri/weatherService');
      const lat = parseFloat(params?.lat ?? '0');
      const lng = parseFloat(params?.lng ?? '0');
      return getWeatherAt(lat, lng, params?.dt) as Promise<T>;
    }

    if (path === '/tide/at') {
      const { getTideAt } = await import('./tauri/tideService');
      const lat = parseFloat(params?.lat ?? '0');
      const lng = parseFloat(params?.lng ?? '0');
      return getTideAt(lat, lng, params?.dt ?? '', params?.force === '1') as Promise<T>;
    }

    if (path.startsWith('/weather/')) {
      const { getWeather } = await import('./tauri/weatherService');
      const checklistId = path.slice('/weather/'.length);
      return getWeather(checklistId) as Promise<T>;
    }

    if (path.startsWith('/checklists/')) {
      const { getChecklist } = await import('./tauri/checklistService');
      const checklistId = path.slice('/checklists/'.length);
      return getChecklist(checklistId) as Promise<T>;
    }

    if (path === '/version/check') {
      const { checkVersion } = await import('./tauri/versionService');
      return checkVersion() as Promise<T>;
    }

    if (path.startsWith('/tide/')) {
      const { getTide } = await import('./tauri/tideService');
      const checklistId = path.slice('/tide/'.length);
      return getTide(checklistId, params?.force === '1') as Promise<T>;
    }

    if (path === '/nominatim/search') {
      const { forwardGeocode } = await import('./tauri/nominatimService');
      return forwardGeocode(params?.q ?? '') as Promise<T>;
    }

    if (path === '/map/hotspots') {
      const { getHotspots } = await import('./tauri/mapService');
      const lat = parseFloat(params?.lat ?? '0');
      const lng = parseFloat(params?.lng ?? '0');
      const dist = parseInt(params?.dist ?? '25', 10);
      return getHotspots(lat, lng, dist) as Promise<T>;
    }

    if (path === '/map/hotspot-region') {
      const { getHotspotRegion } = await import('./tauri/mapService');
      return getHotspotRegion(params?.regionCode ?? '') as Promise<T>;
    }

    if (path === '/map/recent-obs') {
      const { getRecentObs } = await import('./tauri/mapService');
      const lat = parseFloat(params?.lat ?? '0');
      const lng = parseFloat(params?.lng ?? '0');
      const dist = parseInt(params?.dist ?? '25', 10);
      const codes = params?.codes ?? '';
      return getRecentObs(lat, lng, dist, codes) as Promise<T>;
    }

    return this.web.get<T>(path, params);
  }

  async post<T>(path: string, body: unknown): Promise<T> {
    if (path === '/taxonomy/codes') {
      const { getTaxonomyCodes } = await import('./tauri/taxonomyService');
      const { species } = body as { species: Array<{ commonName: string; scientificName: string }> };
      return getTaxonomyCodes(species) as Promise<T>;
    }

    if (path === '/nominatim/counties') {
      const { reverseGeocodeCounties } = await import('./tauri/nominatimService');
      const { locations } = body as { locations: Array<{ lat: number; lng: number }> };
      return reverseGeocodeCounties(locations) as Promise<T>;
    }

    return this.web.post<T>(path, body);
  }

  // See WebTransport.getReplayable — replay is owned by CachedTransport; a bare
  // TauriTransport returns the live result as always-fresh.
  async getReplayable<T>(path: string, params?: Record<string, string>): Promise<ReplayableResult<T>> {
    return { data: await this.get<T>(path, params), replayedAt: null };
  }
}

// Live eBird data fetched on explicit user actions; repeat requests with the
// same params (re-clicking Find, bouncing between map view tabs) are served
// from the short-TTL cache instead of re-hitting eBird. Decorating the
// transport covers BOTH runtimes — web/Pi (FastAPI) and desktop (TS services) —
// at their one common chokepoint. Errors are never cached (see networkCache).
const CACHED_GET_PATHS = new Set(['/map/hotspots', '/map/recent-obs', '/map/hotspot-region']);

class CachedTransport implements TransportAdapter {
  private inner: TransportAdapter;

  constructor(inner: TransportAdapter) {
    this.inner = inner;
  }

  get<T>(path: string, params?: Record<string, string>): Promise<T> {
    if (CACHED_GET_PATHS.has(path)) {
      return cachedGet(networkCacheKey(path, params), () => this.inner.get<T>(path, params));
    }
    return this.inner.get<T>(path, params);
  }

  // Opt-in replay (1c). On a successful live GET, persist the result to the
  // replay store and return it as fresh (replayedAt null). On FAILURE, only an
  // OFFLINE (connection-level) error with a prior replay hit returns the stale
  // copy (replayedAt = its loadedAt); an HTTP error — or an offline error with
  // no hit — rethrows. NEVER put on failure (FR-34/QA-25): a failed live fetch
  // never overwrites or clears the prior entry, so errors are never cached.
  async getReplayable<T>(path: string, params?: Record<string, string>): Promise<ReplayableResult<T>> {
    const key = replayStore.replayKey(path, params);
    try {
      const data = await this.get<T>(path, params);
      void replayStore.put(key, data); // best-effort, off the blocking path
      return { data, replayedAt: null };
    } catch (err) {
      if (isOfflineError(err)) {
        const hit = await replayStore.get(key);
        if (hit) return { data: hit.data as T, replayedAt: hit.loadedAt };
      }
      throw err;
    }
  }

  post<T>(path: string, body: unknown): Promise<T> {
    return this.inner.post<T>(path, body);
  }
}

export const transport: TransportAdapter = new CachedTransport(
  isTauri() ? new TauriTransport() : new WebTransport(),
);
