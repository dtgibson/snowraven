import { useEffect } from 'react'
import { useMap } from 'react-map-gl/maplibre'

// Fit the map to all sighting coordinates (re-runs when the set changes, and
// once the map ref becomes available). Coords arrive [lat, lng]; MapLibre wants
// [lng, lat], converted here.
export function MapBoundsFitter({ coordinates }: { coordinates: [number, number][] }) {
  const map = useMap().current
  useEffect(() => {
    if (!map || coordinates.length === 0) return
    if (coordinates.length === 1) {
      map.flyTo({ center: [coordinates[0][1], coordinates[0][0]], zoom: 12, duration: 0 })
    } else {
      let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity
      for (const [lat, lng] of coordinates) {
        minLng = Math.min(minLng, lng); maxLng = Math.max(maxLng, lng)
        minLat = Math.min(minLat, lat); maxLat = Math.max(maxLat, lat)
      }
      map.fitBounds([[minLng, minLat], [maxLng, maxLat]], { padding: 30, duration: 0 })
    }
  }, [map, coordinates])
  return null
}
