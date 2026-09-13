// GENERATOR for the shared twin-parity fixtures of the Weather/tide Planner:
// weatherTidePlan.fixture.json (twelve families plus the bound fixture) and
// tzClock.fixture.json. It runs ONLY when SR_GEN_PLAN_FIXTURE=1 is set:
//
//   SR_GEN_PLAN_FIXTURE=1 npx vitest run src/lib/weatherTidePlan.fixtureGen.test.ts
//
// and is otherwise skipped, so it is a regeneration path and not a gate; the
// gates are weatherTidePlan.parity.test.ts and tzClock.parity.test.ts here and
// their pytest twins. The expected halves are produced by the SHIPPED TS
// builders (never a retyped rule), and the Python twin then has to reproduce
// them byte for byte from the same raw inputs, which is the parity claim. The
// raw inputs are synthetic One Call and NOAA bodies shaped exactly as the
// providers ship them (epoch seconds; 'YYYY-MM-DD HH:MM' GMT strings with
// three-decimal string values), so the parsers on both sides run as they
// would on a live response.
/// <reference types="node" />
import { describe, it } from 'vitest'
import { writeFileSync } from 'node:fs'
import { buildWeatherPlan } from './weatherPlan'
import { buildTidePlan, planTideRange } from './tidePlan'
import { localClock, localMidnightTs, startOfLocalHour, utcOffsetSec, addDays, localDate } from './tzClock'

const OUT = new URL('./weatherTidePlan.fixture.json', import.meta.url)
const TZ_OUT = new URL('./tzClock.fixture.json', import.meta.url)

const utc = (y: number, mo: number, d: number, h = 0, mi = 0) => Math.round(Date.UTC(y, mo - 1, d, h, mi) / 1000)

// ── One Call body ───────────────────────────────────────────────────────────

const CONDITIONS = [
  [800, 'clear sky'], [801, 'few clouds'], [802, 'scattered clouds'], [803, 'broken clouds'],
  [804, 'overcast clouds'], [741, 'fog'], [701, 'mist'], [500, 'light rain'],
] as const

function hour(dt: number, k: number) {
  const c = CONDITIONS[k % CONDITIONS.length]
  return {
    dt,
    temp: 55 + ((k * 7) % 19) + (k % 2 === 0 ? 0.5 : 0.25),   // .5 exercises banker's rounding on both sides
    humidity: 60 + ((k * 11) % 35),
    dew_point: 50 + ((k * 3) % 9) + 0.5,
    wind_speed: (k * 5) % 27,
    wind_deg: (k * 37) % 360,
    clouds: (k * 13) % 101,
    weather: [{ id: c[0], description: c[1] }],
  }
}

function daily(dt: number, k: number, sunrise: number, sunset: number) {
  const c = CONDITIONS[(k + 3) % CONDITIONS.length]
  return {
    dt,
    temp: { day: 60 + k + 0.5, min: 50 + k, max: 68 + k + 0.5 },
    humidity: 65 + k,
    dew_point: 52 + k,
    wind_speed: 6 + k,
    wind_deg: (k * 61) % 360,
    clouds: (k * 17) % 101,
    weather: [{ id: c[0], description: c[1] }],
    sunrise,
    sunset,
  }
}

interface OneCallOpts {
  tz: string
  /** local date of the first daily entry */
  firstDate: string
  days: number
  hourlyFrom: number | null   // epoch of the first hourly entry, null for none
  hourlyCount: number
  current: number | null      // epoch of the current block, null for none
  sunriseMin: number          // minutes after local midnight
  sunsetMin: number
  polar?: Array<'day' | 'night' | 'normal'>
  sunriseOverride?: Record<number, number>   // day index -> exact epoch
}

function onecall(o: OneCallOpts) {
  const dailyEntries = []
  for (let k = 0; k < o.days; k += 1) {
    const date = addDays(o.firstDate, k)
    const midnight = localMidnightTs(date, o.tz)
    const noon = midnight + 12 * 3600
    const mode = o.polar?.[k] ?? 'normal'
    let sunrise = midnight + o.sunriseMin * 60 + (k % 3) * 60
    let sunset = midnight + o.sunsetMin * 60 - (k % 2) * 60
    if (mode === 'day') sunset = 0            // polar day: no sunset
    if (mode === 'night') sunrise = 0         // polar night: no sunrise
    if (o.sunriseOverride && k in o.sunriseOverride) sunrise = o.sunriseOverride[k]
    dailyEntries.push(daily(noon, k, sunrise, sunset))
  }
  const hourly = o.hourlyFrom === null ? undefined
    : Array.from({ length: o.hourlyCount }, (_, k) => hour(o.hourlyFrom! + k * 3600, k))
  const current = o.current === null ? undefined : { ...hour(o.current, 5), sunrise: dailyEntries[0].sunrise, sunset: dailyEntries[0].sunset }
  return { current, hourly, daily: dailyEntries }
}

