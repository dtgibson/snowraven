import { describe, it, expect } from 'vitest'
import {
  generateBlocks,
  blocksInBounds,
  padBounds,
  quadBbox,
  buildQuadIndex,
  pointToBlockCode,
  type Quad,
  type AtlasScheme,
  type AtlasData,
  type Bounds,
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

describe('padBounds', () => {
  it('expands each side by the fraction of the span', () => {
    const b: Bounds = [-122.0, 38.0, -121.0, 38.5]
    expect(padBounds(b, 0.15)).toEqual([-122.15, 37.925, -120.85, 38.575])
  })

  it('zero fraction is the identity', () => {
    const b: Bounds = [-122.0, 38.0, -121.0, 38.5]
    expect(padBounds(b, 0)).toEqual(b)
  })

  it('a padded view includes blocks just outside the raw bounds (the moveend pop-in guard)', () => {
    const data: AtlasData = { scheme: SCHEME, quads: [QUAD], irregular: [] }
    // Raw bounds sit just east of the quad (which spans -122.0..-121.875);
    // 15% padding of the ~0.6° span reaches into it.
    const raw: Bounds = [-121.85, 38.0, -121.25, 38.125]
    const unpadded = blocksInBounds(data, raw, 500)
    const padded = blocksInBounds(data, padBounds(raw, 0.15), 500)
    expect(unpadded.blocks.length).toBe(0)
    expect(padded.blocks.length).toBeGreaterThan(0)
  })
})

describe('pointToBlockCode', () => {
  const DATA: AtlasData = {
    scheme: SCHEME,
    quads: [
      { sw: [38.0, -122.0], name: 'Mount Diablo', id: '38122A1' },
      { sw: [38.0, -121.875], name: 'Clayton', id: '38122A2', pos: ['SW'] }, // edge quad: only SW exists
    ],
    irregular: [],
  }
  const idx = buildQuadIndex(DATA)

  it('maps a point in the SW block', () => {
    // SW block: lng [-122, -121.9375], lat [38.0, 38.0417]
    expect(pointToBlockCode(DATA, idx, 38.01, -121.99)).toBe('38122A1SW')
  })

  it('maps a point in the NE block', () => {
    // NE block: col 1 (east), row 2 (north): lng [-121.9375,-121.875], lat [38.0833,38.125]
    expect(pointToBlockCode(DATA, idx, 38.10, -121.90)).toBe('38122A1NE')
  })

  it('returns null outside any gazetteer quad', () => {
    expect(pointToBlockCode(DATA, idx, 40.0, -120.0)).toBeNull()
  })

  it('returns null for a sub-block missing from an edge quad', () => {
    // Clayton quad exists but only has SW; a point in its NE cell → null
    expect(pointToBlockCode(DATA, idx, 38.10, -121.78)).toBeNull()
    // ...while its SW cell resolves
    expect(pointToBlockCode(DATA, idx, 38.01, -121.86)).toBe('38122A2SW')
  })
})
