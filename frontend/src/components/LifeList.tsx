import { useRef, useState } from 'react'
import { Upload, Loader2, AlertCircle, Camera, Mic, Video } from 'lucide-react'
import { parseLifeList } from '../lib/parseLifeList'
import type { LifeListEntry } from '../lib/parseLifeList'
import { LifeListTable } from './LifeListTable'
import type { MediaFilter, SortOrder } from '../types'

const BATCH_SIZE = 25

type Phase =
  | { tag: 'idle' }
  | { tag: 'error'; message: string }
  | { tag: 'loading'; entries: LifeListEntry[]; batchCurrent: number; batchTotal: number }
  | { tag: 'ready'; entries: LifeListEntry[]; mediaMap: Record<string, string>; mlError: boolean }

function pillStyle(active: boolean): React.CSSProperties {
  return {
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
    border: active ? '1.5px solid rgba(45,134,83,0.25)' : '1.5px solid #E4E4E7',
    background: active ? '#E8F5EE' : '#fff',
    color: active ? '#2D8653' : '#71717A',
  }
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
  const [filter, setFilter] = useState<MediaFilter>('all')
  const [sort, setSort] = useState<SortOrder>('taxonomic')
  const [expanded, setExpanded] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const startMediaLookup = async (entries: LifeListEntry[]) => {
    const allIds = [...new Set(entries.flatMap(e => e.catalogIds))]

    if (allIds.length === 0) {
      setPhase({ tag: 'ready', entries, mediaMap: {}, mlError: false })
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
        setPhase(p => p.tag === 'loading' ? { ...p, batchCurrent: i + 1 } : p)
      }
      try {
        const res = await fetch('/ml/media-types', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ catalog_ids: batches[i] }),
        })
        if (!res.ok) {
          mlError = true
          break
        }
        const data = await res.json()
        Object.assign(mediaMap, data.media_types)
      } catch {
        mlError = true
        break
      }
    }

    setPhase({ tag: 'ready', entries, mediaMap, mlError })
  }

  const processFile = async (file: File) => {
    try {
      const text = await file.text()
      const entries = parseLifeList(text)
      await startMediaLookup(entries)
    } catch {
      setPhase({
        tag: 'error',
        message:
          "This doesn't look like an eBird backup file. Make sure you're uploading MyEBirdData.csv.",
      })
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }
  const handleDragLeave = () => setIsDragging(false)
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) processFile(file)
  }
  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      processFile(file)
      e.target.value = ''
    }
  }

  const handleReset = () => {
    setPhase({ tag: 'idle' })
    setFilter('all')
    setSort('taxonomic')
    setExpanded(false)
    onExpandedChange?.(false)
  }

  const handleToggleExpanded = () => {
    setExpanded(prev => {
      const next = !prev
      onExpandedChange?.(next)
      return next
    })
  }

  // ── Drop zone (idle / error) ──────────────────────────────────────────────
  if (phase.tag === 'idle' || phase.tag === 'error') {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            border: `2px dashed ${isDragging ? '#2D8653' : '#E4E4E7'}`,
            borderRadius: 12,
            background: isDragging ? '#E8F5EE' : '#fff',
            cursor: 'pointer',
            transition: 'border-color 0.15s, background 0.15s',
            padding: 40,
          }}
        >
          <Upload
            size={32}
            strokeWidth={1.75}
            style={{ color: isDragging ? '#2D8653' : '#9CA3AF' }}
          />
          <span style={{ fontSize: 15, fontWeight: 500, color: '#0F1117' }}>
            Drop your eBird backup file here
          </span>
          <span style={{ fontSize: 13, color: '#71717A' }}>
            Or click to browse — select MyEBirdData.csv
          </span>
          {phase.tag === 'error' && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginTop: 8,
              padding: '9px 13px',
              background: '#FEF2F2',
              borderRadius: 6,
              fontSize: 13,
              color: '#DC2626',
              maxWidth: 420,
              textAlign: 'center',
            }}>
              <AlertCircle size={14} strokeWidth={2.5} style={{ flexShrink: 0 }} />
              {phase.message}
            </div>
          )}
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
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
        minHeight: 0,
      }}>
        <Loader2 size={32} strokeWidth={2} className="spin" style={{ color: '#2D8653' }} />
        <span style={{ fontSize: 13, color: '#71717A' }}>
          Looking up media… batch {batchCurrent} of {batchTotal}
        </span>
        <div style={{ width: 280, height: 4, background: '#E4E4E7', borderRadius: 2 }}>
          <div style={{
            width: `${progress * 100}%`,
            height: '100%',
            background: '#2D8653',
            borderRadius: 2,
            transition: 'width 0.3s ease',
          }} />
        </div>
        <span style={{ fontSize: 12, color: '#9CA3AF' }}>
          {entries.length} species · checking Macaulay Library
        </span>
      </div>
    )
  }

  // ── Ready ─────────────────────────────────────────────────────────────────
  const { entries, mediaMap, mlError } = phase

  const filteredCount = entries.filter(entry => {
    if (filter === 'no-photo') return !entry.catalogIds.some(id => mediaMap[id] === 'Photo')
    if (filter === 'no-audio') return !entry.catalogIds.some(id => mediaMap[id] === 'Audio')
    if (filter === 'no-video') return !entry.catalogIds.some(id => mediaMap[id] === 'Video')
    return true
  }).length

  const countLabel =
    filter === 'all'
      ? `${entries.length} species`
      : `${filteredCount} of ${entries.length} species`

  return (
    <div style={{
      flex: expanded ? 'none' : 1,
      minHeight: expanded ? 'auto' : 0,
      display: 'flex',
      flexDirection: 'column',
      gap: 0,
    }}>
      {mlError && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '9px 13px',
          background: '#FEF2F2',
          border: '1px solid #FECACA',
          borderRadius: 8,
          fontSize: 13,
          color: '#DC2626',
          marginBottom: 12,
          flexShrink: 0,
        }}>
          <AlertCircle size={14} strokeWidth={2.5} style={{ flexShrink: 0 }} />
          Couldn't reach the Macaulay Library. Media coverage may be incomplete.
        </div>
      )}

      {/* Controls row */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 12,
        marginBottom: 14,
        flexShrink: 0,
        flexWrap: 'wrap',
      }}>
        {/* Left — filter pills */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <button style={pillStyle(filter === 'all')} onClick={() => setFilter('all')}>
            All
          </button>
          <button style={pillStyle(filter === 'no-photo')} onClick={() => setFilter('no-photo')}>
            <Camera size={11} strokeWidth={2.5} />
            No photo
          </button>
          <button style={pillStyle(filter === 'no-audio')} onClick={() => setFilter('no-audio')}>
            <Mic size={11} strokeWidth={2.5} />
            No audio
          </button>
          <button style={pillStyle(filter === 'no-video')} onClick={() => setFilter('no-video')}>
            <Video size={11} strokeWidth={2.5} />
            No video
          </button>
        </div>

        {/* Right — count + sort + expand + reset */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <span style={{ fontSize: 12, color: '#71717A' }}>{countLabel}</span>

          {/* Sort segmented control */}
          <div style={{ display: 'flex', borderRadius: 6, overflow: 'hidden', border: '1.5px solid #E4E4E7' }}>
            {(['taxonomic', 'alpha'] as SortOrder[]).map((s, i) => (
              <button
                key={s}
                onClick={() => setSort(s)}
                style={{
                  height: 28,
                  padding: '0 10px',
                  fontSize: 11,
                  fontWeight: 500,
                  fontFamily: 'inherit',
                  cursor: 'pointer',
                  border: 'none',
                  borderLeft: i > 0 ? '1.5px solid #E4E4E7' : 'none',
                  background: sort === s ? '#F4F4F5' : '#fff',
                  color: sort === s ? '#0F1117' : '#71717A',
                }}
              >
                {s === 'taxonomic' ? 'Taxonomic' : 'A–Z'}
              </button>
            ))}
          </div>

          <button style={ghostBtn(expanded)} onClick={handleToggleExpanded}>
            {expanded ? '↑ Collapse' : '↓ Show all'}
          </button>

          <button style={ghostBtn()} onClick={handleReset}>
            Load new file
          </button>
        </div>
      </div>

      <LifeListTable
        entries={entries}
        mediaMap={mediaMap}
        filter={filter}
        sort={sort}
        expanded={expanded}
      />
    </div>
  )
}
