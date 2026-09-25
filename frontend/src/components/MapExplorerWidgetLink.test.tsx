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
// The two marker layers render nothing here but RECORD what they were handed,
// which is what the bird-tap rows read: the pins shown and the selected one.
const markers = vi.hoisted(() => ({
  lifers: null as null | { pins: { locId: string; count: number; lifers: { speciesCode: string }[] }[]; sel: string | null },
  targets: null as null | { pins: { locId: string; speciesCode: string }[]; sel: string | null },
}))
vi.mock('./map/TargetMarkers', () => ({
  TargetMarkers: (p: { pins: never[]; sel: string | null }) => { markers.targets = { pins: p.pins, sel: p.sel }; return null },
}))
vi.mock('./map/NearbyLiferMarkers', () => ({
  NearbyLiferMarkers: (p: { pins: never[]; sel: string | null }) => { markers.lifers = { pins: p.pins, sel: p.sel }; return null },
}))
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
const pin = (speciesCode: string, comName: string, locId = `L-${speciesCode}`, lat = 37.9) => ({
  speciesCode, comName, locId, locName: 'Tilden Park', lat, lng: -122.24,
  recentDate: today, checklistCount: 1, subId: 'S1',
})
// Extra records for the bird-tap rows (none by default), and a gate a row can
// hold a search on, so two searches can resolve out of order.
const records = vi.hoisted(() => ({ extra: [] as unknown[], gate: null as null | Promise<void>, fail: false }))

