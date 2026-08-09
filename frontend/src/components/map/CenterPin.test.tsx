// @vitest-environment jsdom
//
// Surface B: the search-center pin promoted to a real activatable control
// (FR-15 / FR-16 / FR-17, QA-21 / QA-22, OQ-05) WITHOUT losing its drag.
//
// The case that matters is the one a slop comparison gets wrong in both
// directions: a maplibre drag can end with a synthesized `click` on the marker
// element (which must NOT open the copy affordance), while keyboard Enter and
// Space fire `click` with no preceding pointerdown (which MUST).

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import type { ReactNode } from 'react'

const markerProps = vi.hoisted(() => [] as Record<string, unknown>[])

vi.mock('react-map-gl/maplibre', () => ({
  useMap: () => ({ current: undefined }),
  Marker: (props: Record<string, unknown>) => {
    markerProps.push(props)
    return <div data-testid="marker">{props.children as ReactNode}</div>
  },
}))

import { CenterPin } from './MapControls'

beforeEach(() => { markerProps.length = 0 })
afterEach(() => { cleanup() })

function mount(onActivate = vi.fn(), onMove = vi.fn()) {
  render(<CenterPin lat={38.54321} lng={-121.98765} onMove={onMove} onActivate={onActivate} />)
  const pin = screen.getByRole('button', { name: /Copy this location$/ })
  const dragEnd = markerProps.at(-1)!.onDragEnd as (e: { lngLat: { lat: number; lng: number } }) => void
  return { pin, onActivate, onMove, dragEnd }
}

describe('CenterPin accessible name (FR-17, WCAG 2.5.3)', () => {
  it('leads with the coordinates exactly as the lat/lng fields display them, then names the action', () => {
    const { pin } = mount()
    expect(pin.tagName).toBe('BUTTON')
    // applyCenter writes the fields with toFixed(5); formatCoordinate produces
    // the same precision, so the two agree by construction.
    expect(pin.getAttribute('aria-label')).toBe('38.54321, -121.98765. Copy this location')
  })

  it('stays draggable, with onMove still firing on drag end (FR-14 / QA-22)', () => {
    const { onMove, dragEnd } = mount()
    expect(markerProps.at(-1)!.draggable).toBe(true)
    dragEnd({ lngLat: { lat: 40, lng: -100 } })
    expect(onMove).toHaveBeenCalledWith(40, -100)
  })
})

describe('activation versus drag (OQ-05, QA-21 / QA-22)', () => {
  it('an ordinary click (pointerdown then click) OPENS the copy affordance', () => {
    const { pin, onActivate } = mount()
    fireEvent.pointerDown(pin)
    fireEvent.click(pin)
    expect(onActivate).toHaveBeenCalledTimes(1)
  })

  it('a drag ending in a synthesized click does NOT open it', () => {
    const { pin, onActivate, dragEnd } = mount()
    fireEvent.pointerDown(pin)
    dragEnd({ lngLat: { lat: 40, lng: -100 } })
    fireEvent.click(pin) // maplibre's synthesized click after the drag
    expect(onActivate).not.toHaveBeenCalled()
  })

  it('the suppression does not LATCH: the next genuine click still opens it', () => {
    const { pin, onActivate, dragEnd } = mount()
    fireEvent.pointerDown(pin)
    dragEnd({ lngLat: { lat: 40, lng: -100 } })
    fireEvent.click(pin)
    expect(onActivate).not.toHaveBeenCalled()

    fireEvent.pointerDown(pin)
    fireEvent.click(pin)
    expect(onActivate).toHaveBeenCalledTimes(1)
  })

  it('does not swallow a keyboard activation, which fires click with NO pointerdown', () => {
    const { pin, onActivate, dragEnd } = mount()
    // A drag with no synthesized click leaves the guard armed…
    dragEnd({ lngLat: { lat: 40, lng: -100 } })
    // …and a keyboard Enter must still get through. This is the hole a pure
    // pointer-movement slop check has and the suppression ref does not.
    fireEvent.keyDown(pin, { key: 'Enter' })
    fireEvent.click(pin)
    expect(onActivate).toHaveBeenCalledTimes(1)
  })

  it('Space activates the same way as Enter', () => {
    const { pin, onActivate } = mount()
    fireEvent.keyDown(pin, { key: ' ' })
    fireEvent.click(pin)
    expect(onActivate).toHaveBeenCalledTimes(1)
  })
})

describe('focus restore target (FR-40)', () => {
  it('exposes its button through buttonRef so the popup can return focus to it', () => {
    const ref = { current: null as HTMLButtonElement | null }
    render(<CenterPin lat={1} lng={2} onMove={vi.fn()} onActivate={vi.fn()} buttonRef={ref} />)
    expect(ref.current).toBe(screen.getByRole('button', { name: /Copy this location$/ }))
  })
})
