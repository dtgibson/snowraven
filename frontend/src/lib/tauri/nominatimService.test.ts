import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const tauriFetch = vi.fn()

vi.mock('./http', () => ({
  tauriFetch: (...args: unknown[]) => tauriFetch(...args),
}))

import {
  __nominatimCountyCacheSizeForTests,
  __resetNominatimCountyCacheForTests,
  forwardGeocode,
  NOMINATIM_COUNTY_CACHE_MAX_ENTRIES,
  reverseGeocodeCounties,
} from './nominatimService'

function response(county: string | null, ok = true): Response {
  return {
    ok,
    json: async () => county === null ? { address: {} } : { address: { county } },
  } as Response
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(1_800_000_000_000)
  tauriFetch.mockReset()
  __resetNominatimCountyCacheForTests()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('desktop Nominatim county cache', () => {
  it('deduplicates rounded coordinates, preserves first-seen order and repeats hit without outbound work', async () => {
    tauriFetch
      .mockResolvedValueOnce(response('Alpha County'))
      .mockResolvedValueOnce(response('Beta County'))

    const locations = [
      { lat: 40.12341, lng: -73.50001 },
      { lat: 41.5, lng: -72.25 },
      // Same rounded key as the first. Map dedup keeps the last coordinates in
      // the first insertion slot, matching the shipped batch contract.
      { lat: 40.12342, lng: -73.50002 },
    ]
    const pending = reverseGeocodeCounties(locations)
    await vi.runAllTimersAsync()
    const first = await pending

    expect(first.results).toEqual([
      { lat: 40.12342, lng: -73.50002, county: 'Alpha County' },
      { lat: 41.5, lng: -72.25, county: 'Beta County' },
    ])
    expect(tauriFetch).toHaveBeenCalledTimes(2)

    const repeat = await reverseGeocodeCounties(locations)
    expect(repeat).toEqual(first)
    expect(tauriFetch).toHaveBeenCalledTimes(2)
  })

  it('uses JavaScript half-step rounding for positive and negative cache keys', async () => {
    tauriFetch
      .mockResolvedValueOnce(response('Positive County'))
      .mockResolvedValueOnce(response('Negative County'))

    const pending = reverseGeocodeCounties([
      // Math.round ties toward +Infinity: each pair collapses to one key.
      { lat: 1.23445, lng: 10 },
      { lat: 1.23449, lng: 10 },
      { lat: -1.23445, lng: -10 },
      { lat: -1.23441, lng: -10 },
    ])
    await vi.runAllTimersAsync()

    expect((await pending).results).toEqual([
      { lat: 1.23449, lng: 10, county: 'Positive County' },
      { lat: -1.23441, lng: -10, county: 'Negative County' },
    ])
    expect(tauriFetch).toHaveBeenCalledTimes(2)
  })

  it('caches null results from non-OK responses and thrown requests', async () => {
    tauriFetch
      .mockResolvedValueOnce(response(null, false))
      .mockRejectedValueOnce(new Error('offline'))

    const locations = [
      { lat: 10, lng: 20 },
      { lat: 11, lng: 21 },
    ]
    const pending = reverseGeocodeCounties(locations)
    await vi.runAllTimersAsync()
    expect((await pending).results.map(r => r.county)).toEqual([null, null])
    expect(tauriFetch).toHaveBeenCalledTimes(2)

    expect((await reverseGeocodeCounties(locations)).results.map(r => r.county))
      .toEqual([null, null])
    expect(tauriFetch).toHaveBeenCalledTimes(2)
  })

  it('retains exactly CAP entries and declines CAP+1 without evicting or thrashing the admitted set', async () => {
    tauriFetch.mockImplementation(async (url: string) => {
      const parsed = new URL(url)
      return response(`County ${parsed.searchParams.get('lat')}`)
    })

    const admitted = Array.from(
      { length: NOMINATIM_COUNTY_CACHE_MAX_ENTRIES },
      (_, i) => ({ lat: 20 + i / 10_000, lng: -120 }),
    )
    const overflow = { lat: 30, lng: -110 }
    const fill = reverseGeocodeCounties([...admitted, overflow])
    await vi.runAllTimersAsync()
    const first = await fill

    expect(first.results).toHaveLength(NOMINATIM_COUNTY_CACHE_MAX_ENTRIES + 1)
    expect(__nominatimCountyCacheSizeForTests()).toBe(NOMINATIM_COUNTY_CACHE_MAX_ENTRIES)
    expect(tauriFetch).toHaveBeenCalledTimes(NOMINATIM_COUNTY_CACHE_MAX_ENTRIES + 1)

    // Every admitted coordinate remains a hit after overflow; a FIFO of exactly
    // CAP would have evicted the first and started a rotating miss sequence.
    const admittedRepeat = await reverseGeocodeCounties(admitted)
    expect(admittedRepeat.results).toHaveLength(NOMINATIM_COUNTY_CACHE_MAX_ENTRIES)
    expect(tauriFetch).toHaveBeenCalledTimes(NOMINATIM_COUNTY_CACHE_MAX_ENTRIES + 1)

    // The declined overflow coordinate is still correct, but re-fetches rather
    // than growing the cache. A subsequent admitted hit remains silent.
    const overflowAgain = reverseGeocodeCounties([overflow])
    await vi.runAllTimersAsync()
    expect((await overflowAgain).results[0].county).toBe('County 30')
    expect(tauriFetch).toHaveBeenCalledTimes(NOMINATIM_COUNTY_CACHE_MAX_ENTRIES + 2)
    expect(__nominatimCountyCacheSizeForTests()).toBe(NOMINATIM_COUNTY_CACHE_MAX_ENTRIES)
    await reverseGeocodeCounties([admitted[0]])
    expect(tauriFetch).toHaveBeenCalledTimes(NOMINATIM_COUNTY_CACHE_MAX_ENTRIES + 2)
  }, 20_000)

  it('serializes overlapping public paths so every outbound start is at least one second apart', async () => {
    const started: number[] = []
    tauriFetch.mockImplementation(async (url: string) => {
      started.push(Date.now())
      return url.includes('/search?')
        ? { ok: true, json: async () => [] } as Response
        : response('County')
    })

    const pending = Promise.all([
      reverseGeocodeCounties([{ lat: 1, lng: 1 }]),
      reverseGeocodeCounties([{ lat: 2, lng: 2 }]),
      forwardGeocode('test'),
    ])
    await vi.runAllTimersAsync()
    await pending

    expect(started).toHaveLength(3)
    for (let i = 1; i < started.length; i++) {
      expect(started[i] - started[i - 1]).toBeGreaterThanOrEqual(1_000)
    }
  })

  it('coalesces overlapping reverse batches for the same rounded key', async () => {
    let resolveResponse!: (value: Response) => void
    const pendingResponse = new Promise<Response>(resolve => {
      resolveResponse = resolve
    })
    tauriFetch.mockReturnValue(pendingResponse)

    const first = reverseGeocodeCounties([{ lat: 40.12341, lng: -73.50001 }])
    const second = reverseGeocodeCounties([{ lat: 40.12342, lng: -73.50002 }])
    await vi.advanceTimersByTimeAsync(0)

    expect(tauriFetch).toHaveBeenCalledTimes(1)
    resolveResponse(response('Shared County'))
    await vi.runAllTimersAsync()

    const [a, b] = await Promise.all([first, second])
    expect(a.results[0].county).toBe('Shared County')
    expect(b.results[0].county).toBe('Shared County')
    expect(tauriFetch).toHaveBeenCalledTimes(1)
    expect(__nominatimCountyCacheSizeForTests()).toBe(1)
  })

  it('recovers the shared limiter queue after a rejected outbound request', async () => {
    const started: number[] = []
    tauriFetch
      .mockImplementationOnce(async () => {
        started.push(Date.now())
        throw new Error('offline')
      })
      .mockImplementationOnce(async () => {
        started.push(Date.now())
        return { ok: true, json: async () => [] } as Response
      })

    const reverse = reverseGeocodeCounties([{ lat: 3, lng: 3 }])
    const search = forwardGeocode('recovery')
    await vi.runAllTimersAsync()

    await expect(reverse).resolves.toEqual({
      results: [{ lat: 3, lng: 3, county: null }],
    })
    await expect(search).resolves.toEqual([])
    expect(started).toHaveLength(2)
    expect(started[1] - started[0]).toBeGreaterThanOrEqual(1_000)
  })

  it('reset isolates fresh state from an older in-flight lookup', async () => {
    let resolveOld!: (value: Response) => void
    tauriFetch.mockReturnValueOnce(new Promise<Response>(resolve => {
      resolveOld = resolve
    }))

    const old = reverseGeocodeCounties([{ lat: 8, lng: 8 }])
    await vi.advanceTimersByTimeAsync(0)
    expect(tauriFetch).toHaveBeenCalledTimes(1)

    __resetNominatimCountyCacheForTests()
    tauriFetch.mockResolvedValueOnce(response('Fresh County'))
    const fresh = reverseGeocodeCounties([{ lat: 8, lng: 8 }])
    await vi.runAllTimersAsync()
    expect((await fresh).results[0].county).toBe('Fresh County')
    expect(__nominatimCountyCacheSizeForTests()).toBe(1)

    resolveOld(response('Old County'))
    await vi.runAllTimersAsync()
    expect((await old).results[0].county).toBe('Old County')
    expect((await reverseGeocodeCounties([{ lat: 8, lng: 8 }])).results[0].county)
      .toBe('Fresh County')
    expect(__nominatimCountyCacheSizeForTests()).toBe(1)
  })
})
