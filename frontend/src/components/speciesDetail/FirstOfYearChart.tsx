// The First of Year chart (species-first-of-year; design-spec.md "The chart"):
// each year's first sighting as one point at (year, day of year), consecutive
// years joined by a straight segment, a gap year a missing point and a broken
// line, month labels up the left and year labels along the bottom.
//
// THE ONLY MODULE IN THIS FEATURE THAT IMPORTS RECHARTS, reached only through
// `lazy(() => import('./FirstOfYearChart'))` in FirstOfYearSection.tsx, so the
// section's rows, heading and note render without it (NFR-07, entryChunk.test.ts).
// Stated plainly, as schema.md section 8 asks: Species Detail already loads the
// chart library through its static SightingsGraph import, so this laziness keeps
// the section's own graph free of Recharts and keeps the house shape of
// PlanChart; it does not make Recharts load later on this tab.
//
// Geometry is lib/firstOfYearChartGeometry.ts, which the section also reads to
// reserve this box before the chunk lands. The box's height is a function of
// the tier alone; its width is MEASURED here (a callback ref takes the first
// reading in the commit, before paint, and a ResizeObserver keeps it current,
// PlanChart's shape), because which year labels fit depends on the width and is
// decided in the same render that draws them (`yearLabelYears`), so there is no
// frame drawn with labels chosen for some other width.
//
// Accessibility (FR-23, NFR-01): the wrapper is `role="img"` with the one
// accessible name, which says what is charted and that the rows carry the
// dates; everything inside is `aria-hidden` and `inert`, and the chart runs
// with `accessibilityLayer={false}` so its root svg takes no tab stop. The rows
// are the complete, reachable record; this adds no information they lack.
//
// No interaction of its own (FR-25): no Tooltip, no active dot, no handlers.
// The one dynamic state, the highlighted year, is the ROW's hover or focus,
// passed in as `activeYear`; the dot renderer draws a halo and a larger dot for
// it through classes, so the radius change is a CSS transition (globals.css,
// `.sr-foy-dot`) that the app's reduced-motion block collapses. Recharts' own
// animation is off: it is JS-driven and blind to that block, and the design
// has no entrance (the box is reserved at its final size).

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from 'recharts'
import type { DotItemDotProps, XAxisTickContentProps, YAxisTickContentProps } from 'recharts'
import {
  FOY_AXIS_LANE_PX, FOY_GUTTER_PX, FOY_RIGHT_PX, FOY_TOP_PX, FOY_X_PAD_PX, FOY_Y_DOMAIN,
  firstOfYearChartHeight, firstOfYearChartMaxWidth, firstOfYearPlotHeight, firstOfYearYearPitch,
  monthTicks, segmentsOf, yearLabelYears,
  type FirstOfYearChartData, type FirstOfYearPoint,
} from '../../lib/firstOfYearChartGeometry'

/** The chart's one accessible name (design-spec.md, Interaction Notes). True on
 *  both tiers: the rows sit beside the chart wide and below it on a phone. */
const CHART_NAME = 'First of year, one point per year by day of year. The dates are listed in this section.'

/** The month labels sit right-aligned this far left of the plot. */
const MONTH_LABEL_INSET_PX = 8
/** The year labels' baseline, below the plot's bottom edge. */
const YEAR_LABEL_DROP_PX = 16

const DOT_R = 4
const LONE_DOT_R = 5
const ACTIVE_DOT_R = 6
const HALO_R = 10

export interface FirstOfYearChartProps {
  /** From `buildFirstOfYearChartData`, built once by the section. */
  data: FirstOfYearChartData
  /** The tier: false at 640px and below (`useIsPhone`). */
  wide: boolean
  /** The year whose row is hovered or focused, or null. */
  activeYear: number | null
}

