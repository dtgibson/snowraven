// The hotspot-share classification, the percentage pair and the view precedence
// (hotspot-share-stat, schema.md section 5 and the rules in section 12).
import { describe, it, expect } from 'vitest'
import {
  computeHotspotShare, sharePctPair, hotspotShareView, type HotspotShare, type ShareChecklist,
} from './hotspotShare'
import type { HotspotResolution, RegionResolution } from './hotspotSet'
import { fmtSharePct } from './statsFormat'
import { bestPerCallCpuMs } from '../test/cpuTiming'

/** A resolution snapshot as the hotspot module would publish it. */
function res(states: Record<string, RegionResolution>, ids: string[] = []): HotspotResolution {
  const byRegion = new Map(Object.entries(states))
  const vals = [...byRegion.values()]
  return {
    regions: [...byRegion.keys()],
    byRegion,
    set: new Set(ids),
    pending: vals.filter(v => v === 'pending').length,
    answered: vals.filter(v => v === 'answered').length,
    unanswered: vals.filter(v => v === 'unanswered').length,
  }
}
const cl = (locationId: string, stateProvince: string | null): ShareChecklist => ({ locationId, stateProvince })
const partition = (s: HotspotShare) => s.hotspot + s.personal + s.unclassified

describe('computeHotspotShare (QA-04 to QA-08, QA-19)', () => {
  const FIXTURES: Array<[string, ShareChecklist[], HotspotResolution]> = [
    ['mixed', [cl('L1', 'US-MN'), cl('L2', 'US-MN'), cl('L3', 'US-MN'), cl('L9', 'US-WI')],
      res({ 'US-MN': 'answered', 'US-WI': 'pending' }, ['L1', 'L2'])],
    ['all hotspot', [cl('L1', 'US-MN'), cl('L2', 'US-MN')], res({ 'US-MN': 'answered' }, ['L1', 'L2'])],
    ['none at hotspots', [cl('L5', 'US-MN'), cl('L6', 'US-MN')], res({ 'US-MN': 'answered' }, ['L1'])],
    ['unresolved', [cl('L1', 'US-MN'), cl('L2', 'US-WI'), cl('L3', null)], res({ 'US-MN': 'pending', 'US-WI': 'unanswered' })],
    // A stored entry past its TTL reads answered (schema.md 4.2), so it classifies.
    ['stale persisted', [cl('L1', 'US-MN'), cl('L4', 'US-MN')], res({ 'US-MN': 'answered' }, ['L1'])],
  ]

  it.each(FIXTURES)('QA-04: %s partitions the total', (_label, rows, r) => {
    const s = computeHotspotShare(rows, r)
    expect(partition(s)).toBe(s.total)
    expect(s.total).toBe(rows.length)
    expect(s.noRegion).toBeLessThanOrEqual(s.unclassified)
    expect(s.regionsPending + s.regionsUnanswered).toBeLessThanOrEqual(s.regionsTotal)
  })

  it('QA-05: two of three at hotspots in an answered region', () => {
    const s = computeHotspotShare([cl('L1', 'US-MN'), cl('L2', 'US-MN'), cl('L3', 'US-MN')], res({ 'US-MN': 'answered' }, ['L1', 'L2']))
    expect([s.hotspot, s.personal, s.unclassified]).toEqual([2, 1, 0])
  })

  it('QA-06: an id that fails the shape test is personal in an answered region; a shape-valid member is a hotspot', () => {
    const r = res({ 'US-MN': 'answered' }, ['L1'])
    expect(computeHotspotShare([cl('junk', 'US-MN')], r).personal).toBe(1)
    expect(computeHotspotShare([cl('L1', 'US-MN')], r).hotspot).toBe(1)
  })

  it('an id in the Set is a hotspot whatever its region reads; any other id waits on its region', () => {
    const r = res({ 'US-MN': 'pending', 'US-WI': 'unanswered' }, ['L1', 'L2'])
    const s = computeHotspotShare([cl('L1', 'US-MN'), cl('L2', 'US-WI'), cl('L3', 'US-MN'), cl('L4', 'US-WI')], r)
    expect([s.hotspot, s.personal, s.unclassified]).toEqual([2, 0, 2])
    expect([s.regionsPending, s.regionsUnanswered, s.regionsTotal]).toEqual([1, 1, 2])
  })

  it('QA-08: a region that answered with an empty list classifies its checklists personal, none unclassified', () => {
    const s = computeHotspotShare([cl('L1', 'US-ND'), cl('L2', 'US-ND')], res({ 'US-ND': 'answered' }))
    expect([s.hotspot, s.personal, s.unclassified]).toEqual([0, 2, 0])
  })

  it('a region absent from the snapshot (the first render) reads pending, never "no region code"', () => {
    const s = computeHotspotShare([cl('L1', 'US-MN')], res({}))
    expect([s.unclassified, s.noRegion, s.regionsPending]).toEqual([1, 0, 1])
  })

  it.each([null, '', 'us-mn', 'U'])('QA-19: a region cell of %j counts unclassified and noRegion, and adds no region', (code) => {
    const s = computeHotspotShare([cl('L1', code), cl('L2', 'US-MN')], res({ 'US-MN': 'answered' }, ['L2']))
    expect([s.unclassified, s.noRegion, s.regionsTotal, s.hotspot]).toEqual([1, 1, 1, 1])
  })

  it('k counts only never-answered regions, over the regions the checklists name', () => {
    // US-MN's refresh failed (it stays answered); US-WI never answered; US-ND is in
    // the snapshot but no checklist names it.
    const r = res({ 'US-MN': 'answered', 'US-WI': 'unanswered', 'US-ND': 'unanswered' }, ['L1'])
    const s = computeHotspotShare([cl('L1', 'US-MN'), cl('L5', 'US-WI')], r)
    expect([s.regionsUnanswered, s.regionsTotal]).toEqual([1, 2])
  })
})

