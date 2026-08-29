// Subspecies Explorer derivations (subspecies-explorer). Pure — no React, no
// I/O; every value derives from the already-parsed backup rows.
//
// One shared per-row classification, used by both contracts (schema.md):
//   1. parent = normalizeSpeciesName(commonName)   — the merged view's exact fold
//   2. isNonCountableForm(raw name)  → nonCountable (excluded from rows and
//      denominators everywhere per FR-02, tallied for the FR-13 parity ledger)
//   3. parent !== raw name           → form under parent (display name = raw name)
//   4. otherwise                     → plain (a species-level report)
//
// The fold is normalizeSpeciesName — NEVER truncateAtFirstParen, which is the
// CSV parsers' first-paren cut and a deliberately different function; using it
// here would break the FR-13 parity identity with the merged `speciesObs` memo:
//
//   breakdown.total + breakdown.nonCountableCount === speciesObs.length
//                                                 === Sightings "Checklists"
//
// Countability is decided ONLY by the shared isNonCountableForm on the RAW
// name (NFR-06); no classification rule is introduced here.

import type { ObservationEntry } from '../types'
import { normalizeSpeciesName, isNonCountableForm } from './speciesUtils'

// ── Display copy (single-sourced so tests can sweep it; NFR-05: no U+2014) ──

/** The species-level row's label. Display copy, not a bird name — it renders as
 *  plain text, never through BirdName (design-spec.md). */
export const NO_FORM_NOTED_LABEL = 'No form noted'

/** "N reports" / "1 report" (row count units). */
export function reportCountLabel(n: number): string {
  return n === 1 ? '1 report' : `${n} reports`
}

/** "N species" (the control's count suffix; "species" is an invariant plural). */
export function speciesCountLabel(n: number): string {
  return `${n} species`
}

/** "N forms" / "1 form" (the list row's trailing count). */
export function formCountLabel(n: number): string {
  return n === 1 ? '1 form' : `${n} forms`
}

/** The FR-13 ledger footnote. The numbers are live; the sentence shape is fixed
 *  (design-spec.md), with a grammatical singular per the copy conventions (no
 *  count of one takes a plural noun or a plural verb). */
export function ledgerNote(nonCountable: number, sightingsTotal: number): string {
  if (nonCountable === 1) {
    return `1 report uses a name that is not a countable subspecies or form, such as a hybrid or a slash. The Sightings total of ${sightingsTotal} includes it; this breakdown does not.`
  }
  return `${nonCountable} reports use names that are not countable subspecies or forms, such as hybrids or slashes. The Sightings total of ${sightingsTotal} includes them; this breakdown does not.`
}

// ── Contract A: full-backup index (once per loaded backup) ──────────────────

export interface SubspeciesIndexEntry {
  /** Countable form rows only: raw reported name → row count. */
  formCounts: Map<string, number>
  /** Species-level rows. */
  plainCount: number
  /** Rows folding here that FR-02 excludes (the parity ledger). */
  nonCountableCount: number
}

export type SubspeciesIndex = Map<string, SubspeciesIndexEntry>

/** Tally the FULL backup once. A species qualifies for the explorer when its
 *  entry has formCounts.size >= 1 (FR-03). The county/date filters and both
 *  toggles are structurally not inputs (FR-08, FR-20): the function takes none
 *  of them. Memoize on the observations array reference — a new upload produces
 *  a new reference (observationsCache), which is what FR-22 keys on. */
export function buildSubspeciesIndex(observations: readonly ObservationEntry[]): SubspeciesIndex {
  const index: SubspeciesIndex = new Map()
  for (const o of observations) {
    const name = o.commonName
    const parent = normalizeSpeciesName(name)
    let entry = index.get(parent)
    if (!entry) {
      entry = { formCounts: new Map(), plainCount: 0, nonCountableCount: 0 }
      index.set(parent, entry)
    }
    if (isNonCountableForm(name)) entry.nonCountableCount += 1
    else if (parent !== name) entry.formCounts.set(name, (entry.formCounts.get(name) ?? 0) + 1)
    else entry.plainCount += 1
  }
  return index
}

// ── Shared row shaping (FR-09..FR-12) ───────────────────────────────────────

export interface BreakdownRow {
  kind: 'form' | 'plain'
  /** Full raw reported name for forms (FR-17); NO_FORM_NOTED_LABEL for plain. */
  name: string
  count: number
  /** One-decimal percent value (e.g. 50.8). Drives the share-bar width. */
  pct: number
  /** Display string: "50.8%", or a flat "100%" for a single-row section (FR-12). */
  pctLabel: string
}

