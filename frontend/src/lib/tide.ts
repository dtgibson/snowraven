// Parse NOAA CO-OPS responses into a single TideReading for a checklist's
// duration window. Pure + testable; the desktop tide service and the (mirrored)
// Python backend both produce this shape, which tideFormatter renders.
// See pipeline/weather-tides/schema.md.

import type { TideStation } from './tideStations'
import { clockText, placeEpochMin, placeInstant } from './tideInstant'

// NOAA times come back as local clock strings 'YYYY-MM-DD HH:MM' (time_zone=lst_ldt);
// they sort chronologically as strings, which is all the bracketing logic needs.
export interface ObservedPoint { t: string; v: number; q: string }
export interface PredPoint { t: string; v: number }
export interface HiLo { t: string; v: number; type: 'H' | 'L' }

export interface HiLoLabeled { kind: 'high' | 'low'; v: number; timeLocal: string }

export interface TideReading {
  levelMin: number
  levelMax: number
  source: 'observed' | 'predicted'
  trend: 'rising' | 'falling'
  turnedDuring: boolean
  prevHL: HiLoLabeled | null
  nextHL: HiLoLabeled | null
  station: TideStation
  distanceMi: number
}

/** The shape returned by GET /tide/{id} (web FastAPI and the desktop TS service
 *  both produce it). Shared so App.tsx and the comparer's Weather & Tide section
 *  decode the same contract. */
export interface TideResponse {
  status: 'ok' | 'too-far' | 'outside-us' | 'unavailable'
  formatted?: string
  body?: string
  station?: { id: string; name: string }
  distanceMi?: number
}

/** Structured tide fields the readable at-a-glance summary renders (Current /
 *  Predict). Mirrors the `reading` shape the backend's _serialize_reading emits. */
export interface TideReadingSummary {
  source: 'observed' | 'predicted'
  levelMin: number
  levelMax: number
  trend: 'rising' | 'falling'
  turnedDuring: boolean
  prevHL: HiLoLabeled | null
  nextHL: HiLoLabeled | null
  station: { id: string; name: string }
  distanceMi: number
}

/** The shape returned by GET /tide/at (web FastAPI + the desktop TS service). Like
 *  TideResponse but carries the structured `reading` for the summary. */
export interface TideAtResponse {
  status: 'ok' | 'too-far' | 'outside-us' | 'unavailable'
  formatted?: string
  body?: string
  station?: { id: string; name: string }
  distanceMi?: number
  reading?: TideReadingSummary
}

/** Serialize a TideReading into the wire `reading` shape (drops the station's
 *  lat/lng/obs to match the backend). */
export function summarizeReading(r: TideReading): TideReadingSummary {
  return {
    source: r.source,
    levelMin: r.levelMin,
    levelMax: r.levelMax,
    trend: r.trend,
    turnedDuring: r.turnedDuring,
    prevHL: r.prevHL,
    nextHL: r.nextHL,
    station: { id: r.station.id, name: r.station.name },
    distanceMi: r.distanceMi,
  }
}

/** A NOAA JSON body is an error when it has a top-level `error` (status is
 *  unreliable — NOAA returns 200 with an error body for no-data). */
export function isNoaaError(body: unknown): boolean {
  return !!body && typeof body === 'object' && 'error' in (body as Record<string, unknown>)
}

export function parseObserved(body: unknown): ObservedPoint[] {
  if (isNoaaError(body) || !body || typeof body !== 'object') return []
  const data = (body as { data?: unknown }).data
  if (!Array.isArray(data)) return []
  const out: ObservedPoint[] = []
  for (const d of data) {
    const t = (d as { t?: unknown }).t
    const v = parseFloat((d as { v?: string }).v ?? '')
    if (typeof t === 'string' && Number.isFinite(v)) out.push({ t, v, q: String((d as { q?: string }).q ?? '') })
  }
  return out
}

export function parsePredictions(body: unknown): PredPoint[] {
  if (isNoaaError(body) || !body || typeof body !== 'object') return []
  const preds = (body as { predictions?: unknown }).predictions
  if (!Array.isArray(preds)) return []
  const out: PredPoint[] = []
  for (const p of preds) {
    const t = (p as { t?: unknown }).t
    const v = parseFloat((p as { v?: string }).v ?? '')
    if (typeof t === 'string' && Number.isFinite(v)) out.push({ t, v })
  }
  return out
}

export function parseHiLo(body: unknown): HiLo[] {
  if (isNoaaError(body) || !body || typeof body !== 'object') return []
  const preds = (body as { predictions?: unknown }).predictions
  if (!Array.isArray(preds)) return []
  const out: HiLo[] = []
  for (const p of preds) {
    const t = (p as { t?: unknown }).t
    const v = parseFloat((p as { v?: string }).v ?? '')
    const type = (p as { type?: string }).type
    if (typeof t === 'string' && Number.isFinite(v) && (type === 'H' || type === 'L')) {
      out.push({ t, v, type })
    }
  }
  return out
}

function inWindow(t: string, start: string, end: string): boolean {
  return t >= start && t <= end
}

