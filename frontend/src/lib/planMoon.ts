// The Weather/tide Planner's per-day moon line (plan-sun-moon-readout, schema
// C; PRD FR-35 to FR-39). Pure and entry-safe.
//
// ONE MOON VOCABULARY, ONE COMPUTATION. The glyph is `moonPhaseEmoji` from
// lib/weatherFormatter.ts, the checklist weather blocks' own hand-ported
// lunarphase algorithm, byte-golden against backend/formatters/weather.py;
// imported, never copied, so a plan and a checklist comment can never disagree
// (FR-36, FR-39). The names sit on the same eight phase bounds: the phase index
// is the glyph's position in the HEMISPHERE'S OWN glyph array, so the name
// follows the phase and only the glyph mirrors south of the equator (FR-38).
// The provider's daily moon field is never read: the plan document carries no
// such field by construction (1.0.29 D7).

import { MOON_NORTH, MOON_SOUTH, moonPhaseEmoji } from './weatherFormatter'
import type { PlanDay } from './plan'

/** Indexed by PHASE, the same eight bins as MOON_PHASE_BOUNDS. Never mirrors. */
export const MOON_PHASE_NAMES: ReadonlyArray<string> = [
  'New moon', 'Waxing crescent', 'First quarter', 'Waxing gibbous',
  'Full moon', 'Waning gibbous', 'Last quarter', 'Waning crescent',
]

/**
 * The instant the local clock reads 12:00 on this day, from the day's own
 * boundaries (FR-37): midnight plus half a day, corrected by the hour the day
 * gained or lost. Exact on every zone that changes its clock before noon
 * (every US zone changes at 02:00, the same assumption the axis lane's tick
 * placement already makes; schema D7). A 24-hour day gives midnight + 12 h, a
 * 25-hour day + 13 h, a 23-hour day + 11 h.
 */
export function localNoonTs(day: PlanDay): number {
  return day.startTs + 43200 + ((day.endTs - day.startTs + 1) - 86400)
}

export interface MoonForDay { glyph: string; name: string }

/**
 * The day's moon: the checklist blocks' glyph at local noon, mirrored by the
 * sign of the plan's latitude exactly as those blocks mirror it, and the phase
 * name from the same bounds. Null only if the glyph is not in the hemisphere's
 * array, which cannot happen (it came from that array); stated so a future
 * ninth glyph degrades rather than throws.
 */
export function moonForDay(day: PlanDay, lat: number): MoonForDay | null {
  const glyph = moonPhaseEmoji(localNoonTs(day), lat)
  // A constant eight-element array with an in-house needle: O(8), not a scan
  // over document content (security rule, declared in the schema's section 8).
  const idx = (lat < 0 ? MOON_SOUTH : MOON_NORTH).indexOf(glyph)
  if (idx < 0 || idx >= MOON_PHASE_NAMES.length) return null
  return { glyph, name: MOON_PHASE_NAMES[idx] }
}
