// The splits-and-lumps derivation (taxonomic-splits-lumps, schema.md section 6):
// the matching tiers (QA-06, QA-07, QA-19), form roll-up and the slash exception
// (QA-08), the per-entry tally and its date partition (QA-16), the chain
// (QA-03, QA-15), the list order (QA-11), and the declared scan's linearity
// (schema.md 6.6, security.md), measured through the real exported entry point.
//
// The fixture history is written here in the asset's own shape, with names as
// the eBird taxonomy prints them, so the rules are stated independently of
// whichever years the committed asset happens to cover.

/// <reference types="node" />
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import type { ObservationEntry } from '../types'
import {
  buildTaxonomyHistoryIndex, historyListEntries, lineageFor,
  type TaxonomyHistory, type HistoryEvent, type HistoryRename, type EventView,
} from './taxonomyHistory'
import { normalizeSpeciesName } from './speciesUtils'
import { bestPerCallCpuMs } from '../test/cpuTiming'
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
  v: 2, snapshot: 'T', generated: '2026-09-30', inputs: [],
  updates: [U2023, U2024, U2025],
  coverage: { earliest: U2023, latest: U2025 },
  events: [CHAIN_A, CORYS, CHAIN_B, REDPOLL, WARBLING],
  renames: [],
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

  it('a code eBird re-used is the later species: a current "Pilbara Grasswren" lands on the re-split, never as a pre-lump row (taxonomy-history-2019)', () => {
    // eBird lumped Pilbara and Sandhill Grasswren into Rufous Grasswren (2021)
    // and split them back out under their OLD codes (2024). The current code
    // strgra4 is the 2024 species; the 2021 before entry carries the same code.
    const grasswrens = history([
      {
        kind: 'lump', ...U2023b,
        before: [
          { code: 'strgra4', sci: 'Amytornis whitei', com: 'Pilbara Grasswren', retired: false },
          { code: 'sangra1', sci: 'Amytornis oweni', com: 'Sandhill Grasswren', retired: false },
        ],
        after: [{ code: 'rufgra1', sci: 'Amytornis whitei', com: 'Rufous Grasswren' }],
        slashes: [],
      },
      {
        kind: 'split', ...U2024,
        before: [{ code: 'rufgra1', sci: 'Amytornis whitei', com: 'Rufous Grasswren', retired: true }],
        after: [
          { code: 'strgra4', sci: 'Amytornis whitei', com: 'Pilbara Grasswren' },
          { code: 'sangra1', sci: 'Amytornis oweni', com: 'Sandhill Grasswren' },
        ],
        slashes: [],
      },
    ])
    const idx = buildTaxonomyHistoryIndex([obs('Pilbara Grasswren', '2025-06-01', 'Amytornis whitei')], grasswrens, { codes: { 'Pilbara Grasswren': 'strgra4' } })
    const [lump, split] = idx.events
    expect(split.after[0]).toMatchObject({ code: 'strgra4', count: 1, onOrBefore: 0, current: true })
    // Not a pre-lump row: the 2021 lump is no reassignment of this report and
    // does not say the backup predates it.
    expect(lump.before[0].count).toBe(0)
    expect(lump.predates).toBe(false)
    expect(split.predates).toBe(false)
    // The lump stays on the species' line, through Rufous Grasswren.
    expect(lineageFor(idx, 'Pilbara Grasswren')?.events.map(e => [e.eventIndex, e.direct])).toEqual([[0, false], [1, true]])
  })

  it('over the REAL asset, a backup holding every current species predates no update and puts no report on a before side (taxonomy-history-2019)', () => {
    // Every species in the bundled snapshot (tracked), as a December 2025
    // export carries it, with the codes the page's /taxonomy/codes batch
    // returns. Without the re-used-code skip above this reads two false
    // "predates" (2019's Chestnut-naped Francolin split, 2021's grasswren lump)
    // and four before entries with reports (chnfra2, strgra4, sangra1, beelar1).
    const snap = JSON.parse(readFileSync(new URL('../assets/ebird-taxonomy.json', import.meta.url), 'utf8')) as {
      byCom: Record<string, string>; byCode: Record<string, string>; bySci: Record<string, string>
    }
    const sciOf = new Map(Object.entries(snap.bySci).map(([sci, code]) => [code, sci]))
    const codes: Record<string, string> = {}
    const rows = Object.values(snap.byCom).map(code => {
      const com = snap.byCode[code]
      const sci = sciOf.get(code) ?? ''
      codes[com] = code
      return obs(com, '2025-12-01', sci.charAt(0).toUpperCase() + sci.slice(1))
    })
    expect(rows.length, 'every species in the snapshot').toBe(Object.keys(snap.byCom).length)
    expect(rows.length).toBeGreaterThan(10_000)
    const asset = ASSET_JSON as unknown as TaxonomyHistory
    const idx = buildTaxonomyHistoryIndex(rows, asset, { codes })
    // Non-vacuity: the backup does reach the asset's after sides.
    expect(idx.events.some(e => e.after.some(a => a.count > 0))).toBe(true)
    const predates = idx.events.flatMap((e, i) => e.predates ? [`${e.kind} ${e.year} #${i}`] : [])
    const beforeHits = idx.events.flatMap(e => e.before.filter(b => b.count > 0).map(b => `${e.year} ${b.code}`))
    expect({ predates, beforeHits }).toEqual({ predates: [], beforeHits: [] })
  })
})

