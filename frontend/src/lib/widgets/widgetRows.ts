// The TypeScript twin of the widget extension's list rules (ios-lifer-widgets,
// schema.md sections 6 and 7). The widget is a THIRD runtime of one rule
// (backend/routers/map.py and lib/recentObsReduce.ts are the other two for the
// reduce; lib/nearbyLifers.ts and Map Explorer's Media Targets for the
// subtraction). This file is what the parity fixture generator drives, and the
// Swift `Logic/` sources reproduce its output byte for byte from the same
// fixture (`snowraven_widgetsTests`, run on the release machine because CI
// cannot compile Swift). Pure: no React, no I/O, not on the entry graph.
//
// THE WIDGET'S RULES, IN ORDER (schema.md section 6.6):
//   1. Reduce the eBird body with the SHARED reducer (`reduceRecentObs`), after
//      a sanitizing pass that drops non-object elements and records with an
//      over-long string field and reads a non-string field as ''. Then drop a
//      record with no species code, with coordinates out of range, or whose
//      reduced date fails the strict parse (FR-13).
//   2. Filter by kind: Nearby Lifers keeps a record whose folded name is NOT in
//      the hand-over's recorded set; Media Targets keeps it by the media value
//      against the three per-type sets (Any is their union).
//   3. Filter by window: Day and Week keep 0 <= days <= 1 or 7; 30 days applies
//      no filter at all (FR-11).
//   4. One row per species: its nearest record, ties to the most recent
//      `obsDt`, then the smaller `locId` (FR-08).
//   5. Order: distance ascending, then most recent `obsDt`, then the folded
//      name, then the species code (the last only so two species whose names
//      fold identically still have ONE order in both runtimes) (FR-09).
//
// DECLARED DIFFERENCES FROM THE APP (testing.md's symmetric-difference rule;
// each is asserted in widgetRows.parity.test.ts rather than left to reading):
//   * Day counts are CALENDAR days (days-from-civil arithmetic on the report's
//     date and the device's local date), not `isWithinWindow`'s
//     `floor((nowMidnight - obsMidnight) / 24h)`, which is one day short on
//     the day after a spring-forward transition. Copying the floor would make
//     both runtimes wrong on the same day and the parity fixture blind to it
//     (CLAUDE.md, "an agreeing wrong number"). The app's off-by-one is a
//     separate Map Explorer fix, proposed for ROADMAP.
//   * A report whose date the strict parse refuses (`2026-02-30`, anything
//     `Number()` would coerce that the anchored class does not) is dropped.
//     The app keeps it under 30 days (no predicate runs there) and may admit a
//     rolled-over impossible date under Day or Week.
//   * A record with no species code is dropped; the app would plot it.
//   * A record with coordinates outside +/-90 / +/-180 is dropped (the
//     widget's cache validator refuses them, so the reducer never produces
//     them); eBird sends none.

import { reduceRecentObs } from '../recentObsReduce'
import { WIDGET_RADIUS_MI } from '../links/deepLink'
import { distanceMiles } from '../mapExplorerFormat'
import { foldSpeciesName, type WidgetHandoverV1 } from './widgetHandover'

export { reduceRecentObs, distanceMiles }

/** The widget's own fixed search radius (single-sourced in the entry-safe
 *  link module, which the tap-through also reads), and how it reaches eBird. */
export { WIDGET_RADIUS_MI }
/** eBird's `dist` in km, computed exactly as Map Explorer's handlers compute
 *  it (`Math.round(radiusMi * 1.60934)`), never restated as a literal. */
export const WIDGET_DIST_KM = Math.round(WIDGET_RADIUS_MI * 1.60934)
/** eBird's `back`: the fetch always covers 30 days; the window is local. */
export const WIDGET_BACK_DAYS = 30
/** Every string field the widget stores is at most this many UTF-16 units. */
export const RECORD_MAX_STRING = 512
/** The eBird host and path the widget calls, and nothing else (FR-21). */
export const EBIRD_RECENT_URL = 'https://api.ebird.org/v2/data/obs/geo/recent'

/** The widget's request URL (Swift `EBirdClient`): two numbers to five
 *  decimals and three constants, so nothing interpolated can express a
 *  separator, host or scheme. `maxResults` is deliberately NOT sent, so this is
 *  the app's own request; the bound lives in the widget's body-size cap. */
export function buildRecentObsUrl(lat: number, lng: number): string {
  return `${EBIRD_RECENT_URL}?lat=${lat.toFixed(5)}&lng=${lng.toFixed(5)}&dist=${WIDGET_DIST_KM}&back=${WIDGET_BACK_DAYS}&fmt=json`
}

/** Rows per family: small, medium, large. */
export const FAMILY_ROWS = { small: 1, medium: 3, large: 8 } as const

export type WidgetKind = 'lifers' | 'targets'
export type WidgetWindow = 'day' | 'week' | 'all'
export type WidgetMedia = 'photo' | 'audio' | 'video' | 'any'
export type MediaNeed = 'photo' | 'audio' | 'video'
export const MEDIA_NEEDS: readonly MediaNeed[] = ['photo', 'audio', 'video']
export const WINDOW_DAYS: Record<Exclude<WidgetWindow, 'all'>, number> = { day: 1, week: 7 }

