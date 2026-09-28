// Calendar tab — the pure day-bucket derivation + lexical date helpers. React-free
// and unit-tested. Every count derives from the already-parsed eBird backup
// (ObservationEntry[]); no network, no re-parse.
//
// ALL date handling is lexical/component-based — never `new Date(str)` (which
// parses YYYY-MM-DD as UTC and shifts a day in negative-offset zones, FR-08/QA-08).
// daysInMonth / dayOfWeek / isValidCalendarDay are arithmetic.

import type { ObservationEntry } from '../types'
import { normalizeSpeciesName, isNonCountableForm } from './speciesUtils'
import {
  resolveDisplayBreedingCode, compareBreedingDefs, breedingCategoryForTier,
  type BreedingCodeDef, type BreedingCategory,
} from './breedingCodes'

/** Shared no-exclusion default (see buildDayCells). */
const EMPTY_EXCLUDED: ReadonlySet<string> = new Set<string>()

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
  /** One entry per distinct submissionId that touched this bucket. `date` is the full
   *  'YYYY-MM-DD' the checklist was logged on; `time` ("HH:MM AM/PM", or null when the
   *  export carried none) and `location` (the human location name) are captured from the
   *  FIRST row seen for that submissionId — all rows of one checklist share both.
   *  `speciesCount` / `speciesCountWithForms` are that ONE checklist's distinct-species
   *  tallies (normalized names): the countable-only count (spuh/slash/hybrid EXCLUDED,
   *  the default) and the with-forms count (spuh/slash/hybrid INCLUDED) respectively —
   *  the per-checklist analogue of the day-level fields above, `speciesCountWithForms >=
   *  speciesCount` always. Under a species filter each reflects the filtered view (so a
   *  single-species filter yields 0/1 per checklist, consistent with the rest of the tab);
   *  in the normal unfiltered case they are the checklist's full species count. Drives
   *  the popup's ChecklistLink rows (year-labeled in combined mode) plus a secondary
   *  "time · location · N species" line. Newest-first ordering is applied at render from
   *  these dates. Pure DISPLAY fields: they never enter any day-level count. */
  checklists: DayChecklist[]

  // ── Overlay facts (calendar-overlays). Computed in the same single pass as
  // every field above, whatever the overlay switches say, so flipping a switch
  // never rebuilds cells (FR-08). They follow the species filter (only rows
  // that pass it reach the accumulators) and IGNORE both the countable-form
  // rule and the escapee exclusion (FR-14): a photo of "gull sp." is still
  // media and a coded hybrid row is still breeding evidence.

  /** Any row in this bucket carried at least one catalog id. Equivalent to
   *  mediaIds.length > 0; its own boolean because it is what the cell and the
   *  accessible name read, and a boolean cannot be misread as a count. */
  mediaPresent: boolean
  /** DISTINCT catalog ids across every row in this bucket, first-seen order,
   *  string REFERENCES into the parsed rows. Combined view: the union across
   *  years (ids are globally unique). Joined against the ML export at render. */
  mediaIds: string[]
  /** mediaIds.length: what the condensed tile and the no-export suffix print. */
  mediaIdCount: number
  /** Checklists (distinct submissionIds) in this bucket with at least one
   *  catalog id. Combined view: across years, the same mechanism as
   *  checklistCount. */
  mediaChecklistCount: number
  /** Every DISTINCT display code recorded in this bucket, strongest first by
   *  the table's rank, unknown codes last, first-seen order among equals.
   *  Empty when no row carried a code. Combined view: per-code species sets
   *  are unions across years. */
  codes: DayCodeFact[]
  /** Distinct species at each CATEGORY: the union of the species sets of every
   *  code in that category, so a species carrying NY and FY counts once under
   *  Confirmed. What the "By category" tile rows print; the popup never
   *  reads it. */
  codeCategoryCounts: Readonly<Record<BreedingCategory, number>>
  /** codes[0]?.def ?? null: the STRONGEST code in this bucket, derived from the
   *  sort so it cannot disagree with codes. */
  breeding: BreedingCodeDef | null
}

/** One breeding code recorded in a bucket (or a checklist), with how many
 *  distinct species carried it there. `def` is the resolved DISPLAY code. */
export interface DayCodeFact {
  def: BreedingCodeDef
  /** Distinct normalized species names that carried this code. Under a species
   *  filter it is 1 for every entry. */
  speciesCount: number
}

