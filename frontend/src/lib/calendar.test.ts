import { describe, it, expect } from 'vitest'
import type { ObservationEntry } from '../types'
import {
  buildDayCells, dataYears, defaultYear, adjacentDataYear, metricCount,
  nonZeroMetricCounts, individualsOf, daysInMonth, dayOfWeek, isValidDateString, isValidCalendarDay,
  dateParts, type CalendarView,
} from './calendar'
import { computeCountyTiers } from './countyShading'

// A minimal ObservationEntry factory — only the fields buildDayCells reads.
function obs(partial: Partial<ObservationEntry> & { date: string; submissionId: string; commonName: string }): ObservationEntry {
  return {
    submissionId: partial.submissionId,
    commonName: partial.commonName,
    scientificName: partial.scientificName ?? 'Sci name',
    date: partial.date,
    location: partial.location ?? 'Loc',
    locationId: partial.locationId ?? 'L1',
    latitude: null,
    longitude: null,
    county: partial.county ?? null,
    count: 'count' in partial ? (partial.count ?? null) : 1,
    breedingCode: null,
    speciesComments: '',
    catalogIds: [],
  }
}

describe('date helpers — lexical, no new Date() (QA-08/QA-12/QA-15)', () => {
  it('daysInMonth handles leap years (QA-15)', () => {
    expect(daysInMonth(2024, 2)).toBe(29)
    expect(daysInMonth(2023, 2)).toBe(28)
    expect(daysInMonth(2000, 2)).toBe(29) // divisible by 400
    expect(daysInMonth(1900, 2)).toBe(28) // divisible by 100 not 400
    expect(daysInMonth(2024, 1)).toBe(31)
    expect(daysInMonth(2024, 4)).toBe(30)
  })

  it('isValidCalendarDay rejects impossible days', () => {
    expect(isValidCalendarDay(2023, 2, 30)).toBe(false)
    expect(isValidCalendarDay(2024, 2, 29)).toBe(true)
    expect(isValidCalendarDay(2023, 2, 29)).toBe(false)
    expect(isValidCalendarDay(2024, 13, 1)).toBe(false)
    expect(isValidCalendarDay(2024, 0, 1)).toBe(false)
    expect(isValidCalendarDay(2024, 12, 0)).toBe(false)
  })

  it('isValidDateString rejects malformed dates incl. non-ASCII digits (QA-12)', () => {
    expect(isValidDateString('2024-03-14')).toBe(true)
    expect(isValidDateString('')).toBe(false)
    expect(isValidDateString('2024-13-40')).toBe(false)
    expect(isValidDateString('2023-02-30')).toBe(false)
    expect(isValidDateString('2024-3-14')).toBe(false) // not zero-padded
    // Arabic-Indic digits — JS \d would be ASCII-only but the explicit class makes it unmistakable
    expect(isValidDateString('٢٠٢٤-٠٣-١٤')).toBe(false)
    expect(isValidDateString('2024-03-14T00:00')).toBe(false) // extra chars
  })

  it('dateParts slices lexically', () => {
    expect(dateParts('2024-03-14')).toEqual({ year: 2024, month: 3, day: 14 })
  })

  it('dayOfWeek is pure arithmetic (0=Sunday), verified against known dates', () => {
    // 2024-03-14 was a Thursday (4)
    expect(dayOfWeek(2024, 3, 14)).toBe(4)
    // 2000-01-01 was a Saturday (6)
    expect(dayOfWeek(2000, 1, 1)).toBe(6)
    // 2025-01-01 was a Wednesday (3)
    expect(dayOfWeek(2025, 1, 1)).toBe(3)
    // 2000-02-29 was a Tuesday (2)
    expect(dayOfWeek(2000, 2, 29)).toBe(2)
  })
})

