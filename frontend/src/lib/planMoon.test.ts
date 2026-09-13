// The per-day moon line (plan-sun-moon-readout, schema C; QA-35 to QA-37): the
// lunar-month sweep at one-hour steps in both hemispheres, asserting the glyph
// and the name change at the same instants with exactly eight distinct pairs
// per hemisphere, the northern pair at phase i being MOON_NORTH[i] and the
// southern MOON_SOUTH[i] with the SAME name; local noon reading 12:00 through
// the producers' own clock helper over the clock-change families; and the
// glyph being the checklist blocks' own function, never a copy. The golden
// rows at the end come from the Python oracle (weatherFormatter.golden.py,
// "moon_phase_emoji: plan fixture days at local noon") and are asserted on
// the Python side too (backend/tests/test_formatters.py), so a change on
// either side goes red on its own side.
import { describe, it, expect } from 'vitest'
import fixture from './weatherTidePlan.fixture.json'
import { composePlan, type Plan, type PlanDay, type TidePlanResponse, type WeatherPlan } from './plan'
import { MOON_PHASE_NAMES, localNoonTs, moonForDay } from './planMoon'
import { MOON_NORTH, MOON_SOUTH, moonPhaseEmoji } from './weatherFormatter'
import { localClock } from './tzClock'

interface Family { name: string; expectedWeather: { ok: true; plan: WeatherPlan } | { ok: false }; expectedTide: TidePlanResponse }
const families = (fixture as { families: Family[] }).families.filter(f => f.expectedWeather.ok)
const planOf = (name: string): Plan => {
  const f = families.find(x => x.name === name)!
  return composePlan((f.expectedWeather as { ok: true; plan: WeatherPlan }).plan, f.expectedTide)!
}
const dayAt = (ts: number): PlanDay => ({ date: '', startTs: ts - 43200, endTs: ts + 43199, sunrise: null, sunset: null })

describe('the eight names sit on the eight glyph bins (FR-38, QA-37)', () => {
  it('has exactly eight names in phase order', () => {
    expect(MOON_PHASE_NAMES).toEqual(['New moon', 'Waxing crescent', 'First quarter', 'Waxing gibbous', 'Full moon', 'Waning gibbous', 'Last quarter', 'Waning crescent'])
  })

  it.each([['north', 36.6, MOON_NORTH], ['south', -33.9, MOON_SOUTH]])('%s: over a lunar month at one-hour steps the glyph and the name change at the same instants, with exactly eight distinct pairs', (_h, lat, glyphs) => {
    // Lunation k = 300 of the port's reference epoch (2451550.1 JD).
    const start = Math.round((2451550.1 + 300 * 29.53058770576 - 2440587.5) * 86400)
    const pairs = new Set<string>()
    let prev: { glyph: string; name: string } | null = null
    let changes = 0
    for (let h = 0; h <= 30 * 24; h += 1) {
      const r = moonForDay(dayAt(start + h * 3600), lat)!
      expect(r).not.toBeNull()
      pairs.add(`${r.glyph}|${r.name}`)
      if (prev) {
        expect(r.glyph !== prev.glyph, `hour ${h}`).toBe(r.name !== prev.name)
        if (r.glyph !== prev.glyph) changes += 1
      }
      prev = r
    }
    expect(pairs.size).toBe(8)
    expect(changes).toBeGreaterThanOrEqual(8)
    // The pair at phase i is the hemisphere's own glyph at index i with name i.
    for (let i = 0; i < 8; i += 1) expect(pairs.has(`${glyphs[i]}|${MOON_PHASE_NAMES[i]}`), `phase ${i}`).toBe(true)
  })

  it('the name follows the phase and never mirrors: the same instant gives the same name in both hemispheres and mirrored glyphs', () => {
    const start = Math.round((2451550.1 + 300 * 29.53058770576 - 2440587.5) * 86400)
    for (let d = 0; d < 30; d += 1) {
      const n = moonForDay(dayAt(start + d * 86400 + 3600), 40)!
      const s = moonForDay(dayAt(start + d * 86400 + 3600), -40)!
      expect(s.name).toBe(n.name)
      expect(MOON_SOUTH.indexOf(s.glyph)).toBe(MOON_NORTH.indexOf(n.glyph))
      if (n.glyph !== '🌑' && n.glyph !== '🌕') expect(s.glyph).not.toBe(n.glyph)
    }
  })
})

describe('local noon from the day\'s own boundaries (FR-37, schema D7)', () => {
  it.each(['reference', 'dst-fall', 'dst-spring', 'far-station', 'polar'])('%s: every day\'s local noon reads 12:00 in the location\'s clock, including the 25- and 23-hour days', (name) => {
    const plan = planOf(name)
    for (const d of plan.days) {
      expect(localClock(localNoonTs(d), plan.tz).slice(11), `${name} ${d.date}`).toBe('12:00')
      expect(localClock(localNoonTs(d), plan.tz).slice(0, 10)).toBe(d.date)
    }
  })
  it('a 24-hour day gives midnight + 12 h, a 25-hour day + 13 h, a 23-hour day + 11 h', () => {
    expect(localNoonTs({ date: '', startTs: 0, endTs: 86399, sunrise: null, sunset: null })).toBe(43200)
    expect(localNoonTs({ date: '', startTs: 0, endTs: 89999, sunrise: null, sunset: null })).toBe(46800)
    expect(localNoonTs({ date: '', startTs: 0, endTs: 82799, sunrise: null, sunset: null })).toBe(39600)
  })
})

