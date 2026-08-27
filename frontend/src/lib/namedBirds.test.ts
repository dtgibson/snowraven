import { describe, it, expect } from 'vitest'
import type { ObservationEntry } from '../types'
import { parseNameTags, computeNamedBirds, sortNamedBirds, computeNamedBirdLocations } from './namedBirds'

function obs(p: Partial<ObservationEntry> & { submissionId: string }): ObservationEntry {
  return {
    commonName: 'Mallard', scientificName: 'Anas platyrhynchos', date: '2024-01-01',
    location: 'Loc', locationId: 'L1', latitude: null, longitude: null, county: null,
    count: 1, breedingCode: null, speciesComments: '', catalogIds: [],
    ...p,
  }
}

describe('parseNameTags', () => {
  it('extracts a single name', () => {
    expect(parseNameTags('Banded male [name:Winky] near the dock')).toEqual(['Winky'])
  })
  it('handles hyphenated names and surrounding whitespace', () => {
    expect(parseNameTags('[ name : one-leg-pete ]')).toEqual(['one-leg-pete'])
  })
  it('is case-insensitive on the tag keyword', () => {
    expect(parseNameTags('[NAME:Blue] and [Name:Red]')).toEqual(['Blue', 'Red'])
  })
  it('extracts multiple distinct names, de-duping repeats within a comment', () => {
    expect(parseNameTags('[name:Winky] feeding [name:Blinky]; later [name:winky] again'))
      .toEqual(['Winky', 'Blinky'])
  })
  it('returns [] for no tag or empty', () => {
    expect(parseNameTags('just a normal comment')).toEqual([])
    expect(parseNameTags('')).toEqual([])
    expect(parseNameTags('[name:]')).toEqual([])
  })
  it('handles a pathological unclosed tag without catastrophic backtracking', () => {
    const t0 = Date.now()
    expect(parseNameTags('[ name : ' + ' '.repeat(20000))).toEqual([])  // no closing ]
    expect(Date.now() - t0).toBeLessThan(2000)  // the old lazy+\\s* regex took tens of seconds
  })
})

