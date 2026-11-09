/// <reference types="node" />
// The escapee check's taxonomy join (escapee-check-new-taxonomy): every shape
// eBird's 2026 update produced resolves from an answer under a sibling code,
// and a current export is never cross-joined.
//
// Driven end to end through the real model and the real store: names resolve
// to codes the way both `/taxonomy/codes` transports do (scientific name, then
// common name, species only, against the bundled snapshot), the cover index is
// built with the join from the bundled history asset, and each answer goes
// through `mergeChecklist` exactly as the controller hands it over (`carried`
// and `standIns` from the index). Only the storage seam is faked.

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import type { ObservationEntry } from '../types'
import type { TaxonomyHistory } from './taxonomyHistory'
import {
  buildCoverIndex, buildProvenanceLookup, classifySpecies, remainingSpecies, NO_ESCAPEE_JOIN,
  type CoverIndex, type EscapeeJoin,
} from './exoticProvenance'
import { buildEscapeeJoin, loadEscapeeJoin, _resetEscapeeJoinForTests } from './exoticTaxonomyJoin'
import { normalizeSpeciesName } from './speciesUtils'

const seamDoc: { value: unknown } = { value: null }
vi.mock('./storage', () => ({
  storage: {
    getSetting: vi.fn(async () => seamDoc.value),
    setSetting: vi.fn(async (_key: string, value: unknown) => { seamDoc.value = JSON.parse(JSON.stringify(value)) }),
    deleteSetting: vi.fn(async () => { seamDoc.value = null }),
  },
}))

const cache = await import('./exoticProvenanceCache')

const HISTORY = JSON.parse(readFileSync(new URL('../assets/ebird-taxonomy-history.json', import.meta.url), 'utf8')) as TaxonomyHistory
const SNAPSHOT = JSON.parse(readFileSync(new URL('../assets/ebird-taxonomy.json', import.meta.url), 'utf8')) as {
  bySci: Record<string, string>; byCom: Record<string, string>
}
const JOIN = buildEscapeeJoin(HISTORY)
const LATEST = HISTORY.coverage!.latest.year

/** Both transports' species-only resolution: scientific name, then common name. */
function codeLikeTransports(com: string, sci: string): string | undefined {
  const s = sci.toLowerCase(), c = com.toLowerCase()
  return (Object.hasOwn(SNAPSHOT.bySci, s) ? SNAPSHOT.bySci[s] : undefined)
    ?? (Object.hasOwn(SNAPSHOT.byCom, c) ? SNAPSHOT.byCom[c] : undefined)
}

function row(commonName: string, scientificName: string, submissionId: string): ObservationEntry {
  return {
    commonName, scientificName, submissionId, count: 1, date: '2025-05-01',
    location: 'L', locationId: 'L1', latitude: null, longitude: null, county: null, stateProvince: 'US-CA',
  } as ObservationEntry
}

/** The cover index Statistics builds: each row's code resolved by the batch,
 *  keyed by normalized name (BirdingStats' `normTaxon`), then the join. */
function index(rows: readonly ObservationEntry[], join: EscapeeJoin = JOIN): CoverIndex {
  const codes: Record<string, string> = Object.create(null)
  for (const r of rows) {
    const code = codeLikeTransports(r.commonName, r.scientificName)
    if (code) codes[normalizeSpeciesName(r.commonName)] = code
  }
  return buildCoverIndex(rows, norm => (Object.hasOwn(codes, norm) ? codes[norm] : undefined), join)
}

type Answer = Array<{ speciesCode: string; exoticCategory?: string }>

/** Every checklist the export carries, answered and merged as the controller does. */
async function answerAll(idx: CoverIndex, answers: Record<string, Answer>): Promise<void> {
  const admissible = new Set(idx.bySpecies.keys())
  for (const [sub, carried] of idx.byChecklist) {
    const obs = (answers[sub] ?? []).map(a => ({ speciesCode: a.speciesCode, exoticCategory: a.exoticCategory ?? '', userDoNotCount: '' }))
    await cache.mergeChecklist(sub, obs, admissible, Date.now(), carried, idx.standIns)
  }
}

