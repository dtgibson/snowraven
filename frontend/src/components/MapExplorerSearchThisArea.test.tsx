// @vitest-environment jsdom
/// <reference types="node" />
//
// feature: search-this-area — the Map Explorer's one-press re-search over the
// viewport the user is looking at.
//
// WHAT THIS TEST PROVES: the six-condition presence gate, each condition
// falsified in turn; that exactly one control exists and dispatches to the right
// view; the three accessible names; that the derived CENTRE is adopted into the
// sidebar while the derived RADIUS is SENT WITHOUT the sidebar's Radius control
// moving (the deliberate asymmetry the user chose), and that the radius is
// capped; that the record is written by every route and not by a
// failure; that five presses without moving cost one lookup; that a pan mid-
// flight neither cancels nor restarts; that focus survives a press; that the
// live region exists before any announcement and replaces its node on a repeat;
// and that nothing is written through the storage seam.
//
// WHAT IT CANNOT PROVE (per CLAUDE.md, and NOT evidence for): anything
// geometric. jsdom has no layout engine, no media queries, and does not resolve
// the cascade against React inline styles, so it cannot show that the control
// fits 320px at 200% text scale, that it clears the layers switcher, that the
// cluster still fits with a location-failure row present, or that the drawn
// circle really is drawn smaller than the viewport. Those are browser
// measurements and are written up in
// pipeline/search-this-area/pr-description.md.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, waitFor, fireEvent, act } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { ReactNode } from 'react'
import type { ObservationEntry } from '../types'
import { deriveSearchArea, hasMovedFrom, RUNGS, DERIVED_MAX_MI, type SearchRecord } from '../lib/searchArea'
import { VIEWPORT_PAD_FRAC, type MarkerBounds } from '../lib/markersInView'
import { SEARCH_AREA_LABEL, searchAreaSearchedLabel } from '../lib/searchOutcomeState'

// ── Mocks: everything below the component (maplibre, network, disk) ──────────

vi.mock('react-map-gl/maplibre', () => ({
  useMap: () => ({ current: null }),
  Marker: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  Popup: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}))
vi.mock('./SnowMap', () => ({ SnowMap: ({ children }: { children?: ReactNode }) => <div data-testid="snowmap">{children}</div> }))
vi.mock('./AtlasLayer', () => ({ AtlasLayer: () => null }))
vi.mock('./map/CountyLayer', () => ({ CountyLayer: () => null }))
vi.mock('./map/SightingMarkers', () => ({ SightingMarkers: () => null }))
/**
 * The three marker layers are stubbed so the `autoFit` they are handed is
 * observable. That prop is what stops a viewport-derived search re-framing the
 * map out from under the record it just wrote — the ratchet the second QA cycle
 * measured — and it had to be threaded through three separate call sites, any one
 * of which could have been missed with the rest of the suite green.
 */
const fits = vi.hoisted(() => ({
  hotspots: null as boolean | null | undefined,
  targets: null as boolean | null | undefined,
  lifers: null as boolean | null | undefined,
}))
vi.mock('./map/HotspotMarkers', () => ({
  HotspotMarkers: ({ autoFit }: { autoFit?: boolean }) => { fits.hotspots = autoFit; return null },
}))
vi.mock('./map/TargetMarkers', () => ({
  TargetMarkers: ({ autoFit }: { autoFit?: boolean }) => { fits.targets = autoFit; return null },
}))
vi.mock('./map/NearbyLiferMarkers', () => ({
  NearbyLiferMarkers: ({ autoFit }: { autoFit?: boolean }) => { fits.lifers = autoFit; return null },
}))
vi.mock('./map/BasemapDesaturation', () => ({ BasemapDesaturation: () => null }))
vi.mock('./map/SharePopup', () => ({ SharePopup: () => null }))
vi.mock('./map/SharePin', () => ({ SharePin: () => null }))

/**
 * The indicator is stubbed so the RECORD it is handed is observable. That is the
 * only way to see the record from out here: it is component state with no other
 * rendered representation, and QA-15 is specifically about the record holding the
 * values that were SENT rather than the values displayed.
 */
const drawn = vi.hoisted(() => ({ record: null as SearchRecord | null, mounts: 0 }))
vi.mock('./map/SearchedAreaLayer', () => ({
  SearchedAreaLayer: ({ record }: { record: SearchRecord }) => {
    drawn.record = record
    drawn.mounts += 1
    return <div data-testid="searched-area" data-record={JSON.stringify(record)} />
  },
}))

/** BoundsTracker, made drivable: the test pushes viewports the way a moveend would. */
const boundsCtl = vi.hoisted(() => ({ push: null as null | ((b: MarkerBounds) => void) }))
vi.mock('./map/MapControls', () => ({
  MapEffects: () => null,
  BoundsTracker: ({ onBounds }: { onBounds: (b: MarkerBounds) => void }) => {
    boundsCtl.push = onBounds
    return null
  },
  DetectedLocationPin: () => null,
  CenterPinDropper: () => null,
  CenterPin: () => null,
}))

vi.mock('../lib/useHotspotSet', () => ({ useHotspotSet: () => ({ isPublicHotspot: () => false }) }))
vi.mock('../lib/useCountyCompleteness', () => ({
  useCountyCompleteness: () => ({
    summaryFor: () => null, resultFor: () => null,
    onViewportCounties: () => {}, requestCounty: () => {},
  }),
  EBIRD_NO_KEY_MESSAGE: 'no key',
}))

const net = vi.hoisted(() => ({
  get: null as null | ((path: string, params?: Record<string, string>) => Promise<unknown>),
}))
vi.mock('../lib/transport', () => ({
  transport: {
    get: vi.fn((path: string, params?: Record<string, string>) => net.get!(path, params)),
    post: vi.fn().mockResolvedValue({ codes: { "Steller's Jay": 'stejay' } }),
  },
  TransportError: class extends Error {},
}))
import { transport } from '../lib/transport'

const keys = vi.hoisted(() => ({ ebird: 'k' as string | null }))
const settingWrites = vi.hoisted(() => ({ calls: [] as unknown[][] }))
/**
 * The saved `map-defaults`, drivable per test. `null` by default — a user who
 * has never saved one — which is the case the shipped `useState(5)` answers.
 * A press does NOT read this: it derives its own radius. A test below drives it
 * to both a saved value and none, and watches the request ignore both.
 */
const savedDefaults = vi.hoisted(() => ({
  value: null as null | { lat: number; lng: number; dist: number },
}))
vi.mock('../lib/storage', () => ({
  storage: {
    getApiKey: vi.fn(async () => keys.ebird),
    getSetting: vi.fn(async (key: string) => (key === 'map-defaults' ? savedDefaults.value : null)),
    setSetting: vi.fn(async (...args: unknown[]) => { settingWrites.calls.push(args) }),
    getFilesStatus: vi.fn(async () => ({ ebird: true, ml: true })),
  },
}))

const OBS: ObservationEntry[] = [{
  submissionId: 'S1', commonName: "Steller's Jay", scientificName: 'Cyanocitta stelleri',
  date: '2026-05-01', location: 'Tilden Park', locationId: 'L1',
  latitude: 37.9, longitude: -122.24,
  county: 'Alameda',
  count: 2, breedingCode: null, speciesComments: '', catalogIds: [],
  stateProvince: 'US-CA',
}]
vi.mock('../lib/observationsCache', () => ({
  loadEbirdObservations: vi.fn(async () => ({ observations: OBS })),
}))
vi.mock('../lib/mlExportCache', () => ({
  loadMLExport: vi.fn(async () => ({ rows: [{ format: 'Photo' }], mediaMap: {} })),
}))

import { MapExplorer } from './MapExplorer'

// ── Fixtures and helpers ─────────────────────────────────────────────────────

/** Exact inverse of `unpadBounds`, so a fixture reads as the VISIBLE viewport. */
function pad(b: MarkerBounds, frac: number = VIEWPORT_PAD_FRAC): MarkerBounds {
  const dLng = (b[2] - b[0]) * frac
  const dLat = (b[3] - b[1]) * frac
  return [b[0] - dLng, b[1] - dLat, b[2] + dLng, b[3] + dLat]
}

/** [minLng, minLat, maxLng, maxLat] */
const BAY: MarkerBounds = [-122.55, 37.70, -122.30, 37.90]
const LA: MarkerBounds = [-118.35, 34.00, -118.10, 34.20]
/** The same view nudged ~0.3 mi north — inside the 2.5 mi (0.25 x 10) threshold
 *  that BAY's derived 10 mi rung sets. */
const BAY_NUDGE: MarkerBounds = [-122.55, 37.7043, -122.30, 37.9043]
/** Most of California: a viewport enormously larger than any radius on the ladder. */
const WIDE: MarkerBounds = [-125, 32, -114, 42]

/**
 * The shipped default radius — `useState(5)` in MapExplorer, which the saved
 * `map-defaults` `dist` overwrites on mount when one exists.
 *
 * A PRESS DOES NOT SEND THIS, AND DOES NOT CHANGE IT EITHER. It sends what the
 * viewport derives and leaves this control where the user left it, so after a
 * press the two are BOTH live and different. Every fixture below is deliberately
 * sized so they differ, which is what makes the tests discriminating rather than
 * accidentally green in either direction.
 */
const DEFAULT_RADIUS_MI = 5
/** Miles -> the `dist` km string the three handlers build. */
const distKm = (mi: number) => String(Math.round(mi * 1.60934))

/**
 * What a press derives from each fixture: centre, snapped rung, and whether the
 * cap bit. Computed through the REAL derivation rather than written out, so a
 * change to the ladder or the cap moves these expectations with the code instead
 * of leaving this file as a second, drifting copy of it.
 *
 * BAY and LA both land on the 10 mi rung (covering radii 9.72 and 9.95 mi), so
 * neither equals DEFAULT_RADIUS_MI and no press below can pass by coincidence.
 */
