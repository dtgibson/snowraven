// The durable per-(county, day) store behind the Targets tab's live sweep
// (targets-tab, schema.md section 3, amended 2026-09-27). One entry is one
// eBird answer to "which species were reported in this county on this day",
// keyed `${regionCode}|${YYYY-MM-DD}`, so a revisit the same day costs one call
// (today, re-asked) and the next day costs two (FR-44).
//
// SHAPE: the `countyCompletenessCache.ts` pattern (one storage-seam document,
// a one-disk-read-per-session mirror, an entry cap and a payload budget, an
// in-flight dedupe Map, errors never cached, offline stale reads), plus the
// three things that pattern predates and CLAUDE.md now requires:
//   1. VALIDATION AT THE WRITE CHOKEPOINT, not only on load
//      (`checklistProjectsCache.ts` is the reference): every record of a fresh
//      answer is judged by `isValidDayRecord`, the same predicate the load path
//      runs, before the single write path sees it, so "no out-of-bound value
//      can exist in this document" is a property of this module rather than of
//      whichever producer sits upstream. The sanitized entry is also what the
//      caller receives, so the displayed and the persisted answer are one object.
//   2. A PURGE GENERATION CAPTURED AT THE FETCH CHOKEPOINT, before the loader
//      (the `exoticProvenanceCache.ts` internal-capture shape, since the
//      chokepoint is inside this module): a Clear while a day is in flight must
//      not persist that answer, because the KEY is a county the user birded.
//   3. A per-entry `complete` flag in place of a TTL: a day before today is
//      final once fetched; today is still accruing, so an incomplete entry is
//      re-asked whenever this is called for it (the sweep decides how often:
//      at most once per visit). Decided at WRITE time from the device's local
//      date. Stated residual: a checklist entered late for a past day is not
//      seen until that day's entry is evicted.
//
// ITS OWN DOCUMENT, the `replay.json` precedent: `data/county-day-obs.json` on
// Tauri, the `county-day-obs-v2` key (its own file) on web/Pi, through three
// typed seam methods. This module never names that path or key; `storage.ts`
// owns both. It lived inside the shared settings document until 2026-09-27,
// where every preference save rewrote it, which is what held its budget to 2 M.
//
// ITS OWN ORDERED WRITER, NOT `docChains` (schema.md section 3.6). There is no
// read-modify-write here to clobber: one writing module, whole-document
// snapshots of a mirror that is the source of truth. That holds for a
// STRUCTURAL reason a future change would break silently: a write is reachable
// only from a flush, which requires a completed `ensureLoaded`, or from the
// purge, which awaits it. Add a re-load after a purge, a second module that
// writes this document, or any read of the file that feeds a write, and it owes
// the full `docChains` treatment instead. One module is still not one write at
// a time, so every write (the purge's DELETE included) goes through
// `writeThrough` below, in call order.
//
// EVICTION IS A COMPARATOR, NOT INSERTION FIFO. The sweep asks newest-first and
// a re-fetched today moves to the tail of `order`, so FIFO shed a county's
// NEWEST days first. The victim is now the minimum, over every entry except the
// one being written, of: (1) a day outside the sweep's 30-day window, (2) the
// county visited longest ago (`max(fetchedAt)` over its entries, which IS the
// last visit because a visit always re-fetches today), (3) the smallest date,
// (4) the key. An eviction still loses nothing that cannot be re-asked, at one
// request a day, which is why eviction rather than admission control is right
// here (CLAUDE.md, v0.5.87). `order[]` stays as insertion order, for hygienic
// enumeration only.
//
// PAYLOAD BUDGET is `JSON.stringify(species).length` UTF-16 code units summed
// over entries, the completeness and replay stores' unit; it is not a byte cap,
// and one sole oversized newest entry is allowed. At the measured ~170 bytes a
// record, 10 M is about ten busy counties' 30-day windows. The entry cap (3,000)
// is only a backstop on near-empty envelopes, sized so the budget binds first.
//
// IMPORT DISCIPLINE: the storage seam, the offline classifier, the record
// validator, the date helpers and the region-code shape. Never `transport`: the
// network fetcher is an injected loader. Registered in `clearDerived.ts`,
// because the key set is the list of counties the user has birded.
//
// SINGLE-WEBVIEW INVARIANT: the mirror, the in-flight map, the purge generation
// and the ordered writer are module state in ONE JS context, sufficient while
// the app runs exactly one webview. Reversal condition: CLAUDE.md, Desktop
// storage (Tauri), the v1.0.9 entry.

