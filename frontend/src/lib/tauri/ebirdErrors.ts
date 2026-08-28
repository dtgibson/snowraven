// The shared eBird HTTP-error mapping for the DESKTOP transport.
//
// Extracted from `mapService.ts` (county-shading-and-project-stats, FR-31) so
// `checklistService.ts` can raise a 429 through the SAME code. The extraction
// is REQUIRED rather than cosmetic: importing `throwEbirdHttpError` from
// `mapService.ts` would pull that whole service's graph (the taxonomy collapse,
// the hotspot-activity model, the network cache) into the checklist service's
// chunk.
//
// WHAT IS SHARED AND WHAT IS DELIBERATELY NOT (FR-31 vs FR-32). Only the 429
// half is single-sourced. `throwEbirdHttpError` is the FULL mapper mapService
// already used, and its non-429 fallback is `{ status: 502, detail: 'eBird API
// error: n' }`. The checklist service's shipped non-429 shape is
// `{ status: res.status }` with `'Could not fetch checklist (HTTP n).'`, which
// the Life List Comparer surfaces, so it keeps its own fallback and reaches
// only `ebirdRateLimitError` here. Do not "simplify" it onto the full mapper.
//
// Per the v0.5.88 per-consumer rule, single-sourcing prevents the copies
// DRIFTING but not a call site being DROPPED, so each service keeps its own
// 429 test: mutating one call site must turn exactly one test red.
//
// Imports only `../rateLimit`, which is dependency-free by extraction, so this
// module adds no weight anywhere it is pulled in.

import { EBIRD_RATE_LIMIT_DETAIL, parseRetryAfterSeconds } from '../rateLimit'

/** The duck-typed response shape both mappers read. Deliberately narrow so a
 *  test can pass a hand-rolled object without a full Response. */
export interface EbirdErrorResponse {
  status: number
  headers: { get(name: string): string | null }
}

/**
 * The 429 HALF of the shared mapper: the rate-limit Error when the response is
 * a 429, else null so the caller applies ITS OWN non-429 fallback.
 *
 * The upstream Retry-After is parsed, bounded and re-attached as a validated
 * NUMBER (`retryAfterSec`), never reflected raw — the twin of the backend's
 * `ebird_rate_limit_exception`, fixture-locked on the same rows.
 */
export function ebirdRateLimitError(res: EbirdErrorResponse): Error | null {
  if (res.status !== 429) return null
  const retryAfterSec = parseRetryAfterSeconds(res.headers.get('Retry-After'))
  return Object.assign(
    new Error(EBIRD_RATE_LIMIT_DETAIL),
    {
      status: 429,
      detail: EBIRD_RATE_LIMIT_DETAIL,
      ...(retryAfterSec !== null ? { retryAfterSec } : {}),
    },
  )
}

/**
 * The one non-ok mapping for every eBird call in `mapService.ts`: the 429
 * above, else the generic 502 shape. Mirrors backend routers/map.py
 * `_raise_ebird_http_error` — keep both in lockstep.
 *
 * NOT for `checklistService.ts`: its non-429 shape is load-bearing (see the
 * module comment).
 */
export function throwEbirdHttpError(res: EbirdErrorResponse): never {
  const limited = ebirdRateLimitError(res)
  if (limited) throw limited
  throw Object.assign(
    new Error(`eBird API error: ${res.status}`),
    { status: 502, detail: `eBird API error: ${res.status}` },
  )
}
