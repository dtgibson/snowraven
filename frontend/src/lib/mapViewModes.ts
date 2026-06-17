import type { ViewMode } from './mapExplorerTypes'

export const MAP_VIEW_MODE_ORDER: { mode: ViewMode; label: string }[] = [
  { mode: 'sightings', label: 'My Sightings' },
  { mode: 'hotspots', label: 'Hotspots' },
  { mode: 'lifers', label: 'Nearby Lifers' },
  { mode: 'targets', label: 'Media Targets' },
]
