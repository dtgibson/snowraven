// Unit tests for the pure activity module (color-coded-hotspots): the
// reduction contract and the two-window counts. The dual-transport parity
// rows live in hotspotActivity.parity.test.ts; the backend drives the same
// fixture from backend/tests/test_hotspot_activity.py.

import { describe, it, expect } from 'vitest'
import {
  HOTSPOT_ACTIVITY_LOC_ID_RE, reduceActivityRecords, computeActivityCounts,
} from './hotspotActivity'
import { isWithinWindow } from './nearbyLifers'
import fixture from './hotspotActivity.fixture.json'

describe('reduceActivityRecords', () => {
  it('reduces the fixture raw response to the pinned shape (dedupe keeps the greatest obsDt, first-seen order)', () => {
    expect(reduceActivityRecords(fixture.raw)).toEqual(fixture.reduced)
  })

  it('drops malformed rows AT REDUCTION, so they are absent from count30 too', () => {
    // The fixture's malformed rows (missing/empty speciesCode, non-string/
    // missing/empty obsDt, a non-object row) never reach the payload — the
    // count30 = species.length identity therefore already excludes them.
    const reduced = reduceActivityRecords(fixture.raw)
    expect(reduced.length).toBe(3)
    expect(reduced.some(s => s.speciesCode === 'rebnut')).toBe(false)
    expect(reduced.some(s => s.speciesCode === 'dowwoo')).toBe(false)
    expect(reduced.some(s => s.speciesCode === 'norfli')).toBe(false)
    expect(reduced.some(s => s.speciesCode === '')).toBe(false)
  })

  it('returns [] for a non-array body (nothing else from upstream crosses)', () => {
    expect(reduceActivityRecords({ error: 'nope' })).toEqual([])
    expect(reduceActivityRecords(null)).toEqual([])
    expect(reduceActivityRecords('[]')).toEqual([])
  })
})

describe('computeActivityCounts', () => {
  // A fixed "now" so the window edges are deterministic: 2026-08-24 12:00 local.
  const NOW = new Date(2026, 7, 24, 12, 0, 0).getTime()

  it('count30 is the species count; count7 the 7-day subset', () => {
    const species = [
      { speciesCode: 'a', obsDt: '2026-08-24 09:00' },  // today → in 7d
      { speciesCode: 'b', obsDt: '2026-08-20 06:00' },  // 4 days → in 7d
      { speciesCode: 'c', obsDt: '2026-08-01 05:00' },  // 23 days → 30d only
    ]
    expect(computeActivityCounts(species, NOW)).toEqual({ count30: 3, count7: 2 })
  })

  it('the 7-day boundary is the shared isWithinWindow semantics (inclusive, day-floored)', () => {
    // Exactly 7 days ago counts (inclusive); 8 days ago does not — and the
    // assertion is made THROUGH the shared predicate too, so a drift in either
    // direction (this module or nearbyLifers) breaks the parity.
    const exactly7 = '2026-08-17 23:59'
    const eightDays = '2026-08-16 00:01'
    expect(isWithinWindow(exactly7, 7, NOW)).toBe(true)
    expect(isWithinWindow(eightDays, 7, NOW)).toBe(false)
    expect(computeActivityCounts([{ speciesCode: 'a', obsDt: exactly7 }], NOW)).toEqual({ count30: 1, count7: 1 })
    expect(computeActivityCounts([{ speciesCode: 'a', obsDt: eightDays }], NOW)).toEqual({ count30: 1, count7: 0 })
  })

  it('a malformed obsDt that somehow reached the payload is excluded from count7 but present in count30', () => {
    // Reduction drops these before they reach a real payload (asserted above);
    // this pins the defensive behavior of the counting layer alone.
    expect(computeActivityCounts([{ speciesCode: 'a', obsDt: 'not-a-date' }], NOW)).toEqual({ count30: 1, count7: 0 })
  })

  it('count7 ≤ count30 over the fixture', () => {
    const counts = computeActivityCounts(reduceActivityRecords(fixture.raw), NOW)
    expect(counts.count7).toBeLessThanOrEqual(counts.count30)
    expect(counts.count30).toBe(3)
  })

  it('empty list → both zero (the "quiet" answer, FR-13)', () => {
    expect(computeActivityCounts([], NOW)).toEqual({ count30: 0, count7: 0 })
  })
})

describe('HOTSPOT_ACTIVITY_LOC_ID_RE', () => {
  it('agrees with every fixture validation row', () => {
    for (const row of fixture.locIdValidation) {
      expect(HOTSPOT_ACTIVITY_LOC_ID_RE.test(row.locId), JSON.stringify(row.locId)).toBe(row.valid)
    }
  })
})
