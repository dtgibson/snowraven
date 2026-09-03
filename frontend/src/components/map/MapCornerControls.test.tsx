// @vitest-environment jsdom
//
// feature: map-fullscreen-toggle — the corner row: the control's vocabulary and
// classes (FR-02, FR-04; QA-02, QA-03, QA-04, QA-07), share-button-then-toggle
// order (FR-03, QA-05), the explicit resize on every mode change (FR-13, QA-19)
// and the gesture handoff on the live instance (FR-15, QA-21).
//
// Fake-MapLibre harness in the shape SharePin.test.tsx and CenterPinDropper.test
// .tsx already use: recorded handlers, no live map, no WebGL. The MapRef double
// carries `resize` and `getMap` because the real one does — and `getMap` is the
// only route to the gesture handlers, since react-map-gl's createRef copies the
// map's FUNCTIONS onto the ref object and leaves its handler PROPERTIES behind.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { useRef, type ReactNode } from 'react'

type Handler = (e: unknown) => void
const handlers = vi.hoisted(() => ({}) as Record<string, Handler[]>)
const calls = vi.hoisted(() => ({ resize: 0 }))

/** The gesture handlers, modelling maplibre's enable/disable/isEnabled trio. */
const gestures = vi.hoisted(() => {
  const make = (initial: boolean) => {
    const state = { on: initial }
    return {
      state,
      handler: {
        enable: () => { state.on = true },
        disable: () => { state.on = false },
        isEnabled: () => state.on,
      },
    }
  }
  return { make }
})

const scrollZoom = vi.hoisted(() => ({ current: null as ReturnType<typeof gestures.make> | null }))
const cooperative = vi.hoisted(() => ({ current: null as ReturnType<typeof gestures.make> | null }))

const rawMap = vi.hoisted(() => ({
  get scrollZoom() { return scrollZoom.current!.handler },
  get cooperativeGestures() { return cooperative.current!.handler },
}))

const fakeMapRef = vi.hoisted(() => ({
  on: (ev: string, h: Handler) => { (handlers[ev] ||= []).push(h) },
  off: (ev: string, h: Handler) => { handlers[ev] = (handlers[ev] || []).filter(x => x !== h) },
  getCenter: () => ({ lat: 44.4, lng: -110.5 }),
  getCanvas: () => ({ isConnected: true, focus() {} }),
  getContainer: () => ({ clientHeight: 320 }),
  project: () => ({ x: 0, y: 160 }),
  resize: () => { calls.resize += 1 },
  getMap: () => rawMap,
}))

vi.mock('react-map-gl/maplibre', () => ({
  useMap: () => ({ current: fakeMapRef }),
  Marker: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  Popup: ({ children }: { children?: ReactNode }) => <div data-testid="popup">{children}</div>,
}))
vi.mock('../../lib/clipboard', () => ({ copyText: vi.fn().mockResolvedValue(true) }))
vi.mock('../../lib/storage', () => ({
  storage: { getSetting: vi.fn().mockResolvedValue(null), setSetting: vi.fn().mockResolvedValue(undefined) },
}))

import { MapCornerControls } from './MapCornerControls'
import { useMapFullscreen, MapFullscreenProvider } from '../../lib/useMapFullscreen'

/** A host in the shape of the three real ones. `withProvider` false models a map
 *  mounted outside any provider, which must still get its share button. */
function Host({ compact = false, withProvider = true }: { compact?: boolean; withProvider?: boolean }) {
  const ref = useRef<HTMLDivElement>(null)
  const fs = useMapFullscreen({ containerRef: ref, baseClass: 'sr-map-container' })
  const row = <MapCornerControls compact={compact} />
  return (
    <div ref={ref} className={fs.className} data-testid="container">
      {withProvider ? <MapFullscreenProvider value={fs}>{row}</MapFullscreenProvider> : row}
    </div>
  )
}

const toggle = () => screen.getByRole('button', { name: /fullscreen$/ })
const dropButton = () => screen.getByRole('button', { name: /pin (at|to) the map cent(er|re)/i })

