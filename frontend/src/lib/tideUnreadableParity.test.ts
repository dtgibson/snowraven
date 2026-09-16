// SHARED-FIXTURE GROUND-TRUTH TEST -- the TS half of the tide builders'
// unreadable-timestamp contract. The Python half is
// backend/tests/test_tide_unreadable_parity.py and drives the SAME
// tideUnreadable.fixture.json.
//
// WHY THIS FILE IS NOT A PARITY TEST, AND WHY THAT IS THE WHOLE POINT.
// Every other cross-transport fixture in this repo asserts that the two
// runtimes AGREE. That is exactly the check this defect was invisible to:
// measured at HEAD, 20 of the 23 unreadable `t` shapes below produced a water
// level that both runtimes rendered BYTE FOR BYTE IDENTICALLY and that was
// wrong in both, because `_epoch_min` / `epochMin` anchored an unreadable
// timestamp at the 1970 epoch and 1970 is 56 years from the window -- so the
// interpolation fraction collapsed to ~0.99999 and the reading degenerated into
// "return the other bracket". A window whose true answer is `2.4 - 2.8 ft`
// rendered `1.5 - 1.5 ft`: plausible, in range, correctly rounded, and wrong by
// however far the window sat from that bracket.
// `weather-at-malformed-parity/decisions.md` section 4 named the shape: **an
// agreeing wrong number is invisible to every cross-transport parity check by
// construction.**
//
// So every assertion here is against GROUND TRUTH, derived structurally on this
// runtime alone: **a `t` that cannot be placed on the epoch axis means that
// point is MISSING, so the rendered block must equal the block this same
// builder produces from the same series with that entry REMOVED.** The fixture
// carries the roster, the scenarios and the agreed placement verdict; it does
// not carry an expected string, because a generated expected column would have
// recorded the wrong answer twice and a hand-typed one would encode the author's
// model of the data, which is the model that wrote the bug (v1.0.21).
//
// The cross-transport claim is then a consequence rather than the assertion:
// both halves drive one roster against one structural property, so agreement is
// what is left over when both are right.
//
// DELETION COVERAGE (v1.0.20). Single-sourcing a predicate across two languages
// stops the copies drifting and does nothing to stop one being DROPPED, so this
// side owns a test that fails when THIS side's placement filter is removed:
// `an unplaceable point is dropped` below is that test, and removing the
// `placeInstant` filter in `computeTideReading` turns its rows red here while
// the Python suite stays green.
import { describe, it, expect } from 'vitest'
import {
  clockTime, computeTideReading, parseObserved, parsePredictions, parseHiLo,
  type TideReading,
} from './tide'
import { formatTideBody } from './tideFormatter'
import { buildTidePlan, planTideRange } from './tidePlan'
import type { TideStation } from './tideStations'
import fixture from './tideUnreadable.fixture.json'

// ── the shared shape DSL ─────────────────────────────────────────────────────
// Deliberately re-implemented on each side rather than shared: the Python half
// applying the same roster to the same bodies from its own code is what the
// cross-transport claim consists of. The CONFORMING rows are what catch a
// mis-implementation of the DSL itself.
type Index = number | 'all'
interface Shape { id: string; op: 'set' | 'delete'; t?: unknown; placeable: boolean; why: string }
interface Scenario { id: string; series: 'hilo' | 'observed' | 'pool'; index: Index; why: string }
interface DivisorPair { id: string; a: string; b: string; verdict: 'ok' | 'unavailable'; why: string }

const F = fixture as unknown as {
  station: TideStation
  distanceMi: number
  window: { start: string; end: string }
  control: {
    hilo: Array<Record<string, unknown>>
    observed: Array<Record<string, unknown>>
    pool: Array<Record<string, unknown>>
  }
  shapes: Shape[]
  scenarios: Scenario[]
  divisorPairs: DivisorPair[]
  plan: {
    nowTs: number; tz: string; distanceMi: number
    hilo: Array<Record<string, unknown>>
    index: number
    shapes: string[]
    placeableNotPositive: Array<{ t: string; why: string }>
  }
}

const SHAPES = F.shapes
const UNPLACEABLE = SHAPES.filter(s => !s.placeable)
const PLACEABLE = SHAPES.filter(s => s.placeable)
const { start, end } = F.window

/** The roster row applied to one entry (or every entry) of a series. */
function applyShape(rows: Array<Record<string, unknown>>, index: Index, shape: Shape): unknown[] {
  return rows.map((row, i) => {
    if (index !== 'all' && i !== index) return { ...row }
    if (shape.op === 'delete') {
      const copy = { ...row }
      delete copy.t
      return copy
    }
    return { ...row, t: shape.t }
  })
}

