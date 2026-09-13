// The merge (schema 3.5): height from two continuous samples, across a gap, on
// a subordinate station, null with no turning points; prev/next/trend with the
// same-minute and one-sided cases; tide null for every event when the status
// is not ok; the drawn arrays trimmed to the window; events past the tide
// range; and a malformed half that must not throw.
import { describe, it, expect } from 'vitest'
import { composePlan, interpAtEpoch, tideAtEvent, type TideSample, type TurningPoint, type WeatherPlan } from './plan'

const H = 3600
const T0 = 1789252800 // 2026-09-12 22:00 UTC
const tp = (kind: 'high' | 'low', t: number, v: number): TurningPoint => ({ kind, t, v, local: `L${t}` })
const s = (t: number, v: number, hilo = false): TideSample => ({ t, v, hilo })

function weather(events: Array<{ kind: 'sunrise' | 'sunset'; t: number }>, over: Partial<WeatherPlan> = {}): WeatherPlan {
  const wx = { resolution: 'hourly' as const, emoji: '☀️', description: 'Clear sky', tempF: 62, highF: null, lowF: null, windDesc: 'Gentle breeze', windDir: 'W', cloudsPct: 4, humidityPct: 70, dewPointF: 55 }
  return {
    tz: 'America/Los_Angeles', lat: 36.6, lng: -121.9, fetchedAt: T0 + 600,
    window: { startTs: T0 + 600, startLocal: 'a', endTs: T0 + 48 * H, endLocal: 'b', axisStartTs: T0, axisStartLocal: 'c' },
    hourlyEndTs: T0 + 48 * H,
    days: [{ date: '2026-09-12', startTs: T0 - 22 * H, endTs: T0 + 2 * H - 1, sunrise: null, sunset: null }],
    events: events.map(e => ({ ...e, local: `L${e.t}`, date: '2026-09-12', weather: wx })),
    cells: [],
    nightSpans: [],
    ...over,
  }
}

const okTide = (curve: TideSample[], turningPoints: TurningPoint[]) => ({
  status: 'ok', source: 'predicted', station: { id: '9413450', name: 'MONTEREY' }, distanceMi: 0.9,
  tz: 'America/Los_Angeles', continuous: true, range: { startTs: T0, endTs: T0 + 9 * 24 * H }, curve, turningPoints,
})

describe('interpAtEpoch', () => {
  const pts = [tp('low', 100, -1), tp('high', 700, 5)]
  it('is linear on the time fraction with the shared operation order', () => {
    expect(interpAtEpoch(400, pts)).toBe(-1 + (5 - -1) * ((400 - 100) / (700 - 100)))
    expect(interpAtEpoch(100, pts)).toBe(-1)
    expect(interpAtEpoch(700, pts)).toBe(5)
  })
  it('gives the one side\'s value outside the series and null with no points', () => {
    expect(interpAtEpoch(50, pts)).toBe(-1)
    expect(interpAtEpoch(900, pts)).toBe(5)
    expect(interpAtEpoch(400, [])).toBeNull()
  })
})

