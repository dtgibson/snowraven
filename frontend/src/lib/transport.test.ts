import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { clearNetworkCache } from './networkCache';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  clearNetworkCache();
});

describe('WebTransport.get', () => {
  it('builds the correct URL with params and returns parsed JSON', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ result: 'ok' }),
    }));
    const { transport } = await import('./transport');
    const result = await transport.get('/taxonomy', { fmt: 'json' });
    expect(vi.mocked(fetch)).toHaveBeenCalledWith('/taxonomy?fmt=json');
    expect(result).toEqual({ result: 'ok' });
  });

  it('throws on non-ok response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404 }));
    const { transport } = await import('./transport');
    await expect(transport.get('/weather')).rejects.toThrow('Transport error: 404');
  });
});

describe('short-TTL network cache (transport seam)', () => {
  const okFetch = (payload: unknown) => vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve(payload),
  });

  it('a repeated GET with identical params hits fetch only once', async () => {
    vi.stubGlobal('fetch', okFetch([{ locId: 'L1' }]));
    const { transport } = await import('./transport');
    const params = { lat: '38.5', lng: '-121.5', dist: '40' };
    const a = await transport.get('/map/hotspots', params);
    const b = await transport.get('/map/hotspots', params);
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1);
    expect(b).toEqual(a);
  });

  it('a repeated /map/hotspot-region GET with the same regionCode hits fetch only once', async () => {
    vi.stubGlobal('fetch', okFetch(['L99']));
    const { transport } = await import('./transport');
    const a = await transport.get('/map/hotspot-region', { regionCode: 'US-CA' });
    const b = await transport.get('/map/hotspot-region', { regionCode: 'US-CA' });
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1); // pins the CACHED_GET_PATHS membership
    expect(b).toEqual(a);
  });

  it('a different regionCode misses the cache', async () => {
    vi.stubGlobal('fetch', okFetch([]));
    const { transport } = await import('./transport');
    await transport.get('/map/hotspot-region', { regionCode: 'US-CA' });
    await transport.get('/map/hotspot-region', { regionCode: 'US-MN' });
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(2);
  });

  it('different params miss the cache', async () => {
    vi.stubGlobal('fetch', okFetch([]));
    const { transport } = await import('./transport');
    await transport.get('/map/hotspots', { lat: '38.5', lng: '-121.5', dist: '8' });
    await transport.get('/map/hotspots', { lat: '38.5', lng: '-121.5', dist: '40' });
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(2);
  });

  it('species-code order does not miss the cache (codes are sorted into the key)', async () => {
    vi.stubGlobal('fetch', okFetch([]));
    const { transport } = await import('./transport');
    await transport.get('/map/recent-obs', { lat: '38.5', lng: '-121.5', dist: '40', codes: 'amecro,annhum' });
    await transport.get('/map/recent-obs', { lat: '38.5', lng: '-121.5', dist: '40', codes: 'annhum,amecro' });
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1);
  });

  it('a failed GET is not cached — the retry re-fetches', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 502 })
      .mockResolvedValue({ ok: true, json: () => Promise.resolve([]) });
    vi.stubGlobal('fetch', fetchMock);
    const { transport } = await import('./transport');
    const params = { lat: '38.5', lng: '-121.5', dist: '40' };
    await expect(transport.get('/map/hotspots', params)).rejects.toThrow('Transport error: 502');
    await expect(transport.get('/map/hotspots', params)).resolves.toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('uncached paths always fetch', async () => {
    vi.stubGlobal('fetch', okFetch({}));
    const { transport } = await import('./transport');
    await transport.get('/version/check');
    await transport.get('/version/check');
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(2);
  });
});

describe('CachedTransport.getReplayable (opt-in replay)', () => {
  // Isolate the transport contract from the real replay store / classifier by
  // mocking both seams. Each test resets the doubles.
  const put = vi.fn();
  const get = vi.fn();
  const replayKey = vi.fn((path: string, params?: Record<string, string>) =>
    `${path}|${JSON.stringify(params ?? {})}`);
  const offline = vi.fn();

  beforeEach(() => {
    vi.resetModules();
    put.mockReset();
    get.mockReset().mockResolvedValue(null);
    replayKey.mockClear();
    offline.mockReset().mockReturnValue(false);
    vi.doMock('./replayStore', () => ({ put, get, replayKey }));
    vi.doMock('./offlineDetect', () => ({ isOfflineError: offline, isNoKeyError: () => false }));
  });

  afterEach(() => {
    vi.doUnmock('./replayStore');
    vi.doUnmock('./offlineDetect');
  });

  it('success → puts the result and returns replayedAt:null (fresh)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true, json: () => Promise.resolve({ formatted: 'sunny' }),
    }));
    const { transport } = await import('./transport');
    const res = await transport.getReplayable<{ formatted: string }>('/weather/S1');
    expect(res).toEqual({ data: { formatted: 'sunny' }, replayedAt: null });
    expect(put).toHaveBeenCalledWith('/weather/S1|{}', { formatted: 'sunny' });
  });

  it('offline error WITH a prior hit → returns the hit + its loadedAt, no put', async () => {
    offline.mockReturnValue(true);
    get.mockResolvedValue({ data: { formatted: 'cached' }, loadedAt: 1718000000000, bytes: 30 });
    // A bare TypeError (no status) — the web network-failure shape.
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    const { transport } = await import('./transport');
    const res = await transport.getReplayable<{ formatted: string }>('/weather/S1');
    expect(res).toEqual({ data: { formatted: 'cached' }, replayedAt: 1718000000000 });
    expect(put).not.toHaveBeenCalled(); // NEVER put on failure (FR-34)
  });

  it('offline error with NO hit → rethrows', async () => {
    offline.mockReturnValue(true);
    get.mockResolvedValue(null);
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    const { transport } = await import('./transport');
    await expect(transport.getReplayable('/weather/S1')).rejects.toThrow('Failed to fetch');
    expect(put).not.toHaveBeenCalled();
  });

  it('a NON-offline (HTTP) error rethrows and does NOT overwrite the prior entry (QA-25)', async () => {
    offline.mockReturnValue(false); // HTTP error → not offline
    // Even if a hit existed, it must NOT be consulted on a non-offline error.
    get.mockResolvedValue({ data: { formatted: 'cached' }, loadedAt: 1, bytes: 1 });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 502 }));
    const { transport } = await import('./transport');
    await expect(transport.getReplayable('/weather/S1')).rejects.toThrow('Transport error: 502');
    expect(put).not.toHaveBeenCalled(); // no overwrite/clear on failure
    expect(get).not.toHaveBeenCalled(); // HTTP error never reaches the replay lookup
  });
});

describe('WebTransport.post', () => {
  it('sends JSON body with correct headers and returns parsed JSON', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ codes: {} }),
    }));
    const { transport } = await import('./transport');
    await transport.post('/taxonomy/codes', [{ commonName: 'Robin' }]);
    expect(vi.mocked(fetch)).toHaveBeenCalledWith('/taxonomy/codes', expect.objectContaining({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([{ commonName: 'Robin' }]),
    }));
  });

  it('throws on non-ok response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }));
    const { transport } = await import('./transport');
    await expect(transport.post('/settings', {})).rejects.toThrow('Transport error: 500');
  });
});