describe('buildDayCells — year view (QA-08/09/10/11)', () => {
  const view: CalendarView = { kind: 'year', year: 2024 }

  it('buckets a row to its lexical date, no timezone shift (QA-08)', () => {
    const cells = buildDayCells([
      obs({ date: '2024-03-14', submissionId: 'S1', commonName: 'American Robin' }),
    ], view)
    expect(cells.has('2024-03-14')).toBe(true)
    expect(cells.get('2024-03-14')!.speciesCount).toBe(1)
  })

  it('dedups the same species across checklists on the same day once (QA-09)', () => {
    const cells = buildDayCells([
      obs({ date: '2024-03-14', submissionId: 'S1', commonName: 'American Robin' }),
      obs({ date: '2024-03-14', submissionId: 'S2', commonName: 'American Robin' }),
      obs({ date: '2024-03-14', submissionId: 'S2', commonName: 'Song Sparrow' }),
    ], view)
    const c = cells.get('2024-03-14')!
    expect(c.speciesCount).toBe(2) // Robin (once) + Sparrow
    expect(c.checklistCount).toBe(2) // S1, S2
  })

  it('excludes spuh/slash/hybrid from countable speciesCount, counts them in withForms (QA-10)', () => {
    const cells = buildDayCells([
      obs({ date: '2024-03-14', submissionId: 'S1', commonName: 'American Robin' }),
      obs({ date: '2024-03-14', submissionId: 'S1', commonName: 'gull sp.' }),
      obs({ date: '2024-03-14', submissionId: 'S1', commonName: 'Greater/Lesser Scaup' }),
      obs({ date: '2024-03-14', submissionId: 'S1', commonName: 'Mallard x American Black Duck' }),
    ], view)
    const c = cells.get('2024-03-14')!
    expect(c.speciesCount).toBe(1) // only Robin is countable
    expect(c.speciesCountWithForms).toBe(4) // all four distinct names
    expect(c.speciesCountWithForms).toBeGreaterThanOrEqual(c.speciesCount)
  })

  it('a spuh-only checklist still counts as a checklist (QA-11)', () => {
    const cells = buildDayCells([
      obs({ date: '2024-03-14', submissionId: 'S9', commonName: 'gull sp.' }),
    ], view)
    const c = cells.get('2024-03-14')!
    expect(c.speciesCount).toBe(0) // present-but-zero
    expect(c.speciesCountWithForms).toBe(1)
    expect(c.checklistCount).toBe(1)
  })

  it('dedups checklists by submissionId (QA-11)', () => {
    const cells = buildDayCells([
      obs({ date: '2024-03-14', submissionId: 'S1', commonName: 'American Robin' }),
      obs({ date: '2024-03-14', submissionId: 'S1', commonName: 'Song Sparrow' }),
      obs({ date: '2024-03-14', submissionId: 'S2', commonName: 'American Robin' }),
    ], view)
    expect(cells.get('2024-03-14')!.checklistCount).toBe(2)
  })

  it('drops malformed-date rows per row; a checklist lands on its valid rows date (QA-12)', () => {
    const cells = buildDayCells([
      obs({ date: '', submissionId: 'S1', commonName: 'American Robin' }),
      obs({ date: '2024-13-40', submissionId: 'S2', commonName: 'Song Sparrow' }),
      obs({ date: '2024-03-14', submissionId: 'S3', commonName: 'American Robin' }),
    ], view)
    expect(cells.size).toBe(1)
    expect(cells.has('2024-03-14')).toBe(true)
    expect(cells.get('2024-03-14')!.checklistCount).toBe(1)
  })

  it('only buckets rows for the target year', () => {
    const cells = buildDayCells([
      obs({ date: '2024-03-14', submissionId: 'S1', commonName: 'American Robin' }),
      obs({ date: '2023-03-14', submissionId: 'S2', commonName: 'American Robin' }),
    ], view)
    expect(cells.size).toBe(1)
    expect(cells.has('2024-03-14')).toBe(true)
  })

  it('records checklist submission ids with their full dates', () => {
    const cells = buildDayCells([
      obs({ date: '2024-03-14', submissionId: 'S1', commonName: 'American Robin' }),
    ], view)
    expect(cells.get('2024-03-14')!.checklists).toEqual([{ submissionId: 'S1', date: '2024-03-14' }])
  })
})

