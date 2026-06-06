import { useState, useCallback, useEffect, Fragment } from 'react'
import { Loader2, AlertCircle, Search, Camera, Mic, Video, MessageSquare, ChevronDown, ChevronRight } from 'lucide-react'
import { transport, TransportError } from '../lib/transport'
import { storage } from '../lib/storage'
import { parseEbirdCSV } from '../lib/parseEbird'
import { normalizeSpeciesName } from '../lib/speciesUtils'
import { extractChecklistId, isValidChecklistId } from '../lib/checklistId'
import {
  compareChecklists, higherCount, formatObsDate,
  type ChecklistData, type ChecklistComparison, type ChecklistRow, type ChecklistMeta, type MediaPresence,
} from '../lib/compareChecklists'
import { resolveApiBreedingCode, TIER_COLORS } from '../lib/breedingCodes'
import { protocolName, submissionLabel, formatDuration, formatDistance, formatObservers } from '../lib/checklistMeta'
import { commentSegments, hasComment } from '../lib/commentText'
import { BirdName } from './BirdName'

type Sort = 'taxonomic' | 'alpha'

// Renders a decoded eBird comment: HTML entities already decoded, http(s) URLs as
// validated links, and \r\n as line breaks. Text is rendered as escaped React
// children — only validated http/https URLs ever become <a> elements.
function CommentText({ raw }: { raw: string }) {
  const segs = commentSegments(raw)
  return (
    <>
      {segs.map((seg, i) =>
        // Belt-and-suspenders: only ever emit an <a> for an http(s) href, even though
        // linkify already guarantees that — so a future change there can't widen it.
        seg.href && /^https?:\/\//i.test(seg.href) ? (
          <a key={i} href={seg.href} target="_blank" rel="noopener noreferrer"
            style={{ color: 'var(--sr-accent)', textDecoration: 'underline', wordBreak: 'break-word' }}>
            {seg.text}
          </a>
        ) : (
          <Fragment key={i}>
            {seg.text.split(/\r\n|\r|\n/).map((line, j) => (
              <Fragment key={j}>{j > 0 && <br />}{line}</Fragment>
            ))}
          </Fragment>
        )
      )}
    </>
  )
}

// A breeding-evidence code, shown as a small pill colored by tier (matching the
// Breeding Codes tab). The raw eBird API code is translated to its display code.
function BreedingBadge({ apiCode }: { apiCode: string | null }) {
  if (!apiCode) return null
  const def = resolveApiBreedingCode(apiCode)
  return (
    <span
      title={`${def.code} — ${def.label}`}
      style={{
        flexShrink: 0, padding: '1px 4px', borderRadius: 4, fontSize: '0.625rem', fontWeight: 700,
        lineHeight: 1.4, fontVariantNumeric: 'tabular-nums', letterSpacing: '0.02em',
        color: 'var(--sr-on-accent)', background: TIER_COLORS[def.tier],
      }}
    >
      {def.code}
    </span>
  )
}

// Small camera / mic / video icons for the media present on a species, with counts
// in the tooltip. Renders nothing when there is no media.
function MediaIcons({ media }: { media: MediaPresence | null }) {
  if (!media) return null
  const items: [string, number, React.ReactNode][] = [
    ['Photo', media.photo, <Camera size={11} strokeWidth={2.5} />],
    ['Audio', media.audio, <Mic size={11} strokeWidth={2.5} />],
    ['Video', media.video, <Video size={11} strokeWidth={2.5} />],
  ]
  const present = items.filter(([, n]) => n > 0)
  if (!present.length) return null
  return (
    <span style={{ flexShrink: 0, display: 'inline-flex', gap: 3, alignItems: 'center', color: 'var(--sr-text-muted)' }}>
      {present.map(([label, n, icon]) => (
        <span key={label} title={`${n} ${label.toLowerCase()}${n > 1 ? 's' : ''}`} aria-label={`${n} ${label}`} style={{ display: 'inline-flex' }}>
          {icon}
        </span>
      ))}
    </span>
  )
}

