// The "Places in this list" section of the measuring-point chooser (targets-tab
// FR-51a, design-spec 2a): the distinct places named by the county's loaded
// live data, alphabetical, each measurable because it carries coordinates.
//
// FROM DATA ALREADY FETCHED, SO NO REQUEST AND IT WORKS OFFLINE. The source is
// the live cells the list already renders (one per pool species, holding its
// last report's place and coordinates), taken over the WHOLE pool rather than
// only the rows a toggle or filter leaves on screen: the mockup and PRD FR-51a
// build it that way, and a narrowing filter must not remove the very places a
// user would re-anchor to. During a partial sweep it holds the places found so
// far and grows as days land.
//
// Pure. Linear in the cells: one Map keyed by place name (a real Map, so an
// eBird location named `__proto__` is an ordinary key), then one sort.

import type { Anchor, LiveCell } from './targetsLive'
import { distanceMiles } from '../mapExplorerFormat'

export interface ListPlace {
  name: string
  lat: number
  lng: number
}

/** Distinct last-report places with coordinates, alphabetical. A name that
 *  appears with more than one position keeps the first one met, which is the
 *  pool's taxonomic order, so the choice is deterministic. */
export function listPlaces(cells: ReadonlyMap<string, LiveCell> | null): ListPlace[] {
  if (!cells) return []
  const byName = new Map<string, ListPlace>()
  for (const cell of cells.values()) {
    if (cell.place === null || cell.lat === null || cell.lng === null) continue
    if (!byName.has(cell.place)) byName.set(cell.place, { name: cell.place, lat: cell.lat, lng: cell.lng })
  }
  return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name))
}

/** Miles from the anchor to a place, or null with no anchor. */
export function placeDistance(anchor: Anchor | null, place: ListPlace): number | null {
  return anchor ? distanceMiles(anchor.lat, anchor.lng, place.lat, place.lng) : null
}
