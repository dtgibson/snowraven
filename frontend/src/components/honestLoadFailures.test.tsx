// @vitest-environment jsdom
//
// honest-load-failures (Fix lane, Spool bundle builds 3 and 4).
//
// One claim, several findings, one file: what a surface SAYS about a stored file
// must match what is actually true of it. No count of those surfaces is written
// down here on purpose — three defensible rosters (what carries the shared
// message, what carries `TabLoadErrorAlert`, what reads a stored file at all)
// give three different numbers, so a number would be wrong somewhere the moment
// it was written. The rosters below are the artifact instead: a new surface, or a
// fifth cancel-guarded loader, reads as a MISSING ROW rather than as nothing at
// all. (`pipeline/clear-means-clear/pr-description.md`: symmetry in the code is
// not symmetry in the evidence.)
//
//  A. An ML-export read failure must never change what a tab says about the
//     eBird BACKUP. `loadMLExport` awaits `storage.readFile('ml')` OUTSIDE its
//     try, so on web/Pi (where `WebStorage.readFile` is a bare `fetch`) a read
//     throw rejected the whole `Promise.all` into the outer catch and rendered
//     "eBird Backup Required" over a loaded backup. LifeList has the same shape
//     via its own `storage.readFile('ml')` and lands on "Macaulay Library
//     Export Required" instead, so it gets its own row and its own message.
//  B. The message a stored-but-unloadable file gets must be honest AND useful:
//     it names `MyEBirdData.csv` and the Settings path. It must NOT become the
//     SetupRequired steps panel — `error` and `setup-required` are deliberately
//     distinct phases (DECISIONS.md, 2026-05-22), so every row asserts the
//     steps are absent, and every row has an absent case (no file stored ⇒ the
//     steps ARE shown and the error message is NOT).
//  C. A cancelled effect run writes no state at all. The old
//     `if (!ebird || cancelled)` spelling wrote the error phase when `ebird` was
//     truthy and `cancelled` was true, i.e. a stale run painted an error over a
//     tab a newer run had already made ready.
//  D. (v1.0.16) The same claim, one step further in: on Multimedia a stored ML
//     export that cannot be turned into ROWS is a load failure too, not only one
//     that cannot be READ. A falsy read, a stored file that is not an ML export,
//     and a parse that throws all used to render as a successful load, three of
//     them as a list with every photo and recording missing and nothing on
//     screen saying so. All four routes now land on the one message.
//  E. (v1.0.16) The Weather tab's checklist-backlog section was the one
//     `loadEbirdObservations` caller in the app that rendered a claim about the
//     backup with no upstream `getFilesStatus()` branch, so every failure there
//     collapsed onto "Load your eBird backup first" with a Go to Import button —
//     the setup-shaped lie, over a backup Settings lists as saved. It asks now.
//     Its rows are not in the tab rosters below, because it is a section rather
//     than a tab (`lib/tabLayout.ts` is what a tab is), and that difference is
//     load-bearing rather than cosmetic: its panel UNMOUNTS on collapse, so its
//     alert region has to live outside the disclosure to keep the guarantee the
//     eight tabs get for free.
//
// HOW THE COPY ROWS DIVIDE THE WORK, because it is easy to misread them. The
// per-surface rows import the same constant the components import, so they can
// only prove DELIVERY (this surface renders the shared string) — they cannot
// fail if the string's CONTENT is wrong, which is the v0.5.88 rule about a
// reference point derived from the thing being verified. The content claim is
// pinned exactly once, by the first test, against literals written here.
//
// WHAT THIS FILE CANNOT PROVE, and where the evidence for it lives. jsdom has no
// layout engine and no accessibility tree, so the rows here assert MECHANISMS:
// the wrap class rather than the absence of overflow at 320px / 200% text scale,
// and React's reconciliation of the alert region rather than whether that region
// is announceable. The tab surfaces' pixels are the Playwright text-ink
// measurement recorded in build 3's PR notes; Finding E's, and both engines'
// reading of the region, are measured by `verify-backlog-alert.mjs` against a
// production build. That is no longer something a reader has to go and run by
// hand: it moved to `website/tools/verify/` (playwright-gate, 2026-09-05) and
// is now part of the gate CI runs after `npm run build`, so a regression in
// what this file cannot see turns the build red rather than waiting to be
// noticed. To drive it alone, from the repo root after a build:
//
//   node website/tools/verify/verify-backlog-alert.mjs frontend/dist
//
// and `--expect-broken` after that path inverts its exit code, for re-proving
// it still fails against a build that lacks the fix.

import { describe, it, expect, vi, beforeEach, afterEach, afterAll } from 'vitest'
import { render, screen, cleanup, waitFor, fireEvent, act } from '@testing-library/react'
import type { ReactNode } from 'react'
import type { ObservationEntry } from '../types'

// ── Seams ────────────────────────────────────────────────────────────────────
const H = vi.hoisted(() => ({
  getFilesStatus: vi.fn(),
  readFile: vi.fn(),
  getApiKey: vi.fn(),
  getSetting: vi.fn(),
  setSetting: vi.fn(),
  loadEbird: vi.fn(),
  loadML: vi.fn(),
  tGet: vi.fn(),
  tPost: vi.fn(),
  compareThrows: vi.fn(),
}))

vi.mock('../lib/storage', () => ({
  storage: {
    getFilesStatus: H.getFilesStatus,
    readFile: H.readFile,
    getApiKey: H.getApiKey,
    getSetting: H.getSetting,
    setSetting: H.setSetting,
  },
}))
vi.mock('../lib/observationsCache', () => ({ loadEbirdObservations: H.loadEbird }))
vi.mock('../lib/mlExportCache', () => ({ loadMLExport: H.loadML }))
vi.mock('../lib/transport', () => ({
  transport: { get: H.tGet, post: H.tPost },
  TransportError: class extends Error {},
}))
// The real comparison, except where a test asks it to throw. It is the one thing
// inside handleCompare's try that is NOT about the eBird backup and could grow a
// throw later, so the attribution guard needs to be able to make it fail.
vi.mock('../lib/compare', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/compare')>()
  return {
    ...actual,
    compareSpecies: (a: Parameters<typeof actual.compareSpecies>[0], b: Parameters<typeof actual.compareSpecies>[1]) => {
      if (H.compareThrows()) throw new Error('not the backup')
      return actual.compareSpecies(a, b)
    },
  }
})

