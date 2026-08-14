// Pure statistics derivations for the Statistics tab. Extracted from BirdingStats.tsx
// so the math is unit-testable and the component is rendering-only. Every function
// here is a pure transform of observations / checklists — no React, no I/O.

import type { ObservationEntry, ChecklistEntry } from '../types'
import type { MLExportRow } from './parseMLExport'
import { normalizeSpeciesName, isNonCountableForm } from './speciesUtils'
import { BREEDING_CODE_MAP } from './breedingCodes'
import { hasTideBlock, hasSnowravenWeatherBlock, hasRaincrowWeatherBlock } from './commentBlocks'

// ── Constants ───────────────────────────────────────────────────────────────

export const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
export const DOW_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
export const KM_TO_MI = 0.621371
export const HA_TO_ACRE = 2.471054

export const MILESTONE_THRESHOLDS = [
  10, 20, 30, 40, 50, 60, 70, 80, 90,
  100, 125, 150, 175, 200, 225, 250, 275, 300, 325, 350, 375, 400, 425, 450, 475,
  500, 550, 600, 650, 700, 750, 800, 850, 900, 950,
  1000, 1250, 1500, 1750, 2000, 2500, 3000,
]

export type Granularity = 'total' | 'weekly' | 'monthly' | 'yearly'
export type PeriodGranularity = Exclude<Granularity, 'total'>

/** Shared no-exclusion default, so callers that predate the escapee rule keep
 *  byte-identical behavior and no call site allocates a Set per invocation. */
const EMPTY_EXCLUDED: ReadonlySet<string> = new Set<string>()

// ── Helpers ───────────────────────────────────────────────────────────────────

export function parseHour(time: string | null | undefined): number | null {
  if (!time) return null
  const m = time.match(/^(\d+):(\d+)\s*(AM|PM)$/i)
  if (!m) return null
  let hour = parseInt(m[1], 10)
  const period = m[3].toUpperCase()
  if (period === 'PM' && hour !== 12) hour += 12
  if (period === 'AM' && hour === 12) hour = 0
  return hour
}

export function getPeriodKey(date: string, granularity: PeriodGranularity): string {
  if (granularity === 'yearly') return date.substring(0, 4)
  if (granularity === 'monthly') return date.substring(0, 7)
  const d = new Date(date + 'T12:00:00')
  const start = new Date(d.getFullYear(), 0, 1)
  const week = Math.ceil((Math.floor((d.getTime() - start.getTime()) / 86400000) + 1) / 7)
  return `${d.getFullYear()}-W${String(week).padStart(2, '0')}`
}

export function formatPeriodLabel(key: string, granularity: PeriodGranularity): string {
  if (granularity === 'yearly') return key
  if (granularity === 'monthly') {
    const [y, m] = key.split('-')
    return `${MONTH_LABELS[parseInt(m, 10) - 1]} '${y.slice(2)}`
  }
  const [, w] = key.split('-W')
  return `W${w}`
}

// ── Filtering ───────────────────────────────────────────────────────────────

/** Drop the forms eBird does not count toward a species list, unless the user opts
 *  to include them. Everything downstream of this filter is a COUNT (life list,
 *  per-checklist species counts, milestones, county aggregates).
 *
 *  `commonName` here is the RAW exported name, which is what `isNonCountableForm`
 *  wants: the form is what eBird is judging and the form only exists in the raw
 *  name. That keeps "Canada Goose (moffitti/maxima)" counting as Canada Goose and
 *  "Brewster's Warbler (hybrid)" not counting at all. */
export function filterObservations(rawObs: ObservationEntry[], includeSpuh: boolean): ObservationEntry[] {
  return includeSpuh ? rawObs : rawObs.filter(o => !isNonCountableForm(o.commonName))
}

// ── Derivations ───────────────────────────────────────────────────────────────

/** One checklist row per submission, species + individual counts rolled up, sorted by date. */
export function computeChecklists(filteredObs: ObservationEntry[]): ChecklistEntry[] {
  const speciesBySub = new Map<string, Set<string>>()
  const firstRowBySub = new Map<string, ObservationEntry>()
  const countBySub = new Map<string, number>()
  for (const o of filteredObs) {
    if (!firstRowBySub.has(o.submissionId)) {
      firstRowBySub.set(o.submissionId, o)
      speciesBySub.set(o.submissionId, new Set())
    }
    speciesBySub.get(o.submissionId)!.add(normalizeSpeciesName(o.commonName))
    if (o.count !== null) countBySub.set(o.submissionId, (countBySub.get(o.submissionId) ?? 0) + o.count)
  }
  const result: ChecklistEntry[] = []
  for (const [subId, firstRow] of firstRowBySub) {
    result.push({
      submissionId: subId,
      date: firstRow.date,
      location: firstRow.location,
      locationId: firstRow.locationId,
      latitude: firstRow.latitude,
      longitude: firstRow.longitude,
      county: firstRow.county,
      stateProvince: firstRow.stateProvince ?? null,
      time: firstRow.time ?? null,
      duration: firstRow.duration ?? null,
      distance: firstRow.distance ?? null,
      area: firstRow.area ?? null,
      protocol: firstRow.protocol ?? null,
      numObservers: firstRow.numObservers ?? null,
      allObsReported: firstRow.allObsReported ?? null,
      checklistComments: firstRow.checklistComments ?? '',
      speciesCount: speciesBySub.get(subId)!.size,
      individualCount: countBySub.get(subId) ?? 0,
    })
  }
  return result.sort((a, b) => a.date.localeCompare(b.date))
}

