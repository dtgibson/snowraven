// The `dt` REQUEST-PARAMETER boundary for the two single-moment lookups,
// `getWeatherAt` / `getTideAt` (and their routes `GET /weather/at` and
// `GET /tide/at`). Pure; no imports, so it is safe on any chunk.
//
// Twin of `backend/services/wall_clock.py`, one predicate per runtime, imported
// by both consumers on each side -- the shape `isFiniteFigure` / `is_finite_figure`
// established one build earlier. Those two are NUMERIC-ONLY by contract and are
// not reusable for a wall-clock string; what carries over is the shape.
//
// WHAT A CONFORMING `dt` IS
// -------------------------
// 1. It matches `YYYY-MM-DD HH:MM` or `YYYY-MM-DD` EXACTLY. The explicit
//    `[0-9]` and the end anchor are not stylistic: Python's `\d` matches every
//    Unicode decimal digit where JavaScript's is ASCII-only (v0.5.54), and
//    Python's `$` matches BEFORE a trailing newline where JavaScript's does not
//    (v0.5.87). The Python half answers those with an explicit class and
//    `re.fullmatch`; this half is already strict, and the fixture carries a
//    separator row for each so neither can drift into the other's accident.
//
// 2. It names a REAL calendar moment. This is the half JavaScript gets wrong on
//    its own, and it is the mechanism behind the defect this module exists for:
//    `Date` never throws, it ROLLS. `?dt=2024-05-01 99:00` became
//    2026-05-05 04:00 and the tide panel rendered a four-day water-level range
//    as a one-hour reading, `2024-13-01 12:00` became 2025-01-01, and
//    `Date.UTC(1, ...)` is 1901 rather than year 1 because years 0-99 are mapped
//    onto 1900-1999. One component ROUND TRIP refuses all of it -- rollover and
//    the two-digit mapping alike -- where five range checks would still pass
//    Feb 30.
//
// 3. It leaves `marginHours` of head- and tail-room inside the calendar both
//    runtimes can represent, so the window its caller derives from it exists.
//    `getWeatherAt` passes 0; `getTideAt` passes TIDE_WINDOW_MARGIN_HOURS.
//
// LINEARITY, AND WHY THERE IS DELIBERATELY NO LENGTH REFUSAL
// -----------------------------------------------------------
// This is a new scan over caller-supplied text, so the argument is recorded
// here rather than re-derived (.claude/rules/security.md, v1.0.21/v1.0.23,
// with v1.0.30 asking a declared bound to name its own enforcement point).
// STRUCTURAL: exact-count quantifiers only, no unbounded quantifier, no
// nesting, one optional group -- backtracking states bounded at two, O(1) after
// the anchor. MEASURED: `exec` is flat at 0.28-0.36 ms on a 10 MB input and
// sub-linear from 1 MB to 10 MB, across five hostile shapes; the Python twin's
// `fullmatch` is flat at <=0.002 ms at every size. ENFORCEMENT POINT: on
// web/Pi a long `dt` never reaches the route, because uvicorn's h11 connection
// caps the request line at 16 KB; on desktop there is no HTTP layer at all and
// `dt` originates in the panel's native date and time inputs.
//
// DO NOT ADD A LENGTH CHECK. The string is fully materialized by the caller
// before this runs, so a refusal here cannot reduce peak retention by one byte
// -- the exact opposite of `lib/uploadGuard.ts`'s cap (v1.0.20), which is a
// RETENTION bound on a cons-string copy that would otherwise be made. Nothing
// here is stored, cached, logged or echoed.

// THE MARGIN IS A PER-CALLER ARGUMENT, NOT A PROPERTY OF THE PREDICATE.
// Folding 25 hours in would refuse `9999-12-31 23:59` on the weather lookup
// too, where it answers a truthful `out-of-range` ("no weather reaches that
// far") -- and the Predict date input carries a `min` and no `max`, so that is
// a reachable answer rather than a theoretical one.

/** Byte-identical to the sentence `/weather/at` has carried since 0.5.34, and
 *  the single definition both desktop services now import. A fixed literal with
 *  no interpolation: a refusal echoes no coordinate, no provider URL and no
 *  upstream body. Twin of `BAD_DT_DETAIL`. */
export const BAD_DT_MESSAGE = "That doesn't look like a valid date and time."

