// SHARED-FIXTURE PARITY TEST -- the TS half of the single-moment weather
// builders' malformed-figure contract (weather-at-malformed-parity). The Python
// half is backend/tests/test_weather_at_malformed_parity.py and drives the SAME
// weatherAtMalformed.fixture.json.
//
// WHAT THIS FILE EXISTS TO PIN. `.claude/rules/security.md` requires a twinned
// builder pair to agree on what a malformed figure IS, not only on what a
// well-formed one produces. That rule was applied to the PLAN builders at
// v1.0.29 and, measured at HEAD before this build, had not finished the job
// even there -- because both plan builders delegate to `buildWeatherPayload` /
// `build_weather_payload`, and those two disagreed with each other on **124 of
// the 203 shapes below**, measured through the shipped builders at v1.0.31:
//
//   * 107 rows where this side answered where the Python twin refused: the
//     summary printed `NaN°F` / `Humidity NaN%`, or a confident wrong word
//     (`Wind: Calm` for a null speed, `Wind: Gale` for the string "warm"). 31
//     of the accepting rows put the substring `NaN` in the COPY BLOCK.
//   * 8 rows where the roles INVERTED, six of them on the `daily` tier, where
//     `_hour_from_daily`'s `.get(field, 0)` defaults and `_FALLBACK_WEATHER`
//     substitution answered HTTP 200 with `tempF: 0`, `H 0° · L 0°` and a
//     fabricated "Clear sky" for a body the provider sent no weather in --
//     while THIS side refused it. The backend answered `tempF: 0` on 5 rows and
//     invented a condition on 6.
//   * 9 rows where both accepted and produced different figures (`0` vs `NaN`).
//
// The plan pair, which v1.0.29 was supposed to have made agree, diverged on
// **58** of the same 203 rows (57 by verdict, one by document).
//
// The wrong number is the dangerous half: `0°F` and "Clear sky" are
// indistinguishable from a real reading and they reach the copy-ready block a
// user pastes into a public eBird checklist.
//
// THREE COLUMNS, THREE CLAIMS. Every row carries a `verdict` (the single-moment
// builder), a `planVerdict` (the plan builder that delegates to it) and, for the
// accepting rows, a `why`. The plan column is not decoration: it is what makes
// the v1.0.29 reference TRUE for the first time, and it is what keeps
// `weatherPlan.ts` honest now that its own guards are gone (measured redundant
// against this matrix: 0 of 203 rows differ with them present or removed -- see
// the note on `toPlanWeather` there, and decisions.md).
//
// The `why` column is load-bearing and is written only on the rows that do NOT
// refuse, because those are the ones a reader will challenge: a matrix whose
// every row refuses proves nothing about whether the guard is too strict.
/// <reference types="node" />
import { describe, it, expect } from 'vitest'
import { writeFileSync } from 'node:fs'
import { buildWeatherPayload, type OneCallResponse } from './forecastSlice'
import { buildWeatherPlan } from './weatherPlan'
import { formatWeather, HOUR_FIGURES, type HourlyResponse } from './weatherFormatter'
import planFixture from './weatherTidePlan.fixture.json'
import fixture from './weatherAtMalformed.fixture.json'

// ── the shared shape DSL ─────────────────────────────────────────────────────
// Deliberately re-implemented on each side rather than shared: the Python half
// applying the same five fields to the same body from its own code is what the
// cross-transport claim consists of. The conforming CONTROL rows below are what
// catch a mis-implementation of the DSL itself.
type Tier = 'current' | 'hourly' | 'daily'
type Verdict = 'refuse' | 'accept' | 'out-of-range' | 'no-daily'
interface Row {
  id: string
  tier: Tier
  field?: string
  op: 'delete' | 'set' | 'keep-dt-only' | 'entries-non-objects' | 'tier-replaced' | 'none'
  value?: unknown
  only?: number
  label?: string
  verdict: Verdict
  planVerdict: Verdict
  why?: string
}
interface HourRow { id: string; field?: string; op: 'delete' | 'set' | 'body'; value?: unknown; label?: string }

const F = fixture as unknown as {
  tz: string; lat: number; lng: number; nowTs: number
  targets: Record<Tier, number | null>
  rows: Row[]
  hourRows: HourRow[]
  hourBase: Record<string, unknown>
}
const ROWS = F.rows
const HOUR_ROWS = F.hourRows

const base = () =>
  JSON.parse(JSON.stringify((planFixture as { families: Array<Record<string, unknown>> }).families[0].onecall)) as Record<string, unknown>

