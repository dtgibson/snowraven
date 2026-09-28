// What eBird's bar-chart download NAME says (targets-tab, schema.md section
// 2.2; FR-29, FR-30; QA-31, QA-32, QA-70). The parser is defined in
// lib/uploadGuard.ts and re-exported by the module under test; these rows go
// through the re-export, which is the path the Targets chunk uses.
import { describe, it, expect } from 'vitest'
import { parseBarChartFilename, monthsInRange, monthRangeLabel, MONTH_ABBR } from './barChartFilename'

const ALAMEDA = 'ebird_US-CA-001__1900_2026_1_12_barchart.txt'

describe('parseBarChartFilename', () => {
  it('reads eBird\'s download name (QA-31, QA-32)', () => {
    expect(parseBarChartFilename(ALAMEDA)).toEqual({
      regionCode: 'US-CA-001', years: [1900, 2026], months: [1, 12], malformedCode: false,
    })
  })

  it('reads a narrowed range (QA-32: 2015-2026, Mar-May)', () => {
    expect(parseBarChartFilename('ebird_US-CA-001__2015_2026_3_5_barchart.txt')).toEqual({
      regionCode: 'US-CA-001', years: [2015, 2026], months: [3, 5], malformedCode: false,
    })
  })

  it('accepts the ` (1)` a browser appends to a repeated download, and .tsv, in any case', () => {
    expect(parseBarChartFilename('ebird_US-CA-013__1900_2026_1_12_barchart (1).txt').regionCode).toBe('US-CA-013')
    expect(parseBarChartFilename('ebird_US-CA-013__1900_2026_1_12_barchart.TSV').regionCode).toBe('US-CA-013')
    expect(parseBarChartFilename('EBIRD_us-ca-013__1900_2026_1_12_BARCHART.txt').regionCode).toBe('US-CA-013')
  })

  it('reads a wrapping month range (11..2)', () => {
    expect(parseBarChartFilename('ebird_US-MN-053__2000_2026_11_2_barchart.txt').months).toEqual([11, 2])
  })

  it('a name with no code (`barchart.txt`) is all-null and not malformed (FR-29)', () => {
    for (const name of ['barchart.txt', 'my-county.tsv', 'ebird_backup.txt', 'Alameda.txt']) {
      expect(parseBarChartFilename(name)).toEqual({ regionCode: null, years: null, months: null, malformedCode: false })
    }
  })

  it('an eBird-shaped name that does not match is malformed (QA-70)', () => {
    for (const name of [
      'ebird_CA-ON__1900_2026_1_12_barchart.txt',     // a non-US region
      'ebird_US-CA-1__1900_2026_1_12_barchart.txt',    // a short county code
      'ebird_US-CA-001__1900_2026_0_12_barchart.txt',  // month 0
      'ebird_US-CA-001__1900_2026_1_13_barchart.txt',  // month 13
      'ebird_US-CA-001__2026_1900_1_12_barchart.txt',  // years reversed
      'ebird_US-CA-٠٠١__1900_2026_1_12_barchart.txt',  // non-ASCII digits
      'ebird_../../x__1900_2026_1_12_barchart.txt',    // separators
    ]) {
      expect(parseBarChartFilename(name), name).toEqual({ regionCode: null, years: null, months: null, malformedCode: true })
    }
  })

  it('a trailing newline does not match (JavaScript `$` never matches before one)', () => {
    expect(parseBarChartFilename(ALAMEDA + '\n').malformedCode).toBe(true)
  })

  it('the pattern is anchored at both ends: a prefix or a suffix fails it (anchor mutation proof)', () => {
    // Without `^` the first would match; without `$` the second would.
    expect(parseBarChartFilename('x' + ALAMEDA).regionCode).toBeNull()
    expect(parseBarChartFilename(ALAMEDA + '.zip').regionCode).toBeNull()
    expect(parseBarChartFilename(ALAMEDA + '.zip').malformedCode).toBe(true)
  })

  it('a name over 255 characters is no match; eBird-shaped, it is malformed', () => {
    const long = 'ebird_US-CA-001__1900_2026_1_12_barchart' + ' '.repeat(256) + '.txt'
    expect(long.length).toBeGreaterThan(255)
    expect(parseBarChartFilename(long).malformedCode).toBe(true)
    expect(parseBarChartFilename('b'.repeat(252) + '.txt')).toEqual({ regionCode: null, years: null, months: null, malformedCode: false })
  })
})

describe('monthsInRange', () => {
  it('a plain range', () => {
    expect(monthsInRange(3, 5)).toEqual([false, false, true, true, true, false, false, false, false, false, false, false])
  })
  it('all twelve', () => {
    expect(monthsInRange(1, 12).every(Boolean)).toBe(true)
  })
  it('wraps when the begin month is after the end month', () => {
    expect(monthsInRange(11, 2)).toEqual([true, true, false, false, false, false, false, false, false, false, true, true])
  })
  it('one month', () => {
    expect(monthsInRange(9, 9).filter(Boolean)).toHaveLength(1)
  })
  it('an impossible month is the empty set', () => {
    expect(monthsInRange(0, 5).some(Boolean)).toBe(false)
  })
})

describe('monthRangeLabel', () => {
  it('reads the house range forms, ASCII hyphens only', () => {
    expect(monthRangeLabel(monthsInRange(1, 12))).toBe('Jan-Dec')
    expect(monthRangeLabel(monthsInRange(3, 5))).toBe('Mar-May')
    expect(monthRangeLabel(monthsInRange(9, 9))).toBe('Sep')
    expect(monthRangeLabel(monthsInRange(11, 2))).toBe('Nov-Feb')
    expect(monthRangeLabel(new Array(12).fill(false))).toBe('')
  })

  it('joins several runs in calendar order', () => {
    const m = new Array(12).fill(false)
    m[0] = m[1] = m[2] = m[5] = true
    expect(monthRangeLabel(m)).toBe('Jan-Mar, Jun')
    const w = monthsInRange(11, 2)
    w[5] = w[6] = true
    expect(monthRangeLabel(w)).toBe('Jun-Jul, Nov-Feb')
  })

  it('every label over every contiguous range round-trips its months and carries no em or en dash', () => {
    for (let b = 1; b <= 12; b++) {
      for (let e = 1; e <= 12; e++) {
        const label = monthRangeLabel(monthsInRange(b, e))
        expect(label).not.toMatch(/[\u2013\u2014]/)
        if (label === 'Jan-Dec') continue
        const [first, last] = label.split('-')
        expect(first).toBe(MONTH_ABBR[b - 1])
        expect(last ?? first).toBe(MONTH_ABBR[e - 1])
      }
    }
  })
})
