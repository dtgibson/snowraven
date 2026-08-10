import { describe, it, expect } from 'vitest'
import { normalizeSpeciesName, isSpuhOrSlash, isNonCountableSpecies, isNonCountableObservedName } from './speciesUtils'

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

describe('isNonCountableSpecies', () => {
  it('excludes spuh, slash, and hybrid forms', () => {
    expect(isNonCountableSpecies('Gull sp.')).toBe(true)
    expect(isNonCountableSpecies('Greater/Lesser Scaup')).toBe(true)
    expect(isNonCountableSpecies('Mallard x American Black Duck')).toBe(true)
  })
  it('keeps countable species (including the hybrid "x" only as a separated word)', () => {
    expect(isNonCountableSpecies('American Robin')).toBe(false)
    expect(isNonCountableSpecies('Mallard')).toBe(false)
    // "x" must be space-delimited to count as a hybrid marker, not any embedded x.
    expect(isNonCountableSpecies('Xantus\'s Hummingbird')).toBe(false)
  })
})

describe('isNonCountableObservedName', () => {
  // The whole reason this variant exists: a trailing parenthetical can carry its own
  // " x " for a countable intraspecific intergrade. Testing the raw name conflates
  // that with a true inter-species hybrid.
  it('KEEPS intraspecific intergrades, whose " x " is inside the parenthetical', () => {
    expect(isNonCountableObservedName("Yellow-rumped Warbler (Myrtle x Audubon's)")).toBe(false)
    expect(isNonCountableObservedName('Northern Flicker (Yellow-shafted x Red-shafted)')).toBe(false)
    expect(isNonCountableObservedName('Dark-eyed Junco (Oregon x Pink-sided)')).toBe(false)
    expect(isNonCountableObservedName('Green-winged Teal (Eurasian x American)')).toBe(false)
    expect(isNonCountableObservedName('Redpoll (Common x Hoary)')).toBe(false)
  })

  it('still drops true hybrids, whose " x " is in the base name', () => {
    expect(isNonCountableObservedName('Mallard x American Black Duck (hybrid)')).toBe(true)
    expect(isNonCountableObservedName('Mallard x American Black Duck')).toBe(true)
    expect(isNonCountableObservedName('Western x Glaucous-winged Gull (hybrid)')).toBe(true)
  })

  it('still drops spuh and slash', () => {
    expect(isNonCountableObservedName('Gull sp.')).toBe(true)
    expect(isNonCountableObservedName('Greater/Lesser Scaup')).toBe(true)
  })

  // The slash half deliberately tests the RAW name, so subspecies-group slashes stay
  // excluded exactly as before. Normalizing that half too would newly admit them and
  // silently raise life-list totals — a product decision, not this fix.
  it('keeps subspecies-group slashes excluded, matching prior behavior', () => {
    expect(isNonCountableObservedName('Canada Goose (moffitti/maxima)')).toBe(true)
    expect(isNonCountableObservedName('Red-tailed Hawk (calurus/alascensis)')).toBe(true)
  })

  it('keeps ordinary species and subspecies', () => {
    expect(isNonCountableObservedName('American Robin')).toBe(false)
    expect(isNonCountableObservedName('Yellow-rumped Warbler (Myrtle)')).toBe(false)
    expect(isNonCountableObservedName("Xantus's Hummingbird")).toBe(false)
  })
})
