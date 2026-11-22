// The family asset generator's pure core, driven over small IN-MEMORY fixture
// responses (family-rollups-and-tree, schema 3.1 to 3.5; QA-01, QA-02, QA-03,
// QA-92, QA-93's fixture rows, QA-102's lists half). No network and no real
// eBird download: every taxon below is written here, shaped like eBird's
// `ref/taxonomy/ebird` rows (the field names, the categories, the extinct
// marker exactly as eBird sends it: `extinct: true` and `extinctYear`, both
// absent otherwise). The committed asset is held by familiesAsset.test.ts.
//
// "WRITES NOTHING" IS STRUCTURAL, as in alphaCodesGenerator.test.ts: the CLI
// writes only from a write plan, so every refusal here is a `stop` plan (or a
// non-empty violation list from the family plan, which `planTaxonomyRun` turns
// into one), and a `stop` plan is a run that wrote nothing.

/// <reference types="node" />
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  FAMILIES_ASSET_VERSION, FAMILY_CODE_SHAPE_RE, GENUS_LEFT_UNNAMED, GENUS_PLURAL_EXCEPTIONS, ORDER_COMMON_NAMES,
  checkFamilies, deriveFamilies, genusCommonName, genusNameReport, liveFamilyViolations, planFamilies,
  type FamiliesAsset, type FamilyOptions,
} from '../../../scripts/lib/ebirdFamiliesDerive.mjs'
import { deriveBundle, planTaxonomyRun, type TaxonLike } from '../../../scripts/lib/ebirdTaxonomyDerive.mjs'
import { FAMILY_CODE_RE } from './familyTreeLinks'

// -- Fixture: real shapes -----------------------------------------------------

let order = 0
function sp(
  speciesCode: string, comName: string, sciName: string,
  fam: [orderName: string, code: string, com: string, sci: string],
  extra: Partial<TaxonLike> = {},
): TaxonLike {
  order += 1
  return {
    speciesCode, comName, sciName, category: 'species', taxonOrder: order,
    order: fam[0], familyCode: fam[1], familyComName: fam[2], familySciName: fam[3],
    ...extra,
  }
}

const ANAT: [string, string, string, string] = ['Anseriformes', 'anatid1', 'Ducks, Geese, and Waterfowl', 'Anatidae']
const PHAS: [string, string, string, string] = ['Galliformes', 'phasia1', 'Pheasants, Grouse, and Allies', 'Phasianidae']
const STRI: [string, string, string, string] = ['Strigiformes', 'strigi1', 'Owls', 'Strigidae']
const MOHO: [string, string, string, string] = ['Passeriformes', 'mohoid1', 'Hawaiian Honeyeaters', 'Mohoidae']
const VIRE: [string, string, string, string] = ['Passeriformes', 'vireon1', 'Vireos, Shrike-Babblers, and Erpornis', 'Vireonidae']

function fixture(): TaxonLike[] {
  order = 0
  return [
    sp('snogoo', 'Snow Goose', 'Anser caerulescens', ANAT),
    sp('rosgoo', "Ross's Goose", 'Anser rossii', ANAT),
    sp('cangoo', 'Canada Goose', 'Branta canadensis', ANAT),
    { speciesCode: 'x00001', comName: 'Snow x Ross\'s Goose (hybrid)', sciName: 'Anser caerulescens x rossii', category: 'hybrid', taxonOrder: 3.5 },
    sp('saggro', 'Greater Sage-Grouse', 'Centrocercus urophasianus', PHAS),
    sp('gusgro', 'Gunnison Sage-Grouse', 'Centrocercus minimus', PHAS),
    sp('wesowl', 'Western Screech-Owl', 'Megascops kennicottii', STRI),
    sp('easowl', 'Eastern Screech-Owl', 'Megascops asio', STRI),
    sp('grhowl', 'Great Horned Owl', 'Bubo virginianus', STRI),
    sp('eueowl', 'Eurasian Eagle-Owl', 'Bubo bubo', STRI),
    sp('kauoo', 'Kauai Oo', 'Moho braccatus', MOHO, { extinct: true, extinctYear: 1987 }),
    sp('oahoo', 'Oahu Oo', 'Moho apicalis', MOHO, { extinct: true, extinctYear: 1837 }),
    sp('bkcvir', 'Black-capped Vireo', 'Vireo atricapilla', VIRE),
    sp('reevir', 'Red-eyed Vireo', 'Vireo olivaceus', VIRE),
    { speciesCode: 'vireo1', comName: 'vireo sp.', sciName: 'Vireo sp.', category: 'spuh', taxonOrder: 99 },
  ]
}

