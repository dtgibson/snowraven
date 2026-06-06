// Thin shared wrapper around react-map-gl (MapLibre). Uses ONE persistent style
// (the tuned OpenFreeMap vector base) and toggles satellite/topo/trails as
// layers within it — so no source ever disappears (the water mask always has
// its geometry) and base switches preserve pan/zoom. Optional brand-styled base
// switcher (Map / Satellite / Topo + Trails), zoom controls, and auto-resize.

import 'maplibre-gl/dist/maplibre-gl.css'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import MapGL, { NavigationControl, Source, Layer } from 'react-map-gl/maplibre'
import type { StyleSpecification, Map as MaplibreMap } from 'maplibre-gl'
import { storage } from '../lib/storage'
import {
  fetchTunedBaseStyle, firstSymbolLayerId, RASTER_BASES, VOID_COLOR, BASE_LABEL,
  DEFAULT_BASE, BASE_SETTING, TRAILS_SETTING, TRAILS_TILES, TRAILS_ATTRIB,
  type VectorVariant, type BaseKey,
} from '../lib/mapStyle'

interface SnowMapProps {
  initialViewState?: { longitude: number; latitude: number; zoom: number }
  style?: React.CSSProperties
  children?: ReactNode
  onLoad?: (e: { target: MaplibreMap }) => void
  /** Show the base switcher (Map/Satellite/Topo + Trails) and persist the choice. */
  switcher?: boolean
  /** Disable scroll-wheel zoom (for maps embedded in a scrollable page). Defaults
   *  to enabled; zoom buttons + pinch still work when off. */
  scrollZoom?: boolean
}

// Cache the fetched+tuned vector style so every map reuses it.
const cache = new Map<VectorVariant, StyleSpecification>()
const inflight = new Map<VectorVariant, Promise<StyleSpecification>>()
function getVectorStyle(variant: VectorVariant): Promise<StyleSpecification> {
  const hit = cache.get(variant)
  if (hit) return Promise.resolve(hit)
  let p = inflight.get(variant)
  if (!p) {
    // Clear the in-flight entry once settled. On success the result lives in
    // `cache`; on failure the entry MUST be dropped so a retry re-fetches —
    // a cached rejected promise would otherwise re-reject instantly forever.
    p = fetchTunedBaseStyle(variant)
      .then(s => { cache.set(variant, s); return s })
      .finally(() => { inflight.delete(variant) })
    inflight.set(variant, p)
  }
  return p
}

const vis = (on: boolean) => ({ visibility: (on ? 'visible' : 'none') as 'visible' | 'none' })

export function SnowMap({ initialViewState, style, children, onLoad, switcher, scrollZoom }: SnowMapProps) {
  const [base, setBase] = useState<BaseKey>(DEFAULT_BASE)
  const [trails, setTrails] = useState(false)
  const [mapStyle, setMapStyle] = useState<StyleSpecification | null>(cache.get('positron') ?? null)
  const [loadError, setLoadError] = useState(false)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (mapStyle) return
    let cancelled = false
    getVectorStyle('positron')
      .then(s => { if (!cancelled) setMapStyle(s) })
      .catch(() => { if (!cancelled) setLoadError(true) })
    return () => { cancelled = true }
  }, [mapStyle, attempt])

  // Re-attempt the style fetch (offline / provider down). Clearing the error
  // flips back to the loading state immediately, then `attempt` re-runs the effect.
  const retryStyle = () => { setLoadError(false); setAttempt(n => n + 1) }

  useEffect(() => {
    if (!switcher) return
    let cancelled = false
    storage.getSetting<BaseKey>(BASE_SETTING).then(v => { if (!cancelled && v && v in BASE_LABEL) setBase(v) }).catch(() => {})
    storage.getSetting<boolean>(TRAILS_SETTING).then(v => { if (!cancelled && typeof v === 'boolean') setTrails(v) }).catch(() => {})
    return () => { cancelled = true }
  }, [switcher])

  // Place raster bases under the vector labels so labels stay readable on top.
  const beforeLabels = useMemo(() => (mapStyle ? firstSymbolLayerId(mapStyle) : undefined), [mapStyle])

  const selectBase = (k: BaseKey) => { setBase(k); if (switcher) void storage.setSetting(BASE_SETTING, k) }
  const toggleTrails = () => setTrails(prev => { const next = !prev; if (switcher) void storage.setSetting(TRAILS_SETTING, next); return next })

  if (!mapStyle) {
    const placeholderStyle: React.CSSProperties = {
      ...style, display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', gap: 10, padding: 16, textAlign: 'center',
      background: VOID_COLOR.positron, color: 'var(--sr-text-muted)', fontSize: '0.8125rem',
    }
    return (
      <div style={placeholderStyle} role={loadError ? 'alert' : 'status'}>
        {loadError ? (
          <>
            <span>{"Map couldn't load — check your connection."}</span>
            <button
              type="button"
              tabIndex={0}
              onClick={retryStyle}
              style={{
                font: 'inherit', fontWeight: 500, padding: '6px 16px', cursor: 'pointer',
                color: 'var(--sr-text)', background: 'var(--sr-surface)',
                border: '1px solid var(--sr-border)', borderRadius: 6,
              }}
            >
              Retry
            </button>
          </>
        ) : (
          'Loading map…'
        )}
      </div>
    )
  }

  return (
    <MapGL
      initialViewState={initialViewState ?? { longitude: -100, latitude: 45, zoom: 3 }}
      mapStyle={mapStyle}
      style={style}
      attributionControl={{ compact: true }}
      scrollZoom={scrollZoom}
      onLoad={onLoad as never}
    >
      <NavigationControl position="top-left" showCompass={false} />

      {/* Raster bases live IN the one style, toggled by visibility (under labels). */}
      <Source id="sr-satellite" type="raster" tiles={RASTER_BASES.satellite.tiles} tileSize={256} attribution={RASTER_BASES.satellite.attribution} maxzoom={RASTER_BASES.satellite.maxzoom}>
        <Layer id="sr-satellite" type="raster" beforeId={beforeLabels} layout={vis(base === 'satellite')} />
      </Source>
      <Source id="sr-topo" type="raster" tiles={RASTER_BASES.topo.tiles} tileSize={256} attribution={RASTER_BASES.topo.attribution} maxzoom={RASTER_BASES.topo.maxzoom}>
        <Layer id="sr-topo" type="raster" beforeId={beforeLabels} layout={vis(base === 'topo')} />
      </Source>

      {/* Hiking trails overlay (on top). */}
      <Source id="sr-trails" type="raster" tiles={TRAILS_TILES} tileSize={256} attribution={TRAILS_ATTRIB} maxzoom={18}>
        <Layer id="sr-trails" type="raster" layout={vis(trails)} />
      </Source>

      {switcher && (
        <div className="sr-map-layers" style={{ position: 'absolute', top: 8, right: 8, zIndex: 1 }}>
          <div className="sr-map-layers-seg" role="group" aria-label="Base map">
            {(['positron', 'satellite', 'topo'] as BaseKey[]).map(k => (
              <button key={k} type="button" tabIndex={0} className={base === k ? 'is-active' : ''} aria-pressed={base === k} onClick={() => selectBase(k)}>
                {BASE_LABEL[k]}
              </button>
            ))}
          </div>
          <label className="sr-map-layers-trails">
            <input type="checkbox" checked={trails} onChange={toggleTrails} tabIndex={0} />
            Trails
          </label>
        </div>
      )}

      {children}
    </MapGL>
  )
}
