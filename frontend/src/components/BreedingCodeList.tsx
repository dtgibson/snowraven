import { useEffect, useMemo, useRef, useState } from 'react'
import { Upload, AlertCircle, Loader2, FileCheck, MapPin, Calendar } from 'lucide-react'
import { parseBreedingCodes, aggregateBreedingRows } from '../lib/parseBreedingCodes'
import type { BreedingData, BreedingEntry, BreedingCodeRow } from '../lib/parseBreedingCodes'
import { BREEDING_CODE_MAP, TIER_COLORS, CATEGORY_CODES } from '../lib/breedingCodes'
import type { BreedingCategory } from '../lib/breedingCodes'
import { BreedingCodeTable } from './BreedingCodeTable'
import type { BreedingSortState, StoredFileInfo, DateRangeState } from '../types'
import { DATE_RANGE_CLEAR } from '../types'

type Phase =
  | { tag: 'idle' }
  | { tag: 'loading-saved' }
  | { tag: 'error'; message: string }
  | { tag: 'ready'; data: BreedingData }

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
  if (!active) return { ...base, borderColor: 'var(--sr-border)', background: 'var(--sr-surface)', color: 'var(--sr-text-muted)' }
  const bgAlpha = tier === 1 ? 0.15 : 0.08
  const borderAlpha = tier === 1 ? 0.5 : 0.3
  return {
    ...base,
    background: `rgba(var(--sr-tier-${tier}-rgb),${bgAlpha})`,
    borderColor: `rgba(var(--sr-tier-${tier}-rgb),${borderAlpha})`,
    color: `var(--sr-tier-${tier})`,
  }
}

function categoryPillStyle(cat: BreedingCategory, active: boolean): React.CSSProperties {
  const base: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center',
    height: 30, padding: '0 12px', borderRadius: 6,
    fontSize: 12, fontWeight: 500, fontFamily: 'inherit',
    cursor: 'pointer', border: '1.5px solid transparent', background: 'none',
  }
  if (!active) return { ...base, borderColor: 'var(--sr-border)', background: 'var(--sr-surface)', color: 'var(--sr-text-muted)' }
  const styles: Record<BreedingCategory, React.CSSProperties> = {
    confirmed: { background: 'rgba(var(--sr-tier-4-rgb),0.08)', borderColor: 'rgba(var(--sr-tier-4-rgb),0.3)', color: 'var(--sr-tier-4)' },
    probable:  { background: 'rgba(var(--sr-tier-2-rgb),0.08)', borderColor: 'rgba(var(--sr-tier-2-rgb),0.3)', color: 'var(--sr-tier-2)' },
    possible:  { background: 'rgba(var(--sr-tier-1-rgb),0.15)', borderColor: 'rgba(var(--sr-tier-1-rgb),0.5)', color: 'var(--sr-tier-2)' },
  }
  return { ...base, ...styles[cat] }
}

const CATEGORY_META: { key: BreedingCategory; label: string }[] = [
  { key: 'confirmed', label: 'Confirmed' },
  { key: 'probable',  label: 'Probable' },
  { key: 'possible',  label: 'Possible' },
]

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

