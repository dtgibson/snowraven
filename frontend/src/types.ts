export interface FileData {
  filename: string
  species: Set<string>
  taxOrder: Map<string, number>
}

export interface ComparisonResult {
  both: string[]
  aOnly: string[]
  bOnly: string[]
  totalA: number
  totalB: number
  taxOrder: Map<string, number>
}

export type MediaType = 'Photo' | 'Audio' | 'Video'
export type MediaDimensionState = 'has' | 'no' | null
export interface MediaFilterState {
  photo: MediaDimensionState
  audio: MediaDimensionState
  video: MediaDimensionState
}
export const MEDIA_FILTER_CLEAR: MediaFilterState = { photo: null, audio: null, video: null }
export type BreedingFilterSet = Set<string>
export type SortOrder = 'taxonomic' | 'alpha'
export type NameSortMode = 'az' | 'taxonomic'
export type SortColumn = 'name' | 'photo' | 'audio' | 'video' | 'total'
export type SortDir = 'asc' | 'desc'
export interface SortState {
  column: SortColumn
  dir: SortDir
  nameSortMode: NameSortMode
}

export type BreedingSortColumn = string
export interface BreedingSortState {
  column: BreedingSortColumn
  dir: SortDir
  nameSortMode: NameSortMode
}

export interface StoredFileInfo {
  filename: string
  uploadedAt: string
}
export interface StoredFilesStatus {
  ebird: StoredFileInfo | null
  ml: StoredFileInfo | null
}

export interface DateRangeState {
  from: string   // YYYY-MM-DD or '' (empty = no lower bound)
  to: string     // YYYY-MM-DD or '' (empty = no upper bound)
}
export const DATE_RANGE_CLEAR: DateRangeState = { from: '', to: '' }

export interface ObservationEntry {
  submissionId: string
  commonName: string
  scientificName: string
  date: string           // YYYY-MM-DD
  location: string
  locationId: string
  latitude: number | null
  longitude: number | null
  county: string | null  // eBird "County" column; null when absent
  count: number | null   // null for "X" / presence-only
  breedingCode: string | null
  speciesComments: string
  catalogIds: string[]
  // Optional checklist-level fields (added for Statistics tab)
  time?: string | null           // "HH:MM AM/PM"
  duration?: number | null       // minutes
  distance?: number | null       // km
  protocol?: string | null
  numObservers?: number | null
  allObsReported?: boolean | null // "1"→true, "0"→false, blank→null
  checklistComments?: string
  stateProvince?: string | null  // e.g. "US-MN"; country = stateProvince.split('-')[0]
}

export type ChecklistEntry = {
  submissionId: string
  date: string
  location: string
  locationId: string
  latitude: number | null
  longitude: number | null
  county: string | null
  stateProvince: string | null
  time: string | null
  duration: number | null
  distance: number | null
  protocol: string | null
  numObservers: number | null
  allObsReported: boolean | null
  checklistComments: string
  speciesCount: number
}
