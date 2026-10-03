/// <reference types="node" />
// Pure-JS readers for the committed Android project (android-release schema
// 6.4), the sibling of test/appleManifest.ts. Test-only: nothing in the app
// imports this file. Pure JS on purpose: the frontend CI job runs on
// ubuntu-latest with no Android tooling, so shelling out to aapt2 or Gradle
// would make these guards skip exactly where they must run. Each reader fails
// CLOSED on a shape it does not understand, and each has guard-the-guard rows
// in the test that uses it.
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { inflateSync } from 'node:zlib'

export const REPO = resolve(import.meta.dirname, '../../..')
export const ANDROID = resolve(REPO, 'src-tauri/gen/android')
export const readRepo = (rel: string) => readFileSync(resolve(REPO, rel), 'utf8')
export const readRepoBytes = (rel: string) => readFileSync(resolve(REPO, rel))

// ── Kotlin / Kotlin-script comment stripper ─────────────────────────────────
// Removes // line comments and /* */ block comments (Kotlin block comments
// NEST), leaving string literals intact, so a URL such as "https://x" or a
// "//" inside a string is never mistaken for a comment, and a commented-out
// line can never satisfy or fail a pin. Line structure is preserved (a
// removed comment leaves its newlines) so offsets stay meaningful. Throws on
// an unterminated string or block comment.
export function stripKotlinComments(src: string): string {
  let out = ''
  let i = 0
  while (i < src.length) {
    const c = src[i]!
    const n = src[i + 1]
    if (c === '"' && src.startsWith('"""', i)) {
      const end = src.indexOf('"""', i + 3)
      if (end < 0) throw new Error('kotlin: unterminated raw string')
      out += src.slice(i, end + 3)
      i = end + 3
    } else if (c === '"' || c === "'") {
      let j = i + 1
      while (j < src.length && src[j] !== c) {
        if (src[j] === '\\') j += 1
        if (src[j] === '\n') throw new Error('kotlin: unterminated string literal')
        j += 1
      }
      if (j >= src.length) throw new Error('kotlin: unterminated string literal')
      out += src.slice(i, j + 1)
      i = j + 1
    } else if (c === '/' && n === '/') {
      while (i < src.length && src[i] !== '\n') i += 1
    } else if (c === '/' && n === '*') {
      let depth = 1
      i += 2
      while (i < src.length && depth > 0) {
        if (src[i] === '/' && src[i + 1] === '*') { depth += 1; i += 2 }
        else if (src[i] === '*' && src[i + 1] === '/') { depth -= 1; i += 2 }
        else { if (src[i] === '\n') out += '\n'; i += 1 }
      }
      if (depth > 0) throw new Error('kotlin: unterminated block comment')
    } else {
      out += c
      i += 1
    }
  }
  return out
}

/**
 * The body of the first `name { ... }` block (braces balanced, comments
 * already stripped by the caller). Throws when the block is absent, so a
 * renamed or deleted block is an error rather than an empty pass.
 */
export function kotlinBlock(src: string, name: string, from = 0): string {
  const re = new RegExp(`(^|[^A-Za-z0-9_.])${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\{`, 'g')
  re.lastIndex = from
  const m = re.exec(src)
  if (!m) throw new Error(`kotlin: no "${name} {" block`)
  let depth = 1
  let i = m.index + m[0].length
  const start = i
  while (i < src.length && depth > 0) {
    if (src[i] === '{') depth += 1
    else if (src[i] === '}') depth -= 1
    i += 1
  }
  if (depth > 0) throw new Error(`kotlin: unbalanced "${name}" block`)
  return src.slice(start, i - 1)
}

/** Top-level statements of a block body (nested blocks kept whole), trimmed, empty ones dropped. */
export function kotlinStatements(body: string): string[] {
  const out: string[] = []
  let depth = 0
  let cur = ''
  for (const ch of body) {
    if (ch === '{' || ch === '(') depth += 1
    if (ch === '}' || ch === ')') depth -= 1
    if (ch === '\n' && depth === 0) {
      if (cur.trim()) out.push(cur.trim().replace(/\s+/g, ' '))
      cur = ''
    } else cur += ch
  }
  if (cur.trim()) out.push(cur.trim().replace(/\s+/g, ' '))
  return out
}

