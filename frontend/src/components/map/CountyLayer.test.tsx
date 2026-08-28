// @vitest-environment jsdom
//
// Locks the accurate-county-line contract (v0.5.49): with the basemap's
// `openmaptiles` vector source present, CountyLayer draws a dedicated
// admin_level-6 boundary line (z9+) from that source — the true county edge,
// accurate at every zoom — and caps the bundled simplified line at z9 so it only
// covers far-out / the offline fallback. With the vector source absent (a bare
// offline map) the accurate line is omitted and the bundled line stands alone.
// Plain React stubs for react-map-gl — no maplibre-gl, no WebGL.

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import type { ReactNode } from 'react'
import { CountyLayer } from './CountyLayer'
import type { CountyFC } from '../../lib/countyBoundaries'
import type { CountyTiers } from '../../lib/countyShading'
import type { CountyCompletenessView } from '../../lib/countyCompleteness'
import {
  COUNTY_POPUP_FIT_VARS, COUNTY_POPUP_MAX_PX, COUNTY_POPUP_SHEET_ATTR,
} from '../../lib/countyPopupFit'

// jsdom has no real 2D canvas context (it returns null + logs "Not implemented"),
// so the texture-sprite effect's countyHatchImageData would throw on mount. Stub
// a minimal context whose drawing calls no-op — the baked ImageData is unused here
// because addImage is a no-op; this just lets the real sprite path run.
let getContextSpy: ReturnType<typeof vi.spyOn>
beforeAll(() => {
  const fakeCtx = {
    scale: () => {}, clearRect: () => {}, fillRect: () => {}, beginPath: () => {},
    moveTo: () => {}, lineTo: () => {}, stroke: () => {}, getImageData: () => ({}),
  } as unknown as CanvasRenderingContext2D
  getContextSpy = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(fakeCtx)
})
afterAll(() => { getContextSpy.mockRestore() })

const h = vi.hoisted(() => {
  const ctrl = { hasVector: true }
  const layerLog: Record<string, unknown>[] = []
  const sourceLog: Record<string, unknown>[] = []
  const popupLog: Record<string, unknown>[] = []
  // A REAL element, because the popup-containment effect measures this box and
  // publishes onto it. jsdom reports 0x0, which is the "unusable reading" the
  // geometry rejects, so the effect writes today's shipped fallback.
  const container = document.createElement('div')
  const map = {
    getContainer: () => container,
    getLayer: () => undefined,
    getSource: (id: string) => (id === 'openmaptiles' && ctrl.hasVector ? {} : undefined),
    getBounds: () => ({ getWest: () => -123, getSouth: () => 37, getEast: () => -121, getNorth: () => 39 }),
    getCanvas: () => ({ style: {} as Record<string, string> }),
    // The "Use Textures" sprite effect bakes hatch images on mount; no-op the
    // image API so the real registration path runs without a GL map.
    hasImage: () => false,
    addImage: () => {},
    updateImage: () => {},
    on: () => {},
    off: () => {},
    flyTo: () => {},
    queryRenderedFeatures: () => [],
  }
  return { ctrl, layerLog, sourceLog, popupLog, container, map }
})

vi.mock('react-map-gl/maplibre', () => ({
  Source: ({ children, ...props }: { children?: ReactNode } & Record<string, unknown>) => {
    h.sourceLog.push(props)
    return <>{children}</>
  },
  Layer: (props: Record<string, unknown>) => { h.layerLog.push(props); return null },
  Popup: (props: Record<string, unknown>) => { h.popupLog.push(props); return null },
  useMap: () => ({ current: h.map }),
}))

const data = {
  type: 'FeatureCollection',
  features: [{
    type: 'Feature',
    bbox: [-122.5, 37.7, -122.3, 37.85],
    properties: { geoid: '06075', name: 'San Francisco', stusps: 'CA', statefp: '06' },
    geometry: { type: 'Polygon', coordinates: [[[-122.5, 37.7], [-122.3, 37.7], [-122.3, 37.85], [-122.5, 37.85], [-122.5, 37.7]]] },
  }],
} as unknown as CountyFC

