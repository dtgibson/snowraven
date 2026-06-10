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
import { SUBMISSION_ID_RE } from './speciesDetail/ui'
import type { SightingMarker } from '../lib/sightingMarkers'

export type { SightingMarker } from '../lib/sightingMarkers'

// Location pin (teardrop). Rendered into a react-map-gl <Marker anchor="bottom">
// so the tip lands on the coordinate. Brand-accent fill via CSS var (resolves at
// paint time in the DOM overlay). Static SVG constant — the only
// dangerouslySetInnerHTML on the map, per the CLAUDE.md standing security check
// (map popups stay escaped JSX; the pin sprite is the lone static-SVG exception).
const SP_PIN_HTML = '<svg viewBox="0 0 28 40" width="24" height="34" xmlns="http://www.w3.org/2000/svg"><path d="M14 0C6.268 0 0 6.268 0 14c0 5.47 3.078 10.23 7.602 12.651L14 40l6.398-13.349A13.944 13.944 0 0028 14C28 6.268 21.732 0 14 0z" style="fill:var(--sr-accent)"/><circle cx="14" cy="14" r="5" fill="white"/></svg>'

export function SightingsMap({ markers, switcher = true }: {
  /** Aggregated by coordinate, sightings newest-first. The caller must not mount
   *  this with an empty array — gate on `markers.length > 0` so no WebGL context
   *  mounts for a no-coordinate individual. */
  markers: SightingMarker[]
  /** Show the base map switcher (Map/Satellite/Topo). Defaults true (Species
   *  Detail parity); the card passes false to keep the small map uncluttered. */
  switcher?: boolean
}) {
  // The pin whose popup is open. MapLibre uses ONE state-driven <Popup>, not a
  // popup bound to each marker. Keyed by "lat,lng".
  const [selectedCoord, setSelectedCoord] = useState<string | null>(null)
  const selected = selectedCoord
    ? markers.find(m => `${m.lat},${m.lng}` === selectedCoord) ?? null
    : null
  const coords = markers.map(m => [m.lat, m.lng] as [number, number])

  return (
    <SnowMap
      initialViewState={{ longitude: coords[0]?.[1] ?? 0, latitude: coords[0]?.[0] ?? 0, zoom: 5 }}
      style={{ height: '100%', width: '100%' }}
      switcher={switcher}
      scrollZoom={false}
    >
      {markers.map(m => (
        <Marker key={`${m.lat},${m.lng}`} longitude={m.lng} latitude={m.lat} anchor="bottom"
          onClick={e => { e.originalEvent.stopPropagation(); setSelectedCoord(`${m.lat},${m.lng}`) }}>
          <div style={{ width: 24, height: 34, cursor: 'pointer' }} dangerouslySetInnerHTML={{ __html: SP_PIN_HTML }} />
        </Marker>
      ))}
      {selected && (
        <Popup longitude={selected.lng} latitude={selected.lat} anchor="bottom" offset={36} onClose={() => setSelectedCoord(null)} closeButton={false} maxWidth="260px">
          <div style={{ fontSize: '0.8125rem', lineHeight: 1.7, minWidth: 120 }}>
            {selected.sightings.slice(0, 6).map(({ submissionId, date }, i) => (
              <div key={`${submissionId}-${i}`}>
                {SUBMISSION_ID_RE.test(submissionId) ? (
                  <a
                    href={`https://ebird.org/checklist/${submissionId}`}
                    target="_blank"
                    rel="noreferrer"
                    style={{ color: 'var(--sr-accent)', textDecoration: 'none' }}
                    onMouseEnter={e => (e.currentTarget.style.textDecoration = 'underline')}
                    onMouseLeave={e => (e.currentTarget.style.textDecoration = 'none')}
                  >
                    {formatDate(date)}
                  </a>
                ) : (
                  <span>{formatDate(date)}</span>
                )}
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
      <MapBoundsFitter coordinates={coords} />
    </SnowMap>
  )
}