/** Sorted list of distinct (normalized) species names. */
export function computeLifeList(filteredObs: ObservationEntry[]): string[] {
  const seen = new Set<string>()
  for (const o of filteredObs) seen.add(normalizeSpeciesName(o.commonName))
  return [...seen].sort()
}

/** Top species by total individuals counted and by distinct checklists reported on. */
export function computeTopSpecies(filteredObs: ObservationEntry[]) {
  const countBySp = new Map<string, number>()
  const cklBySp = new Map<string, Set<string>>()
  let hasCounts = false
  for (const o of filteredObs) {
    const norm = normalizeSpeciesName(o.commonName)
    let subs = cklBySp.get(norm)
    if (!subs) { subs = new Set(); cklBySp.set(norm, subs) }
    subs.add(o.submissionId)
    if (o.count !== null) {
      countBySp.set(norm, (countBySp.get(norm) ?? 0) + o.count)
      hasCounts = true
    }
  }
  const byIndividuals = [...countBySp.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([name, total]) => ({ name, total }))
  const byChecklists = [...cklBySp.entries()]
    .sort((a, b) => b[1].size - a[1].size)
    .slice(0, 10)
    .map(([name, set]) => ({ name, count: set.size }))
  return { byIndividuals, byChecklists, hasCounts }
}

/** Headline totals: species/checklists/locations/years/states/countries + date span. */
export function computeTotals(checklists: ChecklistEntry[], lifeList: string[]) {
  const locations = new Set<string>()
  const years = new Set<string>()
  const states = new Set<string>()
  const countries = new Set<string>()
  // Earliest/latest date tracked in this pass. Dates are fixed-width YYYY-MM-DD,
  // so lexicographic `<`/`>` matches calendar order — no need to allocate and
  // sort a separate dates array just to read the min and max.
  let firstDate: string | null = null
  let lastDate: string | null = null
  for (const c of checklists) {
    locations.add(c.locationId)
    years.add(c.date.substring(0, 4))
    if (c.stateProvince) {
      states.add(c.stateProvince)
      const country = c.stateProvince.split('-')[0]
      if (country) countries.add(country)
    }
    if (firstDate === null || c.date < firstDate) firstDate = c.date
    if (lastDate === null || c.date > lastDate) lastDate = c.date
  }
  return {
    speciesCount: lifeList.length,
    checklistCount: checklists.length,
    locationCount: locations.size,
    yearCount: years.size,
    stateCount: states.size,
    countryCount: countries.size,
    firstDate,
    lastDate,
  }
}

/** Distinct countable names in `lifeList` that are NOT classified eBird
 *  Exotic: Escapee (`useProvenanceLookup` / `useExoticProvenance` supply the set).
 *
 *  The escapee rule COMPOSES with the countable-name predicate and never
 *  replaces it: `lifeList` has already been through `filterObservations`, so
 *  this is a second predicate on the same normalized value. An empty set is a
 *  no-op returning the same array, which is what makes an unresolved cache
 *  produce byte-identical pre-feature numbers. */
export function countableLifeList(lifeList: string[], excludedNames: ReadonlySet<string>): string[] {
  if (excludedNames.size === 0) return lifeList
  return lifeList.filter(n => !excludedNames.has(n))
}

/** Life-list accumulation curve + milestone hits (chronological pass over observations).
 *
 *  `excludedNames` drops eBird escapees from the accumulation entirely, so the
 *  Nth milestone is the Nth species that counts toward a life list. Pass an
 *  empty set for the unfiltered series; the two are computed in ONE memo pass on
 *  Statistics and selected at read, so the "Count escapees" toggle is never a
 *  memo input (NFR-02). */
export function computeAccumulation(
  filteredObs: ObservationEntry[],
  accGranularity: Granularity,
  excludedNames: ReadonlySet<string> = EMPTY_EXCLUDED,
) {
  const sorted = [...filteredObs].sort((a, b) => a.date.localeCompare(b.date))
  const seen = new Set<string>()
  const milestoneMap = new Map<number, { date: string; species: string; submissionId: string }>()
  const byPeriod = new Map<string, number>()
  const liferDates = new Map<string, { count: number; species: string }>()
  let firstSpecies: { date: string; name: string } | null = null
  const thresholds = MILESTONE_THRESHOLDS

  for (const o of sorted) {
    const norm = normalizeSpeciesName(o.commonName)
    if (excludedNames.has(norm)) continue
    if (!seen.has(norm)) {
      seen.add(norm)
      const count = seen.size
      if (!firstSpecies) firstSpecies = { date: o.date, name: norm }
      for (const t of thresholds) {
        if (count === t && !milestoneMap.has(t)) {
          milestoneMap.set(t, { date: o.date, species: norm, submissionId: o.submissionId })
        }
      }
      liferDates.set(o.date, { count, species: norm })
      if (accGranularity !== 'total') {
        byPeriod.set(getPeriodKey(o.date, accGranularity as PeriodGranularity), count)
      }
    }
  }

  const chartData = accGranularity !== 'total'
    ? [...byPeriod.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([period, species]) => ({ period, species }))
    : []

  const liferPoints = [...liferDates.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, { count, species }]) => ({ date, count, species }))

  return { chartData, liferPoints, milestones: milestoneMap, firstSpecies }
}

