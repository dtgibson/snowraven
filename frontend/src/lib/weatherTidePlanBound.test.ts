// NFR-08 / QA-43: a stored plan is the computed document, not the raw provider
// bodies, and its serialized size stays under 300,000 code units, a tenth of
// the replay store's payload budget, measured with the same
// `JSON.stringify(...).length` the store records. Asserted on the MAXIMAL
// fixture family (eight full days, 48 hourly entries, a nine-day six-minute
// series with turning points every six hours), through the SHIPPED builders,
// so the bound is a property of the producers rather than a store rule.
import { describe, it, expect } from 'vitest'
import fixture from './weatherTidePlan.fixture.json'
import { buildWeatherPlan } from './weatherPlan'
import { buildTidePlan, planTideRange } from './tidePlan'
import { REPLAY_MAX_BYTES } from './replayStore'
import type { OneCallResponse } from './forecastSlice'

const PLAN_MAX_CODE_UNITS = 300_000

const maximal = (fixture as { families: Array<{ name: string; tz: string; nowTs: number; lat: number; lng: number; station: { id: string; name: string }; distanceMi: number; onecall: unknown; predBody: unknown; hiloBody: unknown }> })
  .families.find(f => f.name === 'maximal')!

describe('the stored plan bound (NFR-08)', () => {
  it('the maximal family is the largest conforming shape, not a small one', () => {
    const oc = maximal.onecall as { hourly: unknown[]; daily: unknown[] }
    expect(oc.hourly).toHaveLength(48)
    expect(oc.daily).toHaveLength(8)
    expect((maximal.predBody as { predictions: unknown[] }).predictions.length).toBeGreaterThan(2000)
    expect((maximal.hiloBody as { predictions: unknown[] }).predictions.length).toBeGreaterThan(40)
  })

  it('each half and their sum serialize under 300,000 code units, an order of magnitude under the store budget', () => {
    const w = buildWeatherPlan(maximal.onecall as OneCallResponse, maximal.nowTs, maximal.tz, maximal.lat, maximal.lng)
    expect(w.ok).toBe(true)
    const span = planTideRange(maximal.nowTs, maximal.tz)
    const t = buildTidePlan(maximal.predBody, maximal.hiloBody, maximal.station, maximal.distanceMi, maximal.tz, span)
    const wLen = JSON.stringify((w as { plan: unknown }).plan).length
    const tLen = JSON.stringify(t).length
    expect(wLen).toBeLessThan(PLAN_MAX_CODE_UNITS)
    expect(tLen).toBeLessThan(PLAN_MAX_CODE_UNITS)
    expect(wLen + tLen).toBeLessThan(PLAN_MAX_CODE_UNITS)
    expect(PLAN_MAX_CODE_UNITS * 10).toBe(REPLAY_MAX_BYTES)
    // Non-vacuity: the halves are real documents, not empty shells.
    expect(wLen).toBeGreaterThan(10_000)
    expect(tLen).toBeGreaterThan(10_000)
  })

  it('the halves carry no raw provider body', () => {
    const w = buildWeatherPlan(maximal.onecall as OneCallResponse, maximal.nowTs, maximal.tz, maximal.lat, maximal.lng) as unknown as { plan: Record<string, unknown> }
    for (const raw of ['hourly', 'daily', 'current', 'predictions']) expect(w.plan).not.toHaveProperty(raw)
    const span = planTideRange(maximal.nowTs, maximal.tz)
    const t = buildTidePlan(maximal.predBody, maximal.hiloBody, maximal.station, maximal.distanceMi, maximal.tz, span) as Record<string, unknown>
    expect(t).not.toHaveProperty('predictions')
    // The provider's raw six-minute grid is not what is stored: at most one
    // sample per 30 minutes (NFR-03), by construction.
    const curve = t.curve as Array<{ t: number }>
    expect(curve.every(c => c.t % 1800 === 0)).toBe(true)
    expect(new Set(curve.map(c => c.t)).size).toBe(curve.length)
  })
})
