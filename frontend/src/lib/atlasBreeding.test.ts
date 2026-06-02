import { describe, it, expect } from 'vitest'
import { buildBreedingByBlock, type BreedingObs } from './atlasBreeding'
import type { AtlasData, AtlasScheme } from './atlasBlocks'

const SCHEME: AtlasScheme = {
  cols: 2, rows: 3, quadLat: 0.125, quadLng: 0.125,
  positions: [['SW', 'SE'], ['CW', 'CE'], ['NW', 'NE']],
}
const DATA: AtlasData = {
  scheme: SCHEME,
  quads: [{ sw: [38.0, -122.0], name: 'Mount Diablo', id: '38122A1' }],
  irregular: [],
}

// All these coords fall in the SW block of the Mount Diablo quad (38122A1SW).
const SW = { lat: 38.01, lng: -121.99 }

describe('buildBreedingByBlock', () => {
  it('keeps the highest (strongest) code per block and counts records', () => {
    const obs: BreedingObs[] = [
      { latitude: SW.lat, longitude: SW.lng, breedingCode: 'S' },  // tier 1 Possible
      { latitude: SW.lat, longitude: SW.lng, breedingCode: 'NY' }, // tier 4 Confirmed (highest)
      { latitude: SW.lat, longitude: SW.lng, breedingCode: 'T' },  // tier 2 Probable
    ]
    const m = buildBreedingByBlock(DATA, obs)
    const b = m.get('38122A1SW')!
    expect(b.tier).toBe(4)
    expect(b.code).toBe('NY')
    expect(b.count).toBe(3)
  })

  it('skips observations without a breeding code or coords', () => {
    const obs: BreedingObs[] = [
      { latitude: SW.lat, longitude: SW.lng, breedingCode: null },
      { latitude: null, longitude: null, breedingCode: 'NY' },
      { latitude: SW.lat, longitude: SW.lng, breedingCode: 'H' }, // tier 1
    ]
    const m = buildBreedingByBlock(DATA, obs)
    expect(m.get('38122A1SW')?.count).toBe(1)
    expect(m.get('38122A1SW')?.tier).toBe(1)
  })

  it('ignores unrecognized breeding codes', () => {
    const m = buildBreedingByBlock(DATA, [{ latitude: SW.lat, longitude: SW.lng, breedingCode: 'ZZ' }])
    expect(m.size).toBe(0)
  })

  it('excludes observations outside atlas coverage', () => {
    const m = buildBreedingByBlock(DATA, [{ latitude: 40.0, longitude: -120.0, breedingCode: 'NY' }])
    expect(m.size).toBe(0)
  })

  it('only includes blocks with at least one breeding record', () => {
    const m = buildBreedingByBlock(DATA, [{ latitude: SW.lat, longitude: SW.lng, breedingCode: 'C' }])
    expect([...m.keys()]).toEqual(['38122A1SW'])
  })
})
