import { describe, it, expect } from 'vitest'
import type { ObservationEntry } from '../types'
import {
  computeSightingsStats, computeMediaCounts, computeRecentMediaIds,
  computeBreedingPill, computeBreedingBreakdown, computeLocationsSorted, computeCoOccurrence,
} from './speciesStats'

function obs(p: Partial<ObservationEntry> & { submissionId: string; commonName: string; date: string }): ObservationEntry {
  return {
    scientificName: '',
    location: 'Loc', locationId: 'L1',
    latitude: null, longitude: null, county: null,
    count: 1, breedingCode: null, speciesComments: '', catalogIds: [],
    ...p,
  }
}

describe('computeSightingsStats', () => {
  it('returns null with no observations', () => {
    expect(computeSightingsStats([])).toBeNull()
  })
  it('totals individuals (excluding X), tracks best count + first/last by date', () => {
    const rows = [
      obs({ submissionId: 'S2', commonName: 'Robin', date: '2024-03-01', count: 2 }),
      obs({ submissionId: 'S1', commonName: 'Robin', date: '2024-01-01', count: null }), // X
      obs({ submissionId: 'S3', commonName: 'Robin', date: '2024-06-01', count: 5 }),
    ]
    const s = computeSightingsStats(rows)!
    expect(s.total).toBe(3)
    expect(s.totalIndividuals).toBe(7)        // 2 + 5, X excluded
    expect(s.bestCount).toBe(5)
    expect(s.firstObs.date).toBe('2024-01-01')
    expect(s.lastObs.date).toBe('2024-06-01')
  })
})

describe('computeMediaCounts', () => {
  it('counts distinct catalog ids per media type', () => {
    const mediaMap = new Map<string, string>([['100', 'Photo'], ['101', 'Photo'], ['200', 'Audio']])
    const rows = [
      obs({ submissionId: 'S1', commonName: 'Robin', date: '2024-01-01', catalogIds: ['100', '200'] }),
      obs({ submissionId: 'S2', commonName: 'Robin', date: '2024-01-02', catalogIds: ['101', '100'] }), // 100 repeats
    ]
    expect(computeMediaCounts(rows, mediaMap)).toEqual({ Photo: 2, Audio: 1, Video: 0 })
  })
})

describe('computeRecentMediaIds', () => {
  it('keeps the highest numeric catalog id per media type', () => {
    const mediaMap = new Map<string, string>([['100', 'Photo'], ['250', 'Photo'], ['9', 'Audio']])
    const rows = [obs({ submissionId: 'S1', commonName: 'Robin', date: '2024-01-01', catalogIds: ['100', '250', '9'] })]
    expect(computeRecentMediaIds(rows, mediaMap)).toEqual({ Photo: '250', Audio: '9', Video: null })
  })
})

describe('computeBreedingPill', () => {
  it('reports the highest breeding category, or null', () => {
    expect(computeBreedingPill([obs({ submissionId: 'S1', commonName: 'Robin', date: '2024-05-01' })])).toBeNull()
    const rows = [
      obs({ submissionId: 'S1', commonName: 'Robin', date: '2024-05-01', breedingCode: 'S' }),  // tier 1
      obs({ submissionId: 'S2', commonName: 'Robin', date: '2024-06-01', breedingCode: 'NY' }), // tier 4
    ]
    expect(computeBreedingPill(rows)).toEqual({ tier: 4, category: 'Confirmed' })
  })
})

describe('computeBreedingBreakdown', () => {
  it('counts each code and sorts by tier descending', () => {
    const rows = [
      obs({ submissionId: 'S1', commonName: 'Robin', date: '2024-05-01', breedingCode: 'S' }),  // tier 1
      obs({ submissionId: 'S2', commonName: 'Robin', date: '2024-06-01', breedingCode: 'S' }),  // tier 1 (count 2)
      obs({ submissionId: 'S3', commonName: 'Robin', date: '2024-06-02', breedingCode: 'NY' }), // tier 4
    ]
    const b = computeBreedingBreakdown(rows)
    expect(b[0]).toMatchObject({ code: 'NY', tier: 4, count: 1 }) // highest tier first
    expect(b.find(x => x.code === 'S')).toMatchObject({ count: 2 })
  })
})

describe('computeLocationsSorted', () => {
  it('ranks locations by sighting count then name', () => {
    const rows = [
      obs({ submissionId: 'S1', commonName: 'Robin', date: '2024-01-01', location: 'Park', locationId: 'P' }),
      obs({ submissionId: 'S2', commonName: 'Robin', date: '2024-01-02', location: 'Park', locationId: 'P' }),
      obs({ submissionId: 'S3', commonName: 'Robin', date: '2024-01-03', location: 'Lake', locationId: 'K' }),
    ]
    const locs = computeLocationsSorted(rows)
    expect(locs[0]).toEqual({ location: 'Park', count: 2, locationId: 'P' })
    expect(locs[1]).toEqual({ location: 'Lake', count: 1, locationId: 'K' })
  })
})

describe('computeCoOccurrence', () => {
  it('returns null when no species is selected', () => {
    expect(computeCoOccurrence([], [], null, false)).toBeNull()
  })
  it('ranks species sharing the target species checklists (min 2 shared)', () => {
    const all = [
      obs({ submissionId: 'S1', commonName: 'American Robin', date: '2024-01-01' }),
      obs({ submissionId: 'S1', commonName: 'Blue Jay', date: '2024-01-01' }),
      obs({ submissionId: 'S2', commonName: 'American Robin', date: '2024-01-02' }),
      obs({ submissionId: 'S2', commonName: 'Blue Jay', date: '2024-01-02' }),
      obs({ submissionId: 'S3', commonName: 'American Robin', date: '2024-01-03' }),
      obs({ submissionId: 'S3', commonName: 'House Wren', date: '2024-01-03' }), // shares only once
    ]
    const robin = all.filter(o => o.commonName === 'American Robin')
    const co = computeCoOccurrence(all, robin, 'American Robin', false)
    expect(co?.type).toBe('results')
    if (co?.type === 'results') {
      expect(co.totalChecklists).toBe(3)
      expect(co.results).toEqual([{ name: 'Blue Jay', count: 2, pct: 67 }]) // Wren filtered (count 1)
    }
  })
})
