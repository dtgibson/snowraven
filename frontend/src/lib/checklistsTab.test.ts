import { describe, it, expect } from 'vitest'
import type { ObservationEntry } from '../types'
import {
  buildChecklistRows,
  buildChecklistComments,
  buildSpeciesComments,
  filterAndSortComments,
  filterChecklistRows,
  sortChecklistRows,
  isPillFilterClear,
  rowHasComment,
  CHECKLIST_FILTER_CLEAR,
  type ChecklistFilterState,
} from './checklistsTab'
import { formatWeather } from './weatherFormatter'
import type { HourlyResponse } from './weatherFormatter'

// Real weather block via the real formatter, so toggle semantics are tested
// against what the app actually pastes into checklist comments.
const hour: HourlyResponse = {
  data: [{
    dt: 1716570000, temp: 64, humidity: 72, dew_point: 55, wind_speed: 6, wind_deg: 250,
    clouds: 20, weather: [{ id: 801, description: 'few clouds' }],
    sunrise: 1716550000, sunset: 1716600000,
  }],
}
const WEATHER_BLOCK = formatWeather([hour], 'America/Los_Angeles', 33.7)

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

// S1: user note + pasted weather block, species comment, photo media, breeding.
// S2: plain note, no extras, incomplete, different county/protocol.
// S3: weather-block-ONLY comment (the FR-07 case), audio media.
// S4: no comment at all, unknown completeness.
const observations: ObservationEntry[] = [
  obs({
    submissionId: 'S1', date: '2026-05-24', location: 'Oak Trail',
    checklistComments: `Singing chat by the river.\n\n${WEATHER_BLOCK}`,
    speciesComments: 'Adult light morph on tower 4.',
    catalogIds: ['101'], breedingCode: 'NB',
  }),
  obs({
    submissionId: 'S1', date: '2026-05-24', location: 'Oak Trail',
    commonName: 'Great Horned Owl', scientificName: 'Bubo virginianus',
    checklistComments: `Singing chat by the river.\n\n${WEATHER_BLOCK}`,
    speciesComments: '', catalogIds: [],
  }),
  obs({
    submissionId: 'S2', date: '2026-03-30', location: 'Beckwith Road',
    county: 'Merced', protocol: 'P21', allObsReported: false,
    checklistComments: 'Mostly a tern check.',
  }),
  obs({
    submissionId: 'S3', date: '2026-04-27', location: 'Modesto WTP',
    checklistComments: WEATHER_BLOCK,
    catalogIds: ['202'],
  }),
  obs({
    submissionId: 'S4', date: '2026-01-01', location: 'Home Circle',
    allObsReported: null,
    speciesComments: 'The one-legged bird again. [name:one-leg-pete]',
  }),
]

const mediaMap: Record<string, string> = { '101': 'Photo', '202': 'Audio' }

const rows = buildChecklistRows(observations, mediaMap)
const byId = (id: string) => rows.find(r => r.checklist.submissionId === id)!

function filt(over: Partial<ChecklistFilterState>): ChecklistFilterState {
  return { ...CHECKLIST_FILTER_CLEAR, ...over }
}

describe('buildChecklistRows', () => {
  it('one row per checklist, with comments decoded and stripped variants', () => {
    expect(rows).toHaveLength(4)
    const s1 = byId('S1')
    expect(s1.commentFull).toContain('Temperature:')
    expect(s1.commentStripped).toBe('Singing chat by the river.')
    expect(byId('S3').commentStripped).toBe('')
  })

  it('derives the filter flags per checklist', () => {
    const s1 = byId('S1')
    expect(s1.hasSpeciesComments).toBe(true)
    expect(s1.hasAnyMedia).toBe(true)
    expect([...s1.mediaFormats]).toEqual(['Photo'])
    expect(s1.hasBreeding).toBe(true)
    expect(s1.weatherBlock).toBe(true)
    expect(s1.tideBlock).toBe(false)

    const s2 = byId('S2')
    expect(s2.hasSpeciesComments).toBe(false)
    expect(s2.hasAnyMedia).toBe(false)
    expect(s2.hasBreeding).toBe(false)
    expect(s2.weatherBlock).toBe(false)
  })

  it('without the ML export, hasAnyMedia still works and formats stay empty', () => {
    const noMl = buildChecklistRows(observations, null)
    const s1 = noMl.find(r => r.checklist.submissionId === 'S1')!
    expect(s1.hasAnyMedia).toBe(true)
    expect(s1.mediaFormats.size).toBe(0)
  })
})

describe('buildChecklistComments — toggle semantics (FR-05/07)', () => {
  it('hidden: text is stripped and a block-only comment is absent', () => {
    const entries = buildChecklistComments(rows, false)
    expect(entries.map(e => e.submissionId).sort()).toEqual(['S1', 'S2'])
    expect(entries.find(e => e.submissionId === 'S1')!.text).toBe('Singing chat by the river.')
  })

  it('shown: blocks are back and the block-only comment appears', () => {
    const entries = buildChecklistComments(rows, true)
    expect(entries.map(e => e.submissionId).sort()).toEqual(['S1', 'S2', 'S3'])
    expect(entries.find(e => e.submissionId === 'S1')!.text).toContain('Temperature:')
  })
})

