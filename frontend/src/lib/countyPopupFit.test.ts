// The county popup stays inside its map (QA-69).
//
// THE TEST IS A SIMULATION OF MAPLIBRE'S OWN ANCHOR SELECTION, not a check that
// the popup is narrower than the map. That distinction is the whole defect: at
// 320px the failing popup was 242px inside a 240px container, and "242 > 240"
// under-describes a 129px overflow by two orders of magnitude. MapLibre places
// an EDGE of the popup at the click point for its side anchors, so the popup can
// end up almost entirely outside a container it nominally fits in.
//
// `anchorBox` below is transcribed from maplibre-gl 5.x `Popup._update` and
// `anchorTranslate`, and every containment claim here is made by running it over
// EVERY integer click position in the map rather than by arithmetic that could
// be wrong in the same direction as the code.
//
// GUARD THE GUARD: the same sweep is run against the geometry this build
// SHIPPED BEFORE the fix (a flat 248px cap on a 240px map) and asserted to
// report the real overflow, so a simulation that quietly agreed with everything
// could not pass this file.
/// <reference types="node" />
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { parseTopLevelRules } from './cssTopLevelRules'
import {
  countyPopupFit,
  COUNTY_POPUP_FIT_FALLBACK,
  COUNTY_POPUP_FIT_VARS,
  COUNTY_POPUP_BODY_MAX_PX,
  COUNTY_POPUP_BODY_MIN_PX,
  COUNTY_POPUP_CONTENT_CHROME_PX,
  COUNTY_POPUP_MAX_PX,
  COUNTY_POPUP_MIN_PX,
  COUNTY_POPUP_OFFSET_PX,
  COUNTY_POPUP_SHEET_ATTR,
  COUNTY_POPUP_SHEET_BELOW_PX,
  COUNTY_POPUP_SHEET_GUTTER_PX,
} from './countyPopupFit'

/**
 * The popup's horizontal extent for a click at `posX`, exactly as maplibre-gl
 * 5.x computes it: the anchor is chosen from the popup's own width against the
 * map's, then `anchorTranslate` places the box.
 *
 *   'left'  -> translate(0, -50%)      left edge at the point
 *   'right' -> translate(-100%, -50%)  right edge at the point
 *   others  -> translate(-50%, …)      horizontally centred on the point
 *
 * Only the horizontal axis is modelled; the vertical component of the anchor
 * never changes the left/right placement.
 */
function anchorBox(posX: number, popupW: number, mapW: number, offset: number) {
  let kind: 'left' | 'right' | 'center'
  if (posX < popupW / 2) kind = 'left'
  else if (posX > mapW - popupW / 2) kind = 'right'
  else kind = 'center'
  // A vertical component ('top-left', 'bottom-right', …) makes the offset the
  // DIAGONAL one, `offset * SQRT1_2`, which pushes the popup less far out. The
  // plain 'left' / 'right' anchors take the full offset, so that is the worse
  // case for containment and the one the sweep must model.
  const shift = kind === 'center' ? 0 : offset
  if (kind === 'left') return { left: posX + shift, right: posX + shift + popupW }
  if (kind === 'right') return { left: posX - shift - popupW, right: posX - shift }
  return { left: posX - popupW / 2, right: posX + popupW / 2 }
}

/** The worst overflow, in px, over every click position in a map of `mapW`. */
function worstOverflow(popupW: number, mapW: number): number {
  let worst = 0
  for (let x = 0; x <= Math.round(mapW); x++) {
    const box = anchorBox(x, popupW, mapW, COUNTY_POPUP_OFFSET_PX)
    worst = Math.max(worst, -box.left, box.right - mapW)
  }
  return worst
}

/** Map container widths worth sweeping: the reported failures, the phone tier,
 *  the thresholds either side, and a desktop map. */
const WIDTHS = [
  200, 220,
  240,   // Statistics at a 320px viewport — the reported failure
  270,   // Species Detail at a 320px viewport
  300, 320, 336, 337, 350,
  371, 372, 381, 382, 383,   // either side of the anchored-cap threshold
  402, 440, 640, 900, 1440,
]

