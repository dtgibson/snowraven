// The "Weather & Tide" section below the Comments table. It owns the two sides'
// independent weather/tide state and the single explicit Load action (no
// auto-fetch, no auto-copy), gates up front on keyStatus (showing a Settings
// nudge naming the missing key(s) when eBird/OpenWeather are absent), and renders
// the two WeatherTidePanels in the shared .sr-two-col grid. The badges and the
// species comparison above are untouched by this gate. All color via var(--sr-*).
// See design-spec §B and schema.md §4/§6.

import { useState, useCallback } from 'react'
import { CloudSun, Loader2 } from 'lucide-react'
import { transport, TransportError } from '../lib/transport'
import type { ChecklistMeta } from '../lib/compareChecklists'
import type { TideResponse } from '../lib/tide'
import type { KeyStatus } from '../lib/keyStatus'
import { hasWeatherBlock } from '../lib/commentBlocks'
import { WeatherTidePanel, type SideWeatherState, type SideTideState } from './WeatherTidePanel'

interface WeatherTideSectionProps {
  idA: string
  idB: string
  metaA: ChecklistMeta
  metaB: ChecklistMeta
  keyStatus: KeyStatus | null
  onGoToSettings: () => void
}

type WeatherResponse = { formatted: string; checklist_id: string; loc_name: string; obs_dt: string }

// Per-side weather loader — a twin of App.tsx's loadWeather, writing the passed
// setter so each side is independent (it never throws; it catches and sets its
// own error state, so a Promise.all of these never rejects). FR-11/14/21.
async function loadSideWeather(id: string, set: (s: SideWeatherState) => void): Promise<void> {
  set({ status: 'loading' })
  try {
    const data = await transport.get<WeatherResponse>(`/weather/${encodeURIComponent(id)}`)
    set({ status: 'success', formatted: data.formatted })
  } catch (err) {
    const detail = err instanceof TransportError ? (err.detail ?? err.message) : undefined
    set({ status: 'error', message: detail ?? 'Something went wrong. Please try again.' })
  }
}

// Per-side tide loader — a twin of App.tsx's loadTide; force re-fetches the
// nearest station for the too-far/outside-US override (OQ-2/FR-15).
async function loadSideTide(id: string, force: boolean, set: (s: SideTideState) => void): Promise<void> {
  set({ status: 'loading' })
  try {
    const t = await transport.get<TideResponse>(
      `/tide/${encodeURIComponent(id)}`,
      force ? { force: '1' } : undefined,
    )
    if (t.status === 'ok' && t.formatted && t.body) {
      set({ status: 'ok', formatted: t.formatted, body: t.body })
    } else if ((t.status === 'too-far' || t.status === 'outside-us') && t.station) {
      set({ status: t.status, station: t.station.name, distanceMi: t.distanceMi ?? 0 })
    } else {
      set({ status: 'unavailable' })
    }
  } catch {
    set({ status: 'error' })
  }
}

function Nudge({ text, onGoToSettings }: { text: string; onGoToSettings: () => void }) {
  return (
    <div className="sr-action-row sr-action-row-stack" style={{
      padding: '10px 14px', background: 'var(--sr-warning-bg)', border: '1px solid var(--sr-warning-subtle)',
      borderRadius: 8, fontSize: '0.8125rem', color: 'var(--sr-warning)',
    }}>
      <span className="sr-min0">{text}</span>
      <button tabIndex={0} onClick={onGoToSettings}
        style={{
          background: 'none', border: 'none', padding: 0, fontSize: '0.75rem', fontWeight: 600,
          color: 'var(--sr-warning)', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap', flexShrink: 0,
        }}>
        Go to Settings →
      </button>
    </div>
  )
}

