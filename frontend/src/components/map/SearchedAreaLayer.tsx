// The searched-area indicator (feature: search-this-area).
//
// A control that says "search this area" while the area it actually searched is
// a circle the user cannot see is making a claim it does not keep. This draws
// what was covered, from the SEARCH RECORD and never from the live viewport, so
// panning after a search moves the map under a stationary circle.
//
// THE PRIMARY MARK IS THE DIM OUTSIDE THE CIRCLE, NOT THE RING. The derived
// radius COVERS the viewport (FR-08), so immediately after a press the circle's
// edge is off screen and a ring alone would be invisible at exactly the moment
// the feature is working. Dimming inverts that: nothing dims while the search
// covers what is on screen, and the moment the user pans or zooms out the
// uncovered ground greys. It also makes the capped case (FR-09) self-explanatory
// with no copy at all — the circle comes out visibly smaller than the screen and
// the scrim says which pins are outside the answer.
//
// ── INERT BY CONSTRUCTION (FR-18 / QA-20) ───────────────────────────────────
// This component binds NO pointer handler of any kind: no `click`, no
// `mouseenter` / `mouseleave` / `mousemove`, no cursor arbitration, and no
// `queryRenderedFeatures`. Its only two `map.on(...)` calls are `styledata`
// listeners (one reads the dark-basemap flag, one re-asserts the layer order).
// `styledata` is a style-lifecycle event: it carries no pointer target, hit-tests
// nothing and cannot make a layer interactive, so neither listener weakens what
// follows. And none of its three layer ids appears in either list that gates
// interaction:
//
//   INTERACTIVE_MAP_LAYERS = ['sr-sight-circle', 'sr-hotspot', 'sr-atlas-fill']
//     (lib/mapPins.ts) — what updateMapCursor queries.
//   MARKER_LAYERS = ['sr-sight-circle', 'sr-hotspot']
//     (AtlasLayer.tsx, CountyLayer.tsx) — what the two overlay click handlers
//     use to yield to a marker.
//
// DO NOT ADD ANY OF THESE IDS TO EITHER LIST. That sentence is what makes FR-18
// structural rather than remembered, and it matters more here than a ring would
// have: `sr-search-area-scrim` is a WORLD-COVERING fill, which is the largest
// possible hit surface on the map, and a MapLibre fill is hit-tested at ANY
// opacity. SightingMarkers and HotspotMarkers query their own ids by name and
// the atlas/county handlers are layer-scoped, so none of them can see these.

import { useEffect, useMemo, useState } from 'react'
import { Source, Layer, useMap } from 'react-map-gl/maplibre'
import type { FeatureCollection } from 'geojson'
import type { FillLayerSpecification, LineLayerSpecification } from 'maplibre-gl'
import { areaCirclePolygon, areaScrimPolygon, scrimOpacity, type SearchRecord } from '../../lib/searchArea'
import { prefersReducedMotion } from '../../lib/scroll'

// Marker layers that paint above this indicator; inserting below whichever is
// present at mount keeps pins on top (NFR-07), exactly as AtlasLayer and
// CountyLayer do. Of the three centre views only Hotspots draws a GL marker
// layer (`sr-hotspot`) — Target and Lifer markers are DOM <Marker>s and sit
// above the canvas regardless — so this is load-bearing on Hotspots and inert on
// the other two, which is correct rather than a gap.
const MARKER_LAYERS = ['sr-sight-circle', 'sr-hotspot']

/**
 * This component's own layers, bottom to top. Order within the group matters —
 * the halo sits under the dashed line, and both sit over the scrim.
 */
const AREA_LAYERS = ['sr-search-area-scrim', 'sr-search-area-halo', 'sr-search-area-line']

/** Fallbacks for the two tokens, mirroring globals.css. The live values are read
 *  from the tokens below; these only cover a non-DOM environment. */
const EDGE_RGB_FALLBACK = '180, 52, 31'
const SCRIM_RGB_FALLBACK = '15, 17, 23'

function tokenRgb(name: string, fallback: string): string {
  if (typeof document === 'undefined') return fallback
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return v || fallback
}

// Motion: the ground settles, then the edge sharpens.
const FADE_MS = 220
const RING_DELAY_MS = 60

/**
 * The one dark raster base. Topo is a raster base too and is deliberately NOT
 * here: it is a LIGHT map and measured within 1.2% of Positron under the scrim,
 * so it needs the default alpha. See SCRIM_ALPHA_DARK_BASE.
 */
const DARK_RASTER_BASE_LAYER = 'sr-satellite'

interface Props {
  /** The values that were SENT. Never the live viewport (FR-18). */
  record: SearchRecord
  /**
   * A county or atlas shading ramp is painting tiers beneath this layer, so the
   * scrim backs off to where it cannot push a tier past its neighbour (OI-02).
   * The same expression BasemapDesaturation takes, from the same place, so the
   * two map effects can never disagree about whether a ramp is on.
   */
  rampActive?: boolean
}

