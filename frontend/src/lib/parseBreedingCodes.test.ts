import { describe, it, expect } from 'vitest'
import { parseBreedingCodes } from './parseBreedingCodes'

const H = 'Submission ID,Common Name,Scientific Name,Taxonomic Order,Breeding Code'

function csv(...rows: string[]) {
  return [H, ...rows].join('\n')
}

describe('parseBreedingCodes', () => {
  it('throws INVALID_EBIRD on empty input', () => {
    expect(() => parseBreedingCodes('')).toThrow('INVALID_EBIRD')
  })

  it('throws INVALID_EBIRD when Common Name column is absent', () => {
    expect(() => parseBreedingCodes('Submission ID,Foo,Bar\nS1,x,y')).toThrow('INVALID_EBIRD')
  })

  it('returns hasBreedingCodeColumn false when Breeding Code column is absent', () => {
    const text = 'Submission ID,Common Name,Scientific Name\nS1,American Robin,Turdus migratorius'
    const result = parseBreedingCodes(text)
    expect(result.hasBreedingCodeColumn).toBe(false)
    expect(result.entries).toHaveLength(0)
    expect(result.codesPresent).toHaveLength(0)
  })

  it('parses a valid entry', () => {
    const { entries, codesPresent, hasBreedingCodeColumn } = parseBreedingCodes(csv(
      'S1,American Robin,Turdus migratorius,340,NY',
    ))
    expect(hasBreedingCodeColumn).toBe(true)
    expect(entries).toHaveLength(1)
    expect(entries[0].commonName).toBe('American Robin')
    expect(entries[0].scientificName).toBe('Turdus migratorius')
    expect(entries[0].codes['NY']).toBe(1)
    expect(codesPresent).toContain('NY')
  })

  it('accumulates multiple codes for the same species', () => {
    const { entries } = parseBreedingCodes(csv(
      'S1,American Robin,Turdus migratorius,340,NY',
      'S2,American Robin,Turdus migratorius,340,NY',
      'S3,American Robin,Turdus migratorius,340,S',
    ))
    expect(entries).toHaveLength(1)
    expect(entries[0].codes['NY']).toBe(2)
    expect(entries[0].codes['S']).toBe(1)
  })

  it('handles multi-character codes like S7', () => {
    const { entries, codesPresent } = parseBreedingCodes(csv(
      'S1,Song Sparrow,Melospiza melodia,1540,S7',
    ))
    expect(entries[0].codes['S7']).toBe(1)
    expect(codesPresent).toContain('S7')
  })

  it('ignores unknown breeding codes', () => {
    const { entries } = parseBreedingCodes(csv(
      'S1,American Robin,Turdus migratorius,340,ZZ',
    ))
    expect(entries).toHaveLength(0)
  })

  it('ignores rows with an empty code', () => {
    const { entries } = parseBreedingCodes(csv(
      'S1,American Robin,Turdus migratorius,340,',
    ))
    expect(entries).toHaveLength(0)
  })

  it('excludes slash species', () => {
    const { entries } = parseBreedingCodes(csv(
      'S1,Greater/Lesser Scaup,Aythya sp.,160,NY',
    ))
    expect(entries).toHaveLength(0)
  })

  it('excludes sp. species', () => {
    const { entries } = parseBreedingCodes(csv(
      'S1,Duck sp.,Anas sp.,170,NY',
    ))
    expect(entries).toHaveLength(0)
  })

  it('excludes hybrid species containing " x "', () => {
    const { entries } = parseBreedingCodes(csv(
      'S1,Mallard x Gadwall,Anas x,180,NY',
    ))
    expect(entries).toHaveLength(0)
  })

  it('normalizes subspecies parentheticals into one species entry', () => {
    const { entries } = parseBreedingCodes(csv(
      'S1,Yellow-rumped Warbler (Myrtle),Setophaga coronata,725,S',
      "S2,Yellow-rumped Warbler (Audubon's),Setophaga coronata,725,H",
    ))
    expect(entries).toHaveLength(1)
    expect(entries[0].commonName).toBe('Yellow-rumped Warbler')
    expect(entries[0].codes['S']).toBe(1)
    expect(entries[0].codes['H']).toBe(1)
  })

  it('returns entries sorted alphabetically by common name', () => {
    const { entries } = parseBreedingCodes(csv(
      'S1,Song Sparrow,Melospiza melodia,1540,S',
      'S2,American Robin,Turdus migratorius,340,NY',
    ))
    expect(entries[0].commonName).toBe('American Robin')
    expect(entries[1].commonName).toBe('Song Sparrow')
  })

  it('returns codesPresent in canonical order (higher tiers first)', () => {
    const { codesPresent } = parseBreedingCodes(csv(
      'S1,American Robin,Turdus migratorius,340,S',
      'S2,American Robin,Turdus migratorius,340,NY',
    ))
    expect(codesPresent.indexOf('NY')).toBeLessThan(codesPresent.indexOf('S'))
  })

  it('works when Scientific Name column is absent', () => {
    const text = 'Submission ID,Common Name,Breeding Code\nS1,American Robin,NY'
    const { entries } = parseBreedingCodes(text)
    expect(entries).toHaveLength(1)
    expect(entries[0].scientificName).toBe('')
  })

  it('handles quoted fields', () => {
    const { entries } = parseBreedingCodes(csv(
      'S1,"American Robin",Turdus migratorius,340,NY',
    ))
    expect(entries[0].commonName).toBe('American Robin')
  })

  it('correctly parses a row where a quoted field before the breeding code contains an embedded newline', () => {
    // If a quoted field that appears before the breeding code column spans
    // multiple lines, a line-split parser truncates the row and the breeding
    // code (at a later column index) is never reached. Use a minimal header
    // where Location (index 2) precedes Breeding Code (index 3).
    const text = [
      'Submission ID,Common Name,Location,Breeding Code',
      'S1,Song Sparrow,"River\nTrail",NY',
      'S2,American Robin,Garden,S',
    ].join('\n')
    const { entries } = parseBreedingCodes(text)
    const names = entries.map(e => e.commonName)
    expect(names).toContain('Song Sparrow')
    expect(names).toContain('American Robin')
  })

  it('returns an empty entries array when no rows have valid codes', () => {
    const { entries, hasBreedingCodeColumn } = parseBreedingCodes(csv(
      'S1,American Robin,Turdus migratorius,340,',
    ))
    expect(hasBreedingCodeColumn).toBe(true)
    expect(entries).toHaveLength(0)
  })
})
