import { Marker, Popup, Source, Layer, useMap } from 'react-map-gl/maplibre'
import type { HeatmapLayerSpecification } from 'maplibre-gl'
import type { FeatureCollection, Point } from 'geojson'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AlertCircle, Camera, ChevronDown, Crosshair, ExternalLink, Filter, Loader2, Maximize2, Minimize2, MapPin, Navigation, Search, X } from 'lucide-react'
import { SetupRequired } from './SetupRequired'
import { EBIRD_BACKUP_STEPS } from './setupCopy'
import { loadEbirdObservations } from '../lib/observationsCache'
import { parseMLExport } from '../lib/parseMLExport'
import type { MLExportRow } from '../lib/parseMLExport'
import type { ObservationEntry } from '../types'
import { BREEDING_CODES } from '../lib/breedingCodes'
import { transport, TransportError } from '../lib/transport'
import { storage } from '../lib/storage'
import { getCurrentLocation } from '../lib/location'
import type { LocationError } from '../lib/location'
import { isWindows } from '../lib/platform'
import { SnowMap } from './SnowMap'
import { AtlasLayer } from './AtlasLayer'
import type { AtlasData } from '../lib/atlasBlocks'
import { buildBreedingByBlock } from '../lib/atlasBreeding'
import { HEAT_INTENSITY_DEFAULT, heatWeight, heatRadiusPx, heatIntensityFactor } from '../lib/heat'
import { normalizeSpeciesName } from '../lib/speciesUtils'
import { BirdName } from './BirdName'

// Teardrop SVG path (28×40 viewBox) — circle top, pointed bottom
const TEARDROP = 'M14 0C6.268 0 0 6.268 0 14c0 5.47 3.078 10.23 7.602 12.651L14 40l6.398-13.349A13.944 13.944 0 0028 14C28 6.268 21.732 0 14 0z'

function teardropHtml(colorVar: string, glyphSvg: string): string {
  return `<svg viewBox="0 0 28 40" width="28" height="40" xmlns="http://www.w3.org/2000/svg"><path d="${TEARDROP}" style="fill:${colorVar}"/>${glyphSvg}</svg>`
}

// Teardrop marker SVGs (CSS vars resolve at paint time). Rendered into a
// react-map-gl <Marker> with anchor="bottom" so the tip points at the coord.
const TEARDROP_HTML: Record<HotspotPin['kind'], string> = {
  visited: teardropHtml('var(--sr-map-visited)', '<polyline points="8,15 12,19 20,11" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>'),
  unvisited: teardropHtml('var(--sr-map-unvisited)', '<circle cx="10" cy="13" r="3.5" fill="white"/><circle cx="18" cy="13" r="3.5" fill="white"/>'),
  personal: teardropHtml('var(--sr-map-personal)', '<polygon points="14,6 15.5,11 20.5,11 16.5,14.2 18,19 14,16 10,19 11.5,14.2 7.5,11 12.5,11" fill="white"/>'),
}

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
  /** True when the map occupies the full viewport (mobile fullscreen). */
  isFullscreen?: boolean
  /** Toggle mobile fullscreen. When absent, the fullscreen button is hidden. */
  onToggleFullscreen?: () => void
  /** Navigate to + select a species on the Species Detail tab. */
  onOpenSpecies?: (commonName: string) => void
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

// Imperative map effects (pan-to a target, jump to default center). react-map-gl
// auto-resizes the canvas, so no AutoSizeMap is needed. setState callbacks are
// deferred to a microtask so they don't run synchronously inside the effect.
function MapEffects({ panTarget, onPanDone, defaultCenter, onDefaultDone }: {
  panTarget: { lat: number; lng: number } | null
  onPanDone: () => void
  defaultCenter: { lat: number; lng: number; zoom: number } | null
  onDefaultDone: () => void
}) {
  const map = useMap().current
  useEffect(() => {
    if (!panTarget || !map) return
    map.flyTo({ center: [panTarget.lng, panTarget.lat], duration: 600 })
    queueMicrotask(onPanDone)
  }, [panTarget, map, onPanDone])
  useEffect(() => {
    if (!defaultCenter || !map) return
    map.flyTo({ center: [defaultCenter.lng, defaultCenter.lat], zoom: defaultCenter.zoom, duration: 0 })
    queueMicrotask(onDefaultDone)
  }, [defaultCenter, map, onDefaultDone])
  return null
}

function DetectedLocationPin({ position }: { position: { lat: number; lng: number } }) {
  return (
    <Marker longitude={position.lng} latitude={position.lat} anchor="center">
      <div style={{ width: 18, height: 18, borderRadius: '50%', background: '#1D6BCC', border: '2.5px solid #fff', boxShadow: '0 1px 4px rgba(0,0,0,0.4)' }} />
    </Marker>
  )
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
          style={{ flex: 1, height: 34, padding: '0 8px', border: '1.5px solid var(--sr-border)', borderRadius: 6, fontSize: '0.75rem', fontFamily: 'inherit', color: 'var(--sr-text)', background: 'var(--sr-surface)', outline: 'none', minWidth: 0 }}
        />
        <button tabIndex={0}
          onClick={handleSearch}
          disabled={loading || !query.trim()}
          title="Search"
          style={{
            width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: loading || !query.trim() ? 'var(--sr-surface-subtle)' : 'var(--sr-accent)',
            color: loading || !query.trim() ? 'var(--sr-text-muted)' : 'var(--sr-on-accent)',
            border: '1.5px solid var(--sr-border)', borderRadius: 6,
            cursor: loading || !query.trim() ? 'not-allowed' : 'pointer', flexShrink: 0,
          }}
        >
          <Search size={14} strokeWidth={2} />
        </button>
      </div>
      {error && <div style={{ fontSize: '0.6875rem', color: 'var(--sr-error)', marginTop: 4 }}>{error}</div>}
    </div>
  )
}

// Heatmap radius/intensity model (shared with the Species Detail map) lives in
// lib/heat.ts — heatRadiusPx, heatIntensityFactor, heatWeight — so the 1–10
// slider behaves identically in both places.

