import { useRef, useState } from 'react'
import { Upload, Download, Loader2, AlertCircle, Camera, Mic, Video, ChevronRight, Info } from 'lucide-react'
import { parseLifeList } from '../lib/parseLifeList'
import type { LifeListEntry } from '../lib/parseLifeList'
import { parseMLExport } from '../lib/parseMLExport'
import { LifeListTable } from './LifeListTable'
import type { MediaFilterState, SortState } from '../types'
import { MEDIA_FILTER_CLEAR } from '../types'

const BATCH_SIZE = 10

type Source = 'ml-export' | 'ebird'

type Phase =
  | { tag: 'idle' }
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
  if (active === 'positive') return { ...base, border: '1.5px solid rgba(45,134,83,0.25)', background: '#E8F5EE', color: '#2D8653' }
  if (active === 'negative') return { ...base, border: '1.5px solid rgba(239,68,68,0.3)', background: '#FEF2F2', color: '#DC2626' }
  return { ...base, border: '1.5px solid #E4E4E7', background: '#fff', color: '#71717A' }
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
    border: active ? '1.5px solid rgba(45,134,83,0.25)' : '1.5px solid #E4E4E7',
    background: active ? '#E8F5EE' : 'none',
    color: active ? '#2D8653' : '#71717A',
    whiteSpace: 'nowrap' as const,
  }
}

interface LifeListProps {
  onExpandedChange?: (expanded: boolean) => void
}

export function LifeList({ onExpandedChange }: LifeListProps) {
  const [phase, setPhase] = useState<Phase>({ tag: 'idle' })
  const [filter, setFilter] = useState<MediaFilterState>(MEDIA_FILTER_CLEAR)
  const [sort, setSort] = useState<SortState>({ column: 'name', dir: 'asc' })
  const [expanded, setExpanded] = useState(false)
  const [mlUserId, setMlUserId] = useState<string | null>(null)
  const [taxonMap, setTaxonMap] = useState<Record<string, string>>({})
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
    } catch {
      // silently fail — links will use taxaName fallback
    }
  }

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
    setSort({ column: 'name', dir: 'asc' })
    setExpanded(false)
    setMlUserId(null)
    setTaxonMap({})
    onExpandedChange?.(false)
  }

  const handleToggleExpanded = () => {
    setExpanded(prev => {
      const next = !prev
      onExpandedChange?.(next)
      return next
    })
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
            padding: '9px 13px', background: '#FEF2F2', borderRadius: 8,
            fontSize: 13, color: '#DC2626', flexShrink: 0,
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
            border: `2px dashed ${isPrimaryActive ? '#2D8653' : '#2D8653'}`,
            borderRadius: 12,
            background: isPrimaryActive ? '#E8F5EE' : '#fff',
            cursor: 'pointer',
            transition: 'background 0.15s',
            padding: 40,
            position: 'relative',
          }}
          onMouseEnter={e => { if (!isPrimaryActive) (e.currentTarget as HTMLDivElement).style.background = '#F0FAF4' }}
          onMouseLeave={e => { if (!isPrimaryActive) (e.currentTarget as HTMLDivElement).style.background = '#fff' }}
        >
          {/* Recommended badge */}
          <div style={{
            position: 'absolute', top: 14, right: 14,
            background: '#E8F5EE', color: '#2D8653',
            fontSize: 10, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase',
            padding: '3px 8px', borderRadius: 4, border: '1px solid rgba(45,134,83,0.2)',
          }}>
            Recommended
          </div>

          <div style={{
            width: 48, height: 48, borderRadius: 12, background: '#E8F5EE',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Download size={22} strokeWidth={1.75} style={{ color: '#2D8653' }} />
          </div>

          <span style={{ fontSize: 15, fontWeight: 600, color: '#0F1117' }}>
            Upload your Macaulay Library export
          </span>
          <span style={{ fontSize: 12, fontWeight: 500, color: '#2D8653' }}>
            Instant results — no network lookups
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
            <Info size={12} strokeWidth={2} style={{ color: '#A1A1AA', flexShrink: 0 }} />
            <span style={{ fontSize: 12, color: '#71717A' }}>
              Sign in to Macaulay Library → My Media → Save Spreadsheet
            </span>
          </div>
          <span style={{ fontSize: 12, color: '#71717A', marginTop: 2 }}>
            Drop file here, or click to browse
          </span>
        </div>

        {/* Divider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          <div style={{ flex: 1, height: 1, background: '#E4E4E7' }} />
          <span style={{ fontSize: 11, color: '#A1A1AA', whiteSpace: 'nowrap' }}>
            or use your eBird backup
          </span>
          <div style={{ flex: 1, height: 1, background: '#E4E4E7' }} />
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
            border: `1.5px dashed ${isSecondaryActive ? '#A1A1AA' : '#E4E4E7'}`,
            borderRadius: 10,
            background: isSecondaryActive ? '#FAFAFA' : '#fff',
            cursor: 'pointer',
            transition: 'background 0.15s, border-color 0.15s',
            flexShrink: 0,
          }}
          onMouseEnter={e => { if (!isSecondaryActive) (e.currentTarget as HTMLDivElement).style.background = '#FAFAFA' }}
          onMouseLeave={e => { if (!isSecondaryActive) (e.currentTarget as HTMLDivElement).style.background = '#fff' }}
        >
          <div style={{
            width: 36, height: 36, borderRadius: 8, background: '#F4F4F5',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <Upload size={16} strokeWidth={1.75} style={{ color: '#71717A' }} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: '#0F1117' }}>MyEBirdData.csv</div>
            <div style={{ fontSize: 11, color: '#71717A', marginTop: 2 }}>
              Looks up media coverage online — may take a moment for large lists
            </div>
          </div>
          <ChevronRight size={14} strokeWidth={2} style={{ color: '#D4D4D8', flexShrink: 0 }} />
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
        <Loader2 size={32} strokeWidth={2} className="spin" style={{ color: '#2D8653' }} />
        <span style={{ fontSize: 13, color: '#71717A' }}>
          Looking up media… batch {batchCurrent} of {batchTotal}
        </span>
        <div style={{ width: 280, height: 4, background: '#E4E4E7', borderRadius: 2 }}>
          <div style={{
            width: `${progress * 100}%`, height: '100%',
            background: '#2D8653', borderRadius: 2, transition: 'width 0.3s ease',
          }} />
        </div>
        <span style={{ fontSize: 12, color: '#9CA3AF' }}>
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
    width: 1, height: 20, background: '#E4E4E7', flexShrink: 0, alignSelf: 'center',
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
          padding: '9px 13px', background: '#FEF2F2',
          border: '1px solid #FECACA', borderRadius: 8,
          fontSize: 13, color: '#DC2626', marginBottom: 12, flexShrink: 0,
        }}>
          <AlertCircle size={14} strokeWidth={2.5} style={{ flexShrink: 0 }} />
          Couldn't reach the Macaulay Library. Media coverage may be incomplete.
        </div>
      )}

      {source === 'ml-export' && mlUserId === null && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '9px 13px', background: '#FFFBEB',
          border: '1px solid #FDE68A', borderRadius: 8,
          fontSize: 13, color: '#92400E', marginBottom: 12, flexShrink: 0,
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
        </div>

        {/* Right controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <span style={{ fontSize: 12, color: '#71717A' }}>{countLabel}</span>

          <button style={ghostBtn(expanded)} onClick={handleToggleExpanded}>
            {expanded ? '↑ Collapse' : '↓ Show all'}
          </button>
          <button style={ghostBtn()} onClick={handleReset}>Load new file</button>
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
        expanded={expanded}
      />
    </div>
  )
}