function applyShape(oc: Record<string, unknown>, row: Row): Record<string, unknown> {
  if (row.op === 'none') return oc
  if (row.op === 'tier-replaced') {
    oc[row.tier] = JSON.parse(JSON.stringify(row.value ?? null))
    return oc
  }
  if (row.op === 'entries-non-objects') {
    if (row.tier === 'current') oc.current = 'nope'
    else oc[row.tier] = ['x', null, 5]
    return oc
  }
  const all = row.tier === 'current' ? [oc.current] : (oc[row.tier] as unknown[])
  const indices = row.only === undefined ? all.map((_, i) => i) : [row.only]
  for (const i of indices) {
    const entry = all[i] as Record<string, unknown>
    if (row.op === 'keep-dt-only') {
      const stub = { dt: entry.dt }
      if (row.tier === 'current') oc.current = stub
      else (oc[row.tier] as unknown[])[i] = stub
      continue
    }
    const parts = row.field!.split('.')
    let target: Record<string, unknown> | null = entry
    for (const p of parts.slice(0, -1)) {
      const next: unknown = target[p]
      target = (typeof next === 'object' && next !== null) ? next as Record<string, unknown> : null
      if (!target) break
    }
    if (!target) continue
    const leaf = parts[parts.length - 1]
    if (row.op === 'delete') delete target[leaf]
    else target[leaf] = JSON.parse(JSON.stringify(row.value ?? null))
  }
  return oc
}

function hourBody(row: HourRow): unknown {
  if (row.op === 'body') return JSON.parse(JSON.stringify(row.value ?? null))
  const h = JSON.parse(JSON.stringify(F.hourBase)) as Record<string, unknown>
  if (row.op === 'delete') delete h[row.field!]
  else h[row.field!] = JSON.parse(JSON.stringify(row.value ?? null))
  return { data: [h] }
}

// ── the two builders under one verdict vocabulary ────────────────────────────
function payloadVerdict(oc: Record<string, unknown>, tier: Tier): { verdict: Verdict; payload?: ReturnType<typeof buildWeatherPayload> } {
  const target = F.targets[tier] ?? undefined
  try {
    const payload = buildWeatherPayload(oc as unknown as OneCallResponse, target, F.tz, F.lat)
    return payload.summary ? { verdict: 'accept', payload } : { verdict: 'out-of-range', payload }
  } catch {
    return { verdict: 'refuse' }
  }
}

function planVerdict(oc: Record<string, unknown>): Verdict {
  try {
    const built = buildWeatherPlan(oc as unknown as OneCallResponse, F.nowTs, F.tz, F.lat, F.lng)
    return built.ok ? 'accept' : 'no-daily'
  } catch {
    return 'refuse'
  }
}

// ── non-vacuity: the matrix carries the shapes that discriminate ─────────────
describe('the shared matrix carries the shapes that separate the twins', () => {
  const ids = new Set(ROWS.map(r => r.id))

  it('carries every class the brief measured, by name', () => {
    // A fixture of conforming bodies cannot see a twin divergence at all, and a
    // fixture missing the DAILY tier could not see the inversion -- which is
    // the half a one-sided repair to this file would have left open while
    // making it harder to spot.
    for (const id of [
      'daily temp delete',            // the fabricated `tempF: 0`, `H 0° · L 0°`
      'daily weather delete',         // the fabricated "Clear sky"
      'daily (entry) keep-dt-only',   // every figure zero under an invented condition
      'daily temp set empty-object',  // `0` on one side, `NaN` on the other
      'current temp set string',      // the NaN half of the same defect
      'current wind_speed set null',  // "Calm" -- a confident wrong WORD, not a blank
      'current wind_speed set string',// "Gale" for the string "warm"
      'hourly weather set list-of-empty-object', // Python KeyError vs a silent 🌡️
      'daily weather set empty-list', // the one row the twins AGREED on, both fabricating
    ]) expect(ids.has(id), id).toBe(true)
  })

  it('carries a CONFORMING control per tier, so the DSL itself cannot be mis-implemented', () => {
    for (const tier of ['current', 'hourly', 'daily'] as const) {
      const control = ROWS.find(r => r.op === 'none' && r.tier === tier)
      expect(control, `conforming control for ${tier}`).toBeDefined()
      expect(control!.verdict).toBe('accept')
    }
  })

  it('represents BOTH outcomes, so a matrix that degenerated to all-refuse fails loudly', () => {
    expect(ROWS.some(r => r.verdict === 'refuse')).toBe(true)
    expect(ROWS.some(r => r.verdict === 'accept')).toBe(true)
    expect(ROWS.some(r => r.verdict === 'out-of-range')).toBe(true)
    expect(ROWS.some(r => r.planVerdict === 'refuse')).toBe(true)
    expect(ROWS.some(r => r.planVerdict === 'accept')).toBe(true)
    expect(ROWS.length).toBeGreaterThanOrEqual(200)
    expect(HOUR_ROWS.length).toBeGreaterThanOrEqual(41)
  })

  it('states a reason for every row it does NOT refuse', () => {
    // The direction a reader cannot check by eye: a guard that refuses
    // everything would satisfy every other assertion in this file.
    const unexplained = ROWS.filter(r => r.verdict !== 'refuse' && !r.why)
    expect(unexplained.map(r => r.id)).toEqual([])
  })

  it('the named targets really do select their own tier on a conforming body', () => {
    for (const tier of ['current', 'hourly', 'daily'] as const) {
      const r = buildWeatherPayload(base() as unknown as OneCallResponse, F.targets[tier] ?? undefined, F.tz, F.lat)
      expect(r.resolution, tier).toBe(tier)
    }
  })
})

