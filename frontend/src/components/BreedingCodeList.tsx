import { useEffect, useRef, useState } from 'react'
import { Upload, AlertCircle, Loader2, FileCheck } from 'lucide-react'
import { parseBreedingCodes } from '../lib/parseBreedingCodes'
import type { BreedingData, BreedingEntry } from '../lib/parseBreedingCodes'
import { BREEDING_CODE_MAP, TIER_COLORS } from '../lib/breedingCodes'
import { BreedingCodeTable } from './BreedingCodeTable'
import type { BreedingSortState, StoredFileInfo } from '../types'

type Phase =
  | { tag: 'idle' }
  | { tag: 'loading-saved' }
  | { tag: 'error'; message: string }
  | { tag: 'ready'; data: BreedingData }

interface Props {
  onExpandedChange?: (expanded: boolean) => void
}

function codePillStyle(tier: 1 | 2 | 3 | 4, active: boolean): React.CSSProperties {
  const base: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    height: 30,
    padding: '0 12px',
    borderRadius: 6,
    fontSize: 12,
    fontWeight: 500,
    fontFamily: 'inherit',
    cursor: 'pointer',
    border: '1.5px solid transparent',
    background: 'none',
  }
  if (!active) return { ...base, borderColor: '#E4E4E7', background: '#fff', color: '#71717A' }
  const tierRgb: Record<number, string> = {
    4: '59,7,100',
    3: '107,33,168',
    2: '147,51,234',
    1: '192,132,252',
  }
  const rgb = tierRgb[tier]
  const bgAlpha = tier === 1 ? 0.15 : 0.08
  const borderAlpha = tier === 1 ? 0.5 : 0.3
  const color = tier >= 3 ? TIER_COLORS[tier] : '#7E22CE'
  return {
    ...base,
    background: `rgba(${rgb},${bgAlpha})`,
    borderColor: `rgba(${rgb},${borderAlpha})`,
    color,
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

export function BreedingCodeList({ onExpandedChange }: Props) {
  const [phase, setPhase] = useState<Phase>({ tag: 'loading-saved' })
  const [filter, setFilter] = useState<Set<string>>(new Set())
  const [sort, setSort] = useState<BreedingSortState>({ column: 'name', dir: 'asc', nameSortMode: 'az' })
  const [expanded, setExpanded] = useState(false)
  const [draggingOver, setDraggingOver] = useState(false)
  const [taxonMap, setTaxonMap] = useState<Record<string, string>>({})
  const [taxonOrders, setTaxonOrders] = useState<Record<string, number>>({})
  const [savedFileInfo, setSavedFileInfo] = useState<StoredFileInfo | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const fetchTaxonCodes = async (entries: BreedingEntry[]) => {
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
      // silently fail — links absent, sort falls back to A–Z
    }
  }

  useEffect(() => {
    let cancelled = false
    async function autoLoad() {
      try {
        const statusRes = await fetch('/settings/files')
        if (!statusRes.ok || cancelled) { setPhase({ tag: 'idle' }); return }
        const status = await statusRes.json()
        if (!status.ebird) { setPhase({ tag: 'idle' }); return }
        const fileRes = await fetch('/settings/files/ebird')
        if (!fileRes.ok || cancelled) { setPhase({ tag: 'idle' }); return }
        const text = await fileRes.text()
        if (cancelled) return
        const data = parseBreedingCodes(text)
        if (!data.hasBreedingCodeColumn) { setPhase({ tag: 'idle' }); return }
        setSavedFileInfo(status.ebird)
        setPhase({ tag: 'ready', data })
        if (data.entries.length > 0) fetchTaxonCodes(data.entries)
      } catch {
        if (!cancelled) setPhase({ tag: 'idle' })
      }
    }
    autoLoad()
    return () => { cancelled = true }
  }, [])

  const processFile = (file: File) => {
    file.text().then(text => {
      try {
        const data = parseBreedingCodes(text)
        if (!data.hasBreedingCodeColumn) {
          setPhase({
            tag: 'error',
            message: "This eBird backup doesn't have a Breeding Code column. Make sure you've entered at least one breeding code in eBird before exporting.",
          })
          return
        }
        setPhase({ tag: 'ready', data })
        setFilter(new Set())
        setSort({ column: 'name', dir: 'asc', nameSortMode: 'az' })
        if (data.entries.length > 0) fetchTaxonCodes(data.entries)
      } catch {
        setPhase({
          tag: 'error',
          message: "This doesn't look like an eBird backup CSV. Check you're uploading MyEBirdData.csv.",
        })
      }
    }).catch(() => {
      setPhase({ tag: 'error', message: "Couldn't read the file. Please try again." })
    })
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDraggingOver(false)
    const file = e.dataTransfer.files[0]
    if (file) processFile(file)
  }

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) { processFile(file); e.target.value = '' }
  }

  const handleReset = () => {
    setPhase({ tag: 'idle' })
    setFilter(new Set())
    setSort({ column: 'name', dir: 'asc', nameSortMode: 'az' })
    setExpanded(false)
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

  if (phase.tag === 'loading-saved') {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Loader2 size={24} strokeWidth={2} className="spin" style={{ color: '#2D8653' }} />
      </div>
    )
  }

  if (phase.tag === 'idle' || phase.tag === 'error') {
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

        <div
          onDragOver={e => { e.preventDefault(); setDraggingOver(true) }}
          onDragLeave={() => setDraggingOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            border: `2px dashed ${draggingOver ? '#2D8653' : '#E4E4E7'}`,
            borderRadius: 12,
            background: draggingOver ? 'rgba(45,134,83,0.04)' : '#fff',
            cursor: 'pointer',
            transition: 'background 0.15s, border-color 0.15s',
            padding: 40,
          }}
          onMouseEnter={e => { if (!draggingOver) (e.currentTarget as HTMLDivElement).style.background = '#FAFAFA' }}
          onMouseLeave={e => { if (!draggingOver) (e.currentTarget as HTMLDivElement).style.background = '#fff' }}
        >
          <div style={{
            width: 48, height: 48, borderRadius: 12,
            background: 'rgba(45,134,83,0.08)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Upload size={22} strokeWidth={1.75} style={{ color: '#2D8653' }} />
          </div>
          <span style={{ fontSize: 15, fontWeight: 600, color: '#0F1117' }}>
            Upload your eBird backup
          </span>
          <span style={{ fontSize: 12, color: '#71717A', marginTop: 2 }}>
            MyEBirdData.csv · Drop file here, or click to browse
          </span>
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

  const { data } = phase
  const { entries, codesPresent } = data

  if (entries.length === 0) {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
        <span style={{ fontSize: 14, color: '#71717A' }}>No species with breeding codes found in this file.</span>
        <button
          onClick={handleReset}
          style={{ height: 32, padding: '0 14px', borderRadius: 6, border: '1.5px solid #E4E4E7', background: '#fff', color: '#71717A', fontSize: 12, fontWeight: 500, fontFamily: 'inherit', cursor: 'pointer' }}
        >
          Load new file
        </button>
      </div>
    )
  }

  const filteredCount = filter.size === 0
    ? entries.length
    : entries.filter(e => [...filter].every(code => (e.codes[code] ?? 0) > 0)).length

  const countLabel = filter.size === 0
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
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        gap: 12, marginBottom: 14, flexShrink: 0, flexWrap: 'wrap',
      }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          <button
            style={{
              display: 'inline-flex', alignItems: 'center',
              height: 30, padding: '0 12px', borderRadius: 6,
              fontSize: 12, fontWeight: 500, fontFamily: 'inherit',
              cursor: 'pointer',
              border: filter.size === 0 ? '1.5px solid rgba(45,134,83,0.25)' : '1.5px solid #E4E4E7',
              background: filter.size === 0 ? '#E8F5EE' : '#fff',
              color: filter.size === 0 ? '#2D8653' : '#71717A',
            }}
            onClick={() => setFilter(new Set())}
          >
            All
          </button>
          {codesPresent.map(code => {
            const def = BREEDING_CODE_MAP.get(code)!
            const active = filter.has(code)
            return (
              <button
                key={code}
                style={codePillStyle(def.tier, active)}
                onClick={() => {
                  setFilter(prev => {
                    const next = new Set(prev)
                    if (next.has(code)) next.delete(code)
                    else next.add(code)
                    return next
                  })
                }}
                title={def.label}
              >
                <div style={{
                  width: 14, height: 14, borderRadius: '50%',
                  background: TIER_COLORS[def.tier], flexShrink: 0,
                }} />
                {code}
              </button>
            )
          })}

          <div style={{ width: 1, height: 20, background: '#E4E4E7', flexShrink: 0, alignSelf: 'center' }} />

          {/* A–Z / Taxonomic sort toggle */}
          <div style={{ display: 'inline-flex', border: '1.5px solid #E4E4E7', borderRadius: 6, overflow: 'hidden', flexShrink: 0 }}>
            <button
              style={{
                height: 30, padding: '0 13px', border: 'none',
                borderRight: '1.5px solid #E4E4E7',
                background: sort.nameSortMode === 'az' ? '#2D8653' : '#fff',
                color: sort.nameSortMode === 'az' ? '#fff' : '#71717A',
                fontSize: 12, fontWeight: 500, fontFamily: 'inherit', cursor: 'pointer', whiteSpace: 'nowrap' as const,
              }}
              onClick={() => setSort({ column: 'name', dir: 'asc', nameSortMode: 'az' })}
            >
              A–Z
            </button>
            <button
              style={{
                height: 30, padding: '0 13px', border: 'none',
                background: sort.nameSortMode === 'taxonomic' ? '#2D8653' : '#fff',
                color: sort.nameSortMode === 'taxonomic' ? '#fff' : '#71717A',
                fontSize: 12, fontWeight: 500, fontFamily: 'inherit', cursor: 'pointer', whiteSpace: 'nowrap' as const,
              }}
              onClick={() => setSort({ column: 'name', dir: 'asc', nameSortMode: 'taxonomic' })}
            >
              Taxonomic
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <span style={{ fontSize: 12, color: '#71717A' }}>{countLabel}</span>
          {savedFileInfo && (
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              height: 28, padding: '0 10px',
              background: '#E8F5EE', border: '1.5px solid rgba(45,134,83,0.25)',
              borderRadius: 6, flexShrink: 0,
            }}>
              <FileCheck size={12} strokeWidth={2} style={{ color: '#2D8653', flexShrink: 0 }} />
              <span style={{
                fontSize: 11, fontWeight: 500, color: '#2D8653',
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

      <BreedingCodeTable
        entries={entries}
        codesPresent={codesPresent}
        sort={sort}
        onSortChange={setSort}
        filter={filter}
        expanded={expanded}
        taxonMap={taxonMap}
        taxonOrders={taxonOrders}
      />
    </div>
  )
}
