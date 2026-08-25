// @vitest-environment jsdom
//
// color-coded-hotspots, wired through the REAL MapExplorer (the
// MapExplorerSearchThisArea harness shape — maplibre, network, and disk all
// mocked below the component):
//
//   QA-01  the selector exists on the Hotspots panel only, four options;
//   QA-02  (the automatable half) the default is Visited status, and NOTHING
//          mode-related is ever written through the storage seam;
//   QA-06  selecting and switching among default / My species / My checklists
//          issues ZERO requests at the transport seam;
//   QA-19  a re-search keeps the mode active;
//   FR-24  activating a mode auto-reveals the mode legend;
//   FR-26  the in-view list rows carry the active-mode value / state;
//   mode 3 fetches only public hotspots through /map/hotspot-activity, a
//          window flip issues zero further requests (FR-16/QA-17), and the
//          marker layer receives a cls per pin (observed via the stub).
//
// What this file CANNOT prove (per CLAUDE.md): anything geometric or GL —
// pin pixels, sprite rendering, theme re-resolve, pan/zoom jank. Those are
// browser/live checks for The Tester (QA-30/31/32/33).

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, waitFor, fireEvent } from '@testing-library/react'
import type { ReactNode } from 'react'
import type { ObservationEntry } from '../types'

// ── Mocks: everything below the component ────────────────────────────────────

vi.mock('react-map-gl/maplibre', () => ({
  useMap: () => ({ current: null }),
  Marker: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  Popup: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}))
vi.mock('./SnowMap', () => ({ SnowMap: ({ children }: { children?: ReactNode }) => <div data-testid="snowmap">{children}</div> }))
vi.mock('./AtlasLayer', () => ({ AtlasLayer: () => null }))
vi.mock('./map/CountyLayer', () => ({ CountyLayer: () => null }))
vi.mock('./map/SightingMarkers', () => ({ SightingMarkers: () => null }))
vi.mock('./map/TargetMarkers', () => ({ TargetMarkers: () => null }))
vi.mock('./map/NearbyLiferMarkers', () => ({ NearbyLiferMarkers: () => null }))
vi.mock('./map/BasemapDesaturation', () => ({ BasemapDesaturation: () => null }))
vi.mock('./map/SharePopup', () => ({ SharePopup: () => null }))
vi.mock('./map/SharePin', () => ({ SharePin: () => null }))
vi.mock('./map/SearchedAreaLayer', () => ({ SearchedAreaLayer: () => null }))
vi.mock('./map/MapControls', () => ({
  MapEffects: () => null,
  BoundsTracker: () => null,
  DetectedLocationPin: () => null,
  CenterPinDropper: () => null,
  CenterPin: () => null,
}))

/** The marker layer is stubbed so the cls map handed to it is observable. */
const markerProps = vi.hoisted(() => ({ modeCls: undefined as ReadonlyMap<string, string> | null | undefined }))
vi.mock('./map/HotspotMarkers', () => ({
  HotspotMarkers: ({ modeCls }: { modeCls?: ReadonlyMap<string, string> | null }) => {
    markerProps.modeCls = modeCls
    return null
  },
}))

vi.mock('../lib/useHotspotSet', () => ({ useHotspotSet: () => ({ isHotspot: () => true }) }))
vi.mock('../lib/useCountyCompleteness', async (orig) => ({
  ...(await orig<Record<string, unknown>>()),
  useCountyCompleteness: () => null,
}))

const net = vi.hoisted(() => ({
  calls: [] as { path: string; params?: Record<string, string> }[],
}))
vi.mock('../lib/transport', () => ({
  transport: {
    get: vi.fn(async (path: string, params?: Record<string, string>) => {
      net.calls.push({ path, params })
      if (path === '/map/hotspots') return HOTSPOT_ROWS
      if (path === '/map/hotspot-activity') {
        return {
          locId: params?.locId,
          species: params?.locId === 'L9'
            ? [
                { speciesCode: 'a1', obsDt: '2026-08-24 08:00' },
                { speciesCode: 'a2', obsDt: '2026-08-20 07:00' },
              ]
            : [],
        }
      }
      return []
    }),
    post: vi.fn(async () => ({ codes: {} })),
  },
  TransportError: class extends Error {},
}))
import { transport } from '../lib/transport'

const settingWrites = vi.hoisted(() => ({ calls: [] as unknown[][] }))
vi.mock('../lib/storage', () => ({
  storage: {
    getApiKey: vi.fn(async () => 'k'),
    getSetting: vi.fn(async () => null),
    setSetting: vi.fn(async (...args: unknown[]) => { settingWrites.calls.push(args) }),
    getFilesStatus: vi.fn(async () => ({ ebird: true, ml: true })),
  },
}))

