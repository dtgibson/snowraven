// One side (A or B) of the Weather & Tide section: a near-pure view of that
// checklist's weather + tide state. It renders the identity header (mirroring
// ChecklistTag), the monospace weather/tide blocks (the Weather tab's <pre>
// verbatim), the per-block + combined Copy buttons (copyText only on press — no
// auto-copy), the reconciliation note when a fresh lookup coexists with an
// embedded weather block, and all five tide states with the per-side override.
// All color via var(--sr-*). See design-spec §B.

import { useState } from 'react'
import { Loader2, AlertCircle, Info, ClipboardCopy, Check } from 'lucide-react'
import type { ChecklistMeta } from '../lib/compareChecklists'
import { formatObsDate } from '../lib/compareChecklists'
import { copyText } from '../lib/clipboard'
import { buildCombined } from '../lib/tideFormatter'
import { tideTooFarNotice, tideOverrideLabel } from '../lib/tideNotice'
import { ChecklistLink } from './ChecklistLink'
import { OfflineMessage } from './OfflineMessage'
import { OFFLINE_MESSAGE, NO_KEY_MESSAGE, type LiveErrorKind } from '../lib/offlineMessage'

// ── Per-side state (owned by WeatherTideSection; the panel is a view over it) ──

export type SideWeatherState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; formatted: string }   // /weather → data.formatted (ends with ATTRIBUTION)
  // errorKind distinguishes offline / no-key / server error (FR-35); the Comparer
  // is a NO-replay surface (FR-38), so offline always shows the offline message.
  | { status: 'error'; message: string; errorKind: LiveErrorKind }

export type SideTideState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ok'; formatted: string; body: string }   // formatted = standalone; body = for combined copy
  | { status: 'too-far'; station: string; distanceMi: number }
  | { status: 'outside-us'; station: string; distanceMi: number }
  | { status: 'unavailable' }
  | { status: 'error'; errorKind: LiveErrorKind }

const MONO_FONT = 'ui-monospace, "Cascadia Code", "Fira Code", Consolas, monospace'

// A monospace output block matching the Weather tab's <pre> (slightly tighter
// padding because the comparer panel is narrower).
function MonoBlock({ text }: { text: string }) {
  return (
    <pre style={{
      background: 'var(--sr-surface-subtle)', border: '1px solid var(--sr-border)', borderRadius: 8,
      padding: '14px 16px', fontFamily: MONO_FONT, fontSize: '0.8125rem', lineHeight: 1.7,
      color: 'inherit', whiteSpace: 'pre', overflowX: 'auto', margin: 0,
    }}>
      {text}
    </pre>
  )
}

// The eyebrow label + (optional) per-block Copy button on one space-between row.
function BlockEyebrow({ label, onCopy }: { label: string; onCopy?: () => void }) {
  const [copied, setCopied] = useState(false)
  const handle = () => {
    if (!onCopy) return
    onCopy()
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <div className="sr-action-row" style={{ marginBottom: 9 }}>
      <span className="sr-min0" style={{
        fontSize: '0.6875rem', fontWeight: 600, letterSpacing: '0.08em',
        textTransform: 'uppercase' as const, color: 'var(--sr-text-muted)',
      }}>
        {label}
      </span>
      {onCopy && (
        <button tabIndex={0} onClick={handle} aria-label={`Copy ${label.toLowerCase()} to clipboard`}
          style={{
            height: 28, padding: '0 11px',
            background: copied ? 'var(--sr-accent)' : 'var(--sr-accent-bg)',
            color: copied ? 'var(--sr-on-accent)' : 'var(--sr-accent-strong)',
            border: `1.5px solid ${copied ? 'var(--sr-accent)' : 'var(--sr-accent-border)'}`,
            borderRadius: 6, fontSize: '0.75rem', fontWeight: 500, fontFamily: 'inherit',
            cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5, whiteSpace: 'nowrap',
          }}>
          {copied ? <Check size={12} strokeWidth={2.5} /> : <ClipboardCopy size={12} strokeWidth={2.5} />}
          {copied ? 'Copied!' : 'Copy'}
        </button>
      )}
    </div>
  )
}

