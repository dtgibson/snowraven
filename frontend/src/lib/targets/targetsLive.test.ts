// The live derivation, the window rule and the distance rule (targets-tab
// QA-43, QA-49, QA-55, QA-56, QA-56a). Dates are generated RELATIVE to a fixed
// `now` through the production date helper, never typed as literals, so the
// suite cannot age out on a calendar boundary (testing.md, v1.0.10).
import { describe, it, expect } from 'vitest'
import {
  deriveLive, distanceCell, hiddenByDistance, hiddenByWindow, windowFullyChecked,
  type DayState, type LiveCell,
} from './targetsLive'
import { lastNDates } from './targetsDates'
import type { DayObsEntry } from '../countyDayObsCache'
import type { DayRecord } from '../countyDayObsReduce'

const NOW = new Date(2026, 8, 26, 9, 30).getTime()   // local Sat, Sep 26, 2026, 09:30
const DATES = lastNDates(NOW)                         // newest first

function rec(code: string, date: string, over: Partial<DayRecord> = {}): DayRecord {
  return { speciesCode: code, obsDt: `${date} 08:00`, locId: 'L1', locName: `Place ${date}`, lat: 37.8, lng: -122.2, ...over }
}
function entry(records: DayRecord[]): DayObsEntry {
  return { fetchedAt: NOW, complete: true, bytes: 0, species: records }
}

/** Every day checked; `reportedOn` maps a code to the day offsets (0 = today) it was reported. */
function daysWith(reportedOn: Record<string, number[]>, unchecked: number[] = []): Map<string, DayState> {
  const days = new Map<string, DayState>()
  DATES.forEach((d, i) => {
    if (unchecked.includes(i)) { days.set(d, 'unchecked'); return }
    const recs: DayRecord[] = []
    for (const [code, offs] of Object.entries(reportedOn)) if (offs.includes(i)) recs.push(rec(code, d))
    days.set(d, entry(recs))
  })
  return days
}

const POOL = new Set(['twelve', 'never', 'old', 'recent'])

describe('deriveLive (QA-43, QA-49)', () => {
  it('a species on 12 of 30 days counts 12, with its most recent day, place and coordinates', () => {
    const offsets = [2, 3, 5, 7, 9, 11, 13, 15, 17, 19, 21, 23]
    const cells = deriveLive(DATES, daysWith({ twelve: offsets }), POOL)
    const cell = cells.get('twelve')!
    expect(cell.daysReported).toBe(12)
    expect(cell.checkedDays).toBe(30)
    expect(cell.lastDate).toBe(DATES[2])
    expect(cell.place).toBe(`Place ${DATES[2]}`)
    expect([cell.lat, cell.lng]).toEqual([37.8, -122.2])
    expect(cell.reported.filter(Boolean)).toHaveLength(12)
    expect(cell.reported[2]).toBe(true)
  })

  it('a species absent from every day reads zero with no date, place or distance (QA-49)', () => {
    const cell = deriveLive(DATES, daysWith({ twelve: [1] }), POOL).get('never')!
    expect(cell.daysReported).toBe(0)
    expect(cell.lastDate).toBeNull()
    expect(cell.place).toBeNull()
    expect(distanceCell(cell, { lat: 37, lng: -122 })).toBeNull()
  })

  it('only checked days count, and codes outside the pool are ignored', () => {
    const cells = deriveLive(DATES, daysWith({ twelve: [0, 1, 2], stranger: [0] }, [1]), POOL)
    expect(cells.get('twelve')!.daysReported).toBe(2)
    expect(cells.get('twelve')!.checkedDays).toBe(29)
    expect(cells.has('stranger')).toBe(false)
  })

  it('the last report is the greatest obsDt, not the first seen', () => {
    const days = new Map<string, DayState>([[DATES[0], entry([
      rec('recent', DATES[0], { obsDt: `${DATES[0]} 06:00`, locName: 'Early' }),
      rec('recent', DATES[0], { obsDt: `${DATES[0]} 17:00`, locName: 'Late' }),
    ])]])
    expect(deriveLive(DATES, days, POOL).get('recent')!.place).toBe('Late')
  })
})

