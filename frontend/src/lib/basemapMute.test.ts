import { describe, it, expect } from 'vitest'
import { desaturateHsl, TINTED_LAND_LAYERS, RASTER_BASE_LAYER_IDS, BASEMAP_MUTE_RASTER_SATURATION } from './mapStyle'

describe('desaturateHsl — basemap land muting', () => {
  it('greys an hsl triple to S=0 keeping lightness', () => {
    expect(desaturateHsl('hsl(142, 34%, 79%)')).toBe('hsl(0, 0%, 79%)')
    expect(desaturateHsl('hsl(40, 14%, 88%)')).toBe('hsl(0, 0%, 88%)')
  })

  it('keeps fractional lightness', () => {
    expect(desaturateHsl('hsl(146, 30%, 67.5%)')).toBe('hsl(0, 0%, 67.5%)')
  })

  it('tolerates surrounding/inner whitespace', () => {
    expect(desaturateHsl('  hsl( 138 , 38% , 89% ) ')).toBe('hsl(0, 0%, 89%)')
  })

  it('returns the input unchanged for non-hsl strings (guard)', () => {
    expect(desaturateHsl('#2D8653')).toBe('#2D8653')
    expect(desaturateHsl('rgb(1,2,3)')).toBe('rgb(1,2,3)')
    expect(desaturateHsl('')).toBe('')
  })
})

describe('basemap mute config', () => {
  it('every tinted land layer carries a greyable hsl tint', () => {
    expect(TINTED_LAND_LAYERS.length).toBeGreaterThan(0)
    for (const { id, tint } of TINTED_LAND_LAYERS) {
      expect(id).toMatch(/\S/)
      expect(desaturateHsl(tint)).toMatch(/^hsl\(0, 0%, [\d.]+%\)$/)
    }
  })

  it('mutes the raster bases but not the trails overlay', () => {
    expect([...RASTER_BASE_LAYER_IDS]).toEqual(['sr-satellite', 'sr-topo'])
    expect([...RASTER_BASE_LAYER_IDS]).not.toContain('sr-trails')
    expect(BASEMAP_MUTE_RASTER_SATURATION).toBeGreaterThanOrEqual(-1)
    expect(BASEMAP_MUTE_RASTER_SATURATION).toBeLessThan(0)
  })
})
