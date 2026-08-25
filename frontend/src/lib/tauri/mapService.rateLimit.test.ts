// Per-route 429 coverage for the desktop map service (v0.5.93 cooldown
// extension): every eBird-backed function now maps a 429 through the shared
// throwEbirdHttpError — status 429, the shared fixture detail, a validated
// bounded retryAfterSec — and everything else non-ok to the sibling 502.
// The helper is single-sourced, so these tests exist PER FUNCTION (the
// v0.5.88 rule: single-sourcing prevents drift, not a call site being
// dropped — reverting one function to its old inline 502 must turn only its
// own test red). The full Retry-After row matrix stays in
// hotspotActivity.parity.test.ts; here each function pins that the branch is
// wired. getHotspotActivity's own coverage also lives there.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { EBIRD_RATE_LIMIT_DETAIL } from '../rateLimit'
import { clearNetworkCache } from '../networkCache'

const http = vi.hoisted(() => ({ fetch: vi.fn() }))
vi.mock('./http', () => ({
  tauriFetch: (...args: unknown[]) => http.fetch(...args),
}))
vi.mock('../storage', () => ({
  storage: { getApiKey: vi.fn(async () => 'test-key') },
}))

import { getHotspots, getHotspotRegion, getCountySpecies, getRecentObs } from './mapService'

// Duck-typed headers (the parity file's reasoning): Headers would normalize
// the very values the parser must judge raw.
const upstream = (status: number, retryAfter: string | null = null) => ({
  ok: false,
  status,
  headers: { get: (name: string) => (name.toLowerCase() === 'retry-after' ? retryAfter : null) },
})

beforeEach(() => {
  http.fetch.mockReset()
  clearNetworkCache()
})

interface Thrown { status: number; detail?: string; retryAfterSec?: number }

const settle = (p: Promise<unknown>): Promise<Thrown> =>
  p.then(
    () => { throw new Error('expected rejection') },
    (err: unknown) => err as Thrown,
  )

const CASES: Array<[string, () => Promise<unknown>]> = [
  ['getHotspots', () => getHotspots(38.5, -121.5, 25)],
  ['getHotspotRegion', () => getHotspotRegion('US-CA')],
  ['getCountySpecies', () => getCountySpecies('US-CA-085')],
  ['getRecentObs', () => getRecentObs(38.5, -121.5, 25, '')],
]

describe.each(CASES)('%s', (_name, call) => {
  it('an upstream 429 throws the rate-limit shape with the shared detail', async () => {
    http.fetch.mockResolvedValue(upstream(429))
    const thrown = await settle(call())
    expect(thrown.status).toBe(429)
    expect(thrown.detail).toBe(EBIRD_RATE_LIMIT_DETAIL)
    expect('retryAfterSec' in thrown).toBe(false)
  })

  it('a valid Retry-After rides the error, validated and bounded', async () => {
    http.fetch.mockResolvedValue(upstream(429, '7'))
    const thrown = await settle(call())
    expect(thrown.status).toBe(429)
    expect(thrown.retryAfterSec).toBe(7)
  })

  it('an oversized Retry-After is capped at 60, never the raw value', async () => {
    http.fetch.mockResolvedValue(upstream(429, '999'))
    const thrown = await settle(call())
    expect(thrown.retryAfterSec).toBe(60)
  })

  it('a 500 keeps the sibling 502 shape (the 429 branch must not widen)', async () => {
    http.fetch.mockResolvedValue(upstream(500))
    const thrown = await settle(call())
    expect(thrown.status).toBe(502)
  })
})

it('a getRecentObs 429 is never cached — the retry at the same key re-fetches', async () => {
  http.fetch.mockResolvedValueOnce(upstream(429))
  await settle(getRecentObs(40, -100, 10, ''))
  http.fetch.mockResolvedValue({ ok: true, json: async () => [] })
  await expect(getRecentObs(40, -100, 10, '')).resolves.toEqual([])
  expect(http.fetch).toHaveBeenCalledTimes(2)
})
