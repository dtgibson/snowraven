// The persistent exotic-provenance store (schema.md §3, §4, §5, §8.4, §8.5).
//
// Structure copies the proven countyCompletenessCache.ts shape: one storage-seam
// document, a one-disk-read-per-session in-memory mirror, per-entry shape
// validation on load with malformed entries DROPPED rather than thrown on,
// in-flight request dedupe, errors never cached, and stale reads served offline.
// `/checklists/` stays OUT of `CACHED_GET_PATHS` (FR-23) — this module is the
// single caching layer for that path.
//
// IMPORT DISCIPLINE (FR-17, FR-35, QA-40). This module touches the storage seam
// only; the network fetcher is an INJECTED LOADER. It must never import
// `transport` or any `lib/tauri/*Service`. The Calendar's zero-network guarantee
// is enforced by that import graph, not by discipline, and
// `exoticProvenanceGraph.test.ts` walks it.
//
// The document holds TWO LEDGERS with DELIBERATELY OPPOSITE retention policies,
// chosen on what an eviction actually destroys (schema.md §4):
//
//   checklists  FIFO.       An evicted entry costs one redundant request next
//                           pass and LOSES NO ANSWER. Retaining the newest
//                           consulted checklists is exactly what FR-24's
//                           incremental refresh wants. Same class as the county
//                           completeness and replay stores.
//   species     ADMISSION.  Evicting a species entry destroys a paid-for network
//                           answer AND the raw tokens FR-09 exists to keep, and
//                           at capacity+1 it would do so on every pass forever,
//                           never converging. Admission control degrades instead
//                           to the state the feature already defines as safe: an
//                           unadmitted species has no record, classifies
//                           `unknown`, and COUNTS (FR-04).
//
// Per CLAUDE.md, any "never much worse than not caching" claim about EITHER
// ledger is measured at CAPACITY PLUS ONE and asserted as WORK DONE (loader
// calls, order searches, evictions) rather than elapsed time. The recorder is
// installed only by the test reset seam, so the production path carries no
// benchmark clocks.

import { storage } from './storage'
import { isOfflineError } from './offlineDetect'
import {
  EMPTY_SNAPSHOT, seenToken,
  type ProvenanceSnapshot, type SpeciesProvenanceRecord,
} from './exoticProvenance'

/** OQ-04: 30 days, matching COMPLETENESS_TTL_MS. Governs RE-CONSULTATION, not
 *  display: a stale record still counts and still excludes (schema.md §9). */
export const PROVENANCE_TTL_MS = 30 * 24 * 60 * 60 * 1000

/** Storage-seam document key. Bump the suffix AND `version` together on any
 *  shape change; a mismatch yields an empty store, never a migration. */
export const PROVENANCE_STORE_KEY = 'exotic-provenance-v1'

// Caps. Both are stated STRUCTURALLY (entry count, key length, member count),
// never as a byte product: three measurements of one design in v0.5.85 gave 172,
// 208 and 173 B/entry, so a byte figure encodes one engine's heap accounting and
// can go false without ever failing.
//
// PROVENANCE_MAX_SPECIES: the bundled v2027 taxonomy snapshot carries 11,167
// species names in `byCom` (17,891 codes including forms). Provenance is
// admitted only for codes in the current cover index, so the index is bounded by
// the birder's life list, which is bounded by the world species list. This cap
// sits above the entire world taxonomy and cannot bind on real data.
//
// PROVENANCE_MAX_CHECKLISTS: a pass is bounded at MAX_REQUESTS_PER_PASS (500),
// so reaching 32,768 takes 66 full-budget passes. The reference export has 3,252
// checklists in total, so its ledger cannot exceed 3,252 however many run.
export let PROVENANCE_MAX_SPECIES = 16_384
export let PROVENANCE_MAX_CHECKLISTS = 32_768

/** Test seam: override the species admission limit. */
export function setProvenanceMaxSpecies(n: number): void { PROVENANCE_MAX_SPECIES = n }
/** Test seam: override the checklist ledger entry cap. */
export function setProvenanceMaxChecklists(n: number): void { PROVENANCE_MAX_CHECKLISTS = n }

