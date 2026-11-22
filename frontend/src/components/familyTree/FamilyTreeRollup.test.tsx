// @vitest-environment jsdom
//
// The table's Expand all, at the row level (family-rollups-and-tree schema 9.2
// as amended, D-43; QA-94's work count). BirdName is counted through a module
// mock that passes through, so a count is a species row that rendered. The
// roster is every species in the committed asset, read when the test runs.
//
// The harness commits the plan's steps exactly as the tab does: each step's
// keys join the open set and their mounted counts the partial map, with the
// entrance set left empty. Two guards keep a family mounted earlier from
// rendering again: SpeciesRow's memo (a split family's earlier rows) and the
// open block's comparator, which leaves `isNew` out (a later entrance set).
// The first is held by the work count below; the second by its own row.

import { describe, it, expect, vi, afterEach } from 'vitest'
import { createElement, type ComponentProps } from 'react'
import { render, cleanup, act } from '@testing-library/react'

const H = vi.hoisted(() => ({ renders: 0, blocks: 0 }))
vi.mock('../BirdName', async importOriginal => {
  const m = await importOriginal<typeof import('../BirdName')>()
  return { ...m, BirdName: (p: ComponentProps<typeof m.BirdName>) => { H.renders++; return createElement(m.BirdName, p) } }
})

// The open block reads each genus's names once per render, so counting the
// reads counts the block's renders (SpeciesRow's memo would hide them).
vi.mock('../../lib/familyTreeNames', async importOriginal => {
  const m = await importOriginal<typeof import('../../lib/familyTreeNames')>()
  return { ...m, genusNames: (...a: Parameters<typeof m.genusNames>) => { H.blocks++; return m.genusNames(...a) } }
})

import { FamilyTreeRollup, NOT_PLACED_KEY } from './FamilyTreeRollup'
import { EXPAND_CHUNK_SPECIES, expandSteps, type FamilyModel } from '../../lib/familyTreeModel'
import { fullRosterModel, readFamilyIndex } from '../../test/familyTreeCorpus'

const INDEX = readFamilyIndex()
const MODEL = fullRosterModel(INDEX)
const NONE: ReadonlySet<number> = new Set()
const codeFor = () => undefined

function rollup(model: FamilyModel, open: ReadonlySet<number>, partial: ReadonlyMap<number, number>, fresh: ReadonlySet<number> = NONE) {
  return createElement(FamilyTreeRollup, { model, index: INDEX, names: 'both', sort: 'taxonomic', open, fresh, partial, onToggle: () => {}, codeFor })
}

afterEach(() => cleanup())

describe('Expand all renders each species row once (QA-94)', () => {
  it('across a whole run at every species, no commit renders more than EXPAND_CHUNK_SPECIES rows', () => {
    const steps = expandSteps(MODEL)
    let open = new Set<number>()
    let partial = new Map<number, number>()
    H.renders = 0
    const r = render(rollup(MODEL, open, partial))
    expect(H.renders).toBe(0)
    let most = 0
    let total = 0
    for (const step of steps) {
      open = new Set(open)
      partial = new Map(partial)
      for (const [k, mounted, all] of step) { open.add(k); if (mounted >= all) partial.delete(k); else partial.set(k, mounted) }
      H.renders = 0
      act(() => { r.rerender(rollup(MODEL, open, partial)) })
      most = Math.max(most, H.renders)
      total += H.renders
    }
    expect(steps.length).toBeGreaterThan(100)
    expect(most).toBeLessThanOrEqual(EXPAND_CHUNK_SPECIES)
    expect(total).toBe(MODEL.seen.species)
    expect(document.querySelectorAll('.sr-ft-sp').length).toBe(MODEL.seen.species)
  }, 120_000)
})

describe('the open block (schema 9.2 as amended)', () => {
  const fam = MODEL.orders.flatMap(o => o.families).find(f => f.seen > 40 && f.genera.length > 2)!
  it('a later change of the entrance set renders nothing again', () => {
    const open = new Set([fam.family])
    const r = render(rollup(MODEL, open, new Map(), new Set([fam.family])))
    expect(document.querySelector('.sr-ft-open.is-new')).not.toBeNull()
    H.renders = 0
    H.blocks = 0
    act(() => { r.rerender(rollup(MODEL, open, new Map(), NONE)) })
    expect(H.renders).toBe(0)
    expect(H.blocks, 'the open block itself did not render again').toBe(0)
    // The entrance was latched at mount: it does not drop when the set changes.
    expect(document.querySelector('.sr-ft-open.is-new')).not.toBeNull()
  })
  it('a limit of k mounts exactly the first k rows in genus order, and raising it mounts the rest', () => {
    const order = fam.genera.flatMap(g => g.species.map(s => `s${s.seq}`))
    expect(order.length).toBe(fam.seen)
    const open = new Set([fam.family])
    const k = 23
    const r = render(rollup(MODEL, open, new Map([[fam.family, k]])))
    const names = () => [...document.querySelectorAll('.sr-ft-open .sr-ft-sp')].map(e => e.getAttribute('data-ft-sp'))
    expect(names()).toEqual(order.slice(0, k))
    act(() => { r.rerender(rollup(MODEL, open, new Map())) })
    expect(names()).toEqual(order)
  })
  it('the Not placed group takes the same limit', () => {
    const leaves = Array.from({ length: 9 }, (_, i) => ({ name: `Unplaced bird ${i}`, sci: '', seq: -1, kinds: null }))
    const m: FamilyModel = { ...MODEL, unplaced: leaves }
    const open = new Set([NOT_PLACED_KEY])
    const r = render(rollup(m, open, new Map([[NOT_PLACED_KEY, 4]])))
    const rows = () => document.querySelectorAll('.sr-ft-unplaced .sr-ft-sp').length
    expect(rows()).toBe(4)
    act(() => { r.rerender(rollup(m, open, new Map())) })
    expect(rows()).toBe(9)
  })
})