/** The same series with that entry (or every entry) REMOVED: ground truth. */
function withoutIndex(rows: Array<Record<string, unknown>>, index: Index): unknown[] {
  return index === 'all' ? [] : rows.filter((_, i) => i !== index).map(r => ({ ...r }))
}

/** The three NOAA bodies a scenario feeds the builder, from one mutated series. */
function bodiesFor(scenario: Scenario, rows: unknown[]) {
  const noData = { error: { message: 'No data was found.' } }
  if (scenario.series === 'hilo') return { obs: noData, pred: { predictions: [] }, hilo: { predictions: rows } }
  if (scenario.series === 'observed') return { obs: { data: rows }, pred: { predictions: [] }, hilo: { predictions: F.control.hilo } }
  // 'pool': no window samples and no curve at all, so the nearest-point
  // fall-back is the branch under test.
  return { obs: { data: rows }, pred: { predictions: [] }, hilo: { predictions: [] } }
}

/** What the route would answer, as one comparable string. A throw is rendered
 *  rather than swallowed: the Python twin raised `ZeroDivisionError` on the
 *  divisor pairs where this one produced `-Infinity`, and a caught throw that
 *  vanished into `unavailable` is precisely how that asymmetry stayed hidden. */
function render(scenario: Scenario, rows: unknown[]): string {
  const { obs, pred, hilo } = bodiesFor(scenario, rows)
  let reading: TideReading | null
  try {
    reading = computeTideReading(
      start, end,
      parseObserved(obs), parsePredictions(pred), parseHiLo(hilo),
      F.station, F.distanceMi,
    )
  } catch (e) {
    return `(threw: ${(e as Error).name})`
  }
  return reading === null ? '(unavailable)' : formatTideBody(reading)
}

function readingFor(scenario: Scenario, rows: unknown[]): TideReading | null {
  const { obs, pred, hilo } = bodiesFor(scenario, rows)
  return computeTideReading(
    start, end,
    parseObserved(obs), parsePredictions(pred), parseHiLo(hilo),
    F.station, F.distanceMi,
  )
}

const seriesOf = (s: Scenario) => F.control[s.series]

// A copy block reads `Previous high: 3.6 ft at 10:09am`. These are the two
// shapes a dangling clock takes: nothing after the "at" (an empty or absent
// `t`), and something that is not a clock (`at not a date`, `at 1:61pm`).
const DANGLING_END = / at ?$/m
const DANGLING_NON_DIGIT = / at (?![0-9])/

