import { describe, it, expect } from 'vitest'
import { formatSpanLength, mlCatalogUrl, ML_CATALOG_BASE } from './statsFormat'

describe('formatSpanLength', () => {
  it('uses days under two months', () => {
    expect(formatSpanLength(1)).toBe('1 day')
    expect(formatSpanLength(41)).toBe('41 days')
    expect(formatSpanLength(60)).toBe('60 days')
  })
  it('uses rounded months from two months to two years', () => {
    expect(formatSpanLength(61)).toBe('2 months')
    expect(formatSpanLength(578)).toBe('19 months')
    expect(formatSpanLength(700)).toBe('23 months')
  })
  it('uses half-year precision from two years up', () => {
    expect(formatSpanLength(722)).toBe('2 years') // Jun 12, 2024 – Jun 3, 2026
    expect(formatSpanLength(877)).toBe('2.5 years')
    expect(formatSpanLength(1096)).toBe('3 years')
  })
  it('returns "" for negative or non-finite input', () => {
    expect(formatSpanLength(-1)).toBe('')
    expect(formatSpanLength(NaN)).toBe('')
  })
})

// media-catalog-taxon-links: Statistics builds on the current host with a taxonCode
// filter and NEVER falls back to ?taxaName= (a form name there is a malformed filter).
describe('mlCatalogUrl (Statistics)', () => {
  it('is built on the media.ebird.org catalog host', () => {
    expect(ML_CATALOG_BASE).toBe('https://media.ebird.org/catalog')
  })

  it('emits taxonCode + userId, never taxaName (form name → species code passed by caller)', () => {
    // The caller passes the SPECIES code (Statistics has no subspecies toggle), resolved
    // by normalizing the name before the lookup. The name arg is ignored for the filter.
    const url = mlCatalogUrl('Scaly-breasted Munia (Scaled)', 'Photo', 'USER1', 'nutman')
    expect(url).toBe('https://media.ebird.org/catalog?mediaType=photo&taxonCode=nutman&userId=USER1')
    expect(url).not.toContain('taxaName')
  })

  it('lowercases the media type and encodes userId', () => {
    expect(mlCatalogUrl('x', 'Audio', 'a b', 'amerob')).toBe(
      'https://media.ebird.org/catalog?mediaType=audio&taxonCode=amerob&userId=a%20b'
    )
  })

  it('omits the taxon filter (never taxaName / bare-name) when no code resolves', () => {
    const url = mlCatalogUrl('Mystery Bird', 'Video', 'USER1', null)
    expect(url).toBe('https://media.ebird.org/catalog?mediaType=video&userId=USER1')
    expect(url).not.toContain('taxaName')
    expect(url).not.toContain('taxonCode')
  })

  it('omits userId when null', () => {
    expect(mlCatalogUrl('x', 'Photo', null, 'amerob')).toBe(
      'https://media.ebird.org/catalog?mediaType=photo&taxonCode=amerob'
    )
  })
})
