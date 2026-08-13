// SHARED-FIXTURE PARITY TEST — the JS half of the dual-transport exotic-provenance
// lockstep (escapee-count-toggle, schema.md §11.4, FR-39, QA-44).
//
// `lib/tauri/checklistService.normalizeProvenancePair` (desktop/Tauri) and
// `services.ebird._norm_token` applied to the same two fields (web/Pi backend)
// are twins kept in lockstep by comment only. This test and its pytest sibling
// (backend/tests/test_checklist_provenance_parity.py) both load the ONE shared
// fixture (checklistProvenance.fixture.json) and assert the SAME normalized
// pair, so if either twin drifts its own test fails.
//
// Both sides are called through their SHIPPED exports rather than a retyped copy
// of the pattern; retyping is how a reproduction quietly stops testing the code
// that ships.

import { describe, it, expect } from 'vitest'
import { normalizeProvenancePair } from './tauri/checklistService'
import fixture from './checklistProvenance.fixture.json'

interface Case {
  why: string
  obs: { speciesCode: string; exoticCategory?: unknown; userDoNotCount?: unknown }
  expected: { exoticCategory: string; userDoNotCount: string }
}

const cases = fixture.cases as unknown as Case[]

describe('exotic-provenance seam normalization (desktop half of the parity pair)', () => {
  it('normalizes every shared-fixture case to the expected pair', () => {
    for (const c of cases) {
      expect(
        normalizeProvenancePair(c.obs.exoticCategory, c.obs.userDoNotCount),
        c.why,
      ).toEqual(c.expected)
    }
  })

  // Non-vacuity: a fixture that had quietly lost its hostile rows would still
  // pass the loop above. These assert the probe set actually exercises the
  // branches the guard exists for.
  it('the fixture still carries the cases that make the guard discriminating', () => {
    const cats = cases.map(c => c.obs.exoticCategory)
    // The v0.5.54 trap: a `\d`/`\w` pattern would admit these on the Python side
    // (rust-regex treats them as Unicode) while rejecting them in JS.
    expect(cats).toContain('٠١٢')          // Arabic-Indic 012
    expect(cats).toContain('Х')                       // Cyrillic capital Ha
    expect(cats.some(v => typeof v !== 'string')).toBe(true)
    // The three real eBird values plus an unrecognized future one.
    for (const v of ['X', 'N', 'P', 'Q']) expect(cats).toContain(v)
    // ANCHOR parity, not just class parity. Matching character classes are only
    // half of it: Python's `$` matches before a trailing newline and
    // JavaScript's does not, so `re.match` accepted 'X\n' where `.test()`
    // rejected it, and the divergence was invisible to every row above.
    expect(cats).toContain('X\n')
    expect(cats).toContain('\nX')
    expect(cats).toContain('X\nN')
    expect(cases.length).toBeGreaterThanOrEqual(15)
  })

  it('rejects a hostile value rather than coercing it (the direction that COUNTS)', () => {
    // Anything unrecognized normalizes to '', and '' counts under FR-01. So a
    // malformed response can never silently REMOVE a species from a life list;
    // the failure direction is the safe one.
    for (const c of cases) {
      const out = normalizeProvenancePair(c.obs.exoticCategory, c.obs.userDoNotCount)
      if (out.exoticCategory !== 'X') {
        expect(out.exoticCategory === '' || out.exoticCategory.length <= 4).toBe(true)
      }
    }
  })

  it('mutation guard: the ANCHORS must reject what a Python `$` would admit', () => {
    // The shipped JS side already rejects these, so this test is the fixed
    // reference the backend's `fullmatch` has to meet. Reverting the backend to
    // `.match()` turns its half of the parity pair red against the same rows.
    expect(normalizeProvenancePair('X\n', 'DNC\n')).toEqual({ exoticCategory: '', userDoNotCount: '' })
    expect(normalizeProvenancePair('\nX', '\nDNC')).toEqual({ exoticCategory: '', userDoNotCount: '' })
    expect(normalizeProvenancePair('X\nN', '')).toEqual({ exoticCategory: '', userDoNotCount: '' })
  })

  it('mutation guard: an ASCII-only class is what makes the two transports agree', () => {
    // `\w` and `\d` are the two shapes the v0.5.54 finding was about. If the
    // shipped pattern were rewritten with either, the Cyrillic and Arabic-Indic
    // rows would start passing on one transport and not the other. Assert
    // directly that the shipped normalizer rejects them, so such a rewrite goes
    // red here rather than at a user's data.
    expect(normalizeProvenancePair('Х', '').exoticCategory).toBe('')
    expect(normalizeProvenancePair('٠١٢', '').exoticCategory).toBe('')
    expect(normalizeProvenancePair('X', 'DNC')).toEqual({ exoticCategory: 'X', userDoNotCount: 'DNC' })
  })
})
