// The pick's arithmetic (plan-sun-moon-readout, schema E; QA-15, QA-20,
// QA-21): the tap threshold at its boundary, the bounds, minute rounding, the
// quarter marks over every fixture zone, every key from an aligned pick, an
// unaligned pick and no pick, across both clock-change families, and the
// clamps at both ends.
import { describe, it, expect } from 'vitest'
import fixture from './weatherTidePlan.fixture.json'
import { composePlan, type Plan, type TidePlanResponse, type WeatherPlan } from './plan'
import { PLAN_TAP_PX, isTap, isOnQuarterMark, pickBounds, quarterMarkToward, safeOffset, stepPick, toPickInstant, hourMarkToward, type PickKey } from './planPick'
import { localClock, localMidnightTs, utcOffsetSec } from './tzClock'

interface Family { name: string; tz: string; expectedWeather: { ok: true; plan: WeatherPlan } | { ok: false }; expectedTide: TidePlanResponse }
const families = (fixture as { families: Family[] }).families.filter(f => f.expectedWeather.ok)
const planOf = (name: string): Plan => {
  const f = families.find(x => x.name === name)!
  return composePlan((f.expectedWeather as { ok: true; plan: WeatherPlan }).plan, f.expectedTide)!
}
const clock = (t: number, tz: string) => localClock(t, tz).slice(11)
/** The instant a local clock reads on a date, from the day's midnight. */
const at = (plan: Plan, date: string, h: number, m: number) => localMidnightTs(date, plan.tz) + h * 3600 + m * 60

describe('the tap threshold (OQ-09)', () => {
  it('is 5 CSS px of total movement: below is a pick, at or above is a drag', () => {
    expect(PLAN_TAP_PX).toBe(5)
    expect(isTap(0)).toBe(true)
    expect(isTap(4.99)).toBe(true)
    expect(isTap(5)).toBe(false)
    expect(isTap(12)).toBe(false)
  })
})

describe('bounds and rounding (schema D8)', () => {
  const plan = planOf('reference')
  it('min is the axis start (an hour start) and max the window\'s last whole minute (23:59)', () => {
    const b = pickBounds(plan)
    expect(b.min).toBe(plan.window.axisStartTs)
    expect(b.max).toBe(plan.window.endTs - 59)
    expect(clock(b.min, plan.tz)).toBe('15:00')
    expect(clock(b.max, plan.tz)).toBe('23:59')
    expect(b.max % 60).toBe(0)
  })
  it('rounds to the nearest minute and clamps', () => {
    const b = pickBounds(plan)
    expect(toPickInstant(b.min + 29, b)).toBe(b.min)
    expect(toPickInstant(b.min + 30, b)).toBe(b.min + 60)
    expect(toPickInstant(b.min + 89.9, b)).toBe(b.min + 60)
    expect(toPickInstant(b.min - 5000, b)).toBe(b.min)
    expect(toPickInstant(b.max + 5000, b)).toBe(b.max)
    expect(toPickInstant(plan.window.endTs, b)).toBe(b.max)
  })
})

