// The picked-moment readout (plan-sun-moon-readout, schema D; QA-07 to QA-13,
// QA-46): the cell rule including the collapsed-block case and the daily
// tail, the tide rule as an identity over every event of every family, the
// no-tide plan and the no-bracket instant, the sun figure at a listed sunrise,
// at local noon and at 2 AM, the value text carrying every figure once, the
// unusable-zone resilience row, and a timing row.
import { describe, it, expect } from 'vitest'
import fixture from './weatherTidePlan.fixture.json'
import { composePlan, type Plan, type TidePlanResponse, type WeatherPlan } from './plan'
import { planStripCells } from './planChartGeometry'
import { PLAN_COPY } from './planCopy'
import { buildSunModel, sunPeakByDay } from './planSun'
import { cellAt, planReadoutAt, readoutSunText, readoutTideText, readoutValueText, readoutWeatherText, readoutWhen, safeLocalClock, tideAtInstant } from './planReadout'
import { localMidnightTs } from './tzClock'

interface Family { name: string; expectedWeather: { ok: true; plan: WeatherPlan } | { ok: false }; expectedTide: TidePlanResponse }
const families = (fixture as { families: Family[] }).families.filter(f => f.expectedWeather.ok)
const planOf = (name: string, tide?: TidePlanResponse | null): Plan => {
  const f = families.find(x => x.name === name)!
  return composePlan((f.expectedWeather as { ok: true; plan: WeatherPlan }).plan, tide === undefined ? f.expectedTide : tide)!
}
const at = (plan: Plan, date: string, h: number, m: number) => localMidnightTs(date, plan.tz) + h * 3600 + m * 60

describe('cellAt (FR-09, FR-10, QA-09, QA-10)', () => {
  const plan = planOf('reference')

  it('reads the document\'s own cell, hourly inside the hourly coverage and daily after it', () => {
    const hourly = cellAt(plan.cells, at(plan, '2026-09-13', 7, 20))!
    expect(hourly.resolution).toBe('hourly')
    expect(hourly.local).toBe('2026-09-13 07:00')
    const daily = cellAt(plan.cells, plan.hourlyEndTs + 5 * 3600)!
    expect(daily.resolution).toBe('daily')
  })

  it('with the strip collapsed to 3-hour blocks, a pick at 7:20 still reads the 7 AM cell, not the block\'s 6 AM cell', () => {
    const t = at(plan, '2026-09-13', 7, 20)
    const blocks = planStripCells(plan.cells, 3)
    const block = blocks.find(b => b.startTs <= t && t <= b.endTs)!
    expect(block.local).toBe('2026-09-13 06:00')
    expect(cellAt(plan.cells, t)!.local).toBe('2026-09-13 07:00')
  })

  it('is null in a gap and outside the cells', () => {
    const gapped = plan.cells.filter(c => c.local !== '2026-09-13 07:00')
    expect(cellAt(gapped, at(plan, '2026-09-13', 7, 20))).toBeNull()
    expect(cellAt(plan.cells, plan.window.axisStartTs - 3600)).toBeNull()
    expect(cellAt([], plan.fetchedAt)).toBeNull()
  })
})

