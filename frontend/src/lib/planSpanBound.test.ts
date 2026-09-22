// The Planner's two magnitude chokepoints (plan-sun-sampling-bound; the Low and
// the Informational from the v1.0.30 security review). Four loops in the
// Planner are driven by numbers an untrusted document supplies and enforce no
// ceiling of their own: `sunTrack`'s quarter marks, `sunPeakByDay`'s per-day
// marks, and both of PlanChart's `yMin..yMax` gridline loops. Nothing is
// clamped in any of the four; the bound is a property of the DOCUMENT
// `composePlan` emits and of the DOMAIN `planGeometry` returns, so this file
// asserts the bound where a consumer inherits it rather than where a consumer
// would have applied it.
//
// A NEW FILE RATHER THAN ROWS IN `weatherTidePlanBound.test.ts`, deliberately.
// That suite is about the SERIALIZED SIZE of the stored halves through the
// SHIPPED PRODUCERS on one fixture family; this one is about LOOP COUNTS
// through the MERGE over hostile documents no producer wrote, and it carries a
// deliberately-expensive growth row that needs its own `testTimeout`. Putting
// the two in one file would hang that timeout question over rows that have no
// timing in them. The one thing the two files share is the pinning pattern:
// `weatherTidePlanBound.test.ts` pins `PLAN_MAX_CODE_UNITS * 10` to
// `REPLAY_MAX_BYTES`, and the constants block below pins `PLAN_SPAN_MAX_S` to
// `weatherPlan.ts`'s `PLAN_DAYS_MAX`, which `lib/plan.ts` may not import
// (entryChunk.test.ts holds its closure to exactly itself).
import { describe, it, expect } from 'vitest'
import { createHash } from 'node:crypto'
import fixture from './weatherTidePlan.fixture.json'
import golden from './planSpanBound.golden.json'
import {
  composePlan, PLAN_COMPOSE_DAYS_MAX, PLAN_DAY_MAX_S, PLAN_SPAN_MAX_S, PLAN_TS_ABS_MAX,
  type Plan, type TidePlanResponse, type WeatherPlan,
} from './plan'
import { buildWeatherPlan, PLAN_DAYS_MAX } from './weatherPlan'
import { buildSunModel, solarNoonTs, sunPeakByDay, sunTrack, wholeDayNormalize, type SunModel } from './planSun'
import { planGeometry, PLAN_Y_ABS_MAX_FT, type PlanGeometry } from './planChartGeometry'
import { addDays, localMidnightTs, startOfLocalHour } from './tzClock'
import type { OneCallResponse } from './forecastSlice'

const DAY = 86400
const QUARTER = 900

/** The declared sample ceiling, DERIVED here from the shipped constants rather
 *  than typed in, so `planSun.ts`'s header and `schema.md` section 8 cannot
 *  drift from the code: one quarter mark per QUARTER of the widest window, one
 *  more for the inclusive end, plus at most two anchors per admitted day. */
const SUN_SAMPLES_MAX = PLAN_SPAN_MAX_S / QUARTER + 1 + 2 * PLAN_COMPOSE_DAYS_MAX
/** `sunPeakByDay`'s ceiling: per day, that day's own quarter marks plus its two
 *  anchors plus the warped solar noon. */
const PEAK_EVALS_MAX = PLAN_COMPOSE_DAYS_MAX * (PLAN_DAY_MAX_S / QUARTER + 1 + 2 + 1)
/** Both gridline loops step by 2 over the clamped domain, inclusive. */
const GRIDLINES_MAX = PLAN_Y_ABS_MAX_FT + 1

interface Family {
  name: string
  tz: string
  nowTs: number
  lat: number
  lng: number
  onecall: unknown
  expectedWeather: { ok: true; plan: WeatherPlan } | { ok: false }
  expectedTide: TidePlanResponse
}
const families = (fixture as { families: Family[] }).families
const usable = families.filter(f => f.expectedWeather.ok)
const planOf = (f: Family): Plan =>
  composePlan((f.expectedWeather as { ok: true; plan: WeatherPlan }).plan, f.expectedTide)!

// ── hostile document builders ───────────────────────────────────────────────

const T0 = 1789252860 // the fixture's own fetch moment

/** A weather half with a chosen window span, day count and per-day span. Every
 *  field is the shape the merge type-checks, so nothing here is refused for
 *  being malformed: only the MAGNITUDES are hostile. */
function hostileWeather(o: { axisStartTs?: number; span: number; dayCount: number; daySpan: number }): Record<string, unknown> {
  const axisStartTs = o.axisStartTs ?? T0
  const days: unknown[] = []
  for (let i = 0; i < o.dayCount; i += 1) {
    const startTs = axisStartTs + i * (o.daySpan + 1)
    days.push({ date: `d${i}`, startTs, endTs: startTs + o.daySpan, sunrise: null, sunset: null })
  }
  return {
    tz: 'America/Los_Angeles', lat: 36.603, lng: -121.876, fetchedAt: axisStartTs,
    window: {
      startTs: axisStartTs, startLocal: 'x', endTs: axisStartTs + o.span, endLocal: 'y',
      axisStartTs, axisStartLocal: 'z',
    },
    hourlyEndTs: axisStartTs, days, events: [], cells: [], nightSpans: [],
  }
}

/** An ok tide half whose curve carries the given heights. */
function hostileTide(vs: number[]): Record<string, unknown> {
  return {
    status: 'ok', source: 'predicted', station: { id: '9413450', name: 'MONTEREY' }, distanceMi: 0.9,
    tz: 'America/Los_Angeles', continuous: true, range: { startTs: T0, endTs: T0 + 8 * DAY },
    curve: vs.map((v, i) => ({ t: T0 + i * 1800, v, hilo: false })),
    turningPoints: [],
  }
}

