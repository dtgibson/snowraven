// The persistent per-checklist projects store
// (county-shading-and-project-stats, schema.md Part C, FR-33 through FR-38).
//
// Structure follows the shipped durable-cache shape: ONE storage-seam document,
// a one-disk-read-per-session in-memory mirror, per-entry shape validation on
// load with malformed entries DROPPED rather than thrown on, an in-flight
// dedupe Map cleared in a `finally`, a 250 ms debounced whole-document write,
// and errors NEVER cached.
//
// IMPORT DISCIPLINE. This module touches the storage seam only. The network
// fetcher is an INJECTED LOADER; it must never import `transport` or any
// `lib/tauri/*Service` (the exoticProvenanceCache rule, walked by a graph test).
//
// CAP POLICY: ADMISSION (fill-and-stop), never FIFO — the opposite of
// hotspotActivityCache and countyCompletenessCache, and the same choice the
// escapee SPECIES index made. It follows what an eviction COSTS. Evicting here
// destroys a paid-for network answer and, at capacity+1, would do so on EVERY
// pass forever, never converging. Where an eviction costs one redundant request
// and loses no answer, FIFO is right; here it is not. Capacity+1 is a
// MEASUREMENT rule, not a universal policy.
//
// WHAT IS STORED is exactly the two normalized fields plus a TTL anchor —
// nothing derived. No dates, no names, no counts, no labels. Every displayed
// figure is recomputed by joining these keys against the CURRENTLY LOADED
// backup (see lib/checklistProjects.ts), which is what makes a newer export
// correct dates automatically and drop checklists it no longer contains. A
// denormalized published copy would be the stale-cache trap the repo rule warns
// about, and its precondition — a passive reader that structurally cannot
// re-derive — is not met: the only reader owns both the store and the backup.
//
// NO PAYLOAD BYTE BUDGET, deliberately (FR-36). Every dimension is bounded: at
// most PROJECTS_MAX_CHECKLISTS entries, each a key of <= 16 chars, a `proj` of
// <= 32 chars, <= 8 integers of <= 9 digits, and one ms epoch. No unbounded
// string can exist in the document, which is the thing a byte budget exists to
// prevent — and a byte product would encode one engine's accounting and can go
// false silently.
//
// THAT BOUND IS THIS MODULE'S OWN PROPERTY, not a claim about whichever producer
// happens to be upstream. `isValidEntry` runs on BOTH sides of the document: on
// the load path (a document that may predate any code change) and on the write
// path, against the candidate, before the single write path sees it. The seam's
// normalization agrees with it and is pinned equal by a test, but the guarantee
// does not rest on the seam being reachable or unchanged — which is exactly the
// class of change the one-chokepoint rule exists to survive.

import { storage } from './storage'
import { SUBMISSION_KEY_RE } from './checklistId'

/**
 * OQ-01's default: 365 days. A submitted checklist's project assignment does not
 * change retroactively, so this is deliberately an order of magnitude beyond the
 * escapee store's 30 days — a 30-day TTL would force a full eight-minute
 * re-sweep every month and destroy the feature's premise.
 *
 * It governs RE-CONSULTATION ONLY, never display (FR-37): an expired entry still
 * counts as checked and still displays; the next sweep re-asks it.
 */
export const PROJECTS_TTL_MS = 365 * 24 * 60 * 60 * 1000

/** Storage-seam document key. Bump the suffix AND `version` together on any
 *  shape change: a mismatch yields an empty store, never a migration. */
export const PROJECTS_STORE_KEY = 'checklist-projects-v1'

/**
 * OQ-02's default: 65,536. Fill-and-stop never evicts, so hitting the cap is
 * PERMANENT for this document, which argues for a cap above any real birder
 * rather than the escapee ledger's 32,768 (that ledger is FIFO, so its cap is
 * cheap to hit). The reference account holds 3,252 checklists. The at-capacity
 * display state ships regardless of the number chosen.
 *
 * Mutable binding + test seam, mirroring PROVENANCE_MAX_CHECKLISTS.
 */
export let PROJECTS_MAX_CHECKLISTS = 65_536

/** Test seam: override the admission limit. */
export function setProjectsMaxChecklists(n: number): void { PROJECTS_MAX_CHECKLISTS = n }

