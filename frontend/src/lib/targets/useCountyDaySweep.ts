// The live 30-day sweep controller (targets-tab, schema.md section 3.4;
// FR-41 to FR-47, NFR-01, NFR-07).
//
// ONE ENFORCEMENT POINT PER REQUEST. `/map/county-day-obs` is in
// EBIRD_GATED_PATHS, so `transport.get` already applies the shared gate's
// spaced start, its key-global 429 cooldown and the bounded retries. This
// controller therefore does NOT wrap `gatedEbirdCall` (that would be "both"),
// and it never changes gate policy. What it owns is the PASS-SCALE layer, the
// projects-sweep precedent (`useChecklistProjects`): it reads the gate's
// monotonic wave counter by differencing over its own pass, widens its own
// spacing per observed wave (sleeping the FULL widened interval, since the
// gate's floor elapses inside the sleep), and pauses itself after
// SWEEP_PAUSE_WAVES waves rather than leaning on eBird's limiter.
//
// COST (NFR-01). Seeded from the durable day cache first: a complete past day
// is final, so a first visit costs 30 calls, a same-day revisit costs at most
// one (today, re-asked at most once per session because it is still
// accruing), and the next day costs one or two. The days are asked NEWEST
// FIRST, so the last-report date settles early.
//
// NO KEY, NO REQUEST (FR-43, NFR-07). Without a key the pass issues nothing.
// Offline it issues nothing and shows whatever the cache holds.
//
// THE STATUS IS A THROTTLED, FROZEN SNAPSHOT (ui.md, v0.5.87 / v0.5.92). The
// rows fill in as each day lands, but the progress sentence and bar, which
// sit in a live region, are emitted from one ticker at most every
// SWEEP_ANNOUNCE_INTERVAL_MS, as a fresh object of primitives. A shape change
// (running to cooldown and back) and the first figure always go out at once.
//
// Clock reads live in the effect and the ticker, never in render.

import { useCallback, useEffect, useRef, useState } from 'react'
import { transport } from '../transport'
import { classifyLiveError } from '../offlineMessage'
import { ebirdGateState } from '../ebirdGate'
import { ACTIVITY_START_SPACING_MS, SWEEP_PAUSE_WAVES, sweepSpacingMs } from '../rateLimit'
import { dayObsKey, dedupedFetch, loadAll, type DayObsEntry } from '../countyDayObsCache'
import type { DayObsPayload } from '../countyDayObsReduce'
import { lastNDates, SWEEP_DAYS } from './targetsDates'
import { isChecked, type DayState } from './targetsLive'

/** The live region's emission bound: at most one progress sentence per 1.5 s. */
export const SWEEP_ANNOUNCE_INTERVAL_MS = 1500

export type SweepStatus =
  | { kind: 'idle' }
  | { kind: 'no-key' }
  | { kind: 'offline'; from: number | null }
  | { kind: 'sweeping'; checked: number; total: number }
  | { kind: 'cooldown'; seconds: number; checked: number; total: number }
  | { kind: 'paused'; checked: number; total: number }
  | { kind: 'unanswered'; checked: number; total: number; failed: number }
  | { kind: 'complete'; at: number; total: number }

export interface SweepView {
  /** The 30 local dates, newest first. */
  dates: readonly string[]
  /** The instant the pass took as "now" (the window rule's clock). */
  nowMs: number
  days: ReadonlyMap<string, DayState>
  status: SweepStatus
  /** Any checked day exists and the key is not missing: the live data is usable. */
  hasData: boolean
  /** Re-ask the days that failed (FR-46), or resume a paused pass. */
  retry: () => void
}

// The session's "now", for the very first render only; every pass replaces it
// with its own reading, taken in the effect.
const SESSION_NOW_MS = Date.now()

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function countChecked(dates: readonly string[], days: ReadonlyMap<string, DayState>): number {
  let n = 0
  for (const d of dates) if (isChecked(days.get(d))) n += 1
  return n
}

function newestFetchedAt(dates: readonly string[], days: ReadonlyMap<string, DayState>): number | null {
  let best: number | null = null
  for (const d of dates) {
    const s = days.get(d)
    if (isChecked(s) && (best === null || s.fetchedAt > best)) best = s.fetchedAt
  }
  return best
}

interface ViewState {
  region: string | null
  dates: readonly string[]
  nowMs: number
  days: ReadonlyMap<string, DayState>
  status: SweepStatus
}

const EMPTY_DAYS: ReadonlyMap<string, DayState> = new Map()

