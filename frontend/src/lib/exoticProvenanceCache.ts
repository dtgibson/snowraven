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
// Since exotic-provenance-reuse it also holds a third, smaller map with the
// ledger's policy:
//
//   unmatched   FIFO.       Species code -> the time a successful answer, for a
//                           checklist the export says carries that code, came
//                           back with no row for it. It only stops the
//                           recordless-species heal from re-asking within the
//                           TTL, so an evicted stamp costs one bounded re-ask
//                           of that species and LOSES NO ANSWER. Never read by
//                           classification: a stamped species is `unknown`
//                           and COUNTS, exactly as it was before the stamp.
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
import { SUBMISSION_KEY_RE } from './checklistId'
import { isWithinTtl } from './ttlWindow'

/** OQ-04: 30 days, matching COMPLETENESS_TTL_MS. Governs RE-CONSULTATION, not
 *  display: a stale record still counts and still excludes (schema.md §9).
 *
 *  Every TTL read of this document (the ledger and the stamps, at the five
 *  readers below) goes through `isWithinTtl` (`lib/ttlWindow.ts`), so a time
 *  more than 24 hours ahead of the reader's clock reads as absent and is asked
 *  for once more (ebird-request-economy D-03). Classification is NOT windowed:
 *  `rebuildSnapshot` counts every ledger entry's answer however it is dated,
 *  and `lastConsultedAt` reports the stored time as stored. */
export const PROVENANCE_TTL_MS = 30 * 24 * 60 * 60 * 1000

/** Storage-seam document key. Bump the suffix AND `version` together on any
 *  shape change that would make an old document MISREAD; a mismatch yields an
 *  empty store, never a migration. An added OPTIONAL field whose absence is a
 *  defined state is not such a change (life-lists-tab's `exoticNames`, absent
 *  meaning "not yet published"), so it rode the same key and version. */
export const PROVENANCE_STORE_KEY = 'exotic-provenance-v1'

// Caps. Both are stated STRUCTURALLY (entry count, key length, member count),
// never as a byte product: three measurements of one design in v0.5.85 gave 172,
// 208 and 173 B/entry, so a byte figure encodes one engine's heap accounting and
// can go false without ever failing.
//
// PROVENANCE_MAX_SPECIES: the bundled taxonomy snapshot ("2028", eBird's 2026
// taxonomy) carries 11,201 species names in `byCom` (18,631 codes including
// forms). Provenance is
// admitted only for codes in the current cover index, so the index is bounded by
// the birder's life list, which is bounded by the world species list. This cap
// sits above the entire world taxonomy and cannot bind on real data.
//
// It STAYS at 16,384 through big-old-life-lists, which raised caps a 1M-row
// export reaches: this one cannot bind however large the export, because the
// world list is the bound.
//
// PROVENANCE_MAX_CHECKLISTS: a pass is bounded at MAX_REQUESTS_PER_PASS (500),
// so reaching the cap takes many full-budget passes, and the ledger is bounded
// by the export's checklists. The reference export has 3,252, so its ledger
// cannot exceed 3,252 however many run. It was 32,768 until big-old-life-lists,
// which raised it for large exports, and is now 131,072 (2^17): the largest
// power of two whose WORST-CASE document fits under the web/Pi settings route,
// which saves this whole document through `/settings/{key}` and refuses a body
// over `_MAX_BYTES` in `backend/routers/settingskv.py` (16 MiB) with 413, a
// refusal the best-effort write below swallows. The 262,144 the raise first
// chose does not fit (security review L1). At the validator's bounds a ledger
// entry costs 64 bytes, and the species index (16,384 records) and the two
// published name lists (2,048 of 128 characters EACH since life-lists-tab, so
// the two together cost what the one list of 4,096 did) about 7.1 MB together,
// so the worst case at this cap is 15.4 MB against the route's 16.8 MB (the
// second list adds 16 bytes, its field name and brackets), and 16.5 MB with
// the unmatched stamps below at their cap (16,494,726 bytes, measured
// 2026-11-07); `settingsRouteBudget.test.ts` builds it through `sanitizeStore`
// and compares it with the Python constant.
// FIFO, unchanged: an eviction here costs one redundant request and loses no
// answer. The ledger lives in the shared settings document and grows only as
// passes consult checklists: at this cap with real ids it is about 5.5 M
// characters.
//
// PROVENANCE_MAX_UNMATCHED (exotic-provenance-reuse): a stamp is keyed by a
// species code in the current cover, so like the species index it is bounded
// by the world list and this cap, equal to the species cap, cannot bind on real
// data. It is also the largest power of two that still fits: at the
// validator's bounds a stamp costs 64 bytes, the same as a ledger entry, so
// 16,384 of them add 1 MiB to the worst case above, and 32,768 would not fit.
// FIFO by FIRST stamp: a refreshed stamp keeps its place, so a merge never
// searches the order array (decisions.md D-07), and an eviction costs one
// bounded re-ask of the evicted species. The load path clamps to the newest
// stamps, so a hostile document cannot hand the merge an eviction backlog.
export const PROVENANCE_MAX_SPECIES_DEFAULT = 16_384
export const PROVENANCE_MAX_CHECKLISTS_DEFAULT = 131_072
export const PROVENANCE_MAX_UNMATCHED_DEFAULT = 16_384
export let PROVENANCE_MAX_SPECIES = PROVENANCE_MAX_SPECIES_DEFAULT
export let PROVENANCE_MAX_CHECKLISTS = PROVENANCE_MAX_CHECKLISTS_DEFAULT
export let PROVENANCE_MAX_UNMATCHED = PROVENANCE_MAX_UNMATCHED_DEFAULT

