// @vitest-environment jsdom
/// <reference types="node" />
// The Alerts inbox's entry points (ios-alerts design-spec 7.2 and 7.5, the
// revision after the live look): the iPhone header bell, the iPad sidebar item
// and the command palette's row. One gate (alerts on OR the inbox has rows, on
// iPhone and iPad), one count (rows alerted after "last viewed"), ABSENT markup
// when the gate is false. The card row is AlertsSection.test.tsx's.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react'
import { useState } from 'react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

vi.mock('../lib/platform', () => ({
  isTauri: vi.fn(() => true), isIOS: vi.fn(() => true), isWindows: vi.fn(() => false), isMacOS: vi.fn(() => false),
}))
vi.mock('../lib/storage', () => ({
  storage: { getFilesStatus: vi.fn(async () => ({ ebird: null, ml: null })), readFile: vi.fn(async () => null) },
}))

import { AlertsInboxBell, AlertsInboxNavItem } from './AlertsInboxEntry'
import { CommandPalette } from './CommandPalette'
import { TabNav } from './TabNav'
import { NAV_ICON } from '../lib/tabIcons'
import { isIOS } from '../lib/platform'
import { resetAlertsState, setAlertsState, type AlertsSnapshot, type InboxRow } from '../lib/alerts/alertsState'
import { installInboxOpener, newSinceViewed } from '../lib/alerts/alertsInboxEntry'

const NOW = '2026-09-30T16:00:00Z'
const row = (i: number, alertedAt: string): InboxRow => ({
  id: `r${i}`, checkId: 'c', speciesCode: `sp${i}`, comName: `Species ${i}`, locId: 'L1', locName: 'P', lat: 1, lng: 2,
  obsDt: '2026-09-30 07:45', distanceMi: 1, point: { lat: 1, lng: 2 }, radiusMi: 25, place: { kind: 'nearby' },
  alertedAt, updatedAt: alertedAt,
})
function snap(enabled: boolean, inbox: InboxRow[]): AlertsSnapshot {
  return {
    settings: {
      version: 1, enabled, cadence: 'hourly', quietHours: { on: false, startMin: 1320, endMin: 420 },
      model: 'fixed', fixedPlace: null, radiusMi: 25, updatedAt: NOW,
    },
    state: { version: 1, lastCheck: null, holdUntil: null, position: null, pending: null, scheduledEarliest: null, backgroundRefresh: 'available' },
    inbox, blocked: null, permissions: { notifications: 'granted', location: 'granted' }, defaultLocation: null, now: NOW,
  }
}
const GLYPH = { size: 16, strokeWidth: 2 }
const ROWS = [row(1, '2026-09-30T15:00:00Z'), row(2, '2026-09-30T14:00:00Z'), row(3, '2026-09-28T10:00:00Z')]

beforeEach(() => { resetAlertsState() })
afterEach(() => { cleanup(); installInboxOpener(null); vi.mocked(isIOS).mockReturnValue(true) })

describe('the gate: all four combinations, on every entry point (design-spec 7.1 / 7.2)', () => {
  it.each([
    [true, true, true], [true, false, true], [false, true, true], [false, false, false],
  ] as const)('enabled %s, rows %s: present %s (ABSENT markup otherwise)', async (enabled, rows, present) => {
    setAlertsState({ loaded: true, snapshot: snap(enabled, rows ? ROWS : []) })
    const { container } = render(
      <>
        <header><AlertsInboxBell /></header>
        <nav><AlertsInboxNavItem glyph={GLYPH} /></nav>
        <CommandPalette items={[]} onSelectTab={vi.fn()} onOpenSpecies={vi.fn()} onClose={vi.fn()} onOpenInbox={vi.fn()} />
      </>,
    )
    expect(container.querySelector('.sr-hdr-inbox') !== null).toBe(present)
    expect(container.querySelector('.sr-nav-inbox') !== null).toBe(present)
    expect(screen.queryByRole('option', { name: /^Alerts inbox/ }) !== null).toBe(present)
    await waitFor(() => expect(container.querySelector('.sr-palette-status')).not.toBeNull())
  })

  it('not iPhone or iPad: nothing, whatever the snapshot says (bell, sidebar item and Search row)', async () => {
    vi.mocked(isIOS).mockReturnValue(false)
    setAlertsState({ loaded: true, snapshot: snap(true, ROWS) })
    const { container } = render(<><AlertsInboxBell /><AlertsInboxNavItem glyph={GLYPH} /></>)
    expect(container.innerHTML).toBe('')
    cleanup()
    render(<CommandPalette items={[]} onSelectTab={vi.fn()} onOpenSpecies={vi.fn()} onClose={vi.fn()} onOpenInbox={vi.fn()} />)
    expect(screen.queryByRole('option', { name: /^Alerts inbox/ })).toBeNull()
    await waitFor(() => expect(document.querySelector('.sr-palette-status')).not.toBeNull())
  })
})