describe('sharePctPair (QA-20 to QA-24, QA-34)', () => {
  it.each([
    [1234, 3300, '37%', '63%'],
    [5, 5, '100%', '0%'],
    [0, 5, '0%', '100%'],
    [1, 3, '33%', '67%'],
    [2, 3, '67%', '33%'],
    [1, 1000, '<1%', '>99%'],
    [999, 1000, '>99%', '<1%'],
  ])('%i of %i reads %s and %s', (h, m, hot, pers) => {
    const pair = sharePctPair(h, m)
    expect([pair.hotspot, pair.personal]).toEqual([hot, pers])
  })

  it('the ONE divergence from fmtSharePct: a lone 999 of 1,000 is "100%", the pair says ">99%" beside "<1%"', () => {
    expect(fmtSharePct(999, 1000)).toBe('100%')
    expect(sharePctPair(999, 1000).hotspot).toBe('>99%')
    for (const [h, m] of [[1, 1000], [0, 7], [7, 7], [1234, 3300]]) expect(sharePctPair(h, m).hotspot).toBe(fmtSharePct(h, m))
  })

  it('QA-23, QA-24, QA-34: over every (h, m) with m up to 400, exactly one displayed shape holds, and a nonzero count never reads "0%"', () => {
    let pairs = 0
    for (let m = 1; m <= 400; m += 1) {
      for (let h = 0; h <= m; h += 1) {
        pairs += 1
        const { hotspot: a, personal: b } = sharePctPair(h, m)
        // The three shapes are disjoint: two whole figures strictly between 0 and
        // 100 summing to 100, the sliver pair, or the 0 / 100 pair.
        const inner = (x: string) => /^\d+%$/.test(x) && parseInt(x, 10) > 0 && parseInt(x, 10) < 100
        const ints = inner(a) && inner(b) && parseInt(a, 10) + parseInt(b, 10) === 100
        const sliver = (a === '<1%' && b === '>99%') || (a === '>99%' && b === '<1%')
        const whole = (a === '0%' && b === '100%') || (a === '100%' && b === '0%')
        expect(Number(ints) + Number(sliver) + Number(whole), `${h} of ${m}: ${a} / ${b}`).toBe(1)
        if (h > 0) expect(a).not.toBe('0%')
        if (h < m) expect(b).not.toBe('0%')
      }
    }
    expect(pairs).toBe(400 * 401 / 2 + 400)
  })
})

describe('hotspotShareView precedence (QA-13 to QA-18, QA-37)', () => {
  const share = (over: Partial<HotspotShare>): HotspotShare => ({
    total: 10, hotspot: 4, personal: 3, unclassified: 3, noRegion: 0,
    regionsTotal: 2, regionsPending: 0, regionsUnanswered: 1, ...over,
  })
  const settled = share({ unclassified: 0, hotspot: 6, personal: 4, regionsUnanswered: 0 })

  it('no checklists hides the block whatever else holds', () => {
    expect(hotspotShareView(share({ total: 0, hotspot: 0, personal: 0, unclassified: 0 }), { hasEbirdKey: false, online: true }).kind).toBe('hidden')
  })
  it('QA-14: a known missing key beats every resolution state, a fully classified one included', () => {
    for (const s of [share({}), settled, share({ regionsPending: 1 })]) {
      expect(hotspotShareView(s, { hasEbirdKey: false, online: false }).kind).toBe('no-key')
    }
  })
  it('QA-16: an unknown key status reads pending, never a bar', () => {
    expect(hotspotShareView(settled, { hasEbirdKey: null, online: true }).kind).toBe('pending')
  })
  it('QA-37: fully classified is settled offline too, and beats a still-pending region', () => {
    expect(hotspotShareView(settled, { hasEbirdKey: true, online: false }).kind).toBe('settled')
    expect(hotspotShareView({ ...settled, regionsPending: 1 }, { hasEbirdKey: true, online: true }).kind).toBe('settled')
  })
  it('QA-15 / QA-17 / QA-18 / QA-19: pending, then offline, then unanswered, then no-region', () => {
    const k = { hasEbirdKey: true, online: true }
    expect(hotspotShareView(share({ regionsPending: 1 }), { ...k, online: false }).kind).toBe('pending')
    expect(hotspotShareView(share({}), { ...k, online: false }).kind).toBe('offline')
    expect(hotspotShareView(share({}), k)).toEqual({ kind: 'unanswered', k: 1, r: 2, u: 3, m: 10, h: 4, p: 3 })
    expect(hotspotShareView(share({ regionsUnanswered: 0, noRegion: 3 }), k).kind).toBe('no-region')
  })
  it('QA-20: the settled bar width is the UNROUNDED fraction', () => {
    const v = hotspotShareView(share({ total: 3300, hotspot: 1234, personal: 2066, unclassified: 0 }), { hasEbirdKey: true, online: true })
    expect(v.kind === 'settled' && v.hotspotWidthPct).toBeCloseTo(37.3939, 3)
  })
})