/** At most this many distinct raw token pairs per species. Five shapes exist in
 *  the sampled data; 8 leaves room for a future eBird category without letting
 *  a hostile document grow an entry without bound. */
export const MAX_SEEN_PER_SPECIES = 8

/** Structural bound on the published escapee-name list (schema.md §3 note). */
const MAX_PUBLISHED_NAMES = 4096
const MAX_PUBLISHED_NAME_LENGTH = 128

export interface ProvenanceStore {
  version: 1
  /** Consulted-checklist ledger. Submission id -> ms-epoch fetch time, and
   *  nothing else. A per-checklist species map would be a second copy of what
   *  `species` already holds in the form FR-09 requires, and dropping it makes
   *  every ledger entry structurally fixed-size. */
  checklists: Record<string, number>
  /** FIFO eviction order for `checklists`, oldest-fetched first. */
  order: string[]
  /** eBird speciesCode -> record. Already collapsed to the parent species by the
   *  seam's `reportAs` resolution, which is precisely the join key FR-07 wants. */
  species: Record<string, SpeciesProvenanceRecord>
  /** Insertion order for `species`. Present for determinism and for the
   *  admission check; NEVER used to evict. */
  speciesOrder: string[]
  /** Published escapee-only names (see ProvenanceSnapshot.excludedNames). */
  excludedNames: string[]
}

const EMPTY_STORE = (): ProvenanceStore => ({
  version: 1, checklists: {}, order: [], species: {}, speciesOrder: [], excludedNames: [],
})

// ── Load-path shape validation (schema.md §5, NFR-08) ──────────────────────────
// The persisted document is on-device data and can arrive corrupt (partial
// write, hand-edited file, a future shape drift). A malformed entry is silently
// DROPPED, never thrown on: a corrupt document degrades to "not cached", which
// degrades to today's numbers (FR-26), never to a render-time crash (FR-22).

// Measured against the bundled v2027 snapshot: 17,891 codes, length 2 to 8,
// charset [a-z0-9-]. Exactly one real code carries a hyphen ('bird-o1'), so the
// hyphen is REQUIRED in the class; omitting it silently drops that species.
// Upper bound 16 gives headroom for a future eBird code while keeping the key
// structurally bounded.
const SPECIES_CODE_KEY_RE = /^[a-z0-9-]{2,16}$/

// Deliberately STRICTER than the app-wide display guard SUBMISSION_ID_RE
// (/^S\d+$/, components/speciesDetail/ui.tsx), which is unbounded in length. A
// persisted KEY must be structurally bounded; a display guard need not be. Do
// not loosen, replace, or re-point the app-wide constant, and do not introduce a
// third copy of it.
const SUBMISSION_KEY_RE = /^S[0-9]{1,15}$/

// "<category>|<doNotCount>", both raw, both bounded ASCII uppercase.
const SEEN_TOKEN_RE = /^[A-Z]{0,4}\|[A-Z]{0,8}$/

function isFinite_(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v)
}

function isValidRecord(e: unknown): e is SpeciesProvenanceRecord {
  if (typeof e !== 'object' || e === null) return false
  const c = e as { seen?: unknown; n?: unknown; at?: unknown }
  if (!isFinite_(c.n) || !isFinite_(c.at)) return false
  if (!Array.isArray(c.seen) || c.seen.length > MAX_SEEN_PER_SPECIES) return false
  for (const t of c.seen) {
    if (typeof t !== 'string' || !SEEN_TOKEN_RE.test(t)) return false
  }
  return true
}

/**
 * Normalize a loaded document to a well-formed store. A bad document, or any
 * `version` other than 1, yields the empty store (schema.md §3.3 — no
 * migrations; a shape change bumps the key suffix so an old document is orphaned
 * rather than half-read).
 *
 * Every record is read with `Object.hasOwn`, never a bare index. A bare index on
 * an object literal returns a TRUTHY INHERITED MEMBER for at least twelve
 * strings ('constructor', '__proto__', 'toString', 'valueOf', and the rest), so
 * a `raw[key] ? … : …` guard silently takes the wrong branch for every one of
 * them (the v0.5.81 finding). The malformed-input tests include those names, and
 * the pollution probe is built with `JSON.parse` rather than an object literal,
 * because `{ __proto__: … }` in source sets the prototype and creates NO own
 * property, i.e. tests a shape that cannot arrive from storage.
 */