export function BreedingCodeList() {
  const [phase, setPhase] = useState<Phase>({ tag: 'loading-saved' })
  const [filter, setFilter] = useState<Set<string>>(new Set())
  const [categoryFilter, setCategoryFilter] = useState<Set<BreedingCategory>>(new Set())
  const [sort, setSort] = useState<BreedingSortState>({ column: 'name', dir: 'asc', nameSortMode: 'az' })
  const [draggingOver, setDraggingOver] = useState(false)
  const [wideMode, setWideMode] = useState(false)
  const [taxonMap, setTaxonMap] = useState<Record<string, string>>({})
  const [taxonOrders, setTaxonOrders] = useState<Record<string, number>>({})
  const [savedFileInfo, setSavedFileInfo] = useState<StoredFileInfo | null>(null)
  const [countyFilter, setCountyFilter] = useState<string | null>(null)
  const [dateRange, setDateRange] = useState<DateRangeState>(DATE_RANGE_CLEAR)
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
        setCategoryFilter(new Set())
        setCountyFilter(null)
        setDateRange(DATE_RANGE_CLEAR)
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
    setCategoryFilter(new Set())
    setCountyFilter(null)
    setDateRange(DATE_RANGE_CLEAR)
    setSort({ column: 'name', dir: 'asc', nameSortMode: 'az' })
    setTaxonMap({})
    setTaxonOrders({})
    setSavedFileInfo(null)
  }

  // These useMemos must be declared before any early return so that the
  // hook call order stays the same on every render regardless of phase.
  const phaseData = phase.tag === 'ready' ? phase.data : null

  const counties = useMemo(() => {
    if (!phaseData) return [] as string[]
    const set = new Set<string>()
    for (const row of phaseData.rows) {
      if (row.county) set.add(row.county)
    }
    return [...set].sort()
  }, [phaseData])

  const filteredRows = useMemo((): BreedingCodeRow[] => {
    if (!phaseData) return []
    if (countyFilter === null && !dateRange.from && !dateRange.to) return phaseData.rows
    return phaseData.rows.filter(row => {
      if (countyFilter !== null && row.county !== countyFilter) return false
      if (dateRange.from && row.date < dateRange.from) return false
      if (dateRange.to && row.date > dateRange.to) return false
      return true
    })
  }, [phaseData, countyFilter, dateRange])

  const hasLocationFilter = countyFilter !== null || !!dateRange.from || !!dateRange.to

  const displayData = useMemo(() => {
    if (!phaseData) return null
    if (!hasLocationFilter) return phaseData
    const { entries: filteredEntries, codesPresent: filteredCodes } = aggregateBreedingRows(filteredRows)
    return { ...phaseData, entries: filteredEntries, codesPresent: filteredCodes }
  }, [phaseData, hasLocationFilter, filteredRows])

  if (phase.tag === 'loading-saved') {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Loader2 size={24} strokeWidth={2} className="spin" style={{ color: 'var(--sr-accent)' }} />
      </div>
    )
  }

  if (phase.tag === 'idle' || phase.tag === 'error') {
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
            border: `2px dashed ${draggingOver ? 'var(--sr-accent)' : 'var(--sr-border)'}`,
            borderRadius: 12,
            background: draggingOver ? 'var(--sr-accent-bg)' : 'var(--sr-surface)',
            cursor: 'pointer',
            transition: 'background 0.15s, border-color 0.15s',
            padding: 40,
          }}
          onMouseEnter={e => { if (!draggingOver) (e.currentTarget as HTMLDivElement).style.background = 'var(--sr-surface-faint)' }}
          onMouseLeave={e => { if (!draggingOver) (e.currentTarget as HTMLDivElement).style.background = 'var(--sr-surface)' }}
        >
          <div style={{
            width: 48, height: 48, borderRadius: 12,
            background: 'var(--sr-accent-bg)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Upload size={22} strokeWidth={1.75} style={{ color: 'var(--sr-accent)' }} />
          </div>
          <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--sr-text)' }}>
            Upload your eBird backup
          </span>
          <span style={{ fontSize: 12, color: 'var(--sr-text-muted)', marginTop: 2 }}>
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

  // phaseData and displayData are non-null — phase is 'ready' at this point
  const { entries, codesPresent } = displayData!

  if (entries.length === 0 && !hasLocationFilter) {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
        <span style={{ fontSize: 14, color: 'var(--sr-text-muted)' }}>No species with breeding codes found in this file.</span>
        <button
          onClick={handleReset}
          style={{ height: 32, padding: '0 14px', borderRadius: 6, border: '1.5px solid var(--sr-border)', background: 'var(--sr-surface)', color: 'var(--sr-text-muted)', fontSize: 12, fontWeight: 500, fontFamily: 'inherit', cursor: 'pointer' }}
        >
          Load new file
        </button>
      </div>
    )
  }

  const categoryFilteredEntries = categoryFilter.size === 0
    ? entries
    : entries.filter(e => {
        for (const cat of categoryFilter) {
          if (![...CATEGORY_CODES[cat]].some(code => (e.codes[code] ?? 0) > 0)) return false
        }
        return true
      })

  const filteredCount = (categoryFilter.size === 0 && filter.size === 0)
    ? entries.length
    : categoryFilteredEntries.filter(e =>
        filter.size === 0 || [...filter].every(code => (e.codes[code] ?? 0) > 0)
      ).length

  const totalSpecies = phaseData!.entries.length
  const countLabel = (categoryFilter.size === 0 && filter.size === 0 && !hasLocationFilter)
    ? `${entries.length} species`
    : `${filteredCount} of ${totalSpecies} species`

  // Format a YYYY-MM-DD date as human-readable "May 1, 2022"
  function formatDateLabel(d: string): string {
    if (!d) return ''
    const [y, m, day] = d.split('-').map(Number)
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
    return `${months[(m ?? 1) - 1]} ${day}, ${y}`
  }

  const filterStripText = (() => {
    const parts: string[] = []
    if (countyFilter) parts.push(countyFilter)
    if (dateRange.from && dateRange.to) parts.push(`${formatDateLabel(dateRange.from)} – ${formatDateLabel(dateRange.to)}`)
    else if (dateRange.from) parts.push(`From ${formatDateLabel(dateRange.from)}`)
    else if (dateRange.to) parts.push(`Through ${formatDateLabel(dateRange.to)}`)
    parts.push(`${filteredCount} of ${totalSpecies} species`)
    return parts.join(' · ')
  })()

  return (
    <div style={{
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
              border: filter.size === 0 && categoryFilter.size === 0 ? '1.5px solid var(--sr-accent-border)' : '1.5px solid var(--sr-border)',
              background: filter.size === 0 && categoryFilter.size === 0 ? 'var(--sr-accent-bg)' : 'var(--sr-surface)',
              color: filter.size === 0 && categoryFilter.size === 0 ? 'var(--sr-accent)' : 'var(--sr-text-muted)',
            }}
            onClick={() => { setFilter(new Set()); setCategoryFilter(new Set()) }}
          >
            All
          </button>
          {CATEGORY_META
            .filter(({ key }) => [...CATEGORY_CODES[key]].some(code => codesPresent.includes(code)))
            .map(({ key, label }) => {
              const active = categoryFilter.has(key)
              return (
                <button
                  key={key}
                  style={categoryPillStyle(key, active)}
                  onClick={() => {
                    setCategoryFilter(prev => {
                      const next = new Set(prev)
                      if (next.has(key)) next.delete(key)
                      else next.add(key)
                      return next
                    })
                  }}
                >
                  {label}
                </button>
              )
            })
          }
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

          <div style={{ width: 1, height: 20, background: 'var(--sr-border)', flexShrink: 0, alignSelf: 'center' }} />

          {/* A–Z / Taxonomic sort toggle */}
          <div style={{ display: 'inline-flex', border: '1.5px solid var(--sr-accent-border)', borderRadius: 6, overflow: 'hidden', flexShrink: 0 }}>
            <button
              style={{
                height: 30, padding: '0 13px', border: 'none',
                borderRight: '1.5px solid var(--sr-accent-border)',
                background: sort.nameSortMode === 'az' ? 'var(--sr-accent-bg)' : 'transparent',
                color: sort.nameSortMode === 'az' ? 'var(--sr-accent)' : 'var(--sr-text-muted)',
                fontSize: 12, fontWeight: 500, fontFamily: 'inherit', cursor: 'pointer', whiteSpace: 'nowrap' as const,
              }}
              onClick={() => setSort({ column: 'name', dir: 'asc', nameSortMode: 'az' })}
            >
              A–Z
            </button>
            <button
              style={{
                height: 30, padding: '0 13px', border: 'none',
                background: sort.nameSortMode === 'taxonomic' ? 'var(--sr-accent-bg)' : 'transparent',
                color: sort.nameSortMode === 'taxonomic' ? 'var(--sr-accent)' : 'var(--sr-text-muted)',
                fontSize: 12, fontWeight: 500, fontFamily: 'inherit', cursor: 'pointer', whiteSpace: 'nowrap' as const,
              }}
              onClick={() => setSort({ column: 'name', dir: 'asc', nameSortMode: 'taxonomic' })}
            >
              Taxonomic
            </button>
          </div>

          {counties.length > 0 && (
            <>
              <div style={{ width: 1, height: 20, background: 'var(--sr-border)', flexShrink: 0, alignSelf: 'center' }} />

              {/* County dropdown */}
              <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
                <MapPin size={12} strokeWidth={2} style={{
                  position: 'absolute', left: 7, color: countyFilter ? 'var(--sr-accent)' : 'var(--sr-text-muted)',
                  pointerEvents: 'none', flexShrink: 0,
                }} />
                <select
                  value={countyFilter ?? ''}
                  onChange={e => setCountyFilter(e.target.value || null)}
                  style={{
                    height: 26, paddingLeft: 24, paddingRight: 22, borderRadius: 5,
                    border: countyFilter
                      ? '1.5px solid var(--sr-accent-border-strong)'
                      : '1.5px solid var(--sr-border)',
                    background: countyFilter ? 'var(--sr-accent-bg)' : 'var(--sr-surface)',
                    color: countyFilter ? 'var(--sr-accent)' : 'var(--sr-text-muted)',
                    fontSize: 12, fontWeight: 500, fontFamily: 'inherit',
                    cursor: 'pointer', appearance: 'none', WebkitAppearance: 'none',
                    outline: 'none',
                  }}
                >
                  <option value="">All Counties</option>
                  {counties.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <span style={{
                  position: 'absolute', right: 6, pointerEvents: 'none',
                  color: countyFilter ? 'var(--sr-accent)' : 'var(--sr-text-muted)',
                  fontSize: 9,
                }}>▾</span>
              </div>

              {/* Date range */}
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
                  <Calendar size={11} strokeWidth={2} style={{
                    position: 'absolute', left: 7, color: dateRange.from ? 'var(--sr-accent)' : 'var(--sr-text-muted)',
                    pointerEvents: 'none',
                  }} />
                  <input
                    type="date"
                    value={dateRange.from}
                    onChange={e => setDateRange(prev => ({ ...prev, from: e.target.value }))}
                    style={{
                      height: 26, paddingLeft: 24, paddingRight: 6, borderRadius: 5,
                      border: dateRange.from
                        ? '1.5px solid var(--sr-accent-border-strong)'
                        : '1.5px solid var(--sr-border)',
                      background: dateRange.from ? 'var(--sr-accent-bg)' : 'var(--sr-surface)',
                      color: dateRange.from ? 'var(--sr-accent)' : 'var(--sr-text-disabled)',
                      fontSize: 12, fontFamily: 'inherit', outline: 'none',
                    }}
                  />
                </div>
                <span style={{ fontSize: 11, color: 'var(--sr-text-muted)' }}>→</span>
                <input
                  type="date"
                  value={dateRange.to}
                  onChange={e => setDateRange(prev => ({ ...prev, to: e.target.value }))}
                  style={{
                    height: 26, paddingLeft: 8, paddingRight: 6, borderRadius: 5,
                    border: dateRange.to
                      ? '1.5px solid var(--sr-accent-border-strong)'
                      : '1.5px solid var(--sr-border)',
                    background: dateRange.to ? 'var(--sr-accent-bg)' : 'var(--sr-surface)',
                    color: dateRange.to ? 'var(--sr-accent)' : 'var(--sr-text-disabled)',
                    fontSize: 12, fontFamily: 'inherit', outline: 'none',
                  }}
                />
              </div>
            </>
          )}
        </div>

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
          <button
            style={ghostBtn(wideMode)}
            onClick={() => setWideMode(w => !w)}
            title={wideMode ? 'Collapse table into scroll box' : 'Expand table — scroll the whole page on mobile'}
          >
            {wideMode ? '↔ Normal' : '↔ Unbounded'}
          </button>
          <button style={ghostBtn()} onClick={handleReset}>
            {savedFileInfo ? 'Load different file' : 'Load new file'}
          </button>
        </div>
      </div>

      {hasLocationFilter && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '7px 12px', marginBottom: 8,
          background: 'var(--sr-accent-bg)', borderRadius: 6,
          fontSize: 12, color: 'var(--sr-accent)', flexShrink: 0,
        }}>
          <span style={{ fontWeight: 500 }}>{filterStripText}</span>
          <button
            onClick={() => { setCountyFilter(null); setDateRange(DATE_RANGE_CLEAR) }}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 12, color: 'var(--sr-accent)', fontFamily: 'inherit',
              padding: 0, textDecoration: 'underline',
            }}
          >
            Clear filter
          </button>
        </div>
      )}

      <BreedingCodeTable
        entries={categoryFilteredEntries}
        codesPresent={codesPresent}
        sort={sort}
        onSortChange={setSort}
        filter={filter}
        taxonMap={taxonMap}
        taxonOrders={taxonOrders}
        wideMode={wideMode}
      />
    </div>
  )
}