// The backup: two species at L1 — one countable, one spuh — so mode 1 reads 1
// and mode 2 reads 2 (two checklists) at the visited hotspot.
const OBS: ObservationEntry[] = [
  {
    submissionId: 'S1', commonName: "Steller's Jay", scientificName: 'Cyanocitta stelleri',
    date: '2026-05-01', location: 'Tilden Park', locationId: 'L1',
    latitude: 37.9, longitude: -122.24, county: 'Alameda',
    count: 2, breedingCode: null, speciesComments: '', catalogIds: [],
    stateProvince: 'US-CA',
  },
  {
    submissionId: 'S2', commonName: 'gull sp.', scientificName: '',
    date: '2026-05-02', location: 'Tilden Park', locationId: 'L1',
    latitude: 37.9, longitude: -122.24, county: 'Alameda',
    count: 1, breedingCode: null, speciesComments: '', catalogIds: [],
    stateProvince: 'US-CA',
  },
]
vi.mock('../lib/observationsCache', () => ({
  loadEbirdObservations: vi.fn(async () => ({ observations: OBS })),
}))
vi.mock('../lib/mlExportCache', () => ({
  loadMLExport: vi.fn(async () => ({ rows: [{ format: 'Photo' }], mediaMap: {} })),
}))

import { MapExplorer } from './MapExplorer'
import * as activityCache from '../lib/hotspotActivityCache'
import {
  ACTIVITY_START_SPACING_DEFAULT_MS, _setActivityStartSpacingMsForTests,
} from '../lib/rateLimit'

// L1 is in the backup (visited); L9 is unvisited public.
const HOTSPOT_ROWS = [
  { locId: 'L1', locName: 'Tilden Park', lat: 37.9, lng: -122.24 },
  { locId: 'L9', locName: 'Cesar Chavez Park', lat: 37.87, lng: -122.32 },
]

function renderMap() {
  return render(
    <MapExplorer
      onGoToSettings={() => {}}
      onNavigateToMediaList={() => {}}
      keysVersion={0}
      isFullscreen={false}
      onToggleFullscreen={() => {}}
      onOpenSpecies={() => {}}
    />,
  )
}

const getCalls = () => (transport.get as ReturnType<typeof vi.fn>).mock.calls
const activityCalls = () => net.calls.filter(c => c.path === '/map/hotspot-activity')

async function ready() {
  await waitFor(() => expect(document.querySelector('.sr-map-fab-cluster')).toBeTruthy())
}

async function goToHotspots() {
  fireEvent.click(screen.getByRole('button', { name: 'Hotspots' }))
  await waitFor(() => expect(screen.queryByRole('button', { name: 'Use my location' })).toBeTruthy())
}

async function runSearch() {
  fireEvent.change(screen.getByLabelText('Latitude'), { target: { value: '37.88' } })
  fireEvent.change(screen.getByLabelText('Longitude'), { target: { value: '-122.3' } })
  fireEvent.click(screen.getByRole('button', { name: 'Find Hotspots' }))
  await waitFor(() => expect(screen.getByRole('button', { name: /Tilden Park/ })).toBeTruthy())
}

beforeEach(() => {
  net.calls.length = 0
  settingWrites.calls.length = 0
  markerProps.modeCls = undefined
  activityCache._resetHotspotActivityCacheForTests()
  // This file asserts mode WIRING (which requests, which cls map) on real
  // timers with instant responses — zero the request-start spacing so those
  // contracts stay timing-independent. The pacing itself is covered on fake
  // timers in useHotspotActivity.test.ts.
  _setActivityStartSpacingMsForTests(0)
})
afterEach(() => {
  cleanup()
  activityCache._resetHotspotActivityCacheForTests()
  _setActivityStartSpacingMsForTests(ACTIVITY_START_SPACING_DEFAULT_MS)
  vi.clearAllMocks()
})

describe('the selector (QA-01 / QA-02)', () => {
  it('exists on the Hotspots panel with four options, defaulting to Visited status', async () => {
    renderMap()
    await ready()
    await goToHotspots()
    expect(screen.getByText('Color pins by')).toBeTruthy()
    for (const label of ['Visited status', 'My species', 'My checklists', 'Recent activity']) {
      expect(screen.getByRole('button', { name: label })).toBeTruthy()
    }
    expect(screen.getByRole('button', { name: 'Visited status' }).getAttribute('aria-pressed')).toBe('true')
  })

  it('does not exist on My Sightings, Media Targets, or Nearby Lifers (FR-04)', async () => {
    renderMap()
    await ready()
    expect(screen.queryByText('Color pins by')).toBeNull()
    for (const view of ['Media Targets', 'Nearby Lifers'] as const) {
      fireEvent.click(screen.getByRole('button', { name: view }))
      await waitFor(() => expect(screen.queryByRole('button', { name: 'Use my location' })).toBeTruthy())
      expect(screen.queryByText('Color pins by')).toBeNull()
    }
  })

  it('never writes anything mode-related through the storage seam (FR-02)', async () => {
    renderMap()
    await ready()
    await goToHotspots()
    await runSearch()
    fireEvent.click(screen.getByRole('button', { name: 'My species' }))
    fireEvent.click(screen.getByRole('button', { name: 'My checklists' }))
    fireEvent.click(screen.getByRole('button', { name: 'Recent activity' }))
    await waitFor(() => expect(activityCalls().length).toBeGreaterThan(0))
    // The activity CACHE persists through the seam (its own key); no OTHER
    // write exists, and no write carries the mode or window selection.
    for (const [key, value] of settingWrites.calls as [string, unknown][]) {
      expect(key).toBe(activityCache.HOTSPOT_ACTIVITY_STORE_KEY)
      expect(JSON.stringify(value)).not.toMatch(/mySpecies|myChecklists|activity|Visited status/)
    }
  })
})