const AREA_BAY = deriveSearchArea(pad(BAY))!
const AREA_LA = deriveSearchArea(pad(LA))!

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

const cluster = () => document.querySelector('.sr-map-fab-cluster') as HTMLElement
const statusRegion = () => document.querySelector('.sr-map-search-status') as HTMLElement
const geoRegion = () => document.querySelector('.sr-map-geo-error') as HTMLElement
const searchBtn = () => document.querySelector('.sr-map-search-area-btn') as HTMLButtonElement | null
const getCalls = () => (transport.get as ReturnType<typeof vi.fn>).mock.calls
const searchCalls = () => getCalls().filter(([p]) => /hotspots|recent-obs/.test(String(p)))

/**
 * Every rung of the sidebar's Radius SegControl that reads as pressed.
 *
 * The whole SET rather than one expected label, so an assertion about the
 * control fails in both directions: a press that wrongly wrote the derived rung
 * shows the wrong single member, and one that somehow left two selected shows
 * both. `expect(getByRole(name: '10 mi')).toBe('true')` would catch neither.
 */
const pressedRungs = () => RUNGS
  .map(r => screen.getByRole('button', { name: `${r} mi` }))
  .filter(b => b.getAttribute('aria-pressed') === 'true')
  .map(b => b.textContent)

async function ready() {
  await waitFor(() => expect(cluster()).toBeTruthy())
}

/** Push a viewport the way a `moveend` would. */
function setBounds(visible: MarkerBounds) {
  act(() => { boundsCtl.push!(pad(visible)) })
}

/** Switch to a centre view and wait for it to settle. */
async function goTo(label: 'Hotspots' | 'Media Targets' | 'Nearby Lifers') {
  fireEvent.click(screen.getByRole('button', { name: label }))
  await waitFor(() => expect(screen.queryByRole('button', { name: 'Use my location' })).toBeTruthy())
}

const HOTSPOT_ROWS = [
  { locId: 'L9', locName: 'Cesar Chavez Park', lat: 37.87, lng: -122.32 },
  { locId: 'L8', locName: 'Aquatic Park', lat: 37.86, lng: -122.30 },
]
// A species deliberately NOT in OBS, so it counts as a nearby LIFER. With the
// backup's own Steller's Jay here instead, buildNearbyLifers subtracts it and
// the lifers count is zero — which is a correct answer to a different question
// and would leave the singular sentence untested.
const OBS_ROWS = [
  { speciesCode: 'varthr', comName: 'Varied Thrush', locId: 'L9', locName: 'Cesar Chavez Park', lat: 37.87, lng: -122.32, recentDate: '2026-08-10 07:00', checklistCount: 1, subId: 'S2' },
]

beforeEach(() => {
  keys.ebird = 'k'
  savedDefaults.value = null
  settingWrites.calls.length = 0
  drawn.record = null
  drawn.mounts = 0
  fits.hotspots = null
  fits.targets = null
  fits.lifers = null
  boundsCtl.push = null
  net.get = async (path: string) => {
    if (path === '/map/hotspots') return HOTSPOT_ROWS
    if (path === '/map/recent-obs') return OBS_ROWS
    return []
  }
})
afterEach(() => { cleanup(); vi.clearAllMocks() })

// ── QA-01 / QA-02 / QA-05: the presence gate, each condition falsified ───────

describe('the presence gate (QA-01)', () => {
  it('renders on all three centre views once the viewport has moved', async () => {
    renderMap()
    await ready()
    for (const label of ['Hotspots', 'Media Targets', 'Nearby Lifers'] as const) {
      await goTo(label)
      setBounds(BAY)
      await waitFor(() => expect(searchBtn()).toBeTruthy())
    }
  })

  it('is absent on My Sightings, at any viewport, in any state (QA-02)', async () => {
    renderMap()
    await ready()
    setBounds(BAY)
    expect(searchBtn()).toBeNull()
    setBounds(LA)
    expect(searchBtn()).toBeNull()
    // ...and no indicator either.
    expect(screen.queryByTestId('searched-area')).toBeNull()
  })

  it('is absent before the map has reported any bounds', async () => {
    renderMap()
    await ready()
    await goTo('Hotspots')
    // BoundsTracker has mounted but nothing has been pushed, so mapBounds is
    // null and the derivation returns null.
    expect(searchBtn()).toBeNull()
  })

  it('is absent while the phone Filters overlay is open, and returns when it closes (QA-05)', async () => {
    renderMap()
    await ready()
    await goTo('Hotspots')
    setBounds(BAY)
    await waitFor(() => expect(searchBtn()).toBeTruthy())

    fireEvent.click(screen.getByRole('button', { name: 'Open map filters' }))
    await waitFor(() => expect(searchBtn()).toBeNull())

    fireEvent.click(screen.getByRole('button', { name: 'Close filters' }))
    await waitFor(() => expect(searchBtn()).toBeTruthy())
  })

  it('is absent when the view is not runnable (no eBird key)', async () => {
    keys.ebird = null
    renderMap()
    await ready()
    await goTo('Hotspots')
    setBounds(BAY)
    // The key notice is up, which is the observable proof the gate is live
    // rather than the view simply not having settled.
    await waitFor(() => expect(screen.queryByText(/eBird API key/i)).toBeTruthy())
    expect(searchBtn()).toBeNull()
  })

  it('is absent while a fetch for the active view is in flight (QA-13)', async () => {
    let release!: (v: unknown) => void
    net.get = () => new Promise(res => { release = res })
    renderMap()
    await ready()
    await goTo('Hotspots')
    setBounds(BAY)
    await waitFor(() => expect(searchBtn()).toBeTruthy())

    fireEvent.click(searchBtn()!)
    await waitFor(() => expect(searchBtn()).toBeNull())
    // The loading chip is up, which is what makes the two mutually exclusive by
    // construction rather than by remembering to check.
    expect(screen.getByText('Finding hotspots…')).toBeTruthy()

    await act(async () => { release(HOTSPOT_ROWS) })
  })

  it('is absent immediately after a successful search of the same area (QA-11)', async () => {
    renderMap()
    await ready()
    await goTo('Hotspots')
    setBounds(BAY)
    await waitFor(() => expect(searchBtn()).toBeTruthy())
    fireEvent.click(searchBtn()!)
    await waitFor(() => expect(searchBtn()).toBeNull())
    // Still absent after the fetch settles: the record now matches the viewport.
    await waitFor(() => expect(screen.queryByText('Finding hotspots…')).toBeNull())
    expect(searchBtn()).toBeNull()
  })
})

// ── QA-11 / QA-12: suppression, both sides of the threshold ─────────────────

