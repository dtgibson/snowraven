// eBird's frequency figures from a parsed bar-chart file (targets-tab,
// schema.md sections 2.2 and 2.6): ONE pure derivation and ONE switch.
//
// A bar-chart file carries, per period (four per month), the number of
// checklists in the region (`sampleSizes[p]`) and, per species, the share of
// those checklists that reported it (`freqs[p]`). So `freqs[p] * sampleSizes[p]`
// is the number of checklists reporting the species in period p, and
//
//   sample-weighted = 100 * sum(f_p * n_p) / sum(n_p)
//
// is the share of ALL the checklists in the range that reported it: the figure
// eBird's Targets page shows over the same range. `period-mean` (the plain mean
// of the periods that have any checklists) over-weights thin periods and is kept
// ONLY so the Alameda pin (section 2.6) can be re-run against it in one line if
// the user's real file disagrees with the default. It is not a display option.
//
// Display rounds with `toFixed(2)`; sorts read the raw number, and a `null`
// (no checklists at all in the periods asked about) sorts after every number
// (FR-34).

import type { BarChartFile, BarChartRow } from './parseBarChart'
import { monthsInRange, parseBarChartFilename } from './barChartFilename'

export type FrequencyMethod = 'sample-weighted' | 'period-mean'

/** Pinned against the user's Alameda file (section 2.6) on 2026-09-27: Lincoln's
 *  Sparrow year-round prints 3.29 sample-weighted (eBird's Targets figure) and
 *  3.16 period-mean. `alameda.fixture.json` holds the figures and
 *  `barChartFrequency.test.ts` goes red if this constant flips;
 *  `frontend/scripts/barchart-pin.mjs` re-runs the pin against a new file. */
export const FREQUENCY_METHOD: FrequencyMethod = 'sample-weighted'

/** Every period index, 0..47. */
export const ALL_PERIODS: readonly number[] = Object.freeze(Array.from({ length: 48 }, (_, i) => i))

/** The four period indices of a month (1..12): [4(m-1) .. 4(m-1)+3]. */
export function monthPeriods(month1to12: number): readonly number[] {
  const base = 4 * (month1to12 - 1)
  return [base, base + 1, base + 2, base + 3]
}

/**
 * The percent of checklists reporting the species over `periods`, or null when
 * no period asked about has any checklists (the denominator is zero). A period
 * index outside 0..47 contributes nothing.
 */
export function frequencyPercent(
  freqs: readonly number[],
  sampleSizes: readonly number[],
  periods: readonly number[],
  method: FrequencyMethod = FREQUENCY_METHOD,
): number | null {
  if (method === 'sample-weighted') {
    let num = 0
    let den = 0
    for (const p of periods) {
      const n = sampleSizes[p]
      const f = freqs[p]
      if (typeof n !== 'number' || !(n > 0) || typeof f !== 'number') continue
      num += f * n
      den += n
    }
    return den > 0 ? (100 * num) / den : null
  }
  let sum = 0
  let count = 0
  for (const p of periods) {
    const n = sampleSizes[p]
    const f = freqs[p]
    if (typeof n !== 'number' || !(n > 0) || typeof f !== 'number') continue
    sum += f
    count += 1
  }
  return count > 0 ? (100 * sum) / count : null
}

/** Year-round: every period in the file (FR-32). */
export function yearRoundPercent(row: BarChartRow, sampleSizes: readonly number[], method: FrequencyMethod = FREQUENCY_METHOD): number | null {
  return frequencyPercent(row.freqs, sampleSizes, ALL_PERIODS, method)
}

/** This month: the month's four periods (FR-31). `month1to12` is the device's
 *  local calendar month, read by the caller, never here. */
export function thisMonthPercent(row: BarChartRow, sampleSizes: readonly number[], month1to12: number, method: FrequencyMethod = FREQUENCY_METHOD): number | null {
  return frequencyPercent(row.freqs, sampleSizes, monthPeriods(month1to12), method)
}

/** A month is present in a file when any of its four periods has checklists. */
export function monthsPresentFromSamples(sampleSizes: readonly number[]): boolean[] {
  const out = new Array<boolean>(12).fill(false)
  for (let m = 0; m < 12; m++) {
    for (let k = 0; k < 4; k++) {
      const n = sampleSizes[4 * m + k]
      if (typeof n === 'number' && n > 0) { out[m] = true; break }
    }
  }
  return out
}

/** The range a stored file covers, as the status line and the year-round gate
 *  read it (FR-30, FR-32). */
export interface BarChartRange {
  /** The download's year range, from its name; null when the name carries none. */
  years: [number, number] | null
  /** Twelve booleans, index 0 = January. */
  months: boolean[]
  /** All twelve months present: year-round is offered only then (FR-32). */
  fullYear: boolean
}

/**
 * The file's range: the name's `y1_y2_bmo_emo` when it carries one (FR-30),
 * otherwise the months whose periods hold any checklists, with no years.
 */
export function barChartRange(file: BarChartFile, filename: string): BarChartRange {
  const info = parseBarChartFilename(filename)
  if (!info.malformedCode && info.years !== null && info.months !== null) {
    const months = monthsInRange(info.months[0], info.months[1])
    return { years: info.years, months, fullYear: months.every(Boolean) }
  }
  const months = monthsPresentFromSamples(file.sampleSizes)
  return { years: null, months, fullYear: months.every(Boolean) }
}

/** Two decimals, the display form every probability figure takes (FR-31). */
export function formatPercent(v: number): string {
  return v.toFixed(2)
}
