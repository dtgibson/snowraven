// @vitest-environment jsdom
//
// NearbyLiferMarkers renders one DOM <Marker> per location (a real <button>
// labeled with the lifer's name, or "{n} species" for several, + a descriptive
// aria-label) and ONE lifted state-driven <Popup> listing each lifer at the
// selected location. This test locks those contracts with plain React stubs for
// react-map-gl/maplibre and ./SnowMap — no maplibre-gl, no WebGL:
//   - every marker is a real <button> labeled by name / "{n} species", with an
//     aria-label naming the lifer(s) and the location
//   - clicking a marker lifts the selection (onSelect(locId))
//   - the popup lists each lifer (name + checklist link) and carries an
//     APP-OWNED close button (maplibre's own is off) routed through
//     onSelect(null)

import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, within, cleanup } from '@testing-library/react'
import type { ReactNode } from 'react'
import { NearbyLiferMarkers } from './NearbyLiferMarkers'
import type { NearbyLiferLocation } from '../../lib/mapExplorerTypes'

// Every prop each Popup is mounted with, so `closeButton` and `closeOnClick`
// are assertable. The stub deliberately renders NO close button of its own: the
// app owns that control now, and a stub button would hide its absence.
const popupProps = vi.hoisted(() => [] as Record<string, unknown>[])

// Plain React stubs — render the children as DOM so the marker <button> and the
// popup contents are queryable.
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

// NearbyLiferMarkers doesn't import SnowMap, but stub it defensively so no
// maplibre/WebGL module is pulled in transitively under any future change.
vi.mock('../SnowMap', () => ({ SnowMap: ({ children }: { children?: ReactNode }) => <div>{children}</div> }))

const fresh = '2026-06-12' // within 7 days of the 2026-06-14 test clock
const mid = '2026-06-02'

const pins: NearbyLiferLocation[] = [
  {
    locId: 'L100', locName: 'Coyote Hills Regional Park', lat: 37.55, lng: -122.09,
    count: 2, mostRecentDate: fresh, tier: 'fresh',
    lifers: [
      { comName: "Lewis's Woodpecker", speciesCode: 'lewwoo', recentDate: fresh, subId: 'S111' },
      { comName: 'Sage Thrasher', speciesCode: 'sagthr', recentDate: mid, subId: 'S222' },
    ],
  },
  {
    locId: 'L200', locName: 'Hayward Regional Shoreline', lat: 37.63, lng: -122.14,
    count: 1, mostRecentDate: fresh, tier: 'fresh',
    lifers: [
      { comName: "Lawrence's Goldfinch", speciesCode: 'lawgol', recentDate: fresh, subId: 'S333' },
    ],
  },
]

const baseProps = {
  pins,
  speciesCodeMap: { "Lewis's Woodpecker": 'lewwoo', 'Sage Thrasher': 'sagthr', "Lawrence's Goldfinch": 'lawgol' },
  onOpenSpecies: () => {},
}

afterEach(() => { cleanup(); popupProps.length = 0 })

