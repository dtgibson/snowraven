// The Weather section's policy and aggregation: banding, the two thresholds,
// and the one derivation the Statistics tab paints from.
//
// Split from `lib/weatherBlockParse.ts` on purpose. That module is a GRAMMAR
// over what the formatters emit, verified against real export shapes; this one
// is JUDGEMENT -- where a temperature band begins, how few checklists is too few
// to average. Splitting them means a band boundary can move without touching a
// single parse test, and a formatter drift breaks parse tests without touching
// banding.
//
// NOTHING HERE IS PERSISTED, and that is a decision rather than an omission. No
// file, no setting, no durable cache, no `replay.json` entry, no
// `CACHED_GET_PATHS` addition, no `storage` call of any kind -- this module
// imports neither `lib/storage.ts` nor `lib/transport.ts`. It therefore gets NO
// `lib/clearDerived.ts` row: every row in that registry is a durable document on
// disk whose purge ends in a `storage.deleteSetting`, and `cacheInventory.test.ts`
// pairs each row to an exported production purge, so a row for a value with no
// document would fail there immediately.
//
// AND THERE IS NO MODULE-SCOPED CACHE OF PARSED RECORDS. A
// `Map<submissionId, WeatherRecord>` up here would be a new in-memory holder
// keyed on the user's data file with no teardown, which turns "no rule applies"
// into "three CLAUDE.md rules apply and none is wired". Everything below lives
// in `computeWeatherStats`'s call frame and dies with it. If a memo ever becomes
// necessary, it lives there too.
//
// CLONE SAFETY IS A REQUIREMENT, NOT A PROPERTY. This runs inside
// `computeStatsBundle`, which crosses the worker boundary, so the payload is
// plain arrays, numbers, strings and one nested object: no Map, no Set, no
// function, no class instance, no DOM value. Dense small-integer arrays clone
// faster than maps and index-address directly, which is what the index-keyed
// DOM-identifier rule wants anyway.

import type { ChecklistEntry, ObservationEntry } from '../types'
import { hasRaincrowWeatherBlock, hasSnowravenWeatherBlock } from './commentBlocks'
import { normalizeSpeciesName } from './speciesUtils'
import { bankersRound, CONDITION_EMOJI } from './weatherFormatter'
import { hasAnyWeatherField, parseWeatherBlock } from './weatherBlockParse'
import type { WeatherRange, WeatherRecord, WeatherWind } from './weatherBlockParse'

// ── Thresholds (FR-18) ──────────────────────────────────────────────────────

/** Below this the section declines to chart at all: a distribution across
 *  eleven conditions built on four checklists is four checklists wearing a
 *  chart. */
export const WEATHER_SECTION_MIN_READABLE = 5

/**
 * Below this a band shows its count and no derived average, because an average
 * of seven outings reads as a finding and is noise.
 *
 * DELIBERATELY the same value as `RATINGS_MIN_TO_SHOW` in `lib/mediaStats.ts`,
 * and deliberately NOT an import of it: two independent judgements that happen
 * to agree today, and coupling them would make a future change to one silently
 * move the other.
 */
export const WEATHER_BAND_MIN_TO_SHOW = 8

// ── Banding (FR-19, FR-20) ──────────────────────────────────────────────────

/** The seven temperature bands, in ascending order. Band 1 is thirteen degrees
 *  wide and the rest are ten; that is the approved table and it is kept
 *  verbatim, because a band table that looks tidier is a different feature. */
export const TEMP_BANDS = [
  'Below 32°F', '32 to 44°F', '45 to 54°F', '55 to 64°F',
  '65 to 74°F', '75 to 84°F', '85°F and up',
] as const

/**
 * Exactly ONE band per checklist, by the range's MIDPOINT.
 *
 * Rounded with the repo's own `bankersRound`, so the half-degree tie rule is
 * INHERITED from the formatter that wrote the block rather than invented here.
 *
 * The alternative -- counting a checklist in every band its range overlaps --
 * inflates every total and stops the distribution summing to the number of
 * checklists, which is the single easiest way for this section to mislead. A
 * long checklist spanning many bands is the honest cost of that choice, and
 * `medianTempSpanF` is what discloses it.
 */
