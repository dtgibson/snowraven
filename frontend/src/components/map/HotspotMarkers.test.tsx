// @vitest-environment jsdom
//
// The styleimagemissing safety net in HotspotMarkers must bake sprites only
// for ids it owns and ignore every other id (other layers may legitimately
// miss images). The map-facing handler is a thin wrapper around this reverse
// lookup — locking the lookup here tests the ownership contract without
// mocking a GL map.

import { describe, it, expect } from 'vitest'
import { hotspotKindForImage } from './HotspotMarkers'
import { HOTSPOT_KINDS, HOTSPOT_IMAGE_ID } from '../../lib/mapPins'

describe('hotspotKindForImage', () => {
  it('maps every hotspot sprite id back to its kind', () => {
    for (const kind of HOTSPOT_KINDS) {
      expect(hotspotKindForImage(HOTSPOT_IMAGE_ID[kind])).toBe(kind)
    }
  })

  it('ignores foreign ids', () => {
    expect(hotspotKindForImage('sr-atlas-hatch-1')).toBeNull()
    expect(hotspotKindForImage('some-style-sprite')).toBeNull()
    expect(hotspotKindForImage('')).toBeNull()
  })
})
