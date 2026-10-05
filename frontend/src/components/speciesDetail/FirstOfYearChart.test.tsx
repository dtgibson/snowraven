// @vitest-environment jsdom
/// <reference types="node" />
// The First of Year chart (species-first-of-year), rendered with REAL Recharts
// under jsdom: QA-22 (points, segments and the break at a gap year, read off
// the drawn path rather than off the props), QA-23 (tokens only), QA-24 (one
// accessible name, no focusable element inside), QA-26 (no tooltip, no
// handlers of its own), and the row-driven highlight. jsdom lays nothing out,
// so the box's measured width is stubbed on the element the chart measures;
// the real-engine checks (320px and 200% text, both themes, both engines) are
// QA-29's and belong to the Tester.
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, render, waitFor } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { FirstOfYearRow } from '../../lib/firstOfYear'
import {
  buildFirstOfYearChartData, firstOfYearChartHeight, firstOfYearChartMaxWidth, segmentsOf,
} from '../../lib/firstOfYearChartGeometry'
import { FirstOfYearChart } from './FirstOfYearChart'

// recharts arms Redux Toolkit's 100 ms autoBatch fallback timer on mount; wait
// it out before this file's jsdom environment is torn down (testing.md).
afterAll(() => new Promise(r => setTimeout(r, 120)))
afterEach(cleanup)

const NAME = 'First of year, one point per year by day of year. The dates are listed in this section.'

// jsdom defines clientWidth on Element.prototype (always 0); an own property on
// HTMLElement.prototype shadows it for the box the chart measures, and is
// deleted again after each test.
let boxWidth = 420
beforeEach(() => {
  boxWidth = 420
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
    configurable: true,
    get(this: HTMLElement) { return this.classList.contains('sr-foy-chart') ? boxWidth : 0 },
  })
})
afterEach(() => { delete (HTMLElement.prototype as { clientWidth?: number }).clientWidth })

const row = (date: string, submissionId = `S${date.slice(0, 4)}`): FirstOfYearRow => {
  const [y, m, d] = date.split('-').map(Number)
  const before = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334][m - 1]
  const leap = y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0)
  return { year: y, date, dayOfYear: before + d + (m > 2 && leap ? 1 : 0), submissionId }
}

// Swainson's Thrush, the design's data: 2017 to 2026 with 2020 and 2022 missing,
// so 2021 is a lone point between two gap years.
const EIGHT = [
  row('2017-04-22'), row('2018-04-18'), row('2019-04-27'), row('2021-04-15'),
  row('2023-04-29'), row('2024-04-13'), row('2025-04-21'), row('2026-05-02'),
]

async function drawn(rows: FirstOfYearRow[], opts: { wide?: boolean; activeYear?: number | null } = {}) {
  const data = buildFirstOfYearChartData(rows)
  const utils = render(<FirstOfYearChart data={data} wide={opts.wide ?? true} activeYear={opts.activeYear ?? null} />)
  const wrapper = utils.container.querySelector('.sr-foy-chart') as HTMLElement
  await waitFor(() => expect(wrapper.querySelectorAll('.sr-foy-dot').length).toBe(rows.length))
  return { ...utils, data, wrapper }
}

