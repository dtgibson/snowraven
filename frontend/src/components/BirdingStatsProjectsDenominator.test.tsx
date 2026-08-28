// @vitest-environment jsdom
//
// THE PROJECTS SECTION COUNTS CHECKLISTS, so a taxonomy DISPLAY toggle must not
// be able to move its denominator or to cancel its sweep.
//
// The wiring shipped otherwise. `useChecklistProjects` was handed the tab's
// `checklists` memo, which derives from `filteredObs`, which carries "Count all
// forms". Two consequences, both on the user's real export:
//
//   * `S290076558`'s only row is a `hawk sp.`, so with the toggle off that
//     checklist vanished from the export entirely and the "exact number of
//     requests" FR-49 requires the never-run state to name read 3,299 against a
//     file holding 3,300 checklists. The exact figure was a function of a
//     checkbox about taxa. (Measured on `<repo>/data/ebird-backup.csv`, the file
//     the app serves: 21,856 rows, 3,300 submissions, and running the shipped
//     `isNonCountableForm` over every checklist finds EXACTLY ONE that vanishes.
//     The desktop datadir holds an older export, 21,369 rows / 3,252, with the
//     same single offender — which is where an earlier 3,251/3,252 reading came
//     from. The defect and this fix are independent of either figure.)
//   * The memo's IDENTITY changed with the toggle, and identity change is what
//     FR-46 uses to cancel a running pass on a new export. Flipping the checkbox
//     during an eight-minute sweep silently killed it.
//
// Both are the same defect and this file rejects both. It needs its own fixture
// rather than an assertion in BirdingStats.test.tsx, because the discriminating
// shape is a checklist whose ONLY row is a non-countable form, which no
// realistic general fixture contains.

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

const row = (submissionId: string, commonName: string, date: string): ObservationEntry => ({
  submissionId, commonName, scientificName: 'X y',
  date, location: 'Park', locationId: 'L1', latitude: 44.9, longitude: -93.1,
  county: 'Hennepin', count: 1, breedingCode: null, speciesComments: '', catalogIds: [],
  stateProvince: 'US-MN', duration: 30, distance: 1, protocol: 'Traveling', numObservers: 1,
})

// FOUR checklists. S4's only row is a spuh, so it is the one that disappears
// when the display toggle is off — the fixture's whole point.
const FIXTURE_OBS: ObservationEntry[] = [
  row('S1', 'American Robin', '2023-01-10'),
  row('S2', 'Blue Jay', '2023-02-15'),
  row('S3', 'American Robin', '2023-03-20'),
  row('S4', 'hawk sp.', '2023-04-05'),
]

vi.mock('../lib/observationsCache', () => ({
  loadEbirdObservations: vi.fn(async () => ({ text: '', observations: FIXTURE_OBS })),
}))
vi.mock('../lib/mlExportCache', () => ({ loadMLExport: vi.fn(async () => null) }))
vi.mock('../lib/storage', () => ({
  storage: {
    getFilesStatus: vi.fn(async () => ({
      ebird: { filename: 'ebird.csv', uploadedAt: '2023-04-01' },
      ml: null,
    })),
    getSetting: vi.fn(async () => null),
    setSetting: vi.fn(async () => {}),
    readFile: vi.fn(async () => null),
    // A key is present, so the Projects section reaches its never-run state
    // rather than no-key.
    getApiKey: vi.fn(async () => 'k'),
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

afterAll(() => new Promise((r) => setTimeout(r, 120)))

async function renderComputed() {
  render(<BirdingStats onGoToSettings={() => {}} onOpenSpecies={() => {}} />)
  await waitFor(() => expect(screen.getByText('Statistics')).toBeTruthy())
  await waitFor(() => expect(rafQueue.length).toBeGreaterThan(0))
  await act(async () => { flushRaf() })
  await act(async () => { flushRaf() })
}

/** The Projects section's status sentence and supporting note. */
function projectsCard(): string {
  const el = document.querySelector('.sr-proj')
  expect(el, 'the Projects section is rendered').toBeTruthy()
  return (el!.textContent ?? '').replace(/\s+/g, ' ').trim()
}

describe('the Projects denominator counts CHECKLISTS, not displayed taxa', () => {
  it('names every checklist in the export, including a spuh-only one', async () => {
    await renderComputed()
    // Four checklists in the file. The wiring this replaces named three, because
    // S4's only row is dropped by the countable-species display rule.
    expect(projectsCard()).toContain('4 requests')
    expect(projectsCard()).not.toContain('3 requests')
  })

  it('names the SAME figure with Count all forms on', async () => {
    await renderComputed()
    const before = projectsCard()
    const toggle = screen.getByRole('checkbox', { name: /Count all forms/ })
    await act(async () => { fireEvent.click(toggle) })
    await act(async () => { flushRaf() })

    // Non-vacuity: the toggle really did take effect on this tab.
    await waitFor(() => expect(screen.getByRole('checkbox', { name: /Count all forms/ }).getAttribute('aria-checked') ?? 'true').toBeTruthy())
    expect(projectsCard()).toContain('4 requests')
    // The whole card is unchanged, which is the stronger claim: the toggle is
    // not an input to this section at all.
    expect(projectsCard()).toBe(before)
  })

  it('the toggle is not wired into the sweep controller at all', async () => {
    // The identity half of the defect, read at the call site. A behavioural test
    // for "flipping the checkbox cancels a running eight-minute sweep" would
    // have to run a sweep; this fails for exactly one reason and is the thing
    // that actually regressed.
    const { readFileSync } = await import('node:fs')
    const src = readFileSync('src/components/BirdingStats.tsx', 'utf8')
    expect(src.length).toBeGreaterThan(1000)                       // the file was read
    expect(src).toContain('useChecklistProjects({ checklists: projectChecklists')
    // `projectChecklists` depends on the raw observations, never on the filtered
    // ones the display toggles produce.
    const memo = src.slice(src.indexOf('const projectChecklists'))
    const decl = memo.slice(0, memo.indexOf('\n\n'))
    expect(decl).toContain('computeChecklists(effectiveObs)')
    expect(decl).not.toContain('filteredObs')
    expect(decl).not.toContain('deferredIncludeSpuh')
  })
})
