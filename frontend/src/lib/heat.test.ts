import { describe, it, expect } from 'vitest'
import {
  HEAT_INTENSITY_DEFAULT,
  heatRadiusPx,
  heatIntensityFactor,
  heatWeight,
} from './heat'

// The heat model is the single source of truth shared by the Map Explorer and
// Species Detail MapLibre heatmaps. These tests lock the tuned curve (notably
// the default intensity → 0.30 that Dave dialed in) so it can't silently drift.

describe('HEAT_INTENSITY_DEFAULT', () => {
  it('is the slider midpoint, within the 1–10 range', () => {
    expect(HEAT_INTENSITY_DEFAULT).toBe(5)
    expect(HEAT_INTENSITY_DEFAULT).toBeGreaterThanOrEqual(1)
    expect(HEAT_INTENSITY_DEFAULT).toBeLessThanOrEqual(10)
  })
})

describe('heatRadiusPx', () => {
  it('maps the slider ends and midpoint to bounded pixel radii', () => {
    expect(heatRadiusPx(1)).toBe(18)
    expect(heatRadiusPx(5)).toBe(42)
    expect(heatRadiusPx(10)).toBe(72)
  })

  it('increases monotonically with intensity', () => {
    for (let i = 2; i <= 10; i++) {
      expect(heatRadiusPx(i)).toBeGreaterThan(heatRadiusPx(i - 1))
    }
  })

  it('returns an integer pixel value', () => {
    for (let i = 1; i <= 10; i++) {
      expect(Number.isInteger(heatRadiusPx(i))).toBe(true)
    }
  })
})

describe('heatIntensityFactor', () => {
  it('lands the default (5) at the tuned 0.30', () => {
    expect(heatIntensityFactor(HEAT_INTENSITY_DEFAULT)).toBe(0.3)
  })

  it('spans the tuned range 0.06 (subtle) → 0.60 (hot)', () => {
    expect(heatIntensityFactor(1)).toBe(0.06)
    expect(heatIntensityFactor(10)).toBe(0.6)
  })

  it('increases monotonically with intensity', () => {
    for (let i = 2; i <= 10; i++) {
      expect(heatIntensityFactor(i)).toBeGreaterThan(heatIntensityFactor(i - 1))
    }
  })

  it('rounds to at most two decimal places', () => {
    for (let i = 1; i <= 10; i++) {
      const v = heatIntensityFactor(i)
      expect(Math.round(v * 100)).toBeCloseTo(v * 100, 6)
    }
  })
})

describe('heatWeight', () => {
  it('never exceeds 1 even for huge counts', () => {
    expect(heatWeight(10_000, 1)).toBe(1)
    expect(heatWeight(10_000, 5)).toBe(1)
    expect(heatWeight(10_000, 10)).toBe(1)
  })

  it('is 0 for a zero count', () => {
    expect(heatWeight(0, 5)).toBe(0)
  })

  it('uses a divisor of 20 at intensity 1 (count-proportional)', () => {
    expect(heatWeight(10, 1)).toBeCloseTo(0.5, 5)
    expect(heatWeight(20, 1)).toBe(1)
  })

  it('uses a divisor of 12 at the default intensity 5', () => {
    expect(heatWeight(6, 5)).toBeCloseTo(0.5, 5)
    expect(heatWeight(12, 5)).toBe(1)
  })

  it('saturates almost any sighting at intensity 10 (divisor 2)', () => {
    expect(heatWeight(1, 10)).toBeCloseTo(0.5, 5)
    expect(heatWeight(2, 10)).toBe(1)
  })

  it('gives a higher weight for the same count as intensity rises', () => {
    for (let i = 2; i <= 10; i++) {
      expect(heatWeight(3, i)).toBeGreaterThanOrEqual(heatWeight(3, i - 1))
    }
    // strictly higher across the full span for a low count
    expect(heatWeight(3, 10)).toBeGreaterThan(heatWeight(3, 1))
  })
})