import { storage } from './storage'
import { isOfflineError } from './offlineDetect'
import {
  isValidDayObsDate, isValidDayRecord, unexpectedEbirdResponse,
  type DayObsPayload, type DayRecord,
} from './countyDayObsReduce'
import { lastNDates, localDateString, SWEEP_DAYS } from './targets/targetsDates'
import { REGION_CODE_RE } from './regionCode'

/** The document's shape version. Any other version reads as the empty store,
 *  never a migration. Moved 1 -> 2 with the document's move to its own file. */
const STORE_VERSION = 2

/**
 * The preview-build key: the store lived in the shared settings document under
 * this key before 2026-09-27. `ensureLoaded` deletes it once per session so it
 * is not left as up to 2 MB rewritten on every settings change (schema.md
 * 3.6). It is NOT on the purge path. REMOVAL CONDITION: this constant and its
 * one call may go in any release after 1.0.38 has run once on the build Mac and
 * the tailnet preview backend, the only two places it was ever persisted.
 */
export const LEGACY_DAY_OBS_SETTING_KEY = 'county-day-obs-v1'

/** A backstop on envelope count, sized so the payload budget binds first for
 *  any day above ~3.3 KB of records. Mutable binding + test seam. */
export let DAY_OBS_MAX_ENTRIES = 3_000
/** Payload budget in UTF-16 code units (see the header), about ten busy
 *  counties' 30-day windows. Mutable binding + test seam. */
export let DAY_OBS_MAX_BYTES = 10_000_000
/** Records per entry; the reducer reads at most this many records, too. */
export const DAY_OBS_MAX_SPECIES = 5000

export function setDayObsMaxEntries(n: number): void { DAY_OBS_MAX_ENTRIES = n }
export function setDayObsMaxBytes(n: number): void { DAY_OBS_MAX_BYTES = n }

export interface DayObsEntry {
  /** ms epoch the answer arrived. Provenance only; never a TTL. */
  fetchedAt: number
  /** True iff the entry's date was before the device's local date at fetch. */
  complete: boolean
  /** JSON.stringify(species).length, recomputed on load and never trusted. */
  bytes: number
  species: DayRecord[]
}

interface DayObsStore {
  version: 2
  /** Null prototype: the keys are validated, and the write side is hygienic too. */
  entries: Record<string, DayObsEntry>
  /** Insertion order, for hygienic enumeration only. NOT the eviction order. */
  order: string[]
}

const KEY_RE = /^US-[A-Z]{2}-[0-9]{3}\|[0-9]{4}-[0-9]{2}-[0-9]{2}$/

/** The store key for one county day. */
export function dayObsKey(regionCode: string, date: string): string {
  return `${regionCode}|${date}`
}

const EMPTY_STORE = (): DayObsStore => ({
  version: STORE_VERSION,
  entries: Object.create(null) as Record<string, DayObsEntry>,
  order: [],
})

function copyRecord(r: DayRecord): DayRecord {
  return { speciesCode: r.speciesCode, obsDt: r.obsDt, locId: r.locId, locName: r.locName, lat: r.lat, lng: r.lng }
}

/**
 * Judge a persisted entry for `date`. Every record must pass the same
 * validator the write path uses, no species code may repeat (a duplicate would
 * double-count that day), and the array is capped. Returns the rebuilt entry
 * (fresh objects, `bytes` recomputed) or null to drop it.
 */
function validEntry(e: unknown, date: string): DayObsEntry | null {
  if (typeof e !== 'object' || e === null || Array.isArray(e)) return null
  const c = e as { fetchedAt?: unknown; complete?: unknown; bytes?: unknown; species?: unknown }
  if (typeof c.fetchedAt !== 'number' || !Number.isFinite(c.fetchedAt)) return null
  if (typeof c.complete !== 'boolean') return null
  if (typeof c.bytes !== 'number' || !Number.isFinite(c.bytes) || c.bytes < 0) return null
  if (!Array.isArray(c.species) || c.species.length > DAY_OBS_MAX_SPECIES) return null
  const seen = new Set<string>()
  const species: DayRecord[] = []
  for (const r of c.species) {
    if (!isValidDayRecord(r, date)) return null
    if (seen.has(r.speciesCode)) return null
    seen.add(r.speciesCode)
    species.push(copyRecord(r))
  }
  return { fetchedAt: c.fetchedAt, complete: c.complete, bytes: JSON.stringify(species).length, species }
}

