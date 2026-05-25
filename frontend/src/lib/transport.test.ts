import { describe, it, expect, vi, afterEach } from 'vitest';

afterEach(() => {
  vi.restoreAllMocks();
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
