// @vitest-environment jsdom
// The Weather/tide Planner's result region and chart, rendered from a REAL plan:
// the shipped builders over the parity fixture's families, composed by the
// shipped merge, so every figure asserted here is one the app would show. The
// list is the accessible form (QA-04, QA-05, QA-10 to QA-16, QA-19 to QA-27,
// QA-35, QA-46); the chart is one tab stop, a slider since 1.0.30, with an
// inert, hidden interior (QA-27, QA-53). The plan-sun-moon-readout rows at
// the end cover the readout block, the day-by-day divider, the moon and
// sun-peak lines and the pick's ownership by this region.
import { describe, it, expect, afterEach, afterAll, beforeEach, vi } from 'vitest'
import { render, screen, cleanup, within, fireEvent } from '@testing-library/react'
import fixture from '../lib/weatherTidePlan.fixture.json'
import { composePlan, type Plan, type TidePlanResponse, type WeatherPlan } from '../lib/plan'
import { tideTooFarNotice, tideOverrideLabel } from '../lib/tideNotice'
import { PLAN_COPY } from '../lib/planCopy'
import { clockOf, ftSigned } from '../lib/planFormat'
import { MOON_PHASE_NAMES } from '../lib/planMoon'
import { buildSunModel, sunPeakByDay } from '../lib/planSun'
import { localClock } from '../lib/tzClock'
import { PlanResult } from './PlanResult'
import { PlanChart } from './PlanChart'

afterEach(cleanup)
// recharts' toolkit arms a 100 ms fallback timer per mounted chart; let it fire
// before this jsdom environment is torn down (the house rule for chart files).
afterAll(() => new Promise((r) => setTimeout(r, 120)))

/** The tier comes from the app's phone-tier hook over matchMedia; jsdom has no
 *  matchMedia, so each file states the tier it renders at. The approved
 *  assertions in this file are the PHONE tier's; the wide tier has its own
 *  describe below. */
function tier(phone: boolean) {
  vi.stubGlobal('matchMedia', (q: string) => ({
    matches: q === '(max-width:640px)' ? phone : false, media: q,
    addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {},
    onchange: null, dispatchEvent: () => false,
  }))
}
beforeEach(() => tier(true))
afterEach(() => vi.unstubAllGlobals())

interface Family { name: string; expectedWeather: { ok: true; plan: WeatherPlan } | { ok: false }; expectedTide: TidePlanResponse }
const families = (fixture as { families: Family[] }).families
const half = (name: string) => families.find(f => f.name === name)!
function planOf(name: string, tideOverride?: TidePlanResponse | null): Plan {
  const f = half(name)
  const w = (f.expectedWeather as { ok: true; plan: WeatherPlan }).plan
  return composePlan(w, tideOverride === undefined ? f.expectedTide : tideOverride)!
}

const noop = () => {}
const NoChart = () => <div data-testid="chart-slot" />
function show(plan: Plan, over: Partial<Parameters<typeof PlanResult>[0]> = {}, withChart = false) {
  return render(
    <PlanResult
      plan={plan}
      place="Del Monte Beach, Monterey"
      replayedAt={null}
      tideErrKind={null}
      overriding={false}
      onOverride={noop}
      ChartComponent={withChart ? PlanChart : NoChart}
      daysInView="all"
      onDaysInViewChange={noop}
      {...over}
    />,
  )
}

const MOON = /[\u{1F311}-\u{1F318}]/u

describe('the plan region and header (QA-04, QA-05)', () => {
  it('is a region named as a plan, with the place, the pill, the window and the station line once', () => {
    const plan = planOf('reference')
    show(plan)
    const region = screen.getByRole('region', { name: PLAN_COPY.regionName })
    expect(within(region).getByRole('heading', { level: 3 }).textContent).toBe('Del Monte Beach, Monterey')
    expect(within(region).getByText('Plan · 8 days')).toBeTruthy()
    expect(within(region).getByText(/→/).textContent).toMatch(/Sat, Sep 12, 2026, 3:41 PM → Sat, Sep 19, 2026, 11:59 PM/)
    expect(within(region).getByText(/Local time at this spot · 36\.603, -121\.876 · fetched 3:41 PM/)).toBeTruthy()
    const station = within(region).getByText(/Tide: MONTEREY, MONTEREY BAY \(9413450\) · 0\.9 mi ·/)
    expect(station.textContent).toContain('Predicted')
    expect(station.textContent).toContain('relative to MLLW')
    expect(station.textContent).not.toContain('interpolated')
    expect(region.textContent!.match(/relative to MLLW/g)).toHaveLength(1)
    expect(region.textContent).not.toContain('Observed')
    expect(within(region).getByText(PLAN_COPY.closingNote)).toBeTruthy()
  })

  it('a high/low-only station says its heights are interpolated (QA-22)', () => {
    show(planOf('subordinate'))
    expect(screen.getByText(/heights between highs and lows are interpolated/)).toBeTruthy()
  })

  it('a replayed plan shows the staleness cue with the loaded time (QA-40)', () => {
    show(planOf('reference'), { replayedAt: new Date(2026, 8, 12, 15, 41).getTime() })
    expect(screen.getByText(/showing the last loaded result, from Sep 12, 2026, 3:41 PM/)).toBeTruthy()
  })
})