describe('tideAtEvent', () => {
  const tps = [tp('low', T0 - 2 * H, -1.2), tp('high', T0 + 4 * H, 5.4), tp('low', T0 + 10 * H, 0.3)]

  it('reads the height between two continuous samples 30 minutes apart', () => {
    const curve = [s(T0, 2.0), s(T0 + 1800, 3.0), s(T0 + 3600, 3.5)]
    const r = tideAtEvent(T0 + 900, curve, tps)
    expect(r.heightFt).toBe(2.5)
    expect(r.heightSource).toBe('continuous')
    expect(r.trend).toBe('rising')
    expect(r.prev).toMatchObject({ kind: 'low', heightFt: -1.2 })
    expect(r.next).toMatchObject({ kind: 'high', heightFt: 5.4 })
  })

  it('interpolates on the high/low curve across a gap and on a subordinate station', () => {
    const gapped = [s(T0, 2.0), s(T0 + 2 * H, 4.0)]            // an hour missing
    const g = tideAtEvent(T0 + H, gapped, tps)
    expect(g.heightSource).toBe('interpolated')
    expect(g.heightFt).toBe(interpAtEpoch(T0 + H, tps))
    const sub = [s(T0, 2.0, true), s(T0 + 1800, 2.5, true)]   // every sample hilo
    expect(tideAtEvent(T0 + 900, sub, tps).heightSource).toBe('interpolated')
  })

  it('is null with no turning points and no usable samples', () => {
    const r = tideAtEvent(T0 + 900, [], [])
    expect(r).toEqual({ heightFt: null, heightSource: null, trend: null, prev: null, next: null })
  })

  it('a turning point at the event\'s own minute is the NEXT bracket and shares its time', () => {
    const at = T0 + 4 * H
    const r = tideAtEvent(at + 20, [], tps)      // 20 s into the high's minute
    expect(r.next).toMatchObject({ kind: 'high', t: at })
    expect(r.prev).toMatchObject({ kind: 'low', t: T0 - 2 * H })
    expect(r.trend).toBe('rising')
    expect(r.heightFt).toBe(5.4)
  })

  it('one-sided brackets: no later turning point gives trend null; no earlier gives prev null', () => {
    const late = tideAtEvent(T0 + 20 * H, [], tps)
    expect(late.next).toBeNull()
    expect(late.trend).toBeNull()
    expect(late.prev).toMatchObject({ kind: 'low', t: T0 + 10 * H })
    const early = tideAtEvent(T0 - 5 * H, [], tps)
    expect(early.prev).toBeNull()
    expect(early.next).toMatchObject({ kind: 'low', t: T0 - 2 * H })
    expect(early.trend).toBe('falling')
  })
})

describe('composePlan', () => {
  const tps = [tp('low', T0 - 2 * H, -1.2), tp('high', T0 + 4 * H, 5.4), tp('low', T0 + 60 * H, 0.3), tp('high', T0 + 66 * H, 6.1)]
  const curve = Array.from({ length: 9 * 48 }, (_, i) => s(T0 + i * 1800, 2 + (i % 4) * 0.5))

  it('fills each event\'s tide and trims the drawn arrays to the window', () => {
    const plan = composePlan(weather([{ kind: 'sunset', t: T0 + 3 * H }, { kind: 'sunrise', t: T0 + 13 * H }]), okTide(curve, tps))!
    expect(plan.events).toHaveLength(2)
    expect(plan.events[0].tide?.heightSource).toBe('continuous')
    expect(plan.events[0].tide?.next).toMatchObject({ kind: 'high' })
    expect(plan.tide?.status).toBe('ok')
    if (plan.tide?.status === 'ok') {
      expect(plan.tide.curve.every(c => c.t >= T0 && c.t <= T0 + 48 * H)).toBe(true)
      expect(plan.tide.curve.length).toBe(97)
      // Turning points past the window are not drawn, but still bracket.
      expect(plan.tide.turningPoints.map(p => p.t)).toEqual([T0 + 4 * H])
    }
    expect(plan.events[1].tide?.next).toMatchObject({ kind: 'low', t: T0 + 60 * H })
  })

  it('an event past the tide range reads null height with the one-sided wording input', () => {
    const w = weather([{ kind: 'sunset', t: T0 + 300 * H }], { window: { startTs: T0, startLocal: '', endTs: T0 + 400 * H, endLocal: '', axisStartTs: T0, axisStartLocal: '' } })
    const plan = composePlan(w, okTide(curve, tps))!
    expect(plan.events[0].tide).toMatchObject({ heightSource: 'interpolated', trend: null, next: null })
  })

  it('a non-ok tide status gives tide null on every event and passes the notice through', () => {
    const w = weather([{ kind: 'sunset', t: T0 + 3 * H }])
    const far = composePlan(w, { status: 'too-far', station: { id: '1', name: 'X' }, distanceMi: 58 })!
    expect(far.tide).toEqual({ status: 'too-far', station: { id: '1', name: 'X' }, distanceMi: 58 })
    expect(far.events[0].tide).toBeNull()
    expect(composePlan(w, { status: 'unavailable' })!.tide).toEqual({ status: 'unavailable' })
    expect(composePlan(w, null)!.tide).toBeNull()
    expect(composePlan(w, null)!.events[0].tide).toBeNull()
  })

  it('a malformed half never throws: bad tide reads as null, a bad window as no plan', () => {
    const w = weather([{ kind: 'sunset', t: T0 + 3 * H }])
    expect(composePlan(w, { status: 'ok', curve: 'nope', turningPoints: 7 })!.tide).toBeNull()
    expect(composePlan(w, { status: 'ok', station: { id: '1', name: 'X' }, curve: [{ t: 'x' }, null, 5], turningPoints: [{ kind: 'high', t: T0, v: 1 }] })!.tide).toMatchObject({ status: 'ok', curve: [], turningPoints: [{ kind: 'high', t: T0, v: 1, local: '' }] })
    expect(composePlan(w, 'garbage')!.tide).toBeNull()
    expect(composePlan(JSON.parse('{"window":{"__proto__":{"startTs":1}}}'), null)).toBeNull()
    expect(composePlan(null, null)).toBeNull()
    expect(composePlan({ ...w, events: 'nope', days: null, cells: {} }, null)).toMatchObject({ events: [], days: [], cells: [] })
  })
})

