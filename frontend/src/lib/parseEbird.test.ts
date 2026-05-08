import { describe, it, expect } from 'vitest'
import { parseEbirdCSV } from './parseEbird'

describe('parseEbirdCSV', () => {
  it('extracts unique species from a valid eBird CSV', () => {
    const csv = [
      'Submission ID,Common Name,Scientific Name',
      'S1,American Robin,Turdus migratorius',
      'S2,American Robin,Turdus migratorius',
      'S3,Blue Jay,Cyanocitta cristata',
    ].join('\n')

    const result = parseEbirdCSV('test.csv', csv)
    expect(result.species).toEqual(new Set(['American Robin', 'Blue Jay']))
    expect(result.filename).toBe('test.csv')
  })

  it('is case-insensitive for the column header', () => {
    const csv = 'submission id,common name,scientific name\nS1,American Robin,Turdus migratorius'
    const result = parseEbirdCSV('test.csv', csv)
    expect(result.species.has('American Robin')).toBe(true)
  })

  it('throws INVALID_EBIRD when Common Name column is missing', () => {
    const csv = 'Submission ID,Scientific Name\nS1,Turdus migratorius'
    expect(() => parseEbirdCSV('test.csv', csv)).toThrow('INVALID_EBIRD')
  })

  it('throws INVALID_EBIRD for empty content', () => {
    expect(() => parseEbirdCSV('test.csv', '')).toThrow('INVALID_EBIRD')
  })

  it('handles Windows-style line endings (CRLF)', () => {
    const csv = 'Submission ID,Common Name\r\nS1,American Robin\r\nS2,Blue Jay'
    const result = parseEbirdCSV('test.csv', csv)
    expect(result.species).toEqual(new Set(['American Robin', 'Blue Jay']))
  })

  it('handles quoted fields containing commas', () => {
    const csv = 'Submission ID,Common Name,Location\nS1,American Robin,"Central Park, New York"'
    const result = parseEbirdCSV('test.csv', csv)
    expect(result.species.has('American Robin')).toBe(true)
  })

  it('skips blank rows', () => {
    const csv = 'Submission ID,Common Name\nS1,American Robin\n\nS2,Blue Jay'
    const result = parseEbirdCSV('test.csv', csv)
    expect(result.species.size).toBe(2)
  })

  it('excludes spuh entries ending with " sp."', () => {
    const csv = [
      'Submission ID,Common Name',
      'S1,American Robin',
      'S2,gull sp.',
      'S3,Accipiter sp.',
    ].join('\n')
    const result = parseEbirdCSV('test.csv', csv)
    expect(result.species).toEqual(new Set(['American Robin']))
  })

  it('excludes slash entries for uncertain identifications', () => {
    const csv = [
      'Submission ID,Common Name',
      'S1,American Robin',
      'S2,Greater/Lesser Scaup',
      'S3,Aythya affinis/marila',
    ].join('\n')
    const result = parseEbirdCSV('test.csv', csv)
    expect(result.species).toEqual(new Set(['American Robin']))
  })

  it('maps subspecies entries to their parent species name', () => {
    const csv = [
      'Submission ID,Common Name',
      "S1,Yellow-rumped Warbler",
      "S2,Yellow-rumped Warbler (Audubon's)",
      'S3,Dark-eyed Junco (Slate-colored)',
      'S4,Mallard (Domestic type)',
    ].join('\n')
    const result = parseEbirdCSV('test.csv', csv)
    expect(result.species).toEqual(new Set(['Yellow-rumped Warbler', 'Dark-eyed Junco', 'Mallard']))
  })

  it('counts a species seen only under a subspecies name', () => {
    const csv = [
      'Submission ID,Common Name',
      'S1,American Robin',
      'S2,Yellow-rumped Warbler (Myrtle)',
    ].join('\n')
    const result = parseEbirdCSV('test.csv', csv)
    expect(result.species).toEqual(new Set(['American Robin', 'Yellow-rumped Warbler']))
  })

  it('excludes hybrid entries containing " x "', () => {
    const csv = [
      'Submission ID,Common Name',
      'S1,American Robin',
      'S2,Mallard x American Black Duck (hybrid)',
      'S3,Glaucous-winged x Western Gull',
    ].join('\n')
    const result = parseEbirdCSV('test.csv', csv)
    expect(result.species).toEqual(new Set(['American Robin']))
  })
})