export function tempBandIndex(r: WeatherRange): number {
  const m = bankersRound((r.low + r.high) / 2)
  if (m < 32) return 0
  if (m <= 44) return 1
  if (m <= 54) return 2
  if (m <= 64) return 3
  if (m <= 74) return 4
  if (m <= 84) return 5
  return 6
}

/**
 * Exactly ONE band per checklist, by the ORDINAL midpoint of its Beaufort
 * indices, with a tie resolving DOWNWARD toward the calmer band.
 *
 * Downward because the formatter emits a de-duplicated set: one gusty hour
 * contributes a whole extra label carrying the same weight as an hour that
 * lasted the outing, which makes the high end of a run the least representative
 * end.
 */
export function windBandIndex(w: WeatherWind): number {
  return Math.floor((w.minIndex + w.maxIndex) / 2)
}

/**
 * Cloud cover, banded. SHIPPED AND TESTED, NOT CHARTED, and not in the payload
 * either.
 *
 * Five bands mirroring OpenWeather's own 800-804 tiers, midpoint-assigned like
 * temperature. It is not charted because four of the eleven condition glyphs
 * ARE cloud tiers, so a cloud-cover chart beside the condition chart would be
 * two views of one axis. It ships anyway so that charting it later is a
 * component change plus one aggregation line, with no parser change and no
 * banding decision to re-make.
 */
export const CLOUD_BANDS = [
  '0 to 10%', '11 to 25%', '26 to 50%', '51 to 84%', '85 to 100%',
] as const

export function cloudBandIndex(r: WeatherRange): number {
  const m = bankersRound((r.low + r.high) / 2)
  if (m <= 10) return 0
  if (m <= 25) return 1
  if (m <= 50) return 2
  if (m <= 84) return 3
  return 4
}

// ── The payload (FR-21 … FR-28, NFR-02) ─────────────────────────────────────

/**
 * A distribution row.
 *
 * `index` is the row's position in its canonical band array and is the ONLY
 * identifier a DOM id may be built from: a condition emoji or a band label in an
 * id can carry characters that cannot resolve as an IDREF, which silently
 * switches off the announcement the id exists for. It is carried EXPLICITLY
 * rather than read off array position, so the component can reorder rows for
 * display (it does -- by sky clarity) without breaking the species alignment
 * below.
 */
export interface WeatherDistRow {
  index: number
  /** The canonical key: a ConditionEmoji, a TEMP_BANDS entry, a Beaufort word.
   *  Display copy is the component's; this is the data value. */
  key: string
  /** Present even at zero. Dropping a band makes the distribution itself lie. */
  checklists: number
}

/** An axis that also carries the species-and-duration pair. */
export interface WeatherBandRow extends WeatherDistRow {
  /** Mean `ChecklistEntry.speciesCount`, so it follows the same "Count spuh and
   *  slash" rule as the rest of the tab. Null below the floor. */
  avgSpecies: number | null
  /**
   * Mean duration in minutes over the band's checklists with a NON-NULL
   * duration. Null when the band is below the floor OR when `durationCount` is.
   *
   * That second condition goes one step past the letter of "a band with fewer
   * than N checklists shows no average" and squarely with its intent: averaging
   * three durations inside a twenty-checklist band is exactly the noise the
   * constant exists to refuse. The denominator stays visible either way.
   */
  avgDurationMin: number | null
  /** The duration figure's OWN denominator, which can be smaller than
   *  `checklists` and which the component must render. */
  durationCount: number
}

export interface WeatherStats {
  // ── Coverage ──────────────────────────────────────────────────────────────
  /** Every checklist in the export. */
  totalChecklists: number
  /** The attribution gate matched: a SnowRaven or a RainCrow weather credit. */
  foundCount: number
  /** Found AND the parser returned at least one field. */
  readableCount: number
  /** Found AND no field at all. Carried rather than derived, so the invariant
   *  `found === readable + unreadable` is assertable. */
  unreadableCount: number
  /** Median of (high - low) over readable checklists carrying a temperature,
   *  LOWER median on an even count so the reported figure is a span that
   *  actually occurred rather than an interpolation. Null when none. */
  medianTempSpanF: number | null

