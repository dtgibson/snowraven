// Guard for the mediaStats.ts site in improve: superlinear-regex-sweep.
//
//   splitTrailingCount  replaces /^(.*?)\s*[–—-]\s*(\d+)\s*$/
//                       (2,495 ms at 40k through parseAgeSex, 4.00x per doubling)
//
// This is the one site in the sweep carrying real behavioural risk, and the
// change brief said so before a line was written: `.` does not match a line
// terminator without the `s` flag, so a value whose CLASS text contains a
// newline never matched and fell through to "no count, count = 1". A naive
// right-to-left scan matches it happily and silently recounts that row. The
// asymmetry is proven differentially below, not argued.
//
// Four tests: structural, timing, parity, non-vacuity. See `regexSweepGuards.ts`
// for why non-vacuity stands where a bound guard's headroom test would.
/// <reference types="node" />
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { parseAgeSex, splitTrailingCount, AGE_CLASSES, SEXES } from './mediaStats'
import type { AgeSexGroup, AgeSexCountSplit } from './mediaStats'
import {
  CEILING_MS, HOSTILE_LEN, divergences, enumerateProbes, fastest, functionBody,
  probeCount, unboundedQuantifiers,
} from './regexSweepGuards'

const source = readFileSync(new URL('./mediaStats.ts', import.meta.url), 'utf8')

// ── the oracles: the shipped pattern, verbatim ───────────────────────────────

const shippedSplit = (g: string): AgeSexCountSplit | null => {
  const m = g.match(/^(.*?)\s*[–—-]\s*(\d+)\s*$/)
  return m ? { classStr: m[1], count: m[2] } : null
}

/** The whole pre-change parseAgeSex, so the sweep can also run end to end on
 *  what a user actually sees rather than only on the helper. */
const shippedParseAgeSex = (raw: string): AgeSexGroup[] => {
  const s = (raw ?? '').trim()
  if (!s) return []
  const out: AgeSexGroup[] = []
  for (const part of s.split(/;\s*/)) {
    const g = part.trim()
    if (!g) continue
    const m = shippedSplit(g)
    const classStr = (m ? m.classStr : g).trim()
    const count = m ? parseInt(m.count, 10) : 1
    if (!classStr) continue
    const words = classStr.toLowerCase().split(/\s+/)
    const age = words.includes('juvenile')
      ? 'Juvenile'
      : words.includes('immature') || words.includes('subadult')
        ? 'Immature'
        : words.includes('adult') ? 'Adult' : 'Unknown'
    const sex = words.includes('female') ? 'Female' : words.includes('male') ? 'Male' : 'Unknown'
    out.push({ age, sex, count: Number.isFinite(count) && count > 0 ? count : 1 } as AgeSexGroup)
  }
  return out
}

// ── the named wrong implementation (non-vacuity) ─────────────────────────────

/**
 * The rewrite with the line-terminator check removed - i.e. the scan written by
 * inspection, which is exactly what the change brief forbade. Everything else
 * is identical, so this isolates the one property that cannot be seen by
 * reading the pattern casually.
 */
const scanWithoutLineTerminatorCheck = (g: string): AgeSexCountSplit | null => {
  let dash = -1
  for (let i = g.length - 1; i >= 0; i--) {
    if ('–—-'.includes(g[i])) { dash = i; break }
  }
  if (dash === -1) return null
  let numStart = dash + 1
  while (numStart < g.length && /\s/.test(g[numStart])) numStart++
  if (numStart >= g.length || !/\d/.test(g[numStart])) return null
  let numEnd = numStart
  while (numEnd < g.length && /\d/.test(g[numEnd])) numEnd++
  for (let i = numEnd; i < g.length; i++) if (!/\s/.test(g[i])) return null
  let cut = dash
  while (cut > 0 && /\s/.test(g[cut - 1])) cut--
  return { classStr: g.slice(0, cut), count: g.slice(numStart, numEnd) }
}

// ── the real corpus ──────────────────────────────────────────────────────────

/**
 * The Macaulay Library "Age/Sex" value space, enumerated exhaustively rather
 * than sampled: a controlled vocabulary of age and sex words, optionally with a
 * count, groups joined by "; ". These are the strings a real export contains.
 *
 * A sweep of the actual demo ML export (469 groups from 515 rows) also scored
 * zero divergences while this was being built, but that file is generated
 * tooling output and gitignored, so it cannot be a committed dependency - and
 * it is a strict subset of the space enumerated here.
 */
const REAL_CORPUS: string[] = (() => {
  const ages = ['', 'Adult', 'Immature', 'Juvenile', 'Subadult', 'Unknown']
  const sexes = ['', 'Male', 'Female', 'Unknown']
  const counts = ['', ' – 1', ' – 2', ' - 3', ' — 12', ' –4']
  const groups: string[] = []
  for (const a of ages) {
    for (const s of sexes) {
      const cls = [a, s].filter(Boolean).join(' ')
      if (!cls) continue
      for (const c of counts) groups.push(cls + c)
    }
  }
  const out = [...groups]
  for (const a of groups) for (const b of groups) out.push(`${a}; ${b}`)
  return out
})()