const OPTIONS: FamilyOptions = {
  orderNames: { Anseriformes: 'Waterfowl', Galliformes: 'Gamebirds', Strigiformes: 'Owls', Passeriformes: 'Perching Birds' },
  leftUnnamed: ['Moho'],
  floors: { families: 1, orders: 1, genera: 1 },
}

const VERSION = '2029'
function snapshotFor(live: TaxonLike[]) {
  return deriveBundle(live, { version: VERSION, generated: '2026-11-21' })
}
const plan = (live: TaxonLike[], options: FamilyOptions = OPTIONS) => planFamilies(live, snapshotFor(live), options)

// -- QA-02: the asset holds every field, in taxonomic sequence ---------------

describe('the derived asset (QA-02)', () => {
  const live = fixture()
  const p = plan(live)

  it('derives with no violation', () => {
    expect(p.violations).toEqual([])
  })

  it('holds every order, family, genus and species in taxonomic sequence', () => {
    const asset = p.asset as FamiliesAsset
    expect(asset.v).toBe(FAMILIES_ASSET_VERSION)
    expect(asset.version).toBe(VERSION)
    expect(asset.orders.map(o => [o[0], o[1]])).toEqual([
      ['Anseriformes', 'Waterfowl'], ['Galliformes', 'Gamebirds'], ['Strigiformes', 'Owls'], ['Passeriformes', 'Perching Birds'],
    ])
    const anat = asset.orders[0][2][0]
    expect(anat.slice(0, 4)).toEqual(['anatid1', 'Ducks, Geese, and Waterfowl', 'Anatidae', 3])
    expect(anat[4]).toEqual([
      ['Anser', ['snow goose', 'caerulescens', "ross's goose", 'rossii'], 'Geese'],
      ['Branta', ['canada goose', 'canadensis']],
    ])
    const passer = asset.orders[3][2]
    expect(passer.map(f => f[0])).toEqual(['mohoid1', 'vireon1'])
  })

  it('stores living species and the extinct set, so a wholly extinct family has living 0', () => {
    const asset = p.asset as FamiliesAsset
    const moho = asset.orders[3][2][0]
    expect(moho[3]).toBe(0)
    expect(asset.extinct).toEqual(['kauai oo', 'oahu oo'])
  })

  it('reads no hybrid, spuh or other non-species row', () => {
    const asset = p.asset as FamiliesAsset
    const names = asset.orders.flatMap(o => o[2].flatMap(f => f[4].flatMap(g => g[1].filter((_, i) => i % 2 === 0))))
    expect(names).not.toContain('vireo sp.')
    expect(names.some(n => n.includes(' x '))).toBe(false)
    expect(names).toHaveLength(13)
  })

  it('derives the same bytes from the same response, twice', () => {
    expect(plan(fixture()).json).toBe(plan(fixture()).json)
  })
})

// -- QA-03: each check stops the run with nothing written --------------------

function mutate(fn: (rows: TaxonLike[]) => void): TaxonLike[] {
  const rows = fixture().map(r => ({ ...r }))
  fn(rows)
  return rows
}
const bySpecies = (rows: TaxonLike[], code: string) => rows.find(r => r.speciesCode === code)!

