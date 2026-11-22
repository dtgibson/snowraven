// The one model both Family Tree views read (family-rollups-and-tree schema
// section 6; FR-04, FR-20, FR-21, FR-25, FR-30, FR-33, FR-36 to FR-40).
//
// Pure: no I/O, no clock, no React, no network import. One loop over the
// scope's roster names and one walk over the asset in taxonomic order; no row
// of either file is visited here (NFR-03), and no count is ever computed by a
// view (QA-33): every figure the views show is a field of this model, summed
// from the level below in the one walk, so FR-39's sum invariants hold by
// construction.
//
// Placement is a lookup of the roster name in the bundled asset, never text in
// the backup beyond that key and never a live taxonomy (FR-24, FR-27): a name
// the asset cannot place joins the Not placed group with its reason (FR-25),
// never guessed into a family. Absence is expressed inside the object (`null`
// members, empty arrays), never a `null` model.

import type { FirstSighting } from './lifeLists'
import { KIND_COUNT, type Scope } from './familyTreeScope'
import { placeSequence, scientificNameOf, type FamilyIndex } from './familyTreeAsset'

export type KindState = 'any' | 'has' | 'lacks'
export interface MediaConstraints { readonly photo: KindState; readonly audio: KindState; readonly video: KindState }
export const NO_MEDIA_CONSTRAINTS: MediaConstraints = { photo: 'any', audio: 'any', video: 'any' }

/** The next state of a tri-state Media pill: any, then has, then lacks, then any. */
export function nextKindState(s: KindState): KindState {
  return s === 'any' ? 'has' : s === 'has' ? 'lacks' : 'any'
}

export interface SpeciesLeaf {
  /** The roster's own name (BirdName's commonName, the Species Detail key). */
  readonly name: string
  /** From the asset; for an unplaced species, the backup's binomial ('' when none). */
  readonly sci: string
  /** The asset's taxonomic sequence, or -1 for an unplaced species. */
  readonly seq: number
  /** Bit 0 photo, 1 audio, 2 video, in scope. null when media figures are off. */
  readonly kinds: number | null
}
export interface GenusNode { readonly genus: number; readonly seen: number; readonly species: readonly SpeciesLeaf[] }
export interface FamilyNode {
  /** Index into FamilyIndex.families. */
  readonly family: number
  readonly seen: number
  readonly world: number
  /** Species with each kind, and items of each kind, in scope. null when media figures are off. */
  readonly withKind: readonly [number, number, number] | null
  readonly items: readonly [number, number, number] | null
  readonly genera: readonly GenusNode[]
}
export interface OrderNode {
  readonly order: number
  readonly seen: number
  readonly world: number
  readonly familiesSeen: number
  readonly familiesWorld: number
  readonly families: readonly FamilyNode[]
}
export interface FamilyModel {
  /** Taxonomic; only those with a roster species. */
  readonly orders: readonly OrderNode[]
  /** By name. */
  readonly unplaced: readonly SpeciesLeaf[]
  readonly seen: { readonly species: number; readonly families: number; readonly orders: number }
  readonly world: { readonly species: number; readonly families: number; readonly orders: number }
  readonly notSingleSpecies: number
  readonly mediaShown: boolean
  /** True when Region, Year or a Media constraint is off its default (FR-38). */
  readonly filtered: boolean
}

// -- World counts (FR-04, schema 6.3) ------------------------------------------

export interface WorldCounts {
  /** Per family: living species plus the extinct ones on the unfiltered roster. */
  readonly perFamily: Uint32Array
  /** Per order: the sum over its families. */
  readonly perOrder: Uint32Array
  /** Per order: its families with a world count above zero. */
  readonly familiesPerOrder: Uint32Array
  readonly species: number
  /** Families with a world count above zero. */
  readonly families: number
  /** Orders with such a family. */
  readonly orders: number
}

/**
 * Once per files epoch and index. `firsts` is the WORLD roster (pass 1:
 * Everywhere, all years, Include Escapees on), so a world count never moves
 * with a control and is never below species seen. The world family and order
 * totals count only taxa whose world species count is above zero, FR-04's
 * species rule one level up (D-05): a wholly extinct family counts on both
 * sides exactly when the birder has a species of it.
 */
export function worldCounts(index: FamilyIndex, firsts: ReadonlyMap<string, FirstSighting>): WorldCounts {
  const perFamily = new Uint32Array(index.families.length)
  for (let f = 0; f < index.families.length; f++) perFamily[f] = index.families[f].living
  for (const name of firsts.keys()) {
    const seq = placeSequence(index, name)
    if (seq >= 0 && index.extinct[seq] === 1) perFamily[index.speciesFamily[seq]] += 1
  }
  const perOrder = new Uint32Array(index.orders.length)
  const familiesPerOrder = new Uint32Array(index.orders.length)
  let species = 0
  let families = 0
  let orders = 0
  for (let o = 0; o < index.orders.length; o++) {
    const ord = index.orders[o]
    for (let f = ord.firstFamily; f < ord.firstFamily + ord.familyCount; f++) {
      perOrder[o] += perFamily[f]
      if (perFamily[f] > 0) { familiesPerOrder[o] += 1; families += 1 }
    }
    species += perOrder[o]
    if (familiesPerOrder[o] > 0) orders += 1
  }
  return { perFamily, perOrder, familiesPerOrder, species, families, orders }
}

