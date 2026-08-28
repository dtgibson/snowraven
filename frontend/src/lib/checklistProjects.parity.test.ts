// SHARED-FIXTURE PARITY TEST — the JS half of the dual-transport projects
// lockstep (county-shading-and-project-stats, schema.md B.1/B.2, FR-24, FR-25,
// NFR-12, QA-25, QA-26).
//
// `normalizeProjectFields` / `checklistFieldFlags` (desktop) and
// `services.ebird._norm_project_fields` / `checklist_field_flags` (web/Pi) are
// twins kept in lockstep by comment only. This test and its pytest sibling
// (backend/tests/test_checklist_projects_parity.py) both load the ONE shared
// fixture (checklistProjects.fixture.json) and assert the SAME output, so if
// either twin drifts its own test fails.
//
// Both sides are driven through their SHIPPED exports, never a retyped copy of
// the pattern: a verification whose reference point is derived from the thing
// being verified cannot fail when that thing is wrong.

import { describe, it, expect } from 'vitest'
import { normalizeProjectFields, MAX_PROJECT_IDS, PROJECT_ID_MAX } from './tauri/checklistService'
import { checklistFieldFlags } from './checklistFields'
import fixture from './checklistProjects.fixture.json'

interface ProjIdRow { why: string; value?: unknown; expected: string }
interface ProjectIdsRow { why: string; value?: unknown; expected: number[] }
interface FieldFlagRow { why: string; fields: string | null; skipLocName: boolean; skipSpecies: boolean }

const projIdRows = fixture.projIdRows as unknown as ProjIdRow[]
const projectIdsRows = fixture.projectIdsRows as unknown as ProjectIdsRow[]
const fieldFlagRows = fixture.fieldFlagRows as unknown as FieldFlagRow[]