describe('the glyph is the checklist blocks\' own function (FR-36, FR-39, QA-36)', () => {
  it('for every fixture day, moonForDay\'s glyph equals moonPhaseEmoji at that day\'s local noon and the plan\'s latitude', () => {
    let rows = 0
    for (const f of families) {
      const plan = planOf(f.name)
      for (const d of plan.days) {
        const r = moonForDay(d, plan.lat)!
        expect(r.glyph).toBe(moonPhaseEmoji(localNoonTs(d), plan.lat))
        expect(MOON_PHASE_NAMES).toContain(r.name)
        rows += 1
      }
    }
    expect(rows).toBeGreaterThan(80)
  })

  it('a southern latitude yields the mirrored glyph and the same name', () => {
    const plan = planOf('reference')
    for (const d of plan.days) {
      const n = moonForDay(d, plan.lat)!
      const s = moonForDay(d, -plan.lat)!
      expect(s.name).toBe(n.name)
      expect(s.glyph).toBe(MOON_SOUTH[MOON_NORTH.indexOf(n.glyph)])
    }
  })

  it('the plan document carries no provider moon field, so none can be read: the derivation takes only the day and the latitude', () => {
    expect(moonForDay.length).toBe(2)
    const plan = planOf('reference')
    const withField = { ...plan.days[1], moon_phase: 0.5, moonPhase: 0.5 } as unknown as PlanDay
    expect(moonForDay(withField, plan.lat)).toEqual(moonForDay(plan.days[1], plan.lat))
  })
})

// ── the golden rows: PASTED from the Python oracle's output, never regenerated
//    here (the paste-the-golden shape). Same rows in backend/tests/
//    test_formatters.py::TestMoonPhaseEmoji::test_plan_fixture_days_at_local_noon.
describe('the moon golden oracle: fixture days at local noon (QA-36)', () => {
  const GOLDEN: Array<[string, string, string]> = [
    // family, date, glyph from the Python twin
    ['reference', '2026-09-12', '🌑'],
    ['reference', '2026-09-13', '🌒'],
    ['reference', '2026-09-14', '🌒'],
    ['reference', '2026-09-15', '🌒'],
    ['reference', '2026-09-16', '🌒'],
    ['reference', '2026-09-17', '🌓'],
    ['reference', '2026-09-18', '🌓'],
    ['reference', '2026-09-19', '🌓'],
    ['dst-fall', '2026-10-31', '🌗'],
    ['dst-fall', '2026-11-01', '🌗'],
    ['dst-fall', '2026-11-02', '🌗'],
    ['dst-fall', '2026-11-03', '🌗'],
    ['dst-fall', '2026-11-04', '🌘'],
    ['dst-fall', '2026-11-05', '🌘'],
    ['dst-fall', '2026-11-06', '🌘'],
    ['dst-fall', '2026-11-07', '🌘'],
    ['dst-spring', '2026-03-07', '🌖'],
    ['dst-spring', '2026-03-08', '🌖'],
    ['dst-spring', '2026-03-09', '🌗'],
    ['dst-spring', '2026-03-10', '🌗'],
    ['dst-spring', '2026-03-11', '🌗'],
    ['dst-spring', '2026-03-12', '🌗'],
    ['dst-spring', '2026-03-13', '🌘'],
    ['dst-spring', '2026-03-14', '🌘'],
    ['polar', '2026-07-25', '🌔'],
    ['polar', '2026-07-26', '🌔'],
    ['polar', '2026-07-27', '🌕'],
    ['polar', '2026-07-28', '🌕'],
    ['polar', '2026-07-29', '🌕'],
    ['polar', '2026-07-30', '🌕'],
    ['polar', '2026-07-31', '🌖'],
    ['polar', '2026-08-01', '🌖'],
  ]

  it('is not vacuous and spans more than one phase per family', () => {
    expect(GOLDEN).toHaveLength(32)
    for (const fam of ['reference', 'dst-fall', 'dst-spring', 'polar']) {
      expect(new Set(GOLDEN.filter(r => r[0] === fam).map(r => r[2])).size).toBeGreaterThanOrEqual(2)
    }
  })

  it.each(GOLDEN)('%s %s reads %s', (name, date, glyph) => {
    const plan = planOf(name)
    const day = plan.days.find(d => d.date === date)!
    expect(day).toBeTruthy()
    expect(moonForDay(day, plan.lat)!.glyph).toBe(glyph)
  })
})
