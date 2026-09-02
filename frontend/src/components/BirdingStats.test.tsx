// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach, afterAll } from 'vitest'
import { act, render, screen, cleanup, waitFor, within } from '@testing-library/react'
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
  // The geographic map also mounts Pin Share's <SharePin>, which reads the map
  // instance through useMap(). No live map here, so it reports none and the
  // pin's gesture effect bails; the assertions below are unchanged. SharePin's
  // own behavior is covered in components/map/SharePin.test.tsx.
  useMap: () => ({ current: undefined }),
}))

// A small fixed eBird dataset: 3 species across 3 dates + coordinates, so the life
// list, accumulation chart (>1 lifer point), and geographic pins are all non-empty.
const FIXTURE_OBS: ObservationEntry[] = [
  {
    submissionId: 'S1', commonName: 'American Robin', scientificName: 'Turdus migratorius',
    date: '2023-01-10', location: 'Park', locationId: 'L1', latitude: 44.9, longitude: -93.1,
    county: 'Hennepin', count: 2, breedingCode: null, speciesComments: '', catalogIds: [],
    stateProvince: 'US-MN', duration: 30, distance: 1, protocol: 'Traveling', numObservers: 1,
  },
  {
    submissionId: 'S2', commonName: 'Blue Jay', scientificName: 'Cyanocitta cristata',
    date: '2023-02-15', location: 'Woods', locationId: 'L2', latitude: 45.0, longitude: -93.2,
    county: 'Ramsey', count: 1, breedingCode: null, speciesComments: '', catalogIds: [],
    stateProvince: 'US-MN', duration: 45, distance: 2, protocol: 'Traveling', numObservers: 2,
  },
  {
    submissionId: 'S3', commonName: 'Northern Cardinal', scientificName: 'Cardinalis cardinalis',
    date: '2023-03-20', location: 'Yard', locationId: 'L3', latitude: 45.1, longitude: -93.3,
    county: 'Hennepin', count: 3, breedingCode: null, speciesComments: '', catalogIds: [],
    stateProvince: 'US-MN', duration: 15, distance: 0.5, protocol: 'Stationary', numObservers: 3,
  },
]

vi.mock('../lib/observationsCache', () => ({
  loadEbirdObservations: vi.fn(async () => ({ headerLine: '', observations: FIXTURE_OBS })),
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

// recharts bundles @reduxjs/toolkit, whose autoBatch enhancer arms a 100 ms
// fallback timer when a chart mounts. Wait it out BEFORE this file's jsdom
// environment is torn down, so the timer fires where `cancelAnimationFrame`
// still exists — the node-env shim in test-setup.ts never installs in jsdom
// files, so a timer leaking past teardown lands in an environment with neither
// jsdom's cAF nor the shim and fails the run as an unhandled ReferenceError
// pinned to whatever file runs next.
afterAll(() => new Promise((r) => setTimeout(r, 120)))

// Render + let the async load() effect resolve (it awaits storage + transport),
// without yet flushing the rAF that flips `computed`.
async function renderAndLoad() {
  const utils = render(
    <BirdingStats onGoToSettings={() => {}} onOpenSpecies={() => {}} />,
  )
  // Drain the load() promise chain so phase → 'ready'.
  await waitFor(() => expect(screen.getByText('Statistics')).toBeTruthy())
  // Commit-vs-effect race: the 'Statistics' heading appears on the phase-ready
  // COMMIT, but the double-rAF cascade is queued by a PASSIVE EFFECT that runs
  // after that commit. Under suite load, the waitFor above can resolve on the
  // commit's DOM mutation before the effect has pushed rAF1 into the stubbed
  // rafQueue — a flush then drains an empty queue, the ladder never completes,
  // and `computed` never flips. Wait on the observable stub-queue precondition
  // (no wall-clock) so every flush below is guaranteed to have work.
  await waitFor(() => expect(rafQueue.length).toBeGreaterThan(0))
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

    // Diagnostic (non-load-bearing): the map-mount effect must already have
    // queued its idle callback by now — if this fires, the failure is in the
    // effect scheduling, not the flush below.
    expect(idleQueue.length).toBeGreaterThan(0)
    // Now fire the idle callback → the map mounts.
    await act(async () => { flushIdle() })
    expect(screen.getByTestId('snowmap-stub')).toBeTruthy()
  })
})

// Render the full computed tree (both rAFs flushed) so section content is present.
async function renderComputed() {
  const utils = await renderAndLoad()
  await act(async () => { flushRaf() })
  await act(async () => { flushRaf() })
  return utils
}

