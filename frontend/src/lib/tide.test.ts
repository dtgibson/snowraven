import { describe, it, expect } from 'vitest'
import {
  parseObserved, parsePredictions, parseHiLo, computeTideReading,
  isNoaaError, clockTime, ft, normalizeObsDt, shiftLocal, toNoaaDate,
} from './tide'
import type { TideStation } from './tideStations'

const STN: TideStation = { id: '9414290', name: 'San Francisco', lat: 37.8, lng: -122.5, state: 'CA', obs: true }

describe('NOAA body parsing', () => {
  it('detects the error body shape', () => {
    expect(isNoaaError({ error: { message: 'No data was found.' } })).toBe(true)
    expect(isNoaaError({ data: [] })).toBe(false)
  })
  it('parses observed water_level data, skipping bad values', () => {
    const body = { data: [{ t: '2025-08-02 07:42', v: '3.281', q: 'v' }, { t: '2025-08-02 07:48', v: 'x' }] }
    const out = parseObserved(body)
    expect(out).toHaveLength(1)
    expect(out[0]).toEqual({ t: '2025-08-02 07:42', v: 3.281, q: 'v' })
  })
  it('returns [] for an error body', () => {
    expect(parseObserved({ error: { message: 'no' } })).toEqual([])
    expect(parsePredictions({ error: { message: 'no' } })).toEqual([])
    expect(parseHiLo({ error: { message: 'no' } })).toEqual([])
  })
  it('parses hilo with H/L types only', () => {
    const out = parseHiLo({ predictions: [{ t: '2025-08-02 04:28', v: '5.1', type: 'H' }, { t: '2025-08-02 10:55', v: '0.6', type: 'L' }, { t: 'x', v: '1', type: 'Z' }] })
    expect(out).toHaveLength(2)
    expect(out[0].type).toBe('H')
  })
})

describe('computeTideReading', () => {
  const hilo = [
    { t: '2025-08-02 05:02', v: 0.6, type: 'L' as const },
    { t: '2025-08-02 11:18', v: 5.1, type: 'H' as const },
  ]
  it('uses observed levels in the window and reports a rising range', () => {
    const obs = [
      { t: '2025-08-02 07:42', v: 3.2, q: 'v' },
      { t: '2025-08-02 08:42', v: 4.1, q: 'v' },
    ]
    const r = computeTideReading('2025-08-02 07:42', '2025-08-02 08:42', obs, [], hilo, STN, 3.4)!
    expect(r.source).toBe('observed')
    expect(r.levelMin).toBeCloseTo(3.2)
    expect(r.levelMax).toBeCloseTo(4.1)
    expect(r.trend).toBe('rising')
    expect(r.prevHL).toEqual({ kind: 'low', v: 0.6, timeLocal: '5:02am' })
    expect(r.nextHL).toEqual({ kind: 'high', v: 5.1, timeLocal: '11:18am' })
    expect(r.turnedDuring).toBe(false)
  })
  it('falls back to predicted when observed is empty/error', () => {
    const r = computeTideReading('2025-08-02 07:42', '2025-08-02 08:42', [], [{ t: '2025-08-02 08:00', v: 2.7 }], hilo, STN, 7.8)!
    expect(r.source).toBe('predicted')
    expect(r.levelMin).toBeCloseTo(2.7)
  })
  it('flags turnedDuring when an H/L falls inside the window', () => {
    const r = computeTideReading('2025-08-02 11:00', '2025-08-02 12:00', [{ t: '2025-08-02 11:30', v: 5.0, q: 'v' }], [], hilo, STN, 1)!
    expect(r.turnedDuring).toBe(true)
  })
  it('returns null when there is no data at all', () => {
    expect(computeTideReading('2025-08-02 07:42', '2025-08-02 08:42', [], [], [], STN, 1)).toBeNull()
  })
})

describe('formatting helpers', () => {
  it('clockTime converts 24h to 12h', () => {
    expect(clockTime('2025-08-02 07:42')).toBe('7:42am')
    expect(clockTime('2025-08-02 14:05')).toBe('2:05pm')
    expect(clockTime('2025-08-02 00:15')).toBe('12:15am')
    expect(clockTime('2025-08-02 12:00')).toBe('12:00pm')
  })
  it('ft rounds to one decimal', () => {
    expect(ft(3.281)).toBe('3.3')
    expect(ft(0.6)).toBe('0.6')
  })
})

describe('window helpers', () => {
  it('normalizeObsDt adds midnight to a date-only value', () => {
    expect(normalizeObsDt('2025-08-02')).toBe('2025-08-02 00:00')
    expect(normalizeObsDt('2025-08-02 07:42')).toBe('2025-08-02 07:42')
  })
  it('shiftLocal adds fractional hours with day rollover', () => {
    expect(shiftLocal('2025-08-02 07:42', 1.5)).toBe('2025-08-02 09:12')
    expect(shiftLocal('2025-08-02 23:30', 1)).toBe('2025-08-03 00:30')
    expect(shiftLocal('2025-08-02 00:30', -1)).toBe('2025-08-01 23:30')
  })
  it('toNoaaDate formats for the NOAA begin/end_date param', () => {
    expect(toNoaaDate('2025-08-02 07:42')).toBe('20250802 07:42')
    expect(toNoaaDate('2025-08-02')).toBe('20250802 00:00')
  })
})
