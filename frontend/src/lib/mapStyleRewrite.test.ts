// @vitest-environment jsdom
// rewriteStyleAssetUrls resolves against document.baseURI, so it needs a DOM.
import { describe, it, expect } from 'vitest'
import { rewriteStyleAssetUrls } from './mapStyle'
import type { StyleSpecification } from 'maplibre-gl'

function styleWith(glyphs: string, sprite: string): StyleSpecification {
  return { version: 8, glyphs, sprite, sources: {}, layers: [] } as unknown as StyleSpecification
}

describe('rewriteStyleAssetUrls (FR-10 — point glyphs/sprite at bundled assets)', () => {
  it('rewrites glyphs + sprite to absolute, same-origin, bundled-asset URLs', () => {
    const out = rewriteStyleAssetUrls(styleWith(
      'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
      'https://tiles.openfreemap.org/sprites/ofm_f384/ofm',
    ))
    // Absolute (maplibre's normalizeSpriteURL hard-throws on a relative sprite).
    expect(out.glyphs).toMatch(/^https?:\/\//)
    expect(out.sprite).toMatch(/^https?:\/\//)
    // Now pointing at the local bundled assets, not the provider.
    expect(out.glyphs).toContain('mapassets/glyphs/')
    expect(out.sprite).toContain('mapassets/sprite/ofm')
    expect(out.glyphs).not.toContain('openfreemap')
    expect(out.sprite).not.toContain('openfreemap')
  })

  it('keeps the {fontstack}/{range} tokens LITERAL (un-percent-encoded) so maplibre can substitute them', () => {
    const out = rewriteStyleAssetUrls(styleWith('whatever/{fontstack}/{range}.pbf', 'whatever/ofm'))
    expect(out.glyphs).toContain('{fontstack}/{range}.pbf')
    // The percent-encoded forms would silently 404 every glyph.
    expect(out.glyphs).not.toContain('%7B')
    expect(out.glyphs).not.toContain('%7D')
  })
})
