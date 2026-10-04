/// <reference types="node" />
// The First of Year chart's geometry (species-first-of-year): QA-20, QA-21 and
// QA-22 in prd.md, the box the Suspense fallback reserves (FR-24), the year
// label thinning design-spec.md states, and the bound on the one loop driven by
// a number read from user text (schema.md 7.2).
import { describe, expect, it } from 'vitest'
import type { FirstOfYearRow } from './firstOfYear'
import { computeFirstOfYear } from './firstOfYear'
import { MONTH_ABBR } from './sightingsGraph'
import {
  FOY_AXIS_LANE_PX, FOY_GUTTER_PX, FOY_LABEL_MIN_GAP_PX, FOY_MONTH_STARTS, FOY_PLOT_PX, FOY_RIGHT_PX,
  FOY_TOP_PX, FOY_WIDE_PLOT_PX, FOY_X_PAD_PX, FOY_Y_DOMAIN, FOY_YEAR_LABEL_PX,
  buildFirstOfYearChartData, firstOfYearChartHeight, firstOfYearChartMaxWidth, firstOfYearPlotHeight,
  firstOfYearYearPitch, monthTicks, segmentsOf, yearLabelYears,
} from './firstOfYearChartGeometry'

const row = (year: number, dayOfYear = 100): FirstOfYearRow => ({
  year, dayOfYear, date: `${String(year).padStart(4, '0')}-04-10`, submissionId: `S${year}`,
})

describe('the box (FR-24)', () => {
  it('is 182px tall on a phone and 232px wide, from the design\'s lanes', () => {
    expect(FOY_PLOT_PX).toBe(150)
    expect(FOY_WIDE_PLOT_PX).toBe(200)
    expect(firstOfYearPlotHeight(false)).toBe(FOY_PLOT_PX)
    expect(firstOfYearPlotHeight(true)).toBe(FOY_WIDE_PLOT_PX)
    expect(firstOfYearChartHeight(false)).toBe(FOY_TOP_PX + FOY_PLOT_PX + FOY_AXIS_LANE_PX)
    expect(firstOfYearChartHeight(false)).toBe(182)
    expect(firstOfYearChartHeight(true)).toBe(232)
  })

  it('caps its width by the years it spans: 260 for two, 428 for four, 1,148 for ten', () => {
    // design-spec.md's formula, max(260, 34 + 14 + 2 * 10 + (years - 1) * 120).
    // Its prose gave ten years as 1,160; the formula gives 1,148 (decisions.md).
    expect(firstOfYearChartMaxWidth(1)).toBe(260)
    expect(firstOfYearChartMaxWidth(2)).toBe(260)
    expect(firstOfYearChartMaxWidth(4)).toBe(428)
    expect(firstOfYearChartMaxWidth(10)).toBe(1148)
    for (let n = 1; n < 40; n++) expect(firstOfYearChartMaxWidth(n + 1)).toBeGreaterThanOrEqual(firstOfYearChartMaxWidth(n))
  })

  it('spaces years across the plot inside its gutters and padding', () => {
    const range = 500 - FOY_GUTTER_PX - FOY_RIGHT_PX - 2 * FOY_X_PAD_PX
    expect(firstOfYearYearPitch(500, 2)).toBe(range)
    expect(firstOfYearYearPitch(500, 5)).toBe(range / 4)
    expect(firstOfYearYearPitch(0, 5)).toBe(0)
    expect(firstOfYearYearPitch(60, 5)).toBe(0)
  })
})

describe('the year axis (FR-19, QA-20)', () => {
  it('spans every integer year from the earliest row to the latest, one tick each', () => {
    const data = buildFirstOfYearChartData([row(2017), row(2023)])
    expect(data.yearDomain).toEqual([2017, 2023])
    expect(data.yearTicks).toEqual([2017, 2018, 2019, 2020, 2021, 2022, 2023])
    expect(data.points.map(p => p.year)).toEqual(data.yearTicks)
  })

  it('gives a gap year a place on the axis and no point (QA-07, QA-20)', () => {
    const data = buildFirstOfYearChartData(computeFirstOfYear([
      { ...base, date: '2019-05-01', submissionId: 'S1' },
      { ...base, date: '2021-04-11', submissionId: 'S2' },
      { ...base, date: '2022-04-18', submissionId: 'S3' },
    ]))
    expect(data.yearDomain).toEqual([2019, 2022])
    expect(data.points).toEqual([
      { year: 2019, dayOfYear: 121 },
      { year: 2020, dayOfYear: null },
      { year: 2021, dayOfYear: 101 },
      { year: 2022, dayOfYear: 108 },
    ])
  })

  it('is empty for no rows, and keeps the first of a repeated year', () => {
    expect(buildFirstOfYearChartData([])).toEqual({ points: [], yearDomain: [0, 0], yearTicks: [] })
    const data = buildFirstOfYearChartData([row(2020, 50), row(2020, 90), row(2021, 60)])
    expect(data.points).toEqual([{ year: 2020, dayOfYear: 50 }, { year: 2021, dayOfYear: 60 }])
  })
})

const base = {
  commonName: 'Swainson\'s Thrush', scientificName: 'Catharus ustulatus', location: 'Park', locationId: 'L1',
  latitude: null, longitude: null, county: 'Alpha', count: 1, breedingCode: null, speciesComments: '', catalogIds: [],
}