// ── claim 1: the single-moment builder answers the fixture's verdict ────────
describe('buildWeatherPayload answers the shared verdict for every shape', () => {
  it.each(ROWS.map(r => [r.id, r] as const))('%s', (_id, row) => {
    expect(payloadVerdict(applyShape(base(), row), row.tier).verdict).toBe(row.verdict)
  })
})

// ── claim 2: nothing an accepted payload carries is fabricated ──────────────
describe('no accepted payload carries a NaN, a null figure, or an invented condition', () => {
  const accepted = ROWS.filter(r => r.verdict === 'accept')

  it.each(accepted.map(r => [r.id, r] as const))('%s: every figure is a finite number', (_id, row) => {
    const { payload } = payloadVerdict(applyShape(base(), row), row.tier)
    const s = payload!.summary!
    for (const [name, v] of Object.entries({
      tempF: s.tempF, cloudsPct: s.cloudsPct, humidityPct: s.humidityPct, dewPointF: s.dewPointF,
    })) expect(Number.isFinite(v), `${row.id} / ${name}`).toBe(true)
    // highF/lowF are null by design on the non-daily tiers; on `daily` they are
    // figures and must be finite -- the `H 0° · L 0°` shape is exactly this.
    if (s.isDaily) {
      expect(Number.isFinite(s.highF), `${row.id} / highF`).toBe(true)
      expect(Number.isFinite(s.lowF), `${row.id} / lowF`).toBe(true)
    } else {
      expect(s.highF).toBeNull()
      expect(s.lowF).toBeNull()
    }
  })

  it.each(accepted.map(r => [r.id, r] as const))('%s: the pasteable copy block never contains "NaN"', (_id, row) => {
    // THE SURFACE THAT MATTERS. This string is what a user pastes into a public
    // eBird checklist; before this build 28 of the 41 measured malformed hour
    // shapes produced one, including "Temperature: NaN - NaN°F".
    expect(payloadVerdict(applyShape(base(), row), row.tier).payload!.formatted).not.toContain('NaN')
  })

  it.each(accepted.map(r => [r.id, r] as const))('%s: the replay round-trip cannot produce a null figure', (_id, row) => {
    // `/weather/at` rides transport.getReplayable, and replayStore persists as
    // JSON where `JSON.stringify(NaN)` is `null` -- which is why the SAME
    // malformed body used to show `NaN°F` on first load and a BLANK (`°F`,
    // `Humidity %`) on the offline re-show. The blank was never a second
    // defect; it is this one, one round trip later.
    const { payload } = payloadVerdict(applyShape(base(), row), row.tier)
    const replayed = JSON.parse(JSON.stringify(payload!)) as NonNullable<typeof payload>
    const s = replayed.summary!
    for (const v of [s.tempF, s.cloudsPct, s.humidityPct, s.dewPointF]) expect(v).not.toBeNull()
    expect(replayed.formatted).not.toContain('NaN')
  })

  it('a condition an accepted payload reports is the one the provider sent', () => {
    // The fabrication check, stated as a property rather than as a count: for
    // every accepting row the description must equal the SELECTED entry's own,
    // never a substituted `clear sky`. Driven over the rows that mutate
    // `weather`, which is where the substitution used to happen.
    const weatherRows = accepted.filter(r => r.field === 'weather')
    expect(weatherRows.length).toBeGreaterThan(0)
    for (const row of weatherRows) {
      const oc = applyShape(base(), row)
      const { payload } = payloadVerdict(oc, row.tier)
      const description = payload!.summary!.description
      // The mutated entry is `only`-indexed; the reading came from a DIFFERENT,
      // untouched entry, so its description is that entry's.
      expect(row.only, row.id).toBeDefined()
      const entries = oc[row.tier] as Array<{ weather?: Array<{ description?: string }> }>
      const sources = entries
        .filter((_, i) => i !== row.only)
        .map(e => e.weather?.[0]?.description)
        .filter((d): d is string => typeof d === 'string')
        .map(d => d.charAt(0).toUpperCase() + d.slice(1).toLowerCase())
      expect(sources, row.id).toContain(description)
    }
  })
})

