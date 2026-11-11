// The Hotspot Reports index (hotspot-reports schema section 2; QA-10 to QA-14,
// QA-20, QA-28, QA-29, QA-36, QA-54, QA-66, QA-67).
//
// Fixtures are built as the parser delivers rows (src/test/hotspotReportsRows.ts),
// in file order, and every ordering claim is checked against an independent
// oracle rather than against a hand-written expected order.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import type { ObservationEntry } from '../types'
import { row, checklist, mlRow } from '../test/hotspotReportsRows'
import {
  buildLocationIndex, deriveMediaCounts, isEligibleRow, rankLocations, speciesTotals, boundText,
  LOCATION_ID_MAX_CHARS, LOCATION_NAME_MAX_CHARS, RANKED_LIST_SIZE, type LocationIndex,
} from './hotspotReports'
import { applySpeciesRule, deriveLocationFacts } from './hotspotReportsLocation'
import { HOTSPOT_ID_MAX_CHARS } from './hotspotRegionCache'

const NONE: ReadonlySet<string> = new Set()

function idx(rows: ObservationEntry[]): LocationIndex {
  return buildLocationIndex(rows)
}

describe('a location is its Location ID (FR-10, QA-10)', () => {
  it('checklists naming L1, L2 and an empty id yield two locations', () => {
    const index = idx([
      ...checklist({ submissionId: 'S1', locationId: 'L1', species: ['Song Sparrow'] }),
      ...checklist({ submissionId: 'S2', locationId: 'L2', species: ['Song Sparrow'] }),
      ...checklist({ submissionId: 'S3', locationId: '', species: ['Song Sparrow'] }),
    ])
    expect(index.locations.map(l => l.locationId)).toEqual(['L1', 'L2'])
    expect(index.checklistLoc.get('S3')).toBe(-1)
  })

  it('a 17-character id names no location and counts in no figure; 16 is the bound', () => {
    const long = `L${'1'.repeat(16)}`
    const edge = `L${'1'.repeat(15)}`
    expect(long.length).toBe(17)
    const index = idx([
      ...checklist({ submissionId: 'S1', locationId: long, species: ['Song Sparrow'] }),
      ...checklist({ submissionId: 'S2', locationId: edge, species: ['Song Sparrow'] }),
    ])
    expect(index.locations.map(l => l.locationId)).toEqual([edge])
    expect(index.checklistCount[0]).toBe(1)
  })

  it('declares the stored id bound and compares it with the hotspot store, never imports it', () => {
    expect(LOCATION_ID_MAX_CHARS).toBe(HOTSPOT_ID_MAX_CHARS)
  })

  it('__proto__ and constructor are ordinary locations, names and species (QA-67)', () => {
    const index = idx([
      ...checklist({ submissionId: 'S1', locationId: '__proto__', location: 'constructor', species: ['__proto__'] }),
      ...checklist({ submissionId: 'constructor', locationId: 'constructor', location: '<script>alert(1)</script>', species: ['constructor'] }),
    ])
    expect(index.locations.map(l => l.locationId)).toEqual(['__proto__', 'constructor'])
    expect(index.ordById.get('__proto__')).toBe(0)
    expect(index.ordById.get('constructor')).toBe(1)
    expect(index.locations[1].name).toBe('<script>alert(1)</script>')
    expect(index.speciesOrd.get('__proto__')).toBeDefined()
    expect(index.checklistCount[1]).toBe(1)
  })
})

