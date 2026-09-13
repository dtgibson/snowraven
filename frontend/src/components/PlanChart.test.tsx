// @vitest-environment jsdom
// The chart's own contracts (D4-12, D4-14, D4-16) under jsdom: a mouse drag
// moves scrollLeft by exactly the pointer delta on every move under pointer
// capture and nothing moves after release; touch never drags; the imperative
// day handle scrolls by one day's width, smooth or instant under reduced
// motion; the nav state the chart reports; the wide tier's measured pixels
// per hour and its left-edge instant kept across a Days in view change; and
// the low-density strip. jsdom lays nothing out, so the box width and the
// scroll metrics are stubbed on the elements; the real-engine drag measurement
// is the browser harness recorded in decisions.md D5-21.
import { describe, it, expect, afterEach, afterAll, beforeEach, vi } from 'vitest'
import { render, cleanup, fireEvent, act } from '@testing-library/react'
import { createRef } from 'react'
import fixture from '../lib/weatherTidePlan.fixture.json'
import { composePlan, type Plan, type TidePlanResponse, type WeatherPlan } from '../lib/plan'
import { PLAN_COPY } from '../lib/planCopy'
import { PlanChart, type PlanChartHandle, type PlanNavState } from './PlanChart'

afterEach(cleanup)
afterAll(() => new Promise((r) => setTimeout(r, 120)))

const REF = (fixture as { families: Array<{ name: string; expectedWeather: { plan: WeatherPlan }; expectedTide: TidePlanResponse }> }).families.find(f => f.name === 'reference')!
const plan: Plan = composePlan(REF.expectedWeather.plan, REF.expectedTide)!
const HOURS_ALL = (plan.window.endTs + 1 - plan.window.axisStartTs) / 3600

// jsdom has no PointerEvent constructor in every version; give it one that
// carries the fields the handlers read.
class PointerEventShim extends MouseEvent {
  pointerType: string; pointerId: number
  constructor(type: string, init: MouseEventInit & { pointerType?: string; pointerId?: number } = {}) {
    super(type, init); this.pointerType = init.pointerType ?? 'mouse'; this.pointerId = init.pointerId ?? 1
  }
}

/** Give a scroller real, settable scroll metrics (jsdom's are inert zeros). */
function layout(el: HTMLElement, { scrollWidth, clientWidth }: { scrollWidth: number; clientWidth: number }) {
  let left = 0
  Object.defineProperty(el, 'scrollWidth', { configurable: true, get: () => scrollWidth })
  Object.defineProperty(el, 'clientWidth', { configurable: true, get: () => clientWidth })
  Object.defineProperty(el, 'scrollLeft', {
    configurable: true,
    get: () => left,
    set: (v: number) => { left = Math.max(0, Math.min(v, scrollWidth - clientWidth)); el.dispatchEvent(new Event('scroll')) },
  })
}

let matchMediaReduced = false
beforeEach(() => {
  vi.stubGlobal('PointerEvent', PointerEventShim)
  vi.stubGlobal('matchMedia', (q: string) => ({
    matches: q === '(prefers-reduced-motion: reduce)' ? matchMediaReduced : false, media: q,
    addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, onchange: null, dispatchEvent: () => false,
  }))
  matchMediaReduced = false
  if (!HTMLElement.prototype.setPointerCapture) HTMLElement.prototype.setPointerCapture = () => {}
  if (!HTMLElement.prototype.releasePointerCapture) HTMLElement.prototype.releasePointerCapture = () => {}
})
afterEach(() => vi.unstubAllGlobals())

const scroller = () => document.querySelector('.sr-plan-scroller') as HTMLDivElement

