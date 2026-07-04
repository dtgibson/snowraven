// Calendar tab — the pure day-bucket derivation + lexical date helpers. React-free
// and unit-tested. Every count derives from the already-parsed eBird backup
// (ObservationEntry[]); no network, no re-parse.
//
// ALL date handling is lexical/component-based — never `new Date(str)` (which
// parses YYYY-MM-DD as UTC and shifts a day in negative-offset zones, FR-08/QA-08).
// daysInMonth / dayOfWeek / isValidCalendarDay are arithmetic.

import type { ObservationEntry } from '../types'
import { normalizeSpeciesName, isNonCountableSpecies } from './speciesUtils'

export type CalendarMetric = 'species' | 'checklists' | 'total'

/** Individuals contributed by one row's Count. eBird "X"/blank/non-numeric parses to
 *  ObservationEntry.count === null (parseEbirdObservations); an "X"/blank row therefore
 *  contributes 0 individuals. This matches the Statistics tab's ONE individual tally
 *  (birdingStats individualCount: `if (o.count !== null) sum += o.count`, X/blank = 0),
 *  so the Calendar's "Total count" and Statistics' "most individuals" use identical
 *  arithmetic and can never silently disagree. */
export function individualsOf(count: number | null): number {
  return count ?? 0
}

/** Single-year: bucketKey is 'YYYY-MM-DD'. Combined: bucketKey is 'MM-DD'. */
export type CalendarView =
  | { kind: 'year'; year: number }
  | { kind: 'combined' }

/** One populated day. Only days with >=1 valid checklist get a DayCell; a day with
 *  none is simply absent from the map (→ rendered as a blank no-data cell, FR-14). */
export interface DayCell {
  /** 'YYYY-MM-DD' (year view) or 'MM-DD' (combined view). */
  bucketKey: string
  /** Distinct COUNTABLE species (normalized, non-countable EXCLUDED — the FR-10 /
   *  spuh-toggle-OFF value). Year view: that date's set size. Combined view: the
   *  cross-year UNION set size (FR-17). */
  speciesCount: number
  /** Distinct species INCLUDING non-countable forms (spuh/slash/hybrid counted — the
   *  FR-45 spuh-toggle-ON value). speciesCountWithForms >= speciesCount always. */
  speciesCountWithForms: number
  /** Distinct submissionIds over RAW rows. Year view: that date's count. Combined
   *  view: the SUM across years (FR-18). A spuh-only checklist still counts (FR-11).
   *  Unaffected by the include-non-countable toggle (Checklists is metric-only). */
  checklistCount: number
  /** Σ individuals (ObservationEntry.count) over COUNTABLE rows only (spuh/slash/hybrid
   *  excluded — the default value, mirroring speciesCount). An "X"/blank row contributes
   *  0 (individualsOf). A SUM metric: no de-dup, so a species on two same-day checklists
   *  adds its individuals twice; combined view SUMS across years (Checklists-style). */
  totalCount: number
  /** Σ individuals INCLUDING spuh/slash/hybrid rows (the spuh-toggle-ON value, mirroring
   *  speciesCountWithForms). totalCountWithForms >= totalCount always. */
  totalCountWithForms: number
  /** submissionId → the full 'YYYY-MM-DD' date that checklist was logged on. Drives
   *  the popup's ChecklistLink rows (year-labeled in combined mode). Newest-first
   *  ordering is applied at render from these dates. */
  checklists: { submissionId: string; date: string }[]
}

/** All populated day buckets for a view, built in ONE pass. Key = bucketKey. */
export type DayCellMap = Map<string, DayCell>

const MONTH_DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]

/** Real length of a month (1-based month). Arithmetic leap rule (FR-15). */
export function daysInMonth(year: number, month: number): number {
  if (month < 1 || month > 12) return 0
  if (month === 2 && isLeapYear(year)) return 29
  return MONTH_DAYS[month - 1]
}

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0
}

/** (y,m,d) real-calendar-day check: month 1..12, day 1..daysInMonth(y,m). */
export function isValidCalendarDay(year: number, month: number, day: number): boolean {
  if (month < 1 || month > 12) return false
  if (day < 1) return false
  return day <= daysInMonth(year, month)
}

