export interface BreedingCodeDef {
  code: string
  label: string
  tier: 1 | 2 | 3 | 4
}

export const BREEDING_CODES: BreedingCodeDef[] = [
  // Tier 4 — Confirmed (highest)
  { code: 'NY', label: 'Nest with Young',           tier: 4 },
  { code: 'NE', label: 'Nest with Eggs',            tier: 4 },
  { code: 'FS', label: 'Carrying Fecal Sac',        tier: 4 },
  { code: 'FY', label: 'Feeding Young',             tier: 4 },
  { code: 'CF', label: 'Carrying Food',             tier: 4 },
  { code: 'FL', label: 'Recently Fledged Young',    tier: 4 },
  { code: 'ON', label: 'Occupied Nest',             tier: 4 },
  { code: 'UN', label: 'Used Nest',                 tier: 4 },
  { code: 'DD', label: 'Distraction Display',       tier: 4 },
  // Tier 3 — Confirmed (also)
  { code: 'NB', label: 'Nest Building',             tier: 3 },
  { code: 'CN', label: 'Carrying Nesting Material', tier: 3 },
  // Tier 2 — Probable
  { code: 'PE', label: 'Physiological Evidence',    tier: 2 },
  { code: 'B',  label: 'Wren/Woodpecker Nest Bldg', tier: 2 },
  { code: 'A',  label: 'Agitated Behavior',         tier: 2 },
  { code: 'N',  label: 'Visiting Probable Nest',    tier: 2 },
  { code: 'C',  label: 'Courtship/Display/Copul.',  tier: 2 },
  { code: 'T',  label: 'Territorial Defense',       tier: 2 },
  { code: 'P',  label: 'Pair in Suitable Habitat',  tier: 2 },
  { code: 'M',  label: 'Multiple (7+) Singing',     tier: 2 },
  { code: 'S7', label: 'Singing Bird 7+ Days',      tier: 2 },
  // Tier 1 — Possible
  { code: 'S',  label: 'Singing Bird',              tier: 1 },
  { code: 'H',  label: 'In Appropriate Habitat',    tier: 1 },
  { code: 'F',  label: 'Flyover',                   tier: 1 },
]

export const BREEDING_CODE_MAP = new Map(BREEDING_CODES.map(d => [d.code, d]))

// rank = index in BREEDING_CODES (ordered strongest-first); lower = stronger.
const BREEDING_RANK = new Map(BREEDING_CODES.map((d, i) => [d.code, i]))

/**
 * eBird's checklist API (`obs.obsAux` breeding_code) returns an INTERNAL code that
 * differs from the display code used everywhere else in the app (and in the CSV
 * backup). Derived empirically by joining the API output to the CSV's display codes
 * across many checklists. Note the collisions: API "FY" is display "CF" (Carrying
 * Food) and API "FR" is display "FY" (Feeding Young) — so raw passthrough would
 * mislabel them. Codes already equal to their display form are listed for clarity.
 */
export const API_BREEDING_TO_DISPLAY: Record<string, string> = {
  AB: 'A',  CC: 'C',  CM: 'CN', FO: 'F',  FR: 'FY', FY: 'CF',
  OS: 'H',  PO: 'P',  S1: 'S',  SM: 'M',  T7: 'T',  VS: 'N',
  // identical to display (passthrough, listed explicitly):
  FL: 'FL', NB: 'NB', NY: 'NY', ON: 'ON', S7: 'S7',
}

/** Translate an eBird API breeding code to its display code (passthrough if unknown). */
export function apiBreedingToDisplay(apiCode: string): string {
  // Object.hasOwn, never a bare index: the code is the eBird API's, and on this
  // ordinary literal `__proto__`, `constructor` and the other inherited names
  // would return a member, not the code (security.md, lookup tables keyed by an
  // unvalidated string). breedingCodes.test.ts carries all twelve.
  return Object.hasOwn(API_BREEDING_TO_DISPLAY, apiCode) ? API_BREEDING_TO_DISPLAY[apiCode] : apiCode
}

/**
 * Resolve a DISPLAY code (the eBird backup's Breeding Code column, which is
 * already in display form) to its def. Never passed through the API
 * translation: the backup's `FY` is Feeding Young, never Carrying Food. An
 * unknown code falls back to a tier-1 def whose label is the raw code, exactly
 * as `resolveApiBreedingCode` treats an unknown code after translation.
 */
