// The splits-and-lumps derivation (taxonomic-splits-lumps, schema.md section 6):
// the matching tiers (QA-06, QA-07, QA-19), form roll-up and the slash exception
// (QA-08), the per-entry tally and its date partition (QA-16), the chain
// (QA-03, QA-15), the list order (QA-11), and the declared scan's linearity
// (schema.md 6.6, security.md), measured through the real exported entry point.
//
// The fixture history is written here in the asset's own shape, with names as
// the eBird taxonomy prints them, so the rules are stated independently of
// whichever years the committed asset happens to cover.

import { describe, it, expect } from 'vitest'
import type { ObservationEntry } from '../types'
import {
  buildTaxonomyHistoryIndex, historyListEntries, lineageFor,
  type TaxonomyHistory, type HistoryEvent,
} from './taxonomyHistory'
import ASSET_JSON from '../assets/ebird-taxonomy-history.json'

const U2023 = { year: 2023, published: '2023-10-24' }
const U2024 = { year: 2024, published: '2024-10-22' }
const U2025 = { year: 2025, published: '2025-10-31' }

const WARBLING: HistoryEvent = {
  kind: 'split', ...U2025,
  before: [{ code: 'warvir', sci: 'Vireo gilvus', com: 'Warbling Vireo', retired: true }],
  after: [
    { code: 'eawvir1', sci: 'Vireo gilvus', com: 'Eastern Warbling Vireo' },
    { code: 'wewvir2', sci: 'Vireo swainsoni', com: 'Western Warbling Vireo' },
  ],
  slashes: [{ code: 'warvir', sci: 'Vireo gilvus/swainsoni', com: 'Eastern/Western Warbling Vireo' }],
}
const REDPOLL: HistoryEvent = {
  kind: 'lump', ...U2024,
  before: [
    { code: 'comred', sci: 'Acanthis flammea', com: 'Common Redpoll', retired: true },
    { code: 'hoared', sci: 'Acanthis hornemanni', com: 'Hoary Redpoll', retired: true },
  ],
  after: [{ code: 'redpol1', sci: 'Acanthis flammea', com: 'Redpoll' }],
  slashes: [],
}
const CORYS: HistoryEvent = {
  kind: 'split', ...U2024,
  before: [{ code: 'corshe', sci: 'Calonectris diomedea', com: "Cory's Shearwater", retired: false }],
  after: [
    { code: 'corshe1', sci: 'Calonectris borealis', com: "Cory's Shearwater" },
    { code: 'scoshe1', sci: 'Calonectris diomedea', com: "Scopoli's Shearwater" },
  ],
  slashes: [],
}
// The chain: 2023 splits X into Y and Z; 2024 lumps Y with W into V.
const CHAIN_A: HistoryEvent = {
  kind: 'split', ...U2023,
  before: [{ code: 'xxx', sci: 'Genus alpha', com: 'Alpha Bird', retired: true }],
  after: [{ code: 'yyy', sci: 'Genus beta', com: 'Beta Bird' }, { code: 'zzz', sci: 'Genus gamma', com: 'Gamma Bird' }],
  slashes: [],
}
const CHAIN_B: HistoryEvent = {
  kind: 'lump', ...U2024,
  before: [
    { code: 'www', sci: 'Genus delta', com: 'Delta Bird', retired: true },
    { code: 'yyy', sci: 'Genus beta', com: 'Beta Bird', retired: true },
  ],
  after: [{ code: 'vvv', sci: 'Genus beta', com: 'Vee Bird' }],
  slashes: [],
}

const HISTORY: TaxonomyHistory = {
  v: 1, snapshot: 'T', generated: '2026-09-30', inputs: [],
  updates: [U2023, U2024, U2025],
  coverage: { earliest: U2023, latest: U2025 },
  events: [CHAIN_A, CORYS, CHAIN_B, REDPOLL, WARBLING],
}
const EV = { chainA: 0, corys: 1, chainB: 2, redpoll: 3, warbling: 4 }

function obs(commonName: string, date: string, scientificName = 'Genus species'): ObservationEntry {
  return {
    submissionId: 'S1', commonName, scientificName, date,
    location: 'Park', locationId: 'L1', latitude: null, longitude: null, county: null,
    count: 1, breedingCode: null, speciesComments: '', catalogIds: [],
  }
}

