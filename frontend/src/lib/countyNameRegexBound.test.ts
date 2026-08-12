// Guard for the countyBoundaries.ts site in improve: superlinear-regex-sweep -
// the one the v0.5.84 record did NOT carry, found by re-deriving the sweep
// rather than working from the list.
//
//   stripAdminSuffix  replaces
//                     /\s+(county|parish|census area|borough|municipality|city and borough|municipio)$/
//                     (2,496 ms at 40k through normalizeCountyName, 4.00x per
//                     doubling)
//
// Amplified rather than incidental: normalizeCountyName runs once per
// observation from countyShading and countyCompleteness over the CSV `County`
// column, which the parser does not cap.
//
// Four tests: structural, timing, parity, non-vacuity. See `regexSweepGuards.ts`
// for why non-vacuity stands where a bound guard's headroom test would.
/// <reference types="node" />
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { normalizeCountyName } from './countyBoundaries'
import {
  CEILING_MS, HOSTILE_LEN, divergences, enumerateProbes, fastest, functionBody,
  probeCount, unboundedQuantifiers,
} from './regexSweepGuards'

const source = readFileSync(new URL('./countyBoundaries.ts', import.meta.url), 'utf8')

// ── the oracle: the shipped pattern, verbatim, in the shipped pipeline ───────

const shippedNormalize = (raw: string): string =>
  raw
    .normalize('NFD').replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/\bst\.?\b/g, 'saint').replace(/\bste\.?\b/g, 'sainte')
    .replace(/[.]/g, '')
    .replace(/\s+(county|parish|census area|borough|municipality|city and borough|municipio)$/, '')
    .replace(/\s+/g, ' ')
    .trim()

// ── the named wrong implementation (non-vacuity) ─────────────────────────────

/**
 * The suffix strip that stops at the FIRST suffix it finds, in declaration
 * order, instead of minimising the cut across all of them. This is the obvious
 * loop to write, and it is wrong for exactly one reason: "borough" is a suffix
 * of "city and borough" and comes earlier in the list, so an Alaska
 * city-and-borough gets cut in the wrong place.
 */
const firstMatchNormalize = (raw: string): string => {
  const cleaned = raw
    .normalize('NFD').replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/\bst\.?\b/g, 'saint').replace(/\bste\.?\b/g, 'sainte')
    .replace(/[.]/g, '')
  const suffixes = ['county', 'parish', 'census area', 'borough', 'municipality', 'city and borough', 'municipio']
  let cut = -1
  for (const suffix of suffixes) {
    const at = cleaned.length - suffix.length
    if (at <= 0 || !cleaned.endsWith(suffix)) continue
    let start = at
    while (start > 0 && /\s/.test(cleaned[start - 1])) start--
    if (start < at) { cut = start; break }
  }
  return (cut === -1 ? cleaned : cleaned.slice(0, cut)).replace(/\s+/g, ' ').trim()
}

// ── the real corpus ──────────────────────────────────────────────────────────

const ADMIN_SUFFIXES = [
  'County', 'Parish', 'Census Area', 'Borough', 'Municipality',
  'City and Borough', 'Municipio',
] as const

/**
 * Every distinct bundled TIGER county name, bare and carrying each
 * administrative suffix.
 *
 * The suffixed forms are the point. TIGER's NAME field is BARE ("Juneau"), so a
 * sweep of the bundled names alone exercises the changed branch exactly zero
 * times - and so does the demo export's County column, whose ten values are all
 * bare too. Appending the suffixes is not synthetic padding: it reconstructs the
 * other side of the join, which is precisely what eBird writes into the CSV
 * `County` column and the only reason this branch exists.
 */
const countyCorpus: string[] = (() => {
  const geo = JSON.parse(
    readFileSync(new URL('../assets/us-counties.json', import.meta.url), 'utf8'),
  ) as { features: { properties: { name: string } }[] }
  const names = [...new Set(geo.features.map((f) => f.properties.name))]
  const out: string[] = []
  for (const n of names) {
    out.push(n)
    for (const s of ADMIN_SUFFIXES) {
      out.push(`${n} ${s}`)
      out.push(`  ${n}   ${s}  `)   // eBird's collapsed whitespace
    }
  }
  return out
})()