let _totalBytes = 0

/** The county half of a store key. */
function regionOf(key: string): string {
  return key.slice(0, key.indexOf('|'))
}
/** The date half of a store key. */
function dateOf(key: string): string {
  return key.slice(key.indexOf('|') + 1)
}

/**
 * The next victim, or null when nothing but `keep` remains: the minimum, over
 * every entry except `keep`, of (1) outside the sweep's window before inside
 * it, (2) the county visited longest ago, by `max(fetchedAt)` over its entries,
 * (3) the smallest date, (4) the key. O(n) per call, with the county recency
 * recomputed each time, because evicting an entry can lower its county's.
 */
function pickVictim(store: DayObsStore, keep: string | null, horizon: string): string | null {
  const lastVisited = new Map<string, number>()
  for (const k of store.order) {
    const r = regionOf(k)
    const at = store.entries[k].fetchedAt
    const prev = lastVisited.get(r)
    if (prev === undefined || at > prev) lastVisited.set(r, at)
  }
  let best: string | null = null
  let bestOut = false
  let bestVisited = 0
  let bestDate = ''
  for (const k of store.order) {
    if (k === keep) continue
    const date = dateOf(k)
    const out = date < horizon
    const visited = lastVisited.get(regionOf(k))!
    const better = best === null
      || (out !== bestOut ? out
        : visited !== bestVisited ? visited < bestVisited
        : date !== bestDate ? date < bestDate
        : k < best)
    if (better) { best = k; bestOut = out; bestVisited = visited; bestDate = date }
  }
  return best
}

/**
 * Evict while over EITHER budget, never `keep` (the entry being written, so the
 * newest answer always survives: the one-sole-oversized rule). With no `keep`
 * (the load path) eviction still stops at one entry. `nowMs` fixes the sweep
 * window's oldest date, `lastNDates(nowMs)[SWEEP_DAYS - 1]`.
 */
function evict(store: DayObsStore, keep: string | null, nowMs: number): void {
  const horizon = lastNDates(nowMs, SWEEP_DAYS)[SWEEP_DAYS - 1]
  while (
    store.order.length > 1 &&
    (store.order.length > DAY_OBS_MAX_ENTRIES || _totalBytes > DAY_OBS_MAX_BYTES)
  ) {
    const victim = pickVictim(store, keep, horizon)
    if (victim === null) break
    if (_workStats) _workStats.evictions += 1
    _totalBytes -= store.entries[victim].bytes
    delete store.entries[victim]
    store.order.splice(store.order.indexOf(victim), 1)
  }
}

/**
 * Normalize a loaded document. A bad document or any `version` other than 2 is
 * the empty store; per entry, only a well-shaped key naming a real calendar day
 * with an entry that passes `validEntry` survives. Never throws. Every read of
 * the raw record is `Object.hasOwn`, never a bare index, so a `__proto__` or
 * `constructor` key (which KEY_RE refuses anyway) cannot select an inherited
 * member.
 *
 * LOAD-TIME ADMISSION: at most `DAY_OBS_MAX_ENTRIES` valid keys are admitted, in
 * `order` sequence, and the rest are dropped before `evict` runs, so the victim
 * scan is bounded by the cap and not by whatever a bloated document holds. The
 * byte budget is then enforced by `evict`, exactly as at any put.
 */
function sanitizeStore(loaded: unknown, nowMs: number): DayObsStore {
  const store = EMPTY_STORE()
  _totalBytes = 0
  if (typeof loaded !== 'object' || loaded === null) return store
  const doc = loaded as { version?: unknown; entries?: unknown; order?: unknown }
  if (doc.version !== STORE_VERSION) return store
  if (typeof doc.entries !== 'object' || doc.entries === null || !Array.isArray(doc.order)) return store
  const raw = doc.entries as Record<string, unknown>
  for (const key of doc.order) {
    if (store.order.length >= DAY_OBS_MAX_ENTRIES) break
    if (typeof key !== 'string' || !KEY_RE.test(key)) continue
    const date = dateOf(key)
    if (!isValidDayObsDate(date)) continue
    if (Object.hasOwn(store.entries, key)) continue          // duplicate order key
    if (!Object.hasOwn(raw, key)) continue
    const entry = validEntry(raw[key], date)
    if (!entry) continue
    store.entries[key] = entry
    store.order.push(key)
    _totalBytes += entry.bytes
  }
  evict(store, null, nowMs)
  return store
}

