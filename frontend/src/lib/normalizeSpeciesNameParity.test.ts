// Differential guard for the `normalizeSpeciesName` rewrite (improve:
// species-name-regex-bound). The shipped `/\s*\([^)]*\)\s*$/` had every quantifier
// unbounded, so input that never completes the match made the engine retry from each
// start position (140 ms on 10k characters of "(", 2,243 ms on 40k, 4.00x per doubling).
// It is now a linear scan, and this file is the mechanism that says the rewrite is EXACT
// rather than merely plausible.
//
// Two halves, and both are required:
//   1. every string in the bundled taxonomy snapshot, because 23 non-test consumers turn
//      this output into user-visible life-list totals; and
//   2. an exhaustively enumerated malformed probe set, because real names CANNOT
//      discriminate. Every eBird name is well formed (at most one "(", always closed,
//      always trailing), so even the looser `indexOf('(')` variant the CSV parsers use
//      locally scores zero divergences on all 58,104 of them. A snapshot-only sweep would
//      pass on the wrong implementation. The `rejects the local parser variant` test below
//      is the guard-the-guard proving this probe set does not.
/// <reference types="node" />
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  normalizeSpeciesName,
  isNonCountableNameShape,
  truncateAtFirstParen,
} from './speciesUtils'
import { enumerateProbes, SPECIES_NAME_ALPHABET, SPECIES_NAME_PROBE_LEN } from './regexSweepGuards'

// The pre-change implementation, verbatim, as the differential oracle.
const shippedRegexNormalize = (name: string): string => name.replace(/\s*\([^)]*\)\s*$/, '').trim()

// The variant the four CSV parsers use. A DIFFERENT function (it cuts at the first "("
// regardless of closure or position), not a ready-made answer. Present only so the probe
// set can prove it rejects it.
//
// It used to be a copy written out here, because the real thing was four private
// functions inside the parsers with no export to reach. improve:
// species-name-normalizer-consolidation extracted them to one export named for its rule,
// so this guard now aims at the SHIPPED function rather than at a reproduction of it -
// which is what makes it a guard rather than a description.
const parsersLocalNormalize = truncateAtFirstParen

// ---------------------------------------------------------------------------
// probe sets
// ---------------------------------------------------------------------------

// Exhaustive enumeration over an alphabet chosen to exercise every branch: the two paren
// characters, an ordinary letter, and five whitespace characters spanning the awkward
// corners of `\s`. U+2028 matters most. It is both `\s` and a LineTerminator, yet a
// non-multiline `$` does NOT treat it as an end of input, so an implementation that
// reached for a line-aware primitive would diverge there and nowhere else.
//
// The alphabet moved to `regexSweepGuards.ts` in improve:
// species-name-normalizer-consolidation, so this suite and `truncateAtFirstParen.test.ts`
// share ONE definition. It is the entire discriminating power of both (real names score
// zero divergences against every wrong implementation), and its exotic members have been
// flattened to ASCII spaces in transit three separate times - a second copy is a second
// thing that can silently weaken. `truncateAtFirstParen.test.ts` pins its code points.
const ALPHABET = SPECIES_NAME_ALPHABET
const MAX_PROBE_LEN = SPECIES_NAME_PROBE_LEN

function exhaustiveProbes(): string[] {
  return enumerateProbes(ALPHABET, MAX_PROBE_LEN)
}

// Named probes, kept readable so the semantics stay legible without decoding the sweep.
// Each is a shape a hostile or malformed export could actually carry.
const NAMED_PROBES: string[] = [
  '',
  '   ',
  'Mallard',
  'Mallard (Domestic type)',
  'Mallard (',
  'Mallard )',
  'Mallard ()',
  'Mallard (hybrid) extra',
  'Mallard (hybrid) ',
  'Mallard (a) (b)',
  'Mallard (a (b)',
  'Mallard ((a)',
  'Mallard (a))',
  '(Mallard)',
  '()',
  ')(',
  '((',
  '))',
  '(a)b)',
  "Yellow-rumped Warbler (Myrtle x Audubon's)",
  'Mallard x American Black Duck (hybrid)',
  'Canada Goose (moffitti/maxima)',
  ' Mallard (Domestic type) ',
  'Mallard (x)\n',
  // Exotic `\s` members, written as escapes so no editor or tool can silently flatten
  // them into an ordinary space and quietly weaken the probe.
  '\u00a0Mallard (x)\u00a0',
  'Mallard\u3000(x)\u2028',
  'Mallard (x)\ufeff',
  '('.repeat(64),
  '('.repeat(64) + ')',
  ' '.repeat(32) + '('.repeat(32),
]

