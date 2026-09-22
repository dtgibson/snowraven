// @vitest-environment jsdom
//
// fix: map-explorer-input-zoom — the nine Map Explorer sidebar form controls
// must carry .sr-input-16 so the ≤640 tier sizes them to max(16px, 0.75rem) and
// iOS stops zooming the viewport on focus.
//
// WHAT THIS TEST PROVES: that the class reaches each of the nine control
// ELEMENTS, and specifically that it sits on the <input>/<select> itself rather
// than a wrapper. That placement is the whole historical failure mode — the
// guard sat inert on ~25 inputs until v0.5.61 because the class was one level
// too high, and nothing failed. Asserting `el.tagName` alongside the class is
// what makes a wrapper placement fail here.
//
// WHAT IT CANNOT PROVE (and is NOT evidence for): that the rule WINS. jsdom has
// no layout engine, no media queries, and does not resolve the cascade against
// React inline styles, so it cannot show that .sr-input-16's !important beats
// each control's inline fontSize, that the computed size is ≥16px at a phone
// width, or that nothing wraps or clips. Per CLAUDE.md that proof is a browser
// measurement of getComputedStyle().fontSize on all nine plus a visual check of
// the Date Range and Lat/Lng rows; it was done for this fix and is written up in
// pipeline/map-explorer-input-zoom/pr-description.md. This test is the cheap
// structural half that keeps the placement from silently regressing.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, waitFor, fireEvent } from '@testing-library/react'
import type { ReactNode } from 'react'
import type { ObservationEntry } from '../types'

// ── Mocks: everything below the sidebar (maplibre, network, disk) ────────────
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

const filesStatus = vi.hoisted(() => ({ value: { ebird: true, ml: true } }))
vi.mock('../lib/storage', () => ({
  storage: {
    getApiKey: vi.fn().mockResolvedValue('k'),
    getSetting: vi.fn().mockResolvedValue(null),
    setSetting: vi.fn().mockResolvedValue(undefined),
    getFilesStatus: vi.fn(async () => filesStatus.value),
  },
}))

const OBS: ObservationEntry[] = [{
  submissionId: 'S1', commonName: 'Steller\'s Jay', scientificName: 'Cyanocitta stelleri',
  date: '2026-05-01', location: 'Tilden Park', locationId: 'L1',
  latitude: 37.9, longitude: -122.24,
  county: 'Alameda',            // non-null so the County select mounts
  count: 2, breedingCode: null, speciesComments: '', catalogIds: [],
  stateProvince: 'US-CA',
}]

