// The pure exotic-provenance model: the countability rule, the three-state (plus
// `unknown`) classification, the greedy cover, and the passive confirmation.
//
// The single most important test in this file is the ANTI-SHORTCUT guard
// (`the taxonomy category field can never decide countability`). Escapee status
// is a per-observation eBird fact, and the offline `category === 'domestic'`
// heuristic is wrong in BOTH directions: Red Junglefowl returns 'N' and Indian
// Peafowl 'P', and eBird counts both. A control labelled "escapees" that runs a
// different rule than eBird's is worse than no control, because it claims a
// parity it does not have.

import { describe, it, expect } from 'vitest'
import type { ObservationEntry } from '../types'
import {
  EMPTY_SNAPSHOT, ESCAPEE_CATEGORY,
  buildCoverIndex, buildProvenanceLookup, categoryOfToken, classCounts,
  classifySpecies, confirmExcludedNames, greedyCover, remainingSpecies,
  seenToken, tokenCounts,
  type ProvenanceSnapshot, type SpeciesProvenanceRecord,
} from './exoticProvenance'

// ── Fixture helpers ───────────────────────────────────────────────────────────

function obs(commonName: string, submissionId: string, extra: Partial<ObservationEntry> = {}): ObservationEntry {
  return {
    commonName,
    scientificName: '',
    count: 1,
    submissionId,
    date: '2025-01-01',
    location: 'L',
    locationId: 'L1',
    latitude: null,
    longitude: null,
    county: null,
    stateProvince: 'US-CA',
    ...extra,
  } as ObservationEntry
}

function snapshot(
  species: Record<string, SpeciesProvenanceRecord>,
  checklists: string[],
  excludedNames: string[] = [],
): ProvenanceSnapshot {
  return {
    checklists: new Set(checklists),
    species: new Map(Object.entries(species)),
    excludedNames,
  }
}

const rec = (seen: string[], n = seen.length): SpeciesProvenanceRecord => ({ seen, n, at: 0 })

// The reference codes. `graygo` (Graylag Goose), `swagoo` (Swan Goose) and
// `musduc` (Muscovy Duck) are the three species that actually dropped on the
// user's real export; `redjun` and `indpea1` are the anti-shortcut pair.
const CODES: Record<string, string> = {
  'Graylag Goose': 'graygo',
  'Swan Goose': 'swagoo',
  'Muscovy Duck': 'musduc',
  'Red Junglefowl': 'redjun',
  'Indian Peafowl': 'indpea1',
  'American Robin': 'amerob',
  Mallard: 'mallar3',
}
const codeFor = (norm: string): string | undefined => CODES[norm]

// ── The countability rule ─────────────────────────────────────────────────────

describe('the countability rule (FR-01, FR-02, FR-08)', () => {
  it("counts everything except an explicit 'X'", () => {
    expect(tokenCounts(seenToken('X', 'DNC'))).toBe(false)
    expect(tokenCounts(seenToken('N', ''))).toBe(true)
    expect(tokenCounts(seenToken('P', ''))).toBe(true)
    expect(tokenCounts(seenToken('', ''))).toBe(true)
  })

  it('counts an UNRECOGNIZED future category rather than guessing at it', () => {
    // The category is a bounded token, not a closed union. Collapsing an
    // unknown value would destroy exactly the evidence FR-09 exists to keep,
    // and the safe direction is to count.
    expect(tokenCounts(seenToken('Q', ''))).toBe(true)
    expect(categoryOfToken(seenToken('Q', 'DNC'))).toBe('Q')
  })

  it('never gates on userDoNotCount (FR-08, QA-12)', () => {
    // OQ-01 is deliberately left open: adopting a signal whose meaning is
    // assumed is the exact failure this feature exists to avoid. Removing the
    // companion flag from every token must change no answer.
    for (const cat of ['', 'X', 'N', 'P', 'Q']) {
      expect(tokenCounts(seenToken(cat, 'DNC'))).toBe(tokenCounts(seenToken(cat, '')))
    }
    // ...and a DNC beside a NON-escapee category still counts, which is the
    // case that would flip if the flag were ever wired into the gate.
    expect(tokenCounts(seenToken('', 'DNC'))).toBe(true)
    expect(tokenCounts(seenToken('N', 'DNC'))).toBe(true)
  })

  it('records the raw PAIR, so OQ-01 stays answerable with no further request (FR-09, QA-13)', () => {
    // A presence flag could not answer the question, which is about the
    // PAIRING: does DNC ever appear beside a category other than X?
    const t = seenToken('N', 'DNC')
    expect(t).toBe('N|DNC')
    expect(categoryOfToken(t)).toBe('N')
    expect(t.slice(t.indexOf('|') + 1)).toBe('DNC')
  })
})

