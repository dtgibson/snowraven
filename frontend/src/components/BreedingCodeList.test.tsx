// @vitest-environment jsdom

// Coverage for the Breeding Codes control row: the pinned-code-labels state
// machine, its accessible name and description, and its live region. All three
// live in BreedingCodeList (BreedingCodeTable only renders the class it is told
// to), so they can only be tested here.
//
// The tab autoloads from storage on mount, so the three seams it reaches through
// are mocked; everything else is the real component, including the real
// BreedingCodeTable, so the `pinned implies Unbounded` invariant is asserted
// against the class the table actually renders rather than against internal state.

import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import { render, screen, cleanup, waitFor, fireEvent } from '@testing-library/react'
import { BreedingCodeList } from './BreedingCodeList'

const CSV_HEADER = 'Common Name,Scientific Name,County,Date,Breeding Code\n'

const OBSERVATIONS = [
  { commonName: 'American Robin', scientificName: 'Turdus migratorius', date: '2024-05-01', county: 'Marin', breedingCode: 'NB' },
  { commonName: 'Song Sparrow', scientificName: 'Melospiza melodia', date: '2024-05-02', county: 'Marin', breedingCode: 'FL' },
]

vi.mock('../lib/storage', () => ({
  storage: {
    getFilesStatus: vi.fn(async () => ({ ebird: { name: 'MyEBirdData.csv' }, ml: null })),
  },
}))

vi.mock('../lib/observationsCache', () => ({
  loadEbirdObservations: vi.fn(async () => ({ headerLine: CSV_HEADER, observations: OBSERVATIONS })),
}))

vi.mock('../lib/transport', () => ({
  transport: { post: vi.fn(async () => ({ codes: {}, orders: {} })) },
}))

afterEach(cleanup)
beforeEach(() => { vi.clearAllMocks() })

/** Render the tab and wait for its autoload to settle. */
async function renderTab() {
  const view = render(<BreedingCodeList onGoToSettings={vi.fn()} />)
  await screen.findByRole('button', { name: 'Pin code labels' })
  return view
}

const pinBtn = () => screen.getByRole('button', { name: 'Pin code labels' })
const viewBtn = () => screen.getByRole('button', { name: /^↔/ })
const matrix = (container: HTMLElement) => container.querySelector('table') as HTMLElement
const isPinned = (container: HTMLElement) => matrix(container).classList.contains('sr-bc-matrix--pinned')
/** The Unbounded card class is present only in Unbounded (wideMode). */
const isUnbounded = (container: HTMLElement) => !!container.querySelector('.sr-bc-card')

const PIN_NOTE =
  'Code labels stay at the top while you scroll. Pinning uses the Unbounded view, so the matrix scrolls with the page.'

describe('pin control, name and description', () => {
  it('names the control by its visible text and nothing else', async () => {
    await renderTab()
    const btn = pinBtn()
    // No aria-label ANYWHERE on it: a second source of truth is how a published
    // accessible name once drifted from what the component emitted. With the name
    // coming from the button's own text, the two cannot disagree.
    expect(btn.getAttribute('aria-label')).toBe(null)
    expect(btn.getAttribute('aria-labelledby')).toBe(null)
    // "Pin code labels", not "Pin labels": the pin freezes the row of code headings
    // and nothing else, so naming the axis is what makes the label accurate. The
    // shorter name was only ever justified by a two-axis freeze the user reversed.
    expect(btn.textContent).toBe('Pin code labels')
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
    // label is still exactly the accessible name. Folding this sentence into the
    // name instead would break voice activation by the visible label.
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
    // Deliberate deviation, logged: the SHIPPED view toggle gains .sr-touch-target
    // too. The two are now a visual pair, so a 2.75rem pill beside the toggle's
    // inline 28px at ≤640 would read as a rendering error.
    expect(pinBtn().classList.contains('sr-touch-target')).toBe(true)
    expect(viewBtn().classList.contains('sr-touch-target')).toBe(true)
  })
})

