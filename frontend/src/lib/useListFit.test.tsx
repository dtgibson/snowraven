// @vitest-environment jsdom
//
// map-scroll-on-phones D-15: the dropdown lists keep to the visible room on the
// phone tier. The arithmetic is pure and tested over its domain; the hook is
// driven through jsdom with the geometry STUBBED, because jsdom has no layout.
// What this cannot see, said so it is not over-read: whether a real engine's
// list ends above its bar or keyboard. That is the Tester's real-browser and
// simulator reading (design-refinement.md "What the Tester measures", 17 to 20).

import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { useState } from 'react'
import { LIST_FIT_EDGE_PX, LIST_FIT_VAR, listFitPx, useListFit } from './useListFit'

describe('listFitPx', () => {
  it('is the room under the list less the edge, rounded down', () => {
    expect(LIST_FIT_EDGE_PX).toBe(8)
    expect(listFitPx(500, 400.6, 0)).toBe(91)
    expect(listFitPx(844, 100, 0)).toBe(736)
  })

  it('never goes below the floor, however little room there is', () => {
    expect(listFitPx(500, 480, 66)).toBe(66)
    expect(listFitPx(100, 400, 66)).toBe(66)
  })

  it('answers the floor for an unusable reading, never NaN', () => {
    expect(listFitPx(Number.NaN, 400, 66)).toBe(66)
    expect(listFitPx(500, Number.POSITIVE_INFINITY, 66)).toBe(66)
    expect(listFitPx(500, 400, Number.NaN)).toBe(92)
  })
})

function stubTier(matches: boolean) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches, media: query, onchange: null,
    addEventListener: () => {}, removeEventListener: () => {},
    addListener: () => {}, removeListener: () => {}, dispatchEvent: () => false,
  }))
}

/** A field with its list, the shape all five pickers share: the list is the
 *  field wrapper's child. Its geometry is set through `geom` before render. */
const geom = { listTop: 400, wanted: 300, optionHeight: 44, barTop: 500 }

function Picker({ open }: { open: boolean }) {
  const [list, setList] = useState<HTMLDivElement | null>(null)
  useListFit(open, undefined, list)
  return (
    <div data-testid="field">
      {open && (
        <div ref={el => {
          if (el) {
            Object.defineProperty(el, 'offsetHeight', { configurable: true, get: () => geom.wanted })
            el.getBoundingClientRect = () => ({ top: geom.listTop } as DOMRect)
          }
          setList(el)
        }} data-testid="list">
          <div role="option" ref={el => {
            if (el) {
              Object.defineProperty(el, 'offsetHeight', { configurable: true, get: () => geom.optionHeight })
              Object.defineProperty(el, 'offsetParent', { configurable: true, get: () => el.parentElement })
              Object.defineProperty(el, 'offsetTop', { configurable: true, get: () => 4 })
            }
          }}>One</div>
        </div>
      )}
    </div>
  )
}

function stubPage() {
  const bar = document.createElement('nav')
  bar.className = 'sr-navbar'
  bar.getBoundingClientRect = () => ({ top: geom.barTop } as DOMRect)
  document.body.appendChild(bar)
  const listeners: Record<string, Array<() => void>> = {}
  vi.stubGlobal('visualViewport', {
    offsetTop: 0, height: 844,
    addEventListener: (t: string, f: () => void) => { (listeners[t] ||= []).push(f) },
    removeEventListener: (t: string, f: () => void) => { listeners[t] = (listeners[t] || []).filter(g => g !== f) },
  })
  const scrolled: unknown[] = []
  const margins: string[] = []
  Element.prototype.scrollIntoView = function (this: HTMLElement, arg?: boolean | ScrollIntoViewOptions) {
    scrolled.push(arg)
    margins.push(this.style.scrollMarginTop)
  }
  return { bar, listeners, scrolled, margins }
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  document.querySelectorAll('.sr-navbar').forEach(n => n.remove())
})

const fit = () => document.querySelector<HTMLElement>('[data-testid="list"]')!.style.getPropertyValue(LIST_FIT_VAR)

describe('useListFit on the phone tier', () => {
  it('fits the list to the room above the bar, after bringing the field to the top when the room is short', () => {
    stubTier(true)
    const { scrolled, listeners, margins } = stubPage()
    render(<Picker open />)
    // 500 (bar top) - 400 (list top) - 8 = 92, under the 300 the list wants: so
    // the field was scrolled to the top first, instantly, then measured.
    expect(scrolled).toEqual([{ block: 'start', inline: 'nearest', behavior: 'auto' }])
    // ...stopping 8px (plus the apps' status bar) from the top, for that call only.
    expect(margins).toEqual(['var(--sr-list-fit-margin, 8px)'])
    expect(document.querySelector<HTMLElement>('[data-testid="field"]')!.style.scrollMarginTop).toBe('')
    expect(fit()).toBe('92px')
    // It listens to the visual viewport (keyboard, rotation) while open...
    expect(listeners.resize?.length).toBe(1)
    expect(listeners.scroll?.length).toBe(1)
  })

  it('keeps a floor of one and a half option rows from the list\'s own top', () => {
    stubTier(true)
    stubPage()
    geom.barTop = 410
    try {
      render(<Picker open />)
      // 4 (the option's offset) + 1.5 x 44 = 70, which beats the 2px of room.
      expect(fit()).toBe('70px')
    } finally { geom.barTop = 500 }
  })

  it('does not scroll when the list already fits, and ignores a bar that is hidden', () => {
    stubTier(true)
    const { scrolled, bar } = stubPage()
    bar.style.visibility = 'hidden'
    render(<Picker open />)
    // With the bar hidden (a map panel expanded) the visual viewport bounds it:
    // 844 - 400 - 8 = 436 >= 300.
    expect(scrolled).toEqual([])
    expect(fit()).toBe('436px')
  })

  it('removes the property and its listeners when the list closes', () => {
    stubTier(true)
    const { listeners } = stubPage()
    const { rerender } = render(<Picker open />)
    const list = document.querySelector<HTMLElement>('[data-testid="list"]')!
    rerender(<Picker open={false} />)
    expect(list.style.getPropertyValue(LIST_FIT_VAR)).toBe('')
    expect(listeners.resize).toEqual([])
    expect(listeners.scroll).toEqual([])
  })
})

describe('useListFit above the phone tier', () => {
  it('does nothing at all: no scroll, no property, no listener', () => {
    stubTier(false)
    const { scrolled, listeners } = stubPage()
    render(<Picker open />)
    expect(scrolled).toEqual([])
    expect(fit()).toBe('')
    expect(listeners.resize).toBeUndefined()
  })
})
