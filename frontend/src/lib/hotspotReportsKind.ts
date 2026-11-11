// A location's kind in three states (hotspot-reports schema section 5, FR-15 to
// FR-17, FR-27): hotspot, personal, or not yet known.
//
// The kind is READ, never fetched: this module reads the shared region-scoped
// hotspot Set's resolution snapshot through the two pure functions the app's
// hotspot links and the Statistics hotspot share already use. It issues no
// request and starts no build; `hotspotReportsNetwork.test.ts` bounds it by a
// symbol scan, because `hotspotSet.ts` statically imports `transport.ts` and
// so this module cannot sit in the no-transport import-graph rows.
//
// A location is NEVER called personal because eBird has not answered (FR-16):
// a region still pending, no key, offline before a first answer, a refused or
// failed lookup, and a cell with no askable region code all leave it not yet
// known unless its id is already in the Set's answers.

import { isPublicHotspot, isAskableRegionCode, type HotspotResolution } from './hotspotSet'
import type { HotspotShare } from './hotspotShare'
import type { LocationRecord } from './hotspotReports'

/** null is "not yet known". */
export type LocationKind = 'hotspot' | 'personal' | null

/**
 * `computeHotspotShare`'s classification for ONE row, in its order: a cell with
 * no askable region code is not yet known; then a shape-valid id in the Set is a
 * hotspot; then an answered region makes it personal; otherwise not yet known.
 * `hotspotReportsKind.test.ts` sums this over the locations and compares the
 * result with the shipped function (QA-15).
 */
export function kindOf(loc: Pick<LocationRecord, 'locationId' | 'stateProvince'>, res: HotspotResolution): LocationKind {
  const code = loc.stateProvince
  if (!isAskableRegionCode(code)) return null
  if (isPublicHotspot(loc.locationId, res.set)) return 'hotspot'
  return (res.byRegion.get(code) ?? 'pending') === 'answered' ? 'personal' : null
}

export type KindReason = 'none' | 'no-key' | 'checking' | 'offline' | 'unanswered' | 'no-region'

/**
 * FR-27's reason, chosen only while some location is not yet known. A new
 * function beside `hotspotShareView`, never a parameter on it, because the two
 * precedences differ in exactly two places, each tabulated in the suite: (1)
 * with nothing unclassified there is no reason at all, even with no key, where
 * the Statistics block reads no-key first; (2) the known figures are shown with
 * every reason (that half is `kindSplitDrawn`), where the Statistics block hides
 * its bar with no key.
 */
export function kindReason(share: HotspotShare, input: { hasEbirdKey: boolean | null; online: boolean }): KindReason {
  if (share.unclassified === 0) return 'none'
  if (input.hasEbirdKey === false) return 'no-key'
  if (input.hasEbirdKey === null || share.regionsPending > 0) return 'checking'
  if (!input.online) return 'offline'
  if (share.regionsUnanswered > 0) return 'unanswered'
  return 'no-region'
}

/**
 * The user's decision at the design review (decisions.md D-01 to D-03): no
 * hotspot or personal split is drawn while nothing at all is classified, so a
 * zero is never printed for a count nobody has. One predicate, read by the count
 * block and by its tests, so the block and its reason row cannot half-agree.
 */
export function kindSplitDrawn(share: HotspotShare): boolean {
  return share.hotspot + share.personal > 0
}