// ── parity ───────────────────────────────────────────────────────────────────

describe('normalizeCountyName is byte-identical to the pattern it replaced', () => {
  // Alphabet of TOKENS rather than characters: an alternation of literal words
  // cannot be exercised by enumerating single characters, so the probe
  // vocabulary is the words the pattern branches on plus the separators around
  // them. `\u00a0` is `\s` but not a space, and `\n` is `\s` and a line
  // terminator - both reachable in an exported CSV cell.
  const ALPHABET = [
    'county', 'borough', 'city and borough', 'parish', 'municipio',
    ' ', '  ', 'x', '.', '\n', '\u00a0',
  ]
  const MAX_LEN = 4

  it('agrees on every exhaustively enumerated probe', () => {
    const probes = enumerateProbes(ALPHABET, MAX_LEN)
    expect(probes.length).toBe(probeCount(ALPHABET.length, MAX_LEN))
    expect(probes.length).toBe(16105)
    expect(divergences(probes, shippedNormalize, normalizeCountyName)).toEqual({ count: 0, sample: [] })
  })

  it('agrees on every bundled county name, bare and with each admin suffix', () => {
    // Sanity-check the universe first, so the sweep cannot pass by being empty.
    expect(countyCorpus.length).toBeGreaterThan(20000)
    // ... and check the branch under change is actually exercised, which the
    // bare names alone would not do.
    expect(countyCorpus.filter((s) => normalizeCountyName(s) !== s.toLowerCase().trim()).length)
      .toBeGreaterThan(20000)
    expect(divergences(countyCorpus, shippedNormalize, normalizeCountyName)).toEqual({ count: 0, sample: [] })
  })

  it('agrees on the named malformed probes', () => {
    const named = [
      '', ' ', 'County', ' County', 'county', 'x county', 'x  county', 'x\ncounty',
      'x\u00a0county', 'xcounty', 'x countycounty', 'x borough', 'x city and borough',
      'city and borough', ' city and borough', 'x city andborough', 'x county borough',
      'x county ', 'x county x', 'Doña Ana County', 'St. Louis County', 'Ste. Genevieve County',
      'St. Louis City', 'Juneau City and Borough', 'Yukon-Koyukuk Census Area',
      'Anchorage Municipality', 'Adjuntas Municipio', 'Acadia Parish',
      ' '.repeat(40) + 'county', 'x' + ' '.repeat(40) + 'county',
    ]
    expect(divergences(named, shippedNormalize, normalizeCountyName)).toEqual({ count: 0, sample: [] })
  })

  // NON-VACUITY.
  it('rejects the first-match-wins variant', () => {
    const probes = enumerateProbes(ALPHABET, MAX_LEN)
    expect(divergences(probes, shippedNormalize, firstMatchNormalize).count).toBeGreaterThan(100)

    // Unlike the commentBlocks sites, the real corpus DOES discriminate here,
    // because Alaska's "City and Borough" is a genuine administrative suffix
    // that nests another one. Recorded rather than assumed: the corpus is only
    // useful where it actually reaches the defect.
    expect(divergences(countyCorpus, shippedNormalize, firstMatchNormalize).count).toBeGreaterThan(1000)

    expect(normalizeCountyName('Juneau City and Borough')).toBe('juneau')
    expect(firstMatchNormalize('Juneau City and Borough')).toBe('juneau city and')
  })

  it('still produces the join key the county overlay depends on', () => {
    // The observable contract, stated plainly: the CSV side and the TIGER side
    // must land on the same string, or a county silently stops shading.
    expect(normalizeCountyName('Los Angeles County')).toBe(normalizeCountyName('Los Angeles'))
    expect(normalizeCountyName('Juneau City and Borough')).toBe(normalizeCountyName('Juneau'))
    expect(normalizeCountyName('Doña Ana County')).toBe('dona ana')
    expect(normalizeCountyName('St. Louis County')).toBe('saint louis')
  })
})

