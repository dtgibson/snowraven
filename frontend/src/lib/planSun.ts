// The Weather/tide Planner's sun-altitude derivation (plan-sun-moon-readout,
// schema B; PRD FR-26 to FR-28, FR-33, FR-34). Pure, dependency-free and
// entry-safe: it imports the merge's types only, so it rides the entry chunk
// beside lib/plan.ts (entryChunk.test.ts holds it to a closure of size 1).
//
// NOT TWINNED IN PYTHON, BY DESIGN (schema D5). Parity exists where two
// producers could disagree about a stored or transported value; this curve is
// produced by ONE runtime on every platform, enters no document, crosses no
// transport and is never stored, so there is nothing for a twin to agree with.
//
// DISPLAY ONLY. Nothing here is ever a source of a sunrise or sunset TIME shown
// anywhere: the forecast's listed instants stay the sole source (1.0.29 FR-42
// holds in substance). The computed geometric crossings below exist only to
// warp the computed curve onto the LISTED daytime, so the drawn track crosses
// zero exactly at the listed minute and its peak stays the computed maximum.
//
// The formula is the NOAA Solar Calculator's (Meeus, Astronomical Algorithms
// ch. 25, the low-precision series), in the order the schema fixes: geometric
// altitude of the sun's centre, no refraction, no semidiameter. Within about
// 0.05 degrees for 1950 to 2050, far inside the whole degree the readout prints
// and the pixel the chart draws. The anchors absorb the horizon convention
// (schema D4): whatever convention the provider used for its sunrise, the
// track crosses zero there.
//
// Every scan here is declared in the schema's section 8 with its bound: per
// plan, at most 16 days x 2 bisections x 20 evaluations to build the model,
// and at most hours x 4 + anchors samples (<= 1,568 at PLAN_DAYS_MAX) for the
// track, computed once per plan and never per pick or per density.

import type { Plan } from './plan'

const RAD = Math.PI / 180
const rad = (d: number): number => d * RAD
const deg = (r: number): number => r / RAD

/** The two solar quantities every figure here needs at instant `ts`: the
 *  sun's declination (degrees) and the equation of time (minutes). */
function solarParts(ts: number): { decl: number; eot: number } {
  const jc = ((ts / 86400) + 2440587.5 - 2451545) / 36525
  const L0 = (((280.46646 + jc * (36000.76983 + jc * 0.0003032)) % 360) + 360) % 360
  const M = 357.52911 + jc * (35999.05029 - 0.0001537 * jc)
  const e = 0.016708634 - jc * (0.000042037 + 0.0000001267 * jc)
  const C = Math.sin(rad(M)) * (1.914602 - jc * (0.004817 + 0.000014 * jc))
    + Math.sin(rad(2 * M)) * (0.019993 - 0.000101 * jc)
    + Math.sin(rad(3 * M)) * 0.000289
  const lam = L0 + C
  const omega = 125.04 - 1934.136 * jc
  const lamApp = lam - 0.00569 - 0.00478 * Math.sin(rad(omega))
  const eps0 = 23 + (26 + (21.448 - jc * (46.815 + jc * (0.00059 - jc * 0.001813))) / 60) / 60
  const eps = eps0 + 0.00256 * Math.cos(rad(omega))
  const decl = deg(Math.asin(Math.sin(rad(eps)) * Math.sin(rad(lamApp))))
  const y = Math.tan(rad(eps / 2)) ** 2
  const eot = 4 * deg(
    y * Math.sin(2 * rad(L0))
    - 2 * e * Math.sin(rad(M))
    + 4 * e * y * Math.sin(rad(M)) * Math.cos(2 * rad(L0))
    - 0.5 * y * y * Math.sin(4 * rad(L0))
    - 1.25 * e * e * Math.sin(2 * rad(M)),
  )
  return { decl, eot }
}

/**
 * The geometric altitude of the sun's centre in degrees at instant `ts`
 * (integer epoch seconds) for a place at `lat`, `lng` (degrees, east and north
 * positive). No refraction, no semidiameter.
 */
