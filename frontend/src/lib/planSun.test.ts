// The sun-altitude derivation (plan-sun-moon-readout, schema B; QA-12, QA-26
// to QA-29, QA-33, QA-34): the formula against published reference values,
// solar noon against a NOAA table value, the anchoring invariant on every
// fixture day that lists both events (the sign changes exactly at the listed
// minutes and nowhere else, the value is exactly zero there, the day's peak is
// the computed maximum), the polar rows, the malformed-day rule, the
// out-of-range null, the bounded track and the per-day peak.
import { describe, it, expect } from 'vitest'
import fixture from './weatherTidePlan.fixture.json'
import { composePlan, type Plan, type TidePlanResponse, type WeatherPlan } from './plan'
import {
  buildSunModel, solarNoonTs, sunAltitudeAt, sunAltitudeDeg, sunPeakByDay, sunTrack, sunTrackRuns,
  type SunModel,
} from './planSun'

interface Family { name: string; expectedWeather: { ok: true; plan: WeatherPlan } | { ok: false }; expectedTide: TidePlanResponse }
const families = (fixture as { families: Family[] }).families.filter(f => f.expectedWeather.ok)
const planOf = (name: string): Plan => {
  const f = families.find(x => x.name === name)!
  return composePlan((f.expectedWeather as { ok: true; plan: WeatherPlan }).plan, f.expectedTide)!
}
const modelOf = (name: string): SunModel => buildSunModel(planOf(name))!

const utc = (y: number, mo: number, d: number, h: number, mi = 0) => Date.UTC(y, mo - 1, d, h, mi) / 1000

describe('sunAltitudeDeg: the NOAA equations against reference values', () => {
  it('Greenwich at the 2026 June solstice, solar noon: 90 - latitude + declination', () => {
    // Declination 23.44 at the solstice, latitude 51.4769: 61.96 degrees.
    expect(sunAltitudeDeg(51.4769, 0, utc(2026, 6, 21, 12, 2))).toBeCloseTo(61.96, 1)
  })
  it('the equator at the 2026 March equinox, solar noon: within a fraction of a degree of the zenith', () => {
    expect(sunAltitudeDeg(0, 0, utc(2026, 3, 20, 12, 8))).toBeGreaterThan(89.5)
  })
  it('Sydney at local midnight in January reads well below the horizon', () => {
    expect(sunAltitudeDeg(-33.87, 151.21, utc(2026, 1, 1, 13, 0))).toBeLessThan(-25)
  })
  it('is bounded to [-90, 90] and is finite everywhere on the sphere', () => {
    for (const lat of [-90, -45, 0, 45, 90]) for (const lng of [-180, -90, 0, 90, 180]) {
      for (const h of [0, 6, 12, 18]) {
        const v = sunAltitudeDeg(lat, lng, utc(2026, 9, 12, h))
        expect(Number.isFinite(v)).toBe(true)
        expect(Math.abs(v)).toBeLessThanOrEqual(90)
      }
    }
  })
})

describe('solarNoonTs', () => {
  it('Monterey, 2026-09-12: within two minutes of the NOAA table value (20:03:36 UTC, 1:03 PM PDT)', () => {
    const noon = solarNoonTs(36.603, -121.876, 1789252860)
    expect(Math.abs(noon - utc(2026, 9, 12, 20, 3) - 36)).toBeLessThan(120)
  })
  it('lies within twelve hours of the instant it is asked around, on either side of UTC midnight', () => {
    for (const around of [utc(2026, 9, 12, 1), utc(2026, 9, 12, 12), utc(2026, 9, 12, 23)]) {
      expect(Math.abs(solarNoonTs(36.603, -121.876, around) - around)).toBeLessThanOrEqual(43200)
    }
  })
})

