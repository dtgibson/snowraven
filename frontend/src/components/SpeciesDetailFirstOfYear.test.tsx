// @vitest-environment jsdom
// First of Year on the real Species Detail tab (species-first-of-year): where
// the card sits and in what register (FR-17, QA-18), that it follows the tab's
// own species, Show subspecies, county and date filters in the same commit as
// the Sightings card (FR-01, FR-09, QA-01, QA-10), that its earliest row is
// First seen on screen (FR-08), that Show all forms and Show escapees leave it
// alone (QA-09), and that a species whose every date is malformed shows the
// Sightings card and no First of Year card (FR-10, QA-11). The chart is
// stubbed here; the section's and the chart's own files cover them.
// Harness shape: SpeciesDetailChecklistFrequency.test.tsx.

import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import type { ObservationEntry } from '../types'
import type { FirstOfYearChartProps } from './speciesDetail/FirstOfYearChart'

vi.mock('./SnowMap', () => ({
  SnowMap: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}))
vi.mock('./SightingsMap', () => ({
  SightingsMap: () => <div data-testid="sightings-map-stub" />,
}))
vi.mock('./speciesDetail/SightingsGraph', () => ({
  SightingsGraph: () => <div data-testid="sightings-graph-stub" />,
}))
vi.mock('./speciesDetail/FirstOfYearChart', () => ({
  FirstOfYearChart: ({ data }: FirstOfYearChartProps) => (
    <div data-testid="foy-chart-stub">{data.points.map(p => `${p.year}:${p.dayOfYear ?? '-'}`).join(' ')}</div>
  ),
}))
vi.mock('react-map-gl/maplibre', () => ({
  Marker: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  Popup: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  useMap: () => ({ current: undefined }),
}))
vi.mock('../lib/useHotspotSet', () => ({
  useHotspotSet: () => ({ isHotspot: () => false }),
}))
vi.mock('../lib/useProvenanceLookup', () => ({
  useProvenanceLookup: () => new Set<string>(),
}))
vi.mock('../lib/useExportWeather', () => ({
  useExportWeather: () => null,
}))

const source: { current: ObservationEntry[] } = { current: [] }

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
  loadEbirdObservations: vi.fn(async () => ({ headerLine: '', observations: source.current })),
}))
vi.mock('../lib/mlExportCache', () => ({ loadMLExport: vi.fn(async () => null) }))
vi.mock('../lib/transport', () => ({
  transport: {
    get: vi.fn(async () => ({})),
    post: vi.fn(async () => ({ codes: {}, orders: {}, formCodes: {} })),
  },
  TransportError: class extends Error {},
}))

import { SpeciesDetail } from './SpeciesDetail'
import { formatDate } from '../lib/formatDate'

const props = { onGoToSettings: () => {}, onGoToWeather: () => {}, filesVersion: 0, embedAllowed: false }

function obs(submissionId: string, commonName: string, date: string, county = 'Alpha'): ObservationEntry {
  return {
    submissionId, commonName,
    scientificName: commonName.startsWith('Yellow-rumped') ? 'Setophaga coronata' : 'Turdus migratorius',
    date, location: 'Park', locationId: 'L1', latitude: null, longitude: null, county,
    count: 1, breedingCode: null, speciesComments: '', catalogIds: [], stateProvince: 'US-MN',
  }
}

async function renderReady(observations: ObservationEntry[]) {
  source.current = observations
  render(<SpeciesDetail {...props} />)
  await screen.findByRole('combobox', { name: 'Select species' })
}

function chooseSpecies(commonName: string) {
  fireEvent.click(screen.getByRole('button', { name: 'Toggle species list' }))
  const option = within(screen.getByRole('listbox')).getAllByRole('option')
    .find(o => (o.textContent ?? '').startsWith(commonName))
  expect(option, `option ${commonName}`).toBeTruthy()
  fireEvent.click(option!)
}

const cardTitled = (title: string) => screen.getByText(title, { selector: 'span' }).parentElement!.parentElement!
const foyCard = () => screen.queryByText('First of Year', { selector: 'span' })?.parentElement?.parentElement ?? null

