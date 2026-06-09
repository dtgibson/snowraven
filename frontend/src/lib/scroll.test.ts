// @vitest-environment jsdom

import { describe, it, expect, vi, afterEach } from 'vitest'
import { smoothScrollIntoView, prefersReducedMotion } from './scroll'

afterEach(() => {
  vi.restoreAllMocks()
  delete (window as unknown as { matchMedia?: unknown }).matchMedia
})

function mockReducedMotion(matches: boolean) {
  window.matchMedia = vi.fn().mockReturnValue({ matches } as MediaQueryList)
}

describe('smoothScrollIntoView', () => {
  // jsdom does not implement Element.prototype.scrollIntoView, so assign the mock
  // directly rather than spying on a method that doesn't exist.
  function elWithScrollSpy() {
    const el = document.createElement('div')
    const fn = vi.fn()
    el.scrollIntoView = fn
    return { el, fn }
  }

  it('scrolls smoothly when reduced motion is NOT requested', () => {
    mockReducedMotion(false)
    const { el, fn } = elWithScrollSpy()
    smoothScrollIntoView(el)
    expect(fn).toHaveBeenCalledWith({ block: 'start', behavior: 'smooth' })
  })

  it('jumps instantly (behavior auto) when reduced motion IS requested', () => {
    mockReducedMotion(true)
    const { el, fn } = elWithScrollSpy()
    smoothScrollIntoView(el)
    expect(fn).toHaveBeenCalledWith({ block: 'start', behavior: 'auto' })
  })

  it('passes through custom positioning options while forcing the motion-aware behavior', () => {
    mockReducedMotion(false)
    const { el, fn } = elWithScrollSpy()
    smoothScrollIntoView(el, { block: 'center', inline: 'nearest' })
    expect(fn).toHaveBeenCalledWith({ block: 'center', inline: 'nearest', behavior: 'smooth' })
  })

  it('no-ops on a null target without throwing', () => {
    mockReducedMotion(false)
    expect(() => smoothScrollIntoView(null)).not.toThrow()
    expect(() => smoothScrollIntoView(undefined)).not.toThrow()
  })

  it('treats a missing matchMedia (non-DOM env) as motion allowed', () => {
    // matchMedia deleted in afterEach of the prior test / not set here
    expect(prefersReducedMotion()).toBe(false)
  })
})
