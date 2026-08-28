import { useMemo } from 'react'
import { Source, Layer } from 'react-map-gl/maplibre'
import type { HeatmapLayerSpecification } from 'maplibre-gl'
import type { FeatureCollection, Point } from 'geojson'
import { heatRadiusPx, heatIntensityFactor } from '../../lib/heat'

// ── Heatmap layer (MapLibre native) ─────────────────────────────────────────

// Sighting-location heat. Points arrive [lat, lng, weight]; the weight already
// folds in obs count × intensity (heatWeight, lib/heat.ts). Rendered as a
// MapLibre `heatmap` layer so it shares the Map Explorer's tuned feel.
export function HeatmapLayer({ points, intensity, belowFillId, opacity }: {
  points: [number, number, number][]
  intensity: number
  /** OPT-IN (county-shading-and-project-stats, FR-05). When a county fill is
   *  active on this map, the heat is re-ordered UNDER it so the tier colors read
   *  on top — the same `beforeId` mechanism the Map Explorer's SightingMarkers
   *  uses. Absent → today's z-order, byte-identical. */
  belowFillId?: string
  /** OPT-IN dim while a county fill is active. Absent → the shipped 0.85. */
  opacity?: number
}) {
  const fc = useMemo<FeatureCollection<Point, { w: number }>>(() => ({
    type: 'FeatureCollection',
    features: points.map(([lat, lng, w]) => ({
      type: 'Feature', properties: { w },
      geometry: { type: 'Point', coordinates: [lng, lat] },
    })),
  }), [points])
  return (
    <Source id="sr-sp-heat" type="geojson" data={fc}>
      <Layer id="sr-sp-heat" type="heatmap" beforeId={belowFillId} paint={{
        'heatmap-weight': ['get', 'w'],
        'heatmap-intensity': heatIntensityFactor(intensity),
        'heatmap-radius': heatRadiusPx(intensity),
        'heatmap-opacity': opacity ?? 0.85,
      } as HeatmapLayerSpecification['paint']} />
    </Source>
  )
}