// -- The model (A1, schema 6.2) ------------------------------------------------

export interface ModelInput {
  readonly index: FamilyIndex
  readonly world: WorldCounts
  readonly scope: Scope
  /** The world roster (pass 1), for an unplaced species' binomial (FR-27). */
  readonly firsts: ReadonlyMap<string, FirstSighting>
  /** Confirmed escapee-only names, from the passive reader (FR-20). */
  readonly escapees: ReadonlySet<string>
  readonly includeEscapees: boolean
  readonly media: MediaConstraints
  /** A readable ML export is loaded: media figures show and the filter applies. */
  readonly mediaReadable: boolean
  /** Region or Year is off its default. */
  readonly scopeFiltered: boolean
}

const KIND_KEYS = ['photo', 'audio', 'video'] as const

function passesMedia(t: Uint32Array | undefined, media: MediaConstraints): boolean {
  for (let k = 0; k < KIND_COUNT; k++) {
    const want = media[KIND_KEYS[k]]
    if (want === 'any') continue
    const has = t !== undefined && t[k] > 0
    if (want === 'has' ? !has : has) return false
  }
  return true
}

function kindBits(t: Uint32Array | undefined): number {
  if (t === undefined) return 0
  return (t[0] > 0 ? 1 : 0) | (t[1] > 0 ? 2 : 0) | (t[2] > 0 ? 4 : 0)
}

export function mediaConstrained(media: MediaConstraints): boolean {
  return media.photo !== 'any' || media.audio !== 'any' || media.video !== 'any'
}

/** One count of the model builds, for QA-33's "one build per control change". */
export const modelWork = { builds: 0 }

export function buildFamilyModel(input: ModelInput): FamilyModel {
  modelWork.builds += 1
  const { index, world, scope, firsts } = input
  const mediaShown = input.mediaReadable && scope.tallies !== null
  const media = mediaShown ? input.media : NO_MEDIA_CONSTRAINTS
  const tallies = mediaShown ? scope.tallies : null

  // 1. One loop over the roster names. Two roster names that differ only by
  // case (a hand-edited file) are two Life Lists rows and so two species here,
  // placed on the same asset species: the second rides `extra`, so the roster
  // still equals Life Lists' rows (FR-21) and every sum still holds (FR-39).
  const nameAt: (string | undefined)[] = new Array(index.epithets.length)
  const extra = new Map<number, string[]>()
  const unplaced: SpeciesLeaf[] = []
  let speciesSeen = 0
  for (const name of scope.names) {
    if (!input.includeEscapees && input.escapees.has(name)) continue
    const t = tallies === null ? undefined : tallies.get(name)
    if (!passesMedia(t, media)) continue
    speciesSeen += 1
    const seq = placeSequence(index, name)
    if (seq >= 0) {
      if (nameAt[seq] === undefined) nameAt[seq] = name
      else {
        const more = extra.get(seq)
        if (more === undefined) extra.set(seq, [name])
        else more.push(name)
      }
    } else {
      const first = firsts.get(name)
      unplaced.push({ name, sci: first === undefined ? '' : first.scientificName, seq: -1, kinds: mediaShown ? kindBits(t) : null })
    }
  }

  // 2. One walk over the index in taxonomic order, emitting only what the
  // roster reaches and summing as it goes.
  const orders: OrderNode[] = []
  let familiesSeenTotal = 0
  for (let o = 0; o < index.orders.length; o++) {
    const ord = index.orders[o]
    const fams: FamilyNode[] = []
    let oSeen = 0
    for (let f = ord.firstFamily; f < ord.firstFamily + ord.familyCount; f++) {
      const fam = index.families[f]
      const gens: GenusNode[] = []
      let fSeen = 0
      const withKind: [number, number, number] = [0, 0, 0]
      const items: [number, number, number] = [0, 0, 0]
      for (let g = fam.firstGenus; g < fam.firstGenus + fam.genusCount; g++) {
        const gen = index.genera[g]
        const leaves: SpeciesLeaf[] = []
        for (let s = gen.firstSpecies; s < gen.firstSpecies + gen.speciesCount; s++) {
          const first = nameAt[s]
          if (first === undefined) continue
          const more = extra.size === 0 ? undefined : extra.get(s)
          const names = more === undefined ? [first] : [first, ...more]
          for (const name of names) {
            let kinds: number | null = null
            if (tallies !== null) {
              const t = tallies.get(name)
              kinds = kindBits(t)
              if (t !== undefined) {
                for (let k = 0; k < KIND_COUNT; k++) {
                  if (t[k] > 0) withKind[k] += 1
                  items[k] += t[k]
                }
              }
            }
            leaves.push({ name, sci: scientificNameOf(index, s), seq: s, kinds })
          }
        }
        if (leaves.length > 0) {
          gens.push({ genus: g, seen: leaves.length, species: leaves })
          fSeen += leaves.length
        }
      }
      if (fSeen > 0) {
        fams.push({
          family: f, seen: fSeen, world: world.perFamily[f],
          withKind: mediaShown ? withKind : null, items: mediaShown ? items : null, genera: gens,
        })
        oSeen += fSeen
      }
    }
    if (fams.length > 0) {
      orders.push({
        order: o, seen: oSeen, world: world.perOrder[o],
        familiesSeen: fams.length, familiesWorld: world.familiesPerOrder[o], families: fams,
      })
      familiesSeenTotal += fams.length
    }
  }

  // 3. The unplaced, by name (the Region picker's residual class).
  unplaced.sort((a, b) => a.name.localeCompare(b.name))

  return {
    orders,
    unplaced,
    seen: { species: speciesSeen, families: familiesSeenTotal, orders: orders.length },
    world: { species: world.species, families: world.families, orders: world.orders },
    notSingleSpecies: scope.notSingleSpecies,
    mediaShown,
    filtered: input.scopeFiltered || mediaConstrained(media),
  }
}

