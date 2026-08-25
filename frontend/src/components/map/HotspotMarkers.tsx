// Hotspot markers (GL teardrop symbols) for the Map Explorer (extracted from
// MapExplorer.tsx in a behavior-preserving split). Rendered inside <SnowMap>
// (useMap context) — keep its call site (incl. key={hotspotPins.length}) unchanged.

import { useEffect, useMemo, type ReactNode } from 'react'
import { Source, Layer, Popup, useMap } from 'react-map-gl/maplibre'
import type { ExpressionSpecification, FilterSpecification, MapMouseEvent, MapStyleImageMissingEvent, SymbolLayerSpecification } from 'maplibre-gl'
import type { FeatureCollection, Point } from 'geojson'
import {
  HOTSPOT_KINDS, HOTSPOT_IMAGE_ID, teardropImageData, updateMapCursor,
  HOTSPOT_MODE_SPRITE_KEYS, HOTSPOT_MODE_IMAGE_ID, modeTeardropImageData,
  type HotspotKind, type HotspotModeSpriteKey,
} from '../../lib/mapPins'
import { hatchPixelRatio } from '../../lib/atlasTextures'
import { formatDate } from '../../lib/formatDate'
import { OutboundLink } from '../OutboundLink'
import type { HotspotPin } from '../../lib/mapExplorerTypes'

/** Reverse sprite lookup: image id → hotspot kind, null for ids that aren't
 *  ours (the styleimagemissing safety net must ignore foreign ids — other
 *  layers may legitimately miss images). */
// eslint-disable-next-line react-refresh/only-export-components -- pure lookup tested directly; lives here beside the handler that wraps it
export function hotspotKindForImage(id: string): HotspotKind | null {
  for (const kind of HOTSPOT_KINDS) {
    if (HOTSPOT_IMAGE_ID[kind] === id) return kind
  }
  return null
}

/** Reverse mode-sprite lookup: image id → mode sprite key, null for foreign
 *  ids — the same ownership contract as hotspotKindForImage, extended over the
 *  color-mode sprite table (NFR-03). */
// eslint-disable-next-line react-refresh/only-export-components -- pure lookup tested directly; lives here beside the handler that wraps it
export function hotspotModeSpriteKeyForImage(id: string): HotspotModeSpriteKey | null {
  for (const key of HOTSPOT_MODE_SPRITE_KEYS) {
    if (HOTSPOT_MODE_IMAGE_ID[key] === id) return key
  }
  return null
}

// The mode icon-image expression: a match over the `cls` feature property.
// Personal pins keep the SHIPPED personal sprite (FR-21); the fallback is the
// neutral unanswered-unvisited so a defect renders as "not checked", never as
// a value. Module-level constant — it depends on nothing per-render.
const MODE_ICON_IMAGE = [
  'match', ['get', 'cls'],
  ...HOTSPOT_MODE_SPRITE_KEYS.flatMap(key => [key, HOTSPOT_MODE_IMAGE_ID[key]]),
  'personal', HOTSPOT_IMAGE_ID.personal,
  HOTSPOT_MODE_IMAGE_ID['unanswered-unvisited'],
] as unknown as ExpressionSpecification

