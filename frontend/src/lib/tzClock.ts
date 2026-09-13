// The location's clock, computed once, by the composer (tide-weather-planner,
// schema section 5). Twin of backend/services/tz_clock.py; both are driven from
// the same fixture (tzClock.fixture.json) so a DST edge or a half-hour zone
// cannot be placed differently on the two transports.
//
// Every `ts` is an integer epoch SECOND and every arithmetic result is an
// integer; the wall-clock string is display-only and is never compared, sorted
// or bracketed by (schema section 5: one axis, real elapsed time). Pure: no
// clock is read here, `ts` is always an argument.
//
// Intl formatters are memoised per zone because the weather builder calls
// `localClock` for every day, event and cell of a plan, and constructing an
// Intl.DateTimeFormat is the expensive half of formatting.

const fmtCache = new Map<string, Intl.DateTimeFormat>()

function fmtFor(tz: string): Intl.DateTimeFormat {
  let f = fmtCache.get(tz)
  if (!f) {
    f = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      hourCycle: 'h23',
    })
    fmtCache.set(tz, f)
  }
  return f
}

interface WallParts { y: number; mo: number; d: number; h: number; mi: number; s: number }

function wallParts(ts: number, tz: string): WallParts {
  const parts = fmtFor(tz).formatToParts(new Date(ts * 1000))
  const g = (t: string) => Number(parts.find(p => p.type === t)?.value ?? '0')
  // Some ICU builds still spell midnight '24' under h23 for the hour part.
  const h = g('hour') === 24 ? 0 : g('hour')
  return { y: g('year'), mo: g('month'), d: g('day'), h, mi: g('minute'), s: g('second') }
}

const pad2 = (n: number) => String(n).padStart(2, '0')

/** The zone's UTC offset in seconds at instant `ts` (east positive). */
export function utcOffsetSec(ts: number, tz: string): number {
  const p = wallParts(ts, tz)
  return Math.round(Date.UTC(p.y, p.mo - 1, p.d, p.h, p.mi, p.s) / 1000) - ts
}

/** 'YYYY-MM-DD HH:MM' in the zone. Display only. */
export function localClock(ts: number, tz: string): string {
  const p = wallParts(ts, tz)
  return `${p.y}-${pad2(p.mo)}-${pad2(p.d)} ${pad2(p.h)}:${pad2(p.mi)}`
}

/** 'YYYY-MM-DD' in the zone: the first ten characters of `localClock`. */
export function localDate(ts: number, tz: string): string {
  return localClock(ts, tz).slice(0, 10)
}

/** The instant the zone's current hour began: `ts` rolled back to :00 on the
 *  LOCATION's clock, so a half-hour zone gets its own hour boundary. */
export function startOfLocalHour(ts: number, tz: string): number {
  const off = utcOffsetSec(ts, tz)
  return ts - ((((ts + off) % 3600) + 3600) % 3600)
}

/** 'YYYY-MM-DD' plus `days` calendar days, pure calendar arithmetic. */
export function addDays(date: string, days: number): string {
  const y = Number(date.slice(0, 4)), mo = Number(date.slice(5, 7)), d = Number(date.slice(8, 10))
  const t = new Date(Date.UTC(y, mo - 1, d + days))
  return `${t.getUTCFullYear()}-${pad2(t.getUTCMonth() + 1)}-${pad2(t.getUTCDate())}`
}

/**
 * The instant local midnight begins on `date` in the zone, as an integer epoch
 * second.
 *
 * A zone whose midnight is ambiguous (a fall-back at 01:00 makes 00:00 occur
 * twice) settles on the FIRST occurrence; a zone whose midnight does not exist
 * (a spring-forward at 00:00) settles on the first existing instant after the
 * gap. Both are exactly what Python's zoneinfo gives `fold=0`, which is what
 * the twin relies on, so the two composers place day boundaries identically.
 * No US zone changes its clock at midnight, so on every US fixture the three
 * candidates below agree and the answer is the one fixed point.
 */
export function localMidnightTs(date: string, tz: string): number {
  const y = Number(date.slice(0, 4)), mo = Number(date.slice(5, 7)), d = Number(date.slice(8, 10))
  const wall = Math.round(Date.UTC(y, mo - 1, d) / 1000)
  // The offsets in force half a day either side of the naive instant cover
  // every transition that could touch this midnight.
  const offsets = new Set<number>()
  for (const probe of [wall - 43200, wall, wall + 43200]) offsets.add(utcOffsetSec(probe, tz))
  const candidates = [...offsets].map(off => wall - off).sort((a, b) => a - b)
  const wanted = `${date} 00:00`
  const exact = candidates.filter(c => localClock(c, tz) === wanted)
  if (exact.length > 0) return exact[0]
  // A gap: no instant reads 00:00. fold=0 uses the offset in force BEFORE the
  // transition, which is the offset at the earliest candidate.
  return wall - utcOffsetSec(candidates[0], tz)
}
