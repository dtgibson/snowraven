// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { ChecklistLink, checklistLinkAriaLabel } from './ChecklistLink'

afterEach(cleanup)

describe('ChecklistLink', () => {
  it('links to the checklist with the id as visible text and the canonical name', () => {
    render(<ChecklistLink submissionId="S12345" />)
    const link = screen.getByRole('link', { name: 'Open checklist S12345 on eBird (opens in a new tab)' })
    expect(link.getAttribute('href')).toBe('https://ebird.org/checklist/S12345')
    expect(link.getAttribute('target')).toBe('_blank')
    expect(link.getAttribute('rel')).toBe('noreferrer')
    expect(link.textContent).toContain('S12345')
  })

  it('leads the accessible name with the visible label (WCAG 2.5.3 Label in Name)', () => {
    render(<ChecklistLink submissionId="S999" label="Jun 5, 2024" />)
    const link = screen.getByRole('link', { name: 'Jun 5, 2024 — open checklist on eBird (opens in a new tab)' })
    expect(link.textContent).toContain('Jun 5, 2024')
    // The raw id is not shown when a human-readable label is given.
    expect(link.textContent).not.toContain('S999')
  })

  it('compact mode renders the icon only, with the canonical id-based name', () => {
    render(<ChecklistLink submissionId="S42" label="not shown in compact" compact />)
    const link = screen.getByRole('link', { name: 'Open checklist S42 on eBird (opens in a new tab)' })
    const svg = link.querySelector('svg')
    expect(svg).toBeTruthy()
    expect(svg?.getAttribute('aria-hidden')).toBe('true')
    // No visible text — the icon is the only child.
    expect(link.textContent).toBe('')
  })

  it('renders plain text (no link) for a junk id', () => {
    render(<ChecklistLink submissionId="not-an-id" label="Jun 5" />)
    expect(screen.queryByRole('link')).toBeNull()
    expect(screen.getByText('Jun 5')).toBeTruthy()
  })

  it('renders nothing for a junk id in compact mode', () => {
    const { container } = render(<ChecklistLink submissionId="garbage" compact />)
    expect(container.firstChild).toBeNull()
  })

  it('checklistLinkAriaLabel leads with the label when present, else names the id', () => {
    expect(checklistLinkAriaLabel('S1')).toBe('Open checklist S1 on eBird (opens in a new tab)')
    expect(checklistLinkAriaLabel('S1', '12 species')).toBe('12 species — open checklist on eBird (opens in a new tab)')
    // A label equal to the id collapses to the id-based form (no redundancy).
    expect(checklistLinkAriaLabel('S1', 'S1')).toBe('Open checklist S1 on eBird (opens in a new tab)')
  })

  it('passes a native title tooltip through to the link', () => {
    render(<ChecklistLink submissionId="S5" label="Jun 5" title="Opens the checklist with the most media (1 of 3 that day)" />)
    expect(screen.getByRole('link').getAttribute('title')).toBe('Opens the checklist with the most media (1 of 3 that day)')
  })
})
