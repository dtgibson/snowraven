// @vitest-environment jsdom
/// <reference types="node" />
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
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { TabNav, type NavItem, type TabNavProps } from './TabNav'
import type { ContentReserve } from '../lib/navDensity'
import { focusablesIn } from '../lib/useFocusTrap'

// A glyph the tests can find without caring what it draws.
const icon = ({ size }: { size: number }) => <svg data-size={size} aria-hidden="true" />

// Mirrors DEFAULT_TAB_ORDER (lib/tabLayout.ts) plus Settings, so "the first four
// of the saved visible order" below describes the shipped default and not only
// the mechanism. Map Explorer third and Calendar fifth since 1.0.19; Targets
// right after Calendar.
const TWELVE: NavItem[] = [
  { id: 'weather', label: 'Weather', icon },
  { id: 'birding-stats', label: 'Statistics', icon },
  { id: 'map-explorer', label: 'Map Explorer', icon },
  { id: 'species-detail', label: 'Species Detail', icon },
  { id: 'calendar', label: 'Calendar', icon },
  { id: 'targets', label: 'Targets', icon },
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
        items={TWELVE}
        activeTab="weather"
        onSelect={() => {}}
        isPhone={false}
        reserve={'none' as ContentReserve}
        onOpenPalette={() => {}}
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
    for (const item of TWELVE) {
      const tab = document.getElementById(`tab-${item.id}`)!
      expect(tab.getAttribute('role')).toBe('tab')
      expect(tab.getAttribute('aria-controls')).toBe(`panel-${item.id}`)
    }
  })

  it('holds ONE tab stop and moves the rest to -1 (the roving group)', () => {
    renderNav({ activeTab: 'calendar' })
    const stops = TWELVE.map(i => document.getElementById(`tab-${i.id}`)!.getAttribute('tabindex'))
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
    expect(within(tablist).getAllByRole('tab')).toHaveLength(TWELVE.length)
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
    for (const item of TWELVE) {
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
      'Weather', 'Statistics', 'Map Explorer', 'Species Detail', 'More',
    ])
  })

  it('follows the user\'s saved order, since that is what chooses the favourites', () => {
    const reordered = [TWELVE[7], TWELVE[0], ...TWELVE.slice(1, 7), ...TWELVE.slice(8)]
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
    phone({ activeTab: 'map-explorer' })
    const current = document.querySelectorAll('[aria-current="true"]')
    expect(current).toHaveLength(1)
    expect(current[0].textContent).toBe('Map Explorer')
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
    phone({ items: [TWELVE[0], TWELVE[11]] })
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
      'Calendar', 'Targets', 'Multimedia', 'Breeding Codes', 'Checklists',
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

// ---------------------------------------------------------------------------
// Settings stays in view in the More sheet (settings-tab-hidden-iphone)
// ---------------------------------------------------------------------------
//
// THE DEFECT. Settings is appended after the saved order, so it was the last row
// of a list then capped at min(70dvh, 460px). When Targets made that list eight
// rows, Settings fell past the cap on every notched iPhone, under the home
// indicator, with no scroll cue, and larger text did the same with fewer rows.
// The cap is now 528px, the user's choice at the live preview, so at the
// default text size the whole list fits as well (the row below pins why).
//
// THE CLAIM GUARDED HERE is the structure that takes the row count and the text
// scale out of the question: the sheet is a flex column; every row but Settings
// sits in a body that scrolls and gives way to nothing; Settings and its hairline
// sit in a foot AFTER that body and outside its scrollport, which never gives
// way; and the iOS home-indicator inset pads a box below the foot, never the
// body. The markup half is swept over every row count the sheet can hold. The
// CSS half is asserted as RESOLVED cascade values: every rule in the real
// globals.css that can match the rendered element, at any depth, is collected
// (a rule in a media tier counts as a competitor, the conservative side), and
// the winner per longhand is chosen by importance, specificity and source order.
// So a deleted declaration, a later rule that wins, an override at a specificity
// that loses, or a rule renamed off its element all fail here.
//
// WHAT THIS CANNOT SEE: geometry. That the row is actually on screen above the
// inset, at a given width and text scale, is a browser measurement (WebKit and
// Chromium, 320 to 440px, 1x to 2x, in this fix's pr-description.md); this pins
// the mechanism that measurement rests on.

const NAV_CSS = readFileSync(resolve(process.cwd(), 'src/globals.css'), 'utf8')   // vitest's cwd is frontend/

interface NavCssRule { selectors: string[]; body: string; order: number }

function splitTopLevel(list: string, sep: string): string[] {
  const out: string[] = []
  let depth = 0
  let cur = ''
  for (const ch of list) {
    if (ch === '(' || ch === '[') depth++
    else if (ch === ')' || ch === ']') depth--
    if (ch === sep && depth === 0) { out.push(cur); cur = '' } else cur += ch
  }
  out.push(cur)
  return out.map(x => x.trim()).filter(Boolean)
}

/** Every style rule at every depth, in source order, comments removed first so
 *  no prose can be read as a rule. */
function everyRule(src: string): NavCssRule[] {
  const css = src.replace(/\/\*[\s\S]*?\*\//g, '')
  const out: NavCssRule[] = []
  const walk = (start: number, end: number) => {
    let i = start
    let selStart = start
    while (i < end) {
      if (css[i] === ';') { i++; selStart = i; continue }
      if (css[i] !== '{') { i++; continue }
      let depth = 1
      let j = i + 1
      while (j < end && depth) { if (css[j] === '{') depth++; else if (css[j] === '}') depth--; j++ }
      const prelude = css.slice(selStart, i).trim().replace(/\s+/g, ' ')
      if (prelude.startsWith('@')) walk(i + 1, j - 1)
      else out.push({ selectors: splitTopLevel(prelude, ','), body: css.slice(i + 1, j - 1), order: out.length })
      i = j
      selStart = j
    }
  }
  walk(0, css.length)
  return out
}
const NAV_RULES = everyRule(NAV_CSS)

/** (ids, classes/attributes/pseudo-classes, types) for one complex selector. */
function specificityOf(sel: string): [number, number, number] {
  let a = 0
  let b = 0
  let c = 0
  let s = sel.replace(/:where\((?:[^()]|\([^()]*\))*\)/g, '')
  s = s.replace(/:(?:is|not|has)\(((?:[^()]|\([^()]*\))*)\)/g, (_m, args: string) => {
    const best = splitTopLevel(args, ',').map(specificityOf)
      .sort((x, y) => y[0] - x[0] || y[1] - x[1] || y[2] - x[2])[0] ?? [0, 0, 0]
    a += best[0]; b += best[1]; c += best[2]
    return ' '
  })
  s = s.replace(/\[[^\]]*\]/g, () => { b++; return '' })
  s = s.replace(/::[-\w]+/g, () => { c++; return '' })
  s = s.replace(/#[-\w]+/g, () => { a++; return '' })
  s = s.replace(/\.[-\w]+/g, () => { b++; return '' })
  s = s.replace(/:[-\w]+(\([^)]*\))?/g, () => { b++; return '' })
  for (const part of s.split(/[\s>+~]+/)) if (/^[a-zA-Z][-\w]*$/.test(part)) c++
  return [a, b, c]
}

/** A user-action state can hold at any moment, so a rule gated on one counts. */
const NAV_USER_STATE = /:(?:hover|focus-visible|focus-within|focus|active)\b/g

/** What one declaration sets, as [longhand, value] pairs, with the shorthands
 *  that can move this question expanded, so `flex: none` beats a less specific
 *  `flex-shrink: 1` exactly as it does in the engine. Only the longhands this
 *  file asks about are produced: the grow factor is left out on purpose, since
 *  a string naming it in this file would be read by Tailwind's source scan as
 *  a utility and emitted into the shipped stylesheet (testing.md, v0.5.85). */
function navLonghands(prop: string, value: string): [string, string][] {
  const v = value.split(/\s+(?![^(]*\))/)
  const num = (x: string) => /^\d*\.?\d+$/.test(x)
  switch (prop) {
    case 'flex': {
      if (value === 'none') return [['flex-shrink', '0'], ['flex-basis', 'auto']]
      if (value === 'auto' || value === 'initial') return [['flex-shrink', '1'], ['flex-basis', 'auto']]
      if (!num(v[0])) return [['flex-shrink', '1'], ['flex-basis', v[0]]]
      const shrink = v[1] !== undefined && num(v[1]) ? v[1] : '1'
      const basis = v[2] ?? (v[1] !== undefined && !num(v[1]) ? v[1] : '0%')
      return [['flex-shrink', shrink], ['flex-basis', basis]]
    }
    case 'flex-flow': {
      const dir = v.find(x => /^(row|row-reverse|column|column-reverse)$/.test(x))
      return dir ? [['flex-direction', dir]] : []
    }
    case 'overflow': return [['overflow-x', v[0]], ['overflow-y', v[1] ?? v[0]]]
    case 'padding': return [['padding-top', v[0]], ['padding-right', v[1] ?? v[0]], ['padding-bottom', v[2] ?? v[0]], ['padding-left', v[3] ?? v[1] ?? v[0]]]
    case 'padding-block': return [['padding-top', v[0]], ['padding-bottom', v[1] ?? v[0]]]
    case 'padding-block-end': return [['padding-bottom', value]]
    case 'inset': return [['top', v[0]], ['bottom', v[2] ?? v[0]]]
    default: return [[prop, value]]
  }
}

type NavKey = [number, number, number, number, number]
const winsOver = (x: NavKey, y: NavKey) => {
  for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) return x[i] > y[i]
  return false
}

/** The winning value of each asked longhand on `el` (undefined: no rule sets it,
 *  so the initial value holds), plus how many rules matched at all. An inline
 *  style beats every normal selector, so it is folded in too. */
function resolvedNav(el: Element, props: string[]) {
  const won = new Map<string, { value: string; selector: string; key: NavKey }>()
  let matched = 0
  const selectors: string[] = []
  const unparsed: string[] = []
  const take = (decls: string, spec: [number, number, number], order: number, selector: string) => {
    for (const part of decls.split(';')) {
      const colon = part.indexOf(':')
      if (colon < 0) continue
      const raw = part.slice(colon + 1).trim()
      const important = /!important$/.test(raw)
      const key: NavKey = [important ? 1 : 0, spec[0], spec[1], spec[2], order]
      for (const [prop, value] of navLonghands(part.slice(0, colon).trim(), raw.replace(/\s*!important$/, ''))) {
        if (!props.includes(prop)) continue
        const prev = won.get(prop)
        if (!prev || winsOver(key, prev.key)) won.set(prop, { value, selector, key })
      }
    }
  }
  for (const rule of NAV_RULES) {
    for (const sel of rule.selectors) {
      if (sel.includes('::')) continue                 // styles a pseudo-element, not this element
      let hit: boolean
      try { hit = el.matches(sel.replace(NAV_USER_STATE, '')) } catch { unparsed.push(sel); continue }
      if (!hit) continue
      matched++
      selectors.push(sel)
      take(rule.body, specificityOf(sel), rule.order, sel)
    }
  }
  const inline = el.getAttribute('style')
  if (inline) take(inline, [1000, 0, 0], Number.MAX_SAFE_INTEGER, 'style=""')
  const value = (p: string) => won.get(p)?.value
  return { won, value, matched, selectors, unparsed }
}

/** Does any matched selector name `cls` itself in one of its compounds? Exact,
 *  so `.sr-nav-sheet-foot` is not satisfied by `.sr-nav-sheet-footer`, and a
 *  global `*` rule (the reduced-motion block) is not mistaken for the element's
 *  own rule. */
const namesClass = (selectors: string[], cls: string) =>
  selectors.some(sel => sel.split(/[\s>+~]+/).some(compound => compound.split(/(?=[.#:[])/).includes(cls)))

describe('the More sheet keeps Settings in view at any row count and any text scale', () => {
  const SETTINGS = TWELVE[TWELVE.length - 1]
  const ROSTER = TWELVE.slice(0, -1)
  const label = (el: Element) => (el.classList.contains('sr-nav-search') ? 'Search' : el.textContent)
  const parts = () => {
    const sheet = document.querySelector('.sr-nav-sheet') as HTMLElement
    return {
      sheet,
      body: sheet.querySelector(':scope > .sr-nav-sheet-body') as HTMLElement,
      foot: sheet.querySelector(':scope > .sr-nav-sheet-foot') as HTMLElement,
    }
  }
  const openSheet = (props: HarnessProps = {}) => {
    renderNav({ isPhone: true, ...props })
    fireEvent.click(screen.getByRole('button', { name: 'More destinations' }))
  }

  // From one visible tab (the sheet holds Settings alone) to all eleven (seven
  // rows plus Settings, the shipped default): every row count the sheet can show.
  const LAYOUTS = ROSTER.map((_, i) => [...ROSTER.slice(0, i + 1), SETTINGS])

  it.each(LAYOUTS.map(items => [items.length - 1, items] as const))(
    'with %i visible tabs, Settings and its hairline are pinned in the foot and every other row scrolls',
    (_visible, items) => {
      openSheet({ items: [...items] })
      const { sheet, body, foot } = parts()
      expect(body, 'the sheet has no scrolling body').toBeTruthy()
      expect(foot, 'the sheet has no foot to pin Settings in').toBeTruthy()
      // The two parts are the whole sheet, the foot last and outside the body.
      expect([...sheet.children]).toEqual([body, foot])
      expect(body.contains(foot)).toBe(false)

      const overflow = items.slice(4, -1).map(i => i.label)   // the first four are the bar's
      expect([...body.querySelectorAll('.sr-nav-item')].map(label)).toEqual(overflow)
      expect([...foot.querySelectorAll('.sr-nav-item')].map(label)).toEqual(['Settings'])
      // The hairline sits directly above Settings whenever a list sits above it.
      const sep = foot.querySelector('hr.sr-nav-sep')
      if (overflow.length) {
        expect(foot.firstElementChild).toBe(sep)
        expect(sep!.nextElementSibling!.textContent).toBe('Settings')
      } else {
        expect(sep).toBeNull()
      }
      expect(body.querySelector('hr.sr-nav-sep')).toBeNull()

      // DOM order is unchanged, so Tab order and the trap's own list are too:
      // the search, the rows in saved order, then Settings.
      expect(focusablesIn(sheet).map(label)).toEqual(['Search', ...overflow, 'Settings'])
    },
  )

  it('focus still lands on the active destination, in the list or in the foot', () => {
    openSheet({ activeTab: 'named-birds' })
    expect(document.activeElement!.textContent).toBe('Named Birds')
    expect(parts().body.contains(document.activeElement)).toBe(true)
    cleanup()
    openSheet({ activeTab: 'settings' })
    expect(document.activeElement!.textContent).toBe('Settings')
    expect(parts().foot.contains(document.activeElement)).toBe(true)
  })

  it('the resolved cascade makes the sheet a column whose body scrolls and gives way and whose foot never does', () => {
    openSheet()
    const { sheet, body, foot } = parts()

    const onSheet = resolvedNav(sheet, ['display', 'flex-direction', 'max-height'])
    expect(onSheet.unparsed, 'a selector jsdom cannot parse could be a competitor no one sees').toEqual([])
    expect(onSheet.value('display')).toBe('flex')
    expect(onSheet.value('flex-direction')).toBe('column')
    // The cap is kept, because it is what makes the sheet a sheet and not a
    // page, and it is tall enough for the whole sheet at the default text size.
    // SHEET_AT_1X_PX is a MEASUREMENT, not a number to derive here: the sheet's
    // full height at 1x on a notched iPhone with the iOS inset (393x852, 34px
    // inset, all eleven tabs visible), read in WebKit and Chromium (the body's
    // 418px, the foot, the padding and the border). jsdom has no layout and the
    // heading's line height is font-dependent, so it cannot be computed from the
    // declarations. A cap below it makes the list scroll at 1x on every notched
    // width, which the old 460px did; a larger one is harmless. The viewport
    // term stays 70dvh, which binds first on the short SE screens.
    const SHEET_AT_1X_PX = 528
    const cap = /^min\(\s*70dvh\s*,\s*(\d+(?:\.\d+)?)px\s*\)$/.exec(onSheet.value('max-height') ?? '')
    expect(cap, `the sheet cap is not min(70dvh, <px>): ${onSheet.value('max-height')}`).not.toBeNull()
    expect(Number(cap![1]), 'the cap no longer holds the whole sheet at 1x on a notched iPhone').toBeGreaterThanOrEqual(SHEET_AT_1X_PX)

    const onBody = resolvedNav(body, ['overflow-y', 'flex-shrink', 'min-height', 'max-height', 'display'])
    expect(onBody.unparsed).toEqual([])
    expect(namesClass(onBody.selectors, '.sr-nav-sheet-body'), 'no rule of its own styles the body').toBe(true)
    // It is the scroller, so every row stays reachable...
    expect(['auto', 'scroll']).toContain(onBody.value('overflow-y'))
    // ...and it gives way first: it may be squeezed, and down to nothing. A
    // scroll container's automatic minimum is already zero, so `auto` is as good
    // as an explicit 0; a length would hold the body open against the foot.
    expect(Number(onBody.value('flex-shrink') ?? '1')).toBeGreaterThan(0)
    expect(['0', '0px', 'auto']).toContain(onBody.value('min-height') ?? 'auto')
    // A body with no box (or no display) cannot be the scroller at all.
    expect(['none', 'contents']).not.toContain(onBody.value('display') ?? 'block')

    const onFoot = resolvedNav(foot, ['flex-shrink', 'min-height', 'overflow-y', 'max-height', 'height', 'position', 'display'])
    expect(onFoot.unparsed).toEqual([])
    expect(namesClass(onFoot.selectors, '.sr-nav-sheet-foot'), 'no rule of its own styles the foot').toBe(true)
    // It never gives way: either it may not shrink, or its automatic minimum
    // (content height, because it is not a scroll container) holds it whole.
    const holdsWhole = onFoot.value('flex-shrink') === '0'
      || ((onFoot.value('min-height') ?? 'auto') === 'auto' && (onFoot.value('overflow-y') ?? 'visible') === 'visible')
    expect(holdsWhole, `foot flex-shrink=${onFoot.value('flex-shrink')} min-height=${onFoot.value('min-height')} overflow-y=${onFoot.value('overflow-y')}`).toBe(true)
    // ...it is never clipped or capped...
    expect(onFoot.value('overflow-y') ?? 'visible').toBe('visible')
    expect(onFoot.value('max-height') ?? 'none').toBe('none')
    expect(onFoot.value('height') ?? 'auto').toBe('auto')
    // ...and it stays in the column's flow, below the list, rather than being
    // lifted out of it (sticky is harmless here: the foot is not in the body's
    // scrollport, so there is nothing for it to stick against).
    expect(['static', 'relative', 'sticky']).toContain(onFoot.value('position') ?? 'static')
    expect(onFoot.value('display') ?? 'block').not.toBe('none')
  })

  it('on iOS the home-indicator inset pads a box BELOW the foot, never the scrolling body', () => {
    // On the body it would leave a dead band between the list and Settings and
    // put nothing between Settings and the indicator.
    document.documentElement.classList.add('sr-ios-app')
    try {
      openSheet()
      const { sheet, body, foot } = parts()
      const insetOn = (el: Element) => (resolvedNav(el, ['padding-bottom']).value('padding-bottom') ?? '').includes('env(safe-area-inset-bottom')
      expect(insetOn(sheet) || insetOn(foot), 'neither the sheet nor its foot clears the home indicator').toBe(true)
      expect(insetOn(body)).toBe(false)
    } finally {
      document.documentElement.classList.remove('sr-ios-app')
    }
  })

  it('the model is not vacuous: it finds real rules and settles a specificity contest the engine settles', () => {
    expect(NAV_RULES.length).toBeGreaterThan(500)
    openSheet()
    const row = parts().body.querySelector('.sr-nav-item')!
    // `.sr-nav-sheet .sr-nav-item` (0,2,0) beats the shared `.sr-nav-item` (0,1,0)
    // whatever their order: the phone row's 44px touch posture.
    const r = resolvedNav(row, ['min-height'])
    expect(r.won.get('min-height')).toMatchObject({ value: '44px', selector: '.sr-nav-sheet .sr-nav-item' })
    // The own-rule check is exact: a global `*` rule matches the foot but does
    // not name it.
    const foot = resolvedNav(parts().foot, ['padding-left'])
    expect(foot.matched).toBeGreaterThan(foot.selectors.filter(sel => namesClass([sel], '.sr-nav-sheet-foot')).length)
    expect(namesClass(['.sr-nav-sheet-footer'], '.sr-nav-sheet-foot')).toBe(false)
    expect(namesClass(['*'], '.sr-nav-sheet-foot')).toBe(false)
    // And the iOS gate is seen only when it holds.
    expect(resolvedNav(parts().sheet, ['padding-bottom']).value('padding-bottom')).not.toContain('env(')
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
