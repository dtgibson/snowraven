import type { ComparisonResult } from '../types'

export function compareSpecies(a: Set<string>, b: Set<string>): ComparisonResult {
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

  return { both, aOnly, bOnly, totalA: a.size, totalB: b.size }
}
