// The projects sweep controller (county-shading-and-project-stats, FR-39
// through FR-47, FR-51 through FR-53).
//
// NOTHING IS FETCHED WITHOUT A PRESS, and that is STRUCTURAL rather than
// enforced: there is no auto-start effect anywhere in this file. The escapee
// controller's `useEffect`-driven start is deliberately NOT copied. The hook
// mounts idle and only a handler calls `start`. It is mounted by
// components/BirdingStats.tsx and nowhere else, so "mounting any other tab
// imports no sweep module" is an import-graph fact.
//
// THERE IS NO SERIALIZED CURSOR. The target set is recomputed from scratch at
// every start and resume, which is precisely what makes "resume after a quit"
// and "second run after a newer export" the SAME operation. It is also what
// makes the honest `partial` copy fall out rather than needing to be enforced:
// nothing about a Stop is persisted, so after a relaunch the state resolves to
// `partial`, which states counts only and cannot claim the user stopped it.
//
// PACING: the sweep is its own enforcement point over the SHARED gate state.
// `/checklists/{id}` cannot join EBIRD_GATED_PATHS (both sets match with
// Set.has on the exact path string, and this is a prefix route carrying an id),
// so this pump calls `gatedEbirdCall` directly — the same shape as the
// hotspot-activity pump, and the reason the repo rule reads "joins
// EBIRD_GATED_PATHS or owns its enforcement over the shared state, never
// neither, never both". A 429 raised here slows the Map Explorer and vice
// versa, because the state is module-scoped in lib/ebirdGate.ts.
//
// CONCURRENCY IS 1 — a sequential pump, not the activity controller's pool of
// 4. The 150 ms start spacing is the governor, so a pool buys no throughput; it
// only deepens the gate's queue and makes Stop less crisp. Sequential also makes
// Stop exact (at most one in-flight request may complete) and makes the duration
// estimate a clean exportTotal x 150 ms.
//
// ALL CLOCK READS live in the ticker, the pump and the handlers. Never in a
// render body, a `useMemo` or a `useCallback` (`react-hooks/purity` is
// build-blocking).

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import type { ChecklistEntry } from '../types'
import { transport } from './transport'
import { gatedEbirdCall, ebirdGateState } from './ebirdGate'
import { isRateLimitError } from './rateLimit'
import { classifyLiveError } from './offlineMessage'
import { SUBMISSION_KEY_RE } from './checklistId'
import {
  dedupedFetchProjects, getSnapshot, loadSnapshot, subscribe, getRevision,
  remainingCapacity, PROJECTS_TTL_MS, PROJECTS_MAX_CHECKLISTS,
} from './checklistProjectsCache'
import {
  buildTargetIds, deriveProjectsView, EMPTY_PROJECTS_VIEW, type ProjectsView,
} from './checklistProjects'

/** The shipped escapee interval. One 2,000 ms ticker is the SINGLE emission
 *  source, so the sentence, the progress bar and the N / M readout render from
 *  one status object and cannot disagree on screen — structurally, not by
 *  discipline. */
export const PROJECTS_ANNOUNCE_INTERVAL_MS = 2000

/**
 * The eleven display states. Every variant that can render a tally carries
 * `checked` and `total` AS REQUIRED FIELDS, so "no tally renders alone" is
 * structurally impossible to violate rather than a thing to remember.
 * `no-key` carries none because it renders no tally.
 */
export type ProjectsStatus =
  | { kind: 'never-run'; total: number; skipped: number }
  | { kind: 'running'; checked: number; total: number }
  | { kind: 'cooldown'; checked: number; total: number; seconds: number }
  | { kind: 'stopped'; checked: number; total: number }
  | { kind: 'partial'; checked: number; total: number; remaining: number }
  | { kind: 'complete'; checked: number; total: number }
  | { kind: 'unanswered'; checked: number; total: number; failed: number }
  | { kind: 'at-capacity'; checked: number; total: number; capacity: number }
  | { kind: 'no-key' }
  | { kind: 'offline'; checked: number; total: number }
  | { kind: 'error'; checked: number; total: number }

