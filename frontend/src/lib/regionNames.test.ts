import { describe, it, expect } from 'vitest'
import { isSubnationalCode, regionName } from './regionNames'

describe('regionName', () => {
  it('maps US state codes to names', () => {
    expect(regionName('US-MN')).toBe('Minnesota')
    expect(regionName('US-CA')).toBe('California')
    expect(regionName('US-NY')).toBe('New York')
  })

  it('maps US territories and DC', () => {
    expect(regionName('US-DC')).toBe('Washington, D.C.')
    expect(regionName('US-PR')).toBe('Puerto Rico')
  })

  it('maps Canadian provinces and territories', () => {
    expect(regionName('CA-ON')).toBe('Ontario')
    expect(regionName('CA-BC')).toBe('British Columbia')
    expect(regionName('CA-NL')).toBe('Newfoundland and Labrador')
  })

  it('falls back to the raw code for regions it does not know', () => {
    expect(regionName('MX-ROO')).toBe('MX-ROO')
    expect(regionName('GB-ENG')).toBe('GB-ENG')
    expect(regionName('US-ZZ')).toBe('US-ZZ')
  })

  it('returns empty string for null / undefined / empty', () => {
    expect(regionName(null)).toBe('')
    expect(regionName(undefined)).toBe('')
    expect(regionName('')).toBe('')
  })
})

describe('a State/Province cell named after a prototype member (idea 25608818)', () => {
  // Built with JSON.parse, so each is an own string the way a cell arrives.
  const HOSTILE: string[] = JSON.parse('["US-__proto__","US-constructor","US-toString","US-hasOwnProperty","CA-__proto__","CA-valueOf"]')

  it('falls back to the raw code, never an inherited member', () => {
    for (const code of HOSTILE) expect(regionName(code), code).toBe(code)
  })
})

describe('isSubnationalCode: the only shape that becomes an ebird.org/region link', () => {
  it('admits every State/Province code in the stored backup, and other real shapes', () => {
    for (const c of ['US-CA', 'US-MD', 'US-HI', 'US-NV', 'CH-VS', 'FR-ARA', 'CH-GE', 'IT-23', 'MX-ROO', 'GB-ENG', 'CA-ON']) {
      expect(isSubnationalCode(c), c).toBe(true)
    }
  })

  it('refuses everything else, including what the old includes-a-hyphen gate let through', () => {
    for (const c of ['US-__proto__', 'us-ca', 'US-CA-085', 'US-CALI', 'US-CA\n', ' US-CA', 'US-', '-CA', 'U-CA', 'US_CA', 'US-C/A', '']) {
      expect(isSubnationalCode(c), JSON.stringify(c)).toBe(false)
    }
    for (const v of [null, undefined, 7, {}, ['US-CA']]) expect(isSubnationalCode(v), String(v)).toBe(false)
  })
})