describe("a row counts at its checklist's location, the first row deciding (FR-11, QA-11)", () => {
  it('a later row with a blank, or a different, id still counts at L1', () => {
    const rows = [
      row({ submissionId: 'S1', locationId: 'L1', commonName: 'Song Sparrow' }),
      row({ submissionId: 'S1', locationId: '', commonName: 'Blue Jay' }),
      row({ submissionId: 'S1', locationId: 'L2', commonName: 'Mallard' }),
    ]
    const index = idx(rows)
    expect(index.locations.map(l => l.locationId)).toEqual(['L1'])
    expect([...index.rowLoc]).toEqual([0, 0, 0])
    expect(index.speciesBase[0]).toBe(3)
  })

  it('every row of a checklist whose first row has no usable id counts nowhere, a later L1 row included', () => {
    const rows = [
      row({ submissionId: 'S1', locationId: '', commonName: 'Song Sparrow' }),
      row({ submissionId: 'S1', locationId: 'L1', commonName: 'Blue Jay' }),
      ...checklist({ submissionId: 'S2', locationId: 'L1', species: ['Mallard'] }),
    ]
    const index = idx(rows)
    expect([...index.rowLoc]).toEqual([-1, -1, 0])
    expect(index.checklistCount[0]).toBe(1)
    expect(index.speciesBase[0]).toBe(1)
  })

  it('a row with an empty Submission ID changes no figure', () => {
    const base = checklist({ submissionId: 'S1', locationId: 'L1', species: ['Song Sparrow'] })
    const withBlank = [...base, row({ submissionId: '', locationId: 'L1', commonName: 'Blue Jay' })]
    const a = idx(base)
    const b = idx(withBlank)
    expect(b.checklistCount[0]).toBe(a.checklistCount[0])
    expect(b.speciesBase[0]).toBe(a.speciesBase[0])
    expect(b.rowLoc[1]).toBe(-1)
  })

  it('a checklist whose only rows are a spuh counts as one checklist at its location', () => {
    const index = idx(checklist({ submissionId: 'S1', locationId: 'L1', species: ['gull sp.'] }))
    expect(index.checklistCount[0]).toBe(1)
    expect(index.speciesBase[0]).toBe(0)
  })
})

describe('name, place and coordinates come from the first checklist (FR-12, QA-12, QA-13)', () => {
  it('name and place are the first checklist\'s cells', () => {
    const index = idx([
      ...checklist({ submissionId: 'S1', locationId: 'L1', location: 'Home', county: 'Marin', stateProvince: 'US-CA', species: ['Song Sparrow'] }),
      ...checklist({ submissionId: 'S2', locationId: 'L1', location: 'Home renamed', county: 'Sonoma', stateProvince: 'US-CA', species: ['Song Sparrow'] }),
    ])
    const l = index.locations[0]
    expect([l.name, l.place, l.stateName]).toEqual(['Home', 'Marin, CA', 'California'])
  })

  it('coordinates come from the first checklist in range; a later one never replaces them', () => {
    const index = idx([
      ...checklist({ submissionId: 'S1', locationId: 'L1', latitude: 91, longitude: 10, species: ['A'] }),
      ...checklist({ submissionId: 'S2', locationId: 'L1', latitude: Number.NaN, longitude: 10, species: ['A'] }),
      ...checklist({ submissionId: 'S3', locationId: 'L1', latitude: null, longitude: null, species: ['A'] }),
      ...checklist({ submissionId: 'S4', locationId: 'L1', latitude: 10, longitude: 20, species: ['A'] }),
      ...checklist({ submissionId: 'S5', locationId: 'L1', latitude: 30, longitude: 40, species: ['A'] }),
      ...checklist({ submissionId: 'S6', locationId: 'L2', latitude: 91, longitude: 0, species: ['A'] }),
      ...checklist({ submissionId: 'S7', locationId: 'L3', latitude: 0, longitude: 181, species: ['A'] }),
    ])
    expect([index.locations[0].lat, index.locations[0].lng]).toEqual([10, 20])
    expect([index.locations[1].lat, index.locations[1].lng]).toEqual([null, null])
    expect([index.locations[2].lat, index.locations[2].lng]).toEqual([null, null])
  })

  it('a long name is cut at the bound and matching reads only the bounded text', () => {
    const long = `A${'b'.repeat(4998)}Z`
    const index = idx(checklist({ submissionId: 'S1', locationId: 'L1', location: long, species: ['A'] }))
    const l = index.locations[0]
    expect(l.name.length).toBe(LOCATION_NAME_MAX_CHARS)
    expect(l.truncated).toBe(true)
    expect(l.haystack).not.toContain('z')
  })

  it('the name bound is the schema\'s 200: a 200-character name is kept whole, a 201-character one is cut to 200', () => {
    // Pinned by BEHAVIOUR at the value FR-13 and schema 2.2 state, not by the
    // constant against itself, so moving the bound either way goes red here.
    const whole = 'n'.repeat(200)
    const over = 'n'.repeat(201)
    const index = idx([
      ...checklist({ submissionId: 'S1', locationId: 'L1', location: whole, species: ['A'] }),
      ...checklist({ submissionId: 'S2', locationId: 'L2', location: over, species: ['A'] }),
    ])
    expect([index.locations[0].name.length, index.locations[0].truncated]).toEqual([200, false])
    expect([index.locations[1].name.length, index.locations[1].truncated]).toEqual([200, true])
  })

  it('a surrogate pair straddling the bound is never split into a lone surrogate', () => {
    const pair = '\ud83e\udd85'
    const name = 'a'.repeat(LOCATION_NAME_MAX_CHARS - 1) + pair + 'tail'
    const { text, truncated } = boundText(name, LOCATION_NAME_MAX_CHARS)
    expect(truncated).toBe(true)
    expect(text.length).toBe(LOCATION_NAME_MAX_CHARS - 1)
    expect(text.charCodeAt(text.length - 1)).toBe(97)
  })

  it('an empty name stays empty (the surface shows the placeholder) and is still a location', () => {
    const index = idx(checklist({ submissionId: 'S1', locationId: 'L1', location: '', species: ['A'] }))
    expect(index.locations[0].name).toBe('')
  })

  it('reads the state name only for a shape-checked cell (US-constructor and over-long cells give none)', () => {
    const index = idx([
      ...checklist({ submissionId: 'S1', locationId: 'L1', stateProvince: 'US-constructor', species: ['A'] }),
      ...checklist({ submissionId: 'S2', locationId: 'L2', stateProvince: `US-${'A'.repeat(14)}`, species: ['A'] }),
      ...checklist({ submissionId: 'S3', locationId: 'L3', stateProvince: 'US-NV', species: ['A'] }),
      ...checklist({ submissionId: 'S4', locationId: 'L4', stateProvince: 'XX-ZZ', species: ['A'] }),
    ])
    expect(index.locations.map(l => l.stateName)).toEqual(['', '', 'Nevada', ''])
    expect(index.locations[1].stateProvince).toBeNull()
    for (const l of index.locations) expect(typeof l.stateName).toBe('string')
  })
})

