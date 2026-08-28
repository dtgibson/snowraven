// @vitest-environment jsdom
//
// OVERLAY-OFF PARITY AT THE THREE NEW MOUNT POINTS
// (county-shading-and-project-stats, FR-19, FR-05, FR-07, FR-08; QA-06, QA-08,
// QA-09, QA-20).
//
// THREE SEPARATE ASSERTIONS, deliberately. One combined "the county layer is
// absent" assertion passes on a HALF-FIX — the Species Detail map is TWO
// <SnowMap> mounts (SightingsMap for Pins, a direct SnowMap + HeatmapLayer for
// Heatmap), and the file already records that the share-pin fix needed "two
// branches, two fixes, and a test for each". The Statistics map is a third.
//
// The Named Birds per-row card is this component's other production caller and
// passes NONE of the opt-in props, so its assertion is the one that proves the
// default really is today's behaviour rather than a default that happens to
// look like it.
//
// react-map-gl is stubbed with plain React so no WebGL is needed; what is being
// asserted is WHICH CHILDREN MOUNT, which is exactly what the stub can see.

import { describe, it, expect, vi, beforeEach, afterEach, afterAll } from 'vitest'
import type { ReactNode } from 'react'
import { act, render, screen, cleanup, waitFor, fireEvent } from '@testing-library/react'

const mounted = vi.hoisted(() => ({
  layers: [] as string[],
  sources: [] as string[],
  layerProps: [] as Array<Record<string, unknown>>,
}))

vi.mock('react-map-gl/maplibre', () => ({
  Source: ({ id, children }: { id?: string; children?: ReactNode }) => {
    if (id) mounted.sources.push(id)
    return <>{children}</>
  },
  Layer: (props: Record<string, unknown>) => {
    const id = props.id as string | undefined
    if (id) { mounted.layers.push(id); mounted.layerProps.push(props) }
    return null
  },
  Popup: ({ children }: { children?: ReactNode }) => <>{children}</>,
  Marker: ({ children }: { children?: ReactNode }) => <>{children}</>,
  useMap: () => ({ current: undefined }),
}))

// SnowMap itself pulls the whole map style graph; the parity question is about
// the CHILDREN it is handed.
vi.mock('../SnowMap', () => ({
  SnowMap: ({ children }: { children?: ReactNode }) => <div data-testid="snowmap">{children}</div>,
}))
const desaturation = vi.hoisted(() => ({ mounts: [] as boolean[] }))
vi.mock('./BasemapDesaturation', () => ({
  BasemapDesaturation: ({ active }: { active: boolean }) => {
    desaturation.mounts.push(active)
    return null
  },
}))
vi.mock('./SharePin', () => ({ SharePin: () => null }))
vi.mock('../speciesDetail/MapBoundsFitter', () => ({ MapBoundsFitter: () => null }))

// ── The SITE 3 harness ───────────────────────────────────────────────────────
//
// SITE 3 is the only one of the three whose host is a whole TAB, and the first
// version of this file paid for that with a hand-written miniature of the
// host's conditional. A replica is not the host: changing the real gate at
// `BirdingStats.tsx:1156` to always-on left the replica green. So the tab is
// rendered for real below, and these mocks are what make that cheap — the same
// set `BirdingStatsProjectsDenominator.test.tsx` already uses. None of them is
// reached by SITE 1 or SITE 2, whose hosts import neither storage nor transport.
const STATS_OBS = [
  { submissionId: 'S1', commonName: 'Common Raven', scientificName: 'Corvus corax',
    date: '2026-04-01', location: 'Albany Hill', locationId: 'L1',
    latitude: 37.9, longitude: -122.3, county: 'Alameda', stateProvince: 'US-CA',
    count: 1, breedingCode: null, speciesComments: '', catalogIds: [] },
  { submissionId: 'S2', commonName: 'Steller\u2019s Jay', scientificName: 'Cyanocitta stelleri',
    date: '2026-04-02', location: 'Tilden Park', locationId: 'L2',
    latitude: 37.9, longitude: -122.25, county: 'Alameda', stateProvince: 'US-CA',
    count: 2, breedingCode: null, speciesComments: '', catalogIds: [] },
]
vi.mock('../../lib/observationsCache', () => ({
  loadEbirdObservations: vi.fn(async () => ({ text: '', observations: STATS_OBS })),
}))
vi.mock('../../lib/mlExportCache', () => ({ loadMLExport: vi.fn(async () => null) }))
vi.mock('../../lib/storage', () => ({
  storage: {
    getFilesStatus: vi.fn(async () => ({ ebird: { filename: 'e.csv', uploadedAt: '2026-04-01' }, ml: null })),
    getSetting: vi.fn(async () => null),
    setSetting: vi.fn(async () => {}),
    readFile: vi.fn(async () => null),
    getApiKey: vi.fn(async () => 'k'),
  },
}))
// EVERY outbound call the tab could make, recorded. FR-16 / QA-18 / QA-21 say
// county shading issues none, and this is where that is measured rather than
// argued from the import graph.
const net = vi.hoisted(() => ({ calls: [] as string[] }))
vi.mock('../../lib/transport', () => ({
  transport: {
    post: vi.fn(async (path: string) => { net.calls.push(`POST ${path}`); return path === '/taxonomy/codes' ? { codes: {} } : {} }),
    get: vi.fn(async (path: string) => { net.calls.push(`GET ${path}`); return { species: [] } }),
  },
}))
// The geometry the host loads on first enable. Two features so the layer has
// something real to paint; the 3.85 MB asset is never touched in jsdom.
vi.mock('../../lib/countyGeometry', () => ({
  loadCountyGeometry: vi.fn(async () => ({
    type: 'FeatureCollection',
    features: [
      { type: 'Feature', properties: { NAME: 'Alameda', STUSPS: 'CA', GEOID: '06001' }, geometry: { type: 'Polygon', coordinates: [[[-122.4, 37.8], [-122.2, 37.8], [-122.2, 38.0], [-122.4, 38.0], [-122.4, 37.8]]] } },
    ],
  })),
}))