describe('suppression by movement (QA-11, QA-12)', () => {
  async function searchBay() {
    renderMap()
    await ready()
    await goTo('Hotspots')
    setBounds(BAY)
    await waitFor(() => expect(searchBtn()).toBeTruthy())
    fireEvent.click(searchBtn()!)
    await waitFor(() => expect(searchBtn()).toBeNull())
    await waitFor(() => expect(screen.queryByText('Finding hotspots…')).toBeNull())
  }

  it('stays absent after a pan under the threshold (QA-11)', async () => {
    await searchBay()
    setBounds(BAY_NUDGE)
    expect(searchBtn()).toBeNull()
  })

  it('returns after a pan past the threshold, and withdraws again on the way back (QA-12)', async () => {
    await searchBay()
    setBounds(LA)
    await waitFor(() => expect(searchBtn()).toBeTruthy())
    setBounds(BAY)
    await waitFor(() => expect(searchBtn()).toBeNull())
  })

  /**
   * ZOOM THAT CHANGES NOTHING A PRESS WOULD SEND, WIRED.
   *
   * Two distinct reasons the control must stay away, both exercised here on one
   * unmoved centre, because they are the two halves of the shipped predicate:
   *
   *   spans 0.02 to 0.06 derive the 5 mi rung — a DIFFERENT record, so the
   *   movement term says offer — and the coverage term withdraws it, because
   *   that smaller circle is entirely inside the 10 mi one already searched;
   *
   *   spans 0.08 to 0.15 derive the same 10 mi rung about the same centre, so
   *   a press would send the identical request and the movement term says no.
   *
   * Spans chosen from the rung boundaries rather than at random: a sweep that
   * happened to sit entirely in one band would exercise one of these and look
   * like it had covered both.
   */
  it('stays absent while zoom changes nothing a press would send', async () => {
    await searchBay()
    const centred = (span: number): MarkerBounds =>
      [AREA_BAY.lng - span, AREA_BAY.lat - span / 2, AREA_BAY.lng + span, AREA_BAY.lat + span / 2]
    for (const span of [0.02, 0.05, 0.06, 0.08, 0.125, 0.15]) {
      setBounds(centred(span))
      await waitFor(() => expect(drawn.record).toBeTruthy())
      expect(searchBtn(), `span ${span}`).toBeNull()
    }
  })

  it('RETURNS when zooming out crosses a rung, with the centre unmoved', async () => {
    // The other side of the test above, and the reason it cannot simply assert
    // "zoom never offers". The centre is identical; only the derived radius has
    // moved, from 10 mi to 25. Without this the component could ignore the
    // derived radius entirely and every "stays absent" assertion above would
    // still pass.
    await searchBay()
    expect(searchBtn()).toBeNull()
    const wider: MarkerBounds =
      [AREA_BAY.lng - 0.3, AREA_BAY.lat - 0.15, AREA_BAY.lng + 0.3, AREA_BAY.lat + 0.15]
    expect(deriveSearchArea(pad(wider))!.radiusMi).toBe(25)
    expect(drawn.record!.radiusMi).toBe(10)
    setBounds(wider)
    await waitFor(() => expect(searchBtn()).toBeTruthy())
  })

  /**
   * THE CAPPED-AND-UNMOVED TRIPWIRE, WIRED.
   *
   * Past DERIVED_MAX_MI the searched circle is deliberately smaller than the
   * viewport, so the coverage term says "offer" and keeps saying it however long
   * the map sits still. The movement term is the only thing withholding the
   * control here, and this is the failure mode that reads as "it never goes
   * away" rather than "it fails to appear".
   */
  it('stays absent after a CAPPED search on an unmoved map', async () => {
    renderMap()
    await ready()
    await goTo('Hotspots')
    setBounds(WIDE)
    await waitFor(() => expect(searchBtn()).toBeTruthy())
    fireEvent.click(searchBtn()!)
    await waitFor(() => expect(drawn.record).toBeTruthy())
    expect(deriveSearchArea(pad(WIDE))!.capped).toBe(true)
    expect(drawn.record!.radiusMi).toBe(DERIVED_MAX_MI)
    // Re-report the identical viewport, the way a settling map would.
    setBounds(WIDE)
    await waitFor(() => expect(drawn.record).toBeTruthy())
    expect(searchBtn()).toBeNull()
  })

  it('stays absent for a pan that leaves the whole viewport inside the searched circle', async () => {
    // The containment half of the shipped predicate, WIRED. Without this the
    // component could hand the predicate no bounds at all and that half would be
    // inert in the shipped app with the rest of this file green — which is
    // exactly what a mutation run found before this test existed.
    //
    // A ~2 mi pan, viewed through a ~1.6 mi window: that window derives the 5 mi
    // rung against a recorded 10, so the movement test alone WOULD offer the
    // control (asserted below, so this cannot pass by the fixture simply not
    // changing), while every corner on screen is still inside the 10 mi circle
    // that was searched.
    await searchBay()
    const northBy = (miles: number) => miles / (Math.PI * 3958.8 / 180)
    const zoomedInAndPanned: MarkerBounds = [
      AREA_BAY.lng - 0.0145, AREA_BAY.lat + northBy(2.0) - 0.0115,
      AREA_BAY.lng + 0.0145, AREA_BAY.lat + northBy(2.0) + 0.0115,
    ]
    const derived = deriveSearchArea(pad(zoomedInAndPanned))!
    const next: SearchRecord = { lat: derived.lat, lng: derived.lng, radiusMi: derived.radiusMi }
    expect(drawn.record!.radiusMi).toBe(AREA_BAY.radiusMi)
    expect(hasMovedFrom(next, drawn.record)).toBe(true)
    setBounds(zoomedInAndPanned)
    // Give the render a chance to put it back before asserting it did not.
    await waitFor(() => expect(drawn.record).toBeTruthy())
    expect(searchBtn()).toBeNull()
  })

  it('ignores the sidebar Radius control, which is not an input to the offer', async () => {
    // FR-13's predicate is a function of the VIEWPORT and the record, and of
    // nothing else. Turning the sidebar rung does not change what a press would
    // send, because the press derives its own radius — so it must not summon the
    // control on a map the user never moved.
    //
    // Both directions, because a `pendingSearch` that wrongly depended on the
    // radius state would flip on one of them whichever way the dependency ran.
    await searchBay()
    expect(searchBtn()).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: '25 mi' }))
    await waitFor(() => expect(
      screen.getByRole('button', { name: '25 mi' }).getAttribute('aria-pressed')).toBe('true'))
    expect(searchBtn()).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: '5 mi' }))
    await waitFor(() => expect(
      screen.getByRole('button', { name: '5 mi' }).getAttribute('aria-pressed')).toBe('true'))
    expect(searchBtn()).toBeNull()
  })
})

// ── QA-03 / QA-04: one control, correct dispatch, correct names ─────────────

describe('one control, dispatching to the active view (QA-03, QA-04)', () => {
  it.each([
    ['Hotspots', 'hotspots', '/map/hotspots'],
    ['Media Targets', 'targets', '/map/recent-obs'],
    ['Nearby Lifers', 'lifers', '/map/recent-obs'],
  ] as const)('on %s it calls %s and carries the right accessible name', async (label, view, path) => {
    renderMap()
    await ready()
    await goTo(label)
    setBounds(BAY)
    await waitFor(() => expect(searchBtn()).toBeTruthy())

    // Exactly one such control exists at any time.
    expect(document.querySelectorAll('.sr-map-search-area-btn')).toHaveLength(1)
    // The name is resolved by ROLE, which pins the guarantee rather than the
    // mechanism carrying it.
    expect(screen.getByRole('button', { name: SEARCH_AREA_LABEL[view] })).toBe(searchBtn())
    // ...and it contains the visible text verbatim (WCAG 2.5.3).
    expect(searchBtn()!.textContent).toContain('Search this area')
    expect(SEARCH_AREA_LABEL[view]).toContain('Search this area')

    ;(transport.get as ReturnType<typeof vi.fn>).mockClear()
    fireEvent.click(searchBtn()!)
    await waitFor(() => expect(searchCalls().length).toBeGreaterThan(0))
    expect(searchCalls().map(c => String(c[0]))).toEqual([path])
  })

  it('gives the three views three distinct names, distinct from every shipped one', async () => {
    renderMap()
    await ready()
    const names: string[] = []
    for (const [label, view] of [['Hotspots', 'hotspots'], ['Media Targets', 'targets'], ['Nearby Lifers', 'lifers']] as const) {
      await goTo(label)
      setBounds(BAY)
      await waitFor(() => expect(searchBtn()).toBeTruthy())
      // Read off the DOM, then checked against the constant, so this measures the
      // name the control actually carries rather than restating the table.
      expect(searchBtn()!.getAttribute('aria-label')).toBe(SEARCH_AREA_LABEL[view])
      names.push(searchBtn()!.getAttribute('aria-label')!)
      // A different view, so the next iteration re-derives from a fresh record.
      setBounds(LA)
    }
    const all = [
      ...names,
      ...(['hotspots', 'targets', 'lifers'] as const).map(searchAreaSearchedLabel),
      'Center the map on my location', 'Finding your location',
      'Copy the search center location', 'Close the location popup',
      'Set a search center to copy its location', 'Drop a pin at the map center',
      'Move the pin to the map center', 'Enter fullscreen', 'Exit fullscreen',
      'Open map filters',
    ]
    expect(new Set(all).size).toBe(all.length)
  })
})

// ── QA-14 / QA-15: adoption, sent values, and the record ────────────────────

/**
 * THE DELIBERATE ASYMMETRY THIS BLOCK EXISTS TO PIN (FR-10, revised).
 *
 * A press adopts the derived CENTRE into the sidebar's coordinate boxes and
 * SENDS the derived RADIUS, but does not write that radius into the sidebar's
 * Radius control. The user chose to keep that setting, so the radius that went
 * out and the radius on screen in the sidebar are allowed to differ, and the
 * drawn circle is what reports the size actually searched.
 *
 * That makes the sent radius harder to get right, not easier, which is why the
 * tests below assert both halves on the same press: the request must carry the
 * DERIVED value while the SegControl must still show the user's. An
 * implementation that "simplified" the handlers to read `radius` off state would
 * now be wrong on every press rather than on a first one, and it would look
 * perfectly consistent from the sidebar.
 */