describe('the picker order and namesakes (FR-20, FR-21, QA-14, QA-20)', () => {
  const rows = [
    ...checklist({ submissionId: 'S1', locationId: 'L9', location: 'Home', county: 'Marin', species: ['A'] }),
    ...checklist({ submissionId: 'S2', locationId: 'L3', location: 'Home', county: 'Marin', species: ['A'] }),
    ...checklist({ submissionId: 'S3', locationId: 'L4', location: 'Home', county: 'Kings', species: ['A'] }),
    ...checklist({ submissionId: 'S4', locationId: 'L5', location: '', species: ['A'] }),
    ...checklist({ submissionId: 'S5', locationId: 'L6', location: 'Bolinas Lagoon', species: ['A'] }),
    ...checklist({ submissionId: 'S6', locationId: 'L7', location: 'zebra point', species: ['A'] }),
  ]
  const index = idx(rows)

  it('orders by name, then place, then Location ID by code unit, with unnamed locations last', () => {
    const recs = index.locations
    const oracle = [...recs].sort((a, b) =>
      (a.name === '' ? 1 : 0) - (b.name === '' ? 1 : 0)
      || a.name.localeCompare(b.name) || a.place.localeCompare(b.place)
      || (a.locationId < b.locationId ? -1 : a.locationId > b.locationId ? 1 : 0))
    expect([...index.pickerOrder].map(o => recs[o].locationId)).toEqual(oracle.map(r => r.locationId))
    expect(recs[index.pickerOrder[index.pickerOrder.length - 1]].name).toBe('')
    for (let k = 0; k < recs.length; k++) expect(index.rankOf[index.pickerOrder[k]]).toBe(k)
  })

  it('shows the Location ID only where name AND place are shared', () => {
    const show = (id: string) => index.showId[index.ordById.get(id)!]
    expect([show('L9'), show('L3'), show('L4'), show('L5'), show('L6')]).toEqual([1, 1, 0, 0, 0])
  })

  it('the order never reads the kind, so it is one function of the file', () => {
    expect([...idx(rows).pickerOrder]).toEqual([...index.pickerOrder])
  })
})

