/// <reference types="node" />
// The Family Tree model (family-rollups-and-tree schema section 6; QA-04,
// QA-24, QA-25, QA-27, QA-30, QA-33's model half, QA-36 to QA-40). FR-39's sum
// invariants are asserted as IDENTITIES over a generated corpus and a sampled
// control grid, never as typed-in totals (NFR-14); the world totals are read
// from the asset when the test runs.

import { describe, it, expect } from 'vitest'
import { deriveFirstSightings } from './lifeLists'
import { deriveRegionIndex, type RegionRef } from './lifeListsRegion'
import { deriveScope, deriveYearColumns, type ScopeBase } from './familyTreeScope'
import {
  EXPAND_CHUNK_SPECIES, NO_MEDIA_CONSTRAINTS, SORT_KEYS, buildFamilyModel, expandSteps, modelWork, sortFamilies, worldCounts,
  type FamilyModel, type KindState, type MediaConstraints, type ModelInput,
} from './familyTreeModel'
import { placeSequence } from './familyTreeAsset'
import { fullRosterModel, generateCorpus, obsRow, readFamilyIndex, speciesNames, mlRow } from '../test/familyTreeCorpus'
import type { ObservationEntry } from '../types'
import type { MLExportRow } from './parseMLExport'

const INDEX = readFamilyIndex()
const SPECIES = speciesNames(INDEX)

function baseOf(obs: readonly ObservationEntry[], ml: readonly MLExportRow[] | null): ScopeBase {
  return { observations: obs, mlRows: ml, firsts: deriveFirstSightings(obs), index: deriveRegionIndex(obs), columns: deriveYearColumns(obs, ml) }
}
function model(base: ScopeBase, over: Partial<ModelInput> & { region?: RegionRef | null; year?: number | null } = {}): FamilyModel {
  const region = over.region ?? null
  const year = over.year ?? null
  return buildFamilyModel({
    index: INDEX, world: worldCounts(INDEX, base.firsts), scope: deriveScope(base, region, year, null), firsts: base.firsts,
    escapees: new Set(), includeEscapees: false, media: NO_MEDIA_CONSTRAINTS, mediaReadable: base.mlRows !== null,
    scopeFiltered: region !== null || year !== null, ...over,
  })
}

const { obs: OBS, ml: ML } = generateCorpus(23, SPECIES)
const BASE = baseOf(OBS, ML)
const REGIONS: (RegionRef | null)[] = [null, ...[...BASE.index.choices.countries, ...BASE.index.choices.states].map(c => c.region)]
const STATES: KindState[] = ['any', 'has', 'lacks']
const MEDIA_GRID: MediaConstraints[] = []
for (const photo of STATES) for (const audio of STATES) for (const video of STATES) MEDIA_GRID.push({ photo, audio, video })

function identities(m: FamilyModel): string[] {
  const bad: string[] = []
  let famSum = 0
  for (const o of m.orders) {
    let oSum = 0
    for (const f of o.families) {
      let gSum = 0
      for (const g of f.genera) {
        if (g.seen !== g.species.length) bad.push(`genus ${g.genus} seen`)
        gSum += g.seen
      }
      if (f.seen !== gSum) bad.push(`family ${f.family} seen`)
      if (m.mediaShown && f.withKind !== null && f.items !== null) {
        for (let k = 0; k < 3; k++) {
          if (f.withKind[k] > f.seen) bad.push(`family ${f.family} withKind > seen`)
          if ((f.withKind[k] > 0) !== (f.items[k] > 0)) bad.push(`family ${f.family} withKind/items`)
        }
      }
      oSum += f.seen
    }
    if (o.seen !== oSum) bad.push(`order ${o.order} seen`)
    if (o.familiesSeen !== o.families.length) bad.push(`order ${o.order} familiesSeen`)
    famSum += oSum
  }
  if (famSum + m.unplaced.length !== m.seen.species) bad.push('families plus unplaced is not the species figure')
  if (m.seen.families !== m.orders.reduce((a, o) => a + o.families.length, 0)) bad.push('families seen')
  if (m.seen.orders !== m.orders.length) bad.push('orders seen')
  return bad
}

describe('the sum invariants (QA-39, FR-39)', () => {
  it('hold in every control state sampled across regions, years, every media state and both switch states', () => {
    let states = 0
    for (const region of REGIONS) for (const year of [null, BASE.columns.years[0], BASE.columns.years[2]]) {
      for (const media of MEDIA_GRID) for (const includeEscapees of [false, true]) {
        const m = model(BASE, { region, year, media, includeEscapees, escapees: new Set([SPECIES[0], SPECIES[5]]) })
        expect(identities(m), `${JSON.stringify(region)} ${year} ${JSON.stringify(media)}`).toEqual([])
        states += 1
      }
    }
    expect(states).toBe(REGIONS.length * 3 * 27 * 2)
  })
  it('with a single "has" constraint, each family\'s species seen equals its species with that kind', () => {
    for (const [k, key] of (['photo', 'audio', 'video'] as const).entries()) {
      const m = model(BASE, { media: { ...NO_MEDIA_CONSTRAINTS, [key]: 'has' } })
      for (const o of m.orders) for (const f of o.families) expect(f.withKind![k], `${key} ${f.family}`).toBe(f.seen)
      expect(m.unplaced.every(u => (u.kinds! >> k) & 1)).toBe(true)
    }
  })
})

