// SHARED-FIXTURE PARITY TEST — the TypeScript half of the dual-transport
// taxonomy-collapse lockstep (mobile-prep-sweep tidy #1).
//
// `taxonomyService.collapseToSpeciesList` (desktop/Tauri) and
// `routers/taxonomy.collapse_to_species_list` (web/Pi backend) are twins kept "in
// lockstep by comment" only. This test and its pytest sibling
// (backend/tests/test_taxonomy_collapse_parity.py) both load the ONE shared
// fixture (taxonomyCollapse.fixture.json) and assert the SAME species-level
// output, so if either twin drifts its own test fails.
//
// The fixture covers: plain species, issf-subspecies (reportAs -> species),
// domestic subforms (incl. one whose parent is itself a subform-free species with
// a numeric code), spuh / slash / hybrid (no species parent -> dropped), and
// duplicates (a repeated code + two subforms of one parent -> deduped, first-seen
// taxonomic order preserved).

import { describe, it, expect, vi, beforeEach } from 'vitest'
import fixture from './taxonomyCollapse.fixture.json'

// The service resolves its taxonomy through the bundled-snapshot offline floor:
// loadTaxonomy() -> readCache() (returns null here — no indexedDB in node) ->
// loadFromBundle() which dynamic-imports the taxonomy asset. Mock that asset with
// the fixture's pre-derived 5-map snapshot so collapseToSpeciesList runs against
// KNOWN data instead of the real ~17k-entry bundle.
// NOTE: the specifier is resolved relative to THIS test file (frontend/src/lib/),
// so it is `../assets/...` — one fewer `..` than the service's own
// `../../assets/...` (from frontend/src/lib/tauri/). Both resolve to the same
// absolute asset, so the mock applies to the service's dynamic import.
vi.mock('../assets/ebird-taxonomy.json', () => ({ default: fixture.snapshot }))

// The floor kicks off a fire-and-forget online supersede (refreshTaxonomyOnline).
// Make the underlying fetch reject so the fixture floor is what's served (and no
// real network is touched); storage.getApiKey is stubbed so it doesn't hit the
// real storage seam.
vi.mock('./tauri/http', () => ({
  tauriFetch: () => Promise.reject(new Error('network blocked in parity test')),
  DEFAULT_TIMEOUT_MS: 10_000,
}))
vi.mock('./storage', () => ({
  storage: { getApiKey: () => Promise.resolve(null) },
}))

// Import AFTER the mocks are registered (vi.mock is hoisted, but keep this
// explicit for clarity).
import { collapseToSpeciesList, getTaxonomyCodes } from './tauri/taxonomyService'

interface Case { inputCodes: string[]; expected: { speciesCode: string; commonName: string }[] }
const CASE = fixture.cases as unknown as Case

interface FormCodesCase {
  input: { commonName: string; scientificName: string }[]
  expectedFormCodes: Record<string, string>
  expectedSpeciesOnlyCodes: Record<string, string>
}
const FORM_CASE = fixture.formCodesCases as unknown as FormCodesCase

describe('collapseToSpeciesList — shared-fixture parity (TS twin)', () => {
  beforeEach(() => {
    // Nothing to reset per-test: the service memoizes the floor once, and every
    // assertion here reads the SAME collapse of the SAME fixture. The module
    // registry is fresh per test file, so the floor loads exactly once.
  })

  it('collapses the fixture input codes to the expected species-level list', async () => {
    const out = await collapseToSpeciesList(CASE.inputCodes)
    expect(out).toEqual(CASE.expected)
  })

  it('preserves first-seen (taxonomic) order and dedupes', async () => {
    const out = await collapseToSpeciesList(CASE.inputCodes)
    expect(out.map(o => o.speciesCode)).toEqual(['amerob', 'yerwar', 'rocpig', 'mallar3'])
  })

  it('drops spuh / slash / hybrid (no species parent survives)', async () => {
    const out = await collapseToSpeciesList(CASE.inputCodes)
    const codes = new Set(out.map(o => o.speciesCode))
    // The non-countable input codes and their (non-species) parents never appear.
    expect(codes.has('y00934')).toBe(false)   // spuh
    expect(codes.has('amwspa1')).toBe(false)  // slash
    expect(codes.has('x00001')).toBe(false)   // hybrid
  })

  it('collapses issf + domestic subforms to their species parent with the real name', async () => {
    const out = await collapseToSpeciesList(['yerwar1', 'rocpig1', 'maldom1'])
    expect(out).toEqual([
      { speciesCode: 'yerwar', commonName: 'Yellow-rumped Warbler' },
      { speciesCode: 'rocpig', commonName: 'Rock Pigeon' },
      { speciesCode: 'mallar3', commonName: 'Mallard' },
    ])
  })

  it('returns [] for an all-non-countable input', async () => {
    const out = await collapseToSpeciesList(['y00934', 'amwspa1', 'x00001'])
    expect(out).toEqual([])
  })

  it('returns [] for an empty input', async () => {
    const out = await collapseToSpeciesList([])
    expect(out).toEqual([])
  })
})

describe('getTaxonomyCodes.formCodes — shared-fixture parity (TS twin)', () => {
  it('resolves form names to their own issf/domestic code (species names to species)', async () => {
    const { formCodes } = await getTaxonomyCodes(FORM_CASE.input)
    expect(formCodes).toEqual(FORM_CASE.expectedFormCodes)
  })

  it('keeps species-only `codes` byte-identical (form names miss)', async () => {
    const { codes } = await getTaxonomyCodes(FORM_CASE.input)
    expect(codes).toEqual(FORM_CASE.expectedSpeciesOnlyCodes)
  })
})
