// The Family Tree diagram's layout (family-rollups-and-tree schema 11.3, 11.4
// and 11.6; design-spec 9). Pure: no DOM and no React, so every length, every
// mounted count and every keyboard move is a function of numbers a test can
// hand in.
//
// THE MODEL OF THE PICTURE. The tree runs left to right with one leaf axis.
// Zoom is one number, `k`, the pixels one leaf slot gets; a node's span on the
// leaf axis is its slots times `k`. Nothing is ever scaled: a zoom step is a
// new `k`, new positions and a new plane size, and every label stays real text
// at the body size (11.1; ui.md v0.5.64's reason). Pan is the box's own native
// scrolling, so the view is `k` plus a scroll offset, held across a relayout as
// a fraction of full zoom and the node at the top of the box (11.3).
//
// TWO FORMS of one tree, chosen by the box's own width (`formFor`): columns, a
// column per level, at 54rem and over; the outline, indented, below it, where
// an open branch takes a slot of its own above its children.
//
// THE MOUNTED BOUND is a clamp inside `cullTree`, not a property of the data
// (NFR-04): a pass that would mount more than DIAGRAM_MOUNTED_MAX marks is run
// again with the label pitch doubled, at most DIAGRAM_COARSEN_MAX times, and is
// then cut at the cap with the active node and its lineage kept. The walk lays
// out the children of each open node it visits before it tests the window (the
// approved mockup's algorithm, ported), so its work per pass is bounded by the
// asset's largest sibling group, never by the roster.
//
// Expansion is three Sets of ASSET indices (orders, families, genera), keyed on
// nothing from a user file, so it survives a taxon leaving the model and coming
// back (FR-58).

import type { FamilyIndex } from './familyTreeAsset'
import type { FamilyModel, SpeciesLeaf } from './familyTreeModel'

export type TreeLevel = 0 | 1 | 2 | 3
export type Form = 'columns' | 'outline'

/** Columns from this many rem of box width, the outline below it (Open Question 9). */
export const COLUMNS_MIN_REM = 54
/** The most marks (tree items and counts) one pass may mount (NFR-04). */
export const DIAGRAM_MOUNTED_MAX = 600
/** How many times a pass over the cap is re-run with the label pitch doubled. */
export const DIAGRAM_COARSEN_MAX = 4
/** Zoom in and Zoom out step by this factor (design-spec 9.5). */
export const ZOOM_STEP = 1.5
/** A zoom within 6% of either end snaps to it. */
const SNAP = 1.06

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v)

// -- The drawn tree ----------------------------------------------------------------

/** A node's identity in the asset, the same in either form and after any filter. */
export function nodeKey(level: TreeLevel, ref: number): number {
  return ref * 4 + level
}

export interface DrawnTree {
  readonly size: number
  /** 0 order, 1 family, 2 genus, 3 species. */
  readonly level: Uint8Array
  /** The order, family or genus index in the asset, or the species' sequence. */
  readonly ref: Int32Array
  /** -1 for an order. */
  readonly parent: Int32Array
  /** Preorder: a node's subtree is [i, end[i]). */
  readonly end: Int32Array
  readonly childCount: Int32Array
  /** 1-based place among its siblings (aria-posinset). */
  readonly posInSet: Int32Array
  /** Species under the node (1 for a species). */
  readonly species: Int32Array
  /** Species seen (orders, families, genera) and world species (orders, families). */
  readonly seen: Int32Array
  readonly world: Int32Array
  readonly leaves: readonly (SpeciesLeaf | null)[]
  readonly orderNodes: Int32Array
  readonly byKey: ReadonlyMap<number, number>
}