describe('world counts (QA-04)', () => {
  it('are identical under every control state', () => {
    const ref = model(BASE)
    const worlds = (m: FamilyModel) => JSON.stringify([m.world, m.orders.map(o => [o.order, o.world, o.familiesWorld, o.families.map(f => [f.family, f.world])])])
    for (const region of REGIONS.slice(0, 4)) for (const media of MEDIA_GRID.slice(0, 9)) {
      const m = model(BASE, { region, media, includeEscapees: true })
      expect(m.world).toEqual(ref.world)
      for (const o of m.orders) for (const f of o.families) {
        const r = ref.orders.find(x => x.order === o.order)!.families.find(x => x.family === f.family)
        if (r) expect(f.world).toBe(r.world)
      }
    }
    expect(worlds(ref).length).toBeGreaterThan(100)
  })
  it('a family\'s world count is its living species plus its extinct species on the unfiltered roster', () => {
    const extinctSeq = INDEX.extinct.findIndex(x => x === 1)
    const name = SPECIES[extinctSeq]
    const fam = INDEX.speciesFamily[extinctSeq]
    const without = worldCounts(INDEX, baseOf([obsRow('Snow Goose', '2020-01-01', 'S1')], null).firsts)
    const withIt = worldCounts(INDEX, baseOf([obsRow(name, '2020-01-01', 'S1')], null).firsts)
    expect(without.perFamily[fam]).toBe(INDEX.families[fam].living)
    expect(withIt.perFamily[fam]).toBe(INDEX.families[fam].living + 1)
  })
  it('species seen never exceeds the world count, counting distinct asset species', () => {
    for (const region of REGIONS) {
      const m = model(BASE, { region, includeEscapees: true })
      for (const o of m.orders) for (const f of o.families) {
        const distinct = new Set(f.genera.flatMap(g => g.species.map(s => s.seq))).size
        expect(distinct, String(f.family)).toBeLessThanOrEqual(f.world)
      }
    }
  })
  it('an order\'s world count is the sum over its families', () => {
    const w = worldCounts(INDEX, BASE.firsts)
    for (let o = 0; o < INDEX.orders.length; o++) {
      let sum = 0
      for (let f = INDEX.orders[o].firstFamily; f < INDEX.orders[o].firstFamily + INDEX.orders[o].familyCount; f++) sum += w.perFamily[f]
      expect(w.perOrder[o]).toBe(sum)
    }
  })
})

describe('the headline (QA-36)', () => {
  it('the world totals are derived from the asset: species, and families and orders with a world count above zero', () => {
    const w = worldCounts(INDEX, new Map())
    let species = 0
    let families = 0
    const orders = new Set<number>()
    for (let f = 0; f < INDEX.families.length; f++) {
      species += INDEX.families[f].living
      if (INDEX.families[f].living > 0) { families += 1; orders.add(INDEX.families[f].order) }
    }
    expect(w.species).toBe(species)
    expect(w.families).toBe(families)
    expect(w.orders).toBe(orders.size)
    expect(families).toBeLessThan(INDEX.families.length)   // the asset has a wholly extinct family
  })
  it('a wholly extinct family counts in neither figure until the roster has a species of it, then in both', () => {
    const wholly = INDEX.families.findIndex(f => f.living === 0)
    const seq = INDEX.genera[INDEX.families[wholly].firstGenus].firstSpecies
    const none = model(baseOf([obsRow('Snow Goose', '2020-01-01', 'S1')], null))
    const one = model(baseOf([obsRow('Snow Goose', '2020-01-01', 'S1'), obsRow(SPECIES[seq], '2020-01-01', 'S1')], null))
    expect(one.world.families).toBe(none.world.families + 1)
    expect(one.seen.families).toBe(none.seen.families + 1)
  })
  it('the species figure is the full roster, unplaced species included', () => {
    const m = model(BASE, { includeEscapees: true })
    expect(m.seen.species).toBe(BASE.firsts.size)
    expect(m.unplaced.length).toBeGreaterThan(0)
  })
})

