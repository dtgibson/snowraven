// @vitest-environment jsdom

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'

// A fake MapLibre map that records the event handlers CenterPinDropper binds, so
// the test can fire map events (right-click, touch) without a real GL context.
type Handler = (e: unknown) => void
const handlers: Record<string, Handler[]> = {}
const fakeMap = {
  on: (ev: string, h: Handler) => { (handlers[ev] ||= []).push(h) },
  off: (ev: string, h: Handler) => { handlers[ev] = (handlers[ev] || []).filter(x => x !== h) },
}
function fire(ev: string, payload: unknown) { for (const h of [...(handlers[ev] || [])]) h(payload) }

vi.mock('react-map-gl/maplibre', () => ({
  useMap: () => ({ current: fakeMap }),
  Marker: () => null,
}))

import { CenterPinDropper } from './MapControls'

beforeEach(() => { for (const k of Object.keys(handlers)) delete handlers[k] })
afterEach(() => { cleanup(); vi.useRealTimers() })

const touch = (point: { x: number; y: number }, lngLat: { lat: number; lng: number }, count = 1) => ({
  originalEvent: { touches: Array.from({ length: count }, () => ({})) },
  point,
  lngLat,
})

describe('CenterPinDropper', () => {
  it('right-click (contextmenu) sets the center from the event lngLat', () => {
    const onDrop = vi.fn()
    render(<CenterPinDropper onDrop={onDrop} />)
    fire('contextmenu', { lngLat: { lat: 37.8, lng: -122.2 } })
    expect(onDrop).toHaveBeenCalledWith(37.8, -122.2)
  })

  it('a long-press (single finger, held without moving) sets the center', () => {
    vi.useFakeTimers()
    const onDrop = vi.fn()
    render(<CenterPinDropper onDrop={onDrop} />)
    fire('touchstart', touch({ x: 100, y: 100 }, { lat: 40, lng: -100 }))
    expect(onDrop).not.toHaveBeenCalled() // not until the hold elapses
    vi.advanceTimersByTime(600)
    expect(onDrop).toHaveBeenCalledWith(40, -100)
  })

  it('a touch that moves past the slop threshold cancels the long-press (it was a pan)', () => {
    vi.useFakeTimers()
    const onDrop = vi.fn()
    render(<CenterPinDropper onDrop={onDrop} />)
    fire('touchstart', touch({ x: 100, y: 100 }, { lat: 40, lng: -100 }))
    fire('touchmove', { point: { x: 130, y: 100 } }) // 30px > 10px slop
    vi.advanceTimersByTime(600)
    expect(onDrop).not.toHaveBeenCalled()
  })

  it('a second finger (pinch) cancels the long-press', () => {
    vi.useFakeTimers()
    const onDrop = vi.fn()
    render(<CenterPinDropper onDrop={onDrop} />)
    fire('touchstart', touch({ x: 100, y: 100 }, { lat: 40, lng: -100 }))
    fire('touchstart', touch({ x: 100, y: 100 }, { lat: 40, lng: -100 }, 2))
    vi.advanceTimersByTime(600)
    expect(onDrop).not.toHaveBeenCalled()
  })

  it('the map beginning to pan (movestart) cancels the long-press', () => {
    vi.useFakeTimers()
    const onDrop = vi.fn()
    render(<CenterPinDropper onDrop={onDrop} />)
    fire('touchstart', touch({ x: 100, y: 100 }, { lat: 40, lng: -100 }))
    fire('movestart', {})
    vi.advanceTimersByTime(600)
    expect(onDrop).not.toHaveBeenCalled()
  })

  it('a quick tap (touchend before the hold) does not set the center', () => {
    vi.useFakeTimers()
    const onDrop = vi.fn()
    render(<CenterPinDropper onDrop={onDrop} />)
    fire('touchstart', touch({ x: 100, y: 100 }, { lat: 40, lng: -100 }))
    fire('touchend', {})
    vi.advanceTimersByTime(600)
    expect(onDrop).not.toHaveBeenCalled()
  })

  it('suppresses a synthesized contextmenu fired right after a long-press (no double drop)', () => {
    vi.useFakeTimers()
    const onDrop = vi.fn()
    render(<CenterPinDropper onDrop={onDrop} />)
    fire('touchstart', touch({ x: 100, y: 100 }, { lat: 40, lng: -100 }))
    vi.advanceTimersByTime(600) // the long-press fires once
    expect(onDrop).toHaveBeenCalledTimes(1)
    fire('contextmenu', { lngLat: { lat: 40, lng: -100 } }) // platform-synthesized after the hold
    expect(onDrop).toHaveBeenCalledTimes(1) // suppressed — not a second drop/fetch
    vi.advanceTimersByTime(900)
    fire('contextmenu', { lngLat: { lat: 41, lng: -101 } }) // a genuine later right-click
    expect(onDrop).toHaveBeenCalledTimes(2)
  })

  it('unmounting removes the map listeners', () => {
    const onDrop = vi.fn()
    const { unmount } = render(<CenterPinDropper onDrop={onDrop} />)
    unmount()
    fire('contextmenu', { lngLat: { lat: 1, lng: 2 } })
    expect(onDrop).not.toHaveBeenCalled()
  })
})