describe('BirdingStats accessibility', () => {
  // F008: segmented filter/view controls must expose their selected state.
  it('exposes aria-pressed on the accumulation-granularity segmented control', async () => {
    await renderComputed()
    const group = screen.getByRole('group', { name: 'Accumulation granularity' })
    expect(group).toBeTruthy()
    // The default granularity is "total" → its button is pressed, the rest not.
    const total = within(group).getByRole('button', { name: 'Total' })
    expect(total.getAttribute('aria-pressed')).toBe('true')
    const monthly = within(group).getByRole('button', { name: 'Monthly' })
    expect(monthly.getAttribute('aria-pressed')).toBe('false')
  })

  // F033/F064/F078: the dense checklist affordances (location cards, species pills)
  // now render through the shared ChecklistLink in compact (icon-only) mode — a
  // descriptive accessible name incl. the new-tab cue, with the external-link icon
  // decorative (aria-hidden) instead of a bare "↗" glyph the screen reader would read.
  it('names the compact checklist links and hides their icon from AT', async () => {
    await renderComputed()
    // Compact links carry the canonical id-bearing name; the label-leading full
    // links (date/count) don't match this id-bearing pattern, so this targets the
    // icon-only affordances specifically.
    const named = screen.getAllByRole('link', { name: /open checklist S\d+ on ebird \(opens in a new tab\)/i })
    expect(named.length).toBeGreaterThan(0)
    for (const link of named) {
      // Named by its function, never by a bare glyph; the icon is decorative.
      expect(link.getAttribute('aria-label')).not.toBe('↗')
      const svg = link.querySelector('svg')
      expect(svg).toBeTruthy()
      expect(svg?.getAttribute('aria-hidden')).toBe('true')
    }
  })

  // F029: jump-nav targets carry tabindex="-1" so focus can move to them.
  it('gives each Statistics section card tabindex="-1" so jump links can focus it', async () => {
    await renderComputed()
    const heading = screen.getByRole('heading', { name: 'Geographic Stats' })
    // SectionCard root is the element with the section id; walk up to it.
    const card = heading.closest('[id]') as HTMLElement
    expect(card).toBeTruthy()
    expect(card.getAttribute('tabindex')).toBe('-1')
  })

  // F002: the decorative observer donut must not leave a focusable SVG inside its
  // aria-hidden wrapper. recharts' accessibility SVG carries role="application";
  // with accessibilityLayer={false} none should exist under the hidden wrapper.
  it('has no role="application" focus ghost inside an aria-hidden chart wrapper', async () => {
    const { container } = await renderComputed()
    const hidden = Array.from(container.querySelectorAll('[aria-hidden="true"]'))
    // The fixture has per-checklist observer counts, so the decorative observer
    // donut renders inside an aria-hidden wrapper that itself contains an <svg>.
    const wrapperWithChart = hidden.find(n => n.querySelector('svg'))
    expect(wrapperWithChart).toBeTruthy()
    for (const node of hidden) {
      expect(node.querySelector('[role="application"]')).toBeNull()
      expect(node.querySelector('svg[tabindex="0"]')).toBeNull()
    }
  })
})

describe('BirdingStats observer-count legend', () => {
  // group-size-exact-counts: every observer-count row's exact list count is
  // readable in the legend (count-first, "N obs · N lists (P%)") without the
  // click tooltip. Fixture: one checklist each at 1, 2, and 3 observers →
  // three rows, each with singular "1 list" and a 33% share. The "<1%"
  // zero-collapse fix is unit-tested at the source (fmtSharePct in
  // statsFormat.test.ts); this locks the legend wiring to it.
  it('shows the exact list count and share for every observer-count row', async () => {
    await renderComputed()
    expect(screen.getByText('Lists by observer count')).toBeTruthy()
    expect(screen.getByText('1 obs · 1 list (33%)')).toBeTruthy()
    expect(screen.getByText('2 obs · 1 list (33%)')).toBeTruthy()
    expect(screen.getByText('3 obs · 1 list (33%)')).toBeTruthy()
  })
})

describe('BirdingStats checklist duration block', () => {
  // Temporal Stats duration histogram: fixture durations 15/30/45 land in
  // [15,30)/[30,45)/[45,60); the in-range [0,15) zero bin still renders, nothing
  // past the longest bin, and the caption shows the model's OWN average via
  // formatDuration ((15+30+45)/3 = 30 min) — which equals Effort's on this
  // all-in-range fixture. All fixture checklists carry a usable duration, so
  // no coverage note.
  it('renders the duration bins with zero-bin backfill and the average caption', async () => {
    await renderComputed()
    expect(screen.getByText('Checklist duration')).toBeTruthy()
    expect(screen.getByText('0-15m')).toBeTruthy()     // zero-count bin inside the range
    expect(screen.getByText('45-60m')).toBeTruthy()    // bin containing the longest (45)
    expect(screen.queryByText('1h-1h 15m')).toBeNull() // no bin beyond the longest
    expect(screen.getByText('30 min avg')).toBeTruthy()
    expect(screen.queryByText(/have a usable duration/)).toBeNull()
  })
})
