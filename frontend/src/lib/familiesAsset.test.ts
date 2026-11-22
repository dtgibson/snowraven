// THE CI GUARD FOR THE COMMITTED FAMILY ASSET (family-rollups-and-tree,
// schema 3.3; FR-06, FR-82, FR-83; QA-04's asset half, QA-05's size half,
// QA-06, QA-92, QA-93).
//
// The asset is a bundled BUILD-TIME artifact, so it is defended at build time
// (the fail-closed generator) and here, at CI time; the app performs no
// per-entry validation (CLAUDE.md, the bundled-asset trust boundary). This file
// makes no request. It reads the committed asset and the committed taxonomy
// snapshot from disk when it runs, and:
//
//   1. runs the generator's SHARED checker (F1 to F11) over the asset;
//   2. re-derives, in this file's own code and without calling the core, the
//      species set, the contiguity, each family's living count and each world
//      count, the order names and the genus names, in both directions;
//   3. holds the order names to the design spec's approved table, a literal
//      in this file (the oracle outside the generator), name for name;
//   4. proves both halves live with mutation rows: each alters a copy of the
//      asset in one way and must be rejected by the checker AND by this file.
//
// Every figure is read from the committed files when the test runs; nothing
// here is a typed-in total.

/// <reference types="node" />
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { gzipSync } from 'node:zlib'
import {
  FAMILIES_GZIP_MAX_BYTES, GENUS_LEFT_UNNAMED, GENUS_PLURAL_EXCEPTIONS, ORDER_COMMON_NAMES,
  checkFamilies, type FamiliesAsset,
} from '../../../scripts/lib/ebirdFamiliesDerive.mjs'
import { FAMILY_CODE_RE } from './familyTreeLinks'

interface Snapshot {
  version: string
  byCode: Record<string, string>
  byCom: Record<string, string>
  bySci: Record<string, string>
  byOrder: Record<string, number>
}

const RAW = readFileSync(new URL('../assets/ebird-families.json', import.meta.url), 'utf8')
const ASSET = JSON.parse(RAW) as FamiliesAsset
const SNAPSHOT = JSON.parse(readFileSync(new URL('../assets/ebird-taxonomy.json', import.meta.url), 'utf8')) as Snapshot

/**
 * The approved order names, as design-spec section 6.2 records them (D-21,
 * D-23). Held here as this file's own literal so a name changed in the
 * generator's table alone, or in the asset alone, is red. Neither declaration
 * is derived from the other.
 */
const APPROVED_ORDER_NAMES: Readonly<Record<string, string>> = {
  Struthioniformes: 'Ostriches', Casuariiformes: 'Cassowaries and Emu', Apterygiformes: 'Kiwis',
  Rheiformes: 'Rheas', Tinamiformes: 'Tinamous', Anseriformes: 'Waterfowl', Galliformes: 'Gamebirds',
  Columbiformes: 'Pigeons and Doves', Mesitornithiformes: 'Mesites', Pterocliformes: 'Sandgrouse',
  Otidiformes: 'Bustards', Musophagiformes: 'Turacos', Cuculiformes: 'Cuckoos', Caprimulgiformes: 'Nightjars',
  Nyctibiiformes: 'Potoos', Steatornithiformes: 'Oilbird', Podargiformes: 'Frogmouths',
  Aegotheliformes: 'Owlet-nightjars', Apodiformes: 'Swifts and Hummingbirds', Gruiformes: 'Rails and Cranes',
  Charadriiformes: 'Shorebirds and Gulls', Phoenicopteriformes: 'Flamingos', Podicipediformes: 'Grebes',
  Opisthocomiformes: 'Hoatzin', Eurypygiformes: 'Kagu and Sunbittern', Phaethontiformes: 'Tropicbirds',
  Gaviiformes: 'Loons', Sphenisciformes: 'Penguins', Procellariiformes: 'Tubenoses', Ciconiiformes: 'Storks',
  Suliformes: 'Cormorants and Allies', Pelecaniformes: 'Pelicans and Herons', Cathartiformes: 'New World Vultures',
  Accipitriformes: 'Hawks and Eagles', Strigiformes: 'Owls', Coliiformes: 'Mousebirds',
  Leptosomiformes: 'Cuckoo-roller', Trogoniformes: 'Trogons', Bucerotiformes: 'Hornbills and Hoopoes',
  Coraciiformes: 'Kingfishers and Allies', Piciformes: 'Woodpeckers and Allies', Cariamiformes: 'Seriemas',
  Falconiformes: 'Falcons and Caracaras', Psittaciformes: 'Parrots', Passeriformes: 'Perching Birds',
}

