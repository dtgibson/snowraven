// The Map Explorer panel's chrome budget, measured instead of guessed.
//
// THE DEFECT. `.sr-map-explorer-panel` sized itself as `calc(100dvh - 178px)`
// (132px in the ≤640 tier), where the constant was meant to be "everything on
// the page that is not the map". It never was. Measured in Chromium and WebKit
// against the shipped build, the real chrome is 252px at 1434px wide, 223px at
// 1600px and 228px on a 402px phone, so the page overflowed its own viewport by
// 74px, 45px and 96px and the three round map buttons sat 15.5px (desktop) and
// 37.5px (phone) BELOW the window bottom until the user scrolled. The overflow
// was identical at viewport heights of 900, 1236 and 1600px, which is the
// signature of a fixed constant rather than of anything height-dependent.
//
// A constant cannot be right here, and not only because these three numbers
// differ from each other and from 178. The chrome is TEXT, so it grows with the
// in-app text scale. Across the five widths and four scales measured, the real
// chrome ran from 223px to 484px — a 2.2x spread against one 178px literal, and
// at the top of that range 484px of an 800px viewport — so no single number can
// cover it.
//
// WHAT THE CHROME IS HAS SINCE CHANGED SHAPE, and the measurement absorbed it
// without a line of arithmetic moving, which is the argument for measuring
// rather than budgeting (nav-rework):
//
//   * At SIDEBAR and RAIL density the app shell is a ROW. `main.parentElement`
//     is the content column, and the brand header has moved into the nav column
//     beside it, so `above` collapses to roughly the body's safe-area padding
//     and `below` is the footer alone. Those two are still the whole of what the
//     panel shares the viewport with, so the sum is still right.
//   * At PHONE density the nav is a FIXED bottom bar. That one is NOT in
//     <main>'s sibling flow at all, so neither term can see it, and its measured
//     height has to be added explicitly — the `fixedBelow` argument below. Left
//     out, the map panel and the footer would both sit underneath it.
//
// The old tab strip that collapsed into a dropdown at a threshold that moved
// whenever a tab was added is gone; the density it was replaced by is derived
// from measured width (lib/navDensity.ts) and changes these same boxes, so it is
// observed for free.
//
// SO THE NUMBER IS MEASURED. This module publishes the real chrome as a px
// custom property and the stylesheet's calc consumes it, keeping the old
// constants only as the pre-measurement fallback so first paint is unchanged.
// That is this repo's established shape for a px value derived from a ref side
// effect (SharePopup's `--sr-share-body-cap`): a DOM write, never setState, and
// never a measurement during render.
//
// WHY THIS, AND NOT THE STRUCTURAL FIX. The better answer in the abstract is to
// make the app shell a 100dvh flex column and let the panel be `flex: 1;
// min-height: 0`, which needs no constant AND no measurement. It was rejected on
// blast radius and on two mechanical grounds, neither of which is a matter of
// taste:
//
//   * `<main>` hosts EVERY tab, not just this one. Giving it `flex: 1` with
//     `min-height: 0` lets it shrink below its content, and since it sets no
//     `overflow`, every taller tab would paint its content straight through the
//     footer that follows it. Giving it `flex: 1 0 auto` instead avoids that but
//     re-parents the panel's height on a percentage resolved against a flexed
//     item — exactly the resolution corner where engines differ, and this app
//     ships on WebKit for macOS and iOS as well as Chromium.
//
//   * The page is the scrollport for all ten tabs. Both pinned-label bands
//     (Breeding Codes, Multimedia) are `position: sticky` cells that anchor to
//     the PAGE precisely because nothing between them and the viewport sets
//     overflow, and their `scroll-margin-top` focus guards are written for that
//     scrollport. Moving the scroll into `<main>` re-points all of it.
//
// The scoped version turned out to need no knowledge it cannot have — see
// `measureMapPanelChrome` — so it is the one that ships.

import { useCallback, useLayoutEffect, useRef, type RefObject } from 'react'

/** The custom property the stylesheet's `calc(100dvh - …)` reads. */
export const MAP_CHROME_VAR = '--sr-map-chrome'

