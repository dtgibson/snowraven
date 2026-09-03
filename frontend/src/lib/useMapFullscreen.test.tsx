// @vitest-environment jsdom
//
// feature: map-fullscreen-toggle — the hook that owns the boolean, the container
// class, Escape, focus restore, the focus trap, the body scroll lock and all
// four teardown paths (FR-16 to FR-20, FR-24; QA-22 to QA-26, QA-30).
//
// NO MAP IMPORTS ANYWHERE IN THIS FILE, deliberately: the subject is entry-safe
// and its behaviour is testable without one. The map-side half (the corner row,
// the resize and the gesture handoff) is exercised in
// components/map/MapCornerControls.test.tsx.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { useEffect, useRef, useState } from 'react'
import { useMapFullscreen, MAP_FS_PANEL_CLASS } from './useMapFullscreen'
import { useFocusTrap } from './useFocusTrap'

/**
 * A stand-in host with the shape all three real ones share: a container div
 * carrying the composed class, a fullscreen toggle registered through the hook,
 * and two more focusable controls standing in for the base switcher and the
 * share drop button so the trap has a set with ends.
 *
 * `branch` models Species Detail's Pins/Heatmap swap: flipping it replaces the
 * toggle ELEMENT while the container, and therefore the hook, stays put.
 */
function Host({ active = true, resetKey, branch = 'a', baseClass = 'sr-map-container' }: {
  active?: boolean
  resetKey?: string | number
  branch?: 'a' | 'b'
  baseClass?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  // Destructured for the same reason MapCornerControls does it: a member
  // expression in `ref=` makes the compiler treat the whole object as a ref.
  const { className, expanded, toggle: onToggle, registerToggle } =
    useMapFullscreen({ containerRef: ref, baseClass, active, resetKey })
  return (
    <>
      <button type="button">outside the overlay</button>
      <div ref={ref} className={className} data-testid="container">
        <button type="button">Base map</button>
        {active && (
          <button
            type="button"
            key={branch}
            ref={registerToggle}
            className="sr-map-fab sr-map-fab--std sr-map-fullscreen-btn"
            aria-label={expanded ? 'Exit fullscreen' : 'Enter fullscreen'}
            aria-pressed={expanded}
            onClick={onToggle}
          >
            {branch}
          </button>
        )}
        <button type="button">Drop a pin at the map center</button>
      </div>
    </>
  )
}

/** SharePopup's shipped Escape handler, reproduced exactly: CAPTURE phase at
 *  document, with stopPropagation. The layering in QA-23 works only because the
 *  phases differ, so a test of it has to model the phase. */
function CapturePhaseDismisser({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.stopPropagation()
      onClose()
    }
    document.addEventListener('keydown', onKeyDown, true)
    return () => document.removeEventListener('keydown', onKeyDown, true)
  }, [onClose])
  return null
}

const container = () => screen.getByTestId('container')
const toggle = () => screen.getByRole('button', { name: /fullscreen$/ })
const expandedNow = () => container().classList.contains(MAP_FS_PANEL_CLASS)

beforeEach(() => { document.body.style.overflow = '' })
afterEach(() => { cleanup(); document.body.style.overflow = '' })

describe('the class swap (FR-08, QA-09)', () => {
  it('composes the shared panel class onto the host base class and back off', () => {
    render(<Host />)
    expect(container().className).toBe('sr-map-container')
    fireEvent.click(toggle())
    expect(container().className).toBe(`sr-map-container ${MAP_FS_PANEL_CLASS}`)
    fireEvent.click(toggle())
    // Collapse restores EXACTLY the class list it had, which is what restores the
    // in-flow box: height, border, radius and clip all live on that base class.
    expect(container().className).toBe('sr-map-container')
  })

  it('does the same for the other two host base classes', () => {
    for (const base of ['sr-named-map', 'sr-geo-map']) {
      cleanup()
      render(<Host baseClass={base} />)
      fireEvent.click(toggle())
      expect(container().className).toBe(`${base} ${MAP_FS_PANEL_CLASS}`)
    }
  })
})

