// @vitest-environment jsdom
//
// The nav's WIRING at all three densities (feature: nav-rework).
//
// WHAT THIS FILE CAN AND CANNOT SEE. jsdom has no layout engine, so every width
// here is a number this file handed the component: it proves that the sidebar
// renders when the derivation says sidebar, never that the derivation is right.
// The arithmetic is pinned in lib/navDensity.test.ts against the design's own
// worked table, and the layout claims the design makes (the label ink fitting its
// cell, the container query dropping labels at 200% text scale, the column not
// clipping a label) are BROWSER measurements that neither file can stand in for.
//
// It also has no tab order — .claude/rules/ui.md says so outright — so nothing
// here is evidence about WebKit's real ordering. What is asserted is the
// attribute, which is the property that makes the engine's order irrelevant;
// lib/tabOrderCoverage.test.ts owns that claim over the whole tree.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useState } from 'react'
import { render, screen, fireEvent, cleanup, within, act } from '@testing-library/react'
import { TabNav, type NavItem, type TabNavProps } from './TabNav'
import type { ContentReserve } from '../lib/navDensity'

// A glyph the tests can find without caring what it draws.
const icon = ({ size }: { size: number }) => <svg data-size={size} aria-hidden="true" />

const ELEVEN: NavItem[] = [
  { id: 'weather', label: 'Weather', icon },
  { id: 'birding-stats', label: 'Statistics', icon },
  { id: 'calendar', label: 'Calendar', icon },
  { id: 'species-detail', label: 'Species Detail', icon },
  { id: 'map-explorer', label: 'Map Explorer', icon },
  { id: 'life-list', label: 'Multimedia', icon },
  { id: 'breeding-codes', label: 'Breeding Codes', icon },
  { id: 'checklists', label: 'Checklists', icon },
  { id: 'comparer', label: 'List Comparer', icon },
  { id: 'named-birds', label: 'Named Birds', icon },
  { id: 'settings', label: 'Settings', icon },
]

/** jsdom reports 0 for every box, so the shell's width is stubbed on the prototype. */
function stubShellWidth(px: number) {
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
    configurable: true,
    get() { return px },
  })
}

interface HarnessProps extends Partial<Omit<TabNavProps, 'shell'>> {
  width?: number
}

/**
 * Mounts TabNav inside a stand-in shell, which is the box the derivation reads.
 *
 * The shell arrives as STATE, exactly as it does in App, because React attaches a
 * parent's ref only after its children's layout effects have run — a ref here
 * would reproduce the bug rather than the shipped wiring.
 */
function Harness({ width = 1512, ...props }: HarnessProps) {
  const [shell, setShell] = useState<HTMLElement | null>(null)
  void width
  return (
    <div ref={setShell} data-testid="shell">
      <TabNav
        items={ELEVEN}
        activeTab="weather"
        onSelect={() => {}}
        isPhone={false}
        reserve={'none' as ContentReserve}
        {...props}
        shell={shell}
      />
    </div>
  )
}

function renderNav(props: HarnessProps = {}) {
  stubShellWidth(props.width ?? 1512)
  return render(<Harness {...props} />)
}

