import { describe, it, expect } from 'vitest'
import {
  normalizeCountyName, countyKey, countyKeyFromState, deriveCountyRegionCode,
  countiesInBounds, countyListRows, padBounds, bboxIntersects, stateNameFor,
  type CountyFC, type CountyFeature, type Bounds,
} from './countyBoundaries'

function feature(geoid: string, name: string, stusps: string, bbox: [number, number, number, number]): CountyFeature {
  return {
    type: 'Feature',
    bbox,
    properties: { geoid, name, stusps, statefp: geoid.slice(0, 2) },
    geometry: { type: 'Polygon', coordinates: [[[bbox[0], bbox[1]], [bbox[2], bbox[1]], [bbox[2], bbox[3]], [bbox[0], bbox[3]], [bbox[0], bbox[1]]]] },
  }
}

describe('normalizeCountyName', () => {
  it('lowercases, trims, and collapses whitespace', () => {
    expect(normalizeCountyName('  Santa   Clara ')).toBe('santa clara')
  })
  it('strips diacritics (Doña Ana → dona ana)', () => {
    expect(normalizeCountyName('Doña Ana')).toBe('dona ana')
  })
  it('normalizes Saint / St. forms', () => {
    expect(normalizeCountyName('St. Louis')).toBe('saint louis')
    expect(normalizeCountyName('St Louis')).toBe('saint louis')
    expect(normalizeCountyName('Ste. Genevieve')).toBe('sainte genevieve')
  })
  it('strips trailing admin suffixes (County / Parish / Census Area / Borough)', () => {
    expect(normalizeCountyName('Sonoma County')).toBe('sonoma')
    expect(normalizeCountyName('Acadia Parish')).toBe('acadia')
    expect(normalizeCountyName('Aleutians West Census Area')).toBe('aleutians west')
    expect(normalizeCountyName('North Slope Borough')).toBe('north slope')
  })
  it('matches across minor spelling/case differences (the join is normalization-insensitive)', () => {
    expect(normalizeCountyName('DOÑA ANA')).toBe(normalizeCountyName('Dona Ana'))
    expect(normalizeCountyName('St. Louis')).toBe(normalizeCountyName('Saint Louis'))
  })
})

describe('countyKey / countyKeyFromState', () => {
  it('keys on (state, normalized name) so same-named counties never conflate', () => {
    expect(countyKey('CA', 'Washington')).toBe('CA|washington')
    expect(countyKey('UT', 'Washington')).toBe('UT|washington')
    expect(countyKey('CA', 'Washington')).not.toBe(countyKey('UT', 'Washington'))
  })
  it('uppercases the state code', () => {
    expect(countyKey('ca', 'Sonoma')).toBe('CA|sonoma')
  })
  it('derives the key from a US subnational1 code, null for non-US', () => {
    expect(countyKeyFromState('US-CA', 'Sonoma')).toBe('CA|sonoma')
    expect(countyKeyFromState('CA-ON', 'Toronto')).toBeNull() // Ontario, Canada
    expect(countyKeyFromState('US-CA', null)).toBeNull()
    expect(countyKeyFromState(null, 'Sonoma')).toBeNull()
  })
})

describe('deriveCountyRegionCode', () => {
  it('builds US-{ST}-{COUNTYFP} from a valid geoid', () => {
    expect(deriveCountyRegionCode('06097', 'CA')).toBe('US-CA-097') // Sonoma
    expect(deriveCountyRegionCode('06053', 'CA')).toBe('US-CA-053') // Monterey
  })
  it('returns null for a malformed geoid (never a styled 404 link)', () => {
    expect(deriveCountyRegionCode('6097', 'CA')).toBeNull()   // not 5 digits
    expect(deriveCountyRegionCode('', 'CA')).toBeNull()
    expect(deriveCountyRegionCode('abcde', 'CA')).toBeNull()
  })
  it('the result always matches the strict region-code shape', () => {
    expect(deriveCountyRegionCode('06097', 'CA')).toMatch(/^US-[A-Z]{2}-\d{3}$/)
  })
})

describe('padBounds / bboxIntersects', () => {
  it('expands bounds by a fraction on every side', () => {
    expect(padBounds([0, 0, 10, 10], 0.1)).toEqual([-1, -1, 11, 11])
  })
  it('detects overlapping and disjoint bboxes', () => {
    expect(bboxIntersects([0, 0, 10, 10], [5, 5, 15, 15])).toBe(true)
    expect(bboxIntersects([0, 0, 1, 1], [5, 5, 6, 6])).toBe(false)
  })
})

describe('countiesInBounds', () => {
  const data: CountyFC = {
    type: 'FeatureCollection',
    features: [
      feature('06001', 'Alameda', 'CA', [-122.4, 37.4, -121.4, 37.9]),
      feature('06097', 'Sonoma', 'CA', [-123.5, 38.0, -122.3, 38.8]),
      feature('36061', 'New York', 'NY', [-74.05, 40.6, -73.9, 40.9]),
    ],
  }
  it('returns only features whose bbox intersects the view', () => {
    const bay: Bounds = [-123.0, 37.0, -121.0, 38.2]
    const res = countiesInBounds(data, bay, 100)
    expect(res.tooMany).toBe(false)
    expect(res.features.map(f => f.properties.name).sort()).toEqual(['Alameda', 'Sonoma'])
  })
  it('draws nothing and flags tooMany when the count exceeds the cap', () => {
    const res = countiesInBounds(data, [-180, -90, 180, 90], 2)
    expect(res.tooMany).toBe(true)
    expect(res.features).toEqual([])
  })
})

describe('countyListRows', () => {
  const splitWest = feature('02016', 'Aleutians West', 'AK', [172, 51, 180, 53])
  const splitEast = feature('02016', 'Aleutians West', 'AK', [-180, 51, -178, 53]) // same geoid, other hemisphere
  const features = [
    feature('06097', 'Sonoma', 'CA', [-123.5, 38, -122.3, 38.8]),
    feature('06001', 'Alameda', 'CA', [-122.4, 37.4, -121.4, 37.9]),
    splitWest, splitEast,
  ]
  it('dedupes by geoid (a dateline-split county is one row) and sorts by name', () => {
    const { rows, total } = countyListRows(features, 100)
    expect(total).toBe(3) // Aleutians West counted once despite two features
    expect(rows.map(r => r.name)).toEqual(['Alameda', 'Aleutians West', 'Sonoma'])
  })
  it('caps the list with an over-cap flag', () => {
    const { rows, total, overCap } = countyListRows(features, 2)
    expect(rows).toHaveLength(2)
    expect(total).toBe(3)
    expect(overCap).toBe(true)
  })
  it('anchors each row at its bbox centre', () => {
    const { rows } = countyListRows([features[1]], 100)
    expect(rows[0].center).toEqual([(-122.4 + -121.4) / 2, (37.4 + 37.9) / 2])
  })
})

describe('stateNameFor', () => {
  it('maps postal codes to full names, falling back to the code', () => {
    expect(stateNameFor('CA')).toBe('California')
    expect(stateNameFor('DC')).toBe('District of Columbia')
    expect(stateNameFor('ZZ')).toBe('ZZ')
  })
})
