// Test-only row builders for the Hotspot Reports suites. Nothing in the app
// imports this file.
//
// Rows are built as the parser delivers them (every field present, nulls where a
// cell is blank), so a suite never hands the derivation a shape the parse
// cannot produce. `checklist` builds every row of one submission from one
// header, which is the shape an eBird export has: the checklist-level cells are
// repeated on each of its rows.

import type { ObservationEntry } from '../types'
import type { MLExportRow } from '../lib/parseMLExport'

export function row(over: Partial<ObservationEntry> = {}): ObservationEntry {
  return {
    submissionId: 'S1', commonName: 'Song Sparrow', scientificName: 'Melospiza melodia',
    date: '2024-05-01', location: 'Pond', locationId: 'L1',
    latitude: 40.5, longitude: -73.5, county: 'Kings', count: 1, breedingCode: null,
    speciesComments: '', catalogIds: [], time: '07:00 AM', duration: 60, distance: 1, area: null,
    protocol: 'P22', numObservers: 1, allObsReported: true, checklistComments: '', stateProvince: 'US-NY',
    ...over,
  }
}

export interface ChecklistSpec extends Partial<ObservationEntry> {
  species: readonly string[]
}

/** Every row of one checklist, its checklist-level cells repeated per row. */
export function checklist(spec: ChecklistSpec): ObservationEntry[] {
  const { species, ...cells } = spec
  return species.map(name => row({ ...cells, commonName: name, scientificName: `Sci ${name}` }))
}

export function mlRow(over: Partial<MLExportRow> = {}): MLExportRow {
  return {
    catalogId: '1', commonName: 'Song Sparrow', scientificName: 'Melospiza melodia', format: 'Photo',
    date: '2024-05-01', location: 'Pond', county: 'Kings', latitude: 40.5, longitude: -73.5,
    caption: '', mediaNotes: '', observationDetails: '', ageSex: '', behaviors: '', time: '700',
    year: 2024, month: 5, avgRating: null, numRatings: 0, checklistId: 'S1',
    ...over,
  }
}
