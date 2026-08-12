// Persistent per-county eBird cache for the Completeness metric (schema.md —
// OQ-04 30-day TTL, OQ-05 persisted via the storage seam).
//
// County species lists change slowly, so a fetched county is reused for 30 days
// across pans, sessions, and relaunches (FR-15) — and, stale-but-present, still
// shades the map when a refresh fails offline (FR-30). Structure copies the
// proven replayStore.ts shape: one-disk-read-per-session in-memory mirror,
// debounced whole-document write through `storage.setSetting`, and an `order[]`
// (oldest-fetched first) driving count and payload-length-budget eviction. It
// is deliberately NOT
// networkCache (90 s — wrong TTL) and NOT replayStore (live-first semantics
// would refetch inside the bound), and the route is NOT in CACHED_GET_PATHS —
// this module is the single caching layer for /map/county-species.
//
// In-flight dedup (FR-16) lives here too: concurrent or repeated requests for
// the same county share ONE eBird call. Errors are NEVER cached — a failed
// fetch leaves no entry, so a subsequent click retries (FR-25/FR-31).

import { storage } from './storage'
import { isOfflineError } from './offlineDetect'
import type { CountyEbirdData } from './countyCompleteness'

/** OQ-04: 30 days. */
export const COMPLETENESS_TTL_MS = 30 * 24 * 60 * 60 * 1000

/** Storage-seam document key (one settings document, replay-store style). */
export const COMPLETENESS_STORE_KEY = 'county-completeness-v1'

// Caps: 250 counties OR 4,000,000 JSON payload code units, whichever fills
// first (a ~500-species county is ~15,000 serialized code units). The length
// budget excludes entry keys/envelopes and allows one sole oversized newest
// entry so a successful fresh fetch is never immediately discarded. Mutable
// bindings + test seams mirror REPLAY_MAX_*.
export let COMPLETENESS_MAX_ENTRIES = 250
export let COMPLETENESS_MAX_BYTES = 4_000_000

/** Test seam: override the entry cap. */
export function setCompletenessMaxEntries(n: number): void { COMPLETENESS_MAX_ENTRIES = n }
/** Test seam: override the serialized payload-length budget. */
export function setCompletenessMaxBytes(n: number): void { COMPLETENESS_MAX_BYTES = n }

export interface CountyCompletenessCacheEntry {
  data: CountyEbirdData
  /** ms epoch — the 30-day TTL anchor. */
  fetchedAt: number
  /** JSON.stringify(data).length in UTF-16 code units. */
  bytes: number
}

export interface CountyCompletenessStore {
  version: 1
  /** Keyed by regionCode ("US-CA-085") — canonical, 1:1 with a county. */
  entries: Record<string, CountyCompletenessCacheEntry>
  /** Oldest-fetched → newest (eviction order). */
  order: string[]
}

const EMPTY_STORE = (): CountyCompletenessStore => ({ version: 1, entries: {}, order: [] })

// ── Load-path shape validation (security follow-up) ────────────────────────────
// The persisted document is on-device data and can arrive corrupted (partial
// write, hand-edited file, a future shape drift). Every entry is validated on
// read and a malformed one is silently DROPPED — a corrupted cache degrades to
// "not cached" (that county simply refetches), never a render-time crash on a
// null/missing field downstream (statusFor's entry.data dereference).

const REGION_KEY_RE = /^US-[A-Z]{2}-\d{3}$/

function isValidEntry(e: unknown): e is CountyCompletenessCacheEntry {
  if (typeof e !== 'object' || e === null) return false
  const c = e as { data?: unknown; fetchedAt?: unknown; bytes?: unknown }
  if (typeof c.fetchedAt !== 'number' || !Number.isFinite(c.fetchedAt)) return false
  if (typeof c.bytes !== 'number' || !Number.isFinite(c.bytes)) return false
  if (typeof c.data !== 'object' || c.data === null) return false
  const d = c.data as { regionCode?: unknown; speciesCount?: unknown; species?: unknown }
  if (typeof d.regionCode !== 'string') return false
  if (typeof d.speciesCount !== 'number' || !Number.isFinite(d.speciesCount)) return false
  if (!Array.isArray(d.species)) return false
  for (const s of d.species) {
    if (typeof s !== 'object' || s === null) return false
    const row = s as { speciesCode?: unknown; commonName?: unknown }
    if (typeof row.speciesCode !== 'string' || typeof row.commonName !== 'string') return false
  }
  return true
}

