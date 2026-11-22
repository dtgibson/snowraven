// A jsdom double for "the map has not drawn yet" (map-scroll-on-phones D-38,
// the security review's M-1), shared by the host suites so every host is
// driven through the same states.
//
// Each host suite already stubs its map at its own seam (SnowMap, SightingsMap,
// PredictMap, HotspotReportMap). Wrapping that stub's output in
// `<MapReadinessGate>` (MapReadinessGate.tsx, a component file of its own for
// react-refresh's one-kind-of-export rule) gives it the states a real map passes through before
// its corner row (the map's own Exit) exists:
//   'chunk'        the lazy map chunk is loading: the gate SUSPENDS, so the
//                  host's own Suspense boundary shows the host's own fallback
//   'loading'      SnowMap's placeholder while the style loads
//   'failed'       SnowMap's placeholder after the style failed, with Retry
//   'constructing' react-map-gl's container before maplibre is built: a box
//                  and no children (the gap between the placeholder and the
//                  corner row, which a placeholder-only fix would leave open)
//   'ready'        the stub's own output, which mounts the REAL corner row
// The default is 'ready', so a suite that never calls `setMapReadiness` sees
// its stub exactly as before.
//
// The gate's Retry goes through the Button primitive: MapReadinessGate.tsx is
// not a test file but is under src/, so tabOrderCoverage.test.ts reads it.

import { expect } from 'vitest'
import { act, fireEvent, screen, within } from '@testing-library/react'
import { FS_OPEN_ATTR } from '../lib/useMapFullscreen'
import { STAND_IN_ROW_CLASS } from '../lib/mapExitStandIn'
import { EXIT_FULLSCREEN_LABEL } from '../lib/mapStillCopy'

export type MapReadiness = 'chunk' | 'loading' | 'failed' | 'constructing' | 'ready'

function deferred(): { promise: Promise<void>; resolve: () => void } {
  let resolve = () => {}
  const promise = new Promise<void>(r => { resolve = r })
  return { promise, resolve }
}

let state: MapReadiness = 'ready'
let chunk = deferred()
const listeners = new Set<() => void>()
/** The store the gate (MapReadinessGate.tsx) renders from. */
export const subscribeMapReadiness = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn) } }
export const getMapReadiness = (): MapReadiness => state
/** The pending chunk the gate suspends on while in 'chunk'. */
export const pendingChunk = (): Promise<void> => chunk.promise

/** Move every gated stub to `next`. Leaving 'chunk' resolves the pending chunk
 *  AFTER the state has moved, so the retry React makes renders the new state. */
export function setMapReadiness(next: MapReadiness): void {
  const leaving = state === 'chunk' && next !== 'chunk'
  const was = chunk
  state = next
  for (const fn of [...listeners]) fn()
  if (leaving) {
    was.resolve()
    chunk = deferred()
  }
}

/** Back to 'ready' with a fresh pending chunk for the next 'chunk' row. */
export function resetMapReadiness(): void {
  state = 'ready'
  chunk.resolve()
  chunk = deferred()
  for (const fn of [...listeners]) fn()
}

/** The same move as `setMapReadiness`, inside `act`, with the settled chunk
 *  awaited so React has retried the suspended subtree before it returns. */
export async function moveMap(next: MapReadiness): Promise<void> {
  const pending = state === 'chunk' ? chunk.promise : null
  await act(async () => {
    setMapReadiness(next)
    if (pending) await pending
  })
}

/** Every button the accessibility tree names "Exit fullscreen". */
export const exitButtons = (): HTMLElement[] => screen.queryAllByRole('button', { name: EXIT_FULLSCREEN_LABEL })

/** The one Exit, asserted to be the only one. */
export function theOneExit(): HTMLElement {
  const all = exitButtons()
  if (all.length !== 1) throw new Error(`expected exactly one "${EXIT_FULLSCREEN_LABEL}" button, found ${all.length}`)
  return all[0]
}

