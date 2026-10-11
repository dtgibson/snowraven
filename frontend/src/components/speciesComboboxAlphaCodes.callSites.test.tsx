// @vitest-environment jsdom
//
// Species codes on the four MOUNTED pickers (species-code-search; PRD QA-25,
// QA-27, FR-20). The call sites wire nothing for codes (a source scan in
// `lib/alphaCodeWiring.test.ts` holds that); these rows prove the shared
// component delivers codes on each real surface anyway: Species Detail's
// Select species, the Calendar's species filter, the Map Explorer's Species
// filter on My Sightings, and the Statistics Weather section's Filter by
// species. The mounting harness and its mocks follow
// `speciesComboboxOptionsIdentity.test.tsx`, which documents why each is there.

import { describe, it, expect, vi, beforeAll, afterEach, afterAll } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor, act } from '@testing-library/react'
import type { ReactNode } from 'react'
import type { ObservationEntry } from '../types'
import { formatWeather, type HourlyResponse } from '../lib/weatherFormatter'
import { loadAlphaCodes } from '../lib/alphaCodesAsset'

const TZ = 'America/Los_Angeles'
function weatherBlock(temp: number): string {
  const hourly: HourlyResponse = {
    data: [{
      dt: 1716570000, temp, humidity: 72, dew_point: 55, wind_speed: 6, wind_deg: 250,
      clouds: 20, weather: [{ id: 801, description: 'few clouds' }],
      sunrise: 1716550000, sunset: 1716600000,
    }],
  }
  return formatWeather([hourly], TZ, 33.7)
}

const SPECIES: { name: string; sci: string }[] = [
  { name: 'Snow Goose', sci: 'Anser caerulescens' },
  { name: 'Canada Goose', sci: 'Branta canadensis' },
  { name: 'Cackling Goose', sci: 'Branta hutchinsii' },
  { name: 'Yellow-rumped Warbler', sci: 'Setophaga coronata' },
  { name: 'Yellow-rumped Warbler (Myrtle)', sci: 'Setophaga coronata coronata' },
  { name: "Yellow-rumped Warbler (Audubon's)", sci: 'Setophaga coronata auduboni' },
]

const OBS: ObservationEntry[] = Array.from({ length: 6 }, (_, i) => i).flatMap(i =>
  SPECIES.map((s, j): ObservationEntry => ({
    submissionId: `S${i + 1}`,
    commonName: s.name,
    scientificName: s.sci,
    date: `2026-0${(i % 6) + 1}-1${j}`,
    location: `Site ${i + 1}`,
    locationId: `L${i + 1}`,
    latitude: 37.9 + i * 0.01,
    longitude: -122.24 + j * 0.01,
    county: i % 2 === 0 ? 'Alameda' : 'Marin',
    count: 1,
    breedingCode: j === 0 ? 'C' : null,
    speciesComments: '',
    catalogIds: [],
    stateProvince: 'US-CA',
    time: '07:00 AM',
    duration: 60,
    distance: 1,
    area: null,
    protocol: 'Traveling',
    numObservers: 1,
    allObsReported: true,
    checklistComments: weatherBlock(60 + i),
  })),
)

vi.mock('./SnowMap', () => ({ SnowMap: ({ children }: { children?: ReactNode }) => <div>{children}</div> }))
vi.mock('./SightingsMap', () => ({ SightingsMap: () => <div /> }))
vi.mock('./AtlasLayer', () => ({ AtlasLayer: () => null }))
vi.mock('./map/CountyLayer', () => ({ CountyLayer: () => null }))
vi.mock('./map/SightingMarkers', () => ({ SightingMarkers: () => null }))
vi.mock('./map/HotspotMarkers', () => ({ HotspotMarkers: () => null }))
vi.mock('./map/TargetMarkers', () => ({ TargetMarkers: () => null }))
vi.mock('./map/NearbyLiferMarkers', () => ({ NearbyLiferMarkers: () => null }))
vi.mock('./map/BasemapDesaturation', () => ({ BasemapDesaturation: () => null }))
vi.mock('./map/SharePin', () => ({ SharePin: () => null }))
vi.mock('./map/SharePopup', () => ({ SharePopup: () => null }))
vi.mock('./map/MapControls', () => ({
  MapEffects: () => null, BoundsTracker: () => null, DetectedLocationPin: () => null,
  CenterPinDropper: () => null, CenterPin: () => null,
}))
vi.mock('react-map-gl/maplibre', () => ({
  Marker: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  Popup: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  Source: ({ children }: { children?: ReactNode }) => <>{children}</>,
  Layer: () => null,
  useMap: () => ({ current: undefined }),
}))
vi.mock('../lib/useHotspotSet', () => ({ useHotspotSet: () => ({ set: new Set<string>(), isHotspot: () => false }) }))
vi.mock('../lib/useCountyCompleteness', () => ({
  useCountyCompleteness: () => ({ summaryFor: () => null, resultFor: () => null, onViewportCounties: () => {}, requestCounty: () => {} }),
  EBIRD_NO_KEY_MESSAGE: 'no key',
}))
vi.mock('../lib/storage', () => ({
  storage: {
    getFilesStatus: vi.fn(async () => ({ ebird: { filename: 'ebird.csv', uploadedAt: '2026-06-01' }, ml: null })),
    getSetting: vi.fn(async () => null),
    setSetting: vi.fn(async () => {}),
    readFile: vi.fn(async () => null),
    getApiKey: vi.fn(async () => null),
  },
}))
vi.mock('../lib/observationsCache', () => ({ loadEbirdObservations: vi.fn(async () => ({ headerLine: '', observations: OBS })) }))
vi.mock('../lib/mlExportCache', () => ({ loadMLExport: vi.fn(async () => null) }))
vi.mock('../lib/transport', () => ({
  transport: {
    get: vi.fn(async () => ({ species: [] })),
    post: vi.fn(async (path: string) => (path === '/taxonomy/codes' ? { codes: {}, orders: {}, formCodes: {} } : {})),
  },
  TransportError: class extends Error {},
}))

