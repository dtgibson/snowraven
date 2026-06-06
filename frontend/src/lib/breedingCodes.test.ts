import { describe, it, expect } from 'vitest'
import {
  BREEDING_CODES, CATEGORY_CODES,
  apiBreedingToDisplay, resolveApiBreedingCode, strongerBreeding,
} from './breedingCodes'

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

describe('apiBreedingToDisplay', () => {
  it('translates eBird internal API codes to display codes', () => {
    expect(apiBreedingToDisplay('S1')).toBe('S')
    expect(apiBreedingToDisplay('PO')).toBe('P')
    expect(apiBreedingToDisplay('CC')).toBe('C')
    expect(apiBreedingToDisplay('CM')).toBe('CN')
    expect(apiBreedingToDisplay('VS')).toBe('N')
    expect(apiBreedingToDisplay('AB')).toBe('A')
    expect(apiBreedingToDisplay('OS')).toBe('H')
    expect(apiBreedingToDisplay('SM')).toBe('M')
    expect(apiBreedingToDisplay('T7')).toBe('T')
    expect(apiBreedingToDisplay('FO')).toBe('F')
  })
  it('handles the FY/FR collision correctly', () => {
    // API "FY" is Carrying Food (CF); API "FR" is Feeding Young (FY).
    expect(apiBreedingToDisplay('FY')).toBe('CF')
    expect(apiBreedingToDisplay('FR')).toBe('FY')
  })
  it('passes through codes already in display form / unknown codes', () => {
    expect(apiBreedingToDisplay('S7')).toBe('S7')
    expect(apiBreedingToDisplay('NY')).toBe('NY')
    expect(apiBreedingToDisplay('???')).toBe('???')
  })
})

describe('resolveApiBreedingCode', () => {
  it('resolves API code to display def with correct label + tier', () => {
    expect(resolveApiBreedingCode('S1')).toMatchObject({ code: 'S', label: 'Singing Bird', tier: 1 })
    expect(resolveApiBreedingCode('NY')).toMatchObject({ code: 'NY', tier: 4 })
    // The collision must not mislabel: API "FY" → Carrying Food, not Feeding Young.
    expect(resolveApiBreedingCode('FY').label).toBe('Carrying Food')
  })
  it('falls back to a tier-1 def with the raw code for unknown codes', () => {
    expect(resolveApiBreedingCode('ZZ')).toEqual({ code: 'ZZ', label: 'ZZ', tier: 1 })
  })
})

describe('strongerBreeding', () => {
  it('returns the stronger (higher-tier) of two API codes', () => {
    expect(strongerBreeding('S1', 'NY')?.code).toBe('NY')   // possible vs confirmed
    expect(strongerBreeding('CC', 'S1')?.code).toBe('C')    // probable vs possible
  })
  it('handles nulls', () => {
    expect(strongerBreeding(null, 'S1')?.code).toBe('S')
    expect(strongerBreeding('NY', null)?.code).toBe('NY')
    expect(strongerBreeding(null, null)).toBeNull()
  })
})
