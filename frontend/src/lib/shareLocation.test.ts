// Pin Share payload — the exact-string contract (FR-19 to FR-23, QA-24/26/27/28,
// NFR-12). No map, no DOM, no clipboard: the whole payload is a pure function of
// a latitude, a longitude and a mode, which is what makes this checkable.

import { describe, it, expect } from 'vitest'
import {
  appleMapsUrl,
  buildSharePayload,
  formatCoordinate,
  googleMapsUrl,
  normalizeLongitude,
} from './shareLocation'

describe('formatCoordinate (FR-19)', () => {
  it('renders five decimals, latitude first, comma plus one space (QA-24)', () => {
    expect(formatCoordinate(38.543210, -121.987654)).toBe('38.54321, -121.98765')
  })

  it('pads short values out to five decimals', () => {
    expect(formatCoordinate(38.5, -121)).toBe('38.50000, -121.00000')
  })

  it('carries a leading minus for a southern / western coordinate and no hemisphere letter', () => {
    const s = formatCoordinate(-33.86880, -151.20930)
    expect(s).toBe('-33.86880, -151.20930')
    expect(s).not.toMatch(/[NSEW°+]/)
  })

  it('rounds rather than truncates', () => {
    expect(formatCoordinate(0.000006, 0.000004)).toBe('0.00001, 0.00000')
  })

  it('never leaks a negative zero from a coordinate that ROUNDS to zero', () => {
    // (-0.000001).toFixed(5) is "-0.00000" — a minus sign on a value that reads
    // as zero. A coordinate just west of the prime meridian must format 0.00000.
    expect(formatCoordinate(-0.000001, -0.000001)).toBe('0.00000, 0.00000')
    expect(formatCoordinate(-0, -0)).toBe('0.00000, 0.00000')
    // …but a genuinely negative value keeps its sign.
    expect(formatCoordinate(-0.5, -0.00002)).toBe('-0.50000, -0.00002')
  })
})

describe('normalizeLongitude (FR-20)', () => {
  it('leaves an already-wrapped longitude alone', () => {
    expect(normalizeLongitude(-121.98765)).toBeCloseTo(-121.98765, 10)
    expect(normalizeLongitude(0)).toBe(0)
  })

  it('wraps an unwrapped longitude back into [-180, 180]', () => {
    // MapLibre reports unwrapped longitudes after repeated antimeridian panning.
    expect(normalizeLongitude(200)).toBeCloseTo(-160, 10)
    expect(normalizeLongitude(-190)).toBeCloseTo(170, 10)
    expect(normalizeLongitude(540)).toBeCloseTo(180 - 360, 10) // 540 → -180
    expect(normalizeLongitude(-400)).toBeCloseTo(-40, 10)
  })

  it('maps exactly 180 to -180 — accepted, and asserted so it is on the record', () => {
    // Both name the antimeridian and both resolve correctly in Google Maps and
    // Apple Maps, so this is a decision rather than a bug.
    expect(normalizeLongitude(180)).toBe(-180)
    expect(normalizeLongitude(-180)).toBe(-180)
  })

  it('passes a non-finite value through rather than producing NaN arithmetic noise', () => {
    expect(Number.isNaN(normalizeLongitude(NaN))).toBe(true)
    expect(normalizeLongitude(Infinity)).toBe(Infinity)
  })
})

describe('the maps links (FR-23, D-04 — the forms are settled)', () => {
  it('builds the ratified Google Maps coordinate url, comma with NO space', () => {
    expect(googleMapsUrl(38.54321, -121.98765))
      .toBe('https://maps.google.com/?q=38.54321,-121.98765')
  })

  it('builds the ratified Apple Maps coordinate url, comma with NO space', () => {
    // Verified live during the build: this form 301s to
    // /place?coordinate=38.54321%2C-121.98765, i.e. Apple resolves it as a
    // coordinate and drops a pin. The ?ll=&q= fallback redirects identically.
    expect(appleMapsUrl(38.54321, -121.98765))
      .toBe('https://maps.apple.com/?q=38.54321,-121.98765')
  })

  it('normalizes longitude inside the urls too, not only in the coordinate line', () => {
    expect(googleMapsUrl(10, 200)).toBe('https://maps.google.com/?q=10.00000,-160.00000')
    expect(appleMapsUrl(10, 200)).toBe('https://maps.apple.com/?q=10.00000,-160.00000')
  })
})

describe('buildSharePayload (FR-21 / FR-22, QA-27 / QA-28)', () => {
  it('default mode is exactly three lines, in order, with no trailing newline', () => {
    const payload = buildSharePayload(38.54321, -121.98765, 'coords-and-links')
    expect(payload).toBe(
      '38.54321, -121.98765\n'
      + 'Google Maps: https://maps.google.com/?q=38.54321,-121.98765\n'
      + 'Apple Maps: https://maps.apple.com/?q=38.54321,-121.98765',
    )
    expect(payload.split('\n')).toHaveLength(3)
    expect(payload.endsWith('\n')).toBe(false)
  })

  it('coordinates-only mode is exactly the one coordinate line and nothing else', () => {
    const payload = buildSharePayload(38.54321, -121.98765, 'coords-only')
    expect(payload).toBe('38.54321, -121.98765')
    expect(payload).not.toContain('http')
    expect(payload).not.toContain('\n')
  })

  it('the coordinate line is a prefix of the default payload, so the modes agree', () => {
    const one = buildSharePayload(-33.8688, 151.2093, 'coords-only')
    const three = buildSharePayload(-33.8688, 151.2093, 'coords-and-links')
    expect(three.startsWith(`${one}\n`)).toBe(true)
  })

  it('the URLs carry THE SAME five-decimal values as the coordinate line', () => {
    // The parity lock the single rounding site exists for: if the formatter
    // normalized longitude and a url builder did not (or vice versa), the copied
    // coordinate and the copied link would point at different places, and no
    // test that checked them separately would catch it. Deliberately uses an
    // UNWRAPPED longitude, where the two could most easily diverge.
    const lat = 38.5432104
    const lng = 238.0123449 // unwrapped: really -121.9876551
    const line = formatCoordinate(lat, lng)
    const pair = line.replace(', ', ',')
    const payload = buildSharePayload(lat, lng, 'coords-and-links')
    expect(payload.split('\n')[0]).toBe(line)
    expect(payload).toContain(`https://maps.google.com/?q=${pair}`)
    expect(payload).toContain(`https://maps.apple.com/?q=${pair}`)
    expect(googleMapsUrl(lat, lng)).toContain(pair)
    expect(appleMapsUrl(lat, lng)).toContain(pair)
  })

  it('builds every character from numeric input, so no external text can reach a url (NFR-08)', () => {
    const payload = buildSharePayload(38.54321, -121.98765, 'coords-and-links')
    for (const url of payload.split('\n').slice(1).map(l => l.split(' ').pop())) {
      expect(url).toMatch(/^https:\/\/maps\.(google|apple)\.com\/\?q=-?\d+\.\d{5},-?\d+\.\d{5}$/)
    }
  })
})
