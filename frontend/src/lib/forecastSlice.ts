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
  moonPhaseEmoji, bankersRound, type HourlyResponse,
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

const FALLBACK_WEATHER = { id: 800, description: 'clear sky' }

type Slice =
  | { resolution: 'current' | 'hourly'; slice: OWMHour }
  | { resolution: 'daily'; slice: OWMDaily }
  | { resolution: 'out-of-range'; slice: null }

export function pickForecastSlice(onecall: OneCallResponse, targetTs?: number): Slice {
  const current = onecall.current
  const now = current?.dt

  if (targetTs === undefined || (now !== undefined && Math.abs(targetTs - now) <= NOW_SLACK)) {
    return current ? { resolution: 'current', slice: current } : { resolution: 'out-of-range', slice: null }
  }

  const hourly = onecall.hourly ?? []
  if (hourly.length > 0) {
    const last = hourly[hourly.length - 1].dt
    if (targetTs <= last + HOURLY_SLACK) {
      const nearest = hourly.reduce((b, h) => (Math.abs(h.dt - targetTs) < Math.abs(b.dt - targetTs) ? h : b))
      return { resolution: 'hourly', slice: nearest }
    }
  }

  const daily = onecall.daily ?? []
  if (daily.length > 0) {
    const last = daily[daily.length - 1].dt
    if (targetTs <= last + DAILY_SLACK) {
      const nearest = daily.reduce((b, d) => (Math.abs(d.dt - targetTs) < Math.abs(b.dt - targetTs) ? d : b))
      return { resolution: 'daily', slice: nearest }
    }
  }

  return { resolution: 'out-of-range', slice: null }
}

function capitalize(s: string): string {
  if (!s) return s
  const lower = s.toLowerCase()
  return lower[0].toUpperCase() + lower.slice(1)
}

// hourly entries omit sunrise/sunset — inject them from the matching daily entry.
function hourData(h: OWMHour, onecall: OneCallResponse): HourData {
  if (h.sunrise !== undefined && h.sunset !== undefined) {
    return h as HourData
  }
  const daily = onecall.daily ?? []
  const day = daily.length > 0
    ? daily.reduce((b, d) => (Math.abs(d.dt - h.dt) < Math.abs(b.dt - h.dt) ? d : b))
    : undefined
  return { ...h, sunrise: day?.sunrise ?? h.dt, sunset: day?.sunset ?? h.dt }
}

function dailyToHour(d: OWMDaily): HourData {
  return {
    dt: d.dt,
    temp: d.temp.day,
    humidity: d.humidity,
    dew_point: d.dew_point,
    wind_speed: d.wind_speed,
    wind_deg: d.wind_deg,
    clouds: d.clouds,
    weather: d.weather.length > 0 ? d.weather : [FALLBACK_WEATHER],
    sunrise: d.sunrise ?? d.dt,
    sunset: d.sunset ?? d.dt,
  }
}

function summaryFromHour(
  h: HourData, tzName: string, lat: number, isDaily: boolean,
  high: number | null = null, low: number | null = null,
): WeatherSummary {
  const owm = h.weather[0] ?? FALLBACK_WEATHER
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

/** Slice the base forecast for `targetTs` (epoch seconds; undefined = now) and
 *  produce the copy block + structured summary. */
export function buildWeatherPayload(
  onecall: OneCallResponse, targetTs: number | undefined, tzName: string, lat: number,
): Omit<WeatherAtResponse, 'tz'> {
  const picked = pickForecastSlice(onecall, targetTs)
  if (picked.resolution === 'out-of-range') {
    return { resolution: 'out-of-range', formatted: null, summary: null }
  }

  if (picked.resolution === 'daily') {
    const d = picked.slice
    const hour = dailyToHour(d)
    // Two synthetic points (min, max) so the copy block's Temperature line reads
    // as a daily low–high range via the existing format_range.
    const responses: HourlyResponse[] = [
      { data: [{ ...hour, temp: d.temp.min }] },
      { data: [{ ...hour, temp: d.temp.max }] },
    ]
    return {
      resolution: 'daily',
      formatted: formatWeather(responses, tzName, lat),
      summary: summaryFromHour(hour, tzName, lat, true, d.temp.max, d.temp.min),
    }
  }

  const hour = hourData(picked.slice, onecall)
  return {
    resolution: picked.resolution,
    formatted: formatWeather([{ data: [hour] }], tzName, lat),
    summary: summaryFromHour(hour, tzName, lat, false),
  }
}
