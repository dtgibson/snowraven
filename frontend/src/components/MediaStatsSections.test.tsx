// @vitest-environment jsdom
//
// Smoke + content test for the richer Media-card sections. Renders against a
// computeMediaStats result (the real data shape) and asserts the section
// headings and key figures appear, plus the empty-state null render. Guards
// against runtime render crashes in the demographic/behavior/time-of-day JSX.

import { describe, it, expect, afterEach, afterAll } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { MediaStatsSections } from './MediaStatsSections'
import { computeMediaStats } from '../lib/mediaStats'
import type { MLExportRow } from '../lib/parseMLExport'

afterEach(cleanup)

// recharts bundles @reduxjs/toolkit, whose autoBatch enhancer arms a 100 ms
// fallback timer when a chart mounts. Wait it out BEFORE this file's jsdom
// environment is torn down, so the timer fires where `cancelAnimationFrame`
// still exists — the node-env shim in test-setup.ts never installs in jsdom
// files, so a timer leaking past teardown lands in an environment with neither
// jsdom's cAF nor the shim and fails the run as an unhandled ReferenceError
// pinned to whatever file runs next.
afterAll(() => new Promise((r) => setTimeout(r, 120)))

function row(p: Partial<MLExportRow> & { catalogId: string }): MLExportRow {
  return {
    commonName: 'American Robin', scientificName: 'Turdus migratorius',
    format: 'Photo', date: '2024-05-01', location: 'Loc', county: null,
    latitude: null, longitude: null, caption: '', mediaNotes: '', observationDetails: '',
    ageSex: '', behaviors: '', time: '', year: null, month: null, avgRating: null, numRatings: 0,
    checklistId: '',
    ...p,
  }
}

const rows: MLExportRow[] = [
  row({ catalogId: '1', commonName: 'American Robin', format: 'Photo', date: '2024-05-01', ageSex: 'Adult – 1', behaviors: 'Foraging or Eating', time: '643' }),
  row({ catalogId: '2', commonName: 'American Robin', format: 'Audio', date: '2024-05-01', behaviors: 'Song', time: '700' }),
  row({ catalogId: '3', commonName: 'Bald Eagle', format: 'Photo', date: '2024-05-02', ageSex: 'Adult – 1; Juvenile – 1', behaviors: 'Flying; Carrying Food', time: '1030' }),
  ...Array.from({ length: 10 }, (_, i) =>
    row({ catalogId: `r${i}`, commonName: 'Osprey', format: 'Photo', date: '2024-06-10', avgRating: 4.5, numRatings: 3, ageSex: 'Adult Male – 1', checklistId: 'S100' })),
]

const renderName = (name: string) => <span>{name}</span>

describe('MediaStatsSections', () => {
  it('renders the section headings and headline figures', () => {
    const stats = computeMediaStats(rows, new Set(['american robin', 'bald eagle', 'osprey', 'mallard']))
    render(<MediaStatsSections stats={stats} renderName={renderName} />)
    expect(screen.getByText('At a glance')).toBeTruthy()
    expect(screen.getByText('Documentation coverage')).toBeTruthy()
    expect(screen.getByText('Photos Tagged With Age or Sex')).toBeTruthy()
    expect(screen.getByText('Behaviors documented')).toBeTruthy()
    expect(screen.getByText('When you capture media')).toBeTruthy()
  })

  it('renders busiest-day, longest-streak, and archive-span as equal-height tiles', () => {
    // Fixture: busiest day is 2024-06-10 (10 assets); May 1–2 makes a 2-day
    // streak; the archive spans May 1 – Jun 10 (41 days).
    const stats = computeMediaStats(rows, new Set(['american robin', 'bald eagle', 'osprey']))
    render(<MediaStatsSections stats={stats} renderName={renderName} />)
    expect(screen.getByText('Busiest day')).toBeTruthy()
    // The busiest-day date links to that day's (dominant) eBird checklist.
    const dayLink = screen.getByText('Jun 10, 2024').closest('a')!
    expect(dayLink).toBeTruthy()
    expect(dayLink.getAttribute('href')).toBe('https://ebird.org/checklist/S100')
    expect(dayLink.getAttribute('rel')).toContain('noreferrer')
    // WCAG 2.5.3: the visible date must be part of the accessible name.
    expect(dayLink.getAttribute('aria-label')).toContain('Jun 10, 2024')
    expect(screen.getByText('Longest streak')).toBeTruthy()
    expect(screen.getByText('2 days')).toBeTruthy()
    expect(screen.getByText('May 1 – 2, 2024')).toBeTruthy() // the streak's own dates
    expect(screen.getByText('Archive span')).toBeTruthy()
    expect(screen.getByText('41 days')).toBeTruthy()
    expect(screen.getByText('May 1 – Jun 10, 2024')).toBeTruthy()
    // No floating caption below the grid anymore.
    expect(screen.queryByText(/^Spanning /)).toBeNull()
    expect(screen.queryByText('days in a row')).toBeNull()
    // Every tile reserves the sub-line slot (value + sub + label spans), so the
    // auto-fit grid can't misalign rows that mix tiles with and without a sub.
    const grid = screen.getByText('Total media').closest('div')!.parentElement!
    expect(grid.children.length).toBe(8)
    for (const cell of Array.from(grid.children)) {
      expect(cell.querySelectorAll('span').length).toBe(3)
    }
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

  it('links each behavior count to the Macaulay Library catalog when a userId is present', () => {
    const stats = computeMediaStats(rows)
    render(<MediaStatsSections stats={stats} renderName={renderName} userId="USER4741544" />)
    // "Flying" is in the fixture (row 3); its count deep-links to that behavior tag.
    const link = screen.getByRole('link', { name: /Flying media in the Macaulay Library/i })
    expect(link.getAttribute('href')).toBe('https://media.ebird.org/catalog?userId=USER4741544&tag=flying_flight')
    expect(link.getAttribute('target')).toBe('_blank')
    expect(link.getAttribute('rel')).toContain('noreferrer')
  })

  it('renders behavior counts as plain text when there is no userId', () => {
    const stats = computeMediaStats(rows)
    render(<MediaStatsSections stats={stats} renderName={renderName} />)
    expect(screen.getByText('Behaviors documented')).toBeTruthy()
    expect(screen.queryByRole('link', { name: /media in the Macaulay Library/i })).toBeNull()
  })

  it('lists each breeding behavior as its own Macaulay Library link', () => {
    const stats = computeMediaStats(rows)
    render(<MediaStatsSections stats={stats} renderName={renderName} userId="USER4741544" />)
    expect(screen.getByText('Your media by breeding behavior:')).toBeTruthy()
    // "Carrying Food" is a breeding behavior in the fixture; it gets its own tag link
    // in the breeding list and is dropped from the top-behaviors list (no duplicate).
    const links = screen.getAllByRole('link', { name: /Carrying Food media in the Macaulay Library/i })
    expect(links).toHaveLength(1)
    expect(links[0].getAttribute('href')).toBe('https://media.ebird.org/catalog?userId=USER4741544&tag=carrying_food')
  })

  it('drops a breeding behavior from the top "Behaviors documented" list once it is shown in the breeding list', () => {
    const stats = computeMediaStats(rows)
    // "Song" is a breeding (possible) behavior in the fixture. With a userId it should
    // appear once — in the breeding list — and not in the top-behaviors list.
    render(<MediaStatsSections stats={stats} renderName={renderName} userId="USER4741544" />)
    expect(screen.getAllByRole('link', { name: /Song media in the Macaulay Library/i })).toHaveLength(1)
  })
})
