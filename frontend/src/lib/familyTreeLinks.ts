// The Family Tree tab's outbound family links (family-rollups-and-tree, schema
// section 10; FR-47 to FR-50).
//
// A family may offer two links, each built from its eBird family code: its
// Birds of the World family account and the birder's own Macaulay Library media
// for that family. Cornell's pages refuse scripts, so each shape needed a
// person's look in a browser (D-12). The user looked on 2026-11-21 (D-47): the
// Birds of the World shape opened the family's account for three families and
// is ON, rendered in the tree's readout through OutboundLink, with Help's
// sentence and its published-claims row; the Macaulay shape found nothing for a
// family code and stays OFF, so its builder returns null and nothing that looks
// pressable is drawn in its place.
//
// Orders and genera have no builder (FR-49). No link here is ever loaded by the
// page or fetched by a service: an href is opened through the opener, so no CSP
// or `http:allow-fetch` entry follows from this file.

import type { MediaType } from '../types'
import { mlCatalogLink } from './mlCatalog'

/**
 * The family-code shape the runtime link guard uses (FR-50). eBird's family
 * codes are seven or eight characters, letters then digits (`anatid1`,
 * `passer1`). `familiesGenerator.test.ts` holds this equal to the generator's
 * own `FAMILY_CODE_SHAPE_RE`, the two declarations compared and never
 * restated. Its class cannot express a scheme, host, credential, path
 * separator or percent escape.
 */
export const FAMILY_CODE_RE = /^[a-z]{2,12}[0-9]{1,3}$/

/** Open Question 1: verified by the user in a browser on 2026-11-21 for
 *  `anatid1`, `strigi1` and `paruli1` (D-47), so the family link ships. */
export const BOW_FAMILY_LINK_VERIFIED = true

/** Open Question 2: checked by the user in a browser on 2026-11-21 (D-47). The
 *  catalog does NOT accept a family code as `taxonCode`: it showed 0 results
 *  for `anatid1` and `strigi1`, families with the user's own photos. So no
 *  family-level Macaulay link ships. Do not turn this on by assumption; the
 *  reversal is Cornell documenting a family filter, checked again by a person. */
export const ML_FAMILY_LINK_VERIFIED = false

/**
 * The family's Birds of the World account, on the host `SpeciesLinks.tsx`
 * already links, or null unless the shape is verified AND the code passes
 * `FAMILY_CODE_RE`. The `verified` parameter lets the suite exercise the
 * unverified branch now that the shipped constant is true.
 */
export function bowFamilyHref(code: string, verified: boolean = BOW_FAMILY_LINK_VERIFIED): string | null {
  if (!verified || typeof code !== 'string' || !FAMILY_CODE_RE.test(code)) return null
  return `https://birdsoftheworld.org/bow/species/${encodeURIComponent(code)}/cur/introduction`
}

/**
 * The birder's own media for the family, through the shipped catalog builder
 * on `ML_CATALOG_BASE` with the family code as `taxonCode`, or null unless the
 * catalog is verified to accept a family code AND the code passes the guard.
 */
export function mlFamilyHref(
  code: string, mediaType: MediaType, userId: string | null, verified: boolean = ML_FAMILY_LINK_VERIFIED,
): string | null {
  if (!verified || typeof code !== 'string' || !FAMILY_CODE_RE.test(code)) return null
  return mlCatalogLink(mediaType, code, userId)
}
