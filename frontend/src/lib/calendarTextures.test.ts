import { describe, it, expect } from 'vitest'
import {
  CAL_TIERS, CAL_HATCH, CAL_MINI_HATCH, calHatchDensity, calMiniHatchDensity,
  calHatchSpec, calHatchCss, calMiniHatchCss, type CalTier,
} from './calendarTextures'

// Mirrors countyTextures.test.ts's MIN_ADJ_RATIO floor: adjacent tiers must be a
// clear density step apart (the county guard uses 1.12).
const MIN_ADJ_RATIO = 1.12

describe('calHatchDensity — big-cell crosshatch (QA-26)', () => {
  it('is strictly monotonic increasing across tiers 1..5', () => {
    for (let i = 1; i < CAL_TIERS.length; i++) {
      expect(calHatchDensity(CAL_TIERS[i])).toBeGreaterThan(calHatchDensity(CAL_TIERS[i - 1]))
    }
  })

  it('every adjacency clears the density-step floor', () => {
    for (let i = 1; i < CAL_TIERS.length; i++) {
      const ratio = calHatchDensity(CAL_TIERS[i]) / calHatchDensity(CAL_TIERS[i - 1])
      expect(ratio).toBeGreaterThanOrEqual(MIN_ADJ_RATIO)
    }
  })
})

describe('calMiniHatchDensity — simplified Year-Overview hatch (QA-48)', () => {
  it('is strictly monotonic increasing across tiers 1..5', () => {
    for (let i = 1; i < CAL_TIERS.length; i++) {
      expect(calMiniHatchDensity(CAL_TIERS[i])).toBeGreaterThan(calMiniHatchDensity(CAL_TIERS[i - 1]))
    }
  })

  it('every adjacency clears the density-step floor', () => {
    for (let i = 1; i < CAL_TIERS.length; i++) {
      const ratio = calMiniHatchDensity(CAL_TIERS[i]) / calMiniHatchDensity(CAL_TIERS[i - 1])
      expect(ratio).toBeGreaterThanOrEqual(MIN_ADJ_RATIO)
    }
  })
})

describe('specs and CSS emit from the single source table', () => {
  it('calHatchSpec returns the CAL_HATCH entry for a tier', () => {
    for (const t of CAL_TIERS) expect(calHatchSpec(t)).toEqual(CAL_HATCH[t])
  })

  it('calHatchCss references the tier rgb token and both diagonals', () => {
    const css = calHatchCss(3)
    expect(css.backgroundColor).toContain('var(--sr-cal-3-rgb)')
    expect(css.background).toContain('45deg')
    expect(css.background).toContain('135deg')
    // gap/weight come from the spec
    expect(css.background).toContain(`${CAL_HATCH[3].lineWidthPx}px`)
    expect(css.background).toContain(`${CAL_HATCH[3].gapPx}px`)
  })

  it('calMiniHatchCss is a single 45° diagonal (no 135°) from the mini spec', () => {
    const css = calMiniHatchCss(4)
    expect(css.backgroundColor).toContain('var(--sr-cal-4-rgb)')
    expect(css.background).toContain('45deg')
    expect(css.background).not.toContain('135deg')
    expect(css.background).toContain(`${CAL_MINI_HATCH[4].gapPx}px`)
  })

  it('every tier 1..5 has both a big and a mini spec', () => {
    for (const t of [1, 2, 3, 4, 5] as CalTier[]) {
      expect(CAL_HATCH[t]).toBeDefined()
      expect(CAL_MINI_HATCH[t]).toBeDefined()
    }
  })
})
