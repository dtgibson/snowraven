// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { DropZone } from './DropZone'

afterEach(cleanup)

describe('DropZone accessibility (F037/F038)', () => {
  it('does not set inline outline:none (lets the global focus ring show)', () => {
    const { container } = render(<DropZone label="eBird" file={null} error={null} onFile={vi.fn()} />)
    const zone = container.querySelector('[role="button"]') as HTMLElement
    // F038: inline outline:'none' was removed so :focus-visible can paint the ring.
    expect(zone.style.outline).toBe('')
  })

  it('error state uses --sr-error (not the near-invisible --sr-error-muted) for the border', () => {
    const { container } = render(<DropZone label="eBird" file={null} error="Bad file" onFile={vi.fn()} />)
    const zone = container.querySelector('[role="button"]') as HTMLElement
    // F037: the error border switched from --sr-error-muted to --sr-error.
    expect(zone.style.border).toContain('var(--sr-error)')
    expect(zone.style.border).not.toContain('var(--sr-error-muted)')
  })

  it('keeps role=alert on the error text', () => {
    render(<DropZone label="eBird" file={null} error="Bad file" onFile={vi.fn()} />)
    expect(screen.getByRole('alert').textContent).toBe('Bad file')
  })
})