// ── claim 3: the plan builder that delegates here answers its own verdict ───
describe('buildWeatherPlan answers the shared plan verdict for every shape', () => {
  // This is the column that makes the v1.0.29 reference true. It is also the
  // guard that replaces `weatherPlan.ts`'s deleted `assertNumericEntry`: if the
  // delegate is ever weakened, these rows go red HERE, not only on Predict.
  it.each(ROWS.map(r => [r.id, r] as const))('%s', (_id, row) => {
    expect(planVerdict(applyShape(base(), row))).toBe(row.planVerdict)
  })
})

// ── claim 4: the copy block's own formatter, the /weather/{checklist_id} twin ─
describe('formatWeather refuses every malformed hour, as its Python twin always has', () => {
  // `formatWeather` is called directly by the desktop checklist lookup
  // (tauri/weatherService.ts getWeather) as well as by buildWeatherPayload, so
  // it is a WIDER surface than /weather/at. Measured over these 50 shapes at
  // v1.0.31: the Python twin refused 41 and this one refused 13, so 28 shapes
  // got different answers and 37 produced PASTEABLE TEXT here -- 8 of them
  // containing `NaN`. The 9 both accepted are the BOOLEAN rows, and they agreed:
  // `temp: true` rendered "Temperature: 1°F" on both runtimes, which is why
  // `isFiniteFigure` excludes booleans rather than leaning on `typeof`.
  it.each(HOUR_ROWS.map(r => [r.id, r] as const))('%s', (_id, row) => {
    expect(() => formatWeather([hourBody(row) as HourlyResponse], F.tz, F.lat)).toThrow()
  })

  it('and still produces the conforming block unchanged', () => {
    const out = formatWeather([{ data: [F.hourBase] } as unknown as HourlyResponse], F.tz, F.lat)
    expect(out).toContain('Temperature:')
    expect(out).toContain('SnowRaven')
    expect(out).not.toContain('NaN')
  })
})

// ── claim 5: the `current` PRESENCE boundary, derived in BOTH directions ────
// WHY THESE ROWS ARE HAND-WRITTEN AND WHY THEY LIVE BESIDE THE MATRIX RATHER
// THAN IN IT. The 203 rows above carry verdict columns PRODUCED by the shipped
// builders, which is right for them and is what makes the Python half's
// reproduction a parity claim -- but a generated column can only ever pin
// AGREEMENT, and what this class needed was a DIRECTION. The direction is
// argued from the two runtimes' contracts (see `isPresent` in forecastSlice.ts
// and the presence paragraph on `pick_forecast_slice`), so the expectations
// here are literals, written identically in
// test_weather_at_malformed_parity.py: neither runtime can drift from the
// stated contract without one of the two files going red.
//
// They are separate from the matrix because every figure recorded against
// those 203 shapes -- 124 divergences at v1.0.31, 58 plan divergences, 0 after
// -- is a measurement over exactly that population, and growing it would
// silently restate all of them over a different one.
//
// THE DEFECT THEY CLOSE. The first cut of this build swapped Python's
// `if current` for `current is not None`, which fixed `{}` and `[]` (falsy in
// Python, truthy in JS) and broke `0` / `false` / `''` (falsy in JS, not-None
// in Python): those three AGREED on `out-of-range` at v1.0.31 and became a 502
// on web/Pi against an out-of-range 200 on desktop -- a new divergence of
// exactly the class this build exists to close, in the function it rewrote.
interface PresenceRow { id: string; absent?: true; value?: unknown; verdict: Verdict }
const PRESENCE_ROWS: PresenceRow[] = [
  // The two out-of-range answers, pre-existing and unchanged on both runtimes:
  // One Call legitimately omits `current` (the `exclude` parameter), and with no
  // `dt` target there is no other tier to answer from.
  { id: 'current absent', absent: true, verdict: 'out-of-range' },
  { id: 'current null', value: null, verdict: 'out-of-range' },
  // FALSY IN JS, NOT-NONE IN PYTHON -- the three F-1 names. Present, so refused
  // by the shared validator, so the answer is the provider error rather than a
  // false claim about the forecast horizon.
  { id: 'current 0', value: 0, verdict: 'refuse' },
  { id: 'current false', value: false, verdict: 'refuse' },
  { id: 'current empty string', value: '', verdict: 'refuse' },
  // TRUTHY IN JS, FALSY IN PYTHON -- the half the first cut did derive. Kept
  // here so the boundary is readable in one place.
  { id: 'current empty object', value: {}, verdict: 'refuse' },
  { id: 'current empty list', value: [], verdict: 'refuse' },
  // Every other non-null value is present too, and refused for the same reason.
  { id: 'current a number', value: 5, verdict: 'refuse' },
  { id: 'current a string', value: 'nope', verdict: 'refuse' },
  { id: 'current a list of pairs', value: [['dt', 1]], verdict: 'refuse' },
  { id: 'current an object with no dt', value: { a: 1 }, verdict: 'refuse' },
]

