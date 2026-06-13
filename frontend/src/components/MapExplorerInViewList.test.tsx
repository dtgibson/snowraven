// @vitest-environment jsdom
//
// The Map Explorer's sighting pins / hotspot teardrops render as GPU GL layers
// (canvas), so they can't be DOM focus targets. The keyboard path to them is the
// focusable in-view sidebar list (InViewMarkerList), scoped to the current map
// view via markersInView. This test covers that list the way the sightings
// sidebar wires it: in-view scoping → focusable buttons → activation that selects
// + pans (the onActivate the component passes does setSelected* + setPanTarget).

import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { InViewMarkerList, SegControl } from './map/MapSidebarUI'
import { markersInView, type MarkerBounds } from '../lib/markersInView'

afterEach(cleanup)

// LocationGroup-shaped fixtures (only the fields the sightings list reads).
interface Loc { locId: string; locName: string; lat: number; lng: number; count: number; species: Set<string> }

const LOCS: Loc[] = [
  { locId: 'L1', locName: 'Lake Merritt',   lat: 37.80, lng: -122.26, count: 120, species: new Set(['a', 'b', 'c']) },
  { locId: 'L2', locName: 'Tilden Park',    lat: 37.90, lng: -122.24, count: 40,  species: new Set(['a']) },
  { locId: 'L3', locName: 'Point Reyes',    lat: 38.05, lng: -122.80, count: 9,   species: new Set(['a', 'b']) }, // outside the bounds below
]

// A viewport that contains L1 + L2 but not L3 (Point Reyes is west of -122.5).
const BOUNDS: MarkerBounds = [-122.5, 37.5, -122.0, 38.0]

// Renders the list exactly as the sightings sidebar does: sort by count desc,
// scope to bounds, then map LocationGroup → list row.
function renderSightingsList(bounds: MarkerBounds | null, onActivate: (l: Loc) => void, selectedId: string | null = null) {
  const sorted = [...LOCS].sort((a, b) => b.count - a.count)
  const result = markersInView(sorted, bounds)
  return render(
    <InViewMarkerList
      heading="Sightings in view"
      instructions="Select a location to open its details on the map."
      items={result.visible}
      total={result.total}
      overCap={result.overCap}
      selectedId={selectedId}
      getId={l => l.locId}
      getPrimary={l => l.locName}
      getSecondary={l => `${l.count} observations · ${l.species.size} species`}
      getDotColor={() => 'var(--sr-map-visited)'}
      onActivate={onActivate}
    />,
  )
}

describe('Map Explorer in-view sightings list', () => {
  it('renders a focusable button for each in-view location only', () => {
    renderSightingsList(BOUNDS, vi.fn())
    // L1 and L2 are in view; L3 (Point Reyes) is outside the bounds.
    const inView = screen.getByRole('button', { name: /Lake Merritt/ })
    expect(inView).toBeTruthy()
    expect(screen.getByRole('button', { name: /Tilden Park/ })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Point Reyes/ })).toBeNull()
    // Each row is a real focusable button (tab order, not a div).
    expect(inView.tagName).toBe('BUTTON')
    expect(inView.getAttribute('tabindex')).toBe('0')
  })

  it('exposes list semantics with an explicit accessible label', () => {
    renderSightingsList(BOUNDS, vi.fn())
    const list = screen.getByRole('list', { name: 'Sightings in view' })
    expect(list.querySelectorAll('[role="listitem"]').length).toBe(2)
  })

  it('shows the same identity (name + count) the popup shows', () => {
    renderSightingsList(BOUNDS, vi.fn())
    expect(screen.getByText('120 observations · 3 species')).toBeTruthy()
  })

  it('activating a row selects + pans (calls onActivate with that location)', () => {
    const onActivate = vi.fn()
    renderSightingsList(BOUNDS, onActivate)
    fireEvent.click(screen.getByRole('button', { name: /Lake Merritt/ }))
    expect(onActivate).toHaveBeenCalledTimes(1)
    expect(onActivate.mock.calls[0][0]).toMatchObject({ locId: 'L1', lat: 37.80, lng: -122.26 })
  })

  it('keyboard activation works (Enter/Space fire the native button click)', () => {
    const onActivate = vi.fn()
    renderSightingsList(BOUNDS, onActivate)
    const btn = screen.getByRole('button', { name: /Tilden Park/ })
    btn.focus()
    expect(document.activeElement).toBe(btn)
    // A focusable <button> turns Enter/Space into a click — assert the click path
    // the keyboard would trigger selects that location.
    fireEvent.click(btn)
    expect(onActivate).toHaveBeenCalledWith(expect.objectContaining({ locId: 'L2' }))
  })

  it('marks the selected row with aria-pressed', () => {
    renderSightingsList(BOUNDS, vi.fn(), 'L1')
    expect(screen.getByRole('button', { name: /Lake Merritt/ }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByRole('button', { name: /Tilden Park/ }).getAttribute('aria-pressed')).toBe('false')
  })

  it('shows an empty-view hint when no markers are in the viewport', () => {
    // A bounds box over open ocean — none of the fixtures fall inside it.
    renderSightingsList([-130, 30, -129, 31], vi.fn())
    expect(screen.queryByRole('button', { name: /Lake Merritt/ })).toBeNull()
    expect(screen.getByText(/None in the current map view/)).toBeTruthy()
  })
})

// SegControl is the shared segmented control behind the Map Explorer radius,
// breeding filter, Pins/Heatmap, and All/Week toggles. Its active option must be
// exposed via aria-pressed (style-only state is invisible to a screen reader),
// and when given a group name it must announce as a labelled group (F008).
describe('SegControl segmented control semantics', () => {
  const OPTS = [
    { value: 'pins', label: 'Pins' },
    { value: 'heatmap', label: 'Heatmap' },
  ]

  it('exposes the active option via aria-pressed on every button', () => {
    render(<SegControl options={OPTS} value="pins" onChange={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Pins' }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByRole('button', { name: 'Heatmap' }).getAttribute('aria-pressed')).toBe('false')
  })

  it('moves aria-pressed when the value changes', () => {
    const { rerender } = render(<SegControl options={OPTS} value="pins" onChange={vi.fn()} />)
    rerender(<SegControl options={OPTS} value="heatmap" onChange={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Pins' }).getAttribute('aria-pressed')).toBe('false')
    expect(screen.getByRole('button', { name: 'Heatmap' }).getAttribute('aria-pressed')).toBe('true')
  })

  it('renders a labelled role=group only when ariaLabel is passed', () => {
    const { rerender } = render(<SegControl options={OPTS} value="pins" onChange={vi.fn()} />)
    // No ariaLabel: no group role (the buttons still carry aria-pressed).
    expect(screen.queryByRole('group')).toBeNull()
    rerender(<SegControl options={OPTS} value="pins" onChange={vi.fn()} ariaLabel="Display mode" />)
    expect(screen.getByRole('group', { name: 'Display mode' })).toBeTruthy()
  })

  it('clicking an option calls onChange with its value', () => {
    const onChange = vi.fn()
    render(<SegControl options={OPTS} value="pins" onChange={onChange} />)
    fireEvent.click(screen.getByRole('button', { name: 'Heatmap' }))
    expect(onChange).toHaveBeenCalledWith('heatmap')
  })
})
