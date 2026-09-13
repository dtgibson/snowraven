// The Weather/tide Planner's document contract and its one client-side merge
// (tide-weather-planner, schema section 3). Entry-safe and dependency-free on
// purpose: WeatherForecastPanel is a static import in App.tsx, so this module
// rides the entry chunk and must reach no transport, no storage, no chart
// library and no builder (entryChunk.test.ts polices it). The two halves are
// produced by the twinned builders (lib/weatherPlan.ts + backend
// services/plan_weather.py; lib/tidePlan.ts + services/plan_tide.py), which are
// reached only through the dynamically imported Tauri services or the FastAPI
// routes.
//
// One axis: every `t` is an integer epoch second (EpochS). Every local clock
// string was computed once, by the composer, in the location's timezone, and is
// display-only -- nothing here compares, sorts or brackets by a string. Nothing
// here rounds (D8): the UI prints `ft()` to one decimal.
//
// `composePlan` treats both halves as untrusted documents: a replayed half was
// stored by a seam with no per-entry validation, so every array access is
// guarded, every string and number the UI prints is type-checked at the
// boundary (`asWeather`, `asEvents`, `asCells`, `asDays`), and a malformed half
// or entry yields `tide: null` / an absent moment / a dropped entry rather than
// a throw. The guard is verified by rendering the real components over
// corrupted shapes (PlanResult.test.tsx), not by reading it.

export type EpochS = number
export type LocalClock = string
export type LocalDate = string
export type Resolution = 'hourly' | 'daily'

export interface PlanWeather {
  resolution: Resolution
  emoji: string
  description: string
  tempF: number
  highF: number | null
  lowF: number | null
  windDesc: string
  windDir: string
  cloudsPct: number
  humidityPct: number
  dewPointF: number
}

export interface PlanWindow {
  startTs: EpochS
  startLocal: LocalClock
  endTs: EpochS
  endLocal: LocalClock
  axisStartTs: EpochS
  axisStartLocal: LocalClock
}

export interface PlanDay {
  date: LocalDate
  startTs: EpochS
  endTs: EpochS
  sunrise: { t: EpochS; local: LocalClock } | null
  sunset: { t: EpochS; local: LocalClock } | null
}

export interface SpineEvent {
  kind: 'sunrise' | 'sunset'
  t: EpochS
  local: LocalClock
  date: LocalDate
  weather: PlanWeather
}

export interface PlanCell {
  resolution: Resolution
  startTs: EpochS
  endTs: EpochS
  local: LocalClock
  weather: PlanWeather
}

export interface NightSpan { startTs: EpochS; endTs: EpochS }

export interface WeatherPlan {
  tz: string
  lat: number
  lng: number
  fetchedAt: EpochS
  window: PlanWindow
  hourlyEndTs: EpochS
  days: PlanDay[]
  events: SpineEvent[]
  cells: PlanCell[]
  nightSpans: NightSpan[]
}

export interface TideSample { t: EpochS; v: number; hilo: boolean }
export interface TurningPoint { kind: 'high' | 'low'; t: EpochS; v: number; local: LocalClock }

export interface TidePlanOk {
  status: 'ok'
  source: 'predicted'
  station: { id: string; name: string }
  distanceMi: number
  tz: string
  continuous: boolean
  range: { startTs: EpochS; endTs: EpochS }
  curve: TideSample[]
  turningPoints: TurningPoint[]
}

export type TidePlanResponse =
  | { status: 'unavailable' }
  | { status: 'too-far' | 'outside-us'; station: { id: string; name: string }; distanceMi: number }
  | TidePlanOk

export interface Bracket { kind: 'high' | 'low'; heightFt: number; t: EpochS; local: LocalClock }

export interface EventTide {
  heightFt: number | null
  heightSource: 'continuous' | 'interpolated' | null
  trend: 'rising' | 'falling' | null
  prev: Bracket | null
  next: Bracket | null
}

export type PlanEvent = SpineEvent & { tide: EventTide | null }

