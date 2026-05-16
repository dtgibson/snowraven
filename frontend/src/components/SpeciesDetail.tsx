import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Upload, AlertCircle, Loader2, FileCheck, ChevronDown,
  Search, ExternalLink, Check, Image, Mic, Video, Eye, MessageSquare, Dna,
} from 'lucide-react'
import { parseEbirdObservations } from '../lib/parseEbirdObservations'
import { parseMLExport } from '../lib/parseMLExport'
import { BREEDING_CODE_MAP, BREEDING_CODES, TIER_COLORS } from '../lib/breedingCodes'
import { SpeciesLinks } from './SpeciesLinks'
import type { ObservationEntry, MediaType, StoredFileInfo } from '../types'

// ── Types ──────────────────────────────────────────────────────────────────

type Phase =
  | { tag: 'loading-saved' }
  | { tag: 'idle' }
  | { tag: 'error'; message: string }
  | { tag: 'ready'; observations: ObservationEntry[]; mediaMap: Map<string, MediaType>; hasML: boolean; userId: string | null }

// ── Helpers ────────────────────────────────────────────────────────────────

const MONTHS = ['January','February','March','April','May','June',
                'July','August','September','October','November','December']

function formatDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number)
  if (!year || !month || !day) return dateStr
  return `${day} ${MONTHS[month - 1]} ${year}`
}

function extractUserId(filename: string): string | null {
  const m = filename.match(/^ML__.*_([A-Za-z0-9]+)\.csv$/)
  return m ? m[1] : null
}

function mlCatalogLink(mediaType: MediaType, taxonCode: string | undefined, userId: string | null): string {
  const mt = mediaType === 'Photo' ? 'photo' : mediaType === 'Audio' ? 'audio' : 'video'
  let url = `https://search.macaulaylibrary.org/catalog?mediaType=${mt}`
  if (taxonCode) url += `&taxonCode=${taxonCode}`
  if (userId) url += `&userId=${userId}`
  return url
}

const BREEDING_CODE_CANONICAL_ORDER = new Map(BREEDING_CODES.map((d, i) => [d.code, i]))

const COMMENTS_PAGE = 10

// ── Sub-components (inline) ────────────────────────────────────────────────

function SectionCard({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: 'var(--sr-surface)',
      border: '1px solid var(--sr-border)',
      borderRadius: 12,
      overflow: 'hidden',
      boxShadow: 'var(--sr-card-shadow)',
      ...style,
    }}>
      {children}
    </div>
  )
}

function SectionHead({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '14px 18px 12px',
      borderBottom: '1px solid var(--sr-border-subtle)',
    }}>
      <div style={{
        width: 28, height: 28, borderRadius: 7, flexShrink: 0,
        background: 'var(--sr-accent-bg)', color: 'var(--sr-accent)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {icon}
      </div>
      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--sr-text)' }}>{title}</span>
    </div>
  )
}

function StatLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: 11, fontWeight: 600, textTransform: 'uppercase' as const,
      letterSpacing: '0.07em', color: 'var(--sr-text-disabled)', marginBottom: 4,
    }}>
      {children}
    </div>
  )
}

const SUBMISSION_ID_RE = /^S\d+$/

function StatValueLink({ value, submissionId, small }: { value: string; submissionId: string; small?: boolean }) {
  if (!SUBMISSION_ID_RE.test(submissionId)) {
    return <span style={{ fontSize: small ? 14 : 20, fontWeight: 700, letterSpacing: small ? '-0.01em' : '-0.02em', lineHeight: 1.1, color: 'var(--sr-text)' }}>{value}</span>
  }
  return (
    <a
      href={`https://ebird.org/checklist/${submissionId}`}
      target="_blank"
      rel="noreferrer"
      style={{
        fontSize: small ? 14 : 20,
        fontWeight: 700,
        letterSpacing: small ? '-0.01em' : '-0.02em',
        lineHeight: 1.1,
        color: 'var(--sr-accent)',
        textDecoration: 'none',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
      }}
      onMouseEnter={e => (e.currentTarget.style.textDecoration = 'underline')}
      onMouseLeave={e => (e.currentTarget.style.textDecoration = 'none')}
    >
      {value}
      <ExternalLink size={small ? 10 : 11} strokeWidth={2.5} />
    </a>
  )
}