/** Checklist activity by year, month, day-of-week, and start hour. */
export function computeTemporal(checklists: ChecklistEntry[], filteredObs: ObservationEntry[]) {
  const byYearMap = new Map<string, { checklists: number; species: Set<string> }>()
  const bestDayByYear = new Map<string, { species: number; submissionId: string }>()
  const byMonthMap = new Map<number, { checklists: number; species: Set<string> }>()
  const byDow = new Map<number, number>()
  const byHour = new Map<number, number>()

  for (const c of checklists) {
    const year = c.date.substring(0, 4)
    const month = parseInt(c.date.substring(5, 7), 10) - 1

    if (!byYearMap.has(year)) byYearMap.set(year, { checklists: 0, species: new Set() })
    byYearMap.get(year)!.checklists++

    const existing = bestDayByYear.get(year)
    if (!existing || c.speciesCount > existing.species) {
      bestDayByYear.set(year, { species: c.speciesCount, submissionId: c.submissionId })
    }

    if (!byMonthMap.has(month)) byMonthMap.set(month, { checklists: 0, species: new Set() })
    byMonthMap.get(month)!.checklists++

    // getDay() is timezone-sensitive; use noon UTC workaround
    const dow = new Date(c.date + 'T12:00:00').getDay()
    byDow.set(dow, (byDow.get(dow) ?? 0) + 1)

    const hour = parseHour(c.time)
    if (hour !== null) byHour.set(hour, (byHour.get(hour) ?? 0) + 1)
  }

  for (const o of filteredObs) {
    const year = o.date.substring(0, 4)
    const month = parseInt(o.date.substring(5, 7), 10) - 1
    const norm = normalizeSpeciesName(o.commonName)
    byYearMap.get(year)?.species.add(norm)
    byMonthMap.get(month)?.species.add(norm)
  }

  const yearRows = [...byYearMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([year, d]) => ({
      label: year,
      checklists: d.checklists,
      species: d.species.size,
      bestDay: bestDayByYear.get(year) ?? null,
    }))

  const monthRows = Array.from({ length: 12 }, (_, i) => ({
    label: MONTH_LABELS[i],
    checklists: byMonthMap.get(i)?.checklists ?? 0,
    species: byMonthMap.get(i)?.species.size ?? 0,
  }))

  const dowRows = Array.from({ length: 7 }, (_, i) => ({
    label: DOW_LABELS[i],
    value: byDow.get(i) ?? 0,
  }))

  const hourRows = Array.from({ length: 24 }, (_, i) => ({
    label: i === 0 ? '12am' : i < 12 ? `${i}am` : i === 12 ? '12pm' : `${i - 12}pm`,
    value: byHour.get(i) ?? 0,
  }))

  return { yearRows, monthRows, dowRows, hourRows }
}

// ── Checklist duration bins ─────────────────────────────────────────────────
// Lower-inclusive half-open bins: 15-minute steps [0,15) … [165,180) for the
// first three hours, then hourly [180,240), [240,300), … So a 15-minute
// checklist lands in [15,30) and a 180-minute one in [180,240).

const DURATION_FINE_BIN_MIN = 15
const DURATION_FINE_BIN_COUNT = 12 // 12 × 15 min = the first 3 hours
const DURATION_HOURLY_START_MIN = DURATION_FINE_BIN_COUNT * DURATION_FINE_BIN_MIN // 180
// eBird caps a checklist's duration at 24 h, so anything outside [0, 1440] is a
// corrupt or hostile cell (a CSV column shift can drop an ML catalog number
// into "Duration (Min)"), not data. computeDurationBins treats out-of-range
// durations as duration-less — without this guard the bin ladder's length is
// arithmetic in the single largest value (gigabytes of bins and a render-time
// crash from one bad row), and a negative value bins invisibly at a negative
// index. Security-review remediation; the parser's NaN check stays as-is.
const DURATION_SANE_MAX_MIN = 1440
// Terminal bin: [1380, 1440], CLOSED at the cap (the standard terminal-bin
// histogram convention) so an exactly-24h checklist stays visible without
// minting a bin past the cap. 12 fine + 21 hourly = 33 bins, the structural
// maximum of the ladder.
const DURATION_MAX_BIN_INDEX =
  DURATION_FINE_BIN_COUNT + (DURATION_SANE_MAX_MIN - DURATION_HOURLY_START_MIN) / 60 - 1 // 32