// One checklist's data for a species: an optional comment toggle, breeding badge,
// media icons, then the count. The comment toggle sits HERE (on the A/B side) so it's
// clear which checklist the note belongs to. Fixed width so counts line up; count
// emphasized when it's higher.
function SideCell({ count, emphasized, breeding, media, hasComment, open, onToggle }: {
  count: string | null; emphasized: boolean; breeding: string | null; media: MediaPresence | null
  hasComment?: boolean; open?: boolean; onToggle?: () => void
}) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'flex-end', gap: 5, width: 132, flexShrink: 0, fontSize: '0.75rem' }}>
      {hasComment && onToggle && (
        <button tabIndex={0} onClick={onToggle} aria-expanded={open}
          aria-label={open ? 'Hide comment' : 'Show comment'} title={open ? 'Hide comment' : 'Show comment'}
          style={{
            flexShrink: 0, display: 'inline-flex', alignItems: 'center', border: 'none',
            background: 'transparent', cursor: 'pointer', padding: 0,
            color: open ? 'var(--sr-accent)' : 'var(--sr-text-muted)',
          }}>
          <MessageSquare size={12} strokeWidth={2.25} />
        </button>
      )}
      <BreedingBadge apiCode={breeding} />
      <MediaIcons media={media} />
      <span style={{ width: 34, textAlign: 'right' }}><Count value={count} emphasized={emphasized} /></span>
    </span>
  )
}

function sortRows(rows: ChecklistRow[], sort: Sort): ChecklistRow[] {
  if (sort === 'taxonomic') return rows // eBird returns obs in taxonomic order
  return [...rows].sort((a, b) => a.commonName.localeCompare(b.commonName))
}

// A single count value; the higher of the two on a shared species is emphasized.
function Count({ value, emphasized }: { value: string | null; emphasized: boolean }) {
  if (value === null) return <span style={{ color: 'var(--sr-text-disabled)' }}>—</span>
  return (
    <span style={{
      fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap',
      fontWeight: emphasized ? 700 : 500,
      color: emphasized ? 'var(--sr-accent)' : 'var(--sr-text-muted)',
    }}>
      {emphasized && <span aria-hidden="true">▲ </span>}{value}
    </span>
  )
}

// One species comment, optionally prefixed with an A/B side label.
function CommentLine({ label, text }: { label?: string; text: string }) {
  return (
    <div style={{ display: 'flex', gap: 6, fontSize: '0.75rem', color: 'var(--sr-text-muted)', lineHeight: 1.5, minWidth: 0 }}>
      {label && <span style={{ flexShrink: 0, fontWeight: 700, color: 'var(--sr-accent)' }}>{label}</span>}
      <span style={{ minWidth: 0, wordBreak: 'break-word' }}><CommentText raw={text} /></span>
    </div>
  )
}

// A species row: name (+ Species Detail link when recorded), then one side cell
// (A-only / B-only panels) or two (In Both). The comment toggle lives in each side
// cell, so a 💬 on the A cell means A has a note, on B means B does (or both).
// Expanding reveals the comment(s), labeled A/B in the In Both panel.
function SpeciesRow({ row, mode, hasEntry, onOpenSpecies }: {
  row: ChecklistRow; mode: 'both' | 'a' | 'b'; hasEntry: boolean; onOpenSpecies?: (n: string) => void
}) {
  const [open, setOpen] = useState(false)
  const cA = hasComment(row.commentsA)
  const cB = hasComment(row.commentsB)
  const hasAny = mode === 'both' ? (cA || cB) : mode === 'a' ? cA : cB
  const hi = mode === 'both' ? higherCount(row.countA, row.countB) : null
  const toggle = () => setOpen(o => !o)
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '4px 14px', minWidth: 0 }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', minWidth: 0 }}>
          <BirdName commonName={row.commonName} taxonCode={row.speciesCode} hasEntry={hasEntry} onOpenSpecies={onOpenSpecies} size="sm" />
        </span>
        <span style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
          {mode !== 'b' && <SideCell count={row.countA} emphasized={hi === 'a'} breeding={row.breedingA} media={row.mediaA} hasComment={cA} open={open} onToggle={toggle} />}
          {(mode === 'both' || mode === 'b') && <SideCell count={row.countB} emphasized={hi === 'b'} breeding={row.breedingB} media={row.mediaB} hasComment={cB} open={open} onToggle={toggle} />}
        </span>
      </div>
      {open && hasAny && (
        <div style={{ padding: '0 14px 8px 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {mode !== 'b' && cA && <CommentLine label={mode === 'both' ? 'A' : undefined} text={row.commentsA} />}
          {(mode === 'both' || mode === 'b') && cB && <CommentLine label={mode === 'both' ? 'B' : undefined} text={row.commentsB} />}
        </div>
      )}
    </div>
  )
}

