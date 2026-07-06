// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { openExternalUrl } from './openExternal'

afterEach(() => vi.restoreAllMocks())

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
})
