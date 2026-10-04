// First of Year on Species Detail (species-first-of-year): for the selected
// species, the earliest observation in each calendar year the tab's in-scope
// set holds, derived in one pass over that set.
//
// The input is exactly Species Detail's `speciesObs` (the selected species'
// rows after the Show subspecies merge and the county and date-range filters),
// so this module adds no filtering of its own beyond one shape check (FR-01,
// FR-03). It reads two fields of each observation, `date` and `submissionId`,
// and nothing else.
//
// Dates are the export's own YYYY-MM-DD strings, and they stay strings. The
// year is the numeric value of the first four characters, the ordering is the
// strings' own `<` order, and the day of year comes from a leap-aware month
// table. NO Date OBJECT IS CONSTRUCTED ANYWHERE IN THIS FILE, so the result is
// identical in every time zone and locale and never depends on a clock (FR-04,
// FR-05, FR-07, NFR-08); `firstOfYear.test.ts` runs it with `Date` replaced by
// a constructor that throws, and scans this source for a clock read.
//
// Declared scan (schema.md section 7.1, NFR-09): `isWellFormedDate` is the one
// read this feature adds over user-file text. The length check runs first and
// refuses anything but ten characters in constant time, so it touches at most
// ten characters per observation whatever the cell holds, and the derivation is
// one pass over the observations: O(n) in rows, with a constant of ten
// characters each. It is a character scan with no regex and no native search.
// This file is governed by `.claude/rules/security.md`, whose `paths` list
// names it, for this declared well-formed-date scan.
//
// Linearity (NFR-03): one pass with a Map keyed by year, then one sort over the
// per-year results, which number at most the distinct years present (at most
// 10,000, since a well-formed year is four digits). No module-level cache or
// memo keyed on user content: the only memo is the one `useMemo` in
// SpeciesDetail.tsx, discarded with the observations it was computed from.
//
// Ties (FR-02): iterating in file order, a row replaces the year's kept row only
// when its date is STRICTLY smaller, so of several rows sharing the smallest
// date the first in file order is kept. That is the rule `computeSightingsStats`
// gives First seen (a stable sort over the same strings), which is what makes
// FR-08's invariant hold: wherever First seen's date is well formed, the
// earliest row here is the same observation.

import type { ObservationEntry } from '../types'

/** One calendar year's first in-scope observation. Dates are the export's own
 *  YYYY-MM-DD strings; nothing here is a Date object. */
export type FirstOfYearRow = {
  /** The numeric value of the date's first four characters, 0 to 9999. */
  year: number
  /** The well-formed YYYY-MM-DD string, verbatim. */
  date: string
  /** 1 to 366, leap-aware (FR-05). */
  dayOfYear: number
  /** The observation's submission id, unvalidated; `ChecklistLink` guards it. */
  submissionId: string
}

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
/** Days before the first of each month in a common year. */
const DAYS_BEFORE_MONTH = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334]

const HYPHEN = 45
const ZERO = 48

function isLeapYear(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
}

/** The ASCII digit at `i`, or -1. */
function digitAt(s: string, i: number): number {
  const d = s.charCodeAt(i) - ZERO
  return d >= 0 && d <= 9 ? d : -1
}

/**
 * The date packed as `year * 10000 + month * 100 + day` when it is a
 * well-formed YYYY-MM-DD calendar date, else -1. The length check comes first,
 * so the scan reads at most ten characters (schema.md section 7.1).
 */
function packedDate(date: string): number {
  if (typeof date !== 'string' || date.length !== 10) return -1
  if (date.charCodeAt(4) !== HYPHEN || date.charCodeAt(7) !== HYPHEN) return -1
  const y0 = digitAt(date, 0)
  const y1 = digitAt(date, 1)
  const y2 = digitAt(date, 2)
  const y3 = digitAt(date, 3)
  const m0 = digitAt(date, 5)
  const m1 = digitAt(date, 6)
  const d0 = digitAt(date, 8)
  const d1 = digitAt(date, 9)
  if ((y0 | y1 | y2 | y3 | m0 | m1 | d0 | d1) < 0) return -1
  const year = y0 * 1000 + y1 * 100 + y2 * 10 + y3
  const month = m0 * 10 + m1
  const day = d0 * 10 + d1
  if (month < 1 || month > 12) return -1
  const monthLength = month === 2 && isLeapYear(year) ? 29 : DAYS_IN_MONTH[month - 1]
  if (day < 1 || day > monthLength) return -1
  return year * 10000 + month * 100 + day
}

/**
 * True for exactly the shape YYYY-MM-DD with ASCII digits, a month of 01 to 12
 * and a day within that month's length for that year (February has 29 days in
 * a leap year: divisible by 4, except a century not divisible by 400).
 * Equivalent to `/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/` plus the two range checks.
 */
export function isWellFormedDate(date: string): boolean {
  return packedDate(date) >= 0
}

function dayOfYearFromPacked(packed: number): number {
  const year = Math.floor(packed / 10000)
  const month = Math.floor(packed / 100) % 100
  const day = packed % 100
  return DAYS_BEFORE_MONTH[month - 1] + day + (month > 2 && isLeapYear(year) ? 1 : 0)
}

/**
 * The day of year of a well-formed date: January 1 is 1, February 29 is 60,
 * March 1 is 61 in a leap year and 60 otherwise, December 31 is 366 in a leap
 * year and 365 otherwise. NaN for a date `isWellFormedDate` refuses.
 */
export function dayOfYear(date: string): number {
  const packed = packedDate(date)
  return packed < 0 ? Number.NaN : dayOfYearFromPacked(packed)
}

/**
 * One row per calendar year present among the observations' well-formed dates,
 * each holding that year's lexicographically smallest date (the first in file
 * order on a tie), ASCENDING by year: rows[0] is FR-08's earliest year row. An
 * empty array when no observation has a well-formed date. A malformed date is
 * skipped, never thrown on, and can neither create a year nor be a year's row.
 */
export function computeFirstOfYear(obs: readonly ObservationEntry[]): FirstOfYearRow[] {
  const firstByYear = new Map<number, ObservationEntry>()
  for (const o of obs) {
    const date = o.date
    const packed = packedDate(date)
    if (packed < 0) continue
    const year = Math.floor(packed / 10000)
    const kept = firstByYear.get(year)
    if (kept === undefined || date < kept.date) firstByYear.set(year, o)
  }
  const rows: FirstOfYearRow[] = []
  for (const [year, kept] of firstByYear) {
    rows.push({
      year,
      date: kept.date,
      dayOfYear: dayOfYearFromPacked(packedDate(kept.date)),
      submissionId: kept.submissionId,
    })
  }
  rows.sort((a, b) => a.year - b.year)
  return rows
}