export function ChecklistComparer({ onOpenSpecies }: { onOpenSpecies?: (commonName: string) => void }) {
  const [inputA, setInputA] = useState('')
  const [inputB, setInputB] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ChecklistComparison | null>(null)
  const [idA, setIdA] = useState('')
  const [idB, setIdB] = useState('')
  const [sort, setSort] = useState<Sort>('taxonomic')
  // The user's recorded species (normalized common names) from their eBird backup.
  // A checklist species links to Species Detail only if it's in this backbone, since
  // Species Detail can only open species the user has actually recorded.
  const [backbone, setBackbone] = useState<Set<string>>(new Set())

  useEffect(() => {
    let cancelled = false
    storage.readFile('ebird')
      .then(text => {
        if (cancelled || !text) return
        try {
          setBackbone(parseEbirdCSV('My List', text).species)
        } catch {
          // No usable backup — names stay unlinked (Species Detail has no data anyway).
        }
      })
      .catch(() => { /* no backup stored — fine */ })
    return () => { cancelled = true }
  }, [])

  const isRecorded = useCallback(
    (commonName: string) => backbone.has(normalizeSpeciesName(commonName)),
    [backbone],
  )

  const handleCompare = useCallback(async () => {
    const a = extractChecklistId(inputA)
    const b = extractChecklistId(inputB)
    if (!isValidChecklistId(a) || !isValidChecklistId(b)) {
      setError('Enter two valid eBird checklist IDs or URLs (e.g. S12345678).')
      return
    }
    if (a === b) {
      setError("Those are the same checklist — enter two different ones.")
      return
    }
    setLoading(true)
    setError(null)
    try {
      const [dataA, dataB] = await Promise.all([
        transport.get<ChecklistData>(`/checklists/${encodeURIComponent(a)}`),
        transport.get<ChecklistData>(`/checklists/${encodeURIComponent(b)}`),
      ])
      // Some checklists (incomplete, or with hidden/sensitive species) come back with
      // no observation detail. A comparison of an empty list would be meaningless.
      const empty = [dataA.species.length === 0 ? a : '', dataB.species.length === 0 ? b : ''].filter(Boolean)
      if (empty.length) {
        setError(`No species available for ${empty.join(' and ')}. The checklist may be incomplete, or its observations aren't shared.`)
        return
      }
      setResult(compareChecklists(dataA, dataB))
      setIdA(a)
      setIdB(b)
    } catch (err) {
      const detail = err instanceof TransportError
        ? (err.detail ?? err.message)
        : (err instanceof Error ? err.message : undefined)
      setError(detail ?? 'Could not fetch the checklists. Check the IDs and your eBird API key in Settings.')
    } finally {
      setLoading(false)
    }
  }, [inputA, inputB])

  function handleReset() {
    setResult(null)
    setError(null)
  }

  // ── Results ───────────────────────────────────────────────────────────────
  if (result) {
    const both = sortRows(result.both, sort)
    const aOnly = sortRows(result.aOnly, sort)
    const bOnly = sortRows(result.bOnly, sort)

    return (
      <div style={{ width: '100%', maxWidth: 880, display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0, flex: '1 1 320px' }}>
            <ChecklistTag badge="A" id={idA} meta={result.metaA} />
            <ChecklistTag badge="B" id={idB} meta={result.metaB} />
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
            <div style={{ display: 'flex', borderRadius: 6, overflow: 'hidden', border: '1.5px solid var(--sr-accent-border)' }}>
              {(['taxonomic', 'alpha'] as Sort[]).map((s, i) => (
                <button tabIndex={0} key={s} onClick={() => setSort(s)}
                  style={{
                    height: 34, padding: '0 12px', fontSize: '0.8125rem', fontWeight: 500, fontFamily: 'inherit',
                    cursor: 'pointer', border: 'none', borderLeft: i > 0 ? '1.5px solid var(--sr-accent-border)' : 'none',
                    background: sort === s ? 'var(--sr-accent-bg)' : 'transparent',
                    color: sort === s ? 'var(--sr-accent)' : 'var(--sr-text-muted)', whiteSpace: 'nowrap',
                  }}>
                  {s === 'taxonomic' ? 'Taxonomic' : 'A–Z'}
                </button>
              ))}
            </div>
            <button tabIndex={0} onClick={handleReset}
              style={{
                height: 34, padding: '0 14px', background: 'transparent', color: 'var(--sr-accent)',
                border: '1.5px solid var(--sr-accent-border)', borderRadius: 6, fontSize: '0.8125rem',
                fontWeight: 500, fontFamily: 'inherit', cursor: 'pointer', whiteSpace: 'nowrap',
              }}>
              ← New comparison
            </button>
          </div>
        </div>

        {/* Stats bar */}
        <div role="region" aria-label="Comparison summary" style={{
          display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', border: '1px solid var(--sr-border)',
          borderRadius: 10, overflow: 'hidden', marginBottom: 20,
        }}>
          <Stat value={result.totalA} label="Checklist A" />
          <Stat value={result.totalB} label="Checklist B" />
          <Stat value={result.both.length} label="In both" highlight />
          <Stat value={result.aOnly.length} label="A only" />
          <Stat value={result.bOnly.length} label="B only" isLast />
        </div>

        {/* In Both — full width, with A and B side by side (breeding code, media, count). */}
        <div style={{ marginBottom: 12 }}>
          <Panel
            title="In Both"
            count={both.length}
            headerExtra={
              <span style={{ display: 'flex', gap: 8 }}>
                <SideHeader label="A" />
                <SideHeader label="B" />
              </span>
            }
          >
            {both.map(row => (
              <SpeciesRow key={row.speciesCode} row={row} mode="both" hasEntry={isRecorded(row.commonName)} onOpenSpecies={onOpenSpecies} />
            ))}
          </Panel>
        </div>

        {/* Unique to each — two columns below. */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, alignItems: 'start' }}>
          <Panel title="Checklist A only" count={aOnly.length}>
            {aOnly.map(row => (
              <SpeciesRow key={row.speciesCode} row={row} mode="a" hasEntry={isRecorded(row.commonName)} onOpenSpecies={onOpenSpecies} />
            ))}
          </Panel>
          <Panel title="Checklist B only" count={bOnly.length}>
            {bOnly.map(row => (
              <SpeciesRow key={row.speciesCode} row={row} mode="b" hasEntry={isRecorded(row.commonName)} onOpenSpecies={onOpenSpecies} />
            ))}
          </Panel>
        </div>

        {/* All comments, side by side for easy comparison. */}
        <CommentsTable result={result} both={both} aOnly={aOnly} bOnly={bOnly} idA={idA} idB={idB} isRecorded={isRecorded} onOpenSpecies={onOpenSpecies} />
      </div>
    )
  }

  // ── Input form ──────────────────────────────────────────────────────────────
  return (
    <div style={{ width: '100%', maxWidth: 600 }}>
      <h1 style={{ fontSize: '1.375rem', fontWeight: 600, letterSpacing: '-0.4px', marginBottom: 6, color: 'var(--sr-text)' }}>
        Compare two eBird checklists
      </h1>
      <p style={{ fontSize: '0.875rem', color: 'var(--sr-text-muted)', lineHeight: 1.55, marginBottom: 24 }}>
        Paste two checklist IDs or URLs to see which birds were on each, on both, and the counts, breeding codes, and media side by side. Requires your eBird API key in Settings.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
        {([['A', inputA, setInputA], ['B', inputB, setInputB]] as const).map(([label, value, setter]) => (
          <div key={label}>
            <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 500, marginBottom: 6 }}>
              Checklist {label}
            </label>
            <input
              type="text"
              value={value}
              onChange={e => setter(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCompare()}
              placeholder="S12345678 or https://ebird.org/checklist/S12345678"
              autoComplete="off"
              spellCheck={false}
              style={{
                width: '100%', height: 44, padding: '0 14px', boxSizing: 'border-box',
                border: '1.5px solid var(--sr-border)', borderRadius: 8, fontSize: '0.875rem',
                fontFamily: 'inherit', color: 'inherit', background: 'var(--sr-surface)',
              }}
            />
          </div>
        ))}
      </div>

      {error && (
        <div role="alert" style={{
          display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, padding: '9px 13px',
          background: 'var(--sr-error-bg)', borderRadius: 6, fontSize: '0.8125rem', color: 'var(--sr-error)',
        }}>
          <AlertCircle size={14} strokeWidth={2.5} style={{ flexShrink: 0 }} />
          {error}
        </div>
      )}

      <button tabIndex={0}
        onClick={handleCompare}
        disabled={loading}
        style={{
          width: '100%', height: 48, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          background: 'var(--sr-accent)', color: 'var(--sr-on-accent)', border: 'none', borderRadius: 8,
          fontSize: '0.875rem', fontWeight: 500, fontFamily: 'inherit',
          cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.65 : 1,
        }}>
        {loading ? <Loader2 size={16} className="spin" /> : <Search size={16} strokeWidth={2.5} />}
        {loading ? 'Fetching checklists…' : 'Compare checklists'}
      </button>
    </div>
  )
}

