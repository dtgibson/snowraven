import { describe, it, expect, beforeEach } from 'vitest'
import {
  formatDate,
  formatDateRange,
  formatDateMonthFirst,
  formatDateLabel,
  setDateFormatPref,
  getDateFormatPref,
  asDateFormatPref,
  type DateFormatPref,
} from './formatDate'

// The module-level pref is global state; reset to the default before each test
// so cases don't leak into one another.
beforeEach(() => {
  setDateFormatPref('month-first')
})

describe('getDateFormatPref / setDateFormatPref', () => {
  it('defaults to month-first', () => {
    expect(getDateFormatPref()).toBe('month-first')
  })

  it('switches the active preference', () => {
    setDateFormatPref('day-first')
    expect(getDateFormatPref()).toBe('day-first')
    setDateFormatPref('iso')
    expect(getDateFormatPref()).toBe('iso')
  })
})

describe('asDateFormatPref', () => {
  it('passes through valid prefs', () => {
    for (const p of ['month-first', 'day-first', 'iso'] as DateFormatPref[]) {
      expect(asDateFormatPref(p)).toBe(p)
    }
  })
  it('defaults unknown/garbage values to month-first', () => {
    expect(asDateFormatPref('nonsense')).toBe('month-first')
    expect(asDateFormatPref(null)).toBe('month-first')
    expect(asDateFormatPref(undefined)).toBe('month-first')
    expect(asDateFormatPref(42)).toBe('month-first')
  })
})

describe('formatDate — the three formats', () => {
  it('month-first → "Jun 8, 2026"', () => {
    setDateFormatPref('month-first')
    expect(formatDate('2026-06-08')).toBe('Jun 8, 2026')
  })
  it('day-first → "8 Jun 2026"', () => {
    setDateFormatPref('day-first')
    expect(formatDate('2026-06-08')).toBe('8 Jun 2026')
  })
  it('iso → "2026-06-08" (zero-padded)', () => {
    setDateFormatPref('iso')
    expect(formatDate('2026-06-08')).toBe('2026-06-08')
    // single-digit parts round-trip back to padded ISO
    expect(formatDate('2026-3-2')).toBe('2026-03-02')
  })
  it('respects an explicit opts.pref override regardless of the module pref', () => {
    setDateFormatPref('month-first')
    expect(formatDate('2026-06-08', { pref: 'day-first' })).toBe('8 Jun 2026')
    expect(formatDate('2026-06-08', { pref: 'iso' })).toBe('2026-06-08')
    // module pref unchanged by the override
    expect(getDateFormatPref()).toBe('month-first')
  })
})

describe('formatDate — input shapes', () => {
  it('handles a plain YYYY-MM-DD string', () => {
    expect(formatDate('2024-01-05')).toBe('Jan 5, 2024')
    expect(formatDate('2023-12-31')).toBe('Dec 31, 2023')
  })
  it('handles "YYYY-MM-DD HH:MM" (date-time), dropping the time by default', () => {
    expect(formatDate('2024-07-09 06:30')).toBe('Jul 9, 2024')
  })
  it('handles ISO with a T separator', () => {
    expect(formatDate('2024-01-05T10:55')).toBe('Jan 5, 2024')
    expect(formatDate('2024-01-05T10:55:30')).toBe('Jan 5, 2024')
  })
  it('handles a Date object via its LOCAL parts', () => {
    const d = new Date(2024, 0, 5) // local Jan 5 2024
    expect(formatDate(d)).toBe('Jan 5, 2024')
  })
})

describe('formatDate — empty / invalid', () => {
  it('returns "" for empty, null, undefined', () => {
    expect(formatDate('')).toBe('')
    expect(formatDate(null)).toBe('')
    expect(formatDate(undefined)).toBe('')
  })
  it('returns "" for unparseable strings', () => {
    expect(formatDate('not a date')).toBe('')
    expect(formatDate('2024')).toBe('')
    expect(formatDate('2024-13-40')).toBe('') // out-of-range month/day
  })
  it('returns "" for an invalid Date object', () => {
    expect(formatDate(new Date('invalid'))).toBe('')
  })
})

describe('formatDate — no UTC shift', () => {
  // The classic bug: `new Date('2026-01-01')` is parsed as UTC midnight, which
  // in any negative-offset zone is Dec 31 of the prior year. The canonical
  // formatter parses the Y-M-D parts directly, so the day/month/year are taken
  // verbatim from the string — never shifted — in every timezone.
  it('keeps the exact Y-M-D from the string (month-first)', () => {
    expect(formatDate('2026-01-01')).toBe('Jan 1, 2026')
    expect(formatDate('2026-12-31')).toBe('Dec 31, 2026')
  })
  it('keeps the exact Y-M-D from the string (iso round-trip)', () => {
    setDateFormatPref('iso')
    expect(formatDate('2026-01-01')).toBe('2026-01-01')
    expect(formatDate('2026-12-31')).toBe('2026-12-31')
  })
})

