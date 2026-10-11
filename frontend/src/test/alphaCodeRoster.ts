// THE ONE ROSTER OF SPECIES-CODE QUERIES (species-code-search, PRD QA-01 to
// QA-16, QA-19 to QA-22; schema.md section 15).
//
// Run twice, by `lib/alphaCodeSearch.test.ts` (node) and
// `lib/alphaCodeSearch.jsdom.test.ts` (jsdom), against the REAL committed
// asset, so "the same answers in every environment" (QA-49) is one roster run
// in two places rather than two rosters that agree today.
//
// Each row states Search's expected species rows as two groups, `code` then
// `name`, each in Search's alphabetical order. The PICKER expectation is
// derived from the same row rather than written again: a picker lists the code
// group, then the name group, each in the order the options were handed in (the
// row's `fixture` order, deliberately not alphabetical in several rows), and the
// two surfaces list the same SET (FR-19, QA-24, QA-26).

import { buildPaletteRows, type PaletteNavItem, type PaletteRowsResult } from '../lib/paletteRows'
import type { TabIcon } from '../lib/tabIcons'
import { DEFAULT_TAB_ORDER, TAB_LABELS } from '../lib/tabLayout'
import { alphaCodeHits, type AlphaCodeTable } from '../lib/alphaCodes'
import { matchesSpeciesQuery, normalizeSpeciesQuery, rankSpeciesMatches } from '../lib/speciesMatch'

const icon = (() => null) as unknown as TabIcon

/** The default visible destinations, in the default order, Settings last. */
export const DEFAULT_ITEMS: PaletteNavItem[] = [
  ...DEFAULT_TAB_ORDER.map(id => ({ id, label: TAB_LABELS[id], icon })),
  { id: 'settings', label: 'Settings', icon },
]

export interface RosterRow {
  id: string
  /** The species list, in the order a picker is handed it. */
  fixture: string[]
  /** The query exactly as typed. */
  query: string
  /** Search's code group, alphabetical. */
  code: string[]
  /** Search's name-only group, alphabetical. */
  name: string[]
}

const YRWA_FIXTURE = [
  'Yellow-rumped Warbler', 'Yellow-rumped Warbler (Myrtle)', "Yellow-rumped Warbler (Audubon's)",
  'Northern Yellow Warbler', 'Cape May Warbler',
]
const YRWA_ROWS = ['Yellow-rumped Warbler', "Yellow-rumped Warbler (Audubon's)", 'Yellow-rumped Warbler (Myrtle)']
const FORMS = [
  'Yellow-rumped Warbler (West Mexico)', 'Yellow-rumped Warbler', "Yellow-rumped Warbler (Audubon's)",
  'Yellow-rumped Warbler (Myrtle)',
]