export interface ChecklistProjectsController {
  status: ProjectsStatus
  /** Advances on EVERY status update, including an update to an identical
   *  value. The live region keys its message child on it: `aria-live` fires on
   *  DOM MUTATION and React bails on an identical text node, so a repeated
   *  identical message would otherwise announce once. */
  statusSeq: number
  /** The derived tally, recomputed from (store snapshot x loaded backup). */
  view: ProjectsView
  /** The number of checklists that failed their bounded retries this session. */
  failedIds: ReadonlySet<string>
  start: () => void
  stop: () => void
  resume: () => void
  /** The complete state's control: the FORCE path through the same chokepoint. */
  checkAgain: () => void
}

export interface UseChecklistProjectsArgs {
  /** The loaded backup's checklists. Changing identity cancels a running pass
   *  and recomputes the target set (FR-46). */
  checklists: readonly ChecklistEntry[]
  /** null while the key lookup is still in flight. */
  hasEbirdKey: boolean | null
  online: boolean
}

/** ONE outbound eBird request. The id is shape-guarded and
 *  `encodeURIComponent`-wrapped before it reaches a URL (NFR-09), on top of the
 *  target set already excluding malformed ids. `fields=projects` suppresses both
 *  of the seam's follow-up calls, so a checklist costs exactly one request. */
async function fetchProjects(submissionId: string): Promise<{ projId: string; projectIds: number[] }> {
  if (!SUBMISSION_KEY_RE.test(submissionId)) {
    throw Object.assign(new Error('Malformed checklist id.'), { status: 400 })
  }
  const res = await transport.get<{ projId?: unknown; projectIds?: unknown }>(
    `/checklists/${encodeURIComponent(submissionId)}`, { fields: 'projects' },
  )
  // The response is untrusted even after the seam normalizes it: on the web
  // transport it has crossed JSON, so re-read defensively rather than trusting
  // the declared shape. Anything unexpected degrades to the empty answer, which
  // simply reports no project.
  //
  // This is a TYPE guard, not the VALUE-BOUNDS guard, and deliberately so: the
  // bounds (^[A-Z0-9_]{1,32}$, 0..PROJECT_ID_MAX, MAX_PROJECT_IDS) are enforced
  // by the store's own predicate at its write chokepoint, so the document's
  // bound is a property of that module rather than of this caller's discipline.
  // Do not re-derive them here — that is the second validation path the
  // one-chokepoint rule exists to prevent.
  const projId = typeof res?.projId === 'string' ? res.projId : ''
  const projectIds = Array.isArray(res?.projectIds)
    ? res.projectIds.filter((v): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0)
    : []
  return { projId, projectIds }
}

/**
 * The resting status when no pass is running. MODULE-LEVEL AND PURE: every input
 * it needs is passed in, so the ref reads happen at the CALL SITE — an effect or
 * a handler — and never during render. `react-hooks/refs` is build-blocking, and
 * a helper that reaches into refs pulls every write to those refs into the
 * render phase in the compiler's eyes.
 *
 * EXPORTED FOR THE COPY GUARD. `projectsCopy.test.ts` sweeps every state at
 * every interesting count, and a hand-written list of states there would be a
 * replica that can drift from the real precedence (`complete` before `stopped`,
 * `at-capacity` before everything). Driving the sweep through this function
 * means the guard covers what the app can actually reach, and nothing else.
 */
export function restingStatus(v: ProjectsView, o: {
  hasEbirdKey: boolean | null
  online: boolean
  atCapacity: boolean
  failed: number
  stopped: boolean
}): ProjectsStatus {
  if (o.hasEbirdKey === false) return { kind: 'no-key' }
  const { checked, total } = v
  if (o.atCapacity) return { kind: 'at-capacity', checked, total, capacity: PROJECTS_MAX_CHECKLISTS }
  if (o.failed > 0) return { kind: 'unanswered', checked, total, failed: o.failed }
  if (!o.online) return { kind: 'offline', checked, total }
  if (checked === 0) return { kind: 'never-run', total, skipped: v.skipped }
  if (checked >= total) return { kind: 'complete', checked, total }
  if (o.stopped) return { kind: 'stopped', checked, total }
  return { kind: 'partial', checked, total, remaining: total - checked }
}