describe('the declared scan is linear (schema.md 6.6, security.md)', () => {
  // Timed through the REAL exported entry point at doubling input sizes, with
  // a same-run quotient (never a wall-clock ceiling): a linear pass grows about
  // 4x from N to 4N, a quadratic one about 16x. Since recorded-names-in-splits-
  // and-lumps each leg reads this process's CPU time through
  // test/cpuTiming.ts (testing.md v1.0.40), best of 5 interleaved rounds, with
  // every limit, input and leg of the wall-clock version unchanged.
  const NAMES = ['Eastern Warbling Vireo', 'Redpoll (Common)', 'American Robin', 'Gamma Bird', 'Hoary Redpoll']
  const rowsOf = (n: number, name = (i: number) => `${NAMES[i % NAMES.length]}`, date = (i: number) => `2024-0${(i % 9) + 1}-15`) =>
    Array.from({ length: n }, (_, i) => obs(name(i), date(i), 'Vireo gilvus'))
  const quotient = (small: ObservationEntry[], large: ObservationEntry[], history: TaxonomyHistory = HISTORY, codes: Record<string, string> = CURRENT_CODES) => {
    const { perCall: [s, l] } = bestPerCallCpuMs([
      () => buildTaxonomyHistoryIndex(small, history, { codes }),
      () => buildTaxonomyHistoryIndex(large, history, { codes }),
    ], { rounds: 5 })
    return l / Math.max(s, 0.05)
  }
  const asset = ASSET_JSON as unknown as TaxonomyHistory
  /** The k-th case variant of a name: each letter's case flipped by k's bits. */
  const variant = (name: string, k: number): string => {
    let bit = 0
    let out = ''
    for (const ch of name) {
      const letter = ch.toLowerCase() !== ch.toUpperCase()
      out += letter && ((k >> bit++) & 1) ? (ch === ch.toUpperCase() ? ch.toLowerCase() : ch.toUpperCase()) : ch
    }
    return out
  }

  it('grows about 4x from 10k to 40k rows of the reference export shape', { timeout: 60_000 }, () => {
    expect(quotient(rowsOf(10_000), rowsOf(40_000))).toBeLessThan(9)
  })

  it('grows about 4x on a hostile leg of 4,000-character names and dates', { timeout: 60_000 }, () => {
    const long = 'x'.repeat(4_000)
    const name = (i: number) => `${long}${i % 7}`
    const date = (i: number) => `${long}${i % 3}`
    expect(quotient(rowsOf(5_000, name, date), rowsOf(20_000, name, date))).toBeLessThan(9)
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
    const crow = 'Slender-billed Crow'
    const rows = (n: number) => Array.from({ length: n }, (_, i) =>
      obs(i % 2 === 0 ? `Corvid ${i}` : variant(crow, i >> 1), `2024-0${(i % 9) + 1}-15`, 'Corvus enca'))
    const small = rows(10_000)
    const large = rows(40_000)
    // Non-vacuity: every row is its own key and every key is affected, with
    // both halves present.
    const idx = buildTaxonomyHistoryIndex(small, asset, { codes: {} })
    expect(idx.affected.size).toBe(10_000)
    expect(idx.affected.has('sLender-billed Crow')).toBe(true)
    expect(idx.affected.has('Corvid 0')).toBe(true)
    expect(quotient(small, large, asset, {})).toBeLessThan(9)
  })

  it('grows about 4x when EVERY row carries a kept-form name, so the kept-form lookup hits on every row (recorded-names schema.md 10)', { timeout: 60_000 }, () => {
    const forms = asset.events.filter(e => e.kind === 'lump').flatMap(e => e.before.filter(b => b.form !== undefined).map(b => b.form as string))
    expect(forms.length).toBeGreaterThan(10)
    const rows = (n: number) => Array.from({ length: n }, (_, i) => obs(forms[i % forms.length], `20${10 + (i % 9)}-05-15`, 'Nulla nulla'))
    const small = rows(10_000)
    // Non-vacuity: the lookup does count rows under earlier names.
    const idx = buildTaxonomyHistoryIndex(small, asset, { codes: {} })
    expect(idx.events.some(e => e.kind === 'lump' && e.before.some(b => b.earlier.state === 'count' && b.earlier.n > 0))).toBe(true)
    expect(quotient(small, rows(40_000), asset, {})).toBeLessThan(9)
  })

  it('grows about 4x when every row is its own key through the rename paths: a retired earlier name (tier 0 and its forward rule) and a twice-renamed current name with no codes (the closure)', { timeout: 60_000 }, () => {
    const forward = asset.renames.find(r => r.before[0].retired && r.before[0].com.length >= 14
      && asset.events.some(e => e.published > r.published && e.before.some(b => b.code === r.before[0].code)))!
    const perCode = new Map<string, HistoryRename[]>()
    for (const r of asset.renames) perCode.set(r.after[0].code, [...(perCode.get(r.after[0].code) ?? []), r])
    const twice = [...perCode.values()].find(list => list.length > 1 && list[list.length - 1].after[0].com.length >= 14)!
    expect(forward, 'a retired earlier name a later split or lump carries forward').toBeTruthy()
    expect(twice, 'a code renamed twice').toBeTruthy()
    const twiceName = twice[twice.length - 1].after[0].com
    const rows = (n: number) => Array.from({ length: n }, (_, i) =>
      obs(variant(i % 2 === 0 ? forward.before[0].com : twiceName, i >> 1), `2015-0${(i % 9) + 1}-15`, 'Nulla nulla'))
    const small = rows(10_000)
    // Non-vacuity: every row is its own affected key, both halves present, the
    // forward rule reached its later event and the closure both renames.
    const idx = buildTaxonomyHistoryIndex(small, asset, { codes: {} })
    expect(idx.affected.size).toBe(10_000)
    expect(idx.affected.has(forward.before[0].com)).toBe(true)
    expect(idx.affected.has(twiceName)).toBe(true)
    const firstOfTwice = idx.events.find(e => e.kind === 'rename' && e.published === twice[0].published && e.after[0].code === twice[0].after[0].code)!
    expect(firstOfTwice.after[0].count).toBeGreaterThan(0)
    expect(quotient(small, rows(40_000), asset, {})).toBeLessThan(9)
  })

  it('a common name that is a prototype member is an ordinary miss: no throw, not affected', () => {
    const rows = ['__proto__', 'constructor', 'toString', 'hasOwnProperty'].map(n => obs(n, '2024-01-01', n))
    for (const codes of [{}, CURRENT_CODES]) {
      const idx = buildTaxonomyHistoryIndex(rows, asset, { codes })
      expect(idx.affected.size).toBe(0)
    }
  })
})

