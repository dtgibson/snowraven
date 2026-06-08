import type { Map as MaplibreMap } from 'maplibre-gl'

/** Fit the map to all pins once it's loaded (replaces the Leaflet bounds-fitter). */
export function fitToPins(map: MaplibreMap, pins: { lat: number; lng: number }[]) {
  if (pins.length === 0) return
  if (pins.length === 1) { map.easeTo({ center: [pins[0].lng, pins[0].lat], zoom: 11, duration: 0 }); return }
  let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity
  for (const p of pins) {
    minLng = Math.min(minLng, p.lng); maxLng = Math.max(maxLng, p.lng)
    minLat = Math.min(minLat, p.lat); maxLat = Math.max(maxLat, p.lat)
  }
  map.fitBounds([[minLng, minLat], [maxLng, maxLat]], { padding: 28, duration: 0 })
}
