// Joins the user's personal breeding-coded observations to California atlas blocks,
// producing the highest breeding tier (and code/count) per block for map shading.
// Pure + dependency-light so it can be unit-tested without the map.

import { BREEDING_CODES } from './breedingCodes'
import { buildQuadIndex, pointToBlockCode, type AtlasData } from './atlasBlocks'

export interface BlockBreeding {
  /** Highest (strongest) breeding code recorded in the block. */
  code: string
  /** Human label for that code. */
  label: string
  /** Tier of that code (1–4; 4 = highest). */
  tier: 1 | 2 | 3 | 4
  /** Count of the user's breeding records that fall in this block. */
  count: number
}

/** Minimal shape this module needs from an observation. */
export interface BreedingObs {
  latitude: number | null
  longitude: number | null
  breedingCode: string | null
}

// rank = index in BREEDING_CODES (ordered strongest-first), so lower rank = higher.
const RANK = new Map(BREEDING_CODES.map((d, i) => [d.code, i]))
const META = new Map(BREEDING_CODES.map(d => [d.code, d]))

/**
 * Map of block code → highest breeding evidence the user recorded there.
 * One pass over observations: each obs with a known breeding code + coords is
 * assigned to its atlas block; the block keeps the strongest code seen and a count.
 * Only blocks with ≥1 personal breeding record appear in the result.
 */
export function buildBreedingByBlock(
  data: AtlasData,
  observations: BreedingObs[],
): Map<string, BlockBreeding> {
  const index = buildQuadIndex(data)
  const out = new Map<string, BlockBreeding>()
  // track the best (lowest) rank per block to decide the "highest" code
  const bestRank = new Map<string, number>()

  for (const o of observations) {
    if (!o.breedingCode || o.latitude == null || o.longitude == null) continue
    const meta = META.get(o.breedingCode)
    if (!meta) continue // not a recognized breeding code
    const blockCode = pointToBlockCode(data, index, o.latitude, o.longitude)
    if (!blockCode) continue

    const existing = out.get(blockCode)
    if (!existing) {
      out.set(blockCode, { code: meta.code, label: meta.label, tier: meta.tier, count: 1 })
      bestRank.set(blockCode, RANK.get(meta.code) ?? Infinity)
      continue
    }
    existing.count += 1
    const rank = RANK.get(meta.code) ?? Infinity
    if (rank < (bestRank.get(blockCode) ?? Infinity)) {
      bestRank.set(blockCode, rank)
      existing.code = meta.code
      existing.label = meta.label
      existing.tier = meta.tier
    }
  }
  return out
}