describe('buildDayCells — combined view (QA-16/17/18/19)', () => {
  const view: CalendarView = { kind: 'combined' }

  it('combined Species is a cross-year UNION (1, not 3) (QA-17)', () => {
    const cells = buildDayCells([
      obs({ date: '2022-01-12', submissionId: 'S1', commonName: 'American Robin' }),
      obs({ date: '2023-01-12', submissionId: 'S2', commonName: 'American Robin' }),
      obs({ date: '2024-01-12', submissionId: 'S3', commonName: 'American Robin' }),
    ], view)
    const c = cells.get('01-12')!
    expect(c.speciesCount).toBe(1) // union: Robin once
  })

  it('combined Species UNION over DIFFERENT species per year is the union size, and >= any single year (QA-17)', () => {
    // Jan-12 has DIFFERENT species across two years: 2023 = Robin+Jay, 2024 = Crow.
    // The combined bucket must be the UNION (3), and can never be less than either
    // single year's value for that day (union ⊇ each year's set).
    const rows: ObservationEntry[] = [
      obs({ date: '2023-01-12', submissionId: 'S1', commonName: 'American Robin' }),
      obs({ date: '2023-01-12', submissionId: 'S1', commonName: 'Blue Jay' }),
      obs({ date: '2024-01-12', submissionId: 'S2', commonName: 'American Crow' }),
    ]
    const y2023 = buildDayCells(rows, { kind: 'year', year: 2023 }).get('2023-01-12')!.speciesCount
    const y2024 = buildDayCells(rows, { kind: 'year', year: 2024 }).get('2024-01-12')!.speciesCount
    const combined = buildDayCells(rows, view).get('01-12')!.speciesCount
    expect(y2023).toBe(2)
    expect(y2024).toBe(1)
    expect(combined).toBe(3) // union of Robin, Jay, Crow
    expect(combined).toBeGreaterThanOrEqual(Math.max(y2023, y2024)) // the reported-impossible case
  })

  it('combined Checklists is a SUM across years (6) (QA-18)', () => {
    const rows: ObservationEntry[] = []
    for (const y of [2022, 2023, 2024]) {
      rows.push(obs({ date: `${y}-01-12`, submissionId: `S${y}a`, commonName: 'American Robin' }))
      rows.push(obs({ date: `${y}-01-12`, submissionId: `S${y}b`, commonName: 'Song Sparrow' }))
    }
    const cells = buildDayCells(rows, view)
    expect(cells.get('01-12')!.checklistCount).toBe(6) // 3 years × 2 distinct checklists
  })

  it('a Feb-29 bucket exists only when a real leap-year Feb-29 row lands (QA-16/19)', () => {
    const withLeap = buildDayCells([
      obs({ date: '2024-02-29', submissionId: 'S1', commonName: 'American Robin' }),
    ], view)
    expect(withLeap.has('02-29')).toBe(true)

    const noLeap = buildDayCells([
      obs({ date: '2023-02-28', submissionId: 'S1', commonName: 'American Robin' }),
    ], view)
    expect(noLeap.has('02-29')).toBe(false)
  })

  it('Feb-29 is never merged onto Feb-28 / Mar-1', () => {
    const cells = buildDayCells([
      obs({ date: '2024-02-28', submissionId: 'S1', commonName: 'American Robin' }),
      obs({ date: '2024-02-29', submissionId: 'S2', commonName: 'Song Sparrow' }),
      obs({ date: '2024-03-01', submissionId: 'S3', commonName: 'Blue Jay' }),
    ], view)
    expect(cells.get('02-28')!.speciesCount).toBe(1)
    expect(cells.get('02-29')!.speciesCount).toBe(1)
    expect(cells.get('03-01')!.speciesCount).toBe(1)
  })
})