// Bounds, duplicated from the seam's normalization ON PURPOSE: the load path
// must judge a document that may predate any code change, and the write path
// must judge an answer from a producer that may not be the shipped seam, so
// neither can depend on the seam being reachable or unchanged. The values are
// pinned equal to the seam's by a test.
const PROJ_ID_RE = /^[A-Z0-9_]{1,32}$/
const PROJECT_ID_MAX = 999_999_999
const MAX_PROJECT_IDS = 8

export interface ChecklistProjectsEntry {
  /** Normalized projId, '' when absent or rejected. Bounded ^[A-Z0-9_]{1,32}$. */
  proj: string
  /** Normalized projectIds. Each 0..PROJECT_ID_MAX, at most MAX_PROJECT_IDS. */
  ids: number[]
  /** ms epoch — the TTL anchor ONLY. NEVER displayed: every displayed date comes
   *  from the loaded backup (FR-34). */
  at: number
}

export interface ChecklistProjectsStore {
  version: 1
  /** submissionId -> entry. Every key satisfies SUBMISSION_KEY_RE (validated on
   *  load). Built with a NULL PROTOTYPE: the keys are external strings, and on a
   *  plain `{}` a key of '__proto__' hits the inherited setter instead of
   *  storing an own property. */
  entries: Record<string, ChecklistProjectsEntry>
  /** Admission order, insertion-ordered. It is the CONTAINER admission is gated
   *  on (FR-35) — never an eviction queue, and never a scalar counter. The
   *  v0.5.85 defect was a bound enforced by a separate counter that silently
   *  inflated until admission closed permanently, invisible in both the entries
   *  and the answers. */
  order: string[]
}

// Short field names are deliberate. At the cap the KEY NAMES alone would cost
// roughly 1.3 MB more as projId/projectIds/fetchedAt than as proj/ids/at — the
// `{ seen, n, at }` precedent from SpeciesProvenanceRecord.
const EMPTY_STORE = (): ChecklistProjectsStore => ({
  version: 1,
  entries: Object.create(null) as Record<string, ChecklistProjectsEntry>,
  order: [],
})

// ── Per-entry shape validation (FR-33, QA-34) ────────────────────────────────
// ONE predicate, run on both sides of the document: on LOAD, where a malformed
// entry is DROPPED rather than thrown on (a corrupt document degrades to "not
// cached", which degrades to a checklist simply being re-asked — never to a
// render-time crash), and on WRITE, inside `dedupedFetchProjects`, where an
// out-of-bounds candidate is substituted with the empty answer before the single
// write path sees it. One validator, two call sites, no second validation path.

function isValidEntry(e: unknown): e is ChecklistProjectsEntry {
  if (typeof e !== 'object' || e === null) return false
  const c = e as { proj?: unknown; ids?: unknown; at?: unknown }
  if (typeof c.proj !== 'string') return false
  if (c.proj !== '' && !PROJ_ID_RE.test(c.proj)) return false
  if (!Array.isArray(c.ids) || c.ids.length > MAX_PROJECT_IDS) return false
  for (const v of c.ids) {
    if (typeof v !== 'number' || !Number.isInteger(v)) return false
    if (v < 0 || v > PROJECT_ID_MAX) return false
  }
  if (typeof c.at !== 'number' || !Number.isFinite(c.at)) return false
  return true
}

/**
 * Normalize a loaded document to a well-formed store. A bad document, or any
 * `version` other than 1, yields the EMPTY store — no migrations; a shape change
 * bumps the key suffix so an old document is orphaned rather than half-read.
 *
 * Every read goes through `Object.hasOwn`, never a bare index: on an object
 * literal a bare index returns a TRUTHY INHERITED MEMBER for at least twelve
 * strings, so a `raw[key] ? … : …` guard silently takes the wrong branch for all
 * of them. The pollution probe in the tests is built with `JSON.parse` rather
 * than an object literal, because `{ __proto__: … }` in source sets the
 * prototype and creates NO own property, i.e. tests a shape that cannot arrive
 * from storage.
 */