/** The quarter marks `sunPeakByDay` actually walks, counted from the model the
 *  same way that loop derives them, plus the anchors and the solar noon it
 *  considers. A count of the loop's iterations, not an estimate of them. */
function peakEvaluations(model: SunModel): number {
  let n = 0
  for (const d of model.days) {
    if (!(d.endTs >= d.startTs)) continue
    const first = Math.ceil(d.startTs / QUARTER) * QUARTER
    if (d.endTs >= first) n += Math.floor((d.endTs - first) / QUARTER) + 1
    n += 1 // the warped solar noon
  }
  return n + model.anchors.length
}

/** PlanChart's own gridline derivation (`PlanChart.tsx:377` and `:640`, byte
 *  for byte), with a HARD ITERATION CAP. The cap is not belt and braces: with
 *  the domain clamp mutated out and `v` at Number.MAX_VALUE, `Math.ceil(yMin)`
 *  is about -1.8e308 and `v += 2` does not advance it at all, so the shipped
 *  loop does not merely run long, it never terminates. A red-first mutation
 *  has to FAIL, not hang. */
const GRID_SAFETY = 200_000
function gridlineCount(g: PlanGeometry): number {
  let n = 0
  for (let v = Math.ceil(g.yMin); v <= Math.floor(g.yMax); v += 2) {
    n += 1
    if (n > GRID_SAFETY) return n
  }
  return n
}

// ── the constants and their relation ────────────────────────────────────────

describe('the constants, and the two files that must not drift apart', () => {
  it('PLAN_SPAN_MAX_S is the product of the day cap and the day span cap', () => {
    expect(PLAN_SPAN_MAX_S).toBe(PLAN_COMPOSE_DAYS_MAX * PLAN_DAY_MAX_S)
    // lib/plan.ts cannot import PLAN_DAYS_MAX (entryChunk.test.ts pins its
    // closure to exactly itself and weatherPlan.ts is on the forbidden-reach
    // list), so the merge declares its own. This row is the pin.
    expect(PLAN_COMPOSE_DAYS_MAX).toBe(PLAN_DAYS_MAX)
    expect(PLAN_SPAN_MAX_S).toBe(PLAN_DAYS_MAX * PLAN_DAY_MAX_S)
  })

  it('each constant is pinned by VALUE, not only by its relation', () => {
    // Per .claude/rules/security.md: a relation is true for every value of its
    // terms, so the safe range is asserted directly.
    expect(PLAN_DAY_MAX_S).toBe(26 * 3600)
    expect(PLAN_COMPOSE_DAYS_MAX).toBe(16)
    expect(PLAN_SPAN_MAX_S).toBe(1_497_600)
    expect(PLAN_Y_ABS_MAX_FT).toBe(100)
  })

  it('the declared ceilings are the ones planSun.ts and schema.md section 8 print', () => {
    expect(SUN_SAMPLES_MAX).toBe(1697)
    expect(PEAK_EVALS_MAX).toBe(1728)
    expect(GRIDLINES_MAX).toBe(101)
  })
})

// ── (a) the sample bound over hostile documents ─────────────────────────────

const SPANS: Array<[string, number]> = [
  ['16 d', 16 * DAY],
  ['1 y', 365 * DAY],
  ['16 y', 16 * 365 * DAY],
  ['MAX_SAFE_INTEGER', Number.MAX_SAFE_INTEGER],
]
const DAY_COUNTS = [16, 2_000, 20_000]
const DAY_SPANS: Array<[string, number]> = [['1 d', DAY - 1], ['365 d', 365 * DAY]]

