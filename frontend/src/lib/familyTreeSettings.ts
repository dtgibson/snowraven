// The Family Tree tab's three remembered choices (family-rollups-and-tree
// schema 8.3; FR-32, FR-53, FR-80).
//
// Each is a preference the user chose, never derived data (the `targetsCounty`
// and `lifeListsRegion` precedent): written through the `storage` seam only on
// a user choice, validated on every read, and a missing, unparseable or
// unknown value reads as the default with nothing written back. No sync kind
// and no Clear row: nothing derived is stored, and nothing joins
// `clearDerived.ts`. The stored values are label-agnostic. Nothing in this
// module reads a window: the first-use view takes the still tier as an
// argument (D-36).

export { parseStoredRegion } from './lifeListsRegion'

/** The chosen Region, a `RegionRef`, read through Life Lists' own validator
 *  under its own key (Open Question 16: the two tabs are set independently). */
export const FAMILY_TREE_REGION_SETTING = 'familyTreeRegion'
/** The chosen view, `'rollup'` (the table) or `'diagram'` (the tree). */
export const FAMILY_TREE_VIEW_SETTING = 'familyTreeView'
/** The chosen Names state. */
export const FAMILY_TREE_NAMES_SETTING = 'familyTreeNames'

export type FamilyTreeView = 'rollup' | 'diagram'
export type FamilyTreeNames = 'common' | 'scientific' | 'both'

/** The Names control opens on Both (D-22, D-23). */
export const DEFAULT_NAMES: FamilyTreeNames = 'both'

/** Exactly one of the two stored view values, or null for "nothing saved". */
export function parseStoredView(v: unknown): FamilyTreeView | null {
  return v === 'rollup' || v === 'diagram' ? v : null
}

/** Exactly one of the three stored Names values, else the default. */
export function parseStoredNames(v: unknown): FamilyTreeNames {
  return v === 'common' || v === 'scientific' || v === 'both' ? v : DEFAULT_NAMES
}

/**
 * The first-use view (FR-53, D-35, D-36): the table at or under the still tier,
 * where the tree is a still behind a button and the table is the working view,
 * and the tree above it. The tab decides it once, when it first reaches its
 * ready phase in a session with nothing saved, and latches it; it is never
 * written.
 */
export function defaultViewFor(stillTier: boolean): FamilyTreeView {
  return stillTier ? 'rollup' : 'diagram'
}
