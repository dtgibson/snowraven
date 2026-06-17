// @vitest-environment jsdom

import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'

// SnowMap is heavy (MapLibre/WebGL); stub it so we can assert mount/teardown
// without a real GL context. The stub exposes a testid so map presence is
// observable.
vi.mock('./SnowMap', () => ({
  SnowMap: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="snowmap-stub">{children}</div>
  ),
}))
// Markers/Popups inside the (mocked) map — render children inertly.
vi.mock('react-map-gl/maplibre', () => ({
  Marker: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  Popup: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  useMap: () => ({ current: null }),
}))

import { NamedBirdsTable } from './NamedBirdsTable'
import { computeNamedBirds } from '../lib/namedBirds'
import type { ObservationEntry } from '../types'

afterEach(cleanup)

function obs(p: Partial<ObservationEntry> & { submissionId: string }): ObservationEntry {
  return {
    commonName: 'Mallard', scientificName: 'Anas platyrhynchos', date: '2024-01-01',
    location: 'Loc', locationId: 'L1', latitude: null, longitude: null, county: null,
    count: 1, breedingCode: null, speciesComments: '', catalogIds: [],
    ...p,
  }
}

const birds = computeNamedBirds([
  obs({ submissionId: 'S100', commonName: 'Mallard', date: '2024-03-01', location: 'Lake Merritt', latitude: 37.8, longitude: -122.2, speciesComments: 'drake [name:Pete] at the pond' }),
  obs({ submissionId: 'S200', commonName: 'Mallard', date: '2024-05-01', location: '', latitude: null, longitude: null, speciesComments: '[name:Pete] still here' }),
  obs({ submissionId: 'S300', commonName: 'Canada Goose', date: '2024-04-01', location: 'Arrowhead Marsh', latitude: 37.7, longitude: -122.1, speciesComments: '[name:Honk]' }),
])

