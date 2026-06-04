// Shared basemap layers + an optional brand-styled layer switcher, used by every
// map. Drop in <MapBaseLayers switcher /> for the interactive maps, or
// <MapBaseLayers /> for a plain Positron base (Statistics overview).
//
// The switcher is a portal-based Leaflet control (so branded React UI renders as
// a real map control) with a segmented base selector + a trails toggle. The
// chosen base/overlay persist via the storage seam, and the map's backdrop tone
// follows the active base.

import { useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import L from 'leaflet'
import { TileLayer, useMap } from 'react-leaflet'
import { storage } from '../lib/storage'
import {
  BASEMAPS, TRAILS, DEFAULT_BASE, BASE_SETTING, TRAILS_SETTING, type BaseLayerKey,
} from '../lib/basemaps'

/** Renders arbitrary React UI as a Leaflet control via a portal. */
function MapControl({ position, children }: { position: L.ControlPosition; children: ReactNode }) {
  const map = useMap()
  const [container] = useState(() => L.DomUtil.create('div'))

  useEffect(() => {
    const ctrl = new L.Control({ position })
    ctrl.onAdd = () => {
      // Let the control receive clicks/scroll without panning/zooming the map.
      L.DomEvent.disableClickPropagation(container)
      L.DomEvent.disableScrollPropagation(container)
      return container
    }
    ctrl.addTo(map)
    return () => { ctrl.remove() }
  }, [map, position, container])

  return createPortal(children, container)
}

export function MapBaseLayers({ switcher = false }: { switcher?: boolean }) {
  const map = useMap()
  const [base, setBase] = useState<BaseLayerKey>(DEFAULT_BASE)
  const [trails, setTrails] = useState(false)

  // Hydrate the persisted choice (switcher maps only).
  useEffect(() => {
    if (!switcher) return
    let cancelled = false
    storage.getSetting<BaseLayerKey>(BASE_SETTING)
      .then(v => { if (!cancelled && v && v in BASEMAPS) setBase(v) })
      .catch(() => {})
    storage.getSetting<boolean>(TRAILS_SETTING)
      .then(v => { if (!cancelled && typeof v === 'boolean') setTrails(v) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [switcher])

  // Match the backdrop (area beyond tiles) to the active base, on this map only.
  useEffect(() => {
    map.getContainer().style.setProperty('--sr-map-void', BASEMAPS[base].voidColor)
  }, [map, base])

  const def = BASEMAPS[base]

  const selectBase = (k: BaseLayerKey) => {
    setBase(k)
    if (switcher) void storage.setSetting(BASE_SETTING, k)
  }
  const toggleTrails = () => {
    setTrails(prev => {
      const next = !prev
      if (switcher) void storage.setSetting(TRAILS_SETTING, next)
      return next
    })
  }

  return (
    <>
      <TileLayer
        key={base}
        url={def.url}
        attribution={def.attribution}
        subdomains={def.subdomains ?? 'abc'}
        maxZoom={def.maxZoom}
        tileSize={def.tileSize ?? 256}
        zoomOffset={def.zoomOffset ?? 0}
      />
      {trails && (
        <TileLayer
          key="trails-overlay"
          url={TRAILS.url}
          attribution={TRAILS.attribution}
          maxZoom={TRAILS.maxZoom}
        />
      )}

      {switcher && (
        <MapControl position="topright">
          <div className="sr-map-layers">
            <div className="sr-map-layers-seg" role="group" aria-label="Base map">
              {(Object.keys(BASEMAPS) as BaseLayerKey[]).map(k => (
                <button
                  key={k}
                  type="button"
                  tabIndex={0}
                  className={base === k ? 'is-active' : ''}
                  aria-pressed={base === k}
                  onClick={() => selectBase(k)}
                >
                  {BASEMAPS[k].label}
                </button>
              ))}
            </div>
            <label className="sr-map-layers-trails">
              <input type="checkbox" checked={trails} onChange={toggleTrails} tabIndex={0} />
              Trails
            </label>
          </div>
        </MapControl>
      )}
    </>
  )
}