describe('buildSpeciesComments', () => {
  it('one entry per commented observation, carrying the species', () => {
    const entries = buildSpeciesComments(observations, false)
    expect(entries).toHaveLength(2)
    expect(entries.map(e => e.commonName).sort()).toEqual(['Snowy Egret', 'Snowy Egret'])
    expect(entries.find(e => e.submissionId === 'S4')!.text).toContain('[name:one-leg-pete]')
  })
})

describe('filterAndSortComments — search matches what you see (FR-06)', () => {
  it('a block-only term matches nothing while hidden, but matches when shown', () => {
    const hidden = buildChecklistComments(rows, false)
    expect(filterAndSortComments(hidden, 'Humidity', 'newest')).toHaveLength(0)
    const shown = buildChecklistComments(rows, true)
    expect(filterAndSortComments(shown, 'Humidity', 'newest').length).toBeGreaterThan(0)
  })

  it('is case-insensitive and sorts by date both ways', () => {
    const entries = buildChecklistComments(rows, false)
    const newest = filterAndSortComments(entries, '', 'newest')
    expect(newest.map(e => e.submissionId)).toEqual(['S1', 'S2'])
    const oldest = filterAndSortComments(entries, '', 'oldest')
    expect(oldest.map(e => e.submissionId)).toEqual(['S2', 'S1'])
    expect(filterAndSortComments(entries, 'TERN', 'newest')).toHaveLength(1)
  })
})

describe('filterChecklistRows — AND composition (FR-19/20, QA-10)', () => {
  it('clear filter passes everything', () => {
    expect(filterChecklistRows(rows, CHECKLIST_FILTER_CLEAR, false)).toHaveLength(4)
    expect(isPillFilterClear(CHECKLIST_FILTER_CLEAR)).toBe(true)
  })

  it('"has breeding codes" + "no media" + complete composes with AND', () => {
    const f = filt({ breeding: 'has', media: 'no', complete: 'has' })
    expect(filterChecklistRows(rows, f, false)).toHaveLength(0)
    const g = filt({ breeding: 'has', media: 'has', complete: 'has' })
    expect(filterChecklistRows(rows, g, false).map(r => r.checklist.submissionId)).toEqual(['S1'])
  })

  it('checklist-comment tri-state is toggle-aware (FR-07)', () => {
    const f = filt({ checklistComment: 'has' })
    // hidden: S3's block-only comment counts as NO comment
    expect(filterChecklistRows(rows, f, false).map(r => r.checklist.submissionId).sort()).toEqual(['S1', 'S2'])
    // shown: S3 has a comment again
    expect(filterChecklistRows(rows, f, true).map(r => r.checklist.submissionId).sort()).toEqual(['S1', 'S2', 'S3'])
    expect(rowHasComment(byId('S3'), false)).toBe(false)
    expect(rowHasComment(byId('S3'), true)).toBe(true)
  })

  it('weather/tide block flags ignore the toggle (FR-08)', () => {
    const f = filt({ weatherBlock: 'has' })
    const hidden = filterChecklistRows(rows, f, false).map(r => r.checklist.submissionId).sort()
    const shown = filterChecklistRows(rows, f, true).map(r => r.checklist.submissionId).sort()
    expect(hidden).toEqual(['S1', 'S3'])
    expect(shown).toEqual(hidden)
  })

  it('complete tri-state: unknown completeness matches only when the filter is off', () => {
    expect(filterChecklistRows(rows, filt({ complete: 'has' }), false).map(r => r.checklist.submissionId).sort()).toEqual(['S1', 'S3'])
    expect(filterChecklistRows(rows, filt({ complete: 'no' }), false).map(r => r.checklist.submissionId)).toEqual(['S2'])
  })

  it('media-type tri-states use the ML join', () => {
    expect(filterChecklistRows(rows, filt({ photo: 'has' }), false).map(r => r.checklist.submissionId)).toEqual(['S1'])
    expect(filterChecklistRows(rows, filt({ audio: 'has' }), false).map(r => r.checklist.submissionId)).toEqual(['S3'])
    expect(filterChecklistRows(rows, filt({ photo: 'no', audio: 'no', video: 'no' }), false)).toHaveLength(2)
  })

  it('protocol, county, and date range filter as selects', () => {
    expect(filterChecklistRows(rows, filt({ protocol: 'P21' }), false).map(r => r.checklist.submissionId)).toEqual(['S2'])
    expect(filterChecklistRows(rows, filt({ county: 'Merced' }), false).map(r => r.checklist.submissionId)).toEqual(['S2'])
    const ranged = filterChecklistRows(rows, filt({ dateRange: { from: '2026-04-01', to: '2026-05-23' } }), false)
    expect(ranged.map(r => r.checklist.submissionId)).toEqual(['S3'])
  })
})

describe('sortChecklistRows', () => {
  it('newest first by default, oldest flips', () => {
    expect(sortChecklistRows(rows, 'newest').map(r => r.checklist.submissionId)).toEqual(['S1', 'S3', 'S2', 'S4'])
    expect(sortChecklistRows(rows, 'oldest').map(r => r.checklist.submissionId)).toEqual(['S4', 'S2', 'S3', 'S1'])
  })
})