describe('computeNamedBirds', () => {
  const observations: ObservationEntry[] = [
    obs({ submissionId: 'S1', commonName: 'Mallard', date: '2024-03-01', speciesComments: 'drake [name:Pete]', count: 2 }),
    obs({ submissionId: 'S2', commonName: 'Mallard', date: '2024-05-01', speciesComments: '[name:Pete] back again' }),
    obs({ submissionId: 'S3', commonName: 'Mallard', date: '2024-04-01', speciesComments: 'no name here' }),
    obs({ submissionId: 'S4', commonName: 'Canada Goose', date: '2024-04-15', speciesComments: '[name:Pete] the goose' }),
    obs({ submissionId: 'S5', commonName: 'Mallard (Northern)', date: '2024-06-01', speciesComments: '[name:pete] subspecies row' }),
  ]

  it('groups by name + species and folds subspecies into the parent', () => {
    const birds = computeNamedBirds(observations)
    // Pete-Mallard (S1,S2,S5) and Pete-CanadaGoose (S4) → 2 distinct birds.
    expect(birds).toHaveLength(2)
    const mallardPete = birds.find(b => b.commonName === 'Mallard')!
    expect(mallardPete.sightingCount).toBe(3)
    expect(mallardPete.name).toBe('Pete')
  })

  it('computes first/last seen across sightings', () => {
    const mallardPete = computeNamedBirds(observations).find(b => b.commonName === 'Mallard')!
    expect(mallardPete.firstSeen).toBe('2024-03-01')
    expect(mallardPete.lastSeen).toBe('2024-06-01')
  })

  it('lists sightings newest-first with checklist id and comment', () => {
    const mallardPete = computeNamedBirds(observations).find(b => b.commonName === 'Mallard')!
    expect(mallardPete.sightings.map(s => s.submissionId)).toEqual(['S5', 'S2', 'S1'])
    expect(mallardPete.sightings[2]).toMatchObject({ submissionId: 'S1', comment: 'drake [name:Pete]' })
  })

  it('threads location and coordinates onto each sighting from the observation', () => {
    const birds = computeNamedBirds([
      obs({ submissionId: 'S1', commonName: 'Mallard', date: '2024-03-01', speciesComments: '[name:Pete]', location: 'Caswell SP', latitude: 37.7, longitude: -121.2 }),
      obs({ submissionId: 'S2', commonName: 'Mallard', date: '2024-05-01', speciesComments: '[name:Pete]', location: '', latitude: null, longitude: null }),
    ])
    const pete = birds[0]
    // newest first → S2 (no location/coords), then S1
    expect(pete.sightings[0]).toMatchObject({ submissionId: 'S2', location: '', latitude: null, longitude: null })
    expect(pete.sightings[1]).toMatchObject({ submissionId: 'S1', location: 'Caswell SP', latitude: 37.7, longitude: -121.2 })
  })

  it('counts one sighting per checklist even across parent + subspecies rows', () => {
    const birds = computeNamedBirds([
      obs({ submissionId: 'S1', commonName: 'Mallard', date: '2024-03-01', speciesComments: '[name:Pete]' }),
      obs({ submissionId: 'S1', commonName: 'Mallard (Northern)', date: '2024-03-01', speciesComments: '[name:Pete]' }),
    ])
    expect(birds).toHaveLength(1)
    expect(birds[0].sightingCount).toBe(1)
    expect(birds[0].sightings.map(s => s.submissionId)).toEqual(['S1'])
  })

  it('treats the same name on a different species as a different bird', () => {
    const goosePete = computeNamedBirds(observations).find(b => b.commonName === 'Canada Goose')!
    expect(goosePete.sightingCount).toBe(1)
  })

  it('counts a bird on every checklist where it is named (one comment, two names)', () => {
    const birds = computeNamedBirds([
      obs({ submissionId: 'S9', commonName: 'Mute Swan', speciesComments: 'pair [name:Romeo] and [name:Juliet]' }),
    ])
    expect(birds.map(b => b.name).sort()).toEqual(['Juliet', 'Romeo'])
  })
})

describe('sortNamedBirds', () => {
  const birds = computeNamedBirds([
    obs({ submissionId: 'A', commonName: 'Osprey', date: '2024-02-01', speciesComments: '[name:Zelda]' }),
    obs({ submissionId: 'B', commonName: 'Mallard', date: '2024-09-01', speciesComments: '[name:Abby]' }),
    obs({ submissionId: 'C', commonName: 'Mallard', date: '2024-05-01', speciesComments: '[name:Mid]' }),
  ])
  it('sorts by name A–Z', () => {
    expect(sortNamedBirds(birds, 'name').map(b => b.name)).toEqual(['Abby', 'Mid', 'Zelda'])
  })
  it('sorts alphabetically by species common name A–Z, name tie-break', () => {
    // Two Mallards (Abby, Mid) before Osprey (Zelda); Abby before Mid by name.
    expect(sortNamedBirds(birds, 'alphabetical').map(b => b.name)).toEqual(['Abby', 'Mid', 'Zelda'])
    expect(sortNamedBirds(birds, 'alphabetical').map(b => b.commonName)).toEqual(['Mallard', 'Mallard', 'Osprey'])
  })
  it('sorts by last seen, newest first', () => {
    expect(sortNamedBirds(birds, 'lastSeen').map(b => b.name)).toEqual(['Abby', 'Mid', 'Zelda'])
  })

  describe('taxonomic sort', () => {
    it('orders by eBird taxonomic order, name tie-break within a species', () => {
      // Osprey before Mallard in this stub order; the two Mallards tie on order
      // and fall through to the name tie-break (Abby before Mid).
      const orderFor = (cn: string) => ({ Osprey: 1, Mallard: 5 }[cn] ?? Infinity)
      expect(sortNamedBirds(birds, 'taxonomic', orderFor).map(b => b.name)).toEqual(['Zelda', 'Abby', 'Mid'])
    })

    it('sends species with unknown order to a stable tail, then by name', () => {
      // Only Mallard has a known order; Osprey (unknown → Infinity) tails, and the
      // two Mallards order by name. Then the Osprey.
      const orderFor = (cn: string) => ({ Mallard: 2 }[cn] ?? Infinity)
      expect(sortNamedBirds(birds, 'taxonomic', orderFor).map(b => b.name)).toEqual(['Abby', 'Mid', 'Zelda'])
    })

    it('degrades to name order when no orders are known (orders not yet loaded)', () => {
      // Every species resolves to Infinity → comparator first term is NaN for
      // every pair → pure name order, no error, no empty list.
      const orderFor = () => Infinity
      expect(sortNamedBirds(birds, 'taxonomic', orderFor).map(b => b.name)).toEqual(['Abby', 'Mid', 'Zelda'])
    })

    it('degrades to name order when orderFor is omitted entirely', () => {
      expect(sortNamedBirds(birds, 'taxonomic').map(b => b.name)).toEqual(['Abby', 'Mid', 'Zelda'])
    })
  })
})


