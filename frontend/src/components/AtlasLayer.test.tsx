// @vitest-environment jsdom
//
// The styleimagemissing safety net in AtlasLayer must bake hatch sprites only
// for ids it owns and ignore every other id (other layers may legitimately
// miss images). The map-facing handler is a thin wrapper around this reverse
// lookup — locking the lookup here tests the ownership contract without
// mocking a GL map.

import { describe, it, expect } from 'vitest'
import { hatchTierForImage } from './AtlasLayer'
import { TIERS, HATCH_IMAGE_ID } from '../lib/atlasTextures'

describe('hatchTierForImage', () => {
  it('maps every hatch sprite id back to its tier', () => {
    for (const tier of TIERS) {
      expect(hatchTierForImage(HATCH_IMAGE_ID[tier])).toBe(tier)
    }
  })

  it('ignores foreign ids', () => {
    expect(hatchTierForImage('sr-pin-visited')).toBeNull()
    expect(hatchTierForImage('sr-atlas-hatch-5')).toBeNull()
    expect(hatchTierForImage('')).toBeNull()
  })
})