/** The page's `/taxonomy/codes` result for a current export: the species codes. */
const CURRENT_CODES = {
  'Eastern Warbling Vireo': 'eawvir1', 'Western Warbling Vireo': 'wewvir2', Redpoll: 'redpol1',
  "Cory's Shearwater": 'corshe1', "Scopoli's Shearwater": 'scoshe1', 'American Robin': 'amerob',
  'Gamma Bird': 'zzz', 'Vee Bird': 'vvv',
  // What the sciName-first bridge answers for a PRE-split export's "Warbling
  // Vireo / Vireo gilvus": the nominate daughter's code (schema.md 2.2).
  'Warbling Vireo': 'eawvir1',
}

describe('matching (FR-06, FR-07, FR-19; QA-06, QA-07, QA-19)', () => {
  it('a current after-side name is affected through its code; a species on no event is not (QA-06)', () => {
    const idx = buildTaxonomyHistoryIndex(
      [obs('Western Warbling Vireo', '2026-05-01', 'Vireo swainsoni'), obs('American Robin', '2026-05-01')],
      HISTORY, { codes: CURRENT_CODES },
    )
    expect([...idx.affected.keys()]).toEqual(['Western Warbling Vireo'])
    const w = idx.events[EV.warbling].after[1]
    expect(w).toMatchObject({ code: 'wewvir2', count: 1, speciesKey: 'Western Warbling Vireo' })
  })

  it('a retired common name wins over the code the bridge resolves it to (tier 0, schema.md 2.2)', () => {
    const idx = buildTaxonomyHistoryIndex(
      [obs('Warbling Vireo', '2024-06-01', 'Vireo gilvus')], HISTORY, { codes: CURRENT_CODES },
    )
    const ev = idx.events[EV.warbling]
    expect(ev.before[0]).toMatchObject({ count: 1, speciesKey: 'Warbling Vireo' })
    expect(ev.after.every(a => a.count === 0)).toBe(true)
    expect(ev.predates).toBe(true)
  })

  it('with no code at all, a pre-update name matches the before side by its names (QA-07)', () => {
    const idx = buildTaxonomyHistoryIndex([obs('Hoary Redpoll', '2020-01-01', 'Acanthis hornemanni')], HISTORY, { codes: {} })
    expect(idx.events[EV.redpoll].before[1]).toMatchObject({ count: 1, speciesKey: 'Hoary Redpoll' })
    expect(idx.events[EV.redpoll].predates).toBe(true)
  })

  it('the scientific name wins over a conflicting common name (QA-07)', () => {
    // The common name is Gamma Bird's (an after entry, never retired, so tier 0
    // stays out of it); the scientific name is Alpha Bird's. The sci step runs
    // before the common-name step, so the row lands on Alpha Bird.
    const idx = buildTaxonomyHistoryIndex([obs('Gamma Bird', '2022-01-01', 'Genus alpha')], HISTORY, { codes: {} })
    expect(idx.events[EV.chainA].before[0]).toMatchObject({ code: 'xxx', count: 1, speciesKey: 'Gamma Bird' })
    expect(idx.events[EV.chainA].after[1].count).toBe(0)
  })

  it('a name matched through tier 2 alone still lands (no sci match, common name only)', () => {
    const idx = buildTaxonomyHistoryIndex([obs('Gamma Bird', '2022-01-01', 'Nulla nulla')], HISTORY, { codes: {} })
    expect(idx.events[EV.chainA].after[1]).toMatchObject({ code: 'zzz', count: 1 })
  })

  it('a name matching nothing is not affected', () => {
    const idx = buildTaxonomyHistoryIndex([obs('Nowhere Bird', '2022-01-01', 'Nulla nulla')], HISTORY, { codes: {} })
    expect(idx.affected.size).toBe(0)
  })

  it('a code that fails the species-code shape, or an inherited member, is no code', () => {
    const codes = Object.assign(Object.create(null), { 'Western Warbling Vireo': 'NOT A CODE' }) as Record<string, string>
    const idx = buildTaxonomyHistoryIndex([obs('Western Warbling Vireo', '2026-01-01', 'Vireo swainsoni')], HISTORY, { codes })
    // Falls through to tier 2, which finds it by its names.
    expect(idx.events[EV.warbling].after[1].count).toBe(1)
    const proto = buildTaxonomyHistoryIndex([obs('constructor', '2026-01-01', 'Nulla nulla')], HISTORY, { codes: {} })
    expect(proto.affected.size).toBe(0)
  })

  it('the kept-name split cannot be told from a current export (schema.md 6.2 stated limit)', () => {
    const idx = buildTaxonomyHistoryIndex(
      [obs("Cory's Shearwater", '2020-07-01', 'Calonectris diomedea')], HISTORY,
      { codes: { "Cory's Shearwater": 'scoshe1' } },
    )
    const ev = idx.events[EV.corys]
    expect(ev.before[0].count).toBe(0)
    expect(ev.after[1]).toMatchObject({ code: 'scoshe1', count: 1, onOrBefore: 1 })
    expect(ev.predates).toBe(false)
  })
})