// Everything below the tabs that needs a GPU, a network or a disk.
vi.mock('react-map-gl/maplibre', () => ({
  useMap: () => ({ current: null }),
  Marker: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  Popup: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  Source: ({ children }: { children?: ReactNode }) => <>{children}</>,
  Layer: () => null,
}))
vi.mock('./SnowMap', () => ({ SnowMap: ({ children }: { children?: ReactNode }) => <div>{children}</div> }))
vi.mock('./SightingsMap', () => ({ SightingsMap: () => <div data-testid="sightings-map-stub" /> }))
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
vi.mock('../lib/useHotspotSet', () => ({ useHotspotSet: () => ({ set: new Set<string>(), isHotspot: () => false }) }))
vi.mock('../lib/useCountyCompleteness', () => ({
  useCountyCompleteness: () => ({
    summaryFor: () => null, resultFor: () => null,
    onViewportCounties: () => {}, requestCounty: () => {},
  }),
  EBIRD_NO_KEY_MESSAGE: 'no key',
}))

import { EBIRD_BACKUP_LOAD_ERROR, ML_EXPORT_LOAD_ERROR } from './setupCopy'
import { notifyFilesChanged } from '../lib/filesChanged'
import { BirdingStats } from './BirdingStats'
import { Calendar } from './Calendar'
import { Checklists } from './Checklists'
import { BreedingCodeList } from './BreedingCodeList'
import { NamedBirds } from './NamedBirds'
import { SpeciesDetail } from './SpeciesDetail'
import { MapExplorer } from './MapExplorer'
import { LifeList } from './LifeList'
import { ListComparer } from './ListComparer'
import { WeatherBacklog } from './WeatherBacklog'
import { CommandPalette } from './CommandPalette'
import { PALETTE_COPY } from '../lib/paletteCopy'
import type { PaletteNavItem } from '../lib/paletteRows'
import {
  resolveBacklogRows,
  BACKLOG_LOAD_FAILED,
  BACKLOG_SUPERSEDED,
} from '../lib/weatherBacklogLoad'
import type { ChecklistRowData } from '../lib/checklistsTab'

// ── Fixtures ─────────────────────────────────────────────────────────────────
// The header carries a Breeding Code column so BreedingCodeList reaches `ready`
// rather than its OTHER error branch (the wrong-file message, untouched here).
const HEADER = 'Submission ID,Common Name,Scientific Name,County,Date,Breeding Code\n'

function obs(over: Partial<ObservationEntry> & { submissionId: string; commonName: string }): ObservationEntry {
  return {
    scientificName: 'Turdus migratorius',
    date: '2024-05-01',
    location: 'West Pond',
    locationId: 'L1',
    latitude: 37.8,
    longitude: -122.2,
    county: 'Marin',
    count: 1,
    breedingCode: 'NB',
    speciesComments: '',
    catalogIds: [],
    time: '07:30 AM',
    stateProvince: 'US-CA',
    duration: 30,
    distance: 1,
    protocol: 'Traveling',
    numObservers: 1,
    ...over,
  } as ObservationEntry
}

const OBS: ObservationEntry[] = [
  obs({ submissionId: 'S1', commonName: 'American Robin' }),
  obs({ submissionId: 'S2', commonName: 'Song Sparrow', scientificName: 'Melospiza melodia', date: '2024-05-02', breedingCode: 'FL' }),
]
const LOADED = { headerLine: HEADER, observations: OBS }

const ML_CSV = [
  'Catalog Number,Common Name,Scientific Name,Format',
  '1,American Robin,Turdus migratorius,Photo',
].join('\n')

const EBIRD_CSV = [
  'Submission ID,Common Name,Scientific Name,Taxonomic Order,Date',
  'S1,American Robin,Turdus migratorius,100,2024-05-01',
].join('\n')

const BOTH_FILES = {
  ebird: { filename: 'MyEBirdData.csv', uploadedAt: '2024-06-01' },
  ml: { filename: 'ML__x_123.csv', uploadedAt: '2024-06-01' },
}
const EBIRD_ONLY = { ebird: BOTH_FILES.ebird, ml: null }
const NO_FILES = { ebird: null, ml: null }

// Distinctive fragments of the two step lists, present only when the
// SetupRequired guidance panel renders. The `error` phase must never show them.
const EBIRD_STEPS_MARKER = /Download My Data/
const ML_STEPS_MARKER = /Save Spreadsheet/

const settingsProps = { onGoToSettings: () => {} }

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej })
  return { promise, resolve, reject }
}

beforeEach(() => {
  for (const fn of Object.values(H)) { fn.mockReset() }
  H.getFilesStatus.mockImplementation(async () => BOTH_FILES)
  H.readFile.mockImplementation(async (slot: string) => (slot === 'ml' ? ML_CSV : EBIRD_CSV))
  H.getApiKey.mockImplementation(async () => null)
  H.getSetting.mockImplementation(async () => null)
  H.setSetting.mockImplementation(async () => {})
  H.loadEbird.mockImplementation(async () => LOADED)
  H.loadML.mockImplementation(async () => ({ rows: [], mediaMap: {}, entries: [] }))
  H.tGet.mockImplementation(async () => ({}))
  H.tPost.mockImplementation(async (path: string) =>
    path === '/taxonomy/codes' ? { codes: {}, orders: {}, formCodes: {} } : {})
  H.compareThrows.mockImplementation(() => false)
})
afterEach(cleanup)

// Statistics and Species Detail mount recharts on their ready path; drain the
// toolkit autoBatch fallback timer so it cannot outlive this file's jsdom env
// and fail a LATER file with every test here green (test-setup.ts rule).
afterAll(() => new Promise(r => setTimeout(r, 120)))

// ─────────────────────────────────────────────────────────────────────────────
// FINDING B — the message, on every surface that carries it
// ─────────────────────────────────────────────────────────────────────────────

