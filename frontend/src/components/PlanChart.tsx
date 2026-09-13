// The Weather/tide Planner's chart (design-spec.md, "The chart", "Moving along
// the axis"): one uniform real-elapsed-time track, scrolling sideways inside
// its own box, with the tide curve, a night band per span, sunrise/sunset and
// high/low markers, the "Now" hairline, the axis lane and the weather strip.
// Two tiers share this one component and one document: the phone tier at
// PLAN_HOUR_PX with the approved lanes, the wide tier (641px and up) with a
// day-header lane, a taller plot, and pixels per hour chosen so the "Days in
// view" span fills the box, measured from the box with a ResizeObserver.
//
// The plot is Recharts; the day-header lane, the axis lane, the strip and the
// sticky tide scale are HTML siblings positioned by the SAME x(t) the chart's
// numeric axis uses (lib/planChartGeometry.ts). The density rules that follow
// from the pixels per hour are pure functions there; this file only applies
// them. The curve is always the document's 30-minute samples.
//
// THE ONLY MODULE IN THIS FEATURE THAT IMPORTS RECHARTS, reached only through
// `lazy(() => import('./PlanChart'))` in WeatherForecastPanel so the chart
// library stays off the entry chunk (entryChunk.test.ts). It draws from `Plan`
// only: every instant is an integer epoch second placed by arithmetic, every
// local string was computed by the composer, and nothing here converts a
// timezone or computes a sunrise (schema section 13, item 1).
//
// Moving along the axis (D4-12): a mouse drag follows the pointer one to one
// under pointer capture, with no threshold, no easing, no snapping and no
// post-release motion; touch, wheel and arrow keys stay native; the day
// buttons in the result's legend row scroll by one day's width through the
// imperative handle below.
//
// Accessibility: the SCROLL CONTAINER is the one tab stop, carrying role="img",
// the accessible name and tabIndex 0, so arrow keys scroll it; everything
// inside is aria-hidden and inert (the house rule for decorative recharts,
// whose root svg would otherwise stay focusable). The list beside it carries
// every figure as text.
//
// Chart text is px on purpose (D4-09): the chart is a fixed-px track and every
// figure it labels is repeated in the list at rem sizes, which follow the
// in-app text scale.

import { forwardRef, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState } from 'react'
import { ComposedChart, Line, ReferenceArea, ReferenceDot, ReferenceLine, XAxis, YAxis } from 'recharts'
import type { Plan, PlanDay } from '../lib/plan'
import { PLAN_COPY } from '../lib/planCopy'
import { clockOf, ftSigned, weekdayOf } from '../lib/planFormat'
import { formatDate } from '../lib/formatDate'
import type { PlanDaysInView } from '../lib/planDaysInView'
import {
  PLAN_GUTTER_PX, PLAN_LABEL_LANE_PX,
  planGeometry, planHourPxFor, planGlyphEvery, planFullEventLabel, planTickHours, planDayLabel,
  planDailyCellMode, planHourlyCellMode, planHourlyTagMode, planDailyTagMode, planStripCells,
  type PlanGeometry,
} from '../lib/planChartGeometry'

export interface PlanNavState {
  /** The whole track fits the box: nothing to scroll. */
  fits: boolean
  atStart: boolean
  atEnd: boolean
}

export interface PlanChartHandle {
  /** Scroll by one day's width in the given direction (smooth, or instant
   *  under reduced motion). */
  scrollByDay(dir: -1 | 1): void
}

export interface PlanChartProps {
  plan: Plan
  place: string
  /** The wide tier (641px and up): the day-header lane, the taller plot and
   *  the Days in view choice. Phones pass false and get the approved layout. */
  wide?: boolean
  daysInView?: PlanDaysInView
  /** Reported on scroll and after every layout, for the day buttons. */
  onNav?: (state: PlanNavState) => void
}

// ── marker shapes (drawn by ReferenceDot at the chart's own cx/cy) ───────────

interface ShapeProps { cx?: number; cy?: number }

function HighLowShape({ cx = 0, cy = 0, kind, label }: ShapeProps & { kind: 'high' | 'low'; label: string }) {
  return (
    <g>
      {kind === 'high'
        ? <circle cx={cx} cy={cy} r={4.5} fill="var(--sr-plan-tide)" stroke="var(--sr-plan-halo)" strokeWidth={1.5} />
        : <circle cx={cx} cy={cy} r={4.5} fill="var(--sr-plan-halo)" stroke="var(--sr-plan-tide)" strokeWidth={2} />}
      <text x={cx} y={kind === 'high' ? cy - 8 : cy + 15} textAnchor="middle" className="sr-plan-cx-lbl sr-plan-cx-hl">{label}</text>
    </g>
  )
}