export function SearchedAreaLayer({ record, rampActive = false }: Props) {
  const map = useMap().current
  const [themeRev, setThemeRev] = useState(0)

  /**
   * Which base is showing, read from the MAP rather than threaded down from
   * SnowMap — the base selection is SnowMap's private state, and this is the
   * BasemapDesaturation posture of responding to the basemap without widening
   * SnowMap's API. SnowMap sets each raster base's `visibility` explicitly on
   * every render, so the read is always definite.
   *
   * Re-read on `styledata`, which is what a base switch and an offline/online
   * style reload both fire; never gate on `isStyleLoaded()` (the
   * sprite-registration post-mortem).
   */
  const [darkBase, setDarkBase] = useState(false)
  useEffect(() => {
    if (!map) return
    const m = map.getMap()
    const read = () => {
      if (!m.getLayer(DARK_RASTER_BASE_LAYER)) { setDarkBase(false); return }
      try {
        setDarkBase(m.getLayoutProperty(DARK_RASTER_BASE_LAYER, 'visibility') === 'visible')
      } catch { /* layer not style-ready yet; the next styledata settles it */ }
    }
    read()
    m.on('styledata', read)
    return () => { m.off('styledata', read) }
  }, [map])

  /**
   * MapLibre paint transitions are configured in JavaScript and rendered on the
   * canvas, so globals.css's global `@media (prefers-reduced-motion: reduce)`
   * block — which collapses every CSS animation and transition in the app — does
   * NOT reach them. This is the one piece of this feature's motion that is not
   * free, and it must be honoured explicitly.
   *
   * Read in a state INITIALIZER, never in the render body or a memo: it is a
   * live environment read, and the repo's rule for those (lib/useOnline.ts, the
   * `navigator.onLine` precedent) is initializer-or-event-handler only, so
   * `react-hooks/purity` stays satisfied. `prefersReducedMotion()` is the shipped
   * predicate from lib/scroll.ts, already guarded for non-DOM and test
   * environments; do not re-inline matchMedia here.
   *
   * Note that MapLibre's transition easing is NOT configurable — `-transition`
   * accepts `{ duration, delay }` only — so the area's curve matches the DOM
   * pieces' `cubic-bezier(0.16, 1, 0.3, 1)` approximately rather than exactly.
   * Accepted: the two never animate side by side at a distance where the
   * difference is readable.
   */
  const [reduced] = useState(() => prefersReducedMotion())
  const fadeMs = reduced ? 0 : FADE_MS
  const ringDelayMs = reduced ? 0 : RING_DELAY_MS

  const [insertBelow] = useState(() => MARKER_LAYERS.find(id => !!map?.getLayer(id)))

  /**
   * KEEP THE INDICATOR IMMEDIATELY BELOW THE MARKER LAYERS — which means ABOVE
   * the county and atlas shading fills, and above their boundary lines.
   *
   * `beforeId` alone cannot express this, and the Stage-5 second QA cycle measured
   * what happens when it is trusted to. Every overlay here inserts below the same
   * marker layer, so whichever mounts LAST ends up on top, and the answer changed
   * with the order the user happened to do things in: toggle county shading on
   * after a search and the county fill landed ABOVE this indicator (measured in
   * Chromium: scrim 59, halo 60, line 61, county fill 62, county line 63, hotspot
   * 65). That is not a cosmetic detail, because the county fill paints at
   * `fill-opacity` 0.85 and the atlas fill at 0.45:
   *
   *   - Underneath them the scrim is 85% / 55% BLOCKED, so the dim, the halo and
   *     the dashed edge all but vanished exactly where a ramp was painting — and
   *     the feature's whole claim is that the user can see what was searched.
   *   - And the tier shift the ramp alpha exists to prevent could not happen there
   *     either, so backing the alpha off was buying nothing at that order while
   *     costing all of the visibility above.
   *
   * Both halves were measured as a genuine build A/B over the real basemap with a
   * county ramp active, sampling the MODAL rendered colour per tier (one point per
   * tier picks up roads, labels and water: three "tier colours" in a first pass
   * came back a blue and an orange). The smallest step between adjacent tiers, as
   * RENDERED, is 1.1425:1 — smaller than the token ramp's own step, because the
   * fill composites at 0.85 over the muted basemap. How far the scrim moves a
   * tier:
   *
   *              below the fills        above the fills
   *   0.08       1.027 to 1.037         1.135 to 1.172   (0.95 to 1.19 of a step)
   *   0.18       1.058 to 1.128         1.329 to 1.460   (2.14 to 2.84 of a step)
   *
   * Read the top-left cell: below the fills even the ORIGINAL 0.18 could not push
   * a tier past its neighbour, which is what makes "the backoff bought nothing
   * there" a measurement rather than an inference. Above them 0.08 lands at about
   * one step, the stated floor, and 0.18 lands at two to three, which is the
   * corruption OI-02 measured and rejected. Over unshaded ground the scrim is
   * 1.178:1 either way, and inside the circle it moves nothing at all (1.000,
   * the control). The alpha's own unit test already models the scrim OVER the
   * rendered tier, so this is the order that test was always written for.
   *
   * Re-asserted on `styledata` because that is what a layer being added, a base
   * switch, and an offline/online style reload all fire; never gated on
   * `isStyleLoaded()` (the sprite-registration post-mortem). It moves ONLY when the
   * group is out of position, which is what keeps its own `styledata` from looping.
   *
   * This changes no hit-testing: `queryRenderedFeatures` is layer-scoped
   * everywhere in this app, so the county and atlas click handlers and
   * `updateMapCursor` are unaffected by what sits above them (FR-18 / QA-20), and
   * markers still paint on top (NFR-07 / QA-37).
   */
  useEffect(() => {
    if (!map) return
    const m = map.getMap()
    const enforce = () => {
      // `getStyle` throws while a style is being swapped, which `styledata` fires
      // during — the same "not style-ready yet" case the basemap read above
      // guards. The next event settles it.
      let ids: string[] | undefined
      try { ids = m.getStyle()?.layers?.map(l => l.id) } catch { return }
      if (!ids) return
      const mine = AREA_LAYERS.filter(id => ids.includes(id))
      if (mine.length === 0) return
      const before = MARKER_LAYERS.find(id => ids.includes(id))
      // The slot our group should end at: just under the lowest marker layer, or
      // the top of the style when no marker layer is present (a later-mounting
      // marker layer appends above us, which is the same outcome).
      const end = before ? ids.indexOf(before) : ids.length
      const inPlace = mine.every((id, i) => ids.indexOf(id) === end - mine.length + i)
      if (inPlace) return
      for (const id of mine) m.moveLayer(id, before)
    }
    enforce()
    m.on('styledata', enforce)
    return () => { m.off('styledata', enforce) }
  }, [map])

  // GL paint cannot read CSS custom properties, so the tokens are resolved at
  // render and re-resolved on a `data-theme` change — the CountyLayer contract.
  // (Both tokens are declared identically in the two themes because the map
  // canvas is the always-light Positron basemap regardless of app theme; the
  // observer is here so a future re-tuning of either value is picked up without
  // a code change, and so this reads as one of the app's token-resolved layers
  // rather than as a hardcoded-colour exception.)
  useEffect(() => {
    const obs = new MutationObserver(() => setThemeRev(n => n + 1))
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => obs.disconnect()
  }, [])
  void themeRev

  const ringFc: FeatureCollection = useMemo(
    () => ({ type: 'FeatureCollection', features: [areaCirclePolygon(record)] }),
    [record],
  )
  const scrimFc: FeatureCollection = useMemo(
    () => ({ type: 'FeatureCollection', features: [areaScrimPolygon(record)] }),
    [record],
  )

  const edge = tokenRgb('--sr-search-area-rgb', EDGE_RGB_FALLBACK)
  const scrim = tokenRgb('--sr-search-area-scrim-rgb', SCRIM_RGB_FALLBACK)

  // The alpha follows what the scrim is drawn OVER (OI-02). Its own
  // `fill-opacity-transition` means a base switch or a ramp toggle eases the
  // change rather than snapping it, at no extra cost.
  const scrimPaint: FillLayerSpecification['paint'] = {
    'fill-color': `rgb(${scrim})`,
    'fill-opacity': scrimOpacity({ darkBase, rampActive }),
    'fill-opacity-transition': { duration: fadeMs, delay: 0 },
  }
  const haloPaint: LineLayerSpecification['paint'] = {
    'line-color': `rgb(${edge})`,
    'line-opacity': 0.20,
    'line-width': 9,
    'line-opacity-transition': { duration: fadeMs, delay: 0 },
  }
  // `line-dasharray` is in LINE-WIDTHS, not pixels: [3.6, 2.8] at line-width 2.5
  // is the design's 9px dash / 7px gap. Getting this wrong is invisible in code
  // review and obvious on screen.
  const linePaint: LineLayerSpecification['paint'] = {
    'line-color': `rgb(${edge})`,
    'line-opacity': 0.95,
    'line-width': 2.5,
    'line-dasharray': [3.6, 2.8],
    'line-opacity-transition': { duration: fadeMs, delay: ringDelayMs },
  }
  const lineLayout: LineLayerSpecification['layout'] = { 'line-cap': 'round', 'line-join': 'round' }

  // Two sources rather than one, because a `line` layer over the scrim's polygon
  // would stroke BOTH of its rings — the world rectangle as well as the circle.
  // Both ids are literals and only `data` changes, so react-map-gl updates each
  // source in place and the "source id changed" crash class cannot arise here.
  return (
    <>
      <Source id="sr-search-area-scrim-src" type="geojson" data={scrimFc}>
        <Layer id="sr-search-area-scrim" type="fill" paint={scrimPaint} beforeId={insertBelow} />
      </Source>
      <Source id="sr-search-area-src" type="geojson" data={ringFc}>
        <Layer id="sr-search-area-halo" type="line" paint={haloPaint} layout={lineLayout} beforeId={insertBelow} />
        <Layer id="sr-search-area-line" type="line" paint={linePaint} layout={lineLayout} beforeId={insertBelow} />
      </Source>
    </>
  )
}