describe('the control (FR-02, QA-02)', () => {
  it('reports its state through its accessible name and aria-pressed together', () => {
    render(<Host />)
    expect(toggle()).toHaveProperty('ariaLabel', 'Enter fullscreen')
    expect(toggle().getAttribute('aria-pressed')).toBe('false')
    fireEvent.click(toggle())
    expect(screen.getByRole('button', { name: 'Exit fullscreen' }).getAttribute('aria-pressed')).toBe('true')
  })
})

describe('Escape (FR-16, FR-17; QA-22, QA-23)', () => {
  it('exits fullscreen and returns focus to the toggle', () => {
    render(<Host />)
    fireEvent.click(toggle())
    expect(expandedNow()).toBe(true)
    // Focus somewhere else inside the overlay first, so "restored" means
    // something rather than "never moved".
    screen.getByRole('button', { name: 'Base map' }).focus()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(expandedNow()).toBe(false)
    expect(document.activeElement).toBe(toggle())
  })

  it('is armed only while expanded, and fully disarmed on collapse', () => {
    // The listener exists only while expanded, so an Escape meant for something
    // else on the page never reaches it — and the arm/disarm must BALANCE, or a
    // few round trips leave a stack of live listeners behind. Asserted as a
    // balance rather than "a listener was added", which a leak also satisfies.
    const add = vi.spyOn(document, 'addEventListener')
    const remove = vi.spyOn(document, 'removeEventListener')
    const live = () =>
      add.mock.calls.filter(c => c[0] === 'keydown').length -
      remove.mock.calls.filter(c => c[0] === 'keydown').length

    render(<Host />)
    const collapsed = live()
    fireEvent.click(toggle())
    expect(live()).toBeGreaterThan(collapsed)   // Escape and the trap arm together
    fireEvent.click(toggle())
    expect(live()).toBe(collapsed)              // and both go again
    fireEvent.click(toggle())
    fireEvent.click(toggle())
    expect(live()).toBe(collapsed)              // no accumulation over round trips

    add.mockRestore()
    remove.mockRestore()
  })

  it('lets a CAPTURE-phase dismisser inside the map win the first Escape', () => {
    // QA-23. The share popup owns Escape in the capture phase with
    // stopPropagation, so one Escape closes the popup and the map stays
    // expanded; a second exits fullscreen. The hook's listener is bubble phase
    // for exactly this reason.
    const onClose = vi.fn()
    function WithPopup() {
      const [popupOpen, setPopupOpen] = useState(true)
      return (
        <>
          <Host />
          {popupOpen && <CapturePhaseDismisser onClose={() => { setPopupOpen(false); onClose() }} />}
        </>
      )
    }
    render(<WithPopup />)
    fireEvent.click(toggle())

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(expandedNow()).toBe(true)          // the map is still expanded

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)  // the popup is gone, not re-closed
    expect(expandedNow()).toBe(false)
  })

  it('ignores every other key', () => {
    render(<Host />)
    fireEvent.click(toggle())
    fireEvent.keyDown(document, { key: 'Enter' })
    fireEvent.keyDown(document, { key: 'a' })
    expect(expandedNow()).toBe(true)
  })
})

