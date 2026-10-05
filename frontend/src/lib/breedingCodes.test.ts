import { describe, it, expect } from 'vitest'
import {
  BREEDING_CODES, CATEGORY_CODES,
  apiBreedingToDisplay, resolveApiBreedingCode, strongerBreeding,
  resolveDisplayBreedingCode, compareBreedingDefs, strongerBreedingDef,
  breedingCategoryForTier, BREEDING_CATEGORY_ORDER, BREEDING_CATEGORY_LABELS,
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

// breeding-code-lookup-hasown: the API code is an unvalidated string from eBird
// and the table is an ordinary object literal. These twelve are the names a bare
// index resolves to an inherited member; each must take the unknown-code
// fallback exactly as `ZZ` does (security.md, lookup tables keyed by an
// unvalidated string).
const PROTOTYPE_CHAIN = [
  'constructor', '__proto__', 'toString', 'valueOf', 'hasOwnProperty',
  'isPrototypeOf', 'toLocaleString', 'propertyIsEnumerable',
  '__defineGetter__', '__defineSetter__', '__lookupGetter__', '__lookupSetter__',
]

describe('inherited member names are unknown codes (breeding-code-lookup-hasown)', () => {
  it.each(PROTOTYPE_CHAIN)('apiBreedingToDisplay(%s) returns the raw code, as a string', name => {
    const out: unknown = apiBreedingToDisplay(name)
    expect(typeof out).toBe('string')
    expect(out).toBe(name)
  })

  it.each(PROTOTYPE_CHAIN)('resolveApiBreedingCode(%s) is the tier-1 fallback def', name => {
    const def = resolveApiBreedingCode(name)
    expect(typeof def.code).toBe('string')
    expect(typeof def.label).toBe('string')
    expect(def).toEqual({ code: name, label: name, tier: 1 })
  })

  it('a JSON.parse payload carrying an own __proto__ changes no lookup', () => {
    // JSON.parse, never an object literal: a literal `{ __proto__: ... }` sets
    // the prototype and makes no own key, a shape the wire cannot deliver.
    const payload = JSON.parse('{"breedingCode":"__proto__","__proto__":{"XX":"NY"}}') as Record<string, unknown>
    expect(Object.hasOwn(payload, '__proto__')).toBe(true)
    expect(Object.hasOwn(Object.prototype, 'XX')).toBe(false)
    // The code read off the parsed payload, and the key the payload smuggled in.
    expect(apiBreedingToDisplay(payload.breedingCode as string)).toBe('__proto__')
    expect(apiBreedingToDisplay('XX')).toBe('XX')
    expect(resolveApiBreedingCode('XX')).toEqual({ code: 'XX', label: 'XX', tier: 1 })
    // Known codes still translate through the guarded read.
    expect(resolveApiBreedingCode('S1')).toMatchObject({ code: 'S', tier: 1 })
    expect(resolveApiBreedingCode('FY')).toMatchObject({ code: 'CF', tier: 4 })
    expect(resolveApiBreedingCode('S7')).toMatchObject({ code: 'S7', tier: 2 })
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

// calendar-overlays: the display-code resolver and the rank comparator the
// Calendar's per-day code list sorts on. The resolveApiBreedingCode and
// strongerBreeding rows above are unedited: they now run through these
// functions, so their staying green is the proof the refactor is identical.
describe('resolveDisplayBreedingCode (calendar-overlays, FR-12)', () => {
  it('looks a backup display code up directly, never through the API translation (QA-11)', () => {
    // The backup's FY is Feeding Young. Through the API table it would become
    // Carrying Food, which is exactly the mislabel FR-12 forbids.
    expect(resolveDisplayBreedingCode('FY')).toMatchObject({ code: 'FY', label: 'Feeding Young', tier: 4 })
    expect(resolveDisplayBreedingCode('NY').tier).toBe(4)
    expect(resolveDisplayBreedingCode('NB').tier).toBe(3)
    expect(resolveDisplayBreedingCode('A').tier).toBe(2)
    expect(resolveDisplayBreedingCode('S').tier).toBe(1)
  })
  it('an unknown code is tier 1 with its raw text as code and label (QA-12)', () => {
    expect(resolveDisplayBreedingCode('ZZ')).toEqual({ code: 'ZZ', label: 'ZZ', tier: 1 })
    // Case is not folded: a lowercase spelling is its own, unknown code.
    expect(resolveDisplayBreedingCode('ny')).toEqual({ code: 'ny', label: 'ny', tier: 1 })
  })
})

describe('compareBreedingDefs / strongerBreedingDef (calendar-overlays, FR-13)', () => {
  const d = resolveDisplayBreedingCode
  it('orders known codes by the table rank, strongest first', () => {
    expect(compareBreedingDefs(d('NY'), d('S'))).toBeLessThan(0)
    expect(compareBreedingDefs(d('S'), d('A'))).toBeGreaterThan(0)
    expect(compareBreedingDefs(d('A'), d('A'))).toBe(0)
  })
  it('ranks every known code above every unknown one, even a tier-1 known code', () => {
    expect(compareBreedingDefs(d('F'), d('ZZ'))).toBeLessThan(0)
    expect(compareBreedingDefs(d('ZZ'), d('F'))).toBeGreaterThan(0)
  })
  it('two unknown codes compare EQUAL, never NaN, so a stable sort keeps first-seen order', () => {
    const c = compareBreedingDefs(d('ZZ'), d('QQ'))
    expect(c).toBe(0)
    expect(Number.isNaN(c)).toBe(false)
    const sorted = [d('ZZ'), d('QQ'), d('S'), d('XY')].sort(compareBreedingDefs).map(x => x.code)
    expect(sorted).toEqual(['S', 'ZZ', 'QQ', 'XY'])
  })
  it('strongerBreedingDef keeps `a` on a tie and handles nulls', () => {
    const zz = d('ZZ'), qq = d('QQ')
    expect(strongerBreedingDef(zz, qq)).toBe(zz)
    expect(strongerBreedingDef(qq, zz)).toBe(qq)
    expect(strongerBreedingDef(d('S'), d('NY'))?.code).toBe('NY')
    expect(strongerBreedingDef(null, zz)).toBe(zz)
    expect(strongerBreedingDef(zz, null)).toBe(zz)
    expect(strongerBreedingDef(null, null)).toBeNull()
  })
})

describe('breeding categories (calendar-overlays)', () => {
  it('breedingCategoryForTier maps all four tiers', () => {
    expect(breedingCategoryForTier(4)).toBe('confirmed')
    expect(breedingCategoryForTier(3)).toBe('confirmed')
    expect(breedingCategoryForTier(2)).toBe('probable')
    expect(breedingCategoryForTier(1)).toBe('possible')
  })
  it('agrees with CATEGORY_CODES for every code in the table', () => {
    for (const def of BREEDING_CODES) {
      expect(CATEGORY_CODES[breedingCategoryForTier(def.tier)].has(def.code)).toBe(true)
    }
  })
  it('orders strongest first and names each category', () => {
    expect(BREEDING_CATEGORY_ORDER).toEqual(['confirmed', 'probable', 'possible'])
    expect(BREEDING_CATEGORY_LABELS).toEqual({ confirmed: 'Confirmed', probable: 'Probable', possible: 'Possible' })
  })
})