// ── Recorded names: earlier-name figures and renames (recorded-names-in-
// splits-and-lumps, schema.md 6 and 7; QA-08 to QA-24, QA-44, QA-45) ─────────
//
// A fixture in the record's own shape, with names as eBird prints them. The
// figures are hand counts over rows written here; nothing reads the real
// backup. The structural sweeps over the committed record follow it.

const U2019 = { year: 2019, published: '2019-08-21' }
const U2021 = { year: 2021, published: '2021-09-08' }
const RN_UPDATES = [U2019, U2021, U2023, U2024, U2025]

const R_WHIMBREL: HistoryEvent = {
  kind: 'split', ...U2025,
  before: [{ code: 'whimbr', sci: 'Numenius phaeopus', com: 'Whimbrel', retired: true }],
  after: [
    { code: 'hudwhi1', sci: 'Numenius hudsonicus', com: 'Hudsonian Whimbrel' },
    { code: 'whimbr3', sci: 'Numenius phaeopus', com: 'Eurasian Whimbrel' },
  ],
  slashes: [{ code: 'whimbr4', sci: 'Numenius hudsonicus/phaeopus', com: 'Hudsonian/Eurasian Whimbrel' }],
}
const R_WESFLY: HistoryEvent = {
  kind: 'lump', ...U2023,
  before: [
    { code: 'pasfly', sci: 'Empidonax difficilis', com: 'Pacific-slope Flycatcher', retired: true, form: 'Western Flycatcher (Pacific-slope)' },
    { code: 'corfly', sci: 'Empidonax occidentalis', com: 'Cordilleran Flycatcher', retired: true, form: 'Western Flycatcher (Cordilleran)' },
  ],
  after: [{ code: 'wesfly', sci: 'Empidonax difficilis', com: 'Western Flycatcher' }],
  slashes: [],
}
const R_CROW: HistoryEvent = {
  kind: 'lump', ...U2021,
  before: [
    { code: 'amecro', sci: 'Corvus brachyrhynchos', com: 'American Crow', retired: false },
    { code: 'norcro', sci: 'Corvus caurinus', com: 'Northwestern Crow', retired: true },
  ],
  after: [{ code: 'amecro', sci: 'Corvus brachyrhynchos', com: 'American Crow' }],
  slashes: [],
}
const R_TROGON: HistoryEvent = {
  kind: 'lump', ...U2019,
  before: [
    { code: 'coltro1', sci: 'Trogon collaris', com: 'Collared Trogon', retired: false },
    { code: 'orbtro2', sci: 'Trogon aurantiiventris', com: 'Orange-bellied Trogon', retired: true, form: 'Collared Trogon (Orange-bellied)' },
  ],
  after: [{ code: 'coltro1', sci: 'Trogon collaris', com: 'Collared Trogon' }],
  slashes: [],
}
// A split whose daughter is later renamed (QA-12), and a rename whose code is
// later split (QA-45).
const R_SPLIT_B: HistoryEvent = {
  kind: 'split', ...U2021,
  before: [{ code: 'alpbir', sci: 'Genus alpha', com: 'Alpha Bird', retired: true }],
  after: [{ code: 'betbir', sci: 'Genus beta', com: 'Beta Finch' }, { code: 'gambir', sci: 'Genus gamma', com: 'Gamma Bird' }],
  slashes: [],
}
const R_OWL_SPLIT: HistoryEvent = {
  kind: 'split', ...U2024,
  before: [{ code: 'greowl', sci: 'Bubo magnus', com: 'Great Owl', retired: false }],
  after: [{ code: 'greowl', sci: 'Bubo magnus', com: 'Great Owl' }, { code: 'parowl', sci: 'Bubo paramensis', com: 'Paramo Owl' }],
  slashes: [],
}
const rename = (u: { year: number; published: string }, code: string, sci: string, from: string, to: string, retired = true): HistoryRename => ({
  kind: 'rename', ...u,
  before: [{ code, sci, com: from, retired }],
  after: [{ code, sci, com: to }],
  slashes: [],
})
const R_LONGSPUR = rename(U2021, 'mcclon', 'Rhynchophanes mccownii', "McCown's Longspur", 'Thick-billed Longspur')
const R_BETA = rename(U2025, 'betbir', 'Genus beta', 'Beta Bird', 'Beta Finch')
const R_OWL = rename(U2021, 'greowl', 'Bubo magnus', 'Old Owl', 'Great Owl')
const R_ASH_1 = rename(U2023, 'ashbir', 'Genus ash', 'Ash Bird', 'Ashy Bird')
const R_ASH_2 = rename(U2025, 'ashbir', 'Genus ash', 'Ashy Bird', 'Ashen Bird')
// Two names exchanged by two renames in one update (St. Helena's crake and rail
// shape): each earlier name is now the OTHER species' current name, so neither
// is retired, and a report under either is that other species (FR-09).
const R_SWAP_1 = rename(U2023, 'hecrak', 'Zapornia astrictocarpus', 'Helena Crake', 'Helena Rail', false)
const R_SWAP_2 = rename(U2023, 'herail', 'Aphanocrex podarces', 'Helena Rail', 'Helena Crake', false)

