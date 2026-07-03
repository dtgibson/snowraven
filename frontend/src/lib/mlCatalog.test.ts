import { describe, it, expect } from 'vitest'
import { mlCatalogLink, mlAssetUrl, extractUserId, resolveMediaLinkTaxonCode } from './mlCatalog'

// media-catalog-taxon-links: Species Detail's builder moved off the legacy
// search.macaulaylibrary.org host onto media.ebird.org/catalog, one taxonCode-preferring
// pattern shared with Statistics / Multimedia. It NEVER emits ?taxaName=.
describe('mlCatalogLink (Species Detail)', () => {
  it('is built on media.ebird.org/catalog (off the legacy search host)', () => {
    const url = mlCatalogLink('Photo', 'nutman', 'USER1')
    expect(url.startsWith('https://media.ebird.org/catalog')).toBe(true)
    expect(url).not.toContain('search.macaulaylibrary.org')
  })

  it('OFF-case: species code filters to the species media', () => {
    // Scaly-breasted Munia (Scaled) → species code nutman (passed by the caller).
    expect(mlCatalogLink('Photo', 'nutman', 'USER1')).toBe(
      'https://media.ebird.org/catalog?mediaType=photo&taxonCode=nutman&userId=USER1'
    )
  })

  it('ON-case: form issf code filters to just that form', () => {
    expect(mlCatalogLink('Audio', 'scbmun2', 'USER1')).toBe(
      'https://media.ebird.org/catalog?mediaType=audio&taxonCode=scbmun2&userId=USER1'
    )
  })

  it('maps the media type to the ML mediaType slug', () => {
    expect(mlCatalogLink('Video', 'amerob', null)).toBe(
      'https://media.ebird.org/catalog?mediaType=video&taxonCode=amerob'
    )
  })

  it('omits taxonCode when undefined (fallback), never taxaName', () => {
    const url = mlCatalogLink('Photo', undefined, 'USER1')
    expect(url).toBe('https://media.ebird.org/catalog?mediaType=photo&userId=USER1')
    expect(url).not.toContain('taxaName')
    expect(url).not.toContain('taxonCode')
  })

  it('encodes the userId and taxonCode', () => {
    const url = mlCatalogLink('Photo', 'a b', 'u/1')
    expect(url).toContain('taxonCode=a%20b')
    expect(url).toContain('userId=u%2F1')
  })
})

// The shared toggle decision behind SpeciesDetail's mediaLinkTaxonCode and
// LifeListTable's linkTaxonCode.
describe('resolveMediaLinkTaxonCode (Show subspecies toggle)', () => {
  it('OFF (merged): always the species code, ignoring the form code', () => {
    expect(resolveMediaLinkTaxonCode(false, 'scbmun2', 'nutman')).toBe('nutman')
  })

  it('ON: the form issf code (filters to that form)', () => {
    expect(resolveMediaLinkTaxonCode(true, 'scbmun2', 'nutman')).toBe('scbmun2')
  })

  it('ON but form code unresolved: falls back to the species code', () => {
    expect(resolveMediaLinkTaxonCode(true, undefined, 'nutman')).toBe('nutman')
  })

  it('neither resolves: undefined (caller emits no taxon filter, never taxaName)', () => {
    expect(resolveMediaLinkTaxonCode(true, undefined, undefined)).toBeUndefined()
    expect(resolveMediaLinkTaxonCode(false, 'scbmun2', undefined)).toBeUndefined()
  })
})

describe('mlAssetUrl / extractUserId (unchanged)', () => {
  it('builds a single-asset link', () => {
    expect(mlAssetUrl('12345')).toBe('https://macaulaylibrary.org/asset/12345')
  })
  it('extracts the userId from an ML export filename', () => {
    expect(extractUserId('ML__whatever_USER123.csv')).toBe('USER123')
    expect(extractUserId('not-an-ml-file.csv')).toBe(null)
  })
})