const codeOf = (idx: CoverIndex, name: string): string => {
  for (const [code, n] of idx.nameForCode) if (n === name) return code
  throw new Error(`${name} is not in the cover`)
}

beforeEach(() => {
  seamDoc.value = null
  cache._resetProvenanceCacheForTests()
})

describe('the join table, from the bundled history asset', () => {
  it("holds every before-side name of the latest update, each with its event's after and slash codes", () => {
    const events = HISTORY.events.filter(e => e.year === LATEST)
    expect(events.length, 'the latest update has events').toBeGreaterThan(0)
    let names = 0
    for (const e of events) {
      const family = [...e.after, ...e.slashes].map(x => x.code)
      for (const b of e.before) {
        names += 1
        const entry = JOIN.byBeforeName.get(b.com.toLowerCase())
        expect(entry, b.com).toBeDefined()
        expect(entry!.code, b.com).toBe(b.code)
        expect([...entry!.family].sort(), b.com).toEqual([...new Set(family)].sort())
      }
    }
    expect(JOIN.byBeforeName.size).toBe(names)
    // Only the latest update: a name from an earlier one is not in the table.
    const earlier = HISTORY.events.find(e => e.year < LATEST && e.before.some(b => b.retired))!
    const old = earlier.before.find(b => b.retired)!
    if (!events.some(e => e.before.some(b => b.com.toLowerCase() === old.com.toLowerCase()))) {
      expect(JOIN.byBeforeName.has(old.com.toLowerCase())).toBe(false)
    }
  })

  it('no history is no join, and the loader that both tabs use resolves the same table', async () => {
    expect(buildEscapeeJoin(null)).toBe(NO_ESCAPEE_JOIN)
    expect(buildEscapeeJoin({ ...HISTORY, coverage: null })).toBe(NO_ESCAPEE_JOIN)
    _resetEscapeeJoinForTests()
    const loaded = await loadEscapeeJoin()
    expect([...loaded.byBeforeName.keys()]).toEqual([...JOIN.byBeforeName.keys()])
    expect(await loadEscapeeJoin()).toBe(loaded)
  })

  it('a name listed on two before sides of one update is left out (the old rule), never joined to either', () => {
    const e = HISTORY.events.find(x => x.year === LATEST)!
    const twice: TaxonomyHistory = { ...HISTORY, events: [e, { ...e, after: [{ code: 'zzzzz1', sci: 'Z z', com: 'Z' }], slashes: [] }] }
    for (const b of e.before) expect(buildEscapeeJoin(twice).byBeforeName.has(b.com.toLowerCase())).toBe(false)
  })
})

