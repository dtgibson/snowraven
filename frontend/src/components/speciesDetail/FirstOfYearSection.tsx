// The First of Year card on Species Detail (species-first-of-year;
// design-spec.md). One row per calendar year with that year's first reported
// date, newest year first, each date opening its checklist on eBird through
// the shared ChecklistLink; from two years on, a compact chart of those first
// dates by day of year beside the rows on a wide screen and above them on a
// phone. The rows are the complete, keyboard-reachable record; the chart
// reinforces them and adds no information of its own (FR-23).
//
// Inputs: the rows `computeFirstOfYear` derived from the tab's own `speciesObs`
// (ascending by year), and whether a date-range filter is active. Nothing is
// fetched, stored, cached or read from a clock here: the current year is an
// ordinary row (FR-07, FR-14).
//
// States (FR-10, FR-11, FR-18): zero rows renders nothing at all, not even the
// card; one row renders the heading and that row and no chart, placeholder or
// sentence; two or more render the chart slot as well.
//
// The chart is lazy, and its box is reserved before the chunk lands: the
// Suspense fallback is an empty box at the SAME height and max width the chart
// takes, both read from lib/firstOfYearChartGeometry.ts, so nothing on the page
// moves when it arrives (FR-24). The fallback carries no role: it is empty, and
// the accessible name arrives with the chart.
//
// Row hover and keyboard focus light that year's point (design-spec.md,
// Interaction Notes). The state lives here, on the ROWS, and reaches the chart
// as a prop; the chart keeps no handlers and no tab stops (FR-25). Hover takes
// precedence over focus, so a pointer passing over other rows never clears the
// year the keyboard is on.

import { Suspense, lazy, useMemo, useState } from 'react'
import { CalendarDays } from 'lucide-react'
import { ChecklistLink } from '../ChecklistLink'
import { SectionCard, SectionHead } from './ui'
import { formatDate } from '../../lib/formatDate'
import { useIsPhone } from '../../lib/useIsPhone'
import type { FirstOfYearRow } from '../../lib/firstOfYear'
import {
  FOY_CHART_MIN_ROWS, buildFirstOfYearChartData, firstOfYearChartHeight, firstOfYearChartMaxWidth,
} from '../../lib/firstOfYearChartGeometry'

const FirstOfYearChart = lazy(
  () => import('./FirstOfYearChart').then(m => ({ default: m.FirstOfYearChart })),
)

/** The card's title, in every state (FR-16). */
const HEADING = 'First of Year'
/** Shown only while a date-range filter is set, so the heading stays true:
 *  under a range starting in March, a year's "first" is its first date in it. */
const DATE_RANGE_NOTE = 'First dates within the selected date range.'

/** The row's date style: the card's 0.8125rem / 600 register, tabular figures. */
const DATE_STYLE = { fontSize: '0.8125rem', fontWeight: 600, fontVariantNumeric: 'tabular-nums' } as const

export interface FirstOfYearSectionProps {
  /** Ascending by year, as `computeFirstOfYear` returns them. */
  rows: readonly FirstOfYearRow[]
  /** True while the tab's date-range filter has a From or To date. */
  dateRangeActive: boolean
}

export function FirstOfYearSection({ rows, dateRangeActive }: FirstOfYearSectionProps) {
  const wide = !useIsPhone()
  const [hoverYear, setHoverYear] = useState<number | null>(null)
  const [focusYear, setFocusYear] = useState<number | null>(null)

  const newestFirst = useMemo(() => [...rows].reverse(), [rows])
  const chartData = useMemo(
    () => (rows.length >= FOY_CHART_MIN_ROWS ? buildFirstOfYearChartData(rows) : null),
    [rows],
  )

  if (rows.length === 0) return null

  const activeYear = hoverYear ?? focusYear
  const chartBox = chartData
    ? { height: firstOfYearChartHeight(wide), maxWidth: firstOfYearChartMaxWidth(chartData.yearTicks.length) }
    : null

  return (
    <SectionCard>
      <SectionHead icon={<CalendarDays size={14} strokeWidth={2.2} />} title={HEADING} />
      <div style={{ padding: '16px 18px' }}>
        {dateRangeActive && <p className="sr-foy-note">{DATE_RANGE_NOTE}</p>}
        <div className={chartData ? 'sr-foy-grid' : 'sr-foy-grid sr-foy-grid--rows-only'}>
          {chartData && chartBox && (
            <Suspense fallback={<div className="sr-foy-chart" style={chartBox} />}>
              <FirstOfYearChart data={chartData} wide={wide} activeYear={activeYear} />
            </Suspense>
          )}
          <ul role="list" className="sr-foy-list">
            {newestFirst.map(r => (
              <li
                key={r.year}
                className="sr-foy-row"
                onMouseEnter={() => setHoverYear(r.year)}
                onMouseLeave={() => setHoverYear(null)}
                onFocus={() => setFocusYear(r.year)}
                onBlur={() => setFocusYear(null)}
              >
                {/* The four characters the year was read from (FR-04, FR-12). */}
                <span className="sr-foy-year">{r.date.slice(0, 4)}</span>
                {/* formatDate returns '' for a year-0000 date, which is well formed here; the raw string keeps the link labeled. */}
                <ChecklistLink submissionId={r.submissionId} label={formatDate(r.date) || r.date} size="sm" style={DATE_STYLE} />
              </li>
            ))}
          </ul>
        </div>
      </div>
    </SectionCard>
  )
}