/** Test seam: override the species admission limit. */
export function setProvenanceMaxSpecies(n: number): void { PROVENANCE_MAX_SPECIES = n }
/** Test seam: override the checklist ledger entry cap. */
export function setProvenanceMaxChecklists(n: number): void { PROVENANCE_MAX_CHECKLISTS = n }
/** Test seam: override the unmatched-stamp cap. */
export function setProvenanceMaxUnmatched(n: number): void { PROVENANCE_MAX_UNMATCHED = n }

/** At most this many distinct raw token pairs per species. Five shapes exist in
 *  the sampled data; 8 leaves room for a future eBird category without letting
 *  a hostile document grow an entry without bound. */
export const MAX_SEEN_PER_SPECIES = 8

/** Structural bound on EACH published name list, escapee and exotic
 *  (schema.md §3 note). 2,048 since life-lists-tab: two lists at 4,096 put the
 *  worst-case document 1.5 MB over the web/Pi route, two at 2,048 cost exactly
 *  what one at 4,096 did, and no real list approaches it (the escapee list on
 *  the reference export is single digits; the exotic list for a world lister is
 *  at most a few hundred). A longer list from an earlier build is truncated on
 *  load, the safe direction: a dropped name is unconfirmed and counts. */
const MAX_PUBLISHED_NAMES = 2048
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
  /** Published exotic-only names (life-lists-tab). `null` = never published on
   *  this document, which every document written before 1.0.62 is. Absence is
   *  UNRESOLVED, never "no exotics". */
  exoticNames: string[] | null
  /** exotic-provenance-reuse (decisions.md D-03). Species code -> ms-epoch
   *  fetch time of the latest successful answer, for a checklist the export
   *  says carries that code, that had NO row for it (a post-split name eBird
   *  answers under another code, or an answer that lacks the species). Only
   *  for a code with no record: once a row is admitted the stamp is dropped. An
   *  absent field, which every document written before this build has, means
   *  no stamps, so it rode the same key and version (the `exoticNames`
   *  precedent above). */
  unmatched: Record<string, number>
  /** Insertion order for `unmatched`, first-stamped first. FIFO eviction. */
  unmatchedOrder: string[]
}

const EMPTY_STORE = (): ProvenanceStore => ({
  version: 1, checklists: {}, order: [], species: {}, speciesOrder: [], excludedNames: [], exoticNames: null,
  unmatched: {}, unmatchedOrder: [],
})