vi.mock('../lib/observationsCache', () => ({
  loadEbirdObservations: vi.fn(async () => ({ observations: OBS })),
}))
const mlRows = vi.hoisted(() => ({ value: [] as unknown[] }))
vi.mock('../lib/mlExportCache', () => ({
  loadMLExport: vi.fn(async () => ({ rows: mlRows.value, mediaMap: {} })),
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

/**
 * The load-bearing assertion. Resolves the control by its accessible name (or
 * placeholder), then asserts BOTH that the element is the form control itself
 * and that the class is on that element. A wrapper placement fails the second
 * check; a class on a <div> fails the first.
 *
 * `register` is the SECOND half, added with the phone-tier clamp repair
 * (control-style-registers). The rule the class triggers reads
 * `max(var(--sr-ctl-floor), var(--sr-ctl-rem, 0.75rem))`, so a control whose own
 * size is larger than the 0.75rem default must declare `--sr-ctl-rem` beside its
 * inline `fontSize` or the rule silently CUTS IT DOWN at large text scale, which
 * is the defect that repair exists to end. Passing it asserts the two
 * declarations of that one number agree on this exact element. Omitting it
 * asserts the control relies on the default, and that it declares no
 * conflicting inline size: `undefined` is a claim here, not a skip.
 */
function expectGuarded(el: HTMLElement, tag: 'input' | 'select', register?: string) {
  expect(el.tagName.toLowerCase()).toBe(tag)
  expect(el.classList.contains('sr-input-16')).toBe(true)
  // React writes a custom property into the style attribute; jsdom exposes it
  // through getPropertyValue, not through the typed CSSStyleDeclaration.
  const declared = el.style.getPropertyValue('--sr-ctl-rem').trim()
  const name = el.getAttribute('aria-label') ?? el.getAttribute('placeholder') ?? el.tagName
  if (register === undefined) {
    // No register of its own: it must not be carrying a larger inline size that
    // the rule's 0.75rem default would then cut down.
    const inline = el.style.fontSize.trim()
    expect(inline === '' || inline === '0.75rem',
      `${name}: inline ${inline} needs a matching --sr-ctl-rem`).toBe(true)
  } else {
    expect(declared, `${name}: --sr-ctl-rem must be declared`).toBe(register)
    expect(el.style.fontSize.trim(),
      `${name}: --sr-ctl-rem and fontSize must agree`).toBe(register)
  }
}

beforeEach(() => { filesStatus.value = { ebird: true, ml: true }; mlRows.value = [{ format: 'Photo' }] })
afterEach(() => { cleanup(); vi.clearAllMocks() })

describe('map-explorer-input-zoom — .sr-input-16 lands on the control element', () => {
  it('guards the five My Sightings filter controls (species, both dates, county, media)', async () => {
    renderMap()
    // Species only exists once the backup has loaded into phase 'ready'. It is
    // the shared SpeciesCombobox (improve: searchable-species-pickers), so the
    // guarded element is its <input>, not a <select>.
    const species = await screen.findByLabelText('Species')
    // The four controls whose register is 0.8125rem, not the rule's 0.75rem
    // default: without the declaration the clamp repair silently misses them and
    // they render 24px instead of 26px at 200% text scale. The combobox is
    // MapExplorer.tsx:2059 (size="panel", derived inside SpeciesCombobox); the
    // two selects are :2076 and :2100, both through SELECT_STYLE in
    // lib/mapExplorerFormat.ts.
    expectGuarded(species, 'input', '0.8125rem')
    // The two date inputs ARE 0.75rem and correctly rely on the default.
    expectGuarded(screen.getByLabelText('From date'), 'input')
    expectGuarded(screen.getByLabelText('To date'), 'input')
    // County mounts only when the observations resolve a county (fixture has one).
    expectGuarded(screen.getByLabelText('County'), 'select', '0.8125rem')
    // Media mounts only with an ML export (mlRows non-empty above).
    expectGuarded(screen.getByLabelText('Media'), 'select', '0.8125rem')
  })

  it('guards the shared place-name search and the Lat/Lng pair in all three center views', async () => {
    renderMap()
    await screen.findByLabelText('Species')

    // AddressSearch + CenterPointControl are ONE source site each rendering in
    // three sidebars. Checking all three is what proves the single edit covers
    // every rendered instance — and would catch a future per-sidebar fork.
    for (const mode of ['Hotspots', 'Media Targets', 'Nearby Lifers']) {
      fireEvent.click(screen.getByRole('button', { name: mode }))
      await waitFor(() => expect(screen.getByLabelText('Latitude')).toBeTruthy())
      expectGuarded(screen.getByLabelText('Search by place name'), 'input')
      expectGuarded(screen.getByLabelText('Latitude'), 'input')
      expectGuarded(screen.getByLabelText('Longitude'), 'input')
    }
  })

  it('guards the manual target-species search on the no-ML Media Targets path', async () => {
    mlRows.value = []                 // no ML export → the manual list renders
    filesStatus.value = { ebird: true, ml: false }
    renderMap()
    await screen.findByLabelText('Species')
    fireEvent.click(screen.getByRole('button', { name: 'Media Targets' }))
    const search = await screen.findByPlaceholderText('Search species…')
    expectGuarded(search, 'input')
  })

  // Scoped to checkboxes only: the heatmap-intensity range needs Heatmap mode,
  // which this pins-mode render never mounts. Its boundary is verified in the
  // browser (QA report), not here.
  it('leaves the manual-target checkbox unguarded', async () => {
    // Deliberate scope boundary: both are focusable but neither raises a
    // keyboard, so neither triggers iOS focus zoom. If a later sweep "fixes"
    // them, this fails and the decision gets re-made on purpose.
    mlRows.value = []
    filesStatus.value = { ebird: true, ml: false }
    renderMap()
    await screen.findByLabelText('Species')
    fireEvent.click(screen.getByRole('button', { name: 'Media Targets' }))
    await screen.findByPlaceholderText('Search species…')

    const checkboxes = document.querySelectorAll('input[type="checkbox"]')
    expect(checkboxes.length).toBeGreaterThan(0)
    for (const cb of checkboxes) expect(cb.classList.contains('sr-input-16')).toBe(false)
  })
})