describe('adoption and the values that are sent (QA-14, QA-15)', () => {
  it('adopts the derived centre, sends the derived radius, and leaves the Radius control alone', async () => {
    renderMap()
    await ready()
    await goTo('Hotspots')
    setBounds(BAY)
    await waitFor(() => expect(searchBtn()).toBeTruthy())
    ;(transport.get as ReturnType<typeof vi.fn>).mockClear()

    fireEvent.click(searchBtn()!)
    await waitFor(() => expect(searchCalls().length).toBe(1))

    // The request carries the rounded centre and the DERIVED radius in km.
    const params = searchCalls()[0][1] as Record<string, string>
    expect(Number(params.lat)).toBeCloseTo(AREA_BAY.lat, 5)
    expect(Number(params.lng)).toBeCloseTo(AREA_BAY.lng, 5)
    expect(params.dist).toBe(distKm(AREA_BAY.radiusMi))
    // Non-vacuity: the derived rung is not the state default, so a handler that
    // ignored the passed radius and read `radius` off its closure fails here.
    expect(AREA_BAY.radiusMi).not.toBe(DEFAULT_RADIUS_MI)
    expect(params.dist).not.toBe(distKm(DEFAULT_RADIUS_MI))

    // The coordinate fields show the same values, at 5 dp.
    const latField = screen.getByLabelText('Latitude') as HTMLInputElement
    const lngField = screen.getByLabelText('Longitude') as HTMLInputElement
    expect(latField.value).toBe(AREA_BAY.lat.toFixed(5))
    expect(lngField.value).toBe(AREA_BAY.lng.toFixed(5))

    // ...and the Radius SegControl is UNTOUCHED (FR-10, revised): it still shows
    // the rung that was selected before the press, not the derived one. The
    // whole pressed set is read, so a press that selected the derived rung
    // ALONGSIDE the user's would fail here too.
    expect(pressedRungs()).toEqual([`${DEFAULT_RADIUS_MI} mi`])
    expect(AREA_BAY.radiusMi).not.toBe(DEFAULT_RADIUS_MI)   // the two really differ
  })

  /**
   * FR-10 AT THE SIDEBAR, REVISED: the press LEAVES whatever rung the user had,
   * while the request goes out at the derived one.
   *
   * This is the discriminating test for the change, and it fails in both
   * directions on the same press. A press that wrote the derived rung into the
   * control (the pre-revision behaviour) fails the first assertion; a press that
   * "helpfully" sent the sidebar's radius instead of the derived one — the
   * mistake this design invites, since the two now visibly differ — fails the
   * second.
   *
   * The user is moved OFF both the default AND the derived value first, so
   * neither assertion can pass by landing on a value that was already there.
   */
  it('LEAVES the user\'s rung selected while sending the derived radius', async () => {
    renderMap()
    await ready()
    await goTo('Hotspots')
    // A rung that is neither the derived value nor the shipped default, so
    // "unchanged" is a real observation about the press and not about the mount.
    const other = RUNGS.find(r => r !== AREA_BAY.radiusMi && r !== DEFAULT_RADIUS_MI)!
    fireEvent.click(screen.getByRole('button', { name: `${other} mi` }))
    expect(pressedRungs()).toEqual([`${other} mi`])

    setBounds(BAY)
    await waitFor(() => expect(searchBtn()).toBeTruthy())
    ;(transport.get as ReturnType<typeof vi.fn>).mockClear()
    fireEvent.click(searchBtn()!)
    await waitFor(() => expect(searchCalls().length).toBe(1))

    // The user's rung is still the selected one, and the only one...
    expect(pressedRungs()).toEqual([`${other} mi`])
    // ...and the request went out at the DERIVED radius, not that rung.
    expect((searchCalls()[0][1] as Record<string, string>).dist).toBe(distKm(AREA_BAY.radiusMi))
    expect((searchCalls()[0][1] as Record<string, string>).dist).not.toBe(distKm(other))
  })

  /**
   * The same two-sided claim on the OTHER side of the ladder, so neither
   * assertion can be an artefact of the derived rung happening to sit above the
   * sidebar's.
   *
   * Here the user's rung (50) is LARGER than the derived one (10). A press that
   * sent the sidebar's radius would search a circle five times too big and the
   * suite would otherwise still be green, because every other fixture in this
   * file has the derived value on top.
   */
  it('sends the derived radius even when the sidebar\'s rung is LARGER', async () => {
    renderMap()
    await ready()
    await goTo('Hotspots')
    const bigger = RUNGS.filter(r => r > AREA_BAY.radiusMi).pop()!
    expect(bigger).toBeGreaterThan(AREA_BAY.radiusMi)       // fixture precondition
    fireEvent.click(screen.getByRole('button', { name: `${bigger} mi` }))
    expect(pressedRungs()).toEqual([`${bigger} mi`])

    setBounds(BAY)
    await waitFor(() => expect(searchBtn()).toBeTruthy())
    ;(transport.get as ReturnType<typeof vi.fn>).mockClear()
    fireEvent.click(searchBtn()!)
    await waitFor(() => expect(searchCalls().length).toBe(1))

    expect((searchCalls()[0][1] as Record<string, string>).dist).toBe(distKm(AREA_BAY.radiusMi))
    expect((searchCalls()[0][1] as Record<string, string>).dist).not.toBe(distKm(bigger))
    expect(pressedRungs()).toEqual([`${bigger} mi`])
    // The DRAWN circle reports the size that was actually searched, which is the
    // whole reason the sidebar is allowed to disagree with it.
    await waitFor(() => expect(drawn.record).toBeTruthy())
    expect(drawn.record!.radiusMi).toBe(AREA_BAY.radiusMi)
  })

  /**
   * THE PRESS PATH READS NO SETTING. Whatever the saved `map-defaults` `dist`
   * put in the Radius control, a press sends what the VIEWPORT derives.
   *
   * Both saved values are checked, and both differ from the derived rung, so the
   * assertion discriminates in both directions: an implementation that read the
   * settings store on the button's own path would send 80 in the first case and
   * 8 in the second, and neither is 16.
   */
  it.each<[string, number | null]>([
    ['a saved 50 mi default', 50],
    ['no saved default at all', null],
  ])('sends the DERIVED radius over %s', async (_name, saved) => {
    // The saved CENTRE is deliberately far from the BAY viewport (Los Angeles).
    // A saved centre near the Bay would have its view-switch search cover the
    // whole viewport, so the control would correctly never be offered and this
    // test would fail on its fixture rather than on the behaviour.
    savedDefaults.value = saved === null ? null : { lat: 34.05, lng: -118.25, dist: saved }
    renderMap()
    await ready()
    await goTo('Hotspots')
    const initial = saved ?? DEFAULT_RADIUS_MI
    await waitFor(() =>
      expect(screen.getByRole('button', { name: `${initial} mi` }).getAttribute('aria-pressed')).toBe('true'))
    expect(initial).not.toBe(AREA_BAY.radiusMi)

    setBounds(BAY)
    await waitFor(() => expect(searchBtn()).toBeTruthy())
    ;(transport.get as ReturnType<typeof vi.fn>).mockClear()
    fireEvent.click(searchBtn()!)
    await waitFor(() => expect(searchCalls().length).toBe(1))

    const params = searchCalls()[0][1] as Record<string, string>
    expect(params.dist).toBe(distKm(AREA_BAY.radiusMi))
    expect(params.dist).not.toBe(distKm(initial))
    // The centre is the viewport's, not the saved default's — the press moved
    // the centre, and to the viewport's rather than to the store's.
    expect(Number(params.lat)).toBeCloseTo(AREA_BAY.lat, 5)
    expect(Number(params.lat)).not.toBeCloseTo(34.05, 2)
    // ...and the saved radius survives the press untouched, so a user with a
    // 50 mi default still has a 50 mi default afterwards.
    expect(pressedRungs()).toEqual([`${initial} mi`])
  })

  /**
   * The one substantive non-`distKm` read of the radius inside a handler: the
   * client-side personal-location filter. It must use the SAME radius the
   * request did, or the map shows personal pins from a circle eBird was never
   * asked about.
   *
   * The fixture makes the two candidate values DISAGREE: this viewport derives
   * the 25 mi rung while the Radius state is still the 5 mi default, and the
   * backup's one personal location sits ~7.7 mi out — inside 25, outside 5. A
   * viewport where it falls outside BOTH, which most do, would pass under either
   * implementation and prove nothing. The rung is deliberately NOT clicked here:
   * leaving the state at 5 is what makes the two implementations differ.
   */
  it('filters personal locations against the same radius the request used', async () => {
    // Centre ~ (37.80, -122.30); the backup's only location is ~7.7 mi away.
    const wideBay: MarkerBounds = [-122.55, 37.60, -122.05, 38.00]

    renderMap()
    await ready()
    await goTo('Hotspots')
    // The discriminating precondition, asserted rather than assumed.
    expect(deriveSearchArea(pad(wideBay))!.radiusMi).toBe(25)
    expect(screen.getByRole('button', { name: `${DEFAULT_RADIUS_MI} mi` })
      .getAttribute('aria-pressed')).toBe('true')
    setBounds(wideBay)
    await waitFor(() => expect(searchBtn()).toBeTruthy())
    fireEvent.click(searchBtn()!)

    // Two eBird hotspots PLUS the personal location, which is inside the derived
    // 25 mi and outside the state's 5 mi. A handler filtering on the state
    // radius would read "2 hotspots found in this area."
    await waitFor(() => expect(statusRegion().textContent).toBe('3 hotspots found in this area.'))
  })

  /**
   * QA-10 — THE CAP, WIRED. A viewport spanning most of California wants a 466
   * mi covering radius; the press sends 25 mi (40 km) and no more, whatever the
   * user had selected beforehand.
   *
   * Swept across the whole ladder because the cap must not be reachable from any
   * starting rung — including 50, which the sidebar offers and the derived path
   * must never send.
   */
  it('caps the derived radius at DERIVED_MAX_MI however far out the map is', async () => {
    for (const r of RUNGS) {
      renderMap()
      await ready()
      await goTo('Hotspots')
      fireEvent.click(screen.getByRole('button', { name: `${r} mi` }))
      setBounds(WIDE)
      await waitFor(() => expect(searchBtn()).toBeTruthy())
      ;(transport.get as ReturnType<typeof vi.fn>).mockClear()
      fireEvent.click(searchBtn()!)
      await waitFor(() => expect(searchCalls().length).toBe(1))
      expect((searchCalls()[0][1] as Record<string, string>).dist, `from ${r} mi`)
        .toBe(distKm(DERIVED_MAX_MI))
      cleanup()
    }
    // ...and the sidebar still offers the rung the cap withholds (FR-09).
    expect(RUNGS).toContain(50)
    expect(DERIVED_MAX_MI).toBe(25)
  })

  it('records exactly the values that were sent (QA-15)', async () => {
    renderMap()
    await ready()
    await goTo('Hotspots')
    setBounds(BAY)
    await waitFor(() => expect(searchBtn()).toBeTruthy())
    fireEvent.click(searchBtn()!)
    await waitFor(() => expect(drawn.record).toBeTruthy())
    expect(drawn.record).toEqual({
      lat: AREA_BAY.lat, lng: AREA_BAY.lng, radiusMi: AREA_BAY.radiusMi,
    })
    // The record holds exactly THREE values. `capped` describes the derivation,
    // not the request, so it must not ride along: two searches that sent the
    // same three values have to compare equal.
    expect(Object.keys(drawn.record!).sort()).toEqual(['lat', 'lng', 'radiusMi'])
  })

  it('holds the values that were SENT even if the map moves mid-flight (QA-23, QA-25)', async () => {
    let release!: (v: unknown) => void
    net.get = () => new Promise(res => { release = res })
    renderMap()
    await ready()
    await goTo('Hotspots')
    setBounds(BAY)
    await waitFor(() => expect(searchBtn()).toBeTruthy())
    ;(transport.get as ReturnType<typeof vi.fn>).mockClear()
    fireEvent.click(searchBtn()!)
    await waitFor(() => expect(searchCalls().length).toBe(1))

    // Pan while the fetch is in flight. Nothing is cancelled and nothing new
    // starts: the control is suppressed for the duration.
    setBounds(LA)
    expect(searchBtn()).toBeNull()
    expect(searchCalls().length).toBe(1)

    await act(async () => { release(HOTSPOT_ROWS) })
    await waitFor(() => expect(drawn.record).toBeTruthy())
    // The record is the BAY search, not the LA viewport it settled into.
    expect(drawn.record!.lat).toBeCloseTo(AREA_BAY.lat, 5)
    expect(drawn.record!.lat).not.toBeCloseTo(AREA_LA.lat, 2)
    expect(searchCalls().length).toBe(1)
    // ...and the control is back, because the new viewport has moved from it.
    await waitFor(() => expect(searchBtn()).toBeTruthy())
  })
})

