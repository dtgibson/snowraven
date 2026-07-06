// Pure, React-free core for the Weather Backlog (bottom of the Weather tab).
// All filter / order / paginate logic lives here so it is unit-tested like
// lib/checklistsTab.ts — no React, no I/O, no Date.now()/new Date().
//
// The backlog lists the user's most-recent checklists whose comment carries NO
// recognized weather block (SnowRaven OR RainCrow), newest first, built entirely
// from the already-loaded eBird backup. The default view keeps only complete,
// non-incidental checklists; the widen toggle adds incomplete + incidental as a
// SUPERSET (it never switches to a different set).
//
// See pipeline/weather-backlog/{prd,schema,design-spec,decisions}.md.

import type { ChecklistRowData } from './checklistsTab'
import type { ChecklistEntry } from '../types'

/** eBird "Incidental" protocol code. VERIFIED: checklistMeta.ts PROTOCOL_NAMES
 *  maps P20 → 'Incidental' (P22 is Traveling), and ChecklistEntry.protocol stores
 *  the RAW eBird code (e.g. "P20"), not a mapped display name. FR-07. */
export const INCIDENTAL_PROTOCOL = 'P20' as const

/** How many rows are revealed per page / initially (FR-20a). */
export const PAGE_SIZE = 100

export interface BacklogOptions {
  /** FR-21: off = complete & non-incidental only; on = widen to include
   *  incomplete + incidental. The widen is a superset, not a switched set. */
  includeWidened: boolean
}

export interface BacklogRow {
  row: ChecklistRowData
  /** allObsReported === true (a null/false flag is NOT complete — FR-08). */
  isComplete: boolean
  /** protocol === 'P20' (FR-07). */
  isIncidental: boolean
  /** True when this row is present ONLY because the widen toggle is on — i.e.
   *  it is not complete, or it is incidental. Drives the FR-14 widen marker. */
  surfacedByWiden: boolean
}

/** Incidental protocol predicate. A null protocol fails the equality, so a
 *  protocol-less checklist is treated as non-incidental (FR-07 read literally). */
export function isIncidental(c: ChecklistEntry): boolean {
  return c.protocol === INCIDENTAL_PROTOCOL
}

/** No recognized weather block (SnowRaven OR RainCrow). Reads the precomputed
 *  `weatherBlock` flag from buildChecklistRows — does NOT re-run any detector
 *  (FR-05, FR-06). */
export function hasNoWeatherBlock(r: ChecklistRowData): boolean {
  return !r.weatherBlock
}

/** allObsReported === true. A null (unknown) or false flag is NOT complete
 *  (FR-08) → excluded from the default view, included when widened. */
function isComplete(c: ChecklistEntry): boolean {
  return c.allObsReported === true
}

/**
 * Build the full ordered, filtered backlog (NOT yet paginated).
 *
 * 1. Always keep only rows with no recognized weather block (FR-05/06).
 * 2. Default (off): keep only complete && non-incidental (FR-07). Widened (on):
 *    keep all remaining rows — a SUPERSET of the default set (FR-21).
 * 3. Order newest-first by checklist.date descending (dates are "YYYY-MM-DD",
 *    so a reverse localeCompare is correct and stable), tiebroken by
 *    submissionId descending so ordering + pagination are deterministic and
 *    repeatable across reloads (FR-09). submissionId is always present as a map
 *    key, giving a total order even when two checklists share a date.
 *
 * One row per submission id is already guaranteed upstream by buildChecklistRows
 * (one row per checklist — FR-10).
 */
export function computeBacklog(
  rows: ChecklistRowData[],
  opts: BacklogOptions,
): BacklogRow[] {
  const out: BacklogRow[] = []
  for (const r of rows) {
    if (!hasNoWeatherBlock(r)) continue
    const c = r.checklist
    const complete = isComplete(c)
    const incidental = isIncidental(c)
    const surfacedByWiden = !complete || incidental
    // Default view drops rows that only the widen toggle would surface.
    if (!opts.includeWidened && surfacedByWiden) continue
    out.push({ row: r, isComplete: complete, isIncidental: incidental, surfacedByWiden })
  }
  out.sort((a, b) => {
    const byDate = b.row.checklist.date.localeCompare(a.row.checklist.date)
    if (byDate !== 0) return byDate
    return b.row.checklist.submissionId.localeCompare(a.row.checklist.submissionId)
  })
  return out
}

export interface PagedBacklog {
  visible: BacklogRow[]
  total: number
  /** total > shown → offer "Show next 100" / "Show all". */
  hasMore: boolean
  /** How many would be shown after "Show next 100", capped at total. */
  nextCount: number
}

/** Pure slice helper (FR-20). `shown` is the count currently revealed. */
export function pageBacklog(all: BacklogRow[], shown: number): PagedBacklog {
  const total = all.length
  const clampedShown = Math.max(0, Math.min(shown, total))
  return {
    visible: all.slice(0, clampedShown),
    total,
    hasMore: total > clampedShown,
    nextCount: Math.min(clampedShown + PAGE_SIZE, total),
  }
}