describe('the sun track and the per-day peaks are bounded for any document that reaches them', () => {
  for (const [spanName, span] of SPANS) {
    for (const dayCount of DAY_COUNTS) {
      for (const [dsName, daySpan] of DAY_SPANS) {
        it(`window ${spanName}, ${dayCount} days of ${dsName}`, () => {
          const plan = composePlan(hostileWeather({ span, dayCount, daySpan }), null)!
          expect(plan).not.toBeNull()
          expect(plan.window.endTs - plan.window.axisStartTs).toBeLessThanOrEqual(PLAN_SPAN_MAX_S)
          expect(plan.days.length).toBeLessThanOrEqual(PLAN_COMPOSE_DAYS_MAX)
          for (const d of plan.days) {
            const s = d.endTs - d.startTs
            expect(s).toBeGreaterThanOrEqual(0)
            expect(s).toBeLessThanOrEqual(PLAN_DAY_MAX_S)
          }
          const model = buildSunModel(plan)!
          expect(sunTrack(model).length).toBeLessThanOrEqual(SUN_SAMPLES_MAX)
          expect(peakEvaluations(model)).toBeLessThanOrEqual(PEAK_EVALS_MAX)
          expect(sunPeakByDay(model).length).toBeLessThanOrEqual(PLAN_COMPOSE_DAYS_MAX)
        })
      }
    }
  }

  it('the roster is not vacuous: the widest rows really are refused, not merely small', () => {
    // Without the clamps these same documents ask for 1.001e13 samples and
    // 20,000 days. Assert the UNCLAMPED numbers are what the document states,
    // so a future change that makes `hostileWeather` produce something tame
    // cannot quietly turn this whole describe into a no-op.
    const raw = hostileWeather({ span: Number.MAX_SAFE_INTEGER, dayCount: 20_000, daySpan: 365 * DAY }) as {
      window: { endTs: number; axisStartTs: number }; days: unknown[]
    }
    // `>` rather than `===`: at this magnitude `(T0 + MAX) - T0` is not MAX,
    // which is itself part of the point.
    expect(raw.window.endTs - raw.window.axisStartTs).toBeGreaterThan(9e15)
    expect(raw.days).toHaveLength(20_000)
    expect(Number.MAX_SAFE_INTEGER / QUARTER).toBeGreaterThan(1e12)
  })

  it('a clamped window drops its end LABEL rather than printing the instant it no longer ends at', () => {
    const plan = composePlan(hostileWeather({ span: 16 * 365 * DAY, dayCount: 16, daySpan: DAY - 1 }), null)!
    expect(plan.window.endLocal).toBe('')
    // ...and an unclamped window keeps it, so the row above is about the clamp.
    const ok = composePlan(hostileWeather({ span: 8 * DAY, dayCount: 8, daySpan: DAY - 1 }), null)!
    expect(ok.window.endLocal).toBe('y')
  })

  it('THE LIVE PATH: 16 daily entries a year apart through the SHIPPED builder', () => {
    // The v1.0.30 record's "no shipped path can produce such a document" is
    // false, and this row is the correction. `buildWeatherPlan` caps the day
    // COUNT and then takes endTs from the last day, which is derived from the
    // provider's own `dt`: no hand-edited replay.json anywhere.
    const ref = families.find(f => f.name === 'reference')!
    const oc = ref.onecall as { current: unknown; hourly: unknown[]; daily: Array<Record<string, unknown>> }
    const template = oc.daily[0]
    const daily = Array.from({ length: 24 }, (_, i) => {
      const dt = ref.nowTs + i * 365 * DAY
      return { ...template, dt, sunrise: dt + 7 * 3600, sunset: dt + 19 * 3600 }
    })
    const built = buildWeatherPlan({ ...oc, daily } as unknown as OneCallResponse, ref.nowTs, ref.tz, ref.lat, ref.lng)
    expect(built.ok).toBe(true)
    const half = (built as { ok: true; plan: WeatherPlan }).plan
    // The producer emits it: 16 days (its own cap) spanning thousands of days.
    expect(half.days).toHaveLength(PLAN_DAYS_MAX)
    const rawSpan = half.window.endTs - half.window.axisStartTs
    expect(rawSpan).toBeGreaterThan(5_000 * DAY)
    // The merge refuses it.
    const plan = composePlan(half, null)!
    expect(plan.window.endTs - plan.window.axisStartTs).toBeLessThanOrEqual(PLAN_SPAN_MAX_S)
    const model = buildSunModel(plan)!
    expect(sunTrack(model).length).toBeLessThanOrEqual(SUN_SAMPLES_MAX)
  })
})

// ── (b2) the loop ANCHOR's magnitude ────────────────────────────────────────

// THE ROWS BELOW DRIVE THE LOOPS, WHICH IS THE WHOLE POINT OF THEM.
//
// The security review's Medium: the span clamps bound a SPAN and say nothing
// about where that span SITS. QUARTER is 900, and from |t| >= 2^63 (about
// 9.223e18) one ulp of a double exceeds 900, so `t += QUARTER` rounds back to
// `t` and neither `sunTrack`'s nor `sunPeakByDay`'s loop variable advances at
// all: a permanent hang inside a `useMemo` in a render body, not a slow draw.
// At 1e30 the span clamp works perfectly (the composed span is 0, because
// `axisStartTs + PLAN_SPAN_MAX_S` rounds back to `axisStartTs`) and the loop
// still hangs, because `first` lands on `endTs` and one iteration is enough.
//
// The corpus that came back clean before this guard existed varied the SPAN
// and pinned `axisStartTs` at T0; the one corpus that did vary the magnitude
// asserted on `composePlan`'s output span alone and never called either loop.
// So every row here composes AND THEN WALKS BOTH LOOPS over whatever the merge
// admitted.
//
// IT WALKS THEM THROUGH A CAPPED REPLICA FIRST, AND THAT IS NOT BELT AND
// BRACES -- IT IS THE ONLY SHAPE THAT FAILS. A `testTimeout` cannot interrupt a
// SYNCHRONOUS loop: the timer that would fire sits behind the same blocked
// thread, so a mutated-out guard would hang the whole file rather than turn one
// row red (measured: the first draft of this suite ran a worker at 96% CPU for
// minutes with a 5,000 ms timeout stated and never failed). The replicas below
// are the shipped loops verbatim with a `GRID_SAFETY`-style iteration cap, the
// same device `gridlineCount` already uses for the same reason, and they run
// BEFORE the real functions so a regression fails in milliseconds and never
// reaches a real call.
const MAGNITUDE_TIMEOUT_MS = 5_000
const STEP_SAFETY = 200_000

/** `sunTrack`'s quarter-mark walk (planSun.ts, verbatim) with a hard cap: a
 *  non-advancing `t` lands on the cap and returns a count above every declared
 *  ceiling instead of spinning. */
function quarterMarkSteps(from: number, to: number): number {
  let n = 0
  for (let t = Math.ceil(from / QUARTER) * QUARTER; t <= to; t += QUARTER) {
    n += 1
    if (n > STEP_SAFETY) return n
  }
  return n
}

/** Compose, then walk every loop the composed document drives, and report which
 *  way the merge went. Order matters: the magnitude of each admitted instant,
 *  then the capped replicas, then the real functions -- so a mutated-out guard
 *  fails on the first assertion and the real (hanging) call is never made. */