/** One checklist's row in a DayCell (see DayCell.checklists). */
export interface DayChecklist {
  submissionId: string
  date: string
  time: string | null
  location: string
  speciesCount: number
  speciesCountWithForms: number
  /** This ONE checklist's DISTINCT catalog ids, first-seen order (overlays). */
  catalogIds: string[]
  /** This checklist's codes, same shape and order rule as DayCell.codes. */
  codes: DayCodeFact[]
  /** codes[0]?.def ?? null, as at day level. */
  breeding: BreedingCodeDef | null
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
 *  — plus a Map<submissionId, {date, time, location, countable, withForms}> whose two
 *  per-checklist Sets accumulate that ONE checklist's distinct species (same
 *  classification, same loop, same filter guard) → each checklist entry's own
 *  speciesCount / speciesCountWithForms for the popup. No per-cell rescans.
 *  Malformed-date rows are dropped per row (FR-12); a checklist still lands on the
 *  date its valid rows carry. buildDayCells itself takes no toggle flag; metricCount /
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
  /** Normalized names classified eBird Exotic: Escapee, read PASSIVELY from the
   *  persistent provenance cache (`useProvenanceLookup`). The Calendar never
   *  initiates a provenance request and imports no network module, so its
   *  zero-network guarantee (v0.5.63) is unchanged: when the cache is empty this
   *  set is empty and every number here is byte-identical to pre-feature
   *  (FR-26, FR-35, QA-40). Applied to the countable set only, exactly like the
   *  countable-name predicate it composes with; the with-forms set is untouched. */
  excludedNames: ReadonlySet<string> = EMPTY_EXCLUDED,
): DayCellMap {
  // Per checklist we carry its display fields (date + time + location) alongside the
  // id, PLUS its own two distinct-species Sets — a countable-only set and an all-names
  // (with-forms) set — accumulated over the SAME rows and under the SAME species-filter
  // skip as the day-level sets, so a checklist's count stays consistent with the view.
  // date/time/location are pure display; the two Sets are DISPLAY-only (they never touch
  // any day-level count) and collapse to sizes on output.
  interface ChecklistInfo {
    date: string
    time: string | null
    location: string
    countable: Set<string>
    withForms: Set<string>
    // Overlays: this checklist's distinct catalog ids and its codes -> species
    // carrying each. Allocated on first use: most checklists carry neither, and
    // an empty Set and Map per checklist was the bulk of the pass's added cost.
    catalogIds: Set<string> | null
    codes: CodeAcc | null
  }
  interface Work {
    bucketKey: string
    countable: Set<string>
    withForms: Set<string>
    checklists: Map<string, ChecklistInfo> // submissionId -> its display fields
    total: number // Σ individuals, countable rows only
    totalWithForms: number // Σ individuals, all rows (incl. spuh/slash/hybrid)
    mediaIds: Set<string> | null // overlays: distinct catalog ids (lazy, as above)
    codes: CodeAcc | null // overlays: display code -> { def, species carrying it } (lazy)
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
      w = { bucketKey, countable: new Set(), withForms: new Set(), checklists: new Map(), total: 0, totalWithForms: 0, mediaIds: null, codes: null }
      work.set(bucketKey, w)
    }
    const n = individualsOf(o.count) // "X"/blank/null → 0 (Statistics-consistent)
    // The RAW name deliberately: `o.commonName` still carries its trailing
    // parenthetical here, and the parenthetical IS the form eBird is judging.
    // Passing `norm` would lose the 56 forms whose base name reads like an
    // ordinary species ("Brewster's Warbler (hybrid)"). Same rule as Statistics'
    // filter, and the same rule the four CSV parsers apply.
    const countable = !isNonCountableForm(o.commonName) && !excludedNames.has(norm)
    w.withForms.add(norm)
    w.totalWithForms += n
    if (countable) {
      w.countable.add(norm)
      w.total += n
    }
    // Overlay facts (FR-09..FR-16). Deliberately AFTER the species-filter
    // `continue` (so they narrow to the filtered species) and OUTSIDE
    // `if (countable)` (so non-countable forms and escapees still contribute).
    // A Set is the whole de-duplication: the parser guarantees each id is
    // ^\d+$ but not that a row's ids are distinct ("ML123, 123" yields two
    // "123"s). No regex, split or search over the ids or the code: iteration and
    // hash lookups only (security.md linearity; schema.md 7.1 declares these).
    const ids = o.catalogIds
    if (ids.length > 0) {
      const set = w.mediaIds ?? (w.mediaIds = new Set())
      for (const id of ids) set.add(id)
    }
    const code = o.breedingCode
    if (code !== null) addCode(w.codes ?? (w.codes = new Map()), code, norm)
    // A checklist (submissionId) lands on THIS row's valid date. Globally-unique
    // eBird submission ids mean a per-bucket Set spanning years has a size that
    // legitimately equals the sum, so one mechanism serves both views. We capture
    // the checklist's time + location from the FIRST row seen for that submissionId
    // (all rows of one checklist share both) — purely for the popup's display; they
    // never feed any count. We ALSO accumulate this checklist's own distinct-species
    // Sets here (same `norm`/`countable` classification as the day sets, inside the
    // same filter-guarded loop) so the popup can show a per-checklist species count
    // consistent with the filtered view.
    if (o.submissionId) {
      let ci = w.checklists.get(o.submissionId)
      if (!ci) {
        ci = { date, time: o.time ?? null, location: o.location, countable: new Set(), withForms: new Set(), catalogIds: null, codes: null }
        w.checklists.set(o.submissionId, ci)
      }
      ci.withForms.add(norm)
      if (countable) ci.countable.add(norm)
      if (ids.length > 0) {
        const set = ci.catalogIds ?? (ci.catalogIds = new Set())
        for (const id of ids) set.add(id)
      }
      if (code !== null) addCode(ci.codes ?? (ci.codes = new Map()), code, norm)
    }
  }

  const out: DayCellMap = new Map()
  for (const [key, w] of work) {
    // mediaChecklistCount is counted inside the checklist walk that already
    // exists, never by a second pass over the rows or the checklists.
    let mediaChecklistCount = 0
    const checklists = [...w.checklists.entries()].map(([submissionId, info]): DayChecklist => {
      if (info.catalogIds !== null) mediaChecklistCount++
      const codes = sortCodes(info.codes)
      return {
        submissionId, date: info.date, time: info.time, location: info.location,
        speciesCount: info.countable.size, speciesCountWithForms: info.withForms.size,
        catalogIds: info.catalogIds ? [...info.catalogIds] : [],
        codes: finishCodes(codes),
        breeding: codes.length ? codes[0].def : null,
      }
    })
    const sorted = sortCodes(w.codes)
    out.set(key, {
      bucketKey: key,
      speciesCount: w.countable.size,
      speciesCountWithForms: w.withForms.size,
      checklistCount: w.checklists.size,
      totalCount: w.total,
      totalCountWithForms: w.totalWithForms,
      checklists,
      mediaPresent: w.mediaIds !== null,
      mediaIds: w.mediaIds ? [...w.mediaIds] : [],
      mediaIdCount: w.mediaIds ? w.mediaIds.size : 0,
      mediaChecklistCount,
      codes: finishCodes(sorted),
      codeCategoryCounts: categoryCounts(sorted),
      // The strongest code is the first of the sort rather than a separate
      // fold: the comparator keeps `a` on a tie and the sort is stable, so this
      // is exactly what strongerBreedingDef would have produced (FR-13).
      breeding: sorted.length ? sorted[0].def : null,
    })
  }
  return out
}

