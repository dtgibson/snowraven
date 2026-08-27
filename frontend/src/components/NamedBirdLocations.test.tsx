// @vitest-environment jsdom

// The per-individual "Top locations" block: rendering, the reveal, the two
// degenerate shapes (one location, none), and the hotspot-vs-personal split.
// The ranking maths itself is covered in lib/namedBirds.test.ts.

import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react'

import { NamedBirdLocations } from './NamedBirdLocations'
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

/** One named bird's sightings: `spec` is [location, locationId, howManyChecklists]. */
function sightingsFor(spec: [string, string, number][]) {
  let n = 0
  const rows: ObservationEntry[] = []
  for (const [location, locationId, times] of spec) {
    for (let i = 0; i < times; i++) {
      rows.push(obs({ submissionId: `S${++n}`, location, locationId, speciesComments: '[name:Winky]' }))
    }
  }
  return computeNamedBirds(rows)[0].sightings
}

const noHotspots = () => false
const allHotspots = () => true

describe('NamedBirdLocations', () => {
  it('renders the ranked locations with their counts, most-recorded first', () => {
    render(<NamedBirdLocations
      sightings={sightingsFor([['Lake Merritt', 'L1', 3], ['Arrowhead Marsh', 'L2', 1]])}
      isHotspot={noHotspots}
    />)
    expect(screen.getByText('Top locations')).toBeTruthy()
    expect(screen.getByText('Lake Merritt')).toBeTruthy()
    expect(screen.getByText('3 sightings')).toBeTruthy()
    // Singular for a single sighting, matching the card header's own wording.
    expect(screen.getByText('1 sighting')).toBeTruthy()
  })

  it('ranks by THIS individual, not the species — an unnamed pile elsewhere does not win', () => {
    const rows = [
      obs({ submissionId: 'S1', location: 'Lake Merritt', locationId: 'L1', speciesComments: '[name:Winky]' }),
      obs({ submissionId: 'S2', location: 'Lake Merritt', locationId: 'L1', speciesComments: '[name:Winky]' }),
      obs({ submissionId: 'S3', location: 'Berkeley Marina', locationId: 'L3', speciesComments: '[name:Winky]' }),
      // Same species, no name tag, recorded far more often at Berkeley Marina.
      ...Array.from({ length: 6 }, (_, i) => obs({ submissionId: `X${i}`, location: 'Berkeley Marina', locationId: 'L3', speciesComments: 'drake' })),
    ]
    const winky = computeNamedBirds(rows)[0]
    const { container } = render(<NamedBirdLocations sightings={winky.sightings} isHotspot={noHotspots} />)
    const ranks = [...container.querySelectorAll('div')].filter(d => /^\d+\.$/.test(d.textContent ?? ''))
    expect(ranks.length).toBe(0) // ranks are spans, not divs — sanity on the query below
    expect(screen.getByText('2 sightings')).toBeTruthy()
    // Berkeley Marina is Winky's third-ranked place with ONE sighting, not seven.
    expect(screen.getByText('1 sighting')).toBeTruthy()
    expect(screen.queryByText('7 sightings')).toBeNull()
  })

  it('shows five rows, then reveals the rest through the expander', () => {
    const spec: [string, string, number][] = [
      ['Alpha Pond', 'L1', 7], ['Bravo Marsh', 'L2', 6], ['Charlie Creek', 'L3', 5],
      ['Delta Slough', 'L4', 4], ['Echo Beach', 'L5', 3], ['Foxtrot Flats', 'L6', 2],
      ['Golf Course Pond', 'L7', 1],
    ]
    render(<NamedBirdLocations sightings={sightingsFor(spec)} isHotspot={noHotspots} />)

    expect(screen.getByText('Echo Beach')).toBeTruthy()
    expect(screen.queryByText('Foxtrot Flats')).toBeNull()

    const toggle = screen.getByRole('button', { name: /show all 7 locations/i })
    expect(toggle.getAttribute('aria-expanded')).toBe('false')

    fireEvent.click(toggle)
    expect(screen.getByText('Foxtrot Flats')).toBeTruthy()
    expect(screen.getByText('Golf Course Pond')).toBeTruthy()
    expect(toggle.getAttribute('aria-expanded')).toBe('true')

    fireEvent.click(screen.getByRole('button', { name: /show top 5/i }))
    expect(screen.queryByText('Foxtrot Flats')).toBeNull()
  })

  it('has no expander at exactly five locations', () => {
    const spec: [string, string, number][] = [
      ['Alpha Pond', 'L1', 5], ['Bravo Marsh', 'L2', 4], ['Charlie Creek', 'L3', 3],
      ['Delta Slough', 'L4', 2], ['Echo Beach', 'L5', 1],
    ]
    render(<NamedBirdLocations sightings={sightingsFor(spec)} isHotspot={noHotspots} />)
    expect(screen.getByText('Echo Beach')).toBeTruthy()
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('renders a sentence, not a ranking of one, for a single-location bird', () => {
    render(<NamedBirdLocations
      sightings={sightingsFor([['Home — patio feeders', '', 6]])}
      isHotspot={noHotspots}
    />)
    expect(screen.getByText('Every sighting at')).toBeTruthy()
    expect(screen.getByText('Home — patio feeders')).toBeTruthy()
    // No ranking furniture and no count pill.
    expect(screen.queryByText('1.')).toBeNull()
    expect(screen.queryByText('6 sightings')).toBeNull()
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('renders nothing at all when no sighting carries a location name', () => {
    const { container } = render(<NamedBirdLocations
      sightings={sightingsFor([['', '', 3]])}
      isHotspot={noHotspots}
    />)
    expect(container.firstChild).toBeNull()
    expect(screen.queryByText('Top locations')).toBeNull()
  })

  it('links a public hotspot and leaves a personal location as plain text', () => {
    const sightings = sightingsFor([['Lake Merritt', 'L1', 2], ['Back fence', 'L2', 1]])
    render(<NamedBirdLocations
      sightings={sightings}
      isHotspot={(locId) => locId === 'L1'}
    />)
    const link = screen.getByRole('link', { name: /open lake merritt on ebird/i })
    expect(link.getAttribute('href')).toBe('https://ebird.org/hotspot/L1')
    expect(screen.queryByRole('link', { name: /back fence/i })).toBeNull()
    expect(screen.getByText('Back fence')).toBeTruthy()
  })

  it('links the single-location sentence when that one place is a hotspot', () => {
    render(<NamedBirdLocations
      sightings={sightingsFor([['Arrowhead Marsh', 'L7', 4]])}
      isHotspot={allHotspots}
    />)
    const link = screen.getByRole('link', { name: /open arrowhead marsh on ebird/i })
    expect(link.getAttribute('href')).toBe('https://ebird.org/hotspot/L7')
  })

  it('numbers the visible rows from 1 in rank order', () => {
    const { container } = render(<NamedBirdLocations
      sightings={sightingsFor([['Alpha Pond', 'L1', 3], ['Bravo Marsh', 'L2', 2], ['Charlie Creek', 'L3', 1]])}
      isHotspot={noHotspots}
    />)
    const rows = [...container.querySelectorAll('div')].filter(d => /^\d+\.$/.test(d.firstChild?.textContent ?? ''))
    expect(rows.map(r => within(r).getByText(/^\d+\.$/).textContent)).toEqual(['1.', '2.', '3.'])
  })
})
