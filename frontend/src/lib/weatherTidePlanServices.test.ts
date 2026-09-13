// The desktop twins of GET /weather/plan and GET /tide/plan (schema 4.2 / 4.3)
// through the SHIPPED services with the outermost seams doubled (tauriFetch,
// storage, the tz command): the request budget, the GMT params, the no-key
// guard with zero NOAA requests behind it (D6 / FR-41), the notice shape with
// zero requests, the forced override, and the range-check throw. The builder
// output is fixture-locked in weatherTidePlan.parity.test.ts.
import { describe, it, expect, vi, beforeEach } from 'vitest'

const seams = vi.hoisted(() => ({
  fetch: vi.fn(),
  key: vi.fn(async () => 'owm-key' as string | null),
  invoke: vi.fn(async () => 'America/Los_Angeles'),
}))
vi.mock('./tauri/http', () => ({ tauriFetch: (...a: unknown[]) => seams.fetch(...a) }))
vi.mock('./storage', () => ({ storage: { getApiKey: () => seams.key() } }))
vi.mock('@tauri-apps/api/core', () => ({ invoke: () => seams.invoke() }))

import { getWeatherPlan } from './tauri/weatherService'
import { getTidePlan } from './tauri/tideService'
import fixture from './weatherTidePlan.fixture.json'
import { isOfflineError } from './offlineDetect'

const REF = (fixture as { families: Array<{ name: string; onecall: unknown; predBody: unknown; hiloBody: unknown }> }).families[0]

const okJson = (body: unknown) => ({ ok: true, status: 200, json: async () => body })

beforeEach(() => {
  seams.fetch.mockReset()
  seams.key.mockReset().mockResolvedValue('owm-key')
  seams.invoke.mockReset().mockResolvedValue('America/Los_Angeles')
  vi.spyOn(Date, 'now').mockReturnValue(1789252860 * 1000)
})

describe('getWeatherPlan', () => {
  it('makes exactly one One Call request and no NOAA request, then builds the half over now', async () => {
    seams.fetch.mockResolvedValue(okJson(REF.onecall))
    const plan = await getWeatherPlan(36.603, -121.876)
    expect(seams.fetch).toHaveBeenCalledTimes(1)
    const url = seams.fetch.mock.calls[0][0] as string
    expect(url).toContain('api.openweathermap.org/data/3.0/onecall?lat=36.603&lon=-121.876')
    expect(url).not.toContain('tidesandcurrents')
    expect(plan.fetchedAt).toBe(1789252860)
    expect(plan.tz).toBe('America/Los_Angeles')
    expect(plan.days).toHaveLength(8)
    expect(plan.events.every(e => e.t > plan.fetchedAt)).toBe(true)
  })

  it('refuses without an OpenWeather key before any request, with the no-key shape', async () => {
    seams.key.mockResolvedValue(null)
    await expect(getWeatherPlan(36.6, -121.9)).rejects.toMatchObject({ status: 500, detail: expect.stringContaining('API key not configured') })
    expect(seams.fetch).not.toHaveBeenCalled()
  })

  it('a failed fetch or an empty daily array is the 502 provider-error shape', async () => {
    seams.fetch.mockResolvedValue({ ok: false, status: 503, json: async () => ({}) })
    await expect(getWeatherPlan(36.6, -121.9)).rejects.toMatchObject({ status: 502 })
    seams.fetch.mockResolvedValue(okJson({ ...(REF.onecall as object), daily: [] }))
    await expect(getWeatherPlan(36.6, -121.9)).rejects.toMatchObject({ status: 502 })
  })

  it('range-checks the coordinates (the route\'s 422 twin) before touching a seam', async () => {
    for (const [lat, lng] of [[91, 0], [-91, 0], [0, 181], [0, -181], [NaN, 0]]) {
      await expect(getWeatherPlan(lat, lng)).rejects.toMatchObject({ status: 400 })
    }
    expect(seams.key).not.toHaveBeenCalled()
    expect(seams.fetch).not.toHaveBeenCalled()
  })
})

