import { isTauri } from './platform';
import { cachedGet, networkCacheKey } from './networkCache';

export interface TransportAdapter {
  get<T>(path: string, params?: Record<string, string>): Promise<T>;
  post<T>(path: string, body: unknown): Promise<T>;
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
}

class TauriTransport implements TransportAdapter {
  private web = new WebTransport();

  async get<T>(path: string, params?: Record<string, string>): Promise<T> {
    // Route external API paths to direct Tauri service calls
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

    if (path === '/stats/nemesis') {
      const { getNemesis } = await import('./tauri/statsService');
      const lat = parseFloat(params?.lat ?? '0');
      const lng = parseFloat(params?.lng ?? '0');
      const dist = parseInt(params?.dist ?? '25', 10);
      return getNemesis(lat, lng, dist) as Promise<T>;
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
}

// Live eBird data fetched on explicit user actions; repeat requests with the
// same params (re-clicking Find, bouncing between map view tabs) are served
// from the short-TTL cache instead of re-hitting eBird. Decorating the
// transport covers BOTH runtimes — web/Pi (FastAPI) and desktop (TS services) —
// at their one common chokepoint. Errors are never cached (see networkCache).
const CACHED_GET_PATHS = new Set(['/map/hotspots', '/map/recent-obs', '/stats/nemesis']);

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

  post<T>(path: string, body: unknown): Promise<T> {
    return this.inner.post<T>(path, body);
  }
}

export const transport: TransportAdapter = new CachedTransport(
  isTauri() ? new TauriTransport() : new WebTransport(),
);