/** Lexical shape + real-calendar-day guard. FR-12: rejects '', '2024-13-40',
 *  '2023-02-30', non-ASCII digits ('٢٠٢٤-...'). Uses an EXPLICIT ASCII digit class
 *  (NOT \d) so a Unicode-digit date fails — mirrors the 0.5.54 ASCII-class
 *  discipline and makes the intent unmistakable. */
const DATE_RE = /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/
export function isValidDateString(s: string): boolean {
  if (!DATE_RE.test(s)) return false
  const year = Number(s.slice(0, 4))
  const month = Number(s.slice(5, 7))
  const day = Number(s.slice(8, 10))
  return isValidCalendarDay(year, month, day)
}

/** Slice a valid 'YYYY-MM-DD' into components lexically (no Date parse). */
export function dateParts(s: string): { year: number; month: number; day: number } {
  return {
    year: Number(s.slice(0, 4)),
    month: Number(s.slice(5, 7)),
    day: Number(s.slice(8, 10)),
  }
}

/** Pure arithmetic day-of-week (Sakamoto), 0=Sunday..6=Saturday — NO new Date().
 *  Single-year months key on dayOfWeek(year, m, d); the combined ("All years") view
 *  aligns its weekday lead-in to the CURRENT year (Calendar.tsx's CURRENT_YEAR
 *  session constant) so it matches this year's grid, while pinning February to 29
 *  days so the Feb-29 cell survives a non-leap current year. */
export function dayOfWeek(year: number, month: number, day: number): number {
  const t = [0, 3, 2, 5, 0, 3, 5, 1, 4, 6, 2, 4]
  let y = year
  if (month < 3) y -= 1
  return (y + Math.floor(y / 4) - Math.floor(y / 100) + Math.floor(y / 400) + t[month - 1] + day) % 7
}

/** THE single-pass derivation. One loop over observations; per bucket it
 *  accumulates TWO Set<normalizedName>s — a countable-only set (→ speciesCount)
 *  and an all-names set that also admits spuh/slash/hybrid (→ speciesCountWithForms)
 *  — plus a Map<submissionId,date>. No per-cell rescans. Malformed-date rows are
 *  dropped per row (FR-12); a checklist still lands on the date its valid rows
 *  carry. buildDayCells itself takes no toggle flag; metricCount /
 *  nonZeroMetricCounts select which species field to read.
 *
 *  When `speciesFilter` (a NORMALIZED common name) is supplied, only rows whose
 *  normalized common name equals it are bucketed — narrowing the whole calendar
 *  to one species. Normalization folds subspecies/form parentheticals into the
 *  parent (so "Dark-eyed Junco (Oregon)" filters under "Dark-eyed Junco"). The
 *  filter is applied BEFORE bucketing, so the metric/tiering/legend/popup
 *  pipeline is unchanged — it simply operates over a smaller DayCellMap. Under a
 *  filter the Species metric is a 0-or-1-per-day presence and Checklists counts
 *  the checklists that recorded that species. */
