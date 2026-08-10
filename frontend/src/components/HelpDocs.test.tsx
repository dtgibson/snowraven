// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { HelpDocs } from './HelpDocs'

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

  it('appends a visually-hidden new-tab hint to documentation links (F078)', () => {
    const { container } = render(<HelpDocs onClose={vi.fn()} />)
    const externalLink = container.querySelector('a[target="_blank"]')
    expect(externalLink).toBeTruthy()
    expect(externalLink!.querySelector('.sr-only')?.textContent).toContain('opens in a new tab')
  })

  it('closes on Escape', () => {
    const onClose = vi.fn()
    render(<HelpDocs onClose={onClose} />)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalled()
  })
})