function durationBinIndex(min: number): number {
  if (min < DURATION_HOURLY_START_MIN) return Math.floor(min / DURATION_FINE_BIN_MIN)
  return DURATION_FINE_BIN_COUNT + Math.floor((min - DURATION_HOURLY_START_MIN) / 60)
}

function durationBinBounds(i: number): { lo: number; hi: number } {
  if (i < DURATION_FINE_BIN_COUNT) {
    return { lo: i * DURATION_FINE_BIN_MIN, hi: (i + 1) * DURATION_FINE_BIN_MIN }
  }
  const lo = DURATION_HOURLY_START_MIN + (i - DURATION_FINE_BIN_COUNT) * 60
  return { lo, hi: lo + 60 }
}

// Compact histogram-label form of a bin bound ("45m", "2h", "1h 45m") — a
// label-density sibling of statsFormat's formatDuration, which spells full
// units ("1 hr, 45 min") and would be noise at bar-label width. Bounds are
// exact bin edges (whole minutes), so no rounding is needed here.
function fmtDurationBound(min: number): string {
  if (min < 60) return `${min}m`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m === 0 ? `${h}h` : `${h}h ${m}m`
}

// "0-15m" / "45-60m" (shared minute unit), "3-4h" (shared whole-hour unit),
// else full form on each side ("1h 45m-2h"). Hyphen ranges — never em dashes
// (user-facing-copy convention).
function durationBinLabel(lo: number, hi: number): string {
  if (lo < 60 && hi <= 60) return `${lo}-${hi}m`
  if (lo % 60 === 0 && hi % 60 === 0) return `${lo / 60}-${hi / 60}h`
  return `${fmtDurationBound(lo)}-${fmtDurationBound(hi)}`
}

/**
 * Checklist-duration histogram for Temporal Stats. Bins run from [0,15) up to
 * and including the bin containing the longest in-range duration; zero-count
 * bins inside that range are kept (honest shape), bins beyond it are omitted.
 * Checklists with no duration OR a duration outside [0, DURATION_SANE_MAX_MIN]
 * (eBird's own 24 h cap) are excluded from the bins, from `durationCount`
 * coverage, AND from `avgDurationMin` — the ladder is then structurally
 * bounded at 33 bins, so one corrupt cell can neither exhaust memory nor skew
 * the caption. `avgDurationMin` is this block's OWN average over exactly the
 * durations the bars show: it equals computeEffort's on sane data (a parity
 * test locks that) but deliberately diverges when out-of-range values exist —
 * computeEffort's shipped behavior is unchanged and still counts them.
 */
export function computeDurationBins(checklists: ChecklistEntry[]) {
  const counts = new Map<number, number>()
  let totalDurationMin = 0
  let durationCount = 0
  let maxIdx = -1
  for (const c of checklists) {
    // Range guard (security remediation): negative and >24h durations are
    // duration-less here, same as null — see DURATION_SANE_MAX_MIN above.
    if (c.duration === null || c.duration < 0 || c.duration > DURATION_SANE_MAX_MIN) continue
    totalDurationMin += c.duration
    durationCount++
    // Math.min only bites for exactly 1440 (the closed terminal-bin edge).
    const idx = Math.min(durationBinIndex(c.duration), DURATION_MAX_BIN_INDEX)
    counts.set(idx, (counts.get(idx) ?? 0) + 1)
    if (idx > maxIdx) maxIdx = idx
  }
  const bins: { label: string; value: number; lo: number; hi: number }[] = []
  for (let i = 0; i <= maxIdx; i++) {
    const { lo, hi } = durationBinBounds(i)
    bins.push({ label: durationBinLabel(lo, hi), value: counts.get(i) ?? 0, lo, hi })
  }
  return {
    bins,
    durationCount,
    totalCount: checklists.length,
    avgDurationMin: durationCount > 0 ? totalDurationMin / durationCount : null,
  }
}

