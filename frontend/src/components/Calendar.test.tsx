// @vitest-environment jsdom
//
// Component-integration coverage for the Calendar tab's user-visible contracts:
// phase gates, the twelve grids, cell states, the metric / view-density / textures
// / spuh toggles, the day popup, and focus behavior. Pure logic is covered in
// lib/calendar.test.ts — these tests are about the component composing it correctly.
// This file mounts NO recharts, so the recharts afterAll-timer rule does not apply.

import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor, within } from '@testing-library/react'
import type { ObservationEntry } from '../types'
import { dayOfWeek } from '../lib/calendar'

function obs(over: Partial<ObservationEntry> & { date: string; submissionId: string; commonName: string }): ObservationEntry {
  return {
    submissionId: over.submissionId,
    commonName: over.commonName,
    scientificName: over.scientificName ?? 'Sci name',
    date: over.date,
    location: over.location ?? 'West Pond',
    locationId: over.locationId ?? 'L1',
    latitude: null,
    longitude: null,
    county: over.county ?? null,
    count: 1,
    breedingCode: null,
    speciesComments: '',
    catalogIds: [],
    // time is optional; supply it only when a test sets it (an explicit null is a
    // timeless export row and must be preserved).
    ...('time' in over ? { time: over.time } : {}),
  }
}

// A dataset spanning 2024 (with a present-but-zero spuh-only day) and 2025.
let observations: ObservationEntry[] = []
function buildDataset(): ObservationEntry[] {
  const rows: ObservationEntry[] = []
  // 2025: a rich data day 2025-03-14 (many species) + a lighter day 2025-03-15.
  // S100 carries a start time (with a leading-zero hour to exercise the trim) and a
  // location; S101 is TIMELESS (time null) to exercise the location-only popup row.
  rows.push(obs({ date: '2025-03-14', submissionId: 'S100', commonName: 'American Robin', time: '07:30 AM', location: 'Point Reyes NS--Bear Valley' }))
  rows.push(obs({ date: '2025-03-14', submissionId: 'S100', commonName: 'Song Sparrow', time: '07:30 AM', location: 'Point Reyes NS--Bear Valley' }))
  rows.push(obs({ date: '2025-03-14', submissionId: 'S101', commonName: 'Blue Jay', time: null, location: 'Abbotts Lagoon' }))
  rows.push(obs({ date: '2025-03-15', submissionId: 'S102', commonName: 'American Crow' }))
  // 2025 spuh-only day → present-but-zero under Species (OFF)
  rows.push(obs({ date: '2025-06-01', submissionId: 'S103', commonName: 'gull sp.' }))
  // 2024 so there are two navigable years. A 2024 Mar-14 checklist reusing an
  // already-seen species keeps the combined Mar-14 species UNION at 3 while making
  // that MM-DD bucket span TWO years (2024 + 2025) → "across 2 years" (QA-35).
  rows.push(obs({ date: '2024-03-14', submissionId: 'S201', commonName: 'American Robin' }))
  rows.push(obs({ date: '2024-04-10', submissionId: 'S200', commonName: 'Mallard' }))
  return rows
}

let filesStatus: { ebird: unknown; ml: unknown } = { ebird: { filename: 'x.csv', uploadedAt: '' }, ml: null }
const { setSetting, getFilesStatus, loadEbird } = vi.hoisted(() => ({
  setSetting: vi.fn(async () => {}),
  // getFilesStatus and loadEbird are hoisted so tests can spy on their call
  // counts (QA-04/41: no re-read on toggle) and force failures (QA-06: error phase).
  getFilesStatus: vi.fn(),
  loadEbird: vi.fn(),
}))

vi.mock('../lib/storage', () => ({
  storage: {
    getFilesStatus,
    setSetting,
    getSetting: vi.fn(async () => null),
  },
}))
vi.mock('../lib/observationsCache', () => ({
  loadEbirdObservations: loadEbird,
}))

import { Calendar } from './Calendar'

const props = { onGoToSettings: () => {}, filesVersion: 0 }

beforeEach(() => {
  filesStatus = { ebird: { filename: 'x.csv', uploadedAt: '' }, ml: null }
  observations = buildDataset()
  setSetting.mockClear()
  // Default happy-path implementations; individual tests override as needed.
  getFilesStatus.mockReset()
  getFilesStatus.mockImplementation(async () => filesStatus)
  loadEbird.mockReset()
  loadEbird.mockImplementation(async () => ({ text: '', observations }))
})
afterEach(cleanup)

describe('Calendar — phase gates (QA-05/06/07)', () => {
  it('shows the setup gate when no eBird backup is stored (QA-05)', async () => {
    filesStatus = { ebird: null, ml: null }
    render(<Calendar {...props} />)
    expect(await screen.findByText('eBird Backup Required')).toBeTruthy()
  })

  it('shows the empty state when there are no dated observations (QA-07)', async () => {
    observations = [obs({ date: 'bad-date', submissionId: 'S1', commonName: 'American Robin' })]
    render(<Calendar {...props} />)
    expect(await screen.findByText('No dated observations found')).toBeTruthy()
  })
})

