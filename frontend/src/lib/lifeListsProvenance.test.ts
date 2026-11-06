// The Life Lists passive provenance reader (life-lists-tab schema 3.5; FR-14 to
// FR-20; QA-16, QA-17, QA-19 to QA-21). Pure rows over the shared model; the
// import-graph half of FR-14 lives in exoticProvenanceGraph.test.ts.

import { describe, it, expect } from 'vitest'
import type { ObservationEntry } from '../types'
import type { ProvenanceSnapshot } from './exoticProvenance'
import { ledgerCoversExport, lifeListsProvenance } from './lifeListsProvenance'

function obs(commonName: string, submissionId: string): ObservationEntry {
  return {
    submissionId, commonName, scientificName: '', date: '2020-01-01', location: 'L', locationId: 'L1',
    latitude: null, longitude: null, county: null, count: 1, breedingCode: null, speciesComments: '', catalogIds: [],
  }
}
const snap = (checklists: string[], excludedNames: string[], exoticNames: string[] | null): ProvenanceSnapshot =>
  ({ checklists: new Set(checklists), species: new Map(), excludedNames, exoticNames })

const OBS = [obs('Mandarin Duck', 'S1'), obs('Mandarin Duck', 'S2'), obs('Rock Pigeon', 'S1'), obs('American Robin', 'S3')]

describe('ledgerCoversExport (FR-20)', () => {
  it('is true only when every submission id in the backup has been consulted', () => {
    expect(ledgerCoversExport(snap(['S1', 'S2', 'S3'], [], null), OBS)).toBe(true)
    expect(ledgerCoversExport(snap(['S1', 'S2'], [], null), OBS)).toBe(false)
    expect(ledgerCoversExport(snap([], [], null), [])).toBe(true)
  })
})

describe('lifeListsProvenance: both lists confirmed by one mechanism (FR-14 to FR-19)', () => {
  it('honors a published name only when every carrier is consulted (QA-16)', () => {
    expect([...lifeListsProvenance(snap(['S1', 'S2'], ['Mandarin Duck'], []), OBS).escapees]).toEqual(['Mandarin Duck'])
    expect(lifeListsProvenance(snap(['S1'], ['Mandarin Duck'], []), OBS).escapees.size).toBe(0)
  })

  it('confirms the exotic list the same way (QA-17)', () => {
    const p = lifeListsProvenance(snap(['S1', 'S2', 'S3'], [], ['Rock Pigeon']), OBS)
    expect([...p.exotics]).toEqual(['Rock Pigeon'])
    expect(p.exoticsPublished).toBe(true)
  })

  it('an unpublished exotic list is unresolved: no exotics, and the status says not finished (FR-19, QA-21)', () => {
    const p = lifeListsProvenance(snap(['S1', 'S2', 'S3'], [], null), OBS)
    expect(p.exotics.size).toBe(0)
    expect(p.exoticsPublished).toBe(false)
    expect(p.ledgerCoversExport).toBe(true)
  })

  it('an empty snapshot classifies nothing (QA-20)', () => {
    const p = lifeListsProvenance({ checklists: new Set(), species: new Map(), excludedNames: [], exoticNames: null }, OBS)
    expect(p.escapees.size + p.exotics.size).toBe(0)
    expect(p.ledgerCoversExport).toBe(false)
  })
})
