// Individually-named birds, parsed from eBird species comments. Birders tag a
// specific individual in a checklist's species comment like "[name:Winky]" or
// "[name:one-leg-pete]"; this groups every tagged sighting into a per-individual
// record. Pure (no React, no I/O) so it's unit-testable.
//
// A named bird is keyed by name + species: "Pete" the Mallard and "Pete" the
// Canada Goose are different individuals. Names match case-insensitively but
// display as first written; species fold to the parent (subspecies merged).

import type { ObservationEntry } from '../types'
import { normalizeSpeciesName } from './speciesUtils'

export interface NamedSighting {
  date: string            // YYYY-MM-DD
  submissionId: string
  comment: string         // the full species comment for this observation
  location: string        // from ObservationEntry.location ('' when the export has none)
  locationId: string      // from ObservationEntry.locationId ('' when the export has none)
  latitude: number | null   // from ObservationEntry.latitude (null when absent)
  longitude: number | null  // from ObservationEntry.longitude (null when absent)
}

export interface NamedBird {
  key: string             // lowercased name :: normalized lowercased species
  name: string            // display name (as first written)
  commonName: string      // display species (as first written)
  scientificName: string
  firstSeen: string       // earliest sighting date
  lastSeen: string        // latest sighting date
  sightingCount: number
  sightings: NamedSighting[]  // newest first
}

export type NamedBirdSort = 'name' | 'alphabetical' | 'taxonomic' | 'lastSeen'

// Whitespace-lenient: matches [name:Winky], [ name : Old Blue ], [NAME:one-leg-pete].
// The value is everything up to the closing bracket (trimmed in parseNameTags).
// The {0,120} bound keeps matching LINEAR: an unbounded capture (lazy or greedy)
// backtracks catastrophically on an unclosed "[name:" followed by a long run — a
// ReDoS that would freeze the UI on a malformed comment in the user's own export.
const NAME_TAG_RE = /\[\s*name\s*:([^\]]{0,120})\]/gi

/** Extract the distinct name tags from one comment (case-insensitive, in order). */
export function parseNameTags(comment: string): string[] {
  if (!comment) return []
  const out: string[] = []
  const seen = new Set<string>()
  NAME_TAG_RE.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = NAME_TAG_RE.exec(comment)) !== null) {
    const value = m[1].trim()
    if (!value) continue
    const lower = value.toLowerCase()
    if (seen.has(lower)) continue   // don't double-count the same name in one comment
    seen.add(lower)
    out.push(value)
  }
  return out
}

/** Group every name-tagged observation into per-individual records. */
export function computeNamedBirds(observations: ObservationEntry[]): NamedBird[] {
  const map = new Map<string, NamedBird>()
  const seenSubs = new Map<string, Set<string>>()  // bird key → submission ids already counted
  for (const obs of observations) {
    const names = parseNameTags(obs.speciesComments)
    if (names.length === 0) continue
    const species = normalizeSpeciesName(obs.commonName)
    for (const name of names) {
      const key = `${name.toLowerCase()}::${species.toLowerCase()}`
      const sighting: NamedSighting = {
        date: obs.date,
        submissionId: obs.submissionId,
        comment: obs.speciesComments,
        location: obs.location,
        locationId: obs.locationId,
        latitude: obs.latitude,
        longitude: obs.longitude,
      }
      const existing = map.get(key)
      if (!existing) {
        map.set(key, {
          key,
          name,
          commonName: species,
          scientificName: obs.scientificName,
          firstSeen: obs.date,
          lastSeen: obs.date,
          sightingCount: 1,
          sightings: [sighting],
        })
        seenSubs.set(key, new Set([obs.submissionId]))
      } else {
        // Count one sighting per checklist: a parent + subspecies row of the same
        // checklist both tagged with this name must not double-count.
        const subs = seenSubs.get(key)!
        if (subs.has(obs.submissionId)) continue
        subs.add(obs.submissionId)
        existing.sightings.push(sighting)
        existing.sightingCount++
        if (obs.date < existing.firstSeen) existing.firstSeen = obs.date
        if (obs.date > existing.lastSeen) existing.lastSeen = obs.date
      }
    }
  }

  for (const bird of map.values()) {
    // Newest sighting first; submission id breaks ties for stable ordering.
    bird.sightings.sort((a, b) =>
      a.date !== b.date ? b.date.localeCompare(a.date) : b.submissionId.localeCompare(a.submissionId))
  }

  return [...map.values()]
}

/**
 * Sort named birds for display. Every option carries a name tie-break so equal
 * primary keys don't jitter.
 *
 * - `name` — by individual display name, then species.
 * - `alphabetical` — by species common name A–Z, then name.
 * - `taxonomic` — by the species' eBird taxonomic order (via `orderFor`), then
 *   name. Species with no known order resolve to `Infinity` → a stable tail,
 *   then name. Until the `orders` map loads, `orderFor` returns `Infinity` for
 *   every species (or is omitted), so the first comparator term is `NaN` for
 *   every pair and the list degrades to pure name order (FR-14).
 * - `lastSeen` — most-recent sighting first, then name.
 *
 * `orderFor` is optional: the reduced-set caller (Species Detail) and tests omit
 * it, in which case `taxonomic` falls back to the name tie-break.
 */
export function sortNamedBirds(
  birds: NamedBird[],
  sort: NamedBirdSort,
  orderFor?: (commonName: string) => number,
): NamedBird[] {
  const copy = [...birds]
  const byName = (a: NamedBird, b: NamedBird) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
  const bySpecies = (a: NamedBird, b: NamedBird) =>
    a.commonName.localeCompare(b.commonName, undefined, { sensitivity: 'base' })
  switch (sort) {
    case 'name':
      copy.sort((a, b) => byName(a, b) || bySpecies(a, b))
      break
    case 'alphabetical':
      copy.sort((a, b) => bySpecies(a, b) || byName(a, b))
      break
    case 'taxonomic': {
      const order = orderFor ?? (() => Infinity)
      // Infinity - Infinity is NaN (sorts as 0 → no swap), so two unknowns fall
      // through to the name tie-break — correct and stable.
      copy.sort((a, b) => (order(a.commonName) - order(b.commonName)) || byName(a, b))
      break
    }
    case 'lastSeen':
    default:
      copy.sort((a, b) => b.lastSeen.localeCompare(a.lastSeen) || byName(a, b))
      break
  }
  return copy
}
