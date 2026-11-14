// One location's report (hotspot-reports schema section 4, FR-31 to FR-56).
//
// Split in two so that an escapee change never re-reads a checklist or re-parses
// a weather block: `deriveLocationFacts` is escapee-independent and runs per
// selection and per files epoch; `applySpeciesRule` is species-scaled and runs
// per facts or escapee-set change.
//
// Pure: no I/O, no clock, no React, no network import, no module-scoped mutable
// binding. Every keyed table is a `Map` or a `Set` of integers.
//
// DECLARED SCANS (schema 12.1): H5 the location's facts (one copy of its row
// slice, the shipped `computeChecklists` over it, one loop over the checklists,
// one loop over the rows with integer-keyed Set and Map operations, a sort of
// the distinct protocols), H6 the weather-block parse at a new call site (the
// shipped `computeWeatherStats`, called with that location's checklists only),
// H7 the species rule, H11 the protocol-name bound. No regex and none of the
// search primitives whose absence case scans to the end of a string; the suite
// asserts that absence with comments stripped. No `Date` is constructed.
//
// THE OPENING FIGURES (hotspot-report-order-and-stats decisions.md D-03 to
// D-06) add no read over file text: they read the numeric `duration` and
// `distance` cells and the integer day keys the checklist loop already holds.
// Every loop they add is driven by a COUNT of things in the file (checklists,
// distinct dates, life-list rows), never by a number read from it: the longest
// gap sorts the distinct dates and takes one difference per neighbouring pair
// in integer civil-day arithmetic (`civilDaysFrom`, Hinnant's days_from_civil),
// so a span of 9,999 years costs what a span of one day does. That is the one
// count of calendar days this module takes; it never goes through `Date` or a
// millisecond difference, so CLAUDE.md's rounding rule for midnights has
// nothing to round.

import type { ChecklistEntry, ObservationEntry } from '../types'
import { computeChecklists } from './birdingStats'
import {
  computeWeatherStats, WEATHER_SPECIES_MIN_CHECKLISTS,
  type WeatherDistRow, type WeatherStats,
} from './weatherStats'
import { inDisplayOrder } from './weatherDisplay'
import { protocolName } from './checklistMeta'
import { civilDaysFrom } from './formatDate'
import {
  compareDisplay, compareInstant, dayKey, dayToIso, firstSightingRecord, minuteOf12h,
  type FirstSighting,
} from './lifeLists'
import { boundText, isEligibleRow, type LocationIndex } from './hotspotReports'

// ── Bounds (schema 4.3, 4.4, 4.6, 12.3) ──────────────────────────────────────

/** FR-43: named protocol rows shown before the rest are summed. */
export const PROTOCOL_ROWS_MAX = 10
/** FR-43: a protocol name is shown through this bound. */
export const PROTOCOL_NAME_MAX_CHARS = 64
/** FR-52, schema 4.4: at most this many year rows; older years are summed. */
export const REPORT_YEAR_ROWS_MAX = 100
/** FR-53: the Statistics duration rule's ceiling (`computeDurationBins`, whose
 *  own constant is module-private). Held to it by a behavioral row in the
 *  suite, never by restating the number there. */
export const DURATION_MAX_MIN = 1440
/** A checklist's distance (kilometers, as eBird exports it) is usable from 0 to
 *  this many inclusive: 24 hours, FR-53's bound, at 100 km/h. A plausibility
 *  ceiling so one corrupt cell cannot become the place's total, not a judgement
 *  of a long driving count (hotspot-report-order-and-stats decisions.md D-02). */
export const DISTANCE_MAX_KM = 2400
/** NFR-03: the most-recorded list is at most this many rows. */
export const TOP_SPECIES_MAX = 10

/** FR-53's usable duration: a number, not negative, at most DURATION_MAX_MIN. */
function usableDuration(d: number | null): d is number {
  return typeof d === 'number' && d >= 0 && d <= DURATION_MAX_MIN
}
/** D-02's usable distance: a finite number from 0 to DISTANCE_MAX_KM inclusive. */
function usableDistance(d: number | null): d is number {
  return typeof d === 'number' && Number.isFinite(d) && d >= 0 && d <= DISTANCE_MAX_KM
}

