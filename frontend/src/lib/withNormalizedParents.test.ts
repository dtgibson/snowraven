// Guard for the shared /taxonomy/codes batch expansion
// (a11y-taxonomy-screenshot-sweep).
//
// `codes` is a SPECIES-ONLY map by contract on both transports, so a bird
// recorded only as a form resolves no species code from its raw name and the
// consumer silently drops its favicon and taxonomic sort position. v1.0.1 fixed
// the Statistics batch inline; this helper single-sources the same treatment for
// the eight remaining call sites.
//
// The properties below are what those call sites depend on, and the ones a
// careless rewrite would break: the raw name must SURVIVE (formCodes consumers
// resolve a form to its own issf/domestic code), a plain species name must not
// grow the request, and the pairing must dedupe.
import { describe, it, expect } from 'vitest'
import { withNormalizedParents, normalizeSpeciesName } from './speciesUtils'

const names = (out: { commonName: string }[]) => out.map(e => e.commonName)

describe('withNormalizedParents', () => {
  it('adds the parent species beside a form name, keeping the raw name', () => {
    const out = withNormalizedParents([['Swan Goose (Domestic type)', 'Anser cygnoides']])
    // The raw name is what formCodes resolves; the parent is what `codes` needs.
    // Dropping either one re-opens a different half of the defect.
    expect(names(out)).toEqual(['Swan Goose (Domestic type)', 'Swan Goose'])
    expect(out.every(e => e.scientificName === 'Anser cygnoides')).toBe(true)
  })

  it('does not grow the request for a plain species name', () => {
    // normalizeSpeciesName is identity here, so the Map dedupe must collapse the
    // pair to one entry. A naive implementation that always pushes both emits a
    // duplicate for every ordinary name — on this app's data that is most of the
    // batch, which would be a real payload regression rather than a cosmetic one.
    const out = withNormalizedParents([['Mourning Dove', 'Zenaida macroura']])
    expect(names(out)).toEqual(['Mourning Dove'])
  })

  it('dedupes a parent shared by several forms', () => {
    const out = withNormalizedParents([
      ['Dark-eyed Junco (Oregon)', 'Junco hyemalis'],
      ['Dark-eyed Junco (Slate-colored)', 'Junco hyemalis'],
      ['Dark-eyed Junco', 'Junco hyemalis'],
    ])
    expect(names(out)).toEqual([
      'Dark-eyed Junco (Oregon)',
      'Dark-eyed Junco',
      'Dark-eyed Junco (Slate-colored)',
    ])
  })

  it('keeps the first scientific name for a repeated key', () => {
    // Matches the shipped Species Detail and Statistics batches this generalizes;
    // last-write-wins would silently change which name a form's link carries.
    const out = withNormalizedParents([
      ['Mourning Dove', 'Zenaida macroura'],
      ['Mourning Dove', 'WRONG'],
    ])
    expect(out).toEqual([{ commonName: 'Mourning Dove', scientificName: 'Zenaida macroura' }])
  })

  it('accepts any iterable of pairs, including a Map', () => {
    // Four of the eight call sites pass a Map directly rather than spreading it.
    const out = withNormalizedParents(new Map([['Muscovy Duck (Domestic type)', 'Cairina moschata']]))
    expect(names(out)).toContain('Muscovy Duck')
  })

  it('emits a parent for every form name it is given', () => {
    const forms = [
      'Muscovy Duck (Domestic type)',
      'Graylag Goose (Domestic type)',
      'Mallard (Domestic type)',
    ]
    const out = withNormalizedParents(forms.map(n => [n, '']))
    for (const f of forms) {
      expect(names(out)).toContain(f)
      expect(names(out)).toContain(normalizeSpeciesName(f))
    }
  })
})
