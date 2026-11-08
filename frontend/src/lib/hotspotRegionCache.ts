// The persistent per-region public-hotspot store (hotspot-share-stat, schema.md
// section 9; decisions.md section 1: "cache it once it is looked up once, then
// only look up the new changes").
//
// One region's answer is the list of public-hotspot location ids eBird returns
// for `ref/hotspot/{region}`. It changes rarely, so after its first successful
// lookup it is reused for 30 days across sessions and relaunches, and a later
// launch whose regions all hold a fresh entry asks eBird nothing. The answer is
// KEPT past that, until the region cap or the payload budget evicts it or a
// Clear removes it: a region past its TTL (or dated more than 24 hours ahead of
// the clock, ebird-request-economy D-03) is still SERVED (the caller holds the
// stale list) and is asked again once per build of the hotspot Set; a refresh
// that fails or is rate limited writes nothing, so the stale answer outlives it.
//
// Structure is the house durable-cache shape (`countyCompletenessCache.ts`): one
// storage-seam document, a one-disk-read-per-session in-memory mirror, per-entry
// validation on load with malformed entries DROPPED rather than thrown on, an
// in-flight dedupe Map cleared in a `finally`, a 250 ms debounced whole-document
// write, `order` (oldest fetched first) driving count and payload eviction, and
// errors NEVER cached: no entry, no placeholder and no 429 body is ever written.
// It is the ONE caching layer for `/map/hotspot-region`, which is therefore NOT
// in the transport's `CACHED_GET_PATHS`; the eBird gate still owns pacing.
//
// Five departures from the reference, each deliberate:
//   1. The load walk is NEWEST FIRST and evicts at load: one entry can be about
//      1.2 M code units, so a document written under a different bound, or
//      hand-edited, sheds its OLDEST entries before it could outgrow the route.
//   2. No `bytes` field is stored: an entry's payload length is DERIVED from its
//      validated ids, on load and on every put, so the document carries no
//      number a reader would have to trust.
//   3. `abandonInflight()`: an invalidation (a key or file save) means "the key
//      changed", so a request made under the old key is neither joined by the
//      rebuild nor persisted.
//   4. A refresh that returns the identical list still writes its new fetch time
//      (the caller decides not to announce it).
//   5. A per-region admission bound: an answer longer than
//      HOTSPOT_IDS_PER_REGION_MAX is served for the session and not persisted,
//      because the load validator would refuse it and the region would read as
//      never answered on every launch.
//
// IMPORT DISCIPLINE: the storage seam only. The network call is an INJECTED
// loader; this module never imports `transport` (it is on the entry chunk, via
// `hotspotSet.ts`, and must stay dependency-light).
//
// CLEAR, NEVER REPLACE: the KEY SET is the list of regions the user has birded,
// read off their export, so `purgeHotspotRegionStore` is registered in
// `lib/clearDerived.ts`. A replaced backup purges nothing: an answered region is
// read from here, and only a region the new backup introduces costs a request.
//
// NOT SYNCED: eBird's public data, re-derivable on any device for one request
// per region (the reference store is excluded from iCloud Sync the same way).

import { storage } from './storage'
import { isWithinTtl } from './ttlWindow'

/** Storage-seam document key. Bump the suffix AND `version` together on any
 *  shape change: a mismatch yields an empty store, never a migration. */
export const HOTSPOT_REGIONS_STORE_KEY = 'hotspot-regions-v1'

/** TTL: 30 days, as milliseconds (days * hours * minutes * seconds * ms). The
 *  reference store's anchor; the links beside the share bar carry the same lag
 *  because they read the same Set. */
export const HOTSPOT_REGION_TTL_MS = 30 * 24 * 60 * 60 * 1000

