// @vitest-environment jsdom
//
// The Map Explorer chrome budget's arithmetic, and (since map-scroll-on-phones
// QA round 1) the one trigger the hook adds for the Android insets.
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
import { describe, it, expect, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { MAP_CHROME_VAR, mapPanelChromePx, panelOnFloor, useMapPanelChrome } from './mapPanelChrome'

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


// map-scroll-on-phones D-14: whether the Map Explorer panel is on its phone-tier
// floor, which is the one condition under which its map becomes a still. The
// arithmetic only; that the panel's height is the stylesheet's and nothing the
// still adds can move it is the Tester's real-engine reading.
describe('panelOnFloor', () => {
  it('is on the floor exactly when the rendered height is the computed min-height', () => {
    expect(panelOnFloor(300, 300)).toBe(true)
    // A sub-pixel reading of the same box (a fractional device pixel ratio).
    expect(panelOnFloor(300.4, 300)).toBe(true)
    // 320 x 568 at 100% text: the window leaves 305px, so the panel fits.
    expect(panelOnFloor(305, 300)).toBe(false)
    expect(panelOnFloor(301, 300)).toBe(false)
  })

  it('answers null, so the last good answer stands, for a hidden tab or an unlaid-out box', () => {
    expect(panelOnFloor(0, 300)).toBeNull()          // display: none reads 0 high
    expect(panelOnFloor(Number.NaN, 300)).toBeNull()  // jsdom / pre-layout
    expect(panelOnFloor(300, Number.NaN)).toBeNull()  // `min-height: auto` parses to NaN
    expect(panelOnFloor(300, 0)).toBeNull()           // no floor at all (the fullscreen panel)
  })
})


// map-scroll-on-phones QA round 1, F-3: the Android app's insets arrive after
// first paint, as style properties MainActivity.kt writes on <html>. The body's
// top padding moves <main> down and the bar's bottom padding grows its border
// box, and no CONTENT box changes, so the shipped ResizeObserver never fired and
// the chrome stayed stale (the page scrolled 56px under the live map, modelled).
// jsdom has no ResizeObserver and no layout: the rects are fixtures, and what
// this proves is that a write on <html>'s style re-measures, not the geometry.
describe('useMapPanelChrome re-measures when the insets land on <html>', () => {
  afterEach(() => {
    document.body.replaceChildren()
    document.documentElement.removeAttribute('style')
  })

  it('republishes the chrome from the new geometry, and stops listening on unmount', async () => {
    const geo = { mainTop: 118, below: 56.5, bar: 56.5 }
    const shell = document.createElement('div')
    const main = document.createElement('main')
    const footer = document.createElement('p')
    const bar = document.createElement('nav')
    shell.append(main, footer)
    document.body.append(shell, bar)
    const rect = (top: number, height: number) => ({ top, bottom: top + height, height, left: 0, right: 0, width: 0, x: 0, y: top, toJSON: () => ({}) }) as DOMRect
    main.getBoundingClientRect = () => rect(geo.mainTop, 500)
    footer.getBoundingClientRect = () => rect(geo.mainTop + 500, geo.below)
    bar.getBoundingClientRect = () => rect(0, geo.bar)
    const chrome = () => main.style.getPropertyValue(MAP_CHROME_VAR)

    const { unmount } = renderHook(() => useMapPanelChrome({ current: main }, { current: footer }, bar))
    expect(chrome()).toBe('231px')

    // The insets land: the body pads 32px on top, the bar 30px more at its
    // bottom (6px plus the 24px inset), the footer 24px.
    geo.mainTop += 32; geo.bar += 30; geo.below += 24
    document.documentElement.style.setProperty('--sr-inset-top', '32px')
    document.documentElement.style.setProperty('--sr-inset-bottom', '24px')
    await waitFor(() => expect(chrome()).toBe('317px'))
    // Written on <main>, never on <html>, so the trigger cannot feed itself.
    expect(document.documentElement.style.getPropertyValue(MAP_CHROME_VAR)).toBe('')

    unmount()
    geo.mainTop += 100
    document.documentElement.style.setProperty('--sr-inset-top', '132px')
    await Promise.resolve()
    expect(chrome()).toBe('317px')
  })
})
