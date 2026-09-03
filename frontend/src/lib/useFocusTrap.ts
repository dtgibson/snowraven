// The app's Tab focus trap, extracted from components/ui/ModalDialog.tsx so the
// embedded-map fullscreen overlay and the dialog share one implementation
// (map-fullscreen-toggle D-08 / FR-18, QA-08's "exactly one module").
//
// THIS FILE IMPORTS `react` AND NOTHING ELSE, EVER. Both of its consumers sit on
// App.tsx's STATIC import graph — ModalDialog through Settings.tsx, and
// lib/useMapFullscreen.ts through NamedBirdRow.tsx — so a single `react-map-gl`
// or `maplibre-gl` edge from here would put the ~1 MB maplibre vendor chunk on
// first paint. entryChunk.test.ts is the live guard; focusTrapEntrySafe.test.ts
// asserts the dependency-free property directly.
//
// WHAT DOES NOT LIVE HERE: Escape. The two consumers need different phases and
// different side effects. ModalDialog preventDefaults and calls onRequestClose;
// the map overlay needs a BUBBLE-phase document listener armed only while
// expanded, so SharePopup's CAPTURE-phase listener with stopPropagation stays
// the innermost dismiss layer (one Escape closes the popup, a second exits
// fullscreen). Folding them would break one of the two.
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
// Measured inside the expanded Species Detail overlay: the trap's list held 22
// entries ending at the fullscreen toggle, while WebKit's real forward order ran
// canvas -> attribution <summary> -> the three base-map buttons -> the Trails
// checkbox and then straight OUT of the overlay. The share drop button and the
// fullscreen toggle carry no explicit tabindex, so `activeEl === last` never
// became true and the end-wrap never fired. The keydown containment arm did
// fire, but on the NEXT Tab — one hop too late, with focus already resting on a
// control the opaque panel was covering, and a keystroke typed into it and read
// back to prove it.
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
   *  the page the overlay is covering. */
  containOutsideFocus?: boolean
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

  useEffect(() => {
    if (!active) return

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
      const focusables = focusablesIn(root)
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
      const focusables = focusablesIn(root)
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
  }, [active, rootRef, containOutsideFocus])
}