export function sunAltitudeDeg(lat: number, lng: number, ts: number): number {
  const { decl, eot } = solarParts(ts)
  let tst = ((((ts % 86400) + 86400) % 86400) / 60 + eot + 4 * lng) % 1440
  if (tst < 0) tst += 1440
  let H = tst / 4 - 180
  while (H < -180) H += 360
  const s = Math.sin(rad(lat)) * Math.sin(rad(decl)) + Math.cos(rad(lat)) * Math.cos(rad(decl)) * Math.cos(rad(H))
  return deg(Math.asin(Math.max(-1, Math.min(1, s))))
}

/**
 * The instant of local solar noon nearest `aroundTs`: 720 - 4 * lng - eot
 * minutes after the nearest UTC midnight, moved by whole days until it lies
 * within 12 hours of `aroundTs`. `lat` is part of the signature the schema
 * fixes; solar noon itself does not depend on it.
 */
export function solarNoonTs(lat: number, lng: number, aroundTs: number): number {
  void lat
  const { eot } = solarParts(aroundTs)
  const utcMidnight = aroundTs - ((((aroundTs % 86400) + 86400) % 86400))
  let noon = utcMidnight + (720 - 4 * lng - eot) * 60
  while (noon - aroundTs > 43200) noon -= 86400
  while (aroundTs - noon > 43200) noon += 86400
  return Math.round(noon)
}

export interface SunAnchor {
  kind: 'sunrise' | 'sunset'
  /** The LISTED instant from the document's day (never computed). */
  t: number
  /** The COMPUTED geometric crossing for that day, to one second, or null
   *  when the computed curve has no crossing on that side of noon (a polar
   *  day, a polar night, or a listed event the curve cannot reproduce). */
  tc: number | null
  dayIndex: number
}

export type SunSide = '+' | '-' | 'free'

export interface SunModelDay {
  startTs: number
  endTs: number
  /** The FR-27 / FR-28 sign rule for an instant of this day. */
  side: (t: number) => SunSide
}

export interface SunModel {
  lat: number
  lng: number
  axisStartTs: number
  endTs: number
  days: SunModelDay[]
  /** Ascending by t; at most two per day. */
  anchors: SunAnchor[]
}

const MAX_BISECT = 20

/** The one zero crossing of `alt` on [a, b], to one second, or null when the
 *  ends do not straddle zero. At most MAX_BISECT evaluations. */
function crossing(alt: (t: number) => number, a: number, b: number): number | null {
  let va = alt(a)
  const vb = alt(b)
  if ((va < 0) === (vb < 0)) return null
  let lo = a, hi = b
  for (let i = 0; i < MAX_BISECT; i += 1) {
    const mid = (lo + hi) / 2
    const vm = alt(mid)
    if ((vm < 0) === (va < 0)) { lo = mid; va = vm } else hi = mid
  }
  return Math.round((lo + hi) / 2)
}

const inRange = (lat: number, lng: number): boolean =>
  Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180

/**
 * One model per plan, from the document's latitude, longitude, window and
 * days. Null when the coordinates are not finite or out of range, which no
 * producer can emit and the composer does not range-check (schema D14): the
 * caller then draws no track, prints no sun line and no sun peak.
 *
 * Anchor admission, per day: a listed sunrise or sunset is an anchor only if
 * it lies within the day's own boundaries, and when both are listed only if
 * the sunrise precedes the sunset. A day failing either reads as listing
 * NEITHER for the track (FR-28's malformed-day rule); the list's own notes are
 * the document's and are unchanged.
 */
