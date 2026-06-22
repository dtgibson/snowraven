// Settings → Offline maps (FR-11a/13/14/15/19/20). The region manager: a single
// bordered card under the "Offline maps" SectionHeader, structurally identical
// to the other Settings sections (design-spec §Screens). It is the only surface
// that may turn on Tier-B region downloads.
//
// Privacy-first posture (FR-11a): the toggle defaults OFF and NOTHING downloads
// until the user turns it on. Region downloads are desktop-only (FR-20) — on
// web/self-hosted the toggle is disabled with an honest note, since the web seam
// can't durably persist GB-scale region blobs.
//
// This imports ONLY the light `regionDownload` orchestration + plain catalog
// JSON — never `mapPmtiles`/maplibre — so it stays off the lazy map graph and
// adds nothing to first paint (NFR-15). All color via var(--sr-*).

import { useCallback, useEffect, useRef, useState } from 'react'
import { Download, X, Trash2, RefreshCw, AlertTriangle, CheckCircle2, MapPinned, Monitor, MapPin } from 'lucide-react'
import { isTauri } from '../lib/platform'
import {
  isOfflineMapsEnabled,
  setOfflineMapsEnabled,
  countiesYouBird,
  listRegions,
  downloadRegion,
  removeRegion,
  isDownloadAbort,
  formatRegionMB as formatMB,
  type CountyYouBird,
  type RegionsList,
  type CatalogRegion,
  type DownloadProgress,
} from '../lib/regionDownload'
import { ToggleSwitch } from './ui/ToggleSwitch'

const EMPTY_LIST: RegionsList = { regions: [], totalBytes: 0, currentVersion: '' }