const RN: TaxonomyHistory = {
  v: 2, snapshot: 'T', generated: '2026-11-19', inputs: [],
  updates: RN_UPDATES, coverage: { earliest: U2019, latest: U2025 },
  events: [R_TROGON, R_CROW, R_SPLIT_B, R_WESFLY, R_OWL_SPLIT, R_WHIMBREL],
  renames: [R_LONGSPUR, R_OWL, R_SWAP_2, R_SWAP_1, R_ASH_1, R_ASH_2, R_BETA]
    .sort((a, b) => (a.published < b.published ? -1 : a.published > b.published ? 1 : a.before[0].sci < b.before[0].sci ? -1 : 1)),
}
const RN_CODES: Record<string, string> = {
  'Hudsonian Whimbrel': 'hudwhi1', 'Eurasian Whimbrel': 'whimbr3', 'Western Flycatcher': 'wesfly', 'American Crow': 'amecro',
  'Collared Trogon': 'coltro1', 'Thick-billed Longspur': 'mcclon', 'Beta Finch': 'betbir', 'Gamma Bird': 'gambir',
  'Great Owl': 'greowl', 'Paramo Owl': 'parowl', 'Ashen Bird': 'ashbir', 'Helena Rail': 'hecrak', 'Helena Crake': 'herail',
}
/** The merged event of one kind, year and first code. */
function find(idx: ReturnType<typeof buildTaxonomyHistoryIndex>, kind: string, year: number, code: string): EventView {
  const ev = idx.events.find(e => e.kind === kind && e.year === year && (e.before[0].code === code || e.after[0].code === code))
  expect(ev, `${kind} ${year} ${code}`).toBeTruthy()
  return ev!
}
const rows = (spec: [name: string, date: string, n?: number][]): ObservationEntry[] =>
  spec.flatMap(([name, date, n = 1]) => Array.from({ length: n }, () => obs(name, date, 'Nulla nulla')))

describe('the record as one dated list (schema.md 6.1)', () => {
  it('merges renames among splits and lumps by date, splits and lumps first on a tie, and the list kinds follow', () => {
    const idx = buildTaxonomyHistoryIndex([], RN, { codes: {} })
    expect(idx.events.map(e => `${e.year}${e.kind[0]}`)).toEqual([
      '2019l', '2021l', '2021s', '2021r', '2021r', '2023l', '2023r', '2023r', '2023r', '2024s', '2025s', '2025r', '2025r',
    ])
  })
})

