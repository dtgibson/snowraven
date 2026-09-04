// Weather Backlog — a third section at the bottom of the Weather tab. A collapsed
// entry point ("List checklists with no weather blocks") expands in place to a
// list of the user's most-recent checklists whose comment carries NO recognized
// weather block (SnowRaven OR RainCrow), newest first, built entirely from the
// already-loaded eBird backup. Each row offers three actions:
//   #1 open the checklist on eBird (ChecklistLink),
//   #2 open its comment/edit page on eBird (OutboundLink),
//   #3 "Copy weather & go" — look up this checklist's weather, copy it (weather
//      ONLY, per the user decision), and on a successful copy open the comment/
//      edit page so the user can paste. On ANY failure the page is NOT opened and
//      the failure is surfaced inline (offline / missing-key / generic error).
//
// The component is PRESENTATIONAL: it receives the settled result of the backup
// load as one prop — already-built rows, or no backup stored (needs-data), or a
// backup that is stored and would not load (the shared load-failure message) —
// plus a state-free weather-lookup wrapper, the copyText seam, and an optional
// isHotspot resolver. The Weather tab owns loading the backup and building the
// lookup wrapper, so the single-checklist lookup UI is never touched (NFR-10).
// Session-only state, no persistence.
//
// See pipeline/weather-backlog/{prd,schema,design-spec,decisions}.md.

import { useCallback, useMemo, useState } from 'react'
import {
  List, ChevronDown, SquarePen, Copy, Check, Loader2,
  TriangleAlert, CircleAlert, WifiOff, KeyRound, FileText, CheckCircle2, Download,
} from 'lucide-react'
import { computeBacklog, pageBacklog, PAGE_SIZE, type BacklogRow } from '../lib/weatherBacklog'
import { BACKLOG_LOAD_FAILED, type ResolvedBacklogRows } from '../lib/weatherBacklogLoad'
import { EBIRD_BACKUP_LOAD_ERROR } from './setupCopy'
import { TabLoadErrorAlert } from './ui/TabLoadErrorAlert'
import { ChecklistLink } from './ChecklistLink'
import { OutboundLink } from './OutboundLink'
import { HotspotLink } from './HotspotLink'
import { classifyLiveError, type LiveErrorKind } from '../lib/offlineMessage'
import { protocolName, formatDuration, formatDistance } from '../lib/checklistMeta'
import { formatDate } from '../lib/formatDate'
import { SUBMISSION_ID_RE } from './speciesDetail/ui'
import { openExternalUrl } from '../lib/openExternal'

// ── Props ────────────────────────────────────────────────────────────────────

export interface WeatherBacklogProps {
  /** Already-built rows; `null` when no eBird backup is STORED (→ needs-data);
   *  `BACKLOG_LOAD_FAILED` when one is stored and could not be turned into rows
   *  (→ the shared load-failure message); undefined while the rows are still
   *  being built (→ brief loading state). Four states on one prop, because a
   *  failure flag beside it would admit "failed and ready at once". */
  rows: ResolvedBacklogRows | undefined
  /** State-free per-checklist weather lookup → the formatted block, or null on a
   *  failed lookup. It must THROW (so classifyLiveError can classify the cause)
   *  or return null; returning null is treated as a generic error. Reuses the
   *  same /weather/<id> transport path as the single-checklist lookup, without
   *  touching that lookup's UI state. */
  lookupWeather: (id: string) => Promise<string | null>
  /** Shared clipboard seam — copyText. Returns true on a successful copy. */
  onCopy: (text: string) => Promise<boolean>
  /** Optional public-hotspot resolver (FR-15). Omit → plain-text locations. */
  isHotspot?: (locId: string | null | undefined) => boolean
  /** Navigate the user to Settings (missing-key nudge). */
  onGoToSettings?: () => void
  /** Navigate the user to where the eBird backup is imported (needs-data CTA). */
  onGoToImport?: () => void
  /** Called the first time the entry point is expanded, so the tab can lazily
   *  build `rows` only when the user actually opens the backlog (keeps the
   *  Weather tab's first paint free of a backup parse). */
  onFirstExpand?: () => void
}

