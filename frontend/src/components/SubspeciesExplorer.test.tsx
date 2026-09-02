// @vitest-environment jsdom
//
// THE WIRING GUARD FOR THE SUBSPECIES EXPLORER (subspecies-explorer). The pure
// derivations are proven in lib/subspeciesExplorer.test.ts; what this file owes
// is the WIRING into Species Detail: gating (FR-04, FR-19, FR-23), the
// pick-to-select path (FR-06), filter parity — the breakdown follows the page
// filters while the list ignores them (FR-08, FR-14) — the FR-13 ledger against
// the real Sightings figure, the FR-15/FR-07 empty states, reload recompute
// (FR-22), toggle inertness (FR-20), and the NFR-02 memoization asserted as
// WORK DONE (derivation invocations), never elapsed time (QA-26).

import { describe, it, expect, vi, beforeAll, beforeEach, afterEach, afterAll } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor, within } from '@testing-library/react'

// The maps are statically imported by SpeciesDetail and are heavy (maplibre);
// stub them. None of the assertions below involve a map. SightingsGraph is
// recharts-backed and ChartViewTip reads matchMedia (absent in jsdom); neither
// is under test here.
vi.mock('./SnowMap', () => ({
  SnowMap: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}))
vi.mock('./SightingsMap', () => ({
  SightingsMap: () => <div data-testid="sightings-map-stub" />,
}))
vi.mock('react-map-gl/maplibre', () => ({
  Marker: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  Popup: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  useMap: () => ({ current: undefined }),
}))
vi.mock('./speciesDetail/SightingsGraph', () => ({
  SightingsGraph: () => <div data-testid="sightings-graph-stub" />,
}))
vi.mock('./ChartViewTip', () => ({ ChartViewTip: () => null }))

// QA-26's instrumentation: wrap the REAL derivations with call counters, so
// memoization is asserted as invocations of the real functions. This counts
// CALLS through the wrapper (which fires per invocation), not module
// evaluations — the v1.0.5 "vi.mock factory cannot count" trap does not apply.
vi.mock('../lib/subspeciesExplorer', async (importOriginal) => {
  const mod = await importOriginal<typeof import('../lib/subspeciesExplorer')>()
  return {
    ...mod,
    buildSubspeciesIndex: vi.fn(mod.buildSubspeciesIndex),
    computeSpeciesBreakdown: vi.fn(mod.computeSpeciesBreakdown),
  }
})

import { buildSubspeciesIndex, computeSpeciesBreakdown } from '../lib/subspeciesExplorer'
import type { ObservationEntry } from '../types'

function entry(o: Partial<ObservationEntry> & { commonName: string; county: string }): ObservationEntry {
  return {
    submissionId: 'S1',
    scientificName: 'Genus species',
    date: '2023-01-10',
    location: 'Park', locationId: 'L1', latitude: null, longitude: null,
    count: 1, breedingCode: null, speciesComments: '', catalogIds: [],
    stateProvince: 'US-MN', duration: 30, distance: 1, protocol: 'Traveling', numObservers: 1,
    ...o,
  }
}

// Junco: 2 Oregon rows (Hennepin), 1 plain (Ramsey), 1 non-countable folding
// row (Ramsey). Breakdown with no filter: Oregon 2 = 66.7%, No form noted
// 1 = 33.3%, total 3, ledger 1 — against a Sightings figure of 4.
// Warbler: 1 Myrtle + 3 plain, all Hennepin. Robin: plain-only (never listed).
const FIXTURE_A: ObservationEntry[] = [
  entry({ submissionId: 'S1', commonName: 'Dark-eyed Junco (Oregon)', county: 'Hennepin' }),
  entry({ submissionId: 'S2', commonName: 'Dark-eyed Junco (Oregon)', county: 'Hennepin' }),
  entry({ submissionId: 'S3', commonName: 'Dark-eyed Junco', county: 'Ramsey' }),
  entry({ submissionId: 'S4', commonName: 'Dark-eyed Junco (fake/mystery)', county: 'Ramsey' }),
  entry({ submissionId: 'S5', commonName: 'Yellow-rumped Warbler (Myrtle)', county: 'Hennepin' }),
  entry({ submissionId: 'S6', commonName: 'Yellow-rumped Warbler', county: 'Hennepin' }),
  entry({ submissionId: 'S7', commonName: 'Yellow-rumped Warbler', county: 'Hennepin' }),
  entry({ submissionId: 'S8', commonName: 'Yellow-rumped Warbler', county: 'Hennepin' }),
  entry({ submissionId: 'S9', commonName: 'American Robin', county: 'Hennepin' }),
]

