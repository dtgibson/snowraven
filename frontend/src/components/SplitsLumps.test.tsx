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
//
// recorded-names-in-splits-and-lumps extends it: the section is named
// "Splits/Lumps/Renames", earlier names carry a figure or a state, renames join
// the list and the chart, and the text equivalent carries the same words as the
// chart (QA-24 to QA-33). The fixture gains a traced lump and a rename on the
// same two updates; the shipped backups touch neither, so the shipped rows'
// counts are unchanged.

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
  v: 2, snapshot: 'T', generated: '2026-09-30', inputs: [],
  updates: [U2024, U2025],
  coverage: { earliest: U2024, latest: U2025 },
  events: [
    {
      kind: 'lump', ...U2024,
      before: [
        { code: 'pasfly', sci: 'Empidonax difficilis', com: 'Pacific-slope Flycatcher', retired: true, form: 'Western Flycatcher (Pacific-slope)' },
        { code: 'corfly', sci: 'Empidonax occidentalis', com: 'Cordilleran Flycatcher', retired: true, form: 'Western Flycatcher (Cordilleran)' },
      ],
      after: [{ code: 'wesfly', sci: 'Empidonax difficilis', com: 'Western Flycatcher' }],
      slashes: [],
    },
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
  // The record's spelling of the new name differs from today's (design-spec
  // section 11): the section shows the species as the page carries it.
  renames: [{
    kind: 'rename', ...U2025,
    before: [{ code: 'runher1', sci: 'Nycticorax caledonicus', com: 'Rufous Night-Heron', retired: true }],
    after: [{ code: 'runher1', sci: 'Nycticorax caledonicus', com: 'Nankeen Night-Heron' }],
    slashes: [],
  }],
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
  current: { checklists: new Set(), species: new Map(), excludedNames: [], exoticNames: null },
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
              'Western Flycatcher': 'wesfly', 'Nankeen Night Heron': 'runher1', 'Great Horned Owl': 'grhowl',
            },
            // Taxonomic order inverts alphabetical order, so the list's
            // selector-order claim (FR-11) is discriminating.
            orders: {
              'western warbling vireo': 1, 'eastern warbling vireo': 2, redpoll: 3, 'american robin': 4, 'warbling vireo': 2,
              'western flycatcher': 5, 'nankeen night heron': 6, 'great horned owl': 7,
            },
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
  published.current = { checklists: new Set(), species: new Map(), excludedNames: [], exoticNames: null }
  vi.clearAllMocks()
})
afterEach(cleanup)
afterAll(() => new Promise((r) => setTimeout(r, 120)))

const props = { onGoToSettings: () => {}, onGoToWeather: () => {}, filesVersion: 0, embedAllowed: false }