/** The model as an indexed preorder array; once per model (QA-52). */
export function buildDrawnTree(model: FamilyModel): DrawnTree {
  const level: number[] = []
  const ref: number[] = []
  const parent: number[] = []
  const end: number[] = []
  const childCount: number[] = []
  const pos: number[] = []
  const species: number[] = []
  const seen: number[] = []
  const world: number[] = []
  const leaves: (SpeciesLeaf | null)[] = []
  const orderNodes: number[] = []
  const byKey = new Map<number, number>()
  const add = (lv: TreeLevel, r: number, p: number, place: number, kids: number, s: number, w: number, leaf: SpeciesLeaf | null) => {
    const i = level.length
    level.push(lv); ref.push(r); parent.push(p); end.push(i + 1); childCount.push(kids); pos.push(place)
    species.push(lv === 3 ? 1 : 0); seen.push(s); world.push(w); leaves.push(leaf)
    byKey.set(nodeKey(lv, r), i)
    return i
  }
  model.orders.forEach((o, oi) => {
    const on = add(0, o.order, -1, oi + 1, o.families.length, o.seen, o.world, null)
    orderNodes.push(on)
    o.families.forEach((f, fi) => {
      const fn = add(1, f.family, on, fi + 1, f.genera.length, f.seen, f.world, null)
      f.genera.forEach((g, gi) => {
        const gn = add(2, g.genus, fn, gi + 1, g.species.length, g.seen, 0, null)
        g.species.forEach((s, si) => { add(3, s.seq, gn, si + 1, 0, 0, 0, s) })
        end[gn] = level.length
        species[gn] = g.species.length
        species[fn] += g.species.length
      })
      end[fn] = level.length
      species[on] += species[fn]
    })
    end[on] = level.length
  })
  return {
    size: level.length,
    level: Uint8Array.from(level),
    ref: Int32Array.from(ref),
    parent: Int32Array.from(parent),
    end: Int32Array.from(end),
    childCount: Int32Array.from(childCount),
    posInSet: Int32Array.from(pos),
    species: Int32Array.from(species),
    seen: Int32Array.from(seen),
    world: Int32Array.from(world),
    leaves,
    orderNodes: Int32Array.from(orderNodes),
    byKey,
  }
}

/** The children of node i, in order. */
export function childrenOf(tree: DrawnTree, i: number): number[] {
  const out: number[] = []
  for (let j = i + 1; j < tree.end[i]; j = tree.end[j]) out.push(j)
  return out
}

/** The setsize of node i (aria-setsize). */
export function setSizeOf(tree: DrawnTree, i: number): number {
  const p = tree.parent[i]
  return p < 0 ? tree.orderNodes.length : tree.childCount[p]
}

// -- Expansion ---------------------------------------------------------------------

export interface Expansion {
  readonly orders: ReadonlySet<number>
  readonly families: ReadonlySet<number>
  readonly genera: ReadonlySet<number>
}
export const NO_EXPANSION: Expansion = { orders: new Set(), families: new Set(), genera: new Set() }

function setFor(exp: Expansion, lv: number): ReadonlySet<number> {
  return lv === 0 ? exp.orders : lv === 1 ? exp.families : exp.genera
}

export function isOpen(tree: DrawnTree, exp: Expansion, i: number): boolean {
  const lv = tree.level[i]
  return lv < 3 && tree.childCount[i] > 0 && setFor(exp, lv).has(tree.ref[i])
}

function withSets(exp: Expansion, edit: (sets: [Set<number>, Set<number>, Set<number>]) => void): Expansion {
  const sets: [Set<number>, Set<number>, Set<number>] = [new Set(exp.orders), new Set(exp.families), new Set(exp.genera)]
  edit(sets)
  return { orders: sets[0], families: sets[1], genera: sets[2] }
}

/** Node i opened or closed. */
export function toggled(tree: DrawnTree, exp: Expansion, i: number): Expansion {
  const lv = tree.level[i]
  if (lv === 3) return exp
  return withSets(exp, s => { const set = s[lv]; if (set.has(tree.ref[i])) set.delete(tree.ref[i]); else set.add(tree.ref[i]) })
}

/** Every ancestor of node i open (a find reveal). */
export function withAncestorsOpen(tree: DrawnTree, exp: Expansion, i: number): Expansion {
  return withSets(exp, s => { for (let p = tree.parent[i]; p >= 0; p = tree.parent[p]) s[tree.level[p]].add(tree.ref[p]) })
}

/** Every branch of the model open. */
export function fullExpansion(tree: DrawnTree): Expansion {
  return withSets(NO_EXPANSION, s => { for (let i = 0; i < tree.size; i++) if (tree.level[i] < 3) s[tree.level[i]].add(tree.ref[i]) })
}

/** The arrival state (design-spec 9.6): columns, every branch open; the outline, orders open to families. */
export function arrivalExpansion(tree: DrawnTree, form: Form): Expansion {
  if (form === 'columns') return fullExpansion(tree)
  return withSets(NO_EXPANSION, s => { for (const o of tree.orderNodes) s[0].add(tree.ref[o]) })
}

// -- Slots ---------------------------------------------------------------------------

