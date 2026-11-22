// The Family Tree tab's lazy loader and runtime index over the bundled family
// asset (family-rollups-and-tree schema section 4).
//
// The asset is a Vite-inlined BUILD-TIME artifact, defended at build time (the
// fail-closed generator, `scripts/lib/ebirdFamiliesDerive.mjs`) and in CI
// (`familiesAsset.test.ts`), so the app performs no per-entry validation
// (CLAUDE.md, the bundled-asset trust boundary). A minimal shape check turns a
// wrong file into a rejection. If the asset ever becomes runtime-loaded, the
// durable-cache rule applies in full.
//
// It is named exactly once, inside the one `import()` below, so it rides its
// own chunk, off the entry chunk and off the tab's static graph
// (`entryChunk.test.ts`). The resolved index is memoized for the session: it is
// immutable build data and holds nothing from a user file. A rejected or
// malformed import is NOT memoized: the shared promise is released on failure,
// so the next call imports again (FR-14).

/** The asset's tuples, as the generator writes them (schema 2.2). */
type GenusTuple = [string, string[]] | [string, string[], string]
type FamilyTuple = [string, string, string, number, GenusTuple[]]
type OrderTuple = [string, string, FamilyTuple[]]
export interface FamiliesAssetJson {
  readonly v: number
  readonly version: string
  readonly orders: readonly OrderTuple[]
  readonly extinct: readonly string[]
}

export interface FamilyIndex {
  readonly version: string
  readonly orders: readonly {
    readonly name: string
    readonly common: string
    readonly firstFamily: number
    readonly familyCount: number
  }[]
  readonly families: readonly {
    readonly code: string
    readonly name: string
    readonly sci: string
    readonly order: number
    readonly living: number
    readonly firstGenus: number
    readonly genusCount: number
  }[]
  /** `common` is null where the generator derived no name. */
  readonly genera: readonly {
    readonly name: string
    readonly common: string | null
    readonly family: number
    readonly firstSpecies: number
    readonly speciesCount: number
  }[]
  /** Per species, by taxonomic sequence. */
  readonly speciesGenus: Uint16Array
  readonly speciesFamily: Uint16Array
  readonly epithets: readonly string[]
  /** 1 where eBird marks the species extinct. */
  readonly extinct: Uint8Array
  /** Lowercase common name -> taxonomic sequence. */
  readonly bySpecies: ReadonlyMap<string, number>
}

/** A placement key over this many UTF-16 code units is never lowercased or
 *  hashed: the name is unplaced with one length read (schema 2.3; V8's long-key
 *  hash, security.md v1.0.74). eBird's longest species name is 35 characters. */
export const PLACE_KEY_MAX = 128

/**
 * The index over the asset, built once. Arrays in taxonomic sequence, so an
 * order's families, a family's genera and a genus's species are each one
 * contiguous run described by its first index and its count. Pure.
 */
export function buildFamilyIndex(raw: FamiliesAssetJson): FamilyIndex {
  if (!raw || raw.v !== 2 || !Array.isArray(raw.orders) || !Array.isArray(raw.extinct) || typeof raw.version !== 'string') {
    throw new TypeError('family asset has an unexpected shape')
  }
  const orders: FamilyIndex['orders'][number][] = []
  const families: FamilyIndex['families'][number][] = []
  const genera: FamilyIndex['genera'][number][] = []
  const speciesGenus: number[] = []
  const speciesFamily: number[] = []
  const epithets: string[] = []
  const names: string[] = []
  for (let o = 0; o < raw.orders.length; o++) {
    const [oName, oCommon, fams] = raw.orders[o]
    const firstFamily = families.length
    for (const [code, com, sci, living, gens] of fams) {
      const f = families.length
      const firstGenus = genera.length
      for (const g of gens) {
        const gi = genera.length
        const list = g[1]
        const firstSpecies = epithets.length
        for (let i = 0; i < list.length; i += 2) {
          names.push(list[i])
          epithets.push(list[i + 1])
          speciesGenus.push(gi)
          speciesFamily.push(f)
        }
        genera.push({ name: g[0], common: g.length === 3 ? g[2] : null, family: f, firstSpecies, speciesCount: epithets.length - firstSpecies })
      }
      families.push({ code, name: com, sci, order: o, living, firstGenus, genusCount: genera.length - firstGenus })
    }
    orders.push({ name: oName, common: oCommon, firstFamily, familyCount: families.length - firstFamily })
  }
  const bySpecies = new Map<string, number>()
  for (let i = 0; i < names.length; i++) bySpecies.set(names[i], i)
  const extinct = new Uint8Array(names.length)
  for (const e of raw.extinct) {
    const i = bySpecies.get(e)
    if (i !== undefined) extinct[i] = 1
  }
  return {
    version: raw.version,
    orders, families, genera,
    speciesGenus: Uint16Array.from(speciesGenus),
    speciesFamily: Uint16Array.from(speciesFamily),
    epithets,
    extinct,
    bySpecies,
  }
}

/** The asset's sequence for a roster name, or -1 when it has no place here.
 *  The length gate comes first, so a hostile name costs one length read; the
 *  table is a `Map`, so `constructor` and `__proto__` are ordinary absent keys
 *  (FR-24, QA-24). */
export function placeSequence(index: FamilyIndex, name: string): number {
  if (name.length > PLACE_KEY_MAX) return -1
  const i = index.bySpecies.get(name.toLowerCase())
  return i === undefined ? -1 : i
}

/** A species' scientific name from the asset. */
export function scientificNameOf(index: FamilyIndex, seq: number): string {
  return `${index.genera[index.speciesGenus[seq]].name} ${index.epithets[seq]}`
}

let shared: Promise<FamilyIndex> | null = null

/**
 * The session's one family index. The JSON is imported lazily, the first time
 * a caller asks, and the index is built once. A rejected or malformed import
 * releases the shared promise, so the next call (the tab shown again) imports
 * again.
 */
export function loadFamilyIndex(): Promise<FamilyIndex> {
  if (shared !== null) return shared
  const p = import('../assets/ebird-families.json')
    .then(m => buildFamilyIndex((m as unknown as { default: FamiliesAssetJson }).default))
  shared = p
  p.catch(() => { if (shared === p) shared = null })
  return p
}

/** Test seam: forget the memoized index so a suite can drive a fresh import. */
export function _resetFamilyIndexForTests(): void {
  shared = null
}
