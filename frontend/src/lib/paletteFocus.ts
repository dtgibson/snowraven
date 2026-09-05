// Where focus goes when the command palette closes (FR-12).
//
// A PURE DECISION IN ITS OWN MODULE, because the restore itself has to live in
// App.tsx -- the palette unmounts on close, so an effect inside it cannot run
// after the close commits (the `restoreFiltersFocusRef` shape in MapExplorer.tsx)
// -- and no test in this repo renders App.tsx. Everything that DECIDES is here,
// where a test can drive it; what is left at the call site is one call.
//
// Entry-safe: it imports nothing. It rides App.tsx's entry chunk with the
// hotkey hook, the hint and the copy; entryChunk.test.ts asserts that.

export interface PaletteOpener {
  /**
   * The control that opened the palette, as a GETTER rather than an element:
   * the shipped `ModalDialog` trigger contract. The chord's opener is the one
   * exception and is captured EAGERLY -- `usePaletteHotkey` reads
   * `document.activeElement` inside the keydown handler and closes over it,
   * because a getter that re-read it later would return the palette's own input.
   */
  trigger: () => HTMLElement | null
  /** An optional second choice, tried under the same liveness gate as the trigger. */
  fallback?: () => HTMLElement | null
}

/** Which target the restore actually used, so a test can assert the BRANCH. */
export type PaletteFocusTarget = 'trigger' | 'fallback' | 'final' | 'none'

/**
 * Could this element plausibly take focus right now?
 *
 * A cheap PRE-check, not the whole answer -- `tryFocus` below verifies the
 * engine actually took it. Five conditions, and the last two are the ones that
 * are easy to miss:
 *
 *  * An element inside an `inert` subtree is in the DOM, is not disabled, and
 *    CANNOT take focus. The palette is operable over an expanded fullscreen map,
 *    which marks the whole navigation `inert` (FR-14), so a nav control that
 *    opened the palette before the map went fullscreen is exactly that case.
 *  * `<body>` AND `<html>` ARE REJECTED OUTRIGHT, and this was measured rather
 *    than reasoned about. `document.activeElement` is `<body>` whenever nothing
 *    in the page holds focus, which is the ordinary state after a fresh load or
 *    a click on non-interactive content -- so the chord's eagerly-captured
 *    opener is very often the body element itself. It passes every other test
 *    here (it is in the document, it is not disabled, it is not inert), and
 *    focusing it leaves `document.activeElement` exactly where it already was.
 *    A browser probe in Chromium and WebKit caught precisely that: the restore
 *    reported success and focus sat on `<body>`, which is the one outcome FR-12
 *    names as forbidden.
 */
function plausible(el: HTMLElement | null | undefined): el is HTMLElement {
  if (!el) return false
  if (el === document.body || el === document.documentElement) return false
  if (!document.contains(el)) return false
  if (el.hasAttribute('disabled')) return false
  if (el.closest?.('[inert]')) return false
  return true
}

/**
 * Focus `el` and report whether the engine ACTUALLY took it.
 *
 * The general backstop behind the enumerated rejections above, and the reason
 * this helper exists at all: enumerating the ways an element can silently refuse
 * focus is a PREDICTION, and this app has already paid once for predicting an
 * engine's focus behaviour rather than observing it (the v1.0.15 focus-trap
 * measurement). Reading `document.activeElement` back is an observation, so a
 * candidate that refuses focus for a reason nobody listed -- a `visibility:
 * hidden` ancestor, a future `inert` spelling, an engine quirk -- falls through
 * to the next one instead of ending the restore on nothing.
 */
function tryFocus(el: HTMLElement): boolean {
  el.focus()
  return document.activeElement === el
}

/**
 * Restore focus after the palette closes, and report which target was used.
 *
 * In order: the opener's trigger, then its own fallback, then `finalFallback`.
 * App.tsx supplies `<main id="sr-main" tabIndex={-1}>` as that last one -- it
 * always exists and is never inert -- so focus can never land on `<body>`.
 *
 * `'none'` is reachable only when every candidate is missing or unfocusable,
 * which in the shipped app means `<main>` itself was gone. Nothing is focused in
 * that case; there is nowhere honest to put it.
 */
export function restoreOpenerFocus(
  opener: PaletteOpener | null,
  finalFallback: HTMLElement | null,
): PaletteFocusTarget {
  const trigger = opener?.trigger()
  if (plausible(trigger) && tryFocus(trigger)) return 'trigger'

  const fallback = opener?.fallback?.()
  if (plausible(fallback) && tryFocus(fallback)) return 'fallback'

  if (plausible(finalFallback) && tryFocus(finalFallback)) return 'final'

  return 'none'
}
