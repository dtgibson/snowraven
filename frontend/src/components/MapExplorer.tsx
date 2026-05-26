import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import { MapContainer, TileLayer, CircleMarker, Popup, Marker, useMap } from 'react-leaflet'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AlertCircle, Camera, ChevronDown, Filter, Loader2, MapPin, Navigation, Search, X } from 'lucide-react'
import { SetupRequired } from './SetupRequired'
import { parseEbirdObservations } from '../lib/parseEbirdObservations'
import { parseMLExport } from '../lib/parseMLExport'
import type { MLExportRow } from '../lib/parseMLExport'
import type { ObservationEntry } from '../types'
import { BREEDING_CODES } from '../lib/breedingCodes'
import { transport, TransportError } from '../lib/transport'
import { storage } from '../lib/storage'

// Leaflet marker icon patch for Vite asset handling
// eslint-disable-next-line @typescript-eslint/no-explicit-any
delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

// Teardrop SVG path (28×40 viewBox) — circle top, pointed bottom
const TEARDROP = 'M14 0C6.268 0 0 6.268 0 14c0 5.47 3.078 10.23 7.602 12.651L14 40l6.398-13.349A13.944 13.944 0 0028 14C28 6.268 21.732 0 14 0z'

function makeTeardropIcon(colorVar: string, glyphSvg: string): L.DivIcon {
  return L.divIcon({
    html: `<svg viewBox="0 0 28 40" width="28" height="40" xmlns="http://www.w3.org/2000/svg"><path d="${TEARDROP}" style="fill:${colorVar}"/>${glyphSvg}</svg>`,
    className: '',
    iconSize: [28, 40],
    iconAnchor: [14, 40],
    popupAnchor: [0, -44],
  })
}

// Module-level icons — created once, CSS vars resolve at browser paint time
const VISITED_ICON = makeTeardropIcon(
  'var(--sr-map-visited)',
  '<polyline points="8,15 12,19 20,11" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>',
)
const UNVISITED_ICON = makeTeardropIcon(
  'var(--sr-map-unvisited)',
  '<circle cx="10" cy="13" r="3.5" fill="white"/><circle cx="18" cy="13" r="3.5" fill="white"/>',
)
const PERSONAL_ICON = makeTeardropIcon(
  'var(--sr-map-personal)',
  '<polygon points="14,6 15.5,11 20.5,11 16.5,14.2 18,19 14,16 10,19 11.5,14.2 7.5,11 12.5,11" fill="white"/>',
)

const heatLoaded = { current: false }

// ── Types ─────────────────────────────────────────────────────────────────────

type ViewMode = 'sightings' | 'hotspots' | 'targets'
type DisplayMode = 'pins' | 'heatmap'

type MapPhase =
  | { tag: 'loading-saved' }
  | { tag: 'setup-required' }
  | { tag: 'ready'; observations: ObservationEntry[]; mlRows: MLExportRow[]; hasML: boolean }

type BreedingFilter = 'all' | 'possible' | 'probable' | 'confirmed'
type MediaFilter = 'any' | 'photo' | 'audio' | 'video' | 'none'

type HotspotPin =
  | { kind: 'visited';   locId: string; locName: string; lat: number; lng: number; speciesCount: number; lastVisit: string }
  | { kind: 'unvisited'; locId: string; locName: string; lat: number; lng: number }
  | { kind: 'personal';  locId: string; locName: string; lat: number; lng: number; obsCount: number; lastVisit: string }

interface TargetPin {
  speciesCode: string
  comName: string
  locId: string
  locName: string
  lat: number
  lng: number
  recentDate: string
  checklistCount: number
  subId: string
}

type DisplayTargetPin = TargetPin & { missingTypes: ('Photo' | 'Audio' | 'Video')[] }

const MEDIA_ICONS: Record<'Photo' | 'Audio' | 'Video', string> = {
  Photo: `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/></svg>`,
  Audio: `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/></svg>`,
  Video: `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m22 8-6 4 6 4V8z"/><rect width="14" height="12" x="2" y="6" rx="2" ry="2"/></svg>`,
}

type RecencyTier = 'fresh' | 'mid' | 'old'

interface LocationGroup {
  locId: string
  locName: string
  lat: number
  lng: number
  count: number
  species: Set<string>
  lastDate: string
}

interface MapExplorerProps {
  onGoToSettings: () => void
  onNavigateToMediaList: () => void
  keysVersion?: number
}

// ── Constants ──────────────────────────────────────────────────────────────────

const POSSIBLE_CODES  = new Set(BREEDING_CODES.filter(d => d.tier === 1).map(d => d.code))
const PROBABLE_CODES  = new Set(BREEDING_CODES.filter(d => d.tier === 2 || d.tier === 3).map(d => d.code))
const CONFIRMED_CODES = new Set(BREEDING_CODES.filter(d => d.tier === 4).map(d => d.code))

// ── Helpers ────────────────────────────────────────────────────────────────────

function pinRadius(count: number): number {
  if (count >= 200) return 22
  if (count >= 100) return 18
  if (count >= 50)  return 15
  return 12
}

function pinOpacity(count: number): number {
  if (count >= 200) return 0.95
  if (count >= 100) return 0.88
  if (count >= 50)  return 0.82
  return 0.78
}

