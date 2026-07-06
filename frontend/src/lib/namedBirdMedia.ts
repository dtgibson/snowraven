// The media join for named birds. Runs ONCE over the parsed Macaulay Library
// export and produces a Map<NamedBird.key, matchedAsset[]> so the Named Birds tab
// can show each individual's own photos/audio/video below its sightings map.
//
// A named bird's media is the set of ML-export rows whose OWN per-asset comment
// (caption / mediaNotes) names that individual with a [name:…] tag. It reuses:
//  • parseNameTags — the same [name:…] vocabulary the tab already uses.
//  • namedBirdKey  — the SAME key computeNamedBirds buckets on (name + normalized
//    species), so a media asset joins the correct individual and the same name on
//    two species never cross-attributes.
//  • the "caption + mediaNotes only, NOT observationDetails" field selection the
//    Multimedia tab's mediaComments.ts already established, for the same reason:
//    the ML export copies the eBird observation comment onto EVERY media row from
//    that observation, so observationDetails repeats across items and is not
//    asset-specific.
//
// Pure — no React, no I/O, no Date.now()/new Date(). Dates are compared lexically
// (eBird ISO YYYY-MM-DD), never parsed to Date for ordering.

import type { MLExportRow } from './parseMLExport'
import { parseNameTags, namedBirdKey } from './namedBirds'

export interface NamedBirdAsset {
  catalogId: string   // digits only — the parser guarantees ^\d+$ (ML prefix stripped)
  format: 'Photo' | 'Audio' | 'Video'
  date: string        // raw export date string ('' when absent); formatted at render
  checklistId: string // '' when absent; ChecklistLink guards ^S\d+$ at render
}

/**
 * Build the media join for named birds: a map of NamedBird.key → that
 * individual's matched assets, newest first (catalogId breaks date ties). Pure,
 * no network.
 *
 * Matching rule (FR-01..FR-04):
 *  - read name tags from caption + mediaNotes ONLY (never observationDetails)
 *  - key by name + normalized species via the shared `namedBirdKey`, so the join
 *    with computeNamedBirds is provably identical and species-scoped
 *  - a row whose caption + mediaNotes carry no [name:…] tag matches nothing
 *  - dedupe a catalogId within one bird's bucket (a row could tag the same name in
 *    both fields, or two distinct rows could share a catalogId)
 */
export function computeNamedBirdMedia(
  rows: MLExportRow[] | null | undefined,
): Map<string, NamedBirdAsset[]> {
  const byBird = new Map<string, NamedBirdAsset[]>()
  // Per-bucket set of catalogIds already added, so the same asset can't appear
  // twice under one individual.
  const seenIds = new Map<string, Set<string>>()
  if (!rows || rows.length === 0) return byBird

  for (const row of rows) {
    // Join the two per-asset fields with a newline so a "[name:" opened in one
    // field can't accidentally close against a "]" in the other. observationDetails
    // is excluded entirely (the copied observation comment — not asset-specific).
    const names = parseNameTags(`${row.caption}\n${row.mediaNotes}`)
    if (names.length === 0) continue

    for (const name of names) {
      const key = namedBirdKey(name, row.commonName)
      let bucket = byBird.get(key)
      let ids = seenIds.get(key)
      if (!bucket) {
        bucket = []
        ids = new Set<string>()
        byBird.set(key, bucket)
        seenIds.set(key, ids)
      }
      if (ids!.has(row.catalogId)) continue // per-bird dedupe by catalogId
      ids!.add(row.catalogId)
      bucket.push({
        catalogId: row.catalogId,
        format: row.format,
        date: row.date,
        checklistId: row.checklistId,
      })
    }
  }

  // Newest-first by date, catalogId as a stable tie-break (mirrors the tab's
  // newest-first sightings and mediaComments.ts's sort). Empty-string dates sort
  // to the end deterministically.
  for (const bucket of byBird.values()) {
    bucket.sort((a, b) =>
      a.date !== b.date ? b.date.localeCompare(a.date) : b.catalogId.localeCompare(a.catalogId))
  }

  return byBird
}