export function OfflineMapsSection() {
  const tauri = isTauri()
  const [enabled, setEnabled] = useState(false)
  const [counties, setCounties] = useState<CountyYouBird[]>([])
  const [list, setList] = useState<RegionsList>(EMPTY_LIST)
  // Per-region transient download state, keyed by regionId.
  const [progress, setProgress] = useState<Record<string, DownloadProgress>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const controllers = useRef<Record<string, AbortController>>({})

  // Read the opt-in once on mount.
  useEffect(() => {
    let cancelled = false
    isOfflineMapsEnabled().then((v) => { if (!cancelled) setEnabled(v) }).catch(() => {})
    return () => { cancelled = true }
  }, [])

  const refresh = useCallback(async () => {
    if (!tauri) return
    try {
      const [c, l] = await Promise.all([countiesYouBird(), listRegions()])
      setCounties(c)
      setList(l)
    } catch { /* keep whatever we have */ }
  }, [tauri])

  // Load the manager data whenever offline maps is on (desktop only). The load
  // is kicked off as a promise so no setState runs synchronously in the effect.
  useEffect(() => {
    if (!enabled || !tauri) return
    let cancelled = false
    void (async () => {
      try {
        const [c, l] = await Promise.all([countiesYouBird(), listRegions()])
        if (!cancelled) { setCounties(c); setList(l) }
      } catch { /* keep whatever we have */ }
    })()
    return () => { cancelled = true }
  }, [enabled, tauri])

  const handleToggle = useCallback(() => {
    const next = !enabled
    setEnabled(next)
    void setOfflineMapsEnabled(next)
  }, [enabled])

  const handleDownload = useCallback(async (region: CatalogRegion) => {
    const id = region.regionId
    const ctrl = new AbortController()
    controllers.current[id] = ctrl
    setErrors((e) => { const n = { ...e }; delete n[id]; return n })
    setProgress((p) => ({ ...p, [id]: { received: 0, total: region.bytes, fraction: 0 } }))
    try {
      await downloadRegion(region, {
        signal: ctrl.signal,
        onProgress: (pr) => setProgress((p) => ({ ...p, [id]: pr })),
      })
      await refresh()
    } catch (err) {
      // A user cancel is not an error to surface (FR-15); anything else is a
      // failed download — the partial is already discarded by downloadRegion.
      if (!isDownloadAbort(err)) {
        setErrors((e) => ({ ...e, [id]: 'Download failed · nothing saved' }))
      }
    } finally {
      setProgress((p) => { const n = { ...p }; delete n[id]; return n })
      delete controllers.current[id]
    }
  }, [refresh])

  const handleCancel = useCallback((regionId: string) => {
    controllers.current[regionId]?.abort()
  }, [])

  const handleRemove = useCallback(async (regionId: string) => {
    try { await removeRegion(regionId) } catch { /* idempotent */ }
    await refresh()
  }, [refresh])

  // ── Web / self-hosted: region downloads can't persist here (FR-20) ───────────
  if (!tauri) {
    return (
      <>
        <div style={cardStyle}>
          <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
            {/* Disabled via native `disabled` (removed from tab order); only the
                track dims so the label stays legible (design-spec screen 5). */}
            <span aria-disabled="true" style={{ opacity: 0.55 }}>
              <ToggleSwitch label="Enable offline maps" checked={false} onChange={() => {}} />
            </span>
          </div>
          <div style={{ padding: '0 16px 14px', display: 'flex', gap: 9, alignItems: 'flex-start' }}>
            <Monitor size={15} strokeWidth={2} aria-hidden="true" style={{ flexShrink: 0, marginTop: 1, color: 'var(--sr-text-muted)' }} />
            <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--sr-text-muted)', lineHeight: 1.55 }}>
              Downloadable offline map regions are available in the desktop app. Nothing is stored either way until you
              choose to download — your maps and data stay on your device.
            </p>
          </div>
        </div>
      </>
    )
  }

  // ── Desktop ──────────────────────────────────────────────────────────────────
  const availableCounties = counties.filter((c) => c.region !== null)
  const hasAnything = list.regions.length > 0 || availableCounties.length > 0

  return (
    <>
      <div style={cardStyle}>
        {/* Toggle row — the standalone switch only; the explanatory copy lives
            below the card (design-spec fidelity correction). */}
        <div style={{ padding: '14px 16px' }}>
          <ToggleSwitch label="Enable offline maps" checked={enabled} onChange={handleToggle} />
        </div>

        {enabled && (
          <div style={{ borderTop: '1px solid var(--sr-border-subtle)' }}>
            {!hasAnything ? (
              <EmptyState />
            ) : (
              <>
                {/* Counties you bird — auto-populated download targets (OQ-10). */}
                {availableCounties.length > 0 && (
                  <div style={{ padding: '12px 16px' }}>
                    <GroupLabel>Counties you bird</GroupLabel>
                    <p style={subLineStyle}>Suggested from the counties in your eBird backup.</p>
                    {availableCounties.map((c) => {
                      const region = c.region as CatalogRegion
                      const id = region.regionId
                      const already = list.regions.some((r) => r.regionId === id)
                      if (already) return null
                      const prog = progress[id]
                      const error = errors[id]
                      return (
                        <CountyRow
                          key={id}
                          region={region}
                          countyLabel={`${c.countyName}, ${c.stateProvince.replace(/^US-/, '')}`}
                          progress={prog}
                          error={error}
                          onDownload={() => void handleDownload(region)}
                          onCancel={() => handleCancel(id)}
                        />
                      )
                    })}
                  </div>
                )}

                {/* Downloaded regions — what's on disk, with size + staleness. */}
                {list.regions.length > 0 && (
                  <div style={{ padding: '12px 16px', borderTop: availableCounties.length > 0 ? '1px solid var(--sr-border-subtle)' : undefined }}>
                    <GroupLabel>Downloaded regions</GroupLabel>
                    {list.regions.map((r) => (
                      <DownloadedRow key={r.regionId} name={r.name} bytes={r.bytes} stale={r.stale} onRemove={() => void handleRemove(r.regionId)} onUpdate={() => {
                        const cat = counties.find((c) => c.region?.regionId === r.regionId)?.region
                        if (cat) void handleDownload(cat)
                      }} />
                    ))}
                    <div role="status" style={{ marginTop: 10, fontSize: '0.75rem', color: 'var(--sr-text-muted)' }}>
                      Using {formatMB(list.totalBytes)} across {list.regions.length} {list.regions.length === 1 ? 'region' : 'regions'}.
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Explanatory copy below the card (design-spec: never baked into a row). */}
      <p style={{ fontSize: '0.75rem', color: 'var(--sr-text-muted)', marginTop: 10, lineHeight: 1.5, marginBottom: 24 }}>
        Download a map region while you have a connection, then pan and zoom it with full street and label detail when
        you're offline in the field. Nothing downloads until you turn this on, and regions stay on your device.
      </p>
    </>
  )
}

const cardStyle: React.CSSProperties = {
  border: '1px solid var(--sr-border)', borderRadius: 10, background: 'var(--sr-surface)', overflow: 'hidden',
}

function GroupLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: '0.6875rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--sr-text-muted)', marginBottom: 4 }}>
      {children}
    </div>
  )
}