// The identity header: A/B square badge + location + date · ID (eBird link),
// mirroring ChecklistTag's top two lines so the side is unmistakable.
function IdentityHeader({ badge, id, meta }: { badge: 'A' | 'B'; id: string; meta: ChecklistMeta }) {
  const date = formatObsDate(meta.obsDt)
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 9, padding: '12px 14px',
      borderBottom: '1px solid var(--sr-border-subtle)', minWidth: 0,
    }}>
      <span aria-hidden="true" style={{
        flexShrink: 0, width: 22, height: 22, borderRadius: 6,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        background: 'var(--sr-accent-bg)', color: 'var(--sr-accent)', fontSize: '0.75rem', fontWeight: 700,
      }}>
        {badge}
      </span>
      <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0, lineHeight: 1.35, gap: 1, flex: 1 }}>
        <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--sr-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          <span className="sr-only">Checklist {badge}: </span>
          {meta.locName || id}
        </span>
        <span style={{ fontSize: '0.6875rem', color: 'var(--sr-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {date && <>{date} · </>}
          <ChecklistLink submissionId={id} />
        </span>
      </span>
    </div>
  )
}

function ReconciliationNote() {
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 8, padding: '10px 12px',
      background: 'var(--sr-accent-bg)', border: '1px solid var(--sr-accent-border)', borderRadius: 6,
      fontSize: '0.75rem', lineHeight: 1.5, color: 'var(--sr-text-muted)',
    }}>
      <Info size={13} strokeWidth={2.25} style={{ flexShrink: 0, marginTop: 1, color: 'var(--sr-accent)' }} aria-hidden="true" />
      <span>
        This checklist's comment already includes a weather block. OpenWeather revises its historical
        data over time, so this fresh lookup may differ from what's in the comment. SnowRaven shows
        what the API returns now.
      </span>
    </div>
  )
}

export interface WeatherTidePanelProps {
  badge: 'A' | 'B'
  id: string
  meta: ChecklistMeta
  weather: SideWeatherState
  tide: SideTideState
  hasEmbeddedWeatherBlock: boolean   // FR-16 note trigger for this side
  onTideOverride: () => void         // FR-15 / OQ-2 — re-fetch this side with force
}

