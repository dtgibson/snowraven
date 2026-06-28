// Mutes the basemap while a Map Explorer shading ramp (county or atlas) is active,
// so the single active ramp pops against a neutral base. Greys the Positron
// land-cover fills (water, roads, and labels keep their color) and cuts raster-base
// saturation; the Trails overlay is intentionally left colored (it's a user-chosen
// layer, not the basemap). Renders nothing — it's a map effect, mounted inside
// <SnowMap> like AtlasLayer/CountyLayer.
//
// It applies BOTH the vector and raster paths idempotently, so it never needs to
// read SnowMap's private base selection: a Positron land fill is occluded under a
// raster base, and raster-saturation is inert while its raster layer is hidden.
// When active it re-applies on `styledata`, because an offline/online style reload
// recreates the layers with their original colors (never gate on isStyleLoaded() —
// the sprite-registration post-mortem).

import { useEffect } from 'react'
import { useMap } from 'react-map-gl/maplibre'
import {
  TINTED_LAND_LAYERS,
  RASTER_BASE_LAYER_IDS,
  BASEMAP_MUTE_RASTER_SATURATION,
  desaturateHsl,
} from '../../lib/mapStyle'

export function BasemapDesaturation({ active }: { active: boolean }) {
  const map = useMap().current

  useEffect(() => {
    if (!map) return
    // The MapRef proxy doesn't expose setPaintProperty; reach the maplibre Map.
    const m = map.getMap()
    const apply = () => {
      for (const { id, tint } of TINTED_LAND_LAYERS) {
        if (!m.getLayer(id)) continue
        try { m.setPaintProperty(id, 'fill-color', active ? desaturateHsl(tint) : tint) } catch { /* layer not paint-ready yet */ }
      }
      for (const id of RASTER_BASE_LAYER_IDS) {
        if (!m.getLayer(id)) continue
        try { m.setPaintProperty(id, 'raster-saturation', active ? BASEMAP_MUTE_RASTER_SATURATION : 0) } catch { /* layer not paint-ready yet */ }
      }
    }
    apply()
    // Only the muted state must survive a style reload; the default colors are
    // already what a fresh style carries, so there's nothing to persist when off.
    if (!active) return
    m.on('styledata', apply)
    return () => { m.off('styledata', apply) }
  }, [map, active])

  return null
}