beforeEach(() => {
  for (const k of Object.keys(handlers)) delete handlers[k]
  calls.resize = 0
  // The page-embedded posture: three of the four mounts pass
  // `scrollZoom={false} cooperativeGestures`.
  scrollZoom.current = gestures.make(false)
  cooperative.current = gestures.make(true)
})
afterEach(() => cleanup())

describe('the row and its two controls (FR-01 to FR-04)', () => {
  it('renders the fullscreen toggle beside the share drop button', () => {
    render(<Host />)
    expect(toggle()).toBeTruthy()
    expect(dropButton()).toBeTruthy()
  })

  it('puts the SHARE button first in DOM order, which is also reading order (QA-05)', () => {
    // The share button reaches that position by portalling into a
    // `display: contents` slot placed physically first, so no `order` property
    // exists anywhere and tab order cannot desynchronize from reading order.
    render(<Host />)
    const row = document.querySelector('.sr-map-corner-row')!
    const buttons = Array.from(row.querySelectorAll('button'))
    expect(buttons).toHaveLength(2)
    expect(buttons[0]).toBe(dropButton())
    expect(buttons[1]).toBe(toggle())
    // ...and the slot really is the mechanism, rather than the button happening
    // to render in the right place.
    const slot = row.querySelector('.sr-map-fab-slot')!
    expect(slot.contains(dropButton())).toBe(true)
  })

  it('renders NO toggle when the map is outside a provider, keeping the share button', () => {
    // The correct degenerate behaviour: a map with no fullscreen host is a map
    // with no fullscreen, not a broken row. It is also what keeps SightingsMap's
    // own suite green with no provider in sight.
    render(<Host withProvider={false} />)
    expect(screen.queryByRole('button', { name: /fullscreen$/ })).toBeNull()
    expect(dropButton()).toBeTruthy()
  })

  it('is a real <button type="button">, not a div with a click handler', () => {
    render(<Host />)
    expect(toggle().tagName).toBe('BUTTON')
    expect(toggle().getAttribute('type')).toBe('button')
  })
})

describe('classes and glyph (FR-04, QA-03, QA-04)', () => {
  it('carries the FAB base, the size modifier and the state hook', () => {
    render(<Host />)
    expect(toggle().className).toBe('sr-map-fab sr-map-fab--std sr-map-fullscreen-btn')
  })

  it('takes the compact modifier on the card map, and the row takes its compact anchor', () => {
    render(<Host compact />)
    expect(toggle().className).toBe('sr-map-fab sr-map-fab--compact sr-map-fullscreen-btn')
    expect(document.querySelector('.sr-map-corner-row')!.className)
      .toBe('sr-map-corner-row sr-map-corner-row--compact')
  })

  it('does NOT change size modifier when the map expands', () => {
    // FR-04 binds this. A control that grows under the finger that just pressed
    // it is a second state change nobody asked for, on the one map where the
    // button sits closest to the edge.
    render(<Host compact />)
    const before = toggle().className
    fireEvent.click(toggle())
    expect(toggle().className).toBe(before)
  })

  it('swaps Maximize2 for Minimize2 with the state', () => {
    render(<Host />)
    expect(toggle().querySelector('svg')!.getAttribute('class')).toContain('lucide-maximize-2')
    fireEvent.click(toggle())
    expect(toggle().querySelector('svg')!.getAttribute('class')).toContain('lucide-minimize-2')
    fireEvent.click(toggle())
    expect(toggle().querySelector('svg')!.getAttribute('class')).toContain('lucide-maximize-2')
  })
})

describe('accessible names (FR-06, QA-07)', () => {
  it('no two controls on the map share a name, collapsed or expanded', () => {
    render(<Host />)
    const names = () => screen.getAllByRole('button').map(b => b.getAttribute('aria-label') ?? b.textContent)
    expect(new Set(names()).size).toBe(names().length)
    fireEvent.click(toggle())
    expect(new Set(names()).size).toBe(names().length)
    // Non-vacuity: there really are two controls to collide.
    expect(names().length).toBeGreaterThanOrEqual(2)
  })
})