// ── Coalesced in-memory mirror (one disk read per session) ───────────────────

let _store: DayObsStore | null = null
let _loading: Promise<DayObsStore> | null = null
let _purgeGeneration = 0

export interface CountyDayObsCacheWorkStats {
  loads: number
  loaderCalls: number
  puts: number
  evictions: number
  writeSchedules: number
  writeFlushes: number
}

const EMPTY_WORK_STATS = (): CountyDayObsCacheWorkStats => ({
  loads: 0, loaderCalls: 0, puts: 0, evictions: 0, writeSchedules: 0, writeFlushes: 0,
})

// Installed only by the test reset seam: the production path carries no
// counters. Work is asserted as WORK DONE, never elapsed time (testing.md).
let _workStats: CountyDayObsCacheWorkStats | null = null

// The once-per-session legacy delete's latch (schema.md 3.6). Today the load
// below runs at most once per session anyway (a purge installs an empty mirror,
// it never clears `_store`), so no test can tell the latch from its absence:
// mutation-checked GREEN for that reason. It is what keeps the delete to once a
// session if a re-load after a purge is ever added, the same change the header
// names as ending this module's no-`docChains` argument.
let _legacyDeleteFired = false

async function ensureLoaded(): Promise<DayObsStore> {
  if (_store) return _store
  if (_loading) return _loading
  _loading = (async () => {
    if (_workStats) _workStats.loads += 1
    const loaded = await storage.getCountyDayObsStore().catch(() => null)
    // The preview build's key in the SHARED settings document, deleted once per
    // session after this store's own read. Deliberately outside `_writeChain`:
    // it is a link on the seam's settings chain and touches a different
    // document. Best-effort, and a device that never ran a preview deletes an
    // absent key, which both adapters treat as done.
    if (!_legacyDeleteFired) {
      _legacyDeleteFired = true
      void storage.deleteSetting(LEGACY_DAY_OBS_SETTING_KEY).catch(() => { /* best-effort */ })
    }
    // A purge landed while this read was in flight: it installed the
    // authoritative empty mirror, and `loaded` is the PRE-purge document whose
    // key set is the list of counties the user just cleared.
    if (_store) return _store
    _store = sanitizeStore(loaded, Date.now())
    return _store
  })()
  try {
    return await _loading
  } finally {
    _loading = null
  }
}

/** Every cached county day, complete and incomplete alike, in insertion
 *  order. No network. The sweep seeds its 30 days from this. */
export async function loadAll(): Promise<ReadonlyMap<string, DayObsEntry>> {
  const store = await ensureLoaded()
  const out = new Map<string, DayObsEntry>()
  for (const k of store.order) {
    if (Object.hasOwn(store.entries, k)) out.set(k, store.entries[k])
  }
  return out
}

/**
 * THE WRITE CHOKEPOINT'S VALIDATION. The loader's answer is judged by the
 * store's own record predicate before anything else sees it: a payload for a
 * different county or day is not this day's answer and is refused as the 502
 * shape (never cached, never offline); within it, a record that fails the
 * validator is dropped on its own, a repeated species code keeps the greatest
 * `obsDt` (the reducer's rule), and the array is capped. The declared return
 * type is not evidence: on web/Pi the value has crossed JSON from a backend
 * that may be at another revision.
 */