/**
 * The chrome budget in px, or `null` when the reading is not usable and the last
 * good value should stand.
 *
 * `above` is the distance from the document's top to the top of `<main>`, i.e.
 * the safe-area body padding plus whatever chrome sits above the content (at
 * phone density the brand header; at sidebar and rail density essentially
 * nothing, because the brand has moved into the nav column). `below` is the
 * distance from the bottom of `<main>` to the bottom of the footer.
 *
 * `fixedBelow` is the third term and the one that is NOT a sibling relationship:
 * the height of the phone bottom bar, which is `position: fixed` and therefore
 * invisible to both of the others. It is 0 at every other density. Without it the
 * panel would be sized as though the bar were not there and would run underneath
 * it, taking the footer with it.
 *
 * The panel lives inside `<main>`, so its OWN height appears in none of the three
 * — which is what makes this free of the feedback loop that measuring the page
 * height would have.
 *
 * Rejected rather than clamped:
 *   * a non-finite reading, which is what an unlaid-out box gives;
 *   * a negative `above` or `fixedBelow`, which is geometrically impossible and
 *     therefore means the reading is not of the real layout;
 *   * `below <= 0`, which means there is no layout at all — the footer always
 *     has text and padding, so a zero says jsdom or a pre-layout pass, not a
 *     footer of height zero.
 * `fixedBelow` is the one term allowed to be zero, because zero is its correct
 * and usual value: there is no bar at all above the phone tier.
 * Publishing 0 in any of the rejected cases would size the panel to a full 100dvh
 * and push the whole chrome off the bottom, i.e. exactly the defect but worse, so
 * these return `null` and write nothing.
 *
 * Rounding is `ceil`, deliberately: it can only ever make the panel up to a pixel
 * SHORTER than the space available, never a sub-pixel taller than it, so a
 * fractional chrome (a half-pixel border, a fractional device pixel ratio)
 * cannot leave a 0.5px page scroll behind.
 *
 * There is deliberately NO `Math.max(0, …)` here. The two rejections above make
 * `above >= 0` and `below > 0`, so the sum is already positive and a zero clamp
 * could never fire: it would read as protection while being an assertion that
 * cannot fail. The floor that CAN act on the outcome is in the stylesheet, where
 * the outcome is — `min-height: 340px` (300px on iOS) on the panel itself, which
 * holds whatever this returns, including a chrome legitimately taller than the
 * viewport (a short landscape phone at 200% text scale reaches that).
 */
export function mapPanelChromePx(above: number, below: number, fixedBelow = 0): number | null {
  if (!Number.isFinite(above) || !Number.isFinite(below) || !Number.isFinite(fixedBelow)) return null
  if (above < 0 || below <= 0 || fixedBelow < 0) return null
  return Math.ceil(above + below + fixedBelow)
}

/**
 * Read the live chrome around `<main>`.
 *
 * Both readings are differences between two rects taken in the same frame, so
 * scroll position cancels out of each and neither needs `window.scrollY` (which
 * is fractional and can go negative during an iOS rubber-band).
 *
 * This is deliberately state-independent — it does not know or care which tab is
 * active, or whether the map is fullscreen:
 *
 *   * Another tab active: `<main>` holds that tab's panel instead. Its height is
 *     not one of the terms, so the answer is the same.
 *   * Map fullscreen: the panel is `position: fixed` and out of flow, so
 *     `<main>` measures zero high. `above` is unchanged and `below` collapses to
 *     the footer, which sums to the same chrome. Measuring the PANEL's own top
 *     would have broken here (a fixed box reports a viewport-relative top);
 *     measuring `<main>` is what avoids needing to know.
 *   * Sidebar or rail density: `<main>`'s parent is the content column and the
 *     nav is a sibling of THAT, so it is outside both terms and correctly so —
 *     it takes width from the content column, never height.
 *
 * `navBar` is the phone bottom bar or null. It is measured directly rather than
 * inferred, for the same reason everything else here is: it is text, it grows
 * with the in-app text scale, and its labels drop out under a container query at
 * large scales, so no constant is right at both ends.
 */
