// @vitest-environment jsdom
//
// The chord and Escape (FR-01 to FR-04, FR-11, FR-47, FR-49, FR-50, QA-01,
// QA-02, QA-03, QA-04, QA-45, QA-48).
//
// THE HALF THAT MATTERS MOST IS THE LAST DESCRIBE BLOCK, and it is written as a
// PROBE IN BOTH DIRECTIONS rather than as one assertion. FR-50 claims that while
// the palette is CLOSED every other Escape layer in the app behaves exactly as
// it did on the previous release, and that claim is only worth something if the
// test can also show the palette consuming Escape when it IS open. A
// `document`-level probe listener does both: consumed while open, delivered
// while closed. That is the shape `SpeciesCombobox.test.tsx` already uses for
// the same class of claim.
//
// WHAT THIS FILE CANNOT PROVE: that the palette's listener beats SharePopup's on
// a real engine. jsdom implements the propagation path faithfully enough for the
// window-capture ordering to hold here, but the browser legs of QA-47 are the
// evidence for the shipped behaviour.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, cleanup, act } from '@testing-library/react'
import { useState } from 'react'
import { usePaletteHotkey } from './usePaletteHotkey'

interface Calls { open: string[]; close: number }

/**
 * What the hook called, recorded at MODULE scope rather than handed in as a
 * prop. The harness writes to it, and writing to a prop or a hook argument from
 * inside a component is a `react-hooks/immutability` error (build-blocking) --
 * correctly, since the compiler may treat such a value as frozen. A module
 * binding is neither, and `beforeEach` replaces it per test.
 */
let calls: Calls

/**
 * Mounts the hook with the same shape App uses: `open` is real state, so the
 * listener's view of it moves with the render rather than being pinned at mount.
 */
function Harness({ startOpen = false }: { startOpen?: boolean }) {
  const [open, setOpen] = useState(startOpen)
  usePaletteHotkey({
    open,
    onOpen: el => { calls.open.push(el?.id ?? '(none)'); setOpen(true) },
    onClose: () => { calls.close += 1; setOpen(false) },
  })
  return (
    <div>
      <input id="checklist-input" />
      <button id="opener" type="button">Search</button>
      <span data-testid="state">{open ? 'open' : 'closed'}</span>
    </div>
  )
}

/** Dispatch a keydown, optionally from a specific element rather than `document`. */
function press(init: KeyboardEventInit & { key: string }, target?: EventTarget): KeyboardEvent {
  const e = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init })
  act(() => { (target ?? document).dispatchEvent(e) })
  return e
}

beforeEach(() => { calls = { open: [], close: 0 } })
afterEach(cleanup)