/** One row per tab that renders the shared eBird load-failure message. */
const EBIRD_MESSAGE_TABS: {
  name: string
  /** Files present so the tab gets past its setup gate and attempts a load. */
  files: unknown
  element: ReactNode
  /** This tab's SetupRequired title + a fragment of its step list. Both are
   *  present only in the `setup-required` panel — the absent case. */
  setupTitle: RegExp
  stepsMarker: RegExp
}[] = [
  { name: 'Statistics',    files: EBIRD_ONLY, element: <BirdingStats {...settingsProps} />,                          setupTitle: /Statistics require your eBird backup/, stepsMarker: EBIRD_STEPS_MARKER },
  { name: 'Calendar',      files: EBIRD_ONLY, element: <Calendar {...settingsProps} filesVersion={0} />,             setupTitle: /eBird Backup Required/, stepsMarker: EBIRD_STEPS_MARKER },
  { name: 'Checklists',    files: EBIRD_ONLY, element: <Checklists {...settingsProps} filesVersion={0} />,           setupTitle: /eBird Backup Required/, stepsMarker: EBIRD_STEPS_MARKER },
  { name: 'Breeding Codes',files: EBIRD_ONLY, element: <BreedingCodeList {...settingsProps} filesVersion={0} />,     setupTitle: /eBird Backup Required/, stepsMarker: EBIRD_STEPS_MARKER },
  { name: 'Named Birds',   files: EBIRD_ONLY, element: <NamedBirds {...settingsProps} filesVersion={0} embedAllowed={false} />, setupTitle: /eBird Backup Required/, stepsMarker: EBIRD_STEPS_MARKER },
  { name: 'Species Detail',files: EBIRD_ONLY, element: <SpeciesDetail {...settingsProps} filesVersion={0} embedAllowed={false} />, setupTitle: /eBird Backup Required/, stepsMarker: EBIRD_STEPS_MARKER },
  {
    name: 'Map Explorer', files: EBIRD_ONLY, setupTitle: /eBird Backup Required/, stepsMarker: EBIRD_STEPS_MARKER,
    element: (
      <MapExplorer
        {...settingsProps}
        onNavigateToMediaList={() => {}}
        keysVersion={0}
        isFullscreen={false}
        onToggleFullscreen={() => {}}
        onOpenSpecies={() => {}}
      />
    ),
  },
  // Multimedia gates on the ML export, so it needs BOTH files stored before a
  // failed eBird load can reach its error phase.
  { name: 'Multimedia',    files: BOTH_FILES, element: <LifeList {...settingsProps} filesVersion={0} />, setupTitle: /Macaulay Library Export Required/, stepsMarker: ML_STEPS_MARKER },
]