export type PlanTide =
  | {
      status: 'ok'; source: 'predicted'; station: { id: string; name: string }; distanceMi: number; continuous: boolean
      /** Trimmed to [window.axisStartTs, window.endTs]: what the chart draws. */
      curve: TideSample[]
      /** Trimmed to the same: the markers and the listed turning points. */
      turningPoints: TurningPoint[]
      /** The half's turning points UNTRIMMED (0..PLAN_HILO_MAX, ascending): what
       *  every event was bracketed with, and what the readout's tide at a picked
       *  instant brackets with (plan-sun-moon-readout, schema A / FR-08), so a
       *  pick at an event's minute is the same function over the same inputs.
       *  In-memory only; never stored. */
      bracketPoints: TurningPoint[]
    }
  | { status: 'too-far' | 'outside-us'; station: { id: string; name: string }; distanceMi: number }
  | { status: 'unavailable' }
  | null

export interface Plan {
  tz: string
  lat: number
  lng: number
  fetchedAt: EpochS
  window: PlanWindow
  hourlyEndTs: EpochS
  days: PlanDay[]
  events: PlanEvent[]
  cells: PlanCell[]
  nightSpans: NightSpan[]
  tide: PlanTide
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)

/**
 * The predicted level at instant `t` on the high/low curve: the epoch-domain
 * twin of `interpLevel`'s rule (lib/tide.ts). prev = latest turning point at or
 * before `t`, next = earliest at or after; linear on the time fraction; equal
 * times give prev's value; one side missing gives that side's value; no turning
 * points at all gives null. `points` must be ascending by `t`. The operation
 * order `a + (b - a) * f` with `f` as one division is shared byte for byte with
 * the Python twin so the two composers agree to the last bit.
 */
export function interpAtEpoch(t: number, points: ReadonlyArray<{ t: number; v: number }>): number | null {
  if (points.length === 0) return null
  let prev: { t: number; v: number } | null = null
  let next: { t: number; v: number } | null = null
  for (let i = 0; i < points.length; i += 1) {
    const p = points[i]
    if (p.t <= t) prev = p
    if (p.t >= t) { next = p; break }
  }
  if (prev && next) {
    if (prev.t === next.t) return prev.v
    const f = (t - prev.t) / (next.t - prev.t)
    return prev.v + (next.v - prev.v) * f
  }
  return (prev ?? next)?.v ?? null
}

/**
 * The tide reading for one event (schema section 3.5). Comparisons use the
 * event's MINUTE because NOAA's clock is minute-resolved and FR-15 says a
 * turning point at the event's own minute is the next bracket sharing its time.
 * `trend` is by the kind of `next` (FR-14; deliberately NOT computeTideReading's
 * window-delta rule, D5).
 */
export function tideAtEvent(
  t: number,
  curve: ReadonlyArray<TideSample>,
  turningPoints: ReadonlyArray<TurningPoint>,
): EventTide {
  const m = t - (t % 60)
  let prev: TurningPoint | null = null
  let next: TurningPoint | null = null
  for (let i = 0; i < turningPoints.length; i += 1) {
    const p = turningPoints[i]
    if (p.t < m) prev = p
    else { next = p; break }
  }
  let a: TideSample | null = null
  let b: TideSample | null = null
  for (let i = 0; i < curve.length; i += 1) {
    const s = curve[i]
    if (s.t <= m) a = s
    if (s.t >= m) { b = s; break }
  }
  let heightFt: number | null
  let heightSource: EventTide['heightSource']
  if (a && b && !a.hilo && !b.hilo && b.t - a.t <= 1800) {
    heightFt = a.t === b.t ? a.v : a.v + (b.v - a.v) * ((m - a.t) / (b.t - a.t))
    heightSource = 'continuous'
  } else {
    heightFt = interpAtEpoch(m, turningPoints)
    heightSource = heightFt === null ? null : 'interpolated'
  }
  const bracket = (p: TurningPoint | null): Bracket | null =>
    p ? { kind: p.kind, heightFt: p.v, t: p.t, local: p.local } : null
  return {
    heightFt,
    heightSource,
    trend: next ? (next.kind === 'high' ? 'rising' : 'falling') : null,
    prev: bracket(prev),
    next: bracket(next),
  }
}