function SightingMarkers({ locations, displayMode, heatIntensity, atlasShading }: { locations: LocationGroup[]; displayMode: DisplayMode; heatIntensity: number; atlasShading: boolean }) {
  const map = useMap().current
  const hasFitted = useRef(false)
  const [sel, setSel] = useState<string | null>(null)

  useEffect(() => {
    if (hasFitted.current || !map || locations.length === 0) return
    hasFitted.current = true
    if (locations.length === 1) {
      map.flyTo({ center: [locations[0].lng, locations[0].lat], zoom: 12, duration: 0 })
    } else {
      let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity
      for (const l of locations) { minLng = Math.min(minLng, l.lng); maxLng = Math.max(maxLng, l.lng); minLat = Math.min(minLat, l.lat); maxLat = Math.max(maxLat, l.lat) }
      map.fitBounds([[minLng, minLat], [maxLng, maxLat]], { padding: 50, duration: 0 })
    }
  }, [locations, map])

  const heatFc = useMemo<FeatureCollection<Point, { w: number }>>(() => ({
    type: 'FeatureCollection',
    features: locations.map(l => ({
      type: 'Feature', properties: { w: heatWeight(l.count, heatIntensity) },
      geometry: { type: 'Point', coordinates: [l.lng, l.lat] },
    })),
  }), [locations, heatIntensity])

  if (displayMode === 'heatmap') {
    return (
      <Source id="sr-heat" type="geojson" data={heatFc}>
        {/* When atlas breeding shading is on, sit the heatmap UNDER the atlas fill
            (beforeId) and dim it, so the tier colors read on top. */}
        <Layer id="sr-heat" type="heatmap"
          beforeId={atlasShading ? 'sr-atlas-fill' : undefined}
          paint={{
          'heatmap-weight': ['get', 'w'],
          'heatmap-intensity': heatIntensityFactor(heatIntensity),
          'heatmap-radius': heatRadiusPx(heatIntensity),
          'heatmap-opacity': atlasShading ? 0.45 : 0.85,
        } as HeatmapLayerSpecification['paint']} />
      </Source>
    )
  }

  const selLoc = sel ? locations.find(l => l.locId === sel) : null
  return (
    <>
      {locations.map(loc => (
        <Marker key={loc.locId} longitude={loc.lng} latitude={loc.lat} anchor="center"
          onClick={e => { e.originalEvent.stopPropagation(); setSel(loc.locId) }}>
          <div style={{ width: pinRadius(loc.count) * 2, height: pinRadius(loc.count) * 2, borderRadius: '50%', background: '#2D8653', opacity: pinOpacity(loc.count) * (atlasShading ? 0.25 : 1), border: '2px solid #fff', cursor: 'pointer', boxSizing: 'border-box' }} />
        </Marker>
      ))}
      {selLoc && (
        <Popup longitude={selLoc.lng} latitude={selLoc.lat} anchor="bottom" offset={10} onClose={() => setSel(null)} closeButton={false} maxWidth="260px">
          <div style={{ minWidth: 190 }}>
            <div style={{ fontWeight: 700, fontSize: '0.8125rem', marginBottom: 6 }}>{selLoc.locName}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--sr-accent)', marginBottom: 3 }}>
              {selLoc.count.toLocaleString()} observation{selLoc.count !== 1 ? 's' : ''}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--sr-text-muted)', marginBottom: 10 }}>Last: {fmtDate(selLoc.lastDate)}</div>
            <div style={{ fontSize: '0.625rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--sr-text-muted)', marginBottom: 5 }}>Species seen here</div>
            {[...selLoc.species].slice(0, 5).map(s => (
              <div key={s} style={{ fontSize: '0.75rem', color: 'var(--sr-text)', marginBottom: 2 }}>{s}</div>
            ))}
            {selLoc.species.size > 5 && (
              <div style={{ fontSize: '0.75rem', color: 'var(--sr-text-muted)', marginTop: 2 }}>+{selLoc.species.size - 5} more species</div>
            )}
          </div>
        </Popup>
      )}
    </>
  )
}

function HotspotMarkers({ pins, hiddenKinds }: { pins: HotspotPin[]; hiddenKinds: Set<HotspotPin['kind']> }) {
  const map = useMap().current
  const fitKey = pins.length
  const [sel, setSel] = useState<number | null>(null)

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

  const visiblePins = pins.filter(p => !hiddenKinds.has(p.kind))
  const selPin = sel !== null ? visiblePins[sel] : null

  return (
    <>
      {visiblePins.map((pin, i) => (
        <Marker key={`${pin.kind}-${pin.locId}-${i}`} longitude={pin.lng} latitude={pin.lat} anchor="bottom"
          onClick={e => { e.originalEvent.stopPropagation(); setSel(i) }}>
          <div style={{ width: 28, height: 40, cursor: 'pointer' }} dangerouslySetInnerHTML={{ __html: TEARDROP_HTML[pin.kind] }} />
        </Marker>
      ))}
      {selPin && (
        <Popup longitude={selPin.lng} latitude={selPin.lat} anchor="bottom" offset={42} onClose={() => setSel(null)} closeButton={false} maxWidth="260px">
          <div style={{ minWidth: 190 }}>
            <div style={{ fontWeight: 700, fontSize: '0.8125rem', marginBottom: 8 }}>{selPin.locName}</div>
            {selPin.kind === 'visited' && (
              <>
                <div style={{ fontSize: '0.75rem', color: 'var(--sr-accent)', marginBottom: 3 }}>{selPin.speciesCount} species recorded</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--sr-text-muted)', marginBottom: 8 }}>Last visit: {fmtDate(selPin.lastVisit)}</div>
                <a href={`https://ebird.org/hotspot/${selPin.locId}`} target="_blank" rel="noreferrer" style={{ fontSize: '0.75rem', color: 'var(--sr-accent)', textDecoration: 'none', fontWeight: 500 }}>View on eBird →</a>
              </>
            )}
            {selPin.kind === 'unvisited' && (
              <a href={`https://ebird.org/hotspot/${selPin.locId}`} target="_blank" rel="noreferrer" style={{ fontSize: '0.75rem', color: 'var(--sr-accent)', textDecoration: 'none', fontWeight: 500 }}>View on eBird →</a>
            )}
            {selPin.kind === 'personal' && (
              <>
                <div style={{ display: 'inline-block', background: 'var(--sr-is-target-bg)', border: '1px solid var(--sr-warning-subtle)', color: 'var(--sr-map-personal)', borderRadius: 4, padding: '2px 6px', fontSize: '0.6875rem', fontWeight: 600, marginBottom: 8 }}>Personal Location</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--sr-text-muted)', marginBottom: 3 }}>{selPin.obsCount} observation{selPin.obsCount !== 1 ? 's' : ''}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--sr-text-muted)' }}>Last visit: {fmtDate(selPin.lastVisit)}</div>
              </>
            )}
          </div>
        </Popup>
      )}
    </>
  )
}

