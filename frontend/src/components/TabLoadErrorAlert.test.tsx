// @vitest-environment jsdom
//
// The load-failure live region on all eight data tabs (improve:
// tab-error-panel-alerts).
//
// WHAT THIS FILE IS FOR. `role="alert"` on a panel that is an early `return` in a
// phase switch announces nothing: the region is CREATED at the instant its text
// exists, and a live region that is not already in the accessibility tree when
// its message lands does not fire. That is DECISIONS.md v0.5.83, found in a
// security review on `.sr-map-geo-error`, and it is the reason this change is not
// a six-line attribute addition. Two of these eight tabs (the Calendar and the
// Map Explorer) shipped `role="alert"` in exactly that broken shape and are
// corrected here rather than copied.
//
// SO THE ASSERTION IS NODE IDENTITY, NOT PRESENCE. Every test below captures the
// region element BEFORE the failure and asserts that the element carrying the
// message afterwards `toBe` the same object. A build that moves the region back
// inside the phase switch still renders a `role="alert"` with the right text and
// still passes any presence or `textContent` assertion -- it fails here, on
// identity, and that is the whole point. Mutation-checked: reverting a tab to an
// in-branch region turns its roster rows red.
//
// ONE ROSTER, EIGHT TABS. The eight rows below are the coverage. They are not
// eight hand-written copies, because the failure mode is per-tab (each has its
// own phase switch and its own load effect) while the guarantee is identical, so
// a dropped tab has to be visible as a missing row rather than as an absent file.
// The roster's length is pinned so a tab cannot quietly leave it.
//
// WHY THE THIRD TEST DOES NOT ASSERT THE REGION IS PRESENT WHILE A TAB IS READY.
// It is not, on six of the eight, and it does not need to be: those six reset the
// phase to a loading phase as the first statement of every reload, so `error` is
// only ever entered from a phase whose region this file has already captured.
// Statistics and the Map Explorer do NOT reset, so `ready -> error` is one commit
// there and both carry the region through their ready render. The test states the
// property both mechanisms have to satisfy -- the region exists and is empty in
// the commit before the message -- rather than the mechanism, so it stays honest
// if a tab's load effect changes.
//
// WHAT THIS FILE CANNOT SEE, stated rather than implied. jsdom loads no
// stylesheet, so a `display: none` on the region -- the exact v0.5.83 defect --
// is invisible here and every test below would pass on that broken build. The
// stylesheet half is `lib/tabLoadAlertCss.test.ts`. And an accessibility tree is
// a proxy for an announcement, never proof of one: whether VoiceOver actually
// speaks these needs a human listener on macOS and iOS.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, cleanup, waitFor, act } from '@testing-library/react'
import type { ReactElement, ReactNode } from 'react'
import { EBIRD_BACKUP_LOAD_ERROR } from './setupCopy'

// ── Mocks: everything below these components (maplibre, network, disk) ────────