// ── NOAA bodies (GMT strings, three-decimal string values) ─────────────────

const pad2 = (n: number) => String(n).padStart(2, '0')
function gmtStr(ts: number): string {
  const d = new Date(ts * 1000)
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())} ${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}`
}

const CONST: Array<[number, number, number]> = [
  [1.40, 12.4206, 0.9], [0.36, 12.0000, 1.4], [0.30, 12.6583, 0.2],
  [1.05, 23.9345, 2.1], [0.65, 25.8193, 1.6], [0.33, 24.0659, 2.0],
]
const T0 = utc(2026, 1, 1)
function tideAt(ts: number, shift = 0): number {
  const t = (ts - T0 + shift) / 3600
  let h = 2.85
  for (const [a, p, ph] of CONST) h += a * Math.cos(2 * Math.PI * t / p - ph)
  return h
}

function predBody(startTs: number, endTs: number, opts: { gap?: [number, number]; shift?: number; step?: number } = {}) {
  const step = opts.step ?? 360
  const out: Array<{ t: string; v: string }> = []
  for (let t = startTs; t <= endTs; t += step) {
    if (opts.gap && t >= opts.gap[0] && t < opts.gap[1]) continue
    out.push({ t: gmtStr(t), v: tideAt(t, opts.shift).toFixed(3) })
  }
  return { predictions: out }
}

function hiloBody(startTs: number, endTs: number, opts: { shift?: number; every?: number; extra?: Array<{ t: number; v: number; type: 'H' | 'L' }> } = {}) {
  const out: Array<{ t: string; v: string; type: 'H' | 'L' }> = []
  if (opts.every) {
    // Regular alternating extremes for the bound fixture.
    let type: 'H' | 'L' = 'H'
    for (let t = startTs; t <= endTs; t += opts.every) {
      out.push({ t: gmtStr(t), v: (type === 'H' ? 5.1 : -0.8).toFixed(3), type })
      type = type === 'H' ? 'L' : 'H'
    }
  } else {
    let prev = tideAt(startTs - 120, opts.shift), cur = tideAt(startTs - 60, opts.shift)
    for (let t = startTs; t <= endTs; t += 60) {
      const next = tideAt(t, opts.shift)
      if (cur > prev && cur >= next) out.push({ t: gmtStr(t - 60), v: cur.toFixed(3), type: 'H' })
      if (cur < prev && cur <= next) out.push({ t: gmtStr(t - 60), v: cur.toFixed(3), type: 'L' })
      prev = cur; cur = next
    }
  }
  for (const e of opts.extra ?? []) out.push({ t: gmtStr(e.t), v: e.v.toFixed(3), type: e.type })
  out.sort((a, b) => (a.t < b.t ? -1 : a.t > b.t ? 1 : 0))
  return { predictions: out }
}

const NOAA_ERROR = { error: { message: 'No Predictions data was found. Please make sure the Datum input is valid.' } }

// ── Families ────────────────────────────────────────────────────────────────

const MONTEREY = { lat: 36.603, lng: -121.876, station: { id: '9413450', name: 'MONTEREY, MONTEREY BAY' }, distanceMi: 0.9 }
const ELKHORN = { lat: 36.813, lng: -121.785, station: { id: '9413623', name: 'Elkhorn Slough, Highway 1 Bridge' }, distanceMi: 0.3 }
const NYC = { lat: 40.58, lng: -73.83, station: { id: '9414290', name: 'San Francisco' }, distanceMi: 2571.4 }
const UTQIAGVIK = { lat: 71.29, lng: -156.789, station: { id: '9494935', name: 'Prudhoe Bay' }, distanceMi: 197.5 }

interface Family {
  name: string
  shape: string
  tz: string
  nowTs: number
  lat: number
  lng: number
  station: { id: string; name: string }
  distanceMi: number
  force: boolean
  onecall: unknown
  predBody: unknown
  hiloBody: unknown
}

function family(f: Family) {
  const weather = buildWeatherPlan(f.onecall as never, f.nowTs, f.tz, f.lat, f.lng)
  const span = planTideRange(f.nowTs, f.tz)
  const tide = buildTidePlan(f.predBody, f.hiloBody, f.station, f.distanceMi, f.tz, span)
  return { ...f, span, expectedWeather: weather, expectedTide: tide }
}

function standard(name: string, shape: string, place: typeof MONTEREY, tz: string, nowTs: number, oc: Partial<OneCallOpts> & { firstDate: string }, tideOpts: { gap?: [number, number]; subordinate?: boolean; shift?: number; extraHilo?: Array<{ t: number; v: number; type: 'H' | 'L' }>; force?: boolean; step?: number } = {}) {
  const span = planTideRange(nowTs, tz)
  const body = onecall({
    tz, days: 8, hourlyFrom: startOfLocalHour(nowTs, tz), hourlyCount: 48, current: nowTs - 600,
    sunriseMin: 6 * 60 + 48, sunsetMin: 19 * 60 + 19,
    ...oc,
  })
  return family({
    name, shape, tz, nowTs, lat: place.lat, lng: place.lng, station: place.station, distanceMi: place.distanceMi,
    force: tideOpts.force ?? false,
    onecall: body,
    predBody: tideOpts.subordinate ? NOAA_ERROR : predBody(span.axisStartTs, span.tideEndTs, { gap: tideOpts.gap, shift: tideOpts.shift, step: tideOpts.step }),
    hiloBody: hiloBody(span.hiloStartTs, span.hiloEndTs, { shift: tideOpts.shift, extra: tideOpts.extraHilo }),
  })
}

describe.skipIf(!process.env.SR_GEN_PLAN_FIXTURE)('regenerate the planner parity fixtures', () => {
  it('writes weatherTidePlan.fixture.json and tzClock.fixture.json', () => {
    const LA = 'America/Los_Angeles'
    const NOW_SEP = utc(2026, 9, 12, 22, 41)          // Sat 2026-09-12 15:41 PDT
    const families: ReturnType<typeof family>[] = []

    // 1. reference station, continuous series, eight daily entries, now mid-day
    families.push(standard('reference', 'reference station, continuous six-minute series, eight daily entries, now mid-afternoon', MONTEREY, LA, NOW_SEP, { firstDate: '2026-09-12' }))
    // 2. subordinate station: the continuous body is a NOAA error object
    families.push(standard('subordinate', 'subordinate station: the continuous body is a NOAA error object', ELKHORN, LA, NOW_SEP, { firstDate: '2026-09-12' }, { subordinate: true, shift: 5000 }))
    // 3a. a window crossing the fall-back change, with a turning point inside the repeated hour
    const NOW_FALL = utc(2026, 10, 31, 22, 0)            // Sat 2026-10-31 15:00 PDT; 2026-11-01 02:00 PDT falls back
    families.push(standard('dst-fall', 'window crosses the 2026-11-01 fall-back in America/Los_Angeles, a turning point inside the repeated hour', MONTEREY, LA, NOW_FALL, { firstDate: '2026-10-31', sunriseMin: 7 * 60 + 30, sunsetMin: 18 * 60 + 10 }, { extraHilo: [{ t: utc(2026, 11, 1, 9, 10), v: 4.812, type: 'H' }] }))
    // 3b. a window crossing the spring-forward change
    const NOW_SPRING = utc(2026, 3, 7, 23, 0)            // Sat 2026-03-07 15:00 PST; 2026-03-08 02:00 PST springs forward
    families.push(standard('dst-spring', 'window crosses the 2026-03-08 spring-forward in America/Los_Angeles', MONTEREY, LA, NOW_SPRING, { firstDate: '2026-03-07', sunriseMin: 6 * 60 + 30, sunsetMin: 18 * 60 + 5 }, { step: 1800 }))
    // 4. a far-station override whose station clock differs from the location's
    families.push(standard('far-station', 'forced override to a Pacific station from an Eastern place; the GMT bodies are the same as the reference family', NYC, 'America/New_York', NOW_SEP, { firstDate: '2026-09-12' }, { force: true, step: 1800 }))
    // 5. a continuous series with a one-hour gap around a sunrise
    const ref = families[0]
    const firstSunrise = (ref.expectedWeather as { ok: true; plan: { events: Array<{ kind: string; t: number }> } }).plan.events.find(e => e.kind === 'sunrise')!.t
    families.push(standard('gap', 'continuous series missing the hour around the first sunrise', MONTEREY, LA, NOW_SEP, { firstDate: '2026-09-12' }, { gap: [firstSunrise - 1800, firstSunrise + 1800] }))
    // 6. no hourly entries
    families.push(standard('no-hourly', 'forecast with no hourly entries', MONTEREY, LA, NOW_SEP, { firstDate: '2026-09-12', hourlyFrom: null, hourlyCount: 0 }, { step: 1800 }))
    // 7. five daily entries
    families.push(standard('five-daily', 'forecast with five daily entries', MONTEREY, LA, NOW_SEP, { firstDate: '2026-09-12', days: 5 }, { step: 1800 }))
    // 8. a polar day (sunset 0) and a polar night (sunrise 0)
    const NOW_POLAR = utc(2026, 7, 25, 21, 0)             // 2026-07-25 13:00 AKDT
    families.push(standard('polar', 'Utqiagvik in late July: a polar day (sunset 0) and a polar night row (sunrise 0)', UTQIAGVIK, 'America/Anchorage', NOW_POLAR, { firstDate: '2026-07-25', polar: ['day', 'day', 'day', 'night', 'normal', 'day', 'day', 'day'], sunriseMin: 3 * 60, sunsetMin: 23 * 60 }, { subordinate: true }))
    // 9. an empty daily array and a missing daily key
    const emptyDaily = standard('no-daily', 'empty daily array', MONTEREY, LA, NOW_SEP, { firstDate: '2026-09-12' }, { step: 1800 })
    families.push(family({ ...emptyDaily, onecall: { ...(emptyDaily.onecall as object), daily: [] } }))
    families.push(family({ ...emptyDaily, name: 'missing-daily', shape: 'no daily key at all', onecall: { current: (emptyDaily.onecall as { current: unknown }).current, hourly: (emptyDaily.onecall as { hourly: unknown }).hourly } }))
    // 10. now inside the current hour so the first event reads the current block
    const NOW_EARLY = utc(2026, 9, 13, 13, 30)           // Sun 2026-09-13 06:30 PDT; sunrise 06:48 is within the hour of now
    families.push(standard('now-in-hour', 'now within the hour of the first sunrise, which therefore reads the current block', MONTEREY, LA, NOW_EARLY, { firstDate: '2026-09-13', current: NOW_EARLY - 120 }, { step: 1800 }))
    // 11. an event at the same minute as a high
    const sunriseAtHigh = utc(2026, 9, 13, 13, 48)       // Sun 2026-09-13 06:48 PDT exactly
    families.push(standard('same-minute-high', 'a sunrise at the same minute as a high turning point', MONTEREY, LA, NOW_SEP, { firstDate: '2026-09-12', sunriseOverride: { 1: sunriseAtHigh } }, { extraHilo: [{ t: sunriseAtHigh, v: 5.301, type: 'H' }], step: 1800 }))
    // 12. the maximal fixture used by the bound test: nine-day six-minute series, H/L every six hours
    const spanMax = planTideRange(NOW_SEP, LA)
    families.push(family({
      name: 'maximal', shape: 'eight full days, 48 hourly entries, a nine-day six-minute series with H/L points every six hours', tz: LA, nowTs: NOW_SEP,
      lat: MONTEREY.lat, lng: MONTEREY.lng, station: MONTEREY.station, distanceMi: MONTEREY.distanceMi, force: false,
      onecall: onecall({ tz: LA, firstDate: '2026-09-12', days: 8, hourlyFrom: startOfLocalHour(NOW_SEP, LA), hourlyCount: 48, current: NOW_SEP - 600, sunriseMin: 6 * 60 + 48, sunsetMin: 19 * 60 + 19 }),
      predBody: predBody(spanMax.axisStartTs, spanMax.tideEndTs),
      hiloBody: hiloBody(spanMax.hiloStartTs, spanMax.hiloEndTs, { every: 6 * 3600 }),
    }))

    writeFileSync(OUT, JSON.stringify({ families }) + '\n')

    // tzClock rows: both DST transitions, the fall-back hour's second pass, a
    // half-hour zone, UTC, and each day's length.
    const rows = []
    const zones = ['UTC', 'America/Los_Angeles', 'America/New_York', 'America/Anchorage', 'Pacific/Honolulu', 'Asia/Kolkata']
    const instants = [
      utc(2026, 3, 8, 9, 30), utc(2026, 3, 8, 10, 30), utc(2026, 3, 8, 11, 30),      // spring-forward morning (LA 01:30 PST, 03:30 PDT, 04:30 PDT)
      utc(2026, 11, 1, 8, 30), utc(2026, 11, 1, 9, 30), utc(2026, 11, 1, 10, 30),    // fall-back: 01:30 PDT, 01:30 PST (second pass), 02:30 PST
      utc(2026, 9, 12, 22, 41), utc(2026, 1, 1, 0, 0), utc(2026, 6, 30, 23, 59), utc(2026, 12, 31, 23, 59),
    ]
    for (const tz of zones) {
      for (const ts of instants) {
        const date = localDate(ts, tz)
        rows.push({
          tz, ts,
          localClock: localClock(ts, tz),
          utcOffsetSec: utcOffsetSec(ts, tz),
          startOfLocalHour: startOfLocalHour(ts, tz),
          localMidnightTs: localMidnightTs(date, tz),
          dayLengthSec: localMidnightTs(addDays(date, 1), tz) - localMidnightTs(date, tz),
        })
      }
    }
    writeFileSync(TZ_OUT, JSON.stringify({ rows }, null, 1) + '\n')
  })
})
