/// <reference types="node" />
// The diagram's layout (family-rollups-and-tree schema 11.3, 11.4, 11.6;
// QA-52, QA-53, QA-55, QA-57's layout half, QA-64, QA-98's pure half).
//
// The roster is every species in the committed asset, read when the test runs
// (the measured roster of schema 11.2), so the cap rows hold for the largest
// tree the app can draw and a regenerated asset moves them with no typed-in
// figure. The cap is asserted at arrival, after a full expand, and over a
// scripted zoom and pan sweep in both forms, both Names states and two text
// scales; the non-vacuity leg turns the level-of-detail rule off and must go
// over the cap, so the cap rows are not passing on a tree too small to need it.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { fullRosterModel, readFamilyIndex } from '../test/familyTreeCorpus'
import {
  ARRIVAL_VIEW, DIAGRAM_COARSEN_MAX, DIAGRAM_MOUNTED_MAX, NO_EXPANSION, ZOOM_STEP,
  anchorScrollTop, arrivalExpansion, assignSlots, buildDrawnTree, captureAnchor, childrenOf, cullTree, formFor,
  fullExpansion, kFit, kOf, keyAction, metricsFor, nodeKey, planeHeight, toggled, viewOf, withAncestorsOpen, zoomTo,
  type CullInput, type Expansion, type Metrics, type Slots,
} from './familyTreeLayout'

const INDEX = readFamilyIndex()
const MODEL = fullRosterModel(INDEX)
const TREE = buildDrawnTree(MODEL)
const FULL = fullExpansion(TREE)

const BOXES = [
  { name: 'page columns', boxW: 1100, boxH: 424, stillTier: false },
  { name: 'full screen columns', boxW: 1440, boxH: 749, stillTier: false },
  { name: 'phone outline', boxW: 358, boxH: 548, stillTier: true },
  { name: 'tall window columns', boxW: 1900, boxH: 2400, stillTier: false },
]

function input(m: Metrics, exp: Expansion, k: number, scrollTop: number, active = -1): CullInput & { slots: Slots } {
  const slots = assignSlots(TREE, exp, m.form)
  return { tree: TREE, slots, exp, k, scrollTop, m, active, hasAlt: () => true }
}

describe('the drawn tree is the model (QA-52)', () => {
  it('every order, family, genus and species once, in preorder, with consistent parents', () => {
    let o = 0, f = 0, g = 0, s = 0
    for (const order of MODEL.orders) {
      o++
      for (const fam of order.families) { f++; for (const gen of fam.genera) { g++; s += gen.species.length } }
    }
    expect(TREE.size).toBe(o + f + g + s)
    expect(s).toBeGreaterThan(10_000)
    expect(TREE.orderNodes.length).toBe(MODEL.orders.length)
    for (let i = 0; i < TREE.size; i++) {
      const p = TREE.parent[i]
      if (p >= 0) {
        expect(TREE.level[p]).toBe(TREE.level[i] - 1)
        expect(i).toBeGreaterThan(p)
        expect(i).toBeLessThan(TREE.end[p])
      } else expect(TREE.level[i]).toBe(0)
      expect(TREE.byKey.get(nodeKey(TREE.level[i] as 0, TREE.ref[i]))).toBe(i)
    }
    let leaves = 0
    for (const on of TREE.orderNodes) leaves += TREE.species[on]
    expect(leaves).toBe(MODEL.seen.species)
  })
  it('slots: a collapsed node is one slot; the outline gives an open branch its own row', () => {
    const cols = assignSlots(TREE, FULL, 'columns')
    const outl = assignSlots(TREE, FULL, 'outline')
    expect(cols.total).toBe(MODEL.seen.species)
    let branches = 0
    for (let i = 0; i < TREE.size; i++) if (TREE.level[i] < 3) branches++
    expect(outl.total).toBe(MODEL.seen.species + branches)
    const closed = assignSlots(TREE, NO_EXPANSION, 'columns')
    expect(closed.total).toBe(MODEL.orders.length)
  })
})

