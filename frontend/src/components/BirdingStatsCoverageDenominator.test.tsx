// @vitest-environment jsdom
//
// The media documentation coverage DENOMINATOR is built in `BirdingStats`, not in
// `computeMediaStats`, and this file exists because that wiring had no coverage:
// reverting it to the unfiltered `backboneNames` left all 2,531 tests passing.
//
// Why it needs its own file rather than an assertion in `BirdingStats.test.tsx`:
// that fixture deliberately loads NO ML export, so the coverage block never
// renders there at all and every assertion about it would be vacuous. The mock
// scaffolding is duplicated on purpose; the two files describe different fixtures.
//
// THE DEFECT THIS REJECTS. The form rule has to run on the RAW exported name,
// because normalization destroys the form: "Brewster's Warbler (hybrid)" becomes
// "Brewster's Warbler", which reads exactly like a species and which no rule
// applied afterwards can tell from one. The Species tile filters raw observations
// and would drop it; a coverage denominator built from normalized names would
// keep it, and the same tab would then hold two different answers to "what is a
// species". That is the disagreement this whole build exists to remove.

import { describe, it, expect, vi, beforeEach, afterEach, afterAll } from 'vitest'
import { act, render, screen, cleanup, waitFor, fireEvent } from '@testing-library/react'
import type { ObservationEntry } from '../types'

let rafQueue: FrameRequestCallback[] = []
let idleQueue: Array<() => void> = []
function flushRaf() {
  const batch = rafQueue
  rafQueue = []
  for (const cb of batch) cb(performance.now())
}

vi.mock('./SnowMap', () => ({
  SnowMap: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}))
vi.mock('react-map-gl/maplibre', () => ({
  Marker: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  Popup: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  useMap: () => ({ current: undefined }),
}))

// Three recorded species, one of which eBird does not count. `Blue Jay` is
// undocumented, so the numerator and denominator differ and neither can be read
// off the other by accident.
const FIXTURE_OBS: ObservationEntry[] = [
  {
    submissionId: 'S1', commonName: 'American Robin', scientificName: 'Turdus migratorius',
    date: '2023-01-10', location: 'Park', locationId: 'L1', latitude: 44.9, longitude: -93.1,
    county: 'Hennepin', count: 2, breedingCode: null, speciesComments: '', catalogIds: ['1'],
    stateProvince: 'US-MN', duration: 30, distance: 1, protocol: 'Traveling', numObservers: 1,
  },
  {
    submissionId: 'S2', commonName: 'Blue Jay', scientificName: 'Cyanocitta cristata',
    date: '2023-02-15', location: 'Woods', locationId: 'L2', latitude: 45.0, longitude: -93.2,
    county: 'Ramsey', count: 1, breedingCode: null, speciesComments: '', catalogIds: [],
    stateProvince: 'US-MN', duration: 45, distance: 2, protocol: 'Traveling', numObservers: 2,
  },
  {
    // eBird publishes this and does not count it (a named hybrid carrying no " x ").
    submissionId: 'S3', commonName: "Brewster's Warbler (hybrid)", scientificName: 'Vermivora cyanoptera x chrysoptera',
    date: '2023-03-20', location: 'Yard', locationId: 'L3', latitude: 45.1, longitude: -93.3,
    county: 'Hennepin', count: 1, breedingCode: null, speciesComments: '', catalogIds: [],
    stateProvince: 'US-MN', duration: 15, distance: 0.5, protocol: 'Stationary', numObservers: 1,
  },
]

const FIXTURE_ML = {
  rows: [{
    catalogId: '1', commonName: 'American Robin', scientificName: 'Turdus migratorius',
    format: 'Photo', date: '2023-01-10', location: 'Park', county: 'Hennepin',
    latitude: 44.9, longitude: -93.1, caption: '', mediaNotes: '', observationDetails: '',
    ageSex: '', behaviors: '', time: '', year: 2023, month: 1,
    avgRating: null, numRatings: 0, checklistId: 'S1',
  }],
  entries: [], mediaMap: { '1': 'Photo' }, userId: null,
}

