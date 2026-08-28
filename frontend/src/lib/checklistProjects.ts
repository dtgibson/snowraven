// The derived projects tally — RECOMPUTED, never stored
// (county-shading-and-project-stats, schema.md Part E, FR-34, FR-54, FR-55,
// FR-56).
//
// WHY NOTHING DERIVED IS PERSISTED. The repo's denormalized-published-field rule
// permits a published classification in a cache document only when a PASSIVE
// READER STRUCTURALLY CANNOT re-derive it (the Calendar holds no name-to-code
// join and may not fetch one, which is why the escapee store publishes
// `excludedNames`). That precondition is not met here: the only reader of this
// tally is the Statistics tab's Projects section, the same surface that owns the
// sweep and holds the loaded backup, so it has both inputs in hand and can
// re-derive every figure at zero network cost. Publishing a denormalized copy
// would buy nothing and would create exactly the stale-cache trap the rule warns
// about — stored counts and date spans surviving a newer export and quietly
// contradicting the file the user just loaded.
//
// THE JOIN DIRECTION IS BACKUP -> STORE. Iterate the backup's checklists, look
// up the store, skip misses. A store entry with no backup row contributes
// nothing. That is what makes a newer export correct dates automatically and
// drop checklists it no longer contains, and it means loading a SMALLER export
// correctly reduces `checked`.
//
// PURE: no storage, no transport, and NO CLOCK READ, so it is safe in a
// `useMemo` (NFR-10; `react-hooks/purity` is build-blocking).

import type { ChecklistEntry } from '../types'
import type { ChecklistProjectsEntry } from './checklistProjectsCache'
import { canonicalProject, hasPublishedName, isGenericPortal } from './projectLabels'
import { SUBMISSION_KEY_RE } from './checklistId'

export interface ProjectRow {
  /** Canonical key: both forms of one project collapse to it (QA-61). */
  key: string
  label: string
  /** True when the bundled table publishes a name for this identifier. False →
   *  the row renders its raw identifier in mono with the "no public endpoint
   *  names this" line. Nothing is invented. */
  named: boolean
  checklists: number
  /** min/max ChecklistEntry.date over this project's checklists, FROM THE
   *  BACKUP. Empty string when the backup carries no date for any of them. */
  firstDate: string
  lastDate: string
}

export interface PortalRow {
  /** The RAW projId value, exactly as eBird sent it. */
  code: string
  label: string
  named: boolean
  checklists: number
}

export interface ProjectsView {
  projects: ProjectRow[]
  /** The subordinate "how you submitted" reading. Never presented as a project. */
  portals: PortalRow[]
  /** Checklists in the backup that the store has an entry for — FRESH OR STALE
   *  (the TTL governs re-consultation, not display). */
  checked: number
  /** THE denominator: shape-valid distinct submission ids in the backup. */
  total: number
  /** Backup rows whose submission id fails the shape guard. Never requested,
   *  excluded from `total`, reported only when nonzero. */
  skipped: number
}

export const EMPTY_PROJECTS_VIEW: ProjectsView = {
  projects: [], portals: [], checked: 0, total: 0, skipped: 0,
}

/**
 * Join the store snapshot against the currently loaded backup and derive every
 * figure the Projects section can render.
 *
 * PROJECTS are, per checklist, the canonical keys of every element of `ids`,
 * PLUS the canonical key of `proj` when it is non-empty and NOT a generic
 * submission portal — so an unknown project portal shows as a project rather
 * than being silently dropped. They are collected into a SET PER CHECKLIST, so a
 * checklist naming one project as both `EBIRD_ATL_CA` and `1050` contributes
 * exactly one (QA-61).
 *
 * PORTALS are a count over the raw `proj` values (excluding ''), denominated by
 * `checked`.
 *
 * ORDERING: checklist count descending, label ascending as the tie-break, and no
 * rank numbers — these are contributions, not a ranking.
 */