export function buildDayCells(
  observations: ObservationEntry[],
  view: CalendarView,
  speciesFilter?: string,
): DayCellMap {
  interface Work {
    bucketKey: string
    countable: Set<string>
    withForms: Set<string>
    checklists: Map<string, string> // submissionId -> full YYYY-MM-DD date
    total: number // Σ individuals, countable rows only
    totalWithForms: number // Σ individuals, all rows (incl. spuh/slash/hybrid)
  }
  const work = new Map<string, Work>()

  for (const o of observations) {
    const date = o.date
    if (!isValidDateString(date)) continue
    if (view.kind === 'year') {
      if (Number(date.slice(0, 4)) !== view.year) continue
    }
    const norm = normalizeSpeciesName(o.commonName)
    // Per-species narrowing: drop every row that isn't the selected (normalized)
    // species BEFORE bucketing, so the rest of the pipeline is unchanged.
    if (speciesFilter !== undefined && norm !== speciesFilter) continue
    const bucketKey = view.kind === 'year' ? date : date.slice(5) // MM-DD for combined
    let w = work.get(bucketKey)
    if (!w) {
      w = { bucketKey, countable: new Set(), withForms: new Set(), checklists: new Map(), total: 0, totalWithForms: 0 }
      work.set(bucketKey, w)
    }
    const n = individualsOf(o.count) // "X"/blank/null → 0 (Statistics-consistent)
    w.withForms.add(norm)
    w.totalWithForms += n
    if (!isNonCountableSpecies(o.commonName)) {
      w.countable.add(norm)
      w.total += n
    }
    // A checklist (submissionId) lands on THIS row's valid date. Globally-unique
    // eBird submission ids mean a per-bucket Set spanning years has a size that
    // legitimately equals the sum, so one mechanism serves both views.
    if (o.submissionId && !w.checklists.has(o.submissionId)) {
      w.checklists.set(o.submissionId, date)
    }
  }

  const out: DayCellMap = new Map()
  for (const [key, w] of work) {
    out.set(key, {
      bucketKey: key,
      speciesCount: w.countable.size,
      speciesCountWithForms: w.withForms.size,
      checklistCount: w.checklists.size,
      totalCount: w.total,
      totalCountWithForms: w.totalWithForms,
      checklists: [...w.checklists.entries()].map(([submissionId, date]) => ({ submissionId, date })),
    })
  }
  return out
}

/** Distinct years with >=1 VALID dated observation, ascending. The navigable set
 *  (FR-31). Never includes a year with no valid data; no SESSION_NOW_MS read. */
export function dataYears(observations: ObservationEntry[]): number[] {
  const years = new Set<number>()
  for (const o of observations) {
    if (isValidDateString(o.date)) years.add(Number(o.date.slice(0, 4)))
  }
  return [...years].sort((a, b) => a - b)
}

/** Most-recent data year = Math.max(dataYears). Default initial view (FR-33). No
 *  current-date reference. Returns null when there are zero valid dated obs. */
export function defaultYear(observations: ObservationEntry[]): number | null {
  const years = dataYears(observations)
  return years.length ? years[years.length - 1] : null
}

/** Prev/next data year, skipping gap years (FR-32). Returns null at the ends. */
export function adjacentDataYear(years: number[], current: number, dir: -1 | 1): number | null {
  const idx = years.indexOf(current)
  if (idx < 0) {
    // current not in the set — find the nearest in the requested direction.
    if (dir === 1) {
      const next = years.find(y => y > current)
      return next ?? null
    }
    for (let i = years.length - 1; i >= 0; i--) if (years[i] < current) return years[i]
    return null
  }
  const target = idx + dir
  if (target < 0 || target >= years.length) return null
  return years[target]
}

/** The active-metric count of a DayCell (species / checklists / total individuals). The
 *  Species AND Total branches honor the FR-45 include-non-countable-forms toggle:
 *  includeNonCountable=false reads the countable-only field (speciesCount / totalCount,
 *  the default), true reads the with-forms field (speciesCountWithForms /
 *  totalCountWithForms). The Checklists branch IGNORES includeNonCountable (metric-only,
 *  FR-45) and always returns cell.checklistCount. */
export function metricCount(cell: DayCell, metric: CalendarMetric, includeNonCountable: boolean): number {
  if (metric === 'checklists') return cell.checklistCount
  if (metric === 'total') return includeNonCountable ? cell.totalCountWithForms : cell.totalCount
  return includeNonCountable ? cell.speciesCountWithForms : cell.speciesCount
}

/** Non-zero active-metric counts across a DayCellMap — the input to
 *  computeCountyTiers (present-but-zero data days contribute 0 and are excluded
 *  from the tiering set, FR-20). Threads includeNonCountable through metricCount so
 *  turning the spuh toggle ON re-tiers over the with-forms Species range and a
 *  former present-but-zero day enters the non-zero tiering set (FR-45). */
export function nonZeroMetricCounts(
  cells: DayCellMap,
  metric: CalendarMetric,
  includeNonCountable: boolean,
): number[] {
  const out: number[] = []
  for (const cell of cells.values()) {
    const v = metricCount(cell, metric, includeNonCountable)
    if (v > 0) out.push(v)
  }
  return out
}
