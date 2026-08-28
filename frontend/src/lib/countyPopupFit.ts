// How wide the county popup may be inside the map it lives in, and when it must
// stop being an anchored popup at all (county-shading-and-project-stats, QA-69).
//
// THE DEFECT THIS EXISTS FOR. At 320px with 200% in-app text scale, the county
// popup on Statistics' Geographic Stats map rendered 129px past its map
// container and was clipped by `.maplibregl-map`'s `overflow: hidden` — with the
// close button entirely outside the container, so the popup could not be
// dismissed at all. Both themes, measured then screenshotted.
//
// IT IS NOT A "THE POPUP IS 2px TOO WIDE" BUG, which is what the raw numbers
// (242px popup, 240px container) suggest and which a 2px trim would have
// "fixed" without touching the mechanism. MapLibre chooses the popup's anchor
// itself, in `Popup._update`:
//
//     if (pos.x < width / 2)                       anchor 'left'
//     else if (pos.x > mapWidth - width / 2)       anchor 'right'
//
// and `left` places the popup's LEFT edge at the click point (plus the offset),
// `right` its RIGHT edge. So the worst case for `left` is a right edge at
// `1.5 * width + offset`, and for `right` a left edge at
// `mapWidth - 1.5 * width - offset`. Containment therefore needs
//
//     width <= (mapWidth - offset) / 1.5
//
// and NOT `width <= mapWidth`. Once the popup passes two thirds of its map, the
// centred band between the two thresholds is empty, every click takes a
// side anchor, and the popup overflows by nearly its own width. The measured
// 129px is exactly that: 240px container, 242px popup, a county centroid at
// x = 117.
//
// It follows that the same popup was already unsafe at 100% text scale on the
// same 240px map (235.4px is also over two thirds of it) — the reported
// configuration is where a click happened to land outside the safe band, not
// where the defect begins. So the repair is geometric rather than a tweak at
// one scale, and it applies at all three county-shading mounts because they
// share one `CountyLayer`.
//
// TWO REPAIRS, IN ORDER, BECAUSE ONE OF THEM ALONE IS UNACCEPTABLE:
//
//   1. CAP THE WIDTH at what the container can anchor. On any map wide enough
//      to anchor the shipped 248px popup the cap IS 248px, so desktop, tablet
//      and the Map Explorer's own full-width map are byte-identical to today.
//      Between there and about 337px of map the popup narrows continuously
//      rather than stepping.
//
//   2. BELOW THE LEGIBILITY FLOOR, STOP ANCHORING. On a 240px map the cap
//      computed by (1) is 153px, which at 200% text scale is about five
//      characters a line — bounded, dismissible, and useless. So under the
//      floor the popup becomes a SHEET pinned to the container's own inline
//      box: full width less a small gutter (224px on that same 240px map, i.e.
//      WIDER and more readable than the anchored form it replaces), no tip, and
//      containment that is a property of `left`/`right`/`bottom` rather than of
//      arithmetic about where the user clicked.
//
// The floor is the design's own minimum body width (188px) plus the popup
// chrome, so it is the width below which the popup was already going to be
// squeezed rather than a number invented here.
//
// PURE, and deliberately so: every input is a measured px reading passed in, so
// the whole rule is unit-testable without a browser and the DOM side is three
// property writes. An unusable reading returns today's shipped behavior rather
// than a clamped guess — publishing a "safe" value off a pre-layout or jsdom
// zero would narrow every popup in the app to nothing.

/** The popup's shipped `maxWidth`, and the widest it is ever allowed to be. */
export const COUNTY_POPUP_MAX_PX = 248

/**
 * The design's own minimum and maximum body width, shipped as inline
 * declarations before this change and now carried by `.sr-county-popup-body`.
 * Exported because two other things are derived from the first one — the sheet
 * threshold below, and the stylesheet assertion in the test — and a restatement
 * is a place for them to drift apart.
 */
export const COUNTY_POPUP_BODY_MIN_PX = 188
export const COUNTY_POPUP_BODY_MAX_PX = 220

/**
 * `.maplibregl-popup-content`'s 14px side padding and 1px border, both sides:
 * everything between the popup's own width and the body's available width.
 */
export const COUNTY_POPUP_CONTENT_CHROME_PX = 2 * (14 + 1)

/**
 * The narrowest ANCHORED popup worth rendering: the inner body's own minimum
 * plus the content chrome. Below this the sheet takes over.
 *
 * THIS EQUATION IS WHY THE BODY'S FLOOR CAN BE AN ABSOLUTE LENGTH. At exactly
 * this width the body has exactly `COUNTY_POPUP_BODY_MIN_PX` to live in, and
 * every anchored popup is at least this wide by construction, so a hard
 * `min-width: 188px` can never push past an anchored popup's content box. It is
 * only the SHEET — which is pinned to a container that may be narrower than
 * this — that has to let the floor go, and the sheet rule does exactly that.
 */
