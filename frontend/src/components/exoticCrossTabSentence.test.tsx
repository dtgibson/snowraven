// @vitest-environment jsdom
//
// FR-33 / QA-38: every surface whose count reflects the escapee exclusion must
// carry an account of the rule. `COUNT_RULE_SENTENCE` renders on THREE surfaces
// (Calendar, Frivolous Lists, Multimedia documentation coverage) and, before
// this file, had zero coverage on any of them: gating the Multimedia copy to
// `{false && (` left all 2,475 tests passing.
//
// Each surface therefore gets a PAIR of assertions, because either half alone
// certifies a broken build:
//
//   - the sentence RENDERS when the exclusion is in force (the mutation above
//     turns this red), and
//   - it is ABSENT when nothing is excluded (a surface that hard-coded the
//     sentence would pass the first half while adding copy to every user who
//     has never run a check, which FR-26's "byte-identical to pre-feature"
//     forbids).
//
// The Calendar case deliberately drives the REAL passive hook through the REAL
// store rather than mocking `useProvenanceLookup`, so it also exercises
// `confirmExcludedNames` and would catch the hook being dropped from the tab
// entirely, not merely the JSX being gated off.

import { describe, it, expect, vi, afterEach, beforeEach, afterAll } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import type { ObservationEntry } from '../types'
import type { MLExportRow } from '../lib/parseMLExport'

// ── The one sentence, quoted here as a LITERAL on purpose ─────────────────────
// Importing the constant and asserting the DOM against it would pass even if the
// constant became the empty string. A literal is what pins the shipped words.
const SENTENCE = "Counts leave out forms that don't count toward a life list, including escapees."
// The escapee-free variant, added by report-as-countability. The two fixed-scope
// surfaces now render the rule UNCONDITIONALLY (the FORM exclusion is always in
// force there), so their "absent case" is no longer an absence: it is this
// sentence instead of the one above. Quoted as literals for the same reason.
const SENTENCE_NO_ESCAPEES = "Counts leave out forms that don't count toward a life list."
const ALWAYS_NOTE =
  'This figure always uses countable species, whichever way Count all forms is set.'

/** The rendered text of every `.sr-count-rule-note` on screen. The note now holds
 *  two sentences in one paragraph, so an exact `getByText` on either one alone
 *  matches nothing; asserting the whole paragraph is what pins the shipped words
 *  AND their order. */
function noteParagraphs(): string[] {
  return [...document.querySelectorAll('.sr-count-rule-note')].map(n => n.textContent ?? '')
}

// The store document a populated 30-day cache holds. `S1` is in the ledger, so
// `confirmExcludedNames` can confirm Muscovy Duck; every checklist carrying it
// has been consulted.
const POPULATED_STORE = {
  version: 1,
  checklists: { S1: 1_750_000_000_000 },
  order: ['S1'],
  species: { musduc: { seen: ['X|DNC'], n: 1, at: 1_750_000_000_000 } },
  speciesOrder: ['musduc'],
  excludedNames: ['Muscovy Duck'],
}

let storeDoc: unknown = null
let observations: ObservationEntry[] = []

const { getFilesStatus, loadEbird, getSetting } = vi.hoisted(() => ({
  getFilesStatus: vi.fn(),
  loadEbird: vi.fn(),
  getSetting: vi.fn(),
}))

vi.mock('../lib/storage', () => ({
  storage: {
    getFilesStatus,
    loadEbirdObservations: loadEbird,
    setSetting: vi.fn(async () => {}),
    getSetting,
  },
}))
vi.mock('../lib/observationsCache', () => ({ loadEbirdObservations: loadEbird }))

const { Calendar } = await import('./Calendar')
const { FrivolousListsSections } = await import('./FrivolousListsSections')
const { MediaStatsSections } = await import('./MediaStatsSections')
const { computeMediaStats } = await import('../lib/mediaStats')
const provenanceCache = await import('../lib/exoticProvenanceCache')

// recharts bundles @reduxjs/toolkit, whose autoBatch enhancer arms a 100 ms
// fallback timer when a chart mounts. MediaStatsSections mounts charts, so wait
// it out before this file's jsdom environment is torn down.
afterAll(() => new Promise((r) => setTimeout(r, 120)))

function obs(commonName: string, submissionId: string, date = '2025-03-14'): ObservationEntry {
  return {
    submissionId, commonName, scientificName: 'Sci name', date,
    location: 'West Pond', locationId: 'L1', latitude: null, longitude: null,
    county: 'Alameda', stateProvince: 'US-CA', count: 1,
    breedingCode: null, speciesComments: '', catalogIds: [],
  } as unknown as ObservationEntry
}

