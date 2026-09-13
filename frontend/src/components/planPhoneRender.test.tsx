// @vitest-environment jsdom
// The phone tier is byte-identical to what shipped, proved by DOM equality
// against a golden captured from the built components
// (frontend/src/lib/planPhoneRender.golden.html: the reference family,
// PlanResult with the real PlanChart, at the phone tier, at rest).
//
// RE-BASELINED AT 1.0.30 (plan-sun-moon-readout): the render deliberately
// changed (the slider role, the sun track, the readout block, the day-by-day
// divider, the moon and sun-peak line on every day, the first day's "from"
// suffix, the Sun height legend entry), so the golden was regenerated from
// the new render and its diff reviewed; the two 1.0.29 deltas (snap markers,
// the day-button group) no longer apply and are gone. From here on the golden
// pins the phone render for the NEXT change, and a regeneration is a
// deliberate act named in the changelog's pipeline record, never a
// same-commit convenience (the testing rule).
//
// Exactly ONE normalization, named here and nowhere else: React's `useId()`
// values (`_r_N_`, three in this render: the divider's label id, the slider's
// description id and Recharts' line clipPath) are replaced by a fixed token on
// both sides, so a React upgrade that respells them cannot turn this red for a
// plumbing reason. Everything else, attribute for attribute, must match.
//
// This file mounts EXACTLY ONE chart before the comparison: Recharts stamps a
// per-instance `recharts{n}-clip` counter into its markup, so a second `it`
// here would turn the golden red for a plumbing reason.
import { it, expect, afterEach, afterAll, beforeEach, vi } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import fixture from '../lib/weatherTidePlan.fixture.json'
import { composePlan, type TidePlanResponse, type WeatherPlan } from '../lib/plan'
import { PLAN_COPY } from '../lib/planCopy'
import { PlanResult } from './PlanResult'
import { PlanChart } from './PlanChart'

afterEach(cleanup)
afterAll(() => new Promise((r) => setTimeout(r, 120)))
beforeEach(() => {
  vi.stubGlobal('matchMedia', (q: string) => ({
    matches: q === '(max-width:640px)', media: q,
    addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, onchange: null, dispatchEvent: () => false,
  }))
})
afterEach(() => vi.unstubAllGlobals())

const GOLDEN = readFileSync(process.cwd() + '/src/lib/planPhoneRender.golden.html', 'utf8')
const normalizeIds = (html: string) => html.replace(/_[Rr]_[a-z0-9]+_/g, '_r_x_')

it('the phone-tier render equals the golden, attribute for attribute, with React\'s useId values normalized', () => {
  const f = (fixture as { families: Array<{ name: string; expectedWeather: { plan: WeatherPlan }; expectedTide: TidePlanResponse }> }).families.find(x => x.name === 'reference')!
  const plan = composePlan(f.expectedWeather.plan, f.expectedTide)!
  const { container } = render(
    <PlanResult plan={plan} place="Del Monte Beach, Monterey" replayedAt={null} tideErrKind={null} overriding={false} onOverride={() => {}}
      ChartComponent={PlanChart} daysInView="all" onDaysInViewChange={() => {}} />,
  )
  expect(normalizeIds(container.innerHTML)).toBe(normalizeIds(GOLDEN))
  // Non-vacuity: the golden really is the full 1.0.30 phone render, at rest.
  expect(GOLDEN.length).toBeGreaterThan(90000)
  expect(GOLDEN).toContain('style="height: 242px;"')
  expect(GOLDEN).toContain('role="slider"')
  expect(GOLDEN).toContain('class="sr-plan-suntrack"')
  expect(GOLDEN).toContain('class="sr-plan-readout"')
  expect(GOLDEN).toContain('sr-plan-ro-rest is-on')
  expect(GOLDEN.match(/class="sr-plan-dayfacts"/g)).toHaveLength(8)
  expect(GOLDEN).toContain(PLAN_COPY.listName)
  expect(GOLDEN).not.toContain('sr-plan-pickmark')
  expect(GOLDEN).not.toContain('sr-plan-snap')
  expect(GOLDEN).not.toContain('sr-plan-dayhdr')
  expect(GOLDEN).not.toContain('sr-plan-toolbar')
  expect(GOLDEN.match(/_[Rr]_[a-z0-9]+_/g)!.length).toBeGreaterThanOrEqual(3)
})