export function WeatherTidePanel({ badge, id, meta, weather, tide, hasEmbeddedWeatherBlock, onTideOverride }: WeatherTidePanelProps) {
  const stillLoading = weather.status === 'loading' || tide.status === 'loading'
  // The whole panel shows the single loading row only while NOTHING has resolved
  // yet (both sides of this panel are still loading) — once either resolves, the
  // body renders the per-slot state.
  const showLoadingRow =
    stillLoading && weather.status !== 'success' && weather.status !== 'error' &&
    tide.status === 'loading'

  const weatherOk = weather.status === 'success'
  const tideOk = tide.status === 'ok'
  const showCombined = weatherOk && tideOk
  const showRecon = weatherOk && hasEmbeddedWeatherBlock

  return (
    <div style={{ border: '1px solid var(--sr-border)', borderRadius: 8, background: 'var(--sr-surface)', overflow: 'hidden', minWidth: 0 }}>
      <IdentityHeader badge={badge} id={id} meta={meta} />

      {showLoadingRow ? (
        <div role="status" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '18px 14px', fontSize: '0.8125rem', color: 'var(--sr-text-muted)' }}>
          <Loader2 size={14} className="spin" aria-hidden="true" />
          Loading weather &amp; tide for Checklist {badge}…
        </div>
      ) : (
        <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* ── Weather slot ─────────────────────────────────────────────── */}
          <div>
            <BlockEyebrow
              label="Weather output"
              onCopy={weatherOk ? () => { void copyText(weather.formatted) } : undefined}
            />
            {weather.status === 'loading' && (
              <div role="status" style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.8125rem', color: 'var(--sr-text-muted)' }}>
                <Loader2 size={14} className="spin" aria-hidden="true" /> Loading weather…
              </div>
            )}
            {weather.status === 'success' && <MonoBlock text={weather.formatted} />}
            {weather.status === 'error' && (
              <OfflineMessage kind={weather.errorKind} message={weather.message} />
            )}
          </div>

          {/* ── Reconciliation note (info; only when fresh lookup + embedded block) ── */}
          {showRecon && <ReconciliationNote />}

          {/* ── Tide slot ────────────────────────────────────────────────── */}
          <div>
            <BlockEyebrow
              label="Tide output"
              onCopy={tideOk ? () => { void copyText(tide.formatted) } : undefined}
            />
            {tide.status === 'loading' && (
              <div role="status" style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.8125rem', color: 'var(--sr-text-muted)' }}>
                <Loader2 size={14} className="spin" aria-hidden="true" /> Loading tide…
              </div>
            )}
            {tide.status === 'ok' && <MonoBlock text={tide.formatted} />}
            {(tide.status === 'too-far' || tide.status === 'outside-us') && (
              <div className="sr-action-row sr-action-row-stack" style={{
                background: 'var(--sr-warning-bg)', border: '1px solid var(--sr-warning-subtle)', color: 'var(--sr-warning)',
                borderRadius: 8, padding: '13px 15px', fontSize: '0.8125rem', lineHeight: 1.5,
              }}>
                <span className="sr-min0" style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                  <AlertCircle size={15} strokeWidth={2} style={{ flexShrink: 0, marginTop: 1 }} aria-hidden="true" />
                  {tideTooFarNotice(tide.station, tide.distanceMi, tide.status)}
                </span>
                <button tabIndex={0} onClick={onTideOverride}
                  aria-label="Show the nearest tide station anyway"
                  style={{
                    flexShrink: 0, height: 30, padding: '0 12px', background: 'var(--sr-accent-bg)',
                    color: 'var(--sr-accent-strong)', border: '1.5px solid var(--sr-accent-border)', borderRadius: 6,
                    fontSize: '0.75rem', fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer', whiteSpace: 'nowrap',
                  }}>
                  {tideOverrideLabel(tide.status)}
                </button>
              </div>
            )}
            {tide.status === 'unavailable' && (
              <div role="status" style={{ fontSize: '0.8125rem', color: 'var(--sr-text-muted)' }}>No tide reading available.</div>
            )}
            {tide.status === 'error' && (
              tide.errorKind === 'offline' || tide.errorKind === 'no-key' ? (
                <OfflineMessage
                  kind={tide.errorKind}
                  message={tide.errorKind === 'offline' ? OFFLINE_MESSAGE : NO_KEY_MESSAGE}
                />
              ) : (
                <div role="status" style={{ fontSize: '0.8125rem', color: 'var(--sr-text-muted)' }}>Tide data unavailable right now.</div>
              )
            )}
          </div>

          {/* ── Combined copy (only when both weather success AND tide ok) ── */}
          {showCombined && (
            <CombinedCopyButton weatherFormatted={weather.formatted} tideBody={tide.body} />
          )}
        </div>
      )}
    </div>
  )
}

function CombinedCopyButton({ weatherFormatted, tideBody }: { weatherFormatted: string; tideBody: string }) {
  const [copied, setCopied] = useState(false)
  const handle = () => {
    void copyText(buildCombined(weatherFormatted, tideBody))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <button tabIndex={0} onClick={handle} aria-label="Copy weather and tide together to clipboard"
      style={{
        width: '100%', height: 34,
        background: copied ? 'var(--sr-accent)' : 'var(--sr-accent-bg)',
        color: copied ? 'var(--sr-on-accent)' : 'var(--sr-accent-strong)',
        border: `1.5px solid ${copied ? 'var(--sr-accent)' : 'var(--sr-accent-border)'}`,
        borderRadius: 8, fontSize: '0.8125rem', fontWeight: 600, fontFamily: 'inherit',
        cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
      }}>
      {copied ? <Check size={14} strokeWidth={2.5} /> : <ClipboardCopy size={14} strokeWidth={2.5} />}
      {copied ? 'Copied!' : 'Copy weather & tide together'}
    </button>
  )
}