describe('full-label filter pills', () => {
  it('uses the Breeding-Codes-only containment hooks and preserves the full label', async () => {
    const { container } = await renderTab()
    const row = container.querySelector('.sr-bc-filter-row') as HTMLElement
    expect(row).toBeTruthy()
    expect(row.classList.contains('sr-ctl-row')).toBe(true)

    const pill = screen.getByRole('button', { name: 'Recently Fledged Young (FL)' })
    expect(pill.classList.contains('sr-bc-filter-pill')).toBe(true)
    const label = pill.querySelector('.sr-bc-filter-pill-label') as HTMLElement
    expect(label).toBeTruthy()
    expect(label.textContent).toBe('Recently Fledged Young')
    expect(label.getAttribute('aria-hidden')).toBe(null)
    expect(pill.style.height).toBe('30px')
    expect(pill.style.minHeight).toBe('')

    // The special layout hook belongs only to the code pills. Category pills,
    // separators, sort, county and date controls remain ordinary row children.
    expect(row.querySelectorAll('.sr-bc-filter-pill')).toHaveLength(2)
    expect(row.querySelector('[role="group"]')?.classList.contains('sr-bc-filter-pill')).toBe(false)
    expect(row.querySelector('select')?.classList.contains('sr-bc-filter-pill')).toBe(false)
    expect(row.querySelector('input')?.classList.contains('sr-bc-filter-pill')).toBe(false)
  })
})

describe('the invariant: pinned implies Unbounded', () => {
  it('starts unpinned in Normal view, with the shipped rendering', async () => {
    const { container } = await renderTab()
    expect(isPinned(container)).toBe(false)
    expect(isUnbounded(container)).toBe(false)
    expect(screen.queryByText(PIN_NOTE)).toBe(null)
  })

  it('switches to Unbounded AND pins in a single press from Normal', async () => {
    // Rejects the two wrong shapes the design ruled out: a control that is disabled
    // or hidden in Normal (undiscoverable, since Normal is the default view), and
    // one that pins in place and silently builds a capped-height box.
    const { container } = await renderTab()
    fireEvent.click(pinBtn())
    await waitFor(() => expect(isPinned(container)).toBe(true))
    expect(isUnbounded(container)).toBe(true)
    expect(viewBtn().textContent).toContain('Normal')
  })

  it('restores the view it came from when unpinned, leaving no residue', async () => {
    // Rejects an implementation that unpins but strands the user in Unbounded: the
    // round trip has to land back exactly where it started.
    const { container } = await renderTab()
    fireEvent.click(pinBtn())
    await waitFor(() => expect(isUnbounded(container)).toBe(true))
    fireEvent.click(pinBtn())
    await waitFor(() => expect(isPinned(container)).toBe(false))
    expect(isUnbounded(container)).toBe(false)
    expect(viewBtn().textContent).toContain('Unbounded')
  })

  it('stays in Unbounded after a round trip that STARTED there', async () => {
    // The restore is to the remembered view, not a hardcoded Normal. Pinning from
    // Unbounded and unpinning must not kick the user back to Normal.
    const { container } = await renderTab()
    fireEvent.click(viewBtn())
    await waitFor(() => expect(isUnbounded(container)).toBe(true))
    fireEvent.click(pinBtn())
    await waitFor(() => expect(isPinned(container)).toBe(true))
    fireEvent.click(pinBtn())
    await waitFor(() => expect(isPinned(container)).toBe(false))
    expect(isUnbounded(container)).toBe(true)
  })

  it('clears the pin when the view toggle returns to Normal, and un-presses the pill', async () => {
    // The third direction, and the one that breaks the invariant if missed: Normal
    // cannot pin, so pressing "↔ Normal" while pinned must clear the pin AND show
    // it cleared in the same row, not leave a pressed pill over an unpinned table.
    const { container } = await renderTab()
    fireEvent.click(pinBtn())
    await waitFor(() => expect(isPinned(container)).toBe(true))
    fireEvent.click(viewBtn())
    await waitFor(() => expect(isUnbounded(container)).toBe(false))
    expect(isPinned(container)).toBe(false)
    expect(pinBtn().getAttribute('aria-pressed')).toBe('false')
    expect(screen.queryByText(PIN_NOTE)).toBe(null)
  })

  it('does not strand a stale remembered view: pin, leave via the view toggle, pin again, unpin', async () => {
    // Rejects keeping viewBeforePin around after the view toggle clears the pin. A
    // stale value would send the next unpin to a view the user never pinned from.
    const { container } = await renderTab()
    fireEvent.click(viewBtn())                                   // Normal -> Unbounded
    await waitFor(() => expect(isUnbounded(container)).toBe(true))
    fireEvent.click(pinBtn())                                    // pin (from Unbounded)
    await waitFor(() => expect(isPinned(container)).toBe(true))
    fireEvent.click(viewBtn())                                   // -> Normal, pin clears
    await waitFor(() => expect(isUnbounded(container)).toBe(false))
    fireEvent.click(pinBtn())                                    // pin (from Normal)
    await waitFor(() => expect(isPinned(container)).toBe(true))
    fireEvent.click(pinBtn())                                    // unpin -> back to Normal
    await waitFor(() => expect(isPinned(container)).toBe(false))
    expect(isUnbounded(container)).toBe(false)
  })
})