// ── Shapes ───────────────────────────────────────────────────────────────────

export interface ProtocolRow {
  readonly kind: 'named' | 'other' | 'blank'
  /** The `protocolName` label cut to PROTOCOL_NAME_MAX_CHARS ('' for other and blank). */
  readonly name: string
  /** The label was longer than the bound; the surface writes the ellipsis. */
  readonly truncated: boolean
  readonly count: number
}

export type YearRow =
  | { readonly kind: 'year'; readonly year: number; readonly count: number }
  /** `before` is the first SHOWN year: the row is labeled "Before {before}". */
  | { readonly kind: 'earlier'; readonly before: number; readonly count: number }

export interface VisitRef { readonly submissionId: string; readonly day: number; readonly minute: number | null }

export interface SpeciesFact {
  readonly name: string
  /** The earliest ELIGIBLE row, built by Life Lists' own constructor; null when
   *  the species has none at the location (it is then not on the list). */
  readonly first: FirstSighting | null
  /** FR-37: distinct checklists at the location carrying the species on a
   *  countable-form row, dated or not. */
  readonly checklistCount: number
  /** Indexes into `checklists` carrying the species on an ELIGIBLE row (FR-54). */
  readonly eligibleChecklists: readonly number[]
}

export interface LocationFacts {
  readonly ord: number
  /** `computeChecklists` over the location's rows: date ascending. */
  readonly checklists: readonly ChecklistEntry[]
  readonly weather: WeatherStats
  readonly protocols: readonly ProtocolRow[]
  readonly complete: { readonly complete: number; readonly known: number; readonly unknown: number }
  readonly firstVisit: VisitRef | null
  /** Null when there is no dated checklist; equal to firstVisit when there is one. */
  readonly latestVisit: VisitRef | null
  readonly datedChecklists: number
  /** Exactly 12, January first. */
  readonly months: readonly number[]
  readonly years: readonly YearRow[]
  readonly timeBirded: { readonly minutes: number; readonly counted: number }
  /** The distinct dates among dated checklists (day keys, so an undated one adds none). */
  readonly daysBirded: number
  /** The distinct years with a dated checklist: how many, the first and the last. */
  readonly yearSpan: { readonly count: number; readonly first: number; readonly last: number } | null
  /** The most days between two neighbouring distinct dates, by integer civil-day
   *  arithmetic; `from` and `to` are the day keys either side, the earliest such
   *  pair winning a tie. Null when no two dates are a day or more apart. Whether
   *  it is DRAWN (three or more distinct dates) is `glanceView`'s rule. */
  readonly longestGap: { readonly days: number; readonly from: number; readonly to: number } | null
  /** D-02: the sum of the usable distances in kilometers, and how many there were. */
  readonly distance: { readonly km: number; readonly counted: number }
  readonly species: readonly SpeciesFact[]
  /** Per checklist: distinct species with an eligible row there, escapees included. */
  readonly checklistSpecies: Int32Array
  /** Per checklist: dayKey of its date, or 0 when undated. */
  readonly checklistDay: Int32Array
  /** Per checklist: minuteOf12h of its time, or -1 when blank. */
  readonly checklistMinute: Int32Array
}

export interface LocationLifeRow {
  readonly name: string
  readonly scientificName: string
  readonly day: number
  readonly minute: number | null
  readonly checklistId: string
  /** FR-37: the location's checklists carrying the species. */
  readonly checklists: number
  /** 1 for the oldest row, rows.length for the newest (the design's "N of M"). */
  readonly position: number
}