describe('the window rule (QA-55, QA-56)', () => {
  const full = daysWith({ recent: [3], old: [8], twelve: [7] })
  const cells = deriveLive(DATES, full, POOL)
  const hidden = (code: string, w: 'any' | 'day' | 'week' | '30', days = full) =>
    hiddenByWindow(deriveLive(DATES, days, POOL).get(code)!, w, windowFullyChecked(w, DATES, days, NOW), NOW)

  it('Any time hides nothing', () => {
    for (const code of POOL) expect(hidden(code, 'any')).toBe(false)
  })

  it('Week on a full sweep hides a report older than 7 days; exactly 7 days stays', () => {
    expect(cells.get('twelve')!.lastDate).toBe(DATES[7])
    expect(hidden('twelve', 'week')).toBe(false)   // exactly 7 days ago
    expect(hidden('old', 'week')).toBe(true)       // 8 days ago
    expect(hidden('recent', 'week')).toBe(false)
    expect(hidden('never', 'week')).toBe(true)
  })

  it('a species not yet found is NOT hidden while a day inside the window is unchecked', () => {
    const partial = daysWith({ recent: [3], old: [8] }, [5])       // day 5 not checked yet
    expect(hidden('never', 'week', partial)).toBe(false)
    expect(hidden('old', 'week', partial)).toBe(false)             // day 5 might hold a newer report
    // ...but an unchecked day OUTSIDE the window does not protect it
    const partialOutside = daysWith({ old: [8] }, [20])
    expect(hidden('old', 'week', partialOutside)).toBe(true)
  })

  it('a failed day counts as unchecked', () => {
    const days = daysWith({})
    days.set(DATES[2], 'failed')
    expect(hidden('never', 'week', days)).toBe(false)
    expect(hidden('never', 'day', days)).toBe(true)   // day 2 is outside Day
  })
})

describe('the distance rule (QA-56a)', () => {
  // A report at a known point, and anchors placed by measured distance from it.
  const at = { lat: 37.8, lng: -122.2 }
  function cellAt(lat: number | null, lng: number | null, lastDate: string | null = DATES[1]): LiveCell {
    return { daysReported: lastDate ? 1 : 0, checkedDays: 30, lastDate, place: 'P', lat, lng, reported: [] }
  }
  // Two anchors straddling 5 miles, found with the production distance function.
  const DEG_PER_MILE = 1 / 69.05
  const near = { lat: at.lat + 4.9 * DEG_PER_MILE, lng: at.lng }
  const far = { lat: at.lat + 5.1 * DEG_PER_MILE, lng: at.lng }

  it('the anchors really do straddle the stop (guards the guard)', () => {
    expect(distanceCell(cellAt(at.lat, at.lng), near)!).toBeLessThan(5)
    expect(distanceCell(cellAt(at.lat, at.lng), far)!).toBeGreaterThan(5)
  })

  it('at 5 miles: 4.9 stays, 5.1 is hidden, no report on a full sweep is hidden', () => {
    expect(hiddenByDistance(cellAt(at.lat, at.lng), 5, near, 'any', true, NOW)).toBe(false)
    expect(hiddenByDistance(cellAt(at.lat, at.lng), 5, far, 'any', true, NOW)).toBe(true)
    expect(hiddenByDistance(cellAt(null, null, null), 5, near, 'any', true, NOW)).toBe(true)
  })

  it('during a partial sweep a species not yet found is not hidden', () => {
    expect(hiddenByDistance(cellAt(null, null, null), 5, near, 'any', false, NOW)).toBe(false)
  })

  it('a report without coordinates is never hidden by distance ("No distance")', () => {
    expect(hiddenByDistance(cellAt(null, null), 1, near, 'any', true, NOW)).toBe(false)
  })

  it('Any distance and no anchor hide nothing', () => {
    expect(hiddenByDistance(cellAt(at.lat, at.lng), null, far, 'any', true, NOW)).toBe(false)
    expect(hiddenByDistance(cellAt(null, null, null), 5, null, 'any', true, NOW)).toBe(false)
  })

  it('combines with the window: a report outside Week counts as no report for the distance rule', () => {
    const old = cellAt(at.lat, at.lng, DATES[10])
    expect(hiddenByDistance(old, 50, near, 'week', true, NOW)).toBe(true)
    expect(hiddenByDistance(old, 50, near, 'any', true, NOW)).toBe(false)
  })
})
