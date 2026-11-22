/// <reference types="node" />
// RECONCILIATION (family-rollups-and-tree FR-20, FR-21, NFR-14; QA-20, QA-21).
//
// For every region choice of a generated corpus, both Include Escapees states
// and all eight "has" media selections at all years, the tab's roster (every
// placed and unplaced species of the model) equals, as a set of names, the rows
// Life Lists' own `selectRows` produces at the same settings with Include
// Exotics on. Life Lists is composed exactly as its tab composes it (regional
// firsts and regional assets, the world asset map as presence). No total is
// typed in. A guard-the-guard leg removes one gate and must go red.

import { describe, it, expect } from 'vitest'
import { deriveFirstAssets, deriveFirstSightings, selectRows, type LifeListClassification, type MediaFormat } from './lifeLists'
import { deriveRegionAssets, deriveRegionIndex, regionAssets, regionFirsts, type RegionRef } from './lifeListsRegion'
import { deriveScope, deriveYearColumns, type ScopeBase } from './familyTreeScope'
import { buildFamilyModel, worldCounts, type FamilyModel, type MediaConstraints } from './familyTreeModel'
import { generateCorpus, readFamilyIndex, speciesNames } from '../test/familyTreeCorpus'

const INDEX = readFamilyIndex()
const { obs: OBS, ml: ML } = generateCorpus(11, speciesNames(INDEX))
const BASE: ScopeBase = {
  observations: OBS, mlRows: ML, firsts: deriveFirstSightings(OBS), index: deriveRegionIndex(OBS), columns: deriveYearColumns(OBS, ML),
}
const WORLD = worldCounts(INDEX, BASE.firsts)
const WORLD_ASSETS = deriveFirstAssets(ML)
const REGION_ASSETS = deriveRegionAssets(ML, BASE.index.join)
const REGIONS: (RegionRef | null)[] = [null, ...[...BASE.index.choices.countries, ...BASE.index.choices.states, ...BASE.index.choices.counties].map(c => c.region)]

// Escapees, as the passive reader would return them: a few roster names.
const ROSTER = [...BASE.firsts.keys()].sort()
const ESCAPEES = new Set([ROSTER[3], ROSTER[17], ROSTER[40]])
const CLASSIFICATION: LifeListClassification = { escapees: ESCAPEES, exotics: new Set([ROSTER[5]]) }

const FORMATS: MediaFormat[] = ['Photo', 'Audio', 'Video']
const SELECTIONS: MediaFormat[][] = []
for (let mask = 0; mask < 8; mask++) SELECTIONS.push(FORMATS.filter((_, i) => (mask >> i) & 1))

function media(sel: MediaFormat[]): MediaConstraints {
  return {
    photo: sel.includes('Photo') ? 'has' : 'any',
    audio: sel.includes('Audio') ? 'has' : 'any',
    video: sel.includes('Video') ? 'has' : 'any',
  }
}

function modelNames(m: FamilyModel): string[] {
  const out: string[] = []
  for (const o of m.orders) for (const f of o.families) for (const g of f.genera) for (const s of g.species) out.push(s.name)
  for (const u of m.unplaced) out.push(u.name)
  return out.sort()
}

function lifeListsNames(region: RegionRef | null, includeEscapees: boolean, sel: MediaFormat[]): string[] {
  const controls = { includeEscapees, includeExotics: true, formats: new Set(sel) }
  if (region === null) return selectRows(BASE.firsts, WORLD_ASSETS, CLASSIFICATION, controls).map(r => r.name).sort()
  const firsts = regionFirsts(BASE.index, region, OBS) ?? new Map()
  const assets = regionAssets(REGION_ASSETS, region, ML)
  return selectRows(firsts, assets, CLASSIFICATION, controls, WORLD_ASSETS).map(r => r.name).sort()
}

function tabNames(region: RegionRef | null, includeEscapees: boolean, sel: MediaFormat[], escapees: ReadonlySet<string> = ESCAPEES): string[] {
  return modelNames(buildFamilyModel({
    index: INDEX, world: WORLD, scope: deriveScope(BASE, region, null, null), firsts: BASE.firsts,
    escapees, includeEscapees, media: media(sel), mediaReadable: true, scopeFiltered: region !== null,
  }))
}

describe('the roster equals Life Lists at the same settings (QA-21)', () => {
  it('over every region, both switch states and all eight "has" selections', () => {
    let checked = 0
    let nonEmpty = 0
    for (const region of REGIONS) for (const inc of [false, true]) for (const sel of SELECTIONS) {
      const want = lifeListsNames(region, inc, sel)
      expect(tabNames(region, inc, sel), `${JSON.stringify(region)} esc=${inc} ${sel.join('+')}`).toEqual(want)
      checked += 1
      if (want.length > 0) nonEmpty += 1
    }
    expect(checked).toBe(REGIONS.length * 16)
    expect(nonEmpty).toBeGreaterThan(checked / 3)
  })

  it('guard the guard: with the escapee gate removed the comparison goes red', () => {
    const want = lifeListsNames(null, false, [])
    expect(tabNames(null, false, [], new Set())).not.toEqual(want)
  })
})

describe('the passive escapee read (QA-20)', () => {
  it('with Include Escapees off, exactly the reader\'s escapees on the roster are excluded; on, they return', () => {
    const off = new Set(tabNames(null, false, []))
    const on = new Set(tabNames(null, true, []))
    const removed = [...on].filter(n => !off.has(n)).sort()
    expect(removed).toEqual([...ESCAPEES].filter(n => BASE.firsts.has(n)).sort())
  })
  it('an empty classification excludes none', () => {
    expect(tabNames(null, false, [], new Set())).toEqual(tabNames(null, true, [], new Set()))
  })
  it('naturalized and provisional exotics always count', () => {
    expect(tabNames(null, false, [])).toContain(ROSTER[5])
  })
})
