import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock the storage seam: an in-memory replay store the module reads once and
// writes back through. We capture the last setReplayStore payload too.
let _disk: import('./storage').ReplayStore | null = null;
const setSpy = vi.fn(async (store: import('./storage').ReplayStore) => { _disk = store; });
const getSpy = vi.fn(async () => _disk);

vi.mock('./storage', () => ({
  storage: {
    getReplayStore: () => getSpy(),
    setReplayStore: (s: import('./storage').ReplayStore) => setSpy(s),
  },
}));

import * as replayStore from './replayStore';

// `put`'s third argument — the purge generation captured BEFORE the request —
// is required, so the production chokepoint cannot forget it (clear-means-clear;
// transport.getReplayable captures it above its GET). These tests are about
// keying, caps and eviction rather than that race, so they capture at call time,
// which is what a caller with nothing in flight would do.
const put = (key: string, data: unknown): Promise<void> =>
  replayStore.put(key, data, replayStore.purgeGeneration());

beforeEach(() => {
  vi.useFakeTimers();
  _disk = null;
  getSpy.mockClear();
  setSpy.mockClear();
  replayStore._resetReplayStoreForTests();
  replayStore.setReplayMaxEntries(300);
  replayStore.setReplayMaxBytes(3_000_000);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('replayKey', () => {
  it('strips `force` so a forced reload matches the un-forced key', () => {
    expect(replayStore.replayKey('/tide/S1', { force: '1' }))
      .toBe(replayStore.replayKey('/tide/S1'));
    expect(replayStore.replayKey('/tide/S1', { force: '1' }))
      .toBe(replayStore.replayKey('/tide/S1', {}));
  });

  it('keeps non-force params distinct (force is the only stripped dimension)', () => {
    expect(replayStore.replayKey('/tide/at', { lat: '38.5', lng: '-121.5', dt: '100', force: '1' }))
      .toBe(replayStore.replayKey('/tide/at', { lat: '38.5', lng: '-121.5', dt: '100' }));
    expect(replayStore.replayKey('/tide/at', { lat: '38.5', lng: '-121.5', dt: '100' }))
      .not.toBe(replayStore.replayKey('/tide/at', { lat: '38.5', lng: '-121.5', dt: '200' }));
  });

  it('keys the four replay path shapes sanely (distinct, dt verbatim)', () => {
    const weatherId = replayStore.replayKey('/weather/S123');
    const weatherAt = replayStore.replayKey('/weather/at', { lat: '1.234567', lng: '2', dt: '1700000000' });
    const tideId = replayStore.replayKey('/tide/S123');
    const checklist = replayStore.replayKey('/checklists/S123');
    const all = [weatherId, weatherAt, tideId, checklist];
    expect(new Set(all).size).toBe(4); // all distinct
    // lat is rounded (networkCacheKey contract) but dt passes through verbatim.
    expect(weatherAt).toContain('dt=1700000000');
    expect(weatherAt).toContain('lat=1.23457');
    expect(tideId).not.toBe(weatherId); // path is part of the key
  });
});

describe('put / get round-trip', () => {
  it('put stores data with loadedAt + bytes; get returns the entry', async () => {
    vi.setSystemTime(new Date('2026-06-20T12:00:00Z'));
    await put('/weather/S1?', { formatted: 'sunny' });
    const hit = await replayStore.get('/weather/S1?');
    expect(hit).not.toBeNull();
    expect(hit!.data).toEqual({ formatted: 'sunny' });
    expect(hit!.loadedAt).toBe(Date.parse('2026-06-20T12:00:00Z'));
    expect(hit!.bytes).toBe(JSON.stringify({ formatted: 'sunny' }).length);
  });

  it('get returns null on a miss', async () => {
    expect(await replayStore.get('/nope')).toBeNull();
  });

  it('getReplayedAt returns the timestamp or null', async () => {
    vi.setSystemTime(new Date('2026-06-20T08:00:00Z'));
    await put('/tide/S9?', { body: 'x' });
    expect(await replayStore.getReplayedAt('/tide/S9?')).toBe(Date.parse('2026-06-20T08:00:00Z'));
    expect(await replayStore.getReplayedAt('/tide/missing')).toBeNull();
  });

  it('re-putting a key updates data + loadedAt and keeps one entry', async () => {
    vi.setSystemTime(new Date('2026-06-20T01:00:00Z'));
    await put('/weather/S1?', { v: 1 });
    vi.setSystemTime(new Date('2026-06-20T02:00:00Z'));
    await put('/weather/S1?', { v: 2 });
    const hit = await replayStore.get('/weather/S1?');
    expect(hit!.data).toEqual({ v: 2 });
    expect(hit!.loadedAt).toBe(Date.parse('2026-06-20T02:00:00Z'));
  });
});

describe('eviction (OQ-07 / QA-24)', () => {
  it('CAP+1 distinct puts → exactly CAP entries, oldest-loaded evicted, most-recent survives', async () => {
    replayStore.setReplayMaxEntries(5);
    for (let i = 0; i < 6; i++) {
      await put(`/weather/S${i}?`, { i });
    }
    // CAP = 5: S0 (oldest) evicted, S1..S5 remain.
    expect(await replayStore.get('/weather/S0?')).toBeNull();
    expect(await replayStore.get('/weather/S5?')).not.toBeNull(); // most-recent survives
    let count = 0;
    for (let i = 0; i < 6; i++) {
      if (await replayStore.get(`/weather/S${i}?`)) count++;
    }
    expect(count).toBe(5);
  });

  it('re-putting an existing oldest key moves it to the tail (it is no longer the eviction victim)', async () => {
    replayStore.setReplayMaxEntries(3);
    await put('/a', { n: 1 });
    await put('/b', { n: 2 });
    await put('/c', { n: 3 });
    await put('/a', { n: 11 }); // a → tail; order now b,c,a
    await put('/d', { n: 4 });  // over cap → evict b (now oldest)
    expect(await replayStore.get('/b')).toBeNull();
    expect(await replayStore.get('/a')).not.toBeNull();
    expect((await replayStore.get('/a'))!.data).toEqual({ n: 11 });
  });

  it('stays within the payload-length budget when more than one entry remains', async () => {
    // Each entry is ~120 serialized code units; a ~300-code-unit budget leaves
    // about two entries.
    const big = (i: number) => ({ pad: 'x'.repeat(100), i });
    replayStore.setReplayMaxBytes(JSON.stringify(big(0)).length * 2 + 10);
    for (let i = 0; i < 5; i++) await put(`/k${i}`, big(i));
    let total = 0, count = 0;
    for (let i = 0; i < 5; i++) {
      const hit = await replayStore.get(`/k${i}`);
      if (hit) { total += hit.bytes; count++; }
    }
    expect(total).toBeLessThanOrEqual(JSON.stringify(big(0)).length * 2 + 10);
    expect(await replayStore.get('/k4')).not.toBeNull(); // most-recent survives
    expect(count).toBeGreaterThanOrEqual(1);
  });

  it('keeps one sole newest entry even when it exceeds the payload-length budget', async () => {
    replayStore.setReplayMaxBytes(10);
    await put('/huge', { pad: 'x'.repeat(1000) });
    expect(await replayStore.get('/huge')).not.toBeNull();
  });

  it('debounced write persists the whole document through the seam', async () => {
    await put('/weather/S1?', { v: 1 });
    expect(setSpy).not.toHaveBeenCalled(); // debounced, not yet flushed
    await vi.advanceTimersByTimeAsync(300);
    expect(setSpy).toHaveBeenCalledTimes(1);
    const written = setSpy.mock.calls[0][0];
    expect(written.entries['/weather/S1?']).toBeDefined();
    expect(written.order).toContain('/weather/S1?');
  });

  it('real CAPACITY+1 from seeded disk is one bounded FIFO shift and one snapshot', async () => {
    const cap = 300;
    const entries: import('./storage').ReplayStore['entries'] = {};
    const order: string[] = [];
    for (let i = 0; i < cap; i++) {
      const key = `/weather/S${i}?`;
      const data = { i };
      order.push(key);
      entries[key] = { data, loadedAt: i, bytes: JSON.stringify(data).length };
    }
    _disk = { version: 1, entries, order };

    const newest = '/weather/S300?';
    await put(newest, { i: cap });
    expect(await replayStore.get('/weather/S0?')).toBeNull();
    expect(await replayStore.get(newest)).not.toBeNull();

    let work = replayStore._getReplayStoreWorkStatsForTests();
    expect(work).toMatchObject({
      puts: 1,
      orderSearches: 1,
      orderSearchSlots: cap,
      orderMoves: 0,
      evictions: 1,
      shiftedSlots: cap,
      writeSchedules: 1,
      writeFlushes: 0,
    });
    expect(getSpy).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(300);
    work = replayStore._getReplayStoreWorkStatsForTests();
    expect(work.writeFlushes).toBe(1);
    expect(work.lastSnapshotEntries).toBe(cap);
    expect(work.lastSnapshotEntryBytes).toBe(
      Object.values(_disk!.entries).reduce((sum, entry) => sum + entry.bytes, 0),
    );
    expect(work.lastSnapshotBytes).toBe(JSON.stringify(_disk).length);
    expect(setSpy).toHaveBeenCalledTimes(1);

    // A replay hit is a pure mirror read: it schedules no extra persistence.
    expect((await replayStore.get(newest))?.data).toEqual({ i: cap });
    expect(replayStore._getReplayStoreWorkStatsForTests()).toEqual(work);
  });

  it('real PAYLOAD-LENGTH-BUDGET+1 from seeded disk evicts the oldest', async () => {
    const oldData = { pad: 'a'.repeat(60) };
    const newData = { pad: 'b'.repeat(60) };
    const oldBytes = JSON.stringify(oldData).length;
    const newBytes = JSON.stringify(newData).length;
    _disk = {
      version: 1,
      entries: { '/old': { data: oldData, loadedAt: 1, bytes: oldBytes } },
      order: ['/old'],
    };
    replayStore.setReplayMaxBytes(oldBytes + newBytes - 1);

    await put('/new', newData);
    expect(await replayStore.get('/old')).toBeNull();
    expect((await replayStore.get('/new'))?.bytes).toBe(newBytes);
    expect(replayStore._getReplayStoreWorkStatsForTests()).toMatchObject({
      puts: 1,
      evictions: 1,
      shiftedSlots: 1,
    });
  });
});

describe('load from a non-empty disk store', () => {
  it('seeds the mirror (and the byte total) from the existing on-disk entries', async () => {
    _disk = {
      version: 1,
      entries: {
        '/old/a': { data: { a: 1 }, loadedAt: 1000, bytes: 50 },
        '/old/b': { data: { b: 2 }, loadedAt: 2000, bytes: 50 },
      },
      order: ['/old/a', '/old/b'],
    };
    replayStore.setReplayMaxEntries(2);
    expect(await replayStore.get('/old/a')).not.toBeNull();
    // A new put over the entry cap evicts the oldest LOADED on-disk entry (/old/a).
    await put('/new/c', { c: 3 });
    expect(await replayStore.get('/old/a')).toBeNull();
    expect(await replayStore.get('/old/b')).not.toBeNull();
    expect(await replayStore.get('/new/c')).not.toBeNull();
  });
});
