import { describe, it, expect, vi, beforeEach } from 'vitest'

// Offline floor (FR-22): with IndexedDB empty (no `indexedDB` global in the node test
// env → readCache() returns null via its try/catch) AND the network unavailable
// (tauriFetch throws), loadTaxonomy must serve the bundled snapshot — the five maps
// populated, real bird names resolvable, with NO network success required.
//
// tauriFetch is mocked to throw so both the cold-online fallback and the
// fire-and-forget supersede fail; the floor must still be returned.
vi.mock('./http', () => ({
  tauriFetch: vi.fn(async () => {
    throw new Error('offline')
  }),
}))

// storage.getApiKey is awaited inside the (failing) online path; mock it so no real
// storage seam is exercised.
vi.mock('../storage', () => ({
  storage: { getApiKey: vi.fn(async () => null) },
}))

import { getTaxonomyCodes, resolveSpecies } from './taxonomyService'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('taxonomy bundled offline floor', () => {
  it('resolves a species code from the bundled snapshot with no network', async () => {
    // Common Ostrich is the first entry in the snapshot — a stable known mapping.
    const { codes, orders } = await getTaxonomyCodes([
      { commonName: 'Common Ostrich', scientificName: 'Struthio camelus' },
    ])
    expect(codes['Common Ostrich']).toBe('ostric2')
    expect(orders['Common Ostrich']).toBe(2)
  })

  it('normalizes a sub-form code to its parent via the bundled reportAs map', async () => {
    // sobkiw2 -> sobkiw1 is a reportAs pair present in the snapshot.
    const out = await resolveSpecies(['sobkiw2'])
    expect(out['sobkiw2'].speciesCode).toBe('sobkiw1')
    // byCode for the parent resolves to a real common name (not the raw code).
    expect(out['sobkiw2'].commonName).not.toBe('sobkiw2')
  })

  it('serves the floor even though the network fetch throws (offline first run)', async () => {
    const { tauriFetch } = await import('./http')
    // Code resolution succeeded above without a successful fetch — the floor carried it.
    const { codes } = await getTaxonomyCodes([
      { commonName: 'Common Ostrich', scientificName: 'Struthio camelus' },
    ])
    expect(codes['Common Ostrich']).toBe('ostric2')
    // The supersede attempt fires-and-forgets; it may or may not have run yet, but it
    // never throws out of loadTaxonomy.
    expect(vi.isMockFunction(tauriFetch)).toBe(true)
  })
})
