// The live cells, the window rule and the distance rule (targets-tab,
// schema.md section 5.6; FR-41, FR-47, FR-51, FR-53, FR-54a).
//
// NEVER HIDDEN BECAUSE A DAY HAS NOT BEEN CHECKED. A row is hidden by the
// window (or the distance filter) only when the days that could have answered
// it HAVE been answered. The precise rule, which is what FR-53 says rather
// than the shortest reading of it: a report found inside the window keeps the
// row; otherwise the row is hidden only when every day inside the window is a
// checked entry. A last report OLDER than the window does not by itself hide a
// row while a day inside the window is still unchecked or failed, because
// that day might carry a newer report.
//
// Pure and clock-free: `nowMs` is a parameter everywhere.

import type { DayObsEntry } from '../countyDayObsCache'
import { isWithinWindow } from '../nearbyLifers'
import { distanceMiles } from '../mapExplorerFormat'
import type { WindowKey } from './targetsCopy'

/** One day of the 30: a fetched entry, not yet asked, or asked and failed. */
export type DayState = DayObsEntry | 'unchecked' | 'failed'

export interface LiveCell {
  /** Days reported among the checked days (0 to 30). */
  daysReported: number
  /** Checked days in the 30 (the same for every row). */
  checkedDays: number
  /** The most recent reported date ("YYYY-MM-DD"), or null. */
  lastDate: string | null
  /** That report's place, when eBird supplied one. */
  place: string | null
  lat: number | null
  lng: number | null
  /** Newest first, one entry per date in `dates`: true when reported that day. */
  reported: readonly boolean[]
}

export function isChecked(state: DayState | undefined): state is DayObsEntry {
  return state !== undefined && state !== 'unchecked' && state !== 'failed'
}

/**
 * One pass over the checked entries' records. `dates` is newest first (index 0
 * is today). Every pool code gets a cell, a zero one when it was never
 * reported, so a consumer never has to guess what an absent cell means.
 */
export function deriveLive(
  dates: readonly string[],
  days: ReadonlyMap<string, DayState>,
  poolCodes: ReadonlySet<string>,
): Map<string, LiveCell> {
  let checkedDays = 0
  for (const d of dates) if (isChecked(days.get(d))) checkedDays += 1

  interface Acc { n: number; mask: boolean[]; bestDt: string; place: string | null; lat: number | null; lng: number | null; date: string | null }
  const acc = new Map<string, Acc>()
  for (let i = 0; i < dates.length; i++) {
    const entry = days.get(dates[i])
    if (!isChecked(entry)) continue
    for (const r of entry.species) {
      if (!poolCodes.has(r.speciesCode)) continue
      let a = acc.get(r.speciesCode)
      if (!a) {
        a = { n: 0, mask: new Array<boolean>(dates.length).fill(false), bestDt: '', place: null, lat: null, lng: null, date: null }
        acc.set(r.speciesCode, a)
      }
      if (!a.mask[i]) { a.mask[i] = true; a.n += 1 }
      if (r.obsDt > a.bestDt) {
        a.bestDt = r.obsDt
        a.date = dates[i]
        a.place = r.locName || null
        a.lat = r.lat
        a.lng = r.lng
      }
    }
  }

  const empty: boolean[] = new Array<boolean>(dates.length).fill(false)
  const out = new Map<string, LiveCell>()
  for (const code of poolCodes) {
    const a = acc.get(code)
    out.set(code, a
      ? { daysReported: a.n, checkedDays, lastDate: a.date, place: a.place, lat: a.lat, lng: a.lng, reported: a.mask }
      : { daysReported: 0, checkedDays, lastDate: null, place: null, lat: null, lng: null, reported: empty })
  }
  return out
}

export const WINDOW_DAYS: Record<Exclude<WindowKey, 'any'>, number> = { day: 1, week: 7, '30': 30 }

/** True when every date inside the window (or all dates, for 'any') is a checked entry. */
export function windowFullyChecked(
  window: WindowKey,
  dates: readonly string[],
  days: ReadonlyMap<string, DayState>,
  nowMs: number,
): boolean {
  for (const d of dates) {
    if (window !== 'any' && !isWithinWindow(d, WINDOW_DAYS[window], nowMs)) continue
    if (!isChecked(days.get(d))) return false
  }
  return true
}

/** True when the cell's last report falls inside the window ('any' = the whole 30). */
export function reportedInWindow(cell: LiveCell, window: WindowKey, nowMs: number): boolean {
  if (cell.lastDate === null) return false
  if (window === 'any') return true
  return isWithinWindow(cell.lastDate, WINDOW_DAYS[window], nowMs)
}

/**
 * FR-53. 'any' hides nothing. Otherwise a row is hidden only when no report was
 * found inside the window AND every day inside the window has been checked.
 * `fullyChecked` is `windowFullyChecked(...)`, computed once per render rather
 * than once per row.
 */
export function hiddenByWindow(cell: LiveCell, window: WindowKey, fullyChecked: boolean, nowMs: number): boolean {
  if (window === 'any') return false
  if (reportedInWindow(cell, window, nowMs)) return false
  return fullyChecked
}

export interface Anchor { lat: number; lng: number }

/** Miles from the anchor to the last report, or null when either side lacks coordinates. */
export function distanceCell(cell: LiveCell, anchor: Anchor | null): number | null {
  if (!anchor || cell.lastDate === null || cell.lat === null || cell.lng === null) return null
  return distanceMiles(anchor.lat, anchor.lng, cell.lat, cell.lng)
}

/**
 * FR-54a. Measured to the same last report the Distance cell shows. A row is
 * hidden only when that report is known and farther than the stop, or when no
 * report was found inside the window and every day inside the window has been
 * checked. A report with no coordinates ("No distance") is never hidden by
 * distance; a null stop or a null anchor hides nothing.
 */
export function hiddenByDistance(
  cell: LiveCell,
  stopMiles: number | null,
  anchor: Anchor | null,
  window: WindowKey,
  fullyChecked: boolean,
  nowMs: number,
): boolean {
  if (stopMiles === null || anchor === null) return false
  if (!reportedInWindow(cell, window, nowMs)) return fullyChecked
  const d = distanceCell(cell, anchor)
  return d !== null && d > stopMiles
}
