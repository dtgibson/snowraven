import { describe, it, expect } from 'vitest'
import { computeNamedBirdMedia, type NamedBirdAsset } from './namedBirdMedia'
import { computeNamedBirds, namedBirdKey } from './namedBirds'
import type { MLExportRow } from './parseMLExport'
import type { ObservationEntry } from '../types'

// A minimal MLExportRow builder — only the fields the matcher reads matter; the
// rest are filled with the parser's neutral defaults.
function row(partial: Partial<MLExportRow>): MLExportRow {
  return {
    catalogId: '1',
    commonName: 'Mallard',
    scientificName: 'Anas platyrhynchos',
    format: 'Photo',
    date: '2024-06-01',
    location: '',
    county: null,
    latitude: null,
    longitude: null,
    caption: '',
    mediaNotes: '',
    observationDetails: '',
    ageSex: '',
    behaviors: '',
    time: '',
    year: null,
    month: null,
    avgRating: null,
    numRatings: 0,
    checklistId: '',
    ...partial,
  }
}

function keysOf(map: Map<string, NamedBirdAsset[]>): string[] {
  return [...map.keys()].sort()
}
function ids(map: Map<string, NamedBirdAsset[]>, key: string): string[] {
  return (map.get(key) ?? []).map(a => a.catalogId)
}

describe('computeNamedBirdMedia — matching (FR-01..FR-04)', () => {
  it('matches a [name:X] tag in the caption', () => {
    const map = computeNamedBirdMedia([row({ catalogId: '10', caption: 'preening [name:Winky]' })])
    expect(map.get(namedBirdKey('Winky', 'Mallard'))?.map(a => a.catalogId)).toEqual(['10'])
  })

  it('matches a [name:X] tag in mediaNotes', () => {
    const map = computeNamedBirdMedia([row({ catalogId: '11', mediaNotes: 'the local [name:Pete]' })])
    expect(map.get(namedBirdKey('Pete', 'Mallard'))?.map(a => a.catalogId)).toEqual(['11'])
  })

  it('does NOT match a tag that appears only in observationDetails (the crux)', () => {
    const map = computeNamedBirdMedia([
      row({ catalogId: '12', caption: '', mediaNotes: '', observationDetails: '[name:Copied]' }),
    ])
    expect(map.size).toBe(0)
  })

  it('a row with no [name:…] in caption+mediaNotes matches nothing', () => {
    const map = computeNamedBirdMedia([row({ catalogId: '13', caption: 'nice light', mediaNotes: 'handheld' })])
    expect(map.size).toBe(0)
  })

  it('scopes by species — [name:Pete] on two species does not cross-attribute', () => {
    const map = computeNamedBirdMedia([
      row({ catalogId: '20', commonName: 'Mallard', caption: '[name:Pete]' }),
      row({ catalogId: '21', commonName: 'Canada Goose', caption: '[name:Pete]' }),
    ])
    const kMallard = namedBirdKey('Pete', 'Mallard')
    const kGoose = namedBirdKey('Pete', 'Canada Goose')
    expect(kMallard).not.toBe(kGoose)
    expect(ids(map, kMallard)).toEqual(['20'])
    expect(ids(map, kGoose)).toEqual(['21'])
  })

  it('is case-insensitive on the name (matches parseNameTags / computeNamedBirds)', () => {
    const map = computeNamedBirdMedia([
      row({ catalogId: '30', caption: '[NAME:pete]' }),
      row({ catalogId: '31', caption: '[name:Pete]' }),
    ])
    // Both land in the same key (keyed on lowercased name).
    expect(keysOf(map)).toEqual([namedBirdKey('Pete', 'Mallard')])
    expect(ids(map, namedBirdKey('Pete', 'Mallard')).sort()).toEqual(['30', '31'])
  })

  it('normalizes a species subspecies parenthetical into the parent key', () => {
    // The parser already collapses commonName, but re-normalizing keeps the key
    // identical to computeNamedBirds even for a raw subspecies name.
    const map = computeNamedBirdMedia([
      row({ catalogId: '40', commonName: 'Dark-eyed Junco (Oregon)', caption: '[name:Junior]' }),
    ])
    expect(keysOf(map)).toEqual([namedBirdKey('Junior', 'Dark-eyed Junco')])
  })

  it('groups multiple individuals correctly', () => {
    const map = computeNamedBirdMedia([
      row({ catalogId: '50', caption: '[name:A]' }),
      row({ catalogId: '51', mediaNotes: '[name:B]' }),
      row({ catalogId: '52', caption: '[name:A]' }),
    ])
    expect(ids(map, namedBirdKey('A', 'Mallard')).sort()).toEqual(['50', '52'])
    expect(ids(map, namedBirdKey('B', 'Mallard'))).toEqual(['51'])
  })
})

