// The record fold and the classification (targets-tab QA-16 to QA-20; schema.md
// 5.2's roll-up rule and its Object.hasOwn read of the codes table).
import { describe, it, expect } from 'vitest'
import { buildTargetsRecord, distinctNamePairs, speciesKey } from './targetsRecord'
import { classifyPool } from './targetsClassify'
import type { EbirdSpecies } from '../countyCompleteness'
import type { MLExportRow } from '../parseMLExport'
import type { ObservationEntry } from '../../types'

function obs(commonName: string, over: Partial<ObservationEntry> = {}): ObservationEntry {
  return {
    submissionId: 'S1', commonName, scientificName: `${commonName} sci`, date: '2026-05-01',
    location: 'X', locationId: 'L1', latitude: 1, longitude: 1, county: 'Alameda', count: 1,
    breedingCode: null, speciesComments: '', catalogIds: [], stateProvince: 'US-CA', ...over,
  }
}

function ml(commonName: string, format: 'Photo' | 'Audio' | 'Video'): MLExportRow {
  return {
    catalogId: '1', commonName, scientificName: '', format, date: '2026-05-01', location: '', county: null,
    latitude: null, longitude: null, caption: '', mediaNotes: '', observationDetails: '',
  } as unknown as MLExportRow
}

const POOL: EbirdSpecies[] = [
  { speciesCode: 'amerob', commonName: 'American Robin' },
  { speciesCode: 'daejun', commonName: 'Dark-eyed Junco' },
  { speciesCode: 'sonspa', commonName: 'Song Sparrow' },
  { speciesCode: 'linspa', commonName: "Lincoln's Sparrow" },
  { speciesCode: 'rinpha', commonName: 'Ring-necked Pheasant' },
  { speciesCode: 'shbgul', commonName: 'Short-billed Gull' },
]

describe('the record fold', () => {
  it('speciesKey folds a trailing form and case (the Nearby Lifers rule)', () => {
    expect(speciesKey('Dark-eyed Junco (Oregon)')).toBe('dark-eyed junco')
    expect(speciesKey('AMERICAN ROBIN')).toBe('american robin')
  })

  it('distinctNamePairs keeps the first scientific name per raw name', () => {
    const pairs = distinctNamePairs([obs('A', { scientificName: 'a1' }), obs('A', { scientificName: 'a2' }), obs('B')])
    expect([...pairs]).toEqual([['A', 'a1'], ['B', 'B sci']])
  })

  it('rolls every form up to its species: recorded, media and breeding (schema 5.2)', () => {
    const record = buildTargetsRecord(
      [obs('Dark-eyed Junco (Oregon)', { breedingCode: 'FL' }), obs('Dark-eyed Junco')],
      [ml('Dark-eyed Junco (Oregon)', 'Photo'), ml('Dark-eyed Junco', 'Audio')],
      null,
    )
    expect(record.names.has('dark-eyed junco')).toBe(true)
    expect([...record.mediaByKey!.get('dark-eyed junco')!].sort()).toEqual(['Audio', 'Photo'])
    expect([...record.codesByKey.get('dark-eyed junco')!]).toEqual(['FL'])
    // Species Detail opens on the species-shaped raw name when both were seen.
    expect(record.openNameByKey.get('dark-eyed junco')).toBe('Dark-eyed Junco')
  })

  it('an unrecognized breeding-code string is not a breeding code', () => {
    const record = buildTargetsRecord([obs('Song Sparrow', { breedingCode: 'XYZ' })], null, null)
    expect(record.codesByKey.has('song sparrow')).toBe(false)
  })

  it('reads the codes table through Object.hasOwn: prototype names and a JSON __proto__ key are not codes', () => {
    // JSON.parse, never an object literal: `{ __proto__: ... }` in source sets the
    // prototype and creates no own property (security.md).
    const table = JSON.parse('{"__proto__": "amerob", "constructor": "x", "American Robin": "amerob", "Song Sparrow": "NOT A CODE"}') as Record<string, unknown>
    const record = buildTargetsRecord(
      [obs('__proto__'), obs('constructor'), obs('toString'), obs('American Robin'), obs('Song Sparrow')],
      null,
      table,
    )
    expect([...record.codes].sort()).toEqual(['amerob'])
    // `__proto__` resolved to a real own key, and it is a valid code shape, so it
    // counts (the table said so) -- the point is that nothing INHERITED does.
    expect(record.keyByCode.get('amerob')).toBe('__proto__')
    expect(record.codes.has('x')).toBe(false)
  })
})