describe('stripAdminSuffix is linear by construction', () => {
  it('has no unbounded quantifier in the rewritten body', () => {
    expect(unboundedQuantifiers(functionBody(source, 'function stripAdminSuffix'))).toEqual([])
  })

  it('extracts a real body and flags exactly the unbounded patterns in it', () => {
    const body = functionBody(source, 'function stripAdminSuffix')
    expect(body).toContain('endsWith')
    expect(body.length).toBeGreaterThan(80)

    // RED on the exact form a revert would take.
    const reverted = 'function f() {\n  return s.replace(/\\s+(county|parish)$/, "")\n}'
    expect(unboundedQuantifiers(functionBody(reverted, 'function f'))).toHaveLength(1)
    // RED on a length guard bolted onto the same pattern.
    const capped = 'function f() {\n  return s.slice(0, 500).replace(/\\s+(county|parish)$/, "")\n}'
    expect(unboundedQuantifiers(functionBody(capped, 'function f'))).toHaveLength(1)
    // GREEN on a quantifier-free per-character test.
    const perChar = 'function f() {\n  while (i > 0 && /\\s/.test(s[i - 1])) i--\n}'
    expect(unboundedQuantifiers(functionBody(perChar, 'function f'))).toEqual([])
  })

  it('deliberately leaves normalizeCountyName\'s own /\\s+/g alone', () => {
    // Scoped honestly rather than swept up: that quantifier is unbounded, but it
    // is the LAST thing in its pattern, so there is no failure for the engine to
    // backtrack into. Measured flat (0.1 ms at 40,000 characters). The
    // entry-point body is therefore NOT structurally clean, and asserting that
    // it were would either be false or would force a rewrite of linear code.
    const body = functionBody(source, 'export function normalizeCountyName')
    expect(unboundedQuantifiers(body)).toEqual(['/\\s+/g'])
  })
})

describe('normalizeCountyName is linear in practice', () => {
  it('stays under the ceiling on a long whitespace run (pattern: 2,496 ms)', () => {
    const elapsed = fastest(
      (salt) => 'a'.repeat(salt + 1) + ' '.repeat(HOSTILE_LEN) + 'b',
      (s) => void normalizeCountyName(s),
    )
    expect(elapsed).toBeLessThan(CEILING_MS)
  })

  it('stays under the ceiling on a NEAR-MISS suffix (pattern: 2,501 ms)', () => {
    // The alternation runs and fails, which is what forces the retry from every
    // offset. Verified to go RED on the reverted pattern, like the test above.
    const elapsed = fastest(
      (salt) => 'a'.repeat(salt + 1) + ' '.repeat(HOSTILE_LEN) + 'boroughx',
      (s) => void normalizeCountyName(s),
    )
    expect(elapsed).toBeLessThan(CEILING_MS)
  })

  it('stays fast when the suffix genuinely matches (never a linearity guard)', () => {
    // Stated plainly rather than left to look like a third linearity guard:
    // this shape was ALWAYS linear, even under the pattern this replaced, so it
    // CANNOT reject a revert - the greedy `\s+` swallows the run and the
    // alternation succeeds at the first start position, measured 0.0 ms at
    // 40,000 characters on the old pattern. It is kept as coverage of the
    // scan's SUCCESS path. The tests that actually reject the defect are the
    // two above.
    const elapsed = fastest(
      (salt) => 'a'.repeat(salt + 1) + ' '.repeat(HOSTILE_LEN) + 'borough',
      (s) => void normalizeCountyName(s),
    )
    expect(elapsed).toBeLessThan(CEILING_MS)
    expect(normalizeCountyName('a' + ' '.repeat(HOSTILE_LEN) + 'borough')).toBe('a')
  })
})
