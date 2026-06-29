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
import type { FillLayerSpecification, FilterSpecification, LineLayerSpecification, MapGeoJSONFeature, MapLayerMouseEvent } from 'maplibre-gl'
import { ExternalLink } from 'lucide-react'
import {
  countiesInBounds, countyListRows, padBounds, countyKey, deriveCountyRegionCode, stateNameFor,
  type CountyFC, type Bounds, type CountyListRow,
} from '../../lib/countyBoundaries'
import {
  countyMetricValue, type CountyAggregate, type CountyMetric, type CountyTiers,
} from '../../lib/countyShading'
import { OutboundLink } from '../OutboundLink'
import { BirdName } from '../BirdName'
import { HotspotLink } from '../HotspotLink'
import { updateMapCursor } from '../../lib/mapPins'
import { MARKER_LIST_CAP } from '../../lib/markersInView'

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

interface Props {
  data: CountyFC | null
  shade?: boolean
  /** Per-county aggregates keyed by countyKey(stusps, name); null until ready. */
  aggregates?: Map<string, CountyAggregate> | null
  /** Quantile tiers over the active metric's non-zero values. */
  tiers: CountyTiers
  metric: CountyMetric
  onOpenSpecies?: (commonName: string) => void
  hasEntryFor?: (name: string) => boolean
  taxonCodeFor?: (commonName: string) => string | undefined
  isPublicHotspot?: (locId: string) => boolean
}

type Selected = { lng: number; lat: number; geoid: string; name: string; stusps: string }

const EMPTY_FC: FeatureCollection = { type: 'FeatureCollection', features: [] }

export function CountyLayer({
  data, shade = false, aggregates = null, tiers, metric,
  onOpenSpecies, hasEntryFor, taxonCodeFor, isPublicHotspot,
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

  // tier (1..4) for a county by its (stusps, name) join key; 0 when not shading
  // or no record for the active metric.
  const tierForCounty = useMemo(() => {
    return (stusps: string, name: string): number => {
      if (!shadeOn || !aggregates) return 0
      const agg = aggregates.get(countyKey(stusps, name))
      if (!agg) return 0
      return tiers.tierFor(countyMetricValue(agg, metric))
    }
  }, [shadeOn, aggregates, tiers, metric])

  const { fc, tooMany, list, listTotal, listOverCap } = useMemo(() => {
    if (!data || !bounds) return { fc: EMPTY_FC, tooMany: false, list: [] as CountyListRow[], listTotal: 0, listOverCap: false }
    const res = countiesInBounds(data, padBounds(bounds, BOUNDS_PAD), COUNTY_CAP)
    if (res.tooMany) return { fc: EMPTY_FC, tooMany: true, list: [] as CountyListRow[], listTotal: 0, listOverCap: false }
    const features = res.features.map(f => ({
      type: 'Feature' as const,
      properties: {
        geoid: f.properties.geoid,
        name: f.properties.name,
        stusps: f.properties.stusps,
        tier: tierForCounty(f.properties.stusps, f.properties.name),
      },
      geometry: f.geometry,
    }))
    const { rows, total, overCap } = countyListRows(res.features, MARKER_LIST_CAP)
    return { fc: { type: 'FeatureCollection' as const, features }, tooMany: false, list: rows, listTotal: total, listOverCap: overCap }
  }, [data, bounds, tierForCounty])

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

  // Re-resolve tier fill colors on a light/dark theme change (FR-27 parity —
  // harmless here since the county ramp is theme-identical, but kept for the
  // contract). MutationObserver on <html data-theme>.
  useEffect(() => {
    const obs = new MutationObserver(() => setThemeRev(n => n + 1))
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => obs.disconnect()
  }, [])

  const openCountyFromList = (row: CountyListRow) => {
    setSel({ lng: row.center[0], lat: row.center[1], geoid: row.geoid, name: row.name, stusps: row.stusps })
    map?.flyTo({ center: row.center, duration: 400 })
  }

  if (!data) return null

  // themeRev re-renders so the token reads below pick up a theme change.
  void themeRev

  const fillPaint: FillLayerSpecification['paint'] = {
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
        {sel && (
          <Popup longitude={sel.lng} latitude={sel.lat} anchor="bottom" offset={10} closeOnClick={false} onClose={() => setSel(null)} maxWidth="248px">
            <div style={{ minWidth: 188, maxWidth: 220, fontSize: '0.8125rem' }}>
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

              <div style={{ display: 'flex', gap: 18, marginTop: 9 }}>
                <CountStat n={selSpecies} label="species" active={metric === 'species'} title="Distinct species you've recorded in this county" />
                <CountStat n={selRecords} label="checklists" active={metric === 'records'} title="Your checklists in this county — not individual birds counted" />
              </div>

              <CountyPopupTop
                agg={selAgg}
                metric={metric}
                onOpenSpecies={onOpenSpecies}
                hasEntryFor={hasEntryFor}
                taxonCodeFor={taxonCodeFor}
                isPublicHotspot={isPublicHotspot}
              />
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
          style={{
            position: 'absolute', bottom: 12, left: 12, zIndex: 1050,
            width: 'min(232px, 62vw)', maxHeight: '62%', display: 'flex', flexDirection: 'column',
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
                  const tier = tierForCounty(row.stusps, row.name)
                  const agg = aggregates?.get(countyKey(row.stusps, row.name)) ?? null
                  const value = shadeOn && agg ? countyMetricValue(agg, metric) : 0
                  const isSelected = sel?.geoid === row.geoid
                  return (
                    <li role="listitem" key={row.geoid}>
                      <button
                        type="button"
                        tabIndex={0}
                        onClick={() => openCountyFromList(row)}
                        aria-pressed={isSelected}
                        className="sr-inview-row"
                        style={{
                          display: 'flex', alignItems: 'center', gap: 9, width: '100%',
                          padding: '7px 8px', marginBottom: 2, borderRadius: 6, textAlign: 'left',
                          fontFamily: 'inherit', cursor: 'pointer',
                          background: isSelected ? 'var(--sr-accent-bg)' : 'transparent',
                          border: `1px solid ${isSelected ? 'var(--sr-accent-border)' : 'transparent'}`,
                        }}
                      >
                        <span aria-hidden="true" style={{
                          width: 11, height: 11, borderRadius: 3, flexShrink: 0,
                          border: '1px solid var(--sr-border-medium)',
                          borderStyle: tier > 0 ? 'solid' : 'dashed',
                          background: tier > 0 ? countyColor(tier as CountyTier) : 'transparent',
                        }} />
                        <span style={{ flex: 1, minWidth: 0, fontSize: '0.78125rem', color: 'var(--sr-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {row.name}
                        </span>
                        {shadeOn && (
                          <span style={{ fontSize: '0.78125rem', fontWeight: value === 0 ? 600 : 700, color: value === 0 ? 'var(--sr-text-disabled)' : 'var(--sr-text)', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
                            {value.toLocaleString()}
                          </span>
                        )}
                      </button>
                    </li>
                  )
                })}
              </ul>
              {listOverCap && (
                <div style={{ fontSize: '0.625rem', color: 'var(--sr-text-muted)', marginTop: 4, padding: '0 2px', lineHeight: 1.4 }}>
                  Showing the first {MARKER_LIST_CAP} of {listTotal.toLocaleString()} in view — zoom in to narrow the list.
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
