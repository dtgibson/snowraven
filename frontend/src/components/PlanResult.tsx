// The Weather/tide Planner's result region (design-spec.md; plan-sun-moon-
// readout): the header, the replay cue, the one tide notice, the chart slot,
// the legend, the picked-moment READOUT, the day-by-day divider, the per-day
// list and the closing note. A STATIC import in WeatherForecastPanel, so it
// renders the figures the moment the plan arrives; the chart arrives through
// the lazy slot the panel passes in and never delays the list (NFR-03).
//
// The list is the plan's accessible form and its phone form: real list
// semantics, one item per event carrying every figure as text, every strip
// cell reaching it through the per-day sky line (FR-27), and since 1.0.30 each
// day's moon phase and the sun's highest point (FR-34, FR-35). Every item gets
// the same treatment whatever its values (FR-50 / FR-44). A pick changes
// nothing in the list (FR-18): the list is a memo whose props are stable
// across a pick.
//
// The pick lives HERE (schema 6.4): the readout block must render at rest
// before the chart chunk lands, and the pick must survive the override (the
// panel replaces the composed plan but keeps this region mounted). It resets
// with the plan's identity (fetch instant, place, zone), which the override
// leaves identical and a fresh plan changes.
//
// Nothing here computes a sunrise or a day boundary: the document carries
// them. The picked minute's clock and the sun-peak instant are converted in
// lib/planReadout.ts and lib/planSun.ts through the producers' own twin helper
// (schema section 5); every other local string still comes from the document.
// DOM ids are useId()-based, keyed on nothing from the document (NFR-01).

import { Suspense, memo, useCallback, useId, useMemo, useRef, useState, type ComponentType, type ReactNode, type RefAttributes } from 'react'
import { Sunrise, Sunset, Waves, ChevronDown, ChevronsLeftRight, ChevronLeft, ChevronRight, CalendarDays, Loader2, AlertCircle } from 'lucide-react'
import { Button } from './ui/Button'
import { useIsPhone } from '../lib/useIsPhone'
import { planChartHeight } from '../lib/planChartGeometry'
import { planDaysInViewOptions, type PlanDaysInView } from '../lib/planDaysInView'
import type { PlanChartHandle, PlanChartProps, PlanNavState } from './PlanChart'
import { StalenessCue, OfflineMessage } from './OfflineMessage'
import { OFFLINE_MESSAGE, NO_KEY_MESSAGE, type LiveErrorKind } from '../lib/offlineMessage'
import { tideTooFarNotice, tideOverrideLabel } from '../lib/tideNotice'
import { formatDate } from '../lib/formatDate'
import { PLAN_COPY } from '../lib/planCopy'
import { clockOf, hourOf, ftSigned, weekdayOf } from '../lib/planFormat'
import type { Plan, PlanCell, PlanDay, PlanEvent, PlanWeather, Bracket } from '../lib/plan'
import { buildSunModel, sunAltitudeAt, sunPeakByDay, type SunModel, type SunPeak } from '../lib/planSun'
import { moonForDay, type MoonForDay } from '../lib/planMoon'
import { planReadoutAt, readoutValueText, readoutWhen, safeLocalClock, trendWord, type PlanReadout } from '../lib/planReadout'

export interface PlanResultProps {
  plan: Plan
  place: string
  /** The replay entry's loadedAt when the plan was re-shown offline; else null. */
  replayedAt: number | null
  /** The tide half failed at the transport (offline / no-key / error) while the
   *  weather half arrived; the plan renders and the tide slot says why. */
  tideErrKind: LiveErrorKind | null
  overriding: boolean
  onOverride: () => void
  /** The chart component, lazy-loaded by the panel (the dynamic import lives
   *  there, so the chart library stays off the entry chunk); rendered here
   *  inside a Suspense whose fallback reserves the chart's exact height. */
  ChartComponent: ComponentType<PlanChartProps & RefAttributes<PlanChartHandle>>
  /** The Days in view choice, owned and persisted by the panel. */
  daysInView: PlanDaysInView
  onDaysInViewChange: (v: PlanDaysInView) => void
}

const Mid = () => <span className="sr-plan-mut"> · </span>

