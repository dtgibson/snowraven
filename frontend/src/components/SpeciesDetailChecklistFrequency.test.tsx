// @vitest-environment jsdom

import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { ObservationEntry } from '../types'

vi.mock('./SnowMap', () => ({
  SnowMap: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}))
vi.mock('./SightingsMap', () => ({
  SightingsMap: () => <div data-testid="sightings-map-stub" />,
}))
vi.mock('./speciesDetail/SightingsGraph', () => ({
  SightingsGraph: () => <div data-testid="sightings-graph-stub" />,
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

const props = {
  onGoToSettings: () => {},
  onGoToWeather: () => {},
  filesVersion: 0,
  embedAllowed: false,
}

function obs(
  submissionId: string,
  commonName: string,
  date = '2024-01-10',
  county = 'Alpha',
  count = 1,
): ObservationEntry {
  return {
    submissionId,
    commonName,
    scientificName: commonName.startsWith('Yellow-rumped') ? 'Setophaga coronata' : 'Turdus migratorius',
    date,
    location: 'Park',
    locationId: 'L1',
    latitude: null,
    longitude: null,
    county,
    count,
    breedingCode: null,
    speciesComments: '',
    catalogIds: [],
    stateProvince: 'US-MN',
  }
}

async function renderReady(observations: ObservationEntry[]) {
  source.current = observations
  render(<SpeciesDetail {...props} />)
  await screen.findByRole('combobox', { name: 'Select species' })
}

function chooseSpecies(commonName: string) {
  fireEvent.click(screen.getByRole('button', { name: 'Toggle species list' }))
  const listbox = screen.getByRole('listbox')
  const option = within(listbox).getAllByRole('option')
    .find(row => (row.textContent ?? '').startsWith(commonName))
  expect(option, `option ${commonName}`).toBeTruthy()
  fireEvent.click(option!)
}

function sightingsCard(): HTMLElement {
  const heading = screen.getByText('Sightings')
  return heading.parentElement!.parentElement!
}

function statValue(label: string): string {
  const labelNode = within(sightingsCard()).getByText(label)
  return labelNode.nextElementSibling?.textContent ?? ''
}

function frequencyFill(): HTMLElement {
  const label = within(sightingsCard()).getByText('Frequency')
  return label.parentElement!.lastElementChild!.firstElementChild as HTMLElement
}

beforeEach(() => {
  source.current = []
})
afterEach(cleanup)

describe('Species Detail checklist frequency basis', () => {
  it('deduplicates parent and form rows in merged mode without deduplicating individuals', async () => {
    await renderReady([
      obs('S1', 'Yellow-rumped Warbler', '2024-01-10', 'Alpha', 2),
      obs('S1', 'Yellow-rumped Warbler (Myrtle)', '2024-01-10', 'Alpha', 3),
      obs('S1', "Yellow-rumped Warbler (Audubon's)", '2024-01-10', 'Alpha', 4),
    ])
    chooseSpecies('Yellow-rumped Warbler')

    expect(statValue('Checklists')).toBe('1')
    expect(statValue('Individuals')).toBe('9')
    expect(statValue('Frequency')).toBe('100%')
    expect(frequencyFill().style.width).toBe('100%')
    expect(Number.parseFloat(frequencyFill().style.width)).toBeLessThanOrEqual(100)

    fireEvent.change(screen.getByRole('combobox', { name: 'County' }), { target: { value: 'Alpha' } })
    expect(await screen.findByText(/Showing 1 of 1 checklist$/)).toBeTruthy()
  })

  it('deduplicates repeated exact-name rows when Show subspecies is on', async () => {
    await renderReady([
      obs('S1', 'Yellow-rumped Warbler', '2024-01-10', 'Alpha', 2),
      obs('S1', 'Yellow-rumped Warbler', '2024-01-10', 'Alpha', 3),
    ])
    fireEvent.click(screen.getByRole('switch', { name: /Show subspecies/ }))
    chooseSpecies('Yellow-rumped Warbler')

    expect(statValue('Checklists')).toBe('1')
    expect(statValue('Individuals')).toBe('5')
    expect(statValue('Frequency')).toBe('100%')
  })

  it('shares county and inclusive date filters and reports distinct filter-strip counts', async () => {
    await renderReady([
      obs('S1', 'Yellow-rumped Warbler', '2024-01-10', 'Alpha'),
      obs('S1', 'Yellow-rumped Warbler (Myrtle)', '2024-01-10', 'Alpha'),
      obs('S2', 'Yellow-rumped Warbler', '2024-01-20', 'Alpha'),
      obs('S2', "Yellow-rumped Warbler (Audubon's)", '2024-01-20', 'Alpha'),
      obs('S3', 'Yellow-rumped Warbler', '2024-01-21', 'Alpha'),
      obs('S4', 'Yellow-rumped Warbler', '2024-01-10', 'Beta'),
      obs('S5', 'American Robin', '2024-01-15', 'Alpha'),
    ])
    chooseSpecies('Yellow-rumped Warbler')

    fireEvent.change(screen.getByRole('combobox', { name: 'County' }), { target: { value: 'Alpha' } })
    fireEvent.change(screen.getByLabelText('From date'), { target: { value: '2024-01-10' } })
    fireEvent.change(screen.getByLabelText('To date'), { target: { value: '2024-01-20' } })

    await waitFor(() => expect(screen.getByText(/Showing 2 of 4 checklists/)).toBeTruthy())
    expect(statValue('Checklists')).toBe('2')
    expect(statValue('Frequency')).toBe('67%')
    expect(Number.parseFloat(frequencyFill().style.width)).toBeLessThanOrEqual(100)
  })

  it('counts empty submission ids as zero checklists and hides Frequency', async () => {
    await renderReady([obs('', 'American Robin')])
    chooseSpecies('American Robin')

    expect(statValue('Checklists')).toBe('0')
    expect(within(sightingsCard()).queryByText('Frequency')).toBeNull()
  })

  it('preserves ordinary one-row-per-submission count and percentage parity', async () => {
    await renderReady([
      obs('S1', 'American Robin', '2024-01-10', 'Alpha'),
      obs('S2', 'American Robin', '2024-01-11', 'Alpha'),
      obs('S3', 'Yellow-rumped Warbler', '2024-01-12', 'Alpha'),
      obs('S4', 'Yellow-rumped Warbler', '2024-01-13', 'Alpha'),
    ])
    chooseSpecies('American Robin')

    expect(statValue('Checklists')).toBe('2')
    expect(statValue('Frequency')).toBe('50%')
  })
})