/** Top locations / counties / states by checklist count and by species count. */
export function computeGeo(checklists: ChecklistEntry[], filteredObs: ObservationEntry[]) {
  const locationMap = new Map<string, { locationId: string; name: string; count: number; species: Set<string>; lat: number | null; lng: number | null }>()
  // Key county aggregation by a raw (state, county) composite — NOT county name
  // alone — so same-named counties in different states ("Washington" in US-CA vs
  // US-UT, the many "Jefferson"s) stay distinct rows. Name-alone keying was a
  // latent collision that merged them into one wrong row; the County Lines &
  // Shading overlay needs the split, and the Statistics county tables are more
  // correct for it. The composite is NUL-joined and lossless — normalization
  // happens only at the join boundary (lib/countyBoundaries.countyKey), never here.
  const countyMap = new Map<string, number>()
  const countyMeta = new Map<string, { name: string; stateProvince: string | null }>()
  const countySpecies = new Map<string, Set<string>>()
  const stateMap = new Map<string, number>()
  const stateSpecies = new Map<string, Set<string>>()

  for (const c of checklists) {
    if (!locationMap.has(c.locationId)) {
      locationMap.set(c.locationId, { locationId: c.locationId, name: c.location, count: 0, species: new Set(), lat: null, lng: null })
    }
    const loc = locationMap.get(c.locationId)!
    loc.count++
    if (loc.lat === null && c.latitude !== null && c.latitude !== undefined) {
      loc.lat = c.latitude
      loc.lng = c.longitude ?? null
    }

    if (c.county) {
      const k = `${c.stateProvince ?? ''} ${c.county}`
      countyMap.set(k, (countyMap.get(k) ?? 0) + 1)
      if (!countyMeta.has(k)) countyMeta.set(k, { name: c.county, stateProvince: c.stateProvince })
      if (!countySpecies.has(k)) countySpecies.set(k, new Set())
    }
    if (c.stateProvince) {
      stateMap.set(c.stateProvince, (stateMap.get(c.stateProvince) ?? 0) + 1)
      if (!stateSpecies.has(c.stateProvince)) stateSpecies.set(c.stateProvince, new Set())
    }
  }

  for (const o of filteredObs) {
    const norm = normalizeSpeciesName(o.commonName)
    locationMap.get(o.locationId)?.species.add(norm)
    if (o.county) countySpecies.get(`${o.stateProvince ?? ''} ${o.county}`)?.add(norm)
    if (o.stateProvince) stateSpecies.get(o.stateProvince)?.add(norm)
  }

  const allLocations = [...locationMap.values()]
    .map(l => ({ locationId: l.locationId, name: l.name, checklists: l.count, species: l.species.size, lat: l.lat, lng: l.lng }))

  const topLocations = [...allLocations].sort((a, b) => b.checklists - a.checklists).slice(0, 10)
  const topLocationsBySpecies = [...allLocations].sort((a, b) => b.species - a.species).slice(0, 10)

  // Output rows keep the same shape — { name, count, stateProvince, species } —
  // but two same-named counties in different states now emit TWO rows instead of
  // one merged row (the correctness fix). `name` is the display county; the
  // internal composite key is dropped here.
  const allCountyData = [...countyMap.entries()].map(([k, count]) => {
    const meta = countyMeta.get(k)!
    return {
      name: meta.name,
      count,
      stateProvince: meta.stateProvince,
      species: countySpecies.get(k)?.size ?? 0,
    }
  })
  const topCounties = [...allCountyData].sort((a, b) => b.count - a.count)
  const topCountiesBySpecies = [...allCountyData].sort((a, b) => b.species - a.species)

  const allStateData = [...stateMap.entries()].map(([name, count]) => ({
    name, count,
    species: stateSpecies.get(name)?.size ?? 0,
  }))
  const topStates = [...allStateData].sort((a, b) => b.count - a.count)
  const topStatesBySpecies = [...allStateData].sort((a, b) => b.species - a.species)

  return { topLocations, topLocationsBySpecies, topCounties, topCountiesBySpecies, topStates, topStatesBySpecies }
}

