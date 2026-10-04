/// <reference types="node" />
// THE ANDROID LAUNCHER ICON SET (android-release FR-09, QA-09, schema 3.5).
//
// src-tauri/icons/android is the source of truth and is copied byte for byte
// over the template placeholders in gen/android's res/. The hdpi launcher pair
// was generated at 49 px where the bucket is 72 (v0.5.93) and nothing read it
// until this run, which regenerated it; the dimension table below is pinned
// whole so a short bucket cannot recur. The adaptive foreground's mark must
// sit inside the 66dp safe zone of its 108dp canvas, or a launcher mask cuts
// it. The staged F-Droid listing icon (held-copy.md, "Listing icon") must be
// 512 by 512 and fully opaque: no alpha channel, no tRNS chunk, every alpha
// 255, which the same pure-JS reader decides (QA-09, part C).
import { describe, it, expect } from 'vitest'
import { existsSync } from 'node:fs'
import { deflateSync } from 'node:zlib'
import { resolve } from 'node:path'
import { REPO, readRepo, readRepoBytes, readPng, xmlTags } from '../test/androidProject'

const SRC = 'src-tauri/icons/android'
const RES = 'src-tauri/gen/android/app/src/main/res'
const BUCKETS = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 } as const
type Bucket = keyof typeof BUCKETS

/** The size the bucket requires for each launcher PNG (48dp launcher, 108dp foreground). */
function expectedSize(file: string, bucket: Bucket): number {
  const dp = file === 'ic_launcher_foreground.png' ? 108 : 48
  return Math.round(dp * BUCKETS[bucket])
}

/** Every reason a bucket's PNG is wrong, so the guard-the-guard rows reuse it. */
function bucketProblems(bytes: Buffer, file: string, bucket: Bucket): string[] {
  const png = readPng(bytes)
  const want = expectedSize(file, bucket)
  const out: string[] = []
  if (png.width !== want || png.height !== want) out.push(`${bucket}/${file} is ${png.width}x${png.height}, wants ${want}`)
  if (file === 'ic_launcher_foreground.png') {
    // the 66dp safe zone, centred in the 108dp canvas
    const lo = Math.floor((21 / 108) * png.width)
    const hi = Math.ceil((87 / 108) * png.width)
    const box = png.opaqueBox
    if (!box) out.push(`${bucket}/${file} is fully transparent`)
    else if (box[0] < lo || box[1] < lo || box[2] > hi || box[3] > hi) {
      out.push(`${bucket}/${file} mark [${box.join(',')}] leaves the safe zone ${lo}..${hi}`)
    }
  }
  return out
}

const FILES = ['ic_launcher.png', 'ic_launcher_round.png', 'ic_launcher_foreground.png'] as const

/** The staged F-Droid listing icon (held-copy.md, "Listing icon"). */
const STORE_ICON = 'pipeline/android-release/fdroid/fastlane-proposal/en-US/images/icon.png'
const STORE_ICON_SIZE = 512

/** The PNG chunk types in file order, so a tRNS chunk (transparency on an RGB or palette image) is seen. */
function pngChunkTypes(buf: Buffer): string[] {
  const out: string[] = []
  let pos = 8
  while (pos + 8 <= buf.length) {
    const len = buf.readUInt32BE(pos)
    out.push(buf.subarray(pos + 4, pos + 8).toString('latin1'))
    pos += 12 + len
  }
  return out
}

/** Every reason the 512 px store icon is wrong: size, an alpha channel, a tRNS chunk, any pixel below 255. */
function storeIconProblems(bytes: Buffer): string[] {
  const png = readPng(bytes)
  const out: string[] = []
  if (png.width !== STORE_ICON_SIZE || png.height !== STORE_ICON_SIZE) out.push(`store icon is ${png.width}x${png.height}, wants ${STORE_ICON_SIZE}`)
  if (png.hasAlphaChannel) out.push(`store icon carries an alpha channel (color type ${png.colorType})`)
  if (pngChunkTypes(bytes).includes('tRNS')) out.push('store icon carries a tRNS transparency chunk')
  if (png.minAlpha !== 255) out.push(`store icon has a pixel with alpha ${png.minAlpha}`)
  return out
}

/** A synthetic RGBA PNG for the guard-the-guard rows. */
function png(size: number, alphaAt: (x: number, y: number) => number): Buffer {
  const crc = (buf: Buffer) => {
    let c = ~0
    for (const b of buf) { c ^= b; for (let k = 0; k < 8; k += 1) c = (c >>> 1) ^ (0xedb88320 & -(c & 1)) }
    return ~c >>> 0
  }
  const chunk = (type: string, body: Buffer) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(body.length)
    const tb = Buffer.from(type, 'latin1')
    const c = Buffer.alloc(4); c.writeUInt32BE(crc(Buffer.concat([tb, body])))
    return Buffer.concat([len, tb, body, c])
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 6
  const rows: number[] = []
  for (let y = 0; y < size; y += 1) {
    rows.push(0)
    for (let x = 0; x < size; x += 1) rows.push(45, 134, 83, alphaAt(x, y))
  }
  return Buffer.concat([
    Buffer.from('89504e470d0a1a0a', 'hex'), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(Buffer.from(rows))), chunk('IEND', Buffer.alloc(0)),
  ])
}


