// @vitest-environment jsdom
//
// Locks the a11y + interaction contract of the shared searchable species combobox:
// typing filters, Enter selects the active/first option, Arrow keys move the active
// option, the "All species" clearing row calls onChange(null), and Escape/Tab close
// the listbox. Selection SIDE-EFFECTS live in the parent — this only asserts the
// onChange payload + open/closed state.

import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent, within } from '@testing-library/react'
import { SpeciesCombobox } from './SpeciesCombobox'

const OPTIONS = [
  { name: 'American Robin', sciName: 'Turdus migratorius' },
  { name: 'Blue Jay', sciName: 'Cyanocitta cristata' },
  { name: 'American Crow', sciName: 'Corvus brachyrhynchos' },
]

afterEach(cleanup)

function renderCombo(overrides: Partial<React.ComponentProps<typeof SpeciesCombobox>> = {}) {
  const onChange = vi.fn()
  render(
    <SpeciesCombobox
      options={OPTIONS}
      value={null}
      onChange={onChange}
      ariaLabel="Select species"
      {...overrides}
    />,
  )
  const input = screen.getByRole('combobox', { name: 'Select species' }) as HTMLInputElement
  return { onChange, input }
}

describe('SpeciesCombobox', () => {
  it('opens on focus and lists every option', async () => {
    const { input } = renderCombo()
    fireEvent.focus(input)
    const listbox = screen.getByRole('listbox')
    const labels = within(listbox).getAllByRole('option').map(o => o.textContent)
    expect(labels.some(l => l?.includes('American Robin'))).toBe(true)
    expect(labels.some(l => l?.includes('Blue Jay'))).toBe(true)
    expect(labels.some(l => l?.includes('American Crow'))).toBe(true)
  })

  it('typing filters the list (common OR scientific name, case-insensitive)', () => {
    const { input } = renderCombo()
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: 'jay' } })
    let labels = within(screen.getByRole('listbox')).getAllByRole('option').map(o => o.textContent)
    expect(labels.some(l => l?.includes('Blue Jay'))).toBe(true)
    expect(labels.some(l => l?.includes('American Robin'))).toBe(false)
    // Scientific-name match.
    fireEvent.change(input, { target: { value: 'corvus' } })
    labels = within(screen.getByRole('listbox')).getAllByRole('option').map(o => o.textContent)
    expect(labels.some(l => l?.includes('American Crow'))).toBe(true)
    expect(labels.some(l => l?.includes('Blue Jay'))).toBe(false)
  })

  it('Enter selects the active option (Arrow moves active)', () => {
    const { input, onChange } = renderCombo()
    fireEvent.focus(input)
    // Arrow down once → first option (American Robin) active; Enter selects it.
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onChange).toHaveBeenCalledWith('American Robin')
  })

  it('Enter with no active option selects the first filtered option', () => {
    const { input, onChange } = renderCombo()
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: 'crow' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onChange).toHaveBeenCalledWith('American Crow')
  })

  it('with allLabel, Enter after typing (no arrow) selects the first MATCH, not the All row', () => {
    const { input, onChange } = renderCombo({ allLabel: 'All species' })
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: 'robin' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onChange).toHaveBeenCalledWith('American Robin')
    expect(onChange).not.toHaveBeenCalledWith(null)
  })

  it('with allLabel, Enter on a query with zero matches is a no-op (never silently resets to All)', () => {
    const { input, onChange } = renderCombo({ allLabel: 'All species' })
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: 'zzz-no-match' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onChange).not.toHaveBeenCalled()
  })

  it('Arrow keys move the active option (aria-activedescendant tracks it)', () => {
    const { input } = renderCombo()
    fireEvent.focus(input)
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    const firstActive = input.getAttribute('aria-activedescendant')
    expect(firstActive).toBeTruthy()
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    const secondActive = input.getAttribute('aria-activedescendant')
    expect(secondActive).toBeTruthy()
    expect(secondActive).not.toBe(firstActive)
  })

  it('the "All species" clearing row calls onChange(null)', () => {
    const { input, onChange } = renderCombo({ allLabel: 'All species' })
    fireEvent.focus(input)
    const listbox = screen.getByRole('listbox')
    const options = within(listbox).getAllByRole('option')
    // The clearing row is first.
    expect(options[0].textContent).toContain('All species')
    fireEvent.click(options[0])
    expect(onChange).toHaveBeenCalledWith(null)
  })

  it('the "All species" row survives a filter (never filtered out) and is arrow-reachable first', () => {
    const { input } = renderCombo({ allLabel: 'All species' })
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: 'robin' } })
    const labels = within(screen.getByRole('listbox')).getAllByRole('option').map(o => o.textContent)
    expect(labels[0]).toContain('All species')
    expect(labels.some(l => l?.includes('American Robin'))).toBe(true)
    expect(labels.some(l => l?.includes('Blue Jay'))).toBe(false)
  })

  it('Escape closes the listbox', () => {
    const { input } = renderCombo()
    fireEvent.focus(input)
    expect(screen.queryByRole('listbox')).toBeTruthy()
    fireEvent.keyDown(input, { key: 'Escape' })
    expect(screen.queryByRole('listbox')).toBeNull()
  })

  it('Escape is consumed while the listbox is open and bubbles once closed (innermost layer first)', () => {
    // The Map Explorer filter sheet and fullscreen exit are bubble-phase
    // document-level Escape listeners. One press with the listbox open must
    // close ONLY the listbox (the QA defect: it also closed the whole sheet);
    // a press with it closed must still reach them, which is the sheet's
    // shipped close path. Species Detail and the Calendar have no outer
    // Escape layers, so this changes nothing there.
    const outer = vi.fn()
    document.addEventListener('keydown', outer)
    try {
      const { input } = renderCombo()
      fireEvent.focus(input)
      expect(screen.queryByRole('listbox')).toBeTruthy()
      fireEvent.keyDown(input, { key: 'Escape' })
      expect(screen.queryByRole('listbox')).toBeNull()
      expect(outer).not.toHaveBeenCalled()
      fireEvent.keyDown(input, { key: 'Escape' })
      expect(outer).toHaveBeenCalledTimes(1)
    } finally {
      document.removeEventListener('keydown', outer)
    }
  })

  it('Tab closes the listbox', () => {
    const { input } = renderCombo()
    fireEvent.focus(input)
    expect(screen.queryByRole('listbox')).toBeTruthy()
    fireEvent.keyDown(input, { key: 'Tab' })
    expect(screen.queryByRole('listbox')).toBeNull()
  })

  it('shows the selected value in the input when closed and a check on its option', () => {
    const { input } = renderCombo({ value: 'Blue Jay' })
    expect(input.value).toBe('Blue Jay')
    fireEvent.focus(input)
    const jay = within(screen.getByRole('listbox')).getAllByRole('option').find(o => o.textContent?.includes('Blue Jay'))!
    expect(jay.getAttribute('aria-selected')).toBe('true')
  })

  it('panel size maps onto the Map Explorer SELECT_STYLE register (34px, 0.8125rem, radius 6, full width)', () => {
    const { input } = renderCombo({ size: 'panel' })
    expect(input.style.height).toBe('34px')
    expect(input.style.fontSize).toBe('0.8125rem')
    expect(input.style.borderRadius).toBe('6px')
    // Full panel width: no sm-style 220px cap on the root.
    const root = input.parentElement!.parentElement as HTMLElement
    expect(root.style.maxWidth).toBe('')
    fireEvent.focus(input)
    expect(input.style.borderRadius).toBe('6px 6px 0 0')
    expect(screen.getByRole('listbox').style.borderRadius).toBe('0 0 6px 6px')
  })

  it('panel size filters by typing exactly like the other sizes (All row survives)', () => {
    const { input } = renderCombo({ size: 'panel', allLabel: 'All species' })
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: 'cyanocitta' } })
    const labels = within(screen.getByRole('listbox')).getAllByRole('option').map(o => o.textContent)
    expect(labels[0]).toContain('All species')
    expect(labels.some(l => l?.includes('Blue Jay'))).toBe(true)
    expect(labels.some(l => l?.includes('American Robin'))).toBe(false)
  })

  it('sm register is unchanged by the panel variant (Calendar regression guard)', () => {
    const { input } = renderCombo({ size: 'sm' })
    expect(input.style.height).toBe('30px')
    expect(input.style.fontSize).toBe('0.75rem')
    expect(input.style.borderRadius).toBe('8px')
    const root = input.parentElement!.parentElement as HTMLElement
    expect(root.style.maxWidth).toBe('220px')
    fireEvent.focus(input)
    expect(input.style.borderRadius).toBe('8px 8px 0 0')
    expect(screen.getByRole('listbox').style.borderRadius).toBe('0 0 8px 8px')
  })

  it('md register is unchanged by the panel variant (Species Detail regression guard)', () => {
    const { input } = renderCombo({ size: 'md' })
    expect(input.style.height).toBe('40px')
    expect(input.style.fontSize).toBe('0.875rem')
    expect(input.style.borderRadius).toBe('8px')
    const root = input.parentElement!.parentElement as HTMLElement
    expect(root.style.maxWidth).toBe('')
    fireEvent.focus(input)
    expect(input.style.borderRadius).toBe('8px 8px 0 0')
    expect(screen.getByRole('listbox').style.borderRadius).toBe('0 0 8px 8px')
  })

  it('the listbox carries the shared entrance-motion class in every size', () => {
    for (const size of ['sm', 'md', 'panel'] as const) {
      const { input } = renderCombo({ size })
      fireEvent.focus(input)
      expect(screen.getByRole('listbox').classList.contains('sr-combobox-list')).toBe(true)
      cleanup()
    }
  })

  it('row layout keeps the common name primary: sci span capped at 40%, both spans truncate', () => {
    // The live-preview defect (v1.0.7 QA): the name span's flex-basis is 0, so
    // without a cap the sci span's auto basis is served FIRST and the secondary
    // text crushes the primary toward a zero-width box in a narrow listbox
    // (measured 0px at 200% text scale in the Map Explorer panel). These are
    // the layout properties the browser-measured fix rests on; the geometric
    // claim itself (no crush at 240-300px / 200%) is a browser measurement
    // recorded in the PR notes, which jsdom cannot make.
    for (const size of ['sm', 'md', 'panel'] as const) {
      const { input } = renderCombo({ size })
      fireEvent.focus(input)
      const row = within(screen.getByRole('listbox')).getAllByRole('option')
        .find(o => o.textContent?.includes('Turdus migratorius'))!
      const spans = row.querySelectorAll('span')
      const name = spans[1] as HTMLElement
      const sci = spans[2] as HTMLElement
      expect(name.style.flex).toBe('1 1 0%') // basis 0: the name GROWS into free space
      expect(sci.style.maxWidth).toBe('40%')
      expect(sci.style.flex).toBe('0 1 auto')
      // .sr-truncate's overflow clipping is what turns crowding into ellipsis
      // truncation instead of one text painting over the other.
      expect(name.classList.contains('sr-truncate')).toBe(true)
      expect(sci.classList.contains('sr-truncate')).toBe(true)
      cleanup()
    }
  })

  it('useId-namespaces its listbox id so two instances do not collide', () => {
    const onChange = vi.fn()
    render(
      <>
        <SpeciesCombobox options={OPTIONS} value={null} onChange={onChange} ariaLabel="First" />
        <SpeciesCombobox options={OPTIONS} value={null} onChange={onChange} ariaLabel="Second" />
      </>,
    )
    const a = screen.getByRole('combobox', { name: 'First' })
    const b = screen.getByRole('combobox', { name: 'Second' })
    expect(a.getAttribute('aria-controls')).not.toBe(b.getAttribute('aria-controls'))
  })
})