describe('forms, non-countables and the slash exception (FR-08; QA-08)', () => {
  const rows = [
    obs('Redpoll (Common)', '2025-01-01', 'Acanthis flammea flammea'),
    obs('Redpoll (Hoary)', '2025-01-02', 'Acanthis flammea hornemanni'),
    obs('Redpoll', '2025-01-03', 'Acanthis flammea'),
    obs('Redpoll x Siskin (hybrid)', '2025-01-04', 'Acanthis x Spinus'),
    obs('redpoll sp.', '2025-01-05', 'Acanthis sp.'),
    obs('Eastern/Western Warbling Vireo', '2026-01-01', 'Vireo gilvus/swainsoni'),
    obs('Eastern Warbling Vireo', '2026-01-02', 'Vireo gilvus'),
  ]
  const idx = buildTaxonomyHistoryIndex(rows, HISTORY, { codes: CURRENT_CODES })

  it('subspecies groups and forms roll up to their species', () => {
    expect(idx.events[EV.redpoll].after[0]).toMatchObject({ count: 3, speciesKey: 'Redpoll' })
  })

  it('a hybrid and a spuh count nowhere', () => {
    const total = idx.events.flatMap(e => [...e.before, ...e.after, ...e.slashes]).reduce((s, x) => s + x.count, 0)
    expect(total).toBe(5) // 3 redpolls, 1 slash, 1 Eastern Warbling Vireo
  })

  it('a row exactly named as the event\'s slash counts on the slash and nowhere else', () => {
    const ev = idx.events[EV.warbling]
    expect(ev.slashes).toHaveLength(1)
    expect(ev.slashes[0]).toMatchObject({ code: 'warvir', count: 1, speciesKey: null })
    expect(ev.after[0].count).toBe(1)
    expect(ev.before[0].count).toBe(0)
  })

  it('a slash the user holds no rows under is not shown (FR-14)', () => {
    const none = buildTaxonomyHistoryIndex([obs('Eastern Warbling Vireo', '2026-01-02', 'Vireo gilvus')], HISTORY, { codes: CURRENT_CODES })
    expect(none.events[EV.warbling].slashes).toEqual([])
  })
})

