// "Current" and "Predict" — weather + tide for the user's live location and time,
// or a place and time they choose, bypassing the eBird checklist. Mounts at the
// bottom of the Weather tab. Reuses the existing weather/tide formatters for the
// copy block (one source) and the existing seams (transport, location, clipboard,
// Nominatim). See pipeline/weather-current-predict/design-spec.md.

import { useState, useCallback, useRef, useEffect, lazy, Suspense } from 'react'
import { Navigation, Search, Loader2, ClipboardCopy, Check, AlertCircle } from 'lucide-react'
import { transport } from '../lib/transport'
import { classifyLiveError, OFFLINE_MESSAGE, NO_KEY_MESSAGE, type LiveErrorKind } from '../lib/offlineMessage'
import { OfflineMessage, StalenessCue } from './OfflineMessage'
import { copyText } from '../lib/clipboard'
import { getCurrentLocation, describeLocationError, type LocationError } from '../lib/location'
import { buildCombined } from '../lib/tideFormatter'
import { tideTooFarNotice, tideOverrideLabel } from '../lib/tideNotice'
import { formatDate } from '../lib/formatDate'
import type { WeatherAtResponse, WeatherSummary } from '../lib/forecastSlice'
import type { TideAtResponse, TideReadingSummary } from '../lib/tide'
import type { GeoSearchResult } from '../lib/tauri/nominatimService'
import type { LatLng } from './PredictMap'

const PredictMap = lazy(() => import('./PredictMap').then(m => ({ default: m.PredictMap })))

// Mirror of PredictMap's PREDICT_MAP_HEIGHT — kept as a local literal (not a
// static import) so the lazy PredictMap chunk (and maplibre-gl) is NOT pulled
// into the Weather tab's initial bundle. Keep the two values in lockstep.
const PREDICT_MAP_HEIGHT = 'clamp(180px, 28vw, 280px)'

const MONO = 'ui-monospace, "Cascadia Code", "Fira Code", Consolas, monospace'

