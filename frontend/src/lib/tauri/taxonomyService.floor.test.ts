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

import { getTaxonomyCodes, resolveSpecies, collapseToSpeciesList } from './taxonomyService'

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

describe('prototype-member names against the REAL bundled snapshot (taxonomy-hasown-lookups)', () => {
  // The v0.5.81 corpus run against production data: no published eBird name or
  // code is an Object.prototype member, so every axis must be a clean miss. The
  // attack surface is whatever the running engine exposes — derive the list here
  // rather than pinning it (the pinned twelve + a runtime coverage check live in
  // taxonomyService.hostileKeys.test.ts, alongside the per-guard revert cases).
  const PROTO_NAMES = Object.getOwnPropertyNames(Object.prototype)

  it('getTaxonomyCodes resolves nothing for prototype-member names on either name axis', async () => {
    const asCommon = await getTaxonomyCodes(
      PROTO_NAMES.map(n => ({ commonName: n, scientificName: `nosuchus ${n.toLowerCase()}` }))
    )
    const asSci = await getTaxonomyCodes(
      PROTO_NAMES.map((n, i) => ({ commonName: `No Such Bird ${i}`, scientificName: n }))
    )
    for (const maps of [asCommon, asSci]) {
      expect(Object.keys(maps.codes)).toEqual([])
      expect(Object.keys(maps.orders)).toEqual([])
      expect(Object.keys(maps.formCodes)).toEqual([])
    }
  })

  it('resolveSpecies falls through to string identity (no truthy inherited member leaks)', async () => {
    const out = await resolveSpecies(PROTO_NAMES)
    for (const n of PROTO_NAMES) {
      expect(Object.hasOwn(out, n)).toBe(true)
      expect(out[n]).toEqual({ speciesCode: n, commonName: n })
    }
  })

  it('collapseToSpeciesList drops every prototype-member code', async () => {
    expect(await collapseToSpeciesList(PROTO_NAMES)).toEqual([])
  })
})
