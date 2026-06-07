import { describe, it, expect } from 'vitest'
import { haversineMiles, isInUS, nearestStation, classifyTideLocation } from './tideStations'

describe('haversineMiles', () => {
  it('is ~0 for the same point', () => {
    expect(haversineMiles(37.8, -122.4, 37.8, -122.4)).toBeCloseTo(0, 5)
  })
  it('matches a known distance (SF -> LA ~ 347 mi)', () => {
    const d = haversineMiles(37.7749, -122.4194, 34.0522, -118.2437)
    expect(d).toBeGreaterThan(340)
    expect(d).toBeLessThan(360)
  })
})

describe('isInUS', () => {
  it('accepts CONUS / HI / Alaska points', () => {
    expect(isInUS(37.8, -122.4)).toBe(true)   // San Francisco
    expect(isInUS(21.3, -157.8)).toBe(true)   // Honolulu
    expect(isInUS(61.2, -149.9)).toBe(true)   // Anchorage
    expect(isInUS(18.4, -66.1)).toBe(true)    // San Juan PR
  })
  it('rejects clearly foreign points', () => {
    expect(isInUS(51.5, -0.12)).toBe(false)   // London
    expect(isInUS(-18.1, 178.4)).toBe(false)  // Fiji
    expect(isInUS(35.7, 139.7)).toBe(false)   // Tokyo
  })
})

describe('nearestStation', () => {
  it('finds a real US station within a few miles of a coastal point', () => {
    const n = nearestStation(37.806, -122.465) // SF Bay near the Golden Gate
    expect(n).not.toBeNull()
    expect(n!.distanceMi).toBeLessThan(15)
    expect(n!.station.id).toMatch(/^\d+$/)
  })
  it('preferObs can return a gauge station', () => {
    const n = nearestStation(37.806, -122.465, { preferObs: true })
    expect(n).not.toBeNull()
  })
})

describe('classifyTideLocation', () => {
  it('ok when a station is within range', () => {
    const n = nearestStation(37.806, -122.465)
    expect(classifyTideLocation(37.806, -122.465, n)).toBe('ok')
  })
  it('outside-us for a foreign point regardless of distance', () => {
    const n = nearestStation(51.5, -0.12)
    expect(classifyTideLocation(51.5, -0.12, n)).toBe('outside-us')
  })
  it('too-far for an inland US point with no nearby station', () => {
    const n = nearestStation(39.74, -104.99) // Denver — far from tidal water
    expect(classifyTideLocation(39.74, -104.99, n)).toBe('too-far')
  })
})
