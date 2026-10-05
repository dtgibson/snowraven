// The First of Year chart's geometry and chart data (species-first-of-year;
// design-spec.md "Geometry"). A lib module rather than exports of
// FirstOfYearChart.tsx, so the section can reserve the chart's exact box for its
// Suspense fallback without importing the chart (and Recharts) statically, and
// so every rule here is a pure function a test can sweep. Entry-safe: its only
// runtime import is the month abbreviations, from a module whose own runtime
// imports are type-only.
//
// The box. Its HEIGHT is a function of the width tier alone (the phone tier at
// 640px and below, the wide tier above it, as `useIsPhone` reports), never of
// the measured width, so the fallback and the chart read one number before the
// chunk lands. Its MAX WIDTH is a function of the number of years the axis
// spans, so a short span stays a compact strip beside the rows rather than a
// line stretched across the card.
//
// The axes. Horizontal: every integer year from the earliest row to the latest,
// continuously, so a gap year keeps its place and has no point (FR-19, FR-21).
// Vertical: day of year 1 to 366, increasing upward, labeled by abbreviated
// month at month starts, with January and December always labeled (FR-20).
// Chart text is px on fixed-px lanes and does not follow the in-app text scale
// (design-spec.md); the rows are the rem-sized record of every date drawn.
//
// The loop over the year span is the one loop here driven by a NUMBER read from
// user text (schema.md section 7.2, `.claude/rules/security.md`). Its ends are
// clamped to [FOY_YEAR_MIN, FOY_YEAR_MAX] at the point of use, so it runs at
// most 10,000 times whatever the caller passes, and the bound is a property of
// this module rather than only of `computeFirstOfYear`'s shape check. Everything
// else iterates over the rows (one per year) or over the twelve months.
// This file is governed by `.claude/rules/security.md`, whose `paths` list
// names it, for this clamped year-span loop.

import type { FirstOfYearRow } from './firstOfYear'
import { MONTH_ABBR } from './sightingsGraph'

/** One position on the year axis. `dayOfYear` null is a gap year: a place on
 *  the axis with no point. */
export type FirstOfYearPoint = {
  year: number
  dayOfYear: number | null
}

export type FirstOfYearChartData = {
  /** One per integer year in [yearDomain[0], yearDomain[1]], ascending. */
  points: FirstOfYearPoint[]
  /** [earliest row year, latest row year]. */
  yearDomain: [number, number]
  /** Every integer year in the domain (QA-20). */
  yearTicks: number[]
}

export type MonthTick = { dayOfYear: number; label: string }

/** The chart draws from this many year rows on (FR-18); below it the rows
 *  stand alone. docs/HELP.md states it, and its guard reads this constant. */
export const FOY_CHART_MIN_ROWS = 2

/** The vertical axis: day of year, 1 to 366. */
export const FOY_Y_DOMAIN: [number, number] = [1, 366]
/** Room above the plot so a point on December 31 is not cut at the top. */
export const FOY_TOP_PX = 8
/** Plot heights by tier (design-spec.md: 150 on a phone, 200 wide). */
export const FOY_PLOT_PX = 150
export const FOY_WIDE_PLOT_PX = 200
/** The year labels' lane under the plot. */
export const FOY_AXIS_LANE_PX = 24
/** Two 11px month labels are never closer than this, centre to centre. */
export const FOY_LABEL_MIN_GAP_PX = 18
/** The month labels' gutter left of the plot (the Y axis width). */
export const FOY_GUTTER_PX = 34
/** Room right of the plot for the last year label's right half. */
export const FOY_RIGHT_PX = 14
/** The year axis padding on each side, so an end point's dot stays inside. */
export const FOY_X_PAD_PX = 10
/** The widest a year may be spaced, which caps the chart's width. */
export const FOY_MAX_YEAR_PITCH_PX = 120
/** The narrowest cap: what the month and year labels need. */
export const FOY_MIN_CHART_PX = 260
/** A year label's budget: "2026" at 11px plus a little air. */
export const FOY_YEAR_LABEL_PX = 28
/** The year clamp (a well-formed year is four digits). */
export const FOY_YEAR_MIN = 0
export const FOY_YEAR_MAX = 9999

/** The day of year each month starts on in a leap year. The one-day shift of a
 *  common year's month starts after February is immaterial at chart scale. */
export const FOY_MONTH_STARTS = [1, 32, 61, 92, 122, 153, 183, 214, 245, 275, 306, 336]

/** The plot's height for the tier. */
export function firstOfYearPlotHeight(wide: boolean): number {
  return wide ? FOY_WIDE_PLOT_PX : FOY_PLOT_PX
}

/** The chart's whole height for the tier: 182 on a phone, 232 wide. The
 *  Suspense fallback and the chart both read this, so nothing moves when the
 *  chart's chunk arrives (FR-24). */
export function firstOfYearChartHeight(wide: boolean): number {
  return FOY_TOP_PX + firstOfYearPlotHeight(wide) + FOY_AXIS_LANE_PX
}

/** The chart box's max width for an axis spanning `yearCount` years: two years
 *  give 260, four give 428, ten give 1,148 (no effect at any shipped width). */
export function firstOfYearChartMaxWidth(yearCount: number): number {
  const steps = Math.max(1, Math.floor(yearCount) - 1)
  return Math.max(
    FOY_MIN_CHART_PX,
    FOY_GUTTER_PX + FOY_RIGHT_PX + 2 * FOY_X_PAD_PX + steps * FOY_MAX_YEAR_PITCH_PX,
  )
}