  // ── Distributions ─────────────────────────────────────────────────────────
  /** 11 rows, always all 11, aligned to CONDITION_EMOJI. */
  byCondition: WeatherBandRow[]
  /** 7 rows, aligned to TEMP_BANDS. */
  byTempBand: WeatherBandRow[]
  /** 9 rows, aligned to the Beaufort ordinals. Distribution only: species and
   *  duration go on temperature and condition, and the payload carries exactly
   *  what the section renders. */
  byWindBand: WeatherDistRow[]
  /** `day + night === denominator`, by construction. */
  dayNight: { day: number; night: number; denominator: number }

  // ── Per species ───────────────────────────────────────────────────────────
  species: {
    /** Sorted. Only species on at least one readable-block checklist. Index i
     *  addresses every array below. */
    names: string[]
    /** [i] -- ALL readable-block checklists species i appears on, which is the
     *  figure the readout's opening sentence states against `readableCount`.
     *  It is not the sum of either band array: a readable block can carry a
     *  wind and no condition and no temperature, so it counts here and in
     *  neither of them. */
    checklists: number[]
    /** [i][j] -- checklists carrying condition j on which species i appears. */
    byCondition: number[][]
    /** [i][j] -- the same over temperature bands. */
    byTempBand: number[][]
  }
}

export type WeatherSectionState = 'absent' | 'below-floor' | 'full'

/**
 * ONE discriminator, read by BOTH the jump-nav entry and the card, so "the
 * section does not render AND its nav entry does not appear" cannot half-happen.
 * The shipped Media entry evaluates `rawMlRows.length > 0` in two places; this
 * is that pattern with the duplication removed.
 */
export function weatherSectionState(s: WeatherStats): WeatherSectionState {
  if (s.foundCount === 0) return 'absent'
  if (s.readableCount < WEATHER_SECTION_MIN_READABLE) return 'below-floor'
  return 'full'
}

// ── The aggregation ─────────────────────────────────────────────────────────

/** One axis under construction. Sums are kept as running totals so the pass is
 *  single and nothing per-band is retained beyond three numbers. */
interface Acc {
  checklists: number
  speciesSum: number
  durationSum: number
  durationCount: number
}

function newAcc(n: number): Acc[] {
  const out: Acc[] = []
  for (let i = 0; i < n; i++) out.push({ checklists: 0, speciesSum: 0, durationSum: 0, durationCount: 0 })
  return out
}

function bandRows(acc: Acc[], keys: readonly string[]): WeatherBandRow[] {
  const out: WeatherBandRow[] = []
  for (let i = 0; i < acc.length; i++) {
    const a = acc[i]
    const enough = a.checklists >= WEATHER_BAND_MIN_TO_SHOW
    out.push({
      index: i,
      key: keys[i],
      checklists: a.checklists,
      avgSpecies: enough ? a.speciesSum / a.checklists : null,
      avgDurationMin: enough && a.durationCount >= WEATHER_BAND_MIN_TO_SHOW
        ? a.durationSum / a.durationCount
        : null,
      durationCount: a.durationCount,
    })
  }
  return out
}

function distRows(counts: number[], keys: readonly string[]): WeatherDistRow[] {
  const out: WeatherDistRow[] = []
  for (let i = 0; i < counts.length; i++) out.push({ index: i, key: keys[i], checklists: counts[i] })
  return out
}

/** Condition glyph -> its index in CONDITION_EMOJI. A Map rather than an
 *  `indexOf` inside the checklist loop: the scan must stay linear in the export,
 *  and a lookup inside a loop over export-derived values is precisely the shape
 *  the linearity rule is about. */
const CONDITION_INDEX = new Map<string, number>()
for (let i = 0; i < CONDITION_EMOJI.length; i++) CONDITION_INDEX.set(CONDITION_EMOJI[i], i)

/** The nine Beaufort ordinals as row keys. Kept local rather than imported from
 *  `BEAUFORT_WORDS` only so the payload's `key` type stays a plain string; the
 *  ordinal-to-word mapping is the component's, and `windBandIndex` is what ties
 *  the two together. */