beforeEach(() => {
  ;(globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
})

afterEach(() => {
  cleanup()
  delete (HTMLElement.prototype as unknown as { clientWidth?: unknown }).clientWidth
  document.documentElement.style.removeProperty('--sr-navbar-h')
})

// ---------------------------------------------------------------------------

describe('density 1 — the sidebar', () => {
  it('exposes a navigation landmark distinct from the tablist (role not on the nav)', () => {
    renderNav()
    const nav = screen.getByRole('navigation', { name: 'Main navigation' })
    expect(nav.tagName).toBe('NAV')
    // The nav must NOT itself be the tablist — that would override the landmark.
    expect(nav.getAttribute('role')).toBeNull()
    expect(within(nav).getByRole('tablist')).toBeTruthy()
  })

  it('is the shipped tablist ROTATED, not a new pattern', () => {
    renderNav()
    const tablist = screen.getByRole('tablist')
    expect(tablist.getAttribute('aria-orientation')).toBe('vertical')
    // Every destination keeps its tab-{id} / panel-{id} wiring, so App's panels
    // still resolve their aria-labelledby.
    for (const item of ELEVEN) {
      const tab = document.getElementById(`tab-${item.id}`)!
      expect(tab.getAttribute('role')).toBe('tab')
      expect(tab.getAttribute('aria-controls')).toBe(`panel-${item.id}`)
    }
  })

  it('holds ONE tab stop and moves the rest to -1 (the roving group)', () => {
    renderNav({ activeTab: 'calendar' })
    const stops = ELEVEN.map(i => document.getElementById(`tab-${i.id}`)!.getAttribute('tabindex'))
    expect(stops.filter(t => t === '0')).toHaveLength(1)
    expect(document.getElementById('tab-calendar')!.getAttribute('tabindex')).toBe('0')
  })

  it('Up / Down replace Left / Right, and both still wrap', () => {
    const onSelect = vi.fn()
    renderNav({ activeTab: 'weather', onSelect })
    const tablist = screen.getByRole('tablist')
    fireEvent.keyDown(tablist, { key: 'ArrowDown' })
    expect(onSelect).toHaveBeenCalledWith('birding-stats')
    fireEvent.keyDown(tablist, { key: 'ArrowUp' })
    expect(onSelect).toHaveBeenCalledWith('settings')   // wrap past the start
  })

  it('Home / End move to the first / last destination', () => {
    const onSelect = vi.fn()
    renderNav({ activeTab: 'calendar', onSelect })
    const tablist = screen.getByRole('tablist')
    fireEvent.keyDown(tablist, { key: 'End' })
    expect(onSelect).toHaveBeenCalledWith('settings')
    fireEvent.keyDown(tablist, { key: 'Home' })
    expect(onSelect).toHaveBeenCalledWith('weather')
  })

  it('every role="tab" is INSIDE the one tablist, separator included', () => {
    // The mockup drew the Settings hairline outside the tablist with Settings
    // after it, which would have put a role="tab" outside its own group. The
    // hairline is aria-hidden instead, so the tablist's children are all tabs.
    renderNav()
    const tablist = screen.getByRole('tablist')
    expect(within(tablist).getAllByRole('tab')).toHaveLength(ELEVEN.length)
    const sep = tablist.querySelector('hr.sr-nav-sep')!
    expect(sep.getAttribute('aria-hidden')).toBe('true')
    // ...and it sits immediately before Settings, which is the only structural
    // claim the separator makes.
    expect(sep.nextElementSibling?.id).toBe('tab-settings')
  })

  it('carries the page h1 and the tagline, which moved out of the page header', () => {
    renderNav()
    const h1 = screen.getByRole('heading', { level: 1 })
    expect(h1.textContent).toBe('SnowRaven')
    expect(h1.className).not.toContain('sr-only')
    expect(screen.getByText('Self-hosted birding tools and data explorer')).toBeTruthy()
  })
})

describe('density 2 — the icon rail', () => {
  // 834px is iPad portrait: 834 - 216 = 618, under the 640 floor.
  const RAIL = { width: 834 }

  it('renders the rail rather than the sidebar', () => {
    renderNav(RAIL)
    expect(document.querySelector('.sr-nav-col--rail')).toBeTruthy()
  })

  it('names every destination, because the label is not on screen', () => {
    renderNav(RAIL)
    for (const item of ELEVEN) {
      expect(document.getElementById(`tab-${item.id}`)!.getAttribute('aria-label')).toBe(item.label)
    }
  })

  it('keeps an h1 on the page, visually hidden', () => {
    renderNav(RAIL)
    const h1 = screen.getByRole('heading', { level: 1 })
    expect(h1.textContent).toBe('SnowRaven')
    expect(h1.className).toContain('sr-only')
  })

  it('offers NO collapse control, because there is no room to collapse into', () => {
    renderNav(RAIL)
    expect(screen.queryByRole('button', { name: /navigation$/i })).toBeNull()
  })

  it('shows the tooltip on hover and takes it away again', () => {
    renderNav(RAIL)
    const tab = document.getElementById('tab-calendar')!
    fireEvent.mouseEnter(tab)
    expect(screen.getByText('Calendar', { selector: '.sr-nav-tip' })).toBeTruthy()
    fireEvent.mouseLeave(tab)
    expect(document.querySelector('.sr-nav-tip')).toBeNull()
  })

  it('the tooltip is aria-hidden, so the aria-label is not announced twice', () => {
    renderNav(RAIL)
    fireEvent.mouseEnter(document.getElementById('tab-calendar')!)
    expect(document.querySelector('.sr-nav-tip')!.getAttribute('aria-hidden')).toBe('true')
  })

  it('Escape dismisses it without swallowing the key from anything else', () => {
    const outer = vi.fn()
    document.addEventListener('keydown', outer)
    renderNav(RAIL)
    fireEvent.mouseEnter(document.getElementById('tab-calendar')!)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(document.querySelector('.sr-nav-tip')).toBeNull()
    // The map's fullscreen-exit and sidebar-close handlers are bubble-phase
    // document listeners; dismissing a tooltip must not consume their key.
    expect(outer).toHaveBeenCalled()
    document.removeEventListener('keydown', outer)
  })
})

describe('the collapse control', () => {
  it('appears only at a DERIVED sidebar, and steps it down to the rail', () => {
    renderNav({ width: 1512 })
    const toggle = screen.getByRole('button', { name: 'Collapse navigation' })
    expect(toggle.getAttribute('aria-expanded')).toBe('true')
    expect(toggle.getAttribute('tabindex')).toBe('0')

    fireEvent.click(toggle)
    expect(document.querySelector('.sr-nav-col--rail')).toBeTruthy()
    const expand = screen.getByRole('button', { name: 'Expand navigation' })
    expect(expand.getAttribute('aria-expanded')).toBe('false')

    fireEvent.click(expand)
    expect(document.querySelector('.sr-nav-col--rail')).toBeNull()
  })

  it('survives into the collapsed rail, or there would be no way back', () => {
    renderNav({ width: 1512 })
    fireEvent.click(screen.getByRole('button', { name: 'Collapse navigation' }))
    expect(screen.getByRole('button', { name: 'Expand navigation' })).toBeTruthy()
  })
})

describe('the width transition runs on the MANUAL toggle only', () => {
  // A derived change happens continuously during a window drag; animating it
  // reflows the content column every frame, which on the Map Explorer tab is a
  // MapLibre resize storm. This is the guard on that.

  it('a manual collapse animates', () => {
    renderNav({ width: 1512 })
    fireEvent.click(screen.getByRole('button', { name: 'Collapse navigation' }))
    expect(document.querySelector('.sr-nav-col')!.className).toContain('sr-nav-col--anim')
  })

  it('and stops animating once the width transition has settled', () => {
    renderNav({ width: 1512 })
    const col = document.querySelector('.sr-nav-col')!
    fireEvent.click(screen.getByRole('button', { name: 'Collapse navigation' }))
    fireEvent.transitionEnd(col, { propertyName: 'width' })
    expect(col.className).not.toContain('sr-nav-col--anim')
  })

  it('ignores a transitionend that BUBBLED from a row rather than the column', () => {
    // transitionend bubbles, so a row's background-color transition reaches the
    // same handler. Without the target-and-property gate the class would be
    // dropped mid-animation.
    renderNav({ width: 1512 })
    const col = document.querySelector('.sr-nav-col')!
    fireEvent.click(screen.getByRole('button', { name: 'Collapse navigation' }))
    fireEvent.transitionEnd(document.getElementById('tab-weather')!, { propertyName: 'background-color' })
    expect(col.className).toContain('sr-nav-col--anim')
    fireEvent.transitionEnd(col, { propertyName: 'background-color' })
    expect(col.className).toContain('sr-nav-col--anim')
  })

  it('a DERIVED change never animates', () => {
    const { rerender } = renderNav({ width: 1512 })
    expect(document.querySelector('.sr-nav-col--rail')).toBeNull()
    // The window narrows past the floor. No class, no transition, no reflow storm.
    stubShellWidth(834)
    act(() => { rerender(<Harness width={834} />) })
    expect(document.querySelector('.sr-nav-col--rail')).toBeTruthy()
    expect(document.querySelector('.sr-nav-col')!.className).not.toContain('sr-nav-col--anim')
  })
})

describe('density 3 — the phone bottom bar', () => {
  const phone = (props: HarnessProps = {}) => renderNav({ isPhone: true, ...props })

  it('shows the first four of the saved visible order, plus More', () => {
    phone()
    const cells = document.querySelectorAll('.sr-navbar-cell')
    expect(cells).toHaveLength(5)
    expect([...cells].map(c => c.textContent)).toEqual([
      'Weather', 'Statistics', 'Calendar', 'Species Detail', 'More',
    ])
  })

  it('follows the user\'s saved order, since that is what chooses the favourites', () => {
    const reordered = [ELEVEN[6], ELEVEN[0], ...ELEVEN.slice(1, 6), ...ELEVEN.slice(7)]
    phone({ items: reordered })
    expect(document.querySelector('.sr-navbar-cell')!.textContent).toBe('Breeding Codes')
  })

  it('is NOT a roving group: every cell is a literal tab stop', () => {
    phone()
    for (const cell of document.querySelectorAll('.sr-navbar-cell')) {
      expect(cell.getAttribute('tabindex')).toBe('0')
    }
    // ...and it is not a tablist, which could not legally contain the More button.
    expect(screen.queryByRole('tablist')).toBeNull()
    expect(screen.queryAllByRole('tab')).toHaveLength(0)
  })

  it('marks the active favourite with aria-current and nothing else', () => {
    phone({ activeTab: 'calendar' })
    const current = document.querySelectorAll('[aria-current="true"]')
    expect(current).toHaveLength(1)
    expect(current[0].textContent).toBe('Calendar')
  })

  it('gives MORE the active treatment when the active destination is under it', () => {
    // The bar is never showing nothing selected, and the label stays "More".
    phone({ activeTab: 'named-birds' })
    const more = screen.getByRole('button', { name: 'More destinations' })
    expect(more.className).toContain('sr-navbar-cell--active')
    expect(more.textContent).toBe('More')
    expect(document.querySelectorAll('.sr-navbar-cell--active')).toHaveLength(1)
  })

  it('Settings is never a favourite — it is appended, not part of the saved order', () => {
    phone()
    expect(screen.queryByRole('button', { name: 'Settings' })).toBeNull()
  })

  it('adapts its cell count when the user has hidden nearly everything', () => {
    phone({ items: [ELEVEN[0], ELEVEN[10]] })
    const bar = document.querySelector('.sr-navbar') as HTMLElement
    expect(bar.style.getPropertyValue('--sr-navbar-cells')).toBe('2')
  })

  it('publishes its measured height while mounted, and takes it back on unmount', () => {
    // The bar is fixed, so the page needs the number to clear it and the map
    // panel needs it added to the chrome. A stale value after a density flip
    // would leave dead space at the bottom of every tab.
    const rect = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect')
      .mockReturnValue({ height: 57, width: 390, top: 0, bottom: 57, left: 0, right: 390, x: 0, y: 0, toJSON: () => ({}) } as DOMRect)
    const { unmount } = phone()
    expect(document.documentElement.style.getPropertyValue('--sr-navbar-h')).toBe('57px')
    unmount()
    expect(document.documentElement.style.getPropertyValue('--sr-navbar-h')).toBe('')
    rect.mockRestore()
  })
})

describe('the More sheet', () => {
  const openSheet = (props: HarnessProps = {}) => {
    const r = renderNav({ isPhone: true, ...props })
    fireEvent.click(screen.getByRole('button', { name: 'More destinations' }))
    return r
  }

  it('is a modal dialog naming itself', () => {
    openSheet()
    const dialog = screen.getByRole('dialog', { name: 'More destinations' })
    expect(dialog.getAttribute('aria-modal')).toBe('true')
    expect(within(dialog).getByRole('heading', { level: 2 }).textContent).toBe('More')
  })

  it('holds the destinations the bar could not, in the saved order', () => {
    openSheet()
    const rows = document.querySelectorAll('.sr-nav-sheet .sr-nav-item')
    expect([...rows].map(r => r.textContent)).toEqual([
      'Map Explorer', 'Multimedia', 'Breeding Codes', 'Checklists',
      'List Comparer', 'Named Birds', 'Settings',
    ])
  })

  it('rows are PLAIN tab stops — this is what retired the dropdown listbox', () => {
    openSheet()
    for (const row of document.querySelectorAll('.sr-nav-sheet .sr-nav-item')) {
      expect(row.getAttribute('tabindex')).toBe('0')
      expect(row.getAttribute('role')).toBeNull()
    }
    expect(screen.queryAllByRole('option')).toHaveLength(0)
    expect(screen.queryByRole('listbox')).toBeNull()
  })

  it('keeps the structural hairline above Settings here too', () => {
    openSheet()
    const sep = document.querySelector('.sr-nav-sheet hr.sr-nav-sep')!
    expect(sep.getAttribute('aria-hidden')).toBe('true')
    expect(sep.nextElementSibling?.textContent).toBe('Settings')
  })

  it('announces itself as open on the button that opened it', () => {
    openSheet()
    expect(screen.getByRole('button', { name: 'More destinations' }).getAttribute('aria-expanded')).toBe('true')
  })

  it('Escape closes it and returns focus to the More button', () => {
    openSheet()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'More destinations' }))
  })

  it('the backdrop closes it, and a drag out of the panel does not', () => {
    openSheet()
    const root = screen.getByRole('dialog')
    // A mousedown that STARTED inside the panel and ended on the backdrop must
    // not close it, which is why this is mousedown-on-target rather than click.
    fireEvent.mouseDown(document.querySelector('.sr-nav-sheet')!)
    expect(screen.queryByRole('dialog')).toBeTruthy()
    fireEvent.mouseDown(root)
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('choosing a destination selects it, closes, and returns focus', () => {
    const onSelect = vi.fn()
    openSheet({ onSelect })
    fireEvent.click(screen.getByRole('button', { name: 'Named Birds' }))
    expect(onSelect).toHaveBeenCalledWith('named-birds')
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'More destinations' }))
  })

  it('marks the active destination when it lives in here', () => {
    openSheet({ activeTab: 'named-birds' })
    const row = screen.getByRole('button', { name: 'Named Birds' })
    expect(row.getAttribute('aria-current')).toBe('true')
    expect(row.className).toContain('sr-nav-item--active')
  })
})

describe('the fullscreen map takes the whole nav out of the tab order', () => {
  it('marks the nav column inert', () => {
    renderNav({ inert: true })
    expect(document.querySelector('.sr-nav-col')!.hasAttribute('inert')).toBe(true)
  })

  it('and leaves it alone otherwise — React 19 emits inert={false} as absent', () => {
    // Pre-19 rendered the truthy string inert="false", which would have pinned
    // the nav permanently inert. Assert the literal attribute in both states.
    renderNav({ inert: false })
    expect(document.querySelector('.sr-nav-col')!.hasAttribute('inert')).toBe(false)
  })
})
