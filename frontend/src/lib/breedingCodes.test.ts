import { describe, it, expect } from 'vitest'
import { BREEDING_CODES, CATEGORY_CODES } from './breedingCodes'

describe('CATEGORY_CODES', () => {
  it('confirmed contains all tier 3 and 4 codes', () => {
    const expected = BREEDING_CODES.filter(d => d.tier >= 3).map(d => d.code)
    expect(CATEGORY_CODES.confirmed.size).toBe(expected.length)
    for (const code of expected) {
      expect(CATEGORY_CODES.confirmed.has(code)).toBe(true)
    }
  })

  it('probable contains all tier 2 codes', () => {
    const expected = BREEDING_CODES.filter(d => d.tier === 2).map(d => d.code)
    expect(CATEGORY_CODES.probable.size).toBe(expected.length)
    for (const code of expected) {
      expect(CATEGORY_CODES.probable.has(code)).toBe(true)
    }
  })

  it('possible contains all tier 1 codes', () => {
    const expected = BREEDING_CODES.filter(d => d.tier === 1).map(d => d.code)
    expect(CATEGORY_CODES.possible.size).toBe(expected.length)
    for (const code of expected) {
      expect(CATEGORY_CODES.possible.has(code)).toBe(true)
    }
  })

  it('categories are disjoint', () => {
    for (const code of CATEGORY_CODES.confirmed) {
      expect(CATEGORY_CODES.probable.has(code)).toBe(false)
      expect(CATEGORY_CODES.possible.has(code)).toBe(false)
    }
    for (const code of CATEGORY_CODES.probable) {
      expect(CATEGORY_CODES.possible.has(code)).toBe(false)
    }
  })

  it('categories cover every defined code', () => {
    const all = new Set([
      ...CATEGORY_CODES.confirmed,
      ...CATEGORY_CODES.probable,
      ...CATEGORY_CODES.possible,
    ])
    for (const { code } of BREEDING_CODES) {
      expect(all.has(code)).toBe(true)
    }
  })

  it('NY NE FS FY CF FL ON UN DD NB CN are confirmed', () => {
    const codes = ['NY', 'NE', 'FS', 'FY', 'CF', 'FL', 'ON', 'UN', 'DD', 'NB', 'CN']
    for (const code of codes) {
      expect(CATEGORY_CODES.confirmed.has(code)).toBe(true)
    }
  })

  it('PE B A N C T P M S7 are probable', () => {
    const codes = ['PE', 'B', 'A', 'N', 'C', 'T', 'P', 'M', 'S7']
    for (const code of codes) {
      expect(CATEGORY_CODES.probable.has(code)).toBe(true)
    }
  })

  it('S H F are possible', () => {
    expect(CATEGORY_CODES.possible.has('S')).toBe(true)
    expect(CATEGORY_CODES.possible.has('H')).toBe(true)
    expect(CATEGORY_CODES.possible.has('F')).toBe(true)
  })
})