const tiers = { tierFor: () => 0 } as unknown as CountyTiers

beforeEach(() => {
  h.layerLog.length = 0; h.sourceLog.length = 0; h.popupLog.length = 0
  h.ctrl.hasVector = true
  h.container.removeAttribute('style')
  h.container.removeAttribute(COUNTY_POPUP_SHEET_ATTR)
})

describe('CountyLayer — accurate boundary lines from the basemap tiles', () => {
  it('adds an admin_level-6 line on the openmaptiles boundary source at z9+, and caps the bundled line at z9', () => {
    render(<CountyLayer data={data} tiers={tiers} metric="species" />)

    const hi = h.layerLog.find(l => l.id === 'sr-county-line-hi')
    expect(hi).toBeTruthy()
    expect(hi?.source).toBe('openmaptiles')
    expect(hi?.['source-layer']).toBe('boundary')
    expect(hi?.minzoom).toBe(9)
    const filter = JSON.stringify(hi?.filter)
    expect(filter).toContain('admin_level')
    expect(filter).toContain('6')

    const bundled = h.layerLog.find(l => l.id === 'sr-county-line')
    expect(bundled?.minzoom).toBe(4)
    expect(bundled?.maxzoom).toBe(9)
  })

  it('omits the accurate line when the basemap vector source is absent (bare offline map), keeping the bundled line as the fallback', () => {
    h.ctrl.hasVector = false
    render(<CountyLayer data={data} tiers={tiers} metric="species" />)
    expect(h.layerLog.find(l => l.id === 'sr-county-line-hi')).toBeUndefined()
    expect(h.layerLog.find(l => l.id === 'sr-county-line')).toBeTruthy()
  })
})

// ── The Completeness metric branch (county-completeness feature) ──────────────

interface SourceFC { data?: { features?: { properties?: { tier?: number } }[] } }

function makeCompletenessView(band: number) {
  const summaryFor = vi.fn(() => ({
    x: 12, y: 300, percent: 4, band, status: 'ready' as const, fromCache: false, fetchedAt: 1,
  }))
  const view: CountyCompletenessView = {
    summaryFor,
    resultFor: vi.fn(() => ({
      x: 12, y: 300, percent: 4, band, status: 'ready' as const, fromCache: false,
      recentNew: [], targets: [], regionResolvable: true,
    })),
    onViewportCounties: vi.fn(),
    requestCounty: vi.fn(),
    ensureCountyForPopup: vi.fn(),
    codeFor: () => undefined,
    hasKey: true,
  }
  return { view, summaryFor }
}