function WeatherLine({ w }: { w: PlanWeather }) {
  return (
    <div className="sr-plan-ev-wx">
      <span className="sr-plan-em" aria-hidden="true">{w.emoji}</span>
      {w.description}, <b>{w.tempF}°F</b>
      {w.resolution === 'daily' && w.highF !== null && w.lowF !== null && <span className="sr-plan-mut"> (H {w.highF}° · L {w.lowF}°)</span>}
      <Mid />{PLAN_COPY.windLabel} <b>{w.windDesc}, {w.windDir}</b>
      <Mid />{PLAN_COPY.humidityLabel} <b>{w.humidityPct}%</b>
      <Mid />{PLAN_COPY.dewPointLabel} <b>{w.dewPointF}°F</b>
      <Mid />{PLAN_COPY.cloudLabel} <b>{w.cloudsPct}%</b>
    </div>
  )
}

function bracketText(ev: PlanEvent): string {
  const t = ev.tide
  if (!t) return PLAN_COPY.bracketNone
  const when = (b: Bracket) => `${clockOf(b.local)}${b.local.slice(0, 10) !== ev.local.slice(0, 10) ? ` ${weekdayOf(b.local)}` : ''}`
  const side = (b: Bracket) => PLAN_COPY.bracketSide(b.kind, ftSigned(b.heightFt), when(b))
  if (t.prev && t.next) return PLAN_COPY.bracketBetween(side(t.prev), side(t.next))
  if (t.prev) return PLAN_COPY.bracketAfter(side(t.prev))
  if (t.next) return PLAN_COPY.bracketBefore(side(t.next))
  return PLAN_COPY.bracketNone
}

function TideLine({ ev }: { ev: PlanEvent }) {
  const t = ev.tide
  if (!t) return null
  if (t.heightFt === null) {
    return <div className="sr-plan-ev-tide">Tide: <span className="sr-plan-mut">{bracketText(ev)}</span></div>
  }
  return (
    <div className="sr-plan-ev-tide">
      Tide <b>{ftSigned(t.heightFt)} ft</b>, {trendWord(t)} <span className="sr-plan-mut">· {bracketText(ev)}</span>
    </div>
  )
}

function EventItem({ ev, dayLabel }: { ev: PlanEvent; dayLabel: string }) {
  const kind = ev.kind === 'sunrise' ? PLAN_COPY.sunrise : PLAN_COPY.sunset
  const Icon = ev.kind === 'sunrise' ? Sunrise : Sunset
  return (
    <li className="sr-plan-ev">
      <span className="sr-plan-ev-ic" aria-hidden="true"><Icon size={16} strokeWidth={2.2} /></span>
      <div className="sr-min0">
        <div className="sr-plan-ev-top">
          <span className="sr-plan-ev-kind">{kind}</span>
          <span className="sr-plan-ev-time">{clockOf(ev.local)}</span>
          <span className="sr-only">, {dayLabel}</span>
          <span className="sr-plan-ev-res">{ev.weather.resolution === 'daily' ? PLAN_COPY.dailyLabel : PLAN_COPY.hourlyLabel}</span>
        </div>
        <TideLine ev={ev} />
        <WeatherLine w={ev.weather} />
      </div>
    </li>
  )
}

/** The per-day sky line: how every strip cell reaches the list as text. */
function SkyLine({ day, cells }: { day: PlanDay; cells: PlanCell[] }) {
  const hourly = cells.filter(c => c.resolution === 'hourly' && c.local.slice(0, 10) === day.date)
  const daily = cells.find(c => c.resolution === 'daily' && c.startTs >= day.startTs && c.startTs <= day.endTs)
  if (hourly.length > 0) {
    return (
      <details className="sr-plan-hours">
        <summary>{PLAN_COPY.skySummary(hourly.length)} <ChevronDown size={13} strokeWidth={2.4} aria-hidden="true" /></summary>
        <p>
          {hourly.map((c, i) => (
            <span key={i}>
              {i > 0 && <span aria-hidden="true"> · </span>}
              {/* Only the glyph and its clock stay together; the description
                  wraps like any other text, so the paragraph fits its column at
                  320px and 200% text scale (QA-28). */}
              <span className="sr-plan-nowrap"><span aria-hidden="true">{c.weather.emoji}</span> {hourOf(c.local)}</span> {c.weather.description}
            </span>
          ))}
          {daily && daily.startTs > day.startTs && (
            <span>
              <span aria-hidden="true"> · </span>
              <span className="sr-plan-nowrap"><span aria-hidden="true">{daily.weather.emoji}</span> from {clockOf(daily.local)}</span> {daily.weather.description} (daily)
            </span>
          )}
        </p>
      </details>
    )
  }
  if (daily) {
    return (
      <p className="sr-plan-sky">
        <span className="sr-plan-em" aria-hidden="true">{daily.weather.emoji}</span>
        {PLAN_COPY.daySky(daily.weather.description, daily.weather.highF, daily.weather.lowF)}
        {' '}<span className="sr-plan-ev-res sr-plan-ev-res-inline">{PLAN_COPY.dailyLabel}</span>
      </p>
    )
  }
  return null
}

