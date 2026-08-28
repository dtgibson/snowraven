// Shared pins map: DOM <Marker> pins (one per unique coordinate), a single
// state-driven <Popup> listing a coordinate's sighting dates, and a
// MapBoundsFitter that frames the points. Extracted from SpeciesDetail's pins
// path so both the Species Detail "Sighting Locations" map and the per-individual
// card map on the Named Birds tab share one implementation.
//
// It owns ONLY the pins + popup + bounds-fit — NOT the height container (the
// caller wraps it: `.sr-map-container` vs the card's `.sr-named-map`) and NOT the
// heatmap (which stays in SpeciesDetail). Markers arrive already aggregated by
// coordinate (buildSightingMarkers); this component is presentational +
// popup-state only.

import { useState } from 'react'
import { Marker, Popup } from 'react-map-gl/maplibre'
import { SnowMap } from './SnowMap'
import { MapBoundsFitter } from './speciesDetail/MapBoundsFitter'
import { formatDate } from '../lib/formatDate'
import { ChecklistLink } from './ChecklistLink'
import { neutralizeMarkerWrapper } from '../lib/mapPins'
import { SharePin } from './map/SharePin'
import { CountyLayer } from './map/CountyLayer'
import { BasemapDesaturation } from './map/BasemapDesaturation'
import { SHADED_PIN_OPACITY } from '../lib/countyShadingUi'
import type { CountyFC } from '../lib/countyBoundaries'
import type { CountyAggregate, CountyTiers } from '../lib/countyShading'
import type { SightingMarker } from '../lib/sightingMarkers'

export type { SightingMarker } from '../lib/sightingMarkers'

// Location pin (teardrop). Rendered into a react-map-gl <Marker anchor="bottom">
// so the tip lands on the coordinate. Brand-accent fill via CSS var (resolves at
// paint time in the DOM overlay). Static SVG constant — the only
// dangerouslySetInnerHTML on the map, per the CLAUDE.md standing security check
// (map popups stay escaped JSX; the pin sprite is the lone static-SVG exception).
const SP_PIN_HTML = '<svg viewBox="0 0 28 40" width="24" height="34" xmlns="http://www.w3.org/2000/svg"><path d="M14 0C6.268 0 0 6.268 0 14c0 5.47 3.078 10.23 7.602 12.651L14 40l6.398-13.349A13.944 13.944 0 0028 14C28 6.268 21.732 0 14 0z" style="fill:var(--sr-accent)"/><circle cx="14" cy="14" r="5" fill="white"/></svg>'

export interface SightingsMapCountyProps {
  /** OPT-IN county overlay (FR-08). Every prop below defaults to today's
   *  behavior, so the Named Birds per-row card map — this component's only other
   *  production caller — renders byte-identically: no county layer, no geometry
   *  request, no basemap muting, no pin dimming.
   *
   *  The overlay reaches the Pins branch through EXPLICIT PROPS rather than a
   *  `children` prop: `children` would let any future caller inject arbitrary
   *  map layers into the Named Birds card, which is a wider seam than this
   *  feature needs. Geometry, aggregates and tiers stay the HOST's, because the
   *  host owns the filters they are built from. */
  countyData?: CountyFC | null
  countyShade?: boolean
  countyAggregates?: Map<string, CountyAggregate> | null
  countyTiers?: CountyTiers
  countyUseTextures?: boolean
  /** Per-species popup/legend presentation, forwarded to CountyLayer (FR-10). */
  speciesContext?: { commonName: string } | null
  isPublicHotspot?: (locId: string) => boolean
}