// ── Load-path shape validation (schema.md §5, NFR-08) ──────────────────────────
// The persisted document is on-device data and can arrive corrupt (partial
// write, hand-edited file, a future shape drift). A malformed entry is silently
// DROPPED, never thrown on: a corrupt document degrades to "not cached", which
// degrades to today's numbers (FR-26), never to a render-time crash (FR-22).

// Measured against the bundled "2028" snapshot (eBird's 2026 taxonomy): 18,631
// codes, length 2 to 8, charset [a-z0-9-]. Exactly one real code carries a hyphen ('bird-o1'), so the
// hyphen is REQUIRED in the class; omitting it silently drops that species.
// Upper bound 16 gives headroom for a future eBird code while keeping the key
// structurally bounded.
const SPECIES_CODE_KEY_RE = /^[a-z0-9-]{2,16}$/

// This was the FIRST checklist-id guard to carry a length ceiling; the
// app-wide guards (SUBMISSION_ID_RE in components/speciesDetail/ui.tsx,
// isValidChecklistId, their copies, and the backend's CHECKLIST_ID_RE) were
// unbounded until length-bound-checklist-id aligned them all to this
// constant's `{1,15}` — closing the window where an id passed every guard yet
// failed here, silently discarding the record (the v0.5.87 shape). A persisted
// KEY must be structurally bounded either way, so this stays the reference:
// do not loosen it.
//
// HOISTED (county-shading-and-project-stats): the literal now lives in
// `lib/checklistId.ts`, which has no imports of its own, so the projects store
// shares it rather than becoming the third copy this comment forbade. The
// re-export keeps this module's own reads reading the same name.

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

/** One stamp's shape, the SAME test on load and at the write chokepoint, so a
 *  stamp the load path would drop is never held or written (the v1.0.63 rule:
 *  a publisher builds what it writes through the validator's own admission).
 *  The key class is the species index's, which also keeps `__proto__` out. */
function isValidStamp(code: string, at: unknown): boolean {
  return SPECIES_CODE_KEY_RE.test(code) && isFinite_(at)
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
    exoticNames?: unknown; unmatched?: unknown; unmatchedOrder?: unknown
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

  if (Array.isArray(doc.excludedNames)) admitNames(doc.excludedNames, store.excludedNames)
  // Anything but an array (absent, null, a hostile non-array) is UNRESOLVED,
  // the safe direction: every species is listed (life-lists-tab FR-19).
  if (Array.isArray(doc.exoticNames)) {
    const exoticNames: string[] = []
    admitNames(doc.exoticNames, exoticNames)
    store.exoticNames = exoticNames
  }
  // After the species loop, because a record wins over a stamp.
  admitUnmatched(doc.unmatched, doc.unmatchedOrder, store)

  return store
}

/**
 * The stamps' load path. Anything but the pair of shapes (absent on every
 * document before this build, or hostile) is NO STAMPS, which is exactly the
 * heal's previous behaviour, the safe direction: it may re-ask, it never
 * stops asking where it should not.
 *
 * One walk over the order array. The dedupe set records a key when it is
 * first SEEN, before its validation (the v1.0.40 rule), so an order array
 * repeating one key, valid or not, costs one validation however long it is;
 * `stampValidations` counts them. Own-key reads only. Clamped to the newest
 * PROVENANCE_MAX_UNMATCHED, the end of the array, since the order is oldest
 * first.
 */
function admitUnmatched(rawMap: unknown, rawOrder: unknown, store: ProvenanceStore): void {
  if (typeof rawMap !== 'object' || rawMap === null || !Array.isArray(rawOrder)) return
  const raw = rawMap as Record<string, unknown>
  const seen = new Set<string>()
  const kept: string[] = []
  for (const key of rawOrder) {
    if (typeof key !== 'string' || seen.has(key)) continue
    seen.add(key)
    if (_workStats) _workStats.stampValidations += 1
    if (!Object.hasOwn(raw, key) || !isValidStamp(key, raw[key])) continue
    if (Object.hasOwn(store.species, key)) continue
    kept.push(key)
  }
  const from = Math.max(0, kept.length - PROVENANCE_MAX_UNMATCHED)
  for (let i = from; i < kept.length; i += 1) {
    store.unmatched[kept[i]] = raw[kept[i]] as number
    store.unmatchedOrder.push(kept[i])
  }
}

