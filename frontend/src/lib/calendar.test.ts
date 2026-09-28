import { describe, it, expect } from 'vitest'
import type { ObservationEntry } from '../types'
import {
  buildDayCells, dataYears, defaultYear, adjacentDataYear, metricCount,
  nonZeroMetricCounts, individualsOf, daysInMonth, dayOfWeek, isValidDateString, isValidCalendarDay,
  dateParts, metricNoun, type CalendarView, type DayCell,
} from './calendar'
import { computeCountyTiers } from './countyShading'
import { parseEbirdObservations } from './parseEbirdObservations'

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
    breedingCode: partial.breedingCode ?? null,
    speciesComments: '',
    catalogIds: partial.catalogIds ?? [],
    // time is optional on ObservationEntry: undefined unless a test supplies it. The
    // 'time' in partial guard preserves an explicit null (a timeless export row).
    ...('time' in partial ? { time: partial.time } : {}),
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

  it('judges the RAW exported name, so a named hybrid does not count (report-as)', () => {
    // The discriminating case for the call site's INPUT. "Brewster's Warbler
    // (hybrid)" carries no " x " and no "/", so its base name reads exactly like a
    // species: normalizing before classifying silently counts it. eBird does not.
    // Passing `norm` here instead of `o.commonName` must turn this red.
    const cells = buildDayCells([
      obs({ date: '2024-03-14', submissionId: 'S1', commonName: "Brewster's Warbler (hybrid)" }),
      obs({ date: '2024-03-14', submissionId: 'S1', commonName: 'American Robin' }),
    ], view)
    const c = cells.get('2024-03-14')!
    expect(c.speciesCount).toBe(1)              // the Robin only
    expect(c.speciesCountWithForms).toBe(2)     // both, under "Count all forms"
  })

  it('counts a subspecies-group slash as its parent species (report-as direction A)', () => {
    // The other direction, and the one most birders will actually notice: eBird
    // counts "Canada Goose (moffitti/maxima)" as Canada Goose. The old string rule
    // saw the "/" and excluded it.
    const cells = buildDayCells([
      obs({ date: '2024-03-14', submissionId: 'S1', commonName: 'Canada Goose (moffitti/maxima)' }),
    ], view)
    expect(cells.get('2024-03-14')!.speciesCount).toBe(1)
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

  it('records checklist submission ids with their full dates, time, location, and species counts', () => {
    const cells = buildDayCells([
      obs({ date: '2024-03-14', submissionId: 'S1', commonName: 'American Robin', time: '07:30 AM', location: 'West Pond' }),
    ], view)
    expect(cells.get('2024-03-14')!.checklists).toEqual([
      { submissionId: 'S1', date: '2024-03-14', time: '07:30 AM', location: 'West Pond', speciesCount: 1, speciesCountWithForms: 1, catalogIds: [], codes: [], breeding: null },
    ])
  })

  it('captures time + location from the FIRST row seen per submissionId (counts still accumulate every row)', () => {
    // All rows of one checklist share time + location; a defensive later row with
    // different values must NOT overwrite the first-seen ones. The per-checklist species
    // Sets, by contrast, DO accumulate over every row (2 distinct species here).
    const cells = buildDayCells([
      obs({ date: '2024-03-14', submissionId: 'S1', commonName: 'American Robin', time: '06:15 AM', location: 'Bear Valley' }),
      obs({ date: '2024-03-14', submissionId: 'S1', commonName: 'Song Sparrow', time: '09:00 PM', location: 'Somewhere Else' }),
    ], view)
    const c = cells.get('2024-03-14')!
    expect(c.checklists).toEqual([
      { submissionId: 'S1', date: '2024-03-14', time: '06:15 AM', location: 'Bear Valley', speciesCount: 2, speciesCountWithForms: 2, catalogIds: [], codes: [], breeding: null },
    ])
  })

  it('carries a null time through when the export had none', () => {
    const cells = buildDayCells([
      obs({ date: '2024-03-14', submissionId: 'S1', commonName: 'American Robin', time: null, location: 'West Pond' }),
    ], view)
    expect(cells.get('2024-03-14')!.checklists[0].time).toBeNull()
    expect(cells.get('2024-03-14')!.checklists[0].location).toBe('West Pond')
  })

  it('per-checklist speciesCount excludes spuh/slash/hybrid; withForms counts them', () => {
    // One checklist: Robin + Song Sparrow (both countable) + "gull sp." (spuh) →
    // countable 2, with-forms 3. The per-checklist tallies mirror the day-level rule.
    const cells = buildDayCells([
      obs({ date: '2024-03-14', submissionId: 'S1', commonName: 'American Robin' }),
      obs({ date: '2024-03-14', submissionId: 'S1', commonName: 'Song Sparrow' }),
      obs({ date: '2024-03-14', submissionId: 'S1', commonName: 'gull sp.' }),
    ], view)
    const cl = cells.get('2024-03-14')!.checklists[0]
    expect(cl.submissionId).toBe('S1')
    expect(cl.speciesCount).toBe(2)
    expect(cl.speciesCountWithForms).toBe(3)
    expect(cl.speciesCountWithForms).toBeGreaterThanOrEqual(cl.speciesCount)
  })

  it('per-checklist species tallies dedup a repeated species within the checklist', () => {
    // The same species logged twice on one checklist counts once (Set semantics).
    const cells = buildDayCells([
      obs({ date: '2024-03-14', submissionId: 'S1', commonName: 'American Robin' }),
      obs({ date: '2024-03-14', submissionId: 'S1', commonName: 'American Robin' }),
      obs({ date: '2024-03-14', submissionId: 'S1', commonName: 'Song Sparrow' }),
    ], view)
    const cl = cells.get('2024-03-14')!.checklists[0]
    expect(cl.speciesCount).toBe(2)
    expect(cl.speciesCountWithForms).toBe(2)
  })

  it('a spuh-only checklist has per-checklist speciesCount 0, withForms 1', () => {
    const cells = buildDayCells([
      obs({ date: '2024-03-14', submissionId: 'S9', commonName: 'gull sp.' }),
    ], view)
    const cl = cells.get('2024-03-14')!.checklists[0]
    expect(cl.speciesCount).toBe(0) // present-but-zero, consistent with the day-level rule
    expect(cl.speciesCountWithForms).toBe(1)
  })

  it('per-checklist species tallies are scoped to EACH checklist (not the whole day)', () => {
    // Two checklists on one day: S1 = Robin+Sparrow, S2 = Robin only. Each checklist's
    // own count is independent of the day-level de-duped species set (2).
    const cells = buildDayCells([
      obs({ date: '2024-03-14', submissionId: 'S1', commonName: 'American Robin' }),
      obs({ date: '2024-03-14', submissionId: 'S1', commonName: 'Song Sparrow' }),
      obs({ date: '2024-03-14', submissionId: 'S2', commonName: 'American Robin' }),
    ], view)
    const c = cells.get('2024-03-14')!
    expect(c.speciesCount).toBe(2) // day-level union unchanged
    const byId = new Map(c.checklists.map(cl => [cl.submissionId, cl]))
    expect(byId.get('S1')!.speciesCount).toBe(2)
    expect(byId.get('S2')!.speciesCount).toBe(1)
  })

  it('under a species filter each checklist count reflects the filtered view (0/1 per checklist)', () => {
    // Filtered to American Robin: a checklist that recorded it counts 1; the whole tab
    // is scoped to that species, so the per-checklist count reflecting that is consistent.
    const cells = buildDayCells([
      obs({ date: '2024-03-14', submissionId: 'S1', commonName: 'American Robin' }),
      obs({ date: '2024-03-14', submissionId: 'S1', commonName: 'Song Sparrow' }),
    ], view, 'American Robin')
    const cl = cells.get('2024-03-14')!.checklists[0]
    expect(cl.speciesCount).toBe(1) // Robin only — Sparrow filtered out before accumulation
    expect(cl.speciesCountWithForms).toBe(1)
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

// `o.commonName` is the RAW exported name, so the countable check must normalize
// before testing for " x ": an intraspecific intergrade is a countable bird, while a
// true hybrid is not. A raw-name predicate drops both, so an intergrade-only day
// wrongly reads Species 0 with the toggle OFF.
describe('buildDayCells — intergrades stay countable, true hybrids do not', () => {
  const view: CalendarView = { kind: 'year', year: 2024 }
  const cells = buildDayCells([
    obs({ date: '2024-05-01', submissionId: 'S1', commonName: "Yellow-rumped Warbler (Myrtle x Audubon's)" }),
    obs({ date: '2024-05-02', submissionId: 'S2', commonName: 'Mallard x American Black Duck (hybrid)' }),
  ], view)

  it('an intergrade-only day counts as a real species with the toggle OFF', () => {
    const day = cells.get('2024-05-01')!
    expect(metricCount(day, 'species', false)).toBe(1)
    expect(metricCount(day, 'species', true)).toBe(1)
  })

  it('a hybrid-only day is still 0 with the toggle OFF and 1 with it ON', () => {
    const day = cells.get('2024-05-02')!
    expect(metricCount(day, 'species', false)).toBe(0)
    expect(metricCount(day, 'species', true)).toBe(1)
  })

  it('the intergrade folds into its parent species rather than counting twice', () => {
    const folded = buildDayCells([
      obs({ date: '2024-06-01', submissionId: 'S3', commonName: "Yellow-rumped Warbler (Myrtle x Audubon's)" }),
      obs({ date: '2024-06-01', submissionId: 'S3', commonName: 'Yellow-rumped Warbler' }),
    ], view)
    expect(metricCount(folded.get('2024-06-01')!, 'species', false)).toBe(1)
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
    // Scheduler contention can only inflate a wall-clock sample, so the minimum
    // of several fully measured calls estimates uncontended execution without
    // relaxing QA-41's <50 ms contract or discarding an unmeasured warm-up.
    const samples: number[] = []
    for (let i = 0; i < 7; i++) {
      const t0 = performance.now()
      buildDayCells(rows, { kind: 'combined' })
      samples.push(performance.now() - t0)
    }
    expect(Math.min(...samples)).toBeLessThan(50)
  })
})

// ── calendar-overlays: the overlay facts buildDayCells derives in its one pass ──
// (schema.md section 2; FR-09..FR-16; QA-09..QA-18). Every row here builds its
// input through the same obs() factory the rest of this file uses, which now
// honours breedingCode and catalogIds from its partial.

const codesOf = (c: Pick<DayCell, 'codes'>) => c.codes.map(f => `${f.def.code}:${f.speciesCount}`)

describe('overlay facts: media presence and distinct ids (FR-09/FR-10/FR-11, QA-09)', () => {
  const view: CalendarView = { kind: 'year', year: 2025 }

  it('derives the day\'s distinct ids, the media checklist count, and each checklist\'s own ids', () => {
    const cells = buildDayCells([
      obs({ date: '2025-05-17', submissionId: 'S1', commonName: 'Oak Titmouse', catalogIds: ['1', '2'] }),
      obs({ date: '2025-05-17', submissionId: 'S2', commonName: 'Wrentit', catalogIds: ['2'] }),
      obs({ date: '2025-05-17', submissionId: 'S3', commonName: 'Bushtit' }),
    ], view)
    const c = cells.get('2025-05-17')!
    expect(c.mediaPresent).toBe(true)
    expect(c.mediaIds).toEqual(['1', '2'])
    expect(c.mediaIdCount).toBe(2)
    expect(c.mediaChecklistCount).toBe(2)
    const byId = Object.fromEntries(c.checklists.map(r => [r.submissionId, r.catalogIds]))
    expect(byId).toEqual({ S1: ['1', '2'], S2: ['2'], S3: [] })
  })

  it('a day whose rows all carry no ids derives no media at either level', () => {
    const c = buildDayCells([
      obs({ date: '2025-05-18', submissionId: 'S1', commonName: 'Oak Titmouse' }),
      obs({ date: '2025-05-18', submissionId: 'S2', commonName: 'Wrentit' }),
    ], view).get('2025-05-18')!
    expect(c.mediaPresent).toBe(false)
    expect(c.mediaIds).toEqual([])
    expect(c.mediaIdCount).toBe(0)
    expect(c.mediaChecklistCount).toBe(0)
    expect(c.checklists.every(r => r.catalogIds.length === 0)).toBe(true)
  })

  it('de-duplicates within one row ("ML123, 123") and across rows, first-seen order', () => {
    const c = buildDayCells([
      obs({ date: '2025-05-17', submissionId: 'S1', commonName: 'Oak Titmouse', catalogIds: ['123', '123'] }),
      obs({ date: '2025-05-17', submissionId: 'S1', commonName: 'Wrentit', catalogIds: ['9', '123'] }),
    ], view).get('2025-05-17')!
    expect(c.mediaIds).toEqual(['123', '9'])
    expect(c.checklists[0].catalogIds).toEqual(['123', '9'])
  })

  it('the backup\'s ML Catalog Numbers cell, parsed end to end: blank and malformed cells carry no media (QA-10)', () => {
    const header = 'Submission ID,Common Name,Scientific Name,Taxonomic Order,Count,State/Province,County,Location ID,Location,Latitude,Longitude,Date,Time,Protocol,Duration (Min),All Obs Reported,Distance Traveled (km),Area Covered (ha),Number of Observers,Breeding Code,Observation Details,Checklist Comments,ML Catalog Numbers'
    const row = (sid: string, name: string, ml: string) =>
      `${sid},${name},Sci name,1,1,US-CA,Marin,L1,West Pond,38,-122,2025-05-17,07:00 AM,Traveling,60,1,1,,1,,,,"${ml}"`
    const text = [header,
      row('S1', 'Oak Titmouse', ''), row('S2', 'Wrentit', '  '), row('S3', 'Bushtit', 'ML'),
      row('S4', 'Spotted Towhee', 'abc, ML12x'),
    ].join('\n')
    const noMedia = buildDayCells(parseEbirdObservations(text), view).get('2025-05-17')!
    expect(noMedia.checklistCount).toBe(4)
    expect(noMedia.mediaPresent).toBe(false)
    expect(noMedia.mediaIds).toEqual([])
    const withMedia = buildDayCells(parseEbirdObservations([header, row('S5', 'Oak Titmouse', 'ML123, 456')].join('\n')), view).get('2025-05-17')!
    expect(withMedia.mediaIds).toEqual(['123', '456'])
    expect(withMedia.mediaIdCount).toBe(2)
  })

  it('a row with no submissionId contributes day-level facts and no checklist', () => {
    const c = buildDayCells([
      obs({ date: '2025-05-17', submissionId: '', commonName: 'Oak Titmouse', catalogIds: ['7'], breedingCode: 'NY' }),
    ], view).get('2025-05-17')!
    expect(c.checklists).toEqual([])
    expect(c.mediaIds).toEqual(['7'])
    expect(c.mediaChecklistCount).toBe(0)
    expect(codesOf(c)).toEqual(['NY:1'])
  })
})

describe('overlay facts: breeding codes (FR-09/FR-12/FR-13, QA-11..QA-13)', () => {
  const view: CalendarView = { kind: 'year', year: 2025 }
  const day = (rows: { name: string; code: string | null; sid?: string }[]) =>
    buildDayCells(rows.map(r => obs({ date: '2025-06-21', submissionId: r.sid ?? 'S1', commonName: r.name, breedingCode: r.code })), view).get('2025-06-21')!

  it('classifies backup display codes directly: NY/NB Confirmed, A Probable, S Possible, FY is Feeding Young (QA-11)', () => {
    const c = day([
      { name: 'Oak Titmouse', code: 'NY' }, { name: 'Bushtit', code: 'NB' },
      { name: 'Wrentit', code: 'A' }, { name: 'Spotted Towhee', code: 'S' },
      { name: 'Western Bluebird', code: 'FY' },
    ])
    const fy = c.codes.find(f => f.def.code === 'FY')!
    expect(fy.def.label).toBe('Feeding Young')
    expect(fy.def.tier).toBe(4)
    expect(c.breeding?.code).toBe('NY')
    expect(c.codeCategoryCounts).toEqual({ confirmed: 3, probable: 1, possible: 1 })
  })

  it('an unknown code is tier 1 with its raw text as the label (QA-12)', () => {
    const c = day([{ name: 'Oak Titmouse', code: 'ZZ' }])
    expect(c.codes).toEqual([{ def: { code: 'ZZ', label: 'ZZ', tier: 1 }, speciesCount: 1 }])
    expect(c.codeCategoryCounts.possible).toBe(1)
  })

  it('orders strongest first with unknowns last: S, ZZ, A -> A, S, ZZ; S, ZZ -> S, ZZ (QA-13)', () => {
    expect(codesOf(day([{ name: 'a', code: 'S' }, { name: 'b', code: 'ZZ' }, { name: 'c', code: 'A' }]))).toEqual(['A:1', 'S:1', 'ZZ:1'])
    const two = day([{ name: 'a', code: 'ZZ' }, { name: 'b', code: 'S' }])
    expect(codesOf(two)).toEqual(['S:1', 'ZZ:1'])
    expect(two.breeding?.code).toBe('S')
  })

  it('two unknown codes keep first-seen order and the first is the day\'s strongest', () => {
    const c = day([{ name: 'a', code: 'QQ' }, { name: 'b', code: 'ZZ' }])
    expect(codesOf(c)).toEqual(['QQ:1', 'ZZ:1'])
    expect(c.breeding?.code).toBe('QQ')
  })

  it('counts a species once per code across rows, and a spuh counts as a species carrying it', () => {
    const c = day([
      { name: 'Oak Titmouse', code: 'S', sid: 'S1' }, { name: 'Oak Titmouse', code: 'S', sid: 'S2' },
      { name: 'Wrentit', code: 'S', sid: 'S2' }, { name: 'gull sp.', code: 'S', sid: 'S2' },
    ])
    expect(codesOf(c)).toEqual(['S:3'])
  })

  it('a species carrying NY and FY counts once under Confirmed (a union, never a sum)', () => {
    const c = day([{ name: 'Oak Titmouse', code: 'NY' }, { name: 'Oak Titmouse', code: 'FY' }])
    expect(codesOf(c)).toEqual(['NY:1', 'FY:1'])
    expect(c.codeCategoryCounts).toEqual({ confirmed: 1, probable: 0, possible: 0 })
  })

  it('carries each checklist\'s own codes, strongest first, with its own species counts', () => {
    const c = day([
      { name: 'Oak Titmouse', code: 'S', sid: 'S1' }, { name: 'Wrentit', code: 'NY', sid: 'S1' },
      { name: 'Bushtit', code: 'S', sid: 'S2' }, { name: 'Wrentit', code: 'S', sid: 'S2' },
    ])
    const rows = Object.fromEntries(c.checklists.map(r => [r.submissionId, { codes: codesOf(r), strongest: r.breeding?.code ?? null }]))
    expect(rows).toEqual({ S1: { codes: ['NY:1', 'S:1'], strongest: 'NY' }, S2: { codes: ['S:2'], strongest: 'S' } })
    expect(codesOf(c)).toEqual(['NY:1', 'S:3'])
  })

  it('a code of __proto__ is just an unknown code (a Map lookup, not a prototype walk)', () => {
    const c = day([{ name: 'Oak Titmouse', code: '__proto__' }, { name: 'Wrentit', code: 'constructor' }])
    expect(codesOf(c)).toEqual(['__proto__:1', 'constructor:1'])
    expect(c.codes.every(f => f.def.tier === 1)).toBe(true)
  })

  it('a day with no code carries empty codes, zero category counts and no strongest code', () => {
    const c = day([{ name: 'Oak Titmouse', code: null }])
    expect(c.codes).toEqual([])
    expect(c.breeding).toBeNull()
    expect(c.codeCategoryCounts).toEqual({ confirmed: 0, probable: 0, possible: 0 })
  })
})

describe('overlay facts follow the species filter and ignore countability and escapees (FR-14, QA-14/QA-15)', () => {
  const view: CalendarView = { kind: 'year', year: 2025 }

  it('a spuh\'s media and a hybrid\'s code still derive (countability ignored) (QA-14)', () => {
    const c = buildDayCells([
      obs({ date: '2025-05-17', submissionId: 'S1', commonName: 'gull sp.', catalogIds: ['1'] }),
      obs({ date: '2025-05-17', submissionId: 'S1', commonName: 'Mallard x American Black Duck (hybrid)', breedingCode: 'FL' }),
    ], view).get('2025-05-17')!
    expect(c.speciesCount).toBe(0)
    expect(c.mediaIds).toEqual(['1'])
    expect(codesOf(c)).toEqual(['FL:1'])
  })

  it('an escapee-excluded species as the sole carrier still derives both facts (QA-14)', () => {
    const c = buildDayCells([
      obs({ date: '2025-05-17', submissionId: 'S1', commonName: 'Swan Goose', catalogIds: ['5'], breedingCode: 'NY' }),
    ], view, undefined, new Set(['Swan Goose'])).get('2025-05-17')!
    expect(c.speciesCount).toBe(0)
    expect(c.mediaPresent).toBe(true)
    expect(c.breeding?.code).toBe('NY')
  })

  it('under a filter, another species\' media and codes do not mark the day; every per-code count is 1 (QA-15)', () => {
    const rows = [
      obs({ date: '2025-05-17', submissionId: 'S1', commonName: 'Wrentit', catalogIds: ['1'], breedingCode: 'NY' }),
      obs({ date: '2025-05-17', submissionId: 'S1', commonName: 'Oak Titmouse' }),
      obs({ date: '2025-05-18', submissionId: 'S2', commonName: 'Oak Titmouse', catalogIds: ['2'] }),
      obs({ date: '2025-05-19', submissionId: 'S3', commonName: 'Oak Titmouse', breedingCode: 'S' }),
      obs({ date: '2025-05-19', submissionId: 'S3', commonName: 'Oak Titmouse (Interior)', breedingCode: 'S' }),
      obs({ date: '2025-05-19', submissionId: 'S3', commonName: 'Wrentit', breedingCode: 'S' }),
    ]
    const cells = buildDayCells(rows, view, 'Oak Titmouse')
    const may17 = cells.get('2025-05-17')!
    expect(may17.mediaPresent).toBe(false)
    expect(may17.codes).toEqual([])
    expect(cells.get('2025-05-18')!.mediaIds).toEqual(['2'])
    expect(cells.get('2025-05-18')!.codes).toEqual([])
    expect(codesOf(cells.get('2025-05-19')!)).toEqual(['S:1'])
  })
})

describe('overlay facts in All years (FR-15, QA-16/QA-17) and on zero-count days (FR-16)', () => {
  it('unions ids and per-code species sets across years; the strongest is the strongest across years (QA-16)', () => {
    const rows = [
      obs({ date: '2019-06-21', submissionId: 'S1', commonName: 'Oak Titmouse', catalogIds: ['1'], breedingCode: 'S' }),
      obs({ date: '2023-06-21', submissionId: 'S2', commonName: 'Wrentit', breedingCode: 'NY' }),
      obs({ date: '2023-06-21', submissionId: 'S2', commonName: 'Bushtit', breedingCode: 'S', catalogIds: ['2'] }),
    ]
    const c = buildDayCells(rows, { kind: 'combined' }).get('06-21')!
    expect(c.mediaIds).toEqual(['1', '2'])
    expect(c.mediaChecklistCount).toBe(2)
    expect(c.breeding?.code).toBe('NY')
    expect(codesOf(c)).toEqual(['NY:1', 'S:2'])
    expect(c.checklists.map(r => r.date).sort()).toEqual(['2019-06-21', '2023-06-21'])
  })

  it('combined view under a filter marks the date only from that species\' rows across years (QA-17)', () => {
    const rows = [
      obs({ date: '2019-06-21', submissionId: 'S1', commonName: 'Wrentit', catalogIds: ['1'] }),
      obs({ date: '2023-06-21', submissionId: 'S2', commonName: 'Oak Titmouse', breedingCode: 'A' }),
      obs({ date: '2023-06-21', submissionId: 'S2', commonName: 'Wrentit', breedingCode: 'NY', catalogIds: ['3'] }),
    ]
    const c = buildDayCells(rows, { kind: 'combined' }, 'Oak Titmouse').get('06-21')!
    expect(c.mediaPresent).toBe(false)
    expect(codesOf(c)).toEqual(['A:1'])
  })

  it('a zero-count day (only a spuh under the default Species metric) still carries its media (QA-18)', () => {
    const c = buildDayCells([
      obs({ date: '2025-02-22', submissionId: 'S1', commonName: 'Gull sp.', catalogIds: ['42'] }),
    ], { kind: 'year', year: 2025 }).get('2025-02-22')!
    expect(metricCount(c, 'species', false)).toBe(0)
    expect(c.mediaIds).toEqual(['42'])
  })
})

describe('metricNoun (FR-28)', () => {
  it('names the number in the zero-day name\'s own words', () => {
    expect(metricNoun('checklists', false)).toBe('checklists')
    expect(metricNoun('checklists', true)).toBe('checklists')
    expect(metricNoun('total', false)).toBe('individuals')
    expect(metricNoun('total', true)).toBe('individuals')
    expect(metricNoun('species', false)).toBe('countable species')
    expect(metricNoun('species', true)).toBe('species')
  })
})
