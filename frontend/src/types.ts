export interface FileData {
  filename: string
  species: Set<string>
}

export interface ComparisonResult {
  both: string[]
  aOnly: string[]
  bOnly: string[]
  totalA: number
  totalB: number
}
