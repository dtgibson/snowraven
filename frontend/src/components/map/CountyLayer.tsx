// MapLibre US county overlay — the structural twin of AtlasLayer. Counties are
// generated for the CURRENT VIEWPORT only (countiesInBounds + a padded bbox,
// recomputed on `moveend`); a view that would exceed the cap (national zoom-out)
// draws nothing and shows a "Zoom in to see counties" chip, and a minzoom keeps
// the overlay off the unreadable far-out zooms. A line layer draws boundaries; a
// fill layer is the choropleth AND the click target for the per-county popup
// (unrecorded counties keep fill-opacity 0 but stay hit-tested). Tier fills read
// from the --sr-county-N tokens at runtime and re-resolve on a data-theme change.
//
// The popup is built as escaped JSX (never dangerouslySetInnerHTML, NFR-08); the
// county name links to its eBird region page only when a valid, shape-guarded
// region code is derivable. A keyboard "Counties in view" disclosure is the
// keyboard route to a popup (the on-map fill is a pointer-only canvas hit-test).

import { useEffect, useMemo, useState } from 'react'
import { Source, Layer, Popup, useMap } from 'react-map-gl/maplibre'
import type { FeatureCollection } from 'geojson'
import type { FillLayerSpecification, FilterSpecification, LineLayerSpecification, MapGeoJSONFeature, MapLayerMouseEvent, MapStyleImageMissingEvent } from 'maplibre-gl'
import { ExternalLink } from 'lucide-react'
import {
  countiesInBounds, countyListRows, padBounds, countyKey, deriveCountyRegionCode, stateNameFor,
  type CountyFC, type CountyFeature, type Bounds, type CountyListRow,
} from '../../lib/countyBoundaries'
import {
  countyMetricValue, type CountyAggregate, type CountyMetric, type CountyTiers,
} from '../../lib/countyShading'
import type { CountyShadeMetric, CountyCompletenessView, CompletenessStatus } from '../../lib/countyCompleteness'
import { CountyCompletenessPopup } from './CountyCompletenessPopup'
import { OutboundLink } from '../OutboundLink'
import { BirdName } from '../BirdName'
import { HotspotLink } from '../HotspotLink'
import { CountyDensitySwatch } from './MapSidebarUI'
import { updateMapCursor } from '../../lib/mapPins'
import { MARKER_LIST_CAP } from '../../lib/markersInView'
import { countyHatchImageData, countyHatchPixelRatio, countyHatchTierForImage, COUNTY_HATCH_IMAGE_ID, COUNTY_TIERS } from '../../lib/countyTextures'

// Tier 1..10 — the green --sr-county-N ramp (10 data-driven quantile classes so
// well-birded counties separate instead of clumping in one coarse top class).
type CountyTier = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10

// Fallback ramp (index = tier 1..10) when the --sr-county-N tokens can't be read.
// These mirror globals.css; the live values come from the tokens (theme-aware,
// though this ramp is identical in both themes — basemap-anchored).
const COUNTY_FALLBACK: Record<CountyTier, string> = {
  1: '#C3E8D1', 2: '#A8D5BA', 3: '#8EC4A3', 4: '#71B58D', 5: '#5FA47B',
  6: '#4D956A', 7: '#358758', 8: '#2D784D', 9: '#256A43', 10: '#1A5C38',
}

function countyColor(tier: CountyTier): string {
  if (typeof document === 'undefined') return COUNTY_FALLBACK[tier]
  const v = getComputedStyle(document.documentElement).getPropertyValue(`--sr-county-${tier}`).trim()
  return v || COUNTY_FALLBACK[tier]
}

// ~3,143 counties total, so a national zoom-out is over cap and shows the
// "zoom in" hint; minzoom keeps the overlay off the unreadable far-out zooms.
const COUNTY_CAP = 800
const COUNTY_MINZOOM = 4
const BOUNDS_PAD = 0.15