/** The widest shift `getTideAt` makes from the moment it is given: `end` is
 *  `shiftLocal(start, 1)`, and the high/low window runs from
 *  `shiftLocal(start, -24)` to `shiftLocal(end, 24)` -- 25 hours forward of
 *  `start`, 24 back. Derived from the service rather than chosen. */
export const TIDE_WINDOW_MARGIN_HOURS = 25

export interface WallClock {
  year: number
  month: number
  day: number
  hour: number
  minute: number
}

const WALL_CLOCK_RE = /^([0-9]{4})-([0-9]{2})-([0-9]{2})(?: ([0-9]{2}):([0-9]{2}))?$/

// Python `datetime`'s representable span, which this side bounds itself to so
// the twins agree. Year 0 is the row that needs it: `setUTCFullYear(0)` is a
// perfectly good proleptic year here and `datetime(0, ...)` raises there, so
// the round trip alone would let `0000-01-01 00:00` diverge.
const MIN_YEAR = 1
const MAX_YEAR = 9999

/** Epoch ms for a wall clock read as UTC. NOT `Date.UTC`, which maps years
 *  0-99 onto 1900-1999. */
export function wallClockUtcMs(wc: WallClock): number {
  const t = new Date(0)
  t.setUTCFullYear(wc.year, wc.month - 1, wc.day)
  t.setUTCHours(wc.hour, wc.minute, 0, 0)
  return t.getTime()
}

const CALENDAR_MIN_MS = wallClockUtcMs({ year: MIN_YEAR, month: 1, day: 1, hour: 0, minute: 0 })
const CALENDAR_MAX_MS = wallClockUtcMs({ year: MAX_YEAR, month: 12, day: 31, hour: 23, minute: 59 })

/** True for an absent or empty `dt` -- the two values that mean "now in the
 *  LOCATION's timezone" rather than "a moment I could not read".
 *
 *  `== null` covers undefined and null in one comparison, and the empty string
 *  is named EXPLICITLY rather than left to truthiness: Python and JavaScript
 *  disagree about `{}`, `[]`, `0`, `false` and `""` in two directions at once,
 *  so a twinned presence test is spelled this way on both sides and validity is
 *  the validator's question (weather-at-malformed-parity decision 10). */
export function isBlankWallClock(dt: string | null | undefined): boolean {
  return dt == null || dt === ''
}

/** The components of a conforming wall clock, or null for anything unreadable.
 *  NEVER throws: every shape this refuses is one `getTideAt` used to roll into
 *  a real-but-different instant and answer a confident reading for. */
export function parseWallClock(dt: string, marginHours = 0): WallClock | null {
  if (typeof dt !== 'string') return null
  const m = WALL_CLOCK_RE.exec(dt)
  if (!m) return null

  const year = Number(m[1])
  const month = Number(m[2])
  const day = Number(m[3])
  const hour = m[4] === undefined ? 0 : Number(m[4])
  const minute = m[5] === undefined ? 0 : Number(m[5])
  if (year < MIN_YEAR || year > MAX_YEAR) return null

  const wc: WallClock = { year, month, day, hour, minute }
  const ms = wallClockUtcMs(wc)
  if (!Number.isFinite(ms)) return null
  // The round trip. A rolled component comes back as a DIFFERENT one, so this
  // single comparison refuses month 13, day 45, hour 24, hour 99, minute 99,
  // Feb 30 and April 31 alike -- the set Python's `datetime(...)` raises on.
  const back = new Date(ms)
  if (
    back.getUTCFullYear() !== year || back.getUTCMonth() !== month - 1 ||
    back.getUTCDate() !== day || back.getUTCHours() !== hour ||
    back.getUTCMinutes() !== minute
  ) return null

  // The margin, compared against the same floor and ceiling the Python twin's
  // `datetime` arithmetic overflows at. There is no gap between the two
  // spellings to fall into: `marginHours` is a whole number of hours and every
  // moment here carries zero seconds, so a shifted moment is either at or
  // before 9999-12-31 23:59:00 or at or after 10000-01-01 00:00:00 -- never
  // inside the 59.999999 s that `datetime.max` has and this ceiling does not.
  if (marginHours) {
    const delta = marginHours * 3_600_000
    if (ms - delta < CALENDAR_MIN_MS || ms + delta > CALENDAR_MAX_MS) return null
  }
  return wc
}

/** 'YYYY-MM-DD HH:MM' for a wall clock. Twin of `wall_clock_text`. */
export function wallClockText(wc: WallClock): string {
  const p = (n: number, width = 2) => String(n).padStart(width, '0')
  return `${p(wc.year, 4)}-${p(wc.month)}-${p(wc.day)} ${p(wc.hour)}:${p(wc.minute)}`
}

