import { describe, it, expect } from 'vitest'
import { nextShadingState, type ShadingState } from './shadingExclusion'

describe('nextShadingState — Map Explorer shade mutual exclusion', () => {
  it('turning breeding shade ON clears county shade', () => {
    expect(nextShadingState('breeding', { shadeByBreeding: false, shadeByCounty: true }))
      .toEqual({ shadeByBreeding: true, shadeByCounty: false })
  })

  it('turning county shade ON clears breeding shade', () => {
    expect(nextShadingState('county', { shadeByBreeding: true, shadeByCounty: false }))
      .toEqual({ shadeByBreeding: false, shadeByCounty: true })
  })

  it('turning breeding ON from all-off sets only breeding', () => {
    expect(nextShadingState('breeding', { shadeByBreeding: false, shadeByCounty: false }))
      .toEqual({ shadeByBreeding: true, shadeByCounty: false })
  })

  it('turning county ON from all-off sets only county', () => {
    expect(nextShadingState('county', { shadeByBreeding: false, shadeByCounty: false }))
      .toEqual({ shadeByBreeding: false, shadeByCounty: true })
  })

  it('turning breeding shade OFF leaves the other untouched', () => {
    expect(nextShadingState('breeding', { shadeByBreeding: true, shadeByCounty: false }))
      .toEqual({ shadeByBreeding: false, shadeByCounty: false })
  })

  it('turning county shade OFF leaves the other untouched', () => {
    expect(nextShadingState('county', { shadeByBreeding: false, shadeByCounty: true }))
      .toEqual({ shadeByBreeding: false, shadeByCounty: false })
  })

  it('invariant: the next state never has both shadings on', () => {
    const states: ShadingState[] = [
      { shadeByBreeding: false, shadeByCounty: false },
      { shadeByBreeding: true, shadeByCounty: false },
      { shadeByBreeding: false, shadeByCounty: true },
    ]
    for (const prev of states) {
      for (const which of ['breeding', 'county'] as const) {
        const next = nextShadingState(which, prev)
        expect(next.shadeByBreeding && next.shadeByCounty).toBe(false)
      }
    }
  })
})
