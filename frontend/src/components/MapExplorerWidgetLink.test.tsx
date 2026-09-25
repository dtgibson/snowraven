// @vitest-environment jsdom
//
// feature: ios-lifer-widgets -- the tap-through from a home-screen widget into
// the Map Explorer (FR-36 to FR-38, FR-52; QA-36, QA-37, QA-38, QA-58).
//
// Driven through the REAL MapExplorer with the same outer seams mocked as the
// location-FAB suite (maplibre, SnowMap, transport, storage, the parse caches),
// and the location seam driven per test. A link request is what App.tsx passes
// after the link controller has parsed a URL against the allowlist, so every
// row here starts from an already-parsed link.
//
// The chips carry no pressed state in the DOM (a pre-existing gap, not this
// feature's), so the chip state is read the way a user reads it: the
// "N species" count the Filter by Type row prints over two target pins whose
// missing media differ.
//
// App's half -- a new link id switches to the Map Explorer once, whatever the
// saved layout hides, and the controllers boot on iOS only through import() --
// is a source-level roster at the bottom, because App is not rendered whole by
// any suite in this repo.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, waitFor } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { ReactNode } from 'react'
import type { ObservationEntry } from '../types'
import type { PendingLink } from '../lib/links/linkRequest'

vi.mock('react-map-gl/maplibre', () => ({
  useMap: () => ({ current: null }),
  Marker: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  Popup: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  Source: ({ children }: { children?: ReactNode }) => <>{children}</>,
  Layer: () => null,
}))
vi.mock('./SnowMap', () => ({ SnowMap: ({ children }: { children?: ReactNode }) => <div data-testid="snowmap">{children}</div> }))
vi.mock('./AtlasLayer', () => ({ AtlasLayer: () => null }))
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
vi.mock('../lib/useHotspotSet', () => ({ useHotspotSet: () => ({ isPublicHotspot: () => false, isHotspot: () => false }) }))
vi.mock('../lib/useCountyCompleteness', () => ({
  useCountyCompleteness: () => ({
    summaryFor: () => null, resultFor: () => null,
    onViewportCounties: () => {}, requestCounty: () => {},
  }),
  EBIRD_NO_KEY_MESSAGE: 'no key',
}))