import { SightingsMap } from '../SightingsMap'
import { HeatmapLayer } from '../speciesDetail/HeatmapLayer'
import { CountyLayer } from './CountyLayer'
import { buildCountyAggregates, computeCountyTiers } from '../../lib/countyShading'
import { computeChecklists } from '../../lib/birdingStats'
import type { CountyFC } from '../../lib/countyBoundaries'
import type { ObservationEntry } from '../../types'

const MARKERS = [{
  lat: 37.9, lng: -122.3,
  sightings: [{ submissionId: 'S1', date: '2026-04-01' }],
}]

const OBS: ObservationEntry[] = [{
  submissionId: 'S1', commonName: 'Common Raven', scientificName: 'Corvus corax',
  date: '2026-04-01', location: 'Albany Hill', locationId: 'L1',
  latitude: 37.9, longitude: -122.3, county: 'Alameda', stateProvince: 'US-CA',
  count: 1, breedingCode: null, speciesComments: '', catalogIds: [],
}]

const AGG = buildCountyAggregates(OBS, computeChecklists(OBS))
const TIERS = computeCountyTiers([1], 10)
const GEOMETRY = { type: 'FeatureCollection', features: [] } as unknown as CountyFC

beforeEach(() => {
  mounted.layers.length = 0
  mounted.sources.length = 0
  mounted.layerProps.length = 0
  desaturation.mounts.length = 0
})

const layerProps = (id: string) =>
  mounted.layerProps.find(p => p.id === id) as Record<string, unknown> | undefined