// Identifier card for one checklist: an A/B badge, location, date, ID, an effort
// metadata strip (type · distance · duration · observers · app), and a collapsible
// "Notes" disclosure for the checklist-level comment — so the two checklists are
// easy to tell apart and their details are at hand.
function ChecklistTag({ badge, id, meta }: { badge: 'A' | 'B'; id: string; meta: ChecklistMeta }) {
  const [notesOpen, setNotesOpen] = useState(false)
  const date = formatObsDate(meta.obsDt)
  const metaBits = [
    protocolName(meta.protocolId),
    formatDistance(meta.distanceKm, meta.distanceUnit),
    formatDuration(meta.durationHrs),
    formatObservers(meta.numObservers),
    submissionLabel(meta.submissionMethod, meta.submissionVersion),
  ].filter(Boolean)
  const noteShown = hasComment(meta.comments)
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 9, minWidth: 0 }}>
      <span aria-hidden="true" style={{
        flexShrink: 0, width: 22, height: 22, borderRadius: 6, marginTop: 2,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        background: 'var(--sr-accent-bg)', color: 'var(--sr-accent)',
        fontSize: '0.75rem', fontWeight: 700,
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
          <a href={`https://ebird.org/checklist/${id}`} target="_blank" rel="noreferrer"
            title="View this checklist on eBird"
            style={{ color: 'var(--sr-accent)', textDecoration: 'underline' }}>
            {id}
          </a>
        </span>
        {metaBits.length > 0 && (
          <span style={{ fontSize: '0.6875rem', color: 'var(--sr-text-muted)' }}>{metaBits.join('  ·  ')}</span>
        )}
        {noteShown && (
          <>
            <button tabIndex={0} onClick={() => setNotesOpen(o => !o)} aria-expanded={notesOpen}
              style={{
                marginTop: 3, alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: 3,
                border: 'none', background: 'transparent', cursor: 'pointer', padding: 0,
                fontSize: '0.6875rem', fontWeight: 600, fontFamily: 'inherit', color: 'var(--sr-accent)',
              }}>
              {notesOpen ? <ChevronDown size={11} strokeWidth={2.5} /> : <ChevronRight size={11} strokeWidth={2.5} />}
              Notes
            </button>
            {notesOpen && (
              <div style={{
                marginTop: 4, padding: '8px 10px', borderRadius: 6, background: 'var(--sr-bg)',
                border: '1px solid var(--sr-border-subtle)', fontSize: '0.75rem',
                color: 'var(--sr-text-muted)', lineHeight: 1.5, maxWidth: 460, wordBreak: 'break-word',
              }}>
                <CommentText raw={meta.comments} />
              </div>
            )}
          </>
        )}
      </span>
    </div>
  )
}

