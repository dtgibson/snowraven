// Aggregations for the Statistics → Media card, computed client-side from the
// Macaulay Library "My Media" export rows (MLExportRow). Pure (no React, no I/O)
// and split out from birdingStats.ts so the parsing rules (Age/Sex, Behaviors,
// Time) and the aggregator are unit-testable in isolation.
//
// Field formats are the ones verified against a real export (see
// pipeline/media-statistics-expansion/ml-format-findings.md):
//  - Age/Sex:  "<class> – <count>" groups joined by "; "  (en-dash + individual count)
//  - Behaviors: controlled-vocab labels joined by "; "    (labels may contain commas)
//  - Time:      "HMM"/"HHMM" 24h clock                     (e.g. "643" = 06:43)

import type { MLExportRow } from './parseMLExport'
import { normalizeSpeciesName } from './speciesUtils'

// ── Age/Sex ──────────────────────────────────────────────────────────────────

export type AgeClass = 'Adult' | 'Immature' | 'Juvenile' | 'Unknown'
export type Sex = 'Male' | 'Female' | 'Unknown'
export interface AgeSexGroup { age: AgeClass; sex: Sex; count: number }

export const AGE_CLASSES: AgeClass[] = ['Adult', 'Immature', 'Juvenile', 'Unknown']
export const SEXES: Sex[] = ['Male', 'Female', 'Unknown']

/**
 * Parse the ML "Age/Sex" string into per-individual groups. Groups are split on
 * "; "; each group is "<class> – <count>" where the separator is a spaced en-dash
 * (a plain hyphen is tolerated) and count defaults to 1 when absent. The class is
 * a space-joined set of age and/or sex words. Token equality is used (not
 * substring) so "Female" is never misread as "male". '' → [].
 */
export function parseAgeSex(raw: string): AgeSexGroup[] {
  const s = (raw ?? '').trim()
  if (!s) return []
  const out: AgeSexGroup[] = []
  for (const part of s.split(/;\s*/)) {
    const g = part.trim()
    if (!g) continue
    // Split off a trailing "– N" / "- N" count; keep the class on the left.
    const m = g.match(/^(.*?)\s*[–—-]\s*(\d+)\s*$/)
    const classStr = (m ? m[1] : g).trim()
    const count = m ? parseInt(m[2], 10) : 1
    if (!classStr) continue
    const words = classStr.toLowerCase().split(/\s+/)
    const age: AgeClass = words.includes('juvenile')
      ? 'Juvenile'
      : words.includes('immature') || words.includes('subadult')
        ? 'Immature'
        : words.includes('adult')
          ? 'Adult'
          : 'Unknown'
    const sex: Sex = words.includes('female') ? 'Female' : words.includes('male') ? 'Male' : 'Unknown'
    out.push({ age, sex, count: Number.isFinite(count) && count > 0 ? count : 1 })
  }
  return out
}

/**
 * Exact-combo facet match for the Multimedia sex/age filters (FR-05). A `null`
 * facet means "any":
 *  - sex only  → an asset depicting that sex (any age)
 *  - age only  → an asset depicting that age (any sex)
 *  - both set  → a SINGLE group that is that age AND that sex (e.g. a juvenile female)
 * The dropdowns only ever pass Male/Female and Juvenile/Immature/Adult (never
 * Unknown), so an untagged/Unknown group never satisfies an active facet.
 */
export function assetMatchesFacet(groups: AgeSexGroup[], sex: Sex | null, age: AgeClass | null): boolean {
  if (!sex && !age) return true
  return groups.some(g => (!sex || g.sex === sex) && (!age || g.age === age))
}

/** Map each ML asset (by catalog id) to its parsed Age/Sex groups — build once, reuse. */
export function buildCatalogAgeSex(rows: MLExportRow[]): Map<string, AgeSexGroup[]> {
  const m = new Map<string, AgeSexGroup[]>()
  for (const r of rows) m.set(r.catalogId, parseAgeSex(r.ageSex))
  return m
}

