// THE CI GUARD FOR THE COMMITTED ALPHA-CODE ASSET (species-code-search,
// schema.md 4.4 and 15; FR-07, QA-41, QA-42, QA-44).
//
// The asset is a bundled BUILD-TIME artifact, so it is defended at build time
// (the fail-closed generator) and here, at CI time; the app performs no
// per-entry validation (CLAUDE.md, the bundled-asset trust boundary). This file
// reads the committed asset and the committed taxonomy snapshot from disk and:
//
//   1. runs the generator's SHARED invariant checker over the asset;
//   2. re-asserts I1, I2, I3, I5, I6, I7 and I8 INDEPENDENTLY in this file's own
//      code, so a checker weakened in the script cannot pass this test alone;
//   3. holds the size bound (I9) against the ONE constant the generator uses;
//   4. pins the American-name decision by its examples (I12, QA-42), because
//      the snapshot carries no `bandingCodes` and so this test cannot re-run
//      the filter itself;
//   5. proves both halves live with mutation rows: each alters a copy of the
//      asset in one way and must be rejected by the checker AND by this file.

/// <reference types="node" />
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { gzipSync } from 'node:zlib'
import {
  ALPHA_CODES_GZIP_MAX_BYTES, PROTOTYPE_MEMBER_NAMES, checkAlphaCodes,
} from '../../../scripts/lib/ebirdTaxonomyDerive.mjs'
import type { AlphaCodeTable } from './alphaCodes'

interface Snapshot {
  version: string
  byCode: Record<string, string>
  byCom: Record<string, string>
}

const RAW = readFileSync(new URL('../assets/ebird-alpha-codes.json', import.meta.url), 'utf8')
const ASSET = JSON.parse(RAW) as AlphaCodeTable
const SNAPSHOT = JSON.parse(readFileSync(new URL('../assets/ebird-taxonomy.json', import.meta.url), 'utf8')) as Snapshot

const SPECIES_NAMES = Object.keys(SNAPSHOT.byCom)
const PUBLISHED_NAMES = Object.values(SNAPSHOT.byCode).map(n => n.toLowerCase())

const checker = (asset: unknown) => checkAlphaCodes(asset, {
  speciesNames: SPECIES_NAMES, publishedNames: PUBLISHED_NAMES, snapshotVersion: SNAPSHOT.version,
})

/** This file's own reading of the invariants, sharing no code with the checker. */
const ALPHABET = new Set('ABCDEFGHIJKLMNOPQRSTUVWXYZ\u00D6\u00DC')
function independentViolations(asset: AlphaCodeTable): string[] {
  const out: string[] = []
  if (asset.v !== 1) out.push('I1 v')
  if (asset.version !== SNAPSHOT.version) out.push('I1 version')
  const codes = asset.codes
  const keys = Object.keys(codes)
  const published = new Set(PUBLISHED_NAMES)
  if (keys.some(k => !published.has(k))) out.push('I2 unpublished key')
  if (PUBLISHED_NAMES.some(n => !Object.hasOwn(codes, n))) out.push('I2 missing name')
  if (keys.filter(k => codes[k] !== '').length < 13_000) out.push('I3 floor')
  if (SPECIES_NAMES.some(s => !Object.hasOwn(codes, s) || codes[s] === '')) out.push('I5 species without a code')
  for (const k of keys) {
    if (k !== k.toLowerCase()) out.push('I7')
    const value = codes[k]
    if (value === '') continue
    const list = value.split(' ')
    if (new Set(list).size !== list.length) out.push('I6 repeat')
    for (const c of list) {
      const chars = [...c]
      if (chars.length < 2 || chars.length > 4 || chars.some(ch => !ALPHABET.has(ch)) || c.normalize('NFC') !== c) {
        out.push(`I6 ${JSON.stringify(c)}`)
      }
    }
  }
  for (const name of Object.getOwnPropertyNames(Object.prototype)) {
    if (Object.hasOwn(codes, name)) out.push(`I8 ${name}`)
  }
  return out
}