function SunShape({ cx = 0, cy = 0, kind, label }: ShapeProps & { kind: 'sunrise' | 'sunset'; label: string }) {
  const tri = kind === 'sunrise'
    ? `${cx},${cy - 6.5} ${cx - 6},${cy + 4} ${cx + 6},${cy + 4}`
    : `${cx},${cy + 6.5} ${cx - 6},${cy - 4} ${cx + 6},${cy - 4}`
  return (
    <g>
      <line x1={cx} x2={cx} y1={PLAN_LABEL_LANE_PX + 2} y2={cy - 7} stroke="var(--sr-plan-sun)" strokeWidth={1} strokeDasharray="2 2" opacity={0.85} />
      <polygon
        points={tri}
        fill={kind === 'sunrise' ? 'var(--sr-plan-halo)' : 'var(--sr-plan-sun)'}
        stroke={kind === 'sunrise' ? 'var(--sr-plan-sun)' : 'var(--sr-plan-halo)'}
        strokeWidth={kind === 'sunrise' ? 2 : 1.5}
        strokeLinejoin="round"
      />
      <text x={cx} y={PLAN_LABEL_LANE_PX - 9} textAnchor="middle" className="sr-plan-cx-lbl sr-plan-cx-evt">{label}</text>
    </g>
  )
}

function NowLabel({ viewBox }: { viewBox?: { x?: number } }) {
  return <text x={(viewBox?.x ?? 0) + 4} y={PLAN_LABEL_LANE_PX + 11} className="sr-plan-cx-lbl">{PLAN_COPY.nowLabel}</text>
}

// ── day labels, shared by the wide header lane and the phone axis lane ───────

function dayLabelFor(d: PlanDay, g: PlanGeometry, wide: boolean): string {
  const full = formatDate(d.date, { withWeekday: true })
  if (!wide) return full
  const left = Math.max(g.x(d.startTs), PLAN_GUTTER_PX)
  const dayW = g.x(Math.min(d.endTs + 1, g.axisEnd)) - left
  const weekday = weekdayOf(d.date)
  return planDayLabel(full, `${weekday} ${Number(d.date.slice(8, 10))}`, weekday, dayW)
}

/** The day-header lane (wide tier): a subtle band with each day's label at
 *  its midnight, the midnight hairline running down through the label lane. */
function DayHeaderLane({ plan, g }: { plan: Plan; g: PlanGeometry }) {
  return (
    <div className="sr-plan-dayhdr" style={{ width: g.width, height: g.lanes.dayHeader }}>
      {plan.days.map((d, i) => {
        const left = Math.max(g.x(d.startTs), 0)
        const labelLeft = Math.max(g.x(d.startTs), PLAN_GUTTER_PX) + 5
        const right = g.x(Math.min(d.endTs + 1, g.axisEnd))
        const text = dayLabelFor(d, g, true)
        return (
          <div key={i} className="sr-plan-dayhdr-day" style={{ left, width: Math.max(0, right - left) }}>
            {d.startTs >= g.axisStart && <span className="sr-plan-midnight sr-plan-midnight-hdr" style={{ height: g.lanes.dayHeader + g.lanes.labels }} />}
            {text && <span className="sr-plan-dayhdr-lbl" style={{ left: labelLeft - left }}>{text}</span>}
          </div>
        )
      })}
    </div>
  )
}

// ── the axis lane: hour ticks, and on phones the day labels too ──────────────

const TICK_TEXT: Record<number, string> = { 6: '6 AM', 12: 'Noon', 18: '6 PM' }