describe('the model: anchors and admission', () => {
  it('the reference family finds both computed crossings on every day, each within a quarter hour of the listed event (the provider\'s refracted horizon sits a few minutes off the geometric one)', () => {
    const m = modelOf('reference')
    expect(m.anchors).toHaveLength(16)
    for (const a of m.anchors) {
      expect(a.tc).not.toBeNull()
      expect(Math.abs(a.tc! - a.t)).toBeLessThan(900)
    }
    // Ascending by t, at most two per day.
    for (let i = 1; i < m.anchors.length; i += 1) expect(m.anchors[i].t).toBeGreaterThan(m.anchors[i - 1].t)
  })

  it('the polar family (71 N in July) lists sunrises the computed curve cannot reproduce: those anchors carry no crossing', () => {
    const m = modelOf('polar')
    expect(m.anchors.length).toBeGreaterThan(0)
    expect(m.anchors.some(a => a.tc === null)).toBe(true)
  })

  it('a day whose sunrise follows its sunset, or whose event lies outside the day, reads as listing neither (FR-28)', () => {
    const plan = planOf('reference')
    const swapped: Plan = { ...plan, days: plan.days.map((d, i) => (i === 2 ? { ...d, sunrise: d.sunset, sunset: d.sunrise } : d)) }
    const outside: Plan = { ...plan, days: plan.days.map((d, i) => (i === 3 ? { ...d, sunset: { t: d.endTs + 3600, local: '' } } : d)) }
    const ref = buildSunModel(plan)!
    expect(buildSunModel(swapped)!.anchors.filter(a => a.dayIndex === 2)).toHaveLength(0)
    expect(buildSunModel(outside)!.anchors.filter(a => a.dayIndex === 3)).toHaveLength(0)
    expect(buildSunModel(swapped)!.anchors).toHaveLength(ref.anchors.length - 2)
    expect(buildSunModel(outside)!.anchors).toHaveLength(ref.anchors.length - 2)
    // Unanchored: that day's side is free and the curve is the computed one.
    const t = plan.days[2].startTs + 2 * 3600
    expect(buildSunModel(swapped)!.days[2].side(t)).toBe('free')
  })

  it('out-of-range or non-finite coordinates give null (schema D14)', () => {
    const plan = planOf('reference')
    expect(buildSunModel({ ...plan, lat: 91 })).toBeNull()
    expect(buildSunModel({ ...plan, lng: -181 })).toBeNull()
    expect(buildSunModel({ ...plan, lat: Number.NaN })).toBeNull()
    expect(buildSunModel({ ...plan, lat: 90, lng: 180 })).not.toBeNull()
  })
})

describe('the anchoring invariant (FR-27, QA-27): every fixture day listing both events', () => {
  const rows: Array<[string, number]> = []
  for (const f of families) {
    const plan = planOf(f.name)
    plan.days.forEach((d, i) => { if (d.sunrise && d.sunset) rows.push([f.name, i]) })
  }

  it('covers every non-polar family and is not vacuous', () => {
    expect(rows.length).toBeGreaterThan(80)
    expect(new Set(rows.map(r => r[0])).size).toBeGreaterThanOrEqual(11)
  })

  it.each(rows)('%s day %i: zero at the listed minutes, one sign change each way and none elsewhere, peak within a degree of the computed maximum', (name, i) => {
    const plan = planOf(name)
    const m = buildSunModel(plan)!
    const d = plan.days[i]
    const sr = d.sunrise!.t, ss = d.sunset!.t
    expect(sunAltitudeAt(m, sr)).toBe(0)
    expect(sunAltitudeAt(m, ss)).toBe(0)
    // A one-minute sweep of the whole day: <= 0 before the sunrise, > 0
    // strictly between, <= 0 after the sunset.
    let computedMax = -Infinity, sampledMax = -Infinity
    for (let t = d.startTs; t <= d.endTs; t += 60) {
      const v = sunAltitudeAt(m, t)
      if (t < sr || t > ss) expect(v, `${name} day ${i} at ${t}`).toBeLessThanOrEqual(0)
      else if (t > sr && t < ss) expect(v, `${name} day ${i} at ${t}`).toBeGreaterThan(0)
      sampledMax = Math.max(sampledMax, v)
      computedMax = Math.max(computedMax, sunAltitudeDeg(plan.lat, plan.lng, t))
    }
    expect(Math.abs(sampledMax - computedMax)).toBeLessThan(1)
    // The crossings are the LISTED instants, to the second: the minute before
    // the sunrise is not above zero and the minute after is.
    expect(sunAltitudeAt(m, sr - 60)).toBeLessThanOrEqual(0)
    expect(sunAltitudeAt(m, sr + 60)).toBeGreaterThan(0)
    expect(sunAltitudeAt(m, ss - 60)).toBeGreaterThan(0)
    expect(sunAltitudeAt(m, ss + 60)).toBeLessThanOrEqual(0)
  })
})

describe('missing events (FR-28, QA-28)', () => {
  it('a day listing neither event draws the unanchored computed curve: at 71 N on July 25 every sample is above zero, and every sample is the computed altitude itself', () => {
    const plan = planOf('polar')
    const free: Plan = { ...plan, days: plan.days.map(d => ({ ...d, sunrise: null, sunset: null })) }
    const m = buildSunModel(free)!
    expect(m.anchors).toHaveLength(0)
    const samples = sunTrack(m)
    expect(samples.length).toBeGreaterThan(100)
    // The midnight sun still holds on the first day; by August 1 the geometric
    // curve dips just under zero near solar midnight, which the unanchored
    // track shows honestly rather than clamping away.
    const firstDay = samples.filter(s => s.t <= plan.days[0].endTs)
    expect(firstDay.length).toBeGreaterThan(30)
    expect(firstDay.every(s => s.deg > 0)).toBe(true)
    for (const s of samples) expect(s.deg).toBe(sunAltitudeDeg(plan.lat, plan.lng, s.t))
    expect(m.days[0].side(plan.days[0].startTs + 3600)).toBe('free')
  })

  it('a day listing only a sunrise crosses zero exactly once, at it, and no sample later that day is below zero', () => {
    const plan = planOf('polar')
    const m = buildSunModel(plan)!
    plan.days.forEach((d, i) => {
      if (!d.sunrise || d.sunset) return
      expect(sunAltitudeAt(m, d.sunrise.t)).toBe(0)
      let crossings = 0
      let prev: number | null = null
      for (let t = Math.max(d.startTs, plan.window.axisStartTs); t <= d.endTs; t += 60) {
        const v = sunAltitudeAt(m, t)
        if (t > d.sunrise.t) expect(v, `polar day ${i} at ${t}`).toBeGreaterThanOrEqual(0)
        const sign = v > 0 ? 1 : v < 0 ? -1 : 0
        if (prev !== null && sign !== 0 && prev !== 0 && sign !== prev) crossings += 1
        if (sign !== 0) prev = sign
      }
      expect(crossings).toBeLessThanOrEqual(1)
    })
  })
})

