// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react'
import { TabNav, type NavItem } from './TabNav'

// TabNav collapses to the dropdown when the bar would overflow, measured via
// clientWidth (wrapper) vs scrollWidth (hidden probe). jsdom reports 0 for both,
// so we stub the prototype getters to deterministically force either mode.
function forceMode(mode: 'bar' | 'dropdown') {
  // bar: lots of room (clientWidth big) and a narrow probe (scrollWidth small)
  // dropdown: no room (clientWidth 0) so needed > available is always true
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
    configurable: true,
    get() { return mode === 'bar' ? 5000 : 0 },
  })
  Object.defineProperty(HTMLElement.prototype, 'scrollWidth', {
    configurable: true,
    get() { return mode === 'bar' ? 100 : 1000 },
  })
}

const items: NavItem[] = [
  { id: 'weather', label: 'Weather', icon: null },
  { id: 'map-explorer', label: 'Map Explorer', icon: null },
  { id: 'settings', label: 'Settings', icon: null },
]

beforeEach(() => {
  // ResizeObserver is referenced in a layout effect; provide a no-op.
  ;(globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
})

afterEach(() => {
  cleanup()
  // restore the stubbed getters
  delete (HTMLElement.prototype as unknown as { clientWidth?: unknown }).clientWidth
  delete (HTMLElement.prototype as unknown as { scrollWidth?: unknown }).scrollWidth
})

describe('TabNav desktop bar', () => {
  beforeEach(() => forceMode('bar'))

  it('exposes a navigation landmark distinct from the tablist (role not on the nav)', () => {
    render(<TabNav items={items} activeTab="weather" onSelect={() => {}} />)
    const nav = screen.getByRole('navigation', { name: 'Main navigation' })
    expect(nav.tagName).toBe('NAV')
    // The nav must NOT itself be the tablist — that would override the landmark.
    expect(nav.getAttribute('role')).toBeNull()
    // The tablist is a descendant.
    expect(within(nav).getByRole('tablist')).toBeTruthy()
  })

  it('Home / End move selection to the first / last tab', () => {
    const onSelect = vi.fn()
    render(<TabNav items={items} activeTab="map-explorer" onSelect={onSelect} />)
    const tablist = screen.getByRole('tablist')
    fireEvent.keyDown(tablist, { key: 'End' })
    expect(onSelect).toHaveBeenCalledWith('settings')
    fireEvent.keyDown(tablist, { key: 'Home' })
    expect(onSelect).toHaveBeenCalledWith('weather')
  })

  it('ArrowRight/ArrowLeft still wrap around', () => {
    const onSelect = vi.fn()
    render(<TabNav items={items} activeTab="settings" onSelect={onSelect} />)
    const tablist = screen.getByRole('tablist')
    fireEvent.keyDown(tablist, { key: 'ArrowRight' })
    expect(onSelect).toHaveBeenCalledWith('weather') // wrap past the end
  })
})

describe('TabNav collapsed dropdown', () => {
  beforeEach(() => forceMode('dropdown'))

  it('wraps the trigger + listbox in a navigation landmark', () => {
    render(<TabNav items={items} activeTab="weather" onSelect={() => {}} />)
    expect(screen.getByRole('navigation', { name: 'Main navigation' })).toBeTruthy()
  })

  it('trigger references the listbox via aria-controls', () => {
    render(<TabNav items={items} activeTab="weather" onSelect={() => {}} />)
    const trigger = screen.getByRole('button', { name: /Navigation, current view/ })
    expect(trigger.getAttribute('aria-controls')).toBe('tab-nav-listbox')
    fireEvent.click(trigger)
    expect(screen.getByRole('listbox').id).toBe('tab-nav-listbox')
  })

  it('options use distinct ids (tabopt-) so they never satisfy a panel aria-labelledby="tab-id"', () => {
    render(<TabNav items={items} activeTab="weather" onSelect={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: /Navigation, current view/ }))
    const opts = screen.getAllByRole('option')
    for (const opt of opts) {
      expect(opt.id.startsWith('tabopt-')).toBe(true)
      expect(opt.id.startsWith('tab-')).toBe(false)
    }
    // and there is no dangling aria-activedescendant on the listbox
    expect(screen.getByRole('listbox').getAttribute('aria-activedescendant')).toBeNull()
  })

  it('options are removed from the tab sequence (roving focus)', () => {
    render(<TabNav items={items} activeTab="weather" onSelect={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: /Navigation, current view/ }))
    for (const opt of screen.getAllByRole('option')) {
      expect(opt.getAttribute('tabindex')).toBe('-1')
    }
  })

  it('Tab closes the menu and returns focus to the trigger (no drop to body)', () => {
    render(<TabNav items={items} activeTab="weather" onSelect={() => {}} />)
    const trigger = screen.getByRole('button', { name: /Navigation, current view/ })
    fireEvent.click(trigger)
    const listbox = screen.getByRole('listbox')
    fireEvent.keyDown(listbox, { key: 'Tab' })
    // menu closed
    expect(screen.queryByRole('listbox')).toBeNull()
    // focus is back on the trigger, NOT body
    expect(document.activeElement).toBe(trigger)
  })
})
