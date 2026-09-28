// The per-day county observations reducer (targets-tab, schema.md section 4.3)
// and the two parameter validators of `/map/county-day-obs`.
//
// TWINNED with `backend/services/county_day_obs.py` (`reduce_county_day_obs`,
// `is_valid_day_obs_date`). The shared fixture `countyDayObs.fixture.json` is
// generated from THIS module by `countyDayObs.fixtureGen.test.ts` (env-gated)
// and both runtimes assert every row against it, so the twins agree on what a
// MALFORMED record or parameter is, not only on what a conforming one produces
// (security.md, v1.0.29).
//
// Shaped like `reduceWidgetRecords`, NOT like `reduceRecentObs` (which casts
// with `as string ?? ''` and range-checks nothing): every field of every record
// is judged here, a body that is not a list is a 502 thrown from INSIDE the
// caller's try, and at most DAY_OBS_MAX_RECORDS records are ever read.
//
// Linearity (security.md, declared in schema.md section 10): one pass over at
// most 5,000 records, a Map keyed by species code for the dedupe, and anchored
// fixed-width patterns over strings already bounded at 512 code units.
//
// Dependency-light: `speciesCode.ts` only, so the day cache can import the
// record validator without pulling transport or storage.

import { SPECIES_CODE_RE } from './speciesCode'

/** At most this many records are READ from one eBird body; the rest are ignored. */
export const DAY_OBS_MAX_RECORDS = 5000
/** Desktop refuses a body longer than this many code units before JSON.parse. */
export const DAY_OBS_MAX_BODY_CHARS = 2_000_000
/** Every string field is at most this many UTF-16 code units, else the record goes. */
export const DAY_OBS_MAX_STRING = 512

export const DAY_DATE_RE = /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/
export const OBS_DT_RE = /^[0-9]{4}-[0-9]{2}-[0-9]{2}( [0-9]{2}:[0-9]{2})?$/
export const DAY_LOC_ID_RE = /^L[0-9]{1,15}$/

export const DAY_OBS_MIN_YEAR = 1900
export const DAY_OBS_MAX_YEAR = 2100

export interface DayRecord {
  speciesCode: string
  obsDt: string
  /** A public or personal eBird location id, or null when absent or malformed. */
  locId: string | null
  /** Display only. */
  locName: string
  /** Both null when either is missing, non-finite or out of range. */
  lat: number | null
  lng: number | null
}

export interface DayObsPayload {
  regionCode: string
  date: string
  species: DayRecord[]
}

function isLeapYear(y: number): boolean {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0
}

/**
 * True when (y, m, d) is a real Gregorian calendar day. Days-in-month
 * arithmetic, deliberately NEVER `new Date(y, m - 1, d)`: `Date` rolls
 * `2026-02-30` forward into March rather than refusing it, exactly where the
 * Python twin's `date.fromisoformat` raises (the `tideService` lesson).
 */
export function isRealCalendarDay(y: number, m: number, d: number): boolean {
  if (!Number.isInteger(y) || !Number.isInteger(m) || !Number.isInteger(d)) return false
  if (m < 1 || m > 12 || d < 1) return false
  const days = m === 2 ? (isLeapYear(y) ? 29 : 28) : [4, 6, 9, 11].includes(m) ? 30 : 31
  return d <= days
}

/** The route's `date` parameter: the anchored pattern, a real day, a year in
 *  [1900, 2100]. Twin of `is_valid_day_obs_date`. */
export function isValidDayObsDate(date: string): boolean {
  if (typeof date !== 'string' || !DAY_DATE_RE.test(date)) return false
  const y = Number(date.slice(0, 4))
  const m = Number(date.slice(5, 7))
  const d = Number(date.slice(8, 10))
  if (y < DAY_OBS_MIN_YEAR || y > DAY_OBS_MAX_YEAR) return false
  return isRealCalendarDay(y, m, d)
}