export function sanitizeStore(loaded: unknown): ProvenanceStore {
  if (typeof loaded !== 'object' || loaded === null) return EMPTY_STORE()
  const doc = loaded as {
    version?: unknown; checklists?: unknown; order?: unknown
    species?: unknown; speciesOrder?: unknown; excludedNames?: unknown
  }
  if (doc.version !== 1) return EMPTY_STORE()
  if (typeof doc.checklists !== 'object' || doc.checklists === null || !Array.isArray(doc.order)) return EMPTY_STORE()
  if (typeof doc.species !== 'object' || doc.species === null || !Array.isArray(doc.speciesOrder)) return EMPTY_STORE()

  const rawChecklists = doc.checklists as Record<string, unknown>
  const rawSpecies = doc.species as Record<string, unknown>
  const store = EMPTY_STORE()

  for (const key of doc.order) {
    if (typeof key !== 'string' || !SUBMISSION_KEY_RE.test(key)) continue
    if (Object.hasOwn(store.checklists, key)) continue              // duplicate order key
    if (!Object.hasOwn(rawChecklists, key)) continue
    const at = rawChecklists[key]
    if (!isFinite_(at)) continue
    store.checklists[key] = at
    store.order.push(key)
  }

  for (const key of doc.speciesOrder) {
    if (typeof key !== 'string' || !SPECIES_CODE_KEY_RE.test(key)) continue
    if (Object.hasOwn(store.species, key)) continue
    if (!Object.hasOwn(rawSpecies, key)) continue
    const rec = rawSpecies[key]
    if (!isValidRecord(rec)) continue
    store.species[key] = { seen: [...rec.seen], n: rec.n, at: rec.at }
    store.speciesOrder.push(key)
  }

  if (Array.isArray(doc.excludedNames)) {
    for (const n of doc.excludedNames) {
      if (store.excludedNames.length >= MAX_PUBLISHED_NAMES) break
      if (typeof n !== 'string' || n.length === 0 || n.length > MAX_PUBLISHED_NAME_LENGTH) continue
      store.excludedNames.push(n)
    }
  }

  return store
}

// ── Coalesced in-memory mirror (one disk read per session) ─────────────────────

let _store: ProvenanceStore | null = null
let _loading: Promise<ProvenanceStore> | null = null

// Snapshot memo: rebuilt only when the mirror actually changes, so a render pass
// that reads it repeatedly never re-materializes the Set and Map.
let _snapshot: ProvenanceSnapshot = EMPTY_SNAPSHOT
let _revision = 0
const _listeners = new Set<() => void>()

// Deterministic work accounting for the capacity+1 guard. Disabled in the app.
export interface ProvenanceCacheWorkStats {
  loaderCalls: number
  merges: number
  admissions: number
  admissionsRefused: number
  orderSearches: number
  orderSearchSlots: number
  orderMoves: number
  evictions: number
  shiftedSlots: number
  writeSchedules: number
  writeFlushes: number
  lastSnapshotChecklists: number
  lastSnapshotSpecies: number
}

const EMPTY_WORK_STATS = (): ProvenanceCacheWorkStats => ({
  loaderCalls: 0, merges: 0, admissions: 0, admissionsRefused: 0,
  orderSearches: 0, orderSearchSlots: 0, orderMoves: 0,
  evictions: 0, shiftedSlots: 0, writeSchedules: 0, writeFlushes: 0,
  lastSnapshotChecklists: 0, lastSnapshotSpecies: 0,
})

let _workStats: ProvenanceCacheWorkStats | null = null

function rebuildSnapshot(store: ProvenanceStore): void {
  const checklists = new Set<string>(store.order)
  const species = new Map<string, SpeciesProvenanceRecord>()
  for (const code of store.speciesOrder) {
    if (Object.hasOwn(store.species, code)) species.set(code, store.species[code])
  }
  _snapshot = { checklists, species, excludedNames: [...store.excludedNames] }
  _revision += 1
  for (const l of _listeners) l()
}

