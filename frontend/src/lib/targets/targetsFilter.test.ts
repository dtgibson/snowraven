// Toggles, chips, threshold and the summary counts (targets-tab QA-20 to QA-27).
import { describe, it, expect } from 'vitest'
import { DEFAULT_TOGGLES, isBreedingTarget, isMediaTarget, visibleTargets, type TargetsToggles } from './targetsFilter'
import type { Classified } from './targetsClassify'
import type { MediaType } from './targetsRecord'

let idx = 0
function c(code: string, over: Partial<Classified>): Classified {
  return {
    speciesCode: code, commonName: code, poolIndex: idx++, lifer: false,
    missingMedia: [], codes: new Set(), openName: code, sciName: null, ...over,
  }
}

const LIFER = c('lifer', { lifer: true, missingMedia: null, openName: null })
const MISSING_PHOTO = c('photo', { missingMedia: ['Photo'], codes: new Set(['NY']) })
const MISSING_PHOTO_AUDIO = c('photoaudio', { missingMedia: ['Photo', 'Audio'], codes: new Set(['FL']) })
const MEDIA_AND_BREEDING = c('both', { missingMedia: ['Video'], codes: new Set() })
const ONLY_F = c('onlyf', { missingMedia: [], codes: new Set(['F']) })
const ONLY_NY = c('onlyny', { missingMedia: [], codes: new Set(['NY']) })
const DONE = c('done', { missingMedia: [], codes: new Set(['NB']) })
const ALL = [LIFER, MISSING_PHOTO, MISSING_PHOTO_AUDIO, MEDIA_AND_BREEDING, ONLY_F, ONLY_NY, DONE]

const codes = (rows: readonly Classified[]) => rows.map(r => r.speciesCode)
// The semantics rows start from every type on, spelled out rather than spread
// from DEFAULT_TOGGLES: the default opens on Lifer only (targets-lifers-default),
// so a row built on it would leave Media and Breeding off and pass vacuously.
const ALL_ON: TargetsToggles = { lifer: true, media: true, breeding: true, chips: new Set(), threshold: 'any' }
const toggles = (over: Partial<TargetsToggles>): TargetsToggles => ({ ...ALL_ON, ...over })

describe('isMediaTarget (QA-23)', () => {
  it('no chip: any missing type qualifies; all three present never does', () => {
    expect(isMediaTarget(MISSING_PHOTO, new Set())).toBe(true)
    expect(isMediaTarget(DONE, new Set())).toBe(false)
    expect(isMediaTarget(LIFER, new Set())).toBe(false)
  })

  it('selected chips are AND: Photo+Audio keeps only species missing both', () => {
    const chips = new Set<MediaType>(['Photo', 'Audio'])
    expect(isMediaTarget(MISSING_PHOTO_AUDIO, chips)).toBe(true)
    expect(isMediaTarget(MISSING_PHOTO, chips)).toBe(false)
  })
})

describe('isBreedingTarget (QA-24)', () => {
  it('Any code: a single F is a code, so not a target; nothing at all is', () => {
    expect(isBreedingTarget(ONLY_F, 'any')).toBe(false)
    expect(isBreedingTarget(MEDIA_AND_BREEDING, 'any')).toBe(true)
  })

  it('Confirmed: {F} is a target, {NY} is not; a lifer never is', () => {
    expect(isBreedingTarget(ONLY_F, 'confirmed')).toBe(true)
    expect(isBreedingTarget(ONLY_NY, 'confirmed')).toBe(false)
    expect(isBreedingTarget(LIFER, 'confirmed')).toBe(false)
  })
})

describe('the default toggles (targets-lifers-default)', () => {
  it('open on Lifer only: Media and Breeding off, no chip, Any code; the view is the lifer rows', () => {
    expect(DEFAULT_TOGGLES.lifer).toBe(true)
    expect(DEFAULT_TOGGLES.media).toBe(false)
    expect(DEFAULT_TOGGLES.breeding).toBe(false)
    expect(DEFAULT_TOGGLES.chips.size).toBe(0)
    expect(DEFAULT_TOGGLES.threshold).toBe('any')
    // With the ML export loaded, so Media is off by the default and not by FR-20.
    const r = visibleTargets(ALL, DEFAULT_TOGGLES, true)
    expect(codes(r.rows)).toEqual(['lifer'])
    expect(r.counts).toEqual({ lifer: 1, media: 0, breeding: 0 })
    // Non-vacuity: the same pool with every type on shows media and breeding rows too.
    expect(codes(visibleTargets(ALL, ALL_ON, true).rows)).toEqual(expect.arrayContaining(['lifer', 'photo', 'both']))
  })
})

describe('visibleTargets', () => {
  it('a recorded species with full media and a confirmed code never appears (QA-20)', () => {
    for (const on of [ALL_ON, toggles({ threshold: 'confirmed' }), toggles({ lifer: false })]) {
      expect(codes(visibleTargets(ALL, on, true).rows)).not.toContain('done')
    }
  })

  it('turning Lifer off removes exactly the Lifer rows (QA-21)', () => {
    const on = codes(visibleTargets(ALL, ALL_ON, true).rows)
    const off = codes(visibleTargets(ALL, toggles({ lifer: false }), true).rows)
    expect(on.filter(x => !off.includes(x))).toEqual(['lifer'])
  })

  it('a Media+Breeding species stays while EITHER toggle is on (QA-21)', () => {
    expect(codes(visibleTargets(ALL, toggles({ media: false }), true).rows)).toContain('both')
    expect(codes(visibleTargets(ALL, toggles({ breeding: false }), true).rows)).toContain('both')
    expect(codes(visibleTargets(ALL, toggles({ media: false, breeding: false }), true).rows)).not.toContain('both')
  })

  it('with media unavailable the Media toggle counts as off (FR-20)', () => {
    const r = visibleTargets(ALL, ALL_ON, false)
    expect(r.counts.media).toBe(0)
    expect(codes(r.rows)).not.toContain('photo')   // its code is NY, so only Media could show it
  })

  it('all toggles off: nothing shows (FR-23)', () => {
    expect(visibleTargets(ALL, toggles({ lifer: false, media: false, breeding: false }), true).rows).toEqual([])
  })

  it('the summary counts equal the per-type badges among the visible rows (QA-27)', () => {
    for (const on of [
      ALL_ON, DEFAULT_TOGGLES, toggles({ lifer: false }), toggles({ chips: new Set<MediaType>(['Video']) }),
      toggles({ threshold: 'confirmed' }), toggles({ media: false }),
    ]) {
      const { rows, counts } = visibleTargets(ALL, on, true)
      let lifer = 0, media = 0, breeding = 0
      for (const r of rows) {
        if (on.lifer && r.lifer) lifer++
        if (on.media && isMediaTarget(r, on.chips)) media++
        if (on.breeding && isBreedingTarget(r, on.threshold)) breeding++
      }
      expect(counts).toEqual({ lifer, media, breeding })
      // and every visible row carries at least one counted type
      expect(lifer + media + breeding).toBeGreaterThanOrEqual(rows.length)
    }
  })
})