describe('the box and its accessible name (FR-23, FR-24, QA-24)', () => {
  it('is one role="img" with the one name, at the geometry module\'s height and max width', async () => {
    const { wrapper, data, getAllByRole } = await drawn(EIGHT)
    expect(getAllByRole('img')).toEqual([wrapper])
    expect(wrapper.getAttribute('aria-label')).toBe(NAME)
    expect(wrapper.style.height).toBe(`${firstOfYearChartHeight(true)}px`)
    expect(wrapper.style.maxWidth).toBe(`${firstOfYearChartMaxWidth(data.yearTicks.length)}px`)
  })

  it('is the phone tier\'s height on a phone', async () => {
    const { wrapper } = await drawn(EIGHT, { wide: false })
    expect(wrapper.style.height).toBe('182px')
  })

  it('holds everything it draws under one aria-hidden, inert layer with nothing focusable', async () => {
    const { wrapper } = await drawn(EIGHT)
    const inner = wrapper.firstElementChild as HTMLElement
    expect(wrapper.children).toHaveLength(1)
    expect(inner.getAttribute('aria-hidden')).toBe('true')
    expect(inner.hasAttribute('inert')).toBe(true)
    const svg = inner.querySelector('svg.recharts-surface')!
    expect(svg).toBeTruthy()
    // accessibilityLayer={false}: the root svg takes no tab stop of its own.
    expect(svg.hasAttribute('tabindex')).toBe(false)
    // Nothing in the tab order. Recharts stamps tabindex="-1" on some of its
    // layers, which is out of the tab order already, and the inert layer
    // above them takes even scripted focus away in a real engine.
    expect(wrapper.querySelectorAll('a[href], button, input, select, textarea, [contenteditable], [tabindex]:not([tabindex="-1"])')).toHaveLength(0)
    for (const el of wrapper.querySelectorAll('[tabindex]')) expect(inner.contains(el)).toBe(true)
  })

  it('draws nothing inside the reserved box until the box has a width', () => {
    boxWidth = 0
    const { container } = render(<FirstOfYearChart data={buildFirstOfYearChartData(EIGHT)} wide activeYear={null} />)
    const wrapper = container.querySelector('.sr-foy-chart') as HTMLElement
    expect(wrapper.style.height).toBe('232px')
    expect(wrapper.querySelector('svg')).toBeNull()
  })
})

describe('points, segments and gaps, as drawn (FR-21, QA-22)', () => {
  it('draws one dot per year row and breaks the line at every gap year', async () => {
    const { wrapper, data } = await drawn(EIGHT)
    expect(wrapper.querySelectorAll('.sr-foy-dot')).toHaveLength(8)
    expect(wrapper.querySelectorAll('.sr-foy-halo')).toHaveLength(8)
    const d = wrapper.querySelector('path.recharts-line-curve')!.getAttribute('d')!
    // A straight segment is one "L"; each run of consecutive years opens with
    // one "M". segmentsOf states the same rule as data, and the two agree.
    const segments = segmentsOf(data.points)
    expect(segments).toEqual([[2017, 2018], [2018, 2019], [2023, 2024], [2024, 2025], [2025, 2026]])
    expect(d.match(/L/g) ?? []).toHaveLength(segments.length)
    expect(d.match(/M/g) ?? []).toHaveLength(3)   // 2017-2019, 2021 alone, 2023-2026
    // Straight lines between years, never a curve.
    expect(d).not.toMatch(/[CQS]/)
  })

  it('marks the lone point, and only it, as lone', async () => {
    const { wrapper } = await drawn(EIGHT)
    const lone = [...wrapper.querySelectorAll('.sr-foy-dot.is-lone')]
    expect(lone).toHaveLength(1)
    expect(lone[0].getAttribute('r')).toBe('5')
    // The lone point is 2021's: the fourth dot in year order.
    expect([...wrapper.querySelectorAll('.sr-foy-dot')].indexOf(lone[0])).toBe(3)
  })

  it('two consecutive years are one segment and no lone point', async () => {
    const { wrapper } = await drawn([row('2025-04-21'), row('2026-05-02')])
    const d = wrapper.querySelector('path.recharts-line-curve')!.getAttribute('d')!
    expect(d.match(/L/g) ?? []).toHaveLength(1)
    expect(wrapper.querySelectorAll('.sr-foy-dot.is-lone')).toHaveLength(0)
  })

  it('places later days higher: day of year increases upward', async () => {
    const { wrapper } = await drawn([row('2025-01-10'), row('2026-11-30')])
    const [jan, nov] = [...wrapper.querySelectorAll('.sr-foy-dot')].map(c => Number(c.getAttribute('cy')))
    expect(nov).toBeLessThan(jan)
  })
})