describe('the list (QA-12 to QA-16, QA-19, QA-26, QA-46)', () => {
  it('is one item per day in order, each event carrying its date, kind, time, label, tide and weather', () => {
    const plan = planOf('reference')
    show(plan)
    const list = screen.getByRole('list', { name: PLAN_COPY.listName })
    const days = within(list).getAllByRole('listitem').filter(li => li.classList.contains('sr-plan-day'))
    expect(days).toHaveLength(8)
    expect(days.map(d => d.querySelector('h4')!.textContent)).toEqual(plan.days.map(d => new RegExp(d.date.slice(0, 4)).test(d.date) ? expect.stringContaining('2026') : ''))
    const items = list.querySelectorAll('li.sr-plan-ev')
    expect(items).toHaveLength(plan.events.length)
    // Chronological: the first event is today's sunset, the second tomorrow's sunrise.
    expect(items[0].querySelector('.sr-plan-ev-kind')!.textContent).toBe('Sunset')
    expect(items[0].querySelector('.sr-plan-ev-time')!.textContent).toBe('7:19 PM')
    expect(items[0].querySelector('.sr-only')!.textContent).toBe(', Sat, Sep 12, 2026')
    expect(items[1].querySelector('.sr-plan-ev-kind')!.textContent).toBe('Sunrise')
    // Every item carries both figure lines.
    for (const [i, li] of [...items].entries()) {
      const ev = plan.events[i]
      const res = li.querySelector('.sr-plan-ev-res')!.textContent
      expect(res).toBe(ev.weather.resolution === 'daily' ? 'FORECAST · DAILY' : 'FORECAST · HOURLY')
      const tide = li.querySelector('.sr-plan-ev-tide')!.textContent!
      expect(tide).toMatch(/^Tide -?−?\d+\.\d ft, (rising|falling) · between (high|low) −?\d+\.\d ft \(\d+:\d\d [AP]M( \w{3})?\) and (high|low) −?\d+\.\d ft \(\d+:\d\d [AP]M( \w{3})?\)$/)
      const wx = li.querySelector('.sr-plan-ev-wx')!.textContent!
      expect(wx).toContain(`${ev.weather.description}, ${ev.weather.tempF}°F`)
      expect(wx).toContain(`Wind ${ev.weather.windDesc}, ${ev.weather.windDir}`)
      expect(wx).toContain(`Humidity ${ev.weather.humidityPct}%`)
      expect(wx).toContain(`Dew pt ${ev.weather.dewPointF}°F`)
      expect(wx).toContain(`Cloud ${ev.weather.cloudsPct}%`)
      if (ev.weather.resolution === 'daily') expect(wx).toContain(`(H ${ev.weather.highF}° · L ${ev.weather.lowF}°)`)
      else expect(wx).not.toContain('(H ')
      // No moon glyph anywhere on an item (FR-20).
      expect(MOON.test(li.textContent!)).toBe(false)
    }
    // Hourly and daily labels both occur (the last day's sunset is daily).
    expect([...items].some(li => li.textContent!.includes('FORECAST · HOURLY'))).toBe(true)
    expect([...items].some(li => li.textContent!.includes('FORECAST · DAILY'))).toBe(true)
  })

  it('every strip cell reaches the list as text: a disclosure per hourly day, a one-line summary per daily day', () => {
    const plan = planOf('reference')
    show(plan)
    const details = document.querySelectorAll('details.sr-plan-hours')
    expect(details.length).toBeGreaterThanOrEqual(2)
    const summaries = [...details].map(d => d.querySelector('summary')!.textContent!.trim())
    expect(summaries[0]).toMatch(/^Sky hour by hour, \d+ readings/)
    // Every hourly cell's description appears in some disclosure body.
    const bodies = [...details].map(d => d.querySelector('p')!.textContent!).join(' ')
    for (const c of plan.cells.filter(c => c.resolution === 'hourly')) expect(bodies).toContain(c.weather.description)
    // The boundary day's partial daily cell is named as daily, from its start.
    expect(bodies).toMatch(/from \d+:\d\d [AP]M [A-Z][a-z ]+ \(daily\)/)
    // Daily-only days carry the one-line form with the daily label.
    const skies = document.querySelectorAll('p.sr-plan-sky')
    expect(skies.length).toBeGreaterThanOrEqual(5)
    for (const p of skies) expect(p.textContent).toMatch(/all day, H \d+° L \d+° FORECAST · DAILY$/)
  })

  it('a polar day says there is no sunset, and lists no sunset for it (QA-10)', () => {
    const plan = planOf('polar')
    show(plan)
    expect(screen.getAllByText(PLAN_COPY.noSunset).length).toBeGreaterThan(0)
    expect(screen.getAllByText(PLAN_COPY.noSunrise).length).toBeGreaterThan(0)
    const items = document.querySelectorAll('li.sr-plan-ev')
    expect(items).toHaveLength(plan.events.length)
  })

  it('a turning point at the event\'s minute is its next bracket, sharing its time (QA-14)', () => {
    const plan = planOf('same-minute-high')
    show(plan)
    const item = [...document.querySelectorAll('li.sr-plan-ev')].find(li => li.querySelector('.sr-plan-ev-time')!.textContent === '6:48 AM' && li.querySelector('.sr-plan-ev-kind')!.textContent === 'Sunrise')!
    // The height comes from the continuous samples around the minute (the
    // curve wins over the high/low interpolation); the bracket is the high
    // itself, at the event's own time.
    expect(item.querySelector('.sr-plan-ev-tide')!.textContent).toMatch(/^Tide −?\d+\.\d ft, rising · between low .* and high 5\.3 ft \(6:48 AM\)$/)
  })

  it('a one-sided bracket reads in words rather than a blank (QA-14)', () => {
    const f = half('reference')
    const tide = f.expectedTide as Extract<TidePlanResponse, { status: 'ok' }>
    // Only the first turning point survives: every event is after it, with nothing later.
    const plan = composePlan((f.expectedWeather as { ok: true; plan: WeatherPlan }).plan, { ...tide, curve: [], turningPoints: tide.turningPoints.slice(0, 1) })!
    show(plan)
    const first = document.querySelector('li.sr-plan-ev .sr-plan-ev-tide')!.textContent!
    expect(first).toMatch(/^Tide −?\d+\.\d ft, trend unknown \(no later high or low in the data\) · after (high|low) −?\d+\.\d ft \(.*\); no later high or low in the data$/)
  })
})

describe('the honest states', () => {
  it('too far: the notice and override once at the top, no tide lines, no High/Low legend, the chart name says no tide (QA-20, QA-27, QA-31)', () => {
    const plan = planOf('reference', { status: 'too-far', station: { id: '9413623', name: 'Elkhorn Slough, Highway 1 Bridge' }, distanceMi: 58 })
    show(plan, {}, true)
    expect(screen.getByText(tideTooFarNotice('Elkhorn Slough, Highway 1 Bridge', 58, 'too-far'))).toBeTruthy()
    const btn = screen.getByRole('button', { name: PLAN_COPY.overrideAria })
    expect(btn.textContent).toBe(tideOverrideLabel('too-far'))
    expect(btn.getAttribute('tabindex')).toBe('0')
    expect(document.querySelectorAll('.sr-plan-ev-tide')).toHaveLength(0)
    expect(document.querySelectorAll('.sr-plan-station')).toHaveLength(0)
    expect(screen.queryByText('High')).toBeNull()
    expect(screen.queryByText('Low')).toBeNull()
    const img = screen.getByRole('slider')
    expect(img.getAttribute('aria-label')).toMatch(/^Plan timeline for Del Monte Beach, Monterey, .*; no tide is shown\. The arrow keys read the weather and sun height at any moment\. Details are in the list below\.$/)
    // The chart still draws its shading, its markers and its strip.
    expect(img.querySelectorAll('.recharts-reference-area').length).toBeGreaterThan(1)
    expect(img.querySelectorAll('.sr-plan-cell').length).toBe(plan.cells.length)
    expect(img.querySelectorAll('polygon').length).toBe(plan.events.length)
    expect(img.querySelectorAll('.recharts-line')).toHaveLength(0)
  })

  it('outside the US: Predict\'s other notice and label', () => {
    const plan = planOf('reference', { status: 'outside-us', station: { id: '9410120', name: 'Imperial Beach' }, distanceMi: 165 })
    show(plan)
    expect(screen.getByText(tideTooFarNotice('Imperial Beach', 165, 'outside-us'))).toBeTruthy()
    expect(screen.getByRole('button', { name: PLAN_COPY.overrideAria }).textContent).toBe(tideOverrideLabel('outside-us'))
  })

  it('the override busy state: disabled, aria-busy, the spinner (QA-31)', () => {
    const plan = planOf('reference', { status: 'too-far', station: { id: '1', name: 'X' }, distanceMi: 58 })
    show(plan, { overriding: true })
    const btn = screen.getByRole('button', { name: PLAN_COPY.overrideAria })
    expect(btn.hasAttribute('disabled')).toBe(true)
    expect(btn.getAttribute('aria-busy')).toBe('true')
    expect(btn.querySelector('.spin')).toBeTruthy()
  })

  it('station unavailable: the words once, above the chart, items without tide (QA-33)', () => {
    const plan = planOf('reference', { status: 'unavailable' })
    show(plan)
    expect(screen.getAllByText(PLAN_COPY.tideUnavailable)).toHaveLength(1)
    expect(document.querySelectorAll('.sr-plan-ev-tide')).toHaveLength(0)
  })

  it('the tide half failing at the transport shows the offline or no-key words in the tide slot, and the plan stays', () => {
    const plan = planOf('reference', null)
    show(plan, { tideErrKind: 'no-key' })
    expect(screen.getByText('API key not configured. Add it in Settings.')).toBeTruthy()
    expect(document.querySelectorAll('li.sr-plan-ev').length).toBe(plan.events.length)
  })
})

