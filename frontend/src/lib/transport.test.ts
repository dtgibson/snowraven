import { describe, it, expect, vi, afterEach } from 'vitest';
import { clearNetworkCache } from './networkCache';

afterEach(() => {
  vi.restoreAllMocks();
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