/**
 * Entry cap (regions) and the serialized PAYLOAD budget in UTF-16 code units,
 * summed over `JSON.stringify(ids).length` per entry, keys and envelope
 * excluded (schema.md 9.3).
 *
 * THE BUDGET IS BOUNDED BY THE WEB/Pi ROUTE THAT SAVES THIS DOCUMENT
 * (`_MAX_BYTES`, 16 MiB, `backend/routers/settingskv.py`), whose 413 the write
 * below swallows. It is the largest power of two whose worst-case document fits
 * under that limit: 2^24 would not (the payload alone fills it), 2^23 does, and
 * `settingsRouteBudget.test.ts` builds that worst case through `sanitizeStore`
 * and holds it under the route. The entry cap bounds the `order` bookkeeping and
 * the load walk; for any mix of real-sized entries the budget binds first.
 */
export const HOTSPOT_REGIONS_MAX_ENTRIES_DEFAULT = 512
export const HOTSPOT_REGIONS_MAX_BYTES_DEFAULT = 8_388_608
export let HOTSPOT_REGIONS_MAX_ENTRIES = HOTSPOT_REGIONS_MAX_ENTRIES_DEFAULT
export let HOTSPOT_REGIONS_MAX_BYTES = HOTSPOT_REGIONS_MAX_BYTES_DEFAULT

/** Test seam: override the entry cap. */
export function setHotspotRegionsMaxEntries(n: number): void { HOTSPOT_REGIONS_MAX_ENTRIES = n }
/** Test seam: override the payload budget. */
export function setHotspotRegionsMaxBytes(n: number): void { HOTSPOT_REGIONS_MAX_BYTES = n }

/**
 * Per-entry bounds the load validator and the write filter share (one
 * predicate, both sides of the document).
 *
 * HOTSPOT_IDS_PER_REGION_MAX = 65,536 (2^16), checked at build against one of
 * the largest US states: `ref/hotspot/US-TX` answered 7,494 ids (2026-11-06,
 * pipeline/hotspot-share-stat/decisions.md), so the bound sits about 8.7 times
 * above it. A country-level code answering with more is served for the session
 * and not persisted.
 */
export const HOTSPOT_IDS_PER_REGION_MAX = 65_536
/** Twin of the backend route's `max_length=12` on `regionCode`. */
export const HOTSPOT_REGION_KEY_MAX_CHARS = 12
/** 'L' plus 15 digits. eBird's ids are 'L' plus up to 8 digits today. */
export const HOTSPOT_ID_MAX_CHARS = 16
export const HOTSPOT_ID_RE = /^L[0-9]{1,15}$/

/** An eBird region code: country "US", subnational1 "US-CA", subnational2
 *  "US-CA-037". Anchored at both ends, and each quantified group starts with a
 *  literal '-' the run before it cannot contain, so a test is linear in the
 *  code's length. Single-sourced here: `hotspotSet.ts` (which decides which
 *  regions are asked) imports it, so "a key the store admits" and "a code the
 *  module asks" agree by construction. */
export const HOTSPOT_REGION_CODE_RE = /^[A-Z]{2}(-[A-Z0-9]+){0,2}$/

/** The smallest serialized id, `"L1",`: what bounds the load walk's id count. */
const MIN_SERIALIZED_ID = 5

export interface HotspotRegionEntry {
  /** Shape-valid public-hotspot location ids eBird returned; [] is a real answer. */
  readonly ids: readonly string[]
  /** ms epoch of the answer; the TTL anchor. */
  readonly fetchedAt: number
}

export interface HotspotRegionStore {
  version: 1
  /** Keyed by region code ("US-MN"); exactly the keys the hotspot module asks. */
  entries: Record<string, HotspotRegionEntry>
  /** Oldest fetched first (eviction order). */
  order: string[]
}

const EMPTY_STORE = (): HotspotRegionStore => ({ version: 1, entries: {}, order: [] })

/** The id shape both sides of the document admit. The length check runs first,
 *  so the pattern never sees more than 16 characters. */
function isStorableId(id: unknown): id is string {
  return typeof id === 'string' && id.length <= HOTSPOT_ID_MAX_CHARS && HOTSPOT_ID_RE.test(id)
}

