// @vitest-environment jsdom
/// <reference types="node" />
// The First of Year card (species-first-of-year): QA-11 to QA-19, QA-23 to
// QA-26 and QA-31 in prd.md, on the section alone. The chart here is the REAL
// lazy module, held back behind a gate for the first test so the Suspense
// fallback can be measured against the chart that replaces it (QA-25). The tab
// itself (placement, filter parity, the First seen invariant on screen) is
// components/SpeciesDetailFirstOfYear.test.tsx.
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { FirstOfYearRow } from '../../lib/firstOfYear'
import { formatDate, setDateFormatPref, getDateFormatPref, type DateFormatPref } from '../../lib/formatDate'
import { firstOfYearChartHeight, firstOfYearChartMaxWidth } from '../../lib/firstOfYearChartGeometry'
import { installExactMatchMedia, PHONE_MEDIA_QUERY, type ExactMatchMediaStub } from '../../test/matchMedia'
import { installTauriOpener } from '../../test/tauriOpener'

const gate = vi.hoisted(() => {
  let open = () => {}
  const opened = new Promise<void>(r => { open = r })
  return { opened, open: () => open() }
})
vi.mock('./FirstOfYearChart', async (importOriginal) => {
  await gate.opened
  return importOriginal()
})

import { FirstOfYearSection } from './FirstOfYearSection'

// The real chart mounts Recharts: wait out its 100 ms autoBatch timer before
// this file's jsdom environment is torn down (testing.md).
afterAll(() => new Promise(r => setTimeout(r, 120)))

const CHART_NAME = 'First of year, one point per year by day of year. The dates are listed in this section.'
const NOTE = 'First dates within the selected date range.'
const READ = (p: string) => readFileSync(resolve(process.cwd(), p), 'utf8')   // vitest's cwd is frontend/
const code = (p: string) => READ(p).replace(/\/\*[\s\S]*?\*\//g, '').split('\n').filter(l => !l.trim().startsWith('//')).join('\n')

// The chart measures its box; jsdom lays nothing out (see FirstOfYearChart.test.tsx).
beforeEach(() => {
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
    configurable: true,
    get(this: HTMLElement) { return this.classList.contains('sr-foy-chart') ? 420 : 0 },
  })
})
let media: ExactMatchMediaStub | null = null
const prefBefore = getDateFormatPref()
afterEach(() => {
  gate.open()   // idempotent: a failure in the gated first test must not stall the rest
  cleanup()
  delete (HTMLElement.prototype as { clientWidth?: number }).clientWidth
  media?.restore()
  media = null
  setDateFormatPref(prefBefore)
  vi.unstubAllGlobals()
})

const row = (date: string, submissionId: string): FirstOfYearRow => {
  const [y, m, d] = date.split('-').map(Number)
  const before = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334][m - 1]
  const leap = y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0)
  return { year: y, date, dayOfYear: before + d + (m > 2 && leap ? 1 : 0), submissionId }
}
// Ascending by year, as computeFirstOfYear returns them.
const THREE = [row('2019-04-27', 'S55310877'), row('2021-04-15', 'S85120933'), row('2024-04-13', 'S168245901')]

const rowsOf = (c: HTMLElement) => [...c.querySelectorAll<HTMLLIElement>('li.sr-foy-row')]

describe('the reserved box (FR-24, QA-25); first, while the chart chunk is held back', () => {
  it('reserves the chart\'s exact box, wide and phone, and the chart lands in it', async () => {
    const wideView = render(<FirstOfYearSection rows={THREE} dateRangeActive={false} />)
    const wideFallback = wideView.container.querySelector('.sr-foy-chart') as HTMLElement
    expect(wideFallback).toBeTruthy()
    expect(wideFallback.getAttribute('role')).toBeNull()      // empty: the name arrives with the chart
    expect(wideFallback.style.height).toBe(`${firstOfYearChartHeight(true)}px`)
    expect(wideFallback.style.maxWidth).toBe(`${firstOfYearChartMaxWidth(6)}px`)   // 2019 to 2024
    // The rows render without the chart chunk (NFR-07).
    expect(rowsOf(wideView.container)).toHaveLength(3)
    cleanup()

    media = installExactMatchMedia({ [PHONE_MEDIA_QUERY]: true })
    const phoneView = render(<FirstOfYearSection rows={THREE} dateRangeActive={false} />)
    const phoneFallback = phoneView.container.querySelector('.sr-foy-chart') as HTMLElement
    expect(phoneFallback.style.height).toBe(`${firstOfYearChartHeight(false)}px`)
    const grid = phoneView.container.querySelector('.sr-foy-grid')!
    expect(grid.firstElementChild).toBe(phoneFallback)

    gate.open()
    const chart = await screen.findByRole('img', { name: CHART_NAME })
    // The same box in the same place: first in the grid, same height, same cap.
    expect(grid.firstElementChild).toBe(chart)
    expect(chart.style.height).toBe(phoneFallback.style.height)
    expect(chart.style.maxWidth).toBe(phoneFallback.style.maxWidth)
    expect(chart.className).toBe(phoneFallback.className)
  })
})