/** Normalize a loaded document to a well-formed store: a bad document → empty;
 *  per-entry, keep only region-code-shaped keys (deduped, order preserved)
 *  whose entry passes the full shape check. */
function sanitizeStore(loaded: unknown): CountyCompletenessStore {
  if (typeof loaded !== 'object' || loaded === null) return EMPTY_STORE()
  const doc = loaded as { entries?: unknown; order?: unknown }
  if (typeof doc.entries !== 'object' || doc.entries === null || !Array.isArray(doc.order)) return EMPTY_STORE()
  const rawEntries = doc.entries as Record<string, unknown>
  const store = EMPTY_STORE()
  for (const key of doc.order) {
    if (typeof key !== 'string' || !REGION_KEY_RE.test(key)) continue
    if (store.entries[key]) continue // duplicate order key
    const entry = rawEntries[key]
    if (!isValidEntry(entry)) continue
    store.entries[key] = entry
    store.order.push(key)
  }
  return store
}

// ── Coalesced in-memory mirror (one disk read per session) ─────────────────────
let _store: CountyCompletenessStore | null = null
let _loading: Promise<CountyCompletenessStore> | null = null
let _totalBytes = 0

// Deterministic work accounting for the capacity+1 guard. Disabled in the app:
// `_resetCountyCompletenessCacheForTests` installs the recorder, and only tests
// read it. This keeps the production hot path free of benchmark clocks while
// letting the guard distinguish the unavoidable loader from FIFO bookkeeping
// and the debounced whole-document snapshot.
export interface CountyCompletenessCacheWorkStats {
  loaderCalls: number
  puts: number
  orderSearches: number
  orderSearchSlots: number
  orderMoves: number
  evictions: number
  shiftedSlots: number
  writeSchedules: number
  writeFlushes: number
  lastSnapshotEntries: number
  lastSnapshotEntryBytes: number
  lastSnapshotBytes: number
}

const EMPTY_WORK_STATS = (): CountyCompletenessCacheWorkStats => ({
  loaderCalls: 0,
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
})

let _workStats: CountyCompletenessCacheWorkStats | null = null

async function ensureLoaded(): Promise<CountyCompletenessStore> {
  if (_store) return _store
  if (_loading) return _loading
  _loading = (async () => {
    const loaded = await storage.getSetting<CountyCompletenessStore>(COMPLETENESS_STORE_KEY).catch(() => null)
    // Normalize + VALIDATE: an absent/partial document becomes the empty shape
    // and malformed entries are dropped (sanitizeStore), so callers never
    // branch on missing fields and never dereference a corrupt entry.
    _store = sanitizeStore(loaded)
    _totalBytes = 0
    for (const k of _store.order) {
      const e = _store.entries[k]
      if (e) _totalBytes += e.bytes
    }
    return _store
  })()
  try {
    return await _loading
  } finally {
    _loading = null
  }
}

/** Load (once) and return a snapshot of every cached county — fresh AND stale.
 *  Stale-but-present entries still shade offline (FR-30); the eager fetch
 *  refreshes them when it can. */
export async function loadAll(): Promise<ReadonlyMap<string, CountyCompletenessCacheEntry>> {
  const store = await ensureLoaded()
  const out = new Map<string, CountyCompletenessCacheEntry>()
  for (const k of store.order) {
    const e = store.entries[k]
    if (e) out.set(k, e)
  }
  return out
}

function putEntry(store: CountyCompletenessStore, regionCode: string, data: CountyEbirdData, fetchedAt: number): void {
  if (_workStats) _workStats.puts += 1
  const bytes = JSON.stringify(data).length
  const existing = store.entries[regionCode]
  if (existing) _totalBytes -= existing.bytes
  store.entries[regionCode] = { data, fetchedAt, bytes }
  _totalBytes += bytes

  if (_workStats) {
    _workStats.orderSearches += 1
    _workStats.orderSearchSlots += store.order.length
  }
  const at = store.order.indexOf(regionCode)
  if (at !== -1) {
    store.order.splice(at, 1)
    if (_workStats) _workStats.orderMoves += 1
  }
  store.order.push(regionCode)

  // Evict oldest-fetched while over EITHER cap; the just-put tail always survives.
  while (
    store.order.length > 1 &&
    (store.order.length > COMPLETENESS_MAX_ENTRIES || _totalBytes > COMPLETENESS_MAX_BYTES)
  ) {
    // Array.shift moves every surviving slot left by one. Count those moves,
    // rather than timing them, so the cap+1 assertion is deterministic.
    if (_workStats) {
      _workStats.evictions += 1
      _workStats.shiftedSlots += store.order.length - 1
    }
    const oldest = store.order.shift()!
    const ev = store.entries[oldest]
    if (ev) {
      _totalBytes -= ev.bytes
      delete store.entries[oldest]
    }
  }

  scheduleWrite(store)
}

