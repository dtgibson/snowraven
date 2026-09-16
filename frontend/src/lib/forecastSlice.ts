// Forecast-tier selection + the readable summary for the Current/Predict lookups
// (desktop twin of backend/services/forecast.py). Pure; no I/O.
//
// One base One Call 3.0 response (current + hourly + daily) is sliced to the right
// resolution for a target moment — current / hourly (≤~48h) / daily (~48h–8d) /
// out-of-range (>~8d) — then adapted into the timemachine {data:[hour]} shape the
// existing formatWeather already consumes, so the copy block stays byte-identical
// to the checklist lookup. The summary carries the structured fields the readable
// at-a-glance view renders.

import {
  formatWeather, conditionEmoji, windDescription, cardinal, formatLocalTime,
  moonPhaseEmoji, bankersRound, assertHourReading, isFiniteFigure,
  type HourlyResponse,
} from './weatherFormatter'

type HourData = HourlyResponse['data'][number]

interface OWMHour {
  dt: number
  temp: number
  humidity: number
  dew_point: number
  wind_speed: number
  wind_deg: number
  clouds: number
  weather: Array<{ id: number; description: string }>
  sunrise?: number
  sunset?: number
}

interface OWMDaily {
  dt: number
  temp: { day: number; min: number; max: number }
  humidity: number
  dew_point: number
  wind_speed: number
  wind_deg: number
  clouds: number
  weather: Array<{ id: number; description: string }>
  sunrise: number
  sunset: number
}

export interface OneCallResponse {
  current?: OWMHour
  hourly?: OWMHour[]
  daily?: OWMDaily[]
}

export type ForecastResolution = 'current' | 'hourly' | 'daily' | 'out-of-range'

export interface WeatherSummary {
  emoji: string
  moon: string
  description: string
  isDaily: boolean
  tempF: number
  highF: number | null
  lowF: number | null
  windDesc: string
  windDir: string
  cloudsPct: number
  humidityPct: number
  dewPointF: number
  sunrise: string
  sunset: string
  isNight: boolean
}

export interface WeatherAtResponse {
  resolution: ForecastResolution
  formatted: string | null
  summary: WeatherSummary | null
  tz: string
}

const NOW_SLACK = 3600     // within ±1h of "now" → current
const HOURLY_SLACK = 1800  // 30 min past the last hourly point still counts
const DAILY_SLACK = 43200  // daily dt is local noon; +12h = end of that day

type Slice =
  | { resolution: 'current' | 'hourly'; slice: OWMHour }
  | { resolution: 'daily'; slice: OWMDaily }
  | { resolution: 'out-of-range'; slice: null }

/**
 * The entries of one tier that can take part in the search at all: an object
 * carrying a usable `dt`. Twin of `_usable` in backend/services/forecast.py,
 * and the same boundary filter `buildWeatherPlan` has applied since v1.0.29.
 *
 * Two accidents of the two languages made this asymmetric, both measured:
 *
 *  - The HORIZON. `targetTs <= null + HOURLY_SLACK` is false here, so an
 *    hourly array whose entries carried `"dt": null` fell through to the daily
 *    tier and answered a real daily reading; Python's `.get("dt", 0)` returned
 *    the present-but-null value and `None + 1800` RAISED, so the same body was
 *    a 502 on web/Pi. This side also threw where the last entry was `null` and
 *    coerced where it was `5`, which nothing intended.
 *  - The NEAREST-ENTRY SEARCH. A single malformed `dt` anywhere in the 48-hour
 *    array — by far the likeliest real provider hiccup — raised out of Python's
 *    `min` key function, while `Math.abs(NaN) < x` is false so the reduce here
 *    skipped it and answered with a valid neighbour. Except when the malformed
 *    entry was the reduce's SEED, where it was never displaced and got selected.
 *
 * Filtering resolves all of it in one place and in the direction that keeps the
 * answer: a body with one bad hour still answers at the requested hour from a
 * usable entry, and an entry that IS selected is still refused by
 * `assertHourReading` if any other figure of it is malformed. A conforming body
 * has every entry usable, so the filter is the identity and the selected slice
 * is unchanged, byte for byte.
 */