describe('the one-to-one mouse drag (D4-12)', () => {
  it('captures the pointer, moves scrollLeft by exactly the pointer delta on every move, and stops where released', () => {
    render(<PlanChart plan={plan} place="P" />)
    const el = scroller()
    layout(el, { scrollWidth: 3000, clientWidth: 500 })
    el.scrollLeft = 400
    const capture = vi.spyOn(el, 'setPointerCapture')
    fireEvent.pointerDown(el, { pointerType: 'mouse', button: 0, clientX: 200, pointerId: 7 })
    expect(capture).toHaveBeenCalledWith(7)
    expect(el.classList.contains('is-dragging')).toBe(true)
    const trace: number[] = []
    for (const x of [190, 170, 150, 120, 80, 100, 130]) {
      fireEvent.pointerMove(el, { pointerType: 'mouse', clientX: x, pointerId: 7 })
      trace.push(el.scrollLeft)
    }
    // startLeft - (clientX - startX), no threshold, no easing, at every step.
    expect(trace).toEqual([410, 430, 450, 480, 520, 500, 470])
    fireEvent.pointerUp(el, { pointerType: 'mouse', clientX: 130, pointerId: 7 })
    expect(el.classList.contains('is-dragging')).toBe(false)
    expect(el.scrollLeft).toBe(470)
    // Nothing moves after release: a stray move is ignored.
    fireEvent.pointerMove(el, { pointerType: 'mouse', clientX: 900, pointerId: 7 })
    expect(el.scrollLeft).toBe(470)
  })

  it('ends on pointercancel and on lostpointercapture too', () => {
    render(<PlanChart plan={plan} place="P" />)
    const el = scroller()
    layout(el, { scrollWidth: 3000, clientWidth: 500 })
    fireEvent.pointerDown(el, { pointerType: 'mouse', button: 0, clientX: 100, pointerId: 1 })
    fireEvent.pointerCancel(el, { pointerType: 'mouse', pointerId: 1 })
    expect(el.classList.contains('is-dragging')).toBe(false)
    fireEvent.pointerDown(el, { pointerType: 'mouse', button: 0, clientX: 100, pointerId: 1 })
    fireEvent(el, new PointerEventShim('lostpointercapture', { pointerType: 'mouse', pointerId: 1, bubbles: true }))
    expect(el.classList.contains('is-dragging')).toBe(false)
  })

  it('touch, pen and non-primary buttons never start a drag (native scrolling stays theirs)', () => {
    render(<PlanChart plan={plan} place="P" />)
    const el = scroller()
    layout(el, { scrollWidth: 3000, clientWidth: 500 })
    for (const init of [{ pointerType: 'touch', button: 0 }, { pointerType: 'pen', button: 0 }, { pointerType: 'mouse', button: 1 }, { pointerType: 'mouse', button: 2 }]) {
      fireEvent.pointerDown(el, { ...init, clientX: 100, pointerId: 3 })
      expect(el.classList.contains('is-dragging')).toBe(false)
      fireEvent.pointerMove(el, { ...init, clientX: 10, pointerId: 3 })
      expect(el.scrollLeft).toBe(0)
    }
  })
})

describe('the day handle and the nav state', () => {
  it('scrollByDay scrolls by 24 × hpx smoothly, or instantly under reduced motion', () => {
    const ref = createRef<PlanChartHandle>()
    render(<PlanChart ref={ref} plan={plan} place="P" />)
    const el = scroller()
    layout(el, { scrollWidth: 3000, clientWidth: 500 })
    const scrollBy = vi.fn()
    ;(el as unknown as { scrollBy: typeof scrollBy }).scrollBy = scrollBy
    act(() => ref.current!.scrollByDay(1))
    expect(scrollBy).toHaveBeenLastCalledWith({ left: 24 * 16, behavior: 'smooth' })
    act(() => ref.current!.scrollByDay(-1))
    expect(scrollBy).toHaveBeenLastCalledWith({ left: -24 * 16, behavior: 'smooth' })
    matchMediaReduced = true
    act(() => ref.current!.scrollByDay(1))
    expect(scrollBy).toHaveBeenLastCalledWith({ left: 24 * 16, behavior: 'auto' })
  })

  it('reports fits / atStart / atEnd on layout and on every scroll', () => {
    const states: PlanNavState[] = []
    render(<PlanChart plan={plan} place="P" onNav={s => states.push(s)} />)
    const el = scroller()
    // jsdom's zero metrics: the track "fits" and both ends are reached.
    expect(states.at(-1)).toEqual({ fits: true, atStart: true, atEnd: true })
    layout(el, { scrollWidth: 3000, clientWidth: 500 })
    el.scrollLeft = 0
    expect(states.at(-1)).toEqual({ fits: false, atStart: true, atEnd: false })
    el.scrollLeft = 1000
    expect(states.at(-1)).toEqual({ fits: false, atStart: false, atEnd: false })
    el.scrollLeft = 2500
    expect(states.at(-1)).toEqual({ fits: false, atStart: false, atEnd: true })
  })
})