function distanceMiles(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3958.8
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function recencyTier(recentDate: string): RecencyTier {
  const dateStr = recentDate.split(' ')[0]
  const [y, m, d] = dateStr.split('-').map(Number)
  const obsDate = new Date(y, m - 1, d)
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const days = Math.floor((today.getTime() - obsDate.getTime()) / 86400000)
  if (days <= 7) return 'fresh'
  if (days <= 15) return 'mid'
  return 'old'
}

function tierColors(tier: RecencyTier): { bg: string; text: string } {
  if (tier === 'fresh') return { bg: 'var(--sr-map-target-fresh)', text: 'white' }
  if (tier === 'mid')   return { bg: 'var(--sr-map-target-mid)',   text: 'white' }
  return                       { bg: 'var(--sr-map-target-old)',   text: 'var(--sr-map-target-old-text)' }
}


function fmtDate(d: string): string {
  const ymd = d.split(' ')[0].split('-').map(Number)
  if (ymd.length < 3) return d
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  return `${ymd[2]} ${months[ymd[1] - 1]} ${ymd[0]}`
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function AutoSizeMap() {
  const map = useMap()
  useEffect(() => {
    const observer = new ResizeObserver(() => map.invalidateSize())
    observer.observe(map.getContainer())
    map.invalidateSize()
    return () => observer.disconnect()
  }, [map])
  return null
}

function MapPanner({ target, onDone }: { target: { lat: number; lng: number } | null; onDone: () => void }) {
  const map = useMap()
  useEffect(() => {
    if (!target) return
    map.panTo([target.lat, target.lng])
    onDone()
  }, [target, map, onDone])
  return null
}

function AddressSearch({ onLocate }: { onLocate: (lat: number, lng: number) => void }) {
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSearch() {
    const q = query.trim()
    if (!q) return
    setLoading(true); setError('')
    try {
      const data = await transport.get<{ lat: string; lon: string }[]>('/nominatim/search', { q })
      if (data.length === 0) { setError('No location found. Try a different search term.'); return }
      onLocate(parseFloat(data[0].lat), parseFloat(data[0].lon))
      setQuery('')
    } catch {
      setError('Location search failed. Try again or enter coordinates manually.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: 'flex', gap: 6 }}>
        <input
          type="text"
          placeholder="Search by place name"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleSearch() }}
          style={{ flex: 1, height: 34, padding: '0 8px', border: '1.5px solid var(--sr-border)', borderRadius: 6, fontSize: 12, fontFamily: 'inherit', color: 'var(--sr-text)', background: 'var(--sr-surface)', outline: 'none', minWidth: 0 }}
        />
        <button
          onClick={handleSearch}
          disabled={loading || !query.trim()}
          title="Search"
          style={{
            width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: loading || !query.trim() ? 'var(--sr-surface-subtle)' : 'var(--sr-accent)',
            color: loading || !query.trim() ? 'var(--sr-text-muted)' : '#fff',
            border: '1.5px solid var(--sr-border)', borderRadius: 6,
            cursor: loading || !query.trim() ? 'not-allowed' : 'pointer', flexShrink: 0,
          }}
        >
          <Search size={14} strokeWidth={2} />
        </button>
      </div>
      {error && <div style={{ fontSize: 11, color: 'var(--sr-error)', marginTop: 4 }}>{error}</div>}
    </div>
  )
}

function HeatmapLayer({ points }: { points: [number, number, number][] }) {
  const map = useMap()
  const layerRef = useRef<L.Layer | null>(null)

  useEffect(() => {
    if (points.length === 0) {
      if (layerRef.current) { map.removeLayer(layerRef.current); layerRef.current = null }
      return
    }
    const apply = () => {
      if (layerRef.current) { map.removeLayer(layerRef.current); layerRef.current = null }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      layerRef.current = (L as any).heatLayer(points, { radius: 25, blur: 15, maxZoom: 17 }).addTo(map)
    }
    if (heatLoaded.current) {
      apply()
    } else {
      // leaflet.heat is a legacy IIFE that reads window.L — expose it before the dynamic import
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(window as any).L = L
      import('leaflet.heat').then(() => { heatLoaded.current = true; apply() })
    }
    return () => {
      if (layerRef.current) { map.removeLayer(layerRef.current); layerRef.current = null }
    }
  }, [map, points])

  return null
}

function SightingMarkers({ locations, displayMode }: { locations: LocationGroup[]; displayMode: DisplayMode }) {
  const map = useMap()
  const hasFitted = useRef(false)

  useEffect(() => {
    if (hasFitted.current || locations.length === 0) return

    const tryFit = () => {
      // If the container is still hidden (display:none), getSize() returns 0×0.
      // Wait for the resize event that AutoSizeMap fires when the tab becomes visible.
      const size = map.getSize()
      if (size.x === 0 && size.y === 0) return
      hasFitted.current = true
      map.off('resize', tryFit)
      const coords: [number, number][] = locations.map(l => [l.lat, l.lng])
      if (coords.length === 1) map.setView(coords[0], 12)
      else map.fitBounds(L.latLngBounds(coords), { padding: [50, 50] })
    }

    tryFit()
    if (!hasFitted.current) map.on('resize', tryFit)
    return () => { map.off('resize', tryFit) }
  }, [locations, map])

  const heatPoints = useMemo(
    (): [number, number, number][] => locations.map(l => [l.lat, l.lng, Math.min(l.count / 20, 1)]),
    [locations],
  )

  if (displayMode === 'heatmap') return <HeatmapLayer points={heatPoints} />

  return (
    <>
      {locations.map(loc => (
        <CircleMarker
          key={loc.locId}
          center={[loc.lat, loc.lng]}
          radius={pinRadius(loc.count)}
          pathOptions={{ color: '#fff', weight: 2, fillColor: '#2D8653', fillOpacity: pinOpacity(loc.count) }}
        >
          <Popup>
            <div style={{ minWidth: 190 }}>
              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 6 }}>{loc.locName}</div>
              <div style={{ fontSize: 12, color: '#2D8653', marginBottom: 3 }}>
                {loc.count.toLocaleString()} observation{loc.count !== 1 ? 's' : ''}
              </div>
              <div style={{ fontSize: 12, color: '#71717A', marginBottom: 10 }}>
                Last: {fmtDate(loc.lastDate)}
              </div>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#A1A1AA', marginBottom: 5 }}>
                Species seen here
              </div>
              {[...loc.species].slice(0, 5).map(s => (
                <div key={s} style={{ fontSize: 12, color: '#0F1117', marginBottom: 2 }}>{s}</div>
              ))}
              {loc.species.size > 5 && (
                <div style={{ fontSize: 12, color: '#71717A', marginTop: 2 }}>+{loc.species.size - 5} more species</div>
              )}
            </div>
          </Popup>
        </CircleMarker>
      ))}
    </>
  )
}

function HotspotMarkers({ pins, hiddenKinds }: { pins: HotspotPin[]; hiddenKinds: Set<HotspotPin['kind']> }) {
  const map = useMap()

  useEffect(() => {
    if (pins.length === 0) return
    const coords: [number, number][] = pins.map(p => [p.lat, p.lng])
    if (coords.length === 1) map.setView(coords[0], 12)
    else map.fitBounds(L.latLngBounds(coords), { padding: [50, 50] })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const visiblePins = pins.filter(p => !hiddenKinds.has(p.kind))

  return (
    <>
      {visiblePins.map((pin, i) => (
        <Marker
          key={`${pin.kind}-${pin.locId}-${i}`}
          position={[pin.lat, pin.lng]}
          icon={pin.kind === 'visited' ? VISITED_ICON : pin.kind === 'unvisited' ? UNVISITED_ICON : PERSONAL_ICON}
        >
          <Popup>
            <div style={{ minWidth: 190 }}>
              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8 }}>{pin.locName}</div>
              {pin.kind === 'visited' && (
                <>
                  <div style={{ fontSize: 12, color: '#2D8653', marginBottom: 3 }}>{pin.speciesCount} species recorded</div>
                  <div style={{ fontSize: 12, color: '#71717A', marginBottom: 8 }}>Last visit: {fmtDate(pin.lastVisit)}</div>
                  <a href={`https://ebird.org/hotspot/${pin.locId}`} target="_blank" rel="noreferrer"
                    style={{ fontSize: 12, color: '#2D8653', textDecoration: 'none', fontWeight: 500 }}>
                    View on eBird →
                  </a>
                </>
              )}
              {pin.kind === 'unvisited' && (
                <a href={`https://ebird.org/hotspot/${pin.locId}`} target="_blank" rel="noreferrer"
                  style={{ fontSize: 12, color: '#2D8653', textDecoration: 'none', fontWeight: 500 }}>
                  View on eBird →
                </a>
              )}
              {pin.kind === 'personal' && (
                <>
                  <div style={{ display: 'inline-block', background: '#FFF7ED', border: '1px solid #FDE68A', color: '#C9842A', borderRadius: 4, padding: '2px 6px', fontSize: 11, fontWeight: 600, marginBottom: 8 }}>
                    Personal Location
                  </div>
                  <div style={{ fontSize: 12, color: '#71717A', marginBottom: 3 }}>
                    {pin.obsCount} observation{pin.obsCount !== 1 ? 's' : ''}
                  </div>
                  <div style={{ fontSize: 12, color: '#71717A' }}>Last visit: {fmtDate(pin.lastVisit)}</div>
                </>
              )}
            </div>
          </Popup>
        </Marker>
      ))}
    </>
  )
}

