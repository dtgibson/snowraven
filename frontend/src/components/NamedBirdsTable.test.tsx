// @vitest-environment jsdom

import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
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
  obs({ submissionId: 'S100', commonName: 'Mallard', date: '2024-03-01', speciesComments: 'drake [name:Pete] at the pond' }),
  obs({ submissionId: 'S200', commonName: 'Mallard', date: '2024-05-01', speciesComments: '[name:Pete] still here' }),
  obs({ submissionId: 'S300', commonName: 'Canada Goose', date: '2024-04-01', speciesComments: '[name:Honk]' }),
])

describe('NamedBirdsTable', () => {
  it('renders each named bird with its sighting count and a species sort when showSpecies', () => {
    render(<NamedBirdsTable birds={birds} showSpecies renderSpecies={cn => <span>{cn}</span>} />)
    expect(screen.getByText('Pete')).toBeTruthy()
    expect(screen.getByText('Honk')).toBeTruthy()
    expect(screen.getByText('2 sightings')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Species' })).toBeTruthy()
  })

  it('omits the species sort when showSpecies is false', () => {
    render(<NamedBirdsTable birds={birds} showSpecies={false} />)
    expect(screen.queryByRole('button', { name: 'Species' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Name' })).toBeTruthy()
  })

  it('expands a bird to show its checklists (link + comment)', () => {
    render(<NamedBirdsTable birds={birds} showSpecies renderSpecies={cn => <span>{cn}</span>} />)
    // Pete's row — find the toggle button containing "Pete" and click it.
    const peteRow = screen.getByText('Pete').closest('button')!
    fireEvent.click(peteRow)
    const link = screen.getByRole('link', { name: /S200/ })
    expect(link.getAttribute('href')).toBe('https://ebird.org/checklist/S200')
    expect(screen.getByText('[name:Pete] still here')).toBeTruthy()
  })
})
