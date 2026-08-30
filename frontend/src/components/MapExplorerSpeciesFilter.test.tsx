// @vitest-environment jsdom
//
// improve: searchable-species-pickers — the My Sightings Species filter is the
// shared SpeciesCombobox at the panel register (the app's last scroll-only
// species dropdown, replaced), and the filter panel's clip wrapper releases its
// overflow once the open animation settles so the picker's absolutely
// positioned listbox is never cut off at the panel's bottom edge.
//
// WHAT THIS FILE PROVES (jsdom, structural + wiring):
//  - the Species control is the shared combobox <input> at the 34px/0.8125rem
//    panel register, wired to the real speciesFilter state (selecting a species
//    narrows the sidebar stats; the "All species" row clears it back);
//  - typing narrows by common OR scientific name (the observations feed
//    sciName into the options);
//  - the clip wrapper's overflow releases ONLY on the grid wrapper's own
//    grid-template-rows transitionend while open, re-clips instantly on close,
//    and the collapsed panel keeps its literal `inert` attribute.
//
// WHAT IT CANNOT PROVE: that the released listbox visually paints past the
// panel edge, or scroll-reachability at 320px / 200% text scale — jsdom has no
// layout engine. That half is the browser check recorded in the PR notes.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent, within } from '@testing-library/react'
import type { ReactNode } from 'react'
import type { ObservationEntry } from '../types'

// ── Mocks: everything below the sidebar (maplibre, network, disk) ────────────
vi.mock('react-map-gl/maplibre', () => ({
  useMap: () => ({ current: null }),
  Marker: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  Popup: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  Source: ({ children }: { children?: ReactNode }) => <>{children}</>,
  Layer: () => null,
}))
vi.mock('./SnowMap', () => ({ SnowMap: ({ children }: { children?: ReactNode }) => <div>{children}</div> }))
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
vi.mock('../lib/storage', () => ({
  storage: {
    getApiKey: vi.fn().mockResolvedValue('k'),
    getSetting: vi.fn().mockResolvedValue(null),
    setSetting: vi.fn().mockResolvedValue(undefined),
    getFilesStatus: vi.fn(async () => ({ ebird: true, ml: false })),
  },
}))

// Two species at two locations, so filtering to one species visibly narrows
// the sidebar stats (2 locations / 2 species → 1 / 1).
const OBS: ObservationEntry[] = [
  {
    submissionId: 'S1', commonName: 'Steller\'s Jay', scientificName: 'Cyanocitta stelleri',
    date: '2026-05-01', location: 'Tilden Park', locationId: 'L1',
    latitude: 37.9, longitude: -122.24,
    county: 'Alameda',
    count: 2, breedingCode: null, speciesComments: '', catalogIds: [],
    stateProvince: 'US-CA',
  },
  {
    submissionId: 'S2', commonName: 'Varied Thrush', scientificName: 'Ixoreus naevius',
    date: '2026-05-02', location: 'Redwood Park', locationId: 'L2',
    latitude: 37.8, longitude: -122.16,
    county: 'Alameda',
    count: 1, breedingCode: null, speciesComments: '', catalogIds: [],
    stateProvince: 'US-CA',
  },
]

vi.mock('../lib/observationsCache', () => ({
  loadEbirdObservations: vi.fn(async () => ({ observations: OBS })),
}))
vi.mock('../lib/mlExportCache', () => ({
  loadMLExport: vi.fn(async () => ({ rows: [], mediaMap: {} })),
}))

import { MapExplorer } from './MapExplorer'

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

// The combobox input carries aria-label "Species" (as the outgoing select did);
// resolve by combobox role so the open listbox (same aria-label) never collides.
async function findSpeciesInput() {
  return await screen.findByRole('combobox', { name: 'Species' }) as HTMLInputElement
}

// Two buttons are named "Filters" in jsdom (the panel toggle and the phone FAB,
// whose desktop display:none lives in a stylesheet jsdom does not load);
// aria-controls names the panel toggle unambiguously.
function panelToggle() {
  return screen.getAllByRole('button', { name: 'Filters' })
    .find(b => b.getAttribute('aria-controls') === 'sr-map-filter-panel')!
}

// The sidebar stat under a given label ("Locations" / "Species" / "Obs"):
// value div renders directly above its label div inside one cell.
function statValue(label: string): string {
  const labelDiv = screen.getAllByText(label).find(el => el.previousElementSibling !== null)!
  return labelDiv.previousElementSibling!.textContent ?? ''
}

// The grid-collapse wrapper and its inner clip element.
function panelParts() {
  const grid = document.getElementById('sr-map-filter-panel')!
  const clip = grid.firstElementChild as HTMLElement
  return { grid, clip }
}

// React's onTransitionEnd is a delegated native listener, so a bubbling native
// event with propertyName assigned drives the real handler. Dispatch through
// testing-library's fireEvent so the resulting state update flushes (act).
function fireTransitionEnd(el: Element, propertyName: string) {
  const ev = new Event('transitionend', { bubbles: true })
  Object.assign(ev, { propertyName })
  fireEvent(el, ev)
}

