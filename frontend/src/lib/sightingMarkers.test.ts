import { describe, it, expect } from 'vitest'
import { buildSightingMarkers } from './sightingMarkers'

type S = { latitude: number | null; longitude: number | null; submissionId: string; date: string }

const s = (p: Partial<S> & { submissionId: string }): S => ({
  latitude: 37.7, longitude: -121.2, date: '2024-01-01', ...p,
})

describe('buildSightingMarkers', () => {
  it('returns [] for no sightings (caller renders no map)', () => {
    expect(buildSightingMarkers([])).toEqual([])
  })

  it('skips sightings with a null latitude or longitude', () => {
    const markers = buildSightingMarkers([
      s({ submissionId: 'S1', latitude: null, longitude: -121.2 }),
      s({ submissionId: 'S2', latitude: 37.7, longitude: null }),
      s({ submissionId: 'S3', latitude: null, longitude: null }),
      s({ submissionId: 'S4', latitude: 38.0, longitude: -122.0 }),
    ])
    expect(markers).toHaveLength(1)
    expect(markers[0]).toMatchObject({ lat: 38.0, lng: -122.0 })
    expect(markers[0].sightings.map(x => x.submissionId)).toEqual(['S4'])
  })

  it('returns [] when every sighting lacks usable coordinates', () => {
    expect(buildSightingMarkers([
      s({ submissionId: 'S1', latitude: null, longitude: null }),
      s({ submissionId: 'S2', latitude: 37.7, longitude: null }),
    ])).toEqual([])
  })

  it('aggregates sightings that share a coordinate into one marker', () => {
    const markers = buildSightingMarkers([
      s({ submissionId: 'S1', latitude: 37.7, longitude: -121.2, date: '2024-01-01' }),
      s({ submissionId: 'S2', latitude: 37.7, longitude: -121.2, date: '2024-03-01' }),
      s({ submissionId: 'S3', latitude: 40.0, longitude: -120.0, date: '2024-02-01' }),
    ])
    expect(markers).toHaveLength(2)
    const shared = markers.find(m => m.lat === 37.7)!
    expect(shared.sightings).toHaveLength(2)
  })

  it('orders each marker\'s dates newest-first', () => {
    const markers = buildSightingMarkers([
      s({ submissionId: 'S1', date: '2024-01-01' }),
      s({ submissionId: 'S2', date: '2024-05-01' }),
      s({ submissionId: 'S3', date: '2024-03-01' }),
    ])
    expect(markers).toHaveLength(1)
    expect(markers[0].sightings.map(x => x.date)).toEqual(['2024-05-01', '2024-03-01', '2024-01-01'])
  })

  it('preserves submission id alongside each date for the popup', () => {
    const markers = buildSightingMarkers([s({ submissionId: 'S100', date: '2024-04-01' })])
    expect(markers[0].sightings[0]).toEqual({ submissionId: 'S100', date: '2024-04-01' })
  })
})
