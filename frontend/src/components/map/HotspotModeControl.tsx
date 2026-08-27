// The Hotspots panel's "Color pins by" block (color-coded-hotspots, FR-01/
// FR-10/FR-12/FR-14/FR-19): the four mode pills, the mode-3 window pills
// behind an animated reveal, the always-rendered status live region with its
// sequence-keyed message child (the SharePopup pattern), the progress track,
// the classified warn boxes with their supporting lines, and the retry pill.
// Presentational — every sentence comes from the pure copy builders in
// lib/hotspotColorModes.ts, so the visible line, the progress bar, and the
// announcement all read ONE emitted status (the throttle lives on the
// emitter, in useHotspotActivity — the v0.5.87 rule).

import { Loader2 } from 'lucide-react'
import { OfflineMessage } from '../OfflineMessage'
import { SidebarLabel } from './MapSidebarUI'
import { formatLoadedTime } from '../../lib/offlineMessage'
import {
  HOTSPOT_MODE_OPTIONS, ACTIVITY_WINDOW_OPTIONS,
  activityStatusSentence, activityCapLines, activityErrorLines,
  type HotspotColorMode, type ActivityWindow, type ActivityStatusFields,
} from '../../lib/hotspotColorModes'

export interface HotspotModeControlProps {
  mode: HotspotColorMode
  onModeChange: (mode: HotspotColorMode) => void
  window: ActivityWindow
  onWindowChange: (window: ActivityWindow) => void
  /** The controller's emitted status (mode 3); null before any pass exists. */
  status: (ActivityStatusFields & { seq: number }) | null
  /** True after a Week ↔ 30 days flip within the current pass/result set. */
  windowFlipped: boolean
  onRetry: () => void
  /** Use Tier Rings (colorblind-accessible-hotspot-pins): the opt-in
   *  structural cue on ramp pins. The row is revealed only while a
   *  non-default mode is active; the VALUE persists through the storage seam
   *  in MapExplorer (key 'hotspotTierRings', default off). */
  tierRings: boolean
  onTierRingsChange: (on: boolean) => void
}