// ── Action #3 copy content (OQ-3 → weather-only, user decision) ──────────────
// Returns the WEATHER BLOCK ONLY — no tide fetch or append (decisions.md §OQ-3).
// null propagates the lookup failure so the caller shows an error and does NOT
// open the comment page.
async function buildBacklogCopyText(
  id: string,
  lookupWeather: (id: string) => Promise<string | null>,
): Promise<string | null> {
  return lookupWeather(id)
}

const EDIT_URL = (id: string) => `https://ebird.org/edit/effort?subID=${encodeURIComponent(id)}`

// ── Per-row action #3 state machine ──────────────────────────────────────────

type RowState =
  | { kind: 'idle' }
  | { kind: 'looking-up' }
  | { kind: 'copying' }
  | { kind: 'success' }
  | { kind: 'error-offline' }
  | { kind: 'error-no-key' }
  | { kind: 'error-other' }
  | { kind: 'error-bad-id' }

const ICON = { width: 14, height: 14, strokeWidth: 2.2 } as const

// ── One backlog row ──────────────────────────────────────────────────────────

function BacklogRowView({
  entry, lookupWeather, onCopy, isHotspot, onGoToSettings,
}: {
  entry: BacklogRow
  lookupWeather: (id: string) => Promise<string | null>
  onCopy: (text: string) => Promise<boolean>
  isHotspot?: (locId: string | null | undefined) => boolean
  onGoToSettings?: () => void
}) {
  const c = entry.row.checklist
  const [state, setState] = useState<RowState>({ kind: 'idle' })

  const validId = SUBMISSION_ID_RE.test(c.submissionId)
  const busy = state.kind === 'looking-up' || state.kind === 'copying'

  const dateLabel = formatDate(c.date)

  const runAction3 = useCallback(async () => {
    // In-flight guard: a re-click while looking-up/copying is ignored, so there
    // is no double fetch and — critically — no double open (FR-27).
    if (state.kind === 'looking-up' || state.kind === 'copying') return
    if (!validId) {
      setState({ kind: 'error-bad-id' })
      return
    }
    setState({ kind: 'looking-up' })
    let block: string | null
    try {
      block = await buildBacklogCopyText(c.submissionId, lookupWeather)
    } catch (err) {
      const kind: LiveErrorKind = classifyLiveError(err).kind
      setState(kind === 'offline' ? { kind: 'error-offline' }
        : kind === 'no-key' ? { kind: 'error-no-key' }
        : { kind: 'error-other' })
      return
    }
    if (block == null) {
      // A null lookup with no throw → treat as a generic lookup failure.
      setState({ kind: 'error-other' })
      return
    }
    setState({ kind: 'copying' })
    const copied = await onCopy(block)
    if (!copied) {
      setState({ kind: 'error-other' })
      return
    }
    // Success edge — open the edit page EXACTLY ONCE, only here (FR-18c/FR-19).
    // openExternalUrl (NOT window.open) so it opens in the desktop app too — a raw
    // window.open is silently dropped in the Tauri WebView (see lib/openExternal.ts).
    openExternalUrl(EDIT_URL(c.submissionId))
    setState({ kind: 'success' })
  }, [state.kind, validId, c.submissionId, lookupWeather, onCopy])

  // Meta line (line 2): protocol · distance · duration · county, state · completeness.
  const stateAbbr = c.stateProvince ? c.stateProvince.split('-')[1] : null
  const place = [c.county, stateAbbr].filter(Boolean).join(', ')
  const meta: string[] = []
  if (c.protocol) meta.push(protocolName(c.protocol))
  if (c.distance != null && c.distance > 0) meta.push(formatDistance(c.distance, null))
  if (c.duration != null && c.duration > 0) meta.push(formatDuration(c.duration / 60)) // CSV minutes → helper takes hours
  if (place) meta.push(place)
  if (entry.isComplete) meta.push('Complete')

  return (
    <div
      style={{
        padding: '13px 18px 14px',
        borderBottom: '1px solid var(--sr-border-subtle)',
        background: entry.surfacedByWiden ? 'var(--sr-surface-faint)' : 'transparent',
      }}
    >
      {/* Line 1: date · location · species count */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 7, flexWrap: 'wrap', minWidth: 0 }}>
        <ChecklistLink
          submissionId={c.submissionId}
          label={dateLabel}
          style={{ fontSize: '0.8125rem', fontWeight: 600, whiteSpace: 'nowrap', flexShrink: 0 }}
        />
        <span style={{ fontSize: '0.75rem', color: 'var(--sr-text-disabled)' }}>·</span>
        {isHotspot ? (
          <HotspotLink
            locId={c.locationId}
            name={c.location}
            isHotspot={isHotspot(c.locationId)}
            truncate
            style={{ fontSize: '0.8125rem', fontWeight: 500, minWidth: 0 }}
          />
        ) : (
          <span className="sr-truncate" style={{ fontSize: '0.8125rem', fontWeight: 500, color: 'var(--sr-text)' }}>
            {c.location}
          </span>
        )}
        <span style={{ marginLeft: 'auto', paddingLeft: 12, fontSize: '0.75rem', fontWeight: 700, color: 'var(--sr-accent)', whiteSpace: 'nowrap', flexShrink: 0 }}>
          {c.speciesCount.toLocaleString()} species
        </span>
      </div>

      {/* Line 2: widen chip + meta */}
      {(meta.length > 0 || entry.surfacedByWiden) && (
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '5px 9px', marginTop: 5, fontSize: '0.71875rem', color: 'var(--sr-text-muted)' }}>
          {entry.surfacedByWiden && !entry.isComplete && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 4, padding: '1px 7px', borderRadius: 5,
              fontSize: '0.65625rem', fontWeight: 600, letterSpacing: '0.02em',
              background: 'var(--sr-warning-bg)', color: 'var(--sr-warning)', border: '1px solid var(--sr-warning-subtle)',
            }}>
              <TriangleAlert width={10} height={10} strokeWidth={2.6} aria-hidden="true" />
              Incomplete
            </span>
          )}
          {entry.surfacedByWiden && entry.isComplete && entry.isIncidental && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 4, padding: '1px 7px', borderRadius: 5,
              fontSize: '0.65625rem', fontWeight: 600, letterSpacing: '0.02em',
              background: 'var(--sr-surface-subtle)', color: 'var(--sr-text-muted)', border: '1px solid var(--sr-border)',
            }}>
              <CircleAlert width={10} height={10} strokeWidth={2.4} aria-hidden="true" />
              Incidental
            </span>
          )}
          {meta.map((m, i) => (
            <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
              {i > 0 && <span style={{ color: 'var(--sr-text-disabled)' }} aria-hidden="true">·</span>}
              {m}
            </span>
          ))}
        </div>
      )}

      {/* Line 3: actions */}
      <div className="sr-wrap-flex" style={{ marginTop: 11, ['--sr-wrap-gap' as string]: '6px' }}>
        {/* #1 open checklist */}
        <span className="sr-touch-target" style={{ borderRadius: 8 }}>
          <ChecklistLink submissionId={c.submissionId} label={dateLabel} compact size="md"
            title="Open checklist on eBird"
            style={{ justifyContent: 'center', width: 32, height: 32, border: '1px solid var(--sr-border-medium)', borderRadius: 8, color: 'var(--sr-text)' }}
          />
        </span>
        {/* #2 open comment/edit page */}
        {validId ? (
          <OutboundLink
            href={EDIT_URL(c.submissionId)}
            aria-label="Open this checklist's comment and edit page on eBird"
            title="Open comment/edit page on eBird"
            className="sr-touch-target"
            style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, border: '1px solid var(--sr-border-medium)', borderRadius: 8, color: 'var(--sr-text)', textDecoration: 'none' }}
          >
            <SquarePen {...ICON} aria-hidden="true" />
          </OutboundLink>
        ) : (
          <span className="sr-touch-target" title="Comment/edit page unavailable: this checklist has no valid eBird id"
            style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, border: '1px solid var(--sr-border-subtle)', borderRadius: 8, color: 'var(--sr-text-disabled)' }}
            aria-label="Comment/edit page unavailable for this checklist"
          >
            <SquarePen {...ICON} aria-hidden="true" />
          </span>
        )}
        <span style={{ flex: '1 1 auto', minWidth: 6 }} aria-hidden="true" />
        {/* #3 copy weather & go */}
        <button
          tabIndex={0}
          type="button"
          onClick={runAction3}
          disabled={busy}
          aria-busy={busy}
          aria-label={
            state.kind === 'success'
              ? `Weather copied for the ${dateLabel} checklist. Comment page opened`
              : `Copy this checklist's weather and open its comment page on eBird`
          }
          className="sr-touch-target"
          style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            height: 32, padding: '0 11px', borderRadius: 8,
            fontFamily: 'inherit', fontSize: '0.75rem', fontWeight: 600, whiteSpace: 'nowrap',
            cursor: busy ? 'default' : 'pointer',
            ...(state.kind === 'success'
              ? { background: 'var(--sr-accent-bg)', color: 'var(--sr-accent-strong)', border: '1px solid var(--sr-accent-border-strong)' }
              : { background: 'var(--sr-accent)', color: 'var(--sr-on-accent)', border: '1px solid var(--sr-accent)', opacity: busy ? 0.7 : 1 }),
          }}
        >
          {state.kind === 'looking-up' || state.kind === 'copying' ? (
            <><Loader2 {...ICON} strokeWidth={2.4} className="spin" aria-hidden="true" />Looking up…</>
          ) : state.kind === 'success' ? (
            <><Check {...ICON} strokeWidth={2.6} aria-hidden="true" />Copied · comment page opened</>
          ) : (
            <><Copy {...ICON} aria-hidden="true" />Copy weather &amp; go</>
          )}
        </button>
      </div>

      {/* Live-region announcement for loading/success (polite). */}
      <span className="sr-only" role="status" aria-live="polite">
        {state.kind === 'looking-up' || state.kind === 'copying'
          ? `Looking up weather for the ${dateLabel} checklist.`
          : state.kind === 'success'
            ? 'Weather copied. Comment page opened in a new tab. Paste to add it.'
            : ''}
      </span>

      {/* Inline failure states (role=alert). The comment page is NOT opened. */}
      {state.kind === 'error-offline' && (
        <RowStatus tone="error" icon={<WifiOff {...ICON} aria-hidden="true" />}>
          <b>You're offline.</b> The weather lookup needs a connection. Nothing was copied and the comment page wasn't opened. Try again when you're back online.
        </RowStatus>
      )}
      {state.kind === 'error-no-key' && (
        <RowStatus tone="warn" icon={<KeyRound {...ICON} aria-hidden="true" />}>
          <b>Weather lookup needs an API key.</b> Add your eBird &amp; OpenWeather keys in{' '}
          {onGoToSettings ? (
            <button tabIndex={0} type="button" onClick={onGoToSettings} style={statusLinkStyle}>Settings →</button>
          ) : <b>Settings</b>}{' '}to use this action. Nothing was copied.
        </RowStatus>
      )}
      {state.kind === 'error-other' && (
        <RowStatus tone="error" icon={<CircleAlert {...ICON} aria-hidden="true" />}>
          <b>Weather lookup failed.</b> Something went wrong fetching this checklist's weather. Nothing was copied and the comment page wasn't opened.{' '}
          <button tabIndex={0} type="button" onClick={runAction3} style={statusLinkStyle}>Try again</button>
        </RowStatus>
      )}
      {state.kind === 'error-bad-id' && (
        <RowStatus tone="warn" icon={<TriangleAlert {...ICON} aria-hidden="true" />}>
          <b>This checklist has no valid eBird id.</b> Its weather can't be looked up and the comment page can't be opened. Nothing was copied.
        </RowStatus>
      )}
    </div>
  )
}