export interface WidgetRecord {
  speciesCode: string
  comName: string
  locId: string
  locName: string
  lat: number
  lng: number
  obsDt: string
  subId: string
}

export interface WidgetRow {
  comName: string
  speciesCode: string
  locId: string
  locName: string
  lat: number
  lng: number
  distanceMi: number
  distanceText: string
  daysAgo: number
  recency: string
  obsDt: string
  subId: string
  missingMedia: MediaNeed[]
  label: string
}

export interface CivilDate { y: number; m: number; d: number }

// ── Names ─────────────────────────────────────────────────────────────────────

/** Swift `SpeciesName.fold`: normalize, then the default case mapping. */
export const foldName = foldSpeciesName

// ── Dates ─────────────────────────────────────────────────────────────────────

const OBS_DT_RE = /^[0-9]{4}-[0-9]{2}-[0-9]{2}( [0-9]{2}:[0-9]{2})?$/

/** Proleptic Gregorian leap year. */
function isLeap(y: number): boolean {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0
}

function daysInMonth(y: number, m: number): number {
  return [31, isLeap(y) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1]!
}

/**
 * The strict `obsDt` parse (Swift `ObsDate.parse`): exactly `YYYY-MM-DD` or
 * `YYYY-MM-DD HH:mm`, ASCII digits only, anchored at both ends with no
 * trailing-newline tolerance, and a real calendar day. The time part is
 * checked for shape only; only the date is used.
 */
export function parseObsDateStrict(s: string): CivilDate | null {
  if (!OBS_DT_RE.test(s)) return null
  const y = Number(s.slice(0, 4))
  const m = Number(s.slice(5, 7))
  const d = Number(s.slice(8, 10))
  if (m < 1 || m > 12 || d < 1 || d > daysInMonth(y, m)) return null
  return { y, m, d }
}

/**
 * Days from 1970-01-01 to a proleptic Gregorian civil date (H. Hinnant's
 * days_from_civil). Pure integer arithmetic, identical in Swift, so the day
 * count is exact on every day of the year, the DST transition days included.
 */
export function daysFromCivil({ y, m, d }: CivilDate): number {
  const yy = m <= 2 ? y - 1 : y
  const era = Math.floor(yy / 400)
  const yoe = yy - era * 400
  const mp = m > 2 ? m - 3 : m + 9
  const doy = Math.floor((153 * mp + 2) / 5) + d - 1
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy
  return era * 146097 + doe - 719468
}

/** The civil date of an instant in an IANA zone (Swift: `Calendar` with that
 *  `TimeZone`). */
export function localCivilDate(nowMs: number, tz: string): CivilDate {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date(nowMs))
  const get = (t: string) => Number(parts.find(p => p.type === t)!.value)
  return { y: get('year'), m: get('month'), d: get('day') }
}

/** Calendar days from the report's date to "today" (negative = future-dated). */
export function daysBetween(obs: CivilDate, today: CivilDate): number {
  return daysFromCivil(today) - daysFromCivil(obs)
}

/** "Today", "Yesterday", or "N days ago". A future-dated report (a report
 *  from a zone ahead of the device's) reads "Today" rather than a negative. */
export function recencyLabel(days: number): string {
  if (days <= 0) return 'Today'
  if (days === 1) return 'Yesterday'
  return `${days} days ago`
}

/** Window membership. 30 days is never passed here: it applies no filter. */
export function inWindow(days: number, window: Exclude<WidgetWindow, 'all'>): boolean {
  return days >= 0 && days <= WINDOW_DAYS[window]
}

// ── Distance ──────────────────────────────────────────────────────────────────

/** One decimal plus " mi", exactly as the in-app lists print it
 *  (`toFixed(1)`; the Swift twin reproduces toFixed's tie rule). */
export function formatMiles(d: number): string {
  return `${d.toFixed(1)} mi`
}

// ── Reduce ────────────────────────────────────────────────────────────────────

const STRING_FIELDS = ['speciesCode', 'comName', 'locId', 'locName', 'obsDt', 'subId'] as const

/**
 * The widget's reduce: the shared reducer over a sanitized copy of the body,
 * then the widget's own drops (no code, out-of-range coordinates, a date the
 * strict parse refuses). Null when the body is not an array (malformed).
 */
export function reduceWidgetRecords(body: unknown): WidgetRecord[] | null {
  if (!Array.isArray(body)) return null
  const clean: Record<string, unknown>[] = []
  for (const raw of body) {
    if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) continue
    const obs = raw as Record<string, unknown>
    let tooLong = false
    const out: Record<string, unknown> = { lat: obs['lat'], lng: obs['lng'] }
    for (const f of STRING_FIELDS) {
      const v = obs[f]
      const s = typeof v === 'string' ? v : ''
      if (s.length > RECORD_MAX_STRING) { tooLong = true; break }
      out[f] = s
    }
    if (!tooLong) clean.push(out)
  }
  const reduced = reduceRecentObs(clean)
  const records: WidgetRecord[] = []
  for (const r of reduced) {
    if (r.speciesCode === '') continue
    if (r.lat < -90 || r.lat > 90 || r.lng < -180 || r.lng > 180) continue
    if (parseObsDateStrict(r.recentDate) === null) continue
    records.push({
      speciesCode: r.speciesCode, comName: r.comName, locId: r.locId, locName: r.locName,
      lat: r.lat, lng: r.lng, obsDt: r.recentDate, subId: r.subId,
    })
  }
  return records
}