describe('Calendar — grids and controls (QA-13/24/25/48)', () => {
  it('renders the twelve month grids Jan–Dec (QA-13)', async () => {
    render(<Calendar {...props} />)
    await screen.findByText('January')
    for (const m of ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']) {
      expect(screen.getByText(m)).toBeTruthy()
    }
  })

  it('defaults to Species and the most-recent year (2025), and shows the metric SegControl (QA-25)', async () => {
    render(<Calendar {...props} />)
    await screen.findByText('January')
    const speciesBtn = screen.getByRole('button', { name: 'Species' })
    expect(speciesBtn.getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByRole('button', { name: 'Checklists' }).getAttribute('aria-pressed')).toBe('false')
    // most recent year label present (shown in both the navigator and the view label)
    expect(screen.getAllByText('2025').length).toBeGreaterThan(0)
  })

  it('the legend labels its unit and updates on metric change (QA-24)', async () => {
    render(<Calendar {...props} />)
    await screen.findByText('January')
    expect(screen.getByText('Species / day')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Checklists' }))
    expect(screen.getByText('Checklists / day')).toBeTruthy()
  })

  it('the Total count metric renders, relabels the legend/sub-line, and repaints the grid (change 1)', async () => {
    render(<Calendar {...props} />)
    await screen.findByText('March')
    const totalBtn = screen.getByRole('button', { name: 'Total count' })
    expect(totalBtn.getAttribute('aria-pressed')).toBe('false')
    fireEvent.click(totalBtn)
    expect(totalBtn.getAttribute('aria-pressed')).toBe('true')
    // legend unit switches to individuals
    expect(screen.getByText('Individuals / day')).toBeTruthy()
    // sub-line names individuals
    expect(screen.getByText(/Individuals recorded each day/)).toBeTruthy()
    // the 2025-03-14 rich day (3 species × count 1 = 3 individuals) still reads 3
    expect(screen.getByRole('button', { name: /Mar 14, 2025: 3\. Open day details/ })).toBeTruthy()
  })

  it('Total count honors the include-forms toggle (it is NOT disabled for this metric) (change 1)', async () => {
    render(<Calendar {...props} />)
    await screen.findByText('January')
    fireEvent.click(screen.getByRole('button', { name: 'Total count' }))
    const formsSwitch = screen.getByRole('switch', { name: /Count all forms/ })
    // NOT disabled under Total count (unlike Checklists)
    expect(formsSwitch.getAttribute('aria-disabled')).not.toBe('true')
    expect(formsSwitch.getAttribute('tabindex')).toBe('0')
  })

  it('the View toggle defaults to Compact (big month grids) and Large switches to a 3×4 overview of 12 mini-months (QA-48)', async () => {
    render(<Calendar {...props} />)
    await screen.findByText('January')
    const compactBtn = screen.getByRole('button', { name: 'Compact' })
    const largeBtn = screen.getByRole('button', { name: 'Large' })
    // Default is the big month grids, now labeled "Compact".
    expect(compactBtn.getAttribute('aria-pressed')).toBe('true')
    expect(largeBtn.getAttribute('aria-pressed')).toBe('false')

    // "Large" is the whole-year thumbnail overview: 12 static (non-interactive) mini-
    // months (v0.5.63 removed the cross-view link — they are no longer buttons). Detect
    // them by their .sr-cal-minimonth container, one per month.
    fireEvent.click(largeBtn)
    await waitFor(() => expect(largeBtn.getAttribute('aria-pressed')).toBe('true'))
    const minis = document.querySelectorAll('.sr-cal-minimonth')
    expect(minis).toHaveLength(12)
    // Each names its month as readable text.
    for (const m of ['January', 'February', 'March', 'December']) {
      expect(screen.getByText(m)).toBeTruthy()
    }
  })

  it('the overview MONTH level is NON-interactive — no cross-view link (change 3)', async () => {
    render(<Calendar {...props} />)
    await screen.findByText('January')
    fireEvent.click(screen.getByRole('button', { name: 'Large' }))
    await waitFor(() => expect(document.querySelectorAll('.sr-cal-minimonth')).toHaveLength(12))
    // The v0.5.62 "Open … in the month view" mini-month buttons are gone: no button
    // navigates between the two views. The overview's only buttons are the control-strip
    // toggles and the per-day cells (see the popup test below) — never a whole month.
    expect(screen.queryByRole('button', { name: /in the month view/ })).toBeNull()
    // The March mini-month CARD is a plain container, not a button.
    const marchMini = screen.getByText('March').closest('.sr-cal-minimonth') as HTMLElement
    expect(marchMini.tagName).toBe('DIV')
    // Clicking the card (not a day cell) changes nothing — Large stays selected, no
    // Compact switch, no popup.
    fireEvent.click(marchMini)
    expect(screen.getByRole('button', { name: 'Large' }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByRole('button', { name: 'Compact' }).getAttribute('aria-pressed')).toBe('false')
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('an overview DAY cell opens the same day popup, in place, without switching views (v0.5.63 revision)', async () => {
    render(<Calendar {...props} />)
    await screen.findByText('January')
    fireEvent.click(screen.getByRole('button', { name: 'Large' }))
    await waitFor(() => expect(document.querySelectorAll('.sr-cal-minimonth')).toHaveLength(12))

    // The overview's per-day cells are real buttons with the same accessible-name pattern
    // as the Compact grid (date + count + "Open day details"). The 2025-03-14 rich day
    // lives in the March thumbnail; scope the query to that card so we hit the overview
    // cell, not any Compact cell (Compact isn't mounted in Large mode, but scoping is
    // explicit). It sits inside a .sr-cal-minimonth (proving it's the overview trigger).
    const dayBtn = screen.getByRole('button', { name: /Mar 14, 2025: 3\. Open day details/ })
    expect(dayBtn.closest('.sr-cal-minimonth')).toBeTruthy()

    fireEvent.click(dayBtn)
    // The SAME single day popup opens — same content contract as the Compact path.
    const dialog = await screen.findByRole('dialog', { name: /Day details for \w{3}, Mar 14, 2025/ })
    expect(within(dialog).getByText('species')).toBeTruthy()
    expect(within(dialog).getByText('checklists')).toBeTruthy()
    const links = within(dialog).getAllByRole('link', { name: /open checklist on eBird/ })
    expect(links[0].getAttribute('href')).toContain('/checklist/S100')

    // View did NOT switch — still Large, and the mini-months are still mounted behind the
    // popup (opening a day popup is in place, never a Compact jump).
    expect(screen.getByRole('button', { name: 'Large' }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByRole('button', { name: 'Compact' }).getAttribute('aria-pressed')).toBe('false')
    expect(document.querySelectorAll('.sr-cal-minimonth')).toHaveLength(12)

    // Escape closes it and restores focus to the activating overview cell.
    fireEvent.keyDown(document, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    await waitFor(() => expect(document.activeElement).toBe(dayBtn))
    // Still Large after the popup closes.
    expect(screen.getByRole('button', { name: 'Large' }).getAttribute('aria-pressed')).toBe('true')
  })

  it('an overview present-but-zero DAY cell opens its popup too (parity with Compact)', async () => {
    render(<Calendar {...props} />)
    await screen.findByText('January')
    fireEvent.click(screen.getByRole('button', { name: 'Large' }))
    await waitFor(() => expect(document.querySelectorAll('.sr-cal-minimonth')).toHaveLength(12))
    // The 2025-06-01 spuh-only day is present-but-zero under Species; its overview cell
    // carries the same accessible name as the Compact zero cell and opens the popup.
    const zeroBtn = screen.getByRole('button', { name: /Jun 1, 2025: birded, 0 countable species\. Open day details/ })
    expect(zeroBtn.closest('.sr-cal-minimonth')).toBeTruthy()
    fireEvent.click(zeroBtn)
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('species')).toBeTruthy()
  })
})

// Install a matchMedia stub that reports the phone media query (max-width:640px) as
// matching. Returns a restore fn. The Calendar no longer forces a mode by width (the
// v0.5.61/v0.5.64 phone force + phone-only date corner were removed in v0.5.68), so this
// only proves the view toggle is width-agnostic: matching the phone query changes nothing
// about which view mounts — the toggle governs at every width.
function stubPhoneMatchMedia(matches: boolean) {
  const orig = window.matchMedia
  window.matchMedia = ((query: string) => ({
    matches: query.includes('max-width:640px') ? matches : false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia
  return () => { window.matchMedia = orig }
}

describe('Calendar — the View toggle governs at ALL widths, including a phone (v0.5.68)', () => {
  it('at phone width clicking "Large" DOES mount the mini-month overview (no phone force)', async () => {
    // v0.5.68 removed the phone force (effectiveMode = isPhone ? "months" : viewMode).
    // The toggle now drives the view at every width: even with the ≤640 media query
    // matching, clicking "Large" mounts the 12 mini-month thumbnails (the old behavior
    // pinned Compact on a phone and this branch never rendered).
    const restore = stubPhoneMatchMedia(true)
    try {
      render(<Calendar {...props} />)
      await screen.findByText('January')
      // Default is Compact: the big grids, count-bearing cells, no thumbnails.
      expect(document.querySelectorAll('.sr-cal-minimonth')).toHaveLength(0)
      expect(screen.getByRole('button', { name: /Mar 14, 2025: 3\. Open day details/ })).toBeTruthy()
      // Switch to Large — the mini-months DO mount at phone width now.
      fireEvent.click(screen.getByRole('button', { name: 'Large' }))
      await waitFor(() => expect(document.querySelectorAll('.sr-cal-minimonth')).toHaveLength(12))
      // And back to Compact re-mounts the big grids.
      fireEvent.click(screen.getByRole('button', { name: 'Compact' }))
      await waitFor(() => expect(document.querySelectorAll('.sr-cal-minimonth')).toHaveLength(0))
    } finally {
      restore()
    }
  })

  it('the View toggle container is NOT hidden by any component logic; Large renders the 12 mini-months', async () => {
    render(<Calendar {...props} />)
    await screen.findByText('January')
    // The toggle sits in its .sr-cal-view-toggle container and both segment buttons are in
    // the DOM (no render-time gate; the phone-only CSS display:none hide was removed in
    // v0.5.68, so the toggle is a live control at every width).
    const largeBtn = screen.getByRole('button', { name: 'Large' })
    expect(largeBtn.closest('.sr-cal-view-toggle')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Compact' })).toBeTruthy()
    fireEvent.click(largeBtn)
    expect(document.querySelectorAll('.sr-cal-minimonth')).toHaveLength(12)
  })
})

describe('Calendar — Compact is count-only (no date) and Large is dated (no count) at all widths (v0.5.68)', () => {
  // v0.5.68: the big MonthGrid (Compact) cells carry NO day-of-month date at ANY width —
  // the phone-only .sr-cal-bigday date corner (v0.5.64) was removed. The day-of-month lives
  // only on the Large-view mini-month thumbnails, which are reachable on the phone via the
  // toggle. Compact cells carry the count; Large cells carry date + shade (count on tap).
  it('a Compact data cell carries its count but NO date corner (dateless at every width)', async () => {
    render(<Calendar {...props} />)
    await screen.findByText('March')
    // The 2025-03-14 rich data cell: count 3 (centered visible text + aria-label). There is
    // NO .sr-cal-daynum date corner in the big grid anymore.
    const cell = screen.getByRole('button', { name: /Mar 14, 2025: 3\. Open day details/ })
    expect(cell.querySelector('.sr-cal-daynum')).toBeNull()
    // The visible count "3" is still centered in the cell.
    expect(cell.textContent).toContain('3')
  })

  it('the Compact big grids carry NO day-of-month date anywhere (a whole month card is dateless)', async () => {
    render(<Calendar {...props} />)
    await screen.findByText('March')
    // A month card in the big-grid view has no .sr-cal-daynum spans at all (no-data, zero,
    // and data cells are all dateless — the date moved to the Large thumbnails).
    const marchCard = screen.getByText('March').parentElement as HTMLElement
    expect(marchCard.querySelectorAll('.sr-cal-daynum')).toHaveLength(0)
  })

  it('at phone width the Compact grid is STILL dateless (no phone-only date corner)', async () => {
    // The v0.5.64 phone-only date corner is gone: matching the phone query does not add any
    // .sr-cal-daynum to the big grid. Dates on a phone come from switching to the Large view.
    const restore = stubPhoneMatchMedia(true)
    try {
      render(<Calendar {...props} />)
      await screen.findByText('March')
      expect(document.querySelectorAll('.sr-cal-minimonth')).toHaveLength(0) // Compact by default
      const cell = screen.getByRole('button', { name: /Mar 14, 2025: 3\. Open day details/ })
      expect(cell.querySelector('.sr-cal-daynum')).toBeNull()
    } finally {
      restore()
    }
  })

  it('a Large thumbnail data cell carries its day-of-month number and NO count (date + shade only)', async () => {
    render(<Calendar {...props} />)
    await screen.findByText('January')
    fireEvent.click(screen.getByRole('button', { name: 'Large' }))
    await waitFor(() => expect(document.querySelectorAll('.sr-cal-minimonth')).toHaveLength(12))
    // The March thumbnail contains a dated corner for the 2025-03-14 data day: its
    // .sr-cal-daynum span reads "14". The thumbnail carries NO count — just shade + date;
    // the count lives in the Compact grid and the day popup.
    const marchMini = screen.getByText('March').closest('.sr-cal-minimonth') as HTMLElement
    const dayNums = Array.from(marchMini.querySelectorAll('.sr-cal-daynum')).map(e => e.textContent?.trim())
    expect(dayNums).toContain('14')
    expect(dayNums).toContain('15') // the lighter Mar-15 data day is dated too
    // No metric count leaks into the thumbnail's VISIBLE text: the only text tokens are
    // day-of-month numbers (≤ 31). Mar-14's count (3) is never shown as visible text.
    const visibleText = Array.from(marchMini.querySelectorAll('.sr-cal-daynum')).map(e => e.textContent?.trim())
    expect(visibleText.every(t => t == null || Number(t) <= 31)).toBe(true)
  })

  it('a day tap opens the same DayPopup from BOTH views (Compact and Large)', async () => {
    render(<Calendar {...props} />)
    await screen.findByText('March')
    // From Compact: tap the Mar-14 count cell → the day popup opens.
    fireEvent.click(screen.getByRole('button', { name: /Mar 14, 2025: 3\. Open day details/ }))
    let dialog = await screen.findByRole('dialog', { name: /Day details for \w{3}, Mar 14, 2025/ })
    expect(within(dialog).getByText('species')).toBeTruthy()
    fireEvent.keyDown(document, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())

    // Switch to Large and tap the same day's mini-cell → the SAME popup opens.
    fireEvent.click(screen.getByRole('button', { name: 'Large' }))
    await waitFor(() => expect(document.querySelectorAll('.sr-cal-minimonth')).toHaveLength(12))
    const dayBtn = screen.getByRole('button', { name: /Mar 14, 2025: 3\. Open day details/ })
    expect(dayBtn.closest('.sr-cal-minimonth')).toBeTruthy() // it's the overview trigger
    fireEvent.click(dayBtn)
    dialog = await screen.findByRole('dialog', { name: /Day details for \w{3}, Mar 14, 2025/ })
    expect(within(dialog).getByText('species')).toBeTruthy()
    // The view did NOT switch when the popup opened — still Large.
    expect(screen.getByRole('button', { name: 'Large' }).getAttribute('aria-pressed')).toBe('true')
  })

  it('the combined (All years) Compact cell carries its MM-DD count with NO date corner', async () => {
    render(<Calendar {...props} />)
    await screen.findByText('March')
    fireEvent.click(screen.getByRole('button', { name: 'All years' }))
    // Mar 14 combined data cell — union count 3, and no date corner (Compact is dateless).
    const cell = await screen.findByRole('button', { name: /Mar 14: 3\. Open day details/ })
    expect(cell.querySelector('.sr-cal-daynum')).toBeNull()
    expect(cell.textContent).toContain('3')
  })
})

describe('Calendar — combined view aligns to the current year & keeps Feb 29 (change 1)', () => {
  // Return the cell-grid element for a named month card in the Compact (big-grid) view.
  // Card structure: [month-name div, weekday-header grid (aria-hidden), cell grid].
  // The cell grid is the card's last element child.
  function monthCellGrid(monthName: string): HTMLElement {
    const card = screen.getByText(monthName).parentElement as HTMLElement
    return card.lastElementChild as HTMLElement
  }

  // A leading PAD cell is a bare <div> with no border (borderStyle "none"); the first
  // real day-of-month-1 cell breaks the streak — it's either a bordered no-data <div>
  // (borderStyle "solid") or a <button> (zero/data cell). The big grids no longer carry
  // a per-day date, so the lead can't be found by a "1" text corner — it's detected
  // structurally (per the v0.5.63 count-only Compact cells). This still proves the
  // current-year alignment guarantee: the pad count === dayOfWeek(CURRENT_YEAR, month, 1).
  function leadPadCount(grid: HTMLElement): number {
    const kids = Array.from(grid.children) as HTMLElement[]
    let lead = 0
    while (
      lead < kids.length &&
      kids[lead].tagName === 'DIV' &&
      kids[lead].style.borderStyle === 'none'
    ) lead++
    return lead
  }

  it('the combined grid’s weekday lead-in matches the CURRENT year, not a fixed reference year', async () => {
    render(<Calendar {...props} />)
    await screen.findByText('January')
    fireEvent.click(screen.getByRole('button', { name: 'All years' }))
    // Wait for the combined view to render (its legend unit is combined-only).
    await screen.findByText('Species ever recorded')

    // The lead-in is the number of leading empty pad cells before day-of-month 1. In
    // the combined view that must equal dayOfWeek(CURRENT_YEAR, month, 1) — the same
    // value this year's single-year grid uses. A fixed 2000 reference would give a
    // different lead for most months (a regression to the old behavior fails here).
    // Jan/Mar/Jul day-1 are all no-data days in the fixture → a clean pad-streak break.
    const currentYear = new Date().getFullYear()
    for (const [monthName, monthIdx] of [['January', 1], ['March', 3], ['July', 7]] as const) {
      const grid = monthCellGrid(monthName)
      expect(leadPadCount(grid)).toBe(dayOfWeek(currentYear, monthIdx, 1))
    }
  })

  it('the combined February keeps its Feb 29 cell even when the current year is not a leap year', async () => {
    render(<Calendar {...props} />)
    await screen.findByText('February')
    fireEvent.click(screen.getByRole('button', { name: 'All years' }))
    await screen.findByText('Species ever recorded')
    // February's combined grid pins to 29 days regardless of the current year's leapness
    // (2026, a plausible current year, is NOT a leap year — a naive daysInMonth swap
    // would drop this cell). The big grids carry no per-day date now, so the Feb-29 cell
    // is proven by COUNTING the grid's non-pad day cells: a 29-day February has exactly
    // 29 real day cells (pads excluded). The Feb-29 day has no data in the fixture, so it
    // renders as a bare no-data <div>. 28 would mean the leap cell was dropped.
    const grid = monthCellGrid('February')
    const kids = Array.from(grid.children) as HTMLElement[]
    const padCount = leadPadCount(grid) // pads only lead (no trailing pads in this grid)
    const dayCells = kids.length - padCount
    expect(dayCells).toBe(29)
  })
})

describe('Calendar — spuh toggle (QA-49)', () => {
  it('defaults OFF and is Species-only: dimmed + inert under the Checklists metric', async () => {
    render(<Calendar {...props} />)
    await screen.findByText('January')
    const formsSwitch = screen.getByRole('switch', { name: /Count all forms/ })
    expect(formsSwitch.getAttribute('aria-checked')).toBe('false')

    // switch to Checklists → the settling row toggle becomes inert (tabindex -1, aria-disabled)
    fireEvent.click(screen.getByRole('button', { name: 'Checklists' }))
    expect(formsSwitch.getAttribute('tabindex')).toBe('-1')
    expect(formsSwitch.getAttribute('aria-disabled')).toBe('true')
  })

  it('turning it ON re-tiers the Species grid and updates the view sub-line', async () => {
    render(<Calendar {...props} />)
    await screen.findByText('January')
    // sub-line before
    expect(screen.getByText(/Species seen each day/)).toBeTruthy()
    fireEvent.click(screen.getByRole('switch', { name: /Count all forms/ }))
    // sub-line now notes forms included
    expect(screen.getByText(/all forms included/)).toBeTruthy()
  })

  it('does not persist any setting through the storage seam (QA-49)', async () => {
    render(<Calendar {...props} />)
    await screen.findByText('January')
    fireEvent.click(screen.getByRole('switch', { name: /Count all forms/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Checklists' }))
    fireEvent.click(screen.getByRole('button', { name: 'Compact' }))
    expect(setSetting).not.toHaveBeenCalled()
  })
})

describe('Calendar — per-species filter (searchable combobox)', () => {
  it('renders a searchable Species combobox defaulting to All species; opening lists All + one option per normalized species', async () => {
    render(<Calendar {...props} />)
    await screen.findByText('January')
    const input = screen.getByRole('combobox', { name: /Filter the calendar to one species/ }) as HTMLInputElement
    expect(input.value).toBe('') // All species (nothing selected)
    // Open the listbox by focusing the input.
    fireEvent.focus(input)
    const listbox = await screen.findByRole('listbox', { name: /Filter the calendar to one species/ })
    const optionLabels = within(listbox).getAllByRole('option').map(o => o.textContent)
    // The synthetic "All species" clearing row sits first.
    expect(optionLabels[0]).toContain('All species')
    // Species present in the 2025 default year's dataset show up in the option list.
    expect(optionLabels.some(l => l?.includes('American Robin'))).toBe(true)
    expect(optionLabels.some(l => l?.includes('Blue Jay'))).toBe(true)
  })

  it('typing filters the option list to matching species', async () => {
    render(<Calendar {...props} />)
    await screen.findByText('January')
    const input = screen.getByRole('combobox', { name: /Filter the calendar to one species/ })
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: 'robin' } })
    const listbox = await screen.findByRole('listbox', { name: /Filter the calendar to one species/ })
    const labels = within(listbox).getAllByRole('option').map(o => o.textContent)
    // The "All species" clearing row always survives the filter (never filtered out).
    expect(labels.some(l => l?.includes('All species'))).toBe(true)
    expect(labels.some(l => l?.includes('American Robin'))).toBe(true)
    expect(labels.some(l => l?.includes('Blue Jay'))).toBe(false)
  })

  it('selecting a species (click) disables the spuh/include-forms toggle and notes it in the sub-line', async () => {
    render(<Calendar {...props} />)
    await screen.findByText('January')
    const formsSwitch = screen.getByRole('switch', { name: /Count all forms/ })
    expect(formsSwitch.getAttribute('aria-disabled')).not.toBe('true')

    const input = screen.getByRole('combobox', { name: /Filter the calendar to one species/ })
    fireEvent.focus(input)
    const listbox = await screen.findByRole('listbox', { name: /Filter the calendar to one species/ })
    const robin = within(listbox).getAllByRole('option').find(o => o.textContent?.includes('American Robin'))!
    fireEvent.click(robin)

    expect(formsSwitch.getAttribute('aria-disabled')).toBe('true')
    expect(formsSwitch.getAttribute('tabindex')).toBe('-1')
    // Sub-line reflects the narrowing.
    expect(screen.getByText(/American Robin only/)).toBeTruthy()
  })

  it('the "All species" row clears the filter (onChange null)', async () => {
    render(<Calendar {...props} />)
    await screen.findByText('January')
    const input = screen.getByRole('combobox', { name: /Filter the calendar to one species/ }) as HTMLInputElement
    // Select a species first.
    fireEvent.focus(input)
    let listbox = await screen.findByRole('listbox', { name: /Filter the calendar to one species/ })
    fireEvent.click(within(listbox).getAllByRole('option').find(o => o.textContent?.includes('American Robin'))!)
    expect(screen.getByText(/American Robin only/)).toBeTruthy()
    // Reopen and click "All species" → the narrowing clears.
    fireEvent.focus(input)
    listbox = await screen.findByRole('listbox', { name: /Filter the calendar to one species/ })
    fireEvent.click(within(listbox).getAllByRole('option').find(o => o.textContent?.includes('All species'))!)
    expect(screen.queryByText(/American Robin only/)).toBeNull()
    expect(input.value).toBe('')
  })

  it('does not persist the species selection through the storage seam', async () => {
    render(<Calendar {...props} />)
    await screen.findByText('January')
    const input = screen.getByRole('combobox', { name: /Filter the calendar to one species/ })
    fireEvent.focus(input)
    const listbox = await screen.findByRole('listbox', { name: /Filter the calendar to one species/ })
    fireEvent.click(within(listbox).getAllByRole('option').find(o => o.textContent?.includes('Blue Jay'))!)
    expect(setSetting).not.toHaveBeenCalled()
  })
})

describe('Calendar — textures (QA-28)', () => {
  it('Use Textures toggles and persists across a metric switch', async () => {
    render(<Calendar {...props} />)
    await screen.findByText('January')
    const tex = screen.getByRole('switch', { name: 'Use Textures' })
    expect(tex.getAttribute('aria-checked')).toBe('false')
    fireEvent.click(tex)
    expect(tex.getAttribute('aria-checked')).toBe('true')
    fireEvent.click(screen.getByRole('button', { name: 'Checklists' }))
    // still on after switching metric
    expect(screen.getByRole('switch', { name: 'Use Textures' }).getAttribute('aria-checked')).toBe('true')
  })
})

describe('Calendar — day popup (QA-33/34/37)', () => {
  it('a data cell opens a popup with both counts and a ChecklistLink; Escape closes it', async () => {
    render(<Calendar {...props} />)
    await screen.findByText('March')
    // the 2025-03-14 rich data cell (3 species, 2 checklists)
    const cell = screen.getByRole('button', { name: /Mar 14, 2025: 3\. Open day details/ })
    fireEvent.click(cell)
    const dialog = await screen.findByRole('dialog')
    // all three stat tiles shown regardless of the active metric (change 1)
    expect(within(dialog).getByText('species')).toBeTruthy()
    expect(within(dialog).getByText('checklists')).toBeTruthy()
    expect(within(dialog).getByText('individuals')).toBeTruthy()
    // a real eBird checklist link (S100 is shape-valid)
    const links = within(dialog).getAllByRole('link', { name: /open checklist on eBird/ })
    expect(links.length).toBeGreaterThan(0)
    expect(links[0].getAttribute('href')).toContain('/checklist/S100')

    fireEvent.keyDown(document, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })

  it('each popup checklist row shows the start time (leading zero trimmed), location, and species count', async () => {
    render(<Calendar {...props} />)
    await screen.findByText('March')
    const cell = screen.getByRole('button', { name: /Mar 14, 2025: 3\. Open day details/ })
    fireEvent.click(cell)
    const dialog = await screen.findByRole('dialog')
    // S100 carried "07:30 AM" @ "Point Reyes NS--Bear Valley" (Robin + Song Sparrow) —
    // the "time · location" prefix is one span (leading zero trimmed, middot-joined), and
    // the checklist's own countable species count (2) rides on the tail: "· 2 species".
    expect(within(dialog).getByText('7:30 AM · Point Reyes NS--Bear Valley')).toBeTruthy()
    expect(within(dialog).getByText('· 2 species')).toBeTruthy()
  })

  it('a checklist with no start time (time null) shows the location alone — then the species count — no stray separator', async () => {
    render(<Calendar {...props} />)
    await screen.findByText('March')
    const cell = screen.getByRole('button', { name: /Mar 14, 2025: 3\. Open day details/ })
    fireEvent.click(cell)
    const dialog = await screen.findByRole('dialog')
    // S101 (Blue Jay) is timeless — its prefix span shows JUST the location, with no
    // leading "· " and no bare middot in that segment.
    const locOnly = within(dialog).getByText('Abbotts Lagoon')
    expect(locOnly).toBeTruthy()
    expect(locOnly.textContent).toBe('Abbotts Lagoon')
    expect(locOnly.textContent).not.toContain('·')
    // Its species count (Blue Jay only → 1) rides on the tail as a sibling span.
    expect(within(dialog).getByText('· 1 species')).toBeTruthy()
  })

  it('the popup checklist row species count follows the include-forms toggle (countable ↔ with-forms)', async () => {
    // A dedicated dataset: one checklist S300 with Robin (countable) + "gull sp." (spuh),
    // so the two counts differ (countable 1, with-forms 2). Rendering it as the only
    // checklist on a day isolates the row.
    observations = [
      obs({ date: '2025-03-14', submissionId: 'S300', commonName: 'American Robin', time: '08:00 AM', location: 'Marsh Loop' }),
      obs({ date: '2025-03-14', submissionId: 'S300', commonName: 'gull sp.', time: '08:00 AM', location: 'Marsh Loop' }),
    ]
    render(<Calendar {...props} />)
    await screen.findByText('March')
    // Species metric, forms OFF (default): the day cell reads 1 (Robin only).
    const cell = screen.getByRole('button', { name: /Mar 14, 2025: 1\. Open day details/ })
    fireEvent.click(cell)
    let dialog = await screen.findByRole('dialog')
    // OFF → the checklist's countable count (1).
    expect(within(dialog).getByText('· 1 species')).toBeTruthy()
    expect(within(dialog).queryByText('· 2 species')).toBeNull()
    // Close the popup, flip the include-forms toggle ON, reopen the (now count-2) cell.
    fireEvent.keyDown(document, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    fireEvent.click(screen.getByRole('switch', { name: /Count all forms/ }))
    // With forms ON the day cell now reads 2 (Robin + gull sp.).
    fireEvent.click(screen.getByRole('button', { name: /Mar 14, 2025: 2\. Open day details/ }))
    dialog = await screen.findByRole('dialog')
    // ON → the checklist's with-forms count (2).
    expect(within(dialog).getByText('· 2 species')).toBeTruthy()
    expect(within(dialog).queryByText('· 1 species')).toBeNull()
  })

  it('a present-but-zero cell opens its popup (species 0, checklists >= 1) (QA-36)', async () => {
    render(<Calendar {...props} />)
    await screen.findByText('June')
    const zeroCell = screen.getByRole('button', { name: /Jun 1, 2025: birded, 0 countable species\. Open day details/ })
    fireEvent.click(zeroCell)
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('species')).toBeTruthy()
    // the close button closes it
    fireEvent.click(within(dialog).getByRole('button', { name: 'Close day details' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })
})

describe('Calendar — All years combined popup labels union vs sum (QA-35)', () => {
  it('combined mode labels species "ever recorded" and checklists "across N years"', async () => {
    render(<Calendar {...props} />)
    await screen.findByText('March')
    fireEvent.click(screen.getByRole('button', { name: 'All years' }))
    // legend switches to combined unit
    expect(await screen.findByText('Species ever recorded')).toBeTruthy()
    // open a combined data cell (Mar 14 across years)
    const cell = screen.getByRole('button', { name: /Mar 14: 3\. Open day details/ })
    fireEvent.click(cell)
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('species ever recorded')).toBeTruthy()
    // M = the years that ACTUALLY contributed a checklist to this MM-DD bucket
    // (2024 + 2025 = 2), NOT the full data-year span. Asserts the exact number so a
    // regression to the whole-span value is caught (FR-38/QA-35).
    expect(within(dialog).getByText('checklists across 2 years')).toBeTruthy()
  })
})

describe('Calendar — header layout (QA-50)', () => {
  it('the spuh toggle sits on its own settling row separate from the primary controls', async () => {
    render(<Calendar {...props} />)
    await screen.findByText('January')
    const formsSwitch = screen.getByRole('switch', { name: /Count all forms/ })
    const metricBtn = screen.getByRole('button', { name: 'Species' })
    // the settling row (with aria-disabled attr present) is a different container
    // than the one holding the metric SegControl.
    const settleRow = formsSwitch.closest('[class~="sr-wrap-flex"]')
    const primaryRow = metricBtn.closest('[class~="sr-wrap-flex"]')
    expect(settleRow).toBeTruthy()
    expect(primaryRow).toBeTruthy()
    expect(settleRow).not.toBe(primaryRow)
  })
})

describe('Calendar — no re-read / no re-parse on toggle (QA-04 / QA-41)', () => {
  // The PRD (NFR-01, QA-04, QA-41) states this verbatim: re-tiering on a metric or
  // year/view/textures/forms toggle is a memoized recompute over the ALREADY-RESOLVED
  // observations and MUST NOT re-call loadEbirdObservations / storage.getFilesStatus.
  // These spy on the two seam reads and assert exactly one initial load, then zero
  // further reads across every control the header exposes.
  it('loads exactly once on mount and never re-reads when the user flips controls', async () => {
    render(<Calendar {...props} />)
    await screen.findByText('January')

    // Initial load: the phase-state-machine effect read each source exactly once.
    expect(loadEbird).toHaveBeenCalledTimes(1)
    expect(getFilesStatus).toHaveBeenCalledTimes(1)

    // Metric toggle Species → Checklists → Species.
    fireEvent.click(screen.getByRole('button', { name: 'Checklists' }))
    fireEvent.click(screen.getByRole('button', { name: 'Species' }))
    // View toggle Compact (big grids) → Large (overview) → Compact.
    fireEvent.click(screen.getByRole('button', { name: 'Large' }))
    fireEvent.click(screen.getByRole('button', { name: 'Compact' }))
    // Use Textures on/off.
    fireEvent.click(screen.getByRole('switch', { name: 'Use Textures' }))
    fireEvent.click(screen.getByRole('switch', { name: 'Use Textures' }))
    // Count-forms on/off (Species metric).
    fireEvent.click(screen.getByRole('switch', { name: /Count all forms/ }))
    fireEvent.click(screen.getByRole('switch', { name: /Count all forms/ }))
    // Year navigation: previous (2025 → 2024) then All years (combined) and back.
    fireEvent.click(screen.getByRole('button', { name: 'Previous year with data' }))
    fireEvent.click(screen.getByRole('button', { name: 'All years' }))
    fireEvent.click(screen.getByRole('button', { name: 'All years' }))

    // Let any pending microtasks / effects settle, then assert NO second read.
    await waitFor(() => expect(screen.getByText('January')).toBeTruthy())
    expect(loadEbird).toHaveBeenCalledTimes(1)
    expect(getFilesStatus).toHaveBeenCalledTimes(1)
  })

  it('re-reads only when filesVersion changes (the effect key)', async () => {
    const { rerender } = render(<Calendar {...props} filesVersion={0} />)
    await screen.findByText('January')
    expect(loadEbird).toHaveBeenCalledTimes(1)

    // A new filesVersion is the sanctioned re-read trigger (a re-uploaded backup).
    rerender(<Calendar {...props} filesVersion={1} />)
    await waitFor(() => expect(loadEbird).toHaveBeenCalledTimes(2))
    expect(getFilesStatus).toHaveBeenCalledTimes(2)
  })
})

describe('Calendar — error phase (QA-06)', () => {
  it('renders an inline role="alert" — not a blank/partial grid — when the load fails', async () => {
    // FR-06 / QA-06: a stored backup whose load resolves null drives the error phase.
    loadEbird.mockImplementation(async () => null)
    render(<Calendar {...props} />)

    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toMatch(/Couldn't load your eBird backup/)
    // The grid never rendered — no month cards behind the error.
    expect(screen.queryByText('January')).toBeNull()
  })

  it('renders the error phase (not the grid) when getFilesStatus throws', async () => {
    // A read/parse throw falls into the catch; the tab must not show a partial grid.
    getFilesStatus.mockImplementation(async () => { throw new Error('read failed') })
    render(<Calendar {...props} />)
    // The catch degrades to setup-required (source behavior) — still not a grid.
    expect(await screen.findByText('eBird Backup Required')).toBeTruthy()
    expect(screen.queryByText('January')).toBeNull()
  })
})

describe('Calendar — popup focus restore & single-open (QA-37 / QA-38)', () => {
  it('restores focus to the activating day cell after Escape closes the popup', async () => {
    render(<Calendar {...props} />)
    await screen.findByText('March')
    const cell = screen.getByRole('button', { name: /Mar 14, 2025: 3\. Open day details/ })
    fireEvent.click(cell)
    await screen.findByRole('dialog')

    fireEvent.keyDown(document, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    // The close path defers focus with requestAnimationFrame; waitFor polls past it.
    await waitFor(() => expect(document.activeElement).toBe(cell))
  })

  it('restores focus to the activating day cell after the Close control closes the popup', async () => {
    render(<Calendar {...props} />)
    await screen.findByText('March')
    const cell = screen.getByRole('button', { name: /Mar 14, 2025: 3\. Open day details/ })
    fireEvent.click(cell)
    const dialog = await screen.findByRole('dialog')

    fireEvent.click(within(dialog).getByRole('button', { name: 'Close day details' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    await waitFor(() => expect(document.activeElement).toBe(cell))
  })

  it('closes via a backdrop mousedown (the third close affordance) (QA-37)', async () => {
    render(<Calendar {...props} />)
    await screen.findByText('March')
    const cell = screen.getByRole('button', { name: /Mar 14, 2025: 3\. Open day details/ })
    fireEvent.click(cell)
    const dialog = await screen.findByRole('dialog')
    // The backdrop is the role="presentation" ancestor; a mousedown ON it (target ===
    // currentTarget) closes. The inner dialog stops it (target !== currentTarget).
    const backdrop = dialog.parentElement as HTMLElement
    expect(backdrop.getAttribute('role')).toBe('presentation')
    fireEvent.mouseDown(backdrop)
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    await waitFor(() => expect(document.activeElement).toBe(cell))
  })

  it('opening a second day popup replaces the first — only one dialog open at a time (QA-38)', async () => {
    render(<Calendar {...props} />)
    await screen.findByText('March')
    const first = screen.getByRole('button', { name: /Mar 14, 2025: 3\. Open day details/ })
    fireEvent.click(first)
    // The dialog's accessible name uniquely identifies the day via the weekday-
    // prefixed date ("… Day details for Fri, Mar 14, 2025"), which the checklist-row
    // link labels ("Mar 14, 2025", no weekday) do NOT share.
    const firstDialog = await screen.findByRole('dialog', { name: /Day details for \w{3}, Mar 14, 2025/ })
    expect(firstDialog).toBeTruthy()

    // Activate a DIFFERENT day cell while the first popup is open. The single `popup`
    // state means the second replaces the first; the app never stacks two dialogs.
    const second = screen.getByRole('button', { name: /Mar 15, 2025: 1\. Open day details/ })
    fireEvent.click(second)

    await waitFor(() => {
      // Exactly one dialog, and it is now the Mar-15 day.
      const dialogs = screen.getAllByRole('dialog')
      expect(dialogs).toHaveLength(1)
      expect(dialogs[0].getAttribute('aria-label')).toMatch(/\w{3}, Mar 15, 2025/)
    })
  })
})