describe('tideAtInstant (FR-08, QA-08): the event rule over the event inputs', () => {
  it('for every event of every family with tide, the reading at the event\'s instant deep-equals the event\'s own', () => {
    let events = 0
    for (const f of families) {
      const plan = planOf(f.name)
      if (plan.tide?.status !== 'ok') continue
      for (const e of plan.events) {
        expect(tideAtInstant(e.t, plan.tide), `${f.name} ${e.local}`).toEqual(e.tide)
        expect(tideAtInstant(e.t - (e.t % 60), plan.tide), `${f.name} ${e.local} minute`).toEqual(e.tide)
        events += 1
      }
    }
    expect(events).toBeGreaterThan(100)
  })

  it('brackets with the UNTRIMMED points: at the axis start on the subordinate family the trimmed points would give a different height', () => {
    const plan = planOf('subordinate')
    const tide = plan.tide!
    if (tide.status !== 'ok') throw new Error('subordinate has tide')
    const t = plan.window.axisStartTs
    const withUntrimmed = tideAtInstant(t, tide)!
    const withTrimmed = tideAtInstant(t, { ...tide, bracketPoints: tide.turningPoints })!
    expect(withUntrimmed.prev).not.toBeNull()
    expect(withTrimmed.prev).toBeNull()
    expect(withUntrimmed.heightFt).not.toBe(withTrimmed.heightFt)
  })

  it('reads continuous between two samples on the reference family and interpolated on the subordinate and gap families', () => {
    const ref = planOf('reference')
    expect(tideAtInstant(at(ref, '2026-09-13', 7, 20), ref.tide)!.heightSource).toBe('continuous')
    const sub = planOf('subordinate')
    expect(tideAtInstant(at(sub, '2026-09-13', 7, 20), sub.tide)!.heightSource).toBe('interpolated')
  })

  it('is null when the plan has no tide, and the trend is unknown past the last bracket point', () => {
    expect(tideAtInstant(1789252860, { status: 'unavailable' })).toBeNull()
    expect(tideAtInstant(1789252860, null)).toBeNull()
    expect(tideAtInstant(1789252860, { status: 'too-far', station: { id: '1', name: 'X' }, distanceMi: 60 })).toBeNull()
    const plan = planOf('reference')
    const tide = plan.tide!
    if (tide.status !== 'ok') throw new Error('reference has tide')
    const cut = { ...tide, bracketPoints: tide.bracketPoints.slice(0, 3), curve: [] as typeof tide.curve }
    const r = tideAtInstant(plan.window.endTs - 59, cut)!
    expect(r.trend).toBeNull()
    expect(r.next).toBeNull()
    const none = tideAtInstant(plan.window.endTs - 59, { ...tide, bracketPoints: [], curve: [] })!
    expect(none.heightFt).toBeNull()
  })
})