/** A finite number, and never a boolean (`typeof true` is not 'number' here,
 *  and the Python twin excludes `bool` explicitly, security.md v1.0.29). */
function isFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v)
}

function boundedString(v: unknown): v is string {
  return typeof v === 'string' && v.length <= DAY_OBS_MAX_STRING
}

/**
 * The record validator the day cache runs on load AND at its write chokepoint,
 * so a stored entry and a fresh response have one shape and one judge.
 */
export function isValidDayRecord(r: unknown, date: string): r is DayRecord {
  if (r === null || typeof r !== 'object' || Array.isArray(r)) return false
  const rec = r as Record<string, unknown>
  if (!boundedString(rec.speciesCode) || !SPECIES_CODE_RE.test(rec.speciesCode)) return false
  if (!boundedString(rec.obsDt) || !OBS_DT_RE.test(rec.obsDt) || rec.obsDt.slice(0, 10) !== date) return false
  if (rec.locId !== null && !(boundedString(rec.locId) && DAY_LOC_ID_RE.test(rec.locId))) return false
  if (!boundedString(rec.locName)) return false
  if (rec.lat === null && rec.lng === null) return true
  return isFiniteNumber(rec.lat) && isFiniteNumber(rec.lng)
    && rec.lat >= -90 && rec.lat <= 90 && rec.lng >= -180 && rec.lng <= 180
}

/** The 502 shape both desktop failure paths throw (twin of the backend's
 *  HTTPException(502)). `isOfflineError` reads a status >= 100 as NOT offline,
 *  so a malformed body never shows as "you're offline". */
export function unexpectedEbirdResponse(): Error & { status: number; detail: string } {
  return Object.assign(new Error('Unexpected eBird response.'), {
    status: 502, detail: 'Unexpected eBird response.',
  })
}

const STRING_FIELDS = ['speciesCode', 'obsDt', 'locName'] as const

/**
 * Reduce one eBird `data/obs/{region}/historic/{y}/{m}/{d}` body to one record
 * per species: the most recent report of that species in the county that day.
 */
export function reduceCountyDayObs(body: unknown, regionCode: string, date: string): DayObsPayload {
  if (!Array.isArray(body)) throw unexpectedEbirdResponse()
  const best = new Map<string, DayRecord>()
  const n = Math.min(body.length, DAY_OBS_MAX_RECORDS)
  for (let i = 0; i < n; i++) {
    const raw: unknown = body[i]
    if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) continue
    const obs = raw as Record<string, unknown>
    let bad = false
    for (const f of STRING_FIELDS) {
      if (!boundedString(obs[f])) { bad = true; break }
    }
    if (bad) continue
    const speciesCode = obs.speciesCode as string
    const obsDt = obs.obsDt as string
    if (!SPECIES_CODE_RE.test(speciesCode)) continue
    if (!OBS_DT_RE.test(obsDt) || obsDt.slice(0, 10) !== date) continue
    // locId is optional in the record's shape: a present but malformed id is
    // dropped to null rather than dropping the whole sighting, because the day
    // count does not depend on it.
    const rawLoc = obs.locId
    if (rawLoc !== undefined && rawLoc !== null && typeof rawLoc !== 'string') continue
    if (typeof rawLoc === 'string' && rawLoc.length > DAY_OBS_MAX_STRING) continue
    const locId = typeof rawLoc === 'string' && DAY_LOC_ID_RE.test(rawLoc) ? rawLoc : null
    const lat = obs.lat
    const lng = obs.lng
    const coordsOk = isFiniteNumber(lat) && isFiniteNumber(lng)
      && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180
    const record: DayRecord = {
      speciesCode,
      obsDt,
      locId,
      locName: obs.locName as string,
      lat: coordsOk ? lat : null,
      lng: coordsOk ? lng : null,
    }
    const prev = best.get(speciesCode)
    if (prev === undefined || obsDt > prev.obsDt) best.set(speciesCode, record)
  }
  return { regionCode, date, species: [...best.values()] }
}