// -- Sort (FR-40, schema 6.4) --------------------------------------------------

export type SortKey = 'taxonomic' | 'name' | 'seen' | 'share' | 'photo' | 'audio' | 'video'
export const SORT_KEYS: readonly SortKey[] = ['taxonomic', 'name', 'seen', 'share', 'photo', 'audio', 'video']

export interface SortedFamily { readonly order: OrderNode; readonly family: FamilyNode }

/**
 * The families flat in the chosen order. Every comparator ends on the family
 * index (taxonomic sequence), so the order is total and identical across
 * reloads and engines. The family-name key sorts on the family's COMMON name
 * in every Names state, so a Names change never reorders rows (FR-78). Shares
 * compare as integer cross products, never floats. Counts sort descending.
 */
export function sortFamilies(model: FamilyModel, index: FamilyIndex, key: SortKey): SortedFamily[] {
  const out: SortedFamily[] = []
  for (const order of model.orders) for (const family of order.families) out.push({ order, family })
  if (key === 'taxonomic') return out
  const kind: 0 | 1 | 2 | null = key === 'photo' ? 0 : key === 'audio' ? 1 : key === 'video' ? 2 : null
  out.sort((a, b) => {
    const fa = a.family
    const fb = b.family
    let c = 0
    if (key === 'name') c = index.families[fa.family].name.localeCompare(index.families[fb.family].name)
    else if (key === 'seen') c = fb.seen - fa.seen
    else if (key === 'share') c = fb.seen * fa.world - fa.seen * fb.world
    else if (kind !== null) c = (fb.withKind?.[kind] ?? 0) - (fa.withKind?.[kind] ?? 0)
    return c !== 0 ? c : fa.family - fb.family
  })
  return out
}

// -- Expand all in the table (FR-84, schema 9.2) -----------------------------

/** One commit of the table's Expand all mounts exactly this many species rows
 *  (the last commit fewer; schema 9.2 as amended, D-43). */
export const EXPAND_CHUNK_SPECIES = 75

/** One key's place after a step: [family key, rows mounted after it, its rows in all]. */
export type ExpandEntry = readonly [key: number, mountedAfter: number, total: number]

/**
 * The steps the table's Expand all commits, in taxonomic order with the Not
 * placed group (key -1) last: each step adds exactly `size` species rows (the
 * last step fewer), and a family or the group is split across steps when it
 * does not fit what is left of one, so no commit mounts more than `size` rows
 * on any roster. `skip` leaves out keys already open in full when the run
 * starts. A pure plan; the tab commits one step per macrotask (schema 9.2).
 */
export function expandSteps(
  model: FamilyModel, size: number = EXPAND_CHUNK_SPECIES, unplacedKey = -1, skip: ReadonlySet<number> = new Set(),
): ExpandEntry[][] {
  const out: ExpandEntry[][] = []
  let cur: ExpandEntry[] = []
  let room = size
  const add = (key: number, total: number) => {
    if (skip.has(key) || total <= 0) return
    let mounted = 0
    while (mounted < total) {
      const take = Math.min(room, total - mounted)
      mounted += take
      room -= take
      cur.push([key, mounted, total])
      if (room === 0) { out.push(cur); cur = []; room = size }
    }
  }
  for (const o of model.orders) for (const f of o.families) add(f.family, f.seen)
  if (model.unplaced.length > 0) add(unplacedKey, model.unplaced.length)
  if (cur.length > 0) out.push(cur)
  return out
}
