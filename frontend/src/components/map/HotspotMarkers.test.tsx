// @vitest-environment jsdom
//
// Two concerns, one file:
//
// 1. The styleimagemissing safety net in HotspotMarkers must bake sprites only
//    for ids it owns and ignore every other id (other layers may legitimately
//    miss images). The map-facing handler is a thin wrapper around the reverse
//    lookups — locking them here tests the ownership contract without mocking
//    a GL map.
//
// 2. The color-coded-hotspots regression guard (NFR-10 / FR-03, QA-03): with
//    NO color mode active, the symbol layer's layout, the feature properties,
//    and the kind filter must be BYTE-IDENTICAL to the shipped build. The
//    expected values below are pinned as literals deliberately — they are the
//    shipped contract, not derived from the code under test, so a default-path
//    drift fails here rather than passing against itself. (Written red-first:
//    demonstrated red against a deliberate default-path mutation before the
//    mode work landed on top.)

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import type { ReactNode } from 'react'
import { HotspotMarkers, hotspotKindForImage, hotspotModeSpriteKeyForImage } from './HotspotMarkers'
import {
  HOTSPOT_KINDS, HOTSPOT_IMAGE_ID, HOTSPOT_MODE_SPRITE_KEYS, HOTSPOT_MODE_IMAGE_ID,
} from '../../lib/mapPins'
import type { HotspotPin } from '../../lib/mapExplorerTypes'

// ── Mocks: react-map-gl stubs record what the layer would be handed ───────────

const layerLog = vi.hoisted(() => [] as Record<string, unknown>[])
const sourceLog = vi.hoisted(() => [] as unknown[])
const mapCtl = vi.hoisted(() => ({ map: undefined as unknown }))

vi.mock('react-map-gl/maplibre', () => ({
  Source: ({ data, children }: { data: unknown; children?: ReactNode }) => {
    sourceLog.push(data)
    return <>{children}</>
  },
  Layer: (props: Record<string, unknown>) => {
    layerLog.push(props)
    return null
  },
  Popup: ({ children }: { children?: ReactNode }) => <div data-testid="popup">{children}</div>,
  useMap: () => ({ current: mapCtl.map }),
}))

// Sprite baking needs a 2D canvas context, which jsdom does not provide. The
// bakers are stubbed (ImageData-shaped sentinel); everything else in mapPins is
// the real module, so the id tables and reverse lookups under test are genuine.
// The mode baker records its calls so the tierRings threading is assertable
// (the ring's own drawing is guarded in lib/hotspotTierRings.test.ts).
const modeBakeCalls = vi.hoisted(() => [] as unknown[][])
vi.mock('../../lib/mapPins', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../lib/mapPins')>()
  const fakeImg = { width: 1, height: 1, data: new Uint8ClampedArray(4) }
  return {
    ...real,
    teardropImageData: () => fakeImg,
    modeTeardropImageData: (...args: unknown[]) => { modeBakeCalls.push(args); return fakeImg },
  }
})

// ── Fixtures ─────────────────────────────────────────────────────────────────

const PINS: HotspotPin[] = [
  { kind: 'visited', locId: 'L1', locName: 'Cesar Chavez Park', lat: 37.87, lng: -122.32, speciesCount: 12, lastVisit: '2026-08-01' },
  { kind: 'unvisited', locId: 'L2', locName: 'Aquatic Park', lat: 37.86, lng: -122.30 },
  { kind: 'personal', locId: 'L3', locName: 'Backyard', lat: 37.85, lng: -122.28, obsCount: 4, lastVisit: '2026-07-01' },
]

const baseProps = {
  pins: PINS,
  hiddenKinds: new Set<HotspotPin['kind']>(),
  sel: null,
  onSelect: () => {},
  autoFit: false,
}

/**
 * THE SHIPPED DEFAULT CONTRACT, pinned as literals (not imported from the code
 * under test): the exact layout object, filter shape, and feature-property key
 * set the pre-mode build produced. FR-03's "byte-identical default" is an
 * assertion against THESE, so a mode-work regression on the default path goes
 * red even if the code and its own constants drift together.
 */
const SHIPPED_DEFAULT_LAYOUT = {
  'icon-image': ['match', ['get', 'kind'], 'visited', 'sr-pin-visited', 'unvisited', 'sr-pin-unvisited', 'sr-pin-personal'],
  'icon-anchor': 'bottom',
  'icon-allow-overlap': true,
  'icon-ignore-placement': true,
}
const SHIPPED_DEFAULT_FILTER = ['!', ['in', ['get', 'kind'], ['literal', []]]]

interface FC { features: { properties: Record<string, unknown> }[] }

beforeEach(() => {
  layerLog.length = 0
  sourceLog.length = 0
  modeBakeCalls.length = 0
  mapCtl.map = undefined
})
afterEach(() => { cleanup(); vi.clearAllMocks() })

// ── 1. Reverse sprite lookups (ownership contract) ───────────────────────────