/** The distance in px between two adjacent years for a chart `widthPx` wide
 *  whose axis spans `yearCount` years. 0 for a width with no room. */
export function firstOfYearYearPitch(widthPx: number, yearCount: number): number {
  const range = widthPx - FOY_GUTTER_PX - FOY_RIGHT_PX - 2 * FOY_X_PAD_PX
  if (!(range > 0)) return 0
  return range / Math.max(1, Math.floor(yearCount) - 1)
}

function clampYear(year: number): number {
  return Math.min(FOY_YEAR_MAX, Math.max(FOY_YEAR_MIN, Math.trunc(year)))
}

/**
 * The chart's data from the derived rows: one point per integer year from the
 * earliest row year to the latest (a gap year carries a null day of year), the
 * domain, and one tick per year. Rows are one per year as `computeFirstOfYear`
 * returns them; a repeated year keeps its first row, and a row whose year is
 * not a finite number is skipped. An empty input gives no points, no ticks and
 * a degenerate [0, 0] domain, which the chart never draws (it renders only at
 * two rows or more).
 */
export function buildFirstOfYearChartData(rows: readonly FirstOfYearRow[]): FirstOfYearChartData {
  const byYear = new Map<number, number>()
  let lo = Number.POSITIVE_INFINITY
  let hi = Number.NEGATIVE_INFINITY
  for (const r of rows) {
    if (!Number.isFinite(r.year)) continue
    const year = clampYear(r.year)
    if (byYear.has(year)) continue
    byYear.set(year, r.dayOfYear)
    if (year < lo) lo = year
    if (year > hi) hi = year
  }
  if (byYear.size === 0) return { points: [], yearDomain: [0, 0], yearTicks: [] }
  const points: FirstOfYearPoint[] = []
  const yearTicks: number[] = []
  for (let y = lo; y <= hi; y++) {
    const doy = byYear.get(y)
    points.push({ year: y, dayOfYear: doy !== undefined && Number.isFinite(doy) ? doy : null })
    yearTicks.push(y)
  }
  return { points, yearDomain: [lo, hi], yearTicks }
}

/**
 * The pairs of consecutive years that both carry a point: the segments the line
 * draws. The chart itself breaks the line with Recharts' `connectNulls={false}`;
 * this states the same rule as data, and the chart test asserts the two agree
 * (QA-22). A point in no pair is a lone point.
 */
export function segmentsOf(points: readonly FirstOfYearPoint[]): Array<[number, number]> {
  const out: Array<[number, number]> = []
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]
    const b = points[i]
    if (a.dayOfYear !== null && b.dayOfYear !== null && b.year === a.year + 1) out.push([a.year, b.year])
  }
  return out
}

/**
 * The month labels for a plot `plotPx` tall: January and December always, and
 * the intermediate month starts at the densest step k of 1, 2, 3 or 6 months
 * for which every adjacent pair of labels is at least FOY_LABEL_MIN_GAP_PX
 * apart; January and December alone when no step fits. At both shipped plot
 * heights this resolves to Jan, Apr, Jul, Oct, Dec (design-spec.md).
 */
export function monthTicks(plotPx: number): MonthTick[] {
  const pxPerDay = plotPx / (FOY_Y_DOMAIN[1] - FOY_Y_DOMAIN[0])
  for (const k of [1, 2, 3, 6]) {
    const months: number[] = []
    for (let m = 0; m < 11; m += k) months.push(m)
    months.push(11)
    let fits = true
    for (let i = 1; i < months.length; i++) {
      if ((FOY_MONTH_STARTS[months[i]] - FOY_MONTH_STARTS[months[i - 1]]) * pxPerDay < FOY_LABEL_MIN_GAP_PX) {
        fits = false
        break
      }
    }
    if (fits) return months.map(m => ({ dayOfYear: FOY_MONTH_STARTS[m], label: MONTH_ABBR[m] }))
  }
  return [
    { dayOfYear: FOY_MONTH_STARTS[0], label: MONTH_ABBR[0] },
    { dayOfYear: FOY_MONTH_STARTS[11], label: MONTH_ABBR[11] },
  ]
}

/**
 * Which years carry a visible label at `pitchPx` per year (design-spec.md,
 * "Year-label thinning"): every ceil(FOY_YEAR_LABEL_PX / pitch)th year from the
 * first, and always the last; when the last would sit within the label budget
 * of the previous shown label, that previous one yields to it. Labels never
 * overlap. Once the chart is wider than about 100px (every shipped layout
 * gives it more than twice that) the axis is wider than one label budget, so
 * the first year is never the one that yields.
 */
export function yearLabelYears(yearTicks: readonly number[], pitchPx: number): number[] {
  const n = yearTicks.length
  if (n <= 1) return [...yearTicks]
  const step = pitchPx > 0 && Number.isFinite(pitchPx)
    ? Math.max(1, Math.ceil(FOY_YEAR_LABEL_PX / pitchPx))
    : n
  const shown: number[] = []
  for (let i = 0; i < n; i += step) shown.push(i)
  const last = n - 1
  if (shown[shown.length - 1] !== last) {
    if ((last - shown[shown.length - 1]) * pitchPx < FOY_YEAR_LABEL_PX) shown.pop()
    shown.push(last)
  }
  return shown.map(i => yearTicks[i])
}
