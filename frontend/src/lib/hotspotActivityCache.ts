// Persistent per-hotspot activity cache for the Map Explorer's Recent activity
// color mode (color-coded-hotspots, FR-15 / NFR-05). Template:
// countyCompletenessCache — one-disk-read-per-session in-memory mirror,
// debounced whole-document write through `storage.setSetting`, an `order[]`
// (oldest-fetched first) driving FIFO eviction, per-entry load validation, an
// in-flight dedupe Map, errors NEVER cached, and offline stale-reads served
// for display.
//
// What is cached: the TWO COUNTS, not the species list (schema.md decision 3).
// The entry is a fixed shape of three finite numbers, so validation is trivial,
// the Week ↔ 30-days switch is a field read (zero requests, FR-16), and the
// bound is stated STRUCTURALLY: ≤ HOTSPOT_ACTIVITY_MAX_ENTRIES entries, each a
// key of ≤ 11 chars (guarded by the key regex on load) plus exactly three
// finite numbers — no unbounded string exists anywhere in the document, so no
// JSON payload budget is needed or wanted (a byte product would encode an
// engine's accounting; this statement cannot go false silently).
//
// Cap policy: FIFO, entry-count only. The choice follows what an eviction
// COSTS (the repo's cache rules): one redundant eBird call for a hotspot the
// user scrolls back to — the cheap-eviction case where FIFO is correct and
// admission control would be wrong (an admission-closed cache could never take
// on a new area's hotspots once full; capacity+1 is a measurement rule, not a
// policy). The capacity+1 behavior is asserted as WORK DONE via the work-stats
// seam below, never as elapsed time.
//
// This module is the SINGLE caching layer for /map/hotspot-activity — the
// route stays OUT of CACHED_GET_PATHS on both transports (FR-15d).

import { storage } from './storage'
import { isOfflineError } from './offlineDetect'
import {
  HOTSPOT_ACTIVITY_LOC_ID_RE, computeActivityCounts,
  type HotspotActivityPayload,
} from './hotspotActivity'

/** OQ-1 default: 6 hours (activity data is time-sensitive; the county 30-day
 *  TTL is the wrong precedent here). */
export const HOTSPOT_ACTIVITY_TTL_MS = 6 * 60 * 60 * 1000

/** Storage-seam document key. */
export const HOTSPOT_ACTIVITY_STORE_KEY = 'hotspot-activity-v1'

/** ≈ ten full 200-cap result sets. Mutable binding + test seam, mirroring
 *  COMPLETENESS_MAX_ENTRIES. */
export let HOTSPOT_ACTIVITY_MAX_ENTRIES = 2000

/** Test seam: override the entry cap. */
export function setHotspotActivityMaxEntries(n: number): void { HOTSPOT_ACTIVITY_MAX_ENTRIES = n }

export interface HotspotActivityCacheEntry {
  /** Distinct species in eBird's back=30 window, as returned. */
  count30: number
  /** Subset whose most recent obsDt was within 7 days OF THE FETCH
   *  (computeActivityCounts(species, fetchedAt)). Frozen at fetch time; within
   *  the 6h TTL that is at most 6h of boundary drift, and the popup's as-of
   *  wording is the honest reading either way (schema.md decision 3). */
  count7: number
  /** ms epoch — TTL anchor and the popup's as-of time. */
  fetchedAt: number
}

export interface HotspotActivityStore {
  version: 1
  /** Keyed by locId — every key satisfies ^L[0-9]{1,10}$ (validated on load). */
  entries: Record<string, HotspotActivityCacheEntry>
  /** Oldest-fetched → newest (FIFO eviction order). */
  order: string[]
}

// Write-side prototype hygiene (v0.5.90 rule): `entries` holds external-string
// keys, so it is built with a null prototype — on a plain `{}` a locId of
// '__proto__' would hit the inherited Object.prototype setter (silently
// swapping the record's prototype instead of storing an own key). Every
// shipped write path is regex-gated upstream, but the guarantee is pinned AT
// the store so a future dedupedFetch caller that skips the controller
// inherits it. Module swept (v0.5.85 rule): the only other external-keyed
// container built here is the flush snapshot in scheduleWrite (same
// treatment); `_inflight`, `loadAll`'s result, and the work stats are Maps or
// internal-keyed and need none.
const EMPTY_STORE = (): HotspotActivityStore => ({
  version: 1,
  entries: Object.create(null) as Record<string, HotspotActivityCacheEntry>,
  order: [],
})

// ── Load-path shape validation (malformed entries dropped, never thrown) ──────

