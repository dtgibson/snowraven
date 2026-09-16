// THE PLACEMENT BOUNDARY for a NOAA CO-OPS `t` — the timestamp inside a
// RESPONSE, not a request parameter. Pure; no imports, so it is safe on any
// chunk (`lib/tidePlan.ts` must stay off the entry chunk and `lib/tide.ts` is
// on it).
//
// Twin of `backend/services/tide_instant.py`, one predicate per runtime,
// imported by every consumer on each side — the shape `isFiniteFigure` /
// `is_finite_figure` and `parseWallClock` / `parse_wall_clock` established.
// Those govern a NUMBER and a REQUEST parameter respectively and are not
// reusable here; what carries over is the shape, not the predicate.
//
// WHAT THIS REPLACES, AND WHY A SENTINEL WAS THE DEFECT
// ----------------------------------------------------
// `epochMin` / `_epoch_min` returned `0` — the 1970 epoch — for a `t` they
// could not read, and every consumer then treated that as a real instant. 1970
// is 56 years from any tide window, so the interpolation fraction collapsed to
// ~0.99999 and the reading degenerated into "return the other bracket": a
// window whose true answer is `2.4 – 2.8 ft` rendered `1.5 – 1.5 ft`, and it
// rendered that on BOTH runtimes, byte for byte, in the block a user pastes
// into a permanent public eBird checklist comment. Plausible, in range,
// correctly rounded, and wrong.
//
// So the answer is `null`, never a number. **The test may not be spelled
// `=== 0` or `> 0`**, and both halves of that are real rather than theoretical:
// `1970-01-01 00:00` is a placeable instant whose epoch IS the old sentinel,
// and a pre-1970 instant is placeable and negative (`lib/tidePlan.ts` used
// `t > 0` and therefore dropped both).
//
// WHAT A PLACEABLE `t` IS
// -----------------------
// 1. It is a STRING. NOAA documents all three products as shipping `t` as one,
//    and the two coercions that stood in for this check were not twins:
//    `String(null)` is `''` where `str(None)` is `'None'`, and `'None'` sorts
//    AFTER every real timestamp where `''` sorts before — so the two runtimes
//    bracketed the same window with different points. `parseWallClock`'s
//    `typeof !== 'string'` is the precedent.
//
// 2. It STARTS WITH `YYYY-MM-DD[ T]HH:MM`. A PREFIX, deliberately: seconds and
//    a trailing newline ride along, because `re.match` does the same on the
//    Python side and `services/tz_clock.py`'s `gmt_epoch` is the shipped
//    precedent. **`fullmatch` here would BREAK parity by design** — see the
//    header of `backend/tests/test_tide_epoch_parity.py`. Explicit `[0-9]`
//    rather than `\d` because Python's `\d` matches every Unicode decimal digit
//    and `int()` parses it happily where JavaScript's is ASCII-only (v0.5.54);
//    the class is identical on both sides and the shared fixture carries a
//    non-ASCII-digit row, a leading-, a trailing- and an embedded-newline row.
//
// 3. It names a REAL calendar moment. This is the half JavaScript gets wrong on
//    its own: `Date` never throws, it ROLLS. `2026-02-30 15:07` became March 2
//    and `2026-13-40 25:61` became an instant in 2027, where `datetime(...)`
//    raises on both — three of the rows in `tideEpoch.fixture.json` were pinned
//    as permanent twin divergences for exactly this and are converged here. One
//    component ROUND TRIP refuses the whole family: month 13, day 45, day 0,
//    hour 25, minute 61, Feb 30 and April 31 alike.
//
// 4. Its year is at least MIN_YEAR. Two different things need that one bound.
//    `Date.UTC` maps years 0–99 onto 1900–1999, so `0001-01-01 00:00` read as
//    1901 here and as year 1 there — closed by building the date through
//    `setUTCFullYear`, which does not carry the legacy mapping. And year 0 is a
//    perfectly good proleptic year for `Date` that `datetime(0, ...)` refuses,
//    which the round trip alone would let diverge. The TOP of the range needs
//    no constant: `[0-9]{4}` cannot express a year above 9999, which is
//    `datetime`'s own ceiling.
//
// LINEARITY (.claude/rules/security.md, v1.0.21 / v1.0.23)
// --------------------------------------------------------
// Declared rather than left to be discovered, though this build ends with FEWER
// scans over provider text than it started with: `_LST_RE` and `_GMT_RE` were
// two byte-identical patterns and are now one, and `_clock`'s UNANCHORED
// `re.search(r"[ T](\d{2}):(\d{2})")` — which read `3:07pm` off `2026/05/01
// 15:07` and `1:61pm` off `2026-13-40 25:61`, and whose `\d` was the open half
// of F2 from `pipeline/tide-timezone-parse` — is deleted outright, because a
// clock is now formatted from the placed components instead of re-scanned.
// STRUCTURAL: anchored, exact-count quantifiers only, no alternation, no
// nesting, nothing lazy — so backtracking states are bounded and a hostile
// provider string matches or fails inside the first 16 characters. The round
// trip is arithmetic, not a scan. ENFORCEMENT POINT: the only producer of `t`
// is NOAA over HTTPS on both transports (`backend/services/noaa.py`,
// `lib/tauri/tideService.ts`'s `getJson`); nothing user-supplied and nothing
// replayed reaches this field.