export const COUNTY_POPUP_MIN_PX = COUNTY_POPUP_BODY_MIN_PX + COUNTY_POPUP_CONTENT_CHROME_PX

/** The `offset` prop on the county `<Popup>`. Enters the containment bound. */
export const COUNTY_POPUP_OFFSET_PX = 10

/** The sheet's inset from the map container's edges. */
export const COUNTY_POPUP_SHEET_GUTTER_PX = 8

/**
 * Everything between the map's height and the scrollable body in sheet form:
 * the gutter top and bottom, `.maplibregl-popup-content`'s 12px vertical
 * padding, and its 1px border.
 */
export const COUNTY_POPUP_SHEET_CHROME_PX = 2 * COUNTY_POPUP_SHEET_GUTTER_PX + 2 * 12 + 2

/** A body cap below this is not worth having; the sheet scrolls instead. */
export const COUNTY_POPUP_SHEET_MIN_CAP_PX = 88

/**
 * The widest map that still needs the sheet, exposed for the tests and for the
 * comment above to be checkable: at this width the anchored cap is exactly the
 * legibility floor.
 */
export const COUNTY_POPUP_SHEET_BELOW_PX =
  Math.ceil(1.5 * COUNTY_POPUP_MIN_PX) + COUNTY_POPUP_OFFSET_PX

export interface CountyPopupFit {
  /** The popup's `max-width`, in px. */
  maxWidthPx: number
  /** True when the popup is pinned to the container instead of anchored. */
  sheet: boolean
  /** The sheet's scrollable body cap, in px. 0 in the anchored form, where the
   *  shipped viewport-relative `.sr-map-popup-body` cap is the right one. */
  bodyCapPx: number
}

/** Today's shipped geometry. Also the answer for an unusable reading. */
export const COUNTY_POPUP_FIT_FALLBACK: CountyPopupFit = {
  maxWidthPx: COUNTY_POPUP_MAX_PX,
  sheet: false,
  bodyCapPx: 0,
}

/**
 * The popup geometry for a map container measuring `mapWidthPx` x
 * `mapHeightPx`.
 *
 * Rejected rather than clamped: a non-finite reading (an unlaid-out box), and a
 * non-positive one (jsdom, a hidden tab, a pre-layout pass). Both return the
 * shipped fallback, so the worst an unusable reading can do is leave today's
 * behavior in place.
 */
export function countyPopupFit(mapWidthPx: number, mapHeightPx: number): CountyPopupFit {
  if (!Number.isFinite(mapWidthPx) || !Number.isFinite(mapHeightPx)) return COUNTY_POPUP_FIT_FALLBACK
  if (mapWidthPx <= 0 || mapHeightPx <= 0) return COUNTY_POPUP_FIT_FALLBACK

  // The widest popup no anchor MapLibre can choose will push outside the map.
  const anchored = Math.floor((mapWidthPx - COUNTY_POPUP_OFFSET_PX) / 1.5)

  if (anchored >= COUNTY_POPUP_MAX_PX) return COUNTY_POPUP_FIT_FALLBACK
  if (anchored >= COUNTY_POPUP_MIN_PX) return { maxWidthPx: anchored, sheet: false, bodyCapPx: 0 }

  return {
    maxWidthPx: Math.max(1, Math.floor(mapWidthPx - 2 * COUNTY_POPUP_SHEET_GUTTER_PX)),
    sheet: true,
    bodyCapPx: Math.max(
      COUNTY_POPUP_SHEET_MIN_CAP_PX,
      Math.floor(mapHeightPx - COUNTY_POPUP_SHEET_CHROME_PX),
    ),
  }
}

/**
 * The custom properties the stylesheet reads. Published on the MAP CONTAINER,
 * which is the popup's containing block and therefore its inheritance parent,
 * so one write reaches whichever popup is open.
 */
export const COUNTY_POPUP_FIT_VARS = {
  maxWidth: '--sr-county-popup-max',
  bodyCap: '--sr-county-popup-cap',
} as const

/**
 * The attribute that selects the sheet form, set on the map container rather
 * than on the popup: the popup is created and destroyed by MapLibre, the
 * container is not, so the state lives on the stable element and CSS descends
 * to whatever popup is present.
 */
export const COUNTY_POPUP_SHEET_ATTR = 'data-sr-county-popup'
