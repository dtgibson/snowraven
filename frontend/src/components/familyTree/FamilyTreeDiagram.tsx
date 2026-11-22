// The Family Tree tab's tree view (family-rollups-and-tree schema 11; design-
// spec 9). Lazy: its own chunk with `lib/familyTreeLayout.ts`, so the table
// path never loads it.
//
// PLAIN DOM, LAYOUT-DRIVEN (11.1). Labels are absolutely positioned elements on
// a plane inside one native scroll box; zoom is one number, `k`, the pixels a
// leaf slot gets, and a zoom step re-lays the tree out at once. Nothing is
// scaled (no CSS zoom, transform scale or SVG viewBox scaling of text). Pan is
// the box's own scrolling; a mouse drag writes scrollLeft and scrollTop under
// pointer capture with no threshold, easing or motion after release, and no
// scroll-snap anywhere (ui.md v1.0.29). Edges are three paths in one SVG
// underlay covering only the drawn window.
//
// THE VIEW (11.3) is a fraction of full zoom and the node at the top of the
// box with its offset. The scroll offset is DERIVED from it each render and
// written to the box in a layout effect, so a relayout (a resize, a change of
// form, Names, text scale or model) keeps the place with no extra state and
// never scrolls to the active node. The explicit moves that may scroll are the
// handlers below: a keyboard move, find, the readout's lineage, a press on a
// node or a count, Fit, Reset, Expand all, Collapse all, Focus.
//
// ONE TAB STOP (11.6). The box is `role="tree"` with the single literal
// tabIndex, every handler and `aria-activedescendant`; tree items carry no
// tabIndex, anchor or handler, and ids keyed on the drawn-tree index. A press
// is resolved by the box from the element's index attribute. The readout
// after the box renders the active species through <BirdName> (11.7, the
// bird-names.md exception for the tree's own labels).
//
// The tree tools render into the tab's toolbar through a portal, so the tools
// and their disabled states belong to the component that knows the zoom.