// ── QA-06 / QA-13: the network budget ───────────────────────────────────────

describe('the network budget (QA-06, QA-13)', () => {
  it('issues no request when the map is merely panned or zoomed (QA-06)', async () => {
    renderMap()
    await ready()
    await goTo('Hotspots')
    ;(transport.get as ReturnType<typeof vi.fn>).mockClear()
    for (let i = 0; i < 20; i += 1) {
      setBounds([-122.6 + i * 0.01, 37.6 + i * 0.01, -122.3 + i * 0.01, 37.9 + i * 0.01])
    }
    // The control is on screen the whole time and still nothing fires.
    expect(searchBtn()).toBeTruthy()
    expect(searchCalls()).toEqual([])
  })

  it('costs exactly one lookup for five presses without moving the map (QA-13)', async () => {
    let release!: (v: unknown) => void
    net.get = () => new Promise(res => { release = res })
    renderMap()
    await ready()
    await goTo('Hotspots')
    setBounds(BAY)
    await waitFor(() => expect(searchBtn()).toBeTruthy())
    ;(transport.get as ReturnType<typeof vi.fn>).mockClear()

    const btn = searchBtn()!
    btn.focus()                       // so the control is RETAINED rather than removed
    for (let i = 0; i < 5; i += 1) fireEvent.click(btn)
    await waitFor(() => expect(searchCalls().length).toBe(1))

    await act(async () => { release(HOTSPOT_ROWS) })
    await waitFor(() => expect(screen.queryByText('Finding hotspots…')).toBeNull())
    // ...and five more presses in the retained state are still no-ops.
    for (let i = 0; i < 5; i += 1) if (searchBtn()) fireEvent.click(searchBtn()!)
    expect(searchCalls().length).toBe(1)
  })
})

// ── The results fit, per view (the second QA cycle) ──────────────────────────
//
// The ratchet: a press's own results fit re-framed the map, which changed the
// derived rung, which re-offered the control, which spent a second lookup — 5 to
// 10 to 25 mi, one unrequested lookup per step. The cut is that a search derived
// FROM the framing does not re-frame. These tests are the WIRING of that cut;
// the fit itself is proved in map/resultsFit.test.tsx and the geometry that makes
// re-framing unavoidable is in lib/searchArea.test.ts.
//
// jsdom cannot see the defect — nothing here moves a real viewport, which is
// exactly why it shipped past a green suite — so what is asserted is the value
// each marker layer receives.

describe('a viewport-derived search does not re-frame the map', () => {
  it('hands the active view autoFit=false after a press, on each of the three views', async () => {
    const cases = [
      ['Hotspots', 'hotspots'],
      ['Media Targets', 'targets'],
      ['Nearby Lifers', 'lifers'],
    ] as const
    for (const [label, key] of cases) {
      renderMap()
      await ready()
      await goTo(label)
      setBounds(BAY)
      await waitFor(() => expect(searchBtn()).toBeTruthy())
      // The marker layer only mounts once that view HAS results, so there is no
      // "before" reading here; the true baseline is the sidebar test below.
      expect(fits[key], `${label} before`).toBeNull()
      fireEvent.click(searchBtn()!)
      await waitFor(() => expect(fits[key], `${label} after`).toBe(false))
      cleanup()
      fits.hotspots = null; fits.targets = null; fits.lifers = null
    }
  })

  it('keeps autoFit=true for the sidebar Find button, so shipped framing is untouched', async () => {
    renderMap()
    await ready()
    await goTo('Hotspots')
    setBounds(BAY)
    await waitFor(() => expect(searchBtn()).toBeTruthy())
    fireEvent.change(screen.getByLabelText('Latitude'), { target: { value: String(AREA_BAY.lat) } })
    fireEvent.change(screen.getByLabelText('Longitude'), { target: { value: String(AREA_BAY.lng) } })
    fireEvent.click(screen.getByRole('button', { name: 'Find Hotspots' }))
    await waitFor(() => expect(drawn.record).toBeTruthy())
    expect(fits.hotspots).toBe(true)
  })

  it('restores framing on the next sidebar search after a viewport-derived one', async () => {
    // The flag is written on EVERY success, not only when it is true. Written
    // only on the true branch, a single press would suppress framing for the rest
    // of the session — which is a worse bug than the one being fixed.
    renderMap()
    await ready()
    await goTo('Hotspots')
    setBounds(BAY)
    await waitFor(() => expect(searchBtn()).toBeTruthy())
    fireEvent.click(searchBtn()!)
    await waitFor(() => expect(fits.hotspots).toBe(false))
    fireEvent.click(screen.getByRole('button', { name: 'Find Hotspots' }))
    await waitFor(() => expect(fits.hotspots).toBe(true))
  })

  it('is per view: a press on Hotspots does not suppress the other two views\' framing', async () => {
    renderMap()
    await ready()
    await goTo('Hotspots')
    setBounds(BAY)
    await waitFor(() => expect(searchBtn()).toBeTruthy())
    fireEvent.click(searchBtn()!)
    await waitFor(() => expect(fits.hotspots).toBe(false))
    // Media Targets now has a centre (the press adopted it), so its view-mode
    // switch runs that view's own search — with framing intact, because the flag
    // is keyed per view.
    await goTo('Media Targets')
    await waitFor(() => expect(fits.targets).toBe(true))
    expect(fits.lifers).toBeNull()
  })

  it('leaves framing alone when the press FAILS, since no results arrived to frame', async () => {
    // FR-16: a failure writes neither the record nor this flag. Establish the
    // shipped framing with a sidebar search first, so "unchanged" is observable
    // rather than the marker layer simply never having mounted.
    renderMap()
    await ready()
    await goTo('Hotspots')
    setBounds(BAY)
    await waitFor(() => expect(searchBtn()).toBeTruthy())
    fireEvent.change(screen.getByLabelText('Latitude'), { target: { value: String(AREA_BAY.lat) } })
    fireEvent.change(screen.getByLabelText('Longitude'), { target: { value: String(AREA_BAY.lng) } })
    fireEvent.click(screen.getByRole('button', { name: 'Find Hotspots' }))
    await waitFor(() => expect(fits.hotspots).toBe(true))

    setBounds(LA)                                  // move, so the control returns
    await waitFor(() => expect(searchBtn()).toBeTruthy())
    net.get = async () => { throw new Error('nope') }
    fireEvent.click(searchBtn()!)
    await waitFor(() => expect(statusRegion().textContent).toBeTruthy())
    expect(fits.hotspots).toBe(true)
  })
})

// ── QA-16 / QA-17: the record is written by every route, and not by a failure ─

describe('the search record (QA-16, QA-17)', () => {
  it('is written by the sidebar Find button, so the control is not then offered (QA-16)', async () => {
    renderMap()
    await ready()
    await goTo('Hotspots')
    setBounds(BAY)
    await waitFor(() => expect(searchBtn()).toBeTruthy())

    // Set the sidebar to exactly what a press would have sent — the derived
    // centre AND the derived rung — then use the shipped Find button. The
    // control must withdraw, exactly as it would after its own press: the record
    // is written by the HANDLER, so every route into that handler writes one and
    // no route is special.
    //
    // The rung is set deliberately rather than left at the default. Leaving it
    // would make the sidebar search a genuinely SMALLER circle than the press
    // would send, in which case the control correctly stays offered because
    // there really is ground on screen that 5 mi did not reach. That is a
    // different (and correct) behaviour, and asserting withdrawal against it
    // would be asserting a bug.
    fireEvent.click(screen.getByRole('button', { name: `${AREA_BAY.radiusMi} mi` }))
    fireEvent.change(screen.getByLabelText('Latitude'), { target: { value: String(AREA_BAY.lat) } })
    fireEvent.change(screen.getByLabelText('Longitude'), { target: { value: String(AREA_BAY.lng) } })
    fireEvent.click(screen.getByRole('button', { name: 'Find Hotspots' }))

    await waitFor(() => expect(drawn.record).toBeTruthy())
    expect(drawn.record).toEqual({
      lat: AREA_BAY.lat, lng: AREA_BAY.lng, radiusMi: AREA_BAY.radiusMi,
    })
    await waitFor(() => expect(searchBtn()).toBeNull())
  })

  it('IS still offered after a sidebar search that covered less than the view', async () => {
    // The converse of the test above, and the reason its rung has to be set.
    // A sidebar Find at the 5 mi default over a viewport needing 10 leaves real
    // ground on screen unsearched, so the control correctly stays.
    renderMap()
    await ready()
    await goTo('Hotspots')
    setBounds(BAY)
    await waitFor(() => expect(searchBtn()).toBeTruthy())
    expect(screen.getByRole('button', { name: `${DEFAULT_RADIUS_MI} mi` })
      .getAttribute('aria-pressed')).toBe('true')
    expect(AREA_BAY.radiusMi).toBeGreaterThan(DEFAULT_RADIUS_MI)

    fireEvent.change(screen.getByLabelText('Latitude'), { target: { value: String(AREA_BAY.lat) } })
    fireEvent.change(screen.getByLabelText('Longitude'), { target: { value: String(AREA_BAY.lng) } })
    fireEvent.click(screen.getByRole('button', { name: 'Find Hotspots' }))

    await waitFor(() => expect(drawn.record).toBeTruthy())
    expect(drawn.record!.radiusMi).toBe(DEFAULT_RADIUS_MI)
    await waitFor(() => expect(searchBtn()).toBeTruthy())
  })

  it('is NOT written by a failure, so the control returns as soon as it settles (QA-17)', async () => {
    net.get = async () => { throw new Error('boom') }
    renderMap()
    await ready()
    await goTo('Hotspots')
    setBounds(BAY)
    await waitFor(() => expect(searchBtn()).toBeTruthy())
    fireEvent.click(searchBtn()!)

    await waitFor(() => expect(statusRegion().textContent).toBeTruthy())
    // No record was written, so no indicator was drawn...
    expect(drawn.record).toBeNull()
    expect(screen.queryByTestId('searched-area')).toBeNull()
    // ...and retry is the same single press, in the corner it never left.
    await waitFor(() => expect(searchBtn()).toBeTruthy())
  })
})