describe('the declared scan is linear (schema.md 7.1, QA-32)', () => {
  const REGIONS = ['US-MN', 'US-WI', 'US-ND', 'US-SD', 'US-IA', 'US-IL', 'US-MI', 'CA-ON', 'CA-MB', 'US']
  const snapshot = res(Object.fromEntries(REGIONS.map((r, i) => [r, i % 3 === 0 ? 'pending' : 'answered'])),
    Array.from({ length: 5_000 }, (_, i) => `L${i * 2 + 1}`))
  const realistic = (n: number): ShareChecklist[] =>
    Array.from({ length: n }, (_, i) => cl(`L${i % 10_000}`, REGIONS[i % REGIONS.length]))
  // Every row its own region key, so the per-distinct-region path runs at volume.
  const distinct = (n: number): ShareChecklist[] =>
    Array.from({ length: n }, (_, i) => cl(`L${i}`, `XX-${i.toString(36).toUpperCase()}`))
  // Hostile cells that fail each pattern only after consuming a long run. The region
  // cell opens with 'AA-' so REGION_RE's group takes the run before the lowercase
  // letter fails it; a bare run of 'A's fails at its third character, because the
  // group needs a literal '-', and measured neither scan (security I2). Built flat.
  const hostile = (len: number): ShareChecklist[] =>
    Array.from({ length: 200 }, () => cl(`L${'9'.repeat(len)}x`, ['AA-', 'A'.repeat(len), 'a'].join('')))

  it('doubling the rows (75k to 150k), and doubling every row\'s own region key, each cost about twice the CPU time', () => {
    const r75 = realistic(75_000), r150 = realistic(150_000)
    const d75 = distinct(75_000), d150 = distinct(150_000)
    let ok = true
    const { perCall: [a, b, c, d] } = bestPerCallCpuMs([
      () => { ok = computeHotspotShare(r75, snapshot).total === 75_000 && ok },
      () => { ok = computeHotspotShare(r150, snapshot).total === 150_000 && ok },
      () => { ok = computeHotspotShare(d75, snapshot).regionsTotal === 75_000 && ok },
      () => { ok = computeHotspotShare(d150, snapshot).regionsTotal === 150_000 && ok },
    ], { rounds: 7 })
    expect(ok).toBe(true)
    // Linear is 2; a scan nested inside the loop reads 4. 3 sits between.
    expect(b / a, `75k=${a.toFixed(3)}ms 150k=${b.toFixed(3)}ms CPU`).toBeLessThan(3)
    expect(d / c, `distinct 75k=${c.toFixed(3)}ms 150k=${d.toFixed(3)}ms CPU`).toBeLessThan(3)
  }, 60_000)

  it('cells that fail each pattern after a 20,000- and a 40,000-character run cost about twice, and classify as no-region', () => {
    const h20 = hostile(20_000), h40 = hostile(40_000)
    expect(computeHotspotShare(h40, snapshot).noRegion).toBe(200)
    const { perCall: [a, b] } = bestPerCallCpuMs([
      () => computeHotspotShare(h20, snapshot),
      () => computeHotspotShare(h40, snapshot),
    ], { rounds: 7 })
    expect(b / a, `20k=${a.toFixed(3)}ms 40k=${b.toFixed(3)}ms CPU`).toBeLessThan(3)
    // The location-id leg: a region that IS askable, so the id test runs too.
    const ids = (len: number) => Array.from({ length: 200 }, () => cl(`L${'9'.repeat(len)}x`, 'US-WI')) // answered
    const i20 = ids(20_000), i40 = ids(40_000)
    expect(computeHotspotShare(i40, snapshot).personal).toBe(200)
    const { perCall: [x, y] } = bestPerCallCpuMs([
      () => computeHotspotShare(i20, snapshot),
      () => computeHotspotShare(i40, snapshot),
    ], { rounds: 7 })
    expect(y / x, `id 20k=${x.toFixed(3)}ms 40k=${y.toFixed(3)}ms CPU`).toBeLessThan(3)
  }, 60_000)
})