describe('tideUnreadable fixture', () => {
  it('carries the shapes that discriminate, and both verdicts', () => {
    const ids = new Set(SHAPES.map(s => s.id))
    // Each of these separates something. Without them the roster would be a
    // list of obviously-broken strings, which is the roster that cannot see a
    // twin divergence (.claude/rules/security.md).
    expect(ids.has('arabic-indic-digits'), 'a non-ASCII digit row').toBe(true)
    expect(ids.has('trailing-newline'), 'a trailing-newline row').toBe(true)
    expect(ids.has('leading-newline'), 'a leading-newline row').toBe(true)
    expect(ids.has('embedded-newline'), 'an embedded-newline row').toBe(true)
    expect(ids.has('the-epoch-itself'), 'the sentinel collision').toBe(true)
    expect(ids.has('far-past'), 'a placeable NEGATIVE epoch').toBe(true)
    expect(ids.has('iso-t-separator'), 'the `T` separator the class admits').toBe(true)
    // Non-string `t`: the four shapes whose two coercions disagreed.
    for (const id of ['null', 'boolean', 'empty-list', 'empty-object']) {
      expect(ids.has(id), `a non-string \`t\`: ${id}`).toBe(true)
    }
    // Both verdicts represented, so a roster that degenerated to all-refusing
    // (or all-accepting) fails loudly rather than passing vacuously.
    expect(UNPLACEABLE.length).toBeGreaterThan(0)
    expect(PLACEABLE.length).toBeGreaterThan(0)
    expect(new Set(SHAPES.map(s => s.id)).size).toBe(SHAPES.length)
  })

  // ── 1. an unplaceable `t` removes its point from the series ────────────────
  // THE DELETION TEST FOR THIS SIDE. Remove `computeTideReading`'s placement
  // filter and these rows go red here while the Python suite stays green.
  describe('an unplaceable point is dropped', () => {
    for (const scenario of F.scenarios) {
      for (const shape of UNPLACEABLE) {
        it(`${scenario.id} / ${shape.id}`, () => {
          const rows = seriesOf(scenario)
          expect(render(scenario, applyShape(rows, scenario.index, shape)))
            .toBe(render(scenario, withoutIndex(rows, scenario.index)))
        })
      }
    }
  })

  // ── 2. no copy block ever contains a dangling clock ────────────────────────
  it.each(F.scenarios.map(s => [s.id, s] as const))('no dangling clock reaches the copy block: %s', (_id, scenario) => {
    const rows = seriesOf(scenario)
    for (const shape of SHAPES) {
      const body = render(scenario, applyShape(rows, scenario.index, shape))
      expect(body, `${shape.id}: nothing after "at"`).not.toMatch(DANGLING_END)
      expect(body, `${shape.id}: a non-clock after "at"`).not.toMatch(DANGLING_NON_DIGIT)
    }
  })

  // ── 3. no reading carries a non-finite level ───────────────────────────────
  it.each(F.scenarios.map(s => [s.id, s] as const))('every reading is finite: %s', (_id, scenario) => {
    const rows = seriesOf(scenario)
    for (const shape of SHAPES) {
      const reading = readingFor(scenario, applyShape(rows, scenario.index, shape))
      if (reading === null) continue
      expect(Number.isFinite(reading.levelMin), `${shape.id}: levelMin`).toBe(true)
      expect(Number.isFinite(reading.levelMax), `${shape.id}: levelMax`).toBe(true)
      const body = formatTideBody(reading)
      expect(body, `${shape.id}: body`).not.toMatch(/Infinity|NaN/)
    }
  })

  // ── 4. the divisor pairs ───────────────────────────────────────────────────
  // Missing-vs-zero does not close these and that is measured, not argued:
  // `interpLevel` brackets on the STRING and divides on the EPOCH, so its
  // `prev.t === next.t` guard never saw two distinct strings naming one instant.
  describe('a zero divisor never reaches the reading', () => {
    for (const pair of F.divisorPairs) {
      it(pair.id, () => {
        const rows = F.control.hilo.map((row, i) => ({ ...row, t: i === 0 ? pair.a : pair.b }))
        const scenario: Scenario = { id: 'divisor', series: 'hilo', index: 0, why: '' }
        const reading = readingFor(scenario, rows)
        if (pair.verdict === 'unavailable') {
          expect(reading).toBeNull()
          return
        }
        expect(reading).not.toBeNull()
        expect(Number.isFinite(reading!.levelMin)).toBe(true)
        expect(Number.isFinite(reading!.levelMax)).toBe(true)
        expect(formatTideBody(reading!)).not.toMatch(/Infinity|NaN/)
      })
    }
  })

  // ── 5. the parsers agree on a non-string `t` ───────────────────────────────
  // They diverged BEFORE the sentinel was ever reached: `String(null)` is `''`
  // and `str(None)` is `'None'`, and `'None'` sorts AFTER every real timestamp
  // where `''` sorts before -- so the two runtimes bracketed the window with
  // different points and took different branches.
  it('a non-string `t` never becomes a coerced string', () => {
    for (const shape of SHAPES.filter(s => s.op === 'delete' || typeof s.t !== 'string')) {
      const rows = applyShape(F.control.hilo, 0, shape)
      const parsed = parseHiLo({ predictions: rows })
      expect(parsed, `${shape.id}: the entry is dropped by the parser`).toHaveLength(F.control.hilo.length - 1)
      const obs = parseObserved({ data: applyShape(F.control.observed, 0, shape) })
      expect(obs, `${shape.id}: observed`).toHaveLength(F.control.observed.length - 1)
      const pred = parsePredictions({ predictions: applyShape(F.control.hilo, 0, shape) })
      expect(pred, `${shape.id}: predictions`).toHaveLength(F.control.hilo.length - 1)
    }
  })

  it('a conforming `t` is untouched by that rule', () => {
    expect(parseHiLo({ predictions: F.control.hilo })).toHaveLength(F.control.hilo.length)
    expect(parseObserved({ data: F.control.observed })).toHaveLength(F.control.observed.length)
  })

  // ── 6. the Planner is the third twin pair on this axis ─────────────────────
  // Its span filter hid the divergence: the impossible-calendar shapes that
  // roll OUTSIDE the fetched span were dropped for that reason and agreed by
  // accident. Every shape here rolls INTO it.
  describe('the Planner drops an unplaceable point too', () => {
    const P = F.plan
    const span = planTideRange(P.nowTs, P.tz)
    const station = { id: F.station.id, name: F.station.name }
    const plan = (rows: unknown[]) => JSON.stringify(
      buildTidePlan({ predictions: [] }, { predictions: rows }, station, P.distanceMi, P.tz, span))

    for (const t of P.shapes) {
      it(t, () => {
        const mutated = P.hilo.map((row, i) => (i === P.index ? { ...row, t } : { ...row }))
        const dropped = P.hilo.filter((_, i) => i !== P.index).map(r => ({ ...r }))
        expect(plan(mutated)).toBe(plan(dropped))
      })
    }

    it('a conforming turning point is still kept', () => {
      const dropped = P.hilo.filter((_, i) => i !== P.index).map(r => ({ ...r }))
      expect(plan(P.hilo)).not.toBe(plan(dropped))
      const doc = buildTidePlan({ predictions: [] }, { predictions: P.hilo }, station, P.distanceMi, P.tz, span)
      expect(doc.status).toBe('ok')
      expect(doc.status === 'ok' && doc.turningPoints).toHaveLength(P.hilo.length)
    })

    // The predicate is PLACEABLE, not POSITIVE. Every shape above is refused by
    // both spellings, so the roster alone cannot separate them -- a mutation
    // reverting this pair to `t > 0` left the whole file green until these two
    // rows existed, which is a finding about the test rather than about the fix.
    it.each(P.placeableNotPositive.map(r => [r.t, r] as const))('placeable, not positive: %s', (_label, row) => {
      const doc = buildTidePlan(
        { predictions: [{ t: row.t, v: '3.500' }] }, { predictions: [] },
        station, P.distanceMi, P.tz, span)
      expect(doc.status, row.why).toBe('ok')
    })

    it('an unplaceable continuous point still yields `unavailable`', () => {
      // The non-vacuity leg for the two rows above: the same body shape with an
      // unreadable `t` must NOT be kept, or they would pass against a predicate
      // that keeps everything.
      const doc = buildTidePlan(
        { predictions: [{ t: 'not a date', v: '3.500' }] }, { predictions: [] },
        station, P.distanceMi, P.tz, span)
      expect(doc.status).toBe('unavailable')
    })
  })

  // ── 6b. the clock never renders a time it did not place ────────────────────
  // `clockTime` / `_clock` used to re-SCAN the string with an unanchored
  // `[ T](\d{2}):(\d{2})`, so `2026/05/01 10:09` rendered `10:09am` and
  // `2026-13-40 25:61` rendered `1:61pm` -- sixty-one minutes past one, after
  // the word "at", in a permanent public checklist comment. Python's `\d` also
  // matched Unicode decimal digits where this runtime's did not, which was the
  // open half of F2 from pipeline/tide-timezone-parse that build 4 deferred
  // here by name.
  //
  // THIS BLOCK EXISTS BECAUSE THE PLACEMENT FILTER HID THE NEED FOR IT.
  // Reverting the scan left every other row in this file green, since
  // `computeTideReading` labels only points that survived the filter -- so the
  // fence build 4 handed over would have been closed with nothing pinning it
  // closed. Asserting the passthrough is VERBATIM (rather than merely
  // "not clock-shaped") is what also catches the Arabic-Indic divergence, where
  // the reverted Python half renders a half-ASCII clock.
  describe('the clock is formatted from the placed instant, never re-scanned', () => {
    const STRINGS = SHAPES.filter(s => typeof s.t === 'string')
    const CLOCK = /^([0-9]|1[0-2]):[0-9]{2}(am|pm)$/

    it.each(STRINGS.filter(s => !s.placeable).map(s => [s.id, s] as const))('refuses: %s', (_id, shape) => {
      expect(clockTime(shape.t as string), shape.why).toBe(shape.t)
    })

    it.each(STRINGS.filter(s => s.placeable).map(s => [s.id, s] as const))('renders: %s', (_id, shape) => {
      expect(clockTime(shape.t as string), shape.why).toMatch(CLOCK)
    })

    it('reads the same clock off every separator the class admits', () => {
      expect(clockTime('2026-05-01 10:09')).toBe('10:09am')
      expect(clockTime('2026-05-01T10:09')).toBe('10:09am')
      expect(clockTime('2026-05-01 10:09:30')).toBe('10:09am')
      expect(clockTime('2026-05-01 00:00')).toBe('12:00am')
      expect(clockTime('2026-05-01 12:00')).toBe('12:00pm')
    })
  })

  // ── 7. the control, which is what makes every row above a measurement ──────
  it('the control window reads the level the data supports', () => {
    const reading = readingFor({ id: 'control', series: 'hilo', index: 0, why: '' }, F.control.hilo)!
    expect(reading).not.toBeNull()
    const body = formatTideBody(reading)
    expect(body).toContain('Water level: 2.4 – 2.8 ft')
    expect(body).toContain('Previous high: 3.6 ft at 10:09am')
    expect(body).toContain('Next low: 1.5 ft at 3:07pm')
  })
})
