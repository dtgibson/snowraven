import { describe, it, expect } from 'vitest'
import { parseEbirdObservations } from './parseEbirdObservations'

const HEADERS = 'Submission ID,Common Name,Scientific Name,Date,Location,Count,Breeding Code,Species Comments,ML Catalog Numbers,Location ID,Latitude,Longitude'

const HEADERS_FULL = 'Submission ID,Common Name,Scientific Name,Date,Location,Count,Breeding Code,Species Comments,ML Catalog Numbers,Location ID,Latitude,Longitude,County,Time,Duration Min,Distance Traveled (km),Protocol,Number of Observers,All Obs Reported,Checklist Comments,State/Province Code'

function makeRow(overrides: Partial<{
  submissionId: string
  commonName: string
  scientificName: string
  date: string
  location: string
  count: string
  breedingCode: string
  speciesComments: string
  catalogNumbers: string
  locationId: string
  latitude: string
  longitude: string
}>): string {
  const r = {
    submissionId:    overrides.submissionId    ?? 'S12345678',
    commonName:      overrides.commonName      ?? 'American Robin',
    scientificName:  overrides.scientificName  ?? 'Turdus migratorius',
    date:            overrides.date            ?? '2024-04-09',
    location:        overrides.location        ?? 'Lake Harriet',
    count:           overrides.count           ?? '5',
    breedingCode:    overrides.breedingCode    ?? '',
    speciesComments: overrides.speciesComments ?? '',
    catalogNumbers:  overrides.catalogNumbers  ?? '',
    locationId:      overrides.locationId      ?? 'L12345',
    latitude:        overrides.latitude        ?? '44.9778',
    longitude:       overrides.longitude       ?? '-93.2650',
  }
  return [r.submissionId, r.commonName, r.scientificName, r.date, r.location,
          r.count, r.breedingCode, r.speciesComments, r.catalogNumbers,
          r.locationId, r.latitude, r.longitude].join(',')
}

function makeFullRow(overrides: Partial<{
  submissionId: string
  commonName: string
  scientificName: string
  date: string
  location: string
  count: string
  breedingCode: string
  speciesComments: string
  catalogNumbers: string
  locationId: string
  latitude: string
  longitude: string
  county: string
  time: string
  duration: string
  distance: string
  protocol: string
  numObservers: string
  allObsReported: string
  checklistComments: string
  stateProvince: string
}>): string {
  const r = {
    submissionId:      overrides.submissionId      ?? 'S12345678',
    commonName:        overrides.commonName        ?? 'American Robin',
    scientificName:    overrides.scientificName    ?? 'Turdus migratorius',
    date:              overrides.date              ?? '2024-04-09',
    location:          overrides.location          ?? 'Lake Harriet',
    count:             overrides.count             ?? '5',
    breedingCode:      overrides.breedingCode      ?? '',
    speciesComments:   overrides.speciesComments   ?? '',
    catalogNumbers:    overrides.catalogNumbers    ?? '',
    locationId:        overrides.locationId        ?? 'L12345',
    latitude:          overrides.latitude          ?? '44.9778',
    longitude:         overrides.longitude         ?? '-93.2650',
    county:            overrides.county            ?? 'Hennepin',
    time:              overrides.time              ?? '8:00 AM',
    duration:          overrides.duration          ?? '60',
    distance:          overrides.distance          ?? '2.5',
    protocol:          overrides.protocol          ?? 'Traveling',
    numObservers:      overrides.numObservers      ?? '1',
    allObsReported:    overrides.allObsReported    ?? '1',
    checklistComments: overrides.checklistComments ?? '',
    stateProvince:     overrides.stateProvince     ?? 'US-MN',
  }
  return [
    r.submissionId, r.commonName, r.scientificName, r.date, r.location,
    r.count, r.breedingCode, r.speciesComments, r.catalogNumbers,
    r.locationId, r.latitude, r.longitude, r.county, r.time,
    r.duration, r.distance, r.protocol, r.numObservers,
    r.allObsReported, r.checklistComments, r.stateProvince,
  ].join(',')
}

