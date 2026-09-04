// The nav's density arithmetic (feature: nav-rework).
//
// This is where the thresholds are actually pinned. The component test proves the
// WIRING — that the sidebar renders when the derivation says sidebar — and cannot
// meaningfully prove the arithmetic, because jsdom has no layout and every width
// in it is a number the test itself supplied. So the numbers live here, as the
// worked table the design refinement published, and the component test asserts
// the rendering.

import { describe, it, expect } from 'vitest'
import {
  CONTENT_FLOOR_PX,
  MAP_SIDEBAR_MAX_PX,
  MAP_SIDEBAR_MIN_PX,
  NAV_SIDEBAR_REM,
  SIDEBAR_RESTORE_HYSTERESIS_PX,
  contentReservePx,
  deriveWideDensity,
  resolveDensity,
  type ContentReserve,
  type WideDensity,
} from './navDensity'

const ROOT_1X = 16

const derive = (
  availablePx: number,
  reserve: ContentReserve = 'none',
  previous: WideDensity = 'sidebar',
  rootFontPx = ROOT_1X,
) => deriveWideDensity({ availablePx, rootFontPx, reserve, previous })

describe('the content reserve', () => {
  it('is nothing at all for a tab with no sidebar of its own', () => {
    expect(contentReservePx('none', 1512)).toBe(0)
  })

  it('mirrors clamp(240px, 28vw, 300px) — the Map Explorer sidebar', () => {
    expect(contentReservePx('map-sidebar', 700)).toBe(MAP_SIDEBAR_MIN_PX)   // 196 -> floor
    expect(contentReservePx('map-sidebar', 1024)).toBeCloseTo(286.72, 2)    // in band
    expect(contentReservePx('map-sidebar', 1512)).toBe(MAP_SIDEBAR_MAX_PX)  // 423 -> ceiling
  })

  it('reserves nothing for an unusable width rather than guessing', () => {
    expect(contentReservePx('map-sidebar', 0)).toBe(0)
    expect(contentReservePx('map-sidebar', Number.NaN)).toBe(0)
  })
})

describe('the worked table from the design refinement, at 1x', () => {
  // Written as the published table so a change to either has to change the other.
  const CASES: Array<[label: string, width: number, reserve: ContentReserve, want: WideDensity]> = [
    ['1512 (MacBook 14")',                1512, 'none',        'sidebar'],
    ['1512, Map Explorer',                1512, 'map-sidebar', 'sidebar'],
    ['1024 (small laptop window)',        1024, 'none',        'sidebar'],
    ['1024, Map Explorer',                1024, 'map-sidebar', 'rail'],
    ['834 (iPad portrait)',                834, 'none',        'rail'],
    ['720 (half-screen on a 1440)',        720, 'none',        'rail'],
  ]

  it.each(CASES)('%s -> %s', (_label, width, reserve, want) => {
    // Started from `sidebar`, so the plain floor applies rather than the
    // restore threshold; the table is written for a window arriving at that size.
    expect(derive(width, reserve, 'sidebar')).toBe(want)
  })

  it('the Map Explorer case is settled by the arithmetic, not by a rule about maps', () => {
    // A very wide monitor keeps BOTH sidebars; a 1024px window does not. That is
    // the design refinement's deliberate sharpening of the change brief, and it
    // is the whole reason the reserve is a term rather than a special case.
    expect(derive(2560, 'map-sidebar')).toBe('sidebar')
    expect(derive(1024, 'map-sidebar')).toBe('rail')
  })
})

describe('the floor is the app\'s own phone boundary, not a number of taste', () => {
  it('collapses exactly when the content column would fall below 640', () => {
    const navW = NAV_SIDEBAR_REM * ROOT_1X            // 216 at 1x
    expect(derive(navW + CONTENT_FLOOR_PX, 'none', 'sidebar')).toBe('sidebar')
    expect(derive(navW + CONTENT_FLOOR_PX - 1, 'none', 'sidebar')).toBe('rail')
  })

  it('tracks the text scale, because navW is rem and the floor is px', () => {
    // At 200% the column is 432px wide, so the same window loses the sidebar:
    // this is the case a hidden width probe used to be needed for, and the case
    // a fixed breakpoint could never see at all.
    expect(derive(900, 'none', 'sidebar', 16)).toBe('sidebar')   // 900-216 = 684
    expect(derive(900, 'none', 'sidebar', 32)).toBe('rail')      // 900-432 = 468
  })
})

describe('hysteresis: a density change is a visible layout change', () => {
  const navW = NAV_SIDEBAR_REM * ROOT_1X

  it('needs headroom to come BACK, so a drag cannot flip it every pixel', () => {
    const restore = navW + CONTENT_FLOOR_PX + SIDEBAR_RESTORE_HYSTERESIS_PX
    expect(derive(restore, 'none', 'rail')).toBe('sidebar')
    expect(derive(restore - 1, 'none', 'rail')).toBe('rail')
  })

  it('is ASYMMETRIC on purpose: leaving needs no headroom at all', () => {
    // The band between the two thresholds holds its current answer, and the
    // asymmetry is what guarantees the content column is never left under the
    // floor even for one frame.
    const inBand = navW + CONTENT_FLOOR_PX + 10
    expect(derive(inBand, 'none', 'sidebar')).toBe('sidebar')
    expect(derive(inBand, 'none', 'rail')).toBe('rail')
  })
})

describe('an unusable reading holds the current answer rather than guessing', () => {
  // Publishing a guess would flip the shell on the first frame and flip it back
  // on the second. Zero is what an unlaid-out box and jsdom both report.
  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])('width %s', w => {
    expect(derive(w, 'none', 'rail')).toBe('rail')
    expect(derive(w, 'none', 'sidebar')).toBe('sidebar')
  })

  it('and the same for a root font size it cannot read', () => {
    expect(derive(1512, 'none', 'rail', 0)).toBe('rail')
    expect(derive(1512, 'none', 'rail', Number.NaN)).toBe('rail')
  })
})

describe('resolveDensity: the derivation is a CEILING and the toggle is one step below it', () => {
  it('phone wins over everything — it is a media query, not this arithmetic', () => {
    expect(resolveDensity(true, 'sidebar', false)).toBe('phone')
    expect(resolveDensity(true, 'rail', true)).toBe('phone')
  })

  it('a manual collapse steps a derived sidebar down to the rail', () => {
    expect(resolveDensity(false, 'sidebar', false)).toBe('sidebar')
    expect(resolveDensity(false, 'sidebar', true)).toBe('rail')
  })

  it('CANNOT force a sidebar the measurement says will not fit', () => {
    // The property that makes the toggle and the derivation unable to contradict
    // each other: a collapse held over from a wide window is simply inert in a
    // window that derives the rail anyway.
    expect(resolveDensity(false, 'rail', false)).toBe('rail')
    expect(resolveDensity(false, 'rail', true)).toBe('rail')
  })
})
