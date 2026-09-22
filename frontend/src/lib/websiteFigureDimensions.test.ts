// The website's feature figures, pinned to the files on disk.
//
// WHY THIS FILE EXISTS. `website/index.html` declares a `width` and `height` on
// every screenshot so the browser reserves the box before the image arrives.
// v1.0.27 stated the rule that an asset and its declared dimensions land in one
// commit; `statistics-mobile.webp` then sat at 560x1226 declaring 1198 for five
// releases, because nothing read the declarations back against the files. A
// twelve-pixel lie is invisible by eye and moves the phone frame on load.
//
// The second claim is newer (website-screenshot-sizing). Every feature figure is
// now a 16:9 box of its grid track, filled with `object-fit: cover`, so an asset
// whose own aspect is not 16:9 is CROPPED at the edges: 11% off the right of a
// 2:1 Named Birds capture, where the sighting counts and the strip's end label
// sit. The house rule is that such an asset is reshaped AT CAPTURE
// (`website/tools/capture.mjs`), never cropped by CSS, and `cover` exists only to
// absorb sub-1% rounding. This suite is what holds a future recapture to it.
//
// WEBP IS PARSED HERE, IN PURE JS, ON PURPOSE. Shelling out to `sips` would make
// this guard macOS-only and it would silently not run in CI, which is an
// ubuntu-latest runner — the shape `.claude/rules/testing.md` calls worse than
// having no gate at all. The parser covers the three WebP chunk layouts and
// THROWS on anything it does not understand, so an unreadable file fails the
// suite rather than passing it.
//
// NON-VACUITY. Every row asserts its population is non-empty before asserting
// anything about its members: a features section that stopped matching, or a
// regex that stopped finding `<img>` elements, would otherwise turn this suite
// into ten green assertions over nothing.
/// <reference types="node" />
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const read = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8')
const bytes = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url))

/**
 * Assets the 16:9 rule deliberately does NOT cover, each with its reason. The
 * phone capture is not a feature figure: it renders inside `.phone-frame`, which
 * is a 260px-wide portrait device frame and has no aspect box. Its DECLARED size
 * is still checked, by the row for figures outside the features section.
 */
const ASPECT_EXEMPT: Record<string, string> = {
  'assets/shots/statistics-mobile.webp': 'the Platforms phone frame, portrait by design',
}

const SIXTEEN_NINE = 16 / 9
const ASPECT_TOLERANCE = 0.01

// ---------------------------------------------------------------- webp parsing

/**
 * Intrinsic pixel size of a WebP file, from its header alone. Covers the three
 * chunk layouts a WebP can open with and fails closed on every other shape.
 */
export function webpSize(buf: Buffer): { width: number; height: number } {
  if (buf.length < 30) throw new Error('webp: file is too short to carry a header')
  if (buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WEBP') {
    throw new Error('webp: not a RIFF/WEBP container')
  }
  const fourcc = buf.toString('ascii', 12, 16)
  const data = 20 // 12 chunk header start + 4 fourcc + 4 chunk length

  if (fourcc === 'VP8 ') {
    // Lossy. 3-byte frame tag, then the 3-byte sync code, then 14-bit dimensions.
    if (buf[data + 3] !== 0x9d || buf[data + 4] !== 0x01 || buf[data + 5] !== 0x2a) {
      throw new Error('webp: VP8 chunk has no sync code')
    }
    return {
      width: buf.readUInt16LE(data + 6) & 0x3fff,
      height: buf.readUInt16LE(data + 8) & 0x3fff,
    }
  }
  if (fourcc === 'VP8L') {
    // Lossless. Signature byte, then 14 bits of (width - 1) and 14 of (height - 1).
    if (buf[data] !== 0x2f) throw new Error('webp: VP8L chunk has no signature byte')
    const b = buf.readUInt32LE(data + 1)
    return { width: (b & 0x3fff) + 1, height: ((b >> 14) & 0x3fff) + 1 }
  }
  if (fourcc === 'VP8X') {
    // Extended. 4 flag bytes, then 24-bit canvas width - 1 and height - 1.
    const w = buf[data + 4] | (buf[data + 5] << 8) | (buf[data + 6] << 16)
    const h = buf[data + 7] | (buf[data + 8] << 8) | (buf[data + 9] << 16)
    return { width: w + 1, height: h + 1 }
  }
  throw new Error(`webp: unsupported leading chunk "${fourcc}"`)
}

// ------------------------------------------------------------------ the markup

const html = read('website/index.html')

