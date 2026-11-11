// The picker's per-keystroke filter and its window (hotspot-reports schema
// section 3; FR-19, FR-22, FR-23; QA-19, QA-22, QA-74).

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import type { ObservationEntry } from '../types'
import { row, checklist } from '../test/hotspotReportsRows'
import { buildLocationIndex } from './hotspotReports'
import { filterLocations, PICKER_OPTION_CAP, PICKER_QUERY_MAX_CHARS } from './hotspotReportsPicker'

const names = (index: ReturnType<typeof buildLocationIndex>, ords: readonly number[]) => ords.map(o => index.locations[o].name)

describe('matching (FR-19, QA-19)', () => {
  const index = buildLocationIndex([
    ...checklist({ submissionId: 'S1', locationId: 'L1', location: 'Bolinas MARSH', county: 'Marin', stateProvince: 'US-CA', species: ['A'] }),
    ...checklist({ submissionId: 'S2', locationId: 'L2', location: 'Marin Headlands', county: 'Marin', stateProvince: 'US-CA', species: ['A'] }),
    ...checklist({ submissionId: 'S3', locationId: 'L3', location: 'Washoe Flats', county: 'Washoe', stateProvince: 'US-NV', species: ['A'] }),
  ])

  it('is a case-insensitive substring test over name, place label and full state name', () => {
    expect(names(index, filterLocations(index, 'marsh', null).ords)).toEqual(['Bolinas MARSH'])
    expect(names(index, filterLocations(index, 'marin', null).ords)).toEqual(['Bolinas MARSH', 'Marin Headlands'])
    expect(names(index, filterLocations(index, 'california', null).ords)).toEqual(['Bolinas MARSH', 'Marin Headlands'])
    expect(names(index, filterLocations(index, 'Nevada', null).ords)).toEqual(['Washoe Flats'])
  })

  it('a query of spaces matches everything; a non-matching query matches nothing', () => {
    expect(filterLocations(index, '   ', null).matches).toBe(3)
    expect(filterLocations(index, 'zzyzx', null)).toMatchObject({ ords: [], matches: 0 })
  })

  it('cannot match across two fields (the line feed between them cannot be typed)', () => {
    expect(filterLocations(index, 'marsh marin', null).matches).toBe(0)
  })

  it('reads at most PICKER_QUERY_MAX_CHARS characters of the query', () => {
    expect(PICKER_QUERY_MAX_CHARS).toBe(100)
    const q = 'marsh' + 'x'.repeat(200)
    // Cut at 100, the query is 'marsh' + 95 x's, which matches nothing; the
    // point is that the cut happens inside the function.
    expect(filterLocations(index, q, null).matches).toBe(0)
    expect(filterLocations(index, ' '.repeat(100) + 'marsh', null).matches).toBe(3)
  })
})

describe('the rendered window is bounded (FR-22, QA-22)', () => {
  const rows: ObservationEntry[] = []
  for (let i = 0; i < 150_000; i++) rows.push(row({ submissionId: `S${i}`, locationId: `L${i}`, location: `Place ${String(i).padStart(6, '0')}` }))
  const index = buildLocationIndex(rows)

  it('with 150,000 locations it renders at most the cap and counts every match', () => {
    const w = filterLocations(index, '', null)
    expect(w.ords.length).toBe(PICKER_OPTION_CAP)
    expect(w.matches).toBe(150_000)
    const q = filterLocations(index, 'place 1', null)
    expect(q.ords.length).toBe(PICKER_OPTION_CAP)
    expect(q.matches).toBe(50_000)
  })

  it('typing the name of a location beyond the first 200 brings it into the list', () => {
    const w = filterLocations(index, 'Place 149999', null)
    expect(names(index, w.ords)).toEqual(['Place 149999'])
  })
})

describe('the window follows the selection on an empty query (FR-23, QA-74)', () => {
  const rows: ObservationEntry[] = []
  for (let i = 0; i < 1000; i++) rows.push(row({ submissionId: `S${i}`, locationId: `L${i}`, location: `Place ${String(i).padStart(4, '0')}` }))
  const index = buildLocationIndex(rows)
  const at700 = index.pickerOrder[700]

  it('a selection at rank 700 slides the window so it is rendered', () => {
    const w = filterLocations(index, '', at700)
    expect(w.ords.length).toBe(PICKER_OPTION_CAP)
    expect(w.ords).toContain(at700)
    expect(w.start).toBe(700)
    expect(w.matches).toBe(1000)
  })

  it('near the end the window stops at the last location', () => {
    const last = index.pickerOrder[999]
    const w = filterLocations(index, '', last)
    expect(w.start).toBe(800)
    expect(w.ords[w.ords.length - 1]).toBe(last)
  })

  it('a typed query renders the first matches from rank one; a selection inside the cap, or none, keeps the first 200', () => {
    expect(filterLocations(index, 'place', at700).start).toBe(0)
    expect(filterLocations(index, 'place', at700).ords[0]).toBe(index.pickerOrder[0])
    expect(filterLocations(index, '', index.pickerOrder[150]).start).toBe(0)
    expect(filterLocations(index, '', null).start).toBe(0)
  })
})

describe('the module uses one native search, on the bounded haystack', () => {
  it('holds exactly one search-primitive call, comments stripped', () => {
    const raw = readFileSync(fileURLToPath(new URL('./hotspotReportsPicker.ts', import.meta.url)), 'utf8')
    const code = raw.split('\n').map(l => { const c = l.indexOf('//'); return c === -1 ? l : l.slice(0, c) }).join('\n')
    let count = 0
    for (const p of ['.includes(', '.indexOf(', '.search(', '.match(', '.find(', '.filter(', 'RegExp']) {
      let at = code.indexOf(p)
      while (at !== -1) { count += 1; at = code.indexOf(p, at + 1) }
    }
    expect(count).toBe(1)
    expect(code).toContain('.haystack.includes(q)')
  })
})