describe('focus restore across a branch swap (FR-19, QA-25)', () => {
  it('lands on the toggle rendering NOW, not the element captured at open', () => {
    // Species Detail's Pins-to-Heatmap switch replaces the button element while
    // the container, and so the hook, stays put. Capturing the trigger at open
    // time (ModalDialog's pattern) would restore focus to a detached node and
    // drop the keyboard user on <body>.
    const { rerender } = render(<Host branch="a" />)
    fireEvent.click(toggle())
    const opener = toggle()
    rerender(<Host branch="b" />)
    const replacement = toggle()
    expect(replacement).not.toBe(opener)

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(expandedNow()).toBe(false)
    expect(document.activeElement).toBe(replacement)
    expect(document.activeElement).not.toBe(document.body)
  })

  it('finds the toggle even if it never registered, so focus is never dropped to <body>', () => {
    // The belt-and-braces arm, and the only case it alone covers. Three
    // mechanisms cooperate here — registerToggle re-registering the live
    // element, the detach clearing a ref whose element has gone, and this
    // container query — and mutating any ONE of them leaves the branch-swap row
    // above green, because the other two still deliver the right element.
    // Mutating all three together (capture at open, never clear, no fallback:
    // ModalDialog's pattern verbatim) DOES turn it red, which is the defect
    // FR-19 names. This row is what the fallback alone answers: a host whose
    // toggle is not wired to registerToggle at all.
    function Unregistered() {
      const ref = useRef<HTMLDivElement>(null)
      const { className, expanded, toggle: onToggle } =
        useMapFullscreen({ containerRef: ref, baseClass: 'sr-map-container' })
      return (
        <div ref={ref} className={className} data-testid="container">
          <button
            type="button"
            className="sr-map-fullscreen-btn"
            aria-label={expanded ? 'Exit fullscreen' : 'Enter fullscreen'}
            aria-pressed={expanded}
            onClick={onToggle}
          />
        </div>
      )
    }
    render(<Unregistered />)
    fireEvent.click(toggle())
    ;(document.activeElement as HTMLElement | null)?.blur()
    expect(document.activeElement).toBe(document.body)

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(expandedNow()).toBe(false)
    expect(document.activeElement).toBe(toggle())
  })

  it('stays expanded across the swap, so the mode change is not a collapse', () => {
    // QA-18: the state lives above the branch, so switching modes while expanded
    // stays expanded and the new branch's toggle already reads "Exit fullscreen".
    const { rerender } = render(<Host branch="a" />)
    fireEvent.click(toggle())
    rerender(<Host branch="b" />)
    expect(expandedNow()).toBe(true)
    expect(screen.getByRole('button', { name: 'Exit fullscreen' })).toBeTruthy()
  })
})

describe('the focus trap (FR-18, QA-24)', () => {
  const inOverlay = () =>
    Array.from(container().querySelectorAll<HTMLElement>('button'))

  it('wraps Tab from the last focusable back to the first', () => {
    render(<Host />)
    fireEvent.click(toggle())
    const controls = inOverlay()
    controls[controls.length - 1].focus()
    fireEvent.keyDown(document, { key: 'Tab' })
    expect(document.activeElement).toBe(controls[0])
  })

  it('wraps Shift+Tab from the first focusable back to the last', () => {
    render(<Host />)
    fireEvent.click(toggle())
    const controls = inOverlay()
    controls[0].focus()
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true })
    expect(document.activeElement).toBe(controls[controls.length - 1])
  })

  it('pulls focus back in when it starts OUTSIDE the overlay', () => {
    // The difference from the Map Explorer, and the reason the map overlay opts
    // into containment while ModalDialog keeps the default: the surface behind
    // this overlay is a LIVE page in the same panel, not a display:none sibling,
    // and a click on the map canvas can leave activeElement on <body>.
    render(<Host />)
    fireEvent.click(toggle())
    const outside = screen.getByRole('button', { name: 'outside the overlay' })
    outside.focus()
    fireEvent.keyDown(document, { key: 'Tab' })
    expect(container().contains(document.activeElement)).toBe(true)
    expect(document.activeElement).not.toBe(outside)
  })

  it('re-queries the focusable set on every keydown rather than caching it', () => {
    // The set genuinely changes while the map is open: popups, markers and the
    // share pin come and go. A cached set traps against a stale last element.
    function Growing() {
      const [extra, setExtra] = useState(false)
      return (
        <>
          <Host />
          <button type="button" onClick={() => setExtra(true)}>grow</button>
          {extra && <div />}
        </>
      )
    }
    render(<Growing />)
    fireEvent.click(toggle())
    const before = inOverlay()
    before[before.length - 1].focus()
    fireEvent.keyDown(document, { key: 'Tab' })
    expect(document.activeElement).toBe(before[0])
    // Add a control INSIDE the overlay and the new last element is the wrap point.
    const added = document.createElement('button')
    added.textContent = 'late arrival'
    container().appendChild(added)
    added.focus()
    fireEvent.keyDown(document, { key: 'Tab' })
    expect(document.activeElement).toBe(before[0])
  })

  it('is not armed while collapsed', () => {
    render(<Host />)
    const controls = inOverlay()
    controls[controls.length - 1].focus()
    fireEvent.keyDown(document, { key: 'Tab' })
    // No trap: focus is left exactly where the browser would take it.
    expect(document.activeElement).toBe(controls[controls.length - 1])
  })
})

