// The second tap of the double tap that opened a map (map-scroll-on-phones QA
// round 1, item 5): both sides of the time window and of the place bound.
//
// No fake timers: nothing here reads a clock. Both times are the two events'
// own `timeStamp`s, so the window is tested by the stamps the events carry,
// which is how it runs in the engines. That the Weather picker drops no pin on
// the second tap and does on a deliberate one is the wiring row in
// components/mapFullscreenWiring.test.tsx; that the host records the press is
// in components/WeatherForecastPanel.test.tsx.

import { describe, it, expect } from 'vitest'
import {
  OPENING_DOUBLE_TAP_MS, OPENING_DOUBLE_TAP_SLOP_PX, continuesOpeningPress, openingPressOf,
} from './mapOpeningTap'

const PRESS = { x: 195, y: 422, t: 1000 }
const tap = (dx: number, dy: number, dt: number) => ({ clientX: PRESS.x + dx, clientY: PRESS.y + dy, timeStamp: PRESS.t + dt })

describe('continuesOpeningPress', () => {
  it('holds the window\'s two sides: inside it a tap at the same point is the second tap, at its end it is not', () => {
    expect(OPENING_DOUBLE_TAP_MS).toBe(500)
    expect(continuesOpeningPress(PRESS, tap(0, 0, 0))).toBe(true)
    // The real second taps measured: 112ms (WebKit) and 342ms (Chromium).
    expect(continuesOpeningPress(PRESS, tap(0, 0, 112))).toBe(true)
    expect(continuesOpeningPress(PRESS, tap(0, 0, 342))).toBe(true)
    expect(continuesOpeningPress(PRESS, tap(0, 0, OPENING_DOUBLE_TAP_MS - 0.1))).toBe(true)
    expect(continuesOpeningPress(PRESS, tap(0, 0, OPENING_DOUBLE_TAP_MS))).toBe(false)
    expect(continuesOpeningPress(PRESS, tap(0, 0, 2000))).toBe(false)
  })

  it('holds the place bound\'s two sides, in any direction', () => {
    expect(OPENING_DOUBLE_TAP_SLOP_PX).toBe(100)
    expect(continuesOpeningPress(PRESS, tap(100, 0, 100))).toBe(true)
    expect(continuesOpeningPress(PRESS, tap(0, -100, 100))).toBe(true)
    expect(continuesOpeningPress(PRESS, tap(60, 80, 100))).toBe(true) // exactly 100px away
    expect(continuesOpeningPress(PRESS, tap(100.5, 0, 100))).toBe(false)
    expect(continuesOpeningPress(PRESS, tap(61, 80, 100))).toBe(false)
  })

  it('is never the second tap without a press, before the press, or on a reading that is not a number', () => {
    expect(continuesOpeningPress(null, tap(0, 0, 100))).toBe(false)
    expect(continuesOpeningPress(undefined, tap(0, 0, 100))).toBe(false)
    expect(continuesOpeningPress(PRESS, tap(0, 0, -1))).toBe(false)
    expect(continuesOpeningPress(PRESS, { clientX: Number.NaN, clientY: PRESS.y, timeStamp: PRESS.t + 100 })).toBe(false)
    expect(continuesOpeningPress({ ...PRESS, t: Number.NaN }, tap(0, 0, 100))).toBe(false)
  })
})

describe('openingPressOf', () => {
  it('records a tap, and nothing for a keyboard or scripted activation (detail 0)', () => {
    expect(openingPressOf({ clientX: 10, clientY: 20, timeStamp: 30, detail: 1 })).toEqual({ x: 10, y: 20, t: 30 })
    expect(openingPressOf({ clientX: 10, clientY: 20, timeStamp: 30, detail: 2 })).toEqual({ x: 10, y: 20, t: 30 })
    // WebKit gives a keyboard click the button's centre as its point (measured),
    // so a recorded keyboard press could swallow a later tap there.
    expect(openingPressOf({ clientX: 195, clientY: 422, timeStamp: 30, detail: 0 })).toBeNull()
  })
})