describe('the committed alpha-code asset (FR-07, QA-41)', () => {
  it('passes the generator\'s shared checker', () => {
    expect(checker(ASSET)).toEqual([])
  })

  it('passes this file\'s own independent checks', () => {
    expect(independentViolations(ASSET)).toEqual([])
  })

  it('is versioned with the snapshot and keyed on every published name (I1, I2)', () => {
    expect(ASSET.v).toBe(1)
    expect(ASSET.version).toBe(SNAPSHOT.version)
    expect(Object.keys(ASSET.codes).length).toBe(PUBLISHED_NAMES.length)
    expect(Object.keys(ASSET.codes).length).toBeGreaterThan(17_000)   // non-vacuity: the real asset
  })

  it('is within the gzip budget, read from the one constant (I9, QA-44)', () => {
    expect(gzipSync(Buffer.from(RAW, 'utf8')).length).toBeLessThanOrEqual(ALPHA_CODES_GZIP_MAX_BYTES)
    expect(ALPHA_CODES_GZIP_MAX_BYTES).toBe(200 * 1024)
  })

  it('the prototype-name list covers every Object.prototype member in this runtime (I8)', () => {
    for (const name of Object.getOwnPropertyNames(Object.prototype)) {
      expect(PROTOTYPE_MEMBER_NAMES, name).toContain(name)
    }
  })
})

// ── QA-42 / I12: the American-name decision, pinned by its examples ──────────

describe('real-data spot checks (QA-42)', () => {
  const codesOf = (name: string): string => {
    const key = name.toLowerCase()
    expect(Object.hasOwn(ASSET.codes, key), `${name} is a published name`).toBe(true)
    return ASSET.codes[key]
  }

  it.each([
    ['Yellow-rumped Warbler', 'YRWA'],
    ['Yellow-rumped Warbler (Myrtle)', 'MYWA YRWA'],
    ["Yellow-rumped Warbler (Audubon's)", 'AUWA YRWA'],
    ['Yellow-rumped Warbler (West Mexico)', 'YRWA'],
    ['Canada Goose', 'CANG CAGO'],
    ['Cackling Goose', 'CACG CAGO'],
    ['Cackling/Canada Goose', 'CCGO'],
    ['Cape May x Yellow-rumped Warbler (hybrid)', ''],
    ['Green Heron', 'GRHE'],
    ['Common Merganser', 'COME'],
    ['Rock Pigeon', 'ROPI'],
    ['European Starling', 'EUST'],
    ['Common Loon', 'COLO'],
    ['Dovekie', 'DOVE'],
    ["R\u00FCppell's Bustard", 'RUBU R\u00DCBU'],
    ['Common Wood-Pigeon', 'CWPI COWO COWP'],
    ['Common Ostrich', 'COOS'],
  ])('%s carries exactly %j', (name, expected) => {
    expect(codesOf(name)).toBe(expected)
  })

  it.each([['GOOS'], ['COST'], ['RODO'], ['LIAU'], ['GNDI'], ['ISTH'], ['FEPI']])(
    '%s, a code from another name, is on no entry', (code) => {
      const carriers = Object.keys(ASSET.codes).filter(k => ASSET.codes[k].split(' ').includes(code))
      expect(carriers).toEqual([])
    },
  )
})

// ── Mutation rows: each must be rejected by BOTH legs ────────────────────────

describe('each mutation of a copy is rejected by the checker and by this file', () => {
  const copy = (): AlphaCodeTable => JSON.parse(RAW) as AlphaCodeTable
  const mutable = (a: AlphaCodeTable) => a.codes as Record<string, string>

  const MUTATIONS: [string, () => AlphaCodeTable][] = [
    ['a re-spelled version', () => ({ ...copy(), version: '2026' })],
    ['one species emptied', () => { const a = copy(); mutable(a)['american robin'] = ''; return a }],
    ['one species key removed', () => { const a = copy(); delete mutable(a)['american robin']; return a }],
    ['an unpublished key added', () => { const a = copy(); mutable(a)['imaginary bird'] = 'IMBI'; return a }],
    ['a code R1BU', () => { const a = copy(); mutable(a)["r\u00FCppell's bustard"] = 'R1BU'; return a }],
    ['an own __proto__ key added through JSON.parse', () =>
      JSON.parse(RAW.replace('"codes":{', '"codes":{"__proto__":"XXXX",')) as AlphaCodeTable],
    ['a value with a doubled space', () => { const a = copy(); mutable(a)['canada goose'] = 'CANG  CAGO'; return a }],
  ]

  it.each(MUTATIONS)('%s', (_label, mutate) => {
    const mutated = mutate()
    expect(checker(mutated).length, 'the shared checker').toBeGreaterThan(0)
    expect(independentViolations(mutated).length, 'this file\'s own checks').toBeGreaterThan(0)
  })

  it('the __proto__ mutation really is an own key (guards the row above)', () => {
    const mutated = JSON.parse(RAW.replace('"codes":{', '"codes":{"__proto__":"XXXX",')) as AlphaCodeTable
    expect(Object.hasOwn(mutated.codes, '__proto__')).toBe(true)
  })
})
