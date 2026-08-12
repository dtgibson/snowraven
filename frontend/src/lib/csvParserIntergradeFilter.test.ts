/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { parseEbirdCSV } from './parseEbird'
import { parseLifeList } from './parseLifeList'
import { parseMLExport } from './parseMLExport'
import {
  deriveBreedingData,
  deriveBreedingRows,
  parseBreedingCodes,
  type BreedingObsInput,
} from './parseBreedingCodes'
import { isNonCountableObservedName, truncateAtFirstParen } from './speciesUtils'

const snapshot = JSON.parse(
  readFileSync(new URL('../assets/ebird-taxonomy.json', import.meta.url), 'utf8'),
) as { byCode: Record<string, string> }
const commonNames = [...new Set(Object.values(snapshot.byCode))]

// The four parsers used this predicate before csv-parser-intergrade-filter. Keeping the
// competing implementation named here makes the 36/0 guard falsifiable: replacing the
// shared helper at any parser call site with this exact rule must turn the parser-output
// assertions below red, not merely change an implementation-detail assertion.
const rawNamePredicate = (name: string): boolean =>
  name.endsWith(' sp.') || name.includes('/') || name.includes(' x ')

const rescuedIntergrades = commonNames.filter(
  name => rawNamePredicate(name) && !isNonCountableObservedName(name),
)
const newlyExcluded = commonNames.filter(
  name => !rawNamePredicate(name) && isNonCountableObservedName(name),
)
const rescuedBaseNames = new Set(rescuedIntergrades.map(truncateAtFirstParen))

function breedingFixture(names: string[]): { csv: string; observations: BreedingObsInput[] } {
  const observations = names.map((commonName, index) => ({
    commonName,
    scientificName: `Scientific ${index}`,
    date: `2026-05-${String((index % 28) + 1).padStart(2, '0')}`,
    county: `County ${index % 3}`,
    breedingCode: 'S',
  }))
  return {
    csv: [
      'Submission ID,Common Name,Scientific Name,Date,County,Breeding Code',
      ...observations.map((o, index) =>
        `S${index + 1},${o.commonName},${o.scientificName},${o.date},${o.county},${o.breedingCode}`,
      ),
    ].join('\n'),
    observations,
  }
}

describe('CSV parser countable-intergrade filter', () => {
  it('preserves the canonical raw-name asymmetry at every parser entry point', () => {
    const intergrade = "Yellow-rumped Warbler (Myrtle x Audubon's)"
    const excluded = [
      'Mallard x American Black Duck (hybrid)',
      'Gull sp.',
      // The slash check deliberately uses the RAW name, even inside a parenthetical.
      'Canada Goose (moffitti/maxima)',
    ]
    const names = [intergrade, ...excluded]

    const ebird = [
      'Submission ID,Common Name',
      ...names.map((name, index) => `S${index + 1},${name}`),
    ].join('\n')
    expect(parseEbirdCSV('guard.csv', ebird).species).toEqual(new Set(['Yellow-rumped Warbler']))

    const lifeList = [
      'Common Name,Scientific Name,Taxonomic Order,ML Catalog Numbers',
      ...names.map((name, index) => `${name},Scientific ${index},${index},ML${index + 1}`),
    ].join('\n')
    expect(parseLifeList(lifeList).map(entry => entry.commonName)).toEqual(['Yellow-rumped Warbler'])

    const ml = [
      'Catalog Number,Common Name,Scientific Name,Format',
      ...names.map((name, index) => `${index + 1},${name},Scientific ${index},Photo`),
    ].join('\n')
    const mlResult = parseMLExport(ml)
    expect(mlResult.entries.map(entry => entry.commonName)).toEqual(['Yellow-rumped Warbler'])
    expect(mlResult.rows.map(row => row.commonName)).toEqual(['Yellow-rumped Warbler'])
    expect(mlResult.mediaMap).toEqual({ '1': 'Photo' })

    const breeding = breedingFixture(names)
    const direct = parseBreedingCodes(breeding.csv)
    const derivedRows = deriveBreedingRows(breeding.observations)
    expect(direct.entries.map(entry => entry.commonName)).toEqual(['Yellow-rumped Warbler'])
    expect(direct.rows.map(row => row.commonName)).toEqual(['Yellow-rumped Warbler'])
    expect(derivedRows).toEqual(direct.rows)
    expect(deriveBreedingData(breeding.observations, breeding.csv)).toEqual(direct)
  })

  it('pins 36 rescued rows, 0 newly excluded names, and 26 parser entries', () => {
    expect(commonNames).toHaveLength(17_891)
    expect(rescuedIntergrades).toHaveLength(36)
    expect(newlyExcluded).toEqual([])
    expect(rescuedBaseNames.size).toBe(26)

    const ebird = [
      'Submission ID,Common Name',
      ...rescuedIntergrades.map((name, index) => `S${index + 1},${name}`),
    ].join('\n')
    expect(parseEbirdCSV('snapshot.csv', ebird).species).toEqual(rescuedBaseNames)

    const lifeList = [
      'Common Name,Scientific Name,Taxonomic Order,ML Catalog Numbers',
      ...rescuedIntergrades.map((name, index) =>
        `${name},Scientific ${index},${index},ML${index + 1}`,
      ),
    ].join('\n')
    const lifeEntries = parseLifeList(lifeList)
    expect(new Set(lifeEntries.map(entry => entry.commonName))).toEqual(rescuedBaseNames)
    expect(lifeEntries.flatMap(entry => entry.catalogIds)).toHaveLength(36)

    const ml = [
      'Catalog Number,Common Name,Scientific Name,Format',
      ...rescuedIntergrades.map((name, index) =>
        `${index + 1},${name},Scientific ${index},Photo`,
      ),
    ].join('\n')
    const mlResult = parseMLExport(ml)
    expect(new Set(mlResult.entries.map(entry => entry.commonName))).toEqual(rescuedBaseNames)
    expect(mlResult.entries).toHaveLength(26)
    expect(mlResult.rows).toHaveLength(36)
    expect(Object.keys(mlResult.mediaMap)).toHaveLength(36)

    const breeding = breedingFixture(rescuedIntergrades)
    const direct = parseBreedingCodes(breeding.csv)
    const derived = deriveBreedingData(breeding.observations, breeding.csv)
    expect(new Set(direct.entries.map(entry => entry.commonName))).toEqual(rescuedBaseNames)
    expect(direct.entries).toHaveLength(26)
    expect(direct.rows).toHaveLength(36)
    expect(derived).toEqual(direct)
  })
})