describe('modes 1/2 are offline (FR-07, QA-06)', () => {
  it('selecting and switching among default / My species / My checklists issues zero requests', async () => {
    renderMap()
    await ready()
    await goToHotspots()
    await runSearch()
    const before = getCalls().length
    fireEvent.click(screen.getByRole('button', { name: 'My species' }))
    fireEvent.click(screen.getByRole('button', { name: 'My checklists' }))
    fireEvent.click(screen.getByRole('button', { name: 'Visited status' }))
    fireEvent.click(screen.getByRole('button', { name: 'My species' }))
    // Give any wrongly-scheduled fetch a tick to surface.
    await new Promise(r => setTimeout(r, 30))
    expect(getCalls().length).toBe(before)
  })

  it('mode 1 colors public pins and hands the layer a cls map; default hands null (FR-03)', async () => {
    renderMap()
    await ready()
    await goToHotspots()
    await runSearch()
    expect(markerProps.modeCls).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'My species' }))
    await waitFor(() => expect(markerProps.modeCls).not.toBeNull())
    const cls = markerProps.modeCls!
    // L1: 1 countable species (the spuh is excluded) → the single-class ramp.
    expect(cls.get('L1')).toBe('t1-visited')
    // L9: never birded → nodata.
    expect(cls.get('L9')).toBe('nodata')
    fireEvent.click(screen.getByRole('button', { name: 'Visited status' }))
    await waitFor(() => expect(markerProps.modeCls).toBeNull())
  })

  it('the in-view list rows carry the value / state while a mode is active (FR-26)', async () => {
    renderMap()
    await ready()
    await goToHotspots()
    await runSearch()
    fireEvent.click(screen.getByRole('button', { name: 'My species' }))
    const row = await screen.findByRole('button', { name: /Tilden Park/ })
    expect(row.textContent).toContain('1')
    // Scope to the in-view list: the Nearest Unvisited section also renders a
    // Cesar Chavez Park button (unchanged by the mode — its rows carry no value).
    const inview = document.getElementById('sr-inview-hotspots')!
    const unvisitedRow = [...inview.querySelectorAll('button')].find(b => /Cesar Chavez Park/.test(b.textContent ?? ''))!
    expect(unvisitedRow.textContent).toContain('not birded')
  })

  it('the mode legend auto-reveals with title, class range, states, and the personal entry (FR-24)', async () => {
    renderMap()
    await ready()
    await goToHotspots()
    await runSearch()
    fireEvent.click(screen.getByRole('button', { name: 'My species' }))
    expect(screen.getByText('My species', { selector: 'span' })).toBeTruthy()
    expect(screen.getByText(/your countable species per hotspot, this search/)).toBeTruthy()
    expect(screen.getByText('Not birded by you')).toBeTruthy()
    expect(screen.getByText('Personal location')).toBeTruthy()
    expect(screen.getByText(/Glyphs carry the kind while a mode is active/)).toBeTruthy()
  })
})

describe('mode 3 (FR-11 / FR-16)', () => {
  it('fetches activity for the result set, colors by the answers, and a window flip issues zero further requests', async () => {
    renderMap()
    await ready()
    await goToHotspots()
    await runSearch()
    fireEvent.click(screen.getByRole('button', { name: 'Recent activity' }))
    await waitFor(() => expect(activityCalls().length).toBe(2))
    expect(activityCalls().map(c => c.params?.locId).sort()).toEqual(['L1', 'L9'])
    // L9 answered 2 species → ramp; L1 answered 0 → quiet.
    await waitFor(() => {
      const cls = markerProps.modeCls
      expect(cls?.get('L9')).toBe('t1-unvisited')
      expect(cls?.get('L1')).toBe('quiet-visited')
    })
    const before = getCalls().length
    fireEvent.click(screen.getByRole('button', { name: '30 days' }))
    await new Promise(r => setTimeout(r, 30))
    expect(getCalls().length).toBe(before)
    // The quiet pin stays quiet in the 30-day window too (0 either way).
    expect(markerProps.modeCls?.get('L1')).toBe('quiet-visited')
  })

  it('a re-search keeps the mode active and re-colors the new set (FR-18/QA-19)', async () => {
    renderMap()
    await ready()
    await goToHotspots()
    await runSearch()
    fireEvent.click(screen.getByRole('button', { name: 'Recent activity' }))
    await waitFor(() => expect(activityCalls().length).toBe(2))
    fireEvent.click(screen.getByRole('button', { name: 'Find Hotspots' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Recent activity' }).getAttribute('aria-pressed')).toBe('true'))
    // Cache answers the same locIds — no additional activity requests needed.
    await new Promise(r => setTimeout(r, 30))
    expect(activityCalls().length).toBe(2)
    expect(markerProps.modeCls).not.toBeNull()
  })
})
