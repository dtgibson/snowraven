// The eBird 429 pacing primitives (color-coded-hotspots pre-deploy revision):
// the Retry-After parse driven by the SHARED fixture rows the backend suite
// also drives (so the two parsers cannot drift independently), the rate-limit
// classifier, and the pure cooldown ladder (deterministic — random is a
// parameter, never sampled here).

import { describe, it, expect } from 'vitest'
import {
  EBIRD_RATE_LIMIT_DETAIL,
  RETRY_AFTER_CAP_SEC,
  ACTIVITY_START_SPACING_DEFAULT_MS,
  ACTIVITY_RATE_LIMIT_RETRIES,
  ACTIVITY_COOLDOWN_BASE_MS,
  ACTIVITY_COOLDOWN_MAX_MS,
  ACTIVITY_COOLDOWN_JITTER_FRAC,
  parseRetryAfterSeconds,
  isRateLimitError,
  retryAfterMsFrom,
  cooldownDelayMs,
} from './rateLimit'
import { TransportError } from './transport'
import fixture from './hotspotActivity.fixture.json'

describe('parseRetryAfterSeconds (fixture-locked with the backend twin)', () => {
  it('agrees with every shared fixture row', () => {
    for (const row of fixture.rateLimit.retryAfterRows) {
      expect(parseRetryAfterSeconds(row.header), JSON.stringify(row.header))
        .toBe(row.seconds)
    }
  })

  it('the fixture rows are not vacuous: both verdicts occur, and a capping row exists', () => {
    const rows = fixture.rateLimit.retryAfterRows
    expect(rows.some(r => r.seconds !== null)).toBe(true)
    expect(rows.some(r => r.seconds === null)).toBe(true)
    // At least one row where the raw integer exceeds the cap yet parses to it
    // (capped, not rejected — the server DID ask us to slow down).
    expect(rows.some(r => r.header !== null && /^[0-9]+$/.test(r.header)
      && parseInt(r.header, 10) > RETRY_AFTER_CAP_SEC && r.seconds === RETRY_AFTER_CAP_SEC)).toBe(true)
    // And the non-ASCII-digit row (explicit [0-9], never \d — the twinned-guard
    // rule; Python's \d would accept it, so the row is what keeps the twin honest).
    expect(rows.some(r => r.header === '٧' && r.seconds === null)).toBe(true)
  })

  it('undefined (no header at all) is null', () => {
    expect(parseRetryAfterSeconds(undefined)).toBe(null)
  })
})

describe('isRateLimitError / retryAfterMsFrom (the classifier both transports feed)', () => {
  it('status 429 is rate-limited on both thrown shapes; everything else is not', () => {
    // Web shape: a real TransportError carrying the parsed header.
    expect(isRateLimitError(new TransportError('Transport error: 429', 429, EBIRD_RATE_LIMIT_DETAIL, 7))).toBe(true)
    // Desktop shape: the Tauri twin's Object.assign error.
    expect(isRateLimitError(Object.assign(new Error(EBIRD_RATE_LIMIT_DETAIL), { status: 429, detail: EBIRD_RATE_LIMIT_DETAIL }))).toBe(true)
    expect(isRateLimitError(new TransportError('Transport error: 502', 502, 'eBird API error: 500'))).toBe(false)
    expect(isRateLimitError(Object.assign(new Error('x'), { status: 502 }))).toBe(false)
    expect(isRateLimitError(new TypeError('Failed to fetch'))).toBe(false)
    expect(isRateLimitError(null)).toBe(false)
    expect(isRateLimitError('429')).toBe(false)
    expect(isRateLimitError(Object.assign(new Error('x'), { status: '429' }))).toBe(false)
  })

  it('retryAfterMsFrom reads a finite retryAfterSec, re-caps it, and rejects junk shapes', () => {
    expect(retryAfterMsFrom(new TransportError('t', 429, undefined, 7))).toBe(7000)
    expect(retryAfterMsFrom(Object.assign(new Error('t'), { status: 429, retryAfterSec: 3 }))).toBe(3000)
    // Defense in depth: capped even if a transport ever forwarded an uncapped value.
    expect(retryAfterMsFrom(Object.assign(new Error('t'), { status: 429, retryAfterSec: 900 }))).toBe(RETRY_AFTER_CAP_SEC * 1000)
    expect(retryAfterMsFrom(new TransportError('t', 429))).toBe(null)
    expect(retryAfterMsFrom(Object.assign(new Error('t'), { retryAfterSec: Infinity }))).toBe(null)
    expect(retryAfterMsFrom(Object.assign(new Error('t'), { retryAfterSec: NaN }))).toBe(null)
    expect(retryAfterMsFrom(Object.assign(new Error('t'), { retryAfterSec: 0 }))).toBe(null)
    expect(retryAfterMsFrom(Object.assign(new Error('t'), { retryAfterSec: '7' }))).toBe(null)
    expect(retryAfterMsFrom(null)).toBe(null)
  })
})

