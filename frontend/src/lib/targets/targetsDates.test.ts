// The one local-date helper the sweep, the day cache and the window rule share
// (targets-tab, schema.md 14 verify-item 6: tested at a DST boundary and at midnight).
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { lastNDates, localDateString, SWEEP_DAYS } from './targetsDates'

let savedTz: string | undefined
beforeAll(() => { savedTz = process.env.TZ; process.env.TZ = 'America/Los_Angeles' })
afterAll(() => { if (savedTz === undefined) delete process.env.TZ; else process.env.TZ = savedTz })

describe('localDateString', () => {
  it('is the device-local date, not the UTC one', () => {
    // 2026-09-27 04:30 UTC is still Sep 26 in Los Angeles.
    expect(localDateString(Date.parse('2026-09-27T04:30:00Z'))).toBe('2026-09-26')
  })

  it('turns over exactly at local midnight', () => {
    expect(localDateString(new Date(2026, 8, 26, 23, 59, 59, 999).getTime())).toBe('2026-09-26')
    expect(localDateString(new Date(2026, 8, 27, 0, 0, 0, 0).getTime())).toBe('2026-09-27')
  })
})

describe('lastNDates', () => {
  it('is 30 dates, newest first, today at index 0', () => {
    const d = lastNDates(new Date(2026, 8, 26, 9).getTime())
    expect(d).toHaveLength(SWEEP_DAYS)
    expect(d[0]).toBe('2026-09-26')
    expect(d[29]).toBe('2026-08-28')
  })

  it('never repeats or skips a date across spring-forward and fall-back', () => {
    for (const now of [Date.parse('2026-03-09T12:00:00Z'), Date.parse('2026-03-20T07:30:00Z'), Date.parse('2026-11-02T08:30:00Z')]) {
      const d = lastNDates(now)
      expect(new Set(d).size).toBe(30)
      for (let i = 1; i < d.length; i++) {
        const a = Date.UTC(+d[i - 1].slice(0, 4), +d[i - 1].slice(5, 7) - 1, +d[i - 1].slice(8, 10))
        const b = Date.UTC(+d[i].slice(0, 4), +d[i].slice(5, 7) - 1, +d[i].slice(8, 10))
        expect(a - b).toBe(86_400_000)
      }
    }
  })

  it('crosses a month and a year boundary by calendar arithmetic', () => {
    const d = lastNDates(new Date(2027, 0, 2, 0, 5).getTime(), 3)
    expect(d).toEqual(['2027-01-02', '2027-01-01', '2026-12-31'])
  })
})