const WIND_BAND_KEYS = [
  'Calm', 'Mostly calm', 'Light breeze', 'Gentle breeze', 'Moderate breeze',
  'Fresh breeze', 'Strong breeze', 'Near gale', 'Gale',
] as const

/** The LOWER median, so the reported span is one that actually occurred rather
 *  than an interpolation between two that did. */
function lowerMedian(sorted: number[]): number | null {
  if (sorted.length === 0) return null
  return sorted[Math.floor((sorted.length - 1) / 2)]
}

/**
 * THE ENTRY POINT. Pure, clone-safe in and out.
 *
 * IT ALWAYS RETURNS AN OBJECT, AND THAT IS THE MOST IMPORTANT LINE IN THIS FILE.
 * The section is hidden when nothing was found, and the instinctive way to
 * express that is to return `null` at `foundCount === 0`. Do not.
 * `isStatsBundle` rejects a bundle when any table field is `undefined` OR
 * `null`, so a null `weather` would fail validation on EVERY worker reply for
 * EVERY user with no weather blocks: the promise would resolve, the reply would
 * be rejected as unusable, and the tab would compute the whole chain on the
 * thread that paints, forever, silently, on exactly the users the worker exists
 * for -- with every figure correct and no test red. Absence is
 * `foundCount === 0` INSIDE the object, and `weatherSectionState` turns that
 * into 'absent'.
 *
 * It therefore must not throw on empty input either: `EMPTY_STATS_BUNDLE` is
 * `computeStatsBundle([], ...)`, so this is called with two empty arrays at
 * module scope and has to return the zero-shaped object -- all 11, 7 and 9 rows
 * present at zero, empty species arrays, `medianTempSpanF: null`.
 *
 * COST. Two passes: one over the checklists (the attribution gate, then the
 * parse, then the banding) and one over the filtered observations (the species
 * tally, which skips immediately on any row whose checklist carries no readable
 * block). Everything after the gate runs only on the block-bearing minority --
 * 353 of 3,252 checklists on the reference export -- so the parse cost is
 * bounded by the block count and not by the checklist count. Measured addition
 * to `computeStatsBundle` at the reference export scale (21,856 rows,
 * 3,252 checklists, 353 blocks): see the measurement recorded in
 * `statsBundle.ts`'s own docstring, which this work re-measured rather than left
 * stale.
 */