function asSamples(v: unknown): TideSample[] {
  if (!Array.isArray(v)) return []
  const out: TideSample[] = []
  for (const s of v) {
    if (isObj(s) && isNum(s.t) && isNum(s.v)) out.push({ t: s.t, v: s.v, hilo: s.hilo === true })
  }
  return out
}

function asTurningPoints(v: unknown): TurningPoint[] {
  if (!Array.isArray(v)) return []
  const out: TurningPoint[] = []
  for (const p of v) {
    if (isObj(p) && isNum(p.t) && isNum(p.v) && (p.kind === 'high' || p.kind === 'low')) {
      out.push({ kind: p.kind, t: p.t, v: p.v, local: isStr(p.local) ? p.local : '' })
    }
  }
  return out
}

function asStation(v: unknown): { id: string; name: string } | null {
  if (!isObj(v) || typeof v.id !== 'string' || typeof v.name !== 'string') return null
  return { id: v.id, name: v.name }
}

const isStr = (v: unknown): v is string => typeof v === 'string'
const isNumOrNull = (v: unknown): v is number | null => v === null || isNum(v)

/** A weather reading with every field the list and the strip print, typed as
 *  they print it; anything else is dropped rather than rendered. A replayed
 *  half arrives from a store with no per-entry validation, so an object where
 *  a string should be would otherwise reach React as a child and throw. */
function asWeather(v: unknown): PlanWeather | null {
  if (!isObj(v)) return null
  if (v.resolution !== 'hourly' && v.resolution !== 'daily') return null
  if (!isStr(v.emoji) || !isStr(v.description) || !isStr(v.windDesc) || !isStr(v.windDir)) return null
  if (!isNum(v.tempF) || !isNum(v.cloudsPct) || !isNum(v.humidityPct) || !isNum(v.dewPointF)) return null
  if (!isNumOrNull(v.highF) || !isNumOrNull(v.lowF)) return null
  return {
    resolution: v.resolution, emoji: v.emoji, description: v.description, tempF: v.tempF,
    highF: v.highF, lowF: v.lowF, windDesc: v.windDesc, windDir: v.windDir,
    cloudsPct: v.cloudsPct, humidityPct: v.humidityPct, dewPointF: v.dewPointF,
  }
}

function asEvents(v: unknown): SpineEvent[] {
  if (!Array.isArray(v)) return []
  const out: SpineEvent[] = []
  for (const e of v) {
    if (!isObj(e) || (e.kind !== 'sunrise' && e.kind !== 'sunset') || !isNum(e.t) || !isStr(e.local) || !isStr(e.date)) continue
    const weather = asWeather(e.weather)
    if (!weather) continue
    out.push({ kind: e.kind, t: e.t, local: e.local, date: e.date, weather })
  }
  return out
}

function asMoment(v: unknown): { t: number; local: string } | null {
  return isObj(v) && isNum(v.t) && isStr(v.local) ? { t: v.t, local: v.local } : null
}

function asDays(v: unknown): PlanDay[] {
  if (!Array.isArray(v)) return []
  const out: PlanDay[] = []
  for (const d of v) {
    if (!isObj(d) || !isStr(d.date) || !isNum(d.startTs) || !isNum(d.endTs)) continue
    // A malformed sunrise or sunset reads as absent, the day's own honest state.
    out.push({ date: d.date, startTs: d.startTs, endTs: d.endTs, sunrise: asMoment(d.sunrise), sunset: asMoment(d.sunset) })
  }
  return out
}

function asCells(v: unknown): PlanCell[] {
  if (!Array.isArray(v)) return []
  const out: PlanCell[] = []
  for (const c of v) {
    if (!isObj(c) || (c.resolution !== 'hourly' && c.resolution !== 'daily') || !isNum(c.startTs) || !isNum(c.endTs) || !isStr(c.local)) continue
    const weather = asWeather(c.weather)
    if (!weather) continue
    out.push({ resolution: c.resolution, startTs: c.startTs, endTs: c.endTs, local: c.local, weather })
  }
  return out
}