function buildEntry(payload: DayObsPayload, regionCode: string, date: string, now: number): DayObsEntry {
  if (typeof payload !== 'object' || payload === null
    || payload.regionCode !== regionCode || payload.date !== date || !Array.isArray(payload.species)) {
    throw unexpectedEbirdResponse()
  }
  const best = new Map<string, DayRecord>()
  for (const r of payload.species as unknown[]) {
    if (best.size >= DAY_OBS_MAX_SPECIES) break
    if (!isValidDayRecord(r, date)) continue
    const prev = best.get(r.speciesCode)
    if (prev === undefined || r.obsDt > prev.obsDt) best.set(r.speciesCode, copyRecord(r))
  }
  const species = [...best.values()]
  return {
    fetchedAt: now,
    // Decided HERE, at write time, from the device's local date: a day before
    // today is final; today's answer is still accruing.
    complete: date < localDateString(now),
    bytes: JSON.stringify(species).length,
    species,
  }
}

/** The one write path. Refuses when a purge landed since `gen` was captured,
 *  or when the mirror it was handed is no longer the live one. */
function putEntry(store: DayObsStore, key: string, entry: DayObsEntry, gen: number): void {
  if (gen !== _purgeGeneration || store !== _store) return
  if (_workStats) _workStats.puts += 1
  if (Object.hasOwn(store.entries, key)) {
    _totalBytes -= store.entries[key].bytes
    const at = store.order.indexOf(key)
    if (at !== -1) store.order.splice(at, 1)
  }
  store.entries[key] = entry
  store.order.push(key)
  _totalBytes += entry.bytes
  evict(store, key, entry.fetchedAt)
  scheduleWrite(store)
}

export interface DayObsFetchResult {
  entry: DayObsEntry
  /** True when the loader ran and its answer is the entry returned. */
  fromNetwork: boolean
}

// In-flight dedupe, keyed by the store key and cleared in a `finally`. It lives
// in the store, not the controller, so it holds across remounts.
const _inflight = new Map<string, Promise<DayObsFetchResult>>()

/**
 * The ONE read/fetch chokepoint for a county day.
 *
 *   - a COMPLETE entry for a day before today short-circuits with no network;
 *   - an INCOMPLETE entry (today, or a day that was today when it was fetched)
 *     is always re-asked when this is called: the caller decides how often;
 *   - concurrent calls for one key share one loader call;
 *   - the purge generation is captured BEFORE the loader, and the write is
 *     refused if a Clear landed while it ran;
 *   - a loader failure caches NOTHING: while OFFLINE with any prior entry that
 *     entry is returned (`fromNetwork: false`), otherwise the error rethrows,
 *     a 429 and a 500 included.
 */
export function dedupedFetch(
  regionCode: string,
  date: string,
  loader: () => Promise<DayObsPayload>,
): Promise<DayObsFetchResult> {
  return (async () => {
    if (!REGION_CODE_RE.test(regionCode) || !isValidDayObsDate(date)) {
      throw Object.assign(new Error('Invalid county day.'), { status: 422, detail: 'Invalid county day.' })
    }
    const gen = _purgeGeneration
    const store = await ensureLoaded()
    const key = dayObsKey(regionCode, date)
    if (Object.hasOwn(store.entries, key)) {
      const hit = store.entries[key]
      if (hit.complete && date < localDateString(Date.now())) return { entry: hit, fromNetwork: false }
    }
    const pending = _inflight.get(key)
    if (pending) return pending
    // `let`, assigned below, so the `finally` can delete only ITS OWN entry: a
    // purge clears the map and a newer fetch for the same key may be in it.
    let p: Promise<DayObsFetchResult> | null = null
    p = (async (): Promise<DayObsFetchResult> => {
      try {
        if (_workStats) _workStats.loaderCalls += 1
        const payload = await loader()
        const entry = buildEntry(payload, regionCode, date, Date.now())
        putEntry(store, key, entry, gen)
        return { entry, fromNetwork: true }
      } catch (err) {
        const live = _store
        if (isOfflineError(err) && live && Object.hasOwn(live.entries, key)) {
          return { entry: live.entries[key], fromNetwork: false }
        }
        throw err
      } finally {
        if (_inflight.get(key) === p) _inflight.delete(key)
      }
    })()
    _inflight.set(key, p)
    return p
  })()
}

// ── One ordered writer for this document (schema.md section 3.6) ────────────
// Two `setCountyDayObsStore` calls in flight complete in whatever order the
// filesystem returns, and the purge's is the smaller operation, so it is the
// likelier to land first and be overwritten by a flush already inside the seam,
// which neither the cancelled timer nor the identity check reaches. So every
// operation on the document goes through here, in call order: the next one is
// not even CALLED until the previous one has settled. `replayStore`'s
// `writeThrough` shape with one difference: it takes a THUNK, because the
// purge's link is a delete rather than a write. The same two rules as
// `TauriStorage.chain`: a link never awaits another chained write, and a failed
// link rejects only its own caller (the stored tail swallows).
let _writeChain: Promise<void> = Promise.resolve()