// ── parity ───────────────────────────────────────────────────────────────────

describe('splitTrailingCount is byte-identical to the pattern it replaced', () => {
  // Alphabet: the three dash characters the class accepts, a digit, an ordinary
  // letter, and the whitespace corners. `\n` and `\r` are what `.` cannot cross;
  // `\u2028` and `\u2029` are BOTH `\s` AND line terminators, so they are the
  // characters where "is it whitespace" and "can `(.*?)` cross it" disagree. Both
  // are carried deliberately: they are separate members of `isLineTerminatorChar`,
  // so a probe set holding only one of them cannot kill the deletion of the other,
  // and that mutant survived the whole src/lib suite until `\u2029` was added here.
  // `\u00a0` is `\s` and is NOT a line terminator, the mirror case.
  const ALPHABET = ['-', '–', '—', '1', 'a', ' ', '\n', '\r', '\u2028', '\u2029', '\u00a0']
  const MAX_LEN = 5

  it('agrees on every exhaustively enumerated probe', () => {
    const probes = enumerateProbes(ALPHABET, MAX_LEN)
    expect(probes.length).toBe(probeCount(ALPHABET.length, MAX_LEN))
    expect(probes.length).toBe(177156)
    expect(divergences(probes, shippedSplit, splitTrailingCount)).toEqual({ count: 0, sample: [] })
  })

  it('agrees on the whole Macaulay Age/Sex value space', () => {
    expect(REAL_CORPUS.length).toBeGreaterThan(10000)
    expect(divergences(REAL_CORPUS, shippedSplit, splitTrailingCount)).toEqual({ count: 0, sample: [] })
  })

  it('agrees end to end, on what parseAgeSex actually returns', () => {
    // The helper sweep above is strictly stronger, but a consumer sees groups,
    // not a split, and `.trim()` plus the word split could in principle mask a
    // difference. Sweeping both means neither assumption is load-bearing.
    expect(divergences(REAL_CORPUS, shippedParseAgeSex, parseAgeSex)).toEqual({ count: 0, sample: [] })
    expect(divergences(enumerateProbes(ALPHABET, 4), shippedParseAgeSex, parseAgeSex))
      .toEqual({ count: 0, sample: [] })
  })

  it('agrees on the named malformed probes', () => {
    const named = [
      '', 'Adult', 'Adult – 3', 'Adult - 3', 'Adult — 3', 'Adult–3', 'Adult -3', 'Adult- 3',
      '- 3', '-3', '3', 'Adult -', 'Adult - x', 'Adult - 3x', 'Adult - 3 4',
      'Adult - 3 - 4', 'a-b-3', 'a - - 3', 'Adult  -  3', 'Adult\t-\t3',
      // The asymmetry, in both directions.
      'Adult\n - 3', 'Adult\nx - 3', 'Adult - 3\n', '\n- 3', 'x\n- 3', 'x\ny- 3',
      'Adult\r\n - 3', 'Adult - 3\r\n', 'a -\n3', 'a\u2028-1', '\u2028a-1', 'a\u00a0-1',
      // U+2029 alongside U+2028: the leading form of each is what discriminates,
      // since a line terminator AFTER the class is absorbed by `\s*` and matches
      // under any implementation.
      'a\u2029-1', '\u2029a-1',
      // Degenerate and hostile.
      ' - 1 ', '-'.repeat(20) + '3', 'a' + ' '.repeat(40) + '- 3',
      'Adult – ' + '9'.repeat(40), 'Adult – 0', 'Adult – 007',
    ]
    expect(divergences(named, shippedSplit, splitTrailingCount)).toEqual({ count: 0, sample: [] })
    expect(divergences(named, shippedParseAgeSex, parseAgeSex)).toEqual({ count: 0, sample: [] })
  })

  // NON-VACUITY, and the specific risk the brief named.
  it('rejects the scan written without the line-terminator check', () => {
    // The real corpus cannot discriminate at all: no Macaulay Age/Sex value
    // contains a newline, so the wrong implementation scores zero on every one
    // of them. This is the whole reason the probe set exists.
    expect(divergences(REAL_CORPUS, shippedSplit, scanWithoutLineTerminatorCheck).count).toBe(0)

    const probes = enumerateProbes(ALPHABET, MAX_LEN)
    expect(divergences(probes, shippedSplit, scanWithoutLineTerminatorCheck).count).toBeGreaterThan(1000)

    // Stated readably so the contract survives a reader who does not run the
    // sweep. `(.*?)` cannot reach ACROSS a line terminator, so this never
    // matched and the row counted as one individual, not three.
    expect(splitTrailingCount('\na-1')).toBeNull()
    expect(scanWithoutLineTerminatorCheck('\na-1')).toEqual({ classStr: '\na', count: '1' })
    expect(parseAgeSex('Adult\nx - 3')).toEqual([{ age: 'Adult', sex: 'Unknown', count: 1 }])
  })

  it('keeps the newline cases that DID match, which is the other half', () => {
    // A newline AFTER the class was always fine: the `\s*` either side of the
    // dash are line-terminator-blind. A "fix" that rejected any newline
    // anywhere would be just as wrong, in the opposite direction.
    expect(splitTrailingCount('Adult\n - 3')).toEqual({ classStr: 'Adult', count: '3' })
    expect(splitTrailingCount('Adult - 3\n')).toEqual({ classStr: 'Adult', count: '3' })
    expect(splitTrailingCount('a -\n3')).toEqual({ classStr: 'a', count: '3' })
  })

  it('still parses the Age/Sex forms the Multimedia facets depend on', () => {
    // The observable contract: these drive the sex/age dropdowns.
    expect(parseAgeSex('Adult Female – 2')).toEqual([{ age: 'Adult', sex: 'Female', count: 2 }])
    expect(parseAgeSex('Juvenile Male – 1; Adult Female – 3')).toEqual([
      { age: 'Juvenile', sex: 'Male', count: 1 },
      { age: 'Adult', sex: 'Female', count: 3 },
    ])
    expect(parseAgeSex('Immature')).toEqual([{ age: 'Immature', sex: 'Unknown', count: 1 }])
    expect(AGE_CLASSES).toContain('Juvenile')
    expect(SEXES).toContain('Female')
  })
})

