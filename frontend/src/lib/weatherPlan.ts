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
const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)

/** A sunrise or sunset is PRESENT iff it is a finite number greater than zero:
 *  One Call reports polar days with 0, and a malformed body may omit the key.
 *  Never `dt` as a fallback (that is the copy block's heuristic, not an event). */
function presentTs(v: unknown): number | null {
  return finite(v) && v > 0 ? Math.floor(v) : null
}

/**
 * A reading with a non-numeric figure is a malformed provider body, and the
 * Python twin raises on it (`round('warm')`, `None <= 0`); this side would
 * otherwise carry NaN into the document and print "NaN°F". Throwing here makes
 * the two transports agree: the service maps the throw to the provider-error
 * state (502), never a plan with a hole in it.
 */
function assertNumericEntry(e: Record<string, unknown>, temp: unknown): void {
  const nums = [temp, e.humidity, e.dew_point, e.wind_speed, e.wind_deg, e.clouds]
  for (const n of nums) if (!finite(n)) throw new TypeError('malformed provider entry: a figure is not a number')
  if (!Array.isArray(e.weather)) throw new TypeError('malformed provider entry: weather is not a list')
}

function toPlanWeather(s: WeatherSummary): PlanWeather {
  for (const n of [s.tempF, s.cloudsPct, s.humidityPct, s.dewPointF]) {
    if (!finite(n)) throw new TypeError('malformed provider entry: a figure is not a number')
  }
  if ((s.isDaily && (!finite(s.highF) || !finite(s.lowF)))) throw new TypeError('malformed provider entry: a daily figure is not a number')
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
  assertNumericEntry(h as unknown as Record<string, unknown>, h.temp)
  return weatherAt({ hourly: [h], daily }, h.dt, tz, lat)
}

/** The DAILY entry's own reading, never an hourly neighbour's. */
function dailyReading(d: Daily, tz: string, lat: number): PlanWeather | null {
  const temp = isObj(d.temp) ? d.temp : null
  if (!temp) throw new TypeError('malformed provider entry: daily temp is not an object')
  assertNumericEntry(d as unknown as Record<string, unknown>, temp.day)
  if (!finite(temp.min) || !finite(temp.max)) throw new TypeError('malformed provider entry: a daily figure is not a number')
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