describe('counts and the date partition (FR-16; QA-16)', () => {
  const rows = [
    obs('Eastern Warbling Vireo', '2025-10-30', 'Vireo gilvus'),
    obs('Eastern Warbling Vireo', '2025-10-31', 'Vireo gilvus'), // the published day: on or before
    obs('Eastern Warbling Vireo', '2025-11-01', 'Vireo gilvus'), // one day after
    obs('Eastern Warbling Vireo (Eastern)', '2026-04-01', 'Vireo gilvus gilvus'),
  ]
  const e = buildTaxonomyHistoryIndex(rows, HISTORY, { codes: CURRENT_CODES }).events[EV.warbling].after[0]

  it('counts every matching row once and partitions on the published day', () => {
    expect(e).toMatchObject({ count: 4, onOrBefore: 2, after: 2 })
  })

  it('the two partitions sum to the count for every entry', () => {
    const idx = buildTaxonomyHistoryIndex(rows, HISTORY, { codes: CURRENT_CODES })
    for (const ev of idx.events) for (const x of [...ev.before, ...ev.after, ...ev.slashes]) {
      expect(x.onOrBefore + x.after).toBe(x.count)
    }
  })

  it('an entry nobody recorded carries count 0 and no species key (FR-18)', () => {
    const idx = buildTaxonomyHistoryIndex(rows, HISTORY, { codes: CURRENT_CODES })
    expect(idx.events[EV.warbling].after[1]).toMatchObject({ count: 0, onOrBefore: 0, after: 0, speciesKey: null })
  })

  it('a lump where the user holds rows under two before names counts each (FR-19)', () => {
    const idx = buildTaxonomyHistoryIndex(
      [obs('Common Redpoll', '2023-01-01', 'Acanthis flammea'), obs('Hoary Redpoll', '2023-01-02', 'Acanthis hornemanni'),
        obs('Hoary Redpoll', '2023-01-03', 'Acanthis hornemanni')],
      HISTORY, { codes: { 'Common Redpoll': 'redpol1' } },
    )
    const ev = idx.events[EV.redpoll]
    expect(ev.before.map(b => b.count)).toEqual([1, 2])
    expect(ev.predates).toBe(true)
    expect([...idx.affected.keys()]).toEqual(['Common Redpoll', 'Hoary Redpoll'])
  })
})

