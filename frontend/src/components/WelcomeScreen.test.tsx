// @vitest-environment jsdom
//
// improve: focusable-selector-single-source — this screen's hand-rolled trap and
// its private copy of the focusable selector are gone; it uses `useFocusTrap`
// over the one exported selector, at the hook's DEFAULT (no `focusin`
// containment). The last block below is what pins that default, because it is
// the one call site whose default looks like an oversight and is not.
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { WelcomeScreen } from './WelcomeScreen'
import { focusablesIn } from '../lib/useFocusTrap'

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

describe('the welcome trap does NOT contain on focusin, and that is the decision', () => {
  // WHY THIS BLOCK EXISTS. Every other overlay consolidated in this build could
  // opt into `containOutsideFocus`; this one measurably cannot, and a default
  // that looks like an omission gets "fixed" by the next reader. So the reason
  // is asserted, not just commented.
  //
  // THE MEASUREMENT. App.tsx mounts <HelpDocs> as a LATER SIBLING of this screen
  // while this screen stays mounted — the welcome is gated on
  // `coldStart && !welcomeDismissed`, and the "documentation" button this screen
  // renders does not change either. `useFocusTrap`'s `focusin` arm is a document
  // listener that asks only "is the new focus inside MY root", so an armed
  // welcome trap answers HelpDocs' own opening `.focus()` by yanking focus back
  // onto the welcome screen. The Help overlay would be unusable on the only run
  // this screen ever has.
  //
  // WHAT IS ASSERTED, and why it is not a tab order: that focus which moves to a
  // control OUTSIDE this dialog STAYS there, with no keydown involved. jsdom has
  // no tab order (.claude/rules/ui.md) and none is needed — `focusin` fires on a
  // programmatic `.focus()`, which is exactly the event the arm would act on.
  //
  // MUTATION CHECK, both directions, run rather than cited, with the counts
  // recorded so a later run that disagrees is visible:
  //   * GATE ON — `useFocusTrap(true, rootRef, { containOutsideFocus: true })`:
  //     exactly the 2 rows below go red, 4 green.
  //   * TRAP REMOVED — the `useFocusTrap` call deleted: exactly 1 row goes red
  //     (the end-wrap above), 5 green, and these 2 pass on the missing trap.
  // So neither block subsumes the other, and neither is vacuous: the wrap rows
  // need the trap present, these need it un-armed.
  const laterSibling = () => {
    const div = document.createElement('div')
    div.innerHTML = '<button id="later-overlay-close">Close</button>'
    document.body.appendChild(div)
    return div.firstElementChild as HTMLElement
  }

  it('focus moved to a later sibling overlay stays there', () => {
    render(<WelcomeScreen onGetStarted={vi.fn()} onOpenHelp={vi.fn()} onDismiss={vi.fn()} />)
    const above = laterSibling()
    above.focus()
    expect(document.activeElement).toBe(above)
  })

  it('and stays there after a Tab, which is the end-wrap arm doing nothing to it', () => {
    // The keydown arm is still armed and still correct: focus is neither the
    // first nor the last of the welcome's own list, so it leaves the press alone.
    render(<WelcomeScreen onGetStarted={vi.fn()} onOpenHelp={vi.fn()} onDismiss={vi.fn()} />)
    const above = laterSibling()
    above.focus()
    fireEvent.keyDown(document, { key: 'Tab' })
    expect(document.activeElement).toBe(above)
  })
})