export const ROSTER: RosterRow[] = [
  // QA-01, QA-02: the code in any case, with any surrounding whitespace.
  ...['yrwa', 'YRWA', 'Yrwa', 'yRwA', ' yrwa', 'yrwa ', '\tyrwa\n', ' yrwa\u3000'].map(query => ({
    id: `QA-01/02 ${JSON.stringify(query)}`, fixture: YRWA_FIXTURE, query, code: YRWA_ROWS, name: [],
  })),
  // QA-03: interior whitespace and partial codes are never codes; each gives
  // exactly the name-only rows (`yr` is inside "Myrtle").
  ...['yr wa', 'yrw', 'yrwar', 'rwa'].map(query => ({
    id: `QA-03 ${JSON.stringify(query)}`, fixture: YRWA_FIXTURE, query, code: [], name: [],
  })),
  { id: 'QA-03 "yr"', fixture: YRWA_FIXTURE, query: 'yr', code: [], name: ['Yellow-rumped Warbler (Myrtle)'] },
  { id: 'QA-04 cago', fixture: ['Snow Goose', 'Canada Goose', 'Cackling/Canada Goose', 'Cackling Goose'], query: 'cago',
    code: ['Cackling Goose', 'Canada Goose'], name: [] },
  { id: 'QA-05 nosh', fixture: ['Northern Shrike', 'Northern Pintail', 'Northern Shoveler'], query: 'nosh',
    code: ['Northern Shoveler', 'Northern Shrike'], name: [] },
  { id: 'QA-06 trsw', fixture: ['Trumpeter Swan', 'Tundra Swan', 'Tree Swallow'], query: 'trsw',
    code: ['Tree Swallow', 'Trumpeter Swan'], name: [] },
  { id: 'QA-07 gbhe', fixture: ['Great Blue Heron', 'Green Heron', 'Great Egret'], query: 'gbhe',
    code: ['Great Blue Heron'], name: [] },
  { id: 'QA-08 amro', fixture: ['American Robin'], query: 'amro', code: ['American Robin'], name: [] },
  { id: 'QA-08 anhu', fixture: ["Anna's Hummingbird"], query: 'anhu', code: ["Anna's Hummingbird"], name: [] },
  { id: 'QA-08 mall', fixture: ['Mallard'], query: 'mall', code: ['Mallard'], name: [] },
  // QA-09: codes from other names match nothing; variants of the shown name do.
  { id: 'QA-09 rodo', fixture: ['Rock Pigeon'], query: 'rodo', code: [], name: [] },
  { id: 'QA-09 goos', fixture: ['Common Merganser'], query: 'goos', code: [], name: [] },
  { id: 'QA-09 cost', fixture: ['European Starling'], query: 'cost', code: [], name: [] },
  { id: 'QA-09 liau', fixture: ['Dovekie'], query: 'liau', code: [], name: [] },
  { id: 'QA-09 gndi', fixture: ['Common Loon'], query: 'gndi', code: [], name: [] },
  { id: 'QA-09 mywa',
    fixture: ['Yellow-rumped Warbler', 'Yellow-rumped Warbler (Myrtle)', "Yellow-rumped Warbler (Audubon's)", 'Cape May x Yellow-rumped Warbler (hybrid)'],
    query: 'mywa', code: ['Yellow-rumped Warbler (Myrtle)'], name: [] },
  ...['cowp', 'cowo', 'cwpi'].map(query => ({
    id: `QA-09 ${query}`, fixture: ['Common Wood-Pigeon'], query, code: ['Common Wood-Pigeon'], name: [],
  })),
  ...['rubu', 'r\u00FCbu', 'R\u00DCBU'].map(query => ({
    id: `QA-09 ${JSON.stringify(query)}`, fixture: ["R\u00FCppell's Bustard"], query, code: ["R\u00FCppell's Bustard"], name: [],
  })),
  // QA-10, QA-11: a form's own code, and the parent's code finding every form.
  { id: 'QA-10 auwa', fixture: FORMS, query: 'auwa', code: ["Yellow-rumped Warbler (Audubon's)"], name: [] },
  { id: 'QA-11 yrwa', fixture: FORMS, query: 'yrwa',
    code: ['Yellow-rumped Warbler', "Yellow-rumped Warbler (Audubon's)", 'Yellow-rumped Warbler (Myrtle)', 'Yellow-rumped Warbler (West Mexico)'],
    name: [] },
  // QA-12: an unpublished form falls back to its parent; a name neither resolves matches by name.
  { id: 'QA-12 yrwa', fixture: ['Unknown Bird (Form)', 'Yellow-rumped Warbler (Old Form)'], query: 'yrwa',
    code: ['Yellow-rumped Warbler (Old Form)'], name: [] },
  { id: 'QA-12 unknown', fixture: ['Unknown Bird (Form)', 'Yellow-rumped Warbler (Old Form)'], query: 'unknown',
    code: [], name: ['Unknown Bird (Form)'] },
  // QA-13: the hybrid carries no code, and is still found by name.
  { id: 'QA-13 yrwa', fixture: ['Cape May x Yellow-rumped Warbler (hybrid)', 'Yellow-rumped Warbler'], query: 'yrwa',
    code: ['Yellow-rumped Warbler'], name: [] },
  { id: 'QA-13 cape may', fixture: ['Cape May x Yellow-rumped Warbler (hybrid)', 'Yellow-rumped Warbler'], query: 'cape may',
    code: [], name: ['Cape May x Yellow-rumped Warbler (hybrid)'] },
  // QA-14: code group, then name group, no duplicates; including a fixture
  // where the name group would sort first.
  { id: 'QA-14 mall', fixture: ['Small Minivet', 'Malleefowl', 'Mallard'], query: 'mall',
    code: ['Mallard', 'Malleefowl'], name: ['Small Minivet'] },
  { id: 'QA-14 allmall', fixture: ['Allmall Bird', 'Mallard'], query: 'mall', code: ['Mallard'], name: ['Allmall Bird'] },
  // QA-15, QA-16: word codes and name-prefix codes (rule A).
  { id: 'QA-15 wren', fixture: ['Winter Wren', 'Wrentit', 'Rock Wren'], query: 'wren',
    code: ['Wrentit'], name: ['Rock Wren', 'Winter Wren'] },
  { id: 'QA-16 snow', fixture: ['Snow Goose', 'Snowy Owl', 'Snow Bunting'], query: 'snow',
    code: ['Snowy Owl'], name: ['Snow Bunting', 'Snow Goose'] },
  { id: 'QA-16 snowy', fixture: ['Snow Goose', 'Snowy Owl', 'Snow Bunting'], query: 'snowy',
    code: [], name: ['Snowy Owl'] },
  { id: 'QA-16 goos', fixture: ['Common Merganser', 'Snow Goose', 'Canada Goose'], query: 'goos',
    code: [], name: ['Canada Goose', 'Snow Goose'] },
  // QA-19: a code of no bird in the backup.
  { id: 'QA-19 amro', fixture: ['Mallard', 'Northern Flicker'], query: 'amro', code: [], name: [] },
]

/** The picker's expected rows for a roster row: code group, then name group, each in fixture order. */
export function pickerExpectation(row: RosterRow): string[] {
  return [
    ...row.fixture.filter(n => row.code.includes(n)),
    ...row.fixture.filter(n => row.name.includes(n)),
  ]
}

/** A species index built from names (sciName left empty, as for a form). */
export function speciesIndexOf(names: readonly string[]): { name: string; sciName: string }[] {
  return names.map(name => ({ name, sciName: '' }))
}

/** Search, through the real row builder. */
export function searchRows(
  table: AlphaCodeTable | null, names: readonly string[], query: string, cap?: number,
): PaletteRowsResult {
  return buildPaletteRows({ items: DEFAULT_ITEMS, index: speciesIndexOf(names), query, alphaCodes: table, cap })
}

/** Search's species row names, in order. */
export function speciesOf(result: PaletteRowsResult): string[] {
  return result.rows.slice(result.destinationCount).map(r => (r.kind === 'species' ? r.name : ''))
}

/** A picker's rows, through the same calls `SpeciesCombobox` makes (no order). */
export function pickerRows(table: AlphaCodeTable | null, options: readonly { name: string; sciName?: string }[], query: string): string[] {
  const q = normalizeSpeciesQuery(query)
  if (!q) return options.map(o => o.name)
  return rankSpeciesMatches(options, q, alphaCodeHits(table, options, q), matchesSpeciesQuery).map(o => o.name)
}