vi.mock('./SnowMap', () => ({
  SnowMap: ({ children }: { children?: ReactNode }) => <div data-testid="snowmap">{children}</div>,
}))
vi.mock('react-map-gl/maplibre', () => ({
  useMap: () => ({ current: null }),
  Marker: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  Popup: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  Source: ({ children }: { children?: ReactNode }) => <>{children}</>,
  Layer: () => null,
}))
vi.mock('./AtlasLayer', () => ({ AtlasLayer: () => null }))
vi.mock('./map/CountyLayer', () => ({ CountyLayer: () => null }))
vi.mock('./map/SightingMarkers', () => ({ SightingMarkers: () => null }))
vi.mock('./map/HotspotMarkers', () => ({ HotspotMarkers: () => null }))
vi.mock('./map/TargetMarkers', () => ({ TargetMarkers: () => null }))
vi.mock('./map/NearbyLiferMarkers', () => ({ NearbyLiferMarkers: () => null }))
vi.mock('./map/BasemapDesaturation', () => ({ BasemapDesaturation: () => null }))
vi.mock('./map/SharePopup', () => ({ SharePopup: () => null }))
vi.mock('./map/SharePin', () => ({ SharePin: () => null }))
vi.mock('./map/MapControls', () => ({
  MapEffects: () => null, BoundsTracker: () => null, DetectedLocationPin: () => null,
  CenterPinDropper: () => null, CenterPin: () => null,
}))
vi.mock('../lib/useHotspotSet', () => ({
  useHotspotSet: () => ({ isPublicHotspot: () => false, isHotspot: () => false }),
}))
vi.mock('../lib/useCountyCompleteness', () => ({
  useCountyCompleteness: () => ({
    summaryFor: () => null, resultFor: () => null,
    onViewportCounties: () => {}, requestCounty: () => {},
  }),
  EBIRD_NO_KEY_MESSAGE: 'no key',
}))
vi.mock('../lib/transport', () => ({
  transport: {
    get: vi.fn(async () => ({ species: [] })),
    post: vi.fn(async () => ({ codes: {} })),
    getReplayable: vi.fn(async () => ({ data: null, stale: false })),
  },
  TransportError: class extends Error {},
}))

// The disk seam. `result` decides the phase: an object is a successful load,
// `null` is the unreadable-backup failure every one of these tabs turns into
// EBIRD_BACKUP_LOAD_ERROR. `hold` parks the load so the LOADING phase can be
// observed -- the state a region created by the error branch does not exist in.
const ebirdLoad = vi.hoisted(() => ({
  result: null as unknown,
  hold: false,
  release: null as null | (() => void),
}))
vi.mock('../lib/observationsCache', () => ({
  loadEbirdObservations: vi.fn(async () => {
    if (ebirdLoad.hold) await new Promise<void>(r => { ebirdLoad.release = r })
    return ebirdLoad.result
  }),
}))
vi.mock('../lib/mlExportCache', () => ({
  loadMLExport: vi.fn(async () => ({ rows: [], mediaMap: {} })),
}))
vi.mock('../lib/storage', () => ({
  storage: {
    getFilesStatus: vi.fn(async () => ({
      ebird: { filename: 'MyEBirdData.csv', uploadedAt: '2026-01-01' },
      ml: { filename: 'ml.csv', uploadedAt: '2026-01-01' },
    })),
    getSetting: vi.fn(async () => null),
    setSetting: vi.fn(async () => {}),
    getApiKey: vi.fn(async () => null),
    // The Multimedia tab reads the ML file itself rather than through the cache,
    // and since v1.0.16 it reports an export it cannot turn into rows as its OWN
    // load failure, ahead of the eBird guard. So this fixture has to be a VALID
    // export -- it needs the Common Name column parseMLExport requires -- or that
    // tab's row here fails on the ML message instead of reaching the eBird one
    // these tests are about. It lost that column silently before, when a bad
    // parse was pre-empted by the eBird failure and never ran.
    readFile: vi.fn(async () => 'ML Catalog Number,Format,Common Name\n1,Photo,American Robin\n'),
  },
}))

import { Calendar } from './Calendar'
import { BirdingStats } from './BirdingStats'
import { Checklists } from './Checklists'
import { BreedingCodeList } from './BreedingCodeList'
import { NamedBirds } from './NamedBirds'
import { SpeciesDetail } from './SpeciesDetail'
import { LifeList } from './LifeList'
import { MapExplorer } from './MapExplorer'
import { notifyFilesChanged } from '../lib/filesChanged'
import { loadEbirdObservations } from '../lib/observationsCache'

const OBS = [{
  submissionId: 'S1', commonName: 'American Robin', scientificName: 'Turdus migratorius',
  date: '2026-03-14', location: 'West Pond', locationId: 'L1',
  latitude: 44.9, longitude: -93.1, county: 'Hennepin', count: 1,
  breedingCode: null, speciesComments: '', catalogIds: [], stateProvince: 'US-MN',
}]
const GOOD_LOAD = { headerLine: 'Submission ID', observations: OBS }

