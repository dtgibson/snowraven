// The county popup's Completeness content (design.html Variants A + B) —
// rendered by CountyLayer in place of the metric-contextual top-3 while the
// Completeness metric is active (FR-26). Presentational: everything arrives via
// the CountyCompletenessResult; the single side effect is the explicit
// "Load completeness" / "Try again" fetch callback.
//
// All content is escaped JSX (NFR-09 — species/county names are React children,
// never HTML strings); every color is a --sr-* token; the progress bar exposes
// role="progressbar" + aria-value* alongside the equivalent text (NFR-04).

import { AlertTriangle, Clock, KeyRound, Loader2, RefreshCw, WifiOff } from 'lucide-react'
import { BirdName } from '../BirdName'
import { cacheLineText, monthDay, type CountyCompletenessResult } from '../../lib/countyCompleteness'

// Session-stable "now" for the cache-line day math (never Date.now() in render).
const SESSION_NOW_MS = Date.now()

const BLOCK = { marginTop: 10, paddingTop: 9, borderTop: '1px solid var(--sr-border)' } as const
const TITLE = { fontSize: '0.625rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--sr-text-muted)', marginBottom: 2 } as const
const CAPTION = { fontSize: '0.625rem', color: 'var(--sr-text-muted)', marginBottom: 6, lineHeight: 1.4 } as const
const RANK = { flex: 'none', width: 11, fontSize: '0.625rem', fontWeight: 700, color: 'var(--sr-text-disabled)', fontVariantNumeric: 'tabular-nums' } as const
const LI = { display: 'flex', alignItems: 'baseline', gap: 7, marginBottom: 4 } as const
const DATE = { flex: 'none', fontSize: '0.6875rem', color: 'var(--sr-text-muted)', fontVariantNumeric: 'tabular-nums' } as const

function StatusIcon({ status }: { status: 'offline' | 'no-key' | 'error' }) {
  const style = { flexShrink: 0, marginTop: 1 } as const
  if (status === 'offline') return <WifiOff size={13} strokeWidth={2.2} style={style} aria-hidden="true" />
  if (status === 'no-key') return <KeyRound size={13} strokeWidth={2.2} style={style} aria-hidden="true" />
  return <AlertTriangle size={13} strokeWidth={2.2} style={style} aria-hidden="true" />
}

function LoadButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      tabIndex={0}
      onClick={onClick}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 7,
        background: 'var(--sr-accent)', color: 'var(--sr-on-accent)',
        border: 'none', borderRadius: 6, padding: '8px 14px',
        font: 'inherit', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer',
      }}
    >
      <RefreshCw size={13} strokeWidth={2.2} aria-hidden="true" />
      {label}
    </button>
  )
}

interface Props {
  countyName: string
  result: CountyCompletenessResult
  /** Explicit fetch: the un-birded "Load completeness" button and error retry. */
  onLoad: () => void
  onOpenSpecies?: (commonName: string) => void
  hasEntryFor?: (name: string) => boolean
  /** Taxon code for a LOCAL (backup) species name — recent-new favicons. */
  codeFor?: (commonName: string) => string | undefined
}

