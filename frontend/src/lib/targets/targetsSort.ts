// The six sorts, their availability and the default rule (targets-tab,
// schema.md section 5.5; FR-48 to FR-52).
//
// Every comparator ends in the pool's eBird taxonomic order (`poolIndex`), so
// equal keys never fall into an order the data did not choose. A null key
// (no eBird figure, no live data, no distance) sorts after every number
// (FR-34, FR-51), whatever the direction.

import type { Classified } from './targetsClassify'
import type { LiveCell } from './targetsLive'
import {
  SORT_NAME_ALPHA, SORT_NAME_DISTANCE, SORT_NAME_LIVE, SORT_NAME_MONTH, SORT_NAME_TAXONOMIC, SORT_NAME_YEAR,
  SORT_MONTH_NOT_IN_RANGE, SORT_NEEDS_KEY, SORT_NEEDS_LOCATION, SORT_NO_LIVE_DATA, sortNeedsFile, sortNeedsFullYear,
} from './targetsCopy'

export type TargetsSort = 'freq-month' | 'freq-year' | 'live-days' | 'distance' | 'alpha' | 'taxonomic'

/** The order the sort control lists them in (FR-48). */
export const SORT_ORDER: readonly TargetsSort[] = ['freq-month', 'freq-year', 'live-days', 'distance', 'alpha', 'taxonomic']

/** The six exact FR-48 names, in the control and in the accessible name. */
export const SORT_LABELS: Record<TargetsSort, string> = {
  'freq-month': SORT_NAME_MONTH,
  'freq-year': SORT_NAME_YEAR,
  'live-days': SORT_NAME_LIVE,
  'distance': SORT_NAME_DISTANCE,
  'alpha': SORT_NAME_ALPHA,
  'taxonomic': SORT_NAME_TAXONOMIC,
}

export interface TargetRow extends Classified {
  /** This month's eBird frequency, percent; null when the file has no figure. */
  monthPct: number | null
  /** Year-round eBird frequency, percent; null when the file has no figure. */
  yearPct: number | null
  /** Null when there is no live data at all (no key, offline with an empty cache). */
  live: LiveCell | null
  /** Miles from the anchor to the last report; null when unknown. */
  distanceMi: number | null
}

function nullLast(a: number | null, b: number | null, desc: boolean): number {
  if (a === null && b === null) return 0
  if (a === null) return 1
  if (b === null) return -1
  return desc ? b - a : a - b
}

/** A stable sort by `sort`, ties broken by taxonomic order. Returns a new array. */
export function sortRows(rows: readonly TargetRow[], sort: TargetsSort): TargetRow[] {
  const primary: (a: TargetRow, b: TargetRow) => number =
    sort === 'freq-month' ? (a, b) => nullLast(a.monthPct, b.monthPct, true)
    : sort === 'freq-year' ? (a, b) => nullLast(a.yearPct, b.yearPct, true)
    : sort === 'live-days' ? (a, b) => nullLast(a.live ? a.live.daysReported : null, b.live ? b.live.daysReported : null, true)
    : sort === 'distance' ? (a, b) => nullLast(a.distanceMi, b.distanceMi, false)
    : sort === 'alpha' ? (a, b) => a.commonName.localeCompare(b.commonName)
    : () => 0
  return [...rows].sort((a, b) => primary(a, b) || (a.poolIndex - b.poolIndex))
}

export interface SortContext {
  county: string
  hasFile: boolean
  /** The current month is inside the file's range. */
  monthInRange: boolean
  /** All twelve months are in the file (FR-32). */
  fullYear: boolean
  /** The file's month range label, for the year-round reason. */
  monthsLabel: string
  /** Any live data exists, cached or partial (FR-50). */
  liveAvailable: boolean
  /** Why there is none: no key, or nothing loaded yet. */
  liveMissing: 'no-key' | 'no-data'
  /** A distance anchor exists (a Default Location, or the device position). */
  hasAnchor: boolean
}

/** Null = available; otherwise the reason text the control appends (FR-38, FR-50, FR-51). */
export function sortAvailability(ctx: SortContext): Record<TargetsSort, string | null> {
  const liveReason = ctx.liveAvailable ? null : (ctx.liveMissing === 'no-key' ? SORT_NEEDS_KEY : SORT_NO_LIVE_DATA)
  return {
    'freq-month': !ctx.hasFile ? sortNeedsFile(ctx.county) : (ctx.monthInRange ? null : SORT_MONTH_NOT_IN_RANGE),
    'freq-year': !ctx.hasFile ? sortNeedsFile(ctx.county) : (ctx.fullYear ? null : sortNeedsFullYear(ctx.monthsLabel)),
    'live-days': liveReason,
    'distance': liveReason ?? (ctx.hasAnchor ? null : SORT_NEEDS_LOCATION),
    'alpha': null,
    'taxonomic': null,
  }
}

/**
 * FR-49: this month's eBird frequency when the county's file covers the current
 * month; the live count when any live data exists; Taxonomic otherwise.
 */
export function defaultSort(availability: Record<TargetsSort, string | null>): TargetsSort {
  if (availability['freq-month'] === null) return 'freq-month'
  if (availability['live-days'] === null) return 'live-days'
  return 'taxonomic'
}

/** The sort in force: the user's explicit choice while it stays available, else the default. */
export function effectiveSort(chosen: TargetsSort | null, availability: Record<TargetsSort, string | null>): TargetsSort {
  if (chosen !== null && availability[chosen] === null) return chosen
  return defaultSort(availability)
}