describe('the generator fails closed (QA-03)', () => {
  const cases: [string, RegExp, (rows: TaxonLike[]) => void][] = [
    ['G1: a species with no family', /^G1:/, rows => { delete bySpecies(rows, 'cangoo').familyCode }],
    ['G1: a species with no order', /^G1:/, rows => { bySpecies(rows, 'cangoo').order = '' }],
    ['G2: a family under two orders', /^G2:/, rows => { bySpecies(rows, 'rosgoo').order = 'Galliformes' }],
    ['G2: a family under two names', /^G2:/, rows => { bySpecies(rows, 'rosgoo').familyComName = 'Ducks' }],
    ['G3: an extinct marker that is not a boolean', /^G3:/, rows => { bySpecies(rows, 'kauoo').extinct = 'yes' }],
    ['G4: a scientific name of three words', /^G4:/, rows => { bySpecies(rows, 'cangoo').sciName = 'Branta canadensis canadensis' }],
    ['G6: an order with no authored name', /^G6:/, rows => { bySpecies(rows, 'snogoo').order = 'Anatiformes'; bySpecies(rows, 'rosgoo').order = 'Anatiformes'; bySpecies(rows, 'cangoo').order = 'Anatiformes' }],
    ['F3: a family that is not contiguous', /^F3:/, rows => { const [moved] = rows.splice(0, 1); rows.splice(8, 0, moved) }],
    ['F5: a family code failing the shape', /^F5:/, rows => { for (const r of rows) if (r.familyCode === 'strigi1') r.familyCode = 'strigi/1' }],
    ['F5: an over-long family name', /^F5:/, rows => { for (const r of rows) if (r.familyCode === 'strigi1') r.familyComName = 'O'.repeat(81) }],
    ['F5: an empty epithet', /^G4:|^F5:/, rows => { bySpecies(rows, 'cangoo').sciName = 'Branta ' }],
  ]
  for (const [label, re, fn] of cases) {
    it(`${label} stops the run`, () => {
      const p = plan(mutate(fn))
      expect(p.violations.some(v => re.test(v)), p.violations.join('\n')).toBe(true)
      expect(p.asset).toBeUndefined()
      expect(p.json).toBeUndefined()
    })
  }

  it('G6 in the other direction: a table row for an order the response lacks', () => {
    const p = plan(fixture(), { ...OPTIONS, orderNames: { ...OPTIONS.orderNames, Gaviiformes: 'Loons' } })
    expect(p.violations.some(v => /^G6:.*Gaviiformes/.test(v))).toBe(true)
  })

  it('G7: a left-unnamed genus the rule would not name', () => {
    const p = plan(fixture(), { ...OPTIONS, leftUnnamed: ['Moho', 'Branta'] })
    expect(p.violations.some(v => /^G7:.*Branta/.test(v))).toBe(true)
  })

  it('F8: the floors', () => {
    const p = plan(fixture(), { ...OPTIONS, floors: { families: 6, orders: 1, genera: 1 } })
    expect(p.violations.some(v => /^F8:/.test(v))).toBe(true)
  })

  it('F2: the asset species set must equal the snapshot the same run writes', () => {
    const live = fixture()
    const snap = snapshotFor(live)
    const p = planFamilies(live, { ...snap, byCom: { ...snap.byCom, 'phantom bird': 'phabir1' } }, OPTIONS)
    expect(p.violations.some(v => /^F2:.*phantom bird/.test(v))).toBe(true)
  })

  it('G5: a family whose derived tally differs from the response count', async () => {
    const { familyTallyViolations } = await import('../../../scripts/lib/ebirdFamiliesDerive.mjs')
    const live = fixture()
    const asset = deriveFamilies(live, { ...OPTIONS, version: VERSION })
    const genus = asset.orders[0][2][0][4][0]
    genus[1] = genus[1].slice(2)
    expect(familyTallyViolations(live, asset).some(v => /^G5:/.test(v))).toBe(true)
  })

  it('the whole snapshot run stops on a family violation, so nothing is written', () => {
    const live = mutate(rows => { delete bySpecies(rows, 'cangoo').familyCode })
    const run = planTaxonomyRun({
      live, committed: null, version: VERSION, generated: '2026-11-21', minEntries: 1,
      families: (l, bundle) => planFamilies(l, bundle, OPTIONS),
    })
    expect(run.mode).toBe('stop')
  })

  it('the whole snapshot run carries the family JSON in its write plan when sound', () => {
    const live = fixture().map(r => ({ ...r, bandingCodes: ['ABCD'], comNameCodes: [] }))
    const run = planTaxonomyRun({
      live, committed: null, version: VERSION, generated: '2026-11-21', minEntries: 1,
      families: (l, bundle) => planFamilies(l, bundle, OPTIONS),
    })
    expect(run.mode === 'stop' ? run.messages : []).toEqual([])
    expect(run.mode).toBe('all')
    if (run.mode !== 'stop') expect(JSON.parse(run.familiesJson).v).toBe(FAMILIES_ASSET_VERSION)
  })
})

// -- QA-92 (generator half): the order table, both directions -----------------