describe('eligibility and the species totals (FR-33, FR-36, QA-36)', () => {
  it('a row is eligible only with a location, a countable dated name and a Submission ID', () => {
    const rows = [
      row({ submissionId: 'S1', commonName: 'Song Sparrow' }),
      row({ submissionId: 'S1', commonName: 'gull sp.' }),
      row({ submissionId: 'S1', commonName: 'Blue Jay', date: 'nope' }),
      row({ submissionId: '', commonName: 'Mallard' }),
    ]
    const index = idx(rows)
    expect([0, 1, 2, 3].map(i => isEligibleRow(index, i))).toEqual([true, false, false, false])
  })

  it('a mixed generated corpus: every location\'s total equals the row count of its life list', () => {
    let seed = 7
    const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff }
    const names = ['Song Sparrow', 'Blue Jay', 'gull sp.', 'Mallard x American Black Duck (hybrid)', 'Red-tailed Hawk (calurus/alascensis)', 'Red-tailed Hawk', 'Mute Swan', 'Snow Goose/Ross\'s Goose']
    const rows: ObservationEntry[] = []
    for (let c = 0; c < 400; c++) {
      const loc = c % 7 === 0 ? '' : `L${1 + Math.floor(rnd() * 12)}`
      const sub = c % 13 === 0 ? '' : `S${1000 + c}`
      const n = 1 + Math.floor(rnd() * 4)
      for (let k = 0; k < n; k++) {
        rows.push(row({
          submissionId: sub, locationId: k > 0 && rnd() < 0.2 ? 'L99' : loc,
          commonName: names[Math.floor(rnd() * names.length)],
          date: rnd() < 0.1 ? '' : `20${10 + Math.floor(rnd() * 10)}-0${1 + Math.floor(rnd() * 9)}-1${Math.floor(rnd() * 9)}`,
        }))
      }
    }
    const index = idx(rows)
    for (const escapees of [NONE, new Set(['Mute Swan']), new Set(['Mute Swan', 'Song Sparrow', 'Not In Backup'])]) {
      const totals = speciesTotals(index, escapees)
      for (let ord = 0; ord < index.locations.length; ord++) {
        const facts = deriveLocationFacts(index, rows, ord)
        expect(applySpeciesRule(facts, escapees).total, `${index.locations[ord].locationId}`).toBe(totals[ord])
      }
    }
    expect(index.locations.length).toBeGreaterThan(5)
  })
})

describe('the ranked lists (FR-28, FR-29, QA-28, QA-29)', () => {
  // L1..L12 with decreasing checklists; L11 and L12 tie on checklists and on
  // species, and are told apart by name, then by id.
  const rows: ObservationEntry[] = []
  let s = 0
  const add = (loc: string, name: string, checklists: number, species: readonly string[]) => {
    for (let c = 0; c < checklists; c++) rows.push(...checklist({ submissionId: `S${++s}`, locationId: loc, location: name, species }))
  }
  add('L1', 'Alpha', 20, ['A'])
  add('L2', 'Bravo', 19, ['A', 'B'])
  add('L3', 'Charlie', 18, ['A'])
  add('L4', 'Delta', 17, ['A'])
  add('L5', 'Echo', 16, ['A'])
  add('L6', 'Foxtrot', 15, ['A'])
  add('L7', 'Golf', 14, ['A'])
  add('L8', 'Hotel', 13, ['A'])
  add('L9', 'India', 12, ['A'])
  add('L10', 'Juliet', 2, ['A', 'B', 'C'])
  add('L12', 'Kilo', 2, ['A', 'B', 'C'])
  add('L11', 'Kilo', 2, ['A', 'B', 'C'])
  add('L13', 'Lima', 1, ['gull sp.'])
  const index = idx(rows)
  const ranks = rankLocations(index, speciesTotals(index, NONE))
  const id = (r: { ord: number }) => index.locations[r.ord].locationId

  it('lists the top ten by checklists, ties by species, then name, then id', () => {
    expect(ranks.byChecklists.length).toBe(RANKED_LIST_SIZE)
    expect(ranks.byChecklists.map(id)).toEqual(['L1', 'L2', 'L3', 'L4', 'L5', 'L6', 'L7', 'L8', 'L9', 'L10'])
  })

  it('lists by species total, ties by checklists, then name, then id, and never a zero', () => {
    expect(ranks.bySpecies.map(id).slice(0, 4)).toEqual(['L10', 'L11', 'L12', 'L2'])
    expect(ranks.bySpecies.map(id)).not.toContain('L13')
    for (const r of ranks.bySpecies) expect(r.species).toBe(applySpeciesRule(deriveLocationFacts(index, rows, r.ord), NONE).total)
  })
})

describe('the ML join is by the linked checklist only (FR-55, QA-54)', () => {
  const rows = [
    ...checklist({ submissionId: 'S1', locationId: 'L1', species: ['A'] }),
    ...checklist({ submissionId: 'S2', locationId: 'L2', species: ['A'] }),
  ]
  const index = idx(rows)
  it('counts by checklist id whatever the ML row\'s own locality, county or coordinates say', () => {
    const counts = deriveMediaCounts([
      mlRow({ checklistId: 'S1', format: 'Photo', location: 'Elsewhere', county: 'Other', latitude: 0, longitude: 0 }),
      mlRow({ checklistId: 'S1', format: 'Audio' }),
      mlRow({ checklistId: 'S1', format: 'Video' }),
      mlRow({ checklistId: '', format: 'Photo' }),
      mlRow({ checklistId: 'S404', format: 'Photo' }),
      mlRow({ checklistId: '__proto__', format: 'Photo' }),
    ], index)
    expect([...counts]).toEqual([1, 1, 1, 0, 0, 0])
  })
})