export interface Slots {
  readonly outline: boolean
  /** A node's first slot, or -1 when it is not drawn. */
  readonly first: Int32Array
  readonly count: Int32Array
  readonly total: number
  /** The node that owns each slot. */
  readonly slotNode: Int32Array
  /** The drawn nodes, in reading order. */
  readonly drawn: Int32Array
}

/** A collapsed node is one slot; an open node's slots are its children's, plus
 *  its own row in the outline (schema 11.3). O(drawn nodes). */
export function assignSlots(tree: DrawnTree, exp: Expansion, form: Form): Slots {
  const outline = form === 'outline'
  const first = new Int32Array(tree.size).fill(-1)
  const count = new Int32Array(tree.size)
  const slotNode: number[] = []
  const drawn: number[] = []
  const walk = (i: number) => {
    drawn.push(i)
    first[i] = slotNode.length
    if (isOpen(tree, exp, i)) {
      if (outline) slotNode.push(i)
      for (let j = i + 1; j < tree.end[i]; j = tree.end[j]) walk(j)
    } else slotNode.push(i)
    count[i] = slotNode.length - first[i]
  }
  for (const o of tree.orderNodes) walk(o)
  return { outline, first, count, total: slotNode.length, slotNode: Int32Array.from(slotNode), drawn: Int32Array.from(drawn) }
}

// -- Metrics -------------------------------------------------------------------------

export interface Metrics {
  readonly rem: number
  readonly boxW: number
  readonly boxH: number
  readonly form: Form
  readonly outline: boolean
  /** Names is Both: full zoom gives every leaf two lines. */
  readonly both: boolean
  /** The least extent for a label of one line: the level-of-detail threshold. */
  readonly line: number
  /** The room a label needs to take its second line. */
  readonly twoLine: number
  /** The pitch of one leaf at full zoom. */
  readonly kMax: number
  readonly headH: number
  readonly padTop: number
  readonly padBot: number
  readonly padX: number
  readonly linkW: number
  readonly indentW: number
  readonly planeW: number
  /** The four column starts (columns form). */
  readonly xs: readonly [number, number, number, number]
}

export function formFor(boxW: number, rem: number): Form {
  return boxW >= COLUMNS_MIN_REM * rem ? 'columns' : 'outline'
}

/** The full-zoom pitch in rem (schema 11.3's table). */
export function kMaxRem(form: Form, both: boolean, stillTier: boolean): number {
  if (form === 'outline') return both ? (stillTier ? 2.75 : 2.5) : (stillTier ? 2.125 : 1.75)
  return both ? (stillTier ? 2.5 : 2.25) : (stillTier ? 1.875 : 1.625)
}

export interface MetricsInput {
  readonly rem: number
  readonly boxW: number
  readonly boxH: number
  readonly both: boolean
  readonly stillTier: boolean
}

/** Every length in pixels from the root font size, so it follows the in-app text scale. */
export function metricsFor({ rem, boxW, boxH, both, stillTier }: MetricsInput): Metrics {
  const form = formFor(boxW, rem)
  const outline = form === 'outline'
  const padX = 0.75 * rem
  const planeW = outline ? Math.max(boxW, 17 * rem) : Math.max(boxW, COLUMNS_MIN_REM * rem)
  const W = planeW - 2 * padX
  return {
    rem, boxW, boxH, form, outline, both,
    line: (outline ? 1.375 : 1.125) * rem,
    twoLine: (outline ? 2.125 : 1.875) * rem,
    kMax: kMaxRem(form, both, stillTier) * rem,
    headH: outline ? 0 : 1.75 * rem,
    padTop: 0.5 * rem,
    padBot: 0.75 * rem,
    padX,
    linkW: 1.75 * rem,
    indentW: 1.125 * rem,
    planeW,
    xs: [padX, padX + 0.26 * W, padX + 0.545 * W, padX + 0.7 * W],
  }
}

const usable = (m: Metrics) => Math.max(1, m.boxH - m.headH - m.padTop - m.padBot)

/** The true fit (design-spec 9.5): the whole drawn tree inside the box, from the top, no floor. */
export function kFit(m: Metrics, total: number): number {
  return Math.min(m.kMax, usable(m) / Math.max(1, total))
}

export function planeHeight(m: Metrics, total: number, k: number): number {
  return m.padTop + total * k + m.padBot
}

function maxScroll(m: Metrics, total: number, k: number): number {
  return Math.max(0, m.headH + planeHeight(m, total, k) - m.boxH)
}