async function ensureLoaded(): Promise<ProvenanceStore> {
  if (_store) return _store
  if (_loading) return _loading
  _loading = (async () => {
    const loaded = await storage.getSetting<ProvenanceStore>(PROVENANCE_STORE_KEY).catch(() => null)
    _store = sanitizeStore(loaded)
    rebuildSnapshot(_store)
    return _store
  })()
  try {
    return await _loading
  } finally {
    _loading = null
  }
}

/** Load the persisted document once and return the read-only snapshot. Serves
 *  STALE entries too: a total that blanked itself because a timer expired would
 *  be a worse answer than a slightly old one (schema.md §9). */
export async function loadSnapshot(): Promise<ProvenanceSnapshot> {
  await ensureLoaded()
  return _snapshot
}

/** Render-safe synchronous read of the current mirror. Empty until the first
 *  `loadSnapshot()` resolves; never triggers I/O and never reads the clock. */
export function getSnapshot(): ProvenanceSnapshot {
  return _snapshot
}

/** `useSyncExternalStore` plumbing: a monotone revision that advances whenever
 *  the mirror changes, so every passive reader re-derives after a merge. */
export function getRevision(): number { return _revision }

export function subscribe(listener: () => void): () => void {
  _listeners.add(listener)
  return () => { _listeners.delete(listener) }
}

// ── Merge (schema.md §8.4) ─────────────────────────────────────────────────────

export interface ProvenanceObservation {
  /** Parent species code, already collapsed by the seam's reportAs resolution. */
  speciesCode: string
  /** Raw eBird value: 'X' | 'N' | 'P', or '' when absent. Never a closed union. */
  exoticCategory: string
  /** Raw companion flag ('DNC' in sampled data), or '' when absent. */
  userDoNotCount: string
}

/**
 * Merge one checklist response into the store and write the ledger entry.
 *
 * `admissible` is the current cover index's code set: provenance is recorded
 * only for species the loaded export actually contains, so the index cannot grow
 * on species the user has never seen.
 *
 * Two things that must NOT be optimized away:
 *  - Observations are NOT de-duplicated by species code before merging. Two
 *    forms on one checklist ("Mallard" and "Mallard (Domestic type)") collapse
 *    to one parent code, both tokens land in `seen`, and the monotone OR settles
 *    it. That is the case which makes the `category === 'domestic'` shortcut
 *    wrong, and it is what QA-03 and QA-04 check.
 *  - Admission gates NEW KEYS ONLY, on the container's own size. Merging fresh
 *    tokens into an existing record is not admission and is never blocked, so a
 *    full index still stays current. (The v0.5.85 finding was a bound enforced
 *    by a separate counter that silently inflated until admission closed
 *    permanently, invisible in both the entries and the answers.)
 */
export async function mergeChecklist(
  submissionId: string,
  observations: readonly ProvenanceObservation[],
  admissible: ReadonlySet<string>,
  nowMs: number,
): Promise<void> {
  const store = await ensureLoaded()
  if (_workStats) _workStats.merges += 1

  for (const o of observations) {
    const code = o.speciesCode
    if (!code || !admissible.has(code)) continue
    const token = seenToken(o.exoticCategory, o.userDoNotCount)
    if (Object.hasOwn(store.species, code)) {
      const rec = store.species[code]
      if (!rec.seen.includes(token) && rec.seen.length < MAX_SEEN_PER_SPECIES) rec.seen.push(token)
      rec.n += 1
      rec.at = nowMs
      continue
    }
    // Admission control: fill to the limit, then stop admitting. Gated on the
    // container's own size, never a separate counter.
    if (store.speciesOrder.length >= PROVENANCE_MAX_SPECIES) {
      if (_workStats) _workStats.admissionsRefused += 1
      continue
    }
    if (_workStats) _workStats.admissions += 1
    store.species[code] = { seen: [token], n: 1, at: nowMs }
    store.speciesOrder.push(code)
  }

  // Ledger: FIFO, oldest-fetched first.
  if (_workStats) {
    _workStats.orderSearches += 1
    _workStats.orderSearchSlots += store.order.length
  }
  if (Object.hasOwn(store.checklists, submissionId)) {
    const at = store.order.indexOf(submissionId)
    if (at !== -1) { store.order.splice(at, 1); if (_workStats) _workStats.orderMoves += 1 }
  }
  store.checklists[submissionId] = nowMs
  store.order.push(submissionId)

  while (store.order.length > 1 && store.order.length > PROVENANCE_MAX_CHECKLISTS) {
    // Array.shift moves every surviving slot left by one. Count those moves,
    // rather than timing them, so the cap+1 assertion is deterministic.
    if (_workStats) {
      _workStats.evictions += 1
      _workStats.shiftedSlots += store.order.length - 1
    }
    const oldest = store.order.shift()!
    delete store.checklists[oldest]
  }

  rebuildSnapshot(store)
  scheduleWrite(store)
}

