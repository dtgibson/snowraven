// Whether the "Search this area" control has room to exist (feature:
// search-this-area, OI-01 rework).
//
// The arithmetic lives in `searchControlFits` (lib/searchArea.ts), pure and
// unit-tested. This hook only READS the layout and feeds it, which is why there
// is nothing here to reason about except the measurement discipline:
//
//   * It measures against `discLineTop` — the top of the shipped disc line —
//     and NOT against the cluster's own overflow. The cluster is bottom
//     anchored, so the disc line's position is invariant to whether this
//     control (or a location-failure message) is rendered. That is what makes
//     the measurement free of the feedback loop a "does the cluster overflow"
//     reading would have: hiding the control shrinks the cluster, which would
//     immediately say it fits again.
//
//   * The row's natural height is the one term that IS control-dependent, so
//     the hook starts OPTIMISTIC (render, then measure before paint in a layout
//     effect) and remembers the last real measurement for the passes where the
//     row is not mounted. Every re-open re-measures the true value, so the
//     decision converges in one layout pass and cannot oscillate.
//
//   * `useLayoutEffect`, not `useEffect`: the correct layout must be on screen
//     from the first paint, the same reason TabNav measures its tab strip
//     there. TabNav is also the precedent for the decision itself — this app
//     already answers "it does not fit" by collapsing, measured rather than at
//     a fixed breakpoint.
//
// No `window.innerWidth`, no breakpoint arithmetic, no clock. The measurement
// runs on every render because the row mounting and unmounting is not something
// a ref can announce and MapExplorer's early return puts the render gate out of
// this hook's reach; it is a handful of rect reads inside a layout effect, where
// the browser has to lay out before paint anyway.
//
// A ResizeObserver is the WHOLE of the rest of the mechanism, not one half of
// it. There is no `window` `resize` listener here: this repo forbids JS
// window/resize/innerWidth checks by name and names the ResizeObserver as the
// sanctioned alternative, and one was measured to be redundant on top of that.
// The map area this observes is `flex: 1` in a viewport-filling flex column, so
// a window resize necessarily resizes it and the observer necessarily fires —
// as it does for the other changes that do not re-render MapExplorer at all:
// entering or leaving fullscreen, a rotation, and an in-app text-scale change.

import { useCallback, useLayoutEffect, useRef, useState, type RefObject } from 'react'
import { searchControlFits } from './searchArea'

/** The shipped circular FABs. Any one of them is on the disc line. */
const DISC_SELECTOR = '.sr-map-fab'
/** SnowMap's base/overlay switcher, the one control the row can render over. */
const SWITCHER_SELECTOR = '.sr-map-layers'

/**
 * A computed length in px, or 0 when it is not one.
 *
 * NOT defensive padding: `border-*-width` computes to the KEYWORD `medium` where
 * no border style is set, and `parseFloat('medium')` is NaN. One NaN poisons
 * every comparison downstream — `x >= NaN` is false — so an unbordered map area
 * would report that the control never fits, silently removing it everywhere.
 * (That is not hypothetical: it removed the control from all 44 of this
 * feature's existing tests on the first run.) Zero is also the arithmetically
 * right answer for an absent border or padding.
 */
function px(value: string): number {
  const n = parseFloat(value)
  return Number.isFinite(n) ? n : 0
}

/** Top of an element's CONTENT box. */
function contentTop(el: HTMLElement): number {
  const cs = getComputedStyle(el)
  return el.getBoundingClientRect().top + px(cs.borderTopWidth) + px(cs.paddingTop)
}

/** Bottom of an element's CONTENT box — its controls' extent, not its border box. */
function contentBottom(el: HTMLElement): number {
  const cs = getComputedStyle(el)
  return el.getBoundingClientRect().bottom - px(cs.borderBottomWidth) - px(cs.paddingBottom)
}

export function useSearchControlFit(
  mapAreaRef: RefObject<HTMLDivElement | null>,
  clusterRef: RefObject<HTMLDivElement | null>,
  rowRef: RefObject<HTMLDivElement | null>,
): boolean {
  const [fits, setFits] = useState(true)
  const lastRowHeight = useRef<number | null>(null)
  const observer = useRef<ResizeObserver | null>(null)
  const observed = useRef<WeakSet<Element>>(new WeakSet())

  // Every input is a ref, so this is stable for the lifetime of the component.
  const measure = useCallback(() => {
    const area = mapAreaRef.current
    const cluster = clusterRef.current
    if (!area || !cluster) return
    const disc = cluster.querySelector<HTMLElement>(DISC_SELECTOR)
    // No shipped disc means the cluster's interactive contents are not mounted
    // (the phone Filters overlay is open), and the control is not rendered
    // either. Leave the last decision alone rather than deciding on nothing.
    if (!disc) return

    const switcher = area.querySelector<HTMLElement>(SWITCHER_SELECTOR)
    // Observed here rather than at setup: the map area, the cluster and above
    // all the switcher (which lives inside SnowMap and appears only once the
    // style has loaded) are not all present when the observer is created.
    for (const el of [area, cluster, switcher]) {
      if (el && observer.current && !observed.current.has(el)) {
        observed.current.add(el)
        observer.current.observe(el)
      }
    }

    const row = rowRef.current
    const rowHeight = row ? row.getBoundingClientRect().height : lastRowHeight.current
    // Never measured and not mounted: render once and learn. This is the
    // optimistic first pass, and it happens before paint.
    if (rowHeight === null) { setFits(true); return }
    if (row) lastRowHeight.current = rowHeight

    setFits(searchControlFits({
      containerTop: contentTop(area),
      switcherBottom: switcher ? contentBottom(switcher) : null,
      discLineTop: disc.getBoundingClientRect().top,
      // `normal` where the stylesheet has not loaded, which is another NaN.
      rowGap: px(getComputedStyle(cluster).rowGap),
      rowHeight,
    }))
  }, [mapAreaRef, clusterRef, rowRef])

  // Declared BEFORE the measuring effect so the observer exists the first time
  // `measure` reaches for it (layout effects run in declaration order).
  useLayoutEffect(() => {
    if (typeof ResizeObserver === 'undefined') return
    observer.current = new ResizeObserver(measure)
    return () => {
      observer.current?.disconnect()
      observer.current = null
      observed.current = new WeakSet()
    }
  }, [measure])

  // Deliberately no dependency array — see the note at the top of the file.
  useLayoutEffect(measure)

  return fits
}