export function computeWeatherStats(
  checklists: readonly ChecklistEntry[],
  filteredObs: readonly ObservationEntry[],
): WeatherStats {
  const condAcc = newAcc(CONDITION_EMOJI.length)
  const tempAcc = newAcc(TEMP_BANDS.length)
  const windCounts = new Array<number>(WIND_BAND_KEYS.length).fill(0)
  const tempSpans: number[] = []

  let foundCount = 0
  let readableCount = 0
  let unreadableCount = 0
  let day = 0
  let night = 0

  /** Readable checklists only: submissionId -> its band indices. Built in pass
   *  one and consumed by pass two, so the species tally costs no second parse.
   *  Lives in this call frame and dies with it -- see the module header. */
  const readableBands = new Map<string, { cond: number; temp: number }>()

  for (const c of checklists) {
    const comment = c.checklistComments
    if (!comment) continue
    // The ATTRIBUTION gate, which is exactly the definition behind Data
    // Quality's "Any weather" bar one card up. A comment carrying weather
    // LABELS but no app credit counts as no block at all -- in neither the
    // found nor the unreadable count -- because a block with no credit is a
    // block whose field vocabulary this feature would be guessing at, and a
    // guessed parse produces a wrong number silently.
    if (!hasSnowravenWeatherBlock(comment) && !hasRaincrowWeatherBlock(comment)) continue
    foundCount++

    const rec: WeatherRecord = parseWeatherBlock(comment)
    if (!hasAnyWeatherField(rec)) { unreadableCount++; continue }
    readableCount++

    if (rec.dayNight === 'day') day++
    else if (rec.dayNight === 'night') night++

    const condIdx = rec.condition === null ? -1 : CONDITION_INDEX.get(rec.condition) ?? -1
    const tempIdx = rec.temperature === null ? -1 : tempBandIndex(rec.temperature)

    if (condIdx >= 0) {
      const a = condAcc[condIdx]
      a.checklists++
      a.speciesSum += c.speciesCount
      if (c.duration !== null) { a.durationSum += c.duration; a.durationCount++ }
    }
    if (tempIdx >= 0) {
      const a = tempAcc[tempIdx]
      a.checklists++
      a.speciesSum += c.speciesCount
      if (c.duration !== null) { a.durationSum += c.duration; a.durationCount++ }
      tempSpans.push(rec.temperature!.high - rec.temperature!.low)
    }
    if (rec.wind !== null) windCounts[windBandIndex(rec.wind)]++

    // EVERY readable checklist is registered, including one whose block gave a
    // wind and nothing else: the readout states a species' count against
    // `readableCount`, so a readable checklist missing from this map would make
    // that sentence understate by exactly the checklists it skipped.
    readableBands.set(c.submissionId, { cond: condIdx, temp: tempIdx })
  }

  // ── Pass two: the per-species tally ───────────────────────────────────────
  //
  // COUNTS ARE CHECKLISTS, NEVER OBSERVATION ROWS. A species with three rows on
  // one checklist (a spuh row, a subspecies row, the species row) contributes 1,
  // so the tally dedupes on (normalized name, submissionId) using the same
  // normalizer the rest of the tab uses -- which is also what makes this species
  // list match the life list.
  //
  // Bounded by the SPECIES count, not the row count: the arrays hold only
  // species with at least one readable-block checklist, so the reply payload
  // does not become a function of the export size.
  const speciesIndex = new Map<string, number>()
  const condCounts: number[][] = []
  const tempCounts: number[][] = []
  const totalCounts: number[] = []
  const seenPairs = new Set<string>()

  for (const o of filteredObs) {
    const bands = readableBands.get(o.submissionId)
    if (bands === undefined) continue
    const name = normalizeSpeciesName(o.commonName)
    let si = speciesIndex.get(name)
    if (si === undefined) {
      si = speciesIndex.size
      speciesIndex.set(name, si)
      condCounts.push(new Array<number>(CONDITION_EMOJI.length).fill(0))
      tempCounts.push(new Array<number>(TEMP_BANDS.length).fill(0))
      totalCounts.push(0)
    }
    // The species INDEX rather than its name, so the composite key needs no
    // escaping: an index is digits and a submission id is `S` plus digits, and
    // neither can contain the separator.
    const pair = `${si}|${o.submissionId}`
    if (seenPairs.has(pair)) continue
    seenPairs.add(pair)
    totalCounts[si]++
    if (bands.cond >= 0) condCounts[si][bands.cond]++
    if (bands.temp >= 0) tempCounts[si][bands.temp]++
  }

  // Sorted for display, with both count arrays permuted to match, so
  // `species.byCondition[i][j]` still addresses `byCondition[j]`.
  const order: number[] = []
  for (let i = 0; i < speciesIndex.size; i++) order.push(i)
  const nameByIndex = new Array<string>(speciesIndex.size)
  for (const [name, i] of speciesIndex) nameByIndex[i] = name
  order.sort((a, b) => nameByIndex[a].localeCompare(nameByIndex[b]))

  const names: string[] = []
  const speciesChecklists: number[] = []
  const speciesByCondition: number[][] = []
  const speciesByTempBand: number[][] = []
  for (const i of order) {
    names.push(nameByIndex[i])
    speciesChecklists.push(totalCounts[i])
    speciesByCondition.push(condCounts[i])
    speciesByTempBand.push(tempCounts[i])
  }

  tempSpans.sort((a, b) => a - b)

  return {
    totalChecklists: checklists.length,
    foundCount,
    readableCount,
    unreadableCount,
    medianTempSpanF: lowerMedian(tempSpans),
    byCondition: bandRows(condAcc, CONDITION_EMOJI),
    byTempBand: bandRows(tempAcc, TEMP_BANDS),
    byWindBand: distRows(windCounts, WIND_BAND_KEYS),
    dayNight: { day, night, denominator: day + night },
    species: {
      names,
      checklists: speciesChecklists,
      byCondition: speciesByCondition,
      byTempBand: speciesByTempBand,
    },
  }
}