describe('states (FR-10, FR-11, FR-18: QA-11, QA-19)', () => {
  it('renders nothing at all for zero rows', () => {
    const { container } = render(<FirstOfYearSection rows={[]} dateRangeActive />)
    expect(container.firstChild).toBeNull()
  })

  it('one row: the heading and that row, and no chart, placeholder or sentence', () => {
    const { container } = render(<FirstOfYearSection rows={[row('2026-05-02', 'S275530184')]} dateRangeActive={false} />)
    expect(container.querySelector('.sr-foy-chart')).toBeNull()
    expect(screen.queryByRole('img')).toBeNull()
    expect(container.querySelector('.sr-foy-grid')!.classList.contains('sr-foy-grid--rows-only')).toBe(true)
    expect(rowsOf(container)).toHaveLength(1)
    // Nothing but the heading and the one row's year and date.
    expect(container.textContent).toBe(`First of Year2026${formatDate('2026-05-02')}`)
  })

  it('two rows: the chart', async () => {
    const { container } = render(<FirstOfYearSection rows={THREE.slice(1)} dateRangeActive={false} />)
    expect(await screen.findByRole('img', { name: CHART_NAME })).toBeTruthy()
    expect(container.querySelector('.sr-foy-grid')!.classList.contains('sr-foy-grid--rows-only')).toBe(false)
  })
})

describe('the rows (FR-12, FR-13, FR-14, FR-15: QA-12 to QA-15)', () => {
  it('runs newest year first', () => {
    const { container } = render(<FirstOfYearSection rows={THREE} dateRangeActive={false} />)
    expect(rowsOf(container).map(li => li.querySelector('.sr-foy-year')!.textContent)).toEqual(['2024', '2021', '2019'])
  })

  for (const pref of ['month-first', 'day-first', 'iso'] as DateFormatPref[]) {
    it(`shows the year and the date in the ${pref} format, and nothing else`, () => {
      setDateFormatPref(pref)
      const { container } = render(<FirstOfYearSection rows={THREE} dateRangeActive={false} />)
      const rows = rowsOf(container)
      expect(rows).toHaveLength(3)
      for (const [i, r] of [...THREE].reverse().entries()) {
        // The whole row's text: no day-of-year number, no marker.
        expect(rows[i].textContent).toBe(`${r.date.slice(0, 4)}${formatDate(r.date)}`)
      }
      // Non-vacuity: the three formats really differ.
      if (pref === 'iso') expect(formatDate('2024-04-13')).toBe('2024-04-13')
      if (pref === 'day-first') expect(formatDate('2024-04-13')).toBe('13 Apr 2024')
    })
  }

  it('makes each date a checklist link with the shared name, and a junk id plain text', () => {
    const rows = [row('2019-04-27', 'junk'), row('2024-04-13', 'S168245901')]
    const { container } = render(<FirstOfYearSection rows={rows} dateRangeActive={false} />)
    const [newest, oldest] = rowsOf(container)
    const link = within(newest).getByRole('link')
    expect(link).toHaveProperty('href', 'https://ebird.org/checklist/S168245901')
    expect(link.getAttribute('aria-label')).toBe(`${formatDate('2024-04-13')}: open checklist on eBird (opens in a new tab)`)
    expect(link.getAttribute('target')).toBe('_blank')
    expect(within(oldest).queryByRole('link')).toBeNull()
    expect(oldest.querySelector('a')).toBeNull()
    expect(oldest.textContent).toBe(`2019${formatDate('2019-04-27')}`)
  })

  it('labels a year-0000 date with the raw date string, which formatDate leaves empty (Auditor note)', () => {
    for (const pref of ['month-first', 'day-first', 'iso'] as DateFormatPref[]) {
      setDateFormatPref(pref)
      expect(formatDate('0000-01-15')).toBe('')   // non-vacuity: the fallback is what fills the label
      const { container } = render(<FirstOfYearSection rows={[row('0000-01-15', 'S275530184')]} dateRangeActive={false} />)
      const link = within(rowsOf(container)[0]).getByRole('link')
      expect(link.textContent).toBe('0000-01-15')
      expect(link.getAttribute('aria-label')).toBe('0000-01-15: open checklist on eBird (opens in a new tab)')
      cleanup()
    }
  })

  it('gives the current year\'s row nothing the others lack (OQ-01 default)', () => {
    const year = new Date().getFullYear()   // the test may read the clock; the section does not
    const rows = [row(`${year - 2}-04-20`, 'S1'), row(`${year - 1}-04-18`, 'S2'), row(`${year}-04-15`, 'S3')]
    const { container } = render(<FirstOfYearSection rows={rows} dateRangeActive={false} />)
    const shapes = rowsOf(container).map(li => ({
      cls: li.className,
      kids: [...li.children].map(c => `${c.tagName}.${c.className}`),
      name: li.querySelector('a')!.getAttribute('aria-label')!.replace(/^.*?:/, ''),
    }))
    expect(new Set(shapes.map(s => JSON.stringify(s))).size).toBe(1)
    const src = code('src/components/speciesDetail/FirstOfYearSection.tsx')
    expect(src).not.toMatch(/\bDate\b|getFullYear|performance\.now/)
  })

  it('a click on a row\'s link sends that row\'s own checklist to the opener, once (QA-16)', () => {
    const { container } = render(<FirstOfYearSection rows={THREE} dateRangeActive={false} />)
    const opener = installTauriOpener()
    try {
      const link = within(rowsOf(container)[1]).getByRole('link')   // 2021, not the first row
      expect(fireEvent.click(link)).toBe(false)
      expect(opener.calls()).toEqual([{ url: 'https://ebird.org/checklist/S85120933', via: 'own' }])
    } finally {
      opener.uninstall()
    }
  })
})

