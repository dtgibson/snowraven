// @vitest-environment jsdom
// The passive escapee reader (hotspot-reports schema section 6; FR-35, NFR-05;
// QA-35, QA-75).
//
// THE EQUIVALENCE IT OWES. `confirmEscapeesIndexed` re-implements the result of
// the shipped `confirmPublishedNames` from the index's species grouping, so the
// difference is argued in both directions over a generated corpus, with the
// seam's own failure returns as the first rows (CLAUDE.md, the v1.0.32 rule):
// an empty published list, a snapshot with nothing consulted, a store that
// failed to load. Then the rows that separate a wrong implementation, and a
// mutant that honors a name with one unconsulted carrier, which must go red.

import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook, act, cleanup } from '@testing-library/react'
import type { ObservationEntry } from '../types'
import { row, checklist } from '../test/hotspotReportsRows'
import { buildLocationIndex, type LocationIndex } from './hotspotReports'
import { confirmEscapeesIndexed, useHotspotReportsEscapees } from './hotspotReportsProvenance'
import { confirmPublishedNames, type ProvenanceSnapshot } from './exoticProvenance'

// The store, controlled by the test: a snapshot the hook reads and a listener
// set it notifies.
const store = vi.hoisted(() => {
  const listeners = new Set<() => void>()
  return {
    listeners,
    snapshot: null as unknown,
    notify() { for (const l of listeners) l() },
  }
})
vi.mock('./exoticProvenanceCache', () => ({
  subscribe: (l: () => void) => { store.listeners.add(l); return () => store.listeners.delete(l) },
  getSnapshot: () => store.snapshot,
  loadSnapshot: () => Promise.resolve(store.snapshot),
}))

function snapshot(excludedNames: string[], checklists: string[]): ProvenanceSnapshot {
  return { checklists: new Set(checklists), species: new Map(), excludedNames, exoticNames: null } as unknown as ProvenanceSnapshot
}

/** The shipped confirmation, restricted to names the backup holds. */
function oracle(published: string[], s: ProvenanceSnapshot, obs: ObservationEntry[], index: LocationIndex): string[] {
  return [...confirmPublishedNames(published, s, obs)].filter(n => index.speciesOrd.has(n)).sort()
}
function mine(published: string[], s: ProvenanceSnapshot, obs: ObservationEntry[], index: LocationIndex): string[] {
  return [...confirmEscapeesIndexed(published, s.checklists, index, obs)].sort()
}

/** The plausible wrong implementation: a name is honored when ANY carrier is
 *  consulted, rather than every one. */
function mutant(published: string[], s: ProvenanceSnapshot, obs: ObservationEntry[], index: LocationIndex): string[] {
  const out: string[] = []
  for (const name of published) {
    const sp = index.speciesOrd.get(name)
    if (sp === undefined) continue
    let any = false
    for (let k = index.spStart[sp]; k < index.spStart[sp + 1]; k++) if (s.checklists.has(obs[index.spRows[k]].submissionId)) any = true
    if (any) out.push(name)
  }
  return out.sort()
}

afterEach(cleanup)