function TargetMarkers({ pins, speciesCodeMap, hasEntryFor, onOpenSpecies }: {
  pins: DisplayTargetPin[]
  speciesCodeMap: Record<string, string>
  hasEntryFor: (name: string) => boolean
  onOpenSpecies?: (commonName: string) => void
}) {
  const map = useMap().current
  const fitKey = pins.length
  const [sel, setSel] = useState<number | null>(null)

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

  const selGroup = sel !== null ? locationGroups[sel] : null
  const selRep = selGroup ? selGroup.reduce((best, p) => p.recentDate > best.recentDate ? p : best) : null

  return (
    <>
      {locationGroups.map((group, i) => {
        const rep = group.reduce((best, p) => p.recentDate > best.recentDate ? p : best)
        const { bg, text } = tierColors(recencyTier(rep.recentDate))
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
        return (
          <Marker key={`${rep.locId}-${i}`} longitude={rep.lng} latitude={rep.lat} anchor="left"
            onClick={e => { e.originalEvent.stopPropagation(); setSel(i) }}>
            <div
              style={{ display: 'inline-flex', alignItems: 'center', background: bg, color: text, padding: '3px 8px', borderRadius: 10, fontSize: '0.6875rem', fontWeight: 600, whiteSpace: 'nowrap', border: '1.5px solid rgba(255,255,255,0.85)', boxShadow: '0 2px 6px rgba(0,0,0,0.35),0 0 0 1px rgba(0,0,0,0.1)', cursor: 'pointer' }}
              dangerouslySetInnerHTML={{ __html: labelHtml }}
            />
          </Marker>
        )
      })}
      {selGroup && selRep && (
        <Popup longitude={selRep.lng} latitude={selRep.lat} anchor="bottom" offset={14} onClose={() => setSel(null)} closeButton={false} maxWidth="280px">
              <div style={{ minWidth: 200, maxWidth: 260 }}>
                <div style={{ fontSize: '0.6875rem', color: 'var(--sr-text-muted)', marginBottom: 8 }}>📍 {selRep.locName}</div>
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
                          <span key={t} style={{ display: 'inline-flex', alignItems: 'center', padding: '0 4px', background: 'var(--sr-surface-subtle)', borderRadius: 4, fontSize: '0.625rem', color: 'var(--sr-text-muted)', gap: 2 }}>
                            {t === 'Photo' && <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/></svg>}
                            {t === 'Audio' && <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/></svg>}
                            {t === 'Video' && <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m22 8-6 4 6 4V8z"/><rect width="14" height="12" x="2" y="6" rx="2" ry="2"/></svg>}
                          </span>
                        ))}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: validSubId ? 4 : 0 }}>
                        <span style={{ display: 'inline-block', background: pinBg, color: pinText, padding: '1px 6px', borderRadius: 6, fontSize: '0.625rem', fontWeight: 600 }}>{tierLabel}</span>
                        <span style={{ fontSize: '0.625rem', color: 'var(--sr-text-muted)' }}>{fmtDate(pin.recentDate)}</span>
                      </div>
                      {validSubId && (
                        <a href={`https://ebird.org/checklist/${pin.subId}`} target="_blank" rel="noreferrer" style={{ fontSize: '0.6875rem', color: 'var(--sr-accent)', textDecoration: 'none', fontWeight: 500 }}>
                          View checklist {pin.subId} →
                        </a>
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

// ── Shared UI primitives ───────────────────────────────────────────────────────

function SegControl({ options, value, onChange }: {
  options: { value: string; label: string }[]
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div style={{ display: 'flex', background: 'var(--sr-surface-subtle)', borderRadius: 6, padding: 2 }}>
      {options.map(opt => (
        <button tabIndex={0}
          key={opt.value}
          onClick={() => onChange(opt.value)}
          style={{
            flex: 1, height: 28, padding: '0 4px',
            background: value === opt.value ? 'var(--sr-surface)' : 'transparent',
            border: `1px solid ${value === opt.value ? 'var(--sr-border)' : 'transparent'}`,
            borderRadius: 5, fontSize: '0.71875rem',
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
  fontSize: '0.8125rem', fontFamily: 'inherit', color: 'var(--sr-text)',
  background: `var(--sr-surface) url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2371717A' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E") no-repeat right 8px center`,
  appearance: 'none', WebkitAppearance: 'none',
  outline: 'none', cursor: 'pointer', boxSizing: 'border-box',
}

function SidebarLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: '0.6875rem', fontWeight: 700, textTransform: 'uppercase',
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
      fontSize: '0.75rem', color: 'var(--sr-warning)', marginBottom: 14,
    }}>
      <div style={{ display: 'flex', gap: 7, alignItems: 'flex-start' }}>
        <AlertCircle size={13} style={{ flexShrink: 0, marginTop: 1 }} />
        <span>eBird API key required. Add it in Settings to use this feature.</span>
      </div>
      <button tabIndex={0}
        onClick={onGoToSettings}
        style={{
          background: 'none', border: 'none', padding: 0, fontSize: '0.6875rem', fontWeight: 600,
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

// Legend swatch previewing a tier's hatch (when "Use Textures" is on). Drawn
// directly (no <pattern> ids) so it's safe to render in any sidebar, and tinted
// with the --sr-tier-N-rgb tokens so it tracks light/dark. Mirrors the on-map
// hatch density: dots (1) → diagonal (2) → cross (3) → dense cross (4).
function TierHatchSwatch({ tier }: { tier: 1 | 2 | 3 | 4 }) {
  const rgb = `var(--sr-tier-${tier}-rgb)`
  const fillStyle = { fill: `rgba(${rgb}, 0.16)` }
  const dotStyle = { fill: `rgba(${rgb}, 0.9)` }
  const lineStyle = { stroke: `rgba(${rgb}, 0.7)`, strokeWidth: tier === 2 ? 1 : 0.8 }
  const step = tier === 2 ? 10 : tier === 3 ? 9 : 6
  const offsets: number[] = []
  for (let x = -14; x < 24; x += step) offsets.push(x)
  return (
    <svg width={24} height={14} aria-hidden
      style={{ flexShrink: 0, border: '1px solid var(--sr-border-medium)', borderRadius: 3, display: 'block', overflow: 'hidden' }}>
      <rect x={0} y={0} width={24} height={14} style={fillStyle} />
      {tier === 1
        ? [5, 12, 19].flatMap(cx => [4.5, 10].map(cy => <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={1.1} style={dotStyle} />))
        : offsets.map(x => <line key={`a${x}`} x1={x} y1={14} x2={x + 14} y2={0} style={lineStyle} />)}
      {tier >= 3 && offsets.map(x => <line key={`b${x}`} x1={x} y1={0} x2={x + 14} y2={14} style={lineStyle} />)}
    </svg>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export function MapExplorer({ onGoToSettings, onNavigateToMediaList, keysVersion, isFullscreen, onToggleFullscreen, onOpenSpecies }: MapExplorerProps) {
  const [phase, setPhase] = useState<MapPhase>({ tag: 'loading-saved' })
  const [viewMode, setViewMode] = useState<ViewMode>('sightings')
  const [displayMode, setDisplayMode] = useState<DisplayMode>('pins')
  const [heatIntensity, setHeatIntensity] = useState(HEAT_INTENSITY_DEFAULT)

  const sidebarRef = useRef<HTMLDivElement>(null)
  const filtersButtonRef = useRef<HTMLButtonElement>(null)

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
  const [isLocating, setIsLocating] = useState(false)

  // Hotspot state
  const [hotspotPins, setHotspotPins]         = useState<HotspotPin[] | null>(null)
  const [hotspotsLoading, setHotspotsLoading] = useState(false)
  const [hotspotsError, setHotspotsError]     = useState('')
  const [legendVisible, setLegendVisible]     = useState(false)
  const [hiddenKinds, setHiddenKinds]         = useState<Set<HotspotPin['kind']>>(new Set())

  // Atlas block overlay state (California Breeding Bird Atlas)
  const [atlasEnabled, setAtlasEnabled]       = useState(false)
  const [atlasData, setAtlasData]             = useState<AtlasData | null>(null)
  const [atlasLoading, setAtlasLoading]       = useState(false)
  const [shadeByBreeding, setShadeByBreeding] = useState(false)
  const [useTextures, setUseTextures]         = useState(false)

  // Target state
  const [targetPins, setTargetPins]           = useState<TargetPin[] | null>(null)
  const [targetsLoading, setTargetsLoading]   = useState(false)
  const [targetsError, setTargetsError]       = useState('')
  const [manualTargets, setManualTargets]     = useState<Set<string>>(new Set())
  const [targetSearch, setTargetSearch]       = useState('')
  const [targetViewMode, setTargetViewMode]   = useState<'all' | 'week'>('all')
  const [selectedTargetKey, setSelectedTargetKey] = useState<string | null>(null)
  const [targetTypeFilter, setTargetTypeFilter] = useState<Set<'Photo' | 'Audio' | 'Video'>>(new Set())

  // Map pan target (set by sidebar clicks, consumed by MapEffects inside SnowMap)
  const [panTarget, setPanTarget]             = useState<{ lat: number; lng: number } | null>(null)
  const handlePanDone                         = useCallback(() => setPanTarget(null), [])

  // Detected location pin (set by "Use my location", cleared when user edits coords manually)
  const [detectedLocation, setDetectedLocation] = useState<{ lat: number; lng: number } | null>(null)

  // Mobile sidebar overlay state
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // Focus trap for mobile sidebar
  useEffect(() => {
    if (!sidebarOpen) return
    const sidebar = sidebarRef.current
    if (!sidebar) return

    const focusable = sidebar.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    first?.focus()

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSidebarOpen(false)
        filtersButtonRef.current?.focus()
      }
      if (e.key === 'Tab') {
        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault()
            last?.focus()
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault()
            first?.focus()
          }
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [sidebarOpen])

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

  // Pre-fill lat/lng/radius from saved map defaults on mount. We do NOT pan the
  // map to the saved search center here: the landing mode is My Sightings, which
  // fits to all of the user's sightings. Panning to the saved center would win
  // the async race against that fit and leave the map zoomed in on load. The
  // saved center is applied when the user switches to Hotspots/Targets (below).
  useEffect(() => {
    storage.getSetting<{ lat: number; lng: number; dist: number }>('map-defaults')
      .then(data => {
        if (data && typeof data.lat === 'number' && typeof data.lng === 'number' && typeof data.dist === 'number') {
          setLat(String(data.lat))
          setLng(String(data.lng))
          setRadius(data.dist)
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

        const [ebird, mlText] = await Promise.all([
          loadEbirdObservations(),
          status.ml ? storage.readFile('ml') : Promise.resolve(null),
        ])
        if (!ebird || cancelled) { setPhase({ tag: 'setup-required' }); return }

        const observations = ebird.observations

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

  // Normalized names the user has recorded (⇒ they have a Species Detail entry).
  const recordedNames = useMemo(
    () => phase.tag === 'ready'
      ? new Set(phase.observations.map(o => normalizeSpeciesName(o.commonName)))
      : new Set<string>(),
    [phase],
  )
  const hasEntryFor = useCallback((name: string) => recordedNames.has(normalizeSpeciesName(name)), [recordedNames])

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

  // Ten closest UNVISITED hotspots from the current hotspot search, by distance
  // from the center point. Rendered in the Hotspots sidebar as eBird links.
  const nearestUnvisited = useMemo(() => {
    const latNum = parseFloat(lat)
    const lngNum = parseFloat(lng)
    if (isNaN(latNum) || isNaN(lngNum) || !hotspotPins) return []
    return hotspotPins
      .filter((p): p is Extract<HotspotPin, { kind: 'unvisited' }> => p.kind === 'unvisited')
      .map(pin => ({ pin, dist: distanceMiles(latNum, lngNum, pin.lat, pin.lng) }))
      .sort((a, b) => a.dist - b.dist)
      .slice(0, 10)
  }, [hotspotPins, lat, lng])

  // Atlas overlay toggle — lazy-loads the block gazetteer on first enable so it
  // never affects initial app load, then just shows/hides the layer.
  const handleToggleAtlas = useCallback(async () => {
    const next = !atlasEnabled
    setAtlasEnabled(next)
    if (!next) setShadeByBreeding(false) // shading is meaningless without the overlay
    if (next && !atlasData && !atlasLoading) {
      setAtlasLoading(true)
      try {
        const mod = await import('../assets/ca-atlas-blocks.json')
        setAtlasData(((mod as { default?: unknown }).default ?? mod) as unknown as AtlasData)
      } catch {
        // Asset failed to load — leave data null; the overlay simply won't draw.
      } finally {
        setAtlasLoading(false)
      }
    }
  }, [atlasEnabled, atlasData, atlasLoading])

  // Map of atlas block code → the user's highest breeding evidence there. Computed
  // once from the loaded backup + gazetteer; drives the "shade by breeding" overlay.
  const breedingByBlock = useMemo(
    () => (atlasData && phase.tag === 'ready' ? buildBreedingByBlock(atlasData, phase.observations) : null),
    [atlasData, phase],
  )

  // ── Actions ───────────────────────────────────────────────────────────────────

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
        const d = await transport.post<{ codes: Record<string, string> }>('/taxonomy/codes', { species })
        setSpeciesCodeMap(prev => ({ ...prev, ...d.codes }))
        codes = names.map(n => d.codes[n]).filter(Boolean).join(',')
      } catch (err) {
        setTargetsError(err instanceof Error ? err.message : 'Could not load eBird taxonomy.')
        return
      }
    }
    if (!codes) { setTargetsError('No eBird species codes found for the selected species.'); return }

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

  const handleUseMyLocation = useCallback(async () => {
    setGeoError('')
    setIsLocating(true)
    const wasEmpty = !lat && !lng
    try {
      const loc = await getCurrentLocation()
      setLat(loc.lat.toFixed(5))
      setLng(loc.lng.toFixed(5))
      setDetectedLocation({ lat: loc.lat, lng: loc.lng })
      setPanTarget({ lat: loc.lat, lng: loc.lng })
      if (wasEmpty) {
        if (viewMode === 'hotspots') handleFindHotspots(loc.lat, loc.lng)
        else if (viewMode === 'targets') handleFindSightings(loc.lat, loc.lng)
      }
    } catch (err) {
      const e = err as LocationError
      if (e.code === 'permission-denied') {
        setGeoError(
          e.platform === 'tauri'
            ? (isWindows()
                ? 'Turn on location in Windows Settings → Privacy & security → Location, then try again.'
                : 'Location access was denied. Grant permission in System Settings → Privacy & Security → Location Services.')
            : 'Location access was denied. Allow location access in your browser settings.',
        )
      } else if (e.code === 'timeout') {
        setGeoError('Location request timed out. Try again or enter coordinates manually.')
      } else if (e.code === 'dev-mode') {
        setGeoError("Location requires a production build. Run 'npm run desktop:build' to test.")
      } else if (e.code === 'insecure-context') {
        setGeoError('Location requires HTTPS. Enter coordinates manually or access the app via localhost.')
      } else {
        setGeoError('Unable to determine your location. Try again or enter coordinates manually.')
      }
    } finally {
      setIsLocating(false)
    }
  }, [lat, lng, viewMode, handleFindHotspots, handleFindSightings, setPanTarget, setDetectedLocation])

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
      <button tabIndex={0}
        onClick={handleUseMyLocation}
        disabled={isLocating}
        style={{
          display: 'flex', alignItems: 'center', gap: 7,
          width: '100%', height: 34, padding: '0 12px',
          background: isLocating ? 'var(--sr-surface-subtle)' : 'none',
          border: '1.5px solid var(--sr-border)',
          borderRadius: 6, fontSize: '0.78125rem', fontWeight: 500,
          fontFamily: 'inherit',
          color: isLocating ? 'var(--sr-text-muted)' : 'var(--sr-text)',
          cursor: isLocating ? 'default' : 'pointer',
          marginBottom: 8, boxSizing: 'border-box',
        }}
      >
        {isLocating
          ? <Loader2 size={13} strokeWidth={2} style={{ animation: 'spin 0.7s linear infinite', color: 'var(--sr-accent)', flexShrink: 0 }} />
          : <Navigation size={13} strokeWidth={2} style={{ color: 'var(--sr-accent)', flexShrink: 0 }} />
        }
        {isLocating ? 'Locating…' : 'Use my location'}
      </button>
      {geoError && <div style={{ fontSize: '0.6875rem', color: 'var(--sr-error)', marginBottom: 6 }}>{geoError}</div>}
      <div style={{ display: 'flex', gap: 6 }}>
        <input type="number" placeholder="Latitude" value={lat} onChange={e => { setLat(e.target.value); setDetectedLocation(null) }}
          style={{ flex: 1, height: 34, padding: '0 8px', border: '1.5px solid var(--sr-border)', borderRadius: 6, fontSize: '0.75rem', fontFamily: 'inherit', color: 'var(--sr-text)', background: 'var(--sr-surface)', outline: 'none', minWidth: 0 }} />
        <input type="number" placeholder="Longitude" value={lng} onChange={e => { setLng(e.target.value); setDetectedLocation(null) }}
          style={{ flex: 1, height: 34, padding: '0 8px', border: '1.5px solid var(--sr-border)', borderRadius: 6, fontSize: '0.75rem', fontFamily: 'inherit', color: 'var(--sr-text)', background: 'var(--sr-surface)', outline: 'none', minWidth: 0 }} />
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

  // Shared atlas overlay controls (atlas blocks + shade-by-breeding + textures +
  // legend). Rendered in all three mode sidebars; the map layer itself already
  // renders in every mode. State is shared across modes.
  const atlasOverlayControls = (
    <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--sr-border)' }}>
      <SidebarLabel>Map Overlays</SidebarLabel>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <span style={{ fontSize: '0.8125rem', fontWeight: 500, color: 'var(--sr-text)' }}>California atlas blocks</span>
        <button
          type="button"
          role="switch"
          aria-checked={atlasEnabled}
          aria-label="Show California atlas blocks"
          tabIndex={0}
          onClick={handleToggleAtlas}
          style={{
            width: 38, height: 22, borderRadius: 11, border: 'none', flexShrink: 0,
            background: atlasEnabled ? 'var(--sr-accent)' : 'var(--sr-border-medium)',
            position: 'relative', cursor: 'pointer', transition: 'background 0.15s',
          }}
        >
          <span style={{
            position: 'absolute', top: 2, left: atlasEnabled ? 18 : 2, width: 18, height: 18,
            borderRadius: '50%', background: '#fff', transition: 'left 0.15s',
          }} />
        </button>
      </div>
      <div style={{ fontSize: '0.6875rem', color: 'var(--sr-text-muted)', marginTop: 6, lineHeight: 1.4 }}>
        {atlasLoading
          ? 'Loading atlas blocks…'
          : 'California Breeding Bird Atlas blocks. Shown for the current map area.'}
      </div>

      {/* Shade-by-breeding toggle — only when the atlas overlay is on */}
      {atlasEnabled && (() => {
        const backupReady = phase.tag === 'ready'
        return (
          <div style={{ marginTop: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, opacity: backupReady ? 1 : 0.55 }}>
              <span style={{ fontSize: '0.8125rem', fontWeight: 500, color: 'var(--sr-text)' }}>Shade by My Highest Breeding Code</span>
              <button
                type="button"
                role="switch"
                aria-checked={shadeByBreeding}
                aria-label="Shade atlas blocks by my highest breeding code"
                disabled={!backupReady}
                tabIndex={0}
                onClick={() => backupReady && setShadeByBreeding(v => !v)}
                style={{
                  width: 38, height: 22, borderRadius: 11, border: 'none', flexShrink: 0,
                  background: shadeByBreeding ? 'var(--sr-accent)' : 'var(--sr-border-medium)',
                  position: 'relative', cursor: backupReady ? 'pointer' : 'not-allowed', transition: 'background 0.15s',
                }}
              >
                <span style={{
                  position: 'absolute', top: 2, left: shadeByBreeding ? 18 : 2, width: 18, height: 18,
                  borderRadius: '50%', background: '#fff', transition: 'left 0.15s',
                }} />
              </button>
            </div>
            <div style={{ fontSize: '0.6875rem', color: 'var(--sr-text-muted)', marginTop: 6, lineHeight: 1.4 }}>
              {backupReady
                ? "Based only on breeding codes you've personally entered."
                : 'Load your eBird backup in Settings to use this.'}
            </div>
            {shadeByBreeding && backupReady && (
              <>
                {/* Use Textures — per-tier hatch patterns; off by default (colorblind aid) */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 12 }}>
                  <span style={{ fontSize: '0.8125rem', fontWeight: 500, color: 'var(--sr-text)' }}>Use Textures</span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={useTextures}
                    aria-label="Use textures on shaded atlas blocks"
                    tabIndex={0}
                    onClick={() => setUseTextures(v => !v)}
                    style={{
                      width: 38, height: 22, borderRadius: 11, border: 'none', flexShrink: 0,
                      background: useTextures ? 'var(--sr-accent)' : 'var(--sr-border-medium)',
                      position: 'relative', cursor: 'pointer', transition: 'background 0.15s',
                    }}
                  >
                    <span style={{
                      position: 'absolute', top: 2, left: useTextures ? 18 : 2, width: 18, height: 18,
                      borderRadius: '50%', background: '#fff', transition: 'left 0.15s',
                    }} />
                  </button>
                </div>
                <div style={{ fontSize: '0.6875rem', color: 'var(--sr-text-muted)', marginTop: 6, lineHeight: 1.4 }}>
                  Adds a distinct hatch per level so blocks are distinguishable without color.
                </div>

                <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 5 }}>
                  {([
                    { tier: 4, label: 'Confirmed (nest / young)' },
                    { tier: 3, label: 'Confirmed (nest building)' },
                    { tier: 2, label: 'Probable' },
                    { tier: 1, label: 'Possible' },
                  ] as const).map(row => (
                    <div key={row.tier} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.75rem' }}>
                      {useTextures
                        ? <TierHatchSwatch tier={row.tier} />
                        : (
                          <svg width="24" height="14" style={{ flexShrink: 0, border: '1px solid var(--sr-border-medium)', borderRadius: 3 }}>
                            <rect width="24" height="14" className={`sr-atlas-fill-${row.tier}`} />
                          </svg>
                        )}
                      <span style={{ color: 'var(--sr-text-muted)' }}>{row.label}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )
      })()}
    </div>
  )

  const sightingsSidebar = (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
        {/* Collapsible filter panel */}
        <div>
          <button tabIndex={0}
            onClick={() => setFilterOpen(o => !o)}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              width: '100%', padding: '12px 16px',
              background: 'none', border: 'none',
              borderBottom: `1px solid var(--sr-border)`,
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            <span style={{ fontSize: '0.6875rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--sr-text-muted)' }}>Filters</span>
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
                    style={{ flex: 1, height: 34, padding: '0 8px', border: '1.5px solid var(--sr-border)', borderRadius: 6, fontSize: '0.75rem', fontFamily: 'inherit', color: 'var(--sr-text)', background: 'var(--sr-surface)', outline: 'none', minWidth: 0 }} />
                  <input type="text" placeholder="YYYY-MM-DD" value={dateTo} onChange={e => setDateTo(e.target.value)}
                    style={{ flex: 1, height: 34, padding: '0 8px', border: '1.5px solid var(--sr-border)', borderRadius: 6, fontSize: '0.75rem', fontFamily: 'inherit', color: 'var(--sr-text)', background: 'var(--sr-surface)', outline: 'none', minWidth: 0 }} />
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
          {displayMode === 'heatmap' && (
            <div style={{ marginTop: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <SidebarLabel>Heatmap Intensity</SidebarLabel>
                <span style={{ fontSize: '0.6875rem', color: 'var(--sr-text-muted)', fontVariantNumeric: 'tabular-nums' }}>{heatIntensity}</span>
              </div>
              <input
                type="range"
                min={1}
                max={10}
                step={1}
                value={heatIntensity}
                onChange={e => setHeatIntensity(Number(e.target.value))}
                aria-label="Heatmap intensity"
                style={{ width: '100%', accentColor: 'var(--sr-accent)', cursor: 'pointer' }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.625rem', color: 'var(--sr-text-muted)', marginTop: 2 }}>
                <span>Tighter</span>
                <span>Broader</span>
              </div>
            </div>
          )}
        </div>
        {/* Atlas overlay controls — bottom of the My Sightings panel */}
        <div style={{ padding: '0 16px 14px' }}>
          {atlasOverlayControls}
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
            <div style={{ fontSize: '1.0625rem', fontWeight: 700, color: 'var(--sr-accent)', letterSpacing: '-0.02em', lineHeight: 1.1 }}>{s.value}</div>
            <div style={{ fontSize: '0.625rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--sr-text-muted)', marginTop: 2 }}>{s.label}</div>
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
      <button tabIndex={0}
        onClick={() => handleFindHotspots()}
        disabled={hotspotsLoading || hasEbirdKey === false}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
          width: '100%', height: 36,
          background: hotspotsLoading || hasEbirdKey === false ? 'var(--sr-text-disabled)' : 'var(--sr-accent)',
          color: 'var(--sr-on-accent)', border: 'none', borderRadius: 6,
          fontSize: '0.8125rem', fontWeight: 500, fontFamily: 'inherit',
          cursor: hotspotsLoading || hasEbirdKey === false ? 'not-allowed' : 'pointer',
          marginBottom: 10,
        }}
      >
        {hotspotsLoading
          ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Finding…</>
          : 'Find Hotspots'}
      </button>
      {hotspotsError && (
        <div style={{ display: 'flex', gap: 6, fontSize: '0.75rem', color: 'var(--sr-error)', marginBottom: 10 }}>
          <AlertCircle size={13} style={{ flexShrink: 0, marginTop: 1 }} />
          {hotspotsError}
        </div>
      )}

      {/* Legend — visible after first successful fetch */}
      {legendVisible && hotspotPins && hotspotPins.length > 0 && (
        <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--sr-border)' }}>
          <SidebarLabel>Legend</SidebarLabel>
          <div style={{ fontSize: '0.6875rem', color: 'var(--sr-text-muted)', fontStyle: 'italic', marginBottom: 8 }}>
            Click a row to hide or show that pin category.
          </div>
          {([
            { label: 'Visited',   kind: 'visited' as const },
            { label: 'Unvisited', kind: 'unvisited' as const },
            { label: 'Personal',  kind: 'personal' as const },
          ] as { label: string; kind: HotspotPin['kind'] }[])
            .filter(row => hotspotPins.some(p => p.kind === row.kind))
            .map(row => {
              const count = hotspotPins.filter(p => p.kind === row.kind).length
              const isHidden = hiddenKinds.has(row.kind)
              return (
                <button tabIndex={0}
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
                  <div dangerouslySetInnerHTML={{ __html: TEARDROP_HTML[row.kind] }} style={{ flexShrink: 0, width: 28, height: 40 }} />
                  <div>
                    <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--sr-text)' }}>{row.label}</span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--sr-text-muted)', marginLeft: 6 }}>{count}</span>
                  </div>
                </button>
              )
            })}
        </div>
      )}

      {atlasOverlayControls}

      {nearestUnvisited.length > 0 && (
        <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--sr-border)' }}>
          <SidebarLabel>Nearest Unvisited Hotspots</SidebarLabel>
          {nearestUnvisited.map(({ pin, dist }) => (
            <a
              key={pin.locId}
              href={`https://ebird.org/hotspot/${pin.locId}`}
              target="_blank"
              rel="noreferrer"
              tabIndex={0}
              className="sr-nearest-unvisited-row"
              style={{
                display: 'flex', alignItems: 'baseline', gap: 8, width: '100%',
                padding: '7px 8px', marginBottom: 2, borderRadius: 6,
                textDecoration: 'none', color: 'inherit',
              }}
            >
              <span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: 'var(--sr-map-unvisited)', flexShrink: 0, alignSelf: 'center' }} aria-hidden="true" />
              <span className="sr-nearest-unvisited-name" style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', fontSize: '0.78125rem', color: 'var(--sr-text)', overflow: 'hidden' }}>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pin.locName}</span>
                <ExternalLink size={11} strokeWidth={2} aria-hidden="true" style={{ marginLeft: 5, flexShrink: 0, color: 'var(--sr-text-muted)' }} />
              </span>
              <span style={{ fontSize: '0.71875rem', color: 'var(--sr-text-muted)', flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>{dist.toFixed(1)} mi</span>
            </a>
          ))}
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
            <div style={{ fontSize: '0.75rem', color: 'var(--sr-text-muted)', lineHeight: 1.5 }}>
              You already have media for every species in your eBird backup.
            </div>
          ) : (
            <div style={{ padding: '10px 12px', background: 'var(--sr-surface-subtle)', borderRadius: 8, border: '1px solid var(--sr-border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 3 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--sr-map-target)', flexShrink: 0 }} />
                <button tabIndex={0}
                  onClick={onNavigateToMediaList}
                  style={{
                    fontSize: '0.875rem', fontWeight: 700, color: 'var(--sr-accent)',
                    background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                    fontFamily: 'inherit', textDecoration: 'underline',
                    textDecorationColor: 'rgba(45,134,83,0.4)',
                  }}
                >
                  {targetSpecies.length} target species
                </button>
              </div>
              <div style={{ fontSize: '0.71875rem', color: 'var(--sr-text-muted)', marginLeft: 15 }}>from ML export · missing ≥1 media type</div>
            </div>
          )}
        </div>
      )}

      {/* Manual species select — when no ML export */}
      {targetsNoML && (
        <div style={{ marginBottom: 16 }}>
          <SidebarLabel>Target Species</SidebarLabel>
          <div style={{ fontSize: '0.71875rem', color: 'var(--sr-text-muted)', marginBottom: 8, lineHeight: 1.45 }}>
            Upload an ML export in Settings to auto-derive targets, or select species manually.
          </div>
          <input type="text" placeholder="Search species…" value={targetSearch}
            onChange={e => setTargetSearch(e.target.value)}
            style={{ width: '100%', height: 32, padding: '0 10px', border: '1.5px solid var(--sr-border)', borderRadius: 6, fontSize: '0.75rem', fontFamily: 'inherit', color: 'var(--sr-text)', background: 'var(--sr-surface)', outline: 'none', boxSizing: 'border-box', marginBottom: 6 }}
          />
          <div style={{ maxHeight: 130, overflowY: 'auto', border: '1.5px solid var(--sr-border)', borderRadius: 6, background: 'var(--sr-surface)' }}>
            {filteredManualSpecies.slice(0, 60).map(s => (
              <label key={s} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '5px 10px', cursor: 'pointer', fontSize: '0.75rem' }}>
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
            <div style={{ fontSize: '0.6875rem', color: 'var(--sr-text-muted)', marginTop: 5 }}>{manualTargets.size} selected</div>
          )}
        </div>
      )}

      <button tabIndex={0}
        onClick={() => handleFindSightings()}
        disabled={targetsFetchDisabled}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
          width: '100%', height: 36,
          background: 'var(--sr-accent)', color: 'var(--sr-on-accent)',
          border: 'none', borderRadius: 6,
          fontSize: '0.8125rem', fontWeight: 500, fontFamily: 'inherit',
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
        <div style={{ display: 'flex', gap: 6, fontSize: '0.75rem', color: 'var(--sr-error)' }}>
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
              <span style={{ fontSize: '0.6875rem', color: 'var(--sr-text-muted)' }}>{displayedTargetPins.length} species</span>
            </div>
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
              <button tabIndex={0}
                onClick={() => setTargetTypeFilter(new Set())}
                style={{
                  display: 'inline-flex', alignItems: 'center', padding: '3px 9px',
                  borderRadius: 20, fontSize: '0.71875rem', fontWeight: 500,
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
                  <button tabIndex={0}
                    key={type}
                    onClick={() => setTargetTypeFilter(prev => {
                      const next = new Set(prev)
                      if (next.has(type)) next.delete(type); else next.add(type)
                      return next
                    })}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 9px',
                      borderRadius: 20, fontSize: '0.71875rem', fontWeight: 500,
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
          {atlasOverlayControls}
          {nearest10.length > 0 && (
            <div>
              <SidebarLabel>Nearest Targets</SidebarLabel>
              {nearest10.map(({ pin, dist }) => {
                const key = `${pin.speciesCode}-${pin.locId}`
                const tier = recencyTier(pin.recentDate)
                const { bg, text } = tierColors(tier)
                const isSelected = selectedTargetKey === key
                return (
                  <div
                    key={key}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                      padding: '6px 8px', marginBottom: 2, borderRadius: 6,
                      background: isSelected ? 'var(--sr-accent-bg)' : 'transparent',
                      border: `1px solid ${isSelected ? 'var(--sr-accent-border)' : 'transparent'}`,
                    }}
                  >
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: bg, border: `1px solid ${text === 'white' ? 'transparent' : 'var(--sr-border)'}`, flexShrink: 0 }}>
                      <span className="sr-only">
                        {tier === 'fresh' ? 'Recent (≤7 days)' : tier === 'mid' ? 'Seen 8–14 days ago' : 'Seen 15–30 days ago'}
                      </span>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <BirdName commonName={pin.comName} taxonCode={speciesCodeMap[pin.comName]} hasEntry={hasEntryFor(pin.comName)} onOpenSpecies={onOpenSpecies} size="sm" />
                      <div style={{ fontSize: '0.625rem', color: 'var(--sr-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pin.locName}</div>
                    </div>
                    <div style={{ fontSize: '0.6875rem', color: 'var(--sr-text-muted)', flexShrink: 0 }}>{dist.toFixed(1)} mi</div>
                    <button
                      tabIndex={0}
                      onClick={() => { setSelectedTargetKey(key); setPanTarget({ lat: pin.lat, lng: pin.lng }) }}
                      title="Show on map"
                      aria-label={`Show ${pin.comName} on the map`}
                      style={{
                        flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        width: 26, height: 26, borderRadius: 6, cursor: 'pointer',
                        background: 'transparent', border: '1px solid var(--sr-border)', color: 'var(--sr-text-muted)',
                      }}
                    >
                      <Crosshair size={13} strokeWidth={2.2} />
                    </button>
                  </div>
                )
              })}
            </div>
          )}
          {displayedTargetPins.length === 0 && (
            <div style={{ fontSize: '0.75rem', color: 'var(--sr-text-muted)' }}>
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
      <div role="group" aria-label="Map view mode" style={{ display: 'flex', gap: 8, padding: '10px 16px', borderBottom: '1px solid var(--sr-border)', background: 'var(--sr-surface)', flexShrink: 0 }}>
        {([
          { mode: 'sightings' as ViewMode, label: 'My Sightings',  icon: <MapPin size={14} strokeWidth={2.5} /> },
          { mode: 'hotspots' as ViewMode,  label: 'Hotspots',      icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden><circle cx="8" cy="12" r="4"/><circle cx="16" cy="12" r="4"/></svg> },
          { mode: 'targets' as ViewMode,   label: 'Media Targets', icon: <Camera size={14} strokeWidth={2.5} /> },
        ] as { mode: ViewMode; label: string; icon: React.ReactNode }[]).map(({ mode, label, icon }) => (
          <button tabIndex={0}
            key={mode}
            aria-pressed={viewMode === mode}
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
              fontSize: '0.8125rem', fontFamily: 'inherit', cursor: 'pointer', whiteSpace: 'nowrap',
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
          ref={sidebarRef}
          className={`sr-map-sidebar-overlay${sidebarOpen ? '' : ' sr-map-sidebar-hidden'}`}
          style={{ width: 268, flexShrink: 0, borderRight: '1px solid var(--sr-border)', background: 'var(--sr-surface)' }}
        >
          {/* Mobile-only header with close button */}
          <div className="sr-map-sidebar-close">
            <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--sr-text)' }}>Map Filters</span>
            <button tabIndex={0}
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
          {/* Floating map controls, hidden while the mobile sidebar overlay is open.
              Fullscreen toggle shows on all widths; the Filters button is mobile-
              only (CSS). They sit in a flex cluster so they never overlap regardless
              of the Filters label width. */}
          {!sidebarOpen && (
            <div className="sr-map-fab-cluster">
              {onToggleFullscreen && (
                <button tabIndex={0}
                  className="sr-map-fullscreen-btn"
                  onClick={onToggleFullscreen}
                  aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
                  aria-pressed={!!isFullscreen}
                >
                  {isFullscreen
                    ? <Minimize2 size={16} strokeWidth={2.5} />
                    : <Maximize2 size={16} strokeWidth={2.5} />}
                </button>
              )}
              <button tabIndex={0}
                ref={filtersButtonRef}
                className="sr-map-filters-btn"
                onClick={() => setSidebarOpen(true)}
                aria-label="Open map filters"
              >
                <Filter size={14} strokeWidth={2.5} />
                Filters
              </button>
            </div>
          )}
          {isSetupRequired && viewMode === 'sightings' ? (
            <SetupRequired
              title="eBird Backup Required"
              body="Map Explorer needs your eBird backup to show your sightings on the map. Hotspot and Media Targets modes also benefit from a backup for visited classification."
              steps={EBIRD_BACKUP_STEPS}
              onGoToSettings={onGoToSettings}
            />
          ) : (
            <SnowMap
              initialViewState={{ longitude: -100, latitude: 45, zoom: 4 }}
              style={{ height: '100%', width: '100%' }}
              switcher
            >
              <MapEffects
                panTarget={panTarget}
                onPanDone={handlePanDone}
                defaultCenter={defaultCenter}
                onDefaultDone={handleDefaultCenterDone}
              />
              {atlasEnabled && (
                <AtlasLayer
                  data={atlasData}
                  shade={shadeByBreeding}
                  breedingByBlock={breedingByBlock}
                  useTextures={useTextures}
                />
              )}
              {detectedLocation && <DetectedLocationPin position={detectedLocation} />}
              {viewMode === 'sightings' && !isSetupRequired && (
                <SightingMarkers locations={filteredLocations} displayMode={displayMode} heatIntensity={heatIntensity} atlasShading={atlasEnabled && shadeByBreeding} />
              )}
              {viewMode === 'hotspots' && hotspotPins && (
                <HotspotMarkers key={hotspotPins.length} pins={hotspotPins} hiddenKinds={hiddenKinds} />
              )}
              {viewMode === 'targets' && targetPins && (
                <TargetMarkers key={`${targetPins.length}-${targetViewMode}`} pins={displayedTargetPins} speciesCodeMap={speciesCodeMap} hasEntryFor={hasEntryFor} onOpenSpecies={onOpenSpecies} />
              )}
            </SnowMap>
          )}
        </div>
      </div>
    </div>
  )
}
