// Shared machinery for the six guard suites written by improve:
// superlinear-regex-sweep. TEST-ONLY: nothing in the app imports this module,
// so it is never bundled (same posture as `cssTopLevelRules.ts`).
//
// The six sites each replaced a superlinear pattern with a linear scan, and each
// is guarded the same way. CLAUDE.md's regex-hygiene rule specifies four tests
// for a BOUND guard - structural, timing, parity, headroom - and three of those
// carry over unchanged. The fourth does not, and the substitution is deliberate
// rather than a shortfall:
//
//   headroom / "pin the constant's safe range" applies to a fix that BOUNDS a
//   quantifier, because such a fix has a capacity above which real content
//   silently stops matching. None of these six introduces a bound or a
//   constant; each is a scan that is exact at every length, so there is no
//   capacity to have headroom over and an assertion about one could not fail.
//   The slot is taken by the test that actually carries the risk here:
//   NON-VACUITY - proof that the probe set rejects a named, plausible, wrong
//   implementation of the same scan. Without it a parity sweep that is merely
//   too weak passes against anything.
//
// That fourth test earns its place empirically rather than by argument. The
// real-data corpora available to this sweep turned out to be almost entirely
// unable to discriminate: the demo export contains no URLs at all for the
// commentText site and no weather blocks for either commentBlocks site, and the
// bundled county names carry no administrative suffix, so a 7,869-value sweep
// of a real County column exercised the changed branch exactly zero times.

export interface Divergence {
  input: string
  expected: string
  actual: string
}

/**
 * Every string on which `a` and `b` disagree, sampled so a failure prints
 * usefully. Values are compared through JSON so structured returns (the
 * age/sex split, segment lists) compare by value.
 */
export function divergences<T>(
  strings: string[],
  a: (s: string) => T,
  b: (s: string) => T,
): { count: number; sample: Divergence[] } {
  let count = 0
  const sample: Divergence[] = []
  for (const s of strings) {
    const expected = JSON.stringify(a(s))
    const actual = JSON.stringify(b(s))
    if (expected !== actual) {
      count++
      if (sample.length < 8) sample.push({ input: JSON.stringify(s), expected, actual })
    }
  }
  return { count, sample }
}

/** Every string of length 0..maxLen over `alphabet`, concatenated in order. */
export function enumerateProbes(alphabet: readonly string[], maxLen: number): string[] {
  let all: string[] = ['']
  let cur: string[] = ['']
  for (let len = 1; len <= maxLen; len++) {
    const next: string[] = []
    for (const s of cur) for (const c of alphabet) next.push(s + c)
    all = all.concat(next)
    cur = next
  }
  return all
}

/** Count of strings `enumerateProbes` returns, so a suite can pin its own size. */
export function probeCount(alphabetSize: number, maxLen: number): number {
  let n = 0
  for (let len = 0; len <= maxLen; len++) n += alphabetSize ** len
  return n
}

/** Body of a top-level function declaration, by brace matching, line comments
 *  stripped so a pattern quoted in a comment is not a false positive. */
export function functionBody(src: string, signatureStart: string): string {
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

// Conservative JS regex-literal matcher: a "/", then a body of escapes,
// character classes or ordinary characters, then a closing "/" and flags. It
// cannot tell a regex from a division, which is fine here because none of the
// guarded bodies divides; each suite's guard-the-guard pins the behaviour that
// matters instead of trusting that.
const REGEX_LITERAL = /\/(?![/*])(?:\\.|\[(?:\\.|[^\]\\\n])*\]|[^/\\\n])+\/[dgimsuvy]*/g

/**
 * The property CLAUDE.md's regex-hygiene rule names: linear BY CONSTRUCTION. A
 * pattern is disqualifying when it carries an unbounded quantifier, which is
 * what lets the engine retry from every start position. A quantifier-free
 * single-character class such as `/\s/` is not the defect and must stay
 * allowed, so a correct alternative implementation is not rejected by this
 * guard.
 */
export function unboundedQuantifiers(body: string): string[] {
  return (body.match(REGEX_LITERAL) ?? []).filter((literal) => {
    const withoutEscapes = literal.replace(/\\./g, '')
    return /[*+]/.test(withoutEscapes) || /\{\d*,\}/.test(withoutEscapes)
  })
}

/**
 * Fastest of `runs` COMPLETE executions - the QA-41 pattern, which resists
 * scheduling noise on a shared runner without weakening the threshold. `build`
 * receives a distinct salt per run so no memo anywhere on the path can turn a
 * later run into a cache hit.
 */
export function fastest(build: (salt: number) => string, run: (s: string) => void, runs = 5): number {
  let best = Infinity
  for (let i = 0; i < runs; i++) {
    const input = build(i)
    const t0 = performance.now()
    run(input)
    const elapsed = performance.now() - t0
    if (elapsed < best) best = elapsed
  }
  return best
}

/**
 * The shared timing ceiling, in ms, for every site in this sweep.
 *
 * Sized from the gap the fix opens rather than from a quiet machine. Measured
 * at 40,000 characters through the real entry points: the scans cost 0.1-0.9 ms
 * and the patterns they replaced cost 2,246-3,499 ms. 50 ms therefore sits at
 * least 55x above the scan and at least 45x below the defect - a gap no shared
 * runner closes in either direction. Do not tighten it to close that gap; the
 * discrimination lives in the gap, not in the number.
 */
export const CEILING_MS = 50

/** The size every timing fixture is built at, and the size the figures above
 *  were measured at. */
export const HOSTILE_LEN = 40000

/**
 * The probe alphabet for the species-name site, shared by every suite that
 * sweeps it: `normalizeSpeciesNameParity.test.ts` and (improve:
 * species-name-normalizer-consolidation) `truncateAtFirstParen.test.ts`.
 *
 * Shared rather than copied for one specific reason. Real eBird names cannot
 * discriminate a correct implementation from a wrong one here - every one is
 * well formed (at most one "(", always closed, always trailing), so the wrong
 * implementations score ZERO divergences across all 58,104 snapshot strings.
 * The probe set is the entire discriminating power of both suites, and a
 * second copy is a second thing that can silently weaken. The exotic members
 * are written as `\uXXXX` escapes because during improve:
 * superlinear-regex-sweep literal ones were flattened to ASCII spaces in
 * transit three separate times, which would quietly delete the only characters
 * that make this set interesting.
 *
 * The two paren characters and an ordinary letter reach every branch; the five
 * whitespace characters span the awkward corners of `\s`. U+2028 matters most:
 * it is both `\s` and a LineTerminator, yet a non-multiline `$` does NOT treat
 * it as an end of input, so an implementation reaching for a line-aware
 * primitive diverges there and nowhere else.
 */
export const SPECIES_NAME_ALPHABET = [
  '(',
  ')',
  'a',
  ' ',
  '\t',
  '\n',
  '\u00a0', // NO-BREAK SPACE
  '\u2028', // LINE SEPARATOR: `\s` and a LineTerminator, yet not an end of input
  '\ufeff', // ZERO WIDTH NO-BREAK SPACE (BOM)
  '\u3000', // IDEOGRAPHIC SPACE
] as const

/** Length every species-name sweep enumerates to. 10 symbols, lengths 0..4 =>
 *  1 + 10 + 100 + 1,000 + 10,000 = 11,111 probes. */
export const SPECIES_NAME_PROBE_LEN = 4
