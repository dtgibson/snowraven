// @vitest-environment jsdom
// The chart's own contracts (D4-12, D4-14, D4-16) under jsdom: a mouse drag
// moves scrollLeft by exactly the pointer delta on every move under pointer
// capture and nothing moves after release; touch never drags; the imperative
// day handle scrolls by one day's width, smooth or instant under reduced
// motion; the nav state the chart reports; the wide tier's measured pixels
// per hour and its left-edge instant kept across a Days in view change; and
// the low-density strip. Since plan-sun-moon-readout: the slider role and its
// attributes, pick versus drag, the key map, the keyboard-only reveal scroll,
// the sun track's z-order and its bounded samples, and the marker (schema 6.3
// to 6.6; QA-14, QA-15, QA-19 to QA-25, QA-29, QA-30, QA-33, QA-48). jsdom
// lays nothing out, so the box width and the scroll metrics are stubbed on
// the elements; the real-engine drag measurement is the browser harness
// recorded in decisions.md D5-21.
import { describe, it, expect, afterEach, afterAll, beforeEach, vi } from 'vitest'
import { render, cleanup, fireEvent, act } from '@testing-library/react'
import { createRef, useState } from 'react'
import fixture from '../lib/weatherTidePlan.fixture.json'
import { composePlan, type Plan, type TidePlanResponse, type WeatherPlan } from '../lib/plan'
import { PLAN_COPY } from '../lib/planCopy'
import { planGeometry, pickMarkerBox, revealScrollLeft, PLAN_GUTTER_PX } from '../lib/planChartGeometry'
import { buildSunModel, sunTrack } from '../lib/planSun'
import { pickBounds } from '../lib/planPick'
import { localClock, localMidnightTs } from '../lib/tzClock'
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

// ── plan-sun-moon-readout ────────────────────────────────────────────────────

const model = buildSunModel(plan)!
const at = (date: string, h: number, m: number) => localMidnightTs(date, plan.tz) + h * 3600 + m * 60
const clock = (t: number) => localClock(t, plan.tz)

/** A host holding the pick the way PlanResult does, recording every onPick. */
function Host({ initial = null, picks, p = plan, wide = false, daysInView = 'all' as const }: { initial?: number | null; picks: Array<number | null>; p?: Plan; wide?: boolean; daysInView?: '1' | '3' | '7' | 'all' }) {
  const [pick, setPick] = useState<number | null>(initial)
  return (
    <PlanChart plan={p} place="P" wide={wide} daysInView={daysInView} pick={pick} onPick={t => { picks.push(t); setPick(t) }} sunModel={buildSunModel(p)} valueText={pick === null ? PLAN_COPY.restLine : `picked ${pick}`} />
  )
}
const press = (el: HTMLElement, clientX: number, extra: Record<string, unknown> = {}) =>
  fireEvent.pointerDown(el, { pointerType: 'mouse', button: 0, clientX, clientY: 10, pointerId: 9, ...extra })
const release = (el: HTMLElement, clientX: number, extra: Record<string, unknown> = {}) =>
  fireEvent.pointerUp(el, { pointerType: 'mouse', clientX, clientY: 10, pointerId: 9, ...extra })

