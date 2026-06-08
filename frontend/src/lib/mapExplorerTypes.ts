// Shared types for the Map Explorer (extracted from MapExplorer.tsx in a
// behavior-preserving split). MapExplorerProps stays with the page component.

import type { MLExportRow } from './parseMLExport'
import type { ObservationEntry } from '../types'

export type ViewMode = 'sightings' | 'hotspots' | 'targets'
export type DisplayMode = 'pins' | 'heatmap'

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
