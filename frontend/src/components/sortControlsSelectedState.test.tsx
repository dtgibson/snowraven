// @vitest-environment jsdom
//
// THE ROSTER FOR THE APP'S SEGMENTED SORT CONTROLS (sort-controls-selected-state).
//
// Four controls carried their selected option ONLY in inline background/color
// styles: no `aria-pressed`, no `role="group"`, no hidden text. Two identically
// shaped buttons ("Taxonomic" / "A–Z", "Newest" / "Oldest") read the same to a
// screen reader whichever one was active (WCAG 1.4.1, 4.1.2). They are repaired
// to the shape `SortSeg` in `Checklists.tsx` already used: a named `role="group"`
// wrapper whose options each carry `aria-pressed`.
//
// WHY ONE FILE AND ONE ROSTER RATHER THAN FOUR SEPARATE TESTS (.claude/rules/
// testing.md, "symmetry in the code is not symmetry in the evidence"): the
// defect IS four sites that drifted apart while each looked like the others, so
// the path list is the artifact. A fifth segmented sort control with no row here
// reads as a gap rather than as nothing at all.
//
// WHAT THIS FILE DELIBERATELY DOES NOT COVER: the two `SortSeg` call sites in
// `Checklists.tsx` (the reference). They were never broken, and mounting that
// tab to assert them is scope this fix does not own. Add rows for them the first
// time `SortSeg` is touched, or the first time a fifth control appears.
//
// EACH ROW RESOLVES ITS GROUP STRUCTURALLY — from an option button's parent —
// never through `getByRole('group')`. That keeps the arms independent: removing
// `aria-pressed` reddens the three state rows and not the naming row, and
// removing `role="group"` or its label reddens the naming row alone.

import { useState, type ReactNode } from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react'
import type { ComparisonResult, SortOrder, ObservationEntry } from '../types'
import type { MLExportRow } from '../lib/parseMLExport'
import type { ChecklistData } from '../lib/compareChecklists'

// --- Seams -----------------------------------------------------------------
// Only SpeciesDetail needs the map/graph/hook stubs; they are inert for the
// other three surfaces. SightingsGraph is stubbed so recharts never mounts.
vi.mock('./SnowMap', () => ({
  SnowMap: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}))
vi.mock('./SightingsMap', () => ({ SightingsMap: () => <div data-testid="sightings-map-stub" /> }))
vi.mock('./speciesDetail/SightingsGraph', () => ({
  SightingsGraph: () => <div data-testid="sightings-graph-stub" />,
}))
vi.mock('react-map-gl/maplibre', () => ({
  Marker: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  Popup: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  useMap: () => ({ current: undefined }),
}))
vi.mock('../lib/useHotspotSet', () => ({ useHotspotSet: () => ({ isHotspot: () => false }) }))
vi.mock('../lib/useProvenanceLookup', () => ({ useProvenanceLookup: () => new Set<string>() }))
vi.mock('../lib/useExportWeather', () => ({ useExportWeather: () => null }))

const observations: { current: ObservationEntry[] } = { current: [] }

vi.mock('../lib/storage', () => ({
  storage: {
    getFilesStatus: vi.fn(async () => ({
      ebird: { filename: 'ebird.csv', uploadedAt: '2024-04-01' },
      ml: null,
    })),
    readFile: vi.fn(async () => null),
    getSetting: vi.fn(async () => null),
    setSetting: vi.fn(async () => {}),
    getApiKey: vi.fn(async () => null),
  },
}))
vi.mock('../lib/observationsCache', () => ({
  loadEbirdObservations: vi.fn(async () => ({ headerLine: '', observations: observations.current })),
}))
vi.mock('../lib/mlExportCache', () => ({ loadMLExport: vi.fn(async () => null) }))

const getMock = vi.fn()
vi.mock('../lib/transport', async (orig) => {
  const actual = await orig<typeof import('../lib/transport')>()
  return {
    ...actual,
    transport: {
      get: (...a: unknown[]) => getMock(...a),
      post: vi.fn(async () => ({ codes: {}, orders: {}, formCodes: {} })),
    },
  }
})