/**
 * Linear-interpolate the predicted level at time `t` between the bracketing
 * high/low events (a good approximation of the tide curve). Returns null if the
 * series doesn't bracket the time on at least one side.
 *
 * THE DIVISOR IS A BRACKETING PROBLEM, NOT A SENTINEL PROBLEM, and that is
 * measured rather than argued. This function brackets on the STRING (the series
 * sorts chronologically as text, which is all the bracketing needs) and divides
 * on the EPOCH, so the old `prev.t === next.t` guard did not guarantee a
 * non-zero divisor: two WELL-FORMED strings naming one instant —
 * `2026-05-01 10:09` and `2026-05-01T10:09`, both admitted by the shared `[ T]`
 * class — produced `Water level: -Infinity ft` here and raised
 * `ZeroDivisionError` on the Python twin, from the same body. Filtering
 * unplaceable points out upstream does nothing about them. So the equality
 * guard sits on the PLACED epoch, exactly as `interpAtEpoch` already does.
 *
 * Degrading to `prev.v` is the same answer the string-equality guard always
 * gave for a zero span, extended to the two other ways a fraction can fail to
 * exist. Both are reachable: `computeTideReading` filters the series so `prev`
 * and `next` are always placeable, but `t` is the WINDOW string, which
 * `getTide` derives from eBird's unvalidated `obsDt`.
 */
export function interpLevel(t: string, sortedHilo: HiLo[]): number | null {
  if (sortedHilo.length === 0) return null
  let prev: HiLo | null = null
  let next: HiLo | null = null
  for (const h of sortedHilo) {
    if (h.t <= t) prev = h
    if (h.t >= t) { next = h; break }
  }
  if (prev && next) {
    const at = placeEpochMin(t)
    const atPrev = placeEpochMin(prev.t)
    const atNext = placeEpochMin(next.t)
    if (at === null || atPrev === null || atNext === null || atNext === atPrev) return prev.v
    const f = (at - atPrev) / (atNext - atPrev)
    return prev.v + (next.v - prev.v) * f
  }
  return (prev ?? next)?.v ?? null
}

/**
 * Build the TideReading for window [start,end] (local 'YYYY-MM-DD HH:MM' strings).
 * Prefers observed levels in the window; falls back to predicted. Returns null
 * only when there is no usable level data at all.
 */
export function computeTideReading(
  start: string,
  end: string,
  observed: ObservedPoint[],
  predicted: PredPoint[],
  hilo: HiLo[],
  station: TideStation,
  distanceMi: number,
): TideReading | null {
  // A `t` that cannot be placed on the epoch axis means that point is MISSING,
  // so it is dropped BEFORE any level is derived from it — exactly as the
  // sibling Planner (`lib/tidePlan.ts`) already does, which is the strongest
  // available argument that "missing" is the right answer here too. It is never
  // anchored at 1970, never contributes an interpolation weight, never ties for
  // nearest, and never renders a clock. THIS FILTER IS THIS SIDE'S PLACEMENT
  // GUARD: removing it turns `an unplaceable point is dropped` in
  // tideUnreadableParity.test.ts red here while the backend suite stays green
  // (v1.0.20).
  const sortedHilo = hilo.filter(h => placeInstant(h.t) !== null)
    .sort((a, b) => (a.t < b.t ? -1 : a.t > b.t ? 1 : 0))

  // Level samples over the window, in priority order:
  //  1. observed gauge points (Observed)
  //  2. continuous predictions (Predicted — reference/harmonic stations)
  //  3. interpolated from the high/low curve (Predicted — subordinate stations,
  //     which serve only hilo). Sample at start, end, and any extreme inside.
  const obsIn = observed.filter(p => inWindow(p.t, start, end))
  const predIn = predicted.filter(p => inWindow(p.t, start, end))
  let sorted: Array<{ t: string; v: number }>
  let source: 'observed' | 'predicted'
  let startV: number, endV: number
  if (obsIn.length > 0) {
    sorted = [...obsIn].sort((a, b) => (a.t < b.t ? -1 : 1)); source = 'observed'
    startV = sorted[0].v; endV = sorted[sorted.length - 1].v
  } else if (predIn.length > 0) {
    sorted = [...predIn].sort((a, b) => (a.t < b.t ? -1 : 1)); source = 'predicted'
    startV = sorted[0].v; endV = sorted[sorted.length - 1].v
  } else {
    const s = interpLevel(start, sortedHilo)
    const e = interpLevel(end, sortedHilo)
    if (s === null && e === null) {
      // No window samples and no curve to interpolate: nearest single point.
      // Nearest to WHAT: both the candidates and the window's own start have to
      // be placeable for "nearest" to mean anything. Under the sentinel every
      // unplaceable candidate tied at distance-to-1970 and the reduce handed
      // back the EARLIEST pooled point, presented as the reading for now.
      // `unavailable` is the honest state both routes already have, and the
      // strict `<` still keeps the first on a tie, which is what the Python
      // twin's `min` does.
      const all = observed.length > 0
        ? observed.map(p => ({ t: p.t, v: p.v, src: 'observed' as const }))
        : predicted.map(p => ({ t: p.t, v: p.v, src: 'predicted' as const }))
      const startAt = placeEpochMin(start)
      const rankable = startAt === null ? [] : all.flatMap(p => {
        const at = placeEpochMin(p.t)
        return at === null ? [] : [{ ...p, at }]
      })
      if (rankable.length === 0) return null
      const nearest = rankable.reduce((best, p) =>
        Math.abs(p.at - (startAt as number)) < Math.abs(best.at - (startAt as number)) ? p : best)
      sorted = [{ t: nearest.t, v: nearest.v }]; source = nearest.src
      startV = endV = nearest.v
    } else {
      source = 'predicted'
      startV = s ?? (e as number); endV = e ?? (s as number)
      // Include extremes that fall inside the window so the range reflects a turn.
      const inside = sortedHilo.filter(h => inWindow(h.t, start, end)).map(h => ({ t: h.t, v: h.v }))
      sorted = [{ t: start, v: startV }, ...inside, { t: end, v: endV }].sort((a, b) => (a.t < b.t ? -1 : 1))
    }
  }

  const levelMin = Math.min(...sorted.map(p => p.v))
  const levelMax = Math.max(...sorted.map(p => p.v))

  const prev = [...sortedHilo].reverse().find(h => h.t <= start) ?? null
  const next = sortedHilo.find(h => h.t >= end) ?? null
  const turnedDuring = sortedHilo.some(h => inWindow(h.t, start, end))

  // Trend: net start->end across the window; if flat, infer from the brackets
  // (heading toward a high = rising).
  let trend: 'rising' | 'falling'
  const delta = endV - startV
  if (delta > 0) trend = 'rising'
  else if (delta < 0) trend = 'falling'
  else if (next) trend = next.type === 'H' ? 'rising' : 'falling'
  else if (prev) trend = prev.type === 'H' ? 'falling' : 'rising'
  else trend = 'rising'

  const label = (h: HiLo | null): HiLoLabeled | null =>
    h ? { kind: h.type === 'H' ? 'high' : 'low', v: h.v, timeLocal: clockTime(h.t) } : null

  return {
    levelMin, levelMax, source, trend, turnedDuring,
    prevHL: label(prev), nextHL: label(next),
    station, distanceMi,
  }
}

