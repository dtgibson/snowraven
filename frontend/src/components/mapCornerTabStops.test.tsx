// @vitest-environment jsdom
//
// feature: map-fab-keyboard-reachable — every map corner control is an EXPLICIT
// tab stop.
//
// WHY THIS FILE EXISTS. WebKit's default tab mode (Safari with macOS "Keyboard
// navigation" off, which is the default and what WKWebView follows, so it is
// what the shipped Mac and iOS apps get) visits only explicitly-tabindexed
// elements, native form controls and <summary>. A plain <button> is skipped
// entirely. Every control below is a real <button>, so on those two platforms
// none of them was reachable by keyboard at all until this fix. The measurement
// is written up in lib/useFocusTrap.ts's header and in DECISIONS.md (v1.0.15).
//
// WHAT THIS TEST PROVES: that the literal `tabindex="0"` attribute is present on
// every corner control, on the Map Explorer cluster (both the My Sightings row
// and the centre-view row), on an embedded corner row, and on the Atlas
// "blocks in view" panel that ACCESSIBILITY.md publishes as the keyboard
// substitute for the pointer-only canvas markers.
//
// WHAT IT CANNOT PROVE, and is NOT evidence for: that WebKit's real tab order
// now reaches them. jsdom has NO tab order at all (lib/useFocusTrap.ts:50 and
// .claude/rules/ui.md say so outright), so a test that walked a reproduced tab
// order here would only re-assert the broken assumption this whole defect came
// from. The attribute IS the property that makes the engine's order irrelevant,
// so the attribute is what is asserted. The engine-level claim is a browser
// measurement, written up in
// pipeline/map-fab-keyboard-reachable/pr-description.md.
//
// SHAPE: one ROSTER, one template (.claude/rules/testing.md, v1.0.14). The six
// source sites the fix touched are rows, so a seventh corner control added
// without a tabIndex reads as a MISSING ROW rather than as nothing at all. The
// per-surface "every button in this container" assertions below the roster are
// the closed half: they fail on a new unmarked control that nobody remembered to
// add a row for.

import { describe, it, expect, vi, beforeAll, afterAll, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, waitFor, fireEvent } from '@testing-library/react'
import { useRef, type ReactNode } from 'react'
import type { ObservationEntry } from '../types'
import type { AtlasData } from '../lib/atlasBlocks'

// ── The map double ───────────────────────────────────────────────────────────
//
// `useMap()` is read through a MUTABLE ref so one file can host both postures:
// null for the Map Explorer renders (the shipped harness in
// MapExplorerLocateFab.test.tsx uses null, which leaves the pin and the gestures
// inert), and the fake map for the embedded corner row and the Atlas panel,
// neither of which renders anything without one.
type Handler = (e: unknown) => void
const h = vi.hoisted(() => {
  const handlers = {} as Record<string, Handler[]>
  const canvas = { isConnected: true, style: {} as Record<string, string>, focus() {} }
  const gesture = (initial: boolean) => {
    const state = { on: initial }
    return { enable: () => { state.on = true }, disable: () => { state.on = false }, isEnabled: () => state.on }
  }
  const rawMap = { scrollZoom: gesture(false), cooperativeGestures: gesture(true) }
  const map = {
    on: (ev: string, ...rest: unknown[]) => { (handlers[ev] ||= []).push(rest[rest.length - 1] as Handler) },
    off: () => {},
    getCenter: () => ({ lat: 37.8, lng: -122.44 }),
    getCanvas: () => canvas,
    getContainer: () => ({ clientHeight: 320 }),
    project: () => ({ x: 0, y: 160 }),
    resize: () => {},
    getMap: () => rawMap,
    getBounds: () => ({ getWest: () => -123, getSouth: () => 37, getEast: () => -121, getNorth: () => 39 }),
    getLayer: () => undefined,
    hasImage: () => false,
    addImage: () => {},
    updateImage: () => {},
    queryRenderedFeatures: () => [],
    flyTo: () => {},
  }
  return { handlers, map, ref: { current: null as unknown } }
})

vi.mock('react-map-gl/maplibre', () => ({
  useMap: () => h.ref,
  Marker: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  Popup: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  Source: ({ children }: { children?: ReactNode }) => <>{children}</>,
  Layer: () => null,
}))