/** Per-bucket (or per-checklist) breeding accumulator: display code ->
 *  its resolved def and the normalized species names that carried it. A Map
 *  keyed by the raw token is a hash lookup, not a prototype walk, so a code of
 *  `__proto__` is just a code. Insertion order is first-seen order. */
type CodeAcc = Map<string, CodeEntry>
interface CodeEntry { def: BreedingCodeDef; species: Set<string> }

function addCode(acc: CodeAcc, code: string, norm: string): void {
  let e = acc.get(code)
  if (!e) {
    e = { def: resolveDisplayBreedingCode(code), species: new Set() }
    acc.set(code, e)
  }
  e.species.add(norm)
}

/** Strongest first. `[...acc.values()]` is first-seen order and
 *  Array.prototype.sort is stable (ES2019), so equal ranks (two unknown codes)
 *  keep first-seen order; the comparator compares ranks only, never strings,
 *  so no cost scales with a token's length. O(k log k) for k distinct codes. */
function sortCodes(acc: CodeAcc | null): CodeEntry[] {
  if (acc === null) return []
  return [...acc.values()].sort((a, b) => compareBreedingDefs(a.def, b.def))
}

function finishCodes(sorted: CodeEntry[]): DayCodeFact[] {
  return sorted.map(e => ({ def: e.def, speciesCount: e.species.size }))
}

const NO_CATEGORY_COUNTS: Readonly<Record<BreedingCategory, number>> = Object.freeze({ confirmed: 0, probable: 0, possible: 0 })

/** Distinct species at each category: one temporary Set per category present,
 *  each code's species folded in once, sizes kept, Sets discarded. A SUM of the
 *  per-code counts would count a species carrying two codes of one category
 *  twice (schema.md decision 13). */
function categoryCounts(sorted: CodeEntry[]): Readonly<Record<BreedingCategory, number>> {
  if (sorted.length === 0) return NO_CATEGORY_COUNTS
  const sets: Partial<Record<BreedingCategory, Set<string>>> = {}
  for (const e of sorted) {
    const cat = breedingCategoryForTier(e.def.tier)
    let set = sets[cat]
    if (!set) { set = new Set(); sets[cat] = set }
    for (const sp of e.species) set.add(sp)
  }
  return {
    confirmed: sets.confirmed?.size ?? 0,
    probable: sets.probable?.size ?? 0,
    possible: sets.possible?.size ?? 0,
  }
}

/** The noun a day's number belongs to (FR-28), in the words the zero-day
 *  accessible name already used. `withForms` is the flag metricCount was called
 *  with (the tab's effectiveForms). */
export function metricNoun(metric: CalendarMetric, withForms: boolean): 'checklists' | 'individuals' | 'species' | 'countable species' {
  if (metric === 'checklists') return 'checklists'
  if (metric === 'total') return 'individuals'
  return withForms ? 'species' : 'countable species'
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
