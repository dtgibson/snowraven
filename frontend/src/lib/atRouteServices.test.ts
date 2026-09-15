// The desktop twins of the single-moment lookups (at-route-try-containment):
// getWeatherAt / getWeather (weatherService) and getTideAt / getTide
// (tideService), through the SHIPPED services with only the outermost seams
// doubled -- the same seam set weatherTidePlanServices.test.ts uses.
//
// FIRST COVERAGE, not an extension: before this file no frontend test imported
// getWeatherAt or getTideAt at all.
//
// Every row was MEASURED throwing on THIS transport before the repair was
// written. That matters because the two languages do not agree on what a
// malformed figure is: the Python twin raises on a non-numeric temp where
// forecastSlice.ts carries it as NaN, so only the rows that actually throw here
// can assert a 502 -- and the rows that do NOT throw are pinned below as
// deliberate, out-of-scope divergences rather than left unstated.
import { describe, it, expect, vi, beforeEach } from 'vitest'

const seams = vi.hoisted(() => ({
  fetch: vi.fn(),
  key: vi.fn(async () => 'owm-key' as string | null),
  invoke: vi.fn(async () => 'America/Los_Angeles'),
}))
vi.mock('./tauri/http', () => ({ tauriFetch: (...a: unknown[]) => seams.fetch(...a) }))
vi.mock('./storage', () => ({ storage: { getApiKey: () => seams.key() } }))
vi.mock('@tauri-apps/api/core', () => ({ invoke: () => seams.invoke() }))
vi.mock('./tauri/regionInfo', () => ({ getRegionInfo: async () => ({ name: 'Loc', lat: 36.603, lng: -121.876 }) }))

import { getWeatherAt, getWeather } from './tauri/weatherService'
import { getTideAt, getTide } from './tauri/tideService'
import fixture from './weatherTidePlan.fixture.json'
import { isOfflineError } from './offlineDetect'

const REF = (fixture as { families: Array<Record<string, unknown>> }).families[0]
const LAT = 36.603, LNG = -121.876
const okJson = (b: unknown) => ({ ok: true, status: 200, json: async () => b })
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v))
const W_AT = 'Weather data unavailable for this location.'
const W_CL = 'Weather data unavailable for this checklist.'
const W_DATE = "This checklist's date could not be read."

/** Settle a promise either way so a row can assert on the rejection VALUE. */
const settle = (p: Promise<unknown>) => p.then(v => ({ ok: true as const, v }), (e: unknown) => ({ ok: false as const, e }))

beforeEach(() => {
  seams.fetch.mockReset()
  seams.key.mockReset().mockResolvedValue('owm-key')
  seams.invoke.mockReset().mockResolvedValue('America/Los_Angeles')
})

