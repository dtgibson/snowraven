// The derived projects tally and the target-set derivation
// (county-shading-and-project-stats, FR-34, FR-41, FR-42, FR-54, FR-55, FR-56;
// QA-35, QA-43, QA-44, QA-59, QA-61, QA-62, QA-63, QA-64).
//
// Everything here is PURE: the store holds only the two normalized fields plus a
// TTL anchor, so every count, date and share is recomputed from the join against
// the CURRENTLY LOADED backup. That is what makes a newer export correct dates
// automatically and drop checklists it no longer contains, and it is why the
// tests below can perturb the backup and watch the answer move without touching
// the store at all.

import { describe, it, expect } from 'vitest'
import { deriveProjectsView, buildTargetIds } from './checklistProjects'
import type { ChecklistProjectsEntry } from './checklistProjectsCache'
import type { ChecklistEntry } from '../types'

const TTL = 365 * 24 * 60 * 60 * 1000
const NOW = 1_700_000_000_000

function list(submissionId: string, date: string): ChecklistEntry {
  return {
    submissionId, date,
    location: 'Somewhere', locationId: 'L1',
    latitude: null, longitude: null, county: 'Alameda', stateProvince: 'US-CA',
    time: null, duration: null, distance: null, area: null, protocol: null,
    numObservers: null, allObsReported: null, checklistComments: '',
    speciesCount: 1, individualCount: 1,
  }
}

const entry = (proj: string, ids: number[], at = NOW): ChecklistProjectsEntry => ({ proj, ids, at })

describe('deriveProjectsView — the join (FR-34, QA-35)', () => {
  const backup = [list('S1', '2026-02-14'), list('S2', '2026-04-02'), list('S3', '2026-06-28')]

  it('counts only checklists the store has an answer for', () => {
    const snap = new Map([['S1', entry('EBIRD_ATL_CA', [1050])]])
    const v = deriveProjectsView(backup, snap)
    expect(v.total).toBe(3)
    expect(v.checked).toBe(1)
    expect(v.projects[0].checklists).toBe(1)
  })

  it('joins BACKUP -> STORE, so a store entry with no backup row contributes nothing', () => {
    const snap = new Map([
      ['S1', entry('EBIRD_ATL_CA', [1050])],
      ['S99', entry('EBIRD_ATL_CA', [1050])],   // no longer in the export
    ])
    const v = deriveProjectsView(backup, snap)
    expect(v.checked).toBe(1)
    expect(v.projects[0].checklists).toBe(1)
  })

  it('a SMALLER export correctly reduces `checked` and the date span', () => {
    const snap = new Map([
      ['S1', entry('EBIRD_ATL_CA', [1050])],
      ['S3', entry('EBIRD_ATL_CA', [1050])],
    ])
    const wide = deriveProjectsView(backup, snap)
    expect(wide.checked).toBe(2)
    expect([wide.projects[0].firstDate, wide.projects[0].lastDate]).toEqual(['2026-02-14', '2026-06-28'])

    const narrow = deriveProjectsView([list('S1', '2026-02-14')], snap)
    expect(narrow.checked).toBe(1)
    expect([narrow.projects[0].firstDate, narrow.projects[0].lastDate]).toEqual(['2026-02-14', '2026-02-14'])
  })

  it('dates come from the BACKUP, so a re-dated export re-dates the span', () => {
    const snap = new Map([['S1', entry('EBIRD_ATL_CA', [1050])]])
    const redated = deriveProjectsView([list('S1', '2025-01-01')], snap)
    expect(redated.projects[0].firstDate).toBe('2025-01-01')
  })

  it('a shape-invalid id is excluded from the denominator and counted as skipped', () => {
    const v = deriveProjectsView([list('S1', '2026-01-01'), list('nope', '2026-01-02')], new Map())
    expect(v.total).toBe(1)
    expect(v.skipped).toBe(1)
  })

  it('counts distinct submissions, so a duplicated backup row does not inflate the total', () => {
    const v = deriveProjectsView([list('S1', '2026-01-01'), list('S1', '2026-01-01')], new Map())
    expect(v.total).toBe(1)
  })
})