// ── The anti-shortcut guard ───────────────────────────────────────────────────

describe('the forbidden offline shortcut (FR-06, QA-03, QA-04, QA-10)', () => {
  it('the taxonomy category field can never decide countability', () => {
    // Both of these are Domestic-type forms that the bundled taxonomy would
    // label `category: 'domestic'`, and eBird COUNTS both. Their live values are
    // 'N' and 'P', measured against the real API. If either disappears from the
    // counted set, the offline shortcut was built instead of the real rule.
    const index = buildCoverIndex(
      [obs('Red Junglefowl', 'S1'), obs('Indian Peafowl', 'S1'), obs('Graylag Goose', 'S1')],
      codeFor,
    )
    const snap = snapshot({
      redjun: rec(['N|']),
      indpea1: rec(['P|']),
      graygo: rec(['X|DNC']),
    }, ['S1'])

    const lookup = buildProvenanceLookup(snap, index)
    expect(lookup.excludedNames.has('Red Junglefowl')).toBe(false)
    expect(lookup.excludedNames.has('Indian Peafowl')).toBe(false)
    expect(lookup.excludedNames.has('Graylag Goose')).toBe(true)
    expect([...lookup.excludedNames]).toEqual(['Graylag Goose'])
  })

  it('the model reads NOTHING but the recorded provenance tokens', () => {
    // Two species with identical names, indices and carriers, differing ONLY in
    // their recorded token. If any name-, taxonomy- or heuristic-derived signal
    // had crept into the decision, these two would not diverge purely on that.
    const index = buildCoverIndex([obs('Muscovy Duck', 'S1')], codeFor)
    const escapee = buildProvenanceLookup(snapshot({ musduc: rec(['X|DNC']) }, ['S1']), index)
    const natural = buildProvenanceLookup(snapshot({ musduc: rec(['N|']) }, ['S1']), index)
    expect([...escapee.excludedNames]).toEqual(['Muscovy Duck'])
    expect([...natural.excludedNames]).toEqual([])
  })
})

// ── Classification ────────────────────────────────────────────────────────────

