// Subspecies Explorer derivations (subspecies-explorer): the shared row
// classification (FR-01/FR-02), index membership (FR-03), row shaping and the
// percentage-display contract (FR-09..FR-12, FR-16), the FR-13 parity identity,
// and the feature's count-bearing copy (QA-01..QA-03, QA-05, QA-09..QA-12,
// QA-14..QA-16, QA-28's copy half).
//
// Countability fixtures are REAL published names wherever the verdict comes
// from eBird's data (the bundled countability artifact), so these tests pin the
// wiring to the shared predicate rather than re-deriving a rule:
//   - "Canada Goose (moffitti/maxima)"    eBird COUNTS despite the raw "/"
//     (direction-A correction — a shape rule reading the name would reject it)
//   - "Brewster's Warbler (hybrid)"       eBird REJECTS though no shape rule
//     can (no " sp.", no "/", no base " x ") — the discriminating name
//   - "Azuero Warbler (undescribed form)" eBird REJECTS (undescribed form)
// The synthetic "Dark-eyed Junco (fake/mystery)" is deliberately unpublished:
// it exercises the shape FALLBACK's raw-name "/" test on a name that folds to
// a real selected species (the PRD's own FR-02 example shape).

import { describe, it, expect } from 'vitest'
import type { ObservationEntry } from '../types'
import {
  buildSubspeciesIndex, computeSpeciesBreakdown, explorerEntries,
  formCountLabel, formNotedLabel, ledgerNote, reportCountLabel, speciesCountLabel,
  NO_FORM_NOTED_LABEL,
} from './subspeciesExplorer'

let seq = 0
function obs(commonName: string, extra: Partial<ObservationEntry> = {}): ObservationEntry {
  seq += 1
  return {
    submissionId: `S${1000 + seq}`,
    commonName,
    scientificName: 'Genus species',
    date: '2026-04-01',
    location: 'Somewhere',
    locationId: 'L1',
    latitude: null,
    longitude: null,
    county: 'Hennepin',
    count: 1,
    breedingCode: null,
    speciesComments: '',
    catalogIds: [],
    ...extra,
  }
}

function many(commonName: string, n: number): ObservationEntry[] {
  return Array.from({ length: n }, () => obs(commonName))
}

// ── Classification and membership ───────────────────────────────────────────

describe('buildSubspeciesIndex: the shared classification (FR-01, FR-02, QA-01)', () => {
  const fixture = [
    obs('Dark-eyed Junco (Oregon)'),                    // ISSF group → form
    obs('Dark-eyed Junco (Oregon x Slate-colored)'),    // intergrade → form
    obs('Mallard (Domestic type)'),                     // domestic type → form
    obs('Canada Goose (moffitti/maxima)'),              // eBird counts (correction) → form
    obs('Mallard x American Black Duck (hybrid)'),      // hybrid (base " x ") → never
    obs("Brewster's Warbler (hybrid)"),                 // hybrid (published reject) → never
    obs('Gull sp.'),                                    // spuh → never
    obs('Greater/Lesser Scaup'),                        // slash → never
    obs('Azuero Warbler (undescribed form)'),           // undescribed form → never
    obs('Dark-eyed Junco'),                             // plain species-level row
    obs('American Robin'),                              // plain-only species
  ]
  const index = buildSubspeciesIndex(fixture)

  it('exactly the ISSF group, intergrade, and domestic classes are forms', () => {
    // Lexicographic order: "(Oregon x…" sorts before "(Oregon)" (space < ")").
    expect([...index.get('Dark-eyed Junco')!.formCounts.keys()].sort()).toEqual([
      'Dark-eyed Junco (Oregon x Slate-colored)',
      'Dark-eyed Junco (Oregon)',
    ])
    expect([...index.get('Mallard')!.formCounts.keys()]).toEqual(['Mallard (Domestic type)'])
    // Direction A: the raw "/" does not disqualify a name eBird counts.
    expect([...index.get('Canada Goose')!.formCounts.keys()]).toEqual(['Canada Goose (moffitti/maxima)'])
  })

  it('hybrids, spuhs, slashes, and undescribed forms never qualify, anywhere', () => {
    for (const [, entry] of index) {
      for (const name of entry.formCounts.keys()) {
        expect(name).not.toMatch(/hybrid|sp\.$|undescribed/)
      }
    }
    // They land in the ledger under their folded parent instead.
    expect(index.get("Brewster's Warbler")!.nonCountableCount).toBe(1)
    expect(index.get("Brewster's Warbler")!.formCounts.size).toBe(0)
    expect(index.get('Azuero Warbler')!.nonCountableCount).toBe(1)
    expect(index.get('Gull sp.')!.nonCountableCount).toBe(1)
    expect(index.get('Greater/Lesser Scaup')!.nonCountableCount).toBe(1)
  })

  it('plain species-level rows tally as plain, not as forms (QA-03 basis)', () => {
    expect(index.get('Dark-eyed Junco')!.plainCount).toBe(1)
    expect(index.get('American Robin')!.plainCount).toBe(1)
    expect(index.get('American Robin')!.formCounts.size).toBe(0)
  })
})

