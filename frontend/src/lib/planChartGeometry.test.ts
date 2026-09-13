// The chart's geometry and density rules (D4-13, D4-14, D4-16), swept as pure
// functions over the four Days in view options and a range of box widths: the
// pixels-per-hour floor at 4, the All track fitting the box, the lanes and
// heights of both tiers, and every density threshold at its boundary.
import { describe, it, expect } from 'vitest'
import fixture from './weatherTidePlan.fixture.json'
import { composePlan, type Plan, type TidePlanResponse, type WeatherPlan } from './plan'
import { planDaysInViewOptions, planHoursInView, type PlanDaysInView } from './planDaysInView'
import {
  PLAN_HOUR_PX, PLAN_MIN_HOUR_PX, PLAN_GUTTER_PX, PLAN_BOX_CHROME_PX, PLAN_SUN_ZERO_FRAC, PLAN_SUN_TOP_DEG,
  planChartHeight, planLanes, planHourPx, planHourPxFor, planGeometry, planSunDomain,
  planGlyphEvery, planShowsTemperature, planFullEventLabel, planTickHours, planDayLabel,
  planDailyCellMode, planHourlyCellMode, planHourlyTagMode, planDailyTagMode, planStripCells,
  pickMarkerBox, revealScrollLeft,
} from './planChartGeometry'

const REF = (fixture as { families: Array<{ name: string; expectedWeather: { plan: WeatherPlan }; expectedTide: TidePlanResponse }> }).families.find(f => f.name === 'reference')!
const plan: Plan = composePlan(REF.expectedWeather.plan, REF.expectedTide)!
const HOURS_ALL = (plan.window.endTs + 1 - plan.window.axisStartTs) / 3600

describe('tiers and lanes', () => {
  it('the phone tier is the approved 242 / 186 and the wide tier 340 / 240 (the without-tide plot holds the sun track since 1.0.30)', () => {
    expect(planChartHeight(true, false)).toBe(242)
    expect(planChartHeight(false, false)).toBe(186)
    expect(planChartHeight(true, true)).toBe(340)
    expect(planChartHeight(false, true)).toBe(240)
    expect(planLanes(true, false)).toEqual({ dayHeader: 0, labels: 28, plot: 128, axis: 38, strip: 48 })
    expect(planLanes(false, false)).toEqual({ dayHeader: 0, labels: 28, plot: 72, axis: 38, strip: 48 })
    expect(planLanes(true, true)).toEqual({ dayHeader: 22, labels: 28, plot: 220, axis: 22, strip: 48 })
    expect(planLanes(false, true)).toEqual({ dayHeader: 22, labels: 28, plot: 120, axis: 22, strip: 48 })
  })

  it('the phone tier ignores the box and the choice: always 16 px per hour', () => {
    for (const view of ['1', '3', '7', 'all'] as PlanDaysInView[]) {
      for (const w of [0, 300, 1000]) expect(planHourPxFor(plan, false, view, w)).toBe(PLAN_HOUR_PX)
    }
    // And an unmeasured wide box reads as the phone constant rather than a smear.
    expect(planHourPxFor(plan, true, '3', 0)).toBe(PLAN_HOUR_PX)
  })
})

describe('the wide tier\'s pixels per hour (D4-14)', () => {
  it('the chosen span fills the box: hours × hpx equals the box width minus the gutter and chrome', () => {
    for (const w of [641, 700, 760, 900, 1013.7, 1080, 1440]) {
      for (const view of ['1', '3', '7', 'all'] as PlanDaysInView[]) {
        const hours = planHoursInView(plan.window.axisStartTs, plan.window.endTs, view)
        const hpx = planHourPx(w, hours)
        if (hpx > PLAN_MIN_HOUR_PX) expect(hours * hpx).toBeCloseTo(Math.floor(w) - PLAN_GUTTER_PX - PLAN_BOX_CHROME_PX, 6)
      }
    }
  })

  it('floors at 4 px per hour, so a narrow box on All still scrolls rather than smearing', () => {
    // An eight-day window is ~177 h: a 1200 px box gives ~6.5 px/h, a 641 px
    // box would give 3.4 and is floored to 4 (the track then scrolls).
    expect(planHourPx(1200, HOURS_ALL)).toBeCloseTo((1200 - 42) / HOURS_ALL, 9)
    expect((641 - 42) / HOURS_ALL).toBeLessThan(4)
    expect(planHourPx(641, HOURS_ALL)).toBe(4)
    expect(planHourPx(200, HOURS_ALL)).toBe(4)
    expect(planHourPx(0, 24)).toBe(4)
    expect(planHourPx(1000, 0)).toBe(4)
  })

  it('at All the track is an integer that fits the scroller exactly (above the floor); at 1 / 3 / 7 it is wider', () => {
    for (const w of [760, 1013.7, 1080, 1440]) {
      const gAll = planGeometry(plan, true, planHourPxFor(plan, true, 'all', w), true)
      expect(gAll.width).toBe(Math.floor(w) - PLAN_BOX_CHROME_PX)
      for (const view of ['1', '3', '7'] as PlanDaysInView[]) {
        const g = planGeometry(plan, true, planHourPxFor(plan, true, view, w), true)
        expect(g.width).toBeGreaterThan(gAll.width)
      }
    }
  })

  it('the options follow the plan\'s day count and the hours follow the option', () => {
    expect(planDaysInViewOptions(8)).toEqual(['1', '3', '7', 'all'])
    expect(planDaysInViewOptions(5)).toEqual(['1', '3', 'all'])
    expect(planDaysInViewOptions(3)).toEqual(['1', 'all'])
    expect(planDaysInViewOptions(1)).toEqual(['all'])
    expect(planHoursInView(0, 86399, '1')).toBe(24)
    expect(planHoursInView(0, 86399, '7')).toBe(168)
    expect(planHoursInView(0, 86399, 'all')).toBe(24)
  })
})

