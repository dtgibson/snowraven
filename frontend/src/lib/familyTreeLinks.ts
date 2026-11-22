// The Family Tree tab's outbound family links (family-rollups-and-tree, schema
// section 10; FR-47 to FR-50).
//
// A family may offer two links, each built from its eBird family code: its
// Birds of the World family account and the birder's own Macaulay Library media
// for that family. Neither URL shape is established in this repo, and Cornell's
// pages refuse scripts, so each needs a person's look in a browser at two or
// three families. Until that look, each ships OFF: its flag is false and its
// builder returns null, so the family name renders as plain text and nothing
// that looks pressable is drawn in its place (D-12). Turning one on is the
// constant here plus the two published-claims sentences, after that look.
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

/** Open Question 1: unverified, so no Birds of the World family link ships. */
export const BOW_FAMILY_LINK_VERIFIED = false

/** Open Question 2: unverified, so no family-level Macaulay link ships. */
export const ML_FAMILY_LINK_VERIFIED = false

/**
 * The family's Birds of the World account, on the host `SpeciesLinks.tsx`
 * already links, or null unless the shape is verified AND the code passes
 * `FAMILY_CODE_RE`. The `verified` parameter exists so the suite and the
 * opener runtime row can exercise the built branch while the shipped constant
 * is false.
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
