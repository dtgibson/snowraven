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

  // REVERSED in v0.5.75. This used to assert map.size === 0 ("the crux"), which was
  // exactly the defect: computeNamedBirds discovers an individual by parsing
  // [name:…] out of this same field, so excluding it here meant the tag that CREATES
  // a named bird could never attribute its media. Every one of the reporting user's
  // 15 assets was tagged only here, with caption and mediaNotes empty.
  it('DOES match a tag that appears only in observationDetails (the v0.5.75 fallback)', () => {
    const map = computeNamedBirdMedia([
      row({ catalogId: '12', caption: '', mediaNotes: '', observationDetails: '[name:Copied]' }),
    ])
    expect(ids(map, namedBirdKey('Copied', 'Mallard'))).toEqual(['12'])
  })

  it('a row with no [name:…] in caption, mediaNotes, OR observationDetails matches nothing', () => {
    const map = computeNamedBirdMedia([
      row({ catalogId: '13', caption: 'nice light', mediaNotes: 'handheld', observationDetails: 'two birds, distant' }),
    ])
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

// ── The v0.5.75 precedence rule ───────────────────────────────────────────────
//
// Per row: the asset's OWN comment (caption + mediaNotes) is the authority. Only
// when it names nobody does the row fall back to observationDetails (the eBird
// species comment). The two sets are NEVER merged — that is the difference between
// a caption CORRECTING a broader observation tag and merely adding to it, and it is
// the property most at risk from a well-meaning future "why not both?" edit.
describe('computeNamedBirdMedia — caption/observation precedence (v0.5.75)', () => {
  it('the asset\'s own comment WINS: a conflicting observation tag is not consulted', () => {
    const map = computeNamedBirdMedia([
      row({ catalogId: '70', caption: '[name:Pilgrim]', observationDetails: '[name:Winky]' }),
    ])
    // Precedence, not union: Winky must NOT appear at all.
    expect(keysOf(map)).toEqual([namedBirdKey('Pilgrim', 'Mallard')])
    expect(ids(map, namedBirdKey('Pilgrim', 'Mallard'))).toEqual(['70'])
    expect(map.has(namedBirdKey('Winky', 'Mallard'))).toBe(false)
  })

  it('mediaNotes alone also outranks observationDetails', () => {
    const map = computeNamedBirdMedia([
      row({ catalogId: '71', caption: '', mediaNotes: '[name:Pilgrim]', observationDetails: '[name:Winky]' }),
    ])
    expect(keysOf(map)).toEqual([namedBirdKey('Pilgrim', 'Mallard')])
  })

  it('falls back to observationDetails only when caption AND mediaNotes name nobody', () => {
    // Non-empty but untagged per-asset text must still fall through — "has text" is
    // not the trigger, "names someone" is.
    const map = computeNamedBirdMedia([
      row({ catalogId: '72', caption: 'backlit, 400mm', mediaNotes: 'cropped', observationDetails: 'with [name:Winky]' }),
    ])
    expect(ids(map, namedBirdKey('Winky', 'Mallard'))).toEqual(['72'])
  })

  it('one tagged observation attributes ALL of its uncaptioned assets', () => {
    // The reporting user's shape: several assets, one observation, tag only there.
    const obs = 'foraging with [name:Winky]'
    const map = computeNamedBirdMedia([
      row({ catalogId: '80', observationDetails: obs, date: '2024-06-01' }),
      row({ catalogId: '81', observationDetails: obs, date: '2024-06-01', format: 'Audio' }),
      row({ catalogId: '82', observationDetails: obs, date: '2024-06-01', format: 'Video' }),
    ])
    expect(ids(map, namedBirdKey('Winky', 'Mallard')).sort()).toEqual(['80', '81', '82'])
  })

  it('a TWO-name observation attributes each uncaptioned asset to BOTH individuals', () => {
    // The honest superset when the data cannot say which bird an asset shows. The
    // fallback must NOT be suppressed here — doing so would blank exactly the
    // birders who tag the most.
    const map = computeNamedBirdMedia([
      row({ catalogId: '90', observationDetails: '[name:Winky] and [name:Pilgrim] together' }),
    ])
    expect(keysOf(map)).toEqual([
      namedBirdKey('Pilgrim', 'Mallard'),
      namedBirdKey('Winky', 'Mallard'),
    ].sort())
    expect(ids(map, namedBirdKey('Winky', 'Mallard'))).toEqual(['90'])
    expect(ids(map, namedBirdKey('Pilgrim', 'Mallard'))).toEqual(['90'])
  })

  it('a captioned asset opts OUT of its two-name observation entirely', () => {
    // The birder's explicit override: caption the one asset you can attribute.
    const map = computeNamedBirdMedia([
      row({ catalogId: '91', caption: '[name:Pilgrim]', observationDetails: '[name:Winky] and [name:Pilgrim]' }),
      row({ catalogId: '92', observationDetails: '[name:Winky] and [name:Pilgrim]' }),
    ])
    // 91 is Pilgrim's only; 92 (uncaptioned) is still shared by both.
    expect(ids(map, namedBirdKey('Pilgrim', 'Mallard')).sort()).toEqual(['91', '92'])
    expect(ids(map, namedBirdKey('Winky', 'Mallard'))).toEqual(['92'])
  })

  it('the fallback is still species-scoped (no cross-attribution via observationDetails)', () => {
    const map = computeNamedBirdMedia([
      row({ catalogId: '93', commonName: 'Mallard', observationDetails: '[name:Pete]' }),
      row({ catalogId: '94', commonName: 'Canada Goose', observationDetails: '[name:Pete]' }),
    ])
    expect(ids(map, namedBirdKey('Pete', 'Mallard'))).toEqual(['93'])
    expect(ids(map, namedBirdKey('Pete', 'Canada Goose'))).toEqual(['94'])
  })

  it('dedupes within a bird when the fallback names the same individual twice', () => {
    const map = computeNamedBirdMedia([
      row({ catalogId: '95', observationDetails: '[name:Winky] then [name:winky] again' }),
    ])
    expect(ids(map, namedBirdKey('Winky', 'Mallard'))).toEqual(['95'])
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
