// Pin Share payload and the copy it generates — the exact-string contract
// (FR-19 to FR-23, QA-24/26/27/28, NFR-12). No map, no DOM, no clipboard: the
// payload and every sentence describing it are pure functions of a latitude, a
// longitude and a selection, which is what makes this checkable.

import { describe, it, expect } from 'vitest'
import {
  appleMapsUrl,
  buildSharePayload,
  formatCoordinate,
  googleMapsUrl,
  normalizeLongitude,
  selectedParts,
  shareCopyLabel,
  shareModeLine,
  sharePartName,
  SHARE_PARTS,
} from './shareLocation'
import type { SharePart, ShareCopySelection } from './shareLocation'

const LAT = 38.54321
const LNG = -121.98765
const COORD_LINE = '38.54321, -121.98765'
const GOOGLE_LINE = 'Google Maps: https://maps.google.com/?q=38.54321,-121.98765'
const APPLE_LINE = 'Apple Maps: https://maps.apple.com/?q=38.54321,-121.98765'

function sel(coords: boolean, google: boolean, apple: boolean): ShareCopySelection {
  return { coords, google, apple }
}

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

// ── The payload, across all eight selections ─────────────────────────────────

describe('buildSharePayload across every selection (FR-21 / FR-22, QA-27 / QA-28)', () => {
  const CASES: [ShareCopySelection, string[]][] = [
    [sel(true, true, true), [COORD_LINE, GOOGLE_LINE, APPLE_LINE]],
    [sel(true, true, false), [COORD_LINE, GOOGLE_LINE]],
    [sel(true, false, true), [COORD_LINE, APPLE_LINE]],
    [sel(true, false, false), [COORD_LINE]],
    [sel(false, true, true), [GOOGLE_LINE, APPLE_LINE]],
    [sel(false, true, false), [GOOGLE_LINE]],
    [sel(false, false, true), [APPLE_LINE]],
    [sel(false, false, false), []],
  ]

  it.each(CASES)('%o produces exactly its lines, in fixed payload order', (selection, lines) => {
    expect(buildSharePayload(LAT, LNG, selection)).toBe(lines.join('\n'))
  })

  it('keeps the coordinates / Google / Apple order regardless of which are on', () => {
    // Order comes from the table, never from the order switches were flipped.
    const both = buildSharePayload(LAT, LNG, sel(false, true, true)).split('\n')
    expect(both).toEqual([GOOGLE_LINE, APPLE_LINE])
  })

  it('leaves NO blank line and no dangling label when a MIDDLE element is elided', () => {
    // Rejects the naive builder that keeps a fixed three-slot template and
    // substitutes an empty string for an off part: that produces
    // "38.54321, -121.98765\n\nApple Maps: …", which pastes with a hole in it.
    // A present-lines array joined with \n cannot express that.
    const payload = buildSharePayload(LAT, LNG, sel(true, false, true))
    expect(payload).toBe(`${COORD_LINE}\n${APPLE_LINE}`)
    expect(payload).not.toContain('\n\n')
    expect(payload.split('\n')).toHaveLength(2)
    // Each label is still attached to its own line, so the Apple line is
    // self-describing on its own.
    expect(payload.split('\n')[1].startsWith('Apple Maps: ')).toBe(true)
  })

  it('never emits a trailing newline, at any count', () => {
    for (const [selection] of CASES) {
      expect(buildSharePayload(LAT, LNG, selection).endsWith('\n')).toBe(false)
    }
  })

  it('is the EMPTY STRING when nothing is selected, so a copy would be a no-op', () => {
    // Both callers treat this structurally (no copy control at all). The empty
    // string is what makes "no control that looks pressable may put an empty
    // string on the clipboard" checkable rather than a slogan.
    expect(buildSharePayload(LAT, LNG, sel(false, false, false))).toBe('')
  })

  it('the coordinate line is a prefix of the richer payloads, so the selections agree', () => {
    const one = buildSharePayload(-33.8688, 151.2093, sel(true, false, false))
    const three = buildSharePayload(-33.8688, 151.2093, sel(true, true, true))
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
    const payload = buildSharePayload(lat, lng, sel(true, true, true))
    expect(payload.split('\n')[0]).toBe(line)
    expect(payload).toContain(`https://maps.google.com/?q=${pair}`)
    expect(payload).toContain(`https://maps.apple.com/?q=${pair}`)
    expect(googleMapsUrl(lat, lng)).toContain(pair)
    expect(appleMapsUrl(lat, lng)).toContain(pair)
  })

  it('builds every character from numeric input, so no external text can reach a url (NFR-08)', () => {
    const payload = buildSharePayload(LAT, LNG, sel(true, true, true))
    for (const url of payload.split('\n').slice(1).map(l => l.split(' ').pop())) {
      expect(url).toMatch(/^https:\/\/maps\.(google|apple)\.com\/\?q=-?\d+\.\d{5},-?\d+\.\d{5}$/)
    }
  })
})