// -- The view ------------------------------------------------------------------------

export interface TreeAnchor {
  readonly level: TreeLevel
  readonly ref: number
  /** How far the node's top sits from the box's top, in pixels, in (-k, 0]. */
  readonly offset: number
}

/** Session state in the tab (schema 11.3): kept by every relayout. */
export interface TreeView {
  /** k / kMax: 1 is full zoom. */
  readonly zoom: number
  /** True while the view sits at the whole-tree fit. */
  readonly atFit: boolean
  /** The node at the top of the box; null is the top of the tree. */
  readonly anchor: TreeAnchor | null
}
export const ARRIVAL_VIEW: TreeView = { zoom: 1, atFit: false, anchor: null }

/** `k` for a view in a box. */
export function kOf(view: TreeView, m: Metrics, total: number): number {
  const lo = kFit(m, total)
  return view.atFit ? lo : clamp(view.zoom * m.kMax, lo, m.kMax)
}

/** The node whose row holds the top of the box. */
export function captureAnchor(tree: DrawnTree, slots: Slots, scrollTop: number, k: number, m: Metrics): TreeAnchor | null {
  const y = scrollTop - m.padTop
  if (y <= 0.5 || slots.total === 0) return null
  const s = Math.min(slots.total - 1, Math.floor(y / k))
  const n = slots.slotNode[s]
  return { level: tree.level[n] as TreeLevel, ref: tree.ref[n], offset: clamp(m.padTop + slots.first[n] * k - scrollTop, -k, 0) }
}

/** The asset parent of a taxon (species to genus to family to order). */
function assetParent(index: FamilyIndex, level: TreeLevel, ref: number): { level: TreeLevel; ref: number } | null {
  if (level === 3) return ref >= 0 && ref < index.speciesGenus.length ? { level: 2, ref: index.speciesGenus[ref] } : null
  if (level === 2) return ref >= 0 && ref < index.genera.length ? { level: 1, ref: index.genera[ref].family } : null
  if (level === 1) return ref >= 0 && ref < index.families.length ? { level: 0, ref: index.families[ref].order } : null
  return null
}

/** The scroll offset that puts the anchor back at its offset; a node no longer
 *  in the model falls back to its nearest ancestor in the asset, a node not
 *  drawn to its nearest drawn ancestor, and then to the top (schema 11.3). */
export function anchorScrollTop(tree: DrawnTree, slots: Slots, index: FamilyIndex, anchor: TreeAnchor | null, k: number, m: Metrics): number {
  if (anchor === null) return 0
  let level: TreeLevel = anchor.level
  let ref = anchor.ref
  let exact = true
  let i = tree.byKey.get(nodeKey(level, ref))
  while (i === undefined) {
    const up = assetParent(index, level, ref)
    if (up === null) return 0
    level = up.level; ref = up.ref; exact = false
    i = tree.byKey.get(nodeKey(level, ref))
  }
  while (i >= 0 && slots.first[i] < 0) { i = tree.parent[i]; exact = false }
  if (i < 0) return 0
  const off = exact ? clamp(anchor.offset, -k, 0) : 0
  return clamp(m.padTop + slots.first[i] * k - off, 0, maxScroll(m, slots.total, k))
}

export interface Placement {
  readonly k: number
  readonly scrollTop: number
  readonly atFit: boolean
}

/** A zoom to `kWanted` about a point `anchorY` from the box's top (the
 *  middle by default), keeping the slot under that point fixed (11.2's rule);
 *  clamped to [fit, full], snapping to either end within 6%. */
export function zoomTo(kWanted: number, anchorY: number | null, kNow: number, scrollTop: number, m: Metrics, total: number): Placement {
  const lo = kFit(m, total)
  let k = clamp(kWanted, lo, m.kMax)
  if (k / lo < SNAP) k = lo
  if (m.kMax / k < SNAP) k = m.kMax
  const ay = anchorY ?? m.headH + (m.boxH - m.headH) / 2
  const slot = (scrollTop + ay - m.headH - m.padTop) / (kNow > 0 ? kNow : k)
  return { k, scrollTop: clamp(m.padTop + slot * k + m.headH - ay, 0, maxScroll(m, total, k)), atFit: k === lo }
}

/** The scroll offset that centers a span of slots in the visible part of the box. */
export function centeredScroll(first: number, count: number, k: number, m: Metrics, total: number): number {
  const c = m.padTop + (first + count / 2) * k
  return clamp(c - (m.boxH - m.headH) / 2, 0, maxScroll(m, total, k))
}