export function deriveProjectsView(
  checklists: readonly ChecklistEntry[],
  snapshot: ReadonlyMap<string, ChecklistProjectsEntry>,
): ProjectsView {
  interface Work { key: string; label: string; named: boolean; n: number; first: string; last: string }
  const projects = new Map<string, Work>()
  const portals = new Map<string, { label: string; named: boolean; n: number }>()

  // Distinct ids, because a backup can in principle carry two rows for one
  // submission and the denominator is a count of CHECKLISTS.
  const seen = new Set<string>()
  let total = 0
  let skipped = 0
  let checked = 0

  for (const c of checklists) {
    const id = c.submissionId
    if (typeof id !== 'string' || seen.has(id)) continue
    seen.add(id)
    if (!SUBMISSION_KEY_RE.test(id)) { skipped += 1; continue }
    total += 1

    const entry = snapshot.get(id)
    if (!entry) continue
    checked += 1

    const date = typeof c.date === 'string' ? c.date : ''

    // One SET per checklist, so both forms of one project count once.
    const keys = new Map<string, { label: string; named: boolean }>()
    for (const numeric of entry.ids) {
      const canon = canonicalProject(String(numeric))
      keys.set(canon.key, { label: canon.label, named: hasPublishedName(String(numeric)) })
    }
    if (entry.proj !== '' && !isGenericPortal(entry.proj)) {
      const canon = canonicalProject(entry.proj)
      keys.set(canon.key, { label: canon.label, named: hasPublishedName(entry.proj) })
    }
    for (const [key, { label, named }] of keys) {
      let w = projects.get(key)
      if (!w) { w = { key, label, named, n: 0, first: '', last: '' }; projects.set(key, w) }
      w.n += 1
      if (date !== '') {
        if (w.first === '' || date < w.first) w.first = date
        if (w.last === '' || date > w.last) w.last = date
      }
    }

    if (entry.proj !== '') {
      let p = portals.get(entry.proj)
      if (!p) {
        const canon = canonicalProject(entry.proj)
        p = { label: canon.label, named: hasPublishedName(entry.proj), n: 0 }
        portals.set(entry.proj, p)
      }
      p.n += 1
    }
  }

  const byCountThenLabel = <T extends { checklists: number; label: string }>(a: T, b: T) =>
    b.checklists - a.checklists || a.label.localeCompare(b.label)

  return {
    projects: [...projects.values()]
      .map(w => ({
        key: w.key, label: w.label, named: w.named,
        checklists: w.n, firstDate: w.first, lastDate: w.last,
      }))
      .sort(byCountThenLabel),
    portals: [...portals.entries()]
      .map(([code, p]) => ({ code, label: p.label, named: p.named, checklists: p.n }))
      .sort(byCountThenLabel),
    checked,
    total,
    skipped,
  }
}

/**
 * The target set for a pass: shape-valid distinct submission ids in the backup,
 * ordered NEWEST FIRST (FR-41, FR-42).
 *
 * There is NO SERIALIZED CURSOR anywhere, which is precisely what makes "resume
 * after a quit" and "second run after a newer export" the SAME operation.
 *
 * `mode`:
 *   'pending' — minus ids already answered and still fresh (start / resume).
 *   'all'     — every shape-valid id ("Check again", the force path).
 *   'ids'     — an explicit subset, re-ordered ("Try again" over the unanswered).
 *
 * Ordering: checklist date descending, submission id descending as a
 * deterministic tie-break. NUMERIC on the id, not lexicographic, so S1000
 * precedes S999 the way a reader expects — safe because the shape guard bounds
 * the parse at 10^15, well under 2^53.
 */
export function buildTargetIds(
  checklists: readonly ChecklistEntry[],
  snapshot: ReadonlyMap<string, ChecklistProjectsEntry>,
  nowMs: number,
  ttlMs: number,
  mode: 'pending' | 'all' | { only: ReadonlySet<string> } = 'pending',
): string[] {
  const dateOf = new Map<string, string>()
  const out: string[] = []
  const seen = new Set<string>()
  for (const c of checklists) {
    const id = c.submissionId
    if (typeof id !== 'string' || seen.has(id)) continue
    seen.add(id)
    if (!SUBMISSION_KEY_RE.test(id)) continue
    dateOf.set(id, typeof c.date === 'string' ? c.date : '')
    if (typeof mode === 'object') {
      if (!mode.only.has(id)) continue
    } else if (mode === 'pending') {
      const entry = snapshot.get(id)
      if (entry && nowMs - entry.at < ttlMs) continue
    }
    out.push(id)
  }
  const idNum = (id: string) => Number(id.slice(1))
  out.sort((a, b) =>
    (dateOf.get(b) ?? '').localeCompare(dateOf.get(a) ?? '') || idNum(b) - idNum(a))
  return out
}
