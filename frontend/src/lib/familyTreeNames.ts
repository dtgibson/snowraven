// What each Names state shows, at each level (family-rollups-and-tree schema
// 6.5; FR-78 to FR-80).
//
// One pure function over names read from the bundled asset by index and, for a
// species, from the roster. It builds nothing and holds no table: a Names
// change invokes no pass, no model build and no request, and changes no count,
// row order or expansion (QA-88). Every accessible name is built from the same
// `Naming` the eye sees. No naming rule lives here: order and genus common
// names are the generator's, read from the asset.

import type { FamilyIndex } from './familyTreeAsset'

export type NamesState = 'common' | 'scientific' | 'both'
export type Level = 'order' | 'family' | 'genus' | 'species'

export interface Naming {
  readonly lead: string
  /** The second name, only in Both and only where the taxon has two. */
  readonly alt: string | null
  readonly leadItalic: boolean
  readonly altItalic: boolean
}

/** A scientific name is italic at genus and species level and upright at
 *  family and order level; a common name is never italic. Italic follows the
 *  name, never the state. */
function sciItalic(level: Level): boolean {
  return level === 'genus' || level === 'species'
}

/**
 * Both: the common name leads and the scientific name is the second. Common:
 * the common name alone, and a taxon without one (a genus the generator named
 * nothing) shows its scientific name. Scientific: the scientific name alone,
 * and a taxon without one (an unplaced species whose backup row gives none)
 * shows its common name. `lead` is never empty while either name is not.
 */
export function nameOf(level: Level, common: string | null, scientific: string | null, state: NamesState): Naming {
  const c = common !== null && common !== '' ? common : null
  const s = scientific !== null && scientific !== '' ? scientific : null
  const italic = sciItalic(level)
  if (state === 'scientific') {
    if (s !== null) return { lead: s, alt: null, leadItalic: italic, altItalic: false }
    return { lead: c ?? '', alt: null, leadItalic: false, altItalic: false }
  }
  if (c === null) return { lead: s ?? '', alt: null, leadItalic: s !== null && italic, altItalic: false }
  if (state === 'both' && s !== null) return { lead: c, alt: s, leadItalic: false, altItalic: italic }
  return { lead: c, alt: null, leadItalic: false, altItalic: false }
}

/** The two names of an order, read from the asset by index. */
export function orderNames(index: FamilyIndex, order: number): { common: string | null; scientific: string } {
  const o = index.orders[order]
  return { common: o.common, scientific: o.name }
}

/** The two names of a family. */
export function familyNames(index: FamilyIndex, family: number): { common: string | null; scientific: string } {
  const f = index.families[family]
  return { common: f.name, scientific: f.sci }
}

/** The two names of a genus; `common` is null where the generator gave none. */
export function genusNames(index: FamilyIndex, genus: number): { common: string | null; scientific: string } {
  const g = index.genera[genus]
  return { common: g.common, scientific: g.name }
}

/** The words an accessible name carries for a Naming, lead first. */
export function namingWords(n: Naming): string {
  return n.alt === null ? n.lead : `${n.lead}, ${n.alt}`
}