function presenceBody(row: PresenceRow): Record<string, unknown> {
  const oc = base()
  if (row.absent) delete oc.current
  else if ('value' in row) oc.current = JSON.parse(JSON.stringify(row.value ?? null))
  return oc
}

describe('the `current` presence boundary is presence, not truthiness', () => {
  it('is not vacuous: it carries both answers and all three falsy-not-null shapes', () => {
    expect(PRESENCE_ROWS.some(r => r.verdict === 'refuse')).toBe(true)
    expect(PRESENCE_ROWS.some(r => r.verdict === 'out-of-range')).toBe(true)
    for (const id of ['current 0', 'current false', 'current empty string']) {
      expect(PRESENCE_ROWS.some(r => r.id === id), id).toBe(true)
    }
    // ROW COUNT, asserted in BOTH languages so neither hand-written table can
    // grow alone -- the same discipline v1.0.12 put on the iCloud time-parity
    // fixture. These two tables are the parity claim for this class, and a row
    // added here and not in test_weather_at_malformed_parity.py would leave the
    // other runtime unmeasured with both files green.
    expect(PRESENCE_ROWS.length).toBe(11)
  })

  it('the CONTROL: an untouched `current` block still answers at the current tier', () => {
    const { verdict, payload } = payloadVerdict(base(), 'current')
    expect(verdict).toBe('accept')
    expect(payload!.resolution).toBe('current')
  })

  it.each(PRESENCE_ROWS.map(r => [r.id, r] as const))('%s', (_id, row) => {
    expect(payloadVerdict(presenceBody(row), 'current').verdict).toBe(row.verdict)
  })
})

// ── claim 6: the copy block validates what each response CONTRIBUTES ────────
// `formatWeather` is a FAN-IN: `/weather/{checklist_id}` hands it one response
// per sampled hour of the checklist. The nine figures are aggregated from every
// one of them -- including `dt`, `sunrise` and `sunset`, which `isNightHour`
// reads from all of them to decide the moon emoji -- while `weather[0]` is read
// from `first` ALONE.
//
// So the guard is per field-each-response-contributes, and the rows below are
// what pin that. The defect they close (QA finding F-2) is the first cut
// running the WHOLE validator on every response: a malformed `weather` on hour
// 2 of 3 was accepted on both runtimes at v1.0.31 and became a 502 on both --
// an unrecorded widening that contradicted this build's own tier-selector
// argument, where one bad hour of 48 is explicitly not allowed to cost the
// answer. It is also inconsistent one level down: `weather[1]` is deliberately
// unchecked because nothing reads it.
const LATER_CONDITION = [{ id: 804, description: 'overcast clouds' }]

/** Three sampled hours an hour apart, all inside the sunrise-sunset window.
 *  Hours 1 and 2 carry a DIFFERENT condition from hour 0 on purpose: the block
 *  must report hour 0's, which is what makes `weather` first-only a measured
 *  fact about this formatter rather than a reading of its source. */
function multiResponses(): HourlyResponse[] {
  const b = F.hourBase as Record<string, unknown>
  return [0, 1, 2].map(i => ({
    data: [{
      ...JSON.parse(JSON.stringify(b)),
      dt: (b.dt as number) + i * 3600,
      temp: (b.temp as number) + i * 2,
      wind_speed: (b.wind_speed as number) + i,
      ...(i === 0 ? {} : { weather: JSON.parse(JSON.stringify(LATER_CONDITION)) }),
    }],
  })) as unknown as HourlyResponse[]
}

