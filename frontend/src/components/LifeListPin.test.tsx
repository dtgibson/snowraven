// @vitest-environment jsdom
//
// Coverage for the Multimedia control row's pin toggle: its accessible name and
// description, its live region, and the WIRING of the shared state machine into
// this component. The machine's own transitions and its `pinned implies Unbounded`
// invariant are proved once, purely, in lib/pinnedLabels.test.ts — what can only
// be tested here is that this tab actually runs it and renders the result.
//
// This control exists because the user, previewing the bundle on a device, asked
// for the Multimedia tab to have "the same pin labels option as the breeding
// codes." An earlier revision repaired the sticky mechanism but left the band
// always-on in Unbounded with no control; these tests hold the reversal.
//
// The tab autoloads from storage on mount, so the three seams it reaches through
// are mocked; everything else is the real component, including the real
// LifeListTable, so the invariant is asserted against the class the table actually
// renders rather than against internal state.

import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import { render, screen, cleanup, waitFor, fireEvent } from '@testing-library/react'
import { LifeList } from './LifeList'

const ML_CSV =
  'Catalog Number,Common Name,Scientific Name,Format,Date,Location,County,Latitude,Longitude\n' +
  '111,American Robin,Turdus migratorius,Photo,2024-05-01,Tilden Park,Alameda,37.9,-122.24\n' +
  '222,Song Sparrow,Melospiza melodia,Audio,2024-05-02,Tilden Park,Alameda,37.9,-122.24\n'

const EBIRD_HEADER = 'Common Name,Scientific Name,County,Date,Breeding Code\n'
const OBSERVATIONS = [
  { commonName: 'American Robin', scientificName: 'Turdus migratorius', date: '2024-05-01', county: 'Alameda', breedingCode: 'NB' },
  { commonName: 'Song Sparrow', scientificName: 'Melospiza melodia', date: '2024-05-02', county: 'Alameda', breedingCode: 'FL' },
]

vi.mock('../lib/storage', () => ({
  storage: {
    getFilesStatus: vi.fn(async () => ({
      ebird: { filename: 'MyEBirdData.csv', uploadedAt: '2024-05-03' },
      ml: { filename: 'ML_12345_photo.csv', uploadedAt: '2024-05-03' },
    })),
    readFile: vi.fn(async () => ML_CSV),
  },
}))

vi.mock('../lib/observationsCache', () => ({
  loadEbirdObservations: vi.fn(async () => ({ headerLine: EBIRD_HEADER, observations: OBSERVATIONS })),
}))

vi.mock('../lib/transport', () => ({
  transport: { post: vi.fn(async () => ({ codes: {}, orders: {}, formCodes: {}, results: [] })) },
}))

afterEach(cleanup)
beforeEach(() => { vi.clearAllMocks() })

/** Render the tab and wait for its autoload to settle. */
async function renderTab() {
  const view = render(
    <LifeList
      onGoToSettings={vi.fn()}
      requestedFilter={undefined}
      onRequestedFilterConsumed={vi.fn()}
      filesVersion={0}
      onOpenSpecies={vi.fn()}
    />,
  )
  await screen.findByRole('button', { name: 'Pin column labels' })
  return view
}

const pinBtn = () => screen.getByRole('button', { name: 'Pin column labels' })
const viewBtn = () => screen.getByRole('button', { name: /^↔/ })
const tableEl = (c: HTMLElement) => c.querySelector('table') as HTMLElement
const isPinned = (c: HTMLElement) => tableEl(c).classList.contains('sr-ll-table--pinned')

const PIN_NOTE =
  'Column headings stay at the top while you scroll. Pinning uses the Unbounded view, so the table scrolls with the page.'

describe('pin control, name and description', () => {
  it('names the control by its visible text and nothing else', async () => {
    await renderTab()
    const btn = pinBtn()
    // No aria-label ANYWHERE on it: a second source of truth is how a published
    // accessible name once drifted from what the component emitted. With the name
    // coming from the button's own text, the two cannot disagree.
    expect(btn.getAttribute('aria-label')).toBe(null)
    expect(btn.getAttribute('aria-labelledby')).toBe(null)
    // Names the axis it freezes, as "Pin code labels" does on Breeding Codes: the
    // row that holds still here is the column headings.
    expect(btn.textContent).toBe('Pin column labels')
  })

  it('carries the consequence as a DESCRIPTION, not part of the name', async () => {
    await renderTab()
    const id = pinBtn().getAttribute('aria-describedby')
    expect(id).toBeTruthy()
    // getElementById, not a `#id` selector: useId() emits ids containing characters
    // that are valid in an IDREF but need escaping in a CSS selector.
    const desc = document.getElementById(id!) as HTMLElement
    expect(desc).toBeTruthy()
    // A description keeps WCAG 2.5.3 Label in Name trivially satisfied: the visible
    // label is still exactly the accessible name.
    expect(desc.textContent).toBe('Pinning uses the Unbounded view.')
    expect(desc.classList.contains('sr-only')).toBe(true)
    // It sits in the control row, never inside the horizontally scrolled table (an
    // absolutely positioned .sr-only span there can leak page scroll on a phone).
    expect(desc.closest('table')).toBe(null)
  })

  it('reflects its state with aria-pressed, per the pill convention', async () => {
    await renderTab()
    expect(pinBtn().getAttribute('aria-pressed')).toBe('false')
    fireEvent.click(pinBtn())
    await waitFor(() => expect(pinBtn().getAttribute('aria-pressed')).toBe('true'))
  })

  it('groups the two presentation controls and gives both the phone touch posture', async () => {
    await renderTab()
    const group = screen.getByRole('group', { name: 'Table view' })
    expect(group.contains(pinBtn())).toBe(true)
    expect(group.contains(viewBtn())).toBe(true)
    expect(pinBtn().classList.contains('sr-touch-target')).toBe(true)
    expect(viewBtn().classList.contains('sr-touch-target')).toBe(true)
  })
})

