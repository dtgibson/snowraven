import { describe, it, expect } from 'vitest'
import { buildNearbyLifers, isWithinWindow } from './nearbyLifers'
import type { TargetPin } from './mapExplorerTypes'

// Build a recent-obs record (TargetPin shape — what GET /map/recent-obs returns).
function rec(over: Partial<TargetPin>): TargetPin {
  return {
    speciesCode: 'sp1',
    comName: 'Some Bird',
    locId: 'L1',
    locName: 'Loc One',
    lat: 38.5,
    lng: -121.5,
    recentDate: '2026-06-01',
    checklistCount: 1,
    subId: 'S100',
    ...over,
  }
}

// "YYYY-MM-DD" string for a date `daysAgo` before today (local), for tier tests
// that depend on recencyTier reading the real `new Date()`.
function isoDaysAgo(daysAgo: number): string {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - daysAgo)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

const NOW = Date.UTC(2026, 5, 14) // arbitrary fixed nowMs for window tests

describe('buildNearbyLifers — filter out recorded species', () => {
  it('drops records whose normalized common name is in the recorded set (case-insensitive)', () => {
    const records = [
      rec({ comName: 'American Robin', speciesCode: 'amerob', locId: 'L1' }),
      rec({ comName: 'Varied Thrush', speciesCode: 'varthr', locId: 'L1' }),
    ]
    // Recorded set provided with different case + a parenthetical subspecies form,
    // which normalizeSpeciesName strips.
    const recorded = new Set(['american robin', 'House Finch (Common)'])
    const out = buildNearbyLifers(records, recorded, 38.5, -121.5, NOW)
    expect(out).toHaveLength(1)
    expect(out[0].lifers).toHaveLength(1)
    expect(out[0].lifers[0].comName).toBe('Varied Thrush')
    expect(out[0].count).toBe(1)
  })

  it('normalizes subspecies parentheticals on the record side too', () => {
    const records = [rec({ comName: 'Dark-eyed Junco (Oregon)', speciesCode: 'daejun' })]
    const recorded = new Set(['Dark-eyed Junco'])
    const out = buildNearbyLifers(records, recorded, 38.5, -121.5, NOW)
    expect(out).toHaveLength(0)
  })
})

describe('buildNearbyLifers — skip null/invalid coordinates', () => {
  it('omits records with non-numeric or NaN lat/lng', () => {
    const records = [
      rec({ comName: 'Good Bird', speciesCode: 'good', lat: 38.5, lng: -121.5 }),
      rec({ comName: 'No Lat', speciesCode: 'nolat', lat: NaN, lng: -121.5 }),
      // Force a null through despite the type (mirrors a coordinate-less obs).
      rec({ comName: 'Null Lng', speciesCode: 'nolng', lng: null as unknown as number }),
    ]
    const out = buildNearbyLifers(records, new Set(), 38.5, -121.5, NOW)
    expect(out).toHaveLength(1)
    expect(out[0].lifers).toHaveLength(1)
    expect(out[0].lifers[0].comName).toBe('Good Bird')
  })
})

describe('buildNearbyLifers — group by location', () => {
  it('groups records sharing a locId into one location', () => {
    const records = [
      rec({ comName: 'Bird A', speciesCode: 'a', locId: 'L1', locName: 'Loc One' }),
      rec({ comName: 'Bird B', speciesCode: 'b', locId: 'L1', locName: 'Loc One' }),
      rec({ comName: 'Bird C', speciesCode: 'c', locId: 'L2', locName: 'Loc Two' }),
    ]
    const out = buildNearbyLifers(records, new Set(), 38.5, -121.5, NOW)
    expect(out).toHaveLength(2)
    const l1 = out.find((l) => l.locId === 'L1')!
    expect(l1.locName).toBe('Loc One')
    expect(l1.lifers.map((x) => x.comName).sort()).toEqual(['Bird A', 'Bird B'])
  })
})

describe('buildNearbyLifers — distinct species count', () => {
  it('count = distinct speciesCodes at the location, not record count', () => {
    const records = [
      rec({ comName: 'Bird A', speciesCode: 'a', locId: 'L1', recentDate: '2026-06-01' }),
      // same species code reported again at same loc — distinct count stays 1 for it
      rec({ comName: 'Bird A', speciesCode: 'a', locId: 'L1', recentDate: '2026-06-05' }),
      rec({ comName: 'Bird B', speciesCode: 'b', locId: 'L1', recentDate: '2026-06-03' }),
    ]
    const out = buildNearbyLifers(records, new Set(), 38.5, -121.5, NOW)
    expect(out).toHaveLength(1)
    expect(out[0].count).toBe(2) // a, b — distinct codes
    expect(out[0].lifers).toHaveLength(3) // all records still listed
  })
})

describe('buildNearbyLifers — most-recent ordering within a location', () => {
  it('sorts a location\'s lifers newest-first by recentDate', () => {
    const records = [
      rec({ comName: 'Older', speciesCode: 'o', locId: 'L1', recentDate: '2026-06-01' }),
      rec({ comName: 'Newest', speciesCode: 'n', locId: 'L1', recentDate: '2026-06-10' }),
      rec({ comName: 'Middle', speciesCode: 'm', locId: 'L1', recentDate: '2026-06-05' }),
    ]
    const out = buildNearbyLifers(records, new Set(), 38.5, -121.5, NOW)
    expect(out[0].lifers.map((x) => x.comName)).toEqual(['Newest', 'Middle', 'Older'])
    expect(out[0].mostRecentDate).toBe('2026-06-10')
  })
})