describe('the popup can never leave its map, at any click position (QA-69)', () => {
  it.each(WIDTHS)('a %ipx map contains the popup for every click in it', (mapW) => {
    const fit = countyPopupFit(mapW, 320)
    if (fit.sheet) {
      // The sheet is not anchored at all: it is pinned left and right, so
      // containment is a property of the stylesheet, asserted separately below.
      // What the geometry still owes is that it asked for a width that FITS.
      expect(fit.maxWidthPx).toBeLessThanOrEqual(mapW - 2 * COUNTY_POPUP_SHEET_GUTTER_PX)
      return
    }
    expect(worstOverflow(fit.maxWidthPx, mapW)).toBe(0)
  })

  it('GUARD THE GUARD: the shipped-before geometry really does overflow', () => {
    // 240px map, flat 248px cap: the configuration QA screenshotted. If this
    // sweep cannot see that, none of the assertions above mean anything.
    const before = worstOverflow(COUNTY_POPUP_MAX_PX, 240)
    expect(before).toBeGreaterThan(100)

    // And the measured case exactly: a county centroid at x = 117 with a 242px
    // popup in a 240px map put the popup's right edge 129px past the container.
    const box = anchorBox(117, 242, 240, COUNTY_POPUP_OFFSET_PX)
    expect(Math.round(box.right - 240)).toBe(129)
  })

  it('GUARD THE GUARD: a popup merely NARROWER than its map is not enough', () => {
    // The tempting fix. 239px inside 240px is "contained" by the naive reading
    // and still overflows by nearly its whole width.
    expect(worstOverflow(239, 240)).toBeGreaterThan(100)
  })
})

describe('the anchored form is unchanged wherever it was already safe', () => {
  it('is byte-identical to the shipped geometry on any map that can anchor it', () => {
    for (const w of [382, 402, 640, 900, 1440, 2560]) {
      expect(countyPopupFit(w, 600)).toEqual(COUNTY_POPUP_FIT_FALLBACK)
    }
  })

  it('narrows continuously rather than stepping, between the two thresholds', () => {
    const widths = [340, 350, 360, 370, 380]
    const caps = widths.map(w => countyPopupFit(w, 320).maxWidthPx)
    expect(caps.every(c => c >= COUNTY_POPUP_MIN_PX && c < COUNTY_POPUP_MAX_PX)).toBe(true)
    // Monotone in the map width, so a resize can never widen the popup while
    // shrinking the map.
    for (let i = 1; i < caps.length; i++) expect(caps[i]).toBeGreaterThanOrEqual(caps[i - 1])
    // None of these is a sheet: the band exists as an anchored form.
    expect(widths.every(w => !countyPopupFit(w, 320).sheet)).toBe(true)
  })

  it('crosses to the sheet exactly at the published threshold', () => {
    expect(countyPopupFit(COUNTY_POPUP_SHEET_BELOW_PX, 320).sheet).toBe(false)
    expect(countyPopupFit(COUNTY_POPUP_SHEET_BELOW_PX - 1, 320).sheet).toBe(true)
    // The two maps QA measured are both under it, which is why one of them
    // failed and the other was one lucky click away from failing.
    expect(countyPopupFit(240, 320).sheet).toBe(true)
    expect(countyPopupFit(270, 320).sheet).toBe(true)
  })
})

describe('the sheet is wider than the anchored cap it replaces', () => {
  it('gives the failing 240px map more readable width, not less', () => {
    const fit = countyPopupFit(240, 320)
    expect(fit.sheet).toBe(true)
    // What an anchored cap alone would have left on this map.
    const anchoredOnly = Math.floor((240 - COUNTY_POPUP_OFFSET_PX) / 1.5)
    expect(anchoredOnly).toBeLessThan(COUNTY_POPUP_MIN_PX)
    expect(fit.maxWidthPx).toBeGreaterThan(anchoredOnly)
    expect(fit.maxWidthPx).toBe(224)
  })

  it('caps the body against the MAP height, not the viewport', () => {
    const short = countyPopupFit(240, 320)
    const tall = countyPopupFit(240, 900)
    expect(short.bodyCapPx).toBeLessThan(tall.bodyCapPx)
    expect(short.bodyCapPx).toBeLessThan(320)
  })
})

