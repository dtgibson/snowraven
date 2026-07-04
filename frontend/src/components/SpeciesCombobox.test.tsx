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