describe('the since-last-viewed count and its clearing (design-spec 7.5)', () => {
  it('names the count on the bell and the sidebar item; the badge and pill are aria-hidden; "9+" past nine', () => {
    setAlertsState({ loaded: true, snapshot: snap(true, ROWS), inboxViewedAt: '2026-09-29T00:00:00Z' })
    const { container, unmount } = render(<><AlertsInboxBell /><AlertsInboxNavItem glyph={GLYPH} /></>)
    const named = screen.getAllByRole('button', { name: 'Alerts inbox, 2 new' })
    expect(named).toHaveLength(2)
    for (const b of named) expect(b.getAttribute('aria-haspopup')).toBe('dialog')
    expect(container.querySelector('.sr-badge')!.textContent).toBe('2')
    expect(container.querySelector('.sr-badge')!.getAttribute('aria-hidden')).toBe('true')
    expect(container.querySelector('.sr-nav-count')!.getAttribute('aria-hidden')).toBe('true')
    // The nav item is a plain button: not a tab, and not in the saved order.
    expect(container.querySelector('.sr-nav-inbox')!.getAttribute('role')).toBeNull()
    unmount()
    const many = Array.from({ length: 12 }, (_, i) => row(10 + i, '2026-09-30T15:00:00Z'))
    setAlertsState({ snapshot: snap(true, many), inboxViewedAt: null })
    const m = render(<AlertsInboxBell />)
    expect(m.container.querySelector('.sr-badge')!.textContent).toBe('9+')
    expect(screen.getByRole('button', { name: 'Alerts inbox, 12 new' })).toBeTruthy()
  })

  it('clears when "last viewed" moves past the rows: no badge, no pill, the plain name', () => {
    setAlertsState({ loaded: true, snapshot: snap(true, ROWS), inboxViewedAt: NOW })
    const { container } = render(<><AlertsInboxBell /><AlertsInboxNavItem glyph={GLYPH} /></>)
    expect(screen.getAllByRole('button', { name: 'Alerts inbox' })).toHaveLength(2)
    expect(container.querySelector('.sr-badge')).toBeNull()
    expect(container.querySelector('.sr-nav-count')).toBeNull()
    expect(newSinceViewed(ROWS, null)).toBe(3)
  })

  it('a press opens the sheet with that control as the opener', () => {
    const open = vi.fn()
    installInboxOpener(open)
    setAlertsState({ loaded: true, snapshot: snap(true, []) })
    render(<AlertsInboxBell />)
    const bell = screen.getByRole('button', { name: 'Alerts inbox' })
    fireEvent.click(bell)
    expect(open.mock.calls[0]![0].trigger()).toBe(bell)
  })
})

describe('the palette row (design-spec 7.2)', () => {
  it('is first in Destinations with its count in the name; choosing it closes the palette, THEN opens the sheet', async () => {
    setAlertsState({ loaded: true, snapshot: snap(false, ROWS), inboxViewedAt: '2026-09-29T00:00:00Z' })
    const order: string[] = []
    const items = [{ id: 'settings' as const, label: 'Settings', icon: (() => null) as never }]
    render(
      <CommandPalette
        items={items} onSelectTab={vi.fn()} onOpenSpecies={vi.fn()}
        onClose={() => order.push('close')} onOpenInbox={() => order.push('inbox')}
      />,
    )
    const options = screen.getAllByRole('option')
    expect(options[0]!.getAttribute('aria-label')).toBe('Alerts inbox, 2 new')
    expect(options[0]!.querySelector('.sr-nav-count')!.getAttribute('aria-hidden')).toBe('true')
    fireEvent.click(options[0]!)
    expect(order).toEqual(['close', 'inbox'])
    await waitFor(() => expect(document.querySelector('.sr-palette-status')).not.toBeNull())
  })
})