/** The region-key shape both sides of the document admit (length first). */
export function isStorableRegionKey(key: unknown): key is string {
  return typeof key === 'string' && key.length <= HOTSPOT_REGION_KEY_MAX_CHARS && HOTSPOT_REGION_CODE_RE.test(key)
}

/**
 * `JSON.stringify(ids).length` for ASCII ids, derived arithmetically: `[]` is 2;
 * otherwise one opening bracket plus, per id, its length, two quotes and one
 * comma or closing bracket. Asserted equal to the real serialization in the
 * store's own test.
 */
export function idsPayloadLength(ids: readonly string[]): number {
  if (ids.length === 0) return 2
  let n = 1
  for (const id of ids) n += id.length + 3
  return n
}

/** Due for a refresh: aged to or past the TTL, or dated more than 24 hours
 *  ahead of `now` (the plausibility window in `lib/ttlWindow.ts`,
 *  ebird-request-economy D-03), so an answer stamped by a clock that ran fast
 *  is asked for once more and rewritten at the corrected time rather than
 *  honoured until the clock catches up. A due entry is still served. */
export function isRegionEntryDue(entry: HotspotRegionEntry, now: number = Date.now()): boolean {
  return !isWithinTtl(entry.fetchedAt, now, HOTSPOT_REGION_TTL_MS)
}

const getOwn = (entries: Record<string, HotspotRegionEntry>, key: string): HotspotRegionEntry | null =>
  Object.hasOwn(entries, key) ? entries[key] : null

// -- Deterministic work accounting (tests only) ---------------------------------
// Installed by `_resetHotspotRegionCacheForTests`; null in the app, so the hot
// path pays one null check. The capacity+1 and repeated-key guards read WORK
// DONE from here rather than elapsed time.
export interface HotspotRegionCacheWorkStats {
  loaderCalls: number
  puts: number
  evictions: number
  keyValidations: number
  idTests: number
  writeFlushes: number
}
const EMPTY_WORK_STATS = (): HotspotRegionCacheWorkStats => ({
  loaderCalls: 0, puts: 0, evictions: 0, keyValidations: 0, idTests: 0, writeFlushes: 0,
})
let _workStats: HotspotRegionCacheWorkStats | null = null

/**
 * Normalize a loaded document to a well-formed store. The ONE normalizer: every
 * document read goes through it, and a purge installs the empty store. Nothing
 * in the document is trusted by its presence (schema.md 7.2).
 *
 * The walk is NEWEST FIRST over `order` and stops at the first entry that would
 * exceed the entry cap or the payload budget, so an oversized document sheds its
 * OLDEST entries (the comparator the write path evicts by). Per entry, in order:
 * the key is recorded at FIRST SIGHT, before its validation (a hostile `order`
 * repeating one invalid key pays one validation, not one per repeat); the key
 * is refused unless it is a region code of at most 12 characters; the entry is
 * refused unless `fetchedAt` is a finite number and `ids` an array of at most
 * HOTSPOT_IDS_PER_REGION_MAX elements, both O(1) checks made before any id is
 * read; each id is refused unless it is a string of at most 16 characters
 * matching HOTSPOT_ID_RE, and one bad id drops the whole entry (that region is
 * simply asked again).
 *
 * WORK BOUND: every id the walk examines, admitted or dropped, is charged
 * against `floor(MAX_BYTES / 5) + HOTSPOT_IDS_PER_REGION_MAX`, the most an
 * admitted document could need (each admitted id costs at least 5 code units of
 * budget, plus the one entry that crosses it), and the walk stops before an
 * entry that would pass that charge. So a document of malformed entries cannot
 * buy more validation than a valid one: about 1.74 M id tests at the shipped
 * budget, around 115 ms at the measured 65 ns per test, whatever the document.
 * An entry dropped that way is older than every admitted one and is asked again.
 */
