// Guard for the checklistId.ts site in improve: superlinear-regex-sweep.
//
//   stripTrailingSlashes  replaces /\/+$/ inside extractChecklistId
//                         (2,246 ms at 40k, 4.00x per doubling)
//
// Reached by pasting a checklist ID or URL into the comparer, so the input is
// uncapped and lands on the main thread.
//
// Four tests: structural, timing, parity, non-vacuity. See `regexSweepGuards.ts`
// for why non-vacuity stands where a bound guard's headroom test would.
/// <reference types="node" />
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { extractChecklistId, isValidChecklistId } from './checklistId'
import {
  CEILING_MS, HOSTILE_LEN, divergences, enumerateProbes, fastest, functionBody,
  probeCount, unboundedQuantifiers,
} from './regexSweepGuards'

const source = readFileSync(new URL('./checklistId.ts', import.meta.url), 'utf8')

// ── the oracle: the whole pre-change function, verbatim ──────────────────────

const shippedExtract = (raw: string): string => {
  const s = raw.trim().replace(/\/+$/, '').split('?')[0]
  return s.includes('/') ? (s.split('/').pop() ?? s) : s
}

// ── the named wrong implementation (non-vacuity) ─────────────────────────────

/**
 * The version that drops only ONE trailing slash, i.e. `/\/$/`. The obvious
 * simplification, and wrong for a pasted URL that ends "checklist/S123//" -
 * which a copy-paste out of a browser address bar can genuinely produce.
 */
const extractStrippingOneSlash = (raw: string): string => {
  const s = raw.trim().replace(/\/$/, '').split('?')[0]
  return s.includes('/') ? (s.split('/').pop() ?? s) : s
}

// ── the real corpus ──────────────────────────────────────────────────────────

/**
 * Realistic submission IDs in every shape the comparer's input actually
 * receives: bare, full URL, trailing slash, query string, and the whitespace a
 * paste carries.
 *
 * A sweep of all 7,869 Submission IDs in the demo eBird backup - bare and
 * rewritten as URLs - also scored zero divergences while this was being built,
 * but that file is gitignored generated tooling output, so it cannot be a
 * committed dependency.
 */
const REAL_CORPUS: string[] = (() => {
  const ids = ['S1', 'S12345678', 'S987654321', 'S100000000000']
  const out: string[] = []
  for (const id of ids) {
    out.push(id)
    out.push(`  ${id}  `)
    for (const base of ['https://ebird.org/checklist/', 'http://ebird.org/checklist/', 'ebird.org/checklist/']) {
      out.push(`${base}${id}`)
      out.push(`${base}${id}/`)
      out.push(`${base}${id}//`)
      out.push(`${base}${id}?foo=1`)
      out.push(`${base}${id}/?foo=1`)
      out.push(` ${base}${id}/ `)
    }
  }
  return out
})()

// ── parity ───────────────────────────────────────────────────────────────────

describe('extractChecklistId is byte-identical to the pattern it replaced', () => {
  // Alphabet: the slash the pattern strips, the "?" and whitespace that the
  // surrounding pipeline branches on, and the two characters a real ID is made
  // of. `\n` is whitespace `trim` removes; `\u00a0` is `\s` for a regex and IS
  // removed by `trim` too, which is the pairing worth probing.
  const ALPHABET = ['/', '?', 'S', '1', ' ', '\n', '\u00a0']
  const MAX_LEN = 5

  it('agrees on every exhaustively enumerated probe', () => {
    const probes = enumerateProbes(ALPHABET, MAX_LEN)
    expect(probes.length).toBe(probeCount(ALPHABET.length, MAX_LEN))
    expect(probes.length).toBe(19608)
    expect(divergences(probes, shippedExtract, extractChecklistId)).toEqual({ count: 0, sample: [] })
  })

  it('agrees on realistic IDs in every paste shape', () => {
    expect(REAL_CORPUS.length).toBe(80)
    // Not vacuous: the corpus must actually resolve to valid IDs. 68 of the 80
    // do - see the pre-existing quirk pinned below for the 12 that do not.
    expect(REAL_CORPUS.filter((s) => isValidChecklistId(extractChecklistId(s))).length).toBe(68)
    expect(divergences(REAL_CORPUS, shippedExtract, extractChecklistId)).toEqual({ count: 0, sample: [] })
  })

  it('preserves a pre-existing quirk: a trailing slash BEFORE a query yields \'\'', () => {
    // Surfaced by this sweep's vacuity check rather than by the rewrite, and
    // deliberately left alone: the slash strip runs BEFORE the "?" split, so a
    // slash sitting in front of the query string is never stripped, the split
    // leaves it trailing, and `split('/').pop()` returns empty. Behaviour is
    // identical on both sides of the change - which is the point of pinning it
    // here rather than fixing it in a build whose contract is byte-identity.
    expect(extractChecklistId('https://ebird.org/checklist/S12345678/?foo=1')).toBe('')
    expect(shippedExtract('https://ebird.org/checklist/S12345678/?foo=1')).toBe('')
    // Without the trailing slash the same URL resolves normally.
    expect(extractChecklistId('https://ebird.org/checklist/S12345678?foo=1')).toBe('S12345678')
  })

  it('agrees on the named malformed probes', () => {
    const named = [
      '', '/', '//', '///', 'S1/', 'S1//', '/S1', '//S1', '/S1/', 'S1?x', 'S1/?x',
      '?', '?/', '/?', 'S1/x/', 'https://ebird.org/checklist/S1/', ' S1 ', '\nS1\n',
      '/'.repeat(40), '/'.repeat(40) + 'x', 'x' + '/'.repeat(40),
      'https://ebird.org/checklist/S1' + '/'.repeat(40),
    ]
    expect(divergences(named, shippedExtract, extractChecklistId)).toEqual({ count: 0, sample: [] })
  })

  // NON-VACUITY.
  it('rejects the strip-one-slash variant', () => {
    // 294 of the 19,608 probes discriminate. Fewer than the other sites,
    // because the two implementations differ only where a run of 2+ trailing
    // slashes survives the "?" split and the "/" pop - which is exactly the
    // narrow case this variant gets wrong, and enough of a signal that a
    // revert to it cannot pass.
    const probes = enumerateProbes(ALPHABET, MAX_LEN)
    expect(divergences(probes, shippedExtract, extractStrippingOneSlash).count).toBeGreaterThan(100)

    // The realistic corpus DOES discriminate here, because a doubled trailing
    // slash is an ordinary paste artefact rather than an exotic one.
    expect(divergences(REAL_CORPUS, shippedExtract, extractStrippingOneSlash).count).toBeGreaterThan(0)

    expect(extractChecklistId('https://ebird.org/checklist/S12345678//')).toBe('S12345678')
    expect(extractStrippingOneSlash('https://ebird.org/checklist/S12345678//')).toBe('')
  })

  it('still extracts the ID the comparer needs', () => {
    // The observable contract.
    expect(extractChecklistId('https://ebird.org/checklist/S12345678?foo')).toBe('S12345678')
    expect(extractChecklistId('  S12345678  ')).toBe('S12345678')
    expect(extractChecklistId('https://ebird.org/checklist/S12345678/')).toBe('S12345678')
  })
})