function usableEntries<T extends { dt: number }>(raw: unknown): T[] {
  if (!Array.isArray(raw)) return []
  return raw.filter((e): e is T =>
    typeof e === 'object' && e !== null && isFiniteFigure((e as { dt?: unknown }).dt))
}

/**
 * PRESENCE, not truthiness -- and this is the twin of `is not None` on the
 * Python side rather than of `if current` (weather-at-malformed-parity, QA
 * finding F-1).
 *
 * The two languages disagree about truthiness in TWO DIRECTIONS AT ONCE, so no
 * single truthiness spelling can be a twin of the other's. `{}` and `[]` are
 * truthy here and falsy there; `0`, `false` and `''` are falsy here and truthy
 * under `is not None` there. The first build of this file derived only the
 * first half: it swapped Python's `if current` for `current is not None` to fix
 * `{}`/`[]` and left this side on truthiness, which opened a NEW divergence on
 * the other three -- `"current": 0` refused on web/Pi (`dict(0)` raises) and
 * answered `out-of-range` here. Measured, and measured AGREEING at v1.0.31,
 * in the one function this build rewrote.
 *
 * The fix is to take truthiness out of BOTH sides rather than to emulate one
 * language's accidents in the other: presence is "the provider sent something
 * under this key", which is `!= null` in either language, and whether what it
 * sent is USABLE is the shared validator's question, not this predicate's.
 * That is decision 1 of this build applied to the presence test itself.
 *
 * DIRECTION, argued rather than assumed. Every non-null value now reaches
 * `hourData` and is refused there or by `assertHourReading`, so the answer is
 * the provider-error state (502) rather than `out-of-range`. `out-of-range`
 * renders "no weather reaches that far", which is a statement about the
 * FORECAST HORIZON and is simply false of a body whose `current` block is the
 * number 0; a provider error is the true statement. Absent and explicit-null
 * keep answering `out-of-range` on both runtimes, unchanged and pre-existing:
 * One Call legitimately omits `current` (the `exclude` parameter), and with no
 * `dt` target there is no other tier to answer from.
 */
function isPresent<T>(v: T): v is NonNullable<T> {
  return v !== undefined && v !== null
}

export function pickForecastSlice(onecall: OneCallResponse, targetTs?: number): Slice {
  const current = onecall.current
  const now = current?.dt

  // `isFiniteFigure(now)`, not `now !== undefined`: the literal twin of the
  // Python side's `is_finite_figure(now)`. A `null`, `false` or `true` `dt` is
  // `!== undefined`, so the looser form computed `Math.abs(targetTs - now)` over
  // a value that coerces to a number (0, 0, 1) and would have taken the
  // `current` branch at any target within an hour of the epoch, where Python
  // falls through. A STRING `dt` never participated -- `targetTs - 'x'` is
  // already `NaN`, so the comparison was false and the two sides agreed. No
  // shipped target is near 1970, so nothing observable moved; it is a latent
  // divergence removed while the surrounding predicate was being made a real
  // twin.
  if (targetTs === undefined || (isFiniteFigure(now) && Math.abs(targetTs - now) <= NOW_SLACK)) {
    return isPresent(current)
      ? { resolution: 'current', slice: current }
      : { resolution: 'out-of-range', slice: null }
  }

  const hourly = usableEntries<OWMHour>(onecall.hourly)
  if (hourly.length > 0 && targetTs <= hourly[hourly.length - 1].dt + HOURLY_SLACK) {
    const nearest = hourly.reduce((b, h) => (Math.abs(h.dt - targetTs) < Math.abs(b.dt - targetTs) ? h : b))
    return { resolution: 'hourly', slice: nearest }
  }

  const daily = usableEntries<OWMDaily>(onecall.daily)
  if (daily.length > 0 && targetTs <= daily[daily.length - 1].dt + DAILY_SLACK) {
    const nearest = daily.reduce((b, d) => (Math.abs(d.dt - targetTs) < Math.abs(b.dt - targetTs) ? d : b))
    return { resolution: 'daily', slice: nearest }
  }

  return { resolution: 'out-of-range', slice: null }
}

