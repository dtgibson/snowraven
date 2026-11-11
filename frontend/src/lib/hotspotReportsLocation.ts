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
// asserts that absence with comments stripped. No `Date` is constructed and no
// count of calendar days is taken (schema 4.4).

import type { ChecklistEntry, ObservationEntry } from '../types'
import { computeChecklists } from './birdingStats'
import {
  computeWeatherStats, WEATHER_SPECIES_MIN_CHECKLISTS,
  type WeatherDistRow, type WeatherStats,
} from './weatherStats'
import { inDisplayOrder } from './weatherDisplay'
import { protocolName } from './checklistMeta'
import {
  compareDisplay, compareInstant, dayKey, firstSightingRecord, minuteOf12h,
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
    if (typeof d === 'number' && d >= 0 && d <= DURATION_MAX_MIN) { minutes += d; counted += 1 }
    const minute = minuteOf12h(c.time)
    checklistMinute[ci] = minute === null ? -1 : minute
    const day = dayKey(c.date)
    if (day === null) continue
    checklistDay[ci] = day
    datedChecklists += 1
    months[Math.floor(day / 100) % 100 - 1] += 1
    const year = Math.floor(day / 10000)
    yearCounts.set(year, (yearCounts.get(year) ?? 0) + 1)
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
  return {
    rows,
    total: rows.length,
    biggest: best < 0 ? null : { checklist: facts.checklists[best], species: counts[best], day: facts.checklistDay[best] },
  }
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
