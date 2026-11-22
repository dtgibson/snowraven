// The two family link builders (family-rollups-and-tree schema 10; FR-47 to
// FR-50; QA-47, QA-48, QA-49's builder half). Both ship OFF: their flags are
// false until a person's look in a browser verifies each URL shape. The
// `verified` parameter drives the built branch here while the shipped
// constants stay false.

import { describe, it, expect } from 'vitest'
import {
  BOW_FAMILY_LINK_VERIFIED, FAMILY_CODE_RE, ML_FAMILY_LINK_VERIFIED, bowFamilyHref, mlFamilyHref,
} from './familyTreeLinks'
import { ML_CATALOG_BASE } from './statsFormat'

describe('the shipped flags', () => {
  it('both family links ship off (D-12)', () => {
    expect(BOW_FAMILY_LINK_VERIFIED).toBe(false)
    expect(ML_FAMILY_LINK_VERIFIED).toBe(false)
  })
  it('so neither builder returns a link at its defaults', () => {
    expect(bowFamilyHref('anatid1')).toBeNull()
    expect(mlFamilyHref('anatid1', 'Photo', 'ABC123')).toBeNull()
  })
})

describe('the verified branch', () => {
  it('builds the Birds of the World family account on the host the species marks already use', () => {
    const href = bowFamilyHref('anatid1', true)!
    const url = new URL(href)
    expect(url.protocol).toBe('https:')
    expect(url.host).toBe('birdsoftheworld.org')
    expect(url.pathname).toBe('/bow/species/anatid1/cur/introduction')
  })
  it('builds the own-media link through the shipped catalog builder, with the family code as taxonCode', () => {
    const href = mlFamilyHref('anatid1', 'Audio', 'ABC123', true)!
    expect(href.startsWith(`${ML_CATALOG_BASE}?`)).toBe(true)
    const url = new URL(href)
    expect(url.searchParams.get('taxonCode')).toBe('anatid1')
    expect(url.searchParams.get('mediaType')).toBe('audio')
    expect(url.searchParams.get('userId')).toBe('ABC123')
  })
  it('refuses a code outside the family-code shape, so no link is built from it', () => {
    for (const bad of ['anatid1/../x', 'https://e.vil/1', 'anatid1?x=1', '__proto__', 'constructor', '', 'ANATID1', 'anatid1%2f']) {
      expect(bowFamilyHref(bad, true), bad).toBeNull()
      expect(mlFamilyHref(bad, 'Photo', null, true), bad).toBeNull()
      expect(FAMILY_CODE_RE.test(bad), bad).toBe(false)
    }
  })
})