describe('the date-range note and the heading (FR-16, QA-17)', () => {
  it('shows the note only while a date range is set, and the heading never claims more', () => {
    const off = render(<FirstOfYearSection rows={THREE} dateRangeActive={false} />)
    expect(off.queryByText(NOTE)).toBeNull()
    expect(off.getByText('First of Year')).toBeTruthy()
    off.unmount()
    const on = render(<FirstOfYearSection rows={THREE} dateRangeActive />)
    const note = on.getByText(NOTE)
    expect(note.tagName).toBe('P')
    expect(note.className).toBe('sr-foy-note')
    expect(on.getByText('First of Year')).toBeTruthy()
    expect(on.container.textContent).not.toMatch(/of the year/i)
  })
})

describe('the row-driven highlight (design-spec.md, Interaction Notes)', () => {
  async function ready() {
    const view = render(<FirstOfYearSection rows={THREE} dateRangeActive={false} />)
    const chart = await screen.findByRole('img', { name: CHART_NAME })
    await waitFor(() => expect(chart.querySelectorAll('.sr-foy-dot')).toHaveLength(3))
    const active = () => [...chart.querySelectorAll('.sr-foy-dot')].findIndex(c => c.classList.contains('is-active'))
    return { ...view, chart, active }
  }

  it('hovering a row lights its year\'s point, and leaving clears it', async () => {
    const { container, active } = await ready()
    const [r2024, r2021] = rowsOf(container)
    fireEvent.mouseEnter(r2021)
    await waitFor(() => expect(active()).toBe(1))   // dots run in year order: 2019, 2021, 2024
    fireEvent.mouseLeave(r2021)
    await waitFor(() => expect(active()).toBe(-1))
    fireEvent.mouseEnter(r2024)
    await waitFor(() => expect(active()).toBe(2))
  })

  it('focusing a row\'s link lights its point; hover wins while it lasts, and focus returns after', async () => {
    const { container, active } = await ready()
    const [r2024, , r2019] = rowsOf(container)
    act(() => within(r2024).getByRole('link').focus())
    await waitFor(() => expect(active()).toBe(2))
    fireEvent.mouseEnter(r2019)
    await waitFor(() => expect(active()).toBe(0))
    fireEvent.mouseLeave(r2019)
    await waitFor(() => expect(active()).toBe(2))
    act(() => within(r2024).getByRole('link').blur())
    await waitFor(() => expect(active()).toBe(-1))
  })

  it('the chart itself adds no tab stop (QA-24)', async () => {
    const { chart, container } = await ready()
    const tabbable = 'a[href], button, input, select, textarea, [contenteditable], [tabindex]:not([tabindex="-1"])'
    expect(chart.querySelectorAll(tabbable)).toHaveLength(0)
    // Every stop in the section is a row's link, in row order.
    expect([...container.querySelectorAll(tabbable)].map(a => a.getAttribute('href'))).toEqual([
      'https://ebird.org/checklist/S168245901', 'https://ebird.org/checklist/S85120933', 'https://ebird.org/checklist/S55310877',
    ])
  })
})