describe('computeNamedBirdMedia — dedupe + ordering (OQ-03, format bucketing)', () => {
  it('dedupes a catalogId within one bird (same name in both fields)', () => {
    const map = computeNamedBirdMedia([
      row({ catalogId: '60', caption: '[name:Dup]', mediaNotes: '[name:Dup] again' }),
    ])
    expect(ids(map, namedBirdKey('Dup', 'Mallard'))).toEqual(['60'])
  })

  it('dedupes a catalogId across two rows for the same bird', () => {
    const map = computeNamedBirdMedia([
      row({ catalogId: '61', caption: '[name:Dup]' }),
      row({ catalogId: '61', mediaNotes: '[name:Dup]' }),
    ])
    expect(ids(map, namedBirdKey('Dup', 'Mallard'))).toEqual(['61'])
  })

  it('sorts a bird’s assets newest-date-first, catalogId as a stable tie-break', () => {
    const map = computeNamedBirdMedia([
      row({ catalogId: '2', date: '2024-01-01', caption: '[name:Ord]' }),
      row({ catalogId: '9', date: '2024-06-01', caption: '[name:Ord]' }),
      row({ catalogId: '1', date: '2024-06-01', caption: '[name:Ord]' }),
      row({ catalogId: '5', date: '', caption: '[name:Ord]' }),
    ])
    // newest date first; same-date ties break by catalogId desc; empty date last.
    expect(ids(map, namedBirdKey('Ord', 'Mallard'))).toEqual(['9', '1', '2', '5'])
  })

  it('carries the format through to the asset (photo/audio/video bucketing)', () => {
    const map = computeNamedBirdMedia([
      row({ catalogId: '70', format: 'Photo', caption: '[name:Multi]' }),
      row({ catalogId: '71', format: 'Audio', caption: '[name:Multi]' }),
      row({ catalogId: '72', format: 'Video', caption: '[name:Multi]' }),
    ])
    const formats = (map.get(namedBirdKey('Multi', 'Mallard')) ?? []).map(a => a.format).sort()
    expect(formats).toEqual(['Audio', 'Photo', 'Video'])
  })

  it('null / empty rows → an empty Map (FR-17)', () => {
    expect(computeNamedBirdMedia(null).size).toBe(0)
    expect(computeNamedBirdMedia(undefined).size).toBe(0)
    expect(computeNamedBirdMedia([]).size).toBe(0)
  })
})

describe('key-parity guard — the media join must line up with computeNamedBirds', () => {
  it('produces the SAME key computeNamedBirds does for the same (name, species)', () => {
    // Build an observation and an ML row that name the same individual on the same
    // species. The individual's namedBird key must equal the media bucket key.
    const obs: ObservationEntry = {
      submissionId: 'S1',
      commonName: 'Dark-eyed Junco (Oregon)',
      scientificName: 'Junco hyemalis',
      date: '2024-06-01',
      location: 'Yard',
      locationId: 'L1',
      latitude: null,
      longitude: null,
      county: null,
      count: 1,
      breedingCode: null,
      speciesComments: '[name:Junior]',
      catalogIds: [],
    }

    const birds = computeNamedBirds([obs])
    expect(birds).toHaveLength(1)
    const birdKey = birds[0].key

    const map = computeNamedBirdMedia([
      row({ catalogId: '100', commonName: 'Dark-eyed Junco (Oregon)', caption: '[name:Junior]' }),
    ])
    // The single media bucket's key is exactly the named bird's key.
    expect(keysOf(map)).toEqual([birdKey])
    expect(ids(map, birdKey)).toEqual(['100'])
  })
})
