// Guard for the extraction in improve: species-name-normalizer-consolidation.
//
// `parseEbird`, `parseLifeList`, `parseMLExport` and `parseBreedingCodes` each carried a
// private function NAMED `normalizeSpeciesName` that was not it: it cuts at the first "("
// regardless of closure or position. Four copies became one export named for its actual
// rule, `truncateAtFirstParen`. This file proves two separate things, and the second is
// the one that is easy to get wrong:
//
//   1. RELOCATION IS EXACT. CLAUDE.md: when a refactor relocates code, prove it
//      byte-identical against the pre-change revision rather than reasoning about it.
//      All four pre-change copies are reproduced verbatim below as differential oracles.
//      Three were byte-identical; `parseBreedingCodes` used a ternary, so it is carried
//      separately rather than assumed equivalent.
//
//   2. THE TWO FUNCTIONS STAY APART. Converging `truncateAtFirstParen` onto
//      `normalizeSpeciesName` was measured and rejected. Real names cannot show the
//      difference - every eBird name is well formed (at most one "(", always closed,
//      always trailing) - so a snapshot-only sweep passes on the wrong implementation.
//      CLAUDE.md's rule for exactly this case: enumerate a probe alphabet to length 4 and
//      assert BOTH numbers, that real data scores zero and that the probes do not.
/// <reference types="node" />
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { normalizeSpeciesName, truncateAtFirstParen } from './speciesUtils'
import {
  divergences,
  enumerateProbes,
  probeCount,
  SPECIES_NAME_ALPHABET,
  SPECIES_NAME_PROBE_LEN,
} from './regexSweepGuards'

// ---------------------------------------------------------------------------
// the four pre-change copies, verbatim
// ---------------------------------------------------------------------------

// parseEbird.ts, parseLifeList.ts and parseMLExport.ts carried this exact text.
const copyIfForm = (name: string): string => {
  const parenIdx = name.indexOf('(')
  if (parenIdx === -1) return name
  return name.slice(0, parenIdx).trim()
}

// parseBreedingCodes.ts carried the same rule written as a ternary. Kept separate so the
// equivalence is asserted rather than assumed.
const copyTernaryForm = (name: string): string => {
  const parenIdx = name.indexOf('(')
  return parenIdx === -1 ? name : name.slice(0, parenIdx).trim()
}

const PRE_CHANGE_COPIES: ReadonlyArray<readonly [string, (s: string) => string]> = [
  ['parseEbird', copyIfForm],
  ['parseLifeList', copyIfForm],
  ['parseMLExport', copyIfForm],
  ['parseBreedingCodes', copyTernaryForm],
]

// ---------------------------------------------------------------------------
// probe sets
// ---------------------------------------------------------------------------

const probes = enumerateProbes(SPECIES_NAME_ALPHABET, SPECIES_NAME_PROBE_LEN)

// Named probes, kept readable so the semantics stay legible without decoding the sweep.
// Exotic whitespace is written as `\uXXXX` escapes: literal characters were silently
// flattened to ASCII spaces in transit three times during improve:
// superlinear-regex-sweep, which would delete the only interesting members.
const NAMED_PROBES: readonly string[] = [
  '',
  '   ',
  'Mallard',
  'Mallard (Domestic type)',
  'Mallard (',
  'Mallard )',
  'Mallard ()',
  'Mallard (hybrid) extra',
  'Mallard (a) (b)',
  'Mallard (a (b)',
  'Mallard ((a)',
  '(Mallard)',
  '()',
  ')(',
  '(a)b)',
  "Yellow-rumped Warbler (Myrtle x Audubon's)",
  'Mallard x American Black Duck (hybrid)',
  ' Mallard (Domestic type) ',
  '\u00a0Mallard (x)\u00a0',
  'Mallard\u3000(x)\u2028',
  'Mallard (x)\ufeff',
  '('.repeat(64),
  '('.repeat(64) + ')',
]

// Read the shipped snapshot directly rather than importing it, both to be explicit that
// this is the real file (other suites mock that module) and to keep the whole universe of
// strings in view, keys included. Same posture as `normalizeSpeciesNameParity.test.ts`.
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

// ---------------------------------------------------------------------------