describe('reads nothing beyond its props (NFR-04, QA-31)', () => {
  it('makes no fetch while rendering rows and chart', async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    render(<FirstOfYearSection rows={THREE} dateRangeActive />)
    await screen.findByRole('img', { name: CHART_NAME })
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('the feature\'s modules import no transport, storage, replay, clear or iCloud seam and call no fetch', () => {
    const files = [
      'src/lib/firstOfYear.ts', 'src/lib/firstOfYearChartGeometry.ts',
      'src/components/speciesDetail/FirstOfYearSection.tsx', 'src/components/speciesDetail/FirstOfYearChart.tsx',
    ]
    for (const f of files) {
      const src = code(f)
      expect(src, f).toMatch(/export (function|const|type)/)   // the scan reads the real module
      expect(src, f).not.toMatch(/\bfetch\(|\btransport\b|\bstorage\b|replayStore|clearDerived|icloud|localStorage|lib\/tauri/i)
    }
  })
})

describe('tokens only, no em dash (FR-22, NFR-02, NFR-05: QA-23, QA-32)', () => {
  it('the section source writes no color literal', () => {
    const src = code('src/components/speciesDetail/FirstOfYearSection.tsx')
    expect(src).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
    expect(src).not.toMatch(/\b(?:rgba?|hsla?)\(/)
    expect(src).not.toMatch(/\b(?:color|background|fill|stroke)\s*:\s*['"](?!var\(--sr-)/)
  })

  it('every color in the .sr-foy- rules is a --sr- token defined in both themes', () => {
    const css = READ('src/globals.css').replace(/\/\*[\s\S]*?\*\//g, '')
    const blocks = [...css.matchAll(/([^{}]*\.sr-foy-[^{}]*)\{([^{}]*)\}/g)]
    expect(blocks.length).toBeGreaterThan(10)   // the rules really were found
    const tokens = new Set<string>()
    for (const [, selector, body] of blocks) {
      for (const decl of body.split(';')) {
        const [prop, ...rest] = decl.split(':')
        const value = rest.join(':').trim()
        if (!/color|background|fill|stroke$|^\s*stroke\b|border/.test(prop)) continue
        expect(value, `${selector.trim()} ${prop.trim()}`).not.toMatch(/#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?)\(|\b(?:white|black|transparent)\b/)
      }
      for (const m of body.matchAll(/var\((--sr-[a-z0-9-]+)\)/g)) tokens.add(m[1])
    }
    expect(tokens.size).toBeGreaterThan(3)
    const block = (sel: string) => {
      const at = css.indexOf(`${sel} {`)
      expect(at, sel).toBeGreaterThan(-1)
      return css.slice(at, css.indexOf('}', at))
    }
    const light = block(':root')
    const dark = block('[data-theme="dark"]')
    for (const t of tokens) {
      expect(light, `${t} in :root`).toContain(`${t}:`)
      expect(dark, `${t} in dark`).toContain(`${t}:`)
    }
  })

  it('the phone-tier declarations sit inside the established 640px tier block', () => {
    const css = READ('src/globals.css')
    const open = css.indexOf('\n@media (max-width: 640px) {\n')
    expect(open).toBeGreaterThan(-1)
    let depth = 0
    let end = -1
    for (let i = css.indexOf('{', open); i < css.length; i++) {
      if (css[i] === '{') depth += 1
      else if (css[i] === '}') { depth -= 1; if (depth === 0) { end = i; break } }
    }
    const tier = css.slice(open, end)
    expect(tier).toMatch(/\.sr-foy-grid \{ flex-direction: column;/)
    expect(tier).toMatch(/\.sr-foy-chart \{ flex: none; \}/)
    expect(tier).toMatch(/\.sr-foy-row \{ min-height: 2\.5rem; \}/)
  })

  it('carries no em dash in the section, the chart, the two lib modules or the stylesheet rules', () => {
    for (const f of [
      'src/lib/firstOfYear.ts', 'src/lib/firstOfYearChartGeometry.ts',
      'src/components/speciesDetail/FirstOfYearSection.tsx', 'src/components/speciesDetail/FirstOfYearChart.tsx',
    ]) expect(READ(f), f).not.toContain('\u2014')
  })
})