/** The pitch that fits a span of slots in the box (Focus, a press on a count). */
export function focusK(count: number, m: Metrics, total: number): number {
  return clamp(usable(m) / Math.max(1, count), kFit(m, total), m.kMax)
}

/** The scroll offset after a selection: centered when out of view (a keyboard
 *  move, find, the readout's lineage), or the least scroll that shows it (a
 *  press on the node itself; design-spec 9.6). */
export function selectionScroll(slots: Slots, i: number, k: number, scrollTop: number, m: Metrics, least: boolean): number {
  const first = slots.first[i]
  if (first < 0) return scrollTop
  const visH = m.boxH - m.headH
  const L = m.line
  const y0 = m.padTop + first * k
  if (least) {
    const y1 = y0 + Math.min(slots.count[i] * k, Math.max(k, L) * 2)
    if (y1 > scrollTop + visH - 4) return clamp(y1 - visH + 8, 0, maxScroll(m, slots.total, k))
    if (y0 < scrollTop + 4) return clamp(y0 - 8, 0, maxScroll(m, slots.total, k))
    return scrollTop
  }
  const y1 = m.padTop + (first + slots.count[i]) * k
  const out = y1 - y0 >= L ? (y1 < scrollTop + L || y0 > scrollTop + visH - L) : (y0 < scrollTop + L / 2 || y1 > scrollTop + visH - L / 2)
  return out ? centeredScroll(first, slots.count[i], k, m, slots.total) : scrollTop
}

/** A view written from a placement. */
export function viewOf(tree: DrawnTree, slots: Slots, p: Placement, m: Metrics): TreeView {
  return { zoom: p.k / m.kMax, atFit: p.atFit, anchor: captureAnchor(tree, slots, p.scrollTop, p.k, m) }
}

// -- Geometry along the depth axis -----------------------------------------------------

export function xOf(m: Metrics, depth: number): number {
  return m.outline ? m.padX + depth * m.indentW : m.xs[depth]
}

/** A label's width at a depth. */
export function widthOf(m: Metrics, depth: number): number {
  if (m.outline) return m.planeW - xOf(m, depth) - m.padX
  if (depth < 3) return m.xs[depth + 1] - m.xs[depth] - m.linkW
  return Math.min(m.planeW - m.padX - m.xs[3], 19 * m.rem)
}

// -- Level of detail and the cull (11.4) ---------------------------------------------

export interface Mark {
  readonly kind: 'node' | 'count'
  /** The node; for a count, the first of its run. */
  readonly node: number
  /** A count's last node (the node itself otherwise). */
  readonly last: number
  readonly runLength: number
  readonly species: number
  readonly depth: number
  /** The label's center on the leaf axis, in plane pixels. */
  readonly c: number
  /** Takes its second line (Both). */
  readonly two: boolean
  /** The parent label's center, or NaN for an order. */
  readonly parentC: number
  readonly parentDepth: number
  /** The active node or one of its ancestors. */
  readonly onPath: boolean
}

/** A run with no line at all, drawn as a dot on its edge. */
export interface Dot {
  readonly depth: number
  readonly c: number
  readonly parentC: number
  readonly parentDepth: number
}

export interface Culled {
  readonly marks: readonly Mark[]
  readonly dots: readonly Dot[]
  /** How many times the pitch was doubled to meet the cap. */
  readonly coarsened: number
  readonly truncated: boolean
  /** The drawn window on the leaf axis (the box plus half a box each side). */
  readonly win0: number
  readonly win1: number
}

export interface CullInput {
  readonly tree: DrawnTree
  readonly slots: Slots
  readonly exp: Expansion
  readonly k: number
  readonly scrollTop: number
  readonly m: Metrics
  /** The active node, or -1. */
  readonly active: number
  /** Whether a node has a second name to show in Both. */
  readonly hasAlt: (i: number) => boolean
}

/** Test seams: the level-of-detail rule off (the non-vacuity leg) and the cap. */
export interface CullOptions {
  readonly lod?: boolean
  readonly cap?: number
}

/** Work done by the last cull, for the linearity rows. */
export const cullWork = { items: 0 }

interface Item {
  node: number
  run: Item[] | null
  depth: number
  parent: Item | null
  y0: number
  y1: number
  ext: number
  forced: boolean
  d: number
  c: number
  lo: number
  hi: number
  r0: number
  r1: number
  two: boolean
  hidden: boolean
  sp: number
}