// ── Rows ──────────────────────────────────────────────────────────────────────

/** "needs photo", "needs photo and video", "needs photo, audio and video". */
export function needsPhrase(missing: readonly MediaNeed[]): string {
  const ordered = MEDIA_NEEDS.filter(t => missing.includes(t))
  if (ordered.length === 0) return ''
  if (ordered.length === 1) return `needs ${ordered[0]}`
  if (ordered.length === 2) return `needs ${ordered[0]} and ${ordered[1]}`
  return `needs ${ordered[0]}, ${ordered[1]} and ${ordered[2]}`
}

/** One row as VoiceOver reads it (NFR-05): name, the needs phrase under Any
 *  only, the distance with "miles" in full, recency, location name. */
export function rowLabel(row: Pick<WidgetRow, 'comName' | 'distanceMi' | 'recency' | 'locName' | 'missingMedia'>, showNeeds: boolean): string {
  const needs = showNeeds ? needsPhrase(row.missingMedia) : ''
  return `${row.comName}${needs ? `, ${needs}` : ''}, ${row.distanceMi.toFixed(1)} miles, ${row.recency}, ${row.locName}.`
}

/** Code-unit comparison, the order JS `<` gives and Swift's utf16 compare
 *  reproduces. */
function cmp(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}

export interface BuildRowsArgs {
  records: readonly WidgetRecord[]
  handover: Pick<WidgetHandoverV1, 'recorded' | 'targetsMissingPhoto' | 'targetsMissingAudio' | 'targetsMissingVideo'>
  kind: WidgetKind
  window: WidgetWindow
  /** Ignored for lifers. */
  media: WidgetMedia
  reference: { lat: number; lng: number }
  nowMs: number
  tz: string
}

/** The whole ordered list; a family shows the first 1 / 3 / 8. */
export function buildWidgetRows(a: BuildRowsArgs): WidgetRow[] {
  const recorded = new Set(a.handover.recorded)
  const sets: Record<MediaNeed, Set<string>> = {
    photo: new Set(a.handover.targetsMissingPhoto),
    audio: new Set(a.handover.targetsMissingAudio),
    video: new Set(a.handover.targetsMissingVideo),
  }
  const today = localCivilDate(a.nowMs, a.tz)

  interface Candidate { rec: WidgetRecord; fold: string; dist: number; days: number; missing: MediaNeed[] }
  const best = new Map<string, Candidate>()

  for (const rec of a.records) {
    const fold = foldName(rec.comName)
    let missing: MediaNeed[] = []
    if (a.kind === 'lifers') {
      if (recorded.has(fold)) continue
    } else if (a.media === 'any') {
      missing = MEDIA_NEEDS.filter(t => sets[t].has(fold))
      if (missing.length === 0) continue
    } else {
      if (!sets[a.media].has(fold)) continue
      missing = [a.media]
    }
    const date = parseObsDateStrict(rec.obsDt)
    if (date === null) continue
    const days = daysBetween(date, today)
    if (a.window !== 'all' && !inWindow(days, a.window)) continue
    const dist = distanceMiles(a.reference.lat, a.reference.lng, rec.lat, rec.lng)
    const cand: Candidate = { rec, fold, dist, days, missing }
    const prev = best.get(rec.speciesCode)
    if (!prev
      || dist < prev.dist
      || (dist === prev.dist && (cmp(rec.obsDt, prev.rec.obsDt) > 0
        || (rec.obsDt === prev.rec.obsDt && cmp(rec.locId, prev.rec.locId) < 0)))) {
      best.set(rec.speciesCode, cand)
    }
  }

  const ordered = [...best.values()].sort((x, y) =>
    (x.dist - y.dist)
    || -cmp(x.rec.obsDt, y.rec.obsDt)
    || cmp(x.fold, y.fold)
    || cmp(x.rec.speciesCode, y.rec.speciesCode))

  const showNeeds = a.kind === 'targets' && a.media === 'any'
  return ordered.map(c => {
    const row: WidgetRow = {
      comName: c.rec.comName,
      speciesCode: c.rec.speciesCode,
      locId: c.rec.locId,
      locName: c.rec.locName,
      lat: c.rec.lat,
      lng: c.rec.lng,
      distanceMi: c.dist,
      distanceText: formatMiles(c.dist),
      daysAgo: c.days,
      recency: recencyLabel(c.days),
      obsDt: c.rec.obsDt,
      subId: c.rec.subId,
      missingMedia: c.missing,
      label: '',
    }
    row.label = rowLabel(row, showNeeds)
    return row
  })
}
