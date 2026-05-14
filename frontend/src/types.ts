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
export type MediaFilter = 'all' | 'no-photo' | 'no-audio' | 'no-video' | 'has-photo' | 'has-audio' | 'has-video'
export type SortOrder = 'taxonomic' | 'alpha'
export type SortColumn = 'name' | 'photo' | 'audio' | 'video'
export type SortDir = 'asc' | 'desc'
export interface SortState {
  column: SortColumn
  dir: SortDir
}

export type BreedingSortColumn = string
export interface BreedingSortState {
  column: BreedingSortColumn
  dir: SortDir
}
export type BreedingFilter = string