describe('points and segments (FR-21, QA-22)', () => {
  it('2019, 2021 and 2022 give three points and exactly one segment, 2021 to 2022', () => {
    const data = buildFirstOfYearChartData([row(2019), row(2021), row(2022)])
    expect(data.points.filter(p => p.dayOfYear !== null)).toHaveLength(3)
    expect(segmentsOf(data.points)).toEqual([[2021, 2022]])
  })

  it('joins only consecutive years that both carry a point', () => {
    const data = buildFirstOfYearChartData([row(2010), row(2011), row(2012), row(2014), row(2016), row(2017)])
    expect(segmentsOf(data.points)).toEqual([[2010, 2011], [2011, 2012], [2016, 2017]])
    // 2014 sits between two gap years: no segment on either side.
    const inSegments = new Set(segmentsOf(data.points).flat())
    expect(inSegments.has(2014)).toBe(false)
  })
})

describe('the month axis (FR-20, QA-21)', () => {
  it('labels Jan, Apr, Jul, Oct and Dec at both shipped plot heights', () => {
    for (const plot of [FOY_PLOT_PX, FOY_WIDE_PLOT_PX]) {
      expect(monthTicks(plot).map(t => t.label)).toEqual(['Jan', 'Apr', 'Jul', 'Oct', 'Dec'])
      expect(monthTicks(plot).map(t => t.dayOfYear)).toEqual([1, 92, 183, 275, 336])
    }
  })

  it('always holds January and December, at month starts, never overlapping, at every height', () => {
    const pxPerDay = (plot: number) => plot / (FOY_Y_DOMAIN[1] - FOY_Y_DOMAIN[0])
    let densest = 0
    for (let plot = 20; plot <= 1200; plot++) {
      const ticks = monthTicks(plot)
      expect(ticks[0]).toEqual({ dayOfYear: 1, label: 'Jan' })
      expect(ticks[ticks.length - 1]).toEqual({ dayOfYear: 336, label: 'Dec' })
      for (const t of ticks) {
        const m = FOY_MONTH_STARTS.indexOf(t.dayOfYear)
        expect(m, `${t.dayOfYear} is a month start`).toBeGreaterThanOrEqual(0)
        expect(t.label).toBe(MONTH_ABBR[m])
      }
      for (let i = 1; i < ticks.length; i++) {
        expect((ticks[i].dayOfYear - ticks[i - 1].dayOfYear) * pxPerDay(plot)).toBeGreaterThanOrEqual(FOY_LABEL_MIN_GAP_PX)
      }
      densest = Math.max(densest, ticks.length)
    }
    // Non-vacuity: the sweep reached the twelve-label density.
    expect(densest).toBe(12)
  })

  it('falls back to January and December alone below the room for a step', () => {
    // Below about 33px of plot no intermediate month fits.
    expect(monthTicks(30).map(t => t.label)).toEqual(['Jan', 'Dec'])
  })
})

describe('year label thinning (design-spec.md)', () => {
  const years = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i)

  it('labels every year while the pitch carries a label', () => {
    expect(yearLabelYears(years(2017, 2026), FOY_YEAR_LABEL_PX)).toEqual(years(2017, 2026))
    expect(yearLabelYears(years(2025, 2026), 300)).toEqual([2025, 2026])
  })

  it('at phone width over ten years shows 2017, 2019, 2021, 2023 and 2026', () => {
    // The design's reading: every other year, the last kept, and the neighbor
    // that would collide with it yielding.
    expect(yearLabelYears(years(2017, 2026), 20)).toEqual([2017, 2019, 2021, 2023, 2026])
  })

  it('never puts two labels closer than the budget, and keeps the first and the last', () => {
    for (let n = 2; n <= 60; n++) {
      const ticks = years(2000, 2000 + n - 1)
      for (let width = 200; width <= 1400; width += 10) {
        const pitch = firstOfYearYearPitch(width, n)
        const shown = yearLabelYears(ticks, pitch)
        expect(shown[0], `n=${n} w=${width}`).toBe(ticks[0])
        expect(shown[shown.length - 1]).toBe(ticks[n - 1])
        for (let i = 1; i < shown.length; i++) {
          expect((shown[i] - shown[i - 1]) * pitch).toBeGreaterThanOrEqual(FOY_YEAR_LABEL_PX)
        }
      }
    }
  })

  it('returns a lone year as is', () => {
    expect(yearLabelYears([2024], 0)).toEqual([2024])
    expect(yearLabelYears([], 10)).toEqual([])
  })
})

describe('the span loop is bounded by the geometry module itself (schema.md 7.2)', () => {
  it('clamps the year span to 0..9999, so the loop runs at most 10,000 times', () => {
    const data = buildFirstOfYearChartData([row(-5_000_000), row(5_000_000)])
    expect(data.yearDomain).toEqual([0, 9999])
    expect(data.points).toHaveLength(10_000)
    expect(data.yearTicks).toHaveLength(10_000)
  })

  it('skips a year that is not a finite number', () => {
    const data = buildFirstOfYearChartData([row(Number.NaN), row(Number.POSITIVE_INFINITY), row(2020), row(2022)])
    expect(data.yearDomain).toEqual([2020, 2022])
  })

  it('the widest span a well-formed export can produce is that same 10,000', () => {
    const rows = computeFirstOfYear([
      { ...base, date: '0000-01-01', submissionId: 'S1' },
      { ...base, date: '9999-12-31', submissionId: 'S2' },
    ])
    const data = buildFirstOfYearChartData(rows)
    expect(data.points).toHaveLength(10_000)
    expect(segmentsOf(data.points)).toEqual([])
  })
})