// ── Main component ─────────────────────────────────────────────────────────

interface Props {
  onExpandedChange?: (expanded: boolean) => void
}

export function SpeciesDetail({ onExpandedChange }: Props) {
  const [phase, setPhase] = useState<Phase>({ tag: 'loading-saved' })
  const [taxonOrders, setTaxonOrders] = useState<Record<string, number>>({})
  const [taxonMap, setTaxonMap] = useState<Record<string, string>>({})
  const [savedFileInfo, setSavedFileInfo] = useState<StoredFileInfo | null>(null)

  const [selectedSpecies, setSelectedSpecies] = useState<string | null>(null)
  const [selectorQuery, setSelectorQuery] = useState('')
  const [dropdownOpen, setDropdownOpen] = useState(false)

  const [commentFilter, setCommentFilter] = useState('')
  const [commentSort, setCommentSort] = useState<'newest' | 'oldest'>('newest')
  const [showAllComments, setShowAllComments] = useState(false)

  const [expanded, setExpanded] = useState(false)
  const [draggingOver, setDraggingOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const selectorRef = useRef<HTMLDivElement>(null)
  const dropdownListRef = useRef<HTMLDivElement>(null)

  const handleToggleExpanded = () => {
    setExpanded(prev => {
      const next = !prev
      onExpandedChange?.(next)
      return next
    })
  }

  const selectSpecies = (name: string | null) => {
    setSelectedSpecies(name)
    setCommentFilter('')
    setCommentSort('newest')
    setShowAllComments(false)
  }

  // Close dropdown on outside click
  useEffect(() => {
    function onPointerDown(e: MouseEvent) {
      if (selectorRef.current && !selectorRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [])

  const fetchTaxonData = async (obs: ObservationEntry[]) => {
    try {
      const seen = new Map<string, string>()
      for (const o of obs) {
        if (!seen.has(o.commonName)) seen.set(o.commonName, o.scientificName)
      }
      const species = [...seen.entries()].map(([commonName, scientificName]) => ({ commonName, scientificName }))
      const res = await fetch('/taxonomy/codes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ species }),
      })
      if (!res.ok) return
      const data = await res.json()
      setTaxonOrders(data.orders ?? {})
      setTaxonMap(data.codes ?? {})
    } catch {
      // silently fail — selector usable in A–Z; ML links omit taxonCode
    }
  }

  // Auto-load from stored files
  useEffect(() => {
    let cancelled = false
    async function autoLoad() {
      try {
        const statusRes = await fetch('/settings/files')
        if (!statusRes.ok || cancelled) { setPhase({ tag: 'idle' }); return }
        const status = await statusRes.json()
        if (!status.ebird) { setPhase({ tag: 'idle' }); return }

        const mlUserId = extractUserId(status.ml?.filename ?? '')

        const fetches: Promise<Response>[] = [fetch('/settings/files/ebird')]
        if (status.ml) fetches.push(fetch('/settings/files/ml'))

        const results = await Promise.all(fetches)
        if (cancelled) return

        const [ebirdRes, mlRes] = results
        if (!ebirdRes.ok) { setPhase({ tag: 'idle' }); return }

        const ebirdText = await ebirdRes.text()
        if (cancelled) return

        const observations = parseEbirdObservations(ebirdText)

        let mediaMap = new Map<string, MediaType>()
        let hasML = false

        if (mlRes?.ok) {
          const mlText = await mlRes.text()
          if (!cancelled) {
            try {
              const mlResult = parseMLExport(mlText)
              mediaMap = new Map(Object.entries(mlResult.mediaMap) as [string, MediaType][])
              hasML = true
            } catch {
              // ML parse failed — proceed without it
            }
          }
        }

        if (cancelled) return
        setSavedFileInfo(status.ebird)
        setPhase({ tag: 'ready', observations, mediaMap, hasML, userId: mlUserId })
        fetchTaxonData(observations)
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
        const observations = parseEbirdObservations(text)
        setPhase({ tag: 'ready', observations, mediaMap: new Map(), hasML: false, userId: null })
        selectSpecies(null)
        setSelectorQuery('')
        fetchTaxonData(observations)
      } catch {
        setPhase({ tag: 'error', message: "This doesn't look like an eBird backup CSV. Check you're uploading MyEBirdData.csv." })
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
    selectSpecies(null)
    setSelectorQuery('')
    setDropdownOpen(false)
    setTaxonOrders({})
    setTaxonMap({})
    setSavedFileInfo(null)
    setExpanded(false)
    onExpandedChange?.(false)
  }

  // ── Derived data ───────────────────────────────────────────────────────

  const { sciNameMap, sortedSpeciesList } = useMemo(() => {
    if (phase.tag !== 'ready') return { sciNameMap: new Map<string, string>(), sortedSpeciesList: [] }
    const seen = new Map<string, string>()
    for (const o of phase.observations) {
      if (!seen.has(o.commonName)) seen.set(o.commonName, o.scientificName)
    }
    const sorted = [...seen.keys()].sort((a, b) => {
      const oa = taxonOrders[a.toLowerCase()] ?? Infinity
      const ob = taxonOrders[b.toLowerCase()] ?? Infinity
      if (oa !== ob) return oa - ob
      return a.localeCompare(b)
    })
    return { sciNameMap: seen, sortedSpeciesList: sorted }
  }, [phase, taxonOrders])

  const filteredSpeciesList = useMemo(() => {
    const q = selectorQuery.trim().toLowerCase()
    if (!q) return sortedSpeciesList
    return sortedSpeciesList.filter(name => {
      if (name.toLowerCase().includes(q)) return true
      return (sciNameMap.get(name) ?? '').toLowerCase().includes(q)
    })
  }, [sortedSpeciesList, selectorQuery, sciNameMap])

  const speciesObs = useMemo((): ObservationEntry[] => {
    if (phase.tag !== 'ready' || !selectedSpecies) return []
    return phase.observations.filter(o => o.commonName === selectedSpecies)
  }, [phase, selectedSpecies])

  // Sightings stats
  const sightingsStats = useMemo(() => {
    if (!speciesObs.length) return null
    const sorted = [...speciesObs].sort((a, b) => a.date.localeCompare(b.date))
    const first = sorted[0]
    const last = sorted[sorted.length - 1]
    let bestCount = -Infinity
    let bestObs: ObservationEntry | null = null
    let individualSum = 0
    let hasNumericCount = false
    for (const o of speciesObs) {
      if (o.count !== null) {
        if (o.count > bestCount) { bestCount = o.count; bestObs = o }
        individualSum += o.count
        hasNumericCount = true
      }
    }
    return {
      total: speciesObs.length,
      totalIndividuals: hasNumericCount ? individualSum : null,
      firstObs: first,
      lastObs: last,
      bestObs,
      bestCount: bestObs ? bestCount : null,
    }
  }, [speciesObs])

  // Media counts
  const mediaCounts = useMemo(() => {
    if (phase.tag !== 'ready') return { Photo: 0, Audio: 0, Video: 0 }
    const counts = { Photo: 0, Audio: 0, Video: 0 }
    const seen = new Set<string>()
    for (const o of speciesObs) {
      for (const id of o.catalogIds) {
        if (!seen.has(id)) {
          seen.add(id)
          const type = phase.mediaMap.get(id)
          if (type && type in counts) counts[type as keyof typeof counts]++
        }
      }
    }
    return counts
  }, [speciesObs, phase])

  // Highest breeding category pill
  const breedingPill = useMemo(() => {
    let bestTier = 0
    for (const o of speciesObs) {
      if (!o.breedingCode) continue
      const def = BREEDING_CODE_MAP.get(o.breedingCode)
      if (def && def.tier > bestTier) bestTier = def.tier
    }
    if (bestTier === 0) return null
    const category = bestTier >= 3 ? 'Confirmed' : bestTier === 2 ? 'Probable' : 'Possible'
    return { tier: bestTier as 1 | 2 | 3 | 4, category }
  }, [speciesObs])

  // Breeding code breakdown
  const breedingBreakdown = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const o of speciesObs) {
      if (o.breedingCode) counts[o.breedingCode] = (counts[o.breedingCode] ?? 0) + 1
    }
    return Object.entries(counts)
      .flatMap(([code, count]) => {
        const def = BREEDING_CODE_MAP.get(code)
        return def ? [{ code, tier: def.tier, label: def.label, count }] : []
      })
      .sort((a, b) => {
        if (b.tier !== a.tier) return b.tier - a.tier
        return (BREEDING_CODE_CANONICAL_ORDER.get(a.code) ?? 99) - (BREEDING_CODE_CANONICAL_ORDER.get(b.code) ?? 99)
      })
  }, [speciesObs])

  // Comments
  const allComments = useMemo(() => {
    const base = speciesObs.filter(o => o.speciesComments.trim() !== '')
    const sorted = [...base].sort((a, b) =>
      commentSort === 'newest'
        ? b.date.localeCompare(a.date)
        : a.date.localeCompare(b.date)
    )
    if (!commentFilter.trim()) return sorted
    const q = commentFilter.toLowerCase()
    return sorted.filter(o => o.speciesComments.toLowerCase().includes(q))
  }, [speciesObs, commentSort, commentFilter])

  // ── Selector input display value ─────────────────────────────────────
  const selectorDisplayValue = dropdownOpen
    ? selectorQuery
    : (selectedSpecies ?? '')

  // ── Render ─────────────────────────────────────────────────────────────

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
            padding: '9px 13px', background: 'var(--sr-error-bg)',
            borderRadius: 8, fontSize: 13, color: 'var(--sr-error)', flexShrink: 0,
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
            flex: 1, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 8,
            border: `2px dashed ${draggingOver ? 'var(--sr-accent)' : 'var(--sr-border)'}`,
            borderRadius: 12,
            background: draggingOver ? 'var(--sr-accent-bg)' : 'var(--sr-surface)',
            cursor: 'pointer', transition: 'background 0.15s, border-color 0.15s', padding: 40,
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
          <span style={{ fontSize: 13, color: 'var(--sr-text-muted)', marginTop: 2, textAlign: 'center' }}>
            MyEBirdData.csv · Drop file here, or click to browse
          </span>
          <span style={{ fontSize: 12, color: 'var(--sr-text-disabled)', marginTop: 4 }}>
            Add your ML export in Settings to also see media statistics.
          </span>
        </div>
        <input ref={fileInputRef} type="file" accept=".csv" style={{ display: 'none' }} onChange={handleFileInput} />
      </div>
    )
  }

  const { observations, hasML, userId } = phase
  const speciesTaxonCode = selectedSpecies ? taxonMap[selectedSpecies] : undefined

  // ── Ready state ────────────────────────────────────────────────────────
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 0,
      flex: expanded ? 'none' : 1,
      minHeight: expanded ? 'auto' : 0,
    }}>

      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, flexShrink: 0, flexWrap: 'wrap' }}>
        {savedFileInfo && (
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            height: 30, padding: '0 10px', borderRadius: 6,
            border: '1.5px solid var(--sr-accent-border)', background: 'var(--sr-accent-bg)',
            fontSize: 12, fontWeight: 500, color: 'var(--sr-accent)',
          }}>
            <FileCheck size={13} strokeWidth={2.2} />
            {savedFileInfo.filename}
          </div>
        )}
        <button
          onClick={handleReset}
          style={{
            height: 30, padding: '0 12px', borderRadius: 6,
            border: '1.5px solid var(--sr-border)', background: 'var(--sr-surface)',
            color: 'var(--sr-text-muted)', fontSize: 12, fontWeight: 500,
            fontFamily: 'inherit', cursor: 'pointer',
          }}
        >
          Load different file
        </button>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={handleToggleExpanded}
            style={{
              height: 30, padding: '0 12px', borderRadius: 6,
              border: `1.5px solid ${expanded ? 'var(--sr-accent-border)' : 'var(--sr-border)'}`,
              background: expanded ? 'var(--sr-accent-bg)' : 'var(--sr-surface)',
              color: expanded ? 'var(--sr-accent)' : 'var(--sr-text-muted)',
              fontSize: 12, fontWeight: 500, fontFamily: 'inherit', cursor: 'pointer',
            }}
          >
            {expanded ? '↑ Collapse' : '↓ Show all'}
          </button>
          <span style={{ fontSize: 12, color: 'var(--sr-text-disabled)' }}>
            {sortedSpeciesList.length} species
          </span>
        </div>
      </div>

      {/* Species selector */}
      <div ref={selectorRef} style={{ position: 'relative', marginBottom: 16, flexShrink: 0, zIndex: 20 }}>
        <div style={{ position: 'relative' }}>
          <span style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--sr-text-muted)', pointerEvents: 'none' }}>
            <Search size={15} strokeWidth={2} />
          </span>
          <input
            type="text"
            value={selectorDisplayValue}
            placeholder="Choose a species…"
            onChange={e => {
              setSelectorQuery(e.target.value)
              if (!dropdownOpen) setDropdownOpen(true)
            }}
            onFocus={() => {
              setSelectorQuery('')
              setDropdownOpen(true)
            }}
            onKeyDown={e => {
              if (e.key === 'Escape') { setDropdownOpen(false); (e.target as HTMLInputElement).blur() }
            }}
            aria-label="Select species"
            aria-expanded={dropdownOpen}
            aria-haspopup="listbox"
            style={{
              width: '100%', height: 40, padding: '0 36px 0 38px',
              border: `1.5px solid ${dropdownOpen ? 'var(--sr-accent)' : 'var(--sr-border)'}`,
              borderRadius: dropdownOpen ? '8px 8px 0 0' : 8,
              borderBottomColor: dropdownOpen ? 'transparent' : undefined,
              fontSize: 14, fontWeight: selectedSpecies && !dropdownOpen ? 500 : 400,
              fontFamily: 'inherit', color: 'var(--sr-text)', background: 'var(--sr-surface)',
              outline: 'none', transition: 'border-color 0.15s',
            }}
          />
          <span
            onClick={() => setDropdownOpen(o => !o)}
            style={{
              position: 'absolute', right: 11, top: '50%',
              transform: `translateY(-50%) rotate(${dropdownOpen ? 180 : 0}deg)`,
              transition: 'transform 0.15s', cursor: 'pointer',
              color: 'var(--sr-text-muted)', display: 'flex',
            }}
          >
            <ChevronDown size={16} strokeWidth={2} />
          </span>
        </div>

        {dropdownOpen && (
          <div
            ref={dropdownListRef}
            role="listbox"
            style={{
              position: 'absolute', top: '100%', left: 0, right: 0,
              background: 'var(--sr-surface)',
              border: '1.5px solid var(--sr-accent)',
              borderTop: 'none', borderRadius: '0 0 8px 8px',
              boxShadow: '0 8px 24px rgba(0,0,0,0.1)',
              maxHeight: 260, overflowY: 'auto',
            }}
          >
            {filteredSpeciesList.length === 0 ? (
              <div style={{ padding: '12px 14px', fontSize: 13, color: 'var(--sr-text-muted)' }}>
                No species match this search.
              </div>
            ) : (
              filteredSpeciesList.map(name => {
                const isSelected = name === selectedSpecies
                return (
                  <div
                    key={name}
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => {
                      selectSpecies(name)
                      setSelectorQuery('')
                      setDropdownOpen(false)
                    }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '9px 14px', cursor: 'pointer',
                      background: isSelected ? 'var(--sr-accent-bg)' : 'transparent',
                    }}
                    onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLDivElement).style.background = 'var(--sr-surface-subtle)' }}
                    onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLDivElement).style.background = 'transparent' }}
                  >
                    <span style={{ width: 16, flexShrink: 0, color: 'var(--sr-accent)' }}>
                      {isSelected && <Check size={13} strokeWidth={3} />}
                    </span>
                    <span style={{ fontSize: 13.5, fontWeight: 500, color: isSelected ? 'var(--sr-accent)' : 'var(--sr-text)', flex: 1 }}>
                      {name}
                    </span>
                    <span style={{ fontSize: 11, fontStyle: 'italic', color: 'var(--sr-text-disabled)' }}>
                      {sciNameMap.get(name)}
                    </span>
                  </div>
                )
              })
            )}
          </div>
        )}
      </div>

      {/* No species selected prompt */}
      {!selectedSpecies && (
        <SectionCard style={{ flex: 1 }}>
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', padding: '56px 32px', textAlign: 'center',
          }}>
            <div style={{
              width: 48, height: 48, borderRadius: 12,
              background: 'var(--sr-surface-subtle)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              marginBottom: 14, color: 'var(--sr-border-medium)',
            }}>
              <Search size={22} strokeWidth={1.8} />
            </div>
            <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--sr-text-muted)' }}>
              Choose a species to see your history with it
            </div>
            <div style={{ fontSize: 13, color: 'var(--sr-text-disabled)', marginTop: 4 }}>
              All statistics come from your loaded eBird backup.
            </div>
          </div>
        </SectionCard>
      )}

      {/* Species detail — shown when a species is selected */}
      {selectedSpecies && sightingsStats && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Summary card */}
          <SectionCard>
            <div style={{ padding: '20px 22px 18px' }}>
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.2, color: 'var(--sr-text)', wordBreak: 'break-word' }}>
                  {selectedSpecies}
                </div>
                <div style={{ fontSize: 14, fontStyle: 'italic', color: 'var(--sr-text-muted)', marginTop: 3, display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 6, wordBreak: 'break-word' }}>
                  <span>{sciNameMap.get(selectedSpecies)}</span>
                  <SpeciesLinks speciesCode={speciesTaxonCode} />
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                {/* Media indicator buttons */}
                {(['Photo', 'Audio', 'Video'] as MediaType[]).map(type => {
                  const Icon = type === 'Photo' ? Image : type === 'Audio' ? Mic : Video
                  const count = mediaCounts[type]
                  const state: 'unavailable' | 'has' | 'none' = !hasML ? 'unavailable' : count > 0 ? 'has' : 'none'
                  return (
                    <button
                      key={type}
                      title={!hasML ? 'Load ML export in Settings for media data' : undefined}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 5,
                        height: 28, padding: '0 10px', borderRadius: 6,
                        fontSize: 12, fontWeight: 500, fontFamily: 'inherit',
                        cursor: 'default', border: '1.5px solid',
                        ...(state === 'has' ? {
                          background: 'var(--sr-accent-bg)',
                          borderColor: 'var(--sr-accent-border)',
                          color: 'var(--sr-accent)',
                        } : {
                          background: 'var(--sr-surface-subtle)',
                          borderColor: 'var(--sr-border)',
                          color: 'var(--sr-text-disabled)',
                        }),
                      }}
                    >
                      <Icon size={12} strokeWidth={2.2} />
                      {type}
                    </button>
                  )
                })}

                {/* Breeding category pill */}
                {breedingPill && (
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: 5,
                    height: 28, padding: '0 10px', borderRadius: 6,
                    fontSize: 12, fontWeight: 600,
                    background: `rgba(var(--sr-tier-${breedingPill.tier}-rgb), 0.08)`,
                    border: `1px solid rgba(var(--sr-tier-${breedingPill.tier}-rgb), 0.2)`,
                    color: TIER_COLORS[breedingPill.tier],
                  }}>
                    <span style={{
                      width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
                      background: TIER_COLORS[breedingPill.tier],
                    }} />
                    {breedingPill.category}
                  </span>
                )}
              </div>
            </div>
          </SectionCard>

          {/* Sightings + Media two-column grid */}
          <div className="sr-two-col">

            {/* Sightings */}
            <SectionCard>
              <SectionHead icon={<Eye size={14} strokeWidth={2.2} />} title="Sightings" />
              <div style={{ padding: '16px 18px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <StatLabel>Checklists</StatLabel>
                    <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.1, color: 'var(--sr-text)' }}>
                      {sightingsStats.total}
                    </div>
                  </div>
                  <div>
                    <StatLabel>Individuals</StatLabel>
                    {sightingsStats.totalIndividuals !== null ? (
                      <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.1, color: 'var(--sr-text)' }}>
                        {sightingsStats.totalIndividuals}
                      </div>
                    ) : (
                      <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--sr-text-disabled)' }}>—</div>
                    )}
                  </div>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <StatLabel>Personal best</StatLabel>
                    {sightingsStats.bestObs ? (
                      <StatValueLink value={String(sightingsStats.bestCount)} submissionId={sightingsStats.bestObs.submissionId} />
                    ) : (
                      <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--sr-text-disabled)' }}>—</div>
                    )}
                  </div>
                  <div>
                    <StatLabel>First seen</StatLabel>
                    <StatValueLink
                      value={formatDate(sightingsStats.firstObs.date)}
                      submissionId={sightingsStats.firstObs.submissionId}
                      small
                    />
                  </div>
                  <div>
                    <StatLabel>Last seen</StatLabel>
                    <StatValueLink
                      value={formatDate(sightingsStats.lastObs.date)}
                      submissionId={sightingsStats.lastObs.submissionId}
                      small
                    />
                  </div>
                </div>
              </div>
            </SectionCard>

            {/* Media Statistics */}
            <SectionCard>
              <SectionHead icon={<Image size={14} strokeWidth={2.2} />} title="Media" />
              <div style={{ padding: '16px 18px' }}>
                {!hasML ? (
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, color: 'var(--sr-text-muted)' }}>
                    <span style={{ fontSize: 13, lineHeight: 1.5 }}>
                      Load your ML export in Settings to see media statistics.
                    </span>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {(['Photo', 'Audio', 'Video'] as MediaType[]).map(type => {
                      const Icon = type === 'Photo' ? Image : type === 'Audio' ? Mic : Video
                      const count = mediaCounts[type]
                      const link = mlCatalogLink(type, speciesTaxonCode, userId)
                      return (
                        <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{
                            width: 22, height: 22, borderRadius: 5, flexShrink: 0,
                            background: 'var(--sr-surface-subtle)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: 'var(--sr-text-muted)',
                          }}>
                            <Icon size={11} strokeWidth={2.2} />
                          </div>
                          <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--sr-text)', flex: 1 }}>{type}s</span>
                          {count > 0 ? (
                            <a
                              href={link}
                              target="_blank"
                              rel="noreferrer"
                              style={{
                                fontSize: 13.5, fontWeight: 600, color: 'var(--sr-accent)',
                                textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 3,
                              }}
                              onMouseEnter={e => (e.currentTarget.style.textDecoration = 'underline')}
                              onMouseLeave={e => (e.currentTarget.style.textDecoration = 'none')}
                            >
                              {count}
                              <ExternalLink size={10} strokeWidth={2.5} />
                            </a>
                          ) : (
                            <span style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--sr-text-disabled)' }}>0</span>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </SectionCard>
          </div>

          {/* Breeding Codes */}
          <SectionCard>
            <SectionHead icon={<Dna size={14} strokeWidth={2.2} />} title="Breeding Codes" />
            <div style={{ padding: breedingBreakdown.length ? '4px 18px' : '16px 18px' }}>
              {breedingBreakdown.length === 0 ? (
                <span style={{ fontSize: 13, color: 'var(--sr-text-muted)' }}>No breeding codes recorded.</span>
              ) : (
                breedingBreakdown.map(({ code, tier, label, count }, idx) => (
                  <div key={code} style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '9px 0',
                    borderBottom: idx < breedingBreakdown.length - 1 ? '1px solid var(--sr-border-subtle)' : 'none',
                  }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, background: TIER_COLORS[tier] }} />
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--sr-text)', minWidth: 28, fontFamily: 'inherit' }}>{code}</span>
                    <span style={{ fontSize: 13, color: 'var(--sr-text)', flex: 1 }}>{label}</span>
                    <span style={{
                      fontSize: 12, fontWeight: 500, color: 'var(--sr-text-muted)',
                      background: 'var(--sr-surface-subtle)', padding: '2px 8px', borderRadius: 10, whiteSpace: 'nowrap',
                    }}>
                      {count} {count === 1 ? 'time' : 'times'}
                    </span>
                  </div>
                ))
              )}
            </div>
          </SectionCard>

          {/* Comments */}
          <SectionCard>
            <SectionHead icon={<MessageSquare size={14} strokeWidth={2.2} />} title="Comments" />

            {/* Controls */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '12px 18px', borderBottom: '1px solid var(--sr-border-subtle)',
              background: 'var(--sr-surface-faint)',
            }}>
              {/* Keyword filter */}
              <div style={{ position: 'relative', flex: 1 }}>
                <span style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: 'var(--sr-text-disabled)', pointerEvents: 'none' }}>
                  <Search size={12} strokeWidth={2.5} />
                </span>
                <input
                  type="text"
                  value={commentFilter}
                  onChange={e => setCommentFilter(e.target.value)}
                  placeholder="Filter comments…"
                  style={{
                    width: '100%', height: 32, padding: '0 10px 0 30px',
                    border: '1.5px solid var(--sr-border)', borderRadius: 6,
                    fontSize: 13, fontFamily: 'inherit', color: 'var(--sr-text)',
                    background: 'var(--sr-surface)', outline: 'none',
                  }}
                  onFocus={e => (e.currentTarget.style.borderColor = 'var(--sr-accent)')}
                  onBlur={e => (e.currentTarget.style.borderColor = 'var(--sr-border)')}
                />
              </div>

              {/* Sort toggle */}
              <div style={{ display: 'inline-flex', border: '1.5px solid var(--sr-accent-border)', borderRadius: 6, overflow: 'hidden', flexShrink: 0 }}>
                {(['newest', 'oldest'] as const).map((dir, i) => (
                  <button
                    key={dir}
                    onClick={() => setCommentSort(dir)}
                    style={{
                      height: 32, padding: '0 12px',
                      border: 'none',
                      borderLeft: i > 0 ? '1.5px solid var(--sr-accent-border)' : 'none',
                      background: commentSort === dir ? 'var(--sr-accent-bg)' : 'transparent',
                      color: commentSort === dir ? 'var(--sr-accent)' : 'var(--sr-text-muted)',
                      fontSize: 12, fontWeight: 500, fontFamily: 'inherit', cursor: 'pointer',
                    }}
                  >
                    {dir === 'newest' ? 'Newest' : 'Oldest'}
                  </button>
                ))}
              </div>

              <span style={{ fontSize: 12, color: 'var(--sr-text-disabled)', fontWeight: 500, flexShrink: 0 }}>
                {allComments.length} {allComments.length === 1 ? 'comment' : 'comments'}
              </span>
            </div>

            {/* Comment rows */}
            {allComments.length === 0 ? (
              <div style={{ padding: '16px 18px', fontSize: 13, color: 'var(--sr-text-muted)' }}>
                {commentFilter.trim()
                  ? 'No comments match this filter.'
                  : 'No species comments found.'}
              </div>
            ) : (
              <>
                {(showAllComments ? allComments : allComments.slice(0, COMMENTS_PAGE)).map((o, idx, arr) => (
                  <div
                    key={`${o.submissionId}-${idx}`}
                    style={{
                      padding: '14px 18px',
                      borderBottom: idx < arr.length - 1 ? '1px solid var(--sr-border-subtle)' : 'none',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5, flexWrap: 'wrap' }}>
                      {SUBMISSION_ID_RE.test(o.submissionId) ? (
                        <a
                          href={`https://ebird.org/checklist/${o.submissionId}`}
                          target="_blank"
                          rel="noreferrer"
                          style={{ fontSize: 12, fontWeight: 600, color: 'var(--sr-accent)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 3 }}
                          onMouseEnter={e => (e.currentTarget.style.textDecoration = 'underline')}
                          onMouseLeave={e => (e.currentTarget.style.textDecoration = 'none')}
                        >
                          {formatDate(o.date)}
                          <ExternalLink size={10} strokeWidth={2.5} />
                        </a>
                      ) : (
                        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--sr-text)' }}>{formatDate(o.date)}</span>
                      )}
                      <span style={{ fontSize: 12, color: 'var(--sr-gray-300)' }}>·</span>
                      <span style={{ fontSize: 12, color: 'var(--sr-text-muted)' }}>{o.location}</span>
                    </div>
                    <div style={{ fontSize: 13.5, color: 'var(--sr-text)', lineHeight: 1.55 }}>
                      {o.speciesComments}
                    </div>
                  </div>
                ))}

                {!showAllComments && allComments.length > COMMENTS_PAGE && (
                  <button
                    onClick={() => setShowAllComments(true)}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                      width: '100%', padding: '13px 18px',
                      border: 'none', borderTop: '1px solid var(--sr-border-subtle)',
                      background: 'var(--sr-surface-faint)',
                      fontSize: 13, fontWeight: 500, color: 'var(--sr-accent)',
                      fontFamily: 'inherit', cursor: 'pointer',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--sr-accent-bg)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'var(--sr-surface-faint)')}
                  >
                    <ChevronDown size={13} strokeWidth={2.5} />
                    Show all {allComments.length} comments
                  </button>
                )}
              </>
            )}
          </SectionCard>

        </div>
      )}

      {/* Unused observations warning suppression */}
      <span style={{ display: 'none' }}>{observations.length}</span>
    </div>
  )
}
