// The app's Tab focus trap. Extracted from components/ui/ModalDialog.tsx so the
// embedded-map fullscreen overlay and the dialog could share one implementation
// (map-fullscreen-toggle D-08 / FR-18, QA-08's "exactly one module"); it is now
// what EVERY trapping surface in the app uses, and FOCUSABLE_SELECTOR lives here
// and nowhere else in frontend/src (.claude/rules/ui.md; the four hand-rolled
// copies were folded in by improve: focusable-selector-single-source). The one
// copy left in the repo is website/tools/verify/verify-palette.mjs, which runs
// inside page.evaluate and structurally cannot import from source; it says so.
//
// THIS FILE IMPORTS `react` AND NOTHING ELSE, EVER. Three of its consumers sit
// on App.tsx's STATIC import graph — ModalDialog through Settings.tsx,
// lib/useMapFullscreen.ts through NamedBirdRow.tsx, and WelcomeScreen.tsx, which
// App.tsx imports directly — so a single `react-map-gl` or `maplibre-gl` edge
// from here would put the ~1 MB maplibre vendor chunk on first paint. The other
// consumers (CommandPalette, Calendar, HelpDocs, MapExplorer) are lazy, which
// does not relax the rule: this module is already on the entry chunk, so an edge
// added here reaches first paint whoever imports it. entryChunk.test.ts is the
// live guard; lib/mapFullscreenEntrySafe.test.ts asserts the dependency-free
// property directly.
//
// WHAT DOES NOT LIVE HERE: Escape. Consumers need different phases and different
// side effects. ModalDialog preventDefaults and calls onRequestClose; the map
// overlay needs a BUBBLE-phase document listener armed only while expanded, so
// SharePopup's CAPTURE-phase listener with stopPropagation stays the innermost
// dismiss layer (one Escape closes the popup, a second exits fullscreen).
// Folding them would break one of the two. Every call site consolidated onto
// this hook kept its own Escape handler for the same reason, and the palette's
// Escape is consumed earlier still, at `window` capture, by usePaletteHotkey.
//
// WHY CONTAINMENT IS DRIVEN BY `focusin` AND NOT BY THE NEXT Tab KEYDOWN.
// Added in the QA round that measured the leak; the shape of the fix is the
// whole point, so it is written down rather than left to be re-derived.
//
// A keydown-only trap has to answer "is focus at the boundary?" by comparing
// `document.activeElement` against the first/last entry of a list built from
// FOCUSABLE_SELECTOR — which is to say, by PREDICTING the engine's tab order.
// That prediction is wrong in WebKit's default tab mode (Safari with macOS
// Keyboard navigation off, which is the default, and what WKWebView follows, so
// it is what the shipped Mac and iOS apps get). WebKit there visits a smaller
// and DIFFERENT set: elements with an explicit tabindex, native form controls
// and <summary>. Plain <button> and <a href> are skipped entirely.
//
// Measured inside the expanded Species Detail overlay AT v1.0.15: the trap's list
// held 22 entries ending at the fullscreen toggle, while WebKit's real forward
// order ran canvas -> attribution <summary> -> the three base-map buttons -> the
// Trails checkbox and then straight OUT of the overlay. At the time of that
// measurement the share drop button and the fullscreen toggle carried no
// explicit tabindex, so `activeEl === last` never became true and the end-wrap
// never fired. The keydown containment arm did fire, but on the NEXT Tab — one
// hop too late, with focus already resting on a control the opaque panel was
// covering, and a keystroke typed into it and read back to prove it.
//
// Those two controls DO carry `tabIndex={0}` as of v1.0.16, and so now does
// EVERY intrinsic <button> and <a href> in the app's own sources
// (webkit-tab-order-app-wide; lib/tabOrderCoverage.test.ts enforces it over
// every shipped .tsx on every build), apart from the controls that guard's own
// EXCLUSIONS roster names. THAT ROSTER IS NOT RESTATED HERE. It was, and the
// restatement went stale on a build that never touched this file: the nav rework
// retired the collapsed-tab-bar listbox, and the sentence here kept claiming a
// count and a shape the roster no longer had. The property survives every such
// change and the count does not — a control is kept out only where another tab
// stop already reaches it, or where the platform removes it via native
// `disabled`. Read `EXCLUSIONS` in lib/tabOrderCoverage.test.ts for which ones
// and why; ACCESSIBILITY.md publishes the same property in prose.
// That is why the measurement above is written in the past tense.
//
// THIS CHANGES NOTHING HERE, in either direction, and the temptation to conclude
// otherwise is now STRONGER than it was, so the reasons are worth being exact
// about. The gap between the trap's list and WebKit's real order has narrowed,
// not closed, and it is still open in three places the coverage guard cannot
// reach:
//   1. LIBRARY DOM. The guard reads SnowRaven's sources. maplibre injects real
//      <button>s of its own (the +/- zoom controls, and the close button on the
//      popups that still use its own), and they carry no tabindex. Any one of
//      them inside a trapped surface is in the trap's list and NOT in WebKit's
//      order — the exact v1.0.15 shape.
//   2. <summary>, which fails in the OTHER direction and is live today: WebKit
//      visits it, and FOCUSABLE_SELECTOR below does not match it, so the trap's
//      list is missing an element the engine stops on. maplibre's
//      AttributionControl renders one, which is why the map overlay opts into
//      `containOutsideFocus`.
//   3. RENDER-TIME stripping. A source-level guard sees tabIndex={0}; it cannot
//      see a component that drops the attribute behind its own conditional.
// A prediction that happens to be right for the elements someone remembered to
// mark is still a prediction. Containment stays driven by `focusin`.
// FOCUSABLE_SELECTOR is unaffected either — it already matched both by `button`.
//
// `focusin` needs no prediction at all. It fires after focus has moved and
// before the user can type, so containment reacts to where focus ACTUALLY went
// instead of betting on where it was about to go. Any fix that keeps guessing
// the engine's tab order keeps this defect open.
//
// The keydown arm stays, for two things focusin cannot do: it wraps at the ends
// with no visible out-and-back, and it is the only arm that can act when focus
// is lost to <body>, for which engines do not reliably fire focusin at all.

