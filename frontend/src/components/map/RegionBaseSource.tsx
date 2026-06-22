// RegionBaseSource — Tier-B offline region rendering (FR-11/FR-17/OQ-09).
//
// When the user is offline AND inside a downloaded region (and offline-maps is
// enabled), this points the vector base source (`openmaptiles`, the OpenFreeMap
// Positron source every base layer references) at that region's LOCAL `srpm://`
// tiles via `VectorTileSource.setTiles` — so the existing tuned Positron layers
// re-render from on-disk tiles with no network. On leaving coverage / going back
// online it restores the original online tiles. Outside any region it does
// nothing, so the Tier-A persisted base remains (local data layers still draw).
//
// It is the ONE component that imports the lazy `mapPmtiles` module (which pulls
// `pmtiles` + registers the protocols), so importing it keeps that machinery in
// the lazy map chunk, never the entry chunk (NFR-15). It self-gates: with the
// offline-maps toggle off (the default) or no downloaded regions, it adds no map
// listeners and never touches the base source — the universal case today, so a
// region bake is what completes end-to-end rendering (verified at release with
// real baked county/state PMTiles, not on the build VM where the catalog is
// empty).
//
// Renders nothing (it mutates the existing source in place rather than mounting
// a parallel <Source>, which would need a duplicate layer stack and could throw
// the `source id changed` error on a base switch).

import { useEffect, useRef, useState } from 'react'
import { useMap } from 'react-map-gl/maplibre'
import { srpmTilesUrl, releaseRegion } from '../../lib/mapPmtiles'
import { pickActiveRegion, isOfflineMapsEnabled } from '../../lib/regionDownload'
import { storage, type RegionEntry } from '../../lib/storage'

// The Positron vector source id every tuned base layer references (mapStyle.ts).
const BASE_SOURCE_ID = 'openmaptiles'

// The maplibre VectorTileSource surface we touch — narrowed so we never assume
// more than setTiles/setUrl and the original config we capture to restore.
interface SwappableSource {
  setTiles?: (tiles: string[]) => void
  setUrl?: (url: string) => void
  tiles?: string[]
  url?: string
}

export function RegionBaseSource() {
  const map = useMap().current
  // Mirror of the `offline-maps-enabled` setting (FR-11a). Default OFF → inert
  // until the user turns offline maps on in Settings.
  const [enabled, setEnabled] = useState(false)
  const [regions, setRegions] = useState<RegionEntry[]>([])
  const [offline, setOffline] = useState(() => typeof navigator !== 'undefined' && navigator.onLine === false)
  // The region currently swapped in, and the original online source config to
  // restore when leaving coverage. Refs (not state) so the swap effect doesn't
  // re-run on its own writes.
  const activeRef = useRef<string | null>(null)
  const originalRef = useRef<{ tiles?: string[]; url?: string } | null>(null)

  // Read the opt-in once on mount (the map remounts on tab switch, so a Settings
  // change is picked up next time the map opens).
  useEffect(() => {
    let cancelled = false
    isOfflineMapsEnabled().then((v) => { if (!cancelled) setEnabled(v) }).catch(() => {})
    return () => { cancelled = true }
  }, [])

  // Load the downloaded-region manifest when enabled (desktop only; the web seam
  // returns an empty manifest, so this stays empty there — FR-20). `regions`
  // starts empty and `enabled` only flips on once, so the disabled case needs no
  // synchronous clear (it is already empty, and the swap effect gates on enabled).
  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    storage.getRegionsManifest()
      .then((m) => { if (!cancelled) setRegions(m.regions) })
      .catch(() => { /* no manifest yet → no regions */ })
    return () => { cancelled = true }
  }, [enabled])

  // Track connectivity (advisory — FR-36); a change re-runs the swap effect.
  useEffect(() => {
    const goOnline = () => setOffline(false)
    const goOffline = () => setOffline(true)
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [])

  // The swap. Recomputed on enable/regions/offline change and on every moveend.
  useEffect(() => {
    // Fully inert unless there's something to serve — no listeners, no source
    // touch. This is the only path reachable until a region is downloaded.
    if (!map || !enabled || regions.length === 0) return

    const apply = () => {
      const center = map.getCenter()
      const active = pickActiveRegion(center.lng, center.lat, regions, { offline, enabled })
      const targetId = active?.regionId ?? null
      if (targetId === activeRef.current) return // nothing changed

      const src = map.getSource(BASE_SOURCE_ID) as SwappableSource | undefined
      if (!src || typeof src.setTiles !== 'function') return // base not ready yet

      if (targetId) {
        // Capture the original online config ONCE so we can restore it on exit.
        if (!originalRef.current) originalRef.current = { tiles: src.tiles, url: src.url }
        src.setTiles([srpmTilesUrl(targetId)])
      } else if (originalRef.current) {
        // Left coverage / back online → restore the online base.
        if (originalRef.current.tiles) src.setTiles(originalRef.current.tiles)
        else if (originalRef.current.url && src.setUrl) src.setUrl(originalRef.current.url)
      }

      // Free the archive cache of the region we just left.
      if (activeRef.current && activeRef.current !== targetId) releaseRegion(activeRef.current)
      activeRef.current = targetId
    }

    apply()
    map.on('moveend', apply)
    // The persistent map can swap styles under us (base switch); re-apply when the
    // style settles so a freshly-(re)added openmaptiles source gets the region.
    map.on('styledata', apply)
    return () => {
      map.off('moveend', apply)
      map.off('styledata', apply)
    }
  }, [map, enabled, regions, offline])

  return null
}
