import { describe, it, expect } from 'vitest'
import type { ChecklistRowData } from './checklistsTab'
import type { ChecklistEntry } from '../types'
import {
  computeBacklog,
  pageBacklog,
  isIncidental,
  hasNoWeatherBlock,
  INCIDENTAL_PROTOCOL,
  PAGE_SIZE,
} from './weatherBacklog'

// ── Fixture builders ─────────────────────────────────────────────────────────
// Use P## PROTOCOL CODES in fixtures (P20 Incidental, P21 Stationary, P22
// Traveling), matching real MyEBirdData exports and the shipped Checklists.tsx
// consumer — NOT display strings. (schema.md §1 fixture note.)

function makeChecklist(over: Partial<ChecklistEntry> = {}): ChecklistEntry {
  return {
    submissionId: 'S1',
    date: '2026-06-01',
    location: 'Point Reyes NS',
    locationId: 'L100',
    latitude: 38, longitude: -122,
    county: 'Marin', stateProvince: 'US-CA',
    time: '07:30 AM',
    duration: 60, distance: 2, area: null,
    protocol: 'P22', // Traveling
    numObservers: 1,
    allObsReported: true,
    checklistComments: '',
    speciesCount: 20, individualCount: 40,
    ...over,
  }
}

function makeRow(over: Partial<ChecklistEntry> = {}, weatherBlock = false): ChecklistRowData {
  return {
    checklist: makeChecklist(over),
    commentFull: '', commentStripped: '',
    hasSpeciesComments: false, hasAnyMedia: false,
    mediaFormats: new Set(), hasBreeding: false,
    weatherBlock,
    tideBlock: false,
  }
}

describe('constants', () => {
  it('INCIDENTAL_PROTOCOL is the verified P20 code', () => {
    expect(INCIDENTAL_PROTOCOL).toBe('P20')
  })
  it('PAGE_SIZE is 100', () => {
    expect(PAGE_SIZE).toBe(100)
  })
})

describe('isIncidental', () => {
  it('is true only for the P20 protocol code', () => {
    expect(isIncidental(makeChecklist({ protocol: 'P20' }))).toBe(true)
    expect(isIncidental(makeChecklist({ protocol: 'P22' }))).toBe(false)
    expect(isIncidental(makeChecklist({ protocol: 'P21' }))).toBe(false)
  })
  it('treats a null protocol as non-incidental', () => {
    expect(isIncidental(makeChecklist({ protocol: null }))).toBe(false)
  })
})

describe('hasNoWeatherBlock', () => {
  it('is true only when the precomputed weatherBlock flag is false', () => {
    expect(hasNoWeatherBlock(makeRow({}, false))).toBe(true)
    expect(hasNoWeatherBlock(makeRow({}, true))).toBe(false)
  })
})

describe('computeBacklog — predicate (FR-05/06, QA-05)', () => {
  it('excludes rows that carry any recognized weather block (SnowRaven or RainCrow), includes rows with none', () => {
    const rows = [
      makeRow({ submissionId: 'S1' }, false), // no block → included
      makeRow({ submissionId: 'S2' }, true),  // has a (SnowRaven/RainCrow) block → excluded
    ]
    const out = computeBacklog(rows, { includeWidened: false })
    expect(out.map(b => b.row.checklist.submissionId)).toEqual(['S1'])
  })
})

describe('computeBacklog — default filter (FR-07, QA-06)', () => {
  it('keeps only complete && non-incidental; drops incomplete and P20 rows', () => {
    const rows = [
      makeRow({ submissionId: 'S1', allObsReported: true, protocol: 'P22' }),  // kept
      makeRow({ submissionId: 'S2', allObsReported: false, protocol: 'P22' }), // incomplete → dropped
      makeRow({ submissionId: 'S3', allObsReported: true, protocol: 'P20' }),  // incidental → dropped
    ]
    const out = computeBacklog(rows, { includeWidened: false })
    expect(out.map(b => b.row.checklist.submissionId)).toEqual(['S1'])
  })

  it('a null protocol with a complete flag stays in the default view (non-incidental)', () => {
    const rows = [makeRow({ submissionId: 'S1', allObsReported: true, protocol: null })]
    const out = computeBacklog(rows, { includeWidened: false })
    expect(out.map(b => b.row.checklist.submissionId)).toEqual(['S1'])
  })
})

describe('computeBacklog — unknown-complete (FR-08, QA-07)', () => {
  it('allObsReported === null is absent by default, present when widened', () => {
    const rows = [makeRow({ submissionId: 'S1', allObsReported: null, protocol: 'P22' })]
    expect(computeBacklog(rows, { includeWidened: false })).toHaveLength(0)
    const widened = computeBacklog(rows, { includeWidened: true })
    expect(widened.map(b => b.row.checklist.submissionId)).toEqual(['S1'])
    expect(widened[0].isComplete).toBe(false)
    expect(widened[0].surfacedByWiden).toBe(true)
  })
})