// ── Behaviors ────────────────────────────────────────────────────────────────

/** Split the ML "Behaviors" field on "; " (NOT comma — labels contain commas). */
export function parseBehaviors(raw: string): string[] {
  const s = (raw ?? '').trim()
  if (!s) return []
  return s.split(/;\s*/).map(b => b.trim()).filter(Boolean)
}

// Media-backed breeding tiers, classified from the ML Behaviors vocabulary (this
// is NOT eBird's breeding-code set — it's a separate keyword map). Mirrors the
// Breeding card's tiering for visual consistency only.
export type BreedingTier = 'confirmed' | 'probable' | 'possible'
const BREEDING_BEHAVIOR_TIER: Record<string, BreedingTier> = {
  'Feeding Young': 'confirmed',
  'Carrying Food': 'confirmed',
  'Nest Building': 'confirmed',
  'Courtship, Display, or Copulation': 'probable',
  'Song': 'possible',
}

// ── Time ─────────────────────────────────────────────────────────────────────

/** Parse the ML "Time" clock ("HMM"/"HHMM") into an hour 0–23, or null. */
export function parseMlHour(time: string): number | null {
  const t = (time ?? '').trim()
  if (!/^\d{1,4}$/.test(t)) return null
  const n = parseInt(t, 10)
  const hour = Math.floor(n / 100)
  const min = n % 100
  if (hour > 23 || min > 59) return null
  return hour
}

// ── helpers ──────────────────────────────────────────────────────────────────

function dayNumber(date: string): number | null {
  // Range-check month/day (matching formatDate's parseParts) so out-of-range
  // dates like "2024-13-05" or "2024-02-00" are treated as undated rather than
  // silently rolled over by Date.UTC onto a neighboring day — a rolled-over key
  // can become busiestDay/streak/span dates that formatDate refuses to render.
  const m = (date ?? '').match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!m) return null
  const mo = +m[2], d = +m[3]
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null
  return Math.floor(Date.UTC(+m[1], mo - 1, d) / 86_400_000)
}

// Same shape check the other ebird.org/checklist link sites apply
// (BirdingStats SUBMISSION_ID_RE, speciesStats) — junk in the export's
// "eBird Checklist ID" column must degrade to plain text, not a 404 link.
const SUBMISSION_ID_RE = /^S\d+$/

// ── aggregate ────────────────────────────────────────────────────────────────

export interface SpeciesAgeCoverage {
  name: string
  adult: boolean
  immature: boolean
  juvenile: boolean
  classesCaptured: number
  assets: number
}

/** Sort modes for the age-coverage-by-species list. */
export type AgeSort = 'name' | 'taxonomic'

export interface MediaStats {
  total: number
  photo: number
  audio: number
  video: number
  distinctSpecies: number
  firstDate: string | null
  lastDate: string | null
  /**
   * The day with the most media. `checklistId` is the eBird checklist holding
   * the most of that day's assets (null when the export carries no checklist
   * ids); `checklistCount` is how many distinct checklists the day spans.
   */
  busiestDay: { date: string; count: number; checklistId: string | null; checklistCount: number } | null
  /** Longest run of consecutive days with any media; null when nothing is dated. */
  longestStreak: { days: number; start: string; end: string } | null
  /** Whole-day length of the archive span, first to last media date inclusive; 0 when undated. */
  spanDays: number

  coverage: {
    lifeListTotal: number
    documented: number
    withPhoto: number
    withAudio: number
    withVideo: number
  } | null
  completenessMix: { label: string; value: number }[]

  ageMix: { label: AgeClass; value: number }[]
  sexMix: { label: Sex; value: number }[]
  agedAssets: number
  sexedAssets: number

  speciesDemographics: SpeciesAgeCoverage[]
  onlyAdults: { name: string; assets: number }[]

  behaviorCounts: { label: string; value: number }[]
  distinctBehaviors: number
  breeding: { confirmed: string[]; probable: string[]; possible: string[] }