// ── Everything below the components (network, disk, the heavy map children) ──
vi.mock('./SnowMap', () => ({ SnowMap: ({ children }: { children?: ReactNode }) => <div data-testid="snowmap">{children}</div> }))
vi.mock('./map/CountyLayer', () => ({ CountyLayer: () => null }))
vi.mock('./map/SightingMarkers', () => ({ SightingMarkers: () => null }))
vi.mock('./map/HotspotMarkers', () => ({ HotspotMarkers: () => null }))
vi.mock('./map/TargetMarkers', () => ({ TargetMarkers: () => null }))
vi.mock('./map/NearbyLiferMarkers', () => ({ NearbyLiferMarkers: () => null }))
vi.mock('./map/BasemapDesaturation', () => ({ BasemapDesaturation: () => null }))
vi.mock('./map/SharePopup', () => ({ SharePopup: () => null }))
vi.mock('./map/MapControls', () => ({
  MapEffects: () => null, BoundsTracker: () => null, DetectedLocationPin: () => null,
  CenterPinDropper: () => null, CenterPin: () => null,
}))
vi.mock('../lib/useHotspotSet', () => ({ useHotspotSet: () => ({ isPublicHotspot: () => false }) }))
vi.mock('../lib/useCountyCompleteness', () => ({
  useCountyCompleteness: () => ({
    summaryFor: () => null, resultFor: () => null,
    onViewportCounties: () => {}, requestCounty: () => {},
  }),
  EBIRD_NO_KEY_MESSAGE: 'no key',
}))
vi.mock('../lib/transport', () => ({
  transport: { get: vi.fn().mockResolvedValue([]), post: vi.fn().mockResolvedValue({ codes: {} }) },
  TransportError: class extends Error {},
}))
vi.mock('../lib/clipboard', () => ({ copyText: vi.fn().mockResolvedValue(true) }))
vi.mock('../lib/storage', () => ({
  storage: {
    getApiKey: vi.fn().mockResolvedValue('k'),
    getSetting: vi.fn().mockResolvedValue(null),
    setSetting: vi.fn().mockResolvedValue(undefined),
    getFilesStatus: vi.fn(async () => ({ ebird: true, ml: true })),
  },
}))
const OBS: ObservationEntry[] = [{
  submissionId: 'S1', commonName: "Steller's Jay", scientificName: 'Cyanocitta stelleri',
  date: '2026-05-01', location: 'Tilden Park', locationId: 'L1',
  latitude: 37.9, longitude: -122.24, county: 'Alameda',
  count: 2, breedingCode: null, speciesComments: '', catalogIds: [],
  stateProvince: 'US-CA',
}]
vi.mock('../lib/observationsCache', () => ({ loadEbirdObservations: vi.fn(async () => ({ observations: OBS })) }))
vi.mock('../lib/mlExportCache', () => ({ loadMLExport: vi.fn(async () => ({ rows: [{ format: 'Photo' }], mediaMap: {} })) }))

import { MapExplorer } from './MapExplorer'
import { AtlasLayer } from './AtlasLayer'
import { MapCornerControls } from './map/MapCornerControls'
import { useMapFullscreen, MapFullscreenProvider } from '../lib/useMapFullscreen'

// jsdom has no real 2D context, so AtlasLayer's hatch-sprite bake would throw on
// mount. Same stub CountyLayer.test.tsx uses; the baked ImageData is unused here
// because addImage is a no-op.
let getContextSpy: ReturnType<typeof vi.spyOn>
beforeAll(() => {
  const fakeCtx = {
    scale: () => {}, clearRect: () => {}, fillRect: () => {}, beginPath: () => {},
    moveTo: () => {}, lineTo: () => {}, stroke: () => {}, arc: () => {},
    fill: () => {}, getImageData: () => ({}),
  } as unknown as CanvasRenderingContext2D
  getContextSpy = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(fakeCtx)
})
afterAll(() => { getContextSpy.mockRestore() })

beforeEach(() => {
  for (const k of Object.keys(h.handlers)) delete h.handlers[k]
  h.ref.current = null
})
afterEach(() => { cleanup(); vi.clearAllMocks() })

// ── The three surfaces, each mounted the way its own suite already mounts it ──

const cluster = () => document.querySelector('.sr-map-fab-cluster') as HTMLElement | null

/** The Map Explorer, on My Sightings (`view` null) or on a centre view. */
async function mountExplorer(view?: 'Hotspots' | 'Media Targets' | 'Nearby Lifers') {
  render(
    <MapExplorer
      onGoToSettings={() => {}}
      onNavigateToMediaList={() => {}}
      keysVersion={0}
      isFullscreen={false}
      onToggleFullscreen={() => {}}
      onOpenSpecies={() => {}}
    />,
  )
  await waitFor(() => expect(cluster()).toBeTruthy())
  if (view) {
    fireEvent.click(screen.getByRole('button', { name: view }))
    await waitFor(() => expect(cluster()!.querySelector('.sr-map-center-share-btn')).toBeTruthy())
  }
  return cluster()!
}

/** One embedded map's corner row, in the shape of the four real mounts. */
function EmbeddedHost() {
  const ref = useRef<HTMLDivElement>(null)
  const fs = useMapFullscreen({ containerRef: ref, baseClass: 'sr-map-container' })
  return (
    <div ref={ref} className={fs.className}>
      <MapFullscreenProvider value={fs}><MapCornerControls compact={false} /></MapFullscreenProvider>
    </div>
  )
}

function mountCornerRow() {
  h.ref.current = h.map
  render(<EmbeddedHost />)
  return document.querySelector('.sr-map-corner-row') as HTMLElement
}

// One quad on the regular 0.125 degree grid: six blocks, all inside the fake
// map's bounds, well under the list cap.
const ATLAS: AtlasData = {
  scheme: {
    cols: 2, rows: 3, quadLat: 0.125, quadLng: 0.125,
    positions: [['SW', 'SE'], ['CW', 'CE'], ['NW', 'NE']],
  },
  quads: [{ sw: [37.75, -122.5], name: 'San Francisco North', id: '37122A1' }],
  irregular: [],
}

