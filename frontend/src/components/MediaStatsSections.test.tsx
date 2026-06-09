// @vitest-environment jsdom
//
// Smoke + content test for the richer Media-card sections. Renders against a
// computeMediaStats result (the real data shape) and asserts the section
// headings and key figures appear, plus the empty-state null render. Guards
// against runtime render crashes in the demographic/behavior/time-of-day JSX.

import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { MediaStatsSections } from './MediaStatsSections'
import { computeMediaStats } from '../lib/mediaStats'
import type { MLExportRow } from '../lib/parseMLExport'

afterEach(cleanup)

function row(p: Partial<MLExportRow> & { catalogId: string }): MLExportRow {
  return {
    commonName: 'American Robin', scientificName: 'Turdus migratorius',
    format: 'Photo', date: '2024-05-01', location: 'Loc', county: null,
    latitude: null, longitude: null, caption: '', mediaNotes: '', observationDetails: '',
    ageSex: '', behaviors: '', time: '', year: null, month: null, avgRating: null, numRatings: 0,
    ...p,
  }
}

const rows: MLExportRow[] = [
  row({ catalogId: '1', commonName: 'American Robin', format: 'Photo', date: '2024-05-01', ageSex: 'Adult – 1', behaviors: 'Foraging or Eating', time: '643' }),
  row({ catalogId: '2', commonName: 'American Robin', format: 'Audio', date: '2024-05-01', behaviors: 'Song', time: '700' }),
  row({ catalogId: '3', commonName: 'Bald Eagle', format: 'Photo', date: '2024-05-02', ageSex: 'Adult – 1; Juvenile – 1', behaviors: 'Flying; Carrying Food', time: '1030' }),
  ...Array.from({ length: 10 }, (_, i) =>
    row({ catalogId: `r${i}`, commonName: 'Osprey', format: 'Photo', date: '2024-06-10', avgRating: 4.5, numRatings: 3, ageSex: 'Adult Male – 1' })),
]

const renderName = (name: string) => <span>{name}</span>

describe('MediaStatsSections', () => {
  it('renders the section headings and headline figures', () => {
    const stats = computeMediaStats(rows, new Set(['american robin', 'bald eagle', 'osprey', 'mallard']))
    render(<MediaStatsSections stats={stats} renderName={renderName} />)
    expect(screen.getByText('At a glance')).toBeTruthy()
    expect(screen.getByText('Documentation coverage')).toBeTruthy()
    expect(screen.getByText('Photos Tagged With Age or Gender')).toBeTruthy()
    expect(screen.getByText('Behaviors documented')).toBeTruthy()
    expect(screen.getByText('When you capture media')).toBeTruthy()
  })

  it('does not render the removed Community ratings or Format coverage sections', () => {
    // rows include 10 community-rated assets, yet the ratings section stays removed.
    const stats = computeMediaStats(rows, new Set(['american robin', 'bald eagle', 'osprey']))
    render(<MediaStatsSections stats={stats} renderName={renderName} />)
    expect(screen.queryByText('Community ratings')).toBeNull()
    expect(screen.queryByText('Format coverage')).toBeNull()
  })

  it('renders nothing when there is no media', () => {
    const empty = computeMediaStats([])
    const { container } = render(<MediaStatsSections stats={empty} renderName={renderName} />)
    expect(container.firstChild).toBeNull()
  })

  it('shows the age-coverage list with its sort toggle when young birds are documented', () => {
    // The base fixture documents a Bald Eagle juvenile, so youngSpecies is non-empty.
    const stats = computeMediaStats(rows, new Set(['american robin', 'bald eagle', 'osprey']))
    render(<MediaStatsSections stats={stats} renderName={renderName} />)
    expect(screen.getByText('Age coverage by species')).toBeTruthy()
    expect(screen.getByRole('group', { name: 'Sort age coverage' })).toBeTruthy()
  })

  it('still shows the adults-only note when no young birds are documented', () => {
    // Every aged asset is an adult — youngSpecies is empty, but onlyAdults is not.
    // The note must survive the empty young-species list (regression guard).
    const adultsOnly: MLExportRow[] = Array.from({ length: 4 }, (_, i) =>
      row({ catalogId: `a${i}`, commonName: 'Osprey', format: 'Photo', date: '2024-06-10', ageSex: 'Adult – 1' }))
    const stats = computeMediaStats(adultsOnly)
    render(<MediaStatsSections stats={stats} renderName={renderName} />)
    expect(screen.getByText('Age coverage by species')).toBeTruthy()
    expect(screen.getByText(/documented only as adults so far/)).toBeTruthy()
    // No young species → no list, so no sort toggle.
    expect(screen.queryByRole('group', { name: 'Sort age coverage' })).toBeNull()
  })
})
