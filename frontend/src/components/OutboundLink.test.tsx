// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { useState } from 'react'
import { flushSync } from 'react-dom'
import { OutboundLink } from './OutboundLink'
import { HotspotLink } from './HotspotLink'
import { Link } from './ui/Link'
import { installTauriOpener, type TauriOpener } from '../test/tauriOpener'

afterEach(cleanup)

describe('OutboundLink', () => {
  it('opens in a new tab with safe rel and a clean spaced name for string children', () => {
    render(<OutboundLink href="https://example.org">View site</OutboundLink>)
    const link = screen.getByRole('link', { name: 'View site (opens in a new tab)' })
    expect(link.getAttribute('href')).toBe('https://example.org')
    expect(link.getAttribute('target')).toBe('_blank')
    expect(link.getAttribute('rel')).toBe('noreferrer')
    // Visible copy is unchanged; the cue lives in the accessible name only.
    expect(link.textContent).toBe('View site')
    expect(link.querySelector('.sr-only')).toBeNull()
  })

  it('appends an sr-only cue for rich (JSX) children', () => {
    render(<OutboundLink href="https://example.org"><span>Region</span></OutboundLink>)
    // Cue reaches the accessible name via the sr-only node.
    const link = screen.getByRole('link', { name: /region.*opens in a new tab/i })
    expect(link.querySelector('.sr-only')?.textContent).toBe(' (opens in a new tab)')
  })

  it('folds the cue into an explicit aria-label (no visible sr-only span)', () => {
    render(<OutboundLink href="https://example.org" aria-label="Open the report">12</OutboundLink>)
    screen.getByRole('link', { name: 'Open the report (opens in a new tab)' })
    expect(document.querySelector('.sr-only')).toBeNull()
  })

  it('does not duplicate the cue when the aria-label already has it', () => {
    render(<OutboundLink href="https://example.org" aria-label="Open the report (opens in a new tab)">x</OutboundLink>)
    expect(screen.getByRole('link').getAttribute('aria-label')).toBe('Open the report (opens in a new tab)')
  })

  it('passes through extra anchor props', () => {
    render(<OutboundLink href="https://example.org" title="tip" className="foo">y</OutboundLink>)
    const link = screen.getByRole('link')
    expect(link.getAttribute('title')).toBe('tip')
    expect(link.className).toBe('foo')
  })
})

// ── Own dispatch (sortable-list-links-own-dispatch) ──────────────────────────
//
// In the Tauri apps a click sends this link's OWN href to the opener and cancels
// the click, so the plugin's window listener (replicated by installTauriOpener)
// never reads the anchor back. `fireEvent.click` returns false exactly when the
// click was cancelled. HotspotLink renders through OutboundLink, so the redraw
// row below covers both.

