// The tide half of the Weather/tide Planner: the 30-minute curve and the
// turning points over a span derived from `now` alone (tide-weather-planner,
// schema sections 3.4 and 4.6). Twin of backend/services/plan_tide.py; both are
// driven from weatherTidePlan.fixture.json and must produce byte-identical
// documents.
//
// Reached only through the dynamically imported desktop tide service, so it
// stays off the entry chunk. Pure: `nowTs` is a parameter and nothing here
// reads a clock. Both NOAA bodies pass through the shipped linear parsers
// unchanged; the only new step is the GMT clock string to epoch conversion at
// the parse boundary, through the shipped `epochMin` (schema section 9). The
// caps are applied BEFORE any per-sample work, so a body larger than the
// request could produce bounds the work rather than the work being bounded by
// trust in the provider.

import { epochMin, parseHiLo, parsePredictions } from './tide'
import { addDays, localClock, localDate, localMidnightTs, startOfLocalHour } from './tzClock'
import { interpAtEpoch } from './plan'
import type { TidePlanOk, TidePlanResponse, TideSample, TurningPoint } from './plan'

/** The tide span reaches the end of the eighth calendar day after today: nine
 *  calendar days, one more than One Call's eight daily entries can reach. */
export const PLAN_TIDE_DAYS_AHEAD = 8
/** Continuous points kept after sorting (17 days at six minutes; the request
 *  asks for nine). */
export const PLAN_CONTINUOUS_MAX = 4096
/** High/low points kept after sorting (an eleven-day widened span holds ~44). */
export const PLAN_HILO_MAX = 64
/** Curve samples kept: nine 24-hour days at 30 minutes is 432, and a fall-back
 *  day in the span makes it 434, so the cap sits above the largest conforming
 *  shape rather than at it (the schema's 432 assumed 24-hour days). */
export const PLAN_CURVE_MAX = 448

const HALF_HOUR = 1800
const DAY = 86400

export interface TideSpan {
  axisStartTs: number
  tideEndTs: number
  hiloStartTs: number
  hiloEndTs: number
}

/**
 * The span the plan fetches, from the clock and the location alone (D2): the
 * start of the current local hour through the end of the eighth calendar day
 * after today, with the high/low request widened a day each side (Predict's own
 * widening) so every event has a bracket on both sides for any US tide regime.
 */
export function planTideRange(nowTs: number, tz: string): TideSpan {
  const axisStartTs = startOfLocalHour(nowTs, tz)
  const today = localDate(nowTs, tz)
  const tideEndTs = localMidnightTs(addDays(today, PLAN_TIDE_DAYS_AHEAD + 1), tz) - 1
  return { axisStartTs, tideEndTs, hiloStartTs: axisStartTs - DAY, hiloEndTs: tideEndTs + DAY }
}

/** NOAA `begin_date` / `end_date` for a GMT request: 'YYYYMMDD HH:MM' in UTC. */
export function toNoaaGmtDate(ts: number): string {
  const d = new Date(ts * 1000)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`
}

/** A GMT clock string from a range body as an integer epoch second; 0 for a
 *  non-match (the caller drops it). `epochMin` is UTC calendar math already. */
function gmtEpoch(t: string): number {
  return epochMin(t) * 60
}

/**
 * Build the tide half from the two range bodies. `station` and `distanceMi`
 * come from the bundled station list (a build-time asset), never from a
 * provider response.
 */
export function buildTidePlan(
  predBody: unknown, hiloBody: unknown,
  station: { id: string; name: string }, distanceMi: number,
  tz: string, span: TideSpan,
): TidePlanResponse {
  const continuous: Array<{ t: number; v: number }> = []
  for (const p of parsePredictions(predBody)) {
    const t = gmtEpoch(p.t)
    if (t > 0) continuous.push({ t, v: p.v })
  }
  continuous.sort((a, b) => a.t - b.t)
  if (continuous.length > PLAN_CONTINUOUS_MAX) continuous.length = PLAN_CONTINUOUS_MAX

  const turningPoints: TurningPoint[] = []
  for (const h of parseHiLo(hiloBody)) {
    const t = gmtEpoch(h.t)
    if (t > 0 && t >= span.hiloStartTs && t <= span.hiloEndTs) {
      turningPoints.push({ kind: h.type === 'H' ? 'high' : 'low', t, v: h.v, local: localClock(t, tz) })
    }
  }
  turningPoints.sort((a, b) => a.t - b.t)
  if (turningPoints.length > PLAN_HILO_MAX) turningPoints.length = PLAN_HILO_MAX

  if (continuous.length === 0 && turningPoints.length === 0) return { status: 'unavailable' }

  const range = { startTs: span.axisStartTs, endTs: span.tideEndTs }
  let hasContinuousInRange = false
  const curve: TideSample[] = []
  let i = 0
  const firstT = Math.ceil(range.startTs / HALF_HOUR) * HALF_HOUR
  for (let t = firstT; t <= range.endTs && curve.length < PLAN_CURVE_MAX; t += HALF_HOUR) {
    while (i < continuous.length && continuous[i].t < t) i += 1
    if (i < continuous.length && continuous[i].t === t) {
      curve.push({ t, v: continuous[i].v, hilo: false })
    } else {
      const v = interpAtEpoch(t, turningPoints)
      if (v !== null) curve.push({ t, v, hilo: true })
    }
  }
  for (const p of continuous) {
    if (p.t >= range.startTs && p.t <= range.endTs) { hasContinuousInRange = true; break }
  }

  const ok: TidePlanOk = {
    status: 'ok',
    source: 'predicted',
    station: { id: station.id, name: station.name },
    distanceMi,
    tz,
    continuous: hasContinuousInRange,
    range,
    curve,
    turningPoints,
  }
  return ok
}
