// @vitest-environment jsdom
//
// The share pin: the drop gesture and its cancel cases through the EXTRACTED
// hook (QA-05 to QA-09), one pin per map (QA-11), the keyboard route (QA-43 /
// QA-44), the marker anchor offset, the close path (QA-14 / QA-15) and the
// button host. Uses the same fake-MapLibre harness shape as
// CenterPinDropper.test.tsx — recorded handlers, no live map, no WebGL.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react'
import type { ReactNode } from 'react'

type Handler = (e: unknown) => void
const handlers = vi.hoisted(() => ({}) as Record<string, Handler[]>)
const canvas = vi.hoisted(() => ({ focused: 0 }))
const markerProps = vi.hoisted(() => [] as Record<string, unknown>[])

const fakeCanvas = vi.hoisted(() => ({
  isConnected: true,
  focus() { canvas.focused += 1 },
})) as unknown as HTMLCanvasElement

const fakeMap = vi.hoisted(() => ({
  on: (ev: string, h: Handler) => { (handlers[ev] ||= []).push(h) },
  off: (ev: string, h: Handler) => { handlers[ev] = (handlers[ev] || []).filter(x => x !== h) },
  getCenter: () => ({ lat: 44.4321, lng: -110.5678 }),
  getCanvas: () => fakeCanvas,
  // SharePopup measures its compact scroll cap from the map, so the double has
  // to model the same surface the real MapRef exposes.
  getContainer: () => ({ clientHeight: 220 }),
  project: () => ({ x: 0, y: 110 }),
}))

function fire(ev: string, payload: unknown) { for (const h of [...(handlers[ev] || [])]) h(payload) }

vi.mock('react-map-gl/maplibre', () => ({
  useMap: () => ({ current: fakeMap }),
  Marker: (props: Record<string, unknown>) => {
    markerProps.push(props)
    return <div data-testid="marker">{props.children as ReactNode}</div>
  },
  // The popup body is exercised in SharePopup.test.tsx; here we only need to see
  // whether it is mounted and with what coordinates.
  Popup: (props: Record<string, unknown>) => (
    <div data-testid="popup" data-lat={String(props.latitude)} data-lng={String(props.longitude)}>
      {props.children as ReactNode}
    </div>
  ),
}))

vi.mock('../../lib/clipboard', () => ({ copyText: vi.fn().mockResolvedValue(true) }))
vi.mock('../../lib/storage', () => ({ storage: { getSetting: vi.fn().mockResolvedValue(null), setSetting: vi.fn().mockResolvedValue(undefined) } }))

import { SharePin } from './SharePin'

beforeEach(() => {
  for (const k of Object.keys(handlers)) delete handlers[k]
  markerProps.length = 0
  canvas.focused = 0
})
afterEach(() => { cleanup(); vi.useRealTimers() })

const touch = (point: { x: number; y: number }, lngLat: { lat: number; lng: number }, count = 1) => ({
  originalEvent: { touches: Array.from({ length: count }, () => ({})) },
  point,
  lngLat,
})

const pinButton = () => screen.queryByRole('button', { name: /Share this location$/ })

