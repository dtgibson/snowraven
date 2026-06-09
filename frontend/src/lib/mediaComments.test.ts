import { describe, it, expect } from 'vitest'
import type { MLExportRow } from './parseMLExport'
import { hasMediaComment, pickComment, filterAndSortMediaComments } from './mediaComments'

function row(p: Partial<MLExportRow> & { catalogId: string }): MLExportRow {
  return {
    commonName: 'American Robin', scientificName: 'Turdus migratorius',
    format: 'Photo', date: '2024-01-01', location: 'Loc', county: null,
    latitude: null, longitude: null,
    caption: '', mediaNotes: '', observationDetails: '',
    ageSex: '', behaviors: '', time: '', year: null, month: null, avgRating: null, numRatings: 0,
    ...p,
  }
}

describe('hasMediaComment', () => {
  it('is false when no comment field is set', () => {
    expect(hasMediaComment(row({ catalogId: '1' }))).toBe(false)
  })
  it('is true when any comment field is set', () => {
    expect(hasMediaComment(row({ catalogId: '1', mediaNotes: 'x' }))).toBe(true)
    expect(hasMediaComment(row({ catalogId: '2', observationDetails: 'y' }))).toBe(true)
    expect(hasMediaComment(row({ catalogId: '3', caption: 'z' }))).toBe(true)
  })
  it('ignores whitespace-only fields', () => {
    expect(hasMediaComment(row({ catalogId: '1', caption: '   ' }))).toBe(false)
  })
})

describe('pickComment', () => {
  it('prefers Observation Details, then Media notes, then Caption', () => {
    expect(pickComment(row({ catalogId: '1', caption: 'cap', mediaNotes: 'note', observationDetails: 'obs' })))
      .toEqual({ field: 'observationDetails', text: 'obs' })
    expect(pickComment(row({ catalogId: '2', caption: 'cap', mediaNotes: 'note' })))
      .toEqual({ field: 'mediaNotes', text: 'note' })
    expect(pickComment(row({ catalogId: '3', caption: 'cap' })))
      .toEqual({ field: 'caption', text: 'cap' })
  })
  it('returns null when there is no comment', () => {
    expect(pickComment(row({ catalogId: '1' }))).toBeNull()
  })
  it('returns the field that MATCHES the query, even if lower priority', () => {
    const r = row({ catalogId: '1', observationDetails: 'sunrise over the marsh', caption: 'heard a warbler singing' })
    expect(pickComment(r, 'warbler')).toEqual({ field: 'caption', text: 'heard a warbler singing' })
  })
  it('falls back to the priority field when the query matches none', () => {
    const r = row({ catalogId: '1', observationDetails: 'obs', caption: 'cap' })
    expect(pickComment(r, 'zzz')).toEqual({ field: 'observationDetails', text: 'obs' })
  })
})

describe('filterAndSortMediaComments', () => {
  const rows = [
    row({ catalogId: '1', date: '2024-03-01', observationDetails: 'foraging in the reeds' }),
    row({ catalogId: '2', date: '2024-05-01', caption: 'singing male' }),
    row({ catalogId: '3', date: '2024-04-01', mediaNotes: 'distant flock' }),
    row({ catalogId: '4', date: '2024-06-01' }), // no comment — excluded
  ]
  it('keeps only rows with a comment, newest first', () => {
    expect(filterAndSortMediaComments(rows, '', 'newest').map(r => r.catalogId)).toEqual(['2', '3', '1'])
  })
  it('sorts oldest first', () => {
    expect(filterAndSortMediaComments(rows, '', 'oldest').map(r => r.catalogId)).toEqual(['1', '3', '2'])
  })
  it('filters case-insensitively across all three comment fields', () => {
    expect(filterAndSortMediaComments(rows, 'SINGING', 'newest').map(r => r.catalogId)).toEqual(['2'])
    expect(filterAndSortMediaComments(rows, 'flock', 'newest').map(r => r.catalogId)).toEqual(['3'])
    expect(filterAndSortMediaComments(rows, 'foraging', 'newest').map(r => r.catalogId)).toEqual(['1'])
    expect(filterAndSortMediaComments(rows, 'zzz', 'newest')).toHaveLength(0)
  })
})
