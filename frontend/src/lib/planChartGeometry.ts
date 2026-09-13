// The Weather/tide Planner chart's geometry and density rules (design-spec.md,
// "The chart"; decisions D4-13, D4-14, D4-16): the lanes of each tier, the
// pixels per hour, the x/y mapping the lazy chart and its HTML siblings share,
// and the pure density decisions (block cells, tick sets, label forms) that
// follow from the pixels per hour alone. A lib module rather than exports of
// PlanChart.tsx so that file stays component-only (react-refresh), so the
// result region can reserve the chart's exact height for its Suspense fallback
// without importing the chart (and recharts) statically, and so every rule
// here is a pure function a test can sweep over widths. Entry-safe: no imports
// beyond the merge's types.
//
// Two tiers, one axis. Phone (viewport 640px and below): the constant
// PLAN_HOUR_PX and the approved lanes, byte for byte. Wide (641px and up):
// `hpx = max(4, (boxWidth - 40 - 2) / hours)` so the chosen span fills the
// chart box, measured from the box itself, with a day-header lane along the top
// and a taller plot. The curve is always the document's 30-minute samples; only
// what would collide changes with density.
//
// Since plan-sun-moon-readout (schema 6.1): the sun track sits INSIDE the plot
// on its own scale (`ySun`, zero at PLAN_SUN_ZERO_FRAC of the plot from the
// top, domain planSunDomain()), the without-tide plot grew to hold it, and the
// pick's geometry lives here too: `tAt` (the inverse of `x`), `pickMarkerBox`
// (the HTML overlay's box, the plot's full height) and `revealScrollLeft` (the
// minimum scroll that shows a keyboard-stepped marker). The track has NO
// density rule of its own: it is always the model's samples (FR-33).

import type { Plan, PlanCell } from './plan'
import type { PlanDaysInView } from './planDaysInView'
import { planHoursInView } from './planDaysInView'

/** The phone tier's constant: pixels per hour of real elapsed time. A day is 384 px. */
export const PLAN_HOUR_PX = 16
/** The wide tier's floor. */
export const PLAN_MIN_HOUR_PX = 4
/** The gutter on the left holding the sticky tide scale. */
export const PLAN_GUTTER_PX = 40
/** The scroll box's own borders, which the track must fit inside at All. */
export const PLAN_BOX_CHROME_PX = 2

/** Lane heights, px. Phone: label lane, plot (with / without tide), axis lane
 *  (hour ticks over day labels), strip. Wide adds a day-header lane on top and
 *  keeps only the hour ticks in a shorter axis lane. */
export const PLAN_LABEL_LANE_PX = 28
export const PLAN_PLOT_PX = 128
/** The without-tide plot holds the sun track (design-spec "Numbers the
 *  Engineer needs"): 72 on phones, 120 on the wide tier (were 40 / 56). */
export const PLAN_PLOT_NO_TIDE_PX = 72
export const PLAN_AXIS_LANE_PX = 38
export const PLAN_STRIP_PX = 48
export const PLAN_WIDE_DAY_HEADER_PX = 22
export const PLAN_WIDE_PLOT_PX = 220
export const PLAN_WIDE_PLOT_NO_TIDE_PX = 120
export const PLAN_WIDE_AXIS_LANE_PX = 22

/** The sun track's zero line, as a fraction of the plot's height measured
 *  from the TOP: daylight takes the upper 60%, night the lower 40%. */
export const PLAN_SUN_ZERO_FRAC = 0.6
/** The altitude drawn at the plot's top edge. */
export const PLAN_SUN_TOP_DEG = 90

/** The sun scale's domain on one uniform scale: [-60, 90] at the shipped
 *  fraction, so one degree is plot / 150 px. The hidden Recharts YAxis for the
 *  track takes exactly this. */
export function planSunDomain(): [number, number] {
  // With the zero fraction measured from the TOP: min = -top * (1 - f) / f.
  return [-PLAN_SUN_TOP_DEG * (1 - PLAN_SUN_ZERO_FRAC) / PLAN_SUN_ZERO_FRAC, PLAN_SUN_TOP_DEG]
}

export interface PlanLanes {
  /** The day-header lane (wide only; 0 on phones). */
  dayHeader: number
  labels: number
  plot: number
  axis: number
  strip: number
}

export function planLanes(withTide: boolean, wide: boolean): PlanLanes {
  return wide
    ? { dayHeader: PLAN_WIDE_DAY_HEADER_PX, labels: PLAN_LABEL_LANE_PX, plot: withTide ? PLAN_WIDE_PLOT_PX : PLAN_WIDE_PLOT_NO_TIDE_PX, axis: PLAN_WIDE_AXIS_LANE_PX, strip: PLAN_STRIP_PX }
    : { dayHeader: 0, labels: PLAN_LABEL_LANE_PX, plot: withTide ? PLAN_PLOT_PX : PLAN_PLOT_NO_TIDE_PX, axis: PLAN_AXIS_LANE_PX, strip: PLAN_STRIP_PX }
}

