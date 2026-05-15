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
