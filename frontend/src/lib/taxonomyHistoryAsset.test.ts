// THE CI GUARD FOR THE COMMITTED SPLITS-AND-LUMPS ASSET (taxonomic-splits-lumps,
// schema.md 5.1; QA-01, QA-02, QA-05).
//
// The asset is a bundled BUILD-TIME artifact, so it is defended at build time
// (the fail-closed generator) and here, at CI time; the app performs no
// per-entry validation (CLAUDE.md, the bundled-asset trust boundary). This file
// reads the committed asset and the committed taxonomy snapshot from disk and:
//
//   1. runs the generator's SHARED invariant checker over the asset, and
//   2. re-asserts the load-bearing invariants INDEPENDENTLY in this file's own
//      code (I1, I5, I7, I9, I10 and eBird's announced tallies), so a checker
//      weakened in the script cannot pass this test by itself;
//   3. proves both halves live with mutation rows: each mutates a copy of the
//      asset in one way and must be rejected.
//
// The size bound is read from the loader module, never re-spelled here.

/// <reference types="node" />
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { historyMaxBytes } from './taxonomyHistoryAsset'
import { buildTaxonomyHistoryIndex, type TaxonomyHistory } from './taxonomyHistory'
import {
  checkHistory, previousUpdate, ANNOUNCED_RECOUNTS, UPDATE_PUBLISHED, type HistoryLike,
} from '../../../scripts/lib/taxonomyHistoryDerive.mjs'

interface Snapshot {
  version: string
  byCode: Record<string, string>
  byCom: Record<string, string>
  bySci: Record<string, string>
}

const RAW = readFileSync(new URL('../assets/ebird-taxonomy-history.json', import.meta.url), 'utf8')
const ASSET = JSON.parse(RAW) as TaxonomyHistory
const SNAPSHOT = JSON.parse(readFileSync(new URL('../assets/ebird-taxonomy.json', import.meta.url), 'utf8')) as Snapshot

/** Every violation this file's OWN assertions find (independent of the checker). */
function independentViolations(h: TaxonomyHistory, raw: string): string[] {
  const out: string[] = []
  // I1
  if (h.v !== 1) out.push('v')
  if (h.snapshot !== SNAPSHOT.version) out.push('snapshot version')
  // I9: coverage is the first and last update, updates ascend
  for (let i = 1; i < h.updates.length; i += 1) {
    if (!(h.updates[i - 1].published < h.updates[i].published)) out.push('updates order')
  }
  const first = h.updates[0]
  const last = h.updates[h.updates.length - 1]
  if (h.updates.length === 0 ? h.coverage !== null
    : h.coverage?.earliest.year !== first.year || h.coverage?.earliest.published !== first.published
      || h.coverage?.latest.year !== last.year || h.coverage?.latest.published !== last.published) {
    out.push('coverage')
  }
  // Every event's (year, published) is an update.
  for (const e of h.events) {
    if (!h.updates.some(u => u.year === e.year && u.published === e.published)) out.push('event outside updates')
  }
  // I5: every after-side code is a current species with the snapshot's own
  // name, unless a LATER event carries it on its before side (the chain).
  const species = new Set(Object.values(SNAPSHOT.byCom))
  for (const e of h.events) {
    const later = new Set(h.events.filter(f => f.published > e.published).flatMap(f => f.before.map(b => b.code)))
    for (const a of e.after) {
      if (species.has(a.code)) {
        if (SNAPSHOT.byCode[a.code] !== a.com) out.push(`after name ${a.code}`)
      } else if (!later.has(a.code)) {
        out.push(`after code ${a.code}`)
      }
    }
    // I7: retired exactly when the common name is not a current species name.
    for (const b of e.before) {
      if (b.retired !== !Object.hasOwn(SNAPSHOT.byCom, b.com.toLowerCase())) out.push(`retired ${b.code}`)
    }
    // I3, restated: the shapes FR-01 defines.
    if (e.kind === 'split' && !(e.before.length === 1 && e.after.length >= 2)) out.push('split shape')
    if (e.kind === 'lump' && !(e.before.length >= 2 && e.after.length === 1 && e.slashes.length === 0)) out.push('lump shape')
  }
  // I10: the committed file's byte length, against the loader's own bound.
  if (Buffer.byteLength(raw) > historyMaxBytes(h.updates.length)) out.push('size')
  // eBird's announced tallies, per covered year, with each cited reorganization
  // eBird counts by its net change (ANNOUNCED_RECOUNTS) taken at eBird's count.
  // Re-implemented here, not imported: each named event must be in the asset
  // exactly once, and a recount may relabel but never change the net.
  const key = (kind: string, before: readonly string[], after: readonly string[]) =>
    `${kind}|${[...before].sort().join(',')}|${[...after].sort().join(',')}`
  for (const u of h.updates) {
    const announced = UPDATE_PUBLISHED[u.year]?.announced
    if (!announced) { out.push(`no announced tally for ${u.year}`); continue }
    const yearEvents = h.events.filter(x => x.year === u.year)
    const own = (evs: readonly typeof yearEvents[number][]) => {
      let gained = 0
      let lost = 0
      for (const e of evs) {
        if (e.kind === 'split') gained += e.after.length - 1
        else lost += e.before.length - 1
      }
      return { gained, lost }
    }
    let { gained, lost } = own(yearEvents)
    for (const rc of ANNOUNCED_RECOUNTS[u.year] ?? []) {
      const hits = rc.events.map(n => yearEvents.filter(e =>
        key(e.kind, e.before.map(b => b.code), e.after.map(a => a.code)) === key(n.kind, n.before, n.after)))
      if (hits.some(m => m.length !== 1)) { out.push(`recount ${u.year}`); continue }
      const t = own(hits.map(m => m[0]))
      if (t.gained - t.lost !== rc.counted.gained - rc.counted.lost) out.push(`recount ${u.year}`)
      gained += rc.counted.gained - t.gained
      lost += rc.counted.lost - t.lost
    }
    if (gained !== announced.gained || lost !== announced.lost) out.push(`tally ${u.year}`)
  }
  return out
}