beforeEach(() => {
  storeDoc = null
  observations = [obs('American Robin', 'S1'), obs('Muscovy Duck', 'S1')]
  provenanceCache._resetProvenanceCacheForTests()
  getSetting.mockReset()
  getSetting.mockImplementation(async (key: string) =>
    (key === 'exotic-provenance-v1' ? storeDoc : null))
  getFilesStatus.mockReset()
  getFilesStatus.mockImplementation(async () => ({ ebird: { filename: 'x.csv', uploadedAt: '' }, ml: null }))
  loadEbird.mockReset()
  loadEbird.mockImplementation(async () => ({ text: '', observations }))
})
afterEach(cleanup)

// ── Calendar ──────────────────────────────────────────────────────────────────

describe('Calendar carries the rule sentence (FR-33, QA-38)', () => {
  it('renders it once the cache holds a confirmed exclusion', async () => {
    storeDoc = POPULATED_STORE
    render(<Calendar onGoToSettings={() => {}} filesVersion={0} />)
    expect(await screen.findByText(SENTENCE)).toBeTruthy()
  })

  it('does NOT render it when the cache has never been populated', async () => {
    storeDoc = null
    render(<Calendar onGoToSettings={() => {}} filesVersion={0} />)
    // Wait for the tab to reach its loaded state before asserting an absence,
    // so this cannot pass merely because nothing had rendered yet.
    expect(await screen.findByText(/Count all forms/)).toBeTruthy()
    expect(screen.queryByText(SENTENCE)).toBeNull()
  })

  it('does NOT render it when a published name cannot be confirmed offline', async () => {
    // The species is published as escapee-only, but the export carries a second
    // checklist that is NOT in the ledger, so the passive reader re-opens it
    // (FR-25) and the count no longer reflects the exclusion. The sentence must
    // follow the COUNT, not the published list.
    storeDoc = POPULATED_STORE
    observations = [obs('American Robin', 'S1'), obs('Muscovy Duck', 'S1'), obs('Muscovy Duck', 'S9')]
    render(<Calendar onGoToSettings={() => {}} filesVersion={0} />)
    expect(await screen.findByText(/Count all forms/)).toBeTruthy()
    expect(screen.queryByText(SENTENCE)).toBeNull()
  })
})

// ── Frivolous Lists ───────────────────────────────────────────────────────────

describe('Frivolous Lists carries the rule sentence (FR-33, FR-36, QA-38)', () => {
  const common = {
    observations: [obs('American Avocet', 'S1'), obs('Muscovy Duck', 'S1')],
    codeFor: () => undefined,
    hasEntryFor: () => true,
  }

  it('names escapees when the escapee exclusion is in force', () => {
    render(<FrivolousListsSections {...common} excludedNames={new Set(['Muscovy Duck'])} />)
    expect(noteParagraphs()).toEqual([`${SENTENCE} ${ALWAYS_NOTE}`])
  })

  it('still renders the rule with nothing excluded, minus the escapee clause', () => {
    // The pair's second half changed shape with report-as-countability and the
    // reason matters: this surface always applies the FORM exclusion, so a note
    // that vanished would leave a filtered count with no account of itself. What
    // must be absent is the escapee CLAIM, not the note.
    render(<FrivolousListsSections {...common} excludedNames={new Set()} />)
    // Non-vacuity: the section really did render.
    expect(screen.getByText('Avian American')).toBeTruthy()
    expect(noteParagraphs()).toEqual([`${SENTENCE_NO_ESCAPEES} ${ALWAYS_NOTE}`])
    expect(noteParagraphs()[0]).not.toMatch(/escapee/i)
  })
})

// ── Multimedia documentation coverage ─────────────────────────────────────────