// The expanded panel's card chrome. Shared with the load-failure wrapper so the
// failure reads as the same box the panel would have been, rather than as a
// second treatment that can drift from it.
const panelCardStyle: React.CSSProperties = {
  width: '100%', marginTop: 12, background: 'var(--sr-surface)',
  border: '1px solid var(--sr-border)', borderRadius: 12, boxShadow: 'var(--sr-card-shadow)',
}

const statusLinkStyle: React.CSSProperties = {
  color: 'inherit', fontWeight: 700, textDecoration: 'underline', textUnderlineOffset: 2,
  cursor: 'pointer', whiteSpace: 'nowrap', background: 'none', border: 'none', padding: 0, font: 'inherit',
}

function RowStatus({ tone, icon, children }: { tone: 'error' | 'warn'; icon: React.ReactNode; children: React.ReactNode }) {
  const palette = tone === 'error'
    ? { background: 'var(--sr-error-bg)', color: 'var(--sr-error)', border: '1px solid var(--sr-error-border)' }
    : { background: 'var(--sr-warning-bg)', color: 'var(--sr-warning)', border: '1px solid var(--sr-warning-subtle)' }
  return (
    <div role="alert" style={{
      display: 'flex', alignItems: 'flex-start', gap: 7, marginTop: 9, padding: '8px 11px',
      borderRadius: 8, fontSize: '0.75rem', lineHeight: 1.4, ...palette,
    }}>
      <span style={{ flexShrink: 0, marginTop: 1 }}>{icon}</span>
      <span style={{ minWidth: 0 }}>{children}</span>
    </div>
  )
}

