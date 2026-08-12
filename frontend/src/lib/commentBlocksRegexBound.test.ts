// Guards for the two commentBlocks.ts sites in improve: superlinear-regex-sweep.
//
//   lastCollapsedSegmentStart  replaces the /g scan of
//                              /(?:[ \t]{2,}|\r?\n)(?=\S)/ inside blockStart
//                              (3,499 ms at 40k through stripWeatherTideBlocks,
//                              4.00x per doubling - the worst of the six)
//   stripHtmlTags              replaces /<[^>]*>/g inside normalizeForApp
//                              (2,274 ms at 40k through hasSnowravenWeatherBlock)
//
// Both sites are in the file the 0.5.27 post-mortem swept, in code that pass did
// not reach: it fixed three specific scans and left these two. Extending that
// record rather than reversing it.
//
// Four tests per site: structural, timing, parity, non-vacuity. See
// `regexSweepGuards.ts` for why non-vacuity stands where a bound guard's
// headroom test would - neither site introduces a bound or a constant.
/// <reference types="node" />
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  lastCollapsedSegmentStart,
  stripHtmlTags,
  stripWeatherTideBlocks,
  hasSnowravenWeatherBlock,
} from './commentBlocks'
import { formatWeather, ATTRIBUTION } from './weatherFormatter'
import type { HourlyResponse } from './weatherFormatter'
import { formatTide, formatTideBody, buildCombined } from './tideFormatter'
import type { TideReading } from './tide'
import type { TideStation } from './tideStations'
import {
  CEILING_MS, HOSTILE_LEN, divergences, enumerateProbes, fastest, functionBody,
  probeCount, unboundedQuantifiers,
} from './regexSweepGuards'

const source = readFileSync(new URL('./commentBlocks.ts', import.meta.url), 'utf8')

// ── the oracles: the shipped patterns, verbatim ──────────────────────────────

/** The pre-change gap scan, kept to its final match exactly as blockStart did. */
const shippedGapScan = (before: string): number => {
  const gap = /(?:[ \t]{2,}|\r?\n)(?=\S)/g
  let segStart = 0
  let m: RegExpExecArray | null
  while ((m = gap.exec(before)) !== null) segStart = m.index + m[0].length
  return segStart
}

/** The pre-change tag strip. */
const shippedTagStrip = (s: string): string => s.replace(/<[^>]*>/g, ' ')

// ── the named wrong implementations (non-vacuity) ────────────────────────────

/**
 * The gap scan with the `(?=\S)` lookahead dropped - by far the most natural
 * simplification, since the lookahead reads like a detail of how the regex
 * finds the boundary rather than part of what a "gap" is.
 */
const gapScanWithoutLookahead = (before: string): number => {
  let segStart = 0
  for (let p = before.length - 1; p >= 1; p--) {
    const prev = before[p - 1]
    if (prev === '\n') { segStart = Math.max(segStart, p); break }
    if (p >= 2 && (prev === ' ' || prev === '\t') && (before[p - 2] === ' ' || before[p - 2] === '\t')) {
      segStart = Math.max(segStart, p)
      break
    }
  }
  return segStart
}

/**
 * The greedy tag strip, i.e. `<.*>` rather than `<[^>]*>`: first opener to LAST
 * closer. The classic mistake, and the one a reader "simplifying" the two
 * indexOf calls into a lastIndexOf would arrive at.
 */
const greedyTagStrip = (s: string): string => {
  const lt = s.indexOf('<')
  const gt = s.lastIndexOf('>')
  if (lt === -1 || gt < lt) return s
  return s.slice(0, lt) + ' ' + s.slice(gt + 1)
}

// ── real fixtures, built by calling the real formatters ──────────────────────
// The same posture as commentBlocks.test.ts: a wording drift in a formatter
// breaks these, which is the intent. This is the only REAL corpus either site
// has - the demo export contains no weather or tide blocks at all.

const hour: HourlyResponse = {
  data: [{
    dt: 1716570000, temp: 64, humidity: 72, dew_point: 55, wind_speed: 6, wind_deg: 250,
    clouds: 20, weather: [{ id: 801, description: 'few clouds' }],
    sunrise: 1716550000, sunset: 1716600000,
  }],
}
const nightHour: HourlyResponse = {
  data: [{
    dt: 1716540000, temp: 58, humidity: 80, dew_point: 52, wind_speed: 4, wind_deg: 250,
    clouds: 90, weather: [{ id: 804, description: 'overcast clouds' }],
    sunrise: 1716550000, sunset: 1716600000,
  }],
}
const STN: TideStation = { id: '9410660', name: 'Los Angeles', lat: 33.7, lng: -118.2, state: 'CA', obs: true }
const reading: TideReading = {
  levelMin: 4.1, levelMax: 5.3, source: 'predicted', trend: 'falling', turnedDuring: true,
  prevHL: { kind: 'high', v: 5.4, timeLocal: '9:12am' },
  nextHL: { kind: 'low', v: 0.7, timeLocal: '4:38pm' },
  station: STN, distanceMi: 11.2,
}
const WEATHER_BLOCK = formatWeather([hour], 'America/Los_Angeles', 33.7)
const NIGHT_BLOCK = formatWeather([nightHour], 'America/Los_Angeles', 33.7)
const TIDE_BLOCK = formatTide(reading)
const COMBINED_BLOCK = buildCombined(WEATHER_BLOCK, formatTideBody(reading))