describe('Media documentation coverage carries the rule sentence (FR-33, QA-38)', () => {
  const rows: MLExportRow[] = [{
    catalogId: '1', commonName: 'American Robin', scientificName: 'Turdus migratorius',
    format: 'Photo', date: '2024-05-01', location: 'Loc', county: null,
    latitude: null, longitude: null, caption: '', mediaNotes: '', observationDetails: '',
    ageSex: '', behaviors: '', time: '', year: 2024, month: 5, avgRating: null, numRatings: 0,
    checklistId: '',
  } as unknown as MLExportRow]
  const lifeList = new Set(['American Robin', 'Muscovy Duck'])
  const renderName = (n: string) => n

  it('names escapees when the coverage denominator reflects the exclusion', () => {
    const stats = computeMediaStats(rows, lifeList, new Set(['Muscovy Duck']))
    render(<MediaStatsSections stats={stats} renderName={renderName} escapeesExcluded />)
    expect(noteParagraphs()).toEqual([`${SENTENCE} ${ALWAYS_NOTE}`])
  })

  it('still renders the rule with nothing excluded, minus the escapee clause', () => {
    const stats = computeMediaStats(rows, lifeList)
    render(<MediaStatsSections stats={stats} renderName={renderName} escapeesExcluded={false} />)
    // Non-vacuity: the coverage block itself is present.
    expect(screen.getByText(/life-list species documented with media/)).toBeTruthy()
    expect(noteParagraphs()).toEqual([`${SENTENCE_NO_ESCAPEES} ${ALWAYS_NOTE}`])
    expect(noteParagraphs()[0]).not.toMatch(/escapee/i)
  })

  it('the prop really is what selects the variant, not the stats shape', () => {
    // Guard-the-guard for the pair above: with the SAME stats object, the escapee
    // clause appears or does not purely on the flag. Without this, a build that
    // had wired the flag to something unrelated could satisfy both halves by
    // coincidence of the fixtures.
    const stats = computeMediaStats(rows, lifeList, new Set(['Muscovy Duck']))
    const { rerender } = render(<MediaStatsSections stats={stats} renderName={renderName} escapeesExcluded={false} />)
    expect(noteParagraphs()).toEqual([`${SENTENCE_NO_ESCAPEES} ${ALWAYS_NOTE}`])
    rerender(<MediaStatsSections stats={stats} renderName={renderName} escapeesExcluded />)
    expect(noteParagraphs()).toEqual([`${SENTENCE} ${ALWAYS_NOTE}`])
  })

  it('the fixed-scope note is what a reader needs to explain the asymmetry', () => {
    // The Statistics header checkbox does NOT move this figure, and HELP.md used
    // to claim it moved everything. The on-screen sentence is the fix, so it is
    // pinned to the control's own label: renaming the control without renaming
    // this sentence would leave the reader hunting for a checkbox that is not
    // there.
    const stats = computeMediaStats(rows, lifeList)
    render(<MediaStatsSections stats={stats} renderName={renderName} escapeesExcluded={false} />)
    expect(noteParagraphs()[0]).toContain('Count all forms')
  })
})

// ── The sentence itself ───────────────────────────────────────────────────────

describe('the sentence is single-sourced and survives a fifth exclusion class', () => {
  it('the shipped constant is exactly the literal every surface is asserted against', async () => {
    // This is the one place the constant is compared to the literal. If they
    // ever diverge, THIS fails rather than the three surface pairs silently
    // going vacuous.
    const { COUNT_RULE_SENTENCE, COUNT_RULE_SENTENCE_NO_ESCAPEES, ALWAYS_COUNTABLE_NOTE } =
      await import('../lib/exoticCopy')
    expect(COUNT_RULE_SENTENCE).toBe(SENTENCE)
    expect(COUNT_RULE_SENTENCE_NO_ESCAPEES).toBe(SENTENCE_NO_ESCAPEES)
    expect(ALWAYS_COUNTABLE_NOTE).toBe(ALWAYS_NOTE)
  })

  it('the two rule sentences are one base plus an optional clause', () => {
    // They are GENERATED from a single source rather than written twice, so the
    // shared half cannot drift on the next edit. Asserting the relationship is
    // what pins that, rather than asserting two independent literals.
    expect(SENTENCE_NO_ESCAPEES.endsWith('.')).toBe(true)
    const base = SENTENCE_NO_ESCAPEES.slice(0, -1)
    expect(SENTENCE).toBe(`${base}, including escapees.`)
  })

  it('the fixed-scope note quotes the control label exactly', async () => {
    // Single-sourced from `COUNT_FORMS_TOGGLE_LABEL`, so a relabel updates the
    // sentence too. A hand-written copy of the label here would go stale silently.
    const { COUNT_FORMS_TOGGLE_LABEL } = await import('../lib/countabilityCopy')
    expect(ALWAYS_NOTE).toContain(COUNT_FORMS_TOGGLE_LABEL)
  })

  it('names the new class without enumerating the exclusion classes', () => {
    // FR-40: it must stay accurate with four classes in force and survive a
    // fifth, so it may not list them. A sentence that started enumerating would
    // break on the next class added, silently, in three places at once.
    expect(SENTENCE).toMatch(/including escapees/)
    expect(SENTENCE).not.toMatch(/spuh|slash|hybrid/i)
    expect(SENTENCE.includes('—')).toBe(false)
  })
})