function capitalize(s: string): string {
  if (!s) return s
  const lower = s.toLowerCase()
  return lower[0].toUpperCase() + lower.slice(1)
}

// The `current` and `hourly` tiers share one adapter (the Python twin used to
// have a second one for `current` that injected nothing — see `_hour_from_point`
// there). Both tiers may omit sunrise/sunset: hourly entries always do, and One
// Call omits them on BOTH tiers for polar day and polar night, so the injection
// from the matching daily entry is what keeps a well-formed high-latitude body
// working rather than a tolerance for a malformed one.
function hourData(h: OWMHour, onecall: OneCallResponse): HourData {
  // The selected slice is an OBJECT or it is refused HERE, explicitly, rather
  // than incidentally a few lines later. The `hourly` tier cannot reach this
  // branch (`usableEntries` has already filtered to objects); the `current`
  // tier can, because `isPresent` deliberately admits every non-null value and
  // leaves the validity question to the validator. Without it a non-object
  // slice is still refused, but by accident: `{ ...0 }` is `{}`, so the throw
  // comes from a missing `dt` and the Python twin's comes from `dict(0)` being
  // unindexable -- two different accidents agreeing on a verdict, which is the
  // shape this build exists to replace with a stated refusal.
  const raw = h as unknown
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new TypeError('malformed provider entry: the selected slice is not an object')
  }
  if (h.sunrise !== undefined && h.sunset !== undefined) {
    return h as HourData
  }
  const daily = usableEntries<OWMDaily>(onecall.daily)
  const day = daily.length > 0
    ? daily.reduce((b, d) => (Math.abs(d.dt - h.dt) < Math.abs(b.dt - h.dt) ? d : b))
    : undefined
  return { ...h, sunrise: day?.sunrise ?? h.dt, sunset: day?.sunset ?? h.dt }
}

/**
 * A daily entry flattened to the hour shape the formatter consumes.
 *
 * NOTHING IS DEFAULTED HERE. `weather` used to fall back to a synthetic
 * `clear sky` and the Python twin substituted `0` for every absent figure, so a
 * body carrying no daily weather at all answered HTTP 200 with "Clear sky" and
 * `0°F` on web/Pi -- a wrong number that is indistinguishable from a reading
 * and that reaches the pasteable copy block. A missing figure now arrives as
 * `undefined` and `assertHourReading` refuses the whole payload.
 *
 * The ONE thing still defaulted is `sunrise`/`sunset`, and it is deliberate,
 * measured and pre-existing on BOTH runtimes: One Call OMITS them for polar day
 * and polar night, so refusing an absent sunrise would refuse well-formed
 * high-latitude bodies. `??` treats an explicit null exactly as absent, which is
 * what `services/forecast.py` was taught to do in the same change (its
 * `.get(key, default)` fired only on an absent KEY, so a null sunrise refused on
 * web/Pi and rendered a dt-derived time on desktop).
 *
 * A dt-derived "Sunrise" is itself a wrong figure -- just an agreeing one now --
 * and the fallback is NOT daily-tier-only: `hourData` above runs the same
 * substitution for the `current` and `hourly` tiers. So a TRUE polar body, with
 * sun times absent on the selected point AND on every daily entry, reports
 * Sunrise and Sunset both equal to the reading's own timestamp, on either tier
 * and on both runtimes. That is out of this build's scope rather than half-done
 * in it, and is handed to the Chronicler as a ROADMAP.md candidate at closeout;
 * decision 5 carries the measurement and the reversal condition. Recorded at the
 * v1.0.32 closeout as item 1 of "Three weather-reading limits measured in
 * v1.0.32 and deliberately not changed" in ROADMAP.md.
 */
function dailyToHour(d: OWMDaily, temp: OWMDaily['temp']): HourData {
  return {
    dt: d.dt,
    temp: temp.day,
    humidity: d.humidity,
    dew_point: d.dew_point,
    wind_speed: d.wind_speed,
    wind_deg: d.wind_deg,
    clouds: d.clouds,
    weather: d.weather,
    sunrise: d.sunrise ?? d.dt,
    sunset: d.sunset ?? d.dt,
  }
}

