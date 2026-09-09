// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { openExternalLink, openExternalUrl } from './openExternal'

afterEach(() => {
  delete (window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__
  vi.restoreAllMocks()
})

describe('openExternalUrl', () => {
  it('opens the url via a transient target=_blank anchor click, not window.open', () => {
    let seen: { href: string; target: string; rel: string } | null = null
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(function (this: HTMLAnchorElement) {
        // Capture the anchor's attributes at click time — this is the exact
        // shape tauri-plugin-opener intercepts in the desktop app.
        seen = { href: this.href, target: this.target, rel: this.rel }
      })
    // window.open must NOT be used — it's the Tauri gotcha this seam exists to avoid.
    const winOpen = vi.spyOn(window, 'open').mockImplementation(() => null)

    openExternalUrl('https://ebird.org/edit/effort?subID=S123')

    expect(clickSpy).toHaveBeenCalledTimes(1)
    expect(winOpen).not.toHaveBeenCalled()
    expect(seen).toEqual({
      href: 'https://ebird.org/edit/effort?subID=S123',
      target: '_blank',
      rel: 'noopener noreferrer',
    })
    // The transient anchor is removed after the click (no DOM litter).
    expect(document.querySelector('a[href*="edit/effort"]')).toBeNull()
  })

  it('sends the exact immutable string directly to Tauri and bypasses delegated anchor discovery', () => {
    const invoke = vi.fn().mockResolvedValue(undefined)
    ;(window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__ = { invoke }
    const preventDefault = vi.fn()

    const click = { preventDefault, defaultPrevented: false, button: 0, metaKey: false, altKey: false }
    openExternalLink(click, 'https://ebird.org/checklist/S101')
    openExternalLink(click, 'https://ebird.org/checklist/S202')

    expect(preventDefault).toHaveBeenCalledTimes(2)
    expect(invoke.mock.calls).toEqual([
      ['plugin:opener|open_url', { url: 'https://ebird.org/checklist/S101' }, undefined],
      ['plugin:opener|open_url', { url: 'https://ebird.org/checklist/S202' }, undefined],
    ])
    expect(typeof (invoke.mock.calls[0][1] as { url: unknown }).url).toBe('string')
  })

  it.each([
    ['an already prevented click', { defaultPrevented: true, button: 0, metaKey: false, altKey: false }],
    ['a non-primary click', { defaultPrevented: false, button: 1, metaKey: false, altKey: false }],
    ['a Command-click', { defaultPrevented: false, button: 0, metaKey: true, altKey: false }],
    ['an Alt-click', { defaultPrevented: false, button: 0, metaKey: false, altKey: true }],
  ])('leaves %s to native anchor behavior', (_label, eventShape) => {
    const invoke = vi.fn().mockResolvedValue(undefined)
    ;(window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__ = { invoke }
    const preventDefault = vi.fn()

    openExternalLink({ ...eventShape, preventDefault }, 'https://ebird.org/checklist/S101')

    expect(preventDefault).not.toHaveBeenCalled()
    expect(invoke).not.toHaveBeenCalled()
  })
})