describe('quarter marks of the location\'s clock', () => {
  it('coincide with UTC quarter marks in every fixture zone (every real offset is a multiple of 900 s)', () => {
    for (const f of families) {
      const plan = planOf(f.name)
      const off = utcOffsetSec(plan.fetchedAt, plan.tz)
      expect(Math.abs(off % 900), f.tz).toBe(0)
      for (const t of [plan.fetchedAt, plan.fetchedAt + 7 * 60, plan.window.axisStartTs, plan.window.endTs]) {
        const right = quarterMarkToward(t, 1, plan.tz)
        const left = quarterMarkToward(t, -1, plan.tz)
        expect(right % 900).toBe(0)
        expect(left % 900).toBe(0)
        expect(right).toBeGreaterThan(t)
        expect(left).toBeLessThan(t)
        expect(right - left).toBeLessThanOrEqual(1800)
        expect(isOnQuarterMark(right, plan.tz)).toBe(true)
        expect(isOnQuarterMark(left, plan.tz)).toBe(true)
      }
      expect(isOnQuarterMark(plan.window.axisStartTs, plan.tz)).toBe(true)
      expect(isOnQuarterMark(plan.fetchedAt + 7 * 60, plan.tz)).toBe(false)
    }
  })

  it('Right gives the next mark strictly after; Left the mark at or before when off a mark, the previous when on one', () => {
    const plan = planOf('reference')
    const m = at(plan, '2026-09-13', 6, 15)
    expect(clock(quarterMarkToward(m, 1, plan.tz), plan.tz)).toBe('06:30')
    expect(clock(quarterMarkToward(m, -1, plan.tz), plan.tz)).toBe('06:00')
    const off = at(plan, '2026-09-13', 6, 7)
    expect(clock(quarterMarkToward(off, 1, plan.tz), plan.tz)).toBe('06:15')
    expect(clock(quarterMarkToward(off, -1, plan.tz), plan.tz)).toBe('06:00')
    expect(clock(hourMarkToward(off, 1, plan.tz), plan.tz)).toBe('07:00')
    expect(clock(hourMarkToward(off, -1, plan.tz), plan.tz)).toBe('06:00')
    expect(clock(hourMarkToward(at(plan, '2026-09-13', 6, 0), -1, plan.tz), plan.tz)).toBe('05:00')
  })

  it('a zone Intl rejects falls back to UTC marks rather than throwing (schema section 5)', () => {
    expect(safeOffset(1789252860, 'Not/AZone')).toBe(0)
    expect(() => quarterMarkToward(1789252860, 1, 'Not/AZone')).not.toThrow()
    expect(quarterMarkToward(1789252860, 1, 'Not/AZone') % 900).toBe(0)
  })
})