describe('a split\'s earlier name (FR-13, FR-14; QA-13, QA-15, QA-21)', () => {
  it('counts the reassigned figures of every name it became, the slash included, the update day in and the next day out', () => {
    const idx = buildTaxonomyHistoryIndex(rows([
      ['Hudsonian Whimbrel', '2024-05-01', 2], ['Hudsonian Whimbrel', '2025-10-31'], ['Hudsonian Whimbrel', '2025-11-01'],
      ['Eurasian Whimbrel', '2020-05-01'], ['Hudsonian/Eurasian Whimbrel', '2025-01-01'],
      ['Hudsonian Whimbrel (Hudsonian)', '2024-06-01'], // a form of a new name counts with it (FR-14)
    ]), RN, { codes: RN_CODES })
    const ev = find(idx, 'split', 2025, 'whimbr')
    expect(ev.earlierState).toBe('counted')
    expect(ev.after.map(a => [a.count, a.onOrBefore])).toEqual([[5, 4], [1, 1]])
    expect(ev.slashes.map(x => x.onOrBefore)).toEqual([1])
    expect(ev.before[0].earlier).toEqual({ state: 'count', n: 6 })
    expect(ev.before[0].count).toBe(0)
  })

  it('with no reports under the slash the figure is the two shown figures, and no slash is drawn', () => {
    const idx = buildTaxonomyHistoryIndex(rows([['Hudsonian Whimbrel', '2024-05-01', 3]]), RN, { codes: RN_CODES })
    const ev = find(idx, 'split', 2025, 'whimbr')
    expect(ev.slashes).toEqual([])
    expect(ev.before[0].earlier).toEqual({ state: 'count', n: 3 })
  })

  it('shows the zero state when every report is dated after the update (FR-19)', () => {
    const idx = buildTaxonomyHistoryIndex(rows([['Hudsonian Whimbrel', '2026-01-01', 2]]), RN, { codes: RN_CODES })
    expect(find(idx, 'split', 2025, 'whimbr').before[0].earlier).toEqual({ state: 'count', n: 0 })
  })
})

describe('a rename (FR-08, FR-09, FR-15; QA-08, QA-09, QA-16)', () => {
  it('affects a species touched only by renames, lists it as a rename, and counts the current name\'s on-or-before figure', () => {
    const idx = buildTaxonomyHistoryIndex(rows([['Thick-billed Longspur', '2020-04-01', 3], ['Thick-billed Longspur', '2022-04-01']]), RN, { codes: RN_CODES })
    const ev = find(idx, 'rename', 2021, 'mcclon')
    expect(ev.after[0]).toMatchObject({ count: 4, onOrBefore: 3, after: 1, current: true })
    expect(ev.before[0].earlier).toEqual({ state: 'count', n: 3 })
    expect(ev.earlierState).toBe('counted')
    expect(historyListEntries(idx, ['Thick-billed Longspur'])).toEqual([{ species: 'Thick-billed Longspur', events: [{ kind: 'rename', year: 2021 }] }])
  })

  it('recognizes a retired earlier name in an older backup exactly as a split\'s, and reads the shipped predates state', () => {
    for (const codes of [RN_CODES, {}]) {
      const idx = buildTaxonomyHistoryIndex(rows([["McCown's Longspur", '2020-04-01', 2]]), RN, { codes })
      const ev = find(idx, 'rename', 2021, 'mcclon')
      expect(ev.before[0]).toMatchObject({ count: 2, speciesKey: "McCown's Longspur", earlier: { state: 'none' } })
      expect(ev.predates).toBe(true)
      expect(ev.earlierState).toBe('pre-update')
      expect(idx.affected.has("McCown's Longspur")).toBe(true)
    }
  })

  // FR-09's two halves, held by separate guards over separate paths, so each
  // owes its own row: tier 1 never reaches a rename's earlier name (its code is
  // on its own after side), and the name tiers never index it.
  const handedOn = (codes: Record<string, string>) => {
    const idx = buildTaxonomyHistoryIndex(rows([['Helena Crake', '2024-01-01']]), RN, { codes })
    const crakeToRail = find(idx, 'rename', 2023, 'hecrak')
    const railToCrake = find(idx, 'rename', 2023, 'herail')
    expect(crakeToRail.before[0].count, 'not an earlier-name report of the rename that retired the name').toBe(0)
    expect(railToCrake.before[0].count, 'nor of the other rename, by its code').toBe(0)
    expect(railToCrake.after[0].count, 'the species that holds the name now').toBe(1)
  }
  it('never counts a report under a name eBird has since given to another species as a rename\'s earlier name: with the codes lookup', () => {
    handedOn(RN_CODES)
  })
  it('and with no codes lookup (the name tiers)', () => {
    handedOn({})
  })

  it('a code renamed twice reads A to B then B to C, each on its own line; the name tiers reach both through the closure', () => {
    for (const codes of [RN_CODES, {}]) {
      const idx = buildTaxonomyHistoryIndex(rows([['Ashen Bird', '2020-01-01']]), RN, { codes })
      const first = find(idx, 'rename', 2023, 'ashbir')
      const second = find(idx, 'rename', 2025, 'ashbir')
      expect([first.after[0].count, second.after[0].count], JSON.stringify(codes)).toEqual([1, 1])
      expect([first.before[0].earlier, second.before[0].earlier]).toEqual([{ state: 'count', n: 1 }, { state: 'count', n: 1 }])
      // Only the latest rename's name carries the site marks (FR-27).
      expect([first.after[0].current, second.after[0].current]).toEqual([false, true])
      expect(lineageFor(idx, 'Ashen Bird')?.events.map(e => [e.kind, e.year])).toEqual([['rename', 2023], ['rename', 2025]])
    }
  })

  it('a backup older than the first of two renames shows the first predating and the second in its zero state (schema flag 11)', () => {
    const idx = buildTaxonomyHistoryIndex(rows([['Ash Bird', '2020-01-01']]), RN, { codes: {} })
    expect(find(idx, 'rename', 2023, 'ashbir').earlierState).toBe('pre-update')
    expect(find(idx, 'rename', 2025, 'ashbir').before[0].earlier).toEqual({ state: 'count', n: 0 })
  })
})