import { ChecklistComparer } from './ChecklistComparer'
import { ResultsView } from './ResultsView'
import { MediaCommentsSection } from './MediaCommentsSection'
import { SpeciesDetail } from './SpeciesDetail'

// --- Fixtures --------------------------------------------------------------

const checklistMeta = {
  locName: 'Marsh', obsDt: '2024-05-01 06:30', protocolId: '', durationHrs: null,
  distanceKm: null, distanceUnit: '', numObservers: null, submissionMethod: '',
  submissionVersion: '', comments: '',
}
const checklistA: ChecklistData = {
  ...checklistMeta,
  species: [{ speciesCode: 'amerob', commonName: 'American Robin', count: '3', breedingCode: '', comments: '', media: { photo: 0, audio: 0, video: 0 } }],
}
const checklistB: ChecklistData = {
  ...checklistMeta, locName: 'Pond',
  species: [{ speciesCode: 'amerob', commonName: 'American Robin', count: '1', breedingCode: '', comments: '', media: { photo: 0, audio: 0, video: 0 } }],
}

const COMPARISON: ComparisonResult = {
  both: ['American Robin'],
  aOnly: ['Song Sparrow'],
  bOnly: ['House Finch'],
  totalA: 2,
  totalB: 2,
  taxOrder: new Map([['American Robin', 0], ['Song Sparrow', 1], ['House Finch', 2]]),
}

function mlRow(overrides: Partial<MLExportRow> = {}): MLExportRow {
  return {
    catalogId: '12345678', commonName: 'American Robin', scientificName: 'Turdus migratorius',
    format: 'Photo', date: '2025-03-02 10:55', location: 'Stanley Park', county: null,
    latitude: null, longitude: null, caption: '', mediaNotes: '', observationDetails: '',
    ageSex: '', behaviors: '', time: '', year: null, month: null, avgRating: null,
    numRatings: 0, checklistId: '', ...overrides,
  }
}

function obs(submissionId: string, commonName: string, date: string): ObservationEntry {
  return {
    submissionId, commonName, scientificName: 'Turdus migratorius', date,
    location: 'Park', locationId: 'L1', latitude: null, longitude: null, county: 'Alpha',
    count: 1, breedingCode: null, speciesComments: 'Singing from the fence line',
    catalogIds: [], stateProvince: 'US-MN',
  }
}

/** ResultsView is controlled, so its "the true moves" row needs a state owner. */
function ResultsHost() {
  const [sort, setSort] = useState<SortOrder>('taxonomic')
  return (
    <ResultsView
      listALabel="List A" listBLabel="List B" result={COMPARISON}
      onReset={() => {}} sort={sort} onSortChange={setSort} taxonMap={{}}
    />
  )
}

// --- The roster ------------------------------------------------------------

const GROUP_NAME = 'Sort order'

type SortGroupRow = {
  /** The surface as the user meets it. */
  surface: string
  /** Option labels in DOM order; the FIRST is the one selected at first render. */
  labels: [string, string]
  /** Mount the surface and resolve its sort group, found from an option's parent. */
  mount: () => Promise<HTMLElement>
}

async function groupOf(label: string): Promise<HTMLElement> {
  const option = await screen.findByRole('button', { name: label })
  return option.parentElement as HTMLElement
}

