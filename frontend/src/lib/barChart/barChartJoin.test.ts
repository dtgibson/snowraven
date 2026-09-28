/// <reference types="node" />
// Joining a bar-chart file to a county's species pool, with FR-35's three-way
// accounting (targets-tab, schema.md section 2.5; QA-37).
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { parseBarChart, type BarChartFile } from './parseBarChart'
import { joinBarChartToPool } from './barChartJoin'
import { isNonCountableForm } from '../speciesUtils'
import type { EbirdSpecies } from '../countyCompleteness'

function load(name: string): BarChartFile {
  const out = parseBarChart(readFileSync(new URL(name, import.meta.url), 'utf8'))
  if (!out.ok) throw new Error(`${name} must parse`)
  return out.file
}
const SAMPLE = load('./barchart-sample.fixture.txt')
const SYNTHETIC = load('./barchart-synthetic.fixture.txt')

describe('the three-way sum (FR-35)', () => {
  it('on the auk sample, against a pool built from its own countable names, every row is matched or skipped', () => {
    // The pool a county's eBird list would give: species-level names only, in
    // file order, with made-up codes.
    const pool: EbirdSpecies[] = SAMPLE.rows
      .filter(r => !isNonCountableForm(r.name))
      .map((r, i) => ({ speciesCode: `sp${i}`, commonName: r.name }))
    const j = joinBarChartToPool(SAMPLE, pool)
    expect(j.matched + j.skippedForms + j.unmatched.length).toBe(SAMPLE.rows.length)
    expect(j.unmatched).toEqual([])
    expect(j.skippedForms).toBeGreaterThan(0)          // the sample carries spuhs and slashes
    expect(j.matched).toBe(pool.length)
    expect(j.bySpeciesCode.size).toBe(pool.length)
  })

  it('on the auk sample, against a pool missing one species, that row is unmatched and the sum still holds', () => {
    const pool: EbirdSpecies[] = SAMPLE.rows
      .filter(r => !isNonCountableForm(r.name) && r.name !== 'Brant')
      .map((r, i) => ({ speciesCode: `sp${i}`, commonName: r.name }))
    const j = joinBarChartToPool(SAMPLE, pool)
    expect(j.unmatched).toEqual([{ name: 'Brant', sciName: null }])
    expect(j.matched + j.skippedForms + j.unmatched.length).toBe(SAMPLE.rows.length)
  })
})

describe('the synthetic fixture (QA-37)', () => {
  const POOL: EbirdSpecies[] = [
    { speciesCode: 'daejun', commonName: 'Dark-eyed Junco' },
    { speciesCode: 'linspa', commonName: 'Lincoln\'s Sparrow' },
    { speciesCode: 'bushti', commonName: 'Bushtit' },
    { speciesCode: 'wrenti', commonName: 'Wrentit' },
    { speciesCode: 'y00478', commonName: 'Iceland Gull' },          // Thayer's Gull's current name
    { speciesCode: 'amerob', commonName: 'American Robin' },        // in the pool, not in the file
  ]
  const j = joinBarChartToPool(SYNTHETIC, POOL)

  it('a renamed species is unmatched, named with its row; spuh, slash and hybrid are skipped', () => {
    expect(j.unmatched).toEqual([{ name: 'Thayer\'s Gull', sciName: null }])
    expect(j.skippedForms).toBe(3)
    expect(j.matched + j.skippedForms + j.unmatched.length).toBe(SYNTHETIC.rows.length)
    expect(j.malformed).toBe(SYNTHETIC.malformed)
  })

  it('the species-shaped row wins a collision with its subspecies row; both count as matched', () => {
    const species = SYNTHETIC.rows.find(r => r.name === 'Dark-eyed Junco')!
    expect(j.bySpeciesCode.get('daejun')).toBe(species)
    expect(j.matched).toBe(5)          // LISP, DEJU, DEJU (Oregon), Bushtit, Wrentit
  })

  it('the collision rule holds whichever row comes first', () => {
    const reversed: BarChartFile = { ...SYNTHETIC, rows: [...SYNTHETIC.rows].reverse() }
    const species = SYNTHETIC.rows.find(r => r.name === 'Dark-eyed Junco')!
    expect(joinBarChartToPool(reversed, POOL).bySpeciesCode.get('daejun')).toBe(species)
  })

  it('a folded row is taken when no species-shaped row exists', () => {
    const onlyForm: BarChartFile = { ...SYNTHETIC, rows: SYNTHETIC.rows.filter(r => r.name !== 'Dark-eyed Junco') }
    expect(joinBarChartToPool(onlyForm, POOL).bySpeciesCode.get('daejun')?.name).toBe('Dark-eyed Junco (Oregon)')
  })

  it('joins case-insensitively, keyed by the POOL\'s code', () => {
    const lower: BarChartFile = { ...SYNTHETIC, rows: [{ name: 'bushtit', sciName: null, freqs: new Array(48).fill(0) }] }
    expect([...joinBarChartToPool(lower, POOL).bySpeciesCode.keys()]).toEqual(['bushti'])
  })
})

describe('names that are prototype-chain members are ordinary strings', () => {
  it('`__proto__`, `constructor` and `toString` rows neither crash nor join', () => {
    const rows = ['__proto__', 'constructor', 'toString'].map(name => ({ name, sciName: null, freqs: new Array(48).fill(0) }))
    const file: BarChartFile = { sampleSizes: new Array(48).fill(1), rows, malformed: 0, declaredTaxa: null }
    const j = joinBarChartToPool(file, [{ speciesCode: 'bushti', commonName: 'Bushtit' }])
    expect(j.matched).toBe(0)
    expect(j.unmatched.map(u => u.name)).toEqual(['__proto__', 'constructor', 'toString'])
    expect(j.bySpeciesCode.size).toBe(0)
  })

  it('a pool species named `constructor` joins its own row and nothing else', () => {
    const file: BarChartFile = { sampleSizes: new Array(48).fill(1), rows: [{ name: 'constructor', sciName: null, freqs: new Array(48).fill(0) }], malformed: 0, declaredTaxa: null }
    const j = joinBarChartToPool(file, [{ speciesCode: 'x1', commonName: 'constructor' }])
    expect([...j.bySpeciesCode.keys()]).toEqual(['x1'])
  })
})
