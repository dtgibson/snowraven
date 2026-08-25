// The mode-3 activity controller (color-coded-hotspots): owns the per-hotspot
// community-activity state for the Map Explorer's Recent activity color mode
// and exposes the render-safe HotspotActivityView the readings consume.
// Modeled on useCountyCompleteness, with one structural difference: the work
// unit is a RESULT-SET PASS, not a viewport event stream — activity is scoped
// to the search's result set (FR-11), so pan/zoom NEVER enqueues anything
// (QA-10: no viewport subscription exists in this hook; structural, not
// disciplined — mapBounds is read once at pass start for in-view-first
// ordering and can never trigger a pass).
//
// Responsibilities:
//   • seed from the persistent 6h cache (fresh AND stale color pins before any
//     network activity — FR-12/FR-15a/b);
//   • one bounded pass per result set: pool of 4, in-view first then nearest
//     the search centre, capped at 200 with cache hits exempt (FR-19,
//     schema.md decision 8);
//   • request starts PACED (lib/rateLimit.ts): a global minimum spacing
//     between starts, plus ONE shared key-global cooldown on any eBird 429
//     (honoring Retry-After, else a bounded-exponential default with jitter),
//     with bounded per-hotspot retries — a 429 is a brief slowdown, never a
//     lost hotspot (the pre-deploy pacing revision; tuning recorded in
//     pipeline/color-coded-hotspots/decisions.md);
//   • classified degradation into exactly offline / no-key / error (FR-14),
//     with retry() re-asking only the unanswered remainder;
//   • generation-guarded state writes so a superseded pass (mode switch,
//     view switch, new result set) can never recolor the active mode (FR-17);
//   • progress emission THROTTLED at the emitter (v0.5.87 rule): the sentence,
//     the progress bar, and the live region all read one emitted status, and
//     the first definite figure + every terminal state emit unthrottled.
//
// Purity: countFor/status are render-safe state reads — every Date.now() lives
// in a promise handler, an effect, or the module-level session constant.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { transport, TransportError } from './transport'
import { classifyLiveError, GENERIC_ERROR_MESSAGE, OFFLINE_MESSAGE_SHORT } from './offlineMessage'
import { EBIRD_NO_KEY_MESSAGE } from './useCountyCompleteness'
import { distanceMiles } from './mapExplorerFormat'
import { HOTSPOT_ACTIVITY_LOC_ID_RE, type HotspotActivityPayload } from './hotspotActivity'
import {
  ACTIVITY_FETCH_CAP, ACTIVITY_FETCH_CONCURRENCY,
  type ActivityAnswer, type ActivityStatusFields,
} from './hotspotColorModes'
import * as activityCache from './hotspotActivityCache'
// Namespace import so ACTIVITY_START_SPACING_MS is read as a LIVE binding at
// each pump (it is a mutable test seam, the HOTSPOT_ACTIVITY_MAX_ENTRIES
// pattern); the pure helpers ride the same namespace for one import site.
import * as rateLimit from './rateLimit'
// The cooldown/spacing STATE is the shared key-global gate (ebirdGate.ts,
// the v0.5.93 extension): this controller keeps its own pump enforcement,
// but a 429 recorded here slows the single-shot map lookups and vice versa.
import {
  ebirdGateState, ebirdWaitMs, noteEbirdStart, noteEbirdRateLimit, noteEbirdSuccess,
} from './ebirdGate'
import type { HotspotPin } from './mapExplorerTypes'
import type { MarkerBounds } from './markersInView'

export { ACTIVITY_FETCH_CAP, ACTIVITY_FETCH_CONCURRENCY }

/** Progress-emission throttle (the v0.5.87 throttle-the-EMISSION rule): per-
 *  arrival updates coalesce to at most one status emission per interval; the
 *  first definite figure and every terminal state bypass it. */
export const ACTIVITY_PROGRESS_EMIT_MS = 400

// Session-stable "now": entries whose fetchedAt predates this session read as
// fromCache for the popup's as-of wording (the county SESSION_NOW_MS pattern).
const SESSION_NOW_MS = Date.now()