describe('hotspotKindForImage', () => {
  it('maps every hotspot sprite id back to its kind', () => {
    for (const kind of HOTSPOT_KINDS) {
      expect(hotspotKindForImage(HOTSPOT_IMAGE_ID[kind])).toBe(kind)
    }
  })

  it('ignores foreign ids', () => {
    expect(hotspotKindForImage('sr-atlas-hatch-1')).toBeNull()
    expect(hotspotKindForImage('some-style-sprite')).toBeNull()
    expect(hotspotKindForImage('')).toBeNull()
  })
})

describe('hotspotModeSpriteKeyForImage', () => {
  it('maps every mode sprite id back to its key', () => {
    for (const key of HOTSPOT_MODE_SPRITE_KEYS) {
      expect(hotspotModeSpriteKeyForImage(HOTSPOT_MODE_IMAGE_ID[key])).toBe(key)
    }
  })

  it('ignores foreign ids and the kind sprites (those belong to the other lookup)', () => {
    expect(hotspotModeSpriteKeyForImage('sr-atlas-hatch-1')).toBeNull()
    expect(hotspotModeSpriteKeyForImage(HOTSPOT_IMAGE_ID.visited)).toBeNull()
    expect(hotspotModeSpriteKeyForImage('')).toBeNull()
  })
})

// ── 2. Default-mode regression guard (FR-03 / NFR-10, QA-03) ─────────────────

describe('default mode is byte-identical to the shipped build', () => {
  it('renders the shipped symbol layout with no mode props', () => {
    render(<HotspotMarkers {...baseProps} />)
    expect(layerLog.length).toBe(1)
    expect(layerLog[0].layout).toEqual(SHIPPED_DEFAULT_LAYOUT)
    expect(layerLog[0].id).toBe('sr-hotspot')
    expect(layerLog[0].type).toBe('symbol')
  })

  it('renders the shipped kind filter with nothing hidden', () => {
    render(<HotspotMarkers {...baseProps} />)
    expect(layerLog[0].filter).toEqual(SHIPPED_DEFAULT_FILTER)
  })

  it('feature properties carry exactly {locId, kind} — no cls in default mode', () => {
    render(<HotspotMarkers {...baseProps} />)
    const fc = sourceLog[0] as FC
    expect(fc.features.length).toBe(PINS.length)
    for (const f of fc.features) {
      expect(Object.keys(f.properties).sort()).toEqual(['kind', 'locId'])
    }
  })

  it('renders the shipped layout when modeCls is explicitly null', () => {
    render(<HotspotMarkers {...baseProps} modeCls={null} />)
    expect(layerLog[0].layout).toEqual(SHIPPED_DEFAULT_LAYOUT)
  })
})

// ── 3. Mode-active rendering (additive; FR-12/FR-22 machinery) ───────────────

function clsMap(entries: [string, string][]): ReadonlyMap<string, string> {
  return new Map(entries)
}

describe('mode-active rendering', () => {
  const MODE_CLS = clsMap([
    ['L1', 't3-visited'],
    ['L2', 'unanswered-unvisited'],
    ['L3', 'personal'],
  ])

  it('adds a cls property per feature and a cls-matched icon-image', () => {
    render(<HotspotMarkers {...baseProps} modeCls={MODE_CLS} />)
    const fc = sourceLog[0] as FC
    expect(fc.features.map(f => f.properties.cls)).toEqual(['t3-visited', 'unanswered-unvisited', 'personal'])
    const layout = layerLog[0].layout as { 'icon-image': unknown[] }
    const img = layout['icon-image']
    expect(img[0]).toBe('match')
    expect(img[1]).toEqual(['get', 'cls'])
    // Every sprite key routes to its own image id, personal to the shipped
    // personal sprite, and the fallback is the neutral unanswered-unvisited.
    for (const key of HOTSPOT_MODE_SPRITE_KEYS) {
      const at = img.indexOf(key)
      expect(at).toBeGreaterThan(1)
      expect(img[at + 1]).toBe(HOTSPOT_MODE_IMAGE_ID[key])
    }
    const personalAt = img.indexOf('personal')
    expect(img[personalAt + 1]).toBe(HOTSPOT_IMAGE_ID.personal)
    expect(img[img.length - 1]).toBe(HOTSPOT_MODE_IMAGE_ID['unanswered-unvisited'])
  })

  it('keeps the kind filter working under a mode (FR-23)', () => {
    render(<HotspotMarkers {...baseProps} hiddenKinds={new Set(['unvisited'])} modeCls={MODE_CLS} />)
    expect(layerLog[0].filter).toEqual(['!', ['in', ['get', 'kind'], ['literal', ['unvisited']]]])
  })

  it('renders popupExtra content under the selected pin name (FR-25)', () => {
    const { getByTestId } = render(
      <HotspotMarkers
        {...baseProps}
        sel="L1"
        modeCls={MODE_CLS}
        popupExtra={pin => <div data-testid="mode-line">mode line for {pin.locId}</div>}
      />,
    )
    expect(getByTestId('mode-line').textContent).toBe('mode line for L1')
  })
})

// ── 4. Fit effect and sprite registration against a mock map ─────────────────