describe('buildDayCells — per-species filter (change 2)', () => {
  const year: CalendarView = { kind: 'year', year: 2024 }

  it('null/undefined filter leaves the derivation unchanged', () => {
    const rows = [
      obs({ date: '2024-03-14', submissionId: 'S1', commonName: 'American Robin' }),
      obs({ date: '2024-03-14', submissionId: 'S1', commonName: 'Song Sparrow' }),
    ]
    const all = buildDayCells(rows, year)
    const explicitUndefined = buildDayCells(rows, year, undefined)
    expect(all.get('2024-03-14')!.speciesCount).toBe(2)
    expect(explicitUndefined.get('2024-03-14')!.speciesCount).toBe(2)
  })

  it('a concrete filter counts only that species, per day', () => {
    const cells = buildDayCells([
      obs({ date: '2024-03-14', submissionId: 'S1', commonName: 'American Robin' }),
      obs({ date: '2024-03-14', submissionId: 'S1', commonName: 'Song Sparrow' }),
      obs({ date: '2024-03-15', submissionId: 'S2', commonName: 'American Robin' }),
      obs({ date: '2024-03-16', submissionId: 'S3', commonName: 'Song Sparrow' }),
    ], year, 'American Robin')
    // Only the Robin days survive; each is a presence (speciesCount 1).
    expect(cells.get('2024-03-14')!.speciesCount).toBe(1)
    expect(cells.get('2024-03-15')!.speciesCount).toBe(1)
    // 03-16 (Sparrow only) is dropped entirely.
    expect(cells.has('2024-03-16')).toBe(false)
  })

  it('the Checklists metric counts checklists that recorded the filtered species', () => {
    const cells = buildDayCells([
      obs({ date: '2024-03-14', submissionId: 'S1', commonName: 'American Robin' }),
      obs({ date: '2024-03-14', submissionId: 'S2', commonName: 'American Robin' }),
      obs({ date: '2024-03-14', submissionId: 'S3', commonName: 'Song Sparrow' }), // no Robin → excluded
    ], year, 'American Robin')
    // S1 and S2 recorded the Robin; S3 didn't and doesn't count.
    expect(cells.get('2024-03-14')!.checklistCount).toBe(2)
  })

  it('folds subspecies/form parentheticals into the normalized parent', () => {
    const cells = buildDayCells([
      obs({ date: '2024-03-14', submissionId: 'S1', commonName: 'Dark-eyed Junco (Oregon)' }),
      obs({ date: '2024-03-15', submissionId: 'S2', commonName: 'Dark-eyed Junco (Slate-colored)' }),
    ], year, 'Dark-eyed Junco')
    expect(cells.has('2024-03-14')).toBe(true)
    expect(cells.has('2024-03-15')).toBe(true)
  })

  it('combined view aggregates the one species across years', () => {
    const cells = buildDayCells([
      obs({ date: '2022-01-12', submissionId: 'S1', commonName: 'American Robin' }),
      obs({ date: '2023-01-12', submissionId: 'S2', commonName: 'American Robin' }),
      obs({ date: '2023-01-12', submissionId: 'S3', commonName: 'Song Sparrow' }), // other species
    ], { kind: 'combined' }, 'American Robin')
    const c = cells.get('01-12')!
    expect(c.speciesCount).toBe(1) // Robin, union across 2022+2023
    expect(c.checklistCount).toBe(2) // S1 + S2 (Robin checklists); S3 excluded
  })

  it('a species with no data in the year yields an empty (blank) grid', () => {
    const cells = buildDayCells([
      obs({ date: '2024-03-14', submissionId: 'S1', commonName: 'American Robin' }),
    ], year, 'Snowy Owl')
    expect(cells.size).toBe(0)
  })
})

