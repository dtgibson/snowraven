// Shared types for the Map Explorer (extracted from MapExplorer.tsx in a
// behavior-preserving split). MapExplorerProps stays with the page component.

import type { MLExportRow } from './parseMLExport'
import type { ObservationEntry } from '../types'

export type ViewMode = 'sightings' | 'hotspots' | 'targets' | 'lifers'

// The three views that search around a shared centre at a shared radius.
// My Sightings is excluded structurally rather than by convention: it renders
// the user's own loaded data with no live search and no centre, so there is
// nothing for "Search this area" to re-run there (feature: search-this-area).
export type CenterViewMode = Extract<ViewMode, 'hotspots' | 'targets' | 'lifers'>

export type DisplayMode = 'pins' | 'heatmap'

// Session-only Pins-mode point sizing: 'normal' is byte-identical to the
// original rendering, 'small' shrinks the sighting circles (via the shared
// radius factor in lib/mapPins), and 'off' hides the sr-sight-circle layer
// entirely (and its popup/click target) so a shaded choropleth reads cleanly.
export type PointSize = 'normal' | 'small' | 'off'

export type MapPhase =
  | { tag: 'loading-saved' }
  | { tag: 'setup-required' }
  | { tag: 'ready'; observations: ObservationEntry[]; mlRows: MLExportRow[]; mediaMap: Record<string, string>; hasML: boolean }

export type BreedingFilter = 'all' | 'possible' | 'probable' | 'confirmed'

export type HotspotPin =
  | { kind: 'visited';   locId: string; locName: string; lat: number; lng: number; speciesCount: number; lastVisit: string }
  | { kind: 'unvisited'; locId: string; locName: string; lat: number; lng: number }
  | { kind: 'personal';  locId: string; locName: string; lat: number; lng: number; obsCount: number; lastVisit: string }

export interface TargetPin {
  speciesCode: string
  comName: string
  locId: string
  locName: string
  lat: number
  lng: number
  recentDate: string
  checklistCount: number
  subId: string
}

export type DisplayTargetPin = TargetPin & { missingTypes: ('Photo' | 'Audio' | 'Video')[] }

export type RecencyTier = 'fresh' | 'mid' | 'old'

export interface LocationGroup {
  locId: string
  locName: string
  lat: number
  lng: number
  count: number
  species: Set<string>
  lastDate: string
}

// One pin per distinct location for the Nearby Lifers section: every nearby-lifer
// species reported there, the distinct-species count, and the recency tier of the
// most recent report. Built from the recent-obs records (TargetPin shape, which is
// exactly what GET /map/recent-obs returns) by lib/nearbyLifers.buildNearbyLifers.
export type NearbyLiferLocation = {
  locId: string
  locName: string
  lat: number
  lng: number
  lifers: { comName: string; speciesCode: string; recentDate: string; subId: string }[]
  count: number
  mostRecentDate: string
  tier: RecencyTier
}