/**
 * Publish the escapee-only classification for passive readers (see
 * `ProvenanceSnapshot.excludedNames`). Called ONLY by the Statistics pass, which
 * is the only place that holds the name-to-code join (FR-17).
 *
 * No-ops when the list is unchanged, so a re-render never schedules a write.
 */
export async function publishExcludedNames(names: readonly string[]): Promise<void> {
  const store = await ensureLoaded()
  const next = [...names].slice(0, MAX_PUBLISHED_NAMES).sort()
  if (next.length === store.excludedNames.length && next.every((n, i) => n === store.excludedNames[i])) return
  store.excludedNames = next
  rebuildSnapshot(store)
  scheduleWrite(store)
}

/** True when every checklist in `submissionIds` has been consulted within the
 *  TTL, i.e. the cache already holds a fresh result for them. The clock is the
 *  CALLER'S: every time read lives in an effect or a handler, never in a render
 *  body or a memo (NFR-03, react-hooks/purity is build-blocking). */
export function isFreshFor(submissionIds: Iterable<string>, nowMs: number): boolean {
  const store = _store
  if (!store) return false
  for (const id of submissionIds) {
    if (!Object.hasOwn(store.checklists, id)) return false
    if (nowMs - store.checklists[id] >= PROVENANCE_TTL_MS) return false
  }
  return true
}

/** Submission ids whose ledger entry is missing or past the TTL, and which are
 *  therefore eligible for the cover again (schema.md §9). */
export function staleOrUnconsulted(submissionIds: Iterable<string>, nowMs: number): Set<string> {
  const out = new Set<string>()
  const store = _store
  for (const id of submissionIds) {
    if (!store || !Object.hasOwn(store.checklists, id) || nowMs - store.checklists[id] >= PROVENANCE_TTL_MS) {
      out.add(id)
    }
  }
  return out
}

/** ms epoch of the most recent ledger entry, or null when nothing is consulted.
 *  Reads a PERSISTED number; it never calls the clock, so it is render-safe and
 *  is what the offline state's "Showing the check from {date}" is anchored to. */
export function lastConsultedAt(): number | null {
  const store = _store
  if (!store || store.order.length === 0) return null
  const newest = store.order[store.order.length - 1]
  return Object.hasOwn(store.checklists, newest) ? store.checklists[newest] : null
}

/** The consulted-and-fresh set the cover treats as already answered (FR-24). */
export function consultedSet(nowMs: number): ReadonlySet<string> {
  const store = _store
  if (!store) return new Set<string>()
  const out = new Set<string>()
  for (const id of store.order) {
    // Safe by invariant (`order` only ever holds keys `sanitizeStore` and
    // `mergeChecklist` also wrote to `checklists`), and guarded anyway: this was
    // the ONE bare index left in a module where every other read goes through
    // `Object.hasOwn`, and an inconsistency like that teaches the next reader
    // that a bare index is fine here. It is not, in general: on an object
    // literal a bare index returns a truthy INHERITED member for at least
    // twelve strings, and the invariant protecting this line is not local to it.
    if (!Object.hasOwn(store.checklists, id)) continue
    if (nowMs - store.checklists[id] < PROVENANCE_TTL_MS) out.add(id)
  }
  return out
}