/** Each row as [year, visible date, href], newest first. */
function foyRows(): Array<[string, string, string | null]> {
  const card = foyCard()
  if (!card) return []
  return [...card.querySelectorAll('li.sr-foy-row')].map(li => [
    li.querySelector('.sr-foy-year')!.textContent ?? '',
    li.lastElementChild!.textContent ?? '',
    li.querySelector('a')?.getAttribute('href') ?? null,
  ])
}

/** The Sightings card's First seen cell: [visible date, href]. */
function firstSeen(): [string, string | null] {
  const label = within(cardTitled('Sightings')).getByText('First seen')
  const value = label.nextElementSibling!
  return [value.textContent ?? '', value.getAttribute('href')]
}

/** FR-08 on screen: the earliest year row (the LAST row, newest first) is First seen. */
function expectEarliestIsFirstSeen() {
  const rows = foyRows()
  const [, date, href] = rows[rows.length - 1]
  expect([date, href]).toEqual(firstSeen())
}

const ck = (id: string) => `https://ebird.org/checklist/${id}`

const DATA = [
  obs('S11', 'Yellow-rumped Warbler (Myrtle)', '2021-04-02', 'Alpha'),
  obs('S12', "Yellow-rumped Warbler (Audubon's)", '2021-03-28', 'Beta'),
  obs('S13', 'Yellow-rumped Warbler', '2023-04-15', 'Alpha'),
  obs('S14', 'Yellow-rumped Warbler (Myrtle)', '2023-02-11', 'Beta'),
  obs('S15', 'Yellow-rumped Warbler', '2024-05-01', 'Alpha'),
  obs('S16', 'Yellow-rumped Warbler', '2024-04-20', 'Alpha'),
  // Another species, earlier than everything above: never in this bird's rows.
  obs('S90', 'American Robin', '2019-01-02', 'Alpha'),
  obs('S91', 'American Robin', '2024-01-02', 'Alpha'),
]

beforeEach(() => { source.current = [] })
afterEach(cleanup)