describe('the slider (schema 6.3, D10; QA-19, QA-23)', () => {
  it('carries the role, the orientation, the window\'s ends at minute resolution, Now as its value at rest, the rest line as its value text and the estimate statement as its description; one tab stop, no live region', () => {
    render(<Host picks={[]} />)
    const el = scroller()
    const b = pickBounds(plan)
    expect(el.getAttribute('role')).toBe('slider')
    expect(el.getAttribute('aria-orientation')).toBe('horizontal')
    expect(el.getAttribute('aria-valuemin')).toBe(String(b.min))
    expect(el.getAttribute('aria-valuemax')).toBe(String(b.max))
    expect(el.getAttribute('aria-valuenow')).toBe(String(plan.fetchedAt))
    expect(el.getAttribute('aria-valuetext')).toBe(PLAN_COPY.restLine)
    expect(el.getAttribute('tabindex')).toBe('0')
    const desc = document.getElementById(el.getAttribute('aria-describedby')!)!
    expect(desc.textContent).toBe(PLAN_COPY.estimateLine)
    expect(desc.className).toBe('sr-only')
    expect(desc.id).not.toContain(' ')
    expect(document.querySelectorAll('[tabindex="0"]')).toHaveLength(1)
    expect(document.querySelectorAll('[aria-live], [role="status"], [role="alert"]')).toHaveLength(0)
    const canvas = el.querySelector('.sr-plan-canvas')!
    expect(canvas.getAttribute('aria-hidden')).toBe('true')
    expect(canvas.hasAttribute('inert')).toBe(true)
  })

  it('the value and value text follow the pick, and the has-pick class with them', () => {
    const picks: Array<number | null> = []
    const t = at('2026-09-14', 6, 15)
    render(<Host picks={picks} initial={t} />)
    const el = scroller()
    expect(el.getAttribute('aria-valuenow')).toBe(String(t))
    expect(el.getAttribute('aria-valuetext')).toBe(`picked ${t}`)
    expect(el.classList.contains('has-pick')).toBe(true)
  })
})

describe('pick versus drag (schema 6.5; QA-15, QA-22, QA-24)', () => {
  it('a mouse press and release that moved under 5 px picks the instant under the PRESS point and focuses the slider without scrolling', () => {
    const picks: Array<number | null> = []
    render(<Host picks={picks} />)
    const el = scroller()
    layout(el, { scrollWidth: 3000, clientWidth: 500 })
    el.scrollLeft = 100
    const g = planGeometry(plan, true)
    press(el, 200)
    fireEvent.pointerMove(el, { pointerType: 'mouse', clientX: 202, clientY: 11, pointerId: 9 })
    release(el, 202)
    // The press point in canvas coordinates: clientX - rect.left (0 in jsdom) + scrollLeft.
    expect(picks).toEqual([g.tAt(300)])
    expect(picks[0]! % 60).toBe(0)
    expect(document.activeElement).toBe(el)
    expect(el.scrollLeft).toBe(100 - 2)   // the one-to-one drag moved it by the 2 px, and nothing scrolled afterwards
  })

  it('a press that moved 12 px is a drag: it scrolls by 12 px, picks nothing, and leaves an earlier pick in place', () => {
    const picks: Array<number | null> = []
    const earlier = at('2026-09-14', 6, 15)
    render(<Host picks={picks} initial={earlier} />)
    const el = scroller()
    layout(el, { scrollWidth: 3000, clientWidth: 500 })
    el.scrollLeft = 400
    press(el, 200)
    fireEvent.pointerMove(el, { pointerType: 'mouse', clientX: 188, clientY: 10, pointerId: 9 })
    release(el, 188)
    expect(el.scrollLeft).toBe(412)
    expect(picks).toEqual([])
    expect(el.getAttribute('aria-valuenow')).toBe(String(earlier))
    expect(el.classList.contains('is-dragging')).toBe(false)
  })

  it('a touch tap picks; a cancelled pointer never picks; a pen tap picks; none of them drags', () => {
    const picks: Array<number | null> = []
    render(<Host picks={picks} />)
    const el = scroller()
    layout(el, { scrollWidth: 3000, clientWidth: 500 })
    fireEvent.pointerDown(el, { pointerType: 'touch', button: 0, clientX: 120, clientY: 10, pointerId: 3 })
    fireEvent.pointerMove(el, { pointerType: 'touch', clientX: 121, clientY: 10, pointerId: 3 })
    expect(el.scrollLeft).toBe(0)
    fireEvent.pointerUp(el, { pointerType: 'touch', clientX: 121, clientY: 10, pointerId: 3 })
    expect(picks).toHaveLength(1)
    fireEvent.pointerDown(el, { pointerType: 'touch', button: 0, clientX: 300, clientY: 10, pointerId: 4 })
    fireEvent.pointerCancel(el, { pointerType: 'touch', pointerId: 4 })
    expect(picks).toHaveLength(1)
    fireEvent.pointerDown(el, { pointerType: 'pen', button: 0, clientX: 300, clientY: 10, pointerId: 6 })
    fireEvent.pointerUp(el, { pointerType: 'pen', clientX: 300, clientY: 10, pointerId: 6 })
    expect(picks).toHaveLength(2)
    expect(el.scrollLeft).toBe(0)
  })

  it('a press in the gutter picks the axis start; a non-primary mouse button neither picks nor drags', () => {
    const picks: Array<number | null> = []
    render(<Host picks={picks} />)
    const el = scroller()
    press(el, PLAN_GUTTER_PX - 5)
    release(el, PLAN_GUTTER_PX - 5)
    expect(picks).toEqual([plan.window.axisStartTs])
    fireEvent.pointerDown(el, { pointerType: 'mouse', button: 2, clientX: 300, clientY: 10, pointerId: 11 })
    fireEvent.pointerUp(el, { pointerType: 'mouse', clientX: 300, clientY: 10, pointerId: 11 })
    expect(picks).toHaveLength(1)
  })

  it('the shipped drag rows still hold with a pick on screen: one-to-one from the first pixel, nothing after release', () => {
    const picks: Array<number | null> = []
    render(<Host picks={picks} initial={at('2026-09-14', 6, 15)} />)
    const el = scroller()
    layout(el, { scrollWidth: 3000, clientWidth: 500 })
    el.scrollLeft = 400
    press(el, 200)
    const trace: number[] = []
    for (const x of [190, 170, 150, 120, 80, 100, 130]) {
      fireEvent.pointerMove(el, { pointerType: 'mouse', clientX: x, clientY: 10, pointerId: 9 })
      trace.push(el.scrollLeft)
    }
    expect(trace).toEqual([410, 430, 450, 480, 520, 500, 470])
    release(el, 130)
    expect(el.scrollLeft).toBe(470)
    expect(picks).toEqual([])
  })
})

