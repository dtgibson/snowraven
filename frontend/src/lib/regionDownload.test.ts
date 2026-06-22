import { describe, it, expect } from 'vitest'
import {
  regionForPoint,
  pickActiveRegion,
  isRegionStale,
  formatRegionMB,
  STALE_MS,
} from './regionDownload'
import type { RegionEntry } from './storage'

// A RegionEntry fixture — extent is [w, s, e, n] WGS84.
function region(overrides: Partial<RegionEntry> = {}): RegionEntry {
  return {
    regionId: 'us-ca-marin',
    name: 'Marin County, CA',
    kind: 'county',
    stateCode: 'US-CA',
    countyName: 'Marin',
    extent: [-123.0, 37.8, -122.4, 38.3],
    minZoom: 0,
    maxZoom: 14,
    bytes: 24 * 1024 * 1024,
    downloadedAt: 1_700_000_000_000,
    sourceVersion: '2026.06',
    ...overrides,
  }
}

describe('regionForPoint (FR-17 point-in-region)', () => {
  const marin = region()
  it('returns the region whose extent contains the point', () => {
    expect(regionForPoint(-122.7, 38.0, [marin])?.regionId).toBe('us-ca-marin')
  })
  it('returns null when the point is outside every extent', () => {
    expect(regionForPoint(-100, 45, [marin])).toBeNull()
  })
  it('picks the most-recently-downloaded when extents overlap', () => {
    const older = region({ regionId: 'us-ca-a', downloadedAt: 1000 })
    const newer = region({ regionId: 'us-ca-b', downloadedAt: 2000 })
    expect(regionForPoint(-122.7, 38.0, [older, newer])?.regionId).toBe('us-ca-b')
  })
})

describe('pickActiveRegion (FR-17 base-swap gate)', () => {
  const marin = region()
  it('null unless offline AND enabled AND a region covers the center', () => {
    const inside = { lng: -122.7, lat: 38.0 }
    // Online → null (Tier-A persisted base stays).
    expect(pickActiveRegion(inside.lng, inside.lat, [marin], { offline: false, enabled: true })).toBeNull()
    // Disabled → null.
    expect(pickActiveRegion(inside.lng, inside.lat, [marin], { offline: true, enabled: false })).toBeNull()
    // No regions → null.
    expect(pickActiveRegion(inside.lng, inside.lat, [], { offline: true, enabled: true })).toBeNull()
    // Outside coverage → null.
    expect(pickActiveRegion(-100, 45, [marin], { offline: true, enabled: true })).toBeNull()
  })
  it('returns the covering region when offline + enabled + inside', () => {
    const r = pickActiveRegion(-122.7, 38.0, [marin], { offline: true, enabled: true })
    expect(r?.regionId).toBe('us-ca-marin')
  })
})

describe('isRegionStale (FR-19 / OQ-05)', () => {
  const now = 2_000_000_000_000
  it('fresh when version matches and within the staleness window', () => {
    const r = region({ downloadedAt: now - 1000, sourceVersion: '2026.06' })
    expect(isRegionStale(r, '2026.06', now)).toBe(false)
  })
  it('stale when the bake version no longer matches the catalog', () => {
    const r = region({ downloadedAt: now - 1000, sourceVersion: '2025.01' })
    expect(isRegionStale(r, '2026.06', now)).toBe(true)
  })
  it('stale once older than STALE_MS', () => {
    const r = region({ downloadedAt: now - STALE_MS - 1, sourceVersion: '2026.06' })
    expect(isRegionStale(r, '2026.06', now)).toBe(true)
  })
})

describe('formatRegionMB', () => {
  it('rounds to whole MB', () => {
    expect(formatRegionMB(41 * 1024 * 1024)).toBe('41 MB')
  })
  it('shows <1 MB for sub-megabyte and 0 MB for empty', () => {
    expect(formatRegionMB(500 * 1024)).toBe('<1 MB')
    expect(formatRegionMB(0)).toBe('0 MB')
  })
})
