import { describe, it, expect } from 'vitest'
import { tideTooFarNotice, tideOverrideLabel } from './tideNotice'

describe('tideTooFarNotice', () => {
  it('too-far: names the distance and station, rounds the distance', () => {
    expect(tideTooFarNotice('Newburyport', 38.4, 'too-far')).toBe(
      'The nearest tide station is 38 miles away (Newburyport). Tide data may not reflect your spot.',
    )
  })
  it('outside-us: names the nearest US station and distance', () => {
    expect(tideTooFarNotice('Marblehead, OH (9063079)', 41.2, 'outside-us')).toBe(
      'Tide information is only available in the US. The nearest US station is Marblehead, OH (9063079), 41 miles away.',
    )
  })
})

describe('tideOverrideLabel', () => {
  it('too-far → "Show it anyway"', () => {
    expect(tideOverrideLabel('too-far')).toBe('Show it anyway')
  })
  it('outside-us → "Show nearest US station"', () => {
    expect(tideOverrideLabel('outside-us')).toBe('Show nearest US station')
  })
})