// -- This file's own reading of the genus rule (schema 3.5), sharing no code
// with the generator but its two closed lists ---------------------------------

function ownLastWord(name: string): string {
  let end = name.length
  while (end > 0 && name[end - 1] === ' ') end -= 1
  let start = end
  while (start > 0 && name[start - 1] !== ' ') start -= 1
  return name.slice(start, end)
}
function ownAfterHyphen(word: string): string {
  let i = word.length - 1
  while (i >= 0 && word[i] !== '-') i -= 1
  return i < 0 ? word : word.slice(i + 1)
}
function agree(words: string[]): string | null {
  const lc = words.map(w => w.toLowerCase())
  return lc.every(w => w !== '' && w === lc[0]) ? words[0] : null
}
function ownPlural(word: string): string {
  const lc = word.toLowerCase()
  for (const ex of GENUS_PLURAL_EXCEPTIONS) {
    if (!lc.endsWith(ex.suffix)) continue
    const head = word.slice(0, word.length - ex.suffix.length)
    const tail = word.slice(word.length - ex.suffix.length)
    if (ex.firstWord) return head + tail.replace('-', 's-')
    let out = ''
    for (let i = 0; i < ex.plural.length; i++) {
      const t = tail[i] ?? ''
      out += t !== '' && t !== t.toLowerCase() ? ex.plural[i].toUpperCase() : ex.plural[i]
    }
    return head + out
  }
  if (/(s|x|z|ch|sh)$/.test(lc)) return word + 'es'
  if (/[^aeiou]y$/.test(lc)) return word.slice(0, -1) + 'ies'
  return word + 's'
}
/** The rule as this file reads it, without the left-unnamed list. */
function ownGenusName(genus: string, names: string[]): string {
  if (names.length < 2) return ''
  const whole = names.map(ownLastWord)
  const word = agree(whole) ?? agree(whole.map(ownAfterHyphen))
  if (word === null || word.toLowerCase() === genus.toLowerCase()) return ''
  const p = ownPlural(word)
  return p.charAt(0).toUpperCase() + p.slice(1)
}

// -- This file's own independent violations ------------------------------------

function independentViolations(asset: FamiliesAsset): string[] {
  const out: string[] = []
  if (asset.v !== 2) out.push('v')
  if (asset.version !== SNAPSHOT.version) out.push('version')
  const extinct = new Set(asset.extinct)
  const seen = new Set<string>()
  let prev = -Infinity
  for (const [order, common, families] of asset.orders) {
    if (APPROVED_ORDER_NAMES[order] !== common) out.push(`order name ${order}`)
    for (const [code, com, sci, living, genera] of families) {
      if (!FAMILY_CODE_RE.test(code)) out.push(`code ${code}`)
      if (!com || !sci) out.push(`family names ${code}`)
      let n = 0
      let gone = 0
      for (const g of genera) {
        const [genus, list] = g
        const spelled: string[] = []
        for (let i = 0; i < list.length; i += 2) {
          const name = list[i]
          n += 1
          if (extinct.has(name)) gone += 1
          if (seen.has(name)) out.push(`duplicate ${name}`)
          seen.add(name)
          if (!Object.hasOwn(SNAPSHOT.byCom, name)) { out.push(`not a species ${name}`); continue }
          const o = SNAPSHOT.byOrder[name]
          if (!(o > prev)) out.push(`not contiguous at ${name}`)
          prev = o
          const code7 = SNAPSHOT.byCom[name]
          if (SNAPSHOT.bySci[`${genus} ${list[i + 1]}`.toLowerCase()] !== code7) out.push(`scientific name ${name}`)
          spelled.push(SNAPSHOT.byCode[code7])
        }
        const want = GENUS_LEFT_UNNAMED.includes(genus) ? '' : ownGenusName(genus, spelled)
        const has = g.length === 3 ? g[2] : ''
        if (has !== want) out.push(`genus name ${genus}: "${has}" against "${want}"`)
      }
      if (living !== n - gone) out.push(`living ${code}`)
    }
  }
  for (const name of Object.keys(SNAPSHOT.byCom)) if (!seen.has(name)) out.push(`missing ${name}`)
  for (const e of extinct) if (!seen.has(e)) out.push(`extinct not a species ${e}`)
  return out
}

