// Each tab's mount-time derivation over the whole observations array, called
// as the components call it with their default controls (decisions.md entry 1,
// "stats time per tab"). Network-fed inputs (taxonomy codes, the escapee
// snapshot) are empty, which is what a first launch offline sees; the
// Multimedia tab's main cost is private to LifeList.tsx and is not timed here.
import type { ObservationEntry } from '../../../../frontend/src/types'
import { computeStatsBundle } from '../../../../frontend/src/lib/statsBundle'
import { filterObservations, computeChecklists } from '../../../../frontend/src/lib/birdingStats'
import { computeFrivolousLists } from '../../../../frontend/src/lib/frivolousLists'
import { dataYears, defaultYear, buildDayCells, nonZeroMetricCounts } from '../../../../frontend/src/lib/calendar'
import { buildCountyAggregates } from '../../../../frontend/src/lib/countyShading'
import { buildCountyCompletenessLocal } from '../../../../frontend/src/lib/countyCompleteness'
import { buildHotspotPersonalStats } from '../../../../frontend/src/lib/hotspotColorModes'
import { deriveBreedingData } from '../../../../frontend/src/lib/parseBreedingCodes'
import { computeNamedBirds } from '../../../../frontend/src/lib/namedBirds'
import { buildChecklistRows, buildChecklistComments, buildSpeciesComments, sortChecklistRows } from '../../../../frontend/src/lib/checklistsTab'
import { buildSubspeciesIndex } from '../../../../frontend/src/lib/subspeciesExplorer'
import { hasAnyWeatherBlock, weatherStatsFor, speciesChecklistCountsFor, _resetWeatherStatsMemoForTests } from '../../../../frontend/src/lib/weatherStatsShared'
import { distinctNamePairs, buildTargetsRecord } from '../../../../frontend/src/lib/targets/targetsRecord'
import { buildSpeciesIndex } from '../../../../frontend/src/lib/speciesIndex'

const now = (): number => (typeof performance !== 'undefined' ? performance.now() : Date.now())

export const TAB_DERIVATIONS: Record<string, (obs: ObservationEntry[], headerLine: string) => unknown> = {
  'Statistics (worker bundle)': obs => computeStatsBundle(obs, { includeSpuh: false, granularity: 'total', excludedNames: [] }),
  'Statistics (main thread)': obs => [computeChecklists(obs), computeFrivolousLists(obs)],
  Calendar: obs => {
    const y = defaultYear(obs)
    dataYears(obs)
    const cells = buildDayCells(obs, y === null ? { kind: 'combined' } : { kind: 'year', year: y })
    return nonZeroMetricCounts(cells, 'species', false)
  },
  'Map Explorer': obs => {
    const f = filterObservations(obs, false)
    const c = computeChecklists(f)
    return [buildCountyAggregates(obs, c), buildCountyCompletenessLocal(obs), buildHotspotPersonalStats(obs)]
  },
  'Breeding Codes': (obs, headerLine) => deriveBreedingData(obs, headerLine),
  'Named Birds': obs => computeNamedBirds(obs),
  Checklists: obs => {
    const rows = buildChecklistRows(obs, null)
    return [buildChecklistComments(rows, false), buildSpeciesComments(obs, false), sortChecklistRows(rows, 'newest')]
  },
  'Species Detail': obs => {
    _resetWeatherStatsMemoForTests()
    return [buildSubspeciesIndex(obs), hasAnyWeatherBlock(obs), weatherStatsFor(obs), speciesChecklistCountsFor(obs)]
  },
  Targets: obs => [distinctNamePairs(obs), buildTargetsRecord(obs, null, null)],
  'Search index': obs => buildSpeciesIndex(obs),
}

/** Milliseconds per tab, one cold call each, in table order. */
export function timeTabs(obs: ObservationEntry[], headerLine: string): Record<string, number> {
  const out: Record<string, number> = {}
  for (const [name, fn] of Object.entries(TAB_DERIVATIONS)) {
    const t = now()
    fn(obs, headerLine)
    out[name] = Math.round(now() - t)
  }
  return out
}

/** Every tab's output, serialized, for the identical-output check. Maps and
 *  Sets are spread to arrays so the comparison sees their contents. */
export function tabOutputs(obs: ObservationEntry[], headerLine: string): Record<string, string> {
  const ser = (v: unknown): string => JSON.stringify(v, (_k, x) =>
    x instanceof Map ? { map: [...x.entries()] } : x instanceof Set ? { set: [...x] } : x)
  const out: Record<string, string> = {}
  for (const [name, fn] of Object.entries(TAB_DERIVATIONS)) out[name] = ser(fn(obs, headerLine))
  return out
}