describe('metricCount / nonZeroMetricCounts — includeNonCountable BOTH flags (QA-49)', () => {
  const view: CalendarView = { kind: 'year', year: 2024 }
  const spuhOnly = buildDayCells([
    obs({ date: '2024-05-01', submissionId: 'S1', commonName: 'gull sp.' }),
    obs({ date: '2024-05-02', submissionId: 'S2', commonName: 'American Robin' }),
    obs({ date: '2024-05-02', submissionId: 'S2', commonName: 'gull sp.' }),
  ], view)

  it('OFF: spuh-only day Species = 0 and absent from the non-zero tiering set', () => {
    const day = spuhOnly.get('2024-05-01')!
    expect(metricCount(day, 'species', false)).toBe(0)
    const counts = nonZeroMetricCounts(spuhOnly, 'species', false)
    // 05-01 contributes 0 (excluded); 05-02 contributes 1 (Robin)
    expect(counts.sort()).toEqual([1])
  })

  it('ON: spuh-only day Species = its withForms count (>0) and enters the tiering set', () => {
    const day = spuhOnly.get('2024-05-01')!
    expect(metricCount(day, 'species', true)).toBe(1)
    const counts = nonZeroMetricCounts(spuhOnly, 'species', true)
    // 05-01 → 1 (gull sp.); 05-02 → 2 (Robin + gull sp.)
    expect(counts.sort((a, b) => a - b)).toEqual([1, 2])
  })

  it('Checklists branch ignores includeNonCountable entirely', () => {
    const day = spuhOnly.get('2024-05-01')!
    expect(metricCount(day, 'checklists', false)).toBe(1)
    expect(metricCount(day, 'checklists', true)).toBe(1)
    const off = nonZeroMetricCounts(spuhOnly, 'checklists', false)
    const on = nonZeroMetricCounts(spuhOnly, 'checklists', true)
    expect(off).toEqual(on)
  })

  it('speciesCountWithForms >= speciesCount per cell in both views', () => {
    for (const c of spuhOnly.values()) {
      expect(c.speciesCountWithForms).toBeGreaterThanOrEqual(c.speciesCount)
    }
    const combined = buildDayCells([
      obs({ date: '2022-01-12', submissionId: 'S1', commonName: 'gull sp.' }),
      obs({ date: '2023-01-12', submissionId: 'S2', commonName: 'American Robin' }),
    ], { kind: 'combined' })
    for (const c of combined.values()) {
      expect(c.speciesCountWithForms).toBeGreaterThanOrEqual(c.speciesCount)
    }
  })
})

describe('individualsOf — "X"/blank/null → 0 (Statistics-consistent, change 1)', () => {
  it('returns the count when present', () => {
    expect(individualsOf(5)).toBe(5)
    expect(individualsOf(1)).toBe(1)
    expect(individualsOf(50000)).toBe(50000)
  })

  it('returns 0 for null (the parsed "X"/blank/non-numeric case)', () => {
    expect(individualsOf(null)).toBe(0)
  })

  it('treats 0 as 0 (not conflated with null)', () => {
    expect(individualsOf(0)).toBe(0)
  })
})