export function CountyCompletenessPopup({ countyName, result, onLoad, onOpenSpecies, hasEntryFor, codeFor }: Props) {
  const { x, y, percent, band, status, message, recentNew, targets, fetchedAt } = result
  const birded = x > 0

  // The Y/percent/targets half of the block, by status (FR-24 — never blank).
  let ebirdHalf: React.ReactNode
  if (status === 'ready' && y != null && percent != null) {
    ebirdHalf = (
      <>
        <div
          role="progressbar"
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`County list ${percent} percent complete`}
          style={{ height: 8, borderRadius: 4, background: 'var(--sr-surface-subtle)', border: '1px solid var(--sr-border)', overflow: 'hidden', margin: '6px 0 7px' }}
        >
          <div style={{ height: '100%', width: `${percent}%`, borderRadius: 3, background: `var(--sr-county-${Math.max(band, 1)})` }} />
        </div>
        <div style={{ fontSize: '0.8125rem', color: 'var(--sr-text)' }}>
          <b style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{x.toLocaleString()}</b> of{' '}
          <b style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{y.toLocaleString()}</b> species ·{' '}
          <b style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{percent}%</b>
        </div>
        <div style={{ ...CAPTION, marginTop: 3, marginBottom: 0 }}>
          {birded
            ? "Countable species — spuhs, slashes & hybrids don't count."
            : '0% — the county stays a plain outline on the map.'}
        </div>
      </>
    )
  } else if (status === 'loading') {
    ebirdHalf = (
      <div role="status" style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.75rem', color: 'var(--sr-text-muted)', padding: '6px 0' }}>
        <Loader2 size={14} className="spin" aria-hidden="true" />
        Checking eBird for {countyName}…
      </div>
    )
  } else if (status === 'empty') {
    ebirdHalf = (
      <div style={{ fontSize: '0.6875rem', color: 'var(--sr-text-muted)', lineHeight: 1.45, padding: '2px 0' }}>
        No species have been reported to eBird for this county yet — so there's no percentage to show.
      </div>
    )
  } else if (status === 'no-region') {
    ebirdHalf = (
      <div style={{ fontSize: '0.6875rem', color: 'var(--sr-text-muted)', lineHeight: 1.45, padding: '2px 0' }}>
        eBird data isn't available for this county.
      </div>
    )
  } else if (status === 'offline' || status === 'no-key' || status === 'error') {
    ebirdHalf = (
      <div role={status === 'error' ? 'alert' : 'status'} style={{ padding: '2px 0' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, fontSize: '0.6875rem', color: 'var(--sr-text-muted)', lineHeight: 1.45 }}>
          <StatusIcon status={status} />
          <span>{message ?? 'eBird data is unavailable right now.'}</span>
        </div>
        {birded && (
          <div style={{ ...CAPTION, marginTop: 5, marginBottom: 0 }}>
            You've recorded {x.toLocaleString()} countable species here — spuhs, slashes & hybrids don't count.
          </div>
        )}
        {status === 'error' && (
          <div style={{ marginTop: 8 }}>
            <LoadButton label="Try again" onClick={onLoad} />
          </div>
        )}
      </div>
    )
  } else {
    // 'unfetched' — idle. Un-birded: the design's click-to-fetch variant (B).
    // Birded: a brief pre-auto-fetch frame (popup open triggers the fetch) with
    // the same explicit button as a fallback.
    ebirdHalf = (
      <div style={{ padding: '2px 0' }}>
        <div style={{ fontSize: '0.75rem', color: 'var(--sr-text-muted)', lineHeight: 1.5, marginBottom: 10 }}>
          {birded
            ? 'Completeness hasn’t been fetched for this county yet.'
            : `You haven’t birded ${countyName} yet — it stays a plain outline.`}
        </div>
        <LoadButton label="Load completeness" onClick={onLoad} />
        <div style={{ ...CAPTION, margin: '8px 0 0' }}>
          One eBird request, for this county only · cached 30 days.
        </div>
      </div>
    )
  }

  return (
    <>
      <div style={BLOCK}>
        <div style={TITLE}>Completeness</div>
        {ebirdHalf}
      </div>

      {recentNew.length > 0 && (
        <div style={BLOCK}>
          <div style={TITLE}>Recently added</div>
          <div style={CAPTION}>Your newest county species — from your backup, works offline.</div>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {recentNew.map(r => (
              <li key={r.commonName} style={LI}>
                <span style={{ flex: 1, minWidth: 0, fontSize: '0.75rem' }}>
                  <BirdName
                    commonName={r.commonName}
                    scientificName={r.scientificName}
                    taxonCode={codeFor?.(r.commonName)}
                    hasEntry
                    onOpenSpecies={onOpenSpecies}
                    size="sm"
                  />
                </span>
                <span style={DATE} title={r.firstDate}>{monthDay(r.firstDate)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {targets && targets.length > 0 && (
        <div style={BLOCK}>
          <div style={TITLE}>Top targets</div>
          <div style={CAPTION}>On eBird's county list, not yet on yours · taxonomic order.</div>
          <ol style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {targets.map((t, i) => (
              <li key={t.speciesCode} style={LI}>
                <span style={RANK}>{i + 1}</span>
                <span style={{ flex: 1, minWidth: 0, fontSize: '0.75rem' }}>
                  <BirdName
                    commonName={t.commonName}
                    taxonCode={t.speciesCode}
                    hasEntry={hasEntryFor ? hasEntryFor(t.commonName) : false}
                    onOpenSpecies={onOpenSpecies}
                    size="sm"
                  />
                </span>
              </li>
            ))}
          </ol>
          <div style={{ ...CAPTION, margin: '6px 0 0' }}>
            Green names are on your life list — they open Species Detail. Others render plain.
          </div>
        </div>
      )}

      {fetchedAt != null && (status === 'ready' || status === 'empty') && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 9, fontSize: '0.625rem', color: 'var(--sr-text-muted)' }}>
          <Clock size={11} strokeWidth={2.2} aria-hidden="true" style={{ flexShrink: 0 }} />
          {cacheLineText(fetchedAt, SESSION_NOW_MS)}
        </div>
      )}
    </>
  )
}