describe('density thresholds (D4-16), each at its boundary', () => {
  it('glyph cadence: 1 at 16 and up, 3 while three hours span 16 px, else 6', () => {
    expect(planGlyphEvery(16)).toBe(1)
    expect(planGlyphEvery(15.99)).toBe(3)
    expect(planGlyphEvery(16 / 3)).toBe(3)
    expect(planGlyphEvery(16 / 3 - 0.01)).toBe(6)
    expect(planGlyphEvery(4)).toBe(6)
  })

  it('temperature at 32 and up; full event label at 8 and up; ticks by 34 px per six hours', () => {
    expect(planShowsTemperature(32)).toBe(true)
    expect(planShowsTemperature(31.9)).toBe(false)
    expect(planFullEventLabel(8)).toBe(true)
    expect(planFullEventLabel(7.9)).toBe(false)
    expect(planTickHours(34 / 6)).toEqual([6, 12, 18])
    expect(planTickHours(34 / 6 - 0.01)).toEqual([12])
  })

  it('day label by visible width: full at 84, short at 44, weekday at 22, else nothing', () => {
    expect(planDayLabel('Sun, Sep 13, 2026', 'Sun 13', 'Sun', 84)).toBe('Sun, Sep 13, 2026')
    expect(planDayLabel('Sun, Sep 13, 2026', 'Sun 13', 'Sun', 83.9)).toBe('Sun 13')
    expect(planDayLabel('Sun, Sep 13, 2026', 'Sun 13', 'Sun', 44)).toBe('Sun 13')
    expect(planDayLabel('Sun, Sep 13, 2026', 'Sun 13', 'Sun', 43.9)).toBe('Sun')
    expect(planDayLabel('Sun, Sep 13, 2026', 'Sun 13', 'Sun', 22)).toBe('Sun')
    expect(planDayLabel('Sun, Sep 13, 2026', 'Sun 13', 'Sun', 21.9)).toBe('')
  })

  it('cell and tag modes by width', () => {
    expect(planDailyCellMode(200)).toBe('full')
    expect(planDailyCellMode(199.9)).toBe('hl')
    expect(planDailyCellMode(90)).toBe('hl')
    expect(planDailyCellMode(89.9)).toBe('emoji')
    expect(planHourlyCellMode(30, 32)).toBe('temp')
    expect(planHourlyCellMode(29.9, 32)).toBe('emoji')
    expect(planHourlyCellMode(30, 31.9)).toBe('emoji')
    expect(planHourlyCellMode(12, 16)).toBe('emoji')
    expect(planHourlyCellMode(11.9, 16)).toBe('none')
    expect(planHourlyTagMode(1, 10)).toBe('full')
    expect(planHourlyTagMode(3, 250)).toBe('every')
    expect(planHourlyTagMode(3, 249.9)).toBe('short')
    expect(planHourlyTagMode(6, 120)).toBe('short')
    expect(planHourlyTagMode(6, 119.9)).toBe('min')
    expect(planDailyTagMode(120)).toBe('full')
    expect(planDailyTagMode(119.9)).toBe('short')
  })
})