describe('the index lives only as long as its holder (NFR-04, QA-66)', () => {
  it('two builds over one array are two objects: nothing is memoized', () => {
    const rows = checklist({ submissionId: 'S1', species: ['A'] })
    expect(buildLocationIndex(rows)).not.toBe(buildLocationIndex(rows))
  })
})

// ── The file-scoped absence guard and the module-state guard ─────────────────

function stripComments(src: string): string {
  const BLOCK_OPEN = '/' + '*'
  const BLOCK_CLOSE = '*' + '/'
  const out: string[] = []
  let inBlock = false
  for (const line of src.split('\n')) {
    let l = line
    if (inBlock) {
      const close = l.indexOf(BLOCK_CLOSE)
      if (close === -1) continue
      inBlock = false
      l = l.slice(close + 2)
    }
    const open = l.indexOf(BLOCK_OPEN)
    if (open !== -1) {
      const close = l.indexOf(BLOCK_CLOSE, open + 2)
      if (close === -1) { inBlock = true; l = l.slice(0, open) }
      else l = l.slice(0, open) + l.slice(close + 2)
    }
    const lineComment = l.indexOf('//')
    if (lineComment !== -1) l = l.slice(0, lineComment)
    out.push(l)
  }
  return out.join('\n')
}
const source = (f: string) => readFileSync(fileURLToPath(new URL(`./${f}`, import.meta.url)), 'utf8')

describe('the derivation modules read fields through hand loops only (schema 2, 4)', () => {
  const FORBIDDEN = ['.includes(', '.indexOf(', '.find(', '.filter(', '.match(', '.search(', '.split(', '.replace(', '.test(', '.exec(', 'RegExp']
  for (const f of ['hotspotReports.ts', 'hotspotReportsLocation.ts']) {
    it(`${f} holds no regex and none of the search primitives, comments stripped`, () => {
      const code = stripComments(source(f))
      for (const p of FORBIDDEN) expect(code, `${f}: ${p}`).not.toContain(p)
      expect(code.length).toBeGreaterThan(3000)
    })
  }

  it('the strip is proven: a comment names a primitive the code does not use', () => {
    const raw = source('hotspotReports.ts')
    expect(raw).toContain('isAskableRegionCode')
    expect(stripComments(raw)).not.toContain('isAskableRegionCode')
  })

  it('declares no module-scoped mutable binding or collection outside constants (schema 7.1)', () => {
    for (const f of ['hotspotReports.ts', 'hotspotReportsPicker.ts', 'hotspotReportsLocation.ts', 'hotspotReportsKind.ts', 'hotspotReportsProvenance.ts', 'hotspotReportsCopy.ts']) {
      const top = stripComments(source(f)).split('\n').filter(l => l.length > 0 && l[0] !== ' ' && l[0] !== '}' && l[0] !== ')')
      for (const l of top) {
        expect(l.startsWith('let ') || l.startsWith('var '), `${f}: ${l}`).toBe(false)
        if (l.startsWith('const ')) {
          expect(l.includes('new Map') || l.includes('new Set') || l.includes('= ['), `${f}: ${l}`).toBe(
            // The one sanctioned module constant: an immutable empty Set used as a
            // shared "nothing" return, never written to.
            l.startsWith('const EMPTY: ReadonlySet<string> = new Set') || l.startsWith('const NO_OBSERVATIONS'),
          )
        }
      }
    }
  })

  it('holds no literal control or non-ASCII character outside comments', () => {
    for (const f of ['hotspotReports.ts', 'hotspotReportsPicker.ts', 'hotspotReportsLocation.ts', 'hotspotReportsKind.ts', 'hotspotReportsProvenance.ts', 'hotspotReportsCopy.ts']) {
      const code = stripComments(source(f))
      const bad: number[] = []
      for (let i = 0; i < code.length; i++) {
        const c = code.charCodeAt(i)
        if ((c < 0x20 && c !== 0x0a && c !== 0x0d) || c > 0x7e) bad.push(c)
      }
      expect(bad, f).toEqual([])
    }
  })
})