export interface HotspotActivityStatus extends ActivityStatusFields {
  /** Advances once per emission — the sequence key for the live region's
   *  message child (each announcement is a real node replacement). */
  seq: number
}

export interface HotspotActivityView {
  /** Render-safe. null = unanswered (not asked / in flight / failed / beyond
   *  the cap). */
  countFor(locId: string): ActivityAnswer | null
  /** Panel-level status: FR-12's loading line, FR-14's classified error,
   *  FR-19's cap sentence — all derived from this one emitted object. */
  status: HotspotActivityStatus
  /** FR-14: re-asks every failed/unanswered locId without re-running the
   *  hotspot search (a fresh pass; cache hits cost nothing). */
  retry(): void
}

export interface UseHotspotActivityArgs {
  /** mode 3 selected AND hotspots view AND result set non-empty. */
  active: boolean
  /** The UNFILTERED result set (public pins only are fetched; personal are
   *  skipped — FR-21). */
  pins: HotspotPin[]
  /** For in-view-first ordering at pass start (FR-19). Read at pass start
   *  only — never a pass trigger. */
  mapBounds: MarkerBounds | null
  /** The search centre for proximity ordering (FR-19); null → skip that
   *  tiebreak. */
  searchCenter: { lat: number; lng: number } | null
  hasEbirdKey: boolean | null
}

interface ActivityError { kind: 'offline' | 'no-key' | 'error'; message: string }

function classifyActivityError(err: unknown): ActivityError {
  const classified = classifyLiveError(err, { offlineMessage: OFFLINE_MESSAGE_SHORT })
  if (classified.kind === 'offline') return { kind: 'offline', message: classified.message }
  const e = err as { status?: number; detail?: string }
  const status = err instanceof TransportError ? err.status : e.status
  if (status === 401 || classified.kind === 'no-key') {
    return { kind: 'no-key', message: EBIRD_NO_KEY_MESSAGE }
  }
  const detail = err instanceof TransportError ? err.detail : (e.detail ?? (err instanceof Error ? err.message : undefined))
  return { kind: 'error', message: detail || GENERIC_ERROR_MESSAGE }
}

const IDLE_STATUS: HotspotActivityStatus = {
  phase: 'idle', answered: 0, target: 0, cappedCount: 0,
  cacheServed: 0, liveFetched: 0, failedCount: 0,
  latestCachedAt: null, latestAnswerAt: null, rateLimited: false, error: null, seq: 0,
}

function pinInBounds(pin: HotspotPin, b: MarkerBounds): boolean {
  return pin.lng >= b[0] && pin.lat >= b[1] && pin.lng <= b[2] && pin.lat <= b[3]
}