/** The two published lists share one admission rule: the same count cap and
 *  the same per-name length bound, malformed entries dropped. */
function admitNames(raw: readonly unknown[], into: string[]): void {
  for (const n of raw) {
    if (into.length >= MAX_PUBLISHED_NAMES) break
    if (typeof n !== 'string' || n.length === 0 || n.length > MAX_PUBLISHED_NAME_LENGTH) continue
    into.push(n)
  }
}

// ── Coalesced in-memory mirror (one disk read per session) ─────────────────────

let _store: ProvenanceStore | null = null
let _loading: Promise<ProvenanceStore> | null = null

// Monotone purge counter (clear-means-clear). The identity check `store !==
// _store` that the other durable stores use is not sufficient HERE, because
// `mergeChecklist` is a public entry point that calls `ensureLoaded()` for
// itself: after a purge it would load the fresh EMPTY mirror, find its own
// store identical to it, and merge in observations from the very export the
// user just cleared. A generation captured before the first await answers the
// real question — "did a Clear happen since this work began?" — which identity
// alone cannot.
// SINGLE-WEBVIEW INVARIANT: this counter is module-scoped JS state, so it holds
// within one JS context only -- see the note at `replayStore.ts`'s own purge
// generation, and CLAUDE.md, Desktop storage (Tauri), the v1.0.9 entry.
let _purgeGeneration = 0

/** The purge counter, read-only: the Statistics pass captures it when it
 *  starts and stops itself the moment a Clear moves it, so a checklist id the
 *  user has just cleared is never sent from a call still waiting at the eBird
 *  gate (ebird-request-economy D-01). Nothing else reads it. */
export function provenancePurgeGeneration(): number { return _purgeGeneration }

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
  /** Stamps written or refreshed at the merge. */
  stamps: number
  stampEvictions: number
  /** Stamps dropped because a record for the code was admitted. */
  stampDrops: number
  /** Entries of a loaded `unmatchedOrder` that reached validation. */
  stampValidations: number
}

const EMPTY_WORK_STATS = (): ProvenanceCacheWorkStats => ({
  loaderCalls: 0, merges: 0, admissions: 0, admissionsRefused: 0,
  orderSearches: 0, orderSearchSlots: 0, orderMoves: 0,
  evictions: 0, shiftedSlots: 0, writeSchedules: 0, writeFlushes: 0,
  lastSnapshotChecklists: 0, lastSnapshotSpecies: 0,
  stamps: 0, stampEvictions: 0, stampDrops: 0, stampValidations: 0,
})

let _workStats: ProvenanceCacheWorkStats | null = null

function rebuildSnapshot(store: ProvenanceStore): void {
  const checklists = new Set<string>(store.order)
  const species = new Map<string, SpeciesProvenanceRecord>()
  for (const code of store.speciesOrder) {
    if (Object.hasOwn(store.species, code)) species.set(code, store.species[code])
  }
  _snapshot = {
    checklists, species,
    excludedNames: [...store.excludedNames],
    exoticNames: store.exoticNames ? [...store.exoticNames] : null,
  }
  _revision += 1
  for (const l of _listeners) l()
}

