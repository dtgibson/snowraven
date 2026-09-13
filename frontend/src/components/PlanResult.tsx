// The Weather/tide Planner's result region (design-spec.md): the header, the
// replay cue, the one tide notice, the chart slot, the legend, the per-day list
// and the closing note. A STATIC import in WeatherForecastPanel, so it renders
// the figures the moment the plan arrives; the chart arrives through the lazy
// slot the panel passes in and never delays the list (NFR-03).
//
// The list is the plan's accessible form and its phone form: real list
// semantics, one item per event carrying every figure as text, every strip
// cell reaching it through the per-day sky line (FR-27). Every item gets the
// same treatment whatever its values (FR-50). Nothing here computes a sunrise,
// a day boundary or a local time: the document carries them, and this file
// only formats (schema section 13, item 1). DOM ids are keyed on the index,
// never on content (ui rule, v1.0.21) -- and this list needs none.

import { Suspense, useRef, useState, type ComponentType, type RefAttributes } from 'react'
import { Sunrise, Sunset, Waves, ChevronDown, ChevronsLeftRight, ChevronLeft, ChevronRight, Loader2, AlertCircle } from 'lucide-react'
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

function WeatherLine({ w }: { w: PlanWeather }) {
  return (
    <div className="sr-plan-ev-wx">
      <span className="sr-plan-em" aria-hidden="true">{w.emoji}</span>
      {w.description}, <b>{w.tempF}°F</b>
      {w.resolution === 'daily' && w.highF !== null && w.lowF !== null && <span className="sr-plan-mut"> (H {w.highF}° · L {w.lowF}°)</span>}
      <span className="sr-plan-mut"> · </span>{PLAN_COPY.windLabel} <b>{w.windDesc}, {w.windDir}</b>
      <span className="sr-plan-mut"> · </span>{PLAN_COPY.humidityLabel} <b>{w.humidityPct}%</b>
      <span className="sr-plan-mut"> · </span>{PLAN_COPY.dewPointLabel} <b>{w.dewPointF}°F</b>
      <span className="sr-plan-mut"> · </span>{PLAN_COPY.cloudLabel} <b>{w.cloudsPct}%</b>
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
  const trend = t.trend === 'rising' ? PLAN_COPY.tideRising : t.trend === 'falling' ? PLAN_COPY.tideFalling : PLAN_COPY.tideTrendUnknown
  return (
    <div className="sr-plan-ev-tide">
      Tide <b>{ftSigned(t.heightFt)} ft</b>, {trend} <span className="sr-plan-mut">· {bracketText(ev)}</span>
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
      <span className="sr-plan-nav">
        <span className="sr-plan-legend-scroll" hidden={nav.fits}><ChevronsLeftRight size={13} strokeWidth={2.2} aria-hidden="true" /> {PLAN_COPY.scrollHint}</span>
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

export function PlanResult({ plan, place, replayedAt, tideErrKind, overriding, onOverride, ChartComponent, daysInView, onDaysInViewChange }: PlanResultProps) {
  const tide = plan.tide
  const withTide = tide?.status === 'ok'
  // The tier comes from the app's phone-tier hook (a matchMedia subscription),
  // never a device check; wide is everything above the 640px phone boundary.
  const wide = !useIsPhone()
  const chartRef = useRef<PlanChartHandle | null>(null)
  const [nav, setNav] = useState<PlanNavState>({ fits: true, atStart: true, atEnd: true })
  const windowLine = `${formatDate(plan.window.startLocal, { withWeekday: true, withTime: true })} → ${formatDate(plan.window.endLocal, { withWeekday: true, withTime: true })}`

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
        <ChartComponent ref={chartRef} plan={plan} place={place} wide={wide} daysInView={daysInView} onNav={setNav} />
      </Suspense>
      <Legend withTide={withTide} nav={nav} onDay={dir => chartRef.current?.scrollByDay(dir)} />

      <ol className="sr-plan-days" aria-label={PLAN_COPY.listName}>
        {plan.days.map((day, i) => {
          const dayLabel = formatDate(day.date, { withWeekday: true })
          const events = plan.events.filter(e => e.date === day.date)
          return (
            <li key={i} className="sr-plan-day">
              <h4>{dayLabel}</h4>
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

      <div className="sr-plan-close">{PLAN_COPY.closingNote}</div>
    </div>
  )
}