describe('containment is driven by focusin, not by the next Tab (FR-18, QA-24)', () => {
  // THE DEFECT THIS CLOSES, and why it is expressed this way rather than as a
  // tab-order test. The trap used to decide "is focus at the last focusable?" by
  // comparing activeElement against a list built from FOCUSABLE_SELECTOR — a
  // PREDICTION of the engine's tab order. WebKit's default tab mode (Safari with
  // macOS Keyboard navigation off, which is what WKWebView follows, so it is what
  // the Mac and iOS builds get) visits a smaller, different set: explicit
  // tabindex, native form controls and <summary>, but not plain <button> or
  // <a href>. Measured in the expanded Species Detail overlay, WebKit's forward
  // order left the overlay five elements before the trap's `last`, so the
  // end-wrap never fired and Tab landed on a control the opaque panel covered —
  // proven by typing into that covered <input> and reading the value back.
  //
  // jsdom has no tab order at all, so it cannot reproduce that and a test that
  // tried would only re-assert the broken assumption. What jsdom CAN observe is
  // the property that makes the engine's order irrelevant: focus that lands
  // outside is pulled back by `focusin`, before the next key is pressed.
  //
  // Mutation checked: dropping the focusin listener and containing on keydown
  // only (the shipped defect) turns all three rows below red.
  const inOverlay = () =>
    Array.from(container().querySelectorAll<HTMLElement>('button'))
  const outsideBtn = () => screen.getByRole('button', { name: 'outside the overlay' })

  it('pulls focus back the instant it lands outside, with no keydown at all', () => {
    render(<Host />)
    fireEvent.click(toggle())
    const outside = outsideBtn()
    // The engine has moved focus out of the overlay on its own. NO Tab keydown is
    // fired here, deliberately: on the real defect the next Tab was already one
    // hop too late, because the user can type into the covered control first.
    outside.focus()
    expect(document.activeElement).not.toBe(outside)
    expect(container().contains(document.activeElement)).toBe(true)
  })

  it('a forward Tab that escapes the engine order comes back at the first focusable', () => {
    render(<Host />)
    fireEvent.click(toggle())
    const controls = inOverlay()
    // A Tab from the middle of the overlay: the trap correctly does nothing, and
    // in WebKit this is the press that walked out.
    controls[1].focus()
    fireEvent.keyDown(document, { key: 'Tab' })
    outsideBtn().focus()
    expect(document.activeElement).toBe(controls[0])
  })

  it('a backward Tab that escapes comes back at the last focusable', () => {
    // Direction is the one thing the keydown arm still contributes: it decides
    // WHICH end an escape returns to, never whether to contain at all.
    render(<Host />)
    fireEvent.click(toggle())
    const controls = inOverlay()
    controls[1].focus()
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true })
    outsideBtn().focus()
    expect(document.activeElement).toBe(controls[controls.length - 1])
  })

  it('is not armed while collapsed, so the page keeps its own focus', () => {
    // Guard the guard: a listener armed unconditionally would satisfy every row
    // above while making the rest of the app unusable.
    render(<Host />)
    const outside = outsideBtn()
    outside.focus()
    expect(document.activeElement).toBe(outside)
  })

  it('ModalDialog\'s default options do NOT get the focusin arm', () => {
    // The gating decision, pinned. ModalDialog opts out of containment (it moves
    // focus inside itself as it opens and the page behind is not covered by an
    // opaque full-window panel), and its behaviour is preserved byte for byte
    // across this change. Arming focusin for every consumer would yank focus out
    // of anything a Settings dialog does not contain, and that mutation (dropping
    // the `containOutsideFocus` gate on the listener) turns this row red on its
    // own while leaving the other four green.
    function DefaultTrapHost() {
      const ref = useRef<HTMLDivElement>(null)
      useFocusTrap(true, ref)
      return (
        <>
          <button type="button">page control</button>
          <div ref={ref} data-testid="panel"><button type="button">in panel</button></div>
        </>
      )
    }
    render(<DefaultTrapHost />)
    const page = screen.getByRole('button', { name: 'page control' })
    page.focus()
    expect(document.activeElement).toBe(page)
  })
})