/** The features section, `<section class="features" ...>` to its close. */
function featuresSection(): string {
  const start = html.indexOf('<section class="features"')
  expect(start, 'website/index.html has a features section').toBeGreaterThan(-1)
  const end = html.indexOf('</section>', start)
  expect(end, 'the features section is closed').toBeGreaterThan(start)
  return html.slice(start, end)
}

interface Shot { src: string; width: number; height: number }

/** Every `<img>` in `markup` that points at a committed shot, with its declaration. */
function shots(markup: string): Shot[] {
  const out: Shot[] = []
  for (const tag of markup.match(/<img\b[^>]*>/g) ?? []) {
    const src = /\bsrc="([^"]+)"/.exec(tag)?.[1]
    if (!src?.startsWith('assets/shots/')) continue
    const width = Number(/\bwidth="(\d+)"/.exec(tag)?.[1])
    const height = Number(/\bheight="(\d+)"/.exec(tag)?.[1])
    expect(Number.isInteger(width) && Number.isInteger(height), `${src} declares a width and a height`).toBe(true)
    out.push({ src, width, height })
  }
  return out
}

const featureShots = shots(featuresSection())
const otherShots = shots(html).filter(s => !featureShots.some(f => f.src === s.src && f.width === s.width))

describe('the website feature figures match the assets on disk', () => {
  it('finds every feature figure (non-vacuity)', () => {
    // Ten feature rows; eight carry a screenshot, one of which swaps light/dark,
    // and two are hand-built DOM mocks with no image at all.
    expect(featureShots.length).toBeGreaterThanOrEqual(8)
    expect(new Set(featureShots.map(s => s.src)).size).toBe(featureShots.length)
  })

  it('declares each feature figure at its asset\'s true pixel size', () => {
    for (const shot of featureShots) {
      const real = webpSize(bytes(`website/${shot.src}`))
      expect({ src: shot.src, ...real }).toEqual({ src: shot.src, width: shot.width, height: shot.height })
    }
  })

  it('keeps every feature figure within 1% of 16:9, so the CSS box never crops', () => {
    const judged = featureShots.filter(s => !(s.src in ASPECT_EXEMPT))
    expect(judged.length, 'the aspect rule judges at least one figure').toBeGreaterThanOrEqual(8)
    for (const shot of judged) {
      const real = webpSize(bytes(`website/${shot.src}`))
      const off = Math.abs(real.width / real.height / SIXTEEN_NINE - 1)
      expect(
        off,
        `${shot.src} is ${real.width}x${real.height}, ${(off * 100).toFixed(2)}% off 16:9; reshape it at capture rather than letting object-fit crop it`,
      ).toBeLessThanOrEqual(ASPECT_TOLERANCE)
    }
  })

  it('declares the figures outside the features section at their true pixel size too', () => {
    // The hero shot and the Platforms phone shot. They carry no aspect box, but
    // the v1.0.27 rule that an asset and its declaration land together is
    // general: statistics-mobile.webp is the one that broke it.
    expect(otherShots.length, 'the page carries shots outside the features section').toBeGreaterThanOrEqual(2)
    expect(otherShots.map(s => s.src)).toContain('assets/shots/statistics-mobile.webp')
    for (const shot of otherShots) {
      const real = webpSize(bytes(`website/${shot.src}`))
      expect({ src: shot.src, ...real }).toEqual({ src: shot.src, width: shot.width, height: shot.height })
    }
  })
})

describe('the WebP header parser', () => {
  it('reads a committed asset rather than guessing', () => {
    // Guard the guard: a parser that returned a constant, or silently returned
    // zeroes, would make every row above vacuously true.
    const real = webpSize(bytes('website/assets/shots/statistics-mobile.webp'))
    expect(real.width).toBeGreaterThan(0)
    expect(real.height).toBeGreaterThan(real.width) // the one portrait asset
  })

  it('fails closed on a file it does not understand', () => {
    const good = bytes('website/assets/shots/map.webp')
    expect(() => webpSize(Buffer.alloc(8))).toThrow(/too short/)
    const notRiff = Buffer.from(good)
    notRiff.write('RIFX', 0, 'ascii')
    expect(() => webpSize(notRiff)).toThrow(/RIFF/)
    const unknownChunk = Buffer.from(good)
    unknownChunk.write('ZZZZ', 12, 'ascii')
    expect(() => webpSize(unknownChunk)).toThrow(/unsupported leading chunk/)
    const noSync = Buffer.from(good)
    noSync[23] = 0x00
    expect(() => webpSize(noSync)).toThrow(/sync code/)
  })
})
