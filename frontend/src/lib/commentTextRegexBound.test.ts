// Guard for the commentText.ts site in improve: superlinear-regex-sweep.
//
//   trailingPunctuation  replaces /[.,;:!?]+$/ inside linkify
//                        (2,781 ms at 40k through commentSegments, 4.00x per
//                        doubling)
//
// The sweep's PRIORITY, and the only one of the six whose input an unrelated
// party supplies: ChecklistComparer renders `<CommentText raw>` over comments
// that came back from the eBird API, i.e. text written by whoever shared the
// checklist. Every other site needs the user's own file or paste.
//
// Four tests: structural, timing, parity, non-vacuity. See `regexSweepGuards.ts`
// for why non-vacuity stands where a bound guard's headroom test would.
/// <reference types="node" />
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { commentSegments, linkify, decodeEntities } from './commentText'
import type { CommentSegment } from './commentText'
import { formatWeather, ATTRIBUTION } from './weatherFormatter'
import type { HourlyResponse } from './weatherFormatter'
import { formatTide } from './tideFormatter'
import type { TideReading } from './tide'
import type { TideStation } from './tideStations'
import {
  CEILING_MS, HOSTILE_LEN, divergences, enumerateProbes, fastest, functionBody,
  probeCount, unboundedQuantifiers,
} from './regexSweepGuards'

const source = readFileSync(new URL('./commentText.ts', import.meta.url), 'utf8')

// ── the oracle: the whole pre-change linkify, verbatim ───────────────────────
// The changed helper is module-private, so the oracle is the exported entry
// point rather than the helper - which is the stronger comparison anyway.