function Stat({ value, label, highlight = false, isLast = false }: {
  value: number; label: string; highlight?: boolean; isLast?: boolean
}) {
  return (
    <div style={{
      background: 'var(--sr-surface)', padding: '16px 18px',
      borderRight: isLast ? 'none' : '1px solid var(--sr-border)',
      display: 'flex', flexDirection: 'column', gap: 5, minWidth: 0,
    }}>
      <span style={{ fontSize: '1.625rem', fontWeight: 600, letterSpacing: '-0.5px', lineHeight: 1, color: highlight ? 'var(--sr-accent)' : 'var(--sr-text)' }}>
        {value}
      </span>
      <span style={{ fontSize: '0.625rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--sr-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {label}
      </span>
    </div>
  )
}

function Panel({ title, count, headerExtra, children }: {
  title: string; count: number; headerExtra?: React.ReactNode; children: React.ReactNode
}) {
  return (
    <div style={{ border: '1px solid var(--sr-border)', borderRadius: 10, background: 'var(--sr-surface)', overflow: 'hidden', minWidth: 0 }}>
      <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--sr-border-subtle)', display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
        <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--sr-text)' }}>{title}</span>
        {headerExtra ?? <span style={{ fontSize: '0.75rem', color: 'var(--sr-text-muted)' }}>{count}</span>}
      </div>
      <div style={{ padding: '4px 0' }}>
        {count === 0
          ? <div style={{ padding: '10px 14px', fontSize: '0.75rem', color: 'var(--sr-text-muted)' }}>None</div>
          : children}
      </div>
    </div>
  )
}

