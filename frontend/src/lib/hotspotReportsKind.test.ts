// A location's kind in three states (hotspot-reports schema section 5; FR-15 to
// FR-17, FR-27; QA-15, QA-16, QA-27).
//
// Two symmetric-difference obligations (schema 13.3): `kindOf` against the
// shipped `computeHotspotShare` (the oracle), and `kindReason` against the
// shipped `hotspotShareView`, which agree everywhere except two named,
// tabulated differences.

import { describe, it, expect } from 'vitest'
import { checklist } from '../test/hotspotReportsRows'
import { buildLocationIndex } from './hotspotReports'
import { kindOf, kindReason, kindSplitDrawn } from './hotspotReportsKind'
import { computeHotspotShare, hotspotShareView, type HotspotShare } from './hotspotShare'
import type { HotspotResolution, RegionResolution } from './hotspotSet'

function resolution(set: string[], byRegion: Record<string, RegionResolution>): HotspotResolution {
  const m = new Map(Object.entries(byRegion))
  let pending = 0, answered = 0
  for (const v of m.values()) { if (v === 'pending') pending++; else if (v === 'answered') answered++ }
  return { regions: [...m.keys()], byRegion: m, set: new Set(set), pending, answered, unanswered: m.size - pending - answered } as unknown as HotspotResolution
}

const index = buildLocationIndex([
  ...checklist({ submissionId: 'S1', locationId: 'L1', stateProvince: 'US-CA', species: ['A'] }),
  ...checklist({ submissionId: 'S2', locationId: 'L2', stateProvince: 'US-CA', species: ['A'] }),
  ...checklist({ submissionId: 'S3', locationId: 'L3', stateProvince: 'US-NV', species: ['A'] }),
  ...checklist({ submissionId: 'S4', locationId: 'L4', stateProvince: '', species: ['A'] }),
  ...checklist({ submissionId: 'S5', locationId: 'L5', stateProvince: `US-${'A'.repeat(14)}`, species: ['A'] }),
  ...checklist({ submissionId: 'S6', locationId: 'L6', stateProvince: 'US-UT', species: ['A'] }),
  ...checklist({ submissionId: 'S7', locationId: 'L7', stateProvince: 'US-AZ', species: ['A'] }),
])
const at = (id: string) => index.locations[index.ordById.get(id)!]

describe('three kinds, never personal without an answer (FR-15, FR-16, QA-15, QA-16)', () => {
  const res = resolution(['L1'], { 'US-CA': 'answered', 'US-NV': 'pending', 'US-UT': 'unanswered' })

  it('hotspot in the Set; personal in an answered region; otherwise not yet known', () => {
    expect(['L1', 'L2', 'L3', 'L4', 'L5', 'L6', 'L7'].map(id => kindOf(at(id), res))).toEqual(
      ['hotspot', 'personal', null, null, null, null, null],
    )
  })

  it('a 17-character State/Province cell is no region code, so the location is never personal', () => {
    expect(at('L5').stateProvince).toBeNull()
    expect(kindOf(at('L5'), resolution([], { [`US-${'A'.repeat(14)}`]: 'answered' }))).toBeNull()
  })

  it('summed over the locations, equals the shipped share run over one row per location', () => {
    for (const r of [res, resolution([], {}), resolution(['L1', 'L3'], { 'US-CA': 'answered', 'US-NV': 'answered', 'US-UT': 'answered', 'US-AZ': 'answered' })]) {
      const share = computeHotspotShare(index.locations, r)
      let h = 0, p = 0, u = 0
      for (const l of index.locations) {
        const k = kindOf(l, r)
        if (k === 'hotspot') h++; else if (k === 'personal') p++; else u++
      }
      expect([h, p, u]).toEqual([share.hotspot, share.personal, share.unclassified])
    }
  })

  it('with no key and nothing stored, no location is personal', () => {
    const none = resolution([], {})
    for (const l of index.locations) expect(kindOf(l, none)).not.toBe('personal')
  })
})

describe('the count block reason (FR-27, QA-27)', () => {
  function share(over: Partial<HotspotShare>): HotspotShare {
    return { total: 10, hotspot: 0, personal: 0, unclassified: 10, noRegion: 0, regionsTotal: 1, regionsPending: 0, regionsUnanswered: 0, ...over }
  }

  it('chooses no key, checking, offline, unanswered, then no region, in that precedence', () => {
    expect(kindReason(share({ regionsPending: 1, regionsUnanswered: 1 }), { hasEbirdKey: false, online: false })).toBe('no-key')
    expect(kindReason(share({}), { hasEbirdKey: null, online: true })).toBe('checking')
    expect(kindReason(share({ regionsPending: 1 }), { hasEbirdKey: true, online: false })).toBe('checking')
    expect(kindReason(share({ regionsUnanswered: 1 }), { hasEbirdKey: true, online: false })).toBe('offline')
    expect(kindReason(share({ regionsUnanswered: 1 }), { hasEbirdKey: true, online: true })).toBe('unanswered')
    expect(kindReason(share({ noRegion: 10 }), { hasEbirdKey: true, online: true })).toBe('no-region')
  })

  it('with nothing unclassified there is no reason at all, even with no key', () => {
    expect(kindReason(share({ hotspot: 4, personal: 6, unclassified: 0 }), { hasEbirdKey: false, online: true })).toBe('none')
  })

  it('draws the split only when something is classified', () => {
    expect(kindSplitDrawn(share({}))).toBe(false)
    expect(kindSplitDrawn(share({ hotspot: 0, personal: 1, unclassified: 9 }))).toBe(true)
    expect(kindSplitDrawn(share({ hotspot: 1, unclassified: 9 }))).toBe(true)
  })

  it('agrees with hotspotShareView everywhere except the two named differences', () => {
    const viewToReason: Record<string, string> = { 'no-key': 'no-key', pending: 'checking', offline: 'offline', unanswered: 'unanswered', 'no-region': 'no-region', settled: 'none' }
    let compared = 0
    const differences: string[] = []
    for (const hasEbirdKey of [true, false, null] as const) {
      for (const online of [true, false]) {
        for (const unclassified of [0, 3]) {
          for (const regionsPending of [0, 1]) {
            for (const regionsUnanswered of [0, 1]) {
              const s = share({ hotspot: 4, personal: 3 + (3 - unclassified), unclassified, regionsPending, regionsUnanswered, noRegion: unclassified })
              const mine = kindReason(s, { hasEbirdKey, online })
              const theirs = viewToReason[hotspotShareView(s, { hasEbirdKey, online }).kind]
              compared++
              if (mine !== theirs) differences.push(`${unclassified}:${hasEbirdKey}:${theirs}->${mine}`)
            }
          }
        }
      }
    }
    expect(compared).toBe(48)
    // Difference 1: nothing unclassified reads no reason, where Statistics reads
    // no-key (no key) or pending (unknown key status) first.
    for (const d of differences) expect(d.startsWith('0:false:no-key->none') || d.startsWith('0:null:checking->none')).toBe(true)
    expect(differences.length).toBe(16)
    // Difference 2 is presentational (the known figures are drawn with every
    // reason), which `kindSplitDrawn` carries and the component suite pins.
  })
})
