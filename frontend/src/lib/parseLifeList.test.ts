import { describe, it, expect } from 'vitest'
import { parseLifeList } from './parseLifeList'

const H = 'Common Name,Scientific Name,Taxonomic Order,ML Catalog Numbers'

function csv(...rows: string[]) {
  return [H, ...rows].join('\n')
}

describe('parseLifeList', () => {
  it('deduplicates species across multiple rows', () => {
    const result = parseLifeList(csv(
      'American Robin,Turdus migratorius,15550,ML111111',
      'American Robin,Turdus migratorius,15550,ML222222',
    ))
    expect(result).toHaveLength(1)
    expect(result[0].commonName).toBe('American Robin')
  })

  it('unions catalog IDs across multiple rows for same species', () => {
    const result = parseLifeList(csv(
      'American Robin,Turdus migratorius,15550,ML111111',
      'American Robin,Turdus migratorius,15550,ML222222 ML333333',
    ))
    expect(result[0].catalogIds).toContain('111111')
    expect(result[0].catalogIds).toContain('222222')
    expect(result[0].catalogIds).toContain('333333')
  })

  it('deduplicates catalog IDs within a species', () => {
    const result = parseLifeList(csv(
      'American Robin,Turdus migratorius,15550,ML111111',
      'American Robin,Turdus migratorius,15550,ML111111',
    ))
    expect(result[0].catalogIds.filter(id => id === '111111')).toHaveLength(1)
  })

  it('excludes spuh entries', () => {
    expect(parseLifeList(csv('Thrush sp.,Turdus sp.,0,'))).toHaveLength(0)
  })

  it('excludes slash species', () => {
    expect(parseLifeList(csv('Cackling/Canada Goose,Branta sp.,0,'))).toHaveLength(0)
  })

  it('excludes hybrid species', () => {
    expect(parseLifeList(csv('Mallard x Mottled Duck,Anas sp.,0,'))).toHaveLength(0)
  })

  it('strips ML prefix from catalog numbers', () => {
    const result = parseLifeList(csv('American Robin,Turdus migratorius,15550,ML204818731'))
    expect(result[0].catalogIds).toContain('204818731')
    expect(result[0].catalogIds).not.toContain('ML204818731')
  })

  it('parses space-separated catalog numbers', () => {
    const result = parseLifeList(csv('American Robin,Turdus migratorius,15550,ML111 ML222 ML333'))
    expect(result[0].catalogIds).toHaveLength(3)
  })

  it('handles empty ML catalog numbers', () => {
    const result = parseLifeList(csv('American Robin,Turdus migratorius,15550,'))
    expect(result[0].catalogIds).toHaveLength(0)
  })

  it('sorts by taxonomic order ascending', () => {
    const result = parseLifeList(csv(
      'American Robin,Turdus migratorius,15550,',
      'Canada Goose,Branta canadensis,170,',
    ))
    expect(result[0].commonName).toBe('Canada Goose')
    expect(result[1].commonName).toBe('American Robin')
  })

  it('uses the lowest taxonomic order when species appears in multiple rows', () => {
    const result = parseLifeList(csv(
      'American Robin,Turdus migratorius,15551,',
      'American Robin,Turdus migratorius,15550,',
    ))
    expect(result[0].taxonomicOrder).toBe(15550)
  })

  it('sorts species with missing taxonomic order to end, alphabetically among themselves', () => {
    const result = parseLifeList(csv(
      'Zebra Finch,Taeniopygia guttata,,',
      'American Finch,Haemorhous mexicanus,,',
      'Canada Goose,Branta canadensis,170,',
    ))
    expect(result[0].commonName).toBe('Canada Goose')
    expect(result[1].commonName).toBe('American Finch')
    expect(result[2].commonName).toBe('Zebra Finch')
  })

  it('throws INVALID_EBIRD if Common Name column is absent', () => {
    const bad = ['Scientific Name,Taxonomic Order', 'Turdus migratorius,15550'].join('\n')
    expect(() => parseLifeList(bad)).toThrow('INVALID_EBIRD')
  })

  it('throws INVALID_EBIRD on empty input', () => {
    expect(() => parseLifeList('')).toThrow('INVALID_EBIRD')
  })
})
