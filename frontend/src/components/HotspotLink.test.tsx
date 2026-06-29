// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { HotspotLink, hotspotLinkAriaLabel } from './HotspotLink'

afterEach(cleanup)

describe('HotspotLink', () => {
  it('links a public hotspot to its eBird page with the canonical accessible name', () => {
    render(<HotspotLink locId="L99" name="Crissy Field" isHotspot />)
    const link = screen.getByRole('link', { name: hotspotLinkAriaLabel('Crissy Field') })
    expect(link.getAttribute('href')).toBe('https://ebird.org/hotspot/L99')
    expect(link.getAttribute('target')).toBe('_blank')
    expect(link.getAttribute('rel')).toBe('noreferrer')
    expect(link.textContent).toContain('Crissy Field')
  })

  it('renders plain text (no link) for a non-hotspot personal location', () => {
    render(<HotspotLink locId="L1234" name="My Backyard" isHotspot={false} />)
    expect(screen.queryByRole('link')).toBeNull()
    expect(screen.getByText('My Backyard')).toBeTruthy()
  })

  it('renders plain text when the id is the wrong shape, even if flagged a hotspot', () => {
    // A junk id must never produce a styled 404 link (the standing security check).
    render(<HotspotLink locId="not-an-id" name="Mystery Spot" isHotspot />)
    expect(screen.queryByRole('link')).toBeNull()
    expect(screen.getByText('Mystery Spot')).toBeTruthy()
  })

  it('compact mode links with an icon only but keeps the full accessible name', () => {
    render(<HotspotLink locId="L7" name="Pier 7" isHotspot compact />)
    const link = screen.getByRole('link', { name: hotspotLinkAriaLabel('Pier 7') })
    expect(link.querySelector('svg')).toBeTruthy()
    // The visible text omits the name in compact mode (icon-only).
    expect(link.textContent?.trim()).not.toContain('Pier 7')
  })

  it('clamps a truncating hotspot LINK to its parent width so a long name cannot overflow', () => {
    // The shaded county popup's top-3 renders public-hotspot place names through
    // the LINK branch with truncate. Without maxWidth:100% the inline-flex link
    // shrink-to-fits to max-content and ran off the popup's right edge (the latent
    // bug the v0.5.48 county-name wrap did not cover). Parity with the plain branch.
    render(<HotspotLink locId="L42" name="A Very Long Hotspot Name That Would Overflow" isHotspot truncate />)
    const link = screen.getByRole('link', { name: hotspotLinkAriaLabel('A Very Long Hotspot Name That Would Overflow') })
    expect(link.style.maxWidth).toBe('100%')
    expect(link.style.minWidth).toBe('0px')
    // The inner span carries the ellipsis mechanism.
    expect(link.querySelector('.sr-truncate')).toBeTruthy()
  })

  it('does not force maxWidth on a non-truncating hotspot link (parity with the plain branch)', () => {
    render(<HotspotLink locId="L43" name="Short Spot" isHotspot />)
    const link = screen.getByRole('link', { name: hotspotLinkAriaLabel('Short Spot') })
    expect(link.style.maxWidth).toBe('')
  })
})
