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
import { SUBMISSION_KEY_RE } from './checklistId';
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

// Monotone purge counter (clear-means-clear), the same mechanism the provenance
// store carries and for the same reason. The identity check `store !== _store`
// that the projects and county stores rely on works THERE because their write
// helpers are private and take a `store` captured before the loader ran. `put`
// is PUBLIC and calls `ensureLoaded()` for itself, so after a purge it finds
// the fresh mirror perfectly valid and persists a `/weather/S…` answer fetched
// for the export the user just cleared. A generation answers the question
// identity cannot: "did a Clear happen since this work began?"
let _purgeGeneration = 0;

/**
 * The current purge generation, for a caller that will `put` an answer it is
 * ABOUT to request. Capture it BEFORE the network call and hand it back to
 * `put`: that is what makes "the request began before the Clear" detectable,
 * since `put` itself is only ever entered after the answer has landed.
 *
 * This is the replay store's analogue of the capture that
 * `dedupedFetchChecklist` makes internally before calling its loader; replay's
 * fetch chokepoint is `transport.getReplayable`, so the capture is exported.
 */
export function purgeGeneration(): number {
  return _purgeGeneration;
}

async function ensureLoaded(): Promise<ReplayStore> {
  if (_store) return _store;
  if (_loading) return _loading;
  _loading = (async () => {
    const loaded = await storage.getReplayStore().catch(() => null);
    // A purge landed while this read was in flight (clear-means-clear). It
    // already installed the authoritative mirror, and the document just read
    // is the PRE-purge one, so adopting it would resurrect every key the
    // purge removed. The purged mirror wins.
    if (_store) return _store;
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
export async function put(key: string, data: unknown, sinceGeneration: number): Promise<void> {
  // REQUIRED, not optional. A caller that omitted it used to fall back to a
  // capture taken here, which is too late by construction: `put` is entered
  // only after the answer has landed, so the fallback silently degraded to
  // "did a Clear happen during my load?" — a much weaker question than "did a
  // Clear happen since I asked for this?". Required, the mistake is a
  // `npm run build` failure, which is this project's declared pre-push gate,
  // rather than a leak nothing types-checks. See `purgeGeneration`.
  const gen = sinceGeneration;
  const store = await ensureLoaded();
  // Either a Clear happened since this answer was requested — the key came out
  // of an export that no longer exists — or a purge replaced the mirror while
  // the load was in flight and `store` is the detached pre-purge document,
  // whose flush would re-land every purged key. Dropping this one put costs one
  // replayable answer; keeping it would undo a user's Clear.
  if (gen !== _purgeGeneration || store !== _store) return;
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

// ── One ordered writer for data/replay.json ──────────────────────────────────
// `replay.json` is the app's one durable document NOT on the storage seam's
// `docChains` (it is its own file with a single writing module, so it has no
// read-modify-write to clobber). That makes the seam's ordering guarantee ours
// to provide: two `setReplayStore` calls in flight at once complete in whatever
// order the filesystem hands back, and the purge's document is the SMALLER one,
// so it is the likelier to land first and be overwritten by a flush that was
// already on its way out. Cancelling the timer and identity-checking the flush
// closure both fire too early to help — by then the write has begun.
//
// So every write goes through here, in call order: the next `setReplayStore` is
// not even CALLED until the previous one has settled. Same shape as
// `TauriStorage.chain`, and the same two rules: a link never awaits another
// chained write, and a failed link rejects only its own caller (the stored tail
// swallows, so one failed flush cannot poison the chain).
let _writeChain: Promise<void> = Promise.resolve();

function writeThrough(snapshot: ReplayStore): Promise<void> {
  const link = _writeChain.then(() => storage.setReplayStore(snapshot));
  _writeChain = link.then(() => undefined, () => undefined);
  return link;
}

function scheduleWrite(store: ReplayStore): void {
  if (_workStats) _workStats.writeSchedules += 1;
  if (_writeTimer) clearTimeout(_writeTimer);
  _writeTimer = setTimeout(() => {
    _writeTimer = null;
    // Superseded by a purge: this closure holds the PRE-purge document, so
    // flushing it would re-land the checklist keys the purge just removed.
    if (store !== _store) return;
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
    void writeThrough(snapshot)
      .catch(() => { /* best-effort — the mirror stays the live source */ });
  }, WRITE_DEBOUNCE_MS);
}

// ── Clear-path teardown (clear-means-clear) ───────────────────────────

/**
 * True for a replay key derived from a checklist in the user's own export: the
 * `/weather/<submission id>` and `/tide/<submission id>` lookups the Weather
 * tab makes from a row of the loaded backup. Those keys ARE the user's own
 * checklist ids, sitting in `data/replay.json` after the backup they came from
 * has been cleared.
 *
 * The COORDINATE-keyed siblings `/weather/at` and `/tide/at` (the Weather
 * Forecast panel, a place the user typed) are deliberately NOT matched: they
 * are not derived from the export, so a Clear must leave them alone. The two
 * families separate on the id guard alone — `at` is not a submission id — which
 * is why this reuses the app-wide bounded literal rather than a prefix test.
 */
export function isChecklistDerivedReplayKey(key: string): boolean {
  const q = key.indexOf('?');
  const path = q === -1 ? key : key.slice(0, q);
  const prefix = path.startsWith('/weather/') ? '/weather/'
    : path.startsWith('/tide/') ? '/tide/'
    : null;
  if (prefix === null) return false;
  const raw = path.slice(prefix.length);
  if (SUBMISSION_KEY_RE.test(raw)) return true;
  // The key is built from encodeURIComponent(id) and a real submission id
  // encodes to itself, so the raw test above answers every key this app
  // writes. Decoding covers a document written by some other version; it is
  // guarded because decodeURIComponent throws on a malformed escape.
  try {
    return SUBMISSION_KEY_RE.test(decodeURIComponent(raw));
  } catch {
    return false;
  }
}

/**
 * Drop every checklist-derived entry from the mirror AND from disk, keeping
 * the coordinate-keyed ones. Called only from the shared clear-path teardown
 * (`lib/clearDerived.ts`), never on a replace.
 *
 * Three things this has to get right:
 *  - it SUPERSEDES the 250 ms debounced flush. A `put` moments before a Clear
 *    leaves a timer holding the whole pre-purge document; letting it fire
 *    afterwards would re-land every key just removed.
 *  - it installs a NEW mirror object, which is what makes the identity guards
 *    in `put` and `scheduleWrite` able to detect that they are holding a
 *    detached document, and it moves `_purgeGeneration`, which is what catches
 *    the case identity cannot: a `put` entered AFTER the swap, carrying an
 *    answer requested before it.
 *  - it writes through the seam and AWAITS it, so a caller that resolves has a
 *    clean document on disk rather than a scheduled intention.
 */
export async function purgeChecklistReplay(): Promise<void> {
  const store = await ensureLoaded();
  if (_writeTimer) { clearTimeout(_writeTimer); _writeTimer = null; }

  // Null-prototype accumulator (the v0.5.90 write-side rule): the keys come
  // from the persisted document, which is unvalidated. On a plain `{}` the
  // single key `__proto__` is an inherited SETTER, so `next.entries[key] = e`
  // would set the prototype instead of storing the entry — silently dropping
  // that entry from the purged document rather than carrying it over.
  const next: ReplayStore = {
    version: store.version,
    entries: Object.create(null) as ReplayStore['entries'],
    order: [],
  };
  let bytes = 0;
  for (const key of Object.keys(store.entries)) {
    if (isChecklistDerivedReplayKey(key)) continue;
    const entry = store.entries[key];
    if (!entry) continue;
    next.entries[key] = entry;
    if (typeof entry.bytes === 'number' && Number.isFinite(entry.bytes)) bytes += entry.bytes;
  }
  // Rebuild `order` from the surviving keys, preserving oldest → newest.
  for (const key of store.order) {
    if (Object.hasOwn(next.entries, key) && !next.order.includes(key)) next.order.push(key);
  }

  // Moved at the instant the mirror is swapped, so every put whose answer was
  // requested before this line is refused, and every put after it writes into
  // the fresh mirror normally.
  _purgeGeneration += 1;
  _store = next;
  _totalBytes = bytes;
  _bytesSeeded = true;

  // On the chain like every other write, so a flush already in flight lands
  // BEFORE this one rather than after it. Awaited and NOT caught: a caller that
  // resolves has a clean document on disk, and a failure is the caller's to
  // report (clearDerived collects it).
  await writeThrough({
    version: next.version,
    entries: { ...next.entries },
    order: [...next.order],
  });
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
  _writeChain = Promise.resolve();
}
