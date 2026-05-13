import { describe, it, expect } from 'vitest'
import { compareSpecies } from './compare'
import type { FileData } from '../types'

function fd(species: string[], taxOrder: Record<string, number> = {}): FileData {
  return {
    filename: 'test.csv',
    species: new Set(species),
    taxOrder: new Map(Object.entries(taxOrder)),
  }
}

describe('compareSpecies', () => {
  it('computes intersection, A-only, and B-only correctly', () => {
    const result = compareSpecies(
      fd(['American Robin', 'Blue Jay', 'Mallard']),
      fd(['Blue Jay', 'Mallard', 'Canada Goose']),
    )
    expect(result.both).toEqual(['Blue Jay', 'Mallard'])
    expect(result.aOnly).toEqual(['American Robin'])
    expect(result.bOnly).toEqual(['Canada Goose'])
  })

  it('sorts all lists alphabetically', () => {
    const result = compareSpecies(
      fd(['Mallard', 'American Robin', 'Blue Jay']),
      fd(['Mallard', 'Canada Goose', 'Blue Jay']),
    )
    expect(result.both).toEqual(['Blue Jay', 'Mallard'])
    expect(result.aOnly).toEqual(['American Robin'])
    expect(result.bOnly).toEqual(['Canada Goose'])
  })

  it('handles no overlap', () => {
    const result = compareSpecies(fd(['American Robin']), fd(['Blue Jay']))
    expect(result.both).toEqual([])
    expect(result.aOnly).toEqual(['American Robin'])
    expect(result.bOnly).toEqual(['Blue Jay'])
  })

  it('handles complete overlap', () => {
    const result = compareSpecies(
      fd(['American Robin', 'Blue Jay']),
      fd(['American Robin', 'Blue Jay']),
    )
    expect(result.both).toEqual(['American Robin', 'Blue Jay'])
    expect(result.aOnly).toEqual([])
    expect(result.bOnly).toEqual([])
  })

  it('handles empty sets', () => {
    const result = compareSpecies(fd([]), fd([]))
    expect(result.both).toEqual([])
    expect(result.aOnly).toEqual([])
    expect(result.bOnly).toEqual([])
  })

  it('returns correct species totals', () => {
    const result = compareSpecies(fd(['A', 'B', 'C']), fd(['B', 'C', 'D', 'E']))
    expect(result.totalA).toBe(3)
    expect(result.totalB).toBe(4)
  })

  it('includes merged taxonomic order in result', () => {
    const result = compareSpecies(
      fd(['Canada Goose', 'Mallard'], { 'Canada Goose': 10, Mallard: 50 }),
      fd(['Mallard', 'Blue Jay'], { Mallard: 50, 'Blue Jay': 200 }),
    )
    expect(result.taxOrder.get('Canada Goose')).toBe(10)
    expect(result.taxOrder.get('Mallard')).toBe(50)
    expect(result.taxOrder.get('Blue Jay')).toBe(200)
  })

  it('prefers File A taxonomic order for species in both lists', () => {
    const result = compareSpecies(
      fd(['Mallard'], { Mallard: 40 }),
      fd(['Mallard'], { Mallard: 99 }),
    )
    expect(result.taxOrder.get('Mallard')).toBe(40)
  })
})
