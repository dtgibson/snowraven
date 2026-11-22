// Find on the Family Tree tab (family-rollups-and-tree schema 12; FR-65 to
// FR-67, D-24, D-25). One index per model over all four levels, and a match
// per keystroke that buckets its hits in one pass with no sort.
//
// THE READS (security.md; schema 16.1, T7). The index lowercases each name
// once, when it is built; a keystroke normalizes the query once, cuts it to
// FIND_QUERY_MAX code units, and reads at most two bounded haystacks per row
// (the leading name and the other), each a plain `indexOf` or `includes`, no
// RegExp built from the query. A species name over PLACE_KEY_MAX is left out
// of find (it is still listed in the table), so every haystack is bounded.
// The word-start test is a bounded `indexOf` loop over one haystack. Each
// bucket stops filling at FIND_OPTIONS_MAX, so the result never grows with the
// roster. `findWork` counts haystack reads for the work row.

import { PLACE_KEY_MAX, type FamilyIndex } from './familyTreeAsset'
import type { FamilyModel } from './familyTreeModel'
import { familyNames, genusNames, orderNames, type Level, type NamesState } from './familyTreeNames'
import { normalizeSpeciesQuery } from './speciesMatch'
import { alphaCodeHits, type AlphaCodeTable } from './alphaCodes'

export const FIND_QUERY_MAX = 64
export const FIND_OPTIONS_MAX = 50

export interface FindRow {
  readonly level: Level
  /** The order, family or genus index, the species' sequence, or for an
   *  unplaced species its place in the model's unplaced list. */
  readonly ref: number
  readonly unplaced: boolean
  readonly common: string | null
  readonly scientific: string | null
  readonly commonLc: string
  readonly scientificLc: string
}

export interface FindIndex {
  /** Species, then families, genera and orders, each in taxonomic sequence. */
  readonly rows: readonly FindRow[]
  /** The species rows' names, one stable array for the code join's memo. */
  readonly codeRows: readonly { readonly name: string }[]
}

export const findWork = { reads: 0 }

function row(level: Level, ref: number, common: string | null, scientific: string | null, unplaced = false): FindRow {
  const c = common !== null && common !== '' ? common : null
  const s = scientific !== null && scientific !== '' ? scientific : null
  return { level, ref, unplaced, common: c, scientific: s, commonLc: c === null ? '' : c.toLowerCase(), scientificLc: s === null ? '' : s.toLowerCase() }
}

/** Once per model; a Names change does not rebuild it. */
export function buildFindIndex(model: FamilyModel, index: FamilyIndex): FindIndex {
  const species: FindRow[] = []
  const families: FindRow[] = []
  const genera: FindRow[] = []
  const orders: FindRow[] = []
  for (const o of model.orders) {
    const on = orderNames(index, o.order)
    orders.push(row('order', o.order, on.common, on.scientific))
    for (const f of o.families) {
      const fn = familyNames(index, f.family)
      families.push(row('family', f.family, fn.common, fn.scientific))
      for (const g of f.genera) {
        const gn = genusNames(index, g.genus)
        genera.push(row('genus', g.genus, gn.common, gn.scientific))
        for (const s of g.species) if (s.name.length <= PLACE_KEY_MAX) species.push(row('species', s.seq, s.name, s.sci))
      }
    }
  }
  model.unplaced.forEach((s, i) => { if (s.name.length <= PLACE_KEY_MAX) species.push(row('species', i, s.name, s.sci, true)) })
  return {
    rows: [...species, ...families, ...genera, ...orders],
    codeRows: species.map(r => ({ name: r.common ?? '' })),
  }
}

/** True when `q`, found at `at`, also occurs at the start of `hay` or of one of
 *  its words (after a space or a hyphen). A bounded indexOf loop. */
function atWordStart(hay: string, q: string, at: number): boolean {
  for (let i = at; i !== -1; i = hay.indexOf(q, i + 1)) {
    if (i === 0) return true
    const before = hay.charCodeAt(i - 1)
    if (before === 32 || before === 45) return true
  }
  return false
}

/** The leading name of a row under a Names state (schema 6.5's rule). */
export function leadIsScientific(r: FindRow, names: NamesState): boolean {
  return names === 'scientific' ? r.scientific !== null : r.common === null
}

/**
 * The matches for one keystroke, at most FIND_OPTIONS_MAX, ranked by bucket:
 * code hits; a word start in the leading name; elsewhere in the leading name;
 * the other name only. Within a bucket the index's own order. No sort.
 */
export function findMatches(idx: FindIndex, raw: string, names: NamesState, codes: AlphaCodeTable | null): FindRow[] {
  const q = normalizeSpeciesQuery(raw).slice(0, FIND_QUERY_MAX)
  if (q === '') return []
  const hits = alphaCodeHits(codes, idx.codeRows, q)
  const buckets: FindRow[][] = [[], [], [], []]
  for (const r of idx.rows) {
    let b = -1
    if (hits !== undefined && r.level === 'species' && r.common !== null && hits.has(r.common)) b = 0
    else {
      const sci = leadIsScientific(r, names)
      const lead = sci ? r.scientificLc : r.commonLc
      findWork.reads += 1
      const at = lead.indexOf(q)
      if (at !== -1) b = atWordStart(lead, q, at) ? 1 : 2
      else {
        findWork.reads += 1
        if ((sci ? r.commonLc : r.scientificLc).includes(q)) b = 3
      }
    }
    if (b >= 0 && buckets[b].length < FIND_OPTIONS_MAX) buckets[b].push(r)
  }
  const out: FindRow[] = []
  for (const bucket of buckets) for (const r of bucket) if (out.length < FIND_OPTIONS_MAX) out.push(r)
  return out
}
