// The county picker's choices (targets-tab QA-05, QA-06, QA-07, QA-08).
import { describe, it, expect } from 'vitest'
import { buildCountyChoices, pickInitialCounty } from './targetsCounties'
import { COUNTY_UNAVAILABLE } from './targetsCopy'
import type { CountyFC, CountyFeature } from '../countyBoundaries'
import type { ObservationEntry } from '../../types'

function feature(name: string, stusps: string, geoid: string): CountyFeature {
  return {
    type: 'Feature', bbox: [0, 0, 0, 0],
    properties: { name, stusps, geoid, statefp: geoid.slice(0, 2) },
    geometry: { type: 'Polygon', coordinates: [] },
  }
}

const GEOMETRY: CountyFC = {
  type: 'FeatureCollection',
  features: [
    feature('Alameda', 'CA', '06001'),
    feature('Contra Costa', 'CA', '06013'),
    feature('Washington', 'MN', '27163'),
    feature('Washington', 'OR', '41067'),
    feature('Doña Ana', 'NM', 'xx013'), // a feature whose GEOID yields no code
  ],
}

function obs(submissionId: string, stateProvince: string | null, county: string | null): ObservationEntry {
  return {
    submissionId, commonName: 'American Robin', scientificName: 'Turdus migratorius', date: '2026-05-01',
    location: 'Somewhere', locationId: 'L1', latitude: 37.8, longitude: -122.2, county, count: 1,
    breedingCode: null, speciesComments: '', catalogIds: [], stateProvince,
  }
}

describe('buildCountyChoices', () => {
  const observations: ObservationEntry[] = [
    // Alameda: three checklists, one with two rows (counted once).
    obs('S1', 'US-CA', 'Alameda'), obs('S1', 'US-CA', 'Alameda'), obs('S2', 'US-CA', 'Alameda'), obs('S3', 'US-CA', 'Alameda County'),
    // Contra Costa: one.
    obs('S4', 'US-CA', 'Contra Costa'),
    // Two Washingtons in two states never conflate.
    obs('S5', 'US-MN', 'Washington'), obs('S6', 'US-OR', 'Washington'), obs('S7', 'US-OR', 'Washington'),
    // A county the geometry does not know, and one whose feature has no code.
    obs('S8', 'US-CA', 'Atlantis'), obs('S9', 'US-NM', 'Doña Ana'),
    // Non-US and incomplete rows are skipped by mechanism.
    obs('S10', 'CA-ON', 'Toronto'), obs('S11', null, 'Alameda'), obs('S12', 'US-CA', null),
  ]
  const choices = buildCountyChoices(observations, GEOMETRY)

  it('lists every US county in the backup as "County, ST" with its distinct checklist count (QA-05)', () => {
    expect(choices.map(c => [c.label, c.checklists])).toEqual([
      ['Alameda, CA', 3],
      ['Washington, OR', 2],
      ['Atlantis, CA', 1],
      ['Contra Costa, CA', 1],
      ['Doña Ana, NM', 1],
      ['Washington, MN', 1],
    ])
  })

  it('joins through the geometry to an eBird region code', () => {
    const byLabel = new Map(choices.map(c => [c.label, c]))
    expect(byLabel.get('Alameda, CA')!.regionCode).toBe('US-CA-001')
    expect(byLabel.get('Contra Costa, CA')!.regionCode).toBe('US-CA-013')
    expect(byLabel.get('Washington, MN')!.regionCode).toBe('US-MN-163')
    expect(byLabel.get('Washington, OR')!.regionCode).toBe('US-OR-067')
  })

  it('lists an unjoinable county as unavailable with the stated reason, never omits it (QA-06)', () => {
    const atlantis = choices.find(c => c.label === 'Atlantis, CA')!
    expect(atlantis.regionCode).toBeNull()
    expect(atlantis.unavailableReason).toBe(COUNTY_UNAVAILABLE)
    const dona = choices.find(c => c.label === 'Doña Ana, NM')!
    expect(dona.regionCode).toBeNull()
    expect(dona.unavailableReason).toBe('SnowRaven cannot map this county to an eBird region')
  })

  it('skips non-US rows and rows missing a state or county', () => {
    expect(choices.some(c => c.label.includes('Toronto'))).toBe(false)
    expect(choices.reduce((n, c) => n + c.checklists, 0)).toBe(9)
  })

  it('breaks a checklist-count tie by label', () => {
    const ones = choices.filter(c => c.checklists === 1).map(c => c.label)
    expect(ones).toEqual([...ones].sort((a, b) => a.localeCompare(b)))
  })
})

describe('pickInitialCounty (QA-07, QA-08)', () => {
  const choices = buildCountyChoices([
    obs('S1', 'US-CA', 'Atlantis'), obs('S2', 'US-CA', 'Atlantis'), obs('S3', 'US-CA', 'Atlantis'),
    obs('S4', 'US-CA', 'Alameda'), obs('S5', 'US-CA', 'Alameda'),
    obs('S6', 'US-CA', 'Contra Costa'),
  ], GEOMETRY)

  it('opens on the AVAILABLE county with the most checklists when nothing is remembered', () => {
    // Atlantis has more checklists but cannot be selected.
    expect(pickInitialCounty(choices, null)!.regionCode).toBe('US-CA-001')
  })

  it('opens on the remembered county while it is still available', () => {
    expect(pickInitialCounty(choices, 'US-CA-013')!.regionCode).toBe('US-CA-013')
  })

  it('falls back to the default, without error, when the remembered county is gone', () => {
    expect(pickInitialCounty(choices, 'US-WA-033')!.regionCode).toBe('US-CA-001')
  })

  it('answers null when no county is available', () => {
    expect(pickInitialCounty(buildCountyChoices([obs('S1', 'US-CA', 'Atlantis')], GEOMETRY), null)).toBeNull()
  })
})