describe('projects seam normalization (desktop half of the parity pair)', () => {
  it('normalizes every shared-fixture projId to the expected string', () => {
    for (const r of projIdRows) {
      expect(normalizeProjectFields(r.value, []).projId, r.why).toBe(r.expected)
    }
  })

  it('normalizes every shared-fixture projectIds to the expected array', () => {
    for (const r of projectIdsRows) {
      expect(normalizeProjectFields('', r.value).projectIds, r.why).toEqual(r.expected)
    }
  })

  it('derives every shared-fixture fields= flag pair identically', () => {
    for (const r of fieldFlagRows) {
      expect(checklistFieldFlags(r.fields), r.why).toEqual({
        skipLocName: r.skipLocName, skipSpecies: r.skipSpecies,
      })
    }
  })

  // ── Non-vacuity ────────────────────────────────────────────────────────────
  // A fixture that had quietly lost its hostile rows would still pass every
  // loop above. These assert the probe set actually reaches the branches the
  // guard exists for, PER BLOCK rather than once for the file (the
  // per-partition rule: one assertion for the whole is not one per part).
  it('the projId block still carries the rows that make it discriminating', () => {
    const values = projIdRows.map(r => r.value)
    // The ANCHOR trap. Python's `$` matches before a trailing newline and
    // JavaScript's does not, so `re.match` would accept "EBIRD\n" here.
    expect(values).toContain('EBIRD\n')
    expect(values).toContain('\nEBIRD')
    expect(values).toContain('EBIRD\nX')
    // The CLASS trap (v0.5.54): a `\w`/`\d` pattern admits these on the Python
    // side only.
    expect(values).toContain('٠١٢')
    // Type rejection rather than coercion, and the length bound in both
    // directions.
    expect(values.some(v => typeof v === 'number')).toBe(true)
    expect(values.some(v => typeof v === 'boolean')).toBe(true)
    expect(values.some(v => typeof v === 'string' && v.length === 32)).toBe(true)
    expect(values.some(v => typeof v === 'string' && v.length === 33)).toBe(true)
    // The three real sampled values.
    for (const v of ['EBIRD', 'EBIRD_MERLIN', 'EBIRD_ATL_CA']) expect(values).toContain(v)
    expect(projIdRows.length).toBeGreaterThanOrEqual(15)
  })

  it('the projectIds block still carries the rows that make it discriminating', () => {
    const raw = JSON.stringify(projectIdsRows.map(r => r.value))
    // The `isinstance(True, int)` trap, in the two shapes that separate a
    // correct Python guard from a bare int check.
    expect(projectIdsRows.some(r => Array.isArray(r.value) && r.value.includes(true))).toBe(true)
    expect(projectIdsRows.some(
      r => Array.isArray(r.value) && r.value.includes(true) && r.value.includes(1050),
    )).toBe(true)
    // The coercion trap: a string element must be REJECTED, and the non-ASCII
    // digit string is its live form (int("١٠٥٠") is 1050 under both runtimes).
    expect(raw).toContain('"1050"')
    expect(raw).toContain('١٠٥٠')
    // The two bounds, each at and over its limit.
    expect(projectIdsRows.some(r => Array.isArray(r.value) && r.value.includes(PROJECT_ID_MAX))).toBe(true)
    expect(projectIdsRows.some(r => Array.isArray(r.value) && r.value.includes(PROJECT_ID_MAX + 1))).toBe(true)
    expect(projectIdsRows.some(r => Array.isArray(r.value) && r.value.length === MAX_PROJECT_IDS)).toBe(true)
    expect(projectIdsRows.some(r => Array.isArray(r.value) && r.value.length === MAX_PROJECT_IDS + 1)).toBe(true)
    expect(projectIdsRows.length).toBeGreaterThanOrEqual(15)
  })

  it('the fields block still carries every value both transports must agree on', () => {
    const values = fieldFlagRows.map(r => r.fields)
    for (const v of [null, '', 'provenance', 'projects', 'PROJECTS', 'projects,provenance', 'bogus']) {
      expect(values).toContain(v)
    }
    expect(values).toContain('projects\n')
  })

  // ── Mutation guards, in the forms the defect could actually return in ──────
  it('mutation guard: the ANCHORS must reject what a Python `$` would admit', () => {
    // The shipped JS side already rejects these, so this is the fixed reference
    // the backend's `fullmatch` has to meet. Reverting the backend to `.match()`
    // turns its half of the parity pair red on the same rows.
    expect(normalizeProjectFields('EBIRD\n', []).projId).toBe('')
    expect(normalizeProjectFields('\nEBIRD', []).projId).toBe('')
    expect(normalizeProjectFields('EBIRD\nX', []).projId).toBe('')
    expect(normalizeProjectFields('EBIRD', []).projId).toBe('EBIRD')
  })

  it('mutation guard: an ASCII-only class is what makes the two transports agree', () => {
    expect(normalizeProjectFields('٠١٢', []).projId).toBe('')
    expect(normalizeProjectFields('ebird', []).projId).toBe('')
    expect(normalizeProjectFields('EBIRD_ATL_CA', []).projId).toBe('EBIRD_ATL_CA')
  })

  it('mutation guard: a boolean element is rejected, not counted as the integer 1', () => {
    // In Python `isinstance(True, int)` is True, so a bare int check normalizes
    // [True] to [1] and invents a project id that eBird never sent. JS rejects
    // it for free; this pins the expected OUTPUT so the Python twin has a fixed
    // reference to meet.
    expect(normalizeProjectFields('', [true]).projectIds).toEqual([])
    expect(normalizeProjectFields('', [true, 1050]).projectIds).toEqual([1050])
  })

  it('mutation guard: a string element is rejected outright, never coerced', () => {
    expect(normalizeProjectFields('', ['1050']).projectIds).toEqual([])
    expect(normalizeProjectFields('', ['١٠٥٠']).projectIds).toEqual([])
  })

  it('mutation guard: both bounds hold at and over their limit', () => {
    expect(normalizeProjectFields('', [PROJECT_ID_MAX]).projectIds).toEqual([PROJECT_ID_MAX])
    expect(normalizeProjectFields('', [PROJECT_ID_MAX + 1]).projectIds).toEqual([])
    const nine = Array.from({ length: MAX_PROJECT_IDS + 1 }, (_, i) => i + 1)
    expect(normalizeProjectFields('', nine).projectIds).toHaveLength(MAX_PROJECT_IDS)
    expect(normalizeProjectFields('', 'A'.repeat(33)).projectIds).toEqual([])
  })

  it('mutation guard: `fields` stays whole-string equality, never a comma split', () => {
    // A comma-splitting rewrite would make this row set the flags, which is the
    // change that would put the shipped `provenance` caller's byte-identical
    // guarantee at risk.
    expect(checklistFieldFlags('projects,provenance')).toEqual({ skipLocName: false, skipSpecies: false })
    expect(checklistFieldFlags('provenance,projects')).toEqual({ skipLocName: false, skipSpecies: false })
    expect(checklistFieldFlags('provenance')).toEqual({ skipLocName: true, skipSpecies: false })
    expect(checklistFieldFlags('projects')).toEqual({ skipLocName: true, skipSpecies: true })
  })

  it('the whole normalized entry is fixed-shape and length-bounded (FR-36)', () => {
    // The reason the persisted document needs no JSON payload budget: every
    // dimension is bounded by THIS function, so no unbounded string can exist
    // in the store. Stated structurally, never as a byte product.
    const hostile = normalizeProjectFields(
      'A'.repeat(4096),
      Array.from({ length: 4096 }, () => 999_999_999),
    )
    expect(hostile.projId).toBe('')
    expect(hostile.projectIds).toHaveLength(MAX_PROJECT_IDS)
    const admitted = normalizeProjectFields('A'.repeat(32), [1, 2, 3])
    expect(admitted.projId.length).toBeLessThanOrEqual(32)
    for (const n of admitted.projectIds) expect(String(n).length).toBeLessThanOrEqual(9)
  })
})
