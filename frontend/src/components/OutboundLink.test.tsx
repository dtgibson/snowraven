// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { OutboundLink } from './OutboundLink'

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