describe('projects vs portals (FR-55, FR-56; QA-61, QA-62, QA-64)', () => {
  const backup = [list('S1', '2026-02-14'), list('S2', '2026-03-01'), list('S3', '2026-04-01')]

  it('QA-61: one project named by BOTH a code and a numeric id counts ONCE', () => {
    const snap = new Map([['S1', entry('EBIRD_ATL_CA', [1050])]])
    const v = deriveProjectsView(backup, snap)
    expect(v.projects).toHaveLength(1)
    expect(v.projects[0].checklists).toBe(1)
    expect(v.projects[0].label).toBe('California Breeding Bird Atlas')
  })

  it('a generic submission portal is NOT a project', () => {
    // "Submitted via Merlin" is not a project and this section will not present
    // it as one.
    const snap = new Map([
      ['S1', entry('EBIRD', [])],
      ['S2', entry('EBIRD_MERLIN', [])],
    ])
    const v = deriveProjectsView(backup, snap)
    expect(v.projects).toEqual([])
    expect(v.portals.map(p => p.code).sort()).toEqual(['EBIRD', 'EBIRD_MERLIN'])
  })

  it('QA-62: an UNKNOWN projId outside the generic set IS shown as a project, verbatim', () => {
    const snap = new Map([['S1', entry('FOO_BAR', [])]])
    const v = deriveProjectsView(backup, snap)
    expect(v.projects).toHaveLength(1)
    expect(v.projects[0].label).toBe('FOO_BAR')
    expect(v.projects[0].named).toBe(false)
  })

  it('QA-62: an unrecognized NUMERIC id is shown as a project with its raw value', () => {
    const snap = new Map([['S1', entry('EBIRD', [9999])]])
    const v = deriveProjectsView(backup, snap)
    expect(v.projects.map(p => [p.label, p.named])).toEqual([['9999', false]])
  })

  it('two unknown identifiers stay SEPARATE keys — the app does not guess', () => {
    const snap = new Map([
      ['S1', entry('', [9999])],
      ['S2', entry('FOO_BAR', [])],
    ])
    const v = deriveProjectsView(backup, snap)
    expect(v.projects.map(p => p.label).sort()).toEqual(['9999', 'FOO_BAR'])
  })

  it('QA-64: the portal breakdown counts the RAW projId, atlas portal included', () => {
    // "A project with its own portal appears in both places" — which is what the
    // section's own note says.
    const snap = new Map([
      ['S1', entry('EBIRD_ATL_CA', [1050])],
      ['S2', entry('EBIRD', [])],
      ['S3', entry('EBIRD', [])],
    ])
    const v = deriveProjectsView(backup, snap)
    expect(v.projects.map(p => [p.label, p.checklists])).toEqual([['California Breeding Bird Atlas', 1]])
    expect(v.portals.map(p => [p.label, p.checklists])).toEqual([
      ['eBird', 2], ['California Breeding Bird Atlas', 1],
    ])
  })

  it('an EMPTY projId contributes no portal row', () => {
    const snap = new Map([['S1', entry('', [1050])]])
    expect(deriveProjectsView(backup, snap).portals).toEqual([])
  })

  it('QA-63: the EARNED ZERO — checked > 0 with no project found', () => {
    const snap = new Map([['S1', entry('EBIRD', [])]])
    const v = deriveProjectsView(backup, snap)
    expect(v.checked).toBe(1)
    expect(v.projects).toEqual([])
  })
})

describe('ordering (FR-54, QA-59)', () => {
  it('orders by checklist count DESCENDING, label ascending as the tie-break', () => {
    const backup = Array.from({ length: 6 }, (_, i) => list(`S${i + 1}`, '2026-01-01'))
    const snap = new Map([
      ['S1', entry('ZED_PROJECT', [])],
      ['S2', entry('ALPHA_PROJECT', [])],
      ['S3', entry('MID_PROJECT', [])],
      ['S4', entry('MID_PROJECT', [])],
      ['S5', entry('MID_PROJECT', [])],
      ['S6', entry('ALPHA_PROJECT', [])],
    ])
    const v = deriveProjectsView(backup, snap)
    expect(v.projects.map(p => [p.label, p.checklists])).toEqual([
      ['MID_PROJECT', 3], ['ALPHA_PROJECT', 2], ['ZED_PROJECT', 1],
    ])
  })

  it('carries no rank field at all — these are contributions, not a ranking', () => {
    const v = deriveProjectsView([list('S1', '2026-01-01')], new Map([['S1', entry('X_PROJECT', [])]]))
    expect(Object.keys(v.projects[0]).sort()).toEqual(
      ['checklists', 'firstDate', 'key', 'label', 'lastDate', 'named'],
    )
  })
})