import { useCallback, useEffect, useEffectEvent, useId, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { ChevronRight, ChevronsDownUp, ChevronsUpDown, ExternalLink, Focus, RotateCcw, Scan, ZoomIn, ZoomOut } from 'lucide-react'
import { Button } from '../ui/Button'
import { BirdName } from '../BirdName'
import { MediaPresenceCell } from '../MediaPresenceCell'
import { OutboundLink } from '../OutboundLink'
import type { FamilyIndex } from '../../lib/familyTreeAsset'
import type { FamilyModel, FamilyNode, OrderNode } from '../../lib/familyTreeModel'
import { familyNames, genusNames, nameOf, orderNames, namingWords, type Level, type NamesState, type Naming } from '../../lib/familyTreeNames'
import { bowFamilyHref } from '../../lib/familyTreeLinks'
import {
  NO_EXPANSION, ZOOM_STEP,
  anchorScrollTop, arrivalExpansion, assignSlots, buildDrawnTree, centeredScroll, childrenOf, cullTree, edgePaths,
  focusK, fullExpansion, isOpen, kFit, kOf, keyAction, metricsFor, nodeKey, planeHeight, selectionScroll, setSizeOf, toggled,
  viewOf, widthOf, withAncestorsOpen, xOf, zoomTo,
  type DrawnTree, type Expansion, type Metrics, type Placement, type Slots, type TreeLevel, type TreeView,
} from '../../lib/familyTreeLayout'
import {
  BOW_LINK_TEXT, COLLAPSE, COLLAPSE_ALL, COLUMN_HEADS, COUNT_TITLE, EXPAND, EXPAND_ALL, FIT, FIT_LABEL, FOCUS,
  HINT_COUNTS, HINT_REST, KIND_COPY, KIND_KEYS, LEVEL_WORDS, NOTHING_SELECTED, NOTHING_SENTENCE, READOUT_LABEL, RESET,
  RESET_LABEL, SEEN_WORLD, TREE_DESCRIPTION, TREE_LABEL, ZOOM_IN, ZOOM_OUT,
  barWidth, bowLinkLabel, countText, formatCount, kindRowParts, mediaWords, nodeFigures, share, speciesSeenParts,
  worldShareParts, zoomPercent,
} from '../../lib/familyTreeCopy'

const LEVELS: readonly Level[] = ['order', 'family', 'genus', 'species']

/** What the tab keeps while the tree view is not showing. */
export interface TreeSession {
  /** null until the first layout sets the arrival state. */
  readonly exp: Expansion | null
  /** The active node's key (nodeKey), or null. */
  readonly active: number | null
  readonly view: TreeView
}

export interface DiagramApi {
  /** A find reveal (FR-66): open the ancestors, make it active, zoom to a line per leaf, center it, focus the tree. */
  reveal(level: TreeLevel, ref: number): void
}

export interface FamilyTreeDiagramProps {
  model: FamilyModel
  index: FamilyIndex
  names: NamesState
  stillTier: boolean
  initial: TreeSession
  onSession: (s: TreeSession) => void
  /** The tab is the active tab; the session is handed over at once when it stops being. */
  showing: boolean
  /** The tab toolbar's tools group, where the tree tools render. */
  toolsEl: HTMLElement | null
  apiRef: RefObject<DiagramApi | null>
  codeFor: (name: string) => string | undefined
  onOpenSpecies?: (commonName: string) => void
}

interface Size { readonly w: number; readonly h: number; readonly rem: number }

function readRem(): number {
  const v = parseFloat(getComputedStyle(document.documentElement).fontSize)
  return Number.isFinite(v) && v > 0 ? v : 16
}

function presence(kinds: number | null) {
  const k = kinds ?? 0
  return { photo: (k & 1) !== 0, audio: (k & 2) !== 0, video: (k & 4) !== 0 }
}

/** The two names of a drawn node, read from the asset or the roster. */
function namesOfNode(tree: DrawnTree, index: FamilyIndex, i: number): { common: string | null; scientific: string | null } {
  const lv = tree.level[i]
  if (lv === 0) return orderNames(index, tree.ref[i])
  if (lv === 1) return familyNames(index, tree.ref[i])
  if (lv === 2) return genusNames(index, tree.ref[i])
  const leaf = tree.leaves[i]!
  return { common: leaf.name, scientific: leaf.sci }
}

interface Live {
  tree: DrawnTree
  slots: Slots
  exp: Expansion
  m: Metrics
  k: number
  top: number
  view: TreeView
  active: number
  /** A handler wrote a placement the box has not taken yet. */
  dirty: boolean
}

export default function FamilyTreeDiagram(props: FamilyTreeDiagramProps) {
  const { model, index, names, stillTier, initial, onSession, showing, toolsEl, apiRef, codeFor, onOpenSpecies } = props
  const uid = useId()
  const descId = `${uid}-desc`
  // The box as state, for the effects that attach to it, and as a ref, for the
  // handlers that write its scroll offsets.
  const [box, setBox] = useState<HTMLDivElement | null>(null)
  const boxRef = useRef<HTMLDivElement | null>(null)
  const attachBox = useCallback((el: HTMLDivElement | null) => { boxRef.current = el; setBox(el) }, [])
  const [probe, setProbe] = useState<HTMLSpanElement | null>(null)
  const readoutRef = useRef<HTMLDivElement | null>(null)
  const [size, setSize] = useState<Size | null>(null)
  const [exp, setExp] = useState<Expansion | null>(initial.exp)
  const [active, setActive] = useState<number | null>(initial.active)
  const [view, setView] = useState<TreeView>(initial.view)
  const [fresh, setFresh] = useState<ReadonlySet<number>>(() => new Set())
  const [dragging, setDragging] = useState(false)
  const live = useRef<Live | null>(null)

  const tree = useMemo(() => buildDrawnTree(model), [model])
  const famOf = useMemo(() => {
    const fam = new Map<number, FamilyNode>()
    const ord = new Map<number, OrderNode>()
    for (const o of model.orders) { ord.set(o.order, o); for (const f of o.families) fam.set(f.family, f) }
    return { fam, ord }
  }, [model])

  // A change that removes the active node from the model clears it and fits
  // (schema 11.5); state adjusted while rendering, never in an effect.
  const [prevTree, setPrevTree] = useState(tree)
  if (prevTree !== tree) {
    setPrevTree(tree)
    if (active !== null && !tree.byKey.has(active)) {
      setActive(null)
      setView(v => ({ ...v, atFit: true, anchor: null }))
    }
  }

  const both = names === 'both'
  const m = useMemo(() => (size === null ? null : metricsFor({ rem: size.rem, boxW: size.w, boxH: size.h, both, stillTier })), [size, both, stillTier])
  const form = m !== null ? m.form : null
  const effExp = useMemo(() => exp ?? (form !== null ? arrivalExpansion(tree, form) : NO_EXPANSION), [exp, form, tree])
  const slots = useMemo(() => (m === null ? null : assignSlots(tree, effExp, m.form)), [tree, effExp, m])
  const activeNode = active !== null ? tree.byKey.get(active) ?? -1 : -1
  const k = m !== null && slots !== null ? kOf(view, m, slots.total) : 0
  const top = m !== null && slots !== null ? anchorScrollTop(tree, slots, index, view.anchor, k, m) : 0

  const hasAlt = useCallback((i: number) => {
    const n = namesOfNode(tree, index, i)
    return nameOf(LEVELS[tree.level[i]], n.common, n.scientific, 'both').alt !== null
  }, [tree, index])
  const culled = useMemo(
    () => (m !== null && slots !== null ? cullTree({ tree, slots, exp: effExp, k, scrollTop: top, m, active: activeNode, hasAlt: both ? hasAlt : () => false }) : null),
    [tree, slots, effExp, k, top, m, activeNode, hasAlt, both])

  // -- Measurement: the box and a 1rem probe, observed (no setState in an effect body).
  useEffect(() => {
    if (box === null) return
    const measure = () => {
      const w = box.clientWidth, h = box.clientHeight
      if (w <= 0 || h <= 0) return
      const rem = readRem()
      setSize(s => (s !== null && s.w === w && s.h === h && s.rem === rem ? s : { w, h, rem }))
    }
    const ro = new ResizeObserver(measure)
    ro.observe(box)
    if (probe !== null) ro.observe(probe)
    return () => ro.disconnect()
  }, [box, probe])

  // The arrival state is set once, at the first layout (design-spec 9.6).
  const arrivalSet = exp !== null
  useEffect(() => {
    if (arrivalSet || m === null) return
    const t = setTimeout(() => setExp(e => e ?? arrivalExpansion(tree, m.form)), 0)
    return () => clearTimeout(t)
  }, [arrivalSet, m, tree])

  // -- The box takes the derived scroll offset; handlers read the latest values.
  useLayoutEffect(() => {
    const el = boxRef.current
    if (el === null || m === null || slots === null) return
    if (Math.abs(el.scrollTop - top) > 0.5) el.scrollTop = top
    live.current = { tree, slots, exp: effExp, m, k, top, view, active: activeNode, dirty: false }
  })

  // The session reaches the tab a moment after it settles (it outlives the
  // view), and at once when the view switches away from the tree (the diagram
  // unmounts) or the tab stops showing, so no change inside the pause is lost.
  useEffect(() => {
    const t = setTimeout(() => onSession({ exp, active, view }), 250)
    return () => clearTimeout(t)
  }, [exp, active, view, onSession])
  const flushSession = useEffectEvent(() => onSession({ exp, active, view }))
  useEffect(() => () => flushSession(), [])
  useEffect(() => { if (!showing) flushSession() }, [showing])

  // -- Moves ---------------------------------------------------------------------------
  const curTop = () => {
    const L = live.current!
    const el = boxRef.current
    return L.dirty || el === null ? L.top : el.scrollTop
  }
  const place = (slotsNext: Slots, p: Placement) => {
    const L = live.current!
    const v = viewOf(L.tree, slotsNext, p, L.m)
    L.view = v; L.k = p.k; L.top = p.scrollTop; L.slots = slotsNext; L.dirty = true
    setView(v)
  }
  const zoomBy = (factor: number, anchorY: number | null) => {
    const L = live.current
    if (L === null) return
    place(L.slots, zoomTo(L.k * factor, anchorY, L.k, curTop(), L.m, L.slots.total))
  }
  const fit = () => {
    const L = live.current
    if (L === null) return
    place(L.slots, { k: kFit(L.m, L.slots.total), scrollTop: 0, atFit: true })
  }
  const setAll = (next: Expansion, atFit: boolean) => {
    const L = live.current
    if (L === null) return
    const s2 = assignSlots(L.tree, next, L.m.form)
    L.exp = next
    setExp(next)
    setFresh(new Set())
    place(s2, { k: atFit ? kFit(L.m, s2.total) : L.m.kMax, scrollTop: 0, atFit })
  }
  const reset = () => {
    const L = live.current
    if (L === null) return
    const next = arrivalExpansion(L.tree, L.m.form)
    const s2 = assignSlots(L.tree, next, L.m.form)
    L.exp = next
    setExp(next)
    setActive(null)
    setFresh(new Set())
    if (boxRef.current !== null) boxRef.current.scrollLeft = 0
    place(s2, { k: L.m.kMax, scrollTop: 0, atFit: false })
  }
  const toggle = (i: number) => {
    const L = live.current
    if (L === null || L.tree.level[i] === 3) return
    const before = L.m.padTop + L.slots.first[i] * L.k - curTop()
    const opening = !isOpen(L.tree, L.exp, i)
    const next = toggled(L.tree, L.exp, i)
    const s2 = assignSlots(L.tree, next, L.m.form)
    const lo2 = kFit(L.m, s2.total)
    let k2: number, atFit: boolean
    if (L.view.atFit && L.k < L.m.line) { k2 = lo2; atFit = true } else { k2 = Math.min(L.m.kMax, Math.max(lo2, L.k)); atFit = k2 === lo2 }
    L.exp = next
    setExp(next)
    setFresh(opening ? new Set(childrenOf(L.tree, i)) : new Set())
    place(s2, { k: k2, scrollTop: Math.max(0, L.m.padTop + s2.first[i] * k2 - before), atFit })
  }
  const nudgeX = (i: number) => {
    const L = live.current
    const el = boxRef.current
    if (L === null || el === null || L.m.outline || L.m.planeW <= L.m.boxW + 1) return
    const x = xOf(L.m, L.tree.level[i])
    if (x < el.scrollLeft + 8 || x > el.scrollLeft + L.m.boxW * 0.6) el.scrollLeft = Math.max(0, x - L.m.boxW * 0.25)
  }
  const select = (i: number, least: boolean) => {
    const L = live.current
    if (L === null) return
    setActive(nodeKey(L.tree.level[i] as TreeLevel, L.tree.ref[i]))
    L.active = i
    const t = selectionScroll(L.slots, i, L.k, curTop(), L.m, least)
    if (Math.abs(t - curTop()) > 0.5) place(L.slots, { k: L.k, scrollTop: t, atFit: L.view.atFit })
    if (!least) nudgeX(i)
  }
  const focusSpan = (firstNode: number, lastNode: number) => {
    const L = live.current
    if (L === null) return
    const a = L.slots.first[firstNode]
    const span = L.slots.first[lastNode] + L.slots.count[lastNode] - a
    const k2 = focusK(span, L.m, L.slots.total)
    place(L.slots, { k: k2, scrollTop: centeredScroll(a, span, k2, L.m, L.slots.total), atFit: k2 === kFit(L.m, L.slots.total) })
  }
  const reveal = (level: TreeLevel, ref: number) => {
    const L = live.current
    if (L === null) return
    const i = L.tree.byKey.get(nodeKey(level, ref))
    if (i === undefined) return
    const next = withAncestorsOpen(L.tree, L.exp, i)
    const s2 = assignSlots(L.tree, next, L.m.form)
    const lo2 = kFit(L.m, s2.total)
    const k2 = Math.min(L.m.kMax, Math.max(lo2, L.k, L.m.line))
    L.exp = next
    setExp(next)
    setActive(nodeKey(level, ref))
    place(s2, { k: k2, scrollTop: centeredScroll(s2.first[i], s2.count[i], k2, L.m, s2.total), atFit: k2 === lo2 })
    nudgeX(i)
    boxRef.current?.focus({ preventScroll: true })
  }
  const revealRef = useRef(reveal)
  useLayoutEffect(() => { revealRef.current = reveal })
  useImperativeHandle(apiRef, () => ({ reveal: (lv, r) => revealRef.current(lv, r) }), [])

  /** A press resolved by the box from the pressed element's index attribute. */
  const act = (target: EventTarget | null) => {
    const L = live.current
    const host = boxRef.current
    if (L === null || !(target instanceof Element) || host === null) return
    const el = target.closest('[data-n]')
    if (el === null || !host.contains(el)) return
    const i = Number(el.getAttribute('data-n'))
    if (el.hasAttribute('data-last')) { focusSpan(i, Number(el.getAttribute('data-last'))); return }
    const onTwisty = target.closest('[data-tw]') !== null
    const hasKids = L.tree.level[i] < 3 && L.tree.childCount[i] > 0
    if (hasKids && (onTwisty || L.active === i)) { setActive(nodeKey(L.tree.level[i] as TreeLevel, L.tree.ref[i])); toggle(i) }
    else select(i, true)
  }

  const zoomRef = useRef(zoomBy)
  useLayoutEffect(() => { zoomRef.current = zoomBy })

  // -- Native listeners: scroll, Ctrl wheel, WebKit pinch, touch pinch, and the
  // whole box brought into view on a press or focus (11.5).
  useEffect(() => {
    const el = boxRef.current
    if (box === null || el === null) return
    let raf = 0
    const onScroll = () => {
      if (raf !== 0) return
      raf = requestAnimationFrame(() => {
        raf = 0
        const L = live.current
        if (L === null || L.dirty) return
        const t = el.scrollTop
        if (Math.abs(t - L.top) <= 0.5) return
        L.top = t
        const a = viewOf(L.tree, L.slots, { k: L.k, scrollTop: t, atFit: L.view.atFit }, L.m)
        setView(v => ({ ...v, anchor: a.anchor }))
        setFresh(f => (f.size === 0 ? f : new Set()))
      })
    }
    const rel = (clientY: number) => clientY - el.getBoundingClientRect().top
    const onWheel = (e: WheelEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return
      e.preventDefault()
      zoomRef.current(Math.exp(-e.deltaY * 0.01), rel(e.clientY))
    }
    let gestureK = 0
    const onGestureStart = (e: Event) => { e.preventDefault(); gestureK = live.current?.k ?? 0 }
    const onGestureChange = (e: Event) => {
      e.preventDefault()
      const L = live.current
      const g = e as Event & { scale: number; clientY: number }
      if (L === null || gestureK <= 0) return
      zoomRef.current((gestureK * g.scale) / L.k, rel(g.clientY))
    }
    const onGestureEnd = (e: Event) => e.preventDefault()
    let pinch: { d: number; k: number } | null = null
    const dist = (t: TouchList) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY)
    const onTouchStart = (e: TouchEvent) => { if (e.touches.length === 2) pinch = { d: dist(e.touches), k: live.current?.k ?? 0 } }
    const onTouchMove = (e: TouchEvent) => {
      const L = live.current
      if (pinch === null || e.touches.length !== 2 || L === null || pinch.d <= 0) return
      e.preventDefault()
      zoomRef.current((pinch.k * dist(e.touches)) / pinch.d / L.k, rel((e.touches[0].clientY + e.touches[1].clientY) / 2))
    }
    const onTouchEnd = (e: TouchEvent) => { if (e.touches.length < 2) pinch = null }
    const wholeIntoView = () => {
      const r = el.getBoundingClientRect()
      if (r.top < 0 || r.bottom > window.innerHeight) el.scrollIntoView({ block: 'nearest' })
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    el.addEventListener('wheel', onWheel, { passive: false })
    el.addEventListener('gesturestart', onGestureStart)
    el.addEventListener('gesturechange', onGestureChange)
    el.addEventListener('gestureend', onGestureEnd)
    el.addEventListener('touchstart', onTouchStart, { passive: true })
    el.addEventListener('touchmove', onTouchMove, { passive: false })
    el.addEventListener('touchend', onTouchEnd, { passive: true })
    el.addEventListener('pointerdown', wholeIntoView, true)
    el.addEventListener('focus', wholeIntoView)
    return () => {
      if (raf !== 0) cancelAnimationFrame(raf)
      el.removeEventListener('scroll', onScroll)
      el.removeEventListener('wheel', onWheel)
      el.removeEventListener('gesturestart', onGestureStart)
      el.removeEventListener('gesturechange', onGestureChange)
      el.removeEventListener('gestureend', onGestureEnd)
      el.removeEventListener('touchstart', onTouchStart)
      el.removeEventListener('touchmove', onTouchMove)
      el.removeEventListener('touchend', onTouchEnd)
      el.removeEventListener('pointerdown', wholeIntoView, true)
      el.removeEventListener('focus', wholeIntoView)
    }
  }, [box])
  // -- Pointer: a mouse drag pans one to one; a press that moved under 4px acts.
  const drag = useRef<{ x: number; y: number; sl: number; st: number; moved: number; target: EventTarget | null; id: number } | null>(null)
  const lastPointer = useRef('mouse')

  if (m === null || slots === null || culled === null) {
    // The same skeleton as the measured render, child for child, so the box
    // element React mounts here is the one it keeps (its listeners, focus and
    // scroll survive the first measurement).
    return (
      <div className="sr-ft-treeview">
        {null}
        <div className="sr-ft-boxwrap">
          <span ref={setProbe} className="sr-ft-remprobe" aria-hidden="true" />
          <div ref={attachBox} className="sr-ft-box" role="tree" aria-label={TREE_LABEL} tabIndex={0} />
        </div>
      </div>
    )
  }

  const planeH = planeHeight(m, slots.total, k)
  const lo = kFit(m, slots.total)
  const atFitNow = k <= lo + 0.01
  const atMaxNow = k >= m.kMax - 0.01
  const paths = edgePaths(culled, m)
  const svgTop = Math.max(0, culled.win0)
  const svgH = Math.max(1, Math.min(planeH, culled.win1) - svgTop)
  const mediaShown = model.mediaShown

  const labelOf = (n: Naming, two: boolean) => {
    const nm = <span className={`sr-ft-nm${n.leadItalic ? ' is-sci' : ''}`}>{n.lead}</span>
    return two && n.alt !== null ? (
      <span className="sr-ft-names">{nm}<span className={`sr-ft-alt${n.altItalic ? ' is-sci' : ''}`}>{n.alt}</span></span>
    ) : nm
  }

  const marks = culled.marks.map(mk => {
    const lv = tree.level[mk.node]
    const x = xOf(m, mk.depth)
    const w = widthOf(m, mk.depth)
    if (mk.kind === 'count') {
      const style: CSSProperties = { left: x, top: mk.c - m.line / 2 + 2, height: m.line - 4, maxWidth: w }
      return (
        <div
          key={`c${mk.node}:${mk.runLength}`}
          className={`sr-ft-bundle${fresh.has(mk.node) ? ' is-new' : ''}`}
          role="presentation"
          title={COUNT_TITLE}
          data-n={mk.node}
          data-last={mk.last}
          style={style}
        >
          {countText(LEVELS[lv], mk.runLength, mk.species)}
        </div>
      )
    }
    const i = mk.node
    const nm = namesOfNode(tree, index, i)
    const naming = nameOf(LEVELS[lv], nm.common, nm.scientific, names)
    const open = isOpen(tree, effExp, i)
    const isActive = i === activeNode
    const H = mk.two ? m.twoLine : m.line
    const leaf = tree.leaves[i]
    const figures = lv === 3
      ? (mediaShown && leaf !== null ? `, ${mediaWords(leaf.kinds ?? 0).toLowerCase()}` : '')
      : `, ${nodeFigures(LEVELS[lv] as 'order' | 'family' | 'genus', tree.seen[i], tree.world[i])}`
    const style: CSSProperties = { left: x, top: mk.c - H / 2, width: lv === 3 || m.outline ? w : Math.max(4 * m.rem, w), height: H }
    return (
      <div
        key={`n${i}`}
        id={`${uid}-n-${i}`}
        role="treeitem"
        aria-level={lv + 1}
        aria-expanded={lv < 3 ? open : undefined}
        aria-selected={isActive}
        aria-setsize={setSizeOf(tree, i)}
        aria-posinset={tree.posInSet[i]}
        aria-label={`${LEVEL_WORDS[LEVELS[lv]]}, ${namingWords(naming)}${figures}`}
        data-n={i}
        className={`sr-ft-node sr-ft-node--${'ofgs'[lv]}${isActive ? ' is-active' : ''}${!isActive && mk.onPath ? ' is-path' : ''}${fresh.has(i) ? ' is-new' : ''}`}
        style={style}
      >
        {lv === 3 ? (
          <>
            {labelOf(naming, mk.two)}
            {mediaShown && leaf !== null ? <span aria-hidden="true" className="sr-ft-leafmedia"><MediaPresenceCell media={presence(leaf.kinds)} /></span> : null}
          </>
        ) : (
          <>
            <span className="sr-ft-chip">
              <span className="sr-ft-tw" data-tw="">
                <ChevronRight size={12} strokeWidth={2.6} aria-hidden="true" />
              </span>
              {labelOf(naming, mk.two)}
              <span className="sr-ft-ct"><b>{formatCount(tree.seen[i])}</b>{lv < 2 ? `/${formatCount(tree.world[i])}` : null}</span>
            </span>
            {open && !m.outline ? <span className="sr-ft-leader" /> : null}
          </>
        )}
      </div>
    )
  })

  const tools = (
    <>
      <span className="sr-ft-toolgroup">
        <Button type="button" className="sr-ft-tool sr-ft-tool--icon sr-touch-target" aria-label={ZOOM_OUT} disabled={atFitNow} onClick={() => zoomBy(1 / ZOOM_STEP, null)}>
          <ZoomOut size={15} strokeWidth={2.2} className="sr-ft-tool-glyph" aria-hidden="true" />
          <span className="cap">{ZOOM_OUT}</span>
        </Button>
        <span className="sr-ft-zoomval" aria-hidden="true">{zoomPercent(k / m.kMax)}</span>
        <Button type="button" className="sr-ft-tool sr-ft-tool--icon sr-touch-target" aria-label={ZOOM_IN} disabled={atMaxNow} onClick={() => zoomBy(ZOOM_STEP, null)}>
          <ZoomIn size={15} strokeWidth={2.2} className="sr-ft-tool-glyph" aria-hidden="true" />
          <span className="cap">{ZOOM_IN}</span>
        </Button>
        <Button type="button" className="sr-ft-tool sr-touch-target" aria-label={FIT_LABEL} disabled={atFitNow && top < 1} onClick={fit}>
          <Scan size={14} strokeWidth={2.2} className="sr-ft-tool-glyph" aria-hidden="true" />
          <span className="t">{FIT}</span>
        </Button>
      </span>
      <Button type="button" className="sr-ft-tool sr-touch-target" onClick={() => setAll(fullExpansion(tree), true)}>
        <ChevronsUpDown size={14} strokeWidth={2.2} className="sr-ft-tool-glyph" aria-hidden="true" />
        <span className="t">{EXPAND_ALL}</span>
      </Button>
      <Button type="button" className="sr-ft-tool sr-touch-target" onClick={() => setAll(NO_EXPANSION, false)}>
        <ChevronsDownUp size={14} strokeWidth={2.2} className="sr-ft-tool-glyph" aria-hidden="true" />
        <span className="t">{COLLAPSE_ALL}</span>
      </Button>
      <Button type="button" className="sr-ft-tool sr-touch-target" aria-label={RESET_LABEL} onClick={reset}>
        <RotateCcw size={14} strokeWidth={2.2} className="sr-ft-tool-glyph" aria-hidden="true" />
        <span className="t">{RESET}</span>
      </Button>
    </>
  )

  return (
    <div className="sr-ft-treeview" data-form={m.form}>
      {toolsEl !== null ? createPortal(tools, toolsEl) : null}
      <div className="sr-ft-boxwrap">
        <span ref={setProbe} className="sr-ft-remprobe" aria-hidden="true" />
        <div
          ref={attachBox}
          className={`sr-ft-box${dragging ? ' is-dragging' : ''}`}
          data-form={m.form}
          role="tree"
          aria-label={TREE_LABEL}
          aria-describedby={descId}
          aria-activedescendant={activeNode >= 0 && culled.marks.some(x => x.kind === 'node' && x.node === activeNode) ? `${uid}-n-${activeNode}` : undefined}
          tabIndex={0}
          onKeyDown={e => {
            const L = live.current
            if (e.target !== e.currentTarget || L === null) return
            const a = keyAction(L.tree, L.slots, L.exp, L.active, e.key)
            if (a === null) return
            e.preventDefault()
            if (a.kind === 'zoom') zoomBy(a.dir > 0 ? ZOOM_STEP : 1 / ZOOM_STEP, null)
            else if (a.kind === 'fit') fit()
            else if (a.kind === 'toggle') toggle(a.node)
            else if (a.kind === 'select') select(a.node, false)
            else {
              const target = readoutRef.current?.querySelector<HTMLElement>('.sr-birdname-link, a, button')
              target?.focus()
            }
          }}
          onPointerDown={e => {
            lastPointer.current = e.pointerType
            if (e.pointerType !== 'mouse' || e.button !== 0) return
            const b = e.currentTarget
            const r = b.getBoundingClientRect()
            if (e.clientX - r.left > b.clientWidth || e.clientY - r.top > b.clientHeight) return
            drag.current = { x: e.clientX, y: e.clientY, sl: b.scrollLeft, st: b.scrollTop, moved: 0, target: e.target, id: e.pointerId }
            b.setPointerCapture?.(e.pointerId)
          }}
          onPointerMove={e => {
            const d = drag.current
            if (d === null || e.pointerId !== d.id) return
            const dx = e.clientX - d.x, dy = e.clientY - d.y
            d.moved = Math.max(d.moved, Math.abs(dx), Math.abs(dy))
            if (d.moved >= 4 && !dragging) setDragging(true)
            e.currentTarget.scrollLeft = d.sl - dx
            e.currentTarget.scrollTop = d.st - dy
          }}
          onPointerUp={e => {
            const d = drag.current
            drag.current = null
            setDragging(false)
            if (d !== null && d.moved < 4) act(d.target ?? e.target)
          }}
          onPointerCancel={() => { drag.current = null; setDragging(false) }}
          onLostPointerCapture={() => { drag.current = null; setDragging(false) }}
          onClick={e => { if (lastPointer.current !== 'mouse') act(e.target) }}
          onDoubleClick={e => {
            if ((e.target as Element).closest('[data-n]') !== null) return
            zoomBy(ZOOM_STEP, e.clientY - e.currentTarget.getBoundingClientRect().top)
          }}
        >
          {!m.outline ? (
            <div className="sr-ft-colhead" aria-hidden="true" style={{ width: m.planeW }}>
              {COLUMN_HEADS.map((h, d) => (
                <span key={h.label} style={{ left: m.xs[d] + (d === 3 ? 6 : 4) }}>
                  {h.label}{h.seenWorld ? <em>{SEEN_WORLD}</em> : null}
                </span>
              ))}
            </div>
          ) : null}
          <div className="sr-ft-plane" style={{ width: m.planeW, height: planeH }}>
            {!m.outline ? (
              <>
                <div className="sr-ft-lane" style={{ left: 0, width: m.xs[1] - m.linkW / 2 }} />
                <div className="sr-ft-lane" style={{ left: m.xs[2] - m.linkW / 2, width: m.xs[3] - m.xs[2] }} />
              </>
            ) : null}
            <svg className="sr-ft-edges" aria-hidden="true" width={m.planeW} height={svgH} viewBox={`0 ${svgTop} ${m.planeW} ${svgH}`} style={{ top: svgTop }}>
              <path className="e-dot" d={paths.dots} />
              <path className="e-line" d={paths.line} />
              <path className="e-path" d={paths.path} />
            </svg>
            {marks}
          </div>
        </div>
        <span id={descId} className="sr-only">{TREE_DESCRIPTION}</span>
      </div>
      <Readout
        refEl={readoutRef}
        tree={tree}
        index={index}
        node={activeNode}
        famOf={famOf}
        mediaShown={mediaShown}
        open={activeNode >= 0 && isOpen(tree, effExp, activeNode)}
        hint={k < m.line - 0.01 ? HINT_COUNTS : HINT_REST}
        codeFor={codeFor}
        onOpenSpecies={onOpenSpecies}
        onSelect={i => { select(i, false); boxRef.current?.focus({ preventScroll: true }) }}
        onToggle={toggle}
        onFocusSpan={i => focusSpan(i, i)}
      />
    </div>
  )
}

interface ReadoutProps {
  refEl: RefObject<HTMLDivElement | null>
  tree: DrawnTree
  index: FamilyIndex
  node: number
  famOf: { fam: Map<number, FamilyNode>; ord: Map<number, OrderNode> }
  mediaShown: boolean
  open: boolean
  hint: string
  codeFor: (name: string) => string | undefined
  onOpenSpecies?: (commonName: string) => void
  onSelect: (i: number) => void
  onToggle: (i: number) => void
  onFocusSpan: (i: number) => void
}

/** The readout (design-spec 9.9): a region named "Selected" after the box,
 *  rendered from first paint, no live semantics. */
function Readout({ refEl, tree, index, node, famOf, mediaShown, open, hint, codeFor, onOpenSpecies, onSelect, onToggle, onFocusSpan }: ReadoutProps) {
  const eyebrow = (t: string) => <p className="sr-ft-eyebrow">{t}</p>
  const anc = (label: string, i: number) => {
    const n = namesOfNode(tree, index, i)
    const a = nameOf(LEVELS[tree.level[i]], n.common, n.scientific, 'common')
    return (
      <div className="sr-ft-ro-row" key={label}>
        <dt>{label}</dt>
        <dd>
          <Button type="button" className={`sr-ft-ro-anc${a.leadItalic ? ' is-sci' : ''}`} onClick={() => onSelect(i)}>{a.lead}</Button>
        </dd>
      </div>
    )
  }
  const ident = (kind: string, i: number) => {
    const n = namesOfNode(tree, index, i)
    const b = nameOf(LEVELS[tree.level[i]], n.common, n.scientific, 'both')
    return (
      <div className="ro-id">
        {eyebrow(kind)}
        <p className={`sr-ft-ro-name${b.leadItalic ? ' is-sci' : ''}`}>{b.lead}</p>
        {b.alt !== null ? <p className={`sr-ft-ro-sci${b.altItalic ? '' : ' is-upright'}`}>{b.alt}</p> : null}
      </div>
    )
  }
  const actions = (i: number) => (
    <div className="sr-ft-ro-actions">
      <Button type="button" className="sr-ft-tool sr-touch-target" onClick={() => onToggle(i)}>
        {open ? <ChevronsDownUp size={14} strokeWidth={2.2} className="sr-ft-tool-glyph" aria-hidden="true" /> : <ChevronsUpDown size={14} strokeWidth={2.2} className="sr-ft-tool-glyph" aria-hidden="true" />}
        <span className="t">{open ? COLLAPSE : EXPAND}</span>
      </Button>
      <Button type="button" className="sr-ft-tool sr-touch-target" onClick={() => onFocusSpan(i)}>
        <Focus size={14} strokeWidth={2.2} className="sr-ft-tool-glyph" aria-hidden="true" />
        <span className="t">{FOCUS}</span>
      </Button>
    </div>
  )
  const shareFig = (seen: number, world: number, unit: 'species' | 'families') => {
    const p = worldShareParts(seen, world, unit)
    return (
      <div className="sr-ft-ro-fig">
        <div className="sr-ft-ro-figline">
          <span><b>{p.seen}</b>{p.rest}</span>
          <span className="sr-ft-ro-pct">{share(seen, world)}</span>
        </div>
        <span className={seen > 0 ? 'sr-ft-bar' : 'sr-ft-bar is-zero'} aria-hidden="true"><i style={{ '--w': barWidth(seen, world) } as CSSProperties} /></span>
      </div>
    )
  }

  let body: ReactNode
  let rest = false
  if (node < 0) {
    rest = true
    body = (
      <>
        <div><div className="ro-id">{eyebrow(NOTHING_SELECTED)}<p className="sr-ft-ro-rest">{NOTHING_SENTENCE}</p></div></div>
        <div><p className="sr-ft-ro-rest">{hint}</p></div>
      </>
    )
  } else {
    const lv = tree.level[node]
    if (lv === 3) {
      const leaf = tree.leaves[node]!
      const g = tree.parent[node], f = tree.parent[g], o = tree.parent[f]
      body = (
        <>
          <div>
            <div className="ro-id">
              {eyebrow(LEVEL_WORDS.species)}
              <BirdName
                commonName={leaf.name}
                scientificName={leaf.sci !== '' ? leaf.sci : undefined}
                taxonCode={codeFor(leaf.name)}
                hasEntry
                onOpenSpecies={onOpenSpecies}
                showSci
                size="lg"
              />
            </div>
          </div>
          <div><dl className="sr-ft-ro-list">{anc(LEVEL_WORDS.genus, g)}{anc(LEVEL_WORDS.family, f)}{anc(LEVEL_WORDS.order, o)}</dl></div>
          <div>
            {mediaShown ? (
              <div className="sr-ft-ro-media"><MediaPresenceCell media={presence(leaf.kinds)} /><span>{mediaWords(leaf.kinds ?? 0)}</span></div>
            ) : null}
          </div>
        </>
      )
    } else if (lv === 2) {
      const p = speciesSeenParts(tree.seen[node])
      body = (
        <>
          <div>{ident(LEVEL_WORDS.genus, node)}<div className="sr-ft-ro-figline"><span><b>{p.n}</b>{p.rest}</span></div></div>
          <div><dl className="sr-ft-ro-list">{anc(LEVEL_WORDS.family, tree.parent[node])}{anc(LEVEL_WORDS.order, tree.parent[tree.parent[node]])}</dl></div>
          <div>{actions(node)}</div>
        </>
      )
    } else if (lv === 1) {
      const fam = famOf.fam.get(tree.ref[node])!
      const famName = index.families[tree.ref[node]].name
      const href = bowFamilyHref(index.families[tree.ref[node]].code)
      body = (
        <>
          <div>{ident(LEVEL_WORDS.family, node)}<dl className="sr-ft-ro-list">{anc(LEVEL_WORDS.order, tree.parent[node])}</dl></div>
          <div>
            {shareFig(fam.seen, fam.world, 'species')}
            {mediaShown && fam.withKind !== null && fam.items !== null ? (
              <dl className="sr-ft-ro-list">
                {KIND_KEYS.map((kk, ki) => {
                  const r = kindRowParts(kk, fam.withKind![ki], fam.items![ki])
                  return (
                    <div className="sr-ft-ro-row" key={kk}>
                      <dt>{KIND_COPY[kk].column}</dt>
                      <dd><b>{r.n}</b>{r.rest}{r.items !== null ? <span>{r.items}</span> : null}</dd>
                    </div>
                  )
                })}
              </dl>
            ) : null}
          </div>
          <div>
            {actions(node)}
            {href !== null ? (
              <div className="sr-ft-ro-links">
                <OutboundLink href={href} className="sr-ft-out" aria-label={bowLinkLabel(famName)}>
                  {BOW_LINK_TEXT}<ExternalLink size={12} strokeWidth={2.2} aria-hidden="true" />
                </OutboundLink>
              </div>
            ) : null}
          </div>
        </>
      )
    } else {
      const ord = famOf.ord.get(tree.ref[node])!
      body = (
        <>
          <div>{ident(LEVEL_WORDS.order, node)}</div>
          <div>{shareFig(ord.seen, ord.world, 'species')}{shareFig(ord.familiesSeen, ord.familiesWorld, 'families')}</div>
          <div>{actions(node)}</div>
        </>
      )
    }
  }
  return (
    <div ref={refEl} className="sr-ft-readout" role="region" aria-label={READOUT_LABEL}>
      <div key={node} className={`sr-ft-ro-body${rest ? ' is-rest' : ''}${node >= 0 ? ' is-in' : ''}`}>{body}</div>
    </div>
  )
}