export function sanitizeStore(loaded: unknown): HotspotRegionStore {
  if (typeof loaded !== 'object' || loaded === null) return EMPTY_STORE()
  const doc = loaded as { entries?: unknown; order?: unknown }
  if (typeof doc.entries !== 'object' || doc.entries === null || !Array.isArray(doc.order)) return EMPTY_STORE()
  const rawEntries = doc.entries as Record<string, unknown>
  const order = doc.order as unknown[]
  const seen = new Set<unknown>()
  const admitted: Array<[string, HotspotRegionEntry]> = []
  const maxExamined = Math.floor(HOTSPOT_REGIONS_MAX_BYTES / MIN_SERIALIZED_ID) + HOTSPOT_IDS_PER_REGION_MAX
  let examined = 0
  let bytes = 0
  for (let i = order.length - 1; i >= 0; i -= 1) {
    const key = order[i]
    if (seen.has(key)) continue
    seen.add(key)
    if (_workStats) _workStats.keyValidations += 1
    if (!isStorableRegionKey(key)) continue
    if (!Object.hasOwn(rawEntries, key)) continue
    const raw = rawEntries[key]
    if (typeof raw !== 'object' || raw === null) continue
    const e = raw as { ids?: unknown; fetchedAt?: unknown }
    if (typeof e.fetchedAt !== 'number' || !Number.isFinite(e.fetchedAt)) continue
    if (!Array.isArray(e.ids) || e.ids.length > HOTSPOT_IDS_PER_REGION_MAX) continue
    const rawIds = e.ids as unknown[]
    if (examined + rawIds.length > maxExamined) break
    examined += rawIds.length
    let ok = true
    for (const id of rawIds) {
      if (_workStats) _workStats.idTests += 1
      if (!isStorableId(id)) { ok = false; break }
    }
    if (!ok) continue
    const ids = rawIds as string[]
    const entryBytes = idsPayloadLength(ids)
    if (admitted.length + 1 > HOTSPOT_REGIONS_MAX_ENTRIES || bytes + entryBytes > HOTSPOT_REGIONS_MAX_BYTES) break
    bytes += entryBytes
    admitted.push([key, { ids, fetchedAt: e.fetchedAt }])
  }
  const store = EMPTY_STORE()
  for (let i = admitted.length - 1; i >= 0; i -= 1) {
    const [key, entry] = admitted[i]
    store.entries[key] = entry
    store.order.push(key)
  }
  return store
}

/** The derived payload length of a whole store (`sanitizeStore`'s output). */
export function storePayloadLength(store: HotspotRegionStore): number {
  let n = 0
  for (const k of store.order) {
    const e = getOwn(store.entries, k)
    if (e) n += idsPayloadLength(e.ids)
  }
  return n
}

// -- The coalesced in-memory mirror (one disk read per session) ------------------
let _store: HotspotRegionStore | null = null
let _loading: Promise<HotspotRegionStore> | null = null
let _totalBytes = 0

async function loadStore(): Promise<HotspotRegionStore> {
  if (_store) return _store
  if (_loading) return _loading
  _loading = (async () => {
    // Both a rejection and a synchronous throw read as "no document": a
    // corrupted or unreadable store degrades to "not cached" (every region is
    // simply asked), never to a failed build.
    let loaded: unknown
    try { loaded = await storage.getSetting<unknown>(HOTSPOT_REGIONS_STORE_KEY) } catch { loaded = null }
    // A purge landed while this read was in flight (clear means clear): it has
    // already installed the authoritative empty mirror, and `loaded` is the
    // PRE-purge document whose KEY SET says which regions the user has birded.
    if (_store) return _store
    _store = sanitizeStore(loaded)
    _totalBytes = storePayloadLength(_store)
    return _store
  })()
  try {
    return await _loading
  } finally {
    _loading = null
  }
}

/** Read the document once per session (later calls are a mirror hit). Never
 *  rejects. */
export async function ensureLoaded(): Promise<void> {
  await loadStore()
}

/** The mirror's entry for a region after `ensureLoaded`, fresh or due, or null.
 *  Never issues a request. */
export function peekRegion(regionCode: string): HotspotRegionEntry | null {
  return _store ? getOwn(_store.entries, regionCode) : null
}