const clone = (): FamiliesAsset => JSON.parse(RAW) as FamiliesAsset
const checker = (asset: unknown) => checkFamilies(asset, SNAPSHOT)

describe('the committed family asset (QA-06)', () => {
  it('passes the shared checker', () => {
    expect(checker(ASSET)).toEqual([])
  })

  it('passes this file\'s own re-derivation', () => {
    expect(independentViolations(ASSET)).toEqual([])
  })

  it('records the snapshot version it was built against', () => {
    expect(ASSET.version).toBe(SNAPSHOT.version)
  })

  it('is within its gzipped size budget (QA-05)', () => {
    expect(gzipSync(Buffer.from(RAW, 'utf8')).length).toBeLessThanOrEqual(FAMILIES_GZIP_MAX_BYTES)
  })

  it('every family code passes the runtime shape guard', () => {
    for (const o of ASSET.orders) for (const f of o[2]) expect(FAMILY_CODE_RE.test(f[0]), f[0]).toBe(true)
  })
})

describe('world counts, re-derived (QA-04, the asset half)', () => {
  it('each family\'s living count equals its species less its extinct members, by this file\'s own loop', () => {
    const extinct = new Set(ASSET.extinct)
    let living = 0
    let species = 0
    for (const o of ASSET.orders) for (const f of o[2]) {
      let n = 0
      let gone = 0
      for (const g of f[4]) for (let i = 0; i < g[1].length; i += 2) { n += 1; if (extinct.has(g[1][i])) gone += 1 }
      expect(f[3], f[0]).toBe(n - gone)
      living += f[3]
      species += n
    }
    expect(living + extinct.size).toBe(species)
    expect(species).toBe(Object.keys(SNAPSHOT.byCom).length)
  })

  it('the species-to-family map built here equals the asset\'s, species by species', () => {
    const fam = new Map<string, string>()
    for (const o of ASSET.orders) for (const f of o[2]) for (const g of f[4]) for (let i = 0; i < g[1].length; i += 2) fam.set(g[1][i], f[0])
    expect(fam.size).toBe(Object.keys(SNAPSHOT.byCom).length)
    for (const name of Object.keys(SNAPSHOT.byCom)) expect(fam.has(name), name).toBe(true)
  })
})

describe('the order names (QA-92)', () => {
  it('the asset names every order, and only the generator table\'s orders', () => {
    const orders = ASSET.orders.map(o => o[0])
    expect(new Set(orders)).toEqual(new Set(Object.keys(ORDER_COMMON_NAMES)))
    for (const o of ASSET.orders) expect(o[1], o[0]).toBe(ORDER_COMMON_NAMES[o[0]])
  })
  it('the generator table equals the approved wording, name for name', () => {
    expect({ ...ORDER_COMMON_NAMES }).toEqual(APPROVED_ORDER_NAMES)
  })
})

describe('the genus names (QA-93)', () => {
  it('every named genus satisfies the rule and every genus the rule names carries it, both directions', () => {
    let named = 0
    let checked = 0
    for (const o of ASSET.orders) for (const f of o[2]) for (const g of f[4]) {
      checked += 1
      const spelled: string[] = []
      for (let i = 0; i < g[1].length; i += 2) spelled.push(SNAPSHOT.byCode[SNAPSHOT.byCom[g[1][i]]])
      const rule = ownGenusName(g[0], spelled)
      if (g.length === 3) {
        named += 1
        expect(g[1].length / 2, g[0]).toBeGreaterThanOrEqual(2)
        expect(g[2], g[0]).toBe(rule)
        expect(GENUS_LEFT_UNNAMED.includes(g[0]), g[0]).toBe(false)
      } else if (rule !== '') {
        expect(GENUS_LEFT_UNNAMED.includes(g[0]), `${g[0]} should carry "${rule}"`).toBe(true)
      }
    }
    expect(checked).toBeGreaterThan(1_000)
    expect(named).toBeGreaterThan(500)
  })
  it('a single-species genus carries no name', () => {
    for (const o of ASSET.orders) for (const f of o[2]) for (const g of f[4]) if (g[1].length === 2) expect(g.length, g[0]).toBe(2)
  })
})