describe('the committed launcher set (FR-09)', () => {
  it.each(Object.keys(BUCKETS).flatMap(b => FILES.map(f => [b as Bucket, f] as const)))(
    'mipmap-%s/%s has the bucket size (and a safe-zone mark for the foreground)',
    (bucket, file) => {
      expect(bucketProblems(readRepoBytes(`${SRC}/mipmap-${bucket}/${file}`), file, bucket)).toEqual([])
    },
  )

  it('the adaptive icon names the committed foreground over the launcher green', () => {
    const xml = readRepo(`${SRC}/mipmap-anydpi-v26/ic_launcher.xml`)
    expect(xmlTags(xml, 'foreground')).toEqual([{ 'android:drawable': '@mipmap/ic_launcher_foreground' }])
    expect(xmlTags(xml, 'background')).toEqual([{ 'android:drawable': '@color/ic_launcher_background' }])
    expect(readRepo(`${SRC}/values/ic_launcher_background.xml`)).toMatch(/<color name="ic_launcher_background">#2D8653<\/color>/)
  })

  it('the green is the launch green every other platform uses', () => {
    const tauri = JSON.parse(readRepo('src-tauri/tauri.conf.json')) as { app: { windows: Array<{ backgroundColor: string }> } }
    expect(tauri.app.windows[0]!.backgroundColor).toBe('#2D8653')
  })
})

describe('the Android project carries exactly that set', () => {
  const copied = [
    ...Object.keys(BUCKETS).flatMap(b => FILES.map(f => `mipmap-${b}/${f}`)),
    'mipmap-anydpi-v26/ic_launcher.xml',
    'values/ic_launcher_background.xml',
  ]

  it.each(copied)('res/%s is byte-identical to src-tauri/icons/android', rel => {
    expect(readRepoBytes(`${RES}/${rel}`).equals(readRepoBytes(`${SRC}/${rel}`))).toBe(true)
  })

  it("the template's placeholder drawables are gone, so the adaptive icon resolves to the committed set", () => {
    expect(existsSync(resolve(REPO, `${RES}/drawable/ic_launcher_background.xml`))).toBe(false)
    expect(existsSync(resolve(REPO, `${RES}/drawable-v24/ic_launcher_foreground.xml`))).toBe(false)
  })
})

describe('the staged F-Droid listing icon (QA-09)', () => {
  it('is 512 by 512 and fully opaque: no alpha channel, no tRNS, every pixel at 255', () => {
    expect(storeIconProblems(readRepoBytes(STORE_ICON))).toEqual([])
  })

  it('is the RGB image held-copy.md describes, not a paletted or grayscale one', () => {
    expect(readPng(readRepoBytes(STORE_ICON)).colorType).toBe(2)
  })
})

// GUARD THE GUARD: synthetic PNGs in the shapes the defect returns in.
describe('the icon checks reject a short bucket and a stray mark', () => {
  it('a 49 px hdpi launcher is reported', () => {
    expect(bucketProblems(png(49, () => 255), 'ic_launcher.png', 'hdpi')).toEqual(['hdpi/ic_launcher.png is 49x49, wants 72'])
  })

  it('a foreground whose mark touches the canvas edge is reported; a centred one is not', () => {
    expect(bucketProblems(png(108, (x, y) => (x === 0 && y === 50 ? 255 : 0)), 'ic_launcher_foreground.png', 'mdpi')).toHaveLength(1)
    expect(bucketProblems(png(108, (x, y) => (x > 40 && x < 60 && y > 40 && y < 60 ? 255 : 0)), 'ic_launcher_foreground.png', 'mdpi')).toEqual([])
  })

  it('the reader sees one transparent pixel', () => {
    expect(readPng(png(8, (x, y) => (x === 3 && y === 4 ? 0 : 255))).minAlpha).toBe(0)
    expect(readPng(png(8, () => 255)).minAlpha).toBe(255)
  })

  it('the store-icon check reports an alpha channel even when every pixel is opaque, a transparent pixel, and a short side', () => {
    expect(storeIconProblems(png(512, () => 255))).toEqual(['store icon carries an alpha channel (color type 6)'])
    expect(storeIconProblems(png(512, (x, y) => (x === 3 && y === 4 ? 0 : 255)))).toEqual([
      'store icon carries an alpha channel (color type 6)',
      'store icon has a pixel with alpha 0',
    ])
    expect(storeIconProblems(png(511, () => 255))[0]).toBe('store icon is 511x511, wants 512')
  })

  it('the chunk scan sees a tRNS chunk', () => {
    const bytes = png(8, () => 255)
    const iend = bytes.length - 12
    const trns = Buffer.concat([Buffer.from([0, 0, 0, 2]), Buffer.from('tRNS', 'latin1'), Buffer.from([0, 0]), Buffer.from([0, 0, 0, 0])])
    expect(pngChunkTypes(Buffer.concat([bytes.subarray(0, iend), trns, bytes.subarray(iend)]))).toContain('tRNS')
    expect(pngChunkTypes(bytes)).toEqual(['IHDR', 'IDAT', 'IEND'])
  })
})