export function useChecklistProjects(
  { checklists, hasEbirdKey, online }: UseChecklistProjectsArgs,
): ChecklistProjectsController {
  const revision = useSyncExternalStore(subscribe, getRevision, getRevision)
  const [loaded, setLoaded] = useState(false)
  const [state, setState] = useState<{ status: ProjectsStatus | null; seq: number }>(
    () => ({ status: null, seq: 0 }),
  )
  // Stable by construction (`setState` is stable and the deps are empty), so no
  // ref is needed to reach it from an async pump and nothing is written during
  // render.
  const advance = useCallback((next: ProjectsStatus): void => {
    setState(prev => ({ status: next, seq: prev.seq + 1 }))
  }, [])

  const runningRef = useRef(false)
  const cancelRef = useRef(false)
  const stoppedRef = useRef(false)
  /** Session-only. Nothing about a failure is persisted, so these reset on
   *  relaunch and the state resolves to `partial` — which claims nothing. */
  const failedRef = useRef<Set<string>>(new Set())
  const [failedIds, setFailedIds] = useState<ReadonlySet<string>>(new Set())
  const atCapacityRef = useRef(false)
  /** Bumped by any input change that invalidates a running pass (FR-46). */
  const generationRef = useRef(0)
  // Live counters the ticker reads. Plain refs, mutated by the pump.
  const progressRef = useRef({ checked: 0, total: 0 })

  // One disk read per session, shared with every reader.
  useEffect(() => {
    let cancelled = false
    void loadSnapshot().then(() => { if (!cancelled) setLoaded(true) })
    return () => { cancelled = true }
  }, [])

  // The derived tally, recomputed from (store snapshot x loaded backup). PURE,
  // and `revision` is what re-derives it after every merge.
  //
  // NOT gated on `loaded`. Before the store's first disk read resolves the
  // snapshot is simply empty, which gives `checked: 0` and the CORRECT `total`
  // and `skipped` — both of which come from the backup alone. Gating the whole
  // view on `loaded` would flash a 0-of-0 denominator on first paint, which is
  // exactly the unearned figure this section exists to avoid.
  const view = useMemo(
    () => {
      void revision
      return checklists.length === 0 ? EMPTY_PROJECTS_VIEW : deriveProjectsView(checklists, getSnapshot())
    },
    [revision, checklists],
  )

  // The latest derived view, readable from the async pump AFTER an interruption
  // has already re-pointed the section at a different backup. Written in an
  // effect, never during render, and read only from the pump.
  const viewRef = useRef(view)
  useEffect(() => { viewRef.current = view }, [view])

  // Loading a different export cancels a running pass and recomputes the target
  // set against the new backup. In-flight responses still complete INTO THE
  // STORE (the answer is paid for and stays useful); only their state writes are
  // generation-guarded.
  //
  // AN INTERRUPTION IS NOT SILENT. A pass that was actually running when the
  // backup changed resolves to `stopped` — "Every answer so far is kept" —
  // rather than to `partial`, which would read as though the sweep had simply
  // never got that far and would leave eight minutes of paid-for work looking
  // like it had vanished. Nothing paid for is lost either way: answers live in
  // the store, and the store is the only thing `deriveProjectsView` reads.
  // `stoppedRef` is set ONLY when a pass was in flight, so a first mount (and
  // the shell-pass -> real-data transition, which changes this identity once
  // with nothing running) still resolves to `never-run`.
  useEffect(() => {
    const interrupted = runningRef.current
    generationRef.current += 1
    cancelRef.current = true
    stoppedRef.current = interrupted
    failedRef.current = new Set()
    atCapacityRef.current = false
    // Deferred to a microtask so the effect body never calls setState
    // synchronously.
    void Promise.resolve().then(() => setFailedIds(new Set()))
  }, [checklists])

  /** Snapshot the ref-held session facts. Called ONLY from an effect, a handler
   *  or the async pump, never during render. */
  const restingNow = useCallback((v: ProjectsView): ProjectsStatus => restingStatus(v, {
    hasEbirdKey,
    online,
    atCapacity: atCapacityRef.current,
    failed: failedRef.current.size,
    stopped: stoppedRef.current,
  }), [hasEbirdKey, online])

  // The resting status is recomputed whenever its inputs change AND no pass is
  // running. A running pass owns the status through its ticker instead.
  useEffect(() => {
    if (runningRef.current) return
    const next = restingNow(view)
    void Promise.resolve().then(() => advance(next))
  }, [view, restingNow, advance])

  const runPass = useCallback(async (mode: 'pending' | 'all' | { only: ReadonlySet<string> }) => {
    if (runningRef.current) return
    if (hasEbirdKey === false) { advance({ kind: 'no-key' }); return }
    runningRef.current = true
    cancelRef.current = false
    stoppedRef.current = false
    const generation = generationRef.current
    const alive = () => generation === generationRef.current

    try {
      await loadSnapshot()
      // The pass captures the backup it started against. A mid-pass export swap
      // bumps the generation, which stops this loop and recomputes the target
      // set against the new one.
      const lists = checklists
      const targets = buildTargetIds(lists, getSnapshot(), Date.now(), PROJECTS_TTL_MS, mode)
      let v = deriveProjectsView(lists, getSnapshot())

      // THE PROGRESS PAIR IS A POSITION, NOT A RUNNING TOTAL OF WORK DONE, and
      // that distinction is the whole of this block. Seeding it with `v.checked`
      // and then adding one per network answer counts every target that ALREADY
      // had an entry twice: "Check again" forces a re-ask of the entire backup,
      // so on a completed store the readout climbed to 2x total and
      // `aria-valuenow` passed `aria-valuemax` — a progress bar reporting more
      // than its own maximum, which is an ARIA violation and visibly wrong. The
      // same double-count reached any past-TTL id re-asked in 'pending' mode.
      //
      // So the base is the answered checklists this pass is NOT about to re-ask,
      // and the increment is per TARGET ANSWERED. `base + answered <= total`
      // then holds by construction: the targets are a subset of the backup's
      // distinct ids, and the base counts only non-targets.
      //
      // "Answered" is read from the store rather than from `fromNetwork`,
      // because the store is exactly what `deriveProjectsView` counts. A stale
      // entry whose refresh FAILS stays answered (the TTL governs
      // re-consultation, not display) and a refused at-capacity answer is not,
      // so the readout and the tally beneath it cannot drift apart.
      const seed = getSnapshot()
      let base = v.checked
      for (const id of targets) if (seed.has(id)) base -= 1
      if (base < 0) base = 0
      let answeredHere = 0
      progressRef.current = { checked: base, total: v.total }

      if (!online) {
        advance({ kind: 'offline', checked: v.checked, total: v.total })
        return
      }

      // ── The single emission source ────────────────────────────────────────
      // ONE ticker, armed while the pass runs, reading the counters AND the
      // shared gate. Because the sentence, the bar and the readout all render
      // from the one object it emits, they cannot disagree on screen. The
      // emission is throttled AT THE SOURCE (never at the announcement), and
      // every emission constructs a FRESH object literal from primitives — a
      // frozen snapshot rather than a live accumulator, so a per-arrival
      // re-render cannot observe in-place mutations and update the rendered text
      // at arrival rate while the emission rate is nominally throttled.
      let lastKind: ProjectsStatus['kind'] | null = null
      const emit = (force: boolean): void => {
        if (!alive()) return
        const now = Date.now()
        const cooldownUntil = ebirdGateState().cooldownUntil
        const waiting = cooldownUntil > now
        const kind: ProjectsStatus['kind'] = waiting ? 'cooldown' : 'running'
        // A SHAPE CHANGE and the first definite figure always bypass the
        // throttle: the cooldown must announce the moment it opens, and the
        // opening figure must be shown before the first request goes out.
        const shapeChanged = kind !== lastKind
        if (!force && !shapeChanged && now - lastEmit < PROJECTS_ANNOUNCE_INTERVAL_MS) return
        lastEmit = now
        lastKind = kind
        const { checked, total } = progressRef.current
        advance(waiting
          // Rounded HERE, in the ticker, never in a render body or a memo.
          ? { kind: 'cooldown', checked, total, seconds: Math.max(1, Math.round((cooldownUntil - now) / 1000)) }
          : { kind: 'running', checked, total })
      }
      let lastEmit = 0

      emit(true)                                   // the first definite figure
      const ticker = setInterval(() => emit(false), PROJECTS_ANNOUNCE_INTERVAL_MS)

      try {
        for (const id of targets) {
          if (cancelRef.current || !alive()) break
          try {
            // gatedEbirdCall supplies every element of the pacing contract:
            // serialized starts at 150 ms, the ONE key-global cooldown honoring
            // a bounded Retry-After, and the bounded per-item retries. Nothing
            // is re-implemented here.
            const res = await dedupedFetchProjects(
              id,
              () => gatedEbirdCall(() => fetchProjects(id)),
              { force: mode === 'all' },
            )
            failedRef.current.delete(id)
            if (res.refused) atCapacityRef.current = true
          } catch (err) {
            // A checklist that still fails after its bounded retries is LEFT
            // UNANSWERED: nothing is written to the store, it does not count
            // toward `checked`, and it is counted in the failure figure. The
            // pass continues.
            failedRef.current.add(id)
            const classified = classifyLiveError(err)
            if (classified.kind === 'offline' || classified.kind === 'no-key') {
              // No point starting requests that must fail identically.
              cancelRef.current = true
              if (alive()) {
                const drained = deriveProjectsView(lists, getSnapshot())
                advance(classified.kind === 'no-key'
                  ? { kind: 'no-key' }
                  : { kind: 'offline', checked: drained.checked, total: drained.total })
              }
              return
            }
            void isRateLimitError(err)   // classified, not special-cased: the gate already paced it
          }
          if (getSnapshot().has(id)) answeredHere += 1
          progressRef.current = { checked: base + answeredHere, total: progressRef.current.total }
          emit(false)
        }
      } finally {
        clearInterval(ticker)
      }

      if (!alive()) {
        // Interrupted by a different backup. Publish against the CURRENT view
        // rather than returning: the generation effect's own resting pass has
        // already run and bailed (this pump still held `runningRef`), so a bare
        // return leaves the last `running` figure frozen on screen until some
        // unrelated re-render happens to dislodge it.
        advance(restingNow(viewRef.current))
        return
      }
      if (cancelRef.current) stoppedRef.current = true
      v = deriveProjectsView(lists, getSnapshot())
      // A terminal status is never throttled.
      advance(restingNow(v))
    } catch (err) {
      if (!alive()) { advance(restingNow(viewRef.current)); return }
      const v = deriveProjectsView(checklists, getSnapshot())
      const classified = classifyLiveError(err)
      advance(
        classified.kind === 'no-key' ? { kind: 'no-key' }
          : classified.kind === 'offline' ? { kind: 'offline', checked: v.checked, total: v.total }
            : { kind: 'error', checked: v.checked, total: v.total },
      )
    } finally {
      runningRef.current = false
      setFailedIds(new Set(failedRef.current))
    }
  }, [hasEbirdKey, online, checklists, advance, restingNow])

  const start = useCallback(() => {
    failedRef.current = new Set()
    void runPass('pending')
  }, [runPass])

  const stop = useCallback(() => { cancelRef.current = true }, [])

  const resume = useCallback(() => {
    // "Try again" over the unanswered ids only; otherwise everything still
    // pending. Both fall out of the same derivation: an answered id has an
    // entry and a failed one does not, so no request is ever issued for an
    // already-answered checklist.
    const failed = failedRef.current
    if (failed.size > 0) { void runPass({ only: new Set(failed) }); return }
    void runPass('pending')
  }, [runPass])

  const checkAgain = useCallback(() => {
    failedRef.current = new Set()
    void runPass('all')
  }, [runPass])

  // Remaining capacity is read here, off the render path's hot loop, so the
  // at-capacity state can be reached even before a pass runs.
  useEffect(() => {
    if (loaded && remainingCapacity() === 0) atCapacityRef.current = true
  }, [loaded, revision])

  return useMemo(
    () => ({
      // The pre-first-emission fallback. It renders no tally, so it cannot leak
      // an unearned figure while the store is still loading.
      status: state.status
        ?? (hasEbirdKey === false
          ? { kind: 'no-key' } as ProjectsStatus
          : { kind: 'never-run', total: view.total, skipped: view.skipped } as ProjectsStatus),
      statusSeq: state.seq,
      view,
      failedIds,
      start, stop, resume, checkAgain,
    }),
    [state.status, state.seq, hasEbirdKey, view, failedIds, start, stop, resume, checkAgain],
  )
}
