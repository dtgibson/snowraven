// @vitest-environment jsdom
//
// The styleimagemissing safety net in AtlasLayer must bake hatch sprites only
// for ids it owns and ignore every other id (other layers may legitimately
// miss images). The map-facing handler is a thin wrapper around this reverse
// lookup — locking the lookup here tests the ownership contract without
// mocking a GL map.

import { afterAll, afterEach, beforeAll, describe, it, expect, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { AtlasLayer, hatchTierForImage } from './AtlasLayer'
import { TIERS, HATCH_IMAGE_ID } from '../lib/atlasTextures'
import type { AtlasData } from '../lib/atlasBlocks'

describe('hatchTierForImage', () => {
  it('maps every hatch sprite id back to its tier', () => {
    for (const tier of TIERS) {
      expect(hatchTierForImage(HATCH_IMAGE_ID[tier])).toBe(tier)
    }
  })

  it('ignores foreign ids', () => {
    expect(hatchTierForImage('sr-pin-visited')).toBeNull()
    expect(hatchTierForImage('sr-atlas-hatch-5')).toBeNull()
    expect(hatchTierForImage('')).toBeNull()
  })
})

// ── The block popup's close button (map-popup-keyboard-close) ────────────────
//
// The atlas block popup used to render maplibre's own close button. maplibre's
// injected <button> carries no tabIndex, and WebKit's default tab mode (what the
// shipped Mac, iPhone and iPad apps run) gives a plain <button> no place in the
// tab order, so the block popup had no keyboard close at all: the "Atlas blocks
// in view" rows opened it and nothing dismissed it. Library DOM is also out of
// reach of the source guard in lib/tabOrderCoverage.test.ts, so the control is
// drawn in the app's own markup instead of being stamped imperatively.
//
// Stubs react-map-gl with plain React — no maplibre-gl, no WebGL.

const popupProps = vi.hoisted(() => [] as Record<string, unknown>[])
const stubMap = vi.hoisted(() => ({
  getLayer: () => undefined,
  getBounds: () => ({ getWest: () => -122.6, getSouth: () => 37.6, getEast: () => -122.3, getNorth: () => 37.9 }),
  getCanvas: () => ({ style: {} as Record<string, string> }),
  hasImage: () => false,
  addImage: () => {},
  updateImage: () => {},
  queryRenderedFeatures: () => [],
  flyTo: () => {},
  on: () => {},
  off: () => {},
}))

vi.mock('react-map-gl/maplibre', () => ({
  Source: ({ children }: { children?: ReactNode }) => <>{children}</>,
  Layer: () => null,
  Popup: (props: Record<string, unknown>) => {
    popupProps.push(props)
    return <div data-testid="popup">{props.children as ReactNode}</div>
  },
  useMap: () => ({ current: stubMap }),
}))

// jsdom has no real 2D canvas context, so the hatch-sprite path would throw on
// mount. A no-op context lets the real registration effect run.
let getContextSpy: ReturnType<typeof vi.spyOn>
beforeAll(() => {
  const fakeCtx = {
    scale: () => {}, clearRect: () => {}, fillRect: () => {}, beginPath: () => {},
    moveTo: () => {}, lineTo: () => {}, stroke: () => {}, arc: () => {}, fill: () => {},
    getImageData: () => ({}),
  } as unknown as CanvasRenderingContext2D
  getContextSpy = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(fakeCtx)
})
afterAll(() => { getContextSpy.mockRestore() })

const ATLAS: AtlasData = {
  scheme: { cols: 1, rows: 1, quadLat: 0.125, quadLng: 0.125, positions: [['CE']] },
  quads: [],
  irregular: [{
    name: 'Oakland West CE',
    code: '37122A1CE',
    ring: [[-122.5, 37.7], [-122.4, 37.7], [-122.4, 37.8], [-122.5, 37.8], [-122.5, 37.7]],
    bbox: [-122.5, 37.7, -122.4, 37.8],
  }],
}

/** Open the block popup the only way a keyboard can: the in-view panel. */
const openBlockPopup = (container: HTMLElement): void => {
  const disclosure = container.querySelector('.sr-atlas-blocklist button')
  expect(disclosure, 'the Atlas blocks in view disclosure is rendered').toBeTruthy()
  fireEvent.click(disclosure!)
  const row = container.querySelector('.sr-inview-row')
  expect(row, 'a block row is offered').toBeTruthy()
  fireEvent.click(row!)
}

afterEach(() => { cleanup(); popupProps.length = 0 })

describe('AtlasLayer block popup close button', () => {
  it('turns maplibre’s own close button OFF and keeps closeOnClick false', () => {
    const { container } = render(<AtlasLayer data={ATLAS} />)
    openBlockPopup(container)
    const popup = popupProps.at(-1)!
    expect(popup.closeButton).toBe(false)
    // A stray map click must not dismiss this popup; unchanged by the fix.
    expect(popup.closeOnClick).toBe(false)
  })

  it('draws an app-owned close button with its own accessible name and an explicit tab stop', () => {
    const { container } = render(<AtlasLayer data={ATLAS} />)
    openBlockPopup(container)
    const close = screen.getByRole('button', { name: 'Close the atlas block popup' })
    expect(close.tagName).toBe('BUTTON')
    expect(close.getAttribute('tabindex')).toBe('0')
    // maplibre's own class, so it inherits the existing theming and the coarse-
    // pointer target already in globals.css.
    expect(close.className).toBe('maplibregl-popup-close-button')
  })

  it('the app-owned close button clears the selection through the popup’s own path', () => {
    const { container } = render(<AtlasLayer data={ATLAS} />)
    openBlockPopup(container)
    expect(screen.getByTestId('popup')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Close the atlas block popup' }))
    expect(screen.queryByTestId('popup')).toBeNull()
  })
})