interface MultiRow {
  id: string; index: number; field?: string
  op?: 'delete' | 'set'; value?: unknown
  verdict: 'accept' | 'refuse'
}
const WEATHER_MUTATIONS: Array<[string, 'delete' | 'set', unknown]> = [
  ['delete', 'delete', undefined],
  ['set null', 'set', null],
  ['set empty-list', 'set', []],
  ['set list-of-empty-object', 'set', [{}]],
  ['set null-description', 'set', [{ id: 800, description: null }]],
  ['set string', 'set', 'sunny'],
]
// One row per HOUR_FIGURES member, on a NON-FIRST response. All nine are read
// from every response, so all nine must refuse -- the three clock fields
// included, which is the half a reader of `first.sunrise` would get wrong.
const FIGURE_MUTATIONS: Array<[string, 'delete' | 'set', unknown]> = [
  ['dt', 'set', null],
  ['temp', 'set', 'warm'],
  ['humidity', 'delete', undefined],
  ['dew_point', 'set', null],
  ['wind_speed', 'set', 'warm'],
  ['wind_deg', 'set', true],
  ['clouds', 'delete', undefined],
  ['sunrise', 'set', 'x'],
  ['sunset', 'delete', undefined],
]
const MULTI_ROWS: MultiRow[] = [
  { id: 'the CONFORMING control', index: 0, verdict: 'accept' },
  ...WEATHER_MUTATIONS.map(([label, op, value]): MultiRow =>
    ({ id: `weather ${label} @1 (a LATER hour)`, index: 1, field: 'weather', op, value, verdict: 'accept' })),
  ...WEATHER_MUTATIONS.map(([label, op, value]): MultiRow =>
    ({ id: `weather ${label} @0 (the FIRST hour)`, index: 0, field: 'weather', op, value, verdict: 'refuse' })),
  ...FIGURE_MUTATIONS.map(([field, op, value]): MultiRow =>
    ({ id: `${field} ${op} @1 (a LATER hour)`, index: 1, field, op, value, verdict: 'refuse' })),
]

function multiBody(row: MultiRow): HourlyResponse[] {
  const rs = multiResponses()
  if (!row.field) return rs
  const h = rs[row.index].data[0] as unknown as Record<string, unknown>
  if (row.op === 'delete') delete h[row.field]
  else h[row.field] = JSON.parse(JSON.stringify(row.value ?? null))
  return rs
}

describe('formatWeather validates the fields each sampled hour contributes', () => {
  const conforming = () => formatWeather(multiResponses(), F.tz, F.lat)

  it('reports the FIRST hour\'s condition, which is why `weather` is checked there only', () => {
    const out = conforming()
    expect(out).toContain('Scattered clouds')
    expect(out).not.toContain('Overcast clouds')
    expect(out).not.toContain('NaN')
    // And the aggregated fields really do come from all three, so the rows
    // below cannot pass by the later hours being ignored wholesale.
    expect(out).toContain('Temperature: 60 - 64°F')
  })

  it('covers all nine aggregated figures on a non-first hour', () => {
    const covered = MULTI_ROWS
      .filter(r => r.verdict === 'refuse' && r.index !== 0 && r.field !== 'weather')
      .map(r => r.field)
    expect([...covered].sort()).toEqual([...HOUR_FIGURES].sort())
    // Both outcomes, and the row count in both languages (see the presence
    // block above for why the count is asserted rather than left implicit).
    expect(MULTI_ROWS.some(r => r.verdict === 'accept')).toBe(true)
    expect(MULTI_ROWS.some(r => r.verdict === 'refuse')).toBe(true)
    expect(MULTI_ROWS.length).toBe(22)
  })

  it.each(MULTI_ROWS.map(r => [r.id, r] as const))('%s', (_id, row) => {
    if (row.verdict === 'refuse') {
      expect(() => formatWeather(multiBody(row), F.tz, F.lat)).toThrow()
      return
    }
    // ACCEPT is the stronger claim: not merely that it does not throw, but that
    // the produced block is byte-identical to the all-conforming one, because a
    // field nothing reads cannot change what is printed.
    expect(formatWeather(multiBody(row), F.tz, F.lat)).toBe(conforming())
  })
})

// ── regeneration ────────────────────────────────────────────────────────────
// The verdict columns are produced by the SHIPPED builders, never hand-written
// (v1.0.29): a hand-written expected column encodes the author's model of the
// data, and that is the model that wrote the bug. The Python half then has to
// reproduce both columns from the same body, which IS the parity claim.
//
// Unlike tideEpoch.fixtureGen.test.ts this lives in the gate file rather than
// beside it, deliberately: generation and assertion must apply the SAME shape
// DSL, and a second TS copy of `applyShape` is a place for the two to drift.
//
//   SR_GEN_WEATHER_AT_MALFORMED_FIXTURE=1 npx vitest run src/lib/weatherAtMalformedParity.test.ts
const NUMERIC = ['temp', 'humidity', 'dew_point', 'wind_speed', 'wind_deg', 'clouds']
const DAILY_NUMERIC = ['temp.day', 'temp.min', 'temp.max', 'humidity', 'dew_point', 'wind_speed', 'wind_deg', 'clouds']
const BAD: Array<[string, unknown]> = [['null', null], ['string', 'warm'], ['boolean', true]]
const WEATHER_SHAPES: Array<[string, unknown]> = [
  ['null', null], ['string', 'sunny'], ['empty-list', []], ['list-of-empty-object', [{}]],
  ['list-of-string', ['x']], ['non-numeric-id', [{ id: 'x', description: 'clear sky' }]],
  ['null-description', [{ id: 800, description: null }]],
]
const CLOCK = ['dt', 'sunrise', 'sunset']
const CLOCK_SHAPES: Array<[string, unknown]> = [['null', null], ['string', 'x'], ['absurd', 1e20]]
const TIER_SHAPES: Array<[string, unknown]> = [
  ['string', 'nope'], ['number', 5], ['object', { a: 1 }], ['empty-object', {}], ['null', null], ['empty-list', []],
]