function TargetMarkers({ pins }: { pins: DisplayTargetPin[] }) {
  const map = useMap()

  useEffect(() => {
    if (pins.length === 0) return
    const coords: [number, number][] = pins.map(p => [p.lat, p.lng])
    if (coords.length === 1) map.setView(coords[0], 12)
    else map.fitBounds(L.latLngBounds(coords), { padding: [50, 50] })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const locationGroups = useMemo(() => {
    const groups = new Map<string, DisplayTargetPin[]>()
    for (const pin of pins) {
      const existing = groups.get(pin.locId) ?? []
      existing.push(pin)
      groups.set(pin.locId, existing)
    }
    return [...groups.values()]
  }, [pins])

  return (
    <>
      {locationGroups.map((group, i) => {
        const rep = group.reduce((best, p) => p.recentDate > best.recentDate ? p : best)
        const tier = recencyTier(rep.recentDate)
        const { bg, text } = tierColors(tier)

        let labelHtml: string
        if (group.length === 1) {
          const pin = group[0]
          const iconsHtml = pin.missingTypes.length > 0
            ? `<span style="display:inline-flex;align-items:center;gap:3px;margin-left:5px">${pin.missingTypes.map(t => MEDIA_ICONS[t]).join('')}</span>`
            : ''
          labelHtml = `${escHtml(pin.comName)}${iconsHtml}`
        } else {
          labelHtml = `${group.length} species`
        }

        const icon = L.divIcon({
          html: `<div style="display:inline-flex;align-items:center;background:${bg};color:${text};padding:3px 8px;border-radius:10px;font-size:11px;font-weight:600;white-space:nowrap;font-family:Inter,system-ui,sans-serif;border:1.5px solid rgba(255,255,255,0.85);box-shadow:0 2px 6px rgba(0,0,0,0.35),0 0 0 1px rgba(0,0,0,0.1)">${labelHtml}</div>`,
          className: '',
          iconAnchor: [0, 14],
          popupAnchor: [0, -16],
        })

        return (
          <Marker key={`${rep.locId}-${i}`} position={[rep.lat, rep.lng]} icon={icon}>
            <Popup>
              <div style={{ minWidth: 200, maxWidth: 260 }}>
                <div style={{ fontSize: 11, color: '#71717A', marginBottom: 8 }}>📍 {rep.locName}</div>
                {group.map((pin, j) => {
                  const pinTier = recencyTier(pin.recentDate)
                  const { bg: pinBg, text: pinText } = tierColors(pinTier)
                  const tierLabel = pinTier === 'fresh' ? '≤7 days' : pinTier === 'mid' ? '8–15 days' : '16–30 days'
                  const validSubId = /^S\d+$/.test(pin.subId ?? '')
                  return (
                    <div key={pin.speciesCode} style={{ paddingTop: j > 0 ? 8 : 0, marginTop: j > 0 ? 8 : 0, borderTop: j > 0 ? '1px solid #E4E4E7' : 'none' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 3, flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 700, fontSize: 12, color: '#0F1117' }}>{pin.comName}</span>
                        {pin.missingTypes.map(t => (
                          <span key={t} style={{ display: 'inline-flex', alignItems: 'center', padding: '0 4px', background: 'var(--sr-surface-subtle)', borderRadius: 4, fontSize: 10, color: 'var(--sr-text-muted)', gap: 2 }}>
                            {t === 'Photo' && <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/></svg>}
                            {t === 'Audio' && <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/></svg>}
                            {t === 'Video' && <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m22 8-6 4 6 4V8z"/><rect width="14" height="12" x="2" y="6" rx="2" ry="2"/></svg>}
                          </span>
                        ))}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: validSubId ? 4 : 0 }}>
                        <span style={{ display: 'inline-block', background: pinBg, color: pinText, padding: '1px 6px', borderRadius: 6, fontSize: 10, fontWeight: 600 }}>{tierLabel}</span>
                        <span style={{ fontSize: 10, color: '#71717A' }}>{fmtDate(pin.recentDate)}</span>
                      </div>
                      {validSubId && (
                        <a href={`https://ebird.org/checklist/${pin.subId}`} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: '#2D8653', textDecoration: 'none', fontWeight: 500 }}>
                          View checklist {pin.subId} →
                        </a>
                      )}
                    </div>
                  )
                })}
              </div>
            </Popup>
          </Marker>
        )
      })}
    </>
  )
}

// ── Shared UI primitives ───────────────────────────────────────────────────────

function SegControl({ options, value, onChange }: {
  options: { value: string; label: string }[]
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div style={{ display: 'flex', background: 'var(--sr-surface-subtle)', borderRadius: 6, padding: 2 }}>
      {options.map(opt => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          style={{
            flex: 1, height: 28, padding: '0 4px',
            background: value === opt.value ? 'var(--sr-surface)' : 'transparent',
            border: `1px solid ${value === opt.value ? 'var(--sr-border)' : 'transparent'}`,
            borderRadius: 5, fontSize: 11.5,
            fontWeight: value === opt.value ? 600 : 400,
            color: value === opt.value ? 'var(--sr-text)' : 'var(--sr-text-muted)',
            cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
          }}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

const SELECT_STYLE: React.CSSProperties = {
  width: '100%', height: 34, padding: '0 28px 0 10px',
  border: '1.5px solid var(--sr-border)', borderRadius: 6,
  fontSize: 13, fontFamily: 'inherit', color: 'var(--sr-text)',
  background: `var(--sr-surface) url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2371717A' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E") no-repeat right 8px center`,
  appearance: 'none', WebkitAppearance: 'none',
  outline: 'none', cursor: 'pointer', boxSizing: 'border-box',
}

function SidebarLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
      letterSpacing: '0.07em', color: 'var(--sr-text-muted)', marginBottom: 6,
    }}>
      {children}
    </div>
  )
}

function KeyNotice({ onGoToSettings }: { onGoToSettings: () => void }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10,
      padding: '10px 12px', background: 'var(--sr-warning-bg)',
      border: '1px solid var(--sr-warning-subtle)', borderRadius: 8,
      fontSize: 12, color: 'var(--sr-warning)', marginBottom: 14,
    }}>
      <div style={{ display: 'flex', gap: 7, alignItems: 'flex-start' }}>
        <AlertCircle size={13} style={{ flexShrink: 0, marginTop: 1 }} />
        <span>eBird API key required. Add it in Settings to use this feature.</span>
      </div>
      <button
        onClick={onGoToSettings}
        style={{
          background: 'none', border: 'none', padding: 0, fontSize: 11, fontWeight: 600,
          color: 'var(--sr-warning)', cursor: 'pointer', fontFamily: 'inherit',
          whiteSpace: 'nowrap', flexShrink: 0,
        }}
      >
        Settings →
      </button>
    </div>
  )
}

function radiusToZoom(distMiles: number): number {
  if (distMiles <= 5) return 12
  if (distMiles <= 10) return 11
  if (distMiles <= 25) return 10
  return 9
}

function DefaultCenterSetter({ center, onDone }: {
  center: { lat: number; lng: number; zoom: number } | null
  onDone: () => void
}) {
  const map = useMap()
  useEffect(() => {
    if (!center) return
    map.setView([center.lat, center.lng], center.zoom)
    onDone()
  }, [center, map, onDone])
  return null
}

// ── Main component ─────────────────────────────────────────────────────────────

