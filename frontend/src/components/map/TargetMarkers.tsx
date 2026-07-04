// Target markers (DOM <Marker> chips per location group) for the Map Explorer
// (extracted from MapExplorer.tsx in a behavior-preserving split). Rendered
// inside <SnowMap> (useMap context) — keep its call site (incl.
// key={`${targetPins.length}-${targetViewMode}`}) unchanged.

import { useEffect, useMemo } from 'react'
import { Marker, Popup, useMap } from 'react-map-gl/maplibre'
import { neutralizeMarkerWrapper } from '../../lib/mapPins'
import { recencyTier, tierColors, escHtml, MEDIA_ICONS } from '../../lib/mapExplorerFormat'
import { formatDate } from '../../lib/formatDate'
import { BirdName } from '../BirdName'
import { ChecklistLink } from '../ChecklistLink'
import type { DisplayTargetPin } from '../../lib/mapExplorerTypes'
import type { MarkerMode } from './NearbyLiferMarkers'

export function TargetMarkers({ pins, speciesCodeMap, hasEntryFor, onOpenSpecies, sel, onSelect, markerMode = 'labels' }: {
  pins: DisplayTargetPin[]
  speciesCodeMap: Record<string, string>
  hasEntryFor: (name: string) => boolean
  onOpenSpecies?: (commonName: string) => void
  // Selection lifted to the parent (locId) so the "Nearest Targets" sidebar list
  // opens the SAME popup a marker click shows — one owner, like the sighting and
  // hotspot lists. (locId rather than the group index, so a sidebar row keyed by
  // species+loc can address the popup directly.)
  sel: string | null
  onSelect: (locId: string | null) => void
  // 'labels' = the full media-icon name chip; 'dots' = only the locator dot, the
  // (escaped) label hidden. The real <button> + aria-label + popup are unchanged.
  markerMode?: MarkerMode
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

  const locationGroups = useMemo(() => {
    const groups = new Map<string, DisplayTargetPin[]>()
    for (const pin of pins) {
      const existing = groups.get(pin.locId) ?? []
      existing.push(pin)
      groups.set(pin.locId, existing)
    }
    return [...groups.values()]
  }, [pins])

  const selGroup = sel !== null ? locationGroups.find(g => g[0]?.locId === sel) ?? null : null
  const selRep = selGroup ? selGroup.reduce((best, p) => p.recentDate > best.recentDate ? p : best) : null

  return (
    <>
      {locationGroups.map((group, i) => {
        const rep = group.reduce((best, p) => p.recentDate > best.recentDate ? p : best)
        const { bg, text } = tierColors(recencyTier(rep.recentDate))
        let labelHtml: string
        let ariaLabel: string
        if (group.length === 1) {
          const pin = group[0]
          const iconsHtml = pin.missingTypes.length > 0
            ? `<span style="display:inline-flex;align-items:center;gap:3px;margin-left:5px">${pin.missingTypes.map(t => MEDIA_ICONS[t]).join('')}</span>`
            : ''
          labelHtml = `${escHtml(pin.comName)}${iconsHtml}`
          const missing = pin.missingTypes.length > 0
            ? ` — missing ${pin.missingTypes.map(t => t.toLowerCase()).join(', ')}`
            : ''
          ariaLabel = `${pin.comName}${missing}, at ${rep.locName}`
        } else {
          labelHtml = `${group.length} species`
          ariaLabel = `${group.length} target species at ${rep.locName}`
        }
        const dots = markerMode === 'dots'
        return (
          <Marker key={`${rep.locId}-${i}`} longitude={rep.lng} latitude={rep.lat} anchor="left"
            ref={neutralizeMarkerWrapper}
            onClick={e => { e.originalEvent.stopPropagation(); onSelect(rep.locId) }}>
            {/* Real <button> so Enter/Space open the popup (the native click bubbles
                to the wrapper's listener); the wrapper is demoted via ref. An
                always-visible locator dot marks the exact coordinate; in Dots mode
                the label chip is hidden but the button, its aria-label, and popup
                are unchanged. The media-type SVGs inside labelHtml are aria-hidden
                and still emitted through escHtml — visibility is gated, escaping is
                NOT. F014/F045. */}
            <button type="button" aria-label={ariaLabel} className={dots ? 'sr-touch-target sr-map-icon-btn-touch' : 'sr-touch-target'}
              style={{ display: 'inline-flex', alignItems: 'center', gap: dots ? 0 : 6, padding: dots ? 7 : 0, border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: 'inherit' }}>
              <span aria-hidden="true" style={{ flex: '0 0 auto', width: 11, height: 11, borderRadius: '50%', background: bg, border: '2px solid rgba(255,255,255,0.95)', boxShadow: '0 1px 3px rgba(0,0,0,0.45)' }} />
              <span
                style={{ display: dots ? 'none' : 'inline-block', background: bg, color: text, padding: '3px 8px', borderRadius: 10, fontSize: '0.6875rem', fontWeight: 600, whiteSpace: 'nowrap', border: '1.5px solid rgba(255,255,255,0.85)', boxShadow: '0 2px 6px rgba(0,0,0,0.35),0 0 0 1px rgba(0,0,0,0.1)' }}
                dangerouslySetInnerHTML={{ __html: labelHtml }}
              />
            </button>
          </Marker>
        )
      })}
      {selGroup && selRep && (
        <Popup longitude={selRep.lng} latitude={selRep.lat} anchor="bottom" offset={14} onClose={() => onSelect(null)} maxWidth="min(280px, 80vw)">
              <div className="sr-map-popup-body" style={{ minWidth: 200, maxWidth: 260 }}>
                <div className="sr-wrap-anywhere" style={{ fontSize: '0.6875rem', color: 'var(--sr-text-muted)', marginBottom: 8 }}>📍 {selRep.locName}</div>
                {selGroup.map((pin, j) => {
                  const pinTier = recencyTier(pin.recentDate)
                  const { bg: pinBg, text: pinText } = tierColors(pinTier)
                  const tierLabel = pinTier === 'fresh' ? '≤7 days' : pinTier === 'mid' ? '8–15 days' : '16–30 days'
                  const validSubId = /^S\d+$/.test(pin.subId ?? '')
                  return (
                    <div key={pin.speciesCode} style={{ paddingTop: j > 0 ? 8 : 0, marginTop: j > 0 ? 8 : 0, borderTop: j > 0 ? '1px solid var(--sr-border)' : 'none' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 3, flexWrap: 'wrap' }}>
                        <BirdName commonName={pin.comName} taxonCode={speciesCodeMap[pin.comName]} hasEntry={hasEntryFor(pin.comName)} onOpenSpecies={onOpenSpecies} size="sm" />
                        {pin.missingTypes.map(t => (
                          <span key={t} role="img" aria-label={`Missing ${t.toLowerCase()}`} style={{ display: 'inline-flex', alignItems: 'center', padding: '0 4px', background: 'var(--sr-surface-subtle)', borderRadius: 4, fontSize: '0.625rem', color: 'var(--sr-text-muted)', gap: 2 }}>
                            {t === 'Photo' && <svg aria-hidden="true" width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/></svg>}
                            {t === 'Audio' && <svg aria-hidden="true" width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/></svg>}
                            {t === 'Video' && <svg aria-hidden="true" width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m22 8-6 4 6 4V8z"/><rect width="14" height="12" x="2" y="6" rx="2" ry="2"/></svg>}
                          </span>
                        ))}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: validSubId ? 4 : 0 }}>
                        <span style={{ display: 'inline-block', background: pinBg, color: pinText, padding: '1px 6px', borderRadius: 6, fontSize: '0.625rem', fontWeight: 600 }}>{tierLabel}</span>
                        <span style={{ fontSize: '0.625rem', color: 'var(--sr-text-muted)' }}>{formatDate(pin.recentDate)}</span>
                      </div>
                      {validSubId && (
                        <ChecklistLink submissionId={pin.subId ?? ''} compact style={{ fontSize: '0.6875rem' }} />
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
