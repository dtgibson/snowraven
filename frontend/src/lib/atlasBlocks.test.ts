import { describe, it, expect } from 'vitest'
import {
  generateBlocks,
  blocksInBounds,
  quadBbox,
  type Quad,
  type AtlasScheme,
  type AtlasData,
} from './atlasBlocks'

// Representative scheme: a 7.5' quad split 2 cols x 3 rows (6 blocks).
const SCHEME: AtlasScheme = {
  cols: 2,
  rows: 3,
  quadLat: 0.125,
  quadLng: 0.125,
  positions: [
    ['SW', 'SE'], // row 0 = south
    ['CW', 'CE'],
    ['NW', 'NE'], // row 2 = north
  ],
}

const QUAD: Quad = { sw: [38.0, -122.0], name: 'Mount Diablo', id: '38122A1' }

describe('generateBlocks', () => {
  it('produces cols*rows blocks', () => {
    expect(generateBlocks(QUAD, SCHEME)).toHaveLength(6)
  })

  it('names blocks "<quad> <position>"', () => {
    const names = generateBlocks(QUAD, SCHEME).map(b => b.name).sort()
    expect(names).toEqual([
      'Mount Diablo CE', 'Mount Diablo CW',
      'Mount Diablo NE', 'Mount Diablo NW',
      'Mount Diablo SE', 'Mount Diablo SW',
    ])
  })

  it('tiles the quad exactly (SW block anchored at the quad SW corner)', () => {
    const sw = generateBlocks(QUAD, SCHEME).find(b => b.name === 'Mount Diablo SW')!
    // dLng = 0.0625, dLat = 0.125/3
    expect(sw.bbox[0]).toBeCloseTo(-122.0, 9)   // minLng
    expect(sw.bbox[1]).toBeCloseTo(38.0, 9)      // minLat
    expect(sw.bbox[2]).toBeCloseTo(-122.0 + 0.0625, 9)
    expect(sw.bbox[3]).toBeCloseTo(38.0 + 0.125 / 3, 9)
  })

  it('NE block reaches the quad NE corner', () => {
    const ne = generateBlocks(QUAD, SCHEME).find(b => b.name === 'Mount Diablo NE')!
    expect(ne.bbox[2]).toBeCloseTo(-122.0 + 0.125, 9) // maxLng = quad east edge
    expect(ne.bbox[3]).toBeCloseTo(38.0 + 0.125, 9)   // maxLat = quad north edge
  })

  it('rings are closed (first == last) and in [lng,lat] order', () => {
    for (const b of generateBlocks(QUAD, SCHEME)) {
      expect(b.ring[0]).toEqual(b.ring[b.ring.length - 1])
      expect(b.ring).toHaveLength(5)
    }
  })

  it('block code = quad id + position (for the eBird block URL)', () => {
    const ne = generateBlocks(QUAD, SCHEME).find(b => b.name === 'Mount Diablo NE')!
    expect(ne.code).toBe('38122A1NE')
  })
})

describe('quadBbox', () => {
  it('spans one quad from the SW corner', () => {
    expect(quadBbox(QUAD, SCHEME)).toEqual([-122.0, 38.0, -122.0 + 0.125, 38.0 + 0.125])
  })
})

describe('blocksInBounds', () => {
  const DATA: AtlasData = {
    scheme: SCHEME,
    quads: [
      { sw: [38.0, -122.0], name: 'Mount Diablo', id: '38122A1' },
      { sw: [38.125, -122.0], name: 'Clayton', id: '38122B1' },   // quad just north
      { sw: [40.0, -120.0], name: 'Far Away', id: '40120A1' },     // far from the others
    ],
    irregular: [
      { name: 'Coast Clip XY', code: 'COAST1XY', ring: [[-122.5, 37.9], [-122.4, 37.9], [-122.4, 38.0], [-122.5, 38.0], [-122.5, 37.9]], bbox: [-122.5, 37.9, -122.4, 38.0] },
    ],
  }

  it('returns only blocks intersecting the bounds', () => {
    // A small window inside the Mount Diablo quad only.
    const { blocks, tooMany } = blocksInBounds(DATA, [-122.0, 38.0, -121.99, 38.01], 500)
    expect(tooMany).toBe(false)
    expect(blocks.length).toBeGreaterThan(0)
    expect(blocks.every(b => b.name.startsWith('Mount Diablo'))).toBe(true)
  })

  it('includes irregular blocks when in view', () => {
    const { blocks } = blocksInBounds(DATA, [-122.5, 37.9, -122.45, 37.95], 500)
    expect(blocks.some(b => b.name === 'Coast Clip XY')).toBe(true)
  })

  it('signals tooMany and draws nothing when the count exceeds the cap', () => {
    // Cap of 3 with a window covering two full quads (12 blocks) → tooMany.
    const { blocks, tooMany } = blocksInBounds(DATA, [-122.0, 38.0, -121.9, 38.25], 3)
    expect(tooMany).toBe(true)
    expect(blocks).toHaveLength(0)
  })

  it('returns no blocks outside California coverage (no error)', () => {
    const { blocks, tooMany } = blocksInBounds(DATA, [-100.0, 45.0, -99.0, 46.0], 500)
    expect(tooMany).toBe(false)
    expect(blocks).toHaveLength(0)
  })
})