const ROSTER: SortGroupRow[] = [
  {
    surface: 'ChecklistComparer (List Comparer, checklist mode)',
    labels: ['Taxonomic', 'A–Z'],
    mount: async () => {
      render(<ChecklistComparer onOpenSpecies={undefined} keyStatus={null} onGoToSettings={() => {}} />)
      const inputs = screen.getAllByPlaceholderText(/S12345678/)
      fireEvent.change(inputs[0], { target: { value: 'S111' } })
      fireEvent.change(inputs[1], { target: { value: 'S222' } })
      fireEvent.click(screen.getByRole('button', { name: /compare checklists/i }))
      await screen.findByText('In Both')
      return groupOf('Taxonomic')
    },
  },
  {
    surface: 'ResultsView (List Comparer, list mode)',
    labels: ['Taxonomic', 'A–Z'],
    mount: async () => {
      render(<ResultsHost />)
      return groupOf('Taxonomic')
    },
  },
  {
    surface: 'MediaCommentsSection (Multimedia tab)',
    labels: ['Newest', 'Oldest'],
    mount: async () => {
      render(
        <MediaCommentsSection
          rows={[mlRow({ caption: 'Singing at dawn' }), mlRow({ catalogId: '87654321', date: '2025-04-02 09:10', mediaNotes: 'Backlit' })]}
          backboneNames={new Set<string>()} taxonMap={{}} onOpenSpecies={undefined}
        />,
      )
      return groupOf('Newest')
    },
  },
  {
    surface: 'SpeciesDetail comments (Species Detail tab)',
    labels: ['Newest', 'Oldest'],
    mount: async () => {
      observations.current = [
        obs('S1', 'American Robin', '2024-01-10'),
        obs('S2', 'American Robin', '2024-02-11'),
      ]
      render(<SpeciesDetail onGoToSettings={() => {}} onGoToWeather={() => {}} filesVersion={0} embedAllowed={false} />)
      await screen.findByRole('combobox', { name: 'Select species' })
      fireEvent.click(screen.getByRole('button', { name: 'Toggle species list' }))
      const listbox = screen.getByRole('listbox')
      const option = within(listbox).getAllByRole('option')
        .find(row => (row.textContent ?? '').startsWith('American Robin'))
      expect(option, 'option American Robin').toBeTruthy()
      fireEvent.click(option!)
      return groupOf('Newest')
    },
  },
]

// --- Shared assertions -----------------------------------------------------

/** The group's option buttons, checked against the roster's labels so a row
 *  that silently stops resolving its own control fails loudly. */
function optionsOf(group: HTMLElement, labels: [string, string]): HTMLButtonElement[] {
  const options = [...group.querySelectorAll('button')] as HTMLButtonElement[]
  expect(options.map(b => (b.textContent ?? '').trim())).toEqual(labels)
  return options
}

beforeEach(() => {
  observations.current = []
  getMock.mockReset()
  getMock.mockImplementation((path: string) =>
    Promise.resolve(String(path).includes('S111') ? checklistA : checklistB))
})
afterEach(cleanup)

describe.each(ROSTER)('segmented sort control — $surface', ({ labels, mount }) => {
  it('every option carries a LITERAL aria-pressed of "true" or "false"', async () => {
    const options = optionsOf(await mount(), labels)
    for (const option of options) {
      const state = option.getAttribute('aria-pressed')
      // An absent attribute reads `null` here, so it cannot pass as "false".
      expect(state, `"${option.textContent}" has no aria-pressed`).not.toBeNull()
      expect(state === 'true' || state === 'false', `"${option.textContent}" reads "${state}"`).toBe(true)
    }
  })

  it('exactly one option reads "true"', async () => {
    const options = optionsOf(await mount(), labels)
    expect(options.filter(b => b.getAttribute('aria-pressed') === 'true')).toHaveLength(1)
  })

  it('the "true" MOVES to the option that was clicked', async () => {
    const group = await mount()
    const [first, second] = optionsOf(group, labels)
    expect(first.getAttribute('aria-pressed')).toBe('true')
    expect(second.getAttribute('aria-pressed')).toBe('false')

    fireEvent.click(second)

    const [firstAfter, secondAfter] = optionsOf(group, labels)
    expect(secondAfter.getAttribute('aria-pressed')).toBe('true')
    expect(firstAfter.getAttribute('aria-pressed')).toBe('false')
  })

  it('the wrapper is a role="group" with a non-empty accessible name', async () => {
    const group = await mount()
    expect(group.getAttribute('role')).toBe('group')
    // Resolved by the accessibility-name computation, not by reading the attribute.
    expect(screen.getByRole('group', { name: GROUP_NAME })).toBe(group)
  })
})