describe('NamedBirdsTable', () => {
  it('renders each named bird with its sighting count and the four-option sort when showSpecies', () => {
    render(<NamedBirdsTable birds={birds} showSpecies renderSpecies={cn => <span>{cn}</span>} />)
    expect(screen.getByText('Pete')).toBeTruthy()
    expect(screen.getByText('Honk')).toBeTruthy()
    expect(screen.getByText('2 sightings')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Name (Individual)' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Alphabetical' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Taxonomic' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Last Seen' })).toBeTruthy()
  })

  it('shows only Name (Individual) + Last Seen when showSpecies is false', () => {
    render(<NamedBirdsTable birds={birds} showSpecies={false} />)
    expect(screen.queryByRole('button', { name: 'Alphabetical' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Taxonomic' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Name (Individual)' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Last Seen' })).toBeTruthy()
  })

  it('expands a bird to show its reports (date · location · checklist link + comment)', () => {
    render(<NamedBirdsTable birds={birds} showSpecies renderSpecies={cn => <span>{cn}</span>} />)
    const peteRow = screen.getByText('Pete').closest('button')!
    fireEvent.click(peteRow)
    const link = screen.getByRole('link', { name: /S200/ })
    expect(link.getAttribute('href')).toBe('https://ebird.org/checklist/S200')
    expect(screen.getByText('[name:Pete] still here')).toBeTruthy()
    // Location renders between date and checklist for the report that has one…
    expect(screen.getByText('Lake Merritt')).toBeTruthy()
  })

  it('omits the location segment for a report with no location', () => {
    render(<NamedBirdsTable birds={birds} showSpecies renderSpecies={cn => <span>{cn}</span>} />)
    fireEvent.click(screen.getByText('Pete').closest('button')!)
    // S200 has no location; its row must not invent a placeholder. There are two
    // Pete reports — S100 with "Lake Merritt", S200 with none — so exactly one
    // location text appears for Pete.
    expect(screen.queryAllByText('Lake Merritt')).toHaveLength(1)
  })

  it('renders a malformed checklist id as plain text, not a link (S-id gate)', () => {
    const junk = computeNamedBirds([
      obs({ submissionId: 'N/A', commonName: 'Mallard', date: '2024-02-02', location: 'Nowhere', latitude: null, longitude: null, speciesComments: '[name:Mystery]' }),
    ])
    render(<NamedBirdsTable birds={junk} showSpecies renderSpecies={cn => <span>{cn}</span>} />)
    fireEvent.click(screen.getByText('Mystery').closest('button')!)
    // The junk id shows as text but must not become a styled 404 link.
    expect(screen.getByText('N/A')).toBeTruthy()
    expect(screen.queryByRole('link', { name: /N\/A/ })).toBeNull()
  })

  it('mounts the per-individual map (one SnowMap) only when expanded and only on the single-open tab', async () => {
    render(<NamedBirdsTable birds={birds} showSpecies singleOpen orderFor={() => Infinity} renderSpecies={cn => <span>{cn}</span>} />)
    // Collapsed: no map.
    expect(screen.queryByTestId('snowmap-stub')).toBeNull()
    fireEvent.click(screen.getByText('Pete').closest('button')!)
    // Pete has a coordinate-bearing sighting → exactly one map mounts. SightingsMap
    // is lazy-loaded (0.5.42 maplibre defer), so the stub appears once its chunk
    // resolves — findAllByTestId awaits that.
    expect(await screen.findAllByTestId('snowmap-stub')).toHaveLength(1)
    expect(screen.getByText(/Where Pete has been seen/i)).toBeTruthy()
  })

  it('renders no map for the Species Detail section (multi-open, no singleOpen)', () => {
    render(<NamedBirdsTable birds={birds} showSpecies={false} />)
    fireEvent.click(screen.getByText('Pete').closest('button')!)
    expect(screen.queryByTestId('snowmap-stub')).toBeNull()
  })

  it('single-open accordion: opening a second card collapses the first', async () => {
    render(<NamedBirdsTable birds={birds} showSpecies singleOpen orderFor={() => Infinity} renderSpecies={cn => <span>{cn}</span>} />)
    fireEvent.click(screen.getByText('Pete').closest('button')!)
    expect(screen.getByText('[name:Pete] still here')).toBeTruthy()
    // Open Honk → Pete's panel (and its map) must tear down.
    fireEvent.click(screen.getByText('Honk').closest('button')!)
    expect(screen.queryByText('[name:Pete] still here')).toBeNull()
    expect(screen.getByText('[name:Honk]')).toBeTruthy()
    // Lazy SightingsMap (0.5.42) → await the surviving single map stub.
    expect(await screen.findAllByTestId('snowmap-stub')).toHaveLength(1)
  })

  it('multi-open accordion (no singleOpen): a second card opens without closing the first', () => {
    render(<NamedBirdsTable birds={birds} showSpecies={false} />)
    fireEvent.click(screen.getByText('Pete').closest('button')!)
    fireEvent.click(screen.getByText('Honk').closest('button')!)
    expect(screen.getByText('[name:Pete] still here')).toBeTruthy()
    expect(screen.getByText('[name:Honk]')).toBeTruthy()
  })

  it('does not render a map for an individual with no usable coordinates', () => {
    const noCoord = computeNamedBirds([
      obs({ submissionId: 'S1', commonName: 'Mallard', date: '2024-01-01', latitude: null, longitude: null, speciesComments: '[name:Ghost]' }),
    ])
    render(<NamedBirdsTable birds={noCoord} showSpecies singleOpen orderFor={() => Infinity} renderSpecies={cn => <span>{cn}</span>} />)
    fireEvent.click(screen.getByText('Ghost').closest('button')!)
    expect(screen.queryByTestId('snowmap-stub')).toBeNull()
  })

  it('re-sorts when the Taxonomic option is chosen using orderFor', () => {
    const orderFor = (cn: string) => ({ 'Canada Goose': 1, Mallard: 5 }[cn] ?? Infinity)
    render(<NamedBirdsTable birds={birds} showSpecies orderFor={orderFor} renderSpecies={cn => <span>{cn}</span>} />)
    fireEvent.click(screen.getByRole('button', { name: 'Taxonomic' }))
    // Goose (order 1) before Mallard/Pete (order 5).
    const names = screen.getAllByText(/^(Pete|Honk)$/).map(n => n.textContent)
    expect(names).toEqual(['Honk', 'Pete'])
  })
})