function checkerRejects(h: TaxonomyHistory): boolean {
  try {
    checkHistory(h as unknown as HistoryLike, SNAPSHOT)
    return false
  } catch {
    return true
  }
}

describe('the committed asset (QA-01, QA-05)', () => {
  it('passes the shared invariant checker the generator runs before writing', () => {
    expect(checkHistory(ASSET as unknown as HistoryLike, SNAPSHOT)).toBe(true)
  })

  it('passes this file\'s independent re-assertions', () => {
    expect(independentViolations(ASSET, RAW)).toEqual([])
  })

  it('is non-vacuous: it covers updates, holds both kinds, and carries slashes and chains', () => {
    expect(ASSET.updates.length).toBeGreaterThan(0)
    expect(ASSET.events.some(e => e.kind === 'split')).toBe(true)
    expect(ASSET.events.some(e => e.kind === 'lump')).toBe(true)
    expect(ASSET.events.some(e => e.slashes.length > 0)).toBe(true)
    const species = new Set(Object.values(SNAPSHOT.byCom))
    expect(ASSET.events.some(e => e.after.some(a => !species.has(a.code))), 'a chained lineage exists').toBe(true)
  })

  it('every event is complete and dated per FR-01', () => {
    for (const e of ASSET.events) {
      expect(['split', 'lump']).toContain(e.kind)
      expect(e.published).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      for (const x of [...e.before, ...e.after, ...e.slashes]) {
        expect(x.code).toMatch(/^[a-z0-9-]{2,16}$/)
        expect(x.sci.trim()).not.toBe('')
        expect(x.com.trim()).not.toBe('')
      }
      for (const s of e.slashes) expect(s.com).toContain('/')
    }
  })

  it('states the coverage it was generated for, derived rather than typed', () => {
    expect(ASSET.coverage).not.toBeNull()
    expect(ASSET.coverage!.earliest).toEqual(ASSET.updates[0])
    expect(ASSET.coverage!.latest).toEqual(ASSET.updates[ASSET.updates.length - 1])
  })

  it('stays well inside its size bound, which grows with coverage', () => {
    expect(Buffer.byteLength(RAW)).toBeLessThanOrEqual(historyMaxBytes(ASSET.updates.length))
    expect(historyMaxBytes(0)).toBeLessThan(historyMaxBytes(1))
    expect(historyMaxBytes(1_000)).toBe(historyMaxBytes(10_000)) // the absolute ceiling holds
  })

  it('covers eBird\'s 2019 to 2025 updates, which take no 2020 one, as consecutive updates (taxonomy-history-2019)', () => {
    // The first six covered years, so a later annual refresh appends without
    // editing this row. eBird released no 2020 update: 2021's previous update
    // is 2019, and no event or update is dated 2020.
    const years = ASSET.updates.map(u => u.year)
    expect(years.slice(0, 6)).toEqual([2019, 2021, 2022, 2023, 2024, 2025])
    expect(ASSET.coverage!.earliest.year).toBe(2019)
    expect(years).not.toContain(2020)
    expect(ASSET.events.some(e => e.year === 2020)).toBe(false)
    for (let i = 1; i < years.length; i += 1) expect(previousUpdate(years[i])).toBe(years[i - 1])
    // Every covered year holds both kinds of event.
    for (const y of years) {
      expect(ASSET.events.some(e => e.year === y && e.kind === 'split'), `${y} has a split`).toBe(true)
      expect(ASSET.events.some(e => e.year === y && e.kind === 'lump'), `${y} has a lump`).toBe(true)
    }
  })

  it('fits the six-update bound with its six covered updates (taxonomy-history-2019)', () => {
    // Measured 213,276 bytes at this coverage (pipeline/taxonomy-history-2019/
    // decisions.md); the bound is read from the loader, never re-spelled.
    expect(ASSET.updates.slice(0, 6)).toHaveLength(6)
    expect(Buffer.byteLength(RAW)).toBeLessThanOrEqual(historyMaxBytes(6))
  })

  it('the derivation marks an after-side entry current exactly when its code is a snapshot species (security review L1)', () => {
    // The site marks (eBird, Birds of the World) render only on a current entry,
    // and the derivation decides currency from the asset alone, without the
    // snapshot. This holds that rule to the snapshot over every entry of the
    // committed asset, so a regenerated asset that breaks the I5/I6 argument it
    // rests on fails here rather than shipping a link to a page that is gone.
    const species = new Set(Object.values(SNAPSHOT.byCom))
    const index = buildTaxonomyHistoryIndex([], ASSET, { codes: {} })
    const wrong: string[] = []
    const stale = new Set<string>()
    const keptLater: string[] = []
    index.events.forEach((ev, e) => {
      for (const a of ev.after) {
        if (a.current !== species.has(a.code)) wrong.push(`event ${e} after ${a.code}`)
        if (!a.current) stale.add(a.code)
        // The kept-code shape the shorter "never on a later before side" test
        // would get wrong: current, yet on a later event's before side.
        if (a.current && ASSET.events.some(f => f.published > ev.published && f.before.some(b => b.code === a.code))) {
          keptLater.push(a.code)
        }
      }
      for (const b of ev.before) if (b.current) wrong.push(`event ${e} before ${b.code}`)
    })
    expect(wrong).toEqual([])
    // Non-vacuity: the stale codes the security review found are present and
    // marked, and the kept-code shape is present and kept.
    expect([...stale]).toEqual(expect.arrayContaining(['slbcro1', 'recpar23', 'pappit2']))
    expect(keptLater).toEqual(expect.arrayContaining(['refpar4', 'pappit1']))
  })
})