/** The Atlas "blocks in view" panel, opened. */
function mountAtlasList() {
  h.ref.current = h.map
  render(<AtlasLayer data={ATLAS} />)
  const panel = document.querySelector('.sr-atlas-blocklist') as HTMLElement
  expect(panel, 'the Atlas blocks-in-view panel renders').toBeTruthy()
  // The rows only exist once the disclosure is open, which is also the only
  // state in which they are meant to be tab stops.
  fireEvent.click(panel.querySelector('button')!)
  return panel
}

// ── The roster ───────────────────────────────────────────────────────────────

interface Row {
  /** The source file and line the fix touched. */
  site: string
  control: string
  /** Mounts the surface and returns every element that must be a tab stop. */
  mount: () => Promise<HTMLElement[]> | HTMLElement[]
}

const all = (root: HTMLElement, sel: string) => Array.from(root.querySelectorAll<HTMLElement>(sel))

const ROSTER: Row[] = [
  {
    site: 'components/map/SharePin.tsx',
    control: 'the share / drop-a-pin FAB (one button, five surfaces)',
    mount: async () => all(await mountExplorer(), '.sr-share-drop-btn'),
  },
  {
    site: 'components/MapExplorer.tsx',
    control: 'the location FAB',
    mount: async () => all(await mountExplorer(), '.sr-map-locate-btn'),
  },
  {
    site: 'components/MapExplorer.tsx',
    control: 'the centre-share FAB (the three centre views)',
    mount: async () => all(await mountExplorer('Hotspots'), '.sr-map-center-share-btn'),
  },
  {
    site: 'components/map/MapCornerControls.tsx',
    control: 'the embedded map fullscreen toggle (four mounts)',
    mount: () => all(mountCornerRow(), '.sr-map-fullscreen-btn'),
  },
  {
    site: 'components/AtlasLayer.tsx',
    control: 'the Atlas blocks-in-view disclosure',
    mount: () => [mountAtlasList().querySelector('button')!],
  },
  {
    site: 'components/AtlasLayer.tsx',
    control: 'the Atlas blocks-in-view rows',
    mount: () => all(mountAtlasList(), '.sr-inview-row'),
  },
]

describe('every map corner control carries an explicit tabindex="0"', () => {
  for (const row of ROSTER) {
    it(`${row.control} — ${row.site}`, async () => {
      const els = await row.mount()
      // Per-row non-vacuity: a row whose selector stops matching must fail
      // loudly rather than pass over an empty list.
      expect(els.length, `${row.control} was not rendered`).toBeGreaterThan(0)
      for (const el of els) {
        expect(el.tagName, row.control).toBe('BUTTON')
        // The LITERAL attribute, not the `tabIndex` IDL property: the property
        // reads 0 on a plain <button> too, which is exactly the state that is
        // unreachable in WebKit's default tab mode.
        expect(el.getAttribute('tabindex'), row.control).toBe('0')
      }
    })
  }
})

// ── The closed half ──────────────────────────────────────────────────────────
//
// The roster localizes a regression to one site; these three catch the case the
// roster structurally cannot — a NEW control added to one of these containers
// that nobody wrote a row for.

describe('no control on a map corner is left without one', () => {
  it('the Map Explorer cluster, My Sightings (share, location, fullscreen, Filters)', async () => {
    const buttons = all(await mountExplorer(), 'button')
    expect(buttons.map(b => b.className.split(/\s+/)[0])).toEqual([
      'sr-map-fab', 'sr-map-fab', 'sr-map-fab', 'sr-map-filters-btn',
    ])
    for (const b of buttons) expect(b.getAttribute('tabindex'), b.className).toBe('0')
  })

  it('the Map Explorer cluster, a centre view (centre-share replaces the drop button)', async () => {
    const buttons = all(await mountExplorer('Nearby Lifers'), 'button')
    expect(buttons.length).toBeGreaterThanOrEqual(3)
    expect(buttons.some(b => b.classList.contains('sr-map-center-share-btn'))).toBe(true)
    for (const b of buttons) expect(b.getAttribute('tabindex'), b.className).toBe('0')
  })

  it('an embedded corner row (share then fullscreen)', () => {
    const buttons = all(mountCornerRow(), 'button')
    expect(buttons).toHaveLength(2)
    expect(buttons[0].classList.contains('sr-share-drop-btn')).toBe(true)
    expect(buttons[1].classList.contains('sr-map-fullscreen-btn')).toBe(true)
    for (const b of buttons) expect(b.getAttribute('tabindex'), b.className).toBe('0')
  })

  it('the Atlas blocks-in-view panel, which is the ONLY keyboard route to a block', () => {
    const buttons = all(mountAtlasList(), 'button')
    // The disclosure plus one row per block in view.
    expect(buttons.length).toBe(1 + 6)
    for (const b of buttons) expect(b.getAttribute('tabindex'), b.className).toBe('0')
  })
})