function composeThenWalkBothLoops(doc: unknown): 'refused' | 'admitted' {
  const plan = composePlan(doc, null)
  if (plan === null) return 'refused'
  expect(Math.abs(plan.window.axisStartTs)).toBeLessThan(PLAN_TS_ABS_MAX)
  expect(quarterMarkSteps(plan.window.axisStartTs, plan.window.endTs)).toBeLessThanOrEqual(SUN_SAMPLES_MAX)
  for (const d of plan.days) {
    expect(Math.abs(d.startTs)).toBeLessThan(PLAN_TS_ABS_MAX)
    expect(Math.abs(d.endTs)).toBeLessThan(PLAN_TS_ABS_MAX)
    expect(quarterMarkSteps(d.startTs, d.endTs)).toBeLessThanOrEqual(PEAK_EVALS_MAX)
  }
  const model = buildSunModel(plan)
  expect(model).not.toBeNull()
  expect(sunTrack(model!).length).toBeLessThanOrEqual(SUN_SAMPLES_MAX)
  expect(peakEvaluations(model!)).toBeLessThanOrEqual(PEAK_EVALS_MAX)
  expect(sunPeakByDay(model!).length).toBeLessThanOrEqual(PLAN_COMPOSE_DAYS_MAX)
  return 'admitted'
}

/** A conforming window carrying exactly one day with the given instants, so a
 *  day row varies the day's magnitude and nothing else. */
function weatherWithOneDay(startTs: number, endTs: number): Record<string, unknown> {
  const doc = hostileWeather({ span: DAY, dayCount: 0, daySpan: DAY - 1 })
  doc.days = [{ date: 'd0', startTs, endTs, sunrise: null, sunset: null }]
  return doc
}

describe('the loop anchor is bounded too, so neither sun loop can fail to advance', () => {
  it('the constant is the ECMAScript Date range IN THIS DOCUMENT\'S UNIT, and the mechanism is real', () => {
    // Epoch SECONDS: the Date range is +/- 8.64e15 ms, so +/- 8.64e12 here.
    // The unconverted figure is not a near miss, it is the band where
    // `solarNoonTs` hangs by a different mechanism (decisions.md, Stage 4).
    expect(PLAN_TS_ABS_MAX).toBe(8.64e12)
    expect(PLAN_TS_ABS_MAX * 1000).toBe(100_000_000 * 86_400_000)
    // Non-vacuity on the mechanism itself: the quarter step still advances the
    // loop variable at the constant, and does not at 2^63 and above.
    expect(PLAN_TS_ABS_MAX + QUARTER).toBeGreaterThan(PLAN_TS_ABS_MAX)
    expect(-PLAN_TS_ABS_MAX + QUARTER).toBeGreaterThan(-PLAN_TS_ABS_MAX)
    expect(2 ** 63 + QUARTER).toBe(2 ** 63)
    expect(1e19 + QUARTER).toBe(1e19)
    expect(Number.MAX_VALUE + QUARTER).toBe(Number.MAX_VALUE)
    // ...and the replica really does catch a non-advancing walk rather than
    // spinning on it, which is what makes the rows below fail red.
    expect(quarterMarkSteps(1e19, 1e19 + 1e9)).toBeGreaterThan(STEP_SAFETY)
  })

  const WINDOW_ROWS: Array<[string, number]> = [
    ['1e19', 1e19],
    ['-1e19', -1e19],
    ['Number.MAX_VALUE', Number.MAX_VALUE],
    ['-Number.MAX_VALUE', -Number.MAX_VALUE],
  ]
  for (const [name, axisStartTs] of WINDOW_ROWS) {
    it(`sunTrack: a window anchored at ${name} is refused`, () => {
      expect(composeThenWalkBothLoops(hostileWeather({ axisStartTs, span: DAY, dayCount: 0, daySpan: DAY - 1 })))
        .toBe('refused')
    }, MAGNITUDE_TIMEOUT_MS)
  }

  it('sunTrack: the window boundary, inside admitted and at the constant refused', () => {
    for (const sign of [1, -1]) {
      // Inside: the whole window sits below the constant, and its track is
      // walked for real (96 quarter marks, measured at 0.2 to 0.3 ms).
      expect(composeThenWalkBothLoops(hostileWeather({
        axisStartTs: sign * (PLAN_TS_ABS_MAX - 1 - DAY), span: DAY, dayCount: 0, daySpan: DAY - 1,
      })), `admitted side, sign ${sign}`).toBe('admitted')
      expect(composeThenWalkBothLoops(hostileWeather({
        axisStartTs: sign * PLAN_TS_ABS_MAX, span: DAY, dayCount: 0, daySpan: DAY - 1,
      })), `refused side, sign ${sign}`).toBe('refused')
    }
  }, MAGNITUDE_TIMEOUT_MS)

  it('an absurd endTs is still TRUNCATED rather than refused: the anchor test does not swallow the span clamp', () => {
    // `endTs` deliberately keeps the weaker `isNum`, because the span clamp
    // already pins it to `axisStartTs + PLAN_SPAN_MAX_S`. This row is the
    // statement of that decision: the merge's oldest hostile document (a
    // MAX_SAFE_INTEGER end) must still compose, not disappear.
    const plan = composePlan(hostileWeather({ span: Number.MAX_SAFE_INTEGER, dayCount: 16, daySpan: DAY - 1 }), null)
    expect(plan).not.toBeNull()
    expect(plan!.window.endTs - plan!.window.axisStartTs).toBe(PLAN_SPAN_MAX_S)
    expect(Math.abs(plan!.window.endTs)).toBeLessThan(PLAN_TS_ABS_MAX)
  })

  const DAY_ROWS: Array<[string, number]> = [['1e19', 1e19], ['-1e19', -1e19]]
  for (const [name, ts] of DAY_ROWS) {
    it(`sunPeakByDay: a zero-span day at ${name} is dropped`, () => {
      // A span of 0 is what clamp 3 (`span >= 0 && span <= PLAN_DAY_MAX_S`)
      // admits, so this day reaches the loop on the strength of the span clamp
      // alone. It is the magnitude guard that drops it.
      const doc = weatherWithOneDay(ts, ts)
      expect(composeThenWalkBothLoops(doc)).toBe('admitted')
      expect(composePlan(doc, null)!.days).toHaveLength(0)
    }, MAGNITUDE_TIMEOUT_MS)
  }

  it('sunPeakByDay: the day boundary, inside admitted and at the constant refused', () => {
    for (const sign of [1, -1]) {
      const hi = sign * (PLAN_TS_ABS_MAX - 1)
      const inside = sign > 0 ? weatherWithOneDay(hi - (DAY - 1), hi) : weatherWithOneDay(hi, hi + (DAY - 1))
      expect(composeThenWalkBothLoops(inside), `admitted side, sign ${sign}`).toBe('admitted')
      // ...and the admitted day really did drive the loop rather than slipping
      // through as an empty one: one day, a real span, 96 quarter marks.
      const keptPlan = composePlan(inside, null)!
      expect(keptPlan.days).toHaveLength(1)
      expect(keptPlan.days[0].endTs - keptPlan.days[0].startTs).toBe(DAY - 1)
      expect(peakEvaluations(buildSunModel(keptPlan)!)).toBeGreaterThan(90)

      const at = sign * PLAN_TS_ABS_MAX
      const outside = sign > 0 ? weatherWithOneDay(at - (DAY - 1), at) : weatherWithOneDay(at, at + (DAY - 1))
      expect(composeThenWalkBothLoops(outside), `refused side, sign ${sign}`).toBe('admitted')
      expect(composePlan(outside, null)!.days, `refused side, sign ${sign}`).toHaveLength(0)
    }
  }, MAGNITUDE_TIMEOUT_MS)
})