describe('block cells at low density', () => {
  it('at cadence 1 the cells are the document\'s; at 3 and 6 the hourly cells collapse into clock-aligned blocks showing their first reading', () => {
    expect(planStripCells(plan.cells, 1)).toHaveLength(plan.cells.length)
    for (const every of [3, 6] as const) {
      const cells = planStripCells(plan.cells, every)
      const hourly = cells.filter(c => c.resolution === 'hourly')
      const daily = cells.filter(c => c.resolution === 'daily')
      expect(daily).toHaveLength(plan.cells.filter(c => c.resolution === 'daily').length)
      expect(hourly.length).toBeLessThan(plan.cells.filter(c => c.resolution === 'hourly').length)
      // Every block after the first begins on a clock hour that is a multiple
      // of the cadence, carries its first reading, and the blocks tile the
      // hourly span with no gap and no overlap.
      for (let i = 1; i < hourly.length; i += 1) {
        expect(Number(hourly[i].local.slice(11, 13)) % every).toBe(0)
        expect(hourly[i].startTs).toBe(hourly[i - 1].endTs + 1)
      }
      const first = plan.cells.find(c => c.resolution === 'hourly')!
      expect(hourly[0].weather).toBe(first.weather)
      expect(hourly[0].local).toBe(first.local)
      const lastDoc = [...plan.cells].reverse().find(c => c.resolution === 'hourly')!
      expect(hourly[hourly.length - 1].endTs).toBe(lastDoc.endTs)
    }
  })
})

describe('the sun scale (plan-sun-moon-readout, schema 6.1)', () => {
  it('zero sits at 0.6 of the plot from the top, 90 at the top edge, -60 at the bottom, on one uniform scale in both tiers', () => {
    expect(PLAN_SUN_ZERO_FRAC).toBe(0.6)
    expect(PLAN_SUN_TOP_DEG).toBe(90)
    expect(planSunDomain()).toEqual([-60, 90])
    for (const [hasTide, wide] of [[true, false], [false, false], [true, true], [false, true]] as const) {
      const g = planGeometry(plan, hasTide, planHourPxFor(plan, wide, 'all', 1000), wide)
      const top = g.lanes.labels, plot = g.lanes.plot
      expect(g.ySun(90)).toBeCloseTo(top, 9)
      expect(g.ySun(0)).toBeCloseTo(top + 0.6 * plot, 9)
      expect(g.ySun(-60)).toBeCloseTo(top + plot, 9)
      // Monotone, and one degree is plot / 150 px.
      expect(g.ySun(10) - g.ySun(20)).toBeCloseTo(plot / 15, 9)
      expect(g.ySun(-10)).toBeGreaterThan(g.ySun(0))
    }
  })
})

describe('the pick\'s geometry (schema 6.1, FR-14, FR-15, FR-22)', () => {
  const g = planGeometry(plan, true)

  it('tAt inverts x on the grid and clamps: the gutter reads the axis start, beyond the end reads the last second', () => {
    for (const t of [g.axisStart, g.axisStart + 3600, g.axisStart + 86400 + 900, g.axisEnd - 1]) {
      expect(g.tAt(g.x(t))).toBeCloseTo(t, 6)
    }
    expect(g.tAt(0)).toBe(g.axisStart)
    expect(g.tAt(PLAN_GUTTER_PX - 1)).toBe(g.axisStart)
    expect(g.tAt(PLAN_GUTTER_PX)).toBe(g.axisStart)
    expect(g.tAt(g.width + 500)).toBe(g.axisEnd - 1)
  })

  it('pickMarkerBox is at x(t), from the plot\'s top, the plot\'s full height, in both tiers', () => {
    const t = g.axisStart + 5 * 3600
    expect(pickMarkerBox(g, t)).toEqual({ left: g.x(t), top: g.lanes.labels, height: g.lanes.plot })
    const wg = planGeometry(plan, false, planHourPxFor(plan, true, '3', 1000), true)
    expect(pickMarkerBox(wg, t)).toEqual({ left: wg.x(t), top: wg.lanes.dayHeader + wg.lanes.labels, height: 120 })
  })

  it('revealScrollLeft moves by the minimum, keeps the gutter clear on the left, and does nothing when the marker is visible', () => {
    // Visible: inside [scrollLeft + 40, scrollLeft + clientWidth - 1].
    expect(revealScrollLeft(300, 100, 500)).toBe(100)
    expect(revealScrollLeft(140, 100, 500)).toBe(100)
    expect(revealScrollLeft(599, 100, 500)).toBe(100)
    // Left of the clear span: the marker lands at scrollLeft + 40.
    expect(revealScrollLeft(120, 100, 500)).toBe(80)
    expect(revealScrollLeft(10, 100, 500)).toBe(0)
    // Right of the span: the marker lands at the right edge.
    expect(revealScrollLeft(600, 100, 500)).toBe(101)
    expect(revealScrollLeft(2000, 100, 500)).toBe(1501)
  })
})
