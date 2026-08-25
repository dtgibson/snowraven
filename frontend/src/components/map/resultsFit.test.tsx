// @vitest-environment jsdom
//
// feature: search-this-area — THE RESULTS FIT, on all three centre views.
//
// Each of the three marker layers re-frames the map whenever its pin count
// changes. That is shipped behaviour every route to a search relies on: the
// sidebar Find button, the place-name search, "Use my location", a dropped or
// dragged centre pin and a view-mode change can all set a centre nowhere near the
// screen, and framing is how the user sees what they asked for.
//
// It is exactly wrong for ONE caller. "Search this area" derives its centre and
// radius FROM the viewport, so re-framing feeds the derivation its own output:
// the results span the searched circle, a rectangle framing them has a
// half-diagonal approaching r*sqrt(2), and the next derived rung comes out a step
// higher — so the control re-offered itself after every successful press and each
// press ratcheted the radius for one unrequested eBird lookup. Measured in
// Chromium: a press sending dist=16 re-framed zoom 11.276 -> 10.321 and the next
// press sent dist=40.
//
// All three surfaces are asserted SEPARATELY. One assertion for the shared shape
// is not one assertion per surface, and this prop had to be threaded through
// three call sites in MapExplorer, any one of which could have been missed with
// the suite still green.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import type { ReactNode } from 'react'
import { HotspotMarkers } from './HotspotMarkers'
import { TargetMarkers } from './TargetMarkers'
import { NearbyLiferMarkers } from './NearbyLiferMarkers'
import type { HotspotPin, DisplayTargetPin, NearbyLiferLocation } from '../../lib/mapExplorerTypes'

const h = vi.hoisted(() => {
  const fitCalls: unknown[][] = []
  const flyCalls: unknown[][] = []
  const map = {
    getLayer: () => ({}),
    getSource: () => undefined,
    getCanvas: () => ({ style: {} as Record<string, string> }),
    queryRenderedFeatures: () => [],
    hasImage: () => true,
    addImage: () => {},
    updateImage: () => {},
    fitBounds: (...a: unknown[]) => { fitCalls.push(a) },
    flyTo: (...a: unknown[]) => { flyCalls.push(a) },
    on: () => {},
    off: () => {},
  }
  return { fitCalls, flyCalls, map }
})

vi.mock('react-map-gl/maplibre', () => ({
  Source: ({ children }: { children?: ReactNode }) => <>{children}</>,
  Layer: () => null,
  Marker: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  Popup: ({ children }: { children?: ReactNode }) => <div role="dialog">{children}</div>,
  useMap: () => ({ current: h.map }),
}))

// The teardrop sprite is baked on a real 2D canvas, which jsdom does not provide.
// Only the sprite bytes are stubbed; the sprite-registration effect itself still
// runs, so nothing about the component under test is skipped.
vi.mock('../../lib/mapPins', async (orig) => ({
  ...(await orig<Record<string, unknown>>()),
  teardropImageData: () => ({}) as ImageData,
  modeTeardropImageData: () => ({}) as ImageData,
}))

const hotspots: HotspotPin[] = [
  { kind: 'unvisited', locId: 'L1', locName: 'Alpha', lat: 37.70, lng: -122.50 },
  { kind: 'unvisited', locId: 'L2', locName: 'Beta', lat: 37.90, lng: -122.30 },
]
const targets: DisplayTargetPin[] = [
  { speciesCode: 'a', comName: 'Sage Thrasher', locId: 'L1', locName: 'Alpha', lat: 37.70, lng: -122.50, recentDate: '2026-06-01', checklistCount: 1, subId: 'S1', missingTypes: ['Photo'] },
  { speciesCode: 'b', comName: 'Lark Bunting', locId: 'L2', locName: 'Beta', lat: 37.90, lng: -122.30, recentDate: '2026-06-02', checklistCount: 1, subId: 'S2', missingTypes: ['Audio'] },
]
const lifers: NearbyLiferLocation[] = [
  { locId: 'L1', locName: 'Alpha', lat: 37.70, lng: -122.50, count: 1, tier: 'fresh' as const, mostRecentDate: '2026-06-01', lifers: [{ comName: 'Sage Thrasher', speciesCode: 'a', recentDate: '2026-06-01', subId: 'S1' }] },
  { locId: 'L2', locName: 'Beta', lat: 37.90, lng: -122.30, count: 1, tier: 'fresh' as const, mostRecentDate: '2026-06-02', lifers: [{ comName: 'Lark Bunting', speciesCode: 'b', recentDate: '2026-06-02', subId: 'S2' }] },
]

/** Each surface, rendered with a settable autoFit and with a single pin. */
const SURFACES = [
  {
    name: 'HotspotMarkers',
    many: (autoFit?: boolean) => <HotspotMarkers pins={hotspots} hiddenKinds={new Set()} sel={null} onSelect={() => {}} autoFit={autoFit} />,
    one: (autoFit?: boolean) => <HotspotMarkers pins={[hotspots[0]]} hiddenKinds={new Set()} sel={null} onSelect={() => {}} autoFit={autoFit} />,
  },
  {
    name: 'TargetMarkers',
    many: (autoFit?: boolean) => <TargetMarkers pins={targets} speciesCodeMap={{}} hasEntryFor={() => false} sel={null} onSelect={() => {}} autoFit={autoFit} />,
    one: (autoFit?: boolean) => <TargetMarkers pins={[targets[0]]} speciesCodeMap={{}} hasEntryFor={() => false} sel={null} onSelect={() => {}} autoFit={autoFit} />,
  },
  {
    name: 'NearbyLiferMarkers',
    many: (autoFit?: boolean) => <NearbyLiferMarkers pins={lifers} speciesCodeMap={{}} sel={null} onSelect={() => {}} autoFit={autoFit} />,
    one: (autoFit?: boolean) => <NearbyLiferMarkers pins={[lifers[0]]} speciesCodeMap={{}} sel={null} onSelect={() => {}} autoFit={autoFit} />,
  },
]

beforeEach(() => {
  h.fitCalls.length = 0
  h.flyCalls.length = 0
  cleanup()
})

for (const s of SURFACES) {
  describe(`${s.name} results fit`, () => {
    it('frames the results by default, so every shipped route is unchanged', () => {
      render(s.many())
      expect(h.fitCalls).toHaveLength(1)
      expect(h.fitCalls[0][0]).toEqual([[-122.50, 37.70], [-122.30, 37.90]])
    })

    it('flies to a single result by default', () => {
      render(s.one())
      expect(h.flyCalls).toHaveLength(1)
      expect(h.fitCalls).toHaveLength(0)
    })

    it('frames NOTHING when autoFit is false (the viewport-derived search)', () => {
      render(s.many(false))
      expect(h.fitCalls).toHaveLength(0)
      expect(h.flyCalls).toHaveLength(0)
    })

    it('flies NOWHERE for a single result when autoFit is false', () => {
      // The one-pin branch is a separate code path and had to be gated too.
      render(s.one(false))
      expect(h.flyCalls).toHaveLength(0)
      expect(h.fitCalls).toHaveLength(0)
    })

    it('does not retro-frame when autoFit flips to true with the same results', () => {
      // `autoFit` is deliberately not in the fit effect's dep list: a later flip
      // must not re-frame a result set that has already landed. Removing that
      // omission (adding autoFit to the deps) turns this red.
      const { rerender } = render(s.many(false))
      expect(h.fitCalls).toHaveLength(0)
      rerender(s.many(true))
      expect(h.fitCalls).toHaveLength(0)
      expect(h.flyCalls).toHaveLength(0)
    })
  })
}