describe('placement and register (FR-17, QA-18)', () => {
  it('sits full width right after the Sightings and Media row, before Subspecies and Forms, in the Sightings card\'s register', async () => {
    await renderReady(DATA)
    chooseSpecies('Yellow-rumped Warbler')
    const card = foyCard()!
    const sightings = cardTitled('Sightings')
    const twoCol = sightings.parentElement!
    expect(twoCol.className).toBe('sr-two-col')
    expect(twoCol.nextElementSibling).toBe(card)
    const forms = cardTitled('Subspecies and Forms')
    expect(card.compareDocumentPosition(forms) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    // The same card and heading register: the same SectionCard and SectionHead.
    expect(card.getAttribute('style')).toBe(sightings.getAttribute('style'))
    const head = (c: HTMLElement) => c.firstElementChild as HTMLElement
    expect(head(card).getAttribute('style')).toBe(head(sightings).getAttribute('style'))
    expect((head(card).lastElementChild as HTMLElement).getAttribute('style'))
      .toBe((head(sightings).lastElementChild as HTMLElement).getAttribute('style'))
  })
})

describe('the in-scope set and the filters (FR-01, FR-08, FR-09: QA-01, QA-10)', () => {
  it('folds the forms together, leaves out another species, and starts at First seen', async () => {
    await renderReady(DATA)
    chooseSpecies('Yellow-rumped Warbler')
    expect(foyRows()).toEqual([
      ['2024', formatDate('2024-04-20'), ck('S16')],
      ['2023', formatDate('2023-02-11'), ck('S14')],
      ['2021', formatDate('2021-03-28'), ck('S12')],
    ])
    expectEarliestIsFirstSeen()
    expect(screen.getByTestId('foy-chart-stub').textContent).toBe('2021:87 2022:- 2023:42 2024:111')
  })

  it('follows the county filter in the same commit as the Sightings card', async () => {
    await renderReady(DATA)
    chooseSpecies('Yellow-rumped Warbler')
    fireEvent.change(screen.getByRole('combobox', { name: 'County' }), { target: { value: 'Alpha' } })
    // Read synchronously after the change's own commit: no wait, so a row from
    // the previous state would still be on screen if it lagged.
    expect(foyRows()).toEqual([
      ['2024', formatDate('2024-04-20'), ck('S16')],
      ['2023', formatDate('2023-04-15'), ck('S13')],
      ['2021', formatDate('2021-04-02'), ck('S11')],
    ])
    expectEarliestIsFirstSeen()
    // A county filter alone adds no note (FR-16).
    expect(screen.queryByText('First dates within the selected date range.')).toBeNull()
  })

  it('follows the date range in the same commit, and says so', async () => {
    await renderReady(DATA)
    chooseSpecies('Yellow-rumped Warbler')
    // A From date of April 1, 2021 drops 2021's March 28 row, so 2021's first
    // in range is April 2; 2023-02-11 is after it and stays (one interval, not
    // a season).
    fireEvent.change(screen.getByLabelText('From date'), { target: { value: '2021-04-01' } })
    expect(foyRows()).toEqual([
      ['2024', formatDate('2024-04-20'), ck('S16')],
      ['2023', formatDate('2023-02-11'), ck('S14')],
      ['2021', formatDate('2021-04-02'), ck('S11')],
    ])
    expectEarliestIsFirstSeen()
    expect(screen.getByText('First dates within the selected date range.')).toBeTruthy()
    fireEvent.change(screen.getByLabelText('To date'), { target: { value: '2023-12-31' } })
    expect(foyRows().map(r => r[0])).toEqual(['2023', '2021'])
    expectEarliestIsFirstSeen()
  })

  it('follows Show subspecies: on, the selected form\'s own rows alone', async () => {
    await renderReady(DATA)
    fireEvent.click(screen.getByRole('switch', { name: /Show subspecies/ }))
    chooseSpecies('Yellow-rumped Warbler (Myrtle)')
    expect(foyRows()).toEqual([
      ['2023', formatDate('2023-02-11'), ck('S14')],
      ['2021', formatDate('2021-04-02'), ck('S11')],
    ])
    expectEarliestIsFirstSeen()
  })

  it('changes nothing when Show all forms or Show escapees flips with the species still selected (QA-09)', async () => {
    await renderReady(DATA)
    chooseSpecies('Yellow-rumped Warbler')
    const before = foyRows()
    expect(before).toHaveLength(3)
    fireEvent.click(screen.getByRole('switch', { name: /Show all forms/ }))
    expect(foyRows()).toEqual(before)
    fireEvent.click(screen.getByRole('switch', { name: /Show escapees/ }))
    expect(foyRows()).toEqual(before)
    // Non-vacuity: the species really is still the one on screen.
    expect(screen.getByRole<HTMLInputElement>('combobox', { name: 'Select species' }).value).toBe('Yellow-rumped Warbler')
  })
})

describe('a species whose every date is malformed (FR-10, QA-11)', () => {
  it('shows the Sightings card and no First of Year card at all', async () => {
    // Both malformed dates share one month key on purpose. The Sightings Over
    // Time data (lib/sightingsGraph.ts buildGraphData, outside this feature)
    // never returns when a species' month keys include a malformed one beside
    // another key ('' and '2024-13', say): its monthly gap fill reads an
    // undefined month and never advances the year. Recorded in decisions.md as
    // a pre-existing defect, not exercised here.
    await renderReady([
      obs('S1', 'American Robin', '2023-02-29'),
      obs('S2', 'American Robin', '2023-02-30'),
      obs('S3', 'Yellow-rumped Warbler', '2024-04-20'),
    ])
    chooseSpecies('American Robin')
    expect(cardTitled('Sightings')).toBeTruthy()
    expect(foyCard()).toBeNull()
    expect(document.querySelector('.sr-foy-grid')).toBeNull()
  })
})