function isValidEntry(e: unknown): e is HotspotActivityCacheEntry {
  if (typeof e !== 'object' || e === null) return false
  const c = e as { count30?: unknown; count7?: unknown; fetchedAt?: unknown }
  if (typeof c.count30 !== 'number' || !Number.isFinite(c.count30) || c.count30 < 0) return false
  if (typeof c.count7 !== 'number' || !Number.isFinite(c.count7) || c.count7 < 0) return false
  if (c.count7 > c.count30) return false
  if (typeof c.fetchedAt !== 'number' || !Number.isFinite(c.fetchedAt)) return false
  return true
}

/** Normalize a loaded document to a well-formed store: a bad document → empty;
 *  per-entry, keep only locId-shaped keys (deduped, order preserved) whose
 *  entry passes the full shape check — a corrupted entry degrades to "not
 *  cached" (that hotspot simply refetches), never a render-time crash. */
function sanitizeStore(loaded: unknown): HotspotActivityStore {
  if (typeof loaded !== 'object' || loaded === null) return EMPTY_STORE()
  const doc = loaded as { entries?: unknown; order?: unknown }
  if (typeof doc.entries !== 'object' || doc.entries === null || !Array.isArray(doc.order)) return EMPTY_STORE()
  const rawEntries = doc.entries as Record<string, unknown>
  const store = EMPTY_STORE()
  for (const key of doc.order) {
    // The key regex is also what keeps prototype-chain names ('__proto__',
    // 'constructor') out of the rebuilt record — none of them match ^L[0-9]+$.
    if (typeof key !== 'string' || !HOTSPOT_ACTIVITY_LOC_ID_RE.test(key)) continue
    if (store.entries[key]) continue // duplicate order key
    if (!Object.hasOwn(rawEntries, key)) continue
    const entry = rawEntries[key]
    if (!isValidEntry(entry)) continue
    store.entries[key] = { count30: entry.count30, count7: entry.count7, fetchedAt: entry.fetchedAt }
    store.order.push(key)
  }
  return store
}

// ── Coalesced in-memory mirror (one disk read per session) ────────────────────
let _store: HotspotActivityStore | null = null
let _loading: Promise<HotspotActivityStore> | null = null

// Deterministic work accounting for the capacity+1 guard (the county cache's
// seam shape). Disabled in the app: `_resetHotspotActivityCacheForTests`
// installs the recorder, and only tests read it.
export interface HotspotActivityCacheWorkStats {
  loaderCalls: number
  puts: number
  orderSearches: number
  orderSearchSlots: number
  evictions: number
  shiftedSlots: number
  writeSchedules: number
  writeFlushes: number
  lastSnapshotEntries: number
}

const EMPTY_WORK_STATS = (): HotspotActivityCacheWorkStats => ({
  loaderCalls: 0,
  puts: 0,
  orderSearches: 0,
  orderSearchSlots: 0,
  evictions: 0,
  shiftedSlots: 0,
  writeSchedules: 0,
  writeFlushes: 0,
  lastSnapshotEntries: 0,
})

let _workStats: HotspotActivityCacheWorkStats | null = null

async function ensureLoaded(): Promise<HotspotActivityStore> {
  if (_store) return _store
  if (_loading) return _loading
  _loading = (async () => {
    const loaded = await storage.getSetting<HotspotActivityStore>(HOTSPOT_ACTIVITY_STORE_KEY).catch(() => null)
    _store = sanitizeStore(loaded)
    return _store
  })()
  try {
    return await _loading
  } finally {
    _loading = null
  }
}

/** Load (once) and return a snapshot of every cached hotspot — fresh AND
 *  stale. Stale-but-present entries still color pins (FR-15b, QA-16); the
 *  controller refetches them when it can. */
export async function loadAll(): Promise<ReadonlyMap<string, HotspotActivityCacheEntry>> {
  const store = await ensureLoaded()
  const out = new Map<string, HotspotActivityCacheEntry>()
  for (const k of store.order) {
    const e = store.entries[k]
    if (e) out.set(k, e)
  }
  return out
}

function putEntry(store: HotspotActivityStore, locId: string, entry: HotspotActivityCacheEntry): void {
  if (_workStats) _workStats.puts += 1
  store.entries[locId] = entry

  if (_workStats) {
    _workStats.orderSearches += 1
    _workStats.orderSearchSlots += store.order.length
  }
  const at = store.order.indexOf(locId)
  if (at !== -1) store.order.splice(at, 1)
  store.order.push(locId)

  // FIFO: evict oldest-fetched while over the entry cap; the just-put tail
  // always survives.
  while (store.order.length > 1 && store.order.length > HOTSPOT_ACTIVITY_MAX_ENTRIES) {
    if (_workStats) {
      _workStats.evictions += 1
      _workStats.shiftedSlots += store.order.length - 1
    }
    const oldest = store.order.shift()!
    delete store.entries[oldest]
  }

  scheduleWrite(store)
}