export function MapExplorer({ onGoToSettings, onNavigateToMediaList, keysVersion }: MapExplorerProps) {
  const [phase, setPhase] = useState<MapPhase>({ tag: 'loading-saved' })
  const [viewMode, setViewMode] = useState<ViewMode>('sightings')
  const [displayMode, setDisplayMode] = useState<DisplayMode>('pins')

  // My Sightings filters
  const [filterOpen, setFilterOpen]         = useState(true)
  const [speciesFilter, setSpeciesFilter]   = useState('')
  const [dateFrom, setDateFrom]             = useState('')
  const [dateTo, setDateTo]                 = useState('')
  const [countyFilter, setCountyFilter]     = useState('')
  const [breedingFilter, setBreedingFilter] = useState<BreedingFilter>('all')
  const [mediaFilter, setMediaFilter]       = useState<MediaFilter>('any')

  // Shared center point (hotspots + targets)
  const [lat, setLat]         = useState('')
  const [lng, setLng]         = useState('')
  const [radius, setRadius]   = useState(25)
  const [geoError, setGeoError] = useState('')

  // Hotspot state
  const [hotspotPins, setHotspotPins]         = useState<HotspotPin[] | null>(null)
  const [hotspotsLoading, setHotspotsLoading] = useState(false)
  const [hotspotsError, setHotspotsError]     = useState('')
  const [legendVisible, setLegendVisible]     = useState(false)
  const [hiddenKinds, setHiddenKinds]         = useState<Set<HotspotPin['kind']>>(new Set())

  // Target state
  const [targetPins, setTargetPins]           = useState<TargetPin[] | null>(null)
  const [targetsLoading, setTargetsLoading]   = useState(false)
  const [targetsError, setTargetsError]       = useState('')
  const [manualTargets, setManualTargets]     = useState<Set<string>>(new Set())
  const [targetSearch, setTargetSearch]       = useState('')
  const [targetViewMode, setTargetViewMode]   = useState<'all' | 'week'>('all')
  const [selectedTargetKey, setSelectedTargetKey] = useState<string | null>(null)
  const [targetTypeFilter, setTargetTypeFilter] = useState<Set<'Photo' | 'Audio' | 'Video'>>(new Set())

  // Map pan target (set by sidebar clicks, consumed by MapPanner inside MapContainer)
  const [panTarget, setPanTarget]             = useState<{ lat: number; lng: number } | null>(null)
  const handlePanDone                         = useCallback(() => setPanTarget(null), [])

  // Mobile sidebar overlay state
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // Initial map center from saved defaults
  const [defaultCenter, setDefaultCenter] = useState<{ lat: number; lng: number; zoom: number } | null>(null)
  const handleDefaultCenterDone = useCallback(() => setDefaultCenter(null), [])

  // Species code map and key status
  const [speciesCodeMap, setSpeciesCodeMap] = useState<Record<string, string>>({})
  const [hasEbirdKey, setHasEbirdKey]       = useState<boolean | null>(null)

  // Load eBird key status — re-runs when a key is saved in Settings
  useEffect(() => {
    storage.getApiKey('ebird')
      .then(key => setHasEbirdKey(key !== null))
      .catch(() => setHasEbirdKey(false))
  }, [keysVersion])

  // Pre-fill lat/lng/radius from saved map defaults on mount; pan map to saved location
  useEffect(() => {
    storage.getSetting<{ lat: number; lng: number; dist: number }>('map-defaults')
      .then(data => {
        if (data && typeof data.lat === 'number' && typeof data.lng === 'number' && typeof data.dist === 'number') {
          setLat(String(data.lat))
          setLng(String(data.lng))
          setRadius(data.dist)
          setDefaultCenter({ lat: data.lat, lng: data.lng, zoom: radiusToZoom(data.dist) })
        }
      })
      .catch(() => {})
  }, [])

  // Load observations + ML export
  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const status = await storage.getFilesStatus()
        if (cancelled) return
        if (!status.ebird) { setPhase({ tag: 'setup-required' }); return }

        const [ebirdText, mlText] = await Promise.all([
          storage.readFile('ebird'),
          status.ml ? storage.readFile('ml') : Promise.resolve(null),
        ])
        if (!ebirdText || cancelled) { setPhase({ tag: 'setup-required' }); return }

        const observations = parseEbirdObservations(ebirdText)

        let mlRows: MLExportRow[] = []
        let hasML = false
        if (mlText) {
          const result = parseMLExport(mlText)
          mlRows = result.rows
          hasML = mlRows.length > 0
        }

        if (cancelled) return
        setPhase({ tag: 'ready', observations, mlRows, hasML })
      } catch {
        if (!cancelled) setPhase({ tag: 'setup-required' })
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  // Pre-fetch taxonomy codes for target species once data is loaded
  const fetchTargetCodes = useCallback(async (observations: ObservationEntry[], mlRows: MLExportRow[]) => {
    try {
      const mediaTypesMap = new Map<string, Set<'Photo' | 'Audio' | 'Video'>>()
      for (const row of mlRows) {
        let s = mediaTypesMap.get(row.commonName)
        if (!s) { s = new Set(); mediaTypesMap.set(row.commonName, s) }
        s.add(row.format)
      }
      const targetMap = new Map<string, string>()
      for (const o of observations) {
        if (targetMap.has(o.commonName)) continue
        const types = mediaTypesMap.get(o.commonName)
        const hasAll = types?.has('Photo') && types?.has('Audio') && types?.has('Video')
        if (!hasAll) targetMap.set(o.commonName, o.scientificName)
      }
      if (targetMap.size === 0) return

      const species = [...targetMap.entries()].map(([commonName, scientificName]) => ({ commonName, scientificName }))
      const data = await transport.post<{ codes: Record<string, string> }>('/taxonomy/codes', { species })
      setSpeciesCodeMap(data.codes)
    } catch { /* taxonomy unavailable — gracefully handled at fetch time */ }
  }, [])

  useEffect(() => {
    if (phase.tag !== 'ready') return
    const run = async () => { await fetchTargetCodes(phase.observations, phase.mlRows) }
    run()
  }, [phase, fetchTargetCodes])

  // ── Derived data ──────────────────────────────────────────────────────────────

  const mediaTypes = useMemo((): Map<string, Set<'Photo' | 'Audio' | 'Video'>> => {
    if (phase.tag !== 'ready' || !phase.hasML) return new Map()
    const map = new Map<string, Set<'Photo' | 'Audio' | 'Video'>>()
    for (const row of phase.mlRows) {
      let s = map.get(row.commonName)
      if (!s) { s = new Set(); map.set(row.commonName, s) }
      s.add(row.format)
    }
    return map
  }, [phase])

  const filteredLocations = useMemo((): LocationGroup[] => {
    if (phase.tag !== 'ready') return []
    let obs = phase.observations

    if (speciesFilter)         obs = obs.filter(o => o.commonName === speciesFilter)
    if (dateFrom)              obs = obs.filter(o => o.date >= dateFrom)
    if (dateTo)                obs = obs.filter(o => o.date <= dateTo)
    if (countyFilter)          obs = obs.filter(o => o.county === countyFilter)
    if (breedingFilter !== 'all') {
      const codeSet = breedingFilter === 'possible' ? POSSIBLE_CODES
        : breedingFilter === 'probable' ? PROBABLE_CODES : CONFIRMED_CODES
      obs = obs.filter(o => o.breedingCode !== null && codeSet.has(o.breedingCode))
    }
    if (mediaFilter !== 'any' && phase.hasML) {
      obs = obs.filter(o => {
        const types = mediaTypes.get(o.commonName)
        if (mediaFilter === 'photo')  return types?.has('Photo') ?? false
        if (mediaFilter === 'audio')  return types?.has('Audio') ?? false
        if (mediaFilter === 'video')  return types?.has('Video') ?? false
        if (mediaFilter === 'none')   return !types || types.size === 0
        return true
      })
    }

    const groups = new Map<string, LocationGroup>()
    for (const o of obs) {
      if (o.latitude === null || o.longitude === null) continue
      let g = groups.get(o.locationId)
      if (!g) {
        g = { locId: o.locationId, locName: o.location, lat: o.latitude, lng: o.longitude, count: 0, species: new Set(), lastDate: '' }
        groups.set(o.locationId, g)
      }
      g.count++
      g.species.add(o.commonName)
      if (o.date > g.lastDate) g.lastDate = o.date
    }
    return [...groups.values()]
  }, [phase, speciesFilter, dateFrom, dateTo, countyFilter, breedingFilter, mediaFilter, mediaTypes])

  const stats = useMemo(() => {
    const species = new Set(filteredLocations.flatMap(l => [...l.species]))
    const obs = filteredLocations.reduce((s, l) => s + l.count, 0)
    return { locations: filteredLocations.length, species: species.size, obs }
  }, [filteredLocations])

  const allSpecies = useMemo((): string[] => {
    if (phase.tag !== 'ready') return []
    return [...new Set(phase.observations.map(o => o.commonName))].sort()
  }, [phase])

  const allCounties = useMemo((): string[] => {
    if (phase.tag !== 'ready') return []
    return [...new Set(phase.observations.map(o => o.county).filter((c): c is string => c !== null))].sort()
  }, [phase])

  const targetSpecies = useMemo((): { commonName: string; scientificName: string }[] => {
    if (phase.tag !== 'ready' || !phase.hasML) return []
    const seen = new Map<string, string>()
    for (const o of phase.observations) {
      if (seen.has(o.commonName)) continue
      const types = mediaTypes.get(o.commonName)
      const hasAll = types?.has('Photo') && types?.has('Audio') && types?.has('Video')
      if (!hasAll) seen.set(o.commonName, o.scientificName)
    }
    return [...seen.entries()].map(([commonName, scientificName]) => ({ commonName, scientificName }))
  }, [phase, mediaTypes])

  const visitedLocIds = useMemo((): Set<string> => {
    if (phase.tag !== 'ready') return new Set()
    return new Set(phase.observations.map(o => o.locationId))
  }, [phase])

  const obsLocationsByLocId = useMemo((): Map<string, { lat: number; lng: number; locName: string; count: number; lastDate: string; species: Set<string> }> => {
    if (phase.tag !== 'ready') return new Map()
    const map = new Map<string, { lat: number; lng: number; locName: string; count: number; lastDate: string; species: Set<string> }>()
    for (const o of phase.observations) {
      if (o.latitude === null || o.longitude === null) continue
      let e = map.get(o.locationId)
      if (!e) { e = { lat: o.latitude, lng: o.longitude, locName: o.location, count: 0, lastDate: '', species: new Set() }; map.set(o.locationId, e) }
      e.count++; e.species.add(o.commonName)
      if (o.date > e.lastDate) e.lastDate = o.date
    }
    return map
  }, [phase])

  const filteredManualSpecies = useMemo(() => {
    if (!targetSearch) return allSpecies
    const q = targetSearch.toLowerCase()
    return allSpecies.filter(s => s.toLowerCase().includes(q))
  }, [allSpecies, targetSearch])

  const displayedTargetPins = useMemo((): DisplayTargetPin[] => {
    if (!targetPins) return []
    const ALL_TYPES: ('Photo' | 'Audio' | 'Video')[] = ['Photo', 'Audio', 'Video']
    const withMissing = targetPins.map(pin => ({
      ...pin,
      missingTypes: ALL_TYPES.filter(t => !mediaTypes.get(pin.comName)?.has(t)),
    }))
    // Pass 1: recency filter
    let filtered = withMissing
    if (targetViewMode !== 'all') {
      const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 7); cutoff.setHours(0, 0, 0, 0)
      filtered = withMissing.filter(pin => {
        const [y, m, d] = pin.recentDate.split(' ')[0].split('-').map(Number)
        return new Date(y, m - 1, d) >= cutoff
      })
    }
    // Pass 2: type filter — AND logic; empty set means All
    if (targetTypeFilter.size > 0) {
      filtered = filtered.filter(pin =>
        [...targetTypeFilter].every(t => pin.missingTypes.includes(t))
      )
    }
    return filtered
  }, [targetPins, targetViewMode, mediaTypes, targetTypeFilter])

  const nearest10 = useMemo(() => {
    const latNum = parseFloat(lat)
    const lngNum = parseFloat(lng)
    if (isNaN(latNum) || isNaN(lngNum) || displayedTargetPins.length === 0) return []
    return [...displayedTargetPins]
      .sort((a, b) => distanceMiles(latNum, lngNum, a.lat, a.lng) - distanceMiles(latNum, lngNum, b.lat, b.lng))
      .slice(0, 10)
      .map(pin => ({ pin, dist: distanceMiles(latNum, lngNum, pin.lat, pin.lng) }))
  }, [displayedTargetPins, lat, lng])

  // ── Actions ───────────────────────────────────────────────────────────────────

  const handleUseMyLocation = useCallback(() => {
    setGeoError('')
    if (!navigator.geolocation || !window.isSecureContext) {
      setGeoError('Location detection requires HTTPS. Enter coordinates manually.')
      return
    }
    navigator.geolocation.getCurrentPosition(
      pos => { setLat(pos.coords.latitude.toFixed(5)); setLng(pos.coords.longitude.toFixed(5)) },
      err => {
        if (err.code === 1) {
          setGeoError('Location access was denied. Enter coordinates manually.')
        } else {
          setGeoError('Location unavailable. Enter coordinates manually.')
        }
      },
      { timeout: 10000 },
    )
  }, [])

  const handleFindHotspots = useCallback(async (overrideLat?: number, overrideLng?: number) => {
    const latNum = overrideLat ?? parseFloat(lat)
    const lngNum = overrideLng ?? parseFloat(lng)
    if (isNaN(latNum) || isNaN(lngNum)) { setHotspotsError('Enter a valid latitude and longitude.'); return }
    setHotspotsLoading(true); setHotspotsError('')
    try {
      const distKm = Math.round(radius * 1.60934)
      const data = await transport.get<{ locId: string; locName: string; lat: number; lng: number }[]>('/map/hotspots', {
        lat: String(latNum), lng: String(lngNum), dist: String(distKm),
      })
      const hotspotLocIds = new Set(data.map(h => h.locId))

      const pins: HotspotPin[] = data.map(h => {
        if (visitedLocIds.has(h.locId)) {
          const loc = obsLocationsByLocId.get(h.locId)
          return { kind: 'visited' as const, locId: h.locId, locName: h.locName, lat: h.lat, lng: h.lng, speciesCount: loc?.species.size ?? 0, lastVisit: loc?.lastDate ?? '' }
        }
        return { kind: 'unvisited' as const, locId: h.locId, locName: h.locName, lat: h.lat, lng: h.lng }
      })

      // Add personal locations within radius
      for (const [locId, loc] of obsLocationsByLocId.entries()) {
        if (hotspotLocIds.has(locId)) continue
        if (distanceMiles(latNum, lngNum, loc.lat, loc.lng) <= radius) {
          pins.push({ kind: 'personal', locId, locName: loc.locName, lat: loc.lat, lng: loc.lng, obsCount: loc.count, lastVisit: loc.lastDate })
        }
      }

      setHiddenKinds(new Set())
      setHotspotPins(pins); setLegendVisible(true)
    } catch (err) {
      const e = err as { status?: number; detail?: string }
      const errStatus = err instanceof TransportError ? err.status : e.status
      const errDetail = err instanceof TransportError ? err.detail : (e.detail ?? (err instanceof Error ? err.message : undefined))
      setHotspotsError(errStatus === 401
        ? 'eBird API key not configured. Add it in Settings.'
        : (errDetail ?? 'Failed to fetch hotspots.'))
    } finally {
      setHotspotsLoading(false)
    }
  }, [lat, lng, radius, visitedLocIds, obsLocationsByLocId])

  const handleFindSightings = useCallback(async (overrideLat?: number, overrideLng?: number) => {
    setTargetTypeFilter(new Set())
    const latNum = overrideLat ?? parseFloat(lat)
    const lngNum = overrideLng ?? parseFloat(lng)
    if (isNaN(latNum) || isNaN(lngNum)) { setTargetsError('Enter a valid latitude and longitude.'); return }

    const useManual = phase.tag === 'ready' && !phase.hasML
    const names = useManual ? [...manualTargets] : targetSpecies.map(t => t.commonName)
    if (names.length === 0) { setTargetsError('No target species to search for.'); return }

    let codes = names.map(n => speciesCodeMap[n]).filter(Boolean).join(',')
    if (!codes) {
      // Fetch codes on demand if pre-fetch hasn't resolved yet
      try {
        const sciMap = new Map(
          (phase.tag === 'ready' ? [...phase.observations] : []).map(o => [o.commonName, o.scientificName]),
        )
        const species = names.map(n => ({ commonName: n, scientificName: sciMap.get(n) ?? '' }))
        try {
          const d = await transport.post<{ codes: Record<string, string> }>('/taxonomy/codes', { species })
          setSpeciesCodeMap(prev => ({ ...prev, ...d.codes }))
          codes = names.map(n => d.codes[n]).filter(Boolean).join(',')
        } catch { /* ignore */ }
      } catch { /* ignore */ }
    }
    if (!codes) { setTargetsError('Could not look up species codes from eBird. Try rebuilding caches in Settings.'); return }

    setTargetsLoading(true); setTargetsError('')
    try {
      const distKm = Math.round(radius * 1.60934)
      const pins = await transport.get<TargetPin[]>('/map/recent-obs', {
        lat: String(latNum), lng: String(lngNum), dist: String(distKm), codes,
      })
      setTargetPins(pins)
    } catch (err) {
      const e = err as { status?: number; detail?: string }
      const errStatus = err instanceof TransportError ? err.status : e.status
      const errDetail = err instanceof TransportError ? err.detail : (e.detail ?? (err instanceof Error ? err.message : undefined))
      setTargetsError(errStatus === 401
        ? 'eBird API key not configured. Add it in Settings.'
        : (errDetail ?? 'Failed to fetch recent sightings.'))
    } finally {
      setTargetsLoading(false)
    }
  }, [lat, lng, radius, phase, targetSpecies, speciesCodeMap, manualTargets])

  // ── Render ────────────────────────────────────────────────────────────────────

  if (phase.tag === 'loading-saved') {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Loader2 size={22} style={{ color: 'var(--sr-accent)', animation: 'spin 1s linear infinite' }} />
      </div>
    )
  }

  const isSetupRequired = phase.tag === 'setup-required'

  const CenterPointControl = (
    <div style={{ marginBottom: 16 }}>
      <button
        onClick={handleUseMyLocation}
        style={{
          display: 'flex', alignItems: 'center', gap: 7,
          width: '100%', height: 34, padding: '0 12px',
          background: 'none', border: '1.5px solid var(--sr-border)',
          borderRadius: 6, fontSize: 12.5, fontWeight: 500,
          fontFamily: 'inherit', color: 'var(--sr-text)', cursor: 'pointer',
          marginBottom: 8, boxSizing: 'border-box',
        }}
      >
        <Navigation size={13} strokeWidth={2} style={{ color: 'var(--sr-accent)' }} />
        Use my location
      </button>
      {geoError && <div style={{ fontSize: 11, color: 'var(--sr-error)', marginBottom: 6 }}>{geoError}</div>}
      <div style={{ display: 'flex', gap: 6 }}>
        <input type="number" placeholder="Latitude" value={lat} onChange={e => setLat(e.target.value)}
          style={{ flex: 1, height: 34, padding: '0 8px', border: '1.5px solid var(--sr-border)', borderRadius: 6, fontSize: 12, fontFamily: 'inherit', color: 'var(--sr-text)', background: 'var(--sr-surface)', outline: 'none', minWidth: 0 }} />
        <input type="number" placeholder="Longitude" value={lng} onChange={e => setLng(e.target.value)}
          style={{ flex: 1, height: 34, padding: '0 8px', border: '1.5px solid var(--sr-border)', borderRadius: 6, fontSize: 12, fontFamily: 'inherit', color: 'var(--sr-text)', background: 'var(--sr-surface)', outline: 'none', minWidth: 0 }} />
      </div>
    </div>
  )

  const RadiusControl = (
    <div style={{ marginBottom: 16 }}>
      <SidebarLabel>Radius</SidebarLabel>
      <SegControl
        options={[{ value: '5', label: '5 mi' }, { value: '10', label: '10 mi' }, { value: '25', label: '25 mi' }, { value: '50', label: '50 mi' }]}
        value={String(radius)}
        onChange={v => setRadius(Number(v))}
      />
    </div>
  )

  // ── Sidebar content per mode ──────────────────────────────────────────────────

  const sightingsSidebar = (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
        {/* Collapsible filter panel */}
        <div>
          <button
            onClick={() => setFilterOpen(o => !o)}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              width: '100%', padding: '12px 16px',
              background: 'none', border: 'none',
              borderBottom: `1px solid var(--sr-border)`,
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--sr-text-muted)' }}>Filters</span>
            <ChevronDown size={14} style={{ color: 'var(--sr-text-muted)', transform: filterOpen ? 'none' : 'rotate(-90deg)', transition: 'transform 0.2s', flexShrink: 0 }} />
          </button>
          <div style={{ maxHeight: filterOpen ? 600 : 0, overflow: 'hidden', transition: 'max-height 0.25s ease', borderBottom: filterOpen ? '1px solid var(--sr-border)' : 'none' }}>
            <div style={{ padding: '10px 16px 14px' }}>
              {/* Species */}
              <div style={{ marginBottom: 12 }}>
                <SidebarLabel>Species</SidebarLabel>
                <select value={speciesFilter} onChange={e => setSpeciesFilter(e.target.value)} style={SELECT_STYLE}>
                  <option value="">All species</option>
                  {allSpecies.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              {/* Date range */}
              <div style={{ marginBottom: 12 }}>
                <SidebarLabel>Date Range</SidebarLabel>
                <div style={{ display: 'flex', gap: 6 }}>
                  <input type="text" placeholder="YYYY-MM-DD" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                    style={{ flex: 1, height: 34, padding: '0 8px', border: '1.5px solid var(--sr-border)', borderRadius: 6, fontSize: 12, fontFamily: 'inherit', color: 'var(--sr-text)', background: 'var(--sr-surface)', outline: 'none', minWidth: 0 }} />
                  <input type="text" placeholder="YYYY-MM-DD" value={dateTo} onChange={e => setDateTo(e.target.value)}
                    style={{ flex: 1, height: 34, padding: '0 8px', border: '1.5px solid var(--sr-border)', borderRadius: 6, fontSize: 12, fontFamily: 'inherit', color: 'var(--sr-text)', background: 'var(--sr-surface)', outline: 'none', minWidth: 0 }} />
                </div>
              </div>
              {/* County */}
              {allCounties.length > 0 && (
                <div style={{ marginBottom: 12 }}>
                  <SidebarLabel>County</SidebarLabel>
                  <select value={countyFilter} onChange={e => setCountyFilter(e.target.value)} style={SELECT_STYLE}>
                    <option value="">All counties</option>
                    {allCounties.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              )}
              {/* Breeding Code */}
              <div style={{ marginBottom: 12 }}>
                <SidebarLabel>Breeding Code</SidebarLabel>
                <SegControl
                  options={[
                    { value: 'all', label: 'All' },
                    { value: 'possible', label: 'Possible' },
                    { value: 'probable', label: 'Probable' },
                    { value: 'confirmed', label: 'Confirmed' },
                  ]}
                  value={breedingFilter}
                  onChange={v => setBreedingFilter(v as BreedingFilter)}
                />
              </div>
              {/* Media (only when ML export stored) */}
              {phase.tag === 'ready' && phase.hasML && (
                <div>
                  <SidebarLabel>Media</SidebarLabel>
                  <select value={mediaFilter} onChange={e => setMediaFilter(e.target.value as MediaFilter)} style={SELECT_STYLE}>
                    <option value="any">Any</option>
                    <option value="photo">Has Photo</option>
                    <option value="audio">Has Audio</option>
                    <option value="video">Has Video</option>
                    <option value="none">No Media</option>
                  </select>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Map View control */}
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--sr-border)' }}>
          <SidebarLabel>Map View</SidebarLabel>
          <SegControl
            options={[{ value: 'pins', label: 'Pins' }, { value: 'heatmap', label: 'Heatmap' }]}
            value={displayMode}
            onChange={v => setDisplayMode(v as DisplayMode)}
          />
        </div>
      </div>

      {/* Stats bar — pinned to sidebar bottom */}
      <div style={{ display: 'flex', borderTop: '1px solid var(--sr-border)', padding: '12px 16px', flexShrink: 0 }}>
        {[
          { label: 'Locations', value: stats.locations.toLocaleString() },
          { label: 'Species',   value: stats.species.toLocaleString() },
          { label: 'Obs',       value: stats.obs >= 1000 ? `${(stats.obs / 1000).toFixed(1)}k` : stats.obs.toLocaleString() },
        ].map((s, i) => (
          <div key={s.label} style={{ flex: 1, textAlign: 'center', borderLeft: i > 0 ? '1px solid var(--sr-border)' : 'none' }}>
            <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--sr-accent)', letterSpacing: '-0.02em', lineHeight: 1.1 }}>{s.value}</div>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--sr-text-muted)', marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>
    </div>
  )

  const hotspotsSidebar = (
    <div style={{ padding: '14px 16px', overflowY: 'auto', flex: 1 }}>
      {hasEbirdKey === false && <KeyNotice onGoToSettings={onGoToSettings} />}
      <AddressSearch onLocate={(aLat, aLng) => {
        setLat(aLat.toFixed(5)); setLng(aLng.toFixed(5))
        handleFindHotspots(aLat, aLng)
      }} />
      {CenterPointControl}
      {RadiusControl}
      <button
        onClick={() => handleFindHotspots()}
        disabled={hotspotsLoading || hasEbirdKey === false}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
          width: '100%', height: 36,
          background: hotspotsLoading || hasEbirdKey === false ? 'var(--sr-text-disabled)' : 'var(--sr-accent)',
          color: '#fff', border: 'none', borderRadius: 6,
          fontSize: 13, fontWeight: 500, fontFamily: 'inherit',
          cursor: hotspotsLoading || hasEbirdKey === false ? 'not-allowed' : 'pointer',
          marginBottom: 10,
        }}
      >
        {hotspotsLoading
          ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Finding…</>
          : 'Find Hotspots'}
      </button>
      {hotspotsError && (
        <div style={{ display: 'flex', gap: 6, fontSize: 12, color: 'var(--sr-error)', marginBottom: 10 }}>
          <AlertCircle size={13} style={{ flexShrink: 0, marginTop: 1 }} />
          {hotspotsError}
        </div>
      )}

      {/* Legend — visible after first successful fetch */}
      {legendVisible && hotspotPins && hotspotPins.length > 0 && (
        <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--sr-border)' }}>
          <SidebarLabel>Legend</SidebarLabel>
          <div style={{ fontSize: 11, color: 'var(--sr-text-muted)', fontStyle: 'italic', marginBottom: 8 }}>
            Click a row to hide or show that pin category.
          </div>
          {([
            { icon: VISITED_ICON,  label: 'Visited',   kind: 'visited' as const },
            { icon: UNVISITED_ICON, label: 'Unvisited', kind: 'unvisited' as const },
            { icon: PERSONAL_ICON, label: 'Personal',  kind: 'personal' as const },
          ] as { icon: L.DivIcon; label: string; kind: HotspotPin['kind'] }[])
            .filter(row => hotspotPins.some(p => p.kind === row.kind))
            .map(row => {
              const count = hotspotPins.filter(p => p.kind === row.kind).length
              const isHidden = hiddenKinds.has(row.kind)
              return (
                <button
                  key={row.label}
                  onClick={() => setHiddenKinds(prev => {
                    const next = new Set(prev)
                    if (next.has(row.kind)) next.delete(row.kind); else next.add(row.kind)
                    return next
                  })}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8,
                    width: '100%', background: 'none', border: 'none', padding: 0,
                    cursor: 'pointer', opacity: isHidden ? 0.4 : 1, textAlign: 'left',
                  }}
                >
                  <div dangerouslySetInnerHTML={{ __html: row.icon.options.html as string }} style={{ flexShrink: 0, width: 28, height: 40 }} />
                  <div>
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--sr-text)' }}>{row.label}</span>
                    <span style={{ fontSize: 12, color: 'var(--sr-text-muted)', marginLeft: 6 }}>{count}</span>
                  </div>
                </button>
              )
            })}
        </div>
      )}
    </div>
  )

  const targetsHasML = phase.tag === 'ready' && phase.hasML
  const targetsNoML  = phase.tag === 'ready' && !phase.hasML
  const targetsFetchDisabled =
    targetsLoading ||
    hasEbirdKey === false ||
    (targetsHasML && targetSpecies.length === 0) ||
    (targetsNoML && manualTargets.size === 0)

  const targetsSidebar = (
    <div style={{ padding: '14px 16px', overflowY: 'auto', flex: 1 }}>
      {hasEbirdKey === false && <KeyNotice onGoToSettings={onGoToSettings} />}
      <AddressSearch onLocate={(aLat, aLng) => {
        setLat(aLat.toFixed(5)); setLng(aLng.toFixed(5))
        handleFindSightings(aLat, aLng)
      }} />
      {CenterPointControl}
      {RadiusControl}

      {/* Target species — auto-derived when ML export present */}
      {targetsHasML && (
        <div style={{ marginBottom: 16 }}>
          <SidebarLabel>Target Species</SidebarLabel>
          {targetSpecies.length === 0 ? (
            <div style={{ fontSize: 12, color: 'var(--sr-text-muted)', lineHeight: 1.5 }}>
              You already have media for every species in your eBird backup.
            </div>
          ) : (
            <div style={{ padding: '10px 12px', background: 'var(--sr-surface-subtle)', borderRadius: 8, border: '1px solid var(--sr-border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 3 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--sr-map-target)', flexShrink: 0 }} />
                <button
                  onClick={onNavigateToMediaList}
                  style={{
                    fontSize: 14, fontWeight: 700, color: 'var(--sr-accent)',
                    background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                    fontFamily: 'inherit', textDecoration: 'underline',
                    textDecorationColor: 'rgba(45,134,83,0.4)',
                  }}
                >
                  {targetSpecies.length} target species
                </button>
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--sr-text-muted)', marginLeft: 15 }}>from ML export · missing ≥1 media type</div>
            </div>
          )}
        </div>
      )}

      {/* Manual species select — when no ML export */}
      {targetsNoML && (
        <div style={{ marginBottom: 16 }}>
          <SidebarLabel>Target Species</SidebarLabel>
          <div style={{ fontSize: 11.5, color: 'var(--sr-text-muted)', marginBottom: 8, lineHeight: 1.45 }}>
            Upload an ML export in Settings to auto-derive targets, or select species manually.
          </div>
          <input type="text" placeholder="Search species…" value={targetSearch}
            onChange={e => setTargetSearch(e.target.value)}
            style={{ width: '100%', height: 32, padding: '0 10px', border: '1.5px solid var(--sr-border)', borderRadius: 6, fontSize: 12, fontFamily: 'inherit', color: 'var(--sr-text)', background: 'var(--sr-surface)', outline: 'none', boxSizing: 'border-box', marginBottom: 6 }}
          />
          <div style={{ maxHeight: 130, overflowY: 'auto', border: '1.5px solid var(--sr-border)', borderRadius: 6, background: 'var(--sr-surface)' }}>
            {filteredManualSpecies.slice(0, 60).map(s => (
              <label key={s} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '5px 10px', cursor: 'pointer', fontSize: 12 }}>
                <input
                  type="checkbox"
                  checked={manualTargets.has(s)}
                  onChange={e => setManualTargets(prev => {
                    const next = new Set(prev)
                    if (e.target.checked) next.add(s); else next.delete(s)
                    return next
                  })}
                  style={{ flexShrink: 0 }}
                />
                <span style={{ color: 'var(--sr-text)' }}>{s}</span>
              </label>
            ))}
          </div>
          {manualTargets.size > 0 && (
            <div style={{ fontSize: 11, color: 'var(--sr-text-muted)', marginTop: 5 }}>{manualTargets.size} selected</div>
          )}
        </div>
      )}

      <button
        onClick={() => handleFindSightings()}
        disabled={targetsFetchDisabled}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
          width: '100%', height: 36,
          background: 'var(--sr-accent)', color: '#fff',
          border: 'none', borderRadius: 6,
          fontSize: 13, fontWeight: 500, fontFamily: 'inherit',
          cursor: targetsFetchDisabled ? 'not-allowed' : 'pointer',
          opacity: targetsFetchDisabled ? 0.5 : 1,
          marginBottom: 10,
        }}
      >
        {targetsLoading
          ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Finding…</>
          : 'Find Recent Sightings'}
      </button>
      {targetsError && (
        <div style={{ display: 'flex', gap: 6, fontSize: 12, color: 'var(--sr-error)' }}>
          <AlertCircle size={13} style={{ flexShrink: 0, marginTop: 1 }} />
          {targetsError}
        </div>
      )}

      {/* Recency toggle + nearest-10 — shown once pins are loaded */}
      {targetPins !== null && (
        <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--sr-border)' }}>
          {/* Filter by type */}
          <div style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 6 }}>
              <SidebarLabel>Filter by Type</SidebarLabel>
              <span style={{ fontSize: 11, color: 'var(--sr-text-muted)' }}>{displayedTargetPins.length} species</span>
            </div>
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
              <button
                onClick={() => setTargetTypeFilter(new Set())}
                style={{
                  display: 'inline-flex', alignItems: 'center', padding: '3px 9px',
                  borderRadius: 20, fontSize: 11.5, fontWeight: 500,
                  cursor: 'pointer', fontFamily: 'inherit',
                  background: targetTypeFilter.size === 0 ? 'var(--sr-is-target-bg)' : 'var(--sr-surface-subtle)',
                  border: `1.5px solid ${targetTypeFilter.size === 0 ? 'var(--sr-is-target-border)' : 'var(--sr-border)'}`,
                  color: targetTypeFilter.size === 0 ? 'var(--sr-is-target-text)' : 'var(--sr-text-muted)',
                }}
              >
                All
              </button>
              {(['Photo', 'Audio', 'Video'] as const).map(type => {
                const isActive = targetTypeFilter.has(type)
                return (
                  <button
                    key={type}
                    onClick={() => setTargetTypeFilter(prev => {
                      const next = new Set(prev)
                      if (next.has(type)) next.delete(type); else next.add(type)
                      return next
                    })}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 9px',
                      borderRadius: 20, fontSize: 11.5, fontWeight: 500,
                      cursor: 'pointer', fontFamily: 'inherit',
                      background: isActive ? 'var(--sr-is-target-bg)' : 'var(--sr-surface-subtle)',
                      border: `1.5px solid ${isActive ? 'var(--sr-is-target-border)' : 'var(--sr-border)'}`,
                      color: isActive ? 'var(--sr-is-target-text)' : 'var(--sr-text-muted)',
                    }}
                  >
                    <span style={{ display: 'inline-flex' }} dangerouslySetInnerHTML={{ __html: MEDIA_ICONS[type] }} />
                    {type}
                  </button>
                )
              })}
            </div>
          </div>
          <div style={{ marginBottom: 12 }}>
            <SidebarLabel>Time Range</SidebarLabel>
            <SegControl
              options={[{ value: 'all', label: 'Last 30 Days' }, { value: 'week', label: 'Last Week' }]}
              value={targetViewMode}
              onChange={v => { setTargetViewMode(v as 'all' | 'week'); setSelectedTargetKey(null) }}
            />
          </div>
          {nearest10.length > 0 && (
            <div>
              <SidebarLabel>Nearest Targets</SidebarLabel>
              {nearest10.map(({ pin, dist }) => {
                const key = `${pin.speciesCode}-${pin.locId}`
                const tier = recencyTier(pin.recentDate)
                const { bg, text } = tierColors(tier)
                const isSelected = selectedTargetKey === key
                return (
                  <button
                    key={key}
                    onClick={() => { setSelectedTargetKey(key); setPanTarget({ lat: pin.lat, lng: pin.lng }) }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                      padding: '6px 8px', marginBottom: 2, borderRadius: 6,
                      background: isSelected ? 'var(--sr-accent-bg)' : 'transparent',
                      border: `1px solid ${isSelected ? 'var(--sr-accent-border)' : 'transparent'}`,
                      cursor: 'pointer', textAlign: 'left',
                    }}
                  >
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: bg, border: `1px solid ${text === 'white' ? 'transparent' : 'var(--sr-border)'}`, flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--sr-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pin.comName}</div>
                      <div style={{ fontSize: 10, color: 'var(--sr-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pin.locName}</div>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--sr-text-muted)', flexShrink: 0 }}>{dist.toFixed(1)} mi</div>
                  </button>
                )
              })}
            </div>
          )}
          {displayedTargetPins.length === 0 && (
            <div style={{ fontSize: 12, color: 'var(--sr-text-muted)' }}>
              No targets match this filter.
            </div>
          )}
        </div>
      )}
    </div>
  )

  // ── Layout ────────────────────────────────────────────────────────────────────

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, height: '100%' }}>
      {/* Mode bar */}
      <div style={{ display: 'flex', gap: 8, padding: '10px 16px', borderBottom: '1px solid var(--sr-border)', background: 'var(--sr-surface)', flexShrink: 0 }}>
        {([
          { mode: 'sightings' as ViewMode, label: 'My Sightings',  icon: <MapPin size={14} strokeWidth={2.5} /> },
          { mode: 'hotspots' as ViewMode,  label: 'Hotspots',      icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden><circle cx="8" cy="12" r="4"/><circle cx="16" cy="12" r="4"/></svg> },
          { mode: 'targets' as ViewMode,   label: 'Media Targets', icon: <Camera size={14} strokeWidth={2.5} /> },
        ] as { mode: ViewMode; label: string; icon: React.ReactNode }[]).map(({ mode, label, icon }) => (
          <button
            key={mode}
            onClick={() => {
              setViewMode(mode)
              if (mode === 'hotspots' || mode === 'targets') {
                const latNum = parseFloat(lat)
                const lngNum = parseFloat(lng)
                if (!isNaN(latNum) && !isNaN(lngNum)) {
                  setDefaultCenter({ lat: latNum, lng: lngNum, zoom: radiusToZoom(radius) })
                  if (mode === 'hotspots' && !hotspotsLoading && hasEbirdKey !== false) {
                    handleFindHotspots(latNum, lngNum)
                  } else if (mode === 'targets' && !targetsFetchDisabled && phase.tag === 'ready') {
                    handleFindSightings(latNum, lngNum)
                  }
                }
              }
            }}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '7px 14px', borderRadius: 20,
              background: viewMode === mode ? 'var(--sr-accent-bg)' : 'var(--sr-surface-subtle)',
              border: `1.5px solid ${viewMode === mode ? 'var(--sr-accent-border)' : 'transparent'}`,
              color: viewMode === mode ? 'var(--sr-accent)' : 'var(--sr-text-muted)',
              fontWeight: viewMode === mode ? 600 : 400,
              fontSize: 13, fontFamily: 'inherit', cursor: 'pointer', whiteSpace: 'nowrap',
            }}
          >
            {icon}
            {label}
          </button>
        ))}
      </div>

      {/* Content: sidebar + map */}
      <div className="sr-map-content" style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        {/* Backdrop — mobile only, shown when sidebar open */}
        {sidebarOpen && (
          <div
            className="sr-map-backdrop"
            onClick={() => setSidebarOpen(false)}
            aria-hidden="true"
          />
        )}

        {/* Sidebar */}
        <div
          className={`sr-map-sidebar-overlay${sidebarOpen ? '' : ' sr-map-sidebar-hidden'}`}
          style={{ width: 268, flexShrink: 0, borderRight: '1px solid var(--sr-border)', background: 'var(--sr-surface)' }}
        >
          {/* Mobile-only header with close button */}
          <div className="sr-map-sidebar-close">
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--sr-text)' }}>Map Filters</span>
            <button
              onClick={() => setSidebarOpen(false)}
              aria-label="Close filters"
              style={{
                width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'var(--sr-surface-subtle)', border: 'none', borderRadius: '50%',
                cursor: 'pointer', color: 'var(--sr-text-muted)',
              }}
            >
              <X size={14} />
            </button>
          </div>
          {viewMode === 'sightings' && sightingsSidebar}
          {viewMode === 'hotspots' && hotspotsSidebar}
          {viewMode === 'targets'  && targetsSidebar}
        </div>

        {/* Map area */}
        <div style={{ flex: 1, position: 'relative' }}>
          {/* Floating Filters button — mobile only, hidden while sidebar is open */}
          {!sidebarOpen && (
            <button
              className="sr-map-filters-btn"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open map filters"
            >
              <Filter size={14} strokeWidth={2.5} />
              Filters
            </button>
          )}
          {isSetupRequired && viewMode === 'sightings' ? (
            <SetupRequired
              title="eBird Backup Required"
              body="Map Explorer needs your eBird backup to show your sightings on the map. Hotspot and Media Targets modes also benefit from a backup for visited classification."
              steps={[
                <>Visit <strong>ebird.org</strong> → My eBird → Download My Data</>,
                'Extract the ZIP and locate your eBird observations CSV.',
                'Upload it in Settings.',
              ]}
              onGoToSettings={onGoToSettings}
            />
          ) : (
            <MapContainer
              center={[45, -100]}
              zoom={4}
              style={{ height: '100%', width: '100%' }}
              zoomControl
            >
              <AutoSizeMap />
              <MapPanner target={panTarget} onDone={handlePanDone} />
              <DefaultCenterSetter center={defaultCenter} onDone={handleDefaultCenterDone} />
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              {viewMode === 'sightings' && !isSetupRequired && (
                <SightingMarkers locations={filteredLocations} displayMode={displayMode} />
              )}
              {viewMode === 'hotspots' && hotspotPins && (
                <HotspotMarkers key={hotspotPins.length} pins={hotspotPins} hiddenKinds={hiddenKinds} />
              )}
              {viewMode === 'targets' && targetPins && (
                <TargetMarkers key={`${targetPins.length}-${targetViewMode}`} pins={displayedTargetPins} />
              )}
            </MapContainer>
          )}
        </div>
      </div>
    </div>
  )
}