describe('the chain and the list (FR-03, FR-11, FR-15; QA-03, QA-11, QA-15)', () => {
  const idx = buildTaxonomyHistoryIndex(
    [obs('Vee Bird', '2025-03-01', 'Genus beta'), obs('Gamma Bird', '2025-03-01', 'Genus gamma'),
      obs('Western Warbling Vireo', '2026-01-01', 'Vireo swainsoni')],
    HISTORY, { codes: CURRENT_CODES },
  )

  it('a species sees every event on its own line of descent, earliest first, marking which it matched (FR-15)', () => {
    // Vee Bird came from Beta Bird (the lump), which came from Alpha Bird (the
    // split): two real events on one line, stacked earliest first.
    expect(lineageFor(idx, 'Vee Bird')?.events).toEqual([
      { eventIndex: EV.chainA, kind: 'split', year: 2023, direct: false },
      { eventIndex: EV.chainB, kind: 'lump', year: 2024, direct: true },
    ])
  })

  it('a daughter never inherits a sibling\'s later change (FR-11, FR-15; QA fix 1)', () => {
    // Gamma Bird is Beta Bird's SIBLING: the 2024 lump took Beta Bird, never
    // Gamma Bird, so Gamma Bird's line is the 2023 split alone. (This row
    // asserted the opposite before the fix, after schema.md 6.5's wording.)
    expect(lineageFor(idx, 'Gamma Bird')?.events.map(e => [e.eventIndex, e.direct])).toEqual([
      [EV.chainA, true],
    ])
  })

  it('a lump co-parent never inherits its partner\'s earlier split', () => {
    // A pre-lump export holding only Delta Bird: its line is the 2024 lump
    // alone. The 2023 split produced Beta Bird, Delta Bird's partner, not it.
    const pre = buildTaxonomyHistoryIndex([obs('Delta Bird', '2024-01-01', 'Genus delta')], HISTORY, { codes: {} })
    expect(lineageFor(pre, 'Delta Bird')?.events.map(e => [e.eventIndex, e.direct])).toEqual([[EV.chainB, true]])
  })

  it('a pre-split export follows its reports forward through the daughters\' later changes', () => {
    // Alpha Bird's reports went to Beta Bird and Gamma Bird, and Beta Bird was
    // then lumped: both events are on Alpha Bird's line.
    const pre = buildTaxonomyHistoryIndex([obs('Alpha Bird', '2022-01-01', 'Genus alpha')], HISTORY, { codes: {} })
    expect(lineageFor(pre, 'Alpha Bird')?.events.map(e => [e.eventIndex, e.direct])).toEqual([
      [EV.chainA, true], [EV.chainB, false],
    ])
  })

  it('the Palawan Crow shape: a kept-code sibling\'s second split is not the daughter\'s (QA fix 1 regression)', () => {
    // The real asset's case: 2023 splits Slender-billed Crow into itself (kept
    // code) and Palawan Crow; 2024 splits the kept Slender-billed Crow again.
    // A backup holding only Palawan Crow must list the 2023 split alone.
    const U2023b = { year: 2023, published: '2023-10-24' }
    const crows: TaxonomyHistory = {
      ...HISTORY,
      updates: [U2023b, U2024],
      coverage: { earliest: U2023b, latest: U2024 },
      events: [
        {
          kind: 'split', ...U2023b,
          before: [{ code: 'slbcro1', sci: 'Corvus enca', com: 'Slender-billed Crow', retired: false }],
          after: [
            { code: 'slbcro1', sci: 'Corvus enca', com: 'Slender-billed Crow' },
            { code: 'palcro2', sci: 'Corvus pusillus', com: 'Palawan Crow' },
          ],
          slashes: [],
        },
        {
          kind: 'split', ...U2024,
          before: [{ code: 'slbcro1', sci: 'Corvus enca', com: 'Slender-billed Crow', retired: true }],
          after: [
            { code: 'sucro1', sci: 'Corvus compilator', com: 'Sunda Crow' },
            { code: 'sulcro2', sci: 'Corvus celebensis', com: 'Sulawesi Crow' },
          ],
          slashes: [],
        },
      ],
    }
    const only = buildTaxonomyHistoryIndex([obs('Palawan Crow', '2025-02-01', 'Corvus pusillus')], crows, { codes: { 'Palawan Crow': 'palcro2' } })
    expect(lineageFor(only, 'Palawan Crow')?.events.map(e => [e.eventIndex, e.year, e.direct])).toEqual([[0, 2023, true]])
    expect(historyListEntries(only, ['Palawan Crow'])).toEqual([
      { species: 'Palawan Crow', events: [{ kind: 'split', year: 2023 }] },
    ])
    // The line that DID run through both: a Sunda Crow backup sees 2023 then 2024.
    const sunda = buildTaxonomyHistoryIndex([obs('Sunda Crow', '2025-02-01', 'Corvus compilator')], crows, { codes: { 'Sunda Crow': 'sucro1' } })
    expect(lineageFor(sunda, 'Sunda Crow')?.events.map(e => [e.eventIndex, e.direct])).toEqual([[0, false], [1, true]])
  })

  it('an unaffected or absent key has no lineage', () => {
    expect(lineageFor(idx, 'American Robin')).toBeNull()
    expect(lineageFor(idx, null)).toBeNull()
  })

  it('the list follows the selector order and shows each species\' events most recent first', () => {
    const order = ['Western Warbling Vireo', 'American Robin', 'Gamma Bird', 'Vee Bird']
    expect(historyListEntries(idx, order)).toEqual([
      { species: 'Western Warbling Vireo', events: [{ kind: 'split', year: 2025 }] },
      { species: 'Gamma Bird', events: [{ kind: 'split', year: 2023 }] },
      { species: 'Vee Bird', events: [{ kind: 'lump', year: 2024 }, { kind: 'split', year: 2023 }] },
    ])
  })

  it('an empty asset yields no affected species and null coverage (FR-20)', () => {
    const empty = buildTaxonomyHistoryIndex([obs('Vee Bird', '2025-03-01')], { ...HISTORY, updates: [], coverage: null, events: [] }, { codes: {} })
    expect(empty.affected.size).toBe(0)
    expect(empty.coverage).toBeNull()
  })
})