export function HotspotModeControl({ mode, onModeChange, window: win, onWindowChange, status, windowFlipped, onRetry, tierRings, onTierRingsChange }: HotspotModeControlProps) {
  const activityUiLive = mode === 'activity' && status !== null && status.phase !== 'idle'
  const sentence = activityUiLive ? activityStatusSentence(status, windowFlipped, formatLoadedTime) : ''
  const running = activityUiLive && status.phase === 'running'
  const progressPct = activityUiLive && status.target > 0
    ? Math.min(100, Math.round((status.answered / status.target) * 100))
    : 0
  const capLines = activityUiLive ? activityCapLines(status) : []
  const errLines = activityUiLive ? activityErrorLines(status, formatLoadedTime) : []

  return (
    <div className="sr-ctl-row" style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--sr-border)' }}>
      <SidebarLabel>Color pins by</SidebarLabel>
      <div className="sr-hotspot-mode-grid">
        {HOTSPOT_MODE_OPTIONS.map(opt => (
          <button
            key={opt.value}
            type="button"
            tabIndex={0}
            className="sr-hotspot-mode-pill sr-touch-target"
            aria-pressed={mode === opt.value}
            onClick={() => onModeChange(opt.value)}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Window row — revealed only while Recent activity is active (FR-10),
          via the house grid-rows collapse on a lifted class; the collapsed
          content is inert so hidden pills are never stray tab stops. */}
      <div className={`sr-hotspot-reveal${mode === 'activity' ? ' sr-hotspot-reveal--open' : ''}`}>
        <div inert={mode !== 'activity'} style={{ overflow: 'hidden', minHeight: 0 }}>
          <div style={{ marginTop: 10 }}>
            <div style={{ fontSize: '0.6875rem', color: 'var(--sr-text-muted)', marginBottom: 6 }}>Time window</div>
            <div className="sr-hotspot-mode-grid">
              {ACTIVITY_WINDOW_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  tabIndex={0}
                  className="sr-hotspot-mode-pill sr-touch-target"
                  aria-pressed={win === opt.value}
                  onClick={() => onWindowChange(opt.value)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Use Tier Rings — revealed only while a non-default mode is active,
          via the same grid-rows collapse + inert idiom as the window row; the
          role="status" live region below stays OUTSIDE this inert boundary
          (the v0.5.92 rule). The switch matches the shipped Use Textures
          idiom; unlike the session-only Use-Textures precedent, the VALUE
          persists (a user-approved deviation — a vision-linked accessibility
          preference must not be re-enabled every launch). */}
      <div className={`sr-hotspot-reveal${mode !== 'default' ? ' sr-hotspot-reveal--open' : ''}`}>
        <div inert={mode === 'default'} style={{ overflow: 'hidden', minHeight: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 12 }}>
            <span style={{ fontSize: '0.8125rem', fontWeight: 500, color: 'var(--sr-text)' }}>Use Tier Rings</span>
            <button
              type="button"
              role="switch"
              aria-checked={tierRings}
              aria-label="Use tier rings on hotspot color modes"
              tabIndex={0}
              onClick={() => onTierRingsChange(!tierRings)}
              style={{
                width: 44, height: 24, borderRadius: 12, border: 'none', flexShrink: 0,
                background: tierRings ? 'var(--sr-accent)' : 'var(--sr-border-medium)',
                position: 'relative', cursor: 'pointer', transition: 'background 0.15s',
              }}
            >
              <span style={{
                position: 'absolute', top: 2, left: tierRings ? 22 : 2, width: 20, height: 20,
                borderRadius: '50%', background: 'var(--sr-switch-thumb)', transition: 'left 0.15s',
              }} />
            </button>
          </div>
          <div style={{ fontSize: '0.6875rem', color: 'var(--sr-text-muted)', marginTop: 6, lineHeight: 1.4 }}>
            Adds a segmented ring per tier so pins are readable without color.
          </div>
        </div>
      </div>

      {/* The status line: ALWAYS rendered (never inserted along with its first
          message — the live-region rule), its message a sequence-keyed child
          so each announcement is a real node replacement even when the string
          repeats. The key also carries the window/flip so a same-seq sentence
          change (a window flip) still replaces the node. */}
      <div
        role="status"
        aria-live="polite"
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          minHeight: mode === 'activity' ? '1.2em' : 0,
          marginTop: mode === 'activity' ? 8 : 0,
          fontSize: '0.71875rem', color: 'var(--sr-text-muted)', lineHeight: 1.4,
        }}
      >
        {running && <Loader2 size={11} className="spin" aria-hidden="true" style={{ flexShrink: 0, color: 'var(--sr-accent)' }} />}
        {sentence ? <span key={`${status!.seq}-${win}-${windowFlipped}`}>{sentence}</span> : null}
      </div>
      {running && (
        <div className="sr-hotspot-progress-track" aria-hidden="true" style={{ marginTop: 6 }}>
          <div className="sr-hotspot-progress-fill" style={{ width: `${progressPct}%` }} />
        </div>
      )}

      {capLines.length > 0 && !status?.error && (
        <div style={{ fontSize: '0.6875rem', color: 'var(--sr-text-muted)', marginTop: 8, lineHeight: 1.45 }}>
          {capLines.map(line => <div key={line} style={{ marginBottom: 4 }}>{line}</div>)}
        </div>
      )}

      {activityUiLive && status.error && (
        <div style={{ marginTop: 8 }}>
          <OfflineMessage kind={status.error.kind} message={status.error.message} compact />
          {errLines.length > 0 && (
            <div style={{ fontSize: '0.6875rem', color: 'var(--sr-text-muted)', marginTop: 6, lineHeight: 1.45 }}>
              {errLines.map(line => <div key={line} style={{ marginBottom: 4 }}>{line}</div>)}
            </div>
          )}
          <button
            type="button"
            tabIndex={0}
            className="sr-hotspot-retry sr-touch-target"
            onClick={onRetry}
          >
            <span aria-hidden="true">↻</span> Retry
          </button>
        </div>
      )}
    </div>
  )
}
