// Thin shared wrapper around react-map-gl (MapLibre). Uses ONE persistent style
// (the tuned OpenFreeMap vector base) and toggles satellite/topo/trails as
// layers within it — so no source ever disappears (the water mask always has
// its geometry) and base switches preserve pan/zoom. Optional brand-styled base
// switcher (Map / Satellite / Topo + Trails), zoom controls, and auto-resize.

import 'maplibre-gl/dist/maplibre-gl.css'
import { useEffect, useId, useMemo, useState, type ReactNode } from 'react'
import MapGL, { NavigationControl, AttributionControl, Source, Layer } from 'react-map-gl/maplibre'
import type { StyleSpecification, Map as MaplibreMap } from 'maplibre-gl'
import { storage } from '../lib/storage'
import {
  fetchTunedBaseStyle, firstSymbolLayerId, RASTER_BASES, VOID_COLOR, BASE_LABEL,
  DEFAULT_BASE, BASE_SETTING, TRAILS_SETTING, TRAILS_TILES, TRAILS_ATTRIB,
  type VectorVariant, type BaseKey,
} from '../lib/mapStyle'
import { readPersistedStyle, persistStyle, revalidateStyleOnce } from '../lib/persistedStyle'

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
  /** Enable MapLibre's cooperative-gestures mode: on touch the map pans only with
   *  two fingers (one-finger drag scrolls the PAGE) and zooms only with ctrl+wheel,
   *  so a page-embedded map can't scroll-trap a phone. Desktop click-drag pan is
   *  unaffected. Set true on maps that sit mid-flow in a scrollable page (Species
   *  Detail's Sighting Locations map); leave false on the full-screen Map Explorer
   *  where the map IS the primary interaction. Pairs with scrollZoom={false}. */
  cooperativeGestures?: boolean
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