/** Real blocks, plus the shapes real exports actually carry them in: prose
 *  before, prose after, eBird's collapsed newlines, and a bare tag form. */
const REAL_CORPUS: string[] = (() => {
  const blocks = [WEATHER_BLOCK, NIGHT_BLOCK, TIDE_BLOCK, COMBINED_BLOCK, ATTRIBUTION]
  const out: string[] = []
  for (const b of blocks) {
    out.push(b)
    out.push(`Great morning out.  ${b}`)
    out.push(`${b}  Then we walked back.`)
    out.push(`Blue sky, broken clouds  ${b}`)
    out.push(b.replace(/\n/g, '  '))            // eBird's collapsed-newline export
    out.push(`  ${b.replace(/\n/g, '  ')}   x`)
    out.push(`<a href="https://snowraven.app">${b}</a>`)
  }
  return out
})()

// ── site 1: lastCollapsedSegmentStart ────────────────────────────────────────

describe('lastCollapsedSegmentStart is byte-identical to the /g scan it replaced', () => {
  // Alphabet built from what the pattern branches on, plus the whitespace
  // characters that break naive implementations. `\u00a0` and `\v` are `\s` but
  // NOT `[ \t]`, so they end a run without being able to start one; `\u2028` is
  // both `\s` and a LineTerminator, the character the precedent found diverges
  // for a line-aware primitive and nothing else.
  const ALPHABET = [' ', '\t', '\n', '\r', 'a', '\u00a0', '\u000b', '\u2028']
  const MAX_LEN = 5

  it('agrees on every exhaustively enumerated probe', () => {
    const probes = enumerateProbes(ALPHABET, MAX_LEN)
    expect(probes.length).toBe(probeCount(ALPHABET.length, MAX_LEN))
    expect(probes.length).toBe(37449)
    expect(divergences(probes, shippedGapScan, lastCollapsedSegmentStart)).toEqual({ count: 0, sample: [] })
  })

  it('agrees on every real formatter-built block and its export shapes', () => {
    expect(REAL_CORPUS.length).toBeGreaterThan(30)
    expect(divergences(REAL_CORPUS, shippedGapScan, lastCollapsedSegmentStart)).toEqual({ count: 0, sample: [] })
  })

  it('agrees on the named malformed probes', () => {
    const named = [
      '', ' ', '  ', '   x', 'a  b', 'a b', 'a\nb', 'a\r\nb', 'a\rb', 'a\n b',
      'a  \nb', 'a\n  b', 'a  b  c', 'a  b  ', '\n\n\nx', ' '.repeat(40) + 'x',
      'x' + ' '.repeat(40), 'a\u00a0\u00a0b', 'a \u00a0b', 'a\u2028b', 'a  \u00a0',
      'Blue sky, broken clouds  Temperature:', '\t\tx', ' \tx', '\t x', 'a\t\tb',
    ]
    expect(divergences(named, shippedGapScan, lastCollapsedSegmentStart)).toEqual({ count: 0, sample: [] })
  })

  // NON-VACUITY. This is the test that says the sweeps above can tell two
  // implementations apart at all.
  it('rejects the lookahead-free variant, which the real corpus alone cannot', () => {
    // The real corpus does not discriminate: every formatter-built block is
    // well formed, so the wrong implementation scores zero on all of it. A
    // corpus-only sweep would have passed against it.
    expect(divergences(REAL_CORPUS, shippedGapScan, gapScanWithoutLookahead).count).toBe(0)

    const probes = enumerateProbes(ALPHABET, MAX_LEN)
    expect(divergences(probes, shippedGapScan, gapScanWithoutLookahead).count).toBeGreaterThan(1000)

    // The specific divergence, stated so it survives a reader who does not run
    // the sweep: a 2+ run followed by MORE whitespace is not a gap, because
    // `(?=\S)` demands visible text right after it.
    expect(lastCollapsedSegmentStart('a  \u00a0')).toBe(0)
    expect(gapScanWithoutLookahead('a  \u00a0')).toBe(3)
  })

  it('is linear by construction', () => {
    expect(unboundedQuantifiers(functionBody(source, 'export function lastCollapsedSegmentStart'))).toEqual([])
  })

  it('stays under the ceiling through stripWeatherTideBlocks (pattern: 3,499 ms)', () => {
    // Must satisfy hasWeatherBlock or the scan is never reached: a candidate
    // measured 0.0 ms until the marker gate was satisfied. Two markers plus an
    // attribution, with the hostile whitespace run before the first label so it
    // lands in blockStart's window.
    const elapsed = fastest(
      (salt) => 'x'.repeat(salt) + ' '.repeat(HOSTILE_LEN)
        + 'Temperature: 12C  Wind: calm  Weather generated by SnowRaven',
      (s) => void stripWeatherTideBlocks(s),
    )
    expect(elapsed).toBeLessThan(CEILING_MS)
  })
})

