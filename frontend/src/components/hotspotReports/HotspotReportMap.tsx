// The report's map (FR-40; schema section 9; design-spec "Map"). The ONLY file
// of this feature that imports `SnowMap` or `react-map-gl`, reached only through
// `React.lazy` inside the tab, so maplibre stays off the entry chunk and off the
// tab's own static graph (`entryChunk.test.ts`), and the overview and a location
// without coordinates load no map chunk and no tile.
//
// A PLAIN map, by the user's decision at the design review: one non-interactive
// marker, no popup, no corner controls (no share, fullscreen or location
// button), only the zoom control and the compact attribution every `<SnowMap>`
// draws, and the gesture posture of the app's other in-page maps (scroll zoom
// off, cooperative gestures on).
//
// ONE INSTANCE PER RUN OF SELECTIONS WITH COORDINATES: a change of location
// moves the marker by props and re-centers with `jumpTo` (no animation, because
// a GL transition does not follow the app's reduced-motion rule, maps.md). The
// map is not keyed on the location and is not remounted; it unmounts when the
// selection has no coordinates or is cleared.

import { useEffect } from 'react'
import { Marker, useMap } from 'react-map-gl/maplibre'
import { SnowMap } from '../SnowMap'
import { neutralizeMarkerWrapper } from '../../lib/mapPins'
import { mapLabel } from '../../lib/hotspotReportsCopy'

/** The zoom a report opens at: a hotspot's own scale, a few streets around it. */
const REPORT_MAP_ZOOM = 13

const MAP_STYLE = { width: '100%', height: '100%' } as const

/** Re-centers the one map instance when the selected location changes. */
function Recenter({ lat, lng }: { lat: number; lng: number }) {
  const { current: map } = useMap()
  useEffect(() => {
    map?.jumpTo({ center: [lng, lat], zoom: REPORT_MAP_ZOOM })
  }, [map, lat, lng])
  return null
}

export function HotspotReportMap({ lat, lng, name }: { lat: number; lng: number; name: string }) {
  return (
    <div className="sr-hsr-map" role="group" aria-label={mapLabel(name)}>
      <SnowMap
        initialViewState={{ longitude: lng, latitude: lat, zoom: REPORT_MAP_ZOOM }}
        style={MAP_STYLE}
        scrollZoom={false}
        cooperativeGestures
      >
        <Recenter lat={lat} lng={lng} />
        {/* Not a target: the wrapper is demoted to presentation, the pin is
            decorative and takes no pointer, and nothing opens on a press. The
            fill reads the map's own pin tokens; the centre is the theme-neutral
            white the pin glyph contrast was measured against (globals.css). */}
        <Marker longitude={lng} latitude={lat} anchor="bottom" ref={neutralizeMarkerWrapper}>
          <svg className="sr-hsr-pin" viewBox="0 0 28 40" width="24" height="34" aria-hidden="true" focusable="false">
            <path
              d="M14 0C6.268 0 0 6.268 0 14c0 5.47 3.078 10.23 7.602 12.651L14 40l6.398-13.349A13.944 13.944 0 0028 14C28 6.268 21.732 0 14 0z"
              className="sr-hsr-pin-body"
            />
            <circle cx="14" cy="14" r="5" className="sr-hsr-pin-dot" />
          </svg>
        </Marker>
      </SnowMap>
    </div>
  )
}
