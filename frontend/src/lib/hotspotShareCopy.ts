// Every user-facing string the Statistics tab's "Checklists at hotspots" block
// renders (hotspot-share-stat, schema.md section 6, design-spec.md Content Notes).
// Generated from the view state, so the plural-agreement and em-dash sweeps in
// `hotspotShareCopy.test.ts` run over the whole reachable corpus; the component
// builds no count-bearing string of its own. Counts go through `fmt`, every
// count-bearing fragment agrees in number, and no string names an age or a
// staleness: the settled caption is identical whether the answer came from the
// network this session or from the stored document.

import { fmt } from './statsFormat'
import type { HotspotShareView } from './hotspotShare'

export const HOTSPOT_SHARE_SUBLABEL = 'Checklists at hotspots'
export const HOTSPOT_SHARE_NO_KEY = 'Checklists at hotspots cannot be counted without an eBird API key.'
export const HOTSPOT_SHARE_ADD_KEY = 'Add a key in Settings'
/** The two figure labels above the bar, each after its percentage. */
export const HOTSPOT_SHARE_AT_HOTSPOTS = 'at hotspots'
export const HOTSPOT_SHARE_AT_PERSONAL = 'at personal locations'

const plural = (n: number, one: string, many: string): string => (n === 1 ? one : many)
const checklists = (n: number): string => `${fmt(n)} ${plural(n, 'checklist', 'checklists')}`

/** The counts-so-far line beneath a status sentence, or null when nothing is
 *  classified yet. */
function soFar(h: number, p: number): string | null {
  return h + p > 0 ? `So far ${fmt(h)} at hotspots and ${fmt(p)} at personal locations.` : null
}

/**
 * The strings for one view, in reading order; [] for 'hidden' and for 'no-key'
 * (whose sentence and control are the two constants above).
 *
 * - 'settled': the two figures (`"37% at hotspots"`, `"63% at personal
 *   locations"`; the component splits each at its first space for the
 *   percentage span) and the caption, which carries both counts, the
 *   denominator and, with the figures, both percentages (FR-19).
 * - the four status views: the state sentence, then the counts-so-far line when
 *   any checklist is classified.
 */
export function hotspotShareSentences(view: HotspotShareView): string[] {
  const withSoFar = (first: string, h: number, p: number): string[] => {
    const more = soFar(h, p)
    return more ? [first, more] : [first]
  }
  switch (view.kind) {
    case 'settled':
      return [
        `${view.pct.hotspot} ${HOTSPOT_SHARE_AT_HOTSPOTS}`,
        `${view.pct.personal} ${HOTSPOT_SHARE_AT_PERSONAL}`,
        `${fmt(view.h)} of ${checklists(view.m)} at hotspots, ${fmt(view.p)} at personal locations.`,
      ]
    case 'pending':
      return withSoFar(
        `Checking which locations are public hotspots. ${fmt(view.u)} of ${checklists(view.m)} not yet classified.`,
        view.h, view.p,
      )
    case 'offline':
      return withSoFar(`Offline, so ${fmt(view.u)} of ${checklists(view.m)} could not be classified yet.`, view.h, view.p)
    case 'unanswered':
      return withSoFar(
        `eBird did not answer for ${fmt(view.k)} of your ${fmt(view.r)} ${plural(view.r, 'region', 'regions')}, ` +
        `so ${fmt(view.u)} of ${checklists(view.m)} could not be classified.`,
        view.h, view.p,
      )
    case 'no-region':
      return withSoFar(
        `${fmt(view.u)} of ${checklists(view.m)} ${plural(view.u, 'carries', 'carry')} no region code and could not be classified.`,
        view.h, view.p,
      )
    default:
      return []
  }
}
