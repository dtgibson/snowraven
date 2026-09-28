// The desktop half of GET /map/county-day-obs (targets-tab, schema.md 4.1-4.3):
// the two parameter validators refuse BEFORE any request and before the key is
// read, the outbound URL is built from validated integers, the body is capped
// before JSON.parse, and every post-fetch failure is the 502 shape (never a
// status-less throw `isOfflineError` would read as "you're offline"). The
// reducer's row-by-row parity with the backend is countyDayObsReduce.test.ts;
// the 429 mapping is mapService.rateLimit.test.ts.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { DAY_OBS_MAX_BODY_CHARS } from '../countyDayObsReduce'
import { isOfflineError } from '../offlineDetect'

const http = vi.hoisted(() => ({ fetch: vi.fn() }))
const key = vi.hoisted(() => ({ getApiKey: vi.fn(async () => 'test-key' as string | null) }))
vi.mock('./http', () => ({ tauriFetch: (...args: unknown[]) => http.fetch(...args) }))
vi.mock('../storage', () => ({ storage: { getApiKey: key.getApiKey } }))

import { getCountyDayObs } from './mapService'

const okText = (text: string) => ({ ok: true, status: 200, text: async () => text, headers: { get: () => null } })

beforeEach(() => {
  http.fetch.mockReset()
  key.getApiKey.mockReset().mockResolvedValue('test-key')
})

interface Thrown { status?: number; detail?: string }
const settle = (p: Promise<unknown>): Promise<Thrown> =>
  p.then(() => { throw new Error('expected rejection') }, (err: unknown) => err as Thrown)

describe('getCountyDayObs', () => {
  it.each([
    ['US-CA-٠١٢', '2026-09-01'],
    ['US-CA-001\n', '2026-09-01'],
    ['us-ca-001', '2026-09-01'],
    ['US-CA-001', '2026-02-30'],
    ['US-CA-001', '2026-09-01\n'],
    ['US-CA-001', '1899-12-31'],
  ])('refuses %j / %j with a 422 before reading the key or fetching', async (region, date) => {
    const thrown = await settle(getCountyDayObs(region, date))
    expect(thrown.status).toBe(422)
    expect(http.fetch).not.toHaveBeenCalled()
    expect(key.getApiKey).not.toHaveBeenCalled()
  })

  it('builds the exact outbound URL from integers the code formats', async () => {
    http.fetch.mockResolvedValue(okText('[]'))
    await getCountyDayObs('US-CA-001', '2026-09-01')
    expect(http.fetch).toHaveBeenCalledTimes(1)
    const [url, init] = http.fetch.mock.calls[0] as [string, { headers: Record<string, string> }]
    expect(url).toBe('https://api.ebird.org/v2/data/obs/US-CA-001/historic/2026/9/1')
    expect(init.headers).toEqual({ 'X-eBirdApiToken': 'test-key' })
  })

  it('returns the reduced payload', async () => {
    http.fetch.mockResolvedValue(okText(JSON.stringify([
      { speciesCode: 'linspa', obsDt: '2026-09-01 08:00', locId: 'L1', locName: 'Marsh', lat: 37.7, lng: -122.2, howMany: 2 },
      { speciesCode: 'linspa', obsDt: '2026-09-01 09:00', locId: 'L2', locName: 'Later', lat: 37.8, lng: -122.3 },
    ])))
    await expect(getCountyDayObs('US-CA-001', '2026-09-01')).resolves.toEqual({
      regionCode: 'US-CA-001', date: '2026-09-01',
      species: [{ speciesCode: 'linspa', obsDt: '2026-09-01 09:00', locId: 'L2', locName: 'Later', lat: 37.8, lng: -122.3 }],
    })
  })

  it('refuses a body over the code-unit cap BEFORE JSON.parse, as the 502 shape', async () => {
    const parse = vi.spyOn(JSON, 'parse')
    http.fetch.mockResolvedValue(okText(' '.repeat(DAY_OBS_MAX_BODY_CHARS + 1)))
    const thrown = await settle(getCountyDayObs('US-CA-001', '2026-09-01'))
    expect(thrown.status).toBe(502)
    expect(parse).not.toHaveBeenCalled()
    parse.mockRestore()
  })

  it('a body that is not JSON, or not a list, is the 502 shape and never reads as offline', async () => {
    for (const text of ['<html>', '{"errors":[]}', 'null']) {
      http.fetch.mockResolvedValue(okText(text))
      const thrown = await settle(getCountyDayObs('US-CA-001', '2026-09-01'))
      expect(thrown.status).toBe(502)
      expect(isOfflineError(thrown)).toBe(false)
    }
  })

  it('no key is the 401 no-key shape', async () => {
    key.getApiKey.mockResolvedValue(null)
    const thrown = await settle(getCountyDayObs('US-CA-001', '2026-09-01'))
    expect(thrown.status).toBe(401)
    expect(http.fetch).not.toHaveBeenCalled()
  })
})