/** The chart box's total height for a tier, so the Suspense fallback can
 *  reserve exactly it and the list never shifts: 242 / 186 on phones, 340 /
 *  240 on the wide tier (with / without tide). */
export function planChartHeight(withTide: boolean, wide = false): number {
  const l = planLanes(withTide, wide)
  return l.dayHeader + l.labels + l.plot + l.axis + l.strip
}

/** The wide tier's pixels per hour for a box of `boxWidth` px and a span of
 *  `hours`: the span fills the box, floored at 4 px/h. The box width is taken
 *  whole so the All track's width is an integer that fits the scroller. */
export function planHourPx(boxWidth: number, hours: number): number {
  if (!(hours > 0)) return PLAN_MIN_HOUR_PX
  return Math.max(PLAN_MIN_HOUR_PX, (Math.floor(boxWidth) - PLAN_GUTTER_PX - PLAN_BOX_CHROME_PX) / hours)
}

/** The pixels per hour a tier and choice resolve to; the phone tier ignores
 *  the box and the choice. `boxWidth` 0 (not yet measured) reads as the phone
 *  constant so the first wide paint is never a 4 px/h smear. */
export function planHourPxFor(plan: Plan, wide: boolean, view: PlanDaysInView, boxWidth: number): number {
  if (!wide || !(boxWidth > 0)) return PLAN_HOUR_PX
  return planHourPx(boxWidth, planHoursInView(plan.window.axisStartTs, plan.window.endTs, view))
}

export interface PlanGeometry {
  axisStart: number
  /** Exclusive: window.endTs + 1. */
  axisEnd: number
  hpx: number
  secPerPx: number
  plotW: number
  width: number
  lanes: PlanLanes
  /** The Recharts chart's height: label lane plus plot. */
  chartH: number
  yMin: number
  yMax: number
  x: (t: number) => number
  y: (v: number) => number
  /** The sun scale: `ySun(PLAN_SUN_TOP_DEG)` is the plot's top edge,
   *  `ySun(0)` the zero line at PLAN_SUN_ZERO_FRAC, `ySun(domain min)` its
   *  bottom edge; the same arithmetic the hidden sun YAxis performs. */
  ySun: (deg: number) => number
  /** The inverse of `x`: the instant under a canvas x pixel, clamped to
   *  [axisStart, axisEnd - 1], so a press in the gutter reads the axis start. */
  tAt: (px: number) => number
}

/** The mapping from the document's instants and heights to pixels. Pure
 *  arithmetic on `Plan` values; nothing here converts a timezone. */
export function planGeometry(plan: Plan, hasTide: boolean, hpx = PLAN_HOUR_PX, wide = false): PlanGeometry {
  const axisStart = plan.window.axisStartTs
  const axisEnd = plan.window.endTs + 1
  const secPerPx = 3600 / hpx
  const plotW = Math.round((axisEnd - axisStart) / secPerPx)
  const lanes = planLanes(hasTide, wide)
  let yMin = -1, yMax = 7
  if (hasTide && plan.tide?.status === 'ok' && plan.tide.curve.length > 0) {
    let lo = Infinity, hi = -Infinity
    for (const s of plan.tide.curve) { if (s.v < lo) lo = s.v; if (s.v > hi) hi = s.v }
    yMin = Math.floor(lo) - 0.6
    yMax = Math.ceil(hi) + 1.2
  } else if (!hasTide) {
    yMin = 0; yMax = 1
  }
  const x = (t: number) => PLAN_GUTTER_PX + (t - axisStart) / secPerPx
  const y = (v: number) => lanes.labels + lanes.plot - (v - yMin) / (yMax - yMin) * lanes.plot
  const [sunMin, sunMax] = planSunDomain()
  const ySun = (d: number) => lanes.labels + lanes.plot * (PLAN_SUN_ZERO_FRAC - d / (sunMax - sunMin))
  const tAt = (px: number) => Math.min(axisEnd - 1, Math.max(axisStart, axisStart + (px - PLAN_GUTTER_PX) * secPerPx))
  return { axisStart, axisEnd, hpx, secPerPx, plotW, width: PLAN_GUTTER_PX + plotW, lanes, chartH: lanes.labels + lanes.plot, yMin, yMax, x, y, ySun, tAt }
}

// ── the pick's geometry (plan-sun-moon-readout, schema 6.1) ─────────────────

export interface PickMarkerBox { left: number; top: number; height: number }

/** The pick marker overlay's box inside the canvas: at `x(t)`, from the top of
 *  the plot (below the day-header and label lanes) for the plot's full height
 *  (FR-14). An HTML sibling positioned by the same `x`, never a chart line. */
export function pickMarkerBox(g: PlanGeometry, t: number): PickMarkerBox {
  return { left: g.x(t), top: g.lanes.dayHeader + g.lanes.labels, height: g.lanes.plot }
}