describe('the invariant, as this tab actually renders it', () => {
  it('starts unpinned in Normal view, with the shipped rendering', async () => {
    const { container } = await renderTab()
    expect(isPinned(container)).toBe(false)
    expect(viewBtn().textContent).toContain('Unbounded')
    expect(screen.queryByText(PIN_NOTE)).toBe(null)
  })

  it('does NOT pin when the user only switches to Unbounded', async () => {
    // The reversal, at the level the user experiences it. The previous revision
    // pinned the band for anyone who pressed the view toggle, with no control and
    // no way to turn it off; this asserts the band waits for the pin.
    const { container } = await renderTab()
    fireEvent.click(viewBtn())
    await waitFor(() => expect(viewBtn().textContent).toContain('Normal'))
    expect(isPinned(container)).toBe(false)
    expect(screen.queryByText(PIN_NOTE)).toBe(null)
  })

  it('switches to Unbounded AND pins in a single press from Normal', async () => {
    const { container } = await renderTab()
    fireEvent.click(pinBtn())
    await waitFor(() => expect(isPinned(container)).toBe(true))
    expect(viewBtn().textContent).toContain('Normal')
  })

  it('restores the view it came from when unpinned, leaving no residue', async () => {
    const { container } = await renderTab()
    fireEvent.click(pinBtn())
    await waitFor(() => expect(isPinned(container)).toBe(true))
    fireEvent.click(pinBtn())
    await waitFor(() => expect(isPinned(container)).toBe(false))
    expect(viewBtn().textContent).toContain('Unbounded')
  })

  it('clears the pin when the user switches back to Normal themselves', async () => {
    const { container } = await renderTab()
    fireEvent.click(pinBtn())
    await waitFor(() => expect(isPinned(container)).toBe(true))
    fireEvent.click(viewBtn())
    await waitFor(() => expect(isPinned(container)).toBe(false))
    expect(pinBtn().getAttribute('aria-pressed')).toBe('false')
    expect(screen.queryByText(PIN_NOTE)).toBe(null)
  })
})

describe('the pinned status note and its live region', () => {
  it('renders the region from the start, so its first change is announced', async () => {
    // A live region that mounts together with its text can go unannounced: AT
    // reports CHANGES to a region that already exists.
    const { container } = await renderTab()
    const region = container.querySelector('[role="status"]') as HTMLElement
    expect(region).toBeTruthy()
    expect(region.textContent).toBe('')
  })

  it('shows the note only while pinned, and names the shipped view control', async () => {
    await renderTab()
    fireEvent.click(pinBtn())
    const note = await screen.findByText(PIN_NOTE)
    // The sentence names "Unbounded", the button's own label, so the two agree.
    expect(note.textContent).toContain('Unbounded')
    fireEvent.click(pinBtn())
    await waitFor(() => expect(screen.queryByText(PIN_NOTE)).toBe(null))
  })

  it('moves the DOM on every pin, and keeps the region text exactly the message', async () => {
    // React bails out when reconciling a text node to an identical string, so a
    // repeat announcement needs a real node replacement (v0.5.80). The note is a
    // key={pinSeq} child for that reason.
    //
    // WHAT THIS REJECTS, honestly: a region that stops being re-populated, and the
    // "append an invisible character to force a diff" fix (the textContent
    // assertion below). It does NOT reject dropping the key. Per CLAUDE.md's
    // v0.5.81 sharpening, mutation-counting only discriminates against an unkeyed
    // child when the message node stays PERMANENTLY MOUNTED and its text is
    // toggled. Here the note unmounts on unpin, exactly as Breeding Codes' does, so
    // the remount is already a real DOM addition and an unkeyed child passes this
    // same test. Verified by removing the key: 12/12 still passed. The key stays
    // because it is correct and free, not because this test is guarding it.
    const { container } = await renderTab()
    const region = container.querySelector('[role="status"]') as HTMLElement

    let mutations = 0
    const observer = new MutationObserver(records => { mutations += records.length })
    observer.observe(region, { childList: true, subtree: true, characterData: true })

    fireEvent.click(pinBtn())
    await screen.findByText(PIN_NOTE)
    fireEvent.click(pinBtn())
    await waitFor(() => expect(screen.queryByText(PIN_NOTE)).toBe(null))
    fireEvent.click(pinBtn())
    await screen.findByText(PIN_NOTE)
    observer.disconnect()

    // Two pins and one unpin: at minimum each has to have moved the DOM.
    expect(mutations).toBeGreaterThanOrEqual(3)
    // And the region's own text stays EXACTLY the message. Appending an invisible
    // character to force a diff is the wrong fix: it makes every textContent
    // assertion quietly false.
    expect(region.textContent).toBe(PIN_NOTE)
  })
})