describe('the axes\' labels (FR-19, FR-20)', () => {
  it('labels the quarters and December up the side', async () => {
    const { wrapper } = await drawn(EIGHT)
    const labels = [...wrapper.querySelectorAll('text.sr-foy-tick')].map(t => t.textContent)
    for (const m of ['Jan', 'Apr', 'Jul', 'Oct', 'Dec']) expect(labels).toContain(m)
    expect(labels.filter(l => /^[A-Z][a-z]{2}$/.test(l ?? ''))).toHaveLength(5)
  })

  it('labels every year where the box has room, and thins them where it does not', async () => {
    const years = (w: HTMLElement) => [...w.querySelectorAll('text.sr-foy-tick')]
      .map(t => t.textContent ?? '').filter(t => /^\d{4}$/.test(t))
    const wide = await drawn(EIGHT)
    expect(years(wide.wrapper)).toEqual(['2017', '2018', '2019', '2020', '2021', '2022', '2023', '2024', '2025', '2026'])
    cleanup()
    boxWidth = 240
    const narrow = await drawn(EIGHT)
    expect(years(narrow.wrapper)).toEqual(['2017', '2019', '2021', '2023', '2026'])
  })
})

describe('the row-driven highlight (design-spec.md, Interaction Notes)', () => {
  it('lights the active year\'s dot, halo and label, and nothing else', async () => {
    const { wrapper } = await drawn(EIGHT, { activeYear: 2024 })
    const dots = [...wrapper.querySelectorAll('.sr-foy-dot')]
    const active = dots.filter(c => c.classList.contains('is-active'))
    expect(active).toHaveLength(1)
    expect(dots.indexOf(active[0])).toBe(5)   // 2024
    expect(active[0].getAttribute('r')).toBe('6')
    expect(wrapper.querySelectorAll('.sr-foy-halo.is-active')).toHaveLength(1)
    expect([...wrapper.querySelectorAll('text.sr-foy-tick.is-active')].map(t => t.textContent)).toEqual(['2024'])
  })

  it('lights nothing when no row is active', async () => {
    const { wrapper } = await drawn(EIGHT)
    expect(wrapper.querySelectorAll('.is-active')).toHaveLength(0)
  })
})

describe('no interaction of its own, no tooltip, tokens only (FR-22, FR-25, QA-23, QA-26)', () => {
  const src = readFileSync(resolve(process.cwd(), 'src/components/speciesDetail/FirstOfYearChart.tsx'), 'utf8')   // vitest's cwd is frontend/
  const code = src.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').filter(l => !l.trim().startsWith('//')).join('\n')

  it('renders no tooltip', async () => {
    const { wrapper } = await drawn(EIGHT)
    expect(wrapper.querySelector('.recharts-tooltip-wrapper')).toBeNull()
    expect(code).not.toMatch(/\bTooltip\b/)
  })

  it('passes no pointer, key or focus handler and no tab stop to anything it draws', () => {
    expect(code).toContain('export function FirstOfYearChart(')   // the scan reads the real module
    expect(code).not.toMatch(/\bon[A-Z][A-Za-z]*=/)
    expect(code).not.toMatch(/tabIndex/)
    expect(code).toMatch(/accessibilityLayer=\{false\}/)
    expect(code).toMatch(/activeDot=\{false\}/)
    expect(code).toMatch(/isAnimationActive=\{false\}/)
  })

  it('writes every color as a var(--sr-*) token', () => {
    expect(code).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
    expect(code).not.toMatch(/\b(?:rgba?|hsla?)\(/)
    expect(code).not.toMatch(/['"](?:white|black|red|green|blue|gray|grey|transparent|currentColor)['"]/)
    const colors = [...code.matchAll(/(?:stroke|fill)="([^"]+)"/g)].map(m => m[1])
    expect(colors.length).toBeGreaterThan(0)
    for (const c of colors) expect(c === 'none' || /^var\(--sr-[a-z0-9-]+\)$/.test(c), c).toBe(true)
  })

  it('carries no em dash', () => {
    expect(src).not.toContain('\u2014')
  })
})