describe('the authored order names (QA-92)', () => {
  it('a name removed, emptied or over-long fails the shared checker', () => {
    const live = fixture()
    const snap = snapshotFor(live)
    const asset = (plan(live).asset as FamiliesAsset)
    const copy = JSON.parse(JSON.stringify(asset)) as FamiliesAsset
    copy.orders[0][1] = ''
    expect(checkFamilies(copy, snap, OPTIONS).some(v => /^F10:/.test(v))).toBe(true)
    copy.orders[0][1] = 'Ducks'
    expect(checkFamilies(copy, snap, OPTIONS).some(v => /^F10:/.test(v))).toBe(true)
  })

  it('the shipped table names exactly the 45 orders, each non-empty and within bounds', () => {
    const rows = Object.entries(ORDER_COMMON_NAMES)
    expect(rows).toHaveLength(45)
    for (const [k, v] of rows) {
      expect(k.endsWith('iformes')).toBe(true)
      expect(v.length > 0 && v.length <= 40).toBe(true)
    }
  })
})

// -- QA-93's fixture rows: the genus rule, by name ---------------------------

describe('the genus naming rule (QA-93)', () => {
  const name = (genus: string, ...species: string[]) => genusCommonName(genus, species, [])
  it('a whole hyphenated last word counts whole: Screech-Owls', () => {
    expect(name('Megascops', 'Western Screech-Owl', 'Eastern Screech-Owl')).toBe('Screech-Owls')
  })
  it('only when whole last words disagree, the part after the last hyphen: Owls', () => {
    expect(name('Bubo', 'Great Horned Owl', 'Eurasian Eagle-Owl', 'Snowy Owl')).toBe('Owls')
  })
  it('fowl, grouse and quail stay unchanged', () => {
    expect(name('Gallus', 'Red Junglefowl', 'Gray Junglefowl')).toBe('Junglefowl')
    expect(name('Centrocercus', 'Greater Sage-Grouse', 'Gunnison Sage-Grouse')).toBe('Sage-Grouse')
    expect(name('Callipepla', 'California Quail', 'Gambel\'s Quail')).toBe('Quail')
  })
  it('goose to geese, titmouse to titmice, monarch to monarchs', () => {
    expect(name('Anser', 'Snow Goose', "Ross's Goose")).toBe('Geese')
    expect(name('Nettapus', 'Cotton Pygmy-Goose', 'Green Pygmy-Goose')).toBe('Pygmy-Geese')
    expect(name('Baeolophus', 'Tufted Titmouse', 'Oak Titmouse')).toBe('Titmice')
    expect(name('Monarcha', 'Black-faced Monarch', 'Spectacled Monarch')).toBe('Monarchs')
  })
  it('bird-of-paradise and cock-of-the-rock pluralize on their first word', () => {
    expect(name('Paradisaea', 'Greater Bird-of-Paradise', 'Raggiana Bird-of-Paradise')).toBe('Birds-of-Paradise')
    expect(name('Rupicola', 'Andean Cock-of-the-rock', 'Guianan Cock-of-the-rock')).toBe('Cocks-of-the-rock')
  })
  it('the regular endings: es, ies and s', () => {
    expect(name('Turdus', 'American Thrush', 'Song Thrush')).toBe('Thrushes')
    expect(name('Neomixis', 'Common Jery', 'Green Jery')).toBe('Jeries')
    expect(name('Cyanocitta', 'Blue Jay', "Steller's Jay")).toBe('Jays')
  })
  it('mixed endings give no name', () => {
    expect(name('Branta', 'Canada Goose', 'Brant')).toBe('')
  })
  it('a word that is the genus itself gives no name (the Vireo and Junco shape)', () => {
    expect(name('Vireo', 'Black-capped Vireo', 'Red-eyed Vireo')).toBe('')
    expect(name('Junco', 'Dark-eyed Junco', 'Yellow-eyed Junco')).toBe('')
  })
  it('a single-species genus gives no name', () => {
    expect(name('Branta', 'Canada Goose')).toBe('')
  })
  it('a genus on the left-unnamed list gets none, and the shipped list is the read-through\'s', () => {
    expect(genusCommonName('Moho', ['Kauai Oo', 'Oahu Oo'])).toBe('')
    expect(genusCommonName('Moho', ['Kauai Oo', 'Oahu Oo'], [])).toBe('Oos')
    expect([...GENUS_LEFT_UNNAMED]).toEqual(['Moho'])
    expect(GENUS_PLURAL_EXCEPTIONS.map(e => e.suffix)).toEqual([
      'fowl', 'grouse', 'quail', 'goose', 'titmouse', 'monarch', 'bird-of-paradise', 'cock-of-the-rock',
    ])
  })
  it('F11 refuses a name on a single-species genus and a changed name', () => {
    const live = fixture()
    const snap = snapshotFor(live)
    const asset = plan(live).asset as FamiliesAsset
    const a = JSON.parse(JSON.stringify(asset)) as FamiliesAsset
    ;(a.orders[0][2][0][4][1] as unknown[]).push('Brants')
    expect(checkFamilies(a, snap, OPTIONS).some(v => /^F11:.*one species/.test(v))).toBe(true)
    const b = JSON.parse(JSON.stringify(asset)) as FamiliesAsset
    b.orders[0][2][0][4][0][2] = 'Geeses'
    expect(checkFamilies(b, snap, OPTIONS).some(v => /^F11:.*Geeses/.test(v))).toBe(true)
  })
})