describe('buildTargetIds (FR-41, FR-42; QA-43, QA-44)', () => {
  const backup = [
    list('S100', '2026-01-01'),
    list('S1000', '2026-06-01'),
    list('S999', '2026-06-01'),   // same date as S1000 — the tie-break case
    list('S300', '2026-03-01'),
    list('junk', '2026-09-01'),   // shape-invalid: never requested
  ]

  it('QA-44: orders newest first, with the submission id descending NUMERICALLY', () => {
    // Numeric on the id, not lexicographic, so S1000 precedes S999 the way a
    // reader expects. The shape guard is what makes the parse safe.
    expect(buildTargetIds(backup, new Map(), NOW, TTL)).toEqual(['S1000', 'S999', 'S300', 'S100'])
  })

  it('never includes a shape-invalid id', () => {
    expect(buildTargetIds(backup, new Map(), NOW, TTL)).not.toContain('junk')
  })

  it("'pending' skips ids already answered and still fresh", () => {
    const snap = new Map([['S1000', entry('EBIRD', [], NOW - 1000)]])
    expect(buildTargetIds(backup, snap, NOW, TTL)).toEqual(['S999', 'S300', 'S100'])
  })

  it("'pending' RE-INCLUDES an id whose entry is past the TTL", () => {
    const snap = new Map([['S1000', entry('EBIRD', [], NOW - TTL - 1)]])
    expect(buildTargetIds(backup, snap, NOW, TTL)).toContain('S1000')
  })

  it('QA-43: resuming after a simulated quit asks only about unanswered ids', () => {
    // There is no cursor anywhere. The set is recomputed from scratch, so a
    // resume after a relaunch is the SAME operation as a first start.
    const snap = new Map([
      ['S1000', entry('EBIRD', [])],
      ['S999', entry('EBIRD', [])],
    ])
    expect(buildTargetIds(backup, snap, NOW, TTL)).toEqual(['S300', 'S100'])
  })

  it('QA-43: a NEWER export asks only about the checklists it added', () => {
    const answered = new Map(backup
      .filter(c => c.submissionId !== 'junk')
      .map(c => [c.submissionId, entry('EBIRD', [])] as const))
    const newer = [...backup, list('S2000', '2026-08-01'), list('S2001', '2026-08-02')]
    expect(buildTargetIds(newer, answered, NOW, TTL)).toEqual(['S2001', 'S2000'])
  })

  it("'all' is the FORCE path: every shape-valid id, however fresh", () => {
    // Without it, "Check again" would be a no-op press for a year after a
    // complete sweep, because the pending set is empty for the whole TTL.
    const answered = new Map(backup
      .filter(c => c.submissionId !== 'junk')
      .map(c => [c.submissionId, entry('EBIRD', [])] as const))
    expect(buildTargetIds(backup, answered, NOW, TTL, 'pending')).toEqual([])
    expect(buildTargetIds(backup, answered, NOW, TTL, 'all')).toEqual(['S1000', 'S999', 'S300', 'S100'])
  })

  it("QA-48: the explicit-subset mode re-asks ONLY the named ids, still newest first", () => {
    const only = new Set(['S100', 'S1000'])
    expect(buildTargetIds(backup, new Map(), NOW, TTL, { only })).toEqual(['S1000', 'S100'])
  })

  it('the explicit subset cannot smuggle in a shape-invalid id', () => {
    expect(buildTargetIds(backup, new Map(), NOW, TTL, { only: new Set(['junk']) })).toEqual([])
  })

  it('a checklist with no date still sorts deterministically', () => {
    const undated = [list('S5', ''), list('S6', '')]
    expect(buildTargetIds(undated, new Map(), NOW, TTL)).toEqual(['S6', 'S5'])
  })
})
