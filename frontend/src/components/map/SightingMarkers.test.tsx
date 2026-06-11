// @vitest-environment jsdom
//
// The pins and heatmap branches of SightingMarkers put a <Source> at the same
// tree position with DIFFERENT ids (sr-sight vs sr-heat). react-map-gl's
// contract is that a Source's id is fixed at mount — an unkeyed branch swap
// makes React reuse the instance and mutate the id in place, which throws
// "source id changed" and crashes the whole app (shipped broken since 0.5.18).
// This locks the remount contract with plain React stubs — no maplibre-gl,
// no WebGL: toggling displayMode must UNMOUNT the old Source and MOUNT a
// fresh one, never re-render the same instance with a new id.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useEffect, type ReactNode } from 'react'
import { render } from '@testing-library/react'
import { SightingMarkers } from './SightingMarkers'
import type { LocationGroup } from '../../lib/mapExplorerTypes'

const sourceLog = vi.hoisted(() => [] as string[])

vi.mock('react-map-gl/maplibre', () => ({
  // Records the id this instance was MOUNTED with; the empty-deps effect means
  // a reused instance whose id prop changes logs nothing — exactly the broken
  // shape this test must reject.
  Source: ({ id, children }: { id: string; children?: ReactNode }) => {
    useEffect(() => {
      sourceLog.push(`mount:${id}`)
      return () => { sourceLog.push(`unmount:${id}`) }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])
    return <>{children}</>
  },
  Layer: () => null,
  Popup: () => null,
  useMap: () => ({ current: undefined }),
}))

const loc: LocationGroup = {
  locId: 'L1', locName: 'Test Marsh', lat: 38.1, lng: -122.3,
  count: 4, species: new Set(['Snow Goose']), lastDate: '2026-06-01',
}
const baseProps = {
  locations: [loc], heatIntensity: 5, atlasShading: false,
  sel: null, onSelect: () => {},
}

beforeEach(() => { sourceLog.length = 0 })

describe('SightingMarkers source identity across mode toggles', () => {
  it('remounts the Source when toggling pins → heatmap → pins', () => {
    const { rerender } = render(<SightingMarkers {...baseProps} displayMode="pins" />)
    expect(sourceLog).toEqual(['mount:sr-sight'])

    rerender(<SightingMarkers {...baseProps} displayMode="heatmap" />)
    expect(sourceLog).toEqual(['mount:sr-sight', 'unmount:sr-sight', 'mount:sr-heat'])

    rerender(<SightingMarkers {...baseProps} displayMode="pins" />)
    expect(sourceLog).toEqual([
      'mount:sr-sight', 'unmount:sr-sight', 'mount:sr-heat',
      'unmount:sr-heat', 'mount:sr-sight',
    ])
  })
})
