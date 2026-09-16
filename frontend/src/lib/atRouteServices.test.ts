// The desktop twins of the single-moment lookups (at-route-try-containment):
// getWeatherAt / getWeather (weatherService) and getTideAt / getTide
// (tideService), through the SHIPPED services with only the outermost seams
// doubled -- the same seam set weatherTidePlanServices.test.ts uses.
//
// FIRST COVERAGE, not an extension: before this file no frontend test imported
// getWeatherAt or getTideAt at all.
//
// Every row was MEASURED throwing on THIS transport before the repair was
// written.
//
// THE TWINS HAVE SINCE CONVERGED (weather-at-malformed-parity). When this file
// was written the two languages did not agree on what a malformed figure is --
// the Python twin raised on a non-numeric temp where forecastSlice.ts carried it
// as NaN -- so three rows below could only be pinned as deliberate, out-of-scope
// divergences, written to go RED the day someone taught the builder to refuse.
// They did exactly that, and they are now rewritten as ordinary 502 rows; the
// comment above them records what they used to assert. The matrix that replaced
// them is weatherAtMalformedParity.test.ts (203 shapes, both runtimes, one
// shared fixture); this file remains the SERVICE-level half -- that a refusal
// arrives as `{ status: 502 }` and reads as NOT offline.
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

  // THE THREE FORMERLY-PINNED ROWS. Until weather-at-malformed-parity these
  // asserted the OPPOSITE -- "still RESOLVES here while the Python twin answers
  // 502 (known divergence)" -- because `forecastSlice.ts` never learned to
  // refuse a non-numeric figure the way the plan builders did at v1.0.29, and
  // route/service containment could not reach them: a body that does not throw
  // is not caught. They were written to go red the day the builder was taught
  // to refuse, which is what turned this file red and sent the next reader to
  // pipeline/weather-at-malformed-parity/. They are rewritten, not deleted.
  //
  // What each used to produce on this transport, measured:
  //   non-numeric temp   -> resolved, `tempF: NaN`, copy block "Temperature: NaN - NaN°F"
  //   null wind_speed    -> resolved, `windDesc: "Calm"` -- a confident wrong WORD
  //   string clouds      -> resolved, `cloudsPct: NaN`, "Cloud NaN%"
  it.each([
    ['non-numeric current temp', (oc: Record<string, unknown>) => { (oc.current as Record<string, unknown>).temp = 'warm' }],
    ['null current wind_speed', (oc: Record<string, unknown>) => { (oc.current as Record<string, unknown>).wind_speed = null }],
    ['string current clouds', (oc: Record<string, unknown>) => { (oc.current as Record<string, unknown>).clouds = 'lots' }],
  ])('%s now rejects with status 502 too, converged with the Python twin', async (_n, mut) => {
    const oc = clone(REF.onecall as Record<string, unknown>); mut(oc)
    seams.fetch.mockResolvedValue(okJson(oc))
    const r = await settle(getWeatherAt(LAT, LNG))
    expect(r.ok).toBe(false)
    expect(r.ok === false && r.e).toMatchObject({ status: 502, message: W_AT })
    expect(isOfflineError(r.ok === false ? r.e : null)).toBe(false)
    expect(JSON.stringify(r.ok === false ? r.e : null)).not.toContain('owm-key')
  })

  // The `daily` tier, where the divergence INVERTED: these two answered HTTP 200
  // on web/Pi with `tempF: 0`, `H 0° · L 0°` and a fabricated "Clear sky", while
  // this transport refused them. A service row for each direction, so neither
  // half of the convergence can regress unnoticed.
  it.each([
    ['daily temp absent', (oc: Record<string, unknown>) => { for (const d of oc.daily as Array<Record<string, unknown>>) delete d.temp }],
    ['daily weather absent', (oc: Record<string, unknown>) => { for (const d of oc.daily as Array<Record<string, unknown>>) delete d.weather }],
    ['daily humidity absent', (oc: Record<string, unknown>) => { for (const d of oc.daily as Array<Record<string, unknown>>) delete d.humidity }],
  ])('%s rejects with status 502 on the daily tier', async (_n, mut) => {
    const oc = clone(REF.onecall as Record<string, unknown>); mut(oc)
    seams.fetch.mockResolvedValue(okJson(oc))
    // The fixture's own nowTs is mid-afternoon on its first day; five days out
    // is the daily tier.
    const r = await settle(getWeatherAt(LAT, LNG, '2026-09-17 12:00'))
    expect(r.ok).toBe(false)
    expect(r.ok === false && r.e).toMatchObject({ status: 502, message: W_AT })
    expect(isOfflineError(r.ok === false ? r.e : null)).toBe(false)
    expect(JSON.stringify(r.ok === false ? r.e : null)).not.toContain('Clear sky')
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
    // ADDED by weather-at-malformed-parity, which scoped this second
    // single-moment lookup in: it shares `formatWeather` with /weather/at, and
    // over 50 malformed hour shapes that formatter refused 13 where its Python
    // twin refused 41. These six are among the 37 that used to come back as
    // PASTEABLE TEXT -- the block a user copies into a public eBird checklist.
    ['non-numeric temp', { data: [histHour({ temp: 'warm' })] }],        // "Temperature: NaN - NaN°F"
    ['null temp', { data: [histHour({ temp: null })] }],                 // "Temperature: 0°F"
    ['null wind_speed', { data: [histHour({ wind_speed: null })] }],     // "Wind: Calm"
    ['string wind_speed', { data: [histHour({ wind_speed: 'warm' })] }], // "Wind: Gale"
    ['weather a list of empty objects', { data: [histHour({ weather: [{}] })] }], // 🌡️ + an empty condition line
    ['null sunrise', { data: [histHour({ sunrise: null })] }],
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