// ---------------------------------------------------------------------------
// the snapshot
// ---------------------------------------------------------------------------

// Read the shipped file directly rather than importing it, both to be explicit that this
// is the real snapshot (other suites mock that module) and to keep the whole universe of
// strings in view, keys included.
const snapshot = JSON.parse(
  readFileSync(new URL('../assets/ebird-taxonomy.json', import.meta.url), 'utf8'),
) as Record<string, unknown>

const snapshotStrings: string[] = (() => {
  const out = new Set<string>()
  const walk = (v: unknown): void => {
    if (typeof v === 'string') {
      out.add(v)
      return
    }
    if (v && typeof v === 'object') {
      for (const [k, vv] of Object.entries(v as Record<string, unknown>)) {
        out.add(k)
        walk(vv)
      }
    }
  }
  walk(snapshot)
  return [...out]
})()

const commonNames: string[] = [...new Set(Object.values(snapshot.byCode as Record<string, string>))]

interface Divergence {
  input: string
  expected: string
  actual: string
}

/** Every string on which `a` and `b` disagree, sampled so a failure prints usefully. */
function divergences(
  strings: string[],
  a: (s: string) => string,
  b: (s: string) => string,
): { count: number; sample: Divergence[] } {
  let count = 0
  const sample: Divergence[] = []
  for (const s of strings) {
    const expected = a(s)
    const actual = b(s)
    if (expected !== actual) {
      count++
      if (sample.length < 8) sample.push({ input: JSON.stringify(s), expected, actual })
    }
  }
  return { count, sample }
}

// ---------------------------------------------------------------------------

describe('normalizeSpeciesName is byte-identical to the regex it replaced', () => {
  it('agrees on every string in the bundled taxonomy snapshot', () => {
    // Sanity-check the universe first, so the sweep cannot pass by being empty.
    expect(snapshotStrings.length).toBeGreaterThan(50000)
    expect(divergences(snapshotStrings, shippedRegexNormalize, normalizeSpeciesName)).toEqual({
      count: 0,
      sample: [],
    })
  })

  it('agrees on every exhaustively enumerated malformed probe', () => {
    const probes = exhaustiveProbes()
    // 10 symbols, lengths 0..4 => 1 + 10 + 100 + 1000 + 10000.
    expect(probes.length).toBe(11111)
    expect(divergences(probes, shippedRegexNormalize, normalizeSpeciesName)).toEqual({
      count: 0,
      sample: [],
    })
  })

  it('agrees on the named malformed probes', () => {
    expect(divergences(NAMED_PROBES, shippedRegexNormalize, normalizeSpeciesName)).toEqual({
      count: 0,
      sample: [],
    })
  })

  // Guard-the-guard. Without this the sweeps above could be passing merely because they
  // are too weak to tell any two implementations apart. The parsers' local variant is the
  // specific wrong implementation sitting in this repo available to be copied, so it is
  // the one named here.
  it('rejects the local parser variant, which the snapshot alone cannot', () => {
    // The whole reason the probe set exists: real names do not discriminate at all.
    expect(divergences(snapshotStrings, shippedRegexNormalize, parsersLocalNormalize).count).toBe(0)

    expect(
      divergences(exhaustiveProbes(), shippedRegexNormalize, parsersLocalNormalize).count,
    ).toBeGreaterThan(1000)
    expect(divergences(NAMED_PROBES, shippedRegexNormalize, parsersLocalNormalize).count).toBeGreaterThan(0)

    // The two divergences the change brief calls out by name.
    expect(parsersLocalNormalize('Mallard (')).toBe('Mallard')
    expect(normalizeSpeciesName('Mallard (')).toBe('Mallard (')
    expect(parsersLocalNormalize('Mallard (hybrid) extra')).toBe('Mallard')
    expect(normalizeSpeciesName('Mallard (hybrid) extra')).toBe('Mallard (hybrid) extra')
  })
})