describe('the mounted bound (NFR-04)', () => {
  const sweep = (m: Metrics, exp: Expansion) => {
    const slots = assignSlots(TREE, exp, m.form)
    let most = 0
    let k = kFit(m, slots.total)
    for (let step = 0; step < 40 && k < m.kMax; step++) {
      const plane = planeHeight(m, slots.total, k)
      const stride = Math.max(m.boxH, plane / 12)
      for (let top = 0; top <= plane; top += stride) {
        const c = cullTree({ ...input(m, exp, k, top), slots })
        most = Math.max(most, c.marks.length)
      }
      k = Math.min(m.kMax, k * ZOOM_STEP)
    }
    return most
  }
  for (const box of BOXES) {
    for (const rem of [16, 32]) {
      for (const both of [true, false]) {
        it(`${box.name}, ${rem === 16 ? '100%' : '200%'} text, ${both ? 'Both' : 'Common'}: arrival, full expand and a zoom-and-pan sweep stay under the cap`, () => {
          const m = metricsFor({ rem, boxW: box.boxW, boxH: box.boxH, both, stillTier: box.stillTier })
          const arrival = arrivalExpansion(TREE, m.form)
          const a = cullTree(input(m, arrival, m.kMax, 0))
          expect(a.marks.length).toBeGreaterThan(5)
          expect(a.marks.length).toBeLessThanOrEqual(DIAGRAM_MOUNTED_MAX)
          expect(sweep(m, FULL)).toBeLessThanOrEqual(DIAGRAM_MOUNTED_MAX)
        })
      }
    }
  }
  it('non-vacuity: with the level-of-detail rule off the fitted full tree goes far over the cap', () => {
    const m = metricsFor({ rem: 16, boxW: 1440, boxH: 749, both: false, stillTier: false })
    const slots = assignSlots(TREE, FULL, m.form)
    const off = cullTree({ ...input(m, FULL, kFit(m, slots.total), 0), slots }, { lod: false, cap: Infinity })
    expect(off.marks.length).toBeGreaterThan(DIAGRAM_MOUNTED_MAX * 5)
    const on = cullTree({ ...input(m, FULL, kFit(m, slots.total), 0), slots })
    expect(on.marks.length).toBeLessThanOrEqual(DIAGRAM_MOUNTED_MAX)
  })
  it('the clamp is inside the function: a box far taller than any window coarsens and holds the cap', () => {
    const m = metricsFor({ rem: 16, boxW: 1900, boxH: 20_000, both: false, stillTier: false })
    const c = cullTree(input(m, FULL, m.kMax, 0))
    expect(c.marks.length).toBeLessThanOrEqual(DIAGRAM_MOUNTED_MAX)
    expect(c.coarsened).toBeGreaterThan(0)
    expect(c.coarsened).toBeLessThanOrEqual(DIAGRAM_COARSEN_MAX)
  })
  it('a small cap truncates and still keeps the active node and its lineage', () => {
    const m = metricsFor({ rem: 16, boxW: 1440, boxH: 749, both: false, stillTier: false })
    const last = TREE.size - 1
    const c = cullTree(input(m, FULL, m.kMax, 0, last), { cap: 10 })
    expect(c.marks.length).toBeLessThanOrEqual(10)
    const nodes = new Set(c.marks.filter(x => x.kind === 'node').map(x => x.node))
    for (let p = last; p >= 0; p = TREE.parent[p]) expect(nodes.has(p)).toBe(true)
  })
})

