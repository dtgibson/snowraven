// What each Names state shows (family-rollups-and-tree schema 6.5; FR-78 to
// FR-80; QA-88's lib half, QA-89): the table of design-spec 6.1 over a named
// genus, an unnamed genus and an unplaced species with no scientific name, in
// all three states; no empty lead; italic by level.

import { describe, it, expect } from 'vitest'
import { familyNames, genusNames, nameOf, namingWords, orderNames, type Level, type NamesState } from './familyTreeNames'
import { readFamilyIndex } from '../test/familyTreeCorpus'

const INDEX = readFamilyIndex()
const at = (pred: (g: { name: string }) => boolean) => INDEX.genera.findIndex(pred)

describe('design-spec 6.1, row by row', () => {
  const anseriformes = INDEX.orders.findIndex(o => o.name === 'Anseriformes')
  const anatidae = INDEX.families.findIndex(f => f.sci === 'Anatidae')
  const anser = at(g => g.name === 'Anser')
  const branta = at(g => g.name === 'Branta')
  const cases: [string, Level, { common: string | null; scientific: string | null }, Record<NamesState, [string, string | null]>][] = [
    ['order', 'order', orderNames(INDEX, anseriformes), { common: ['Waterfowl', null], scientific: ['Anseriformes', null], both: ['Waterfowl', 'Anseriformes'] }],
    ['family', 'family', familyNames(INDEX, anatidae), { common: ['Ducks, Geese, and Waterfowl', null], scientific: ['Anatidae', null], both: ['Ducks, Geese, and Waterfowl', 'Anatidae'] }],
    ['named genus', 'genus', genusNames(INDEX, anser), { common: ['Geese', null], scientific: ['Anser', null], both: ['Geese', 'Anser'] }],
    ['unnamed genus', 'genus', genusNames(INDEX, branta), { common: ['Branta', null], scientific: ['Branta', null], both: ['Branta', null] }],
    ['species', 'species', { common: 'Canada Goose', scientific: 'Branta canadensis' }, { common: ['Canada Goose', null], scientific: ['Branta canadensis', null], both: ['Canada Goose', 'Branta canadensis'] }],
    ['unplaced species with no scientific name', 'species', { common: 'Imaginary Warbler', scientific: '' }, { common: ['Imaginary Warbler', null], scientific: ['Imaginary Warbler', null], both: ['Imaginary Warbler', null] }],
  ]
  for (const [label, level, names, want] of cases) {
    for (const state of ['common', 'scientific', 'both'] as NamesState[]) {
      it(`${label} in ${state}`, () => {
        const n = nameOf(level, names.common, names.scientific, state)
        expect([n.lead, n.alt]).toEqual(want[state])
        expect(n.lead.length).toBeGreaterThan(0)
      })
    }
  }
})

describe('italic follows the name, never the state', () => {
  it('a scientific name is italic at genus and species, upright at family and order; a common name never', () => {
    expect(nameOf('species', 'Canada Goose', 'Branta canadensis', 'scientific').leadItalic).toBe(true)
    expect(nameOf('species', 'Canada Goose', 'Branta canadensis', 'both').altItalic).toBe(true)
    expect(nameOf('genus', null, 'Branta', 'common').leadItalic).toBe(true)
    expect(nameOf('family', 'Ducks', 'Anatidae', 'scientific').leadItalic).toBe(false)
    expect(nameOf('order', 'Waterfowl', 'Anseriformes', 'both').altItalic).toBe(false)
    expect(nameOf('species', 'Canada Goose', 'Branta canadensis', 'common').leadItalic).toBe(false)
    expect(nameOf('species', 'Imaginary Warbler', '', 'scientific').leadItalic).toBe(false)
  })
})

describe('accessible names carry the names the eye sees', () => {
  it('both names in Both, one otherwise', () => {
    expect(namingWords(nameOf('family', 'Ducks', 'Anatidae', 'both'))).toBe('Ducks, Anatidae')
    expect(namingWords(nameOf('family', 'Ducks', 'Anatidae', 'common'))).toBe('Ducks')
  })
})
