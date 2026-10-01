// @vitest-environment jsdom
//
// THE WIRING GUARD FOR SPLITS AND LUMPS ON SPECIES DETAIL (taxonomic-splits-lumps).
// The pure derivation is proven in lib/taxonomyHistory.test.ts and the copy in
// lib/taxonomyHistoryCopy.test.ts; what this file owes is the WIRING: placement
// and gating (QA-10, QA-24), the list (QA-11, QA-13), pick-to-select with the
// escapee reveal (QA-12), the section's states (QA-14, QA-18 to QA-21), the text
// equivalent's parity with the chart (QA-22), names through BirdName (QA-23),
// filter inertness (QA-09), same content by any route (QA-25), reload (QA-27),
// an asset that fails to load (QA-28), memoization as WORK DONE (QA-31), and
// ids that never carry a bird name (QA-32).
//
// The history asset is mocked at its one loader with a small fixture in the
// asset's own shape, so this file states the wiring independently of the
// years the committed asset covers.

import { describe, it, expect, vi, beforeAll, beforeEach, afterEach, afterAll } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor, within } from '@testing-library/react'
import type { ObservationEntry } from '../types'
import type { TaxonomyHistory } from '../lib/taxonomyHistory'
import type { ProvenanceSnapshot } from '../lib/exoticProvenance'

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

// QA-31's instrumentation: the REAL derivation wrapped with a call counter.
vi.mock('../lib/taxonomyHistory', async (importOriginal) => {
  const mod = await importOriginal<typeof import('../lib/taxonomyHistory')>()
  return { ...mod, buildTaxonomyHistoryIndex: vi.fn(mod.buildTaxonomyHistoryIndex) }
})

const U2024 = { year: 2024, published: '2024-10-22' }
const U2025 = { year: 2025, published: '2025-10-31' }
const HISTORY: TaxonomyHistory = {
  v: 1, snapshot: 'T', generated: '2026-09-30', inputs: [],
  updates: [U2024, U2025],
  coverage: { earliest: U2024, latest: U2025 },
  events: [
    {
      kind: 'lump', ...U2024,
      before: [
        { code: 'comred', sci: 'Acanthis flammea', com: 'Common Redpoll', retired: true },
        { code: 'hoared', sci: 'Acanthis hornemanni', com: 'Hoary Redpoll', retired: true },
      ],
      after: [{ code: 'redpol1', sci: 'Acanthis flammea', com: 'Redpoll' }],
      slashes: [],
    },
    {
      kind: 'split', ...U2025,
      before: [{ code: 'warvir', sci: 'Vireo gilvus', com: 'Warbling Vireo', retired: true }],
      after: [
        { code: 'eawvir1', sci: 'Vireo gilvus', com: 'Eastern Warbling Vireo' },
        { code: 'wewvir2', sci: 'Vireo swainsoni', com: 'Western Warbling Vireo' },
      ],
      slashes: [{ code: 'warvir', sci: 'Vireo gilvus/swainsoni', com: 'Eastern/Western Warbling Vireo' }],
    },
  ],
}

function entry(o: Partial<ObservationEntry> & { commonName: string; date: string }): ObservationEntry {
  return {
    submissionId: 'S1', scientificName: 'Genus species',
    location: 'Park', locationId: 'L1', latitude: null, longitude: null, county: 'Hennepin',
    count: 1, breedingCode: null, speciesComments: '', catalogIds: [],
    stateProvince: 'US-MN', duration: 30, distance: 1, protocol: 'Traveling', numObservers: 1,
    ...o,
  }
}