export function SnowMap({ initialViewState, style, children, onLoad, switcher, scrollZoom, cooperativeGestures }: SnowMapProps) {
  const [base, setBase] = useState<BaseKey>(DEFAULT_BASE)
  const [trails, setTrails] = useState(false)
  // Advisory offline hint for the raster base controls ONLY (FR-07/FR-36). The
  // raster bases (Satellite/Topo/Trails) have no durable tile cache, so an
  // offline switch would paint blank tiles — disable them while offline with an
  // honest cue, keeping the vector base active and the map mounted. navigator.onLine
  // is a UI hint, never a hard gate on a real request. The vector base persists,
  // so 'positron' stays selectable offline.
  const [offline, setOffline] = useState(() => typeof navigator !== 'undefined' && navigator.onLine === false)
  // Stable id so the disabled raster-base controls can point aria-describedby at
  // the visible offline cue (FR-07/NFR-09 — the reason is exposed to AT, not a
  // title-only tooltip invisible to keyboard/touch).
  const offlineCueId = useId()
  const [mapStyle, setMapStyle] = useState<StyleSpecification | null>(cache.get('positron') ?? null)
  const [loadError, setLoadError] = useState(false)
  const [attempt, setAttempt] = useState(0)

  // Seed-before-fetch (FR-02, the QA-01 ordering artifact): await the persisted
  // style FIRST so the map mounts offline; only on a miss do we touch the network
  // path. Sequential, never parallel — a parallel fetch would defeat offline.
  useEffect(() => {
    if (mapStyle) return
    let cancelled = false
    const variant: VectorVariant = 'positron'
    void (async () => {
      const persisted = await readPersistedStyle(variant)
      if (cancelled) return
      if (persisted) {
        // Mount from the offline copy immediately…
        setMapStyle(persisted.style as StyleSpecification)
        // …then refresh the persisted blob for NEXT launch — non-blocking,
        // does NOT setMapStyle (no mid-session flicker), at most once/session.
        revalidateStyleOnce(variant, () => getVectorStyle(variant))
        return
      }
      // No persisted copy → the existing network path.
      getVectorStyle(variant)
        .then(s => {
          if (cancelled) return
          setMapStyle(s)
          void persistStyle(variant, s) // persist for next launch
        })
        .catch(() => { if (!cancelled) setLoadError(true) })
    })()
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

  // Track connectivity for the raster-base advisory cue only (FR-07). Re-enable
  // the raster controls when back online; clean up the listeners on unmount.
  useEffect(() => {
    if (!switcher) return
    const onOnline = () => setOffline(false)
    const onOffline = () => setOffline(true)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [switcher])

  // Place raster bases under the vector labels so labels stay readable on top.
  const beforeLabels = useMemo(() => (mapStyle ? firstSymbolLayerId(mapStyle) : undefined), [mapStyle])

  const selectBase = (k: BaseKey) => { setBase(k); if (switcher) void storage.setSetting(BASE_SETTING, k) }
  const toggleTrails = () => setTrails(prev => { const next = !prev; if (switcher) void storage.setSetting(TRAILS_SETTING, next); return next })

  // The app never uses bearing or pitch, and the compass reset is hidden
  // (showCompass={false}), so leaving rotate/pitch armed strands a touch user
  // who twists/tilts with no single-pointer reset (WCAG 2.5.1, F056). dragRotate/
  // touchPitch/pitchWithRotate are turned off as MapGL props; pinch rotation is
  // disabled here in load (NOT touchZoomRotate={false}, which kills pinch ZOOM).
  // keyboard.disableRotation() only zeroes Shift+arrow bearing/pitch — plain
  // arrows still pan.
  const handleLoad = (e: { target: MaplibreMap }) => {
    e.target.touchZoomRotate.disableRotation()
    e.target.keyboard.disableRotation()
    onLoad?.(e)
  }

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
      // Default control disabled; the explicit one below sits bottom-LEFT so the
      // Map Explorer's bottom-right FAB cluster can't partially obscure the
      // attribution toggle below the 24×24 target-size minimum (F094).
      attributionControl={false}
      scrollZoom={scrollZoom}
      cooperativeGestures={cooperativeGestures}
      dragRotate={false}
      touchPitch={false}
      pitchWithRotate={false}
      onLoad={handleLoad as never}
    >
      <NavigationControl position="top-left" showCompass={false} />
      <AttributionControl position="bottom-left" compact />

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
        <div className="sr-map-layers" style={{ position: 'absolute', top: 8, right: 8, zIndex: 1, maxWidth: 'calc(100vw - 16px)' }}>
          <div className="sr-map-layers-seg" role="group" aria-label="Base map">
            {(['positron', 'satellite', 'topo'] as BaseKey[]).map(k => {
              // The vector base (positron) stays usable offline; raster bases have
              // no durable tile cache, so they're disabled offline (FR-07).
              const rasterOffline = offline && k !== 'positron'
              return (
                <button
                  key={k}
                  type="button"
                  tabIndex={rasterOffline ? -1 : 0}
                  className={base === k ? 'is-active' : ''}
                  // A disabled raster base is neither a toggle nor a tab stop, so it
                  // drops aria-pressed; the offline reason is exposed via the visible
                  // cue (aria-describedby), not a title-only tooltip (FR-07/NFR-09).
                  aria-pressed={rasterOffline ? undefined : base === k}
                  disabled={rasterOffline}
                  aria-disabled={rasterOffline || undefined}
                  aria-describedby={rasterOffline ? offlineCueId : undefined}
                  title={rasterOffline ? `${BASE_LABEL[k]} is unavailable offline` : undefined}
                  aria-label={rasterOffline ? `${BASE_LABEL[k]} — unavailable offline` : undefined}
                  onClick={() => { if (!rasterOffline) selectBase(k) }}
                  style={rasterOffline ? { opacity: 0.5, cursor: 'not-allowed', color: 'var(--sr-text-disabled)' } : undefined}
                >
                  {BASE_LABEL[k]}
                </button>
              )
            })}
          </div>
          <label
            className="sr-map-layers-trails"
            title={offline ? 'Trails are unavailable offline' : undefined}
            style={offline ? { opacity: 0.5, cursor: 'not-allowed', color: 'var(--sr-text-disabled)' } : undefined}
          >
            <input
              type="checkbox"
              checked={trails && !offline}
              onChange={toggleTrails}
              disabled={offline}
              aria-disabled={offline || undefined}
              aria-describedby={offline ? offlineCueId : undefined}
              aria-label={offline ? 'Trails — unavailable offline' : 'Trails'}
              tabIndex={offline ? -1 : 0}
            />
            Trails
          </label>
          {/* Honest cue, conveyed by text (not color alone) — present only while
              offline so the raster controls' disabled state is explained (NFR-09).
              Referenced by aria-describedby from each disabled raster control. */}
          {offline && (
            <span id={offlineCueId} role="status" style={{ fontSize: '0.6875rem', color: 'var(--sr-text-muted)', lineHeight: 1.4, maxWidth: 180 }}>
              You're offline — Satellite, Topo, and Trails need a connection.
            </span>
          )}
        </div>
      )}

      {children}
    </MapGL>
  )
}
