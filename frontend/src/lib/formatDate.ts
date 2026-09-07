// Canonical date formatting for SnowRaven.
//
// Before this module, ~5 components/lib files each hand-rolled a date formatter
// (Statistics, Map Explorer, Species Detail, Life List, Breeding Codes, the
// checklist comparer, Settings) with divergent month-name arrays, day-first vs.
// month-first ordering, and inconsistent edge-case handling. They also disagreed
// on timezone: `new Date('YYYY-MM-DD')` parses as UTC and shifts a day backward
// in negative-offset zones. This module is the single source of truth, and the
// display format is a user preference (default month-first).

const MONTHS_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const
const WEEKDAYS_ABBR = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const

export type DateFormatPref = 'month-first' | 'day-first' | 'iso'

export const DATE_FORMAT_PREFS: DateFormatPref[] = ['month-first', 'day-first', 'iso']

// Module-level current preference. Call sites use `formatDate(value)` without
// threading the pref; App sets it once on load (and on change) via
// setDateFormatPref. Default is month-first.
let currentPref: DateFormatPref = 'month-first'

export function setDateFormatPref(p: DateFormatPref): void {
  currentPref = p
}

export function getDateFormatPref(): DateFormatPref {
  return currentPref
}

/** Coerce a stored value into a valid DateFormatPref, defaulting to month-first. */
export function asDateFormatPref(v: unknown): DateFormatPref {
  return v === 'day-first' || v === 'iso' ? v : 'month-first'
}

interface DateParts {
  y: number
  mo: number // 1-12
  d: number
  hh: number | null
  mm: number | null
}

// Parse the eBird/ISO date shapes the old reimplementations handled, WITHOUT
// any timezone surprises — the Y-M-D parts are read directly, never round-tripped
// through `new Date('YYYY-MM-DD')` (which would parse as UTC and shift the day).
// Handles: "YYYY-MM-DD", "YYYY-MM-DD HH:MM", "YYYY-MM-DDTHH:MM(:SS)", and Date
// objects (read via their LOCAL getters). Returns null for empty/unparseable.
function parseParts(value: string | Date | null | undefined): DateParts | null {
  if (value == null || value === '') return null

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null
    return {
      y: value.getFullYear(),
      mo: value.getMonth() + 1,
      d: value.getDate(),
      hh: value.getHours(),
      mm: value.getMinutes(),
    }
  }

  const m = value.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2}):(\d{2}))?/)
  if (!m) return null
  const y = Number(m[1])
  const mo = Number(m[2])
  const d = Number(m[3])
  if (!y || !mo || !d || mo < 1 || mo > 12 || d < 1 || d > 31) return null
  return {
    y,
    mo,
    d,
    hh: m[4] != null ? Number(m[4]) : null,
    mm: m[5] != null ? Number(m[5]) : null,
  }
}

function formatDateCore(p: DateParts, pref: DateFormatPref, withWeekday: boolean): string {
  let out: string
  switch (pref) {
    case 'day-first':
      out = `${p.d} ${MONTHS_ABBR[p.mo - 1]} ${p.y}`
      break
    case 'iso':
      out = `${p.y}-${String(p.mo).padStart(2, '0')}-${String(p.d).padStart(2, '0')}`
      break
    case 'month-first':
    default:
      out = `${MONTHS_ABBR[p.mo - 1]} ${p.d}, ${p.y}`
      break
  }
  if (withWeekday) {
    // Weekday from a LOCAL Date (no UTC shift: constructed from parts).
    const wd = WEEKDAYS_ABBR[new Date(p.y, p.mo - 1, p.d).getDay()]
    return `${wd}, ${out}`
  }
  return out
}

function formatTimeCore(p: DateParts): string {
  if (p.hh == null) return ''
  const mm = p.mm ?? 0
  // 12-hour clock with am/pm, matching the prior toLocaleTimeString output shape.
  const ampm = p.hh < 12 ? 'AM' : 'PM'
  const h12 = p.hh % 12 === 0 ? 12 : p.hh % 12
  return `${h12}:${String(mm).padStart(2, '0')} ${ampm}`
}

export interface FormatDateOpts {
  /** Prefix with the abbreviated weekday, e.g. "Mon, Jun 8, 2026". */
  withWeekday?: boolean
  /**
   * If the input carries a time component ("YYYY-MM-DD HH:MM" or a Date), append
   * it, e.g. "Jun 8, 2026, 10:55 AM". Date-only inputs are unaffected.
   */
  withTime?: boolean
  /** Override the module preference for this call (rarely needed). */
  pref?: DateFormatPref
}