// -- The read-through report (FR-91) ----------------------------------------

describe('the genus-name report', () => {
  it('lists every name as new on the first generation, and none against itself', () => {
    const p = plan(fixture())
    const asset = p.asset as FamiliesAsset
    const first = genusNameReport(asset, null)
    expect(first[0]).toMatch(/genera named/)
    expect(first.some(l => l.includes('Anser: "Geese"'))).toBe(true)
    const again = genusNameReport(asset, p.json as string)
    expect(again).toHaveLength(1)
    expect(again[0]).toMatch(/0 new or changed and 0 dropped/)
  })
})

// -- The two declarations of the family-code shape ---------------------------

describe('the family-code shape', () => {
  it('the generator\'s and the runtime guard\'s are the same pattern', () => {
    expect(FAMILY_CODE_SHAPE_RE.source).toBe(FAMILY_CODE_RE.source)
    expect(FAMILY_CODE_SHAPE_RE.flags).toBe(FAMILY_CODE_RE.flags)
  })
  it('cannot express a scheme, host, credential, path separator or escape', () => {
    for (const bad of ['https://x1', 'a/b1', 'a@b1', 'a%2f1', 'a.b1', 'A1', 'anatid', '1anatid', 'anatid1\n']) {
      expect(FAMILY_CODE_RE.test(bad), bad).toBe(false)
    }
    expect(FAMILY_CODE_RE.test('anatid1')).toBe(true)
  })
})

// -- Source rows over the CLI (QA-01) ----------------------------------------

function code(path: string): string {
  return readFileSync(new URL(path, import.meta.url), 'utf8')
    .split('\n').filter(l => !l.trimStart().startsWith('//')).join('\n')
}

describe('the CLI', () => {
  const cli = code('../../../scripts/build-ebird-taxonomy.mjs')
  it('makes exactly one request, the taxonomy fetch it always made', () => {
    expect(cli.match(/(?<![A-Za-z])fetch\(/g)).toHaveLength(1)
    expect(cli.match(/await fetch\(EBIRD_TAXONOMY_URL/g)).toHaveLength(1)
  })
  it('never passes the family test seam to the plan', () => {
    const call = cli.slice(cli.indexOf('planTaxonomyRun('), cli.indexOf(')', cli.indexOf('planTaxonomyRun(')) + 1)
    expect(call).not.toMatch(/families/)
  })
  it('writes the family asset from the plan, in both modes, after the plan', () => {
    expect(cli).toMatch(/writes\.push\(\{ target: FAMILIES_TARGET, json: plan\.familiesJson \}\)/)
    expect(cli.indexOf('FAMILIES_TARGET, json')).toBeGreaterThan(cli.indexOf('planTaxonomyRun('))
    expect(cli.split('writeFile(').length - 1).toBe(1)
  })
  it('is not part of npm run build', () => {
    const pkg = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8')) as { scripts: Record<string, string> }
    expect(Object.values(pkg.scripts).some(s => s.includes('build-ebird-taxonomy'))).toBe(false)
  })
})

describe('the live checks need the response', () => {
  it('a sound fixture has none', () => {
    expect(liveFamilyViolations(fixture(), OPTIONS)).toEqual([])
  })
})
