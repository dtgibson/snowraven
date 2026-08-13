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
    expect(await screen.findByText(/Count spuh, slash & hybrids/)).toBeTruthy()
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
    expect(await screen.findByText(/Count spuh, slash & hybrids/)).toBeTruthy()
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

  it('renders it when the exclusion is in force', () => {
    render(<FrivolousListsSections {...common} excludedNames={new Set(['Muscovy Duck'])} />)
    expect(screen.getByText(SENTENCE)).toBeTruthy()
  })

  it('does NOT render it with nothing excluded', () => {
    render(<FrivolousListsSections {...common} excludedNames={new Set()} />)
    // Non-vacuity: the section really did render, so the absence is meaningful.
    expect(screen.getByText('Avian American')).toBeTruthy()
    expect(screen.queryByText(SENTENCE)).toBeNull()
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

  it('renders it when the coverage denominator reflects the exclusion', () => {
    const stats = computeMediaStats(rows, lifeList, new Set(['Muscovy Duck']))
    render(<MediaStatsSections stats={stats} renderName={renderName} escapeesExcluded />)
    expect(screen.getByText(SENTENCE)).toBeTruthy()
  })

  it('does NOT render it with nothing excluded', () => {
    const stats = computeMediaStats(rows, lifeList)
    render(<MediaStatsSections stats={stats} renderName={renderName} escapeesExcluded={false} />)
    // Non-vacuity: the coverage block itself is present, so the absence is about
    // the sentence rather than about the section failing to render.
    expect(screen.getByText(/life-list species documented with media/)).toBeTruthy()
    expect(screen.queryByText(SENTENCE)).toBeNull()
  })

  it('the prop really is what gates it, not the stats shape', () => {
    // Guard-the-guard for the pair above: with the SAME stats object, the
    // sentence appears or does not purely on the flag. Without this, a build
    // that had wired the flag to something unrelated could still satisfy both
    // halves by coincidence of the fixtures.
    const stats = computeMediaStats(rows, lifeList, new Set(['Muscovy Duck']))
    const { rerender } = render(<MediaStatsSections stats={stats} renderName={renderName} escapeesExcluded={false} />)
    expect(screen.queryByText(SENTENCE)).toBeNull()
    rerender(<MediaStatsSections stats={stats} renderName={renderName} escapeesExcluded />)
    expect(screen.getByText(SENTENCE)).toBeTruthy()
  })
})

// ── The sentence itself ───────────────────────────────────────────────────────

describe('the sentence is single-sourced and survives a fifth exclusion class', () => {
  it('the shipped constant is exactly the literal every surface is asserted against', async () => {
    // This is the one place the constant is compared to the literal. If they
    // ever diverge, THIS fails rather than the three surface pairs silently
    // going vacuous.
    const { COUNT_RULE_SENTENCE } = await import('../lib/exoticCopy')
    expect(COUNT_RULE_SENTENCE).toBe(SENTENCE)
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