function summaryFromHour(
  h: HourData, tzName: string, lat: number, isDaily: boolean,
  high: number | null = null, low: number | null = null,
): WeatherSummary {
  // `h` has been through assertHourReading, so weather[0] is an object carrying
  // a finite id and a string description: no `?? FALLBACK_WEATHER` and no
  // rounding of a possibly-NaN figure. Every field below is total.
  const owm = h.weather[0]
  const isNight = !isDaily && (h.dt < h.sunrise || h.dt > h.sunset)
  return {
    emoji: conditionEmoji(owm.id),
    moon: isNight ? moonPhaseEmoji(h.dt, lat) : '',
    description: capitalize(owm.description),
    isDaily,
    tempF: bankersRound(h.temp),
    highF: high !== null ? bankersRound(high) : null,
    lowF: low !== null ? bankersRound(low) : null,
    windDesc: windDescription(h.wind_speed),
    windDir: cardinal(h.wind_deg),
    cloudsPct: bankersRound(h.clouds),
    humidityPct: bankersRound(h.humidity),
    dewPointF: bankersRound(h.dew_point),
    sunrise: formatLocalTime(h.sunrise, tzName),
    sunset: formatLocalTime(h.sunset, tzName),
    isNight,
  }
}

/**
 * Slice the base forecast for `targetTs` (epoch seconds; undefined = now) and
 * produce the copy block + structured summary.
 *
 * REFUSES a malformed slice rather than producing a payload with a hole in it,
 * and this is the point of the whole file: `weatherPlan.ts` / `plan_weather.py`
 * are supposed to agree on what a malformed figure is (v1.0.29), and they
 * BOTH delegate here, so their agreement was only ever as good as this
 * function's. It was not good: measured over one shared fixture
 * (`weatherAtMalformed.fixture.json`), 124 of 203 mutated shapes answered
 * differently on the two transports -- 107 where this side carried NaN or a
 * wrong word past a Python refusal, and 8 (six of them on the `daily` tier)
 * where the roles INVERTED and web/Pi fabricated `0°F` and "Clear sky" while
 * desktop refused. The caller maps the throw to the provider-error state it
 * already carries (502 + "Weather data unavailable for this location.").
 */
export function buildWeatherPayload(
  onecall: OneCallResponse, targetTs: number | undefined, tzName: string, lat: number,
): Omit<WeatherAtResponse, 'tz'> {
  const picked = pickForecastSlice(onecall, targetTs)
  if (picked.resolution === 'out-of-range') {
    return { resolution: 'out-of-range', formatted: null, summary: null }
  }

  if (picked.resolution === 'daily') {
    const d = picked.slice
    // The daily `temp` CONTAINER is checked before its members, because an
    // absent or non-object `temp` is the shape the Python twin used to flatten
    // to three zeroes: `H 0° · L 0°` over a body with no temperature in it.
    const raw = d.temp as unknown
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
      throw new TypeError('malformed provider entry: daily temp is not an object')
    }
    const temp = raw as OWMDaily['temp']
    if (!isFiniteFigure(temp.min) || !isFiniteFigure(temp.max)) {
      throw new TypeError('malformed provider entry: a daily temp bound is not a finite number')
    }
    const hour = dailyToHour(d, temp)
    assertHourReading(hour)
    // Two synthetic points (min, max) so the copy block's Temperature line reads
    // as a daily low–high range via the existing format_range.
    const responses: HourlyResponse[] = [
      { data: [{ ...hour, temp: temp.min }] },
      { data: [{ ...hour, temp: temp.max }] },
    ]
    return {
      resolution: 'daily',
      formatted: formatWeather(responses, tzName, lat),
      summary: summaryFromHour(hour, tzName, lat, true, temp.max, temp.min),
    }
  }

  const hour = hourData(picked.slice, onecall)
  assertHourReading(hour)
  return {
    resolution: picked.resolution,
    formatted: formatWeather([{ data: [hour] }], tzName, lat),
    summary: summaryFromHour(hour, tzName, lat, false),
  }
}