describe('the explicit resize (FR-13, QA-19)', () => {
  it('resizes on EVERY mode change, in both directions, with a next-frame repeat', async () => {
    // The container's new geometry is committed before the layout effect runs, and
    // map.resize() reads clientWidth/clientHeight, which forces it to be computed.
    // The next-frame call is for WKWebView, where 100dvh can settle a frame late.
    render(<Host />)
    const afterMount = calls.resize
    expect(afterMount).toBeGreaterThan(0)

    fireEvent.click(toggle())                         // expand
    expect(calls.resize).toBeGreaterThan(afterMount)
    const afterExpand = calls.resize
    await new Promise(r => requestAnimationFrame(() => r(null)))
    expect(calls.resize).toBeGreaterThan(afterExpand) // the next-frame repeat

    const beforeCollapse = calls.resize
    fireEvent.click(toggle())                         // collapse
    expect(calls.resize).toBeGreaterThan(beforeCollapse)
  })

  it('does not resize on a re-render that is not a mode change', () => {
    // Guard the guard: an effect with no `expanded` dep would satisfy the row
    // above by resizing constantly.
    const { rerender } = render(<Host />)
    const before = calls.resize
    rerender(<Host />)
    expect(calls.resize).toBe(before)
  })
})

describe('the gesture handoff (FR-15, OQ-02, QA-21)', () => {
  it('releases the page-embedded posture while expanded and restores it on collapse', () => {
    render(<Host />)
    expect(scrollZoom.current!.state.on).toBe(false)
    expect(cooperative.current!.state.on).toBe(true)

    fireEvent.click(toggle())
    // In fullscreen there is no page to scroll and the map IS the primary
    // interaction, so the two-finger requirement becomes an obstacle with
    // nothing behind it.
    expect(scrollZoom.current!.state.on).toBe(true)
    expect(cooperative.current!.state.on).toBe(false)

    fireEvent.click(toggle())
    expect(scrollZoom.current!.state.on).toBe(false)
    expect(cooperative.current!.state.on).toBe(true)
  })

  it('restores an in-flow posture that is the OPPOSITE of the row above', () => {
    // The second row of the roster, and the reason the in-flow values are
    // CAPTURED rather than assumed: a mount that arrives with scroll zoom ON must
    // still have it ON after a round trip. A restore hardcoded to the other
    // three mounts' posture would silently break that — and would break it
    // invisibly, since the row above would still pass.
    //
    // What this row is NOT, and used to say it was: the Statistics map. That
    // mount passes neither `scrollZoom` nor `cooperativeGestures`, but "passes
    // neither" is not "maplibre's defaults" — SnowMap forwards both regardless,
    // so it is constructed with `scrollZoom: undefined`, an own key that shadows
    // maplibre's `true` default. QA measured its live posture in both engines as
    // scroll zoom OFF, cooperative gestures OFF. The property this row proves is
    // unchanged and still the one that matters, so the assertions below stand as
    // they were; only the false attribution is gone.
    scrollZoom.current = gestures.make(true)
    cooperative.current = gestures.make(false)
    render(<Host />)

    fireEvent.click(toggle())
    expect(scrollZoom.current.state.on).toBe(true)
    expect(cooperative.current.state.on).toBe(false)

    fireEvent.click(toggle())
    expect(scrollZoom.current.state.on).toBe(true)
    expect(cooperative.current.state.on).toBe(false)
  })

  it('touches neither handler while the map is collapsed', () => {
    render(<Host />)
    expect(scrollZoom.current!.state.on).toBe(false)
    expect(cooperative.current!.state.on).toBe(true)
  })

  it('restores on unmount while still expanded', () => {
    const { unmount } = render(<Host />)
    fireEvent.click(toggle())
    expect(scrollZoom.current!.state.on).toBe(true)
    unmount()
    expect(scrollZoom.current!.state.on).toBe(false)
    expect(cooperative.current!.state.on).toBe(true)
  })
})