const CURRENT: ObservationEntry[] = [
  entry({ submissionId: 'S1', commonName: 'Eastern Warbling Vireo', scientificName: 'Vireo gilvus', date: '2025-10-30' }),
  entry({ submissionId: 'S2', commonName: 'Eastern Warbling Vireo', scientificName: 'Vireo gilvus', date: '2025-10-31' }),
  entry({ submissionId: 'S3', commonName: 'Eastern Warbling Vireo', scientificName: 'Vireo gilvus', date: '2026-05-01', county: 'Ramsey' }),
  entry({ submissionId: 'S4', commonName: 'Eastern/Western Warbling Vireo', scientificName: 'Vireo gilvus/swainsoni', date: '2026-06-01' }),
  entry({ submissionId: 'S5', commonName: 'Redpoll (Common)', scientificName: 'Acanthis flammea flammea', date: '2025-01-01' }),
  entry({ submissionId: 'S6', commonName: 'American Robin', scientificName: 'Turdus migratorius', date: '2025-01-01' }),
  entry({ submissionId: 'S7', commonName: 'Western Warbling Vireo', scientificName: 'Vireo swainsoni', date: '2026-07-01' }),
]
/** An export made before October 2025: the retired name, no daughters. */
const STALE: ObservationEntry[] = [
  entry({ submissionId: 'S1', commonName: 'Warbling Vireo', scientificName: 'Vireo gilvus', date: '2024-06-01' }),
  entry({ submissionId: 'S2', commonName: 'Warbling Vireo', scientificName: 'Vireo gilvus', date: '2025-06-01' }),
  entry({ submissionId: 'S3', commonName: 'American Robin', scientificName: 'Turdus migratorius', date: '2025-01-01' }),
]
const UNAFFECTED: ObservationEntry[] = [
  entry({ submissionId: 'S1', commonName: 'American Robin', scientificName: 'Turdus migratorius', date: '2025-01-01' }),
]

let currentObs: ObservationEntry[] = CURRENT
let historyResult: TaxonomyHistory | null = HISTORY
const published: { current: ProvenanceSnapshot } = {
  current: { checklists: new Set(), species: new Map(), excludedNames: [] },
}

vi.mock('../lib/taxonomyHistoryAsset', () => ({
  loadTaxonomyHistory: vi.fn(async () => historyResult),
}))
vi.mock('../lib/exoticProvenanceCache', () => ({
  getSnapshot: () => published.current,
  loadSnapshot: async () => published.current,
  subscribe: () => () => {},
}))
vi.mock('../lib/storage', () => ({
  storage: {
    getFilesStatus: vi.fn(async () => ({ ebird: { filename: 'ebird.csv', uploadedAt: '2026-08-01' }, ml: null })),
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
            codes: {
              'Eastern Warbling Vireo': 'eawvir1', 'Western Warbling Vireo': 'wewvir2', Redpoll: 'redpol1',
              'American Robin': 'amerob', 'Warbling Vireo': 'eawvir1',
            },
            // Taxonomic order inverts alphabetical order, so the list's
            // selector-order claim (FR-11) is discriminating.
            orders: { 'western warbling vireo': 1, 'eastern warbling vireo': 2, redpoll: 3, 'american robin': 4, 'warbling vireo': 2 },
            formCodes: {},
          }
        : {}),
  },
  TransportError: class extends Error {},
}))

import { SpeciesDetail } from './SpeciesDetail'
import { buildTaxonomyHistoryIndex } from '../lib/taxonomyHistory'
import { SHOW_ESCAPEES_TOGGLE_LABEL } from '../lib/exoticCopy'

beforeAll(() => { Element.prototype.scrollIntoView = vi.fn() })
beforeEach(() => {
  currentObs = CURRENT
  historyResult = HISTORY
  published.current = { checklists: new Set(), species: new Map(), excludedNames: [] }
  vi.clearAllMocks()
})
afterEach(cleanup)
afterAll(() => new Promise((r) => setTimeout(r, 120)))

const props = { onGoToSettings: () => {}, onGoToWeather: () => {}, filesVersion: 0, embedAllowed: false }

const slButton = () => screen.getByRole('button', { name: /^Splits and lumps/ })
const querySlButton = () => screen.queryByRole('button', { name: /^Splits and lumps/ })
const section = () => screen.getByText('Splits and Lumps').closest('[tabindex="-1"]') as HTMLElement
const querySection = () => screen.queryByText('Splits and Lumps')

async function renderReady() {
  const view = render(<SpeciesDetail {...props} />)
  await waitFor(() => expect(querySlButton()).toBeTruthy())
  // The asset and the codes batch land in either order; wait until the index
  // has been built WITH the codes, which is what every assertion here reads.
  await waitFor(() => {
    const calls = vi.mocked(buildTaxonomyHistoryIndex).mock.calls
    expect(Object.keys(calls.at(-1)?.[2].codes ?? {}).length).toBeGreaterThan(0)
  })
  return view
}

function openList() {
  fireEvent.click(slButton())
  return document.querySelector('.sr-ssx-panel') as HTMLElement
}
const listRows = () => [...document.querySelectorAll<HTMLElement>('.sr-sl-row')]

