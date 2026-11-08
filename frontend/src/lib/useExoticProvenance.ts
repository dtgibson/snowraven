// The exotic-provenance resolution pass controller (schema.md §8).
//
// STATISTICS ONLY (FR-17). This is the one module in the feature that touches
// `transport`, and no other surface may mount it. Every other surface reads the
// cached result passively through `useProvenanceLookup`, which cannot reach a
// network module at all.
//
// Shape of a pass:
//   1. PLAN offline. Build the greedy cover over species that are not yet
//      resolved, from checklists not already consulted. Its size is known before
//      request one and is shown as a definite figure, never an indeterminate
//      spinner (FR-11, QA-17).
//   2. DISPATCH through a pool of exactly 4 (FR-14, QA-19), one request per
//      checklist (FR-13, QA-18), all through `transport` (FR-12, QA-14), each
//      one through the shared eBird gate (ebird-request-economy D-01): this
//      pass is its own enforcement point over the gate's key-global state, the
//      Projects sweep's shape, so the gate's 150 ms start spacing (not the
//      pool) is the governor, a 429 opens the one shared cooldown and is
//      retried at most twice, and a call still waiting when Stop is pressed or
//      a Clear lands is never sent.
//   3. MERGE each response as it lands, which reclassifies species and shrinks
//      the remaining work.
//   4. FOLLOW UP with another greedy round rather than a precomputed list. A
//      species that flips to `counting` simply leaves `remaining` and its queued
//      follow-ups evaporate, which makes FR-02's "stop seeking as soon as one
//      counting observation is found" structural rather than a check.
//   5. BOUND both axes and report the partial state honestly (FR-16).
//   6. SETTLE. A species no successful answer carries is stamped by the store
//      (exotic-provenance-reuse), so the next load does not re-open the
//      checklists already asked about it; only Check again re-asks within the
//      TTL. A check that ends with species still open is never `complete`
//      (D-04): Life Lists' completion test reads the same open set.
//
// Every clock read lives in a handler or an effect. Nothing here is called
// during render, and the objects render consumes are entirely time-free
// (NFR-03; `react-hooks/purity` is build-blocking in this repo).

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { transport } from './transport'
import { gatedEbirdCall } from './ebirdGate'
import { isOfflineError } from './offlineDetect'
import { formatDate } from './formatDate'
import { SUBMISSION_ID_RE } from '../components/speciesDetail/ui'
import {
  buildProvenanceLookup, carriersNeedingRefetch, greedyCover, openSpeciesNames, remainingSpecies,
  EMPTY_LOOKUP, type CoverIndex, type ProvenanceLookup,
} from './exoticProvenance'
import {
  consultedSet, getSnapshot, isFreshFor, lastConsultedAt, loadSnapshot,
  publishClassifiedNames, subscribe, dedupedFetchChecklist, unmatchedSet,
  provenancePurgeGeneration,
  type ProvenanceObservation,
} from './exoticProvenanceCache'

/** FR-14: matches EAGER_FETCH_CONCURRENCY in useCountyCompleteness. Since
 *  ebird-request-economy a latency ceiling only: every request also waits for
 *  its start slot at the shared eBird gate, whose spacing governs (the v0.5.92
 *  activity-pass precedent). */
export const PROVENANCE_CONCURRENCY = 4
/** FR-16: one species may drive at most this many follow-up requests. */
export const MAX_FOLLOWUP_PER_SPECIES = 25
/** FR-16: total outbound requests in one pass. 6.8x the measured reference
 *  cover of 73 checklists.
 *
 *  A mutable binding with a setter, matching how the cache's own caps
 *  (`setProvenanceMaxSpecies` / `setProvenanceMaxChecklists`) are made testable.
 *  Without a seam this bound is only reachable by building a 500-checklist
 *  fixture, which is why it shipped its first round with no regression test at
 *  all. */
export let MAX_REQUESTS_PER_PASS = 500