describe('getTidePlan', () => {
  it('makes exactly two GMT NOAA requests (continuous and high/low), no water_level, over the span from now', async () => {
    seams.fetch.mockResolvedValueOnce(okJson(REF.predBody)).mockResolvedValueOnce(okJson(REF.hiloBody))
    const half = await getTidePlan(36.603, -121.876)
    expect(seams.fetch).toHaveBeenCalledTimes(2)
    const urls = seams.fetch.mock.calls.map(c => new URL(c[0] as string))
    for (const u of urls) {
      expect(u.host).toBe('api.tidesandcurrents.noaa.gov')
      expect(u.searchParams.get('time_zone')).toBe('gmt')
      expect(u.searchParams.get('product')).toBe('predictions')
      expect(u.searchParams.get('datum')).toBe('MLLW')
      expect(u.searchParams.get('station')).toBe('9413450')
    }
    const intervals = urls.map(u => u.searchParams.get('interval')).sort()
    expect(intervals).toEqual(['6', 'hilo'])
    const cont = urls.find(u => u.searchParams.get('interval') === '6')!
    const hilo = urls.find(u => u.searchParams.get('interval') === 'hilo')!
    expect(cont.searchParams.get('begin_date')).toBe('20260912 22:00')
    expect(cont.searchParams.get('end_date')).toBe('20260921 06:59')
    expect(hilo.searchParams.get('begin_date')).toBe('20260911 22:00')
    expect(hilo.searchParams.get('end_date')).toBe('20260922 06:59')
    expect(half.status).toBe('ok')
    if (half.status === 'ok') {
      expect(half.source).toBe('predicted')
      expect(half.range).toEqual({ startTs: 1789252860 - 41 * 60, endTs: 1789973999 })
      expect(half.curve.length).toBeGreaterThan(0)
    }
  })

  it('refuses without an OpenWeather key and makes ZERO NOAA requests (D6 / FR-41)', async () => {
    seams.key.mockResolvedValue(null)
    await expect(getTidePlan(36.603, -121.876)).rejects.toMatchObject({ status: 500 })
    expect(seams.fetch).not.toHaveBeenCalled()
  })

  it('too-far and outside-US return the notice shape with zero requests; force makes two', async () => {
    const far = await getTidePlan(36.612, -120.834)
    expect(far.status).toBe('too-far')
    const outside = await getTidePlan(51.5, -0.12)
    expect(outside.status).toBe('outside-us')
    expect(seams.fetch).not.toHaveBeenCalled()
    seams.fetch.mockResolvedValueOnce(okJson(REF.predBody)).mockResolvedValueOnce(okJson(REF.hiloBody))
    const forced = await getTidePlan(36.612, -120.834, true)
    expect(forced.status).toBe('ok')
    expect(seams.fetch).toHaveBeenCalledTimes(2)
  })

  it('a NOAA outage reads as unavailable, never as a thrown error', async () => {
    seams.fetch.mockRejectedValue(Object.assign(new Error('timed out'), { status: 0, timeout: true }))
    await expect(getTidePlan(36.603, -121.876)).resolves.toEqual({ status: 'unavailable' })
  })

  it('range-checks the coordinates before touching a seam', async () => {
    await expect(getTidePlan(91, 0)).rejects.toMatchObject({ status: 400 })
    await expect(getTidePlan(0, -181)).rejects.toMatchObject({ status: 400 })
    expect(seams.key).not.toHaveBeenCalled()
    expect(seams.fetch).not.toHaveBeenCalled()
  })
})

// ── A JSON-valid but semantically malformed body (the Auditor's Low, closed).
// Each weather shape below throws inside the TS builder (the last four since the
// builder began refusing a non-numeric figure, so the twins agree);
// the service maps it to the 502 provider-error shape, which isOfflineError
// reads as NOT offline, so the panel shows Predict's words while online. The
// tide shapes read as `unavailable`, exactly as an unreadable body does.
describe('a semantically malformed provider body is a provider error, never "offline"', () => {
  const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v))
  const malformed: Array<[string, (oc: Record<string, unknown>) => void]> = [
    ['absurd daily dt', oc => { (oc.daily as Array<Record<string, unknown>>)[0].dt = 1e20 }],
    ['absurd sunrise', oc => { (oc.daily as Array<Record<string, unknown>>)[1].sunrise = 1e20 }],
    ['hourly entry with only dt', oc => { const h = oc.hourly as Array<Record<string, unknown>>; h[3] = { dt: h[3].dt } }],
    // The rows the Python twin raises on and this side used to carry as NaN
    // or a silent zero: now both transports answer the provider-error state.
    ['non-numeric hourly temp', oc => { (oc.hourly as Array<Record<string, unknown>>)[3].temp = 'warm' }],
    ['null hourly wind_speed', oc => { (oc.hourly as Array<Record<string, unknown>>)[3].wind_speed = null }],
    ['non-object daily temp', oc => { (oc.daily as Array<Record<string, unknown>>)[2].temp = 'x' }],
    ['hourly weather not a list', oc => { (oc.hourly as Array<Record<string, unknown>>)[3].weather = 'sunny' }],
  ]
  it.each(malformed)('weather: %s rejects with status 502, not a status-less throw', async (_name, mut) => {
    const oc = clone(REF.onecall as Record<string, unknown>); mut(oc)
    seams.fetch.mockResolvedValue(okJson(oc))
    const err = await getWeatherPlan(36.603, -121.876).then(() => null, (e: unknown) => e)
    expect(err).toMatchObject({ status: 502 })
    expect(isOfflineError(err)).toBe(false)
    expect(JSON.stringify(err)).not.toContain('owm-key')
  })

  it.each([
    ['continuous list of non-objects', { predictions: ['x', null, 5] }, REF.hiloBody],
    ['high/low list of non-objects', REF.predBody, { predictions: [null, 3] }],
  ])('tide: %s resolves unavailable, never a throw', async (_name, pred, hilo) => {
    seams.fetch.mockResolvedValueOnce(okJson(pred)).mockResolvedValueOnce(okJson(hilo))
    await expect(getTidePlan(36.603, -121.876)).resolves.toEqual({ status: 'unavailable' })
    expect(seams.fetch).toHaveBeenCalledTimes(2)
  })
})
