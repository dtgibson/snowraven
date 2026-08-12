// Replay store (FR-32 / FR-33 / FR-34, OQ-07) — the persistent last-loaded copy
// of each weather / tide / checklist GET, so a forecast/tide/checklist a birder
// loaded while online can be re-shown ("offline — last loaded at …") when the
// device is offline.
//
// This module owns the KEYING + the coalesced in-memory mirror + eviction. It is
// wired into transport.getReplayable (the one chokepoint covering BOTH runtimes).
// It runs PARALLEL to — and never replaces — networkCache.ts's 90 s in-memory
// cache (live coalescing); networkCache is NOT modified.
//
// Persistence rides the storage seam: getReplayStore() / setReplayStore(store)
// (own file data/replay.json on desktop; one-file-per-key on web/Pi).

import { networkCacheKey } from './networkCache';
import { storage } from './storage';
import type { ReplayStore, ReplayEntry } from './storage';

// OQ-07: 300 entries AND a 3,000,000-JSON-payload-code-unit budget, whichever
// fills first; oldest-loaded evicted. The budget excludes keys/envelopes and
// allows one sole oversized newest entry. Exported as mutable bindings so
// eviction tests can lower them (QA-24 needs CAP+1).
export let REPLAY_MAX_ENTRIES = 300;
export let REPLAY_MAX_BYTES = 3_000_000;

/** Test seam: override the entry cap (QA-24). */
export function setReplayMaxEntries(n: number): void { REPLAY_MAX_ENTRIES = n; }
/** Test seam: override the serialized payload-length budget. */
export function setReplayMaxBytes(n: number): void { REPLAY_MAX_BYTES = n; }

const EMPTY_STORE = (): ReplayStore => ({ version: 1, entries: {}, order: [] });

/**
 * Replay key for a path + params. Wraps networkCacheKey (the single source of
 * truth for path + sorted params + lat/lng rounding) but STRIPS `force` first.
 *
 * `force` is a cache-bust control (a forced /tide reload), NOT an identity
 * dimension — folding it would split the same reading across `/tide/S1` and
 * `/tide/S1?force=1`, so a user who forced a reload online would MISS on the
 * offline lookup. `dt` is left verbatim (networkCacheKey already passes it
 * through un-rounded), so the offline key is byte-identical to the live call.
 * networkCacheKey itself is untouched.
 */
export function replayKey(path: string, params?: Record<string, string>): string {
  if (params && 'force' in params) {
    const rest: Record<string, string> = {};
    for (const k of Object.keys(params)) {
      if (k !== 'force') rest[k] = params[k];
    }
    return networkCacheKey(path, rest);
  }
  return networkCacheKey(path, params);
}

// ── Coalesced in-memory mirror (NFR-02 / QA-38) ──────────────────────────────
// One disk read per session via ensureLoaded(); get() reads the mirror, put()
// mutates the mirror then debounce-writes the whole document via the seam.
let _store: ReplayStore | null = null;
let _loading: Promise<ReplayStore> | null = null;

async function ensureLoaded(): Promise<ReplayStore> {
  if (_store) return _store;
  if (_loading) return _loading;
  _loading = (async () => {
    const loaded = await storage.getReplayStore().catch(() => null);
    // Normalize a partial/legacy/absent store to the empty shape so callers
    // never branch on missing fields.
    _store = loaded && loaded.entries && loaded.order
      ? { version: loaded.version ?? 1, entries: loaded.entries, order: loaded.order }
      : EMPTY_STORE();
    return _store;
  })();
  try {
    return await _loading;
  } finally {
    _loading = null;
  }
}

/**
 * Read the replayed entry for `key` from the in-memory mirror, or null on a
 * miss. Returns the whole entry so the caller can read `loadedAt` (the FR-31
 * staleness timestamp) for the "loaded at <time>" cue.
 */
export async function get(key: string): Promise<ReplayEntry | null> {
  const store = await ensureLoaded();
  return store.entries[key] ?? null;
}

/** Convenience: the loadedAt timestamp for a key, or null on a miss. */
export async function getReplayedAt(key: string): Promise<number | null> {
  const hit = await get(key);
  return hit ? hit.loadedAt : null;
}

// Running sum of stored JSON payload lengths, maintained across puts. Seeded
// once from the loaded mirror on the first put of a session (the store may
// arrive non-empty from disk), then kept incrementally.
let _totalBytes = 0;
let _bytesSeeded = false;

// Deterministic capacity+1 accounting. The recorder is installed only by the
// test reset seam, so normal app sessions do not retain diagnostic history.
// It separates bounded FIFO work from the whole-document snapshot without a
// wall clock (the live request happens before replayStore.put and is unchanged).
export interface ReplayStoreWorkStats {
  puts: number;
  orderSearches: number;
  orderSearchSlots: number;
  orderMoves: number;
  evictions: number;
  shiftedSlots: number;
  writeSchedules: number;
  writeFlushes: number;
  lastSnapshotEntries: number;
  lastSnapshotEntryBytes: number;
  lastSnapshotBytes: number;
}

