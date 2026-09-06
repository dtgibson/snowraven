// @vitest-environment jsdom
//
// improve: focusable-selector-single-source — a direct guard on `useFocusTrap`'s
// `filter` option, the API this build added so four hand-rolled traps could
// consolidate onto one hook without any of them losing what its own DOM needs.
//
// WHY THIS FILE EXISTS SEPARATELY FROM MapExplorerSidebarTrap.test.tsx, which
// already exercises the option end-to-end through the real sidebar: that file
// measures the option's ONE shipped consumer, so it goes green the day that
// consumer stops passing a filter, and it cannot say anything about the option's
// contract in configurations the sidebar does not happen to reach (an empty
// filtered list, a filter that removes an end, a filter that removes nothing).
// This file owns the contract; that file owns the wiring. Neither substitutes.
//
// The containment arm's own behaviour is NOT re-derived here — lib/useMapFullscreen.test.tsx
// has owned that since v1.0.15 and there is no second copy of it.

import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup, fireEvent } from '@testing-library/react'
import { useRef } from 'react'
import { useFocusTrap, type FocusTrapOptions } from './useFocusTrap'

afterEach(cleanup)

// Module scope, per the option's own stated requirement: an inline arrow would
// be a fresh identity every render and would re-arm the listeners each time.
const NOT_SKIPPED = (el: HTMLElement) => !el.hasAttribute('data-skip')

function Host({ options }: { options?: FocusTrapOptions }) {
  const ref = useRef<HTMLDivElement>(null)
  useFocusTrap(true, ref, options)
  return (
    <>
      <div ref={ref}>
        <button data-skip id="a">a (filtered out)</button>
        <button id="b">b</button>
        <button id="c">c</button>
        <button data-skip id="d">d (filtered out)</button>
      </div>
      <button id="outside">outside</button>
    </>
  )
}

const $ = (id: string) => document.getElementById(id) as HTMLElement

describe('the filter narrows BOTH arms of the trap, at both ends', () => {
  // The ends are what matters: the hook reads only the first and last entries of
  // its list, so a filter that removes only middle entries is behaviourally
  // invisible. This fixture removes an entry at EACH end for that reason — it is
  // the shape the MapExplorer guard had to be rebuilt around after the first
  // version of it passed with the filter deleted.

  it('the forward end-wrap uses the last KEPT element, not the last matching one', () => {
    render(<Host options={{ filter: NOT_SKIPPED }} />)
    $('c').focus()
    fireEvent.keyDown(document, { key: 'Tab' })
    expect(document.activeElement).toBe($('b'))
  })

  it('the backward end-wrap uses the first KEPT element', () => {
    render(<Host options={{ filter: NOT_SKIPPED }} />)
    $('b').focus()
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true })
    expect(document.activeElement).toBe($('c'))
  })

  it('containment never lands on a filtered-out element', () => {
    render(<Host options={{ filter: NOT_SKIPPED, containOutsideFocus: true }} />)
    $('outside').focus()
    expect(document.activeElement).toBe($('b'))
    expect((document.activeElement as HTMLElement).hasAttribute('data-skip')).toBe(false)
  })

  it('a backward containment lands on the last KEPT element', () => {
    render(<Host options={{ filter: NOT_SKIPPED, containOutsideFocus: true }} />)
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true })
    $('outside').focus()
    expect(document.activeElement).toBe($('c'))
  })

  it('without the option the trap sees every match, which is the control', () => {
    // Non-vacuity for all four rows above: the same fixture, same presses, and
    // the filtered-out elements ARE the ends. If this row ever agreed with them,
    // the fixture would have stopped discriminating.
    render(<Host options={{ containOutsideFocus: true }} />)
    $('d').focus()
    fireEvent.keyDown(document, { key: 'Tab' })
    expect(document.activeElement).toBe($('a'))
    $('outside').focus()
    expect(document.activeElement).toBe($('a'))
  })
})

describe('the filter cannot break the trap when it empties the list', () => {
  const NOTHING = () => false

  it('a Tab is swallowed rather than walking out of the root', () => {
    // The `focusables.length < 2` branch: preventDefault with nowhere to put
    // focus. This is a deliberate difference from the MapExplorer copy this
    // build replaced, which returned early and let the press through — for an
    // opaque overlay over a live page, swallowing is the safer of the two, and
    // it is what ModalDialog and the map overlay have always done.
    render(<Host options={{ filter: NOTHING, containOutsideFocus: true }} />)
    $('outside').focus()
    // Nothing to contain to, so focus is left alone rather than thrown at
    // `undefined` — the option-chained call in the containment arm.
    expect(document.activeElement).toBe($('outside'))

    $('b').focus()
    const ev = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true })
    document.dispatchEvent(ev)
    expect(ev.defaultPrevented).toBe(true)
    expect(document.activeElement).toBe($('b'))
  })
})