describe('placement (QA-24, QA-25, QA-27)', () => {
  it('prototype-member names are ordinary unplaced names and nothing throws', () => {
    const obs = ['constructor', '__proto__', 'toString', 'hasOwnProperty'].map((n, i) => obsRow(n, '2020-01-01', `S${i}`))
    const m = model(baseOf(obs, null))
    expect(m.orders).toEqual([])
    expect(m.unplaced.map(u => u.name).sort()).toEqual(['__proto__', 'constructor', 'hasOwnProperty', 'toString'])
  })
  it('a countable name the asset does not list is Not placed, counted in the species figure, in no family', () => {
    const m = model(baseOf([obsRow('Imaginary Warbler', '2020-01-01', 'S1'), obsRow('Snow Goose', '2020-01-01', 'S1')], null))
    expect(m.unplaced.map(u => u.name)).toEqual(['Imaginary Warbler'])
    expect(m.seen.species).toBe(2)
    expect(m.seen.families).toBe(1)
  })
  it('a name similar to a species is not attached to its family', () => {
    const m = model(baseOf([obsRow('Snow Goosee', '2020-01-01', 'S1')], null))
    expect(m.orders).toEqual([])
    expect(m.unplaced).toHaveLength(1)
  })
  it('a name over the placement key bound is unplaced with one length read', () => {
    expect(placeSequence(INDEX, 'Snow Goose' + ' '.repeat(200))).toBe(-1)
    expect(placeSequence(INDEX, 'snow goose')).toBeGreaterThanOrEqual(0)
  })
  it('genus and scientific name come from the taxonomy, never the backup; an unplaced species shows the backup binomial', () => {
    const obs = [
      obsRow('Snow Goose', '2020-01-01', 'S1', { scientificName: 'Chen caerulescens' }),
      obsRow('Imaginary Warbler', '2020-01-01', 'S1', { scientificName: 'Fictus imaginarius alpha' }),
    ]
    const m = model(baseOf(obs, null))
    const leaf = m.orders[0].families[0].genera[0].species[0]
    expect(INDEX.genera[m.orders[0].families[0].genera[0].genus].name).toBe('Anser')
    expect(leaf.sci).toBe('Anser caerulescens')
    expect(m.unplaced[0].sci).toBe('Fictus imaginarius')
  })
  it('two roster names differing only by case are two species on one asset species, as Life Lists lists them', () => {
    const m = model(baseOf([obsRow('Snow Goose', '2020-01-01', 'S1'), obsRow('SNOW GOOSE', '2020-01-01', 'S1')], null))
    expect(m.seen.species).toBe(2)
    expect(m.orders[0].families[0].genera[0].species.map(s => s.name)).toEqual(['Snow Goose', 'SNOW GOOSE'])
  })
})

describe('the media filter (QA-30)', () => {
  const obs = ['Snow Goose', "Ross's Goose", 'Canada Goose', 'Brant'].map((n, i) => obsRow(n, '2020-01-01', `S${i}`))
  const ml = [
    mlRow('Snow Goose', 'Photo', '2020-01-01', 'S0', 'M1'),
    mlRow('Snow Goose', 'Audio', '2020-01-01', 'S0', 'M2'),
    mlRow("Ross's Goose", 'Photo', '2020-01-01', 'S1', 'M3'),
    mlRow('Canada Goose', 'Audio', '2020-01-01', 'S2', 'M4'),
  ]
  const b = baseOf(obs, ml)
  const names = (m: FamilyModel) => m.orders.flatMap(o => o.families.flatMap(f => f.genera.flatMap(g => g.species.map(s => s.name)))).sort()
  it('has photo, lacks photo, has photo and lacks audio, and clearing every constraint', () => {
    expect(names(model(b, { media: { photo: 'has', audio: 'any', video: 'any' } }))).toEqual(["Ross's Goose", 'Snow Goose'])
    expect(names(model(b, { media: { photo: 'lacks', audio: 'any', video: 'any' } }))).toEqual(['Brant', 'Canada Goose'])
    expect(names(model(b, { media: { photo: 'has', audio: 'lacks', video: 'any' } }))).toEqual(["Ross's Goose"])
    expect(names(model(b))).toEqual(['Brant', 'Canada Goose', "Ross's Goose", 'Snow Goose'])
  })
  it('without a readable export the constraints do not apply and media figures are absent, not zero', () => {
    const m = model(baseOf(obs, null), { media: { photo: 'has', audio: 'any', video: 'any' } })
    expect(m.mediaShown).toBe(false)
    expect(names(m)).toHaveLength(4)
    expect(m.orders[0].families[0].withKind).toBeNull()
    expect(m.orders[0].families[0].genera[0].species[0].kinds).toBeNull()
  })
  it('species figures are identical with no export, an unreadable one and a readable one (QA-16)', () => {
    const a = model(baseOf(obs, null))
    const c = model(b)
    expect(a.seen).toEqual(c.seen)
    expect(a.orders.map(o => o.families.map(f => f.seen))).toEqual(c.orders.map(o => o.families.map(f => f.seen)))
  })
})