// ── The generating rule ─────────────────────────────────────────────────────

describe('the generating rule across all eight states', () => {
  // The table from the design refinement, verbatim. Every one of these is
  // PRODUCED by two functions over SHARE_PARTS; the wrong implementation this
  // whole block rejects is eight hand-written labels and eight hand-written mode
  // lines, which would be correct on the day they were typed and drift
  // thereafter (and which the four-part block below proves cannot generalize).
  const CASES: [ShareCopySelection, string, string][] = [
    [sel(true, true, true), 'Copy coordinates and map links',
      'Three lines: coordinates, Google Maps link, Apple Maps link.'],
    [sel(true, true, false), 'Copy coordinates and Google Maps link',
      'Two lines: coordinates, Google Maps link.'],
    [sel(true, false, true), 'Copy coordinates and Apple Maps link',
      'Two lines: coordinates, Apple Maps link.'],
    [sel(true, false, false), 'Copy coordinates',
      'One line: coordinates.'],
    [sel(false, true, true), 'Copy map links',
      'Two lines: Google Maps link, Apple Maps link.'],
    [sel(false, true, false), 'Copy Google Maps link',
      'One line: Google Maps link.'],
    [sel(false, false, true), 'Copy Apple Maps link',
      'One line: Apple Maps link.'],
  ]

  it.each(CASES)('%o labels the button and the mode line', (selection, button, line) => {
    const on = selectedParts(selection)
    expect(shareCopyLabel(on)).toBe(button)
    expect(shareModeLine(on)).toBe(line)
  })

  it('collapses a COMPLETE family to its class noun rather than naming both providers', () => {
    // The collapse is the whole reason the all-on label fits the popup. Rejects
    // an implementation that always enumerates.
    expect(shareCopyLabel(selectedParts(sel(false, true, true)))).toBe('Copy map links')
    expect(shareCopyLabel(selectedParts(sel(true, true, true)))).toBe('Copy coordinates and map links')
  })

  it('names the ONE provider when a family is only partly on', () => {
    // The complement of the collapse: "Copy map links" would be a lie here.
    expect(shareCopyLabel(selectedParts(sel(false, true, false)))).toBe('Copy Google Maps link')
    expect(shareCopyLabel(selectedParts(sel(false, false, true)))).toBe('Copy Apple Maps link')
  })

  it('keeps the longest button label within the ceiling the compact popup allows', () => {
    // 37 characters is what the family collapse buys. The uncollapsed serial
    // list ("Copy coordinates, Google Maps link, and Apple Maps link") is 54 and
    // wraps to three lines inside the 224px compact popup, which is why it was
    // rejected. This is the guard on that ceiling.
    const longest = Math.max(...CASES.map(([, button]) => button.length))
    expect(longest).toBe(37)
    expect(longest).toBeLessThanOrEqual(40)
  })

  it('uses the noun COLUMN mid sentence, never the switch label lowercased', () => {
    // Rejects `p.label.toLowerCase()`. On today's three that trick produces
    // "google maps link" / "apple maps link"; the proper nouns must keep their
    // capitals, and "coordinates" must not keep the label's.
    const line = shareModeLine(selectedParts(sel(true, true, true)))
    expect(line).toContain('coordinates')
    expect(line).not.toContain('Coordinates')
    expect(line).toContain('Google Maps link')
    expect(line).not.toContain('google maps link')
    expect(line).toContain('Apple Maps link')
    expect(line).not.toContain('apple maps link')
  })

  it('agrees with what the payload actually contains, count and nouns alike', () => {
    // The mode line is a promise about the clipboard; this is the only test that
    // holds the two against each other.
    for (const [selection, , line] of CASES) {
      const on = selectedParts(selection)
      const lines = buildSharePayload(LAT, LNG, selection).split('\n')
      expect(lines).toHaveLength(on.length)
      expect(line.startsWith(['Zero', 'One', 'Two', 'Three'][on.length])).toBe(true)
      expect(line.endsWith('.')).toBe(true)
    }
  })

  it('says "line" for one and "lines" for more', () => {
    expect(shareModeLine(selectedParts(sel(true, false, false)))).toContain(' line: ')
    expect(shareModeLine(selectedParts(sel(true, true, false)))).toContain(' lines: ')
  })

  it('generates each switch accessible name from its own row, leading with the visible label', () => {
    // WCAG 2.5.3 Label in Name: the visible string comes first so Voice Control
    // can activate the switch by what is on screen.
    expect(SHARE_PARTS.map(sharePartName)).toEqual([
      'Coordinates. Include the coordinate pair when copying a location.',
      'Google Maps link. Include a Google Maps link when copying a location.',
      'Apple Maps link. Include an Apple Maps link when copying a location.',
    ])
    for (const part of SHARE_PARTS) {
      expect(sharePartName(part).startsWith(part.label)).toBe(true)
    }
  })

  it('carries no em dash in any generated string or table column', () => {
    for (const [, button, line] of CASES) {
      expect(button).not.toContain('—')
      expect(line).not.toContain('—')
    }
    for (const part of SHARE_PARTS) {
      expect(`${part.label}${part.noun}${part.aside}${sharePartName(part)}`).not.toContain('—')
    }
  })
})