// ── (b3) the whole-day normalization, loop replaced by one step ─────────────

// `solarNoonTs`'s whole-day move used to be two `while` loops stepping 86,400 s
// at a time, so it ran |eot| / 1440 times; `eot` is unbounded past |t| about
// 2.1e12 s (`eps0` carries a jc^3 term, so `tan(eps / 2)` runs through a pole),
// and at `aroundTs = 4,979,577,600,000` -- an instant well inside the
// +/- PLAN_TS_ABS_MAX the merge admits -- it needed 9.19e18 iterations, which
// is a hang and not a slow call. `wholeDayNormalize` does it in one step.
//
// THE EQUALITY IS ASSERTED STRUCTURALLY, never against a hand-typed expected
// column: the rows below keep a private copy of the OLD loop with a hard
// iteration cap and require the shipped closed form to agree with it on every
// corpus point where that loop terminated inside the cap. A hand-typed column
// would just encode the model that wrote the replacement.
const OLD_LOOP_CAP = 100_000

/** The old normalization, verbatim, with a cap. `capped` marks the points the
 *  loop could not finish -- exactly the points that used to hang. */
function oldWholeDayLoop(noon0: number, aroundTs: number): { value: number; iters: number; capped: boolean } {
  let noon = noon0, iters = 0
  while (noon - aroundTs > 43200) {
    noon -= 86400; iters += 1
    if (iters > OLD_LOOP_CAP) return { value: noon, iters, capped: true }
  }
  while (aroundTs - noon > 43200) {
    noon += 86400; iters += 1
    if (iters > OLD_LOOP_CAP) return { value: noon, iters, capped: true }
  }
  return { value: noon, iters, capped: false }
}