export function useCountyDaySweep(regionCode: string | null, hasEbirdKey: boolean | null, online: boolean): SweepView {
  const [view, setView] = useState<ViewState>(() => ({
    region: null, dates: lastNDates(SESSION_NOW_MS, SWEEP_DAYS), nowMs: SESSION_NOW_MS, days: EMPTY_DAYS, status: { kind: 'idle' },
  }))
  const [nonce, setNonce] = useState(0)
  const retry = useCallback(() => setNonce(n => n + 1), [])
  // Today's entry is re-asked at most once per session per county (FR-44).
  const refetchedToday = useRef<Set<string>>(new Set())
  const generation = useRef(0)

  useEffect(() => {
    if (!regionCode) return
    const gen = ++generation.current
    const alive = () => gen === generation.current
    let ticker: ReturnType<typeof setInterval> | null = null

    void (async () => {
      const nowMs = Date.now()
      const dates = lastNDates(nowMs, SWEEP_DAYS)
      const today = dates[0]
      let cached: ReadonlyMap<string, DayObsEntry> = new Map()
      try { cached = await loadAll() } catch { /* an unreadable store is an empty one */ }
      if (!alive()) return
      const days = new Map<string, DayState>()
      for (const d of dates) days.set(d, cached.get(dayObsKey(regionCode, d)) ?? 'unchecked')

      let status: SweepStatus = { kind: 'idle' }
      const publish = () => {
        if (alive()) setView({ region: regionCode, dates, nowMs, days: new Map(days), status })
      }
      const setStatus = (next: SweepStatus) => { status = next; publish() }

      if (hasEbirdKey === null) { setStatus({ kind: 'idle' }); return }
      if (hasEbirdKey === false) { setStatus({ kind: 'no-key' }); return }
      if (!online) { setStatus({ kind: 'offline', from: newestFetchedAt(dates, days) }); return }

      const todayKey = dayObsKey(regionCode, today)
      const targets = dates.filter(d => {
        const s = days.get(d)
        if (!isChecked(s)) return true
        if (s.complete) return false
        // An incomplete entry: today (re-asked once per session) or a day that
        // was today when it was fetched (re-asked, and complete from then on).
        return d !== today || !refetchedToday.current.has(todayKey)
      })
      if (targets.length === 0) {
        setStatus({ kind: 'complete', at: newestFetchedAt(dates, days) ?? nowMs, total: dates.length })
        return
      }

      const total = dates.length
      const wavesAtStart = ebirdGateState().waveCount
      let lastEmit = 0
      let lastKind: string | null = null
      const emit = (force: boolean) => {
        if (!alive()) return
        const now = Date.now()
        const cooldownUntil = ebirdGateState().cooldownUntil
        const waiting = cooldownUntil > now
        const kind = waiting ? 'cooldown' : 'sweeping'
        if (!force && kind === lastKind && now - lastEmit < SWEEP_ANNOUNCE_INTERVAL_MS) return
        lastEmit = now
        lastKind = kind
        const checked = countChecked(dates, days)
        status = waiting
          ? { kind: 'cooldown', seconds: Math.max(1, Math.round((cooldownUntil - now) / 1000)), checked, total }
          : { kind: 'sweeping', checked, total }
        publish()
      }

      emit(true)
      ticker = setInterval(() => emit(false), 500)
      let failed = 0
      let paused = false
      try {
        for (const d of targets) {
          if (!alive()) return
          const waves = ebirdGateState().waveCount - wavesAtStart
          if (waves >= SWEEP_PAUSE_WAVES) { paused = true; break }
          if (waves > 0) {
            await sleep(sweepSpacingMs(waves, ACTIVITY_START_SPACING_MS))
            if (!alive()) return
          }
          try {
            const res = await dedupedFetch(
              regionCode, d,
              () => transport.get<DayObsPayload>('/map/county-day-obs', { regionCode, date: d }),
            )
            if (!alive()) return
            days.set(d, res.entry)
            if (d === today) refetchedToday.current.add(todayKey)
            publish()   // the rows fill in as each day lands (the status stays throttled)
          } catch (err) {
            if (!alive()) return
            const kind = classifyLiveError(err).kind
            if (kind === 'offline') {
              setStatus({ kind: 'offline', from: newestFetchedAt(dates, days) })
              return
            }
            if (kind === 'no-key' || (err as { status?: unknown } | null)?.status === 401) {
              setStatus({ kind: 'no-key' })
              return
            }
            // A day that still fails after the gate's bounded retries is left
            // unchecked and is never cached. A cached entry for it (today's,
            // re-asked) stays on screen: it is still that day's data.
            if (!isChecked(days.get(d))) { days.set(d, 'failed'); failed += 1 }
          }
          emit(false)
        }
      } finally {
        if (ticker !== null) { clearInterval(ticker); ticker = null }
      }
      if (!alive()) return
      const checked = countChecked(dates, days)
      if (paused) setStatus({ kind: 'paused', checked, total })
      else if (failed > 0) setStatus({ kind: 'unanswered', checked, total, failed })
      else setStatus({ kind: 'complete', at: Date.now(), total })
    })()

    return () => {
      generation.current += 1
      if (ticker !== null) { clearInterval(ticker); ticker = null }
    }
  }, [regionCode, hasEbirdKey, online, nonce])

  const mine = regionCode !== null && view.region === regionCode
  const days = mine ? view.days : EMPTY_DAYS
  const status: SweepStatus = mine ? view.status : { kind: 'idle' }
  let anyChecked = false
  for (const d of view.dates) { if (isChecked(days.get(d))) { anyChecked = true; break } }
  return {
    dates: view.dates,
    nowMs: view.nowMs,
    days,
    status,
    hasData: anyChecked && hasEbirdKey !== false,
    retry,
  }
}