describe('the chart (QA-21 to QA-25, QA-27, QA-53, QA-54)', () => {
  it('is one tab stop with a slider role and a name pointing to the list; its interior is hidden and inert', () => {
    const plan = planOf('reference')
    show(plan, {}, true)
    const img = screen.getByRole('slider')
    expect(img.getAttribute('tabindex')).toBe('0')
    expect(img.getAttribute('aria-orientation')).toBe('horizontal')
    expect(img.getAttribute('aria-label')).toBe(PLAN_COPY.chartNameWithTide('Del Monte Beach, Monterey', 'Sat, Sep 12, 2026, 3:41 PM', 'Sat, Sep 19, 2026, 11:59 PM'))
    const canvas = img.querySelector('.sr-plan-canvas')!
    expect(canvas.getAttribute('aria-hidden')).toBe('true')
    expect(canvas.hasAttribute('inert')).toBe(true)
    // recharts rendered, inside the inert canvas, with no focusable root.
    const svg = canvas.querySelector('svg.recharts-surface')!
    expect(svg).toBeTruthy()
    expect(svg.getAttribute('tabindex')).toBeNull()
    // recharts marks an inner layer tabindex -1 (never a tab stop); nothing
    // inside the inert canvas is a positive stop.
    expect(img.querySelectorAll('[tabindex="0"]')).toHaveLength(0)
    expect(img.querySelectorAll('button, a[href], input')).toHaveLength(0)
  })

  it('draws the curve, one band per night span, every marker, the strip with its two tags, and no snap points', () => {
    const plan = planOf('reference')
    show(plan, {}, true)
    const img = screen.getByRole('slider')
    expect(img.querySelectorAll('.recharts-line')).toHaveLength(1)
    // The day ground plus one area per night span.
    expect(img.querySelectorAll('.recharts-reference-area')).toHaveLength(1 + plan.nightSpans.length)
    const tide = plan.tide as Extract<Plan['tide'], { status: 'ok' }>
    expect(img.querySelectorAll('polygon')).toHaveLength(plan.events.length)
    expect(img.querySelectorAll('circle')).toHaveLength(tide.turningPoints.length)
    const labels = [...img.querySelectorAll('text.sr-plan-cx-lbl')].map(t => t.textContent)
    expect(labels).toContain('Now')
    expect(labels.filter(l => /^Sunrise \d/.test(l!)).length).toBe(plan.events.filter(e => e.kind === 'sunrise').length)
    expect(labels.filter(l => /^Sunset \d/.test(l!)).length).toBe(plan.events.filter(e => e.kind === 'sunset').length)
    expect(labels.filter(l => /^[HL] −?\d+\.\d$/.test(l!)).length).toBe(tide.turningPoints.length)
    expect(img.querySelectorAll('.sr-plan-cell')).toHaveLength(plan.cells.length)
    expect(img.querySelectorAll('.sr-plan-cell.daily').length).toBe(plan.cells.filter(c => c.resolution === 'daily').length)
    const tags = [...img.querySelectorAll('.sr-plan-tag')].map(t => t.textContent)
    expect(tags).toEqual([PLAN_COPY.stripHourlyTag, PLAN_COPY.stripDailyTag])
    // No snap markers anywhere (D4-12).
    expect(img.querySelectorAll('.sr-plan-snap')).toHaveLength(0)
    expect(img.querySelectorAll('.sr-plan-daylabel')).toHaveLength(plan.days.length)
    // The track is 16 px per hour of real elapsed time plus the gutter.
    const canvas = img.querySelector('.sr-plan-canvas') as HTMLElement
    const hours = (plan.window.endTs + 1 - plan.window.axisStartTs) / 3600
    expect(canvas.style.width).toBe(`${40 + Math.ceil(hours * 16)}px`)
    // The sticky tide scale sits outside the scroller, in the box.
    expect(document.querySelector('.sr-plan-chartbox > .sr-plan-yaxis')).toBeTruthy()
    expect(document.querySelector('.sr-plan-yaxis')!.textContent).toContain('MLLW')
    expect(MOON.test(img.textContent!)).toBe(false)
  })

  it('a DST day is drawn at its true length: 25 hours at 16 px each (QA-21)', () => {
    const plan = planOf('dst-fall')
    show(plan, {}, true)
    const long = plan.days.find(d => d.endTs - d.startTs + 1 === 90000)!
    const next = plan.days[plan.days.indexOf(long) + 1]
    const img = screen.getByRole('slider')
    const axisDays = [...img.querySelectorAll('.sr-plan-axisday')] as HTMLElement[]
    const left = (d: { startTs: number }) => parseFloat(axisDays[plan.days.findIndex(x => x.startTs === d.startTs)].style.left)
    expect(left(next) - left(long)).toBe(25 * 16)
  })
})