// Column label over a SideCell (the "A" / "B" headers in the In Both panel).
function SideHeader({ label }: { label: string }) {
  return (
    <span style={{ width: 132, textAlign: 'right', fontSize: '0.625rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--sr-text-muted)' }}>
      {label}
    </span>
  )
}

// Every species (and the two checklist-level notes) that carries a comment, shown in
// one table with A and B side by side for direct comparison. Renders nothing when
// there are no comments anywhere.
function CommentsTable({ result, both, aOnly, bOnly, idA, idB, isRecorded, onOpenSpecies }: {
  result: ChecklistComparison
  both: ChecklistRow[]; aOnly: ChecklistRow[]; bOnly: ChecklistRow[]
  idA: string; idB: string
  isRecorded: (n: string) => boolean
  onOpenSpecies?: (n: string) => void
}) {
  const speciesRows = [
    ...both.filter(r => hasComment(r.commentsA) || hasComment(r.commentsB)),
    ...aOnly.filter(r => hasComment(r.commentsA)),
    ...bOnly.filter(r => hasComment(r.commentsB)),
  ]
  const hasChecklistNote = hasComment(result.metaA.comments) || hasComment(result.metaB.comments)
  if (speciesRows.length === 0 && !hasChecklistNote) return null

  const COLS = 'minmax(120px, 1.2fr) 2fr 2fr'
  // Distinguish an empty cell: the bird was on that checklist but had no note
  // ("no comment") vs. it wasn't on that checklist at all ("not reported").
  const empty = (label: string) => (
    <span style={{ color: 'var(--sr-text-disabled)', fontStyle: 'italic' }}>{label}</span>
  )
  const cell = (text: string, present: boolean) => hasComment(text)
    ? <CommentText raw={text} />
    : present ? empty('no comment') : empty('not reported')
  const cellStyle = (i: number): React.CSSProperties => ({
    padding: '8px 12px', fontSize: '0.75rem', color: 'var(--sr-text-muted)', lineHeight: 1.5,
    minWidth: 0, wordBreak: 'break-word',
    borderLeft: i > 0 ? '1px solid var(--sr-border-subtle)' : 'none',
  })

  return (
    <div style={{ marginTop: 20, border: '1px solid var(--sr-border)', borderRadius: 10, background: 'var(--sr-surface)', overflow: 'hidden' }}>
      <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--sr-border-subtle)' }}>
        <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--sr-text)' }}>Comments</span>
        <span style={{ fontSize: '0.75rem', color: 'var(--sr-text-muted)', marginLeft: 8 }}>
          ({speciesRows.length + (hasChecklistNote ? 1 : 0)})
        </span>
      </div>
      {/* Header */}
      <div style={{ display: 'grid', gridTemplateColumns: COLS }}>
        {['Species', `A · ${idA}`, `B · ${idB}`].map((h, i) => (
          <span key={h} style={{
            ...cellStyle(i), padding: '8px 12px', fontSize: '0.625rem', fontWeight: 700,
            textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--sr-text-muted)',
            background: 'var(--sr-bg)',
          }}>{h}</span>
        ))}
      </div>
      {hasChecklistNote && (
        <div style={{ display: 'grid', gridTemplateColumns: COLS, borderTop: '1px solid var(--sr-border-subtle)' }}>
          <span style={{ ...cellStyle(0), fontWeight: 600, color: 'var(--sr-text)' }}>📋 Checklist note</span>
          {/* both checklists always "present" for their own checklist-level note */}
          <span style={cellStyle(1)}>{cell(result.metaA.comments, true)}</span>
          <span style={cellStyle(2)}>{cell(result.metaB.comments, true)}</span>
        </div>
      )}
      {speciesRows.map(r => (
        <div key={r.speciesCode} style={{ display: 'grid', gridTemplateColumns: COLS, borderTop: '1px solid var(--sr-border-subtle)' }}>
          <span style={{ ...cellStyle(0), color: 'var(--sr-text)' }}>
            <BirdName commonName={r.commonName} taxonCode={r.speciesCode} hasEntry={isRecorded(r.commonName)} onOpenSpecies={onOpenSpecies} size="sm" />
          </span>
          <span style={cellStyle(1)}>{cell(r.commentsA, r.countA !== null)}</span>
          <span style={cellStyle(2)}>{cell(r.commentsB, r.countB !== null)}</span>
        </div>
      ))}
    </div>
  )
}
