import { describe, it, expect } from 'vitest'
import { parseMLExport } from './parseMLExport'

const H = 'Catalog Number,Common Name,Scientific Name,Format'

function csv(...rows: string[]) {
  return [H, ...rows].join('\n')
}

describe('parseMLExport', () => {
  it('produces entries and mediaMap from a valid export', () => {
    const { entries, mediaMap } = parseMLExport(csv(
      '111111,American Robin,Turdus migratorius,Photo',
    ))
    expect(entries).toHaveLength(1)
    expect(entries[0].commonName).toBe('American Robin')
    expect(mediaMap['111111']).toBe('Photo')
  })

  it('groups multiple rows per species into one entry', () => {
    const { entries, mediaMap } = parseMLExport(csv(
      '111111,American Robin,Turdus migratorius,Photo',
      '222222,American Robin,Turdus migratorius,Audio',
    ))
    expect(entries).toHaveLength(1)
    expect(entries[0].catalogIds).toContain('111111')
    expect(entries[0].catalogIds).toContain('222222')
    expect(mediaMap['111111']).toBe('Photo')
    expect(mediaMap['222222']).toBe('Audio')
  })

  it('strips ML prefix from catalog numbers', () => {
    const { entries, mediaMap } = parseMLExport(csv(
      'ML204818731,American Robin,Turdus migratorius,Photo',
    ))
    expect(entries[0].catalogIds).toContain('204818731')
    expect(mediaMap['204818731']).toBe('Photo')
    expect(mediaMap['ML204818731']).toBeUndefined()
  })

  it('accepts ML Catalog Number as an alternative header', () => {
    const altHeader = 'ML Catalog Number,Common Name,Scientific Name,Format'
    const text = [altHeader, 'ML111111,Song Sparrow,Melospiza melodia,Audio'].join('\n')
    const { entries, mediaMap } = parseMLExport(text)
    expect(entries).toHaveLength(1)
    expect(mediaMap['111111']).toBe('Audio')
  })

  it('normalizes subspecies parentheticals into one entry', () => {
    const { entries } = parseMLExport(csv(
      '111111,Yellow-rumped Warbler (Myrtle),Setophaga coronata,Photo',
      '222222,Yellow-rumped Warbler (Audubon\'s),Setophaga coronata,Photo',
    ))
    expect(entries).toHaveLength(1)
    expect(entries[0].commonName).toBe('Yellow-rumped Warbler')
  })

  it('excludes spuh entries', () => {
    const { entries } = parseMLExport(csv('111111,Thrush sp.,Turdus sp.,Photo'))
    expect(entries).toHaveLength(0)
  })

  it('excludes slash species', () => {
    const { entries } = parseMLExport(csv('111111,Cackling/Canada Goose,Branta sp.,Photo'))
    expect(entries).toHaveLength(0)
  })

  it('excludes hybrid species', () => {
    const { entries } = parseMLExport(csv('111111,Mallard x Mottled Duck,Anas sp.,Photo'))
    expect(entries).toHaveLength(0)
  })

  it('ignores rows with unknown Format values', () => {
    const { entries, mediaMap } = parseMLExport(csv(
      '111111,American Robin,Turdus migratorius,Unknown',
      '222222,American Robin,Turdus migratorius,Photo',
    ))
    expect(mediaMap['111111']).toBeUndefined()
    expect(mediaMap['222222']).toBe('Photo')
    expect(entries).toHaveLength(1)
  })

  it('sorts entries alphabetically', () => {
    const { entries } = parseMLExport(csv(
      '111111,Song Sparrow,Melospiza melodia,Photo',
      '222222,American Robin,Turdus migratorius,Photo',
    ))
    expect(entries[0].commonName).toBe('American Robin')
    expect(entries[1].commonName).toBe('Song Sparrow')
  })

  it('sets taxonomicOrder to Infinity for all entries', () => {
    const { entries } = parseMLExport(csv(
      '111111,American Robin,Turdus migratorius,Photo',
    ))
    expect(entries[0].taxonomicOrder).toBe(Infinity)
  })

  it('skips rows with non-numeric catalog numbers', () => {
    const { entries } = parseMLExport(csv(
      'abc,American Robin,Turdus migratorius,Photo',
      '111111,American Robin,Turdus migratorius,Audio',
    ))
    expect(entries[0].catalogIds).not.toContain('abc')
    expect(entries[0].catalogIds).toContain('111111')
  })

  it('includes soundscape entries', () => {
    const { entries, mediaMap } = parseMLExport(csv('111111,Soundscape,,Audio'))
    expect(entries).toHaveLength(1)
    expect(entries[0].commonName).toBe('Soundscape')
    expect(mediaMap['111111']).toBe('Audio')
  })

  it('throws INVALID_ML_EXPORT when required columns are missing', () => {
    const bad = ['Common Name,Scientific Name', 'American Robin,Turdus migratorius'].join('\n')
    expect(() => parseMLExport(bad)).toThrow('INVALID_ML_EXPORT')
  })

  it('throws INVALID_ML_EXPORT on empty input', () => {
    expect(() => parseMLExport('')).toThrow('INVALID_ML_EXPORT')
  })
})