beforeEach(() => { vi.clearAllMocks() })
afterEach(cleanup)

describe('the My Sightings Species filter is the shared type-to-find picker', () => {
  it('renders the shared combobox at the panel register, wired end-to-end to the filter', async () => {
    renderMap()
    const input = await findSpeciesInput()

    // The panel register (size="panel" → SELECT_STYLE's numbers), on the real
    // <input>, which also carries the iOS no-zoom guard the select carried.
    expect(input.tagName.toLowerCase()).toBe('input')
    expect(input.classList.contains('sr-input-16')).toBe(true)
    expect(input.style.height).toBe('34px')
    expect(input.style.fontSize).toBe('0.8125rem')
    expect(input.style.borderRadius).toBe('6px')
    expect(input.placeholder).toBe('All species')

    // Unfiltered baseline: both locations, both observations.
    expect(statValue('Locations')).toBe('2')
    expect(statValue('Obs')).toBe('2')
  })

  it('typing narrows by common OR scientific name and Enter applies the filter', async () => {
    renderMap()
    const input = await findSpeciesInput()
    fireEvent.focus(input)

    // The "All species" clearing row sits first and survives every query.
    let options = within(screen.getByRole('listbox')).getAllByRole('option')
    expect(options[0].textContent).toContain('All species')
    expect(options).toHaveLength(3) // All + the two species

    // Scientific-name match (Ixoreus) narrows to Varied Thrush.
    fireEvent.change(input, { target: { value: 'ixoreus' } })
    options = within(screen.getByRole('listbox')).getAllByRole('option')
    expect(options.map(o => o.textContent).some(t => t?.includes('Varied Thrush'))).toBe(true)
    expect(options.map(o => o.textContent).some(t => t?.includes('Steller'))).toBe(false)

    fireEvent.keyDown(input, { key: 'Enter' })
    expect(input.value).toBe('Varied Thrush')
    expect(screen.queryByRole('listbox')).toBeNull()
  })

  it('selecting a species narrows the sightings and the All species row clears it', async () => {
    renderMap()
    const input = await findSpeciesInput()

    expect(statValue('Locations')).toBe('2')

    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: 'jay' } })
    const jay = within(screen.getByRole('listbox')).getAllByRole('option')
      .find(o => o.textContent?.includes('Steller'))!
    fireEvent.click(jay)

    // The real speciesFilter state applied: one location, one species.
    expect(input.value).toBe('Steller\'s Jay')
    expect(statValue('Locations')).toBe('1')

    // Clearing row restores the unfiltered view.
    fireEvent.focus(input)
    const all = within(screen.getByRole('listbox')).getAllByRole('option')[0]
    expect(all.textContent).toContain('All species')
    fireEvent.click(all)
    expect(input.value).toBe('')
    expect(statValue('Locations')).toBe('2')
  })
})

describe('the filter panel clip releases only once the open animation settles', () => {
  it('starts released (mounted open), re-clips instantly on close, and stays inert while closed', async () => {
    renderMap()
    await findSpeciesInput()
    const { clip } = panelParts()

    // Mounted open with no transition to wait for: released from first paint.
    expect(clip.style.overflow).toBe('visible')
    expect(clip.hasAttribute('inert')).toBe(false)

    fireEvent.click(panelToggle()) // close
    expect(clip.style.overflow).toBe('hidden') // instantly, so the collapse clips
    expect(clip.hasAttribute('inert')).toBe(true) // literal attribute, collapsed state
  })

  it('on reopen, releases only on the grid wrapper\'s own grid-template-rows transitionend', async () => {
    renderMap()
    await findSpeciesInput()
    const { grid, clip } = panelParts()

    fireEvent.click(panelToggle()) // close
    fireEvent.click(panelToggle()) // reopen — animating, still clipped
    expect(clip.style.overflow).toBe('hidden')
    expect(clip.hasAttribute('inert')).toBe(false)

    // A different property on the wrapper (e.g. border-color) must not release.
    fireTransitionEnd(grid, 'border-color')
    expect(clip.style.overflow).toBe('hidden')

    // The right property bubbling up from a CHILD (the combobox's own
    // transitions live inside the panel) must not release either.
    fireTransitionEnd(clip, 'grid-template-rows')
    expect(clip.style.overflow).toBe('hidden')

    // The wrapper's own grid-rows transition finishing is the release signal.
    fireTransitionEnd(grid, 'grid-template-rows')
    expect(clip.style.overflow).toBe('visible')
  })

  it('a transitionend landing after the panel was closed again does not release the clip', async () => {
    renderMap()
    await findSpeciesInput()
    const { grid, clip } = panelParts()

    fireEvent.click(panelToggle()) // close
    fireEvent.click(panelToggle()) // reopen (animating)
    fireEvent.click(panelToggle()) // close again mid-animation
    // The reverse transition's end must not release a closed panel's clip.
    fireTransitionEnd(grid, 'grid-template-rows')
    expect(clip.style.overflow).toBe('hidden')
  })
})