function runPass(input: CullInput, L: number, lod: boolean): Item[] {
  const { tree, slots, exp, k, scrollTop, m } = input
  const L2 = m.twoLine
  const outline = m.outline
  const Y = (s: number) => m.padTop + s * k
  const vis0 = scrollTop
  const vis1 = scrollTop + m.boxH - m.headH
  const win0 = vis0 - m.boxH / 2
  const win1 = vis1 + m.boxH / 2
  const onPath = new Set<number>()
  for (let p = input.active; p >= 0; p = tree.parent[p]) onPath.add(p)
  const first = slots.first
  const count = slots.count

  const stickyC = (it: Item, inset: number) => {
    const a = it.y0 + inset, b = it.y1 - inset
    const lo = Math.max(a, vis0 + 2), hi = Math.min(b, vis1 - 2)
    return hi - lo >= L ? (lo + hi) / 2 : clamp((lo + hi) / 2, a + L / 2, b - L / 2)
  }
  // Labels a line apart, each as near its own place as the others allow
  // (isotonic regression on the wanted centers, then held inside the room).
  const spread = (list: Item[], lo: number, hi: number) => {
    const n = list.length
    if (n === 0) return
    const blocks: { sum: number; cnt: number }[] = []
    for (let i = 0; i < n; i++) {
      let b = { sum: list[i].d - i * L, cnt: 1 }
      while (blocks.length > 0 && blocks[blocks.length - 1].sum / blocks[blocks.length - 1].cnt > b.sum / b.cnt) {
        const a = blocks.pop()!
        b = { sum: a.sum + b.sum, cnt: a.cnt + b.cnt }
      }
      blocks.push(b)
    }
    const qlo = lo + L / 2
    const qhi = Math.max(qlo, hi - L / 2 - (n - 1) * L)
    let i = 0
    for (const b of blocks) {
      const v = clamp(b.sum / b.cnt, qlo, qhi)
      for (let j = 0; j < b.cnt; j++, i++) list[i].c = v + i * L
    }
  }
  const own = (it: Item) => Math.max(it.ext / Math.max(1, count[it.node]), L)
  const want = (it: Item) => (outline ? it.y0 + own(it) / 2 : it.ext >= L ? stickyC(it, 0) : (it.y0 + it.y1) / 2)
  const inWin = (it: Item) => (it.y1 >= win0 && it.y0 <= win1) || (it.c >= win0 && it.c <= win1)
  const mk = (node: number, depth: number, parent: Item | null, y0: number, y1: number): Item => ({
    node, run: null, depth, parent, y0, y1, ext: y1 - y0, forced: onPath.has(node),
    d: 0, c: 0, lo: 0, hi: 0, r0: 0, r1: 0, two: false, hidden: false, sp: tree.species[node],
  })

  const out: Item[] = []
  const group = (kids: number[], depth: number, parent: Item | null, lo: number, hi: number) => {
    const pn = parent ? parent.node : -1
    const p0 = pn >= 0 ? Y(first[pn] + (outline ? 1 : 0)) : lo
    const p1 = pn >= 0 ? Y(first[pn] + count[pn]) : hi
    const sc = (hi - lo) / Math.max(1e-6, p1 - p0)
    const items = kids.map(n => mk(n, depth, parent, lo + (Y(first[n]) - p0) * sc, lo + (Y(first[n] + count[n]) - p0) * sc))
    cullWork.items += items.length
    let placed: Item[]
    if (!lod || items.length * L <= hi - lo + 0.5) {
      for (const it of items) it.d = want(it)
      placed = items
    } else {
      placed = []
      let prev: Item | null = null
      let run: Item[] = []
      const big = (it: Item) => it.ext >= L - 0.01 || it.forced
      const flush = (next: Item | null) => {
        if (run.length === 0) return
        const gLo = prev ? prev.r1 : lo
        const gHi = next ? next.r0 : hi
        const cap = Math.floor((gHi - gLo + 0.5) / L)
        if (run.length <= cap) {
          for (const it of run) it.d = (it.y0 + it.y1) / 2
          spread(run, gLo, gHi)
          for (const it of run) it.d = it.c
          placed.push(...run)
        } else {
          const a = run[0], b = run[run.length - 1]
          const bundle: Item = {
            node: a.node, run, depth, parent, y0: a.y0, y1: b.y1, ext: b.y1 - a.y0, forced: false,
            d: 0, c: 0, lo: 0, hi: 0, r0: 0, r1: 0, two: false, hidden: false, sp: run.reduce((t, r) => t + r.sp, 0),
          }
          if (cap >= 1) bundle.d = clamp((bundle.y0 + bundle.y1) / 2, gLo + L / 2, gHi - L / 2)
          else { bundle.hidden = true; bundle.c = clamp((bundle.y0 + bundle.y1) / 2, lo, hi) }
          placed.push(bundle)
        }
        run = []
      }
      for (const it of items) {
        if (!big(it)) { run.push(it); continue }
        if (outline) {
          it.r0 = it.y0
          it.r1 = Math.max(it.y1, it.y0 + L)
          it.d = it.y0 + own(it) / 2
        } else {
          const c0 = (it.y0 + it.y1) / 2
          const inset = clamp((it.ext - L) / 2, 0, 2 * L)
          it.r0 = Math.min(it.y0 + inset, c0 - L / 2)
          it.r1 = Math.max(it.y1 - inset, c0 + L / 2)
          it.d = it.ext >= L ? stickyC(it, inset) : c0
        }
        flush(it)
        placed.push(it)
        prev = it
      }
      flush(null)
    }
    // One pass keeps the group's labels a line apart inside its room; then each
    // label owns the room up to the line it shares with its neighbors, where its
    // own children are laid out, so cousins never collide.
    const shown = placed.filter(it => !it.hidden)
    spread(shown, lo, hi)
    for (let i = 0; i < shown.length; i++) {
      const it = shown[i], nx = shown[i + 1]
      it.lo = i > 0 ? shown[i - 1].hi : lo
      it.hi = nx ? clamp(it.y1, it.c + L / 2, nx.c - L / 2) : hi
    }
    if (m.both) {
      for (const it of shown) {
        if (it.run !== null || !input.hasAlt(it.node)) continue
        if (outline) it.two = own(it) >= L2 - 0.5
        else if (it.hi - it.lo >= L2 - 0.5) { it.two = true; it.c = clamp(it.c, it.lo + L2 / 2, it.hi - L2 / 2) }
      }
    }
    for (const it of placed) {
      if (!inWin(it) && !it.forced) continue
      out.push(it)
      if (it.run === null && !it.hidden && isOpen(tree, exp, it.node)) {
        const cLo = outline ? Math.max(it.c + L / 2, Math.min(it.c + own(it) / 2, it.hi)) : it.lo
        group(childrenOf(tree, it.node), depth + 1, it, cLo, it.hi)
      }
    }
  }
  if (slots.total > 0) group(Array.from(tree.orderNodes), 0, null, Y(0), Y(slots.total))
  return out
}