async function selectViaCombobox(name: string) {
  fireEvent.click(screen.getByRole('button', { name: 'Toggle species list' }))
  const option = await screen.findByRole('option', { name: new RegExp(`^${name}`) })
  fireEvent.mouseDown(option)
  fireEvent.click(option)
  await waitFor(() => expect(querySection()).toBeTruthy())
}

async function pickFromList(name: string) {
  openList()
  const row = listRows().find(r => (r.querySelector('.sr-sl-row-name')?.textContent ?? '') === name)!
  fireEvent.click(row)
  await waitFor(() => expect(querySection()).toBeTruthy())
}

describe('the control and its list (FR-10 to FR-13; QA-10, QA-11, QA-13)', () => {
  it('sits beside "Subspecies and forms" in one row, above the county filter, counting its list', async () => {
    await renderReady()
    const control = slButton()
    const ssx = screen.getByRole('button', { name: /Subspecies and forms/ })
    const row = control.closest('.sr-taxtools-row')!
    expect(row).toBeTruthy()
    expect(row.contains(ssx)).toBe(true)
    expect(ssx.compareDocumentPosition(control) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    const county = screen.getByRole('combobox', { name: 'County' })
    expect(control.compareDocumentPosition(county) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(control.getAttribute('aria-expanded')).toBe('false')
    expect(control.textContent).toContain('3 species')
    openList()
    expect(listRows()).toHaveLength(3)
    expect(control.getAttribute('aria-expanded')).toBe('true')
    expect(document.getElementById(control.getAttribute('aria-controls')!)).toBeTruthy()
  })

  it('lists affected species in selector order, each with its kind and year (QA-11)', async () => {
    await renderReady()
    openList()
    await waitFor(() => expect(listRows().map(r => r.querySelector('.sr-sl-row-name')?.textContent))
      .toEqual(['Western Warbling Vireo', 'Eastern Warbling Vireo', 'Redpoll']))
    expect(listRows().map(r => r.querySelector('.sr-sl-row-events')?.textContent))
      .toEqual(['Split·2025', 'Split·2025', 'Lump·2024'])
  })

  it('opens below BOTH controls: DOM order is toggles, then panels', async () => {
    await renderReady()
    const panel = openList()
    const ssx = screen.getByRole('button', { name: /Subspecies and forms/ })
    expect(slButton().compareDocumentPosition(panel) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(ssx.compareDocumentPosition(panel) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(slButton().closest('.sr-taxtools-row')!.contains(panel)).toBe(false)
  })

  it('Escape closes the list and returns focus to the control', async () => {
    await renderReady()
    const panel = openList()
    fireEvent.keyDown(panel, { key: 'Escape' })
    expect(document.querySelector('.sr-ssx-panel')).toBeNull()
    expect(document.activeElement).toBe(slButton())
  })

  it('with no affected species the control stays at zero and says so, with the coverage (QA-13)', async () => {
    currentObs = UNAFFECTED
    render(<SpeciesDetail {...props} />)
    await waitFor(() => expect(querySlButton()).toBeTruthy())
    expect(slButton().textContent).toContain('0 species')
    const panel = openList()
    expect(panel.textContent).toBe("None of the species in your loaded data was split or lumped in eBird's 2024 to 2025 taxonomy updates. A change made before 2024 is not recorded here.")
    expect(listRows()).toHaveLength(0)
  })
})

describe('pick-to-select (FR-12, FR-25; QA-12, QA-25)', () => {
  it('selects through the page path, closes the list, and moves focus to the section', async () => {
    await renderReady()
    await pickFromList('Redpoll')
    expect(document.querySelector('[style*="1.5rem"]')?.textContent).toBe('Redpoll')
    expect(document.querySelector('.sr-ssx-panel')).toBeNull()
    await waitFor(() => expect(document.activeElement).toBe(section()))
    openList()
    const redpoll = listRows().find(r => /Redpoll/.test(r.textContent ?? ''))!
    expect(redpoll.getAttribute('aria-current')).toBe('true')
  })

  it('a species "Show escapees" is hiding is revealed and selected, never dropped', async () => {
    published.current = { checklists: new Set(['S7']), species: new Map(), excludedNames: ['Western Warbling Vireo'] }
    await renderReady()
    const escapees = screen.getByRole('switch', { name: SHOW_ESCAPEES_TOGGLE_LABEL })
    expect(escapees.getAttribute('aria-checked')).toBe('false')
    await pickFromList('Western Warbling Vireo')
    expect(document.querySelector('[style*="1.5rem"]')?.textContent).toBe('Western Warbling Vireo')
    expect(screen.getByRole('switch', { name: SHOW_ESCAPEES_TOGGLE_LABEL }).getAttribute('aria-checked')).toBe('true')
  })

  it('the section content is the same whether chosen in the selector or the list (QA-25)', async () => {
    await renderReady()
    await selectViaCombobox('Eastern Warbling Vireo')
    const viaSelector = section().querySelector('.sr-lin-body')!.innerHTML
    cleanup()
    await renderReady()
    await pickFromList('Eastern Warbling Vireo')
    expect(section().querySelector('.sr-lin-body')!.innerHTML).toBe(viaSelector)
  })
})

describe('the lineage section (FR-14 to FR-22; QA-14, QA-17 to QA-22)', () => {
  it('a split: kind, update, before, every after name, the shown slash, and the text marker on the user\'s species', async () => {
    await renderReady()
    await pickFromList('Eastern Warbling Vireo')
    const s = section()
    const chart = s.querySelector('.sr-lin-chart') as HTMLElement
    expect(within(chart).getByText('Split')).toBeTruthy()
    expect(within(chart).getByText('October 2025')).toBeTruthy()
    const nodes = [...chart.querySelectorAll('.sr-lin-node')]
    expect(nodes.map(n => n.querySelector('.sr-lin-name')?.textContent)).toEqual([
      'Warbling Vireo', 'Eastern Warbling Vireo', 'Western Warbling Vireo', 'Eastern/Western Warbling Vireo',
    ])
    const eastern = nodes[1]
    expect(eastern.classList.contains('is-you')).toBe(true)
    expect(eastern.textContent).toContain('Your species')
    // 3 rows: two on or before 31 October 2025, one after it.
    expect(eastern.querySelector('.sr-lin-count')?.textContent).toBe('3 reports')
    expect(eastern.querySelector('.sr-lin-part')?.textContent).toBe('2 reassigned by eBird1 recorded since')
    // The retired parent: no reports under its name (FR-18).
    expect(nodes[0].classList.contains('is-absent')).toBe(true)
    expect(nodes[0].textContent).toContain('No reports under this name')
    expect(nodes[0].querySelector('.sr-lin-count')).toBeNull()
    // The slash shows because the export holds a row under it.
    expect(nodes[3].textContent).toContain('Reports eBird could not assign')
    // The sentence, once per event, names eBird and the published day (FR-17).
    const sentence = s.querySelector('.sr-lin-sentence')!
    expect(sentence.textContent).toBe('eBird reassigned every report dated on or before 31 October 2025 to one of the new names when it made this split. Reports dated after it were recorded under the current names. Reports it could not place went to Eastern/Western Warbling Vireo.')
    expect(s.querySelectorAll('.sr-lin-sentence')).toHaveLength(1)
    // The slash name quoted in the sentence can wrap after its "/" (QA fix 2),
    // as the slash node's name can.
    expect(sentence.querySelectorAll('wbr')).toHaveLength(1)
    expect(nodes[3].querySelectorAll('wbr')).toHaveLength(1)
    // The coverage statement (FR-20).
    expect(s.querySelector('.sr-lin-coverage')?.textContent).toBe("Covers eBird's 2024 to 2025 taxonomy updates. A change made before 2024 is not recorded here.")
  })

  it('a lump: the sides reversed, the user\'s species on the after side', async () => {
    await renderReady()
    await pickFromList('Redpoll')
    const chart = section().querySelector('.sr-lin-chart') as HTMLElement
    expect(within(chart).getByText('Lump')).toBeTruthy()
    expect(within(chart).getByText('October 2024')).toBeTruthy()
    const nodes = [...chart.querySelectorAll('.sr-lin-node')]
    expect(nodes.map(n => n.querySelector('.sr-lin-name')?.textContent)).toEqual(['Common Redpoll', 'Hoary Redpoll', 'Redpoll'])
    expect(nodes[2].classList.contains('is-you')).toBe(true)
    expect(nodes[0].textContent).toContain('No reports under this name')
  })

  it('an export made before the update is labelled so, on the before side, with no after partition (FR-19)', async () => {
    currentObs = STALE
    await renderReady()
    await pickFromList('Warbling Vireo')
    const s = section()
    expect(s.querySelector('.sr-lin-note')?.textContent).toBe('Your backup predates the October 2025 update, so your reports still carry the earlier name. A fresh backup from eBird shows where they went.')
    const before = s.querySelector('.sr-lin-side--before .sr-lin-node')!
    expect(before.classList.contains('is-you')).toBe(true)
    expect(before.querySelector('.sr-lin-count')?.textContent).toBe('2 reports')
    expect(before.querySelector('.sr-lin-part')?.textContent).toBe('all dated before the update')
    expect(before.querySelector('.sr-lin-bar')).toBeNull()
    expect(s.querySelector('.sr-lin-sentence')?.textContent).toContain('Your backup was exported before that')
  })

  it('an unaffected species shows the one-line empty state and the coverage, present, not missing (FR-21)', async () => {
    await renderReady()
    await selectViaCombobox('American Robin')
    const s = section()
    expect(s.querySelector('.sr-lin-empty')?.textContent).toBe('No split or lump is recorded for this species in the covered updates.')
    expect(s.querySelector('.sr-lin-coverage')).toBeTruthy()
    expect(s.querySelector('.sr-lin-chart')).toBeNull()
  })

  it('the text equivalent carries every fact the chart shows, in reading order (FR-22; QA-22)', async () => {
    await renderReady()
    await pickFromList('Eastern Warbling Vireo')
    const alt = section().querySelector('.sr-lin-event .sr-only') as HTMLElement
    const paragraphs = [...alt.querySelectorAll('p')].map(p => p.textContent)
    expect(paragraphs).toEqual([
      'Split, October 2025.',
      'Before: Warbling Vireo (Vireo gilvus): no reports under this name.',
      'After: Eastern Warbling Vireo (Vireo gilvus), your species: 3 reports, 2 reassigned by eBird, 1 recorded since. Western Warbling Vireo (Vireo swainsoni): 1 report, 0 reassigned by eBird, 1 recorded since. Eastern/Western Warbling Vireo (Vireo gilvus/swainsoni), the slash entry for reports eBird could not assign: 1 report, 0 reassigned by eBird, 1 recorded since.',
      section().querySelector('.sr-lin-sentence')!.textContent,
    ])
    // Parity: every name, count and marker visible in the chart is in the text.
    const text = alt.textContent ?? ''
    for (const n of section().querySelectorAll('.sr-lin-node')) {
      expect(text).toContain(n.querySelector('.sr-lin-name')!.textContent!)
      expect(text).toContain(n.querySelector('.sr-lin-sci')!.textContent!)
      const count = n.querySelector('.sr-lin-count')?.textContent
      if (count) expect(text).toContain(count)
    }
    // The chart's repeated facts are hidden from assistive technology; only the
    // names that act stay exposed.
    for (const el of section().querySelectorAll('.sr-lin-sci, .sr-lin-count, .sr-lin-part, .sr-lin-mark, .sr-lin-rail, .sr-lin-sentence')) {
      expect(el.closest('[aria-hidden="true"]'), el.className).toBeTruthy()
    }
    // No meaning by color alone: the marker and the kind are words.
    expect(section().querySelector('.is-you')!.textContent).toContain('Your species')
  })

  it('every name renders through BirdName; a recorded, non-selected entry links, a zero-count or slash entry does not (FR-23)', async () => {
    await renderReady()
    await pickFromList('Eastern Warbling Vireo')
    const nodes = [...section().querySelectorAll('.sr-lin-node')]
    for (const n of nodes) expect(n.querySelector('.sr-lin-name .sr-birdname')).toBeTruthy()
    const [parent, eastern, western, slash] = nodes
    expect(parent.querySelector('button')).toBeNull()
    expect(eastern.querySelector('button')).toBeNull()
    expect(slash.querySelector('button')).toBeNull()
    const link = western.querySelector('button.sr-birdname-link') as HTMLElement
    expect(link.textContent).toBe('Western Warbling Vireo')
    // A current after-side code carries the site marks (the positive leg of the
    // security review L1 row below).
    expect(western.querySelector('a[href*="birdsoftheworld.org/bow/species/wewvir2/"]')).toBeTruthy()
    expect(link.closest('[aria-hidden="true"]')).toBeNull()
    fireEvent.click(link)
    await waitFor(() => expect(document.querySelector('[style*="1.5rem"]')?.textContent).toBe('Western Warbling Vireo'))
    for (const el of document.querySelectorAll('.sr-sl-row-name')) expect(el.querySelector('.sr-birdname')).toBeTruthy()
  })
})

describe('site marks only on a current code (security review L1; FR-23)', () => {
  // The Macquarie Parakeet shape, as the committed asset carries it: the 2023
  // split created recpar23 and kept refpar4; the 2024 lump retired recpar23 and
  // kept refpar4 again. A backup exported between the two updates holds both.
  const U2023 = { year: 2023, published: '2023-10-24' }
  const RCP = { code: 'refpar4', sci: 'Cyanoramphus novaezelandiae', com: 'Red-crowned Parakeet' }
  const MQP = { code: 'recpar23', sci: 'Cyanoramphus erythrotis', com: 'Macquarie Parakeet' }
  const PARAKEETS: TaxonomyHistory = {
    v: 1, snapshot: 'T', generated: '2026-09-30', inputs: [],
    updates: [U2023, U2024],
    coverage: { earliest: U2023, latest: U2024 },
    events: [
      { kind: 'split', ...U2023, before: [{ ...RCP, retired: false }], after: [RCP, MQP], slashes: [] },
      { kind: 'lump', ...U2024, before: [{ ...RCP, retired: false }, { ...MQP, retired: true }], after: [RCP], slashes: [] },
    ],
  }
  const BETWEEN: ObservationEntry[] = [
    entry({ submissionId: 'S1', commonName: 'Red-crowned Parakeet', scientificName: 'Cyanoramphus novaezelandiae', date: '2023-12-01' }),
    entry({ submissionId: 'S2', commonName: 'Macquarie Parakeet', scientificName: 'Cyanoramphus erythrotis', date: '2024-01-01' }),
  ]
  const nodeNamed = (name: string) => [...section().querySelectorAll<HTMLElement>('.sr-lin-node')]
    .filter(n => n.querySelector('.sr-lin-name')?.textContent === name)

  it('a retired after code (recpar23) renders no site link; a kept one (refpar4) still does', async () => {
    historyResult = PARAKEETS
    currentObs = BETWEEN
    await renderReady()
    await pickFromList('Red-crowned Parakeet')
    // The defect path is reached: Macquarie Parakeet is a recorded species that
    // is not the selected one, so its 2023 after node links through the page.
    const [mq2023] = nodeNamed('Macquarie Parakeet')
    expect(mq2023.closest('.sr-lin-side--after')).toBeTruthy()
    expect(mq2023.querySelector('button.sr-birdname-link')?.textContent).toBe('Macquarie Parakeet')
    // ...and it carries no site mark, because the 2024 lump retired its code.
    expect(document.querySelector('a[href*="recpar23"]')).toBeNull()

    // The kept code still links: with Macquarie Parakeet selected, both
    // Red-crowned Parakeet after nodes are linkable and current, although
    // refpar4 sits on the 2024 lump's before side as well.
    await pickFromList('Macquarie Parakeet')
    const rcpAfter = nodeNamed('Red-crowned Parakeet').filter(n => n.closest('.sr-lin-side--after'))
    expect(rcpAfter).toHaveLength(2)
    for (const n of rcpAfter) {
      expect(n.querySelector('a[href*="birdsoftheworld.org/bow/species/refpar4/"]')).toBeTruthy()
    }
    expect(document.querySelector('a[href*="recpar23"]')).toBeNull()
  })
})

describe('modes, filters and toggles (FR-09, FR-24; QA-09, QA-24)', () => {
  it('"Show subspecies" removes both pieces; turning it off restores both', async () => {
    await renderReady()
    await selectViaCombobox('Eastern Warbling Vireo')
    fireEvent.click(screen.getByRole('switch', { name: /Show subspecies/ }))
    expect(querySlButton()).toBeNull()
    expect(querySection()).toBeNull()
    fireEvent.click(screen.getByRole('switch', { name: /Show subspecies/ }))
    await waitFor(() => expect(querySlButton()).toBeTruthy())
    await selectViaCombobox('Eastern Warbling Vireo')
    expect(querySection()).toBeTruthy()
  })

  it('a county filter adds the one-line note and changes no count; "Show all forms" and "Show escapees" change nothing', async () => {
    await renderReady()
    await pickFromList('Eastern Warbling Vireo')
    const before = section().querySelector('.sr-lin-event')!.innerHTML
    expect(section().querySelector('.sr-lin-filter-line')).toBeNull()

    fireEvent.change(screen.getByRole('combobox', { name: 'County' }), { target: { value: 'Ramsey' } })
    await waitFor(() => expect(section().querySelector('.sr-lin-filter-line')?.textContent)
      .toBe('The figures cover every checklist in your export, not the current county or date filter.'))
    expect(section().querySelector('.sr-lin-event')!.innerHTML).toBe(before)

    fireEvent.change(screen.getByRole('combobox', { name: 'County' }), { target: { value: '' } })
    await waitFor(() => expect(section().querySelector('.sr-lin-filter-line')).toBeNull())
    for (const name of [/Show all forms/, new RegExp(SHOW_ESCAPEES_TOGGLE_LABEL)]) {
      fireEvent.click(screen.getByRole('switch', { name }))
      expect(section().querySelector('.sr-lin-event')!.innerHTML).toBe(before)
      fireEvent.click(screen.getByRole('switch', { name }))
      expect(section().querySelector('.sr-lin-event')!.innerHTML).toBe(before)
    }
    openList()
    expect(listRows()).toHaveLength(3)
  })
})

describe('lifecycle and failure (FR-27, FR-28; QA-27, QA-28)', () => {
  it('a new export recomputes the list and the section from the new data alone', async () => {
    const view = await renderReady()
    expect(slButton().textContent).toContain('3 species')
    currentObs = STALE
    view.rerender(<SpeciesDetail {...props} filesVersion={1} />)
    await waitFor(() => expect(slButton().textContent).toContain('1 species'))
    openList()
    expect(listRows().map(r => r.querySelector('.sr-sl-row-name')?.textContent)).toEqual(['Warbling Vireo'])
  })

  it('an asset that fails to load renders neither piece and raises no alert, and the page is otherwise whole', async () => {
    historyResult = null
    render(<SpeciesDetail {...props} />)
    await waitFor(() => expect(screen.getByRole('button', { name: /Subspecies and forms/ })).toBeTruthy())
    await waitFor(() => expect(screen.getByRole('button', { name: 'Toggle species list' })).toBeTruthy())
    expect(querySlButton()).toBeNull()
    await selectViaCombobox('Redpoll').catch(() => {})
    expect(querySection()).toBeNull()
    for (const alert of document.querySelectorAll('[role="alert"]')) expect((alert.textContent ?? '').trim()).toBe('')
    expect(screen.getByText('Subspecies and Forms')).toBeTruthy()
  })
})

describe('memoization as work done, and ids (NFR-03, NFR-04; QA-31, QA-32)', () => {
  it('derives once per (observations, asset, codes), never on an unrelated re-render, a species change or a filter', async () => {
    await renderReady()
    const calls = vi.mocked(buildTaxonomyHistoryIndex).mock.calls.length
    // Once per distinct (observations, asset, codes) triple: once if the codes
    // batch landed before the asset, twice if it landed after (schema.md 6.7).
    expect(calls).toBeGreaterThanOrEqual(1)
    expect(calls).toBeLessThanOrEqual(2)
    await pickFromList('Eastern Warbling Vireo')
    fireEvent.change(screen.getByLabelText('Filter comments'), { target: { value: 'nest' } })
    fireEvent.change(screen.getByRole('combobox', { name: 'County' }), { target: { value: 'Ramsey' } })
    await selectViaCombobox('Redpoll')
    expect(vi.mocked(buildTaxonomyHistoryIndex).mock.calls.length).toBe(calls)
  })

  it('no id or IDREF the feature mints carries a bird name', async () => {
    await renderReady()
    await pickFromList('Eastern Warbling Vireo')
    openList()
    const names = ['Warbling', 'Redpoll', 'Vireo', 'Robin']
    const scope = [section(), slButton().closest('.sr-taxtools')!]
    for (const root of scope) {
      for (const el of root.querySelectorAll('[id], [aria-controls], [aria-labelledby], [aria-describedby]')) {
        for (const attr of ['id', 'aria-controls', 'aria-labelledby', 'aria-describedby']) {
          const v = el.getAttribute(attr)
          if (v) for (const n of names) expect(v).not.toContain(n)
        }
      }
    }
  })
})
