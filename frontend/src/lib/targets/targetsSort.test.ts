// Sorts, availability and the default rule (targets-tab QA-50, QA-51, QA-52, QA-53, QA-36).
import { describe, it, expect } from 'vitest'
import {
  SORT_LABELS, SORT_ORDER, defaultSort, effectiveSort, sortAvailability, sortRows,
  type SortContext, type TargetRow,
} from './targetsSort'
import type { LiveCell } from './targetsLive'

function live(daysReported: number): LiveCell {
  return { daysReported, checkedDays: 30, lastDate: null, place: null, locId: null, lat: null, lng: null, reported: [] }
}

function row(code: string, poolIndex: number, over: Partial<TargetRow> = {}): TargetRow {
  return {
    speciesCode: code, commonName: code, poolIndex, lifer: true, missingMedia: null,
    codes: new Set(), openName: null, sciName: null,
    monthPct: null, yearPct: null, live: null, distanceMi: null, ...over,
  }
}

const ROWS: TargetRow[] = [
  row('a', 3, { commonName: 'Wrentit', monthPct: 2, yearPct: 5, live: live(4), distanceMi: 10 }),
  row('b', 0, { commonName: 'Bushtit', monthPct: 9, yearPct: null, live: live(4), distanceMi: null }),
  row('c', 2, { commonName: 'Sora', monthPct: null, yearPct: 5, live: null, distanceMi: 3 }),
  row('d', 1, { commonName: 'Merlin', monthPct: 2, yearPct: 1, live: live(30), distanceMi: 3 }),
]
const order = (sort: Parameters<typeof sortRows>[1]) => sortRows(ROWS, sort).map(r => r.speciesCode)

describe('the six sorts (QA-50)', () => {
  it('carry the exact FR-48 names, in the control order', () => {
    expect(SORT_ORDER.map(s => SORT_LABELS[s])).toEqual([
      'eBird frequency, this month (%)', 'eBird frequency, year-round (%)', 'Live: days reported, last 30',
      'Distance to last report', 'Alphabetical', 'Taxonomic',
    ])
  })

  it('frequency sorts are descending with null LAST and ties in taxonomic order (QA-36)', () => {
    expect(order('freq-month')).toEqual(['b', 'd', 'a', 'c'])  // d (poolIndex 1) before a (3) at 2%
    expect(order('freq-year')).toEqual(['c', 'a', 'd', 'b'])   // c (2) before a (3) at 5%, b has none
  })

  it('the live sort is descending by days reported, no live data last', () => {
    expect(order('live-days')).toEqual(['d', 'b', 'a', 'c'])
  })

  it('distance is ascending, no distance last', () => {
    expect(order('distance')).toEqual(['d', 'c', 'a', 'b'])
  })

  it('Alphabetical sorts by the displayed common name; Taxonomic by pool order', () => {
    expect(order('alpha')).toEqual(['b', 'd', 'c', 'a'])
    expect(order('taxonomic')).toEqual(['b', 'd', 'c', 'a'])
  })

  it('never mutates its input', () => {
    const before = ROWS.map(r => r.speciesCode)
    sortRows(ROWS, 'alpha')
    expect(ROWS.map(r => r.speciesCode)).toEqual(before)
  })
})

const CTX: SortContext = {
  county: 'Alameda, CA', hasFile: true, monthInRange: true, fullYear: true, monthsLabel: 'Jan-Dec',
  liveAvailable: true, liveMissing: 'no-data', hasAnchor: true,
}

describe('availability (QA-52, QA-53)', () => {
  it('no file: both probability sorts disabled with the prompt', () => {
    const a = sortAvailability({ ...CTX, hasFile: false })
    expect(a['freq-month']).toBe("needs Alameda, CA's bar-chart file")
    expect(a['freq-year']).toBe("needs Alameda, CA's bar-chart file")
    expect(a.alpha).toBeNull()
    expect(a.taxonomic).toBeNull()
  })

  it('a partial-year file disables only year-round, naming what it covers', () => {
    const a = sortAvailability({ ...CTX, fullYear: false, monthsLabel: 'Mar-May' })
    expect(a['freq-month']).toBeNull()
    expect(a['freq-year']).toBe('needs a full-year file (this one covers Mar-May)')
  })

  it('no key: the live sort names the key; cached partial live data: it is enabled', () => {
    expect(sortAvailability({ ...CTX, liveAvailable: false, liveMissing: 'no-key' })['live-days']).toBe('needs an eBird API key')
    expect(sortAvailability({ ...CTX, liveAvailable: true })['live-days']).toBeNull()
  })

  it('no anchor: the distance sort is disabled with the FR-51 reason', () => {
    expect(sortAvailability({ ...CTX, hasAnchor: false }).distance).toBe('choose where to measure from')
  })
})

describe('the default rule (QA-51)', () => {
  it('a county with a file covering this month opens on this month', () => {
    expect(defaultSort(sortAvailability(CTX))).toBe('freq-month')
  })

  it('without a file it opens on the live sort, and without live data on Taxonomic', () => {
    expect(defaultSort(sortAvailability({ ...CTX, hasFile: false }))).toBe('live-days')
    expect(defaultSort(sortAvailability({ ...CTX, hasFile: false, liveAvailable: false }))).toBe('taxonomic')
  })

  it('a user-chosen sort persists while available, and yields to the default when it is not', () => {
    expect(effectiveSort('alpha', sortAvailability({ ...CTX, hasFile: false }))).toBe('alpha')
    expect(effectiveSort('freq-year', sortAvailability({ ...CTX, hasFile: false }))).toBe('live-days')
    expect(effectiveSort(null, sortAvailability(CTX))).toBe('freq-month')
  })
})
