// @vitest-environment jsdom
//
// Locks the accurate-county-line contract (v0.5.49): with the basemap's
// `openmaptiles` vector source present, CountyLayer draws a dedicated
// admin_level-6 boundary line (z9+) from that source — the true county edge,
// accurate at every zoom — and caps the bundled simplified line at z9 so it only
// covers far-out / the offline fallback. With the vector source absent (a bare
// offline map) the accurate line is omitted and the bundled line stands alone.
// Plain React stubs for react-map-gl — no maplibre-gl, no WebGL.

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render } from '@testing-library/react'
import type { ReactNode } from 'react'
import { CountyLayer } from './CountyLayer'
import type { CountyFC } from '../../lib/countyBoundaries'
import type { CountyTiers } from '../../lib/countyShading'

const h = vi.hoisted(() => {
  const ctrl = { hasVector: true }
  const layerLog: Record<string, unknown>[] = []
  const map = {
    getLayer: () => undefined,
    getSource: (id: string) => (id === 'openmaptiles' && ctrl.hasVector ? {} : undefined),
    getBounds: () => ({ getWest: () => -123, getSouth: () => 37, getEast: () => -121, getNorth: () => 39 }),
    getCanvas: () => ({ style: {} as Record<string, string> }),
    on: () => {},
    off: () => {},
    flyTo: () => {},
    queryRenderedFeatures: () => [],
  }
  return { ctrl, layerLog, map }
})

vi.mock('react-map-gl/maplibre', () => ({
  Source: ({ children }: { children?: ReactNode }) => <>{children}</>,
  Layer: (props: Record<string, unknown>) => { h.layerLog.push(props); return null },
  Popup: () => null,
  useMap: () => ({ current: h.map }),
}))

const data = {
  type: 'FeatureCollection',
  features: [{
    type: 'Feature',
    bbox: [-122.5, 37.7, -122.3, 37.85],
    properties: { geoid: '06075', name: 'San Francisco', stusps: 'CA', statefp: '06' },
    geometry: { type: 'Polygon', coordinates: [[[-122.5, 37.7], [-122.3, 37.7], [-122.3, 37.85], [-122.5, 37.85], [-122.5, 37.7]]] },
  }],
} as unknown as CountyFC

const tiers = { tierFor: () => 0 } as unknown as CountyTiers

beforeEach(() => { h.layerLog.length = 0; h.ctrl.hasVector = true })

describe('CountyLayer — accurate boundary lines from the basemap tiles', () => {
  it('adds an admin_level-6 line on the openmaptiles boundary source at z9+, and caps the bundled line at z9', () => {
    render(<CountyLayer data={data} tiers={tiers} metric="species" />)

    const hi = h.layerLog.find(l => l.id === 'sr-county-line-hi')
    expect(hi).toBeTruthy()
    expect(hi?.source).toBe('openmaptiles')
    expect(hi?.['source-layer']).toBe('boundary')
    expect(hi?.minzoom).toBe(9)
    const filter = JSON.stringify(hi?.filter)
    expect(filter).toContain('admin_level')
    expect(filter).toContain('6')

    const bundled = h.layerLog.find(l => l.id === 'sr-county-line')
    expect(bundled?.minzoom).toBe(4)
    expect(bundled?.maxzoom).toBe(9)
  })

  it('omits the accurate line when the basemap vector source is absent (bare offline map), keeping the bundled line as the fallback', () => {
    h.ctrl.hasVector = false
    render(<CountyLayer data={data} tiers={tiers} metric="species" />)
    expect(h.layerLog.find(l => l.id === 'sr-county-line-hi')).toBeUndefined()
    expect(h.layerLog.find(l => l.id === 'sr-county-line')).toBeTruthy()
  })
})