describe('NearbyLiferMarkers', () => {
  it('renders one real <button> marker per location — species name for one lifer, "{n} species" for several — with a descriptive aria-label', () => {
    render(<NearbyLiferMarkers {...baseProps} sel={null} onSelect={() => {}} />)

    // Several lifers at a spot → "{n} species" chip, like the Media Targets markers.
    const many = screen.getByRole('button', { name: '2 nearby lifers at Coyote Hills Regional Park' })
    expect(many.tagName).toBe('BUTTON')
    expect(many.textContent).toContain('2 species')

    // A single lifer → the species name is on the chip.
    const one = screen.getByRole('button', { name: "Lawrence's Goldfinch, a nearby lifer at Hayward Regional Shoreline" })
    expect(one.tagName).toBe('BUTTON')
    expect(one.textContent).toContain("Lawrence's Goldfinch")
  })

  it('lifts the selection to the parent when a marker is clicked', () => {
    const onSelect = vi.fn()
    render(<NearbyLiferMarkers {...baseProps} sel={null} onSelect={onSelect} />)

    fireEvent.click(screen.getByRole('button', { name: '2 nearby lifers at Coyote Hills Regional Park' }))
    expect(onSelect).toHaveBeenCalledWith('L100')
  })

  it('renders no popup when nothing is selected', () => {
    render(<NearbyLiferMarkers {...baseProps} sel={null} onSelect={() => {}} />)
    expect(screen.queryByTestId('popup')).toBeNull()
  })

  it('opens one popup for the selected location listing every lifer with a checklist link', () => {
    render(<NearbyLiferMarkers {...baseProps} sel="L100" onSelect={() => {}} />)

    const popups = screen.getAllByTestId('popup')
    expect(popups).toHaveLength(1)
    const popup = popups[0]

    // The location name heads the popup, and both lifers are listed by name.
    expect(popup.textContent).toContain('Coyote Hills Regional Park')
    expect(within(popup).getByText("Lewis's Woodpecker")).toBeTruthy()
    expect(within(popup).getByText('Sage Thrasher')).toBeTruthy()

    // Each lifer's checklist id becomes an eBird link (ChecklistLink + SUBMISSION_ID_RE).
    const links = within(popup).getAllByRole('link')
    expect(links.length).toBeGreaterThanOrEqual(2)
    expect(links.some(a => a.getAttribute('href') === 'https://ebird.org/checklist/S111')).toBe(true)
    expect(links.some(a => a.getAttribute('href') === 'https://ebird.org/checklist/S222')).toBe(true)
  })

  // maplibre's injected close button carries no tabIndex, and WebKit's default
  // tab mode (what the shipped Mac, iPhone and iPad apps run) gives a plain
  // <button> no place in the tab order, so a popup opened from the marker chip
  // could only be closed from the sidebar row that did not open it. The app
  // draws the control instead, which is also what puts it inside
  // lib/tabOrderCoverage.test.ts.
  it('turns maplibre’s own close button OFF and keeps closeOnClick false', () => {
    render(<NearbyLiferMarkers {...baseProps} sel="L100" onSelect={() => {}} />)
    const popup = popupProps.at(-1)!
    expect(popup.closeButton).toBe(false)
    // A stray map click must not dismiss this popup; unchanged by the fix.
    expect(popup.closeOnClick).toBe(false)
  })

  it('draws an app-owned close button with its own accessible name and an explicit tab stop', () => {
    render(<NearbyLiferMarkers {...baseProps} sel="L100" onSelect={() => {}} />)
    const close = screen.getByRole('button', { name: 'Close the nearby lifers popup' })
    expect(close.tagName).toBe('BUTTON')
    expect(close.getAttribute('tabindex')).toBe('0')
    // maplibre's own class, so it inherits the existing theming and the coarse-
    // pointer target already in globals.css.
    expect(close.className).toBe('maplibregl-popup-close-button')
  })

  it('routes the app-owned close button through onSelect(null), the popup’s own clearing path', () => {
    const onSelect = vi.fn()
    render(<NearbyLiferMarkers {...baseProps} sel="L100" onSelect={onSelect} />)

    fireEvent.click(screen.getByRole('button', { name: 'Close the nearby lifers popup' }))
    expect(onSelect).toHaveBeenCalledWith(null)
  })

  it('renders an always-visible locator dot inside each marker button (labels mode)', () => {
    render(<NearbyLiferMarkers {...baseProps} sel={null} onSelect={() => {}} markerMode="labels" />)
    const btn = screen.getByRole('button', { name: "Lawrence's Goldfinch, a nearby lifer at Hayward Regional Shoreline" })
    // The aria-hidden locator dot is a round span with a border radius of 50%.
    const dot = Array.from(btn.querySelectorAll('span')).find(s => s.style.borderRadius === '50%')
    expect(dot).toBeTruthy()
    expect(dot!.getAttribute('aria-hidden')).toBe('true')
    // Label text is present in labels mode.
    expect(btn.textContent).toContain("Lawrence's Goldfinch")
  })

  it('dots mode hides the label chip but keeps the dot, button, aria-label, and popup', () => {
    const onSelect = vi.fn()
    render(<NearbyLiferMarkers {...baseProps} sel={null} onSelect={onSelect} markerMode="dots" />)
    const btn = screen.getByRole('button', { name: '2 nearby lifers at Coyote Hills Regional Park' })
    // Dot still present.
    const dot = Array.from(btn.querySelectorAll('span')).find(s => s.style.borderRadius === '50%')
    expect(dot).toBeTruthy()
    // The label chip span is display:none in dots mode.
    const labelSpan = Array.from(btn.querySelectorAll('span')).find(s => s.textContent?.includes('2 species'))
    expect(labelSpan).toBeTruthy()
    expect(labelSpan!.style.display).toBe('none')
    // Clicking still lifts selection (popup path intact).
    fireEvent.click(btn)
    expect(onSelect).toHaveBeenCalledWith('L100')
  })

  it('dots mode still opens the popup listing every lifer', () => {
    render(<NearbyLiferMarkers {...baseProps} sel="L100" onSelect={() => {}} markerMode="dots" />)
    const popup = screen.getByTestId('popup')
    expect(within(popup).getByText("Lewis's Woodpecker")).toBeTruthy()
    expect(within(popup).getByText('Sage Thrasher')).toBeTruthy()
  })
})