describe('every 2026 shape resolves from an answer under a sibling code', () => {
  it('a retired split name, answered under another daughter (Southern Beardless-Tyrannulet, Willet)', async () => {
    const rows = [
      row('Southern Beardless-Tyrannulet', 'Camptostoma obsoletum', 'S1'),
      row('Willet', 'Tringa semipalmata', 'S2'),
    ]
    const idx = index(rows)
    // Each lands on one daughter by scientific name, as before.
    expect(codeOf(idx, 'Southern Beardless-Tyrannulet')).toBe('soubet2')
    expect(codeOf(idx, 'Willet')).toBe('willet2')
    await answerAll(idx, { S1: [{ speciesCode: 'soubet1' }], S2: [{ speciesCode: 'willet3' }] })
    expect(classifySpecies(cache.getSnapshot(), idx, 'soubet2')).toBe('counting')
    expect(classifySpecies(cache.getSnapshot(), idx, 'willet2')).toBe('counting')
    // No stamp settles anything (the empty fourth argument): the join must
    // answer each species with a record of its own.
    expect(remainingSpecies(cache.getSnapshot(), idx, new Set(), new Set())).toEqual([])
    expect(cache.unmatchedSet(Date.now()).size).toBe(0)
  })

  it('a split whose daughter kept the old name and code (Great Horned Owl, answered as Tropical Horned Owl)', async () => {
    const idx = index([row('Great Horned Owl', 'Bubo virginianus', 'S1')])
    expect(codeOf(idx, 'Great Horned Owl')).toBe('grhowl')
    await answerAll(idx, { S1: [{ speciesCode: 'grhowl19', exoticCategory: 'X' }] })
    expect(cache.getSnapshot().species.get('grhowl')?.seen).toEqual(['X|'])
    expect(remainingSpecies(cache.getSnapshot(), idx, new Set(), new Set())).toEqual([])
  })

  it('the old code reused for the slash (Marsh Wren as marwre, Willet as willet1), the measured answer', async () => {
    const idx = index([row('Marsh Wren', 'Cistothorus palustris', 'S1'), row('Willet', 'Tringa semipalmata', 'S2')])
    expect(codeOf(idx, 'Marsh Wren')).toBe('eamwre1')
    await answerAll(idx, { S1: [{ speciesCode: 'marwre' }], S2: [{ speciesCode: 'willet1' }] })
    expect(classifySpecies(cache.getSnapshot(), idx, 'eamwre1')).toBe('counting')
    expect(classifySpecies(cache.getSnapshot(), idx, 'willet2')).toBe('counting')
    // The slash rows stay where they were before: not records of their own.
    expect(cache.getSnapshot().species.has('marwre')).toBe(false)
    expect(cache.getSnapshot().species.has('willet1')).toBe(false)
  })

  it("a lumped-away name joins its surviving species and is checked (House Swift, answered as Little Swift's y00960)", async () => {
    const rows = [row('House Swift', 'Apus nipalensis', 'S1'), row('Little Swift', 'Apus affinis', 'S2')]
    // Without the join the name resolves to nothing and is never checked.
    expect([...index(rows, NO_ESCAPEE_JOIN).unresolvableNames]).toEqual(['House Swift'])
    const idx = index(rows)
    expect(idx.unresolvableNames.size).toBe(0)
    // Keyed on its own pre-lump code, so it stays its own species beside
    // Little Swift (a lumped pair still counts as two until a fresh backup).
    expect(codeOf(idx, 'House Swift')).toBe('houswi1')
    expect(codeOf(idx, 'Little Swift')).toBe('y00960')
    await answerAll(idx, { S1: [{ speciesCode: 'y00960', exoticCategory: 'X' }], S2: [{ speciesCode: 'y00960' }] })
    const snap = cache.getSnapshot()
    expect(classifySpecies(snap, idx, 'houswi1')).toBe('escapee-only')
    expect(classifySpecies(snap, idx, 'y00960')).toBe('counting')
    expect([...buildProvenanceLookup(snap, idx).excludedNames]).toEqual(['House Swift'])
  })

  it('every before-side name of the latest update, answered under every code of its event, settles', async () => {
    // The whole asset, not the examples: each name on its own checklist,
    // resolved like the transports, then answered under each family code.
    let rowsMeasured = 0
    for (const e of HISTORY.events.filter(x => x.year === LATEST)) {
      const family = [...new Set([...e.after, ...e.slashes].map(x => x.code))]
      for (const b of e.before) {
        const idx = index([row(b.com, b.sci, 'S1')])
        expect(idx.unresolvableNames.size, b.com).toBe(0)
        const code = codeOf(idx, b.com)
        for (const answer of family) {
          seamDoc.value = null
          cache._resetProvenanceCacheForTests()
          await answerAll(idx, { S1: [{ speciesCode: answer }] })
          expect(cache.getSnapshot().species.has(code), `${b.com} answered as ${answer}`).toBe(true)
          expect(remainingSpecies(cache.getSnapshot(), idx, new Set(), new Set()), `${b.com} answered as ${answer}`).toEqual([])
          rowsMeasured += 1
        }
      }
    }
    expect(rowsMeasured, 'every name and code was answered').toBeGreaterThan(JOIN.byBeforeName.size)
  })
})

