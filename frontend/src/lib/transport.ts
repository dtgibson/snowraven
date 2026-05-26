import { isTauri } from './platform';

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

    if (path === '/version/check') {
      const { checkVersion } = await import('./tauri/versionService');
      return checkVersion() as Promise<T>;
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

export const transport: TransportAdapter = isTauri()
  ? new TauriTransport()
  : new WebTransport();
