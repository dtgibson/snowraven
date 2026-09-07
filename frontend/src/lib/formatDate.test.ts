import { describe, it, expect, beforeEach } from 'vitest'
import {
  formatDate,
  formatDateRange,
  formatDateMonthFirst,
  formatDateLabel,
  formatSightingDuration,
  elapsedDays,
  formatElapsedSpan,
  isoDateFromMs,
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

describe('formatSightingDuration — the corrected arithmetic', () => {
  // REWRITTEN, not weakened. Every case below is the case the shipped suite
  // carried, with its intent preserved and its expectation moved to the true
  // day count. The shipped value is recorded beside each one that moved, so the
  // repair is legible rather than looking like a fixture edit.

  it('same-day first and last sighting is not a day (shipped: "1 day")', () => {
    expect(formatSightingDuration('2024-03-14', '2024-03-14')).toBe('Same day')
  })

  it('a multi-day span within a month is exact', () => {
    expect(formatSightingDuration('2024-03-01', '2024-03-06')).toBe('5 days')
    expect(formatSightingDuration('2024-03-01', '2024-03-02')).toBe('1 day')
  })

  it('a multi-month span carries its exact day remainder (shipped: "3 mos." / "1 mo.")', () => {
    // 91 real days, and 91 is not three months: floor(91 / 30.44) = 2, with 30
    // days left over. The old figure discarded that remainder silently.
    expect(formatSightingDuration('2024-01-10', '2024-04-10')).toBe('2 mos. 30 days')
    // 31 days sits in the exact day band now, where the old code printed a month.
    expect(formatSightingDuration('2024-01-10', '2024-02-10')).toBe('31 days')
  })

  it('a multi-year span shows years and the rounded month remainder', () => {
    expect(formatSightingDuration('2022-01-01', '2024-01-01')).toBe('2 yrs.')
    expect(formatSightingDuration('2020-01-01', '2021-01-01')).toBe('1 yr.')
    expect(formatSightingDuration('2022-01-10', '2024-04-10')).toBe('2 yrs. 3 mos.')
    expect(formatSightingDuration('2022-01-10', '2023-03-10')).toBe('1 yr. 2 mos.')
  })

  it('the 30-day borrow is gone: a February span is the true day count', () => {
    // REPLACES the shipped "borrows across a month boundary (30-day
    // approximation)" case, which asserted 15 days for a span that is 14. The
    // borrow was wrong for every month that is not 30 days long, by up to two
    // days, on 22% of pairs within 45 days.
    expect(formatSightingDuration('2024-02-20', '2024-03-05')).toBe('14 days')
  })

  it('treats a reversed range the same as forward', () => {
    expect(formatSightingDuration('2024-04-10', '2024-01-10')).toBe('2 mos. 30 days')
  })

  it('returns "" for empty/invalid input, never throws', () => {
    expect(formatSightingDuration(null, '2024-03-14')).toBe('')
    expect(formatSightingDuration('2024-03-14', null)).toBe('')
    expect(formatSightingDuration('', '')).toBe('')
    expect(formatSightingDuration('not-a-date', '2024-03-14')).toBe('')
    expect(formatSightingDuration('2024-03-14', 'not-a-date')).toBe('')
  })

  // ── The defect class this feature repairs, pair by pair. Every expectation
  // below was run against BOTH the shipped algorithm and this one before it was
  // written down; the shipped answer is in the comment.
  const CASES: ReadonlyArray<[string, string, string, string]> = [
    ['the bridge-ravens defect: a 90-day span is not "2 mos."', '2026-05-21', '2026-08-19', '2 mos. 29 days'],   // shipped: 2 mos.
    ['the same span in a leap year',                            '2024-01-10', '2024-04-09', '2 mos. 29 days'],   // shipped: 2 mos.
    ['the February borrow defect',                              '2026-02-27', '2026-03-01', '2 days'],           // shipped: 4 days
    ['the one-day February case',                               '2026-02-28', '2026-03-01', '1 day'],            // shipped: 3 days
    ['a 364-day span is not "11 mos."',                         '2026-01-01', '2026-12-31', '11 mos. 29 days'],  // shipped: 11 mos.
    ['a month-end start no longer over-claims a month',         '2026-01-31', '2026-03-01', '29 days'],          // shipped: 1 mo.
    ["the reference export's bridge-ravens span",               '2026-05-21', '2026-07-10', '50 days'],          // shipped: 1 mo.
    ['same-day first and last',                                 '2026-07-04', '2026-07-04', 'Same day'],         // shipped: 1 day
    ['a genuine one-day span still reads "1 day"',              '2026-07-04', '2026-07-05', '1 day'],
    ['a clean anniversary',                                     '2025-09-06', '2026-09-06', '1 yr.'],
    ['a multi-year span with months',                           '2024-02-29', '2026-09-06', '2 yrs. 6 mos.'],
    ['the day/month band boundary, low side',                   '2026-01-01', '2026-03-02', '60 days'],
    ['the day/month band boundary, high side',                  '2026-01-01', '2026-03-03', '2 mos.'],
  ]

  it.each(CASES)('%s', (_label, from, to, expected) => {
    expect(formatSightingDuration(from, to)).toBe(expected)
    // Order must not matter.
    expect(formatSightingDuration(to, from)).toBe(expected)
  })

  it('is exactly the composition formatElapsedSpan(elapsedDays(from, to))', () => {
    for (const [, from, to] of CASES) {
      expect(formatSightingDuration(from, to)).toBe(formatElapsedSpan(elapsedDays(from, to)!))
    }
  })
})

describe('elapsedDays', () => {
  /**
   * An INDEPENDENTLY WRITTEN oracle: UTC-midnight epoch arithmetic, which shares
   * no code with the civil-day implementation under test. Both are exact for
   * date-only values, so any disagreement is a real defect rather than a
   * rounding difference.
   */
  const oracle = (a: string, b: string): number => {
    const [ay, am, ad] = a.split('-').map(Number)
    const [by, bm, bd] = b.split('-').map(Number)
    return Math.abs(Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86_400_000))
  }

  it('agrees with the oracle on every pair from 2000 to 2030 at offsets 0 to 400 days', () => {
    // Every day in the range as the left endpoint, against a spread of offsets
    // that straddles every band boundary this feature depends on.
    const OFFSETS = [0, 1, 27, 28, 29, 30, 31, 59, 60, 61, 90, 180, 364, 365, 366, 400]
    const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10)
    let pairs = 0
    const disagreements: string[] = []
    for (let t = Date.UTC(2000, 0, 1); t <= Date.UTC(2030, 11, 31); t += 86_400_000) {
      const from = iso(t)
      for (const off of OFFSETS) {
        const to = iso(t + off * 86_400_000)
        pairs += 1
        if (elapsedDays(from, to) !== oracle(from, to)) disagreements.push(`${from}..${to}`)
      }
    }
    expect(disagreements).toEqual([])
    // Non-vacuity: a loop that never ran would satisfy the assertion above.
    expect(pairs).toBeGreaterThan(150_000)
  })

  it('is right on the century leap rule, not merely on the four-year one', () => {
    expect(elapsedDays('2024-02-28', '2024-03-01')).toBe(2)   // leap
    expect(elapsedDays('2026-02-28', '2026-03-01')).toBe(1)   // not
    expect(elapsedDays('1900-02-28', '1900-03-01')).toBe(1)   // divisible by 100, NOT a leap year
    expect(elapsedDays('2000-02-28', '2000-03-01')).toBe(2)   // divisible by 400, a leap year
  })

  it('is order-insensitive and returns null for anything unparseable', () => {
    expect(elapsedDays('2026-08-19', '2026-05-21')).toBe(elapsedDays('2026-05-21', '2026-08-19'))
    expect(elapsedDays(null, '2026-01-01')).toBeNull()
    expect(elapsedDays('2026-01-01', null)).toBeNull()
    expect(elapsedDays('', '2026-01-01')).toBeNull()
    expect(elapsedDays('not-a-date', '2026-01-01')).toBeNull()
    expect(elapsedDays('2026-13-01', '2026-01-01')).toBeNull()   // month out of range
  })

  it('never throws on a date parseParts admits but the calendar does not have', () => {
    // PRE-EXISTING TOLERANCE, deliberately not fixed here: parseParts accepts any
    // day 1 to 31 for any month, and civilDay normalizes rather than rejecting,
    // so this is a finite integer (Feb 30 is Mar 2). Tightening the parser would
    // change formatDate/formatDateRange output on five other surfaces.
    expect(elapsedDays('2026-02-30', '2026-03-02')).toBe(0)
    expect(() => elapsedDays('2026-02-31', '2026-01-01')).not.toThrow()
  })
})

