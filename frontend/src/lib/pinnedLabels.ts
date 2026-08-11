// The pinned-labels state machine, SHARED by the two pinnable tables (Breeding
// Codes and Multimedia).
//
// It exists because the two surfaces must behave identically, and the only way to
// guarantee that is for them to run the same code rather than two copies that
// agree today. This is the same posture as `nextShadingState` in
// shadingExclusion.ts: an explicit pure transition wired into both toggles, NOT a
// useEffect mirroring one piece of state onto another (which would be ambiguous
// about which one wins, and would cost an extra render).
//
// THE INVARIANT: `pinned` is never true while `wideMode` is false. Pinning is only
// workable in Unbounded, where the scrollport is the PAGE and a sticky header costs
// nothing but its own band. Normal view would need a capped-height inner box, and
// at 200% in-app text scale no height unit works (dvh leaves ~5 rows; rem exceeds
// the viewport, putting the scrollport's top and the header off-screen). That is
// the v0.5.69 shape both surfaces reverted, and it stays reverted.
//
// The pin control is still present and enabled in Normal and reaches the working
// behavior in ONE press, so nothing is disabled, hidden, or dead.

export interface PinnedLabelsState {
  /** True while the header labels are pinned. Never true while wideMode is false. */
  pinned: boolean
  /** True in the Unbounded view, false in Normal. */
  wideMode: boolean
  /** The view pinning switched away from, so unpinning can restore it and the round
   *  trip leaves no residue. null whenever nothing is pinned. */
  viewBeforePin: boolean | null
}

export interface PinnedLabelsTransition extends PinnedLabelsState {
  /** True only on the press that PINS. The live region's message key advances on
   *  this, so a repeat pin is a real DOM node replacement rather than a no-op
   *  reconcile against an identical string (v0.5.80). Unpinning needs no
   *  announcement of its own: the aria-pressed transition is the announcement and
   *  the note leaves. Carried here, not re-decided per surface, so the two cannot
   *  drift on when they speak. */
  announce: boolean
}

/**
 * Pressing the pin control.
 *
 * Pinning from Normal switches the view and pins in ONE press, remembering the
 * view it came from. Unpinning restores that view.
 */
export function nextPinnedState(prev: PinnedLabelsState): PinnedLabelsTransition {
  if (prev.pinned) {
    return {
      pinned: false,
      // Restore only when there is something to restore; a pin that somehow began
      // with no recorded view leaves the current one alone rather than guessing.
      wideMode: prev.viewBeforePin !== null ? prev.viewBeforePin : prev.wideMode,
      viewBeforePin: null,
      announce: false,
    }
  }
  return {
    pinned: true,
    wideMode: true,
    viewBeforePin: prev.wideMode,
    announce: true,
  }
}

/**
 * Pressing the view control (Normal / Unbounded).
 *
 * Switching to Normal clears the pin, so the pill visibly un-presses in the same
 * row. There is no view to restore afterwards: the user just chose one.
 */
export function nextViewState(prev: PinnedLabelsState): PinnedLabelsTransition {
  const wideMode = !prev.wideMode
  if (!wideMode && prev.pinned) {
    return { pinned: false, wideMode, viewBeforePin: null, announce: false }
  }
  return { pinned: prev.pinned, wideMode, viewBeforePin: prev.viewBeforePin, announce: false }
}