const noop = () => {}

/**
 * The eight tabs, each with the props it needs and how a RELOAD is triggered on
 * it. Six take a `filesVersion` prop; Statistics and the Map Explorer subscribe
 * to the files epoch directly, which is itself the reason those two need the
 * region in their ready render (see their phase-gate comments).
 */
type Row = {
  name: string
  /** `v` is bumped to trigger a reload on the six prop-driven tabs. */
  render: (v: number) => ReactElement
  /** True where a reload is signalled through the module-level epoch instead. */
  epochDriven?: boolean
}

const ROSTER: Row[] = [
  { name: 'Calendar', render: v => <Calendar onGoToSettings={noop} filesVersion={v} /> },
  { name: 'Statistics', render: () => <BirdingStats onGoToSettings={noop} />, epochDriven: true },
  { name: 'Checklists', render: v => <Checklists onGoToSettings={noop} filesVersion={v} /> },
  { name: 'Breeding Codes', render: v => <BreedingCodeList onGoToSettings={noop} filesVersion={v} /> },
  { name: 'Named Birds', render: v => <NamedBirds onGoToSettings={noop} filesVersion={v} embedAllowed={false} /> },
  { name: 'Species Detail', render: v => <SpeciesDetail onGoToSettings={noop} filesVersion={v} embedAllowed={false} /> },
  { name: 'Multimedia', render: v => <LifeList onGoToSettings={noop} filesVersion={v} /> },
  { name: 'Map Explorer', render: () => <MapExplorer onGoToSettings={noop} onNavigateToMediaList={noop} />, epochDriven: true },
]

/** The live region, addressed the way the app renders it and no other way. */
function regionIn(container: HTMLElement): HTMLElement | null {
  return container.querySelector<HTMLElement>('[role="alert"].sr-tab-load-alert')
}

/** Let a parked load finish, as a failure. */
async function releaseLoad() {
  await waitFor(() => expect(ebirdLoad.release).not.toBeNull())
  const release = ebirdLoad.release!
  ebirdLoad.hold = false
  ebirdLoad.release = null
  await act(async () => {
    release()
    await Promise.resolve()
  })
}

beforeEach(() => {
  ebirdLoad.result = null
  ebirdLoad.hold = false
  ebirdLoad.release = null
})
afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('the roster covers every tab that can fail to load', () => {
  it('has all eight, and no duplicates', () => {
    expect(ROSTER).toHaveLength(8)
    expect(new Set(ROSTER.map(r => r.name)).size).toBe(8)
  })
})

describe('the Map Explorer loading view is unchanged by the restructure', () => {
  // The Map Explorer was the one tab whose loading phase was a bare early
  // return. Folding it into the main tree is what lets the region hold a fixed
  // position across `loading-saved -> error`, and it is also the only place in
  // this change where something could newly appear on screen. Two controls in
  // the FAB cluster are NOT covered by `mapMounted` -- fullscreen gates on
  // `onToggleFullscreen`, the Filters pill on nothing -- so both are asserted
  // absent here with `onToggleFullscreen` supplied, which is how App renders it.
  it('shows the spinner and nothing else while the backup is loading', async () => {
    ebirdLoad.hold = true
    const { container } = render(
      <MapExplorer onGoToSettings={noop} onNavigateToMediaList={noop} onToggleFullscreen={noop} />,
    )
    await act(async () => { await Promise.resolve() })

    // The spinner is there...
    expect(container.querySelector('.spin')).not.toBeNull()
    // ...the mode bar and the sidebar are not...
    expect(container.querySelector('[aria-label="Map view mode"]')).toBeNull()
    expect(container.querySelector('.sr-map-sidebar-overlay')).toBeNull()
    // ...and no control renders over the empty map area.
    expect(container.querySelectorAll('button')).toHaveLength(0)
    expect(container.querySelector('.sr-map-filters-btn')).toBeNull()

    // The cluster wrapper and its own live region DO stay mounted, which is the
    // v0.5.83 contract this change extends rather than reverses.
    expect(container.querySelector('.sr-map-fab-cluster')).not.toBeNull()
    expect(container.querySelector('.sr-map-geo-error')).not.toBeNull()

    await releaseLoad()
  })
})

