import { describe, it, expect } from 'vitest'
import type { ObservationEntry } from '../types'
import {
  buildCountyAggregates, computeCountyTiers, countyMetricValue, nonZeroMetricValues,
} from './countyShading'
import { computeChecklists, computeGeo } from './birdingStats'
import { countyKey } from './countyBoundaries'

function obs(p: Partial<ObservationEntry> & { submissionId: string; commonName: string; date: string }): ObservationEntry {
  return {
    scientificName: 'Sci name',
    location: 'Loc', locationId: 'L1',
    latitude: null, longitude: null, county: null,
    count: 1, breedingCode: null, speciesComments: '', catalogIds: [],
    ...p,
  }
}

describe('buildCountyAggregates', () => {
  const rows = [
    // Monterey, CA — 3 checklists across 2 locations
    obs({ submissionId: 'S1', commonName: 'California Scrub-Jay', date: '2024-01-01', locationId: 'LP', location: 'Point Pinos', county: 'Monterey', stateProvince: 'US-CA' }),
    obs({ submissionId: 'S1', commonName: "Anna's Hummingbird", date: '2024-01-01', locationId: 'LP', location: 'Point Pinos', county: 'Monterey', stateProvince: 'US-CA' }),
    obs({ submissionId: 'S2', commonName: 'California Scrub-Jay', date: '2024-01-02', locationId: 'LP', location: 'Point Pinos', county: 'Monterey', stateProvince: 'US-CA' }),
    obs({ submissionId: 'S3', commonName: 'Spotted Towhee', date: '2024-01-03', locationId: 'LC', location: 'Carmel River SB', county: 'Monterey', stateProvince: 'US-CA' }),
    // Alameda, CA — 1 checklist
    obs({ submissionId: 'S4', commonName: 'Mallard', date: '2024-01-04', locationId: 'LA', location: 'Lake Merritt', county: 'Alameda', stateProvince: 'US-CA' }),
    // Ontario, Canada — non-US, must be excluded (FR-26)
    obs({ submissionId: 'S5', commonName: 'Blue Jay', date: '2024-01-05', locationId: 'LO', location: 'Toronto', county: 'Toronto', stateProvince: 'CA-ON' }),
  ]
  const aggs = buildCountyAggregates(rows, computeChecklists(rows))
  const monterey = aggs.get(countyKey('CA', 'Monterey'))!

  it('computes species (distinct) and records (checklist) totals per county', () => {
    expect(monterey.species).toBe(3)  // Scrub-Jay, Hummingbird, Towhee
    expect(monterey.records).toBe(3)  // S1, S2, S3
    expect(monterey.stateProvince).toBe('US-CA')
    expect(monterey.county).toBe('Monterey')
  })

  it('emits top-3 species by record count (ties broken by name)', () => {
    expect(monterey.topSpecies.map(s => [s.commonName, s.count])).toEqual([
      ['California Scrub-Jay', 2],
      ["Anna's Hummingbird", 1], // tie with Towhee → name order
      ['Spotted Towhee', 1],
    ])
  })

  it('emits top-3 locations by checklist count', () => {
    expect(monterey.topLocations.map(l => [l.name, l.count])).toEqual([
      ['Point Pinos', 2],
      ['Carmel River SB', 1],
    ])
  })

  it('excludes non-US counties (no key → never shaded)', () => {
    expect([...aggs.values()].some(a => a.county === 'Toronto')).toBe(false)
    expect(aggs.has(countyKey('CA', 'Alameda'))).toBe(true)
  })

  it('groups subspecies under the parent species name for the top list', () => {
    const r2 = [
      obs({ submissionId: 'T1', commonName: 'Yellow-rumped Warbler (Myrtle)', date: '2024-01-01', county: 'Marin', stateProvince: 'US-CA', locationId: 'M1' }),
      obs({ submissionId: 'T2', commonName: "Yellow-rumped Warbler (Audubon's)", date: '2024-01-02', county: 'Marin', stateProvince: 'US-CA', locationId: 'M1' }),
    ]
    const marin = buildCountyAggregates(r2, computeChecklists(r2)).get(countyKey('CA', 'Marin'))!
    expect(marin.species).toBe(1)
    expect(marin.topSpecies).toEqual([{ commonName: 'Yellow-rumped Warbler', scientificName: 'Sci name', count: 2 }])
  })

  it('species/records totals match computeGeo for the same US county (parity — QA-09)', () => {
    const geo = computeGeo(computeChecklists(rows), rows)
    for (const [, agg] of aggs) {
      const row = geo.topCounties.find(c => c.name === agg.county && c.stateProvince === agg.stateProvince)!
      expect(agg.records).toBe(row.count)
      expect(agg.species).toBe(row.species)
    }
  })
})

