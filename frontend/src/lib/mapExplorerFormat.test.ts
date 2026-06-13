// tierColors must return per-tier TEXT tokens, not the literal 'white': the
// dark-theme target-chip fills lighten enough that white text fails AA, so each
// recency tier carries a theme-adaptive --sr-map-target-*-text token (F018).
// MEDIA_ICONS SVG strings must be aria-hidden so browse-mode screen readers
// don't hit unnamed images on the on-map chips (F045).

import { describe, it, expect } from 'vitest'
import { tierColors, MEDIA_ICONS } from './mapExplorerFormat'

describe('tierColors text tokens (F018)', () => {
  it('never returns the literal "white" — every tier uses a text token', () => {
    for (const tier of ['fresh', 'mid', 'old'] as const) {
      expect(tierColors(tier).text).not.toBe('white')
      expect(tierColors(tier).text).toMatch(/^var\(--sr-map-target-.+-text\)$/)
    }
  })

  it('pairs each fill with its same-tier text token', () => {
    expect(tierColors('fresh')).toEqual({ bg: 'var(--sr-map-target-fresh)', text: 'var(--sr-map-target-fresh-text)' })
    expect(tierColors('mid')).toEqual({ bg: 'var(--sr-map-target-mid)', text: 'var(--sr-map-target-mid-text)' })
    expect(tierColors('old')).toEqual({ bg: 'var(--sr-map-target-old)', text: 'var(--sr-map-target-old-text)' })
  })
})

describe('MEDIA_ICONS accessibility (F045)', () => {
  it('marks every media-type icon aria-hidden', () => {
    for (const svg of Object.values(MEDIA_ICONS)) {
      expect(svg).toContain('aria-hidden="true"')
    }
  })
})