describe('Total count metric — totalCount / totalCountWithForms (change 1)', () => {
  const year: CalendarView = { kind: 'year', year: 2024 }

  it('sums individuals over countable rows; excludes spuh/slash/hybrid from totalCount', () => {
    const cells = buildDayCells([
      obs({ date: '2024-03-14', submissionId: 'S1', commonName: 'American Robin', count: 3 }),
      obs({ date: '2024-03-14', submissionId: 'S1', commonName: 'Song Sparrow', count: 2 }),
      obs({ date: '2024-03-14', submissionId: 'S1', commonName: 'gull sp.', count: 7 }),
    ], year)
    const c = cells.get('2024-03-14')!
    expect(c.totalCount).toBe(5) // 3 Robin + 2 Sparrow; gull sp. excluded (non-countable)
    expect(c.totalCountWithForms).toBe(12) // + 7 gull sp.
    expect(c.totalCountWithForms).toBeGreaterThanOrEqual(c.totalCount)
  })

  it('an "X"/blank row (count null) contributes 0 individuals', () => {
    const cells = buildDayCells([
      obs({ date: '2024-03-14', submissionId: 'S1', commonName: 'American Robin', count: null }),
      obs({ date: '2024-03-14', submissionId: 'S1', commonName: 'Song Sparrow', count: 4 }),
    ], year)
    const c = cells.get('2024-03-14')!
    expect(c.totalCount).toBe(4) // Robin "X" → 0, Sparrow 4
  })

  it('SUMS across multiple checklists on the same day (no de-dup, unlike Species)', () => {
    const cells = buildDayCells([
      obs({ date: '2024-03-14', submissionId: 'S1', commonName: 'American Robin', count: 2 }),
      obs({ date: '2024-03-14', submissionId: 'S2', commonName: 'American Robin', count: 3 }),
    ], year)
    const c = cells.get('2024-03-14')!
    // Same species on two same-day checklists adds twice: 2 + 3.
    expect(c.speciesCount).toBe(1) // Species de-dups to 1
    expect(c.totalCount).toBe(5) // Total count sums both rows
  })

  it("metricCount('total') honors includeNonCountable (with-forms vs countable)", () => {
    const cells = buildDayCells([
      obs({ date: '2024-03-14', submissionId: 'S1', commonName: 'American Robin', count: 3 }),
      obs({ date: '2024-03-14', submissionId: 'S1', commonName: 'gull sp.', count: 7 }),
    ], year)
    const c = cells.get('2024-03-14')!
    expect(metricCount(c, 'total', false)).toBe(3) // countable only
    expect(metricCount(c, 'total', true)).toBe(10) // + 7 spuh individuals
  })

  it('nonZeroMetricCounts reads the total metric like the others', () => {
    const cells = buildDayCells([
      obs({ date: '2024-03-14', submissionId: 'S1', commonName: 'American Robin', count: 3 }),
      obs({ date: '2024-03-15', submissionId: 'S2', commonName: 'Song Sparrow', count: 2 }),
      obs({ date: '2024-03-16', submissionId: 'S3', commonName: 'gull sp.', count: 9 }), // countable total 0
    ], year)
    // 03-16 is all-spuh → totalCount 0 → excluded from the non-zero tiering set.
    expect(nonZeroMetricCounts(cells, 'total', false).sort((a, b) => a - b)).toEqual([2, 3])
    // With forms ON, 03-16's 9 individuals enter the set.
    expect(nonZeroMetricCounts(cells, 'total', true).sort((a, b) => a - b)).toEqual([2, 3, 9])
  })

  it('combined view SUMS individuals across years (Checklists-style, not Species-union)', () => {
    const cells = buildDayCells([
      obs({ date: '2022-01-12', submissionId: 'S1', commonName: 'American Robin', count: 4 }),
      obs({ date: '2023-01-12', submissionId: 'S2', commonName: 'American Robin', count: 6 }),
      obs({ date: '2024-01-12', submissionId: 'S3', commonName: 'American Robin', count: 5 }),
    ], { kind: 'combined' })
    const c = cells.get('01-12')!
    expect(c.speciesCount).toBe(1) // union across years
    expect(c.totalCount).toBe(15) // 4 + 6 + 5 summed across years
  })

  it('a species filter + Total count = that species individuals per day', () => {
    const cells = buildDayCells([
      obs({ date: '2024-03-14', submissionId: 'S1', commonName: 'American Robin', count: 3 }),
      obs({ date: '2024-03-14', submissionId: 'S2', commonName: 'American Robin', count: 4 }),
      obs({ date: '2024-03-14', submissionId: 'S1', commonName: 'Song Sparrow', count: 9 }), // excluded
    ], year, 'American Robin')
    expect(cells.get('2024-03-14')!.totalCount).toBe(7) // 3 + 4 Robin only
  })
})