/** Test seam: override the per-pass request cap. Restore it to 500 afterwards;
 *  the module holds no reset of its own. */
export function setMaxRequestsPerPass(n: number): void { MAX_REQUESTS_PER_PASS = n }
/** Defensive bound on greedy rounds. Each round strictly grows the attempted
 *  set, so this can only be reached by a pathological fixture. */
const MAX_ROUNDS = 64

/**
 * Minimum spacing between PROGRESS status emissions, in ms.
 *
 * The status sentence lives inside a `role="status"` live region, and
 * `aria-live` announces on every mutation within that region. Emitting once per
 * completed request meant 75 announcements over a 9.7 second pass, roughly 7.7
 * per second, which is unusable rather than merely chatty.
 *
 * Throttling the EMISSION rather than the announcement keeps one source of
 * truth: the sentence, the progress bar and the "24 / 73" readout all move
 * together, so nothing on screen can disagree with anything else. The bar's
 * `transition: width` smooths the steps visually. Terminal statuses and the
 * first definite figure are never throttled: FR-11 requires the planned count to
 * be shown before the first request goes out, and a pass must always report how
 * it ended.
 *
 * 2 s over a ~10 s pass gives about five announcements. Raise it if a pass gets
 * longer; do not remove it and do not move the throttle into the component,
 * where it would desynchronize the sentence from the bar.
 */
export const PROGRESS_ANNOUNCE_INTERVAL_MS = 2000

/** `unmatched` (exotic-provenance-reuse D-04): the check has asked eBird about
 *  every checklist it can within the TTL and species are still open, because
 *  the answers had no row for them. Settled, but not complete. */
export type PartialReason = 'cancelled' | 'pass-budget' | 'species-budget' | 'failures' | 'unmatched'

/** Check again's view of the stamps: none, so the heal re-opens every
 *  recordless species for that one run, bounded by the usual caps. */
const NO_STAMPS: ReadonlySet<string> = new Set<string>()

export type ProvenanceStatus =
  | { kind: 'not-checked' }
  | { kind: 'in-progress'; done: number; planned: number; additional: number }
  | { kind: 'complete'; planned: number; found: number }
  | {
      kind: 'partial'
      done: number
      planned: number
      failed: number
      /** Species still unchecked, i.e. `unresolved` + `unknown`. */
      openSpecies: number
      reason: PartialReason
      /** MAX_REQUESTS_PER_PASS / MAX_FOLLOWUP_PER_SPECIES, per reason. */
      cap: number
      /** escapee-check-new-taxonomy: for `unmatched` only, the export's own
       *  names for the open species, sorted, so the line can name them. Absent
       *  for every other reason, where the open set is not settled. */
      openNames?: readonly string[]
    }
  | { kind: 'no-key' }
  | { kind: 'offline'; /** Pre-formatted; see exoticCopy.statusSentence. */ checkedLabel: string | null }
  | { kind: 'error' }

export interface UseExoticProvenanceArgs {
  /** Statistics has finished its shell pass and holds a real cover index. */
  active: boolean
  index: CoverIndex
  /** null while the key lookup is still in flight. */
  hasEbirdKey: boolean | null
  online: boolean
}

export interface ExoticProvenanceController {
  status: ProvenanceStatus
  /** Advances on EVERY status update, including an update to an identical
   *  value. The live region keys its message child on it (NFR-06, QA-54). */
  statusSeq: number
  lookup: ProvenanceLookup
  /** FR-19: end the pass. Everything already resolved is kept and cached. */
  stop: () => void
  /** The error state's "Try again" and every partial state's "Check again".
   *  From the `unmatched` state it is the one way to re-ask, within the TTL,
   *  about a species eBird's answers did not include: that run ignores the
   *  stamps. From every other state it keeps its meaning (retry the failed,
   *  continue the stopped), so a retry after a run of 429s does not also
   *  re-open every settled species on the same key (decisions.md D-13). */
  retry: () => void
}