// ── QA-26 / FR-27: every figure the chart draws is in the list, turning points
// included. Each event's brackets name only the two turning points around it,
// so a night holding three turning points between a sunset and the next sunrise
// (a real winter night) would otherwise leave one reaching no list item. The
// per-day tides line closes it: over EVERY fixture family that carries tide,
// the multiset of turning points in the list equals the multiset the chart
// draws, formatted by the same functions, and one family ties "drawn" to the
// rendered chart's own markers.
describe('every drawn turning point is in the list, and no listed one is undrawn (QA-26)', () => {
  const withTide = families.filter(f => f.expectedWeather.ok && f.expectedTide.status === 'ok').map(f => f.name)

  it('covers the families that carry tide, the repeated-hour one included', () => {
    expect(withTide).toEqual(expect.arrayContaining(['reference', 'subordinate', 'dst-fall', 'dst-spring', 'far-station', 'gap', 'no-hourly', 'five-daily', 'polar', 'now-in-hour', 'same-minute-high', 'maximal']))
  })

  it.each(withTide)('%s: the list\'s tides lines carry exactly the drawn set', (name) => {
    const plan = planOf(name)
    show(plan)
    const tide = plan.tide as Extract<Plan['tide'], { status: 'ok' }>
    const drawn = tide.turningPoints.map(p => PLAN_COPY.bracketSide(p.kind, ftSigned(p.v), clockOf(p.local))).sort()
    const listed = [...document.querySelectorAll('.sr-plan-tides .sr-plan-tide-pt')].map(el => el.textContent!).sort()
    expect(drawn.length).toBeGreaterThan(10)
    expect(listed).toEqual(drawn)
    // Every event's brackets are still there too: the tides line adds, it does
    // not replace.
    expect(document.querySelectorAll('.sr-plan-ev-tide').length).toBe(plan.events.length)
    // And each tides line sits under the heading of the day its points fall on.
    for (const li of document.querySelectorAll('li.sr-plan-day')) {
      const i = [...document.querySelectorAll('li.sr-plan-day')].indexOf(li)
      const day = plan.days[i]
      const own = tide.turningPoints.filter(p => p.t >= day.startTs && p.t <= day.endTs)
      const line = li.querySelector('.sr-plan-tides')
      if (own.length === 0) expect(line).toBeNull()
      else expect(line!.querySelectorAll('.sr-plan-tide-pt')).toHaveLength(own.length)
    }
  })

  it('the repeated-hour high in dst-fall is listed, at its local clock', () => {
    show(planOf('dst-fall'))
    const listed = [...document.querySelectorAll('.sr-plan-tides .sr-plan-tide-pt')].map(el => el.textContent!)
    expect(listed).toContain('high 4.8 ft (1:10 AM)')
  })

  it('"drawn" is the chart\'s own markers: circles on the rendered chart equal the listed points', () => {
    const plan = planOf('reference')
    show(plan, {}, true)
    const circles = screen.getByRole('slider').querySelectorAll('circle').length
    expect(document.querySelectorAll('.sr-plan-tides .sr-plan-tide-pt')).toHaveLength(circles)
    expect(circles).toBeGreaterThan(10)
  })

  it('with no tide there is no tides line at all', () => {
    show(planOf('reference', { status: 'unavailable' }))
    expect(document.querySelectorAll('.sr-plan-tides')).toHaveLength(0)
  })
})

// ── QA-28 / FR-29: only the glyph and its clock stay together in a sky reading;
// the description is ordinary wrappable text. The browser measurement is the
// evidence (recorded in decisions.md D5-16); this pins the DOM shape it rests on.
describe('a sky reading can wrap: only the glyph and its clock are unbreakable', () => {
  it('each nowrap span holds a glyph and a clock, never a description', () => {
    show(planOf('reference'))
    const spans = [...document.querySelectorAll('details.sr-plan-hours .sr-plan-nowrap')]
    expect(spans.length).toBeGreaterThan(20)
    for (const s of spans) {
      const text = s.textContent!.trim()
      expect(text, text).toMatch(/^\S+ (from )?\d+(:\d\d)? [AP]M$/)
      expect(text.length).toBeLessThan(24)
    }
    // The descriptions are present as sibling text outside any nowrap span,
    // and the boundary day's partial cell (the third day here) keeps its
    // "(daily)" tail as wrappable text too.
    const bodies = [...document.querySelectorAll('details.sr-plan-hours > p')].map(p => p.textContent!).join(' ')
    expect(bodies).toContain('Scattered clouds')
    expect(bodies).toMatch(/from \d+:\d\d [AP]M [A-Z][a-z ]+ \(daily\)/)
  })
})

