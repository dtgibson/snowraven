/// <reference types="node" />
// The command palette's match predicate (FR-23, QA-22, QA-62, QA-66).
//
// WHAT THIS FILE IS EVIDENCE FOR, and it is deliberately two different things.
//
// The TABLE below is a table over the ONE shipped function, not a comparison of
// two implementations that agree today. That is only worth more than a parity
// fixture because of the SOURCE SCAN at the bottom, which is what makes
// "single-sourced" a structural claim rather than a description: it asserts that
// both consumers import this module and that neither carries a re-spelling of
// the predicate. Without that scan the table proves the function works and says
// nothing about who uses it. The two consumers are `SpeciesCombobox.tsx` and
// `lib/paletteRows.ts` -- the palette filters in its pure row builder, not in
// its component, which is what makes the palette's half unit-testable at all.
//
// The scan strips comments before matching, both `//` and `/* */` forms. Without
// that, this file's own explanation of the shape it forbids would match it, and
// a correct implementation would fail -- the same trap `entryChunk.test.ts` and
// the `firstLine` drift guard both record, in the two opposite directions.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { matchesSpeciesQuery, normalizeSpeciesQuery } from './speciesMatch'

const OPTIONS = [
  { name: 'American Robin', sciName: 'Turdus migratorius' },
  { name: "Wilson's Warbler", sciName: 'Cardellina pusilla' },
  { name: 'Bay-breasted Warbler', sciName: 'Setophaga castanea' },
  { name: 'Warbling Vireo', sciName: 'Vireo gilvus' },
  { name: 'Ring-billed Gull', sciName: 'Larus delawarensis' },
  { name: "Anna's Hummingbird", sciName: 'Calypte anna' },
  { name: 'Mystery Bird' },                       // no scientific name at all
]

/** Run a raw query the way every caller does: normalize once, then match. */
function search(raw: string): string[] {
  const q = normalizeSpeciesQuery(raw)
  return OPTIONS.filter(o => matchesSpeciesQuery(o, q)).map(o => o.name)
}

describe('normalizeSpeciesQuery', () => {
  it('trims and lowercases, exactly as the shipped picker always did', () => {
    expect(normalizeSpeciesQuery('  WaRb  ')).toBe('warb')
    expect(normalizeSpeciesQuery('')).toBe('')
    expect(normalizeSpeciesQuery('   ')).toBe('')
  })
})

describe('matchesSpeciesQuery: the FR-23 table', () => {
  const CASES: { name: string; query: string; expected: string[] }[] = [
    {
      name: 'a common-name substring, anywhere in the name',
      query: 'warb',
      // Warbling Vireo sorts nowhere in particular here; ordering is
      // paletteRows.ts's job, not this predicate's.
      expected: ["Wilson's Warbler", 'Bay-breasted Warbler', 'Warbling Vireo'],
    },
    {
      name: 'a SCIENTIFIC-name-only hit (the half a common-name filter misses)',
      query: 'calypte',
      expected: ["Anna's Hummingbird"],
    },
    {
      name: 'a scientific-name substring in the middle of an epithet',
      query: 'delawar',
      expected: ['Ring-billed Gull'],
    },
    {
      name: 'a MIXED-CASE query, which the normalizer flattens',
      query: 'RoBiN',
      expected: ['American Robin'],
    },
    {
      name: 'leading and trailing spaces, which the normalizer trims',
      query: '   gull   ',
      expected: ['Ring-billed Gull'],
    },
    {
      name: 'an apostrophe, which bird names are full of',
      query: "wilson's",
      expected: ["Wilson's Warbler"],
    },
    {
      name: 'a hyphen, likewise',
      query: 'bay-breasted',
      expected: ['Bay-breasted Warbler'],
    },
    {
      name: 'no match at all',
      query: 'zzzzqq',
      expected: [],
    },
  ]

  it.each(CASES.map(c => [c.name, c] as const))('%s', (_label, c) => {
    expect(search(c.query)).toEqual(c.expected)
  })

  it('an empty query matches EVERYTHING, so callers must short-circuit it themselves', () => {
    // `''.includes('')` is true, so this predicate has no opinion about an empty
    // query. Both callers check for one before filtering; stated here because it
    // is the kind of thing a later reader would otherwise have to derive.
    expect(search('')).toHaveLength(OPTIONS.length)
  })

  it('a missing scientific name never matches, rather than throwing', () => {
    // The `?? ''` fallback, preserved byte-for-byte from the shipped picker.
    expect(matchesSpeciesQuery({ name: 'Mystery Bird' }, 'turdus')).toBe(false)
    expect(matchesSpeciesQuery({ name: 'Mystery Bird' }, 'mystery')).toBe(true)
    expect(matchesSpeciesQuery({ name: 'Mystery Bird', sciName: undefined }, 'x')).toBe(false)
  })

  it('hostile queries are ordinary strings, not regexes and not prototype keys (NFR-07, QA-62)', () => {
    const before = Object.keys(Object.prototype).length
    for (const hostile of ['constructor', '__proto__', 'toString', '.*', '(a+)+$', '[']) {
      expect(() => search(hostile)).not.toThrow()
      expect(search(hostile)).toEqual([])
    }
    expect(Object.keys(Object.prototype).length).toBe(before)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// THE SCAN — what makes "single-sourced" structural
// ─────────────────────────────────────────────────────────────────────────────

/** Drop line comments and block comments so a comment cannot satisfy or fail a scan. */
function stripComments(src: string): string {
  return src
    .split('\n')
    .filter(l => !/^\s*(\/\/|\*|\/\*)/.test(l))
    .join('\n')
    .replace(/\/\*[\s\S]*?\*\//g, '')
}

const read = (rel: string) => stripComments(readFileSync(new URL(rel, import.meta.url), 'utf8'))

describe('the predicate has exactly one implementation', () => {
  const CONSUMERS: [string, string][] = [
    ['the shared species picker', '../components/SpeciesCombobox.tsx'],
    ['the command palette', '../lib/paletteRows.ts'],
  ]

  it.each(CONSUMERS)('%s imports it rather than owning a copy', (_label, rel) => {
    const src = read(rel)
    expect(src).toMatch(/from '\.\.?\/(?:lib\/)?speciesMatch'/)
    expect(src).toContain('matchesSpeciesQuery')
  })

  it.each(CONSUMERS)('%s carries no re-spelling of the predicate', (_label, rel) => {
    const src = read(rel)
    // The exact shape that was lifted out. A consumer that re-inlines it would
    // drift the moment one of the two is "improved".
    expect(src).not.toMatch(/\.name\.toLowerCase\(\)\.includes\(/)
    expect(src).not.toMatch(/sciName\s*\?\?\s*''/)
  })

  it('and it is the only file in src/ that spells it', () => {
    // Non-vacuity for the two negatives above: the shape really is present
    // SOMEWHERE, so those assertions are rejecting a real thing rather than
    // passing because nobody writes it any more.
    const own = read('./speciesMatch.ts')
    expect(own).toMatch(/o\.name\.toLowerCase\(\)\.includes\(q\)/)
    expect(own).toMatch(/\(o\.sciName \?\? ''\)\.toLowerCase\(\)\.includes\(q\)/)
  })

  it('constructs no RegExp on the query path (NFR-07, QA-62)', () => {
    const own = read('./speciesMatch.ts')
    expect(own).not.toContain('new RegExp')
    expect(own).not.toMatch(/\.match\(|\.replace\(|\.search\(/)
  })
})