describe('the indexed confirmation equals the shipped one (FR-35, QA-75)', () => {
  const obs: ObservationEntry[] = [
    ...checklist({ submissionId: 'S1', species: ['Mute Swan', 'Song Sparrow'] }),
    ...checklist({ submissionId: 'S2', species: ['Mute Swan'] }),
    // A carrier with an empty Submission ID: never consulted, so the name stays listed.
    row({ submissionId: '', commonName: 'Graylag Goose (Domestic type)' }),
    ...checklist({ submissionId: 'S3', species: ['Graylag Goose (Domestic type)'] }),
    // A carrier on a checklist with no usable Location ID.
    ...checklist({ submissionId: 'S4', locationId: '', species: ['Muscovy Duck (Domestic type)'] }),
    ...checklist({ submissionId: 'S5', species: ['Muscovy Duck (Domestic type)'] }),
    // A carrier with an invalid date.
    ...checklist({ submissionId: 'S6', date: 'n/a', species: ['Ring-necked Pheasant'] }),
    // A name held only on non-countable-form rows.
    ...checklist({ submissionId: 'S7', species: ['swan sp.'] }),
  ]
  const index = buildLocationIndex(obs)
  const published = ['Mute Swan', 'Graylag Goose', 'Muscovy Duck', 'Ring-necked Pheasant', 'swan sp.', 'Not In Backup']

  const cases: [string, ProvenanceSnapshot][] = [
    ['an empty published list', snapshot([], ['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7'])],
    ['a snapshot with nothing consulted', snapshot(published, [])],
    ['a store that failed to load (the empty snapshot)', snapshot([], [])],
    ['every carrier consulted', snapshot(published, ['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7'])],
    ['one carrier of Mute Swan unconsulted', snapshot(published, ['S1', 'S3', 'S4', 'S5', 'S6'])],
    ['the empty-id carrier can never be consulted', snapshot(['Graylag Goose'], ['S3', ''])],
    ['a carrier on an unlocated checklist counts', snapshot(['Muscovy Duck'], ['S5'])],
    ['an undated carrier counts', snapshot(['Ring-necked Pheasant'], ['S6'])],
  ]

  for (const [label, s] of cases) {
    it(label, () => {
      expect(mine(s.excludedNames as string[], s, obs, index)).toEqual(oracle(s.excludedNames as string[], s, obs, index))
    })
  }

  it('the separating rows are not vacuous: they include confirmed and open names', () => {
    const all = cases[3][1]
    expect(mine(published, all, obs, index)).toEqual(['Graylag Goose', 'Muscovy Duck', 'Mute Swan', 'Ring-necked Pheasant'].filter(n => n !== 'Graylag Goose'))
    expect(mine(published, cases[4][1], obs, index)).not.toContain('Mute Swan')
  })

  it('a generated corpus agrees in both directions', () => {
    let seed = 3
    const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff }
    const NAMES = ['Mute Swan', 'Mute Swan (Domestic type)', 'Song Sparrow', 'swan sp.', 'Graylag Goose (Domestic type)', 'Muscovy Duck', 'Wood Duck']
    for (let trial = 0; trial < 40; trial++) {
      const rows: ObservationEntry[] = []
      const subs: string[] = []
      for (let c = 0; c < 30; c++) {
        const sub = rnd() < 0.1 ? '' : `S${trial}-${c}`
        subs.push(sub)
        for (let k = 0; k < 1 + Math.floor(rnd() * 3); k++) {
          rows.push(row({ submissionId: sub, locationId: rnd() < 0.15 ? '' : 'L1', date: rnd() < 0.1 ? '' : '2024-01-01', commonName: NAMES[Math.floor(rnd() * NAMES.length)] }))
        }
      }
      const ix = buildLocationIndex(rows)
      const pub = ['Mute Swan', 'Graylag Goose', 'Muscovy Duck', 'Wood Duck', 'Absent']
      const consulted = subs.filter(() => rnd() < 0.85)
      const s = snapshot(pub, consulted)
      expect(mine(pub, s, rows, ix), `trial ${trial}`).toEqual(oracle(pub, s, rows, ix))
    }
  })

  it('the mutant that honors a name with one unconsulted carrier is caught', () => {
    const s = cases[4][1]
    expect(mutant(published, s, obs, index)).not.toEqual(oracle(published, s, obs, index))
  })
})

describe('the hook keeps its Set while the confirmed names do not change', () => {
  const obs = [
    ...checklist({ submissionId: 'S1', species: ['Mute Swan'] }),
    ...checklist({ submissionId: 'S2', species: ['Wood Duck'] }),
  ]
  const index = buildLocationIndex(obs)

  it('returns the same Set across snapshots that confirm the same names, and a new one when they change', () => {
    store.snapshot = snapshot(['Mute Swan'], ['S1'])
    const { result } = renderHook(() => useHotspotReportsEscapees(index, obs))
    const first = result.current
    expect([...first]).toEqual(['Mute Swan'])
    act(() => { store.snapshot = snapshot(['Mute Swan'], ['S1', 'S9']); store.notify() })
    expect(result.current).toBe(first)
    act(() => { store.snapshot = snapshot(['Mute Swan', 'Wood Duck'], ['S1', 'S2']); store.notify() })
    expect(result.current).not.toBe(first)
    expect([...result.current].sort()).toEqual(['Mute Swan', 'Wood Duck'])
  })

  it('with no index it reads nothing and returns an empty Set', () => {
    store.snapshot = snapshot(['Mute Swan'], ['S1'])
    const { result } = renderHook(() => useHotspotReportsEscapees(null, []))
    expect(result.current.size).toBe(0)
  })
})