  ratings: {
    rated: number
    mean: number
    histogram: { label: string; value: number }[]
    top: { name: string; catalogId: string; rating: number; n: number }[]
  } | null

  timeOfDay: { hour: number; photo: number; audio: number; video: number }[]
  withTime: number
}

// Below this many community-rated assets, the ratings section is hidden (the
// histogram/leaderboard read as noise on a near-unrated library).
export const RATINGS_MIN_TO_SHOW = 8
// Species need at least this many age-annotated assets before "only adults so far"
// is meaningful (a lone adult shot shouldn't flag a gap).
export const ONLY_ADULTS_MIN_ASSETS = 3

interface SpeciesAgg {
  display: string
  formats: Set<string>
  ages: Set<AgeClass>
  assets: number
  agedAssets: number
}

export function computeMediaStats(rows: MLExportRow[], lifeListNames?: Set<string>): MediaStats {
  let photo = 0, audio = 0, video = 0
  const bySpecies = new Map<string, SpeciesAgg>()
  const ageMix: Record<AgeClass, number> = { Adult: 0, Immature: 0, Juvenile: 0, Unknown: 0 }
  const sexMix: Record<Sex, number> = { Male: 0, Female: 0, Unknown: 0 }
  let agedAssets = 0, sexedAssets = 0
  const behaviorCounts = new Map<string, number>()
  const breeding: Record<BreedingTier, Set<string>> = { confirmed: new Set(), probable: new Set(), possible: new Set() }
  const perDayCount = new Map<string, number>()
  const ratedRows: { name: string; catalogId: string; rating: number; n: number }[] = []
  let ratingSum = 0
  const hourBuckets = Array.from({ length: 24 }, (_, hour) => ({ hour, photo: 0, audio: 0, video: 0 }))
  let withTime = 0
  let firstDay = Infinity, lastDay = -Infinity
  let firstDate: string | null = null, lastDate: string | null = null

  for (const row of rows) {
    if (row.format === 'Photo') photo++
    else if (row.format === 'Audio') audio++
    else if (row.format === 'Video') video++

    const key = normalizeSpeciesName(row.commonName)
    let sp = bySpecies.get(key)
    if (!sp) {
      sp = { display: row.commonName, formats: new Set(), ages: new Set(), assets: 0, agedAssets: 0 }
      bySpecies.set(key, sp)
    }
    sp.formats.add(row.format)
    sp.assets++

    // Age/Sex (per individual for the mix; per asset for annotation rate)
    const groups = parseAgeSex(row.ageSex)
    let rowAged = false, rowSexed = false
    for (const g of groups) {
      ageMix[g.age] += g.count
      sexMix[g.sex] += g.count
      if (g.age !== 'Unknown') { rowAged = true; sp.ages.add(g.age) }
      if (g.sex !== 'Unknown') rowSexed = true
    }
    if (rowAged) { agedAssets++; sp.agedAssets++ }
    if (rowSexed) sexedAssets++

    // Behaviors (multi-valued; an asset counts toward each of its behaviors)
    for (const b of parseBehaviors(row.behaviors)) {
      behaviorCounts.set(b, (behaviorCounts.get(b) ?? 0) + 1)
      const tier = BREEDING_BEHAVIOR_TIER[b]
      if (tier) breeding[tier].add(sp.display)
    }

    // Dates: busiest day, streak, span
    const dn = dayNumber(row.date)
    if (dn !== null) {
      const d10 = row.date.slice(0, 10)
      perDayCount.set(d10, (perDayCount.get(d10) ?? 0) + 1)
      if (dn < firstDay) { firstDay = dn; firstDate = d10 }
      if (dn > lastDay) { lastDay = dn; lastDate = d10 }
    }

    // Ratings (only community-rated assets count)
    if (row.numRatings > 0 && row.avgRating !== null) {
      ratingSum += row.avgRating
      ratedRows.push({ name: row.commonName, catalogId: row.catalogId, rating: row.avgRating, n: row.numRatings })
    }

    // Time of day
    const hr = parseMlHour(row.time)
    if (hr !== null) {
      withTime++
      const b = hourBuckets[hr]
      if (row.format === 'Photo') b.photo++
      else if (row.format === 'Audio') b.audio++
      else if (row.format === 'Video') b.video++
    }
  }

  // Coverage vs. the life list (normalized common names)
  let coverage: MediaStats['coverage'] = null
  if (lifeListNames && lifeListNames.size > 0) {
    // Case-insensitive match: both sides are normalized eBird names, but guard
    // against any casing drift between the eBird and ML name sources.
    const lifeLower = new Set([...lifeListNames].map(n => n.toLowerCase()))
    let documented = 0, withPhoto = 0, withAudio = 0, withVideo = 0
    for (const [key, sp] of bySpecies) {
      if (!lifeLower.has(key.toLowerCase())) continue
      documented++
      if (sp.formats.has('Photo')) withPhoto++
      if (sp.formats.has('Audio')) withAudio++
      if (sp.formats.has('Video')) withVideo++
    }
    coverage = { lifeListTotal: lifeListNames.size, documented, withPhoto, withAudio, withVideo }
  }

  // Completeness mix: how with-media species split across format combinations
  const mixCounts = new Map<string, number>()
  for (const sp of bySpecies.values()) {
    const has = (f: string) => sp.formats.has(f)
    let label: string
    if (has('Photo') && has('Audio') && has('Video')) label = 'Photo + audio + video'
    else if (has('Photo') && has('Audio')) label = 'Photo + audio'
    else if (has('Photo') && has('Video')) label = 'Photo + video'
    else if (has('Audio') && has('Video')) label = 'Audio + video'
    else if (has('Photo')) label = 'Photo only'
    else if (has('Audio')) label = 'Audio only'
    else label = 'Video only'
    mixCounts.set(label, (mixCounts.get(label) ?? 0) + 1)
  }
  const MIX_ORDER = ['Photo + audio + video', 'Photo + audio', 'Photo + video', 'Audio + video', 'Photo only', 'Audio only', 'Video only']
  const completenessMix = MIX_ORDER
    .map(label => ({ label, value: mixCounts.get(label) ?? 0 }))
    .filter(b => b.value > 0)

  // Per-species demographic coverage + "only adults so far"
  const speciesDemographics = [...bySpecies.values()]
    .filter(sp => sp.ages.size > 0)
    .map(sp => {
      const adult = sp.ages.has('Adult')
      const immature = sp.ages.has('Immature')
      const juvenile = sp.ages.has('Juvenile')
      return { name: sp.display, adult, immature, juvenile, classesCaptured: (adult ? 1 : 0) + (immature ? 1 : 0) + (juvenile ? 1 : 0), assets: sp.assets }
    })
    .sort((a, b) => b.assets - a.assets)
  const onlyAdults = speciesDemographics
    .filter(s => s.adult && !s.immature && !s.juvenile && bySpecies.get(normalizeSpeciesName(s.name))!.agedAssets >= ONLY_ADULTS_MIN_ASSETS)
    .map(s => ({ name: s.name, assets: s.assets }))

  // Behaviors
  const behaviorList = [...behaviorCounts.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value)

  // Ratings (hidden when too few rated assets)
  let ratings: MediaStats['ratings'] = null
  if (ratedRows.length >= RATINGS_MIN_TO_SHOW) {
    const bins = [0, 0, 0, 0, 0] // 1★..5★ by rounded rating
    for (const r of ratedRows) {
      const star = Math.min(5, Math.max(1, Math.round(r.rating)))
      bins[star - 1]++
    }
    ratings = {
      rated: ratedRows.length,
      mean: ratingSum / ratedRows.length,
      histogram: bins.map((value, i) => ({ label: `${i + 1}★`, value })),
      top: [...ratedRows].sort((a, b) => b.rating - a.rating || b.n - a.n).slice(0, 10),
    }
  }

  // Longest streak of consecutive days with any media (with the dates it ran).
  // Dedupe by day NUMBER, not raw key, as the pre-0.5.25 code did: near-miss
  // dates ("2024-02-30") roll over onto a neighboring day, and two keys landing
  // on one day must not reset the run. The representative date for a day is its
  // first key in lexicographic order; the walk itself orders by day number.
  const dayToDate = new Map<number, string>()
  for (const date of [...perDayCount.keys()].sort()) {
    const d = dayNumber(date)
    if (d !== null && !dayToDate.has(d)) dayToDate.set(d, date)
  }
  let longestStreak: MediaStats['longestStreak'] = null
  let run = 0, prev = NaN, runStart = ''
  for (const [d, date] of [...dayToDate.entries()].sort((a, b) => a[0] - b[0])) {
    if (d === prev + 1) run++
    else { run = 1; runStart = date }
    if (!longestStreak || run > longestStreak.days) longestStreak = { days: run, start: runStart, end: date }
    prev = d
  }

  let busiestDay: MediaStats['busiestDay'] = null
  for (const [date, count] of perDayCount) {
    if (!busiestDay || count > busiestDay.count) busiestDay = { date, count, checklistId: null, checklistCount: 0 }
  }
  if (busiestDay) {
    // Resolve the day's dominant checklist (most assets; ties break on id so
    // the result is deterministic). Second pass over rows, but only once and
    // only for the one winning day.
    const tally = new Map<string, number>()
    for (const r of rows) {
      if (SUBMISSION_ID_RE.test(r.checklistId) && r.date.slice(0, 10) === busiestDay.date) {
        tally.set(r.checklistId, (tally.get(r.checklistId) ?? 0) + 1)
      }
    }
    const top = [...tally.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))[0]
    busiestDay.checklistId = top ? top[0] : null
    busiestDay.checklistCount = tally.size
  }

  return {
    total: rows.length,
    photo, audio, video,
    distinctSpecies: bySpecies.size,
    firstDate, lastDate, busiestDay, longestStreak,
    spanDays: firstDate && lastDate ? lastDay - firstDay + 1 : 0,
    coverage,
    completenessMix,
    ageMix: AGE_CLASSES.map(label => ({ label, value: ageMix[label] })),
    sexMix: SEXES.map(label => ({ label, value: sexMix[label] })),
    agedAssets, sexedAssets,
    speciesDemographics, onlyAdults,
    behaviorCounts: behaviorList,
    distinctBehaviors: behaviorCounts.size,
    breeding: {
      confirmed: [...breeding.confirmed].sort(),
      probable: [...breeding.probable].sort(),
      possible: [...breeding.possible].sort(),
    },
    ratings,
    timeOfDay: hourBuckets,
    withTime,
  }
}

/** Species with at least one immature or juvenile asset documented (i.e. a young
 *  bird captured, not just adults). */
export function speciesWithYoung(rows: SpeciesAgeCoverage[]): SpeciesAgeCoverage[] {
  return rows.filter(s => s.immature || s.juvenile)
}

/**
 * Sort age-coverage rows by name (A–Z, case-insensitive) or taxonomic order.
 * `orderOf` maps a species name to its eBird taxonomic order (Infinity when
 * unknown, so unresolved species sort last); ties break by name.
 */
export function sortSpeciesAgeCoverage(
  rows: SpeciesAgeCoverage[],
  mode: AgeSort,
  orderOf: (name: string) => number,
): SpeciesAgeCoverage[] {
  const byName = (a: SpeciesAgeCoverage, b: SpeciesAgeCoverage) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
  const copy = [...rows]
  if (mode === 'taxonomic') {
    copy.sort((a, b) => {
      const oa = orderOf(a.name), ob = orderOf(b.name)
      return oa !== ob ? oa - ob : byName(a, b)
    })
  } else {
    copy.sort(byName)
  }
  return copy
}
