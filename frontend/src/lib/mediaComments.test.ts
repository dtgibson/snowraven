import { describe, it, expect } from 'vitest'
import type { MLExportRow } from './parseMLExport'
import { hasMediaComment, pickComment, filterAndSortMediaComments } from './mediaComments'

function row(p: Partial<MLExportRow> & { catalogId: string }): MLExportRow {
  return {
    commonName: 'American Robin', scientificName: 'Turdus migratorius',
    format: 'Photo', date: '2024-01-01', location: 'Loc', county: null,
    latitude: null, longitude: null,
    caption: '', mediaNotes: '', observationDetails: '',
    ageSex: '', behaviors: '', time: '', year: null, month: null, avgRating: null, numRatings: 0, checklistId: '',
    ...p,
  }
}

describe('hasMediaComment', () => {
  it('is false when no per-asset comment is set', () => {
    expect(hasMediaComment(row({ catalogId: '1' }))).toBe(false)
  })
  it('is true for a Caption or a Media note', () => {
    expect(hasMediaComment(row({ catalogId: '1', mediaNotes: 'x' }))).toBe(true)
    expect(hasMediaComment(row({ catalogId: '3', caption: 'z' }))).toBe(true)
  })
  it('ignores Observation Details (the observation comment, duplicated across media)', () => {
    expect(hasMediaComment(row({ catalogId: '2', observationDetails: 'y' }))).toBe(false)
  })
  it('ignores whitespace-only fields', () => {
    expect(hasMediaComment(row({ catalogId: '1', caption: '   ' }))).toBe(false)
  })
})

describe('pickComment', () => {
  it('prefers Media notes, then Caption, and never surfaces Observation Details', () => {
    expect(pickComment(row({ catalogId: '1', caption: 'cap', mediaNotes: 'note', observationDetails: 'obs' })))
      .toEqual({ field: 'mediaNotes', text: 'note' })
    expect(pickComment(row({ catalogId: '3', caption: 'cap' })))
      .toEqual({ field: 'caption', text: 'cap' })
  })
  it('returns null when there is no per-asset comment, even if Observation Details is set', () => {
    expect(pickComment(row({ catalogId: '1' }))).toBeNull()
    expect(pickComment(row({ catalogId: '2', observationDetails: 'obs only' }))).toBeNull()
  })
  it('returns the per-asset field that MATCHES the query', () => {
    const r = row({ catalogId: '1', mediaNotes: 'sunrise over the marsh', caption: 'heard a warbler singing' })
    expect(pickComment(r, 'warbler')).toEqual({ field: 'caption', text: 'heard a warbler singing' })
  })
  it('does not match the query against Observation Details', () => {
    // 'distinctive' is only in Observation Details → no match, falls back to the caption.
    const r = row({ catalogId: '1', observationDetails: 'distinctive obs text', caption: 'a caption' })
    expect(pickComment(r, 'distinctive')).toEqual({ field: 'caption', text: 'a caption' })
  })
  it('falls back to the priority field when the query matches none', () => {
    const r = row({ catalogId: '1', mediaNotes: 'note', caption: 'cap' })
    expect(pickComment(r, 'zzz')).toEqual({ field: 'mediaNotes', text: 'note' })
  })
})

describe('filterAndSortMediaComments', () => {
  const rows = [
    row({ catalogId: '1', date: '2024-03-01', observationDetails: 'foraging in the reeds' }), // obs-only → excluded
    row({ catalogId: '2', date: '2024-05-01', caption: 'singing male' }),
    row({ catalogId: '3', date: '2024-04-01', mediaNotes: 'distant flock' }),
    row({ catalogId: '4', date: '2024-06-01' }), // no comment — excluded
  ]
  it('keeps only rows with a per-asset comment (Observation-Details-only rows excluded), newest first', () => {
    expect(filterAndSortMediaComments(rows, '', 'newest').map(r => r.catalogId)).toEqual(['2', '3'])
  })
  it('sorts oldest first', () => {
    expect(filterAndSortMediaComments(rows, '', 'oldest').map(r => r.catalogId)).toEqual(['3', '2'])
  })
  it('filters case-insensitively across Caption and Media notes only', () => {
    expect(filterAndSortMediaComments(rows, 'SINGING', 'newest').map(r => r.catalogId)).toEqual(['2'])
    expect(filterAndSortMediaComments(rows, 'flock', 'newest').map(r => r.catalogId)).toEqual(['3'])
    // Observation Details text is NOT searchable in the media comments.
    expect(filterAndSortMediaComments(rows, 'foraging', 'newest')).toHaveLength(0)
    expect(filterAndSortMediaComments(rows, 'zzz', 'newest')).toHaveLength(0)
  })
})