// ── getWeatherAt ─────────────────────────────────────────────────────────────
describe('getWeatherAt: a malformed provider body is a provider error, never "offline"', () => {
  const throwing: Array<[string, (oc: Record<string, unknown>) => void]> = [
    ['current.sunrise absurd', oc => { (oc.current as Record<string, unknown>).sunrise = 1e20 }],
    ['current carrying only dt', oc => { const c = oc.current as Record<string, unknown>; oc.current = { dt: c.dt } }],
    ['current.weather an empty list', oc => { (oc.current as Record<string, unknown>).weather = [] }],
  ]
  it.each(throwing)('%s rejects with status 502 and reads as NOT offline', async (_n, mut) => {
    const oc = clone(REF.onecall as Record<string, unknown>); mut(oc)
    seams.fetch.mockResolvedValue(okJson(oc))
    const r = await settle(getWeatherAt(LAT, LNG))
    expect(r.ok).toBe(false)
    expect(r.ok === false && r.e).toMatchObject({ status: 502, message: W_AT })
    expect(isOfflineError(r.ok === false ? r.e : null)).toBe(false)
    expect(JSON.stringify(r.ok === false ? r.e : null)).not.toContain('owm-key')
  })

  // PINNED DIVERGENCE, deliberately out of scope. forecastSlice.ts never learned
  // to refuse a non-numeric figure the way the plan builders did at v1.0.29, so
  // these resolve here while the Python twin raises. Route/service containment
  // cannot reach them: a body that does not throw is not caught. Teaching the
  // builder to refuse is a behaviour change to a shipped builder and is its own
  // build; if one of these ever starts throwing, this row goes red and sends the
  // reader here rather than letting the twins silently converge unnoticed.
  it.each([
    ['non-numeric current temp', (oc: Record<string, unknown>) => { (oc.current as Record<string, unknown>).temp = 'warm' }],
    ['null current wind_speed', (oc: Record<string, unknown>) => { (oc.current as Record<string, unknown>).wind_speed = null }],
    ['string current clouds', (oc: Record<string, unknown>) => { (oc.current as Record<string, unknown>).clouds = 'lots' }],
  ])('%s still RESOLVES here while the Python twin answers 502 (known divergence)', async (_n, mut) => {
    const oc = clone(REF.onecall as Record<string, unknown>); mut(oc)
    seams.fetch.mockResolvedValue(okJson(oc))
    await expect(getWeatherAt(LAT, LNG)).resolves.toMatchObject({ resolution: 'current' })
  })

  it('a well-formed body is unchanged', async () => {
    seams.fetch.mockResolvedValue(okJson(clone(REF.onecall)))
    const r = await getWeatherAt(LAT, LNG)
    expect(r.resolution).toBe('current')
    expect(r.tz).toBe('America/Los_Angeles')
    expect(r.summary?.tempF).toBe(71)
  })

  // THE REGRESSION GUARD FOR THE CONTAINMENT ITSELF. The fetch stays OUTSIDE the
  // catch on purpose: a connection-level failure must keep reading as offline, so
  // the panel says "you're offline" when the device really is. Widening the catch
  // to cover the fetch would turn this into a 502 and tell the user the provider
  // failed while their connection is what is down.
  it('a connection-level failure is still OFFLINE, not a 502', async () => {
    seams.fetch.mockRejectedValue(Object.assign(new Error('timed out'), { status: 0, timeout: true }))
    const r = await settle(getWeatherAt(LAT, LNG))
    expect(r.ok).toBe(false)
    expect(isOfflineError(r.ok === false ? r.e : null)).toBe(true)
  })
})

// ── getTideAt ────────────────────────────────────────────────────────────────
const OBS = { error: { message: 'no data' } }
const PRED = { predictions: [{ t: '2026-09-12 22:30', v: '3.10' }, { t: '2026-09-12 23:00', v: '3.40' }] }
const HILO = { predictions: [{ t: '2026-09-12 19:00', v: '0.50', type: 'L' }, { t: '2026-09-13 01:00', v: '5.20', type: 'H' }] }

describe('getTideAt: a malformed NOAA body resolves unavailable, never a throw', () => {
  it.each([
    ['observed list of non-objects', { data: ['x', null, 5] }, PRED, HILO],
    ['continuous list of non-objects', OBS, { predictions: ['x', null, 5] }, HILO],
    ['high/low list of non-objects', OBS, PRED, { predictions: ['x', null, 5] }],
  ])('%s', async (_n, obs, pred, hilo) => {
    seams.fetch.mockResolvedValueOnce(okJson(obs)).mockResolvedValueOnce(okJson(pred)).mockResolvedValueOnce(okJson(hilo))
    await expect(getTideAt(LAT, LNG, '2026-09-12 22:41')).resolves.toEqual({ status: 'unavailable' })
    expect(seams.fetch).toHaveBeenCalledTimes(3)
  })

  it('a well-formed body is unchanged', async () => {
    seams.fetch.mockResolvedValueOnce(okJson(OBS)).mockResolvedValueOnce(okJson(PRED)).mockResolvedValueOnce(okJson(HILO))
    const r = await getTideAt(LAT, LNG, '2026-09-12 22:41')
    expect(r.status).toBe('ok')
    expect(r.reading?.source).toBe('predicted')
  })
})

