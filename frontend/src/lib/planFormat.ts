// Display formatting for the Weather/tide Planner. The document carries raw
// floats, integer epochs and one 'YYYY-MM-DD HH:MM' local string per instant
// (schema D8); everything here is formatting of those, never arithmetic on
// them. `formatDate` honours the user's date preference and the app's clock
// style (FR-51); `ft()` is the shipped one-decimal tide height, with the minus
// sign the design asks for on a negative height. Entry-safe.

import { formatDate } from './formatDate'
import { ft } from './tide'

/** '6:48 AM' from a 'YYYY-MM-DD HH:MM' local string: the time part of the
 *  app's clock style, as `formatDate(..., { withTime: true })` prints it. */
export function clockOf(local: string): string {
  const full = formatDate(local, { withTime: true })
  const i = full.lastIndexOf(', ')
  return i === -1 ? full : full.slice(i + 2)
}

/** '7 AM' / '7:30 AM' for a strip reading: the clock with a :00 dropped. */
export function hourOf(local: string): string {
  return clockOf(local).replace(':00 ', ' ')
}

/** The date part of a local string as the user prefers it, weekday first. */
export function dayOf(local: string): string {
  return formatDate(local.slice(0, 10), { withWeekday: true })
}

/** The abbreviated weekday of a local date, for a bracket on another day. */
export function weekdayOf(local: string): string {
  return formatDate(local.slice(0, 10), { withWeekday: true }).slice(0, 3)
}

/** A tide height to one decimal with the minus sign, never '-0.0'. */
export function ftSigned(v: number): string {
  const s = ft(v)
  if (s === '-0.0') return '0.0'
  return s.replace('-', '−')
}