// ── In-flight dedupe (schema.md §8.5) ──────────────────────────────────────────
// Keyed by submission id and cleared in a `finally`. It lives in the STORE, not
// the controller, so it holds across controller remounts: two effects racing at
// tab mount, or a retry overlapping a running pass, share one eBird call.

const _inflight = new Map<string, Promise<readonly ProvenanceObservation[]>>()

/**
 * The one fetch chokepoint. A checklist already consulted within the TTL
 * short-circuits with NO NETWORK. A miss runs `loader` (deduped per submission
 * id) and merges the result.
 *
 * A loader failure while OFFLINE with a prior ledger entry resolves as a
 * no-op success (the answer is already merged and stale reads are served,
 * NFR-05). Any other failure rethrows and caches NOTHING, so a retry issues a
 * fresh request (FR-20, QA-26).
 */
export function dedupedFetchChecklist(
  submissionId: string,
  admissible: ReadonlySet<string>,
  loader: () => Promise<readonly ProvenanceObservation[]>,
): Promise<{ fromNetwork: boolean }> {
  return (async () => {
    const store = await ensureLoaded()
    if (Object.hasOwn(store.checklists, submissionId)
      && Date.now() - store.checklists[submissionId] < PROVENANCE_TTL_MS) {
      return { fromNetwork: false }
    }
    const pending = _inflight.get(submissionId)
    if (pending) { await pending; return { fromNetwork: false } }
    const p = (async () => {
      if (_workStats) _workStats.loaderCalls += 1
      try {
        return await loader()
      } finally {
        _inflight.delete(submissionId)
      }
    })()
    _inflight.set(submissionId, p)
    try {
      const obs = await p
      await mergeChecklist(submissionId, obs, admissible, Date.now())
      return { fromNetwork: true }
    } catch (err) {
      // NEVER cache a failure. Offline with a prior entry: the merged answer
      // stands and the pass carries on.
      if (isOfflineError(err) && Object.hasOwn(store.checklists, submissionId)) {
        return { fromNetwork: false }
      }
      throw err
    }
  })()
}

// ── Debounced whole-document write (best-effort, off the blocking path) ────────

let _writeTimer: ReturnType<typeof setTimeout> | null = null
const WRITE_DEBOUNCE_MS = 250

function scheduleWrite(store: ProvenanceStore): void {
  if (_workStats) _workStats.writeSchedules += 1
  if (_writeTimer) clearTimeout(_writeTimer)
  _writeTimer = setTimeout(() => {
    _writeTimer = null
    const snapshot: ProvenanceStore = {
      version: store.version,
      checklists: { ...store.checklists },
      order: [...store.order],
      species: { ...store.species },
      speciesOrder: [...store.speciesOrder],
      excludedNames: [...store.excludedNames],
    }
    if (_workStats) {
      _workStats.writeFlushes += 1
      _workStats.lastSnapshotChecklists = snapshot.order.length
      _workStats.lastSnapshotSpecies = snapshot.speciesOrder.length
    }
    void storage.setSetting<ProvenanceStore>(PROVENANCE_STORE_KEY, snapshot)
      .catch(() => { /* best-effort — the mirror stays the live source */ })
  }, WRITE_DEBOUNCE_MS)
}

/** Test seam: deterministic work performed since the last reset. */
export function _getProvenanceCacheWorkStatsForTests(): Readonly<ProvenanceCacheWorkStats> {
  if (!_workStats) _workStats = EMPTY_WORK_STATS()
  return { ..._workStats }
}

/** Test seam: reset the module mirror so each test starts from disk-empty. */
export function _resetProvenanceCacheForTests(): void {
  if (_writeTimer) { clearTimeout(_writeTimer); _writeTimer = null }
  _store = null
  _loading = null
  _snapshot = EMPTY_SNAPSHOT
  _revision = 0
  _workStats = EMPTY_WORK_STATS()
  _inflight.clear()
  PROVENANCE_MAX_SPECIES = 16_384
  PROVENANCE_MAX_CHECKLISTS = 32_768
}