function asNightSpans(v: unknown): NightSpan[] {
  if (!Array.isArray(v)) return []
  return v.filter((s): s is NightSpan => isObj(s) && isNum(s.startTs) && isNum(s.endTs))
}

/**
 * Join the two halves into the document the UI renders. The same function runs
 * for a live fetch, a replayed pair and a forced override (D1), so the per-event
 * tide rule has exactly one implementation.
 *
 * Returns null only when the weather half is unusable (no window); the panel
 * then shows Predict's provider-error words rather than a partial plan.
 */
export function composePlan(weather: unknown, tide: unknown): Plan | null {
  if (!isObj(weather) || !isObj(weather.window)) return null
  const w = weather.window
  if (!isNum(w.startTs) || !isNum(w.endTs) || !isNum(w.axisStartTs)) return null
  const window: PlanWindow = {
    startTs: w.startTs,
    startLocal: typeof w.startLocal === 'string' ? w.startLocal : '',
    endTs: w.endTs,
    endLocal: typeof w.endLocal === 'string' ? w.endLocal : '',
    axisStartTs: w.axisStartTs,
    axisStartLocal: typeof w.axisStartLocal === 'string' ? w.axisStartLocal : '',
  }
  const tz = typeof weather.tz === 'string' ? weather.tz : ''
  const days = asDays(weather.days)
  // An event belongs to a day; one whose day was dropped as malformed is
  // dropped with it, so the chart and the list (which groups by day) agree.
  const dayDates = new Set(days.map(d => d.date))
  const spine = asEvents(weather.events).filter(e => dayDates.has(e.date))

  let planTide: PlanTide = null
  let curve: TideSample[] = []
  let turningPoints: TurningPoint[] = []
  if (isObj(tide)) {
    const station = asStation(tide.station)
    if (tide.status === 'ok' && station) {
      const allCurve = asSamples(tide.curve)
      const allTps = asTurningPoints(tide.turningPoints)
      curve = allCurve.filter(s => s.t >= window.axisStartTs && s.t <= window.endTs)
      turningPoints = allTps
      planTide = {
        status: 'ok',
        source: 'predicted',
        station,
        distanceMi: isNum(tide.distanceMi) ? tide.distanceMi : 0,
        continuous: tide.continuous === true,
        curve,
        turningPoints: allTps.filter(p => p.t >= window.axisStartTs && p.t <= window.endTs),
        bracketPoints: allTps,
      }
      // Both halves come from one transport and one resolver, so a zone mismatch
      // is a bug, not a state: assert in development, and let the weather's win.
      if (import.meta.env.DEV && typeof tide.tz === 'string' && tz && tide.tz !== tz) {
        console.warn(`composePlan: weather tz ${tz} and tide tz ${tide.tz} differ`)
      }
    } else if ((tide.status === 'too-far' || tide.status === 'outside-us') && station) {
      planTide = { status: tide.status, station, distanceMi: isNum(tide.distanceMi) ? tide.distanceMi : 0 }
    } else if (tide.status === 'unavailable') {
      planTide = { status: 'unavailable' }
    }
  }

  const withTide = planTide !== null && planTide.status === 'ok'
  const events: PlanEvent[] = spine.map(e => ({
    ...e,
    tide: withTide ? tideAtEvent(e.t, curve, turningPoints) : null,
  }))

  return {
    tz,
    lat: isNum(weather.lat) ? weather.lat : 0,
    lng: isNum(weather.lng) ? weather.lng : 0,
    fetchedAt: isNum(weather.fetchedAt) ? weather.fetchedAt : window.startTs,
    window,
    hourlyEndTs: isNum(weather.hourlyEndTs) ? weather.hourlyEndTs : window.axisStartTs,
    days,
    events,
    cells: asCells(weather.cells),
    nightSpans: asNightSpans(weather.nightSpans),
    tide: planTide,
  }
}