/** Effort + outings: durations, distances, area, protocols, observers, and record outings. */
export function computeEffort(checklists: ChecklistEntry[]) {
  const protocols = new Map<string, number>()
  const protocolDuration = new Map<string, { total: number; count: number }>()
  const protocolDistance = new Map<string, { total: number; count: number }>()
  let totalDurationMin = 0, durationCount = 0
  let totalDistanceKm = 0, distanceCount = 0
  const observerDist = new Map<number, number>()
  let completeCount = 0, allObsCount = 0
  const protocolComplete = new Map<string, { complete: number; total: number }>()
  let totalSpeciesHours = 0, speciesHourCount = 0
  let totalSpeciesDist = 0, speciesDistCount = 0
  let totalAreaHa = 0, areaCount = 0
  let soloCount = 0, groupCount = 0, observerSum = 0, observerCount = 0
  let largestGroup: { n: number; c: ChecklistEntry } | null = null
  let longest: ChecklistEntry | null = null, longestVal = 0
  let farthest: ChecklistEntry | null = null, farthestVal = 0
  let largestArea: ChecklistEntry | null = null, largestAreaVal = 0
  let biggest: ChecklistEntry | null = null, biggestVal = 0
  let mostIndiv: ChecklistEntry | null = null, mostIndivVal = 0

  for (const c of checklists) {
    const proto = c.protocol ?? ''
    if (proto) protocols.set(proto, (protocols.get(proto) ?? 0) + 1)
    if (c.duration !== null) {
      totalDurationMin += c.duration; durationCount++
      if (proto) {
        const pd = protocolDuration.get(proto) ?? { total: 0, count: 0 }
        pd.total += c.duration; pd.count++
        protocolDuration.set(proto, pd)
      }
      if (c.speciesCount > 0 && c.duration > 0) {
        totalSpeciesHours += c.speciesCount / (c.duration / 60)
        speciesHourCount++
      }
    }
    if (c.distance !== null) {
      totalDistanceKm += c.distance; distanceCount++
      if (proto) {
        const dd = protocolDistance.get(proto) ?? { total: 0, count: 0 }
        dd.total += c.distance; dd.count++
        protocolDistance.set(proto, dd)
      }
      if (c.speciesCount > 0 && c.distance > 0) {
        totalSpeciesDist += c.speciesCount / (c.distance * KM_TO_MI)
        speciesDistCount++
      }
    }
    if (c.area !== null) {
      totalAreaHa += c.area; areaCount++
      if (c.area > largestAreaVal) { largestAreaVal = c.area; largestArea = c }
    }
    if (c.duration !== null && c.duration > longestVal) { longestVal = c.duration; longest = c }
    if (c.distance !== null && c.distance > farthestVal) { farthestVal = c.distance; farthest = c }
    if (c.speciesCount > biggestVal) { biggestVal = c.speciesCount; biggest = c }
    if (c.individualCount > mostIndivVal) { mostIndivVal = c.individualCount; mostIndiv = c }
    if (c.numObservers !== null) {
      // Every distinct observer count gets its own row (no 5+ rollup).
      observerDist.set(c.numObservers, (observerDist.get(c.numObservers) ?? 0) + 1)
      observerSum += c.numObservers; observerCount++
      if (c.numObservers === 1) soloCount++
      else if (c.numObservers > 1) groupCount++
      if (!largestGroup || c.numObservers > largestGroup.n) largestGroup = { n: c.numObservers, c }
    }
    if (c.allObsReported !== null) {
      allObsCount++
      if (c.allObsReported) completeCount++
      if (proto) {
        const pc = protocolComplete.get(proto) ?? { complete: 0, total: 0 }
        pc.total++
        if (c.allObsReported) pc.complete++
        protocolComplete.set(proto, pc)
      }
    }
  }

  const total = checklists.length
  const protocolRows = [...protocols.entries()]
    .sort(([, a], [, b]) => b - a)
    .map(([name, count]) => ({
      name,
      count,
      pct: total > 0 ? Math.round(count / total * 100) : 0,
      avgDurationMin: protocolDuration.has(name)
        ? protocolDuration.get(name)!.total / protocolDuration.get(name)!.count
        : null,
      avgDistanceMi: protocolDistance.has(name)
        ? (protocolDistance.get(name)!.total / protocolDistance.get(name)!.count) * KM_TO_MI
        : null,
    }))

  const observerRows = [...observerDist.entries()]
    .sort(([a], [b]) => a - b)
    .map(([n, count]) => ({ n, count }))

  return {
    protocolRows,
    observerRows,
    totalHours: durationCount > 0 ? totalDurationMin / 60 : null,
    totalMinutes: durationCount > 0 ? totalDurationMin : null,
    avgDurationMin: durationCount > 0 ? totalDurationMin / durationCount : null,
    durationCount,
    totalDistanceMi: distanceCount > 0 ? totalDistanceKm * KM_TO_MI : null,
    avgDistanceMi: distanceCount > 0 ? (totalDistanceKm / distanceCount) * KM_TO_MI : null,
    distanceCount,
    totalAreaAcres: areaCount > 0 ? totalAreaHa * HA_TO_ACRE : null,
    avgAreaAcres: areaCount > 0 ? (totalAreaHa / areaCount) * HA_TO_ACRE : null,
    areaCount,
    sppPerHour: speciesHourCount > 0 ? totalSpeciesHours / speciesHourCount : null,
    sppPerMi: speciesDistCount > 0 ? totalSpeciesDist / speciesDistCount : null,
    completeRatio: allObsCount > 0 ? completeCount / allObsCount : null,
    completeCount,
    allObsCount,
    protocolComplete,
    soloCount,
    groupCount,
    avgObservers: observerCount > 0 ? observerSum / observerCount : null,
    largestGroup,
    longest,
    farthest,
    largestArea,
    biggest,
    mostIndividuals: mostIndiv,
  }
}

