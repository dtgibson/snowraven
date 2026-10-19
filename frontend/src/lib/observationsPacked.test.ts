/// <reference types="node" />
// Guard for big-old-life-lists: the packed form the parse and the statistics
// hand-over cross a thread boundary in (observationsPacked.ts).
//
// The pack-and-materialize round trip over real exports is proved where the
// parser's output is proved, against the pre-change parser byte for byte
// (parseEbirdObservationsStreaming.test.ts). This file holds what that oracle
// cannot reach:
//
//   1. THE ROUND TRIP IS EXACT FOR ANY ENTRY, not only for what the parser
//      happens to produce: every slot null, every optional key absent, -0,
//      Infinity, empty strings, and keys in the shipped order.
//   2. A REPEATED STRING IS STORED ONCE. Sharing is not observable from JS (a
//      string is a primitive), so the claim is held structurally: the table has
//      no duplicate, and equal values carry one index.
//   3. A MALFORMED PAYLOAD THROWS rather than building entries that read
//      `undefined` as a name.
//   4. THE SHARED EMPTY CATALOG LIST IS NEVER GROWN IN PLACE, by any shipped file.
//   5. THE PARSE RESERVES NO MORE THAN THE FILE CAN FILL (security review L2):
//      line feeds that make no row cannot size the arrays past the file's own
//      length, while a real export is still sized once.
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import type { ObservationEntry } from '../types'
import {
  materializeObservations, packObservationEntries, packedTransferables, NULL_INDEX, STR_SLOTS,
  PACKED_BYTES_PER_ROW,
} from './observationsPacked'
import type { PackedObservations } from './observationsPacked'
import { packEbirdObservations, parseEbirdObservations } from './parseEbirdObservations'

const base: ObservationEntry = {
  submissionId: 'S1', commonName: 'Sora', scientificName: 'Porzana carolina', date: '2024-04-09',
  location: 'Marsh', locationId: 'L1', latitude: 40.1, longitude: -73.2, county: 'Kings', count: 3,
  breedingCode: 'FL', speciesComments: '', catalogIds: ['123', '456'],
}

const full: ObservationEntry = {
  ...base,
  time: '07:15 AM', duration: 90, distance: 2.5, area: null, protocol: 'Traveling', numObservers: 2,
  allObsReported: true, checklistComments: 'Weather block', stateProvince: 'US-NY',
}

const roundTrip = (xs: ObservationEntry[]) => materializeObservations(packObservationEntries(xs))

describe('the round trip is exact', () => {
  it('for entries with every optional key, none, and some', () => {
    const xs: ObservationEntry[] = [
      full,
      base,
      { ...base, time: null, allObsReported: false, stateProvince: null },
      { ...base, catalogIds: [], county: null, breedingCode: null, latitude: null, longitude: null, count: null },
      { ...full, allObsReported: null, duration: null, distance: null, numObservers: null, protocol: null, time: null },
      { ...full, latitude: -0, longitude: Infinity, count: 0, area: -Infinity, checklistComments: '' },
    ]
    const back = roundTrip(xs)
    // Key ORDER as well as values: JSON.stringify compares both, which is what
    // the parser oracle compares too.
    expect(JSON.stringify(back)).toBe(JSON.stringify(xs))
    expect(back).toStrictEqual(xs.map(e => ({ ...e, catalogIds: [...e.catalogIds] })))
    expect(Object.is(back[5].latitude, -0)).toBe(true)
    expect(back[5].longitude).toBe(Infinity)
  })

  it('a key that is absent stays absent, never present as undefined', () => {
    const [back] = roundTrip([base])
    expect('time' in back).toBe(false)
    expect('checklistComments' in back).toBe(false)
    expect(Object.keys(back)).toEqual(Object.keys(base))
  })

  it('over the parser, the packed parse and the materialized parse are one result', () => {
    const csv = 'Submission ID,Common Name,Scientific Name,Date,Checklist Comments,ML Catalog Numbers\n'
      + 'S1,Sora,Porzana carolina,2024-04-09,"Long, shared comment",ML1 ML2\n'
      + 'S1,Virginia Rail,Rallus limicola,2024-04-09,"Long, shared comment",\n'
    expect(materializeObservations(packEbirdObservations(csv))).toEqual(parseEbirdObservations(csv))
  })
})