describe('mutations are refused by the checker AND by this file', () => {
  const cases: [string, (a: FamiliesAsset) => void][] = [
    ['one species removed', a => { const g = a.orders[0][2][0][4][0]; g[1] = g[1].slice(2) }],
    ['one species moved to a non-adjacent family', a => {
      const from = a.orders[5][2][0][4][0]
      const moved = from[1].splice(0, 2)
      a.orders[44][2][0][4][0][1].push(...moved)
    }],
    ['one living count altered', a => { a.orders[0][2][0][3] += 1 }],
    ['the recorded version changed', a => { a.version = 'x' + a.version }],
    ['a family code given a slash', a => { a.orders[0][2][0][0] = a.orders[0][2][0][0].replace(/(\d)$/, '/$1') }],
    ['one order name removed', a => { a.orders[3][1] = '' }],
    ['one order name changed', a => { a.orders[3][1] = 'Kiwi Birds' }],
    ['one genus name changed', a => {
      for (const o of a.orders) for (const f of o[2]) for (const g of f[4]) if (g.length === 3) { g[2] = g[2] + 'x'; return }
    }],
    ['a name put on a single-species genus', a => {
      for (const o of a.orders) for (const f of o[2]) for (const g of f[4]) if (g[1].length === 2) { (g as unknown[]).push('Singles'); return }
    }],
  ]
  for (const [label, fn] of cases) {
    it(label, () => {
      const a = clone()
      fn(a)
      expect(JSON.stringify(a)).not.toBe(RAW)
      expect(checker(a).length, label).toBeGreaterThan(0)
      expect(independentViolations(a).length, label).toBeGreaterThan(0)
    })
  }
  it('the checker refuses an order the asset names that the table lacks', () => {
    const a = clone()
    a.orders[3][0] = 'Kiwiformes'
    expect(checker(a).some(v => /^F10:/.test(v))).toBe(true)
  })
})

// -- QA-93's last clause: no naming code at run time --------------------------

const SRC = new URL('../', import.meta.url)
function strip(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').filter(l => !l.trimStart().startsWith('//')).join('\n')
}
function runtimeFiles(): { path: string; text: string }[] {
  const out: { path: string; text: string }[] = []
  for (const f of readdirSync(new URL('lib/', SRC))) {
    if (/^familyTree[A-Za-z]*\.ts$/.test(f) && !f.endsWith('.test.ts')) out.push({ path: `lib/${f}`, text: readFileSync(new URL(`lib/${f}`, SRC), 'utf8') })
  }
  let comps: string[]
  try { comps = readdirSync(new URL('components/familyTree/', SRC)) } catch { comps = [] }
  for (const f of comps) {
    if (/\.tsx?$/.test(f) && !/\.test\.tsx?$/.test(f)) out.push({ path: `components/familyTree/${f}`, text: readFileSync(new URL(`components/familyTree/${f}`, SRC), 'utf8') })
  }
  return out
}
const NAMING = [
  /ebirdFamiliesDerive/, /genusCommonName/, /pluralOfGroupWord/, /GENUS_PLURAL_EXCEPTIONS/, /GENUS_LEFT_UNNAMED/,
  /\+\s*['"`](?:ies|es)['"`]/, /\.slice\(0,\s*-1\)\s*\+\s*['"`]ies/,
]
function namingHits(text: string): RegExp[] {
  const code = strip(text)
  return NAMING.filter(re => re.test(code))
}

describe('the runtime holds no genus naming code', () => {
  it('no Family Tree module carries the rule, its lists or a pluralizer', () => {
    const files = runtimeFiles()
    expect(files.length).toBeGreaterThan(0)
    for (const f of files) expect(namingHits(f.text), f.path).toEqual([])
  })
  it('the scan sees a pluralizer in code and ignores one in a comment', () => {
    expect(namingHits("const p = word.slice(0, -1) + 'ies'").length).toBeGreaterThan(0)
    expect(namingHits("// const p = word.slice(0, -1) + 'ies'")).toEqual([])
  })
})