describe('OutboundLink owns its dispatch in the Tauri apps', () => {
  let opener: TauriOpener | null = null
  afterEach(() => { opener?.uninstall(); opener = null; vi.restoreAllMocks() })

  // The apostrophe is left alone by encodeURIComponent and escaped by the URL
  // parser in a query, so the anchor's resolved href differs from the prop: the
  // row proves the RESOLVED href is what is sent, as the listener sent it.
  const HREF = "https://example.org/a?q=it's"

  it.each([
    ['a primary click', {}],
    ['a Control-click', { ctrlKey: true }],
    ['a Shift-click', { shiftKey: true }],
  ])('%s sends the link\'s own resolved href once and cancels the click', (_label, init) => {
    opener = installTauriOpener()
    render(<OutboundLink href={HREF}>View site</OutboundLink>)
    const link = screen.getByRole<HTMLAnchorElement>('link')
    expect(link.href).toBe('https://example.org/a?q=it%27s')
    expect(fireEvent.click(link, init)).toBe(false)
    expect(opener.calls()).toEqual([{ url: 'https://example.org/a?q=it%27s', via: 'own' }])
  })

  it.each([
    ['a Command-click', { metaKey: true }],
    ['an Alt-click', { altKey: true }],
    ['a middle-button click', { button: 1 }],
    ['a secondary-button click', { button: 2 }],
  ])('leaves %s to the platform: nothing sent, nothing cancelled', (_label, init) => {
    opener = installTauriOpener()
    render(<OutboundLink href={HREF}>View site</OutboundLink>)
    expect(fireEvent.click(screen.getByRole('link'), init)).toBe(true)
    expect(opener.calls()).toEqual([])
  })

  it('runs a caller\'s onClick first and leaves a click that caller cancelled alone', () => {
    opener = installTauriOpener()
    const seen: string[] = []
    render(
      <OutboundLink href={HREF} onClick={e => { seen.push('caller'); e.preventDefault() }}>View site</OutboundLink>,
    )
    expect(fireEvent.click(screen.getByRole('link'))).toBe(false)
    expect(seen).toEqual(['caller'])
    expect(opener.calls()).toEqual([])
  })

  it('Enter on a focused link opens the page exactly once', () => {
    opener = installTauriOpener()
    render(<OutboundLink href={HREF}>View site</OutboundLink>)
    const link = screen.getByRole('link')
    link.focus()
    expect(document.activeElement).toBe(link)
    fireEvent.keyDown(link, { key: 'Enter' })
    fireEvent.keyUp(link, { key: 'Enter' })
    // No key handler opens anything on its own.
    expect(opener.calls()).toEqual([])
    // jsdom does not run a link's keyboard activation. A browser turns Enter on
    // a focused link into a click with detail 0, which is dispatched here.
    expect(fireEvent.click(link, { detail: 0 })).toBe(false)
    expect(opener.calls()).toEqual([{ url: 'https://example.org/a?q=it%27s', via: 'own' }])
  })

  it('web and Pi: the ordinary anchor, with nothing sent and nothing cancelled', () => {
    // No Tauri internals: isTauri() is false, as it is in a browser.
    const programmaticOpen = vi.spyOn(HTMLAnchorElement.prototype, 'click')
    render(<OutboundLink href={HREF}>View site</OutboundLink>)
    let cancelled: boolean | null = null
    // Read the click at the window, then cancel it there only so jsdom does not
    // attempt the navigation it cannot perform.
    const probe = (e: MouseEvent) => { cancelled = e.defaultPrevented; e.preventDefault() }
    window.addEventListener('click', probe)
    try {
      fireEvent.click(screen.getByRole('link'))
    } finally {
      window.removeEventListener('click', probe)
    }
    expect(cancelled).toBe(false)
    // openExternalUrl's web path would synthesize and click an anchor of its own.
    expect(programmaticOpen).not.toHaveBeenCalled()
  })

  it('a row redrawn inside the same click still opens the URL that was clicked; a bare anchor in the same row would not', () => {
    opener = installTauriOpener()
    // Index keys on purpose: the redraw keeps each anchor node and rewrites its
    // href, so whatever reads the anchor after the redraw finds the other row.
    // flushSync makes the redraw land before the window listener on every
    // dispatch path, rather than relying on when React flushes between listeners.
    function Rows() {
      const [ids, setIds] = useState(['L100', 'L200'])
      return (
        <ul onClick={() => flushSync(() => setIds(prev => [...prev].reverse()))}>
          {ids.map((id, i) => (
            <li key={i}>
              <HotspotLink locId={id} name={`Place ${id}`} isHotspot />
              <Link href={`https://ebird.org/hotspot/${id}`} target="_blank" rel="noreferrer">{`bare ${id}`}</Link>
            </li>
          ))}
        </ul>
      )
    }
    render(<Rows />)

    const owned = screen.getAllByRole('link', { name: /^Open Place/ })[0]
    expect(owned.getAttribute('href')).toBe('https://ebird.org/hotspot/L100')
    expect(fireEvent.click(owned)).toBe(false)
    // The same node now shows the other row, and the page opened is still L100.
    expect(owned.getAttribute('href')).toBe('https://ebird.org/hotspot/L200')
    expect(opener.calls()).toEqual([{ url: 'https://ebird.org/hotspot/L100', via: 'own' }])

    // Control: the identical redraw under an anchor with no dispatch of its own.
    // The listener reads the live href after the redraw and opens the row the
    // user did not click, which is the case the shared links no longer depend on.
    const bare = screen.getAllByRole('link', { name: /^bare/ })[0]
    expect(bare.getAttribute('href')).toBe('https://ebird.org/hotspot/L200')
    fireEvent.click(bare)
    expect(opener.calls().slice(1)).toEqual([{ url: 'https://ebird.org/hotspot/L100', via: 'listener' }])
  })
})