// Above this zoom the overlay's boundary LINE comes from the basemap's OWN
// admin_level-6 boundary tiles (accurate at every zoom), and the bundled,
// simplified line is capped off — it only draws far out (where its blockiness is
// invisible) and as the below-z9 / offline fallback. z9 is where OpenMapTiles
// starts emitting county (admin_level 6) boundaries in the vector tiles.
const COUNTY_LINE_HANDOFF_ZOOM = 9

// Accurate county lines come from the shared `openmaptiles` vector source's
// `boundary` source-layer (the same tiles the basemap already fetches — no new
// network, no new provider). admin_level 6 = US counties; exclude maritime/disputed
// to match the basemap's boundary-line family.
const ACCURATE_COUNTY_FILTER: FilterSpecification = [
  'all',
  ['==', ['get', 'admin_level'], 6],
  ['!=', ['get', 'maritime'], 1],
  ['!=', ['get', 'disputed'], 1],
]

// Marker layers that paint above the county fill; a click on one of these must
// not also open the county popup (parity with the atlas marker arbitration).
const MARKER_LAYERS = ['sr-sight-circle', 'sr-hotspot']

const REGION_URL = 'https://ebird.org/region/'

// FR-28: honest per-county state labels for the "Counties in view" value column
// while the Completeness metric is active and the value isn't known yet.
const COMPLETENESS_LIST_LABEL: Record<CompletenessStatus, string> = {
  ready: '',                    // never rendered — 'ready' shows the X/Y · Z% value
  loading: 'loading…',
  offline: 'offline',
  'no-key': 'needs eBird key',
  error: 'eBird error',
  empty: 'none on eBird',
  unfetched: 'not fetched',
  'no-region': 'no eBird data',
}

interface Props {
  data: CountyFC | null
  shade?: boolean
  /** Per-county aggregates keyed by countyKey(stusps, name); null until ready. */
  aggregates?: Map<string, CountyAggregate> | null
  /** Quantile tiers over the active metric's non-zero values (count metrics only). */
  tiers: CountyTiers
  metric: CountyShadeMetric
  /** The Completeness controller — supplied only while metric === 'completeness'.
   *  Drives the fixed-band tier, the popup's completeness content, the bounded
   *  eager fetch, and click-to-fetch (the quantile path never consults it, FR-06). */
  completeness?: CountyCompletenessView | null
  onOpenSpecies?: (commonName: string) => void
  hasEntryFor?: (name: string) => boolean
  taxonCodeFor?: (commonName: string) => string | undefined
  isPublicHotspot?: (locId: string) => boolean
  /** When true (and shading is on), shaded counties render as a per-tier
   *  crosshatch density instead of flat color (colorblind-accessible mode). */
  useTextures?: boolean
}

type Selected = { lng: number; lat: number; geoid: string; name: string; stusps: string }

const EMPTY_FC: FeatureCollection = { type: 'FeatureCollection', features: [] }

