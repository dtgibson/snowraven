// The county picker's choices (targets-tab, schema.md section 5.1; FR-05,
// FR-06, FR-07).
//
// Every US county in the user's backup, joined to an eBird region code through
// the bundled county geometry. The join runs BACKUP -> GEOMETRY here, the
// reverse of every shipped join (which walk the geometry and look each feature
// up in the backup), so the reverse index below is new: one `Map` over the
// geometry keyed exactly as the backup is keyed (`countyKey(stusps, name)`).
//
// US-only BY MECHANISM: `countyKeyFromState` returns null for any row whose
// State/Province is not a US subnational1 code, and a region code comes only
// from a US geometry feature's GEOID. A backup county that joins no feature, or
// whose feature yields no code, is LISTED as unavailable with its reason rather
// than silently omitted (FR-06).
//
// Linear: one pass over the observations (a Map per distinct county key and a
// Set of submission ids per county), one pass over the geometry. The county-key
// fold runs once per DISTINCT (state, county) pair through a memo rather than
// once per observation, since `normalizeCountyName` is the costliest step and a
// 100k-row backup holds a few hundred distinct pairs.
//
// Pure: the geometry is passed in (loaded lazily by the hook through
// `import()`), so this module never touches the 3.85 MB asset itself.

import type { ObservationEntry } from '../../types'
import { countyKey, countyKeyFromState, deriveCountyRegionCode, type CountyFC } from '../countyBoundaries'
import { COUNTY_UNAVAILABLE } from './targetsCopy'

export interface CountyChoice {
  /** The (state, county) join key, `countyKey(stusps, name)`. */
  key: string
  /** "Alameda, CA". The geometry's name when it joined, the backup's otherwise. */
  label: string
  /** "US-CA-001", or null when the county cannot be mapped (FR-06). */
  regionCode: string | null
  /** Distinct checklists (submission ids) in this county in the backup. */
  checklists: number
  /** Null when selectable; otherwise the one-line reason it is not. */
  unavailableReason: string | null
}

interface Tally {
  stusps: string
  rawCounty: string
  subs: Set<string>
}

/**
 * Build the picker's choices, ordered by checklist count descending with a
 * label tiebreak (FR-05). Unavailable counties keep their place in that order.
 */
export function buildCountyChoices(observations: readonly ObservationEntry[], geometry: CountyFC): CountyChoice[] {
  const keyMemo = new Map<string, string | null>()
  const tallies = new Map<string, Tally>()
  for (const o of observations) {
    const state = o.stateProvince ?? ''
    const county = o.county ?? ''
    if (!state || !county) continue
    const memoKey = `${state}\u0000${county}`
    let key = keyMemo.get(memoKey)
    if (key === undefined) {
      key = countyKeyFromState(state, county)
      keyMemo.set(memoKey, key)
    }
    if (key === null) continue
    let t = tallies.get(key)
    if (!t) {
      t = { stusps: state.split('-')[1] ?? '', rawCounty: county, subs: new Set() }
      tallies.set(key, t)
    }
    t.subs.add(o.submissionId)
  }

  // The reverse index, built once: geometry key -> feature properties.
  const byKey = new Map<string, { name: string; stusps: string; geoid: string }>()
  for (const f of geometry.features) {
    const p = f.properties
    byKey.set(countyKey(p.stusps, p.name), { name: p.name, stusps: p.stusps, geoid: p.geoid })
  }

  const choices: CountyChoice[] = []
  for (const [key, t] of tallies) {
    const props = byKey.get(key)
    const regionCode = props ? deriveCountyRegionCode(props.geoid, props.stusps) : null
    const label = props ? `${props.name}, ${props.stusps.toUpperCase()}` : `${t.rawCounty}, ${t.stusps.toUpperCase()}`
    choices.push({
      key,
      label,
      regionCode,
      checklists: t.subs.size,
      unavailableReason: regionCode ? null : COUNTY_UNAVAILABLE,
    })
  }
  choices.sort((a, b) => (b.checklists - a.checklists) || a.label.localeCompare(b.label))
  return choices
}

/**
 * The county to open on (FR-07, FR-08): the remembered one when it is still an
 * AVAILABLE choice, else the available county with the most checklists, else
 * null when nothing is available. Never throws on a stale preference.
 */
export function pickInitialCounty(choices: readonly CountyChoice[], remembered: string | null): CountyChoice | null {
  if (remembered) {
    for (const c of choices) {
      if (c.regionCode === remembered && c.unavailableReason === null) return c
    }
  }
  for (const c of choices) {
    if (c.unavailableReason === null) return c
  }
  return null
}