describe('normalizeSpeciesName honours each piece of the pattern it replaced', () => {
  // Readable statements of the three things the scan has to get right. The sweeps above
  // subsume these; they are here so the contract survives a reader who does not run them.
  it('honours the `$` anchor, so a parenthetical must be trailing', () => {
    expect(normalizeSpeciesName('Eastern (rare) Warbler')).toBe('Eastern (rare) Warbler')
    expect(normalizeSpeciesName('Mallard (hybrid) extra')).toBe('Mallard (hybrid) extra')
    // Only whitespace may follow, and it may be any `\s`.
    expect(normalizeSpeciesName('Mallard (x) \t\n')).toBe('Mallard')
    expect(normalizeSpeciesName('Mallard (x) 　')).toBe('Mallard')
  })

  it('requires the closing paren', () => {
    expect(normalizeSpeciesName('Mallard (')).toBe('Mallard (')
    expect(normalizeSpeciesName('Mallard (Domestic type')).toBe('Mallard (Domestic type')
  })

  it('honours `[^)]*`, so the opener is the first paren after the previous close', () => {
    // Not the first "(" in the string ...
    expect(normalizeSpeciesName('Mallard (a) (b)')).toBe('Mallard (a)')
    // ... and not the last one either, when nothing closes in between.
    expect(normalizeSpeciesName('Mallard (a (b)')).toBe('Mallard')
    expect(normalizeSpeciesName('Mallard ((a)')).toBe('Mallard')
    // A close with no opener after the previous close is not a parenthetical at all.
    expect(normalizeSpeciesName('(a)b)')).toBe('(a)b)')
  })

  it('strips the whitespace on both sides, and trims what is left', () => {
    expect(normalizeSpeciesName('  Mallard   (Domestic type)  ')).toBe('Mallard')
    expect(normalizeSpeciesName('(Mallard)')).toBe('')
    expect(normalizeSpeciesName('   ')).toBe('')
  })
})

describe('the countable-name asymmetry is unmoved', () => {
  // `isNonCountableNameShape` calls `normalizeSpeciesName` on a RAW exported name, and
  // its deliberate asymmetry decides whether 36 countable intergrades survive. A shift in
  // normalization would silently move life-list totals, so sweep rather than spot-check.
  //
  // This tests the SHAPE rule, not `isNonCountableForm`. The countability build made the
  // shape rule the FALLBACK for a name eBird does not publish, and put eBird's own
  // `reportAs` verdict in front of it. The shape rule is what still consumes
  // `normalizeSpeciesName`, so it is what this file's parity question is actually about,
  // and it is byte-identical to the predicate this block was written against.
  // `countableForms.test.ts` owns the separate question of what the full rule answers.
  const isSpuhOrSlashLocal = (n: string): boolean => n.endsWith(' sp.') || n.includes('/')
  const shippedRegexPredicate = (n: string): boolean =>
    isSpuhOrSlashLocal(n) || shippedRegexNormalize(n).includes(' x ')

  function split(normalize: (s: string) => string): {
    raw: number
    normalized: number
    intergradesKept: number
  } {
    const candidates = commonNames.filter((n) => !isSpuhOrSlashLocal(n))
    const raw = candidates.filter((n) => n.includes(' x ')).length
    const normalized = candidates.filter((n) => normalize(n).includes(' x ')).length
    return { raw, normalized, intergradesKept: raw - normalized }
  }

  it('classifies every snapshot string exactly as the regex did', () => {
    expect(commonNames.length).toBeGreaterThan(10000)
    expect(
      snapshotStrings.filter((s) => shippedRegexPredicate(s) !== isNonCountableNameShape(s)),
    ).toEqual([])
  })

  it('leaves the hybrid versus intergrade split byte-identical', () => {
    // Computed live on both sides, so this stays exact across a taxonomy regeneration.
    expect(split(normalizeSpeciesName)).toEqual(split(shippedRegexNormalize))
  })

  // Deliberately pins today's figures, which CLAUDE.md and DECISIONS.md both quote. A
  // failure here means the bundled taxonomy snapshot moved, not that this code broke:
  // re-measure, then update the recorded numbers in both places.
  it('pins the recorded 818 / 782 / 36 figures for the current snapshot', () => {
    expect(split(normalizeSpeciesName)).toEqual({ raw: 818, normalized: 782, intergradesKept: 36 })
  })

  it('keeps the named intergrades and still drops the named hybrids', () => {
    for (const kept of [
      "Yellow-rumped Warbler (Myrtle x Audubon's)",
      'Northern Flicker (Yellow-shafted x Red-shafted)',
      'Dark-eyed Junco (Oregon x Pink-sided)',
      'Green-winged Teal (Eurasian x American)',
    ]) {
      expect(isNonCountableNameShape(kept)).toBe(false)
    }
    for (const dropped of [
      'Mallard x American Black Duck (hybrid)',
      'Western x Glaucous-winged Gull (hybrid)',
      'American Herring/Vega/European Herring x Glaucous Gull (hybrid)',
    ]) {
      expect(isNonCountableNameShape(dropped)).toBe(true)
    }
  })
})

