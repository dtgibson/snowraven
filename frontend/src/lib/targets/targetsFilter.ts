// Which classified species are targets under the current toggles, and the
// per-type summary counts (targets-tab, schema.md section 5.3; FR-18 to FR-25).

import { CATEGORY_CODES } from '../breedingCodes'
import type { Classified } from './targetsClassify'
import type { MediaType } from './targetsRecord'
import type { TypeCounts } from './targetsCopy'

export type BreedingThreshold = 'any' | 'confirmed'

export interface TargetsToggles {
  lifer: boolean
  media: boolean
  breeding: boolean
  /** Photo / Audio / Video chips: none selected means any missing type qualifies; several mean AND. */
  chips: ReadonlySet<MediaType>
  threshold: BreedingThreshold
}

/**
 * The state the tab opens in: lifers only, with Media and Breeding off until
 * their pills are pressed (targets-lifers-default, reversing targets-tab FR-19's
 * "all on"). Session-only, never saved, so there is nothing to migrate; the
 * `## Targets` help sentence is held to these values by targetsPublishedClaims.
 */
export const DEFAULT_TOGGLES: TargetsToggles = {
  lifer: true,
  media: false,
  breeding: false,
  chips: new Set(),
  threshold: 'any',
}

/** FR-21: Map Explorer's AND over the selected chips. */
export function isMediaTarget(c: Classified, chips: ReadonlySet<MediaType>): boolean {
  if (c.missingMedia === null || c.missingMedia.length === 0) return false
  if (chips.size === 0) return true
  for (const t of chips) {
    if (!c.missingMedia.includes(t)) return false
  }
  return true
}

/** FR-22: Any code = no code at all; Confirmed = no code in the tier 3-4 set. */
export function isBreedingTarget(c: Classified, threshold: BreedingThreshold): boolean {
  if (c.lifer) return false
  if (threshold === 'any') return c.codes.size === 0
  for (const code of c.codes) {
    if (CATEGORY_CODES.confirmed.has(code)) return false
  }
  return true
}

export interface VisibleTargets {
  rows: Classified[]
  counts: TypeCounts
}

/**
 * FR-18: a row shows iff it carries at least one type whose toggle is on.
 * `mediaAvailable` false forces Media off (no ML export, or an unreadable one,
 * FR-20). Counts are per type AMONG the rows shown (FR-25).
 */
export function visibleTargets(classified: readonly Classified[], toggles: TargetsToggles, mediaAvailable: boolean): VisibleTargets {
  const rows: Classified[] = []
  const counts: TypeCounts = { lifer: 0, media: 0, breeding: 0 }
  for (const c of classified) {
    const lifer = toggles.lifer && c.lifer
    const media = toggles.media && mediaAvailable && isMediaTarget(c, toggles.chips)
    const breeding = toggles.breeding && isBreedingTarget(c, toggles.threshold)
    if (!lifer && !media && !breeding) continue
    rows.push(c)
    if (lifer) counts.lifer += 1
    if (media) counts.media += 1
    if (breeding) counts.breeding += 1
  }
  return { rows, counts }
}

/** The badges a shown row carries under the current toggles (never Lifer with another). */
export function rowBadges(c: Classified, toggles: TargetsToggles, mediaAvailable: boolean): { lifer: boolean; media: boolean; breeding: boolean } {
  return {
    lifer: toggles.lifer && c.lifer,
    media: toggles.media && mediaAvailable && isMediaTarget(c, toggles.chips),
    breeding: toggles.breeding && isBreedingTarget(c, toggles.threshold),
  }
}