export function CountyLayer({
  data, shade = false, aggregates = null, tiers, metric, completeness = null,
  onOpenSpecies, hasEntryFor, taxonCodeFor, isPublicHotspot, useTextures = false,
}: Props) {
  const map = useMap().current
  const [sel, setSel] = useState<Selected | null>(null)
  const [listOpen, setListOpen] = useState(false)
  const [themeRev, setThemeRev] = useState(0)

  // Insert the county layers UNDER any marker layers present at mount, so pins
  // stay on top when the overlay is toggled on later (mirrors AtlasLayer).
  const [insertBelow] = useState(() => MARKER_LAYERS.find(id => !!map?.getLayer(id)))

  // The accurate county line rides the base style's `openmaptiles` vector source;
  // render it only once that source is present (it always is online / inside a
  // downloaded region, and is absent on a bare offline map). Refresh on styledata
  // so a base switch that re-adds the source re-adds the line.
  const [vectorReady, setVectorReady] = useState(() => !!map?.getSource('openmaptiles'))
  useEffect(() => {
    if (!map) return
    const check = () => setVectorReady(!!map.getSource('openmaptiles'))
    check()
    map.on('styledata', check)
    return () => { map.off('styledata', check) }
  }, [map])

  const [bounds, setBounds] = useState<Bounds | null>(null)
  useEffect(() => {
    if (!map) return
    const update = () => {
      const b = map.getBounds()
      setBounds([b.getWest(), b.getSouth(), b.getEast(), b.getNorth()])
    }
    update()
    map.on('moveend', update)
    return () => { map.off('moveend', update) }
  }, [map])

  const shadeOn = shade && !!aggregates

  // tier for a county by its (stusps, name) join key; 0 when not shading or no
  // value for the active metric. Completeness supplies its own FIXED band
  // (0..10) via the controller; the count metrics keep the quantile path
  // byte-identical (FR-06). geoid rides along for the region-code derivation.
  const tierForCounty = useMemo(() => {
    return (stusps: string, name: string, geoid: string): number => {
      if (!shadeOn) return 0
      if (metric === 'completeness') {
        return completeness ? completeness.summaryFor(stusps, name, geoid).band : 0
      }
      if (!aggregates) return 0
      const agg = aggregates.get(countyKey(stusps, name))
      if (!agg) return 0
      return tiers.tierFor(countyMetricValue(agg, metric))
    }
  }, [shadeOn, aggregates, tiers, metric, completeness])

  // Viewport windowing, split from the tier assignment so the eager-fetch row
  // set is stable across tier-only updates (a progressive-shading re-render must
  // not re-notify the controller).
  const inView = useMemo(() => {
    if (!data || !bounds) return { features: [] as CountyFeature[], tooMany: false }
    return countiesInBounds(data, padBounds(bounds, BOUNDS_PAD), COUNTY_CAP)
  }, [data, bounds])

  // Deduped (by geoid) in-view county identities — the Completeness controller's
  // eager-fetch input (it filters down to BIRDED + resolvable + non-fresh, FR-13).
  const eagerRows = useMemo(() => {
    const seen = new Set<string>()
    const rows: { stusps: string; name: string; geoid: string }[] = []
    for (const f of inView.features) {
      const p = f.properties
      if (seen.has(p.geoid)) continue
      seen.add(p.geoid)
      rows.push({ stusps: p.stusps, name: p.name, geoid: p.geoid })
    }
    return rows
  }, [inView])

  const { fc, tooMany, list, listTotal, listOverCap } = useMemo(() => {
    if (inView.tooMany) return { fc: EMPTY_FC, tooMany: true, list: [] as CountyListRow[], listTotal: 0, listOverCap: false }
    if (inView.features.length === 0) return { fc: EMPTY_FC, tooMany: false, list: [] as CountyListRow[], listTotal: 0, listOverCap: false }
    const features = inView.features.map(f => ({
      type: 'Feature' as const,
      properties: {
        geoid: f.properties.geoid,
        name: f.properties.name,
        stusps: f.properties.stusps,
        tier: tierForCounty(f.properties.stusps, f.properties.name, f.properties.geoid),
      },
      geometry: f.geometry,
    }))
    const { rows, total, overCap } = countyListRows(inView.features, MARKER_LIST_CAP)
    return { fc: { type: 'FeatureCollection' as const, features }, tooMany: false, list: rows, listTotal: total, listOverCap: overCap }
  }, [inView, tierForCounty])

  // Bounded eager fetch (FR-13): only while the Completeness metric is selected
  // AND shading is on, hand the controller the in-view county identities. The
  // controller enforces every gate (birded-only, region code, cache freshness,
  // key, in-flight dedupe, the pool of 4) and no-ops on repeats.
  useEffect(() => {
    if (metric !== 'completeness' || !shade || !completeness || eagerRows.length === 0) return
    completeness.onViewportCounties(eagerRows)
  }, [metric, shade, completeness, eagerRows])

  // Click a county → open its popup. Hover → pointer cursor. A click that lands
  // on a marker layer above the fill is the marker's (atlas arbitration parity).
  useEffect(() => {
    if (!map) return
    const onClick = (e: MapLayerMouseEvent) => {
      const markerLayers = MARKER_LAYERS.filter(id => !!map.getLayer(id))
      if (markerLayers.length > 0 && map.queryRenderedFeatures(e.point, { layers: markerLayers }).length > 0) return
      const f = e.features?.[0] as MapGeoJSONFeature | undefined
      if (!f) return
      const p = f.properties as { geoid?: string; name?: string; stusps?: string }
      if (!p.name || !p.stusps) return
      setSel({ lng: e.lngLat.lng, lat: e.lngLat.lat, geoid: p.geoid ?? '', name: p.name, stusps: p.stusps })
    }
    const hover = (e: MapLayerMouseEvent) => updateMapCursor(map, e.point)
    map.on('click', 'sr-county-fill', onClick)
    map.on('mouseenter', 'sr-county-fill', hover)
    map.on('mouseleave', 'sr-county-fill', hover)
    return () => {
      map.off('click', 'sr-county-fill', onClick)
      map.off('mouseenter', 'sr-county-fill', hover)
      map.off('mouseleave', 'sr-county-fill', hover)
      map.getCanvas().style.cursor = ''
    }
  }, [map])

  // Register the county hatch sprites (for the "Use Textures" fill-pattern) at
  // effect time, AND re-resolve the tier fill colors / regenerate the sprites on a
  // light/dark theme change. One MutationObserver does both (the sprite tint reads
  // --sr-county-N-rgb at generation). addImage needs only a style OBJECT, not a
  // "loaded" style — do NOT gate this on isStyleLoaded() (false during ANY
  // tile/source churn) with a once('load') fallback: `load` fires once per map
  // LIFETIME, so a listener armed later never fires and the fill-pattern silently
  // renders nothing (the documented post-mortem). The styleimagemissing safety net
  // bakes only OUR ids on demand; foreign ids are ignored.
  useEffect(() => {
    if (!map) return
    let cancelled = false
    const addAll = () => {
      if (cancelled) return
      const dpr = countyHatchPixelRatio()
      for (const tier of COUNTY_TIERS) {
        const id = COUNTY_HATCH_IMAGE_ID[tier]
        const img = countyHatchImageData(tier, dpr)
        if (map.hasImage(id)) map.updateImage(id, img)
        else map.addImage(id, img, { pixelRatio: dpr })
      }
    }
    addAll()
    const onMissing = (e: MapStyleImageMissingEvent) => {
      if (cancelled) return
      const tier = countyHatchTierForImage(e.id)
      if (tier === null || map.hasImage(e.id)) return
      const dpr = countyHatchPixelRatio()
      map.addImage(e.id, countyHatchImageData(tier, dpr), { pixelRatio: dpr })
    }
    map.on('styleimagemissing', onMissing)
    const onTheme = () => { addAll(); setThemeRev(n => n + 1) }
    const obs = new MutationObserver(onTheme)
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => { cancelled = true; obs.disconnect(); map.off('styleimagemissing', onMissing) }
  }, [map])

  // Opening a BIRDED county's popup in Completeness mode auto-requests its data
  // (pending → result, FR-33); un-birded counties stay behind the explicit
  // "Load completeness" button (FR-14). The controller no-ops on fresh/in-flight
  // counties, so refires on state updates are harmless.
  useEffect(() => {
    if (!sel || metric !== 'completeness' || !completeness) return
    completeness.ensureCountyForPopup(sel.stusps, sel.name, sel.geoid)
  }, [sel, metric, completeness])

  const openCountyFromList = (row: CountyListRow) => {
    setSel({ lng: row.center[0], lat: row.center[1], geoid: row.geoid, name: row.name, stusps: row.stusps })
    map?.flyTo({ center: row.center, duration: 400 })
  }

  if (!data) return null

  // themeRev re-renders so the token reads below pick up a theme change.
  void themeRev

  // When "Use Textures" is on AND shading is active, paint a per-tier crosshatch
  // density (the colorblind-accessible read) instead of flat color. The layer id
  // stays `sr-county-fill` in BOTH branches — load-bearing for the heatmap z-order
  // and basemap-desaturation wiring (do-not-touch list). Tier 0 maps to a valid
  // image hidden by fill-opacity 0.
  const useHatch = useTextures && shadeOn
  const fillPaint: FillLayerSpecification['paint'] = useHatch
    ? {
        'fill-pattern': ['match', ['get', 'tier'],
          1, COUNTY_HATCH_IMAGE_ID[1], 2, COUNTY_HATCH_IMAGE_ID[2], 3, COUNTY_HATCH_IMAGE_ID[3],
          4, COUNTY_HATCH_IMAGE_ID[4], 5, COUNTY_HATCH_IMAGE_ID[5], 6, COUNTY_HATCH_IMAGE_ID[6],
          7, COUNTY_HATCH_IMAGE_ID[7], 8, COUNTY_HATCH_IMAGE_ID[8], 9, COUNTY_HATCH_IMAGE_ID[9],
          10, COUNTY_HATCH_IMAGE_ID[10], COUNTY_HATCH_IMAGE_ID[1]],
        'fill-opacity': ['case', ['>', ['get', 'tier'], 0], 1, 0],
      }
    : {
        'fill-color': ['match', ['get', 'tier'],
          1, countyColor(1), 2, countyColor(2), 3, countyColor(3), 4, countyColor(4), 5, countyColor(5),
          6, countyColor(6), 7, countyColor(7), 8, countyColor(8), 9, countyColor(9), 10, countyColor(10),
          '#000000'],
        'fill-opacity': ['case', ['>', ['get', 'tier'], 0], 0.85, 0],
      }
  const linePaint: LineLayerSpecification['paint'] = {
    'line-color': 'rgba(71,85,105,0.85)',
    'line-width': 1.3,
  }
  const lineLayout: LineLayerSpecification['layout'] = { 'line-join': 'round' }

  // The aggregate + region link for the open county.
  const selAgg = sel && aggregates ? aggregates.get(countyKey(sel.stusps, sel.name)) ?? null : null
  const selRegion = sel ? deriveCountyRegionCode(sel.geoid, sel.stusps) : null
  const selSpecies = selAgg?.species ?? 0
  const selRecords = selAgg?.records ?? 0

  return (
    <>
      <Source id="sr-county" type="geojson" data={fc}>
        <Layer id="sr-county-fill" type="fill" minzoom={COUNTY_MINZOOM} paint={fillPaint} beforeId={insertBelow} />
        <Layer id="sr-county-line" type="line" minzoom={COUNTY_MINZOOM} maxzoom={COUNTY_LINE_HANDOFF_ZOOM} paint={linePaint} layout={lineLayout} beforeId={insertBelow} />
        {/* No fixed anchor on the popup below — let MapLibre choose
            top/bottom/left/right so a popup tapped near a phone viewport edge
            stays on-screen instead of being clipped by the map's
            overflow:hidden. All anchor variants are tip-colored in globals.css. */}
        {sel && (
          <Popup longitude={sel.lng} latitude={sel.lat} offset={10} closeOnClick={false} onClose={() => setSel(null)} maxWidth="248px">
            <div className="sr-map-popup-body" style={{ minWidth: 188, maxWidth: 220, fontSize: '0.8125rem' }}>
              {selRegion ? (
                <OutboundLink
                  href={`${REGION_URL}${encodeURIComponent(selRegion)}`}
                  aria-label={`Open ${sel.name} on eBird (opens in a new tab)`}
                  style={{ fontWeight: 600, fontSize: '0.8125rem', color: 'var(--sr-accent)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4, minWidth: 0, maxWidth: '100%' }}
                >
                  <span className="sr-wrap-anywhere" style={{ minWidth: 0 }}>{sel.name}</span>
                  <ExternalLink size={11} strokeWidth={2.5} aria-hidden="true" style={{ flexShrink: 0 }} />
                </OutboundLink>
              ) : (
                <div className="sr-wrap-anywhere" style={{ fontWeight: 600, fontSize: '0.8125rem', color: 'var(--sr-text)' }}>{sel.name}</div>
              )}
              <div style={{ fontSize: '0.6875rem', color: 'var(--sr-text-muted)', marginTop: 2 }}>{stateNameFor(sel.stusps)}</div>

              {/* D-402: the count row stays in Completeness mode too; neither
                  number takes the accent-active state there (metric matches
                  neither 'species' nor 'records'). */}
              <div style={{ display: 'flex', gap: 18, marginTop: 9 }}>
                <CountStat n={selSpecies} label="species" active={metric === 'species'} title="Distinct species you've recorded in this county" />
                <CountStat n={selRecords} label="checklists" active={metric === 'records'} title="Your checklists in this county, not individual birds counted" />
              </div>

              {metric === 'completeness' && completeness ? (
                <CountyCompletenessPopup
                  countyName={sel.name}
                  result={completeness.resultFor(sel.stusps, sel.name, sel.geoid)}
                  onLoad={() => completeness.requestCounty(sel.stusps, sel.name, sel.geoid)}
                  onOpenSpecies={onOpenSpecies}
                  hasEntryFor={hasEntryFor}
                  codeFor={completeness.codeFor}
                />
              ) : metric !== 'completeness' ? (
                <CountyPopupTop
                  agg={selAgg}
                  metric={metric}
                  onOpenSpecies={onOpenSpecies}
                  hasEntryFor={hasEntryFor}
                  taxonCodeFor={taxonCodeFor}
                  isPublicHotspot={isPublicHotspot}
                />
              ) : null}
            </div>
          </Popup>
        )}
      </Source>

      {/* Accurate county boundary lines from the basemap's own vector tiles
          (admin_level 6, z9+). The bundled line (capped at z9 above) hands off to
          this so the overlay traces the true county edge up close instead of the
          blocky simplified geometry — at zero new network/provider/bundle cost. */}
      {vectorReady && (
        <Layer
          id="sr-county-line-hi"
          type="line"
          source="openmaptiles"
          source-layer="boundary"
          filter={ACCURATE_COUNTY_FILTER}
          minzoom={COUNTY_LINE_HANDOFF_ZOOM}
          paint={linePaint}
          layout={lineLayout}
          beforeId={insertBelow}
        />
      )}

      {tooMany && (
        <div
          role="status"
          style={{
            position: 'absolute', bottom: 12, left: 12, zIndex: 1, pointerEvents: 'none',
            padding: '4px 10px', background: 'var(--sr-surface)', color: 'var(--sr-text-muted)',
            border: '1px solid var(--sr-border)', borderRadius: 6,
            fontSize: '0.71875rem', boxShadow: '0 1px 4px rgba(0,0,0,0.15)',
          }}
        >
          Zoom in to see counties
        </div>
      )}

      {/* Keyboard-accessible "Counties in view" panel — the only keyboard route to
          a county popup (the on-map fill is a pointer-only canvas hit-test). */}
      {list.length > 0 && (
        <div
          className="sr-county-inview"
          /* Top-left under the NavigationControl (matching AtlasLayer's "blocks in
             view" disclosure at top:78/left:10) so the panel clears BOTH reserved
             corners — the bottom-left AttributionControl (F094) and the bottom-right
             FAB cluster on narrow phones. Width in rem (14.5rem = 232px at 100%) so
             it tracks the in-app Text Size control and the county-name column isn't
             crushed at 200% scale; the 62vw cap keeps it off most of a phone. */
          style={{
            position: 'absolute', top: 78, left: 10, zIndex: 1050,
            width: 'min(14.5rem, 62vw)', maxHeight: '62%', display: 'flex', flexDirection: 'column',
            background: 'var(--sr-surface)', border: '1px solid var(--sr-border)',
            borderRadius: 8, boxShadow: '0 1px 4px rgba(0,0,0,0.15)', overflow: 'hidden',
          }}
        >
          <button
            type="button"
            tabIndex={0}
            onClick={() => setListOpen(o => !o)}
            aria-expanded={listOpen}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
              width: '100%', padding: '8px 10px', background: 'transparent', border: 'none',
              borderBottom: listOpen ? '1px solid var(--sr-border)' : 'none',
              fontFamily: 'inherit', fontSize: '0.71875rem', fontWeight: 700,
              textTransform: 'uppercase', letterSpacing: '0.06em',
              color: 'var(--sr-text-muted)', cursor: 'pointer', textAlign: 'left',
            }}
          >
            <span>Counties in view ({listTotal.toLocaleString()})</span>
            <span aria-hidden="true" style={{ transform: listOpen ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s' }}>›</span>
          </button>
          {listOpen && (
            <div style={{ overflowY: 'auto', padding: 6 }}>
              <ul role="list" aria-label="Counties in view" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                {list.map(row => {
                  const tier = tierForCounty(row.stusps, row.name, row.geoid)
                  const agg = aggregates?.get(countyKey(row.stusps, row.name)) ?? null
                  const value = shadeOn && agg && metric !== 'completeness' ? countyMetricValue(agg, metric) : 0
                  const isSelected = sel?.geoid === row.geoid
                  return (
                    <li role="listitem" key={row.geoid}>
                      <button
                        type="button"
                        tabIndex={0}
                        onClick={() => openCountyFromList(row)}
                        aria-pressed={isSelected}
                        className="sr-inview-row sr-touch-target"
                        style={{
                          display: 'flex', alignItems: 'center', gap: 9, width: '100%',
                          padding: '7px 8px', marginBottom: 2, borderRadius: 6, textAlign: 'left',
                          fontFamily: 'inherit', cursor: 'pointer',
                          background: isSelected ? 'var(--sr-accent-bg)' : 'transparent',
                          border: `1px solid ${isSelected ? 'var(--sr-accent-border)' : 'transparent'}`,
                        }}
                      >
                        {useTextures && tier > 0 ? (
                          <CountyDensitySwatch tier={tier as CountyTier} size={11} />
                        ) : (
                          <span aria-hidden="true" style={{
                            width: 11, height: 11, borderRadius: 3, flexShrink: 0,
                            border: '1px solid var(--sr-border-medium)',
                            borderStyle: tier > 0 ? 'solid' : 'dashed',
                            background: tier > 0 ? countyColor(tier as CountyTier) : 'transparent',
                          }} />
                        )}
                        <span style={{ flex: 1, minWidth: 0, fontSize: '0.78125rem', color: 'var(--sr-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {row.name}
                        </span>
                        {shadeOn && metric === 'completeness' && completeness ? (() => {
                          // FR-28 keyboard parity: "X/Y · Z%" when known, else the
                          // honest state — matching what the map/popup convey.
                          const s = completeness.summaryFor(row.stusps, row.name, row.geoid)
                          return s.status === 'ready' && s.y != null ? (
                            <span style={{ fontSize: '0.71875rem', fontWeight: 600, color: 'var(--sr-text)', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
                              {s.x.toLocaleString()}/{s.y.toLocaleString()} · {s.percent}%
                            </span>
                          ) : (
                            <span style={{ fontSize: '0.6875rem', fontWeight: 500, fontStyle: 'italic', color: 'var(--sr-text-muted)', flexShrink: 0 }}>
                              {COMPLETENESS_LIST_LABEL[s.status]}
                            </span>
                          )
                        })() : shadeOn && metric !== 'completeness' ? (
                          <span style={{ fontSize: '0.78125rem', fontWeight: value === 0 ? 600 : 700, color: value === 0 ? 'var(--sr-text-disabled)' : 'var(--sr-text)', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
                            {value.toLocaleString()}
                          </span>
                        ) : null}
                      </button>
                    </li>
                  )
                })}
              </ul>
              {listOverCap && (
                <div style={{ fontSize: '0.625rem', color: 'var(--sr-text-muted)', marginTop: 4, padding: '0 2px', lineHeight: 1.4 }}>
                  Showing the first {MARKER_LIST_CAP} of {listTotal.toLocaleString()} in view. Zoom in to narrow the list.
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </>
  )
}

function CountStat({ n, label, active, title }: { n: number; label: string; active: boolean; title?: string }) {
  const zero = n === 0
  return (
    <div title={title}>
      <div style={{
        fontSize: '1.0625rem', fontWeight: 700, lineHeight: 1, letterSpacing: '-0.01em',
        color: zero ? 'var(--sr-text-disabled)' : active ? 'var(--sr-accent)' : 'var(--sr-text)',
      }}>
        {n.toLocaleString()}
      </div>
      <div style={{ fontSize: '0.625rem', color: 'var(--sr-text-muted)', marginTop: 3, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        {label}
      </div>
    </div>
  )
}

// The popup's contextual top-3 — swaps with the active metric (D-03). Species
// mode → top species (by record count) via <BirdName>; Records mode → top
// locations (by checklist count) via <HotspotLink>. Unrecorded → an honest line.
function CountyPopupTop({ agg, metric, onOpenSpecies, hasEntryFor, taxonCodeFor, isPublicHotspot }: {
  agg: CountyAggregate | null
  metric: CountyMetric
  onOpenSpecies?: (commonName: string) => void
  hasEntryFor?: (name: string) => boolean
  taxonCodeFor?: (commonName: string) => string | undefined
  isPublicHotspot?: (locId: string) => boolean
}) {
  const wrap = { marginTop: 10, paddingTop: 9, borderTop: '1px solid var(--sr-border)' } as const
  const title = { fontSize: '0.625rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--sr-text-muted)', marginBottom: 2 } as const
  const caption = { fontSize: '0.625rem', color: 'var(--sr-text-muted)', marginBottom: 6 } as const
  const rank = { flex: 'none', width: 11, fontSize: '0.625rem', fontWeight: 700, color: 'var(--sr-text-disabled)', fontVariantNumeric: 'tabular-nums' } as const
  const count = { flex: 'none', fontSize: '0.6875rem', fontWeight: 600, color: 'var(--sr-text-muted)', fontVariantNumeric: 'tabular-nums' } as const
  const li = { display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 4 } as const

  const species = metric === 'species'
  const items = species ? (agg?.topSpecies ?? []) : (agg?.topLocations ?? [])
  if (items.length === 0) {
    return (
      <div style={wrap}>
        <div style={{ fontSize: '0.6875rem', color: 'var(--sr-text-muted)', lineHeight: 1.45 }}>
          No species recorded here yet.
        </div>
      </div>
    )
  }

  return (
    <div style={wrap}>
      <div style={title}>{species ? 'Most-reported species' : 'Top locations'}</div>
      <div style={caption}>by your checklist count</div>
      <ol style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {species
          ? (agg!.topSpecies).map((s, i) => (
            <li key={s.commonName} style={li}>
              <span style={rank}>{i + 1}</span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <BirdName
                  commonName={s.commonName}
                  taxonCode={taxonCodeFor?.(s.commonName)}
                  hasEntry={hasEntryFor ? hasEntryFor(s.commonName) : true}
                  onOpenSpecies={onOpenSpecies}
                  size="sm"
                />
              </span>
              <span style={count} title={`On ${s.count.toLocaleString()} of your checklists`}>{s.count.toLocaleString()}</span>
            </li>
          ))
          : (agg!.topLocations).map((l, i) => (
            <li key={l.locationId} style={li}>
              <span style={rank}>{i + 1}</span>
              <span style={{ flex: 1, minWidth: 0, fontSize: '0.75rem' }}>
                <HotspotLink
                  locId={l.locationId}
                  name={l.name}
                  isHotspot={isPublicHotspot ? isPublicHotspot(l.locationId) : false}
                  truncate
                  style={{ fontSize: '0.75rem' }}
                />
              </span>
              <span style={count} title={`${l.count.toLocaleString()} of your checklists`}>{l.count.toLocaleString()}</span>
            </li>
          ))}
      </ol>
    </div>
  )
}
