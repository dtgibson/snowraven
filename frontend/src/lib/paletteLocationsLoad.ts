// When Search derives its locations (visited-hotspots-in-search, schema 4.2).
//
// THE ONE DECISION, AND WHY IT EXISTS. The derivation never runs in the task that
// commits the species rows, and never before the overlay's first frame:
//
//   a memo hit   no work: the locations join in the species update
//   a miss       `locationsAtAnswer` returns undefined, and the overlay derives
//                in its own task after the frame that presented the species
//                commit, through `afterFirstFrame`
//
// Two reasons, one mechanism. Gate R2 allows none of the feature's work before
// destinations have painted, and on desktop the species answer routinely lands
// BEFORE the overlay's first frame when another tab has already parsed the
// backup. And when Search is opened before the backup has been read, the species
// answer's task already sits near the 50 ms long-task line; deriving inside it
// made it longer (Chromium: 4 of 5 runs over 50 ms against 1 of 5 before), and
// the Guide decided on 2026-11-13 that no existing task may get longer
// (decisions.md E-08, overriding FR-33's "same update" for that case). Holding
// the SPECIES answer instead would delay species, which FR-04 forbids. So on a
// miss the location rows join one frame after the species rows, appended after
// every existing row (FR-18), and a typed query with nothing else to show reads
// the reading sentence under Locations until they do (FR-22, schema 4.3).
//
// WHAT WOULD REVERSE IT: the user ranking FR-33's letter above both, in which
// case a miss that finds the first frame already presented derives in the
// species update again.
//
// Pure apart from the frame scheduling, and off the entry graph with the overlay
// that owns it. It imports no transport, storage, fetch or lib/tauri service;
// `paletteLocationsLoad.test.ts` holds that with comments stripped.

import type { ObservationEntry } from '../types'
import {
  peekLocationSearchIndex,
  type LocationSearchIndex, type LOCATION_INDEX_FAILED,
} from './paletteLocations'

/** Long enough that a visible window's first frame always wins; short enough
 *  that a hidden or suspended window, which fires no frame, has its rows by the
 *  time it is shown. */
export const FIRST_FRAME_FALLBACK_MS = 250

/**
 * Call `run` once, after the first frame from now has been presented: in a task
 * queued from the first `requestAnimationFrame` callback (which runs before that
 * frame's paint, so the task runs after it). A window that is hidden or
 * suspended fires no frame and is painting nothing, so a fallback timer calls
 * `run` instead; whichever comes first wins and cancels the other. Returns a
 * cancel function for the caller's effect cleanup.
 */
export function afterFirstFrame(run: () => void): () => void {
  let done = false
  let frame: number | null = null
  let task: ReturnType<typeof setTimeout> | null = null
  const fire = () => {
    if (done) return
    done = true
    cancel()
    run()
  }
  const cancel = () => {
    if (frame !== null && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(frame)
    if (task !== null) clearTimeout(task)
    clearTimeout(fallback)
  }
  const fallback = setTimeout(fire, FIRST_FRAME_FALLBACK_MS)
  if (typeof requestAnimationFrame === 'function') {
    frame = requestAnimationFrame(() => {
      frame = null
      if (!done) task = setTimeout(fire, 0)
    })
  }
  return () => {
    done = true
    cancel()
  }
}

/**
 * The locations that can join a species answer for `obs` at no cost: the memo's
 * value for this parse, or `undefined` when there is a derivation to run, which
 * the caller schedules after the next frame and never runs in the answer's own
 * task. Does no work.
 */
export function locationsAtAnswer(
  obs: readonly ObservationEntry[],
): LocationSearchIndex | typeof LOCATION_INDEX_FAILED | undefined {
  return peekLocationSearchIndex(obs)
}