describe('splitTrailingCount is linear by construction', () => {
  it('has no unbounded quantifier in the rewritten body', () => {
    expect(unboundedQuantifiers(functionBody(source, 'export function splitTrailingCount'))).toEqual([])
  })

  it('extracts a real body and flags exactly the unbounded patterns in it', () => {
    const body = functionBody(source, 'export function splitTrailingCount')
    expect(body).toContain('isLineTerminatorChar')
    expect(body.length).toBeGreaterThan(80)

    // RED on the exact form a revert would take.
    const reverted = 'function f() {\n  return g.match(/^(.*?)\\s*[–—-]\\s*(\\d+)\\s*$/)\n}'
    expect(unboundedQuantifiers(functionBody(reverted, 'function f'))).toHaveLength(1)
    // RED on a length guard bolted onto the same pattern.
    const capped = 'function f() {\n  return g.slice(0, 500).match(/^(.*?)\\s*[–—-]\\s*(\\d+)\\s*$/)\n}'
    expect(unboundedQuantifiers(functionBody(capped, 'function f'))).toHaveLength(1)
    // GREEN on quantifier-free per-character tests.
    const perChar = 'function f() {\n  while (i > 0 && /\\s/.test(g[i - 1])) i--\n}'
    expect(unboundedQuantifiers(functionBody(perChar, 'function f'))).toEqual([])
  })

  it('deliberately leaves parseAgeSex\'s own split patterns alone', () => {
    // Both are unbounded, and both are the LAST thing in their pattern, so
    // neither has a failure to backtrack into. Measured flat (1.4 ms and 0.7 ms
    // at 40,000 characters). Scoped rather than swept up.
    expect(unboundedQuantifiers(functionBody(source, 'export function parseAgeSex')))
      .toEqual(['/;\\s*/', '/\\s+/'])
  })
})

describe('parseAgeSex is linear in practice', () => {
  it('stays under the ceiling on a long internal whitespace run (pattern: 2,495 ms)', () => {
    const elapsed = fastest(
      (salt) => 'a'.repeat(salt + 1) + ' '.repeat(HOSTILE_LEN) + 'b',
      (s) => void parseAgeSex(s),
    )
    expect(elapsed).toBeLessThan(CEILING_MS)
  })

  it('stays under the ceiling on a dash with no digits after it (pattern: 2,564 ms)', () => {
    // The tail check runs and fails, so `\s*` backtracks the whole run at every
    // offset. Verified to go RED on the reverted pattern, like the test above.
    const elapsed = fastest(
      (salt) => 'a'.repeat(salt + 1) + ' '.repeat(HOSTILE_LEN) + '- x',
      (s) => void parseAgeSex(s),
    )
    expect(elapsed).toBeLessThan(CEILING_MS)
  })

  it('stays fast when the count genuinely matches (never a linearity guard)', () => {
    // Stated plainly rather than left to look like a third linearity guard:
    // both shapes below were ALWAYS linear, even under the pattern this
    // replaced, so neither CAN reject a revert - the match succeeds at the
    // first offset that reaches the dash, measured 0.0 ms and 2 ms at 40,000
    // characters on the old pattern. Kept as coverage of the scan's SUCCESS
    // path. The tests that actually reject the defect are the two above.
    expect(fastest(
      (salt) => 'Adult'.repeat(salt + 1) + ' '.repeat(HOSTILE_LEN) + '- 3',
      (s) => void parseAgeSex(s),
    )).toBeLessThan(CEILING_MS)
    expect(fastest(
      (salt) => 'a'.repeat(salt + 1) + '-'.repeat(HOSTILE_LEN) + '3',
      (s) => void parseAgeSex(s),
    )).toBeLessThan(CEILING_MS)
    expect(parseAgeSex('Adult' + ' '.repeat(HOSTILE_LEN) + '- 3'))
      .toEqual([{ age: 'Adult', sex: 'Unknown', count: 3 }])
  })
})
