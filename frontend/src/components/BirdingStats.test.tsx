// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, render, screen, cleanup, waitFor } from '@testing-library/react'
import type { ObservationEntry } from '../types'

// ── Deterministic rAF / rIC control ───────────────────────────────────────────
// The progressive-render gates schedule via a double requestAnimationFrame (the
// `computed` flip) and requestIdleCallback (the map mount). We capture both into
// FIFO queues and flush them explicitly so the two-pass render and the idle map
// mount are observable step by step (jsdom has no requestIdleCallback at all).
let rafQueue: FrameRequestCallback[] = []
let idleQueue: Array<() => void> = []

function flushRaf() {
  // One rAF "tick" — runs everything queued *now*; the second rAF that each
  // callback schedules lands in the queue for the NEXT flush.
  const batch = rafQueue
  rafQueue = []
  for (const cb of batch) cb(performance.now())
}

function flushIdle() {
  const batch = idleQueue
  idleQueue = []
  for (const cb of batch) cb()
}

// ── Module mocks ───────────────────────────────────────────────────────────────

// SnowMap is heavy (MapLibre); stub it so we can assert mount timing without WebGL.
vi.mock('./SnowMap', () => ({
  SnowMap: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="snowmap-stub">{children}</div>
  ),
}))

// Markers/Popups inside the (mocked) map — render children inertly.
vi.mock('react-map-gl/maplibre', () => ({
  Marker: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  Popup: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}))

// A small fixed eBird dataset: 3 species across 3 dates + coordinates, so the life
// list, accumulation chart (>1 lifer point), and geographic pins are all non-empty.
const FIXTURE_OBS: ObservationEntry[] = [
  {
    submissionId: 'S1', commonName: 'American Robin', scientificName: 'Turdus migratorius',
    date: '2023-01-10', location: 'Park', locationId: 'L1', latitude: 44.9, longitude: -93.1,
    county: 'Hennepin', count: 2, breedingCode: null, speciesComments: '', catalogIds: [],
    stateProvince: 'US-MN', duration: 30, distance: 1, protocol: 'Traveling',
  },
  {
    submissionId: 'S2', commonName: 'Blue Jay', scientificName: 'Cyanocitta cristata',
    date: '2023-02-15', location: 'Woods', locationId: 'L2', latitude: 45.0, longitude: -93.2,
    county: 'Ramsey', count: 1, breedingCode: null, speciesComments: '', catalogIds: [],
    stateProvince: 'US-MN', duration: 45, distance: 2, protocol: 'Traveling',
  },
  {
    submissionId: 'S3', commonName: 'Northern Cardinal', scientificName: 'Cardinalis cardinalis',
    date: '2023-03-20', location: 'Yard', locationId: 'L3', latitude: 45.1, longitude: -93.3,
    county: 'Hennepin', count: 3, breedingCode: null, speciesComments: '', catalogIds: [],
    stateProvince: 'US-MN', duration: 15, distance: 0.5, protocol: 'Stationary',
  },
]

vi.mock('../lib/observationsCache', () => ({
  loadEbirdObservations: vi.fn(async () => ({ text: '', observations: FIXTURE_OBS })),
}))

// Shared ML-export cache (perf batch D): BirdingStats loads media via loadMLExport()
// rather than storage.readFile('ml') + parseMLExport. No ML file in this fixture, so
// null is fine — it exercises the no-media path (no Media section / jump-nav chip).
vi.mock('../lib/mlExportCache', () => ({
  loadMLExport: vi.fn(async () => null),
}))

vi.mock('../lib/storage', () => ({
  storage: {
    getFilesStatus: vi.fn(async () => ({
      ebird: { filename: 'ebird.csv', uploadedAt: '2023-04-01' },
      ml: null,
    })),
    getSetting: vi.fn(async () => null),
    setSetting: vi.fn(async () => {}),
    readFile: vi.fn(async () => null),
    getApiKey: vi.fn(async () => null),
  },
}))