describe('present-but-zero excluded from tiering set (QA-20)', () => {
  it('a present-but-zero day contributes 0 and is not in the non-zero set (OFF)', () => {
    const cells = buildDayCells([
      obs({ date: '2024-05-01', submissionId: 'S1', commonName: 'gull sp.' }), // zero countable
      obs({ date: '2024-05-02', submissionId: 'S2', commonName: 'American Robin' }),
    ], { kind: 'year', year: 2024 })
    const counts = nonZeroMetricCounts(cells, 'species', false)
    expect(counts).toEqual([1])
  })
})

describe('dataYears / defaultYear / adjacentDataYear (QA-29/QA-30)', () => {
  const rows = [
    obs({ date: '2018-01-01', submissionId: 'S1', commonName: 'A' }),
    obs({ date: '2020-01-01', submissionId: 'S2', commonName: 'B' }), // 2019 is a gap
    obs({ date: '2021-01-01', submissionId: 'S3', commonName: 'C' }),
    obs({ date: 'bad-date', submissionId: 'S4', commonName: 'D' }),
  ]

  it('dataYears returns distinct valid years ascending, no gap years, no SESSION_NOW', () => {
    expect(dataYears(rows)).toEqual([2018, 2020, 2021])
  })

  it('defaultYear = Math.max(dataYears)', () => {
    expect(defaultYear(rows)).toBe(2021)
    expect(defaultYear([obs({ date: 'bad', submissionId: 'S1', commonName: 'A' })])).toBeNull()
  })

  it('adjacentDataYear skips gap years and returns null at the ends', () => {
    const years = [2018, 2020, 2021]
    expect(adjacentDataYear(years, 2018, 1)).toBe(2020) // skips 2019
    expect(adjacentDataYear(years, 2020, -1)).toBe(2018)
    expect(adjacentDataYear(years, 2021, 1)).toBeNull()
    expect(adjacentDataYear(years, 2018, -1)).toBeNull()
  })
})

describe('tiering via computeCountyTiers(maxClasses=5) (QA-21/QA-23)', () => {
  it('ties / few distinct values → fewer classes, no empty/duplicate ranges (QA-21)', () => {
    const tiers = computeCountyTiers([3, 3, 3, 5, 5], 5)
    expect(tiers.legend.length).toBeLessThanOrEqual(2)
    for (const l of tiers.legend) expect(l.min).toBeLessThanOrEqual(l.max)
    // strictly ascending breaks (dedup)
    for (let i = 1; i < tiers.breaks.length; i++) expect(tiers.breaks[i]).toBeGreaterThan(tiers.breaks[i - 1])
  })

  it('empty / all-equal degenerate view → no crash (QA-23)', () => {
    expect(computeCountyTiers([], 5)).toEqual({ breaks: [], tierFor: expect.any(Function), legend: [] })
    const oneVal = computeCountyTiers([7, 7, 7], 5)
    expect(oneVal.legend.length).toBe(1)
    expect(oneVal.tierFor(7)).toBe(1)
    expect(oneVal.tierFor(0)).toBe(0)
  })

  it('caps at 5 classes even with many distinct values', () => {
    const tiers = computeCountyTiers([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 5)
    expect(tiers.legend.length).toBe(5)
  })
})

describe('perf: buildDayCells on ~20k rows < 50ms (QA-41)', () => {
  it('completes quickly', () => {
    const names = ['American Robin', 'Song Sparrow', 'Blue Jay', 'gull sp.', 'Mallard x American Black Duck']
    const rows: ObservationEntry[] = []
    for (let i = 0; i < 20000; i++) {
      const y = 2018 + (i % 6)
      const mo = String(1 + (i % 12)).padStart(2, '0')
      const d = String(1 + (i % 28)).padStart(2, '0')
      rows.push(obs({ date: `${y}-${mo}-${d}`, submissionId: `S${i % 4000}`, commonName: names[i % names.length] }))
    }
    const t0 = performance.now()
    buildDayCells(rows, { kind: 'combined' })
    const dt = performance.now() - t0
    expect(dt).toBeLessThan(50)
  })
})