export function HotspotMarkers({ pins, hiddenKinds, sel, onSelect, autoFit = true, modeCls = null, popupExtra }: {
  pins: HotspotPin[]
  hiddenKinds: Set<HotspotPin['kind']>
  // Lifted to the parent (locId) so the keyboard sidebar list and the teardrop
  // click open the same <Popup>. (locId, not array index — the index broke when
  // kinds were hidden.)
  sel: string | null
  onSelect: (locId: string | null) => void
  /**
   * Frame the results when the pin count changes. Default TRUE, so every shipped
   * route (the sidebar Find button, the place-name search, "Use my location", a
   * dropped or dragged centre pin, a view-mode change) behaves exactly as it
   * always has — each of those sets a centre that may be nowhere near the screen,
   * and framing is the only way the user sees what they asked for.
   *
   * FALSE for one caller: a search whose centre and radius were DERIVED FROM the
   * current viewport ("Search this area"). Two reasons, and the first is a bug
   * this fixes rather than a preference.
   *
   * 1. THE FEEDBACK LOOP. The derived radius covers the viewport, and this fit
   *    sets the viewport to cover the results, and the results span the searched
   *    circle. A rectangle circumscribing points spread across a circle of radius
   *    r has a half-diagonal approaching r*sqrt(2), so the post-fit viewport is
   *    reliably LARGER than the circle just searched and the next derived rung
   *    comes out one step higher. The control, which is offered exactly when the
   *    derived values differ from the recorded ones, therefore re-offered itself
   *    immediately after every successful press, and each press ratcheted the
   *    radius (5 -> 10 -> 25) for one unrequested lookup per step. Measured: a
   *    press sending dist=16 re-framed zoom 11.276 -> 10.321 and the next press
   *    sent dist=40. No geometric predicate can fix that, because the app's own
   *    re-frame and a deliberate user zoom-out produce the same viewport; the
   *    only honest cut is not to move the map in the first place.
   * 2. THERE IS NOTHING TO FRAME. When the framing produced the search, the
   *    results are already on screen by construction — that is FR-08's covering
   *    invariant. And in the capped case (FR-09) the re-frame actively destroys
   *    the one thing the drawn circle exists to say: it zooms to the results, so
   *    the circle that should read visibly smaller than the screen ends up
   *    matching it, and the user never sees that the answer was partial.
   */
  autoFit?: boolean
  /**
   * Color-coded hotspots (feature): locId → mode sprite key while a color mode
   * is active; null/absent = the DEFAULT mode, whose render path is
   * byte-identical to the pre-mode build (FR-03 — the regression guard in
   * HotspotMarkers.test.tsx pins the layout, filter, and feature properties).
   * A PROP, never folded into the marker set's remount key: a mode/window
   * switch is a cosmetic in-place re-render — no remount, no re-fit, no popup
   * dismissal (NFR-04, the v0.5.59 markerMode rule).
   */
  modeCls?: ReadonlyMap<string, string> | null
  /**
   * The popup's mode line (FR-25), rendered directly under the hotspot name
   * while a mode is active. Owned by the parent so the popup, legend, and
   * in-view list all derive from the SAME hotspotReading source (NFR-10).
   * Absent → the shipped popup, unchanged.
   */
  popupExtra?: (pin: HotspotPin) => ReactNode
}) {
  const map = useMap().current
  const fitKey = pins.length

  // `autoFit` is deliberately NOT in the dep list. React re-creates this closure
  // every render but only RUNS it when a dep changes, so the guard reads the
  // current value at the moment a new pin set arrives — while a later flip of the
  // flag on its own cannot retro-frame a result set that has already landed.
  useEffect(() => {
    if (!map || pins.length === 0 || !autoFit) return
    if (pins.length === 1) {
      map.flyTo({ center: [pins[0].lng, pins[0].lat], zoom: 12, duration: 0 })
    } else {
      let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity
      for (const p of pins) { minLng = Math.min(minLng, p.lng); maxLng = Math.max(maxLng, p.lng); minLat = Math.min(minLat, p.lat); maxLat = Math.max(maxLat, p.lat) }
      map.fitBounds([[minLng, minLat], [maxLng, maxLat]], { padding: 50, duration: 0 })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, fitKey])

  // One GL symbol layer over a GeoJSON source replaces the per-pin DOM teardrop
  // divs (hundreds of positioned nodes re-laid-out every frame during pan/zoom).
  // With a color mode active each feature gains a `cls` property (its mode
  // sprite key); in default mode the properties are exactly {locId, kind} —
  // byte-identical to the shipped build (FR-03).
  const fc = useMemo<FeatureCollection<Point, { locId: string; kind: HotspotPin['kind']; cls?: string }>>(() => ({
    type: 'FeatureCollection',
    features: pins.map(p => {
      const cls = modeCls?.get(p.locId)
      return {
        type: 'Feature' as const,
        properties: cls !== undefined ? { locId: p.locId, kind: p.kind, cls } : { locId: p.locId, kind: p.kind },
        geometry: { type: 'Point' as const, coordinates: [p.lng, p.lat] },
      }
    }),
  }), [pins, modeCls])

  // Register the teardrop sprites at effect time; regenerate on a light/dark
  // theme change (colors read the --sr-map-* tokens at bake time — same
  // contract as the atlas hatch sprites). addImage needs only a style object,
  // not a "loaded" style — do NOT gate this on isStyleLoaded() (false during
  // ANY tile/source churn, e.g. right after a base-layer switch) with a
  // once('load') fallback: `load` fires once per map LIFETIME, so a listener
  // armed later never fires and the symbol layer silently renders nothing.
  useEffect(() => {
    if (!map) return
    let cancelled = false
    const addAll = () => {
      if (cancelled) return
      const dpr = hatchPixelRatio()
      for (const kind of HOTSPOT_KINDS) {
        const id = HOTSPOT_IMAGE_ID[kind]
        const img = teardropImageData(kind, dpr)
        if (map.hasImage(id)) map.updateImage(id, img)
        else map.addImage(id, img, { pixelRatio: dpr })
      }
      // The color-mode sprites, registered UNCONDITIONALLY beside the kind
      // trio (never gated on the active mode or isStyleLoaded — the shipped
      // contract): a mode switch is then a pure icon-image swap with every
      // sprite already present, and the theme MutationObserver re-bake below
      // covers the whole table.
      for (const key of HOTSPOT_MODE_SPRITE_KEYS) {
        const id = HOTSPOT_MODE_IMAGE_ID[key]
        const img = modeTeardropImageData(key, dpr)
        if (map.hasImage(id)) map.updateImage(id, img)
        else map.addImage(id, img, { pixelRatio: dpr })
      }
    }
    addAll()
    // Safety net (MapLibre's canonical mechanism): if the style ever asks for
    // one of OUR sprites before addAll has run — a style swap, an ordering we
    // haven't met — bake and add that image on demand. Foreign ids are ignored
    // (both reverse lookups answer ONLY this component's own hardcoded ids).
    const onMissing = (e: MapStyleImageMissingEvent) => {
      if (cancelled) return
      if (map.hasImage(e.id)) return
      const kind = hotspotKindForImage(e.id)
      if (kind) {
        const dpr = hatchPixelRatio()
        map.addImage(e.id, teardropImageData(kind, dpr), { pixelRatio: dpr })
        return
      }
      const modeKey = hotspotModeSpriteKeyForImage(e.id)
      if (modeKey) {
        const dpr = hatchPixelRatio()
        map.addImage(e.id, modeTeardropImageData(modeKey, dpr), { pixelRatio: dpr })
      }
    }
    map.on('styleimagemissing', onMissing)
    const obs = new MutationObserver(addAll)
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => { cancelled = true; obs.disconnect(); map.off('styleimagemissing', onMissing) }
  }, [map])

  // Click selects the top teardrop's hotspot; empty-map click closes the popup.
  useEffect(() => {
    if (!map) return
    const onClick = (e: MapMouseEvent) => {
      if (!map.getLayer('sr-hotspot')) return
      const f = map.queryRenderedFeatures(e.point, { layers: ['sr-hotspot'] })[0]
      const locId = (f?.properties as { locId?: unknown } | undefined)?.locId
      onSelect(typeof locId === 'string' && locId !== '' ? locId : null)
    }
    // Cursor goes through the shared arbiter (see SightingMarkers).
    const hover = (e: MapMouseEvent) => updateMapCursor(map, e.point)
    map.on('click', onClick)
    map.on('mouseenter', 'sr-hotspot', hover)
    map.on('mouseleave', 'sr-hotspot', hover)
    return () => {
      map.off('click', onClick)
      map.off('mouseenter', 'sr-hotspot', hover)
      map.off('mouseleave', 'sr-hotspot', hover)
      map.getCanvas().style.cursor = ''
    }
  }, [map, onSelect])

  // Hidden legend kinds drop out via a layer filter (no source rebuild). With
  // nothing hidden this is !(kind in []) — always true.
  const hotspotFilter = useMemo(
    () => ['!', ['in', ['get', 'kind'], ['literal', [...hiddenKinds]]]] as unknown as FilterSpecification,
    [hiddenKinds],
  )

  // Default mode: the SHIPPED expression, byte-identical (FR-03 — the
  // regression guard pins it). Mode active: a match over the per-feature cls.
  const symbolLayout: SymbolLayerSpecification['layout'] = {
    'icon-image': modeCls
      ? MODE_ICON_IMAGE
      : ['match', ['get', 'kind'], 'visited', HOTSPOT_IMAGE_ID.visited, 'unvisited', HOTSPOT_IMAGE_ID.unvisited, HOTSPOT_IMAGE_ID.personal],
    'icon-anchor': 'bottom',
    // DOM markers always showed every pin regardless of overlap; keep that.
    'icon-allow-overlap': true,
    'icon-ignore-placement': true,
  }

  const selPin = sel !== null ? pins.find(p => p.locId === sel && !hiddenKinds.has(p.kind)) ?? null : null

  return (
    <>
      <Source id="sr-hotspot" type="geojson" data={fc}>
        <Layer id="sr-hotspot" type="symbol" layout={symbolLayout} filter={hotspotFilter} />
      </Source>
      {selPin && (
        <Popup longitude={selPin.lng} latitude={selPin.lat} anchor="bottom" offset={42} onClose={() => onSelect(null)} closeButton={false} closeOnClick={false} maxWidth="260px">
          <div style={{ minWidth: 190 }}>
            <div className="sr-wrap-anywhere" style={{ fontWeight: 700, fontSize: '0.8125rem', marginBottom: 8 }}>{selPin.locName}</div>
            {/* The mode line (FR-25) — parent-owned so every surface reads the
                same hotspotReading; absent in default mode (shipped popup). */}
            {popupExtra?.(selPin)}
            {selPin.kind === 'visited' && (
              <>
                <div style={{ fontSize: '0.75rem', color: 'var(--sr-accent)', marginBottom: 3 }}>{selPin.speciesCount} species recorded</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--sr-text-muted)', marginBottom: 8 }}>Last visit: {formatDate(selPin.lastVisit)}</div>
                <OutboundLink href={`https://ebird.org/hotspot/${selPin.locId}`} style={{ fontSize: '0.75rem', color: 'var(--sr-accent)', textDecoration: 'none', fontWeight: 500 }}>View on eBird <span aria-hidden="true">→</span></OutboundLink>
              </>
            )}
            {selPin.kind === 'unvisited' && (
              <OutboundLink href={`https://ebird.org/hotspot/${selPin.locId}`} style={{ fontSize: '0.75rem', color: 'var(--sr-accent)', textDecoration: 'none', fontWeight: 500 }}>View on eBird <span aria-hidden="true">→</span></OutboundLink>
            )}
            {selPin.kind === 'personal' && (
              <>
                <div style={{ display: 'inline-block', background: 'var(--sr-is-target-bg)', border: '1px solid var(--sr-warning-subtle)', color: 'var(--sr-is-target-text)', borderRadius: 4, padding: '2px 6px', fontSize: '0.6875rem', fontWeight: 600, marginBottom: 8 }}>Personal Location</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--sr-text-muted)', marginBottom: 3 }}>{selPin.obsCount} observation{selPin.obsCount !== 1 ? 's' : ''}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--sr-text-muted)' }}>Last visit: {formatDate(selPin.lastVisit)}</div>
              </>
            )}
          </div>
        </Popup>
      )}
    </>
  )
}