// ── The iPad rail's badge never covers the bell (QA re-verification of the
// inbox redesign; design-spec 7.2, NFR-07, QA-47) ────────────────────────────
//
// The rail item is icon-only, its glyph is fixed px, and its badge is rem, so
// at a larger text size the badge grows while the bell does not. Anchored by its
// right edge it grew LEFT over the bell and hid it at 200%. The property pinned
// here is where the badge GROWS, read from the resolved cascade on the real rail
// element rather than from one declaration's presence (testing.md: pin the
// property at the surface that needs it): whatever wins `left`, `right`,
// `position` and the margins on that element must leave the badge anchored at
// its left edge, inside the glyph's right edge by at most a third of the glyph.
// jsdom has no layout, so the geometry is arithmetic over the resolved values
// and the rendered glyph's size; the covered fraction itself was measured in
// Chromium and WebKit (pr-description.md).

const CSS = readFileSync(resolve(process.cwd(), 'src/globals.css'), 'utf8')   // vitest's cwd is frontend/

interface CssRule { selectors: string[]; body: string; order: number }

function splitTop(list: string, sep: string): string[] {
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

/** Every style rule at every depth, in source order. Rules inside at-rule
 *  blocks are included, so a competitor in a media tier is still seen (the
 *  conservative side: it can only add competitors). */
function allRules(src: string): CssRule[] {
  const css = src.replace(/\/\*[\s\S]*?\*\//g, '')
  const out: CssRule[] = []
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
      else out.push({ selectors: splitTop(prelude, ','), body: css.slice(i + 1, j - 1), order: out.length })
      i = j
      selStart = j
    }
  }
  walk(0, css.length)
  return out
}

type Spec = [number, number, number]

