// @vitest-environment jsdom
import { createRef } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { Button } from './Button'
import { Link } from './Link'

afterEach(cleanup)

describe('native Button and Link primitives', () => {
  it('defaults Button to tabindex 0 without changing native type semantics', () => {
    render(<form><Button>Save</Button></form>)
    const button = screen.getByRole('button', { name: 'Save' })
    expect(button.tagName).toBe('BUTTON')
    expect(button.getAttribute('tabindex')).toBe('0')
    expect(button.hasAttribute('type')).toBe(false)
  })

  it('forwards Button props, class, style, events, ref, and an explicit override unchanged', () => {
    const ref = createRef<HTMLButtonElement>()
    const onClick = vi.fn()
    render(
      <Button
        ref={ref}
        type="button"
        tabIndex={-1}
        disabled
        aria-label="Pinned action"
        className="kept-button"
        style={{ marginLeft: 7 }}
        data-probe="button"
        onClick={onClick}
      />,
    )
    const button = screen.getByRole('button', { name: 'Pinned action' }) as HTMLButtonElement
    expect(ref.current).toBe(button)
    expect(button.type).toBe('button')
    expect(button.tabIndex).toBe(-1)
    expect(button.disabled).toBe(true)
    expect(button.className).toBe('kept-button')
    expect(button.style.marginLeft).toBe('7px')
    expect(button.dataset.probe).toBe('button')
    fireEvent.click(button)
    expect(onClick).not.toHaveBeenCalled()
  })

  it('defaults Link to tabindex 0 while preserving native anchor semantics', () => {
    render(<Link href="https://example.test/report">Report</Link>)
    const link = screen.getByRole('link', { name: 'Report' })
    expect(link.tagName).toBe('A')
    expect(link.getAttribute('href')).toBe('https://example.test/report')
    expect(link.getAttribute('tabindex')).toBe('0')
    expect(link.hasAttribute('target')).toBe(false)
    expect(link.hasAttribute('rel')).toBe(false)
  })

  it('forwards Link props, class, style, events, ref, and an explicit override unchanged', () => {
    const ref = createRef<HTMLAnchorElement>()
    const onClick = vi.fn()
    render(
      <Link
        ref={ref}
        href="#details"
        tabIndex={-1}
        target="_blank"
        rel="noreferrer"
        aria-label="Open details"
        className="kept-link"
        style={{ marginLeft: 9 }}
        data-probe="link"
        onClick={onClick}
      />,
    )
    const link = screen.getByRole('link', { name: 'Open details' }) as HTMLAnchorElement
    expect(ref.current).toBe(link)
    expect(link.getAttribute('href')).toBe('#details')
    expect(link.tabIndex).toBe(-1)
    expect(link.target).toBe('_blank')
    expect(link.rel).toBe('noreferrer')
    expect(link.className).toBe('kept-link')
    expect(link.style.marginLeft).toBe('9px')
    expect(link.dataset.probe).toBe('link')
    fireEvent.click(link)
    expect(onClick).toHaveBeenCalledTimes(1)
  })
})