// ── The extensibility claim, checked rather than asserted ────────────────────

describe('adding a destination is ONE TABLE ROW and no new copy', () => {
  // The hypothetical fourth destination the design pass used to catch the
  // `.toLowerCase()` trap. It is a plain row: no new function, no new string
  // constant, no new branch. If any of these expectations needed a code change
  // to satisfy, the rule would have degenerated into a lookup table.
  const BING: SharePart = {
    key: 'bing',
    label: 'Bing Maps link',
    noun: 'Bing Maps link',
    qualifier: 'Bing Maps',
    family: 'link',
    aside: 'a Bing Maps link',
    line: (lat, lng) => `Bing Maps: https://bing.com/maps?q=${lat},${lng}`,
  }
  const FOUR: readonly SharePart[] = [...SHARE_PARTS, BING]
  const all = { coords: true, google: true, apple: true, bing: true }

  it('collapses all three link destinations to the same "map links" with no new copy', () => {
    const on = selectedParts(all, FOUR)
    expect(on).toHaveLength(4)
    expect(shareCopyLabel(on, FOUR)).toBe('Copy coordinates and map links')
  })

  it('names the fourth in full in the mode line, with a WORD count and not a digit', () => {
    // countWord runs past today's three on purpose. A three-entry ladder would
    // produce "4 lines: …", mixing a digit into a sentence of word forms.
    expect(shareModeLine(selectedParts(all, FOUR)))
      .toBe('Four lines: coordinates, Google Maps link, Apple Maps link, Bing Maps link.')
  })

  it('keeps the new destination CAPITALISED mid sentence, which lowercasing a label could not', () => {
    // The reason label and noun are separate columns. `p.label.toLowerCase()`
    // reads correctly on "coordinates" and silently produces "bing maps link".
    const line = shareModeLine(selectedParts(all, FOUR))
    expect(line).toContain('Bing Maps link')
    expect(line).not.toContain('bing maps link')
  })

  it('names exactly the on-members when the enlarged family is only partly on', () => {
    const twoOfThree = selectedParts({ coords: false, google: true, apple: false, bing: true }, FOUR)
    expect(shareCopyLabel(twoOfThree, FOUR)).toBe('Copy Google Maps and Bing Maps links')
    expect(shareModeLine(twoOfThree)).toBe('Two lines: Google Maps link, Bing Maps link.')
  })

  it('disambiguates a two-group phrase whose second group is itself compound', () => {
    // The fully general case the design named as grammatical and unreachable at
    // three parts: without the Oxford comma this reads as three coordinate
    // things joined by "and".
    const on = selectedParts({ coords: true, google: true, apple: false, bing: true }, FOUR)
    expect(shareCopyLabel(on, FOUR)).toBe('Copy coordinates, and Google Maps and Bing Maps links')
  })

  it('extends the PAYLOAD from the same row, in table order, with no extra separator', () => {
    const payload = buildSharePayload(LAT, LNG, all, FOUR)
    expect(payload.split('\n')).toHaveLength(4)
    expect(payload.split('\n')[3]).toBe(`Bing Maps: https://bing.com/maps?q=${LAT},${LNG}`)
    expect(payload).not.toContain('\n\n')
  })

  it('generates its switch accessible name from the same formula', () => {
    expect(sharePartName(BING)).toBe('Bing Maps link. Include a Bing Maps link when copying a location.')
  })
})