/** Count-method ratio, biggest single counts, and comment coverage. */
export function computeQuality(filteredObs: ObservationEntry[], checklists: ChecklistEntry[]) {
  let numericCount = 0, xCount = 0
  const speciesMaxCounts = new Map<string, { count: number; submissionId: string }>()
  const checklistBySubId = new Map(checklists.map(c => [c.submissionId, c]))

  for (const o of filteredObs) {
    if (o.count !== null) {
      numericCount++
      const norm = normalizeSpeciesName(o.commonName)
      const existing = speciesMaxCounts.get(norm)
      if (!existing || o.count > existing.count) {
        speciesMaxCounts.set(norm, { count: o.count, submissionId: o.submissionId })
      }
    } else {
      xCount++
    }
  }

  const total = numericCount + xCount
  const biggestCounts = [...speciesMaxCounts.entries()]
    .sort(([, a], [, b]) => b.count - a.count)
    .slice(0, 10)
    .map(([name, { count, submissionId }]) => {
      const cl = checklistBySubId.get(submissionId)
      return { name, count, submissionId, date: cl?.date ?? '', location: cl?.location ?? '', locationId: cl?.locationId ?? '' }
    })

  const checksWithComments = checklists.filter(c => c.checklistComments.trim().length > 0).length
  const obsWithSpeciesComments = filteredObs.filter(o => o.speciesComments.trim().length > 0).length

  // Weather/tide blocks pasted into the checklist comment. SnowRaven blocks are
  // identified by their SnowRaven credit and Raincrow blocks by their raincrow.app
  // credit; "any weather" is a block from either app (the user's definition), so
  // ordinary hand-written "Label: value" prose with no app credit is not counted.
  // Tide blocks are SnowRaven-only. "weather + tide" = a SnowRaven weather block
  // AND a tide block on the same checklist (the combined block, or both pasted).
  let raincrowWeatherCount = 0, snowravenWeatherCount = 0, anyWeatherCount = 0
  let snowravenTideCount = 0, snowravenWeatherAndTideCount = 0
  for (const c of checklists) {
    const comment = c.checklistComments
    if (!comment || !comment.trim()) continue
    const snowravenWeather = hasSnowravenWeatherBlock(comment)
    const raincrowWeather = hasRaincrowWeatherBlock(comment)
    const tide = hasTideBlock(comment)
    if (snowravenWeather || raincrowWeather) anyWeatherCount++
    if (snowravenWeather) snowravenWeatherCount++
    if (raincrowWeather) raincrowWeatherCount++
    if (tide) snowravenTideCount++
    if (snowravenWeather && tide) snowravenWeatherAndTideCount++
  }
  const nChecklists = checklists.length

  return {
    numericCount,
    xCount,
    numericRatio: total > 0 ? numericCount / total : null,
    xRatio: total > 0 ? xCount / total : null,
    biggestCounts,
    checksWithComments,
    commentRatio: checklists.length > 0 ? checksWithComments / checklists.length : null,
    obsWithSpeciesComments,
    speciesCommentRatio: filteredObs.length > 0 ? obsWithSpeciesComments / filteredObs.length : null,
    weatherTideTotal: nChecklists,
    raincrowWeatherCount,
    snowravenWeatherCount,
    anyWeatherCount,
    snowravenTideCount,
    snowravenWeatherAndTideCount,
    raincrowWeatherRatio: nChecklists > 0 ? raincrowWeatherCount / nChecklists : null,
    snowravenWeatherRatio: nChecklists > 0 ? snowravenWeatherCount / nChecklists : null,
    anyWeatherRatio: nChecklists > 0 ? anyWeatherCount / nChecklists : null,
    snowravenTideRatio: nChecklists > 0 ? snowravenTideCount / nChecklists : null,
    snowravenWeatherAndTideRatio: nChecklists > 0 ? snowravenWeatherAndTideCount / nChecklists : null,
  }
}

/** Confirmed / Probable / Possible breeding totals + by-month breakdown (highest tier per species). */
export function computeBreedingStats(filteredObs: ObservationEntry[]) {
  const codesBySp = new Map<string, number>() // sp → highest tier overall
  const byMonth = new Map<number, Map<string, number>>() // month → sp → highest tier that month

  for (const o of filteredObs) {
    if (!o.breedingCode) continue
    const norm = normalizeSpeciesName(o.commonName)
    const def = BREEDING_CODE_MAP.get(o.breedingCode)
    const tier = def?.tier ?? 0
    if (tier === 0) continue
    codesBySp.set(norm, Math.max(codesBySp.get(norm) ?? 0, tier))

    const month = parseInt(o.date.substring(5, 7), 10) - 1
    if (!byMonth.has(month)) byMonth.set(month, new Map())
    const mm = byMonth.get(month)!
    mm.set(norm, Math.max(mm.get(norm) ?? 0, tier))
  }

  let confirmed = 0, probable = 0, possible = 0
  for (const tier of codesBySp.values()) {
    if (tier >= 4) confirmed++
    else if (tier >= 2) probable++
    else if (tier >= 1) possible++
  }

  const byMonthRows = Array.from({ length: 12 }, (_, i) => {
    const mm = byMonth.get(i)
    let c = 0, p = 0, s = 0
    if (mm) {
      for (const tier of mm.values()) {
        if (tier >= 4) c++
        else if (tier >= 2) p++
        else if (tier >= 1) s++
      }
    }
    return { label: MONTH_LABELS[i], confirmed: c, probable: p, possible: s, total: c + p + s }
  })

  return { confirmed, probable, possible, total: confirmed + probable + possible, byMonthRows }
}

/** Most photographed / audio / video species from the Macaulay Library export. */
export function computeMlStats(rawMlRows: MLExportRow[]) {
  const photoCounts = new Map<string, number>()
  const audioCounts = new Map<string, number>()
  const videoCounts = new Map<string, number>()
  const firstCatalog = new Map<string, string>() // name+format → first catalogId
  for (const row of rawMlRows) {
    const key = `${row.commonName}::${row.format}`
    if (!firstCatalog.has(key)) firstCatalog.set(key, row.catalogId)
    if (row.format === 'Photo') photoCounts.set(row.commonName, (photoCounts.get(row.commonName) ?? 0) + 1)
    else if (row.format === 'Audio') audioCounts.set(row.commonName, (audioCounts.get(row.commonName) ?? 0) + 1)
    else if (row.format === 'Video') videoCounts.set(row.commonName, (videoCounts.get(row.commonName) ?? 0) + 1)
  }
  const topN = (m: Map<string, number>, fmt: 'Photo' | 'Audio' | 'Video') => [...m.entries()]
    .sort(([, a], [, b]) => b - a).slice(0, 10)
    .map(([name, count]) => ({ name, count, catalogId: firstCatalog.get(`${name}::${fmt}`) ?? null }))
  return {
    mostPhotographed: topN(photoCounts, 'Photo'),
    mostAudio: topN(audioCounts, 'Audio'),
    mostVideo: topN(videoCounts, 'Video'),
    totalPhotos: [...photoCounts.values()].reduce((a, b) => a + b, 0),
  }
}