describe('solar noon normalizes in one step, and the step equals the loop it replaced', () => {
  it('the closed form equals the capped old loop at every generated point the loop could finish', () => {
    // Generated, not rostered: every real day midpoint the fixture families
    // carry, plus a magnitude sweep, crossed with an `eot` sweep that includes
    // both half-day ties (+/- 720 min is exactly +/- 43,200 s from midnight).
    const anchors: number[] = []
    for (const f of usable) {
      for (const d of (f.expectedWeather as { ok: true; plan: WeatherPlan }).plan.days) {
        anchors.push(Math.round((d.startTs + d.endTs) / 2), d.startTs, d.endTs)
      }
    }
    for (const m of [1e6, 1e9, 2e12]) for (const k of [0, 1, 43_199, 43_200, 43_201, 86_399]) {
      anchors.push(Math.round(m) + k, -Math.round(m) - k)
    }
    // UTC midnights specifically: with lng 0 and eot 0 the offset is exactly
    // +43,200 s, the half-day tie, so the corpus contains the one point where
    // the obvious one-liner and the loop disagree rather than only the
    // dedicated row below asserting it.
    for (const m of [0, 86_400, 1e6, 1e9, 2e12]) {
      const mid = Math.round(m / 86_400) * 86_400
      anchors.push(mid, -mid, mid + 43_200, -mid - 43_200)
    }
    const EOTS = [0, 720, -720, 1439, -1439, 1441, -1441, 10_000, -10_000, 0.5, -0.5]
    const LNGS = [-180, -121.876, 0, 73.4, 180]
    let compared = 0, cappedPoints = 0, shifted = 0
    for (const aroundTs of anchors) for (const eot of EOTS) for (const lng of LNGS) {
      const utcMidnight = aroundTs - ((((aroundTs % 86400) + 86400) % 86400))
      const noon0 = utcMidnight + (720 - 4 * lng - eot) * 60
      const old = oldWholeDayLoop(noon0, aroundTs)
      if (old.capped) { cappedPoints += 1; continue }
      const next = wholeDayNormalize(noon0, aroundTs)
      expect(next, `aroundTs ${aroundTs} eot ${eot} lng ${lng}`).toBe(old.value)
      expect(Math.round(next), `rounded, aroundTs ${aroundTs} eot ${eot} lng ${lng}`).toBe(Math.round(old.value))
      if (old.iters > 0) shifted += 1
      compared += 1
    }
    // Non-vacuity: the corpus is large, it is not all zero-shift points (so the
    // whole-day arithmetic is genuinely exercised), and nothing was skipped.
    expect(compared).toBeGreaterThan(5_000)
    expect(shifted).toBeGreaterThan(500)
    expect(cappedPoints).toBe(0)
  })

  it('the half-day tie keeps the loop\'s answer, which plain Math.round would move by a day', () => {
    // The one place the obvious one-liner is NOT equal to the loop: an offset
    // of exactly +43,200 s. The loop's conditions are strict, so it stays; the
    // half-up rounding of `Math.round(0.5)` would subtract a whole day.
    const aroundTs = 0
    expect(wholeDayNormalize(43_200, aroundTs)).toBe(43_200)
    expect(oldWholeDayLoop(43_200, aroundTs).value).toBe(43_200)
    expect(43_200 - 86_400 * Math.round(43_200 / 86_400)).toBe(-43_200) // the trap
    expect(wholeDayNormalize(-43_200, aroundTs)).toBe(-43_200)
    expect(wholeDayNormalize(43_201, aroundTs)).toBe(43_201 - 86_400)
    expect(wholeDayNormalize(-43_201, aroundTs)).toBe(-43_201 + 86_400)
  })

  it('solarNoonTs answers in one step at the instant whose old loop needed 9.19e18 iterations', () => {
    // The measured worst point inside PLAN_TS_ABS_MAX. The shipped function
    // must satisfy the loop's own postcondition -- within 12 hours of the
    // instant -- which the old code could only have reached after 9.19e18
    // steps. The capped replica states that second half: fed the same starting
    // offset magnitude, the old loop does not finish inside the cap.
    const aroundTs = 4_979_577_600_000
    expect(Math.abs(aroundTs)).toBeLessThan(PLAN_TS_ABS_MAX) // the merge admits it
    const n = solarNoonTs(36.603, -121.876, aroundTs)
    expect(Number.isFinite(n)).toBe(true)
    // WHAT IS AND IS NOT CLAIMED HERE, measured rather than assumed. The old
    // code did not return for this input at all. The closed form returns, in
    // one step -- but it does NOT land within half a day, and no arithmetic
    // could: `eot` at this instant puts the un-normalized noon about 7.9e23 s
    // away, where one ulp of a double is about 1.3e8 s, so half a day is far
    // below the resolution the value carries. It lands 34,326,528 s out (397
    // days), which is the ulp floor and not a loop remnant. The property that
    // matters is bounded and stated: it terminates, it is finite, and the
    // whole-day shift really happened (the residue is 16 orders of magnitude
    // under the offset it started from).
    expect(Math.abs(n - aroundTs)).toBeLessThan(500 * 86_400)
    expect(Math.abs(n - aroundTs) / 7.9e23).toBeLessThan(1e-12)
    // At a magnitude where half a day IS representable, the postcondition holds
    // exactly, so the row above is about precision and not about the formula.
    for (const a of [1_789_252_860, 2e12, -2e12]) {
      expect(Math.abs(solarNoonTs(36.603, -121.876, a) - a), `aroundTs ${a}`).toBeLessThanOrEqual(43_200)
    }
    // ...and the old mechanism could not have answered: an offset of this size
    // caps the replica out in the direction the loop would have stepped.
    const far = aroundTs + 9.19e18 * 86_400
    expect(oldWholeDayLoop(far, aroundTs).capped).toBe(true)
    expect(Number.isFinite(wholeDayNormalize(far, aroundTs))).toBe(true)
  })

  it('every fixture family\'s solar noons are unchanged in kind: within half a day, and integral', () => {
    for (const f of usable) {
      for (const d of planOf(f).days) {
        const around = Math.round((d.startTs + d.endTs) / 2)
        const n = solarNoonTs(f.lat, f.lng, around)
        expect(Math.abs(n - around), `${f.name} ${d.date}`).toBeLessThanOrEqual(43_200)
        expect(Number.isInteger(n), `${f.name} ${d.date}`).toBe(true)
      }
    }
  })
})

// ── (c) the gridline and y-tick loops ───────────────────────────────────────