describe('a name current after one update and retired at the next (QA fix errand 2; FR-16, FR-18, FR-19)', () => {
  // An export made BETWEEN two covered updates carries a name the earlier one
  // created and the later one retired. Such a row is an after-side row at the
  // earlier update and predates only the later one.
  const view = (idx: ReturnType<typeof buildTaxonomyHistoryIndex>, e: number) => idx.events[e]

  it('the fixture chain: Beta Bird, created in 2023 and lumped in 2024', () => {
    const idx = buildTaxonomyHistoryIndex(
      [obs('Beta Bird', '2023-06-01', 'Genus beta'), obs('Beta Bird', '2024-03-01', 'Genus beta')],
      HISTORY, { codes: {} },
    )
    const a = view(idx, EV.chainA)
    expect(a.after[0]).toMatchObject({ code: 'yyy', count: 2, onOrBefore: 1, after: 1, speciesKey: 'Beta Bird' })
    expect(a.before[0].count).toBe(0)
    expect(a.predates).toBe(false)
    const b = view(idx, EV.chainB)
    expect(b.before[1]).toMatchObject({ code: 'yyy', count: 2, onOrBefore: 2, after: 0, speciesKey: 'Beta Bird' })
    expect(b.predates).toBe(true)
    expect(lineageFor(idx, 'Beta Bird')?.events.map(e => [e.eventIndex, e.direct])).toEqual([[EV.chainA, true], [EV.chainB, true]])
  })

  const U2023b = { year: 2023, published: '2023-10-24' }
  const history = (events: HistoryEvent[]): TaxonomyHistory => ({
    ...HISTORY, updates: [U2023b, U2024], coverage: { earliest: U2023b, latest: U2024 }, events,
  })

  it('the Macquarie Parakeet shape: a 2023 daughter lumped in 2024 counts on BOTH events', () => {
    const parakeets = history([
      {
        kind: 'split', ...U2023b,
        before: [{ code: 'refpar4', sci: 'Cyanoramphus novaezelandiae', com: 'Red-crowned Parakeet', retired: false }],
        after: [
          { code: 'refpar4', sci: 'Cyanoramphus novaezelandiae', com: 'Red-crowned Parakeet' },
          { code: 'recpar23', sci: 'Cyanoramphus erythrotis', com: 'Macquarie Parakeet' },
        ],
        slashes: [],
      },
      {
        kind: 'lump', ...U2024,
        before: [
          { code: 'refpar4', sci: 'Cyanoramphus novaezelandiae', com: 'Red-crowned Parakeet', retired: false },
          { code: 'recpar23', sci: 'Cyanoramphus erythrotis', com: 'Macquarie Parakeet', retired: true },
        ],
        after: [{ code: 'refpar4', sci: 'Cyanoramphus novaezelandiae', com: 'Red-crowned Parakeet' }],
        slashes: [],
      },
    ])
    const idx = buildTaxonomyHistoryIndex([obs('Macquarie Parakeet', '2023-01-01', 'Cyanoramphus erythrotis')], parakeets, { codes: {} })
    // 2023: eBird reassigned this January 2023 report to Macquarie Parakeet.
    expect(idx.events[0].after[1]).toMatchObject({ count: 1, onOrBefore: 1, after: 0, speciesKey: 'Macquarie Parakeet' })
    expect(idx.events[0].predates).toBe(false)
    // 2024: the export predates the lump.
    expect(idx.events[1].before[1]).toMatchObject({ count: 1, onOrBefore: 1, speciesKey: 'Macquarie Parakeet' })
    expect(idx.events[1].predates).toBe(true)
    // One entry per event: the row is counted once on each, never twice on one.
    for (const ev of idx.events) {
      expect([...ev.before, ...ev.after].reduce((s, x) => s + x.count, 0)).toBe(1)
    }
    // Site marks (security review L1): the 2024 lump retired recpar23, so the
    // 2023 Macquarie Parakeet node is not current although it is a recorded,
    // linkable species here; refpar4 is KEPT by the lump (on both of its sides),
    // so it stays current on both events. No before entry is ever current.
    expect(idx.events[0].after.map(a => [a.code, a.current])).toEqual([['refpar4', true], ['recpar23', false]])
    expect(idx.events[1].after.map(a => [a.code, a.current])).toEqual([['refpar4', true]])
    for (const ev of idx.events) for (const b of ev.before) expect(b.current).toBe(false)
  })

  const crows = history([
    {
      kind: 'split', ...U2023b,
      // eBird kept the name and code, and the 2024 split later retired both.
      before: [{ code: 'slbcro1', sci: 'Corvus enca', com: 'Slender-billed Crow', retired: true }],
      after: [
        { code: 'slbcro1', sci: 'Corvus enca', com: 'Slender-billed Crow' },
        { code: 'slbcro7', sci: 'Corvus pusillus', com: 'Palawan Crow' },
      ],
      slashes: [],
    },
    {
      kind: 'split', ...U2024,
      before: [{ code: 'slbcro1', sci: 'Corvus enca', com: 'Slender-billed Crow', retired: true }],
      after: [
        { code: 'slbcro2', sci: 'Corvus compilator', com: 'Sunda Crow' },
        { code: 'slbcro12', sci: 'Corvus celebensis', com: 'Sulawesi Crow' },
      ],
      slashes: [],
    },
  ])

  it('the Slender-billed Crow shape (a kept name): a March 2024 report is recorded since 2023 and predates only 2024', () => {
    const idx = buildTaxonomyHistoryIndex([obs('Slender-billed Crow', '2024-03-01', 'Corvus enca')], crows, { codes: {} })
    const [s2023, s2024] = idx.events
    expect(s2023.before[0].count).toBe(0)
    expect(s2023.after[0]).toMatchObject({ code: 'slbcro1', count: 1, onOrBefore: 0, after: 1, speciesKey: 'Slender-billed Crow' })
    expect(s2023.predates).toBe(false)
    expect(s2024.before[0]).toMatchObject({ count: 1, onOrBefore: 1, after: 0, speciesKey: 'Slender-billed Crow' })
    expect(s2024.predates).toBe(true)
    // The kept slbcro1 is retired by the 2024 split, so its 2023 node carries no
    // site marks; Palawan Crow and the 2024 daughters are current.
    expect(s2023.after.map(a => [a.code, a.current])).toEqual([['slbcro1', false], ['slbcro7', true]])
    expect(s2024.after.every(a => a.current)).toBe(true)
  })

  it('the same with the sibling present: Palawan Crow stays on its own entry, the 2023 event is not predating', () => {
    const idx = buildTaxonomyHistoryIndex(
      [obs('Slender-billed Crow', '2024-03-01', 'Corvus enca'), obs('Palawan Crow', '2024-04-01', 'Corvus pusillus')],
      crows, { codes: { 'Palawan Crow': 'slbcro7' } },
    )
    const [s2023, s2024] = idx.events
    expect(s2023.before[0].count).toBe(0)
    expect(s2023.after.map(a => a.count)).toEqual([1, 1])
    expect(s2023.predates).toBe(false)
    expect(s2024.predates).toBe(true)
  })

  it('a renamed chained entry is matched by code: an export\'s "South Papuan Pitta" lands on the 2023 entry now called Papuan Pitta', () => {
    const pittas = history([
      {
        kind: 'split', ...U2023b,
        before: [{ code: 'pappit1', sci: 'Erythropitta macklotii', com: 'Papuan Pitta', retired: false }],
        after: [
          { code: 'pappit2', sci: 'Erythropitta habenichti', com: 'North Papuan Pitta' },
          { code: 'pappit1', sci: 'Erythropitta macklotii', com: 'Papuan Pitta' },
        ],
        slashes: [],
      },
      {
        kind: 'lump', ...U2024,
        before: [
          { code: 'pappit2', sci: 'Erythropitta habenichti', com: 'North Papuan Pitta', retired: true },
          { code: 'pappit1', sci: 'Erythropitta macklotii', com: 'South Papuan Pitta', retired: true },
        ],
        after: [{ code: 'pappit1', sci: 'Erythropitta macklotii', com: 'Papuan Pitta' }],
        slashes: [],
      },
    ])
    const idx = buildTaxonomyHistoryIndex(
      [obs('South Papuan Pitta', '2024-01-01', 'Erythropitta macklotii'), obs('North Papuan Pitta', '2024-01-02', 'Erythropitta habenichti')],
      pittas, { codes: { 'South Papuan Pitta': 'pappit1' } },
    )
    expect(idx.events[0].after.map(a => [a.code, a.count, a.after])).toEqual([['pappit2', 1, 1], ['pappit1', 1, 1]])
    expect(idx.events[0].before[0].count).toBe(0)
    expect(idx.events[0].predates).toBe(false)
    expect(idx.events[1].before.map(b => [b.code, b.count, b.onOrBefore])).toEqual([['pappit2', 1, 1], ['pappit1', 1, 1]])
    expect(idx.events[1].predates).toBe(true)
  })
})

