// The Weather/tide Planner's picked-moment readout (plan-sun-moon-readout,
// schema D; PRD FR-07 to FR-13, FR-23): the figures for one minute of the
// plan, derived from the document already in hand and nothing else. Pure and
// entry-safe: one computation per pick, zero requests, zero storage reads.
//
// The tide rule is the composer's own `tideAtEvent` over the composer's own
// inputs (the trimmed curve and the UNTRIMMED bracket points), so for any
// event e, `tideAtInstant(e.t, plan.tide)` deep-equals `e.tide` (FR-08, an
// identity rather than a coincidence; plan.test.ts asserts it over every event
// of every fixture family). The weather is the document's own cell containing
// the instant, never the strip's collapsed block cell (FR-09). The sun is the
// same anchored curve the track draws (FR-12).
//
// The picked minute's clock is the one local string the document cannot carry
// (schema section 5): it is converted here through the same twin helper the
// producers used, inside a try, because `Intl.DateTimeFormat` throws on a zone
// it does not know and a replayed document's `tz` is unvalidated on load. No
// producer can emit such a zone, so `''` is a resilience state, not one a
// user reaches.
//
// Scans, each declared in the schema's section 8: `cellAt` is one forward pass
// over <= 112 cells; `tideAtInstant` is the composer's two passes over
// <= 448 + 64 entries; both linear, once per pick.

import type { EventTide, Plan, PlanCell, PlanTide } from './plan'
import { tideAtEvent } from './plan'
import { sunAltitudeAt, type SunModel } from './planSun'
import { localClock } from './tzClock'
import { PLAN_COPY } from './planCopy'
import { clockOf, dayOf, ftSigned } from './planFormat'

/** The document's own cell whose span contains `t`, or null in a gap. */
export function cellAt(cells: ReadonlyArray<PlanCell>, t: number): PlanCell | null {
  for (let i = 0; i < cells.length; i += 1) {
    const c = cells[i]
    if (c.startTs <= t && t <= c.endTs) return c
  }
  return null
}

/** The tide at instant `t`: the event rule over the event inputs, or null
 *  when the plan has no tide. */
export function tideAtInstant(t: number, tide: PlanTide): EventTide | null {
  if (!tide || tide.status !== 'ok') return null
  return tideAtEvent(t, tide.curve, tide.bracketPoints)
}

/** 'YYYY-MM-DD HH:MM' in the zone, or '' when `Intl` rejects the zone. */
export function safeLocalClock(t: number, tz: string): string {
  try { return localClock(t, tz) } catch { return '' }
}

export interface PlanReadout {
  /** The picked minute. */
  t: number
  /** The minute's local clock string, or '' when the zone is unusable. */
  local: string
  tide: { kind: 'none' } | { kind: 'reading'; reading: EventTide }
  /** The document's cell for the minute, or null in a gap. */
  weather: PlanCell | null
  /** The anchored altitude rounded to whole degrees, or null with no model. */
  sunDeg: number | null
}

/** One pure computation per pick. */
export function planReadoutAt(plan: Plan, t: number, model: SunModel | null): PlanReadout {
  const reading = tideAtInstant(t, plan.tide)
  return {
    t,
    local: safeLocalClock(t, plan.tz),
    tide: reading ? { kind: 'reading', reading } : { kind: 'none' },
    weather: cellAt(plan.cells, t),
    sunDeg: model ? Math.round(sunAltitudeAt(model, t)) : null,
  }
}

// ── the words, built from PLAN_COPY so the visible block and the announced
//    value text cannot drift ─────────────────────────────────────────────────

export const trendWord = (r: EventTide): string =>
  r.trend === 'rising' ? PLAN_COPY.tideRising : r.trend === 'falling' ? PLAN_COPY.tideFalling : PLAN_COPY.tideTrendUnknown

/** "Tide 2.9 ft, rising" / "No tide in this plan" / "Tide: no high or low in the data on either side". */
export function readoutTideText(r: PlanReadout): string {
  if (r.tide.kind === 'none') return PLAN_COPY.noTide
  const reading = r.tide.reading
  if (reading.heightFt === null) return `Tide: ${PLAN_COPY.bracketNone}`
  return `${PLAN_COPY.tideHeight(ftSigned(reading.heightFt))}, ${trendWord(reading)}`
}

/** The announced weather: condition, temperature, the daily high and low,
 *  the wind and the resolution, in one clause. */
export function readoutWeatherText(r: PlanReadout): string {
  const c = r.weather
  if (!c) return PLAN_COPY.noWeather
  const w = c.weather
  const hl = c.resolution === 'daily' && w.highF !== null && w.lowF !== null ? `, high ${w.highF}°, low ${w.lowF}°` : ''
  const res = c.resolution === 'daily' ? PLAN_COPY.forecastDailyWords : PLAN_COPY.forecastHourlyWords
  return `${w.description}, ${w.tempF}°F${hl}, ${PLAN_COPY.windLabel.toLowerCase()} ${w.windDesc}, ${w.windDir}, ${res}`
}

/** "Sun 8° below the horizon" / "Sun 57° above the horizon" / "Sun on the horizon"; '' with no figure. */
export function readoutSunText(sunDeg: number | null): string {
  if (sunDeg === null) return ''
  if (sunDeg > 0) return PLAN_COPY.sunAbove(sunDeg)
  if (sunDeg < 0) return PLAN_COPY.sunBelow(-sunDeg)
  return PLAN_COPY.sunOnHorizon
}

/** The picked minute's day and clock as the list prints them. */
export function readoutWhen(r: PlanReadout): { day: string; clock: string } {
  if (!r.local) return { day: PLAN_COPY.timeUnavailable, clock: '' }
  return { day: dayOf(r.local), clock: clockOf(r.local) }
}

/**
 * The slider's value text (FR-23): the four figures in one string on a pick,
 * the rest line at rest. One announcement per change, through the control's
 * own value; no live region anywhere.
 */
export function readoutValueText(r: PlanReadout | null): string {
  if (!r) return PLAN_COPY.restLine
  const when = readoutWhen(r)
  const whenText = when.clock ? `${when.day}, ${when.clock}` : when.day
  const parts = [whenText, readoutTideText(r), readoutWeatherText(r)]
  const sun = readoutSunText(r.sunDeg)
  if (sun) parts.push(sun)
  return parts.map(p => `${p}.`).join(' ')
}