/** Highlights & records: single-checklist / one-and-done birds, streak, dry spell, busiest day, diversity. */
export function computeFunStats(filteredObs: ObservationEntry[], checklists: ChecklistEntry[], rawObs: ObservationEntry[]) {
  // Per-species: distinct checklists + total individuals counted (one pass).
  const checklistsBySp = new Map<string, Set<string>>()
  const countBySp = new Map<string, { total: number; submissionId: string }>()
  for (const o of filteredObs) {
    const norm = normalizeSpeciesName(o.commonName)
    if (!checklistsBySp.has(norm)) checklistsBySp.set(norm, new Set())
    checklistsBySp.get(norm)!.add(o.submissionId)
    if (o.count !== null) {
      const existing = countBySp.get(norm)
      if (!existing) countBySp.set(norm, { total: o.count, submissionId: o.submissionId })
      else existing.total += o.count
    }
  }

  // One-and-done: total individual count of exactly 1 (necessarily on a single
  // checklist too, so we exclude these from singleChecklistBirds below).
  const oneDoneBirds = [...countBySp.entries()]
    .filter(([, { total }]) => total === 1)
    .map(([name, { submissionId }]) => ({ name, submissionId }))
    .sort((a, b) => a.name.localeCompare(b.name))
  const oneDoneSet = new Set(oneDoneBirds.map(b => b.name))

  // Single-checklist: seen on exactly one checklist, EXCLUDING the one-and-done
  // birds (a strict subset, shown separately).
  const singleChecklistBirds = [...checklistsBySp.entries()]
    .filter(([name, subs]) => subs.size === 1 && !oneDoneSet.has(name))
    .map(([name, subs]) => ({ name, submissionId: [...subs][0] }))
    .sort((a, b) => a.name.localeCompare(b.name))

  // Consecutive-day streak + longest dry spell — a date counts if ANY report of
  // any kind was made that day (all observations, unfiltered).
  const dates = [...new Set(rawObs.map(o => o.date))].sort()
  let maxStreak = 0, drySpell = 0
  let streakStart = '', streakEnd = '', dryStart = '', dryEnd = ''

  if (dates.length > 0) {
    let streak = 1
    let currentStreakStart = dates[0]
    maxStreak = 1
    streakStart = dates[0]
    streakEnd = dates[0]

    for (let i = 1; i < dates.length; i++) {
      const diffDays = Math.round(
        (new Date(dates[i] + 'T12:00:00').getTime() - new Date(dates[i - 1] + 'T12:00:00').getTime()) / 86400000
      )
      if (diffDays === 1) {
        streak++
        if (streak > maxStreak) {
          maxStreak = streak
          streakStart = currentStreakStart
          streakEnd = dates[i]
        }
      } else {
        const gap = diffDays - 1
        if (gap > drySpell) {
          drySpell = gap
          dryStart = dates[i - 1]
          dryEnd = dates[i]
        }
        streak = 1
        currentStreakStart = dates[i]
      }
    }
  }

  // Busiest day by species
  const spByDate = new Map<string, Set<string>>()
  for (const o of filteredObs) {
    if (!spByDate.has(o.date)) spByDate.set(o.date, new Set())
    spByDate.get(o.date)!.add(normalizeSpeciesName(o.commonName))
  }
  const busiestDayEntry = [...spByDate.entries()].sort(([, a], [, b]) => b.size - a.size)[0]
  const busiestDaySubId = busiestDayEntry
    ? checklists
        .filter(c => c.date === busiestDayEntry[0])
        .sort((a, b) => b.speciesCount - a.speciesCount)[0]?.submissionId ?? ''
    : ''

  // Shannon diversity (numeric obs only)
  const spCounts = new Map<string, number>()
  for (const o of filteredObs) {
    if (o.count === null) continue
    const norm = normalizeSpeciesName(o.commonName)
    spCounts.set(norm, (spCounts.get(norm) ?? 0) + o.count)
  }
  const totalCount = [...spCounts.values()].reduce((a, b) => a + b, 0)
  let shannon = 0
  if (totalCount > 0) {
    for (const count of spCounts.values()) {
      const p = count / totalCount
      if (p > 0) shannon -= p * Math.log(p)
    }
  }

  return {
    singleChecklistBirds,
    oneDoneBirds,
    maxStreak,
    streakStart,
    streakEnd,
    drySpell,
    dryStart,
    dryEnd,
    busiestDay: busiestDayEntry
      ? { date: busiestDayEntry[0], species: busiestDayEntry[1].size, submissionId: busiestDaySubId }
      : null,
    shannon: shannon > 0 ? shannon : null,
  }
}
