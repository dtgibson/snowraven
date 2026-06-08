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