describe('classification (FR-03, FR-04, QA-06, QA-07, QA-08)', () => {
  const index = buildCoverIndex(
    [obs('Muscovy Duck', 'S1'), obs('Muscovy Duck', 'S2'), obs('American Robin', 'S1')],
    codeFor,
  )

  it('a species with one X and one non-X observation COUNTS (the monotone OR)', () => {
    const snap = snapshot({ musduc: rec(['X|DNC', 'N|']) }, ['S1', 'S2'])
    expect(classifySpecies(snap, index, 'musduc')).toBe('counting')
    expect(classCounts('counting')).toBe(true)
  })

  it('all-X with EVERY carrier consulted is escapee-only, and does not count', () => {
    const snap = snapshot({ musduc: rec(['X|DNC']) }, ['S1', 'S2'])
    expect(classifySpecies(snap, index, 'musduc')).toBe('escapee-only')
    expect(classCounts('escapee-only')).toBe(false)
  })

  it('all-X with an UNCONSULTED carrier is unresolved, and still COUNTS (FR-04)', () => {
    // A species is never removed from a life-list total on incomplete evidence.
    // The total converges downward as resolution completes, never below the truth.
    const snap = snapshot({ musduc: rec(['X|DNC']) }, ['S1'])
    expect(classifySpecies(snap, index, 'musduc')).toBe('unresolved')
    expect(classCounts('unresolved')).toBe(true)
  })

  it('a never-consulted species is `unknown`, and counts', () => {
    expect(classifySpecies(EMPTY_SNAPSHOT, index, 'amerob')).toBe('unknown')
    expect(classCounts('unknown')).toBe(true)
  })

  it('a newly added checklist re-opens an escapee-only species (FR-25, QA-31)', () => {
    const oneCarrier = buildCoverIndex([obs('Muscovy Duck', 'S1')], codeFor)
    const snap = snapshot({ musduc: rec(['X|DNC']) }, ['S1'])
    expect(classifySpecies(snap, oneCarrier, 'musduc')).toBe('escapee-only')
    // A fresh export adds S9 carrying the same species. Nothing about the store
    // changed; the CURRENT export did, and the classification follows it.
    const twoCarriers = buildCoverIndex([obs('Muscovy Duck', 'S1'), obs('Muscovy Duck', 'S9')], codeFor)
    expect(classifySpecies(snap, twoCarriers, 'musduc')).toBe('unresolved')
  })

  it('an empty store leaves EVERY number byte-identical to pre-feature (FR-26, QA-32)', () => {
    const lookup = buildProvenanceLookup(EMPTY_SNAPSHOT, index)
    expect(lookup.excludedNames.size).toBe(0)
    expect(lookup.excluded).toEqual([])
    expect(lookup.counts).toEqual({ resolved: 0, unresolved: 0, unknown: 2 })
  })

  it('reports the disclosure payload with its evidence (FR-32, QA-37)', () => {
    const snap = snapshot({ musduc: rec(['X|DNC'], 3) }, ['S1', 'S2'])
    const lookup = buildProvenanceLookup(snap, index)
    expect(lookup.excluded).toEqual([
      { name: 'Muscovy Duck', speciesCode: 'musduc', seen: ['X|DNC'], checklistsChecked: 3 },
    ])
    // The reason shown is the evidence held, not a restatement of the rule.
    expect(lookup.excluded[0].seen).toEqual(['X|DNC'])
  })
})

// ── The cover index ───────────────────────────────────────────────────────────

describe('buildCoverIndex (FR-05, FR-07, FR-10, QA-11, QA-15)', () => {
  it('composes with the countable-name predicate rather than replacing it', () => {
    // A spuh was already not a life-list species. Asking eBird about one would
    // spend cover budget on an answer nobody reads.
    const index = buildCoverIndex(
      [obs('Gull sp.', 'S1'), obs('Greater/Lesser Scaup', 'S1'), obs('Mallard x American Black Duck', 'S1'), obs('Mallard', 'S1')],
      norm => (norm === 'Mallard' ? 'mallar3' : CODES[norm]),
    )
    expect([...index.bySpecies.keys()]).toEqual(['mallar3'])
  })

  it('keeps a countable INTERGRADE, because it takes the RAW exported name', () => {
    // `isNonCountableObservedName` tests " x " on the NORMALIZED name, so an
    // intraspecific intergrade stays countable while a true hybrid does not.
    // Using the normalized-name predicate here would erase the species outright
    // when the intergrade is a birder's only record of it.
    const index = buildCoverIndex(
      [obs("Yellow-rumped Warbler (Myrtle x Audubon's)", 'S1')],
      norm => (norm === 'Yellow-rumped Warbler' ? 'yerwar' : undefined),
    )
    expect([...index.bySpecies.keys()]).toEqual(['yerwar'])
    expect(index.nameForCode.get('yerwar')).toBe('Yellow-rumped Warbler')
  })

  it('records a name that resolves to NO code and never covers it', () => {
    // Asking eBird about it would produce an answer with nothing to join to, so
    // it is excluded from the cover and always counts.
    const index = buildCoverIndex([obs('Unknown Bird', 'S1')], () => undefined)
    expect(index.bySpecies.size).toBe(0)
    expect([...index.unresolvableNames]).toEqual(['Unknown Bird'])
  })

  it('maps a name to a code ONCE, in one direction, with no round trip (FR-07)', () => {
    // A fixture where a code -> name -> code round trip would mismatch: the
    // taxonomy would render `mallar3` as "Mallard", but the EXPORT's own string
    // is a subspecies form. The set a surface compares is the export's string,
    // carried forward, so the round trip never happens.
    const index = buildCoverIndex(
      [obs('Mallard (Domestic type)', 'S1'), obs('Mallard', 'S2')],
      norm => (norm === 'Mallard' ? 'mallar3' : undefined),
    )
    expect(index.nameForCode.get('mallar3')).toBe('Mallard')
    expect(index.bySpecies.get('mallar3')).toEqual(['S1', 'S2'])
  })

  it('de-duplicates a (checklist, species) pair but never a species across checklists', () => {
    const index = buildCoverIndex(
      [obs('Mallard', 'S1'), obs('Mallard (Domestic type)', 'S1'), obs('Mallard', 'S2')],
      norm => (norm === 'Mallard' ? 'mallar3' : undefined),
    )
    expect(index.bySpecies.get('mallar3')).toEqual(['S1', 'S2'])
    expect(index.byChecklist.get('S1')).toEqual(['mallar3'])
  })
})

