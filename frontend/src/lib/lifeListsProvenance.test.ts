// The Life Lists passive provenance reader (life-lists-tab schema 3.5; FR-14 to
// FR-20; QA-16, QA-17, QA-19 to QA-21). Pure rows over the shared model; the
// import-graph half of FR-14 lives in exoticProvenanceGraph.test.ts.

import { describe, it, expect } from 'vitest'
import type { ObservationEntry } from '../types'
import type { ProvenanceSnapshot, SpeciesProvenanceRecord } from './exoticProvenance'
import { lifeListsClassification, statisticsCheckComplete } from './lifeListsProvenance'

function obs(commonName: string, submissionId: string): ObservationEntry {
  return {
    submissionId, commonName, scientificName: '', date: '2020-01-01', location: 'L', locationId: 'L1',
    latitude: null, longitude: null, county: null, count: 1, breedingCode: null, speciesComments: '', catalogIds: [],
  }
}
const rec = (seen: string[]): SpeciesProvenanceRecord => ({ seen, n: seen.length, at: 0 })
const snap = (
  checklists: string[], excludedNames: string[], exoticNames: string[] | null,
  species: Record<string, SpeciesProvenanceRecord> = {},
): ProvenanceSnapshot => ({ checklists: new Set(checklists), species: new Map(Object.entries(species)), excludedNames, exoticNames })

const OBS = [obs('Mandarin Duck', 'S1'), obs('Mandarin Duck', 'S2'), obs('Rock Pigeon', 'S1'), obs('Rock Pigeon', 'S3'), obs('American Robin', 'S3')]
const CODES = { 'Mandarin Duck': 'mandar', 'Rock Pigeon': 'rocpig', 'American Robin': 'amerob' }

describe('the two published lists (FR-14 to FR-19)', () => {
  it('honors a published escapee name only when every carrier is consulted (QA-16)', () => {
    expect([...lifeListsClassification(snap(['S1', 'S2'], ['Mandarin Duck'], []), OBS).escapees]).toEqual(['Mandarin Duck'])
    expect(lifeListsClassification(snap(['S1'], ['Mandarin Duck'], []), OBS).escapees.size).toBe(0)
  })

  it('reads the exotic list as published, an unconsulted carrier included (QA-17, the brief rule)', () => {
    // Rock Pigeon's S3 was never consulted; the exotic rule judges the
    // consulted observations, so the published name stands.
    expect([...lifeListsClassification(snap(['S1'], [], ['Rock Pigeon']), OBS).exotics]).toEqual(['Rock Pigeon'])
  })

  it('an unpublished exotic list classifies nothing (FR-19)', () => {
    expect(lifeListsClassification(snap(['S1', 'S2', 'S3'], [], null), OBS).exotics.size).toBe(0)
  })
})

describe("the status reads Statistics' own completion for this export (FR-20, QA-21)", () => {
  const settled = { mandar: rec(['X|']), rocpig: rec(['N|']), amerob: rec(['|']) }

  it('is complete when every coded species has an answer, though most checklists were never consulted', () => {
    // The cover consulted S1 and S2 for the escapee and S3 for the rest; the
    // point is the per-species answer, never "every checklist in the ledger".
    expect(statisticsCheckComplete(snap(['S1', 'S2', 'S3'], [], [], settled), OBS, CODES)).toBe(true)
    expect(statisticsCheckComplete(snap(['S1', 'S2'], [], [], { mandar: rec(['X|']), rocpig: rec(['N|']), amerob: rec(['|']) }), OBS, CODES)).toBe(true)
  })

  it('is not complete while a species is unknown or an all-X species awaits a carrier', () => {
    expect(statisticsCheckComplete(snap(['S1', 'S2'], [], [], { mandar: rec(['X|']), rocpig: rec(['N|']) }), OBS, CODES)).toBe(false)
    expect(statisticsCheckComplete(snap(['S1'], [], [], settled), OBS, CODES)).toBe(false)
  })

  it('is never complete without this roster\'s codes, with nothing consulted, or on a vacuous index', () => {
    expect(statisticsCheckComplete(snap(['S1', 'S2', 'S3'], [], [], settled), OBS, null)).toBe(false)
    expect(statisticsCheckComplete(snap([], [], [], {}), OBS, CODES)).toBe(false)
    expect(statisticsCheckComplete(snap(['S1', 'S2', 'S3'], [], [], settled), OBS, {})).toBe(false)
  })

  it('reads the code table through Object.hasOwn, so a __proto__ name is an ordinary key', () => {
    const hostile = [...OBS, obs('__proto__', 'S3')]
    const codes = JSON.parse('{"Mandarin Duck":"mandar","Rock Pigeon":"rocpig","American Robin":"amerob"}')
    expect(statisticsCheckComplete(snap(['S1', 'S2', 'S3'], [], [], settled), hostile, codes)).toBe(true)
  })
})