/**
 * The single canonical date formatter. Accepts the eBird date shapes the old
 * reimplementations handled (YYYY-MM-DD, "YYYY-MM-DD HH:MM", ISO with T, Date
 * objects) and returns '' for empty/invalid input — never throws. Output honors
 * the current user preference (or `opts.pref`).
 *
 * - month-first → "Jun 8, 2026"
 * - day-first   → "8 Jun 2026"
 * - iso         → "2026-06-08"
 */
export function formatDate(
  value: string | Date | null | undefined,
  opts: FormatDateOpts = {},
): string {
  const p = parseParts(value)
  if (!p) return ''
  const pref = opts.pref ?? currentPref
  const datePart = formatDateCore(p, pref, opts.withWeekday ?? false)
  if (opts.withTime) {
    const t = formatTimeCore(p)
    if (t) return `${datePart}, ${t}`
  }
  return datePart
}

/**
 * A compact date range honoring the current preference (or `opts.pref`),
 * collapsing shared parts where the format allows:
 *
 * - month-first → "Mar 1 – 21, 2026" / "Feb 20 – Mar 12, 2026" / "Jun 12, 2024 – Jun 3, 2026"
 * - day-first   → "1 – 21 Mar 2026" / "20 Feb – 12 Mar 2026" / "12 Jun 2024 – 3 Jun 2026"
 * - iso         → always both dates in full
 *
 * Equal dates collapse to a single date; one unparseable side falls back to the
 * other alone; both unparseable → ''. Never throws.
 */
export function formatDateRange(
  start: string | Date | null | undefined,
  end: string | Date | null | undefined,
  opts: Pick<FormatDateOpts, 'pref'> = {},
): string {
  const a = parseParts(start)
  const b = parseParts(end)
  if (!a && !b) return ''
  const pref = opts.pref ?? currentPref
  if (!a || !b) return formatDateCore((a ?? b)!, pref, false)
  if (a.y === b.y && a.mo === b.mo && a.d === b.d) return formatDateCore(a, pref, false)
  if (pref !== 'iso' && a.y === b.y) {
    const sameMonth = a.mo === b.mo
    if (pref === 'day-first') {
      return sameMonth
        ? `${a.d} – ${b.d} ${MONTHS_ABBR[a.mo - 1]} ${a.y}`
        : `${a.d} ${MONTHS_ABBR[a.mo - 1]} – ${b.d} ${MONTHS_ABBR[b.mo - 1]} ${a.y}`
    }
    return sameMonth
      ? `${MONTHS_ABBR[a.mo - 1]} ${a.d} – ${b.d}, ${a.y}`
      : `${MONTHS_ABBR[a.mo - 1]} ${a.d} – ${MONTHS_ABBR[b.mo - 1]} ${b.d}, ${a.y}`
  }
  return `${formatDateCore(a, pref, false)} – ${formatDateCore(b, pref, false)}`
}

/**
 * Whole calendar days between two dates, computed from the Y/M/D parts by
 * integer civil-day arithmetic (FR-01).
 *
 * Reuses this module's `parseParts`, so it inherits the timezone contract: a
 * `YYYY-MM-DD` string is never handed to `new Date(...)` (which parses as UTC
 * and shifts a day backward in negative-offset zones). It never reads the clock,
 * so it is pure and render/memo-safe (react-hooks/purity), and it never throws.
 *
 * Order-insensitive: a reversed pair returns the same magnitude. Returns null
 * when either side is null, empty, or unparseable.
 *
 * TOLERANCE, deliberately left as it is: `parseParts` accepts any day from 1 to
 * 31 for any month, so '2026-02-30' parses. `civilDay` normalizes such a date
 * (Feb 30 becomes Mar 2) rather than rejecting it, so this returns a finite
 * integer for every input `parseParts` accepts. Tightening it would change
 * `formatDate`/`formatDateRange` output for the same inputs on five other
 * surfaces, which is outside this function's remit.
 */
export function elapsedDays(
  from: string | Date | null | undefined,
  to: string | Date | null | undefined,
): number | null {
  const a = civilDaysFrom(from)
  const b = civilDaysFrom(to)
  if (a === null || b === null) return null
  return Math.abs(b - a)
}

/**
 * Days from the civil epoch for a date value, or null when it is null, empty or
 * unparseable — `elapsedDays`'s two halves, exposed because a SIGNED, single-parse
 * offset is what a caller plotting many dates against one axis actually needs.
 * `elapsedDays` returns a magnitude and reparses both sides on every call, so
 * positioning 20,000 marks through it costs 40,000 parses and cannot tell a date
 * BEFORE the axis start from one after it.
 *
 * It is exported from THIS module rather than reimplemented in the caller so
 * there stays exactly one date parser in the app, which is the divergence this
 * module was created to end.
 */
