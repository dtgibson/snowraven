// Per-route 429 coverage for the desktop CHECKLIST service
// (county-shading-and-project-stats, FR-31, FR-32, QA-32, QA-33).
//
// As shipped, a 429 on this path arrived as `{ status: 429 }` with no `detail`
// and no `retryAfterSec`, so `retryAfterMsFrom` returned null and the shared
// gate (lib/ebirdGate.ts) could not honor eBird's own wait — the pacing
// contract the projects sweep depends on was unenforceable here. The fix is
// ONE branch calling the extracted `ebirdRateLimitError`.
//
// The mapper is single-sourced with mapService. Per the v0.5.88 rule that buys
// freedom from DRIFT and nothing else, this service keeps its OWN 429 test:
// dropping the branch from `getChecklist` must turn exactly this file red, and
// the mirror-image assertions below pin that ONLY the 429 shape changed.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { EBIRD_RATE_LIMIT_DETAIL, retryAfterMsFrom, isRateLimitError } from '../rateLimit'

const http = vi.hoisted(() => ({ fetch: vi.fn() }))
vi.mock('./http', () => ({
  tauriFetch: (...args: unknown[]) => http.fetch(...args),
}))
const store = vi.hoisted(() => ({ key: 'test-key' as string | null }))
vi.mock('../storage', () => ({
  storage: { getApiKey: vi.fn(async () => store.key) },
}))
vi.mock('./taxonomyService', () => ({ resolveSpecies: vi.fn(async () => ({})) }))
vi.mock('./regionInfo', () => ({ getRegionInfo: vi.fn(async () => ({ name: 'Somewhere' })) }))

import { getChecklist } from './checklistService'

// Duck-typed headers (the mapService file's reasoning): a real `Headers` would
// normalize the very values the parser has to judge raw.
const upstream = (status: number, retryAfter: string | null = null) => ({
  ok: false,
  status,
  headers: { get: (name: string) => (name.toLowerCase() === 'retry-after' ? retryAfter : null) },
  json: async () => ({}),
})

interface Thrown { status: number; detail?: string; retryAfterSec?: number; message: string }

const settle = (p: Promise<unknown>): Promise<Thrown> =>
  p.then(
    () => { throw new Error('expected rejection') },
    (err: unknown) => err as Thrown,
  )

beforeEach(() => {
  http.fetch.mockReset()
  store.key = 'test-key'
})

describe('getChecklist 429 mapping (FR-31)', () => {
  it('an upstream 429 throws the rate-limit shape with the shared detail', async () => {
    http.fetch.mockResolvedValue(upstream(429))
    const thrown = await settle(getChecklist('S12345678'))
    expect(thrown.status).toBe(429)
    expect(thrown.detail).toBe(EBIRD_RATE_LIMIT_DETAIL)
    expect('retryAfterSec' in thrown).toBe(false)
    // The two shipped predicates the gate actually calls.
    expect(isRateLimitError(thrown)).toBe(true)
    expect(retryAfterMsFrom(thrown)).toBe(null)
  })

  it('a Retry-After rides the error as validated bounded seconds', async () => {
    http.fetch.mockResolvedValue(upstream(429, '7'))
    const thrown = await settle(getChecklist('S12345678'))
    expect(thrown.retryAfterSec).toBe(7)
    expect(retryAfterMsFrom(thrown)).toBe(7000)
  })

  it('an oversized Retry-After is capped, never reflected raw', async () => {
    http.fetch.mockResolvedValue(upstream(429, '999'))
    const thrown = await settle(getChecklist('S12345678'))
    expect(thrown.retryAfterSec).toBe(60)
  })

  it.each(['Wed, 21 Oct 2015 07:28:00 GMT', 'abc', '0', '7\n', '٧', '-3', '7.5'])(
    'a malformed Retry-After (%j) is dropped rather than passed through',
    async (bad) => {
      http.fetch.mockResolvedValue(upstream(429, bad))
      const thrown = await settle(getChecklist('S12345678'))
      expect(thrown.status).toBe(429)
      expect('retryAfterSec' in thrown).toBe(false)
    },
  )
})

// The mirror-image half. FR-32 forbids changing ANY non-429 outcome, and the
// obvious wrong simplification is to delegate the whole mapper: that would
// replace `{ status: res.status }` with `{ status: 502 }` and the message with
// "eBird API error: n". These assertions reject exactly that.
describe('every non-429 outcome keeps its shipped shape (FR-32)', () => {
  it.each([400, 403, 500, 503])('HTTP %i keeps its own status and detail string', async (status) => {
    http.fetch.mockResolvedValue(upstream(status))
    const thrown = await settle(getChecklist('S12345678'))
    expect(thrown.status).toBe(status)
    expect(thrown.message).toBe(`Could not fetch checklist (HTTP ${status}).`)
    expect(thrown.message).not.toContain('eBird API error')
    expect(thrown.detail).toBeUndefined()
  })

  it('404 keeps its exact detail, ahead of the 429 branch', async () => {
    http.fetch.mockResolvedValue(upstream(404))
    const thrown = await settle(getChecklist('S12345678'))
    expect(thrown.status).toBe(404)
    expect(thrown.message).toBe('Checklist not found. Check the ID and try again.')
  })

  it('a missing key still throws the 401 shape before any request', async () => {
    store.key = null
    const thrown = await settle(getChecklist('S12345678'))
    expect(thrown.status).toBe(401)
    expect(thrown.message).toBe('eBird API key not configured. Add it in Settings.')
    expect(http.fetch).not.toHaveBeenCalled()
  })

  it('a connection failure still throws the status-0 shape', async () => {
    http.fetch.mockRejectedValue(new Error('boom'))
    const thrown = await settle(getChecklist('S12345678'))
    expect(thrown.status).toBe(0)
    expect(thrown.message).toContain('Could not reach eBird')
  })
})

describe('the fields=projects flag (FR-25, QA-26)', () => {
  const ok = (payload: unknown) => ({
    ok: true, status: 200, headers: { get: () => null }, json: async () => payload,
  })

  it('skipSpecies suppresses BOTH follow-up calls and returns species: []', async () => {
    http.fetch.mockResolvedValue(ok({
      locId: 'L99', obsDt: '2026-04-11 07:20',
      projId: 'EBIRD_ATL_CA', projectIds: [1050],
      obs: [{ speciesCode: 'amerob', howManyStr: '3' }],
    }))
    // The raw `fields` string the transport passes through, so this drives the
    // shipped flag table rather than flags hand-built to agree with it.
    const res = await getChecklist('S12345678', 'projects')
    expect(res.species).toEqual([])
    expect(res.projId).toBe('EBIRD_ATL_CA')
    expect(res.projectIds).toEqual([1050])
    // locName falls back to the locId, the stated shape.
    expect(res.locName).toBe('L99')
    // Exactly one outbound request: checklist/view.
    expect(http.fetch).toHaveBeenCalledTimes(1)
    expect(String(http.fetch.mock.calls[0][0])).toContain('/product/checklist/view/')
  })

  it('without the flag the species list and the location name are unchanged', async () => {
    http.fetch.mockResolvedValue(ok({
      locId: 'L99', locName: 'Albany Bulb', obsDt: '2026-04-11 07:20',
      obs: [{ speciesCode: 'amerob', howManyStr: '3' }],
    }))
    const res = await getChecklist('S12345678')
    expect(res.species).toHaveLength(1)
    expect(res.locName).toBe('Albany Bulb')
    // Absent project fields are the stated empty values (QA-24).
    expect(res.projId).toBe('')
    expect(res.projectIds).toEqual([])
  })
})
