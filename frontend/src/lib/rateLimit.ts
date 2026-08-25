// eBird 429 pacing for the Map Explorer's Recent activity pass
// (color-coded-hotspots, pre-deploy revision): the rate-limit classifier, the
// Retry-After parse (twinned with backend/routers/map.py
// _parse_retry_after_seconds — fixture-locked via
// hotspotActivity.fixture.json's rateLimit rows), and the pure cooldown
// ladder. Dependency-free and clock-free (every time/random value is a
// parameter), so transport.ts can import it without touching the entry
// chunk's weight and the controller's tests can drive it deterministically.
//
// Why this exists: the pool-of-4 pass started 4 requests in the same
// millisecond and recycled slots as fast as eBird answered, which tripped
// eBird's rate limiter on an ordinary real-key pass (429s), and each 429
// landed the hotspot in the unanswered state. The policy here makes a 429 a
// brief slowdown instead of a lost answer: bounded per-hotspot retries, ONE
// shared key-global cooldown (a 429 means the KEY is over the limit, not the
// slot), and a modest spacing between request starts (the v0.5.86 Nominatim
// request-start queue precedent, at eBird scale rather than Nominatim's 1 s).

/** The one 429 detail string, identical on BOTH transports (the FastAPI route
 *  and the Tauri twin) — parity-locked by the shared fixture. Plain words: it
 *  can surface in the warn box when retries are exhausted. */
export const EBIRD_RATE_LIMIT_DETAIL =
  'eBird is limiting requests right now. Try again in a moment.'

/** Honor a server-sent Retry-After up to this many seconds; anything larger
 *  is capped (a stuck/hostile header must not park the pass for minutes). */
export const RETRY_AFTER_CAP_SEC = 60

/** Minimum gap between request STARTS (global, not per-slot). 150 ms bounds
 *  sustained starts at ~6.7/s and removes the 4-at-once burst entirely, while
 *  a 200-hotspot worst-case pass still completes in ~30 s of pacing floor.
 *  Default exported separately so tests can restore it after using the seam. */
export const ACTIVITY_START_SPACING_DEFAULT_MS = 150

/** Mutable binding + test seam (the HOTSPOT_ACTIVITY_MAX_ENTRIES pattern):
 *  the heavy cap/ordering tests zero it so they keep exercising their own
 *  contracts at full speed; the pacing tests set it explicitly. */
export let ACTIVITY_START_SPACING_MS = ACTIVITY_START_SPACING_DEFAULT_MS

/** Test seam: override (or restore) the start spacing. */
export function _setActivityStartSpacingMsForTests(ms: number): void {
  ACTIVITY_START_SPACING_MS = ms
}

/** 429 retries per hotspot per pass AFTER the first attempt (so at most 3
 *  requests total for one hotspot). Exhausted → the existing unanswered state
 *  and the existing Retry control. */
export const ACTIVITY_RATE_LIMIT_RETRIES = 2

/** Default cooldown when the 429 carries no usable Retry-After; doubles per
 *  consecutive 429 WAVE (a wave = a 429 arriving outside any active
 *  cooldown), bounded at ACTIVITY_COOLDOWN_MAX_MS. */
export const ACTIVITY_COOLDOWN_BASE_MS = 2000
export const ACTIVITY_COOLDOWN_MAX_MS = 30000

/** Jitter fraction applied on top of the default backoff (never on a
 *  server-sent Retry-After — the server named its own wait). */
export const ACTIVITY_COOLDOWN_JITTER_FRAC = 0.25

// Seconds form only, 1-3 digits (length-bounded, the house rule). An
// HTTP-date Retry-After parses as null → the default backoff covers it.
// Twinned with the backend's _parse_retry_after_seconds (re.fullmatch on the
// same class — the anchors and the explicit [0-9] both matter, per the
// twinned-guard rules); the shared fixture rows pin both member by member.
const RETRY_AFTER_RE = /^[0-9]{1,3}$/

/**
 * Parse a Retry-After header value to bounded whole seconds, or null when
 * absent/malformed/zero (null → the caller's default backoff). Values above
 * RETRY_AFTER_CAP_SEC are capped, not rejected — the server DID ask us to
 * slow down; we just refuse to park the pass for minutes.
 */
export function parseRetryAfterSeconds(value: string | null | undefined): number | null {
  if (typeof value !== 'string' || !RETRY_AFTER_RE.test(value)) return null
  const n = parseInt(value, 10)
  if (n < 1) return null
  return Math.min(n, RETRY_AFTER_CAP_SEC)
}

/** True when a thrown transport error is the rate-limit shape — status 429 on
 *  BOTH transports (the FastAPI route re-surfaces an upstream 429 as its own
 *  429; the Tauri twin throws { status: 429 } directly). */
export function isRateLimitError(err: unknown): boolean {
  return typeof err === 'object' && err !== null
    && (err as { status?: unknown }).status === 429
}

/** The server-sent wait in ms from a rate-limit error's `retryAfterSec`
 *  (attached by both transports), re-validated and capped here as defense in
 *  depth; null when the error carries none. */
export function retryAfterMsFrom(err: unknown): number | null {
  if (typeof err !== 'object' || err === null) return null
  const v = (err as { retryAfterSec?: unknown }).retryAfterSec
  if (typeof v !== 'number' || !Number.isFinite(v) || v < 1) return null
  return Math.min(Math.floor(v), RETRY_AFTER_CAP_SEC) * 1000
}

/**
 * The cooldown to apply for a 429, pure and deterministic: a server-sent
 * Retry-After is honored exactly (capped, no jitter); otherwise the bounded
 * exponential BASE * 2^(wave-1) plus up to JITTER_FRAC of itself (random is
 * threaded as a parameter, clamped to [0,1]), the total never exceeding
 * ACTIVITY_COOLDOWN_MAX_MS.
 */
export function cooldownDelayMs(
  wave: number,
  retryAfterMs: number | null,
  random: number,
): number {
  if (retryAfterMs !== null) {
    return Math.min(retryAfterMs, RETRY_AFTER_CAP_SEC * 1000)
  }
  // Exponent bounded structurally (2^7 * base already exceeds MAX) so a huge
  // wave count can never overflow into a non-finite delay.
  const w = Math.min(Math.max(1, Math.floor(wave)), 8)
  const base = ACTIVITY_COOLDOWN_BASE_MS * 2 ** (w - 1)
  const r = Math.min(Math.max(random, 0), 1)
  const jittered = base * (1 + ACTIVITY_COOLDOWN_JITTER_FRAC * r)
  return Math.min(Math.round(jittered), ACTIVITY_COOLDOWN_MAX_MS)
}