export function FirstOfYearChart({ data, wide, activeYear }: FirstOfYearChartProps) {
  const height = firstOfYearChartHeight(wide)
  const plotPx = firstOfYearPlotHeight(wide)
  const yearCount = data.yearTicks.length

  const [boxEl, setBoxEl] = useState<HTMLDivElement | null>(null)
  const [width, setWidth] = useState(0)
  const boxRef = useCallback((el: HTMLDivElement | null) => {
    setBoxEl(el)
    if (el) setWidth(el.clientWidth)
  }, [])
  useEffect(() => {
    if (!boxEl || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(entries => {
      for (const e of entries) setWidth(Math.floor(e.contentRect.width))
    })
    ro.observe(boxEl)
    return () => ro.disconnect()
  }, [boxEl])

  const months = useMemo(() => monthTicks(plotPx), [plotPx])
  const monthLabel = useMemo(() => new Map(months.map(m => [m.dayOfYear, m.label])), [months])
  const connected = useMemo(() => {
    const years = new Set<number>()
    for (const [a, b] of segmentsOf(data.points)) { years.add(a); years.add(b) }
    return years
  }, [data])
  const shownYears = useMemo(
    () => new Set(yearLabelYears(data.yearTicks, firstOfYearYearPitch(width, yearCount))),
    [data, width, yearCount],
  )

  const yearLabelY = FOY_TOP_PX + plotPx + YEAR_LABEL_DROP_PX

  const renderYearTick = (p: XAxisTickContentProps): ReactNode => {
    const year = p.payload.value as number
    if (!shownYears.has(year)) return null
    return (
      <text
        className={year === activeYear ? 'sr-foy-tick is-active' : 'sr-foy-tick'}
        x={p.payload.coordinate}
        y={yearLabelY}
        textAnchor="middle"
      >
        {String(year).padStart(4, '0')}
      </text>
    )
  }

  const renderMonthTick = (p: YAxisTickContentProps): ReactNode => (
    <text
      className="sr-foy-tick"
      x={FOY_GUTTER_PX - MONTH_LABEL_INSET_PX}
      y={p.payload.coordinate}
      textAnchor="end"
      dominantBaseline="middle"
    >
      {monthLabel.get(p.payload.value as number) ?? ''}
    </text>
  )

  const renderDot = (p: DotItemDotProps): ReactNode => {
    const point = p.payload as FirstOfYearPoint | undefined
    if (p.cx == null || p.cy == null || !point || point.dayOfYear === null) return null
    const active = point.year === activeYear
    const lone = !connected.has(point.year)
    const dotClass = `sr-foy-dot${lone ? ' is-lone' : ''}${active ? ' is-active' : ''}`
    return (
      <g>
        <circle className={active ? 'sr-foy-halo is-active' : 'sr-foy-halo'} cx={p.cx} cy={p.cy} r={HALO_R} fill="none" />
        <circle className={dotClass} cx={p.cx} cy={p.cy} r={active ? ACTIVE_DOT_R : lone ? LONE_DOT_R : DOT_R} />
      </g>
    )
  }

  return (
    <div
      ref={boxRef}
      className="sr-foy-chart"
      role="img"
      aria-label={CHART_NAME}
      style={{ height, maxWidth: firstOfYearChartMaxWidth(yearCount) }}
    >
      <div aria-hidden="true" inert>
        {width > 0 && (
          <LineChart
            width={width}
            height={height}
            data={data.points}
            margin={{ top: FOY_TOP_PX, right: FOY_RIGHT_PX, bottom: 0, left: 0 }}
            accessibilityLayer={false}
          >
            <CartesianGrid vertical={false} stroke="var(--sr-border-subtle)" strokeDasharray="3 3" />
            <XAxis
              type="number"
              dataKey="year"
              domain={data.yearDomain}
              ticks={data.yearTicks}
              interval={0}
              allowDecimals={false}
              allowDataOverflow
              tickLine={false}
              axisLine={false}
              height={FOY_AXIS_LANE_PX}
              padding={{ left: FOY_X_PAD_PX, right: FOY_X_PAD_PX }}
              tick={renderYearTick}
            />
            <YAxis
              type="number"
              domain={FOY_Y_DOMAIN}
              ticks={months.map(m => m.dayOfYear)}
              interval={0}
              allowDataOverflow
              tickLine={false}
              axisLine={false}
              width={FOY_GUTTER_PX}
              tick={renderMonthTick}
            />
            <Line
              type="linear"
              dataKey="dayOfYear"
              stroke="var(--sr-graph-individuals)"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              connectNulls={false}
              dot={renderDot}
              activeDot={false}
              isAnimationActive={false}
            />
          </LineChart>
        )}
      </div>
    </div>
  )
}
