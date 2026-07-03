import type { MediaType } from '../types'
import { ML_CATALOG_BASE } from './statsFormat'

export function extractUserId(filename: string): string | null {
  const m = filename.match(/^ML__.*_([A-Za-z0-9]+)\.csv$/)
  return m ? m[1] : null
}

// Species Detail's media links. Built on the SAME host + taxonCode pattern as the
// Statistics / Multimedia builders (media-catalog-taxon-links consolidation — moved
// off the legacy search.macaulaylibrary.org). `taxonCode` is the species code (default)
// or, when "Show subspecies" is on, the selected form's own issf code — the caller
// resolves it by normalizing the name before the lookup, so a form name never drops the
// code (which used to link to ALL the user's media). No `?taxaName=` fallback ever.
export function mlCatalogLink(mediaType: MediaType, taxonCode: string | undefined, userId: string | null): string {
  const mt = mediaType === 'Photo' ? 'photo' : mediaType === 'Audio' ? 'audio' : 'video'
  let url = `${ML_CATALOG_BASE}?mediaType=${mt}`
  if (taxonCode) url += `&taxonCode=${encodeURIComponent(taxonCode)}`
  if (userId) url += `&userId=${encodeURIComponent(userId)}`
  return url
}

/** Deep link to a single Macaulay Library asset by its catalog id (digits only,
 *  ML prefix already stripped by the parser). */
export function mlAssetUrl(catalogId: string): string {
  return `https://macaulaylibrary.org/asset/${encodeURIComponent(catalogId)}`
}

/**
 * Pick the ML-catalog taxonCode for a selected entry, honoring the "Show subspecies"
 * toggle (media-catalog-taxon-links). The shared rule behind SpeciesDetail's
 * `mediaLinkTaxonCode` and LifeListTable's `linkTaxonCode`:
 *  • showSubspecies ON  → the entry's FORM name carries its OWN issf/domestic code
 *    (formCode) so the link filters to just that form; the species code is the
 *    fallback (offline gap / unmapped form).
 *  • showSubspecies OFF → the SPECIES code.
 * The species code is the UNIVERSAL fallback — the caller should have already resolved
 * it from the NORMALIZED name, so a form name never yields a bare/taxaName link.
 */
export function resolveMediaLinkTaxonCode(
  showSubspecies: boolean,
  formCode: string | undefined,
  speciesCode: string | undefined,
): string | undefined {
  if (showSubspecies) return formCode ?? speciesCode
  return speciesCode
}
