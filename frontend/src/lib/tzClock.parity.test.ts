// SHARED-FIXTURE PARITY TEST -- the TS half of the planner's timezone helper
// pair (tide-weather-planner, schema section 5), on tzClock.fixture.json, which
// backend/tests/test_tz_clock_parity.py also drives. The rows were produced by
// this twin, so this side pins the fixture against regeneration drift and the
// Python side is the cross-check against tzdata; together they are the claim
// that both composers place every instant identically.
import { describe, it, expect } from 'vitest'
import fixture from './tzClock.fixture.json'
import { addDays, localClock, localDate, localMidnightTs, startOfLocalHour, utcOffsetSec } from './tzClock'

interface Row {
  tz: string
  ts: number
  localClock: string
  utcOffsetSec: number
  startOfLocalHour: number
  localMidnightTs: number
  dayLengthSec: number
}
const ROWS = (fixture as { rows: Row[] }).rows

describe('tzClock rows', () => {
  it('cover both DST transitions, the fall-back second pass and a half-hour zone', () => {
    const zones = new Set(ROWS.map(r => r.tz))
    for (const z of ['UTC', 'America/Los_Angeles', 'America/New_York', 'America/Anchorage', 'Pacific/Honolulu', 'Asia/Kolkata']) {
      expect(zones.has(z), z).toBe(true)
    }
    const lengths = new Set(ROWS.map(r => r.dayLengthSec))
    expect(lengths.has(82800) && lengths.has(86400) && lengths.has(90000)).toBe(true)
    const la = ROWS.filter(r => r.tz === 'America/Los_Angeles').map(r => r.localClock)
    expect(new Set(la).size).toBeLessThan(la.length)
    expect(ROWS.some(r => r.tz === 'Asia/Kolkata' && r.utcOffsetSec === 19800)).toBe(true)
    expect(ROWS.length).toBeGreaterThanOrEqual(50)
  })

  it.each(ROWS.map(r => [`${r.tz}@${r.ts}`, r] as const))('%s', (_label, r) => {
    expect(localClock(r.ts, r.tz)).toBe(r.localClock)
    expect(utcOffsetSec(r.ts, r.tz)).toBe(r.utcOffsetSec)
    expect(startOfLocalHour(r.ts, r.tz)).toBe(r.startOfLocalHour)
    const date = localDate(r.ts, r.tz)
    expect(localMidnightTs(date, r.tz)).toBe(r.localMidnightTs)
    expect(localMidnightTs(addDays(date, 1), r.tz) - localMidnightTs(date, r.tz)).toBe(r.dayLengthSec)
  })

  it('the hour start is the LOCATION\'s hour boundary, which differs from UTC\'s in a half-hour zone', () => {
    const ts = Date.UTC(2026, 8, 12, 22, 41) / 1000
    expect(startOfLocalHour(ts, 'Asia/Kolkata')).toBe(Date.UTC(2026, 8, 12, 22, 30) / 1000)
    expect(startOfLocalHour(ts, 'UTC')).toBe(Date.UTC(2026, 8, 12, 22, 0) / 1000)
  })

  it('a non-existent midnight settles on the first existing instant, an ambiguous one on its first pass', () => {
    // Asia/Beirut springs forward at 00:00 on 2026-03-29: midnight does not exist.
    const gap = localMidnightTs('2026-03-29', 'Asia/Beirut')
    expect(localClock(gap, 'Asia/Beirut')).toBe('2026-03-29 01:00')
    expect(localClock(gap - 1, 'Asia/Beirut')).toBe('2026-03-28 23:59')
    // America/Havana falls back at 01:00 on 2026-11-01, so 00:00 to 01:00 occurs twice.
    const fold = localMidnightTs('2026-11-01', 'America/Havana')
    expect(localClock(fold, 'America/Havana')).toBe('2026-11-01 00:00')
    expect(localClock(fold + 3600, 'America/Havana')).toBe('2026-11-01 00:00')
  })
})
