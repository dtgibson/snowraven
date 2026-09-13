// @vitest-environment jsdom
// The phone tier is byte-identical to what shipped (D4-13), proved by DOM
// equality against a golden captured from the shipped build BEFORE the wide
// tier existed (frontend/src/lib/planPhoneRender.golden.html: the reference
// family, PlanResult with the real PlanChart, at the phone tier). Exactly two
// spec'd deltas are normalized, each named here and nowhere else:
//   1. the eight scroll-snap markers are gone (D4-12), so they are stripped
//      from the golden;
//   2. the legend's scroll hint now sits inside the day-button group, which the
//      legend gained on both tiers (D4-12), so the group is reduced to the bare
//      hint in the new render.
// Everything else, attribute for attribute, must match.
import { it, expect, afterEach, afterAll, beforeEach, vi } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import fixture from '../lib/weatherTidePlan.fixture.json'
import { composePlan, type TidePlanResponse, type WeatherPlan } from '../lib/plan'
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

it('the phone-tier render equals the shipped golden apart from the two spec\'d deltas', () => {
  const f = (fixture as { families: Array<{ name: string; expectedWeather: { plan: WeatherPlan }; expectedTide: TidePlanResponse }> }).families.find(x => x.name === 'reference')!
  const plan = composePlan(f.expectedWeather.plan, f.expectedTide)!
  const { container } = render(
    <PlanResult plan={plan} place="Del Monte Beach, Monterey" replayedAt={null} tideErrKind={null} overriding={false} onOverride={() => {}}
      ChartComponent={PlanChart} daysInView="all" onDaysInViewChange={() => {}} />,
  )
  // Delta 1: the golden's snap markers.
  const golden = GOLDEN.replace(/<span class="sr-plan-snap"[^>]*><\/span>/g, '')
  expect(GOLDEN.match(/sr-plan-snap/g)).toHaveLength(8)
  // Delta 2: the new render's day-button group reduced to the bare hint.
  const now = container.innerHTML.replace(/<span class="sr-plan-nav">(<span class="sr-plan-legend-scroll")( hidden="")?>([\s\S]*?)<\/span><button[\s\S]*?<\/button><button[\s\S]*?<\/button><\/span>/, '$1>$3</span>')
  expect(now).not.toContain('sr-plan-nav')
  expect(now).not.toContain('sr-plan-navbtn')
  expect(now).toBe(golden)
  // Non-vacuity: the golden really is the full phone render.
  expect(golden.length).toBeGreaterThan(60000)
  expect(golden).toContain('style="height: 242px;"')
  expect(golden).not.toContain('sr-plan-dayhdr')
  expect(golden).not.toContain('sr-plan-toolbar')
})
