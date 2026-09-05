// The escapee rule flowing to the surfaces that HEADLINE a life-list count
// (FR-34): Statistics totals and milestones, media documentation coverage,
// county Completeness, Calendar species counts, and Frivolous Lists.
//
// Since species-detail-escapee-toggle the rule also reaches ONE surface that
// lists species rather than headlining a count: the Species Detail selector and
// its "N species" figure, behind an off-by-default "Show escapees" switch. That
// layer is inline in the component (a filter over its display list, composed
// with its countable-form filter), so it has no pure function to drive here;
// `components/SpeciesDetailEscapees.test.tsx` covers it, including the
// empty-set no-op and the confirmation step, through the real passive hook.
//
// Two properties are asserted for every surface, because together they are what
// makes the feature safe to ship half-resolved:
//
//   - AN EMPTY SET IS A NO-OP. With the cache never populated, every number is
//     byte-identical to pre-feature (FR-26, QA-32). This is what lets the
//     exclusion be wired everywhere before anything has been resolved.
//   - THE RULE COMPOSES with each surface's existing countable-name predicate
//     and never replaces it (FR-05), preserving the raw-name versus
//     normalized-name convention at each call site.

import { describe, it, expect } from 'vitest'
import type { ObservationEntry } from '../types'
import {
  computeAccumulation, computeLifeList, computeTotals, computeChecklists,
  countableLifeList, filterObservations,
} from './birdingStats'
import { computeMediaStats } from './mediaStats'
import { buildCountyCompletenessLocal } from './countyCompleteness'
import { buildDayCells } from './calendar'
import { computeFrivolousLists } from './frivolousLists'
import { isNonCountableForm, isNonCountableNameShape, normalizeSpeciesName } from './speciesUtils'
import type { MLExportRow } from './parseMLExport'

const NONE: ReadonlySet<string> = new Set<string>()
const ESCAPEES: ReadonlySet<string> = new Set(['Graylag Goose', 'Swan Goose', 'Muscovy Duck'])

function o(commonName: string, submissionId: string, over: Partial<ObservationEntry> = {}): ObservationEntry {
  return {
    commonName,
    scientificName: 'Sci name',
    count: 1,
    submissionId,
    date: '2025-05-04',
    location: 'Somewhere',
    locationId: 'L1',
    latitude: 37,
    longitude: -122,
    county: 'Alameda',
    stateProvince: 'US-CA',
    time: '07:00 AM',
    ...over,
  } as ObservationEntry
}

// A miniature of the reference export: the three escapees, the anti-shortcut
// pair, and an ordinary species, spread over four checklists.
// Each row carries its own date so one lifer point corresponds to one species
// (`liferPoints` is keyed by date, and two firsts on one day collapse).
const OBS: ObservationEntry[] = [
  o('American Robin', 'S1', { date: '2025-01-01' }),
  o('Red Junglefowl', 'S1', { date: '2025-01-02' }),
  o('Indian Peafowl', 'S2', { date: '2025-02-01' }),
  o('Graylag Goose', 'S2', { date: '2025-02-02' }),
  o('Swan Goose', 'S3', { date: '2025-03-01' }),
  o('Muscovy Duck', 'S4', { date: '2025-04-01' }),
]

// ── Statistics: the headline total and the milestone series ───────────────────