export function civilDaysFrom(value: string | Date | null | undefined): number | null {
  if (typeof value === 'string') {
    const fast = fastCivilDays(value)
    if (fast !== null) return fast
  }
  const p = parseParts(value)
  return p ? civilDay(p.y, p.mo, p.d) : null
}

/**
 * The exact `YYYY-MM-DD` shape — what eBird writes and what `isoDateFromMs`
 * emits — read without a regex, because this runs once per mark and the two
 * `parseParts` calls it replaces dominated the timeline's build cost.
 *
 * It is a FAST PATH, never a second parser: any string it does not recognise
 * returns null and falls through to `parseParts` above, and for the strings it
 * does recognise it must agree with `parseParts` exactly. Its admission rules are
 * `parseParts`'s own, restated: a zero year, a month outside 1 to 12 and a day
 * outside 1 to 31 are all rejected here as they are there. `elapsedDays`'s
 * oracle sweep in `formatDate.test.ts` runs over 180,000 pairs of exactly this
 * shape, so the agreement is measured rather than asserted.
 */
function fastCivilDays(value: string): number | null {
  if (value.length !== 10 || value.charCodeAt(4) !== 45 || value.charCodeAt(7) !== 45) return null
  let y = 0
  let mo = 0
  let d = 0
  for (let i = 0; i < 4; i += 1) {
    const c = value.charCodeAt(i) - 48
    if (c < 0 || c > 9) return null
    y = y * 10 + c
  }
  for (let i = 5; i < 7; i += 1) {
    const c = value.charCodeAt(i) - 48
    if (c < 0 || c > 9) return null
    mo = mo * 10 + c
  }
  for (let i = 8; i < 10; i += 1) {
    const c = value.charCodeAt(i) - 48
    if (c < 0 || c > 9) return null
    d = d * 10 + c
  }
  if (!y || mo < 1 || mo > 12 || d < 1 || d > 31) return null
  return civilDay(y, mo, d)
}

/**
 * Days from the civil epoch (1970-01-01), Howard Hinnant's `days_from_civil`.
 * Pure integer arithmetic over the Y/M/D parts — no `Date`, no clock, correct
 * on the century leap rule (1900 is not a leap year, 2000 is), and it
 * normalizes an out-of-range day rather than rejecting it.
 */
function civilDay(y: number, mo: number, d: number): number {
  const yy = y - (mo <= 2 ? 1 : 0)
  const era = Math.floor(yy / 400)
  const yoe = yy - era * 400                                  // [0, 399]
  const doy = Math.floor((153 * (mo + (mo > 2 ? -3 : 9)) + 2) / 5) + d - 1
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy
  return era * 146097 + doe - 719468
}

/** 30.44 — the mean month length `lib/statsFormat.ts`'s formatSpanLength already uses. */
const DAYS_PER_MONTH = 30.44
const DAYS_PER_YEAR = 365

/**
 * A day count as display text (FR-02, FR-03).
 *
 * It takes a DAY COUNT, not a date pair, so that converging
 * `lib/statsFormat.ts`'s `formatSpanLength(days: number)` onto it later is a
 * call-site change rather than a rewrite (strategic-brief Key Decision 9). The
 * dependency runs that way and only that way: nothing here may import
 * `statsFormat.ts`.
 *
 * The bands, and nothing else:
 *
 *   | day count n            | output                                         |
 *   |------------------------|------------------------------------------------|
 *   | non-finite, or n < 0   | ''                                             |
 *   | n === 0                | `Same day`                                     |
 *   | 1 <= n <= 60           | `N day` / `N days` (exact)                     |
 *   | 61 <= n < 365          | `M mos.` + ` R days`, M = floor(n / 30.44),    |
 *   |                        | R = n - round(M * 30.44), the day part omitted |
 *   |                        | only when R === 0                              |
 *   | n >= 365               | `Y yr.`/`Y yrs.` + ` M mo.`/` M mos.`,         |
 *   |                        | Y = floor(n / 365), M = round((n - Y*365)/     |
 *   |                        | 30.44); the month part omitted only when M is  |
 *   |                        | 0, and M === 12 carries into Y + 1             |
 *
 * EXACTNESS (FR-04). Below 365 days the string is an exact representation of the
 * day count: the parts sum back to n by construction, so the smallest shown unit
 * never stands for a range wider than one of that unit. `2 mos.` means exactly
 * 61 days and nothing else. At or above 365 days the figure is accurate to
 * within half a month.
 *
 * Pure: it reads one integer and the clock is never consulted. Never throws.
 */