/**
 * The per-day tides line (FR-27 / QA-26): every high and low the chart draws
 * on this day, with its height and time in the location's clock, so the set
 * of turning points in the list equals the set drawn. The brackets on each
 * event name only the two turning points around it; a night with three
 * turning points between a sunset and the next sunrise would otherwise reach
 * the list nowhere. Same vocabulary as the brackets.
 */
function TidesLine({ day, tide }: { day: PlanDay; tide: Plan['tide'] }) {
  if (!tide || tide.status !== 'ok') return null
  const points = tide.turningPoints.filter(p => p.t >= day.startTs && p.t <= day.endTs)
  if (points.length === 0) return null
  return (
    <p className="sr-plan-tides">
      {PLAN_COPY.tidesPrefix}
      {points.map((p, i) => (
        <span key={i}>
          {i > 0 && <span aria-hidden="true"> · </span>}
          <span className="sr-plan-tide-pt">{PLAN_COPY.bracketSide(p.kind, ftSigned(p.v), clockOf(p.local))}</span>
        </span>
      ))}
    </p>
  )
}

/** A copy string with its named values set in ink (the tides line's register). */
function emphasize(text: string, values: string[]): ReactNode[] {
  const out: ReactNode[] = []
  let rest = text
  let k = 0
  while (rest.length > 0) {
    let at = -1, which = ''
    for (const v of values) {
      if (!v) continue
      const i = rest.indexOf(v)
      if (i !== -1 && (at === -1 || i < at)) { at = i; which = v }
    }
    if (at === -1) { out.push(rest); break }
    if (at > 0) out.push(rest.slice(0, at))
    out.push(<b key={k++}>{which}</b>)
    rest = rest.slice(at + which.length)
  }
  return out
}

/**
 * The day-facts line (design, "The per-day list"): the moon phase (the glyph
 * is presentational; the name is what is read) and the sun's highest point
 * that day, from the same anchored curve the track draws. On the first day,
 * when solar noon is already behind Now, the clause says so and gives the
 * height at Now rather than naming a past moment (D4-08). A day the sun model
 * could not sample carries the moon alone.
 */
function DayFacts({ moon, sunClause }: { moon: MoonForDay | null; sunClause: { text: string; values: string[] } | null }) {
  if (!moon && !sunClause) return null
  return (
    <p className="sr-plan-dayfacts">
      {moon && <><span className="sr-plan-em" aria-hidden="true">{moon.glyph}</span><b>{moon.name}</b></>}
      {moon && sunClause && <> <span aria-hidden="true">·</span> </>}
      {sunClause && emphasize(sunClause.text, sunClause.values)}
    </p>
  )
}

function sunClauseFor(plan: Plan, model: SunModel | null, peak: SunPeak | null, dayIndex: number): { text: string; values: string[] } | null {
  if (!model || !peak) return null
  if (dayIndex === 0 && peak.t <= plan.fetchedAt) {
    const local = safeLocalClock(plan.fetchedAt, plan.tz)
    if (!local) return null
    const time = clockOf(local)
    const n = Math.round(sunAltitudeAt(model, plan.fetchedAt))
    return { text: PLAN_COPY.sunPast(time, n), values: [time, `${Math.abs(n)}°`] }
  }
  const local = safeLocalClock(peak.t, plan.tz)
  if (!local) return null
  const time = clockOf(local)
  const n = Math.round(peak.deg)
  return { text: PLAN_COPY.sunPeak(time, n), values: [time, `${Math.abs(n)}°`] }
}