/** The minimum new scrollLeft that puts a marker at canvas x `markerX` inside
 *  the visible span with the gutter kept clear on the left,
 *  [scrollLeft + PLAN_GUTTER_PX, scrollLeft + clientWidth - 1], or the current
 *  value when it already is (FR-22). Never below 0. */
export function revealScrollLeft(markerX: number, scrollLeft: number, clientWidth: number): number {
  if (markerX < scrollLeft + PLAN_GUTTER_PX) return Math.max(0, markerX - PLAN_GUTTER_PX)
  if (markerX > scrollLeft + clientWidth - 1) return Math.max(0, markerX - clientWidth + 1)
  return scrollLeft
}

// ── density rules (D4-16), each a pure function of the pixels per hour ─────────

/** One glyph per N hours in the strip: 1 at 16 px/h and up, 3 while three
 *  hours still span 16 px, else 6. */
export function planGlyphEvery(hpx: number): 1 | 3 | 6 {
  return hpx >= 16 ? 1 : hpx * 3 >= 16 ? 3 : 6
}

/** Hourly cells gain the temperature at 32 px/h and up. */
export const planShowsTemperature = (hpx: number): boolean => hpx >= 32

/** Event labels carry the kind ("Sunrise 6:48 AM") at 8 px/h and up; below,
 *  the time alone (the marker shape says which). */
export const planFullEventLabel = (hpx: number): boolean => hpx >= 8

/** Hour ticks: 6 AM / Noon / 6 PM while six hours span 34 px; else Noon only. */
export function planTickHours(hpx: number): number[] {
  return hpx * 6 >= 34 ? [6, 12, 18] : [12]
}

/** The day label by the day's visible width: the full label at 84 px and up,
 *  weekday and day number at 44, the weekday at 22, else nothing. */
export function planDayLabel(full: string, short: string, weekday: string, dayW: number): string {
  return dayW >= 84 ? full : dayW >= 44 ? short : dayW >= 22 ? weekday : ''
}

/** A daily strip cell's content by its width: description and high/low at
 *  200 px and up, high/low at 90, else the emoji alone. */
export function planDailyCellMode(widthPx: number): 'full' | 'hl' | 'emoji' {
  return widthPx >= 200 ? 'full' : widthPx >= 90 ? 'hl' : 'emoji'
}

/** An hourly cell's content by its width and the density: emoji plus
 *  temperature at 32 px/h in a cell of 30 px or more, the emoji alone from 12
 *  px, nothing narrower (the clipped first cell at the axis start). */
export function planHourlyCellMode(widthPx: number, hpx: number): 'temp' | 'emoji' | 'none' {
  return widthPx >= 30 && planShowsTemperature(hpx) ? 'temp' : widthPx >= 12 ? 'emoji' : 'none'
}

/** The hourly tag's form by the hourly span's width and the glyph cadence. */
export function planHourlyTagMode(glyphEvery: 1 | 3 | 6, spanPx: number): 'full' | 'every' | 'short' | 'min' {
  if (glyphEvery === 1) return 'full'
  return spanPx >= 250 ? 'every' : spanPx >= 120 ? 'short' : 'min'
}

/** The daily tag's form by the first daily cell's width. */
export const planDailyTagMode = (widthPx: number): 'full' | 'short' => (widthPx >= 120 ? 'full' : 'short')

export interface StripCell {
  resolution: 'hourly' | 'daily'
  startTs: number
  endTs: number
  local: string
  weather: PlanCell['weather']
}

/**
 * The strip's cells at a glyph cadence: at 1 the document's cells as they
 * are; at 3 or 6 the hourly cells collapse into one cell per clock-aligned
 * block (12 AM, 3 AM, ... or 12 AM, 6 AM, ...) that shows the reading at its
 * first hour, the daily cells unchanged. The block boundary is read from the
 * cell's own local clock string (the document's, never computed here).
 */
export function planStripCells(cells: ReadonlyArray<PlanCell>, glyphEvery: 1 | 3 | 6): StripCell[] {
  if (glyphEvery === 1) return cells.map(c => ({ resolution: c.resolution, startTs: c.startTs, endTs: c.endTs, local: c.local, weather: c.weather }))
  const out: StripCell[] = []
  let block: StripCell | null = null
  for (const c of cells) {
    if (c.resolution === 'daily') {
      block = null
      out.push({ resolution: 'daily', startTs: c.startTs, endTs: c.endTs, local: c.local, weather: c.weather })
      continue
    }
    const hod = Number(c.local.slice(11, 13))
    if (block && Number.isFinite(hod) && hod % glyphEvery !== 0) {
      block.endTs = c.endTs
      continue
    }
    block = { resolution: 'hourly', startTs: c.startTs, endTs: c.endTs, local: c.local, weather: c.weather }
    out.push(block)
  }
  return out
}