describe('explorerEntries: membership and ordering (FR-03, FR-05, QA-03, QA-05)', () => {
  it('contains exactly the species with >= 1 qualifying entry', () => {
    const index = buildSubspeciesIndex([
      obs('Dark-eyed Junco (Oregon)'),
      obs('American Robin'),                  // plain-only → absent
      obs("Brewster's Warbler (hybrid)"),     // non-countable-only key → absent
    ])
    const order = ['American Robin', "Brewster's Warbler", 'Dark-eyed Junco']
    expect(explorerEntries(index, order).map(e => e.species)).toEqual(['Dark-eyed Junco'])
  })

  it('species follow the given selector order; forms sort by share desc, ties alphabetical', () => {
    const index = buildSubspeciesIndex([
      ...many('Aaa Bird (west)', 1),
      ...many('Zee Bird (b form)', 2),
      ...many('Zee Bird (a form)', 1),
      ...many('Zee Bird (x form)', 1),
    ])
    // Selector (taxonomic) order deliberately inverts alphabetical order.
    const entries = explorerEntries(index, ['Zee Bird', 'Aaa Bird'])
    expect(entries.map(e => e.species)).toEqual(['Zee Bird', 'Aaa Bird'])
    expect(entries[0].forms.map(f => f.name)).toEqual([
      'Zee Bird (b form)',   // highest share first
      'Zee Bird (a form)',   // tie with (x form) → alphabetical
      'Zee Bird (x form)',
    ])
  })

  it('a form-only species still qualifies (FR-16)', () => {
    const index = buildSubspeciesIndex(many('Fox Sparrow (Sooty)', 3))
    const entries = explorerEntries(index, ['Fox Sparrow'])
    expect(entries.map(e => e.species)).toEqual(['Fox Sparrow'])
    // Its single form displays a flat 100% (FR-12 single-row rule).
    expect(entries[0].forms[0].pctLabel).toBe('100%')
  })
})

// ── The breakdown (Contract B) ──────────────────────────────────────────────

