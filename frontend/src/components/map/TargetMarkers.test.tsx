// @vitest-environment jsdom
//
// TargetMarkers renders one DOM <Marker> per location group (a real <button>
// whose label is escHtml-escaped media-icon markup, plus a descriptive
// aria-label) and ONE lifted state-driven <Popup>. This test locks the change-3
// contracts with plain React stubs for react-map-gl/maplibre and ./SnowMap:
//   - every marker carries an always-visible aria-hidden locator dot
//   - Dots mode hides the label chip (display:none) but keeps the dot, the real
//     <button>, its aria-label, and the popup behavior
//   - the escaped media-icon label markup is preserved (visibility gated, not the
//     escaping)
//   - the popup carries an APP-OWNED close button (maplibre's own is off)
//     routed through onSelect(null)

import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, within, cleanup } from '@testing-library/react'
import type { ReactNode } from 'react'
import { TargetMarkers } from './TargetMarkers'
import type { DisplayTargetPin } from '../../lib/mapExplorerTypes'

// Every prop each Popup is mounted with, so `closeButton` and `closeOnClick`
// are assertable. The stub deliberately renders NO close button of its own: the
// app owns that control now, and a stub button would hide its absence.
const popupProps = vi.hoisted(() => [] as Record<string, unknown>[])

vi.mock('react-map-gl/maplibre', () => ({
  Marker: ({ children, onClick }: { children?: ReactNode; onClick?: (e: { originalEvent: { stopPropagation: () => void } }) => void }) => (
    <div data-testid="marker" onClick={() => onClick?.({ originalEvent: { stopPropagation: () => {} } })}>{children}</div>
  ),
  Popup: (props: Record<string, unknown>) => {
    popupProps.push(props)
    return <div role="dialog" data-testid="popup">{props.children as ReactNode}</div>
  },
  useMap: () => ({ current: undefined }),
}))
vi.mock('../SnowMap', () => ({ SnowMap: ({ children }: { children?: ReactNode }) => <div>{children}</div> }))

const fresh = '2026-06-12'

const pins: DisplayTargetPin[] = [
  {
    speciesCode: 'lewwoo', comName: "Lewis's Woodpecker", locId: 'L100',
    locName: 'Coyote Hills Regional Park', lat: 37.55, lng: -122.09,
    recentDate: fresh, checklistCount: 1, subId: 'S111', missingTypes: ['Photo'],
  },
  {
    speciesCode: 'sagthr', comName: 'Sage Thrasher', locId: 'L100',
    locName: 'Coyote Hills Regional Park', lat: 37.55, lng: -122.09,
    recentDate: fresh, checklistCount: 1, subId: 'S222', missingTypes: ['Audio'],
  },
  {
    speciesCode: 'lawgol', comName: "Lawrence's Goldfinch", locId: 'L200',
    locName: 'Hayward Regional Shoreline', lat: 37.63, lng: -122.14,
    recentDate: fresh, checklistCount: 1, subId: 'S333', missingTypes: [],
  },
]

const baseProps = {
  pins,
  speciesCodeMap: { "Lewis's Woodpecker": 'lewwoo', 'Sage Thrasher': 'sagthr', "Lawrence's Goldfinch": 'lawgol' },
  hasEntryFor: () => false,
  onOpenSpecies: () => {},
}

afterEach(() => { cleanup(); popupProps.length = 0 })

describe('TargetMarkers', () => {
  it('renders a real <button> per location group with a descriptive aria-label', () => {
    render(<TargetMarkers {...baseProps} sel={null} onSelect={() => {}} />)
    // L100 has two species → "{n} species" chip.
    const many = screen.getByRole('button', { name: '2 target species at Coyote Hills Regional Park' })
    expect(many.tagName).toBe('BUTTON')
    // L200 has one species → its name (+ no missing media).
    const one = screen.getByRole('button', { name: "Lawrence's Goldfinch, at Hayward Regional Shoreline" })
    expect(one.tagName).toBe('BUTTON')
  })

  it('every marker carries an always-visible aria-hidden locator dot (labels mode)', () => {
    render(<TargetMarkers {...baseProps} sel={null} onSelect={() => {}} markerMode="labels" />)
    const btn = screen.getByRole('button', { name: "Lawrence's Goldfinch, at Hayward Regional Shoreline" })
    const dot = Array.from(btn.querySelectorAll('span')).find(s => s.style.borderRadius === '50%')
    expect(dot).toBeTruthy()
    expect(dot!.getAttribute('aria-hidden')).toBe('true')
    // Label text still visible.
    expect(btn.textContent).toContain("Lawrence's Goldfinch")
  })

  it('dots mode hides the label chip but keeps the dot, button, aria-label, and click', () => {
    const onSelect = vi.fn()
    render(<TargetMarkers {...baseProps} sel={null} onSelect={onSelect} markerMode="dots" />)
    const btn = screen.getByRole('button', { name: "Lawrence's Goldfinch, at Hayward Regional Shoreline" })
    const dot = Array.from(btn.querySelectorAll('span')).find(s => s.style.borderRadius === '50%')
    expect(dot).toBeTruthy()
    // The label span is display:none in dots mode.
    const labelSpan = Array.from(btn.querySelectorAll('span')).find(s => s.textContent?.includes("Lawrence's Goldfinch"))
    expect(labelSpan).toBeTruthy()
    expect(labelSpan!.style.display).toBe('none')
    fireEvent.click(btn)
    expect(onSelect).toHaveBeenCalledWith('L200')
  })

  it('opens the popup listing every species at the selected group (either mode)', () => {
    render(<TargetMarkers {...baseProps} sel="L100" onSelect={() => {}} markerMode="dots" />)
    const popup = screen.getByTestId('popup')
    expect(popup.textContent).toContain('Coyote Hills Regional Park')
    expect(within(popup).getByText("Lewis's Woodpecker")).toBeTruthy()
    expect(within(popup).getByText('Sage Thrasher')).toBeTruthy()
  })

  // maplibre's injected close button carries no tabIndex, and WebKit's default
  // tab mode (what the shipped Mac, iPhone and iPad apps run) gives a plain
  // <button> no place in the tab order, so a popup opened from the marker chip
  // could only be closed from the sidebar row that did not open it. The app
  // draws the control instead, which is also what puts it inside
  // lib/tabOrderCoverage.test.ts.
  it('turns maplibre’s own close button OFF and leaves closeOnClick at its default', () => {
    render(<TargetMarkers {...baseProps} sel="L100" onSelect={() => {}} />)
    const popup = popupProps.at(-1)!
    expect(popup.closeButton).toBe(false)
    // Unchanged by the fix: this popup has always used maplibre's default.
    expect(popup.closeOnClick).toBeUndefined()
  })

  it('draws an app-owned close button with its own accessible name and an explicit tab stop', () => {
    render(<TargetMarkers {...baseProps} sel="L100" onSelect={() => {}} />)
    const close = screen.getByRole('button', { name: 'Close the media targets popup' })
    expect(close.tagName).toBe('BUTTON')
    expect(close.getAttribute('tabindex')).toBe('0')
    // maplibre's own class, so it inherits the existing theming and the coarse-
    // pointer target already in globals.css.
    expect(close.className).toBe('maplibregl-popup-close-button')
  })

  it('routes the app-owned close button through onSelect(null), the popup’s own clearing path', () => {
    const onSelect = vi.fn()
    render(<TargetMarkers {...baseProps} sel="L100" onSelect={onSelect} />)
    fireEvent.click(screen.getByRole('button', { name: 'Close the media targets popup' }))
    expect(onSelect).toHaveBeenCalledWith(null)
  })
})