function putEntry(store: HotspotRegionStore, regionCode: string, ids: readonly string[], fetchedAt: number): void {
  // A purge replaced the mirror while the loader was in flight: `store` is the
  // detached pre-purge document. The caller still gets its live answer for
  // this session; only persistence is skipped, so the cleared key set stays
  // cleared.
  if (store !== _store) return
  if (_workStats) _workStats.puts += 1
  const bytes = idsPayloadLength(ids)
  const existing = getOwn(store.entries, regionCode)
  if (existing) _totalBytes -= idsPayloadLength(existing.ids)
  store.entries[regionCode] = { ids, fetchedAt }
  _totalBytes += bytes
  const at = store.order.indexOf(regionCode)
  if (at !== -1) store.order.splice(at, 1)
  store.order.push(regionCode)
  // Evict oldest fetched while over EITHER bound; the just-put tail survives.
  // No single admitted entry can exceed the budget (1,245,185 < 8,388,608), so
  // the `> 1` guard never has to keep an oversized sole entry.
  while (
    store.order.length > 1 &&
    (store.order.length > HOTSPOT_REGIONS_MAX_ENTRIES || _totalBytes > HOTSPOT_REGIONS_MAX_BYTES)
  ) {
    if (_workStats) _workStats.evictions += 1
    const oldest = store.order.shift()!
    const ev = getOwn(store.entries, oldest)
    if (ev) {
      _totalBytes -= idsPayloadLength(ev.ids)
      delete store.entries[oldest]
    }
  }
  scheduleWrite(store)
}

export interface HotspotRegionFetchResult {
  ids: readonly string[]
  fetchedAt: number
  /** True when the loader ran (a live request was made). */
  fromNetwork: boolean
}

const _inflight = new Map<string, Promise<HotspotRegionFetchResult>>()

/**
 * The one read/fetch chokepoint. A persisted entry within the TTL resolves with
 * no request, and so does a due entry when `refresh` is false. A miss, or a due
 * entry with `refresh` true, runs `loader` (deduped per region), filters its
 * answer to the validator's bounds, persists it (unless it is over the
 * per-region bound or its key is one the validator would refuse) and resolves
 * it. A loader failure of ANY kind, a 429 included, rethrows and writes
 * nothing: the caller holds the stale list it read through `peekRegion` and
 * keeps serving it. A body that is not an array is a failure, never an answer.
 *
 * The purge generation is the mirror identity, captured BEFORE the loader runs
 * and compared at the write (`putEntry`), so a request begun before a Clear
 * persists nothing after it.
 */
export function dedupedFetch(
  regionCode: string,
  loader: () => Promise<unknown>,
  opts: { refresh: boolean },
): Promise<HotspotRegionFetchResult> {
  const run = async (): Promise<HotspotRegionFetchResult> => {
    const store = await loadStore()
    const hit = getOwn(store.entries, regionCode)
    if (hit && (!opts.refresh || !isRegionEntryDue(hit))) {
      return { ids: hit.ids, fetchedAt: hit.fetchedAt, fromNetwork: false }
    }
    const pending = _inflight.get(regionCode)
    if (pending) return pending
    // `p` is read inside its own body only after an await, by which time the
    // assignment below has run. The loader is started one microtask late for
    // the same reason: a loader that throws synchronously still rejects AFTER
    // `p` is registered, so its `finally` removes it rather than leaving a
    // settled entry for every later caller to join.
    let p: Promise<HotspotRegionFetchResult> | undefined = undefined
    p = (async (): Promise<HotspotRegionFetchResult> => {
      try {
        if (_workStats) _workStats.loaderCalls += 1
        const raw = await Promise.resolve().then(loader)
        if (!Array.isArray(raw)) throw new TypeError('hotspot-region answer is not a list')
        const ids: string[] = []
        for (const id of raw) if (isStorableId(id)) ids.push(id)
        const fetchedAt = Date.now()
        // Still the current request for its region: `abandonInflight` (a key or
        // file save) and the purge both clear the map, and an answer obtained
        // before either is served to its caller but never persisted.
        if (
          _inflight.get(regionCode) === p &&
          ids.length <= HOTSPOT_IDS_PER_REGION_MAX &&
          isStorableRegionKey(regionCode)
        ) {
          putEntry(store, regionCode, ids, fetchedAt)
        }
        return { ids, fetchedAt, fromNetwork: true }
      } finally {
        if (_inflight.get(regionCode) === p) _inflight.delete(regionCode)
      }
    })()
    _inflight.set(regionCode, p)
    return p
  }
  return run()
}