describe('the wide tier (D4-14, D4-16)', () => {
  /** A ResizeObserver double that reports the width the test chooses. */
  function observedWidth(width: number) {
    const instances: Array<{ cb: ResizeObserverCallback }> = []
    vi.stubGlobal('ResizeObserver', class {
      cb: ResizeObserverCallback
      constructor(cb: ResizeObserverCallback) { this.cb = cb; instances.push(this) }
      observe(el: Element) { this.cb([{ contentRect: { width } } as ResizeObserverEntry], this as unknown as ResizeObserver); void el }
      unobserve() {}
      disconnect() {}
    })
    return instances
  }

  it('measures the box and sizes the track so the chosen span fills it; All fits exactly', () => {
    observedWidth(1000)
    const { rerender } = render(<PlanChart plan={plan} place="P" wide daysInView="all" />)
    const canvas = document.querySelector('.sr-plan-canvas') as HTMLElement
    expect(canvas.style.width).toBe('998px')
    expect((document.querySelector('.sr-plan-chartbox') as HTMLElement).style.height).toBe('340px')
    rerender(<PlanChart plan={plan} place="P" wide daysInView="3" />)
    const hpx3 = (1000 - 42) / 72
    expect(parseFloat(canvas.style.width)).toBeCloseTo(40 + Math.round(HOURS_ALL * hpx3), 0)
    rerender(<PlanChart plan={plan} place="P" wide daysInView="1" />)
    expect(parseFloat(canvas.style.width)).toBeCloseTo(40 + Math.round(HOURS_ALL * ((1000 - 42) / 24)), 0)
  })

  it('a Days in view change keeps the instant at the box\'s left edge in place', () => {
    observedWidth(1000)
    const { rerender } = render(<PlanChart plan={plan} place="P" wide daysInView="3" />)
    const el = scroller()
    layout(el, { scrollWidth: 20000, clientWidth: 998 })
    const hpx3 = (1000 - 42) / 72
    // Two days in from the axis start.
    el.scrollLeft = 48 * hpx3
    rerender(<PlanChart plan={plan} place="P" wide daysInView="1" />)
    const hpx1 = (1000 - 42) / 24
    expect(el.scrollLeft).toBeCloseTo(48 * hpx1, 6)
  })

  it('at a low density the strip collapses to block cells and says so in its tag; at a high one it adds temperatures', () => {
    observedWidth(700)                      // All over ~200 h: about 3.3 px/h → six-hour blocks
    const { rerender } = render(<PlanChart plan={plan} place="P" wide daysInView="all" />)
    const hourly = () => document.querySelectorAll('.sr-plan-cell.hourly')
    expect(hourly().length).toBeLessThan(plan.cells.filter(c => c.resolution === 'hourly').length)
    const tag = () => document.querySelector('.sr-plan-tag:not(.daily)')!.textContent
    expect([PLAN_COPY.stripHourlyEvery(6), PLAN_COPY.stripHourlyShort(6), PLAN_COPY.stripHourlyMin]).toContain(tag())
    expect(document.querySelectorAll('.sr-plan-cell-tmp')).toHaveLength(0)
    // The curve is the document's samples whatever the density.
    expect(document.querySelectorAll('.recharts-line')).toHaveLength(1)
    rerender(<PlanChart plan={plan} place="P" wide daysInView="1" />)   // (700-42)/24 ≈ 27 px/h: hourly glyphs, no temperature
    expect(hourly()).toHaveLength(plan.cells.filter(c => c.resolution === 'hourly').length)
    expect(tag()).toBe(PLAN_COPY.stripHourlyTag)
    expect(document.querySelectorAll('.sr-plan-cell-tmp')).toHaveLength(0)
    cleanup()
    observedWidth(1100)                     // (1100-42)/24 ≈ 44 px/h: temperatures
    render(<PlanChart plan={plan} place="P" wide daysInView="1" />)
    expect(document.querySelectorAll('.sr-plan-cell-tmp').length).toBeGreaterThan(0)
    expect(document.querySelectorAll('.recharts-line')).toHaveLength(1)
  })

  it('the event labels drop to the time alone below 8 px per hour and the ticks to Noon below 34 px per six hours', () => {
    observedWidth(700)
    render(<PlanChart plan={plan} place="P" wide daysInView="all" />)
    const labels = [...document.querySelectorAll('text.sr-plan-cx-evt')].map(t => t.textContent!)
    expect(labels.length).toBe(plan.events.length)
    expect(labels.every(l => /^\d+:\d\d [AP]M$/.test(l))).toBe(true)
    const ticks = [...document.querySelectorAll('.sr-plan-ticktext')].map(t => t.textContent)
    expect(new Set(ticks)).toEqual(new Set(['Noon']))
  })
})