/** The zone every date formatting on this path falls back to. Twin of the
 *  backend's `or "UTC"` and of the native seam's own default. */
export const FALLBACK_ZONE = 'UTC'

/** `tzName` when this runtime's `Intl` accepts it, `UTC` otherwise.
 *
 *  THE FAILURE THIS CLOSES IS THE ONE THIS BUILD EXISTS TO REMOVE, ARRIVING
 *  THROUGH A DIFFERENT DOOR. `Intl.DateTimeFormat({ timeZone })` throws a
 *  `RangeError` carrying NO `status` for a zone it does not accept, and
 *  `isOfflineError` reads a status-less throw as connection-level -- so the
 *  panel said "you're offline" on an online device whose request had never left
 *  the machine, four lines from a refusal that carries `status: 400` precisely
 *  so it does not. Found by the security review as F1.
 *
 *  IT IS NOT REDUNDANT WITH THE NATIVE SEAM'S `UTC` DEFAULT, and that is
 *  measured rather than assumed -- the repo's rule is never to leave a guard
 *  commented as redundant whose necessity has not been measured. The seam
 *  closes the EMPTY name, which is what tzf-rs documents itself as returning
 *  for an uncovered point. This closes a name that is present and well-formed
 *  and which this runtime's `Intl` does not know, which the seam structurally
 *  cannot: tzf-rs ships its own tzdb-derived polygon data and the webview
 *  supplies ICU's, so a zone added to one and absent from the other resolves
 *  natively and throws here (`America/Ciudad_Juarez`, tzdata 2022g, is the
 *  standing example of such a split). Measured: `nowInZone('Ocean/Nowhere')`
 *  threw exactly as `nowInZone('')` did. It also covers a caller that is not
 *  the native seam at all -- `WeatherForecastPanel` passes the `tz` string the
 *  weather RESPONSE carries.
 *
 *  STATED COST. Falling back means formatting a wall clock in UTC for a point
 *  whose real zone is offset from it, so "now" can name a different hour than
 *  the user's own clock. That is the same answer the backend has always given
 *  for an uncovered point, which is what makes it the parity-preserving choice;
 *  the alternatives are a status-less throw (the defect), a 400 (a false
 *  statement about a request that was fine), or inventing an offset. For the
 *  uncovered-point case it is barely a cost at all -- an offshore point has no
 *  local civil clock, and NOAA's own `lst_ldt` timestamps govern the reading.
 *  **Reversal condition:** if the fallback ever fires for a LAND point in
 *  normal use, the zone databases have drifted and the answer is to update
 *  them, not to widen this. */
export function zoneOrUtc(tzName: string): string {
  // A NON-STRING is unusable, and `undefined` is the member that needs saying.
  // `new Intl.DateTimeFormat({ timeZone: undefined })` is LEGAL and means "use
  // the runtime default", so without this line `zoneOrUtc(undefined)` returned
  // `undefined` and `nowInZone(undefined)` silently formatted in the DEVICE's
  // zone -- a confidently wrong hour, which is the precise failure this build
  // exists to prevent, arriving through the one input the guard written to
  // prevent it did not treat as unusable. Measured at `2026-09-16 04:15` in
  // America/Los_Angeles where UTC read `11:15`. `null`, numbers and whitespace
  // already fell back correctly, by throwing.
  if (typeof tzName !== 'string') return FALLBACK_ZONE
  try {
    new Intl.DateTimeFormat('en-CA', { timeZone: tzName })
    return tzName
  } catch {
    return FALLBACK_ZONE
  }
}

/** "Now" as a 'YYYY-MM-DD HH:MM' wall clock IN the given timezone -- so a
 *  Current lookup asks about the LOCATION's local time, not the device's.
 *  Twin of the route's `datetime.now(get_timezone(lat, lng))` fed through
 *  `wall_clock_text`. Total: it never throws, whatever the seam hands it. */
export function nowInZone(tzName: string, now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: zoneOrUtc(tzName), year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(now)
  const g = (t: string) => parts.find(p => p.type === t)?.value ?? '00'
  // Some ICU builds render midnight as hour 24 under hour12:false.
  const hh = g('hour') === '24' ? '00' : g('hour')
  return `${g('year')}-${g('month')}-${g('day')} ${hh}:${g('minute')}`
}