describe('stepPick (FR-20, FR-21, schema D9)', () => {
  const plan = planOf('reference')
  const tz = plan.tz
  const step = (from: number | null, key: PickKey) => clock(stepPick(from, key, plan), tz)

  it('with no pick, the first step is taken from Now (3:41 PM): Right 3:45, Left 3:30, Shift an hour mark, Page a day (QA-21)', () => {
    expect(clock(plan.fetchedAt, tz)).toBe('15:41')
    expect(step(null, 'quarter-right')).toBe('15:45')
    expect(step(null, 'quarter-left')).toBe('15:30')
    expect(step(null, 'hour-right')).toBe('16:00')
    expect(step(null, 'hour-left')).toBe('15:00')
    expect(stepPick(null, 'day-right', plan)).toBe(stepPick(null, 'quarter-right', plan) + 86400)
    // A day earlier than Now is before the axis start, so it clamps to it.
    expect(stepPick(null, 'day-left', plan)).toBe(plan.window.axisStartTs)
  })

  it('with Now on a mark, the first Right and Left both pick Now itself', () => {
    const onMark = planOf('dst-fall')
    expect(clock(onMark.fetchedAt, onMark.tz)).toBe('15:00')
    expect(stepPick(null, 'quarter-right', onMark)).toBe(onMark.fetchedAt)
    expect(stepPick(null, 'quarter-left', onMark)).toBe(onMark.fetchedAt)
    expect(stepPick(null, 'hour-right', onMark)).toBe(onMark.fetchedAt)
  })

  it('from an unaligned pointer pick at 6:07, Right reads 6:15 and Left 6:00; hour and day steps align first, then move', () => {
    const p = at(plan, '2026-09-13', 6, 7)
    expect(step(p, 'quarter-right')).toBe('06:15')
    expect(step(p, 'quarter-left')).toBe('06:00')
    expect(step(p, 'hour-right')).toBe('07:15')
    expect(step(p, 'hour-left')).toBe('05:00')
    expect(localClock(stepPick(p, 'day-right', plan), tz)).toBe('2026-09-14 06:15')
    expect(localClock(stepPick(p, 'day-left', plan), tz)).toBe('2026-09-12 15:00')   // clamped to the axis start
  })

  it('from an aligned pick at 6:15 (QA-20): Right 6:30, Left 6:00, Shift+Right 7:15, Shift+Left 5:15, Page Up the same clock tomorrow, Page Down yesterday', () => {
    const p = at(plan, '2026-09-14', 6, 15)
    expect(step(p, 'quarter-right')).toBe('06:30')
    expect(step(p, 'quarter-left')).toBe('06:00')
    expect(step(p, 'hour-right')).toBe('07:15')
    expect(step(p, 'hour-left')).toBe('05:15')
    expect(localClock(stepPick(p, 'day-right', plan), tz)).toBe('2026-09-15 06:15')
    expect(localClock(stepPick(p, 'day-left', plan), tz)).toBe('2026-09-13 06:15')
    expect(stepPick(p, 'day-right', plan) - p).toBe(86400)
  })

  it('Home is the axis start, End the window\'s last whole minute, and a step at an end stays at the end', () => {
    const b = pickBounds(plan)
    expect(stepPick(null, 'home', plan)).toBe(b.min)
    expect(stepPick(at(plan, '2026-09-15', 12, 0), 'home', plan)).toBe(b.min)
    expect(stepPick(null, 'end', plan)).toBe(b.max)
    expect(stepPick(b.max, 'quarter-right', plan)).toBe(b.max)
    expect(stepPick(b.max, 'hour-right', plan)).toBe(b.max)
    expect(stepPick(b.max, 'day-right', plan)).toBe(b.max)
    expect(stepPick(b.min, 'quarter-left', plan)).toBe(b.min)
    expect(stepPick(b.min, 'hour-left', plan)).toBe(b.min)
    expect(stepPick(b.min, 'day-left', plan)).toBe(b.min)
    // From the end, a Left aligns to the previous quarter mark, 23:45.
    expect(clock(stepPick(b.max, 'quarter-left', plan), tz)).toBe('23:45')
  })

  it('every landing is a quarter mark of the location\'s clock', () => {
    const keys: PickKey[] = ['quarter-left', 'quarter-right', 'hour-left', 'hour-right', 'day-left', 'day-right', 'home', 'end']
    for (const from of [null, at(plan, '2026-09-13', 6, 7), at(plan, '2026-09-14', 6, 15), at(plan, '2026-09-16', 23, 58)]) {
      for (const k of keys) {
        const t = stepPick(from, k, plan)
        expect(isOnQuarterMark(t, tz) || t === pickBounds(plan).max, `${from} ${k}`).toBe(true)
      }
    }
  })

  it.each([['dst-fall', '2026-11-01', 25], ['dst-spring', '2026-03-08', 23]])('%s: Page Up across the clock change moves exactly 86,400 s of real time and lands an hour off in clock terms', (name, date, hours) => {
    const p = planOf(name)
    const dayLen = p.days.find(d => d.date === date)!
    expect(dayLen.endTs - dayLen.startTs + 1).toBe(hours * 3600)
    const from = at(p, date, 1, 15)                       // 1:15 AM, before the 02:00 change
    const next = stepPick(from, 'day-right', p)
    expect(next - from).toBe(86400)
    const landed = clock(next, p.tz)
    expect(landed).toBe(hours === 25 ? '00:15' : '02:15')
    expect(localClock(next, p.tz).slice(0, 10)).not.toBe(date === '2026-11-01' ? '2026-11-01' : '')
    // And the quarter step never leaves the quarter marks across the change.
    let t = from
    for (let i = 0; i < 12; i += 1) { t = stepPick(t, 'quarter-right', p); expect(isOnQuarterMark(t, p.tz)).toBe(true) }
  })
})