describe('the shared probe alphabet survived being written down', () => {
  // The alphabet IS the discriminating power of this suite and of
  // `normalizeSpeciesNameParity.test.ts`. Its exotic members have been flattened to
  // ASCII spaces in transit three separate times, and a flattened alphabet weakens both
  // suites while every other assertion in them stays green. Pin the code points.
  it('carries the exact code points, not ASCII spaces', () => {
    expect([...SPECIES_NAME_ALPHABET].map((c) => c.codePointAt(0))).toEqual([
      0x28, // (
      0x29, // )
      0x61, // a
      0x20, // space
      0x09, // tab
      0x0a, // newline
      0xa0, // NO-BREAK SPACE
      0x2028, // LINE SEPARATOR
      0xfeff, // ZERO WIDTH NO-BREAK SPACE
      0x3000, // IDEOGRAPHIC SPACE
    ])
    // All ten distinct, so a flattened member cannot hide as a duplicate.
    expect(new Set(SPECIES_NAME_ALPHABET).size).toBe(10)
  })

  it('enumerates the expected universe', () => {
    expect(probes.length).toBe(probeCount(SPECIES_NAME_ALPHABET.length, SPECIES_NAME_PROBE_LEN))
    expect(probes.length).toBe(11111)
    expect(snapshotStrings.length).toBe(58104)
  })

  // BEHAVIOURAL BACKSTOPS. The code-point assertion above inspects the constant, and for a
  // while it was the ONLY thing standing between this bundle and a flattened alphabet -
  // so deleting that one test would have silently permitted exactly the corruption that
  // has now occurred four times across builds 1 and 2. Flattening changes no divergence
  // count in any other test, so nothing else here noticed.
  //
  // These two notice, through observed behaviour rather than by reading the constant, so
  // the property survives the loss of any single test.

  it('generates 11,111 DISTINCT probes, which a flattened alphabet cannot', () => {
    // Flattening an exotic member to an ASCII space makes it a duplicate of the space
    // already in the alphabet, and duplicate symbols generate duplicate strings. The count
    // stays 11,111 either way; the DISTINCT count collapses to 1,555. This catches any
    // flattening, including a partial one that leaves the other exotic members intact.
    expect(new Set(probes).size).toBe(11111)
  })

  it('still rejects a whitespace implementation that only knows ASCII', () => {
    // The probe set exists to discriminate wrong implementations, and the exotic members
    // are what give it that power. A hand-rolled trim that tests `c === ' '` and friends
    // is the specific wrong implementation CLAUDE.md's `charClasses.ts` note warns about
    // (`\s` is sixteen code points wide, and a hand-written check silently is not).
    //
    // With the real alphabet this scores 8,736 divergences. With a flattened one it scores
    // exactly ZERO, because every character the two implementations disagree about has
    // been replaced by a plain space. That collapse is the backstop.
    const isAsciiWs = (c: string): boolean => c === ' ' || c === '\t' || c === '\n' || c === '\r'
    const asciiOnlyTrim = (name: string): string => {
      const trim = (v: string): string => {
        let a = 0
        let b = v.length
        while (a < b && isAsciiWs(v[a])) a++
        while (b > a && isAsciiWs(v[b - 1])) b--
        return v.slice(a, b)
      }
      const trimmed = trim(name)
      if (!trimmed.endsWith(')')) return trimmed
      const closeIdx = trimmed.length - 1
      const prevClose = trimmed.lastIndexOf(')', closeIdx - 1)
      const openIdx = trimmed.indexOf('(', prevClose + 1)
      if (openIdx === -1) return trimmed
      return trim(trimmed.slice(0, openIdx))
    }
    expect(divergences(probes, normalizeSpeciesName, asciiOnlyTrim).count).toBeGreaterThan(1000)
  })
})

describe('truncateAtFirstParen is exactly the four copies it replaced', () => {
  // The relocation proof. Every one of these must be zero, on every corpus: the
  // extraction is a pure de-duplication and is allowed to move nothing at all.
  for (const [parser, copy] of PRE_CHANGE_COPIES) {
    it(`agrees with the copy removed from ${parser}, on every corpus`, () => {
      expect(divergences(snapshotStrings, copy, truncateAtFirstParen)).toEqual({
        count: 0,
        sample: [],
      })
      expect(divergences(probes, copy, truncateAtFirstParen)).toEqual({ count: 0, sample: [] })
      expect(divergences([...NAMED_PROBES], copy, truncateAtFirstParen)).toEqual({
        count: 0,
        sample: [],
      })
    })
  }

  it('confirms the if-form and ternary-form copies were themselves equivalent', () => {
    // The one thing the four-way sweep above would hide if it were wrong: three parsers
    // spelled this with an early return and the fourth with a ternary.
    expect(divergences(probes, copyIfForm, copyTernaryForm)).toEqual({ count: 0, sample: [] })
  })

  it('leaves a name with no paren completely untouched, whitespace included', () => {
    // The no-paren branch returns the input unchanged; only the cut branch trims. That
    // asymmetry is real, four parsers depended on it, and it is exactly what a tidy-up
    // that "obviously" adds a trim would break.
    expect(truncateAtFirstParen(' Mallard ')).toBe(' Mallard ')
    expect(truncateAtFirstParen('Mallard')).toBe('Mallard')
    expect(truncateAtFirstParen('  ')).toBe('  ')
    expect(truncateAtFirstParen('Mallard (Domestic type) ')).toBe('Mallard')
  })

  it('states its own rule: cut at the first paren, closed or not, anywhere', () => {
    expect(truncateAtFirstParen('Mallard (')).toBe('Mallard')
    expect(truncateAtFirstParen('Mallard (Domestic type)')).toBe('Mallard')
    expect(truncateAtFirstParen('Mallard (a) (b)')).toBe('Mallard')
    expect(truncateAtFirstParen('Eastern (rare) Warbler')).toBe('Eastern')
    expect(truncateAtFirstParen('(Mallard)')).toBe('')
  })
})