import { Calendar } from './Calendar'
import { SpeciesDetail } from './SpeciesDetail'
import { MapExplorer } from './MapExplorer'
import { BirdingStats } from './BirdingStats'

// The real asset, loaded once for the file through the real loader.
beforeAll(async () => { await loadAlphaCodes() })
afterEach(() => { cleanup(); vi.unstubAllGlobals() })
afterAll(() => new Promise((r) => setTimeout(r, 120)))

const listedSpecies = (): string[] =>
  screen.queryAllByRole('option')
    .map(o => o.querySelector('.sr-truncate')?.textContent ?? '')
    .filter(n => n !== 'All species')

/** Type a query, press Enter with nothing highlighted, and return what the closed picker shows. */
function enter(label: string, query: string): HTMLInputElement {
  const input = screen.getByRole('combobox', { name: label }) as HTMLInputElement
  fireEvent.focus(input)
  fireEvent.change(input, { target: { value: query } })
  fireEvent.keyDown(input, { key: 'Enter' })
  return input
}

const SURFACES: [string, string, () => Promise<void>][] = [
  ['Species Detail', 'Select species', async () => {
    render(<SpeciesDetail onGoToSettings={() => {}} onGoToWeather={() => {}} filesVersion={0} embedAllowed={false} />)
    await screen.findByRole('combobox', { name: 'Select species' })
  }],
  ['Calendar', 'Filter the calendar to one species', async () => {
    render(<Calendar onGoToSettings={() => {}} filesVersion={0} />)
    await screen.findByRole('combobox', { name: 'Filter the calendar to one species' })
  }],
  ['Map Explorer', 'Species', async () => {
    render(
      <MapExplorer onGoToSettings={() => {}} onNavigateToMediaList={() => {}} keysVersion={0} isFullscreen={false}
        onToggleFullscreen={() => {}} onOpenSpecies={() => {}} />,
    )
    await screen.findByRole('combobox', { name: 'Species' })
  }],
  ['Statistics', 'Filter by species', async () => {
    const rafQueue: FrameRequestCallback[] = []
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => rafQueue.push(cb))
    vi.stubGlobal('cancelAnimationFrame', () => {})
    vi.stubGlobal('requestIdleCallback', () => 0)
    vi.stubGlobal('cancelIdleCallback', () => {})
    render(<BirdingStats onGoToSettings={() => {}} onGoToWeather={() => {}} onOpenSpecies={() => {}} />)
    await waitFor(() => expect(screen.getByText('Statistics')).toBeTruthy())
    await waitFor(() => expect(rafQueue.length).toBeGreaterThan(0))
    const flush = () => { const batch = rafQueue.splice(0); for (const cb of batch) cb(performance.now()) }
    await act(async () => { flush() })
    await act(async () => { flush() })
    await screen.findByRole('combobox', { name: 'Filter by species' })
  }],
]

describe('Enter on a code selects the first code match on every mounted picker (QA-25, FR-17)', () => {
  it.each(SURFACES)('%s', async (_surface, label, mount) => {
    await mount()
    const input = screen.getByRole('combobox', { name: label }) as HTMLInputElement
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: 'cago' } })
    // The code group leads, in whatever order this surface hands its options.
    const listed = listedSpecies()
    expect(new Set(listed.slice(0, 2))).toEqual(new Set(['Canada Goose', 'Cackling Goose']))
    expect(listed).not.toContain('Snow Goose')
    const first = listed[0]

    fireEvent.keyDown(input, { key: 'Enter' })
    await waitFor(() => expect(input.value).toBe(first))

    // A query that matches nothing: Enter selects nothing and never resets to "All species".
    enter(label, 'xyzq')
    fireEvent.keyDown(input, { key: 'Escape' })
    await waitFor(() => expect(input.value).toBe(first))
  })
})

describe('the Calendar folds forms into their species (QA-27, OQ-08)', () => {
  it('`yrwa` finds Yellow-rumped Warbler; the form codes `mywa` and `auwa` list no species', async () => {
    await SURFACES[1][2]()
    const label = 'Filter the calendar to one species'
    const input = screen.getByRole('combobox', { name: label }) as HTMLInputElement
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: 'yrwa' } })
    expect(listedSpecies()).toEqual(['Yellow-rumped Warbler'])
    for (const q of ['mywa', 'auwa']) {
      fireEvent.change(input, { target: { value: q } })
      expect(listedSpecies(), q).toEqual([])
    }
  })
})