export function useHotspotActivity({ active, pins, mapBounds, searchCenter, hasEbirdKey }: UseHotspotActivityArgs): HotspotActivityView {
  const [answers, setAnswers] = useState<ReadonlyMap<string, ActivityAnswer>>(() => new Map())
  const [status, setStatus] = useState<HotspotActivityStatus>(IDLE_STATUS)
  const [retrySeq, setRetrySeq] = useState(0)

  const genRef = useRef(0)
  const queueRef = useRef<string[]>([])
  const loadingRef = useRef<Set<string>>(new Set())
  const activeFetchesRef = useRef(0)
  const progressRef = useRef<HotspotActivityStatus>({ ...IDLE_STATUS })
  const emitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastEmitRef = useRef(0)

  // ── 429 pacing state (the pre-deploy revision; policy in lib/rateLimit.ts) ──
  // The cooldown is a property of the KEY, not the pass — and as of v0.5.93
  // not even of this hook: cooldownUntil / wave / lastStart live in the
  // shared module-scoped gate (ebirdGate.ts), so they survive pass restarts
  // AND are shared with the transport-gated single-shot lookups. Only the
  // per-hotspot retry counts are pass-local.
  /** 429 retry count per locId, this pass. */
  const rateLimitAttemptsRef = useRef<Map<string, number>>(new Map())
  /** The single scheduled pump wakeup (spacing or cooldown), so a paused pass
   *  always resumes itself — never a silent stall. */
  const pumpTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // mapBounds/searchCenter ride refs so they are READ at pass start without
  // being pass triggers — the QA-10 zero-request-on-pan invariant is
  // structural (these effects run before the pass effect, declaration order).
  const boundsRef = useRef(mapBounds)
  useEffect(() => { boundsRef.current = mapBounds }, [mapBounds])
  const centerRef = useRef(searchCenter)
  useEffect(() => { centerRef.current = searchCenter }, [searchCenter])

  // ── Throttled emission (one source of truth for sentence + bar + region) ────
  function flushEmit(): void {
    lastEmitRef.current = Date.now()
    const p = progressRef.current
    p.seq += 1
    // Emit an immutable SNAPSHOT, never the accumulator itself (QA-11): the
    // promise handlers mutate progressRef.current in place between emissions,
    // and every per-arrival setAnswers re-render re-reads the held status —
    // so handing the accumulator to setStatus updated the rendered sentence
    // at ARRIVAL rate while seq advanced at the 400ms throttle (announcement
    // spam, the exact class the v0.5.87 rule prevents). The freeze makes any
    // future mutation of an emitted object throw (strict mode) in dev and
    // test rather than ship; the regression test pins both properties.
    setStatus(Object.freeze({ ...p }))
  }

  function emitProgress(force: boolean): void {
    const now = Date.now()
    if (!force && now - lastEmitRef.current < ACTIVITY_PROGRESS_EMIT_MS) {
      if (!emitTimerRef.current) {
        emitTimerRef.current = setTimeout(() => {
          emitTimerRef.current = null
          flushEmit()
        }, ACTIVITY_PROGRESS_EMIT_MS - (now - lastEmitRef.current))
      }
      return
    }
    if (emitTimerRef.current) { clearTimeout(emitTimerRef.current); emitTimerRef.current = null }
    flushEmit()
  }

  useEffect(() => () => {
    if (emitTimerRef.current) clearTimeout(emitTimerRef.current)
    if (pumpTimerRef.current) clearTimeout(pumpTimerRef.current)
  }, [])

  // ── Pool + pump (ref-driven per-render closures, the county hook pattern) ───
  function launch(gen: number, locId: string): void {
    loadingRef.current.add(locId)
    activeFetchesRef.current += 1
    activityCache
      .dedupedFetch(locId, () => transport.get<HotspotActivityPayload>('/map/hotspot-activity', { locId }))
      .then(res => {
        // In-flight responses complete into the CACHE (useful later) even when
        // superseded; state writes are generation-guarded so they never touch
        // the now-active mode's coloring (FR-17, QA-18).
        if (gen !== genRef.current) return
        const answer: ActivityAnswer = {
          count7: res.entry.count7,
          count30: res.entry.count30,
          fetchedAt: res.entry.fetchedAt,
          fromCache: res.entry.fetchedAt < SESSION_NOW_MS,
        }
        setAnswers(prev => {
          const next = new Map(prev)
          next.set(locId, answer)
          return next
        })
        const p = progressRef.current
        p.answered += 1
        if (res.fromNetwork) {
          p.liveFetched += 1
        } else {
          p.cacheServed += 1
          p.latestCachedAt = Math.max(p.latestCachedAt ?? 0, res.entry.fetchedAt)
        }
        p.latestAnswerAt = Math.max(p.latestAnswerAt ?? 0, res.entry.fetchedAt)
        // A success arriving AFTER the cooldown ended closes the slowed
        // regime (resets the wave ladder, clears the visible flag). A success
        // still inside the window (a request that started before the 429
        // landed) proves nothing about the limiter — leave both alone.
        let resumed = false
        const successNow = Date.now()
        noteEbirdSuccess(successNow)
        if (successNow >= ebirdGateState().cooldownUntil) {
          if (p.rateLimited) {
            p.rateLimited = false
            resumed = true
          }
        }
        // Force on the flip: the sentence changes shape (the v0.5.87 rule).
        emitProgress(resumed)
      })
      .catch(err => {
        if (rateLimit.isRateLimitError(err)) {
          // The cooldown is registered even for a superseded generation
          // (shared gate state only, nothing rendered): the 429 is a fact
          // about the KEY, and a new pass — and every gated single-shot
          // lookup — must pace too.
          noteEbirdRateLimit(err, Date.now(), Math.random())
          if (gen !== genRef.current) return
          const attempts = (rateLimitAttemptsRef.current.get(locId) ?? 0) + 1
          rateLimitAttemptsRef.current.set(locId, attempts)
          const p = progressRef.current
          if (attempts <= rateLimit.ACTIVITY_RATE_LIMIT_RETRIES) {
            // Not failed — waiting. Back of the queue, behind the untried
            // ones; the finally's pump sees the cooldown and schedules the
            // resume, so the pass picks up exactly where it left off.
            queueRef.current.push(locId)
          } else {
            // Bounded retries exhausted: the existing unanswered state and
            // the existing Retry control cover it (never cached — the
            // dedupedFetch error path caches nothing).
            p.failedCount += 1
            if (!p.error) p.error = classifyActivityError(err)
          }
          const flipped = !p.rateLimited
          p.rateLimited = true
          emitProgress(flipped)
          return
        }
        if (gen !== genRef.current) return
        const e = classifyActivityError(err)
        const p = progressRef.current
        p.failedCount += 1
        if (!p.error) p.error = e
        // A no-key or offline classification drains the queue — every further
        // request must fail identically (FR-14).
        if (e.kind === 'offline' || e.kind === 'no-key') queueRef.current = []
        emitProgress(false)
      })
      .finally(() => {
        loadingRef.current.delete(locId)
        activeFetchesRef.current -= 1
        if (gen !== genRef.current) return
        if (queueRef.current.length === 0 && activeFetchesRef.current === 0) {
          progressRef.current.phase = 'done'
          emitProgress(true)
        } else {
          pump(gen)
        }
      })
  }

  function schedulePump(gen: number, waitMs: number): void {
    if (pumpTimerRef.current) clearTimeout(pumpTimerRef.current)
    pumpTimerRef.current = setTimeout(() => {
      pumpTimerRef.current = null
      pump(gen)
    }, waitMs)
  }

  function pump(gen: number): void {
    if (gen !== genRef.current) return
    while (activeFetchesRef.current < ACTIVITY_FETCH_CONCURRENCY && queueRef.current.length > 0) {
      // Two gates on every request START: the shared key-global 429 cooldown
      // (one pause for the whole queue, never per-slot) and the global start
      // spacing (never two starts closer than ACTIVITY_START_SPACING_MS — a
      // live binding; the mutable test seam). Both read the SHARED gate
      // (ebirdGate.ts), so a 429 from a single-shot map lookup pauses this
      // pass too. Wait for whichever ends later, then resume exactly where
      // the pass left off.
      const now = Date.now()
      const wait = ebirdWaitMs(now)
      if (wait > 0) {
        schedulePump(gen, wait)
        return
      }
      const locId = queueRef.current.shift()!
      if (loadingRef.current.has(locId)) continue
      noteEbirdStart(now)
      launch(gen, locId)
    }
  }

  // ── The result-set pass ─────────────────────────────────────────────────────
  // Runs on activation, on a `pins` identity change while active, on a key
  // arriving, and on retry(). Deactivation bumps the generation and stops the
  // pump before its next launch (FR-17). Inactive / empty set → zero requests
  // in any form (FR-07/FR-11).
  useEffect(() => {
    genRef.current += 1
    queueRef.current = []
    if (pumpTimerRef.current) { clearTimeout(pumpTimerRef.current); pumpTimerRef.current = null }
    // Per-pass retry budgets reset; the key-global cooldown deliberately
    // does NOT (a new search during a cooldown paces too).
    rateLimitAttemptsRef.current = new Map()
    if (!active || pins.length === 0) return
    const gen = genRef.current
    let cancelled = false
    void (async () => {
      const cached = await activityCache.loadAll()
      if (cancelled || gen !== genRef.current) return
      const now = Date.now()

      // Enumerate the pass: public pins with a guard-shaped locId (FR-21).
      const pinById = new Map<string, HotspotPin>()
      for (const p of pins) {
        if (p.kind === 'personal') continue
        if (!HOTSPOT_ACTIVITY_LOC_ID_RE.test(p.locId)) continue
        if (!pinById.has(p.locId)) pinById.set(p.locId, p)
      }

      // Seed: cached answers (fresh AND stale) color immediately (FR-12/15b);
      // fresh ones are answered at zero cost (cache hits never consume the
      // cap); stale ones join the fetch queue for a refresh.
      const seeded = new Map<string, ActivityAnswer>()
      const remainder: string[] = []
      let fresh = 0
      let latestCachedAt: number | null = null
      let latestAnswerAt: number | null = null
      for (const [locId] of pinById) {
        const e = cached.get(locId)
        if (e) {
          seeded.set(locId, {
            count7: e.count7, count30: e.count30, fetchedAt: e.fetchedAt,
            fromCache: e.fetchedAt < SESSION_NOW_MS,
          })
          latestAnswerAt = Math.max(latestAnswerAt ?? 0, e.fetchedAt)
        }
        if (e && now - e.fetchedAt < activityCache.HOTSPOT_ACTIVITY_TTL_MS) {
          fresh += 1
          latestCachedAt = Math.max(latestCachedAt ?? 0, e.fetchedAt)
        } else {
          remainder.push(locId)
        }
      }
      if (seeded.size > 0) {
        setAnswers(prev => {
          const next = new Map(prev)
          for (const [k, v] of seeded) next.set(k, v)
          return next
        })
      }

      // Order: in-view first (bounds at pass start), then nearest the centre.
      const bounds = boundsRef.current
      const center = centerRef.current
      const inView = (locId: string): number =>
        bounds && pinInBounds(pinById.get(locId)!, bounds) ? 0 : 1
      const dist = (locId: string): number => {
        if (!center) return 0
        const p = pinById.get(locId)!
        return distanceMiles(center.lat, center.lng, p.lat, p.lng)
      }
      remainder.sort((a, b) => inView(a) - inView(b) || dist(a) - dist(b))
      const toFetch = remainder.slice(0, ACTIVITY_FETCH_CAP)
      const cappedCount = remainder.length - toFetch.length

      progressRef.current = {
        phase: toFetch.length > 0 && hasEbirdKey !== false ? 'running' : 'done',
        answered: fresh,
        target: fresh + toFetch.length,
        cappedCount,
        cacheServed: fresh,
        liveFetched: 0,
        failedCount: 0,
        latestCachedAt,
        latestAnswerAt,
        // A pass starting inside a live key-global cooldown is already going
        // slower — say so from its first emission (cleared by the first
        // post-cooldown answer). The read is the SHARED gate, so a cooldown
        // opened by a single-shot map lookup shows here too.
        rateLimited: Date.now() < ebirdGateState().cooldownUntil,
        // FR-14's no-key state without spending a single request that must
        // fail identically; retry() re-checks after a key is added.
        error: toFetch.length > 0 && hasEbirdKey === false
          ? { kind: 'no-key', message: EBIRD_NO_KEY_MESSAGE }
          : null,
        seq: progressRef.current.seq,
      }
      emitProgress(true)
      if (toFetch.length === 0 || hasEbirdKey === false) return
      queueRef.current = toFetch
      pump(gen)
    })()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- pump/launch/emit are ref-driven per-render closures; mapBounds/searchCenter deliberately ride refs (never pass triggers, QA-10)
  }, [active, pins, hasEbirdKey, retrySeq])

  const retry = useCallback(() => {
    setRetrySeq(s => s + 1)
  }, [])

  const countFor = useCallback(
    (locId: string): ActivityAnswer | null => answers.get(locId) ?? null,
    [answers],
  )

  return useMemo<HotspotActivityView>(
    () => ({ countFor, status, retry }),
    [countFor, status, retry],
  )
}