describe('the body scroll lock (FR-20, QA-26)', () => {
  it('locks while expanded and restores the PREVIOUS value, not an empty string', () => {
    document.body.style.overflow = 'scroll'
    render(<Host />)
    fireEvent.click(toggle())
    expect(document.body.style.overflow).toBe('hidden')
    fireEvent.click(toggle())
    expect(document.body.style.overflow).toBe('scroll')
  })

  it('releases on unmount', () => {
    const { unmount } = render(<Host />)
    fireEvent.click(toggle())
    expect(document.body.style.overflow).toBe('hidden')
    unmount()
    expect(document.body.style.overflow).toBe('')
  })
})

describe('the four teardown paths (FR-24, QA-30)', () => {
  // One roster, one row per exit, each asserting BOTH halves: the map collapsed
  // AND the lock released. Three of the four exist because the real surfaces do
  // not all unmount.
  it('an explicit toggle collapses and releases', () => {
    render(<Host />)
    fireEvent.click(toggle())
    fireEvent.click(toggle())
    expect(expandedNow()).toBe(false)
    expect(document.body.style.overflow).toBe('')
  })

  it('`active` going false collapses and releases (a Named Birds row closing)', () => {
    // The ROW stays mounted; only its `{open && ...}` subtree unmounts, so a hook
    // at the row's top level sees no unmount and its cleanup never runs.
    const { rerender } = render(<Host active />)
    fireEvent.click(toggle())
    expect(document.body.style.overflow).toBe('hidden')
    rerender(<Host active={false} />)
    expect(container().className).toBe('sr-map-container')
    expect(document.body.style.overflow).toBe('')
    // ...and no toggle is rendered for a map that is not there (FR-05).
    expect(screen.queryByRole('button', { name: /fullscreen$/ })).toBeNull()
  })

  it('a changed `resetKey` collapses and releases (a Species Detail species change)', () => {
    // This map keeps its JSX position across a species change, so nothing
    // unmounts and an expanded state would otherwise survive onto another bird.
    const { rerender } = render(<Host resetKey="Varied Thrush" />)
    fireEvent.click(toggle())
    expect(expandedNow()).toBe(true)
    rerender(<Host resetKey="Snowy Egret" />)
    expect(expandedNow()).toBe(false)
    expect(document.body.style.overflow).toBe('')
  })

  it('an unchanged `resetKey` does NOT collapse (guarding the guard)', () => {
    // Without this, a hook that collapsed on every render would pass the row
    // above and be useless in the app.
    const { rerender } = render(<Host resetKey="Varied Thrush" />)
    fireEvent.click(toggle())
    rerender(<Host resetKey="Varied Thrush" />)
    expect(expandedNow()).toBe(true)
  })

  it('a host unmount releases (a tab teardown)', () => {
    const { unmount } = render(<Host />)
    fireEvent.click(toggle())
    unmount()
    expect(document.body.style.overflow).toBe('')
    // And the document Escape listener is gone with it: a stray Escape after
    // teardown must not reach a setState on an unmounted component.
    expect(() => fireEvent.keyDown(document, { key: 'Escape' })).not.toThrow()
  })

  it('`collapse()` is callable from the host, for a deterministic in-map exit', () => {
    // The Statistics county popup's open-species link leaves the tab; the tab
    // does unmount, but calling collapse() makes the release deterministic and
    // observable rather than racing a lazy teardown.
    // The host calls collapse() from an in-map action; modelled as a second
    // button so nothing is reassigned out of the component's render.
    function Capturing() {
      const ref = useRef<HTMLDivElement>(null)
      const { className, expanded, toggle: onToggle, collapse, registerToggle } =
        useMapFullscreen({ containerRef: ref, baseClass: 'sr-geo-map' })
      return (
        <div ref={ref} className={className} data-testid="container">
          <button
            type="button"
            onClick={onToggle}
            aria-pressed={expanded}
            aria-label={expanded ? 'Exit fullscreen' : 'Enter fullscreen'}
            ref={registerToggle}
            className="sr-map-fullscreen-btn"
          />
          <button type="button" onClick={collapse}>open species from the county popup</button>
        </div>
      )
    }
    render(<Capturing />)
    fireEvent.click(toggle())
    expect(document.body.style.overflow).toBe('hidden')
    fireEvent.click(screen.getByRole('button', { name: 'open species from the county popup' }))
    expect(expandedNow()).toBe(false)
    expect(document.body.style.overflow).toBe('')
  })
})