function AxisLane({ plan, g, wide }: { plan: Plan; g: PlanGeometry; wide: boolean }) {
  const ticks = planTickHours(g.hpx)
  return (
    <div className={`sr-plan-axislane${wide ? ' sr-plan-axislane-wide' : ''}`} style={{ width: g.width, height: g.lanes.axis }}>
      {plan.days.map((d: PlanDay, i) => {
        // A day that gains or loses an hour changes its clock at 02:00 in every
        // US zone, so a local hour after that sits (length - 86400) seconds
        // further along the real axis than on a plain day. Arithmetic on the
        // document's own day boundaries, never a timezone conversion.
        const shift = (d.endTs - d.startTs + 1) - 86400
        const left = Math.max(g.x(d.startTs), 0)
        return (
          <div key={i} className="sr-plan-axisday" style={{ left }}>
            {d.startTs >= g.axisStart && <span className="sr-plan-midnight" />}
            {!wide && (
              <span className="sr-plan-daylabel" style={{ left: Math.max(g.x(d.startTs), PLAN_GUTTER_PX) - left + 5 }}>
                {dayLabelFor(d, g, false)}
              </span>
            )}
            {ticks.map(hh => {
              const t = d.startTs + hh * 3600 + (hh > 2 ? shift : 0)
              if (t < g.axisStart + 1800 || t >= g.axisEnd) return null
              return (
                <span key={hh} className="sr-plan-tick" style={{ left: g.x(t) - left }}>
                  <span className="sr-plan-tickmark" />
                  <span className="sr-plan-ticktext">{TICK_TEXT[hh]}</span>
                </span>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}

// ── the weather strip, density-aware ────────────────────────────────────────

function Strip({ plan, g, wide }: { plan: Plan; g: PlanGeometry; wide: boolean }) {
  // The density modes are the wide tier's; the phone tier renders every cell
  // as the approved design does, byte for byte.
  const glyphEvery = wide ? planGlyphEvery(g.hpx) : 1
  const cells = planStripCells(plan.cells, glyphEvery)
  const hourly = cells.filter(c => c.resolution === 'hourly')
  const firstDaily = cells.find(c => c.resolution === 'daily')
  const firstDailyLeft = firstDaily ? g.x(firstDaily.startTs) : null
  const firstDailyW = firstDaily ? g.x(firstDaily.endTs + 1) - g.x(firstDaily.startTs) : 0
  const hourlySpan = hourly.length > 0 ? g.x(hourly[hourly.length - 1].endTs + 1) - g.x(hourly[0].startTs) : 0
  const hourlyTag = (() => {
    switch (planHourlyTagMode(glyphEvery, hourlySpan)) {
      case 'full': return PLAN_COPY.stripHourlyTag
      case 'every': return PLAN_COPY.stripHourlyEvery(glyphEvery)
      case 'short': return PLAN_COPY.stripHourlyShort(glyphEvery)
      default: return PLAN_COPY.stripHourlyMin
    }
  })()
  return (
    <div className="sr-plan-strip" style={{ width: g.width, height: g.lanes.strip }}>
      {cells.map((c, i) => {
        const left = g.x(c.startTs)
        const width = g.x(c.endTs + 1) - left
        if (c.resolution === 'hourly') {
          const mode = wide ? planHourlyCellMode(width, g.hpx) : 'emoji'
          return (
            <div key={i} className="sr-plan-cell hourly" style={{ left, width }} title={`${clockOf(c.local)} ${c.weather.description}`}>
              {mode === 'temp' && <><span>{c.weather.emoji}</span><span className="sr-plan-cell-tmp">{c.weather.tempF}°</span></>}
              {mode === 'emoji' && c.weather.emoji}
            </div>
          )
        }
        const mode = wide ? planDailyCellMode(width) : 'full'
        const hl = c.weather.highF !== null && c.weather.lowF !== null ? `H ${c.weather.highF}° L ${c.weather.lowF}°` : ''
        return (
          <div key={i} className="sr-plan-cell daily" style={{ left, width }} title={wide ? (hl ? `${c.weather.description} · ${hl}` : c.weather.description) : undefined}>
            <span className="sr-plan-cell-em">{c.weather.emoji}</span>
            {mode === 'full' && <span><b>{c.weather.description}</b>{hl && <span className="sr-plan-cell-hl"> · {hl}</span>}</span>}
            {mode === 'hl' && hl && <span className="sr-plan-cell-hl">{hl}</span>}
          </div>
        )
      })}
      {hourly.length > 0 && <span className="sr-plan-tag" style={{ left: 4 }}>{hourlyTag}</span>}
      {firstDailyLeft !== null && (
        <span className="sr-plan-tag daily" style={{ left: firstDailyLeft + 4 }}>
          {!wide || planDailyTagMode(firstDailyW) === 'full' ? PLAN_COPY.stripDailyTag : PLAN_COPY.stripDailyShort}
        </span>
      )}
    </div>
  )
}

// ── the chart ────────────────────────────────────────────────────────────────

const reducedMotion = (): boolean =>
  typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

export const PlanChart = forwardRef<PlanChartHandle, PlanChartProps>(function PlanChart(
  { plan, place, wide = false, daysInView = 'all', onNav }, ref,
) {
  const hasTide = plan.tide?.status === 'ok'
  const tide = hasTide && plan.tide?.status === 'ok' ? plan.tide : null

  // The box is measured, never assumed: the wide tier's pixels per hour follow
  // its width, so the element is held as STATE through a callback ref that also
  // takes the first measurement in the commit phase (before paint, so the first
  // wide frame is already at the measured scale), and a ResizeObserver keeps it
  // current afterwards.
  const [boxEl, setBoxEl] = useState<HTMLDivElement | null>(null)
  const [boxWidth, setBoxWidth] = useState(0)
  const boxRef = useCallback((el: HTMLDivElement | null) => {
    setBoxEl(el)
    if (el) setBoxWidth(el.clientWidth)
  }, [])
  useEffect(() => {
    if (!wide || !boxEl || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(entries => {
      for (const e of entries) setBoxWidth(Math.floor(e.contentRect.width))
    })
    ro.observe(boxEl)
    return () => ro.disconnect()
  }, [wide, boxEl])

  const hpx = planHourPxFor(plan, wide, daysInView, boxWidth)
  const g = planGeometry(plan, hasTide, hpx, wide)
  const curve = tide ? tide.curve.map(s => ({ t: s.t, v: s.v })) : []
  const base = g.yMin
  const start = formatDate(plan.window.startLocal, { withWeekday: true, withTime: true })
  const end = formatDate(plan.window.endLocal, { withWeekday: true, withTime: true })
  const name = hasTide ? PLAN_COPY.chartNameWithTide(place, start, end) : PLAN_COPY.chartNameNoTide(place, start, end)
  const fullLabel = planFullEventLabel(hpx)

  const scrollerRef = useRef<HTMLDivElement | null>(null)
  const [atEnd, setAtEnd] = useState(false)
  const drag = useRef<{ x: number; left: number; id: number } | null>(null)
  const onNavRef = useRef(onNav)
  useEffect(() => { onNavRef.current = onNav }, [onNav])
  const prevHpx = useRef<number | null>(null)

  const report = (el: HTMLDivElement) => {
    const fits = el.scrollWidth <= el.clientWidth + 1
    setAtEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 2)
    onNavRef.current?.({ fits, atStart: fits || el.scrollLeft <= 0, atEnd: fits || el.scrollLeft + el.clientWidth >= el.scrollWidth - 1 })
  }

  // A change of pixels per hour keeps the instant at the box's left edge in
  // place, so a closer view zooms into where the reader was looking.
  useLayoutEffect(() => {
    const el = scrollerRef.current
    if (!el) return
    const prev = prevHpx.current
    if (prev !== null && prev !== hpx) {
      const tLeft = g.axisStart + (el.scrollLeft / prev) * 3600
      el.scrollLeft = (tLeft - g.axisStart) / 3600 * hpx
    }
    prevHpx.current = hpx
    report(el)
    // `report` reads the live element and writes state; it is re-run per layout.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hpx, plan, wide])

  useEffect(() => {
    const el = scrollerRef.current
    if (!el) return
    const onScroll = () => report(el)
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [plan])

  useImperativeHandle(ref, () => ({
    scrollByDay(dir) {
      const el = scrollerRef.current
      if (!el) return
      const left = dir * 24 * hpx
      if (typeof el.scrollBy === 'function') el.scrollBy({ left, behavior: reducedMotion() ? 'auto' : 'smooth' })
      else el.scrollLeft += left
    },
  }), [hpx])

  // One-to-one mouse drag under pointer capture (D4-12): no threshold, no
  // easing, no snapping, nothing after release.
  const endDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!drag.current) return
    drag.current = null
    e.currentTarget.classList.remove('is-dragging')
  }

  const gridlines: number[] = []
  if (tide) for (let v = Math.ceil(g.yMin); v <= Math.floor(g.yMax); v += 2) gridlines.push(v)
  const domainStart = g.axisStart - PLAN_GUTTER_PX * g.secPerPx

  return (
    <div ref={boxRef} className={`sr-plan-chartbox${atEnd ? ' at-end' : ''}${wide ? ' sr-plan-chartbox-wide' : ''}`} style={{ height: g.lanes.dayHeader + g.chartH + g.lanes.axis + g.lanes.strip }}>
      <div
        ref={scrollerRef}
        className="sr-plan-scroller"
        role="img"
        aria-label={name}
        tabIndex={0}
        onPointerDown={e => {
          if (e.pointerType !== 'mouse' || e.button !== 0) return
          const el = e.currentTarget
          if (typeof el.setPointerCapture === 'function') el.setPointerCapture(e.pointerId)
          drag.current = { x: e.clientX, left: el.scrollLeft, id: e.pointerId }
          el.classList.add('is-dragging')
        }}
        onPointerMove={e => {
          if (!drag.current) return
          e.currentTarget.scrollLeft = drag.current.left - (e.clientX - drag.current.x)
        }}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onLostPointerCapture={endDrag}
      >
        <div className="sr-plan-canvas" aria-hidden="true" inert style={{ width: g.width }}>
          {wide && <DayHeaderLane plan={plan} g={g} />}
          <ComposedChart
            width={g.width}
            height={g.chartH}
            data={curve}
            margin={{ top: g.lanes.labels, right: 0, bottom: 0, left: 0 }}
            accessibilityLayer={false}
          >
            <XAxis type="number" dataKey="t" domain={[domainStart, g.axisEnd]} hide allowDataOverflow />
            <YAxis type="number" domain={[g.yMin, g.yMax]} hide allowDataOverflow />
            <ReferenceArea x1={domainStart} x2={g.axisEnd} fill="var(--sr-plan-day)" fillOpacity={1} stroke="none" ifOverflow="visible" />
            {plan.nightSpans.map((n, i) => (
              <ReferenceArea key={i} x1={n.startTs} x2={n.endTs} fill="var(--sr-plan-night)" fillOpacity={1} stroke="none" ifOverflow="visible" />
            ))}
            {gridlines.map(v => (
              <ReferenceLine key={v} y={v} stroke="rgba(var(--sr-plan-grid-rgb),0.16)" strokeWidth={1} ifOverflow="visible" />
            ))}
            {plan.days.map((d, i) => d.startTs >= g.axisStart && (
              <ReferenceLine key={`m${i}`} x={d.startTs} stroke="var(--sr-border-medium)" strokeWidth={1} ifOverflow="visible" />
            ))}
            <ReferenceLine x={plan.fetchedAt} stroke="var(--sr-text)" strokeWidth={1} strokeDasharray="2 3" strokeOpacity={0.7} ifOverflow="visible" label={<NowLabel />} />
            <ReferenceLine y={base} stroke="var(--sr-border-medium)" strokeWidth={1} ifOverflow="visible" />
            {tide && (
              <Line type="linear" dataKey="v" stroke="var(--sr-plan-tide)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" dot={false} activeDot={false} isAnimationActive={false} />
            )}
            {tide && tide.turningPoints.map((p, i) => (
              <ReferenceDot key={`tp${i}`} x={p.t} y={p.v} r={0} ifOverflow="visible" shape={(s: ShapeProps) => <HighLowShape cx={s.cx} cy={s.cy} kind={p.kind} label={`${p.kind === 'high' ? 'H' : 'L'} ${ftSigned(p.v)}`} />} />
            ))}
            {plan.events.map((e, i) => (
              <ReferenceDot
                key={`ev${i}`}
                x={e.t}
                y={tide && e.tide && e.tide.heightFt !== null ? e.tide.heightFt : base}
                r={0}
                ifOverflow="visible"
                shape={(s: ShapeProps) => (
                  <SunShape cx={s.cx} cy={s.cy} kind={e.kind} label={fullLabel ? `${e.kind === 'sunrise' ? PLAN_COPY.sunrise : PLAN_COPY.sunset} ${clockOf(e.local)}` : clockOf(e.local)} />
                )}
              />
            ))}
          </ComposedChart>
          <AxisLane plan={plan} g={g} wide={wide} />
          <Strip plan={plan} g={g} wide={wide} />
        </div>
      </div>
      {tide && (
        <div className="sr-plan-yaxis" aria-hidden="true" style={wide ? { top: g.lanes.dayHeader, height: g.chartH, width: PLAN_GUTTER_PX } : { height: g.chartH, width: PLAN_GUTTER_PX }}>
          {gridlines.map(v => (
            <span key={v} style={{ top: g.y(v) }}>{String(v).replace('-', '−')}{v + 2 > Math.floor(g.yMax) ? ' ft' : ''}</span>
          ))}
          <span className="sr-plan-yaxis-unit" style={{ top: g.y(0) + 6 }}>MLLW</span>
        </div>
      )}
    </div>
  )
})