const EMPTY_WORK_STATS = (): ReplayStoreWorkStats => ({
  puts: 0,
  orderSearches: 0,
  orderSearchSlots: 0,
  orderMoves: 0,
  evictions: 0,
  shiftedSlots: 0,
  writeSchedules: 0,
  writeFlushes: 0,
  lastSnapshotEntries: 0,
  lastSnapshotEntryBytes: 0,
  lastSnapshotBytes: 0,
});

let _workStats: ReplayStoreWorkStats | null = null;

function seedTotalBytes(store: ReplayStore): void {
  if (_bytesSeeded) return;
  let sum = 0;
  for (const k of store.order) {
    const e = store.entries[k];
    if (e) sum += e.bytes;
  }
  _totalBytes = sum;
  _bytesSeeded = true;
}

/**
 * Upsert `data` under `key`: record { data, loadedAt: now, bytes }, MOVE/append
 * the key to the TAIL of `order`, then evict order[0] (oldest-loaded) while over
 * EITHER cap. The just-put key sits at the tail → it always survives (the
 * most-recent-survives invariant, QA-24). Date.now() lives here (a non-render
 * function), never in a render path.
 *
 * The whole-document write through the seam is async + best-effort (off the
 * blocking path, NFR-04); the in-memory mirror is the live source of truth for
 * this session, so a slow/failed write never blocks or breaks a put.
 */
export async function put(key: string, data: unknown): Promise<void> {
  const store = await ensureLoaded();
  seedTotalBytes(store);
  if (_workStats) _workStats.puts += 1;

  const bytes = JSON.stringify(data).length;
  const existing = store.entries[key];
  if (existing) _totalBytes -= existing.bytes;

  store.entries[key] = { data, loadedAt: Date.now(), bytes };
  _totalBytes += bytes;

  // Move/append key to the tail of order (oldest → newest).
  if (_workStats) {
    _workStats.orderSearches += 1;
    _workStats.orderSearchSlots += store.order.length;
  }
  const at = store.order.indexOf(key);
  if (at !== -1) {
    store.order.splice(at, 1);
    if (_workStats) _workStats.orderMoves += 1;
  }
  store.order.push(key);

  // Evict oldest-loaded while over either cap. The tail (just-put) is never
  // reached: even a single over-cap entry stays as the sole survivor.
  while (
    store.order.length > 1 &&
    (store.order.length > REPLAY_MAX_ENTRIES || _totalBytes > REPLAY_MAX_BYTES)
  ) {
    // Array.shift moves each surviving slot once. Record the exact bounded
    // movement so the guard measures work rather than elapsed time.
    if (_workStats) {
      _workStats.evictions += 1;
      _workStats.shiftedSlots += store.order.length - 1;
    }
    const oldest = store.order.shift()!;
    const ev = store.entries[oldest];
    if (ev) {
      _totalBytes -= ev.bytes;
      delete store.entries[oldest];
    }
  }

  scheduleWrite(store);
}

// ── Debounced whole-document write ───────────────────────────────────────────
let _writeTimer: ReturnType<typeof setTimeout> | null = null;
const WRITE_DEBOUNCE_MS = 250;

function scheduleWrite(store: ReplayStore): void {
  if (_workStats) _workStats.writeSchedules += 1;
  if (_writeTimer) clearTimeout(_writeTimer);
  _writeTimer = setTimeout(() => {
    _writeTimer = null;
    // Snapshot a plain clone so an in-flight async write can't observe a later
    // mutation mid-serialize; best-effort (failures degrade to "no replay").
    const snapshot: ReplayStore = {
      version: store.version,
      entries: { ...store.entries },
      order: [...store.order],
    };
    if (_workStats) {
      _workStats.writeFlushes += 1;
      _workStats.lastSnapshotEntries = snapshot.order.length;
      _workStats.lastSnapshotEntryBytes = _totalBytes;
      _workStats.lastSnapshotBytes = JSON.stringify(snapshot).length;
    }
    void storage.setReplayStore(snapshot)
      .catch(() => { /* best-effort — the mirror stays the live source */ });
  }, WRITE_DEBOUNCE_MS);
}

/** Test seam: deterministic work performed since the last reset. */
export function _getReplayStoreWorkStatsForTests(): Readonly<ReplayStoreWorkStats> {
  if (!_workStats) _workStats = EMPTY_WORK_STATS();
  return { ..._workStats };
}

/** Test seam: reset the module mirror so each test starts from disk-empty. */
export function _resetReplayStoreForTests(): void {
  if (_writeTimer) { clearTimeout(_writeTimer); _writeTimer = null; }
  _store = null;
  _loading = null;
  _totalBytes = 0;
  _bytesSeeded = false;
  _workStats = EMPTY_WORK_STATS();
}
