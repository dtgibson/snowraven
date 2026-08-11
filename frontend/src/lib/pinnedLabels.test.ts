import { describe, it, expect } from 'vitest'
import { nextPinnedState, nextViewState } from './pinnedLabels'
import type { PinnedLabelsState } from './pinnedLabels'

// The shared pinned-labels state machine. It backs BOTH pinnable tables (Breeding
// Codes and Multimedia), so these are the transitions the two surfaces are promised
// to have in common. A behavior asserted here does not need re-proving through each
// component's DOM; what the component tests still owe is the WIRING.

const NORMAL: PinnedLabelsState = { pinned: false, wideMode: false, viewBeforePin: null }
const UNBOUNDED: PinnedLabelsState = { pinned: false, wideMode: true, viewBeforePin: null }

/** Every state the machine can legally be in, for the invariant sweep. */
const REACHABLE: PinnedLabelsState[] = [
  NORMAL,
  UNBOUNDED,
  { pinned: true, wideMode: true, viewBeforePin: false },
  { pinned: true, wideMode: true, viewBeforePin: true },
]

describe('pinning', () => {
  it('switches the view and pins in ONE press from Normal', () => {
    // The whole reason the control is offered in Normal at all rather than hidden
    // or disabled there: it is never dead, it just costs a view change.
    const next = nextPinnedState(NORMAL)
    expect(next.pinned).toBe(true)
    expect(next.wideMode).toBe(true)
  })

  it('remembers the view it pinned FROM, so the round trip leaves no residue', () => {
    for (const from of [NORMAL, UNBOUNDED]) {
      const pin = nextPinnedState(from)
      expect(pin.viewBeforePin).toBe(from.wideMode)
      const unpin = nextPinnedState(pin)
      expect(unpin.pinned).toBe(false)
      expect(unpin.wideMode).toBe(from.wideMode)
      expect(unpin.viewBeforePin).toBe(null)
    }
  })

  it('pins in place when already in Unbounded (no view change to make)', () => {
    const next = nextPinnedState(UNBOUNDED)
    expect(next).toMatchObject({ pinned: true, wideMode: true, viewBeforePin: true })
  })
})

describe('the view control', () => {
  it('clears the pin when switching to Normal, with no view left to restore', () => {
    // Pressing "↔ Normal" while pinned un-presses the pill in the same row.
    const next = nextViewState({ pinned: true, wideMode: true, viewBeforePin: false })
    expect(next).toMatchObject({ pinned: false, wideMode: false, viewBeforePin: null })
  })

  it('leaves an unpinned view toggle alone in both directions', () => {
    expect(nextViewState(NORMAL)).toMatchObject({ pinned: false, wideMode: true })
    expect(nextViewState(UNBOUNDED)).toMatchObject({ pinned: false, wideMode: false })
  })

  it('does not re-pin when switching INTO Unbounded', () => {
    // Unbounded is where pinning is possible, not where it happens. A user who
    // never presses the pin control must never see a pinned band.
    expect(nextViewState(NORMAL).pinned).toBe(false)
  })
})

describe('the invariant: pinned implies Unbounded', () => {
  it('holds after every transition from every reachable state', () => {
    // Normal view cannot host a pinned header without the capped-height inner box
    // that v0.5.69 reverted (no workable height unit at 200% text scale). This is
    // the property that keeps that decision un-reversed on both surfaces at once.
    for (const state of REACHABLE) {
      for (const [name, fn] of [['pin', nextPinnedState], ['view', nextViewState]] as const) {
        const next = fn(state)
        expect(
          next.pinned && !next.wideMode,
          `${name} from ${JSON.stringify(state)} produced ${JSON.stringify(next)}`,
        ).toBe(false)
      }
    }
  })

  it('holds across long random walks, not just single presses', () => {
    // Single-step checks miss a machine that only violates the invariant after a
    // particular sequence (pin, view, view, unpin...).
    let state: PinnedLabelsState = NORMAL
    let seed = 7
    for (let i = 0; i < 400; i++) {
      seed = (seed * 1103515245 + 12345) % 2147483648
      state = (seed % 2 === 0 ? nextPinnedState : nextViewState)(state)
      expect(state.pinned && !state.wideMode, `step ${i}`).toBe(false)
      // And the bookkeeping: a recorded pre-pin view is meaningless while unpinned.
      if (!state.pinned) expect(state.viewBeforePin, `step ${i}`).toBe(null)
    }
  })
})

describe('the announcement flag', () => {
  it('fires on the press that PINS and on nothing else', () => {
    // Rejects announcing on unpin (the aria-pressed transition is the announcement
    // there, and the note leaves) and on any view change. It is carried by the
    // machine rather than re-decided per surface so the two cannot drift on when
    // they speak.
    expect(nextPinnedState(NORMAL).announce).toBe(true)
    expect(nextPinnedState(UNBOUNDED).announce).toBe(true)
    expect(nextPinnedState({ pinned: true, wideMode: true, viewBeforePin: false }).announce).toBe(false)
    for (const state of REACHABLE) {
      expect(nextViewState(state).announce, JSON.stringify(state)).toBe(false)
    }
  })

  it('fires again on a REPEAT pin, so the live region can re-announce', () => {
    // A second identical announcement is exactly the case React's text-node bailout
    // swallows (v0.5.80), so the flag has to keep firing rather than latch once.
    let state: PinnedLabelsState = NORMAL
    for (let i = 0; i < 3; i++) {
      const pin = nextPinnedState(state)
      expect(pin.announce, `pin #${i + 1}`).toBe(true)
      state = nextPinnedState(pin)
    }
  })
})