describe('a lump\'s earlier names (FR-16 to FR-18; QA-17, QA-18, QA-19)', () => {
  it('counts each traced name\'s kept-form reports dated on or before the lump, and the rest in "Earlier name not recorded"', () => {
    const idx = buildTaxonomyHistoryIndex(rows([
      ['Western Flycatcher (Pacific-slope)', '2022-05-01', 2], ['Western Flycatcher (Pacific-slope)', '2024-05-01'],
      ['Western Flycatcher (Cordilleran)', '2023-10-24'],
      ['Western Flycatcher', '2021-06-01', 2],
      ['Western Flycatcher (Pacific slope)', '2022-06-01'], // an out-of-date spelling of a kept form: not traced
    ]), RN, { codes: RN_CODES })
    const ev = find(idx, 'lump', 2023, 'wesfly')
    expect(ev.after[0]).toMatchObject({ count: 7, onOrBefore: 6 })
    expect(ev.before.map(b => [b.form, b.earlier])).toEqual([
      ['Western Flycatcher (Pacific-slope)', { state: 'count', n: 2 }],
      ['Western Flycatcher (Cordilleran)', { state: 'count', n: 1 }],
    ])
    expect(ev.residual).toBe(3)
  })

  it('with every pre-lump report under a kept form, the residual is zero and the box is not drawn', () => {
    const idx = buildTaxonomyHistoryIndex(rows([['Western Flycatcher (Cordilleran)', '2022-05-01', 2]]), RN, { codes: RN_CODES })
    expect(find(idx, 'lump', 2023, 'wesfly').residual).toBe(0)
  })

  it('a kept-form report tallied on another species is in no traced count (FR-16\'s after-entry test)', () => {
    const idx = buildTaxonomyHistoryIndex(rows([['Western Flycatcher (Pacific-slope)', '2022-05-01']]), RN, { codes: { 'Western Flycatcher': 'amecro' } })
    const ev = find(idx, 'lump', 2023, 'wesfly')
    expect(ev.before[0].earlier).toEqual({ state: 'count', n: 0 })
  })

  it('reads "not traceable" for both reasons, with no number and no residual, when no name is traced (American Crow)', () => {
    const idx = buildTaxonomyHistoryIndex(rows([['American Crow', '2020-03-01', 4]]), RN, { codes: RN_CODES })
    const ev = find(idx, 'lump', 2021, 'amecro')
    expect(ev.before.map(b => b.earlier)).toEqual([
      { state: 'untraceable', reason: 'survivor' },
      { state: 'untraceable', reason: 'no-form' },
    ])
    expect(ev.residual).toBe(0)
  })

  it('with one traced name and the surviving name, plain reports go to the residual, never to the surviving name (D-08)', () => {
    const idx = buildTaxonomyHistoryIndex(rows([
      ['Collared Trogon (Orange-bellied)', '2018-01-01'], ['Collared Trogon', '2018-02-01', 6], ['Collared Trogon', '2020-02-01'],
    ]), RN, { codes: RN_CODES })
    const ev = find(idx, 'lump', 2019, 'coltro1')
    expect(ev.before.map(b => b.earlier)).toEqual([{ state: 'untraceable', reason: 'survivor' }, { state: 'count', n: 1 }])
    expect(ev.residual).toBe(6)
  })
})