describe('level of detail draws what it claims (design-spec 9.4)', () => {
  it('the active node and its ancestors are always drawn by name, wherever they are', () => {
    const m = metricsFor({ rem: 16, boxW: 1100, boxH: 424, both: true, stillTier: false })
    const last = TREE.size - 1
    const slots = assignSlots(TREE, FULL, m.form)
    const c = cullTree({ ...input(m, FULL, kFit(m, slots.total), 0, last), slots })
    const named = new Set(c.marks.filter(x => x.kind === 'node').map(x => x.node))
    for (let p = last; p >= 0; p = TREE.parent[p]) expect(named.has(p)).toBe(true)
  })
  it('labels in one column never sit closer than a line, at full zoom and at the fit', () => {
    for (const form of ['columns', 'outline'] as const) {
      const m = metricsFor({ rem: 16, boxW: form === 'columns' ? 1440 : 358, boxH: 749, both: false, stillTier: false })
      const slots = assignSlots(TREE, FULL, m.form)
      for (const k of [m.kMax, kFit(m, slots.total), (m.kMax + kFit(m, slots.total)) / 4]) {
        const top = Math.max(0, Math.min(1234, m.headH + planeHeight(m, slots.total, k) - m.boxH))
        const c = cullTree({ ...input(m, FULL, k, top), slots })
        const byDepth = new Map<number, number[]>()
        for (const x of c.marks) {
          const key = form === 'outline' ? 0 : x.depth
          const list = byDepth.get(key) ?? []
          list.push(x.c)
          byDepth.set(key, list)
        }
        let pairs = 0
        for (const list of byDepth.values()) {
          list.sort((a, b) => a - b)
          for (let i = 1; i < list.length; i++, pairs++) expect(list[i] - list[i - 1]).toBeGreaterThanOrEqual(m.line - 0.01)
        }
        if (k === m.kMax) expect(pairs).toBeGreaterThan(3)
      }
    }
  })
  it('at the fit every slot is inside the box (a true fit, no floor; QA-55)', () => {
    for (const box of BOXES) {
      const m = metricsFor({ rem: 16, boxW: box.boxW, boxH: box.boxH, both: true, stillTier: box.stillTier })
      for (const exp of [FULL, arrivalExpansion(TREE, m.form), NO_EXPANSION]) {
        const slots = assignSlots(TREE, exp, m.form)
        const k = kFit(m, slots.total)
        expect(m.headH + planeHeight(m, slots.total, k)).toBeLessThanOrEqual(m.boxH + 0.01)
      }
    }
  })
  it('a count names how many taxa and species it stands for', () => {
    const m = metricsFor({ rem: 16, boxW: 1440, boxH: 749, both: false, stillTier: false })
    const slots = assignSlots(TREE, FULL, m.form)
    const c = cullTree({ ...input(m, FULL, kFit(m, slots.total), 0), slots })
    const counts = c.marks.filter(x => x.kind === 'count')
    expect(counts.length).toBeGreaterThan(0)
    for (const x of counts) {
      let sp = 0
      for (let i = x.node; i <= x.last; i = TREE.end[i]) sp += TREE.species[i]
      expect(x.species).toBe(sp)
      expect(TREE.parent[x.node]).toBe(TREE.parent[x.last])
    }
  })
})