export function SightingsMap({
  markers, switcher = true, compact = false, sharePinResetKey,
  countyData = null, countyShade = false, countyAggregates = null, countyTiers,
  countyUseTextures = false, speciesContext = null, isPublicHotspot,
}: {
  /** Aggregated by coordinate, sightings newest-first. The caller must not mount
   *  this with an empty array — gate on `markers.length > 0` so no WebGL context
   *  mounts for a no-coordinate individual. */
  markers: SightingMarker[]
  /** Show the base map switcher (Map/Satellite/Topo). Defaults true (Species
   *  Detail parity); the card passes false to keep the small map uncluttered. */
  switcher?: boolean
  /** Share-pin density, forwarded to SharePin (where `compact` is REQUIRED, per
   *  the MediaFrame precedent). It is defaulted HERE only to keep this
   *  component's existing optional-prop shape (`switcher = true`) and its test
   *  suite byte-unchanged; BOTH call sites pass it explicitly. The Named Birds
   *  card map is 220px tall and wants the denser popup. */
  compact?: boolean
  /** Remounts ONLY the share pin when the entity behind the map changes. Species
   *  Detail's map keeps its JSX position across a species change, so nothing
   *  unmounts and a stale pin would survive (FR-09 / QA-16). Keying the whole
   *  <SightingsMap> would churn the WebGL context and re-run the bounds fit on
   *  every species change; this keys the tiny pin instead. */
  sharePinResetKey?: string | number
} & SightingsMapCountyProps) {
  // The pin whose popup is open. MapLibre uses ONE state-driven <Popup>, not a
  // popup bound to each marker. Keyed by "lat,lng".
  const [selectedCoord, setSelectedCoord] = useState<string | null>(null)
  const selected = selectedCoord
    ? markers.find(m => `${m.lat},${m.lng}` === selectedCoord) ?? null
    : null
  const coords = markers.map(m => [m.lat, m.lng] as [number, number])
  // Shading is only "on" once the geometry has actually loaded and aggregates
  // exist, so the basemap never mutes against a layer that cannot draw.
  const shadeOn = countyShade && !!countyData && !!countyAggregates && !!countyTiers
  // True only for a caller that opted into the overlay at all. A caller that
  // passes NO county props (the Named Birds per-row card) gets no extra style
  // properties whatsoever, so its pins are byte-identical to the pre-change
  // build rather than merely looking the same (FR-08, QA-09). `countyShade`
  // flips in the same render as the first enable, before the geometry resolves,
  // so the dim transition is present from the very first toggle.
  const countyAware = countyShade || countyData !== null

  return (
    <SnowMap
      initialViewState={{ longitude: coords[0]?.[1] ?? 0, latitude: coords[0]?.[0] ?? 0, zoom: 5 }}
      style={{ height: '100%', width: '100%' }}
      switcher={switcher}
      scrollZoom={false}
      // Page-embedded map (Species Detail's Sighting Locations + the Named Birds
      // card): cooperative gestures so a one-finger drag scrolls the page instead
      // of scroll-trapping the map. Desktop drag-pan is unaffected. Mirrors the
      // already-present scrollZoom={false} wheel mitigation for touch.
      cooperativeGestures
    >
      {markers.map(m => {
        const n = m.sightings.length
        const label = `${m.lat.toFixed(4)}, ${m.lng.toFixed(4)}: ${n} sighting${n === 1 ? '' : 's'}`
        return (
          <Marker key={`${m.lat},${m.lng}`} longitude={m.lng} latitude={m.lat} anchor="bottom"
            ref={neutralizeMarkerWrapper}
            onClick={e => { e.originalEvent.stopPropagation(); setSelectedCoord(`${m.lat},${m.lng}`) }}>
            {/* Real <button> so Enter/Space open the popup (the native click bubbles
                to the wrapper's listener); the wrapper is demoted via ref. F014. */}
            <button type="button" aria-label={label}
              style={{
                width: 24, height: 34, padding: 0, border: 'none', background: 'none',
                cursor: 'pointer', display: 'block',
                // Dim the pins beneath an active county fill so the tier colors
                // read on top (FR-05). The two properties exist ONLY for a
                // caller that opted in; the shipped style object is otherwise
                // untouched.
                //
                // REDUCED MOTION is handled app-wide, not here: globals.css
                // carries `*, *::before, *::after { transition-duration:
                // 0.001ms !important }` under `prefers-reduced-motion: reduce`,
                // and an `!important` author rule beats a normal inline
                // declaration, so this transition collapses with every other
                // one in the app. A per-component matchMedia fallback would be
                // redundant and would deviate from every other animated surface
                // here. (weft-design-lint flags this file for the missing
                // in-file fallback; that is the answer.)
                ...(countyAware ? {
                  opacity: shadeOn ? SHADED_PIN_OPACITY : 1,
                  transition: 'opacity 200ms cubic-bezier(0.16, 1, 0.3, 1)',
                } : {}),
              }}
              dangerouslySetInnerHTML={{ __html: SP_PIN_HTML }} />
          </Marker>
        )
      })}
      {selected && (
        <Popup longitude={selected.lng} latitude={selected.lat} anchor="bottom" offset={36} onClose={() => setSelectedCoord(null)} maxWidth="min(260px, 80vw)">
          <div style={{ fontSize: '0.8125rem', lineHeight: 1.7, minWidth: 120 }}>
            {selected.sightings.slice(0, 6).map(({ submissionId, date }, i) => (
              <div key={`${submissionId}-${i}`}>
                <ChecklistLink submissionId={submissionId} label={formatDate(date)} />
              </div>
            ))}
            {selected.sightings.length > 6 && (
              <div style={{ color: 'var(--sr-text-muted)', marginTop: 2, fontSize: '0.75rem' }}>
                +{selected.sightings.length - 6} more
              </div>
            )}
          </div>
        </Popup>
      )}
      {/* Counties (FR-07, Pins branch). Rendered only when the caller has opted
          in AND the geometry has loaded, so with the control off this subtree
          does not exist: no layer, no source, no basemap effect, no new DOM. */}
      {countyData && countyTiers && (
        <>
          <CountyLayer
            data={countyData}
            shade={countyShade}
            aggregates={countyAggregates}
            tiers={countyTiers}
            metric="records"
            useTextures={countyUseTextures}
            speciesContext={speciesContext}
            isPublicHotspot={isPublicHotspot}
          />
          <BasemapDesaturation active={shadeOn} />
        </>
      )}
      <MapBoundsFitter coordinates={coords} />
      {/* Pin Share, surfaces C and F in one change: Species Detail's Sighting
          Locations (Pins mode) and the Named Birds per-individual card map are
          this component's only two consumers. */}
      <SharePin key={sharePinResetKey} compact={compact} buttonHost="corner" />
    </SnowMap>
  )
}
