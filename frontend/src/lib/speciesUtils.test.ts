import { describe, it, expect } from 'vitest'
import { normalizeSpeciesName, isSpuhOrSlash } from './speciesUtils'

describe('normalizeSpeciesName', () => {
  it('returns name unchanged when no parenthetical', () => {
    expect(normalizeSpeciesName('Canada Goose')).toBe('Canada Goose')
  })

  it('strips trailing subspecies parenthetical', () => {
    expect(normalizeSpeciesName('Yellow-rumped Warbler (Myrtle)')).toBe('Yellow-rumped Warbler')
  })

  it('strips domestic type parenthetical', () => {
    expect(normalizeSpeciesName('Mallard (Domestic type)')).toBe('Mallard')
  })

  it('strips parenthetical with trailing whitespace', () => {
    expect(normalizeSpeciesName("Audubon's Warbler (Yellow-rumped) ")).toBe("Audubon's Warbler")
  })

  it('does not strip mid-name parenthetical', () => {
    expect(normalizeSpeciesName('Eastern (rare) Warbler')).toBe('Eastern (rare) Warbler')
  })

  it('handles empty string', () => {
    expect(normalizeSpeciesName('')).toBe('')
  })
})

describe('isSpuhOrSlash', () => {
  it('returns true for sp. entry', () => {
    expect(isSpuhOrSlash('Accipiter sp.')).toBe(true)
  })

  it('returns true for slash species', () => {
    expect(isSpuhOrSlash("Sharp-shinned/Cooper's Hawk")).toBe(true)
  })

  it('returns false for normal species name', () => {
    expect(isSpuhOrSlash('Red-tailed Hawk')).toBe(false)
  })

  it('returns false for species with sp in name but not ending sp.', () => {
    expect(isSpuhOrSlash('Spotted Sandpiper')).toBe(false)
  })

  it('returns false for empty string', () => {
    expect(isSpuhOrSlash('')).toBe(false)
  })
})