/**
 * 'YYYY-MM-DD HH:MM' (24h) -> '7:42am' (matches the weather block's time style).
 * Twin of `_clock`.
 *
 * Formats from the PLACED components; it no longer re-scans the string. The old
 * UNANCHORED `t.match(/[ T](\d{2}):(\d{2})/)` read `3:07pm` off
 * `2026/05/01 15:07` and rendered `2026-13-40 25:61` as `1:61pm` — sixty-one
 * minutes past one, into a public checklist comment — and its `\d` was the
 * character-class half of the same twinned guard.
 *
 * The passthrough is this total function's boundary, not a second guard:
 * `computeTideReading` labels only points that survived its placement filter,
 * so an unplaceable string cannot reach the copy block through it. The deletion
 * coverage for that filter is `an unplaceable point is dropped` in
 * tideUnreadableParity.test.ts, and `no dangling clock reaches the copy block`
 * is what fails if the property is ever re-opened here.
 */
export function clockTime(t: string): string {
  const at = placeInstant(t)
  return at === null ? t : clockText(at)
}

/** Round to 1 decimal for display (NOAA values come with 3 decimals). */
export function ft(v: number): string {
  return (Math.round(v * 10) / 10).toFixed(1)
}

// ── Local-time window helpers (checklist local clock; NOAA queried lst_ldt) ─────
// The checklist's obs_dt is the observer's local clock time. We query NOAA in
// lst_ldt (station local) and compare/display in that clock. For a nearby station
// the two clocks match; a far override may skew by the tz difference (acceptable
// for an explicit override). All arithmetic here is pure calendar math.

/** Ensure 'YYYY-MM-DD HH:MM' (a date-only obs_dt gets 00:00). */
export function normalizeObsDt(obsDt: string): string {
  const s = obsDt.trim()
  return s.length === 10 ? `${s} 00:00` : s.slice(0, 16)
}

/** Shift a 'YYYY-MM-DD HH:MM' local string by `hours` (may be fractional/negative). */
export function shiftLocal(local: string, hours: number): string {
  const m = normalizeObsDt(local).match(/^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})/)
  if (!m) return local
  const [, y, mo, d, h, mi] = m.map(Number) as unknown as number[]
  const ms = Date.UTC(y, mo - 1, d, h, mi) + hours * 3600_000
  const dt = new Date(ms)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${dt.getUTCFullYear()}-${p(dt.getUTCMonth() + 1)}-${p(dt.getUTCDate())} ${p(dt.getUTCHours())}:${p(dt.getUTCMinutes())}`
}

/** 'YYYY-MM-DD HH:MM' -> NOAA begin/end_date 'YYYYMMDD HH:MM'. */
export function toNoaaDate(local: string): string {
  const n = normalizeObsDt(local)
  return `${n.slice(0, 4)}${n.slice(5, 7)}${n.slice(8, 10)} ${n.slice(11, 16)}`
}