describe('the states that suppress the new figures (FR-20, FR-21; QA-22, QA-23, QA-45)', () => {
  it('a backup carrying only an earlier name shows the shipped figures alone, and counts no report twice', () => {
    const idx = buildTaxonomyHistoryIndex(rows([['Pacific-slope Flycatcher', '2022-01-01', 2]]), RN, { codes: RN_CODES })
    const ev = find(idx, 'lump', 2023, 'wesfly')
    expect(ev).toMatchObject({ earlierState: 'pre-update', predates: true, residual: 0 })
    expect(ev.before.map(b => [b.count, b.earlier.state])).toEqual([[2, 'none'], [0, 'none']])
  })

  it('the mixed case: an earlier name still carried beside the lumped name (a pre-2021 American Crow and Northwestern Crow)', () => {
    const idx = buildTaxonomyHistoryIndex(rows([['Northwestern Crow', '2019-05-01'], ['American Crow', '2019-05-01', 3]]), RN, { codes: RN_CODES })
    const ev = find(idx, 'lump', 2021, 'amecro')
    expect(ev).toMatchObject({ earlierState: 'pre-update', predates: false, residual: 0 })
    expect(ev.before.map(b => [b.code, b.count])).toEqual([['amecro', 0], ['norcro', 1]])
    expect(ev.after[0].count).toBe(3)
    expect(ev.before.every(b => b.earlier.state === 'none')).toBe(true)
  })

  it('a split whose new name a later split or lump changed shows the marker and keeps its current-side figures; the later event counts', () => {
    const idx = buildTaxonomyHistoryIndex(
      [obs('Beta Bird', '2022-06-01', 'Genus beta'), obs('Vee Bird', '2023-01-01', 'Genus beta')],
      HISTORY, { codes: CURRENT_CODES },
    )
    const a = idx.events[EV.chainA]
    expect(a).toMatchObject({ earlierState: 'later-changed', residual: 0 })
    expect(a.before[0].earlier).toEqual({ state: 'none' })
    expect(a.after[0].count).toBeGreaterThan(0)
    expect(idx.events[EV.chainB].earlierState).toBe('pre-update')
  })

  it('a rename whose code a later update split shows the marker; the later split shows its own figure (QA-45)', () => {
    const idx = buildTaxonomyHistoryIndex(rows([['Great Owl', '2020-01-01', 2]]), RN, { codes: RN_CODES })
    const r = find(idx, 'rename', 2021, 'greowl')
    const split = find(idx, 'split', 2024, 'greowl')
    expect(r).toMatchObject({ earlierState: 'later-changed' })
    expect(r.before[0].earlier).toEqual({ state: 'none' })
    expect(split.before[0].earlier).toEqual({ state: 'count', n: 2 })
    expect(lineageFor(idx, 'Great Owl')?.events.map(e => [e.kind, e.year])).toEqual([['rename', 2021], ['split', 2024]])
  })

  it('a split whose daughter a later update renamed is NOT later-changed: each line counts, the report once per event (QA-12)', () => {
    const idx = buildTaxonomyHistoryIndex(rows([['Beta Finch', '2020-01-01']]), RN, { codes: RN_CODES })
    const split = find(idx, 'split', 2021, 'alpbir')
    const r = find(idx, 'rename', 2025, 'betbir')
    expect([split.earlierState, r.earlierState]).toEqual(['counted', 'counted'])
    expect(split.before[0].earlier).toEqual({ state: 'count', n: 1 })
    expect(r.before[0].earlier).toEqual({ state: 'count', n: 1 })
    expect(historyListEntries(idx, ['Beta Finch'])[0].events).toEqual([{ kind: 'rename', year: 2025 }, { kind: 'split', year: 2021 }])
  })
})

// ── Structural sweeps over the committed record (schema.md 10) ──────────────

/** A backup generated from the record: two reports dated before every update
 *  and one after, under every current-side name and every kept form (section
 *  7's corpus). `skip` leaves names out. */
function recordCorpus(h: TaxonomyHistory, skip: ReadonlySet<string> = new Set()): ObservationEntry[] {
  const out: ObservationEntry[] = []
  const add = (com: string, sci: string) => {
    if (skip.has(com)) return
    out.push(obs(com, '2010-01-01', sci), obs(com, '2010-06-01', sci), obs(com, '2030-01-01', sci))
  }
  for (const ev of [...h.events, ...h.renames]) {
    for (const e of [...ev.after, ...ev.slashes]) add(e.com, e.sci)
    if (ev.kind === 'lump') for (const b of ev.before) if (b.form !== undefined) add(b.form, ev.after[0].sci)
  }
  return out
}

/** The page's `/taxonomy/codes` answer for a backup: each raw and normalized
 *  name that is a species name in the bundled snapshot. */
// The bundled snapshot's common-name map, read and parsed once for the file. It
// was re-read and re-parsed on every call, and the rename row below calls this
// once per retired name (about 500 times), which was most of its 10 s.
let snapshotByCom: { byCom: Record<string, string> } | null = null
function snapshotCodes(obsList: readonly ObservationEntry[]): Record<string, string> {
  const snap = snapshotByCom ??= JSON.parse(readFileSync(new URL('../assets/ebird-taxonomy.json', import.meta.url), 'utf8')) as { byCom: Record<string, string> }
  const c: Record<string, string> = {}
  for (const o of obsList) for (const n of [o.commonName, normalizeSpeciesName(o.commonName)]) {
    if (Object.hasOwn(snap.byCom, n.toLowerCase())) c[n] = snap.byCom[n.toLowerCase()]
  }
  return c
}

