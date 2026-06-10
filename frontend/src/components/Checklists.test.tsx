// @vitest-environment jsdom
//
// Integration coverage for the Checklists tab's user-visible contracts: the
// setup gate, the weather/tide toggle's default-hidden behavior across display
// and search (PRD FR-04/05/06/07), the per-box expanders, and the list's
// filter/count wiring. Pure logic is covered in lib/checklistsTab.test.ts —
// these tests are about the component composing it correctly.

import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import type { ObservationEntry } from '../types'
import { formatWeather, type HourlyResponse } from '../lib/weatherFormatter'

const hour: HourlyResponse = {
  data: [{
    temp: 64, humidity: 72, dew_point: 55, wind_speed: 6, wind_deg: 250,
    clouds: 20, weather: [{ id: 801, description: 'few clouds' }],
    sunrise: 1716550000, sunset: 1716600000,
  }],
}
const WEATHER_BLOCK = formatWeather([hour], 'America/Los_Angeles')

function obs(over: Partial<ObservationEntry>): ObservationEntry {
  return {
    submissionId: 'S100',
    commonName: 'Snowy Egret',
    scientificName: 'Egretta thula',
    date: '2026-05-01',
    location: 'West Pond',
    locationId: 'L1',
    latitude: null,
    longitude: null,
    county: 'Stanislaus',
    count: 1,
    breedingCode: null,
    speciesComments: '',
    catalogIds: [],
    time: '7:00 AM',
    duration: 60,
    distance: 2,
    area: null,
    protocol: 'P22',
    numObservers: 1,
    allObsReported: true,
    checklistComments: '',
    stateProvince: 'US-CA',
    ...over,
  }
}

const observations: ObservationEntry[] = [
  obs({
    submissionId: 'S1', date: '2026-05-24', location: 'Oak Trail',
    checklistComments: `Singing chat by the river.\n\n${WEATHER_BLOCK}`,
    speciesComments: 'Adult light morph on tower 4.',
  }),
  obs({
    submissionId: 'S2', date: '2026-03-30', location: 'Beckwith Road',
    checklistComments: 'Mostly a tern check.',
  }),
  obs({
    submissionId: 'S3', date: '2026-04-27', location: 'Modesto WTP',
    checklistComments: WEATHER_BLOCK, // block-only — the FR-07 case
  }),
]

let filesStatus: { ebird: unknown; ml: unknown } = { ebird: { filename: 'x.csv', uploadedAt: '' }, ml: null }

vi.mock('../lib/storage', () => ({
  storage: { getFilesStatus: vi.fn(async () => filesStatus) },
}))
vi.mock('../lib/observationsCache', () => ({
  loadEbirdObservations: vi.fn(async () => ({ text: '', observations })),
}))
vi.mock('../lib/mlExportCache', () => ({
  loadMLExport: vi.fn(async () => null),
}))
vi.mock('../lib/transport', () => ({
  transport: { post: vi.fn(async () => ({ codes: {}, orders: {} })) },
}))

import { Checklists } from './Checklists'

const props = { onGoToSettings: () => {}, onOpenSpecies: undefined }

beforeEach(() => {
  filesStatus = { ebird: { filename: 'x.csv', uploadedAt: '' }, ml: null }
})
afterEach(cleanup)