export function buildSunModel(plan: Plan): SunModel | null {
  const { lat, lng } = plan
  if (!inRange(lat, lng)) return null
  const alt = (t: number) => sunAltitudeDeg(lat, lng, t)
  const anchors: SunAnchor[] = []
  const days: SunModelDay[] = plan.days.map((d, dayIndex) => {
    const within = (t: number) => t >= d.startTs && t <= d.endTs
    const both = d.sunrise !== null && d.sunset !== null
    const ok = (both ? d.sunrise!.t < d.sunset!.t : true)
      && (d.sunrise === null || within(d.sunrise.t))
      && (d.sunset === null || within(d.sunset.t))
    const sr = ok && d.sunrise ? d.sunrise.t : null
    const ss = ok && d.sunset ? d.sunset.t : null
    if (sr !== null || ss !== null) {
      const noon = solarNoonTs(lat, lng, Math.round((d.startTs + d.endTs) / 2))
      if (sr !== null) anchors.push({ kind: 'sunrise', t: sr, tc: crossing(alt, noon - 43200, noon), dayIndex })
      if (ss !== null) anchors.push({ kind: 'sunset', t: ss, tc: crossing(alt, noon, noon + 43200), dayIndex })
    }
    const side = (t: number): SunSide => {
      if (sr !== null && ss !== null) return t < sr ? '-' : t <= ss ? '+' : '-'
      if (sr !== null) return t < sr ? '-' : '+'
      if (ss !== null) return t <= ss ? '+' : '-'
      return 'free'
    }
    return { startTs: d.startTs, endTs: d.endTs, side }
  })
  anchors.sort((a, b) => a.t - b.t)
  return { lat, lng, axisStartTs: plan.window.axisStartTs, endTs: plan.window.endTs, days, anchors }
}

/** The day's side rule for `t`, or 'free' for an instant no day covers. */
function sideAt(model: SunModel, t: number): SunSide {
  for (const d of model.days) if (t >= d.startTs && t <= d.endTs) return d.side(t)
  return 'free'
}

/** Index of the first anchor whose t is strictly after `t` (binary search). */
function anchorAfter(anchors: ReadonlyArray<SunAnchor>, t: number): number {
  let lo = 0, hi = anchors.length
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (anchors[mid].t <= t) lo = mid + 1
    else hi = mid
  }
  return lo
}

/** The computed instant the listed instant `t` maps to: a time warp between
 *  consecutive anchors that both carry a computed crossing, else a constant
 *  shift from whichever nearby anchor has one, else `t` itself. */
function warp(model: SunModel, t: number): number {
  const A = model.anchors
  const i = anchorAfter(A, t)
  const a = i > 0 ? A[i - 1] : null
  const b = i < A.length ? A[i] : null
  if (a && b && a.tc !== null && b.tc !== null && b.tc > a.tc && b.t > a.t) {
    return a.tc + (t - a.t) * (b.tc - a.tc) / (b.t - a.t)
  }
  const n = a && a.tc !== null ? a : b && b.tc !== null ? b : null
  return n ? t + (n.tc! - n.t) : t
}

/** The inverse of `warp` for a computed instant `tc`: the listed instant that
 *  maps onto it, so a computed solar noon can be placed on the drawn axis. */
function unwarp(model: SunModel, tc: number): number {
  const A = model.anchors
  for (let i = 0; i + 1 < A.length; i += 1) {
    const a = A[i], b = A[i + 1]
    if (a.tc !== null && b.tc !== null && b.tc > a.tc && b.t > a.t && a.tc <= tc && tc <= b.tc) {
      return a.t + (tc - a.tc) * (b.t - a.t) / (b.tc - a.tc)
    }
  }
  let nearest: SunAnchor | null = null
  for (const a of A) {
    if (a.tc === null) continue
    if (!nearest || Math.abs(a.tc - tc) < Math.abs(nearest.tc! - tc)) nearest = a
  }
  return nearest ? tc - (nearest.tc! - nearest.t) : tc
}

/**
 * The ANCHORED altitude at instant `t`: the one function the track samples and
 * the readout reads (FR-12, FR-27). Shape by the time warp, sign by the day's
 * side clamp ('+' gives max(0, v), '-' gives min(0, v), 'free' gives v). At an
 * anchor's own t the result is exactly 0, so on a day listing both events the
 * value is <= 0 before the listed sunrise, 0 at it, > 0 strictly between, 0 at
 * the listed sunset and <= 0 after: the sign changes at the listed minutes and
 * nowhere else.
 */
export function sunAltitudeAt(model: SunModel, t: number): number {
  const A = model.anchors
  const i = anchorAfter(A, t)
  if (i > 0 && A[i - 1].t === t) return 0
  let v = sunAltitudeDeg(model.lat, model.lng, warp(model, t))
  const side = sideAt(model, t)
  if (side === '+') v = Math.max(0, v)
  else if (side === '-') v = Math.min(0, v)
  return v
}