describe('the chord (FR-01 to FR-03, QA-01, QA-02, QA-45)', () => {
  it('opens on Cmd-K AND on Ctrl-K, on every platform (QA-45)', () => {
    const { getByTestId, unmount } = render(<Harness />)
    press({ key: 'k', metaKey: true })
    expect(getByTestId('state').textContent).toBe('open')
    unmount()

    calls = { open: [], close: 0 }
    const second = render(<Harness />)
    press({ key: 'k', ctrlKey: true })
    expect(second.getByTestId('state').textContent).toBe('open')
  })

  it('accepts an upper-case K, so Shift does not break the chord', () => {
    const { getByTestId } = render(<Harness />)
    press({ key: 'K', metaKey: true, shiftKey: true })
    expect(getByTestId('state').textContent).toBe('open')
  })

  it('preventDefaults, so the web and Pi builds never hand the chord to the host browser (QA-02)', () => {
    render(<Harness />)
    const e = press({ key: 'k', metaKey: true })
    expect(e.defaultPrevented).toBe(true)
  })

  it('works from inside a text field, with the field keeping its text (QA-03)', () => {
    // A MODIFIER chord, unlike a bare key, does not compete with the app's text
    // fields -- which is exactly why `/` was ruled out.
    const { container, getByTestId } = render(<Harness />)
    const input = container.querySelector('#checklist-input') as HTMLInputElement
    input.value = 'S12345678'
    input.focus()
    press({ key: 'k', metaKey: true }, input)
    expect(getByTestId('state').textContent).toBe('open')
    expect(input.value).toBe('S12345678')
  })

  it('captures the opener EAGERLY, as document.activeElement at the moment of the press', () => {
    // A getter that re-read document.activeElement later would hand back the
    // palette's own query input, and focus would be returned to the overlay that
    // just closed.
    const { container } = render(<Harness />)
    ;(container.querySelector('#opener') as HTMLElement).focus()
    press({ key: 'k', metaKey: true })
    expect(calls.open).toEqual(['opener'])
  })

  it('a SECOND press closes, through the same close path as Escape (FR-04, QA-04)', () => {
    const { getByTestId } = render(<Harness startOpen />)
    press({ key: 'k', metaKey: true })
    expect(calls.close).toBe(1)
    expect(calls.open).toEqual([])
    expect(getByTestId('state').textContent).toBe('closed')
  })

  it('ignores a HELD chord, so it does not toggle repeatedly', () => {
    render(<Harness />)
    press({ key: 'k', metaKey: true, repeat: true })
    expect(calls.open).toEqual([])
  })

  it('leaves Option/Alt+Cmd+K to the platform', () => {
    render(<Harness />)
    const e = press({ key: 'k', metaKey: true, altKey: true })
    expect(calls.open).toEqual([])
    expect(e.defaultPrevented).toBe(false)
  })

  it('ignores a bare k, and every other key', () => {
    render(<Harness />)
    press({ key: 'k' })
    press({ key: 'j', metaKey: true })
    press({ key: 'Enter' })
    expect(calls.open).toEqual([])
    expect(calls.close).toBe(0)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// FR-49 / FR-50 — Escape, in BOTH directions
// ─────────────────────────────────────────────────────────────────────────────

describe('Escape is consumed while open and delivered while closed', () => {
  /** Stands in for every other Escape layer in the app: SharePopup's capture-phase
   *  dismiss, the Map Explorer's two bubble handlers, the More sheet, ModalDialog,
   *  HelpDocs, the Calendar day popup, WelcomeScreen and the rail tooltip. */
  function withProbe(phase: 'capture' | 'bubble') {
    const seen: string[] = []
    const probe = (e: Event) => seen.push((e as KeyboardEvent).key)
    document.addEventListener('keydown', probe, phase === 'capture')
    return { seen, off: () => document.removeEventListener('keydown', probe, phase === 'capture') }
  }

  it.each(['capture', 'bubble'] as const)(
    'a %s-phase document listener does NOT see Escape while the palette is open (FR-49)',
    phase => {
      const { seen, off } = withProbe(phase)
      render(<Harness startOpen />)
      press({ key: 'Escape' })
      off()
      expect(calls.close).toBe(1)
      // Nothing beneath the palette saw the press, so one Escape closes the
      // palette and nothing else -- not a fullscreen map, not a Map Explorer
      // sidebar, not a SharePopup.
      expect(seen).toEqual([])
    },
  )

  it.each(['capture', 'bubble'] as const)(
    'a %s-phase document listener DOES see Escape while the palette is closed (FR-50)',
    phase => {
      const { seen, off } = withProbe(phase)
      render(<Harness />)
      press({ key: 'Escape' })
      off()
      // The Escape arm returns before touching the event, so every shipped
      // Escape layer behaves exactly as it did on the previous release. This is
      // the direction that makes the block above evidence rather than a
      // tautology.
      expect(calls.close).toBe(0)
      expect(seen).toEqual(['Escape'])
    },
  )

  it('preventDefaults the Escape it consumes, and leaves the one it does not', () => {
    const open = render(<Harness startOpen />)
    expect(press({ key: 'Escape' }).defaultPrevented).toBe(true)
    open.unmount()

    render(<Harness />)
    expect(press({ key: 'Escape' }).defaultPrevented).toBe(false)
  })

  it('the CHORD is likewise invisible to everything beneath, so opening disturbs nothing (FR-51)', () => {
    const { seen, off } = withProbe('capture')
    render(<Harness />)
    press({ key: 'k', metaKey: true })
    off()
    expect(seen).toEqual([])
  })

  it('unbinds on unmount, so a closed session leaves no listener behind', () => {
    const { unmount } = render(<Harness />)
    unmount()
    const { seen, off } = withProbe('capture')
    press({ key: 'Escape' })
    press({ key: 'k', metaKey: true })
    off()
    expect(seen).toEqual(['Escape', 'k'])
    expect(calls.open).toEqual([])
    expect(calls.close).toBe(0)
  })
})

describe('the listener is bound ONCE and never re-registered', () => {
  it('so no press can land in a re-bind window', () => {
    // `open` and both callbacks are read through refs precisely so the effect
    // has empty deps. A listener that re-registered on every render would have a
    // window, however small, in which a press reaches nothing.
    const add = vi.spyOn(window, 'addEventListener')
    const { rerender } = render(<Harness />)
    const initial = add.mock.calls.filter(c => c[0] === 'keydown').length
    for (let i = 0; i < 5; i += 1) rerender(<Harness />)
    press({ key: 'k', metaKey: true })
    expect(add.mock.calls.filter(c => c[0] === 'keydown').length).toBe(initial)
    expect(calls.open).toHaveLength(1)
    add.mockRestore()
  })

  it('and it is bound at WINDOW in the capture phase, which is what makes the ordering deterministic', () => {
    // The property, asserted at the seam rather than inferred from behaviour: a
    // capture listener at `window` runs before every `document` listener of
    // either phase by the PROPAGATION PATH, not by registration order, which is
    // exactly what FR-49 needs and what a document-capture listener could not
    // promise against SharePopup's.
    const add = vi.spyOn(window, 'addEventListener')
    render(<Harness />)
    const keydown = add.mock.calls.filter(c => c[0] === 'keydown')
    expect(keydown).toHaveLength(1)
    expect(keydown[0][2]).toBe(true)
    add.mockRestore()
  })
})