/** The per-day list. A memo on props that are stable across a pick, so a
 *  pick re-renders none of it (FR-18, NFR-03). */
const DayList = memo(function DayList({ plan, labelledBy, sunModel, moons, peaks }: {
  plan: Plan
  labelledBy: string
  sunModel: SunModel | null
  moons: ReadonlyArray<MoonForDay | null>
  peaks: ReadonlyArray<SunPeak | null>
}) {
  const tide = plan.tide
  const fromTime = clockOf(plan.window.startLocal)
  return (
    <ol className="sr-plan-days" aria-labelledby={labelledBy}>
      {plan.days.map((day, i) => {
        const dayLabel = formatDate(day.date, { withWeekday: true })
        const events = plan.events.filter(e => e.date === day.date)
        return (
          <li key={i} className="sr-plan-day">
            <h4>
              {dayLabel}
              {i === 0 && <> <span className="sr-plan-from">{PLAN_COPY.fromSuffix(fromTime)}</span></>}
            </h4>
            <DayFacts moon={moons[i] ?? null} sunClause={sunClauseFor(plan, sunModel, peaks[i] ?? null, i)} />
            <TidesLine day={day} tide={tide} />
            <SkyLine day={day} cells={plan.cells} />
            {day.sunrise === null && <p className="sr-plan-note">{PLAN_COPY.noSunrise}</p>}
            {day.sunset === null && <p className="sr-plan-note">{PLAN_COPY.noSunset}</p>}
            {events.length > 0 && (
              <ol className="sr-plan-evs">
                {events.map((ev, j) => <EventItem key={j} ev={ev} dayLabel={dayLabel} />)}
              </ol>
            )}
          </li>
        )
      })}
    </ol>
  )
})

/** The Days in view control (wide tier only): the house SegControl register,
 *  `role="group"` with an accessible name and one `aria-pressed` Button per
 *  option; options whose day count is not below the plan's are omitted. */
function DaysInView({ dayCount, value, onChange }: { dayCount: number; value: PlanDaysInView; onChange: (v: PlanDaysInView) => void }) {
  const options = planDaysInViewOptions(dayCount)
  if (options.length < 2) return null
  return (
    <div className="sr-plan-toolbar">
      <span className="sr-plan-toolbar-label" aria-hidden="true">{PLAN_COPY.daysInView}</span>
      <div className="sr-plan-seg" role="group" aria-label={PLAN_COPY.daysInView}>
        {options.map(v => (
          <Button key={v} type="button" className="sr-plan-seg-btn" aria-pressed={value === v} onClick={() => onChange(v)}>
            {PLAN_COPY.daysOption(v, dayCount)}
          </Button>
        ))}
      </div>
    </div>
  )
}

/** The Sun height swatch: a warm filled hill with a receded 1px tail on each
 *  side (the night portion), the track's own style in miniature. */