describe('cooldownDelayMs (the bounded ladder)', () => {
  it('honors a server-sent Retry-After exactly, capped, with no jitter', () => {
    expect(cooldownDelayMs(1, 5000, 0.99)).toBe(5000)
    expect(cooldownDelayMs(3, 5000, 0.5)).toBe(5000)
    expect(cooldownDelayMs(1, RETRY_AFTER_CAP_SEC * 1000 + 1, 0)).toBe(RETRY_AFTER_CAP_SEC * 1000)
  })

  it('without Retry-After: BASE * 2^(wave-1), jitter-free at random 0, bounded at MAX', () => {
    expect(cooldownDelayMs(1, null, 0)).toBe(ACTIVITY_COOLDOWN_BASE_MS)
    expect(cooldownDelayMs(2, null, 0)).toBe(ACTIVITY_COOLDOWN_BASE_MS * 2)
    expect(cooldownDelayMs(3, null, 0)).toBe(ACTIVITY_COOLDOWN_BASE_MS * 4)
    expect(cooldownDelayMs(5, null, 0)).toBe(ACTIVITY_COOLDOWN_MAX_MS)
    expect(cooldownDelayMs(50, null, 0)).toBe(ACTIVITY_COOLDOWN_MAX_MS)
    expect(cooldownDelayMs(50, null, 1)).toBe(ACTIVITY_COOLDOWN_MAX_MS)
  })

  it('jitter adds at most JITTER_FRAC of the base and the random input is clamped', () => {
    const base = ACTIVITY_COOLDOWN_BASE_MS
    expect(cooldownDelayMs(1, null, 1)).toBe(Math.round(base * (1 + ACTIVITY_COOLDOWN_JITTER_FRAC)))
    expect(cooldownDelayMs(1, null, 0.5)).toBe(Math.round(base * (1 + ACTIVITY_COOLDOWN_JITTER_FRAC * 0.5)))
    expect(cooldownDelayMs(1, null, -3)).toBe(base)
    expect(cooldownDelayMs(1, null, 7)).toBe(Math.round(base * (1 + ACTIVITY_COOLDOWN_JITTER_FRAC)))
  })

  it('a degenerate wave value never underflows below the first rung', () => {
    expect(cooldownDelayMs(0, null, 0)).toBe(ACTIVITY_COOLDOWN_BASE_MS)
    expect(cooldownDelayMs(-4, null, 0)).toBe(ACTIVITY_COOLDOWN_BASE_MS)
  })
})

describe('the tuning constants (deliberate deviations recorded in decisions.md)', () => {
  it('pins the chosen numbers so a drift is a decision, not an accident', () => {
    expect(ACTIVITY_START_SPACING_DEFAULT_MS).toBe(150)
    expect(ACTIVITY_RATE_LIMIT_RETRIES).toBe(2)
    expect(ACTIVITY_COOLDOWN_BASE_MS).toBe(2000)
    expect(ACTIVITY_COOLDOWN_MAX_MS).toBe(30000)
    expect(RETRY_AFTER_CAP_SEC).toBe(60)
  })

  it('the shared 429 detail matches the fixture (both transports pin against this same row)', () => {
    expect(EBIRD_RATE_LIMIT_DETAIL).toBe(fixture.rateLimit.detail)
  })

  it('the detail carries no em dash (published-copy rule) and reads as the honest state', () => {
    expect(EBIRD_RATE_LIMIT_DETAIL).not.toContain('—')
  })
})