/** One outbound eBird request. The id is shape-guarded with the app-wide
 *  `SUBMISSION_ID_RE` and `encodeURIComponent`-wrapped before it reaches a URL
 *  (NFR-08, QA-55); `fields=provenance` suppresses the seam's second per
 *  checklist call for a location name the provenance result does not need
 *  (FR-13). The response is untrusted input, so both raw fields are read
 *  defensively and normalized at the seam. */
async function fetchProvenance(submissionId: string): Promise<readonly ProvenanceObservation[]> {
  if (!SUBMISSION_ID_RE.test(submissionId)) {
    throw Object.assign(new Error('Malformed checklist id.'), { status: 400 })
  }
  const res = await transport.get<{
    species?: Array<{ speciesCode?: string; exoticCategory?: string; userDoNotCount?: string }>
  }>(`/checklists/${encodeURIComponent(submissionId)}`, { fields: 'provenance' })
  // An answer with no species list is a FAILED answer, never an empty one
  // (ebird-request-economy D-02): read as empty it would stamp every species the
  // checklist carries for 30 days. Both transports already refuse such a body
  // with a 502; this is the same verdict once more, at the consumer, with a
  // status so the offline test never reads it as no connection.
  if (!Array.isArray(res?.species)) {
    throw Object.assign(new Error('Could not fetch checklist (HTTP 502).'), { status: 502 })
  }
  const rows = res.species
  const out: ProvenanceObservation[] = []
  for (const s of rows) {
    if (typeof s?.speciesCode !== 'string' || s.speciesCode === '') continue
    out.push({
      speciesCode: s.speciesCode,
      exoticCategory: typeof s.exoticCategory === 'string' ? s.exoticCategory : '',
      userDoNotCount: typeof s.userDoNotCount === 'string' ? s.userDoNotCount : '',
    })
  }
  return out
}

/** The offline status, with its date label formatted HERE (a handler or an
 *  effect) rather than in a render body, so no `Date` construction can reach the
 *  render path (NFR-03). */
function offlineStatus(): ProvenanceStatus {
  const at = lastConsultedAt()
  return { kind: 'offline', checkedLabel: at === null ? null : formatDate(new Date(at)) }
}

/** One pass's stop, owned by that pass alone (ebird-request-economy D-07). A
 *  per-pass token rather than one shared flag, because a call from a stopped
 *  pass can still be waiting at the gate when the next pass starts, and a
 *  shared flag reset by that pass would let it send. */
interface PassStop {
  /** True once Stop was pressed or a Clear superseded the pass. */
  stopped: boolean
  /** Settles when `stopped` turns true. */
  signal: Promise<void>
  stop: () => void
}

function newPassStop(): PassStop {
  let settle!: () => void
  const signal = new Promise<void>(r => { settle = r })
  const token: PassStop = {
    stopped: false,
    signal,
    stop: () => { if (!token.stopped) { token.stopped = true; settle() } },
  }
  return token
}

/** Thrown inside a gated call that the pass decided, once its start slot came
 *  up, not to send. Caught in `gatedProvenance` and never leaves it. A plain
 *  object: the gate rethrows anything that is not a 429 unchanged and notes
 *  nothing about it, and no other code ever sees it. */
const NOT_SENT = { notSent: true } as const