describe('the declared scan is linear (schema.md 6.6, security.md)', () => {
  // Timed through the REAL exported entry point at doubling input sizes, with
  // a same-run quotient (never a wall-clock ceiling): a linear pass grows about
  // 4x from N to 4N, a quadratic one about 16x. Best of several runs per size.
  const NAMES = ['Eastern Warbling Vireo', 'Redpoll (Common)', 'American Robin', 'Gamma Bird', 'Hoary Redpoll']
  const rowsOf = (n: number, name = (i: number) => `${NAMES[i % NAMES.length]}`, date = (i: number) => `2024-0${(i % 9) + 1}-15`) =>
    Array.from({ length: n }, (_, i) => obs(name(i), date(i), 'Vireo gilvus'))
  const best = (rows: ObservationEntry[], history: TaxonomyHistory = HISTORY, codes: Record<string, string> = CURRENT_CODES) => {
    let min = Infinity
    for (let r = 0; r < 5; r += 1) {
      const t0 = performance.now()
      buildTaxonomyHistoryIndex(rows, history, { codes })
      min = Math.min(min, performance.now() - t0)
    }
    return min
  }

  it('grows about 4x from 10k to 40k rows of the reference export shape', { timeout: 60_000 }, () => {
    const t10 = best(rowsOf(10_000))
    const t40 = best(rowsOf(40_000))
    expect(t40 / Math.max(t10, 0.05)).toBeLessThan(9)
  })

  it('grows about 4x on a hostile leg of 4,000-character names and dates', { timeout: 60_000 }, () => {
    const long = 'x'.repeat(4_000)
    const name = (i: number) => `${long}${i % 7}`
    const date = (i: number) => `${long}${i % 3}`
    const t5 = best(rowsOf(5_000, name, date))
    const t20 = best(rowsOf(20_000, name, date))
    expect(t20 / Math.max(t5, 0.05)).toBeLessThan(9)
  })

  it('grows about 4x when EVERY row is its own affected key, over the real asset (security review L2)', { timeout: 60_000 }, () => {
    // The two legs above hold 5 to 7 distinct names, so key resolution and the
    // per-key walks (midChainTier0, lineageEvents, the affected loop) run a
    // handful of times however large the input, and a quadratic in per-key work
    // would pass both. Here every row is its own key, every key is affected, and
    // each walks its line through the real asset's chain: half match "Corvus
    // enca" by scientific name (tier 2; the 2023 and 2024 crow splits), half are
    // case variants of the retired "Slender-billed Crow" (tier 0, so
    // midChainTier0 as well). The explicit timeout is only a backstop: the
    // assertion is the same-run quotient.
    const asset = ASSET_JSON as unknown as TaxonomyHistory
    const crow = 'Slender-billed Crow'
    const variant = (k: number): string => {
      let bit = 0
      let out = ''
      for (const ch of crow) {
        const letter = ch.toLowerCase() !== ch.toUpperCase()
        out += letter && ((k >> bit++) & 1) ? (ch === ch.toUpperCase() ? ch.toLowerCase() : ch.toUpperCase()) : ch
      }
      return out
    }
    const rows = (n: number) => Array.from({ length: n }, (_, i) =>
      obs(i % 2 === 0 ? `Corvid ${i}` : variant(i >> 1), `2024-0${(i % 9) + 1}-15`, 'Corvus enca'))
    const small = rows(10_000)
    const large = rows(40_000)
    // Non-vacuity: every row is its own key and every key is affected, with
    // both halves present.
    const idx = buildTaxonomyHistoryIndex(small, asset, { codes: {} })
    expect(idx.affected.size).toBe(10_000)
    expect(idx.affected.has('sLender-billed Crow')).toBe(true)
    expect(idx.affected.has('Corvid 0')).toBe(true)
    const t10 = best(small, asset, {})
    const t40 = best(large, asset, {})
    expect(t40 / Math.max(t10, 0.05)).toBeLessThan(9)
  })
})