export interface CompletenessFetchResult {
  data: CountyEbirdData
  fetchedAt: number
  /** True when the loader actually ran (a live eBird call was made). */
  fromNetwork: boolean
}

// In-flight dedup (FR-16): concurrent/repeat requests share one call.
const _inflight = new Map<string, Promise<CompletenessFetchResult>>()

/**
 * The one read/fetch chokepoint: a FRESH cached entry short-circuits with no
 * network (FR-15); a miss/stale runs `loader` (deduped per region, FR-16) and
 * caches the result. A loader failure while OFFLINE with a stale entry present
 * returns the stale copy (FR-30 — stale-but-shown); any other failure rethrows
 * and caches nothing (retryable, FR-25/FR-31).
 */
export function dedupedFetch(
  regionCode: string,
  loader: () => Promise<CountyEbirdData>,
): Promise<CompletenessFetchResult> {
  const run = async (): Promise<CompletenessFetchResult> => {
    const store = await ensureLoaded()
    const hit = store.entries[regionCode]
    if (hit && Date.now() - hit.fetchedAt < COMPLETENESS_TTL_MS) {
      return { data: hit.data, fetchedAt: hit.fetchedAt, fromNetwork: false }
    }
    const pending = _inflight.get(regionCode)
    if (pending) return pending
    const p = (async () => {
      try {
        if (_workStats) _workStats.loaderCalls += 1
        const data = await loader()
        const fetchedAt = Date.now()
        putEntry(store, regionCode, data, fetchedAt)
        return { data, fetchedAt, fromNetwork: true }
      } catch (err) {
        // Never cache a failure. Offline + a stale prior entry → serve it stale.
        const stale = store.entries[regionCode]
        if (stale && isOfflineError(err)) {
          return { data: stale.data, fetchedAt: stale.fetchedAt, fromNetwork: false }
        }
        throw err
      } finally {
        _inflight.delete(regionCode)
      }
    })()
    _inflight.set(regionCode, p)
    return p
  }
  return run()
}

// ── Debounced whole-document write (best-effort, off the blocking path) ────────
let _writeTimer: ReturnType<typeof setTimeout> | null = null
const WRITE_DEBOUNCE_MS = 250

function scheduleWrite(store: CountyCompletenessStore): void {
  if (_workStats) _workStats.writeSchedules += 1
  if (_writeTimer) clearTimeout(_writeTimer)
  _writeTimer = setTimeout(() => {
    _writeTimer = null
    const snapshot: CountyCompletenessStore = {
      version: store.version,
      entries: { ...store.entries },
      order: [...store.order],
    }
    if (_workStats) {
      _workStats.writeFlushes += 1
      _workStats.lastSnapshotEntries = snapshot.order.length
      _workStats.lastSnapshotEntryBytes = _totalBytes
      _workStats.lastSnapshotBytes = JSON.stringify(snapshot).length
    }
    void storage.setSetting<CountyCompletenessStore>(COMPLETENESS_STORE_KEY, snapshot)
      .catch(() => { /* best-effort — the mirror stays the live source */ })
  }, WRITE_DEBOUNCE_MS)
}

/** Test seam: deterministic work performed since the last reset. */
export function _getCountyCompletenessCacheWorkStatsForTests(): Readonly<CountyCompletenessCacheWorkStats> {
  if (!_workStats) _workStats = EMPTY_WORK_STATS()
  return { ..._workStats }
}

/** Test seam: reset the module mirror so each test starts from disk-empty. */
export function _resetCountyCompletenessCacheForTests(): void {
  if (_writeTimer) { clearTimeout(_writeTimer); _writeTimer = null }
  _store = null
  _loading = null
  _totalBytes = 0
  _workStats = EMPTY_WORK_STATS()
  _inflight.clear()
  COMPLETENESS_MAX_ENTRIES = 250
  COMPLETENESS_MAX_BYTES = 4_000_000
}
