// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { ToggleSwitch } from './ToggleSwitch'

afterEach(cleanup)

describe('ToggleSwitch', () => {
  it('default treatment keeps the boxed button chrome, byte-identical geometry', () => {
    render(<ToggleSwitch label="Use Textures" checked={false} onChange={() => {}} />)
    const btn = screen.getByRole('switch', { name: 'Use Textures' })
    expect(btn.style.border).toBe('1.5px solid var(--sr-border)')
    expect(btn.style.background).toBe('var(--sr-surface)')
    expect(btn.style.height).toBe('30px')
    expect(btn.style.borderRadius).toBe('6px')
    expect(btn.className).not.toContain('sr-touch-target')
    const track = btn.firstElementChild as HTMLElement
    expect(track.style.width).toBe('28px')
    expect(track.style.height).toBe('16px')
    const knobEl = track.firstElementChild as HTMLElement
    expect(knobEl.style.width).toBe('12px')
    expect(knobEl.style.left).toBe('2px')
  })

  it('default treatment slides the knob to 14px when checked', () => {
    render(<ToggleSwitch label="Use Textures" checked onChange={() => {}} />)
    const btn = screen.getByRole('switch', { name: 'Use Textures' })
    const knobEl = btn.firstElementChild!.firstElementChild as HTMLElement
    expect(knobEl.style.left).toBe('14px')
    expect(btn.getAttribute('aria-checked')).toBe('true')
  })

  it('bare treatment drops the chrome and uses the larger track', () => {
    render(
      <ToggleSwitch label="Disable embedded media" labelVisible={false} bare checked={false} onChange={() => {}} />,
    )
    const btn = screen.getByRole('switch', { name: 'Disable embedded media' })
    // jsdom expands the `border: none` shorthand; the style component that
    // proves the frame is gone is border-style.
    expect(btn.style.borderStyle).toBe('none')
    expect(btn.style.background).toBe('none')
    expect(btn.style.borderRadius).toBe('999px')
    expect(btn.className).toContain('sr-touch-target')
    const track = btn.firstElementChild as HTMLElement
    expect(track.style.width).toBe('36px')
    expect(track.style.height).toBe('20px')
    const knobEl = track.firstElementChild as HTMLElement
    expect(knobEl.style.width).toBe('16px')
    expect(knobEl.style.left).toBe('2px')
  })

  it('bare treatment slides the knob to 18px when checked and keeps the a11y contract', () => {
    const onChange = vi.fn()
    render(
      <ToggleSwitch label="Disable embedded media" labelVisible={false} bare checked onChange={onChange} />,
    )
    const btn = screen.getByRole('switch', { name: 'Disable embedded media' })
    const knobEl = btn.firstElementChild!.firstElementChild as HTMLElement
    expect(knobEl.style.left).toBe('18px')
    expect(btn.getAttribute('aria-checked')).toBe('true')
    expect(btn.getAttribute('tabindex')).toBe('0')
    fireEvent.click(btn)
    expect(onChange).toHaveBeenCalledTimes(1)
  })
})