const pad = (n: number) => String(n).padStart(2, '0')
const toDateInput = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const toTimeInput = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`

// "Now" as a 'YYYY-MM-DD HH:MM' wall-clock string IN the given timezone — so a
// Current lookup shows (and queries) the location's local time, not the device's.
function nowInTz(tzName: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: tzName, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(new Date())
  const g = (t: string) => parts.find(p => p.type === t)?.value ?? '00'
  const hh = g('hour') === '24' ? '00' : g('hour')
  return `${g('year')}-${g('month')}-${g('day')} ${hh}:${g('minute')}`
}

// ── styles (token-faithful to the existing Weather card) ──────────────────────
const primaryBtn: React.CSSProperties = {
  height: 44, padding: '0 18px', background: 'var(--sr-accent)', color: 'var(--sr-on-accent)',
  border: 'none', borderRadius: 8, fontSize: '0.875rem', fontWeight: 600, fontFamily: 'inherit',
  cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7,
}
const outlineBtn: React.CSSProperties = {
  height: 44, padding: '0 18px', background: 'var(--sr-accent-bg)', color: 'var(--sr-accent)',
  border: '1.5px solid var(--sr-accent-border)', borderRadius: 8, fontSize: '0.875rem', fontWeight: 600,
  fontFamily: 'inherit', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7,
}
const copyBtn = (active: boolean): React.CSSProperties => ({
  height: 30, padding: '0 12px', background: active ? 'var(--sr-accent)' : 'var(--sr-accent-bg)',
  color: active ? 'var(--sr-on-accent)' : 'var(--sr-accent)',
  border: `1.5px solid ${active ? 'var(--sr-accent)' : 'var(--sr-accent-border)'}`, borderRadius: 6,
  fontSize: '0.75rem', fontWeight: 500, fontFamily: 'inherit', cursor: 'pointer',
  display: 'inline-flex', alignItems: 'center', gap: 5,
})
const fieldLabel: React.CSSProperties = { display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--sr-text-muted)', marginBottom: 6, letterSpacing: '0.01em' }
const textInput: React.CSSProperties = {
  width: '100%', height: 40, padding: '0 12px', border: '1.5px solid var(--sr-border)', borderRadius: 8,
  fontSize: '0.84375rem', fontFamily: 'inherit', color: 'var(--sr-text)', background: 'var(--sr-surface)', minWidth: 0,
}
const chip: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8125rem', color: 'var(--sr-text)' }

// ── pill ──────────────────────────────────────────────────────────────────────
function pillFor(source: 'current' | 'predict', resolution: WeatherAtResponse['resolution'] | null): { text: string; kind: 'live' | 'fc' | 'daily' } {
  if (source === 'current') return { text: 'LIVE', kind: 'live' }
  if (resolution === 'daily') return { text: 'FORECAST · DAILY', kind: 'daily' }
  if (resolution === 'out-of-range' || resolution === null) return { text: 'TIDE ONLY', kind: 'fc' }
  return { text: 'FORECAST', kind: 'fc' }
}
const pillStyle = (kind: 'live' | 'fc' | 'daily'): React.CSSProperties => ({
  display: 'inline-flex', alignItems: 'center', height: 21, padding: '0 9px', borderRadius: 11,
  fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.02em', whiteSpace: 'nowrap', flexShrink: 0,
  ...(kind === 'live'
    ? { background: 'var(--sr-accent)', color: 'var(--sr-on-accent)' }
    : kind === 'daily'
      ? { background: 'var(--sr-warning-bg)', color: 'var(--sr-warning)', border: '1px solid var(--sr-warning-subtle)' }
      : { background: 'var(--sr-accent-bg)', color: 'var(--sr-accent)', border: '1px solid var(--sr-accent-border)' }),
})

// ── readable summaries ──────────────────────────────────────────────────────
function WeatherSummaryView({ s }: { s: WeatherSummary }) {
  return (
    <div role="group" aria-label="Weather">
      <div className="sr-wrap-flex" style={{ ['--sr-wrap-gap' as string]: '14px' }}>
        <span style={{ fontSize: '2.5rem', lineHeight: 1 }} aria-hidden="true">{s.emoji}{s.moon}</span>
        <div className="sr-min0">
          <div style={{ fontSize: '2.1rem', fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.05 }}>
            {s.tempF}°F
            {s.isDaily && s.highF !== null && s.lowF !== null && (
              <span style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--sr-text-muted)', marginLeft: 8 }}>
                H {s.highF}° · L {s.lowF}°
              </span>
            )}
          </div>
          <div style={{ fontSize: '0.875rem', color: 'var(--sr-text-muted)', marginTop: 1 }}>
            {s.description}{s.isDaily ? ', forecast for that day' : ''}
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 18px', marginTop: 14 }}>
        <span style={chip}><span style={{ color: 'var(--sr-text-muted)' }}>Wind</span> <b>{s.windDesc}, {s.windDir}</b></span>
        <span style={chip}><span style={{ color: 'var(--sr-text-muted)' }}>Humidity</span> <b>{s.humidityPct}%</b></span>
        <span style={chip}><span style={{ color: 'var(--sr-text-muted)' }}>Dew pt</span> <b>{s.dewPointF}°F</b></span>
        <span style={chip}><span style={{ color: 'var(--sr-text-muted)' }}>Cloud</span> <b>{s.cloudsPct}%</b></span>
        <span style={chip}><span style={{ color: 'var(--sr-text-muted)' }}>Sun</span> <b>{s.sunrise} – {s.sunset}</b></span>
      </div>
    </div>
  )
}

function TideSummaryView({ r }: { r: TideReadingSummary }) {
  const lvl = r.levelMin === r.levelMax ? `${r.levelMin.toFixed(1)} ft` : `${r.levelMin.toFixed(1)} – ${r.levelMax.toFixed(1)} ft`
  return (
    <div role="group" aria-label="Tide" style={{ marginTop: 14, paddingTop: 14, borderTop: '1px dashed var(--sr-border)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 7 }}>
        <span style={{ fontSize: '1.15rem' }} aria-hidden="true">🌊</span>
        <span style={{ fontSize: '1.0625rem', fontWeight: 700, letterSpacing: '-0.01em' }}>{lvl}</span>
        <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--sr-accent)' }}>
          {r.trend === 'rising' ? 'Rising ↑' : 'Falling ↓'}{r.turnedDuring ? ' (turning)' : ''}
        </span>
      </div>
      <div className="sr-grid-2" style={{ ['--sr-grid-gap' as string]: '6px 16px', fontSize: '0.8125rem' }}>
        {r.nextHL && <span><span style={{ color: 'var(--sr-text-muted)' }}>Next {r.nextHL.kind}</span> <b>{r.nextHL.v.toFixed(1)} ft</b> · {r.nextHL.timeLocal}</span>}
        {r.prevHL && <span><span style={{ color: 'var(--sr-text-muted)' }}>Prev {r.prevHL.kind}</span> {r.prevHL.v.toFixed(1)} ft · {r.prevHL.timeLocal}</span>}
      </div>
      <div style={{ marginTop: 9, fontSize: '0.71875rem', color: 'var(--sr-text-muted)' }}>
        {r.station.name} ({r.station.id}) · {r.distanceMi.toFixed(1)} mi · <b>{r.source === 'observed' ? 'Observed' : 'Predicted'}</b> · relative to MLLW
      </div>
    </div>
  )
}

// ── phase / result ──────────────────────────────────────────────────────────
interface ResultData {
  source: 'current' | 'predict'
  place: string
  whenRaw: string
  coord: LatLng
  tideDt: string
  weather: WeatherAtResponse | null
  weatherErr: boolean
  weatherErrKind: LiveErrorKind | null
  // ms epoch when weather/tide came from the offline replay store (FR-28/29/31),
  // else null for a fresh/live reading.
  weatherReplayedAt: number | null
  tide: TideAtResponse | null
  tideErr: boolean
  tideErrKind: LiveErrorKind | null
  tideReplayedAt: number | null
}

type Phase =
  | { kind: 'idle' }
  | { kind: 'predict' }
  | { kind: 'locating' }
  | { kind: 'loading' }
  | { kind: 'result'; data: ResultData }

function buildCopyText(d: ResultData): string {
  const wf = d.weather && d.weather.resolution !== 'out-of-range' ? d.weather.formatted : null
  const tide = d.tide && d.tide.status === 'ok' ? d.tide : null
  if (wf && tide?.body) return buildCombined(wf, tide.body)
  if (wf) return wf
  if (tide?.formatted) return tide.formatted
  return ''
}

export function WeatherForecastPanel() {
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' })
  const phaseRef = useRef<Phase>(phase)
  useEffect(() => { phaseRef.current = phase }, [phase])
  const [copied, setCopied] = useState(false)
  const [overriding, setOverriding] = useState(false)
  // Persistent live region: a result that mounts already carrying its text is
  // announced inconsistently (the F068 pattern), so the announcement is pushed
  // here, to a region that always exists, when results are ready.
  const [announce, setAnnounce] = useState('')

  // Predict input state
  const [place, setPlace] = useState('')
  const [searching, setSearching] = useState(false)
  const [searchErr, setSearchErr] = useState<string | null>(null)
  const [locError, setLocError] = useState<string | null>(null)
  const [dateStr, setDateStr] = useState('')
  const [timeStr, setTimeStr] = useState('')
  const [coord, setCoordState] = useState<LatLng | null>(null)
  const [latStr, setLatStr] = useState('')
  const [lngStr, setLngStr] = useState('')
  const coordRef = useRef<LatLng | null>(null)
  // Programmatic coord sets (search, map pin, current location) also reformat the
  // lat/lng fields; the fields' own onChange handlers (applyLat/applyLng) leave
  // them as typed so partial input like "-12." works.
  const setCoord = useCallback((c: LatLng | null) => {
    coordRef.current = c
    setCoordState(c)
    setLatStr(c ? c.lat.toFixed(4) : '')
    setLngStr(c ? c.lng.toFixed(4) : '')
  }, [])

  const runLookup = useCallback(async (
    c: LatLng, weatherDt: string | undefined, tideDt: string | undefined,
    source: 'current' | 'predict', placeLabel: string, whenRaw: string | undefined,
  ) => {
    setPhase({ kind: 'loading' })
    const wParams: Record<string, string> = { lat: String(c.lat), lng: String(c.lng) }
    if (weatherDt) wParams.dt = weatherDt
    const tParams: Record<string, string> = { lat: String(c.lat), lng: String(c.lng) }
    if (tideDt) tParams.dt = tideDt
    // getReplayable: a /weather/at or /tide/at result loaded online once re-shows
    // offline (FR-28/29) with a staleness cue, preferred over an offline error
    // (FR-37). On a genuine failure, classify three ways (FR-35).
    const [wRes, tRes] = await Promise.all([
      transport.getReplayable<WeatherAtResponse>('/weather/at', wParams)
        .then(({ data, replayedAt }) => ({ ok: true as const, r: data, replayedAt }))
        .catch((err: unknown) => ({ ok: false as const, kind: classifyLiveError(err).kind })),
      transport.getReplayable<TideAtResponse>('/tide/at', tParams)
        .then(({ data, replayedAt }) => ({ ok: true as const, r: data, replayedAt }))
        .catch((err: unknown) => ({ ok: false as const, kind: classifyLiveError(err).kind })),
    ])
    // For Current (no whenRaw passed) the label is "now" in the LOCATION's tz the
    // weather response carries; falls back to the device clock if tz is missing.
    const tz = wRes.ok ? wRes.r.tz : undefined
    const whenRawFinal = whenRaw ?? (tz ? nowInTz(tz) : `${toDateInput(new Date())} ${toTimeInput(new Date())}`)
    setPhase({
      kind: 'result',
      data: {
        source, place: placeLabel, whenRaw: whenRawFinal, coord: c, tideDt: tideDt ?? whenRawFinal,
        weather: wRes.ok ? wRes.r : null, weatherErr: !wRes.ok,
        weatherErrKind: wRes.ok ? null : wRes.kind, weatherReplayedAt: wRes.ok ? wRes.replayedAt : null,
        tide: tRes.ok ? tRes.r : null, tideErr: !tRes.ok,
        tideErrKind: tRes.ok ? null : tRes.kind, tideReplayedAt: tRes.ok ? tRes.replayedAt : null,
      },
    })
    setAnnounce(`Weather and tide ready for ${placeLabel}.`)
  }, [])

  const openPredict = useCallback(async (presetError?: string) => {
    const now = new Date()
    setDateStr(toDateInput(now))
    setTimeStr(toTimeInput(now))
    setSearchErr(null)
    setLocError(presetError ?? null)
    setPhase({ kind: 'predict' })
    if (!presetError && !coordRef.current) {
      try { const c = await getCurrentLocation(); setCoord(c); setPlace('Your location') } catch { /* leave unset — user searches or taps */ }
    }
  }, [setCoord])

  const onCurrent = useCallback(async () => {
    setPhase({ kind: 'locating' })
    let c: LatLng
    try { c = await getCurrentLocation() }
    catch (err) { void openPredict(describeLocationError(err as LocationError)); return }
    setCoord(c)
    // No dt for either call: both resolve "now" in the LOCATION's timezone, and the
    // label is derived from the tz the weather response returns (handled in runLookup).
    await runLookup(c, undefined, undefined, 'current', 'Your location', undefined)
  }, [openPredict, runLookup, setCoord])

  const onSearch = useCallback(async () => {
    const q = place.trim()
    if (!q) return
    setSearching(true)
    setSearchErr(null)
    try {
      const results = await transport.get<GeoSearchResult[]>('/nominatim/search', { q })
      if (!results || results.length === 0) { setSearchErr('No match for that place. Try a more specific name.'); return }
      const r = results[0]
      const lat = parseFloat(r.lat), lng = parseFloat(r.lon)
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) { setSearchErr('That place didn’t return usable coordinates. Try another.'); return }
      setCoord({ lat, lng })
    } catch (err) {
      // Offline geocode must read "you're offline", NOT "no matches" (FR-38).
      setSearchErr(classifyLiveError(err, { errorMessage: 'Location search is unavailable right now.' }).message)
    } finally {
      setSearching(false)
    }
  }, [place, setCoord])

  const onPredictSubmit = useCallback(async () => {
    const c = coordRef.current
    if (!c) { setSearchErr('Pick a place first: search, tap the map, or type coordinates.'); return }
    if (!Number.isFinite(c.lat) || !Number.isFinite(c.lng) || c.lat < -90 || c.lat > 90 || c.lng < -180 || c.lng > 180) {
      setSearchErr('Those coordinates are out of range: latitude is -90 to 90, longitude -180 to 180.'); return
    }
    if (!dateStr || !timeStr) { setSearchErr('Choose a date and a time.'); return }
    const dtLocal = `${dateStr} ${timeStr}`
    await runLookup(c, dtLocal, dtLocal, 'predict', place.trim() || 'Selected location', dtLocal)
  }, [dateStr, timeStr, place, runLookup])

  const overrideTide = useCallback(() => {
    const p0 = phaseRef.current
    if (p0.kind !== 'result') return
    const { coord: c, tideDt } = p0.data
    setOverriding(true)
    // Guard the update by coord identity: a slow override for one spot must never
    // overwrite the tide of a result the user has since replaced with a new lookup.
    const apply = (patch: Partial<ResultData>) =>
      setPhase(p => (p.kind === 'result' && p.data.coord === c ? { kind: 'result', data: { ...p.data, ...patch } } : p))
    // A forced override is a fresh live read (force:'1'), so it bypasses replay —
    // a replayed reading is never "forced". On failure, classify three ways.
    transport.get<TideAtResponse>('/tide/at', { lat: String(c.lat), lng: String(c.lng), dt: tideDt, force: '1' })
      .then(t => apply({ tide: t, tideErr: false, tideErrKind: null, tideReplayedAt: null }))
      .catch((err: unknown) => apply({ tideErr: true, tideErrKind: classifyLiveError(err).kind }))
      .finally(() => setOverriding(false))
  }, [])

  const doCopy = useCallback(async (text: string) => {
    if (!text) return
    if (await copyText(text)) {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }, [])

  // Free-typed (own string state) so partial input like "-12." works; the coord
  // updates only when the value parses to a finite, in-bounds number — an empty or
  // invalid field never silently snaps the location to 0,0 (Null Island).
  const applyLat = (v: string) => {
    setLatStr(v)
    const lat = parseFloat(v)
    if (Number.isFinite(lat) && lat >= -90 && lat <= 90) {
      const c = { lat, lng: coordRef.current?.lng ?? 0 }
      coordRef.current = c
      setCoordState(c)
    }
  }
  const applyLng = (v: string) => {
    setLngStr(v)
    const lng = parseFloat(v)
    if (Number.isFinite(lng) && lng >= -180 && lng <= 180) {
      const c = { lat: coordRef.current?.lat ?? 0, lng }
      coordRef.current = c
      setCoordState(c)
    }
  }

  return (
    <div>
      <span className="sr-only" role="status" aria-live="polite">{announce}</span>
      <hr style={{ border: 'none', borderTop: '1px solid var(--sr-border)', margin: '24px 0' }} />

      <div style={{ fontSize: '1.0625rem', fontWeight: 700, letterSpacing: '-0.01em' }}>Now, or any time ahead</div>
      <p style={{ margin: '4px 0 14px', fontSize: '0.8125rem', color: 'var(--sr-text-muted)' }}>
        Skip the checklist: get weather and tide for where you are, or for a place and time you choose.
      </p>

      <div className="sr-grid-2" style={{ ['--sr-grid-gap' as string]: '10px' }}>
        <button type="button" tabIndex={0} onClick={onCurrent} style={primaryBtn} aria-label="Get current weather and tide for my location">
          <Navigation size={16} strokeWidth={2.2} aria-hidden="true" /> Current
        </button>
        <button type="button" tabIndex={0} onClick={() => void openPredict()} style={outlineBtn} aria-label="Predict weather and tide for a place and time">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /><path d="M12 14v3l2 1" /></svg>
          Predict
        </button>
      </div>

      {phase.kind === 'locating' && (
        <div role="status" style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 16, fontSize: '0.8125rem', color: 'var(--sr-text-muted)' }}>
          <Loader2 size={15} className="spin" aria-hidden="true" /> Finding your location…
        </div>
      )}

      {phase.kind === 'predict' && (
        <div className="sr-pad-x-trim" style={{ marginTop: 16, background: 'var(--sr-surface-faint)', border: '1px solid var(--sr-border)', borderRadius: 10, padding: 16 }}>
          {locError && (
            <div role="alert" style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 14, padding: '10px 13px', background: 'var(--sr-warning-bg)', border: '1px solid var(--sr-warning-subtle)', color: 'var(--sr-warning)', borderRadius: 8, fontSize: '0.8125rem', lineHeight: 1.5 }}>
              <AlertCircle size={15} strokeWidth={2} style={{ flexShrink: 0, marginTop: 1 }} aria-hidden="true" />
              <span>{locError} You can look up a place below instead.</span>
            </div>
          )}

          <label htmlFor="predict-place" style={fieldLabel}>Place</label>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <input
              id="predict-place" type="text" value={place}
              onChange={e => setPlace(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); void onSearch() } }}
              placeholder="Search a place, e.g. Pillar Point Harbor"
              aria-label="Search for a place"
              autoComplete="off" className="sr-input-16" style={textInput}
            />
            <button type="button" tabIndex={0} onClick={() => void onSearch()} disabled={searching} aria-label="Search for this place" style={{ ...outlineBtn, height: 40, flexShrink: 0, padding: '0 14px' }}>
              {searching ? <Loader2 size={15} className="spin" aria-hidden="true" /> : <Search size={15} strokeWidth={2.5} aria-hidden="true" />}
            </button>
          </div>

          <Suspense fallback={<div style={{ height: PREDICT_MAP_HEIGHT, borderRadius: 9, border: '1px solid var(--sr-border-input)', background: 'var(--sr-surface-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8125rem', color: 'var(--sr-text-muted)' }}>Loading map…</div>}>
            <PredictMap coord={coord} onPick={setCoord} />
          </Suspense>
          <p style={{ margin: '7px 0 0', fontSize: '0.6875rem', color: 'var(--sr-text-muted)' }}>Tap the map to drop a pin, drag to fine-tune, or type coordinates below.</p>

          <div className="sr-grid-2" style={{ ['--sr-grid-gap' as string]: '12px', marginTop: 12 }}>
            <div>
              <label htmlFor="predict-lat" style={fieldLabel}>Latitude</label>
              <input id="predict-lat" type="number" step="0.0001" min={-90} max={90} value={latStr} onChange={e => applyLat(e.target.value)} aria-label="Latitude (-90 to 90)" className="sr-input-16" style={textInput} />
            </div>
            <div>
              <label htmlFor="predict-lng" style={fieldLabel}>Longitude</label>
              <input id="predict-lng" type="number" step="0.0001" min={-180} max={180} value={lngStr} onChange={e => applyLng(e.target.value)} aria-label="Longitude (-180 to 180)" className="sr-input-16" style={textInput} />
            </div>
            <div>
              <label htmlFor="predict-date" style={fieldLabel}>Date</label>
              <input id="predict-date" type="date" value={dateStr} min={toDateInput(new Date())} onChange={e => setDateStr(e.target.value)} aria-label="Forecast date" className="sr-input-16" style={textInput} />
            </div>
            <div>
              <label htmlFor="predict-time" style={fieldLabel}>Time</label>
              <input id="predict-time" type="time" value={timeStr} onChange={e => setTimeStr(e.target.value)} aria-label="Forecast time" className="sr-input-16" style={textInput} />
            </div>
          </div>

          {searchErr && (
            <div role="alert" style={{ marginTop: 12, fontSize: '0.8125rem', color: 'var(--sr-error)' }}>{searchErr}</div>
          )}

          <button type="button" tabIndex={0} onClick={() => void onPredictSubmit()} style={{ ...primaryBtn, width: '100%', marginTop: 14 }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3v3M5.2 5.2l2.1 2.1M3 12h3M18 12h3M16.7 7.3l2.1-2.1" /><path d="M7 18a5 5 0 0 1 10 0" /><path d="M4 22h16" /></svg>
            Get forecast
          </button>
        </div>
      )}

      {phase.kind === 'loading' && (
        <div role="status" style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 16, fontSize: '0.8125rem', color: 'var(--sr-text-muted)' }}>
          <Loader2 size={15} className="spin" aria-hidden="true" /> Looking up weather and tide…
        </div>
      )}

      {phase.kind === 'result' && (() => {
        const d = phase.data
        const wx = d.weather
        const pill = pillFor(d.source, wx ? wx.resolution : null)
        const copyTextValue = buildCopyText(d)
        return (
          <div role="region" aria-label="Weather and tide result" className="sr-pad-x-trim" style={{ marginTop: 16, background: 'var(--sr-accent-surface)', border: '1px solid var(--sr-accent-border)', borderRadius: 10, padding: '16px 18px' }}>
            <div className="sr-action-row" style={{ marginBottom: 13 }}>
              <h3 className="sr-min0" style={{ fontSize: '0.9375rem', fontWeight: 700, letterSpacing: '-0.01em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', margin: 0 }}>{d.place}</h3>
              <span style={pillStyle(pill.kind)}>{pill.text}</span>
            </div>
            <div style={{ fontSize: '0.71875rem', color: 'var(--sr-text-muted)', fontFamily: MONO, marginBottom: 12 }}>
              {formatDate(d.whenRaw, { withTime: true })} · {d.coord.lat.toFixed(3)}, {d.coord.lng.toFixed(3)}
            </div>

            {/* Replay staleness cue (FR-31): one cue when either reading was
                re-shown from the offline store. Prefer the (earlier) weather load
                time when both are replayed. */}
            {(d.weatherReplayedAt !== null || d.tideReplayedAt !== null) && (
              <StalenessCue replayedAt={d.weatherReplayedAt ?? d.tideReplayedAt!} />
            )}

            {wx && wx.resolution !== 'out-of-range' && wx.summary
              ? <WeatherSummaryView s={wx.summary} />
              : wx && wx.resolution === 'out-of-range'
                ? (
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 9, background: 'var(--sr-warning-bg)', border: '1px solid var(--sr-warning-subtle)', color: 'var(--sr-warning)', borderRadius: 9, padding: '12px 14px', fontSize: '0.8125rem', lineHeight: 1.5 }}>
                    <AlertCircle size={16} strokeWidth={2.2} style={{ flexShrink: 0, marginTop: 1 }} aria-hidden="true" />
                    <span>No weather forecast reaches {formatDate(d.whenRaw)}. That's beyond the ~8-day window. The tide below is an astronomical prediction, so it's still solid this far out.</span>
                  </div>
                )
                : d.weatherErr
                  ? (d.weatherErrKind === 'offline' || d.weatherErrKind === 'no-key'
                      ? <OfflineMessage kind={d.weatherErrKind} message={d.weatherErrKind === 'offline' ? OFFLINE_MESSAGE : NO_KEY_MESSAGE} />
                      : <div style={{ fontSize: '0.8125rem', color: 'var(--sr-text-muted)' }}>Weather is unavailable right now.</div>)
                  : null}

            {d.tide && d.tide.status === 'ok' && d.tide.reading
              ? <TideSummaryView r={d.tide.reading} />
              : d.tide && (d.tide.status === 'too-far' || d.tide.status === 'outside-us') && d.tide.station
                ? (
                  <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px dashed var(--sr-border)' }}>
                    <div className="sr-action-row sr-action-row-stack" style={{ background: 'var(--sr-warning-bg)', border: '1px solid var(--sr-warning-subtle)', color: 'var(--sr-warning)', borderRadius: 8, padding: '11px 13px', fontSize: '0.8125rem', lineHeight: 1.5 }}>
                      <span className="sr-min0" style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                        <AlertCircle size={15} strokeWidth={2} style={{ flexShrink: 0, marginTop: 1 }} aria-hidden="true" />
                        {tideTooFarNotice(d.tide.station.name, d.tide.distanceMi ?? 0, d.tide.status)}
                      </span>
                      <button type="button" tabIndex={0} onClick={() => overrideTide()} disabled={overriding} aria-label="Show the nearest tide station anyway" className="sr-touch-target" style={{ flexShrink: 0, height: 30, padding: '0 12px', background: 'var(--sr-accent-bg)', color: 'var(--sr-accent)', border: '1.5px solid var(--sr-accent-border)', borderRadius: 6, fontSize: '0.75rem', fontWeight: 600, fontFamily: 'inherit', cursor: overriding ? 'default' : 'pointer', whiteSpace: 'nowrap', opacity: overriding ? 0.7 : 1, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                        {overriding && <Loader2 size={12} className="spin" aria-hidden="true" />}
                        {tideOverrideLabel(d.tide.status)}
                      </button>
                    </div>
                  </div>
                )
                : (d.tideErr && (d.tideErrKind === 'offline' || d.tideErrKind === 'no-key'))
                  ? (
                    <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px dashed var(--sr-border)' }}>
                      <OfflineMessage kind={d.tideErrKind} message={d.tideErrKind === 'offline' ? OFFLINE_MESSAGE : NO_KEY_MESSAGE} />
                    </div>
                  )
                  : (d.tideErr || (d.tide && d.tide.status === 'unavailable'))
                    ? <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px dashed var(--sr-border)', fontSize: '0.8125rem', color: 'var(--sr-text-muted)' }}>Tide is unavailable for this spot.</div>
                    : null}

            {copyTextValue && (
              <details style={{ marginTop: 14 }}>
                <summary style={{ cursor: 'pointer', padding: '10px 0', fontSize: '0.75rem', fontWeight: 600, color: 'var(--sr-accent)' }}>Copy-ready block</summary>
                <div className="sr-action-row" style={{ margin: '12px 0 9px' }}>
                  <span className="sr-min0" style={{ fontSize: '0.6875rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--sr-text-muted)' }}>Weather &amp; tide output</span>
                  <button type="button" tabIndex={0} onClick={() => void doCopy(copyTextValue)} aria-label="Copy weather and tide to clipboard" className="sr-touch-target" style={copyBtn(copied)}>
                    {copied ? <Check size={12} strokeWidth={2.5} aria-hidden="true" /> : <ClipboardCopy size={12} strokeWidth={2.5} aria-hidden="true" />}
                    {copied ? 'Copied!' : 'Copy'}
                  </button>
                </div>
                <pre className="sr-pad-x-trim" style={{ background: 'var(--sr-surface-subtle)', border: '1px solid var(--sr-border)', borderRadius: 8, padding: '18px 20px', fontFamily: MONO, fontSize: '0.84375rem', lineHeight: 1.75, color: 'inherit', whiteSpace: 'pre', overflowX: 'auto', margin: 0 }}>{copyTextValue}</pre>
              </details>
            )}
          </div>
        )
      })()}
    </div>
  )
}