describe('formatDate — withWeekday', () => {
  it('prefixes the abbreviated weekday', () => {
    // 2026-06-08 is a Monday.
    expect(formatDate('2026-06-08', { withWeekday: true })).toBe('Mon, Jun 8, 2026')
  })
})

describe('formatDate — withTime', () => {
  it('appends a 12-hour time when present', () => {
    expect(formatDate('2026-06-08 10:55', { withTime: true })).toBe('Jun 8, 2026, 10:55 AM')
    expect(formatDate('2026-06-08 13:05', { withTime: true })).toBe('Jun 8, 2026, 1:05 PM')
    expect(formatDate('2026-06-08 00:00', { withTime: true })).toBe('Jun 8, 2026, 12:00 AM')
    expect(formatDate('2026-06-08 12:00', { withTime: true })).toBe('Jun 8, 2026, 12:00 PM')
  })
  it('omits the time for a date-only input even when withTime is set', () => {
    expect(formatDate('2026-06-08', { withTime: true })).toBe('Jun 8, 2026')
  })
  it('combines pref + time', () => {
    setDateFormatPref('day-first')
    expect(formatDate('2026-06-08 09:30', { withTime: true })).toBe('8 Jun 2026, 9:30 AM')
  })
})

describe('setDateFormatPref switches output for the same input', () => {
  it('re-formats the same value across all three prefs', () => {
    const v = '2026-06-08'
    setDateFormatPref('month-first')
    expect(formatDate(v)).toBe('Jun 8, 2026')
    setDateFormatPref('day-first')
    expect(formatDate(v)).toBe('8 Jun 2026')
    setDateFormatPref('iso')
    expect(formatDate(v)).toBe('2026-06-08')
  })
})

describe('back-compat exports', () => {
  it('formatDateMonthFirst formats month-first', () => {
    expect(formatDateMonthFirst('2024-01-05')).toBe('Jan 5, 2024')
    expect(formatDateMonthFirst('2023-12-31')).toBe('Dec 31, 2023')
  })
  it('formatDateMonthFirst strips a trailing time component', () => {
    expect(formatDateMonthFirst('2024-07-09 06:30')).toBe('Jul 9, 2024')
  })
  it('formatDateMonthFirst stays month-first regardless of the module pref', () => {
    setDateFormatPref('day-first')
    expect(formatDateMonthFirst('2026-06-08')).toBe('Jun 8, 2026')
    setDateFormatPref('iso')
    expect(formatDateMonthFirst('2026-06-08')).toBe('Jun 8, 2026')
  })
  it('formatDateMonthFirst returns "" for empty and the raw string when unparseable', () => {
    expect(formatDateMonthFirst('')).toBe('')
    expect(formatDateMonthFirst('not-a-date')).toBe('not-a-date')
  })
  it('formatDateLabel honors the active pref (alias of formatDate)', () => {
    setDateFormatPref('day-first')
    expect(formatDateLabel('2026-06-08')).toBe('8 Jun 2026')
    expect(formatDateLabel('')).toBe('')
  })
})

describe('formatDateRange', () => {
  it('collapses a same-month range (month-first)', () => {
    expect(formatDateRange('2026-03-01', '2026-03-21')).toBe('Mar 1 – 21, 2026')
  })
  it('collapses a same-year range (month-first)', () => {
    expect(formatDateRange('2026-02-20', '2026-03-12')).toBe('Feb 20 – Mar 12, 2026')
  })
  it('spells both dates in full across years', () => {
    expect(formatDateRange('2024-06-12', '2026-06-03')).toBe('Jun 12, 2024 – Jun 3, 2026')
  })
  it('collapses equal dates to a single date', () => {
    expect(formatDateRange('2026-03-01', '2026-03-01')).toBe('Mar 1, 2026')
  })
  it('honors day-first and iso prefs', () => {
    setDateFormatPref('day-first')
    expect(formatDateRange('2026-03-01', '2026-03-21')).toBe('1 – 21 Mar 2026')
    expect(formatDateRange('2026-02-20', '2026-03-12')).toBe('20 Feb – 12 Mar 2026')
    setDateFormatPref('iso')
    expect(formatDateRange('2026-03-01', '2026-03-21')).toBe('2026-03-01 – 2026-03-21')
  })
  it('falls back to the parseable side and returns "" when neither parses', () => {
    expect(formatDateRange('2026-03-01', '')).toBe('Mar 1, 2026')
    expect(formatDateRange(null, '2026-03-21')).toBe('Mar 21, 2026')
    expect(formatDateRange('', null)).toBe('')
  })
})