// ── QA-18 / QA-19 / QA-21: the indicator ────────────────────────────────────

describe('the searched-area indicator (QA-18, QA-21)', () => {
  it('is drawn after a successful search and is per-view', async () => {
    renderMap()
    await ready()
    await goTo('Hotspots')
    setBounds(BAY)
    await waitFor(() => expect(searchBtn()).toBeTruthy())
    fireEvent.click(searchBtn()!)
    await waitFor(() => expect(screen.queryByTestId('searched-area')).toBeTruthy())

    // Switching to a view with no record of its own removes it. Note that a
    // view-mode change with a valid centre FIRES that view's search (FR-15), so
    // "unsearched" has to be arranged rather than assumed: the recent-obs call
    // is made to fail, which writes no record.
    //
    // EVERY call is failed here, not just recent-obs, so that switching BACK
    // writes no record either. That is what makes the last assertion a test of
    // RETENTION rather than of a re-search happening to reproduce the same
    // numbers — which is what it was when a press still adopted its radius into
    // the sidebar, and is why it needed rewriting when that stopped. See the
    // test below for what a SUCCESSFUL return search does.
    net.get = async () => { throw new Error('boom') }
    await goTo('Nearby Lifers')
    await waitFor(() => expect(screen.queryByTestId('searched-area')).toBeNull())

    // ...and switching back restores that view's circle, because records are not
    // cleared on a view switch.
    await goTo('Hotspots')
    const el = await screen.findByTestId('searched-area')
    expect(JSON.parse(el.getAttribute('data-record')!)).toEqual({
      lat: AREA_BAY.lat, lng: AREA_BAY.lng, radiusMi: AREA_BAY.radiusMi,
    })
  })

  /**
   * THE ACCEPTED CONSEQUENCE OF LEAVING THE RADIUS ALONE, PINNED SO IT IS A
   * DECISION RATHER THAN A SURPRISE.
   *
   * Returning to a centre view re-runs that view's search from the SIDEBAR
   * (shipped FR-15 behaviour, older than this feature), and the sidebar's radius
   * is no longer the one the press derived. So a successful return search really
   * does search a different, smaller circle, and the record and the drawn ring
   * follow it down to that circle.
   *
   * That is the honest outcome: the ring's whole job is to report what was
   * ACTUALLY searched, and what was actually searched most recently is the 5 mi
   * sidebar circle. The alternative — leaving a 10 mi ring drawn over 5 mi of
   * results — would be the ring lying. The user accepted exactly this tradeoff
   * ("the map and sidebar can then disagree about what was last searched").
   *
   * Asserted rather than left to be discovered, because before the revision the
   * adoption hid it: the sidebar held the derived rung, so the return search
   * reproduced the same circle and nothing appeared to change.
   */
  it('lets a successful return search rewrite the ring to the circle IT searched', async () => {
    renderMap()
    await ready()
    await goTo('Hotspots')
    setBounds(BAY)
    await waitFor(() => expect(searchBtn()).toBeTruthy())
    fireEvent.click(searchBtn()!)
    await waitFor(() => expect(drawn.record?.radiusMi).toBe(AREA_BAY.radiusMi))
    // The precondition that makes this observable at all: the sidebar kept the
    // user's rung, so it and the ring now disagree.
    expect(pressedRungs()).toEqual([`${DEFAULT_RADIUS_MI} mi`])
    expect(AREA_BAY.radiusMi).not.toBe(DEFAULT_RADIUS_MI)

    // Leave and come back. The lifers search fails so it writes no record of its
    // own; the hotspots search on the way back succeeds, at the sidebar's radius.
    net.get = async (path: string) => {
      if (path === '/map/hotspots') return HOTSPOT_ROWS
      throw new Error('boom')
    }
    await goTo('Nearby Lifers')
    await goTo('Hotspots')

    // The ring reports the circle that was just searched, not the one the press
    // sent: same centre, the sidebar's radius.
    await waitFor(() => expect(drawn.record?.radiusMi).toBe(DEFAULT_RADIUS_MI))
    expect(drawn.record!.lat).toBe(AREA_BAY.lat)
    expect(drawn.record!.lng).toBe(AREA_BAY.lng)
    // ...and because that smaller circle no longer covers the viewport, the
    // control correctly comes back rather than the app pretending the area is
    // still searched.
    await waitFor(() => expect(searchBtn()).toBeTruthy())
  })

  it('is never drawn on My Sightings (QA-02, FR-19)', async () => {
    renderMap()
    await ready()
    await goTo('Hotspots')
    setBounds(BAY)
    await waitFor(() => expect(searchBtn()).toBeTruthy())
    fireEvent.click(searchBtn()!)
    await waitFor(() => expect(screen.queryByTestId('searched-area')).toBeTruthy())

    fireEvent.click(screen.getByRole('button', { name: 'My Sightings' }))
    await waitFor(() => expect(screen.queryByTestId('searched-area')).toBeNull())
  })
})

// ── QA-20 / QA-22 / QA-23 / QA-24 / QA-27: the live region ──────────────────

describe('the search-outcome live region (QA-27)', () => {
  /**
   * Half of a deliberately paired guard. This half proves the region is in the
   * DOM, correctly roled, and empty before any announcement.
   *
   * It CANNOT prove the region is in the ACCESSIBILITY TREE while idle, which is
   * the property that governs announcement — vitest loads no stylesheet, so a
   * `display: none` on the region would be invisible here and this test would
   * pass on that broken build. The half that rejects it is the stylesheet scan
   * in lib/mapSearchAreaCss.test.ts; the confirmation is an ariaSnapshot against
   * a real render, recorded in the PR description.
   */
  it('exists before any announcement, and holds nothing at all while idle', async () => {
    renderMap()
    await ready()
    const r = statusRegion()
    expect(r).toBeTruthy()
    expect(r.getAttribute('role')).toBe('status')
    expect(r.getAttribute('aria-live')).toBe('polite')
    expect(r.getAttribute('aria-hidden')).toBeNull()
    expect(r.closest('[aria-hidden="true"]')).toBeNull()
    // Not even a whitespace text node, so its textContent is exactly the message
    // once one arrives.
    expect(r.childNodes.length).toBe(0)
  })

  it.each([
    ['Hotspots', 2, '2 hotspots found in this area.'],
    ['Media Targets', 1, '1 recent sighting found in this area.'],
    ['Nearby Lifers', 1, '1 location with nearby lifers found in this area.'],
  ] as const)('announces the %s outcome verbatim (QA-22)', async (label, _n, expected) => {
    renderMap()
    await ready()
    await goTo(label)
    setBounds(BAY)
    await waitFor(() => expect(searchBtn()).toBeTruthy())
    fireEvent.click(searchBtn()!)
    await waitFor(() => expect(statusRegion().textContent).toBe(expected))
    expect(statusRegion().childNodes.length).toBe(1)
  })

  it.each([
    ['Hotspots', 'No hotspots found in this area.'],
    ['Media Targets', 'No recent sightings of your target species found in this area.'],
    ['Nearby Lifers', 'No nearby lifers found in this area.'],
  ] as const)('treats an empty %s result as a search, not a failure (QA-23)', async (label, expected) => {
    net.get = async () => []
    renderMap()
    await ready()
    await goTo(label)
    setBounds(BAY)
    await waitFor(() => expect(searchBtn()).toBeTruthy())
    fireEvent.click(searchBtn()!)

    await waitFor(() => expect(statusRegion().textContent).toBe(expected))
    // The area WAS searched: the record is written and the indicator drawn.
    expect(drawn.record).toBeTruthy()
    expect(screen.getByTestId('searched-area')).toBeTruthy()
    // ...and no error state anywhere.
    expect(document.querySelector('[role="alert"]')).toBeNull()
  })

  /**
   * QA-27's double-mutation case. Stated precisely, because the obvious reading
   * of it is wrong: this does NOT reject an unkeyed child. Each handler's
   * leading `setSearchOutcome('')` unmounts the message node before the fetch,
   * so the remount is a real DOM addition either way — the standing repo caveat
   * about mutation-counting.
   *
   * What it DOES reject: a region that reuses its message node across two
   * announcements, a region whose textContent is not exactly the message, and
   * the "append an invisible character to force a diff" workaround, which would
   * make every textContent assertion in this file quietly false. The assertion
   * that carries the real aria-live guarantee is the sequence semantics, tested
   * directly in lib/searchOutcomeState.test.ts.
   */
  it('replaces its message node across two searches producing the IDENTICAL sentence', async () => {
    renderMap()
    await ready()
    await goTo('Hotspots')
    setBounds(BAY)
    await waitFor(() => expect(searchBtn()).toBeTruthy())
    fireEvent.click(searchBtn()!)
    await waitFor(() => expect(statusRegion().textContent).toBe('2 hotspots found in this area.'))

    const first = statusRegion().firstElementChild!
    let mutations = 0
    const obs = new MutationObserver(recs => { mutations += recs.length })
    obs.observe(statusRegion(), { childList: true, subtree: true, characterData: true })

    // A different area, the same count, therefore the same sentence.
    setBounds(LA)
    await waitFor(() => expect(searchBtn()).toBeTruthy())
    fireEvent.click(searchBtn()!)
    // Wait on the POSITIVE condition, not just node replacement. The handler's
    // own leading setSearchOutcome('') empties the region first, so a bare
    // `firstElementChild !== first` is satisfied by the transient null and the
    // synchronous textContent read below then sees ''. That is the whole of the
    // intermittent CI failure; it needs the fetch to outlast waitFor's first
    // poll, which is why it only appears on a loaded runner. Asserting the text
    // AND the replacement together still rejects node reuse, which is what this
    // test exists to prove.
    await waitFor(() => {
      expect(statusRegion().textContent).toBe('2 hotspots found in this area.')
      expect(statusRegion().firstElementChild).not.toBe(first)
    })
    obs.disconnect()

    expect(mutations).toBeGreaterThan(0)
    expect(statusRegion().textContent).toBe('2 hotspots found in this area.')
    expect(statusRegion().childNodes.length).toBe(1)
  })

  it('announces a failure through the SAME node, and writes nothing into the location region (QA-24)', async () => {
    net.get = async () => { throw new Error('boom') }
    renderMap()
    await ready()
    await goTo('Hotspots')
    setBounds(BAY)
    await waitFor(() => expect(searchBtn()).toBeTruthy())
    fireEvent.click(searchBtn()!)

    await waitFor(() => expect(statusRegion().textContent).toBeTruthy())
    // This feature MINTS NO FAILURE COPY. The sentence announced is whatever
    // classifyOverlayError already produces for the sidebar, verbatim, so the
    // two surfaces can never disagree — which is asserted directly rather than
    // by pinning one of the several strings that classifier can return.
    const announced = statusRegion().textContent!
    expect(screen.getAllByText(announced).length).toBeGreaterThanOrEqual(2)

    // The visible node and the announced node are the SAME node, in the error
    // variant — never a duplicate .sr-only announcer.
    const msg = statusRegion().firstElementChild as HTMLElement
    expect(msg.className).toContain('sr-map-search-status-msg--error')
    expect(document.querySelectorAll('.sr-map-search-status-msg')).toHaveLength(1)

    // ...and the location-failure region is untouched. Its container must hold
    // nothing but its own message.
    expect(geoRegion().childNodes.length).toBe(0)
  })

  it('clears the outcome before the next fetch, leaving the chip the slot to itself', async () => {
    let release!: (v: unknown) => void
    renderMap()
    await ready()
    await goTo('Hotspots')
    setBounds(BAY)
    await waitFor(() => expect(searchBtn()).toBeTruthy())
    fireEvent.click(searchBtn()!)
    await waitFor(() => expect(statusRegion().textContent).toBe('2 hotspots found in this area.'))

    net.get = () => new Promise(res => { release = res })
    setBounds(LA)
    await waitFor(() => expect(searchBtn()).toBeTruthy())
    fireEvent.click(searchBtn()!)
    await waitFor(() => expect(screen.queryByText('Finding hotspots…')).toBeTruthy())
    expect(statusRegion().childNodes.length).toBe(0)

    await act(async () => { release(HOTSPOT_ROWS) })
  })
})

