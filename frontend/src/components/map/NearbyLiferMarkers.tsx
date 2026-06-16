// Nearby-lifer markers (DOM <Marker> chips per location) for the Map Explorer's
// Nearby Lifers section. Cloned from TargetMarkers.tsx: one bounded DOM <Marker>
// per location (a real <button> via neutralizeMarkerWrapper, a labeled chip —
// the lifer's name, or "{n} species" for several — colored by the location's
// recency tier), and ONE lifted state-driven <Popup> listing each lifer at the
// selected location.
//
// Lifers are NOT in the user's recorded backbone, so every BirdName renders
// plain name + favicons with hasEntry={false} — never a Species Detail link.
// Rendered inside <SnowMap> (useMap context) — keep its call site (incl. the
// key on the count/viewMode) unchanged.

import { useEffect } from 'react'
import { Marker, Popup, useMap } from 'react-map-gl/maplibre'
import { neutralizeMarkerWrapper } from '../../lib/mapPins'
import { recencyTier, tierColors } from '../../lib/mapExplorerFormat'
import { formatDate } from '../../lib/formatDate'
import { BirdName } from '../BirdName'
import { ChecklistLink } from '../ChecklistLink'
import type { NearbyLiferLocation } from '../../lib/mapExplorerTypes'

export function NearbyLiferMarkers({ pins, speciesCodeMap, onOpenSpecies, sel, onSelect }: {
  pins: NearbyLiferLocation[]
  // name → eBird taxon code, for the BirdName favicons (a no-op when absent).
  speciesCodeMap: Record<string, string>
  onOpenSpecies?: (commonName: string) => void
  // Selection lifted to the parent (locId) so the "Nearby Lifers" sidebar list
  // opens the SAME popup a marker click shows — one owner, like the sighting,
  // hotspot, and target lists.
  sel: string | null
  onSelect: (locId: string | null) => void
}) {
  const map = useMap().current
  const fitKey = pins.length

  useEffect(() => {
    if (!map || pins.length === 0) return
    if (pins.length === 1) {
      map.flyTo({ center: [pins[0].lng, pins[0].lat], zoom: 12, duration: 0 })
    } else {
      let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity
      for (const p of pins) { minLng = Math.min(minLng, p.lng); maxLng = Math.max(maxLng, p.lng); minLat = Math.min(minLat, p.lat); maxLat = Math.max(maxLat, p.lat) }
      map.fitBounds([[minLng, minLat], [maxLng, maxLat]], { padding: 50, duration: 0 })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, fitKey])

  const selLoc = sel !== null ? pins.find(p => p.locId === sel) ?? null : null

  return (
    <>
      {pins.map((loc, i) => {
        const { bg, text } = tierColors(loc.tier)
        const single = loc.count === 1
        // Labeled chip like the Media Targets markers: the species name when a
        // spot has one lifer, "{n} species" when it has several.
        const label = single ? loc.lifers[0].comName : `${loc.count} species`
        const ariaLabel = single
          ? `${loc.lifers[0].comName}, a nearby lifer at ${loc.locName}`
          : `${loc.count} nearby lifers at ${loc.locName}`
        return (
          <Marker key={`${loc.locId}-${i}`} longitude={loc.lng} latitude={loc.lat} anchor="left"
            ref={neutralizeMarkerWrapper}
            onClick={e => { e.originalEvent.stopPropagation(); onSelect(loc.locId) }}>
            {/* Real <button> so Enter/Space open the popup (the native click
                bubbles to the wrapper's listener); the wrapper is demoted via
                ref. The label names the lifer (or the species count), colored by
                the location's recency tier — mirrors the Media Targets chips. */}
            <button type="button" aria-label={ariaLabel}
              style={{ display: 'inline-flex', alignItems: 'center', background: bg, color: text, padding: '3px 8px', borderRadius: 10, fontSize: '0.6875rem', fontWeight: 600, whiteSpace: 'nowrap', border: '1.5px solid rgba(255,255,255,0.85)', boxShadow: '0 2px 6px rgba(0,0,0,0.35),0 0 0 1px rgba(0,0,0,0.1)', cursor: 'pointer', fontFamily: 'inherit' }}>
              {label}
            </button>
          </Marker>
        )
      })}
      {selLoc && (
        <Popup longitude={selLoc.lng} latitude={selLoc.lat} anchor="bottom" offset={14} onClose={() => onSelect(null)} maxWidth="280px" closeOnClick={false}>
          <div style={{ minWidth: 200, maxWidth: 260 }}>
            <div className="sr-wrap-anywhere" style={{ fontSize: '0.6875rem', color: 'var(--sr-text-muted)', marginBottom: 8 }}>📍 {selLoc.locName}</div>
            {selLoc.lifers.map((lifer, j) => {
              const liferTier = recencyTier(lifer.recentDate)
              const { bg: dotBg } = tierColors(liferTier)
              const validSubId = /^S\d+$/.test(lifer.subId ?? '')
              return (
                <div key={lifer.speciesCode} style={{ paddingTop: j > 0 ? 8 : 0, marginTop: j > 0 ? 8 : 0, borderTop: j > 0 ? '1px solid var(--sr-border)' : 'none' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3, flexWrap: 'wrap' }}>
                    <span aria-hidden="true" style={{ flex: '0 0 auto', width: 9, height: 9, borderRadius: '50%', background: dotBg }} />
                    {/* hasEntry={false}: lifers aren't in the backbone, so plain
                        name + favicons, never a Species Detail link. */}
                    <BirdName commonName={lifer.comName} taxonCode={speciesCodeMap[lifer.comName]} hasEntry={false} onOpenSpecies={onOpenSpecies} size="sm" />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: validSubId ? 4 : 0, marginLeft: 15 }}>
                    <span style={{ fontSize: '0.625rem', color: 'var(--sr-text-muted)' }}>{formatDate(lifer.recentDate)}</span>
                  </div>
                  {validSubId && (
                    <div style={{ marginLeft: 15 }}>
                      <ChecklistLink submissionId={lifer.subId ?? ''} style={{ fontSize: '0.6875rem' }} />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </Popup>
      )}
    </>
  )
}