describe('both gridline loops are bounded by the clamped y domain', () => {
  const MAGNITUDES: Array<[string, number]> = [
    ['1e3', 1e3], ['1e6', 1e6], ['1e9', 1e9], ['MAX_VALUE', Number.MAX_VALUE],
  ]
  for (const [name, v] of MAGNITUDES) {
    it(`tide v at +/- ${name}`, () => {
      const plan = composePlan(hostileWeather({ span: 8 * DAY, dayCount: 8, daySpan: DAY - 1 }), hostileTide([-v, 0, v]))!
      const g = planGeometry(plan, true)
      expect(Number.isFinite(g.yMin)).toBe(true)
      expect(Number.isFinite(g.yMax)).toBe(true)
      expect(g.yMax).toBeGreaterThan(g.yMin)
      expect(g.yMin).toBeGreaterThanOrEqual(-PLAN_Y_ABS_MAX_FT)
      expect(g.yMax).toBeLessThanOrEqual(PLAN_Y_ABS_MAX_FT)
      // Both loops in PlanChart.tsx are this loop; one count covers both.
      expect(gridlineCount(g)).toBeLessThanOrEqual(GRIDLINES_MAX)
      // `y` must stay finite, which is the reason the degenerate fallback exists.
      expect(Number.isFinite(g.y(0))).toBe(true)
    })
  }

  it('a curve lying WHOLLY beyond the ceiling falls back to a usable domain instead of collapsing', () => {
    for (const vs of [[1e6, 1e6 + 1], [-1e6, -1e6 - 1]]) {
      const plan = composePlan(hostileWeather({ span: 8 * DAY, dayCount: 8, daySpan: DAY - 1 }), hostileTide(vs))!
      const g = planGeometry(plan, true)
      expect(g.yMax).toBeGreaterThan(g.yMin)
      expect(Number.isFinite(g.y(0))).toBe(true)
      expect(gridlineCount(g)).toBeLessThanOrEqual(GRIDLINES_MAX)
    }
  })

  it('the chart width the same span drives is bounded too', () => {
    const plan = composePlan(hostileWeather({ span: Number.MAX_SAFE_INTEGER, dayCount: 16, daySpan: DAY - 1 }), null)!
    const g = planGeometry(plan, false)
    // 16 px/h over at most PLAN_SPAN_MAX_S, plus the gutter.
    expect(g.plotW).toBeLessThanOrEqual(PLAN_SPAN_MAX_S / 3600 * 16 + 1)
    expect(g.width).toBeLessThan(7_000)
  })
})

// ── (e) direction 2: what the NEW predicate must still admit ────────────────

describe('the symmetric difference, direction 2: every day a producer can write is still admitted', () => {
  // `.claude/rules/testing.md` (v1.0.32): direction 1 is the point of the
  // build; direction 2 is where the defect lives. A 32-row fixture reports only
  // on its own 32 rows, so this sweeps every calendar day of seven years in the
  // three fixture zones through the PRODUCER's own day construction
  // (`localMidnightTs(date) .. localMidnightTs(date + 1) - 1`, weatherPlan.ts
  // lines 160-161) and asserts the new predicate admits all of them.
  const ZONES = ['America/Los_Angeles', 'America/New_York', 'America/Anchorage']
  it('no day of 2024 through 2030 in any fixture zone is refused', () => {
    let scanned = 0, longest = 0, shortest = Infinity, dstDays = 0
    for (const tz of ZONES) {
      let date = '2024-01-01'
      while (date < '2031-01-01') {
        const startTs = localMidnightTs(date, tz)
        const endTs = localMidnightTs(addDays(date, 1), tz) - 1
        const span = endTs - startTs
        expect(span >= 0 && span <= PLAN_DAY_MAX_S, `${tz} ${date} span ${span}`).toBe(true)
        if (span !== DAY - 1) dstDays += 1
        if (span > longest) longest = span
        if (span < shortest) shortest = span
        scanned += 1
        date = addDays(date, 1)
      }
    }
    // Non-vacuity: the sweep really did meet the transitions, and the longest
    // day it found is the 89,999 s fall-back day the constant was sized from.
    expect(scanned).toBe(3 * 2557)
    expect(dstDays).toBe(3 * 7 * 2)
    expect(longest).toBe(89_999)
    expect(shortest).toBe(82_799)
    // ...and the constant clears the measured worst case with real headroom,
    // while a 24 h clamp would not. This is the row that decided the value.
    expect(longest).toBeLessThan(PLAN_DAY_MAX_S)
    expect(longest).toBeGreaterThan(DAY)
  })

  it('the dst-fall family\'s 89,999 s day survives the merge', () => {
    const f = families.find(x => x.name === 'dst-fall')!
    const raw = (f.expectedWeather as { ok: true; plan: WeatherPlan }).plan
    const spans = raw.days.map(d => d.endTs - d.startTs)
    expect(Math.max(...spans)).toBe(89_999)
    expect(planOf(f).days).toHaveLength(raw.days.length)
  })

  it('no window a producer can write exceeds the span clamp', () => {
    // The producer's window is `days[last].endTs - startOfLocalHour(nowTs)`,
    // and `nowTs` lies inside day 0, so the widest possible window is the sum
    // of PLAN_DAYS_MAX consecutive day spans. Swept over the same seven years
    // rather than argued from 16 x 86400.
    let widest = 0
    for (const tz of ZONES) {
      let date = '2024-01-01'
      while (date < '2030-06-01') {
        const axisStartTs = startOfLocalHour(localMidnightTs(date, tz) + 3600, tz)
        let last = date
        for (let i = 0; i < PLAN_DAYS_MAX; i += 1) last = addDays(last, 1)
        const endTs = localMidnightTs(last, tz) - 1
        widest = Math.max(widest, endTs - axisStartTs)
        date = addDays(date, 1)
      }
    }
    expect(widest).toBeGreaterThan(15 * DAY) // non-vacuous
    expect(widest).toBeLessThan(PLAN_SPAN_MAX_S)
  })
})

// ── (g) non-regression: every conforming family is byte-identical ───────────