export function sanitizeStore(loaded: unknown): ChecklistProjectsStore {
  if (typeof loaded !== 'object' || loaded === null) return EMPTY_STORE()
  const doc = loaded as { version?: unknown; entries?: unknown; order?: unknown }
  if (doc.version !== 1) return EMPTY_STORE()
  if (typeof doc.entries !== 'object' || doc.entries === null || !Array.isArray(doc.order)) {
    return EMPTY_STORE()
  }
  const raw = doc.entries as Record<string, unknown>
  const store = EMPTY_STORE()
  for (const key of doc.order) {
    // Stop admitting at the cap on the LOAD path too, so a hand-grown document
    // cannot exceed the cap in memory.
    if (store.order.length >= PROJECTS_MAX_CHECKLISTS) break
    // The key regex is also what keeps prototype-chain names ('__proto__',
    // 'constructor') out of the rebuilt record — none of them match ^S[0-9]+$.
    if (typeof key !== 'string' || !SUBMISSION_KEY_RE.test(key)) continue
    if (Object.hasOwn(store.entries, key)) continue          // duplicate order key
    if (!Object.hasOwn(raw, key)) continue
    const entry = raw[key]
    if (!isValidEntry(entry)) continue
    store.entries[key] = { proj: entry.proj, ids: [...entry.ids], at: entry.at }
    store.order.push(key)
  }
  return store
}

// ── Coalesced in-memory mirror (one disk read per session) ───────────────────

let _store: ChecklistProjectsStore | null = null
let _loading: Promise<ChecklistProjectsStore> | null = null

let _snapshot: ReadonlyMap<string, ChecklistProjectsEntry> = new Map()
let _revision = 0
const _listeners = new Set<() => void>()

// Deterministic work accounting for the capacity+1 guard (NFR-03). Installed
// ONLY by the test reset seam, so the production path carries no benchmark
// clocks and no counters on the hot path.
export interface ProjectsCacheWorkStats {
  loaderCalls: number
  merges: number
  admissions: number
  admissionsRefused: number
  /** MUST stay 0: fill-and-stop never evicts. */
  evictions: number
  writeSchedules: number
  writeFlushes: number
  lastSnapshotEntries: number
}

const EMPTY_WORK_STATS = (): ProjectsCacheWorkStats => ({
  loaderCalls: 0, merges: 0, admissions: 0, admissionsRefused: 0,
  evictions: 0, writeSchedules: 0, writeFlushes: 0, lastSnapshotEntries: 0,
})

let _workStats: ProjectsCacheWorkStats | null = null

function rebuildSnapshot(store: ChecklistProjectsStore): void {
  const out = new Map<string, ChecklistProjectsEntry>()
  for (const k of store.order) {
    if (Object.hasOwn(store.entries, k)) out.set(k, store.entries[k])
  }
  _snapshot = out
  _revision += 1
  for (const l of _listeners) l()
}

