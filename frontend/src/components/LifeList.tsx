import { useEffect, useRef, useState } from 'react'
import { Upload, Download, Loader2, AlertCircle, Camera, Mic, Video, ChevronRight, Info, FileCheck } from 'lucide-react'
import { parseLifeList } from '../lib/parseLifeList'
import type { LifeListEntry } from '../lib/parseLifeList'
import { parseMLExport } from '../lib/parseMLExport'
import { LifeListTable } from './LifeListTable'
import type { MediaFilterState, SortState, StoredFileInfo } from '../types'
import { MEDIA_FILTER_CLEAR } from '../types'

const BATCH_SIZE = 10

type Source = 'ml-export' | 'ebird'

type Phase =
  | { tag: 'idle' }
  | { tag: 'loading-saved' }
  | { tag: 'error'; message: string }
  | { tag: 'loading'; entries: LifeListEntry[]; batchCurrent: number; batchTotal: number }
  | { tag: 'ready'; entries: LifeListEntry[]; mediaMap: Record<string, string>; mlError: boolean; source: Source }

function parseMLUserId(filename: string): string | null {
  const match = filename.match(/^ML__.*_([A-Za-z0-9]+)\.csv$/i)
  return match ? match[1] : null
}

function detectFileType(text: string): 'ml-export' | 'ebird' | 'unknown' {
  const firstLine = (text.split(/\r?\n/)[0] ?? '').toLowerCase()
  const hasCatalogNumber = firstLine.includes('catalog number')
  const hasFormat = firstLine.includes('format')
  if (hasCatalogNumber && hasFormat) return 'ml-export'
  if (firstLine.includes('submission id')) return 'ebird'
  return 'unknown'
}

function pillStyle(active: 'none' | 'positive' | 'negative'): React.CSSProperties {
  const base: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 5,
    height: 30,
    padding: '0 12px',
    borderRadius: 6,
    fontSize: 12,
    fontWeight: 500,
    fontFamily: 'inherit',
    cursor: 'pointer',
    whiteSpace: 'nowrap' as const,
  }
  if (active === 'positive') return { ...base, border: '1.5px solid var(--sr-accent-border)', background: 'var(--sr-accent-bg)', color: 'var(--sr-accent)' }
  if (active === 'negative') return { ...base, border: '1.5px solid var(--sr-error-overlay)', background: 'var(--sr-error-bg)', color: 'var(--sr-error)' }
  return { ...base, border: '1.5px solid var(--sr-border)', background: 'var(--sr-surface)', color: 'var(--sr-text-muted)' }
}

function ghostBtn(active = false): React.CSSProperties {
  return {
    height: 28,
    padding: '0 10px',
    borderRadius: 6,
    fontSize: 11,
    fontWeight: 500,
    fontFamily: 'inherit',
    cursor: 'pointer',
    border: active ? '1.5px solid var(--sr-accent-border)' : '1.5px solid var(--sr-border)',
    background: active ? 'var(--sr-accent-bg)' : 'none',
    color: active ? 'var(--sr-accent)' : 'var(--sr-text-muted)',
    whiteSpace: 'nowrap' as const,
  }
}

interface LifeListProps {
  onExpandedChange?: (expanded: boolean) => void
}

