// The weather half of the Weather/tide Planner: the plan's spine (window, days,
// events, weather-strip cells, night spans) built from ONE One Call response
// (tide-weather-planner, schema section 3.3). Twin of
// backend/services/plan_weather.py; both are driven from
// weatherTidePlan.fixture.json and must produce byte-identical documents.
//
// Reached only through the dynamically imported desktop weather service, so it
// stays off the entry chunk (entryChunk.test.ts). Pure: `nowTs` is a parameter
// and nothing here reads a clock (schema section 13, item 6). Nothing here
// rounds a figure the UI prints (D8); the only rounding is the shipped
// `bankersRound` inside `buildWeatherPayload`, which is Predict's own.
//
// Every event's weather is `buildWeatherPayload(onecall, t, tz, lat).summary`,
// the shipped Predict function called as it stands, so every figure equals
// Predict's for the same fixture and moment by construction (FR-18, QA-17).

import { buildWeatherPayload, type OneCallResponse, type WeatherSummary } from './forecastSlice'
import { isFiniteFigure } from './weatherFormatter'
import { addDays, localClock, localDate, localMidnightTs, startOfLocalHour } from './tzClock'
import type { NightSpan, PlanCell, PlanDay, PlanWeather, SpineEvent, WeatherPlan } from './plan'

/** Caps applied at the parse boundary, each at least twice a conforming
 *  response's shape, so the stored document is bounded by its producer
 *  (schema section 6): One Call serves 8 daily and 48 hourly entries. */
export const PLAN_DAYS_MAX = 16
export const PLAN_HOURLY_MAX = 96
export const PLAN_EVENTS_MAX = 32
export const PLAN_CELLS_MAX = 112
export const PLAN_NIGHT_SPANS_MAX = 17

const HALF_HOUR = 1800

type Daily = NonNullable<OneCallResponse['daily']>[number]
type Hourly = NonNullable<OneCallResponse['hourly']>[number]

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null
// Aliased, not re-declared: `isFiniteFigure` is the one predicate on this
// runtime for "is this provider figure usable", and a second byte-identical
// copy here is a place for the two to drift apart later.
const finite = isFiniteFigure

/** A sunrise or sunset is PRESENT iff it is a finite number greater than zero:
 *  One Call reports polar days with 0, and a malformed body may omit the key.
 *  Never `dt` as a fallback (that is the copy block's heuristic, not an event). */
function presentTs(v: unknown): number | null {
  return finite(v) && v > 0 ? Math.floor(v) : null
}

/**
 * THE MALFORMED-FIGURE GUARDS THAT USED TO LIVE HERE ARE GONE, DELIBERATELY,
 * AND THIS FILE NO LONGER REFUSES ANYTHING ON ITS OWN (weather-at-malformed-parity).
 *
 * v1.0.29 added `assertNumericEntry`, a finite sweep in `toPlanWeather` and a
 * daily-`temp` check in `dailyReading`, because `buildWeatherPayload` carried a
 * non-numeric figure through as NaN where the Python twin raised. That delegate
 * now refuses it itself, on both runtimes, so the guards were re-argued rather
 * than kept silently (standing rule: never leave a guard whose necessity has
 * not been measured).
 *
 * MEASURED, not reasoned. Over the 203-shape shared matrix in
 * `weatherAtMalformed.fixture.json`, driving `buildWeatherPlan` with the guards
 * present and then removed produced **byte-identical output on every row**:
 * same verdict, same document, 0 of 203 differing, and matching
 * `build_weather_plan` on every row in both configurations.
 *
 * They were NOT redundant before this build, which is worth stating so this
 * reads as a consequence rather than as a claim they never earned their keep:
 * the plan pair diverged on 58 of these same 203 rows at v1.0.31, and what
 * closed it was the repair to the delegate, not anything here.
 *
 * And structurally, which is why the measurement is not merely lucky: every
 * `PlanWeather` in the document comes from `toPlanWeather`, which is reachable
 * only from `weatherAt`, which always calls `buildWeatherPayload`. That is the
 * load-bearing sentence, and it is sufficient on its own -- whatever slice the
 * delegate selects, it validates.
 *
 * `weatherAt` HAS THREE CALL SITES, not two, and the third is what shadows
 * three of the deleted branches. The two single-entry callers
 * (`hourlyReading`, `dailyReading`) hand the delegate a response containing
 * exactly the entry they are validating (`{hourly:[h]}` at `h.dt`,
 * `{daily:[d]}` at `d.dt`, both already past this file's finite-`dt` boundary
 * filter), so there the slice the delegate validates IS that entry. The third,
 * in the sunrise/sunset event loop below, passes the FULL response at an
 * arbitrary event instant and lets the delegate pick the tier -- which is why
 * `toPlanWeather`'s figure sweep, its daily sweep and `dailyReading`'s bounds
 * check never fired at all when the deleted guards were reinstated and
 * instrumented: the delegate had already refused, earlier, at that call. Three
 * unfired branches are the shadowing, not a hole; the field-by-field reading in
 * decision 2 covers them independently of the matrix.
 *
 * REVERSAL CONDITION: if a `PlanWeather` ever gets built from anything other
 * than a `buildWeatherPayload` summary, this file owes its own refusal again.
 * `weatherAtMalformedParity.test.ts` asserts the plan REFUSES the malformed
 * rows, so weakening the delegate turns that suite red here rather than only
 * on Predict.
 */