/**
 * One checklist lookup through the shared eBird gate (ebird-request-economy
 * D-01): spaced starts, the one key-global cooldown, bounded 429 retries, all
 * from `gatedEbirdCall`; nothing is re-implemented here. This is the loader the
 * store's chokepoint runs, so a saved answer never waits and an in-flight join
 * never takes a second start slot.
 *
 * A call is checked again when its start slot comes up, retries included: if
 * the pass has stopped (Stop, or a Clear), nothing is sent and this resolves
 * `null`, which the chokepoint reports as `notSent`, neither done nor failed.
 * Stop also ends a wait at once (the race below), so the pass can report
 * itself stopped without sitting out a cooldown of up to 60 s. A request
 * already on the wire is let finish, and only THAT attempt (D-18): an answer
 * already paid for is kept; a non-429 error, or the final 429, is the gate's
 * last word and `gated` rejects with it before the macrotask below, so it
 * still counts as failed; and a 429 the gate would retry ends the stopped call
 * as `null` at once, rather than after the cooldown, because that retry would
 * find the pass stopped and send nothing. The 429 itself still reaches the
 * gate, so the key-global cooldown opens as before. A start slot taken by a
 * call that then sends nothing is spacing spent on no request, at most one per
 * waiting call, once per Stop or Clear.
 */
function gatedProvenance(submissionId: string, pass: PassStop): Promise<readonly ProvenanceObservation[] | null> {
  let onWire: Promise<readonly ProvenanceObservation[]> | null = null
  const gated = gatedEbirdCall(async () => {
    if (pass.stopped) throw NOT_SENT
    const attempt = fetchProvenance(submissionId)
    onWire = attempt
    try {
      return await attempt
    } finally {
      onWire = null
    }
  }).catch((err: unknown) => {
    if (err === NOT_SENT) return null
    throw err
  })
  const stopped = pass.signal.then(async () => {
    const attempt = onWire
    if (attempt === null) return null
    try {
      return await attempt
    } catch {
      // The gate decides in microtasks alone (`gatedEbirdCall` rethrows with
      // no timer in between), so by the next macrotask `gated` has settled
      // unless the gate is waiting to retry. Either way the race below is
      // decided without waiting out a cooldown.
      await new Promise<void>(r => { setTimeout(r, 0) })
      return null
    }
  })
  return Promise.race([gated, stopped])
}

