// @vitest-environment jsdom
/// <reference types="node" />
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ToggleSwitch } from './ToggleSwitch'
import { parseTopLevelRules } from '../../lib/cssTopLevelRules'

afterEach(cleanup)

// The boxed chrome lives in globals.css since species-detail-escapee-toggle, so
// the hover state can win over it (an inline value is 1,0,0 and beats any class
// rule). jsdom has no cascade, so the class half is asserted by parsing the REAL
// stylesheet, the same posture as filterControlSizeCss / milestoneContrast.
// A path string rather than a URL object: under the jsdom environment the
// global `URL` is jsdom's, which node's fs does not accept as a file URL.
const css = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '../../globals.css'), 'utf8')
const rules = parseTopLevelRules(css)

describe('ToggleSwitch', () => {
  it('default treatment keeps the boxed button chrome, byte-identical geometry', () => {
    render(<ToggleSwitch label="Use Textures" checked={false} onChange={() => {}} />)
    const btn = screen.getByRole('switch', { name: 'Use Textures' })
    // The chrome moved to the class: nothing inline may re-assert it, or the
    // hover rule silently loses again.
    expect(btn.className).toBe('sr-toggle')
    expect(btn.style.border).toBe('')
    expect(btn.style.background).toBe('')
    expect(btn.style.transition).toBe('')
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

  it('the boxed chrome is declared once, top-level, on .sr-toggle, with the shipped values', () => {
    // Top-level (unlayered) matters: Tailwind's preflight resets border and
    // background-color on every button inside `@layer base`, and unlayered
    // author CSS beats a layered rule regardless of specificity. A rule moved
    // into a layer would pass a body-only check and lose the chrome on screen.
    const body = rules.get('.sr-toggle')
    expect(body, '.sr-toggle must be a top-level rule').toBeTruthy()
    expect(body).toMatch(/border:\s*1\.5px solid var\(--sr-border\)/)
    expect(body).toMatch(/background:\s*var\(--sr-surface\)/)
    // The opacity transition the inline style used to carry rides along, so
    // the inert fade is unchanged; the two hover properties are 120ms ease-out.
    expect(body).toMatch(/transition:[^;]*opacity 150ms ease-out/)
    expect(body).toMatch(/transition:[^;]*border-color 120ms ease-out/)
    expect(body).toMatch(/transition:[^;]*background-color 120ms ease-out/)
  })

  it('hover steps the border and fill to the interactive tokens, and not on an inert switch', () => {
    const hover = [...rules.keys()].find(sel => sel.startsWith('.sr-toggle') && /:hover$/.test(sel))
    expect(hover, 'a .sr-toggle hover rule').toBeTruthy()
    const body = rules.get(hover!)!
    expect(body).toMatch(/border-color:\s*var\(--sr-border-medium\)/)
    expect(body).toMatch(/background:\s*var\(--sr-surface-subtle\)/)
    // Both inert modes keep the resting chrome: `disabled`, and the
    // focusable-but-not-operable `aria-disabled` mode below.
    expect(hover).toContain(':not(:disabled)')
    expect(hover).toContain(':not([aria-disabled="true"])')
    // No hex, no rgb: tokens only, in both themes (ui.md).
    expect(body).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(/i)
  })

  it('the bare treatment does not take the boxed class, so the hover chrome never reaches it', () => {
    render(<ToggleSwitch label="Disable embedded media" labelVisible={false} bare checked={false} onChange={() => {}} />)
    const btn = screen.getByRole('switch', { name: 'Disable embedded media' })
    expect(btn.className).not.toContain('sr-toggle')
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

  // icloud-api-key-sync FR-02: the aria-disabled mode keeps the switch
  // focusable (so an associated reason is read in place), announces
  // aria-disabled, ignores activation, and takes the disabled look.
  it('ariaDisabled keeps the switch focusable, announces aria-disabled, and ignores activation', () => {
    const onChange = vi.fn()
    render(<ToggleSwitch label="Sync API keys" labelVisible={false} bare ariaDisabled checked={false} onChange={onChange} />)
    const btn = screen.getByRole('switch', { name: 'Sync API keys' }) as HTMLButtonElement
    expect(btn.getAttribute('aria-disabled')).toBe('true')
    expect(btn.disabled).toBe(false)
    expect(btn.tabIndex).toBe(0)
    btn.focus()
    expect(document.activeElement).toBe(btn)
    fireEvent.click(btn)
    fireEvent.keyDown(btn, { key: 'Enter' })
    expect(onChange).not.toHaveBeenCalled()
    expect(btn.style.cursor).toBe('not-allowed')
    expect(btn.style.opacity).toBe('0.72')
    expect(btn.style.transition).toContain('opacity')
  })

  it('without ariaDisabled the bare switch carries no aria-disabled and activates', () => {
    const onChange = vi.fn()
    render(<ToggleSwitch label="Sync API keys" labelVisible={false} bare checked={false} onChange={onChange} />)
    const btn = screen.getByRole('switch', { name: 'Sync API keys' })
    expect(btn.hasAttribute('aria-disabled')).toBe(false)
    fireEvent.click(btn)
    expect(onChange).toHaveBeenCalledTimes(1)
  })
})