function SunSwatch() {
  return (
    <svg width="24" height="12" viewBox="0 0 24 12" aria-hidden="true" focusable="false">
      <path d="M1 9 C3 9 3.5 11 5 11 C6 11 6.5 9 7 9" fill="none" stroke="var(--sr-plan-sunline-night)" strokeWidth="1" strokeLinecap="round" />
      <path d="M17 9 C17.5 9 18 11 19.5 11 C21 11 21.5 9 23 9" fill="none" stroke="var(--sr-plan-sunline-night)" strokeWidth="1" strokeLinecap="round" />
      <path d="M7 9 C9 9 10 1.5 12 1.5 S15 9 17 9 Z" fill="rgba(var(--sr-plan-sunline-rgb),0.14)" />
      <path d="M7 9 C9 9 10 1.5 12 1.5 S15 9 17 9" fill="none" stroke="var(--sr-plan-sunline)" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

function Legend({ withTide, nav, onDay }: { withTide: boolean; nav: PlanNavState; onDay: (dir: -1 | 1) => void }) {
  const sw = (fill: string) => <svg width="14" height="10" aria-hidden="true"><rect width="14" height="10" rx="2" fill={fill} stroke="var(--sr-border-medium)" /></svg>
  return (
    <div className="sr-plan-legend">
      <span className="sr-plan-legend-k">{sw('var(--sr-plan-day)')} {PLAN_COPY.legendDay}</span>
      <span className="sr-plan-legend-k">{sw('var(--sr-plan-night)')} {PLAN_COPY.legendNight}</span>
      <span className="sr-plan-legend-k"><svg width="14" height="12" aria-hidden="true"><polygon points="7,1.5 1.5,10.5 12.5,10.5" fill="var(--sr-plan-halo)" stroke="var(--sr-plan-sun)" strokeWidth="2" strokeLinejoin="round" /></svg> {PLAN_COPY.legendSunrise}</span>
      <span className="sr-plan-legend-k"><svg width="14" height="12" aria-hidden="true"><polygon points="7,10.5 1.5,1.5 12.5,1.5" fill="var(--sr-plan-sun)" stroke="var(--sr-plan-halo)" strokeWidth="1.5" strokeLinejoin="round" /></svg> {PLAN_COPY.legendSunset}</span>
      {withTide && (
        <>
          <span className="sr-plan-legend-k"><svg width="12" height="12" aria-hidden="true"><circle cx="6" cy="6" r="4.5" fill="var(--sr-plan-tide)" stroke="var(--sr-plan-halo)" strokeWidth="1.5" /></svg> {PLAN_COPY.legendHigh}</span>
          <span className="sr-plan-legend-k"><svg width="12" height="12" aria-hidden="true"><circle cx="6" cy="6" r="4.5" fill="var(--sr-plan-halo)" stroke="var(--sr-plan-tide)" strokeWidth="2" /></svg> {PLAN_COPY.legendLow}</span>
        </>
      )}
      <span className="sr-plan-legend-k sr-plan-legend-sun"><SunSwatch /> {PLAN_COPY.legendSun}</span>
      <span className="sr-plan-nav">
        {/* The hint's row is RESERVED from first paint (visibility, never
            display): the chart chunk lands after the legend and the readout
            have painted, and the 1.0.29 `hidden` attribute made the legend
            gain a row on a phone the moment the chart reported that the track
            does not fit (QA-32, 22.5px at 390). Reserved rather than shown,
            because a one-day document's track can fit a wide phone's box, so
            "scroll sideways" is only honest once the chart has said so. */}
        <span className={`sr-plan-legend-scroll${nav.fits ? ' is-off' : ''}`}><ChevronsLeftRight size={13} strokeWidth={2.2} aria-hidden="true" /> {PLAN_COPY.scrollHint}</span>
        <Button type="button" className="sr-plan-navbtn" aria-label={PLAN_COPY.earlierDay} disabled={nav.fits || nav.atStart} onClick={() => onDay(-1)}>
          <ChevronLeft size={14} strokeWidth={2.4} aria-hidden="true" />
        </Button>
        <Button type="button" className="sr-plan-navbtn" aria-label={PLAN_COPY.laterDay} disabled={nav.fits || nav.atEnd} onClick={() => onDay(1)}>
          <ChevronRight size={14} strokeWidth={2.4} aria-hidden="true" />
        </Button>
      </span>
    </div>
  )
}

// ── the picked-moment readout (design, "The picked-moment readout") ──────────

/** The pick marker in miniature: a line with its pill handle. */
function PickGlyph() {
  return (
    <span className="sr-plan-ro-glyph">
      <svg width="14" height="18" viewBox="0 0 14 18" aria-hidden="true" focusable="false">
        <rect x="6" y="3" width="2" height="15" rx="1" fill="currentColor" />
        <rect x="1" y="0" width="12" height="7" rx="3.5" fill="currentColor" />
      </svg>
    </span>
  )
}

function ReadoutRow({ children }: { children: ReactNode }) {
  return (
    <div className="sr-plan-ro-row">
      <PickGlyph />
      <div className="sr-min0">{children}</div>
    </div>
  )
}

function ReadoutTide({ r }: { r: PlanReadout }) {
  if (r.tide.kind === 'none') return <>{PLAN_COPY.noTide}</>
  const t = r.tide.reading
  if (t.heightFt === null) return <>Tide: <span className="sr-plan-mut">{PLAN_COPY.bracketNone}</span></>
  return <>Tide <b>{ftSigned(t.heightFt)} ft</b>, {trendWord(t)}</>
}

function ReadoutWeather({ r }: { r: PlanReadout }) {
  const c = r.weather
  if (!c) return <>{PLAN_COPY.noWeather}</>
  const w = c.weather
  return (
    <>
      <span className="sr-plan-em" aria-hidden="true">{w.emoji}</span>{w.description}, <b>{w.tempF}°F</b>
      {c.resolution === 'daily' && w.highF !== null && w.lowF !== null && <span className="sr-plan-mut"> (H {w.highF}° · L {w.lowF}°)</span>}
    </>
  )
}

function ReadoutWeatherMore({ r }: { r: PlanReadout }) {
  const c = r.weather
  if (!c) return null
  const w = c.weather
  return (
    <div className="sr-plan-ro-wx">
      {PLAN_COPY.windLabel} <b>{w.windDesc}, {w.windDir}</b>
      <Mid />{PLAN_COPY.humidityLabel} <b>{w.humidityPct}%</b>
      <Mid />{PLAN_COPY.dewPointLabel} <b>{w.dewPointF}°F</b>
      <Mid />{PLAN_COPY.cloudLabel} <b>{w.cloudsPct}%</b>
      {/* A space before the nowrap micro-label is its break opportunity: without
          one WebKit let it overhang the box by its trailing letter-spacing at
          one width (measured 3.80px at 1000px / 150%) instead of wrapping. */}
      {' '}<span className="sr-plan-ev-res">{c.resolution === 'daily' ? PLAN_COPY.dailyLabel : PLAN_COPY.hourlyLabel}</span>
    </div>
  )
}

function ReadoutSun({ deg }: { deg: number | null }) {
  if (deg === null) return null
  if (deg === 0) return <>{PLAN_COPY.sunOnHorizon}</>
  const text = deg > 0 ? PLAN_COPY.sunAbove(deg) : PLAN_COPY.sunBelow(-deg)
  return <>{emphasize(text, [`${Math.abs(deg)}°`])}</>
}

/** The picked figures: the display row, the three figures, the rest of the weather. */
function ReadoutPicked({ r }: { r: PlanReadout }) {
  const when = readoutWhen(r)
  return (
    <ReadoutRow>
      <div className="sr-plan-ro-when"><span className="sr-plan-ro-day">{when.day}</span>{when.clock && <span className="sr-plan-ro-time">{when.clock}</span>}</div>
      <div className="sr-plan-ro-figs">
        <ReadoutTide r={r} /><Mid /><ReadoutWeather r={r} />
        {r.sunDeg !== null && <><Mid /><ReadoutSun deg={r.sunDeg} /></>}
      </div>
      <ReadoutWeatherMore r={r} />
    </ReadoutRow>
  )
}

const longest = <T,>(arr: ReadonlyArray<T>, f: (x: T) => string): string => arr.reduce((a, c) => (f(c).length > a.length ? f(c) : a), '')

/**
 * The SIZER (schema 6.2, D13): always hidden, it renders the longest strings
 * THIS document can produce, so the grid cell is sized for the longest case
 * at the current width and text scale and no pick ever changes the height.
 * "trend unknown" can only occur when the untrimmed turning points end before
 * the window does, so only such a plan is sized for it; a no-tide plan is
 * still sized for a tide figure, so the override changes nothing.
 */
function ReadoutSizer({ plan }: { plan: Plan }) {
  const dayLong = longest(plan.days, d => formatDate(d.date, { withWeekday: true }))
  const descLong = longest(plan.cells, c => c.weather.description)
  const windLong = longest(plan.cells, c => c.weather.windDesc)
  const tide = plan.tide
  const canLackNext = tide?.status === 'ok' && tide.bracketPoints.length > 0 && tide.bracketPoints[tide.bracketPoints.length - 1].t < plan.window.endTs
  const hasDaily = plan.cells.some(c => c.resolution === 'daily')
  return (
    <ReadoutRow>
      <div className="sr-plan-ro-when"><span className="sr-plan-ro-day">{dayLong}</span><span className="sr-plan-ro-time">12:00 PM</span></div>
      <div className="sr-plan-ro-figs">
        Tide <b>{'−0.0'} ft</b>, {canLackNext ? PLAN_COPY.tideTrendUnknown : PLAN_COPY.tideFalling}
        <Mid /><span className="sr-plan-em" aria-hidden="true">☁️</span>{descLong}, <b>100°F</b>
        {hasDaily && <span className="sr-plan-mut"> (H 100° · L 100°)</span>}
        <Mid />{emphasize(PLAN_COPY.sunBelow(90), ['90°'])}
      </div>
      <div className="sr-plan-ro-wx">
        {PLAN_COPY.windLabel} <b>{windLong}, NW</b>
        <Mid />{PLAN_COPY.humidityLabel} <b>100%</b>
        <Mid />{PLAN_COPY.dewPointLabel} <b>100°F</b>
        <Mid />{PLAN_COPY.cloudLabel} <b>100%</b>
        {' '}<span className="sr-plan-ev-res">{PLAN_COPY.hourlyLabel}</span>
      </div>
    </ReadoutRow>
  )
}

function Readout({ plan, readout }: { plan: Plan; readout: PlanReadout | null }) {
  // The picked layer keeps its last figures while it fades out on a clear,
  // so the cross-fade has something to fade; derived from the render's own
  // props, never from an effect.
  const [lastShown, setLastShown] = useState<PlanReadout | null>(null)
  if (readout !== null && readout !== lastShown) setLastShown(readout)
  const picked = readout ?? lastShown
  return (
    <div className="sr-plan-readout" aria-hidden="true">
      <div className="sr-plan-ro-layers">
        <div className="sr-plan-ro-layer sr-plan-ro-sizer"><ReadoutSizer plan={plan} /></div>
        <div className={`sr-plan-ro-layer sr-plan-ro-rest ${readout ? 'is-off' : 'is-on'}`}>
          <ReadoutRow>
            <div className="sr-plan-ro-l1">{PLAN_COPY.restLine}</div>
            <div className="sr-plan-ro-keys">{PLAN_COPY.keysLine}</div>
          </ReadoutRow>
        </div>
        <div className={`sr-plan-ro-layer sr-plan-ro-pick ${readout ? 'is-on' : 'is-off'}`}>
          {picked && <ReadoutPicked r={picked} />}
        </div>
      </div>
      <div className="sr-plan-ro-est">{PLAN_COPY.estimateLine}</div>
    </div>
  )
}

// ── the region ───────────────────────────────────────────────────────────────

export function PlanResult({ plan, place, replayedAt, tideErrKind, overriding, onOverride, ChartComponent, daysInView, onDaysInViewChange }: PlanResultProps) {
  const tide = plan.tide
  const withTide = tide?.status === 'ok'
  // The tier comes from the app's phone-tier hook (a matchMedia subscription),
  // never a device check; wide is everything above the 640px phone boundary.
  const wide = !useIsPhone()
  const chartRef = useRef<PlanChartHandle | null>(null)
  const [nav, setNav] = useState<PlanNavState>({ fits: true, atStart: true, atEnd: true })
  const windowLine = `${formatDate(plan.window.startLocal, { withWeekday: true, withTime: true })} → ${formatDate(plan.window.endLocal, { withWeekday: true, withTime: true })}`

  // The pick, keyed on the plan's identity (schema 6.4): the override reuses
  // the weather half, so its identity is unchanged and the pick survives; a
  // fresh plan changes it and the pick reads as null without an effect.
  const identity = `${plan.fetchedAt}|${plan.lat}|${plan.lng}|${plan.tz}`
  const [pickState, setPickState] = useState<{ id: string; t: number | null }>({ id: identity, t: null })
  const pick = pickState.id === identity ? pickState.t : null
  const onPick = useCallback((t: number | null) => setPickState({ id: identity, t }), [identity])

  const sunModel = useMemo(() => buildSunModel(plan), [plan])
  const moons = useMemo(() => plan.days.map(d => moonForDay(d, plan.lat)), [plan])
  const peaks = useMemo(() => (sunModel ? sunPeakByDay(sunModel) : plan.days.map(() => null)), [plan, sunModel])
  const readout = useMemo(() => (pick === null ? null : planReadoutAt(plan, pick, sunModel)), [plan, pick, sunModel])
  const valueText = readoutValueText(readout)
  const weekId = useId()

  return (
    <div role="region" aria-label={PLAN_COPY.regionName} className="sr-plan-result sr-pad-x-trim">
      <div className="sr-action-row">
        <h3 className="sr-min0 sr-plan-h3">{place}</h3>
        <span className="sr-plan-pill">{PLAN_COPY.pill(plan.days.length)}</span>
      </div>
      <div className="sr-plan-head">
        <div className="sr-plan-meta sr-plan-mono">{windowLine}</div>
        <div className="sr-plan-meta">{PLAN_COPY.localTimeLine(plan.lat.toFixed(3), plan.lng.toFixed(3), clockOf(plan.window.startLocal))}</div>
      </div>

      {replayedAt !== null && <StalenessCue replayedAt={replayedAt} style={{ marginTop: 10, marginBottom: 0 }} />}

      {tide && tide.status === 'ok' && (
        <div className="sr-plan-station">
          <Waves size={13} strokeWidth={2.2} aria-hidden="true" />
          <span>
            {PLAN_COPY.stationLine(tide.station.name, tide.station.id, tide.distanceMi.toFixed(1))}
            <b>{PLAN_COPY.stationPredicted}</b>{PLAN_COPY.stationSuffix}
            {!tide.continuous && PLAN_COPY.stationInterpolated}
          </span>
        </div>
      )}

      {tide && (tide.status === 'too-far' || tide.status === 'outside-us') && (
        <div className="sr-plan-notice">
          <div className="sr-action-row sr-action-row-stack sr-plan-alert">
            <span className="sr-min0 sr-plan-alert-text">
              <AlertCircle size={15} strokeWidth={2} aria-hidden="true" />
              <span>{tideTooFarNotice(tide.station.name, tide.distanceMi, tide.status)}</span>
            </span>
            <Button type="button" onClick={onOverride} disabled={overriding} aria-busy={overriding || undefined} aria-label={PLAN_COPY.overrideAria} className="sr-touch-target sr-plan-btn-outline sr-plan-btn-small">
              {overriding && <Loader2 size={12} className="spin" aria-hidden="true" />}
              {tideOverrideLabel(tide.status)}
            </Button>
          </div>
        </div>
      )}

      {tide && tide.status === 'unavailable' && <div className="sr-plan-unavail">{PLAN_COPY.tideUnavailable}</div>}

      {tideErrKind && (
        tideErrKind === 'offline' || tideErrKind === 'no-key'
          ? <div className="sr-plan-notice"><OfflineMessage kind={tideErrKind} message={tideErrKind === 'offline' ? OFFLINE_MESSAGE : NO_KEY_MESSAGE} /></div>
          : <div className="sr-plan-unavail">{PLAN_COPY.tideUnavailable}</div>
      )}

      {wide && <DaysInView dayCount={plan.days.length} value={daysInView} onChange={onDaysInViewChange} />}
      <Suspense fallback={<div className="sr-plan-chartbox" style={{ height: planChartHeight(withTide, wide) }} />}>
        <ChartComponent ref={chartRef} plan={plan} place={place} wide={wide} daysInView={daysInView} onNav={setNav} pick={pick} onPick={onPick} sunModel={sunModel} valueText={valueText} />
      </Suspense>
      <Legend withTide={withTide} nav={nav} onDay={dir => chartRef.current?.scrollByDay(dir)} />

      <Readout plan={plan} readout={readout} />

      <div className="sr-plan-week">
        <CalendarDays size={13} strokeWidth={2.2} aria-hidden="true" />
        <span id={weekId} className="sr-plan-week-label">{PLAN_COPY.listName}</span>
      </div>
      <DayList plan={plan} labelledBy={weekId} sunModel={sunModel} moons={moons} peaks={peaks} />

      <div className="sr-plan-close">{PLAN_COPY.closingNote}</div>
    </div>
  )
}