describe('SITE 1 — Species Detail, Pins branch (SightingsMap)', () => {
  it('with Counties OFF renders no county layer, no source and no basemap effect', () => {
    render(<SightingsMap markers={MARKERS} switcher compact={false} />)
    expect(mounted.layers).not.toContain('sr-county-fill')
    expect(mounted.sources).not.toContain('sr-county')
    expect(desaturation.mounts).toEqual([])
  })

  it('with Counties ON renders the shipped fill layer and mutes the basemap', () => {
    render(
      <SightingsMap
        markers={MARKERS} switcher compact={false}
        countyData={GEOMETRY} countyShade countyAggregates={AGG} countyTiers={TIERS}
        speciesContext={{ commonName: 'Common Raven' }}
      />,
    )
    expect(mounted.layers).toContain('sr-county-fill')
    expect(mounted.sources).toContain('sr-county')
    expect(desaturation.mounts).toContain(true)
  })

  it('dims the pins ONLY while shading is on', () => {
    // A caller that passed no county props gets NO extra style properties at
    // all — not even `opacity: 1` — so its pin style object is byte-identical
    // to the pre-change build rather than merely looking the same (QA-09).
    const off = render(<SightingsMap markers={MARKERS} switcher compact={false} />)
    const offPin = off.container.querySelector('button[aria-label*="sighting"]') as HTMLElement
    expect(offPin.style.opacity).toBe('')
    expect(offPin.style.transition).toBe('')
    off.unmount()

    // A caller that HAS opted in but has shading off carries the transition (so
    // turning it off animates) and full opacity.
    const optedInOff = render(
      <SightingsMap
        markers={MARKERS} switcher compact={false}
        countyData={GEOMETRY} countyShade={false} countyAggregates={null} countyTiers={TIERS}
      />,
    )
    const idlePin = optedInOff.container.querySelector('button[aria-label*="sighting"]') as HTMLElement
    expect(idlePin.style.opacity).toBe('1')
    optedInOff.unmount()

    const on = render(
      <SightingsMap
        markers={MARKERS} switcher compact={false}
        countyData={GEOMETRY} countyShade countyAggregates={AGG} countyTiers={TIERS}
      />,
    )
    const onPin = on.container.querySelector('button[aria-label*="sighting"]') as HTMLElement
    expect(onPin.style.opacity).toBe('0.4')
  })

  it('QA-09: the Named Birds caller shape (no county props at all) is unchanged', () => {
    // The ONE assertion that proves the props are genuinely opt-in rather than
    // defaulted to something that merely resembles today.
    const { container } = render(<SightingsMap markers={MARKERS} switcher={false} compact />)
    expect(mounted.layers).not.toContain('sr-county-fill')
    expect(mounted.layers).not.toContain('sr-county-line')
    expect(mounted.sources).not.toContain('sr-county')
    expect(desaturation.mounts).toEqual([])
    // ...down to the pin's own style object, which gains no property.
    const pin = container.querySelector('button[aria-label*="sighting"]') as HTMLElement
    expect(pin.getAttribute('style')).toBe(
      'width: 24px; height: 34px; padding: 0px; border: medium; background: none; cursor: pointer; display: block;',
    )
  })

  it('geometry present but shading OFF still mutes nothing', () => {
    // The state after a user turns Counties on and then off again: the geometry
    // stays loaded (no second import on re-enable) but nothing is muted.
    render(
      <SightingsMap
        markers={MARKERS} switcher compact={false}
        countyData={GEOMETRY} countyShade={false} countyAggregates={null} countyTiers={TIERS}
      />,
    )
    expect(desaturation.mounts).toEqual([false])
  })
})

describe('SITE 2 — Species Detail, Heatmap branch', () => {
  it('with Counties OFF the heat layer keeps its shipped paint and z-order', () => {
    render(<HeatmapLayer points={[[37.9, -122.3, 1]]} intensity={5} />)
    expect(mounted.layers).toEqual(['sr-sp-heat'])
    expect(mounted.sources).toEqual(['sr-sp-heat'])
  })

  it('with Counties ON the county layer mounts beside it and the heat is dimmed', () => {
    // The two branches are two separate <SnowMap> mounts, so the overlay has to
    // be wired into each; a single combined assertion would pass on a half-fix.
    const { container } = render(
      <div>
        <HeatmapLayer points={[[37.9, -122.3, 1]]} intensity={5} belowFillId="sr-county-fill" opacity={0.4} />
        <CountyLayer data={GEOMETRY} shade aggregates={AGG} tiers={TIERS} metric="records" speciesContext={{ commonName: 'Common Raven' }} />
      </div>,
    )
    expect(mounted.layers).toContain('sr-sp-heat')
    expect(mounted.layers).toContain('sr-county-fill')
    expect(container).toBeTruthy()
  })

  it('the heat layer opt-in props default to today, so the off state is byte-identical', () => {
    // Read off the LAYER's real props, not off the component's arguments: the
    // claim is that an absent prop resolves to the shipped `undefined` beforeId
    // and the shipped 0.85 opacity, which is a property of the layer spec.
    render(<HeatmapLayer points={[[37.9, -122.3, 1]]} intensity={5} />)
    const off = layerProps('sr-sp-heat')!
    expect(off.beforeId).toBeUndefined()
    expect((off.paint as Record<string, unknown>)['heatmap-opacity']).toBe(0.85)
  })

  it('the heat layer re-orders UNDER the fill and dims only when told to', () => {
    render(<HeatmapLayer points={[[37.9, -122.3, 1]]} intensity={5} belowFillId="sr-county-fill" opacity={0.4} />)
    const on = layerProps('sr-sp-heat')!
    expect(on.beforeId).toBe('sr-county-fill')
    expect((on.paint as Record<string, unknown>)['heatmap-opacity']).toBe(0.4)
    // Everything else about the layer is untouched by the two new props.
    const paint = on.paint as Record<string, unknown>
    expect(paint['heatmap-weight']).toEqual(['get', 'w'])
    expect(paint['heatmap-radius']).toBeTypeOf('number')
  })
})

