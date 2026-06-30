// Pattern-legibility guard for the county "Use Textures" density ramp (the
// colorblind analogue of countyContrast.test.ts, which guards the COLOR ramp).
// Density — not hue or luminance — carries the tier, so this test is pure and
// theme-independent: it asserts the geometry, not the token values. A future
// tweak that flattens the density curve (so two tiers blur) fails here rather than
// the user's eyes (NFR-01 / QA-22).

import { describe, it, expect } from 'vitest'
import {
  countyHatchDensity, countyHatchTierForImage,
  COUNTY_HATCH_IMAGE_ID, COUNTY_TIERS, type CountyTier,
} from './countyTextures'

// Actual minimum adjacency ratio of the shipped curve is ~1.195 (tier 7→8); this
// floor leaves margin so a flattening tweak trips the test before it ships.
const MIN_ADJ_RATIO = 1.12

describe('county hatch density ramp', () => {
  it('covers exactly tiers 1..10', () => {
    expect(COUNTY_TIERS).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
  })

  it('is strictly monotonic increasing from tier 1 to tier 10 (FR-05 / QA-05)', () => {
    for (let n = 2; n <= 10; n++) {
      expect(countyHatchDensity(n as CountyTier)).toBeGreaterThan(countyHatchDensity((n - 1) as CountyTier))
    }
  })

  it('keeps adjacent tiers density-distinguishable (>= MIN_ADJ_RATIO) (FR-06 / QA-06/07)', () => {
    for (let n = 2; n <= 10; n++) {
      const ratio = countyHatchDensity(n as CountyTier) / countyHatchDensity((n - 1) as CountyTier)
      expect(ratio).toBeGreaterThanOrEqual(MIN_ADJ_RATIO)
    }
  })

  it('has a distinct sprite id for all 10 tiers', () => {
    const ids = COUNTY_TIERS.map(t => COUNTY_HATCH_IMAGE_ID[t])
    expect(ids).toHaveLength(10)
    expect(new Set(ids).size).toBe(10)
    for (const t of COUNTY_TIERS) {
      expect(COUNTY_HATCH_IMAGE_ID[t]).toBe(`sr-county-hatch-${t}`)
    }
  })

  it('round-trips every sprite id and returns null for a foreign id', () => {
    for (const t of COUNTY_TIERS) {
      expect(countyHatchTierForImage(COUNTY_HATCH_IMAGE_ID[t])).toBe(t)
    }
    expect(countyHatchTierForImage('sr-atlas-hatch-1')).toBeNull()
    expect(countyHatchTierForImage('sr-county-hatch-0')).toBeNull()
    expect(countyHatchTierForImage('sr-county-hatch-11')).toBeNull()
    expect(countyHatchTierForImage('not-ours')).toBeNull()
  })
})