function toPlanWeather(s: WeatherSummary): PlanWeather {
  return {
    resolution: s.isDaily ? 'daily' : 'hourly',
    emoji: s.emoji,
    description: s.description,
    tempF: s.tempF,
    highF: s.isDaily ? s.highF : null,
    lowF: s.isDaily ? s.lowF : null,
    windDesc: s.windDesc,
    windDir: s.windDir,
    cloudsPct: s.cloudsPct,
    humidityPct: s.humidityPct,
    dewPointF: s.dewPointF,
  }
}

/** Predict's reading for instant `t` (FR-18): `pickForecastSlice` through the
 *  shipped payload builder, `current` collapsing to `hourly` (FR-17). */
function weatherAt(onecall: OneCallResponse, t: number, tz: string, lat: number): PlanWeather | null {
  const s = buildWeatherPayload(onecall, t, tz, lat).summary
  return s ? toPlanWeather(s) : null
}

/** The HOURLY entry's own reading, never the `current` block: the same slicer
 *  over a response that carries no `current`, so the nearest hourly entry is
 *  the entry itself (schema section 3.3, cells). */
function hourlyReading(h: Hourly, daily: Daily[], tz: string, lat: number): PlanWeather | null {
  return weatherAt({ hourly: [h], daily }, h.dt, tz, lat)
}

/** The DAILY entry's own reading, never an hourly neighbour's. The daily `temp`
 *  object and its `min`/`max` bounds are refused by the delegate (see the note
 *  on `toPlanWeather`), which is also where the Python twin's refusal lives. */
function dailyReading(d: Daily, tz: string, lat: number): PlanWeather | null {
  return weatherAt({ daily: [d] }, d.dt, tz, lat)
}

export type WeatherPlanResult =
  | { ok: true; plan: WeatherPlan }
  | { ok: false; reason: 'no-daily' }

/**
 * Build the weather half. `nowTs` is the fetch moment (integer epoch seconds)
 * on the fetching clock; `tz` is the app's own resolver's IANA name for the
 * place, as Predict uses; `lat`/`lng` are the validated inputs, echoed.
 */