describe('the keys (schema 6.6, D9; QA-20, QA-21, QA-22, QA-48)', () => {
  const key = (el: HTMLElement, k: string, init: Record<string, unknown> = {}) => fireEvent.keyDown(el, { key: k, ...init })

  it('from a pick at 6:15: Right 6:30, Left 6:00, Shift+Right 7:15, Shift+Left 5:15, Page Up tomorrow, Page Down yesterday, Home the axis start, End the window\'s end', () => {
    const picks: Array<number | null> = []
    render(<Host picks={picks} initial={at('2026-09-14', 6, 15)} />)
    const el = scroller()
    key(el, 'ArrowRight'); key(el, 'ArrowLeft'); key(el, 'ArrowRight', { shiftKey: true }); key(el, 'ArrowLeft', { shiftKey: true })
    key(el, 'PageUp'); key(el, 'PageDown'); key(el, 'Home'); key(el, 'End')
    expect(picks.map(t => clock(t!))).toEqual([
      '2026-09-14 06:30', '2026-09-14 06:15', '2026-09-14 07:15', '2026-09-14 06:15',
      '2026-09-15 06:15', '2026-09-14 06:15', '2026-09-12 15:00', '2026-09-19 23:59',
    ])
  })

  it('with no pick the first Right reads the first quarter mark at or after Now and Left the last at or before (QA-21); Enter, Space, Up and Down are unbound', () => {
    const picks: Array<number | null> = []
    render(<Host picks={picks} />)
    const el = scroller()
    key(el, 'Enter'); key(el, ' '); key(el, 'ArrowUp'); key(el, 'ArrowDown')
    expect(picks).toEqual([])
    key(el, 'ArrowRight')
    expect(clock(picks[0]!)).toBe('2026-09-12 15:45')
    cleanup()
    const picks2: Array<number | null> = []
    render(<Host picks={picks2} />)
    key(scroller(), 'ArrowLeft')
    expect(clock(picks2[0]!)).toBe('2026-09-12 15:30')
  })

  it('Escape clears and is consumed only while a pick exists; a second Escape reaches an outer layer', () => {
    const picks: Array<number | null> = []
    render(<Host picks={picks} initial={at('2026-09-14', 6, 15)} />)
    const el = scroller()
    const outer = vi.fn()
    document.addEventListener('keydown', outer)
    key(el, 'Escape')
    expect(picks).toEqual([null])
    expect(outer).not.toHaveBeenCalled()
    key(el, 'Escape')
    expect(picks).toEqual([null])
    expect(outer).toHaveBeenCalledTimes(1)
    document.removeEventListener('keydown', outer)
  })

  it('a step whose marker leaves the visible span scrolls by the minimum, smooth, or instant under reduced motion; a step inside it does not scroll (QA-22, QA-48)', () => {
    const picks: Array<number | null> = []
    render(<Host picks={picks} initial={at('2026-09-14', 6, 15)} />)
    const el = scroller()
    layout(el, { scrollWidth: 3000, clientWidth: 500 })
    el.scrollLeft = 0
    const scrollTo = vi.fn()
    ;(el as unknown as { scrollTo: typeof scrollTo }).scrollTo = scrollTo
    const g = planGeometry(plan, true)
    key(el, 'ArrowRight')
    const next = picks[0]!
    expect(scrollTo).toHaveBeenLastCalledWith({ left: revealScrollLeft(g.x(next), 0, 500), behavior: 'smooth' })
    expect(revealScrollLeft(g.x(next), 0, 500)).toBe(g.x(next) - 499)
    // Now the marker is inside the span: the next step scrolls nothing.
    el.scrollLeft = revealScrollLeft(g.x(next), 0, 500)
    scrollTo.mockClear()
    key(el, 'ArrowLeft')
    expect(scrollTo).not.toHaveBeenCalled()
    matchMediaReduced = true
    key(el, 'End')
    expect(scrollTo).toHaveBeenLastCalledWith(expect.objectContaining({ behavior: 'auto' }))
  })

  it('a pointer pick never scrolls the box, and no scroll is initiated after a drag (FR-22)', () => {
    const picks: Array<number | null> = []
    render(<Host picks={picks} />)
    const el = scroller()
    layout(el, { scrollWidth: 3000, clientWidth: 500 })
    el.scrollLeft = 250
    const scrollTo = vi.fn()
    ;(el as unknown as { scrollTo: typeof scrollTo }).scrollTo = scrollTo
    press(el, 480); release(el, 480)             // a pick near the right edge
    expect(picks).toHaveLength(1)
    expect(scrollTo).not.toHaveBeenCalled()
    expect(el.scrollLeft).toBe(250)
    press(el, 300)
    fireEvent.pointerMove(el, { pointerType: 'mouse', clientX: 250, clientY: 10, pointerId: 9 })
    release(el, 250)
    expect(scrollTo).not.toHaveBeenCalled()
    expect(el.scrollLeft).toBe(300)
  })
})

