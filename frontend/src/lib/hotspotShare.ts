// The share of the user's checklists submitted at public eBird hotspots
// (hotspot-share-stat, schema.md section 5): one pure classification over the
// per-checklist rows, the percentage pair, and the view discriminator the copy
// module and the Statistics tab share.
//
// THE SOURCE OF HOTSPOT STATUS is the region-scoped hotspot Set the tab's
// HotspotLinks already read (`lib/hotspotSet.ts`), taken from the same resolution
// snapshot, so every top location drawn as a link counts its checklists as
// hotspot and every plain one in an answered region counts as personal. Nothing
// else is consulted: the export carries no hotspot column.
//
// THREE STATES, never two. A checklist whose region has never answered (its first
// lookup pending, failed or rate limited past its rounds) or that carries no
// askable region code is UNCLASSIFIED, never folded into "personal", so the block
// never shows a percentage over a region eBird has not answered for.
//
// DECLARED SCAN (schema.md 7.1, `.claude/rules/security.md`): `computeHotspotShare`
// is one linear pass over the parsed checklist rows. Per row it runs the anchored
// REGION_RE test on the region cell (linear in the cell, bounded by one pass), one
// `Map.get` on a per-pass map holding at most one entry per DISTINCT region code,
// and `isPublicHotspot` (the anchored LOC_ID_RE then one `Set.has`). No includes,
// indexOf, find or filter inside the loop, no nested scan, no allocation sized
// from a count read off the file beyond that map. O(C + R) per draw, identical per
// re-draw; a re-draw happens only when the checklist array or the snapshot changes.

import { isPublicHotspot, isAskableRegionCode, type HotspotResolution, type RegionResolution } from './hotspotSet'
import type { ChecklistEntry } from '../types'

export interface HotspotShare {
  /** checklists.length: distinct Submission IDs. */
  total: number
  hotspot: number
  personal: number
  /** === total - hotspot - personal */
  unclassified: number
  /** The subset of `unclassified` with no askable region code. */
  noRegion: number
  /** Distinct askable region codes among the checklists (r). */
  regionsTotal: number
  regionsPending: number
  /** Regions that have never answered (k). A region whose refresh failed is answered. */
  regionsUnanswered: number
}

/** The two cells the classification reads. `ChecklistEntry` satisfies it. */
export type ShareChecklist = Pick<ChecklistEntry, 'locationId' | 'stateProvince'>

export function computeHotspotShare(
  checklists: readonly ShareChecklist[],
  res: HotspotResolution,
): HotspotShare {
  let hotspot = 0
  let personal = 0
  let unclassified = 0
  let noRegion = 0
  const seen = new Map<string, RegionResolution>()
  for (const c of checklists) {
    const code = c.stateProvince
    if (!isAskableRegionCode(code)) {
      unclassified += 1
      noRegion += 1
      continue
    }
    let status = seen.get(code)
    if (status === undefined) {
      // A region absent from the snapshot (the first render, before the hook's
      // first build) reads as pending, so that window says "checking", never
      // "carries no region code".
      status = res.byRegion.get(code) ?? 'pending'
      seen.set(code, status)
    }
    // A shape-valid id in the Set is a hotspot whatever its region reads: the
    // Set holds only ids some region answered with.
    if (isPublicHotspot(c.locationId, res.set)) hotspot += 1
    else if (status === 'answered') personal += 1
    else unclassified += 1
  }
  let regionsPending = 0
  let regionsUnanswered = 0
  for (const s of seen.values()) {
    if (s === 'pending') regionsPending += 1
    else if (s === 'unanswered') regionsUnanswered += 1
  }
  return {
    total: checklists.length,
    hotspot, personal, unclassified, noRegion,
    regionsTotal: seen.size, regionsPending, regionsUnanswered,
  }
}

export interface SharePctPair {
  hotspot: string
  personal: string
  /** The ONE rounding: Math.round(h / m * 100). */
  hotspotPct: number
}

/**
 * The displayed percentage pair (FR-14, FR-15): one rounding, so the two whole
 * figures read as a partition of 100%; a nonzero count never reads "0%" (it reads
 * "<1%" beside ">99%"), and a zero count reads "0%" beside "100%". Requires m > 0.
 *
 * It agrees with `fmtSharePct(h, m)` for the hotspot figure everywhere except a
 * nonzero complement that rounds away (999 of 1,000): a lone figure is honestly
 * "100%" there, but in a pair the nonzero personal share must not read "0%", so
 * the pair owns its rule. The test pins that one divergence as a named row.
 */
export function sharePctPair(h: number, m: number): SharePctPair {
  const hotspotPct = Math.round(h / m * 100)
  if (h === 0) return { hotspot: '0%', personal: '100%', hotspotPct }
  if (h === m) return { hotspot: '100%', personal: '0%', hotspotPct }
  if (hotspotPct === 0) return { hotspot: '<1%', personal: '>99%', hotspotPct }
  if (hotspotPct === 100) return { hotspot: '>99%', personal: '<1%', hotspotPct }
  return { hotspot: `${hotspotPct}%`, personal: `${100 - hotspotPct}%`, hotspotPct }
}

export type HotspotShareView =
  | { kind: 'hidden' }
  | { kind: 'no-key' }
  | { kind: 'pending'; u: number; m: number; h: number; p: number }
  | { kind: 'offline'; u: number; m: number; h: number; p: number }
  | { kind: 'unanswered'; k: number; r: number; u: number; m: number; h: number; p: number }
  | { kind: 'no-region'; u: number; m: number; h: number; p: number }
  | { kind: 'settled'; h: number; p: number; m: number; pct: SharePctPair; hotspotWidthPct: number }

/**
 * The block's state. Precedence, first match wins: no checklists hides it; a known
 * missing key wins over every resolution state (persisted answers included); an
 * unknown key status reads as pending; every checklist classified is settled (so a
 * stale stored answer, or a later launch offline, renders the full bar with no
 * marker); then a pending region, offline, a never-answered region, and finally
 * rows with no region code.
 */
export function hotspotShareView(
  share: HotspotShare,
  input: { hasEbirdKey: boolean | null; online: boolean },
): HotspotShareView {
  const { total: m, hotspot: h, personal: p, unclassified: u } = share
  if (m === 0) return { kind: 'hidden' }
  if (input.hasEbirdKey === false) return { kind: 'no-key' }
  if (input.hasEbirdKey === null) return { kind: 'pending', u, m, h, p }
  if (u === 0) return { kind: 'settled', h, p, m, pct: sharePctPair(h, m), hotspotWidthPct: h / m * 100 }
  if (share.regionsPending > 0) return { kind: 'pending', u, m, h, p }
  if (!input.online) return { kind: 'offline', u, m, h, p }
  if (share.regionsUnanswered > 0) {
    return { kind: 'unanswered', k: share.regionsUnanswered, r: share.regionsTotal, u, m, h, p }
  }
  return { kind: 'no-region', u, m, h, p }
}