describe('a repeated string is stored once', () => {
  it('the table holds no duplicate, and equal values share one index', () => {
    const comment = 'A weather block long enough to matter. '.repeat(10)
    // Distinct string INSTANCES of one value, the way a parse produces them.
    const xs = Array.from({ length: 50 }, (_, i) => ({
      ...full, commonName: `Bird ${i % 5}`, checklistComments: comment.slice(0) + '',
    }))
    const p = packObservationEntries(xs)
    expect(new Set(p.strings).size).toBe(p.strings.length)
    const chk = new Set<number>()
    for (let r = 0; r < p.rows; r++) chk.add(p.str[r * STR_SLOTS + 11])
    expect(chk.size).toBe(1)
    // Five names, one comment and the rest of full's distinct values: the
    // table does not grow with the row count.
    expect(p.strings.length).toBeLessThan(25)
  })

  it('every entry with no catalog ids shares one frozen list', () => {
    const back = roundTrip([{ ...base, catalogIds: [] }, { ...base, catalogIds: [] }])
    expect(back[0].catalogIds).toBe(back[1].catalogIds)
    expect(Object.isFrozen(back[0].catalogIds)).toBe(true)
    expect(() => { (back[0].catalogIds as string[]).push('1') }).toThrow(TypeError)
  })
})

describe('a malformed payload throws, never builds entries from it', () => {
  const good = () => packObservationEntries([full, base])
  const cases: Array<[string, (p: ReturnType<typeof good>) => unknown]> = [
    ['not an object', () => null],
    ['a row count past the arrays', p => ({ ...p, rows: p.rows + 1 })],
    ['a non-integer row count', p => ({ ...p, rows: 1.5 })],
    ['a string index past the table', p => ({ ...p, strings: p.strings.slice(0, 2) })],
    ['a table entry that is not a string', p => ({ ...p, strings: p.strings.map((s, i) => (i === 0 ? 7 : s)) })],
    ['an optional-key mask with unknown bits', p => { const opt = p.opt.slice(); opt[1] = 0xffff; return { ...p, opt } }],
    ['catalog offsets past the id pool', p => { const cs = p.catStart.slice(); cs[2] = p.catIds.length + 5; return { ...p, catStart: cs } }],
    ['catalog offsets that run backwards', p => { const cs = p.catStart.slice(); cs[1] = 5; cs[2] = 1; return { ...p, catStart: cs } }],
    ['a plain array where a typed one belongs', p => ({ ...p, num: Array.from(p.num) })],
  ]
  it.each(cases)('%s', (_label, mutate) => {
    expect(() => materializeObservations(mutate(good()) as never)).toThrow('PACKED_OBSERVATIONS_MALFORMED')
  })

  it('and the unmutated payload materializes (the rows above are not vacuous)', () => {
    expect(materializeObservations(good())).toHaveLength(2)
    expect(NULL_INDEX).toBe(0xffffffff)
  })

})

