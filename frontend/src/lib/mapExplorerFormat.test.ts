/// <reference types="node" />
// tierColors must return per-tier TEXT tokens, not the literal 'white': the
// dark-theme target-chip fills lighten enough that white text fails AA, so each
// recency tier carries a theme-adaptive --sr-map-target-*-text token (F018).
// MEDIA_ICONS SVG strings must be aria-hidden so browse-mode screen readers
// don't hit unnamed images on the on-map chips (F045).
// recencyTier counts CALENDAR days on every day of the year, DST changes
// included (map-recency-dst-colors), and the screen-reader tier labels name the
// ranges the function actually draws.

import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { tierColors, MEDIA_ICONS, recencyTier } from './mapExplorerFormat'
// The test may import nearbyLifers; the SOURCE may not (nearbyLifers.ts already
// imports mapExplorerFormat.ts, so the reverse import would be a cycle).
import { isWithinWindow } from './nearbyLifers'
import type { RecencyTier } from './mapExplorerTypes'

describe('tierColors text tokens (F018)', () => {
  it('never returns the literal "white" — every tier uses a text token', () => {
    for (const tier of ['fresh', 'mid', 'old'] as const) {
      expect(tierColors(tier).text).not.toBe('white')
      expect(tierColors(tier).text).toMatch(/^var\(--sr-map-target-.+-text\)$/)
    }
  })

  it('pairs each fill with its same-tier text token', () => {
    expect(tierColors('fresh')).toEqual({ bg: 'var(--sr-map-target-fresh)', text: 'var(--sr-map-target-fresh-text)' })
    expect(tierColors('mid')).toEqual({ bg: 'var(--sr-map-target-mid)', text: 'var(--sr-map-target-mid-text)' })
    expect(tierColors('old')).toEqual({ bg: 'var(--sr-map-target-old)', text: 'var(--sr-map-target-old-text)' })
  })
})

describe('MEDIA_ICONS accessibility (F045)', () => {
  it('marks every media-type icon aria-hidden', () => {
    for (const svg of Object.values(MEDIA_ICONS)) {
      expect(svg).toContain('aria-hidden="true"')
    }
  })
})

/** "YYYY-MM-DD" for the local civil date `back` days before the local date of
 *  `nowMs`. Civil arithmetic through the Date component constructor, so the
 *  count is calendar days whatever the DST state of the span. */
function civilDaysBack(nowMs: number, back: number): string {
  const n = new Date(nowMs)
  const d = new Date(n.getFullYear(), n.getMonth(), n.getDate() - back)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

describe('recencyTier counts CALENDAR days across a DST change (map-recency-dst-colors)', () => {
  // Pinned to a zone that observes DST, because recencyTier reads the process's
  // local midnight. 2026-03-08 is the US spring-forward day (23 hours), so a span
  // from an earlier midnight to a later one that holds it is one hour short of a
  // whole number of days. The old floor lost that day; rounding does not.
  let savedTz: string | undefined
  beforeAll(() => { savedTz = process.env.TZ; process.env.TZ = 'America/Los_Angeles' })
  afterAll(() => { if (savedTz === undefined) delete process.env.TZ; else process.env.TZ = savedTz })
  afterEach(() => { vi.useRealTimers() })

  // Local noon on each pinned day, so the pin holds whatever the time of day.
  const SPRING_NOW = '2026-03-09T19:00:00Z'   // 12:00 PDT, the day after spring-forward
  const SPRING_LATE_NOW = '2026-03-24T19:00:00Z'   // 12:00 PDT, 16 days after it
  const FALL_NOW = '2026-11-02T20:00:00Z'   // 12:00 PST, the day after fall-back

  function pinNow(iso: string): void {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(iso))
  }

  it('the zone really is pinned (guards the guard: a UTC run would pass vacuously)', () => {
    expect(new Date(SPRING_NOW).getTimezoneOffset()).toBe(420)   // PDT, UTC-7
    expect(new Date('2026-03-07T20:00:00Z').getTimezoneOffset()).toBe(480)   // PST before the change
    expect(new Date(FALL_NOW).getTimezoneOffset()).toBe(480)   // PST after fall-back
    expect(new Date('2026-10-31T19:00:00Z').getTimezoneOffset()).toBe(420)   // PDT before it
  })

  it('the day after spring-forward: 7 days fresh, 8 mid (the floor read 8 as fresh), 15 mid, 16 old (the floor read 16 as mid)', () => {
    pinNow(SPRING_NOW)
    expect(recencyTier('2026-03-02 08:00')).toBe('fresh')   // 7 days back
    expect(recencyTier('2026-03-01 08:00')).toBe('mid')     // 8 days back
    expect(recencyTier('2026-02-22 08:00')).toBe('mid')     // 15 days back
    expect(recencyTier('2026-02-21 08:00')).toBe('old')     // 16 days back
  })

  it('16 days after spring-forward the mid/old edge still holds: 16 days back is old', () => {
    pinNow(SPRING_LATE_NOW)
    expect(recencyTier('2026-03-08 08:00')).toBe('old')     // 16 days back, the span holds the 23-hour day
  })

  it('fall-back is symmetric: a 25-hour day does not add a day either', () => {
    pinNow(FALL_NOW)
    expect(recencyTier('2026-10-26 08:00')).toBe('fresh')   // 7 days back
    expect(recencyTier('2026-10-25 08:00')).toBe('mid')     // 8 days back
    expect(recencyTier('2026-10-18 08:00')).toBe('mid')     // 15 days back
    expect(recencyTier('2026-10-17 08:00')).toBe('old')     // 16 days back
  })

  it('over every day of 2026 x 0 to 20 days back, the tier edges agree with isWithinWindow at 7 and 15', () => {
    // Structural: no expected column. 'fresh' is exactly "within the 7-day
    // window" and "not old" exactly "within the 15-day window", both read off
    // the shared isWithinWindow on the same date and the same instant.
    const mismatches: string[] = []
    const tiersSeen = new Set<RecencyTier>()
    let cells = 0
    let offWholeDay = 0   // cells whose midnight-to-midnight span is NOT a whole number of 24h
    vi.useFakeTimers({ toFake: ['Date'] })
    for (let day = 0; day < 365; day++) {
      vi.setSystemTime(new Date(2026, 0, 1 + day, 12))   // local noon
      const nowMs = Date.now()
      const todayMidnight = new Date(nowMs); todayMidnight.setHours(0, 0, 0, 0)
      for (let back = 0; back <= 20; back++) {
        const date = `${civilDaysBack(nowMs, back)} 08:00`
        const tier = recencyTier(date)
        tiersSeen.add(tier)
        cells++
        const [y, m, d] = date.split(' ')[0].split('-').map(Number)
        if ((todayMidnight.getTime() - new Date(y, m - 1, d).getTime()) % 86400000 !== 0) offWholeDay++
        const fresh = isWithinWindow(date, 7, nowMs)
        const notOld = isWithinWindow(date, 15, nowMs)
        if ((tier === 'fresh') !== fresh || (tier !== 'old') !== notOld) {
          mismatches.push(`${civilDaysBack(nowMs, 0)} back ${back}: tier ${tier}, within 7 ${fresh}, within 15 ${notOld}`)
        }
      }
    }
    expect(mismatches).toEqual([])
    // Not vacuous: every cell was checked, every tier occurred, and the corpus
    // really crosses the DST changes (spans that are not whole days exist).
    expect(cells).toBe(365 * 21)
    expect([...tiersSeen].sort()).toEqual(['fresh', 'mid', 'old'])
    expect(offWholeDay).toBeGreaterThan(0)
  })
})

