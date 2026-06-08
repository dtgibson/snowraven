import { describe, it, expect } from 'vitest'
import { markersInView, pointInBounds, MARKER_LIST_CAP, type MarkerBounds } from './markersInView'

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