// ── The Auditor's Low, closed: every string and number the UI prints is
// type-checked at the boundary, so a corrupted replayed half degrades (a
// dropped entry, an absent moment) rather than reaching React as a non-string
// child. Rendering the real components over these shapes is in
// PlanResult.test.tsx; this pins the merge's own verdict per field.
describe('composePlan type-checks the printed fields of a replayed half', () => {
  const good = weather([{ kind: 'sunset', t: T0 + 3 * H }, { kind: 'sunrise', t: T0 + 13 * H }])
  const corrupt = (mut: (w: Record<string, unknown>) => void) => {
    const w = JSON.parse(JSON.stringify(good)) as Record<string, unknown>
    mut(w)
    return composePlan(w, null)!
  }
  const ev = (w: Record<string, unknown>, i = 0) => (w.events as Array<Record<string, unknown>>)[i]

  it('drops an event whose local, date or kind is not the string it must be', () => {
    expect(corrupt(w => { ev(w).local = 7 }).events).toHaveLength(1)
    expect(corrupt(w => { ev(w).local = null }).events).toHaveLength(1)
    expect(corrupt(w => { ev(w).date = { a: 1 } }).events).toHaveLength(1)
    expect(corrupt(w => { ev(w).kind = 'noon' }).events).toHaveLength(1)
    expect(corrupt(w => { ev(w).t = '12' }).events).toHaveLength(1)
  })

  it('drops an event whose weather carries an object, a null or a string where it must not', () => {
    const wx = (w: Record<string, unknown>) => ev(w).weather as Record<string, unknown>
    expect(corrupt(w => { wx(w).emoji = { x: 1 } }).events).toHaveLength(1)
    expect(corrupt(w => { wx(w).description = null }).events).toHaveLength(1)
    expect(corrupt(w => { wx(w).tempF = '62' }).events).toHaveLength(1)
    expect(corrupt(w => { wx(w).highF = 'hi' }).events).toHaveLength(1)
    expect(corrupt(w => { wx(w).resolution = 'weekly' }).events).toHaveLength(1)
    expect(corrupt(w => { ev(w).weather = 'sunny' }).events).toHaveLength(1)
    // A daily reading with null high/low is a legitimate shape and is kept.
    expect(corrupt(w => { wx(w).highF = null; wx(w).lowF = null }).events).toHaveLength(2)
  })

  it('drops a cell with a non-string local or a malformed weather; a malformed sunrise reads as absent', () => {
    const cell = { resolution: 'hourly', startTs: T0, endTs: T0 + 1799, local: 'L', weather: ev(good as unknown as Record<string, unknown>).weather }
    expect(corrupt(w => { w.cells = [cell, { ...cell, local: 5 }, { ...cell, weather: { ...(cell.weather as object), emoji: [] } }] }).cells).toHaveLength(1)
    const d = corrupt(w => { (w.days as Array<Record<string, unknown>>)[0].sunrise = { t: 'x', local: 3 } })
    expect(d.days[0].sunrise).toBeNull()
    expect(corrupt(w => { (w.days as Array<Record<string, unknown>>)[0].date = 9 }).days).toHaveLength(0)
  })

  it('keeps every valid entry beside a dropped one, so a corrupted row costs one row', () => {
    const plan = corrupt(w => { ev(w, 1).local = 3 })
    expect(plan.events).toHaveLength(1)
    expect(plan.events[0].kind).toBe('sunset')
  })
})