export interface LocationSpecies {
  /** Newest first, `compareDisplay`. */
  readonly rows: readonly LocationLifeRow[]
  /** rows.length: THE species total (FR-36). */
  readonly total: number
  /** FR-54, or null when no checklist here has a species under the rule.
   *  `day` is the checklist's day key, 0 when it is undated. */
  readonly biggest: { readonly checklist: ChecklistEntry; readonly species: number; readonly day: number } | null
  /** Species per hour (decisions.md D-03): the mean, over every checklist whose
   *  usable duration is above zero, of its species under the rule (the same
   *  per-checklist counts FR-54 reads, zero included) per hour. Null with none. */
  readonly perHour: { readonly mean: number; readonly counted: number } | null
  /** Life-list rows whose own checklist figure (FR-37) is exactly 1. */
  readonly recordedOnce: number
  /** At most TOP_SPECIES_MAX life-list rows, by their checklist figure
   *  descending, then name by locale compare: each is the row itself. */
  readonly top: readonly LocationLifeRow[]
}

const NO_OBSERVATIONS: readonly ObservationEntry[] = []

function compareId(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}

// ── deriveLocationFacts (schema 4.1) ─────────────────────────────────────────

interface FactBuilder {
  name: string
  firstRow: number
  firstDay: number
  firstMinute: number | null
  checklistCount: number
  eligibleChecklists: number[]
}

export function deriveLocationFacts(index: LocationIndex, obs: readonly ObservationEntry[], ord: number): LocationFacts {
  // 1. The location's rows, in file order.
  const from = index.locStart[ord]
  const to = index.locStart[ord + 1]
  const locObs: ObservationEntry[] = new Array(to - from)
  for (let k = from; k < to; k++) locObs[k - from] = obs[index.locRows[k]]

  // 2. The shipped roll-up, unmodified: every row of each checklist is here in
  //    file order, so each entry's fields are its first row's (FR-11).
  const checklists = computeChecklists(locObs)
  const C = checklists.length

  // 3. The shipped weather aggregation over this location's checklists only.
  //    The per-species tally (its second pass) is not shown, so no rows.
  const weather = computeWeatherStats(checklists, NO_OBSERVATIONS)

  // 4. The checklist figures, one loop.
  const protocolCounts = new Map<string, number>()
  let blank = 0
  let complete = 0
  let known = 0
  let unknown = 0
  let datedChecklists = 0
  const months = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
  const yearCounts = new Map<number, number>()
  let first: VisitRef | null = null
  let latest: VisitRef | null = null
  let minutes = 0
  let counted = 0
  let km = 0
  let distanceCounted = 0
  // Distinct dates, as integer day keys (D-04): the Days birded figure and the
  // longest gap's input. At most one entry per checklist.
  const days = new Set<number>()
  let firstYear = 0
  let lastYear = 0
  const checklistDay = new Int32Array(C)
  const checklistMinute = new Int32Array(C)
  const checklistIndex = new Map<string, number>()
  for (let ci = 0; ci < C; ci++) {
    const c = checklists[ci]
    checklistIndex.set(c.submissionId, ci)
    const p = c.protocol
    if (typeof p !== 'string' || p === '') blank += 1
    else protocolCounts.set(p, (protocolCounts.get(p) ?? 0) + 1)
    if (c.allObsReported === true) { complete += 1; known += 1 }
    else if (c.allObsReported === false) known += 1
    else unknown += 1
    const d = c.duration
    if (usableDuration(d)) { minutes += d; counted += 1 }
    const dist = c.distance
    if (usableDistance(dist)) { km += dist; distanceCounted += 1 }
    const minute = minuteOf12h(c.time)
    checklistMinute[ci] = minute === null ? -1 : minute
    const day = dayKey(c.date)
    if (day === null) continue
    checklistDay[ci] = day
    datedChecklists += 1
    days.add(day)
    months[Math.floor(day / 100) % 100 - 1] += 1
    const year = Math.floor(day / 10000)
    yearCounts.set(year, (yearCounts.get(year) ?? 0) + 1)
    if (yearCounts.size === 1 || year < firstYear) firstYear = year
    if (yearCounts.size === 1 || year > lastYear) lastYear = year
    const at: VisitRef = { submissionId: c.submissionId, day, minute }
    if (first === null) first = at
    else {
      const cmp = compareInstant(day, minute, first.day, first.minute)
      if (cmp < 0 || (cmp === 0 && compareId(c.submissionId, first.submissionId) < 0)) first = at
    }
    if (latest === null) latest = at
    else {
      const cmp = compareInstant(day, minute, latest.day, latest.minute)
      if (cmp > 0 || (cmp === 0 && compareId(c.submissionId, latest.submissionId) > 0)) latest = at
    }
  }

  // 5. The species facts, one loop over the location's rows. Distinctness is an
  //    integer key, species ordinal times C plus the checklist index, so no
  //    string key is built; the product stays far inside the safe integer range.
  const builders = new Map<number, FactBuilder>()
  const onChecklist = new Set<number>()
  const eligibleOn = new Set<number>()
  const checklistSpecies = new Int32Array(C)
  for (let k = from; k < to; k++) {
    const r = index.locRows[k]
    const s = index.rowSpecies[r]
    if (s < 0) continue
    const name = index.speciesNames[s]
    if (name === '') continue
    const o = obs[r]
    const ci = checklistIndex.get(o.submissionId)
    if (ci === undefined) continue
    let b = builders.get(s)
    if (b === undefined) {
      b = { name, firstRow: -1, firstDay: 0, firstMinute: null, checklistCount: 0, eligibleChecklists: [] }
      builders.set(s, b)
    }
    const pair = s * C + ci
    if (!onChecklist.has(pair)) { onChecklist.add(pair); b.checklistCount += 1 }
    if (!isEligibleRow(index, r)) continue
    if (!eligibleOn.has(pair)) {
      eligibleOn.add(pair)
      b.eligibleChecklists.push(ci)
      checklistSpecies[ci] += 1
    }
    const day = index.rowDay[r]
    const minute = minuteOf12h(o.time)
    if (b.firstRow >= 0) {
      const cmp = compareInstant(day, minute, b.firstDay, b.firstMinute)
      if (cmp > 0 || (cmp === 0 && compareId(o.submissionId, obs[b.firstRow].submissionId) >= 0)) continue
    }
    b.firstRow = r
    b.firstDay = day
    b.firstMinute = minute
  }
  const species: SpeciesFact[] = []
  for (const b of builders.values()) {
    species.push({
      name: b.name,
      first: b.firstRow < 0 ? null : firstSightingRecord(obs[b.firstRow], b.name, b.firstDay, b.firstMinute),
      checklistCount: b.checklistCount,
      eligibleChecklists: b.eligibleChecklists,
    })
  }

  return {
    ord,
    checklists,
    weather,
    protocols: protocolRows(protocolCounts, blank),
    complete: { complete, known, unknown },
    firstVisit: first,
    latestVisit: latest,
    datedChecklists,
    months,
    years: yearRows(yearCounts),
    timeBirded: { minutes, counted },
    daysBirded: days.size,
    yearSpan: yearCounts.size === 0 ? null : { count: yearCounts.size, first: firstYear, last: lastYear },
    longestGap: longestGap(days),
    distance: { km, counted: distanceCounted },
    species,
    checklistSpecies,
    checklistDay,
    checklistMinute,
  }
}