// ── Empty / needs-data / zero-match states ───────────────────────────────────

function StateBlock({ icon, title, body, cta, accentIcon }: {
  icon: React.ReactNode
  title: string
  body: string
  cta?: { label: string; onClick: () => void }
  accentIcon?: boolean
}) {
  return (
    <div role="status" style={{ padding: '34px 24px', textAlign: 'center' }}>
      <span style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 44, height: 44,
        borderRadius: 12, marginBottom: 12,
        background: accentIcon ? 'var(--sr-accent-bg)' : 'var(--sr-surface-subtle)',
        color: accentIcon ? 'var(--sr-accent)' : 'var(--sr-text-muted)',
      }}>{icon}</span>
      <div style={{ fontSize: '0.9375rem', fontWeight: 600 }}>{title}</div>
      <p style={{ fontSize: '0.8125rem', color: 'var(--sr-text-muted)', margin: '6px auto 0', maxWidth: 360, lineHeight: 1.5 }}>{body}</p>
      {cta && (
        <button tabIndex={0} type="button" onClick={cta.onClick} style={{
          display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 14, height: 36, padding: '0 15px',
          background: 'var(--sr-accent)', color: 'var(--sr-on-accent)', border: 'none', borderRadius: 8,
          fontFamily: 'inherit', fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer',
        }}>
          <Download width={14} height={14} strokeWidth={2.2} aria-hidden="true" />
          {cta.label}
        </button>
      )}
    </div>
  )
}

