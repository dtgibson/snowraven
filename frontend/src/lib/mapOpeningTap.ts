// The second tap of the double tap that OPENED a map, recognised so it is not
// taken as a tap on the map it opened (map-scroll-on-phones QA round 1).
//
// THE DEFECT. On the phone tier the Weather location picker is a still with an
// opener under it, and in fullscreen a tap drops the pin. A quick double tap on
// the opener or on the still opened the map with the first tap, and the second
// landed on the map that had just filled the window and dropped a pin there: a
// change to the picked place the user never asked for (16 of 16 runs, both
// engines). The other maps take a second tap as at most a pin selection or a
// popup, which changes nothing the user has chosen, so only the picker reads this.
//
// WHY A WINDOW, AND WHY ANCHORED ON THE OPENING PRESS. The platform's own click
// count is not reliable here: measured with the same two real taps, Chromium
// reported the second click as `detail: 2` and WebKit as `detail: 1`. What
// makes a tap "the second of a double tap" is the platform's own definition:
// close in time and close in place to the first. So the press that opened the
// map is recorded (its point and its event time) by the host, and a map tap that
// falls inside both bounds of THAT press is the rest of the opening gesture. A
// tap anywhere else, or at the same point once the window has passed, is a
// deliberate tap and drops the pin. Nothing reads a clock: both times are the
// two events' own `timeStamp`s, on the document's one time origin. A press made
// by the keyboard (Enter or Space on the opener) is not a tap and opens no
// window: both engines report it as `detail: 0` (measured), and WebKit gives it
// the button's centre as its point, which a later tap there could otherwise
// match. Taps read `detail` 1 or more in both. Were an engine ever to report a
// tap as 0, the window would simply not open, which is the shipped behaviour.
//
// Pure and dependency-free: WeatherForecastPanel.tsx (on App.tsx's static graph)
// records the press, and the lazy PredictMap.tsx reads it.

/** How long after the opening press a tap near it is still the same gesture.
 *  The double-tap and double-click windows the app's platforms use run from
 *  300ms (Android's `ViewConfiguration.DOUBLE_TAP_TIMEOUT`) to 500ms (the
 *  Windows double-click default, which a mouse on a narrow desktop window
 *  meets), and the two real taps measured here arrived 112ms to 342ms apart.
 *  500ms covers every one of them, and a deliberate pin drop needs the user to
 *  see the map that just opened and aim first, which takes longer. */
export const OPENING_DOUBLE_TAP_MS = 500

/** How far from the opening press a tap may land and still be its second tap:
 *  Android's `ViewConfiguration.DOUBLE_TAP_SLOP`, 100dp, in CSS px. The opener
 *  is a full-width button 44px tall at 100% text and 88px at 200%, so a double
 *  tap on it can land tens of px apart; a tap farther away is aimed. */
export const OPENING_DOUBLE_TAP_SLOP_PX = 100

/** The opening press: where it landed and when (`Event.timeStamp`). */
export interface OpeningPress { x: number; y: number; t: number }

/** The fields both a React and a DOM pointer or mouse event carry. */
export interface TapPoint { clientX: number; clientY: number; timeStamp: number }

/** The press to remember, or null for a keyboard or scripted activation
 *  (`detail` 0), which is not the first tap of anything. */
export function openingPressOf(e: TapPoint & { detail: number }): OpeningPress | null {
  return e.detail > 0 ? { x: e.clientX, y: e.clientY, t: e.timeStamp } : null
}

/** True when `tap` is the rest of the gesture `press` began: inside the window
 *  (strictly) and inside the slop (inclusive). A missing press, a non-finite
 *  reading or a tap that is EARLIER than the press is never the second tap. */
export function continuesOpeningPress(press: OpeningPress | null | undefined, tap: TapPoint): boolean {
  if (!press) return false
  const dt = tap.timeStamp - press.t
  const d = Math.hypot(tap.clientX - press.x, tap.clientY - press.y)
  if (!Number.isFinite(dt) || !Number.isFinite(d)) return false
  return dt >= 0 && dt < OPENING_DOUBLE_TAP_MS && d <= OPENING_DOUBLE_TAP_SLOP_PX
}