describe('the form and the view (schema 11.3; QA-98 pure half)', () => {
  it('columns from 54rem of box, the outline below, at any text scale', () => {
    expect(formFor(864, 16)).toBe('columns')
    expect(formFor(863.9, 16)).toBe('outline')
    expect(formFor(1100, 32)).toBe('outline')
  })
  it('a zoom keeps the slot under its anchor point and snaps within 6% of either end', () => {
    const m = metricsFor({ rem: 16, boxW: 1440, boxH: 749, both: false, stillTier: false })
    const slots = assignSlots(TREE, FULL, m.form)
    const k0 = m.kMax / 4
    const top = 50_000
    const ay = 300
    const before = (top + ay - m.headH - m.padTop) / k0
    const z = zoomTo(k0 * ZOOM_STEP, ay, k0, top, m, slots.total)
    expect((z.scrollTop + ay - m.headH - m.padTop) / z.k).toBeCloseTo(before, 6)
    expect(zoomTo(m.kMax / 1.05, null, k0, top, m, slots.total).k).toBe(m.kMax)
    const lo = kFit(m, slots.total)
    const fit = zoomTo(lo * 1.05, null, k0, top, m, slots.total)
    expect(fit.k).toBe(lo)
    expect(fit.atFit).toBe(true)
  })
  it('an anchor captured in one form puts the same node at the top in the other, and back exactly', () => {
    const rem = 16
    const cols = metricsFor({ rem, boxW: 1440, boxH: 749, both: true, stillTier: false })
    const outl = metricsFor({ rem, boxW: 600, boxH: 749, both: true, stillTier: false })
    const exp = FULL
    const sc = assignSlots(TREE, exp, 'columns')
    const so = assignSlots(TREE, exp, 'outline')
    const view0 = { zoom: 0.5, atFit: false, anchor: null }
    const k = kOf(view0, cols, sc.total)
    const top = 123_457
    const anchor = captureAnchor(TREE, sc, top, k, cols)!
    expect(anchor).not.toBeNull()
    expect(anchorScrollTop(TREE, sc, INDEX, anchor, k, cols)).toBeCloseTo(top, 6)
    const kO = kOf({ ...view0, anchor }, outl, so.total)
    const topO = anchorScrollTop(TREE, so, INDEX, anchor, kO, outl)
    const node = TREE.byKey.get(nodeKey(anchor.level, anchor.ref))!
    expect(topO).toBeCloseTo(outl.padTop + so.first[node] * kO - anchor.offset, 6)
    const back = captureAnchor(TREE, so, topO, kO, outl)!
    expect(back.level).toBe(anchor.level)
    expect(back.ref).toBe(anchor.ref)
    expect(anchorScrollTop(TREE, sc, INDEX, back, k, cols)).toBeCloseTo(top, 6)
  })
  it('an anchor under a closed branch falls back to that branch, and one gone from the model to its asset ancestor', () => {
    const m = metricsFor({ rem: 16, boxW: 1440, boxH: 749, both: false, stillTier: false })
    const sp = TREE.size - 1
    const anchor = { level: 3 as const, ref: TREE.ref[sp], offset: -2 }
    const genus = TREE.parent[sp]
    const closedGenus = toggled(TREE, FULL, genus)
    const slots = assignSlots(TREE, closedGenus, m.form)
    expect(anchorScrollTop(TREE, slots, INDEX, anchor, m.kMax, m)).toBeCloseTo(Math.min(m.padTop + slots.first[genus] * m.kMax, m.headH + planeHeight(m, slots.total, m.kMax) - m.boxH), 6)
    // A species of the same genus that is not in this tree resolves through the asset.
    const g = INDEX.genera[TREE.ref[genus]]
    const otherSeq = g.firstSpecies
    expect(INDEX.speciesGenus[otherSeq]).toBe(TREE.ref[genus])
    const full = assignSlots(TREE, FULL, m.form)
    const viaAsset = anchorScrollTop(TREE, full, INDEX, { level: 3, ref: otherSeq, offset: 0 }, m.kMax, m)
    expect(Number.isFinite(viaAsset)).toBe(true)
  })
  it('the arrival view is full zoom from the top; at fit a view stays at fit', () => {
    const m = metricsFor({ rem: 16, boxW: 1440, boxH: 749, both: false, stillTier: false })
    const slots = assignSlots(TREE, FULL, m.form)
    expect(kOf(ARRIVAL_VIEW, m, slots.total)).toBe(m.kMax)
    const v = viewOf(TREE, slots, { k: kFit(m, slots.total), scrollTop: 0, atFit: true }, m)
    const bigger = metricsFor({ rem: 16, boxW: 1440, boxH: 1200, both: false, stillTier: false })
    expect(kOf(v, bigger, slots.total)).toBe(kFit(bigger, slots.total))
  })
})