describe('an unusable reading leaves today behaviour in place', () => {
  it.each([
    ['zero (jsdom, a hidden tab, a pre-layout pass)', 0, 0],
    ['zero width only', 0, 320],
    ['zero height only', 240, 0],
    ['negative', -240, -320],
    ['NaN', Number.NaN, 320],
    ['Infinity', Number.POSITIVE_INFINITY, 320],
  ])('%s returns the shipped fallback rather than a guess', (_name, w, h) => {
    expect(countyPopupFit(w, h)).toEqual(COUNTY_POPUP_FIT_FALLBACK)
  })
})

// ── The stylesheet half ──────────────────────────────────────────────────────
//
// The geometry above decides the numbers; the containment itself is CSS, and two
// of its declarations are load-bearing in ways nothing else can catch: the
// `!important` (MapLibre writes `max-width` as an INLINE style, which outranks
// any normal author rule) and the sheet's `transform: none` (MapLibre writes the
// anchor transform inline on every popup update).

const css = readFileSync(new URL('../globals.css', import.meta.url), 'utf8')
const topLevel = parseTopLevelRules(css)

const anchoredCap = topLevel.get('.maplibregl-popup.sr-county-popup')
const bodyRule = topLevel.get('.sr-county-popup-body')
const sheetSelector = `.maplibregl-map[${COUNTY_POPUP_SHEET_ATTR}="sheet"] .maplibregl-popup.sr-county-popup`
const sheetRule = topLevel.get(sheetSelector)
const sheetBody = topLevel.get(`.maplibregl-map[${COUNTY_POPUP_SHEET_ATTR}="sheet"] .sr-county-popup-body`)