// ── The greedy cover ──────────────────────────────────────────────────────────

describe('greedyCover (FR-10, FR-24, QA-15, QA-16)', () => {
  function indexOf(rows: Array<[string, string]>) {
    return buildCoverIndex(
      rows.map(([name, sub]) => obs(name, sub)),
      norm => `code-${norm}`,
    )
  }

  it('selects the checklist carrying the most unresolved species first', () => {
    const index = indexOf([
      ['A', 'S1'], ['B', 'S1'], ['C', 'S1'],
      ['A', 'S2'],
      ['D', 'S3'],
    ])
    const all = [...index.bySpecies.keys()]
    expect(greedyCover(index, all, new Set(), 10)).toEqual(['S1', 'S3'])
  })

  it('is deterministic, breaking gain ties on the lowest submission id', () => {
    const index = indexOf([['A', 'S7'], ['B', 'S3'], ['C', 'S5']])
    expect(greedyCover(index, [...index.bySpecies.keys()], new Set(), 10)).toEqual(['S3', 'S5', 'S7'])
  })

  it('never selects a checklist already consulted (FR-24, the incremental refresh)', () => {
    const index = indexOf([['A', 'S1'], ['B', 'S1'], ['A', 'S2'], ['B', 'S2']])
    // S1 is in the ledger, so it is not a candidate however much it would
    // cover. A species still open is pursued through a DIFFERENT checklist,
    // which is exactly the follow-up shape.
    expect(greedyCover(index, [...index.bySpecies.keys()], new Set(['S1']), 10)).toEqual(['S2'])
    // With every carrier consulted there is nothing left to fetch at all.
    expect(greedyCover(index, [...index.bySpecies.keys()], new Set(['S1', 'S2']), 10)).toEqual([])
  })

  it('re-covers only the species still open, never the whole export (QA-30)', () => {
    const index = indexOf([['A', 'S1'], ['B', 'S2'], ['C', 'S3']])
    expect(greedyCover(index, ['code-B'], new Set(['S1']), 10)).toEqual(['S2'])
  })

  it('terminates when no remaining checklist adds a species (FR-10 second clause)', () => {
    const index = indexOf([['A', 'S1']])
    expect(greedyCover(index, ['code-Z'], new Set(), 10)).toEqual([])
    expect(greedyCover(index, [], new Set(), 10)).toEqual([])
  })

  it('honours the selection bound', () => {
    const index = indexOf([['A', 'S1'], ['B', 'S2'], ['C', 'S3']])
    expect(greedyCover(index, [...index.bySpecies.keys()], new Set(), 2)).toHaveLength(2)
    expect(greedyCover(index, [...index.bySpecies.keys()], new Set(), 0)).toEqual([])
  })

  it('always produces a cover that actually covers everything reachable', () => {
    // The property that matters, asserted rather than a specific selection:
    // after the cover, no unresolved species has an unconsulted carrier.
    const rows: Array<[string, string]> = []
    for (let s = 0; s < 40; s += 1) {
      for (let k = 0; k < 5; k += 1) rows.push([`sp${(s * 7 + k * 13) % 60}`, `S${s}`])
    }
    const index = indexOf(rows)
    const all = [...index.bySpecies.keys()]
    const cover = new Set(greedyCover(index, all, new Set(), 1000))
    for (const code of all) {
      expect(index.bySpecies.get(code)!.some(sub => cover.has(sub))).toBe(true)
    }
    // Greedy set cover is not guaranteed optimal, so this is an upper bound.
    expect(cover.size).toBeLessThanOrEqual(40)
  })

  it('remainingSpecies drops parked and already-answered species', () => {
    const index = indexOf([['A', 'S1'], ['B', 'S1'], ['C', 'S1']])
    const snap = snapshot(
      { 'code-A': rec(['N|']), 'code-B': rec(['X|DNC']) },
      ['S1'],
    )
    // A is counting (answered), B is escapee-only (answered), C is unknown.
    expect(remainingSpecies(snap, index, new Set())).toEqual(['code-C'])
    expect(remainingSpecies(snap, index, new Set(['code-C']))).toEqual([])
  })
})