describe('the identities hold over the whole committed record (FR-13, FR-15, FR-17; schema.md 7)', () => {
  const asset = ASSET_JSON as unknown as TaxonomyHistory
  const corpus = recordCorpus(asset)
  for (const [label, codes] of [['with no codes lookup', {}], ['with the page\'s codes lookup', snapshotCodes(corpus)]] as const) {
    it(label, () => {
      expect(Object.keys(codes).length > 0, label).toBe(label.includes('page'))
      const idx = buildTaxonomyHistoryIndex(corpus, asset, { codes })
      const counted = { split: 0, lump: 0, rename: 0 }
      let residuals = 0
      let tracedAbove = 0
      const violations: string[] = []
      for (const ev of idx.events) {
        if (ev.earlierState !== 'counted') continue
        counted[ev.kind] += 1
        const shown = ev.after.reduce((t, a) => t + a.onOrBefore, 0) + ev.slashes.reduce((t, x) => t + x.onOrBefore, 0)
        if (ev.kind === 'split' && !(ev.before[0].earlier.state === 'count' && ev.before[0].earlier.n === shown)) violations.push(`split ${ev.year} ${ev.before[0].code}`)
        if (ev.kind === 'rename' && !(ev.before[0].earlier.state === 'count' && ev.before[0].earlier.n === ev.after[0].onOrBefore)) violations.push(`rename ${ev.year} ${ev.before[0].code}`)
        if (ev.kind === 'lump') {
          const traced = ev.before.flatMap(b => (b.earlier.state === 'count' ? [b.earlier.n] : []))
          if (traced.length > 0 && traced.reduce((t, n) => t + n, 0) + ev.residual !== ev.after[0].onOrBefore) violations.push(`lump ${ev.year} ${ev.after[0].code}`)
          if (traced.length === 0 && ev.residual !== 0) violations.push(`lump residual ${ev.after[0].code}`)
          if (ev.residual < 0) violations.push(`negative residual ${ev.after[0].code}`)
          if (ev.residual > 0) residuals += 1
          tracedAbove += traced.filter(n => n > 0).length
        }
      }
      expect(violations).toEqual([])
      // Non-vacuity: every kind reaches 'counted', some lump has a residual,
      // some traced name counts above zero.
      expect(counted.split).toBeGreaterThan(0)
      expect(counted.lump).toBeGreaterThan(0)
      expect(counted.rename).toBeGreaterThan(0)
      expect(residuals).toBeGreaterThan(0)
      expect(tracedAbove).toBeGreaterThan(0)
    })
  }
})

describe('renames leave every split and lump reading alone, but for a rename\'s retired earlier name (FR-20, D-10; QA-44)', () => {
  const asset = ASSET_JSON as unknown as TaxonomyHistory
  const bare: TaxonomyHistory = { ...asset, renames: [] }
  const retiredEarlier = new Set(asset.renames.filter(r => r.before[0].retired).map(r => r.before[0].com))
  const sl = (idx: ReturnType<typeof buildTaxonomyHistoryIndex>) => idx.events.filter(e => e.kind !== 'rename')
  const codesOf = snapshotCodes

  it('equality by removal: over the generated backup, with every retired earlier name of a rename left out, every split and lump view is the same with and without renames', () => {
    const corpus = recordCorpus(asset, retiredEarlier)
    for (const codes of [codesOf(corpus), {}]) {
      const a = sl(buildTaxonomyHistoryIndex(corpus, asset, { codes }))
      const b = sl(buildTaxonomyHistoryIndex(corpus, bare, { codes }))
      expect(a.length).toBe(asset.events.length)
      const diff = a.flatMap((ev, i) => (JSON.stringify(ev) === JSON.stringify(b[i]) ? [] : [`${ev.kind} ${ev.year} ${ev.before[0].code}`]))
      expect(diff).toEqual([])
    }
  })

  it('each retired earlier name of a rename moves only toward the export\'s true date: to the after side of an event it outlived, or to "predates" at an event after its rename', { timeout: 60_000 }, () => {
    let moved = 0
    const wrong: string[] = []
    for (const r of asset.renames) {
      const name = r.before[0].com
      if (!r.before[0].retired) continue
      const probe = [obs(name, '2026-07-01', r.before[0].sci)]
      for (const codes of [codesOf(probe), {}]) {
      const a = sl(buildTaxonomyHistoryIndex(probe, asset, { codes }))
      const b = sl(buildTaxonomyHistoryIndex(probe, bare, { codes }))
      a.forEach((ev, i) => {
        const was = b[i]
        const sides = (v: EventView) => ({ before: v.before.some(x => x.count > 0), after: v.after.some(x => x.count > 0) })
        const now = sides(ev)
        const then = sides(was)
        if (now.before === then.before && now.after === then.after) return
        moved += 1
        // On the after side now: the name was still current after this event.
        if (now.after && !then.after && !(ev.published < r.published)) wrong.push(`${name} after ${ev.year}`)
        // Predating now: the event came after the rename that retired the name.
        if (now.before && !then.before && !(ev.published > r.published)) wrong.push(`${name} before ${ev.year}`)
        // Never a reading lost outright (schema.md 6.3, "Narrowing: none").
        if (!now.before && !now.after) wrong.push(`${name} lost ${ev.year}`)
      })
      }
    }
    expect(wrong).toEqual([])
    expect(moved, 'some reading moves (schema.md 6.3)').toBeGreaterThan(0)
  })
})