describe('the pinned status note and its live region', () => {
  const region = (container: HTMLElement) => container.querySelector('[role="status"]') as HTMLElement

  it('renders the live region from the start, empty, so its later text is announced', async () => {
    // Rejects `{pinned && <div role="status">...</div>}`. A region that mounts
    // together with its text is not a CHANGE to an existing region, and assistive
    // tech can miss the first (and most important) announcement entirely.
    const { container } = await renderTab()
    expect(region(container)).toBeTruthy()
    expect(region(container).textContent).toBe('')
  })

  it('shows the note while pinned and removes it when unpinned', async () => {
    const { container } = await renderTab()
    fireEvent.click(pinBtn())
    await waitFor(() => expect(region(container).textContent).toBe(PIN_NOTE))
    fireEvent.click(pinBtn())
    await waitFor(() => expect(region(container).textContent).toBe(''))
  })

  it('announces EVERY pin, including a repeat of the IDENTICAL message', async () => {
    // The bug this locks (v0.5.80): a live region whose text is set to the string it
    // already holds does not announce, because React bails out reconciling an
    // identical text node and the region's DOM never mutates. The wrong
    // implementation here is a note kept permanently mounted whose text is toggled
    // — the visible note would re-render every press while the announcement fired
    // once, which is exactly what makes it easy to miss. Measured as DOM mutations
    // rather than reasoned about.
    const { container } = await renderTab()
    const r = region(container)

    let additions = 0
    const observer = new MutationObserver(records => {
      for (const rec of records) additions += rec.addedNodes.length
    })
    observer.observe(r, { childList: true, characterData: true, subtree: true })

    fireEvent.click(pinBtn())                                   // pin
    await waitFor(() => expect(additions).toBeGreaterThan(0))
    const afterFirst = additions
    expect(r.textContent).toBe(PIN_NOTE)

    fireEvent.click(pinBtn())                                   // unpin
    await waitFor(() => expect(r.textContent).toBe(''))

    fireEvent.click(pinBtn())                                   // pin again, same message
    await waitFor(() => expect(additions).toBeGreaterThan(afterFirst))

    observer.disconnect()
    // The region still reads exactly the message: the repeat is carried by a node
    // replacement, not by smuggling an invisible character into the text (which
    // would make every textContent assertion here quietly false).
    expect(r.textContent).toBe(PIN_NOTE)
  })

  it('keeps the note out of the em-dash-free copy surface and names the shipped control', async () => {
    await renderTab()
    fireEvent.click(pinBtn())
    const note = await screen.findByText(PIN_NOTE)
    expect(note.textContent).not.toContain('—')
    // Names the view control by its shipped label, so the sentence and the button
    // on screen agree.
    expect(note.textContent).toContain('Unbounded')
  })

  it('describes the ONE frozen axis, and never claims the name column freezes', async () => {
    // Holds the reversal in the published sentence, not just in the styling. A
    // two-axis note was shipped and reversed; a note claiming the species names
    // freeze would be prose the code does not implement, which is the exact defect
    // this repo has shipped repeatedly in this area.
    await renderTab()
    fireEvent.click(pinBtn())
    const note = await screen.findByText(PIN_NOTE)
    expect(note.textContent).toContain('Code labels')
    expect(note.textContent).not.toContain('Species names')
  })
})