describe('each mutation of the asset is rejected (QA-05)', () => {
  const species = new Set(Object.values(SNAPSHOT.byCom))
  const firstSplit = () => ASSET.events.findIndex(e => e.kind === 'split' && e.after.every(a => species.has(a.code)))

  const rows: [string, (h: TaxonomyHistory) => void][] = [
    ['a re-spelled snapshot version', h => { h.snapshot = `${h.snapshot}x` }],
    ['an after-side code changed to a retired one', h => {
      const e = h.events[firstSplit()]
      e.after[0] = { ...e.after[0], code: e.before[0].code === e.after[1].code ? 'zzzzzz9' : e.before[0].code }
    }],
    ['a flipped retired flag', h => { h.events[0].before[0].retired = !h.events[0].before[0].retired }],
    ['coverage.latest moved', h => { h.coverage = { ...h.coverage!, latest: h.updates[0] } }],
    ['a split with one daughter', h => { h.events[firstSplit()].after.splice(1) }],
    ['an event whose published date is not an update', h => { h.events[0].published = '1999-01-01' }],
  ]

  for (const [label, fn] of rows) {
    it(`${label}: the checker AND the independent assertions both reject it`, () => {
      const h = structuredClone(ASSET)
      fn(h)
      expect(JSON.stringify(h)).not.toBe(RAW) // the mutation changed something
      expect(checkerRejects(h), 'shared checker').toBe(true)
      expect(independentViolations(h, JSON.stringify(h)).length, 'independent assertions').toBeGreaterThan(0)
    })
  }

  it('a file padded past the bound is rejected by the size assertion', () => {
    const padded = RAW + ' '.repeat(historyMaxBytes(ASSET.updates.length))
    expect(independentViolations(ASSET, padded)).toContain('size')
  })

  it('a reorganization eBird recounts, with one of its events missing, is rejected (taxonomy-history-2019)', () => {
    const h = structuredClone(ASSET)
    const [rc] = ANNOUNCED_RECOUNTS[2019]
    const split = rc.events.find(n => n.kind === 'split')!
    const at = h.events.findIndex(e => e.year === 2019 && e.kind === 'split' && e.before[0].code === split.before[0])
    expect(at).toBeGreaterThan(-1)
    h.events.splice(at, 1)
    expect(independentViolations(h, RAW)).toContain('recount 2019')
  })

  it('a year whose tally drifts from eBird\'s announcement is rejected', () => {
    const h = structuredClone(ASSET)
    const lump = h.events.find(e => e.kind === 'lump')!
    const split = h.events.find(e => e.kind === 'split' && e.year === lump.year && e.after.length > 2)!
    split.after.pop()
    expect(independentViolations(h, RAW)).toContain(`tally ${lump.year}`)
  })
})
