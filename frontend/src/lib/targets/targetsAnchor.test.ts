// "Places in this list" (targets-tab FR-51a, design-spec 2a): distinct,
// alphabetical, only places that can be measured from, pure.
import { describe, it, expect } from 'vitest'
import { listPlaces, placeDistance } from './targetsAnchor'
import type { LiveCell } from './targetsLive'

function cell(place: string | null, lat: number | null, lng: number | null): LiveCell {
  return { daysReported: 1, checkedDays: 30, lastDate: '2026-09-20', place, locId: null, lat, lng, reported: [] }
}

describe('listPlaces', () => {
  it('distinct names, alphabetical by localeCompare, first position met kept', () => {
    const cells = new Map<string, LiveCell>([
      ['a', cell('Lake Merritt', 37.8, -122.25)],
      ['b', cell('Arrowhead Marsh', 37.74, -122.2)],
      ['c', cell('Lake Merritt', 1, 1)],           // same name, later: ignored
      ['d', cell('coyote Hills', 37.55, -122.09)],  // localeCompare, not code units
    ])
    expect(listPlaces(cells)).toEqual([
      { name: 'Arrowhead Marsh', lat: 37.74, lng: -122.2 },
      { name: 'coyote Hills', lat: 37.55, lng: -122.09 },
      { name: 'Lake Merritt', lat: 37.8, lng: -122.25 },
    ])
  })

  it('a report with no place or no coordinates cannot be measured from, so it is left out', () => {
    const cells = new Map<string, LiveCell>([
      ['a', cell(null, 37.8, -122.25)],
      ['b', cell('Redwood Park', null, null)],
      ['c', cell('Half', 37.8, null)],
    ])
    expect(listPlaces(cells)).toEqual([])
  })

  it('no live data is an empty list, never a throw', () => {
    expect(listPlaces(null)).toEqual([])
    expect(listPlaces(new Map())).toEqual([])
  })

  it('an eBird location named like an object member is an ordinary name (a real Map, not a record)', () => {
    const cells = new Map<string, LiveCell>([
      ['a', cell('__proto__', 1, 2)],
      ['b', cell('constructor', 3, 4)],
    ])
    expect(listPlaces(cells).map(p => p.name)).toEqual(['__proto__', 'constructor'])
    expect(Object.getPrototypeOf({})).toBe(Object.prototype)
  })
})

describe('placeDistance', () => {
  it('miles from the anchor, and null with none', () => {
    const p = { name: 'X', lat: 37.8, lng: -122.25 }
    expect(placeDistance(null, p)).toBeNull()
    expect(placeDistance({ lat: 37.8, lng: -122.25 }, p)).toBe(0)
    expect(placeDistance({ lat: 37.9, lng: -122.25 }, p)!).toBeCloseTo(6.9, 1)
  })
})
