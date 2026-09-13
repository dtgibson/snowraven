// The Weather/tide Planner pick's arithmetic (plan-sun-moon-readout, schema E;
// PRD FR-15, FR-20, FR-21): the tap threshold, the pick's bounds, minute
// rounding, the 15-minute marks of the location's clock and every keyboard
// step. Pure and entry-safe: it reads the zone offset through the same twin
// helper the producers used (lib/tzClock.ts) and nothing else. The pointer
// state machine itself lives in the chart component; the decisions it makes
// are the pure functions here so a test can sweep them.

import type { Plan } from './plan'
import { utcOffsetSec } from './tzClock'

/** OQ-09: the total pointer movement, in CSS px, below which a press and
 *  release is a pick rather than a drag. The drag itself keeps no threshold. */
export const PLAN_TAP_PX = 5

export const isTap = (maxMovedPx: number): boolean => maxMovedPx < PLAN_TAP_PX

export interface PickBounds { min: number; max: number }

/** min = the axis start (an hour start, so a quarter mark); max = the window's
 *  last whole minute (23:59, schema D8). Every pick and step clamps to these;
 *  they are the slider's aria-valuemin / aria-valuemax. */
export function pickBounds(plan: Plan): PickBounds {
  const end = plan.window.endTs
  return { min: plan.window.axisStartTs, max: end - (end % 60) }
}

const clamp = (t: number, b: PickBounds): number => Math.min(b.max, Math.max(b.min, t))

/** Round to the nearest whole minute, then clamp to the bounds. */
export function toPickInstant(t: number, bounds: PickBounds): number {
  return clamp(Math.round(t / 60) * 60, bounds)
}

/** The zone's offset, or 0 (UTC marks) when `Intl` rejects the zone: a
 *  replayed document's tz is unvalidated on load, and the plan must never
 *  throw over it (schema section 5). */
export function safeOffset(t: number, tz: string): number {
  try { return utcOffsetSec(t, tz) } catch { return 0 }
}

const QUARTER = 900
const HOUR = 3600
const DAY = 86400

/** The mark of `unit` seconds at or before `t` on the location's clock. */
function markAtOrBefore(t: number, unit: number, tz: string): number {
  const off = safeOffset(t, tz)
  return t - ((((t + off) % unit) + unit) % unit)
}

export function isOnQuarterMark(t: number, tz: string): boolean {
  return markAtOrBefore(t, QUARTER, tz) === t
}

/**
 * The nearest 15-minute mark of the location's clock strictly in direction
 * `dir`: Right gives the next mark strictly after `t` whether or not `t` is on
 * one; Left gives the mark at or before `t` when `t` is off a mark and the
 * previous mark when it is on one. Every real zone offset is a multiple of
 * 900 s, so these coincide with UTC quarter marks (planPick.test.ts asserts it
 * over every fixture zone); the rule is still stated in the location's clock
 * because that is the contract.
 */
export function quarterMarkToward(t: number, dir: -1 | 1, tz: string): number {
  const m = markAtOrBefore(t, QUARTER, tz)
  if (dir > 0) return m + QUARTER
  return m === t ? m - QUARTER : m
}

function hourMarkToward(t: number, dir: -1 | 1, tz: string): number {
  const m = markAtOrBefore(t, HOUR, tz)
  if (dir > 0) return m + HOUR
  return m === t ? m - HOUR : m
}

export type PickKey =
  | 'quarter-left' | 'quarter-right'
  | 'hour-left' | 'hour-right'
  | 'day-left' | 'day-right'
  | 'home' | 'end'

/**
 * The next pick for a key (FR-20, FR-21, schema D9).
 *
 * With no pick the base is the plan's Now, its fetch instant (on a replayed
 * plan the stored one): a quarter step picks the first quarter mark at or
 * after Now (Right) or the last at or before (Left); an hour step the same
 * on hour marks; a day step the quarter mark rule applied a day later or
 * earlier.
 *
 * With a pick: a quarter step moves to the next mark strictly in its
 * direction (from 6:07, Right gives 6:15 and Left 6:00); an hour or day step
 * first aligns an unaligned instant the same way, then adds an hour or a day
 * of REAL time (from 6:15, Shift+Right gives 7:15; Page Up gives the same
 * clock tomorrow, an hour off across a clock change, the ARIA slider
 * convention FR-20 names). Home and End are the bounds. Everything clamps.
 */
export function stepPick(current: number | null, key: PickKey, plan: Plan): number {
  const b = pickBounds(plan)
  const tz = plan.tz
  if (key === 'home') return b.min
  if (key === 'end') return b.max
  const dir: -1 | 1 = key.endsWith('right') ? 1 : -1
  if (current === null) {
    const now = plan.fetchedAt
    const atOrToward = (unit: number) => {
      const m = markAtOrBefore(now, unit, tz)
      return m === now ? now : dir > 0 ? m + unit : m
    }
    if (key === 'hour-left' || key === 'hour-right') return clamp(atOrToward(HOUR), b)
    const q = atOrToward(QUARTER)
    if (key === 'day-left' || key === 'day-right') return clamp(q + dir * DAY, b)
    return clamp(q, b)
  }
  if (key === 'quarter-left' || key === 'quarter-right') return clamp(quarterMarkToward(current, dir, tz), b)
  const aligned = isOnQuarterMark(current, tz) ? current : quarterMarkToward(current, dir, tz)
  if (key === 'hour-left' || key === 'hour-right') return clamp(aligned + dir * HOUR, b)
  return clamp(aligned + dir * DAY, b)
}

// `hourMarkToward` is the hour-mark twin of the quarter rule; exported for the
// tests that sweep alignment, not used by the step itself (which aligns to
// the quarter first, schema D9).
export { hourMarkToward }