export function resolveDisplayBreedingCode(display: string): BreedingCodeDef {
  return BREEDING_CODE_MAP.get(display) ?? { code: display, label: display, tier: 1 }
}

/**
 * Resolve a raw eBird API breeding code to a display def. Translates the internal
 * code to the display code, then looks up its label + tier. Unknown codes fall back
 * to a tier-1 def showing the raw code, so nothing is ever mislabeled or dropped.
 */
export function resolveApiBreedingCode(apiCode: string): BreedingCodeDef {
  return resolveDisplayBreedingCode(apiBreedingToDisplay(apiCode))
}

/**
 * Strongest-first order by the table's rank. Unknown codes rank below every
 * known code (Infinity) and compare EQUAL to each other, so a stable sort keeps
 * them in first-seen order. Negative when `a` is stronger. Written as explicit
 * comparisons, never `ra - rb`: `Infinity - Infinity` is NaN, which would make
 * the sort's result engine-defined for two unknown codes.
 */
export function compareBreedingDefs(a: BreedingCodeDef, b: BreedingCodeDef): number {
  const ra = BREEDING_RANK.get(a.code) ?? Infinity
  const rb = BREEDING_RANK.get(b.code) ?? Infinity
  return ra === rb ? 0 : ra < rb ? -1 : 1
}

/** The stronger of two resolved defs; a tie keeps `a`. Defined on the
 *  comparator so the fold and the Calendar's sort cannot disagree. */
export function strongerBreedingDef(a: BreedingCodeDef | null, b: BreedingCodeDef | null): BreedingCodeDef | null {
  if (!a) return b
  if (!b) return a
  return compareBreedingDefs(a, b) <= 0 ? a : b
}

/** Compare two API breeding codes; returns the stronger one's display def, or null. */
export function strongerBreeding(a: string | null, b: string | null): BreedingCodeDef | null {
  return strongerBreedingDef(a ? resolveApiBreedingCode(a) : null, b ? resolveApiBreedingCode(b) : null)
}

export const TIER_COLORS: Record<1 | 2 | 3 | 4, string> = {
  4: 'var(--sr-tier-4)',
  3: 'var(--sr-tier-3)',
  2: 'var(--sr-tier-2)',
  1: 'var(--sr-tier-1)',
}

export type BreedingCategory = 'confirmed' | 'probable' | 'possible'

export const CATEGORY_CODES: Record<BreedingCategory, Set<string>> = {
  confirmed: new Set(BREEDING_CODES.filter(d => d.tier >= 3).map(d => d.code)),
  probable:  new Set(BREEDING_CODES.filter(d => d.tier === 2).map(d => d.code)),
  possible:  new Set(BREEDING_CODES.filter(d => d.tier === 1).map(d => d.code)),
}

/** The category a tier belongs to: tiers 3-4 Confirmed, 2 Probable, 1 Possible.
 *  The one lifted copy of the ternary BreedingCodeTable and BreedingCodeList
 *  carry inline (those call sites are out of scope and stay as they are). */
export function breedingCategoryForTier(tier: 1 | 2 | 3 | 4): BreedingCategory {
  return tier >= 3 ? 'confirmed' : tier === 2 ? 'probable' : 'possible'
}

/** Strongest first: the order the Calendar's By-category tile rows and its
 *  legend use. */
export const BREEDING_CATEGORY_ORDER: readonly BreedingCategory[] = ['confirmed', 'probable', 'possible']

/** The category words the Calendar's popup and accessible names read. A data
 *  contract (tests assert the literals), never derived from a raw code. */
export const BREEDING_CATEGORY_LABELS: Record<BreedingCategory, string> = {
  confirmed: 'Confirmed', probable: 'Probable', possible: 'Possible',
}

/** The title-case short forms a Calendar tile prints under "By category"
 *  (calendar-overlays D4-11): the full word does not fit beside a glyph and a
 *  count at the tile's 0.5625rem. The legend keys each to its word. */
export const BREEDING_CATEGORY_SHORT: Record<BreedingCategory, string> = {
  confirmed: 'Conf', probable: 'Prob', possible: 'Poss',
}