export interface SunSample { t: number; deg: number }

const QUARTER = 900

/**
 * The track's samples: one at every 15-minute mark of the location's clock in
 * [axisStartTs, endTs] plus one at every anchor's t, ascending and
 * de-duplicated. Every real zone offset is a multiple of 900 s, so the marks
 * coincide with UTC quarter marks (planPick.ts states and tests the same
 * fact). Count <= hours x 4 + anchors (QA-33); computed once per plan and
 * never resampled with density (FR-33). The quarter marks are the pick's
 * quarter marks, so a keyboard step lands on a drawn sample.
 */
export function sunTrack(model: SunModel): SunSample[] {
  const out: SunSample[] = []
  const first = Math.ceil(model.axisStartTs / QUARTER) * QUARTER
  let ai = 0
  const A = model.anchors
  const push = (t: number) => {
    if (out.length > 0 && out[out.length - 1].t === t) return
    out.push({ t, deg: sunAltitudeAt(model, t) })
  }
  for (let t = first; t <= model.endTs; t += QUARTER) {
    while (ai < A.length && A[ai].t < t) {
      if (A[ai].t >= model.axisStartTs) push(A[ai].t)
      ai += 1
    }
    push(t)
  }
  while (ai < A.length) {
    if (A[ai].t >= model.axisStartTs && A[ai].t <= model.endTs) push(A[ai].t)
    ai += 1
  }
  return out
}

export interface SunPeak { dayIndex: number; t: number; deg: number }

/**
 * Per day, the sun's highest anchored altitude and its instant: the maximum
 * over that day's quarter-mark samples, its anchors and the warped solar noon
 * (so the peak is the computed maximum, not a sample short of it). The WHOLE
 * day is sampled, including the part of the first day already behind the
 * axis start, because the list must know whether today's peak has passed
 * (design D4-08). Null for a day the model cannot sample (a malformed day
 * whose end precedes its start).
 */
export function sunPeakByDay(model: SunModel): Array<SunPeak | null> {
  return model.days.map((d, dayIndex) => {
    if (!(d.endTs >= d.startTs)) return null
    let best: SunPeak | null = null
    const consider = (t: number) => {
      const v = sunAltitudeAt(model, t)
      if (!best || v > best.deg) best = { dayIndex, t, deg: v }
    }
    const first = Math.ceil(d.startTs / QUARTER) * QUARTER
    for (let t = first; t <= d.endTs; t += QUARTER) consider(t)
    for (const a of model.anchors) if (a.dayIndex === dayIndex) consider(a.t)
    const noon = unwarp(model, solarNoonTs(model.lat, model.lng, Math.round((d.startTs + d.endTs) / 2)))
    if (noon >= d.startTs && noon <= d.endTs) consider(Math.round(noon))
    return best
  })
}

export interface SunRun { kind: 'day' | 'night'; pts: SunSample[] }

/**
 * The track's runs, split at the horizon (design, "Style, split at the
 * horizon"): classify each SEGMENT between consecutive samples (day if either
 * end is above zero, else night) and group consecutive segments of one kind
 * into a run. Adjacent runs share their boundary sample, which on an anchored
 * day is the listed sunrise or sunset at exactly zero, so the day and night
 * lines meet at the horizon and the curve stays continuous. Grouping by
 * segment cannot produce a one-sample stray of the other kind.
 */
export function sunTrackRuns(samples: ReadonlyArray<SunSample>): SunRun[] {
  const runs: SunRun[] = []
  let cur: SunRun | null = null
  for (let i = 0; i + 1 < samples.length; i += 1) {
    const a = samples[i], c = samples[i + 1]
    const kind: SunRun['kind'] = a.deg > 0 || c.deg > 0 ? 'day' : 'night'
    if (!cur || cur.kind !== kind) { cur = { kind, pts: [a] }; runs.push(cur) }
    cur.pts.push(c)
  }
  return runs
}
