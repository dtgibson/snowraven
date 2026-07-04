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
  }
}

// A dataset spanning 2024 (with a present-but-zero spuh-only day) and 2025.
let observations: ObservationEntry[] = []
function buildDataset(): ObservationEntry[] {
  const rows: ObservationEntry[] = []
  // 2025: a rich data day 2025-03-14 (many species) + a lighter day 2025-03-15
  rows.push(obs({ date: '2025-03-14', submissionId: 'S100', commonName: 'American Robin' }))
  rows.push(obs({ date: '2025-03-14', submissionId: 'S100', commonName: 'Song Sparrow' }))
  rows.push(obs({ date: '2025-03-14', submissionId: 'S101', commonName: 'Blue Jay' }))
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

  it('the View density toggle defaults Months and switches to a 3×4 Year Overview of 12 mini-months (QA-48)', async () => {
    render(<Calendar {...props} />)
    await screen.findByText('January')
    const monthsBtn = screen.getByRole('button', { name: 'Months' })
    const yearBtn = screen.getByRole('button', { name: 'Year' })
    expect(monthsBtn.getAttribute('aria-pressed')).toBe('true')
    expect(yearBtn.getAttribute('aria-pressed')).toBe('false')

    fireEvent.click(yearBtn)
    // 12 mini-month buttons, each "Open {Month} in the month view", no day numbers
    const miniButtons = screen.getAllByRole('button', { name: /Open .* in the month view/ })
    expect(miniButtons).toHaveLength(12)

    // clicking a mini-month flips back to Months
    fireEvent.click(screen.getByRole('button', { name: 'Open March in the month view' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Months' }).getAttribute('aria-pressed')).toBe('true'))
  })
})

describe('Calendar — spuh toggle (QA-49)', () => {
  it('defaults OFF and is Species-only: dimmed + inert under the Checklists metric', async () => {
    render(<Calendar {...props} />)
    await screen.findByText('January')
    const formsSwitch = screen.getByRole('switch', { name: /Count spuh, slash & hybrids/ })
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
    fireEvent.click(screen.getByRole('switch', { name: /Count spuh, slash & hybrids/ }))
    // sub-line now notes forms included
    expect(screen.getByText(/spuh\/slash\/hybrids included/)).toBeTruthy()
  })

  it('does not persist any setting through the storage seam (QA-49)', async () => {
    render(<Calendar {...props} />)
    await screen.findByText('January')
    fireEvent.click(screen.getByRole('switch', { name: /Count spuh, slash & hybrids/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Checklists' }))
    fireEvent.click(screen.getByRole('button', { name: 'Year' }))
    expect(setSetting).not.toHaveBeenCalled()
  })
})

describe('Calendar — per-species filter (change 2)', () => {
  it('renders a "Species" select defaulting to All species, with one option per normalized species', async () => {
    render(<Calendar {...props} />)
    await screen.findByText('January')
    const select = screen.getByRole('combobox', { name: /Filter the calendar to one species/ }) as HTMLSelectElement
    expect(select.value).toBe('') // All species
    const optionLabels = Array.from(select.querySelectorAll('option')).map(o => o.textContent)
    expect(optionLabels[0]).toBe('All species')
    // Species present in the 2025 default year's dataset show up in the option list.
    expect(optionLabels).toContain('American Robin')
    expect(optionLabels).toContain('Blue Jay')
  })

  it('selecting a species disables the spuh/include-forms toggle and notes it in the sub-line', async () => {
    render(<Calendar {...props} />)
    await screen.findByText('January')
    const formsSwitch = screen.getByRole('switch', { name: /Count spuh, slash & hybrids/ })
    expect(formsSwitch.getAttribute('aria-disabled')).not.toBe('true')

    const select = screen.getByRole('combobox', { name: /Filter the calendar to one species/ })
    fireEvent.change(select, { target: { value: 'American Robin' } })

    expect(formsSwitch.getAttribute('aria-disabled')).toBe('true')
    expect(formsSwitch.getAttribute('tabindex')).toBe('-1')
    // Sub-line reflects the narrowing.
    expect(screen.getByText(/American Robin only/)).toBeTruthy()
  })

  it('does not persist the species selection through the storage seam', async () => {
    render(<Calendar {...props} />)
    await screen.findByText('January')
    fireEvent.change(screen.getByRole('combobox', { name: /Filter the calendar to one species/ }), { target: { value: 'Blue Jay' } })
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
    const cell = screen.getByRole('button', { name: /Mar 14, 2025 — 3\. Open day details/ })
    fireEvent.click(cell)
    const dialog = await screen.findByRole('dialog')
    // both counts shown
    expect(within(dialog).getByText('species')).toBeTruthy()
    expect(within(dialog).getByText('checklists')).toBeTruthy()
    // a real eBird checklist link (S100 is shape-valid)
    const links = within(dialog).getAllByRole('link', { name: /open checklist on eBird/ })
    expect(links.length).toBeGreaterThan(0)
    expect(links[0].getAttribute('href')).toContain('/checklist/S100')

    fireEvent.keyDown(document, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })

  it('a present-but-zero cell opens its popup (species 0, checklists >= 1) (QA-36)', async () => {
    render(<Calendar {...props} />)
    await screen.findByText('June')
    const zeroCell = screen.getByRole('button', { name: /Jun 1, 2025 — birded, 0 countable species\. Open day details/ })
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
    const cell = screen.getByRole('button', { name: /Mar 14 — 3\. Open day details/ })
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
    const formsSwitch = screen.getByRole('switch', { name: /Count spuh, slash & hybrids/ })
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
    // View-density toggle Months → Year → Months.
    fireEvent.click(screen.getByRole('button', { name: 'Year' }))
    fireEvent.click(screen.getByRole('button', { name: 'Months' }))
    // Use Textures on/off.
    fireEvent.click(screen.getByRole('switch', { name: 'Use Textures' }))
    fireEvent.click(screen.getByRole('switch', { name: 'Use Textures' }))
    // Count-forms on/off (Species metric).
    fireEvent.click(screen.getByRole('switch', { name: /Count spuh, slash & hybrids/ }))
    fireEvent.click(screen.getByRole('switch', { name: /Count spuh, slash & hybrids/ }))
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
    const cell = screen.getByRole('button', { name: /Mar 14, 2025 — 3\. Open day details/ })
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
    const cell = screen.getByRole('button', { name: /Mar 14, 2025 — 3\. Open day details/ })
    fireEvent.click(cell)
    const dialog = await screen.findByRole('dialog')

    fireEvent.click(within(dialog).getByRole('button', { name: 'Close day details' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    await waitFor(() => expect(document.activeElement).toBe(cell))
  })

  it('closes via a backdrop mousedown (the third close affordance) (QA-37)', async () => {
    render(<Calendar {...props} />)
    await screen.findByText('March')
    const cell = screen.getByRole('button', { name: /Mar 14, 2025 — 3\. Open day details/ })
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
    const first = screen.getByRole('button', { name: /Mar 14, 2025 — 3\. Open day details/ })
    fireEvent.click(first)
    // The dialog's accessible name uniquely identifies the day via the weekday-
    // prefixed date ("… Day details for Fri, Mar 14, 2025"), which the checklist-row
    // link labels ("Mar 14, 2025", no weekday) do NOT share.
    const firstDialog = await screen.findByRole('dialog', { name: /Day details for \w{3}, Mar 14, 2025/ })
    expect(firstDialog).toBeTruthy()

    // Activate a DIFFERENT day cell while the first popup is open. The single `popup`
    // state means the second replaces the first; the app never stacks two dialogs.
    const second = screen.getByRole('button', { name: /Mar 15, 2025 — 1\. Open day details/ })
    fireEvent.click(second)

    await waitFor(() => {
      // Exactly one dialog, and it is now the Mar-15 day.
      const dialogs = screen.getAllByRole('dialog')
      expect(dialogs).toHaveLength(1)
      expect(dialogs[0].getAttribute('aria-label')).toMatch(/\w{3}, Mar 15, 2025/)
    })
  })
})
