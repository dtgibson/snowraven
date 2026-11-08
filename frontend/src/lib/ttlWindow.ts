// One reader-side plausibility window for the stored time a TTL is measured
// from (ebird-request-economy, decisions.md D-03).
//
// A durable store that reuses an eBird answer for a TTL measures the answer's
// age as `now - storedAt`. A stored time AHEAD of the reader's clock (a clock
// that ran fast and was then corrected, or a hand-edited document) gives a
// negative age, which is always under the TTL, so before this module such an
// answer was honoured until the clock passed it plus the whole TTL, however far
// ahead it was. A stored time more than STORED_TIME_MAX_FUTURE_MS ahead now
// reads as ABSENT: the store asks for that answer once more, and the new answer
// rewrites the time at the corrected clock. Nothing is written back on read.
// The failure direction is one bounded re-ask, never a lost answer: the stores
// still serve or classify from what they hold (each says how at its call site).
//
// UNITS AND RANGE. `storedAtMs` and `nowMs` are MILLISECONDS SINCE THE UNIX
// EPOCH: the stored time is whatever the store's own `Date.now()` wrote, and the
// reader passes its own `Date.now()`. `ttlMs` and the window are durations in
// milliseconds. An answer is honoured exactly when
//
//     nowMs - ttlMs  <  storedAtMs  <=  nowMs + STORED_TIME_MAX_FUTURE_MS
//
// so a time exactly 24 hours ahead is honoured and one millisecond past it is
// not, a time `ttlMs` old or older is expired (as before), and a non-finite
// stored time is never honoured (each store's load validator already refuses
// one; NaN fails both comparisons here). Each store's load validator admits
// any FINITE number for the stored time, so the comparison is between doubles;
// every plausible value is far below 2^53 in magnitude, the subtraction cannot
// overflow, and a non-integer time is compared as written (security report I4,
// D-19).
//
// The 24 hours is the iCloud records' window (`MAX_FUTURE_MS` in
// `lib/icloud/icloudRecord.ts`, v1.0.12). It is declared again here, not
// imported, so no iCloud code joins the Statistics or Map graphs, and
// `ttlWindow.test.ts` compares the two declarations.
//
// DEPENDENCY-FREE on purpose: `hotspotRegionCache.ts` rides the entry chunk.

/** How far ahead of the reader's clock a stored time may be and still be
 *  believed: 24 hours, in milliseconds (hours * minutes * seconds * ms). */
export const STORED_TIME_MAX_FUTURE_MS = 24 * 60 * 60 * 1000

/** True when an answer stored at `storedAtMs` is still within its `ttlMs`
 *  reuse window at `nowMs` and is not dated implausibly far ahead of it (see the
 *  range above). All three are milliseconds. */
export function isWithinTtl(storedAtMs: number, nowMs: number, ttlMs: number): boolean {
  const ageMs = nowMs - storedAtMs
  return ageMs >= -STORED_TIME_MAX_FUTURE_MS && ageMs < ttlMs
}