describe('the drop gesture (FR-02 / FR-04, QA-02 to QA-09)', () => {
  it('a right-click drops a pin at the clicked coordinate and opens the popup', () => {
    render(<SharePin compact={false} buttonHost="corner" />)
    expect(pinButton()).toBeNull()

    act(() => { fire('contextmenu', { lngLat: { lat: 37.8, lng: -122.2 } }) })

    expect(screen.getByRole('button', { name: '37.80000, -122.20000. Share this location' })).toBeTruthy()
    expect(screen.getByTestId('popup')).toBeTruthy()
  })

  it('a stationary long-press drops a pin at the pressed coordinate', () => {
    vi.useFakeTimers()
    render(<SharePin compact={false} buttonHost="corner" />)
    act(() => { fire('touchstart', touch({ x: 100, y: 100 }, { lat: 40, lng: -100 })) })
    expect(pinButton()).toBeNull() // not until the hold elapses
    act(() => { vi.advanceTimersByTime(600) })
    expect(screen.getByRole('button', { name: '40.00000, -100.00000. Share this location' })).toBeTruthy()
  })

  it.each([
    ['a pan (movestart)', () => fire('movestart', {})],
    ['a drag start', () => fire('dragstart', {})],
    ['a zoom start', () => fire('zoomstart', {})],
    ['moving past the slop tolerance', () => fire('touchmove', { point: { x: 130, y: 100 } })],
    ['a second finger (pinch)', () => fire('touchstart', touch({ x: 100, y: 100 }, { lat: 40, lng: -100 }, 2))],
    ['an early release', () => fire('touchend', {})],
    ['a cancelled touch', () => fire('touchcancel', {})],
  ])('%s cancels the long-press: no pin, no popup', (_label, interrupt) => {
    vi.useFakeTimers()
    render(<SharePin compact={false} buttonHost="corner" />)
    act(() => { fire('touchstart', touch({ x: 100, y: 100 }, { lat: 40, lng: -100 })) })
    act(() => { interrupt() })
    act(() => { vi.advanceTimersByTime(600) })
    expect(pinButton()).toBeNull()
    expect(screen.queryByTestId('popup')).toBeNull()
  })

  it('a cancelled gesture leaves an EXISTING pin untouched (QA-08)', () => {
    vi.useFakeTimers()
    render(<SharePin compact={false} buttonHost="corner" />)
    act(() => { fire('contextmenu', { lngLat: { lat: 37.8, lng: -122.2 } }) })

    act(() => { fire('touchstart', touch({ x: 10, y: 10 }, { lat: 1, lng: 2 })) })
    act(() => { fire('touchend', {}) })
    act(() => { vi.advanceTimersByTime(600) })

    expect(screen.getByRole('button', { name: '37.80000, -122.20000. Share this location' })).toBeTruthy()
  })

  it('a synthesized contextmenu right after a long-press drops ONE pin, not two (QA-09)', () => {
    vi.useFakeTimers()
    render(<SharePin compact={false} buttonHost="corner" />)
    act(() => { fire('touchstart', touch({ x: 100, y: 100 }, { lat: 40, lng: -100 })) })
    act(() => { vi.advanceTimersByTime(600) })
    act(() => { fire('contextmenu', { lngLat: { lat: 41, lng: -101 } }) }) // platform-synthesized
    // Suppressed: the pin is still at the long-press coordinate.
    expect(screen.getByRole('button', { name: '40.00000, -100.00000. Share this location' })).toBeTruthy()
    // A genuine later right-click still moves it.
    act(() => { vi.advanceTimersByTime(900) })
    act(() => { fire('contextmenu', { lngLat: { lat: 41, lng: -101 } }) })
    expect(screen.getByRole('button', { name: '41.00000, -101.00000. Share this location' })).toBeTruthy()
  })

  it('unmounting removes the map listeners', () => {
    const { unmount } = render(<SharePin compact={false} buttonHost="corner" />)
    unmount()
    expect(() => fire('contextmenu', { lngLat: { lat: 1, lng: 2 } })).not.toThrow()
    expect(pinButton()).toBeNull()
  })
})

describe('one pin per map (FR-06, QA-11)', () => {
  it('a second drop MOVES the pin rather than adding one', () => {
    render(<SharePin compact={false} buttonHost="corner" />)
    act(() => { fire('contextmenu', { lngLat: { lat: 37.8, lng: -122.2 } }) })
    act(() => { fire('contextmenu', { lngLat: { lat: 10.5, lng: 20.25 } }) })

    expect(screen.getAllByRole('button', { name: /Share this location$/ })).toHaveLength(1)
    expect(screen.getByRole('button', { name: '10.50000, 20.25000. Share this location' })).toBeTruthy()
    expect(screen.getAllByTestId('popup')).toHaveLength(1)
  })
})

describe('the marker anchor (the staff foot is the coordinate)', () => {
  it('shifts the sprite right by 7px at normal size and 6px compact', () => {
    render(<SharePin compact={false} buttonHost="corner" />)
    act(() => { fire('contextmenu', { lngLat: { lat: 1, lng: 2 } }) })
    const normal = markerProps.at(-1)!
    expect(normal.anchor).toBe('bottom')
    expect(normal.offset).toEqual([7, 0])
    expect(normal.draggable).toBe(true)

    cleanup()
    markerProps.length = 0
    render(<SharePin compact buttonHost="corner" />)
    act(() => { fire('contextmenu', { lngLat: { lat: 1, lng: 2 } }) })
    expect(markerProps.at(-1)!.offset).toEqual([6, 0])
  })
})

describe('drag (FR-07, QA-12)', () => {
  it('updates the displayed coordinates and keeps the popup open and following', () => {
    render(<SharePin compact={false} buttonHost="corner" />)
    act(() => { fire('contextmenu', { lngLat: { lat: 37.8, lng: -122.2 } }) })

    const onDrag = markerProps.at(-1)!.onDrag as (e: { lngLat: { lat: number; lng: number } }) => void
    act(() => { onDrag({ lngLat: { lat: 37.9, lng: -122.3 } }) })

    expect(screen.getByRole('button', { name: '37.90000, -122.30000. Share this location' })).toBeTruthy()
    const popup = screen.getByTestId('popup')
    expect(popup.getAttribute('data-lat')).toBe('37.9')
    expect(popup.getAttribute('data-lng')).toBe('-122.3')
  })
})

