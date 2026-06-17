import { describe, expect, it } from 'vitest'
import { MAP_VIEW_MODE_ORDER } from './mapViewModes'

describe('MAP_VIEW_MODE_ORDER', () => {
  it('places Nearby Lifers before Media Targets', () => {
    expect(MAP_VIEW_MODE_ORDER.map(item => item.label)).toEqual([
      'My Sightings',
      'Hotspots',
      'Nearby Lifers',
      'Media Targets',
    ])
  })
})