/**
 * FR-42, FR-43 (schema 4.3): cells named through `protocolName`; cells that
 * share a label after naming are one row; count descending then label; ten
 * named rows, the rest summed into one `other` row, the blank bucket last. The
 * counts sum to the checklist total by construction.
 */
function protocolRows(counts: ReadonlyMap<string, number>, blank: number): ProtocolRow[] {
  const byLabel = new Map<string, number>()
  for (const [cell, n] of counts) {
    const label = protocolName(cell)
    byLabel.set(label, (byLabel.get(label) ?? 0) + n)
  }
  const named = [...byLabel].sort((a, b) => (a[1] !== b[1] ? b[1] - a[1] : a[0].localeCompare(b[0])))
  const out: ProtocolRow[] = []
  let other = 0
  for (let i = 0; i < named.length; i++) {
    if (i < PROTOCOL_ROWS_MAX) {
      const { text, truncated } = boundText(named[i][0], PROTOCOL_NAME_MAX_CHARS)
      out.push({ kind: 'named', name: text, truncated, count: named[i][1] })
    } else other += named[i][1]
  }
  if (other > 0) out.push({ kind: 'other', name: '', truncated: false, count: other })
  if (blank > 0) out.push({ kind: 'blank', name: '', truncated: false, count: blank })
  return out
}

