import { describe, expect, it, vi } from 'vitest'
import {
  registerMissingStyleImageHandler,
  type MissingStyleImageMap,
} from './mapMissingImages'
import type { MissingStyleImageResolver } from 'maplibre-gl'

function mapDouble() {
  let resolver: MissingStyleImageResolver | null = null
  const setMissingStyleImageResolver = vi.fn((next: MissingStyleImageResolver | null) => {
    resolver = next
  })
  return {
    map: { setMissingStyleImageResolver } as MissingStyleImageMap,
    setMissingStyleImageResolver,
    resolver: () => resolver,
  }
}

describe('missing style image registry', () => {
  it('dispatches several sprite owners through one map resolver and cleans up only the last', () => {
    const stub = mapDouble()
    const atlas = vi.fn((id: string) => id === 'sr-atlas-hatch-1')
    const county = vi.fn((id: string) => id === 'sr-county-hatch-1')

    const unregisterAtlas = registerMissingStyleImageHandler(stub.map, atlas)
    const installed = stub.resolver()
    expect(installed).not.toBeNull()
    expect(stub.setMissingStyleImageResolver).toHaveBeenCalledTimes(1)

    const unregisterCounty = registerMissingStyleImageHandler(stub.map, county)
    expect(stub.setMissingStyleImageResolver).toHaveBeenCalledTimes(1)
    expect(stub.resolver()).toBe(installed)

    installed?.('sr-atlas-hatch-1')
    expect(atlas).toHaveBeenLastCalledWith('sr-atlas-hatch-1')
    expect(county).not.toHaveBeenCalled()

    installed?.('sr-county-hatch-1')
    expect(county).toHaveBeenLastCalledWith('sr-county-hatch-1')

    atlas.mockClear()
    county.mockClear()
    installed?.('foreign-style-sprite')
    expect(atlas).toHaveBeenCalledTimes(1)
    expect(county).toHaveBeenCalledTimes(1)

    unregisterAtlas()
    expect(stub.setMissingStyleImageResolver).toHaveBeenCalledTimes(1)
    county.mockClear()
    installed?.('sr-county-hatch-1')
    expect(county).toHaveBeenCalledTimes(1)

    unregisterCounty()
    expect(stub.setMissingStyleImageResolver).toHaveBeenCalledTimes(2)
    expect(stub.setMissingStyleImageResolver).toHaveBeenLastCalledWith(null)
  })

  it('makes each unregister function idempotent', () => {
    const stub = mapDouble()
    const unregister = registerMissingStyleImageHandler(stub.map, () => false)
    unregister()
    unregister()
    expect(stub.setMissingStyleImageResolver).toHaveBeenCalledTimes(2)
  })
})