// FR-22's export B: the junco lost its forms.
const FIXTURE_B: ObservationEntry[] = [
  entry({ submissionId: 'S1', commonName: 'Dark-eyed Junco', county: 'Hennepin' }),
  entry({ submissionId: 'S2', commonName: 'Dark-eyed Junco', county: 'Ramsey' }),
]

// No form-level rows at all (QA-07).
const FIXTURE_PLAIN: ObservationEntry[] = [
  entry({ submissionId: 'S1', commonName: 'American Robin', county: 'Hennepin' }),
  entry({ submissionId: 'S2', commonName: 'Dark-eyed Junco', county: 'Ramsey' }),
]

// The mock factories are hoisted; reads of this variable are deferred into the
// vi.fn bodies, so per-test reassignment works.
let currentObs: ObservationEntry[] = FIXTURE_A

vi.mock('../lib/storage', () => ({
  storage: {
    getFilesStatus: vi.fn(async () => ({
      ebird: { filename: 'ebird.csv', uploadedAt: '2023-04-01' },
      ml: null,
    })),
    readFile: vi.fn(async () => null),
    getSetting: vi.fn(async () => null),
    setSetting: vi.fn(async () => {}),
    getApiKey: vi.fn(async () => null),
  },
}))
vi.mock('../lib/observationsCache', () => ({
  loadEbirdObservations: vi.fn(async () => ({ headerLine: '', observations: currentObs })),
}))
vi.mock('../lib/mlExportCache', () => ({ loadMLExport: vi.fn(async () => null) }))
vi.mock('../lib/transport', () => ({
  transport: {
    get: vi.fn(async () => []),
    post: vi.fn(async (path: string) =>
      path === '/taxonomy/codes'
        ? {
            codes: {},
            // Taxonomic order deliberately inverts alphabetical order, so the
            // explorer's selector-order claim (FR-05) is discriminating.
            orders: { 'yellow-rumped warbler': 1, 'dark-eyed junco': 2, 'american robin': 3 },
            formCodes: {},
          }
        : {}),
  },
  TransportError: class extends Error {},
}))

import { SpeciesDetail } from './SpeciesDetail'

beforeAll(() => {
  // jsdom does not implement scrollIntoView (used by the pick-to-select jump).
  Element.prototype.scrollIntoView = vi.fn()
})

beforeEach(() => {
  currentObs = FIXTURE_A
  vi.clearAllMocks()
})
afterEach(cleanup)

// Recharts is stubbed above, but the drain is kept per the standing rule: a
// toolkit autoBatch fallback timer armed by ANY chart-mounting path that
// outlives this file's jsdom environment fails a LATER file with every test
// here green. Cheap insurance if a future edit un-stubs the graph.
afterAll(() => new Promise((r) => setTimeout(r, 120)))

const props = { onGoToSettings: () => {}, filesVersion: 0, embedAllowed: false }

const controlButton = () => screen.getByRole('button', { name: /Subspecies and forms/ })
const queryControlButton = () => screen.queryByRole('button', { name: /Subspecies and forms/ })

async function renderReady() {
  const view = render(<SpeciesDetail {...props} />)
  await waitFor(() => expect(screen.getByRole('switch', { name: /Show subspecies/ })).toBeTruthy())
  await waitFor(() => expect(queryControlButton()).toBeTruthy())
  return view
}

function openPanel() {
  fireEvent.click(controlButton())
  return document.querySelector('.sr-ssx-panel') as HTMLElement
}

function panelRows(): HTMLElement[] {
  return [...document.querySelectorAll<HTMLElement>('.sr-ssx-row')]
}

async function selectJuncoFromExplorer() {
  openPanel()
  const row = panelRows().find(r => /Dark-eyed Junco/.test(r.textContent ?? ''))!
  fireEvent.click(row)
  await waitFor(() => expect(screen.getByText('Subspecies and Forms')).toBeTruthy())
}

const breakdownSection = () =>
  screen.getByText('Subspecies and Forms').closest('[tabindex="-1"]') as HTMLElement