describe.each(ROSTER)('$name', ({ name, render: renderTab, epochDriven }) => {
  it('mounts the live region BEFORE the load resolves, and the message lands in that same node', async () => {
    ebirdLoad.hold = true
    ebirdLoad.result = null
    const { container } = render(renderTab(0))

    const region = regionIn(container)
    expect(region, `${name} must render the region above its phase switch`).not.toBeNull()
    // Empty, not absent: an idle region carries no text of its own.
    expect(region!.textContent).toBe('')

    await releaseLoad()
    await waitFor(() => {
      expect(regionIn(container)!.textContent).toBe(EBIRD_BACKUP_LOAD_ERROR)
    })

    // THE assertion. Presence and text both pass on a build whose region is
    // created with its message; identity does not.
    expect(
      regionIn(container),
      `${name}'s region was replaced rather than populated -- the message arrived with its region`,
    ).toBe(region)
  })

  it('announces exactly the sentence: no icon text, no action label inside the region', async () => {
    const { container } = render(renderTab(0))
    await waitFor(() => {
      expect(regionIn(container)!.textContent).toBe(EBIRD_BACKUP_LOAD_ERROR)
    })
    const region = regionIn(container)!

    // The icon is inside the region and must be hidden from assistive tech, so
    // the region names the failure once. STATED HONESTLY: this assertion cannot
    // currently discriminate the explicit prop, because lucide-react 1.14 adds
    // `aria-hidden="true"` itself for an icon with no children and no a11y prop
    // -- removing the prop from the component leaves this green. It is written
    // as the GUARANTEE rather than the mechanism on purpose: it is what goes red
    // if a lucide upgrade drops that default, or if an icon is ever given a
    // `<title>` or an aria-label that would put a second name in the region.
    const icon = region.querySelector('svg')
    expect(icon, `${name} should render the alert icon inside the region`).not.toBeNull()
    expect(icon!.getAttribute('aria-hidden')).toBe('true')

    // The action is a SIBLING, so "Go to Settings" is not read as part of the
    // failure sentence. Both shipped precedents had it inside the region.
    expect(region.querySelector('button')).toBeNull()
    const action = container.querySelector('.sr-tab-load-alert-frame button')
    expect(action, `${name} keeps its Go to Settings action`).not.toBeNull()
    expect(action!.textContent).toMatch(/Go to Settings/)
  })

  it('a failed RELOAD fills a region that already existed, empty, in the commit before it', async () => {
    // The path the v1.0.15 cache-read-throw fix made more reachable: a tab that
    // has already rendered, then a stored file that stops being readable.
    ebirdLoad.result = GOOD_LOAD
    const { container, rerender } = render(renderTab(0))
    await waitFor(() => expect(loadEbirdObservations).toHaveBeenCalled())
    await act(async () => { await Promise.resolve() })

    // Park the next load and trigger the reload.
    ebirdLoad.hold = true
    ebirdLoad.result = null
    await act(async () => {
      if (epochDriven) notifyFilesChanged()
      else rerender(renderTab(1))
      await Promise.resolve()
    })

    // Whichever mechanism the tab uses -- a reset to its loading phase, or the
    // region carried through its ready render -- the region is here and empty
    // while the reload is in flight.
    await waitFor(() => expect(regionIn(container)).not.toBeNull())
    const region = regionIn(container)!
    expect(region.textContent).toBe('')

    await releaseLoad()
    await waitFor(() => {
      expect(regionIn(container)!.textContent).toBe(EBIRD_BACKUP_LOAD_ERROR)
    })
    expect(
      regionIn(container),
      `${name} inserted a new region on a failed reload instead of filling the mounted one`,
    ).toBe(region)
  })
})