describe('planReadoutAt and the words (FR-07, FR-11 to FR-13, QA-07, QA-11, QA-12)', () => {
  const plan = planOf('reference')
  const model = buildSunModel(plan)!

  it('at a listed sunrise\'s minute: the event\'s tide, the cell\'s weather, the sun on the horizon, the local clock', () => {
    const e = plan.events.find(x => x.kind === 'sunrise')!
    const r = planReadoutAt(plan, e.t - (e.t % 60), model)
    expect(r.local).toBe(e.local)
    expect(r.tide).toEqual({ kind: 'reading', reading: e.tide })
    expect(r.weather!.local).toBe('2026-09-13 07:00')
    expect(r.sunDeg).toBe(0)
    expect(readoutSunText(r.sunDeg)).toBe('Sun on the horizon')
    const when = readoutWhen(r)
    expect(when.day).toBe('Sun, Sep 13, 2026')
    expect(when.clock).toBe('6:49 AM')
    expect(readoutTideText(r)).toMatch(/^Tide −?\d+\.\d ft, (rising|falling)$/)
    expect(readoutWeatherText(r)).toMatch(/^.+, \d+°F, wind .+, [NESW]{1,2}, forecast hourly$/)
  })

  it('at local noon the sun reads a positive whole number equal to the day\'s peak within a degree; at 2 AM a negative one', () => {
    const noon = planReadoutAt(plan, at(plan, '2026-09-14', 13, 0), model)
    const peak = sunPeakByDay(model)[2]!
    expect(noon.sunDeg).toBeGreaterThan(40)
    expect(Math.abs(noon.sunDeg! - Math.round(peak.deg))).toBeLessThanOrEqual(1)
    expect(readoutSunText(noon.sunDeg)).toBe(`Sun ${noon.sunDeg}° above the horizon`)
    const night = planReadoutAt(plan, at(plan, '2026-09-14', 2, 0), model)
    expect(night.sunDeg).toBeLessThan(-30)
    expect(readoutSunText(night.sunDeg)).toBe(`Sun ${-night.sunDeg!}° below the horizon`)
    expect(readoutSunText(null)).toBe('')
  })

  it('after the hourly coverage ends the weather is the day\'s reading with the daily words and its high and low', () => {
    const r = planReadoutAt(plan, plan.hourlyEndTs + 6 * 3600, model)
    expect(r.weather!.resolution).toBe('daily')
    expect(readoutWeatherText(r)).toMatch(/, high \d+°, low \d+°, wind .+, forecast daily$/)
    expect(r.tide.kind).toBe('reading')
    expect(r.sunDeg).not.toBeNull()
  })

  it('no tide in the plan: the phrase, and still the time, weather and sun', () => {
    const noTide = planOf('reference', { status: 'too-far', station: { id: '1', name: 'X' }, distanceMi: 60 })
    const r = planReadoutAt(noTide, at(noTide, '2026-09-13', 7, 20), buildSunModel(noTide))
    expect(r.tide).toEqual({ kind: 'none' })
    expect(readoutTideText(r)).toBe(PLAN_COPY.noTide)
    expect(r.weather).not.toBeNull()
    expect(r.sunDeg).not.toBeNull()
    expect(r.local).toBe('2026-09-13 07:20')
  })

  it('a gap in the cells reads the no-weather phrase and keeps the other parts', () => {
    const gapped: Plan = { ...plan, cells: plan.cells.filter(c => c.local !== '2026-09-13 07:00') }
    const r = planReadoutAt(gapped, at(plan, '2026-09-13', 7, 20), model)
    expect(r.weather).toBeNull()
    expect(readoutWeatherText(r)).toBe(PLAN_COPY.noWeather)
    expect(r.tide.kind).toBe('reading')
    expect(readoutValueText(r)).toContain(PLAN_COPY.noWeather)
  })

  it('tide present but no bracket on either side reads the existing wording rather than a blank', () => {
    const tide = plan.tide!
    if (tide.status !== 'ok') throw new Error('reference has tide')
    const bare: Plan = { ...plan, tide: { ...tide, bracketPoints: [], curve: [] } }
    const r = planReadoutAt(bare, at(plan, '2026-09-13', 7, 20), model)
    expect(readoutTideText(r)).toBe(`Tide: ${PLAN_COPY.bracketNone}`)
  })

  it('the value text carries the day and clock, the tide, the weather and the sun exactly once each, and the rest line with no pick', () => {
    const r = planReadoutAt(plan, at(plan, '2026-09-13', 7, 20), model)
    const text = readoutValueText(r)
    expect(text).toBe(`Sun, Sep 13, 2026, 7:20 AM. ${readoutTideText(r)}. ${readoutWeatherText(r)}. ${readoutSunText(r.sunDeg)}.`)
    for (const part of ['Sun, Sep 13, 2026, 7:20 AM', 'Tide ', '°F', 'wind ', 'forecast hourly', 'above the horizon']) {
      expect(text.split(part).length - 1, part).toBe(1)
    }
    expect(readoutValueText(null)).toBe(PLAN_COPY.restLine)
    expect(text.includes('—')).toBe(false)
  })

  it('a zone Intl rejects never throws: the clock part reads as unavailable and every other part is populated', () => {
    expect(safeLocalClock(plan.fetchedAt, 'Not/AZone')).toBe('')
    const bad: Plan = { ...plan, tz: 'Not/AZone' }
    const r = planReadoutAt(bad, at(plan, '2026-09-13', 7, 20), buildSunModel(bad))
    expect(r.local).toBe('')
    expect(readoutWhen(r)).toEqual({ day: PLAN_COPY.timeUnavailable, clock: '' })
    expect(readoutValueText(r).startsWith(`${PLAN_COPY.timeUnavailable}. Tide`)).toBe(true)
    expect(r.tide.kind).toBe('reading')
    expect(r.weather).not.toBeNull()
    expect(r.sunDeg).not.toBeNull()
  })

  it('performs no request and reads no storage: the function closes over the document alone', () => {
    // Structural: the module imports nothing but the merge, the sun model,
    // the clock helper, the copy and the formatter (entryChunk.test.ts holds
    // the closure); here, the call is pure over its arguments.
    const a = planReadoutAt(plan, at(plan, '2026-09-13', 7, 20), model)
    const b = planReadoutAt(plan, at(plan, '2026-09-13', 7, 20), model)
    expect(a).toEqual(b)
  })
})

describe('one readout is a small computation (NFR-03, QA-46)', () => {
  // The ceiling is the PRD's own figure, one frame at 60 Hz on the reference
  // desktop (NFR-03 names it); the measured cost is two orders of magnitude
  // under it, so this row is a structural sanity bound rather than a
  // performance claim. Seven complete runs at distinct minutes, the MINIMUM
  // asserted (the testing rule); judged only with nothing else compiling.
  it('the minimum of seven readouts over the maximal family, each at a distinct minute, is under 16 ms', () => {
    const plan = planOf('maximal')
    const model = buildSunModel(plan)!
    const times: number[] = []
    for (let i = 0; i < 7; i += 1) {
      const t = plan.window.axisStartTs + 3600 * (7 * i + 3) + 60 * i
      const t0 = performance.now()
      const r = planReadoutAt(plan, t, model)
      readoutValueText(r)
      times.push(performance.now() - t0)
      expect(r.t).toBe(t)
    }
    expect(Math.min(...times)).toBeLessThan(16)
  })
})