// ── NFR-01: cover performance ─────────────────────────────────────────────────

describe('cover performance (NFR-01, QA-51)', () => {
  // Build a fixture at the reference export's real scale: 21,369 rows across
  // 3,252 checklists and 267 species. A DISTINCT INPUT PER TIMED RUN, so the
  // guard can never be measuring a memo hit.
  function buildFixture(salt: number) {
    const rows: ObservationEntry[] = []
    const ROWS = 21_369, CHECKLISTS = 3_252, SPECIES = 267
    for (let i = 0; i < ROWS; i += 1) {
      const sub = `S${salt}${i % CHECKLISTS}`
      // A skewed distribution: common species on many checklists, rare ones on
      // one or two, which is what makes the cover non-trivial.
      const sp = (i * 37 + Math.floor(i / CHECKLISTS) * 11) % SPECIES
      rows.push(obs(`sp${salt}-${sp}`, sub))
    }
    return buildCoverIndex(rows, norm => `c-${norm}`)
  }

  it('computes a cover on a 21,369-row, 3,252-checklist fixture well under the 500 ms ceiling', () => {
    const CEILING_MS = 500
    // Five complete executions, each on a fixture built from a DIFFERENT salt so
    // no memo anywhere on the path can be hit twice, and take the MINIMUM. The
    // repeated-measurement shape is the repo's pattern for resisting shared
    // runner scheduling noise; it may not be used to weaken the threshold.
    const samples: number[] = []
    for (let run = 0; run < 5; run += 1) {
      const index = buildFixture(run + 1)
      const all = [...index.bySpecies.keys()]
      const t0 = performance.now()
      const cover = greedyCover(index, all, new Set(), 500)
      samples.push(performance.now() - t0)
      // Non-vacuity: the timed call must have done the real work.
      expect(cover.length).toBeGreaterThan(0)
      const covered = new Set(cover)
      for (const code of all) {
        expect(index.bySpecies.get(code)!.some(sub => covered.has(sub))).toBe(true)
      }
    }
    const best = Math.min(...samples)
    // MEASURED, with the machine named, because a bare figure reads as
    // universal and this one is not. Nine fresh-salt runs through this module on
    // an Apple M1 Pro (darwin arm64, node 24): min 3.38 ms, median 4.32 ms,
    // worst 6.62 ms, i.e. roughly 75x to 150x under the 500 ms ceiling. An
    // earlier revision of this comment claimed "~2 ms, roughly 200x", which was
    // one optimistic reading stated as a fact; QA independently measured ~4.2 ms
    // and a 9.64 ms worst case on other hardware, which is the same conclusion
    // and a different number. Expect the range to move with the machine; the
    // claim holds decisively across all of it.
    //
    // NFR-01 requires at least 10x margin, and the repo's rule is that a single
    // measurement within 2x of a ceiling is not a guard at all: assert the
    // MARGIN, not merely the ceiling. At 50 ms this still sits ~7x above even
    // the worst reading either of us has seen, so it discriminates a real
    // regression without flaking on a loaded runner.
    expect(best).toBeLessThan(CEILING_MS / 10)
  })

  it('scales linearly in incidences, not quadratically', () => {
    // The shape claim behind the margin above. Doubling the row count should
    // roughly double the work; a quadratic implementation would quadruple it.
    function timed(rows: number, salt: number): number {
      const list: ObservationEntry[] = []
      for (let i = 0; i < rows; i += 1) list.push(obs(`sp${salt}-${i % 300}`, `S${salt}-${i % 2000}`))
      const index = buildCoverIndex(list, norm => `c-${norm}`)
      const all = [...index.bySpecies.keys()]
      const t0 = performance.now()
      greedyCover(index, all, new Set(), 5000)
      return performance.now() - t0
    }
    const small = Math.min(timed(20_000, 11), timed(20_000, 12), timed(20_000, 13))
    const large = Math.min(timed(40_000, 21), timed(40_000, 22), timed(40_000, 23))
    // Generous: linear is ~2x, quadratic would be ~4x. Anything under 3x
    // rejects the quadratic shape without flaking on a loaded runner.
    expect(large).toBeLessThan(Math.max(small, 0.5) * 3)
  })
})