describe('conforming documents are untouched by both clamps', () => {
  const rows = golden as Record<string, { len: number; sha256: string; yMin: number; yMax: number; samples: number; peaks: number }>

  it('the golden was taken from the pre-clamp merge and covers every usable family', () => {
    expect(Object.keys(rows).sort()).toEqual(usable.map(f => f.name).sort())
    expect(Object.keys(rows)).toHaveLength(12)
    for (const [name, r] of Object.entries(rows)) {
      expect(r.len, name).toBeGreaterThan(10_000)
      expect(r.sha256, name).toMatch(/^[0-9a-f]{64}$/)
    }
  })

  for (const f of usable) {
    it(`${f.name}: the composed document, the y domain and the sun derivation are unchanged`, () => {
      const r = rows[f.name]
      const plan = planOf(f)
      const s = JSON.stringify(plan)
      expect(s).toHaveLength(r.len)
      expect(createHash('sha256').update(s, 'utf8').digest('hex')).toBe(r.sha256)
      const hasTide = plan.tide?.status === 'ok' && plan.tide.curve.length > 0
      const g = planGeometry(plan, hasTide)
      expect(g.yMin).toBe(r.yMin)
      expect(g.yMax).toBe(r.yMax)
      const model = buildSunModel(plan)!
      expect(sunTrack(model)).toHaveLength(r.samples)
      expect(sunPeakByDay(model).filter(p => p !== null)).toHaveLength(r.peaks)
      // ...and the headroom is real, so a later tightening cannot silently
      // start truncating a conforming plan without this row going red.
      expect(plan.window.endTs - plan.window.axisStartTs).toBeLessThan(PLAN_SPAN_MAX_S)
      expect(sunTrack(model).length).toBeLessThan(SUN_SAMPLES_MAX)
      if (hasTide) for (const c of (plan.tide as { curve: Array<{ v: number }> }).curve) {
        expect(Math.abs(c.v)).toBeLessThan(PLAN_Y_ABS_MAX_FT)
      }
    })
  }
})

// ── (f) the growth check ────────────────────────────────────────────────────

// THE ABSOLUTE BUDGET, ARGUED.
//
// `frontend/vite.config.ts` sets no `testTimeout`, so every test inherits
// vitest's silent 5,000 ms default. The v1.0.32 rule is explicit about what
// that costs: `weatherStatsShared.test.ts` reasoned carefully about ratio noise
// and never about the wall-clock budget, landed at 4,696 ms on the tag-commit
// runner (about 6% of headroom), then tipped over on the next runner and left
// `main` RED. So this row states its own timeout, and the budget is argued from
// a measurement rather than from the shipped number plus a margin.
//
// Measured on the dev Mac with nothing else compiling, three runs of five
// repetitions each, warmed: the whole clamped chain (composePlan +
// buildSunModel + sunTrack + sunPeakByDay) costs 0.58 to 0.65 ms on the
// conforming `maximal` family, 0.96 to 1.01 ms on hostile A (2,000 days, a
// 16-year window) and 0.96 to 1.10 ms on hostile B (4,000 days, a 32-year
// window). BUDGET_MS is 300, about 270x the worst measured row, and TIMEOUT_MS
// is 20,000, about 66x the budget and 4x the default it replaces; the file as a
// whole runs in well under a second.
//
// Unclamped, hostile A does not finish at all: its window asks for 1.001e13
// samples. So the absolute budget is answering a linear-versus-unbounded
// question with many orders of magnitude between the two answers, and no
// margin here is anywhere near single-digit percent.
const BUDGET_MS = 300
const TIMEOUT_MS = 20_000
const REPS = 5

function chainMs(doc: unknown, reps = REPS): number {
  const t0 = performance.now()
  for (let i = 0; i < reps; i += 1) {
    const plan = composePlan(doc, null)!
    const model = buildSunModel(plan)!
    sunTrack(model)
    sunPeakByDay(model)
  }
  return (performance.now() - t0) / reps
}

describe('growth: the chain is flat past the clamps, not doubling with the document', () => {
  it('doubling the window span and the day count does not double the work', () => {
    const conforming = (usable.find(f => f.name === 'maximal')!.expectedWeather as { ok: true; plan: WeatherPlan }).plan
    // Documents are built OUTSIDE the timed region: the test's own array
    // construction is linear in the day count and is not what is being
    // measured.
    const a = hostileWeather({ span: 16 * 365 * DAY, dayCount: 2_000, daySpan: DAY - 1 })
    const b = hostileWeather({ span: 32 * 365 * DAY, dayCount: 4_000, daySpan: DAY - 1 })
    const tConforming = chainMs(conforming)
    const tA = chainMs(a)
    const tB = chainMs(b)
    // Flat, not 2x: `asDays` breaks at PLAN_COMPOSE_DAYS_MAX admitted days, so
    // doubling the array costs nothing downstream, and the window clamp holds
    // the sample count at the same ceiling for both.
    expect(tB, `A ${tA.toFixed(2)} ms, B ${tB.toFixed(2)} ms`).toBeLessThan(tA * 2.5 + 1)
    // Absolute, argued above.
    expect(tA).toBeLessThan(BUDGET_MS)
    expect(tB).toBeLessThan(BUDGET_MS)
    expect(tConforming).toBeLessThan(BUDGET_MS)
    // Non-vacuity: the hostile documents really are the big ones.
    expect((a as { days: unknown[] }).days).toHaveLength(2_000)
    expect((b as { days: unknown[] }).days).toHaveLength(4_000)
  }, TIMEOUT_MS)

  it('a per-day span of a year costs no more than a conforming day', () => {
    const wide = hostileWeather({ span: 16 * DAY, dayCount: 16, daySpan: 365 * DAY })
    const narrow = hostileWeather({ span: 16 * DAY, dayCount: 16, daySpan: DAY - 1 })
    expect(chainMs(wide)).toBeLessThan(BUDGET_MS)
    expect(chainMs(narrow)).toBeLessThan(BUDGET_MS)
    // Unclamped, `sunPeakByDay` walks 16 days each spanning a year: 164.61 ms
    // measured at Stage 1, against a clamped ceiling of PEAK_EVALS_MAX.
    const model = buildSunModel(composePlan(wide, null)!)!
    expect(peakEvaluations(model)).toBeLessThanOrEqual(PEAK_EVALS_MAX)
  }, TIMEOUT_MS)
})
