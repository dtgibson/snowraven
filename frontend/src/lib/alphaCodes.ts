// The join between a list of species names and their four-letter codes
// (species-code-search, schema.md section 7). Pure: no React, no I/O.
//
// "ALPHA CODE" IS THE INTERNAL NAME ONLY. In this repo "species code" already
// means eBird's six-letter taxon code (`lib/speciesCode.ts`, `taxonCode`), so
// the four-letter banding-style codes are called alpha codes in source to keep
// the two apart. User-facing copy says "code".
//
// THE TABLE (`AlphaCodeTable`) is the committed asset
// `assets/ebird-alpha-codes.json`, loaded lazily by `alphaCodesAsset.ts`. It is
// bundled BUILD-TIME data: the generator (`scripts/lib/ebirdTaxonomyDerive.mjs`)
// refuses to write a bad one and `alphaCodesAsset.test.ts` re-checks the
// committed file in CI, so nothing here validates entries at runtime (CLAUDE.md,
// the bundled-asset trust boundary).
//
// HOSTILE KEYS (NFR-08). A backup name reaches the table only through
// `Object.hasOwn`, so `__proto__`, `constructor` and the other Object.prototype
// member names (never own keys of the asset, invariant I8) simply have no codes.
// The index is a Map keyed by codes from the trusted asset; the user's names
// are only ever Set members, and the typed query reaches it only through
// `Map.get`, where `__proto__` is an ordinary missing key.
//
// DECLARED SCANS (schema.md section 10). `buildAlphaCodeIndex` reads each listed
// name once: one toLowerCase and one hasOwn, and only on a miss the existing
// `normalizeSpeciesName`, one more toLowerCase and one more hasOwn; then at most
// ten codes of at most four characters each. Linear in the sum of the name
// lengths, and run once per (list identity, table). `alphaCodeHits` is one
// WeakMap.get and one Map.get per keystroke. No RegExp anywhere.
//
// LIFETIME (NFR-10). The index for a list lives in a WeakMap keyed on that
// list's identity, so it dies with the list: Search's list is the species
// index, whose identity changes exactly when the parse changes, and each
// picker's list is its call site's memoized `options`. Nothing is persisted, so
// there is no `clearDerived.ts` row (the v1.0.20 in-memory boundary in
// CLAUDE.md). A WeakMap rather than `speciesIndex.ts`'s single WeakRef slot,
// because up to five lists are alive at once (Search and four pickers) and two
// alternating keys would defeat a single slot on every keystroke.
//
// Its one value import, `normalizeSpeciesName`, is already on the entry graph
// (speciesUtils.ts carries the countability asset), so importing it from this
// lazy module adds nothing to first paint.

import { normalizeSpeciesName } from './speciesUtils'

export interface AlphaCodeTable {
  /** Asset schema version. Any other value is a load failure (FR-26), never a migration. */
  v: 1
  /** The taxonomy snapshot `version` generated in the same run ("2027"). CI asserts equality. */
  version: string
  /** ISO date the generator ran. Provenance only. */
  generated: string
  /**
   * EVERY published eBird common name, lowercased, in taxonomic order, to that
   * entry's kept codes joined by ONE space, or `""` for a published name with
   * no code. Uppercase as eBird publishes them, the letters O and U with a
   * diaeresis included.
   */
  codes: Readonly<Record<string, string>>
}

/** Lowercased alpha code -> the names in ONE list that carry it. */
export type AlphaCodeIndex = ReadonlyMap<string, ReadonlySet<string>>

const NO_CODES: readonly string[] = Object.freeze([])

function splitCodes(value: string): readonly string[] {
  return value === '' ? NO_CODES : value.split(' ')
}

/**
 * A name's codes (FR-10): its own published entry; else its normalized
 * parent's (the name with its trailing parenthetical removed, which is how a
 * form from an older taxonomy revision still finds its species' codes); else
 * none, and the row matches by name only. A published name ALWAYS stops at its
 * own entry, so a published name eBird gives no code never borrows one from
 * its parent (schema.md 2.3).
 */
export function alphaCodesForName(table: AlphaCodeTable, name: string): readonly string[] {
  const lc = name.toLowerCase()
  if (Object.hasOwn(table.codes, lc)) return splitCodes(table.codes[lc])
  const parent = normalizeSpeciesName(name).toLowerCase()
  if (parent !== lc && Object.hasOwn(table.codes, parent)) return splitCodes(table.codes[parent])
  return NO_CODES
}

let joinLookups = 0

/** TEST SEAM: how many rows `buildAlphaCodeIndex` has looked up since the last reset. */
export function _alphaCodeJoinLookups(): number {
  return joinLookups
}
/** TEST SEAM. */
export function _resetAlphaCodeJoinLookups(): void {
  joinLookups = 0
}

/** One pass over a list: the inverted index for exactly the names in it. */
export function buildAlphaCodeIndex(table: AlphaCodeTable, rows: readonly { name: string }[]): AlphaCodeIndex {
  const index = new Map<string, Set<string>>()
  for (const row of rows) {
    joinLookups += 1
    for (const code of alphaCodesForName(table, row.name)) {
      const key = code.toLowerCase()
      let names = index.get(key)
      if (names === undefined) {
        names = new Set<string>()
        index.set(key, names)
      }
      names.add(row.name)
    }
  }
  return index
}

const memo = new WeakMap<object, { table: AlphaCodeTable; index: AlphaCodeIndex }>()

/** The memoized index for this list: built once per (list identity, table). */
export function alphaCodeIndexFor(table: AlphaCodeTable, rows: readonly { name: string }[]): AlphaCodeIndex {
  const hit = memo.get(rows)
  if (hit !== undefined && hit.table === table) return hit.index
  const index = buildAlphaCodeIndex(table, rows)
  memo.set(rows, { table, index })
  return index
}

/**
 * The names in `rows` that carry the NORMALIZED query `q` as a code, or
 * undefined when there is no table yet or no query. Exact equality of the
 * whole code only (FR-09): a prefix, a substring or a query with interior
 * whitespace is simply a key the index does not hold.
 */
export function alphaCodeHits(
  table: AlphaCodeTable | null,
  rows: readonly { name: string }[],
  q: string,
): ReadonlySet<string> | undefined {
  if (table === null || q === '') return undefined
  return alphaCodeIndexFor(table, rows).get(q)
}