/** (ids, classes/attributes/pseudo-classes, types) for one complex selector. */
function specificity(sel: string): Spec {
  let a = 0
  let b = 0
  let c = 0
  let s = sel.replace(/:where\((?:[^()]|\([^()]*\))*\)/g, '')
  s = s.replace(/:(?:is|not|has)\(((?:[^()]|\([^()]*\))*)\)/g, (_m, args: string) => {
    const best = splitTop(args, ',').map(specificity)
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
const USER_STATE = /:(?:hover|focus-visible|focus-within|focus|active)\b/g

type Key = [number, number, number, number, number]
const later = (x: Key, y: Key) => {
  for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) return x[i] > y[i]
  return false
}

/** What one declaration sets, as [longhand, value] pairs: the shorthands that
 *  can move the badge horizontally are expanded, so `margin: 0` beats a less
 *  specific `margin-left: auto` exactly as it does in the engine. */
function longhands(prop: string, value: string): [string, string][] {
  const v = value.split(/\s+/)
  switch (prop) {
    case 'margin': return [['margin-left', v[3] ?? v[1] ?? v[0]]]
    case 'margin-inline': return [['margin-left', v[0]]]
    case 'margin-inline-start': return [['margin-left', value]]
    case 'inset': return [['left', v[3] ?? v[1] ?? v[0]], ['right', v[1] ?? v[0]]]
    case 'inset-inline': return [['left', v[0]], ['right', v[1] ?? v[0]]]
    case 'inset-inline-start': return [['left', value]]
    case 'inset-inline-end': return [['right', value]]
    default: return [[prop, value]]
  }
}

/** The winning value of each longhand on `el`, over every rule that can match it. */
function resolvedOn(el: Element, props: string[]) {
  const won = new Map<string, { value: string; selector: string; key: Key }>()
  let matched = 0
  const unparsed: string[] = []
  for (const rule of allRules(CSS)) {
    for (const sel of rule.selectors) {
      if (sel.includes('::')) continue                 // styles a pseudo-element, not this element
      let hit: boolean
      try { hit = el.matches(sel.replace(USER_STATE, '')) } catch { unparsed.push(sel); continue }
      if (!hit) continue
      matched++
      const spec = specificity(sel)
      for (const part of rule.body.split(';')) {
        const colon = part.indexOf(':')
        if (colon < 0) continue
        const raw = part.slice(colon + 1).trim()
        const important = /!important$/.test(raw)
        const key: Key = [important ? 1 : 0, spec[0], spec[1], spec[2], rule.order]
        for (const [prop, value] of longhands(part.slice(0, colon).trim(), raw.replace(/\s*!important$/, ''))) {
          if (!props.includes(prop)) continue
          const prev = won.get(prop)
          if (!prev || later(key, prev.key)) won.set(prop, { value, selector: sel, key })
        }
      }
    }
  }
  return { won, matched, unparsed }
}

function RailHarness() {
  const [shell, setShell] = useState<HTMLElement | null>(null)
  return (
    <div ref={setShell}>
      <TabNav
        items={[{ id: 'settings', label: 'Settings', icon: ({ size }: { size: number }) => <svg width={size} height={size} aria-hidden="true" /> }]}
        activeTab="settings" onSelect={() => {}} isPhone={false} reserve="none"
        onOpenPalette={() => {}} shell={shell}
      />
    </div>
  )
}

describe('the iPad rail badge never covers the bell (QA re-verification; NFR-07, QA-47)', () => {
  beforeEach(() => {
    // iPad portrait: 834 - 216 = 618, under the 640 floor, so the nav is the rail.
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get() { return 834 } })
    ;(globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = class { observe() {} unobserve() {} disconnect() {} }
  })
  afterEach(() => { delete (HTMLElement.prototype as unknown as { clientWidth?: unknown }).clientWidth })

  it('the resolved cascade anchors it by its left edge, inside the glyph by at most a third of the glyph', () => {
    setAlertsState({ loaded: true, snapshot: snap(true, ROWS), inboxViewedAt: '2026-09-29T00:00:00Z' })
    const { container } = render(<RailHarness />)
    const badge = container.querySelector('.sr-nav-col--rail .sr-nav-inbox .sr-nav-count')
    expect(badge, 'the rail must render the inbox item with its count').not.toBeNull()
    expect(badge!.textContent).toBe('2')
    const item = badge!.closest('.sr-nav-inbox')!
    const glyph = Number(item.querySelector('svg')!.getAttribute('width'))
    expect(glyph).toBe(NAV_ICON.rail.size)

    const onBadge = resolvedOn(badge!, ['position', 'left', 'right', 'transform', 'translate', 'margin-left', 'height'])
    expect(onBadge.unparsed, 'a selector jsdom cannot parse could be a competitor no one sees').toEqual([])
    expect(onBadge.matched).toBeGreaterThan(2)
    const w = onBadge.won
    expect(w.get('position')?.value).toBe('absolute')
    // Nothing may re-anchor it at the right or shift it back over the glyph.
    for (const p of ['right', 'transform', 'translate']) {
      const v = w.get(p)
      if (v) expect(['auto', 'none'], `${p} on the rail badge (${v.selector})`).toContain(v.value)
    }
    expect(w.get('margin-left')?.value, `margin-left (${w.get('margin-left')?.selector})`).toBe('0')
    // The premise: the badge is rem, so it grows with the text size, and the
    // anchor decides which way.
    expect(w.get('height')?.value).toMatch(/rem$/)
    const left = /^(\d+(?:\.\d+)?)px$/.exec(w.get('left')?.value ?? '')
    expect(left, `left must be a px offset from the fixed glyph, got ${w.get('left')?.value}`).not.toBeNull()

    const onItem = resolvedOn(item, ['width', 'padding', 'justify-content'])
    expect(onItem.unparsed).toEqual([])
    expect(onItem.won.get('width')?.value).toMatch(/^\d+px$/)
    expect(onItem.won.get('padding')?.value).toBe('0')
    expect(onItem.won.get('justify-content')?.value).toBe('center')
    const glyphRight = (parseFloat(onItem.won.get('width')!.value) + glyph) / 2
    const L = parseFloat(left![1])
    // Still a corner badge ON the bell, and covering at most a third of its
    // width (so of its box) at every text size and for any count, because it
    // grows away from it.
    expect(L).toBeLessThanOrEqual(glyphRight)
    expect((glyphRight - L) / glyph).toBeLessThanOrEqual(1 / 3)
  })
})