describe('the filtered flag (QA-38)', () => {
  it('is set exactly when Region, Year or a Media constraint is off its default', () => {
    expect(model(BASE).filtered).toBe(false)
    expect(model(BASE, { region: REGIONS[1] }).filtered).toBe(true)
    expect(model(BASE, { year: BASE.columns.years[0] }).filtered).toBe(true)
    expect(model(BASE, { media: { photo: 'lacks', audio: 'any', video: 'any' } }).filtered).toBe(true)
  })
})

describe('sorting (QA-40)', () => {
  const m = model(BASE)
  it('the default order is the asset\'s taxonomic sequence', () => {
    const fams = sortFamilies(m, INDEX, 'taxonomic').map(x => x.family.family)
    expect(fams).toEqual([...fams].sort((a, b) => a - b))
  })
  it('each key orders the families as specified, ties in taxonomic sequence', () => {
    for (const key of SORT_KEYS) {
      const list = sortFamilies(m, INDEX, key)
      for (let i = 1; i < list.length; i++) {
        const a = list[i - 1].family
        const b = list[i].family
        let c = 0
        if (key === 'name') c = INDEX.families[a.family].name.localeCompare(INDEX.families[b.family].name)
        else if (key === 'seen') c = b.seen - a.seen
        else if (key === 'share') c = b.seen * a.world - a.seen * b.world
        else if (key !== 'taxonomic') { const k = key === 'photo' ? 0 : key === 'audio' ? 1 : 2; c = b.withKind![k] - a.withKind![k] }
        expect(c < 0 || (c === 0 && a.family < b.family), `${key} at ${i}`).toBe(true)
      }
    }
  })
  it('shuffling the input rows yields the identical order', () => {
    const shuffled = [...OBS].reverse()
    const m2 = model(baseOf(shuffled, [...ML].reverse()))
    for (const key of SORT_KEYS) expect(sortFamilies(m2, INDEX, key).map(x => x.family.family), key).toEqual(sortFamilies(m, INDEX, key).map(x => x.family.family))
  })
})

describe('one build per change (QA-33, the model half)', () => {
  it('buildFamilyModel is counted once per call', () => {
    const before = modelWork.builds
    model(BASE)
    expect(modelWork.builds - before).toBe(1)
  })
})

describe('the table\'s Expand all plan (schema 9.2 as amended, D-43)', () => {
  const FULL = fullRosterModel(INDEX)
  const leaves = Array.from({ length: 160 }, (_, i) => ({ name: `Unplaced bird ${i}`, sci: '', seq: -1, kinds: null }))
  const WITH_UNPLACED: FamilyModel = { ...FULL, unplaced: leaves }
  it('over every species: exactly EXPAND_CHUNK_SPECIES rows a step but the last, counts never falling, taxonomic order, Not placed last', () => {
    const steps = expandSteps(WITH_UNPLACED)
    const total = WITH_UNPLACED.seen.species + leaves.length
    expect(EXPAND_CHUNK_SPECIES).toBe(75)
    expect(steps.length).toBe(Math.ceil(total / EXPAND_CHUNK_SPECIES))
    const famOrder = WITH_UNPLACED.orders.flatMap(o => o.families.map(f => f.family))
    const seen = new Map<number, number>()
    const order: number[] = []
    let rows = 0
    steps.forEach((step, si) => {
      let added = 0
      for (const [k, mounted, all] of step) {
        const before = seen.get(k) ?? 0
        expect(mounted).toBeGreaterThan(before)
        expect(mounted).toBeLessThanOrEqual(all)
        added += mounted - before
        seen.set(k, mounted)
        if (order.at(-1) !== k) order.push(k)
      }
      if (si < steps.length - 1) expect(added).toBe(EXPAND_CHUNK_SPECIES)
      else expect(added).toBeLessThanOrEqual(EXPAND_CHUNK_SPECIES)
      rows += added
    })
    expect(rows).toBe(total)
    expect(order).toEqual([...famOrder, -1])
    for (const o of WITH_UNPLACED.orders) for (const f of o.families) {
      expect(f.genera.reduce((t, g) => t + g.species.length, 0)).toBe(f.seen)
      expect(seen.get(f.family)).toBe(f.seen)
    }
    expect(seen.get(-1)).toBe(leaves.length)
    // A family larger than a step is split across steps.
    expect(steps.some(st => st.some(([, m, a]) => m < a))).toBe(true)
  })
  it('a key already open in full when the run starts is left out', () => {
    const first = FULL.orders[0].families[0].family
    const steps = expandSteps(FULL, EXPAND_CHUNK_SPECIES, -1, new Set([first]))
    expect(steps.flat().some(([k]) => k === first)).toBe(false)
  })
})
