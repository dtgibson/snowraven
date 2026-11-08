// @vitest-environment jsdom
//
// ebird-request-economy D-02: the "answer with no observation list" refusal on
// the COMPOSED seam, on both transports. The parity suite
// (checklistProvenance.parity.test.ts) drives the desktop service alone and the
// controller suite (useExoticProvenance.test.tsx) mocks `transport` whole, so
// each half fakes the other; this file runs them together (testing.md, v1.0.14:
// a pair of guards that each mock the other needs one test of the composed
// seam). The real controller, the real transport and, on desktop, the real
// `getChecklist` run; only the outermost seams are faked: `tauriFetch` with
// eBird's raw bodies, or `fetch` with what backend/routers/checklists.py
// answers for them (its pytest twin, test_checklist_provenance_parity.py, pins
// that route), plus storage and the platform. A body with no observation list
// is a failed checklist with no ledger entry and no stamp; the legitimate case
// beside it, `obs: []`, is still an answer that stamps the carried species.
// Added from the Tester's QA scratch (qa-report.md, L2).
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup, waitFor } from '@testing-library/react'
import type { ObservationEntry } from '../types'

const seam = { tauri: false }
vi.mock('./platform', () => ({
  isTauri: () => seam.tauri, isIOS: () => false, isAndroid: () => false,
  isMacOS: () => false, isMobileApp: () => false, isWindows: () => false,
}))
const doc: { value: unknown } = { value: null }
vi.mock('./storage', () => ({
  storage: {
    getApiKey: async () => 'test-key',
    getSetting: async (k: string) => (k === 'exotic-provenance-v1' ? doc.value : null),
    setSetting: async (_k: string, v: unknown) => { doc.value = JSON.parse(JSON.stringify(v)) },
    deleteSetting: async () => { doc.value = null },
  },
}))
// The eBird bodies, by checklist id.
const BODIES: Record<string, unknown> = {
  S1: { locId: 'L1', obsDt: '2026-04-11 07:20' },                       // no observation list
  S2: { locId: 'L1', obsDt: '2026-04-11 07:20', obs: [] },              // empty list: an answer
  S3: { locId: 'L1', obsDt: '2026-04-11 07:20', obs: [{ speciesCode: 'ccc', exoticCategory: 'N' }] },
}
const ebirdUrls: string[] = []
vi.mock('./tauri/http', () => ({
  tauriFetch: async (url: string) => {
    ebirdUrls.push(url)
    const id = url.slice(url.lastIndexOf('/') + 1)
    return { ok: true, status: 200, headers: { get: () => null }, json: async () => BODIES[id] }
  },
}))
vi.mock('./tauri/taxonomyService', () => ({ resolveSpecies: async () => ({}) }))
vi.mock('./tauri/regionInfo', () => ({ getRegionInfo: async () => ({ name: 'Somewhere' }) }))

// What the shipped backend route answers for each body (its parity suite pins it).
async function webFetch(url: string): Promise<unknown> {
  ebirdUrls.push(url)
  const id = url.slice('/checklists/'.length).split('?')[0]
  const body = BODIES[id] as { obs?: unknown[] }
  if (!Array.isArray(body.obs)) {
    return { ok: false, status: 502, headers: { get: () => null },
      json: async () => ({ detail: "Could not fetch checklist: eBird's answer had no observation list" }) }
  }
  return { ok: true, status: 200, headers: { get: () => null }, json: async () => ({
    locName: 'L1', obsDt: '2026-04-11 07:20',
    species: (body.obs as Array<{ speciesCode: string; exoticCategory?: string }>).map(o => ({
      speciesCode: o.speciesCode, commonName: o.speciesCode, count: 'X', breedingCode: '', comments: '',
      exoticCategory: o.exoticCategory ?? '', userDoNotCount: '', media: { photo: 0, audio: 0, video: 0 },
    })),
  }) }
}

function row(commonName: string, submissionId: string): ObservationEntry {
  return { commonName, scientificName: '', count: 1, submissionId, date: '2025-01-01', location: 'L',
    locationId: 'L1', latitude: null, longitude: null, county: null, stateProvince: 'US-CA' } as ObservationEntry
}
const codeFor = (norm: string): string | undefined => ({ spa: 'aaa', spb: 'bbb', spc: 'ccc' } as Record<string, string>)[norm.toLowerCase()]

describe.each(['tauri', 'web'] as const)('composed seam, %s transport', (which) => {
  let ctrl: typeof import('./useExoticProvenance')
  let cache: typeof import('./exoticProvenanceCache')
  let buildCoverIndex: typeof import('./exoticProvenance').buildCoverIndex
  beforeEach(async () => {
    seam.tauri = which === 'tauri'
    doc.value = null
    ebirdUrls.length = 0
    if (which === 'web') vi.stubGlobal('fetch', vi.fn(webFetch))
    vi.resetModules()
    cache = await import('./exoticProvenanceCache')
    ctrl = await import('./useExoticProvenance')
    ;({ buildCoverIndex } = await import('./exoticProvenance'))
    ;(await import('./rateLimit'))._setActivityStartSpacingMsForTests(0)
  })
  afterEach(() => { cleanup(); vi.unstubAllGlobals() })

  function Harness({ index }: { index: import('./exoticProvenance').CoverIndex }) {
    const p = ctrl.useExoticProvenance({ active: true, index, hasEbirdKey: true, online: true })
    return (<div>
      <span data-testid="kind">{p.status.kind}</span>
      <span data-testid="reason">{p.status.kind === 'partial' ? p.status.reason : ''}</span>
      <span data-testid="failed">{p.status.kind === 'partial' ? String(p.status.failed) : ''}</span>
    </div>)
  }

  it('no observation list: no ledger entry, no stamp, a failed checklist; an empty list: ledger entry and stamp', async () => {
    const index = buildCoverIndex([row('spA', 'S1'), row('spB', 'S2'), row('spC', 'S3')], codeFor)
    render(<Harness index={index} />)
    // The terminal status is the observable every assertion below reads.
    await waitFor(() => expect(['partial', 'complete', 'error']).toContain(screen.getByTestId('kind').textContent), { timeout: 4000 })
    const ledger = cache.getSnapshot().checklists
    const stamps = cache.unmatchedSet(Date.now())
    // Non-vacuity: each checklist reached the faked outermost seam exactly once.
    expect(ebirdUrls).toHaveLength(3)
    expect(ledger.has('S1')).toBe(false)
    expect(stamps.has('aaa')).toBe(false)
    expect(screen.getByTestId('kind').textContent).toBe('partial')
    expect(screen.getByTestId('reason').textContent).toBe('failures')
    expect(screen.getByTestId('failed').textContent).toBe('1')
    expect(ledger.has('S2')).toBe(true)
    expect(stamps.has('bbb')).toBe(true)
    expect(ledger.has('S3')).toBe(true)
  })
})