describe('Statistics totals and milestones (FR-28, FR-30, QA-01, QA-02, QA-35)', () => {
  const filtered = filterObservations(OBS, false)
  const lifeList = computeLifeList(filtered)
  const checklists = computeChecklists(filtered)

  it('an empty set leaves the total byte-identical to pre-feature', () => {
    expect(countableLifeList(lifeList, NONE)).toBe(lifeList)      // same reference
    expect(countableLifeList(lifeList, NONE).length).toBe(computeTotals(checklists, lifeList).speciesCount)
  })

  it('the exclusion drops exactly the escapee-only species, and NOT the anti-shortcut pair', () => {
    const shown = countableLifeList(lifeList, ESCAPEES)
    expect(shown).toContain('Red Junglefowl')                     // eBird 'N', counts
    expect(shown).toContain('Indian Peafowl')                     // eBird 'P', counts
    expect(shown).not.toContain('Graylag Goose')
    expect(lifeList.length - shown.length).toBe(3)
  })

  it('the milestone series is produced BOTH ways from one pass, selected at read', () => {
    // NFR-02: the toggle is a read-time selector, never a memo input. With
    // nothing excluded the second series IS the first.
    const all = computeAccumulation(filtered, 'total')
    const countable = computeAccumulation(filtered, 'total', ESCAPEES)
    expect(all.liferPoints.length).toBe(6)
    expect(countable.liferPoints.length).toBe(3)
    expect(countable.liferPoints.map(p => p.species)).toEqual([
      'American Robin', 'Red Junglefowl', 'Indian Peafowl',
    ])
    // The Nth milestone is the Nth species that COUNTS: the excluded species
    // never appear in the series at all, and never occupy a milestone slot.
    for (const p of countable.liferPoints) expect(ESCAPEES.has(p.species)).toBe(false)
    expect(countable.firstSpecies?.name).toBe('American Robin')
  })

  it('the empty-set accumulation is identical to the pre-feature call', () => {
    const before = computeAccumulation(filtered, 'monthly')
    const after = computeAccumulation(filtered, 'monthly', NONE)
    expect(after.chartData).toEqual(before.chartData)
    expect(after.liferPoints).toEqual(before.liferPoints)
    expect([...after.milestones]).toEqual([...before.milestones])
  })
})

// ── Media documentation coverage ──────────────────────────────────────────────

describe('media documentation coverage (FR-34, QA-39)', () => {
  const rows: MLExportRow[] = [
    { commonName: 'American Robin', format: 'Photo' } as MLExportRow,
    { commonName: 'Muscovy Duck', format: 'Photo' } as MLExportRow,
  ]
  const lifeListNames = new Set(['American Robin', 'Muscovy Duck', 'Gull sp.'])

  it('the denominator already dropped non-countable names, and now drops escapees too', () => {
    // Composition, not replacement: the spuh was already out.
    expect(computeMediaStats(rows, lifeListNames).coverage!.lifeListTotal).toBe(2)
    expect(computeMediaStats(rows, lifeListNames, ESCAPEES).coverage!.lifeListTotal).toBe(1)
  })

  it('the NUMERATOR drops them too, so the percentage cannot exceed 100', () => {
    const c = computeMediaStats(rows, lifeListNames, ESCAPEES).coverage!
    expect(c.documented).toBe(1)
    expect(c.documented).toBeLessThanOrEqual(c.lifeListTotal)
  })

  it('an empty set is byte-identical to the pre-feature call', () => {
    expect(computeMediaStats(rows, lifeListNames, NONE)).toEqual(computeMediaStats(rows, lifeListNames))
  })
})

// ── County Completeness ───────────────────────────────────────────────────────

describe('county Completeness numerator (FR-37, QA-42)', () => {
  it('excludes escapee-only species from X and from the target-subtraction names', () => {
    const before = buildCountyCompletenessLocal(OBS)
    const after = buildCountyCompletenessLocal(OBS, ESCAPEES)
    const key = [...before.keys()][0]
    expect(before.get(key)!.countableCount).toBe(6)
    expect(after.get(key)!.countableCount).toBe(3)
    expect(after.get(key)!.countableNames).not.toContain('Muscovy Duck')
    expect(after.get(key)!.countableNames).toContain('Indian Peafowl')
  })

  it('an empty set is byte-identical to the pre-feature call', () => {
    expect(buildCountyCompletenessLocal(OBS, NONE)).toEqual(buildCountyCompletenessLocal(OBS))
  })
})

// ── Calendar ──────────────────────────────────────────────────────────────────

describe('Calendar species counts (FR-34, FR-35, QA-40)', () => {
  const view = { kind: 'year', year: 2025 } as const

  it('the COUNTABLE set drops escapees; the with-forms set is untouched', () => {
    const before = buildDayCells(OBS, view)
    const after = buildDayCells(OBS, view, undefined, ESCAPEES)
    const day = '2025-02-02'
    expect(before.get(day)!.speciesCount).toBe(1)                 // Graylag
    expect(after.get(day)!.speciesCount).toBe(0)                  // Graylag excluded
    expect(after.get('2025-02-01')!.speciesCount).toBe(1)         // Peafowl still counts
    // The with-forms metric is a different question and keeps its own answer.
    expect(after.get(day)!.speciesCountWithForms).toBe(before.get(day)!.speciesCountWithForms)
  })

  it('an empty set is byte-identical to the pre-feature call', () => {
    expect(buildDayCells(OBS, view, undefined, NONE)).toEqual(buildDayCells(OBS, view))
  })
})

