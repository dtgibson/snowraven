// The reader-side plausibility window on a TTL's stored time (ebird-request-economy,
// decisions.md D-03). The three stores that read through it carry their own
// edge rows (exoticProvenanceCache, hotspotRegionCache, countyCompletenessCache);
// this file pins the predicate itself, its replacement of the old one, and the
// two declarations of the 24 hours.
/// <reference types="node" />
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { STORED_TIME_MAX_FUTURE_MS, isWithinTtl } from './ttlWindow'
import { MAX_FUTURE_MS } from './icloud/icloudRecord'

const DAY = 86_400_000
const TTL = 30 * DAY
const NOW = 1_750_000_000_000

/** The predicate every store read before this change: fresh while the age is
 *  under the TTL, with no lower bound on the age. */
const before = (storedAt: number, now: number, ttl: number): boolean => now - storedAt < ttl

describe('isWithinTtl', () => {
  it('the window is 24 hours in milliseconds, the same number the iCloud records use', () => {
    // Two declarations of one number, compared to each other rather than each
    // restated (CLAUDE.md, guard quality v1.0.33).
    expect(STORED_TIME_MAX_FUTURE_MS).toBe(MAX_FUTURE_MS)
    expect(STORED_TIME_MAX_FUTURE_MS).toBe(DAY)
  })

  it('a stored time that is not a finite number is never honoured (the failure return first)', () => {
    for (const t of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      expect(isWithinTtl(t, NOW, TTL), String(t)).toBe(false)
    }
  })

  it('exactly 24 hours ahead is honoured; one millisecond past it is absent', () => {
    expect(isWithinTtl(NOW + STORED_TIME_MAX_FUTURE_MS, NOW, TTL)).toBe(true)
    expect(isWithinTtl(NOW + STORED_TIME_MAX_FUTURE_MS + 1, NOW, TTL)).toBe(false)
    expect(isWithinTtl(NOW + 365 * DAY, NOW, TTL)).toBe(false)
  })

  it('the TTL edge is unchanged: one millisecond short of it is honoured, the TTL itself is expired', () => {
    expect(isWithinTtl(NOW - TTL + 1, NOW, TTL)).toBe(true)
    expect(isWithinTtl(NOW - TTL, NOW, TTL)).toBe(false)
    expect(isWithinTtl(NOW, NOW, TTL)).toBe(true)
  })

  it('a negative or ancient stored time reads as expired, as it did before', () => {
    for (const t of [-1, -NOW, 0, 1, NOW - 10 * 365 * DAY]) {
      expect(isWithinTtl(t, NOW, TTL), String(t)).toBe(false)
      expect(before(t, NOW, TTL), String(t)).toBe(false)
    }
  })

  // CLAUDE.md, testing (v1.0.32): replacing a predicate owes its symmetric
  // difference in BOTH directions, measured over a generated corpus. The new
  // predicate is a narrowing, so the measured difference must be exactly the
  // stored times more than 24 hours ahead, and nothing may be newly honoured.
  it('replacing the old predicate: newly absent is exactly "more than 24 h ahead", newly honoured is empty', () => {
    const offsets: number[] = [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]
    // Every millisecond around the four edges, then a coarse sweep across
    // a year either side.
    for (const edge of [-STORED_TIME_MAX_FUTURE_MS, 0, TTL, -TTL]) {
      for (let d = -3; d <= 3; d += 1) offsets.push(edge + d)
    }
    for (let h = -24 * 400; h <= 24 * 400; h += 7) offsets.push(h * 3_600_000)
    const ttls = [1, 6 * 3_600_000, TTL, 365 * DAY]
    let newlyAbsent = 0
    let newlyHonoured = 0
    let unchangedHonoured = 0
    for (const ttl of ttls) {
      for (const age of offsets) {
        const stored = NOW - age
        const was = before(stored, NOW, ttl)
        const is = isWithinTtl(stored, NOW, ttl)
        if (is && !was) newlyHonoured += 1
        if (was && !is) {
          newlyAbsent += 1
          // ...and only for a time more than 24 h ahead of the clock.
          expect(age < -STORED_TIME_MAX_FUTURE_MS, `age ${age}, ttl ${ttl}`).toBe(true)
        }
        if (was && is) unchangedHonoured += 1
        if (age < -STORED_TIME_MAX_FUTURE_MS) expect(is, `age ${age}`).toBe(false)
      }
    }
    expect(newlyHonoured).toBe(0)
    // Non-vacuity: the corpus reaches both kept and dropped answers.
    expect(newlyAbsent).toBeGreaterThan(1000)
    expect(unchangedHonoured).toBeGreaterThan(100)
  })

  it('the module imports nothing, so it adds no edge to any graph it joins', () => {
    const src = readFileSync(new URL('./ttlWindow.ts', import.meta.url), 'utf8')
    const code = src.split('\n').filter(l => !l.trimStart().startsWith('//')).join('\n')
    // Positive leg first, so a stripped file cannot pass vacuously.
    expect(code).toContain('export function isWithinTtl')
    expect(code).not.toMatch(/^\s*import\b/m)
    expect(code).not.toMatch(/\bimport\(/)
    expect(code).not.toMatch(/\brequire\(/)
  })
})