describe('normalizeSpeciesName is linear by construction', () => {
  // The parity sweeps above stay GREEN if the regex is reinstated. They guard behavior,
  // which is unchanged. These are the tests that actually reject a revert.

  const source = readFileSync(new URL('./speciesUtils.ts', import.meta.url), 'utf8')

  /** Body of a top-level function declaration, by brace matching, line comments stripped. */
  function functionBody(src: string, signatureStart: string): string {
    const at = src.indexOf(signatureStart)
    if (at === -1) throw new Error(`no such function: ${signatureStart}`)
    const open = src.indexOf('{', at)
    let depth = 0
    for (let i = open; i < src.length; i++) {
      if (src[i] === '{') depth++
      else if (src[i] === '}') {
        depth--
        if (depth === 0) {
          return src
            .slice(open + 1, i)
            .split('\n')
            .map((line) => line.replace(/\/\/.*$/, ''))
            .join('\n')
        }
      }
    }
    throw new Error(`unbalanced braces after ${signatureStart}`)
  }

  // Conservative JS regex-literal matcher: a "/", then a body of escapes, character
  // classes or ordinary characters, then a closing "/" and flags. It cannot tell a regex
  // from a division, which is fine here because neither body divides; the guard-the-guard
  // below pins the behaviour that matters instead of trusting that.
  const REGEX_LITERAL = /\/(?![/*])(?:\\.|\[(?:\\.|[^\]\\\n])*\]|[^/\\\n])+\/[dgimsuvy]*/g

  /**
   * The property CLAUDE.md's regex-hygiene rule actually names: linear BY CONSTRUCTION.
   * A pattern is disqualifying when it carries an unbounded quantifier, which is what
   * lets the engine retry from every start position. A quantifier-free single-character
   * class such as `/\s/` is not the defect and must stay allowed, so that a correct
   * alternative implementation is not rejected by this guard.
   */
  function unboundedQuantifiers(body: string): string[] {
    return (body.match(REGEX_LITERAL) ?? []).filter((literal) => {
      const withoutEscapes = literal.replace(/\\./g, '')
      return /[*+]/.test(withoutEscapes) || /\{\d*,\}/.test(withoutEscapes)
    })
  }

  // Guard-the-guard, in both directions. Without these the structural scan below could
  // pass vacuously: by extracting nothing, by being blind to the form the defect returns
  // in, or by being so broad that it also condemns correct implementations.
  it('extracts a real body and flags exactly the unbounded patterns in it', () => {
    const body = functionBody(source, 'function stripTrailingParenthetical')
    expect(body).toContain('lastIndexOf')
    expect(body.length).toBeGreaterThan(80)

    // RED on the exact form a revert would take.
    const reverted = 'function f() {\n  return name.replace(/\\s*\\([^)]*\\)\\s*$/, "").trim()\n}'
    expect(unboundedQuantifiers(functionBody(reverted, 'function f'))).toHaveLength(1)

    // RED on a length guard bolted onto the same pattern, the other shape this could
    // return in, since a cap on the input does not make the pattern linear.
    const capped = 'function f() {\n  return name.slice(0, 500).replace(/\\s*\\([^)]*\\)\\s*$/, "")\n}'
    expect(unboundedQuantifiers(functionBody(capped, 'function f'))).toHaveLength(1)

    // GREEN on correct implementations that use a regex without an unbounded quantifier:
    // the per-character `\s` test a hand-rolled scan would reach for, and a bounded
    // quantifier of the kind `namedBirds.ts` already ships.
    const perChar = 'function f() {\n  while (i > 0 && /\\s/.test(name[i - 1])) i--\n  return name\n}'
    expect(unboundedQuantifiers(functionBody(perChar, 'function f'))).toEqual([])
    const bounded = 'function f() {\n  return name.replace(/\\([^)]{0,120}\\)$/, "")\n}'
    expect(unboundedQuantifiers(functionBody(bounded, 'function f'))).toEqual([])

    // A pattern quoted in a line comment is not a false positive, which is what lets the
    // real function keep documenting the regex it replaced.
    const commented = 'function f() {\n  // was: name.replace(/\\s*\\(/, "")\n  return name\n}'
    expect(unboundedQuantifiers(functionBody(commented, 'function f'))).toEqual([])
  })

  it('builds the normalized name with no unbounded quantifier', () => {
    for (const fn of ['function stripTrailingParenthetical', 'export function normalizeSpeciesName']) {
      const found = unboundedQuantifiers(functionBody(source, fn))
      expect(found, `${fn} must stay linear by construction`).toEqual([])
    }
  })

  // The structural guard cannot see a slow non-regex implementation, so the hostile shapes
  // are measured too. Min of five complete runs (the QA-41 pattern), with a distinct string
  // per run so the memo always misses. The ceiling is 50 ms: roughly 15,000x above what the
  // scan costs and 12x to 46x below what the regex costs, a gap no shared runner closes in
  // either direction.
  const CEILING_MS = 50

  /** `salt` is an inert leading letter run. It defeats the memo without changing the
   * shape, since those start positions fail immediately under either implementation. */
  function fastest(build: (salt: number) => string): number {
    let best = Infinity
    for (let run = 0; run < 5; run++) {
      const input = build(run)
      const t0 = performance.now()
      normalizeSpeciesName(input)
      const elapsed = performance.now() - t0
      if (elapsed < best) best = elapsed
    }
    return best
  }

  it('stays under the ceiling on 40,000 unterminated openers (regex: 2,243 ms)', () => {
    expect(fastest((salt) => 'a'.repeat(salt) + '('.repeat(40000))).toBeLessThan(CEILING_MS)
  })

  it('stays under the ceiling on a leading whitespace run then openers (regex: 591 ms)', () => {
    expect(
      fastest((salt) => 'a'.repeat(salt) + ' '.repeat(10000) + '('.repeat(10000)),
    ).toBeLessThan(CEILING_MS)
  })

  it('stays under the ceiling on openers with a non-whitespace tail (regex: 2,304 ms)', () => {
    expect(fastest((salt) => 'a'.repeat(salt) + '('.repeat(40000) + 'x')).toBeLessThan(CEILING_MS)
  })

  it('stays under the ceiling on the shape that forces every pass (120,001 chars)', () => {
    expect(
      fastest(
        (salt) =>
          'a'.repeat(salt) + ' '.repeat(40000) + '('.repeat(40000) + 'x'.repeat(40000) + ')',
      ),
    ).toBeLessThan(CEILING_MS)
  })
})
