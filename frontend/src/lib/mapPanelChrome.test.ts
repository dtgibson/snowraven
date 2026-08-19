// The Map Explorer chrome budget's arithmetic.
//
// WHAT THIS PROVES: that `mapPanelChromePx` turns two rect readings into the
// number the stylesheet subtracts, and that it refuses the readings a
// browserless or half-laid-out environment produces rather than publishing a
// plausible-looking zero.
//
// WHAT IT CANNOT PROVE, and must not be read as covering: any geometry at all.
// Whether the published number makes the page fit its viewport is a browser
// measurement — it was made against real renders of three builds in Chromium and
// WebKit, at five widths x four text scales x windowed/fullscreen, and is
// written up in the PR description. jsdom has no layout engine, so every rect
// here is a fixture.
//
// Each assertion below was mutation-checked against the implementation. The
// mutations, and what they cost:
//
//   ceil -> floor            a fractional chrome (213.5 + 38 = 251.5) publishes
//                            one pixel short, the panel is half a pixel too tall,
//                            and `scrollHeight` rounds that UP into a 1px page
//                            scroll. Caught by "rounds UP" and by the 1434px row
//                            in the first test; NOT by the 1600px row, whose
//                            terms happen to sum to an integer.
//   ceil -> round            same, for any fraction below .5.
//   drop the finite guard    an unlaid-out box gives NaN; `${NaN}px` is an
//                            invalid declaration, so the calc falls back to the
//                            178px constant — silently the original defect.
//   drop `below <= 0`        jsdom (and any pre-layout pass) reads every rect as
//                            zero, publishing `0px`: the panel becomes a full
//                            100dvh and the ENTIRE chrome goes below the fold.
//                            This is the one that matters most, because it fails
//                            in the direction that looks like nothing is wrong.
//   `below <= 0` -> `< 0`    admits the all-zero reading above.
//   drop `above < 0`         admits a reading taken against the wrong origin.
import { describe, it, expect } from 'vitest'
import { mapPanelChromePx } from './mapPanelChrome'

describe('mapPanelChromePx', () => {
  it('sums what is above <main> and what is below it', () => {
    // The three configurations the defect was measured in, to the half pixel.
    expect(mapPanelChromePx(213.5, 38)).toBe(252)   // 1434px wide, desktop
    expect(mapPanelChromePx(185, 38)).toBe(223)     // 1600px wide, tab strip fits
    expect(mapPanelChromePx(189.5, 38)).toBe(228)   // 402px phone
  })

  it('rounds UP, so the panel is never a sub-pixel too tall for the space', () => {
    expect(mapPanelChromePx(10.1, 0.1)).toBe(11)
    expect(mapPanelChromePx(10.01, 1)).toBe(12)
    // An exact integer must not gain a pixel it does not need.
    expect(mapPanelChromePx(200, 40)).toBe(240)
  })

  it('refuses a reading with no layout behind it rather than publishing zero', () => {
    // jsdom, and any pass before first layout: every rect reads zero.
    expect(mapPanelChromePx(0, 0)).toBeNull()
    // A footer always has text and padding, so a zero `below` is a broken
    // reading, not a zero-height footer.
    expect(mapPanelChromePx(213.5, 0)).toBeNull()
  })

  it('refuses geometrically impossible readings', () => {
    // The panel is BETWEEN these two, so neither can be negative.
    expect(mapPanelChromePx(-1, 38)).toBeNull()
    expect(mapPanelChromePx(213.5, -1)).toBeNull()
  })

  it('refuses non-finite readings', () => {
    expect(mapPanelChromePx(NaN, 38)).toBeNull()
    expect(mapPanelChromePx(213.5, NaN)).toBeNull()
    expect(mapPanelChromePx(Infinity, 38)).toBeNull()
    expect(mapPanelChromePx(213.5, Infinity)).toBeNull()
  })

  it('accepts the smallest real reading: no chrome above, a footer below', () => {
    // Not a hypothetical shape — it is what the ≤640 tier trends toward — and it
    // is the case a `> 0` guard on `above` would wrongly reject.
    expect(mapPanelChromePx(0, 38)).toBe(38)
  })
})