const URL_RE_ORACLE = /(https?:\/\/[^\s<>"')\]]+)/g

const shippedLinkify = (s: string): CommentSegment[] => {
  const out: CommentSegment[] = []
  if (!s) return out
  let last = 0
  let m: RegExpExecArray | null
  URL_RE_ORACLE.lastIndex = 0
  while ((m = URL_RE_ORACLE.exec(s)) !== null) {
    if (m.index > last) out.push({ text: s.slice(last, m.index) })
    let url = m[1]
    const trail = /[.,;:!?]+$/.exec(url)
    let suffix = ''
    if (trail) {
      suffix = trail[0]
      url = url.slice(0, url.length - suffix.length)
    }
    out.push({ text: url, href: url })
    if (suffix) out.push({ text: suffix })
    last = m.index + m[1].length
  }
  if (last < s.length) out.push({ text: s.slice(last) })
  return out
}

const shippedCommentSegments = (raw: string): CommentSegment[] => shippedLinkify(decodeEntities(raw))

// ── the named wrong implementation (non-vacuity) ─────────────────────────────

/**
 * The version that strips only ONE trailing punctuation character. `+` reads
 * like emphasis rather than load-bearing repetition, so peeling a single
 * character is the natural simplification - and it is wrong the moment a
 * sentence ends "...see https://example.com/x?!" or a link is followed by an
 * ellipsis.
 */
const linkifyStrippingOnePunct = (s: string): CommentSegment[] => {
  const out: CommentSegment[] = []
  if (!s) return out
  let last = 0
  let m: RegExpExecArray | null
  const re = new RegExp(URL_RE_ORACLE.source, 'g')
  while ((m = re.exec(s)) !== null) {
    if (m.index > last) out.push({ text: s.slice(last, m.index) })
    let url = m[1]
    let suffix = ''
    if (url.length > 0 && '.,;:!?'.includes(url[url.length - 1])) {
      suffix = url[url.length - 1]
      url = url.slice(0, url.length - 1)
    }
    out.push({ text: url, href: url })
    if (suffix) out.push({ text: suffix })
    last = m.index + m[1].length
  }
  if (last < s.length) out.push({ text: s.slice(last) })
  return out
}

// ── the real corpus ──────────────────────────────────────────────────────────

const hour: HourlyResponse = {
  data: [{
    dt: 1716570000, temp: 64, humidity: 72, dew_point: 55, wind_speed: 6, wind_deg: 250,
    clouds: 20, weather: [{ id: 801, description: 'few clouds' }],
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

/**
 * Comments that actually carry URLs, built from the real formatter attribution
 * (which is where a URL genuinely appears in this app's own output) plus the
 * sentence shapes a birder writes around a pasted link.
 *
 * Worth recording why this is constructed rather than read: a sweep of the demo
 * export's 3,053 non-empty comment fields found ZERO urls, so the only real
 * corpus available to this site would have exercised the changed branch not
 * once. The formatter attribution is real shipped output, and the sentence
 * shapes are the punctuation cases the branch exists for.
 */
const REAL_CORPUS: string[] = (() => {
  const withUrls = [
    ATTRIBUTION,
    formatWeather([hour], 'America/Los_Angeles', 33.7),
    formatTide(reading),
  ]
  const out: string[] = [...withUrls]
  const link = 'https://ebird.org/checklist/S12345678'
  for (const tail of ['', '.', '..', '...', ',', ';', ':', '!', '?', '?!', '!!!', ').', '/', '/.']) {
    out.push(`See ${link}${tail}`)
    out.push(`See ${link}${tail} and then some more text.`)
    out.push(`${link}${tail}`)
  }
  for (const b of withUrls) {
    out.push(`Nice morning. ${b}`)
    out.push(`${b} Then we walked back.`)
    // Entity-encoded, as the eBird API returns comments.
    out.push(b.replace(/&/g, '&amp;').replace(/:/g, '&#58;'))
  }
  return out
})()

// ── parity ───────────────────────────────────────────────────────────────────

describe('linkify is byte-identical to the pattern it replaced', () => {
  // Alphabet: every character of the punctuation class the pattern strips, an
  // ordinary character, and the "/" that a URL path ends on. Probes are fed
  // through the real entry point, so each is prefixed to make URL_RE match.
  const ALPHABET = ['.', ',', ';', ':', '!', '?', 'a', '/']
  const MAX_LEN = 5
  const asUrl = (tail: string): string => `https://e.com/${tail}`

  it('agrees on every exhaustively enumerated probe', () => {
    const probes = enumerateProbes(ALPHABET, MAX_LEN).map(asUrl)
    expect(probes.length).toBe(probeCount(ALPHABET.length, MAX_LEN))
    expect(probes.length).toBe(37449)
    expect(divergences(probes, shippedLinkify, linkify)).toEqual({ count: 0, sample: [] })
  })

  it('agrees on the same probes embedded in a sentence', () => {
    // A URL at the very end of the input and a URL mid-sentence are different
    // paths through linkify's slicing, so both are swept.
    const probes = enumerateProbes(ALPHABET, 4).map((t) => `see ${asUrl(t)} ok`)
    expect(divergences(probes, shippedLinkify, linkify)).toEqual({ count: 0, sample: [] })
  })

  it('agrees on every real formatter-built comment carrying a URL', () => {
    expect(REAL_CORPUS.length).toBeGreaterThan(40)
    // Not vacuous: the corpus must actually produce links.
    expect(REAL_CORPUS.filter((c) => commentSegments(c).some((s) => s.href)).length)
      .toBeGreaterThan(40)
    expect(divergences(REAL_CORPUS, shippedCommentSegments, commentSegments)).toEqual({ count: 0, sample: [] })
  })

  it('agrees on the named malformed probes', () => {
    const named = [
      '', 'no url here', 'http://', 'https://', 'https://e.com', 'https://e.com.',
      'https://e.com...', 'https://e.com!?', 'https://e.com/a,b', 'https://e.com/a,',
      'x https://a.com. y https://b.com! z', '(https://e.com)', '[https://e.com]',
      'https://e.com/' + '.'.repeat(40), 'https://e.com/' + '.'.repeat(40) + 'x',
      '.'.repeat(40), 'https://e.com/?a=1&b=2.', 'HTTPS://E.COM.',
    ]
    expect(divergences(named, shippedCommentSegments, commentSegments)).toEqual({ count: 0, sample: [] })
  })

  // NON-VACUITY.
  it('rejects the strip-one-character variant, which the real corpus barely reaches', () => {
    const probes = enumerateProbes(ALPHABET, MAX_LEN).map(asUrl)
    expect(divergences(probes, shippedLinkify, linkifyStrippingOnePunct).count).toBeGreaterThan(1000)

    // The formatter attribution ends its URL on a non-punctuation character, so
    // the three real blocks alone cannot tell the two apart at all.
    const attributionOnly = [ATTRIBUTION, formatWeather([hour], 'America/Los_Angeles', 33.7), formatTide(reading)]
    expect(divergences(attributionOnly, shippedCommentSegments, (s) => linkifyStrippingOnePunct(decodeEntities(s))).count)
      .toBe(0)

    // The divergence, stated readably: an ellipsis after a link belongs to the
    // sentence, not the link.
    expect(linkify('https://e.com/x...').map((s) => s.text)).toEqual(['https://e.com/x', '...'])
    expect(linkifyStrippingOnePunct('https://e.com/x...').map((s) => s.text)).toEqual(['https://e.com/x..', '.'])
  })

  it('still keeps sentence punctuation out of the href', () => {
    // The observable contract: the link must not 404 because it swallowed a
    // full stop.
    const segs = commentSegments('Great list: https://ebird.org/checklist/S1.')
    expect(segs.find((s) => s.href)?.href).toBe('https://ebird.org/checklist/S1')
    expect(segs[segs.length - 1].text).toBe('.')
  })
})

describe('trailingPunctuation is linear by construction', () => {
  it('has no unbounded quantifier in the rewritten body', () => {
    expect(unboundedQuantifiers(functionBody(source, 'function trailingPunctuation'))).toEqual([])
  })

  it('extracts a real body and flags exactly the unbounded patterns in it', () => {
    const body = functionBody(source, 'function trailingPunctuation')
    expect(body).toContain('TRAILING_PUNCT')
    expect(body.length).toBeGreaterThan(60)

    // RED on the exact form a revert would take.
    const reverted = 'function f() {\n  const trail = /[.,;:!?]+$/.exec(url)\n}'
    expect(unboundedQuantifiers(functionBody(reverted, 'function f'))).toHaveLength(1)
    // RED on a length guard bolted onto the same pattern.
    const capped = 'function f() {\n  return /[.,;:!?]+$/.exec(url.slice(-500))\n}'
    expect(unboundedQuantifiers(functionBody(capped, 'function f'))).toHaveLength(1)
    // GREEN on a quantifier-free per-character test.
    const perChar = 'function f() {\n  while (k > 0 && /[.,]/.test(url[k - 1])) k--\n}'
    expect(unboundedQuantifiers(functionBody(perChar, 'function f'))).toEqual([])
  })

  it('deliberately leaves URL_RE alone', () => {
    // Unbounded, and the LAST thing in its pattern, so there is no failure to
    // backtrack into. Measured flat (0.1 ms on a 40,000 character URL).
    expect(unboundedQuantifiers(functionBody(source, 'export function linkify'))).toEqual([])
    expect(source).toContain("const URL_RE = /(https?:\\/\\/[^\\s<>\"')\\]]+)/g")
  })
})

describe('commentSegments is linear in practice', () => {
  it('stays under the ceiling on a long punctuation run (pattern: 2,781 ms)', () => {
    const elapsed = fastest(
      (salt) => 'a'.repeat(salt) + 'https://e.com/' + '.'.repeat(HOSTILE_LEN) + 'x',
      (s) => void commentSegments(s),
    )
    expect(elapsed).toBeLessThan(CEILING_MS)
  })

  it('stays fast when the run does reach the end (never a linearity guard)', () => {
    // Stated plainly rather than left to look like a second linearity guard:
    // this shape was ALWAYS linear, even under the pattern this replaced, so it
    // CANNOT reject a revert - `[.,;:!?]+$` succeeds at the first character of
    // the run and never backtracks, measured 0.0 ms at 40,000 characters on the
    // old pattern. It is kept as coverage of the scan's SUCCESS path. The test
    // that actually rejects the defect is the one above, whose run stops short
    // of the end.
    const elapsed = fastest(
      (salt) => 'a'.repeat(salt) + 'https://e.com/' + '.'.repeat(HOSTILE_LEN),
      (s) => void commentSegments(s),
    )
    expect(elapsed).toBeLessThan(CEILING_MS)
    // ... and it still strips the whole run, which is what makes it worth keeping.
    const segs = commentSegments('https://e.com/' + '.'.repeat(HOSTILE_LEN))
    expect(segs.find((s) => s.href)?.href).toBe('https://e.com/')
  })
})