vi.mock('../lib/transport', () => ({
  transport: {
    // Honors `codes` as the route does: Media Targets sends its target codes,
    // Nearby Lifers sends none and gets every species in the radius.
    get: vi.fn(async (path: string, params?: { codes?: string }) => {
      if (path !== '/map/recent-obs') return []
      const gate = records.gate
      if (gate) await gate
      if (records.fail) throw new Error('offline')
      const all = [pin('stejay', "Steller's Jay"), pin('wrenti', 'Wrentit'), pin('ruff', 'Ruff'), ...(records.extra as ReturnType<typeof pin>[])]
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

// The landing's location bound, adjustable per row (a getter, so each read of
// the imported binding sees the current value).
const bound = vi.hoisted(() => ({ ms: 10_000 }))
vi.mock('../lib/links/linkFocus', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/links/linkFocus')>()
  return { ...actual, get LANDING_LOCATION_BOUND_MS() { return bound.ms } }
})

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
  records.extra = []
  records.gate = null
  records.fail = false
  markers.lifers = null
  markers.targets = null
  bound.ms = 10_000
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

// Stage 8 re-entry: a bird tap shows only that species, centered on the listed
// sighting with its popup open, and a pill to show all again (design-spec.md
// "Tap-through"; schema.md 4.5). Ruff is a lifer at three places; Baird's
// Sandpiper shares one of them.
describe('a bird tap focuses the tapped species (Stage 8)', () => {
  const RUFF_ELSEWHERE = () => [
    pin('ruff', 'Ruff', 'L200', 37.95), pin('baisan', "Baird's Sandpiper", 'L200', 37.95), pin('ruff', 'Ruff', 'L300', 37.80),
  ]
  const lifersShown = () => markers.lifers!.pins.map(p => `${p.locId}:${p.lifers.map(l => l.speciesCode).sort().join('+')}`).sort()
  const pill = () => screen.queryByRole('button', { name: /^Showing only / })

  it('lifers: only the species, each spot narrowed to it, the LISTED sighting selected, and the pill', async () => {
    records.extra = RUFF_ELSEWHERE()
    renderMap({ view: 'lifers', window: 'week', id: 1, bird: { speciesCode: 'ruff', locId: 'L300' } })
    await waitFor(() => expect(markers.lifers?.sel).toBe('L300'))
    expect(lifersShown()).toEqual(['L-ruff:ruff', 'L200:ruff', 'L300:ruff'])
    expect(markers.lifers!.pins.every(p => p.count === 1)).toBe(true)
    expect(pill()!.textContent).toBe('Only Ruff· Show all')
    expect(pill()!.getAttribute('aria-label')).toBe('Showing only Ruff. Show all nearby lifers')
    expect(screen.getByText(/3 spots · 3 lifers/)).toBeTruthy()
    expect(recentObsCalls()).toHaveLength(1)
  })

  it('the listed location is gone: the NEAREST sighting of the species to the search center is selected instead', async () => {
    records.extra = RUFF_ELSEWHERE()
    renderMap({ view: 'lifers', window: 'week', id: 1, bird: { speciesCode: 'ruff', locId: 'L999' } })
    await waitFor(() => expect(markers.lifers?.sel).toBe('L-ruff'))
    expect(pill()).toBeTruthy()
    expect(screen.queryByText(/was not found within/)).toBeNull()
  })

  it('Show all: every result comes back with no new request, the popup closes and the pill goes', async () => {
    records.extra = RUFF_ELSEWHERE()
    renderMap({ view: 'lifers', window: 'week', id: 1, bird: { speciesCode: 'ruff', locId: 'L300' } })
    await waitFor(() => expect(pill()).toBeTruthy())
    pill()!.click()
    await waitFor(() => expect(pill()).toBeNull())
    expect(lifersShown()).toEqual(['L-ruff:ruff', 'L200:baisan+ruff', 'L300:ruff'])
    expect(markers.lifers!.sel).toBeNull()
    expect(recentObsCalls()).toHaveLength(1)
  })

  it('targets: only the species, the listed pin selected, the link\'s own chip write does NOT clear the focus', async () => {
    renderMap({ view: 'targets', window: 'week', media: 'photo', id: 1, bird: { speciesCode: 'wrenti', locId: 'L-wrenti' } })
    await waitFor(() => expect(markers.targets?.sel).toBe('L-wrenti'))
    expect(markers.targets!.pins.map(p => p.speciesCode)).toEqual(['wrenti'])
    expect(pill()!.getAttribute('aria-label')).toBe('Showing only Wrentit. Show all nearby media targets')
  })

  it('the species is not in the results: all results, no pill, and the statement line (named where the app knows the name)', async () => {
    // Steller's Jay is recorded, so it is no lifer; the lifer search's own
    // records still name it.
    renderMap({ view: 'lifers', window: 'week', id: 1, bird: { speciesCode: 'stejay', locId: 'L-stejay' } })
    await waitFor(() => expect(screen.getByText("Steller's Jay was not found within 25 miles. Showing all lifers.")).toBeTruthy())
    expect(pill()).toBeNull()
    expect(lifersShown()).toEqual(['L-ruff:ruff'])
    expect(markers.lifers!.sel).toBeNull()
  })

  it('a code nothing in the app names: the generic statement, never the code', async () => {
    renderMap({ view: 'lifers', window: 'week', id: 1, bird: { speciesCode: 'nosuch1', locId: 'L1' } })
    await waitFor(() => expect(screen.getByText('The bird you tapped was not found within 25 miles. Showing all lifers.')).toBeTruthy())
    expect(document.body.textContent).not.toContain('nosuch1')
  })

  it('a view link (the header) never focuses anything', async () => {
    records.extra = RUFF_ELSEWHERE()
    renderMap({ view: 'lifers', window: 'week', id: 1 })
    await waitFor(() => expect(markers.lifers?.pins.length).toBe(3))
    await new Promise(r => setTimeout(r, 20))
    expect(pill()).toBeNull()
    expect(markers.lifers!.sel).toBeNull()
  })

  // Every clear, one row each; each starts from a focused view and asserts the
  // focus is gone (all three lifer spots back, including Baird's at L200).
  const CLEARS: [string, () => Promise<void> | void][] = [
    ['Show all', () => pill()!.click()],
    ['a view switch', async () => {
      screen.getByRole('button', { name: 'Media Targets' }).click()
      await waitFor(() => expect(pressed('Media Targets')).toBe(true))
      screen.getByRole('button', { name: 'Nearby Lifers' }).click()
    }],
    ['a window change', () => screen.getAllByRole('button', { name: '30 days' })[0]!.click()],
    ['a new search from the sidebar', () => screen.getByRole('button', { name: 'Find Nearby Lifers' }).click()],
  ]
  it.each(CLEARS)('%s clears the focus', async (_name, act) => {
    records.extra = RUFF_ELSEWHERE()
    renderMap({ view: 'lifers', window: 'week', id: 1, bird: { speciesCode: 'ruff', locId: 'L300' } })
    await waitFor(() => expect(pill()).toBeTruthy())
    await act()
    await waitFor(() => expect(pill()).toBeNull())
    await waitFor(() => expect(lifersShown()).toEqual(['L-ruff:ruff', 'L200:baisan+ruff', 'L300:ruff']))
  })

  // The two clears the searchId binding does NOT already cover, each with the
  // one case only it protects (measured: with either clear deleted, every
  // other row stays green).
  it('a new search that FAILS still clears the focus (the old results stay, unfocused)', async () => {
    records.extra = RUFF_ELSEWHERE()
    renderMap({ view: 'lifers', window: 'week', id: 1, bird: { speciesCode: 'ruff', locId: 'L300' } })
    await waitFor(() => expect(pill()).toBeTruthy())
    records.fail = true
    screen.getByRole('button', { name: 'Find Nearby Lifers' }).click()
    await waitFor(() => expect(recentObsCalls()).toHaveLength(2))
    await waitFor(() => expect(pill()).toBeNull())
    expect(lifersShown()).toEqual(['L-ruff:ruff', 'L200:baisan+ruff', 'L300:ruff'])
  })

  it('a view switch while the focused search is still loading clears it, so it never lands after the user left', async () => {
    records.extra = RUFF_ELSEWHERE()
    let release!: () => void
    records.gate = new Promise(r => { release = r })
    renderMap({ view: 'lifers', window: 'week', id: 1, bird: { speciesCode: 'ruff', locId: 'L300' } })
    await waitFor(() => expect(recentObsCalls()).toHaveLength(1))
    screen.getByRole('button', { name: 'Hotspots' }).click()
    await waitFor(() => expect(pressed('Hotspots')).toBe(true))
    screen.getByRole('button', { name: 'Nearby Lifers' }).click()
    await waitFor(() => expect(pressed('Nearby Lifers')).toBe(true))
    release()
    await waitFor(() => expect(markers.lifers?.pins.length).toBe(3))
    await new Promise(r => setTimeout(r, 30))
    expect(pill()).toBeNull()
    expect(markers.lifers!.sel).toBeNull()
  })

  // Media Targets: the same clears on the other view (Tester re-verification).
  // Wrentit is a target at two places; Steller's Jay at one.
  const targetsShown = () => markers.targets!.pins.map(p => `${p.locId}:${p.speciesCode}`).sort()
  const ALL_TARGETS = ['L-stejay:stejay', 'L-wrenti:wrenti', 'L400:wrenti']
  async function focusedTargets() {
    records.extra = [pin('wrenti', 'Wrentit', 'L400', 37.95)]
    renderMap({ view: 'targets', window: 'week', media: 'any', id: 1, bird: { speciesCode: 'wrenti', locId: 'L400' } })
    await waitFor(() => expect(markers.targets?.sel).toBe('L400'))
    expect(targetsShown()).toEqual(['L-wrenti:wrenti', 'L400:wrenti'])
    expect(pill()).toBeTruthy()
  }

  it('a targets time-range change clears the focus', async () => {
    await focusedTargets()
    screen.getAllByRole('button', { name: '30 days' })[0]!.click()
    await waitFor(() => expect(pill()).toBeNull())
    expect(targetsShown()).toEqual(ALL_TARGETS)
  })

  it('a new targets search that succeeds clears the focus', async () => {
    await focusedTargets()
    screen.getByRole('button', { name: 'Find Recent Sightings' }).click()
    await waitFor(() => expect(recentObsCalls()).toHaveLength(2))
    await waitFor(() => expect(pill()).toBeNull())
    expect(targetsShown()).toEqual(ALL_TARGETS)
  })

  it('a new targets search that FAILS still clears the focus (the old results stay, unfocused)', async () => {
    await focusedTargets()
    records.fail = true
    screen.getByRole('button', { name: 'Find Recent Sightings' }).click()
    await waitFor(() => expect(recentObsCalls()).toHaveLength(2))
    await waitFor(() => expect(pill()).toBeNull())
    expect(targetsShown()).toEqual(ALL_TARGETS)
  })

  it('a media chip change clears a targets focus', async () => {
    renderMap({ view: 'targets', window: 'week', media: 'any', id: 1, bird: { speciesCode: 'wrenti', locId: 'L-wrenti' } })
    await waitFor(() => expect(pill()).toBeTruthy())
    screen.getAllByRole('button', { name: /^Video/ })[0]!.click()
    await waitFor(() => expect(pill()).toBeNull())
  })

  it('a second link starts clean, and a STALE search that resolves after it can never be focused', async () => {
    records.extra = RUFF_ELSEWHERE()
    let release!: () => void
    records.gate = new Promise(r => { release = r })
    const { rerender } = renderMap({ view: 'lifers', window: 'week', id: 1, bird: { speciesCode: 'ruff', locId: 'L300' } })
    await waitFor(() => expect(recentObsCalls()).toHaveLength(1))
    // The second (view-only) link's search is not held.
    records.gate = null
    rerender(
      <MapExplorer onGoToSettings={() => {}} onNavigateToMediaList={() => {}} keysVersion={0}
        linkRequest={{ view: 'lifers', window: 'week', id: 2 }} onLinkRequestApplied={vi.fn()} />,
    )
    await waitFor(() => expect(recentObsCalls()).toHaveLength(2))
    await waitFor(() => expect(markers.lifers?.pins.length).toBe(3))
    release()
    await new Promise(r => setTimeout(r, 30))
    expect(pill()).toBeNull()
    expect(markers.lifers!.sel).toBeNull()
    expect(lifersShown()).toEqual(['L-ruff:ruff', 'L200:baisan+ruff', 'L300:ruff'])
  })
})

// The widget-link LANDING (device pass on 1.0.36 build 2): from the moment a
// link arrives until its results or an honest failure are on the map, the
// search chip says what is happening, across the data load, the location fix
// and the fetch, announced once. Every wait below is on the exact observable
// the next assertion reads (testing.md v1.0.25).
describe('the widget-link landing shows from the first moment and never sticks', () => {
  const chip = () => document.querySelector('.sr-map-landing-chip')
  const announcer = () => screen.getByTestId('link-landing-announcer')
  const RUFF_ELSEWHERE = () => [
    pin('ruff', 'Ruff', 'L200', 37.95), pin('ruff', 'Ruff', 'L300', 37.80),
  ]

  it('shows the moment a link arrives, before the stored data or the location has answered', async () => {
    obs.gate = new Promise(() => {})
    renderMap({ view: 'lifers', window: 'week', id: 1, bird: { speciesCode: 'ruff', locId: 'L300' } })
    await waitFor(() => expect(chip()?.textContent).toBe('Finding the bird you tapped…'))
    await waitFor(() => expect(announcer().textContent).toBe('Finding the bird you tapped…'))
    expect(chip()!.getAttribute('aria-hidden')).toBe('true')
    const { getCurrentLocation } = await import('../lib/location')
    expect(getCurrentLocation).not.toHaveBeenCalled()
    expect(recentObsCalls()).toHaveLength(0)
  })

  it('stays through the data load, the location fix and the fetch, announced exactly once, then ends on the results', async () => {
    let releaseData!: () => void
    obs.gate = new Promise(r => { releaseData = r })
    let fix!: (v: { lat: number; lng: number }) => void
    geo.impl = () => new Promise(r => { fix = r })
    let releaseFetch!: () => void
    records.gate = new Promise(r => { releaseFetch = r })
    renderMap({ view: 'lifers', window: 'week', id: 1 })
    await waitFor(() => expect(announcer().textContent).toBe('Finding nearby lifers…'))
    const said: string[] = []
    const watch = new MutationObserver(() => { said.push(announcer().textContent ?? '') })
    watch.observe(announcer(), { childList: true, characterData: true, subtree: true })
    // Phase 1, the data load.
    expect(chip()?.textContent).toBe('Finding nearby lifers…')
    releaseData()
    // Phase 2, the location fix.
    const { getCurrentLocation } = await import('../lib/location')
    await waitFor(() => expect(getCurrentLocation).toHaveBeenCalled())
    expect(chip()?.textContent).toBe('Finding nearby lifers…')
    fix(HERE)
    // Phase 3, the fetch.
    await waitFor(() => expect(recentObsCalls()).toHaveLength(1))
    expect(chip()?.textContent).toBe('Finding nearby lifers…')
    // The in-app chip never replaces it mid-landing, so nothing re-announces.
    expect(document.querySelector('.sr-map-loading-chip[role="status"]')).toBeNull()
    releaseFetch()
    await waitFor(() => expect(chip()).toBeNull())
    await waitFor(() => expect(announcer().textContent).toBe(''))
    watch.disconnect()
    expect(said.filter(t => t !== '')).toEqual([])
    expect(markers.lifers?.pins.length).toBe(1)
  })

  it('ends when the focused bird is on the map', async () => {
    records.extra = RUFF_ELSEWHERE()
    renderMap({ view: 'lifers', window: 'week', id: 1, bird: { speciesCode: 'ruff', locId: 'L300' } })
    await waitFor(() => expect(screen.queryByRole('button', { name: /^Showing only Ruff/ })).toBeTruthy())
    await waitFor(() => expect(chip()).toBeNull())
    expect(markers.lifers!.sel).toBe('L300')
  })

  it('ends in the failure message when the fetch fails', async () => {
    records.fail = true
    renderMap({ view: 'lifers', window: 'week', id: 1, bird: { speciesCode: 'ruff', locId: 'L300' } })
    await waitFor(() => expect(document.querySelector('.sr-map-search-status-msg--error')).toBeTruthy())
    await waitFor(() => expect(chip()).toBeNull())
  })

  it('ends in the location message when the fix fails', async () => {
    geo.impl = async () => { throw { code: 'permission-denied', platform: 'tauri' } }
    renderMap({ view: 'lifers', window: 'week', id: 1, bird: { speciesCode: 'ruff', locId: 'L300' } })
    const msg = describeLocationError({ code: 'permission-denied', platform: 'tauri' })
    await waitFor(() => expect(document.querySelector('.sr-map-geo-error')?.textContent).toContain(msg))
    await waitFor(() => expect(chip()).toBeNull())
  })

  it('ends in the timeout message when the fix never comes (the bound the iOS plugin does not keep)', async () => {
    bound.ms = 60
    geo.impl = () => new Promise(() => {})
    renderMap({ view: 'lifers', window: 'week', id: 1 })
    const msg = describeLocationError({ code: 'timeout' })
    await waitFor(() => expect(document.querySelector('.sr-map-geo-error')?.textContent).toContain(msg))
    await waitFor(() => expect(chip()).toBeNull())
    expect(recentObsCalls()).toHaveLength(0)
  })

  it('ends in the species-absent line', async () => {
    renderMap({ view: 'lifers', window: 'week', id: 1, bird: { speciesCode: 'stejay', locId: 'L-stejay' } })
    await waitFor(() => expect(screen.getByText("Steller's Jay was not found within 25 miles. Showing all lifers.")).toBeTruthy())
    await waitFor(() => expect(chip()).toBeNull())
  })

  it('ends at the view\'s own notice when the search cannot run (no key)', async () => {
    world.key = null
    const { onApplied } = renderMap({ view: 'lifers', window: 'week', id: 1 })
    await waitFor(() => expect(onApplied).toHaveBeenCalledWith(1))
    await waitFor(() => expect(chip()).toBeNull())
  })

  it('a newer link owns the chip: the first link finishing does not end it, only its own search does', async () => {
    let releaseFirst!: () => void
    records.gate = new Promise(r => { releaseFirst = r })
    const { rerender } = renderMap({ view: 'lifers', window: 'week', id: 1 })
    await waitFor(() => expect(recentObsCalls()).toHaveLength(1))
    expect(chip()?.textContent).toBe('Finding nearby lifers\u2026')
    // The second link's fetch waits on its own gate.
    let releaseSecond!: () => void
    records.gate = new Promise(r => { releaseSecond = r })
    rerender(
      <MapExplorer onGoToSettings={() => {}} onNavigateToMediaList={() => {}} keysVersion={0}
        linkRequest={{ view: 'targets', window: 'week', media: 'any', id: 2 }} onLinkRequestApplied={vi.fn()} />,
    )
    await waitFor(() => expect(recentObsCalls()).toHaveLength(2))
    expect(chip()?.textContent).toBe('Finding nearby media targets\u2026')
    // The FIRST search finishes (its count reaches the outcome line)...
    releaseFirst()
    await waitFor(() => expect(document.querySelector('.sr-map-search-status-msg')?.textContent).toMatch(/nearby lifers/))
    await new Promise(r => setTimeout(r, 20))
    // ...and the second link's chip is still up.
    expect(chip()?.textContent).toBe('Finding nearby media targets\u2026')
    releaseSecond()
    await waitFor(() => expect(chip()).toBeNull())
  })

  it('a view switch during a landing ends the chip, though the link\'s fetch is still pending', async () => {
    records.gate = new Promise(() => {})
    renderMap({ view: 'lifers', window: 'week', id: 1 })
    await waitFor(() => expect(recentObsCalls()).toHaveLength(1))
    expect(chip()?.textContent).toBe('Finding nearby lifers\u2026')
    screen.getByRole('button', { name: 'Hotspots' }).click()
    await waitFor(() => expect(pressed('Hotspots')).toBe(true))
    await waitFor(() => expect(chip()).toBeNull())
  })

  it('ends at the view\'s own notice when there is no eBird backup', async () => {
    world.files = { ebird: false, ml: false }
    const { onApplied } = renderMap({ view: 'lifers', window: 'week', id: 1 })
    await waitFor(() => expect(onApplied).toHaveBeenCalledWith(1))
    await waitFor(() => expect(chip()).toBeNull())
    expect(recentObsCalls()).toHaveLength(0)
  })

  it('names the bird once the app holds its name, without announcing a second time', async () => {
    let releaseData!: () => void
    obs.gate = new Promise(r => { releaseData = r })
    records.gate = new Promise(() => {})
    renderMap({ view: 'targets', window: 'week', media: 'any', id: 1, bird: { speciesCode: 'wrenti', locId: 'L-wrenti' } })
    // Announced once, before the app knows the name.
    await waitFor(() => expect(announcer().textContent).toBe('Finding the bird you tapped\u2026'))
    const said: string[] = []
    const watch = new MutationObserver(() => { said.push(announcer().textContent ?? '') })
    watch.observe(announcer(), { childList: true, characterData: true, subtree: true })
    // The taxonomy lookup that runs once the data is in names it on screen.
    releaseData()
    await waitFor(() => expect(chip()?.textContent).toBe('Finding Wrentit near you\u2026'))
    watch.disconnect()
    expect(said).toEqual([])
    expect(announcer().textContent).toBe('Finding the bird you tapped\u2026')
  })

  it('a view tap on Media Targets says so', async () => {
    records.gate = new Promise(() => {})
    renderMap({ view: 'targets', window: 'week', media: 'any', id: 1 })
    await waitFor(() => expect(chip()?.textContent).toBe('Finding nearby media targets…'))
  })

  it('an ordinary in-app search is unchanged: the same chip and live region, no landing, nothing announced', async () => {
    records.gate = new Promise(() => {})
    renderMap(undefined)
    await waitFor(() => expect(screen.getByRole('button', { name: 'Nearby Lifers' })).toBeTruthy())
    screen.getByRole('button', { name: 'Nearby Lifers' }).click()
    await waitFor(() => expect(pressed('Nearby Lifers')).toBe(true))
    // "Use my location" with no center set searches the view (handleUseMyLocation).
    screen.getAllByRole('button', { name: /Use my location/ })[0]!.click()
    await waitFor(() => expect(recentObsCalls()).toHaveLength(1))
    await waitFor(() => expect(document.querySelector('.sr-map-loading-chip[role="status"]')?.textContent).toBe('Finding nearby lifers…'))
    expect(chip()).toBeNull()
    expect(announcer().textContent).toBe('')
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