describe('the track (FR-33, QA-33)', () => {
  it('samples every quarter mark of the window plus the anchors, ascending and de-duplicated, at most hours x 4 + anchors', () => {
    for (const f of families) {
      const plan = planOf(f.name)
      const m = buildSunModel(plan)!
      const samples = sunTrack(m)
      const hours = (plan.window.endTs + 1 - plan.window.axisStartTs) / 3600
      expect(samples.length, f.name).toBeLessThanOrEqual(hours * 4 + m.anchors.length)
      expect(samples.length, f.name).toBeGreaterThan(hours * 3)
      for (let i = 1; i < samples.length; i += 1) expect(samples[i].t).toBeGreaterThan(samples[i - 1].t)
      expect(samples[0].t).toBe(plan.window.axisStartTs)
      expect(samples[samples.length - 1].t).toBeLessThanOrEqual(plan.window.endTs)
      for (const a of m.anchors) {
        if (a.t < plan.window.axisStartTs || a.t > plan.window.endTs) continue
        const s = samples.find(x => x.t === a.t)
        expect(s, `${f.name} anchor ${a.t}`).toBeTruthy()
        expect(s!.deg).toBe(0)
      }
      // Every quarter mark is a sample (a keyboard step lands on a drawn sample).
      for (let t = plan.window.axisStartTs; t <= plan.window.endTs; t += 900 * 37) {
        expect(samples.some(s => s.t === t), `${f.name} mark ${t}`).toBe(true)
      }
    }
  })

  it('is computed from the model alone: the same model gives the same samples, and the function takes no density input', () => {
    const m = modelOf('reference')
    expect(sunTrack(m)).toEqual(sunTrack(m))
    expect(sunTrack.length).toBe(1)
  })

  it('splits into alternating day and night runs of positive extent that share their boundary sample', () => {
    const runs = sunTrackRuns(sunTrack(modelOf('reference')))
    expect(runs.length).toBeGreaterThanOrEqual(15)
    for (let i = 0; i < runs.length; i += 1) {
      const r = runs[i]
      expect(r.pts.length).toBeGreaterThanOrEqual(2)
      expect(r.pts[r.pts.length - 1].t).toBeGreaterThan(r.pts[0].t)
      if (i > 0) {
        expect(r.kind).not.toBe(runs[i - 1].kind)
        expect(r.pts[0]).toBe(runs[i - 1].pts[runs[i - 1].pts.length - 1])
        expect(r.pts[0].deg).toBe(0)
      }
      for (const p of r.pts.slice(1, -1)) {
        if (r.kind === 'day') expect(p.deg).toBeGreaterThan(0)
        else expect(p.deg).toBeLessThanOrEqual(0)
      }
    }
  })
})

describe('the per-day peak (FR-34, QA-34)', () => {
  it('equals the track\'s maximum for every whole day and lies within one sample of it', () => {
    for (const f of families) {
      const plan = planOf(f.name)
      const m = buildSunModel(plan)!
      const samples = sunTrack(m)
      const peaks = sunPeakByDay(m)
      expect(peaks).toHaveLength(plan.days.length)
      plan.days.forEach((d, i) => {
        const p = peaks[i]!
        expect(p).toBeTruthy()
        expect(p.dayIndex).toBe(i)
        expect(p.t).toBeGreaterThanOrEqual(d.startTs)
        expect(p.t).toBeLessThanOrEqual(d.endTs)
        if (d.startTs < plan.window.axisStartTs) return   // the partial first day (D4-08 handles it)
        const inDay = samples.filter(s => s.t >= d.startTs && s.t <= d.endTs)
        const best = inDay.reduce((a, s) => (s.deg > a.deg ? s : a))
        expect(p.deg, `${f.name} day ${i}`).toBeGreaterThanOrEqual(best.deg)
        expect(Math.abs(p.t - best.t), `${f.name} day ${i}`).toBeLessThanOrEqual(900)
      })
    }
  })

  it('is null for a day whose end precedes its start', () => {
    const plan = planOf('reference')
    const bad: Plan = { ...plan, days: plan.days.map((d, i) => (i === 1 ? { ...d, endTs: d.startTs - 1 } : d)) }
    expect(sunPeakByDay(buildSunModel(bad)!)[1]).toBeNull()
  })
})
