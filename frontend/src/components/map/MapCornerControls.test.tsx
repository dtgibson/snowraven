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
import { MapExitStandIn } from '../ui/MapExitStandIn'
import { IN_PLACE_ROW_CLASS, STAND_IN_ROW_CLASS } from '../../lib/mapExitStandIn'

/** A host in the shape of the three real ones. `withProvider` false models a map
 *  mounted outside any provider, which must still get its share button. */
function Host({ compact = false, withProvider = true, share = true, fsOnly = false }: {
  compact?: boolean; withProvider?: boolean; share?: boolean; fsOnly?: boolean
}) {
  const ref = useRef<HTMLDivElement>(null)
  const fs = useMapFullscreen({ containerRef: ref, baseClass: 'sr-map-container' })
  const row = <MapCornerControls compact={compact} share={share} fsOnly={fsOnly} />
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


describe('the Exit-only row and the visible word (map-scroll-on-phones D-10, D-12, D-13)', () => {
  it('share={false} renders the toggle alone: no share button and no slot for one', () => {
    render(<Host share={false} />)
    expect(toggle()).toBeTruthy()
    expect(screen.queryByRole('button', { name: /pin (at|to) the map cent(er|re)/i })).toBeNull()
    const row = document.querySelector('.sr-map-corner-row')!
    expect(row.querySelector('.sr-map-fab-slot')).toBeNull()
    expect(row.querySelectorAll('button')).toHaveLength(1)
  })

  it('fsOnly marks the row so the stylesheet draws it only inside the expanded panel', () => {
    render(<Host share={false} fsOnly />)
    expect(document.querySelector('.sr-map-corner-row')!.className).toBe('sr-map-corner-row sr-map-corner-row--fs-only')
    cleanup()
    render(<Host />)
    expect(document.querySelector('.sr-map-corner-row')!.className).toBe('sr-map-corner-row')
  })

  it('carries the word Exit only while expanded, and keeps the accessible name that contains it', () => {
    render(<Host />)
    expect(toggle().querySelector('.sr-map-exit-label')).toBeNull()
    fireEvent.click(toggle())
    const label = toggle().querySelector('.sr-map-exit-label')
    expect(label?.textContent).toBe('Exit')
    expect(toggle().getAttribute('aria-label')).toBe('Exit fullscreen')
    expect(toggle().getAttribute('aria-label')!.startsWith(label!.textContent!)).toBe(true)
    // The class list is HEAD's in both states: the pill is the stylesheet's
    // phone-tier business, never a class the component adds.
    expect(toggle().className).toBe('sr-map-fab sr-map-fab--std sr-map-fullscreen-btn')
  })
})

// ── The stand-in exit (map-scroll-on-phones D-38, the security review's M-1) ──
//
// A host that can open its panel before the map has drawn wraps the map subtree
// in MapExitStandIn, which draws this row's exit until this row arrives. These
// rows pin this row's half of that: it reports itself, it takes the focus the
// stand-in held, and it arrives without replaying its entrance. `drawn` mounts
// the row or a placeholder in its place, as SnowMap does.
describe('the row and the stand-in exit (D-38)', () => {
  function StandInHost({ drawn }: { drawn: boolean }) {
    const ref = useRef<HTMLDivElement>(null)
    const fs = useMapFullscreen({ containerRef: ref, baseClass: 'sr-map-container' })
    return (
      <>
        <button type="button" onClick={fs.open}>open the map</button>
        <div ref={ref} className={fs.className} data-testid="container">
          <MapFullscreenProvider value={fs}>
            <button type="button">a control inside the map</button>
            <MapExitStandIn compact={false}>
              {drawn ? <MapCornerControls compact={false} share={false} fsOnly /> : <div role="status">Loading map…</div>}
            </MapExitStandIn>
          </MapFullscreenProvider>
        </div>
      </>
    )
  }
  const exits = () => screen.queryAllByRole('button', { name: 'Exit fullscreen' })
  const opener = () => screen.getByRole('button', { name: 'open the map' })
  const standIn = () => document.querySelector(`.${STAND_IN_ROW_CLASS}`)
  const row = () => document.querySelector(`.sr-map-corner-row:not(.${STAND_IN_ROW_CLASS})`)

  it('the stand-in is drawn exactly while the panel is open and this row is absent, so there is always one exit', () => {
    const { rerender } = render(<StandInHost drawn={false} />)
    expect(exits()).toHaveLength(0)                      // collapsed: nothing to exit
    fireEvent.click(opener())
    expect(exits()).toHaveLength(1)
    expect(standIn()).not.toBeNull()
    rerender(<StandInHost drawn />)                      // the map arrives while open
    expect(exits()).toHaveLength(1)
    expect(standIn()).toBeNull()
    expect(row()!.contains(exits()[0])).toBe(true)
    rerender(<StandInHost drawn={false} />)              // and if it ever goes while open
    expect(exits()).toHaveLength(1)
    expect(standIn()).not.toBeNull()
  })

  it('takes the focus the stand-in held, and focus that had fallen to <body>, and leaves focus elsewhere alone', () => {
    const { rerender } = render(<StandInHost drawn={false} />)
    opener().focus()
    fireEvent.click(opener())
    expect(document.activeElement).toBe(exits()[0])      // focus on open lands on the stand-in
    rerender(<StandInHost drawn />)
    expect(document.activeElement).toBe(exits()[0])
    expect(document.activeElement).not.toBe(document.body)

    cleanup()
    const second = render(<StandInHost drawn={false} />)
    fireEvent.click(opener())
    ;(document.activeElement as HTMLElement).blur()
    expect(document.activeElement).toBe(document.body)
    second.rerender(<StandInHost drawn />)
    expect(document.activeElement).toBe(exits()[0])

    cleanup()
    const third = render(<StandInHost drawn={false} />)
    fireEvent.click(opener())
    const other = screen.getByRole('button', { name: 'a control inside the map' })
    other.focus()
    third.rerender(<StandInHost drawn />)
    expect(document.activeElement).toBe(other)
  })

  it('arrives in place in a panel the stand-in holds open, and animates again on the next open', () => {
    const { rerender } = render(<StandInHost drawn={false} />)
    fireEvent.click(opener())
    rerender(<StandInHost drawn />)
    expect(row()!.classList.contains(IN_PLACE_ROW_CLASS)).toBe(true)
    fireEvent.click(exits()[0])
    expect(row()!.classList.contains(IN_PLACE_ROW_CLASS)).toBe(false)
    fireEvent.click(opener())
    expect(row()!.classList.contains(IN_PLACE_ROW_CLASS)).toBe(false)
  })

  it('the stand-in registers itself as the panel\'s toggle, so focus on open never rests on the fallback selector', () => {
    // Two mechanisms put focus on the stand-in at open: `registerToggle`, and
    // the hook's `.sr-map-fullscreen-btn` fallback, which the stand-in's class
    // list also matches. The contract keeps the selector an optional last
    // resort, so the registration is pinned on its own: with it removed the
    // behaviour above stays green through the fallback alone (mutation M8).
    const seen: (HTMLButtonElement | null)[] = []
    function SpyHost() {
      const ref = useRef<HTMLDivElement>(null)
      const fs = useMapFullscreen({ containerRef: ref, baseClass: 'sr-map-container' })
      const { registerToggle } = fs
      const spied = { ...fs, registerToggle: (el: HTMLButtonElement | null) => { seen.push(el); registerToggle(el) } }
      return (
        <>
          <button type="button" onClick={fs.open}>open the map</button>
          <div ref={ref} className={fs.className}>
            <MapFullscreenProvider value={spied}>
              <MapExitStandIn compact={false}><div role="status">Loading map…</div></MapExitStandIn>
            </MapFullscreenProvider>
          </div>
        </>
      )
    }
    render(<SpyHost />)
    fireEvent.click(opener())
    expect(seen).toContain(exits()[0])
  })

  it('a row that drew before the panel opened never takes the class and never meets a stand-in', () => {
    render(<StandInHost drawn />)
    fireEvent.click(opener())
    expect(exits()).toHaveLength(1)
    expect(standIn()).toBeNull()
    expect(row()!.className).toBe('sr-map-corner-row sr-map-corner-row--fs-only')
  })
})