describe('truncateAtFirstParen and normalizeSpeciesName stay apart', () => {
  // CLAUDE.md: where real data cannot discriminate a correct from an incorrect
  // implementation, assert BOTH numbers, so the suite states in its own body why it is
  // shaped this way.

  it('scores ZERO divergences on real data, which is why a snapshot sweep is not enough', () => {
    expect(divergences(snapshotStrings, normalizeSpeciesName, truncateAtFirstParen)).toEqual({
      count: 0,
      sample: [],
    })
  })

  it('scores 10,300 of 11,111 on the enumerated probes, which is why they exist', () => {
    const found = divergences(probes, normalizeSpeciesName, truncateAtFirstParen)
    expect(found.count).toBe(10300)
    // Stated as a share too, because that is the figure the change brief and the source
    // comment both quote.
    expect(Math.round((found.count / probes.length) * 1000) / 10).toBe(92.7)
  })

  it('diverges in the direction that settles it: this rule cuts MORE', () => {
    // The harm from converging is not symmetric, and the asymmetry is what makes
    // converging a data bug rather than a wash. Wherever a name contains a "(",
    // `truncateAtFirstParen` cuts at least as much: its result is always a PREFIX of what
    // `normalizeSpeciesName` returns. So pointing the parsers at the shared normalizer
    // would make malformed names LESS normalized, splitting one corrupted cell into a
    // second life-list row on four hot paths.
    const withParen = probes.filter((p) => p.includes('('))
    expect(withParen.length).toBe(3730)
    expect(withParen.filter((p) => !normalizeSpeciesName(p).startsWith(truncateAtFirstParen(p))))
      .toEqual([])
    expect(
      withParen.filter((p) => truncateAtFirstParen(p).length > normalizeSpeciesName(p).length),
    ).toEqual([])
    // And it is a strictly shorter result on most of them, so "prefix" is not vacuous.
    expect(
      withParen.filter((p) => truncateAtFirstParen(p).length < normalizeSpeciesName(p).length)
        .length,
    ).toBe(3286)
  })

  it('differs on a paren-free name only by trimming, and that IS reachable', () => {
    // The other 7,381 probes carry no "(", and there the divergence is purely the
    // untrimmed no-paren branch: 7,014 of them differ, every one of them by whitespace
    // alone. Worth stating exactly, because it is the half of the 10,300 that is NOT the
    // cutting rule, and reading the headline number as "10,300 names would be cut
    // differently" overstates it.
    const noParen = probes.filter((p) => !p.includes('('))
    expect(noParen.length).toBe(7381)
    expect(noParen.filter((p) => truncateAtFirstParen(p).trim() !== normalizeSpeciesName(p)))
      .toEqual([])
    expect(noParen.filter((p) => truncateAtFirstParen(p) !== normalizeSpeciesName(p)).length)
      .toBe(7014)
    // An earlier version of this comment claimed the branch was unreachable because all
    // four parsers trim the cell first. That is too strong, and true of only ONE of them.
    // `parseBreedingCodes` trims and stops, so the branch is genuinely unreachable there.
    // The other three trim and THEN strip surrounding quotes -
    // `.trim().replace(/^"|"$/g, '')`, inline in `parseEbird` and via `col()` in
    // `parseLifeList` and `parseMLExport` - and stripping a quote can expose whitespace
    // that the earlier trim had no way to see, so a cell written `"""  Mallard  """`
    // arrives here untrimmed.
    //
    // This STRENGTHENS the case against converging rather than weakening it: the
    // untrimmed branch is reachable from three of the four parsers, so pointing them at
    // `normalizeSpeciesName` would change the stored name on exactly those cells rather
    // than only on unreachable ones. The conclusion is unchanged; only the reach of the
    // claim was wrong.
    expect(truncateAtFirstParen('  Mallard  ')).toBe('  Mallard  ')
    expect(normalizeSpeciesName('  Mallard  ')).toBe('Mallard')
  })

  it('states the two divergences the change brief names', () => {
    expect(truncateAtFirstParen('Mallard (')).toBe('Mallard')
    expect(normalizeSpeciesName('Mallard (')).toBe('Mallard (')
    expect(truncateAtFirstParen('Mallard (hybrid) extra')).toBe('Mallard')
    expect(normalizeSpeciesName('Mallard (hybrid) extra')).toBe('Mallard (hybrid) extra')
  })
})