// ── A tiny XML tag reader ───────────────────────────────────────────────────
// Comments are removed before scanning, so a commented-out <uses-permission>
// is never counted. Returns the attribute map of every opening tag with the
// given name. Throws on an unterminated comment or tag.
export function stripXmlComments(xml: string): string {
  const open = xml.split('<!--').length - 1
  const close = xml.split('-->').length - 1
  if (open !== close) throw new Error('xml: unbalanced comment markers')
  return xml.replace(/<!--[\s\S]*?-->/g, '')
}

export function xmlTags(xml: string, name: string): Array<Record<string, string>> {
  const src = stripXmlComments(xml)
  const out: Array<Record<string, string>> = []
  const re = new RegExp(`<${name}(?=[\\s/>])([^>]*)>`, 'g')
  let m: RegExpExecArray | null
  while ((m = re.exec(src))) {
    const attrs: Record<string, string> = {}
    const body = m[1]!.replace(/\/$/, '')
    const rest = body.replace(/([\w:.-]+)\s*=\s*"([^"]*)"/g, (_all, k: string, v: string) => {
      attrs[k] = v
      return ''
    })
    if (rest.trim() !== '') throw new Error(`xml: unparsed attribute text in <${name}>: ${rest.trim()}`)
    out.push(attrs)
  }
  return out
}

// ── A PNG reader ────────────────────────────────────────────────────────────
// IHDR dimensions and colour type, and for 8-bit RGBA or grey+alpha the
// minimum alpha and the bounding box of every pixel with alpha above zero.
// Interlaced or other bit depths fail closed.
export interface PngFacts {
  width: number
  height: number
  colorType: number
  hasAlphaChannel: boolean
  minAlpha: number
  opaqueBox: [number, number, number, number] | null
}

export function readPng(buf: Buffer): PngFacts {
  if (buf.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') throw new Error('png: bad signature')
  let pos = 8
  let width = 0, height = 0, bitDepth = 0, colorType = -1, interlace = 0
  const idat: Buffer[] = []
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos)
    const type = buf.subarray(pos + 4, pos + 8).toString('latin1')
    const body = buf.subarray(pos + 8, pos + 8 + len)
    if (type === 'IHDR') {
      width = body.readUInt32BE(0); height = body.readUInt32BE(4)
      bitDepth = body[8]!; colorType = body[9]!; interlace = body[12]!
    } else if (type === 'IDAT') idat.push(body)
    pos += 12 + len
  }
  const hasAlphaChannel = colorType === 4 || colorType === 6
  if (!hasAlphaChannel) return { width, height, colorType, hasAlphaChannel, minAlpha: 255, opaqueBox: [0, 0, width - 1, height - 1] }
  if (bitDepth !== 8 || interlace !== 0) throw new Error(`png: unsupported bit depth ${bitDepth} / interlace ${interlace}`)
  const bpp = colorType === 6 ? 4 : 2
  const raw = inflateSync(Buffer.concat(idat))
  const stride = width * bpp
  let prev = new Uint8Array(stride)
  let minAlpha = 255
  let box: [number, number, number, number] | null = null
  let i = 0
  for (let y = 0; y < height; y += 1) {
    const filter = raw[i]!; i += 1
    const line = new Uint8Array(raw.subarray(i, i + stride)); i += stride
    for (let x = 0; x < stride; x += 1) {
      const a = x >= bpp ? line[x - bpp]! : 0
      const b = prev[x]!
      const c = x >= bpp ? prev[x - bpp]! : 0
      if (filter === 1) line[x] = (line[x]! + a) & 255
      else if (filter === 2) line[x] = (line[x]! + b) & 255
      else if (filter === 3) line[x] = (line[x]! + ((a + b) >> 1)) & 255
      else if (filter === 4) {
        const p = a + b - c
        const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c)
        line[x] = (line[x]! + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c)) & 255
      } else if (filter !== 0) throw new Error(`png: bad filter ${filter}`)
    }
    for (let x = 0; x < width; x += 1) {
      const al = line[x * bpp + bpp - 1]!
      if (al < minAlpha) minAlpha = al
      if (al > 0) {
        if (!box) box = [x, y, x, y]
        else { box[0] = Math.min(box[0], x); box[1] = Math.min(box[1], y); box[2] = Math.max(box[2], x); box[3] = Math.max(box[3], y) }
      }
    }
    prev = line
  }
  return { width, height, colorType, hasAlphaChannel, minAlpha, opaqueBox: box }
}