/** FR-52, schema 4.4: the years present, ascending, at most the most recent
 *  REPORT_YEAR_ROWS_MAX as rows and any older ones summed into one leading row,
 *  so the figure still sums to the dated checklists. */
function yearRows(counts: ReadonlyMap<number, number>): YearRow[] {
  const years = [...counts.keys()].sort((a, b) => a - b)
  const cut = years.length - REPORT_YEAR_ROWS_MAX
  const out: YearRow[] = []
  if (cut > 0) {
    let sum = 0
    for (let i = 0; i < cut; i++) sum += counts.get(years[i]) ?? 0
    out.push({ kind: 'earlier', before: years[cut], count: sum })
  }
  for (let i = Math.max(cut, 0); i < years.length; i++) out.push({ kind: 'year', year: years[i], count: counts.get(years[i]) ?? 0 })
  return out
}

/**
 * D-04: the longest gap between neighbouring distinct dates. Each day key is
 * taken to its civil day number once (`civilDaysFrom`, integer arithmetic over
 * the key's own Y/M/D; no `Date`), the pairs are sorted by that number, and the
 * gap is one subtraction per neighbouring pair: O(D log D) in the distinct
 * dates, independent of how many days the dates span. Sorting by the civil
 * number rather than the key keeps every difference non-negative for the one
 * key shape that is not a calendar date, a day past its month's end
 * (`2024-02-31`, which `dayKey` admits and civil arithmetic reads as Mar 2); two
 * keys on one civil day are a gap of 0, never drawn. A key whose year is 0000
 * has no civil day (`civilDaysFrom` refuses it) and is left out of the gap.
 * Strictly greater replaces, so the earliest pair wins a tie.
 */
function longestGap(days: ReadonlySet<number>): LocationFacts['longestGap'] {
  const civil: { readonly at: number; readonly day: number }[] = []
  for (const day of days) {
    const at = civilDaysFrom(dayToIso(day))
    if (at !== null) civil.push({ at, day })
  }
  civil.sort((a, b) => a.at - b.at || a.day - b.day)
  let best: { days: number; from: number; to: number } | null = null
  for (let i = 1; i < civil.length; i++) {
    const span = civil[i].at - civil[i - 1].at
    if (span > 0 && (best === null || span > best.days)) best = { days: span, from: civil[i - 1].day, to: civil[i].day }
  }
  return best
}

// ── applySpeciesRule (schema 4.2, FR-33 to FR-38, FR-54) ──────────────────────

type MutableLifeRow = { -readonly [K in keyof LocationLifeRow]: LocationLifeRow[K] }

export function applySpeciesRule(facts: LocationFacts, escapees: ReadonlySet<string>): LocationSpecies {
  const rows: MutableLifeRow[] = []
  for (const f of facts.species) {
    if (f.first === null || escapees.has(f.name)) continue
    rows.push({
      name: f.name, scientificName: f.first.scientificName, day: f.first.day, minute: f.first.minute,
      checklistId: f.first.submissionId, checklists: f.checklistCount, position: 0,
    })
  }
  rows.sort(compareDisplay)
  // Assigned after the sort, as Life Lists assigns it: the newest row carries
  // rows.length and the oldest carries 1.
  for (let i = 0; i < rows.length; i++) rows[i].position = rows.length - i

  // FR-54: the checklist with the most species under the rule, the earliest by
  // FR-51's order winning a tie (a dated checklist before an undated one, two
  // undated ones by Submission ID).
  const counts = facts.checklistSpecies.slice()
  for (const f of facts.species) {
    if (!escapees.has(f.name)) continue
    for (const ci of f.eligibleChecklists) counts[ci] -= 1
  }
  let best = -1
  for (let ci = 0; ci < counts.length; ci++) {
    if (counts[ci] <= 0) continue
    if (best < 0 || counts[ci] > counts[best] || (counts[ci] === counts[best] && earlierChecklist(facts, ci, best))) best = ci
  }

  // D-03: species per hour from the SAME per-checklist counts, over every
  // checklist whose usable duration is above zero. A timed checklist with no
  // species under the rule is a real outing that counted nothing, so it stays
  // in the mean at zero (Statistics' own figure leaves such a checklist out).
  let rate = 0
  let timed = 0
  for (let ci = 0; ci < counts.length; ci++) {
    const d = facts.checklists[ci].duration
    if (!usableDuration(d) || d === 0) continue
    rate += counts[ci] / (d / 60)
    timed += 1
  }

  // D-05: the two figures read off the life list's own rows.
  let recordedOnce = 0
  for (const r of rows) if (r.checklists === 1) recordedOnce += 1

  return {
    rows,
    total: rows.length,
    biggest: best < 0 ? null : { checklist: facts.checklists[best], species: counts[best], day: facts.checklistDay[best] },
    perHour: timed === 0 ? null : { mean: rate / timed, counted: timed },
    recordedOnce,
    top: topRows(rows),
  }
}