vi.mock('../lib/observationsCache', () => ({
  loadEbirdObservations: vi.fn(async () => ({ headerLine: '', observations: FIXTURE_OBS })),
}))
vi.mock('../lib/mlExportCache', () => ({
  loadMLExport: vi.fn(async () => FIXTURE_ML),
}))
vi.mock('../lib/storage', () => ({
  storage: {
    getFilesStatus: vi.fn(async () => ({
      ebird: { filename: 'ebird.csv', uploadedAt: '2023-04-01' },
      ml: { filename: 'ml.csv', uploadedAt: '2023-04-01' },
    })),
    getSetting: vi.fn(async () => null),
    setSetting: vi.fn(async () => {}),
    readFile: vi.fn(async () => null),
    getApiKey: vi.fn(async () => null),
  },
}))
vi.mock('../lib/transport', () => ({
  transport: {
    post: vi.fn(async (path: string) => (path === '/taxonomy/codes' ? { codes: {} } : {})),
    get: vi.fn(async () => ({ species: [] })),
  },
}))

let BirdingStats: typeof import('./BirdingStats').BirdingStats

beforeEach(async () => {
  rafQueue = []
  idleQueue = []
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => { rafQueue.push(cb); return rafQueue.length })
  vi.stubGlobal('cancelAnimationFrame', () => {})
  vi.stubGlobal('requestIdleCallback', (cb: () => void) => { idleQueue.push(cb); return idleQueue.length })
  vi.stubGlobal('cancelIdleCallback', () => {})
  ;({ BirdingStats } = await import('./BirdingStats'))
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

// recharts bundles @reduxjs/toolkit, whose autoBatch fallback timer (100 ms) must
// fire before this file's jsdom environment is torn down.
afterAll(() => new Promise((r) => setTimeout(r, 120)))

async function renderComputed() {
  render(<BirdingStats onGoToSettings={() => {}} onOpenSpecies={() => {}} />)
  await waitFor(() => expect(screen.getByText('Statistics')).toBeTruthy())
  // Wait on the stub queue itself, not the DOM: the passive effect that queues
  // the rAF cascade can land after the commit `waitFor` resolves on, and flushing
  // an empty queue would leave the shell frozen (the repo's frozen-shell rule).
  await waitFor(() => expect(rafQueue.length).toBeGreaterThan(0))
  await act(async () => { flushRaf() })
  await act(async () => { flushRaf() })
}

/** The coverage line renders as `<strong>1</strong> of 2 life-list species ...`, so
 *  the phrase spans several text nodes and no single-node matcher sees it. Take the
 *  SMALLEST element whose textContent carries the whole phrase, i.e. the innermost
 *  one, so the assertion is about that line rather than about the whole page. */
function coverageLine(): string {
  const phrase = 'life-list species documented with media'
  const matches = [...document.querySelectorAll('*')]
    .filter(n => (n.textContent ?? '').includes(phrase))
  expect(matches.length).toBeGreaterThan(0)   // never vacuous
  const innermost = matches.reduce((a, b) =>
    (a.textContent ?? '').length <= (b.textContent ?? '').length ? a : b)
  return (innermost.textContent ?? '').replace(/\s+/g, ' ').trim()
}

describe('media documentation coverage counts only forms eBird counts', () => {
  it('excludes a named hybrid from the denominator', async () => {
    await renderComputed()
    // 3 species recorded, 2 countable, 1 of those documented.
    //
    // The discriminating figures are the DENOMINATOR and the percentage. Passing
    // the unfiltered recorded-name set turns this into "1 of 3 ... (33%)":
    // `computeMediaStats`'s own filter sees only the normalized "Brewster's
    // Warbler" and cannot reject it. Both halves of the line move, so the
    // assertion cannot pass on a half-fix.
    expect(coverageLine()).toBe('1 of 2 life-list species documented with media (50%)')
  })

  it('the countable rule is applied here regardless of the Count all forms toggle', async () => {
    // The deliberate same-tab asymmetry: this figure is ABOUT the canonical life
    // list, so the header checkbox does not move it. Turning the toggle on must
    // leave the denominator at 2 even though the Species tile then counts 3.
    await renderComputed()
    const toggle = screen.getByRole('checkbox', { name: /Count all forms/ })
    await act(async () => { fireEvent.click(toggle) })
    await act(async () => { flushRaf() })
    expect(coverageLine()).toBe('1 of 2 life-list species documented with media (50%)')
    // And the surfaces say so, rather than leaving the reader to discover it.
    // BOTH fixed-scope surfaces on this tab carry the note (media coverage and
    // Frivolous Lists), so the count is pinned at 2: single-sourcing the sentence
    // prevents the two copies DRIFTING, and nothing prevents one being dropped.
    expect(
      screen.getAllByText(/always uses countable species, whichever way Count all forms is set/),
    ).toHaveLength(2)
  })
})
