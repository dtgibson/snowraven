// The command palette's ONE keyboard listener: the Cmd-K / Ctrl-K chord, and
// Escape while the palette is open (FR-01 to FR-04, FR-11, FR-49, FR-50).
//
// IT IMPORTS `react` AND NOTHING ELSE, EVER. It rides App.tsx's entry chunk --
// the chord has to work before any lazy chunk has loaded -- so a single edge
// from here would put that module on first paint. `entryChunk.test.ts` asserts
// this module IS on the graph, which is what makes the palette's own negatives
// there mean something.
//
// WHY `window`, CAPTURE PHASE, and why that is not a style choice.
//
// The app has eleven `document` keydown listeners. Exactly one is capture phase
// (SharePopup.tsx, with `stopPropagation()`); the other ten are bubble. There is
// not a single `window` keydown listener anywhere else in the app. So:
//
//   * a BUBBLE-phase listener cannot beat SharePopup, which consumes the press
//     one phase earlier;
//   * a CAPTURE-phase listener on `document` fires in REGISTRATION ORDER against
//     SharePopup's, and SharePopup registers first whenever its popup was already
//     open when the palette opened -- which is precisely the case QA-47 tests.
//
// `window` is the root of the event propagation path (window -> document -> html
// -> ... -> target), so a capture listener here runs before every `document`
// listener of either phase BY THE PROPAGATION PATH rather than by registration
// order. That is deterministic by specification, not by experiment, and it is
// the property FR-49 asks for: while the palette is open, one Escape closes the
// palette and nothing else.
//
// R-03, AND IT IS THE ONE ASSUMPTION THIS RESTS ON: that nothing else ever binds
// a `window` keydown listener. Nothing does today. `stopImmediatePropagation()`
// on the Escape arm covers the palette's side even if one is added, but a new
// `window`-CAPTURE listener registered BEFORE this one would beat it, and there
// is no way to defend against that from here. If one is ever added, this is the
// paragraph to come back to.
//
// FR-50 HOLDS STRUCTURALLY, NOT BY DISCIPLINE. While the palette is closed the
// Escape arm returns before touching the event, so SharePopup's capture dismiss,
// the Map Explorer's two handlers, the More sheet, ModalDialog, HelpDocs, the
// Calendar day popup, WelcomeScreen, the rail tooltip and useMapFullscreen all
// behave exactly as on the previous release. QA-48's "their existing tests pass
// unchanged" follows because those tests never open the palette.

import { useEffect, useRef } from 'react'

export interface PaletteHotkeyOptions {
  /** Whether the palette is currently open. Read through a ref inside the listener. */
  open: boolean
  /**
   * Open the palette. Receives `document.activeElement` AS OF THE PRESS, so the
   * caller can close over it: FR-12's focus return needs the control the user was
   * on, and a getter that re-read `document.activeElement` later would hand back
   * the palette's own query input.
   */
  onOpen: (activeElement: HTMLElement | null) => void
  /** Close the palette. The SAME close path Escape, the backdrop and a selection use. */
  onClose: () => void
}

/**
 * Bind the palette's chord and Escape for the life of the app.
 *
 * ONE listener, ALWAYS ARMED, bound once with `[]` deps. `open` and both
 * callbacks are read through refs, so the listener is never re-registered and no
 * press can land in a re-bind window.
 */
export function usePaletteHotkey({ open, onOpen, onClose }: PaletteHotkeyOptions): void {
  const openRef = useRef(open)
  const onOpenRef = useRef(onOpen)
  const onCloseRef = useRef(onClose)

  // Refreshed in an effect rather than during render: writing a ref during
  // render is an impure render side effect (react-hooks/refs, build-blocking).
  // The effect runs on every commit, so the listener below always reads the
  // values from the render the user is looking at.
  useEffect(() => {
    openRef.current = open
    onOpenRef.current = onOpen
    onCloseRef.current = onClose
  })

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      // A held chord would otherwise toggle the palette dozens of times.
      if (e.repeat) return

      // `e.key`, never `e.code`. `e.code === 'KeyK'` fires on the physical K
      // POSITION, which is a different letter on AZERTY and on Dvorak; the user
      // presses the letter they can see. `!e.altKey` leaves Option/Alt+Cmd+K to
      // the platform. Both chords are accepted on every platform (FR-01, FR-47),
      // whatever lib/paletteHint.ts happens to display.
      if ((e.metaKey || e.ctrlKey) && !e.altKey && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault()      // FR-02: the web/Pi build must not hand the chord to the host browser
        e.stopPropagation()     // FR-51: nothing beneath the palette even sees the press
        if (openRef.current) onCloseRef.current()   // FR-04: the same close path as Escape
        else onOpenRef.current(document.activeElement as HTMLElement | null)
        return
      }

      if (e.key === 'Escape' && openRef.current) {
        e.preventDefault()
        // stopImmediatePropagation, NOT stopPropagation. The latter stops other
        // NODES; a second listener on `window` itself would still run. There is
        // none today, and this makes the claim structural rather than a survey
        // that can go stale.
        e.stopImmediatePropagation()
        onCloseRef.current()
        return
      }

      // Everything else, including the palette's own Arrow/Enter keys, is left
      // untouched: those are handled by a React onKeyDown on the query input, a
      // bubble-phase element handler this listener never reaches.
    }

    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [])
}
