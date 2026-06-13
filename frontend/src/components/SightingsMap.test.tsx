// @vitest-environment jsdom
//
// The shared SightingsMap DOM pins must be keyboard-operable: each pin renders a
// real <button aria-label=…> child (Enter/Space → native click → opens the
// per-coordinate popup), and the popup must be keyboard-dismissable via a real
// close button (F014 / F044). Stubs the map deps — no maplibre-gl, no WebGL.

import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import type { ReactNode } from 'react'
import { SightingsMap } from './SightingsMap'
import type { SightingMarker } from '../lib/sightingMarkers'

// Capture the props each Popup is mounted with so we can assert closeButton.
const popupProps = vi.hoisted(() => [] as Record<string, unknown>[])

vi.mock('react-map-gl/maplibre', () => ({
  // The wrapper passes children straight through; the click listener maplibre
  // binds on the wrapper is modelled by forwarding the marker onClick to a click
  // on the button child via the test's fireEvent.
  Marker: ({ children, onClick }: { children?: ReactNode; onClick?: (e: { originalEvent: { stopPropagation: () => void } }) => void }) => (
    <div onClick={() => onClick?.({ originalEvent: { stopPropagation: () => {} } })}>{children}</div>
  ),
  Popup: (props: Record<string, unknown>) => { popupProps.push(props); return <div data-testid="popup">{props.children as ReactNode}</div> },
  useMap: () => ({ current: undefined }),
}))

vi.mock('./SnowMap', () => ({
  SnowMap: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}))

vi.mock('./speciesDetail/MapBoundsFitter', () => ({ MapBoundsFitter: () => null }))

const MARKERS: SightingMarker[] = [
  { lat: 37.8, lng: -122.27, sightings: [{ submissionId: 'S123', date: '2026-06-01' }, { submissionId: 'S124', date: '2026-05-20' }] },
]

afterEach(() => { cleanup(); popupProps.length = 0 })

describe('SightingsMap keyboard access', () => {
  it('renders each pin as a real <button> with a descriptive accessible name (F014)', () => {
    render(<SightingsMap markers={MARKERS} />)
    const btn = screen.getByRole('button', { name: /2 sightings/ })
    expect(btn.tagName).toBe('BUTTON')
  })

  it('activating the pin button opens the per-coordinate popup', () => {
    render(<SightingsMap markers={MARKERS} />)
    expect(screen.queryByTestId('popup')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /2 sightings/ }))
    // The popup lists the coordinate's checklist links.
    expect(screen.getByTestId('popup')).toBeTruthy()
  })

  it('mounts the popup WITH a close button so it is keyboard-dismissable (F044)', () => {
    render(<SightingsMap markers={MARKERS} />)
    fireEvent.click(screen.getByRole('button', { name: /2 sightings/ }))
    const popup = popupProps.at(-1)!
    // closeButton must NOT be disabled (maplibre renders a real <button aria-label="Close popup">).
    expect(popup.closeButton).not.toBe(false)
  })
})