describe('the keyboard route (FR-38 / FR-39, QA-43 / QA-44)', () => {
  it('the drop button plants a pin at the map center with no pointer gesture', () => {
    render(<SharePin compact={false} buttonHost="corner" />)
    const btn = screen.getByRole('button', { name: 'Drop a pin at the map center' })
    expect(btn.getAttribute('aria-pressed')).toBe('false')

    fireEvent.click(btn)

    expect(screen.getByRole('button', { name: '44.43210, -110.56780. Share this location' })).toBeTruthy()
    expect(screen.getByTestId('popup')).toBeTruthy()
  })

  it('relabels itself and goes active once a pin exists', () => {
    render(<SharePin compact={false} buttonHost="corner" />)
    act(() => { fire('contextmenu', { lngLat: { lat: 1, lng: 2 } }) })
    const btn = screen.getByRole('button', { name: 'Move the pin to the map center' })
    expect(btn.getAttribute('aria-pressed')).toBe('true')
    expect(btn.getAttribute('title')).toBe('Move the pin to the map center')
  })

  it('the pin is a real <button> whose name LEADS with the coordinates as rendered', () => {
    render(<SharePin compact={false} buttonHost="corner" />)
    act(() => { fire('contextmenu', { lngLat: { lat: 37.8, lng: -122.2 } }) })
    const pin = pinButton()!
    expect(pin.tagName).toBe('BUTTON')
    expect(pin.getAttribute('aria-label')).toBe('37.80000, -122.20000. Share this location')
    // The coordinate the popup shows is the same string the name leads with.
    expect(screen.getByText('37.80000, -122.20000')).toBeTruthy()
  })
})

describe('close (FR-09 / FR-40, QA-14 / QA-15 / QA-45)', () => {
  it('the close control removes the popup AND the pin together', () => {
    render(<SharePin compact={false} buttonHost="corner" />)
    act(() => { fire('contextmenu', { lngLat: { lat: 37.8, lng: -122.2 } }) })

    fireEvent.click(screen.getByRole('button', { name: 'Close and remove the pin' }))

    expect(screen.queryByTestId('popup')).toBeNull()
    expect(pinButton()).toBeNull()
  })

  it('Escape removes the popup AND the pin together', () => {
    render(<SharePin compact={false} buttonHost="corner" />)
    act(() => { fire('contextmenu', { lngLat: { lat: 37.8, lng: -122.2 } }) })

    act(() => { fireEvent.keyDown(document, { key: 'Escape' }) })

    expect(screen.queryByTestId('popup')).toBeNull()
    expect(pinButton()).toBeNull()
  })

  it('returns focus to the drop button when the drop came FROM the drop button', () => {
    render(<SharePin compact={false} buttonHost="corner" />)
    const btn = screen.getByRole('button', { name: 'Drop a pin at the map center' })
    fireEvent.click(btn)

    act(() => { fireEvent.keyDown(document, { key: 'Escape' }) })

    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Drop a pin at the map center' }))
  })

  it('returns focus to the map canvas after a POINTER drop, which has no opener element', () => {
    render(<SharePin compact={false} buttonHost="corner" />)
    act(() => { fire('contextmenu', { lngLat: { lat: 37.8, lng: -122.2 } }) })
    act(() => { fireEvent.keyDown(document, { key: 'Escape' }) })
    expect(canvas.focused).toBe(1)
  })

  it('falls back to the canvas when the opener was the PIN, which closing unmounts', () => {
    // Closing removes the pin and the popup together, so the pin a user clicked
    // to reopen the popup is gone by restore time. Without the fallback the
    // keyboard user would be dropped on <body>.
    render(<SharePin compact={false} buttonHost="corner" />)
    act(() => { fire('contextmenu', { lngLat: { lat: 37.8, lng: -122.2 } }) })
    fireEvent.click(pinButton()!)
    canvas.focused = 0

    act(() => { fireEvent.keyDown(document, { key: 'Escape' }) })

    expect(pinButton()).toBeNull()
    expect(canvas.focused).toBe(1)
  })
})

describe('the drop button host', () => {
  it('renders in its own bottom-right corner wrapper on the non-Map-Explorer maps', () => {
    const { container } = render(<SharePin compact={false} buttonHost="corner" />)
    expect(container.querySelector('.sr-share-corner')).toBeTruthy()
    expect(container.querySelector('.sr-share-corner--compact')).toBeNull()
  })

  it('takes the compact corner and the compact button on a card map', () => {
    const { container } = render(<SharePin compact buttonHost="corner" />)
    expect(container.querySelector('.sr-share-corner--compact')).toBeTruthy()
    expect(container.querySelector('.sr-share-drop-btn--compact')).toBeTruthy()
  })

  it('portals the button into a host element (Map Explorer\'s shipped FAB cluster)', () => {
    const host = document.createElement('div')
    host.id = 'fab-cluster'
    document.body.appendChild(host)
    const { container } = render(<SharePin compact={false} buttonHost={host} />)

    expect(host.querySelector('.sr-share-drop-btn')).toBeTruthy()
    expect(container.querySelector('.sr-share-corner')).toBeNull()
    host.remove()
  })

  it('renders NO button when the host is null, leaving the gesture and pin working', () => {
    render(<SharePin compact={false} buttonHost={null} />)
    expect(screen.queryByRole('button', { name: /pin at the map center/ })).toBeNull()

    act(() => { fire('contextmenu', { lngLat: { lat: 37.8, lng: -122.2 } }) })
    expect(pinButton()).toBeTruthy()
  })
})
