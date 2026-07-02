import { describe, it, expect, vi, beforeEach } from 'vitest'

// TIDY #3 (desktop runtime half): the desktop mapService.getRecentObs twin
// dedupes the underlying eBird data/obs/geo/recent fetch on (lat, lng, dist)
// ONLY — the `codes` filter is applied AFTER the cached raw fetch (via the
// codes-excluded `rawKey` + the shared 90 s networkCache). So a Nearby Lifers
// call (no codes) and a Media Targets call (with codes) at the SAME center hit
// eBird ONCE — the desktop analogue of the backend
// test_recent_obs_same_center_hits_upstream_once. The web/Pi runtime achieves
// the same dedup server-side (backend _cached_recent_obs_raw); this locks the
// desktop TS twin, which the transport-layer test (codes ARE in networkCacheKey
// for the web path) does not exercise.

const RAW = [
  { speciesCode: 'bkcchi', comName: 'Black-capped Chickadee', locId: 'L1', locName: 'Park', lat: 44.9, lng: -93.0, obsDt: '2026-06-30 08:00', subId: 'S1' },
  { speciesCode: 'amerob', comName: 'American Robin', locId: 'L1', locName: 'Park', lat: 44.9, lng: -93.0, obsDt: '2026-06-30 08:05', subId: 'S1' },
  { speciesCode: 'norcar', comName: 'Northern Cardinal', locId: 'L2', locName: 'Yard', lat: 44.91, lng: -93.01, obsDt: '2026-06-29 07:00', subId: 'S2' },
]

const tauriFetch = vi.fn(async (url: string, init?: unknown): Promise<{ ok: boolean; status: number; json: () => Promise<typeof RAW> }> => {
  void url; void init
  return { ok: true, status: 200, json: async () => RAW }
})

vi.mock('./http', () => ({ tauriFetch: (url: string, init?: unknown) => tauriFetch(url, init) }))
vi.mock('../storage', () => ({ storage: { getApiKey: vi.fn(async () => 'test-key') } }))

import { getRecentObs } from './mapService'
import { clearNetworkCache } from '../networkCache'

beforeEach(() => {
  vi.clearAllMocks()
  clearNetworkCache()
})

describe('desktop getRecentObs — codes-independent cache (TIDY #3)', () => {
  it('a no-codes and a with-codes call at the same center hit eBird once', async () => {
    // 1) Nearby Lifers: no codes → every species in the radius.
    const all = await getRecentObs(44.9, -93.0, 25, '')
    // 2) Media Targets: with codes, SAME center → served from the cached raw fetch.
    const filtered = await getRecentObs(44.9, -93.0, 25, 'amerob,norcar')

    // The raw eBird fetch happened exactly once across both calls.
    expect(tauriFetch).toHaveBeenCalledTimes(1)
    // Each call still returns its own correctly-filtered set.
    expect(new Set(all.map(r => r.speciesCode))).toEqual(new Set(['bkcchi', 'amerob', 'norcar']))
    expect(filtered.map(r => r.speciesCode).sort()).toEqual(['amerob', 'norcar'])
  })

  it('a different center misses the cache (re-fetches)', async () => {
    await getRecentObs(44.9, -93.0, 25, '')
    await getRecentObs(10.0, 20.0, 25, '')
    expect(tauriFetch).toHaveBeenCalledTimes(2)
  })

  it('the raw fetch URL carries no codes param (fetch is codes-independent)', async () => {
    await getRecentObs(44.9, -93.0, 25, 'amerob')
    const url = tauriFetch.mock.calls[0][0]
    expect(url).toContain('/data/obs/geo/recent')
    expect(url).not.toContain('codes')
  })
})