describe('the keyboard (design-spec 9.8)', () => {
  const exp = FULL
  const cols = assignSlots(TREE, exp, 'columns')
  const outl = assignSlots(TREE, exp, 'outline')
  const o0 = TREE.orderNodes[0]
  const f0 = childrenOf(TREE, o0)[0]
  it('any arrow with nothing active makes the first order active', () => {
    for (const key of ['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight', 'Home', 'End']) {
      expect(keyAction(TREE, cols, exp, -1, key)).toEqual({ kind: 'select', node: o0 })
    }
  })
  it('Down and Up: the next drawn node at the same level (columns), in reading order (outline)', () => {
    expect(keyAction(TREE, cols, exp, o0, 'ArrowDown')).toEqual({ kind: 'select', node: TREE.orderNodes[1] })
    expect(keyAction(TREE, outl, exp, o0, 'ArrowDown')).toEqual({ kind: 'select', node: f0 })
    expect(keyAction(TREE, cols, exp, o0, 'ArrowUp')).toEqual({ kind: 'select', node: o0 })
    expect(keyAction(TREE, cols, exp, o0, 'End')).toEqual({ kind: 'select', node: TREE.orderNodes[TREE.orderNodes.length - 1] })
  })
  it('Right opens a closed branch, else goes to its middle child; Left goes to the parent, or closes in the outline', () => {
    const closed = toggled(TREE, exp, o0)
    const cs = assignSlots(TREE, closed, 'columns')
    expect(keyAction(TREE, cs, closed, o0, 'ArrowRight')).toEqual({ kind: 'toggle', node: o0 })
    const kids = childrenOf(TREE, o0)
    expect(keyAction(TREE, cols, exp, o0, 'ArrowRight')).toEqual({ kind: 'select', node: kids[Math.floor((kids.length - 1) / 2)] })
    expect(keyAction(TREE, cols, exp, f0, 'ArrowLeft')).toEqual({ kind: 'select', node: o0 })
    expect(keyAction(TREE, outl, exp, f0, 'ArrowLeft')).toEqual({ kind: 'toggle', node: f0 })
  })
  it('Enter or Space opens or closes a branch, and on a species moves to the readout; zoom keys act', () => {
    const leaf = TREE.size - 1
    expect(keyAction(TREE, cols, exp, o0, 'Enter')).toEqual({ kind: 'toggle', node: o0 })
    expect(keyAction(TREE, cols, exp, leaf, ' ')).toEqual({ kind: 'readout' })
    expect(keyAction(TREE, cols, exp, leaf, '+')).toEqual({ kind: 'zoom', dir: 1 })
    expect(keyAction(TREE, cols, exp, leaf, '=')).toEqual({ kind: 'zoom', dir: 1 })
    expect(keyAction(TREE, cols, exp, leaf, '-')).toEqual({ kind: 'zoom', dir: -1 })
    expect(keyAction(TREE, cols, exp, leaf, '0')).toEqual({ kind: 'fit' })
    expect(keyAction(TREE, cols, exp, leaf, 'a')).toBeNull()
  })
  it('a find reveal opens every ancestor of the last species in sequence', () => {
    const leaf = TREE.size - 1
    const opened = withAncestorsOpen(TREE, NO_EXPANSION, leaf)
    const s = assignSlots(TREE, opened, 'columns')
    expect(s.first[leaf]).toBeGreaterThanOrEqual(0)
  })
})

describe('the module stays pure (11.3)', () => {
  it('imports no React and touches no DOM', () => {
    const src = readFileSync(fileURLToPath(new URL('./familyTreeLayout.ts', import.meta.url)), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '').split('\n').filter(l => !l.trimStart().startsWith('//')).join('\n')
    expect(src).not.toMatch(/from 'react'/)
    expect(src).not.toMatch(/\bdocument\b|\bwindow\b|getComputedStyle/)
    expect(src).toMatch(/export function cullTree/)
  })
})