// ── Frivolous Lists ───────────────────────────────────────────────────────────

describe('Frivolous Lists (FR-36, QA-41)', () => {
  const withAmericans: ObservationEntry[] = [
    ...OBS,
    o('American Avocet', 'S5'),
    o('American Bittern', 'S6'),
  ]

  it('applies the exclusion regardless of the toggle, matching its existing independence', () => {
    const before = computeFrivolousLists(withAmericans)
    const after = computeFrivolousLists(withAmericans, new Set(['American Avocet']))
    expect(after.avianAmerican.recorded).toBe(before.avianAmerican.recorded - 1)
    expect(before.avianAmerican.recorded).toBe(3)   // Robin, Avocet, Bittern
    expect(after.avianAmerican.total).toBe(before.avianAmerican.total)
  })

  it('an empty set is byte-identical to the pre-feature call', () => {
    expect(computeFrivolousLists(withAmericans, NONE)).toEqual(computeFrivolousLists(withAmericans))
  })
})

// ── The predicates the rule composes with are unchanged ───────────────────────

describe('the countable-form predicate the rule composes with (FR-05, QA-09)', () => {
  it('classifies every shape the escapee rule sits beside', () => {
    // The escapee rule is a SECOND predicate on the same value. If this one moved
    // unnoticed, a surface would silently change what it counts for a reason that
    // has nothing to do with exotics.
    //
    // This block used to assert that THREE predicates were untouched. The
    // countability build replaced all three with one rule taking one input, so what
    // is pinned now is that rule's answers, plus the FALLBACK it degrades to, plus
    // the two cases where the two disagree.
    const raw = [
      'Gull sp.', 'Greater/Lesser Scaup', 'Mallard x American Black Duck',
      'American Robin', "Yellow-rumped Warbler (Myrtle x Audubon's)",
      'Mallard (Domestic type)', "Xantus's Hummingbird",
    ]
    expect(raw.map(isNonCountableForm)).toEqual([true, true, true, false, false, false, false])
    // On these seven the convention agrees with eBird, which is why the fallback is
    // safe for a name eBird does not publish.
    expect(raw.map(isNonCountableNameShape)).toEqual([true, true, true, false, false, false, false])

    // The two names where they DISAGREE, stated on their own so they cannot be lost
    // in an array. These are what make the rule more than a rename.
    const admitted = 'Canada Goose (moffitti/maxima)'
    expect(isNonCountableNameShape(admitted)).toBe(true)   // shape rejects it
    expect(isNonCountableForm(admitted)).toBe(false)       // eBird counts it

    const rejected = "Brewster's Warbler (hybrid)"
    expect(isNonCountableNameShape(rejected)).toBe(false)  // shape counts it
    expect(isNonCountableForm(rejected)).toBe(true)        // eBird does not
  })

  it('normalizing the input first would lose the direction-B forms', () => {
    // Why the rule takes the RAW exported name. Normalization destroys the form,
    // and the form is the whole question: "Brewster's Warbler" reads exactly like a
    // species and no rule can tell it from one. Passing `norm` at a call site
    // holding a raw name is the mistake this pins.
    const rejected = "Brewster's Warbler (hybrid)"
    expect(isNonCountableForm(rejected)).toBe(true)
    expect(isNonCountableForm(normalizeSpeciesName(rejected))).toBe(false)
  })

  it('the cover path passes the RAW name, matching filterObservations', () => {
    // A surface holding a raw CSV name must pass it through unnormalized. The
    // intergrade would be erased outright by a normalized " x " test when it is a
    // birder's only record of that species; the direction-B hybrid would be
    // wrongly counted. One fixture for each direction.
    const intergrade = o("Yellow-rumped Warbler (Myrtle x Audubon's)", 'S1')
    expect(filterObservations([intergrade], false)).toHaveLength(1)
    const namedHybrid = o("Brewster's Warbler (hybrid)", 'S2')
    expect(filterObservations([namedHybrid], false)).toHaveLength(0)
  })
})