describe('CountyLayer — completeness metric branch', () => {
  it('paints the fixed completeness band as the tier and keeps the fill layer id sr-county-fill', () => {
    const { view, summaryFor } = makeCompletenessView(7)
    render(
      <CountyLayer data={data} shade aggregates={new Map()} tiers={tiers} metric="completeness" completeness={view} />,
    )
    // The load-bearing fill layer id is unchanged in the completeness branch
    // (heatmap re-order + basemap desaturation depend on it, FR-05).
    expect(h.layerLog.find(l => l.id === 'sr-county-fill')).toBeTruthy()
    // The feature tier comes from the controller's fixed band, not the quantile
    // tiers. (Last logged render — the first render precedes the bounds effect.)
    const src = h.sourceLog.filter(s => s.id === 'sr-county').at(-1) as SourceFC | undefined
    expect(src?.data?.features?.[0]?.properties?.tier).toBe(7)
    expect(summaryFor).toHaveBeenCalledWith('CA', 'San Francisco', '06075')
  })

  it('notifies the controller of the in-view counties for the bounded eager fetch (FR-13)', () => {
    const { view } = makeCompletenessView(3)
    render(
      <CountyLayer data={data} shade aggregates={new Map()} tiers={tiers} metric="completeness" completeness={view} />,
    )
    expect(view.onViewportCounties).toHaveBeenCalledTimes(1)
    expect(view.onViewportCounties).toHaveBeenCalledWith([
      { stusps: 'CA', name: 'San Francisco', geoid: '06075' },
    ])
  })

  it('does NOT notify the controller while shading is off', () => {
    const { view } = makeCompletenessView(3)
    render(
      <CountyLayer data={data} aggregates={new Map()} tiers={tiers} metric="completeness" completeness={view} />,
    )
    expect(view.onViewportCounties).not.toHaveBeenCalled()
  })

  it('quantile path parity (FR-06): the count metrics never consult the completeness view', () => {
    const { view, summaryFor } = makeCompletenessView(9)
    const quantileTiers = { tierFor: (v: number) => (v > 0 ? 4 : 0) } as unknown as CountyTiers
    const aggregates = new Map([[
      'CA|san francisco',
      { stateProvince: 'US-CA', county: 'San Francisco', species: 42, records: 10, topSpecies: [], topLocations: [] },
    ]])
    render(
      <CountyLayer data={data} shade aggregates={aggregates} tiers={quantileTiers} metric="species" completeness={view} />,
    )
    const src = h.sourceLog.filter(s => s.id === 'sr-county').at(-1) as SourceFC | undefined
    expect(src?.data?.features?.[0]?.properties?.tier).toBe(4)   // from the quantile tiers
    expect(summaryFor).not.toHaveBeenCalled()                    // completeness untouched
    expect(view.onViewportCounties).not.toHaveBeenCalled()       // no completeness fetches (QA-22)
  })
})

// ── Popup containment wiring (QA-69) ────────────────────────────────────────
//
// The RULE is unit-tested in lib/countyPopupFit.test.ts, against a simulation of
// MapLibre's own anchor selection. What is asserted here is that this component
// is actually WIRED to it: the popup carries the class the stylesheet selects
// on, the ceiling it hands MapLibre matches the stylesheet fallback, and the
// measurement is published on the map container rather than nowhere.

describe('CountyLayer wires the popup to the containment geometry', () => {
  it('names the popup and its body so the stylesheet can reach them', () => {
    const { container } = render(
      <CountyLayer data={data} tiers={tiers} metric="species" shade />,
    )
    // No popup until a county is selected. Open one through the keyboard route:
    // the "Counties in view" disclosure, then a county row inside it.
    const disclosure = container.querySelector('.sr-county-inview button')
    expect(disclosure, 'the Counties in view disclosure is rendered').toBeTruthy()
    fireEvent.click(disclosure!)
    const row = container.querySelector('.sr-inview-row')
    expect(row, 'a county row is offered').toBeTruthy()
    fireEvent.click(row!)

    expect(h.popupLog.length).toBeGreaterThan(0)
    const popup = h.popupLog[h.popupLog.length - 1]
    expect(popup.className).toBe('sr-county-popup')
    // The ceiling handed to MapLibre and the stylesheet's fallback are the same
    // number, so the two can never disagree about the widest it may be.
    expect(popup.maxWidth).toBe(`${COUNTY_POPUP_MAX_PX}px`)
  })

  it('publishes the measurement on the map container', () => {
    render(<CountyLayer data={data} tiers={tiers} metric="species" />)
    // jsdom lays nothing out, so the reading is unusable and the geometry
    // returns the shipped fallback rather than a guess. That is the assertion:
    // an unmeasured map renders exactly as it always did.
    expect(h.container.style.getPropertyValue(COUNTY_POPUP_FIT_VARS.maxWidth))
      .toBe(`${COUNTY_POPUP_MAX_PX}px`)
    expect(h.container.hasAttribute(COUNTY_POPUP_SHEET_ATTR)).toBe(false)
  })
})