function shapeTable(): Array<Omit<Row, 'verdict' | 'planVerdict' | 'why'>> {
  const out: Array<Omit<Row, 'verdict' | 'planVerdict' | 'why'>> = []
  const push = (r: Omit<Row, 'id' | 'verdict' | 'planVerdict' | 'why'>) => {
    const suffix = r.only === undefined ? '' : ` @${r.only}`
    out.push({ ...r, id: `${r.tier} ${r.field ?? '(entry)'} ${r.op}${r.label ? ` ${r.label}` : ''}${suffix}` })
  }
  for (const tier of ['current', 'hourly', 'daily'] as const) {
    push({ tier, op: 'none' })
    for (const field of tier === 'daily' ? DAILY_NUMERIC : NUMERIC) {
      push({ tier, field, op: 'delete' })
      for (const [label, value] of BAD) push({ tier, field, op: 'set', value, label })
    }
    if (tier === 'daily') {
      push({ tier, field: 'temp', op: 'delete' })
      for (const [label, value] of [['null', null], ['empty-object', {}], ['string', 'x']] as Array<[string, unknown]>) {
        push({ tier, field: 'temp', op: 'set', value, label })
      }
    }
    push({ tier, field: 'weather', op: 'delete' })
    for (const [label, value] of WEATHER_SHAPES) push({ tier, field: 'weather', op: 'set', value, label })
    for (const field of CLOCK) {
      push({ tier, field, op: 'delete' })
      for (const [label, value] of CLOCK_SHAPES) push({ tier, field, op: 'set', value, label })
    }
    push({ tier, op: 'keep-dt-only' })
    push({ tier, op: 'entries-non-objects' })
    for (const [label, value] of TIER_SHAPES) push({ tier, op: 'tier-replaced', value, label })
  }
  // SINGLE-ENTRY variants. A provider hiccup on ONE hour is far likelier than
  // all 48 being malformed, and it is the only shape that can separate the two
  // nearest-entry searches: Python's `min` raised on a key it could not compute
  // where `Math.abs(NaN) < x` is merely false, so a single bad `dt` was a 502
  // on web/Pi and a valid neighbouring hour on desktop.
  for (const tier of ['hourly', 'daily'] as const) {
    for (const field of tier === 'daily' ? ['temp.day', 'humidity', 'weather', 'dt'] : ['temp', 'humidity', 'weather', 'dt']) {
      for (const [label, value] of [['null', null], ['string', 'warm']] as Array<[string, unknown]>) {
        for (const only of [0, 5]) push({ tier, field, op: 'set', value, label, only })
      }
    }
  }
  return out
}

const HOUR_BASE = {
  dt: 1714563000, temp: 60.5, humidity: 70, dew_point: 50.25,
  wind_speed: 8, wind_deg: 270, clouds: 20,
  weather: [{ id: 802, description: 'scattered clouds' }],
  sunrise: 1714563000 - 10800, sunset: 1714563000 + 21600,
}

function hourShapeTable(): HourRow[] {
  const out: HourRow[] = []
  const push = (r: Omit<HourRow, 'id'> & { label?: string }) =>
    out.push({ ...r, id: `hour ${r.field ?? '(body)'} ${r.op}${r.label ? ` ${r.label}` : ''}` })
  for (const field of ['dt', 'temp', 'humidity', 'dew_point', 'wind_speed', 'wind_deg', 'clouds', 'sunrise', 'sunset']) {
    push({ field, op: 'delete' })
    for (const [label, value] of BAD) push({ field, op: 'set', value, label })
  }
  push({ field: 'weather', op: 'delete' })
  for (const [label, value] of WEATHER_SHAPES) push({ field: 'weather', op: 'set', value, label })
  for (const [label, value] of [
    ['body a string', 'nope'], ['body a list', [1, 2, 3]], ['body an empty object', {}],
    ['data empty list', { data: [] }], ['data a string', { data: 'x' }],
    ['data a list of non-objects', { data: ['x', null] }],
  ] as Array<[string, unknown]>) push({ op: 'body', value, label })
  return out
}

/** The reason an accepting row is allowed to accept. Matched most-specific
 *  first; the catch-alls are deliberately narrow so a NEW accepting shape has
 *  no `why` and turns the "states a reason" row above red. */