describe('the entry control (FR-04, FR-05, FR-08)', () => {
  it('renders below the selector, above the county filter, labeled "subspecies and forms" with the qualifying count', async () => {
    await renderReady()
    const control = controlButton()
    expect(control.textContent).toContain('Subspecies and forms')
    expect(control.textContent).toContain('2 species')
    expect(control.getAttribute('aria-expanded')).toBe('false')

    // Position: after the species selector's toggle, before the County select.
    const comboToggle = screen.getByRole('button', { name: 'Toggle species list' })
    expect(comboToggle.compareDocumentPosition(control) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    const county = screen.getByRole('combobox', { name: 'County' })
    expect(control.compareDocumentPosition(county) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('lists qualifying species in selector order with forms and shares; plain-only species are absent', async () => {
    await renderReady()
    // The taxonomy order arrives async; wait for it to govern.
    openPanel()
    await waitFor(() => {
      const names = [...document.querySelectorAll<HTMLElement>('.sr-ssx-row-name')].map(n => n.textContent)
      expect(names).toEqual(['Yellow-rumped Warbler', 'Dark-eyed Junco'])
    })
    const rows = panelRows()
    expect(rows[0].textContent).toContain('Yellow-rumped Warbler (Myrtle)')
    expect(rows[0].textContent).toContain('25.0%')
    expect(rows[0].textContent).toContain('1 form')
    expect(rows[1].textContent).toContain('Dark-eyed Junco (Oregon)')
    expect(rows[1].textContent).toContain('66.7%')
    // Membership: the plain-only robin and the non-countable name are nowhere.
    expect(rows.some(r => /American Robin/.test(r.textContent ?? ''))).toBe(false)
    expect(rows.some(r => /fake\/mystery/.test(r.textContent ?? ''))).toBe(false)
  })

  it('the list ignores the county filter entirely (FR-08)', async () => {
    await renderReady()
    fireEvent.change(screen.getByRole('combobox', { name: 'County' }), { target: { value: 'Ramsey' } })
    openPanel()
    const junco = panelRows().find(r => /Dark-eyed Junco/.test(r.textContent ?? ''))!
    // Ramsey excludes both Oregon rows, yet the share reflects the whole backup.
    expect(junco.textContent).toContain('66.7%')
  })

  it('Escape closes the panel and returns focus to the control', async () => {
    await renderReady()
    const panel = openPanel()
    expect(panel).toBeTruthy()
    fireEvent.keyDown(panel, { key: 'Escape' })
    expect(document.querySelector('.sr-ssx-panel')).toBeNull()
    expect(document.activeElement).toBe(controlButton())
  })

  it('with no qualifying species the control stays and the panel says so honestly (FR-07)', async () => {
    currentObs = FIXTURE_PLAIN
    await renderReady()
    expect(controlButton().textContent).toContain('0 species')
    openPanel()
    expect(screen.getByText('Your loaded data contains no subspecies or form entries.')).toBeTruthy()
    expect(panelRows()).toHaveLength(0)
  })
})

describe('pick-to-select (FR-06, QA-06)', () => {
  it('selects through the page path, closes the list, and moves focus to the breakdown', async () => {
    await renderReady()
    await selectJuncoFromExplorer()

    // Every section updates: the summary title is the picked species.
    const title = document.querySelector('[style*="1.5rem"]')
    expect(title?.textContent).toBe('Dark-eyed Junco')
    // The list closed.
    expect(document.querySelector('.sr-ssx-panel')).toBeNull()
    // Focus lands on the section container (tabindex -1), after the deferred jump.
    await waitFor(() => expect(document.activeElement).toBe(breakdownSection()))
    // Reopening shows the picked species as current.
    openPanel()
    const junco = panelRows().find(r => /Dark-eyed Junco/.test(r.textContent ?? ''))!
    expect(junco.getAttribute('aria-current')).toBe('true')
  })
})

describe('the breakdown section (FR-09..FR-16, QA-13)', () => {
  it('rows, counts, shares, the pinned plain row, and the FR-13 ledger against the real Sightings figure', async () => {
    await renderReady()
    await selectJuncoFromExplorer()
    const section = within(breakdownSection())

    // Stats row: total 3 (countable rows only), Form noted 66.7%.
    expect(section.getByText('Reports')).toBeTruthy()
    expect(section.getByText('3')).toBeTruthy()
    expect(section.getAllByText('66.7%').length).toBe(2)   // headline + Oregon row

    // Rows: Oregon first, No form noted pinned last with its own count.
    expect(section.getByText('Dark-eyed Junco (Oregon)')).toBeTruthy()
    expect(section.getByText('2 reports')).toBeTruthy()
    expect(section.getByText('No form noted')).toBeTruthy()
    expect(section.getByText('1 report')).toBeTruthy()
    expect(section.getByText('33.3%')).toBeTruthy()
    // The non-countable row is in no row of the section.
    expect(section.queryByText(/fake\/mystery/)).toBeNull()

    // The ledger makes the identity visible: 3 + 1 === the Sightings 4.
    expect(section.getByText(/1 report uses a name that is not a countable subspecies or form/)).toBeTruthy()
    expect(section.getByText(/The Sightings total of 4 includes it; this breakdown does not\./)).toBeTruthy()
    const checklists = screen.getByText('Checklists')
    expect(checklists.parentElement!.textContent).toContain('4')

    // No em dash anywhere in the rendered copy (NFR-05, QA-28).
    expect(document.body.textContent!.includes('—')).toBe(false)
  })

  it('follows the page filter exactly: only plain rows left → single "No form noted" at 100% (FR-14)', async () => {
    await renderReady()
    await selectJuncoFromExplorer()
    fireEvent.change(screen.getByRole('combobox', { name: 'County' }), { target: { value: 'Ramsey' } })

    const section = within(breakdownSection())
    await waitFor(() => expect(section.getByText('100%')).toBeTruthy())
    expect(section.getByText('No form noted')).toBeTruthy()
    expect(section.queryByText('Dark-eyed Junco (Oregon)')).toBeNull()
    // The ledger re-states against the filtered Sightings figure (1 + 1 = 2).
    expect(section.getByText(/The Sightings total of 2 includes it/)).toBeTruthy()
  })

  it('a species with no form detail anywhere shows the one-line empty state, present, not missing (FR-15)', async () => {
    await renderReady()
    // Select the robin through the page's own selector path.
    fireEvent.click(screen.getByRole('button', { name: 'Toggle species list' }))
    const listbox = screen.getByRole('listbox')
    fireEvent.click(within(listbox).getByText('American Robin'))
    await waitFor(() =>
      expect(screen.getByText('No subspecies or form detail is recorded for this species.')).toBeTruthy())
    expect(screen.getByText('Subspecies and Forms')).toBeTruthy()
  })

  it('a new export recomputes everything; a species that lost its forms shows the empty state (FR-22)', async () => {
    const view = await renderReady()
    await selectJuncoFromExplorer()
    expect(within(breakdownSection()).getByText('Dark-eyed Junco (Oregon)')).toBeTruthy()

    currentObs = FIXTURE_B
    view.rerender(<SpeciesDetail {...props} filesVersion={1} />)
    await waitFor(() =>
      expect(screen.getByText('No subspecies or form detail is recorded for this species.')).toBeTruthy())
    expect(controlButton().textContent).toContain('0 species')
  })
})

describe('modes and regression safety (FR-19, FR-20)', () => {
  it('exact-name mode removes both pieces; merged mode restores them (FR-19)', async () => {
    await renderReady()
    fireEvent.click(screen.getByRole('switch', { name: /Show subspecies/ }))
    expect(queryControlButton()).toBeNull()
    expect(screen.queryByText('Subspecies and Forms')).toBeNull()
    fireEvent.click(screen.getByRole('switch', { name: /Show subspecies/ }))
    await waitFor(() => expect(queryControlButton()).toBeTruthy())
  })

  it('"Show all forms" changes nothing in the explorer, either way (FR-20)', async () => {
    await renderReady()
    const panel = openPanel()
    await waitFor(() => expect(panelRows().length).toBe(2))
    const before = panel.innerHTML
    fireEvent.click(screen.getByRole('switch', { name: /Show all forms/ }))
    expect((document.querySelector('.sr-ssx-panel') as HTMLElement).innerHTML).toBe(before)
    fireEvent.click(screen.getByRole('switch', { name: /Show all forms/ }))
    expect((document.querySelector('.sr-ssx-panel') as HTMLElement).innerHTML).toBe(before)
  })
})

describe('memoized derivation, asserted as work done (NFR-02, QA-26)', () => {
  it('tallies once per load, breakdown once per species/filter change, nothing on unrelated re-renders', async () => {
    await renderReady()
    await selectJuncoFromExplorer()

    // Contract A ran exactly once for the whole load — selection included.
    expect(vi.mocked(buildSubspeciesIndex).mock.calls.length).toBe(1)
    const breakdownCallsAfterSelect = vi.mocked(computeSpeciesBreakdown).mock.calls.length

    // Unrelated re-render: typing in the Comments filter re-renders the page
    // without touching the species/filter inputs.
    fireEvent.change(screen.getByLabelText('Filter comments'), { target: { value: 'nest' } })
    fireEvent.change(screen.getByLabelText('Filter comments'), { target: { value: 'nesting' } })
    expect(vi.mocked(buildSubspeciesIndex).mock.calls.length).toBe(1)
    expect(vi.mocked(computeSpeciesBreakdown).mock.calls.length).toBe(breakdownCallsAfterSelect)

    // A filter change derives the breakdown exactly once more — never the tally.
    fireEvent.change(screen.getByRole('combobox', { name: 'County' }), { target: { value: 'Ramsey' } })
    await waitFor(() =>
      expect(vi.mocked(computeSpeciesBreakdown).mock.calls.length).toBe(breakdownCallsAfterSelect + 1))
    expect(vi.mocked(buildSubspeciesIndex).mock.calls.length).toBe(1)
  })
})