describe('computeCountyTiers', () => {
  it('maps a spread of values onto 4 quantile classes', () => {
    const t = computeCountyTiers([10, 20, 30, 40, 50, 60, 70, 80], 4)
    expect(t.breaks).toEqual([20, 40, 60, 80])
    expect(t.tierFor(10)).toBe(1)
    expect(t.tierFor(21)).toBe(2)
    expect(t.tierFor(80)).toBe(4)
    expect(t.legend).toEqual([
      { tier: 1, min: 10, max: 20 },
      { tier: 2, min: 21, max: 40 },
      { tier: 3, min: 41, max: 60 },
      { tier: 4, min: 61, max: 80 },
    ])
  })

  it('collapses ties to fewer classes — no empty or duplicate ranges (FR-11)', () => {
    const t = computeCountyTiers([1, 2, 2, 2, 2, 3], 4)
    expect(t.breaks).toEqual([2, 3]) // 3 quantile cuts dedupe to 2 classes
    expect(t.legend).toEqual([
      { tier: 1, min: 1, max: 2 },
      { tier: 2, min: 3, max: 3 },
    ])
  })

  it('yields fewer classes than maxClasses on a small dataset', () => {
    const t = computeCountyTiers([10, 20], 4)
    expect(t.breaks).toEqual([10, 20])
    expect(t.legend).toHaveLength(2)
  })

  it('produces a single class when all values are equal', () => {
    const t = computeCountyTiers([5, 5, 5], 4)
    expect(t.breaks).toEqual([5])
    expect(t.tierFor(5)).toBe(1)
    expect(t.legend).toEqual([{ tier: 1, min: 5, max: 5 }])
  })

  it('returns an empty model for zero non-zero counties (FR-14)', () => {
    const t = computeCountyTiers([], 4)
    expect(t.breaks).toEqual([])
    expect(t.legend).toEqual([])
    expect(t.tierFor(0)).toBe(0)
    expect(t.tierFor(99)).toBe(0)
  })

  it('ignores zero/negative inputs and tierFor(0) is 0 (unrecorded county)', () => {
    const t = computeCountyTiers([0, 0, 5, 10], 4)
    expect(t.breaks).toEqual([5, 10])
    expect(t.tierFor(0)).toBe(0)
    expect(t.tierFor(5)).toBe(1)
    expect(t.tierFor(10)).toBe(2)
  })
})

describe('metric selection', () => {
  it('countyMetricValue reads the active metric', () => {
    const agg = { stateProvince: 'US-CA', county: 'X', species: 12, records: 40, topSpecies: [], topLocations: [] }
    expect(countyMetricValue(agg, 'species')).toBe(12)
    expect(countyMetricValue(agg, 'records')).toBe(40)
  })

  it('nonZeroMetricValues collects the active metric over non-zero counties', () => {
    const m = new Map([
      ['a', { stateProvince: 'US-CA', county: 'A', species: 5, records: 10, topSpecies: [], topLocations: [] }],
      ['b', { stateProvince: 'US-CA', county: 'B', species: 0, records: 3, topSpecies: [], topLocations: [] }],
    ])
    expect(nonZeroMetricValues(m, 'species').sort((x, y) => x - y)).toEqual([5])
    expect(nonZeroMetricValues(m, 'records').sort((x, y) => x - y)).toEqual([3, 10])
  })
})