// ── getWeather (the checklist twin) ──────────────────────────────────────────
const CL = (obsDt: unknown) => ({ obsDt, locId: 'L1', locName: 'Loc', durationHrs: 1 })
const histHour = (o: Record<string, unknown> = {}) => ({
  dt: 1714563000, temp: 60, humidity: 70, dew_point: 50, wind_speed: 8, wind_deg: 270,
  clouds: 20, weather: [{ id: 802, description: 'c' }], sunrise: 1714563000 - 10800, sunset: 1714563000 + 21600, ...o,
})
const routeFetch = (obsDt: unknown, hist: unknown) => async (url: string) =>
  url.includes('/product/checklist/view/') ? okJson(CL(obsDt)) : okJson(hist)

describe('getWeather: a malformed historical body is a provider error, never "offline"', () => {
  it.each([
    ['data an empty list', { data: [] }],
    ['data missing', {}],
    ['data a list of non-objects', { data: ['x', null] }],
    ['weather an empty list', { data: [histHour({ weather: [] })] }],
    ['sunrise absurd', { data: [histHour({ sunrise: 1e20 })] }],
    ['hour carrying only dt', { data: [{ dt: 1714563000 }] }],
    ['body is a string', 'nope'],
    ['body is a list', [1, 2, 3]],
  ])('%s rejects with status 502 and reads as NOT offline', async (_n, hist) => {
    seams.fetch.mockImplementation(routeFetch('2024-05-01 06:30', hist))
    const r = await settle(getWeather('S123456'))
    expect(r.ok).toBe(false)
    expect(r.ok === false && r.e).toMatchObject({ status: 502, message: W_CL })
    expect(isOfflineError(r.ok === false ? r.e : null)).toBe(false)
  })

  it('a well-formed body is unchanged', async () => {
    seams.fetch.mockImplementation(routeFetch('2024-05-01 06:30', { data: [histHour()] }))
    const r = await getWeather('S123456')
    expect(r.obs_dt).toBe('2024-05-01 06:30')
    expect(r.formatted).toContain('Temperature:')
  })
})

describe("getWeather: a checklist whose own date cannot be read", () => {
  it.each([['empty', ''], ['not-a-date', 'not-a-date'], ['ISO with a Z', '2024-05-01T12:00:00Z'], ['null', null], ['a number', 12345]])(
    'obs_dt %s rejects with status 502 and reads as NOT offline', async (_n, bad) => {
      seams.fetch.mockImplementation(routeFetch(bad, { data: [histHour()] }))
      const r = await settle(getWeather('S123456'))
      expect(r.ok).toBe(false)
      expect(r.ok === false && r.e).toMatchObject({ status: 502, message: W_DATE })
      expect(isOfflineError(r.ok === false ? r.e : null)).toBe(false)
    })

  // PINNED DIVERGENCE: JavaScript's Date rolls an impossible calendar value over
  // into a real instant where Python refuses it, so these two DATE the checklist
  // here and answer 502 on the Python twin. Same mechanism as the three rows
  // pinned in tideEpoch.fixture.json by the preceding build; neither transport
  // is wrong, and a fixture of agreeing shapes alone could not see it.
  it.each([['impossible calendar', '2024-13-40 25:61'], ['all zeroes', '0000-00-00 00:00']])(
    'obs_dt %s still RESOLVES here while the Python twin answers 502 (known divergence)', async (_n, bad) => {
      seams.fetch.mockImplementation(routeFetch(bad, { data: [histHour()] }))
      await expect(getWeather('S123456')).resolves.toMatchObject({ checklist_id: 'S123456' })
    })
})

describe('getTide: a checklist whose own date cannot be read', () => {
  it.each([['null', null], ['a number', 12345]])('obs_dt %s resolves unavailable, never a throw', async (_n, bad) => {
    seams.fetch.mockImplementation(routeFetch(bad, PRED))
    await expect(getTide('S123456')).resolves.toMatchObject({ status: 'unavailable', checklist_id: 'S123456' })
  })

  it('a well-formed checklist is unchanged', async () => {
    seams.fetch.mockImplementation(routeFetch('2026-09-12 22:41', PRED))
    const r = await getTide('S123456')
    expect(r.status).toBe('ok')
  })
})