// ── site 6: stripHtmlTags ────────────────────────────────────────────────────

describe('stripHtmlTags is byte-identical to the /<[^>]*>/g it replaced', () => {
  // "<" is itself a member of `[^>]`, which is exactly why the pattern was
  // quadratic, so the alphabet is the two angle brackets plus an ordinary
  // character and a space.
  const ALPHABET = ['<', '>', 'a', ' ']
  const MAX_LEN = 7

  it('agrees on every exhaustively enumerated probe', () => {
    const probes = enumerateProbes(ALPHABET, MAX_LEN)
    expect(probes.length).toBe(probeCount(ALPHABET.length, MAX_LEN))
    expect(probes.length).toBe(21845)
    expect(divergences(probes, shippedTagStrip, stripHtmlTags)).toEqual({ count: 0, sample: [] })
  })

  it('agrees on every real formatter-built block and its export shapes', () => {
    expect(divergences(REAL_CORPUS, shippedTagStrip, stripHtmlTags)).toEqual({ count: 0, sample: [] })
  })

  it('agrees on the named malformed probes', () => {
    const named = [
      '', '<', '>', '<>', '<a>', '</a>', '<a href="x">t</a>', 'a<b>c<d',
      '<<<<', '>>>>', '<a<b>c', 'a<b<c>d>e', '<'.repeat(50), '<'.repeat(50) + '>',
      '<a href="https://snowraven.app">SnowRaven</a>',
      '&lt;a&gt;', 'no tags at all', '<\n>', '< >',
    ]
    expect(divergences(named, shippedTagStrip, stripHtmlTags)).toEqual({ count: 0, sample: [] })
  })

  it('rejects the greedy first-to-last variant, which the real corpus alone cannot', () => {
    // Real attribution links carry exactly one tag pair per string in most of
    // the corpus, so greedy and lazy agree on nearly all of it.
    const probes = enumerateProbes(ALPHABET, MAX_LEN)
    expect(divergences(probes, shippedTagStrip, greedyTagStrip).count).toBeGreaterThan(1000)

    expect(stripHtmlTags('<a>b<c>')).toBe(' b ')
    expect(greedyTagStrip('<a>b<c>')).toBe(' ')
  })

  it('is linear by construction', () => {
    expect(unboundedQuantifiers(functionBody(source, 'export function stripHtmlTags'))).toEqual([])
  })

  it('stays under the ceiling through hasSnowravenWeatherBlock (pattern: 2,274 ms)', () => {
    const elapsed = fastest(
      (salt) => 'x'.repeat(salt) + 'Temperature: 12C  Wind: calm  ' + '<'.repeat(HOSTILE_LEN),
      (s) => void hasSnowravenWeatherBlock(s),
    )
    expect(elapsed).toBeLessThan(CEILING_MS)
  })
})

// ── the structural guard's own guard, in both directions ─────────────────────

describe('the structural guard is neither vacuous nor over-broad', () => {
  it('extracts real bodies and flags exactly the unbounded patterns in them', () => {
    const gapBody = functionBody(source, 'export function lastCollapsedSegmentStart')
    expect(gapBody).toContain('isWsChar')
    expect(gapBody.length).toBeGreaterThan(80)
    const tagBody = functionBody(source, 'export function stripHtmlTags')
    expect(tagBody).toContain('indexOf')
    expect(tagBody.length).toBeGreaterThan(80)

    // RED on the exact form each revert would take.
    const revertedGap = 'function f() {\n  const gap = /(?:[ \\t]{2,}|\\r?\\n)(?=\\S)/g\n}'
    expect(unboundedQuantifiers(functionBody(revertedGap, 'function f'))).toHaveLength(1)
    const revertedTag = 'function f() {\n  return s.replace(/<[^>]*>/g, " ")\n}'
    expect(unboundedQuantifiers(functionBody(revertedTag, 'function f'))).toHaveLength(1)

    // RED on a length guard bolted onto the same pattern - a cap on the input
    // does not make the pattern linear.
    const capped = 'function f() {\n  return s.slice(0, 500).replace(/<[^>]*>/g, " ")\n}'
    expect(unboundedQuantifiers(functionBody(capped, 'function f'))).toHaveLength(1)

    // GREEN on correct implementations that use a quantifier-free regex.
    const perChar = 'function f() {\n  while (i > 0 && /\\s/.test(s[i - 1])) i--\n}'
    expect(unboundedQuantifiers(functionBody(perChar, 'function f'))).toEqual([])
    // GREEN on a bounded quantifier of the kind ATTRIB_END_RE already ships.
    const bounded = 'function f() {\n  return s.replace(/<a\\b[^>]{0,400}>/, "")\n}'
    expect(unboundedQuantifiers(functionBody(bounded, 'function f'))).toEqual([])
    // A pattern quoted in a line comment is not a false positive, which is what
    // lets each function keep documenting the regex it replaced.
    const commented = 'function f() {\n  // was: s.replace(/<[^>]*>/g, " ")\n  return s\n}'
    expect(unboundedQuantifiers(functionBody(commented, 'function f'))).toEqual([])
  })
})
