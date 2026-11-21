// The house shape of an eBird location id, an L and 1 to 15 ASCII digits.
// A location id read from eBird's own answer goes through `ebirdLocationId`
// before it enters ANY follow-up URL: the region-info lookup the checklist and
// weather services share, and the weather service's product/lists and data/obs
// fallbacks. Unchecked, `../../product/x?y=1` sent a request to another
// api.ebird.org path with the user's key (security L2 of ebird-store-hygiene,
// idea 3eb8682b). Its own module, not regionInfo.ts, so a suite that mocks the
// lookup wholesale still runs the real gate. Twin of `LOCATION_ID_RE` in
// backend/services/ebird.py, read there with `fullmatch`.

export const EBIRD_LOCATION_ID_RE = /^L[0-9]{1,15}$/

/** The id when it has the house shape, else '' (anything not text included). */
export function ebirdLocationId(v: unknown): string {
  return typeof v === 'string' && EBIRD_LOCATION_ID_RE.test(v) ? v : ''
}