function writeThrough(op: () => Promise<void>): Promise<void> {
  const link = _writeChain.then(op)
  _writeChain = link.then(() => undefined, () => undefined)
  return link
}

// ── Debounced whole-document write (best-effort, off the blocking path) ──────
// A flush serializes the WHOLE document (up to ~10 MB) on the main thread. The
// sweep's gap between puts is one request plus the gate's spacing, ~300-600 ms,
// so the debounce is a second rather than 250 ms: a 30-day pass coalesces into
// a handful of flushes instead of one per day. A crash inside the window loses
// at most one second of answers, each re-askable at one request.

let _writeTimer: ReturnType<typeof setTimeout> | null = null
export const WRITE_DEBOUNCE_MS = 1_000

function scheduleWrite(store: DayObsStore): void {
  if (_workStats) _workStats.writeSchedules += 1
  if (_writeTimer) clearTimeout(_writeTimer)
  _writeTimer = setTimeout(() => {
    _writeTimer = null
    // Superseded by a purge: this closure holds the PRE-purge document.
    if (store !== _store) return
    const snapshot: DayObsStore = {
      version: STORE_VERSION,
      // Null-prototype target: Object.assign uses [[Set]].
      entries: Object.assign(Object.create(null) as Record<string, DayObsEntry>, store.entries),
      order: [...store.order],
    }
    if (_workStats) _workStats.writeFlushes += 1
    void writeThrough(() => storage.setCountyDayObsStore(snapshot))
      .catch(() => { /* best-effort: the mirror stays the live source */ })
  }, WRITE_DEBOUNCE_MS)
}

// ── Clear-path teardown (clear-means-clear) ──────────────────────────────────

/**
 * Drop every cached county day from the mirror AND from disk. The PRODUCTION
 * purge, distinct from `_resetCountyDayObsCacheForTests`, which only detaches
 * the mirror.
 *
 * WHY THIS STORE IS IN THE TEARDOWN when every payload is eBird's public data:
 * an entry exists only for a county the Targets tab swept, and the tab offers
 * only counties the user's own backup contains, so the KEY SET is the list of
 * counties the user has birded. Accepted cost: those counties' 30 days re-fetch
 * once after a Clear and a re-upload.
 *
 * It SUPERSEDES in-flight work rather than merely emptying the mirror: the
 * debounced flush is cancelled, the in-flight map cleared, and the generation
 * advanced, so a day already in flight cannot write itself back a moment later.
 * The DELETE then rides the store's own write chain, so a flush already inside
 * the seam lands BEFORE it rather than after it. Awaited and not caught:
 * `clearDerived.ts` collects a failure and reports it.
 *
 * Called only from `lib/clearDerived.ts`, never on a replace.
 */
export async function purgeCountyDayObsStore(): Promise<void> {
  if (_writeTimer) { clearTimeout(_writeTimer); _writeTimer = null }
  _inflight.clear()
  _purgeGeneration += 1
  _store = EMPTY_STORE()
  _totalBytes = 0
  await writeThrough(() => storage.deleteCountyDayObsStore())
}

/** Test seam: deterministic work performed since the last reset. */
export function _getCountyDayObsCacheWorkStatsForTests(): Readonly<CountyDayObsCacheWorkStats> {
  if (!_workStats) _workStats = EMPTY_WORK_STATS()
  return { ..._workStats }
}

/** Test seam: reset the module mirror, the write chain, the legacy-delete
 *  latch and both budgets, so each test starts from disk-empty. */
export function _resetCountyDayObsCacheForTests(): void {
  if (_writeTimer) { clearTimeout(_writeTimer); _writeTimer = null }
  _store = null
  _loading = null
  _totalBytes = 0
  _workStats = EMPTY_WORK_STATS()
  _inflight.clear()
  _writeChain = Promise.resolve()
  _legacyDeleteFired = false
  DAY_OBS_MAX_ENTRIES = 3_000
  DAY_OBS_MAX_BYTES = 10_000_000
}
