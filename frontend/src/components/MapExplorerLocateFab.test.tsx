// @vitest-environment jsdom
//
// feature: map-location-buttons — the Map Explorer's on-map location control and
// the on-map home for its failure message.
//
// WHAT THIS TEST PROVES: presence across the four view modes and absence in the
// one branch with no map, the aria-disabled busy state and its re-entrancy
// guard, that focus survives a press that fails, that the six cluster accessible
// names stay pairwise distinct, that the live region exists before any failure,
// that a repeat failure with an IDENTICAL string still mutates the region, that
// the region has exactly one announcer (the sidebar block no longer carries
// role="alert"), that DOM order is share slot → locate → fullscreen → Filters,
// and that the glyph pair is a locate reticle against a flag.
//
// WHAT IT CANNOT PROVE (per CLAUDE.md, and NOT evidence for): anything
// geometric. jsdom has no layout engine, no media queries, and does not resolve
// the cascade against React inline styles, so it cannot show that the cluster
// fits 320px at 200% text scale, that the buttons do not move when a message
// appears, that :empty actually collapses the row, or that a pointer at the
// message's centre reaches the map canvas. Those are browser measurements and
// are written up in pipeline/map-location-buttons/pr-description.md.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, waitFor, fireEvent, act } from '@testing-library/react'
import type { ReactNode } from 'react'
import type { ObservationEntry } from '../types'

