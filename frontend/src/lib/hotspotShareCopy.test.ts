// The "Checklists at hotspots" copy (hotspot-share-stat, QA-25 and the settled
// strings of QA-20 to QA-22). RULES over a GENERATED corpus, never a ban list: the
// corpus is every view the shipped `hotspotShareView` produces over a grid of
// shares, so a new state joins the sweep by being reachable. What this cannot see is
// a count-bearing string built inline in the component; HotspotShareBlock.test.tsx
// is the other half, rendering the real block and holding every text node to this
// module.
/// <reference types="node" />
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { HOTSPOT_REGION_TTL_MS } from './hotspotRegionCache'
import { hotspotShareView, sharePctPair, type HotspotShare, type HotspotShareView } from './hotspotShare'
import {
  hotspotShareSentences, HOTSPOT_SHARE_SUBLABEL, HOTSPOT_SHARE_NO_KEY, HOTSPOT_SHARE_ADD_KEY,
  HOTSPOT_SHARE_AT_HOTSPOTS, HOTSPOT_SHARE_AT_PERSONAL,
} from './hotspotShareCopy'

const COUNTS = [0, 1, 2, 1234]
const EM_DASH = '\u2014'

/** Every view reachable from a share whose parts are drawn from COUNTS. */
function corpus(): Array<{ view: HotspotShareView; strings: string[] }> {
  const out: Array<{ view: HotspotShareView; strings: string[] }> = []
  for (const h of COUNTS) for (const p of COUNTS) for (const u of COUNTS) {
    for (const noRegion of u === 0 ? [0] : [0, u]) {
      for (const regionsTotal of [1, 2, 1234]) for (const regionsPending of [0, 1]) for (const regionsUnanswered of [0, 1, 2]) {
        if (regionsPending + regionsUnanswered > regionsTotal) continue
        const share: HotspotShare = {
          total: h + p + u, hotspot: h, personal: p, unclassified: u, noRegion,
          regionsTotal, regionsPending, regionsUnanswered,
        }
        for (const online of [true, false]) for (const hasEbirdKey of [true, false, null]) {
          const view = hotspotShareView(share, { hasEbirdKey, online })
          out.push({ view, strings: hotspotShareSentences(view) })
        }
      }
    }
  }
  return out
}

describe('the copy corpus (QA-25)', () => {
  const all = corpus()
  const strings = [...new Set(all.flatMap(c => c.strings)), HOTSPOT_SHARE_SUBLABEL, HOTSPOT_SHARE_NO_KEY, HOTSPOT_SHARE_ADD_KEY]

  it('reaches every view kind, so the rules below are not vacuous', () => {
    expect(new Set(all.map(c => c.view.kind))).toEqual(new Set(['hidden', 'no-key', 'pending', 'offline', 'unanswered', 'no-region', 'settled']))
    expect(strings.length).toBeGreaterThan(200)
  })

  it('no count of one takes a plural noun', () => {
    const bad = strings.filter(s => /\b1 [a-z]+s\b/.test(s))
    expect(bad).toEqual([])
  })

  it('every count is formatted (1,234, never 1234) and no string carries an em dash', () => {
    expect(strings.filter(s => s.includes('1234'))).toEqual([])
    expect(strings.some(s => s.includes('1,234'))).toBe(true)
    expect(strings.filter(s => s.includes(EM_DASH))).toEqual([])
  })

  it('no status string carries a percentage; only the settled figures do', () => {
    for (const { view, strings: ss } of all) {
      if (view.kind !== 'settled') expect(ss.filter(s => s.includes('%'))).toEqual([])
    }
  })

  it('the hidden and no-key views produce no sentences of their own', () => {
    for (const { view, strings: ss } of all) if (view.kind === 'hidden' || view.kind === 'no-key') expect(ss).toEqual([])
  })
})