describe('the sun track and the marker (QA-14, QA-25, QA-29, QA-30, QA-33; the Designer\'s assertion set)', () => {
  it('eight night rects of positive width at strictly increasing x, summing to less than the plot; alternating day and night runs of positive extent; eight fills; fifteen event triangles', () => {
    render(<Host picks={[]} />)
    const el = scroller()
    const g = planGeometry(plan, true)
    const areas = [...el.querySelectorAll('.recharts-reference-area-rect')]
    expect(areas).toHaveLength(1 + plan.nightSpans.length)
    const nights = areas.slice(1).map(r => ({ x: parseFloat(r.getAttribute('x')!), w: parseFloat(r.getAttribute('width')!) }))
    expect(nights).toHaveLength(8)
    let sum = 0
    for (let i = 0; i < nights.length; i += 1) {
      expect(nights[i].w).toBeGreaterThan(0)
      if (i > 0) expect(nights[i].x).toBeGreaterThan(nights[i - 1].x)
      sum += nights[i].w
    }
    expect(sum).toBeLessThan(g.plotW)
    const track = el.querySelector('.sr-plan-suntrack')!
    const dayRuns = [...track.querySelectorAll('.sr-plan-sun-day')]
    const nightRuns = [...track.querySelectorAll('.sr-plan-sun-night')]
    expect(dayRuns).toHaveLength(8)
    expect(nightRuns).toHaveLength(8)
    expect(track.querySelectorAll('.sr-plan-sun-fill')).toHaveLength(8)
    for (const r of [...dayRuns, ...nightRuns]) {
      const xs = r.getAttribute('points')!.split(' ').map(p => parseFloat(p.split(',')[0]))
      expect(xs.length).toBeGreaterThanOrEqual(2)
      expect(xs[xs.length - 1]).toBeGreaterThan(xs[0])
    }
    expect(el.querySelectorAll('polygon')).toHaveLength(plan.events.length)
    expect(plan.events).toHaveLength(15)
    // The day fill sits on the zero line at both ends.
    const zero = g.ySun(0).toFixed(1)
    for (const f of track.querySelectorAll('.sr-plan-sun-fill')) {
      const d = f.getAttribute('d')!
      expect(d.startsWith('M')).toBe(true)
      expect(d.split(' ')[0].endsWith(`,${zero}`)).toBe(true)
      expect(d.endsWith(`,${zero} Z`)).toBe(true)
    }
    // Every night band edge is a track zero crossing (QA-29): the fills start
    // and end exactly where the night rects end and start.
    const fillXs = [...track.querySelectorAll('.sr-plan-sun-fill')].map(f => f.getAttribute('d')!.match(/M([\d.]+),/)![1]).map(Number)
    for (const n of nights.slice(0, 7)) expect(fillXs.some(x => Math.abs(x - (n.x + n.w)) < 0.6), `band end ${n.x + n.w}`).toBe(true)
  })

  it('draws the track BENEATH the Now hairline, the tide curve and every marker, and above the bands and gridlines (SVG order, QA-30); the tokens are the design\'s', () => {
    render(<Host picks={[]} />)
    const el = scroller()
    const track = el.querySelector('.sr-plan-suntrack')!
    const after = (a: Element, b: Element) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0
    // Above the track: the tide curve, every marker, and the Now and base lines (layer 400).
    for (const sel of ['.recharts-line', '.recharts-reference-dot', '.recharts-zIndex-layer_400 .recharts-reference-line']) {
      const nodes = el.querySelectorAll(sel)
      expect(nodes.length, sel).toBeGreaterThan(0)
      for (const node of nodes) expect(after(track, node), sel).toBe(true)
    }
    expect(el.querySelectorAll('.recharts-zIndex-layer_400 .recharts-reference-line')).toHaveLength(2)
    // Beneath the track: the bands (layer -100) and the gridlines and midnight lines (layer -50).
    const bands = el.querySelectorAll('.recharts-zIndex-layer_-100 .recharts-reference-area')
    const grid = el.querySelectorAll('.recharts-zIndex-layer_-50 .recharts-reference-line')
    expect(bands).toHaveLength(1 + plan.nightSpans.length)
    expect(grid.length).toBeGreaterThan(7)
    for (const node of [...bands, ...grid]) expect(after(node, track)).toBe(true)
    // And the track is a bare child of the chart svg, not a layer of its own.
    expect(track.parentElement!.tagName).toBe('svg')
    expect(track.querySelector('.sr-plan-sun-day')!.getAttribute('stroke')).toBe('var(--sr-plan-sunline)')
    expect(track.querySelector('.sr-plan-sun-day')!.getAttribute('stroke-width')).toBe('1.5')
    expect(track.querySelector('.sr-plan-sun-night')!.getAttribute('stroke')).toBe('var(--sr-plan-sunline-night)')
    expect(track.querySelector('.sr-plan-sun-night')!.getAttribute('stroke-width')).toBe('1')
    expect(track.querySelector('.sr-plan-sun-fill')!.getAttribute('fill')).toBe('rgba(var(--sr-plan-sunline-rgb),0.14)')
    // The night lines come first, then the fills, then the day lines.
    const kinds = [...track.children].map(c => c.getAttribute('class'))
    expect(kinds.join(',')).toMatch(/^(sr-plan-sun-night,)+(sr-plan-sun-fill,)+(sr-plan-sun-day,?)+$/)
  })

  it('samples at most hours x 4 + anchors, and the count does not change with Days in view (QA-33); present with and without tide (QA-25)', () => {
    const count = () => [...document.querySelectorAll('.sr-plan-sun-day, .sr-plan-sun-night')].reduce((n, r) => n + r.getAttribute('points')!.split(' ').length, 0)
    observed(1000)
    const { rerender } = render(<Host picks={[]} wide daysInView="all" />)
    const all = count()
    const samples = sunTrack(model).length
    const hours = (plan.window.endTs + 1 - plan.window.axisStartTs) / 3600
    expect(samples).toBeLessThanOrEqual(hours * 4 + model.anchors.length)
    // Shared boundary samples are drawn once per run they belong to.
    expect(all).toBe(samples + 15)
    rerender(<Host picks={[]} wide daysInView="3" />)
    expect(count()).toBe(all)
    rerender(<Host picks={[]} wide daysInView="1" />)
    expect(count()).toBe(all)
    cleanup()
    const noTide = composePlan(REF.expectedWeather.plan, { status: 'unavailable' })!
    render(<Host picks={[]} p={noTide} />)
    expect(document.querySelector('.sr-plan-suntrack')).toBeTruthy()
    expect(document.querySelectorAll('.recharts-line')).toHaveLength(0)
    expect((document.querySelector('.sr-plan-chartbox') as HTMLElement).style.height).toBe('186px')
  })

  it('the marker is an HTML overlay at x(t), the plot\'s full height, absent at rest and re-placed with the geometry (QA-14)', () => {
    const t = at('2026-09-14', 6, 15)
    const { rerender } = render(<Host picks={[]} initial={t} />)
    const g = planGeometry(plan, true)
    const box = pickMarkerBox(g, t)
    const mark = document.querySelector('.sr-plan-pickmark') as HTMLElement
    expect(mark.parentElement!.classList.contains('sr-plan-canvas')).toBe(true)
    expect(parseFloat(mark.style.left)).toBeCloseTo(box.left, 6)
    expect(mark.style.top).toBe(`${box.top}px`)
    expect(mark.style.height).toBe(`${box.height}px`)
    expect(document.querySelector('.recharts-reference-line[x]')).toBeNull()   // never a chart line
    rerender(<Host picks={[]} initial={t} />)
    expect((document.querySelector('.sr-plan-pickmark') as HTMLElement).style.left).toBe(mark.style.left)
    cleanup()
    observed(1000)
    render(<Host picks={[]} initial={t} wide daysInView="3" />)
    const wide = document.querySelector('.sr-plan-pickmark') as HTMLElement
    expect(wide.style.top).toBe('50px')
    expect(wide.style.height).toBe('220px')
  })
})

/** A ResizeObserver double reporting the width the test chooses (the wide tier). */
function observed(width: number) {
  vi.stubGlobal('ResizeObserver', class {
    cb: ResizeObserverCallback
    constructor(cb: ResizeObserverCallback) { this.cb = cb }
    observe(el: Element) { this.cb([{ contentRect: { width } } as ResizeObserverEntry], this as unknown as ResizeObserver); void el }
    unobserve() {}
    disconnect() {}
  })
}
