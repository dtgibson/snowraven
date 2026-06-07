import { describe, it, expect } from 'vitest'
import { parseBreedingCodes, deriveBreedingData } from './parseBreedingCodes'
import { parseEbirdObservations } from './parseEbirdObservations'

// Locks the perf refactor: the Breeding Codes tab now derives its data from the
// shared parsed observations instead of re-parsing the CSV. deriveBreedingData(
// parseEbirdObservations(csv), csv) must equal parseBreedingCodes(csv) exactly.

// A fixture exercising every filter branch: a plain species, a subspecies
// parenthetical (normalized to the parent), repeated obs of one species, a spuh
// (" sp."), a slash, a hybrid (" x "), a non-recognized code, an empty code, and a
// multi-word code ("CN carrying ...") where only the first token counts.
const CSV = [
  'Submission ID,Common Name,Scientific Name,Taxonomic Order,Count,State/Province,County,Date,Breeding Code',
  'S1,American Robin,Turdus migratorius,100,2,US-CA,Alameda,2025-05-01,S Singing Bird',
  'S2,American Robin,Turdus migratorius,100,1,US-CA,Alameda,2025-05-08,S7 Singing Bird Present 7+ days',
  'S3,Yellow-rumped Warbler (Myrtle),Setophaga coronata coronata,200,3,US-CA,Marin,2025-05-02,CN Carrying Nesting Material',
  'S4,Canada Goose,Branta canadensis,60,4,US-CA,Alameda,2025-05-03,',
  'S5,gull sp.,Larus sp.,300,5,US-CA,Marin,2025-05-04,H In Appropriate Habitat',
  'S6,Mallard x American Black Duck (hybrid),Anas,70,1,US-CA,Marin,2025-05-05,P Pair in Suitable Habitat',
  'S7,Western/Clark\'s Grebe,Aechmophorus,80,2,US-CA,Marin,2025-05-06,S Singing Bird',
  'S8,House Finch,Haemorhous mexicanus,400,6,US-CA,Alameda,2025-05-07,ZZ Not A Real Code',
].join('\n')

describe('deriveBreedingData equals parseBreedingCodes', () => {
  it('produces identical BreedingData from parsed observations', () => {
    const direct = parseBreedingCodes(CSV)
    const derived = deriveBreedingData(parseEbirdObservations(CSV), CSV)
    expect(derived).toEqual(direct)
  })

  it('reports no breeding column when absent', () => {
    const noCol = [
      'Submission ID,Common Name,Scientific Name,Taxonomic Order,Count,State/Province,County,Date',
      'S1,American Robin,Turdus migratorius,100,2,US-CA,Alameda,2025-05-01',
    ].join('\n')
    const derived = deriveBreedingData(parseEbirdObservations(noCol), noCol)
    expect(derived.hasBreedingCodeColumn).toBe(false)
    expect(derived).toEqual(parseBreedingCodes(noCol))
  })

  it('keeps the column flag true but entries empty when the column has no codes', () => {
    const emptyCodes = [
      'Submission ID,Common Name,Scientific Name,Taxonomic Order,Count,State/Province,County,Date,Breeding Code',
      'S1,American Robin,Turdus migratorius,100,2,US-CA,Alameda,2025-05-01,',
    ].join('\n')
    const derived = deriveBreedingData(parseEbirdObservations(emptyCodes), emptyCodes)
    expect(derived.hasBreedingCodeColumn).toBe(true)
    expect(derived.entries).toEqual([])
    expect(derived).toEqual(parseBreedingCodes(emptyCodes))
  })
})