/** Drop comment lines and block comments so a commented-out label cannot
 *  satisfy the scan. */
function stripComments(src: string): string {
  return src
    .split('\n')
    .filter(l => !/^\s*(\/\/|\*|\/\*|\{\/\*)/.test(l))
    .join('\n')
    .replace(/\/\*[\s\S]*?\*\//g, '')
}

const readSource = (rel: string): string =>
  stripComments(readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8'))

describe('the tier labels name the ranges recencyTier draws (map-recency-dst-colors)', () => {
  afterEach(() => { vi.useRealTimers() })

  // The ranges, read off the function itself rather than restated: probe 0 to 40
  // calendar days back from a pinned local noon.
  function tierRanges(): { freshMax: number; midMin: number; midMax: number; oldMin: number } {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 5, 15, 12))
    const nowMs = Date.now()
    const byTier: Record<RecencyTier, number[]> = { fresh: [], mid: [], old: [] }
    for (let back = 0; back <= 40; back++) byTier[recencyTier(civilDaysBack(nowMs, back))].push(back)
    vi.useRealTimers()
    return {
      freshMax: Math.max(...byTier.fresh),
      midMin: Math.min(...byTier.mid),
      midMax: Math.max(...byTier.mid),
      oldMin: Math.min(...byTier.old),
    }
  }

  // Every tier-label ternary in shipped source: `<x>tier === 'fresh' ? '<a>' :
  // <x>tier === 'mid' ? '<b>' : '<c>'`. The per-file count below is what makes a
  // site rewritten out of this shape go red instead of dropping out silently.
  const TIER_LABEL = /[\w.]*[tT]ier === 'fresh' \? '([^']*)' : [\w.]*[tT]ier === 'mid' \? '([^']*)' : '([^']*)'/g
  const SITES: [string, string, number][] = [
    ['the Targets in view and Nearby lifers in view lists (screen-reader labels)', '../components/MapExplorer.tsx', 2],
    ['the Media Targets popup', '../components/map/TargetMarkers.tsx', 1],
  ]

  it.each(SITES)('%s', (_label, rel, siteCount) => {
    const src = readSource(rel)
    const r = tierRanges()
    // The old tier's upper bound is the Map Explorer's widest Time Range window,
    // read from its own declaration rather than restated.
    const widest = Number(/const WINDOW_DAYS[^=]*=\s*\{[^}]*\ball:\s*(\d+)/.exec(readSource('../components/MapExplorer.tsx'))?.[1])
    expect(widest).toBeGreaterThan(r.oldMin)
    const numbers = (s: string) => (s.match(/\d+/g) ?? []).map(Number)
    const sites = [...src.matchAll(TIER_LABEL)]
    expect(sites).toHaveLength(siteCount)
    for (const [, fresh, mid, old] of sites) {
      expect(numbers(fresh)).toEqual([r.freshMax])
      expect(numbers(mid)).toEqual([r.midMin, r.midMax])
      expect(numbers(old)).toEqual([r.oldMin, widest])
    }
  })
})