export interface ActivityFetchResult {
  entry: HotspotActivityCacheEntry
  /** True when the loader actually ran (a live eBird call was made). */
  fromNetwork: boolean
}

// In-flight dedupe: concurrent/repeat requests for one locId share ONE call.
const _inflight = new Map<string, Promise<ActivityFetchResult>>()

/**
 * The one read/fetch chokepoint: a FRESH cached entry short-circuits with no
 * network (FR-15a); a miss/stale runs `loader` (deduped per locId), computes
 * both window counts at fetch time, and caches the fixed-shape entry. A loader
 * failure while OFFLINE with a stale entry present returns the stale copy
 * (FR-15b — stale-but-shown); any other failure rethrows and caches NOTHING
 * (errors never cached — FR-15c, QA-14, so a retry re-asks).
 */
export function dedupedFetch(
  locId: string,
  loader: () => Promise<HotspotActivityPayload>,
): Promise<ActivityFetchResult> {
  const run = async (): Promise<ActivityFetchResult> => {
    const store = await ensureLoaded()
    const hit = store.entries[locId]
    if (hit && Date.now() - hit.fetchedAt < HOTSPOT_ACTIVITY_TTL_MS) {
      return { entry: hit, fromNetwork: false }
    }
    const pending = _inflight.get(locId)
    if (pending) return pending
    const p = (async () => {
      try {
        if (_workStats) _workStats.loaderCalls += 1
        const payload = await loader()
        const fetchedAt = Date.now()
        const counts = computeActivityCounts(payload.species, fetchedAt)
        const entry: HotspotActivityCacheEntry = { count30: counts.count30, count7: counts.count7, fetchedAt }
        putEntry(store, locId, entry)
        return { entry, fromNetwork: true }
      } catch (err) {
        // Never cache a failure. Offline + a stale prior entry → serve it stale.
        const stale = store.entries[locId]
        if (stale && isOfflineError(err)) {
          return { entry: stale, fromNetwork: false }
        }
        throw err
      } finally {
        _inflight.delete(locId)
      }
    })()
    _inflight.set(locId, p)
    return p
  }
  return run()
}

// ── Debounced whole-document write (best-effort, off the blocking path) ───────
let _writeTimer: ReturnType<typeof setTimeout> | null = null
const WRITE_DEBOUNCE_MS = 250

function scheduleWrite(store: HotspotActivityStore): void {
  if (_workStats) _workStats.writeSchedules += 1
  if (_writeTimer) clearTimeout(_writeTimer)
  _writeTimer = setTimeout(() => {
    _writeTimer = null
    const snapshot: HotspotActivityStore = {
      version: store.version,
      // Null-prototype target (v0.5.90): Object.assign uses [[Set]], so copying
      // an own '__proto__' data key onto a plain `{}` would hit the inherited
      // setter; a null-proto target makes every copy a real own key. (A spread
      // has define-semantics and is safe today, but the container convention is
      // kept uniform so a future rewrite cannot regress it.)
      entries: Object.assign(
        Object.create(null) as Record<string, HotspotActivityCacheEntry>,
        store.entries,
      ),
      order: [...store.order],
    }
    if (_workStats) {
      _workStats.writeFlushes += 1
      _workStats.lastSnapshotEntries = snapshot.order.length
    }
    void storage.setSetting<HotspotActivityStore>(HOTSPOT_ACTIVITY_STORE_KEY, snapshot)
      .catch(() => { /* best-effort — the mirror stays the live source */ })
  }, WRITE_DEBOUNCE_MS)
}

/** Test seam: deterministic work performed since the last reset. */
export function _getHotspotActivityCacheWorkStatsForTests(): Readonly<HotspotActivityCacheWorkStats> {
  if (!_workStats) _workStats = EMPTY_WORK_STATS()
  return { ..._workStats }
}

/** Test seam: reset the module mirror so each test starts from disk-empty. */
export function _resetHotspotActivityCacheForTests(): void {
  if (_writeTimer) { clearTimeout(_writeTimer); _writeTimer = null }
  _store = null
  _loading = null
  _workStats = EMPTY_WORK_STATS()
  _inflight.clear()
  HOTSPOT_ACTIVITY_MAX_ENTRIES = 2000
}