describe('buildNearbyLifers — tier from newest report', () => {
  it('fresh (≤7 days), mid (≤15), old (>15) using the shared recencyTier', () => {
    const fresh = buildNearbyLifers(
      [rec({ locId: 'F', recentDate: isoDaysAgo(2) })], new Set(), 0, 0, NOW)
    const mid = buildNearbyLifers(
      [rec({ locId: 'M', recentDate: isoDaysAgo(10) })], new Set(), 0, 0, NOW)
    const old = buildNearbyLifers(
      [rec({ locId: 'O', recentDate: isoDaysAgo(25) })], new Set(), 0, 0, NOW)
    expect(fresh[0].tier).toBe('fresh')
    expect(mid[0].tier).toBe('mid')
    expect(old[0].tier).toBe('old')
  })

  it('tier reflects the newest record at the location, not the first seen', () => {
    const out = buildNearbyLifers([
      rec({ comName: 'Old one', speciesCode: 'o', locId: 'L1', recentDate: isoDaysAgo(25) }),
      rec({ comName: 'Fresh one', speciesCode: 'f', locId: 'L1', recentDate: isoDaysAgo(1) }),
    ], new Set(), 0, 0, NOW)
    expect(out[0].mostRecentDate).toBe(isoDaysAgo(1))
    expect(out[0].tier).toBe('fresh')
  })
})

describe('buildNearbyLifers — nearest-first sort', () => {
  it('orders locations by distance from the center, closest first', () => {
    const records = [
      // far: ~1 degree away
      rec({ comName: 'Far', speciesCode: 'far', locId: 'FAR', lat: 39.5, lng: -121.5 }),
      // near: right at the center
      rec({ comName: 'Near', speciesCode: 'near', locId: 'NEAR', lat: 38.5, lng: -121.5 }),
      // mid: ~0.5 degree away
      rec({ comName: 'Mid', speciesCode: 'mid', locId: 'MID', lat: 39.0, lng: -121.5 }),
    ]
    const out = buildNearbyLifers(records, new Set(), 38.5, -121.5, NOW)
    expect(out.map((l) => l.locId)).toEqual(['NEAR', 'MID', 'FAR'])
  })
})

describe('buildNearbyLifers — empty / all-filtered', () => {
  it('returns [] when no records', () => {
    expect(buildNearbyLifers([], new Set(), 38.5, -121.5, NOW)).toEqual([])
  })
  it('returns [] when every species is recorded', () => {
    const records = [rec({ comName: 'Recorded Bird' })]
    expect(buildNearbyLifers(records, new Set(['recorded bird']), 38.5, -121.5, NOW)).toEqual([])
  })
})

describe('isWithinWindow — boundaries (inclusive edges)', () => {
  // Fixed "now" at local midnight for deterministic day math.
  const now = new Date(2026, 5, 14).getTime() // 2026-06-14 local midnight

  function daysBefore(n: number): string {
    const d = new Date(2026, 5, 14)
    d.setDate(d.getDate() - n)
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  }

  it('same-day report (0 days) is always within any window', () => {
    expect(isWithinWindow(daysBefore(0), 1, now)).toBe(true)
    expect(isWithinWindow(daysBefore(0), 7, now)).toBe(true)
    expect(isWithinWindow(daysBefore(0), 30, now)).toBe(true)
  })

  it('window=1: exactly 1 day ago is inclusive, 2 days ago is out', () => {
    expect(isWithinWindow(daysBefore(1), 1, now)).toBe(true)
    expect(isWithinWindow(daysBefore(2), 1, now)).toBe(false)
  })

  it('window=7: exactly 7 days ago is inclusive, 8 days ago is out', () => {
    expect(isWithinWindow(daysBefore(7), 7, now)).toBe(true)
    expect(isWithinWindow(daysBefore(8), 7, now)).toBe(false)
  })

  it('window=30: exactly 30 days ago is inclusive, 31 days ago is out', () => {
    expect(isWithinWindow(daysBefore(30), 30, now)).toBe(true)
    expect(isWithinWindow(daysBefore(31), 30, now)).toBe(false)
  })

  it('a future date (negative days) is excluded', () => {
    const future = new Date(2026, 5, 20)
    const y = future.getFullYear()
    const m = String(future.getMonth() + 1).padStart(2, '0')
    const day = String(future.getDate()).padStart(2, '0')
    expect(isWithinWindow(`${y}-${m}-${day}`, 30, now)).toBe(false)
  })

  it('accepts a "YYYY-MM-DD HH:MM" form (leading date used)', () => {
    expect(isWithinWindow(`${daysBefore(3)} 08:15`, 7, now)).toBe(true)
    expect(isWithinWindow(`${daysBefore(10)} 08:15`, 7, now)).toBe(false)
  })

  it('a malformed or empty date is excluded', () => {
    expect(isWithinWindow('', 30, now)).toBe(false)
    expect(isWithinWindow('not-a-date', 30, now)).toBe(false)
    expect(isWithinWindow('2026-06', 30, now)).toBe(false)
  })
})
