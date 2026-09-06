// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { HelpDocs } from './HelpDocs'
import { focusablesIn } from '../lib/useFocusTrap'

afterEach(cleanup)

describe('HelpDocs accessibility (F006/F039/F040/F060/F078)', () => {
  it('labels the TOC navigation landmark (F060)', () => {
    render(<HelpDocs onClose={vi.fn()} />)
    expect(screen.getByRole('navigation', { name: 'Documentation contents' })).toBeTruthy()
  })

  it('marks the body row and TOC nav with the reflow classes (F006)', () => {
    const { container } = render(<HelpDocs onClose={vi.fn()} />)
    expect(container.querySelector('.sr-help-row')).toBeTruthy()
    expect(container.querySelector('.sr-help-toc')).toBeTruthy()
  })

  it('marks the content column, with nothing inline to out-specify it (help-docs-phone-width)', () => {
    // The DOM half of the phone-width fix; helpContentWidthCss.test.ts is the
    // stylesheet half and the browser measurements in pr-description.md are the
    // proof. Identified STRUCTURALLY — the row's second child, after the TOC nav —
    // so this fails if the class is dropped or moved to a wrapper rather than
    // passing on whatever happens to carry the class.
    const { container } = render(<HelpDocs onClose={vi.fn()} />)
    const col = container.querySelector('.sr-help-row')!.children[1] as HTMLElement
    expect(col.tagName).toBe('DIV')
    expect(col.classList.contains('sr-help-content')).toBe(true)
    // The rule can only bind if no inline declaration outranks it: the column keeps
    // an inline style block (flex/minWidth/padding/maxWidth) at specificity 1,0,0, so
    // an inline width or alignSelf added here later would silently render the ≤640
    // rule inert while every stylesheet assertion stayed green — how .sr-wrap-flex
    // shipped inert in v0.5.82. minWidth is expected and is NOT the fix: it relaxes
    // the main axis, and the overflow is on the cross axis.
    expect(col.style.width).toBe('')
    expect(col.style.alignSelf).toBe('')
    expect(col.style.overflowWrap).toBe('')
    expect(col.style.wordBreak).toBe('')
  })

  it('positions the overlay through .sr-help-panel, not an inline style (helpdocs-safe-area)', () => {
    // The DOM half of the lift: iosChrome.test.ts proves the rule exists and is
    // .sr-ios-app-gated, this proves the element actually carries the class and
    // has no inline positioning left to out-specify it. The iOS safe-area inset
    // that keeps the header clear of the Dynamic Island hangs off both halves.
    render(<HelpDocs onClose={vi.fn()} />)
    const overlay = document.getElementById('sr-help-overlay')!
    expect(overlay.classList.contains('sr-help-panel')).toBe(true)
    expect(overlay.style.position).toBe('')
    expect(overlay.style.inset).toBe('')
    expect(overlay.style.zIndex).toBe('')
  })

  it('restores focus to the opener when the overlay unmounts (F039/F040)', () => {
    const opener = document.createElement('button')
    opener.textContent = 'Open help'
    document.body.appendChild(opener)
    opener.focus()
    expect(document.activeElement).toBe(opener)

    const { unmount } = render(<HelpDocs onClose={vi.fn()} />)
    // On mount, HelpDocs focuses its Close button.
    expect(document.activeElement).not.toBe(opener)

    unmount()
    expect(document.activeElement).toBe(opener)
    opener.remove()
  })

  it('announces the new-tab cue on documentation links (F078)', () => {
    // Re-pointed from the .sr-only MECHANISM to the announced NAME
    // (help-link-scheme-gate). The old assertion read the cue out of an
    // .sr-only child node, which is only one of the two ways OutboundLink can
    // carry it: with plain-string children (every link in HELP.md) it builds a
    // clean `aria-label` instead, and the .sr-only node is correctly absent.
    // That made the old test go red on a change that left the announced name
    // byte-identical — it was pinning an implementation detail. F078's actual
    // guarantee is that the link announces that it opens in a new tab, and
    // that the visible text leads the name (WCAG 2.5.3 Label in Name), so
    // that is what this asserts. Sampled on the one HELP.md link whose text
    // is unique in the document.
    render(<HelpDocs onClose={vi.fn()} />)
    const link = screen.getByRole('link', { name: 'ebird.org/api/keygen (opens in a new tab)' })
    expect(link.getAttribute('target')).toBe('_blank')
    expect(link.getAttribute('rel')).toContain('noreferrer')
    expect(link.getAttribute('href')).toBe('https://ebird.org/api/keygen')
    // The visible copy is unchanged — the cue is screen-reader-only either way.
    expect(link.textContent).toBe('ebird.org/api/keygen')
  })

  it('announces the cue on EVERY documentation link, not just the sampled one (F078)', () => {
    render(<HelpDocs onClose={vi.fn()} />)
    const all = screen.getAllByRole('link')
    // Anchored at the END on purpose: it pins the exact cue wording AND proves
    // the visible text leads the accessible name (WCAG 2.5.3 Label in Name),
    // which is the half of F078 that a bare "contains the cue" check misses.
    const cued = screen.getAllByRole('link', { name: /\(opens in a new tab\)$/ })
    // HELP.md ships 7 links today; asserting a floor rather than an exact count
    // keeps this from failing when a link is added to the docs.
    expect(all.length).toBeGreaterThanOrEqual(7)
    expect(cued.length).toBe(all.length)
  })

  it('emits an anchor only for an absolute http(s) target (help-link-scheme-gate)', () => {
    // Asserted against the REAL docs/HELP.md, which is developer-controlled and
    // holds no hostile target — so this test alone cannot reject the defect,
    // and removing the gate does not turn it red (confirmed by mutation, not
    // assumed). What it is worth: it proves the gate did not silently strip the
    // real links, since a passing negative suite plus a blank Help page is
    // exactly the wrong outcome.
    //
    // The defect itself is rejected in two other places, both mutation-checked
    // in both directions: lib/helpLinks.test.ts for the predicate, and
    // HelpDocsHostileContent.test.tsx, which mocks the ?raw import to drive
    // THIS renderer with hostile content and is what catches the gate being
    // deleted from HelpDocs.tsx.
    render(<HelpDocs onClose={vi.fn()} />)
    for (const link of screen.getAllByRole('link')) {
      expect(link.getAttribute('href')).toMatch(/^https?:\/\//i)
    }
  })

  it('closes on Escape', () => {
    const onClose = vi.fn()
    render(<HelpDocs onClose={onClose} />)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalled()
  })
})

describe('HelpDocs traps Tab through the shared hook, at its DEFAULT (improve: focusable-selector-single-source)', () => {
  // This overlay's hand-rolled trap and its private copy of the focusable
  // selector are gone; it uses `useFocusTrap` over the one exported selector.
  // `containOutsideFocus` STAYS OFF — the consolidation is behaviour-preserving
  // by design, and the row below is what stops that default being read as an
  // omission and "fixed".
  //
  // WHAT THE MUTATION MEASURED, AND WHAT IT DID NOT. Arming the option turns
  // exactly 1 row red, the containment row below, and the existing "restores focus to
  // the opener when the overlay unmounts (F039/F040)" row STAYS GREEN. That is
  // not a gap in this file: the restore genuinely survives, because it runs in an
  // effect cleanup, by which point React has detached `overlayRef` and the
  // containment arm returns at its `if (!root) return` guard. The same result
  // was measured on App.tsx's real shape — a parent conditionally rendering the
  // overlay, closed through its own Close button — so the F061 story written for
  // this call site does not reproduce. HelpDocs.tsx's header carries the
  // correction and the distinction that replaces it.
  //
  // MUTATION CHECK, run rather than cited, counts recorded over this file:
  //   * ARMING IT — `useFocusTrap(true, overlayRef, { containOutsideFocus: true })`:
  //     1 red, the containment row below. 11 green.
  //   * TRAP REMOVED: 1 red, the end-wrap row below. 11 green.
  // Two different rows, which is what says the trap and its option are separately
  // measured here.

  it('wraps Tab at the ends of the overlay', () => {
    render(<HelpDocs onClose={vi.fn()} />)
    const overlay = document.getElementById('sr-help-overlay') as HTMLElement
    const focusables = focusablesIn(overlay)
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

  it('does NOT contain on focusin: focus moved out of the overlay stays out', () => {
    // Deliberately NOT named for the opener-restore. The restore survives either
    // way (see the block comment), so tying this row to it would credit the
    // default with a protection it is not providing. What it pins is the plain
    // fact the default IS: while this overlay is open, focus that moves outside
    // it is left where it went, with no keydown involved — which is exactly the
    // event an armed containment arm would act on.
    const opener = document.createElement('button')
    document.body.appendChild(opener)
    render(<HelpDocs onClose={vi.fn()} />)
    opener.focus()
    expect(document.activeElement).toBe(opener)
    opener.remove()
  })

  it('renders no control the widened shared selector picks up that the old copy missed', () => {
    // The consolidation swapped this overlay's narrower private selector for the
    // canonical one, which also matches `input, select, textarea`. That widening
    // is a no-op only while the overlay renders none, and equality of the two
    // lists FOLLOWS from that rather than needing the retired string kept here
    // as a control — which would also have left a focusable selector outside
    // lib/useFocusTrap.ts, the rule this build exists to satisfy.
    //
    // This is a standing check on the HELP.md parse as well: the overlay's body
    // is generated from that file, so a parser change that started emitting a
    // form control would land here (HelpDocsHostileContent.test.tsx owns the
    // injection half of the same parse).
    render(<HelpDocs onClose={vi.fn()} />)
    const overlay = document.getElementById('sr-help-overlay') as HTMLElement
    expect(overlay.querySelectorAll('input, select, textarea, details, summary')).toHaveLength(0)
    expect(focusablesIn(overlay).length).toBeGreaterThanOrEqual(2)
  })
})