describe('Checklists tab', () => {
  it('shows the setup gate when no eBird backup is stored (QA-02)', async () => {
    filesStatus = { ebird: null, ml: null }
    render(<Checklists {...props} />)
    expect(await screen.findByText('eBird Backup Required')).toBeTruthy()
  })

  it('renders all three sections once loaded', async () => {
    render(<Checklists {...props} />)
    expect(await screen.findByText('Checklist Comments')).toBeTruthy()
    expect(screen.getByText('Species Comments')).toBeTruthy()
    expect(screen.getByText('All Checklists')).toBeTruthy()
  })

  it('hides weather blocks by default and the toggle restores them (QA-03/04)', async () => {
    render(<Checklists {...props} />)
    await screen.findByText('Checklist Comments')
    // stripped everywhere: no "Temperature:" anywhere on the tab
    expect(screen.queryAllByText(/Temperature:/)).toHaveLength(0)
    expect(screen.getAllByText(/Singing chat by the river\./).length).toBeGreaterThan(0)

    fireEvent.click(screen.getByRole('switch', { name: /Show weather & tide blocks/ }))
    expect(screen.getAllByText(/Temperature:/).length).toBeGreaterThan(0)
  })

  it('a block-only comment is absent while hidden and appears when shown (QA-06)', async () => {
    render(<Checklists {...props} />)
    await screen.findByText('Checklist Comments')
    // hidden: S1 + S2 → "2 comments"; shown: S3 joins → "3 comments"
    expect(screen.getByText('2 comments')).toBeTruthy()
    fireEvent.click(screen.getByRole('switch', { name: /Show weather & tide blocks/ }))
    expect(screen.getByText('3 comments')).toBeTruthy()
  })

  it('search matches what you see: a block-only term finds nothing while hidden (QA-05)', async () => {
    render(<Checklists {...props} />)
    await screen.findByText('Checklist Comments')
    const input = screen.getByPlaceholderText('Filter checklist comments…')
    fireEvent.change(input, { target: { value: 'Humidity' } })
    expect(screen.getByText('No checklist comments match this filter.')).toBeTruthy()

    fireEvent.click(screen.getByRole('switch', { name: /Show weather & tide blocks/ }))
    expect(screen.queryByText('No checklist comments match this filter.')).toBeNull()
  })

  it('renders checklist rows with protocol names, counts, and a count label (QA-09/12)', async () => {
    render(<Checklists {...props} />)
    await screen.findByText('All Checklists')
    expect(screen.getByText('3 checklists')).toBeTruthy()
    expect(screen.getAllByText('Traveling').length).toBeGreaterThan(0)

    // cycle the "Checklist comment" pill to HAS: with blocks hidden the
    // block-only checklist (S3) doesn't count (FR-07) → 2 of 3
    fireEvent.click(screen.getByRole('button', { name: 'Checklist comment' }))
    expect(screen.getByText('2 of 3 checklists')).toBeTruthy()
  })

  it('species comments box lists entries across species with their names', async () => {
    render(<Checklists {...props} />)
    await screen.findByText('Species Comments')
    expect(screen.getByText(/Adult light morph on tower 4\./)).toBeTruthy()
    expect(screen.getAllByText('Snowy Egret').length).toBeGreaterThan(0)
  })

  it('a junk submission id renders its date as plain text, never a link (QA-14)', async () => {
    observations.push(obs({
      submissionId: 'not-a-real-id" onmouseover="x', date: '2026-02-02', location: 'Junk Pond',
      checklistComments: 'Comment on a checklist with a malformed id.',
    }))
    try {
      render(<Checklists {...props} />)
      await screen.findByText('Checklist Comments')
      // the entry renders (comment box + list row), but no anchor ever carries the junk id
      expect(screen.getAllByText(/malformed id/).length).toBeGreaterThan(0)
      expect(document.querySelector('a[href*="not-a-real-id"]')).toBeNull()
      // valid ids elsewhere still link
      expect(document.querySelector('a[href="https://ebird.org/checklist/S1"]')).not.toBeNull()
    } finally {
      observations.pop()
    }
  })

  it('renders comment text exactly once-decoded — no double entity decode (security review)', async () => {
    observations.push(obs({
      submissionId: 'S88', date: '2026-01-15', location: 'Pond',
      checklistComments: 'Wrote &amp;lt;3 today',
    }))
    try {
      render(<Checklists {...props} />)
      await screen.findByText('Checklist Comments')
      // once-decoded: "&amp;lt;" → "&lt;" shown literally; a double decode would show "<3"
      expect(screen.getAllByText(/Wrote &lt;3 today/).length).toBeGreaterThan(0)
    } finally {
      observations.pop()
    }
  })

  it('without an ML export the media-type pills are absent (QA-11)', async () => {
    render(<Checklists {...props} />)
    await screen.findByText('All Checklists')
    expect(screen.queryByRole('button', { name: 'Photo' })).toBeNull()
    // generic media tri-state still present
    expect(screen.getByRole('button', { name: 'Media' })).toBeTruthy()
  })
})