// ── The Auditor's Low, closed by rendering rather than by reading: each
// corrupted replayed shape below goes through the real composePlan into the
// real PlanResult AND PlanChart under jsdom, and must render the honest state
// (the plan minus the bad entry, or the plan without tide) rather than throw
// into RootErrorBoundary. The shapes are the ones measured throwing before the
// guards existed, plus the ones that never threw, so the table cannot pass on
// a build that dropped every row.
describe('a corrupted replayed half never throws in the real components', () => {
  type Mut = (w: Record<string, unknown>, t: Record<string, unknown>) => void
  const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v))
  const ev = (w: Record<string, unknown>, i = 0) => (w.events as Array<Record<string, unknown>>)[i]
  const cell = (w: Record<string, unknown>, i = 0) => (w.cells as Array<Record<string, unknown>>)[i]
  const wx = (o: Record<string, unknown>) => o.weather as Record<string, unknown>
  const SHAPES: Array<[string, Mut, (plan: Plan, ref: Plan) => void]> = [
    ['event local is a number', w => { ev(w).local = 7 }, (p, r) => expect(p.events).toHaveLength(r.events.length - 1)],
    ['event local is null', w => { ev(w).local = null }, (p, r) => expect(p.events).toHaveLength(r.events.length - 1)],
    ['event local is an object', w => { ev(w).local = { a: 1 } }, (p, r) => expect(p.events).toHaveLength(r.events.length - 1)],
    ['event date is a number', w => { ev(w).date = 20260912 }, (p, r) => expect(p.events).toHaveLength(r.events.length - 1)],
    ['event weather.emoji is an object', w => { wx(ev(w)).emoji = { x: 1 } }, (p, r) => expect(p.events).toHaveLength(r.events.length - 1)],
    ['event weather.description is an object', w => { wx(ev(w)).description = { x: 1 } }, (p, r) => expect(p.events).toHaveLength(r.events.length - 1)],
    ['event weather.description is null', w => { wx(ev(w)).description = null }, (p, r) => expect(p.events).toHaveLength(r.events.length - 1)],
    ['event weather.tempF is a string', w => { wx(ev(w)).tempF = 'warm' }, (p, r) => expect(p.events).toHaveLength(r.events.length - 1)],
    ['event weather is a string', w => { ev(w).weather = 'sunny' }, (p, r) => expect(p.events).toHaveLength(r.events.length - 1)],
    ['cell local is null', w => { cell(w, 2).local = null }, (p, r) => expect(p.cells).toHaveLength(r.cells.length - 1)],
    ['cell weather.emoji is an object', w => { wx(cell(w, 2)).emoji = { x: 1 } }, (p, r) => expect(p.cells).toHaveLength(r.cells.length - 1)],
    ['cell weather.description is an array', w => { wx(cell(w, 2)).description = ['x'] }, (p, r) => expect(p.cells).toHaveLength(r.cells.length - 1)],
    ['day sunrise is a malformed object', w => { (w.days as Array<Record<string, unknown>>)[1].sunrise = { t: 'x', local: 3 } }, p => expect(p.days[1].sunrise).toBeNull()],
    ['day date is a number', w => { (w.days as Array<Record<string, unknown>>)[1].date = 9 }, (p, r) => { expect(p.days).toHaveLength(r.days.length - 1); expect(p.events).toHaveLength(r.events.length - 2) }],
    ['window startLocal is a number', w => { (w.window as Record<string, unknown>).startLocal = 5 }, p => expect(p.window.startLocal).toBe('')],
    ['night span is malformed', w => { (w.nightSpans as unknown[])[0] = { startTs: 'a' } }, (p, r) => expect(p.nightSpans).toHaveLength(r.nightSpans.length - 1)],
    ['turning point local is a number', (_w, t) => { (t.turningPoints as Array<Record<string, unknown>>)[0].local = 5 }, p => expect((p.tide as { status: 'ok' }).status).toBe('ok')],
    ['curve sample v is a string', (_w, t) => { (t.curve as Array<Record<string, unknown>>)[0].v = '2.1' }, p => expect((p.tide as { status: 'ok' }).status).toBe('ok')],
    ['tide station id is a number', (_w, t) => { (t.station as Record<string, unknown>).id = 9413450 }, p => expect(p.tide).toBeNull()],
    ['tide curve is a string', (_w, t) => { t.curve = 'nope' }, p => expect((p.tide as { status: 'ok'; curve: unknown[] }).curve).toEqual([])],
  ]

  it.each(SHAPES)('%s', (_name, mut, honest) => {
    const f = half('reference')
    const w = clone((f.expectedWeather as { ok: true; plan: WeatherPlan }).plan) as unknown as Record<string, unknown>
    const t = clone(f.expectedTide) as unknown as Record<string, unknown>
    mut(w, t)
    const ref = planOf('reference')
    let plan: Plan | null = null
    expect(() => { plan = composePlan(w, t) }).not.toThrow()
    expect(plan).not.toBeNull()
    honest(plan!, ref)
    expect(() => show(plan!, {}, true)).not.toThrow()
    // The honest state is on screen: the region, the list and the chart.
    expect(screen.getByRole('region', { name: PLAN_COPY.regionName })).toBeTruthy()
    expect(screen.getByRole('list', { name: PLAN_COPY.listName })).toBeTruthy()
    expect(screen.getByRole('slider')).toBeTruthy()
    expect(document.querySelectorAll('li.sr-plan-ev')).toHaveLength(plan!.events.length)
    // And the 1.0.30 layers degrade per part rather than blanking (NFR-07).
    expect(document.querySelectorAll('.sr-plan-dayfacts')).toHaveLength(plan!.days.length)
    expect(document.querySelector('.sr-plan-readout')).toBeTruthy()
  })
})

// ── The revised design (D4-12 to D4-17): the day buttons on both tiers, the
// Days in view control on the wide tier only, its group semantics and its
// omitted options, and the wide chart's lanes.
describe('the day buttons and the Days in view control', () => {
  it('phone tier: no Days in view control, the two day buttons present through the Button primitive', () => {
    tier(true)
    show(planOf('reference'))
    expect(screen.queryByRole('group', { name: PLAN_COPY.daysInView })).toBeNull()
    for (const name of [PLAN_COPY.earlierDay, PLAN_COPY.laterDay]) {
      const b = screen.getByRole('button', { name })
      expect(b.tagName).toBe('BUTTON')
      expect(b.getAttribute('tabindex')).toBe('0')
      expect(b.getAttribute('type')).toBe('button')
    }
  })

  it('wide tier: the control is a named group of aria-pressed Buttons, All pressed by default, options above the plan\'s day count omitted', () => {
    tier(false)
    const onChange = vi.fn()
    show(planOf('five-daily'), { onDaysInViewChange: onChange })
    const group = screen.getByRole('group', { name: PLAN_COPY.daysInView })
    const buttons = within(group).getAllByRole('button')
    expect(buttons.map(b => b.textContent)).toEqual(['1 day', '3 days', 'All 5 days'])
    expect(buttons.map(b => b.getAttribute('aria-pressed'))).toEqual(['false', 'false', 'true'])
    for (const b of buttons) expect(b.getAttribute('tabindex')).toBe('0')
    fireEvent.click(buttons[1])
    expect(onChange).toHaveBeenCalledWith('3')
    // The visible label is decorative beside the group's own name.
    expect(screen.getByText(PLAN_COPY.daysInView, { selector: '.sr-plan-toolbar-label' }).getAttribute('aria-hidden')).toBe('true')
  })

  it('wide tier: an eight-day plan offers all four options and reflects the pressed value', () => {
    tier(false)
    show(planOf('reference'), { daysInView: '7' })
    const group = screen.getByRole('group', { name: PLAN_COPY.daysInView })
    expect(within(group).getAllByRole('button').map(b => `${b.textContent}:${b.getAttribute('aria-pressed')}`))
      .toEqual(['1 day:false', '3 days:false', '7 days:true', 'All 8 days:false'])
  })

  it('the day buttons are disabled and the hint reserved (visibility, never display) while the track fits (jsdom lays nothing out, so it always fits here)', () => {
    tier(true)
    show(planOf('reference'), {}, true)
    expect((screen.getByRole('button', { name: PLAN_COPY.earlierDay }) as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByRole('button', { name: PLAN_COPY.laterDay }) as HTMLButtonElement).disabled).toBe(true)
    const hint = screen.getByText(PLAN_COPY.scrollHint).closest('.sr-plan-legend-scroll')!
    expect(hint.classList.contains('is-off')).toBe(true)
    expect(hint.hasAttribute('hidden')).toBe(false)
  })

  it('QA-32: the legend has the same elements, in the same order, none display-hidden, before the chart chunk lands and after the chart reports that the track does not fit', () => {
    tier(true)
    const plan = planOf('reference')
    // Before the chunk lands: the Suspense slot holds the fallback, the chart
    // has reported nothing, and the legend already carries every element,
    // the Sun height entry and the scroll hint included.
    const { rerender } = show(plan)
    const shape = () => [...document.querySelectorAll('.sr-plan-legend > *, .sr-plan-nav > *')].map(el => `${el.tagName}.${el.className.replace(/ is-off/, '')}${el.hasAttribute('hidden') ? '[hidden]' : ''}`)
    const before = shape()
    expect(before.some(s => s.includes('sr-plan-legend-sun'))).toBe(true)
    expect(before.some(s => s.includes('sr-plan-legend-scroll'))).toBe(true)
    expect(before.some(s => s.includes('[hidden]'))).toBe(false)
    expect(document.querySelector('.sr-plan-legend-scroll')!.classList.contains('is-off')).toBe(true)
    // The chunk lands: the real chart mounts, and then reports that the track
    // does not fit (jsdom's zero metrics say it fits, so the box is given the
    // phone tier's real numbers and a scroll is dispatched, which is how the
    // chart reports on every scroll).
    rerender(<PlanResult plan={plan} place="Del Monte Beach, Monterey" replayedAt={null} tideErrKind={null} overriding={false} onOverride={noop} ChartComponent={PlanChart} daysInView="all" onDaysInViewChange={noop} />)
    const el = screen.getByRole('slider')
    Object.defineProperty(el, 'scrollWidth', { configurable: true, get: () => 2872 })
    Object.defineProperty(el, 'clientWidth', { configurable: true, get: () => 350 })
    fireEvent.scroll(el)
    const hint = document.querySelector('.sr-plan-legend-scroll')!
    expect(hint.classList.contains('is-off')).toBe(false)
    expect(hint.hasAttribute('hidden')).toBe(false)
    expect(shape()).toEqual(before)
    // And the hint is never display-hidden by the stylesheet, only visibility-hidden.
    expect((screen.getByRole('button', { name: PLAN_COPY.laterDay }) as HTMLButtonElement).disabled).toBe(false)
  })

  it('wide tier: the chart takes the day-header lane, the taller plot and the shorter axis lane', () => {
    tier(false)
    show(planOf('reference'), {}, true)
    const box = document.querySelector('.sr-plan-chartbox') as HTMLElement
    expect(box.classList.contains('sr-plan-chartbox-wide')).toBe(true)
    expect(box.style.height).toBe('340px')
    expect(document.querySelector('.sr-plan-dayhdr')).toBeTruthy()
    expect(document.querySelectorAll('.sr-plan-dayhdr-lbl').length).toBeGreaterThan(0)
    expect(document.querySelectorAll('.sr-plan-daylabel')).toHaveLength(0)
    expect((document.querySelector('.sr-plan-axislane') as HTMLElement).style.height).toBe('22px')
    expect((document.querySelector('.sr-plan-yaxis') as HTMLElement).style.top).toBe('22px')
  })
})

