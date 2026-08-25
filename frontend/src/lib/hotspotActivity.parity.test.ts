// Dual-transport parity for GET /map/hotspot-activity (NFR-09, QA-34), on the
// SHARED fixture (hotspotActivity.fixture.json) the backend suite
// (backend/tests/test_hotspot_activity.py) also drives — so the FastAPI route
// and the Tauri twin cannot drift independently. This side exercises the REAL
// exported Tauri service (getHotspotActivity), not just the regex literal:
// per the repo rule, tests that pin only a compiled regex cannot see a
// weakened call site.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { HOTSPOT_ACTIVITY_LOC_ID_RE, reduceActivityRecords } from './hotspotActivity'
import { EBIRD_RATE_LIMIT_DETAIL, parseRetryAfterSeconds } from './rateLimit'
import fixture from './hotspotActivity.fixture.json'

const http = vi.hoisted(() => ({
  fetch: vi.fn(),
}))
vi.mock('./tauri/http', () => ({
  tauriFetch: (...args: unknown[]) => http.fetch(...args),
}))
vi.mock('./storage', () => ({
  storage: {
    getApiKey: vi.fn(async () => 'test-key'),
  },
}))

import { getHotspotActivity } from './tauri/mapService'

beforeEach(() => {
  http.fetch.mockReset()
  http.fetch.mockResolvedValue({ ok: true, json: async () => fixture.raw })
})

describe('locId validation parity (both transports, same rows)', () => {
  it('the single-sourced guard agrees with every fixture row', () => {
    for (const row of fixture.locIdValidation) {
      expect(HOTSPOT_ACTIVITY_LOC_ID_RE.test(row.locId), JSON.stringify(row.locId)).toBe(row.valid)
    }
  })

  it('the Tauri service rejects every invalid row WITHOUT fetching (call-site guard, not just the literal)', async () => {
    for (const row of fixture.locIdValidation.filter(r => !r.valid)) {
      await expect(getHotspotActivity(row.locId)).rejects.toMatchObject({ status: 422 })
    }
    expect(http.fetch).not.toHaveBeenCalled()
  })

  it('the Tauri service accepts every valid row', async () => {
    for (const row of fixture.locIdValidation.filter(r => r.valid)) {
      const payload = await getHotspotActivity(row.locId)
      expect(payload.locId).toBe(row.locId)
    }
    expect(http.fetch).toHaveBeenCalledTimes(fixture.locIdValidation.filter(r => r.valid).length)
  })
})

describe('reduction parity (fixture raw → reduced)', () => {
  it('the Tauri service reduces the fixture raw response to the pinned shape', async () => {
    const payload = await getHotspotActivity(fixture.locId)
    expect(payload).toEqual({ locId: fixture.locId, species: fixture.reduced })
  })

  it('the shared reducer produces the same shape (the twin delegates, it does not re-derive)', () => {
    expect(reduceActivityRecords(fixture.raw)).toEqual(fixture.reduced)
  })

  it('the outbound URL interpolates the encoded locId with fixed back=30', async () => {
    await getHotspotActivity('L123456')
    const url = http.fetch.mock.calls.at(-1)![0] as string
    expect(url).toBe('https://api.ebird.org/v2/data/obs/L123456/recent?back=30&fmt=json')
  })

  it('a non-OK upstream maps to the sibling 502 error shape', async () => {
    http.fetch.mockResolvedValue({ ok: false, status: 500 })
    await expect(getHotspotActivity('L1')).rejects.toMatchObject({ status: 502 })
  })
})

// ── The 429 contract (the pre-deploy pacing revision) ─────────────────────────
// The FastAPI route re-surfaces an upstream 429 as its OWN 429 (with a
// validated, re-serialized Retry-After); the Tauri twin sees eBird directly
// and must throw the identical shape — status 429, the shared fixture detail,
// and retryAfterSec only when the header parses. Both sides drive the same
// fixture rows, so the classifier distinguishes rate-limited from generic
// error identically on both transports.

// Duck-typed headers rather than a real Headers instance: the Headers
// constructor rejects a raw "7\n" value and NORMALIZES " 7" to "7", which
// would silently rewrite the malformed fixture rows before the parser under
// test ever saw them. The twin only calls headers.get('Retry-After').
const upstream429 = (retryAfter: string | null) => ({
  ok: false,
  status: 429,
  headers: { get: (name: string) => (name.toLowerCase() === 'retry-after' ? retryAfter : null) },
})

describe('429 parity (fixture rateLimit rows)', () => {
  it('an upstream 429 throws status 429 with the shared detail, never the generic 502', async () => {
    http.fetch.mockResolvedValue(upstream429(null))
    await expect(getHotspotActivity('L1')).rejects.toMatchObject({
      status: 429,
      detail: fixture.rateLimit.detail,
    })
  })

  it('the twin detail constant IS the fixture row (the backend pins the same row)', () => {
    expect(EBIRD_RATE_LIMIT_DETAIL).toBe(fixture.rateLimit.detail)
  })

  it('every fixture Retry-After row round-trips through the real twin call site', async () => {
    for (const row of fixture.rateLimit.retryAfterRows) {
      http.fetch.mockResolvedValue(upstream429(row.header))
      const thrown = await getHotspotActivity('L1').then(
        () => { throw new Error('expected a 429 rejection') },
        (err: unknown) => err as { status: number; retryAfterSec?: number },
      )
      expect(thrown.status, JSON.stringify(row.header)).toBe(429)
      if (row.seconds === null) {
        expect('retryAfterSec' in thrown, JSON.stringify(row.header)).toBe(false)
      } else {
        expect(thrown.retryAfterSec, JSON.stringify(row.header)).toBe(row.seconds)
      }
    }
  })

  it('the shared parser is what the twin uses (rows agree with parseRetryAfterSeconds directly)', () => {
    for (const row of fixture.rateLimit.retryAfterRows) {
      expect(parseRetryAfterSeconds(row.header), JSON.stringify(row.header)).toBe(row.seconds)
    }
  })
})
