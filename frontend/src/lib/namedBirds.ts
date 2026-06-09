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

export type NamedBirdSort = 'name' | 'species' | 'lastSeen'

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

/** Sort named birds for display. name/species ascending; lastSeen descending. */
export function sortNamedBirds(birds: NamedBird[], sort: NamedBirdSort): NamedBird[] {
  const copy = [...birds]
  switch (sort) {
    case 'name':
      copy.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
        || a.commonName.localeCompare(b.commonName, undefined, { sensitivity: 'base' }))
      break
    case 'species':
      copy.sort((a, b) => a.commonName.localeCompare(b.commonName, undefined, { sensitivity: 'base' })
        || a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
      break
    case 'lastSeen':
    default:
      copy.sort((a, b) => b.lastSeen.localeCompare(a.lastSeen)
        || a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
      break
  }
  return copy
}