export function WeatherTideSection({ idA, idB, metaA, metaB, keyStatus, onGoToSettings }: WeatherTideSectionProps) {
  const [weatherA, setWeatherA] = useState<SideWeatherState>({ status: 'idle' })
  const [weatherB, setWeatherB] = useState<SideWeatherState>({ status: 'idle' })
  const [tideA, setTideA] = useState<SideTideState>({ status: 'idle' })
  const [tideB, setTideB] = useState<SideTideState>({ status: 'idle' })
  const [loaded, setLoaded] = useState(false)
  const [loading, setLoading] = useState(false)

  // The single Load action fires weather + tide for BOTH sides concurrently.
  // Crucially it does NOT call copyText — the deliberate divergence from the
  // Weather tab's auto-copy (FR-15.1/QA-18).
  const loadConditions = useCallback(async () => {
    setLoaded(true)
    setLoading(true)
    await Promise.all([
      loadSideWeather(idA, setWeatherA),
      loadSideTide(idA, false, setTideA),
      loadSideWeather(idB, setWeatherB),
      loadSideTide(idB, false, setTideB),
    ])
    setLoading(false)
  }, [idA, idB])

  // Resolved-status gate. keyStatus === null means "still resolving" → show Load
  // (never a false nudge); only a resolved status with a null key shows the nudge.
  const missing: ('eBird' | 'OpenWeather')[] = []
  if (keyStatus && keyStatus.ebird === null) missing.push('eBird')
  if (keyStatus && keyStatus.openweather === null) missing.push('OpenWeather')
  const keysMissing = missing.length > 0

  const header = (
    <div className="sr-action-row" style={{ padding: '10px 14px', borderBottom: '1px solid var(--sr-border-subtle)' }}>
      <span className="sr-min0" style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--sr-text)' }}>Weather &amp; Tide</span>
      {!keysMissing && !loaded && (
        <button tabIndex={0} onClick={() => { void loadConditions() }} disabled={loading}
          style={{
            height: 38, padding: '0 16px', background: 'var(--sr-accent)', color: 'var(--sr-on-accent)',
            border: 'none', borderRadius: 8, fontSize: '0.8125rem', fontWeight: 600, fontFamily: 'inherit',
            display: 'inline-flex', alignItems: 'center', gap: 7,
            cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.65 : 1, whiteSpace: 'nowrap',
          }}>
          {loading ? <Loader2 size={15} className="spin" /> : <CloudSun size={15} strokeWidth={2.5} />}
          {loading ? 'Loading…' : 'Load weather & tide'}
        </button>
      )}
    </div>
  )

  return (
    <div style={{
      marginTop: 20, border: '1px solid var(--sr-border)', borderRadius: 10,
      background: 'var(--sr-surface)', overflow: 'hidden',
    }}>
      {header}

      {keysMissing ? (
        <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {missing.includes('eBird') && (
            <Nudge onGoToSettings={onGoToSettings}
              text="eBird API key not configured — weather & tide lookups require an eBird API key." />
          )}
          {missing.includes('OpenWeather') && (
            <Nudge onGoToSettings={onGoToSettings}
              text="OpenWeather API key not configured — weather lookups won't return conditions." />
          )}
        </div>
      ) : !loaded ? (
        <div style={{ padding: 16 }}>
          <p style={{ fontSize: '0.8125rem', color: 'var(--sr-text-muted)', lineHeight: 1.55, margin: 0, maxWidth: 560 }}>
            Pull a fresh weather and tide reading for each checklist to compare conditions side by side.
            Nothing is copied automatically.
          </p>
        </div>
      ) : (
        <div className="sr-two-col" style={{ padding: 14, alignItems: 'start' }}>
          <WeatherTidePanel
            badge="A" id={idA} meta={metaA}
            weather={weatherA} tide={tideA}
            hasEmbeddedWeatherBlock={hasWeatherBlock(metaA.comments)}
            onTideOverride={() => { void loadSideTide(idA, true, setTideA) }}
          />
          <WeatherTidePanel
            badge="B" id={idB} meta={metaB}
            weather={weatherB} tide={tideB}
            hasEmbeddedWeatherBlock={hasWeatherBlock(metaB.comments)}
            onTideOverride={() => { void loadSideTide(idB, true, setTideB) }}
          />
        </div>
      )}
    </div>
  )
}