describe('parseEbirdObservations', () => {
  it('parses a minimal valid file', () => {
    const csv = [HEADERS, makeRow({})].join('\n')
    const entries = parseEbirdObservations(csv)
    expect(entries).toHaveLength(1)
    expect(entries[0].commonName).toBe('American Robin')
    expect(entries[0].submissionId).toBe('S12345678')
    expect(entries[0].scientificName).toBe('Turdus migratorius')
    expect(entries[0].date).toBe('2024-04-09')
    expect(entries[0].location).toBe('Lake Harriet')
    expect(entries[0].locationId).toBe('L12345')
    expect(entries[0].latitude).toBe(44.9778)
    expect(entries[0].longitude).toBe(-93.265)
    expect(entries[0].count).toBe(5)
    expect(entries[0].breedingCode).toBeNull()
    expect(entries[0].speciesComments).toBe('')
    expect(entries[0].catalogIds).toEqual([])
  })

  it('parses Area Covered (ha) when present, null when blank', () => {
    const headers = 'Submission ID,Common Name,Scientific Name,Date,Location,Count,Distance Traveled (km),Area Covered (ha)'
    const withArea = 'S1,American Robin,Turdus migratorius,2024-04-09,Field,5,1.2,3.5'
    const blankArea = 'S2,American Crow,Corvus brachyrhynchos,2024-04-09,Field,2,0.8,'
    const entries = parseEbirdObservations([headers, withArea, blankArea].join('\n'))
    expect(entries[0].area).toBe(3.5)
    expect(entries[1].area).toBeNull()
  })

  it('omits area entirely when the column is absent', () => {
    const csv = [HEADERS, makeRow({})].join('\n')
    const entries = parseEbirdObservations(csv)
    expect(entries[0].area).toBeUndefined()
  })

  it('returns one entry per row (no deduplication)', () => {
    const csv = [
      HEADERS,
      makeRow({ commonName: 'American Robin', submissionId: 'S111' }),
      makeRow({ commonName: 'American Robin', submissionId: 'S222' }),
      makeRow({ commonName: 'Canada Goose',   submissionId: 'S333' }),
    ].join('\n')
    const entries = parseEbirdObservations(csv)
    expect(entries).toHaveLength(3)
  })

  it('parses "X" presence-only count as null', () => {
    const csv = [HEADERS, makeRow({ count: 'X' })].join('\n')
    const entries = parseEbirdObservations(csv)
    expect(entries[0].count).toBeNull()
  })

  it('parses a numeric count correctly', () => {
    const csv = [HEADERS, makeRow({ count: '34' })].join('\n')
    const entries = parseEbirdObservations(csv)
    expect(entries[0].count).toBe(34)
  })

  it('strips full label from breeding code — takes first token only', () => {
    const csv = [HEADERS, makeRow({ breedingCode: 'CF Carrying Food' })].join('\n')
    const entries = parseEbirdObservations(csv)
    expect(entries[0].breedingCode).toBe('CF')
  })

  it('sets breedingCode to null when column is empty', () => {
    const csv = [HEADERS, makeRow({ breedingCode: '' })].join('\n')
    const entries = parseEbirdObservations(csv)
    expect(entries[0].breedingCode).toBeNull()
  })

  it('strips ML prefix from catalog numbers', () => {
    const csv = [HEADERS, makeRow({ catalogNumbers: 'ML204818731 ML987654321' })].join('\n')
    const entries = parseEbirdObservations(csv)
    expect(entries[0].catalogIds).toEqual(['204818731', '987654321'])
  })

  it('handles catalog numbers without ML prefix', () => {
    const csv = [HEADERS, makeRow({ catalogNumbers: '111111 222222' })].join('\n')
    const entries = parseEbirdObservations(csv)
    expect(entries[0].catalogIds).toEqual(['111111', '222222'])
  })

  it('preserves species comments', () => {
    const csv = [HEADERS, makeRow({ speciesComments: 'Singing from a tall spruce.' })].join('\n')
    const entries = parseEbirdObservations(csv)
    expect(entries[0].speciesComments).toBe('Singing from a tall spruce.')
  })

  it('reads comments from "Observation Details" column (real eBird export name)', () => {
    const altHeaders = HEADERS.replace('Species Comments', 'Observation Details')
    const csv = [altHeaders, makeRow({ speciesComments: 'Singing from a tall spruce.' })].join('\n')
    const entries = parseEbirdObservations(csv)
    expect(entries[0].speciesComments).toBe('Singing from a tall spruce.')
  })

  it('handles quoted species comments with embedded commas', () => {
    const csv = `${HEADERS}\nS1,American Robin,Turdus migratorius,2024-04-09,Lake Harriet,5,,"Three birds, all singing",\n`
    const entries = parseEbirdObservations(csv)
    expect(entries[0].speciesComments).toBe('Three birds, all singing')
  })

  it('handles quoted fields with embedded newlines', () => {
    const csv = `${HEADERS}\nS1,American Robin,Turdus migratorius,2024-04-09,"River\nTrail",5,,,,\n`
    const entries = parseEbirdObservations(csv)
    expect(entries[0].location).toBe('River\nTrail')
    expect(entries[0].commonName).toBe('American Robin')
  })

  it('skips empty rows', () => {
    const csv = [HEADERS, makeRow({}), '', makeRow({ submissionId: 'S999' })].join('\n')
    const entries = parseEbirdObservations(csv)
    expect(entries).toHaveLength(2)
  })

  it('does not normalize subspecies parentheticals (keeps them as separate entries)', () => {
    const csv = [
      HEADERS,
      makeRow({ commonName: 'Yellow-rumped Warbler (Myrtle)',    submissionId: 'S1' }),
      makeRow({ commonName: "Yellow-rumped Warbler (Audubon's)", submissionId: 'S2' }),
    ].join('\n')
    const entries = parseEbirdObservations(csv)
    expect(entries).toHaveLength(2)
    expect(entries[0].commonName).toBe('Yellow-rumped Warbler (Myrtle)')
    expect(entries[1].commonName).toBe("Yellow-rumped Warbler (Audubon's)")
  })

  it('strips BOM from start of file', () => {
    const csv = '﻿' + [HEADERS, makeRow({})].join('\n')
    const entries = parseEbirdObservations(csv)
    expect(entries).toHaveLength(1)
  })

  it('throws INVALID_EBIRD when Common Name column is missing', () => {
    const bad = 'Submission ID,Date\nS1,2024-04-09'
    expect(() => parseEbirdObservations(bad)).toThrow('INVALID_EBIRD')
  })

  it('throws INVALID_EBIRD when Submission ID column is missing', () => {
    const bad = 'Common Name,Date\nAmerican Robin,2024-04-09'
    expect(() => parseEbirdObservations(bad)).toThrow('INVALID_EBIRD')
  })

  it('throws INVALID_EBIRD on empty input', () => {
    expect(() => parseEbirdObservations('')).toThrow('INVALID_EBIRD')
  })

  it('handles CRLF line endings', () => {
    const csv = HEADERS + '\r\n' + makeRow({}) + '\r\n'
    const entries = parseEbirdObservations(csv)
    expect(entries).toHaveLength(1)
  })

  it('parses locationId from Location ID column', () => {
    const csv = [HEADERS, makeRow({ locationId: 'L987654' })].join('\n')
    const entries = parseEbirdObservations(csv)
    expect(entries[0].locationId).toBe('L987654')
  })

  it('defaults locationId to empty string when column is absent', () => {
    const csv = 'Submission ID,Common Name,Date\nS1,American Robin,2024-04-09'
    const entries = parseEbirdObservations(csv)
    expect(entries[0].locationId).toBe('')
  })

  it('parses latitude and longitude as numbers', () => {
    const csv = [HEADERS, makeRow({ latitude: '37.7749', longitude: '-122.4194' })].join('\n')
    const entries = parseEbirdObservations(csv)
    expect(entries[0].latitude).toBeCloseTo(37.7749)
    expect(entries[0].longitude).toBeCloseTo(-122.4194)
  })

  it('sets latitude and longitude to null when non-numeric', () => {
    const csv = [HEADERS, makeRow({ latitude: '', longitude: '' })].join('\n')
    const entries = parseEbirdObservations(csv)
    expect(entries[0].latitude).toBeNull()
    expect(entries[0].longitude).toBeNull()
  })

  it('sets latitude and longitude to null when columns are absent', () => {
    const csv = 'Submission ID,Common Name,Date\nS1,American Robin,2024-04-09'
    const entries = parseEbirdObservations(csv)
    expect(entries[0].latitude).toBeNull()
    expect(entries[0].longitude).toBeNull()
  })

  // ── New optional fields ───────────────────────────────────────────────────

  it('parses time when present', () => {
    const csv = [HEADERS_FULL, makeFullRow({ time: '7:30 AM' })].join('\n')
    const entries = parseEbirdObservations(csv)
    expect(entries[0].time).toBe('7:30 AM')
  })

  it('sets time to null when blank', () => {
    const csv = [HEADERS_FULL, makeFullRow({ time: '' })].join('\n')
    const entries = parseEbirdObservations(csv)
    expect(entries[0].time).toBeNull()
  })

  it('sets time to undefined when column absent', () => {
    const csv = [HEADERS, makeRow({})].join('\n')
    const entries = parseEbirdObservations(csv)
    expect(entries[0].time).toBeUndefined()
  })

  it('parses duration as integer when present', () => {
    const csv = [HEADERS_FULL, makeFullRow({ duration: '90' })].join('\n')
    const entries = parseEbirdObservations(csv)
    expect(entries[0].duration).toBe(90)
  })

  it('sets duration to null when blank', () => {
    const csv = [HEADERS_FULL, makeFullRow({ duration: '' })].join('\n')
    const entries = parseEbirdObservations(csv)
    expect(entries[0].duration).toBeNull()
  })

  it('sets duration to null when non-numeric', () => {
    const csv = [HEADERS_FULL, makeFullRow({ duration: 'N/A' })].join('\n')
    const entries = parseEbirdObservations(csv)
    expect(entries[0].duration).toBeNull()
  })

  it('parses distance as float when present', () => {
    const csv = [HEADERS_FULL, makeFullRow({ distance: '3.75' })].join('\n')
    const entries = parseEbirdObservations(csv)
    expect(entries[0].distance).toBeCloseTo(3.75)
  })

  it('sets distance to null when blank', () => {
    const csv = [HEADERS_FULL, makeFullRow({ distance: '' })].join('\n')
    const entries = parseEbirdObservations(csv)
    expect(entries[0].distance).toBeNull()
  })

  it('parses protocol when present', () => {
    const csv = [HEADERS_FULL, makeFullRow({ protocol: 'Stationary' })].join('\n')
    const entries = parseEbirdObservations(csv)
    expect(entries[0].protocol).toBe('Stationary')
  })

  it('sets protocol to null when blank', () => {
    const csv = [HEADERS_FULL, makeFullRow({ protocol: '' })].join('\n')
    const entries = parseEbirdObservations(csv)
    expect(entries[0].protocol).toBeNull()
  })

  it('parses numObservers as integer when present', () => {
    const csv = [HEADERS_FULL, makeFullRow({ numObservers: '3' })].join('\n')
    const entries = parseEbirdObservations(csv)
    expect(entries[0].numObservers).toBe(3)
  })

  it('sets numObservers to null when blank', () => {
    const csv = [HEADERS_FULL, makeFullRow({ numObservers: '' })].join('\n')
    const entries = parseEbirdObservations(csv)
    expect(entries[0].numObservers).toBeNull()
  })

  it('parses allObsReported as true when "1"', () => {
    const csv = [HEADERS_FULL, makeFullRow({ allObsReported: '1' })].join('\n')
    const entries = parseEbirdObservations(csv)
    expect(entries[0].allObsReported).toBe(true)
  })

  it('parses allObsReported as false when "0"', () => {
    const csv = [HEADERS_FULL, makeFullRow({ allObsReported: '0' })].join('\n')
    const entries = parseEbirdObservations(csv)
    expect(entries[0].allObsReported).toBe(false)
  })

  it('sets allObsReported to null when blank', () => {
    const csv = [HEADERS_FULL, makeFullRow({ allObsReported: '' })].join('\n')
    const entries = parseEbirdObservations(csv)
    expect(entries[0].allObsReported).toBeNull()
  })

  it('parses checklistComments when present', () => {
    const csv = [HEADERS_FULL, makeFullRow({ checklistComments: 'Foggy morning' })].join('\n')
    const entries = parseEbirdObservations(csv)
    expect(entries[0].checklistComments).toBe('Foggy morning')
  })

  it('sets checklistComments to empty string when blank', () => {
    const csv = [HEADERS_FULL, makeFullRow({ checklistComments: '' })].join('\n')
    const entries = parseEbirdObservations(csv)
    expect(entries[0].checklistComments).toBe('')
  })

  it('parses stateProvince when present', () => {
    const csv = [HEADERS_FULL, makeFullRow({ stateProvince: 'US-MN' })].join('\n')
    const entries = parseEbirdObservations(csv)
    expect(entries[0].stateProvince).toBe('US-MN')
  })

  it('sets stateProvince to null when blank', () => {
    const csv = [HEADERS_FULL, makeFullRow({ stateProvince: '' })].join('\n')
    const entries = parseEbirdObservations(csv)
    expect(entries[0].stateProvince).toBeNull()
  })

  it('sets all new fields to undefined when new columns are absent', () => {
    const csv = [HEADERS, makeRow({})].join('\n')
    const entries = parseEbirdObservations(csv)
    expect(entries[0].duration).toBeUndefined()
    expect(entries[0].distance).toBeUndefined()
    expect(entries[0].protocol).toBeUndefined()
    expect(entries[0].stateProvince).toBeUndefined()
  })
})