const today = (() => {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} 07:00`
})()
const pin = (speciesCode: string, comName: string) => ({
  speciesCode, comName, locId: `L-${speciesCode}`, locName: 'Tilden Park', lat: 37.9, lng: -122.24,
  recentDate: today, checklistCount: 1, subId: 'S1',
})

vi.mock('../lib/transport', () => ({
  transport: {
    // Honors `codes` as the route does: Media Targets sends its target codes,
    // Nearby Lifers sends none and gets every species in the radius.
    get: vi.fn(async (path: string, params?: { codes?: string }) => {
      if (path !== '/map/recent-obs') return []
      const all = [pin('stejay', "Steller's Jay"), pin('wrenti', 'Wrentit'), pin('ruff', 'Ruff')]
      const codes = params?.codes ? new Set(params.codes.split(',')) : null
      return codes ? all.filter(p => codes.has(p.speciesCode)) : all
    }),
    post: vi.fn(async () => ({ codes: { "Steller's Jay": 'stejay', Wrentit: 'wrenti' } })),
  },
  TransportError: class extends Error {},
}))
import { transport } from '../lib/transport'

const world = vi.hoisted(() => ({
  files: { ebird: true, ml: true } as { ebird: boolean; ml: boolean },
  key: 'k' as string | null,
}))
vi.mock('../lib/storage', () => ({
  storage: {
    getApiKey: vi.fn(async () => world.key),
    getSetting: vi.fn().mockResolvedValue(null),
    setSetting: vi.fn().mockResolvedValue(undefined),
    getFilesStatus: vi.fn(async () => world.files),
  },
}))
import { storage } from '../lib/storage'

const geo = vi.hoisted(() => ({ impl: null as null | (() => Promise<{ lat: number; lng: number }>) }))
vi.mock('../lib/location', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/location')>()
  return { ...actual, getCurrentLocation: vi.fn(() => geo.impl!()) }
})

const OBS = (name: string): ObservationEntry => ({
  submissionId: 'S1', commonName: name, scientificName: 'x', date: '2026-05-01', location: 'Tilden Park',
  locationId: 'L1', latitude: 37.9, longitude: -122.24, county: 'Alameda', count: 1, breedingCode: null,
  speciesComments: '', catalogIds: [], stateProvince: 'US-CA',
})
const obs = vi.hoisted(() => ({ gate: null as null | Promise<void> }))
vi.mock('../lib/observationsCache', () => ({
  loadEbirdObservations: vi.fn(async () => {
    if (obs.gate) await obs.gate
    return { headerLine: '', observations: [OBS("Steller's Jay"), OBS('Wrentit')] }
  }),
}))
// Steller's Jay holds a Photo (missing Audio and Video); Wrentit holds Audio
// (missing Photo and Video).
vi.mock('../lib/mlExportCache', () => ({
  loadMLExport: vi.fn(async () => ({
    rows: [{ commonName: "Steller's Jay", format: 'Photo' }, { commonName: 'Wrentit', format: 'Audio' }],
    mediaMap: {},
  })),
}))

import { describeLocationError } from '../lib/location'
import { MapExplorer } from './MapExplorer'

const HERE = { lat: 37.87654, lng: -122.25432 }

function renderMap(link: PendingLink | undefined, onApplied = vi.fn()) {
  const view = render(
    <MapExplorer
      onGoToSettings={() => {}}
      onNavigateToMediaList={() => {}}
      keysVersion={0}
      isFullscreen={false}
      onToggleFullscreen={() => {}}
      linkRequest={link}
      onLinkRequestApplied={onApplied}
    />,
  )
  return { ...view, onApplied }
}

const recentObsCalls = () => (transport.get as ReturnType<typeof vi.fn>).mock.calls.filter(c => c[0] === '/map/recent-obs')
const pressed = (name: string) => screen.getAllByRole('button', { name }).some(b => b.getAttribute('aria-pressed') === 'true')

beforeEach(() => {
  world.files = { ebird: true, ml: true }
  world.key = 'k'
  obs.gate = null
  geo.impl = async () => HERE
  vi.clearAllMocks()
})
afterEach(() => cleanup())

describe('a widget link applies view, window, media, radius and one search from here (FR-36)', () => {
  it('Media Targets, Day, Photo: the targets view, the Photo chip alone, radius 25, one search from the device position', async () => {
    const { onApplied } = renderMap({ view: 'targets', window: 'day', media: 'photo', id: 1 })
    await waitFor(() => expect(recentObsCalls()).toHaveLength(1))
    const [, params] = recentObsCalls()[0]!
    expect(params).toMatchObject({ lat: String(HERE.lat), lng: String(HERE.lng), dist: String(Math.round(25 * 1.60934)) })
    expect(pressed('Media Targets')).toBe(true)
    expect(pressed('25 mi')).toBe(true)
    expect(onApplied).toHaveBeenCalledWith(1)
    // The Photo chip alone: of Steller's Jay (has a photo) and Wrentit (lacks
    // one), only Wrentit is listed.
    await waitFor(() => expect(screen.getByText('1 species')).toBeTruthy())
    await waitFor(() => expect(pressed('Day')).toBe(true))
    // The radius is SESSION state: the saved Default Location is never written.
    expect(storage.setSetting).not.toHaveBeenCalledWith('map-defaults', expect.anything())
  })

  it.each([
    ['any', 2], ['video', 2], ['audio', 1], ['photo', 1],
  ] as const)('media %s lands on the matching chips (%i of 2 listed) (FR-52, QA-58)', async (media, n) => {
    renderMap({ view: 'targets', window: 'week', media, id: 1 })
    await waitFor(() => expect(recentObsCalls()).toHaveLength(1))
    await waitFor(() => expect(screen.getByText(`${n} species`)).toBeTruthy())
  })

  it('Nearby Lifers, 30 days: the lifers view, the 30 days window, radius 25, one search', async () => {
    renderMap({ view: 'lifers', window: 'all', id: 1 })
    await waitFor(() => expect(recentObsCalls()).toHaveLength(1))
    expect(recentObsCalls()[0]![1]).toMatchObject({ dist: '40' })
    expect(recentObsCalls()[0]![1]).not.toHaveProperty('codes')
    expect(pressed('Nearby Lifers')).toBe(true)
    await waitFor(() => expect(pressed('30 days')).toBe(true))
  })

  it('a second tap with the same values is a new id and searches again; a re-render with the same id does not', async () => {
    const onApplied = vi.fn()
    const { rerender } = renderMap({ view: 'lifers', window: 'day', id: 1 }, onApplied)
    await waitFor(() => expect(recentObsCalls()).toHaveLength(1))
    const again = (id: number) => (
      <MapExplorer onGoToSettings={() => {}} onNavigateToMediaList={() => {}} keysVersion={0}
        linkRequest={{ view: 'lifers', window: 'day', id }} onLinkRequestApplied={onApplied} />
    )
    rerender(again(1))
    await new Promise(r => setTimeout(r, 20))
    expect(recentObsCalls()).toHaveLength(1)
    rerender(again(2))
    await waitFor(() => expect(recentObsCalls()).toHaveLength(2))
    expect(onApplied.mock.calls.map(c => c[0])).toEqual([1, 2])
  })
})

describe('cold start and degraded outcomes (FR-37, FR-38)', () => {
  it('a link that arrives before the backup has loaded waits, then searches once', async () => {
    let release!: () => void
    obs.gate = new Promise(r => { release = r })
    const { onApplied } = renderMap({ view: 'lifers', window: 'week', id: 7 })
    await new Promise(r => setTimeout(r, 20))
    expect(recentObsCalls()).toHaveLength(0)
    expect(onApplied).not.toHaveBeenCalled()
    release()
    await waitFor(() => expect(recentObsCalls()).toHaveLength(1))
    expect(onApplied).toHaveBeenCalledWith(7)
  })

  it('location fails: the view and window stay applied, the failure message shows, no search runs', async () => {
    geo.impl = async () => { throw { code: 'permission-denied', platform: 'tauri' } }
    const { onApplied } = renderMap({ view: 'lifers', window: 'day', id: 3 })
    await waitFor(() => expect(onApplied).toHaveBeenCalledWith(3))
    const msg = describeLocationError({ code: 'permission-denied', platform: 'tauri' })
    await waitFor(() => expect(document.querySelector('.sr-map-geo-error')?.textContent).toContain(msg))
    expect(pressed('Nearby Lifers')).toBe(true)
    expect(recentObsCalls()).toHaveLength(0)
  })

  it('no eBird backup: the view is applied and the link consumed, and no search or location read runs', async () => {
    world.files = { ebird: false, ml: false }
    const { onApplied } = renderMap({ view: 'targets', window: 'day', media: 'any', id: 4 })
    await waitFor(() => expect(onApplied).toHaveBeenCalledWith(4))
    expect(pressed('Media Targets')).toBe(true)
    expect(recentObsCalls()).toHaveLength(0)
    const { getCurrentLocation } = await import('../lib/location')
    expect(getCurrentLocation).not.toHaveBeenCalled()
  })

  it('no eBird key: the view is applied, the key notice path is left to the view, no search runs', async () => {
    world.key = null
    const { onApplied } = renderMap({ view: 'lifers', window: 'day', id: 5 })
    await waitFor(() => expect(onApplied).toHaveBeenCalledWith(5))
    expect(pressed('Nearby Lifers')).toBe(true)
    expect(recentObsCalls()).toHaveLength(0)
  })

  it('no link, no effect: an ordinary mount never searches or reads location', async () => {
    renderMap(undefined)
    await waitFor(() => expect(screen.getByRole('button', { name: 'Hotspots' })).toBeTruthy())
    await new Promise(r => setTimeout(r, 20))
    expect(recentObsCalls()).toHaveLength(0)
  })
})

describe('App wiring, read from source (comments stripped)', () => {
  const app = readFileSync(resolve(process.cwd(), 'src/App.tsx'), 'utf8')
    .split('\n').filter(l => !/^\s*\/\//.test(l)).join('\n')

  it('a new pending-link id switches to the Map Explorer, once per id, during render', () => {
    expect(app).toContain('const pendingLink = useSyncExternalStore(subscribePendingLink, getPendingLink, getPendingLink)')
    expect(app).toMatch(/if \(pendingLink !== null && pendingLink\.id !== linkTabId\) \{\s*setLinkTabId\(pendingLink\.id\)\s*setActiveTab\('map-explorer'\)/)
  })

  it('the Map Explorer receives the link and clears it by id', () => {
    expect(app).toContain('linkRequest={pendingLink ?? undefined}')
    expect(app).toContain('onLinkRequestApplied={clearPendingLink}')
  })

  it('a saved layout that hides the Map Explorer does not move a link request off it (OQ-03)', () => {
    expect(app).toContain("if (current === 'map-explorer' && getPendingLink() !== null) return current")
  })

  it('both controllers boot on iOS only, through import(), after first paint', () => {
    const at = app.indexOf('if (!widgetsSupported()) return')
    expect(at).toBeGreaterThan(-1)
    const block = app.slice(at, at + 500)
    expect(block).toContain("import('./lib/widgets/widgetHandoverController')")
    expect(block).toContain("import('./lib/links/linkController')")
    expect(block).toContain('setTimeout(')
  })
})