/** Whether a button is the stand-in's (rather than the map's own corner row's). */
export const isStandIn = (el: Element): boolean => el.closest(`.${STAND_IN_ROW_CLASS}`) !== null

/** The bar signal the hook sets on the root while a panel is expanded. */
export const barHidden = (): boolean => document.documentElement.hasAttribute(FS_OPEN_ATTR)

/** A real activation, inside an awaited `act`: a press that re-renders a
 *  subtree still suspended on the map chunk is flushed only when awaited. */
export async function press(el: HTMLElement): Promise<void> {
  await act(async () => { fireEvent.click(el) })
}

/** The expanded panel (the host's container while it carries the panel class). */
export function openPanel(): HTMLElement {
  const panel = document.querySelector<HTMLElement>('.sr-map-fs-panel')
  if (!panel) throw new Error('no expanded panel')
  return panel
}

/**
 * THE M-1 PROPERTY ON ONE HOST, opened from its opener while its map is in a
 * not-drawn state (set by the caller before the host rendered): exactly one
 * Exit, inside the panel, carrying its word, its name and its pressed state,
 * focused on open; a press on it collapses the panel, clears the bar signal and
 * puts focus back on the opener; opened again, the map arriving while it is
 * open leaves exactly one Exit (now the map's own), with the focus moved onto
 * it rather than dropped to <body>, the trap still holding, and that Exit
 * exiting too. Every wait is on the observable the next line reads.
 */
export async function expectOneExitUntilAndAfterDrawn(opener: HTMLElement): Promise<void> {
  opener.focus()
  await press(opener)
  expect(barHidden()).toBe(true)
  const held = theOneExit()
  expect(openPanel().contains(held)).toBe(true)
  expect(isStandIn(held)).toBe(true)
  expect(held.textContent).toBe('Exit')
  expect(held.getAttribute('aria-pressed')).toBe('true')
  expect(document.activeElement).toBe(held)

  await press(held)
  expect(barHidden()).toBe(false)
  expect(document.querySelector('.sr-map-fs-panel')).toBeNull()
  expect(exitButtons()).toHaveLength(0)
  expect(document.activeElement).toBe(opener)

  await press(opener)
  expect(document.activeElement).toBe(theOneExit())
  await moveMap('ready')
  const own = theOneExit()
  expect(isStandIn(own)).toBe(false)
  expect(openPanel().contains(own)).toBe(true)
  expect(document.activeElement).toBe(own)
  // The trap is armed on `expanded` throughout, so it never let go: focus sent
  // to the opener behind the panel is pulled back inside.
  opener.focus()
  expect(openPanel().contains(document.activeElement)).toBe(true)

  await press(own)
  expect(barHidden()).toBe(false)
  expect(exitButtons()).toHaveLength(0)
  expect(document.activeElement).toBe(opener)
}

/** In the failed state: Retry is reachable inside the open panel beside the one
 *  Exit, and when it brings the map, one Exit remains, holding the focus. */
export async function expectRetryInFullscreen(opener: HTMLElement): Promise<void> {
  await press(opener)
  const retry = within(openPanel()).getByRole('button', { name: 'Retry' })
  expect(theOneExit()).toBeTruthy()
  retry.focus()
  expect(document.activeElement).toBe(retry)
  await act(async () => { fireEvent.click(retry) })
  const own = theOneExit()
  expect(isStandIn(own)).toBe(false)
  expect(document.activeElement).toBe(own)
  await press(own)
  expect(barHidden()).toBe(false)
}

/** A map that drew before it was opened: one Exit, the map's own, no stand-in. */
export async function expectDrawnExitOnly(opener: HTMLElement): Promise<void> {
  opener.focus()
  await press(opener)
  const own = theOneExit()
  expect(isStandIn(own)).toBe(false)
  expect(document.activeElement).toBe(own)
  expect(document.querySelector(`.${STAND_IN_ROW_CLASS}`)).toBeNull()
  await press(own)
  expect(barHidden()).toBe(false)
  expect(document.activeElement).toBe(opener)
}