async function ensureLoaded(): Promise<ChecklistProjectsStore> {
  if (_store) return _store
  if (_loading) return _loading
  _loading = (async () => {
    const loaded = await storage.getSetting<ChecklistProjectsStore>(PROJECTS_STORE_KEY).catch(() => null)
    // A purge landed while this read was in flight (clear-means-clear): it has
    // already installed the authoritative empty mirror, and `loaded` is the
    // PRE-purge document holding the submission ids the user just cleared.
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
 *  STALE entries too: the TTL governs re-consultation, not display (FR-37). */
export async function loadSnapshot(): Promise<ReadonlyMap<string, ChecklistProjectsEntry>> {
  await ensureLoaded()
  return _snapshot
}

/** Render-safe synchronous read of the current mirror. Empty until the first
 *  `loadSnapshot()` resolves; never triggers I/O and NEVER READS THE CLOCK
 *  (NFR-10 — `react-hooks/purity` is build-blocking). */
export function getSnapshot(): ReadonlyMap<string, ChecklistProjectsEntry> {
  return _snapshot
}

/** `useSyncExternalStore` plumbing: a monotone revision advancing on every
 *  mirror change. */
export function getRevision(): number { return _revision }

export function subscribe(listener: () => void): () => void {
  _listeners.add(listener)
  return () => { _listeners.delete(listener) }
}

/** The number of distinct checklists the store still has room to admit. Drives
 *  the at-capacity display state. Reads the CONTAINER's own size. */
export function remainingCapacity(): number {
  return Math.max(0, PROJECTS_MAX_CHECKLISTS - (_store?.order.length ?? 0))
}

// ── The one write path (FR-38, QA-40) ────────────────────────────────────────

export interface ProjectsFetchResult {
  /** The normalized answer. Present even when `refused` — the caller still
   *  counts it for this session; only PERSISTENCE was declined. */
  entry: ChecklistProjectsEntry
  fromNetwork: boolean
  /** A NEW key was declined by the cap (drives the at-capacity state). */
  refused: boolean
}

/** `mergeEntry` is deliberately NOT exported: every persisted entry is
 *  fixed-shape by ONE write path rather than by each caller's discipline. */
function mergeEntry(
  store: ChecklistProjectsStore,
  submissionId: string,
  entry: ChecklistProjectsEntry,
): boolean {
  // A purge replaced the mirror while the loader was in flight. `store` is the
  // detached pre-purge document; merging into it would rebuild the snapshot
  // from purged data and schedule a write that re-lands it. Reported as NOT
  // refused: nothing was declined by the cap, only persistence was skipped, and
  // the caller still receives and counts its answer for this session.
  if (store !== _store) return false
  if (_workStats) _workStats.merges += 1
  if (!Object.hasOwn(store.entries, submissionId)) {
    // Admission gates NEW KEYS ONLY, on the CONTAINER'S OWN SIZE — the array
    // that holds the keys, never a separate counter that can silently inflate.
    if (store.order.length >= PROJECTS_MAX_CHECKLISTS) {
      if (_workStats) _workStats.admissionsRefused += 1
      return true // refused
    }
    if (_workStats) _workStats.admissions += 1
    store.order.push(submissionId)
  }
  // Merging a fresh answer into an EXISTING key is not admission and is never
  // blocked by the cap, so a full store still stays current.
  store.entries[submissionId] = { proj: entry.proj, ids: [...entry.ids], at: entry.at }
  rebuildSnapshot(store)
  scheduleWrite(store)
  return false
}

// In-flight dedupe, keyed by submission id and cleared in a `finally`. It lives
// in the STORE, not the controller, so it holds across controller remounts.
const _inflight = new Map<string, Promise<ProjectsFetchResult>>()

/**
 * The ONE fetch chokepoint. A FRESH entry short-circuits with NO NETWORK unless
 * `force`. A miss (or a stale entry) runs `loader`, deduped per submission id,
 * VALIDATES the answer against the store's own per-entry predicate, and merges
 * it through the single write path.
 *
 * ERRORS ARE NEVER CACHED, a 429 included (FR-37): on any loader rejection this
 * rethrows and writes nothing, so a retry issues a fresh outbound request.
 *
 * There is deliberately NO offline stale-serve branch here, unlike the escapee
 * store: the answer for an already-answered id is already in the document and is
 * read by the JOIN, never by a fetch.
 */
export function dedupedFetchProjects(
  submissionId: string,
  loader: () => Promise<{ projId: string; projectIds: number[] }>,
  opts?: {
    /** "Check again": skip the fresh short-circuit for THIS call. Under the
     *  365-day TTL the normal target set is empty for a year after a complete
     *  sweep, so without this the complete state's control would be a no-op
     *  press for its entire useful lifetime. The in-flight dedupe, the pacing,
     *  the admission rule and the single write path are all unchanged, so a
     *  forced re-ask is still one bounded request through one write path — the
     *  escapee store's `opts.refetch` precedent for exactly this seam. */
    force?: boolean
  },
): Promise<ProjectsFetchResult> {
  return (async () => {
    const store = await ensureLoaded()
    if (!opts?.force && Object.hasOwn(store.entries, submissionId)) {
      const hit = store.entries[submissionId]
      if (Date.now() - hit.at < PROJECTS_TTL_MS) {
        return { entry: hit, fromNetwork: false, refused: false }
      }
    }
    const pending = _inflight.get(submissionId)
    if (pending) return pending
    const p = (async () => {
      try {
        if (_workStats) _workStats.loaderCalls += 1
        const raw = await loader()
        // THE WRITE CHOKEPOINT VALIDATES, it does not merely construct. The
        // loader's answer is judged by the store's OWN predicate — the same one
        // the load path uses — before `mergeEntry` sees it. The declared return
        // type is not evidence: on the web transport the value has crossed JSON
        // from a backend that may be at a different revision, and a future change
        // to either seam normalizer is precisely the case this guards.
        //
        // An out-of-bounds answer is SUBSTITUTED with the empty answer rather
        // than dropped, and the substituted entry is what the caller receives
        // too, so the displayed answer and the persisted answer are the SAME
        // object. That identity is the point: validating on load alone would
        // count and display a value for the session, persist it, and let
        // `sanitizeStore` silently drop it on the next load — and in a
        // fill-and-stop store with a 365-day TTL, that checklist would then be
        // re-asked every session forever and never converge.
        const at = Date.now()
        const candidate: ChecklistProjectsEntry = {
          proj: raw.projId, ids: raw.projectIds, at,
        }
        const entry: ChecklistProjectsEntry = isValidEntry(candidate)
          ? candidate
          : { proj: '', ids: [], at }
        const refused = mergeEntry(store, submissionId, entry)
        return { entry, fromNetwork: true, refused }
      } finally {
        _inflight.delete(submissionId)
      }
    })()
    _inflight.set(submissionId, p)
    return p
  })()
}

// ── Debounced whole-document write (best-effort, off the blocking path) ──────

let _writeTimer: ReturnType<typeof setTimeout> | null = null
const WRITE_DEBOUNCE_MS = 250

function scheduleWrite(store: ChecklistProjectsStore): void {
  if (_workStats) _workStats.writeSchedules += 1
  if (_writeTimer) clearTimeout(_writeTimer)
  _writeTimer = setTimeout(() => {
    _writeTimer = null
    // Superseded by a purge: this closure holds the PRE-purge document.
    if (store !== _store) return
    const snapshot: ChecklistProjectsStore = {
      version: store.version,
      // Null-prototype target: Object.assign uses [[Set]], so copying an own
      // '__proto__' data key onto a plain `{}` would hit the inherited setter.
      entries: Object.assign(
        Object.create(null) as Record<string, ChecklistProjectsEntry>,
        store.entries,
      ),
      order: [...store.order],
    }
    if (_workStats) {
      _workStats.writeFlushes += 1
      _workStats.lastSnapshotEntries = snapshot.order.length
    }
    // localStorage is NEVER touched: persistence goes through the storage seam
    // only, which is what makes this survive a desktop relaunch.
    void storage.setSetting<ChecklistProjectsStore>(PROJECTS_STORE_KEY, snapshot)
      .catch(() => { /* best-effort — the mirror stays the live source */ })
  }, WRITE_DEBOUNCE_MS)
}

// ── Clear-path teardown (clear-means-clear) ──────────────────────────────────

/**
 * Drop every entry — the whole submission-id-keyed ledger — from the mirror AND
 * from disk. The PRODUCTION purge, distinct from
 * `_resetProjectsCacheForTests` below, which only detaches the mirror.
 *
 * Called only from the shared clear-path teardown (`lib/clearDerived.ts`).
 * NEVER on a replace: this store's 365-day incremental premise is that a newer
 * export re-asks only the checklists it has not answered yet (FR-24,
 * `PRIVACY_POLICY.md`), and purging on upload would force a full eight-minute
 * re-sweep on every upload.
 *
 * `deleteSetting` is the seam's own `settings.json` read-modify-write, so it
 * runs as one link on that document's `docChains` chain.
 */
export async function purgeProjectsStore(): Promise<void> {
  if (_writeTimer) { clearTimeout(_writeTimer); _writeTimer = null }
  _inflight.clear()
  _store = EMPTY_STORE()
  rebuildSnapshot(_store)
  await storage.deleteSetting(PROJECTS_STORE_KEY)
}

/** Test seam: deterministic work performed since the last reset. */
export function _getProjectsCacheWorkStatsForTests(): Readonly<ProjectsCacheWorkStats> {
  if (!_workStats) _workStats = EMPTY_WORK_STATS()
  return { ..._workStats }
}

/** Test seam: reset the module mirror so each test starts from disk-empty. */
export function _resetProjectsCacheForTests(): void {
  if (_writeTimer) { clearTimeout(_writeTimer); _writeTimer = null }
  _store = null
  _loading = null
  _snapshot = new Map()
  _revision = 0
  _workStats = EMPTY_WORK_STATS()
  _inflight.clear()
  PROJECTS_MAX_CHECKLISTS = 65_536
}
