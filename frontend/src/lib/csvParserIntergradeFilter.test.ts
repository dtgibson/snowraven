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
import { isNonCountableForm, truncateAtFirstParen } from './speciesUtils'

const snapshot = JSON.parse(
  readFileSync(new URL('../assets/ebird-taxonomy.json', import.meta.url), 'utf8'),
) as { byCode: Record<string, string> }
const commonNames = [...new Set(Object.values(snapshot.byCode))]

// The four parsers used this predicate before csv-parser-intergrade-filter. Keeping the
// competing implementation named here makes the guard falsifiable: replacing the
// shared helper at any parser call site with this exact rule must turn the parser-output
// assertions below red, not merely change an implementation-detail assertion.
//
// The figures moved with report-as-countability and the reason is worth stating, since a
// reader arriving at 124 will look for the 36 this file was built around. 124 = the 36
// parenthetical intergrades v0.5.86 rescued, PLUS the 88 subspecies-group slashes eBird
// counts that no string rule could admit ("Canada Goose (moffitti/maxima)"). The second
// group is new; the first is unchanged, and `rescuesTheV0586Intergrades` below pins it
// separately so the two cannot be conflated by a future edit.
//
// `newlyExcluded` moved from 0 to 81, and that is a real behaviour change rather than
// drift: those are names eBird does not count and the old string rule did.
const rawNamePredicate = (name: string): boolean =>
  name.endsWith(' sp.') || name.includes('/') || name.includes(' x ')

const rescuedIntergrades = commonNames.filter(
  name => rawNamePredicate(name) && !isNonCountableForm(name),
)
const newlyExcluded = commonNames.filter(
  name => !rawNamePredicate(name) && isNonCountableForm(name),
)
// The v0.5.86 subset on its own: a parenthetical " x " whose BASE name is clean. Pinned
// separately so a change that dropped the intergrades while adding the slashes could not
// keep the 124 total green.
const v0586Intergrades = rescuedIntergrades.filter(
  name => !name.endsWith(' sp.') && !name.includes('/'),
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
  it("applies eBird's countability rule at every parser entry point", () => {
    // A fixture that discriminates in BOTH directions, so reverting the parsers to the
    // old string rule turns it red twice over rather than merely changing a number:
    //  - the intergrade and the subspecies-group slash are KEPT, and the old rule
    //    dropped the slash (it tested the raw name and saw a "/");
    //  - Brewster's Warbler is DROPPED, and the old rule kept it (a named hybrid whose
    //    name carries no " x " at all, so no shape rule can see it).
    const kept = [
      "Yellow-rumped Warbler (Myrtle x Audubon's)",   // v0.5.86 intergrade, still countable
      'Canada Goose (moffitti/maxima)',               // direction A: eBird counts it
    ]
    const excluded = [
      'Mallard x American Black Duck (hybrid)',       // a true interspecies hybrid
      'Gull sp.',                                     // a spuh
      "Brewster's Warbler (hybrid)",                  // direction B: eBird does not count it
    ]
    const names = [...kept, ...excluded]
    const keptBases = ['Yellow-rumped Warbler', 'Canada Goose']

    const ebird = [
      'Submission ID,Common Name',
      ...names.map((name, index) => `S${index + 1},${name}`),
    ].join('\n')
    expect(parseEbirdCSV('guard.csv', ebird).species).toEqual(new Set(keptBases))

    const lifeList = [
      'Common Name,Scientific Name,Taxonomic Order,ML Catalog Numbers',
      ...names.map((name, index) => `${name},Scientific ${index},${index},ML${index + 1}`),
    ].join('\n')
    expect(parseLifeList(lifeList).map(entry => entry.commonName)).toEqual(keptBases)

    const ml = [
      'Catalog Number,Common Name,Scientific Name,Format',
      ...names.map((name, index) => `${index + 1},${name},Scientific ${index},Photo`),
    ].join('\n')
    const mlResult = parseMLExport(ml)
    // `entries` is sorted by the parser, `rows` keep CSV order, so they are compared
    // differently on purpose rather than one of them being loosened to make it pass.
    expect(new Set(mlResult.entries.map(entry => entry.commonName))).toEqual(new Set(keptBases))
    expect(mlResult.rows.map(row => row.commonName)).toEqual(keptBases)
    expect(mlResult.mediaMap).toEqual({ '1': 'Photo', '2': 'Photo' })

    const breeding = breedingFixture(names)
    const direct = parseBreedingCodes(breeding.csv)
    const derivedRows = deriveBreedingRows(breeding.observations)
    expect(new Set(direct.entries.map(entry => entry.commonName))).toEqual(new Set(keptBases))
    expect(direct.rows.map(row => row.commonName)).toEqual(keptBases)
    expect(derivedRows).toEqual(direct.rows)
    expect(deriveBreedingData(breeding.observations, breeding.csv)).toEqual(direct)
  })

  it('pins 124 rescued rows, 81 newly excluded names, and 79 parser entries', () => {
    expect(commonNames).toHaveLength(17_891)
    expect(rescuedIntergrades).toHaveLength(124)
    expect(v0586Intergrades).toHaveLength(36)
    expect(newlyExcluded).toHaveLength(81)
    expect(rescuedBaseNames.size).toBe(79)

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
    expect(lifeEntries.flatMap(entry => entry.catalogIds)).toHaveLength(124)

    const ml = [
      'Catalog Number,Common Name,Scientific Name,Format',
      ...rescuedIntergrades.map((name, index) =>
        `${index + 1},${name},Scientific ${index},Photo`,
      ),
    ].join('\n')
    const mlResult = parseMLExport(ml)
    expect(new Set(mlResult.entries.map(entry => entry.commonName))).toEqual(rescuedBaseNames)
    expect(mlResult.entries).toHaveLength(79)
    expect(mlResult.rows).toHaveLength(124)
    expect(Object.keys(mlResult.mediaMap)).toHaveLength(124)

    const breeding = breedingFixture(rescuedIntergrades)
    const direct = parseBreedingCodes(breeding.csv)
    const derived = deriveBreedingData(breeding.observations, breeding.csv)
    expect(new Set(direct.entries.map(entry => entry.commonName))).toEqual(rescuedBaseNames)
    expect(direct.entries).toHaveLength(79)
    expect(direct.rows).toHaveLength(124)
    expect(derived).toEqual(direct)
  })
})