export function formatElapsedSpan(days: number): string {
  if (!Number.isFinite(days) || days < 0) return ''
  if (days === 0) return 'Same day'
  if (days <= 60) return `${days} ${days === 1 ? 'day' : 'days'}`
  if (days < DAYS_PER_YEAR) {
    const m = Math.floor(days / DAYS_PER_MONTH)
    const r = days - Math.round(m * DAYS_PER_MONTH)
    const rest = r === 0 ? '' : ` ${r} ${r === 1 ? 'day' : 'days'}`
    return `${m} ${plur(m, 'mo')}.${rest}`
  }
  let y = Math.floor(days / DAYS_PER_YEAR)
  let m = Math.round((days - y * DAYS_PER_YEAR) / DAYS_PER_MONTH)
  if (m === 12) { y += 1; m = 0 }             // 12 mos. is a year, and is never emitted
  const rest = m === 0 ? '' : ` ${m} ${plur(m, 'mo')}.`
  return `${y} ${plur(y, 'yr')}.${rest}`
}

/**
 * A local `YYYY-MM-DD` from an epoch-milliseconds ARGUMENT.
 *
 * It reads the LOCAL getters, so "today" is the user's today rather than UTC's.
 * That is not a breach of this module's timezone contract: the contract forbids
 * constructing a `Date` from a `YYYY-MM-DD` STRING (which parses as UTC and
 * shifts a day); this module already builds a local `Date` from parts for the
 * weekday.
 *
 * THE ZERO-PADDING IS LOAD-BEARING, not cosmetic. Callers compare this value
 * LEXICALLY against eBird's own `YYYY-MM-DD` dates — the same comparison
 * `computeNamedBirds` uses to pick firstSeen/lastSeen. An unpadded `2026-9-6`
 * would sort after `2026-10-01` and quietly break every such comparison.
 *
 * It takes the milliseconds as an argument and therefore never reads the clock;
 * the caller supplies them from a module-level session constant.
 */
export function isoDateFromMs(ms: number): string {
  const d = new Date(ms)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/**
 * The elapsed span between two dates as display text — the call site's entry
 * point, and exactly the composition `formatElapsedSpan(elapsedDays(from, to))`
 * (FR-05).
 *
 * Reuses the module's lexical `parseParts`, so it is timezone-safe, and because
 * it takes BOTH endpoints as arguments and never calls `Date.now()` it is pure
 * and render/memo-safe (react-hooks/purity). Returns '' when either side is
 * null, empty or unparseable, and never throws. A reversed range gives the same
 * answer as the forward one.
 *
 * The bands it prints are `formatElapsedSpan`'s, above:
 *
 *   - 0 days          -> "Same day"
 *   - 1 to 60 days    -> "N days" (exact)
 *   - 61 to 364 days  -> "M mos." plus the exact day remainder, e.g. "2 mos. 29 days"
 *   - 365 days and up -> "Y yrs." plus the rounded month remainder, e.g. "2 yrs. 6 mos."
 *
 * Below 365 days the printed parts sum back to the true day count, so the
 * smallest unit shown never stands for a range wider than one of that unit;
 * at or above 365 days the figure is accurate to within half a month. There is
 * no month borrow and no rounding of the day count: the whole figure is derived
 * from `elapsedDays`, the true number of calendar days between the two dates.
 */
export function formatSightingDuration(
  from: string | null | undefined,
  to: string | null | undefined,
): string {
  const days = elapsedDays(from, to)
  return days === null ? '' : formatElapsedSpan(days)
}

/** "yr"/"yrs", "mo"/"mos" pluralizer. */
function plur(n: number, unit: 'yr' | 'mo'): string {
  return n === 1 ? unit : `${unit}s`
}

// ── Back-compat named exports (kept so existing imports keep working) ──────────

/**
 * Month-first label, e.g. "Jun 8, 2026". Preserved for the call sites that
 * imported it (some aliased as `formatDateLabel` / `fmtDate`). Backed by the
 * canonical core and pinned to month-first so its output is stable regardless of
 * the user's preference — migrate display dates to `formatDate` to make them
 * respond to the preference.
 *
 * Returns '' for empty input and the original string when it can't be parsed
 * (matching the prior contract).
 */
export function formatDateMonthFirst(value: string): string {
  if (!value) return ''
  const p = parseParts(value)
  if (!p) return value
  return formatDateCore(p, 'month-first', false)
}

/** Alias kept for callers that imported `formatDateLabel`. Honors the user pref. */
export function formatDateLabel(value: string | Date | null | undefined): string {
  return formatDate(value)
}
