import { describe, it, expect } from 'vitest'
import { observationMediaFormats, matchesMediaFilter } from './observationMedia'

// catalogId → format, as produced by parseMLExport's mediaMap.
const mediaMap: Record<string, string> = {
  '100': 'Photo',
  '200': 'Audio',
  '300': 'Video',
  '400': 'Photo',
}

describe('observationMediaFormats', () => {
  it('resolves the formats present on a sighting from its catalog ids', () => {
    expect(observationMediaFormats(['100', '300'], mediaMap)).toEqual(new Set(['Photo', 'Video']))
  })
  it('ignores catalog ids not in the media map', () => {
    expect(observationMediaFormats(['100', '999'], mediaMap)).toEqual(new Set(['Photo']))
  })
  it('returns an empty set for a sighting with no catalog ids', () => {
    expect(observationMediaFormats([], mediaMap).size).toBe(0)
  })
  it('dedupes repeated formats', () => {
    expect(observationMediaFormats(['100', '400'], mediaMap)).toEqual(new Set(['Photo']))
  })
})

describe('matchesMediaFilter', () => {
  const photoOnly = new Set(['Photo'] as const)
  const none = new Set<'Photo' | 'Audio' | 'Video'>()

  it('"any" matches everything', () => {
    expect(matchesMediaFilter(photoOnly, 'any')).toBe(true)
    expect(matchesMediaFilter(none, 'any')).toBe(true)
  })
  it('format filters match only that format', () => {
    expect(matchesMediaFilter(photoOnly, 'photo')).toBe(true)
    expect(matchesMediaFilter(photoOnly, 'video')).toBe(false)
    expect(matchesMediaFilter(photoOnly, 'audio')).toBe(false)
  })
  it('"none" matches only sightings with no media', () => {
    expect(matchesMediaFilter(none, 'none')).toBe(true)
    expect(matchesMediaFilter(photoOnly, 'none')).toBe(false)
  })

  // The regression: a species-based filter would match every sighting of a species
  // that has video anywhere. The per-sighting join must not match a sighting whose
  // own catalog ids contain no video.
  it('does not flag a video filter for a sighting that has only a photo', () => {
    const formats = observationMediaFormats(['100'], mediaMap)  // a photo, no video
    expect(matchesMediaFilter(formats, 'video')).toBe(false)
  })
  it('flags a video filter only for the sighting that actually has the video', () => {
    const withVideo = observationMediaFormats(['300'], mediaMap)
    const withoutVideo = observationMediaFormats(['100', '200'], mediaMap)
    expect(matchesMediaFilter(withVideo, 'video')).toBe(true)
    expect(matchesMediaFilter(withoutVideo, 'video')).toBe(false)
  })
})