vi.mock('../lib/transport', () => ({
  transport: {
    post: vi.fn(async (path: string) => {
      if (path === '/taxonomy/codes') return { codes: {} }
      return {}
    }),
    get: vi.fn(async () => ({ species: [] })),
  },
}))

// ── Lifecycle ───────────────────────────────────────────────────────────────────

let BirdingStats: typeof import('./BirdingStats').BirdingStats

beforeEach(async () => {
  rafQueue = []
  idleQueue = []
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    rafQueue.push(cb)
    return rafQueue.length
  })
  vi.stubGlobal('cancelAnimationFrame', () => {})
  vi.stubGlobal('requestIdleCallback', (cb: () => void) => {
    idleQueue.push(cb)
    return idleQueue.length
  })
  vi.stubGlobal('cancelIdleCallback', () => {})
  // Import after mocks are registered.
  ;({ BirdingStats } = await import('./BirdingStats'))
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

// Render + let the async load() effect resolve (it awaits storage + transport),
// without yet flushing the rAF that flips `computed`.
async function renderAndLoad() {
  const utils = render(
    <BirdingStats onGoToSettings={() => {}} onOpenSpecies={() => {}} />,
  )
  // Drain the load() promise chain so phase → 'ready'.
  await waitFor(() => expect(screen.getByText('Statistics')).toBeTruthy())
  return utils
}

describe('BirdingStats progressive render', () => {
  it('paints the shell (header + jump-nav + computing indicator) before flushing rAF', async () => {
    await renderAndLoad()

    // Header + jump-nav are present in the shell pass.
    expect(screen.getByText('Statistics')).toBeTruthy()
    expect(screen.getByRole('navigation', { name: 'Jump to section' })).toBeTruthy()

    // The computing indicator (role=status) is shown…
    const status = screen.getByRole('status')
    expect(status.textContent).toBe('Computing your statistics…')

    // …and NO section CARDS exist yet (the cascade hasn't run). The same titles
    // appear as jump-nav <a> chips, so we look specifically for the card heading.
    expect(screen.queryByRole('heading', { name: 'Life List Totals' })).toBeNull()
    expect(screen.queryByRole('heading', { name: 'Top Species' })).toBeNull()
    // The jump-nav chip for the section still renders (shell-only).
    expect(screen.getByRole('link', { name: 'Life List Totals' })).toBeTruthy()
    // The checklist count is a placeholder while computing.
    expect(screen.getByText(/… checklists/)).toBeTruthy()
  })

  it('renders section cards + chart wrappers (role=img) after the double rAF', async () => {
    await renderAndLoad()

    // First rAF schedules the second; second rAF flips `computed`.
    await act(async () => { flushRaf() })
    await act(async () => { flushRaf() })

    // Section cards appear (heading, not the jump-nav chip).
    expect(screen.getByRole('heading', { name: 'Life List Totals' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Top Species' })).toBeTruthy()

    // The accumulation chart wrapper has role="img" with an aria-label.
    const imgs = screen.getAllByRole('img')
    expect(imgs.length).toBeGreaterThan(0)
    expect(imgs.some(el => /accumulation chart/i.test(el.getAttribute('aria-label') ?? ''))).toBe(true)

    // The computing indicator is gone.
    expect(screen.queryByText('Computing your statistics…')).toBeNull()
  })

  it('mounts the SnowMap only after the idle callback fires', async () => {
    await renderAndLoad()
    await act(async () => { flushRaf() })
    await act(async () => { flushRaf() })

    // After computed, the section tree (incl. Geographic Stats) is present, but the
    // map is still its placeholder — SnowMap has NOT mounted.
    expect(screen.getByRole('heading', { name: 'Geographic Stats' })).toBeTruthy()
    expect(screen.queryByTestId('snowmap-stub')).toBeNull()
    // The placeholder shows a "Loading map…" status.
    expect(screen.getAllByText('Loading map…').length).toBeGreaterThan(0)

    // Now fire the idle callback → the map mounts.
    await act(async () => { flushIdle() })
    expect(screen.getByTestId('snowmap-stub')).toBeTruthy()
  })
})