export function measureMapPanelChrome(
  main: HTMLElement,
  footer: HTMLElement,
  navBar?: HTMLElement | null,
): number | null {
  const docTop = document.documentElement.getBoundingClientRect().top
  const mainRect = main.getBoundingClientRect()
  const footRect = footer.getBoundingClientRect()
  const barHeight = navBar ? navBar.getBoundingClientRect().height : 0
  return mapPanelChromePx(mainRect.top - docTop, footRect.bottom - mainRect.bottom, barHeight)
}

/**
 * The elements whose SIZE decides the chrome: everything in the app shell except
 * `<main>` itself.
 *
 * At sidebar and rail density `main.parentElement` is the CONTENT COLUMN, so the
 * set is the footer alone; at phone density it also holds the brand header. The
 * nav column is a sibling of the content column rather than of `<main>`, and is
 * correctly outside the set: it takes width from the content column, never
 * height. The phone bottom bar is `position: fixed` and outside it too, which is
 * why `useMapPanelChrome` takes that element separately.
 *
 * DESCENDS ONE LEVEL through a `display: contents` child, because such an element
 * has no box of its own: a ResizeObserver on it reports 0×0 and never fires, so
 * everything inside it would go unobserved. App no longer wraps the nav in one
 * (the nav column is a real box now and carries its own `inert`), so this is a
 * general property of the walk rather than a description of one line — which is
 * the form it needs, since the next such wrapper will not come with a comment.
 *
 * `<main>` is excluded on purpose and it is the whole reason there is no
 * feedback here: nothing observed changes size when the panel's height changes,
 * so publishing a new value cannot re-trigger the observer that produced it.
 */
export function chromeBoxes(main: HTMLElement): Element[] {
  const shell = main.parentElement
  if (!shell) return []
  const out: Element[] = []
  for (const child of Array.from(shell.children)) {
    if (child === main) continue
    if (getComputedStyle(child).display === 'contents') out.push(...Array.from(child.children))
    else out.push(child)
  }
  return out
}

/**
 * Keep `--sr-map-chrome` on `<main>` equal to the real chrome. The Map Explorer
 * panel is a child of `<main>` and custom properties inherit, so the stylesheet
 * rule reads it there; nothing else in the app consumes it.
 *
 * A ResizeObserver, never a `window` `resize` listener: this repo forbids JS
 * window/resize/innerWidth checks by name and names the observer as the
 * sanctioned alternative. It is also the stronger tool for this particular job,
 * because the two changes a media query could not see at all — an in-app
 * text-scale change and a font finishing loading — resize these very elements
 * and so are picked up for free. A viewport HEIGHT change needs no observer at
 * all: the chrome does not depend on it, and `100dvh` inside the calc tracks it.
 *
 * The write is guarded on the value having changed, so a genuine chrome change
 * costs one property write and a settled layout costs none.
 */
export function useMapPanelChrome(
  mainRef: RefObject<HTMLElement | null>,
  footerRef: RefObject<HTMLElement | null>,
  navBar: HTMLElement | null = null,
): void {
  const published = useRef<number | null>(null)

  const measure = useCallback(() => {
    const main = mainRef.current
    const footer = footerRef.current
    if (!main || !footer) return
    const chrome = measureMapPanelChrome(main, footer, navBar)
    if (chrome === null || chrome === published.current) return
    published.current = chrome
    main.style.setProperty(MAP_CHROME_VAR, `${chrome}px`)
  }, [mainRef, footerRef, navBar])

  // Before paint, so the map tab opens at the right height rather than at the
  // fallback constant's and then correcting.
  useLayoutEffect(() => {
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(measure)
    const main = mainRef.current
    if (main) for (const el of chromeBoxes(main)) ro.observe(el)
    // The bottom bar is not among those — it is fixed, so it is nobody's sibling
    // — and it is passed as an ELEMENT rather than a ref precisely so that its
    // arrival and departure re-run this effect and rebuild the observer. A ref
    // would have left the observer watching an element that had unmounted.
    if (navBar) ro.observe(navBar)
    return () => ro.disconnect()
  }, [measure, mainRef, navBar])
}