describe('computeSpeciesBreakdown: rows, counts, and the FR-13 identity', () => {
  // The approved design's demonstrated fixture, at full scale: Dark-eyed Junco
  // with 214 Oregon, 58 Slate-colored, 9 intergrade, 141 plain, 3 non-countable.
  const juncoView = [
    ...many('Dark-eyed Junco (Oregon)', 214),
    ...many('Dark-eyed Junco (Slate-colored)', 58),
    ...many('Dark-eyed Junco (Oregon x Slate-colored)', 9),
    ...many('Dark-eyed Junco', 141),
    ...many('Dark-eyed Junco (fake/mystery)', 3),   // shape-rejected, folds here
  ]
  const b = computeSpeciesBreakdown(juncoView)

  it('one row per countable form, count desc, plain pinned last (FR-09, FR-10)', () => {
    expect(b.rows.map(r => [r.kind, r.name, r.count])).toEqual([
      ['form', 'Dark-eyed Junco (Oregon)', 214],
      ['form', 'Dark-eyed Junco (Slate-colored)', 58],
      ['form', 'Dark-eyed Junco (Oregon x Slate-colored)', 9],
      ['plain', NO_FORM_NOTED_LABEL, 141],
    ])
  })

  it('non-countables appear in no row and no denominator (FR-02, QA-02)', () => {
    expect(b.rows.some(r => r.name.includes('fake/mystery'))).toBe(false)
    expect(b.total).toBe(422)
    expect(b.nonCountableCount).toBe(3)
  })

  it('row counts sum exactly to the total (FR-11, QA-11)', () => {
    expect(b.rows.reduce((s, r) => s + r.count, 0)).toBe(b.total)
  })

  it('the FR-13 identity holds: total + nonCountableCount === rows in view (QA-13)', () => {
    expect(b.total + b.nonCountableCount).toBe(juncoView.length)
  })

  it('residue is absorbed by the largest row so displays sum to exactly 100.0 (FR-12, QA-12)', () => {
    // Raw rounding gives 50.7 + 13.7 + 2.1 + 33.4 = 99.9; the +0.1 residue
    // lands on Oregon (the largest row), per the approved design's math.
    expect(b.rows.map(r => r.pctLabel)).toEqual(['50.8%', '13.7%', '2.1%', '33.4%'])
    const tenths = b.rows.reduce((s, r) => s + Math.round(r.pct * 10), 0)
    expect(tenths).toBe(1000)
  })

  it('the "Form noted" headline equals the sum of the displayed form rows', () => {
    expect(formNotedLabel(b)).toBe('66.6%')   // 50.8 + 13.7 + 2.1
  })

  it('a nonzero row never displays below 0.1% (FR-12, QA-12)', () => {
    const tiny = computeSpeciesBreakdown([
      ...many('Sparrow (rare form)', 1),
      ...many('Sparrow', 2000),
    ])
    expect(tiny.rows.map(r => r.pctLabel)).toEqual(['0.1%', '99.9%'])
    expect(tiny.rows.reduce((s, r) => s + Math.round(r.pct * 10), 0)).toBe(1000)
  })

  it('an engineered three-way tie still sums to exactly 100.0', () => {
    const thirds = computeSpeciesBreakdown([
      obs('Bird (a)'), obs('Bird (b)'), obs('Bird (c)'),
    ])
    // 33.33 each; the +0.1 residue lands on the first of the tied largest rows.
    expect(thirds.rows.map(r => r.pctLabel)).toEqual(['33.4%', '33.3%', '33.3%'])
  })

  it('the single-minor-form shape needs no residue and rounds cleanly', () => {
    const wcsp = computeSpeciesBreakdown([
      ...many("White-crowned Sparrow (Gambel's)", 12),
      ...many('White-crowned Sparrow', 134),
    ])
    expect(wcsp.rows.map(r => r.pctLabel)).toEqual(['8.2%', '91.8%'])
    expect(formNotedLabel(wcsp)).toBe('8.2%')
  })

  it('a form-only species: form rows only, no plain row, flat 100% (FR-16, QA-16)', () => {
    const sooty = computeSpeciesBreakdown(many('Fox Sparrow (Sooty)', 111))
    expect(sooty.rows).toHaveLength(1)
    expect(sooty.rows[0].kind).toBe('form')
    expect(sooty.rows[0].pctLabel).toBe('100%')
    expect(sooty.total).toBe(111)
    expect(formNotedLabel(sooty)).toBe('100%')
  })

  it('a view of only species-level rows: the single plain row at 100% (FR-14, QA-14)', () => {
    const plainOnly = computeSpeciesBreakdown(many('Varied Thrush', 7))
    expect(plainOnly.rows.map(r => [r.kind, r.pctLabel])).toEqual([['plain', '100%']])
    expect(plainOnly.total).toBe(7)
  })

  it('a view of zero rows: total 0, no rows (FR-14 zero state basis)', () => {
    const empty = computeSpeciesBreakdown([])
    expect(empty.rows).toEqual([])
    expect(empty.total).toBe(0)
    expect(empty.nonCountableCount).toBe(0)
  })

  it('a view of only non-countable rows: total 0 with the full ledger (the divergence corner)', () => {
    const hybridOnly = computeSpeciesBreakdown(many("Brewster's Warbler (hybrid)", 4))
    expect(hybridOnly.rows).toEqual([])
    expect(hybridOnly.total).toBe(0)
    expect(hybridOnly.nonCountableCount).toBe(4)
    // The identity that accounts for the Sightings figure: 0 + 4 === 4.
  })
})

// ── Count-bearing copy (rules over a generated corpus, not a ban list) ──────

describe('display copy: singular/plural rules and no em dash (NFR-05, QA-28)', () => {
  const counts = [0, 1, 2, 3, 141, 2000]
  const corpus: string[] = [
    ...counts.map(reportCountLabel),
    ...counts.map(speciesCountLabel),
    ...counts.map(formCountLabel),
    ...counts.flatMap(n => counts.map(t => ledgerNote(n, t))),
    NO_FORM_NOTED_LABEL,
  ]

  it('no count of one takes a plural noun', () => {
    for (const s of corpus) {
      // "species" is an invariant plural and exempt by shape (it never
      // matches: no "1 speciess" is ever emitted).
      expect(s).not.toMatch(/\b1 (report|form|name|hybrid|slash)s\b/)
    }
  })

  it('no plural verb follows a subject counted at one (sentence-scoped)', () => {
    for (const s of corpus) {
      for (const sentence of s.split('. ')) {
        // Only a sentence that carries the verb at all is in scope — the bare
        // "1 report" row label has no verb and owes no agreement.
        if (/^1 report\b/.test(sentence) && /\buses?\b/.test(sentence)) {
          expect(sentence).not.toMatch(/\buse\b/)
          expect(sentence).toMatch(/\buses\b/)
        }
      }
    }
    // Non-vacuity: the singular branch is actually in the corpus.
    expect(corpus.some(s => s.startsWith('1 report uses a name'))).toBe(true)
  })

  it('the singular ledger keeps its pronouns singular; the plural keeps them plural', () => {
    expect(ledgerNote(1, 42)).toBe(
      '1 report uses a name that is not a countable subspecies or form, such as a hybrid or a slash. The Sightings total of 42 includes it; this breakdown does not.',
    )
    expect(ledgerNote(3, 425)).toBe(
      '3 reports use names that are not countable subspecies or forms, such as hybrids or slashes. The Sightings total of 425 includes them; this breakdown does not.',
    )
  })

  it('no em dash (U+2014) anywhere in the emitted copy', () => {
    for (const s of corpus) expect(s.includes('—')).toBe(false)
  })
})