describe('classifyPool', () => {
  const observations = [
    obs('American Robin', { breedingCode: 'NY' }),        // recorded, confirmed, has all media
    obs('Dark-eyed Junco (Oregon)', { breedingCode: 'S' }), // recorded only as a form, possible code
    obs('Song Sparrow'),                                     // recorded, no code, missing photo
    obs('Mew Gull'),                                         // recorded under a name eBird has since changed
  ]
  const mlRows = [
    ml('American Robin', 'Photo'), ml('American Robin', 'Audio'), ml('American Robin', 'Video'),
    ml('Song Sparrow', 'Audio'), ml('Song Sparrow', 'Video'),
  ]
  const codes = { 'American Robin': 'amerob', 'Dark-eyed Junco': 'daejun', 'Song Sparrow': 'sonspa', 'Mew Gull': 'shbgul' }
  const classified = classifyPool(POOL, buildTargetsRecord(observations, mlRows, codes))
  const by = new Map(classified.map(c => [c.speciesCode, c]))

  it('keeps pool order as poolIndex (the taxonomic order)', () => {
    expect(classified.map(c => c.poolIndex)).toEqual([0, 1, 2, 3, 4, 5])
  })

  it('a species absent by name AND by code is a Lifer; present by either is not (QA-16)', () => {
    expect(by.get('linspa')!.lifer).toBe(true)
    expect(by.get('rinpha')!.lifer).toBe(true)
    expect(by.get('amerob')!.lifer).toBe(false)
    expect(by.get('daejun')!.lifer).toBe(false)     // by name, through the fold
    expect(by.get('shbgul')!.lifer).toBe(false)     // by code only (renamed)
  })

  it('names the missing media types for a recorded species; [] when it has all three (QA-17)', () => {
    expect(by.get('sonspa')!.missingMedia).toEqual(['Photo'])
    expect(by.get('amerob')!.missingMedia).toEqual([])
    expect(by.get('daejun')!.missingMedia).toEqual(['Photo', 'Audio', 'Video'])
  })

  it('carries the recorded codes, F and H included, for the Breeding type (QA-18)', () => {
    expect([...by.get('amerob')!.codes]).toEqual(['NY'])
    expect([...by.get('daejun')!.codes]).toEqual(['S'])
    expect(by.get('sonspa')!.codes.size).toBe(0)
  })

  it('is disjoint by construction: a lifer has no media and no codes (QA-19)', () => {
    for (const c of classified.filter(c => c.lifer)) {
      expect(c.missingMedia).toBeNull()
      expect(c.codes.size).toBe(0)
      expect(c.openName).toBeNull()
    }
  })

  it('a renamed species finds its record under the name it was recorded by', () => {
    const gull = by.get('shbgul')!
    expect(gull.openName).toBe('Mew Gull')
    expect(gull.missingMedia).toEqual(['Photo', 'Audio', 'Video'])
  })

  it('opens Species Detail on the backup name, not the pool name (FR-57)', () => {
    expect(by.get('daejun')!.openName).toBe('Dark-eyed Junco (Oregon)')
    expect(by.get('sonspa')!.openName).toBe('Song Sparrow')
  })

  it('with no usable ML export, missingMedia is null rather than "missing everything"', () => {
    const noMl = classifyPool(POOL, buildTargetsRecord(observations, null, codes))
    for (const c of noMl) expect(c.missingMedia).toBeNull()
  })

  it('with the code lookup failed, the subtraction falls back to names alone', () => {
    const nameOnly = new Map(classifyPool(POOL, buildTargetsRecord(observations, mlRows, null)).map(c => [c.speciesCode, c]))
    expect(nameOnly.get('shbgul')!.lifer).toBe(true)   // the rename cannot be resolved without codes
    expect(nameOnly.get('amerob')!.lifer).toBe(false)
  })
})