describe('formatElapsedSpan', () => {
  it('renders the band boundaries exactly', () => {
    expect(formatElapsedSpan(0)).toBe('Same day')
    expect(formatElapsedSpan(1)).toBe('1 day')
    expect(formatElapsedSpan(60)).toBe('60 days')
    expect(formatElapsedSpan(61)).toBe('2 mos.')
    expect(formatElapsedSpan(364)).toBe('11 mos. 29 days')
    expect(formatElapsedSpan(365)).toBe('1 yr.')
    expect(formatElapsedSpan(730)).toBe('2 yrs.')
  })

  it('returns "" for a non-finite or negative input and never throws', () => {
    expect(formatElapsedSpan(-1)).toBe('')
    expect(formatElapsedSpan(NaN)).toBe('')
    expect(formatElapsedSpan(Infinity)).toBe('')
    expect(formatElapsedSpan(-Infinity)).toBe('')
  })

  // ── Exhaustive properties over 0 to 40,000 days (about 110 years).
  const SWEEP = 40_000

  it('emits exactly the twelve documented shapes and nothing else', () => {
    const shapes = new Set<string>()
    for (let n = 0; n <= SWEEP; n += 1) shapes.add(formatElapsedSpan(n).replace(/\d+/g, 'N'))
    expect([...shapes].sort()).toEqual([
      'N day', 'N days',
      'N mos.', 'N mos. N day', 'N mos. N days',
      'N yr.', 'N yr. N mo.', 'N yr. N mos.',
      'N yrs.', 'N yrs. N mo.', 'N yrs. N mos.',
      'Same day',
    ])
  })

  it('never leaves the months band with a day remainder outside 0 to 30', () => {
    for (let n = 61; n < 365; n += 1) {
      const s = formatElapsedSpan(n)
      const r = /(\d+) days?$/.exec(s)
      const remainder = r ? Number(r[1]) : 0
      expect(remainder, `at ${n} days: ${s}`).toBeGreaterThanOrEqual(0)
      expect(remainder, `at ${n} days: ${s}`).toBeLessThanOrEqual(30)
    }
  })

  it('never prints "1 mo." below a year, and never prints "12 mos." at any input', () => {
    let oneMonthBelowAYear = 0
    let twelveMonths = 0
    for (let n = 0; n <= SWEEP; n += 1) {
      const s = formatElapsedSpan(n)
      if (n < 365 && /\b1 mo\./.test(s)) oneMonthBelowAYear += 1
      if (/\b12 mos\./.test(s)) twelveMonths += 1
    }
    expect(oneMonthBelowAYear).toBe(0)
    expect(twelveMonths).toBe(0)
  })

  it('below a year the string reconstructs the day count uniquely, so no figure is ambiguous', () => {
    // QA-17, ASSERTED AS THE PROPERTY THAT IS TRUE. Its literal wording ("exactly
    // one input maps to each remainder-free `M mos.` string") is vacuous for four
    // of the ten such strings: over 61 to 364 only six are ever emitted without a
    // day part, because the day count that would zero the remainder for `3 mos.`,
    // `5 mos.`, `7 mos.` and `10 mos.` falls outside the band that produces that
    // M. What carries the intent is uniqueness, which holds for every string in
    // the band.
    const seen = new Map<string, number>()
    for (let n = 61; n <= 364; n += 1) {
      const s = formatElapsedSpan(n)
      expect(seen.has(s), `${s} is emitted at both ${seen.get(s)} and ${n} days`).toBe(false)
      seen.set(s, n)
    }
    // And the headline case: `2 mos.` means 61 days and no other value.
    expect(formatElapsedSpan(61)).toBe('2 mos.')
    expect([...seen.entries()].filter(([s]) => !s.includes('day'))).toEqual([
      ['2 mos.', 61], ['4 mos.', 122], ['6 mos.', 183],
      ['8 mos.', 244], ['9 mos.', 274], ['11 mos.', 335],
    ])
  })

  it('below a year the printed parts sum back to the day count (the exactness claim)', () => {
    for (let n = 1; n < 365; n += 1) {
      const s = formatElapsedSpan(n)
      const months = Number(/^(\d+) mos?\./.exec(s)?.[1] ?? 0)
      const days = Number(/(\d+) days?/.exec(n <= 60 ? s : s.replace(/^\d+ mos?\./, ''))?.[1] ?? 0)
      expect(months * 30.44 + days, `at ${n}: ${s}`).toBeCloseTo(n, 0)
    }
  })

  it('at or above a year the figure is accurate to within half a month', () => {
    for (let n = 365; n <= SWEEP; n += 1) {
      const s = formatElapsedSpan(n)
      const years = Number(/^(\d+) yrs?\./.exec(s)![1])
      const months = Number(/ (\d+) mos?\.$/.exec(s)?.[1] ?? 0)
      expect(Math.abs(years * 365 + months * 30.44 - n), `at ${n}: ${s}`).toBeLessThanOrEqual(30.44 / 2)
    }
  })
})