// ── Mocks: everything below the component (maplibre, network, disk) ──────────
vi.mock('react-map-gl/maplibre', () => ({
  useMap: () => ({ current: null }),
  Marker: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  Popup: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  // Source/Layer cover the SearchedAreaLayer this component now mounts once a
  // view has a search record (feature: search-this-area). No assertion in this
  // file changed; the mock simply covers the whole surface the component tree
  // touches, so the real layer renders inertly here rather than being hidden.
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
// Imported so the privacy guard below can assert against the seam, rather than
// only mocking it away.
import { transport } from '../lib/transport'

// SharePin is NOT mocked away wholesale: its portaled drop button is what proves
// the cluster's DOM order and the glyph pairing. Only its maplibre dependency is
// mocked (above), and useMap() returning null leaves the pin/gesture inert.

const filesStatus = vi.hoisted(() => ({ value: { ebird: true, ml: true } }))
vi.mock('../lib/storage', () => ({
  storage: {
    getApiKey: vi.fn().mockResolvedValue('k'),
    getSetting: vi.fn().mockResolvedValue(null),
    setSetting: vi.fn().mockResolvedValue(undefined),
    getFilesStatus: vi.fn(async () => filesStatus.value),
  },
}))

// The location seam. getCurrentLocation is driven per test; describeLocationError
// stays the REAL implementation so the rendered text is the shipped string.
const geo = vi.hoisted(() => ({
  impl: null as null | (() => Promise<{ lat: number; lng: number }>),
}))
vi.mock('../lib/location', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/location')>()
  return { ...actual, getCurrentLocation: vi.fn(() => geo.impl!()) }
})

const OBS: ObservationEntry[] = [{
  submissionId: 'S1', commonName: "Steller's Jay", scientificName: 'Cyanocitta stelleri',
  date: '2026-05-01', location: 'Tilden Park', locationId: 'L1',
  latitude: 37.9, longitude: -122.24,
  county: 'Alameda',
  count: 2, breedingCode: null, speciesComments: '', catalogIds: [],
  stateProvince: 'US-CA',
}]
const obsResult = vi.hoisted(() => ({ value: null as unknown }))
vi.mock('../lib/observationsCache', () => ({
  loadEbirdObservations: vi.fn(async () => obsResult.value),
}))
vi.mock('../lib/mlExportCache', () => ({
  loadMLExport: vi.fn(async () => ({ rows: [{ format: 'Photo' }], mediaMap: {} })),
}))

import { describeLocationError } from '../lib/location'
import { MapExplorer } from './MapExplorer'

const DENIED = describeLocationError({ code: 'permission-denied', platform: 'web' })
const TIMEOUT = describeLocationError({ code: 'timeout' })

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

const locateBtn = () => screen.queryByRole('button', { name: 'Center the map on my location' })
const busyBtn = () => screen.queryByRole('button', { name: 'Finding your location' })
const cluster = () => document.querySelector('.sr-map-fab-cluster') as HTMLElement
const region = () => document.querySelector('.sr-map-geo-error') as HTMLElement

/** Wait for the backup to resolve so the sidebar/map are past 'loading-saved'. */
async function ready() {
  await waitFor(() => expect(cluster()).toBeTruthy())
}

beforeEach(() => {
  filesStatus.value = { ebird: true, ml: true }
  obsResult.value = { observations: OBS }
  geo.impl = async () => ({ lat: 37.9, lng: -122.24 })
})
afterEach(() => { cleanup(); vi.clearAllMocks() })

// ── Presence and gating (QA-01, QA-02 as amended) ────────────────────────────

describe('the location control', () => {
  it('renders on all four view modes (QA-01)', async () => {
    renderMap()
    await ready()
    expect(locateBtn()).toBeTruthy()                        // sightings (default)
    for (const mode of ['Hotspots', 'Media Targets', 'Nearby Lifers']) {
      fireEvent.click(screen.getByRole('button', { name: mode }))
      await waitFor(() => expect(locateBtn()).toBeTruthy())
    }
  })

  // QA-02 AS AMENDED. The PRD's original wording tested the sightings +
  // setup-required combination; the Designer moved the gate from "is there data"
  // to "is there a map", so that one combination is now deliberately absent and
  // the three centre views are where the button's independence from data can
  // actually be observed. Both halves are asserted here so the amendment is a
  // decision the suite records, not a silent narrowing.
  it('renders with no backup, no key and isSetupRequired on the three centre views (QA-02)', async () => {
    filesStatus.value = { ebird: false, ml: false }
    obsResult.value = null
    renderMap()
    await ready()
    for (const mode of ['Hotspots', 'Media Targets', 'Nearby Lifers']) {
      fireEvent.click(screen.getByRole('button', { name: mode }))
      await waitFor(() => expect(locateBtn()).toBeTruthy())
      expect(locateBtn()!.getAttribute('aria-disabled')).toBe('false')
    }
  })

  it('is absent on My Sightings when SetupRequired replaces the map (QA-02, amended)', async () => {
    filesStatus.value = { ebird: false, ml: false }
    obsResult.value = null
    renderMap()
    await ready()
    // The branch is live: no map is mounted here.
    expect(screen.queryByTestId('snowmap')).toBeNull()
    expect(locateBtn()).toBeNull()
    // ...and the shipped cluster controls are unaffected.
    expect(screen.getByRole('button', { name: 'Enter fullscreen' })).toBeTruthy()
  })
})

// ── Cluster structure (QA-14, FR-10) ─────────────────────────────────────────

describe('cluster order', () => {
  // Updated by uniform-map-fabs: the three discs now carry the shared
  // .sr-map-fab base plus a size modifier, and on a centre view the share slot's
  // position is taken by the centre-share FAB (see
  // MapExplorerCenterShareFab.test.tsx). The ORDER itself is unchanged, which is
  // what this test is for.
  const classesOf = (el: HTMLElement) => el.className.split(/\s+/)

  it('is share slot, locate, fullscreen, Filters, with no CSS order (QA-14)', async () => {
    renderMap()
    await ready()
    const kids = Array.from(cluster().children) as HTMLElement[]
    // The message region is first in DOM order (it is not focusable, so tab
    // order is unaffected) and matches its visual position above the buttons.
    expect(kids[0].className).toBe('sr-map-geo-error')
    expect(kids[1].className).toBe('sr-map-fab-slot')
    expect(kids[1].querySelector('.sr-share-drop-btn')).toBeTruthy()
    expect(classesOf(kids[2])).toContain('sr-map-locate-btn')
    expect(classesOf(kids[3])).toContain('sr-map-fullscreen-btn')
    expect(kids[4].className).toBe('sr-map-filters-btn sr-touch-target')
    // DOM order IS tab order: nothing in the cluster carries an inline `order`.
    for (const el of [cluster(), ...kids]) expect(el.style.order).toBe('')
  })

  it('gives every disc the shared base AND exactly one size modifier', async () => {
    // .sr-map-fab svg reads `var(--sr-fab-glyph)` with NO fallback, and the
    // custom property is declared on the size modifiers — so a disc carrying the
    // base without a modifier renders a glyph with no width at all. Two
    // modifiers would be as bad in the other direction: both are (0,1,0), so
    // source order alone would pick the diameter.
    renderMap()
    await ready()
    const discs = [
      cluster().querySelector('.sr-share-drop-btn') as HTMLElement,
      screen.getByRole('button', { name: 'Center the map on my location' }),
      screen.getByRole('button', { name: 'Enter fullscreen' }),
    ]
    for (const el of discs) {
      const cls = classesOf(el)
      expect(cls, el.className).toContain('sr-map-fab')
      expect(cls.filter(c => c === 'sr-map-fab--std' || c === 'sr-map-fab--compact'), el.className).toHaveLength(1)
    }
  })
})

// ── Accessible names (QA-10, FR-07) ──────────────────────────────────────────

describe('accessible names', () => {
  it('are non-empty and pairwise distinct across the cluster (QA-10)', async () => {
    renderMap()
    await ready()
    const names = (Array.from(cluster().querySelectorAll('button')) as HTMLElement[])
      .map(b => b.getAttribute('aria-label') ?? '')
    expect(names).toEqual([
      'Drop a pin at the map center',
      'Center the map on my location',
      'Enter fullscreen',
      'Open map filters',
    ])
    for (const n of names) expect(n.length).toBeGreaterThan(0)
    expect(new Set(names).size).toBe(names.length)
    // Every name any cluster control can carry, in any state, on any view, must
    // be distinct from every other — including the three the centre-share FAB
    // adds (uniform-map-fabs). Two of those sit one disc away from "Drop a pin
    // at the map center" on a different view and must not be confusable with it.
    const all = [
      ...names,
      'Finding your location',
      'Move the pin to the map center',
      'Exit fullscreen',
      'Copy the search center location',
      'Close the location popup',
      'Set a search center to copy its location',
    ]
    expect(new Set(all).size).toBe(all.length)
  })

  it('mirrors the accessible name in title, following SharePin', async () => {
    renderMap()
    await ready()
    expect(locateBtn()!.getAttribute('title')).toBe('Center the map on my location')
  })
})

// ── Busy state (QA-08, QA-09; FR-05, FR-06) ──────────────────────────────────

describe('busy state', () => {
  it('shows the spinner, renames, guards re-entry, and keeps focus (QA-08, QA-09)', async () => {
    let release!: (v: { lat: number; lng: number }) => void
    const calls = { n: 0 }
    geo.impl = () => {
      calls.n += 1
      return new Promise(res => { release = res })
    }
    renderMap()
    await ready()

    const btn = locateBtn()!
    btn.focus()
    fireEvent.click(btn)
    await waitFor(() => expect(busyBtn()).toBeTruthy())

    // aria-disabled, NOT disabled: the element must stay focusable and focused.
    expect(busyBtn()!.getAttribute('aria-disabled')).toBe('true')
    expect(busyBtn()!.hasAttribute('disabled')).toBe(false)
    expect(document.activeElement).toBe(busyBtn())
    expect(busyBtn()!.querySelector('svg.lucide-loader-2, svg.lucide-loader-circle')).toBeTruthy()

    // A second press while in flight starts no second request.
    fireEvent.click(busyBtn()!)
    expect(calls.n).toBe(1)

    await act(async () => { release({ lat: 1, lng: 2 }) })
    await waitFor(() => expect(locateBtn()).toBeTruthy())
    // Focus is still on the same element across the whole cycle.
    expect(document.activeElement).toBe(locateBtn())
  })

  it('keeps focus on the button when the press resolves to a failure (QA-09)', async () => {
    geo.impl = async () => { throw { code: 'permission-denied', platform: 'web' } }
    renderMap()
    await ready()
    const btn = locateBtn()!
    btn.focus()
    fireEvent.click(btn)
    await waitFor(() => expect(region().textContent).toBe(DENIED))
    expect(document.activeElement).toBe(locateBtn())
  })
})

// ── The failure message (QA-17..QA-21, QA-23; FR-13..FR-17) ──────────────────

describe('the failure message', () => {
  /**
   * Half of a deliberately paired guard. This half proves the region is in the
   * DOM, correctly roled, and not aria-hidden while idle.
   *
   * It CANNOT prove the region is in the ACCESSIBILITY TREE while idle, which
   * is the property that governs announcement — vitest loads no stylesheet, so
   * a `display: none` on the region (which is exactly what shipped here in
   * review, via a `:empty` rule) is invisible to jsdom and this test passes on
   * that broken build. The half that rejects it is the stylesheet scan in
   * lib/mapFabClusterCss.test.ts; the confirmation is an ariaSnapshot against a
   * real render, recorded in the PR description.
   */
  it('exists as a live region before any failure, and is empty (QA-20)', async () => {
    renderMap()
    await ready()
    const r = region()
    expect(r).toBeTruthy()
    expect(r.getAttribute('role')).toBe('status')
    expect(r.getAttribute('aria-live')).toBe('polite')
    // Never hidden from assistive technology while idle — the SharePopup
    // contract, and the reason no :empty collapse rule may exist for it.
    expect(r.getAttribute('aria-hidden')).toBeNull()
    expect(r.closest('[aria-hidden="true"]')).toBeNull()
    // The container holds NO node at all while idle — not even a whitespace
    // text node — so its textContent is exactly the message once one arrives.
    expect(r.childNodes.length).toBe(0)
  })

  it('renders describeLocationError verbatim (QA-17, QA-18)', async () => {
    for (const [code, expected] of [
      ['permission-denied', DENIED],
      ['timeout', TIMEOUT],
      ['unavailable', describeLocationError({ code: 'unavailable' })],
      ['insecure-context', describeLocationError({ code: 'insecure-context' })],
      ['dev-mode', describeLocationError({ code: 'dev-mode' })],
    ] as const) {
      geo.impl = async () => { throw { code, platform: 'web' } }
      renderMap()
      await ready()
      fireEvent.click(locateBtn()!)
      await waitFor(() => expect(region().textContent).toBe(expected))
      cleanup()
    }
  })

  it('is the only live region for this value (QA-21, FR-15)', async () => {
    geo.impl = async () => { throw { code: 'permission-denied', platform: 'web' } }
    renderMap()
    await ready()
    // A centre view, where the sidebar's own copy and the on-map region are both
    // in the tree at once — the exact case FR-15 constrains.
    fireEvent.click(screen.getByRole('button', { name: 'Hotspots' }))
    await waitFor(() => expect(locateBtn()).toBeTruthy())
    fireEvent.click(locateBtn()!)
    await waitFor(() => expect(region().textContent).toBe(DENIED))

    // Both copies are visible (accepted and deliberate)...
    expect(screen.getAllByText(DENIED).length).toBe(2)
    // ...but exactly one of them announces.
    const announcers = Array.from(document.querySelectorAll('[role="alert"], [role="status"], [aria-live]'))
      .filter(el => el.textContent === DENIED)
    expect(announcers).toEqual([region()])
  })

  it('clears on a successful detection and on a view-mode change (QA-23)', async () => {
    geo.impl = async () => { throw { code: 'timeout' } }
    renderMap()
    await ready()
    fireEvent.click(locateBtn()!)
    await waitFor(() => expect(region().textContent).toBe(TIMEOUT))

    // Success clears it (the handler's leading setGeoError('')).
    geo.impl = async () => ({ lat: 37.9, lng: -122.24 })
    fireEvent.click(locateBtn()!)
    await waitFor(() => expect(region().childNodes.length).toBe(0))

    // ...and so does a view change.
    geo.impl = async () => { throw { code: 'timeout' } }
    fireEvent.click(locateBtn()!)
    await waitFor(() => expect(region().textContent).toBe(TIMEOUT))
    fireEvent.click(screen.getByRole('button', { name: 'Nearby Lifers' }))
    await waitFor(() => expect(region().childNodes.length).toBe(0))
  })

  /**
   * QA-19, DOM half. What this rejects, stated precisely, because the obvious
   * reading of it is wrong.
   *
   * It does NOT reject an unkeyed child. handleUseMyLocation's leading
   * setGeoError('') commits before the await resolves, so the message node
   * genuinely unmounts and remounts between two presses and the remount is a
   * real DOM addition either way. That was verified during this build by
   * removing the key and watching this test still pass — the exact
   * false-confidence case CLAUDE.md records, and worth recording rather than
   * papering over. In the shipped component there is in fact NO press sequence
   * that lands two identical messages with no clear between them, so the key's
   * DOM effect is unreachable from the UI today. The sequence semantics it rides
   * on are where the discrimination is real, and they are tested in
   * lib/geoErrorState.test.ts.
   *
   * What this DOES reject: a region that reuses its message node across two
   * failures (which is what an implementation without the leading clear would
   * do), a region whose textContent is not exactly the message, and the
   * "append an invisible character to force a diff" workaround, which would make
   * every textContent assertion in this file quietly false.
   */
  it('replaces the message node across two identical failures (QA-19)', async () => {
    geo.impl = async () => { throw { code: 'timeout' } }
    renderMap()
    await ready()
    fireEvent.click(locateBtn()!)
    await waitFor(() => expect(region().textContent).toBe(TIMEOUT))

    const first = region().firstElementChild!
    let mutations = 0
    const obs = new MutationObserver(recs => { mutations += recs.length })
    obs.observe(region(), { childList: true, subtree: true, characterData: true })

    fireEvent.click(locateBtn()!)
    await waitFor(() => expect(region().firstElementChild).not.toBe(first))
    obs.disconnect()

    // The node was replaced, which is what an assistive technology observes...
    expect(mutations).toBeGreaterThan(0)
    // ...and the region still reads exactly the message, with no marker
    // character appended to force a diff.
    expect(region().textContent).toBe(TIMEOUT)
    expect(region().childNodes.length).toBe(1)
  })

  it('survives the phone Filters overlay, where the sidebar control is the one that can fail', async () => {
    // The cluster's BUTTONS are gated on !sidebarOpen exactly as shipped, but the
    // wrapper and the region are not: with role="alert" gone from the sidebar
    // block, unmounting the region here would leave that state with no announcer
    // at all — a regression on today's behavior.
    geo.impl = async () => { throw { code: 'timeout' } }
    renderMap()
    await ready()
    // The sidebar's own "Use my location" lives in CenterPointControl, which the
    // three centre views render (My Sightings has no coordinate controls at all,
    // so no failure is reachable there with the overlay open).
    fireEvent.click(screen.getByRole('button', { name: 'Hotspots' }))
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Use my location' })).toBeTruthy())
    fireEvent.click(screen.getByRole('button', { name: 'Open map filters' }))
    await waitFor(() => expect(locateBtn()).toBeNull())
    expect(region()).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Use my location' }))
    await waitFor(() => expect(region().textContent).toBe(TIMEOUT))
  })
})

// ── The privacy property (QA-05, QA-06, QA-12; FR-09, FR-25) ─────────────────

/**
 * The claim PRIVACY_POLICY.md now rests on: pressing the location button on My
 * Sightings transmits no coordinate anywhere. It holds because
 * handleUseMyLocation gates all three searches behind
 * `viewMode === 'hotspots' | 'targets' | 'lifers'`, and `'sightings'` matches
 * no branch.
 *
 * It had been verified only by watching a live browser's network panel, which
 * checks this revision and guards nothing. A fourth view, an added `else`, or a
 * refactor of `wasEmpty` could break a published privacy claim with the whole
 * suite green.
 *
 * Written as a PAIR so it discriminates. The negative case alone passes on any
 * implementation that never calls the transport at all — including one that has
 * silently stopped searching on the centre views — so the positive case is what
 * proves the negative one is about the view gate rather than about a dead seam.
 */
describe('a press on My Sightings sends no coordinate anywhere (FR-25)', () => {
  /** Transport calls that carry the detected coordinate, ignoring unrelated setup traffic. */
  const coordCalls = () =>
    (transport.get as ReturnType<typeof vi.fn>).mock.calls
      .filter(([path, params]) => /hotspots|recent-obs/.test(String(path)) || (params && 'lat' in (params as object)))

  /**
   * Press, then wait for the handler to have run to completion. The busy state
   * is the observable start and its clearing (in the handler's `finally`) is
   * the observable end, so this cannot assert "no request" against a handler
   * that simply had not got there yet. My Sightings has no coordinate fields to
   * watch, which is why the button's own state is the signal.
   */
  async function pressAndSettle() {
    let release!: (v: { lat: number; lng: number }) => void
    geo.impl = () => new Promise(res => { release = res })
    fireEvent.click(locateBtn()!)
    await waitFor(() => expect(busyBtn()).toBeTruthy())
    await act(async () => { release({ lat: 37.9, lng: -122.24 }) })
    await waitFor(() => expect(locateBtn()).toBeTruthy())
  }

  it('issues no search on sightings, with both coordinate fields empty (QA-05, QA-12)', async () => {
    renderMap()
    await ready()
    expect(locateBtn()).toBeTruthy()
    ;(transport.get as ReturnType<typeof vi.fn>).mockClear()
    ;(transport.post as ReturnType<typeof vi.fn>).mockClear()

    await pressAndSettle()

    expect(coordCalls()).toEqual([])
    expect(transport.post).not.toHaveBeenCalled()
  })

  it('DOES run the search on a centre view, so the guard above is about the view gate (QA-06)', async () => {
    renderMap()
    await ready()
    fireEvent.click(screen.getByRole('button', { name: 'Hotspots' }))
    await waitFor(() => expect(locateBtn()).toBeTruthy())
    ;(transport.get as ReturnType<typeof vi.fn>).mockClear()

    await pressAndSettle()

    const calls = coordCalls()
    expect(calls.length).toBeGreaterThan(0)
    expect(String(calls[0][0])).toContain('hotspots')
    // The coordinate that leaves is the DETECTED one. Compared numerically so a
    // formatting change does not fail this, but a wrong coordinate does.
    const params = calls[0][1] as Record<string, string>
    expect(Number(params.lat)).toBeCloseTo(37.9, 4)
    expect(Number(params.lng)).toBeCloseTo(-122.24, 4)
  })
})

// ── The glyph pair (QA-24, QA-27; FR-18, FR-19, FR-21) ───────────────────────

describe('the glyph pair', () => {
  it('is a locate reticle against a flag, and neither is MapPin (QA-24, QA-27)', async () => {
    renderMap()
    await ready()
    expect(locateBtn()!.querySelector('svg.lucide-locate-fixed')).toBeTruthy()
    const share = cluster().querySelector('.sr-share-drop-btn')!
    expect(share.querySelector('svg.lucide-flag-triangle-right')).toBeTruthy()
    // Different silhouettes, so the pair survives grayscale (FR-21). Neither is
    // MapPin, and neither is Navigation (whose dominant mass is a triangle, like
    // the flag's). MapPin is NOT retired app-wide as of uniform-map-fabs — it is
    // the centre-share FAB's glyph, naming the teardrop search-centre pin — but
    // it is still wrong for either of these two, and that button is on a
    // different view (MapExplorerCenterShareFab.test.tsx covers the pairing
    // there, which is a crosshair against a teardrop).
    for (const el of [locateBtn()!, share as HTMLElement]) {
      expect(el.querySelector('svg.lucide-map-pin')).toBeNull()
      expect(el.querySelector('svg.lucide-navigation')).toBeNull()
    }
  })

  it('changes the sidebar control in the same edit, so both centring controls match (FR-18)', async () => {
    renderMap()
    await ready()
    // CenterPointControl renders on the three centre views.
    fireEvent.click(screen.getByRole('button', { name: 'Hotspots' }))
    const sidebarBtn = await screen.findByRole('button', { name: 'Use my location' })
    expect(sidebarBtn.querySelector('svg.lucide-locate-fixed')).toBeTruthy()
    expect(sidebarBtn.querySelector('svg.lucide-navigation')).toBeNull()
  })
})
