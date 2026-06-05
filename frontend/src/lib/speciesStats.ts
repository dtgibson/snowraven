// Pure per-species derivations for the Species Detail tab. Extracted from
// SpeciesDetail.tsx so the math is unit-testable and the component is rendering-only.
// Every function is a pure transform of a species' observations — no React, no I/O.

import type { ObservationEntry, MediaType } from '../types'
import { normalizeSpeciesName } from './speciesUtils'
import { BREEDING_CODE_MAP, BREEDING_CODES } from './breedingCodes'

const SUBMISSION_ID_RE = /^S\d+$/

// Canonical eBird ordering of breeding codes (index in the master list).
const BREEDING_CODE_CANONICAL_ORDER = new Map(BREEDING_CODES.map((d, i) => [d.code, i]))

/** Total/first/last/best-count summary for one species' observations (null if none). */
export function computeSightingsStats(speciesObs: ObservationEntry[]) {
  if (!speciesObs.length) return null
  const sorted = [...speciesObs].sort((a, b) => a.date.localeCompare(b.date))
  const first = sorted[0]
  const last = sorted[sorted.length - 1]
  let bestCount = -Infinity
  let bestObs: ObservationEntry | null = null
  let individualSum = 0
  let hasNumericCount = false
  for (const o of speciesObs) {
    if (o.count !== null) {
      if (o.count > bestCount) { bestCount = o.count; bestObs = o }
      individualSum += o.count
      hasNumericCount = true
    }
  }
  return {
    total: speciesObs.length,
    totalIndividuals: hasNumericCount ? individualSum : null,
    firstObs: first,
    lastObs: last,
    bestObs,
    bestCount: bestObs ? bestCount : null,
  }
}

/** Distinct Photo/Audio/Video catalog counts for the species (deduped by catalog id). */
export function computeMediaCounts(speciesObs: ObservationEntry[], mediaMap: Map<string, string>) {
  const counts = { Photo: 0, Audio: 0, Video: 0 }
  const seen = new Set<string>()
  for (const o of speciesObs) {
    for (const id of o.catalogIds) {
      if (!seen.has(id)) {
        seen.add(id)
        const type = mediaMap.get(id)
        if (type && type in counts) counts[type as keyof typeof counts]++
      }
    }
  }
  return counts
}

/** Highest (numeric) catalog id per media type, for the embedded "recent media". */
export function computeRecentMediaIds(speciesObs: ObservationEntry[], mediaMap: Map<string, string>): Record<MediaType, string | null> {
  const result: Record<MediaType, string | null> = { Photo: null, Audio: null, Video: null }
  for (const o of speciesObs) {
    for (const id of o.catalogIds) {
      if (!/^\d+$/.test(id)) continue
      const type = mediaMap.get(id)
      if (!type || !(type in result)) continue
      const current = result[type as MediaType]
      if (!current || Number(id) > Number(current)) result[type as MediaType] = id
    }
  }
  return result
}

/** Highest breeding-evidence category recorded for the species (null if none). */
export function computeBreedingPill(speciesObs: ObservationEntry[]) {
  let bestTier = 0
  for (const o of speciesObs) {
    if (!o.breedingCode) continue
    const def = BREEDING_CODE_MAP.get(o.breedingCode)
    if (def && def.tier > bestTier) bestTier = def.tier
  }
  if (bestTier === 0) return null
  const category = bestTier >= 3 ? 'Confirmed' : bestTier === 2 ? 'Probable' : 'Possible'
  return { tier: bestTier as 1 | 2 | 3 | 4, category }
}

/** Per-code breeding counts, sorted by tier then canonical eBird order. */
export function computeBreedingBreakdown(speciesObs: ObservationEntry[]) {
  const counts: Record<string, number> = {}
  for (const o of speciesObs) {
    if (o.breedingCode) counts[o.breedingCode] = (counts[o.breedingCode] ?? 0) + 1
  }
  return Object.entries(counts)
    .flatMap(([code, count]) => {
      const def = BREEDING_CODE_MAP.get(code)
      return def ? [{ code, tier: def.tier, label: def.label, count }] : []
    })
    .sort((a, b) => {
      if (b.tier !== a.tier) return b.tier - a.tier
      return (BREEDING_CODE_CANONICAL_ORDER.get(a.code) ?? 99) - (BREEDING_CODE_CANONICAL_ORDER.get(b.code) ?? 99)
    })
}

/** Locations where the species was seen, ranked by sighting count then name. */
export function computeLocationsSorted(speciesObs: ObservationEntry[]) {
  const counts = new Map<string, { count: number; locationId: string }>()
  for (const o of speciesObs) {
    const existing = counts.get(o.location)
    if (existing) {
      existing.count++
    } else {
      counts.set(o.location, { count: 1, locationId: o.locationId })
    }
  }
  return [...counts.entries()]
    .map(([location, { count, locationId }]) => ({ location, count, locationId }))
    .sort((a, b) => b.count !== a.count ? b.count - a.count : a.location.localeCompare(b.location))
}

/**
 * Species most frequently sharing checklists with the selected species. Returns
 * null when no species is selected, a no-data marker when the species has no valid
 * checklists, else the ranked co-occurrence list. `allObservations` is the full set;
 * `speciesObs` is the (filtered) target-species set.
 */
export function computeCoOccurrence(
  allObservations: ObservationEntry[],
  speciesObs: ObservationEntry[],
  selectedSpecies: string | null,
  mergeSubspecies: boolean,
) {
  if (!selectedSpecies) return null

  const targetIds = new Set<string>()
  for (const o of speciesObs) {
    if (o.submissionId && SUBMISSION_ID_RE.test(o.submissionId)) targetIds.add(o.submissionId)
  }

  if (targetIds.size === 0) return { type: 'no-data' as const }

  const speciesChecklist = new Map<string, Set<string>>()
  for (const o of allObservations) {
    if (!o.submissionId || !SUBMISSION_ID_RE.test(o.submissionId)) continue
    if (!targetIds.has(o.submissionId)) continue
    const name = mergeSubspecies ? normalizeSpeciesName(o.commonName) : o.commonName
    if (name === selectedSpecies) continue
    if (!speciesChecklist.has(name)) speciesChecklist.set(name, new Set())
    speciesChecklist.get(name)!.add(o.submissionId)
  }

  const results = [...speciesChecklist.entries()]
    .map(([name, ids]) => ({ name, count: ids.size, pct: Math.round((ids.size / targetIds.size) * 100) }))
    .filter(r => r.count >= 2)
    .sort((a, b) => b.pct !== a.pct ? b.pct - a.pct : b.count - a.count)

  return { type: 'results' as const, results, totalChecklists: targetIds.size }
}