describe('computeNamedBirdLocations', () => {
  // One individual's sightings, built the same way the tab builds them, so the
  // ranking is exercised against real computeNamedBirds output rather than a
  // hand-written shape that could drift from it.
  const winky = (extra: ObservationEntry[] = []) => computeNamedBirds([
    obs({ submissionId: 'S1', date: '2024-01-01', location: 'Lake Merritt', locationId: 'L1', speciesComments: '[name:Winky]' }),
    obs({ submissionId: 'S2', date: '2024-02-01', location: 'Lake Merritt', locationId: 'L1', speciesComments: '[name:Winky]' }),
    obs({ submissionId: 'S3', date: '2024-03-01', location: 'Lake Merritt', locationId: 'L1', speciesComments: '[name:Winky]' }),
    obs({ submissionId: 'S4', date: '2024-04-01', location: 'Arrowhead Marsh', locationId: 'L2', speciesComments: '[name:Winky]' }),
    obs({ submissionId: 'S5', date: '2024-05-01', location: 'Arrowhead Marsh', locationId: 'L2', speciesComments: '[name:Winky]' }),
    obs({ submissionId: 'S6', date: '2024-06-01', location: 'Berkeley Marina', locationId: 'L3', speciesComments: '[name:Winky]' }),
    ...extra,
  ])[0].sightings

  it('ranks by this individual\u2019s sighting count, keeping each location\u2019s id', () => {
    expect(computeNamedBirdLocations(winky())).toEqual([
      { location: 'Lake Merritt', locationId: 'L1', count: 3 },
      { location: 'Arrowhead Marsh', locationId: 'L2', count: 2 },
      { location: 'Berkeley Marina', locationId: 'L3', count: 1 },
    ])
  })

  it('breaks a count tie alphabetically by location name', () => {
    const tied = computeNamedBirds([
      obs({ submissionId: 'S1', location: 'Zebra Pond', locationId: 'L9', speciesComments: '[name:Tie]' }),
      obs({ submissionId: 'S2', location: 'Apple Creek', locationId: 'L8', speciesComments: '[name:Tie]' }),
    ])[0].sightings
    expect(computeNamedBirdLocations(tied).map(l => l.location)).toEqual(['Apple Creek', 'Zebra Pond'])
  })

  it('counts ONLY this individual, never the whole species', () => {
    // A second Mallard, unnamed, recorded five times at a place Winky has been
    // once. The species' top location is Berkeley Marina; Winky's is not.
    const withSpeciesNoise = winky([
      obs({ submissionId: 'S7', location: 'Berkeley Marina', locationId: 'L3', speciesComments: 'two drakes' }),
      obs({ submissionId: 'S8', location: 'Berkeley Marina', locationId: 'L3', speciesComments: '' }),
      obs({ submissionId: 'S9', location: 'Berkeley Marina', locationId: 'L3', speciesComments: 'pair' }),
      obs({ submissionId: 'S10', location: 'Berkeley Marina', locationId: 'L3', speciesComments: 'flyover' }),
    ])
    expect(computeNamedBirdLocations(withSpeciesNoise)[0]).toEqual({ location: 'Lake Merritt', locationId: 'L1', count: 3 })
    expect(computeNamedBirdLocations(withSpeciesNoise).find(l => l.location === 'Berkeley Marina')?.count).toBe(1)
  })

  it('counts a different individual of the same species separately', () => {
    const both = computeNamedBirds([
      obs({ submissionId: 'S1', location: 'Lake Merritt', locationId: 'L1', speciesComments: '[name:Winky]' }),
      obs({ submissionId: 'S2', location: 'Arrowhead Marsh', locationId: 'L2', speciesComments: '[name:Blinky]' }),
      obs({ submissionId: 'S3', location: 'Arrowhead Marsh', locationId: 'L2', speciesComments: '[name:Blinky]' }),
    ])
    const byName = Object.fromEntries(both.map(b => [b.name, computeNamedBirdLocations(b.sightings)]))
    expect(byName['Winky']).toEqual([{ location: 'Lake Merritt', locationId: 'L1', count: 1 }])
    expect(byName['Blinky']).toEqual([{ location: 'Arrowhead Marsh', locationId: 'L2', count: 2 }])
  })

  it('skips sightings with no location name (and blank-only names)', () => {
    const sparse = computeNamedBirds([
      obs({ submissionId: 'S1', location: '', locationId: '', speciesComments: '[name:Ghost]' }),
      obs({ submissionId: 'S2', location: '   ', locationId: '', speciesComments: '[name:Ghost]' }),
      obs({ submissionId: 'S3', location: 'Real Place', locationId: 'L5', speciesComments: '[name:Ghost]' }),
    ])[0].sightings
    expect(computeNamedBirdLocations(sparse)).toEqual([{ location: 'Real Place', locationId: 'L5', count: 1 }])
  })

  it('returns [] when no sighting carries a location name', () => {
    const none = computeNamedBirds([
      obs({ submissionId: 'S1', location: '', locationId: '', speciesComments: '[name:Ghost]' }),
    ])[0].sightings
    expect(computeNamedBirdLocations(none)).toEqual([])
  })

  it('counts one per checklist, so a parent+subspecies pair is not double-counted', () => {
    // Both rows are the same checklist at the same place, tagged with the same
    // name — computeNamedBirds collapses them, so the location count is 1 and the
    // totals still reconcile with the card header.
    const dupe = computeNamedBirds([
      obs({ submissionId: 'S1', commonName: 'Mallard', location: 'Lake Merritt', locationId: 'L1', speciesComments: '[name:Winky]' }),
      obs({ submissionId: 'S1', commonName: 'Mallard (Mexican)', location: 'Lake Merritt', locationId: 'L1', speciesComments: '[name:Winky]' }),
    ])[0]
    expect(dupe.sightingCount).toBe(1)
    expect(computeNamedBirdLocations(dupe.sightings)).toEqual([{ location: 'Lake Merritt', locationId: 'L1', count: 1 }])
  })

  it('location counts sum to the individual\u2019s located sighting count', () => {
    const bird = computeNamedBirds([
      obs({ submissionId: 'S1', location: 'A', locationId: 'L1', speciesComments: '[name:Sum]' }),
      obs({ submissionId: 'S2', location: 'B', locationId: 'L2', speciesComments: '[name:Sum]' }),
      obs({ submissionId: 'S3', location: 'B', locationId: 'L2', speciesComments: '[name:Sum]' }),
      obs({ submissionId: 'S4', location: '', locationId: '', speciesComments: '[name:Sum]' }),
    ])[0]
    const located = bird.sightings.filter(s => s.location.trim()).length
    expect(computeNamedBirdLocations(bird.sightings).reduce((n, l) => n + l.count, 0)).toBe(located)
    expect(located).toBe(bird.sightingCount - 1)
  })
})