// ── plan-sun-moon-readout: the readout block, the pick's ownership, the divider
//    and the day-facts line (FR-07, FR-13, FR-14, FR-17, FR-18, FR-23, FR-34,
//    FR-35, D4-08, D4-09; QA-07, QA-11, QA-13, QA-14, QA-17, QA-18, QA-34,
//    QA-35, QA-49). jsdom lays nothing out, so the height claim of QA-17 is
//    the stacked-layer STRUCTURE here (three siblings in one grid cell, the
//    sizer carrying the longest strings) and the browser sweep in
//    website/tools/verify/verify-plan-readout.mjs; the list-untouched claim is
//    DOM byte-equality, which jsdom can settle.
class PointerEventShim extends MouseEvent {
  pointerType: string; pointerId: number
  constructor(type: string, init: MouseEventInit & { pointerType?: string; pointerId?: number } = {}) {
    super(type, init); this.pointerType = init.pointerType ?? 'mouse'; this.pointerId = init.pointerId ?? 1
  }
}
const pickAt = (el: HTMLElement, clientX: number) => {
  fireEvent.pointerDown(el, { pointerType: 'mouse', button: 0, clientX, clientY: 10, pointerId: 5 })
  fireEvent.pointerUp(el, { pointerType: 'mouse', clientX, clientY: 10, pointerId: 5 })
}
const readout = () => document.querySelector('.sr-plan-readout') as HTMLElement
const layers = () => [...readout().querySelectorAll(':scope > .sr-plan-ro-layers > .sr-plan-ro-layer')] as HTMLElement[]

