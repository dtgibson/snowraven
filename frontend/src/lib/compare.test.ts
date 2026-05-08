import { describe, it, expect } from 'vitest'
import { compareSpecies } from './compare'

describe('compareSpecies', () => {
  it('computes intersection, A-only, and B-only correctly', () => {
    const a = new Set(['American Robin', 'Blue Jay', 'Mallard'])
    const b = new Set(['Blue Jay', 'Mallard', 'Canada Goose'])

    const result = compareSpecies(a, b)
    expect(result.both).toEqual(['Blue Jay', 'Mallard'])
    expect(result.aOnly).toEqual(['American Robin'])
    expect(result.bOnly).toEqual(['Canada Goose'])
  })

  it('sorts all lists alphabetically', () => {
    const a = new Set(['Mallard', 'American Robin', 'Blue Jay'])
    const b = new Set(['Mallard', 'Canada Goose', 'Blue Jay'])

    const result = compareSpecies(a, b)
    expect(result.both).toEqual(['Blue Jay', 'Mallard'])
    expect(result.aOnly).toEqual(['American Robin'])
    expect(result.bOnly).toEqual(['Canada Goose'])
  })

  it('handles no overlap', () => {
    const a = new Set(['American Robin'])
    const b = new Set(['Blue Jay'])

    const result = compareSpecies(a, b)
    expect(result.both).toEqual([])
    expect(result.aOnly).toEqual(['American Robin'])
    expect(result.bOnly).toEqual(['Blue Jay'])
  })

  it('handles complete overlap', () => {
    const a = new Set(['American Robin', 'Blue Jay'])
    const b = new Set(['American Robin', 'Blue Jay'])

    const result = compareSpecies(a, b)
    expect(result.both).toEqual(['American Robin', 'Blue Jay'])
    expect(result.aOnly).toEqual([])
    expect(result.bOnly).toEqual([])
  })

  it('handles empty sets', () => {
    const result = compareSpecies(new Set(), new Set())
    expect(result.both).toEqual([])
    expect(result.aOnly).toEqual([])
    expect(result.bOnly).toEqual([])
  })

  it('returns correct species totals', () => {
    const a = new Set(['A', 'B', 'C'])
    const b = new Set(['B', 'C', 'D', 'E'])

    const result = compareSpecies(a, b)
    expect(result.totalA).toBe(3)
    expect(result.totalB).toBe(4)
  })
})
