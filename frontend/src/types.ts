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
export type SortColumn = 'name' | 'photo' | 'audio' | 'video'
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

export interface ObservationEntry {
  submissionId: string
  commonName: string
  scientificName: string
  date: string           // YYYY-MM-DD
  location: string
  locationId: string
  latitude: number | null
  longitude: number | null
  count: number | null   // null for "X" / presence-only
  breedingCode: string | null
  speciesComments: string
  catalogIds: string[]
}