describe('the parse reserves no more than the file can fill (security review L2)', () => {
  const HEADER = 'Submission ID,Common Name,Scientific Name,Date\n'
  const reservedBytes = (p: PackedObservations) =>
    p.str.byteLength + p.num.byteLength + p.opt.byteLength + p.catStart.byteLength + p.catIds.byteLength
  const lineFeeds = (text: string) => {
    let n = 0
    for (let i = text.indexOf('\n'); i !== -1; i = text.indexOf('\n', i + 1)) n++
    return n
  }
  // Fixed overhead beside the rows: one catalog offset past the last row and
  // the id pool's starting size.
  const SLACK = 2 * PACKED_BYTES_PER_ROW + 256

  const N = 1 << 18
  const hostile: Array<[string, string]> = [
    ['a line-feed flood', HEADER + '\n'.repeat(N)],
    ['a CRLF flood', HEADER + '\r\n'.repeat(N)],
    ['line feeds inside one quoted field', HEADER + '"' + '\n'.repeat(N) + '"\n'],
    ['rows with no common name', HEADER + ',\n'.repeat(N)],
  ]
  it.each(hostile)('%s: an empty backup, with the reservation under one byte per character', (_label, csv) => {
    // The shape is hostile: sized from its line-feed count, it would reserve
    // more than fifty bytes of typed array per character of the file.
    expect((lineFeeds(csv) + 1) * PACKED_BYTES_PER_ROW).toBeGreaterThan(50 * csv.length)
    const p = packEbirdObservations(csv)
    expect(p.rows).toBe(0)
    expect(reservedBytes(p)).toBeLessThanOrEqual(csv.length + SLACK)
    expect(parseEbirdObservations(csv)).toEqual([])
  })

  it('a real export is still sized once, from its line-feed count', () => {
    const demo = readFileSync(new URL('../../../website/demo/snowraven-demo-ebird-backup.csv', import.meta.url), 'utf8')
    const p = packEbirdObservations(demo)
    expect(p.rows).toBeGreaterThan(7000)
    // Capacity equal to the line-feed count plus one means the length bound did
    // not decide and the arrays never doubled.
    expect(p.opt.length).toBe(lineFeeds(demo) + 1)
    expect(p.rows).toBeLessThanOrEqual(p.opt.length)
  })

  it('rows shorter than the bound double the arrays as they arrive, stay exact, and keep under twice the rows', () => {
    const rows = 5000
    const csv = HEADER + Array.from({ length: rows }, (_, i) => `S${i},Sora,Porzana carolina,2024-04-09\n`).join('')
    // Rows of about 36 characters: here the length bound is the smaller one.
    expect(Math.ceil(csv.length / PACKED_BYTES_PER_ROW)).toBeLessThan(lineFeeds(csv))
    const p = packEbirdObservations(csv)
    expect(p.rows).toBe(rows)
    expect(p.opt.length).toBeGreaterThan(Math.ceil(csv.length / PACKED_BYTES_PER_ROW))
    expect(p.opt.length).toBeLessThan(2 * rows)
    const entries = materializeObservations(p)
    expect(entries).toHaveLength(rows)
    expect(entries.every((e, i) => e.submissionId === `S${i}` && e.commonName === 'Sora' && e.date === '2024-04-09')).toBe(true)
  })
})

describe('the transfer list', () => {
  it('names every buffer of the form, so nothing is copied that could be moved', () => {
    const p = packObservationEntries([full])
    expect(packedTransferables(p)).toEqual([p.str.buffer, p.num.buffer, p.opt.buffer, p.catStart.buffer, p.catIds.buffer])
  })
})

describe('no shipped file grows an entry\'s catalog list in place (drift guard)', () => {
  it('finds no mutating call or index write on `.catalogIds` outside tests', () => {
    const root = new URL('..', import.meta.url).pathname
    const files: string[] = []
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const p = join(dir, name)
        if (statSync(p).isDirectory()) walk(p)
        else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)) files.push(p)
      }
    }
    walk(root)
    expect(files.length).toBeGreaterThan(100)
    const MUTATION = /\.catalogIds\s*(?:\.\s*(?:push|pop|shift|unshift|splice|sort|reverse|fill|copyWithin)\s*\(|\[[^\]]*\]\s*=(?!=)|\.length\s*=(?!=))/
    const offenders = files.filter(f => MUTATION.test(readFileSync(f, 'utf8')))
    expect(offenders).toEqual([])
    // Guard the guard: the pattern sees the shapes it exists to catch.
    expect(MUTATION.test('o.catalogIds.push(x)')).toBe(true)
    expect(MUTATION.test('o.catalogIds[0] = x')).toBe(true)
    expect(MUTATION.test('o.catalogIds.sort()')).toBe(true)
    expect(MUTATION.test('o.catalogIds.length === 0')).toBe(false)
  })
})
