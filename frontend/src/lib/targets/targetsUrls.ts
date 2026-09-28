// The one URL the Targets tab builds (targets-tab FR-38, NFR-06, QA-40).
//
// The region code comes from the geometry-derived county, never from a file
// name, and is gated by REGION_CODE_RE and URI-encoded before it reaches the
// query string: a code that fails the shape yields no link at all rather than
// a styled link to nowhere (security.md, the eBird-id rule).

import { REGION_CODE_RE } from '../regionCode'

/** The county's bar chart page on ebird.org, or null for a code that fails the shape. */
export function barChartPageUrl(regionCode: string): string | null {
  return REGION_CODE_RE.test(regionCode) ? `https://ebird.org/barchart?r=${encodeURIComponent(regionCode)}` : null
}