const slButton = () => screen.getByRole('button', { name: /^Splits\/Lumps\/Renames/ })
const querySlButton = () => screen.queryByRole('button', { name: /^Splits\/Lumps\/Renames/ })
// The title breaks after each "/" (<wbr>), so it is found by its own hook and
// its text is asserted whole below.
const section = () => document.querySelector('.sr-lin-title')!.closest('[tabindex="-1"]') as HTMLElement
const querySection = () => document.querySelector('.sr-lin-title')

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
    expect(panel.textContent).toBe("No split, lump, or rename is recorded for any species in your loaded data in eBird's 2024 to 2025 taxonomy updates. A change made before 2024 is not recorded here.")
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
    published.current = { checklists: new Set(['S7']), species: new Map(), excludedNames: ['Western Warbling Vireo'], exoticNames: null }
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
    // The earlier name now carries eBird's name for the reports dated on or
    // before the update: the reassigned figures of the names it became, the
    // slash included, added together (FR-13, FR-22).
    expect(nodes[0].classList.contains('is-absent')).toBe(false)
    expect(nodes[0].querySelector('.sr-lin-count')?.textContent).toBe('2 reports')
    expect(nodes[0].querySelector('.sr-lin-part')?.textContent).toBe("eBird's name for them until the update")
    // Full: a split's figure IS the reassigned total (design-spec section 8).
    expect(parseFloat((nodes[0].querySelector('.sr-lin-bar--earlier i') as HTMLElement).style.width)).toBe(100)
    // The slash shows because the export holds a row under it.
    expect(nodes[3].textContent).toContain('Reports eBird could not assign')
    // The sentence, once per event, names eBird and the published day (FR-24),
    // and the paragraph says how the count is worked out (FR-25).
    const [sentence, paragraph] = [...s.querySelectorAll('.sr-lin-sentence')]
    expect(sentence.textContent).toBe('eBird reassigned every report dated on or before 31 October 2025 to one of the new names when it made this split. Reports dated after it were recorded under the current names. Reports it could not place went to Eastern/Western Warbling Vireo.')
    expect(paragraph.textContent).toBe("How the count is worked out. From each report's date, not from what you typed. Your backup keeps only each report's current name, so every report dated on or before the update is counted under Warbling Vireo, including one entered later for an earlier date.")
    expect(s.querySelectorAll('.sr-lin-sentence')).toHaveLength(2)
    // The slash name quoted in the sentence can wrap after its "/" (QA fix 2),
    // as the slash node's name can.
    expect(sentence.querySelectorAll('wbr')).toHaveLength(1)
    expect(nodes[3].querySelectorAll('wbr')).toHaveLength(1)
    // The coverage statement (FR-20).
    expect(s.querySelector('.sr-lin-coverage')?.textContent).toBe("Covers eBird's 2024 to 2025 taxonomy updates. A change made before 2024 is not recorded here.")
    // The title is the user's exact string, with a break after each "/" (FR-28).
    expect(s.querySelector('.sr-lin-title')?.textContent).toBe('Splits/Lumps/Renames')
    expect(s.querySelector('.sr-lin-title')?.querySelectorAll('wbr')).toHaveLength(2)
    expect(slButton().querySelector('.sr-ssx-label')?.textContent).toBe('Splits/Lumps/Renames')
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
    // eBird kept no form for either earlier name here (FR-18): no number.
    for (const n of nodes.slice(0, 2)) {
      expect(n.textContent).toContain('Not traceable in your backup')
      expect(n.textContent).toContain('eBird kept no form for this name, so its reports now read as plain Redpoll.')
      expect(n.querySelector('.sr-lin-count')).toBeNull()
      expect(n.querySelector('.sr-lin-cannot-glyph')).toBeTruthy()
    }
    expect(section().querySelector('.sr-lin-sentence')?.textContent).toBe('eBird reassigned every report dated on or before 22 October 2024 to Redpoll when it made this lump. Your backup cannot show which earlier name a report had.')
    expect(section().querySelectorAll('.sr-lin-sentence')).toHaveLength(1)
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
    expect(s.querySelector('.sr-lin-empty')?.textContent).toBe('No split, lump, or rename is recorded for this species in the covered updates.')
    expect(s.querySelector('.sr-lin-coverage')).toBeTruthy()
    expect(s.querySelector('.sr-lin-chart')).toBeNull()
  })

  it('the text equivalent carries every fact the chart shows, in reading order (FR-22; QA-22)', async () => {
    await renderReady()
    await pickFromList('Eastern Warbling Vireo')
    const alt = section().querySelector('.sr-lin-event .sr-only') as HTMLElement
    const paragraphs = [...alt.querySelectorAll('p')].map(p => p.textContent)
    const [sentence, paragraph] = [...section().querySelectorAll('.sr-lin-sentence')].map(p => p.textContent)
    expect(paragraphs).toEqual([
      'Split, October 2025.',
      "Before: Warbling Vireo (Vireo gilvus): 2 reports, eBird's name for them until the update.",
      'After: Eastern Warbling Vireo (Vireo gilvus), your species: 3 reports, 2 reassigned by eBird, 1 recorded since. Western Warbling Vireo (Vireo swainsoni): 1 report, 0 reassigned by eBird, 1 recorded since. Eastern/Western Warbling Vireo (Vireo gilvus/swainsoni), the slash entry for reports eBird could not assign: 1 report, 0 reassigned by eBird, 1 recorded since.',
      sentence,
      paragraph,
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
    v: 2, snapshot: 'T', generated: '2026-09-30', inputs: [], renames: [],
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

// ── Recorded names on the section (recorded-names-in-splits-and-lumps;
// QA-17 to QA-33) ───────────────────────────────────────────────────────────

/** Every figure, name, marker, line and sentence the chart draws for one event,
 *  and the event's text equivalent. */
function chartAndAlt(ev: Element) {
  const alt = ev.querySelector('.sr-only') as HTMLElement
  const drawn: string[] = []
  for (const el of ev.querySelectorAll('.sr-lin-name, .sr-lin-sci, .sr-lin-count, .sr-lin-mark, .sr-lin-badge b, .sr-lin-sentence')) {
    drawn.push((el.textContent ?? '').trim())
  }
  // A partition line holds two figures, each its own span.
  for (const part of ev.querySelectorAll('.sr-lin-part')) for (const span of part.children) drawn.push((span.textContent ?? '').trim())
  return { alt, drawn: drawn.filter(Boolean), altText: alt.textContent ?? '' }
}

/** QA-33: set equality in both directions, compared without regard to case. */
function expectParity(ev: Element) {
  const { alt, drawn, altText } = chartAndAlt(ev)
  const lowerAlt = altText.toLowerCase()
  for (const d of drawn) expect(lowerAlt, `the text equivalent carries "${d}"`).toContain(d.toLowerCase())
  // And back: every bird name and every number the text equivalent reads is drawn.
  // Text nodes joined with a space, so "<b>1</b> recorded" never reads "eBird1".
  const chartText = [...ev.querySelectorAll('.sr-lin-chart, .sr-lin-sentence')].flatMap(e => {
    const walk = document.createTreeWalker(e, NodeFilter.SHOW_TEXT)
    const out: string[] = []
    while (walk.nextNode()) out.push(walk.currentNode.textContent ?? '')
    return out
  }).join(' ')
  for (const name of alt.querySelectorAll('.sr-birdname-text')) expect(chartText, 'a name read is drawn').toContain(name.textContent!)
  for (const n of altText.match(/\b\d+\b/g) ?? []) expect(chartText, `the figure ${n} is drawn`).toMatch(new RegExp(`\\b${n}\\b`))
  // Nothing in the chart beyond the acting names is exposed.
  for (const el of ev.querySelectorAll('.sr-lin-sci, .sr-lin-count, .sr-lin-part, .sr-lin-mark, .sr-lin-rail, .sr-lin-sentence, .sr-lin-bar')) {
    expect(el.closest('[aria-hidden="true"]'), el.className).toBeTruthy()
  }
}

const altParas = (ev: Element) => [...ev.querySelectorAll('.sr-only p')].map(p => p.textContent)

describe('earlier names on the section (FR-16 to FR-25, FR-32; QA-17 to QA-27, QA-33)', () => {
  const FLY: ObservationEntry[] = [
    ...['S1', 'S2', 'S3'].map(id => entry({ submissionId: id, commonName: 'Western Flycatcher (Pacific-slope)', scientificName: 'Empidonax difficilis', date: '2023-05-01' })),
    entry({ submissionId: 'S4', commonName: 'Western Flycatcher (Cordilleran)', scientificName: 'Empidonax occidentalis', date: '2024-10-22' }),
    ...['S5', 'S6'].map(id => entry({ submissionId: id, commonName: 'Western Flycatcher', scientificName: 'Empidonax difficilis', date: '2022-05-01' })),
    entry({ submissionId: 'S7', commonName: 'Western Flycatcher', scientificName: 'Empidonax difficilis', date: '2025-05-01' }),
  ]

  it('a traced lump: each kept form counted under its earlier name, the rest in "Earlier name not recorded", shares adding to the whole', async () => {
    currentObs = FLY
    await renderReady()
    await pickFromList('Western Flycatcher')
    const ev = section().querySelector('.sr-lin-event')!
    const before = [...ev.querySelectorAll('.sr-lin-side--before > .sr-lin-node')]
    expect(before).toHaveLength(3)
    expect(ev.querySelector('.sr-lin-side--before')!.classList.contains('sr-lin-side--multi')).toBe(true)
    const [pac, cor, rest] = before
    expect(pac.querySelector('.sr-lin-count')?.textContent).toBe('3 reports')
    expect([...pac.querySelectorAll('.sr-lin-part')].map(p => p.textContent)).toEqual(["eBird's name for them until the update", 'now the form Western Flycatcher (Pacific-slope)'])
    expect(cor.querySelector('.sr-lin-count')?.textContent).toBe('1 report')
    expect([...cor.querySelectorAll('.sr-lin-part')].map(p => p.textContent)).toEqual(["eBird's name for it until the update", 'now the form Western Flycatcher (Cordilleran)'])
    expect(rest.classList.contains('is-absent')).toBe(true)
    expect(rest.querySelector('.sr-lin-mark')?.textContent).toBe('Earlier name not recorded')
    expect(rest.querySelector('.sr-lin-mark')?.classList.contains('sr-lin-mark--lead')).toBe(true)
    expect(rest.querySelector('.sr-lin-name')).toBeNull()
    expect(rest.querySelector('.sr-lin-count')?.textContent).toBe('2 reports')
    expect(rest.querySelector('.sr-lin-part')?.textContent).toBe('Dated on or before the update, with no form to show the name they had.')
    const widths = before.map(n => parseFloat((n.querySelector('.sr-lin-bar--earlier i') as HTMLElement).style.width))
    expect(widths).toEqual([50, 16.67, 33.33])
    // The lumped name keeps its shipped figures: 6 on or before, 1 since.
    const lumped = ev.querySelector('.sr-lin-side--after .sr-lin-node')!
    expect(lumped.querySelector('.sr-lin-part')?.textContent).toBe('6 reassigned by eBird1 recorded since')
    // Every name the box quotes renders unlinked and unmarked (FR-27).
    expect(pac.querySelector('.sr-lin-part .sr-birdname-text')?.textContent).toBe('Western Flycatcher (Pacific-slope)')
    for (const n of before) expect(n.querySelector('button, a')).toBeNull()
    const [sentence, paragraph] = [...ev.querySelectorAll('.sr-lin-sentence')].map(p => p.textContent)
    expect(sentence).toBe('eBird reassigned every report dated on or before 22 October 2024 to Western Flycatcher when it made this lump. Where eBird kept an earlier name as a form, reports that carry the form are counted under that name.')
    expect(sentence).not.toContain('no longer carries the earlier names')
    expect(paragraph).toBe("How the counts are worked out. From the form each report carries and its date, not from what you typed. Your backup keeps only each report's current name, so a report dated on or before the update counts under an earlier name when it carries the form eBird kept for that name, including one entered later for an earlier date. Reports with no form have no earlier name in your backup.")
    expect(altParas(ev).slice(0, 2)).toEqual([
      'Lump, October 2024.',
      "Before: Pacific-slope Flycatcher (Empidonax difficilis): 3 reports, eBird's name for them until the update, now the form Western Flycatcher (Pacific-slope). Cordilleran Flycatcher (Empidonax occidentalis): 1 report, eBird's name for it until the update, now the form Western Flycatcher (Cordilleran). Earlier name not recorded: 2 reports, dated on or before the update, with no form to show the name they had.",
    ])
    expectParity(ev)
  })

  it('a traced name with nothing to count reads the zero state, distinct from "Not traceable" in the chart and the text (FR-19)', async () => {
    currentObs = [entry({ commonName: 'Western Flycatcher', scientificName: 'Empidonax difficilis', date: '2025-05-01' })]
    await renderReady()
    await pickFromList('Western Flycatcher')
    const ev = section().querySelector('.sr-lin-event')!
    const [pac] = ev.querySelectorAll('.sr-lin-side--before > .sr-lin-node')
    expect(pac.querySelector('.sr-lin-mark')?.textContent).toBe('No reports until the update')
    expect(pac.querySelector('.sr-lin-cannot-glyph')).toBeNull()
    expect(pac.querySelector('.sr-lin-part')?.textContent).toBe('None dated on or before it carries the form Western Flycatcher (Pacific-slope).')
    expect(pac.textContent).not.toContain('Not traceable')
    expect(altParas(ev)[1]).toContain('Pacific-slope Flycatcher (Empidonax difficilis): no reports until the update. None dated on or before it carries the form Western Flycatcher (Pacific-slope).')
    expect(altParas(ev)[1]).not.toContain('not traceable')
    // No figure above zero and no residual: no paragraph (FR-25), no box.
    expect(ev.querySelectorAll('.sr-lin-sentence')).toHaveLength(1)
    expect(ev.textContent).not.toContain('Earlier name not recorded')
    expectParity(ev)
  })

  it('a not-traceable lump says so in words beside the glyph, with no number, in both the chart and the text (FR-18)', async () => {
    await renderReady()
    await pickFromList('Redpoll')
    const ev = section().querySelector('.sr-lin-event')!
    expect(altParas(ev)[1]).toBe('Before: Common Redpoll (Acanthis flammea): not traceable in your backup. eBird kept no form for this name, so its reports now read as plain Redpoll. Hoary Redpoll (Acanthis hornemanni): not traceable in your backup. eBird kept no form for this name, so its reports now read as plain Redpoll.')
    expectParity(ev)
  })

  it('a rename: the earlier name\'s count "at the latest", the page\'s spelling of the new name, "renamed by eBird", and a sentence that never dates the change to the day (FR-15, FR-23, FR-24)', async () => {
    currentObs = [
      entry({ submissionId: 'S1', commonName: 'Nankeen Night Heron', scientificName: 'Nycticorax caledonicus', date: '2025-10-31' }),
      entry({ submissionId: 'S2', commonName: 'Nankeen Night Heron', scientificName: 'Nycticorax caledonicus', date: '2026-01-01' }),
      entry({ submissionId: 'S3', commonName: 'Nankeen Night Heron', scientificName: 'Nycticorax caledonicus', date: '2026-02-01' }),
    ]
    await renderReady()
    openList()
    expect(listRows().map(r => [r.querySelector('.sr-sl-row-name')?.textContent, r.querySelector('.sr-sl-row-events')?.textContent]))
      .toEqual([['Nankeen Night Heron', 'Rename·2025']])
    fireEvent.click(listRows()[0])
    await waitFor(() => expect(querySection()).toBeTruthy())
    const ev = section().querySelector('.sr-lin-event')!
    expect(ev.querySelector('.sr-lin-badge')?.textContent).toBe('Renameby October 2025')
    const [earlier, current] = ev.querySelectorAll('.sr-lin-node')
    expect(earlier.querySelector('.sr-lin-name')?.textContent).toBe('Rufous Night-Heron')
    expect(earlier.querySelector('.sr-lin-count')?.textContent).toBe('1 report')
    expect(earlier.querySelector('.sr-lin-part')?.textContent).toBe("eBird's name for it until the update, at the latest")
    expect(current.querySelector('.sr-lin-name')?.textContent).toBe('Nankeen Night Heron')
    expect(current.querySelector('.sr-lin-part')?.textContent).toBe('1 renamed by eBird2 recorded since')
    const [sentence, paragraph] = [...ev.querySelectorAll('.sr-lin-sentence')].map(p => p.textContent)
    expect(sentence).toBe('eBird renamed Rufous Night-Heron to Nankeen Night Heron. The new name was in place by the update of 31 October 2025, the first whose record carries it.')
    expect(paragraph).toMatch(/counted under Rufous Night-Heron, including one entered later for an earlier date\. eBird may have changed the name before that update; if so, reports dated between the change and the update are counted under the earlier name too\.$/)
    expect(altParas(ev).slice(0, 3)).toEqual([
      'Rename, in place by October 2025.',
      "Before: Rufous Night-Heron (Nycticorax caledonicus): 1 report, eBird's name for it until the update, at the latest.",
      'After: Nankeen Night Heron (Nycticorax caledonicus), your species: 3 reports, 1 renamed by eBird, 2 recorded since.',
    ])
    expect(ev.textContent).not.toMatch(/reassigned/)
    expectParity(ev)
  })

  it('a rename on an older backup: the shipped predates layout, with the rename note and sentence (FR-20)', async () => {
    currentObs = [entry({ commonName: 'Rufous Night-Heron', scientificName: 'Nycticorax caledonicus', date: '2025-06-01' })]
    await renderReady()
    await pickFromList('Rufous Night-Heron')
    const ev = section().querySelector('.sr-lin-event')!
    expect(ev.querySelector('.sr-lin-note')?.textContent).toBe('Your backup predates the October 2025 update, so your reports still carry the earlier name. A fresh backup from eBird carries the new one.')
    expect(ev.querySelector('.sr-lin-sentence')?.textContent).toBe('eBird renamed Rufous Night-Heron to Nankeen Night-Heron. The new name was in place by the update of 31 October 2025, the first whose record carries it. Your backup was exported before that update, so the new name is not in it yet.')
    expect(ev.querySelectorAll('.sr-lin-sentence')).toHaveLength(1)
    expect(ev.querySelector('.sr-lin-side--before .sr-lin-part')?.textContent).toBe('all dated before the update')
    expectParity(ev)
  })

  it('an older lump backup keeps the shipped figures, no paragraph and no new state, and never says the earlier names are gone', async () => {
    currentObs = [entry({ commonName: 'Pacific-slope Flycatcher', scientificName: 'Empidonax difficilis', date: '2024-01-01' })]
    await renderReady()
    await pickFromList('Pacific-slope Flycatcher')
    const ev = section().querySelector('.sr-lin-event')!
    expect(ev.textContent).not.toMatch(/Not traceable|Earlier name not recorded|No reports until|How the count/)
    expect(ev.textContent).not.toContain('no longer carries the earlier names')
    expect(ev.querySelector('.sr-lin-note')).toBeTruthy()
    expectParity(ev)
  })

  it('a later change: the marker with its glyph on every earlier name, no number, no paragraph; the later event counts (FR-21)', async () => {
    const U2023 = { year: 2023, published: '2023-10-24' }
    historyResult = {
      v: 2, snapshot: 'T', generated: '2026-11-19', inputs: [], renames: [],
      updates: [U2023, U2025], coverage: { earliest: U2023, latest: U2025 },
      events: [
        { kind: 'split', ...U2023, before: [{ code: 'grhowl', sci: 'Bubo virginianus', com: 'Great Horned Owl', retired: false }],
          after: [{ code: 'grhowl', sci: 'Bubo virginianus', com: 'Great Horned Owl' }, { code: 'mahowl', sci: 'Bubo magellanicus', com: 'Magellanic Horned Owl' }], slashes: [] },
        { kind: 'split', ...U2025, before: [{ code: 'grhowl', sci: 'Bubo virginianus', com: 'Great Horned Owl', retired: false }],
          after: [{ code: 'grhowl', sci: 'Bubo virginianus', com: 'Great Horned Owl' }, { code: 'trhowl', sci: 'Bubo nacurutu', com: 'Tropical Horned Owl' }], slashes: [] },
      ],
    }
    currentObs = [entry({ commonName: 'Great Horned Owl', scientificName: 'Bubo virginianus', date: '2022-01-01' })]
    await renderReady()
    await pickFromList('Great Horned Owl')
    const [first, second] = section().querySelectorAll('.sr-lin-event')
    const marked = first.querySelector('.sr-lin-side--before .sr-lin-node')!
    expect(marked.querySelector('.sr-lin-mark')?.textContent).toBe('Not counted on this line')
    expect(marked.querySelector('.sr-lin-cannot-glyph')).toBeTruthy()
    expect(marked.querySelector('.sr-lin-part')?.textContent).toBe('A later update changed one of the names it became.')
    expect(marked.querySelector('.sr-lin-count')).toBeNull()
    expect(first.querySelectorAll('.sr-lin-sentence')).toHaveLength(1)
    expect(altParas(first)[1]).toBe('Before: Great Horned Owl (Bubo virginianus): not counted on this line. A later update changed one of the names it became.')
    expect(second.querySelector('.sr-lin-side--before .sr-lin-count')?.textContent).toBe('1 report')
    expectParity(first)
    expectParity(second)
  })
})

// ── Hostile names from the file (security.md: render it, never read it) ─────
//
// Names out of the user's export are file content. Each hostile name below
// carries a record entry's scientific name and no code, so the REAL derivation
// resolves it by name (tier 2) onto an affected species, and it reaches the
// list, the page and, for the rename, the section's own boxes: the latest
// rename's current name is shown as the backup spells it (design-spec section
// 5, item 3). It must arrive everywhere as text: no element, no attribute, no
// id or IDREF made from it, and nothing thrown.
describe('hostile names from the file stay text (security.md, the IDREF and injection rules)', () => {
  const HOSTILE: [name: string, sci: string][] = [
    ['<img src=x onerror=alert(1)>', 'Nycticorax caledonicus'],       // reaches the rename's current name
    ['"><script>alert(2)<script>"', 'Vireo swainsoni'],                // quote and script, no "/" (a "/" is a slash, never counted)
    ['  " \'  ', 'Empidonax difficilis'],                               // whitespace with quotes
    ['__proto__', 'Acanthis flammea'],
    ['constructor', 'Vireo gilvus'],
  ]
  const MARKERS = ['<img', 'onerror', 'script', 'alert(', '__proto__', 'constructor', '"', "'"]
  const IDREFS = ['id', 'for', 'aria-controls', 'aria-labelledby', 'aria-describedby', 'aria-activedescendant', 'aria-owns']

  /** Every attribute in scope: none carries file text, and no id or IDREF either. */
  function expectInert(scope: readonly Element[]) {
    for (const root of scope) {
      expect(root.querySelectorAll('script, iframe, object, embed')).toHaveLength(0)
      for (const img of root.querySelectorAll('img')) expect(img.getAttribute('src') ?? '', 'an img made from file text').toMatch(/^https:\/\//)
      for (const el of [root, ...root.querySelectorAll('*')]) {
        for (const attr of el.getAttributeNames()) {
          const value = el.getAttribute(attr) ?? ''
          if (attr.startsWith('on')) throw new Error(`an event-handler attribute ${attr} on <${el.tagName.toLowerCase()}>`)
          // Class names and inline styles are the app's own; the rest must not
          // carry file text, and an id or IDREF no part of a name.
          if (attr === 'class' || attr === 'style') continue
          for (const m of MARKERS) expect(value, `${attr}="${value}" on <${el.tagName.toLowerCase()}>`).not.toContain(m)
          if (IDREFS.includes(attr)) expect(value, `${attr}="${value}"`).not.toMatch(/\s|img|proto|constructor|alert/i)
        }
      }
    }
  }

  it('renders every hostile name as text only, through the list, the page and the section, and throws nothing', async () => {
    currentObs = HOSTILE.map(([name, sci], i) => entry({ submissionId: `S${i + 1}`, commonName: name, scientificName: sci, date: '2020-01-01' }))
    await renderReady()
    openList()
    const rows = listRows()
    // Every hostile name reached an affected species through the derivation.
    expect(rows).toHaveLength(HOSTILE.length)
    const panel = document.querySelector('.sr-ssx-panel')!
    expect(panel.textContent).toContain('<img src=x onerror=alert(1)>')
    expectInert([panel, slButton().closest('.sr-taxtools')!])
    const picked: string[] = []
    for (let i = 0; i < rows.length; i += 1) {
      if (i > 0) openList()
      const row = listRows()[i]
      picked.push(row.querySelector('.sr-sl-row-name')!.textContent ?? '')
      fireEvent.click(row)
      await waitFor(() => expect(querySection()).toBeTruthy())
      const s = section()
      expect(s.querySelector('.sr-lin-event'), picked[i]).toBeTruthy()
      expectInert([s, slButton().closest('.sr-taxtools')!])
    }
    // Non-vacuity: the tag payload reached the section's own boxes as text, on
    // the rename's current name, in the chart and in the text equivalent.
    expect(picked.some(p => p.startsWith('<img'))).toBe(true)
    await pickFromList(picked.find(p => p.startsWith('<img'))!)
    const rename = section().querySelector('.sr-lin-event')!
    expect(rename.querySelector('.sr-lin-side--after .sr-lin-name')?.textContent).toBe('<img src=x onerror=alert(1)>')
    expect(rename.querySelector('.sr-only')?.textContent).toContain('<img src=x onerror=alert(1)>')
    expect(rename.querySelector('.sr-lin-sentence')?.textContent).toContain('to <img src=x onerror=alert(1)>.')
    expect(rename.querySelectorAll('img')).toHaveLength(0)
    expect(screen.queryByText(/Something went wrong/)).toBeNull()
  })
})
