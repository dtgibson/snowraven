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
import { checkHistory, UPDATE_PUBLISHED, type HistoryLike } from '../../../scripts/lib/taxonomyHistoryDerive.mjs'

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
  // eBird's announced tallies, per covered year.
  for (const u of h.updates) {
    const announced = UPDATE_PUBLISHED[u.year]?.announced
    if (!announced) { out.push(`no announced tally for ${u.year}`); continue }
    let gained = 0
    let lost = 0
    for (const e of h.events.filter(x => x.year === u.year)) {
      if (e.kind === 'split') gained += e.after.length - 1
      else lost += e.before.length - 1
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

  it('a year whose tally drifts from eBird\'s announcement is rejected', () => {
    const h = structuredClone(ASSET)
    const lump = h.events.find(e => e.kind === 'lump')!
    const split = h.events.find(e => e.kind === 'split' && e.year === lump.year && e.after.length > 2)!
    split.after.pop()
    expect(independentViolations(h, RAW)).toContain(`tally ${lump.year}`)
  })
})