async function ensureLoaded(): Promise<ProvenanceStore> {
  if (_store) return _store
  if (_loading) return _loading
  _loading = (async () => {
    const loaded = await storage.getSetting<ProvenanceStore>(PROVENANCE_STORE_KEY).catch(() => null)
    // A purge landed while this read was in flight (clear-means-clear): it has
    // already installed the authoritative empty mirror, and `loaded` is the
    // PRE-purge document. Adopting it would resurrect every checklist id and
    // species name the user just cleared.
    if (_store) return _store
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
 *
 * `carried` (exotic-provenance-reuse D-03) is the cover codes the CONTROLLER
 * says the export puts on this checklist (`index.byChecklist`); the store does
 * not re-derive them. Each one this answer has no row for, and that has no
 * record, is stamped `unmatched` at `nowMs`. That happens here and only here,
 * below the purge-generation guard, so a stamp only ever comes from a
 * successful answer and a Clear supersedes it like everything else this merge
 * writes. A code outside the cover the checklist was asked under is never
 * stamped, which is what keeps the v1.0.1 domestic-form heal intact: a
 * checklist consulted under a cover that could not admit a species says
 * nothing about it.
 */
export async function mergeChecklist(
  submissionId: string,
  observations: readonly ProvenanceObservation[],
  admissible: ReadonlySet<string>,
  nowMs: number,
  carried: readonly string[] = [],
): Promise<void> {
  const gen = _purgeGeneration
  const store = await ensureLoaded()
  // A Clear landed while this merge was getting under way. The observations in
  // hand were fetched for a checklist id that came out of the export the user
  // just deleted, so they are not written to either the mirror or the disk.
  if (gen !== _purgeGeneration || store !== _store) return
  if (_workStats) _workStats.merges += 1

  // Every code this answer has a row for, admissible or not and admitted or
  // not: a stamp says the answer had NO row, which a refused admission is not.
  const answered = new Set<string>()
  for (const o of observations) {
    const code = o.speciesCode
    if (code) answered.add(code)
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
    // A record wins. Once per species at most, so the order search is paid on
    // an event that happens once, never per merge.
    if (Object.hasOwn(store.unmatched, code)) dropStamp(store, code)
  }

  for (const code of carried) {
    if (answered.has(code) || !admissible.has(code)) continue
    if (Object.hasOwn(store.species, code)) continue
    if (!isValidStamp(code, nowMs)) continue
    stamp(store, code, nowMs)
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
 * Publish the escapee-only and exotic-only classifications for passive readers
 * (see `ProvenanceSnapshot.excludedNames` / `.exoticNames`). Called ONLY by the
 * Statistics pass, which is the only place that holds the name-to-code join
 * (FR-17; life-lists-tab FR-17).
 *
 * No-ops when BOTH lists are unchanged, so a re-render never schedules a write.
 * An `exoticNames` compared against a `null` store value is always a change,
 * which is what first publishes `[]`.
 */
export async function publishClassifiedNames(
  lists: { excludedNames: readonly string[]; exoticNames: readonly string[] },
): Promise<void> {
  const gen = _purgeGeneration
  const store = await ensureLoaded()
  // Same guard as mergeChecklist, and it matters at least as much here: these
  // are COMMON NAMES carried verbatim from the user's export.
  if (gen !== _purgeGeneration || store !== _store) return
  // Through the load path's own admission (security L1): the same count cap
  // AND the same per-name length bound, so a name the reader would drop on
  // reload is never published in the first place. Sorted BEFORE admission, so
  // the kept set is deterministic whatever order the lookup produced.
  const nextExcluded: string[] = []
  admitNames([...lists.excludedNames].sort(), nextExcluded)
  const nextExotic: string[] = []
  admitNames([...lists.exoticNames].sort(), nextExotic)
  if (sameNames(nextExcluded, store.excludedNames) && store.exoticNames !== null && sameNames(nextExotic, store.exoticNames)) return
  store.excludedNames = nextExcluded
  store.exoticNames = nextExotic
  rebuildSnapshot(store)
  scheduleWrite(store)
}

/** Write or refresh one stamp. A refresh keeps the stamp's place, so this is
 *  O(1) with no order search; a new stamp past the cap evicts the first one
 *  stamped. */
function stamp(store: ProvenanceStore, code: string, nowMs: number): void {
  if (_workStats) _workStats.stamps += 1
  if (Object.hasOwn(store.unmatched, code)) { store.unmatched[code] = nowMs; return }
  store.unmatched[code] = nowMs
  store.unmatchedOrder.push(code)
  while (store.unmatchedOrder.length > PROVENANCE_MAX_UNMATCHED) {
    if (_workStats) _workStats.stampEvictions += 1
    const oldest = store.unmatchedOrder.shift()!
    delete store.unmatched[oldest]
  }
}

function dropStamp(store: ProvenanceStore, code: string): void {
  if (_workStats) _workStats.stampDrops += 1
  delete store.unmatched[code]
  const at = store.unmatchedOrder.indexOf(code)
  if (at !== -1) store.unmatchedOrder.splice(at, 1)
}

function sameNames(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((n, i) => n === b[i])
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
    if (!isWithinTtl(store.checklists[id], nowMs, PROVENANCE_TTL_MS)) return false
  }
  return true
}

/** Submission ids whose ledger entry is missing or past the TTL, and which are
 *  therefore eligible for the cover again (schema.md §9). */
export function staleOrUnconsulted(submissionIds: Iterable<string>, nowMs: number): Set<string> {
  const out = new Set<string>()
  const store = _store
  for (const id of submissionIds) {
    if (!store || !Object.hasOwn(store.checklists, id) || !isWithinTtl(store.checklists[id], nowMs, PROVENANCE_TTL_MS)) {
      out.add(id)
    }
  }
  return out
}

/** ms epoch of the most recent ledger entry, or null when nothing is consulted.
 *  Reads a PERSISTED number; it never calls the clock, so it is render-safe and
 *  is what the offline state's "Showing the check from {date}" is anchored to.
 *  Deliberately NOT clamped by the plausibility window (ebird-request-economy
 *  D-11): offline, no re-ask can correct the time, and the label states the
 *  date the stored check carries rather than inventing one. */
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
    if (isWithinTtl(store.checklists[id], nowMs, PROVENANCE_TTL_MS)) out.add(id)
  }
  return out
}

/** The species codes a successful answer was seen to lack within the TTL
 *  (exotic-provenance-reuse D-03): the set `carriersNeedingRefetch` skips, and
 *  nothing else reads. Empty before the first load, which is the heal's
 *  previous behaviour. The clock is the CALLER'S, as for `consultedSet`. */
export function unmatchedSet(nowMs: number): ReadonlySet<string> {
  const store = _store
  const out = new Set<string>()
  if (!store) return out
  for (const code of store.unmatchedOrder) {
    if (!Object.hasOwn(store.unmatched, code)) continue
    if (isWithinTtl(store.unmatched[code], nowMs, PROVENANCE_TTL_MS)) out.add(code)
  }
  return out
}

// ── In-flight dedupe (schema.md §8.5) ──────────────────────────────────────────
// Keyed by submission id and cleared in a `finally`. It lives in the STORE, not
// the controller, so it holds across controller remounts: two effects racing at
// tab mount, or a retry overlapping a running pass, share one eBird call.

const _inflight = new Map<string, Promise<readonly ProvenanceObservation[] | null>>()

/**
 * The one fetch chokepoint. A checklist already consulted within the TTL
 * short-circuits with NO NETWORK. A miss runs `loader` (deduped per submission
 * id) and merges the result.
 *
 * A loader failure while OFFLINE with a prior ledger entry resolves as a
 * no-op success (the answer is already merged and stale reads are served,
 * NFR-05). Any other failure rethrows and caches NOTHING, so a retry issues a
 * fresh request (FR-20, QA-26).
 *
 * A loader that resolves `null` chose NOT TO SEND (ebird-request-economy D-01:
 * the pass was stopped, or the store cleared, while the call waited at the
 * eBird gate). That is neither an answer nor a failure: nothing is merged, no
 * ledger entry or stamp is written, and the result says `notSent`, to a caller
 * that joined the in-flight call too.
 */
export function dedupedFetchChecklist(
  submissionId: string,
  admissible: ReadonlySet<string>,
  loader: () => Promise<readonly ProvenanceObservation[] | null>,
  opts?: {
    /** Skip the fresh-ledger short-circuit for THIS call: the controller has
     *  determined the entry is a false positive — consulted under a cover that
     *  could not admit a species it carries, so the ledger says "fetched"
     *  while the species index holds no answer (see carriersNeedingRefetch in
     *  exoticProvenance.ts). The in-flight dedupe and the merge are unchanged,
     *  so a forced refetch is still one bounded request with one write path. */
    refetch?: boolean
    /** The cover codes the export puts on this checklist, handed to the merge
     *  so a successful answer that lacks one stamps it (see mergeChecklist).
     *  A failed, refused or offline answer reaches no merge and stamps
     *  nothing. */
    carried?: readonly string[]
  },
): Promise<{ fromNetwork: boolean; notSent?: true }> {
  return (async () => {
    const gen = _purgeGeneration
    const store = await ensureLoaded()
    if (!opts?.refetch
      && Object.hasOwn(store.checklists, submissionId)
      && isWithinTtl(store.checklists[submissionId], Date.now(), PROVENANCE_TTL_MS)) {
      return { fromNetwork: false }
    }
    const pending = _inflight.get(submissionId)
    if (pending) {
      return (await pending) === null ? { fromNetwork: false, notSent: true } : { fromNetwork: false }
    }
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
      if (obs === null) return { fromNetwork: false, notSent: true }
      // A Clear landed while this request was in flight. `mergeChecklist` would
      // refuse it on its own generation guard; returning here as well keeps the
      // decision where a reader looks for it, and skips the pointless load.
      if (gen !== _purgeGeneration) return { fromNetwork: true }
      await mergeChecklist(submissionId, obs, admissible, Date.now(), opts?.carried)
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
    // Superseded by a purge: this closure holds the PRE-purge document.
    if (store !== _store) return
    const snapshot: ProvenanceStore = {
      version: store.version,
      checklists: { ...store.checklists },
      order: [...store.order],
      species: { ...store.species },
      speciesOrder: [...store.speciesOrder],
      excludedNames: [...store.excludedNames],
      exoticNames: store.exoticNames ? [...store.exoticNames] : null,
      unmatched: { ...store.unmatched },
      unmatchedOrder: [...store.unmatchedOrder],
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

// ── Clear-path teardown (clear-means-clear) ───────────────────────────────────

/**
 * Drop the whole document — the consulted-checklist ledger, the species index,
 * the published escapee names and the unmatched stamps — from the mirror AND
 * from disk.
 *
 * This is the PRODUCTION purge, distinct from `_resetProvenanceCacheForTests`
 * below: that one only detaches the mirror (a test's next load re-reads the
 * document), where this one removes the stored document itself. It is called
 * only from the shared clear-path teardown (`lib/clearDerived.ts`), never on a
 * replace: `PRIVACY_POLICY.md` publishes that loading a newer export re-asks
 * only unanswered checklists, and purging on upload would falsify it.
 *
 * `deleteSetting` is the seam's own read-modify-write on `settings.json`, so it
 * already runs as one link on that document's `docChains` promise chain — a
 * purge racing a debounced flush from another store cannot clobber it.
 */
export async function purgeProvenanceStore(): Promise<void> {
  // Supersede a pending flush first: it holds the pre-purge document.
  if (_writeTimer) { clearTimeout(_writeTimer); _writeTimer = null }
  _inflight.clear()
  _purgeGeneration += 1
  // A NEW object, which is what lets an in-flight merge notice it is holding a
  // detached document. `_loading` is deliberately left alone: its own guard
  // above sees the installed mirror and keeps it.
  _store = EMPTY_STORE()
  rebuildSnapshot(_store)
  await storage.deleteSetting(PROVENANCE_STORE_KEY)
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
  PROVENANCE_MAX_SPECIES = PROVENANCE_MAX_SPECIES_DEFAULT
  PROVENANCE_MAX_CHECKLISTS = PROVENANCE_MAX_CHECKLISTS_DEFAULT
  PROVENANCE_MAX_UNMATCHED = PROVENANCE_MAX_UNMATCHED_DEFAULT
}