// ── The passive reader's confirmation ─────────────────────────────────────────

describe('confirmExcludedNames (FR-35, the Calendar half)', () => {
  it('honours a published name only when every carrier is consulted', () => {
    const rows = [obs('Muscovy Duck', 'S1'), obs('Muscovy Duck', 'S2')]
    expect([...confirmExcludedNames(snapshot({}, ['S1', 'S2'], ['Muscovy Duck']), rows)])
      .toEqual(['Muscovy Duck'])
    // S2 is not in the ledger, so the species re-opens and COUNTS (FR-04) —
    // offline, with no taxonomy join and no network.
    expect([...confirmExcludedNames(snapshot({}, ['S1'], ['Muscovy Duck']), rows)]).toEqual([])
  })

  it('re-opens a published name when a NEW export adds a carrier (FR-25, offline)', () => {
    const snap = snapshot({}, ['S1'], ['Muscovy Duck'])
    expect([...confirmExcludedNames(snap, [obs('Muscovy Duck', 'S1')])]).toEqual(['Muscovy Duck'])
    expect([...confirmExcludedNames(snap, [obs('Muscovy Duck', 'S1'), obs('Muscovy Duck', 'S9')])]).toEqual([])
  })

  it('is a no-op with nothing published, so the Calendar is pre-feature exact', () => {
    expect(confirmExcludedNames(EMPTY_SNAPSHOT, [obs('Muscovy Duck', 'S1')]).size).toBe(0)
  })

  it('ignores non-countable rows, matching the surfaces that consume it', () => {
    const snap = snapshot({}, [], ['Gull sp.'])
    // A spuh has no carrier of its own to consult, so a published name that
    // somehow named one is simply confirmed rather than re-opened by its rows.
    expect([...confirmExcludedNames(snap, [obs('Gull sp.', 'S9')])]).toEqual(['Gull sp.'])
  })
})

// ── Guard-the-guard ───────────────────────────────────────────────────────────

describe('the escapee token is the one that does not count', () => {
  it("ESCAPEE_CATEGORY is 'X' and nothing else is special-cased", () => {
    expect(ESCAPEE_CATEGORY).toBe('X')
    // Every other single uppercase letter counts. A rewrite that added a second
    // excluded category, or that inverted the test, goes red here.
    for (let c = 65; c <= 90; c += 1) {
      const ch = String.fromCharCode(c)
      expect(tokenCounts(`${ch}|`)).toBe(ch !== 'X')
    }
  })
})