describe('isoDateFromMs', () => {
  it('zero-pads a single-digit month and day, which is what keeps it lexically comparable', () => {
    // LOAD-BEARING, not cosmetic: every range comparison in the Named Birds
    // timelines is a lexical compare against eBird's own YYYY-MM-DD dates. An
    // unpadded `2026-9-6` sorts AFTER `2026-10-01` and quietly breaks the clamp.
    expect(isoDateFromMs(new Date(2026, 8, 6, 13, 45).getTime())).toBe('2026-09-06')
    expect(isoDateFromMs(new Date(2026, 0, 1, 0, 0).getTime())).toBe('2026-01-01')
    expect(isoDateFromMs(new Date(2026, 11, 31, 23, 59).getTime())).toBe('2026-12-31')
    expect('2026-09-06' < '2026-10-01').toBe(true)
  })

  it('reads LOCAL getters, so "today" is the user\'s today rather than UTC\'s', () => {
    // Built from local parts, so the round trip is the identity whatever the
    // runner's zone. A UTC-based implementation would shift the day in a
    // negative-offset zone late in the evening.
    const local = new Date(2026, 6, 4, 23, 30)
    expect(isoDateFromMs(local.getTime())).toBe('2026-07-04')
  })

  it('takes its milliseconds as an argument and therefore never reads the clock', () => {
    expect(isoDateFromMs(0)).toBe(isoDateFromMs(0))
  })
})