// ── The main component ───────────────────────────────────────────────────────

export function WeatherBacklog({ rows, lookupWeather, onCopy, isHotspot, onGoToSettings, onGoToImport, onFirstExpand }: WeatherBacklogProps) {
  const [expanded, setExpanded] = useState(false)
  const [everExpanded, setEverExpanded] = useState(false)
  const [includeWidened, setIncludeWidened] = useState(false)
  const [shown, setShown] = useState(PAGE_SIZE)

  const onToggleExpand = useCallback(() => {
    setExpanded(e => !e)
    // Side effects (a sibling setState + the App-level onFirstExpand) must run in
    // the handler, NOT inside the setExpanded updater — an updater runs during
    // React's render phase, and calling another component's setState there is the
    // "Cannot update a component while rendering a different component" warning.
    // The component starts collapsed, so the first toggle is always the first
    // expand; fire the lazy-build once here.
    if (!everExpanded) {
      setEverExpanded(true)
      onFirstExpand?.()
    }
  }, [everExpanded, onFirstExpand])

  // `Array.isArray`, not a truthiness test: `BACKLOG_LOAD_FAILED` is a non-empty
  // string and would sail through `rows ? …` into computeBacklog.
  const backlog = useMemo(
    () => (Array.isArray(rows) ? computeBacklog(rows, { includeWidened }) : []),
    [rows, includeWidened],
  )
  const page = useMemo(() => pageBacklog(backlog, shown), [backlog, shown])

  // A backup IS stored and it would not load. Shown only while the section is
  // open: collapsing empties the region, so re-opening inserts a fresh message
  // node into a region that was already there.
  const showLoadFailure = expanded && rows === BACKLOG_LOAD_FAILED

  // TabLoadErrorAlert's "Go to Settings" is not optional the way this section's
  // other affordances are, and every call site in the app passes the handler.
  const goToSettings = useCallback(() => { onGoToSettings?.() }, [onGoToSettings])

  const toggleWiden = useCallback(() => {
    // Reset pagination in the handler so a stale offset can't mis-page the new
    // set (FR-22) — never in a render/effect.
    setIncludeWidened(v => !v)
    setShown(PAGE_SIZE)
  }, [])

  return (
    <div style={{ width: '100%' }}>
      {/* Collapsed entry point */}
      <button
        tabIndex={0}
        type="button"
        aria-expanded={expanded}
        onClick={onToggleExpand}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 11, padding: '15px 18px',
          background: 'var(--sr-surface)', border: '1px solid var(--sr-border)', borderRadius: 12,
          boxShadow: 'var(--sr-card-shadow)', fontFamily: 'inherit', textAlign: 'left',
          cursor: 'pointer', color: 'var(--sr-text)',
        }}
      >
        <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, width: 30, height: 30, borderRadius: 8, background: 'var(--sr-accent-bg)', color: 'var(--sr-accent)' }}>
          <List width={16} height={16} strokeWidth={2.2} aria-hidden="true" />
        </span>
        <span style={{ minWidth: 0, flex: 1 }}>
          <span style={{ display: 'block', fontSize: '0.9375rem', fontWeight: 600, letterSpacing: '-0.01em' }}>List checklists with no weather blocks</span>
          <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--sr-text-muted)', marginTop: 2 }}>Work down your missing-weather backlog, newest first</span>
        </span>
        <ChevronDown
          width={18} height={18} strokeWidth={2.2} aria-hidden="true"
          style={{ flexShrink: 0, color: 'var(--sr-text-muted)', transition: 'transform .15s', transform: expanded ? 'rotate(180deg)' : 'none' }}
        />
      </button>

      {expanded && !showLoadFailure && (
        <div style={panelCardStyle}>
          {rows === undefined ? (
            <div role="status" aria-live="polite" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '34px 24px', color: 'var(--sr-text-muted)', fontSize: '0.8125rem' }}>
              <Loader2 width={18} height={18} strokeWidth={2} className="spin" aria-hidden="true" />
              Building your backlog…
            </div>
          ) : rows === null ? (
            <StateBlock
              icon={<FileText width={22} height={22} strokeWidth={2} aria-hidden="true" />}
              title="Load your eBird backup first"
              body="The backlog is built from your downloaded eBird data. Import your MyEBirdData export and this list fills in automatically; no lookups needed to build it."
              cta={onGoToImport ? { label: 'Go to Import', onClick: onGoToImport } : undefined}
            />
          ) : (
            <>
              {/* Header */}
              <div style={{ padding: '16px 18px 14px', borderBottom: '1px solid var(--sr-border-subtle)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, width: 30, height: 30, borderRadius: 8, background: 'var(--sr-accent-bg)', color: 'var(--sr-accent)' }}>
                    <List width={16} height={16} strokeWidth={2.2} aria-hidden="true" />
                  </span>
                  <h2 style={{ fontSize: '1.0625rem', fontWeight: 700, letterSpacing: '-0.01em', margin: 0 }}>Checklists missing weather</h2>
                </div>
                <p style={{ fontSize: '0.75rem', color: 'var(--sr-text-muted)', margin: '8px 0 0', lineHeight: 1.45 }}>
                  <b style={{ color: 'var(--sr-text)', fontWeight: 600 }}>{page.total.toLocaleString()}</b>{' '}
                  {includeWidened
                    ? 'checklists with no weather block, including incomplete & incidental · newest first'
                    : 'complete, non-incidental checklists with no weather block · newest first'}
                </p>
                {/* Widen toggle (role=switch) */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginTop: 12, padding: '9px 11px', background: 'var(--sr-surface-faint)', border: '1px solid var(--sr-border-subtle)', borderRadius: 9 }}>
                  <button
                    tabIndex={0}
                    type="button"
                    role="switch"
                    aria-checked={includeWidened}
                    aria-label="Also show incomplete and incidental checklists"
                    onClick={toggleWiden}
                    style={{
                      position: 'relative', flexShrink: 0, width: 34, height: 20, borderRadius: 999,
                      background: includeWidened ? 'var(--sr-accent)' : 'var(--sr-gray-400)',
                      border: 'none', padding: 0, cursor: 'pointer', transition: 'background .15s',
                    }}
                  >
                    <span aria-hidden="true" style={{
                      position: 'absolute', top: 2, left: 2, width: 16, height: 16, borderRadius: '50%',
                      background: 'var(--sr-switch-thumb)', boxShadow: 'var(--sr-switch-thumb-shadow)', transition: 'transform .15s',
                      transform: includeWidened ? 'translateX(14px)' : 'none',
                    }} />
                  </button>
                  <span style={{ fontSize: '0.8125rem', fontWeight: 500, color: 'var(--sr-text)', minWidth: 0 }}>
                    Also show incomplete &amp; incidental <span style={{ color: 'var(--sr-text-muted)', fontWeight: 400 }}>(widens the list)</span>
                  </span>
                </div>
              </div>

              {backlog.length === 0 ? (
                <StateBlock
                  accentIcon
                  icon={<CheckCircle2 width={22} height={22} strokeWidth={2.2} aria-hidden="true" />}
                  title={includeWidened ? 'No checklists are missing weather' : 'No complete checklists are missing weather'}
                  body={includeWidened
                    ? 'Every recent checklist in your backup already has a weather block. Nothing left to work down.'
                    : 'Every recent complete, non-incidental checklist already has a weather block. Turn on “Also show incomplete & incidental” above to check the rest of your backlog.'}
                />
              ) : (
                <>
                  {page.visible.map(entry => (
                    <BacklogRowView
                      key={entry.row.checklist.submissionId}
                      entry={entry}
                      lookupWeather={lookupWeather}
                      onCopy={onCopy}
                      isHotspot={isHotspot}
                      onGoToSettings={onGoToSettings}
                    />
                  ))}

                  {/* Pagination — only when more than the current page match. */}
                  {page.hasMore && (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, flexWrap: 'wrap', padding: '14px 18px', borderTop: '1px solid var(--sr-border-subtle)' }}>
                      <button
                        tabIndex={0}
                        type="button"
                        onClick={() => setShown(s => Math.min(s + PAGE_SIZE, backlog.length))}
                        className="sr-touch-target"
                        style={{ height: 36, padding: '0 15px', borderRadius: 8, fontFamily: 'inherit', fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer', border: '1px solid var(--sr-border-medium)', background: 'var(--sr-surface)', color: 'var(--sr-text)' }}
                      >
                        Show next {PAGE_SIZE}
                      </button>
                      <button
                        tabIndex={0}
                        type="button"
                        onClick={() => setShown(backlog.length)}
                        className="sr-touch-target"
                        style={{ height: 36, padding: '0 15px', borderRadius: 8, fontFamily: 'inherit', fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer', border: '1px solid transparent', background: 'none', color: 'var(--sr-accent)' }}
                      >
                        Show all ({backlog.length.toLocaleString()})
                      </button>
                      <span style={{ fontSize: '0.71875rem', color: 'var(--sr-text-muted)' }}>
                        Showing 1–{page.visible.length.toLocaleString()}
                      </span>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>
      )}

      {/* The load-failure region, MOUNTED ALWAYS -- collapsed, expanded, and in
          every other state -- and filled afterwards.

          `role="alert"` announces a mutation observed on a node that is ALREADY
          in the accessibility tree, so a region created carrying its text is a
          single insertion with nothing registered to observe it and the sentence
          is simply never spoken (DECISIONS.md v0.5.83, and v1.0.15 where eight
          tab panels carried it in exactly that shape). On those tabs the shared
          component is mounted at fragment index 0 of every branch that can reach
          the error phase, which is enough there because a tab's panel does not
          unmount under it. This is not a tab: it is a disclosure whose panel
          UNMOUNTS on collapse, so a region mounted inside the panel would hold
          the guarantee on the first expand -- the panel always opens on the
          spinner -- and lose it on every collapse-then-re-expand, where the
          region and its message would arrive in one commit. Hoisting it out of
          the disclosure is what makes both paths hold; it is the same structural
          repair, one level up, not a new idea.

          Idle it carries no inline styles and no content, so it computes to zero
          height and shifts nothing, and it is never HIDDEN to achieve that --
          hiding a live region is the other route into the same trap. The card
          chrome goes on this wrapper only while the failure is showing, and the
          panel above is not rendered in that state, so the two are never both on
          screen. */}
      <div style={showLoadFailure ? panelCardStyle : undefined}>
        <TabLoadErrorAlert
          message={showLoadFailure ? EBIRD_BACKUP_LOAD_ERROR : null}
          onGoToSettings={goToSettings}
        />
      </div>
    </div>
  )
}
