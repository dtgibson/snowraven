import { describe, it, expect } from 'vitest'
import { regionName } from './regionNames'

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