/** Shape a form/plain tally into display rows.
 *
 *  Ordering: forms by count descending, ties alphabetical (count desc equals
 *  share desc — one denominator); the plain row pinned last, present only when
 *  plainCount > 0 (FR-10, FR-16).
 *
 *  Percentages (FR-12): computed from exact counts in integer TENTHS of a
 *  percent (no float accumulation); every nonzero row floors at 1 tenth (0.1%);
 *  the rounding residue — positive or negative, including residue created by the
 *  floor — is absorbed by the largest row, so displayed values sum to exactly
 *  100.0. A single row displays a flat "100%". If the largest row cannot absorb
 *  a negative residue without breaking its own floor, the remainder spills to
 *  the next largest (reachable only past ~1,000 distinct rows; defensive).
 */
function shapeRows(
  formCounts: ReadonlyMap<string, number>,
  plainCount: number,
): { rows: BreakdownRow[]; total: number } {
  const rows: BreakdownRow[] = [...formCounts.entries()]
    .sort((a, b) => (b[1] - a[1]) || a[0].localeCompare(b[0]))
    .map(([name, count]) => ({ kind: 'form' as const, name, count, pct: 0, pctLabel: '' }))
  if (plainCount > 0) {
    rows.push({ kind: 'plain', name: NO_FORM_NOTED_LABEL, count: plainCount, pct: 0, pctLabel: '' })
  }
  const total = rows.reduce((sum, r) => sum + r.count, 0)
  if (total === 0) return { rows: [], total: 0 }

  const tenths = rows.map(r => Math.max(1, Math.round((r.count / total) * 1000)))
  let residue = 1000 - tenths.reduce((sum, t) => sum + t, 0)
  // Largest row first (ties: first in display order, which is count desc).
  const byCountDesc = rows.map((_, i) => i).sort((a, b) => (rows[b].count - rows[a].count) || (a - b))
  for (const i of byCountDesc) {
    if (residue === 0) break
    if (residue > 0) {
      tenths[i] += residue
      residue = 0
    } else {
      const give = Math.min(-residue, tenths[i] - 1)
      tenths[i] -= give
      residue += give
    }
  }
  const single = rows.length === 1
  for (let i = 0; i < rows.length; i++) {
    rows[i].pct = tenths[i] / 10
    rows[i].pctLabel = single ? '100%' : `${(tenths[i] / 10).toFixed(1)}%`
  }
  return { rows, total }
}

// ── Explorer list entries (FR-05, FR-08) ────────────────────────────────────

export interface ExplorerEntry {
  species: string
  /** Shaped over the species' FULL-backup tally, so with no filter active the
   *  list's numbers agree with the breakdown exactly. Form rows only. */
  forms: BreakdownRow[]
}

/** The explorer list: qualifying species in the given selector order (FR-05),
 *  each with its forms shaped by the same rules as the breakdown. Always the
 *  full backup — never a filtered slice (FR-08). */
export function explorerEntries(
  index: SubspeciesIndex,
  speciesOrder: readonly string[],
): ExplorerEntry[] {
  const out: ExplorerEntry[] = []
  for (const species of speciesOrder) {
    const entry = index.get(species)
    if (!entry || entry.formCounts.size === 0) continue
    const { rows } = shapeRows(entry.formCounts, entry.plainCount)
    out.push({ species, forms: rows.filter(r => r.kind === 'form') })
  }
  return out
}

// ── Contract B: filtered breakdown (once per species/filter change) ─────────

export interface Breakdown {
  rows: BreakdownRow[]
  /** plainCount + sum of countable form counts (FR-11). */
  total: number
  /** The FR-13 parity delta vs speciesObs.length. */
  nonCountableCount: number
}

/** Compute the breakdown from the page's EXISTING `speciesObs` memo, unmodified
 *  — the same rows the Sightings section aggregates, so filter behavior (FR-14)
 *  is inherited rather than reimplemented and the FR-13 identity is exact.
 *  Memoize on the speciesObs reference (it already changes exactly once per
 *  species/filter change). */
export function computeSpeciesBreakdown(speciesObs: readonly ObservationEntry[]): Breakdown {
  const formCounts = new Map<string, number>()
  let plainCount = 0
  let nonCountableCount = 0
  for (const o of speciesObs) {
    const name = o.commonName
    if (isNonCountableForm(name)) nonCountableCount += 1
    else if (normalizeSpeciesName(name) !== name) formCounts.set(name, (formCounts.get(name) ?? 0) + 1)
    else plainCount += 1
  }
  const { rows, total } = shapeRows(formCounts, plainCount)
  return { rows, total, nonCountableCount }
}

/** The "Form noted" headline value: the sum of the displayed form-row
 *  percentages (in tenths, so it is exactly consistent with the rows beneath
 *  it), formatted with the same flat-100% rule as a single row. */
export function formNotedLabel(breakdown: Breakdown): string {
  const formRows = breakdown.rows.filter(r => r.kind === 'form')
  if (breakdown.rows.length === 1 && formRows.length === 1) return '100%'
  const tenths = formRows.reduce((sum, r) => sum + Math.round(r.pct * 10), 0)
  return `${(tenths / 10).toFixed(1)}%`
}