describe('the picked-moment readout', () => {
  beforeEach(() => {
    tier(true)
    vi.stubGlobal('PointerEvent', PointerEventShim)
    if (!HTMLElement.prototype.setPointerCapture) HTMLElement.prototype.setPointerCapture = () => {}
    if (!HTMLElement.prototype.releasePointerCapture) HTMLElement.prototype.releasePointerCapture = () => {}
  })

  it('renders at rest with the list before the chart chunk resolves: three stacked layers in one cell, the rest text on, the sizer hidden, the estimate line standing, all hidden from assistive technology', () => {
    show(planOf('reference'))                                  // NoChart: the chunk never lands
    const ro = readout()
    expect(ro.getAttribute('aria-hidden')).toBe('true')
    const ls = layers()
    expect(ls).toHaveLength(3)
    expect(ls[0].classList.contains('sr-plan-ro-sizer')).toBe(true)
    expect(ls[1].classList.contains('sr-plan-ro-rest')).toBe(true)
    expect(ls[1].classList.contains('is-on')).toBe(true)
    expect(ls[2].classList.contains('sr-plan-ro-pick')).toBe(true)
    expect(ls[2].classList.contains('is-off')).toBe(true)
    expect(ls[1].textContent).toContain(PLAN_COPY.restLine)
    expect(ls[1].textContent).toContain(PLAN_COPY.keysLine)
    expect(ro.querySelector('.sr-plan-ro-est')!.textContent).toBe(PLAN_COPY.estimateLine)
    // The readout precedes the divider and the list, and follows the legend.
    const legend = document.querySelector('.sr-plan-legend')!
    const week = document.querySelector('.sr-plan-week')!
    expect(legend.compareDocumentPosition(ro) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(ro.compareDocumentPosition(week) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    // No live region anywhere in the region (FR-23).
    const region = screen.getByRole('region', { name: PLAN_COPY.regionName })
    expect(region.querySelectorAll('[aria-live], [role="status"], [role="alert"]')).toHaveLength(0)
  })

  it('the sizer carries the longest strings THIS document can produce (schema 6.2, D13)', () => {
    const plan = planOf('reference')
    show(plan)
    const sizer = layers()[0].textContent!
    const longestDay = plan.days.map(d => d.date).reduce((a, d) => (d.length >= a.length ? d : a), '')
    expect(longestDay).toBeTruthy()
    expect(sizer).toContain('12:00 PM')
    expect(sizer).toContain('Tide −0.0 ft')
    expect(sizer).toContain('100°F')
    expect(sizer).toContain('(H 100° · L 100°)')                 // the reference family holds daily cells
    expect(sizer).toContain(PLAN_COPY.sunBelow(90))
    expect(sizer).toContain('Humidity 100%')
    expect(sizer).toContain(PLAN_COPY.hourlyLabel)
    // The reference family's untrimmed points reach past the window, so it is
    // never sized for the trend-unknown phrase.
    expect(sizer).not.toContain(PLAN_COPY.tideTrendUnknown)
    expect(sizer).toContain(`, ${PLAN_COPY.tideFalling}`)
  })

  it('a pointer pick fills the picked layer with the four figures, focuses the slider, sets its value and value text, draws the marker, and changes nothing in the list (QA-07, QA-14, QA-18, QA-24)', () => {
    const plan = planOf('reference')
    show(plan, {}, true)
    const list = screen.getByRole('list', { name: PLAN_COPY.listName })
    const before = list.innerHTML
    const slider = screen.getByRole('slider')
    expect(slider.getAttribute('aria-valuenow')).toBe(String(plan.fetchedAt))
    expect(slider.getAttribute('aria-valuetext')).toBe(PLAN_COPY.restLine)
    expect(document.querySelector('.sr-plan-pickmark')).toBeNull()
    pickAt(slider, 200)                                           // 160 px past the gutter: ten hours after the axis start
    const t = plan.window.axisStartTs + 160 * 225
    expect(document.activeElement).toBe(slider)
    expect(slider.classList.contains('has-pick')).toBe(true)
    expect(slider.getAttribute('aria-valuenow')).toBe(String(t))
    const local = localClock(t, plan.tz)
    expect(slider.getAttribute('aria-valuetext')).toMatch(/^Sun, Sep 13, 2026, 1:00 AM\. Tide −?\d+\.\d ft, (rising|falling)\. .+°F, wind .+, forecast hourly\. Sun \d+° below the horizon\.$/)
    expect(local).toBe('2026-09-13 01:00')
    const ls = layers()
    expect(ls[1].classList.contains('is-off')).toBe(true)
    expect(ls[2].classList.contains('is-on')).toBe(true)
    const picked = ls[2].textContent!
    expect(picked).toContain('Sun, Sep 13, 2026')
    expect(picked).toContain('1:00 AM')
    expect(picked).toMatch(/Tide −?\d+\.\d ft, (rising|falling)/)
    expect(picked).toMatch(/below the horizon/)
    expect(picked).toContain('Wind ')
    expect(picked).toContain(PLAN_COPY.hourlyLabel)
    expect(readout().querySelector('.sr-plan-ro-est')!.textContent).toBe(PLAN_COPY.estimateLine)
    const mark = document.querySelector('.sr-plan-pickmark') as HTMLElement
    expect(mark).toBeTruthy()
    expect(mark.style.left).toBe('200px')
    expect(mark.style.top).toBe('28px')
    expect(mark.style.height).toBe('128px')
    // The list is byte-identical (FR-18): no row highlighted, no text changed.
    expect(list.innerHTML).toBe(before)
    expect(document.querySelector('.sr-plan-week')!.textContent).toBe(PLAN_COPY.listName)
  })

  it('Escape clears: the rest layer returns, the marker goes, the value returns to Now; the picked layer keeps its last figures to fade (D4-03)', () => {
    const plan = planOf('reference')
    show(plan, {}, true)
    const slider = screen.getByRole('slider')
    pickAt(slider, 200)
    fireEvent.keyDown(slider, { key: 'Escape' })
    expect(document.querySelector('.sr-plan-pickmark')).toBeNull()
    expect(slider.classList.contains('has-pick')).toBe(false)
    expect(slider.getAttribute('aria-valuenow')).toBe(String(plan.fetchedAt))
    expect(slider.getAttribute('aria-valuetext')).toBe(PLAN_COPY.restLine)
    const ls = layers()
    expect(ls[1].classList.contains('is-on')).toBe(true)
    expect(ls[2].classList.contains('is-off')).toBe(true)
    expect(ls[2].textContent).toContain('1:00 AM')
  })

  it('a no-tide plan: the pick shows the no-tide phrase with the time, weather and sun; the slider name says no tide (QA-11)', () => {
    const plan = planOf('reference', { status: 'too-far', station: { id: '1', name: 'X' }, distanceMi: 58 })
    show(plan, {}, true)
    const slider = screen.getByRole('slider')
    expect(slider.getAttribute('aria-label')).toContain('no tide is shown')
    pickAt(slider, 200)
    const picked = layers()[2].textContent!
    expect(picked).toContain(PLAN_COPY.noTide)
    expect(picked).not.toMatch(/Tide −?\d/)
    expect(picked).toContain('1:00 AM')
    expect(picked).toContain('°F')
    expect(picked).toMatch(/below the horizon/)
    expect(slider.getAttribute('aria-valuetext')).toContain(PLAN_COPY.noTide)
    // The marker's box follows the without-tide plot: 72 px on the phone tier.
    expect((document.querySelector('.sr-plan-pickmark') as HTMLElement).style.height).toBe('72px')
  })

  it('the pick survives the override (the same fetch instant, place and zone) and resets with a new plan (FR-14, schema 6.4)', () => {
    const far = planOf('reference', { status: 'too-far', station: { id: '1', name: 'X' }, distanceMi: 58 })
    const { rerender } = show(far, {}, true)
    const slider = screen.getByRole('slider')
    pickAt(slider, 200)
    expect(layers()[2].textContent).toContain(PLAN_COPY.noTide)
    // The override fills the tide into the SAME plan: identity unchanged.
    const filled = planOf('reference')
    rerender(<PlanResult plan={filled} place="Del Monte Beach, Monterey" replayedAt={null} tideErrKind={null} overriding={false} onOverride={noop} ChartComponent={PlanChart} daysInView="all" onDaysInViewChange={noop} />)
    expect(screen.getByRole('slider').classList.contains('has-pick')).toBe(true)
    expect(layers()[2].classList.contains('is-on')).toBe(true)
    expect(layers()[2].textContent).toMatch(/Tide −?\d+\.\d ft/)
    expect(layers()[2].textContent).not.toContain(PLAN_COPY.noTide)
    // A fresh plan (a different fetch instant) clears it.
    const fresh = planOf('now-in-hour')
    rerender(<PlanResult plan={fresh} place="Del Monte Beach, Monterey" replayedAt={null} tideErrKind={null} overriding={false} onOverride={noop} ChartComponent={PlanChart} daysInView="all" onDaysInViewChange={noop} />)
    expect(screen.getByRole('slider').classList.contains('has-pick')).toBe(false)
    expect(document.querySelector('.sr-plan-pickmark')).toBeNull()
    expect(layers()[1].classList.contains('is-on')).toBe(true)
  })

  it('a Days in view change and a tier change keep the pick (it is state of the region, not of the chart)', () => {
    tier(false)
    const plan = planOf('reference')
    const { rerender } = show(plan, { daysInView: '3' }, true)
    pickAt(screen.getByRole('slider'), 200)
    expect(screen.getByRole('slider').classList.contains('has-pick')).toBe(true)
    rerender(<PlanResult plan={plan} place="Del Monte Beach, Monterey" replayedAt={null} tideErrKind={null} overriding={false} onOverride={noop} ChartComponent={PlanChart} daysInView="1" onDaysInViewChange={noop} />)
    expect(screen.getByRole('slider').classList.contains('has-pick')).toBe(true)
    expect(document.querySelector('.sr-plan-pickmark')).toBeTruthy()
  })
})

describe('the divider and the day-facts line', () => {
  beforeEach(() => tier(true))

  it('the list is named by the divider through aria-labelledby; the divider is a static div with a useId-based id, not a heading and not a live region (D4-09)', () => {
    show(planOf('reference'))
    const list = screen.getByRole('list', { name: PLAN_COPY.listName })
    const id = list.getAttribute('aria-labelledby')!
    expect(id).toBeTruthy()
    const label = document.getElementById(id)!
    expect(label.textContent).toBe(PLAN_COPY.listName)
    expect(label.closest('.sr-plan-week')!.tagName).toBe('DIV')
    expect(label.closest('.sr-plan-week')!.querySelector('svg')!.getAttribute('aria-hidden')).toBe('true')
    expect(list.hasAttribute('aria-label')).toBe(false)
    expect(document.querySelectorAll('h1, h2, h3, h4, h5, h6')).toHaveLength(1 + 8)   // the place, and one h4 per day
    // Keyed on nothing from the document.
    expect(id).not.toContain('2026')
    expect(id).not.toContain(' ')
  })

  it('every day carries one moon glyph from the eight and one of the eight names; the glyph is presentational and the name is text (QA-35)', () => {
    const plan = planOf('reference')
    show(plan)
    const facts = [...document.querySelectorAll('.sr-plan-dayfacts')]
    expect(facts).toHaveLength(plan.days.length)
    for (const f of facts) {
      const glyph = f.querySelector('.sr-plan-em')!
      expect(glyph.getAttribute('aria-hidden')).toBe('true')
      expect(MOON.test(glyph.textContent!)).toBe(true)
      const name = f.querySelector('b')!.textContent!
      expect(MOON_PHASE_NAMES).toContain(name)
    }
    // Identical treatment per day: the same shape on every line (FR-44).
    const shapes = new Set(facts.map(f => [...f.children].map(c => c.tagName).join(',')))
    expect(shapes.size).toBe(1)
  })

  it('every day carries the sun-peak clause from the anchored curve; the first day says from when and, with noon behind Now, "past its highest" (FR-34, D4-08)', () => {
    const plan = planOf('reference')
    show(plan)
    const model = buildSunModel(plan)!
    const peaks = sunPeakByDay(model)
    const facts = [...document.querySelectorAll('.sr-plan-dayfacts')].map(f => f.textContent!)
    // Day 0: fetched at 3:41 PM, solar noon at 1:03 PM is behind Now.
    expect(facts[0]).toMatch(/Sun past its highest today, \d+° above the horizon at 3:41 PM$/)
    expect(document.querySelectorAll('h4')[0].textContent).toBe(`Sat, Sep 12, 2026 ${PLAN_COPY.fromSuffix('3:41 PM')}`)
    expect(document.querySelectorAll('h4')[1].textContent).toBe('Sun, Sep 13, 2026')
    for (let i = 1; i < plan.days.length; i += 1) {
      const p = peaks[i]!
      const time = clockOf(localClock(p.t, plan.tz))
      expect(facts[i]).toContain(PLAN_COPY.sunPeak(time, Math.round(p.deg)))
      expect(Math.round(p.deg)).toBeGreaterThan(50)
    }
    // Order within a day: heading, day facts, then the tides line.
    const day1 = document.querySelectorAll('li.sr-plan-day')[1]
    const kids = [...day1.children].map(c => c.className || c.tagName)
    expect(kids.slice(0, 3)).toEqual(['H4', 'sr-plan-dayfacts', 'sr-plan-tides'])
  })

  it('a plan fetched before noon names the peak ahead rather than the past clause', () => {
    const plan = planOf('now-in-hour')                        // fetched 6:30 AM
    show(plan)
    const facts = [...document.querySelectorAll('.sr-plan-dayfacts')].map(f => f.textContent!)
    expect(facts[0]).toMatch(/Sun highest at 1:0\d PM, \d+° above the horizon$/)
    expect(facts[0]).not.toContain('past its highest')
    expect(document.querySelectorAll('h4')[0].textContent).toContain(PLAN_COPY.fromSuffix('6:30 AM'))
  })

  it('the legend carries the Sun height entry after Low, and after Sunset without tide (FR-30)', () => {
    show(planOf('reference'))
    let keys = [...document.querySelectorAll('.sr-plan-legend-k')].map(k => k.textContent!.trim())
    expect(keys).toEqual(['Day', 'Night', 'Sunrise', 'Sunset', 'High', 'Low', PLAN_COPY.legendSun])
    const swatch = document.querySelector('.sr-plan-legend-sun svg')!
    expect(swatch.getAttribute('aria-hidden')).toBe('true')
    expect(swatch.innerHTML).toContain('var(--sr-plan-sunline)')
    expect(swatch.innerHTML).toContain('var(--sr-plan-sunline-night)')
    cleanup()
    show(planOf('reference', { status: 'unavailable' }))
    keys = [...document.querySelectorAll('.sr-plan-legend-k')].map(k => k.textContent!.trim())
    expect(keys).toEqual(['Day', 'Night', 'Sunrise', 'Sunset', PLAN_COPY.legendSun])
  })

  it('a plan whose coordinates are out of range draws no track, prints no sun clause and no sun figure, and keeps the moon (NFR-07, schema D14)', () => {
    const plan = { ...planOf('reference'), lat: 95 }
    show(plan, {}, true)
    expect(document.querySelector('.sr-plan-suntrack')).toBeNull()
    const facts = [...document.querySelectorAll('.sr-plan-dayfacts')]
    expect(facts).toHaveLength(plan.days.length)
    for (const f of facts) {
      expect(f.textContent).not.toContain('Sun ')
      expect(f.querySelector('b')).toBeTruthy()
    }
    pickAt(screen.getByRole('slider'), 200)
    expect(layers()[2].textContent).not.toContain('horizon')
    expect(screen.getByRole('slider').getAttribute('aria-valuetext')).not.toContain('horizon')
  })

  it('the polar family: sunrise-only days carry the moon and a peak, the No sunrise and No sunset notes are unchanged, and the plan renders', () => {
    const plan = planOf('polar')
    show(plan, {}, true)
    expect(document.querySelectorAll('.sr-plan-dayfacts')).toHaveLength(8)
    expect(screen.getAllByText(PLAN_COPY.noSunset).length).toBe(plan.days.filter(d => d.sunset === null).length)
    expect(screen.getAllByText(PLAN_COPY.noSunrise).length).toBe(plan.days.filter(d => d.sunrise === null).length)
    expect(document.querySelector('.sr-plan-suntrack')).toBeTruthy()
    for (const f of document.querySelectorAll('.sr-plan-dayfacts')) expect(f.textContent).toMatch(/Sun (highest at|past its highest)/)
  })
})