describe('stripTrailingSlashes is linear by construction', () => {
  it('has no unbounded quantifier in the rewritten body', () => {
    expect(unboundedQuantifiers(functionBody(source, 'function stripTrailingSlashes'))).toEqual([])
  })

  it('extracts a real body and flags exactly the unbounded patterns in it', () => {
    const body = functionBody(source, 'function stripTrailingSlashes')
    expect(body).toContain('charCodeAt')
    expect(body.length).toBeGreaterThan(60)

    // RED on the exact form a revert would take.
    const reverted = 'function f() {\n  return raw.trim().replace(/\\/+$/, "")\n}'
    expect(unboundedQuantifiers(functionBody(reverted, 'function f'))).toHaveLength(1)
    // RED on a length guard bolted onto the same pattern.
    const capped = 'function f() {\n  return raw.slice(0, 500).replace(/\\/+$/, "")\n}'
    expect(unboundedQuantifiers(functionBody(capped, 'function f'))).toHaveLength(1)
    // GREEN on a quantifier-free per-character test.
    const perChar = 'function f() {\n  while (i > 0 && /\\//.test(s[i - 1])) i--\n}'
    expect(unboundedQuantifiers(functionBody(perChar, 'function f'))).toEqual([])
  })

  it('deliberately leaves isValidChecklistId\'s `\\d+$` alone', () => {
    // Unbounded with `$` after it, which is the defect's shape - except that
    // `^` pins the scan to a single start position, so the backtrack is O(n)
    // once rather than from every offset. Measured flat (0.1 ms on 40,000
    // digits, 1.95x per doubling). Scoped honestly rather than swept up: this
    // is a sibling in the same file, and it is not an instance.
    expect(unboundedQuantifiers(functionBody(source, 'export function isValidChecklistId')))
      .toEqual(['/^S\\d+$/'])
    expect(isValidChecklistId('S12345678')).toBe(true)
    expect(isValidChecklistId('S1x')).toBe(false)
  })
})

describe('extractChecklistId is linear in practice', () => {
  it('stays under the ceiling on a long slash run (pattern: 2,246 ms)', () => {
    const elapsed = fastest(
      (salt) => 'a'.repeat(salt) + '/'.repeat(HOSTILE_LEN) + 'x',
      (s) => void extractChecklistId(s),
    )
    expect(elapsed).toBeLessThan(CEILING_MS)
  })

  it('stays fast when the run does reach the end (never a linearity guard)', () => {
    // Stated plainly rather than left to look like a second linearity guard:
    // this shape was ALWAYS linear, even under the pattern this replaced, so it
    // CANNOT reject a revert - `\/+$` succeeds at the first slash of the run
    // and never backtracks, measured 0.0 ms at 40,000 characters on the old
    // pattern. It is kept as coverage of the scan's SUCCESS path. The test that
    // actually rejects the defect is the one above, whose run stops short of
    // the end.
    const elapsed = fastest(
      (salt) => 'a'.repeat(salt) + 'S1' + '/'.repeat(HOSTILE_LEN),
      (s) => void extractChecklistId(s),
    )
    expect(elapsed).toBeLessThan(CEILING_MS)
    expect(extractChecklistId('S1' + '/'.repeat(HOSTILE_LEN))).toBe('S1')
  })
})