// ── QA-26: focus retention ──────────────────────────────────────────────────

describe('focus (QA-26)', () => {
  it('keeps focus on the control after an Enter press, in an aria-disabled state', async () => {
    renderMap()
    await ready()
    await goTo('Hotspots')
    setBounds(BAY)
    await waitFor(() => expect(searchBtn()).toBeTruthy())

    const btn = searchBtn()!
    btn.focus()
    expect(document.activeElement).toBe(btn)
    // fireEvent.click is what a keyboard Enter on a <button> dispatches.
    fireEvent.click(btn)
    await waitFor(() => expect(searchBtn()!.getAttribute('aria-disabled')).toBe('true'))

    // The control is still in the DOM, still focused, and NOT using the
    // `disabled` attribute — which would have dropped focus to <body>.
    expect(document.activeElement).toBe(searchBtn())
    expect(searchBtn()!.hasAttribute('disabled')).toBe(false)
    expect(searchBtn()!.getAttribute('aria-label'))
      .toBe(searchAreaSearchedLabel('hotspots'))

    // A further press is a no-op.
    await waitFor(() => expect(screen.queryByText('Finding hotspots…')).toBeNull())
    const before = searchCalls().length
    fireEvent.click(searchBtn()!)
    expect(searchCalls().length).toBe(before)
  })

  it('is removed once focus leaves it', async () => {
    renderMap()
    await ready()
    await goTo('Hotspots')
    setBounds(BAY)
    await waitFor(() => expect(searchBtn()).toBeTruthy())
    const btn = searchBtn()!
    btn.focus()
    fireEvent.click(btn)
    await waitFor(() => expect(searchBtn()!.getAttribute('aria-disabled')).toBe('true'))
    fireEvent.blur(searchBtn()!)
    await waitFor(() => expect(searchBtn()).toBeNull())
  })

  it('is removed immediately after a pointer press that never focused it', async () => {
    // The WKWebView case, which FR-24 explicitly permits removing at once.
    renderMap()
    await ready()
    await goTo('Hotspots')
    setBounds(BAY)
    await waitFor(() => expect(searchBtn()).toBeTruthy())
    expect(document.activeElement).not.toBe(searchBtn())
    fireEvent.click(searchBtn()!)
    await waitFor(() => expect(searchBtn()).toBeNull())
  })

  it('drops the retained state on a view switch and on opening Filters', async () => {
    // Both can unmount the button without ever firing its blur, and a stale flag
    // would show a phantom disabled control.
    for (const escape of ['view', 'filters'] as const) {
      renderMap()
      await ready()
      await goTo('Hotspots')
      setBounds(BAY)
      await waitFor(() => expect(searchBtn()).toBeTruthy())
      searchBtn()!.focus()
      fireEvent.click(searchBtn()!)
      await waitFor(() => expect(searchBtn()!.getAttribute('aria-disabled')).toBe('true'))

      if (escape === 'view') {
        fireEvent.click(screen.getByRole('button', { name: 'Nearby Lifers' }))
        await waitFor(() => expect(searchBtn()).toBeNull())
        // Coming back must not show a phantom.
        fireEvent.click(screen.getByRole('button', { name: 'Hotspots' }))
        await waitFor(() => expect(searchBtn()).toBeNull())
      } else {
        fireEvent.click(screen.getByRole('button', { name: 'Open map filters' }))
        await waitFor(() => expect(searchBtn()).toBeNull())
        fireEvent.click(screen.getByRole('button', { name: 'Close filters' }))
        await waitFor(() => expect(searchBtn()).toBeNull())
      }
      cleanup()
    }
  })
})

// ── Cluster placement (E-01, E-02) ──────────────────────────────────────────

describe('where the control sits in the cluster', () => {
  it('is a full-width row AFTER the location-failure row and BEFORE the discs', async () => {
    // The cluster is bottom-anchored, so a row below the location-failure row
    // keeps an offset from the bottom that is invariant to whether a location
    // failure is on screen — the property that keeps a failed search's retry
    // from moving under the user's finger.
    renderMap()
    await ready()
    await goTo('Hotspots')
    setBounds(BAY)
    await waitFor(() => expect(searchBtn()).toBeTruthy())

    const kids = Array.from(cluster().children) as HTMLElement[]
    expect(kids[0].className).toBe('sr-map-geo-error')
    expect(kids[1].className).toBe('sr-map-search-area-row')
    expect(kids[1].contains(searchBtn())).toBe(true)
    expect(kids[2].className).toBe('sr-map-fab-slot')
    // DOM order IS tab order: no inline `order` anywhere in the cluster.
    for (const el of [cluster(), ...kids]) expect(el.style.order).toBe('')
  })

  it('carries the touch-target class and the shared control class, nothing inline for layout', async () => {
    renderMap()
    await ready()
    await goTo('Hotspots')
    setBounds(BAY)
    await waitFor(() => expect(searchBtn()).toBeTruthy())
    const btn = searchBtn()!
    expect(btn.className.split(/\s+/)).toContain('sr-map-search-area-btn')
    expect(btn.className.split(/\s+/)).toContain('sr-touch-target')
    expect(btn.getAttribute('type')).toBe('button')
    // Positioning, display, wrap and gap live in globals.css so the media
    // queries can reach them.
    for (const prop of ['display', 'position', 'flexWrap', 'gap', 'justifyContent'] as const) {
      expect(btn.style[prop], prop).toBe('')
    }
  })

  it('leads with a Search glyph that is hidden from assistive technology', async () => {
    renderMap()
    await ready()
    await goTo('Hotspots')
    setBounds(BAY)
    await waitFor(() => expect(searchBtn()).toBeTruthy())
    const svg = searchBtn()!.querySelector('svg')!
    expect(svg.getAttribute('aria-hidden')).toBe('true')
  })
})

// ── The sidebar control this feature touches (schema flag #3) ───────────────

describe('the sidebar radius control still renders exactly four rungs', () => {
  it('derives its options from RUNGS without changing what is displayed', async () => {
    // The feature's only touch of a shipped sidebar control. It is
    // behaviour-preserving, and this pins the four rendered labels so the
    // derivation cannot silently change the shipped control.
    renderMap()
    await ready()
    await goTo('Hotspots')
    for (const r of [5, 10, 25, 50]) {
      expect(screen.getByRole('button', { name: `${r} mi` })).toBeTruthy()
    }
    expect([...RUNGS]).toEqual([5, 10, 25, 50])
    // ...and every rung is selectable, including 50, which since the late
    // revision reaches the map button as readily as it reaches sidebar Find:
    // there is no derived maximum to be capped by.
    for (const r of RUNGS) {
      fireEvent.click(screen.getByRole('button', { name: `${r} mi` }))
      expect(screen.getByRole('button', { name: `${r} mi` }).getAttribute('aria-pressed')).toBe('true')
    }
  })
})

// ── QA-30 / QA-07: persistence and the viewport source ──────────────────────

