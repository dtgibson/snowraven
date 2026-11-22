// Keeps an open dropdown list to the room that is actually VISIBLE under its
// field, on the phone tier (map-scroll-on-phones D-15). Five lists use it:
// Hotspot Reports' picker, Life Lists' region picker, Targets' county picker and
// its "Measure distances from" chooser, and the shared species picker.
//
// Measured at baseline (baseline-measurements.md, section 5): at 320 x 568 with
// the field as low as its page allows, 32% to 55% of each list fell below the
// window or under the bottom bar, and the Targets chooser ran under the bar from
// any position. A stylesheet cannot fix that alone: the room under a field
// depends on where the page is scrolled and on the on-screen keyboard.
//
// WHAT IT DOES, while `open` and only on the phone tier:
//   1. Reads the visible bottom: the smaller of the visual viewport's bottom
//      (which the on-screen keyboard shortens), the top of the phone bar when it
//      is drawn, and the bottom of every clipping ancestor of the field.
//   2. room = visible bottom - the list's top - 8px. When that is short of what
//      the list wants (its own cap, or its content), it first brings the field
//      to the top of the visible area with one INSTANT scroll (`behavior:
//      'auto'`), its `scroll-margin-top` set for that one call to
//      `--sr-list-fit-margin` (8px, plus the status bar in the apps; globals.css),
//      so the measurement after it is exact and reduced motion needs no branch.
//   3. Writes `--sr-list-fit` in px on the list from this effect (no state); the
//      stylesheet's phone block takes `min(cap, var(--sr-list-fit, cap))`.
//      Never below a floor of one and a half option rows from the list's own top
//      (measured from the first option, so it follows text size), so one whole
//      row and the top of the next always show.
//   4. Re-measures, one per frame, when the visual viewport resizes or scrolls
//      (the keyboard coming up or going, a rotation), never on page scroll; a page
//      scroll moves the list with its field, as at HEAD.
// On close it removes the property and every listener.
//
// THIS IS NOT A BREAKPOINT, which is why it does not fall under ui.md's "no
// window resize listener" rule: the tier itself is read through `useIsPhone`
// (the sanctioned media store), and what listens to `visualViewport` is a
// GEOMETRY measurement of one open list, armed only while it is open, the shape
// lib/mapPanelChrome.ts takes for the Map Explorer's chrome.
//
// Elements are passed as STATE, never ref objects (ui.md v1.0.17), so the effect
// re-runs when the list node exists. `anchor` undefined means the list's own
// parent, which is the positioned field wrapper on all five lists.
//
// No new request, no stored state, no setting.

import { useLayoutEffect } from 'react'
import { useIsPhone } from './useIsPhone'

/** The custom property the phone block's list rules read. */
export const LIST_FIT_VAR = '--sr-list-fit'

/** Clearance kept between a list's bottom edge and the visible bottom. */
export const LIST_FIT_EDGE_PX = 8

/** The px the list may take: the room under it, never below `floorPx`. Pure, so
 *  the arithmetic is tested on its own. A non-finite room (an unlaid-out box)
 *  answers the floor rather than NaN. */
export function listFitPx(visibleBottom: number, listTop: number, floorPx: number): number {
  const room = visibleBottom - listTop - LIST_FIT_EDGE_PX
  const floor = Number.isFinite(floorPx) && floorPx > 0 ? floorPx : 0
  if (!Number.isFinite(room)) return Math.floor(floor)
  return Math.floor(Math.max(floor, room))
}

/** The bottom of what the user can see below `anchor`, in viewport px. */
function visibleBottom(anchor: HTMLElement): number {
  const vv = window.visualViewport
  let bottom = vv ? vv.offsetTop + vv.height : document.documentElement.clientHeight
  const bar = document.querySelector<HTMLElement>('.sr-navbar')
  if (bar && getComputedStyle(bar).visibility !== 'hidden') {
    const top = bar.getBoundingClientRect().top
    if (top > 0) bottom = Math.min(bottom, top)
  }
  // A clipping ancestor cuts the list as surely as the window does (the Map
  // Explorer's filter sheet, which hosts the species picker, scrolls inside
  // itself). The page's own two roots are not clips here.
  for (let el = anchor.parentElement; el && el !== document.body && el !== document.documentElement; el = el.parentElement) {
    if (getComputedStyle(el).overflowY !== 'visible') bottom = Math.min(bottom, el.getBoundingClientRect().bottom)
  }
  return bottom
}

/** One and a half option rows from the list's own top edge, plus its bottom
 *  padding and border. Offsets, not rects, so the list's 140ms scale-in entrance
 *  (a transform) does not shrink the reading. */
function floorFor(list: HTMLElement, optionSelector: string): number {
  const first = list.querySelector<HTMLElement>(optionSelector) ?? (list.firstElementChild as HTMLElement | null)
  if (!first) return 0
  const cs = getComputedStyle(list)
  // offsetTop is from the list's padding edge when the list is the option's
  // offset parent (all five lists are positioned); otherwise it is not ours to
  // read, and the row height alone is the floor.
  const top = first.offsetParent === list ? first.offsetTop : 0
  return (parseFloat(cs.borderTopWidth) || 0) + top + 1.5 * first.offsetHeight
    + (parseFloat(cs.paddingBottom) || 0) + (parseFloat(cs.borderBottomWidth) || 0)
}

export function useListFit(
  open: boolean,
  anchor: HTMLElement | null | undefined,
  list: HTMLElement | null,
  optionSelector = '[role="option"]',
): void {
  const phone = useIsPhone()
  useLayoutEffect(() => {
    if (!open || !phone || !list) return
    const field = anchor ?? list.parentElement
    if (!field) return
    const measure = (mayScroll: boolean) => {
      list.style.removeProperty(LIST_FIT_VAR)
      const wanted = list.offsetHeight
      let top = list.getBoundingClientRect().top
      if (mayScroll && visibleBottom(field) - top - LIST_FIT_EDGE_PX < wanted && typeof field.scrollIntoView === 'function') {
        const margin = field.style.getPropertyValue('scroll-margin-top')
        field.style.setProperty('scroll-margin-top', `var(--sr-list-fit-margin, ${LIST_FIT_EDGE_PX}px)`)
        field.scrollIntoView({ block: 'start', inline: 'nearest', behavior: 'auto' })
        if (margin) field.style.setProperty('scroll-margin-top', margin)
        else field.style.removeProperty('scroll-margin-top')
        top = list.getBoundingClientRect().top
      }
      list.style.setProperty(LIST_FIT_VAR, `${listFitPx(visibleBottom(field), top, floorFor(list, optionSelector))}px`)
    }
    measure(true)
    const vv = window.visualViewport
    if (!vv) return () => { list.style.removeProperty(LIST_FIT_VAR) }
    let frame = 0
    const onChange = () => {
      if (frame) return
      frame = requestAnimationFrame(() => { frame = 0; measure(false) })
    }
    vv.addEventListener('resize', onChange)
    vv.addEventListener('scroll', onChange)
    return () => {
      vv.removeEventListener('resize', onChange)
      vv.removeEventListener('scroll', onChange)
      if (frame) cancelAnimationFrame(frame)
      list.style.removeProperty(LIST_FIT_VAR)
    }
  }, [open, phone, anchor, list, optionSelector])
}