describe('globals.css carries the containment the geometry assumes', () => {
  it('parses all four rules (vacuity guard)', () => {
    expect(anchoredCap).toBeTruthy()
    expect(bodyRule).toBeTruthy()
    expect(sheetRule).toBeTruthy()
    expect(sheetBody).toBeTruthy()
  })

  it('caps the anchored popup from the published property, with !important', () => {
    expect(anchoredCap).toContain(`var(${COUNTY_POPUP_FIT_VARS.maxWidth}`)
    // Beats MapLibre's inline max-width. Without this the whole cap is inert.
    expect(/max-width:[^;]*!important/.test(anchoredCap!)).toBe(true)
    // The fallback is the shipped value, so an unmeasured map renders as before.
    expect(anchoredCap).toContain(`${COUNTY_POPUP_MAX_PX}px`)
  })

  it('keeps the design\u2019s body width, as ABSOLUTE lengths (QA-02)', () => {
    // THE REGRESSION THIS PINS. These two started as inline `minWidth: 188` /
    // `maxWidth: 220`. Moving them to a class and softening them to
    // `min-width: min(188px, 100%)` / `max-width: 100%` made the floor a no-op:
    // the popup is absolutely positioned and shrink-to-fit, so `100%` resolves
    // against the used width the content itself produced and the `min()`
    // collapses to it. The Map Explorer's county popup \u2014 a surface this change
    // was required to leave alone \u2014 measured 30px narrower at 100% text scale.
    expect(bodyRule).toMatch(new RegExp(`min-width:\\s*${COUNTY_POPUP_BODY_MIN_PX}px\\s*;`))
    expect(bodyRule).toMatch(new RegExp(`max-width:\\s*${COUNTY_POPUP_BODY_MAX_PX}px\\s*;`))
    // The rule the regression took: no percentage may appear in EITHER width on
    // the anchored form, in any spelling (`100%`, `min(...)`, `clamp(...)`).
    for (const decl of ['min-width', 'max-width']) {
      const value = new RegExp(`${decl}:([^;]*);`).exec(bodyRule!)
      expect(value, `${decl} is declared`).toBeTruthy()
      expect(value![1]).not.toContain('%')
    }
    // Comments first: this file's own comment NAMES the inline declaration it
    // replaced, which a raw substring scan would read as the declaration.
    const inline = readFileSync(new URL('../components/map/CountyLayer.tsx', import.meta.url), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '')
    expect(inline).not.toMatch(/minWidth:\s*188/)
    expect(inline).toContain('sr-county-popup-body')
  })

  it('the absolute floor fits inside the NARROWEST anchored popup', () => {
    // Why the floor above can be absolute at all, asserted rather than argued:
    // the sheet takes over below COUNTY_POPUP_MIN_PX, and that constant IS the
    // body floor plus the content chrome. So the tightest anchored popup leaves
    // the body exactly its minimum, and no anchored popup can be overflowed by
    // it. Swept over the whole anchored band, not just the endpoint.
    for (let mapW = 320; mapW <= 1440; mapW++) {
      const fit = countyPopupFit(mapW, 600)
      if (fit.sheet) continue
      const bodyRoom = fit.maxWidthPx - COUNTY_POPUP_CONTENT_CHROME_PX
      expect(bodyRoom).toBeGreaterThanOrEqual(COUNTY_POPUP_BODY_MIN_PX)
    }
    // Non-vacuity: the sweep really does reach the tightest anchored popup.
    expect(countyPopupFit(COUNTY_POPUP_SHEET_BELOW_PX, 600).maxWidthPx)
      .toBe(COUNTY_POPUP_MIN_PX)
    expect(COUNTY_POPUP_MIN_PX - COUNTY_POPUP_CONTENT_CHROME_PX)
      .toBe(COUNTY_POPUP_BODY_MIN_PX)
  })

  it('the SHEET releases both widths, because it is not anchored', () => {
    // The sheet is pinned to the map's inline box, which on a 200px map is
    // narrower than the anchored floor. It is the one form that must yield, and
    // it does so here rather than by weakening the rule above.
    expect(sheetBody).toMatch(/min-width:\s*0\s*;/)
    expect(sheetBody).toMatch(/max-width:\s*100%\s*;/)
    // Specificity, not source order, is what makes the override win: the sheet
    // selector carries a class, an attribute and a class against a lone class.
    expect(sheetBody).not.toContain('!important')
    // And the case it exists for is real \u2014 a map this narrow does take the
    // sheet, and its sheet is narrower than the anchored body floor plus chrome.
    const narrow = countyPopupFit(200, 320)
    expect(narrow.sheet).toBe(true)
    expect(narrow.maxWidthPx - COUNTY_POPUP_CONTENT_CHROME_PX)
      .toBeLessThan(COUNTY_POPUP_BODY_MIN_PX)
  })

  it('pins the sheet to all three container edges and kills the inline transform', () => {
    for (const decl of ['left', 'right', 'bottom']) {
      expect(new RegExp(`${decl}:\\s*${COUNTY_POPUP_SHEET_GUTTER_PX}px\\s*!important`).test(sheetRule!)).toBe(true)
    }
    expect(sheetRule).toMatch(/top:\s*auto\s*!important/)
    // MapLibre writes the anchor transform inline on EVERY update, so a normal
    // declaration here would be overwritten on the next map move.
    expect(sheetRule).toMatch(/transform:\s*none\s*!important/)
  })

  it('paints the sheet above the control that opened it', () => {
    // The "Counties in view" panel is z-index 1050 and is the keyboard route
    // INTO this popup; on a 320px-tall map at 200% text scale the two occupy
    // the same band. A popup the user must be able to dismiss cannot sit under
    // it. Still below the app's overlay tier (1200).
    const z = /z-index:\s*(\d+)/.exec(sheetRule!)
    expect(z, 'the sheet declares a z-index').toBeTruthy()
    expect(Number(z![1])).toBeGreaterThan(1050)
    expect(Number(z![1])).toBeLessThan(1200)
    // Non-vacuity: the panel really does claim 1050.
    const layer = readFileSync(new URL('../components/map/CountyLayer.tsx', import.meta.url), 'utf8')
    expect(layer).toContain('zIndex: 1050')
  })

  it('caps the sheet body from the measured property, not from the viewport', () => {
    expect(sheetBody).toContain(`var(${COUNTY_POPUP_FIT_VARS.bodyCap}`)
    // The shipped `.sr-map-popup-body` cap is viewport-relative, which inside a
    // 320px-tall map at 200% text scale is clipped rather than scrolled.
    expect(sheetBody).not.toContain('dvh')
    expect(topLevel.get('.sr-map-popup-body')).toContain('dvh')
  })

  it('scopes every sheet rule to the attribute, so no other popup is touched', () => {
    for (const [selector] of topLevel) {
      if (!selector.includes('sr-county-popup')) continue
      if (selector.includes(COUNTY_POPUP_SHEET_ATTR)) continue
      // The two unscoped rules are the width cap and the body, both of which are
      // no-ops at the fallback values.
      expect(['.maplibregl-popup.sr-county-popup', '.sr-county-popup-body']).toContain(selector)
    }
  })
})