describe('the settled strings (QA-20 to QA-22, design-spec.md Content Notes)', () => {
  const settled = (h: number, m: number): string[] =>
    hotspotShareSentences({ kind: 'settled', h, p: m - h, m, pct: sharePctPair(h, m), hotspotWidthPct: h / m * 100 })

  it.each([
    [1234, 3300, ['37% at hotspots', '63% at personal locations', '1,234 of 3,300 checklists at hotspots, 2,066 at personal locations.']],
    [5, 5, ['100% at hotspots', '0% at personal locations', '5 of 5 checklists at hotspots, 0 at personal locations.']],
    [0, 5, ['0% at hotspots', '100% at personal locations', '0 of 5 checklists at hotspots, 5 at personal locations.']],
    [1, 1, ['100% at hotspots', '0% at personal locations', '1 of 1 checklist at hotspots, 0 at personal locations.']],
  ])('%i of %i', (h, m, expected) => {
    expect(settled(h, m)).toEqual(expected)
  })

  it('the figure labels are the module constants, so the block can split each figure at its first space', () => {
    const [a, b] = settled(3, 3300)
    expect(a).toBe(`<1% ${HOTSPOT_SHARE_AT_HOTSPOTS}`)
    expect(b).toBe(`>99% ${HOTSPOT_SHARE_AT_PERSONAL}`)
  })
})

describe('the status sentences (QA-15, QA-17 to QA-19, QA-37)', () => {
  it.each<[HotspotShareView, string[]]>([
    [{ kind: 'pending', u: 3, m: 10, h: 4, p: 3 },
      ['Checking which locations are public hotspots. 3 of 10 checklists not yet classified.', 'So far 4 at hotspots and 3 at personal locations.']],
    [{ kind: 'offline', u: 3, m: 10, h: 4, p: 3 },
      ['Offline, so 3 of 10 checklists could not be classified yet.', 'So far 4 at hotspots and 3 at personal locations.']],
    [{ kind: 'offline', u: 10, m: 10, h: 0, p: 0 }, ['Offline, so 10 of 10 checklists could not be classified yet.']],
    [{ kind: 'unanswered', k: 1, r: 2, u: 3, m: 10, h: 4, p: 3 },
      ['eBird did not answer for 1 of your 2 regions, so 3 of 10 checklists could not be classified.', 'So far 4 at hotspots and 3 at personal locations.']],
    [{ kind: 'no-region', u: 2, m: 12, h: 4, p: 6 },
      ['2 of 12 checklists carry no region code and could not be classified.', 'So far 4 at hotspots and 6 at personal locations.']],
    [{ kind: 'no-region', u: 1, m: 12, h: 5, p: 6 },
      ['1 of 12 checklists carries no region code and could not be classified.', 'So far 5 at hotspots and 6 at personal locations.']],
  ])('%j', (view, expected) => {
    expect(hotspotShareSentences(view)).toEqual(expected)
  })
})

describe('the Help sentence (QA-27, FR-18)', () => {
  const HELP = readFileSync(fileURLToPath(new URL('../../../docs/HELP.md', import.meta.url)), 'utf8')
  const start = HELP.indexOf('\n### Geographic Stats\n')
  const section = HELP.slice(start, HELP.indexOf('\n### ', start + 5))
  const sentences = section.split(/(?<=[.;])\s+/)

  it('Geographic Stats names the share, says it needs the eBird API key, and carries no em dash', () => {
    expect(start).toBeGreaterThan(-1)
    const naming = sentences.filter(s => /share bar/.test(s) && /public eBird hotspots/.test(s))
    expect(naming).toHaveLength(1)
    expect(section).toContain('it needs your eBird API key, because the export itself does not say which locations are hotspots.')
    expect(section).not.toContain(EM_DASH)
  })

  it('the stated refresh interval is the store\'s TTL, built from the constant', () => {
    const days = HOTSPOT_REGION_TTL_MS / (24 * 60 * 60 * 1000)
    const claim = sentences.filter(s => /remembers each region's answer/.test(s))
    expect(claim).toHaveLength(1)
    expect(claim[0]).toContain(`only after ${days} days`)
  })
})