export function buildWeatherPlan(
  onecall: OneCallResponse, nowTs: number, tz: string, lat: number, lng: number,
): WeatherPlanResult {
  const rawDaily = Array.isArray(onecall.daily) ? onecall.daily : []
  const dailyEntries = rawDaily
    .filter((d): d is Daily => isObj(d) && finite((d as Daily).dt))
    .slice()
    .sort((a, b) => a.dt - b.dt)

  // Days keyed on the local date of each daily entry; two entries mapping to
  // one date keep the first; ascending; capped.
  const days: PlanDay[] = []
  const dailyByDate: Daily[] = []
  for (const d of dailyEntries) {
    const date = localDate(d.dt, tz)
    if (days.length > 0 && days[days.length - 1].date === date) continue
    if (days.length >= PLAN_DAYS_MAX) break
    const startTs = localMidnightTs(date, tz)
    const endTs = localMidnightTs(addDays(date, 1), tz) - 1
    const sunriseT = presentTs(d.sunrise)
    const sunsetT = presentTs(d.sunset)
    days.push({
      date,
      startTs,
      endTs,
      sunrise: sunriseT === null ? null : { t: sunriseT, local: localClock(sunriseT, tz) },
      sunset: sunsetT === null ? null : { t: sunsetT, local: localClock(sunsetT, tz) },
    })
    dailyByDate.push(d)
  }
  if (days.length === 0) return { ok: false, reason: 'no-daily' }

  const axisStartTs = startOfLocalHour(nowTs, tz)
  const endTs = days[days.length - 1].endTs
  const window: WeatherPlan['window'] = {
    startTs: nowTs,
    startLocal: localClock(nowTs, tz),
    endTs,
    endLocal: localClock(endTs, tz),
    axisStartTs,
    axisStartLocal: localClock(axisStartTs, tz),
  }

  const rawHourly = Array.isArray(onecall.hourly) ? onecall.hourly : []
  const hourly = rawHourly
    .filter((h): h is Hourly => isObj(h) && finite((h as Hourly).dt))
    .slice()
    .sort((a, b) => a.dt - b.dt)
    .slice(0, PLAN_HOURLY_MAX)
  const hourlyEndTs = hourly.length > 0 ? hourly[hourly.length - 1].dt + HALF_HOUR : axisStartTs

  // Events: every present sunrise/sunset later than now, ascending, capped.
  const events: SpineEvent[] = []
  for (let i = 0; i < days.length; i += 1) {
    const day = days[i]
    for (const kind of ['sunrise', 'sunset'] as const) {
      const ev = day[kind]
      if (!ev || ev.t <= nowTs) continue
      // Predict's reading at the event; a day whose sunset the slicer cannot
      // place (a response shorter than its own daily entries) reads the day's
      // own entry rather than dropping the event, and that is stated here.
      const weather = weatherAt(onecall, ev.t, tz, lat) ?? dailyReading(dailyByDate[i], tz, lat)
      if (!weather) continue
      events.push({ kind, t: ev.t, local: ev.local, date: day.date, weather })
    }
  }
  events.sort((a, b) => (a.t - b.t) || (a.kind === b.kind ? 0 : a.kind === 'sunrise' ? -1 : 1))
  if (events.length > PLAN_EVENTS_MAX) events.length = PLAN_EVENTS_MAX

  // Cells: one per hourly entry whose nearest-hour interval intersects the
  // axis, clipped at the axis start, the hourly end and the window end; then one
  // daily cell per day whose end lies past the hourly coverage, starting where
  // that coverage ends, so no instant is covered twice.
  const cells: PlanCell[] = []
  for (const h of hourly) {
    const startTs = Math.max(axisStartTs, h.dt - HALF_HOUR)
    const cellEnd = Math.min(h.dt + HALF_HOUR, hourlyEndTs, endTs + 1) - 1
    if (cellEnd < startTs) continue
    const weather = hourlyReading(h, dailyByDate, tz, lat)
    if (!weather) continue
    cells.push({ resolution: 'hourly', startTs, endTs: cellEnd, local: localClock(h.dt, tz), weather })
  }
  for (let i = 0; i < days.length; i += 1) {
    const day = days[i]
    if (day.endTs <= hourlyEndTs) continue
    const startTs = Math.max(day.startTs, hourlyEndTs, axisStartTs)
    if (day.endTs < startTs) continue
    const weather = dailyReading(dailyByDate[i], tz, lat)
    if (!weather) continue
    // A full-day cell reads as the day's date at noon; the boundary day's
    // PARTIAL cell carries the clock it begins at, which is the one local
    // string the list's "from {time}" wording needs and which the UI must not
    // compute for itself.
    const local = startTs === day.startTs ? `${day.date} 12:00` : localClock(startTs, tz)
    cells.push({ resolution: 'daily', startTs, endTs: day.endTs, local, weather })
  }
  if (cells.length > PLAN_CELLS_MAX) cells.length = PLAN_CELLS_MAX

  // Night spans (FR-24), half-open [startTs, endTs), clipped to the axis.
  const spans: NightSpan[] = []
  const push = (a: number, b: number) => {
    const s = Math.max(a, axisStartTs)
    const e = Math.min(b, endTs)
    if (e > s && spans.length < PLAN_NIGHT_SPANS_MAX) spans.push({ startTs: s, endTs: e })
  }
  const first = days[0]
  if (first.sunrise && axisStartTs < first.sunrise.t) push(axisStartTs, first.sunrise.t)
  for (let i = 0; i < days.length; i += 1) {
    const s = days[i].sunset
    if (!s) continue // a missing sunset starts no night
    // A missing sunrise extends the running night to the next present one.
    let next: number | null = null
    for (let j = i + 1; j < days.length; j += 1) {
      const r = days[j].sunrise
      if (r) { next = r.t; break }
    }
    // Before the first event the segment is night when now is at or after
    // today's sunset, so today's span begins at the axis start rather than at
    // the sunset it has already passed.
    const start = i === 0 && nowTs >= s.t ? axisStartTs : s.t
    push(start, next ?? endTs)
  }

  return {
    ok: true,
    plan: {
      tz, lat, lng,
      fetchedAt: nowTs,
      window,
      hourlyEndTs,
      days,
      events,
      cells,
      nightSpans: spans,
    },
  }
}
