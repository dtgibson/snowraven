import { describe, it, expect } from 'vitest'
import { normalizeSpeciesName, isNonCountableNameShape, isNonCountableForm } from './speciesUtils'

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

describe('isNonCountableNameShape (the fallback: eBird\'s naming convention)', () => {
  // The convention alone, applied to a name eBird does not publish. Byte-identical
  // to the raw-name predicate this replaced, which is what keeps an unpublished
  // name behaving exactly as it did before the countability build.
  it('rejects a spuh', () => {
    expect(isNonCountableNameShape('Accipiter sp.')).toBe(true)
  })

  it('rejects a slash', () => {
    expect(isNonCountableNameShape("Sharp-shinned/Cooper's Hawk")).toBe(true)
  })

  it('rejects a hybrid named in the BASE name', () => {
    expect(isNonCountableNameShape('Mallard x American Black Duck (hybrid)')).toBe(true)
  })

  it('keeps an intergrade whose " x " is only inside the parenthetical', () => {
    // The v0.5.83 asymmetry, retained: the " x " half tests the normalized name.
    expect(isNonCountableNameShape("Yellow-rumped Warbler (Myrtle x Audubon's)")).toBe(false)
  })

  it('keeps an ordinary species', () => {
    expect(isNonCountableNameShape('Red-tailed Hawk')).toBe(false)
    expect(isNonCountableNameShape('Spotted Sandpiper')).toBe(false)
    // A guard, not a discriminating case: " x " needs surrounding spaces, and this
    // passes under every implementation considered here.
    expect(isNonCountableNameShape("Xantus's Hummingbird")).toBe(false)
  })

  it('handles empty string', () => {
    expect(isNonCountableNameShape('')).toBe(false)
  })
})

describe('isNonCountableForm (the rule)', () => {
  it('rejects the shapes the convention already rejects', () => {
    expect(isNonCountableForm('Gull sp.')).toBe(true)
    expect(isNonCountableForm('Greater/Lesser Scaup')).toBe(true)
    expect(isNonCountableForm('Mallard x American Black Duck')).toBe(true)
  })

  it('keeps ordinary species and subspecies', () => {
    expect(isNonCountableForm('American Robin')).toBe(false)
    expect(isNonCountableForm('Mallard')).toBe(false)
    expect(isNonCountableForm('Yellow-rumped Warbler (Myrtle)')).toBe(false)
  })

  it('keeps intraspecific intergrades, whose " x " is inside the parenthetical', () => {
    // The 36 names v0.5.86 rescued. They stay countable under the new rule, which is
    // how v0.5.83's warning that collapsing the predicate pair is a silent data-loss
    // bug gets discharged rather than waved through.
    for (const name of [
      "Yellow-rumped Warbler (Myrtle x Audubon's)",
      'Northern Flicker (Yellow-shafted x Red-shafted)',
      'Dark-eyed Junco (Oregon x Pink-sided)',
      'Green-winged Teal (Eurasian x American)',
      'Redpoll (Common x Hoary)',
    ]) {
      expect(isNonCountableForm(name)).toBe(false)
    }
  })

  it('still drops true hybrids, whose " x " is in the base name', () => {
    expect(isNonCountableForm('Mallard x American Black Duck (hybrid)')).toBe(true)
    expect(isNonCountableForm('Western x Glaucous-winged Gull (hybrid)')).toBe(true)
  })

  // ── The two directions the string rule got wrong ────────────────────────────

  it('ADMITS a subspecies-group slash inside a parenthetical (direction A)', () => {
    // The discriminating case for direction A. Every one of these is excluded by
    // `isNonCountableNameShape`, so reverting the rule to the convention alone turns
    // this red. Ordinary birds for a North American birder.
    for (const name of [
      'Canada Goose (moffitti/maxima)',
      'Redpoll (Common/Hoary)',
      'Dark-eyed Junco (Slate-colored/cismontanus)',
      'Iceland Gull (thayeri/kumlieni)',
    ]) {
      expect(isNonCountableNameShape(name)).toBe(true)   // the convention rejects it
      expect(isNonCountableForm(name)).toBe(false)       // eBird counts it
    }
  })

  it('REJECTS a named hybrid carrying no " x " (direction B)', () => {
    // The discriminating case for direction B, and the one a birder plausibly holds.
    // The convention cannot see these at all: nothing in the name is ambiguous.
    for (const name of ["Brewster's Warbler (hybrid)", "Lawrence's Warbler (hybrid)"]) {
      expect(isNonCountableNameShape(name)).toBe(false)  // the convention counts it
      expect(isNonCountableForm(name)).toBe(true)        // eBird does not
    }
  })

  it('falls back to the convention for a name eBird does not publish', () => {
    // An older revision or a since-renamed species. NOT defaulted to "counts": that
    // would admit every non-countable form the snapshot has never heard of.
    expect(isNonCountableForm('Nonexistent Fakebird')).toBe(false)
    expect(isNonCountableForm('Fakebird sp.')).toBe(true)
    expect(isNonCountableForm('Fake/Faker Bird')).toBe(true)
    expect(isNonCountableForm('Fakebird x Otherbird')).toBe(true)
    // And a renamed species still counts, which is the case the fallback exists for.
    expect(isNonCountableForm('Cattle Egret')).toBe(false)
  })
})