describe('a current export is never cross-joined', () => {
  it('a daughter and its slash on one checklist stay apart: the daughter keeps only its own answer', async () => {
    // "Saltmarsh Willet" is a 2026 name, not a before-side one, so it has no
    // stand-ins at all.
    const idx = index([
      row('Saltmarsh Willet', 'Tringa semipalmata', 'S1'),
      row('Saltmarsh/Prairie Willet', 'Tringa semipalmata/inornata', 'S1'),
    ])
    expect(idx.standIns.has('willet2')).toBe(false)
    await answerAll(idx, { S1: [{ speciesCode: 'willet2', exoticCategory: 'X' }, { speciesCode: 'willet1' }] })
    expect(cache.getSnapshot().species.get('willet2')?.seen).toEqual(['X|'])
    expect(classifySpecies(cache.getSnapshot(), idx, 'willet2')).toBe('escapee-only')
  })

  it("a name the update kept, beside its slash: the code's own row is the answer, so the slash is not joined", async () => {
    // "Great Horned Owl" is a before-side name AND a current one, so it has
    // stand-ins; the merge reads them only when the answer has no row of the
    // code's own, which a current export's observation always has.
    const idx = index([
      row('Great Horned Owl', 'Bubo virginianus', 'S1'),
      row('Paramo/Tropical Horned Owl', 'Bubo nigrescens/nacurutu', 'S1'),
    ])
    expect(idx.standIns.get('grhowl')).toEqual(['grhowl13', 'grhowl19', 'y01409'])
    await answerAll(idx, { S1: [{ speciesCode: 'grhowl', exoticCategory: 'X' }, { speciesCode: 'y01409' }] })
    expect(cache.getSnapshot().species.get('grhowl')?.seen).toEqual(['X|'])
    expect(classifySpecies(cache.getSnapshot(), idx, 'grhowl')).toBe('escapee-only')
  })

  it('a before-side name whose lookup lands outside its event is not joined', () => {
    // A row whose scientific name is another species' (a hand-edited export):
    // the lookup's code is not this event's, so the name says nothing about it.
    const idx = index([row('Willet', 'Anas platyrhynchos', 'S1')])
    expect(codeOf(idx, 'Willet')).toBe('mallar3')
    expect(idx.standIns.size).toBe(0)
  })

  it('a joined row whose admission was refused is still a row: a full species index stamps nothing', async () => {
    // The direct path's rule (exotic-provenance-reuse) applied to the join:
    // a stamp says the answer had NO row for the species, which a refused
    // admission is not. Only at the full-index boundary does this differ from
    // "a record exists", so it needs its own row (mutation-measured).
    cache.setProvenanceMaxSpecies(0)
    const idx = index([row('Willet', 'Tringa semipalmata', 'S1')])
    await answerAll(idx, { S1: [{ speciesCode: 'willet1' }] })
    expect(cache.getSnapshot().species.has('willet2')).toBe(false)
    expect(cache._getProvenanceCacheWorkStatsForTests().admissionsRefused).toBe(1)
    expect(cache.unmatchedSet(Date.now()).size).toBe(0)
  })

  it('the join reaches only a checklist the export says carries the species', async () => {
    // S2 carries only Mallard; a slash row there is someone else's bird.
    const idx = index([row('Willet', 'Tringa semipalmata', 'S1'), row('Mallard', 'Anas platyrhynchos', 'S2')])
    await answerAll(idx, { S1: [], S2: [{ speciesCode: 'mallar3' }, { speciesCode: 'willet1' }] })
    expect(cache.getSnapshot().species.has('willet2')).toBe(false)
    // ...and S1's empty answer stamps it, as before.
    expect([...cache.unmatchedSet(Date.now())]).toEqual(['willet2'])
  })
})