/**
 * Drop every in-flight request's claim to write: a request already running still
 * settles for whoever awaited it, but it is not joined by a later caller and
 * does not persist its answer. `invalidateHotspotSet` calls this (a key or file
 * save: an answer obtained under the old key must not be adopted by the rebuild).
 */
export function abandonInflight(): void {
  _inflight.clear()
}

// -- The debounced whole-document write (best-effort, off the blocking path) -----
let _writeTimer: ReturnType<typeof setTimeout> | null = null
const WRITE_DEBOUNCE_MS = 250

function scheduleWrite(store: HotspotRegionStore): void {
  if (_writeTimer) clearTimeout(_writeTimer)
  _writeTimer = setTimeout(() => {
    _writeTimer = null
    flushWrite(store)
  }, WRITE_DEBOUNCE_MS)
}

function flushWrite(store: HotspotRegionStore): void {
  // Superseded by a purge: this closure holds the PRE-purge document.
  if (store !== _store) return
  if (_workStats) _workStats.writeFlushes += 1
  const snapshot: HotspotRegionStore = {
    version: store.version,
    entries: { ...store.entries },
    order: [...store.order],
  }
  try {
    void storage.setSetting<HotspotRegionStore>(HOTSPOT_REGIONS_STORE_KEY, snapshot)
      .catch(() => { /* best-effort: the mirror stays the live source */ })
  } catch { /* best-effort, as above */ }
}

/**
 * Drop every persisted region from the mirror AND from disk. The PRODUCTION
 * purge, distinct from `_resetHotspotRegionCacheForTests`, which only detaches
 * the mirror. Registered in `lib/clearDerived.ts` because the KEY SET is the list
 * of regions the user has birded, read off their export; the payloads are
 * eBird's public data. Called only from the clear-path teardown, never on a
 * replace. The mirror is emptied before the delete is awaited, so a failed
 * delete still leaves the session showing nothing stale.
 */
export async function purgeHotspotRegionStore(): Promise<void> {
  if (_writeTimer) { clearTimeout(_writeTimer); _writeTimer = null }
  _inflight.clear()
  _store = EMPTY_STORE()
  _totalBytes = 0
  await storage.deleteSetting(HOTSPOT_REGIONS_STORE_KEY)
}

/** Test seam: run a pending debounced write now. */
export function _flushHotspotRegionWriteForTests(): void {
  if (!_writeTimer) return
  clearTimeout(_writeTimer)
  _writeTimer = null
  if (_store) flushWrite(_store)
}

/** Test seam: the mirror's derived payload total, for the eviction rows. */
export function _hotspotRegionBytesForTests(): number {
  return _totalBytes
}

/** Test seam: deterministic work performed since the last reset. */
export function _getHotspotRegionCacheWorkStatsForTests(): Readonly<HotspotRegionCacheWorkStats> {
  if (!_workStats) _workStats = EMPTY_WORK_STATS()
  return { ..._workStats }
}

/** Test seam: reset the module mirror so each test starts from disk-empty. */
export function _resetHotspotRegionCacheForTests(): void {
  if (_writeTimer) { clearTimeout(_writeTimer); _writeTimer = null }
  _store = null
  _loading = null
  _totalBytes = 0
  _workStats = EMPTY_WORK_STATS()
  _inflight.clear()
  HOTSPOT_REGIONS_MAX_ENTRIES = HOTSPOT_REGIONS_MAX_ENTRIES_DEFAULT
  HOTSPOT_REGIONS_MAX_BYTES = HOTSPOT_REGIONS_MAX_BYTES_DEFAULT
}
