import { describe, it, expect } from 'vitest'
import {
  markersInView, pointInBounds, unpadBounds, pointNeedsPan,
  MARKER_LIST_CAP, VIEWPORT_PAD_FRAC, type MarkerBounds,
} from './markersInView'
import { padBounds } from './atlasBlocks'

const BOUNDS: MarkerBounds = [-122.5, 37.5, -122.0, 38.0]

describe('pointInBounds', () => {
  it('is inclusive of the edges', () => {
    expect(pointInBounds(37.5, -122.5, BOUNDS)).toBe(true)
    expect(pointInBounds(38.0, -122.0, BOUNDS)).toBe(true)
  })
  it('rejects points outside the box', () => {
    expect(pointInBounds(37.8, -123.0, BOUNDS)).toBe(false) // too far west
    expect(pointInBounds(39.0, -122.2, BOUNDS)).toBe(false) // too far north
  })
})

describe('markersInView', () => {
  const markers = [
    { lat: 37.8, lng: -122.26, id: 'in-1' },
    { lat: 37.9, lng: -122.10, id: 'in-2' },
    { lat: 39.0, lng: -120.00, id: 'out' },
  ]

  it('keeps only markers inside the bounds, preserving caller order', () => {
    const r = markersInView(markers, BOUNDS)
    expect(r.visible.map(m => m.id)).toEqual(['in-1', 'in-2'])
    expect(r.total).toBe(2)
    expect(r.overCap).toBe(false)
  })

  it('treats null bounds as "all in view" (map not ready yet)', () => {
    const r = markersInView(markers, null)
    expect(r.visible.length).toBe(3)
    expect(r.total).toBe(3)
  })

  it('caps the list and flags over-cap, reporting the true pre-cap total', () => {
    const many = Array.from({ length: MARKER_LIST_CAP + 25 }, (_, i) => ({ lat: 37.8, lng: -122.26, id: `m${i}` }))
    const r = markersInView(many, BOUNDS)
    expect(r.visible.length).toBe(MARKER_LIST_CAP)
    expect(r.total).toBe(MARKER_LIST_CAP + 25)
    expect(r.overCap).toBe(true)
  })

  it('respects a custom cap', () => {
    const r = markersInView(markers, null, 1)
    expect(r.visible.length).toBe(1)
    expect(r.total).toBe(3)
    expect(r.overCap).toBe(true)
  })
})

// feature: uniform-map-fabs — the centre-share FAB pans to an off-screen centre
// before opening a popup there, and the only viewport it can see is the PADDED
// one BoundsTracker reports.
describe('unpadBounds', () => {
  it('exactly inverts the padding BoundsTracker applies', () => {
    // Against the real padBounds, not a re-derivation of it: this is the
    // property that matters, and re-implementing the forward direction in the
    // test would let both drift together.
    for (const b of [BOUNDS, [-180, -80, 180, 80], [10, 10, 10.5, 10.25]] as MarkerBounds[]) {
      const back = unpadBounds(padBounds(b, VIEWPORT_PAD_FRAC))
      for (let i = 0; i < 4; i++) expect(back[i]).toBeCloseTo(b[i], 10)
    }
  })

  it('shrinks rather than grows, at any fraction', () => {
    const padded: MarkerBounds = [-10, -10, 10, 10]
    const inner = unpadBounds(padded, 0.5)
    expect(inner[0]).toBeGreaterThan(padded[0])
    expect(inner[1]).toBeGreaterThan(padded[1])
    expect(inner[2]).toBeLessThan(padded[2])
    expect(inner[3]).toBeLessThan(padded[3])
  })

  it('is the identity at zero padding', () => {
    expect(unpadBounds(BOUNDS, 0)).toEqual(BOUNDS)
  })
})

describe('pointNeedsPan', () => {
  /** The viewport a user is actually looking at, and what BoundsTracker reports for it. */
  const VISIBLE: MarkerBounds = [-122.5, 37.5, -122.0, 38.0]
  const REPORTED = padBounds(VISIBLE, VIEWPORT_PAD_FRAC)

  it('says no for a point in the middle of the view', () => {
    expect(pointNeedsPan(37.75, -122.25, REPORTED)).toBe(false)
  })

  it('says yes for a point well outside the view', () => {
    expect(pointNeedsPan(45.0, -100.0, REPORTED)).toBe(true)
  })

  /**
   * THE ONE THAT MATTERS, and the reason the pad is removed rather than tested
   * against directly. A point in the pad RING is off screen — the padding exists
   * so a marker near the edge does not pop out of a sidebar list mid-pan, not
   * because it is visible. Testing REPORTED directly would call this in view and
   * open the popup where the user cannot see it, which is the exact failure the
   * pan exists to prevent.
   *
   * Deleting the unpadBounds call from pointNeedsPan turns this red and leaves
   * the two cases above green.
   */
  it('says yes for a point inside the reported pad but outside the visible view', () => {
    const inRing = 38.0 + (VISIBLE[3] - VISIBLE[1]) * 0.05   // 0.025 deg north of the top edge
    expect(pointInBounds(inRing, -122.25, REPORTED)).toBe(true)   // inside what the tracker reports
    expect(pointNeedsPan(inRing, -122.25, REPORTED)).toBe(true)   // ...and still off screen
  })

  it('says no when no viewport has been reported yet', () => {
    // Nothing has moved from the centre the map was framed on, so a 600ms flight
    // would be motion for its own sake.
    expect(pointNeedsPan(45.0, -100.0, null)).toBe(false)
  })
})