export function LifeList({ onExpandedChange }: LifeListProps) {
  const [phase, setPhase] = useState<Phase>({ tag: 'loading-saved' })
  const [filter, setFilter] = useState<MediaFilterState>(MEDIA_FILTER_CLEAR)
  const [sort, setSort] = useState<SortState>({ column: 'name', dir: 'asc', nameSortMode: 'az' })
  const [expanded, setExpanded] = useState(false)
  const [mlUserId, setMlUserId] = useState<string | null>(null)
  const [taxonMap, setTaxonMap] = useState<Record<string, string>>({})
  const [taxonOrders, setTaxonOrders] = useState<Record<string, number>>({})
  const [savedFileInfo, setSavedFileInfo] = useState<StoredFileInfo | null>(null)
  const [draggingOver, setDraggingOver] = useState<'primary' | 'secondary' | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const fetchTaxonCodes = async (entries: LifeListEntry[]) => {
    try {
      const res = await fetch('/taxonomy/codes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          species: entries.map(e => ({ commonName: e.commonName, scientificName: e.scientificName })),
        }),
      })
      if (!res.ok) return
      const data = await res.json()
      setTaxonMap(data.codes ?? {})
      setTaxonOrders(data.orders ?? {})
    } catch {
      // silently fail — links fall back to taxaName, sort falls back to A–Z
    }
  }

  useEffect(() => {
    let cancelled = false
    async function autoLoad() {
      try {
        const statusRes = await fetch('/settings/files')
        if (!statusRes.ok || cancelled) { setPhase({ tag: 'idle' }); return }
        const status = await statusRes.json()
        if (!status.ml) { setPhase({ tag: 'idle' }); return }
        const fileRes = await fetch('/settings/files/ml')
        if (!fileRes.ok || cancelled) { setPhase({ tag: 'idle' }); return }
        const text = await fileRes.text()
        if (cancelled) return
        const fileType = detectFileType(text)
        if (fileType !== 'ml-export') { setPhase({ tag: 'idle' }); return }
        const { entries, mediaMap } = parseMLExport(text)
        if (!cancelled) {
          setMlUserId(parseMLUserId(status.ml.filename))
          setSavedFileInfo(status.ml)
          setPhase({ tag: 'ready', entries, mediaMap, mlError: false, source: 'ml-export' })
          fetchTaxonCodes(entries)
        }
      } catch {
        if (!cancelled) setPhase({ tag: 'idle' })
      }
    }
    autoLoad()
    return () => { cancelled = true }
  }, [])

  const startMediaLookup = async (entries: LifeListEntry[]) => {
    const allIds = [...new Set(entries.flatMap(e => e.catalogIds))]

    if (allIds.length === 0) {
      setPhase({ tag: 'ready', entries, mediaMap: {}, mlError: false, source: 'ebird' })
      return
    }

    const batches: string[][] = []
    for (let i = 0; i < allIds.length; i += BATCH_SIZE) {
      batches.push(allIds.slice(i, i + BATCH_SIZE))
    }

    setPhase({ tag: 'loading', entries, batchCurrent: 1, batchTotal: batches.length })

    const mediaMap: Record<string, string> = {}
    let mlError = false

    for (let i = 0; i < batches.length; i++) {
      if (i > 0) {
        await new Promise(resolve => setTimeout(resolve, 500))
        setPhase(p => p.tag === 'loading' ? { ...p, batchCurrent: i + 1 } : p)
      }
      try {
        const res = await fetch('/ml/media-types', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ catalog_ids: batches[i] }),
        })
        if (!res.ok) { mlError = true; continue }
        const data = await res.json()
        Object.assign(mediaMap, data.media_types)
      } catch {
        mlError = true
        continue
      }
    }

    setPhase({ tag: 'ready', entries, mediaMap, mlError, source: 'ebird' })
    fetchTaxonCodes(entries)
  }

  const processFile = async (file: File) => {
    try {
      const text = await file.text()
      const fileType = detectFileType(text)

      if (fileType === 'ml-export') {
        const { entries, mediaMap } = parseMLExport(text)
        setMlUserId(parseMLUserId(file.name))
        setPhase({ tag: 'ready', entries, mediaMap, mlError: false, source: 'ml-export' })
        fetchTaxonCodes(entries)
      } else if (fileType === 'ebird') {
        const entries = parseLifeList(text)
        await startMediaLookup(entries)
      } else {
        setPhase({
          tag: 'error',
          message: "This doesn't look like a Macaulay Library export or an eBird backup. Check you're uploading the right file.",
        })
      }
    } catch {
      setPhase({
        tag: 'error',
        message: "This doesn't look like a Macaulay Library export or an eBird backup. Check you're uploading the right file.",
      })
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDraggingOver(null)
    const file = e.dataTransfer.files[0]
    if (file) processFile(file)
  }

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) { processFile(file); e.target.value = '' }
  }

  const handleReset = () => {
    setPhase({ tag: 'idle' })
    setFilter(MEDIA_FILTER_CLEAR)
    setSort({ column: 'name', dir: 'asc', nameSortMode: 'az' })
    setExpanded(false)
    setMlUserId(null)
    setTaxonMap({})
    setTaxonOrders({})
    setSavedFileInfo(null)
    onExpandedChange?.(false)
  }

  const handleToggleExpanded = () => {
    setExpanded(prev => {
      const next = !prev
      onExpandedChange?.(next)
      return next
    })
  }

  // ── Auto-loading saved file ───────────────────────────────────────────────
  if (phase.tag === 'loading-saved') {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Loader2 size={24} strokeWidth={2} className="spin" style={{ color: 'var(--sr-accent)' }} />
      </div>
    )
  }

  // ── Upload screen (idle / error) ─────────────────────────────────────────
  if (phase.tag === 'idle' || phase.tag === 'error') {
    const isPrimaryActive = draggingOver === 'primary'
    const isSecondaryActive = draggingOver === 'secondary'

    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12, minHeight: 0 }}>
        {phase.tag === 'error' && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '9px 13px', background: 'var(--sr-error-bg)', borderRadius: 8,
            fontSize: 13, color: 'var(--sr-error)', flexShrink: 0,
          }}>
            <AlertCircle size={14} strokeWidth={2.5} style={{ flexShrink: 0 }} />
            {phase.message}
          </div>
        )}

        {/* Primary drop zone — ML export */}
        <div
          onDragOver={e => { e.preventDefault(); setDraggingOver('primary') }}
          onDragLeave={() => setDraggingOver(null)}
          onDrop={e => handleDrop(e)}
          onClick={() => fileInputRef.current?.click()}
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            border: `2px dashed var(--sr-accent)`,
            borderRadius: 12,
            background: isPrimaryActive ? 'var(--sr-accent-bg)' : 'var(--sr-surface)',
            cursor: 'pointer',
            transition: 'background 0.15s',
            padding: 40,
            position: 'relative',
          }}
          onMouseEnter={e => { if (!isPrimaryActive) (e.currentTarget as HTMLDivElement).style.background = 'var(--sr-accent-bg-hover)' }}
          onMouseLeave={e => { if (!isPrimaryActive) (e.currentTarget as HTMLDivElement).style.background = 'var(--sr-surface)' }}
        >
          {/* Recommended badge */}
          <div style={{
            position: 'absolute', top: 14, right: 14,
            background: 'var(--sr-accent-bg)', color: 'var(--sr-accent)',
            fontSize: 10, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase',
            padding: '3px 8px', borderRadius: 4, border: '1px solid var(--sr-accent-border)',
          }}>
            Recommended
          </div>

          <div style={{
            width: 48, height: 48, borderRadius: 12, background: 'var(--sr-accent-bg)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Download size={22} strokeWidth={1.75} style={{ color: 'var(--sr-accent)' }} />
          </div>

          <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--sr-text)' }}>
            Upload your Macaulay Library export
          </span>
          <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--sr-accent)' }}>
            Instant results — species links and taxonomic sort load in the background
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
            <Info size={12} strokeWidth={2} style={{ color: 'var(--sr-text-disabled)', flexShrink: 0 }} />
            <span style={{ fontSize: 12, color: 'var(--sr-text-muted)' }}>
              Sign in to Macaulay Library → My Media → Save Spreadsheet
            </span>
          </div>
          <span style={{ fontSize: 12, color: 'var(--sr-text-muted)', marginTop: 2 }}>
            Drop file here, or click to browse
          </span>
        </div>

        {/* Divider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          <div style={{ flex: 1, height: 1, background: 'var(--sr-border)' }} />
          <span style={{ fontSize: 11, color: 'var(--sr-text-disabled)', whiteSpace: 'nowrap' }}>
            or use your eBird backup
          </span>
          <div style={{ flex: 1, height: 1, background: 'var(--sr-border)' }} />
        </div>

        {/* Secondary drop zone — eBird CSV */}
        <div
          onDragOver={e => { e.preventDefault(); setDraggingOver('secondary') }}
          onDragLeave={() => setDraggingOver(null)}
          onDrop={e => handleDrop(e)}
          onClick={() => fileInputRef.current?.click()}
          style={{
            display: 'flex', alignItems: 'center', gap: 14,
            padding: '14px 18px',
            border: `1.5px dashed ${isSecondaryActive ? 'var(--sr-text-disabled)' : 'var(--sr-border)'}`,
            borderRadius: 10,
            background: isSecondaryActive ? 'var(--sr-surface-faint)' : 'var(--sr-surface)',
            cursor: 'pointer',
            transition: 'background 0.15s, border-color 0.15s',
            flexShrink: 0,
          }}
          onMouseEnter={e => { if (!isSecondaryActive) (e.currentTarget as HTMLDivElement).style.background = 'var(--sr-surface-faint)' }}
          onMouseLeave={e => { if (!isSecondaryActive) (e.currentTarget as HTMLDivElement).style.background = 'var(--sr-surface)' }}
        >
          <div style={{
            width: 36, height: 36, borderRadius: 8, background: 'var(--sr-surface-subtle)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <Upload size={16} strokeWidth={1.75} style={{ color: 'var(--sr-text-muted)' }} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--sr-text)' }}>MyEBirdData.csv</div>
            <div style={{ fontSize: 11, color: 'var(--sr-text-muted)', marginTop: 2 }}>
              Looks up media coverage online — may take a moment for large lists
            </div>
          </div>
          <ChevronRight size={14} strokeWidth={2} style={{ color: 'var(--sr-gray-400)', flexShrink: 0 }} />
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          style={{ display: 'none' }}
          onChange={handleFileInput}
        />
      </div>
    )
  }

  // ── Loading ───────────────────────────────────────────────────────────────
  if (phase.tag === 'loading') {
    const { entries, batchCurrent, batchTotal } = phase
    const progress = batchTotal > 0 ? batchCurrent / batchTotal : 0
    return (
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 16, minHeight: 0,
      }}>
        <Loader2 size={32} strokeWidth={2} className="spin" style={{ color: 'var(--sr-accent)' }} />
        <span style={{ fontSize: 13, color: 'var(--sr-text-muted)' }}>
          Looking up media… batch {batchCurrent} of {batchTotal}
        </span>
        <div style={{ width: 280, height: 4, background: 'var(--sr-border)', borderRadius: 2 }}>
          <div style={{
            width: `${progress * 100}%`, height: '100%',
            background: 'var(--sr-accent)', borderRadius: 2, transition: 'width 0.3s ease',
          }} />
        </div>
        <span style={{ fontSize: 12, color: 'var(--sr-text-gray)' }}>
          {entries.length} species · checking Macaulay Library
        </span>
      </div>
    )
  }

  // ── Ready ─────────────────────────────────────────────────────────────────
  const { entries, mediaMap, mlError, source } = phase

  const isFilterClear = !filter.photo && !filter.audio && !filter.video

  const filteredCount = entries.filter(entry => {
    const photo = entry.catalogIds.some(id => mediaMap[id] === 'Photo')
    const audio = entry.catalogIds.some(id => mediaMap[id] === 'Audio')
    const video = entry.catalogIds.some(id => mediaMap[id] === 'Video')
    if (filter.photo === 'has' && !photo) return false
    if (filter.photo === 'no' && photo) return false
    if (filter.audio === 'has' && !audio) return false
    if (filter.audio === 'no' && audio) return false
    if (filter.video === 'has' && !video) return false
    if (filter.video === 'no' && video) return false
    return true
  }).length

  const countLabel = isFilterClear
    ? `${entries.length} species`
    : `${filteredCount} of ${entries.length} species`

  function toggleDimension(dim: 'photo' | 'audio' | 'video', val: 'has' | 'no') {
    setFilter(prev => {
      if (prev[dim] === val) return { ...prev, [dim]: null }
      return { ...prev, [dim]: val }
    })
  }

  const pillSep: React.CSSProperties = {
    width: 1, height: 20, background: 'var(--sr-border)', flexShrink: 0, alignSelf: 'center',
  }

  function sortToggleBtn(active: boolean): React.CSSProperties {
    return {
      height: 30,
      padding: '0 13px',
      border: 'none',
      background: active ? 'var(--sr-accent-bg)' : 'transparent',
      color: active ? 'var(--sr-accent)' : 'var(--sr-text-muted)',
      fontSize: 12,
      fontWeight: 500,
      fontFamily: 'inherit',
      cursor: 'pointer',
      whiteSpace: 'nowrap' as const,
    }
  }

  return (
    <div style={{
      flex: expanded ? 'none' : 1,
      minHeight: expanded ? 'auto' : 0,
      display: 'flex', flexDirection: 'column', gap: 0,
    }}>
      {mlError && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '9px 13px', background: 'var(--sr-error-bg)',
          border: '1px solid var(--sr-error-border)', borderRadius: 8,
          fontSize: 13, color: 'var(--sr-error)', marginBottom: 12, flexShrink: 0,
        }}>
          <AlertCircle size={14} strokeWidth={2.5} style={{ flexShrink: 0 }} />
          Couldn't reach the Macaulay Library. Media coverage may be incomplete.
        </div>
      )}

      {source === 'ml-export' && mlUserId === null && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '9px 13px', background: 'var(--sr-warning-bg)',
          border: '1px solid var(--sr-warning-subtle)', borderRadius: 8,
          fontSize: 13, color: 'var(--sr-warning)', marginBottom: 12, flexShrink: 0,
        }}>
          <AlertCircle size={14} strokeWidth={2.5} style={{ flexShrink: 0 }} />
          Media links could not be personalised — the CSV filename was not in the default Macaulay Library format. Links will open the general catalog search instead.
        </div>
      )}

      {/* Controls row */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        gap: 12, marginBottom: 14, flexShrink: 0, flexWrap: 'wrap',
      }}>
        {/* Filter pills */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          <button style={pillStyle(isFilterClear ? 'positive' : 'none')} onClick={() => setFilter(MEDIA_FILTER_CLEAR)}>All</button>

          <div style={pillSep} />

          <button style={pillStyle(filter.photo === 'no' ? 'negative' : 'none')} onClick={() => toggleDimension('photo', 'no')}>
            <Camera size={11} strokeWidth={2.5} />No photo
          </button>
          <button style={pillStyle(filter.audio === 'no' ? 'negative' : 'none')} onClick={() => toggleDimension('audio', 'no')}>
            <Mic size={11} strokeWidth={2.5} />No audio
          </button>
          <button style={pillStyle(filter.video === 'no' ? 'negative' : 'none')} onClick={() => toggleDimension('video', 'no')}>
            <Video size={11} strokeWidth={2.5} />No video
          </button>

          <div style={pillSep} />

          <button style={pillStyle(filter.photo === 'has' ? 'positive' : 'none')} onClick={() => toggleDimension('photo', 'has')}>
            <Camera size={11} strokeWidth={2.5} />Has photo
          </button>
          <button style={pillStyle(filter.audio === 'has' ? 'positive' : 'none')} onClick={() => toggleDimension('audio', 'has')}>
            <Mic size={11} strokeWidth={2.5} />Has audio
          </button>
          <button style={pillStyle(filter.video === 'has' ? 'positive' : 'none')} onClick={() => toggleDimension('video', 'has')}>
            <Video size={11} strokeWidth={2.5} />Has video
          </button>

          <div style={pillSep} />

          {/* A–Z / Taxonomic sort toggle */}
          <div style={{ display: 'inline-flex', border: '1.5px solid var(--sr-accent-border)', borderRadius: 6, overflow: 'hidden', flexShrink: 0 }}>
            <button
              style={{ ...sortToggleBtn(sort.nameSortMode === 'az'), borderRight: '1.5px solid var(--sr-accent-border)' }}
              onClick={() => setSort({ column: 'name', dir: 'asc', nameSortMode: 'az' })}
            >
              A–Z
            </button>
            <button
              style={sortToggleBtn(sort.nameSortMode === 'taxonomic')}
              onClick={() => setSort({ column: 'name', dir: 'asc', nameSortMode: 'taxonomic' })}
            >
              Taxonomic
            </button>
          </div>
        </div>

        {/* Right controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <span style={{ fontSize: 12, color: 'var(--sr-text-muted)' }}>{countLabel}</span>
          {savedFileInfo && (
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              height: 28, padding: '0 10px',
              background: 'var(--sr-accent-bg)', border: '1.5px solid var(--sr-accent-border)',
              borderRadius: 6, flexShrink: 0,
            }}>
              <FileCheck size={12} strokeWidth={2} style={{ color: 'var(--sr-accent)', flexShrink: 0 }} />
              <span style={{
                fontSize: 11, fontWeight: 500, color: 'var(--sr-accent)',
                maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {savedFileInfo.filename}
              </span>
            </div>
          )}
          <button style={ghostBtn(expanded)} onClick={handleToggleExpanded}>
            {expanded ? '↑ Collapse' : '↓ Show all'}
          </button>
          <button style={ghostBtn()} onClick={handleReset}>
            {savedFileInfo ? 'Load different file' : 'Load new file'}
          </button>
        </div>
      </div>

      <LifeListTable
        entries={entries}
        mediaMap={mediaMap}
        filter={filter}
        sort={sort}
        onSortChange={setSort}
        userId={mlUserId}
        taxonMap={taxonMap}
        taxonOrders={taxonOrders}
        expanded={expanded}
      />
    </div>
  )
}