describe('computeBacklog — ordering (FR-09, QA-08)', () => {
  it('orders newest-first by date descending', () => {
    const rows = [
      makeRow({ submissionId: 'S1', date: '2026-01-01' }),
      makeRow({ submissionId: 'S2', date: '2026-06-15' }),
      makeRow({ submissionId: 'S3', date: '2026-03-10' }),
    ]
    const out = computeBacklog(rows, { includeWidened: false })
    expect(out.map(b => b.row.checklist.date)).toEqual(['2026-06-15', '2026-03-10', '2026-01-01'])
  })

  it('breaks a same-date tie deterministically by submissionId descending, repeatable across calls', () => {
    const rows = [
      makeRow({ submissionId: 'S100', date: '2026-06-01' }),
      makeRow({ submissionId: 'S300', date: '2026-06-01' }),
      makeRow({ submissionId: 'S200', date: '2026-06-01' }),
    ]
    const a = computeBacklog(rows, { includeWidened: false }).map(b => b.row.checklist.submissionId)
    const b = computeBacklog([...rows].reverse(), { includeWidened: false }).map(x => x.row.checklist.submissionId)
    expect(a).toEqual(['S300', 'S200', 'S100'])
    expect(b).toEqual(a) // input order does not affect the result
  })
})

describe('computeBacklog — one row per id (FR-10, QA-09)', () => {
  it('produces no duplicate submission ids', () => {
    const rows = [
      makeRow({ submissionId: 'S1', date: '2026-06-01' }),
      makeRow({ submissionId: 'S2', date: '2026-06-02' }),
      makeRow({ submissionId: 'S3', date: '2026-06-03' }),
    ]
    const ids = computeBacklog(rows, { includeWidened: false }).map(b => b.row.checklist.submissionId)
    expect(new Set(ids).size).toBe(ids.length)
  })
})

describe('computeBacklog — widen is a superset (FR-21, QA-23)', () => {
  it('the on-set ⊇ the off-set: incidental + incomplete added, nothing removed', () => {
    const rows = [
      makeRow({ submissionId: 'S1', allObsReported: true, protocol: 'P22' }),  // in both
      makeRow({ submissionId: 'S2', allObsReported: false, protocol: 'P22' }), // widen-only (incomplete)
      makeRow({ submissionId: 'S3', allObsReported: true, protocol: 'P20' }),  // widen-only (incidental)
    ]
    const off = new Set(computeBacklog(rows, { includeWidened: false }).map(b => b.row.checklist.submissionId))
    const on = new Set(computeBacklog(rows, { includeWidened: true }).map(b => b.row.checklist.submissionId))
    expect(off).toEqual(new Set(['S1']))
    expect(on).toEqual(new Set(['S1', 'S2', 'S3']))
    for (const id of off) expect(on.has(id)).toBe(true) // superset
  })
})

describe('computeBacklog — flags (FR-14)', () => {
  it('sets isComplete / isIncidental / surfacedByWiden correctly', () => {
    const rows = [
      makeRow({ submissionId: 'S1', allObsReported: true, protocol: 'P22' }),
      makeRow({ submissionId: 'S2', allObsReported: false, protocol: 'P22' }),
      makeRow({ submissionId: 'S3', allObsReported: true, protocol: 'P20' }),
    ]
    const byId = new Map(
      computeBacklog(rows, { includeWidened: true }).map(b => [b.row.checklist.submissionId, b]),
    )
    expect(byId.get('S1')).toMatchObject({ isComplete: true, isIncidental: false, surfacedByWiden: false })
    expect(byId.get('S2')).toMatchObject({ isComplete: false, isIncidental: false, surfacedByWiden: true })
    expect(byId.get('S3')).toMatchObject({ isComplete: true, isIncidental: true, surfacedByWiden: true })
  })
})

describe('pageBacklog — slicing (FR-20, QA-19/20/21)', () => {
  const many = Array.from({ length: 250 }, (_, i) =>
    makeRow({ submissionId: `S${1000 + i}`, date: '2026-06-01' }))
  const all = computeBacklog(many, { includeWidened: false })

  it('slices to `shown` and reports hasMore + nextCount', () => {
    const p1 = pageBacklog(all, PAGE_SIZE)
    expect(p1.visible).toHaveLength(100)
    expect(p1.total).toBe(250)
    expect(p1.hasMore).toBe(true)
    expect(p1.nextCount).toBe(200)

    const p2 = pageBacklog(all, 200)
    expect(p2.visible).toHaveLength(200)
    expect(p2.hasMore).toBe(true)
    expect(p2.nextCount).toBe(250) // capped at total

    const p3 = pageBacklog(all, 250)
    expect(p3.visible).toHaveLength(250)
    expect(p3.hasMore).toBe(false)
    expect(p3.nextCount).toBe(250)
  })

  it('≤100 matches → no more, all shown, nextCount capped', () => {
    const few = computeBacklog(
      Array.from({ length: 40 }, (_, i) => makeRow({ submissionId: `S${i}` , date: '2026-06-01' })),
      { includeWidened: false },
    )
    const p = pageBacklog(few, PAGE_SIZE)
    expect(p.visible).toHaveLength(40)
    expect(p.total).toBe(40)
    expect(p.hasMore).toBe(false)
    expect(p.nextCount).toBe(40)
  })

  it('clamps a shown count larger than the total', () => {
    const p = pageBacklog(all, 9999)
    expect(p.visible).toHaveLength(250)
    expect(p.hasMore).toBe(false)
  })
})
