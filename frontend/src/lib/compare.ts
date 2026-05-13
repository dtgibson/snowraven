import type { FileData, ComparisonResult } from '../types'

export function compareSpecies(fileA: FileData, fileB: FileData): ComparisonResult {
  const { species: a, taxOrder: taxA } = fileA
  const { species: b, taxOrder: taxB } = fileB

  const both: string[] = []
  const aOnly: string[] = []

  for (const species of a) {
    if (b.has(species)) {
      both.push(species)
    } else {
      aOnly.push(species)
    }
  }

  const bOnly: string[] = []
  for (const species of b) {
    if (!a.has(species)) {
      bOnly.push(species)
    }
  }

  both.sort((x, y) => x.localeCompare(y))
  aOnly.sort((x, y) => x.localeCompare(y))
  bOnly.sort((x, y) => x.localeCompare(y))

  // Merge: taxB first so taxA wins for any species in both files
  const taxOrder = new Map<string, number>([...taxB, ...taxA])

  return { both, aOnly, bOnly, totalA: a.size, totalB: b.size, taxOrder }
}
