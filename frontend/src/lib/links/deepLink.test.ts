// The widget deep-link allowlist (ios-lifer-widgets FR-34, FR-35, NFR-04;
// QA-34, QA-35, QA-52). Fifteen strings are valid and nothing else is, whole.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { buildWidgetLink, LINK_MAX_LENGTH, LINK_SCHEME, parseWidgetLink, WIDGET_LINKS } from './deepLink'

const VALID = WIDGET_LINKS.map(buildWidgetLink)

describe('the fifteen valid links', () => {
  it('three lifers links with no media, twelve targets links with window then media', () => {
    expect(VALID).toHaveLength(15)
    expect(VALID.filter(u => u.includes('/lifers?'))).toEqual([
      'snowraven://map/lifers?window=day', 'snowraven://map/lifers?window=week', 'snowraven://map/lifers?window=all',
    ])
    const targets = VALID.filter(u => u.includes('/targets?'))
    expect(targets).toHaveLength(12)
    for (const u of targets) expect(u).toMatch(/^snowraven:\/\/map\/targets\?window=(day|week|all)&media=(photo|audio|video|any)$/)
    expect(new Set(VALID).size).toBe(15)
  })

  it('every one parses back to exactly the link that built it', () => {
    for (const link of WIDGET_LINKS) expect(parseWidgetLink(buildWidgetLink(link))).toEqual(link)
  })

  it('the longest valid link leaves the length bound room and no more', () => {
    const longest = Math.max(...VALID.map(u => u.length))
    expect(longest).toBe(47)
    expect(LINK_MAX_LENGTH).toBeGreaterThanOrEqual(longest)
    expect(LINK_MAX_LENGTH).toBeLessThan(2 * longest)
    expect(LINK_SCHEME).toBe('snowraven')
  })

  it('a returned link is a copy: mutating it cannot change the next parse', () => {
    const a = parseWidgetLink('snowraven://map/lifers?window=day') as { window: string }
    a.window = 'all'
    expect(parseWidgetLink('snowraven://map/lifers?window=day')).toEqual({ view: 'lifers', window: 'day' })
  })
})

describe('everything else is rejected whole', () => {
  const HOSTILE: unknown[] = [
    'snowraven://map/hotspots?window=day',                // unknown path
    'snowraven://map/lifers?window=month',               // unknown window
    'snowraven://map/lifers',                            // missing window
    'snowraven://map/targets?window=day&media=both',     // superseded media value
    'snowraven://map/targets?window=day&media=all',      // superseded media value
    'snowraven://map/targets?window=day',                // targets with no media
    'snowraven://map/lifers?window=day&media=photo',     // media on the lifers path
    'snowraven://map/lifers?window=day&x=1',             // extra parameter
    'snowraven://map/targets?media=photo&window=day',    // reordered
    'snowraven://map/lifers?window=day#top',             // fragment
    'snowraven://map/lifers/?window=day',                // trailing slash
    'SNOWRAVEN://map/lifers?window=day',                 // case
    'snowraven://map/lifers?window=Day',
    'snowraven://map/lifers?window=%64ay',               // percent-encoding
    'snowraven://map%2Flifers?window=day',               // encoded slash
    ' snowraven://map/lifers?window=day',                // whitespace
    'snowraven://map/lifers?window=day\n',
    'snowraven://map/lifers?window=day\u0000',           // control character
    'javascript:alert(1)//snowraven://map/lifers?window=day',
    'https://example.com/?u=snowraven://map/lifers?window=day',
    'snowraven://map/lifers?window=day' + 'x'.repeat(LINK_MAX_LENGTH),
    'constructor', '__proto__', 'toString', 'hasOwnProperty', '',
    null, undefined, 42, {}, ['snowraven://map/lifers?window=day'],
  ]
  it.each(HOSTILE.map(h => [JSON.stringify(h) ?? String(h), h]))('%s', (_label, raw) => {
    expect(parseWidgetLink(raw)).toBeNull()
  })

  it('the length gate runs before the lookup (read from source, comments stripped)', () => {
    const src = readFileSync(new URL('./deepLink.ts', import.meta.url), 'utf8')
      .split('\n').filter(l => !/^\s*\/\//.test(l)).join('\n')
    const body = src.slice(src.indexOf('export function parseWidgetLink'))
    const gate = body.indexOf('raw.length > LINK_MAX_LENGTH')
    const lookup = body.indexOf('Object.hasOwn(TABLE, raw)')
    expect(gate).toBeGreaterThan(-1)
    expect(lookup).toBeGreaterThan(gate)
    expect(src).toContain('const TABLE: Record<string, WidgetLink> = Object.create(null)')
    // No URL parsing, decoding or regex anywhere in the parser.
    expect(src).not.toMatch(/new URL\(|decodeURI|URLSearchParams|\.match\(|RegExp/)
  })

  it('10,000 generated hostile inputs up to 200k characters are all rejected, in bounded time', () => {
    let seed = 7
    const rand = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed }
    const base = 'snowraven://map/targets?window=week&media=photo'
    const start = performance.now()
    for (let i = 0; i < 10_000; i++) {
      const len = rand() % 200_000
      const s = (i % 2 === 0 ? base : '') + String.fromCharCode(32 + (rand() % 90)).repeat(len > 0 ? len : 1)
      expect(parseWidgetLink(s)).toBeNull()
    }
    // The gate makes each rejection O(1); 10k rejections well under a second
    // is generous headroom, and an unbounded scan over 1e9 characters is not.
    expect(performance.now() - start).toBeLessThan(5_000)
  }, 60_000)
})