import { useEffect, type RefObject } from 'react'

/** The one copy of the focusable-candidate selector. */
export const FOCUSABLE_SELECTOR =
  'button, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])'

/** Focusable descendants of `root`, in DOM order, disabled ones removed. */
export function focusablesIn(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
    .filter(el => !el.hasAttribute('disabled'))
}

export interface FocusTrapOptions {
  /** Keep focus inside the root: pull it back the moment it lands OUTSIDE
   *  (a `focusin` on document, see the header), and wrap a Tab that arrives
   *  while `document.activeElement` is already outside.
   *
   *  Defaults to false, which is ModalDialog's shipped behaviour byte for byte:
   *  it only wraps at the two ends, because a dialog always moves focus inside
   *  itself as it opens. The map overlay opts IN, because the surface behind it
   *  is a live page in the same panel rather than a `display: none` sibling, and
   *  a click on the map canvas can leave `document.activeElement` on
   *  `document.body` in some engines. Without it, one Tab from there walks into
   *  the page the overlay is covering.
   *
   *  ONE THING THIS ARM CANNOT SEE, and it decides several call sites: another
   *  overlay mounted ABOVE this one. The arm is a document listener that asks
   *  only "is the new focus inside MY root", so an overlay that opts in will
   *  pull focus straight back out of a later sibling that legitimately owns it.
   *  A call site that renders the opener of an overlay which will sit above it —
   *  WelcomeScreen's "documentation" button is the shipped example — must
   *  therefore leave this off; see that file's header for the measurement. */
  containOutsideFocus?: boolean

