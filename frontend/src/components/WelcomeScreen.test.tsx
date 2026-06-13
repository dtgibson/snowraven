// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { WelcomeScreen } from './WelcomeScreen'

afterEach(cleanup)

describe('WelcomeScreen focus containment (F065)', () => {
  it('wraps Tab from the last focusable back to the first inside the dialog', () => {
    render(<WelcomeScreen onGetStarted={vi.fn()} onOpenHelp={vi.fn()} onDismiss={vi.fn()} />)
    const dialog = screen.getByRole('dialog')
    const focusables = Array.from(
      dialog.querySelectorAll<HTMLElement>('button, a[href], [tabindex]:not([tabindex="-1"])')
    )
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
