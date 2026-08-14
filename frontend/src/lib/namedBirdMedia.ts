// The media join for named birds. Runs ONCE over the parsed Macaulay Library
// export and produces a Map<NamedBird.key, matchedAsset[]> so the Named Birds tab
// can show each individual's own photos/audio/video below its sightings map.
//
// A named bird's media is matched by a per-row PRECEDENCE (v0.5.75), never a union:
//   1. the asset's OWN comment — caption + mediaNotes — is the authority;
//   2. only when that carries no [name:…] tag does the row fall back to
//      observationDetails, the eBird species comment for that observation.
// Precedence, not union, so a per-asset caption CORRECTS a broader observation tag
// instead of being added to it: caption a photo [name:Pilgrim] on an observation
// tagged [name:Winky] and it counts only for Pilgrim.
//
// Why the fallback exists. v0.5.66 excluded observationDetails outright, reasoning
// that the ML export copies the observation comment onto every asset from that
// observation. That is true, but it grouped observationDetails with the CHECKLIST
// comment, which is far broader. An observation comment is scoped to one species on
// one checklist — and it is the very field computeNamedBirds parses to discover a
// named individual in the first place. Excluding it meant the tag that CREATES a
// named bird could never attribute that bird's media, so a birder who tags the
// ordinary way (in the species comment, not per asset) got a guaranteed empty state.
//
// What the fallback attributes. Every uncaptioned asset from a name-tagged
// observation. For one individual, one species, one checklist this is exact. It
// over-attributes only when a birder photographs a DIFFERENT, untagged bird of the
// same species on the same checklist; captioning that asset is the explicit override
// the precedence rule honors. When an observation names two individuals, both get
// all of its uncaptioned assets — the honest superset when the data cannot say which
// is which. Do NOT suppress the fallback on multi-name observations: that would
// blank exactly the birders who tag the most.
//
// NOTE: mediaComments.ts still excludes observationDetails, and the two are now
// DELIBERATELY divergent. That module LISTS comments, where the copied observation
// text would repeat identically across every asset from one observation. This module
// answers a different question — which assets show this individual — for which a
// species-and-checklist-scoped tag is a legitimate signal. Do not re-unify them.
//
// It reuses:
//  • parseNameTags — the same [name:…] vocabulary the tab already uses.
//  • namedBirdKey  — the SAME key computeNamedBirds buckets on (name + normalized
//    species), so a media asset joins the correct individual and the same name on
//    two species never cross-attributes.
//
// Pure — no React, no I/O, no Date.now()/new Date(). Dates are compared lexically
// (eBird ISO YYYY-MM-DD), never parsed to Date for ordering.

import type { MLExportRow } from './parseMLExport'
import { parseNameTags, namedBirdKey } from './namedBirds'

export interface NamedBirdAsset {
  catalogId: string   // digits only — the parser guarantees ^\d+$ (ML prefix stripped)
  format: 'Photo' | 'Audio' | 'Video'
  date: string        // raw export date string ('' when absent); formatted at render
  checklistId: string // '' when absent; ChecklistLink guards ^S\d{1,15}$ at render
}

/**
 * Build the media join for named birds: a map of NamedBird.key → that
 * individual's matched assets, newest first (catalogId breaks date ties). Pure,
 * no network.
 *
 * Matching rule (FR-01..FR-04, precedence added v0.5.75):
 *  - read name tags from the asset's own caption + mediaNotes FIRST; if that yields
 *    any name, those are the row's names and observationDetails is NOT consulted
 *  - only when it yields none, fall back to observationDetails (the species comment)
 *  - never merge the two sets — the asset's own comment overrides, it does not add
 *  - key by name + normalized species via the shared `namedBirdKey`, so the join
 *    with computeNamedBirds is provably identical and species-scoped
 *  - a row with no [name:…] tag in either place matches nothing
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
    // field can't accidentally close against a "]" in the other.
    const own = parseNameTags(`${row.caption}\n${row.mediaNotes}`)
    // PRECEDENCE, not union: the asset's own comment wins outright when it names
    // anyone, so a caption can correct a broader observation tag. observationDetails
    // is consulted ONLY when the asset says nothing itself.
    const names = own.length > 0 ? own : parseNameTags(row.observationDetails)
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