function mockMap() {
  const handlers = new Map<string, (e: unknown) => void>()
  return {
    handlers,
    flyTo: vi.fn(),
    fitBounds: vi.fn(),
    hasImage: vi.fn(() => false),
    addImage: vi.fn(),
    updateImage: vi.fn(),
    getLayer: vi.fn(() => undefined),
    queryRenderedFeatures: vi.fn(() => []),
    getCanvas: vi.fn(() => ({ style: {} })),
    on: vi.fn((ev: string, h: (e: unknown) => void) => { handlers.set(ev, h) }),
    off: vi.fn(),
  }
}

describe('fit effect and sprites (NFR-04 / NFR-03)', () => {
  it('a modeCls change never re-runs the fit effect; a pin-count change does', () => {
    const map = mockMap()
    mapCtl.map = map
    const { rerender } = render(<HotspotMarkers {...baseProps} autoFit modeCls={null} />)
    expect(map.fitBounds).toHaveBeenCalledTimes(1)

    // Cosmetic mode switch: same pins, new modeCls → NO re-fit (v0.5.59 rule).
    rerender(<HotspotMarkers {...baseProps} autoFit modeCls={clsMap([['L1', 't1-visited']])} />)
    rerender(<HotspotMarkers {...baseProps} autoFit modeCls={clsMap([['L1', 't2-visited']])} />)
    rerender(<HotspotMarkers {...baseProps} autoFit modeCls={null} />)
    expect(map.fitBounds).toHaveBeenCalledTimes(1)

    // A genuinely new result set (pin count) still frames.
    rerender(<HotspotMarkers {...baseProps} autoFit pins={PINS.slice(0, 2)} modeCls={null} />)
    expect(map.fitBounds).toHaveBeenCalledTimes(2)
  })

  it('registers the kind AND mode sprites unconditionally at effect time', () => {
    const map = mockMap()
    mapCtl.map = map
    render(<HotspotMarkers {...baseProps} />)
    const added = map.addImage.mock.calls.map(c => c[0] as string)
    for (const kind of HOTSPOT_KINDS) expect(added).toContain(HOTSPOT_IMAGE_ID[kind])
    for (const key of HOTSPOT_MODE_SPRITE_KEYS) expect(added).toContain(HOTSPOT_MODE_IMAGE_ID[key])
  })

  it('the styleimagemissing net answers own ids only', () => {
    const map = mockMap()
    mapCtl.map = map
    render(<HotspotMarkers {...baseProps} />)
    map.addImage.mockClear()
    const onMissing = map.handlers.get('styleimagemissing')!
    onMissing({ id: 'some-foreign-sprite' })
    expect(map.addImage).not.toHaveBeenCalled()
    onMissing({ id: HOTSPOT_MODE_IMAGE_ID['quiet-unvisited'] })
    expect(map.addImage).toHaveBeenCalledTimes(1)
    expect(map.addImage.mock.calls[0][0]).toBe(HOTSPOT_MODE_IMAGE_ID['quiet-unvisited'])
    onMissing({ id: HOTSPOT_IMAGE_ID.visited })
    expect(map.addImage).toHaveBeenCalledTimes(2)
  })
})

// ── 5. Use Tier Rings threading (colorblind-accessible-hotspot-pins) ─────────
// The ring drawing itself is guarded in lib/hotspotTierRings.test.ts; what
// this component owes is the WIRING — the flag reaches every mode-sprite bake,
// defaults off, and a flip is a cosmetic in-place re-bake (the v0.5.59 rule:
// updateImage, no remount, no re-fit).

describe('tier rings threading (NFR-04 / the v0.5.59 cosmetic-toggle rule)', () => {
  it('with no prop, every mode-sprite bake receives tierRings=false (shipped default)', () => {
    const map = mockMap()
    mapCtl.map = map
    render(<HotspotMarkers {...baseProps} />)
    expect(modeBakeCalls.length).toBe(HOTSPOT_MODE_SPRITE_KEYS.length)
    for (const call of modeBakeCalls) expect(call[2]).toBe(false)
  })

  it('a tierRings flip re-bakes every mode sprite in place — updateImage, no re-fit', () => {
    const map = mockMap()
    map.hasImage = vi.fn(() => true) // already registered → the update path
    mapCtl.map = map
    const { rerender } = render(<HotspotMarkers {...baseProps} autoFit tierRings={false} />)
    expect(map.fitBounds).toHaveBeenCalledTimes(1)
    modeBakeCalls.length = 0
    map.updateImage.mockClear()
    rerender(<HotspotMarkers {...baseProps} autoFit tierRings />)
    expect(modeBakeCalls.length).toBe(HOTSPOT_MODE_SPRITE_KEYS.length)
    for (const call of modeBakeCalls) expect(call[2]).toBe(true)
    expect(map.updateImage).toHaveBeenCalled()
    // Cosmetic: the fit effect never re-ran, so no reframe and no popup loss.
    expect(map.fitBounds).toHaveBeenCalledTimes(1)
  })
})