const WHY: Array<[RegExp, string]> = [
  [/^\w+ \(entry\) none$/, 'the CONFORMING control: the unmutated fixture body, which must still answer'],
  [/^current dt set absurd$/, 'dt 1e20 is a finite number, so both runtimes accept it and agree on the (wrong) night reading it produces; range plausibility is a separate unmeasured question, out of scope for this build and a ROADMAP candidate the Chronicler is handed at closeout'],
  [/^daily dt set absurd$/, 'as above: finite, so both accept, and the nearest-entry search places it identically'],
  [/^hourly dt set absurd$/, 'as above, and the tier still resolves hourly because the horizon is finite'],
  [/^hourly dt (delete|set (null|string))$/, 'every hourly entry loses its dt, so the tier has no usable coverage and BOTH runtimes fall through to a well-formed DAILY reading -- the response says resolution: daily, so nothing is misreported'],
  [/^hourly \(entry\) (entries-non-objects|tier-replaced)/, 'the hourly array is unusable, so both fall through to a well-formed daily reading; resolution says daily'],
  [/^current (sunrise|sunset) delete$/, 'One Call OMITS sunrise/sunset for polar day and polar night, so both runtimes inject them from the matching daily entry rather than refusing a well-formed high-latitude body'],
  [/^hourly (sunrise|sunset) (delete|set )/, 'hourly entries never carry sunrise/sunset, so both runtimes overwrite the mutation from the matching daily entry -- a genuine no-op on this body, kept as a row so that stays true'],
  [/^daily (sunrise|sunset) (delete|set null)$/, 'the daily sunrise/sunset dt-fallback: absent OR null falls back to the entry dt on both runtimes, deliberately, because One Call omits them at polar latitudes (the dt-derived time is itself a wrong figure on either tier, out of scope for this build and a ROADMAP candidate the Chronicler is handed at closeout)'],
  [/^current \(entry\) tier-replaced null$/, 'a null `current` is an ABSENT current block on both runtimes, and with no dt target there is no other tier to answer from, so both answer the existing out-of-range state -- no figure at all, rather than a fabricated one'],
  [/^daily dt (delete|set (null|string))$/, 'every daily entry loses its dt, and daily is the LAST tier, so both runtimes answer the existing out-of-range state (formatted and summary both null). Nothing is fabricated; the surface shows its "no weather for this moment" state rather than a provider error, which /weather/at has always done for a body it cannot place -- see decisions.md, where that asymmetry with /weather/plan is recorded rather than changed here'],
  [/^daily \(entry\) (entries-non-objects|tier-replaced)/, 'the daily array is unusable and daily is the last tier, so both answer out-of-range, as above'],
  [/ @0$/, 'the mutation lands on an entry the target does not select, so the reading comes from an untouched entry and both runtimes return the same real figures'],
  [/^(hourly|daily) dt set (null|string) @5$/, 'the selected entry loses its dt and is filtered out of the candidate set on both runtimes, so the nearest USABLE neighbour answers -- a real entry, at the right resolution, rather than a 502 for one bad hour'],
]

function whyFor(id: string): string | undefined {
  for (const [re, why] of WHY) if (re.test(id)) return why
  return undefined
}

describe.skipIf(!process.env.SR_GEN_WEATHER_AT_MALFORMED_FIXTURE)('regenerate the malformed-parity fixture', () => {
  it('writes weatherAtMalformed.fixture.json from the shipped builders', () => {
    const oc0 = base()
    const targets = {
      current: null,
      hourly: (oc0.hourly as Array<{ dt: number }>)[5].dt,
      daily: (oc0.daily as Array<{ dt: number }>)[5].dt,
    }
    const rows = shapeTable().map(shape => {
      const row = { ...shape, verdict: 'refuse' as Verdict, planVerdict: 'refuse' as Verdict }
      const verdict = payloadVerdict(applyShape(base(), row as Row), shape.tier).verdict
      const plan = planVerdict(applyShape(base(), row as Row))
      const out: Row = { ...shape, verdict, planVerdict: plan }
      const why = verdict === 'refuse' ? undefined : whyFor(shape.id)
      return why ? { ...out, why } : out
    })
    writeFileSync(new URL('./weatherAtMalformed.fixture.json', import.meta.url), JSON.stringify({
      note: 'Generated by weatherAtMalformedParity.test.ts from the SHIPPED buildWeatherPayload / buildWeatherPlan. Do not hand-edit. backend/tests/test_weather_at_malformed_parity.py drives the same rows and must reproduce both verdict columns.',
      tz: 'America/Los_Angeles',
      lat: 36.603,
      lng: -121.876,
      nowTs: (planFixture as { families: Array<{ nowTs: number }> }).families[0].nowTs,
      targets,
      hourBase: HOUR_BASE,
      rows,
      hourRows: hourShapeTable(),
    }, null, 1) + '\n')
  })
})
