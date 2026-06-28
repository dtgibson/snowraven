// @vitest-environment jsdom
//
// imp-3 (basemap muting) can't be checked by rendering WebGL, so this verifies the
// map-child's imperative contract against a fake maplibre Map: which layers it paints,
// with what values, that it restores, guards missing layers, and re-applies on a
// style reload only while active.

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { BasemapDesaturation } from './BasemapDesaturation'
import { TINTED_LAND_LAYERS, RASTER_BASE_LAYER_IDS, BASEMAP_MUTE_RASTER_SATURATION, desaturateHsl } from '../../lib/mapStyle'

const holder = vi.hoisted(() => ({ mapRef: null as null | { getMap: () => unknown } }))

vi.mock('react-map-gl/maplibre', () => ({
  useMap: () => ({ current: holder.mapRef }),
}))

type PaintLog = Record<string, Record<string, unknown>>

function makeFakeMap(presentLayers?: Set<string>) {
  const paint: PaintLog = {}
  const handlers: Record<string, Array<() => void>> = {}
  const map = {
    getLayer: (id: string) => (!presentLayers || presentLayers.has(id) ? { id } : undefined),
    setPaintProperty: (id: string, prop: string, val: unknown) => {
      ;(paint[id] ||= {})[prop] = val
    },
    on: (ev: string, cb: () => void) => { (handlers[ev] ||= []).push(cb) },
    off: (ev: string, cb: () => void) => { handlers[ev] = (handlers[ev] || []).filter(h => h !== cb) },
  }
  return { map, paint, handlers }
}

beforeEach(() => { holder.mapRef = null; cleanup() })

describe('BasemapDesaturation', () => {
  it('greys the land fills and cuts raster saturation when active', () => {
    const { map, paint } = makeFakeMap()
    holder.mapRef = { getMap: () => map }
    render(<BasemapDesaturation active />)
    for (const { id, tint } of TINTED_LAND_LAYERS) {
      expect(paint[id]['fill-color']).toBe(desaturateHsl(tint))
    }
    for (const id of RASTER_BASE_LAYER_IDS) {
      expect(paint[id]['raster-saturation']).toBe(BASEMAP_MUTE_RASTER_SATURATION)
    }
  })

  it('restores original tints and full saturation when inactive', () => {
    const { map, paint } = makeFakeMap()
    holder.mapRef = { getMap: () => map }
    render(<BasemapDesaturation active={false} />)
    for (const { id, tint } of TINTED_LAND_LAYERS) {
      expect(paint[id]['fill-color']).toBe(tint)
    }
    for (const id of RASTER_BASE_LAYER_IDS) {
      expect(paint[id]['raster-saturation']).toBe(0)
    }
  })

  it('skips layers that are not present (guarded getLayer)', () => {
    const { map, paint } = makeFakeMap(new Set())
    holder.mapRef = { getMap: () => map }
    render(<BasemapDesaturation active />)
    expect(Object.keys(paint)).toHaveLength(0)
  })

  it('re-applies on a style reload only while active', () => {
    const { map, handlers } = makeFakeMap()
    holder.mapRef = { getMap: () => map }
    const { rerender } = render(<BasemapDesaturation active />)
    expect(handlers['styledata']?.length).toBe(1)
    rerender(<BasemapDesaturation active={false} />)
    expect(handlers['styledata']?.length ?? 0).toBe(0)
  })

  it('does nothing (and does not throw) without a map', () => {
    holder.mapRef = null
    expect(() => render(<BasemapDesaturation active />)).not.toThrow()
  })
})