/** What to mount for the window, under the cap (NFR-04). */
export function cullTree(input: CullInput, options: CullOptions = {}): Culled {
  const lod = options.lod !== false
  const cap = options.cap ?? DIAGRAM_MOUNTED_MAX
  const { m, scrollTop } = input
  cullWork.items = 0
  let L = m.line
  let items: Item[]
  let coarsened = 0
  for (;;) {
    items = runPass(input, L, lod)
    const n = items.reduce((t, it) => t + (it.hidden ? 0 : 1), 0)
    if (n <= cap || !lod || coarsened >= DIAGRAM_COARSEN_MAX) break
    L *= 2
    coarsened += 1
  }
  let shown = items.filter(it => !it.hidden)
  let truncated = false
  if (shown.length > cap) {
    truncated = true
    const forced = shown.filter(it => it.forced)
    let room = Math.max(0, cap - forced.length)
    shown = shown.filter(it => it.forced || room-- > 0)
  }
  const marks: Mark[] = shown.map(it => ({
    kind: it.run === null ? 'node' : 'count',
    node: it.node,
    last: it.run === null ? it.node : it.run[it.run.length - 1].node,
    runLength: it.run === null ? 1 : it.run.length,
    species: it.sp,
    depth: it.depth,
    c: it.c,
    two: it.two,
    parentC: it.parent ? it.parent.c : NaN,
    parentDepth: it.parent ? it.parent.depth : -1,
    onPath: it.forced,
  }))
  const dots: Dot[] = items.filter(it => it.hidden).map(it => ({
    depth: it.depth, c: it.c, parentC: it.parent ? it.parent.c : NaN, parentDepth: it.parent ? it.parent.depth : -1,
  }))
  return { marks, dots, coarsened, truncated, win0: scrollTop - m.boxH / 2, win1: scrollTop + m.boxH - m.headH + m.boxH / 2 }
}