/** A NOAA `t` that names a real instant: where it falls on the epoch axis, and
 *  the wall-clock the block renders. `hour`/`minute` are carried rather than
 *  re-derived so the copy block's clock can never disagree with the instant the
 *  level was computed from. */
export interface TideInstant {
  epochSec: number
  hour: number
  minute: number
}

const LST_RE = /^([0-9]{4})-([0-9]{2})-([0-9]{2})[ T]([0-9]{2}):([0-9]{2})/

/** `datetime`'s floor, which this side bounds itself to so the twins agree. */
const MIN_YEAR = 1

/**
 * The instant a NOAA `t` names, or `null` when it names none.
 *
 * NEVER throws and never returns a sentinel. Takes `unknown` because the value
 * arrives from `JSON.parse` over a provider response, exactly as
 * `parseWallClock` takes an unvalidated query parameter — and because
 * `tsconfig.app.json` sets no `strict`, so the compiler will not enforce the
 * `null` check at any call site and every consumer is pinned behaviourally
 * instead.
 */
export function placeInstant(t: unknown): TideInstant | null {
  if (typeof t !== 'string') return null
  const m = LST_RE.exec(t)
  if (m === null) return null

  const year = Number(m[1])
  const month = Number(m[2])
  const day = Number(m[3])
  const hour = Number(m[4])
  const minute = Number(m[5])
  if (year < MIN_YEAR) return null

  // NOT `Date.UTC`, which maps years 0–99 onto 1900–1999.
  const d = new Date(0)
  d.setUTCFullYear(year, month - 1, day)
  d.setUTCHours(hour, minute, 0, 0)
  const ms = d.getTime()
  if (!Number.isFinite(ms)) return null

  // The round trip. A rolled component comes back as a DIFFERENT one, so this
  // single comparison refuses the whole impossible-calendar family — the set
  // Python's `datetime(...)` raises on.
  if (
    d.getUTCFullYear() !== year || d.getUTCMonth() !== month - 1 ||
    d.getUTCDate() !== day || d.getUTCHours() !== hour || d.getUTCMinutes() !== minute
  ) return null

  return { epochSec: ms / 1000, hour, minute }
}

/** Epoch-MINUTES for a NOAA `lst_ldt` string, or `null`. The unit the
 *  single-moment builders interpolate in. Twin of `place_epoch_min`.
 *
 *  Read on a fixed UTC axis and NOT calendar-correct for the station's own
 *  zone: the string is the STATION's local clock and is read here as though it
 *  were UTC, so a wall-clock 01:00 → 03:00 span at a station crossing its own
 *  DST transition measures 120 minutes where 180 actually elapsed. That is the
 *  contract rather than an oversight — every consumer takes only DIFFERENCES
 *  between two of these values, and reading every string on one fixed axis is
 *  what makes a difference equal the CALENDAR difference of the two wall
 *  clocks on every machine. Re-parsing in the station's real zone is a
 *  separate, deliberately deferred decision:
 *  pipeline/tide-timezone-parse/decisions.md carries the evidence, the reversal
 *  condition and the exact change. */
export function placeEpochMin(t: unknown): number | null {
  const at = placeInstant(t)
  return at === null ? null : at.epochSec / 60
}

/** Epoch-SECONDS for a NOAA `time_zone=gmt` string, or `null`. The unit the
 *  Planner's curve and turning points are built in. Twin of `place_epoch_sec`. */
export function placeEpochSec(t: unknown): number | null {
  const at = placeInstant(t)
  return at === null ? null : at.epochSec
}

/** A placed instant as the block's clock: `'3:07pm'`. Matches the weather
 *  block's time style. Takes the INSTANT, never the string, so a clock can only
 *  ever be rendered for a moment that was actually placed. */
export function clockText(at: TideInstant): string {
  const ap = at.hour >= 12 ? 'pm' : 'am'
  const h = at.hour % 12 === 0 ? 12 : at.hour % 12
  return `${h}:${String(at.minute).padStart(2, '0')}${ap}`
}