export function useExoticProvenance(
  { active, index, hasEbirdKey, online }: UseExoticProvenanceArgs,
): ExoticProvenanceController {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
  // Status and its announcement sequence move together. The sequence exists so
  // the live region can key its message child on it: `aria-live` fires on DOM
  // MUTATION, and React bails out when reconciling a text node to an identical
  // string, so pressing the same control twice would otherwise announce once
  // while the visible sentence re-renders both times (NFR-06, QA-54).
  const [state, setState] = useState<{ status: ProvenanceStatus; seq: number }>(
    () => ({ status: { kind: 'not-checked' }, seq: 0 }),
  )
  // NOTE the emitters below are declared where they are USED, each closing over
  // React's own `setState`. A shared `useCallback` wrapper was tried and is
  // wrong here: naming it makes it a dependency of both the pass and the
  // auto-start effect, and `react-hooks/set-state-in-effect` then traces the
  // effect into it and reports a synchronous setState that does not exist.
  // `setState` itself is stable and exempt, so referencing it directly keeps
  // both dependency arrays empty and the rule satisfied by construction.
  const advance = (next: ProvenanceStatus): void =>
    setState(prev => ({ status: next, seq: prev.seq + 1 }))
  const advanceRef = useRef(advance)
  advanceRef.current = advance
  const { status, seq } = state
  const statusRef = useRef(status)
  statusRef.current = status
  const [loaded, setLoaded] = useState(false)

  const runningRef = useRef(false)
  const passRef = useRef<PassStop | null>(null)
  const startedForRef = useRef<CoverIndex | null>(null)
  const indexRef = useRef(index)
  indexRef.current = index

  // One disk read per session, shared with every passive reader.
  useEffect(() => {
    let cancelled = false
    void loadSnapshot().then(() => { if (!cancelled) setLoaded(true) })
    return () => { cancelled = true }
  }, [])

  const lookup = useMemo<ProvenanceLookup>(
    () => (index.bySpecies.size === 0 ? EMPTY_LOOKUP : buildProvenanceLookup(snapshot, index)),
    [snapshot, index],
  )

  // Publish the classification for passive readers (the Calendar holds no
  // name-to-code join and is zero-network by guarantee). Statistics is the only
  // place that holds the join, so it is the only publisher, of both the escapee
  // list and (life-lists-tab FR-17) the exotic list, in one write. The store's
  // publisher no-ops when both lists are unchanged, so this settles after one
  // round rather than looping on its own revision bump. The guard condition is
  // unchanged, and the effect touches the store only: no request (QA-18).
  useEffect(() => {
    if (snapshot.species.size === 0 || index.bySpecies.size === 0) return
    void publishClassifiedNames({ excludedNames: [...lookup.excludedNames], exoticNames: [...lookup.exoticNames] })
  }, [lookup, snapshot, index])

  const runPass = useCallback(async (reask = false): Promise<void> => {
    const setStatus = (next: ProvenanceStatus): void => { advanceRef.current(next) }
    if (runningRef.current) return
    runningRef.current = true
    const pass = newPassStop()
    passRef.current = pass
    let unsubscribe: (() => void) | null = null
    try {
      await loadSnapshot()
      // A Clear supersedes the pass (ebird-request-economy D-08): the cover was
      // planned from the export being deleted, so from the moment the store's
      // purge counter moves no call of this pass is sent and nothing more is
      // picked. The purge rebuilds the snapshot, which notifies this listener
      // synchronously, before any waiting call can reach its start slot.
      const passGeneration = provenancePurgeGeneration()
      unsubscribe = subscribe(() => { if (provenancePurgeGeneration() !== passGeneration) pass.stop() })
      const idx = indexRef.current
      const admissible = new Set(idx.bySpecies.keys())
      // Checklists already answered this pass or attempted and failed. A failed
      // request writes no ledger entry (errors are never cached), so without
      // this the next greedy round would select it again forever.
      const attempted = new Set<string>()
      const parked = new Set<string>()
      const followups = new Map<string, number>()

      let planned = 0
      let done = 0
      let failed = 0
      let additional = 0
      let issued = 0
      let reason: PartialReason | null = null
      let cap = 0
      // Throttled progress emitter. `force` is used for the first definite
      // figure of a round and for anything that changes the SHAPE of the
      // sentence (a follow-up wave being discovered), never for an ordinary
      // request completing.
      let lastEmit = 0
      const emitProgress = (force: boolean): void => {
        const now = Date.now()
        if (!force && now - lastEmit < PROGRESS_ANNOUNCE_INTERVAL_MS) return
        lastEmit = now
        setStatus({ kind: 'in-progress', done, planned, additional })
      }

      for (let round = 0; round < MAX_ROUNDS; round += 1) {
        const nowMs = Date.now()
        const remaining = remainingSpecies(getSnapshot(), idx, parked)
        if (remaining.length === 0) break

        const consulted = new Set(consultedSet(nowMs))
        // A fresh ledger entry does not stand for a recordless cover species
        // (see carriersNeedingRefetch) — drop those ids so the cover can
        // re-select them, and remember them so the cache chokepoint (whose own
        // fresh-ledger short-circuit would otherwise refuse the wave's pick)
        // is told the refetch is intended. `attempted` is re-added AFTER the
        // drop, so a checklist this pass already fetched is never fetched
        // twice. A species a successful answer was seen to lack within the
        // TTL is not re-opened, read fresh each round so a stamp written
        // earlier in this pass already counts; Check again (`reask`) ignores
        // the stamps for its whole run.
        const staleLedger = carriersNeedingRefetch(getSnapshot(), idx, remaining, reask ? NO_STAMPS : unmatchedSet(nowMs))
        for (const id of staleLedger) consulted.delete(id)
        for (const id of attempted) consulted.add(id)

        const budget = MAX_REQUESTS_PER_PASS - issued
        if (budget <= 0) { reason = 'pass-budget'; cap = MAX_REQUESTS_PER_PASS; break }

        const wave = greedyCover(idx, remaining, consulted, budget)
        if (wave.length === 0) break

        if (round === 0) {
          planned = wave.length
        } else {
          additional += wave.length
          // FR-16: attribute each follow-up request to the still-open species it
          // was selected for, and park a species that reaches its bound. A
          // parked species leaves `remaining` and stays `unresolved`, which
          // counts (FR-04).
          const open = new Set(remaining)
          for (const sub of wave) {
            for (const code of idx.byChecklist.get(sub) ?? []) {
              if (!open.has(code)) continue
              const next = (followups.get(code) ?? 0) + 1
              followups.set(code, next)
              if (next >= MAX_FOLLOWUP_PER_SPECIES) {
                parked.add(code)
                reason = 'species-budget'
                cap = MAX_FOLLOWUP_PER_SPECIES
              }
            }
          }
        }

        // The wave's size is known here, before request one (FR-11), and a new
        // wave changes the sentence's shape, so this emission is never
        // throttled.
        emitProgress(true)

        // ── Bounded pool: exactly PROVENANCE_CONCURRENCY in flight ────────────
        let next = 0
        const worker = async (): Promise<void> => {
          for (;;) {
            if (pass.stopped) return
            // Defence in depth, and deliberately NOT independently reachable:
            // `greedyCover` is handed `budget` above, so a wave can never be
            // larger than the requests still allowed, and `issued` therefore
            // cannot pass the cap through this loop. A mutation removing this
            // line leaves the suite green for that reason. The invariant it
            // backs up IS tested, across multiple follow-up rounds, by
            // "never issues more than the cap across follow-up rounds" in
            // useExoticProvenance.test.tsx; if that bound is ever relaxed at
            // the planning step, this becomes the thing that holds the line.
            if (issued >= MAX_REQUESTS_PER_PASS) return
            const i = next
            next += 1
            if (i >= wave.length) return
            const id = wave[i]
            attempted.add(id)
            issued += 1
            try {
              const res = await dedupedFetchChecklist(id, admissible, () => gatedProvenance(id, pass), {
                refetch: staleLedger.has(id),
                carried: idx.byChecklist.get(id) ?? [],
                // The taxonomy join (escapee-check-new-taxonomy): an answer row
                // under a sibling code from the same split or lump stands in
                // for a carried species whose export name predates it.
                standIns: idx.standIns,
              })
              // Not sent (D-01): neither done nor failed. The pass has stopped,
              // so the loop head returns next.
              if (res.notSent) continue
              done += 1
            } catch {
              failed += 1
            }
            emitProgress(false)
          }
        }
        await Promise.all(
          Array.from({ length: PROVENANCE_CONCURRENCY }, () => worker()),
        )

        if (pass.stopped) { reason = 'cancelled'; break }
        // Deliberately NOT `if (issued >= MAX_REQUESTS_PER_PASS) reason = 'pass-budget'`
        // here. Reaching the cap is only a partial result if work REMAINS, and
        // an earlier revision reported `pass-budget` on a pass whose cover
        // happened to equal the cap exactly, i.e. on a pass that had in fact
        // finished. The loop's own head already decides this correctly: an
        // empty `remaining` breaks with no reason (complete), and a non-empty
        // `remaining` with a spent budget sets the reason on the next pass
        // through. One decision point, not two that can disagree.
      }

      // ── Report ───────────────────────────────────────────────────────────────
      const finalLookup = buildProvenanceLookup(getSnapshot(), indexRef.current)
      const openSpecies = finalLookup.counts.unresolved + finalLookup.counts.unknown

      if (done === 0 && failed > 0) {
        setStatus({ kind: 'error' })
        return
      }
      if (reason === null && failed > 0) { reason = 'failures'; cap = 0 }
      // D-04: never `complete` while species are open. Nothing failed and
      // nothing stopped the pass, so every checklist it could ask is answered
      // and the answers had no row for these.
      if (reason === null && openSpecies > 0) { reason = 'unmatched'; cap = 0 }
      if (reason === 'unmatched') {
        // Settled but open: name the species, so the line says which bird
        // eBird's answers left out (escapee-check-new-taxonomy).
        const final = indexRef.current
        const openNames = openSpeciesNames(final, remainingSpecies(getSnapshot(), final, new Set()))
        setStatus({ kind: 'partial', done, planned, failed, openSpecies, reason, cap, openNames })
        return
      }
      if (reason !== null) {
        setStatus({
          kind: 'partial', done, planned, failed, openSpecies, reason, cap,
        })
        return
      }
      setStatus({ kind: 'complete', planned, found: finalLookup.excluded.length })
    } catch (err) {
      setStatus(isOfflineError(err) ? offlineStatus() : { kind: 'error' })
    } finally {
      unsubscribe?.()
      runningRef.current = false
    }
  }, [])

  // ── Auto-start (FR-18, OQ-02 default) ────────────────────────────────────────
  // All three reads happen here, in an effect: a key is present, the app is
  // online, and the cache does not already hold a fresh result covering every
  // species in the loaded export. The Date.now() freshness comparison is one of
  // them, so the render path stays time-free.
  useEffect(() => {
    if (!active || !loaded || index.bySpecies.size === 0) return
    if (startedForRef.current === index) return
    if (hasEbirdKey === null) return
    // Deferred to a microtask so the effect body never calls setState
    // synchronously (react-hooks/set-state-in-effect).
    const settle = (next: ProvenanceStatus): void => { void Promise.resolve().then(() => advanceRef.current(next)) }

    if (hasEbirdKey === false) { settle({ kind: 'no-key' }); return }
    if (!online) { settle(offlineStatus()); return }

    const nowMs = Date.now()
    const open = remainingSpecies(getSnapshot(), index, new Set())
    const carriers = new Set<string>()
    for (const code of open) {
      for (const sub of index.bySpecies.get(code) ?? []) carriers.add(sub)
    }
    startedForRef.current = index

    // A fresh ledger is only a reason to skip the pass when every open species
    // also HAS a record to classify from, or a successful answer within the
    // TTL was seen to lack it. A recordless, unstamped cover species means the
    // ledger was written under a cover that could not admit it, and the pass
    // must run to heal the store (see carriersNeedingRefetch).
    if (open.length === 0) {
      const resolved = buildProvenanceLookup(getSnapshot(), index)
      settle(
        getSnapshot().species.size === 0
          ? { kind: 'not-checked' }
          : { kind: 'complete', planned: 0, found: resolved.excluded.length },
      )
      return
    }
    const stale = carriersNeedingRefetch(getSnapshot(), index, open, unmatchedSet(nowMs))
    if (stale.size === 0 && isFreshFor(carriers, nowMs)) {
      // Settled but open, and newly reachable with the stamps: every carrier
      // is answered within the TTL, so each open species is a stamped one.
      // No pass and no request; never `complete` (D-04).
      settle({
        kind: 'partial', done: 0, planned: 0, failed: 0, openSpecies: open.length, reason: 'unmatched', cap: 0,
        openNames: openSpeciesNames(index, open),
      })
      return
    }

    void runPass()
  }, [active, loaded, index, hasEbirdKey, online, runPass])

  // Stops the running pass only. A finished pass's token is already spent, and
  // a press before any pass ran has nothing to stop, as before.
  const stop = useCallback(() => { passRef.current?.stop() }, [])

  const retry = useCallback(() => {
    if (runningRef.current) return
    const current = statusRef.current
    void runPass(current.kind === 'partial' && current.reason === 'unmatched')
  }, [runPass])

  return useMemo(
    () => ({ status, statusSeq: seq, lookup, stop, retry }),
    [status, seq, lookup, stop, retry],
  )
}