  /** Narrow the trap's list beyond `focusablesIn`'s disabled-removal.
   *
   *  `focusablesIn` does NO visibility filtering — it is a selector query, and a
   *  control clipped to zero height inside a collapsed accordion still matches
   *  it. Nor can a selector see `inert`, which is an attribute on an ancestor.
   *  A root that holds CSS-collapsed content must say so here or the trap will
   *  park focus on something the user cannot see; MapExplorer's filters sidebar
   *  is the one call site that needs it today.
   *
   *  This deliberately layers ON the shared selector rather than replacing it,
   *  so there is still exactly one copy of what COUNTS as focusable and the
   *  call site owns only what it can see about its own DOM.
   *
   *  Pass a STABLE function — a module-scope constant, never an inline arrow.
   *  It sits in the effect's dependency array, so a fresh identity every render
   *  would tear down and re-arm both listeners on every render. (The options
   *  OBJECT is not a dependency: it is destructured above, so a fresh literal
   *  holding a stable function re-arms nothing.)
   *
   *  It must also be TOTAL. It is called inside both handlers with no try/catch,
   *  and a throw fails OPEN — in `onKey` it aborts before `preventDefault()`, so
   *  the engine performs the Tab and containment is merely lost, never inverted
   *  into stranded focus; no listener is detached and the next event runs
   *  normally. That is the right direction for an accessibility control, and it
   *  is why there is no try/catch here rather than an oversight. */
  filter?: (el: HTMLElement) => boolean
}

/**
 * Trap Tab / Shift+Tab inside `rootRef` while `active`.
 *
 * The focusable set is re-queried on every event rather than cached, which is
 * what keeps the trap correct as popups, markers and the share pin come and go
 * inside the map.
 */
export function useFocusTrap<T extends HTMLElement>(
  active: boolean,
  rootRef: RefObject<T | null>,
  options: FocusTrapOptions = {},
): void {
  const containOutsideFocus = options.containOutsideFocus ?? false
  const filter = options.filter

  useEffect(() => {
    if (!active) return

    // The trap's list: the one shared selector, then the call site's own
    // narrowing (see FocusTrapOptions.filter). Re-queried on every event rather
    // than cached, which is what keeps the trap correct as popups, markers and
    // collapsed accordions come and go inside the root.
    const listIn = (root: HTMLElement): HTMLElement[] => {
      const all = focusablesIn(root)
      return filter ? all.filter(filter) : all
    }

    // Which end an escape should land on. Recorded on every Tab keydown, read
    // only by the focusin arm, and structurally incapable of deciding WHETHER to
    // contain — at worst it puts focus at the wrong end of a set it is already
    // holding focus inside of. A focusin escape not preceded by a Tab cannot
    // happen while the overlay is up (the panel is opaque and full-window, so
    // there is nothing behind it to click), and forward is the right default for
    // one anyway.
    let backwards = false

    function onKey(e: KeyboardEvent) {
      if (e.key !== 'Tab') return
      backwards = e.shiftKey
      const root = rootRef.current
      if (!root) return
      const focusables = listIn(root)
      if (focusables.length < 2) {
        e.preventDefault()
        focusables[0]?.focus()
        return
      }
      const first = focusables[0]
      const last = focusables[focusables.length - 1]
      const activeEl = document.activeElement
      if (containOutsideFocus && !(activeEl instanceof Node && root.contains(activeEl))) {
        e.preventDefault()
        ;(e.shiftKey ? last : first).focus()
        return
      }
      if (e.shiftKey && activeEl === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && activeEl === last) {
        e.preventDefault()
        first.focus()
      }
    }

    // The containment arm. Re-focusing from in here fires another focusin, whose
    // target is inside the root and which therefore returns at the guard below —
    // so this cannot recurse.
    function onFocusIn(e: FocusEvent) {
      const root = rootRef.current
      if (!root) return
      const target = e.target
      if (target instanceof Node && root.contains(target)) return
      const focusables = listIn(root)
      // Optional-chained rather than length-guarded: with nothing focusable
      // inside there is nowhere to put focus, and moving it to the root itself
      // would need a tabindex this hook does not own.
      ;(backwards ? focusables[focusables.length - 1] : focusables[0])?.focus()
    }

    document.addEventListener('keydown', onKey)
    if (containOutsideFocus) document.addEventListener('focusin', onFocusIn)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('focusin', onFocusIn)
    }
  }, [active, rootRef, containOutsideFocus, filter])
}