/** The most-recorded order: the checklist figure descending, then name. */
function compareTop(a: LocationLifeRow, b: LocationLifeRow): number {
  return a.checklists !== b.checklists ? b.checklists - a.checklists : a.name.localeCompare(b.name)
}

/**
 * D-05: the first TOP_SPECIES_MAX rows in `compareTop` order, by insertion into
 * a list that never holds more than TOP_SPECIES_MAX + 1 rows, so the cost is
 * linear in the life list (at most eleven comparisons a row) rather than a sort
 * of all of it. A row equal to one already held goes after it, which is what a
 * stable sort then a cut would give; the suite holds the two equal.
 */
function topRows(rows: readonly LocationLifeRow[]): LocationLifeRow[] {
  const top: LocationLifeRow[] = []
  for (const r of rows) {
    if (top.length === TOP_SPECIES_MAX && compareTop(r, top[top.length - 1]) >= 0) continue
    let at = top.length
    while (at > 0 && compareTop(r, top[at - 1]) < 0) at -= 1
    top.splice(at, 0, r)
    if (top.length > TOP_SPECIES_MAX) top.pop()
  }
  return top
}

// ── The opening figures, as drawn (design-refinement "At a glance") ───────────

export type GlanceSpecies =
  | { readonly kind: 'only'; readonly row: LocationLifeRow }
  | { readonly kind: 'pair'; readonly first: LocationLifeRow; readonly newest: LocationLifeRow }

/** Which At a glance figures a place shows, with their numbers. A null member
 *  is not drawn: the many / one / none rule applied to figures. The fact rows
 *  the shipped tab already drew (visits, time birded, the biggest checklist)
 *  are read from the facts and the species directly, as before. */
export interface GlanceView {
  readonly days: { readonly days: number; readonly dated: number } | null
  readonly years: { readonly count: number; readonly first: number; readonly last: number } | null
  /** `aboveZero` when the figure rests on fewer checklists than Time birded
   *  counts, which happens exactly when a checklist recorded a duration of 0. */
  readonly perHour: { readonly mean: number; readonly counted: number; readonly aboveZero: boolean } | null
  readonly recordedOnce: { readonly once: number; readonly species: number } | null
  readonly gap: { readonly days: number; readonly from: number; readonly to: number } | null
  readonly distance: { readonly km: number; readonly counted: number } | null
  readonly species: GlanceSpecies | null
}

export function glanceView(facts: LocationFacts, species: LocationSpecies): GlanceView {
  const C = facts.checklists.length
  const S = species.total
  const twoDated = facts.datedChecklists >= 2
  let lifeRows: GlanceSpecies | null = null
  if (S === 1) lifeRows = { kind: 'only', row: species.rows[0] }
  else if (S > 1 && species.rows[S - 1].day !== species.rows[0].day) {
    // The oldest row is the list's last (position 1), the newest its first.
    lifeRows = { kind: 'pair', first: species.rows[S - 1], newest: species.rows[0] }
  }
  return {
    days: twoDated ? { days: facts.daysBirded, dated: facts.datedChecklists } : null,
    years: twoDated && facts.yearSpan !== null ? facts.yearSpan : null,
    perHour: species.perHour !== null && S > 0
      ? { mean: species.perHour.mean, counted: species.perHour.counted, aboveZero: species.perHour.counted < facts.timeBirded.counted }
      : null,
    recordedOnce: C >= 2 && S >= 2 ? { once: species.recordedOnce, species: S } : null,
    gap: facts.daysBirded >= 3 ? facts.longestGap : null,
    distance: facts.distance.counted > 0 ? facts.distance : null,
    species: lifeRows,
  }
}

