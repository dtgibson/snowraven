// The bird-tap focus (ios-lifer-widgets Stage 8; schema.md 4.5, design-spec.md
// "Tap-through"). A widget row carries `&sp=<speciesCode>&loc=<locId>`; Map
// Explorer runs the view's search and then shows ONLY that species, centered on
// the sighting the widget listed (or the nearest sighting of that species when
// the listed one is not in the fresh results), with a pill to show all again.
//
// Pure derivations over the search's own results, never a mutation of them:
// everything the search found stays loaded, so "Show all" is instant and makes
// no request. The focus is bound to exactly the search the link started
// (`searchId`, the MapExplorer `searchSeq` value that search took), so a later
// search, or results that arrive from a different one, can never inherit it.
//
// The two ids are used only as `===` keys against records the app fetched from
// eBird itself. Nothing shown comes from the link: the name on the pill and in
// the statement line is the record's `comName`, or, when the species is not in
// the results at all, the name the app's own code map already holds for that
// code, or no name.

import { distanceMiles, recencyTier } from '../mapExplorerFormat'
import type { DisplayTargetPin, NearbyLiferLocation } from '../mapExplorerTypes'
import { WIDGET_RADIUS_MI } from './deepLink'

export interface LinkFocus { speciesCode: string; locId: string; searchId: number }

export type FocusView = 'lifers' | 'targets'

/** What a view shows under a focus:
 *  - `none`: no focus for this view's current results (show them all);
 *  - `focused`: only the species, with the sighting to select and center;
 *  - `absent`: the focused search's results hold no sighting of the species
 *    (show them all, with the statement line). */
export type FocusResult<P> =
  | { kind: 'none'; pins: P[] }
  | { kind: 'focused'; pins: P[]; target: P; name: string }
  | { kind: 'absent'; pins: P[] }

interface Center { lat: number; lng: number }

/** The listed location, else the pin nearest the search center (first on a
 *  tie, so the choice is stable), else the first pin. */
function pickTarget<P extends { locId: string; lat: number; lng: number }>(pins: P[], locId: string, center: Center | null): P {
  const listed = pins.find(p => p.locId === locId)
  if (listed) return listed
  if (!center || !Number.isFinite(center.lat) || !Number.isFinite(center.lng)) return pins[0]!
  let best = pins[0]!
  let bestD = distanceMiles(center.lat, center.lng, best.lat, best.lng)
  for (const p of pins) {
    const d = distanceMiles(center.lat, center.lng, p.lat, p.lng)
    if (d < bestD) { best = p; bestD = d }
  }
  return best
}

/** Nearby Lifers: locations holding the species, each narrowed to that one
 *  lifer (count 1, its own date and recency tier). */
export function focusLifers(
  locations: NearbyLiferLocation[], focus: LinkFocus | null, resultSeq: number, center: Center | null,
): FocusResult<NearbyLiferLocation> {
  if (!focus || focus.searchId !== resultSeq) return { kind: 'none', pins: locations }
  const pins: NearbyLiferLocation[] = []
  for (const loc of locations) {
    const lifer = loc.lifers.find(l => l.speciesCode === focus.speciesCode)
    if (!lifer) continue
    pins.push({ ...loc, lifers: [lifer], count: 1, mostRecentDate: lifer.recentDate, tier: recencyTier(lifer.recentDate) })
  }
  if (pins.length === 0) return { kind: 'absent', pins: locations }
  const target = pickTarget(pins, focus.locId, center)
  return { kind: 'focused', pins, target, name: target.lifers[0]!.comName }
}

/** Media Targets: the pins of that species (after the view's own window and
 *  media filters, which the link set). */
export function focusTargets(
  pins: DisplayTargetPin[], focus: LinkFocus | null, resultSeq: number, center: Center | null,
): FocusResult<DisplayTargetPin> {
  if (!focus || focus.searchId !== resultSeq) return { kind: 'none', pins }
  const only = pins.filter(p => p.speciesCode === focus.speciesCode)
  if (only.length === 0) return { kind: 'absent', pins }
  const target = pickTarget(only, focus.locId, center)
  return { kind: 'focused', pins: only, target, name: target.comName }
}

/** The name the app already holds for a code, from its own name-to-code map
 *  (the taxonomy lookup for target species, and every record of every lifer
 *  search). Read through `Object.hasOwn`; a name with no own entry, or more than
 *  one name for the code, gives null rather than a guess. */
export function nameForCode(code: string, codeMap: Record<string, string>): string | null {
  let found: string | null = null
  for (const name of Object.keys(codeMap)) {
    if (!Object.hasOwn(codeMap, name) || codeMap[name] !== code) continue
    if (found !== null && found !== name) return null
    found = name
  }
  return found
}

// ── Copy (design-spec.md "In-app landing copy (bird tap)") ─────────────────────

const ALL: Record<FocusView, string> = { lifers: 'lifers', targets: 'media targets' }

/** The pill's two visible parts: the name truncates before "Show all" does. */
export function focusPillText(name: string): { only: string; action: string } {
  return { only: `Only ${name}`, action: 'Show all' }
}

export function focusPillLabel(name: string, view: FocusView): string {
  return `Showing only ${name}. Show all nearby ${ALL[view]}`
}

/** The statement line when the tapped species is not in the results. With no
 *  name the app can vouch for, the sentence says "The bird you tapped". */
export function focusAbsentStatement(name: string | null, view: FocusView): string {
  return `${name ?? 'The bird you tapped'} was not found within ${WIDGET_RADIUS_MI} miles. Showing all ${ALL[view]}.`
}
