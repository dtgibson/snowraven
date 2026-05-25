import { isTauri } from './platform';

export interface TransportAdapter {
  get<T>(path: string, params?: Record<string, string>): Promise<T>;
  post<T>(path: string, body: unknown): Promise<T>;
}

class WebTransport implements TransportAdapter {
  async get<T>(path: string, params?: Record<string, string>): Promise<T> {
    const url = params && Object.keys(params).length > 0
      ? `${path}?${new URLSearchParams(params).toString()}`
      : path;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Transport error: ${res.status}`);
    return res.json() as Promise<T>;
  }

  async post<T>(path: string, body: unknown): Promise<T> {
    const res = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`Transport error: ${res.status}`);
    return res.json() as Promise<T>;
  }
}

// Phase 0: TauriTransport delegates to WebTransport while the backend is still required.
// Phase 3: each proxy migrated here calls the external API directly instead of through FastAPI.
class TauriTransport implements TransportAdapter {
  private web = new WebTransport();

  async get<T>(path: string, params?: Record<string, string>): Promise<T> {
    return this.web.get<T>(path, params);
  }

  async post<T>(path: string, body: unknown): Promise<T> {
    return this.web.post<T>(path, body);
  }
}

export const transport: TransportAdapter = isTauri()
  ? new TauriTransport()
  : new WebTransport();