describe('Finding B: a stored-but-unloadable eBird backup names the file and the Settings path', () => {
  it('the message itself is honest, useful, and terse', () => {
    // Names the file the user must re-download...
    expect(EBIRD_BACKUP_LOAD_ERROR).toContain('MyEBirdData.csv')
    // ...and exactly where to put it.
    expect(EBIRD_BACKUP_LOAD_ERROR).toContain('Settings → Default Files → eBird Backup')
    // It does NOT claim the file is missing (the lie this bundle is named for).
    expect(EBIRD_BACKUP_LOAD_ERROR).not.toMatch(/haven't saved|no backup|Required/i)
    // Repo-wide display-copy rule.
    expect(EBIRD_BACKUP_LOAD_ERROR).not.toContain('—')
    expect(ML_EXPORT_LOAD_ERROR).not.toContain('—')
    // The ML twin names its own slot, not the eBird one.
    expect(ML_EXPORT_LOAD_ERROR).toContain('Settings → Default Files → ML Export')
    expect(ML_EXPORT_LOAD_ERROR).not.toContain('MyEBirdData.csv')
  })

  it.each(EBIRD_MESSAGE_TABS.map(t => [t.name, t] as const))(
    '%s shows it when the stored backup will not load',
    async (_name, tab) => {
      H.getFilesStatus.mockImplementation(async () => tab.files)
      H.loadEbird.mockImplementation(async () => null)
      render(tab.element)

      const box = await screen.findByText(EBIRD_BACKUP_LOAD_ERROR)
      // Still the terse error panel: no SetupRequired steps, no "Required" title.
      expect(screen.queryByText(tab.stepsMarker)).toBeNull()
      expect(screen.queryByText(tab.setupTitle)).toBeNull()
      // And a way out of it.
      expect(screen.getByRole('button', { name: /Go to Settings/ })).toBeTruthy()
      // The wrap allowance. `MyEBirdData.csv` is an unbreakable run, and as a flex
      // item this box's automatic minimum size is floored by it: at 320px and 150%
      // or 200% in-app text scale it pushed the tab 47px past the viewport and
      // leaked page horizontal scroll (measured in Chromium AND WebKit; numbers in
      // the PR notes). jsdom has no layout engine, so this asserts the MECHANISM —
      // the class that lowers min-content — and the browser probe owns the pixels.
      expect(box.className).toContain('sr-wrap-anywhere')
    },
  )

  it.each(EBIRD_MESSAGE_TABS.map(t => [t.name, t] as const))(
    '%s does NOT show it when no file is stored (the setup-required split holds)',
    async (_name, tab) => {
      H.getFilesStatus.mockImplementation(async () => NO_FILES)
      render(tab.element)

      // The genuinely-unconfigured user still gets the full step-by-step panel.
      expect(await screen.findByText(tab.setupTitle)).toBeTruthy()
      expect(screen.getByText(tab.stepsMarker)).toBeTruthy()
      expect(screen.queryByText(EBIRD_BACKUP_LOAD_ERROR)).toBeNull()
    },
  )
})

describe('Finding B: List Comparer carries the same one string, not two of its own', () => {
  /** Life-Lists mode with a List B uploaded, ready for Compare. */
  async function armComparer(container: HTMLElement) {
    render(<ListComparer onOpenSpecies={undefined} keyStatus={null} onGoToSettings={() => {}} />, { container })
    fireEvent.click(screen.getByRole('button', { name: 'Life Lists' }))
    await screen.findByRole('button', { name: 'My List' })
    const input = container.querySelector('input[type="file"]') as HTMLInputElement
    fireEvent.change(input, { target: { files: [new File([EBIRD_CSV], 'other.csv', { type: 'text/csv' })] } })
    await waitFor(() => expect((screen.getByRole('button', { name: 'Compare Lists' }) as HTMLButtonElement).disabled).toBe(false))
  }

  it('shows the shared message when the stored backup reads back empty', async () => {
    const container = document.body.appendChild(document.createElement('div'))
    await armComparer(container)
    H.readFile.mockImplementation(async () => null)   // the :112 branch

    fireEvent.click(screen.getByRole('button', { name: 'Compare Lists' }))
    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toBe(EBIRD_BACKUP_LOAD_ERROR)
    expect(alert.className).toContain('sr-wrap-anywhere')
  })

  it('shows the SAME message when the stored backup throws', async () => {
    const container = document.body.appendChild(document.createElement('div'))
    await armComparer(container)
    H.readFile.mockImplementation(async () => { throw new Error('read failed') })  // the :129 branch

    fireEvent.click(screen.getByRole('button', { name: 'Compare Lists' }))
    const alert = await screen.findByRole('alert')
    // Before this fix the two branches carried DIFFERENT spellings of the same
    // sentence; one constant is what makes them provably identical.
    expect(alert.textContent).toBe(EBIRD_BACKUP_LOAD_ERROR)
  })

  it('blames the backup when the stored file is not an eBird backup', async () => {
    const container = document.body.appendChild(document.createElement('div'))
    await armComparer(container)
    // parseEbirdCSV throws INVALID_EBIRD on a header with no Common Name column.
    H.readFile.mockImplementation(async () => 'not,an,ebird,export\n1,2,3,4')

    fireEvent.click(screen.getByRole('button', { name: 'Compare Lists' }))
    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toBe(EBIRD_BACKUP_LOAD_ERROR)
  })

  it('does NOT blame the backup for a failure that is not the backup\'s', async () => {
    const container = document.body.appendChild(document.createElement('div'))
    await armComparer(container)
    // The stored backup reads and parses fine; the comparison itself fails.
    H.compareThrows.mockImplementation(() => true)

    fireEvent.click(screen.getByRole('button', { name: 'Compare Lists' }))
    const alert = await screen.findByRole('alert')
    // The whole point: it must not confidently tell the user to re-upload a file
    // that was read and parsed without complaint.
    expect(alert.textContent).not.toBe(EBIRD_BACKUP_LOAD_ERROR)
    expect(alert.textContent).not.toMatch(/MyEBirdData\.csv/)
    expect(alert.textContent).toMatch(/Something went wrong comparing these lists/)
  })

  it('shows no error at all when the stored backup reads back fine (the absent case)', async () => {
    const container = document.body.appendChild(document.createElement('div'))
    await armComparer(container)

    fireEvent.click(screen.getByRole('button', { name: 'Compare Lists' }))
    // A successful compare replaces the drop zones with the results view, so
    // waiting on THAT is what makes the absence below non-vacuous.
    expect(await screen.findByRole('region', { name: 'Comparison summary' })).toBeTruthy()
    expect(screen.queryByText(EBIRD_BACKUP_LOAD_ERROR)).toBeNull()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// FINDING A — an ML read failure must not be reported as a missing eBird backup
// ─────────────────────────────────────────────────────────────────────────────

/** The three tabs that load the ML export through `loadMLExport` in the same
 *  `Promise.all` as the eBird backup. Each must reach `ready` with no media. */
const ML_GUARD_TABS: { name: string; element: ReactNode; ready: () => Promise<unknown> }[] = [
  {
    name: 'Statistics',
    element: <BirdingStats {...settingsProps} />,
    ready: () => screen.findByRole('heading', { name: /Statistics/ }),
  },
  {
    name: 'Species Detail',
    element: <SpeciesDetail {...settingsProps} filesVersion={0} embedAllowed={false} />,
    ready: () => screen.findByRole('switch', { name: /Show all forms/ }),
  },
  {
    name: 'Map Explorer',
    element: (
      <MapExplorer
        {...settingsProps}
        onNavigateToMediaList={() => {}}
        keysVersion={0}
        isFullscreen={false}
        onToggleFullscreen={() => {}}
        onOpenSpecies={() => {}}
      />
    ),
    ready: () => screen.findByRole('combobox', { name: 'Species' }),
  },
]

describe('Finding A: an ML-export read failure never changes what a tab says about the eBird backup', () => {
  it.each(ML_GUARD_TABS.map(t => [t.name, t] as const))(
    '%s reaches ready with no media when the ML read throws',
    async (_name, tab) => {
      H.getFilesStatus.mockImplementation(async () => BOTH_FILES)
      // The exact web/Pi failure: WebStorage.readFile is a bare fetch, and the
      // read sits OUTSIDE loadMLExport's try, so the rejection escapes.
      H.loadML.mockImplementation(async () => { throw new TypeError('Failed to fetch') })
      render(tab.element)

      await tab.ready()
      // The two lies this fix removes.
      expect(screen.queryByText(/eBird Backup Required/)).toBeNull()
      expect(screen.queryByText(EBIRD_BACKUP_LOAD_ERROR)).toBeNull()
    },
  )

  it('Multimedia says the ML export would not load, not that none is saved', async () => {
    H.getFilesStatus.mockImplementation(async () => BOTH_FILES)
    H.readFile.mockImplementation(async (slot: string) => {
      if (slot === 'ml') throw new TypeError('Failed to fetch')
      return EBIRD_CSV
    })
    render(<LifeList {...settingsProps} filesVersion={0} />)

    const mlBox = await screen.findByText(ML_EXPORT_LOAD_ERROR)
    expect(mlBox.className).toContain('sr-wrap-anywhere')
    // Not "you haven't saved one yet" (the lie), and not a silently empty
    // Multimedia list either. That second one used to depend on this `catch`
    // recording the failure; since v1.0.16 a null from the catch lands on the
    // same message as a rejection, and Finding D below covers the routes that
    // reach it without one.
    expect(screen.queryByText(/Macaulay Library Export Required/)).toBeNull()
    expect(screen.queryByRole('switch', { name: /Show all forms/ })).toBeNull()
    // And it does not blame the eBird backup, which loaded fine.
    expect(screen.queryByText(EBIRD_BACKUP_LOAD_ERROR)).toBeNull()
  })

  it('Multimedia still renders normally when the ML read succeeds (the absent case)', async () => {
    H.getFilesStatus.mockImplementation(async () => BOTH_FILES)
    render(<LifeList {...settingsProps} filesVersion={0} />)

    expect(await screen.findByRole('switch', { name: /Show all forms/ })).toBeTruthy()
    expect(screen.queryByText(ML_EXPORT_LOAD_ERROR)).toBeNull()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// FINDING D — a stored export that cannot become rows is a FAILURE, not an
// empty one
// ─────────────────────────────────────────────────────────────────────────────
//
// Finding A's Multimedia row above guards the one route that was already
// guarded: a read that REJECTS, which is web/Pi-only (on the desktop the only
// statement outside `TauriStorage.readFile`'s own try is a memoized `fs()` that
// has already fulfilled). The rows here are the four routes that were not
// guarded, and they are reachable on every platform.

describe('Finding D: Multimedia reports a stored ML export that cannot be turned into rows', () => {
  const ML_UNUSABLE_STORED: { name: string; ml: () => Promise<string | null> }[] = [
    {
      // WebStorage.readFile returns null on any non-ok response, so a 500 from
      // /settings/files/ml is silent rather than a rejection.
      name: 'the read resolves null (a non-ok /settings/files/ml response on web/Pi)',
      ml: async () => null,
    },
    {
      // TauriStorage.writeFile is a direct writeTextFile with no temp-and-rename,
      // so an interrupted write leaves a truncated file with its metadata intact.
      name: 'the stored file is zero bytes (an interrupted write leaves one behind)',
      ml: async () => '',
    },
    {
      // Since ml-export-hardening an UPLOAD can no longer put one there: the
      // import chokepoint refuses a file whose header does not match the slot, on
      // every platform. The route is still live and still owed this row, for a
      // file stored before that guard shipped and for one that arrived by iCloud
      // sync, which is a pull rather than a user upload and is not guarded.
      name: 'the stored file is an eBird backup, not an ML export',
      ml: async () => EBIRD_CSV,
    },
    {
      // The same truncation as row 2, cut a few columns later. The export's
      // header runs ML Catalog Number, Format, Common Name (the real column order,
      // mirrored in website/tools/gen-demo-data.mjs), so a cut between the second
      // and third still satisfies detectFileType's substring test and then throws
      // INVALID_ML_EXPORT on the column parseMLExport requires by exact name.
      name: 'the header is truncated after Format but before Common Name',
      ml: async () => 'Catalog Number,Format\n1,Photo',
    },
  ]

  it.each(ML_UNUSABLE_STORED.map(r => [r.name, r] as const))(
    'Multimedia reports a load failure when %s',
    async (_name, route) => {
      H.getFilesStatus.mockImplementation(async () => BOTH_FILES)
      H.readFile.mockImplementation(async (slot: string) => (slot === 'ml' ? route.ml() : EBIRD_CSV))
      render(<LifeList {...settingsProps} filesVersion={0} />)

      const mlBox = await screen.findByText(ML_EXPORT_LOAD_ERROR)
      expect(mlBox.className).toContain('sr-wrap-anywhere')
      // Not the setup panel: an export IS stored (the 1.0.14 lie).
      expect(screen.queryByText(/Macaulay Library Export Required/)).toBeNull()
      expect(screen.queryByText(ML_STEPS_MARKER)).toBeNull()
      // And not a rendered list with no media, which is indistinguishable from a
      // birder who has photographed nothing.
      expect(screen.queryByRole('switch', { name: /Show all forms/ })).toBeNull()
      // The eBird backup loaded fine here, so it is not blamed.
      expect(screen.queryByText(EBIRD_BACKUP_LOAD_ERROR)).toBeNull()
    },
  )

  it('Multimedia blames the export, not the backup, when both fail at once', async () => {
    // The four checks above run BEFORE the eBird guard, so all of them share one
    // precedence rather than two of them being pre-empted by an eBird failure.
    H.getFilesStatus.mockImplementation(async () => BOTH_FILES)
    H.readFile.mockImplementation(async (slot: string) => (slot === 'ml' ? '' : EBIRD_CSV))
    H.loadEbird.mockImplementation(async () => null)
    render(<LifeList {...settingsProps} filesVersion={0} />)

    expect(await screen.findByText(ML_EXPORT_LOAD_ERROR)).toBeTruthy()
    expect(screen.queryByText(EBIRD_BACKUP_LOAD_ERROR)).toBeNull()
  })

  it('Multimedia still shows the guidance panel when no export is stored (the absent case)', async () => {
    // A backup IS stored here, so this proves the panel is about the ML slot
    // specifically, and that the new checks did not swallow the absent case.
    H.getFilesStatus.mockImplementation(async () => EBIRD_ONLY)
    render(<LifeList {...settingsProps} filesVersion={0} />)

    expect(await screen.findByText(/Macaulay Library Export Required/)).toBeTruthy()
    expect(screen.getByText(ML_STEPS_MARKER)).toBeTruthy()
    expect(screen.queryByText(ML_EXPORT_LOAD_ERROR)).toBeNull()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// FINDING C — a cancelled run writes no state at all
// ─────────────────────────────────────────────────────────────────────────────

/** The four loaders that spelled the guard `if (!ebird || cancelled)`. */
const CANCEL_GUARDED: {
  name: string
  element: (filesVersion: number) => ReactNode
  /** Statistics re-runs on the files EPOCH, not on a prop. */
  retrigger: 'prop' | 'epoch'
  ready: () => Promise<unknown>
}[] = [
  {
    name: 'Statistics',
    element: () => <BirdingStats {...settingsProps} />,
    retrigger: 'epoch',
    ready: () => screen.findByRole('heading', { name: /Statistics/ }),
  },
  {
    name: 'Checklists',
    element: v => <Checklists {...settingsProps} filesVersion={v} />,
    retrigger: 'prop',
    ready: () => screen.findByRole('heading', { name: 'Checklists' }),
  },
  {
    name: 'Breeding Codes',
    element: v => <BreedingCodeList {...settingsProps} filesVersion={v} />,
    retrigger: 'prop',
    ready: () => screen.findByRole('button', { name: 'Pin code labels' }),
  },
  {
    name: 'Named Birds',
    element: v => <NamedBirds {...settingsProps} filesVersion={v} embedAllowed={false} />,
    retrigger: 'prop',
    ready: () => screen.findByRole('heading', { name: 'Named Birds' }),
  },
]

describe('Finding C: a stale run resolving a truthy backup leaves a ready tab alone', () => {
  it.each(CANCEL_GUARDED.map(l => [l.name, l] as const))(
    '%s stays ready when the cancelled first load finally settles',
    async (_name, loader) => {
      H.getFilesStatus.mockImplementation(async () => EBIRD_ONLY)
      const first = deferred<typeof LOADED>()
      H.loadEbird
        .mockImplementationOnce(() => first.promise)
        .mockImplementation(async () => LOADED)

      const { rerender } = render(loader.element(0))
      // NON-VACUITY: the first run must be parked ON the observations load, past
      // its own `if (cancelled) return` after getFilesStatus. Without this wait
      // the run would bail at the earlier guard and the test would pass against
      // the defect too.
      await waitFor(() => expect(H.loadEbird).toHaveBeenCalledTimes(1))

      // A Settings save or an iCloud arrival: run 1 is cancelled, run 2 starts.
      if (loader.retrigger === 'epoch') {
        await act(async () => { notifyFilesChanged() })
      } else {
        rerender(loader.element(1))
      }
      await waitFor(() => expect(H.loadEbird).toHaveBeenCalledTimes(2))
      await loader.ready()

      // Now the cancelled run settles TRUTHY. The old `!ebird || cancelled`
      // spelling painted the error phase over the ready tab right here.
      await act(async () => {
        first.resolve(LOADED)
        await Promise.resolve()
      })

      expect(screen.queryByText(EBIRD_BACKUP_LOAD_ERROR)).toBeNull()
      await loader.ready()
    },
  )
})

// ─────────────────────────────────────────────────────────────────────────────
// FINDING E — the Weather Backlog asks whether a backup is STORED before it says
// anything about one
// ─────────────────────────────────────────────────────────────────────────────
//
// WHY THIS FINDING IS DRIVEN THROUGH A FUNCTION AND NOT A RENDER. The branch
// being fixed lived in an `App.tsx` effect, and no test in this repo renders
// `App.tsx`. Asserting only that the component renders the right thing for the
// right prop would leave the code that CHOOSES the prop unguarded — symmetry in
// the code without symmetry in the evidence — so the decision was lifted into
// `lib/weatherBacklogLoad.ts` and is driven here directly, with its dependencies
// handed in rather than mocked. That also keeps it out of the trap this file
// already documents: it mocks `lib/observationsCache` wholesale, so a test that
// reached this code through the module graph would be mocking one of the two
// things it is trying to prove the loader consults.
//
// The rows cover every answer the loader can reach: the two honest states, every
// route into the failure one, the two it must stay silent about, and the claim
// the call site rests on, which is that the promise never rejects. What is left
// at the call site after the lift is one liveness check and one setter, with no
// `.catch`, so a route out of this function that is neither a resolved state nor
// a caught throw would park the section on its spinner for the session.

/** Enough of an observation for `buildChecklistRows`, which is stubbed here. */
const BACKLOG_ROWS = [] as unknown as ChecklistRowData[]

function backlogDeps(over: Partial<Parameters<typeof resolveBacklogRows>[0]> = {}) {
  return {
    getFilesStatus: async () => EBIRD_ONLY,
    loadObservations: async () => LOADED,
    buildRows: () => BACKLOG_ROWS,
    isCurrent: () => true,
    ...over,
  }
}

describe('Finding E: the Weather Backlog load decision', () => {
  it('builds the rows when a stored backup loads (the absent case)', async () => {
    expect(await resolveBacklogRows(backlogDeps())).toBe(BACKLOG_ROWS)
  })

  it('reports NO BACKUP only when none is stored', async () => {
    const r = await resolveBacklogRows(backlogDeps({ getFilesStatus: async () => NO_FILES }))
    // `null` is the needs-data state, which keeps its "Load your eBird backup
    // first" title and its Go to Import CTA. That half is deliberately untouched:
    // it is the right answer to a genuinely unconfigured app (the
    // setup-required / error split, DECISIONS.md 2026-05-22).
    expect(r).toBeNull()
  })

  it('does NOT consult the backup at all when none is stored', async () => {
    // Non-vacuity for the row above: the honest branch has to come from the
    // status read, not from the load happening to succeed.
    const loadObservations = vi.fn(async () => LOADED)
    await resolveBacklogRows(backlogDeps({ getFilesStatus: async () => NO_FILES, loadObservations }))
    expect(loadObservations).not.toHaveBeenCalled()
  })

  const STORED_BUT_UNUSABLE: { name: string; load: () => Promise<typeof LOADED | null> }[] = [
    {
      // Since v1.0.14 `loadEbirdObservations` resolves null for a read that
      // failed, a file that read back empty, and a parse that failed alike — an
      // interrupted `writeTextFile` (there is no temp-and-rename) leaves a
      // truncated CSV with its metadata intact, and the eBird Backup slot accepts
      // any `.csv`, so a wrong file stores without complaint.
      name: 'the load resolves falsy',
      load: async () => null,
    },
    {
      // Defense in depth rather than the live path: v1.0.15 moved the read inside
      // the cache's own try, so this promise structurally cannot reject today.
      // The catch is kept, and what matters is that it points at the honest state
      // — before this fix it landed on the same setup-shaped lie as everything
      // else.
      name: 'the load rejects',
      load: async () => { throw new TypeError('Failed to fetch') },
    },
  ]

  it.each(STORED_BUT_UNUSABLE.map(r => [r.name, r] as const))(
    'reports a LOAD FAILURE when a backup is stored and %s',
    async (_name, route) => {
      expect(await resolveBacklogRows(backlogDeps({ loadObservations: route.load })))
        .toBe(BACKLOG_LOAD_FAILED)
    },
  )

  it('reports a load failure when the status read itself fails', async () => {
    // Beyond the letter of the brief, and deliberate: when the section cannot
    // find out whether a backup is stored, "you have no backup" is a claim it
    // has no basis for, and it is the exact claim this family exists to remove.
    // Reachable on web/Pi, where `getFilesStatus` is a bare fetch at a backend
    // that can be unreachable.
    const r = await resolveBacklogRows(backlogDeps({
      getFilesStatus: async () => { throw new TypeError('Failed to fetch') },
    }))
    expect(r).toBe(BACKLOG_LOAD_FAILED)
  })

  it('writes nothing when the run is superseded during the status read', async () => {
    // The status read is the async boundary this fix ADDS, so it is the one that
    // had no liveness check before it existed.
    const loadObservations = vi.fn(async () => LOADED)
    const r = await resolveBacklogRows(backlogDeps({ isCurrent: () => false, loadObservations }))
    expect(r).toBe(BACKLOG_SUPERSEDED)
    expect(loadObservations).not.toHaveBeenCalled()
  })

  it('reports a load failure when the ROW BUILD throws', async () => {
    // The effect this replaced wrapped its whole `.then` body in one `.catch`, so
    // this route was covered before the lift and has to stay covered after it.
    // `buildChecklistRows` is a pure pass over normalized records, so it is
    // remote -- but uncaught it escapes past a `.then` with no `.catch` and the
    // section parks on "Building your backlog…" for the rest of the session,
    // which is worse than the message this build exists to fix.
    const r = await resolveBacklogRows(backlogDeps({
      buildRows: () => { throw new TypeError('cannot read properties of undefined') },
    }))
    expect(r).toBe(BACKLOG_LOAD_FAILED)
  })

  it('never rejects when the liveness check throws on its LATER call', async () => {
    // The named case, because it is the one a roster missed. `isCurrent` is called
    // twice, and only the first call sits inside the status read's try, so a
    // predicate that throws immediately is caught and reads as guarded while one
    // that throws after the observations load rejected the whole promise. There
    // is no good answer to a throwing liveness predicate, so it takes the same
    // visible one as everything else here rather than escaping to nobody.
    let calls = 0
    const deps = backlogDeps({
      isCurrent: () => { calls += 1; if (calls === 2) throw new TypeError('boom'); return true },
    })
    await expect(resolveBacklogRows(deps)).resolves.toBe(BACKLOG_LOAD_FAILED)
    expect(calls).toBe(2)   // non-vacuity: the later call really was reached
  })

  it('never rejects, whichever dependency throws and however late', async () => {
    // The property `App.tsx` relies on: it calls this with a `.then` and no
    // `.catch`, because the guard belongs where a test can drive it.
    //
    // ITERATED OVER THE DEPENDENCY OBJECT, NEVER A LIST OF NAMES. The first
    // attempt at this row named three of the four members in a literal array, and
    // a roster cannot see what it does not name: the omitted one was `isCurrent`,
    // whose second call site was the only unguarded statement in the module. A
    // fifth dependency called outside every `try` produced no failure at all.
    // `Object.keys` closes that by construction, since TypeScript already forces
    // this fixture to carry every member of `BacklogLoadDeps` for the call below
    // to compile -- so adding a dependency adds its rows here whether or not
    // anyone remembers this file.
    //
    // AND THE nth-CALL SWEEP IS THE OTHER HALF. A member called more than once
    // has more than one site, and they are not equally guarded; throwing only on
    // the first call is exactly what made the defect invisible.
    const KEYS = Object.keys(backlogDeps())
    const NTH_MAX = 3
    const LEGAL: unknown[] = [BACKLOG_LOAD_FAILED, BACKLOG_SUPERSEDED, null]
    let checked = 0

    for (const key of KEYS) {
      for (let nth = 1; nth <= NTH_MAX; nth += 1) {
        const base = backlogDeps() as unknown as Record<string, (...args: never[]) => unknown>
        const real = base[key]
        let calls = 0
        base[key] = (...args: never[]) => {
          calls += 1
          if (calls === nth) throw new TypeError(`${key} threw on call ${nth}`)
          return real(...args)
        }
        const deps = base as unknown as Parameters<typeof resolveBacklogRows>[0]

        const [settled] = await Promise.allSettled([resolveBacklogRows(deps)])
        // Compared as a labelled string so a failure names the member and the
        // call number instead of reporting 'rejected' with no context.
        expect(`${key}#${nth}: ${settled.status}`).toBe(`${key}#${nth}: fulfilled`)
        const value = (settled as PromiseFulfilledResult<unknown>).value
        // A throw on a call that never happens leaves the healthy path intact, so
        // the resolved value is a legal state rather than always the failure one.
        expect(Array.isArray(value) || LEGAL.includes(value)).toBe(true)
        checked += 1
      }
    }

    // Non-vacuity: an empty or partial key list would otherwise pass silently.
    expect(checked).toBe(KEYS.length * NTH_MAX)
    expect(KEYS.length).toBeGreaterThanOrEqual(4)
  })

  it('writes nothing when a superseded run finally settles TRUTHY', async () => {
    // Finding C's rule, at this surface: a cancelled run writes no state at all,
    // including the state it would otherwise have been right about. Cancelled
    // here only AFTER the observations load, so the earlier guard cannot be what
    // makes this pass.
    let calls = 0
    const buildRows = vi.fn(() => BACKLOG_ROWS)
    const r = await resolveBacklogRows(backlogDeps({
      isCurrent: () => { calls += 1; return calls < 2 },
      buildRows,
    }))
    expect(r).toBe(BACKLOG_SUPERSEDED)
    // And it does not spend a full row build on an answer nobody will read.
    expect(buildRows).not.toHaveBeenCalled()
  })
})

describe('Finding E: what the Weather Backlog section renders for each of those', () => {
  const ENTRY = /list checklists with no weather blocks/i
  const backlogProps = {
    lookupWeather: async () => null,
    onCopy: async () => true,
    onGoToSettings: () => {},
    onGoToImport: () => {},
  }
  const toggle = () => fireEvent.click(screen.getByRole('button', { name: ENTRY }))

  it('a stored backup that would not load names the file and the Settings path', () => {
    render(<WeatherBacklog {...backlogProps} rows={BACKLOG_LOAD_FAILED} />)
    toggle()

    const box = screen.getByText(EBIRD_BACKUP_LOAD_ERROR)
    expect(box.className).toContain('sr-wrap-anywhere')
    // Not the setup-shaped panel: a backup IS stored in this state, and telling
    // someone to import one they have already imported is the defect itself.
    expect(screen.queryByText(/Load your eBird backup first/)).toBeNull()
    expect(screen.queryByRole('button', { name: /Go to Import/ })).toBeNull()
    expect(screen.queryByText(EBIRD_STEPS_MARKER)).toBeNull()
    // And a way out of it, the same one the tabs offer.
    expect(screen.getByRole('button', { name: /Go to Settings/ })).toBeTruthy()
  })

  it('no backup stored still shows the guidance and its Go to Import CTA', () => {
    render(<WeatherBacklog {...backlogProps} rows={null} />)
    toggle()

    expect(screen.getByText(/Load your eBird backup first/)).toBeTruthy()
    expect(screen.getByRole('button', { name: /Go to Import/ })).toBeTruthy()
    expect(screen.queryByText(EBIRD_BACKUP_LOAD_ERROR)).toBeNull()
  })

  it('the alert region is the SAME node before and after the message, across a collapse', () => {
    // The guarantee `TabLoadErrorAlert` exists to provide: `role="alert"`
    // announces a mutation on a node ALREADY in the accessibility tree, so a
    // region created carrying its text announces nothing (DECISIONS.md v0.5.83).
    // The eight tabs get this from mounting the component at fragment index 0 of
    // every phase branch. This section cannot: its panel UNMOUNTS on collapse, so
    // a region mounted inside the panel would hold on the first expand — the
    // panel always opens on the spinner — and lose it on every re-expand. Hence
    // the region lives OUTSIDE the disclosure, and the assertion is node
    // IDENTITY: a build that moves it back inside still renders an alert with the
    // right text and still passes every presence and textContent check.
    const { container } = render(<WeatherBacklog {...backlogProps} rows={BACKLOG_LOAD_FAILED} />)
    const region = container.querySelector('[role="alert"]')
    expect(region).toBeTruthy()
    expect(region!.textContent).toBe('')      // present, and empty, while collapsed

    toggle()                                   // first expand
    expect(container.querySelector('[role="alert"]')).toBe(region)
    expect(region!.textContent).toBe(EBIRD_BACKUP_LOAD_ERROR)

    toggle()                                   // collapse — the panel unmounts
    expect(container.querySelector('[role="alert"]')).toBe(region)
    expect(region!.textContent).toBe('')

    toggle()                                   // re-expand: the path a panel-mounted region loses
    expect(container.querySelector('[role="alert"]')).toBe(region)
    expect(region!.textContent).toBe(EBIRD_BACKUP_LOAD_ERROR)
  })

  it('the region is present and empty in every state that is not the failure', () => {
    // Non-vacuity for the row above, and the property the tabs state as "the
    // region existed, empty, in the commit before the message": the region is not
    // something the failure state brings with it.
    const { container, rerender } = render(<WeatherBacklog {...backlogProps} rows={undefined} />)
    toggle()
    const region = container.querySelector('[role="alert"]')
    expect(region!.textContent).toBe('')       // while the rows are still building
    expect(screen.getByText(/Building your backlog/)).toBeTruthy()

    rerender(<WeatherBacklog {...backlogProps} rows={null} />)
    expect(container.querySelector('[role="alert"]')).toBe(region)
    expect(region!.textContent).toBe('')       // and while the guidance shows

    rerender(<WeatherBacklog {...backlogProps} rows={BACKLOG_LOAD_FAILED} />)
    expect(container.querySelector('[role="alert"]')).toBe(region)
    expect(region!.textContent).toBe(EBIRD_BACKUP_LOAD_ERROR)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// FINDING B, at the command palette (command-palette FR-33 / FR-35, QA-34)
// ─────────────────────────────────────────────────────────────────────────────
//
// WHY THIS IS ITS OWN BLOCK RATHER THAN A ROW IN `EBIRD_MESSAGE_TABS`, because
// the schema asked for a row there and the roster's own shape refuses it. Every
// row in that array declares a `setupTitle` and a `stepsMarker`, and both tests
// over it turn on the surface having a `setup-required` PHASE: the first asserts
// the steps are absent and a "Go to Settings" button is present, and the second
// asserts that with no file stored the SetupRequired panel renders instead. The
// palette has no such phase and never will. It is not a tab (`lib/tabLayout.ts`
// is what a tab is), it renders no guidance panel and no Go to Settings button,
// and it keeps working for destinations in all four states -- so a row there
// would have to be given two fields that describe nothing, and the second test
// would assert a panel this surface must never show.
//
// It is the same reasoning that keeps the Weather backlog out of the tab
// rosters, one step further: that one is a section rather than a tab, and this
// one is an overlay rather than either. What the palette DOES owe is the same
// claim -- a stored file it cannot load is named honestly, and a file that is
// genuinely absent is named differently -- so both directions are here.
//
// These rows prove DELIVERY only, like every other per-surface row in this file:
// they import the same constant the component imports. The CONTENT claim is
// pinned exactly once, by the first test in this file.

const PALETTE_ICON = (() => null) as unknown as PaletteNavItem['icon']
const PALETTE_ITEMS: PaletteNavItem[] = [
  { id: 'weather', label: 'Weather', icon: PALETTE_ICON },
  { id: 'settings', label: 'Settings', icon: PALETTE_ICON },
]

function renderPalette() {
  return render(
    <CommandPalette
      items={PALETTE_ITEMS}
      onSelectTab={() => {}}
      onOpenSpecies={() => {}}
      onClose={() => {}}
    />,
  )
}

describe('Finding B: the command palette says which of the two it is', () => {
  it('shows the shared message when a STORED backup will not load', async () => {
    H.getFilesStatus.mockImplementation(async () => EBIRD_ONLY)
    H.loadEbird.mockImplementation(async () => null)
    renderPalette()

    expect(await screen.findByText(EBIRD_BACKUP_LOAD_ERROR)).toBeTruthy()
    // NOT the setup-shaped sentence, which is the lie this bundle is named for.
    expect(screen.queryByText(PALETTE_COPY.speciesNoBackup)).toBeNull()
    // And the palette keeps working for destinations regardless, which is the
    // one thing it does that no tab in the roster above does.
    expect(screen.getByRole('option', { name: 'Weather' })).toBeTruthy()
  })

  it('shows its OWN needs-a-backup sentence when none is stored (the absent case)', async () => {
    H.getFilesStatus.mockImplementation(async () => NO_FILES)
    renderPalette()

    expect(await screen.findByText(PALETTE_COPY.speciesNoBackup)).toBeTruthy()
    expect(screen.queryByText(EBIRD_BACKUP_LOAD_ERROR)).toBeNull()
    // It points at the same Settings path the steps panel would, without being
    // a steps panel: the palette has no setup-required phase.
    expect(PALETTE_COPY.speciesNoBackup).toContain('Settings → Default Files → eBird Backup')
    expect(screen.queryByText(EBIRD_STEPS_MARKER)).toBeNull()
  })

  it('reports a load failure when the STATUS READ itself fails, never the absence', async () => {
    // Reachable on web and the Pi, where getFilesStatus is a bare fetch at a
    // backend that can be unreachable. With no way to see the file, "you have no
    // backup" is a claim this surface has no basis for.
    H.getFilesStatus.mockImplementation(async () => { throw new TypeError('Failed to fetch') })
    renderPalette()

    expect(await screen.findByText(EBIRD_BACKUP_LOAD_ERROR)).toBeTruthy()
    expect(screen.queryByText(PALETTE_COPY.speciesNoBackup)).toBeNull()
  })

  it('carries the message in an alert-capable region that existed before it (FR-37)', async () => {
    // The region is mounted from the palette's FIRST commit and filled
    // afterwards -- a region that arrives with its message is the standard way
    // for an announcement to be missed. Asserted as the reconciliation property
    // (same node before and after), which is what jsdom can actually see; the
    // accessibility tree is a browser measurement.
    H.getFilesStatus.mockImplementation(async () => EBIRD_ONLY)
    H.loadEbird.mockImplementation(async () => null)
    const { container } = renderPalette()
    const region = container.querySelector('[role="status"]')
    expect(region).toBeTruthy()

    await screen.findByText(EBIRD_BACKUP_LOAD_ERROR)
    expect(container.querySelector('[role="status"]')).toBe(region)
    // The region holds the sentence and NOTHING else: no button inside it, so
    // what is read out is the sentence itself.
    expect(region!.textContent).toBe(EBIRD_BACKUP_LOAD_ERROR)
    expect(region!.querySelectorAll('button, a[href]')).toHaveLength(0)
  })
})
