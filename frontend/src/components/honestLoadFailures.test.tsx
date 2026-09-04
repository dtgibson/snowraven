// @vitest-environment jsdom
//
// honest-load-failures (Fix lane, Spool bundle build 3).
//
// Three findings, one file, because all three are the same claim on the same
// nine surfaces: what a tab SAYS about a stored file must match what is
// actually true of it. The rosters below are the artifact — a tenth surface, or
// a fifth cancel-guarded loader, reads as a MISSING ROW rather than as nothing
// at all. (`pipeline/clear-means-clear/pr-description.md`: symmetry in the code
// is not symmetry in the evidence.)
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
//
// HOW THE COPY ROWS DIVIDE THE WORK, because it is easy to misread them. The
// per-surface rows import the same constant the components import, so they can
// only prove DELIVERY (this surface renders the shared string) — they cannot
// fail if the string's CONTENT is wrong, which is the v0.5.88 rule about a
// reference point derived from the thing being verified. The content claim is
// pinned exactly once, by the first test, against literals written here.
//
// WHAT THIS FILE CANNOT PROVE: that the longer message wraps without horizontal
// overflow at 320px / 200% text scale. jsdom has no layout engine, so the rows
// assert the MECHANISM (the wrap class); the pixels are the Playwright text-ink
// measurement recorded in the PR notes.

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
      // importFileContent validates only the .csv extension, so the eBird backup
      // uploaded into the ML Export slot stores without complaint.
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
