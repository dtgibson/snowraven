// @vitest-environment jsdom
//
// improve: focusable-selector-single-source — this screen's hand-rolled trap and
// its private copy of the focusable selector are gone; it uses `useFocusTrap`
// over the one exported selector. Its contained mode now yields to a higher
// active trap, so the welcome can hold the live app behind it without stealing
// focus from HelpDocs or CommandPalette above it.
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { useRef } from 'react'
import { WelcomeScreen } from './WelcomeScreen'
import { focusablesIn, useFocusTrap } from '../lib/useFocusTrap'

afterEach(cleanup)

describe('WelcomeScreen focus containment (F065)', () => {
  it('wraps Tab from the last focusable back to the first inside the dialog', () => {
    render(<WelcomeScreen onGetStarted={vi.fn()} onOpenHelp={vi.fn()} onDismiss={vi.fn()} />)
    const dialog = screen.getByRole('dialog')
    // The trap's OWN list, from the shared module, so this measures what the
    // component actually traps rather than a copy that can drift from it.
    const focusables = focusablesIn(dialog)
    expect(focusables.length).toBeGreaterThanOrEqual(2)
    const first = focusables[0]
    const last = focusables[focusables.length - 1]

    last.focus()
    fireEvent.keyDown(document, { key: 'Tab' })
    expect(document.activeElement).toBe(first)

    first.focus()
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true })
    expect(document.activeElement).toBe(last)
  })

  it('still dismisses on Escape', () => {
    const onDismiss = vi.fn()
    render(<WelcomeScreen onGetStarted={vi.fn()} onOpenHelp={vi.fn()} onDismiss={onDismiss} />)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onDismiss).toHaveBeenCalled()
  })
})

describe('WelcomeScreen renders no control the shared selector widens onto', () => {
  // The consolidation swapped this screen's narrower private selector
  // ('button, a[href], [tabindex]...') for the canonical one, which ALSO matches
  // `input, select, textarea`. That widening is a no-op here only while this
  // screen renders none of them, and this is what says so. It is not decoration:
  // adding a form control to the welcome screen changes what the trap holds, and
  // WebKit visits form controls whatever their tabIndex — so this failing is a
  // signal to re-derive the trap, not to relax the assertion.
  it('holds no input, select, textarea, details or summary', () => {
    // Equality of the two lists FOLLOWS from this, so it is asserted this way
    // rather than by keeping the retired narrow selector around as a control:
    // the canonical selector is the narrow one plus `input, select, textarea`,
    // so on a subtree containing none of those the two match the same elements
    // in the same order, by construction rather than by comparison. Writing the
    // old string here would also have left the last copy of a focusable selector
    // outside lib/useFocusTrap.ts, which is the rule this build exists to satisfy.
    render(<WelcomeScreen onGetStarted={vi.fn()} onOpenHelp={vi.fn()} onDismiss={vi.fn()} />)
    const dialog = screen.getByRole('dialog')
    expect(dialog.querySelectorAll('input, select, textarea, details, summary')).toHaveLength(0)
    // Non-vacuity: the trap does hold something, so "no widening" is not "nothing".
    expect(focusablesIn(dialog).length).toBeGreaterThanOrEqual(2)
  })
})

function HigherModal() {
  const ref = useRef<HTMLDivElement>(null)
  useFocusTrap(true, ref)
  return (
    <div ref={ref} role="dialog" aria-modal="true" aria-label="Higher modal">
      <button>Higher control</button>
    </div>
  )
}

function Stack({ higher }: { higher: boolean }) {
  return (
    <>
      <WelcomeScreen onGetStarted={vi.fn()} onOpenHelp={vi.fn()} onDismiss={vi.fn()} />
      {higher && <HigherModal />}
      <button>Uncovered app control</button>
    </>
  )
}

describe('the welcome trap contains the app and yields to a higher modal', () => {
  it('pulls focus back from an uncovered app control', () => {
    render(<Stack higher={false} />)
    const welcome = screen.getByRole('dialog', { name: 'Welcome to SnowRaven' })
    screen.getByRole('button', { name: 'Uncovered app control' }).focus()
    expect(document.activeElement).toBe(focusablesIn(welcome)[0])
  })

  it('lets a modal opened above it keep focus', () => {
    const view = render(<Stack higher={false} />)
    view.rerender(<Stack higher />)
    const above = screen.getByRole('button', { name: 'Higher control' })
    above.focus()
    expect(document.activeElement).toBe(above)
  })

  it('resumes containment after the higher modal closes', () => {
    const view = render(<Stack higher />)
    screen.getByRole('button', { name: 'Higher control' }).focus()
    view.rerender(<Stack higher={false} />)
    const welcome = screen.getByRole('dialog', { name: 'Welcome to SnowRaven' })
    screen.getByRole('button', { name: 'Uncovered app control' }).focus()
    expect(document.activeElement).toBe(focusablesIn(welcome)[0])
  })
})