/** The Most-recorded section (the many / one / none rule): a list with two or
 *  more species, one sentence with exactly one, and nothing at all at one
 *  checklist (every species ties at one) or with no countable species. */
export type MostRecordedView =
  | { readonly kind: 'list'; readonly rows: readonly LocationLifeRow[] }
  | { readonly kind: 'one'; readonly row: LocationLifeRow }

export function mostRecordedView(facts: LocationFacts, species: LocationSpecies): MostRecordedView | null {
  if (facts.checklists.length < 2 || species.total === 0) return null
  return species.total === 1 ? { kind: 'one', row: species.rows[0] } : { kind: 'list', rows: species.top }
}

function earlierChecklist(facts: LocationFacts, a: number, b: number): boolean {
  const da = facts.checklistDay[a]
  const db = facts.checklistDay[b]
  if ((da === 0) !== (db === 0)) return da !== 0
  if (da !== 0) {
    const ma = facts.checklistMinute[a]
    const mb = facts.checklistMinute[b]
    const cmp = compareInstant(da, ma < 0 ? null : ma, db, mb < 0 ? null : mb)
    if (cmp !== 0) return cmp < 0
  }
  return compareId(facts.checklists[a].submissionId, facts.checklists[b].submissionId) < 0
}

// ── The weather summary (schema 4.7, FR-46 to FR-49) ─────────────────────────

export interface WeatherFigure {
  /** In the section's display order (sky: CONDITION_DISPLAY_ORDER; temperature
   *  and wind: ascending bands). Every band, zero bands included. */
  readonly rows: readonly WeatherDistRow[]
  /** The sum of the rows' checklists: this figure's own denominator. */
  readonly denominator: number
  /** Index into `rows` of the most common band, or null below the floor. */
  readonly typical: number | null
}

export type WeatherView =
  | { readonly state: 'none' }
  | { readonly state: 'below-floor'; readonly readable: number; readonly unreadable: number; readonly total: number }
  | {
    readonly state: 'full'; readonly readable: number; readonly unreadable: number; readonly total: number
    readonly sky: WeatherFigure; readonly temperature: WeatherFigure; readonly wind: WeatherFigure
  }

function figure(rows: readonly WeatherDistRow[], floor: number): WeatherFigure {
  let denominator = 0
  let typical = -1
  for (let i = 0; i < rows.length; i++) {
    denominator += rows[i].checklists
    // Strictly greater, so a tie goes to the band shown first.
    if (typical < 0 || rows[i].checklists > rows[typical].checklists) typical = i
  }
  return { rows, denominator, typical: denominator < floor || typical < 0 ? null : typical }
}

/**
 * The section's state from the shipped aggregation. `floor` is read from
 * `WEATHER_SPECIES_MIN_CHECKLISTS` and never restated; the defaulted parameter
 * exists so QA-46's test double can move the boundary.
 */
export function weatherView(weather: WeatherStats, floor: number = WEATHER_SPECIES_MIN_CHECKLISTS): WeatherView {
  if (weather.foundCount === 0) return { state: 'none' }
  const readable = weather.readableCount
  const unreadable = weather.unreadableCount
  const total = weather.totalChecklists
  if (readable < floor) return { state: 'below-floor', readable, unreadable, total }
  return {
    state: 'full', readable, unreadable, total,
    sky: figure(inDisplayOrder(weather.byCondition), floor),
    temperature: figure(weather.byTempBand, floor),
    wind: figure(weather.byWindBand, floor),
  }
}