const subLineStyle: React.CSSProperties = {
  margin: '0 0 10px', fontSize: '0.75rem', color: 'var(--sr-text-muted)', lineHeight: 1.5,
}

function EmptyState() {
  return (
    <div style={{ padding: '28px 16px', textAlign: 'center', color: 'var(--sr-text-muted)' }}>
      <MapPinned size={26} strokeWidth={1.75} aria-hidden="true" style={{ color: 'var(--sr-text-muted)', marginBottom: 8 }} />
      <p style={{ margin: 0, fontSize: '0.8125rem', lineHeight: 1.5 }}>
        No regions downloaded yet. Once your eBird backup is loaded, the counties you bird will appear here to download.
      </p>
    </div>
  )
}

interface CountyRowProps {
  region: CatalogRegion
  countyLabel: string
  progress?: DownloadProgress
  error?: string
  onDownload: () => void
  onCancel: () => void
}

function CountyRow({ region, countyLabel, progress, error, onDownload, onCancel }: CountyRowProps) {
  const downloading = progress !== undefined
  const pct = progress?.fraction != null ? Math.round(progress.fraction * 100) : null
  return (
    <div style={{ padding: '8px 0', borderTop: '1px solid var(--sr-border-subtle)' }}>
      <div className="sr-action-row sr-action-row-stack">
        <div className="sr-min0" style={{ display: 'flex', gap: 9, alignItems: 'center', minWidth: 0 }}>
          <MapPin size={15} strokeWidth={2} aria-hidden="true" style={{ flexShrink: 0, color: 'var(--sr-text-muted)' }} />
          <span className="sr-truncate" style={{ fontSize: '0.8125rem', color: 'var(--sr-text)', fontWeight: 500 }}>{countyLabel}</span>
          <span style={{ fontSize: '0.6875rem', color: 'var(--sr-text-muted)', whiteSpace: 'nowrap' }}>~{formatMB(region.bytes)}</span>
        </div>
        {downloading ? (
          <button tabIndex={0} onClick={onCancel} aria-label={`Cancel downloading ${countyLabel}`} style={neutralBtnStyle}>
            <X size={13} strokeWidth={2.5} aria-hidden="true" /> Cancel
          </button>
        ) : (
          <button tabIndex={0} onClick={onDownload} aria-label={`Download ${countyLabel} (${formatMB(region.bytes)})`} style={accentBtnStyle}>
            <Download size={13} strokeWidth={2.5} aria-hidden="true" /> Download
          </button>
        )}
      </div>

      {downloading && (
        <div style={{ marginTop: 8 }}>
          <div
            role="progressbar"
            aria-label={`Downloading ${countyLabel}`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={pct ?? undefined}
            style={{ height: 8, borderRadius: 4, background: 'var(--sr-surface-subtle)', border: '1px solid var(--sr-border-input)', overflow: 'hidden' }}
          >
            <div style={{ height: '100%', width: pct != null ? `${pct}%` : '100%', background: 'var(--sr-accent)', transition: 'width 0.2s' }} />
          </div>
          {/* aria-live status + a visible % node — state never by color alone. */}
          <div aria-live="polite" style={{ marginTop: 4, fontSize: '0.6875rem', color: 'var(--sr-text-muted)' }}>
            {progress.total != null
              ? `${formatMB(progress.received)} of ${formatMB(progress.total)}${pct != null ? ` (${pct}%)` : ''}`
              : `${formatMB(progress.received)} downloaded…`}
          </div>
        </div>
      )}

      {error && (
        <div role="alert" style={{ marginTop: 8, display: 'flex', gap: 7, alignItems: 'flex-start', fontSize: '0.75rem', color: 'var(--sr-error)' }}>
          <AlertTriangle size={13} strokeWidth={2} aria-hidden="true" style={{ flexShrink: 0, marginTop: 1 }} />
          <span style={{ minWidth: 0 }}>{error}</span>
        </div>
      )}
    </div>
  )
}

interface DownloadedRowProps {
  name: string
  bytes: number
  stale: boolean
  onRemove: () => void
  onUpdate: () => void
}

function DownloadedRow({ name, bytes, stale, onRemove, onUpdate }: DownloadedRowProps) {
  return (
    <div style={{ padding: '8px 0', borderTop: '1px solid var(--sr-border-subtle)' }}>
      <div className="sr-action-row sr-action-row-stack">
        <div className="sr-min0" style={{ display: 'flex', gap: 9, alignItems: 'center', minWidth: 0 }}>
          <MapPinned size={15} strokeWidth={2} aria-hidden="true" style={{ flexShrink: 0, color: 'var(--sr-accent)' }} />
          <span className="sr-truncate" style={{ fontSize: '0.8125rem', color: 'var(--sr-text)', fontWeight: 500 }}>{name}</span>
          <span style={{ fontSize: '0.6875rem', color: 'var(--sr-text-muted)', whiteSpace: 'nowrap' }}>{formatMB(bytes)}</span>
          {stale ? (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.625rem', fontWeight: 600, padding: '2px 6px', borderRadius: 5, background: 'var(--sr-warning-bg)', border: '1px solid var(--sr-warning-subtle)', color: 'var(--sr-warning)', whiteSpace: 'nowrap' }}>
              <AlertTriangle size={11} strokeWidth={2.5} aria-hidden="true" /> Out of date
            </span>
          ) : (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.625rem', fontWeight: 600, color: 'var(--sr-accent)', whiteSpace: 'nowrap' }}>
              <CheckCircle2 size={11} strokeWidth={2.5} aria-hidden="true" /> Up to date
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
          {stale && (
            <button tabIndex={0} onClick={onUpdate} aria-label={`Update ${name}`} style={neutralBtnStyle}>
              <RefreshCw size={13} strokeWidth={2.5} aria-hidden="true" /> Update
            </button>
          )}
          <button tabIndex={0} onClick={onRemove} aria-label={`Remove ${name}`} style={removeBtnStyle}>
            <Trash2 size={13} strokeWidth={2.5} aria-hidden="true" /> Remove
          </button>
        </div>
      </div>
    </div>
  )
}

const baseBtnStyle: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6, height: 32, padding: '0 12px',
  borderRadius: 6, fontSize: '0.75rem', fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer',
  whiteSpace: 'nowrap', flexShrink: 0,
}
const accentBtnStyle: React.CSSProperties = {
  ...baseBtnStyle, background: 'var(--sr-accent)', color: 'var(--sr-on-accent)', border: 'none',
}
const neutralBtnStyle: React.CSSProperties = {
  ...baseBtnStyle, background: 'none', color: 'var(--sr-text)', border: '1.5px solid var(--sr-border)',
}
const removeBtnStyle: React.CSSProperties = {
  ...baseBtnStyle, background: 'none', color: 'var(--sr-error)', border: '1.5px solid var(--sr-error-border)',
}