describe('SITE 3 — Statistics, Geographic Stats map, THE REAL HOST', () => {
  // Not a miniature of the host's conditional — the host. The tab is rendered,
  // its own "Counties" switch is pressed, and the geometry load the press
  // triggers is answered by the mocked loader. That is what makes the two
  // assertions below claims about `BirdingStats.tsx` rather than about a copy
  // of it that can drift from it.
  let BirdingStats: typeof import('../BirdingStats').BirdingStats
  let rafQueue: FrameRequestCallback[] = []

  beforeEach(async () => {
    rafQueue = []
    net.calls.length = 0
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => { rafQueue.push(cb); return rafQueue.length })
    vi.stubGlobal('cancelAnimationFrame', () => {})
    vi.stubGlobal('requestIdleCallback', (cb: () => void) => { cb(); return 1 })
    vi.stubGlobal('cancelIdleCallback', () => {})
    ;({ BirdingStats } = await import('../BirdingStats'))
  })

  afterEach(() => { cleanup(); vi.unstubAllGlobals() })
  afterAll(() => new Promise((r) => setTimeout(r, 120)))

  async function renderTab() {
    render(<BirdingStats onGoToSettings={() => {}} onOpenSpecies={() => {}} />)
    await waitFor(() => expect(screen.getByText('Statistics')).toBeTruthy())
    await waitFor(() => expect(rafQueue.length).toBeGreaterThan(0))
    const flush = () => { const b = rafQueue; rafQueue = []; for (const cb of b) cb(performance.now()) }
    await act(async () => { flush() })
    await act(async () => { flush() })
    return await waitFor(() => screen.getByRole('switch', { name: 'Counties' }))
  }

  it('with Counties OFF the host renders no county layer, source or basemap effect', async () => {
    await renderTab()
    expect(mounted.layers).not.toContain('sr-county-fill')
    expect(mounted.layers).not.toContain('sr-county-line')
    expect(mounted.sources).not.toContain('sr-county')
    // The one the replica could not make bite. `BasemapDesaturation` sits
    // INSIDE the `{countyData && ...}` gate, so flipping that gate to always-on
    // mounts it (with `active={false}`) even though `CountyLayer` still renders
    // nothing on null geometry. This assertion is the gate's only witness.
    expect(desaturation.mounts).toEqual([])
  })

  it('pressing the host’s own Counties switch mounts all three', async () => {
    const sw = await renderTab()
    expect(sw.getAttribute('aria-checked')).toBe('false')
    await act(async () => { fireEvent.click(sw) })
    await waitFor(() => expect(mounted.layers).toContain('sr-county-fill'))
    expect(mounted.layers).toContain('sr-county-line')
    expect(mounted.sources).toContain('sr-county')
    expect(desaturation.mounts).toContain(true)
    expect(sw.getAttribute('aria-checked')).toBe('true')
  })

  it('county shading issues NO network request, in either state (FR-16, QA-18, QA-21)', async () => {
    // The import-graph negative in `entryChunk.test.ts` proves the completeness
    // CONTROLLER is unreachable from these hosts. This proves the consequence
    // the criterion is actually about, at the host, by watching the transport
    // seam every outbound call in the app goes through.
    const sw = await renderTab()
    await act(async () => { fireEvent.click(sw) })
    await waitFor(() => expect(mounted.layers).toContain('sr-county-fill'))
    const mapCalls = net.calls.filter(c => c.includes('/map/'))
    expect(mapCalls, `map requests: ${net.calls.join(', ')}`).toEqual([])
    expect(net.calls.some(c => c.includes('county-species'))).toBe(false)
    // Non-vacuity: the seam IS wired, and the tab really did call through it.
    expect(net.calls.length).toBeGreaterThan(0)
  })
})

describe('SITE 3 — the shared layer, at the component', () => {
  it('with Counties ON it renders the same shipped layer id as everywhere else', () => {
    render(<CountyLayer data={GEOMETRY} shade aggregates={AGG} tiers={TIERS} metric="species" />)
    expect(mounted.layers).toContain('sr-county-fill')
    expect(mounted.layers).toContain('sr-county-line')
    expect(mounted.sources).toContain('sr-county')
  })

  it('the fill layer id is `sr-county-fill` in every branch (do-not-rename)', () => {
    // Load-bearing for the heatmap z-order and the basemap-desaturation wiring.
    for (const metric of ['species', 'records'] as const) {
      mounted.layers.length = 0
      const r = render(<CountyLayer data={GEOMETRY} shade aggregates={AGG} tiers={TIERS} metric={metric} useTextures />)
      expect(mounted.layers).toContain('sr-county-fill')
      r.unmount()
    }
  })

  it('CountyLayer with null geometry renders nothing at all', () => {
    render(<CountyLayer data={null} tiers={TIERS} metric="species" />)
    expect(mounted.layers).toEqual([])
    expect(mounted.sources).toEqual([])
  })
})