describe('surface area (QA-30, QA-07)', () => {
  it('writes nothing through the storage seam on a press (QA-30)', async () => {
    const { storage } = await import('../lib/storage')
    renderMap()
    await ready()
    await goTo('Hotspots')
    setBounds(BAY)
    await waitFor(() => expect(searchBtn()).toBeTruthy())
    ;(storage.setSetting as ReturnType<typeof vi.fn>).mockClear()
    settingWrites.calls.length = 0

    fireEvent.click(searchBtn()!)
    await waitFor(() => expect(drawn.record).toBeTruthy())

    expect(storage.setSetting).not.toHaveBeenCalled()
    expect(settingWrites.calls).toEqual([])
  })

  /**
   * THE RADIUS HAS EXACTLY TWO WRITERS, AND NEITHER IS THIS FEATURE.
   *
   * The behavioural half is proved above ("LEAVES the user's rung selected"),
   * but that test only watches the PRESS path on one view. `applyCenter` is also
   * the pin drop and the pin drag, and it is the shared funnel all three centre
   * views run through — so a `setRadius` reintroduced there would move the user's
   * setting from several gestures at once, and the behavioural tests for the
   * other two views would not see it.
   *
   * So the writers are enumerated, and both are the user's own setting arriving:
   * the saved `map-defaults` on mount, and the sidebar's Radius SegControl. Any
   * third is a regression, whatever it looks like. This is the structural pin on
   * the user's decision to keep their Radius setting to themselves.
   */
  it('has exactly two setRadius writers, and applyCenter is not one of them', () => {
    const raw = readFileSync(resolve(process.cwd(), 'src/components/MapExplorer.tsx'), 'utf8')
    const code = raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1')
    // Guard the guard: the stripper must not have eaten the file, and it must
    // still see the identifier when it IS code. Without this a stripper that ate
    // everything would report zero writers and read as a pass.
    expect(code).toContain('export function MapExplorer')
    expect(code).toContain('const [radius, setRadius]')

    const writes = code.match(/setRadius\(/g) ?? []
    expect(writes).toHaveLength(2)
    expect(code).toContain('setRadius(data.dist)')          // saved map-defaults
    expect(code).toContain('setRadius(Number(v))')          // the sidebar SegControl

    // ...and applyCenter writes no radius at all. Sliced from its declaration to
    // its dependency array, so this reads the real body rather than the file.
    const start = code.indexOf('const applyCenter = useCallback(')
    expect(start).toBeGreaterThan(-1)
    const end = code.indexOf('}, [viewMode, hotspotsLoading', start)
    expect(end).toBeGreaterThan(start)
    const body = code.slice(start, end)
    expect(body).not.toContain('setRadius')
    // Non-vacuity, and the load-bearing half: the slice really is applyCenter's
    // body, and the derived radius really does reach the handlers. Without this
    // the assertion above would pass just as well on a body that had dropped the
    // radius entirely — which is the OTHER way this change could go wrong.
    expect(body).toContain('handleFindHotspots(latNum, lngNum, radiusMi, fromViewport)')
    expect(body).toContain('handleFindSightings(latNum, lngNum, radiusMi, fromViewport)')
    expect(body).toContain('handleFindLifers(latNum, lngNum, radiusMi, fromViewport)')

    // The `!== undefined` guard moved to the point of use inside each handler,
    // where it still matters: a truthiness test there would silently swap a
    // future 0 for the state value. Pinned in both spellings, once per handler.
    const useSites = code.match(/const radiusMi = overrideRadius !== undefined \? overrideRadius : radius/g) ?? []
    expect(useSites).toHaveLength(3)
    expect(code).not.toMatch(/overrideRadius \? overrideRadius : radius/)
  })

  it('reads the viewport only through BoundsTracker (QA-07)', () => {
    // FR-06 forbids a second reading of map.getBounds() and a second moveend
    // listener. Asserted against the shipped source, because a jsdom render with
    // a null map cannot observe either.
    //
    // COMMENTS ARE STRIPPED FIRST, and that is not tidiness: this component's
    // own comments explain that it adds no second getBounds and no second
    // moveend listener, and a raw-text scan matches those words and fails on a
    // correct build. It is the same trap entryChunk.test.ts and
    // exoticProvenanceGraph.test.ts already strip for.
    const raw = readFileSync(resolve(process.cwd(), 'src/components/MapExplorer.tsx'), 'utf8')
    const code = raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1')
    // Guard the guard: the stripper must not have eaten the file.
    expect(code).toContain('export function MapExplorer')
    expect(code.length).toBeGreaterThan(raw.length / 2)
    // ...and it must actually still see the words when they ARE code.
    expect(raw).toContain('getBounds')

    expect(code).not.toContain('getBounds')
    expect(code).not.toContain('moveend')
    // The derivation goes through the one composed entry point, which unpads
    // internally, rather than a second unpadBounds call site.
    expect(code).toContain('deriveSearchArea(mapBounds)')
    expect(code).not.toContain('unpadBounds')
  })
})

// ── The fit gate (OI-01 / QA-31, Stage-5 rework) ─────────────────────────────
//
// The control now also asks whether it has ANYWHERE TO BE: on a map area
// shorter than the shipped FAB cluster already needs, a full-width row above the
// discs lands outside the map or on top of the layers switcher's controls.
//
// jsdom cannot measure any of that and this block does not pretend to. The
// arithmetic is `searchControlFits` in lib/searchArea.test.ts; the rendered
// evidence is in pr-description.md. What IS testable here, and is exactly what a
// pure test cannot reach, is the WIRING: that MapExplorer feeds the predicate
// the disc line, the row and the container, and that a false answer removes the
// control — including its FR-24 retained state, which is `aria-disabled` rather
// than `disabled` and would otherwise stay a hit target over the switcher.

/**
 * Force the measured geometry. Every rect in jsdom is zero, so the hook's
 * inputs are supplied here by class. Returns a restore function.
 */
function stubGeometry(rects: { selector: string; rect: Partial<DOMRect> }[]) {
  const real = Element.prototype.getBoundingClientRect
  Element.prototype.getBoundingClientRect = function (this: Element) {
    const hit = rects.find(r => this.matches(r.selector))
    const base = { x: 0, y: 0, top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0 }
    return { ...base, ...(hit ? hit.rect : {}), toJSON: () => ({}) } as DOMRect
  }
  return () => { Element.prototype.getBoundingClientRect = real }
}

describe('the fit gate (OI-01)', () => {
  it('is OPEN under jsdom\'s all-zero geometry, so the rest of this file is not silently gated off', async () => {
    // Guard-the-guard for every other test here. With every rect zero the
    // predicate reads `0 - 0 - 0 >= max(0, 0)`, which is true. If a future
    // change made the gate default closed, the whole file would go green on a
    // control that never rendered, so this states the assumption out loud.
    renderMap()
    await ready()
    await goTo('Hotspots')
    setBounds(BAY)
    await waitFor(() => expect(searchBtn()).toBeTruthy())
  })

  it('removes the control when the row would not fit above the disc line', async () => {
    renderMap()
    await ready()
    await goTo('Hotspots')
    setBounds(BAY)
    await waitFor(() => expect(searchBtn()).toBeTruthy())

    // The 320x568 / 200% text, windowed reading: the map area is 171px tall and
    // the shipped disc line already sits 35px ABOVE its top, so an 88px control
    // row lands 133px outside the map, over the mode-bar chrome.
    const restore = stubGeometry([
      { selector: '.sr-map-fab', rect: { top: -35, height: 88 } },
      { selector: '.sr-map-search-area-row', rect: { top: -133, height: 88 } },
    ])
    try {
      setBounds(LA)                       // any re-render re-measures
      await waitFor(() => expect(searchBtn()).toBeNull())
    } finally { restore() }
  })

  it('removes the control when the row would cover the layers switcher controls', async () => {
    renderMap()
    await ready()
    await goTo('Hotspots')
    setBounds(BAY)
    await waitFor(() => expect(searchBtn()).toBeTruthy())

    // Here the row is INSIDE the map area — it is the switcher that rules it
    // out. A gate that only checked the container would pass this and leave the
    // Satellite and Topo (US) controls unpressable.
    const restore = stubGeometry([
      { selector: '.sr-map-fab', rect: { top: 97, height: 88 } },
      { selector: '.sr-map-search-area-row', rect: { top: 9, height: 88 } },
      { selector: '.sr-map-layers', rect: { top: 8, bottom: 105, height: 97 } },
    ])
    try {
      // The mocked SnowMap renders no switcher, so put one in the map area the
      // way the real one sits there: absolutely positioned inside it.
      const area = document.querySelector('.sr-map-fab-cluster')!.parentElement!
      const sw = document.createElement('div')
      sw.className = 'sr-map-layers'
      area.appendChild(sw)
      setBounds(LA)
      await waitFor(() => expect(searchBtn()).toBeNull())
      // ...and it comes back when the switcher is gone, so the assertion above
      // is about the switcher rather than about the re-render.
      sw.remove()
      setBounds(BAY)
      await waitFor(() => expect(searchBtn()).toBeTruthy())
    } finally { restore() }
  })

  it('also removes the FR-24 retained state, which is still a hit target', async () => {
    renderMap()
    await ready()
    await goTo('Hotspots')
    setBounds(BAY)
    await waitFor(() => expect(searchBtn()).toBeTruthy())
    // Press it with focus held, which is what arms the retained state.
    const btn = searchBtn()!
    btn.focus()
    fireEvent.click(btn)
    await waitFor(() => expect(searchBtn()?.getAttribute('aria-disabled')).toBe('true'))

    const restore = stubGeometry([
      { selector: '.sr-map-fab', rect: { top: -35, height: 88 } },
      { selector: '.sr-map-search-area-row', rect: { top: -133, height: 88 } },
    ])
    try {
      setBounds(LA)
      await waitFor(() => expect(searchBtn()).toBeNull())
    } finally { restore() }
  })
})