/** The underlay's three paths (design-spec 9.2, 9.3): edges, the active
 *  lineage, and the dots of runs that have no line. Plane coordinates. */
export function edgePaths(culled: Culled, m: Metrics): { line: string; path: string; dots: string } {
  const f = (v: number) => v.toFixed(1)
  let line = '', path = '', dots = ''
  const L = m.line
  for (const mk of culled.marks) {
    if (Number.isNaN(mk.parentC)) continue
    const x1 = xOf(m, mk.depth)
    let seg: string
    if (m.outline) {
      const px = xOf(m, mk.parentDepth) + 0.5 * m.rem
      seg = `M${f(px)},${f(mk.parentC + L / 2 - 3)}V${f(mk.c)}H${f(x1 + (mk.kind === 'node' ? 0 : -3))}`
    } else {
      const xe = x1 - 3, x0 = x1 - m.linkW, mx = (x0 + xe) / 2
      seg = `M${f(x0)},${f(mk.parentC)}C${f(mx)},${f(mk.parentC)} ${f(mx)},${f(mk.c)} ${f(xe)},${f(mk.c)}`
    }
    if (mk.kind === 'node' && mk.onPath) path += seg
    else line += seg
  }
  for (const d of culled.dots) {
    const x1 = xOf(m, d.depth)
    const xe = x1 - 9
    if (!m.outline && !Number.isNaN(d.parentC)) {
      const x0 = x1 - m.linkW, mx = (x0 + xe) / 2
      line += `M${f(x0)},${f(d.parentC)}C${f(mx)},${f(d.parentC)} ${f(mx)},${f(d.c)} ${f(xe)},${f(d.c)}`
    }
    const dx = m.outline ? x1 : xe
    dots += `M${f(dx)},${f(d.c)}m-2.5,0a2.5,2.5 0 1,0 5,0a2.5,2.5 0 1,0 -5,0`
  }
  return { line, path, dots }
}

// -- The keyboard (11.6; design-spec 9.8) ------------------------------------------------

export type KeyAction =
  | { readonly kind: 'select'; readonly node: number }
  | { readonly kind: 'toggle'; readonly node: number }
  | { readonly kind: 'zoom'; readonly dir: 1 | -1 }
  | { readonly kind: 'fit' }
  | { readonly kind: 'readout' }
  | null

const MOVE_KEYS = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter', ' ', 'Home', 'End'])

/** What a key does on the tree, given the active node (-1 for none). */
export function keyAction(tree: DrawnTree, slots: Slots, exp: Expansion, active: number, key: string): KeyAction {
  if (key === '+' || key === '=') return { kind: 'zoom', dir: 1 }
  if (key === '-' || key === '_') return { kind: 'zoom', dir: -1 }
  if (key === '0') return { kind: 'fit' }
  if (!MOVE_KEYS.has(key) || tree.orderNodes.length === 0) return null
  if (active < 0) return { kind: 'select', node: tree.orderNodes[0] }
  const hasKids = tree.childCount[active] > 0 && tree.level[active] < 3
  const open = isOpen(tree, exp, active)
  if (key === 'Enter' || key === ' ') return hasKids ? { kind: 'toggle', node: active } : { kind: 'readout' }
  if (key === 'ArrowLeft') {
    if (slots.outline && open) return { kind: 'toggle', node: active }
    const p = tree.parent[active]
    return p >= 0 ? { kind: 'select', node: p } : null
  }
  if (key === 'ArrowRight') {
    if (!hasKids) return null
    if (!open) return { kind: 'toggle', node: active }
    const kids = childrenOf(tree, active)
    return { kind: 'select', node: kids[Math.min(kids.length - 1, Math.floor((kids.length - 1) / 2))] }
  }
  // Up, Down, Home, End: along the drawn nodes at the same level (columns) or in reading order (outline).
  const lv = tree.level[active]
  const list: number[] = []
  for (const n of slots.drawn) if (slots.outline || tree.level[n] === lv) list.push(n)
  if (list.length === 0) return null
  const at = list.indexOf(active)
  const j = key === 'Home' ? 0 : key === 'End' ? list.length - 1 : clamp(at + (key === 'ArrowDown' ? 1 : -1), 0, list.length - 1)
  return { kind: 'select', node: list[j] }
}
